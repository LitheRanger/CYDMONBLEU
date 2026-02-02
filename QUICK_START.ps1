#!/usr/bin/env pwsh
# ========================================
# SCRIPT DE INICIO RÁPIDO
# Ejecuta este archivo para empezar
# ========================================

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  MON|BLEU Returns Portal - Setup Rápido                  ║" -ForegroundColor Cyan
Write-Host "║  Integración: Admin Panel + MySQL                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Variables
$dbSetupScript = ".\database\setup-db.ps1"
$envFile = ".env"
$envExample = ".env.example"

# 1. Crear BD
Write-Host "📦 PASO 1: Crear Base de Datos" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if (Test-Path $dbSetupScript) {
    Write-Host "Ejecutando: $dbSetupScript" -ForegroundColor Cyan
    & $dbSetupScript
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Base de datos lista" -ForegroundColor Green
    } else {
        Write-Host "❌ Error en BD. Verifica los logs arriba" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Script no encontrado: $dbSetupScript" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔧 PASO 2: Configurar Variables de Entorno" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "✅ Copiado: $envExample → $envFile" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  IMPORTANTE: Edita .env con tus credenciales:" -ForegroundColor Yellow
        Write-Host "   • DB_PASSWORD = contraseña de MySQL"
        Write-Host "   • STRIPE_SECRET_KEY = tu key de Stripe"
        Write-Host "   • Otros valores según tu setup"
        Write-Host ""
    } else {
        Write-Host "❌ No encontrado: .env.example" -ForegroundColor Red
    }
} else {
    Write-Host "✅ Archivo .env ya existe" -ForegroundColor Green
}

Write-Host ""
Write-Host "📦 PASO 3: Instalar Dependencias" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if (Test-Path "package.json") {
    Write-Host "Ejecutando: npm install" -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Dependencias instaladas" -ForegroundColor Green
    } else {
        Write-Host "❌ Error en npm install" -ForegroundColor Red
    }
} else {
    Write-Host "❌ No encontrado: package.json" -ForegroundColor Red
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║ ✅ SETUP COMPLETADO                                        ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 PRÓXIMOS PASOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Edita .env con tus credenciales reales:"
Write-Host "   code .env"
Write-Host ""
Write-Host "2️⃣  Inicia el servidor:"
Write-Host "   npm start"
Write-Host ""
Write-Host "3️⃣  Accede al panel admin:"
Write-Host "   http://localhost:3000/admin.html"
Write-Host "   Usuario: admin"
Write-Host "   Contraseña: admin123456"
Write-Host ""
Write-Host "📚 Documentación:"
Write-Host "   • ADMIN_PANEL_CHECKLIST.md      - Verificación paso a paso"
Write-Host "   • INTEGRATION_SUMMARY.md        - Resumen de integración"
Write-Host "   • database/INTEGRATION_GUIDE.md - Guía técnica completa"
Write-Host "   • ARCHITECTURE_DIAGRAM.md       - Diagrama de arquitectura"
Write-Host ""

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host "💡 Tip: Revisa .env.example para ver todas las variables"
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Gray
