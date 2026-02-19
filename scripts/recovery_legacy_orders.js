/**
 * Recovery Script: Fix Legacy Orders with Invalid Shopify IDs
 * 
 * This script corrects order_id values in the database by:
 * 1. Finding requests with invalid Shopify IDs
 * 2. Looking up the correct Shopify order using customer_name and contact_email
 * 3. Updating the database with the correct numeric Shopify ID
 * 
 * Usage: node recovery_legacy_orders.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const pg = require('pg');

// Import the shopifyClient instance directly
const shopifyClient = require('../Shopifyclient.js');

let dbPool;
const isPostgreSQL = (process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgresql';

async function initializeConnections() {
    console.log('🔧 Inicializando conexiones...');
    
    // Shopify client is already imported and initialized
    if (!shopifyClient) {
        throw new Error('❌ No se pudo inicializar el cliente de Shopify');
    }
    console.log('✅ Shopify inicializado');
    
    // Initialize Database
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'monbleu_returns';
    
    if (isPostgreSQL) {
        dbPool = new pg.Pool({
            host: dbHost,
            port: process.env.DB_PORT || 5432,
            database: dbName,
            user: dbUser,
            password: dbPassword || undefined
        });
    } else {
        dbPool = await mysql.createPool({
            host: dbHost,
            user: dbUser,
            password: dbPassword || undefined,
            database: dbName,
            multipleStatements: false
        });
    }
    console.log(`✅ Base de datos ${isPostgreSQL ? 'PostgreSQL' : 'MySQL'} inicializada`);
}

async function executeQuery(sql, params = []) {
    if (isPostgreSQL) {
        const client = await dbPool.connect();
        try {
            const result = await client.query(sql, params);
            return [result.rows, result.rowCount];
        } finally {
            client.release();
        }
    } else {
        const conn = await dbPool.getConnection();
        try {
            const [rows] = await conn.execute(sql, params);
            return [rows, rows.length || 0];
        } finally {
            conn.release();
        }
    }
}

async function validateShopifyId(orderId) {
    try {
        const order = await shopifyClient.getOrderById(orderId);
        return order || null;
    } catch (e) {
        return null;
    }
}

async function findOrderByOrderNumber(orderIdValue) {
    try {
        const rawValue = String(orderIdValue || '').trim();
        console.log(`    🔍 Interpretando "${rawValue}" como número de orden...`);
        
        // Si no empieza con #, agregarlo
        const orderName = rawValue.startsWith('#') ? rawValue : `#${rawValue}`;
        console.log(`    🔍 Buscando en Shopify: ${orderName}`);
        
        const order = await shopifyClient.getOrder(orderName);
        if (order) {
            console.log(`    ✅ Encontrada: #${order.order_number} (ID: ${order.id})`);
            return order;
        }
        console.log(`    ❌ No encontrada con ese número`);
        return null;
    } catch (e) {
        console.log(`    ⚠️ Error buscando: ${e?.message}`);
        return null;
    }
}

async function findOrderByCustomer(customerName, contactEmail) {
    try {
        console.log(`    🔍 Buscando orden por cliente: "${customerName}" / ${contactEmail}`);
        
        // Intenta buscar por nombre si empieza con #
        if (customerName && customerName.startsWith('#')) {
            const order = await shopifyClient.getOrder(customerName);
            if (order) {
                console.log(`    ✅ Encontrada por nombre: #${order.order_number} (ID: ${order.id})`);
                return order;
            }
        }
        
        // Si el nombre no funciona, devuelve null (no podemos buscar por email en Shopify API)
        console.log(`    ❌ No se encontró orden por nombre`);
        return null;
    } catch (e) {
        console.log(`    ⚠️ Error buscando orden: ${e?.message}`);
        return null;
    }
}

async function processLegacyRequest(request) {
    const { order_id, customer_name, contact_email, id } = request;
    console.log(`\n📋 Procesando solicitud: ID=${id}, order_id="${order_id}", cliente="${customer_name}"`);
    
    // Primero validar si el order_id actual es válido (es un ID numérico de Shopify)
    console.log(`  ✔️ Validando order_id actual...`);
    const validOrder = await validateShopifyId(order_id);
    
    if (validOrder) {
        console.log(`  ✅ El order_id ${order_id} ES VÁLIDO (ID de Shopify) - No necesita corrección`);
        return { status: 'valid', orderId: order_id };
    }
    
    console.log(`  ❌ El order_id ${order_id} NO ES UN ID VÁLIDO de Shopify`);
    
    // Estrategia 1: Interpretar el order_id como número de orden (#XXXX) y buscar en Shopify
    console.log(`  🔄 Estrategia 1: Intentando como número de orden...`);
    let correctOrder = await findOrderByOrderNumber(order_id);
    
    if (correctOrder) {
        console.log(`  🎯 ¡ENCONTRADA! order_number=#${correctOrder.order_number}, ID=${correctOrder.id}`);
        console.log(`  🔄 Actualizando order_id a: ${correctOrder.id} (anterior: ${order_id})`);
        
        // Actualizar en database
        const updateSQL = isPostgreSQL
            ? `UPDATE returns_requests SET order_id = $1 WHERE id = $2`
            : `UPDATE returns_requests SET order_id = ? WHERE id = ?`;
        
        try {
            await executeQuery(updateSQL, [String(correctOrder.id), id]);
            console.log(`  ✅ Actualizado correctamente`);
            return { status: 'fixed', oldId: order_id, newId: correctOrder.id, strategy: 'order_number' };
        } catch (e) {
            console.error(`  ❌ Error actualizando: ${e?.message}`);
            return { status: 'error', orderId: order_id, error: e?.message };
        }
    }
    
    // Estrategia 2: Intentar recuperar por nombre del cliente
    console.log(`  🔄 Estrategia 2: Intentando por nombre del cliente...`);
    correctOrder = await findOrderByCustomer(customer_name, contact_email);
    
    if (correctOrder) {
        console.log(`  🎯 ¡ENCONTRADA! order_number=#${correctOrder.order_number}, ID=${correctOrder.id}`);
        console.log(`  🔄 Actualizando order_id a: ${correctOrder.id} (anterior: ${order_id})`);
        
        // Actualizar en database
        const updateSQL = isPostgreSQL
            ? `UPDATE returns_requests SET order_id = $1 WHERE id = $2`
            : `UPDATE returns_requests SET order_id = ? WHERE id = ?`;
        
        try {
            await executeQuery(updateSQL, [String(correctOrder.id), id]);
            console.log(`  ✅ Actualizado correctamente`);
            return { status: 'fixed', oldId: order_id, newId: correctOrder.id, strategy: 'customer_name' };
        } catch (e) {
            console.error(`  ❌ Error actualizando: ${e?.message}`);
            return { status: 'error', orderId: order_id, error: e?.message };
        }
    }
    
    console.log(`  ❌ No se pudo encontrar la orden con ninguna estrategia`);
    return { status: 'unfixable', orderId: order_id, customer_name };
}

async function runRecovery() {
    try {
        await initializeConnections();
        
        console.log('\n' + '='.repeat(70));
        console.log('🚀 INICIANDO RECUPERACIÓN DE PEDIDOS LEGACY');
        console.log('='.repeat(70));
        
        // Obtener todos los requests
        const selectSQL = `SELECT id, order_id, customer_name, contact_email FROM returns_requests ORDER BY id`;
        const [requests] = await executeQuery(selectSQL);
        
        console.log(`\n📊 Total de pedidos a revisar: ${requests.length}\n`);
        
        const results = {
            valid: [],
            fixed: [],
            unfixable: [],
            errors: []
        };
        
        // Procesar cada request
        for (const req of requests) {
            const result = await processLegacyRequest(req);
            results[result.status]?.push(result);
            
            // Small delay para no saturar Shopify API
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Resumen
        console.log('\n' + '='.repeat(70));
        console.log('📈 RESUMEN DE RECUPERACIÓN');
        console.log('='.repeat(70));
        console.log(`✅ Válidos (sin cambios):   ${results.valid.length}`);
        console.log(`🔧 Corregidos:             ${results.fixed.length}`);
        console.log(`⚠️  No recuperables:        ${results.unfixable.length}`);
        console.log(`❌ Errores:                ${results.errors.length}`);
        console.log('='.repeat(70));
        
        if (results.fixed.length > 0) {
            console.log('\n🔧 Pedidos corregidos:');
            results.fixed.forEach(r => {
                console.log(`  - order_id: ${r.oldId} → ${r.newId}`);
            });
        }
        
        if (results.unfixable.length > 0) {
            console.log('\n⚠️  Pedidos que requieren revisión manual:');
            results.unfixable.forEach(r => {
                console.log(`  - order_id: ${r.orderId}, cliente: "${r.customer_name}"`);
            });
        }
        
        if (results.errors.length > 0) {
            console.log('\n❌ Errores:');
            results.errors.forEach(r => {
                console.log(`  - order_id: ${r.orderId}, error: ${r.error}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    } finally {
        if (dbPool) {
            if (isPostgreSQL) {
                await dbPool.end();
            } else {
                await dbPool.end();
            }
        }
    }
}

// Ejecutar
runRecovery();
