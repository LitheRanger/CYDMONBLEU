-- ========================================
-- MIGRACIÓN: GESTORCYDMONBLEU MEJORADO
-- De: Solicitud (simple) 
-- A: ReturnRequest (con Stripe + FedEx)
-- ========================================

-- 1. CREAR TABLA NUEVA (O RENOMBRAR SI EXISTE)
-- Si la tabla 'solicitud' ya existe, hacer:
-- ALTER TABLE solicitud RENAME TO solicitud_legacy;
-- ALTER TABLE solicitud_historial RENAME TO solicitud_historial_legacy;

-- 2. CREAR TABLA RETURN_REQUESTS (si no existe)
CREATE TABLE IF NOT EXISTS return_requests (
    id SERIAL PRIMARY KEY,
    
    -- Identificadores
    request_id VARCHAR(50) UNIQUE NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    
    -- Cliente
    contact_name VARCHAR(150),
    contact_email VARCHAR(150),
    contact_phone VARCHAR(20),
    
    -- Devolución
    return_type VARCHAR(20),  -- cambio, devolucion
    items_json JSONB,  -- [{ producto, talla_original, talla_cambio, cantidad, imagen_url }]
    files_json JSONB,  -- [{ filename, url, uploaded_at }]
    razon TEXT,
    
    -- Pago (Stripe)
    amount NUMERIC(10, 2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'pending',  -- pending, paid, failed
    stripe_session_id VARCHAR(150),
    
    -- Envío (FedEx)
    carrier VARCHAR(50),  -- FEDEX, UPS, etc.
    tracking_number VARCHAR(50),
    label_base64 TEXT,  -- PDF en base64
    label_mime VARCHAR(50) DEFAULT 'application/pdf',
    label_created_at TIMESTAMP,
    
    -- Workflow
    estado VARCHAR(20) DEFAULT 'pendiente',  -- pendiente, aprobado, rechazado
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices para búsquedas frecuentes
    CONSTRAINT fk_return_requests_payment CHECK (payment_status IN ('pending', 'paid', 'failed')),
    CONSTRAINT fk_return_requests_estado CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'))
);

CREATE INDEX idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX idx_return_requests_payment_status ON return_requests(payment_status);
CREATE INDEX idx_return_requests_estado ON return_requests(estado);
CREATE INDEX idx_return_requests_created_at ON return_requests(created_at DESC);
CREATE INDEX idx_return_requests_tracking ON return_requests(tracking_number) WHERE tracking_number IS NOT NULL;

-- 3. CREAR TABLA RETURN_REQUEST_HISTORIAL
CREATE TABLE IF NOT EXISTS return_request_historial (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
    accion VARCHAR(50) NOT NULL,  -- aprobado, rechazado, pago_recibido, guia_generada, solicitud_creada
    usuario VARCHAR(50),
    nota TEXT,
    metadata JSONB,  -- datos adicionales
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_return_request_historial_request_id ON return_request_historial(request_id);
CREATE INDEX idx_return_request_historial_fecha ON return_request_historial(fecha DESC);
CREATE INDEX idx_return_request_historial_accion ON return_request_historial(accion);

-- 4. MIGRACIÓN DE DATOS (si tienes datos en tablas antiguas)
-- DESCOMENTA Y ADAPTA SI NECESARIO:
/*
INSERT INTO return_requests (
    request_id, order_id, contact_name, contact_email, return_type, 
    items_json, razon, estado, created_at, updated_at
)
SELECT 
    request_id, 
    pedido_id,
    cliente_nombre,
    cliente_email,
    tipo,
    raw_data->'items',
    razon,
    estado,
    created_at,
    updated_at
FROM solicitud_legacy;

INSERT INTO return_request_historial (request_id, accion, usuario, nota, fecha)
SELECT 
    (SELECT id FROM return_requests WHERE request_id = solicitud_historial_legacy.solicitud_id::text),
    accion,
    usuario,
    nota,
    fecha
FROM solicitud_historial_legacy;
*/

-- 5. USUARIO TABLE (si no existe)
CREATE TABLE IF NOT EXISTS usuario (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL DEFAULT 'soporte'  -- admin, soporte
);

-- 6. CREAR USUARIOS DE DEMO (si no existen)
-- INSERT INTO usuario (usuario, password_hash, rol)
-- VALUES ('admin', 'pbkdf2:sha256:...',  'admin'),
--        ('soporte', 'pbkdf2:sha256:...', 'soporte');

-- 7. LIMPIAR TABLAS ANTIGUAS (OPCIONAL - DESPUÉS DE VERIFICAR)
-- DROP TABLE IF EXISTS solicitud_historial_legacy;
-- DROP TABLE IF EXISTS solicitud_legacy;

-- ========================================
-- VERIFICACIÓN
-- ========================================
-- SELECT * FROM return_requests LIMIT 5;
-- SELECT * FROM return_request_historial LIMIT 5;
-- SELECT * FROM usuario;
