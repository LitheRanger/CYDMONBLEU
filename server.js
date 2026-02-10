require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');
const pino = require('pino');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const sgMail = require('@sendgrid/mail');

// Detectar si es PostgreSQL o MySQL
const isPostgreSQL = (process.env.DATABASE_URL || '').includes('postgresql://');
const db = isPostgreSQL ? require('pg').Pool : require('mysql2/promise');

// MercadoPago (se inicializa si está configurado)
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const mpAccessToken = process.env.MP_ACCESS_TOKEN || '';
const mpEnv = String(process.env.MP_ENV || 'sandbox').toLowerCase();
const mpClient = mpAccessToken ? new MercadoPagoConfig({ accessToken: mpAccessToken }) : null;
const mpPreference = mpClient ? new Preference(mpClient) : null;
const mpPayment = mpClient ? new Payment(mpClient) : null;
const mpWebhookSecret = process.env.MP_WEBHOOK_SECRET || '';
const mpWebhookVerify = String(process.env.MP_WEBHOOK_VERIFY || 'true').toLowerCase() !== 'false';

const sendgridApiKey = process.env.SENDGRID_API_KEY || '';
const sendgridFrom = process.env.SENDGRID_FROM || '';
if (sendgridApiKey) {
    sgMail.setApiKey(sendgridApiKey);
}

// Importamos tu cliente robusto de Shopify
const shopifyClient = require('./Shopifyclient.js');
const myeshipClient = require('./myeshipClient.js');

const app = express();
app.use(cors());

const cloudinaryConfigured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
}

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
app.use(pinoHttp({ logger }));

const metrics = {
    requests: 0,
    errors: 0,
    totalMs: 0
};

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        metrics.requests += 1;
        metrics.totalMs += Date.now() - start;
        if (res.statusCode >= 500) {
            metrics.errors += 1;
        }
    });
    next();
});

// JSON parser para todas las rutas
app.use(express.json());

// --- ADMIN BASIC AUTH ---
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;

function requireAdmin(req, res, next) {
    if (!ADMIN_USER || !ADMIN_PASS) {
        return res.status(500).json({ success: false, message: 'Admin no configurado' });
    }

    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="Admin"');
        return res.status(401).send('Auth required');
    }

    const base64 = auth.replace('Basic ', '');
    const [user, pass] = Buffer.from(base64, 'base64').toString('utf8').split(':');

    if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
        res.set('WWW-Authenticate', 'Basic realm="Admin"');
        return res.status(401).send('Invalid credentials');
    }

    next();
}

// --- DB CONFIG ---
const dbDisabled = String(process.env.DISABLE_DB || '').toLowerCase() === 'true';

let dbPool = null;

