const axios = require('axios');

// MyeShip API Configuration
const MYESHIP_ENV = (process.env.MYESHIP_ENV || 'production').toLowerCase();
const MYESHIP_BASE_URL = MYESHIP_ENV === 'production'
  ? 'https://api.myeship.co/rest'
  : 'https://apiqa.myeship.co/rest';

const MYESHIP_API_KEY = process.env.MYESHIP_API_KEY;
const MYESHIP_TIMEOUT_MS = Number(process.env.MYESHIP_TIMEOUT_MS || 30000);

// Máximo de tarifas (paqueterías/servicios) a intentar antes de rendirse
const MYESHIP_MAX_RATE_ATTEMPTS = Number(process.env.MYESHIP_MAX_RATE_ATTEMPTS || 5);

const http = axios.create({ timeout: MYESHIP_TIMEOUT_MS });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function requestWithRetry(fn, retries = 3) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = error?.response?.status || 0;
      const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
      const retryable = status === 429 || status >= 500 || isTimeout;
      if (!retryable || i === retries) break;
      const delay = 1000 * (i + 1) + Math.random() * 500; // Backoff con jitter
      console.log(`⏳ Retry ${i + 1}/${retries} after ${Math.round(delay)}ms...`);
      await sleep(delay);
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
// Optional: Prefer specific provider (e.g., 'fedex', 'dhl', 'estafeta')
const MYESHIP_PREFERRED_PROVIDER = (process.env.MYESHIP_PREFERRED_PROVIDER || '').toLowerCase();

const REQUIRED_CONFIG = [
  { key: 'MYESHIP_API_KEY', value: MYESHIP_API_KEY },
  { key: 'RETURN_COMPANY_NAME', value: RETURN_COMPANY_NAME },
  { key: 'RETURN_PHONE', value: RETURN_PHONE },
  { key: 'RETURN_ADDRESS1', value: RETURN_ADDRESS1 },
  { key: 'RETURN_CITY', value: RETURN_CITY },
  { key: 'RETURN_STATE', value: RETURN_STATE },
  { key: 'RETURN_POSTAL_CODE', value: RETURN_POSTAL_CODE }
];

/**
 * Verifica si MyeShip esta correctamente configurado
 */
function isConfigured() {
  return getMissingConfigFields().length === 0;
}

/**
 * Devuelve lista de variables faltantes para MyeShip
 */
function getMissingConfigFields() {
  return REQUIRED_CONFIG.filter(item => !item.value).map(item => item.key);
}

/**
 * Helper para hacer llamadas a la API de MyeShip.
 * Solo registra el cuerpo de la respuesta, nunca headers (para no filtrar la API key).
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
 * Normaliza teléfono mexicano a 10 dígitos (FedEx/DHL rechazan +52, espacios, guiones)
 */
function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/**
 * Normaliza direcciones al formato esperado por MyeShip
 */
function parseAddress(address) {
  if (!address) {
    throw new Error('Address is required');
  }

  const street1 = address.address1 || '';
  const street2 = address.address2 || '';
  const city = address.city || '';
  const state = address.province_code || address.province || 'N/A';
  const zip = String(address.zip || '').replace(/\D/g, '');
  const country = address.country_code || address.country || 'MX';

  const countryCode = country.length > 2 ? country.substring(0, 2).toUpperCase() : country.toUpperCase();

  return {
    street1: street1.substring(0, 35),
    street2: street2.substring(0, 35),
    city: city.substring(0, 35),
    state: state.substring(0, 35),
    zip: zip.substring(0, 10),
    country: countryCode
  };
}

/**
 * Construye el payload para crear una cotización (paso 1)
 */
