# Migración a PayPal - Documentación de Cambios

## Resumen

Se ha migrado el sistema de pagos de **MercadoPago** a **PayPal** debido a problemas persistentes con el sandbox de MercadoPago (rechazos de pagos y errores de webhook).

## Cambios Realizados

### 1. Backend (server.js)

#### Instalación de SDK
```bash
npm install @paypal/paypal-server-sdk
```

#### Configuración de PayPal Client (Líneas ~30-60)
- Inicializa el cliente de PayPal con credenciales sandbox/production
- Variables de entorno requeridas:
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_CLIENT_SECRET`
  - `PAYPAL_ENV` (sandbox o production)
  - `PAYPAL_WEBHOOK_ID` (para verificación de firmas)

#### Nuevos Endpoints

**POST /api/create-paypal-order** (Líneas ~1090-1160)
- Crea una orden de PayPal
- Calcula el monto total incluyendo envío
- Guarda la solicitud en la base de datos con `payment_status='pending'` y `payment_provider='paypal'`
- Retorna `approveUrl` para redirigir al usuario a PayPal

**POST /api/capture-paypal-payment** (Líneas ~1160-1230)
- Captura el pago después de la aprobación del usuario
- Actualiza la solicitud con `payment_status='paid'`, `payment_id`, `payment_data`
- Calcula y aplica descuentos si corresponde
- Genera etiqueta de envío con MyeShip

**POST /api/paypal-webhook** (Líneas ~1230-1300)
- Maneja eventos de webhook de PayPal
- Verifica firma de webhook con `PAYPAL_WEBHOOK_ID`
- Procesa evento `PAYMENT.CAPTURE.COMPLETED`
- Actualiza estado de pago en base de datos

### 2. Frontend

#### public/js/index.js (Líneas ~843-884)
Modificado el flujo de checkout:
- Cambiado de `/api/create-mp-preference` a `/api/create-paypal-order`
- Redirige a `checkoutData.approveUrl` (PayPal) en lugar de `preference.init_point` (MercadoPago)

#### public/js/success.js
Agregado soporte para flujo de retorno de PayPal:
- Detecta parámetro `?token=ORDER_ID` en URL (PayPal)
- Llama a `/api/capture-paypal-payment` automáticamente
- Muestra estado de captura y error handling
- Nueva función `renderPayPalSuccess()` para mostrar confirmación

### 3. Base de Datos
No se requieren cambios en el esquema. La tabla `returns_requests` ya soporta:
- `payment_provider` ('paypal' o 'mercadopago')
- `payment_id` (Order ID de PayPal)
- `payment_status` ('pending', 'paid', 'failed')
- `payment_data` (JSON con detalles completos de la transacción)

## Configuración de PayPal

### 1. Crear Cuenta de PayPal Developer
1. Ir a [PayPal Developer](https://developer.paypal.com/)
2. Crear cuenta o iniciar sesión
3. Ir a **Dashboard** > **My Apps & Credentials**

### 2. Crear App de Sandbox
1. En la pestaña **Sandbox**, hacer clic en **Create App**
2. Nombrar la app (ej: "Monbleu Returns")
3. Copiar **Client ID** y **Secret** en `.env`:
   ```env
   PAYPAL_CLIENT_ID=tu_client_id
   PAYPAL_CLIENT_SECRET=tu_secret
   PAYPAL_ENV=sandbox
   ```

### 3. Configurar Webhooks
1. En la app, ir a **SANDBOX WEBHOOKS** > **Add Webhook**
2. Webhook URL: `https://tu-dominio.com/api/paypal-webhook`
3. Seleccionar eventos:
   - ✅ **Payment capture completed**
   - ✅ **Payment capture denied**
   - ✅ **Payment sale completed**
4. Copiar **Webhook ID** en `.env`:
   ```env
   PAYPAL_WEBHOOK_ID=tu_webhook_id
   ```

### 4. Crear Cuentas de Test
PayPal crea automáticamente:
- **Business account** (vendedor) - para recibir pagos
- **Personal account** (comprador) - para hacer pagos de prueba

Ver credenciales en **Dashboard** > **Sandbox** > **Accounts**

### 5. Probar en Sandbox
1. Iniciar checkout en tu aplicación
2. Usar las credenciales de **Personal account** en PayPal
3. Aprobar el pago
4. Verificar captura en logs del servidor
5. Verificar webhook en **Dashboard** > **Webhooks** > **Events**

### 6. Migrar a Producción
1. Repetir pasos 2-3 en la pestaña **Live** (no Sandbox)
2. Cambiar `.env`:
   ```env
   PAYPAL_ENV=production
   ```
