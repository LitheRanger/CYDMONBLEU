# 💳 GUÍA: Configurar Stripe para Pagos

## 🎯 Objetivo

Configurar Stripe para procesar pagos reales de $150 USD por solicitud de devolución/cambio.

---

## 🚀 PASO A PASO (10 minutos)

### 1. Crear cuenta en Stripe

1. Ve a: **https://stripe.com**
2. Click en **"Sign up"** o **"Start now"**
3. Completa el registro:
   - Email
   - Contraseña
   - Nombre del negocio: `MON|BLEU`
   - País: `United States` (o tu país)
4. Confirma tu email

### 2. Activar Test Mode

**IMPORTANTE:** Primero testea en modo TEST antes de usar claves reales.

1. En Stripe Dashboard, verás un switch **"Test mode"** (arriba a la derecha)
2. Actívalo (debe estar en color azul/naranja)

### 3. Obtener API Keys (Test)

1. En Dashboard, ve a **"Developers"** → **"API keys"**
2. Verás dos keys:

```
Publishable key:  pk_test_51QiH8xDX...  (empieza con pk_test_)
Secret key:       sk_test_51QiH8xDX...  (empieza con sk_test_)
```

3. Click en **"Reveal test key"** para ver la secret key completa
4. **Copia ambas** (las necesitarás para .env)

### 4. Configurar Webhook

1. En Dashboard, ve a **"Developers"** → **"Webhooks"**
2. Click **"Add endpoint"**
3. Configuración:
   - **Endpoint URL**: `http://localhost:3000/api/stripe-webhook`
     *(o tu URL de producción cuando deploys)*
   - **Description**: `MON|BLEU Returns Portal`
   - **Events to send**:
     - Selecciona: `checkout.session.completed`
     - Selecciona: `payment_intent.succeeded`
     - Selecciona: `payment_intent.payment_failed`
4. Click **"Add endpoint"**
5. **Copia el "Signing secret"** (empieza con `whsec_...`)

### 5. Actualizar .env

Abre tu archivo `.env` y actualiza:

```dotenv
# STRIPE (TEST KEYS - para desarrollo)
STRIPE_PUBLISHABLE_KEY=pk_test_51QiH8xDXkRYqWPxJ...
STRIPE_SECRET_KEY=sk_test_51QiH8xDXkRYqWPxJ...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cuando estés listo para producción, usa Live keys:
# STRIPE_PUBLISHABLE_KEY=pk_live_...
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_live_...
```

### 6. Verificar configuración

```powershell
# Reiniciar servidor
npm start

# Debe mostrar:
# "✅ Stripe configurado correctamente"
```

---

## 🧪 TESTEAR PAGOS (Modo Test)

### Tarjetas de prueba Stripe:

| Tarjeta | Resultado | CVV | Fecha |
|---------|-----------|-----|-------|
| `4242 4242 4242 4242` | ✅ Pago exitoso | 123 | 12/34 |
| `4000 0000 0000 0002` | ❌ Pago rechazado | 123 | 12/34 |
| `4000 0000 0000 9995` | ⏱️ Pago insuficiente | 123 | 12/34 |
| `4000 0025 0000 3155` | ✅ 3D Secure | 123 | 12/34 |

### Flujo de test:

1. Accede a: `http://localhost:3000`
2. Ingresa orden de prueba
3. Completa solicitud
4. En pago, usa: `4242 4242 4242 4242`
5. CVV: `123`, Fecha: `12/34`, ZIP: `12345`
6. Click **"Pay"**
7. Deberías ver: **"Payment successful!"**

### Verificar en Stripe Dashboard:

1. Ve a **"Payments"** en Stripe
2. Deberías ver el pago de $150.00
3. Status: `Succeeded`
4. Click para ver detalles

---

## 🔐 SEGURIDAD

### ⚠️ NUNCA commites en Git:
- ❌ Secret keys (`sk_test_...` o `sk_live_...`)
- ❌ Webhook secrets (`whsec_...`)
- ❌ El archivo `.env`

### ✅ Buenas prácticas:
- ✅ Usa `.gitignore` para excluir `.env`
- ✅ Usa variables de entorno en producción
- ✅ Rota keys si se exponen
- ✅ Usa test mode para desarrollo

