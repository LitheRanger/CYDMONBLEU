# ========================================
# SCRIPT DE VERIFICACIÓN COMPLETA
# Verifica que todo está funcionando
# ========================================

param(
    [switch]$SkipBrowser
)

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  MON|BLEU Returns Portal - Verificación Completa         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true
$warnings = @()

# ===== 1. NODE.JS =====
Write-Host "📦 1. Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    if ($nodeVersion -match "v(\d+)\.") {
        $majorVersion = [int]$matches[1]
        if ($majorVersion -ge 18) {
            Write-Host "   ✅ Node.js $nodeVersion instalado" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Node.js $nodeVersion (necesita v18+)" -ForegroundColor Yellow
            $warnings += "Node.js version antigua detectada"
            $allPassed = $false
        }
    } else {
        Write-Host "   ❌ Node.js no encontrado" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "   ❌ Node.js no instalado" -ForegroundColor Red
    $allPassed = $false
}

# ===== 2. NPM =====
Write-Host "📦 2. Verificando npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>&1
    Write-Host "   ✅ npm $npmVersion instalado" -ForegroundColor Green
} catch {
    Write-Host "   ❌ npm no encontrado" -ForegroundColor Red
    $allPassed = $false
}

# ===== 3. DEPENDENCIAS =====
Write-Host "📦 3. Verificando node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    $packageCount = (Get-ChildItem "node_modules" -Directory).Count
    Write-Host "   ✅ $packageCount paquetes instalados" -ForegroundColor Green
} else {
    Write-Host "   ❌ node_modules no existe - ejecuta: npm install" -ForegroundColor Red
    $allPassed = $false
}

# ===== 4. ARCHIVO .env =====
Write-Host "🔧 4. Verificando .env..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    Write-Host "   ✅ Archivo .env existe" -ForegroundColor Green
    
    # Verificar variables críticas
    $criticalVars = @(
        @{Name="PORT"; Pattern="PORT=\d+"},
        @{Name="DISABLE_DB"; Pattern="DISABLE_DB="},
        @{Name="MP_ACCESS_TOKEN"; Pattern="MP_ACCESS_TOKEN="},
        @{Name="ADMIN_USER"; Pattern="ADMIN_USER="},
        @{Name="ADMIN_PASS"; Pattern="ADMIN_PASS="}
    )
    
    foreach ($var in $criticalVars) {
        if ($envContent -match $var.Pattern) {
            Write-Host "      ✓ $($var.Name) configurado" -ForegroundColor Gray
        } else {
            Write-Host "      ⚠️  $($var.Name) faltante" -ForegroundColor Yellow
            $warnings += "$($var.Name) no configurado en .env"
        }
    }
} else {
    Write-Host "   ❌ Archivo .env no existe" -ForegroundColor Red
    Write-Host "      Copia .env.example a .env" -ForegroundColor Gray
    $allPassed = $false
}

# ===== 5. ARCHIVOS PRINCIPALES =====
Write-Host "📄 5. Verificando archivos del proyecto..." -ForegroundColor Yellow
$requiredFiles = @(
    "server.js",
    "package.json",
    "Shopifyclient.js",
    "fedexClient.js",
    "public/index.html",
    "public/admin.html"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file faltante" -ForegroundColor Red
        $allPassed = $false
    }
}

# ===== 6. BASE DE DATOS =====
Write-Host "🗄️  6. Verificando configuración de BD..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    $dbDisabled = $envContent -match "DISABLE_DB=true"
    
    if ($dbDisabled) {
        Write-Host "   ⚠️  BD desactivada (DISABLE_DB=true)" -ForegroundColor Yellow
        $warnings += "Base de datos desactivada - funcionalidad limitada"
    } else {
        $hasDbUrl = $envContent -match "DATABASE_URL="
        $hasDbHost = $envContent -match "DB_HOST="
        
        if ($hasDbUrl) {
            Write-Host "   ✅ DATABASE_URL configurado (PostgreSQL)" -ForegroundColor Green
        } elseif ($hasDbHost) {
            Write-Host "   ✅ DB_HOST configurado (MySQL)" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  No se detectó configuración de BD" -ForegroundColor Yellow
            $warnings += "BD habilitada pero sin credenciales"
        }
    }
}

