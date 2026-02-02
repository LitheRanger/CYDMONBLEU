# ========================================
# Script de instalación de Base de Datos
# MON|BLEU Returns Portal
# ========================================

param(
    [string]$DBHost = "localhost",
    [string]$DBUser = "root",
    [string]$DBPassword = "",
    [string]$DBName = "cydmonbleu"
)

# Colores para output
function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

Write-Info "Iniciando instalación de base de datos..."

# 1. Validar que MySQL esté instalado
Write-Info "Buscando MySQL..."
$mysqlPath = Get-Command mysql -ErrorAction SilentlyContinue
if (-not $mysqlPath) {
    Write-Error-Custom "MySQL no encontrado en PATH. Instala MySQL 8.0+ primero."
    Write-Info "Descarga desde: https://dev.mysql.com/downloads/mysql/"
    exit 1
}
Write-Success "MySQL encontrado: $($mysqlPath.Source)"

# 2. Pedir credenciales si no se proporcionan
if ([string]::IsNullOrEmpty($DBPassword)) {
    Write-Info "Ingresa la contraseña de MySQL para usuario '$DBUser':"
    $DBPassword = Read-Host -AsSecureString
    $DBPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($DBPassword))
}

# 3. Obtener rutas de scripts
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$migrationsDir = Join-Path $scriptDir "migrations"
$seedsDir = Join-Path $scriptDir "seeds"

if (-not (Test-Path $migrationsDir)) {
    Write-Error-Custom "Carpeta 'migrations' no encontrada en: $migrationsDir"
    exit 1
}

# 4. Crear base de datos
Write-Info "Creando base de datos '$DBName'..."
$createDbSQL = "CREATE DATABASE IF NOT EXISTS $DBName;"

try {
    mysql -h $DBHost -u $DBUser -p$DBPassword -e $createDbSQL
    Write-Success "Base de datos creada"
} catch {
    Write-Error-Custom "Error creando base de datos: $_"
    exit 1
}

# 5. Ejecutar migraciones
$migrationFiles = Get-ChildItem $migrationsDir -Filter "*.sql" | Sort-Object Name

if ($migrationFiles.Count -eq 0) {
    Write-Error-Custom "No se encontraron archivos SQL en $migrationsDir"
    exit 1
}

Write-Info "Ejecutando $($migrationFiles.Count) migraciones..."

foreach ($file in $migrationFiles) {
    Write-Info "→ Ejecutando: $($file.Name)"
    try {
        Get-Content $file.FullName | mysql -h $DBHost -u $DBUser -p$DBPassword $DBName
        Write-Success "✓ $($file.Name)"
    } catch {
        Write-Error-Custom "Error en $($file.Name): $_"
        exit 1
    }
}

# 6. Ejecutar seeds
$seedFiles = Get-ChildItem $seedsDir -Filter "*.sql" -ErrorAction SilentlyContinue | Sort-Object Name

if ($seedFiles.Count -gt 0) {
    Write-Info "Ejecutando $($seedFiles.Count) seeds..."
    
    foreach ($file in $seedFiles) {
        Write-Info "→ Ejecutando: $($file.Name)"
        try {
            Get-Content $file.FullName | mysql -h $DBHost -u $DBUser -p$DBPassword $DBName
            Write-Success "✓ $($file.Name)"
        } catch {
            Write-Error-Custom "Error en $($file.Name): $_"
            # No salir en error, continuar con otros seeds
        }
    }
}

# 7. Verificar instalación
Write-Info "Verificando tablas..."
$checkSQL = "SELECT COUNT(*) as tabla_count FROM information_schema.tables WHERE table_schema='$DBName';"

try {
    $result = mysql -h $DBHost -u $DBUser -p$DBPassword -N -e $checkSQL 2>&1 | Select-Object -First 1
    $tableCount = [int]$result
    
    if ($tableCount -gt 0) {
        Write-Success "Base de datos instalada correctamente ✨"
        Write-Info "Tablas creadas: $tableCount"
    } else {
        Write-Error-Custom "No se crearon tablas. Revisa los errores arriba."
        exit 1
    }
} catch {
    Write-Error-Custom "Error verificando instalación: $_"
    exit 1
}

# 8. Mostrar configuración para .env
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "📋 Configura tu archivo .env con:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "DB_HOST=$DBHost" -ForegroundColor Cyan
Write-Host "DB_USER=$DBUser" -ForegroundColor Cyan
Write-Host "DB_PASSWORD=[tu_contraseña]" -ForegroundColor Cyan
Write-Host "DB_NAME=$DBName" -ForegroundColor Cyan
Write-Host "DB_PORT=3306" -ForegroundColor Cyan
Write-Host ""

Write-Success "¡Instalación completada! 🎉"
Write-Info "Próximo paso: npm install && npm start"
