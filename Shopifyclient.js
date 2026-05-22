const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

class ShopifyTokenManager {
  constructor(clientId, clientSecret, shop) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.shop = shop.replace('.myshopify.com', '');
    this.token = null;
    this.expiresAt = null;
  }

  // ─── AUTH ────────────────────────────────────────────────────────────────

  async getToken() {
    if (this.token && this.expiresAt > Date.now()) return this.token;
    return await this.refreshToken();
  }

  async refreshToken() {
    console.log('🔄 Refrescando token de Shopify...');
    const response = await fetch(
      `https://${this.shop}.myshopify.com/admin/oauth/access_token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Error Auth Shopify: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('🔑 Scopes otorgados:', data.scope);
    this.token = data.access_token;
    this.expiresAt = Date.now() + (data.expires_in - 300) * 1000;
    console.log('✅ Token Shopify actualizado');
    return this.token;
  }

  // ─── GraphQL CORE ────────────────────────────────────────────────────────

  async graphql(query, variables = {}) {
    const timeoutMs = Number(process.env.SHOPIFY_TIMEOUT_MS || 10000);
    const token = await this.getToken();

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(
        `https://${this.shop}.myshopify.com/admin/api/2025-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables }),
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(id);
    }

    if (!response.ok) {
      const err = new Error(`Shopify GraphQL HTTP error: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const json = await response.json();
    if (json.errors?.length) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
    }
    return json.data;
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────

  // Convierte GID de Shopify "gid://shopify/Order/12345" → "12345"
  _numericId(gid = '') {
    return String(gid).split('/').pop();
  }

  // Normaliza un nodo de orden GraphQL al formato REST que usa el resto del código
  _normalizeOrder(node) {
    if (!node) return null;
    return {
      id: this._numericId(node.id),
      name: node.name,
      order_number: node.orderNumber,
      email: node.email,
      phone: node.phone,
      financial_status: node.displayFinancialStatus?.toLowerCase(),
      fulfillment_status: node.displayFulfillmentStatus?.toLowerCase(),
      created_at: node.createdAt,
      total_price: node.totalPriceSet?.shopMoney?.amount,
      currency: node.totalPriceSet?.shopMoney?.currencyCode,
      line_items: (node.lineItems?.edges || []).map(({ node: li }) => ({
        id: this._numericId(li.id),
        title: li.title,
        quantity: li.quantity,
        variant_id: li.variant ? this._numericId(li.variant.id) : null,
        variant_title: li.variant?.title,
        sku: li.variant?.sku,
        product_id: li.variant?.product ? this._numericId(li.variant.product.id) : null,
      })),
      shipping_address: node.shippingAddress ? {
        first_name: node.shippingAddress.firstName,
        last_name: node.shippingAddress.lastName,
        address1: node.shippingAddress.address1,
        address2: node.shippingAddress.address2,
        city: node.shippingAddress.city,
        province: node.shippingAddress.province,
        zip: node.shippingAddress.zip,
        country: node.shippingAddress.country,
        phone: node.shippingAddress.phone,
      } : null,
    };
  }

  // ─── FRAGMENTO DE ORDEN (reutilizable) ───────────────────────────────────

  get _orderFragment() {
    return `
      id
      name
      orderNumber
      email
      phone
      createdAt
      displayFinancialStatus
      displayFulfillmentStatus
      totalPriceSet { shopMoney { amount currencyCode } }
      lineItems(first: 50) {
        edges {
          node {
            id
            title
            quantity
            variant {
              id
              title
              sku
              product { id }
            }
          }
        }
      }
      shippingAddress {
        firstName lastName address1 address2
        city province zip country phone
      }
    `;
  }

  // ─── MÉTODOS PÚBLICOS ─────────────────────────────────────────────────────

  // 1. Buscar orden por nombre o número (#166840 / 166840)
  async getOrder(orderName) {
    const clean = String(orderName || '').trim();
    const withHash = clean.startsWith('#') ? clean : `#${clean}`;
    console.log(`🔍 Shopify: Buscando orden por nombre: ${clean}`);

    try {
      const data = await this.graphql(`
        query($q: String!) {
          orders(first: 5, query: $q) {
            edges { node { ${this._orderFragment} } }
          }
        }
      `, { q: `name:${withHash}` });

      const orders = (data?.orders?.edges || []).map(e => this._normalizeOrder(e.node));
      const exact = orders.find(o => o.name === withHash || o.name === clean);

      if (exact) {
        console.log(`   ✅ Encontrada EXACTAMENTE: ${exact.name} (ID: ${exact.id})`);
        return exact;
      }

      console.log(`   ❌ No encontrada`);
      return null;
    } catch (e) {
      console.error(`❌ Error buscando orden ${orderName}:`, e.message);
      return null;
    }
  }

  // 1.1 Buscar orden por ID numérico
  async getOrderById(orderId) {
    const rawId = String(orderId || '').trim();
    console.log(`🔍 Shopify: Buscando orden por ID: ${rawId}`);

    if (!/^\d+$/.test(rawId)) {
      console.log(`   ❌ ID inválido (no es numérico)`);
      return null;
    }

    try {
      const gid = `gid://shopify/Order/${rawId}`;
      const data = await this.graphql(`
        query($id: ID!) {
          order(id: $id) { ${this._orderFragment} }
        }
      `, { id: gid });

      const order = this._normalizeOrder(data?.order);
      if (order) {
        console.log(`   ✅ Encontrada: ${order.name} (ID: ${order.id})`);
        return order;
      }

      console.log(`   ❌ No encontrada`);
      return null;
    } catch (e) {
      console.error(`❌ Error buscando orden ${orderId}:`, e.message);
      return null;
    }
  }

  // 1.2 Buscar orden por order_number (más costoso — evitar si puedes usar getOrder)
  async getOrderByNumber(orderNumber) {
    const clean = String(orderNumber || '').replace(/^#/, '').trim();
    console.log(`🔍 Shopify: Buscando orden por número: #${clean}`);

    if (!/^\d+$/.test(clean)) {
      console.log(`   ❌ Número inválido`);
      return null;
    }

    try {
      const data = await this.graphql(`
        query($q: String!) {
          orders(first: 5, query: $q) {
            edges { node { ${this._orderFragment} } }
          }
        }
      `, { q: `order_number:${clean}` });

      const orders = (data?.orders?.edges || []).map(e => this._normalizeOrder(e.node));
      const exact = orders.find(o => String(o.order_number) === clean);

      if (exact) {
        console.log(`   ✅ Encontrada: ${exact.name} (ID: ${exact.id})`);
        return exact;
      }

      console.log(`   ❌ No encontrada`);
      return null;
    } catch (e) {
      console.error(`❌ Error buscando orden #${orderNumber}:`, e.message);
      return null;
    }
  }

  // 1.3 Buscar orden por input del usuario (entrada principal)
  async getOrderByInput(userInput) {
    console.log(`🔍 Shopify: Buscando orden por NOMBRE (ingresado por usuario): "${userInput}"`);
    try {
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

  // 1.4 Buscar variante por ID
  async getVariantById(variantId) {
    const rawId = String(variantId || '').trim();
    try {
      const gid = rawId.startsWith('gid://') ? rawId : `gid://shopify/ProductVariant/${rawId}`;
      const data = await this.graphql(`
        query($id: ID!) {
          productVariant(id: $id) {
            id title sku price
            product { id title }
            selectedOptions { name value }
          }
        }
      `, { id: gid });

      const v = data?.productVariant;
      if (!v) return null;
      return {
        id: this._numericId(v.id),
        title: v.title,
        sku: v.sku,
        price: v.price,
        product_id: this._numericId(v.product?.id),
        product_title: v.product?.title,
        option1: v.selectedOptions?.[0]?.value,
        option2: v.selectedOptions?.[1]?.value,
        option3: v.selectedOptions?.[2]?.value,
      };
    } catch (e) {
      console.error(`Error buscando variante ${variantId}:`, e.message);
      return null;
    }
  }

  // 2. Obtener detalles de producto
  async getProductDetails(productId) {
    const rawId = String(productId || '').trim();
    try {
      const gid = rawId.startsWith('gid://') ? rawId : `gid://shopify/Product/${rawId}`;
      const data = await this.graphql(`
        query($id: ID!) {
          product(id: $id) {
            id title handle
            variants(first: 100) {
              edges {
                node {
                  id title sku price availableForSale
                  selectedOptions { name value }
                }
              }
            }
            images(first: 5) {
              edges { node { url altText } }
            }
          }
        }
      `, { id: gid });

      const p = data?.product;
      if (!p) return null;
      return {
        id: this._numericId(p.id),
        title: p.title,
        handle: p.handle,
        variants: (p.variants?.edges || []).map(({ node: v }) => ({
          id: this._numericId(v.id),
          title: v.title,
          sku: v.sku,
          price: v.price,
          available: v.availableForSale,
          option1: v.selectedOptions?.[0]?.value,
          option2: v.selectedOptions?.[1]?.value,
          option3: v.selectedOptions?.[2]?.value,
        })),
        images: (p.images?.edges || []).map(({ node: img }) => ({
          src: img.url,
          alt: img.altText,
        })),
      };
    } catch (e) {
      console.error(`Error buscando producto ${productId}:`, e.message);
      return null;
    }
  }
}

// ─── INIT ───────────────────────────────────────────────────────────────────

const shopifyClientId = process.env.SHOPIFY_CLIENT_ID;
const shopifyClientSecret = process.env.SHOPIFY_CLIENT_SECRET;
const shopifyShop = (process.env.SHOP_DOMAIN || process.env.SHOPIFY_SHOP || '').replace('.myshopify.com', '');

if (!shopifyClientId || !shopifyClientSecret || !shopifyShop) {
  console.warn('⚠️ Shopify no configurado. Define SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET y SHOP_DOMAIN en .env');
}

const shopifyClient = new ShopifyTokenManager(
  shopifyClientId || '',
  shopifyClientSecret || '',
  shopifyShop || ''
);

module.exports = shopifyClient;
