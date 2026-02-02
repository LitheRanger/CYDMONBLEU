# 🗄️ Base de Datos - MON|BLEU Returns Portal

## Estructura de carpetas

```
database/
├── migrations/          # Scripts SQL de creación de tablas
│   ├── 001_create_tables.sql
│   ├── 002_create_views.sql
│   └── ...
├── seeds/              # Scripts SQL para datos iniciales
│   ├── seed_admin.sql
│   └── ...
└── README.md           # Este archivo
```

## Instalación

### Opción 1: Ejecutar todos los scripts en orden

```bash
# Conectar a MySQL
mysql -u root -p

# Crear base de datos
CREATE DATABASE cydmonbleu;
USE cydmonbleu;

# Ejecutar migraciones en orden
source ./database/migrations/001_create_tables.sql
source ./database/migrations/002_create_views.sql

# Ejecutar seeds (datos iniciales)
source ./database/seeds/seed_admin.sql
```

### Opción 2: Script automatizado (desde terminal)

#### En PowerShell (Windows):
```powershell
$mysqlPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
$dbName = "cydmonbleu"
$dbUser = "root"
$dbPassword = "tu_contraseña"

# Crear BD
& $mysqlPath -u $dbUser -p$dbPassword -e "CREATE DATABASE $dbName;"

# Ejecutar migraciones
& $mysqlPath -u $dbUser -p$dbPassword $dbName < ".\database\migrations\001_create_tables.sql"
& $mysqlPath -u $dbUser -p$dbPassword $dbName < ".\database\migrations\002_create_views.sql"

# Ejecutar seeds
& $mysqlPath -u $dbUser -p$dbPassword $dbName < ".\database\seeds\seed_admin.sql"

Write-Host "✅ Base de datos configurada correctamente"
```

#### En Bash (Mac/Linux):
```bash
MYSQL_PATH="/usr/local/mysql/bin/mysql"
DB_NAME="cydmonbleu"
DB_USER="root"
DB_PASSWORD="tu_contraseña"

# Crear BD
$MYSQL_PATH -u $DB_USER -p$DB_PASSWORD -e "CREATE DATABASE $DB_NAME;"

# Ejecutar migraciones
$MYSQL_PATH -u $DB_USER -p$DB_PASSWORD $DB_NAME < ./database/migrations/001_create_tables.sql
$MYSQL_PATH -u $DB_USER -p$DB_PASSWORD $DB_NAME < ./database/migrations/002_create_views.sql

# Ejecutar seeds
$MYSQL_PATH -u $DB_USER -p$DB_PASSWORD $DB_NAME < ./database/seeds/seed_admin.sql

echo "✅ Base de datos configurada correctamente"
```

## Configuración en `.env`

Después de crear la BD, asegúrate de tener en `.env`:

```dotenv
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=cydmonbleu
DB_PORT=3306
```

## Tablas principales

### `return_requests`
Solicitudes de devolución/cambio con información de pago y envío.

**Campos principales:**
- `request_id` - ID único de la solicitud
- `order_id` - ID del pedido en Shopify
- `contact_email` - Email del cliente
- `payment_status` - Estado del pago (pending, paid, failed)
- `estado` - Estado de la solicitud (pendiente, aprobado, rechazado)
- `tracking_number` - Número de seguimiento FedEx
- `amount` - Monto del pago

### `return_request_historial`
Registro de eventos y cambios en cada solicitud.

**Campos principales:**
- `request_id` - Referencia a la solicitud
- `accion` - Tipo de evento (solicitud_creada, pago_recibido, guia_generada, etc.)
- `usuario` - Usuario que realizó la acción
- `nota` - Detalles adicionales
- `fecha` - Timestamp del evento

### `administradores`
Usuarios administradores del portal.

### `logs`
Registro de eventos del sistema.

## Vistas disponibles

### `return_requests_summary`
Resumen de todas las solicitudes con contador de eventos.

```sql
SELECT * FROM return_requests_summary WHERE estado = 'pendiente';
```

### `pending_shipments`
Solicitudes pagadas que aún no han sido enviadas.

```sql
SELECT * FROM pending_shipments;
```

### `monthly_revenue`
Reporte de ingresos mensual.

```sql
SELECT * FROM monthly_revenue;
```

## Resetear base de datos (desarrollo)

```sql
DROP DATABASE cydmonbleu;
CREATE DATABASE cydmonbleu;
-- Luego ejecutar todas las migraciones nuevamente
```

## Notas importantes

⚠️ **Seguridad:**
- Cambiar contraseña de admin antes de producción
- No commitear `.env` con credenciales reales
- Usar contraseñas fuertes en BD (no `root` en producción)

✅ **Backups:**
```bash
# Hacer backup
mysqldump -u root -p cydmonbleu > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar
mysql -u root -p cydmonbleu < backup_20240131_120000.sql
```
