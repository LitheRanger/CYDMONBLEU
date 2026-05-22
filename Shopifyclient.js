const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

class ShopifyClient {
  constructor() {
    this.token = process.env.SHOPIFY_ACCESS_TOKEN || '';
    this.shop = (process.env.SHOP_DOMAIN || process.env.SHOPIFY_SHOP || '').replace('.myshopify.com', '');
    
console.log('🔑 TOKEN:', this.token ? `presente (${this.token.substring(0, 10)}...)` : 'AUSENTE ❌');
  console.log('🏪 SHOP:', this.shop || 'AUSENTE ❌');
    
    if (!this.token || !this.shop) {
      console.warn('⚠️ Shopify no configurado. Define SHOPIFY_ACCESS_TOKEN y SHOP_DOMAIN en las variables de entorno.');
    }
  }

  async makeRequest(endpoint, options = {}) {
    const timeoutMs = Number(process.env.SHOPIFY_TIMEOUT_MS || 10000);

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const fetchWithTimeout = async (url, opts) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { ...opts, signal: controller.signal });
        return res;
      } finally {
        clearTimeout(id);
      }
    };

    const attempt = async () => {
      const response = await fetchWithTimeout(
        `https://${this.shop}.myshopify.com${endpoint}`,
        {
          ...options,
          headers: {
            ...options.headers,
            'X-Shopify-Access-Token': this.token,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const status = response.status;
        console.error(`Error en petición a ${endpoint}: ${status}`);
        const err = new Error(`Shopify request failed: ${status}`);
        err.status = status;
        throw err;
      }

      return await response.json();
    };

    const maxRetries = 2;
    let lastErr;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await attempt();
      } catch (err) {
        lastErr = err;
        const status = err.status || 0;
        const retryable = status === 429 || status >= 500 || err.name === 'AbortError';
        if (!retryable || i === maxRetries) break;
        await sleep(500 * (i + 1));
      }
    }
    throw lastErr;
  }

  // Buscar orden por nombre (#166840 o 166840)
  async getOrder(orderName) {
    const cleanName = String(orderName || '').trim();
    console.log(`🔍 Shopify: Buscando orden por nombre: ${cleanName}`);

    try {
      const data = await this.makeRequest(
        `/admin/api/2024-01/orders.json?name=${encodeURIComponent(cleanName)}&status=any&limit=50`
      );

      if (data.orders && data.orders.length > 0) {
        const exactMatch = data.orders.find(order => {
          const name = String(order.name || '').trim();
          return (
            name === cleanName ||
            name === `#${cleanName.replace(/^#/, '')}` ||
            name === cleanName.replace(/^#/, '')
          );
        });

        if (exactMatch) {
          console.log(`   ✅ Encontrada: ${exactMatch.name} (ID: ${exactMatch.id})`);
          return exactMatch;
        }

        console.log(`   ⚠️ ${data.orders.length} resultados pero ninguno exacto`);
        data.orders.forEach((o, i) => {
          console.log(`      [${i}] ${o.name} (order_number: ${o.order_number})`);
        });
      }

      console.log(`   ❌ No encontrada por nombre exacto`);
      return null;
    } catch (e) {
      console.error(`❌ Error buscando orden ${orderName}:`, e.message);
      return null;
    }
  }

  // Buscar orden por ID numérico de Shopify
  async getOrderById(orderId) {
    try {
      const rawId = String(orderId || '').trim();
      console.log(`🔍 Shopify: Buscando orden por ID: ${rawId}`);

      if (!/^\d+$/.test(rawId)) {
        console.log(`   ❌ ID inválido (no es numérico)`);
        return null;
      }

      const data = await this.makeRequest(`/admin/api/2024-01/orders/${rawId}.json`);
      if (data.order) {
        console.log(`   ✅ Encontrada: #${data.order.order_number} (ID: ${data.order.id})`);
        return data.order;
      }

      console.log(`   ❌ No encontrada`);
      return null;
    } catch (e) {
      console.error(`❌ Error buscando orden ${orderId}:`, e.message);
      return null;
    }
  }

  // Buscar orden por input del usuario (nombre o número)
  async getOrderByInput(userInput) {
    console.log(`🔍 Shopify: Buscando orden por NOMBRE (ingresado por usuario): "${userInput}"`);

    try {
      const order = await this.getOrder(userInput);

      if (order) {
        console.log(`   ✅ Encontrada por nombre: ${order.name}`);
        return order;
      }

      console.log(`   ❌ No encontrada por nombre exacto`);
      return null;
    } catch (e) {
      console.error(`❌ Error buscando orden ${userInput}:`, e.message);
      return null;
    }
  }

  // Buscar variante por ID
  async getVariantById(variantId) {
    try {
      const data = await this.makeRequest(`/admin/api/2024-01/variants/${variantId}.json`);
      return data.variant || null;
    } catch (e) {
      console.error(`❌ Error buscando variante ${variantId}:`, e.message);
      return null;
    }
  }

  // Obtener detalles de un producto (variantes, imágenes, opciones)
  async getProductDetails(productId) {
    try {
      const data = await this.makeRequest(`/admin/api/2024-01/products/${productId}.json`);
      return data.product || null;
    } catch (e) {
      console.error(`❌ Error buscando producto ${productId}:`, e.message);
      return null;
    }
  }
}

const shopifyClient = new ShopifyClient();
module.exports = shopifyClient;
