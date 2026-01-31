# 🚀 Guía de Deployment - MON|BLEU Returns Portal

## 🏆 Opción Recomendada: Render

### ✅ Por qué Render es ideal para tu proyecto:
- ✅ **Gratis para empezar** (sin tarjeta de crédito)
- ✅ **Node.js nativo** con detección automática
- ✅ **Base de datos MySQL** incluida ($7/mes) o PostgreSQL gratis
- ✅ **SSL automático** (necesario para Stripe)
- ✅ **Variables de entorno** fáciles de configurar
- ✅ **Deploy desde GitHub** con auto-deploy
- ✅ **Logs en tiempo real**
- ✅ **Fácil de escalar**

---

## 📋 Plan de Deployment Render (Paso a Paso)

### **Paso 1: Preparar el proyecto**

#### 1.1 Crear archivo `.gitignore`
```
node_modules/
.env
uploads/*
!uploads/.gitkeep
*.log
.DS_Store
```

#### 1.2 Modificar `package.json` (asegurar start script)
```json
{
  "name": "monbleu-returns",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

#### 1.3 Crear `render.yaml` (deployment automático)
```yaml
services:
  - type: web
    name: monbleu-returns
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
```

---

### **Paso 2: Subir a GitHub**

```bash
cd "C:\Users\cabes\OneDrive\Documentos\CYDMONBLEU"
git init
git add .
git commit -m "Initial commit - MON|BLEU Returns Portal"

# Crear repositorio en GitHub y después:
git remote add origin https://github.com/TU_USUARIO/monbleu-returns.git
git branch -M main
git push -u origin main
```

---

### **Paso 3: Crear cuenta en Render**

1. Ve a https://render.com
2. Haz clic en **"Get Started"**
3. Conecta tu cuenta de GitHub
4. Autoriza a Render para acceder a tus repositorios

---

### **Paso 4: Deploy del Web Service**

1. En Render Dashboard, clic en **"New +"** → **"Web Service"**
2. Selecciona tu repositorio `monbleu-returns`
3. Configuración:
   - **Name:** `monbleu-returns`
   - **Region:** Oregon (US West) o el más cercano
   - **Branch:** `main`
   - **Root Directory:** (dejar vacío)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free (para empezar)

4. Clic en **"Create Web Service"**

---

### **Paso 5: Configurar Base de Datos MySQL**

#### Opción A: MySQL en Render ($7/mes)
1. En Dashboard → **"New +"** → **"MySQL"**
2. Configuración:
   - **Name:** `monbleu-db`
   - **Database:** `monbleu_returns`
   - **User:** `monbleu_user`
   - **Region:** Mismo que el web service
   - **Plan:** Starter ($7/mes)

3. Después de crear, copia las credenciales:
   - **Internal Database URL:** `mysql://user:pass@host:port/dbname`

#### Opción B: MySQL externo (más barato)
- **PlanetScale** (gratis): https://planetscale.com
- **Railway** (gratis $5 crédito): https://railway.app
- **Aiven** ($8/mes): https://aiven.io

---

### **Paso 6: Configurar Variables de Entorno**

En tu Web Service → **"Environment"** → **"Add Environment Variable"**

```
DB_HOST=mysql-host.render.com
DB_USER=monbleu_user
DB_PASSWORD=tu_password_generado
DB_NAME=monbleu_returns
DB_PORT=3306

STRIPE_SECRET_KEY=sk_live_tu_clave_de_produccion
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret

NODE_ENV=production
PORT=3000
```

⚠️ **IMPORTANTE:** Usa las credenciales **LIVE** de Stripe para producción

---

### **Paso 7: Configurar Webhook de Stripe**

1. Ve a Stripe Dashboard → **"Developers"** → **"Webhooks"**
2. Clic en **"Add endpoint"**
3. URL del endpoint: `https://tu-app.onrender.com/api/stripe-webhook`
4. Eventos a escuchar:
   - `checkout.session.completed`
   - `checkout.session.expired`
5. Copia el **Signing secret** y agrégalo como `STRIPE_WEBHOOK_SECRET`

---

### **Paso 8: Storage para archivos subidos**

Render **NO persiste archivos** en el plan gratuito. Opciones:

#### Opción A: Cloudinary (Recomendado - Gratis)
```bash
npm install cloudinary multer-storage-cloudinary
```

```javascript
// Modificar server.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'monbleu-returns',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif']
    }
});
```

**Variables de entorno adicionales:**
```
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

#### Opción B: AWS S3 (Más control)
```bash
npm install aws-sdk multer-s3
```

#### Opción C: Supabase Storage (Gratis 1GB)
```bash
npm install @supabase/supabase-js
```

---

### **Paso 9: Verificar deployment**

1. Espera a que el build termine (3-5 minutos)
2. Render te dará una URL: `https://monbleu-returns.onrender.com`
3. Abre la URL y verifica:
   - ✅ La página carga correctamente
   - ✅ Puedes validar una orden
   - ✅ El proceso de pago funciona
   - ✅ Los webhooks se reciben

4. Revisa los logs en Render Dashboard → **"Logs"**

---

### **Paso 10: Configurar dominio personalizado (Opcional)**

1. En Render Dashboard → Tu servicio → **"Settings"** → **"Custom Domain"**
2. Agrega tu dominio: `returns.monbleu.com`
3. Configura DNS en tu proveedor:
   ```
   CNAME returns.monbleu.com → monbleu-returns.onrender.com
   ```
