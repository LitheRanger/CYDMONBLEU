const axios = require('axios');
const qs = require('qs');

const FEDEX_ENV = (process.env.FEDEX_ENV || 'sandbox').toLowerCase();
const FEDEX_BASE_URL = FEDEX_ENV === 'production'
  ? 'https://apis.fedex.com'
  : 'https://apis-sandbox.fedex.com';

const FEDEX_CLIENT_ID = process.env.FEDEX_CLIENT_ID;
const FEDEX_CLIENT_SECRET = process.env.FEDEX_CLIENT_SECRET;
const FEDEX_ACCOUNT_NUMBER = process.env.FEDEX_ACCOUNT_NUMBER;

const RETURN_COMPANY_NAME = process.env.RETURN_COMPANY_NAME;
const RETURN_CONTACT_NAME = process.env.RETURN_CONTACT_NAME || RETURN_COMPANY_NAME;
const RETURN_PHONE = process.env.RETURN_PHONE;
const RETURN_ADDRESS1 = process.env.RETURN_ADDRESS1;
const RETURN_ADDRESS2 = process.env.RETURN_ADDRESS2 || '';
const RETURN_CITY = process.env.RETURN_CITY;
const RETURN_STATE = process.env.RETURN_STATE;
const RETURN_POSTAL_CODE = process.env.RETURN_POSTAL_CODE;
const RETURN_COUNTRY_CODE = process.env.RETURN_COUNTRY_CODE || 'MX';

const FEDEX_SERVICE_TYPE = process.env.FEDEX_SERVICE_TYPE || 'FEDEX_GROUND';
const FEDEX_LABEL_IMAGE_TYPE = process.env.FEDEX_LABEL_IMAGE_TYPE || 'PDF';

const FEDEX_PKG_WEIGHT = Number(process.env.FEDEX_PKG_WEIGHT || 1);
const FEDEX_PKG_WEIGHT_UNIT = process.env.FEDEX_PKG_WEIGHT_UNIT || 'LB';
const FEDEX_PKG_LENGTH = Number(process.env.FEDEX_PKG_LENGTH || 10);
const FEDEX_PKG_WIDTH = Number(process.env.FEDEX_PKG_WIDTH || 10);
const FEDEX_PKG_HEIGHT = Number(process.env.FEDEX_PKG_HEIGHT || 10);
const FEDEX_PKG_DIM_UNIT = process.env.FEDEX_PKG_DIM_UNIT || 'IN';

let accessToken = null;
let tokenExpiresAt = 0;

function isConfigured() {
  return !!(
    FEDEX_CLIENT_ID &&
    FEDEX_CLIENT_SECRET &&
    FEDEX_ACCOUNT_NUMBER &&
    RETURN_COMPANY_NAME &&
    RETURN_PHONE &&
    RETURN_ADDRESS1 &&
    RETURN_CITY &&
    RETURN_STATE &&
    RETURN_POSTAL_CODE
  );
}

