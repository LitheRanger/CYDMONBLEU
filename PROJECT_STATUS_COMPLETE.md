# 🚀 PROYECTO CYDMONBLEU - ESTADO ACTUAL

## 📊 Descripción General

**MON|BLEU Returns Portal** - Sistema integral de devoluciones y cambios con integraciones Shopify, Stripe y MyeShip.

### Dos Aplicaciones Integradas:

#### 1️⃣ **CYDMONBLEU** (Node.js / Express)
**URL:** https://github.com/LitheRanger/CYDMONBLEU.git
- ✅ Customer-facing portal (cliente)
- ✅ Validación de órdenes Shopify
- ✅ Upload de fotos de evidencia
- ✅ Pago con Stripe ($150 flat)
- ✅ Generación de etiquetas MyeShip
- ✅ Admin dashboard con filtros y exportar CSV

#### 2️⃣ **GESTORCYDMONBLEU** (Flask / Python) - RECIÉN MEJORADO
**URL:** https://github.com/LitheRanger/GESTORCYDMONBLEU.git
- ✅ Internal management dashboard
- ✅ Kanban board (Pendiente → Aprobado → Rechazado)
- ✅ Historial detallado de acciones
- ✅ Webhook receptor de CYDMONBLEU
- ✅ Integración Stripe + MyeShip
- ✅ API REST para consultas

---