function buildQuotationPayload({ order, requestId }) {
  const shipping = order?.shipping_address || order?.billing_address || null;

  if (!shipping) {
    throw new Error('Order does not have a usable address');
  }

  const shipperName = `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || 'Customer';
  const shipperPhone = normalizePhone(shipping.phone || order?.phone || process.env.DEFAULT_CUSTOMER_PHONE) || '0000000000';
  const shipperEmail = order?.email || order?.customer?.email || 'noreply@example.com';

  const shipperAddress = parseAddress(shipping);
  const returnAddress = {
    street1: RETURN_ADDRESS1.substring(0, 35),
    street2: RETURN_ADDRESS2.substring(0, 35),
    city: RETURN_CITY.substring(0, 35),
    state: RETURN_STATE.substring(0, 35),
    zip: RETURN_POSTAL_CODE.substring(0, 35),
    country: RETURN_COUNTRY_CODE
  };

  console.log('📍 MyeShip remitente (cliente que devuelve):', {
    name: shipperName,
    zip: shipperAddress.zip,
    city: shipperAddress.city,
    state: shipperAddress.state
  });

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
      phone: normalizePhone(RETURN_PHONE),
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

const providerOf = (rate) => String(rate?.provider || '').toLowerCase();
const serviceOf = (rate) => String(rate?.servicelevel?.name || '').toLowerCase();
const amountOf = (rate) => {
  const n = parseFloat(rate?.amount);
  return Number.isFinite(n) ? n : Number.MAX_VALUE;
};

/**
 * Ordena las tarifas en orden de preferencia (la primera es la que se intenta primero).
 * Mantiene la misma prioridad que antes:
 *   1. FedEx Express Saver
 *   2. Proveedor preferido (MYESHIP_PREFERRED_PROVIDER)
 *   3. Más barata (si MYESHIP_AUTO_SELECT_CHEAPEST) o BESTVALUE
 *   4. El resto, de la más barata a la más cara (fallback)
 */
function rankRates(quotation) {
  const rates = Array.isArray(quotation?.rates) ? quotation.rates.filter(r => r && r.rate_id) : [];
  if (rates.length === 0) {
    throw new Error('No shipping rates available');
  }

  const byPrice = [...rates].sort((a, b) => amountOf(a) - amountOf(b));
  const ranked = [];
  const push = (rate) => {
    if (rate && !ranked.includes(rate)) ranked.push(rate);
  };

  push(rates.find(r => providerOf(r).includes('fedex') && serviceOf(r) === 'express saver'));

  if (MYESHIP_PREFERRED_PROVIDER) {
    push(byPrice.find(r => providerOf(r).includes(MYESHIP_PREFERRED_PROVIDER)));
  }

  if (MYESHIP_AUTO_SELECT_CHEAPEST) {
    push(byPrice[0]);
  } else {
    push(rates.find(r => Array.isArray(r.tags) && r.tags.includes('BESTVALUE')));
  }

  byPrice.forEach(push);
  return ranked;
}

/**
 * Extrae los mensajes de error de la paquetería de un error de axios
 */
function carrierErrorText(error) {
  const data = error?.response?.data;
  const msgs = Array.isArray(data?.messages) ? data.messages.map(m => m?.text).filter(Boolean) : [];
  return [data?.message, ...msgs].filter(Boolean).join(' | ') || error?.message || String(error);
}

/**
 * ¿El error es de la paquetería (cobertura, servicio, datos que ella rechaza)
 * y vale la pena intentar con otra tarifa?
 * No hace fallback ante errores de autenticación, de red o de MyeShip en general.
 */
function isCarrierRejection(error) {
  const status = error?.response?.status || 0;
  if (status !== 400 && status !== 422) return false;
  const text = carrierErrorText(error);
  return /responded with error|ZIPCODE|NOTAVAILABLE|cobertura|coverage|not available|no disponible/i.test(text);
}

/**
 * Si el rechazo es por cobertura del CP, todos los servicios de esa paquetería van a fallar igual.
 */
function isCoverageRejection(error) {
  return /ZIPCODE|NOTAVAILABLE|cobertura|coverage/i.test(carrierErrorText(error));
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
    const msgs = Array.isArray(response?.messages) ? response.messages.map(m => m?.text).filter(Boolean) : [];
    throw new Error(`Shipment creation failed: ${response.status}${msgs.length ? ' - ' + msgs.join(' | ') : ''}`);
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

    return Buffer.from(response.data).toString('base64');
  } catch (error) {
    console.error('Error downloading label:', error.message);
    throw error;
  }
}

/**
 * Función principal: Crea una guía de retorno.
 * Intenta las tarifas en orden de preferencia; si una paquetería rechaza
 * (p. ej. CP sin cobertura), pasa automáticamente a la siguiente.
 * Retorna: { trackingNumber, labelBase64, labelMime, provider, serviceName, attempts }
 */
async function createReturnLabel({ order, requestId, orderId }) {
  if (!isConfigured()) {
    throw new Error('MyeShip not configured: missing environment variables');
  }

  const reference = requestId || orderId;
  console.log(`📋 MyeShip: Creating return label for request ${reference}...`);

  // Paso 1: Cotizar (siempre fresco, así los rate_id nunca están vencidos)
  const quotationPayload = buildQuotationPayload({ order, requestId: reference });
  const quotation = await getQuotation(quotationPayload);
  const ranked = rankRates(quotation);

  console.log(`✅ MyeShip: ${quotation.rates.length} tarifas. Orden de intento: ${ranked
    .slice(0, MYESHIP_MAX_RATE_ATTEMPTS)
    .map(r => `${r.provider} ${r.servicelevel?.name || ''} $${r.amount}`)
    .join(' → ')}`);

  // Paso 2: Intentar crear la guía con cada tarifa hasta que una funcione
  const failures = [];
  const blockedProviders = new Set();
  let attempts = 0;

  for (const rate of ranked) {
    if (attempts >= MYESHIP_MAX_RATE_ATTEMPTS) break;
    if (blockedProviders.has(providerOf(rate))) continue;
    attempts++;

    const label = `${rate.provider} (${rate.servicelevel?.name || 'N/A'}) $${rate.amount} ${rate.currency || ''}`.trim();
    console.log(`📦 MyeShip [${attempts}/${MYESHIP_MAX_RATE_ATTEMPTS}]: Intentando ${label}`);

    try {
      const shipment = await createShipment(rate.rate_id, 'PDF');

      if (!shipment.tracking_number) {
        throw new Error('No tracking number received from MyeShip');
      }

      console.log(`✅ MyeShip: Guía generada con ${label}: ${shipment.tracking_number}`);

      let labelBase64 = null;
      if (shipment.label_url) {
        try {
          labelBase64 = await downloadLabelBase64(shipment.label_url);
          console.log(`✅ MyeShip: Label downloaded (${labelBase64.length} bytes)`);
        } catch (downloadErr) {
          console.warn('⚠️ MyeShip: Could not download label, but tracking was generated');
        }
      }

      if (failures.length) {
        console.log(`ℹ️ MyeShip: Se usó fallback tras ${failures.length} rechazo(s): ${failures.map(f => f.provider).join(', ')}`);
      }

      return {
        trackingNumber: shipment.tracking_number,
        labelBase64,
        labelMime: 'application/pdf',
        provider: rate.provider,
        serviceName: rate.servicelevel?.name,
        attempts
      };
    } catch (error) {
      if (!isCarrierRejection(error)) {
        // Error de auth, red o de MyeShip: no tiene caso probar otra paquetería
        console.error('❌ MyeShip Error:', carrierErrorText(error));
        throw error;
      }

      const reason = carrierErrorText(error);
      failures.push({ provider: rate.provider, service: rate.servicelevel?.name, reason });
      console.warn(`⚠️ MyeShip: ${label} rechazada → ${reason}`);

      if (isCoverageRejection(error)) {
        blockedProviders.add(providerOf(rate));
      }
    }
  }

  // Ninguna tarifa funcionó: error con el detalle de cada paquetería
  const summary = failures.map(f => `${f.provider} ${f.service || ''}: ${f.reason}`).join(' || ');
  const err = new Error(`Ninguna paquetería pudo generar la guía. ${summary}`);
  err.response = {
    status: 422,
    data: {
      message: 'Ninguna paquetería pudo generar la guía',
      messages: failures.map(f => ({ source: f.provider, text: `${f.provider}: ${f.reason}` })),
      status: 'ERROR'
    }
  };
  err.failures = failures;
  console.error('❌ MyeShip:', err.message);
  throw err;
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
  getMissingConfigFields,
  createReturnLabel,
  getShipment,
  cancelShipment
};
