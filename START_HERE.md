# 🚀 GUÍA DE INICIO RÁPIDO - MON|BLEU Returns Portal

## ⚡ Setup Completo en 15 Minutos

Esta guía te lleva de **cero a funcionando** en el menor tiempo posible.

---

## 📋 PRE-REQUISITOS

✅ Node.js v18+ instalado
✅ npm instalado
✅ Git instalado (opcional)
✅ Editor de texto (VS Code recomendado)

**Verificar:**
```powershell
node --version    # Debe ser v18+
npm --version     # Cualquier versión
```

---

## 🎯 PASOS DE INSTALACIÓN

### **PASO 1: Descargar el proyecto** (1 min)

Si ya lo tienes descargado, sáltate este paso.

```powershell
git clone https://github.com/TU_USUARIO/CYDMONBLEU.git
cd CYDMONBLEU
```

---

### **PASO 2: Instalar dependencias** (2 min)

```powershell
npm install
```

Debe completarse sin errores. Si hay errores, ejecuta:
```powershell
npm install --force
```

---

### **PASO 3: Configurar Base de Datos** (5 min)

**Opción A: Neon (PostgreSQL en la nube - RECOMENDADO)**

1. Ve a: **https://neon.tech**
2. Sign up (gratis, sin tarjeta)
3. Create project: `monbleu-returns`
4. Copia el **Connection string**:
   ```
   postgresql://user:pass@ep-xyz.aws.neon.tech/cydmonbleu?sslmode=require
   ```
5. En Neon SQL Editor, ejecuta:
   ```
   database\migrations\001_create_tables_postgresql.sql
   ```

**Opción B: MySQL local**

1. Instala MySQL 8.0+: https://dev.mysql.com/downloads/mysql/
2. Ejecuta:
   ```powershell
   .\database\setup-db.ps1
   ```
3. Ingresa contraseña cuando te la pida

---

### **PASO 4: Configurar Variables de Entorno** (3 min)

1. Abre `.env` en tu editor
2. Actualiza con tus credenciales:

**Para Neon (PostgreSQL):**
```dotenv
# Servidor
PORT=3000
NODE_ENV=production

# Base de Datos NEON
DATABASE_URL=postgresql://user:pass@ep-xyz.aws.neon.tech/cydmonbleu?sslmode=require
DISABLE_DB=false

# Shopify
SHOPIFY_CLIENT_ID=b4381e2ca835d8205ea3e3f3da25a7b5
SHOPIFY_CLIENT_SECRET=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
SHOP_DOMAIN=monbleu1221.myshopify.com

# Stripe (obtén keys en stripe.com)
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# MyeShip (opcional - para etiquetas)
MYESHIP_API_KEY=
MYESHIP_ENV=production
MYESHIP_AUTO_SELECT_CHEAPEST=false

# Admin
ADMIN_USER=admin
ADMIN_PASS=admin123456
```

**Para MySQL local:**
```dotenv
# Base de Datos MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña_mysql
DB_NAME=cydmonbleu
DB_PORT=3306
DISABLE_DB=false
```

---

### **PASO 5: Configurar Stripe** (5 min)

1. Ve a: **https://stripe.com**
2. Sign up / Login
3. Activa **Test mode**
4. Ve a **Developers** → **API keys**
5. Copia:
   - `Publishable key` (pk_test_...)
   - `Secret key` (sk_test_...)
6. Ve a **Developers** → **Webhooks**
7. Add endpoint: `https://cydmonbleu.onrender.com/api/stripe-webhook`
   - Para desarrollo local: `http://localhost:3000/api/stripe-webhook`
8. Selecciona eventos:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
9. Copia el **Signing secret** (whsec_...)
10. Pega las 3 keys en `.env`

---

### **PASO 6: Iniciar Servidor** (1 min)

```powershell
npm start
```

Deberías ver:
```
✅ Connected to database
🚀 Servidor MON|BLEU listo en http://localhost:3000
```

---

## ✅ VERIFICAR QUE FUNCIONA

### 1. Portal de Cliente

```
http://localhost:3000
```

Deberías ver el formulario de solicitud de devolución.

### 2. Panel Admin

```
http://localhost:3000/admin.html
```

- Usuario: `admin`
- Contraseña: `admin123456`

Deberías ver el dashboard (vacío por ahora).

### 3. Test End-to-End

1. En `http://localhost:3000`:
   - Ingresa orden: `TEST123`
   - Email: `test@example.com`
   - Completa formulario
   - En pago, usa: `4242 4242 4242 4242` (tarjeta test Stripe)
   - CVV: `123`, Fecha: `12/34`
   - Click "Pay"

2. Verifica:
   - ✅ Pago exitoso
   - ✅ Aparece en admin panel
   - ✅ Se guardó en BD
   - ✅ Aparece en Stripe Dashboard

---

## 📊 ESTRUCTURA DEL PROYECTO

```
CYDMONBLEU/
├── server.js                    ← Backend Express
├── package.json                 ← Dependencias
├── .env                         ← Variables (NO COMMITAR)
│
├── public/                      ← Frontend
│   ├── index.html              ← Portal cliente
│   ├── admin.html              ← Panel admin
│   ├── success.html
│   └── cancel.html
│
├── database/
│   ├── migrations/             ← Scripts SQL
│   └── setup-db.ps1           ← Setup MySQL
│
├── uploads/                    ← Fotos clientes
│
├── Shopifyclient.js           ← API Shopify
├── myeshipClient.js           ← API MyeShip
│
└── docs/                       ← Documentación
    ├── NEON_SETUP_GUIDE.md
    ├── STRIPE_COMPLETE_GUIDE.md
    └── ...
```