if (!dbDisabled) {
    if (isPostgreSQL) {
        // PostgreSQL (Neon)
        dbPool = new db({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
    } else {
        // MySQL local
        const mysql = require('mysql2/promise');
        const hasDbConfig = !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
        if (hasDbConfig) {
            dbPool = mysql.createPool({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME,
                port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
        }
    }
}

async function initDb() {
    if (!dbPool) return;
    
    try {
        if (isPostgreSQL) {
            // PostgreSQL - verificar que las tablas existan
            const result = await dbPool.query(
                `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='returns_requests')`
            );
            if (result.rows[0].exists) {
                // Agregar columna admin_status si no existe
                await dbPool.query(
                    `ALTER TABLE returns_requests ADD COLUMN IF NOT EXISTS admin_status VARCHAR(32) DEFAULT 'open'`
                );
                // Agregar columna refund_status si no existe
                await dbPool.query(
                    `ALTER TABLE returns_requests ADD COLUMN IF NOT EXISTS refund_status VARCHAR(32) DEFAULT 'pending_receipt'`
                );
                // Agregar columnas de pago si no existen
                await dbPool.query(
                    `ALTER TABLE returns_requests ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(32) DEFAULT 'mercadopago'`
                );
                await dbPool.query(
                    `ALTER TABLE returns_requests ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255) NULL`
                );
                await dbPool.query(
                    `ALTER TABLE returns_requests ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) NULL`
                );
                await dbPool.query(
                    `ALTER TABLE returns_requests ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(64) NULL`
                );
                await dbPool.query(
                    `ALTER TABLE returns_requests ADD COLUMN IF NOT EXISTS coupon_amount DECIMAL(10,2) NULL`
                );
                await dbPool.query(
                    `ALTER TABLE returns_requests ADD COLUMN IF NOT EXISTS coupon_sent_at TIMESTAMP NULL`
                );
                await dbPool.query(
                    `ALTER TABLE returns_requests ADD COLUMN IF NOT EXISTS change_sent_at TIMESTAMP NULL`
                );
                await dbPool.query(
                    `ALTER TABLE returns_requests DROP COLUMN IF EXISTS stripe_session_id`
                );
                console.log('✅ DB lista: tabla returns_requests verificada (PostgreSQL)');
            } else {
                console.warn('⚠️ Tabla returns_requests no existe en PostgreSQL - ejecuta migración en Neon');
            }
        } else {
            // MySQL
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS returns_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    order_id VARCHAR(64) NOT NULL,
                    contact_email VARCHAR(255) NOT NULL,
                    return_type VARCHAR(32) NOT NULL,
                    items_json JSON NOT NULL,
                    files_json JSON NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    payment_status VARCHAR(32) DEFAULT 'pending',
                    payment_provider VARCHAR(32) DEFAULT 'mercadopago',
                    payment_reference VARCHAR(255) NULL,
                    customer_name VARCHAR(255) NULL,
                    coupon_code VARCHAR(64) NULL,
                    coupon_amount DECIMAL(10,2) NULL,
                    coupon_sent_at TIMESTAMP NULL,
                    change_sent_at TIMESTAMP NULL,
                    carrier VARCHAR(32) NULL,
                    tracking_number VARCHAR(64) NULL,
                    label_base64 MEDIUMTEXT NULL,
                    label_mime VARCHAR(64) NULL,
                    label_created_at TIMESTAMP NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `;
            await dbPool.execute(createTableSQL);
            // Agregar columna admin_status si no existe
            const [cols] = await dbPool.execute(
                `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, 'returns_requests', 'admin_status']
            );
            if (cols && cols[0] && cols[0].cnt === 0) {
                await dbPool.execute(
                    `ALTER TABLE returns_requests ADD COLUMN admin_status VARCHAR(32) DEFAULT 'open'`
                );
            }
            // Agregar columna refund_status si no existe
            const [refundCols] = await dbPool.execute(
                `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, 'returns_requests', 'refund_status']
            );
            if (refundCols && refundCols[0] && refundCols[0].cnt === 0) {
                await dbPool.execute(
                    `ALTER TABLE returns_requests ADD COLUMN refund_status VARCHAR(32) DEFAULT 'pending_receipt'`
                );
            }
            // Agregar columnas payment_provider y payment_reference si no existen
            const [payProviderCols] = await dbPool.execute(
                `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, 'returns_requests', 'payment_provider']
            );
            if (payProviderCols && payProviderCols[0] && payProviderCols[0].cnt === 0) {
                await dbPool.execute(
                    `ALTER TABLE returns_requests ADD COLUMN payment_provider VARCHAR(32) DEFAULT 'mercadopago'`
                );
            }
            const [payRefCols] = await dbPool.execute(
                `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, 'returns_requests', 'payment_reference']
            );
            if (payRefCols && payRefCols[0] && payRefCols[0].cnt === 0) {
                await dbPool.execute(
                    `ALTER TABLE returns_requests ADD COLUMN payment_reference VARCHAR(255) NULL`
                );
            }
            const [customerCols] = await dbPool.execute(
                `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, 'returns_requests', 'customer_name']
            );
            if (customerCols && customerCols[0] && customerCols[0].cnt === 0) {
                await dbPool.execute(
                    `ALTER TABLE returns_requests ADD COLUMN customer_name VARCHAR(255) NULL`
                );
            }
            const [stripeCols] = await dbPool.execute(
                `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, 'returns_requests', 'stripe_session_id']
            );
            if (stripeCols && stripeCols[0] && stripeCols[0].cnt > 0) {
                await dbPool.execute(
                    `ALTER TABLE returns_requests DROP COLUMN stripe_session_id`
                );
            }
            const [couponCodeCols] = await dbPool.execute(
                `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, 'returns_requests', 'coupon_code']
            );
            if (couponCodeCols && couponCodeCols[0] && couponCodeCols[0].cnt === 0) {
                await dbPool.execute(
                    `ALTER TABLE returns_requests ADD COLUMN coupon_code VARCHAR(64) NULL`
                );
            }
            const [couponAmountCols] = await dbPool.execute(
                `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, 'returns_requests', 'coupon_amount']
            );
            if (couponAmountCols && couponAmountCols[0] && couponAmountCols[0].cnt === 0) {
                await dbPool.execute(
                    `ALTER TABLE returns_requests ADD COLUMN coupon_amount DECIMAL(10,2) NULL`
                );
            }
            const [couponSentCols] = await dbPool.execute(
                `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, 'returns_requests', 'coupon_sent_at']
            );
            if (couponSentCols && couponSentCols[0] && couponSentCols[0].cnt === 0) {
                await dbPool.execute(
                    `ALTER TABLE returns_requests ADD COLUMN coupon_sent_at TIMESTAMP NULL`
                );
            }
            const [changeSentCols] = await dbPool.execute(
                `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [process.env.DB_NAME, 'returns_requests', 'change_sent_at']
            );
            if (changeSentCols && changeSentCols[0] && changeSentCols[0].cnt === 0) {
                await dbPool.execute(
                    `ALTER TABLE returns_requests ADD COLUMN change_sent_at TIMESTAMP NULL`
                );
            }
            console.log('✅ DB lista: tabla returns_requests verificada (MySQL)');
        }
    } catch (err) {
        console.error('❌ Error inicializando DB:', err.message);
    }
}

if (!dbDisabled) {
    // DB será inicializada en startServer()
} else {
    console.warn('⚠️ Base de datos desactivada temporalmente (DISABLE_DB=true)');
}

// Helper para abstraer diferencias entre MySQL y PostgreSQL
async function executeQuery(sql, params) {
    if (!dbPool) throw new Error('Database not configured');
    
    if (isPostgreSQL) {
        // Convertir ? a $1, $2, etc para PostgreSQL
        let pgSql = sql;
        let paramIndex = 1;
        pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);
        
        const result = await dbPool.query(pgSql, params);
        // Normalizar resultado para que sea compatible con MySQL
        return [result.rows, result.rowCount];
    } else {
        // MySQL - usar como está
        return await dbPool.execute(sql, params);
    }
}

// Servir archivos estáticos (HTML, CSS, JS desde la carpeta 'public')
app.use(express.static(path.join(__dirname, 'public')));
// Asegura que los assets del panel carguen bien bajo /admin (js, logo, fuentes)
app.use('/admin', requireAdmin, express.static(path.join(__dirname, 'public')));

// --- 1. CONFIGURACIÓN DE MULTER (Para subir fotos) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        // Creamos la carpeta si no existe
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Guardamos con fecha para evitar nombres duplicados
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        if ((file.mimetype || '').startsWith('image/')) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});

// Hacer pública la carpeta de uploads para poder ver las fotos
app.use('/uploads', express.static('uploads'));

// Ruta raíz para servir el index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Panel Admin (HTML)
app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// --- 2. ENDPOINT: VALIDAR ORDEN Y TRAER TALLAS ---
const validateOrderSchema = z.object({
    orderNumber: z.string().trim().min(1).max(50),
    email: z.string().trim().email().max(255)
});

const checkoutSchema = z.object({
    requestId: z.union([z.string(), z.number()]),
    amount: z.number().positive(),
    currency: z.string().trim().min(3).max(8).optional(),
    description: z.string().trim().max(255).optional(),
    orderId: z.union([z.string(), z.number()]),
    contactEmail: z.string().trim().email().max(255)
});

const limiterValidate = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const limiterSubmit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const limiterCheckout = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });

app.post('/api/validate-order', limiterValidate, async (req, res) => {
    const parsed = validateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            valid: false,
            message: 'Datos inválidos',
            errors: parsed.error.flatten()
        });
    }

    const { orderNumber, email } = parsed.data;

    // Validar parámetros requeridos
    if (!orderNumber || !email) {
        return res.status(400).json({ 
            valid: false, 
            message: 'Número de orden y email son requeridos' 
        });
    }

    try {
        // A. Buscar la orden
        const order = await shopifyClient.getOrder(orderNumber);

        if (!order) {
            return res.status(404).json({ valid: false, message: 'Orden no encontrada.' });
        }

        // B. Validación de Email/Teléfono (Normalización básica)
        const inputEmail = email.toLowerCase().trim();
        const orderEmail = (order.email || '').toLowerCase();
        const orderPhone = (order.phone || '').replace(/\D/g, ''); 
        const inputCleanPhone = email.replace(/\D/g, '');

        let match = (inputEmail === orderEmail);
        if (!match && inputCleanPhone.length > 6) {
             match = (orderPhone.includes(inputCleanPhone));
        }

        if (!match) {
            return res.status(401).json({ valid: false, message: 'El correo/teléfono no coincide.' });
        }

        // C. Validación de 30 días
        const orderDate = new Date(order.created_at);
        const diffDays = Math.ceil(Math.abs(new Date() - orderDate) / (1000 * 60 * 60 * 24));

        if (diffDays > 30) {
            return res.status(400).json({ 
                valid: false, 
                message: `La orden tiene ${diffDays} días. El límite es 30.` 
            });
        }

        // D. ENRIQUECER ITEMS (Esto es para el Modal de Tallas)
        // Recorremos los productos comprados y buscamos sus variantes (S, M, L) en Shopify
        const itemsWithVariants = await Promise.all(order.line_items.map(async (item) => {
            let availableVariants = [];
            let productImage = null;
            let optionNames = [];

            if (item.product_id) {
                // Usamos el nuevo método de tu cliente para traer detalles
                const product = await shopifyClient.getProductDetails(item.product_id);
                
                if (product) {
                    // Mapeamos las variantes disponibles
                    availableVariants = product.variants.map(v => ({
                        id: v.id,
                        title: v.title, // Ej: "S", "M / Negro"
                        inventory: v.inventory_quantity,
                        option1: v.option1 || null,
                        option2: v.option2 || null,
                        option3: v.option3 || null
                    }));

                    optionNames = Array.isArray(product.options)
                        ? product.options.map(o => o.name).filter(Boolean)
                        : [];
                    
                    // Intentamos obtener la imagen principal
                    if(product.image && product.image.src) {
                        productImage = product.image.src;
                    }
                }
            }

            return {
                id: item.variant_id,        // ID de lo que compró
                product_id: item.product_id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                current_variant_title: item.variant_title,
                image: productImage,        // URL de la imagen para el modal
                available_variants: availableVariants, // LISTA DE TALLAS/COLORES PARA EL MODAL
                option_names: optionNames
            };
        }));

        // E. Respuesta Exitosa
        let orderTotal = Number(order.total_price || order.current_total_price || 0);
        if (!orderTotal && Array.isArray(order.line_items)) {
            orderTotal = order.line_items.reduce((sum, item) => {
                const qty = Number(item.quantity || 0);
                const price = Number(item.price || 0);
                return sum + (qty * price);
            }, 0);
        }

        res.json({
            valid: true,
            orderId: order.id,
            orderNumber: order.name,
            customer: order.customer ? order.customer.first_name : 'Cliente',
            orderTotal,
            orderCurrency: order.currency || order.presentment_currency || 'MXN',
            items: itemsWithVariants // Enviamos los items enriquecidos
        });

    } catch (error) {
        console.error("Error validando orden:", error);
        res.status(500).json({ message: 'Error interno conectando con Shopify' });
    }
});


// --- 3. ENDPOINT: PROCESAR SELECCIÓN ---
// upload.any() permite recibir múltiples archivos con cualquier nombre de campo
app.post('/api/submit-return', limiterSubmit, upload.any(), async (req, res) => {
    try {
        console.log("📦 Recibiendo solicitud...");

        // Datos del formulario
        const submitParsed = z.object({
            orderId: z.string().trim().min(1).max(64),
            contactEmail: z.string().trim().email().max(255),
            returnType: z.string().trim().min(1).max(32),
            customerName: z.string().trim().min(1).max(255).optional()
        }).safeParse(req.body);

        if (!submitParsed.success) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos',
                errors: submitParsed.error.flatten()
            });
        }

        const { orderId, contactEmail, returnType, customerName } = submitParsed.data;
        
        // Los items vienen como string JSON, hay que parsearlos
        let items = [];
        try {
            items = JSON.parse(req.body.items || "[]");
        } catch (e) {
            return res.status(400).json({ success: false, message: "Error en formato de items" });
        }

        const itemsParsed = z.array(z.object({
            reason: z.string().trim().min(1).max(64),
            variantId: z.any().optional(),
            quantity: z.any().optional(),
            price: z.any().optional()
        })).safeParse(items);

        if (!itemsParsed.success) {
            return res.status(400).json({ success: false, message: 'Items inválidos', errors: itemsParsed.error.flatten() });
        }

        const files = req.files || []; // Array con las fotos subidas

        const isDefectRequest = items.length > 0 && items.some(i => String(i.reason || '').toLowerCase() === 'defecto');

        // Lógica de Precio: TARIFA PLANA $150 (excepto cuando hay defecto)
        const amountToPay = isDefectRequest ? 0 : 150; 

        // Validación básica
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "No hay items seleccionados" });
        }

        console.log(`> Orden: ${orderId}`);
        console.log(`> Tipo: ${returnType}`);
        console.log(`> Items: ${items.length}`);
        console.log(`> Fotos: ${files.length}`);

        if (!dbPool) {
            return res.status(503).json({
                success: false,
                message: dbDisabled
                    ? "Base de datos desactivada temporalmente. Intenta más tarde."
                    : "Base de datos no configurada. Revisa DB_HOST/DB_USER/DB_NAME en tu .env"
            });
        }

        // Permitir órdenes duplicadas (validación desactivada temporalmente)

        // Guardar en DB
        const filesMeta = await Promise.all((files || []).map(async (f) => {
            let dataUrl = null;
            let cloudinaryUrl = null;
            try {
                if (f.path && f.mimetype) {
                    if (cloudinaryConfigured) {
                        const uploadResult = await cloudinary.uploader.upload(f.path, {
                            folder: 'monbleu-returns',
                            resource_type: 'image'
                        });
                        cloudinaryUrl = uploadResult?.secure_url || uploadResult?.url || null;
                    } else {
                        const fileBuffer = await fs.promises.readFile(f.path);
                        const base64 = fileBuffer.toString('base64');
                        dataUrl = `data:${f.mimetype};base64,${base64}`;
                    }
                }
            } catch (e) {
                console.warn('⚠️ No se pudo leer archivo para base64:', e?.message || e);
            }

            if (cloudinaryConfigured && f.path) {
                try {
                    await fs.promises.unlink(f.path);
                } catch (e) {
                    console.warn('⚠️ No se pudo borrar archivo temporal:', e?.message || e);
                }
            }

            return {
                fieldname: f.fieldname,
                originalname: f.originalname,
                filename: f.filename,
                mimetype: f.mimetype,
                size: f.size,
                path: String(f.path || '').replace(/\\/g, '/'),
                url: `/uploads/${f.filename}`,
                cloudinaryUrl,
                dataUrl
            };
        }));

          const insertSQL = isPostgreSQL 
                ? `INSERT INTO returns_requests (order_id, contact_email, customer_name, return_type, items_json, files_json, amount)
                    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
                : `INSERT INTO returns_requests (order_id, contact_email, customer_name, return_type, items_json, files_json, amount)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`;
        
        const [result] = await executeQuery(insertSQL, [
            String(orderId || ''),
            String(contactEmail || ''),
                String(customerName || ''),
            String(returnType || ''),
            JSON.stringify(items),
            JSON.stringify(filesMeta),
            amountToPay
        ]);

        const requestId = isPostgreSQL ? result[0]?.id : result.insertId;

        if (isDefectRequest && requestId) {
            try {
                await executeQuery(
                    `UPDATE returns_requests SET payment_status = 'pending' WHERE id = ?`,
                    [requestId]
                );

                if (myeshipClient.isConfigured()) {
                    let order = await shopifyClient.getOrderById(orderId);
                    if (!order) {
                        const rawOrderId = String(orderId || '').trim();
                        const orderName = rawOrderId.startsWith('#') ? rawOrderId : `#${rawOrderId}`;
                        order = await shopifyClient.getOrder(orderName) || await shopifyClient.getOrder(rawOrderId);
                    }
                    if (order && order.shipping_address) {
                        const label = await myeshipClient.createReturnLabel({ order, requestId });
                        if (label && label.trackingNumber) {
                            const now = new Date().toISOString();
                            await executeQuery(
                                `UPDATE returns_requests SET carrier = 'MYESHIP', tracking_number = ?, label_base64 = ?, label_mime = ?, label_created_at = ? WHERE id = ?`,
                                [label.trackingNumber, label.labelBase64, label.labelMime, now, requestId]
                            );
                            console.log(`📦 Guía MyeShip generada (defecto): ${label.trackingNumber}`);
                        }
                    }
                }
            } catch (defectErr) {
                console.error('❌ Error procesando defecto sin pago:', defectErr.message || defectErr);
            }
        }

        // Respuesta al Frontend
        res.json({
            success: true,
            message: "Solicitud procesada",
            requestId: requestId,
            nextStep: "PAYMENT",
            paymentDetails: {
                amount: amountToPay,
                currency: "MXN",
                description: `Guía de devolución - Orden ${orderId}`
            },
            skipPayment: isDefectRequest
        });

    } catch (error) {
        console.error("Error procesando submit:", error);
        
        // Errores específicos de DB
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(500).json({ 
                success: false, 
                message: "Error de base de datos: tabla no existe. Verifica la configuración." 
            });
        }
        
        if (error.code === 'ECONNREFUSED') {
            return res.status(500).json({ 
                success: false, 
                message: "No se puede conectar a la base de datos. Verifica que MySQL esté corriendo." 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: "Error interno del servidor",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

async function resolveOrderForLabel(orderId) {
    if (!orderId) return null;
    let order = await shopifyClient.getOrderById(orderId);
    if (!order) {
        const rawOrderId = String(orderId || '').trim();
        const orderName = rawOrderId.startsWith('#') ? rawOrderId : `#${rawOrderId}`;
        order = await shopifyClient.getOrder(orderName) || await shopifyClient.getOrder(rawOrderId);
    }
    return order || null;
}

async function handleApprovedPayment({ requestId, orderId, paymentId }) {
    if (!dbPool || !requestId) return;

    const [rows] = await executeQuery(
        `SELECT order_id, tracking_number FROM returns_requests WHERE id = ? LIMIT 1`,
        [requestId]
    );
    const storedOrderId = rows && rows[0] ? rows[0].order_id : null;
    const finalOrderId = orderId || storedOrderId;

    await executeQuery(
        `UPDATE returns_requests SET payment_status = 'paid', payment_provider = 'mercadopago', payment_reference = ? WHERE id = ?`,
        [String(paymentId || ''), requestId]
    );

    if (rows && rows[0] && rows[0].tracking_number) {
        return;
    }

    if (myeshipClient.isConfigured()) {
        try {
            const order = await resolveOrderForLabel(finalOrderId);
            if (!order) {
                console.warn('⚠️ No se pudo obtener la orden para generar guía');
                return;
            }
            const label = await myeshipClient.createReturnLabel({ order, requestId });
            if (label && label.trackingNumber) {
                const now = new Date().toISOString();
                await executeQuery(
                    `UPDATE returns_requests SET carrier = 'MYESHIP', tracking_number = ?, label_base64 = ?, label_mime = ?, label_created_at = ? WHERE id = ?`,
                    [label.trackingNumber, label.labelBase64, label.labelMime, now, requestId]
                );
                console.log(`📦 Guía MyeShip generada: ${label.trackingNumber} (${label.provider} - ${label.serviceName})`);
            } else {
                console.warn('⚠️ MyeShip respondió sin tracking');
            }
        } catch (labelErr) {
            console.error('❌ Error generando guía MyeShip:', labelErr.message || labelErr);
        }
    } else {
        console.warn('ℹ️ MyeShip no configurado: no se generó guía');
    }
}

async function handleFailedPayment({ requestId, paymentId }) {
    if (!dbPool || !requestId) return;
    await executeQuery(
        `UPDATE returns_requests SET payment_status = 'failed', payment_provider = 'mercadopago', payment_reference = ? WHERE id = ?`,
        [String(paymentId || ''), requestId]
    );
}

function parseMpSignature(signatureHeader) {
    if (!signatureHeader) return null;
    const parts = String(signatureHeader)
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
    const signature = {};
    parts.forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) signature[key] = value;
    });
    if (!signature.ts || !signature.v1) return null;
    return signature;
}

function sanitizeSignatureValue(value, size = 8) {
    if (!value) return '';
    const str = String(value);
    return str.length <= size ? str : `${str.slice(0, size)}…`;
}

function verifyMpSignature(req) {
    if (!mpWebhookVerify) {
        return { ok: true, reason: 'verify_disabled' };
    }
    if (!mpWebhookSecret) {
        return { ok: false, reason: 'missing_secret' };
    }
    const signatureHeader = req.headers['x-signature'] || req.headers['X-Signature'];
    const requestId = req.headers['x-request-id'] || req.headers['X-Request-Id'];
    const signature = parseMpSignature(signatureHeader);
    const dataId = req.body?.data?.id || req.body?.id || req.query?.data?.id || req.query?.id;

    if (!signature || !requestId || !dataId) {
        return {
            ok: false,
            reason: 'missing_signature_fields',
            debug: {
                requestId,
                dataId,
                signatureHeader: sanitizeSignatureValue(signatureHeader, 24)
            }
        };
    }

    const signedPayload = `id:${dataId};request-id:${requestId};ts:${signature.ts};`;
    const expected = crypto
        .createHmac('sha256', mpWebhookSecret)
        .update(signedPayload)
        .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(signature.v1, 'hex');
    if (expectedBuf.length !== providedBuf.length) {
        return {
            ok: false,
            reason: 'signature_mismatch',
            debug: {
                requestId,
                dataId,
                ts: signature.ts,
                v1: sanitizeSignatureValue(signature.v1)
            }
        };
    }
    const ok = crypto.timingSafeEqual(expectedBuf, providedBuf);
    return {
        ok,
        reason: ok ? '' : 'signature_mismatch',
        debug: ok ? undefined : {
            requestId,
            dataId,
            ts: signature.ts,
            v1: sanitizeSignatureValue(signature.v1)
        }
    };
}

function getPaymentValue(payment, key, fallback) {
    if (!payment) return fallback;
    if (payment[key] !== undefined) return payment[key];
    if (payment.body && payment.body[key] !== undefined) return payment.body[key];
    return fallback;
}

async function getExpectedAmount(requestId) {
    if (!dbPool || !requestId) return null;
    const [rows] = await executeQuery(
        `SELECT amount FROM returns_requests WHERE id = ? LIMIT 1`,
        [requestId]
    );
    if (!rows || !rows[0]) return null;
    return Number(rows[0].amount || 0);
}

async function validatePaymentAmount({ requestId, payment }) {
    const expected = await getExpectedAmount(requestId);
    if (expected === null) {
        return { ok: false, reason: 'request_not_found' };
    }

    const paid = Number(getPaymentValue(payment, 'transaction_amount', 0));
    if (!Number.isFinite(paid)) {
        return { ok: false, reason: 'invalid_amount' };
    }

    const currency = String(getPaymentValue(payment, 'currency_id', 'MXN')).toUpperCase();
    if (currency && currency !== 'MXN') {
        return { ok: false, reason: `invalid_currency_${currency}` };
    }

    if (Math.abs(paid - expected) > 0.01) {
        return { ok: false, reason: `amount_mismatch_${paid}_${expected}` };
    }

    return { ok: true };
}

// --- 4. MERCADOPAGO PREFERENCE ---
app.post('/api/create-mp-preference', limiterCheckout, async (req, res) => {
    try {
        const parsed = checkoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: 'Datos inválidos',
                errors: parsed.error.flatten()
            });
        }

        const { requestId, amount, currency, description, orderId, contactEmail } = parsed.data;

        if (!mpPreference) {
            return res.status(500).json({
                success: false,
                message: 'MercadoPago no configurado. Agrega MP_ACCESS_TOKEN en .env'
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El monto debe ser mayor a 0'
            });
        }

        const rawBaseUrl = process.env.PUBLIC_BASE_URL || req.headers.origin || 'http://localhost:3000';
        let baseUrl = rawBaseUrl;
        try {
            baseUrl = new URL(rawBaseUrl).origin;
        } catch (error) {
            try {
                baseUrl = new URL(`http://${rawBaseUrl}`).origin;
            } catch (innerError) {
                baseUrl = 'http://localhost:3000';
            }
        }

        const preferenceBody = {
            items: [
                {
                    title: 'Guía de Devolución MON|BLEU',
                    description: description || `Guía para orden ${orderId}`,
                    quantity: 1,
                    unit_price: Number(amount),
                    currency_id: (currency || 'MXN').toUpperCase()
                }
            ],
            payer: {
                email: contactEmail
            },
            back_urls: {
                success: `${baseUrl}/success.html`,
                failure: `${baseUrl}/cancel.html`,
                pending: `${baseUrl}/success.html`
            },
            auto_return: 'approved',
            external_reference: String(requestId),
            metadata: {
                requestId: String(requestId),
                orderId: String(orderId),
                contactEmail: String(contactEmail)
            },
            notification_url: `${baseUrl}/api/mp-webhook`
        };

        const preference = await mpPreference.create({ body: preferenceBody });
        const prefId = preference?.id || preference?.body?.id;
        const initPoint = preference?.init_point || preference?.body?.init_point;
        const sandboxInit = preference?.sandbox_init_point || preference?.body?.sandbox_init_point;

        if (dbPool && requestId) {
            await executeQuery(
                `UPDATE returns_requests SET payment_provider = 'mercadopago', payment_reference = ? WHERE id = ?`,
                [String(prefId || ''), requestId]
            );
        }

        res.json({
            success: true,
            preferenceId: prefId,
            checkoutUrl: mpEnv === 'sandbox' ? sandboxInit : initPoint,
            checkoutUrlSandbox: sandboxInit,
            checkoutUrlLive: initPoint
        });
    } catch (error) {
        console.error('Error creando preferencia MP:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error al crear preferencia de pago'
        });
    }
});

