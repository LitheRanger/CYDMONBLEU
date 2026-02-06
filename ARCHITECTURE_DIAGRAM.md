# 🎯 Arquitectura Final - Admin Panel + MySQL

## 📐 Diagrama completo

```
╔═══════════════════════════════════════════════════════════════════╗
║                        CLIENTE (Browser)                         ║
║                                                                   ║
║  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐       ║
║  │  index.html    │  │  admin.html  │  │  success.html  │       ║
║  │  (Formulario)  │  │  (Dashboard) │  │  (Confirmación)│       ║
║  └────────┬───────┘  └──────┬───────┘  └────────────────┘       ║
║           │                 │                                    ║
╚═══════════╪═════════════════╪════════════════════════════════════╝
            │                 │
            │ HTTP/REST API   │
            │                 │
┌───────────▼─────────────────▼────────────────────────────────────┐
│                      EXPRESS.JS SERVER                           │
│                      (server.js, Port 3000)                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ EXPRESS MIDDLEWARE                                          │ │
│  │ ├─ CORS                                                    │ │
│  │ ├─ JSON Parser                                             │ │
│  │ ├─ Static Files (/public)                                 │ │
│  │ └─ Basic Auth (requireAdmin)                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ API ENDPOINTS                                               │ │
│  │                                                             │ │
│  │ CLIENT ROUTES:                                              │ │
│  │ ├─ POST /api/validate-order (Shopify)                      │ │
│  │ ├─ POST /api/submit-return (Upload files)                 │ │
│  │ ├─ POST /api/create-mp-preference (MercadoPago)           │ │
│  │ └─ GET /api/verify-mp-payment/:paymentId                  │ │
│  │                                                             │ │
│  │ ADMIN ROUTES (requireAdmin):                               │ │
│  │ ├─ GET /api/admin/requests (Listar)                       │ │
│  │ ├─ GET /api/admin/requests/:id (Detalle)                 │ │
│  │ ├─ POST /api/.../retry-label (Regenerar FedEx)           │ │
│  │ └─ GET /api/label/:requestId (Descargar PDF)             │ │
│  │                                                             │ │
│  │ WEBHOOK ROUTES:                                             │ │
│  │ └─ POST /api/mp-webhook (Confirmación pago)               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ INTEGRACIONES EXTERNAS                                      │ │
│  │ ├─ Shopify Client (shopifyClient.js)                       │ │
│  │ │  └─ Obtiene órdenes, datos cliente                       │ │
│  │ │                                                            │ │
│  │ ├─ MercadoPago (SDK)                                       │ │
│  │ │  ├─ Crea preferencias de pago                            │ │
│  │ │  └─ Verifica pagos y webhooks                            │ │
│  │ │                                                            │ │
│  │ └─ FedEx Client (fedexClient.js)                           │ │
│  │    ├─ Genera etiquetas de retorno                          │ │
│  │    └─ Obtiene tracking                                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└───────────┬────────────────────────────────────────────────────┬──┘
            │ SQL Queries (mysql2/promise)                       │
            │                                                    │
┌───────────▼────────────────────────────────────────────────────▼──┐
│                     MYSQL DATABASE                                │
│                     (Port 3306)                                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ CYDMONBLEU Database                                      │   │
│  │                                                          │   │
│  │ TABLES:                                                  │   │
│  │ ├─ returns_requests                                      │   │
│  │ │  └─ order_id, contact_email, return_type, ...         │   │
│  │ │     amount, payment_status, payment_reference         │   │
│  │ │     carrier, tracking_number, label_base64            │   │
│  │ │     created_at                                         │   │
│  │ │                                                        │   │
│  │ ├─ returns_request_historial                            │   │
│  │ │  └─ request_id, accion, usuario, metadata             │   │
│  │ │     nota, fecha                                        │   │
│  │ │                                                        │   │
│  │ ├─ administradores                                       │   │
│  │ │  └─ username, email, password_hash, nombre             │   │
│  │ │     activo, ultimo_acceso                              │   │
│  │ │                                                        │   │
│  │ └─ logs                                                  │   │
│  │    └─ tipo, mensaje, datos, usuario_id, ip, created_at  │   │
│  │                                                          │   │
│  │ INDEXES: order_id, payment_status, created_at,         │   │
│  │          tracking_number, contact_email                 │   │
│  │                                                          │   │
│  │ VIEWS:                                                   │   │
│  │ ├─ return_requests_summary                               │   │
│  │ ├─ pending_shipments                                     │   │
│  │ └─ monthly_revenue                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de datos - Caso de uso típico

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CLIENTE CREA SOLICITUD                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Cliente llena formulario en index.html                         │
│  ├─ POST /api/validate-order                                  │
│  │  └─ Shopify API: Valida orden existe                       │
│  │     └─ Response: ✅ Orden válida                           │
│  │                                                              │
│  ├─ POST /api/submit-return (con archivos)                    │
│  │  ├─ Multer: Guarda imágenes en /uploads                   │
│  │  ├─ INSERT into returns_requests                           │
│  │  │  - order_id, contact_email, items_json, etc.           │
│  │  │  - payment_status = 'pending'                          │
│  │  │  - created_at = NOW()                                  │
│  │  │  id = 1                                                │
│  │  └─ Response: request_id = 1                              │
│  │                                                              │
│  └─ Redirige a /success.html con ID                           │
│                                                                  │
│  BD Estado: returns_requests[1] = {status: 'pending'}          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            ⬇
┌─────────────────────────────────────────────────────────────────┐
│ 2. CLIENTE REALIZA PAGO                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Cliente en /success.html hace clic en "Pagar"                 │
│  ├─ POST /api/create-mp-preference                            │
│  │  ├─ SELECT from returns_requests WHERE id=1                │
│  │  ├─ MercadoPago preference.create({                       │
│  │  │    amount, customer_email, metadata...                 │
│  │  │  })                                                     │
│  │  ├─ UPDATE returns_requests SET                           │
│  │  │    payment_reference = 'mp_...'                       │
│  │  │  WHERE id=1                                            │
│  │  └─ Response: checkout_url                                │
│  │                                                              │
│  └─ Redirige a MercadoPago Checkout (cliente paga aquí)      │
│                                                                  │
│  MercadoPago → Webhook → POST /api/mp-webhook                 │
│  ├─ MercadoPago: Verifica pago                                │
│  ├─ UPDATE returns_requests SET                               │
│  │    payment_status = 'paid'                                │
│  │  WHERE payment_reference = 'mp_...'                       │
│  ├─ INSERT into returns_request_historial                     │
│  │    accion = 'pago_recibido'                               │
│  │    metadata = {...}                                        │
│  │                                                              │
│  └─ FedEx: Genera etiqueta de retorno                         │
│     ├─ SELECT order from Shopify API                         │
│     ├─ fedexClient.createReturnLabel()                       │
│     ├─ UPDATE returns_requests SET                           │
│     │    carrier = 'FEDEX'                                   │
│     │    tracking_number = '794614473450'                    │
│     │    label_base64 = 'JVBERi0xLjQK...'                   │
│     │    label_created_at = NOW()                            │
│     │  WHERE id=1                                            │
│     └─ INSERT into returns_request_historial                 │
│         accion = 'guia_generada'                             │
│                                                                  │
│  BD Estado: returns_requests[1] =                             │
│  {status: 'paid', tracking_number: '794614...'}              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                            ⬇
┌─────────────────────────────────────────────────────────────────┐
│ 3. ADMIN VERIFICA EN PANEL                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Admin accede a http://localhost:3000/admin.html              │
│  ├─ Ingresa user/pass                                        │
│  │  └─ Basic Auth: Authorization: Basic YWRtaW46YWRtaW4xMjM0 │
│  │                                                              │
│  ├─ GET /api/admin/requests                                 │
│  │  ├─ SELECT id, order_id, contact_email, ...              │
│  │  │    payment_status, tracking_number, created_at       │
│  │  │ FROM returns_requests                                 │
│  │  │ ORDER BY created_at DESC                              │
│  │  │ LIMIT 500                                             │
│  │  │ Response: [{id: 1, order_id: '...', status: 'paid',  │
│  │  │            tracking_number: '794614...', ...}]        │
│  │  │                                                        │
│  │  └─ Dashboard carga tabla con solicitudes                │
│  │     - Total: 1                                            │
│  │     - Pagadas: 1                                          │
│  │     - Con guía: 1                                         │
│  │                                                              │
│  ├─ Admin hace clic en "Ver" de solicitud 1                  │
│  │  └─ GET /api/admin/requests/1                            │
│  │     └─ Response: Detalles completos                       │
│  │        {id, order_id, items_json (parseado),              │
│  │         files_json, tracking_number, ...}                 │
│  │                                                              │
│  └─ Admin hace clic en "Guía"                                │
│     └─ GET /api/label/1                                     │
│        └─ SELECT label_base64 FROM returns_requests          │
│           └─ Descarga PDF: etiqueta_794614473450.pdf         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura de archivos finales

```
CYDMONBLEU/
├── database/
│   ├── migrations/
│   │   ├── 001_create_tables.sql      ← Tabla returns_requests
│   │   └── 002_create_views.sql       ← Vistas SQL
│   ├── seeds/
│   │   └── seed_admin.sql
│   ├── setup-db.ps1                   ← Script instalación
│   ├── README.md
│   └── INTEGRATION_GUIDE.md            ← Documentación técnica
│
├── public/
│   ├── index.html                     ← Formulario cliente
│   ├── admin.html                     ← Panel admin
│   ├── success.html                   ← Después de pagar
│   ├── cancel.html
│   └── HelveticaNeueLTProHv.otf
│
├── uploads/                            ← Fotos de clientes
│   └── (imágenes guardadas)
│
├── .env                                ← Variables (NO commitar)
├── .env.example                        ← Plantilla
├── .gitignore
│
├── server.js                           ← Express server
├── Shopifyclient.js                    ← API Shopify
├── fedexClient.js                      ← API FedEx
├── package.json
│
├── ADMIN_PANEL_CHECKLIST.md            ← Verificación
├── QUICK_DATABASE_SETUP.md             ← Setup rápido
├── INTEGRATION_SUMMARY.md              ← Resumen
│
├── README.md
├── DEPLOYMENT_GUIDE.md
└── ... (otros archivos)
```

---

## 🔐 Seguridad

```
┌─────────────────────────────────────────────────────────┐
│ CREDENCIALES SEGURAS                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1. .env (LOCAL - no commitar)                          │
│    ├─ DB_PASSWORD                                      │
│    ├─ MP_ACCESS_TOKEN                                 │
│    ├─ FEDEX_API_KEY                                    │
│    ├─ ADMIN_PASS                                       │
│    └─ SHOPIFY_CLIENT_SECRET                            │
│                                                         │
│ 2. Render/Deploy (ENV VARS)                            │
│    └─ Todas las credenciales aquí (no en código)       │
│                                                         │
│ 3. MySQL (local development)                           │
│    ├─ Usuario: root (cambiar en prod)                  │
│    ├─ Contraseña: tu_contraseña                        │
│    └─ Solo en localhost                                │
│                                                         │
│ 4. HTTPS (Producción)                                  │
│    ├─ SSL Certificate                                  │
│    ├─ Redirect HTTP → HTTPS                            │
│    └─ Secure cookies                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Verificación de integración

