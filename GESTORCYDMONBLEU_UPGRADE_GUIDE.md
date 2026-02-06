# GESTORCYDMONBLEU - Guía de Actualización Mejorada

## 📋 Resumen de Cambios

Se ha rediseñado completamente el modelo `Solicitud` en GESTORCYDMONBLEU para que sea compatible con CYDMONBLEU (app Node.js de devoluciones con MercadoPago + FedEx).

### Cambios Principales:
- ✅ **Modelo Solicitud → ReturnRequest** (más descriptivo)
- ✅ Integración de campos **MercadoPago**: `payment_status`, `payment_reference`, `payment_provider`, `amount`
- ✅ Integración de campos **FedEx**: `carrier`, `tracking_number`, `label_base64`, `label_mime`
- ✅ Mejora de campos de cliente: `contact_phone` agregado
- ✅ JSON fields: `items_json` (artículos), `files_json` (archivos)
- ✅ Historial mejorado con `metadata` para datos adicionales
- ✅ Webhook `/webhook/return-requests` para recibir datos desde CYDMONBLEU
- ✅ API JSON para integración programática

---

## 🔧 Instalación

### 1. **Actualizar `app.py`**

Reemplaza el contenido de `app.py` con el archivo `IMPROVED_GESTORCYDMONBLEU_APP.py` que incluye:

```bash
# Desde el repo de GESTORCYDMONBLEU:
cp IMPROVED_GESTORCYDMONBLEU_APP.py app.py
```

**Cambios clave:**
- Nuevos modelos: `ReturnRequest`, `ReturnRequestHistorial`
- Nuevas rutas: `/return-request/<id>/approve`, `/return-request/<id>/reject`
- Webhook mejorado: `/webhook/return-requests`
- API endpoints: `/api/return-requests`, `/api/return-requests/<id>/historial`

### 2. **Actualizar Base de Datos**

Ejecuta la migración SQL en PostgreSQL (Neon):

```bash
# Conectarse a Neon:
psql "postgresql://neondb_owner:npg_O1toy9DsgBRa@ep-patient-dew-ahpacjaq-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Ejecutar el script SQL:
\i MIGRATION_GESTORCYDMONBLEU.sql
```

**Alternativa: Usar Flask**
```bash
# Desde Python:
from app import app, db
with app.app_context():
    db.create_all()
```

### 3. **Actualizar Templates**

Reemplaza los templates con las versiones mejoradas:

```bash
# Dashboard:
cp IMPROVED_GESTORCYDMONBLEU_DASHBOARD.html templates/dashboard.html

# Detalle de solicitud (NUEVO):
cp IMPROVED_GESTORCYDMONBLEU_DETALLE.html templates/detalle_solicitud.html
```

### 4. **Reiniciar App**

```bash
python app.py
# O en Render: commit y push a GitHub
```

---

## 🌉 Integración CYDMONBLEU ↔ GESTORCYDMONBLEU

### **Webhook desde CYDMONBLEU → GESTORCYDMONBLEU**

Cuando un cliente completa el pago en CYDMONBLEU (Node.js), se envía:

```javascript
// Desde server.js de CYDMONBLEU:
const gestorWebhookUrl = process.env.GESTOR_WEBHOOK_URL || 'https://gestor.onrender.com/webhook/return-requests';

fetch(gestorWebhookUrl, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.WEBHOOK_API_KEY
    },
    body: JSON.stringify({
        request_id: request.request_id,
        order_id: request.order_id,
        cliente: {
            nombre: request.contact_email.split('@')[0],
            email: request.contact_email,
            phone: request.contact_phone || ''
        },
        tipo: request.return_type,
        items: request.items || [],
        files: request.files || [],
        razon: request.razon || '',
        amount: request.amount,
        payment_status: 'paid',  // Ya pagado
        payment_reference: request.payment_reference,
        payment_provider: request.payment_provider,
        carrier: request.carrier || 'FEDEX',
        tracking_number: request.tracking_number || null,
        label_base64: request.label_base64 || null,
        label_mime: request.label_mime || 'application/pdf'
    })
});
```

### **Variables de Entorno Necesarias**

En CYDMONBLEU (`server.js`):
```env
GESTOR_WEBHOOK_URL=https://gestor-app.onrender.com/webhook/return-requests
WEBHOOK_API_KEY=webhook-demo-key
```

En GESTORCYDMONBLEU (`app.py`):
```env
WEBHOOK_API_KEY=webhook-demo-key
DATABASE_URL=postgresql://...
SECRET_KEY=tu-secret-key
```

---

## 📊 Flujo de Datos

