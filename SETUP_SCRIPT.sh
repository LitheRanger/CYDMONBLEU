#!/bin/bash
# ============================================================================
# CYDMONBLEU SETUP SCRIPT
# Instrucciones paso a paso para completar la implementación
# ============================================================================

# Última actualización: 31/01/2026
# Estado: 🟢 LISTO

# ============================================================================
# PARTE 1: PREPARAR REPOSITORIO GESTORCYDMONBLEU
# ============================================================================

echo "📦 PASO 1: Clonar/Actualizar GESTORCYDMONBLEU..."

# Si no tienes el repo, clonarlo:
# git clone https://github.com/LitheRanger/GESTORCYDMONBLEU.git
# cd GESTORCYDMONBLEU

# Si ya tienes, actualizar:
cd GESTORCYDMONBLEU
git pull origin main

# Copiar archivos mejorados desde CYDMONBLEU:
cp ../CYDMONBLEU/IMPROVED_GESTORCYDMONBLEU_APP.py ./app.py
cp ../CYDMONBLEU/IMPROVED_GESTORCYDMONBLEU_DASHBOARD.html ./templates/dashboard.html
cp ../CYDMONBLEU/IMPROVED_GESTORCYDMONBLEU_DETALLE.html ./templates/detalle_solicitud.html

# ============================================================================
# PARTE 2: CONFIGURAR BASE DE DATOS POSTGRESQL/NEON
# ============================================================================

echo "🗄️ PASO 2: Migración de base de datos..."

# Opción A: Si usas CLI de Neon
# neon_connection_string="postgresql://user:password@host/db"
# psql "$neon_connection_string" < ../CYDMONBLEU/MIGRATION_GESTORCYDMONBLEU.sql

# Opción B: Desde Python/Flask (más fácil)
python3 << 'EOF'
from app import app, db
with app.app_context():
    # Crear todas las tablas
    db.create_all()
    print("✅ Tablas creadas exitosamente")
EOF

# Crear usuarios de demo
python3 << 'EOF'
from app import app, db, Usuario
with app.app_context():
    # Verificar si ya existen
    if Usuario.query.first():
        print("⚠️  Usuarios ya existen")
    else:
        admin = Usuario(usuario='admin', rol='admin')
        admin.set_password('1234')
        soporte = Usuario(usuario='soporte', rol='soporte')
        soporte.set_password('1234')
        
        db.session.add(admin)
        db.session.add(soporte)
        db.session.commit()
        print("✅ Usuarios creados: admin/1234, soporte/1234")
EOF

# ============================================================================
# PARTE 3: CONFIGURAR VARIABLES DE ENTORNO
# ============================================================================

echo "🔐 PASO 3: Configurar .env..."

# Crear archivo .env basado en .env.example
cat > .env << 'EOF'
# Flask Config
FLASK_ENV=production
SECRET_KEY=tu-secret-key-muy-seguro-aqui
DEBUG=False

# Database PostgreSQL (Neon)
DATABASE_URL=postgresql://user:password@ep-xxxxxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# Webhook
WEBHOOK_API_KEY=webhook-demo-key

# Opcional: Email notifications
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=tu-email@gmail.com
MAIL_PASSWORD=tu-contraseña-app
EOF

# ============================================================================
# PARTE 4: CONFIGURAR CYDMONBLEU PARA ENVIAR WEBHOOKS
# ============================================================================

echo "📡 PASO 4: Configurar webhook en CYDMONBLEU..."

# En tu .env de CYDMONBLEU, agregar:
cat >> ../CYDMONBLEU/.env << 'EOF'

# Gestor Webhook (para sincronización)
GESTOR_WEBHOOK_URL=https://gestor-tuapp.onrender.com/webhook/return-requests
WEBHOOK_API_KEY=webhook-demo-key
EOF

# En server.js de CYDMONBLEU, en la función mp webhook, agregar:
# (Ya debería estar si usaste el código mejorado)

cat > webhook_integration_snippet.js << 'EOF'
// En server.js - dentro de /api/mp-webhook handler
// Después de confirmar payment_status = 'paid':

async function notifyGestorOfPayment(request) {
    const gestorUrl = process.env.GESTOR_WEBHOOK_URL;
    if (!gestorUrl) return; // Skip si no configurado
    
    try {
        const response = await fetch(gestorUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': process.env.WEBHOOK_API_KEY
            },
            body: JSON.stringify({
                request_id: request.id,
                order_id: request.order_id,
                cliente: {
                    nombre: request.contact_email.split('@')[0],
                    email: request.contact_email,
                    phone: request.contact_phone || ''
                },
                tipo: request.return_type,
                items: request.items_json || [],
                files: request.files_json || [],
                razon: request.razon || '',
                amount: request.amount,
                payment_status: 'paid',
                payment_provider: request.payment_provider || 'mercadopago',
                payment_reference: request.payment_reference,
                carrier: request.carrier || 'FEDEX',
                tracking_number: request.tracking_number,
                label_base64: request.label_base64,
                label_mime: request.label_mime || 'application/pdf'
            })
        });
        
        if (!response.ok) {
            console.error('Gestor webhook failed:', response.status);
        }
    } catch (error) {
        console.error('Error notifying Gestor:', error);
    }
}

// Llamar en mp webhook después de pagar:
await notifyGestorOfPayment(request);
EOF

