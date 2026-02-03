-- ========================================
-- MIGRACIÓN 003: AGREGAR REFUND_STATUS
-- Añade soporte para gestión de devoluciones
-- ========================================

-- Para PostgreSQL/Neon
-- Si estás en PostgreSQL, ejecuta esto:
-- ALTER TABLE returns_requests 
-- ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32) DEFAULT 'pending_receipt';

-- ALTER TABLE returns_requests
-- ADD CONSTRAINT chk_refund_status CHECK (refund_status IN ('pending_receipt', 'pending_shipment'));

-- Para MySQL, ejecuta esto:
ALTER TABLE returns_requests 
ADD COLUMN refund_status VARCHAR(32) DEFAULT 'pending_receipt' 
AFTER admin_status;

ALTER TABLE returns_requests
ADD CONSTRAINT chk_refund_status CHECK (refund_status IN ('pending_receipt', 'pending_shipment'));
