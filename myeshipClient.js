const axios = require('axios');

// MyeShip API Configuration
const MYESHIP_ENV = (process.env.MYESHIP_ENV || 'production').toLowerCase();
const MYESHIP_BASE_URL = MYESHIP_ENV === 'production'
  ? 'https://api.myeship.co/rest'
  : 'https://apiqa.myeship.co/rest';

const MYESHIP_API_KEY = process.env.MYESHIP_API_KEY;
const MYESHIP_TIMEOUT_MS = Number(process.env.MYESHIP_TIMEOUT_MS || 10000);

const http = axios.create({ timeout: MYESHIP_TIMEOUT_MS });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function requestWithRetry(fn, retries = 2) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || 0;
      const retryable = status === 429 || status >= 500;
      if (!retryable || i === retries) break;
      await sleep(500 * (i + 1));
    }
  }
  throw lastError;
}

// Return shipment address from environment
const RETURN_COMPANY_NAME = process.env.RETURN_COMPANY_NAME;
const RETURN_CONTACT_NAME = process.env.RETURN_CONTACT_NAME || RETURN_COMPANY_NAME;
const RETURN_PHONE = process.env.RETURN_PHONE;
const RETURN_ADDRESS1 = process.env.RETURN_ADDRESS1;
const RETURN_ADDRESS2 = process.env.RETURN_ADDRESS2 || '';
const RETURN_CITY = process.env.RETURN_CITY;
const RETURN_STATE = process.env.RETURN_STATE;
const RETURN_POSTAL_CODE = process.env.RETURN_POSTAL_CODE;
const RETURN_COUNTRY_CODE = process.env.RETURN_COUNTRY_CODE || 'MX';

// Default package dimensions for returns
const MYESHIP_PKG_WEIGHT = Number(process.env.MYESHIP_PKG_WEIGHT || 1);
const MYESHIP_PKG_WEIGHT_UNIT = process.env.MYESHIP_PKG_WEIGHT_UNIT || 'kg';
const MYESHIP_PKG_LENGTH = Number(process.env.MYESHIP_PKG_LENGTH || 30);
const MYESHIP_PKG_WIDTH = Number(process.env.MYESHIP_PKG_WIDTH || 20);
const MYESHIP_PKG_HEIGHT = Number(process.env.MYESHIP_PKG_HEIGHT || 10);
const MYESHIP_PKG_DIM_UNIT = process.env.MYESHIP_PKG_DIM_UNIT || 'cm';

// Optional: Select cheapest service automatically
const MYESHIP_AUTO_SELECT_CHEAPEST = process.env.MYESHIP_AUTO_SELECT_CHEAPEST === 'true';

/**
 * Verifica si MyeShip está correctamente configurado
 */
function isConfigured() {
  return !!(
    MYESHIP_API_KEY &&
    RETURN_COMPANY_NAME &&
    RETURN_PHONE &&
    RETURN_ADDRESS1 &&
    RETURN_CITY &&
    RETURN_STATE &&
    RETURN_POSTAL_CODE
  );
}

