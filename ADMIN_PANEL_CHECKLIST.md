# ✅ Checklist de Integración BD + Admin Panel

## Pre-requisitos
- [ ] MySQL instalado y corriendo (puerto 3306)
- [ ] Node.js v18+ instalado
- [ ] Git iniciado (opcional)

---

## Paso 1: Base de Datos
```powershell
cd "C:\Users\cabes\OneDrive\Documentos\CYDMONBLEU"

# Ejecutar setup automático
.\database\setup-db.ps1

# Ingresar contraseña MySQL cuando pida
```

**Verificar:**
```bash
mysql -u root -p -e "SELECT * FROM cydmonbleu.returns_requests LIMIT 1;"
```

✅ Debe mostrar estructura de tabla (sin errores)

---

## Paso 2: Configurar variables de entorno

**Renombrar archivo:**
```powershell
ren llave.env .env
```

**Editar `.env` con credenciales reales:**
```dotenv
# Servidor
PORT=3000
NODE_ENV=production

# Base de Datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña_mysql_aqui
DB_NAME=cydmonbleu
DB_PORT=3306

# Shopify (ya tienes)
SHOPIFY_CLIENT_ID=b4381e2ca835d8205ea3e3f3da25a7b5
SHOPIFY_CLIENT_SECRET=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
SHOP_DOMAIN=monbleu1221.myshopify.com

# MercadoPago
MP_ACCESS_TOKEN=APP_USR_...
MP_ENV=sandbox
PUBLIC_BASE_URL=http://localhost:3000

# Admin
ADMIN_USER=admin
ADMIN_PASS=admin123456
```

---

## Paso 3: Instalar dependencias
```bash
npm install
```

✅ Debe completarse sin errores

---

## Paso 4: Iniciar servidor
```bash
npm start
```

**Debe ver:**
```
✅ Connected to MySQL database
✅ DB lista: tabla returns_requests verificada
Server running on http://localhost:3000
```

---

## Paso 5: Acceder al panel admin

1. Abrir: `http://localhost:3000/admin.html`
2. Ingresar credenciales:
   - Usuario: `admin`
   - Contraseña: `admin123456`

3. Debe ver:
   - ✅ Dashboard con estadísticas
   - ✅ Tabla vacía (sin solicitudes aún)
   - ✅ Botones de búsqueda y filtros

---

## Verificaciones

### Test 1: Verificar conexión BD
```bash
# En nueva terminal, mientras server está corriendo
curl http://localhost:3000/api/admin/requests \
  -H "Authorization: Basic YWRtaW46YWRtaW4xMjM0NTY="
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": []
}
```

### Test 2: Crear solicitud test manualmente
```sql
INSERT INTO returns_requests (
  order_id, contact_email, return_type, items_json, amount, payment_status
) VALUES (
  'TEST123',
  'test@example.com',
  'exchange',
  '[{"producto":"Camiseta","cantidad":1}]',
  50.00,
  'pending'
);
```

Luego refrescar admin.html → debe aparecer la solicitud

### Test 3: Verificar endpoints
```bash
# Listar solicitudes
curl http://localhost:3000/api/admin/requests -u admin:admin123456

# Obtener solicitud por ID
curl http://localhost:3000/api/admin/requests/1 -u admin:admin123456

# Verificar tabla en BD
mysql -u root -p -e "SELECT COUNT(*) FROM cydmonbleu.returns_requests;"
```

---

## Tabla de compatibilidad

| Componente | Estado | Notas |
|-----------|--------|-------|
| MySQL | ✅ | Tabla `returns_requests` lista |
| server.js | ✅ | Endpoints integrados |
| admin.html | ✅ | Interface conectada |
| Shopify API | ✅ | Cliente configurado |
| MercadoPago | ⚠️ | Necesita credenciales (sandbox o prod) |
| FedEx | ⚠️ | Necesita credenciales |

---

## Comandos útiles

```bash
# Ver logs del servidor en tiempo real
npm start

# Reiniciar solo la BD (sin perder datos)
mysql -u root -p < database/migrations/001_create_tables.sql

# Resetear BD completamente (CUIDADO - borra todo)
mysql -u root -p -e "DROP DATABASE cydmonbleu; CREATE DATABASE cydmonbleu;"
.\database\setup-db.ps1

# Ver estado de MySQL
mysql -u root -p -e "SHOW DATABASES; USE cydmonbleu; SHOW TABLES;"

# Verificar usuario admin
mysql -u root -p -e "SELECT * FROM cydmonbleu.administradores;"

# Ver solicitudes en BD
mysql -u root -p -e "SELECT id, order_id, payment_status, created_at FROM cydmonbleu.returns_requests;"
```

---

## 🎯 Estado actual

✅ **BD MySQL**: Configurada con `returns_requests`
✅ **Server.js**: Endpoints `/api/admin/*` listos
✅ **Admin.html**: Interface conectada
⚠️ **MercadoPago**: Pendiente configurar credenciales (sandbox)
⚠️ **FedEx**: Pendiente configurar credenciales

---

## 🚀 Próximos pasos

1. ✅ Crear BD ← **TÚ ESTÁS AQUÍ**
2. ⬜ Configurar variables de entorno
3. ⬜ Instalar `npm install`
4. ⬜ Iniciar `npm start`
5. ⬜ Probar admin panel
6. ⬜ Configurar MercadoPago para pagos reales
7. ⬜ Configurar FedEx para etiquetas reales

---

## 📞 Problemas?

Ver: `database/INTEGRATION_GUIDE.md` para troubleshooting detallado
