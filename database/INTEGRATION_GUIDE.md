# 🔗 Integración: Admin Panel + MySQL

## ✅ Estado de integración

El panel admin HTML (`public/admin.html`) está **completamente integrado** con la BD MySQL a través del `server.js`.

---

## 📊 Arquitectura

```
┌─────────────────────┐
│  public/admin.html  │  (Interface web)
│   - Dashboard       │
│   - Listado         │
│   - Detalle         │
│   - Ver PDF guías   │
└──────────┬──────────┘
           │ HTTP/REST
           │
┌──────────▼──────────┐
│    server.js        │  (Express.js + Node)
│  - /api/admin/*     │
│  - MySQL queries    │
│  - FedEx + MercadoPago   │
└──────────┬──────────┘
           │ SQL
           │
┌──────────▼──────────┐
│   MySQL Database    │  (returns_requests table)
│  - Solicitudes      │
│  - Pagos            │
│  - Guías FedEx      │
│  - Historial        │
└─────────────────────┘
```

---

## 📡 Endpoints disponibles

### 1. **GET /api/admin/requests** - Listar todas las solicitudes
```javascript
// Con autenticación Basic Auth
Authorization: Basic <base64(admin:password)>

// Respuesta
{
  "success": true,
  "data": [
    {
      "id": 1,
      "order_id": "12345",
      "contact_email": "cliente@example.com",
      "return_type": "exchange",
      "items_json": "[...]",
      "amount": 50.00,
      "payment_status": "paid",
      "payment_reference": "mp_...",
      "carrier": "FEDEX",
      "tracking_number": "794614473450",
      "label_base64": "JVBERi0xLjQK...",
      "created_at": "2024-01-31T10:30:00.000Z"
    }
  ]
}
```

### 2. **GET /api/admin/requests/:requestId** - Obtener detalle
```javascript
GET /api/admin/requests/1
// Respuesta igual a anterior pero solo 1 solicitud
```

### 3. **GET /api/label/:requestId** - Descargar etiqueta PDF
```javascript
GET /api/label/1
// Retorna el PDF en base64 o el archivo binario
```

### 4. **POST /api/admin/requests/:requestId/retry-label** - Regenerar guía FedEx
```javascript
POST /api/admin/requests/1/retry-label

// Respuesta
{
  "success": true,
  "message": "Guía regenerada",
  "trackingNumber": "794614473450"
}
```

---

## 🗄️ Estructura de tabla MySQL

```sql
returns_requests:
  ├── id (INT, PK)
  ├── order_id (VARCHAR)           ← De Shopify
  ├── contact_email (VARCHAR)      ← Cliente
  ├── return_type (VARCHAR)        ← 'exchange' o 'return'
  ├── items_json (JSON)            ← Array de productos
  ├── files_json (JSON)            ← Uploads
  ├── amount (DECIMAL)             ← Monto a pagar
  ├── payment_status (VARCHAR)     ← 'pending', 'paid', 'failed'
  ├── payment_reference (VARCHAR)  ← Referencia MercadoPago
  ├── carrier (VARCHAR)            ← 'FEDEX'
  ├── tracking_number (VARCHAR)    ← Número de seguimiento
  ├── label_base64 (MEDIUMTEXT)    ← PDF en base64
  ├── label_mime (VARCHAR)         ← 'application/pdf'
  ├── label_created_at (TIMESTAMP) ← Cuándo se generó
  └── created_at (TIMESTAMP)       ← Cuándo se creó

returns_request_historial:
  ├── id (INT, PK)
  ├── request_id (INT, FK)
  ├── accion (VARCHAR)             ← Tipo de evento
  ├── usuario (VARCHAR)
  ├── nota (TEXT)
  ├── metadata (JSON)
  └── fecha (TIMESTAMP)
```

---

## 🔐 Autenticación

El panel admin usa **Basic Auth** (configurado en `server.js`):

```javascript
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123456';
```

**Configurar en `.env`:**
```dotenv
ADMIN_USER=admin
ADMIN_PASS=tu_contraseña_segura
```

Desde el navegador, accede a:
```
http://localhost:3000/admin.html
```

Se pedirá usuario/contraseña.

---

## 📝 Flujo de datos

