-- ========================================
-- MIGRACIÓN 004: AGREGAR COLUMNA order_number
-- Base de datos: MON|BLEU Returns Portal
-- ========================================

-- Agregar columna order_number a returns_requests
ALTER TABLE returns_requests 
ADD COLUMN order_number VARCHAR(50) NULL AFTER order_id;

-- Crear índice para búsquedas frecuentes
CREATE INDEX idx_order_number ON returns_requests(order_number);
