# 🚀 Integración de Stripe - MON|BLEU Returns Portal

## 📋 Requisitos Previos

- Node.js instalado
- Cuenta de Stripe (https://stripe.com)
- MySQL configurado

## 🔧 Configuración de Stripe

### 1. Obtener Claves de API

1. Inicia sesión en tu Dashboard de Stripe: https://dashboard.stripe.com
2. Ve a **Developers → API keys**
3. Copia tu `Secret key` (comienza con `sk_test_` para modo prueba)
4. Pégala en tu archivo `.env` como `STRIPE_SECRET_KEY`

### 2. Configurar Webhook (Para confirmación de pagos)

1. En el Dashboard de Stripe, ve a **Developers → Webhooks**
2. Haz clic en **Add endpoint**
3. URL del endpoint: `https://tu-dominio.com/api/stripe-webhook` (o `http://localhost:3000/api/stripe-webhook` para pruebas locales)
4. Selecciona el evento: `checkout.session.completed`
5. Copia el **Signing secret** (comienza con `whsec_`)
6. Pégalo en tu archivo `.env` como `STRIPE_WEBHOOK_SECRET`

### 3. Probar con Stripe CLI (Opcional, para desarrollo local)

Si quieres probar webhooks localmente:

```bash
# Instalar Stripe CLI
# Mac: brew install stripe/stripe-cli/stripe
# Windows: scoop install stripe
# Linux: https://stripe.com/docs/stripe-cli

# Login
stripe login

# Reenviar webhooks a tu servidor local
stripe listen --forward-to localhost:3000/api/stripe-webhook

# Copiar el webhook signing secret que aparece y agregarlo a .env
```

## 📦 Instalación de Dependencias

```bash
npm install stripe
```

O si usas el package.json incluido:

```bash
npm install
```

## ⚙️ Archivo .env

Copia `.env.example` a `.env` y configura tus credenciales:

```bash
cp .env.example .env
```

Edita `.env`:

```env
# Base de datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=monbleu_returns
DB_PORT=3306

# Stripe
STRIPE_SECRET_KEY=sk_test_51AbC...tu_secret_key
STRIPE_WEBHOOK_SECRET=whsec_abc123...tu_webhook_secret

# Servidor
PORT=3000
```

## 🧪 Tarjetas de Prueba de Stripe

Para probar pagos en modo test, usa estas tarjetas:

| Número de Tarjeta | Resultado |
|-------------------|-----------|
| 4242 4242 4242 4242 | Pago exitoso |
| 4000 0000 0000 9995 | Pago rechazado |
| 4000 0025 0000 3155 | Requiere autenticación 3D Secure |

- **Fecha de expiración**: Cualquier fecha futura (ej: 12/25)
- **CVC**: Cualquier 3 dígitos (ej: 123)
- **ZIP**: Cualquier 5 dígitos (ej: 12345)

## 🚀 Iniciar el Servidor

```bash
node server.js
```

O con nodemon para desarrollo:

```bash
npm run dev
```

## 🔍 Verificar la Integración

1. Navega a http://localhost:3000
2. Completa el flujo de devolución
3. En el paso de pago, serás redirigido a Stripe Checkout
4. Usa una tarjeta de prueba
5. Serás redirigido a `/success` al completar el pago

## 📊 Verificar Pagos en Stripe

1. Ve a tu Dashboard de Stripe
2. Navega a **Payments**
3. Verás los pagos de prueba listados
4. Los metadatos incluirán: `requestId`, `orderId`, `contactEmail`

## 🔐 Producción

Para poner en producción:

1. Cambia a claves de producción (comienzan con `sk_live_`)
2. Configura el webhook con tu dominio real
3. Actualiza `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`
4. Desactiva las tarjetas de prueba

## 📝 Estructura de la Base de Datos

La tabla `returns_requests` incluye:

```sql
- payment_status: 'pending' | 'paid' | 'failed'
- stripe_session_id: ID de la sesión de Stripe
```

## 🛠️ Troubleshooting

### Error: "Stripe no configurado"
- Verifica que `STRIPE_SECRET_KEY` esté en tu `.env`
- Asegúrate de que la clave comience con `sk_test_` o `sk_live_`

### Webhook no funciona
- Verifica que `STRIPE_WEBHOOK_SECRET` esté configurado
- Usa Stripe CLI para probar localmente
- Revisa los logs en Dashboard → Webhooks → [tu endpoint] → Attempts

### Redirección falla después del pago
- Verifica que `success.html` y `cancel.html` existan en `/public`
- Revisa los logs del navegador (Console)

## 📚 Recursos

- Documentación de Stripe: https://stripe.com/docs
- Stripe Checkout: https://stripe.com/docs/payments/checkout
- Webhooks: https://stripe.com/docs/webhooks
- Stripe CLI: https://stripe.com/docs/stripe-cli

## ✅ Checklist de Configuración

- [ ] Cuenta de Stripe creada
- [ ] `STRIPE_SECRET_KEY` agregado a `.env`
- [ ] Webhook configurado en Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` agregado a `.env`
- [ ] `npm install stripe` ejecutado
- [ ] Servidor iniciado sin errores
- [ ] Pago de prueba completado exitosamente
- [ ] Webhook recibido y procesado (check en Dashboard)
- [ ] DB actualizada con `payment_status = 'paid'`

---

**¿Necesitas ayuda?** Consulta la documentación oficial de Stripe o contacta al equipo de desarrollo.
