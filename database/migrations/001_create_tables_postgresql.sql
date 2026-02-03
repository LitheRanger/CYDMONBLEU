-- ========================================
-- MIGRACIÓN PARA POSTGRESQL (Neon/Cloud)
-- Compatible con returns_requests
-- ========================================

-- 1. CREAR TABLA RETURNS_REQUESTS (PostgreSQL)
CREATE TABLE IF NOT EXISTS returns_requests (
    id SERIAL PRIMARY KEY,
    
    -- Identificadores
    order_id VARCHAR(64) NOT NULL,
    
    -- Cliente
    contact_email VARCHAR(255) NOT NULL,
    
    -- Devolución
    return_type VARCHAR(32) NOT NULL,
    items_json JSONB NOT NULL,  -- JSONB en PostgreSQL
    files_json JSONB,
    
    -- Pago (Stripe)
    amount DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(32) DEFAULT 'pending',
    stripe_session_id VARCHAR(255),
    admin_status VARCHAR(32) DEFAULT 'open',
    refund_status VARCHAR(32) DEFAULT 'pending_receipt',
    
    -- Envío (FedEx)
    carrier VARCHAR(32),
    tracking_number VARCHAR(64),
    label_base64 TEXT,  -- TEXT en PostgreSQL
    label_mime VARCHAR(64) DEFAULT 'application/pdf',
    label_created_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_payment_status CHECK (payment_status IN ('pending', 'paid', 'failed')),
    CONSTRAINT chk_refund_status CHECK (refund_status IN ('pending_receipt', 'pending_shipment'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_order_id ON returns_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_contact_email ON returns_requests(contact_email);
CREATE INDEX IF NOT EXISTS idx_payment_status ON returns_requests(payment_status);
CREATE INDEX IF NOT EXISTS idx_created_at ON returns_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_number ON returns_requests(tracking_number);

-- 2. CREAR TABLA HISTORIAL
CREATE TABLE IF NOT EXISTS returns_request_historial (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL,
    accion VARCHAR(50) NOT NULL,
    usuario VARCHAR(50),
    nota TEXT,
    metadata JSONB,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    CONSTRAINT fk_returns_request_historial_request_id 
        FOREIGN KEY (request_id) REFERENCES returns_requests(id) ON DELETE CASCADE
);

-- Índices historial
CREATE INDEX IF NOT EXISTS idx_historial_request_id ON returns_request_historial(request_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON returns_request_historial(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_historial_accion ON returns_request_historial(accion);

-- 3. TABLA ADMINISTRADORES
CREATE TABLE IF NOT EXISTS administradores (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(150),
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices administradores
CREATE INDEX IF NOT EXISTS idx_admin_username ON administradores(username);
CREATE INDEX IF NOT EXISTS idx_admin_email ON administradores(email);
CREATE INDEX IF NOT EXISTS idx_admin_activo ON administradores(activo);

-- 4. TABLA LOGS
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50),
    mensaje TEXT,
    datos JSONB,
    usuario_id INTEGER,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices logs
CREATE INDEX IF NOT EXISTS idx_logs_tipo ON logs(tipo);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_id ON logs(usuario_id);