---

## 🚀 PASAR A PRODUCCIÓN

### Cuando estés listo para pagos reales:

### 1. Activar cuenta Stripe

1. En Dashboard, ve a **"Settings"** → **"Account"**
2. Completa información del negocio:
   - Legal business name
   - Tax ID / EIN
   - Bank account (para recibir pagos)
   - Business address
3. Submit for review
4. Espera aprobación (1-2 días)

### 2. Obtener Live Keys

1. Desactiva **"Test mode"** (switch en dashboard)
2. Ve a **"Developers"** → **"API keys"**
3. Verás:
```
Publishable key:  pk_live_51QiH8xDX...
Secret key:       sk_live_51QiH8xDX...
```
4. Copia ambas

### 3. Configurar Webhook Live

1. Ve a **"Developers"** → **"Webhooks"**
2. Add endpoint para producción:
   - **URL**: `https://tu-dominio.com/api/stripe-webhook`
   - Mismo eventos que test
3. Copia el nuevo `whsec_live_...`

### 4. Actualizar .env en producción

```dotenv
# PRODUCCIÓN - Live keys
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...
```

### 5. Testear con tarjeta real

- Usa tu propia tarjeta
- Monto pequeño primero ($1.00)
- Verifica que se procesa
- Haz refund si es test

---

## 💰 COSTOS DE STRIPE

### Tarifas:
- **2.9% + $0.30** por transacción exitosa
- Ejemplo: $150.00 → Recibes $145.35

### Para tu negocio:
- Pago: $150.00
- Fee Stripe: $4.65
- Neto: $145.35

### Sin tarifa mensual:
- ✅ $0 mensual
- ✅ Solo pagas por transacción
- ✅ Sin setup fee
- ✅ Sin fee de cancelación

---

## 📊 DASHBOARD STRIPE

En https://dashboard.stripe.com puedes:
- 💳 Ver todos los pagos
- 📈 Analytics y reportes
- 💰 Transferencias a tu banco
- 🔙 Hacer refunds
- 👥 Ver clientes
- 📧 Enviar invoices
- 🔔 Configurar notificaciones

---

## 🧪 WEBHOOK TESTING LOCAL

Para testear webhooks localmente (sin deploy):

### Opción 1: Stripe CLI (Recomendado)

```powershell
# Instalar Stripe CLI
# https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3000/api/stripe-webhook

# Testear evento
stripe trigger payment_intent.succeeded
```

### Opción 2: ngrok (Alternativa)

```powershell
# Instalar ngrok
# https://ngrok.com

# Exponer puerto local
ngrok http 3000

# Usa URL generada en Stripe webhook:
# https://abc123.ngrok.io/api/stripe-webhook
```

---

## 🆘 TROUBLESHOOTING

### Error: "Invalid API Key"
✓ Verifica que la key en `.env` sea correcta
✓ Verifica que no tenga espacios extra
✓ Reinicia servidor después de cambiar `.env`

### Error: "Webhook signature verification failed"
✓ Verifica `STRIPE_WEBHOOK_SECRET` en `.env`
✓ Usa el secret correcto (test o live)
✓ Verifica que el endpoint esté configurado

### Error: "Amount must be at least $0.50"
✓ Stripe no acepta montos menores a $0.50
✓ Verifica `amount` en el código

### Pago no aparece en Dashboard
✓ Verifica que estás en el modo correcto (test/live)
✓ Verifica filtros de fecha
✓ Espera 30 segundos (puede tardar)

---

## 📚 RECURSOS

- **Stripe Docs**: https://stripe.com/docs
- **API Reference**: https://stripe.com/docs/api
- **Testing**: https://stripe.com/docs/testing
- **Webhooks**: https://stripe.com/docs/webhooks
- **Support**: https://support.stripe.com

---

## ✨ PRÓXIMO PASO

Una vez configurado Stripe:
1. ✅ Actualiza `.env` con keys
2. ✅ Reinicia: `npm start`
3. ✅ Testea pago con `4242 4242 4242 4242`
4. ✅ Verifica en Stripe Dashboard
5. ✅ Cuando funcione, activa Live mode

¡Listo para aceptar pagos! 💳
