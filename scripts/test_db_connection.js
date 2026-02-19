#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('🔧 DIAGNÓSTICO DE CONEXIÓN A BASE DE DATOS\n');

// Log environment variables (hide passwords)
console.log('📋 Variables de .env:');
console.log(`  DB_HOST: ${process.env.DB_HOST || 'NO CONFIGURADO'}`);
console.log(`  DB_PORT: ${process.env.DB_PORT || '3306 (default)'}`);
console.log(`  DB_USER: ${process.env.DB_USER || 'NO CONFIGURADO'}`);
console.log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? '✅ CONFIGURADO' : '❌ NO CONFIGURADO'}`);
console.log(`  DB_NAME: ${process.env.DB_NAME || 'NO CONFIGURADO'}`);
console.log(`  DB_TYPE: ${process.env.DB_TYPE || 'mysql (default)'}\n`);

const mysql = require('mysql2/promise');

async function testConnection() {
    try {
        console.log('🔗 Intentando conectar a MySQL...\n');
        
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'monbleu_returns',
            port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
            waitForConnections: true,
            connectionLimit: 1,
            queueLimit: 0
        });

        const conn = await pool.getConnection();
        console.log('✅ ¡Conexión exitosa!\n');
        
        // Test query
        const [rows] = await conn.query('SELECT COUNT(*) as total FROM returns_requests');
        console.log(`📊 Total de solicitudes en BD: ${rows[0].total}\n`);
        
        // List some requests
        const [requests] = await conn.query('SELECT id, order_id, customer_name FROM returns_requests LIMIT 5');
        console.log('📋 Primeras 5 solicitudes:');
        requests.forEach((r, i) => {
            console.log(`  ${i+1}. ID=${r.id}, order_id="${r.order_id}", cliente="${r.customer_name}"`);
        });
        
        conn.release();
        await pool.end();
        
        console.log('\n✅ El script de recuperación debería funcionar ahora.');
        
    } catch (error) {
        console.error('❌ Error de conexión:\n');
        console.error(`  Código: ${error.code}`);
        console.error(`  Mensaje: ${error.message}\n`);
        
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('💡 SOLUCIONES:');
            console.error('  1. Verifica que MySQL está corriendo');
            console.error('  2. Verifica usuario/contraseña en .env');
            console.error('  3. Prueba conectar manualmente:');
            console.error(`     mysql -h ${process.env.DB_HOST || 'localhost'} -u ${process.env.DB_USER || 'root'} -p`);
        } else if (error.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('💡 Parece que MySQL no está corriendo. Verifica:');
            console.error('  - MySQL Service está activo');
            console.error('  - Host/puerto correcto');
        }
        
        process.exit(1);
    }
}

testConnection();