async function getAccessToken() {
  if (accessToken && tokenExpiresAt > Date.now()) {
    return accessToken;
  }

  if (!FEDEX_CLIENT_ID || !FEDEX_CLIENT_SECRET) {
    throw new Error('FedEx no configurado: falta FEDEX_CLIENT_ID o FEDEX_CLIENT_SECRET');
  }

  const res = await axios.post(
    `${FEDEX_BASE_URL}/oauth/token`,
    qs.stringify({
      grant_type: 'client_credentials',
      client_id: FEDEX_CLIENT_ID,
      client_secret: FEDEX_CLIENT_SECRET
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  accessToken = res.data.access_token;
  const expiresIn = Number(res.data.expires_in || 0);
  tokenExpiresAt = Date.now() + Math.max(expiresIn - 60, 60) * 1000;

  return accessToken;
}

function buildReturnShipmentPayload({ order, requestId }) {
  const shipping = order && order.shipping_address ? order.shipping_address : null;

  if (!shipping) {
    throw new Error('Orden sin dirección de envío');
  }

  const shipperContactName = `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || 'Cliente';
  const shipperPhone = shipping.phone || process.env.DEFAULT_CUSTOMER_PHONE || '0000000000';

  return {
    accountNumber: { value: FEDEX_ACCOUNT_NUMBER },
    requestedShipment: {
      shipper: {
        contact: {
          personName: shipperContactName,
          phoneNumber: shipperPhone
        },
        address: {
          streetLines: [shipping.address1, shipping.address2].filter(Boolean),
          city: shipping.city,
          stateOrProvinceCode: shipping.province_code || shipping.province,
          postalCode: shipping.zip,
          countryCode: shipping.country_code || shipping.country
        }
      },
      recipients: [
        {
          contact: {
            personName: RETURN_CONTACT_NAME,
            companyName: RETURN_COMPANY_NAME,
            phoneNumber: RETURN_PHONE
          },
          address: {
            streetLines: [RETURN_ADDRESS1, RETURN_ADDRESS2].filter(Boolean),
            city: RETURN_CITY,
            stateOrProvinceCode: RETURN_STATE,
            postalCode: RETURN_POSTAL_CODE,
            countryCode: RETURN_COUNTRY_CODE
          }
        }
      ],
      serviceType: FEDEX_SERVICE_TYPE,
      packagingType: 'YOUR_PACKAGING',
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      shippingChargesPayment: {
        paymentType: 'SENDER',
        payor: {
          responsibleParty: {
            accountNumber: { value: FEDEX_ACCOUNT_NUMBER }
          }
        }
      },
      labelSpecification: {
        imageType: FEDEX_LABEL_IMAGE_TYPE,
        labelStockType: 'PAPER_85X11_TOP_HALF_LABEL'
      },
      requestedPackageLineItems: [
        {
          weight: {
            units: FEDEX_PKG_WEIGHT_UNIT,
            value: FEDEX_PKG_WEIGHT
          },
          dimensions: {
            length: FEDEX_PKG_LENGTH,
            width: FEDEX_PKG_WIDTH,
            height: FEDEX_PKG_HEIGHT,
            units: FEDEX_PKG_DIM_UNIT
          }
        }
      ],
      specialServicesRequested: {
        specialServiceTypes: ['RETURN_SHIPMENT'],
        returnShipmentDetail: {
          returnType: 'PRINT_RETURN_LABEL'
        }
      },
      reference: {
        customerReference: String(requestId || '')
      }
    }
  };
}

async function createReturnLabel({ order, requestId }) {
  if (!isConfigured()) {
    throw new Error('FedEx no configurado: faltan variables de entorno');
  }

  const token = await getAccessToken();
  const payload = buildReturnShipmentPayload({ order, requestId });

  const res = await axios.post(
    `${FEDEX_BASE_URL}/ship/v1/shipments`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const shipment = res.data && res.data.output ? res.data.output : null;
  const transaction = shipment && shipment.transactionShipments ? shipment.transactionShipments[0] : null;
  const trackingNumber = transaction && transaction.masterTrackingNumber
    ? transaction.masterTrackingNumber
    : (transaction && transaction.pieceResponses && transaction.pieceResponses[0]
        ? transaction.pieceResponses[0].trackingNumber
        : null);

  const documents = transaction && transaction.shipmentDocuments ? transaction.shipmentDocuments : [];
  const labelDoc = documents.find(d => d.contentType && d.contentType.toUpperCase().includes(FEDEX_LABEL_IMAGE_TYPE)) || documents[0];

  return {
    trackingNumber: trackingNumber || null,
    labelBase64: labelDoc ? labelDoc.image : null,
    labelMime: labelDoc ? (labelDoc.contentType || FEDEX_LABEL_IMAGE_TYPE) : null
  };
}

module.exports = {
  isConfigured,
  createReturnLabel
};