### 1. Cliente crea solicitud
```
Client → POST /api/submit-return
         ├─ Sube archivos
         ├─ Guarda en BD (returns_requests)
         └─ Devuelve request_id
```

### 2. Cliente paga con MercadoPago
```
Client → POST /api/create-mp-preference
         ├─ Crea preferencia MercadoPago
         ├─ Devuelve URL checkout
         └─ Cliente paga
         
MercadoPago → POST /api/mp-webhook
         ├─ Webhook recibe confirmación
         ├─ Actualiza payment_status='paid'
         └─ Genera guía FedEx
```

### 3. Admin verifica en panel
```
Admin → GET /api/admin/requests
        ├─ Ve tabla de solicitudes
        ├─ Filtra por estado
        ├─ Descarga guías
        └─ Puede regenerar guías
```

---

## 🚀 Cómo ejecutar

### 1. Crear BD
```powershell
.\database\setup-db.ps1
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar `.env`
```dotenv
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=cydmonbleu
PORT=3000
ADMIN_USER=admin
ADMIN_PASS=admin123456
```

### 4. Iniciar servidor
```bash
npm start
```

### 5. Acceder al admin
```
http://localhost:3000/admin.html
Username: admin
Password: admin123456
```

---

## 📊 Vistas útiles en MySQL

### Ver solicitudes pendientes de pago
```sql
SELECT * FROM returns_requests WHERE payment_status = 'pending' ORDER BY created_at DESC;
```

### Ver solicitudes pagadas sin guía
```sql
SELECT * FROM returns_requests WHERE payment_status = 'paid' AND tracking_number IS NULL;
```

### Ver historial de una solicitud
```sql
SELECT * FROM returns_request_historial WHERE request_id = 1 ORDER BY fecha DESC;
```

### Ingresos totales
```sql
SELECT SUM(amount) FROM returns_requests WHERE payment_status = 'paid';
```

---

## ⚙️ Variables de entorno necesarias

```dotenv
# MySQL
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=contraseña
DB_NAME=cydmonbleu
DB_PORT=3306

# Servidor
PORT=3000
NODE_ENV=production

# Shopify
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
SHOP_DOMAIN=monbleu1221.myshopify.com

# MercadoPago
MP_ACCESS_TOKEN=APP_USR_...
MP_ENV=sandbox
PUBLIC_BASE_URL=http://localhost:3000

# FedEx
FEDEX_ACCOUNT_NUMBER=...
FEDEX_METER_NUMBER=...
FEDEX_API_KEY=...

# Admin
ADMIN_USER=admin
ADMIN_PASS=admin123456
```

---

## 🐛 Troubleshooting

### ❌ "Base de datos no disponible"
- Verificar que MySQL está corriendo
- Verificar credenciales en `.env`
- Verificar que la BD `cydmonbleu` existe

### ❌ "Tabla returns_requests no existe"
- Ejecutar: `.\database\setup-db.ps1` nuevamente
- O ejecutar SQL manualmente:
  ```sql
  USE cydmonbleu;
  source database\migrations\001_create_tables.sql
  ```

### ❌ "Access Denied" en admin
- Usuario/contraseña incorrectos
- Verificar en `.env`: `ADMIN_USER` y `ADMIN_PASS`

### ❌ Panel no carga datos
- Abrir DevTools (F12) → Network
- Ver si `/api/admin/requests` retorna error
- Verificar logs en terminal

---

## 🔄 Sincronización en tiempo real

Para agregar sincronización en tiempo real (WebSockets), se puede:

```bash
npm install socket.io
```

Luego en `server.js`:
```javascript
const io = require('socket.io')(server);

app.post('/api/submit-return', (req, res) => {
    // ...guardar en BD...
    io.emit('request:new', newRequest);
});
```

En `admin.html`:
```javascript
const socket = io();
socket.on('request:new', (req) => {
    requests.push(req);
    render(requests);
});
```

---

## 📚 Referencias

- [Express.js](https://expressjs.com/)
- [MySQL2 Node.js](https://github.com/sidorares/node-mysql2)
- [Shopify API](https://shopify.dev/api)
- [MercadoPago Docs](https://www.mercadopago.com.mx/developers/es/docs)
- [FedEx API](https://developer.fedex.com/)
