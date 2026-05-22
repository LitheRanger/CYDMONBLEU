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
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, // ← CAMBIO
        body: new URLSearchParams({                                         // ← CAMBIO
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Error Auth Shopify: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.token = data.access_token;
    this.expiresAt = Date.now() + (data.expires_in - 300) * 1000;

    console.log("✅ Token Shopify actualizado");
    return this.token;
  } catch (error) {
    console.error("❌ Error obteniendo token:", error);
    throw error;
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
      const token = await this.getToken();
      const response = await fetchWithTimeout(`https://${this.shop}.myshopify.com${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const status = response.status;
        console.error(`Error en petición a ${endpoint}:`, status);
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

  // --- MÉTODOS ESPECÍFICOS PARA TU PROYECTO ---

  // 1. Buscar Orden (Para validación)
  async getOrder(orderName) {
    // Buscamos la orden por nombre (#1001)
    // IMPORTANTE: Shopify devuelve RESULTADOS PARCIALES, filtramos por EXACTO
    const cleanName = String(orderName || '').trim();
    console.log(`🔍 Shopify: Buscando orden por nombre: ${cleanName}`);
    
    try {
      const data = await this.makeRequest(`/admin/api/2024-01/orders.json?name=${cleanName}&status=any&limit=50`);
      
      if (data.orders && data.orders.length > 0) {
        // IMPORTANTE: Filtrar por COINCIDENCIA EXACTA (no parcial)
        // Shopify devuelve resultados que contienen el texto, filtramos aquí
        const exactMatch = data.orders.find(order => {
          const orderDisplayName = order.name ? String(order.name).trim() : '';
          return orderDisplayName === cleanName || 
                 orderDisplayName === `#${cleanName.replace(/^#/, '')}` ||
                 orderDisplayName === cleanName.replace(/^#/, '');
        });
        
        if (exactMatch) {
          console.log(`   ✅ Encontrada EXACTAMENTE: ${exactMatch.name} (ID: ${exactMatch.id})`);
          return exactMatch;
        }
        
        // Si no hay coincidencia exacta, retornar null (no asumir el primero)
        console.log(`   ⚠️ Búsqueda devolvió ${data.orders.length} resultados pero ninguna EXACTA`);
        data.orders.forEach((o, i) => {
          console.log(`      [${i}] ${o.name} (order_number: ${o.order_number})`);
        });
      }
      
      console.log(`   ❌ No encontrada`);
      return null;
    } catch (e) {
      console.error(`❌ Error buscando orden ${orderName}:`, e.message);
      return null;
    }
  }

  // 1.1 Buscar Orden por ID (Para guías de paquetería)
  async getOrderById(orderId) {
    try {
      const rawId = String(orderId || '').trim();
      console.log(`🔍 Shopify: Buscando orden por ID: ${rawId}`);
      if (!/^[0-9]+$/.test(rawId)) {
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

  // 1.2 Buscar Orden por Número (order_number)
  // Busca UNA orden específica por su número (más exacto que por nombre)
  // Busca en todas las órdenes sin límite (múltiples requests paginados)
  async getOrderByNumber(orderNumber) {
    try {
      const cleanNumber = String(orderNumber || '').replace(/^#/, '').trim();
      console.log(`🔍 Shopify: Buscando orden por número: #${cleanNumber}`);
      
      if (!/^\d+$/.test(cleanNumber)) {
        console.log(`   ❌ Número inválido`);
        return null;
      }

      // Buscar en TODAS las órdenes sin límite usando paginación
      let hasMore = true;
      let cursor = null;
      let attempts = 0;
      const maxAttempts = 100; // 100 * 250 = 25000 órdenes (máximo posible)

      while (hasMore && attempts < maxAttempts) {
        try {
          let url = `/admin/api/2024-01/orders.json?status=any&limit=250&fields=id,order_number`;
          if (cursor) url += `&after=${cursor}`;
          
          const data = await this.makeRequest(url);
          
          if (data.orders && Array.isArray(data.orders)) {
            // Verificar si la orden está en este batch
            const found = data.orders.find(order => 
              String(order.order_number || '').trim() === cleanNumber
            );
            
            if (found) {
              console.log(`   ✅ Encontrada: #${found.order_number} (ID: ${found.id})`);
              return found;
            }
            
            // Preparar para siguiente página
            if (data.orders.length < 250) {
              hasMore = false;
            } else {
              // Usar el último ID como cursor para siguiente página
              cursor = data.orders[data.orders.length - 1].id;
            }
          } else {
            hasMore = false;
          }
        } catch (pageError) {
          console.warn(`⚠️ Error en página ${attempts + 1}:`, pageError.message);
          hasMore = false;
        }
        
        attempts++;
      }
      
      console.log(`   ❌ No encontrada (búsqueda completa en ~${attempts * 250} órdenes)`);
      return null;
    } catch (e) {
      console.error(`❌ Error buscando orden #${orderNumber}:`, e.message);
      return null;
    }
  }

  // 1.3 Buscar Orden por INPUT del usuario (Por nombre principalmente, CON VALIDACIÓN EXACTA)
  // El usuario ingresa el NOMBRE de la orden: "#160670", "160670"
  // Buscamos por nombre, filtramos por EXACTA coincidencia, y extraemos número e ID
  async getOrderByInput(userInput) {
    try {
      const cleanInput = String(userInput || '').replace(/^#/, '').trim();
      
      console.log(`🔍 Shopify: Buscando orden por NOMBRE (ingresado por usuario): "${userInput}"`);
      
      // PRINCIPAL: Buscar por nombre (lo que el usuario ve y espera)
      // getOrder() ahora filtra por EXACTA coincidencia
      const order = await this.getOrder(userInput);
      
      if (order) {
        console.log(`   ✅ Encontrada EXACTAMENTE por nombre: ${order.name}`);
        console.log(`   📊 Datos extraídos - order_number: ${order.order_number}, ID: ${order.id}`);
        return order;
      }
      
      console.log(`   ❌ No encontrada por nombre exacto`);
      return null;
    } catch (e) {
      console.error(`❌ Error buscando orden ${userInput}:`, e.message);
      return null;
    }
  }

  // 1.4 Buscar Variante por ID (Para mostrar talla/color en cambios)
  async getVariantById(variantId) {
    try {
      const data = await this.makeRequest(`/admin/api/2024-01/variants/${variantId}.json`);
      return data.variant || null;
    } catch (e) {
      console.error(`Error buscando variante ${variantId}`);
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