// --- 5. MERCADOPAGO WEBHOOK ---
app.post('/api/mp-webhook', async (req, res) => {
    try {
        const signatureCheck = verifyMpSignature(req);
        if (!signatureCheck.ok) {
            const status = signatureCheck.reason === 'missing_secret' ? 500 : 401;
            console.warn(`⚠️ Webhook MP rechazado: ${signatureCheck.reason}`);
            if (signatureCheck.debug) {
                console.warn('MP webhook debug:', signatureCheck.debug);
            }
            return res.status(status).json({ received: true });
        }
        if (signatureCheck.reason === 'verify_disabled') {
            console.warn('⚠️ MP webhook verification disabled via MP_WEBHOOK_VERIFY');
        }

        const paymentId = req.body?.data?.id || req.query?.data?.id || req.body?.id || req.query?.id;
        if (!paymentId) {
            return res.json({ received: true });
        }

        if (!mpPayment) {
            console.warn('⚠️ MercadoPago no configurado');
            return res.json({ received: true });
        }

        const payment = await mpPayment.get({ id: paymentId });
        const status = getPaymentValue(payment, 'status', '');
        const externalRef = getPaymentValue(payment, 'external_reference', '');
        const metadata = getPaymentValue(payment, 'metadata', {}) || {};
        const requestId = externalRef || metadata.requestId;
        const orderId = metadata.orderId;

        if (!requestId) {
            console.warn('⚠️ Webhook MP sin requestId asociado');
            return res.json({ received: true });
        }

        if (status === 'approved') {
            const validation = await validatePaymentAmount({ requestId, payment });
            if (!validation.ok) {
                console.warn(`⚠️ Pago MP inválido (${validation.reason}) para request ${requestId}`);
                return res.json({ received: true });
            }
            await handleApprovedPayment({ requestId, orderId, paymentId });
        } else if (['rejected', 'cancelled'].includes(status)) {
            const expected = await getExpectedAmount(requestId);
            if (expected === null) {
                console.warn(`⚠️ Pago MP rechazado sin request válido: ${requestId}`);
                return res.json({ received: true });
            }
            await handleFailedPayment({ requestId, paymentId });
        }

        return res.json({ received: true });
    } catch (err) {
        console.error('Error en webhook MP:', err.message || err);
        return res.json({ received: true });
    }
});

