# 🚀 CONFIGURACIÓN PRODUCCIÓN - Render.com

## App en producción
**URL:** https://cydmonbleu.onrender.com

---

## ✅ CHECKLIST DE CONFIGURACIÓN

### 1. Variables de Entorno en Render

Ve a tu dashboard de Render → Tu servicio → **Environment**

Agrega estas variables:

```bash
# Base de Datos (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/cydmonbleu?sslmode=require
DISABLE_DB=false

# Servidor
NODE_ENV=production
PORT=3000

# Shopify
SHOPIFY_CLIENT_ID=b4381e2ca835d8205ea3e3f3da25a7b5
SHOPIFY_CLIENT_SECRET=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
SHOP_DOMAIN=monbleu1221.myshopify.com

# Stripe (PRODUCCIÓN - usa Live keys)
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# FedEx (PRODUCCIÓN)
FEDEX_ENV=production
FEDEX_CLIENT_ID=tu_client_id_real
FEDEX_CLIENT_SECRET=tu_secret_real
FEDEX_ACCOUNT_NUMBER=tu_numero_cuenta

# Admin Panel
ADMIN_USER=admin
ADMIN_PASS=TU_CONTRASEÑA_SEGURA
```

⚠️ **IMPORTANTE:** Cambia `ADMIN_PASS` a algo seguro, no uses `admin123456` en producción.

---

### 2. Configurar Webhook de Stripe (PRODUCCIÓN)

1. Ve a Stripe Dashboard → **Developers** → **Webhooks**
2. Desactiva **Test mode** (cambia a Live mode)
3. Click **"Add endpoint"**
4. Configuración:
   - **URL**: `https://cydmonbleu.onrender.com/api/stripe-webhook`
   - **Eventos**:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
5. Guarda y copia el **Signing secret** (`whsec_...`)
6. Agrégalo a Render en `STRIPE_WEBHOOK_SECRET`

---

### 3. Base de Datos Neon (Producción)

1. Ve a Neon Dashboard → Tu proyecto
2. Copia el **Connection String**
3. Agrégalo a Render en `DATABASE_URL`
4. Asegúrate de que la migración esté ejecutada:
   ```sql
   -- En Neon SQL Editor, ejecuta:
   -- database/migrations/001_create_tables_postgresql.sql
   ```

---

### 4. Deploy Automático desde GitHub

✅ **Ya configurado** - Cada push a `main` despliega automáticamente

Para verificar:
1. Ve a Render Dashboard → Tu servicio
2. Revisa la pestaña **"Events"** para ver deploys
3. Revisa **"Logs"** si hay errores

---

## 🧪 VERIFICAR QUE FUNCIONA

### 1. Portal Cliente
```
https://cydmonbleu.onrender.com
```
Debe cargar el formulario de solicitud de devolución.

### 2. Panel Admin
```
https://cydmonbleu.onrender.com/admin.html
```
- Usuario: `admin`
- Contraseña: La que configuraste en `ADMIN_PASS`

### 3. Test de Pago Real

⚠️ **USA TARJETA DE PRUEBA PRIMERO:**

1. Accede al portal
2. Completa una solicitud
3. Usa tarjeta test: `4242 4242 4242 4242`
4. Verifica que:
   - ✅ Pago procesado
   - ✅ Aparece en admin panel
   - ✅ Se guarda en base de datos
   - ✅ Webhook recibido (revisa Stripe Dashboard → Webhooks → Logs)

---

## 📊 MONITOREO

### Logs en Render
```
Render Dashboard → Tu servicio → Logs
```
Aquí verás todos los logs del servidor en tiempo real.

### Logs en Stripe
```
Stripe Dashboard → Developers → Webhooks → [Tu endpoint]
```
Aquí verás si los webhooks están llegando correctamente.

### Logs en Neon
```
Neon Dashboard → Tu proyecto → Monitoring
```
Verás queries y performance de la BD.

---

## 🔒 SEGURIDAD EN PRODUCCIÓN

### ✅ Checklist de Seguridad:

- [ ] `ADMIN_PASS` es una contraseña segura (no `admin123456`)
- [ ] Stripe keys son **Live keys** (pk_live_, sk_live_)
- [ ] Webhook secret es el de producción
- [ ] `NODE_ENV=production`
- [ ] `.env` NO está en GitHub (verificado en `.gitignore`)
- [ ] FedEx keys son de producción (no sandbox)
- [ ] Database connection usa SSL (`?sslmode=require`)

---

## 🚨 TROUBLESHOOTING

### ❌ App no carga / Error 500
```bash
# Revisa logs en Render
# Verifica variables de entorno
# Asegúrate que DATABASE_URL esté correcta
```

### ❌ Webhook no funciona
```bash
# Verifica la URL: https://cydmonbleu.onrender.com/api/stripe-webhook
# Verifica STRIPE_WEBHOOK_SECRET en Render
# Revisa logs de Stripe Dashboard
```

### ❌ Database connection error
```bash
# Verifica DATABASE_URL en Render
# Verifica que Neon esté up
# Verifica DISABLE_DB=false
```

### ❌ Panel admin no autentica
```bash
# Verifica ADMIN_USER y ADMIN_PASS en Render
# Intenta limpiar caché del navegador
```

---

## 🔄 ACTUALIZAR CÓDIGO EN PRODUCCIÓN

### Método Automático (Recomendado):
```powershell
git add .
git commit -m "Descripción de cambios"
git push origin main
```
Render detectará el push y desplegará automáticamente.

### Verificar Deploy:
1. Ve a Render Dashboard → Events
2. Espera que el deploy termine (2-5 min)
3. Verifica que la app funcione

---

## 📈 PRÓXIMOS PASOS

### Cuando estés listo para cobrar real:

1. **Activa Live Mode en Stripe**
   - Completa información del negocio
   - Verifica identidad
   - Obtén Live keys (pk_live_, sk_live_)

2. **Actualiza Variables en Render**
   - Cambia a Live keys
   - Actualiza webhook secret

3. **Test con Tarjeta Real**
   - Usa tu tarjeta personal
   - Verifica que se cobre $150 USD
   - Verifica que aparezca en Stripe Dashboard

4. **Monitor Performance**
   - Revisa logs diariamente
   - Configura alertas en Render
   - Monitorea transacciones en Stripe

---

## 💡 TIPS

- **Backups**: Neon hace backups automáticos (verifica en dashboard)
- **Uptime**: Render free tier puede dormirse (tarda 30s en despertar)
- **Upgrade**: Considera plan pago si necesitas 99.9% uptime
- **Domain**: Puedes conectar tu dominio custom en Render settings

---

## 📞 SOPORTE

- **Render Docs**: https://render.com/docs
- **Stripe Docs**: https://stripe.com/docs
- **Neon Docs**: https://neon.tech/docs

---

✅ **Todo listo para producción!**

Ahora puedes recibir solicitudes de devolución reales con pagos procesados por Stripe.
