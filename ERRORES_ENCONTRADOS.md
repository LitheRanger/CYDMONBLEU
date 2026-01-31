# 🔍 Análisis de Errores del Web Service - MON|BLEU

## ✅ Errores Corregidos

### 1. **Error Crítico: Webhook usa Stripe sin verificar si existe**
**Ubicación:** `/api/stripe-webhook`
**Problema:** El webhook intentaba usar `stripe.webhooks.constructEvent()` sin verificar primero si `stripe` está inicializado.
**Impacto:** Causaría un crash del servidor si se recibe un webhook sin tener Stripe configurado.
**Solución:** Agregada verificación `if (!stripe)` antes de usar el SDK.

```javascript
// ANTES (❌ CRASH)
if (!webhookSecret) { ... }
event = stripe.webhooks.constructEvent(...) // ❌ stripe puede ser null

// DESPUÉS (✅ SEGURO)
if (!stripe) { return res.status(400).send('Stripe no configurado'); }
if (!webhookSecret) { ... }
event = stripe.webhooks.constructEvent(...)
```

---

### 2. **Error: URLs incorrectas en success/cancel**
**Ubicación:** `/api/create-checkout-session`
**Problema:** Las URLs usaban rutas sin extensión `/success` y `/cancel` en lugar de `/success.html` y `/cancel.html`.
**Impacto:** El navegador recibiría 404 después del pago porque Express sirve archivos estáticos con extensión.
**Solución:** Cambiadas las URLs a rutas absolutas con `.html`.

```javascript
// ANTES (❌ 404)
success_url: '${origin}/success?session_id={CHECKOUT_SESSION_ID}'

// DESPUÉS (✅ FUNCIONA)
success_url: '${origin}/success.html?session_id={CHECKOUT_SESSION_ID}'
```

---

### 3. **Error: Falta validación de parámetros en Stripe Checkout**
**Ubicación:** `/api/create-checkout-session`
**Problema:** No validaba que `requestId`, `amount`, `orderId`, `contactEmail` existieran antes de usarlos.
**Impacto:** Stripe podría fallar con errores crípticos o crear sesiones incompletas.
**Solución:** Agregada validación completa de parámetros.

```javascript
// AGREGADO (✅)
if (!requestId || !amount || !orderId || !contactEmail) {
    return res.status(400).json({ message: "Faltan parámetros requeridos" });
}

if (amount <= 0) {
    return res.status(400).json({ message: "El monto debe ser mayor a 0" });
}
```

---

### 4. **Error: Validación faltante en validate-order**
**Ubicación:** `/api/validate-order`
**Problema:** No verificaba que `orderNumber` y `email` existieran antes de procesarlos.
**Impacto:** Podría causar errores al intentar usar `.toLowerCase()` en undefined.
**Solución:** Agregada validación de parámetros requeridos.

```javascript
// AGREGADO (✅)
if (!orderNumber || !email) {
    return res.status(400).json({ 
        valid: false, 
        message: 'Número de orden y email son requeridos' 
    });
}
```

---

### 5. **Error: Manejo genérico de errores de DB**
**Ubicación:** `/api/submit-return`
**Problema:** Todos los errores mostraban "Error interno del servidor" sin distinguir tipos.
**Impacto:** Difícil debugging - no se sabía si era problema de conexión, tabla inexistente, etc.
**Solución:** Agregado manejo específico de errores de MySQL.

```javascript
// AGREGADO (✅)
if (error.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({ 
        message: "Error de base de datos: tabla no existe" 
    });
}

if (error.code === 'ECONNREFUSED') {
    return res.status(500).json({ 
        message: "No se puede conectar a la base de datos" 
    });
}
```

---

## ⚠️ Advertencias Detectadas (No críticas pero importantes)

### 1. **Configuración opcional sin feedback claro**
**Ubicación:** Inicio del servidor
**Problema:** El servidor inicia sin indicar si DB o Stripe están configurados.
**Recomendación:** Agregar logs de estado al inicio.

```javascript
// SUGERIDO
console.log('🚀 Servidor MON|BLEU listo en http://localhost:3000');
console.log(`📊 Base de datos: ${dbPool ? '✅ Configurada' : '⚠️  No configurada'}`);
console.log(`💳 Stripe: ${stripe ? '✅ Configurado' : '⚠️  No configurado'}`);
```

---