// --- 6. VERIFICAR PAGO MERCADOPAGO ---
app.get('/api/verify-mp-payment/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        if (!mpPayment) {
            return res.status(500).json({ success: false, message: 'MercadoPago no configurado' });
        }

        const payment = await mpPayment.get({ id: paymentId });
        const status = getPaymentValue(payment, 'status', '');
        const externalRef = getPaymentValue(payment, 'external_reference', '');
        const metadata = getPaymentValue(payment, 'metadata', {}) || {};
        const requestId = externalRef || metadata.requestId;
        const orderId = metadata.orderId;

        let amountValid = null;
        if (requestId) {
            const validation = await validatePaymentAmount({ requestId, payment });
            amountValid = validation.ok;
        }

        res.json({
            success: true,
            paymentStatus: status,
            requestId,
            orderId,
            amountValid
        });
    } catch (error) {
        console.error('Error verificando pago MP:', error);
        res.status(500).json({ success: false, message: 'Error al verificar pago' });
    }
});

// --- ADMIN API ---
app.get('/api/admin/requests', requireAdmin, async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const [rows] = await executeQuery(
                `SELECT id, order_id, contact_email, customer_name, return_type, items_json, amount, payment_status, payment_reference,
                    carrier, tracking_number, label_created_at, created_at, admin_status, refund_status,
                    coupon_code, coupon_amount, coupon_sent_at, change_sent_at
             FROM returns_requests
             ORDER BY created_at DESC
             LIMIT 500`,
            []
        );

        const data = (rows || []).map(r => ({
            ...r,
            items: (() => {
                const raw = r.items_json;
                if (!raw) return [];
                if (Array.isArray(raw)) return raw;
                if (typeof raw === 'object') return raw;
                try { return JSON.parse(raw); } catch { return []; }
            })()
        }));

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error admin list:', err);
        res.status(500).json({ success: false, message: 'Error obteniendo solicitudes' });
    }
});

