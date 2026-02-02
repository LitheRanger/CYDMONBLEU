-- ========================================
-- SEED: Crear usuario administrador por defecto
-- ========================================

-- IMPORTANTE: Cambiar la contraseña antes de usar en producción
-- Contraseña por defecto: admin123456

INSERT INTO administradores (username, email, password_hash, nombre, activo)
VALUES (
    'admin',
    'admin@monbleu.com',
    '$2b$10$YOixZH.k0X.Hy0HM0JQPH.QxGZmblF0b2Q5HLPHPaXP0w3QjLAJ1G',  -- hash de bcrypt para 'admin123456'
    'Administrador Principal',
    TRUE
) ON DUPLICATE KEY UPDATE activo = TRUE;

-- Comando para generar nuevos hashes bcrypt en Node.js:
-- const bcrypt = require('bcrypt');
-- bcrypt.hash('tu_contraseña', 10).then(hash => console.log(hash));