# ============================================================================
# PARTE 5: DESPLEGAR EN RENDER
# ============================================================================

echo "🚀 PASO 5: Deploy en Render..."

echo "Para CYDMONBLEU (Node.js):"
echo "  1. Ve a Render.com → New → Web Service"
echo "  2. Conecta repo: https://github.com/LitheRanger/CYDMONBLEU"
echo "  3. Environment: Node"
echo "  4. Build: npm install"
echo "  5. Start: npm start"
echo "  6. Agrega env vars: MP_ACCESS_TOKEN, MP_ENV, PUBLIC_BASE_URL, DB_*, SHOPIFY_*, FEDEX_*, ADMIN_*"

echo ""
echo "Para GESTORCYDMONBLEU (Flask):"
echo "  1. Ve a Render.com → New → Web Service"
echo "  2. Conecta repo: https://github.com/LitheRanger/GESTORCYDMONBLEU"
echo "  3. Environment: Python"
echo "  4. Build: pip install -r requirements.txt"
echo "  5. Start: gunicorn app:app"
echo "  6. Agrega env vars: DATABASE_URL, SECRET_KEY, WEBHOOK_API_KEY"

# ============================================================================
# PARTE 6: CONFIGURAR MERCADOPAGO WEBHOOK
# ============================================================================

echo "💳 PASO 6: Configurar MercadoPago Webhook..."

echo "En MercadoPago Developers:"
echo "  1. Ve a Webhooks"
echo "  2. Crea un webhook"
echo "  3. URL: https://tu-cydmonbleu-app.onrender.com/api/mp-webhook"
echo "  4. Verifica PUBLIC_BASE_URL en .env"

# ============================================================================
# PARTE 7: PROBAR WEBHOOK ENTRE APPS
# ============================================================================

echo "🧪 PASO 7: Prueba de webhook..."

# Test webhook desde CYDMONBLEU a GESTORCYDMONBLEU:
curl -X POST https://gestor-tuapp.onrender.com/webhook/return-requests \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: webhook-demo-key" \
  -d '{
    "request_id": "REQ-TEST-001",
    "order_id": "#1001",
    "cliente": {
      "nombre": "Juan Test",
      "email": "juan@example.com",
      "phone": "+34600000000"
    },
    "tipo": "cambio",
    "items": [{"producto": "Camiseta", "talla_original": "M", "talla_cambio": "L"}],
    "razon": "Prueba webhook",
    "amount": 150,
    "payment_status": "paid",
    "payment_provider": "mercadopago",
    "payment_reference": "mp_test_123456",
    "carrier": "FEDEX",
    "tracking_number": "7684294823",
    "label_mime": "application/pdf"
  }'

# Esperado: {"status": "ok", "request_id": "REQ-TEST-001", "id": 1}

# ============================================================================
# PARTE 8: VERIFICAR TODO ESTÁ FUNCIONANDO
# ============================================================================

echo "✅ PASO 8: Verificaciones finales..."

echo ""
echo "Checklist:"
echo "  ☐ GESTORCYDMONBLEU deployed en Render"
echo "  ☐ Base de datos PostgreSQL funciona"
echo "  ☐ Usuarios creados (admin, soporte)"
echo "  ☐ Dashboard Kanban accesible en /admin"
echo "  ☐ Webhook test exitoso"
echo "  ☐ MercadoPago webhook configurado"
echo "  ☐ CYDMONBLEU puede hacer POST a webhook"
echo "  ☐ Registros aparecen en GESTORCYDMONBLEU"

echo ""
echo "URLs importantes:"
echo "  • CYDMONBLEU: https://tu-cydmonbleu.onrender.com"
echo "  • CYDMONBLEU Admin: https://tu-cydmonbleu.onrender.com/admin"
echo "  • GESTORCYDMONBLEU: https://tu-gestor.onrender.com"
echo "  • GESTORCYDMONBLEU Login: https://tu-gestor.onrender.com/login"

echo ""
echo "Credenciales de prueba:"
echo "  CYDMONBLEU Admin:"
echo "    Usuario: (ver ADMIN_USER)"
echo "    Contraseña: (ver ADMIN_PASS)"
echo ""
echo "  GESTORCYDMONBLEU:"
echo "    Usuario: admin"
echo "    Contraseña: 1234"

# ============================================================================
# PARTE 9: PRÓXIMOS PASOS (Opcional pero Recomendado)
# ============================================================================

echo ""
echo "📋 PRÓXIMOS PASOS (Opcional):"
echo ""
echo "1. Implementar Email Notifications:"
echo "   - pip install Flask-Mail"
echo "   - Enviar correo cuando payment_status = 'paid'"
echo "   - Enviar correo cuando estado = 'aprobado'"
echo ""
echo "2. Migrar Uploads a Cloudinary:"
echo "   - Porque Render tiene filesystem efímero (12h)"
echo "   - pip install cloudinary"
echo "   - Actualizar Multer en Node.js"
echo ""
echo "3. Agregar Rate Limiting:"
echo "   - pip install Flask-Limiter (Flask)"
echo "   - npm install express-rate-limit (Node)"
echo ""
echo "4. SMS Tracking Updates (Opcional):"
echo "   - pip install twilio"
echo "   - Enviar SMS cuando tracking_number se genera"
echo ""

echo "✨ ¡SETUP COMPLETADO! ✨"

# ============================================================================
# FIN DEL SCRIPT
# ============================================================================
