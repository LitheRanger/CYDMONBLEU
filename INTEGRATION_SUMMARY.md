# 🎉 Integración Completada: Admin Panel + MySQL

## 📦 Lo que se creó/modificó

### 📁 Estructura de carpeta `database/`
```
database/
├── migrations/
│   ├── 001_create_tables.sql     ← Tabla returns_requests (compatible con server.js)
│   └── 002_create_views.sql      ← Vistas para reportes
├── seeds/
│   └── seed_admin.sql            ← Usuario admin por defecto
├── setup-db.ps1                  ← Script PowerShell automático
├── README.md                     ← Documentación de BD
├── INTEGRATION_GUIDE.md          ← NUEVO: Guía completa de integración
└── ...
```

### 📄 Documentos nuevos (root)
- `ADMIN_PANEL_CHECKLIST.md` - Checklist de verificación paso a paso
- `QUICK_DATABASE_SETUP.md` - Guía rápida de instalación

### 🔄 Cambios en código
- ✅ `database/migrations/001_create_tables.sql` actualizado para coincidir con `server.js`
- ✅ Tabla renombrada: `return_requests` → `returns_requests`
- ✅ Compatible con endpoints `/api/admin/*` ya existentes

---

## 🔗 Cómo funciona ahora

```
┌─────────────────────────────────────┐
│   ADMIN PANEL HTML                  │
│   public/admin.html                 │
│   (Interface web moderna)           │
└────────────────┬────────────────────┘
                 │ HTTP/REST API
                 │
┌────────────────▼────────────────────┐
│   EXPRESS SERVER                    │
│   server.js                         │
│   - GET /api/admin/requests         │
│   - GET /api/admin/requests/:id     │
│   - GET /api/label/:requestId       │
│   - POST .../retry-label            │
└────────────────┬────────────────────┘
                 │ SQL Queries
                 │
┌────────────────▼────────────────────┐
│   MYSQL DATABASE                    │
│   returns_requests table            │
│   - Solicitudes de devolución       │
│   - Estado de pagos                 │
│   - Guías FedEx                     │
│   - Historial de eventos            │
└─────────────────────────────────────┘
```

---

## ✅ Características implementadas

### Dashboard Admin
- [x] Listado de solicitudes
- [x] Filtrado por estado (pagado/pendiente)
- [x] Búsqueda por orden, email, tracking
- [x] Estadísticas (total, pagadas, pendientes, con guía)
- [x] Vista detallada de solicitud
- [x] Descarga de PDF (etiqueta FedEx)
- [x] Regenerar guía
- [x] Exportar a CSV

### Base de Datos
- [x] Tabla `returns_requests` para solicitudes
- [x] Tabla `returns_request_historial` para eventos
- [x] Tablas `administradores` y `logs`
- [x] Índices para búsquedas rápidas
- [x] Vistas SQL para reportes

### Autenticación
- [x] Basic Auth en endpoints admin
- [x] Usuario/contraseña configurable por `.env`

---

## 🚀 Instalación rápida (3 comandos)

### 1. Crear BD
```powershell
.\database\setup-db.ps1
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar servidor
```bash
npm start
```

Luego acceder a: **http://localhost:3000/admin.html**

---

## 📋 Configuración requerida (.env)

```dotenv
# Base de Datos (CRÍTICO)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=cydmonbleu

# Servidor
PORT=3000
NODE_ENV=production

# Shopify (ya tienes)
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
SHOP_DOMAIN=...

# MercadoPago (para pagos)
MP_ACCESS_TOKEN=APP_USR_...
MP_ENV=sandbox
PUBLIC_BASE_URL=http://localhost:3000

# Admin
ADMIN_USER=admin
ADMIN_PASS=admin123456
```

---

## 📊 Flujo de datos

```
1. CLIENTE
   └─ Solicita devolución (POST /api/submit-return)
      └─ Sube fotos, datos
         └─ Se guarda en BD

2. PAGO
   └─ Cliente paga con MercadoPago
      └─ Webhook actualiza payment_status='paid'
         └─ Sistema genera guía FedEx automáticamente

3. ADMIN
   └─ Accede a http://localhost:3000/admin.html
      └─ Ve tabla de solicitudes
         └─ Puede:
            ├─ Filtrar/buscar
            ├─ Ver detalles
            ├─ Descargar guía PDF
            └─ Regenerar guía si es necesario
```

---

## 🔍 Endpoints disponibles

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/admin.html` | Panel admin |
| GET | `/api/admin/requests` | Listar solicitudes |
| GET | `/api/admin/requests/:id` | Detalle solicitud |
| GET | `/api/label/:requestId` | PDF etiqueta |
| POST | `/api/admin/requests/:id/retry-label` | Regenerar guía |

Todos requieren **Basic Auth**: `Authorization: Basic <base64(admin:password)>`

---

## 📊 Tablas MySQL

### returns_requests
```
id, order_id, contact_email, return_type, items_json, files_json,
amount, payment_status, payment_reference,
carrier, tracking_number, label_base64, label_mime, label_created_at,
created_at
```

### returns_request_historial
```
id, request_id, accion, usuario, nota, metadata, fecha
```

### administradores
```
id, username, email, password_hash, nombre, activo, ultimo_acceso, creado_en
```

### logs
```
id, tipo, mensaje, datos, usuario_id, ip_address, created_at
```

---

## 📈 Vistas SQL (reportes)

```sql
-- Resumen de solicitudes
SELECT * FROM return_requests_summary;

-- Solicitudes sin enviar
SELECT * FROM pending_shipments;

-- Ingresos mensuales
SELECT * FROM monthly_revenue;
```

---

## ⚙️ Comandos útiles

```bash
# Crear BD
.\database\setup-db.ps1

# Instalar deps
npm install

# Iniciar servidor
npm start

# Ver solicitudes en BD
mysql -u root -p -e "SELECT * FROM cydmonbleu.returns_requests;"

# Resetear BD (borra todo)
mysql -u root -p -e "DROP DATABASE cydmonbleu;"
.\database\setup-db.ps1
```

---

## 🎯 Estado actual

| Componente | Estado | Notas |
|-----------|--------|-------|
| MySQL | ✅ Listo | Tabla creada y migrada |
| Admin Panel | ✅ Listo | Conectada y funcional |
| Shopify API | ✅ Listo | Cliente configurado |
| MercadoPago | ⚠️ Pendiente | Necesita credenciales reales |
| FedEx | ⚠️ Pendiente | Necesita credenciales |
| SSL/HTTPS | ⚠️ Pendiente | Para producción |

---

## 📚 Documentación

Para más detalles, ver:
- `database/README.md` - Documentación de BD
- `database/INTEGRATION_GUIDE.md` - Guía técnica completa
- `ADMIN_PANEL_CHECKLIST.md` - Verificaciones paso a paso
- `QUICK_DATABASE_SETUP.md` - Setup rápido

---

## ✨ Próximos pasos

1. Ejecutar `.\database\setup-db.ps1`
2. Editar `.env` con credenciales MySQL
3. `npm install`
4. `npm start`
5. Acceder a `http://localhost:3000/admin.html`

¡Todo debería funcionar! 🚀