app.get('/api/admin/requests/:requestId', requireAdmin, async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const [rows] = await executeQuery(
            `SELECT * FROM returns_requests WHERE id = ? LIMIT 1`,
            [req.params.requestId]
        );

        if (!rows || !rows[0]) {
            return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
        }

        const row = rows[0];
        const parsedItems = (() => {
            try { return JSON.parse(row.items_json || '[]'); } catch { return []; }
        })();
        const parsedFiles = (() => {
            const raw = row.files_json;
            if (!raw) return [];
            if (Array.isArray(raw)) return raw;
            if (typeof raw === 'object') return raw;
            try { return JSON.parse(raw); } catch { return []; }
        })();

        let itemsSelected = parsedItems;
        try {
            let order = await shopifyClient.getOrderById(row.order_id);
            if (!order) {
                const rawOrderId = String(row.order_id || '').trim();
                const orderName = rawOrderId.startsWith('#') ? rawOrderId : `#${rawOrderId}`;
                order = await shopifyClient.getOrder(orderName) || await shopifyClient.getOrder(rawOrderId);
            }

            const variantCache = new Map();
            const getVariant = async (variantId) => {
                if (!variantId) return null;
                const key = String(variantId);
                if (variantCache.has(key)) return variantCache.get(key);
                const v = await shopifyClient.getVariantById(variantId);
                variantCache.set(key, v);
                return v;
            };

            if (order && Array.isArray(order.line_items)) {
                itemsSelected = await Promise.all(parsedItems.map(async (item) => {
                    const line = order.line_items.find(li => String(li.variant_id) === String(item.variantId || item.id));
                    
                    let replacementTitle = item.replacementTitle || '';
                    if (!replacementTitle && item.replacementVariantId) {
                        const replacementVariant = await getVariant(item.replacementVariantId);
                        replacementTitle = replacementVariant?.title || '';
                    }

                    let currentVariantTitle = line?.variant_title || item.current_variant_title || '';
                    if (!currentVariantTitle && (item.variantId || item.id)) {
                        const originalVariant = await getVariant(item.variantId || item.id);
                        currentVariantTitle = originalVariant?.title || '';
                    }

                    // Priorizar nombre del payload, luego de line, luego fallback
                    const productName = item.name || line?.title || line?.name || 'Producto';

                    return {
                        ...item,
                        name: productName,
                        current_variant_title: currentVariantTitle || 'Variante',
                        quantity: line?.quantity || item.quantity || 1,
                        price: line?.price || item.price,
                        product_id: line?.product_id || item.product_id,
                        sku: line?.sku || item.sku,
                        replacementTitle
                    };
                }));
            } else {
                itemsSelected = await Promise.all(parsedItems.map(async (item) => {
                    let replacementTitle = item.replacementTitle || '';
                    if (!replacementTitle && item.replacementVariantId) {
                        const replacementVariant = await getVariant(item.replacementVariantId);
                        replacementTitle = replacementVariant?.title || '';
                    }

                    let currentVariantTitle = item.current_variant_title || '';
                    if (!currentVariantTitle && (item.variantId || item.id)) {
                        const originalVariant = await getVariant(item.variantId || item.id);
                        currentVariantTitle = originalVariant?.title || '';
                    }

                    // Usar nombre del payload si existe
                    const productName = item.name || 'Producto';

                    return {
                        ...item,
                        name: productName,
                        current_variant_title: currentVariantTitle || 'Variante',
                        replacementTitle
                    };
                }));
            }
        } catch (e) {
            console.warn('No se pudo enriquecer items desde Shopify:', e?.message || e);
            itemsSelected = parsedItems;
        }

        res.json({
            success: true,
            data: {
                ...row,
                items: parsedItems,
                items_selected: itemsSelected,
                files: parsedFiles
            }
        });
    } catch (err) {
        console.error('Error admin detail:', err);
        res.status(500).json({ success: false, message: 'Error obteniendo detalle' });
    }
});

