-- ========================================
-- MIGRACIÓN 003_POSTGRESQL: AGREGAR REFUND_STATUS
-- Para PostgreSQL/Neon en Render
-- ========================================

ALTER TABLE returns_requests 
ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32) DEFAULT 'pending_receipt';

-- Agregar constraint solo si no existe
ALTER TABLE returns_requests
ADD CONSTRAINT chk_refund_status CHECK (refund_status IN ('pending_receipt', 'pending_shipment'));
