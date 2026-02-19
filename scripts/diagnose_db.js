#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pg = require('pg');

async function diagnose() {
    console.log('🔍 DIAGNÓSTICO: Listando tablas en la base de datos\n');
    
    try {
        const pool = new pg.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        
        const client = await pool.connect();
        
        // Listar todas las tablas
        console.log('📋 Tablas en la base de datos:\n');
        const tables = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        tables.rows.forEach(t => console.log(`  - ${t.tablename}`));
        
        // Buscar la tabla de returns
        const returnsTables = tables.rows.filter(t => 
            t.tablename.includes('return') || t.tablename.includes('request')
        );
        
        if (returnsTables.length > 0) {
            console.log('\n🎯 Tabla de retornos encontradas:');
            
            for (const table of returnsTables) {
                const tableName = table.tablename;
                console.log(`\n  📊 ${tableName}:`);
                
                // Mostrar columnas
                const columns = await client.query(`
                    SELECT column_name, data_type 
                    FROM information_schema.columns
                    WHERE table_name = $1
                    ORDER BY ordinal_position
                `, [tableName]);
                
                columns.rows.forEach(col => {
                    console.log(`      - ${col.column_name} (${col.data_type})`);
                });
                
                // Contar registros
                const count = await client.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
                console.log(`      📈 Total de registros: ${count.rows[0].cnt}`);
            }
        } else {
            console.log('\n❌ No se encontraron tablas de retornos');
        }
        
        client.release();
        await pool.end();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

diagnose();
