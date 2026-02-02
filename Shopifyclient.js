const path = require('path');
// 1. Forzamos la carga del .env buscando en la carpeta actual
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Si tu versión de Node es vieja (menor a 18), descomenta la siguiente línea:
//const fetch = require('node-fetch'); 

class ShopifyTokenManager {
  constructor(clientId, clientSecret, shop) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    // Limpiamos el dominio por si viene con .myshopify.com
    this.shop = shop;
    this.token = null;
    this.expiresAt = null;
  }

  async getToken() {
    // Si el token existe y le quedan más de 5 min de vida, úsalo
    if (this.token && this.expiresAt > Date.now()) {
      return this.token;
    }
    // Si expiró o no existe, genera uno nuevo
    return await this.refreshToken();
  }

  async refreshToken() {
    try {
      console.log("🔄 Refrescando token de Shopify...");
      const response = await fetch(
        `https://${this.shop}.myshopify.com/admin/oauth/access_token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            grant_type: 'client_credentials'
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Error Auth Shopify: ${response.statusText}`);
      }

      const data = await response.json();
      this.token = data.access_token;
      
      // Guardamos cuándo expira (restamos 5 min de buffer)
      this.expiresAt = Date.now() + (data.expires_in - 300) * 1000;
      
      console.log("✅ Token Shopify actualizado");
      return this.token;
    } catch (error) {
      console.error("❌ Error obteniendo token:", error);
      throw error;
    }
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getToken();
    
    const response = await fetch(`https://${this.shop}.myshopify.com${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
        // Log para depuración si falla
        console.error(`Error en petición a ${endpoint}:`, response.status);
    }

    return await response.json();
  }

  // --- MÉTODOS ESPECÍFICOS PARA TU PROYECTO ---

  // 1. Buscar Orden (Para validación)
  async getOrder(orderName) {
    // Buscamos la orden por nombre (#1001)
    const data = await this.makeRequest(`/admin/api/2024-01/orders.json?name=${orderName}&status=any&limit=1`);
    return data.orders ? data.orders[0] : null;
  }

  // 1.1 Buscar Orden por ID (Para guías de paquetería)
  async getOrderById(orderId) {
    try {
      const data = await this.makeRequest(`/admin/api/2024-01/orders/${orderId}.json`);
      return data.order || null;
    } catch (e) {
      console.error(`Error buscando orden ${orderId}`);
      return null;
    }
  }

  // 2. Obtener Detalles de Producto (Para el Modal de Tallas)
  async getProductDetails(productId) {
    try {
      const data = await this.makeRequest(`/admin/api/2024-01/products/${productId}.json`);
      return data.product;
    } catch (e) {
      console.error(`Error buscando producto ${productId}`);
      return null;
    }
  }
}

// Inicializamos la clase con las variables del .env
const shopifyClientId = process.env.SHOPIFY_CLIENT_ID;
const shopifyClientSecret = process.env.SHOPIFY_CLIENT_SECRET;
// Soportar tanto SHOP_DOMAIN como SHOPIFY_SHOP
const shopifyShop = (process.env.SHOP_DOMAIN || process.env.SHOPIFY_SHOP || '').replace('.myshopify.com', '');

if (!shopifyClientId || !shopifyClientSecret || !shopifyShop) {
  console.warn('⚠️ Shopify no configurado. Define SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET y SHOP_DOMAIN (o SHOPIFY_SHOP) en .env');
}

const shopifyClient = new ShopifyTokenManager(
  shopifyClientId || '',
  shopifyClientSecret || '',
  shopifyShop || ''
);

module.exports = shopifyClient;