```bash
# 1. BD creada
mysql -u root -p -e "SHOW TABLES FROM cydmonbleu;"
# Debe mostrar: returns_requests, returns_request_historial, administradores, logs

# 2. Server conectado
npm start
# Debe mostrar: "✅ Connected to MySQL database"

# 3. Endpoints funcionan
curl http://localhost:3000/api/admin/requests \
  -u admin:admin123456
# Debe retornar: {"success":true,"data":[]}

# 4. Admin HTML carga
curl http://localhost:3000/admin.html
# Debe retornar HTML del panel
```

---

## 📊 Métricas de performance

```sql
-- Solicitudes promedio por mes
SELECT COUNT(*)/DAY(LAST_DAY(NOW())) as promedio_diario
FROM returns_requests
WHERE MONTH(created_at) = MONTH(NOW());

-- Tasa de conversión (pagadas / totales)
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN payment_status='paid' THEN 1 ELSE 0 END) as pagadas,
  ROUND(SUM(CASE WHEN payment_status='paid' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as tasa_conversion
FROM returns_requests;

-- Ingresos
SELECT SUM(amount) as total_ingresos
FROM returns_requests
WHERE payment_status = 'paid';
```

---

## 🚀 Próximos pasos

1. ✅ BD MySQL: Configurada
2. ✅ Admin Panel: Integrado  
3. ✅ API Endpoints: Listos
4. ⬜ **Configurar .env con credenciales reales**
5. ⬜ Instalar `npm install`
6. ⬜ Iniciar `npm start`
7. ⬜ Probar admin panel
8. ⬜ Configurar MercadoPago
9. ⬜ Configurar FedEx credenciales
10. ⬜ Deploy a producción (Render)
