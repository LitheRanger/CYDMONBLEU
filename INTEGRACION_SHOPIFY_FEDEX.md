# 🤝 Integración Shopify + FedEx

Este documento explica cómo **Shopify** y **FedEx** trabajan juntos en el sistema MON|BLEU.

## 🎯 Objetivo

Cuando un cliente paga por una guía de devolución, el sistema debe:

1. ✅ **Confirmar el pago** (Stripe)
2. 📦 **Obtener la dirección de envío** de la orden (Shopify)
3. 🚚 **Generar una guía de devolución** automáticamente (FedEx)
4. 💾 **Guardar la guía** en la base de datos para que el cliente la descargue

## 🔧 Cómo Funciona la Integración

### Flujo Completo

```
Usuario completa pago en Stripe
         ↓
Stripe envía webhook a /api/stripe-webhook
         ↓
Servidor verifica: ¿Shopify configurado? ¿FedEx configurado?
         ↓ (SÍ a ambos)
shopifyClient.getOrderById(orderId)  ← Obtiene dirección del cliente
         ↓
fedexClient.createReturnLabel({ order, requestId })  ← Genera guía
         ↓
Guarda tracking + PDF en base de datos
         ↓
Cliente puede descargar guía desde /api/label/:requestId
```

### Código Relevante (server.js)

```javascript
// Líneas 474-497 en server.js
if (dbPool && requestId && fedexClient.isConfigured() && shopifyClient.isConfigured()) {
    try {
        // 1. Shopify obtiene la orden con dirección
        const order = await shopifyClient.getOrderById(orderId);
        
        if (!order || !order.shipping_address) {
            console.warn('⚠️ No se pudo obtener dirección de envío');
        } else {
            // 2. FedEx genera la guía usando la dirección de Shopify
            const label = await fedexClient.createReturnLabel({ order, requestId });
            
            if (label && label.trackingNumber) {
                // 3. Guardar en DB
                await dbPool.execute(
                    `UPDATE returns_requests SET carrier = 'FEDEX', 
                     tracking_number = ?, label_base64 = ?, label_mime = ?
                     WHERE id = ?`,
                    [label.trackingNumber, label.labelBase64, label.labelMime, requestId]
                );
                console.log(`📦 Guía FedEx generada: ${label.trackingNumber}`);
            }
        }
    } catch (err) {
        console.error('❌ Error generando guía FedEx:', err.message);
    }
}
```

## ✅ Configuración Requerida

Para que **ambos servicios trabajen juntos**, necesitas configurar:

### 🛍️ Shopify (obligatorio para validar órdenes)

```bash
SHOPIFY_CLIENT_ID=tu_api_key
SHOPIFY_CLIENT_SECRET=tu_secret_key
SHOPIFY_SHOP=tu-tienda  # Sin .myshopify.com
```

### 📦 FedEx (obligatorio para generar guías)

```bash
# Credenciales de API
FEDEX_ENV=sandbox  # o production
FEDEX_CLIENT_ID=tu_client_id
FEDEX_CLIENT_SECRET=tu_client_secret
FEDEX_ACCOUNT_NUMBER=tu_numero_cuenta

# Dirección de tu almacén (donde llegan las devoluciones)
RETURN_COMPANY_NAME=Monbleu
RETURN_CONTACT_NAME=Logistica
RETURN_PHONE=0000000000
RETURN_ADDRESS1=Tu Calle 123
RETURN_CITY=Ciudad
RETURN_STATE=Estado
RETURN_POSTAL_CODE=00000
RETURN_COUNTRY_CODE=MX
```

## 🧪 Probar la Integración

Ejecuta el script de prueba:

```bash
npm test
```

Esto verificará:
- ✅ Que ambos clientes se cargaron correctamente
- ✅ Que tienen los métodos necesarios (`isConfigured()`, etc.)
- ✅ Que la configuración está completa
- ✅ Que están listos para trabajar juntos

### Salida Esperada (Sin Configurar)

