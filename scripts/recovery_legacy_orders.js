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
const isPostgreSQL = (process.env.DATABASE_URL || '').includes('postgresql://');

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
        // Use connectionString (same as server.js)
        dbPool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
    } else {
        dbPool = await mysql.createPool({
            host: dbHost,
            user: dbUser,
            password: dbPassword,
            database: dbName,
            port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            multipleStatements: false
        });
    }
    console.log(`✅ Base de datos ${isPostgreSQL ? 'PostgreSQL (Neon)' : 'MySQL'} inicializada`);
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
    const { order_id, contact_email } = request;
    console.log(`\n📋 Procesando solicitud: order_id="${order_id}"`);
    
    // Primero validar si el order_id actual es válido (es un ID numérico de Shopify)
    console.log(`  ✔️ Validando order_id actual...`);
    const validOrder = await validateShopifyId(order_id);
    
    if (validOrder) {
        console.log(`  ✅ El order_id ${order_id} ES VÁLIDO (ID de Shopify) - No necesita corrección`);
        return { status: 'valid', orderId: order_id };
    }
    
    console.log(`  ❌ El order_id ${order_id} NO ES UN ID VÁLIDO de Shopify`);
    
    // Estrategia: Interpretar el order_id como número de orden (#XXXX) y buscar en Shopify
    console.log(`  🔄 Intentando extraer ID del número de orden...`);
    let correctOrder = await findOrderByOrderNumber(order_id);
    
    if (correctOrder) {
        console.log(`  🎯 ¡ENCONTRADA! order_number=#${correctOrder.order_number}, ID=${correctOrder.id}`);
        console.log(`  🔄 Actualizando order_id: ${order_id} → ${correctOrder.id}`);
        
        // Actualizar en database (usar order_id como WHERE clause)
        const updateSQL = isPostgreSQL
            ? `UPDATE returns_requests SET order_id = $1 WHERE order_id = $2`
            : `UPDATE returns_requests SET order_id = ? WHERE order_id = ?`;
        
        try {
            await executeQuery(updateSQL, [String(correctOrder.id), order_id]);
            console.log(`  ✅ Actualizado correctamente`);
            return { status: 'fixed', oldId: order_id, newId: correctOrder.id };
        } catch (e) {
            console.error(`  ❌ Error actualizando: ${e?.message}`);
            return { status: 'error', orderId: order_id, error: e?.message };
        }
    }
    
    console.log(`  ❌ No se pudo encontrar la orden con el número de orden`);
    return { status: 'unfixable', orderId: order_id, reason: 'No se encontró en Shopify' };
}

async function runRecovery() {
    try {
        await initializeConnections();
        
        console.log('\n' + '='.repeat(70));
        console.log('🚀 INICIANDO RECUPERACIÓN DE PEDIDOS LEGACY');
        console.log('='.repeat(70));
        
        // Obtener todos los requests
        // Nota: PostgreSQL usa order_id como identificador único, no tiene columna 'id'
        const selectSQL = `SELECT order_id, contact_email FROM returns_requests ORDER BY created_at DESC`;
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
                console.log(`  - order_id: ${r.orderId} (${r.reason || 'no se encontró'})`);
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
