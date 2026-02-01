# Despliegue en Render

Esta guía describe cómo desplegar CYDMONBLEU en Render como servicio web Node.js que funciona sin base de datos local y reenvía llamadas al backend GESTORCYDMONBLEU.

## Arquitectura

En producción, CYDMONBLEU funciona como un frontend proxy que:
- Sirve la interfaz de usuario (archivos estáticos en `/public`)
- Reenvía todas las peticiones `/api/*` al backend GESTORCYDMONBLEU (Flask)
- No requiere base de datos MySQL local

## Configuración en Render

### 1. Crear nuevo Web Service

1. Ve a [Render Dashboard](https://dashboard.render.com/)
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio GitHub: `LitheRanger/CYDMONBLEU`
4. Configura el servicio:
   - **Name**: `cydmonbleu` (o el nombre que prefieras)
   - **Branch**: `main` (o la rama que uses)
   - **Root Directory**: (dejar vacío)
   - **Environment**: `Node`
   - **Build Command**: `npm ci` (ya configurado en render.yaml)
   - **Start Command**: `npm start` (ya configurado en render.yaml)

### 2. Variables de Entorno Requeridas

Configure las siguientes variables de entorno en Render (Settings → Environment):

#### Base de Datos (desactivada en Render)
```
DISABLE_DB=true
```

#### Backend GESTOR
```
GESTOR_API_URL=https://tu-backend-gestor.onrender.com
```
**IMPORTANTE**: Reemplaza con la URL real de tu backend GESTORCYDMONBLEU desplegado en Render.

#### Autenticación Admin (Basic Auth)
```
ADMIN_USER=tu_usuario_admin
ADMIN_PASS=tu_password_seguro
```

#### Stripe (pagos)
```
STRIPE_SECRET_KEY=sk_live_tu_secret_key_real
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret_real
```
**Nota**: En producción usa las claves de Stripe en modo LIVE, no TEST.

#### FedEx (generación de guías)
```
FEDEX_ENV=production
FEDEX_CLIENT_ID=tu_fedex_client_id
FEDEX_CLIENT_SECRET=tu_fedex_client_secret
FEDEX_ACCOUNT_NUMBER=tu_fedex_account_number
FEDEX_SERVICE_TYPE=FEDEX_GROUND
FEDEX_LABEL_IMAGE_TYPE=PDF
FEDEX_PKG_WEIGHT=1
FEDEX_PKG_WEIGHT_UNIT=LB
FEDEX_PKG_LENGTH=10
FEDEX_PKG_WIDTH=10
FEDEX_PKG_HEIGHT=10
FEDEX_PKG_DIM_UNIT=IN
```

#### Dirección de devolución (tu almacén)
```
RETURN_COMPANY_NAME=Monbleu
RETURN_CONTACT_NAME=Logistica
RETURN_PHONE=5555555555
RETURN_ADDRESS1=Tu Calle 123
RETURN_ADDRESS2=
RETURN_CITY=Ciudad
RETURN_STATE=Estado
RETURN_POSTAL_CODE=12345
RETURN_COUNTRY_CODE=MX
DEFAULT_CUSTOMER_PHONE=5555555555
```

#### Shopify
```
SHOPIFY_CLIENT_ID=tu_api_key_de_shopify
SHOPIFY_CLIENT_SECRET=tu_secret_key_de_shopify
SHOPIFY_SHOP=tu-tienda
```
**Nota**: `SHOPIFY_SHOP` es solo el subdominio, sin `.myshopify.com`

#### Node Environment
```
NODE_ENV=production
```

**IMPORTANTE**: Render inyecta automáticamente la variable `PORT`, NO la configures manualmente.

### 3. Configurar Webhook de Stripe

Una vez desplegado el servicio, configura el webhook en Stripe:

1. Ve a [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click en "Add endpoint"
3. URL del endpoint: `https://tu-cydmonbleu.onrender.com/api/stripe-webhook`
4. Selecciona el evento: `checkout.session.completed`
5. Copia el "Signing secret" y actualiza `STRIPE_WEBHOOK_SECRET` en Render

### 4. Despliegue

Render detectará automáticamente el archivo `render.yaml` y desplegará el servicio. El despliegue incluye:
- Instalación de dependencias con `npm ci`
- Inicio del servidor con `npm start`
- El servidor escuchará en el puerto que Render proporciona vía `$PORT`

## Pruebas Locales

Para probar el modo proxy localmente antes de desplegar:

### 1. Ejecutar el backend GESTOR

```bash
# En el directorio del backend GESTORCYDMONBLEU
export DATABASE_URL="postgresql://usuario:password@localhost:5432/gestor_db"
export FLASK_ENV=development
python app.py
# Backend corriendo en http://localhost:5000
```

### 2. Configurar variables de entorno en CYDMONBLEU

```bash
# En el directorio CYDMONBLEU
export DISABLE_DB=true
export GESTOR_API_URL=http://localhost:5000
export NODE_ENV=development
export ADMIN_USER=admin
export ADMIN_PASS=test123
# Configurar también SHOPIFY, STRIPE, FEDEX según necesites
```

### 3. Ejecutar CYDMONBLEU

```bash
npm ci
npm start
# Servidor corriendo en http://localhost:3000
```

### 4. Verificar el proxy

- Abre http://localhost:3000 en tu navegador
- Las peticiones a `/api/*` deberían ser redirigidas a `http://localhost:5000`
- Verifica en los logs del servidor que aparecen mensajes como:
  ```
  🔄 Modo proxy activado: redirigiendo /api/* a http://localhost:5000
  [PROXY] GET /api/validate-order -> http://localhost:5000/api/validate-order
  ```

## Funcionamiento del Proxy

Cuando `DISABLE_DB=true` y `GESTOR_API_URL` está configurado:

1. **Todas las peticiones a `/api/*`** son interceptadas por el middleware proxy
2. El proxy reenvía la petición al backend GESTOR manteniendo:
   - Método HTTP (GET, POST, PUT, DELETE, etc.)
   - Headers relevantes (Authorization, Content-Type, etc.)
   - Body de la petición (JSON o multipart/form-data)
3. La respuesta del backend se reenvía al cliente con:
   - Código de estado HTTP original
   - Headers de respuesta
   - Cuerpo de la respuesta

### Headers manejados

El proxy **preserva** headers importantes como:
- `Authorization` (para Basic Auth del admin)
- `Content-Type`
- `Cookie` y `Set-Cookie`
- Headers personalizados

El proxy **excluye** headers problemáticos:
- `host` (se reemplaza automáticamente)
- `content-length` (se recalcula)
- `connection`
- `content-encoding`
- `transfer-encoding`

### Timeouts y errores

- **Timeout**: 30 segundos
- **Error de conexión**: Devuelve 503 "Backend no disponible"
- **Timeout**: Devuelve 504 "Timeout conectando con backend"
- **Otros errores**: Devuelve 500 "Error en proxy"

## Monitoreo

En Render puedes monitorear:
- **Logs**: Settings → Logs (verás los logs de `console.log` del servidor)
- **Métricas**: Dashboard → tu servicio (CPU, memoria, requests)
- **Eventos**: Ver historial de despliegues y reinicios

## Troubleshooting

### El proxy no funciona
- Verifica que `DISABLE_DB=true` esté configurado
- Verifica que `GESTOR_API_URL` apunte a la URL correcta del backend
- Revisa los logs en Render para ver errores de conexión

### Backend no disponible (503)
- Verifica que el backend GESTOR esté desplegado y corriendo
- Verifica que la URL en `GESTOR_API_URL` sea correcta (incluye `https://` y sin `/` al final)
- Prueba hacer una petición directa al backend desde tu navegador

### Timeouts (504)
- El backend puede estar tardando más de 30 segundos en responder
- Verifica el rendimiento del backend
- Considera aumentar el timeout en `server.js` si es necesario

### Admin panel no funciona
- Verifica que `ADMIN_USER` y `ADMIN_PASS` estén configurados
- El navegador pedirá credenciales Basic Auth al acceder a `/admin`

### Pagos no funcionan
- Verifica que `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` estén configurados
- En producción, usa claves de Stripe en modo LIVE (no TEST)
- Verifica que el webhook esté configurado en Stripe Dashboard

## Seguridad

- **Nunca** commitees archivos `.env` con credenciales reales
- Usa variables de entorno en Render para todas las credenciales
- En producción, usa siempre claves LIVE de Stripe (no TEST)
- Configura passwords seguros para `ADMIN_PASS`
- Revisa regularmente los logs para detectar accesos no autorizados

## Soporte

Para más información:
- Documentación de Render: https://render.com/docs
- Repositorio: https://github.com/LitheRanger/CYDMONBLEU