4. Render configurará SSL automáticamente (Let's Encrypt)

---

## 🔄 Actualizar la aplicación

Cada vez que hagas `git push` a `main`, Render automáticamente:
1. Descarga el código nuevo
2. Ejecuta `npm install`
3. Reinicia el servidor
4. Mantiene las variables de entorno

```bash
# Hacer cambios
git add .
git commit -m "Descripción de cambios"
git push origin main

# Render detecta el push y hace deploy automático
```

---

## 💰 Costos de Render

| Servicio | Plan | Costo |
|----------|------|-------|
| Web Service | Free | $0/mes (512MB RAM, duerme después de 15 min sin uso) |
| Web Service | Starter | $7/mes (512MB RAM, siempre activo) |
| MySQL Database | Starter | $7/mes (1GB storage, 1 vCPU) |
| MySQL Database | Standard | $15/mes (10GB storage, 2 vCPU) |

**Total recomendado para empezar:** $14/mes (Web Service + MySQL)

---

## 🎯 Alternativas a Render

### 1. **Railway** (Recomendado también)
- **Pros:** $5 gratis al mes, PostgreSQL incluido, muy fácil
- **Cons:** Después de crédito gratis cuesta más que Render
- **Precio:** ~$10-15/mes después de crédito
- **URL:** https://railway.app

### 2. **Fly.io**
- **Pros:** Gratis hasta 3 apps, rápido, global
- **Cons:** DB no incluida, curva de aprendizaje
- **Precio:** Gratis (con límites), después $1.94/mes por GB RAM
- **URL:** https://fly.io

### 3. **DigitalOcean App Platform**
- **Pros:** DigitalOcean confiable, escalable
- **Cons:** No tiene plan gratuito
- **Precio:** $5/mes + $15/mes DB = $20/mes
- **URL:** https://www.digitalocean.com/products/app-platform

### 4. **Heroku**
- **Pros:** Muy estable, maduro
- **Cons:** Caro, ya no tiene plan gratuito
- **Precio:** $7/mes + $9/mes DB = $16/mes
- **URL:** https://www.heroku.com

### 5. **Vercel + PlanetScale** (Si separas frontend/backend)
- **Pros:** Frontend ultrarrápido en Vercel, DB gratis en PlanetScale
- **Cons:** Necesitas dividir el proyecto
- **Precio:** Gratis para empezar
- **URL:** https://vercel.com + https://planetscale.com

---

## 📊 Comparación Rápida

| Servicio | Facilidad | Precio | DB Incluida | SSL | Recomendado |
|----------|-----------|--------|-------------|-----|-------------|
| **Render** | ⭐⭐⭐⭐⭐ | $14/mes | ✅ MySQL | ✅ | ✅ SÍ |
| **Railway** | ⭐⭐⭐⭐⭐ | $10-15/mes | ✅ PostgreSQL | ✅ | ✅ SÍ |
| Fly.io | ⭐⭐⭐ | Variable | ❌ | ✅ | 🤔 |
| DigitalOcean | ⭐⭐⭐⭐ | $20/mes | ✅ MySQL | ✅ | 👍 |
| Heroku | ⭐⭐⭐⭐ | $16/mes | ✅ PostgreSQL | ✅ | 👍 |

---

## 🔥 Mi Recomendación Final

Para MON|BLEU, te recomiendo **Render** porque:

1. ✅ **Fácil para empezar** - Deploy en 10 minutos
2. ✅ **Todo incluido** - Web + DB + SSL
3. ✅ **Precio justo** - $14/mes para producción real
4. ✅ **Stripe ready** - SSL automático
5. ✅ **Auto-deploy** - Push y olvídate
6. ✅ **Soporte MySQL** - Tu código ya está listo
7. ✅ **Escalable** - Cuando crezcas, sube el plan

**Plan sugerido:**
- **Fase 1 (Testing):** Free Web Service + PlanetScale DB gratis = $0/mes
- **Fase 2 (Producción):** Starter Web Service + Starter MySQL = $14/mes
- **Fase 3 (Crecimiento):** Standard plan cuando tengas 100+ órdenes/día

---

## 🚨 Checklist Pre-Deploy

Antes de hacer deploy, verifica:

- [ ] `.gitignore` creado (no subir `.env` ni `node_modules`)
- [ ] `package.json` tiene script `"start": "node server.js"`
- [ ] Variables de entorno documentadas en `.env.example`
- [ ] Stripe keys de **PRODUCCIÓN** (sk_live_...)
- [ ] Cloudinary o S3 configurado para archivos
- [ ] Webhook URL apunta a dominio de producción
- [ ] Base de datos creada y accesible
- [ ] Puerto configurado con `process.env.PORT || 3000`
- [ ] CORS configurado para dominio de producción
- [ ] Logs de error configurados (console.error mínimo)

---

## 📞 Próximos Pasos

1. **Elige tu opción:** Render (recomendado) o Railway
2. **Sube a GitHub:** Inicializa git y push
3. **Configura storage:** Cloudinary es lo más fácil
4. **Deploy:** Sigue los pasos de arriba
5. **Prueba:** Valida que todo funcione
6. **Monitorea:** Revisa logs los primeros días

¿Necesitas ayuda con algún paso específico? Puedo crear los archivos de configuración necesarios.