app.post('/api/admin/requests/:requestId/complete', requireAdmin, async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const requestId = req.params.requestId;
        await executeQuery(
            `UPDATE returns_requests SET admin_status = 'completed' WHERE id = ?`,
            [requestId]
        );

        res.json({ success: true, message: 'Solicitud marcada como completada' });
    } catch (err) {
        console.error('Error complete request:', err);
        res.status(500).json({ success: false, message: 'Error marcando como completada' });
    }
});

app.post('/api/admin/requests/:requestId/refund-status', requireAdmin, async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const requestId = req.params.requestId;
        const { status } = req.body;

        // Obtener solicitud actual para validar tipo
        const [rows] = await executeQuery(
            `SELECT return_type FROM returns_requests WHERE id = ? LIMIT 1`,
            [requestId]
        );

        if (!rows || !rows[0]) {
            return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
        }

        const returnType = rows[0].return_type || 'reembolso';
        
        // Para reembolsos: solo permitir 'pending_receipt'
        if (returnType === 'reembolso' && status !== 'pending_receipt') {
            return res.status(400).json({
                success: false,
                message: 'Los reembolsos solo pueden estar en estado "Por Recibir"'
            });
        }

        // Para cambios: permitir ambos estados
        if (returnType === 'cambio' && !['pending_receipt', 'pending_shipment'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Estado inválido para cambios'
            });
        }

        await executeQuery(
            `UPDATE returns_requests SET refund_status = ? WHERE id = ?`,
            [status, requestId]
        );

        res.json({
            success: true,
            message: 'Estado actualizado correctamente',
            refund_status: status
        });
    } catch (err) {
        console.error('Error updating refund status:', err);
        res.status(500).json({ success: false, message: 'Error actualizando estado' });
    }
});

