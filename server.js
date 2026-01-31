require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

// Stripe (opcional - solo se inicializa si está configurado)
const stripe = process.env.STRIPE_SECRET_KEY ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;

// Importamos tu cliente robusto de Shopify
const shopifyClient = require('./Shopifyclient.js');
const fedexClient = require('./fedexClient.js');

const app = express();
app.use(cors());

// JSON parser para todas las rutas excepto Stripe webhook (requiere body raw)
app.use((req, res, next) => {
    if (req.originalUrl === '/api/stripe-webhook') {
        return next();
    }
    return express.json()(req, res, next);
});

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

// --- DB CONFIG (MySQL) ---
const dbDisabled = String(process.env.DISABLE_DB || '').toLowerCase() === 'true';
const hasDbConfig = !dbDisabled && !!(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);
const dbPool = hasDbConfig ? mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}) : null;

async function initDb() {
    if (!dbPool) return;
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
            stripe_session_id VARCHAR(255) NULL,
            carrier VARCHAR(32) NULL,
            tracking_number VARCHAR(64) NULL,
            label_base64 MEDIUMTEXT NULL,
            label_mime VARCHAR(64) NULL,
            label_created_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    try {
        await dbPool.execute(createTableSQL);

        const dbName = process.env.DB_NAME;
        if (dbName) {
            await ensureColumn(dbName, 'returns_requests', 'carrier', 'VARCHAR(32) NULL');
            await ensureColumn(dbName, 'returns_requests', 'tracking_number', 'VARCHAR(64) NULL');
            await ensureColumn(dbName, 'returns_requests', 'label_base64', 'MEDIUMTEXT NULL');
            await ensureColumn(dbName, 'returns_requests', 'label_mime', 'VARCHAR(64) NULL');
            await ensureColumn(dbName, 'returns_requests', 'label_created_at', 'TIMESTAMP NULL');
        }
        console.log('✅ DB lista: tabla returns_requests verificada');
    } catch (err) {
        console.error('❌ Error inicializando DB:', err);
    }
}

async function ensureColumn(dbName, tableName, columnName, columnDef) {
    if (!dbPool) return;
    try {
        const [rows] = await dbPool.execute(
            `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [dbName, tableName, columnName]
        );
        if (rows && rows[0] && rows[0].cnt === 0) {
            await dbPool.execute(
                `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`
            );
        }
    } catch (err) {
        console.warn(`⚠️ No se pudo verificar/agregar columna ${columnName}:`, err.message);
    }
}

if (!dbDisabled) {
    initDb();
} else {
    console.warn('⚠️ Base de datos desactivada temporalmente (DISABLE_DB=true)');
}

// Servir archivos estáticos (HTML, CSS, JS desde la carpeta 'public')
app.use(express.static(path.join(__dirname, 'public')));

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
const upload = multer({ storage: storage });

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
app.post('/api/validate-order', async (req, res) => {
    const { orderNumber, email } = req.body;

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

            if (item.product_id) {
                // Usamos el nuevo método de tu cliente para traer detalles
                const product = await shopifyClient.getProductDetails(item.product_id);
                
                if (product) {
                    // Mapeamos las variantes disponibles
                    availableVariants = product.variants.map(v => ({
                        id: v.id,
                        title: v.title, // Ej: "S", "M / Negro"
                        inventory: v.inventory_quantity
                    }));
                    
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
                available_variants: availableVariants // LISTA DE TALLAS PARA EL MODAL
            };
        }));

        // E. Respuesta Exitosa
        res.json({
            valid: true,
            orderId: order.id,
            orderNumber: order.name,
            customer: order.customer ? order.customer.first_name : 'Cliente',
            items: itemsWithVariants // Enviamos los items enriquecidos
        });

    } catch (error) {
        console.error("Error validando orden:", error);
        res.status(500).json({ message: 'Error interno conectando con Shopify' });
    }
});


// --- 3. ENDPOINT: PROCESAR SELECCIÓN ---
// upload.any() permite recibir múltiples archivos con cualquier nombre de campo
app.post('/api/submit-return', upload.any(), async (req, res) => {
    try {
        console.log("📦 Recibiendo solicitud...");

        // Datos del formulario
        const { orderId, contactEmail, returnType } = req.body;
        
        // Los items vienen como string JSON, hay que parsearlos
        let items = [];
        try {
            items = JSON.parse(req.body.items || "[]");
        } catch (e) {
            return res.status(400).json({ success: false, message: "Error en formato de items" });
        }

        const files = req.files; // Array con las fotos subidas

        // Lógica de Precio: TARIFA PLANA $150
        const amountToPay = 150; 

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

        // Guardar en DB
        const filesMeta = (files || []).map(f => ({
            fieldname: f.fieldname,
            originalname: f.originalname,
            filename: f.filename,
            mimetype: f.mimetype,
            size: f.size,
            path: f.path
        }));

        const [result] = await dbPool.execute(
            `INSERT INTO returns_requests (order_id, contact_email, return_type, items_json, files_json, amount)
             VALUES (?, ?, ?, ?, ?, ?)` ,
            [
                String(orderId || ''),
                String(contactEmail || ''),
                String(returnType || ''),
                JSON.stringify(items),
                JSON.stringify(filesMeta),
                amountToPay
            ]
        );

        // Respuesta al Frontend
        res.json({
            success: true,
            message: "Solicitud procesada",
            requestId: result.insertId,
            nextStep: "PAYMENT",
            paymentDetails: {
                amount: amountToPay,
                currency: "MXN",
                description: `Guía de devolución - Orden ${orderId}`
            }
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

// --- 4. STRIPE CHECKOUT SESSION ---
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { requestId, amount, currency, description, orderId, contactEmail } = req.body;

        if (!stripe) {
            return res.status(500).json({
                success: false,
                message: "Stripe no configurado. Agrega STRIPE_SECRET_KEY en .env"
            });
        }

        // Validar parámetros requeridos
        if (!requestId || !amount || !orderId || !contactEmail) {
            return res.status(400).json({
                success: false,
                message: "Faltan parámetros requeridos: requestId, amount, orderId, contactEmail"
            });
        }

        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "El monto debe ser mayor a 0"
            });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: currency || 'mxn',
                    product_data: {
                        name: 'Guía de Devolución MON|BLEU',
                        description: description || `Guía para orden ${orderId}`,
                    },
                    unit_amount: Math.round(amount * 100), // Stripe usa centavos
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${req.headers.origin || 'http://localhost:3000'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin || 'http://localhost:3000'}/cancel.html`,
            metadata: {
                requestId: String(requestId),
                orderId: String(orderId),
                contactEmail: String(contactEmail)
            },
            customer_email: contactEmail
        });

        res.json({
            success: true,
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Error creando sesión de Stripe:', error);
        res.status(500).json({
            success: false,
            message: error.message || "Error al crear sesión de pago"
        });
    }
});

