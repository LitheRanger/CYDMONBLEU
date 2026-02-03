# MyeShip Integration Setup

## Environment Variables Required

### MyeShip API Configuration

```env
# MyeShip API Key (get from https://app.myeship.co/settings/api-keys)
MYESHIP_API_KEY=your_api_key_here

# Environment: 'production' or 'sandbox' (default: production)
MYESHIP_ENV=production

# Default package dimensions for returns
MYESHIP_PKG_WEIGHT=1              # kg (default: 1)
MYESHIP_PKG_WEIGHT_UNIT=kg        # kg or lb (default: kg)
MYESHIP_PKG_LENGTH=30             # cm (default: 30)
MYESHIP_PKG_WIDTH=20              # cm (default: 20)
MYESHIP_PKG_HEIGHT=10             # cm (default: 10)
MYESHIP_PKG_DIM_UNIT=cm           # cm or in (default: cm)

# Optional: Auto-select cheapest shipping rate
MYESHIP_AUTO_SELECT_CHEAPEST=false
```

### Return Address Configuration

```env
# Return/Pickup Address (where customers send items back)
RETURN_COMPANY_NAME=MON|BLEU
RETURN_CONTACT_NAME=Returns Department
RETURN_PHONE=+34 XXX XXXXXX
RETURN_ADDRESS1=Calle Principal 123
RETURN_ADDRESS2=Suite 100
RETURN_CITY=Madrid
RETURN_STATE=Madrid
RETURN_POSTAL_CODE=28001
RETURN_COUNTRY_CODE=ES    # 2-letter ISO code
RETURN_EMAIL=returns@monbleu.com

# Optional: Default customer phone if not available from order
DEFAULT_CUSTOMER_PHONE=0000000000
```

## How MyeShip Integration Works

### Flow Diagram

```
1. Customer submits return request
         ↓
2. Server calls myeshipClient.createReturnLabel()
         ↓
3. MyeShip Step 1: Get Quotation (available shipping rates)
         ↓
4. MyeShip Step 2: Select Rate (cheapest or best value)
         ↓
5. MyeShip Step 3: Create Shipment (generate label & tracking)
         ↓
6. MyeShip Step 4: Download Label (PDF → Base64)
         ↓
7. Save to database: tracking_number, label_base64, carrier='MYESHIP'
         ↓
8. Return tracking number to customer
```

### Comparison: FedEx vs MyeShip

| Feature | FedEx | MyeShip |
|---------|-------|---------|
| Authentication | OAuth (tokens expire) | API Key (static) |
| Service Selection | Fixed (FEDEX_SERVICE_TYPE) | Dynamic (choose from available rates) |
| Label Format | PDF_85X11_TOP_HALF_LABEL | Standard PDF or 4x6 thermal |
| Multiple Carriers | No (FedEx only) | Yes (DHL, UPS, Estafeta, etc.) |
| Price | Fixed (no shopping) | Dynamic quotations for each shipment |
| Setup Complexity | Medium | Low |
| Cost | Higher per label | Competitive shopping |

## Migration from FedEx

### Old Implementation (FedEx)
```javascript
const fedexClient = require('./fedexClient.js');
if (fedexClient.isConfigured()) {
  const label = await fedexClient.createReturnLabel({ order, requestId });
  carrier = 'FEDEX';
}
```

### New Implementation (MyeShip)
```javascript
const myeshipClient = require('./myeshipClient.js');
if (myeshipClient.isConfigured()) {
  const label = await myeshipClient.createReturnLabel({ order, requestId });
  carrier = 'MYESHIP';
}
```

**The interface is identical - just swap the client!**

## API Endpoints Used

MyeShip API flows (all require Bearer authentication):

1. **POST /quotation** - Get available shipping rates
   - Input: sender & recipient addresses, package dimensions
   - Output: Array of rates with price, provider, estimated delivery

2. **POST /shipment** - Create shipment and generate label
   - Input: Selected rate_id
   - Output: Tracking number, label URL, provider details

3. **GET /shipment** - Get shipment status
   - Input: tracking_number or shipment_id
   - Output: Tracking details, events, status

4. **DELETE /shipment** - Cancel shipment
   - Input: tracking_number or shipment_id
   - Output: Success/failure confirmation

## Testing MyeShip Integration

### 1. Verify Configuration
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.myeship.co/rest/quotation
```

### 2. Test Return Label Generation

Via admin panel:
1. Go to `/admin.html`
2. Find a return request
3. Click "Ver" to open details
4. System should auto-generate tracking number
5. Verify in database: `SELECT carrier, tracking_number FROM returns_requests LIMIT 1;`

Expected carrier value: `MYESHIP`

### 3. Check Tracking

Once a label is generated, you can track via:
- MyeShip Portal: https://app.myeship.co/
- Direct URL: `https://track.myeship.co/track?no={tracking_number}`

## Troubleshooting

### "MyeShip not configured"
- Verify `MYESHIP_API_KEY` is set in `.env`
- Verify return address variables are set (RETURN_COMPANY_NAME, RETURN_PHONE, etc.)
- Check `myeshipClient.isConfigured()` output in logs

### "No shipping rates available"
- Verify shipping address in order is complete
- Check if destination country is supported by MyeShip carriers
- Review MyeShip API response logs for details

### Label download fails but tracking works
- This is OK - tracking number is the critical part
- Label can be retrieved later via MyeShip portal
- Check `label_url` in response for manual download

### Rate selection edge cases
- If `MYESHIP_AUTO_SELECT_CHEAPEST=true`, always picks lowest price
- Default: picks "BESTVALUE" tagged rate or first available
- Can implement custom selection logic if needed

## Environment Example (.env)

```env
DATABASE_URL=postgresql://user:pass@host/db
SHOPIFY_API_KEY=your_shopify_key
SHOPIFY_API_SECRET=your_shopify_secret
SHOPIFY_STORE_NAME=your_store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_access_token

# MyeShip Configuration
MYESHIP_API_KEY=sk_live_1234567890abcdefghij
MYESHIP_ENV=production
MYESHIP_AUTO_SELECT_CHEAPEST=false

# Return Address
RETURN_COMPANY_NAME=MON|BLEU
RETURN_CONTACT_NAME=Returns Department
RETURN_PHONE=+34 91 123 4567
RETURN_ADDRESS1=Calle de la Paz 42
RETURN_ADDRESS2=Planta 3
RETURN_CITY=Madrid
RETURN_STATE=Madrid
RETURN_POSTAL_CODE=28001
RETURN_COUNTRY_CODE=ES
RETURN_EMAIL=returns@monbleu.com

ADMIN_USER=admin
ADMIN_PASS=secure_password
```

## Next Steps

1. ✅ Create MyeShip account at https://myeship.co/
2. ✅ Get API Key from https://app.myeship.co/settings/api-keys
3. ✅ Set environment variables
4. ✅ Test with sandbox (`MYESHIP_ENV=sandbox`)
5. ✅ Switch to production once verified
6. ✅ Retire FedEx integration (delete `fedexClient.js` when no longer needed)

## Support

- MyeShip Documentation: https://myeship.co/docs/es/
- MyeShip Support: support@myeship.co
- Dashboard: https://app.myeship.co/