```
Cliente rellena formulario en CYDMONBLEU (Node.js)
    ↓
Carga evidencia (fotos)
    ↓
Selecciona items a devolver
    ↓
Paga con MercadoPago ($150 flat rate)
    ↓ (webhook de MercadoPago)
Se genera etiqueta FedEx automáticamente
    ↓
WEBHOOK → GESTORCYDMONBLEU
    ↓
Solicitud aparece en el Kanban (PENDIENTE)
    ↓
Admin revisa y aprueba/rechaza
    ↓
Se registra en Historial
    ↓
Cliente recibe confirmación por email (opcional)
```

---

## 🔄 API Endpoints

### **Listar Solicitudes**
```bash
GET /api/return-requests
Headers: Authorization: Basic admin:password

Parámetros opcionales:
- ?estado=pendiente|aprobado|rechazado
- ?payment_status=pending|paid|failed
```

**Respuesta:**
```json
{
    "success": true,
    "total": 5,
    "data": [
        {
            "id": 1,
            "request_id": "REQ-12345",
            "order_id": "#1001",
            "contact_name": "Juan",
            "payment_status": "paid",
            "estado": "pendiente",
            "amount": 150.00,
            "tracking_number": "7684294823"
        }
    ]
}
```

### **Ver Historial**
```bash
GET /api/return-requests/1/historial
```

**Respuesta:**
```json
{
    "success": true,
    "request_id": "REQ-12345",
    "historial": [
        {
            "id": 1,
            "accion": "pago_recibido",
            "usuario": "sistema",
            "nota": "Webhook desde CYDMONBLEU",
            "fecha": "2026-01-31T10:30:00"
        },
        {
            "id": 2,
            "accion": "aprobado",
            "usuario": "admin",
            "nota": "Aprobado desde el gestor",
            "fecha": "2026-01-31T10:32:00"
        }
    ]
}
```

---

## 📱 Kanban Dashboard

El dashboard mantiene el diseño Kanban de 3 columnas:

| Pendientes | Aprobadas | Rechazadas |
|-----------|-----------|-----------|
| 🟡 | 🟢 | 🔴 |
| Nuevas solicitudes pendientes de revisión | Aprobadas, con etiqueta FedEx generada | Rechazadas por el equipo |
| Muestra: Items, razón, monto, cliente | Muestra: Tracking, cliente | Muestra: Cliente, razón |
| Botones: Aprobar, Rechazar | Botón: Ver detalle | Botón: Ver detalle |

**Estadísticas en tiempo real:**
- Total de solicitudes
- Pagadas vs Pendientes
- Con guía FedEx vs Sin guía

---

## 🔐 Autenticación

### **Login**
```
Usuario: admin
Contraseña: 1234
Rol: admin (acceso completo)

Usuario: soporte
Contraseña: 1234
Rol: soporte (solo lectura)
```

Para cambiar contraseñas, actualizar en PostgreSQL:
```sql
UPDATE usuario SET password_hash = 'nuevo_hash' WHERE usuario = 'admin';
```

---

## 🚀 Despliegue en Render

1. Actualizar repositorio GitHub con nuevos archivos:
   ```bash
   git add app.py templates/ MIGRATION_GESTORCYDMONBLEU.sql
    git commit -m "Actualizar modelo ReturnRequest con integración MercadoPago + FedEx"
   git push
   ```

2. En Render, trigger manual redeploy
3. Ejecutar migración SQL en base de datos Neon

---

## ✅ Checklist de Implementación

- [ ] Reemplazar `app.py` con versión mejorada
- [ ] Reemplazar templates (dashboard.html, añadir detalle_solicitud.html)
- [ ] Ejecutar migración SQL en PostgreSQL
- [ ] Configurar variables de entorno
- [ ] Actualizar CYDMONBLEU para enviar webhooks
- [ ] Probar webhook con cURL:
  ```bash
  curl -X POST https://gestor.onrender.com/webhook/return-requests \
    -H "Content-Type: application/json" \
    -H "X-API-KEY: webhook-demo-key" \
    -d '{"request_id":"REQ-TEST","order_id":"#1001","cliente":{"nombre":"Test","email":"test@example.com"},"tipo":"devolucion","amount":150,"payment_status":"paid"}'
  ```
- [ ] Verificar que la solicitud aparece en el Kanban
- [ ] Aprobar/Rechazar desde el panel
- [ ] Verificar historial

---

## 📞 Soporte

En caso de problemas:

1. **Tablas no se crean:** ejecutar `/init-db` en la web
2. **Webhook falla:** verificar `X-API-KEY` en headers
3. **Usuarios no existen:** acceder a `/crear-usuarios`
4. **PostgreSQL error:** verificar conexión en `.env`

---

**Versión:** 2.0 Mejorada  
**Fecha:** 31/01/2026  
**Compatibilidad:** CYDMONBLEU (Node.js), PostgreSQL/Neon, Render
