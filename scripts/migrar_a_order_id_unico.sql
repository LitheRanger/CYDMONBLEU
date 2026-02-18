-- MIGRACIÓN: returns_requests solo usa order_id y order_number de Shopify
-- 1. Renombrar la columna id (si quieres conservar respaldo)
ALTER TABLE returns_requests RENAME COLUMN id TO old_id;

-- 2. Asegurarse de que order_id es único y no nulo
ALTER TABLE returns_requests MODIFY order_id VARCHAR(64) NOT NULL;
ALTER TABLE returns_requests ADD UNIQUE (order_id);

-- 3. Agregar columna order_number si no existe
ALTER TABLE returns_requests ADD COLUMN IF NOT EXISTS order_number VARCHAR(64);

-- 4. Hacer order_id la clave primaria
ALTER TABLE returns_requests DROP PRIMARY KEY, ADD PRIMARY KEY (order_id);

-- 5. Actualizar referencias en returns_request_historial
ALTER TABLE returns_request_historial CHANGE request_id order_id VARCHAR(64);
ALTER TABLE returns_request_historial ADD CONSTRAINT fk_historial_order_id FOREIGN KEY (order_id) REFERENCES returns_requests(order_id) ON DELETE CASCADE;

-- 6. (Opcional) Eliminar columna old_id si ya no se necesita
-- ALTER TABLE returns_requests DROP COLUMN old_id;

-- 7. (Opcional) Eliminar índices antiguos relacionados a id
-- DROP INDEX idx_request_id ON returns_request_historial;

-- 8. (Opcional) Eliminar constraint antigua de historial
-- ALTER TABLE returns_request_historial DROP FOREIGN KEY fk_returns_request_historial_request_id;

-- 9. (Opcional) Eliminar columna id de historial si ya no se necesita
-- ALTER TABLE returns_request_historial DROP COLUMN id;

-- NOTA: order_number se usará solo para mostrar en la UI/admin y búsquedas de usuario.
-- order_id será el identificador único y clave primaria en la base de datos y backend.