// --- 5. STRIPE WEBHOOK (Para confirmar pagos) ---
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe) {
        console.warn('⚠️ Stripe no configurado');
        return res.status(400).send('Stripe no configurado');
    }

    if (!webhookSecret) {
        console.warn('⚠️ STRIPE_WEBHOOK_SECRET no configurado');
        return res.status(400).send('Webhook secret no configurado');
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('❌ Error verificando webhook:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Manejar evento de pago exitoso
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { requestId, orderId, contactEmail } = session.metadata;

        console.log(`✅ Pago confirmado: Request ${requestId}, Orden ${orderId}`);

        // Actualizar DB con estado de pago
        if (dbPool && requestId) {
            try {
                await dbPool.execute(
                    `UPDATE returns_requests SET payment_status = 'paid', stripe_session_id = ? WHERE id = ?`,
                    [session.id, requestId]
                );
                console.log(`💾 DB actualizada: Request ${requestId} marcado como pagado`);
            } catch (dbErr) {
                console.error('❌ Error actualizando DB:', dbErr);
            }
        }

        // Generar guía de FedEx (si está configurado)
        if (dbPool && requestId && fedexClient.isConfigured()) {
            try {
                const order = await shopifyClient.getOrderById(orderId);
                if (!order || !order.shipping_address) {
                    console.warn('⚠️ No se pudo obtener dirección de envío de la orden');
                } else {
                    const label = await fedexClient.createReturnLabel({ order, requestId });
                    if (label && label.trackingNumber) {
                        await dbPool.execute(
                            `UPDATE returns_requests SET carrier = 'FEDEX', tracking_number = ?, label_base64 = ?, label_mime = ?, label_created_at = NOW() WHERE id = ?`,
                            [label.trackingNumber, label.labelBase64, label.labelMime, requestId]
                        );
                        console.log(`📦 Guía FedEx generada: ${label.trackingNumber}`);
                    } else {
                        console.warn('⚠️ FedEx respondió sin tracking');
                    }
                }
            } catch (labelErr) {
                console.error('❌ Error generando guía FedEx:', labelErr.message || labelErr);
            }
        } else if (!fedexClient.isConfigured()) {
            console.warn('ℹ️ FedEx no configurado: no se generó guía');
        }

        // Aquí puedes agregar lógica para enviar email de confirmación
    }

    res.json({ received: true });
});

// --- 6. VERIFICAR SESIÓN DE STRIPE ---
app.get('/api/verify-payment/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!stripe) {
            return res.status(500).json({ success: false, message: "Stripe no configurado" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        res.json({
            success: true,
            paymentStatus: session.payment_status,
            metadata: session.metadata
        });

    } catch (error) {
        console.error('Error verificando pago:', error);
        res.status(500).json({ success: false, message: "Error al verificar pago" });
    }
});

// --- ADMIN API ---
app.get('/api/admin/requests', requireAdmin, async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const [rows] = await dbPool.execute(
            `SELECT id, order_id, contact_email, return_type, items_json, amount, payment_status, stripe_session_id,
                    carrier, tracking_number, label_created_at, created_at
             FROM returns_requests
             ORDER BY created_at DESC
             LIMIT 200`
        );

        const data = (rows || []).map(r => ({
            ...r,
            items: (() => {
                try { return JSON.parse(r.items_json || '[]'); } catch { return []; }
            })()
        }));

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error admin list:', err);
        res.status(500).json({ success: false, message: 'Error obteniendo solicitudes' });
    }
});

// --- 7. OBTENER GUÍA GENERADA ---
app.get('/api/label/:requestId', async (req, res) => {
    try {
        if (!dbPool) {
            return res.status(503).json({ success: false, message: 'Base de datos no disponible' });
        }

        const { requestId } = req.params;
        const [rows] = await dbPool.execute(
            `SELECT carrier, tracking_number, label_base64, label_mime FROM returns_requests WHERE id = ? LIMIT 1`,
            [requestId]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
        }

        const row = rows[0];
        if (!row.tracking_number || !row.label_base64) {
            return res.status(404).json({ success: false, message: 'Guía aún no disponible' });
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

// --- 4. INICIAR SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`🚀 Servidor MON|BLEU listo en http://localhost:${PORT}`);
    console.log(`--------------------------------------------------`);
});