# ===== 7. SERVIDOR =====
Write-Host "🚀 7. Verificando si servidor está corriendo..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   ✅ Servidor respondiendo en http://localhost:3000" -ForegroundColor Green
        Write-Host "      Status: $($response.StatusCode)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  Servidor no está corriendo" -ForegroundColor Yellow
    Write-Host "      Ejecuta: npm start" -ForegroundColor Gray
    $warnings += "Servidor no iniciado"
}

# ===== 8. ENDPOINTS =====
Write-Host "🌐 8. Verificando endpoints..." -ForegroundColor Yellow
$endpoints = @(
    @{Path="/"; Name="Portal Cliente"},
    @{Path="/admin.html"; Name="Panel Admin"}
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000$($endpoint.Path)" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ $($endpoint.Name) ($($endpoint.Path))" -ForegroundColor Green
        }
    } catch {
        Write-Host "   ⚠️  $($endpoint.Name) no accesible" -ForegroundColor Yellow
    }
}

# ===== 9. MERCADOPAGO =====
Write-Host "💳 9. Verificando MercadoPago..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "MP_ACCESS_TOKEN=") {
        Write-Host "   ✅ MercadoPago configurado (token detectado)" -ForegroundColor Green
    } elseif ($envContent -match "MP_ACCESS_TOKEN=\s*$") {
        Write-Host "   ⚠️  Token MercadoPago vacío" -ForegroundColor Yellow
        $warnings += "MercadoPago no configurado - pagos no funcionarán"
    } else {
        Write-Host "   ⚠️  MercadoPago no detectado en .env" -ForegroundColor Yellow
        $warnings += "MercadoPago no configurado"
    }
}

# ===== 10. DIRECTORIOS =====
Write-Host "📁 10. Verificando directorios..." -ForegroundColor Yellow
$requiredDirs = @("public", "database", "uploads")
foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-Host "   ✅ $dir/" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $dir/ faltante" -ForegroundColor Red
        if ($dir -eq "uploads") {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "      ✓ Creado automáticamente" -ForegroundColor Gray
        } else {
            $allPassed = $false
        }
    }
}

# ===== RESUMEN =====
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "                          RESUMEN                           " -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($allPassed -and $warnings.Count -eq 0) {
    Write-Host "✅ ¡TODO PERFECTO! Sistema listo para funcionar" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Próximos pasos:" -ForegroundColor Cyan
    Write-Host "   1. Accede a: http://localhost:3000" -ForegroundColor White
    Write-Host "   2. Accede a: http://localhost:3000/admin.html" -ForegroundColor White
    Write-Host "   3. Testea el flujo completo" -ForegroundColor White
} elseif ($allPassed -and $warnings.Count -gt 0) {
    Write-Host "⚠️  Sistema funcional pero con advertencias:" -ForegroundColor Yellow
    Write-Host ""
    foreach ($warning in $warnings) {
        Write-Host "   • $warning" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "🎯 Recomendaciones:" -ForegroundColor Cyan
    Write-Host "   1. Revisa las advertencias arriba" -ForegroundColor White
    Write-Host "   2. Configura lo que falta para funcionalidad completa" -ForegroundColor White
    Write-Host "   3. Consulta: START_HERE.md" -ForegroundColor White
} else {
    Write-Host "❌ Sistema tiene problemas críticos" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Para resolver:" -ForegroundColor Cyan
    Write-Host "   1. Instala Node.js v18+ si falta" -ForegroundColor White
    Write-Host "   2. Ejecuta: npm install" -ForegroundColor White
    Write-Host "   3. Configura .env correctamente" -ForegroundColor White
    Write-Host "   4. Consulta: START_HERE.md" -ForegroundColor White
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan

# ===== ABRIR BROWSER =====
if (-not $SkipBrowser -and $allPassed) {
    Write-Host ""
    $response = Read-Host "¿Abrir http://localhost:3000 en el navegador? (S/N)"
    if ($response -eq "S" -or $response -eq "s") {
        Start-Process "http://localhost:3000"
        Write-Host "✅ Navegador abierto" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "📚 Documentación completa en: START_HERE.md" -ForegroundColor Gray
Write-Host ""