app.post('/api/admin/requests/:requestId/decision', requireAdmin, async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const requestId = req.params.requestId;
        const status = String(req.body?.status || '').toLowerCase();
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Estado inválido' });
        }

        await executeQuery(
            `UPDATE returns_requests SET admin_status = ? WHERE id = ?`,
            [status, requestId]
        );

        res.json({ success: true, message: 'Estado actualizado', admin_status: status });
    } catch (err) {
        console.error('Error decision:', err);
        res.status(500).json({ success: false, message: 'Error actualizando estado' });
    }
});

app.post('/api/admin/requests/:requestId/ship-change', requireAdmin, async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const requestId = req.params.requestId;
        const trackingNumber = String(req.body?.trackingNumber || '').trim();
        if (!trackingNumber) {
            return res.status(400).json({ success: false, message: 'Tracking requerido' });
        }

        await executeQuery(
            `UPDATE returns_requests SET tracking_number = ?, change_sent_at = ?, admin_status = 'sent' WHERE id = ?`,
            [trackingNumber, new Date().toISOString(), requestId]
        );

        res.json({ success: true, message: 'Cambio enviado', trackingNumber });
    } catch (err) {
        console.error('Error ship change:', err);
        res.status(500).json({ success: false, message: 'Error enviando cambio' });
    }
});

app.post('/api/admin/requests/:requestId/send-coupon', requireAdmin, async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const requestId = req.params.requestId;
        const couponCode = String(req.body?.couponCode || '').trim();
        const couponAmount = Number(req.body?.couponAmount || 0);

        if (!couponCode || couponAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Código y monto válidos son requeridos' });
        }

        const [rows] = await executeQuery(
            `SELECT contact_email, customer_name FROM returns_requests WHERE id = ? LIMIT 1`,
            [requestId]
        );
        const contactEmail = rows?.[0]?.contact_email;
        const customerName = rows?.[0]?.customer_name || 'Cliente';

        if (!contactEmail) {
            return res.status(400).json({ success: false, message: 'Email no disponible' });
        }

        if (!sendgridApiKey || !sendgridFrom) {
            return res.status(500).json({ success: false, message: 'SendGrid no configurado' });
        }

        const formattedAmount = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(couponAmount);
        const msg = {
            to: contactEmail,
            from: sendgridFrom,
            subject: 'Tu cupón MON|BLEU está listo',
            html: `
                <p>Hola ${customerName},</p>
                <p>Tu cupón ha sido confirmado.</p>
                <p><strong>Código:</strong> ${couponCode}<br />
                <strong>Monto:</strong> ${formattedAmount}</p>
                <p>Instrucciones: usa este código en el checkout de MON|BLEU. Si tienes dudas, responde a este correo.</p>
            `
        };

        await sgMail.send(msg);

        await executeQuery(
            `UPDATE returns_requests SET coupon_code = ?, coupon_amount = ?, coupon_sent_at = ? WHERE id = ?`,
            [couponCode, couponAmount, new Date().toISOString(), requestId]
        );

        res.json({ success: true, message: 'Cupón enviado' });
    } catch (err) {
        console.error('Error send coupon:', err);
        res.status(500).json({ success: false, message: 'Error enviando cupón' });
    }
});

app.post('/api/admin/requests/:requestId/retry-label', requireAdmin, async (req, res) => {
    try {
        if (!dbPool || !myeshipClient.isConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'MyeShip no configurado o DB no disponible'
            });
        }

        const requestId = req.params.requestId;
        const [rows] = await executeQuery(
            `SELECT * FROM returns_requests WHERE id = ? LIMIT 1`,
            [requestId]
        );

        if (!rows || !rows[0]) {
            return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
        }

        const request = rows[0];
        const order = await shopifyClient.getOrderById(request.order_id);

        if (!order || !order.shipping_address) {
            return res.status(400).json({ success: false, message: 'No se pudo obtener dirección' });
        }

        const label = await myeshipClient.createReturnLabel({ order, requestId });

        if (!label || !label.trackingNumber) {
            return res.status(400).json({ success: false, message: 'MyeShip no generó tracking' });
        }

        const now = new Date().toISOString();
        await executeQuery(
            `UPDATE returns_requests SET carrier = 'MYESHIP', tracking_number = ?, label_base64 = ?, label_mime = ?, label_created_at = ? WHERE id = ?`,
            [label.trackingNumber, label.labelBase64, label.labelMime, now, requestId]
        );

        res.json({
            success: true,
            message: 'Guía regenerada',
            trackingNumber: label.trackingNumber
        });
    } catch (err) {
        console.error('Error retry label:', err);
        res.status(500).json({ success: false, message: err.message || 'Error regenerando guía' });
    }
});

