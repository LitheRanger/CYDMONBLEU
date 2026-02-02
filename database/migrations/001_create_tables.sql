-- ========================================
-- MIGRACIÓN 001: CREAR TABLAS PRINCIPALES
-- Base de datos: MON|BLEU Returns Portal
-- ========================================

-- 1. CREAR TABLA RETURNS_REQUESTS (compatible con server.js)
CREATE TABLE IF NOT EXISTS returns_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Identificadores
    order_id VARCHAR(64) NOT NULL,
    
    -- Cliente
    contact_email VARCHAR(255) NOT NULL,
    
    -- Devolución
    return_type VARCHAR(32) NOT NULL,
    items_json JSON NOT NULL,  -- [{ producto, talla_original, talla_cambio, cantidad, imagen_url }]
    files_json JSON,  -- [{ filename, url, uploaded_at }]
    
    -- Pago (Stripe)
    amount DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(32) DEFAULT 'pending',  -- pending, paid, failed
    stripe_session_id VARCHAR(255),
    
    -- Envío (FedEx)
    carrier VARCHAR(32),  -- FEDEX, UPS, etc.
    tracking_number VARCHAR(64),
    label_base64 MEDIUMTEXT,  -- PDF en base64
    label_mime VARCHAR(64) DEFAULT 'application/pdf',
    label_created_at TIMESTAMP NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Índices para búsquedas frecuentes
    INDEX idx_order_id (order_id),
    INDEX idx_contact_email (contact_email),
    INDEX idx_payment_status (payment_status),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_tracking_number (tracking_number),
    
    -- Constraints
    CONSTRAINT chk_payment_status CHECK (payment_status IN ('pending', 'paid', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. CREAR TABLA RETURNS_REQUEST_HISTORIAL
CREATE TABLE IF NOT EXISTS returns_request_historial (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    accion VARCHAR(50) NOT NULL,  -- aprobado, rechazado, pago_recibido, guia_generada, solicitud_creada
    usuario VARCHAR(50),
    nota TEXT,
    metadata JSON,  -- datos adicionales
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    CONSTRAINT fk_returns_request_historial_request_id 
        FOREIGN KEY (request_id) REFERENCES returns_requests(id) ON DELETE CASCADE,
    
    -- Índices
    INDEX idx_request_id (request_id),
    INDEX idx_fecha (fecha DESC),
    INDEX idx_accion (accion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. CREAR TABLA ADMINISTRADORES
CREATE TABLE IF NOT EXISTS administradores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(150),
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. CREAR TABLA LOGS
CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(50),  -- info, warning, error, debug
    mensaje TEXT,
    datos JSON,
    usuario_id INT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_tipo (tipo),
    INDEX idx_created_at (created_at DESC),
    INDEX idx_usuario_id (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
