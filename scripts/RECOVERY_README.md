# Legacy Orders Recovery Script

## Overview
This script fixes return requests with invalid Shopify IDs stored in the database. These are likely requests created before the recent fix that now safely stores numeric Shopify IDs.

## What It Does

1. **Scans all requests** in the `returns_requests` table
2. **Validates each order_id** by checking if it exists in Shopify
3. **For invalid IDs:**
   - Attempts to find the correct order using customer name and email
   - Updates the database with the correct numeric Shopify ID
4. **Reports results** with summary statistics

## Usage

```bash
node scripts/recovery_legacy_orders.js
```

## Requirements

- `.env` file must be configured with:
  - Database credentials: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_TYPE`
  - Shopify API: `SHOPIFY_SHOP`, `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`

## Output

The script generates a detailed report showing:
- ✅ **Valid orders** (no changes needed)
- 🔧 **Fixed orders** (corrected with the right Shopify ID)
- ⚠️ **Unfixable orders** (couldn't find the correct order - requires manual review)
- ❌ **Errors** (database or API issues)

## Example Output

```
======================================================================
🚀 INICIANDO RECUPERACIÓN DE PEDIDOS LEGACY
======================================================================

📊 Total de pedidos a revisar: 15

📋 Procesando solicitud: ID=7422602936607, order_id="160670", cliente="John Doe"
  ✔️ Validando order_id actual...
  ❌ El order_id 160670 NO ES VÁLIDO
  🔍 Buscando orden por cliente: "John Doe" / john@example.com
  ❌ No se encontró orden por nombre
  ❌ No se pudo encontrar la orden correcta para "John Doe"

...

======================================================================
📈 RESUMEN DE RECUPERACIÓN
======================================================================
✅ Válidos (sin cambios):   12
🔧 Corregidos:             2
⚠️  No recuperables:        1
❌ Errores:                0
======================================================================
```

## Notes

- The script automatically pauses 300ms between Shopify API calls to avoid rate limiting
- All changes are logged to the console for audit purposes
- For unfixable requests, manual review is recommended
