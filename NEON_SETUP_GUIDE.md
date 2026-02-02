# ☁️ GUÍA: Configurar Base de Datos en la Nube (Neon - PostgreSQL)

## ¿Por qué Neon?

- ✅ **Gratis** - 500MB storage gratis
- ✅ **No tarjeta** - No requiere tarjeta de crédito
- ✅ **PostgreSQL** - Compatible con el código
- ✅ **30 segundos** - Setup súper rápido
- ✅ **Desde cualquier lugar** - No necesitas instalar nada local

---

## 🚀 PASO A PASO (5 minutos)

### 1. Crear cuenta en Neon

1. Ve a: **https://neon.tech**
2. Click en **"Sign Up"**
3. Regístrate con GitHub, Google o email
4. Confirma tu email

### 2. Crear proyecto

1. Una vez logueado, click en **"Create Project"**
2. Configuración:
   - **Project name**: `monbleu-returns`
   - **Database name**: `cydmonbleu`
   - **Region**: `US East (Ohio)` o el más cercano
3. Click **"Create Project"**

### 3. Obtener credenciales

Después de crear, verás:
```
Connection string:
postgresql://username:password@ep-xyz-abc.us-east-2.aws.neon.tech/cydmonbleu?sslmode=require
```

**Copia esta URL completa**

### 4. Ejecutar migration

1. En Neon dashboard, ve a **"SQL Editor"**
2. Copia y pega todo el contenido de:
   ```
   database\migrations\001_create_tables_postgresql.sql
   ```
3. Click **"Run"**
4. Deberías ver: `CREATE TABLE` × 4 veces

### 5. Configurar .env

Abre tu archivo `.env` y actualiza:

```dotenv
# Cambiar de MySQL a PostgreSQL
DB_TYPE=postgres
DATABASE_URL=postgresql://username:password@ep-xyz.us-east-2.aws.neon.tech/cydmonbleu?sslmode=require

# Desactivar estos (PostgreSQL usa DATABASE_URL)
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=
# DB_NAME=cydmonbleu

# Habilitar BD
DISABLE_DB=false
```

### 6. Instalar driver PostgreSQL

```powershell
npm install pg
```

### 7. Actualizar server.js

El código ya está listo para soportar ambos, solo necesitas uncomment algunas líneas.

---

## ✅ Verificar que funciona

```powershell
# Reiniciar servidor
npm start

# Debe mostrar:
# "✅ Connected to PostgreSQL database"
```

---

## 📊 Dashboard Neon

En https://console.neon.tech puedes:
- Ver tablas creadas
- Ejecutar queries SQL
- Ver métricas de uso
- Hacer backups
- Ver logs

---

## 🔒 Seguridad

⚠️ **IMPORTANTE:**
- No commites el `.env` con credenciales
- La URL contiene tu contraseña
- Usa `.gitignore` para excluir `.env`

---

## 💡 Ventajas vs MySQL local

| Aspecto | Neon (Cloud) | MySQL Local |
|---------|-------------|-------------|
| Setup | 5 min | 30+ min |
| Instalación | No requiere | Sí |
| Acceso remoto | ✅ Desde cualquier lugar | ❌ Solo localhost |
| Backups | ✅ Automáticos | ❌ Manual |
| Gratis | ✅ 500MB | ✅ Ilimitado |
| Performance | ⚡ Rápido | ⚡ Muy rápido |

---

## 🆘 Troubleshooting

### Error: "Cannot connect to database"
✓ Verifica que `DATABASE_URL` esté correcto en `.env`
✓ Verifica que `DISABLE_DB=false`
✓ Instala driver: `npm install pg`

### Error: "Tabla no existe"
✓ Ejecuta migration en Neon SQL Editor

### Error: "Too many connections"
✓ Plan gratuito tiene límite de conexiones
✓ Usa connection pooling en código

---

## 🎯 Alternativas a Neon

Si prefieres otras opciones:

1. **Supabase** (PostgreSQL)
   - https://supabase.com
   - Más features (auth, storage, etc.)

2. **PlanetScale** (MySQL)
   - https://planetscale.com
   - Compatible con MySQL actual
   - Setup similar

3. **ElephantSQL** (PostgreSQL)
   - https://elephantsql.com
   - Más simple

4. **Railway** (PostgreSQL/MySQL)
   - https://railway.app
   - Incluye hosting del servidor

---

## ✨ Próximo paso

Una vez configurado Neon:
1. ✅ Reinicia servidor: `npm start`
2. ✅ Accede a: `http://localhost:3000/admin.html`
3. ✅ Deberías ver panel vacío (sin errores de BD)
4. ✅ Crea una solicitud test
5. ✅ Verifica que aparece en admin panel

¡Listo para producción! 🚀