3. Configurar webhook con URL de producción
4. Usar credenciales **Live** de Client ID/Secret

## Flujo del Usuario

### Checkout
1. Usuario completa formulario de devolución
2. Click en "Continuar Pago"
3. Frontend llama `/api/create-paypal-order`
4. Usuario es redirigido a PayPal (approveUrl)
5. Usuario inicia sesión y aprueba pago en PayPal
6. PayPal redirige a `/success.html?token=ORDER_ID`

### Captura
1. `success.js` detecta parámetro `?token`
2. Llama automáticamente a `/api/capture-paypal-payment`
3. Backend captura el pago en PayPal
4. Actualiza estado en base de datos
5. Genera etiqueta de envío con MyeShip
6. Muestra confirmación con número de tracking

### Webhook (Respaldo)
1. PayPal envía evento `PAYMENT.CAPTURE.COMPLETED`
2. Servidor verifica firma del webhook
3. Actualiza estado si no fue capturado previamente
4. Registra transacción en logs

## Variables de Entorno Requeridas

```env
# PayPal (REQUERIDO)
PAYPAL_CLIENT_ID=tu_paypal_client_id
PAYPAL_CLIENT_SECRET=tu_paypal_client_secret
PAYPAL_ENV=sandbox  # o 'production'
PAYPAL_WEBHOOK_ID=tu_paypal_webhook_id

# MyeShip (REQUERIDO para generar etiquetas)
MYESHIP_API_KEY=tu_myeship_api_key

# Base de Datos (REQUERIDO)
DATABASE_URL=postgresql://user:pass@host:5432/db
```

## Endpoints Deprecados (Opcional Remover)

Si se desea remover completamente MercadoPago:
- `/api/create-mp-preference` (Línea ~1000)
- `/api/verify-mp-payment/:paymentId` (Buscar en server.js)
- `/api/mp-webhook` (Buscar en server.js)

También remover variables de entorno de MP.

## Testing Checklist

### Sandbox
- [ ] Orden se crea correctamente (`/api/create-paypal-order`)
- [ ] Redirección a PayPal funciona
- [ ] Login con cuenta de test de PayPal
- [ ] Aprobación de pago exitosa
- [ ] Redirección a `/success.html?token=ORDER_ID`
- [ ] Captura automática funciona (`/api/capture-paypal-payment`)
- [ ] Estado en DB actualizado a `paid`
- [ ] Etiqueta generada con MyeShip
- [ ] Webhook recibido y procesado
- [ ] Email de confirmación enviado (si configurado)

### Producción
- [ ] Variables de entorno `PAYPAL_ENV=production`
- [ ] Webhook configurado con URL de producción
- [ ] Probar con cuenta real pequeña cantidad
- [ ] Verificar captura y etiqueta
- [ ] Verificar webhook en dashboard de PayPal

## Troubleshooting

### Error: "Missing required request header"
- Verificar `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET` en `.env`
- Asegurar que el servidor se reinició después de cambiar `.env`

### Error: "Could not capture order"
- Verificar que el `orderId` (token) es válido
- Verificar que la orden no fue capturada previamente
- Verificar logs de PayPal en Dashboard

### Webhook no llega
- Verificar URL pública accesible desde internet
- Verificar que HTTPS está habilitado (PayPal requiere HTTPS)
- Verificar logs en Dashboard de PayPal > Webhooks > Events

### Error de firma de webhook
- Verificar `PAYPAL_WEBHOOK_ID` es correcto
- Asegurar que el webhook está configurado para el evento correcto

## Diferencias con MercadoPago

| Característica | MercadoPago | PayPal |
|---------------|-------------|--------|
| SDK | `mercadopago` | `@paypal/paypal-server-sdk` |
| Flujo | Preference → Checkout | Order → Approve → Capture |
| Redirect | `init_point` | `approveUrl` |
| Retorno | `?payment_id=XXX` | `?token=ORDER_ID` |
| Captura | Automática | Manual (2 pasos) |
| Webhook evento | `payment` | `PAYMENT.CAPTURE.COMPLETED` |
| Test cards | Tarjetas de test | Cuentas sandbox |

## Soporte

- [PayPal Developer Docs](https://developer.paypal.com/docs/)
- [Orders API v2](https://developer.paypal.com/docs/api/orders/v2/)
- [Webhooks Guide](https://developer.paypal.com/docs/api-basics/notifications/webhooks/)
- [SDK Reference](https://github.com/paypal/PayPal-server-SDK-NodeJS)

## Fecha de Migración
**Enero 2025**

## Autor
CydMon Support Team