/**
 * Helper para hacer llamadas a la API de MyeShip
 */
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${MYESHIP_BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${MYESHIP_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await requestWithRetry(() => http(config));
    return response.data;
  } catch (error) {
    console.error(`MyeShip API Error (${method} ${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Normaliza direcciones al formato esperado por MyeShip
 */
function parseAddress(address) {
  if (!address) {
    throw new Error('Address is required');
  }

  // Shopify format: address1, address2, city, province_code/province, zip, country_code/country
  const street1 = address.address1 || '';
  const street2 = address.address2 || '';
  const city = address.city || '';
  const state = address.province_code || address.province || 'N/A';
  const zip = address.zip || '';
  const country = address.country_code || address.country || 'MX';

  // Ensure country is 2-letter code
  const countryCode = country.length > 2 ? country.substring(0, 2).toUpperCase() : country.toUpperCase();

  return {
    street1: street1.substring(0, 35),
    street2: street2.substring(0, 35),
    city: city.substring(0, 35),
    state: state.substring(0, 35),
    zip: zip.substring(0, 35),
    country: countryCode
  };
}

/**
 * Construye el payload para crear una cotización (paso 1)
 */
function buildQuotationPayload({ order, requestId }) {
  const shipping = order && order.shipping_address ? order.shipping_address : null;

  if (!shipping) {
    throw new Error('Order does not have shipping address');
  }

  const shipperName = `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || 'Customer';
  const shipperPhone = shipping.phone || process.env.DEFAULT_CUSTOMER_PHONE || '0000000000';
  const shipperEmail = order.customer?.email || 'noreply@example.com';

  const shipperAddress = parseAddress(shipping);
  const returnAddress = {
    street1: RETURN_ADDRESS1.substring(0, 35),
    street2: RETURN_ADDRESS2.substring(0, 35),
    city: RETURN_CITY.substring(0, 35),
    state: RETURN_STATE.substring(0, 35),
    zip: RETURN_POSTAL_CODE.substring(0, 35),
    country: RETURN_COUNTRY_CODE
  };

  return {
    address_from: {
      name: shipperName,
      company: shipperName,
      street1: shipperAddress.street1,
      street2: shipperAddress.street2,
      city: shipperAddress.city,
      state: shipperAddress.state,
      zip: shipperAddress.zip,
      country: shipperAddress.country,
      phone: shipperPhone,
      email: shipperEmail
    },
    address_to: {
      name: RETURN_CONTACT_NAME,
      company: RETURN_COMPANY_NAME,
      street1: returnAddress.street1,
      street2: returnAddress.street2,
      city: returnAddress.city,
      state: returnAddress.state,
      zip: returnAddress.zip,
      country: returnAddress.country,
      phone: RETURN_PHONE,
      email: process.env.RETURN_EMAIL || 'noreply@monbleu.com'
    },
    parcels: [
      {
        length: MYESHIP_PKG_LENGTH,
        width: MYESHIP_PKG_WIDTH,
        height: MYESHIP_PKG_HEIGHT,
        distance_unit: MYESHIP_PKG_DIM_UNIT,
        weight: MYESHIP_PKG_WEIGHT,
        mass_unit: MYESHIP_PKG_WEIGHT_UNIT,
        reference: String(requestId || 'return')
      }
    ],
    order_info: {
      order_num: String(requestId || ''),
      status: 9, // 9 = Return Requested
      paid: 1
    },
    save_order: false
  };
}

/**
 * Crea una cotización y retorna las tarifas disponibles
 */
async function getQuotation(payload) {
  const response = await apiCall('POST', '/quotation', payload);
  
  if (!response || !response.rates) {
    throw new Error('Invalid quotation response from MyeShip');
  }

  return response;
}

/**
 * Selecciona la tarifa más barata o la primera disponible
 */
function selectRate(quotation) {
  if (!quotation.rates || quotation.rates.length === 0) {
    throw new Error('No shipping rates available');
  }

  // If auto-select cheapest is enabled, find it
  if (MYESHIP_AUTO_SELECT_CHEAPEST) {
    const cheapest = quotation.rates.reduce((prev, current) => {
      return parseFloat(current.amount) < parseFloat(prev.amount) ? current : prev;
    });
    return cheapest;
  }

  // Otherwise return the first (or best value) rate
  const bestValue = quotation.rates.find(r => r.tags && r.tags.includes('BESTVALUE'));
  return bestValue || quotation.rates[0];
}

/**
 * Crea el envío usando una tarifa específica (paso 2)
 */
async function createShipment(rateId, labelFormat = 'PDF') {
  const response = await apiCall('POST', '/shipment', {
    rate_id: rateId,
    label_format: labelFormat
  });

  if (response.status !== 'SUCCESS') {
    throw new Error(`Shipment creation failed: ${response.status}`);
  }

  return response;
}

/**
 * Descarga el PDF de la guía en Base64
 */
async function downloadLabelBase64(labelUrl) {
  try {
    const response = await http.get(labelUrl, {
      responseType: 'arraybuffer'
    });
    
    const base64 = Buffer.from(response.data).toString('base64');
    return base64;
  } catch (error) {
    console.error('Error downloading label:', error.message);
    throw error;
  }
}

/**
 * Función principal: Crea una guía de retorno
 * Retorna: { trackingNumber, labelBase64, labelMime }
 */
async function createReturnLabel({ order, requestId }) {
  if (!isConfigured()) {
    throw new Error('MyeShip not configured: missing environment variables');
  }

  try {
    console.log(`📋 MyeShip: Creating return label for request ${requestId}...`);

    // Paso 1: Crear cotización
    const quotationPayload = buildQuotationPayload({ order, requestId });
    const quotation = await getQuotation(quotationPayload);

    console.log(`✅ MyeShip: Got ${quotation.rates.length} available rates`);

    // Paso 2: Seleccionar tarifa
    const selectedRate = selectRate(quotation);
    console.log(`📦 MyeShip: Selected rate - ${selectedRate.provider} (${selectedRate.servicelevel.name}) - $${selectedRate.amount} ${selectedRate.currency}`);

    // Paso 3: Crear envío y generar guía
    const shipment = await createShipment(selectedRate.rate_id, 'PDF');

    if (!shipment.tracking_number) {
      throw new Error('No tracking number received from MyeShip');
    }

    console.log(`✅ MyeShip: Tracking number generated: ${shipment.tracking_number}`);

    // Paso 4: Descargar guía en Base64
    let labelBase64 = null;
    if (shipment.label_url) {
      try {
        labelBase64 = await downloadLabelBase64(shipment.label_url);
        console.log(`✅ MyeShip: Label downloaded (${labelBase64.length} bytes)`);
      } catch (downloadErr) {
        console.warn('⚠️ MyeShip: Could not download label, but tracking was generated');
        // No fallar si no se puede descargar la guía - el tracking es lo importante
      }
    }

    return {
      trackingNumber: shipment.tracking_number,
      labelBase64: labelBase64,
      labelMime: 'application/pdf',
      provider: selectedRate.provider,
      serviceName: selectedRate.servicelevel.name
    };
  } catch (error) {
    console.error('❌ MyeShip Error:', error.message);
    throw error;
  }
}

/**
 * Obtiene información de un envío existente
 */
async function getShipment(trackingNumber) {
  return apiCall('GET', `/shipment?tracking_number=${encodeURIComponent(trackingNumber)}`);
}

/**
 * Cancela un envío
 */
async function cancelShipment(trackingNumber) {
  return apiCall('DELETE', `/shipment?tracking_number=${encodeURIComponent(trackingNumber)}`);
}

module.exports = {
  isConfigured,
  createReturnLabel,
  getShipment,
  cancelShipment
};