---

## 🔧 COMANDOS ÚTILES

```powershell
# Iniciar servidor
npm start

# Instalar dependencias
npm install

# Ver logs en tiempo real
npm start (y deja corriendo)

# Detener servidor
Ctrl + C

# Resetear BD (Neon)
# Ejecuta migration nuevamente en SQL Editor

# Resetear BD (MySQL)
mysql -u root -p -e "DROP DATABASE cydmonbleu;"
.\database\setup-db.ps1
```

---

## 🎯 FLUJO COMPLETO DEL SISTEMA

```
1. CLIENTE solicita devolución
   ↓
2. Portal valida orden en Shopify
   ↓
3. Cliente sube fotos de evidencia
   ↓
4. Cliente paga $150 con Stripe
   ↓
5. Webhook confirma pago
   ↓
6. Sistema genera guía MyeShip automáticamente
   ↓
7. Cliente recibe email con guía
   ↓
8. Admin ve todo en panel
```

---

## 🔐 SEGURIDAD

### ⚠️ NO COMMITAR EN GIT:
- ❌ `.env`
- ❌ `node_modules/`
- ❌ `uploads/` (fotos clientes)

### ✅ YA EN .gitignore:
```
.env
node_modules/
uploads/
*.log
.DS_Store
```

---

## 🆘 TROUBLESHOOTING

### ❌ "Cannot find module"
```powershell
npm install
```

### ❌ "ECONNREFUSED database"
- Verifica credenciales en `.env`
- Verifica que BD esté corriendo (Neon siempre está up)
- Verifica `DISABLE_DB=false`

### ❌ "Invalid Stripe key"
- Verifica keys en `.env`
- No deben tener espacios
- Reinicia servidor después de cambiar

### ❌ "Webhook signature failed"
- Verifica `STRIPE_WEBHOOK_SECRET`
- Debe coincidir con Stripe Dashboard

### ❌ Panel admin no carga datos
- Verifica que BD esté conectada
- Crea solicitud de prueba
- Revisa logs del servidor

---

## 📚 DOCUMENTACIÓN ADICIONAL

Para más detalles, consulta:

- **[NEON_SETUP_GUIDE.md](NEON_SETUP_GUIDE.md)** - Setup BD en la nube
- **[STRIPE_COMPLETE_GUIDE.md](STRIPE_COMPLETE_GUIDE.md)** - Configurar pagos
- **[database/README.md](database/README.md)** - Documentación BD
- **[INTEGRATION_GUIDE.md](database/INTEGRATION_GUIDE.md)** - Guía técnica
- **[ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md)** - Diagramas

---

## 🚀 DEPLOY A PRODUCCIÓN

Cuando estés listo para producción:

1. **Render.com** (Recomendado):
   - Ve a: https://render.com
   - Connect GitHub repo
   - Add environment variables
   - Deploy automático

2. **Railway**:
   - Ve a: https://railway.app
   - Deploy desde GitHub
   - Incluye BD PostgreSQL gratis

3. **Heroku**:
   - Ve a: https://heroku.com
   - Similar a Render
   - Incluye add-ons para BD

Ver [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) para más detalles.

---

## ✨ FEATURES DEL SISTEMA

### Portal Cliente:
- ✅ Validación de órdenes Shopify
- ✅ Upload de fotos con preview
- ✅ Selección de productos
- ✅ Razón de devolución
- ✅ Cambio de talla (si aplica)
- ✅ Pago con Stripe ($150)
- ✅ Generación automática guía MyeShip

### Panel Admin:
- ✅ Dashboard con estadísticas
- ✅ Listado de solicitudes
- ✅ Búsqueda por orden/email/tracking
- ✅ Filtros por estado
- ✅ Ver detalles completos
- ✅ Descargar guía PDF
- ✅ Regenerar guía MyeShip
- ✅ Exportar a CSV

### Integraciones:
- ✅ Shopify API - Validar órdenes
- ✅ Stripe API - Procesar pagos
- ✅ MyeShip API - Generar etiquetas
- ✅ PostgreSQL/MySQL - Base de datos

---

## 💡 TIPS

1. **Usa test mode** en Stripe hasta que esté todo probado
2. **Tarjeta test**: `4242 4242 4242 4242`
3. **Verifica logs** del servidor para debugging
4. **Usa Neon** si no quieres instalar MySQL local
5. **Backup BD** antes de cambios importantes
6. **Documenta** tus propias configuraciones

---

## 🎁 BONUS: Quick Commands

```powershell
# Setup completo desde cero
npm install
# (configura .env manualmente)
npm start

# Solo para testear código (sin BD)
# En .env: DISABLE_DB=true
npm start

# Ver versión de Node
node --version

# Limpiar caché npm
npm cache clean --force

# Reinstalar todo
rm -rf node_modules package-lock.json
npm install
```

---

## 📞 SOPORTE

Si tienes problemas:
1. Revisa [TROUBLESHOOTING](ADMIN_PANEL_CHECKLIST.md)
2. Verifica logs del servidor
3. Revisa documentación específica
4. Busca en Stripe/Neon docs

---

## ✅ CHECKLIST FINAL

Antes de considerar completado:

- [ ] npm install exitoso
- [ ] .env configurado
- [ ] BD creada (Neon o MySQL)
- [ ] Stripe keys configuradas
- [ ] Servidor inicia sin errores
- [ ] http://localhost:3000 carga
- [ ] admin.html carga con login
- [ ] Test de pago funciona
- [ ] Solicitud aparece en admin
- [ ] BD guarda datos

---

¡Todo listo! 🎉

**Próximo paso:** Testea el flujo completo y luego deploya a producción.
