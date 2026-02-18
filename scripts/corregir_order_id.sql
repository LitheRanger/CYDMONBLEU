-- Script SQL para corregir order_id en solicitudes antiguas
-- Reemplaza 'NUEVO_ORDER_ID' y 'ID_SOLICITUD' por los valores correctos

UPDATE returns_requests
SET order_id = 'NUEVO_ORDER_ID'
WHERE id = ID_SOLICITUD;

-- Ejemplo para varios casos:
-- UPDATE returns_requests SET order_id = '160800' WHERE id = 86;
-- UPDATE returns_requests SET order_id = '160801' WHERE id = 87;

-- Puedes ejecutar este script en tu gestor MySQL para corregir los registros antiguos.
