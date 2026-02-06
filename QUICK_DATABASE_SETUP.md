# 🚀 Guía Rápida - Instalación de Base de Datos

## ¿Qué se creó?

```
database/
├── migrations/
│   ├── 001_create_tables.sql    ← Tablas principales
│   └── 002_create_views.sql     ← Vistas para reportes
├── seeds/
│   └── seed_admin.sql           ← Usuario admin por defecto
├── setup-db.ps1                 ← Script automático (PowerShell)
└── README.md                    ← Documentación completa
```

## 🔧 Instalación rápida (Recomendado)

### En PowerShell:
```powershell
# Ve a la carpeta del proyecto
cd "C:\Users\cabes\OneDrive\Documentos\CYDMONBLEU"

# Ejecuta el script
.\database\setup-db.ps1

# Se te pedirá contraseña de MySQL (usuario: root)
```

**Eso es todo.** El script:
1. ✅ Crea la BD `cydmonbleu`
2. ✅ Ejecuta todas las migraciones
3. ✅ Inserta datos iniciales (admin)
4. ✅ Muestra la configuración para `.env`

---

## Manual (si prefieres)

### 1️⃣ Conectar a MySQL:
```bash
mysql -u root -p
```

### 2️⃣ Crear la BD:
```sql
CREATE DATABASE cydmonbleu;
USE cydmonbleu;
```

### 3️⃣ Ejecutar migraciones:
```sql
source database\migrations\001_create_tables.sql
source database\migrations\002_create_views.sql
```

### 4️⃣ Insertar datos iniciales:
```sql
source database\seeds\seed_admin.sql
```

---

## 📝 Configurar .env

Crea o edita `llave.env` (renómbralo a `.env`):

```dotenv
# Servidor
PORT=3000
NODE_ENV=production

# Shopify
SHOPIFY_CLIENT_ID=b4381e2ca835d8205ea3e3f3da25a7b5
SHOPIFY_CLIENT_SECRET=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
SHOP_DOMAIN=monbleu1221.myshopify.com

# Base de Datos (IMPORTANTE)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña_mysql
DB_NAME=cydmonbleu
DB_PORT=3306

# MercadoPago
MP_ACCESS_TOKEN=APP_USR_...
MP_ENV=sandbox
PUBLIC_BASE_URL=http://localhost:3000

# Admin (cambiar antes de producción)
ADMIN_USER=admin
ADMIN_PASS=admin123456
```

---

## ✅ Verificar instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor
npm start

# El servidor debe iniciar en http://localhost:3000
```

Si ves:
```
✅ Connected to MySQL database
Server running on http://localhost:3000
```

¡Todo funciona! 🎉

---

## 🆘 Problemas comunes

### ❌ "mysql: command not found"
Instala MySQL desde: https://dev.mysql.com/downloads/mysql/

### ❌ "Access denied for user 'root'"
La contraseña de MySQL es incorrecta. Usa:
```powershell
.\database\setup-db.ps1 -DBPassword "tu_contraseña"
```

### ❌ "Database already exists"
Ya existe. Usa:
```sql
DROP DATABASE cydmonbleu;
```
Luego ejecuta el setup de nuevo.

### ❌ "Cannot connect to database from server"
Verifica el `.env`:
- ¿Es `localhost` o `127.0.0.1`?
- ¿Puerto 3306 es correcto?
- ¿Usuario y contraseña son correctos?

---

## 📊 Qué se crea

| Tabla | Descripción |
|-------|-------------|
| `return_requests` | Solicitudes de devolución/cambio |
| `return_request_historial` | Historial de eventos |
| `administradores` | Usuarios del panel admin |
| `logs` | Registro de eventos del sistema |

| Vista | Descripción |
|------|-------------|
| `return_requests_summary` | Resumen de solicitudes |
| `pending_shipments` | Solicitudes sin enviar |
| `monthly_revenue` | Ingresos mensual |

---

## 🔐 Usuario Admin por defecto

```
Username: admin
Email: admin@monbleu.com
Contraseña: admin123456
```

⚠️ **CAMBIAR ANTES DE PRODUCCIÓN**

Generador de hash bcrypt:
```javascript
const bcrypt = require('bcrypt');
bcrypt.hash('mi_nueva_contraseña', 10).then(hash => console.log(hash));
```

---

## 📞 Necesitas ayuda?

- Ver [database/README.md](database/README.md) para más detalles
- Revisar [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) para deploy
