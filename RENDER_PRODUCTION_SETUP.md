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

# MercadoPago (PRODUCCIÓN)
MP_ACCESS_TOKEN=APP_USR_...
MP_ENV=production
PUBLIC_BASE_URL=https://cydmonbleu.onrender.com

# MyeShip (PRODUCCIÓN)
MYESHIP_API_KEY=tu_api_key_real
MYESHIP_ENV=production
MYESHIP_AUTO_SELECT_CHEAPEST=false

# Admin Panel
ADMIN_USER=admin
ADMIN_PASS=TU_CONTRASEÑA_SEGURA
```

⚠️ **IMPORTANTE:** Cambia `ADMIN_PASS` a algo seguro, no uses `admin123456` en producción.

---

### 2. Configurar Webhook de MercadoPago (PRODUCCIÓN)

1. Ve a MercadoPago Developers → **Webhooks**
2. Crea un webhook con:
   - **URL**: `https://cydmonbleu.onrender.com/api/mp-webhook`
3. Verifica que `PUBLIC_BASE_URL` esté en Render

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

⚠️ **USA SANDBOX PRIMERO:**

1. Accede al portal
2. Completa una solicitud
3. Usa un usuario y método de prueba de MercadoPago (sandbox)
4. Verifica que:
   - ✅ Pago procesado
   - ✅ Aparece en admin panel
   - ✅ Se guarda en base de datos
   - ✅ Webhook recibido (revisa MercadoPago → Webhooks)

---

## 📊 MONITOREO

### Logs en Render
```
Render Dashboard → Tu servicio → Logs
```
Aquí verás todos los logs del servidor en tiempo real.

### Logs en MercadoPago
```
MercadoPago → Developers → Webhooks → [Tu endpoint]
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
- [ ] Credenciales de MercadoPago en producción
- [ ] Webhook configurado en producción
- [ ] `NODE_ENV=production`
- [ ] `.env` NO está en GitHub (verificado en `.gitignore`)
- [ ] MyeShip API key es de producción (no sandbox)
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
# Verifica la URL: https://cydmonbleu.onrender.com/api/mp-webhook
# Verifica PUBLIC_BASE_URL en Render
# Revisa logs de MercadoPago
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

1. **Activa credenciales de producción en MercadoPago**
   - Completa información del negocio
   - Verifica identidad
   - Obtén Access Token de producción

2. **Actualiza Variables en Render**
   - Cambia a credenciales de producción
   - Actualiza `PUBLIC_BASE_URL`

3. **Test con pago real**
   - Verifica que se cobre $150 USD
   - Verifica que aparezca en MercadoPago

4. **Monitor Performance**
   - Revisa logs diariamente
   - Configura alertas en Render
   - Monitorea transacciones en MercadoPago

---

## 💡 TIPS

- **Backups**: Neon hace backups automáticos (verifica en dashboard)
- **Uptime**: Render free tier puede dormirse (tarda 30s en despertar)
- **Upgrade**: Considera plan pago si necesitas 99.9% uptime
- **Domain**: Puedes conectar tu dominio custom en Render settings

---

## 📞 SOPORTE

- **Render Docs**: https://render.com/docs
- **MercadoPago Docs**: https://www.mercadopago.com.mx/developers/es/docs
- **Neon Docs**: https://neon.tech/docs

---

✅ **Todo listo para producción!**

Ahora puedes recibir solicitudes de devolución reales con pagos procesados por MercadoPago.
