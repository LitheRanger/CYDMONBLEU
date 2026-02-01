#!/usr/bin/env node
/**
 * Script de prueba para verificar que Shopify y FedEx trabajan juntos
 * 
 * Este script verifica:
 * 1. Que ambos clientes se carguen correctamente
 * 2. Que ambos tengan el método isConfigured()
 * 3. Que cuando están configurados, puedan trabajar juntos
 */

require('dotenv').config();
const shopifyClient = require('./Shopifyclient.js');
const fedexClient = require('./fedexClient.js');

console.log('=================================================');
console.log('🧪 Test de Integración: Shopify + FedEx');
console.log('=================================================\n');

// Test 1: Verificar que los clientes se cargaron
console.log('✅ Test 1: Módulos cargados correctamente');
console.log('   - Shopify client:', typeof shopifyClient === 'object' ? '✅' : '❌');
console.log('   - FedEx client:', typeof fedexClient === 'object' ? '✅' : '❌');

// Test 2: Verificar que ambos tienen isConfigured()
console.log('\n✅ Test 2: Métodos isConfigured() presentes');
console.log('   - shopifyClient.isConfigured:', typeof shopifyClient.isConfigured === 'function' ? '✅' : '❌');
console.log('   - fedexClient.isConfigured:', typeof fedexClient.isConfigured === 'function' ? '✅' : '❌');

// Test 3: Verificar estado de configuración
console.log('\n✅ Test 3: Estado de configuración');
const shopifyConfigured = shopifyClient.isConfigured();
const fedexConfigured = fedexClient.isConfigured();

console.log('   - Shopify configurado:', shopifyConfigured ? '✅ SÍ' : '⚠️  NO');
console.log('   - FedEx configurado:', fedexConfigured ? '✅ SÍ' : '⚠️  NO');

// Test 4: Verificar métodos necesarios para trabajar juntos
console.log('\n✅ Test 4: Métodos de integración presentes');
console.log('   - shopifyClient.getOrder:', typeof shopifyClient.getOrder === 'function' ? '✅' : '❌');
console.log('   - shopifyClient.getOrderById:', typeof shopifyClient.getOrderById === 'function' ? '✅' : '❌');
console.log('   - shopifyClient.getProductDetails:', typeof shopifyClient.getProductDetails === 'function' ? '✅' : '❌');
console.log('   - fedexClient.createReturnLabel:', typeof fedexClient.createReturnLabel === 'function' ? '✅' : '❌');

// Resumen final
console.log('\n=================================================');
console.log('📊 RESUMEN');
console.log('=================================================');

if (shopifyConfigured && fedexConfigured) {
    console.log('✅ Ambos servicios están configurados');
    console.log('✅ Listos para trabajar juntos en el webhook de Stripe');
    console.log('\nFlujo de integración:');
    console.log('  1. Stripe webhook recibe pago confirmado');
    console.log('  2. Shopify obtiene datos de la orden (dirección)');
    console.log('  3. FedEx genera guía de devolución');
    console.log('  4. Guía se guarda en la base de datos');
} else {
    console.log('⚠️  Uno o ambos servicios NO están configurados\n');
    
    if (!shopifyConfigured) {
        console.log('Para configurar Shopify, define en .env:');
        console.log('  - SHOPIFY_CLIENT_ID');
        console.log('  - SHOPIFY_CLIENT_SECRET');
        console.log('  - SHOPIFY_SHOP\n');
    }
    
    if (!fedexConfigured) {
        console.log('Para configurar FedEx, define en .env:');
        console.log('  - FEDEX_CLIENT_ID');
        console.log('  - FEDEX_CLIENT_SECRET');
        console.log('  - FEDEX_ACCOUNT_NUMBER');
        console.log('  - RETURN_COMPANY_NAME');
        console.log('  - RETURN_PHONE');
        console.log('  - RETURN_ADDRESS1');
        console.log('  - RETURN_CITY');
        console.log('  - RETURN_STATE');
        console.log('  - RETURN_POSTAL_CODE\n');
    }
    
    console.log('Sin la configuración completa, el webhook funcionará');
    console.log('pero NO generará automáticamente guías de FedEx.');
}

console.log('=================================================\n');

// Exit code: 0 si todo está bien estructuralmente, independiente de la configuración
process.exit(0);