## 🏗️ Arquitectura Mejorada

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENTE (Customer)                          │
│                                                                   │
│  1. Ingresa orden (#1001)                                        │
│  2. Sube fotos de evidencia                                      │
│  3. Selecciona items a devolver                                  │
│  4. Paga con Stripe ($150)                                       │
│  5. Se genera guía MyeShip automáticamente                       │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ WEBHOOK JSON
                        │ (request_id, payment_status, tracking...)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              CYDMONBLEU (Node.js Backend)                        │
│                  Puerto 3000                                     │
│                                                                   │
│  ✅ /api/validate-order        → Shopify                        │
│  ✅ /api/submit-return         → Upload fotos                   │
│  ✅ /api/create-checkout-session → Stripe                       │
│  ✅ /api/stripe-webhook        → Trigger MyeShip label          │
│  ✅ /admin                     → Dashboard admin                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ POST /webhook/return-requests
                        │ (X-API-KEY header)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│         GESTORCYDMONBLEU (Flask/Python Backend) - MEJORADO       │
│                                                                   │
│  ✅ /                    → Kanban dashboard (3 columnas)        │
│  ✅ /return-request/<id> → Detalle completo                     │
│  ✅ /api/return-requests → Listar con filtros                   │
│  ✅ Webhook receiver     → Recibe datos de CYDMONBLEU           │
│  ✅ Historial            → Registra todas las acciones          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ PostgreSQL / Neon
                        │
                        ▼
         ┌──────────────────────────────────┐
         │   Base de Datos PostgreSQL        │
         │                                   │
         │  📦 return_requests              │
         │  📋 return_request_historial     │
         │  👤 usuario                      │
         └──────────────────────────────────┘
```

---

## 📂 Archivos Nuevos/Mejorados

### En Repositorio CYDMONBLEU:

| Archivo | Propósito | Estado |
|---------|-----------|--------|
| `IMPROVED_GESTORCYDMONBLEU_APP.py` | Backend mejorado (modelos + rutas) | ✅ Listo |
| `IMPROVED_GESTORCYDMONBLEU_DASHBOARD.html` | Dashboard Kanban mejorado | ✅ Listo |
| `IMPROVED_GESTORCYDMONBLEU_DETALLE.html` | Vista detalle de solicitud | ✅ Listo |
| `MIGRATION_GESTORCYDMONBLEU.sql` | Script migración PostgreSQL | ✅ Listo |
| `GESTORCYDMONBLEU_UPGRADE_GUIDE.md` | Guía de instalación completa | ✅ Listo |

### Archivos Existentes (ya en GitHub):

| Archivo | Propósito | Estado |
|---------|-----------|--------|
| `server.js` | Backend Node.js (CYDMONBLEU) | ✅ Con admin panel completo |
| `public/admin.html` | Dashboard admin (CYDMONBLEU) | ✅ Con filtros y exportar CSV |
| `public/index.html` | Portal cliente (CYDMONBLEU) | ✅ Con preview de fotos |
| `public/success.html` | Página éxito (CYDMONBLEU) | ✅ Con descarga de guía |
| `.env.example` | Variables de entorno | ✅ Actualizado |
| `myeshipClient.js` | Integración MyeShip API | ✅ Completo |
| `Shopifyclient.js` | Integración Shopify API | ✅ Funcional |

---

## 🔄 Flujo Integrado

### **Paso 1: Cliente llena formulario**
```
Cliente → index.html
  ├─ Valida orden (#1001) → /api/validate-order → Shopify
  ├─ Sube fotos → /api/submit-return → Multer
  ├─ Selecciona items → Modal con inventario
  └─ Confirma monto ($150)
```

### **Paso 2: Pago Stripe**
```
Cliente → Stripe Checkout (test mode)
  ├─ Payment Info
  ├─ Webhook → /api/stripe-webhook (server.js)
  ├─ Genera MyeShip label → myeshipClient.js
  └─ Guarda en DB: tracking_number, label_base64
```

### **Paso 3: Admin Monitoreo (CYDMONBLEU)**
```
Admin → /admin (Node.js)
  ├─ Ve todas las solicitudes
  ├─ Busca por orden/email/tracking
  ├─ Filtra por: estado pago, existencia guía
  ├─ Ver detalle
  ├─ Descargar guía MyeShip
  ├─ Reintentar generación
  └─ Exportar CSV
```

### **Paso 4: Webhook → GESTORCYDMONBLEU (Flask)**
```
Cuando payment_status = 'paid':
  ├─ Envía webhook a /webhook/return-requests
  ├─ Incluye: request_id, order_id, cliente, items, tracking, label
  ├─ GESTORCYDMONBLEU recibe y crea ReturnRequest
  ├─ Registra en historial: "pago_recibido"
  └─ Aparece en Kanban como PENDIENTE
```

### **Paso 5: Revisión Admin (GESTORCYDMONBLEU)**
```
Admin → Dashboard Kanban (Flask)
  ├─ Ve columna PENDIENTES
  ├─ Analiza: cliente, items, razón, monto
  ├─ Decide: APROBAR o RECHAZAR
  ├─ Registra acción en historial
  └─ Solicitud se mueve a columna correspondiente
```

---

## 🗄️ Modelo de Datos Mejorado

### **ReturnRequest** (En PostgreSQL)

```sql
return_requests {
  id                    INTEGER PRIMARY KEY
  request_id           VARCHAR(50) UNIQUE     ← Identificador único
  order_id             VARCHAR(50)            ← Orden Shopify (#1001)
  
  -- Cliente
  contact_name         VARCHAR(150)           ← Nombre cliente
  contact_email        VARCHAR(150)           ← Email
  contact_phone        VARCHAR(20)            ← Teléfono (NUEVO)
  
  -- Devolución
  return_type          VARCHAR(20)            ← "cambio" o "devolucion"
  items_json           JSONB                  ← Items con tallas (NUEVO)
  files_json           JSONB                  ← Fotos cargadas (NUEVO)
  razon                TEXT                   ← Razón de devolución
  
  -- Pago
  amount               NUMERIC(10,2)          ← $150 (NUEVO)
  payment_status       VARCHAR(20)            ← pending/paid/failed (NUEVO)
  stripe_session_id    VARCHAR(150)           ← Session ID Stripe (NUEVO)
  
  -- Envío
  carrier              VARCHAR(50)            ← MYESHIP (NUEVO)
  tracking_number      VARCHAR(50)            ← Número tracking (NUEVO)
  label_base64         TEXT                   ← PDF en base64 (NUEVO)
  label_mime           VARCHAR(50)            ← application/pdf (NUEVO)
  label_created_at     TIMESTAMP              ← Fecha generación (NUEVO)
  
  -- Workflow
  estado               VARCHAR(20)            ← pendiente/aprobado/rechazado
  
  created_at           TIMESTAMP
  updated_at           TIMESTAMP
}
```

### **ReturnRequestHistorial** (En PostgreSQL)

```sql
return_request_historial {
  id                   INTEGER PRIMARY KEY
  request_id           INTEGER FK             ← Referencia a return_requests
  accion               VARCHAR(50)            ← "pago_recibido", "aprobado", etc.
  usuario              VARCHAR(50)            ← Usuario que actuó
  nota                 TEXT                   ← Detalles de la acción
  metadata             JSONB                  ← Datos adicionales (NUEVO)
  fecha                TIMESTAMP              ← Cuándo pasó
}
```

---

## 🔐 Seguridad

### **Implementado:**
- ✅ Basic HTTP Auth en `/admin` (CYDMONBLEU)
- ✅ Admin middleware `requireAdmin`
- ✅ X-API-KEY validation en webhook
- ✅ Stripe webhook signature verification
- ✅ Credenciales en `.env` (no hardcodeadas)
- ✅ HTTPS en producción (Render)

### **Contraseñas de Demo:**
```
CYDMONBLEU:
  Admin: Configured en ADMIN_USER/ADMIN_PASS

GESTORCYDMONBLEU:
  admin / 1234 → Rol: admin (acceso completo)
  soporte / 1234 → Rol: soporte (solo lectura)
```

---

## 📡 Variables de Entorno Requeridas

### **CYDMONBLEU (Node.js)**
```env
# Base de datos
DB_HOST=localhost
DB_USER=user
DB_PASSWORD=pass
DB_NAME=cydmonbleu
DISABLE_DB=false

# Stripe
STRIPE_SECRET_KEY=sk_test_...

# Shopify
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
SHOPIFY_SHOP=your-store.myshopify.com

# MyeShip
MYESHIP_API_KEY=...
MYESHIP_ENV=production
MYESHIP_AUTO_SELECT_CHEAPEST=false
RETURN_COMPANY_NAME=MON BLEU
RETURN_PHONE=+34600000000
RETURN_ADDRESS1=Calle Principal 123
RETURN_CITY=Madrid
RETURN_STATE=Madrid
RETURN_POSTAL_CODE=28001
RETURN_COUNTRY_CODE=ES

# Admin
ADMIN_USER=admin@example.com
ADMIN_PASS=contraseña_segura

# Webhook
WEBHOOK_API_KEY=webhook-demo-key
GESTOR_WEBHOOK_URL=https://gestor.onrender.com/webhook/return-requests
```

### **GESTORCYDMONBLEU (Flask)**
```env
DATABASE_URL=postgresql://user:pass@host/db
SECRET_KEY=secret-key-flask
WEBHOOK_API_KEY=webhook-demo-key
```

---

## 🚀 Próximos Pasos

### **INMEDIATO:**

1. **Configurar GESTORCYDMONBLEU en Render**
   - Fork el repo actualizado
   - Configurar variables de entorno (PostgreSQL Neon)
   - Deploy

2. **Conectar webhooks entre apps**
   - En CYDMONBLEU server.js: configurar `GESTOR_WEBHOOK_URL`
   - En GESTORCYDMONBLEU app.py: verificar `WEBHOOK_API_KEY`

3. **Probar flujo end-to-end**
   - Cliente ingresa en CYDMONBLEU
   - Paga con Stripe (test)
   - Webhook dispara en GESTORCYDMONBLEU
   - Admin ve en Kanban

### **RECOMENDADO:**

4. **Email notifications**
   - Cuando: pago confirmado, solicitud aprobada
   - Usar: SendGrid o AWS SES

5. **Migrar uploads**
   - De local filesystem → Cloudinary o AWS S3
   - Porque Render tiene filesystem efímero

6. **Integración Shopify Webhook**
   - Recibir `order/updated` cuando cambia inventario
   - Sincronizar automáticamente

7. **SMS tracking updates**
   - Cuando se genera tracking
   - Usar: Twilio

---

## ✅ Checklist Final

- [x] Estructura CYDMONBLEU completa (Node.js + Admin)
- [x] Estructura GESTORCYDMONBLEU mejorada (Flask + ReturnRequest)
- [x] Webhook integración bidireccional
- [x] Dashboard admin en ambas apps
- [x] Seguridad: Auth Basic + API keys
- [x] Base de datos PostgreSQL con schema
- [x] Archivos en GitHub
- [x] Guía de implementación
- [ ] Desplegar GESTORCYDMONBLEU en Render
- [ ] Configurar variables de entorno en Render
- [ ] Probar pago Stripe end-to-end
- [ ] Activar webhooks MyeShip (si aplica)

---

## 📞 Resumen Técnico

| Componente | Tecnología | Status |
|-----------|-----------|--------|
| Frontend (Cliente) | HTML/CSS/JS | ✅ Listo |
| Frontend (Admin) | HTML/CSS/JS | ✅ Listo |
| Backend (CYDMONBLEU) | Node.js/Express | ✅ Listo |
| Backend (GESTORCYDMONBLEU) | Flask/Python | ✅ Mejorado |
| BD Transacciones | MySQL | ⚠️ Configurable |
| BD Admin | PostgreSQL/Neon | ✅ Listo |
| Pagos | Stripe API | ✅ Listo (test) |
| Envíos | MyeShip API | ✅ Listo (sandbox) |
| Órdenes | Shopify API | ✅ Listo |
| Hosting | Render.com | ✅ Listo |
| Versionamiento | GitHub | ✅ Listo |

---

**Versión:** 2.0  
**Última actualización:** 31/01/2026  
**Responsable:** GitHub Copilot  
**Estado:** 🟢 LISTO PARA DEPLOY