app.post('/api/admin/requests/delete-all', requireAdmin, async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const confirmPass = req.body?.confirmPass;
        if (!confirmPass || confirmPass !== ADMIN_PASS) {
            return res.status(401).json({ success: false, message: 'Confirmacion de admin invalida' });
        }

        await executeQuery('DELETE FROM returns_requests', []);
        res.json({ success: true, message: 'Todos los pedidos eliminados' });
    } catch (err) {
        console.error('Error eliminando pedidos:', err);
        res.status(500).json({ success: false, message: 'Error eliminando pedidos' });
    }
});

// --- ADMIN MIGRATION: Enriquecer todos los items existentes desde Shopify ---
app.post('/api/admin/migrate-enrich-items', requireAdmin, async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        console.log('🔄 Iniciando migración de enriquecimiento de items...');

        const [allRequests] = await executeQuery(
            `SELECT id, order_id, items_json FROM returns_requests`,
            []
        );

        if (!allRequests || allRequests.length === 0) {
            return res.json({ success: true, message: 'No hay solicitudes para migrar', updated: 0 });
        }

        let updated = 0;
        const variantCache = new Map();

        const getVariant = async (variantId) => {
            if (!variantId) return null;
            const key = String(variantId);
            if (variantCache.has(key)) return variantCache.get(key);
            const v = await shopifyClient.getVariantById(variantId);
            variantCache.set(key, v);
            return v;
        };

        for (const request of allRequests) {
            try {
                let items = [];
                if (typeof request.items_json === 'string') {
                    items = JSON.parse(request.items_json || '[]');
                } else {
                    items = Array.isArray(request.items_json) ? request.items_json : [];
                }

                if (!Array.isArray(items) || items.length === 0) continue;

                // Obtener orden de Shopify
                let order = await shopifyClient.getOrderById(request.order_id);
                if (!order) {
                    const rawOrderId = String(request.order_id || '').trim();
                    const orderName = rawOrderId.startsWith('#') ? rawOrderId : `#${rawOrderId}`;
                    order = await shopifyClient.getOrder(orderName) || await shopifyClient.getOrder(rawOrderId);
                }

                // Enriquecer items
                const enrichedItems = await Promise.all(
                    items.map(async (item) => {
                        // Si ya tiene nombre completo, no hacer nada
                        if (item.name && item.name !== 'Producto') {
                            return item;
                        }

                        let enriched = { ...item };

                        // Buscar en order line_items
                        if (order && Array.isArray(order.line_items)) {
                            const line = order.line_items.find(li => 
                                String(li.variant_id) === String(item.variantId || item.id)
                            );
                            if (line) {
                                enriched.name = line.title || line.name || item.name || 'Producto';
                                enriched.current_variant_title = line.variant_title || item.current_variant_title || '';
                                enriched.quantity = line.quantity || item.quantity || 1;
                                enriched.price = line.price || item.price;
                            }
                        }

                        // Enriquecer replacement si existe
                        if (item.replacementVariantId && !item.replacementTitle) {
                            const replacementVariant = await getVariant(item.replacementVariantId);
                            if (replacementVariant) {
                                enriched.replacementTitle = replacementVariant.title || '';
                            }
                        }

                        // Enriquecer current variant title si falta
                        if (!enriched.current_variant_title && (item.variantId || item.id)) {
                            const originalVariant = await getVariant(item.variantId || item.id);
                            if (originalVariant) {
                                enriched.current_variant_title = originalVariant.title || '';
                            }
                        }

                        return enriched;
                    })
                );

                // Actualizar en BD
                await executeQuery(
                    `UPDATE returns_requests SET items_json = ? WHERE id = ?`,
                    [JSON.stringify(enrichedItems), request.id]
                );

                updated++;
                console.log(`✓ Request ${request.id} actualizado`);

            } catch (itemErr) {
                console.error(`Error procesando request ${request.id}:`, itemErr?.message || itemErr);
            }
        }

        res.json({
            success: true,
            message: `Migración completada. ${updated} de ${allRequests.length} solicitudes actualizadas.`,
            updated,
            total: allRequests.length
        });

    } catch (err) {
        console.error('Error en migración:', err);
        res.status(500).json({ success: false, message: 'Error en migración', error: err?.message });
    }
});

// --- 7. OBTENER GUÍA GENERADA ---
app.get('/api/label/:requestId', async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const { requestId } = req.params;
        const [rows] = await executeQuery(
            `SELECT carrier, tracking_number, label_base64, label_mime FROM returns_requests WHERE id = ? LIMIT 1`,
            [requestId]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
        }

        const row = rows[0];
        if (!row.tracking_number) {
            return res.status(404).json({ success: false, message: 'Guía aún no disponible' });
        }

        if (!row.label_base64) {
            return res.json({
                success: true,
                carrier: row.carrier,
                trackingNumber: row.tracking_number,
                labelBase64: null,
                labelMime: row.label_mime || 'application/pdf',
                message: 'Guía aún no disponible'
            });
        }

        res.json({
            success: true,
            carrier: row.carrier,
            trackingNumber: row.tracking_number,
            labelBase64: row.label_base64,
            labelMime: row.label_mime || 'application/pdf'
        });
    } catch (err) {
        console.error('Error obteniendo guía:', err);
        res.status(500).json({ success: false, message: 'Error obteniendo guía' });
    }
});

app.get('/api/health', async (req, res) => {
    let dbOk = false;
    let dbError = null;

    if (dbPool) {
        try {
            await executeQuery('SELECT 1', []);
            dbOk = true;
        } catch (e) {
            dbError = e?.message || 'DB error';
        }
    }

    res.json({
        status: 'ok',
        uptime: process.uptime(),
        db: dbPool ? (dbOk ? 'ok' : 'error') : 'disabled',
        dbError,
        requests: metrics.requests,
        avgMs: metrics.requests ? Math.round(metrics.totalMs / metrics.requests) : 0,
        errors: metrics.errors
    });
});

app.get('/api/metrics', requireAdmin, async (req, res) => {
    res.json({
        requests: metrics.requests,
        avgMs: metrics.requests ? Math.round(metrics.totalMs / metrics.requests) : 0,
        errors: metrics.errors
    });
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'La foto no debe superar 5MB' });
        }
        return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
});

// --- 4. INICIAR SERVIDOR ---
async function startServer() {
    try {
        // Esperar a que se inicialice la BD
        if (!dbDisabled) {
            await initDb();
            console.log('✅ Inicialización de BD completada');
        }
        
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`--------------------------------------------------`);
            console.log(`🚀 Servidor MON|BLEU listo en http://localhost:${PORT}`);
            console.log(`--------------------------------------------------`);
        });
    } catch (err) {
        console.error('❌ Error al iniciar servidor:', err);
        process.exit(1);
    }
}

startServer();