### 2. **Multer sin límite de tamaño**
**Ubicación:** Configuración de multer
**Problema:** No hay límite en el tamaño total de archivos subidos.
**Impacto:** Un usuario podría subir archivos enormes y saturar el servidor.
**Recomendación:** Agregar límite.

```javascript
// SUGERIDO
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB por archivo
        files: 10 // Máximo 10 archivos
    }
});
```

---

### 3. **CORS abierto sin restricciones**
**Ubicación:** `app.use(cors())`
**Problema:** Permite requests desde cualquier origen.
**Impacto:** Cualquier sitio web puede llamar tu API.
**Recomendación:** Restringir en producción.

```javascript
// SUGERIDO PARA PRODUCCIÓN
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true
}));
```

---

### 4. **Falta rate limiting**
**Ubicación:** Todos los endpoints
**Problema:** No hay límite de requests por IP.
**Impacto:** Vulnerable a ataques de fuerza bruta o DDoS.
**Recomendación:** Instalar `express-rate-limit`.

```javascript
// SUGERIDO
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite de 100 requests
    message: 'Demasiadas solicitudes, intenta más tarde'
});

app.use('/api/', limiter);
```

---

### 5. **Webhook sin verificación de firma en desarrollo**
**Ubicación:** `/api/stripe-webhook`
**Problema:** Si `STRIPE_WEBHOOK_SECRET` no está configurado, rechaza todos los webhooks.
**Impacto:** Imposible probar localmente sin Stripe CLI.
**Recomendación:** Permitir modo desarrollo sin verificación.

```javascript
// SUGERIDO
if (!webhookSecret && process.env.NODE_ENV === 'production') {
    return res.status(400).send('Webhook secret requerido en producción');
}

if (webhookSecret) {
    // Verificar firma solo si está configurado
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
} else {
    // Modo desarrollo: parsear directamente
    event = JSON.parse(req.body);
}
```

---

## 🔒 Recomendaciones de Seguridad

1. **Sanitización de inputs:** Usar `validator.js` para limpiar emails y textos.
2. **SQL Injection:** Ya está protegido con prepared statements ✅
3. **XSS:** El frontend debería sanitizar antes de renderizar.
4. **HTTPS:** Obligatorio en producción para Stripe.
5. **Environment variables:** Nunca commitear `.env` al repositorio.

---

## 📊 Resumen de Estado

| Componente | Estado | Comentario |
|------------|--------|------------|
| DB Connection | ✅ Opcional | Funciona sin DB para testing |
| Stripe SDK | ✅ Opcional | Funciona sin Stripe para testing |
| Validación de orden | ✅ Corregida | Ahora valida parámetros requeridos |
| Upload de archivos | ✅ Funcional | Recomendado agregar límites |
| Webhook de Stripe | ✅ Corregida | Ya no crashea sin Stripe |
| URLs de redirección | ✅ Corregidas | Ahora usan .html |
| Manejo de errores | ✅ Mejorado | Errores específicos de DB |
| Rate limiting | ⚠️ Falta | Recomendado para producción |
| CORS | ⚠️ Abierto | Restringir en producción |

---

## 🧪 Testing Recomendado

### Test 1: Sin DB configurada
```bash
# Debería iniciar sin errores
node server.js
# Resultado esperado: "Base de datos no configurada" al hacer submit
```

### Test 2: Sin Stripe configurado
```bash
# Debería iniciar sin errores
node server.js
# Resultado esperado: "Stripe no configurado" al crear checkout
```

### Test 3: Con todo configurado
```bash
# Agregar a .env:
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=monbleu_returns
STRIPE_SECRET_KEY=sk_test_xxxxx

node server.js
# Resultado esperado: "✅ DB lista" y checkout funcional
```

---

## 📝 Checklist de Producción

- [ ] Configurar `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- [ ] Configurar `STRIPE_SECRET_KEY` (modo live)
- [ ] Configurar `STRIPE_WEBHOOK_SECRET`
- [ ] Agregar límites a multer (fileSize y files)
- [ ] Restringir CORS a dominios permitidos
- [ ] Agregar rate limiting con express-rate-limit
- [ ] Configurar HTTPS con certificado SSL
- [ ] Agregar logs con Winston o similar
- [ ] Configurar monitoreo (Sentry, New Relic, etc.)
- [ ] Hacer backup automático de DB
- [ ] Agregar NODE_ENV=production en .env
- [ ] Revisar todas las variables de entorno sensibles

---

**Última actualización:** 31 de enero de 2026
**Versión del servidor:** 1.0.0
