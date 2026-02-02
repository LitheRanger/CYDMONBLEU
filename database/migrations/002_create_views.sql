-- ========================================
-- MIGRACIÓN 002: CREAR VISTAS ÚTILES
-- ========================================

-- Vista: Resumen de solicitudes activas
CREATE OR REPLACE VIEW return_requests_summary AS
SELECT 
    rr.id,
    rr.request_id,
    rr.order_id,
    rr.contact_name,
    rr.contact_email,
    rr.return_type,
    rr.estado,
    rr.payment_status,
    rr.amount,
    rr.tracking_number,
    rr.created_at,
    rr.updated_at,
    (SELECT COUNT(*) FROM return_request_historial WHERE request_id = rr.id) as evento_count
FROM return_requests rr
ORDER BY rr.created_at DESC;

-- Vista: Solicitudes pagadas pero no enviadas
CREATE OR REPLACE VIEW pending_shipments AS
SELECT 
    rr.id,
    rr.request_id,
    rr.order_id,
    rr.contact_name,
    rr.contact_email,
    rr.amount,
    rr.payment_status,
    rr.tracking_number,
    rr.created_at,
    DATEDIFF(NOW(), rr.created_at) as dias_desde_creacion
FROM return_requests rr
WHERE rr.payment_status = 'paid' 
  AND rr.tracking_number IS NULL
ORDER BY rr.created_at ASC;

-- Vista: Reporte de ingresos por mes
CREATE OR REPLACE VIEW monthly_revenue AS
SELECT 
    DATE_FORMAT(rr.created_at, '%Y-%m') as mes,
    COUNT(*) as total_solicitudes,
    COUNT(CASE WHEN rr.payment_status = 'paid' THEN 1 END) as pagadas,
    SUM(CASE WHEN rr.payment_status = 'paid' THEN rr.amount ELSE 0 END) as ingresos_totales,
    AVG(CASE WHEN rr.payment_status = 'paid' THEN rr.amount ELSE 0 END) as promedio_pago
FROM return_requests rr
GROUP BY DATE_FORMAT(rr.created_at, '%Y-%m')
ORDER BY mes DESC;