```
⚠️  Uno o ambos servicios NO están configurados

Para configurar Shopify, define en .env:
  - SHOPIFY_CLIENT_ID
  - SHOPIFY_CLIENT_SECRET
  - SHOPIFY_SHOP

Sin la configuración completa, el webhook funcionará
pero NO generará automáticamente guías de FedEx.
```

### Salida Esperada (Configurado)

```
✅ Ambos servicios están configurados
✅ Listos para trabajar juntos en el webhook de Stripe
```

## 🚀 Inicio del Servidor

Al iniciar el servidor, verás el estado de cada servicio:

```bash
npm start
```

```
--------------------------------------------------
🚀 Servidor MON|BLEU listo en http://localhost:3000
--------------------------------------------------
📊 Base de datos: ✅ Configurada
🛍️  Shopify: ✅ Configurado
📦 FedEx: ✅ Configurado
💳 Stripe: ✅ Configurado
--------------------------------------------------
```

## ⚠️ Qué Pasa Si NO Están Configurados

### Sin Shopify

- ❌ No se pueden validar órdenes
- ❌ No se pueden mostrar productos/tallas
- ❌ No se puede obtener dirección para FedEx
- ✅ El servidor sigue funcionando

**Endpoint afectado:** `/api/validate-order` retorna:
```json
{
  "valid": false,
  "message": "Shopify no está configurado. Contacta al administrador."
}
```

### Sin FedEx

- ✅ Se pueden validar órdenes
- ✅ Se pueden procesar pagos
- ❌ **No se generan guías automáticamente**
- ✅ El servidor sigue funcionando

**Webhook log:**
```
ℹ️ No se generó guía: FedEx no configurado
```

### Sin Ambos

- ✅ El servidor inicia
- ❌ Solo funciona para testing manual
- ❌ No hay funcionalidad de devoluciones automáticas

## 🔍 Debugging

### Ver logs del servidor

Los logs mostrarán exactamente qué servicio falta:

```bash
# Si falta Shopify:
⚠️ Shopify no configurado. Define SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET y SHOPIFY_SHOP en .env

# Si falta FedEx al recibir webhook:
ℹ️ No se generó guía: FedEx no configurado

# Si ambos están bien:
✅ DB lista: tabla returns_requests verificada
📦 Guía FedEx generada: 1234567890
```

### Verificar estado programáticamente

Puedes verificar el estado en código:

```javascript
const shopifyClient = require('./Shopifyclient.js');
const fedexClient = require('./fedexClient.js');

if (shopifyClient.isConfigured() && fedexClient.isConfigured()) {
    console.log('✅ Listos para trabajar juntos');
} else {
    console.log('⚠️ Configuración incompleta');
}
```

## 📚 Archivos Clave

| Archivo | Propósito |
|---------|-----------|
| `Shopifyclient.js` | Cliente de Shopify con autenticación OAuth y método `isConfigured()` |
| `fedexClient.js` | Cliente de FedEx con autenticación y método `isConfigured()` |
| `server.js` | Integra ambos clientes en el webhook de Stripe (líneas 474-497) |
| `test-integration.js` | Script de prueba para verificar que ambos trabajan juntos |

## 🎉 Checklist de Integración Exitosa

- [ ] Variables de entorno de Shopify configuradas
- [ ] Variables de entorno de FedEx configuradas
- [ ] `npm test` pasa sin errores
- [ ] Servidor muestra "✅ Configurado" para ambos servicios
- [ ] Webhook de Stripe recibe evento `checkout.session.completed`
- [ ] Logs muestran `📦 Guía FedEx generada: XXXX`
- [ ] Guía aparece en `/api/label/:requestId`

## 💡 Mejoras Futuras

1. **Reintentos automáticos** si FedEx falla temporalmente
2. **Notificación por email** cuando la guía esté lista
3. **Soporte para múltiples carriers** (DHL, UPS, etc.)
4. **Webhook de FedEx** para tracking en tiempo real

---

**Última actualización:** 1 de febrero de 2026
