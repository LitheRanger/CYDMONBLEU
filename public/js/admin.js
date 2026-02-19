const API_BASE = (function() {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isDev ? 'http://localhost:3000' : window.location.origin;
})();

let requests = [];
let cambios = [];
let reembolsos = [];
let defectos = [];
let mixtas = [];
let completadas = [];
let filteredCambios = [];
let filteredReembolsos = [];
let filteredDefectos = [];
let filteredMixtas = [];
let filteredCompletadas = [];
let currentTabCambios = 1;
let currentTabReembolsos = 1;
let currentTabDefectos = 1;
let currentTabMixtas = 1;
let currentTabCompletadas = 1;
let activeTab = 'cambios';
const pageSize = 50;

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function isSameDay(value, ref) {
    if (!value) return false;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    return d.toDateString() === ref.toDateString();
}

function formatCurrency(value) {
    const n = Number(value || 0);
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

function normalizeType(value) {
    return String(value || '').trim().toLowerCase();
}

function getItemsArray(r) {
    let items = r.items_selected || r.items || [];
    if (Array.isArray(items) && items.length > 0) return items;
    
    if (typeof r.items_json === 'string') {
        try {
            const parsed = JSON.parse(r.items_json);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    } else if (r.items_json && typeof r.items_json === 'object') {
        return Array.isArray(r.items_json) ? r.items_json : [];
    }
    return [];
}

function hasDefect(r) {
    const items = getItemsArray(r);
    return items.some(i => String(i.reason || '').toLowerCase() === 'defecto');
}

function hasChangeItem(r) {
    const items = getItemsArray(r);
    return items.some(i => String(i.requestType || '').toLowerCase() === 'cambio');
}

function hasRefundItem(r) {
    const items = getItemsArray(r);
    return items.some(i => String(i.requestType || '').toLowerCase() === 'reembolso');
}

function isMixedRequest(r) {
    const items = getItemsArray(r);
    if (items.length === 0) return false;
    const types = new Set(items.map(i => String(i.requestType || '').toLowerCase()));
    return types.size > 1; // Mixed if has multiple different item types
}

function isNoPayment(r) {
    const amount = Number(r?.amount || 0);
    return amount <= 0 || hasDefect(r);
}

function badge(status) {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'paid') return '<span class="badge paid">Pagado</span>';
    if (s === 'failed') return '<span class="badge failed">Fallido</span>';
    return '<span class="badge pending">Pendiente</span>';
}

function paymentBadge(r) {
    if (isNoPayment(r)) return '<span class="badge info">Sin cobro</span>';
    return badge(r.payment_status);
}

function matchesPaymentFilter(r, status) {
    if (!status) return true;
    if (status === 'nopay') return isNoPayment(r);
    if (status === 'pending') return r.payment_status === 'pending' && !isNoPayment(r);
    return r.payment_status === status;
}

function adminBadge(status) {
    const s = String(status || 'open').toLowerCase();
    if (s === 'completed') return '<span class="badge paid">Completada</span>';
    if (s === 'accepted') return '<span class="badge paid">Aceptada</span>';
    if (s === 'rejected') return '<span class="badge failed">Rechazada</span>';
    if (s === 'sent') return '<span class="badge warning" style="background:#fef3c7;color:#92400e;">Enviada</span>';
    return '<span class="badge pending">Abierta</span>';
}

function refundBadge(status) {
    const s = String(status || 'pending_receipt').toLowerCase();
    if (s === 'pending_receipt') return '<span class="badge pending">Por Recibir</span>';
    if (s === 'pending_shipment') return '<span class="badge warning" style="background:#fef3c7;color:#92400e;">Por Enviar</span>';
    return '<span class="badge pending">Por Recibir</span>';
}

function updateStats() {
    const total = requests.length;
    const pendingReceipt = requests.filter(r => String(r.refund_status || '').toLowerCase() === 'pending_receipt').length;
    const pendingShipment = requests.filter(r => String(r.refund_status || '').toLowerCase() === 'pending_shipment').length;

    const totalEl = document.getElementById('total');
    const pendingReceiptEl = document.getElementById('pending-receipt-count');
    const pendingShipmentEl = document.getElementById('pending-shipment-count');

    if (totalEl) totalEl.textContent = total;
    if (pendingReceiptEl) pendingReceiptEl.textContent = pendingReceipt;
    if (pendingShipmentEl) pendingShipmentEl.textContent = pendingShipment;
}

function updateSummaryTab(tabName, data) {
    const summary = document.getElementById(`summary-${tabName}`);
    if (!summary) return;
    let total = 0;
    if (tabName === 'cambios') total = cambios.length;
    else if (tabName === 'reembolsos') total = reembolsos.length;
    else if (tabName === 'defectos') total = defectos.length;
    else if (tabName === 'completadas') total = completadas.length;
    summary.textContent = `Mostrando ${data.length} de ${total} solicitudes`;
}

function updatePaginationTab(tabName, data) {
    const currentPage = tabName === 'cambios'
        ? currentTabCambios
        : (tabName === 'reembolsos' ? currentTabReembolsos : (tabName === 'defectos' ? currentTabDefectos : currentTabCompletadas));
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    const newPage = currentPage > totalPages ? totalPages : currentPage;

    if (tabName === 'cambios') currentTabCambios = newPage;
    else if (tabName === 'reembolsos') currentTabReembolsos = newPage;
    else if (tabName === 'defectos') currentTabDefectos = newPage;
    else currentTabCompletadas = newPage;

    document.getElementById(`page-info-${tabName}`).textContent = `Pagina ${newPage} de ${totalPages}`;
    document.getElementById(`prev-${tabName}`).disabled = newPage <= 1;
    document.getElementById(`next-${tabName}`).disabled = newPage >= totalPages;
    document.getElementById(`pagination-${tabName}`).style.display = data.length > pageSize ? 'flex' : 'none';
}

function renderTab(tabName, data) {
    if (!data || !data.length) {
        if (tabName === 'cambios') {
            // Para cambios, limpiar ambos tbody
            const tbodyPending = document.getElementById('tbody-cambios-pending');
            const tbodySent = document.getElementById('tbody-cambios-sent');
            const emptyPending = document.getElementById('empty-cambios-pending');
            const emptySent = document.getElementById('empty-cambios-sent');
            const emptyOverall = document.getElementById('empty-cambios');
            
            if (tbodyPending) tbodyPending.innerHTML = '';
            if (tbodySent) tbodySent.innerHTML = '';
            if (emptyPending) emptyPending.style.display = 'block';
            if (emptySent) emptySent.style.display = 'block';
            if (emptyOverall) emptyOverall.style.display = 'block';
        } else {
            const tbody = document.getElementById(`tbody-${tabName}`);
            const empty = document.getElementById(`empty-${tabName}`);
            if (tbody) tbody.innerHTML = '';
            if (empty) empty.style.display = 'block';
        }
        updateSummaryTab(tabName, []);
        updatePaginationTab(tabName, []);
        return;
    }

    const currentPage = tabName === 'cambios'
        ? currentTabCambios
        : (tabName === 'reembolsos' ? currentTabReembolsos : (tabName === 'defectos' ? currentTabDefectos : currentTabCompletadas));
    const start = (currentPage - 1) * pageSize;
    const pageData = data.slice(start, start + pageSize);

    // Si es cambios, separar por refund_status
    if (tabName === 'cambios') {
        const tbodyPending = document.getElementById('tbody-cambios-pending');
        const tbodySent = document.getElementById('tbody-cambios-sent');
        const emptyPending = document.getElementById('empty-cambios-pending');
        const emptySent = document.getElementById('empty-cambios-sent');
        const emptyOverall = document.getElementById('empty-cambios');

        if (!tbodyPending || !tbodySent) return;

        tbodyPending.innerHTML = '';
        tbodySent.innerHTML = '';

        const pending = pageData.filter(r => r.refund_status === 'pending_receipt');
        const sent = pageData.filter(r => r.refund_status === 'pending_shipment');

        if (pending.length === 0 && sent.length === 0) {
            emptyOverall.style.display = 'block';
            if (emptyPending) emptyPending.style.display = 'block';
            if (emptySent) emptySent.style.display = 'block';
        } else {
            emptyOverall.style.display = 'none';
            if (emptyPending) emptyPending.style.display = pending.length === 0 ? 'block' : 'none';
            if (emptySent) emptySent.style.display = sent.length === 0 ? 'block' : 'none';

            pending.forEach(r => renderRow(r, tabName, tbodyPending));
            sent.forEach(r => renderRow(r, tabName, tbodySent));
        }
    } else {
        // Otros tabs: una sola tabla
        const tbody = document.getElementById(`tbody-${tabName}`);
        const empty = document.getElementById(`empty-${tabName}`);

        if (!tbody || !empty) return;

        tbody.innerHTML = '';

        if (pageData.length === 0) {
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
            pageData.forEach(r => renderRow(r, tabName, tbody));
        }
    }

    updateSummaryTab(tabName, data);
    updatePaginationTab(tabName, data);
}

function renderRow(r, tabName, tbody) {
    const tr = document.createElement('tr');
    tr.classList.add('clickable-row');
    tr.setAttribute('data-request-id', r.order_id);
    const hasLabel = r.tracking_number || r.label_created_at;
    const labelBadge = hasLabel
        ? `<span class="badge success" style="background:#dcfce7;color:#16a34a;">${r.carrier || 'Generada'}</span>`
        : '<span class="badge no-label">Sin guia</span>';
    const trackingText = r.tracking_number || '—';

    const isCambio = tabName === 'cambios';
    const isCompletadas = tabName === 'completadas' || tabName === 'defectos';
    const isReembolso = tabName === 'reembolsos';

    const rowType = r.return_type || (hasChangeItem(r) && hasRefundItem(r) ? 'Mixto' : (hasChangeItem(r) ? 'Cambio' : (hasRefundItem(r) ? 'Reembolso' : '—')));

    tr.innerHTML = `
                <td><strong>${r.order_id || '—'}</strong></td>
                <td>${r.customer_name || '—'}</td>
                <td class="muted">${r.contact_email || '—'}</td>
                ${(tabName === 'completadas' || tabName === 'defectos') ? `<td>${rowType}</td>` : ''}
                <td>${paymentBadge(r)}</td>
                <td>${adminBadge(r.admin_status)}</td>
                <td>${trackingText}</td>
                <td>${labelBadge}</td>
                <td class="muted">${formatDate(r.created_at)}</td>
            `;
    tbody.appendChild(tr);
}

async function loadRequests() {
    try {
        document.getElementById('btn-refresh').disabled = true;
        const res = await fetch(`${API_BASE}/api/admin/requests`);
        const data = await res.json();
        if (data.success) {
            requests = data.data || [];
            
            // Filtrar por tipo de solicitud - permitir duplicados en pestañas
            // Cada solicitud puede aparecer en múltiples pestañas si tiene diferentes tipos de items
            
            completadas = requests.filter(r => String(r.admin_status || '').toLowerCase() === 'completed');
            
            const completadasIds = new Set(completadas.map(r => r.id));
            
            mixtas = requests.filter(r => {
                if (completadasIds.has(r.id)) return false;
                return isMixedRequest(r);
            });
            
            const mixtasIds = new Set(mixtas.map(r => r.id));
            
            defectos = requests.filter(r => {
                if (completadasIds.has(r.id)) return false;
                if (mixtasIds.has(r.id)) return false;
                return hasDefect(r);
            });
            
            const defectosIds = new Set(defectos.map(r => r.id));
            
            cambios = requests.filter(r => {
                if (completadasIds.has(r.id)) return false;
                if (mixtasIds.has(r.id)) return false;
                if (defectosIds.has(r.id)) return false;
                // Incluir si tiene items de cambio o si return_type es cambio
                return hasChangeItem(r) || normalizeType(r.return_type) === 'cambio';
            });
            
            reembolsos = requests.filter(r => {
                if (completadasIds.has(r.id)) return false;
                if (mixtasIds.has(r.id)) return false;
                if (defectosIds.has(r.id)) return false;
                // Incluir si tiene items de reembolso o si return_type es reembolso
                return hasRefundItem(r) || normalizeType(r.return_type) === 'reembolso';
            });
            
            updateStats();
            applyFilter();
        } else {
            console.error('Error loading:', data.message || 'Error desconocido');
        }
    } catch (e) {
        console.error('Error loading:', e);
    } finally {
        document.getElementById('btn-refresh').disabled = false;
    }
}

function applyFilter() {
    if (!suppressChipClear) clearQuickChips();
    const q = (document.getElementById('search').value || '').toLowerCase();
    const status = document.getElementById('filter-status').value;
    const label = document.getElementById('filter-label').value;
    const refund = document.getElementById('filter-refund').value;

    // Filtrar CAMBIOS
    filteredCambios = cambios.filter(r => {
        const hay = `${r.order_id || ''} ${r.customer_name || ''} ${r.contact_email || ''} ${r.tracking_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
        if (!matchesPaymentFilter(r, status)) return false;
        if (label === 'yes' && !r.tracking_number) return false;
        if (label === 'no' && r.tracking_number) return false;
        if (refund && r.refund_status !== refund) return false;
        return true;
    });

    // Filtrar REEMBOLSOS
    filteredReembolsos = reembolsos.filter(r => {
        const hay = `${r.order_id || ''} ${r.customer_name || ''} ${r.contact_email || ''} ${r.tracking_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
        if (!matchesPaymentFilter(r, status)) return false;
        if (label === 'yes' && !r.tracking_number) return false;
        if (label === 'no' && r.tracking_number) return false;
        return true;
    });

    // Filtrar MIXTAS
    filteredMixtas = mixtas.filter(r => {
        const hay = `${r.order_id || ''} ${r.customer_name || ''} ${r.contact_email || ''} ${r.tracking_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
        if (!matchesPaymentFilter(r, status)) return false;
        if (label === 'yes' && !r.tracking_number) return false;
        if (label === 'no' && r.tracking_number) return false;
        if (refund && r.refund_status !== refund) return false;
        return true;
    });

    // Filtrar COMPLETADAS
    filteredCompletadas = completadas.filter(r => {
        const hay = `${r.order_id || ''} ${r.customer_name || ''} ${r.contact_email || ''} ${r.tracking_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
        if (!matchesPaymentFilter(r, status)) return false;
        if (label === 'yes' && !r.tracking_number) return false;
        if (label === 'no' && r.tracking_number) return false;
        if (refund && r.refund_status !== refund) return false;
        return true;
    });

    // Filtrar DEFECTOS
    filteredDefectos = defectos.filter(r => {
        const hay = `${r.order_id || ''} ${r.customer_name || ''} ${r.contact_email || ''} ${r.tracking_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
        if (!matchesPaymentFilter(r, status)) return false;
        if (label === 'yes' && !r.tracking_number) return false;
        if (label === 'no' && r.tracking_number) return false;
        if (refund && r.refund_status !== refund) return false;
        return true;
    });

    currentTabCambios = 1;
    currentTabReembolsos = 1;
    currentTabDefectos = 1;
    currentTabMixtas = 1;
    currentTabCompletadas = 1;
    renderTab('cambios', filteredCambios);
    renderTab('reembolsos', filteredReembolsos);
    renderTab('defectos', filteredDefectos);
    renderTab('mixtas', filteredMixtas);
    renderTab('completadas', filteredCompletadas);
}

async function viewDetail(requestId) {
    try {
        console.log(`🔍 Fetching detail para requestId: "${requestId}"`);
        const res = await fetch(`${API_BASE}/api/admin/requests/${requestId}`);
        console.log(`📡 Response status: ${res.status}`);
        const data = await res.json();
        console.log('📨 Response data:', data);
        
        if (!data.success) {
            console.error('❌ Error fetching detail:', data);
            document.getElementById('detail-body').innerHTML = `<div class="muted">Error: ${data.message || 'No se pudo cargar'}</div>`;
            return;
        }

        const r = data.data;
        console.log('📋 Detail recibido:', r);
        let itemsSource = r.items_selected || r.items || [];
        console.log('Items source (1):', itemsSource);

        if (!Array.isArray(itemsSource) || itemsSource.length === 0) {
            // items_json puede venir ya parseado (PostgreSQL JSONB) o como string
            if (typeof r.items_json === 'string') {
                try {
                    const parsed = JSON.parse(r.items_json);
                    itemsSource = Array.isArray(parsed) ? parsed : [];
                    console.log('Items parsed from JSON string:', itemsSource);
                } catch (e) {
                    console.error('Error parsing items_json:', e);
                    itemsSource = [];
                }
            } else if (r.items_json && typeof r.items_json === 'object') {
                // Ya viene parseado (PostgreSQL)
                itemsSource = Array.isArray(r.items_json) ? r.items_json : [];
                console.log('Items already parsed (JSONB):', itemsSource);
            }
        }
        console.log('Final itemsSource:', itemsSource);

        const isCambio = String(r.return_type || '').toLowerCase() === 'cambio';
        const itemsHtml = itemsSource.map(i => {
            const name = i.name || 'Producto';
            const variant = i.current_variant_title || 'Variante';
            const qty = i.quantity || 1;
            const price = i.price != null ? formatCurrency(i.price) : '—';
            const reason = i.reason || 'Sin razon';
            const replacementTitle = i.replacementTitle || i.replacement_title || i.replacementVariantTitle || '';
            const replacementId = i.replacementVariantId || i.replacement_variant_id || '';
            const replacementDisplay = replacementTitle
                ? replacementTitle
                : (replacementId ? `ID ${replacementId}` : 'No seleccionado');
            const replacementLine = isCambio
                ? `<div class="item-replacement">Reemplazo: ${replacementDisplay}</div>`
                : '';
            return `
                        <div class="item-card">
                            <div class="item-title">${name}</div>
                            <div class="item-meta">Variante: ${variant}</div>
                            <div class="item-meta">Cantidad: ${qty}</div>
                            <div class="item-meta">Motivo: ${reason}</div>
                            <div class="item-meta">Precio: ${price}</div>
                            ${replacementLine}
                        </div>
                    `;
        }).join('') || '<div class="muted">Sin items</div>';

        const filesHtml = (r.files || []).map(f => {
            const isImage = (f.mimetype || '').startsWith('image/');
            const rawPath = String(f.path || '').replace(/\\/g, '/');
            const normalizedPath = rawPath
                ? (rawPath.startsWith('uploads/') ? `/${rawPath}` : (rawPath.startsWith('/') ? rawPath : `/uploads/${rawPath}`))
                : '';
            const fileUrl = f.cloudinaryUrl || f.dataUrl || f.url || (f.filename ? `/uploads/${f.filename}` : normalizedPath);
            const fileName = f.originalname || f.filename || 'Archivo';
            if (isImage && fileUrl) {
                return `
                            <div class="file-card">
                                <img src="${fileUrl}" alt="${fileName}" class="file-thumb" />
                                <div class="file-meta">${fileName}</div>
                            </div>
                        `;
            }
            return `
                        <div class="file-card">
                            <div class="file-meta">${fileName}</div>
                        </div>
                    `;
        }).join('') || '<div class="muted">Sin archivos</div>';

        document.getElementById('detail-id').textContent = r.order_id;
        document.getElementById('detail-body').innerHTML = `
                    <div class="detail-section">
                        <h3 class="detail-section-title">Cliente</h3>
                        <div class="detail-grid">
                            <div class="detail-field">
                                <div class="detail-label">Orden</div>
                                <div class="detail-value">${r.order_id || '—'}</div>
                            </div>
                            <div class="detail-field">
                                <div class="detail-label">Cliente</div>
                                <div class="detail-value">${r.customer_name || '—'}</div>
                            </div>
                            <div class="detail-field">
                                <div class="detail-label">Correo</div>
                                <div class="detail-value">${r.contact_email || '—'}</div>
                            </div>
                            <div class="detail-field">
                                <div class="detail-label">Creada</div>
                                <div class="detail-value">${formatDate(r.created_at)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="detail-section">
                        <h3 class="detail-section-title">Pago</h3>
                        <div class="detail-grid">
                            <div class="detail-field">
                                <div class="detail-label">Estado de pago</div>
                                <div class="detail-value">${paymentBadge(r)}</div>
                            </div>
                            <div class="detail-field">
                                <div class="detail-label">Monto</div>
                                <div class="detail-value">${formatCurrency(r.amount)}</div>
                            </div>
                            <div class="detail-field">
                                <div class="detail-label">Proveedor</div>
                                <div class="detail-value">${r.payment_provider || 'MercadoPago'}</div>
                            </div>
                            <div class="detail-field">
                                <div class="detail-label">Referencia</div>
                                <div class="detail-value">${r.payment_reference ? `<span class="tag">${r.payment_reference}</span>` : '<span class="muted">—</span>'}</div>
                            </div>
                        </div>
                    </div>
                    <div class="detail-section">
                        <h3 class="detail-section-title">Solicitud</h3>
                        <div class="detail-grid">
                            <div class="detail-field">
                                <div class="detail-label">Tipo</div>
                                <div class="detail-value">${r.return_type || '—'}</div>
                            </div>
                            <div class="detail-field">
                                <div class="detail-label">Estado admin</div>
                                <div class="detail-value">${adminBadge(r.admin_status)}</div>
                            </div>
                            <div class="detail-field">
                                <div class="detail-label">Estado reembolso</div>
                                <div class="detail-value">${refundBadge(r.refund_status)}</div>
                            </div>
                            <div class="detail-field">
                                <div class="detail-label">Tracking</div>
                                <div class="detail-value">${r.tracking_number || '<span class="muted">Sin guia</span>'}</div>
                            </div>
                            <div class="detail-field">
                                <div class="detail-label">Paqueteria</div>
                                <div class="detail-value">${r.carrier || '—'}</div>
                            </div>
                        </div>
                    </div>
                    <div class="detail-section">
                        <h3 class="detail-section-title">Items</h3>
                        <div class="items-grid">${itemsHtml}</div>
                    </div>
                    <div class="detail-section">
                        <h3 class="detail-section-title">Evidencia</h3>
                        <div class="files-grid">${filesHtml}</div>
                    </div>
                `;
        // Renderizar botones de acción en el modal
        const actionsContainer = document.getElementById('detail-actions');
        if (actionsContainer) {
            let actions = [];
            const isCambio = String(r.return_type || '').toLowerCase() === 'cambio';
            const isReembolso = String(r.return_type || '').toLowerCase() === 'reembolso';
            const isDefecto = Array.isArray(r.items) && r.items.some(i => String(i.reason || '').toLowerCase() === 'defecto');
            const isCompletada = String(r.admin_status || '').toLowerCase() === 'completed';
            
            actions.push(`<button class="btn secondary" onclick="downloadLabel('${r.order_id}')" ${!(r.tracking_number || r.label_created_at) ? 'disabled' : ''}>Guía</button>`);
            actions.push(`<button class="btn secondary" onclick="retryLabel('${r.order_id}')">Reintentar</button>`);
            
            if (isDefecto) {
                actions.push(`<button class="btn" onclick="updateDecision('${r.order_id}', 'accepted')" ${String(r.admin_status || '').toLowerCase() === 'accepted' ? 'disabled' : ''}>Aceptar</button>`);
                actions.push(`<button class="btn danger" onclick="updateDecision('${r.order_id}', 'rejected')" ${String(r.admin_status || '').toLowerCase() === 'rejected' ? 'disabled' : ''}>Rechazar</button>`);
            }
            
            if (isCambio) actions.push(`<button class="btn" onclick="shipChange('${r.order_id}')">Enviar</button>`);
            if (isReembolso) actions.push(`<button class="btn" onclick="sendCoupon('${r.order_id}')">Enviar cupón</button>`);
            if (isCambio) {
                const currentStatus = r.refund_status || 'pending_receipt';
                const nextStatus = currentStatus === 'pending_receipt' ? 'Por Enviar' : 'Por Recibir';
                const statusEmoji = currentStatus === 'pending_receipt' ? '📥' : '📦';
                actions.push(`<button class="btn secondary" onclick="changeRefundStatus('${r.order_id}')" title="Cambiar de ${currentStatus === 'pending_receipt' ? 'Por Recibir' : 'Por Enviar'}">${statusEmoji} Cambiar a ${nextStatus}</button>`);
            }
            
            if (!isCompletada) {
                actions.push(`<button class="btn" onclick="completeRequest('${r.order_id}')" ${String(r.admin_status || 'open').toLowerCase() === 'completed' ? 'disabled' : ''}>Completar</button>`);
            }
            
            actions.push(`<button class="btn danger" onclick="deleteRequest('${r.order_id}')">Eliminar</button>`);
            
            actionsContainer.innerHTML = actions.join(' ');
        }
        document.getElementById('modal').classList.add('show');
    } catch (e) {
        console.error('❌ Error in viewDetail:', e);
        document.getElementById('detail-body').innerHTML = `<div class="muted">Error en el servidor: ${e.message}</div>`;
        document.getElementById('modal').classList.add('show');
    }
}

async function downloadLabel(requestId) {
    try {
        const res = await fetch(`${API_BASE}/api/label/${encodeURIComponent(requestId)}`);
        const data = await res.json();
        if (!data.success || !data.labelBase64) {
            alert('Guia no disponible');
            return;
        }
        const byteChars = atob(data.labelBase64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.labelMime || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `guia-${data.trackingNumber || requestId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Error:', e);
    }
}

async function retryLabel(requestId) {
    if (!confirm('¿Regenerar guia MyeShip?')) return;
    try {
        const res = await fetch(`${API_BASE}/api/admin/requests/${requestId}/retry-label`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert(`Guia regenerada: ${data.trackingNumber}`);
            loadRequests();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

async function changeRefundStatus(requestId) {
    // Obtener solicitud para saber estado actual
    const req = requests.find(r => r.order_id == requestId);
    if (!req) return;

    const currentStatus = req.refund_status || 'pending_receipt';
    const newStatus = currentStatus === 'pending_receipt' ? 'pending_shipment' : 'pending_receipt';

    const statusLabel = newStatus === 'pending_receipt' ? 'Por Recibir' : 'Por Enviar';
    if (!confirm(`¿Cambiar estado a "${statusLabel}"?`)) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/requests/${requestId}/refund-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.success) {
            // Cerrar modal
            document.getElementById('modal').classList.remove('show');
            // Recargar cambios para actualizar secciones
            loadRequests();
            alert('Estado actualizado correctamente');
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

async function deleteRequest(requestId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta solicitud? Esta acción NO se puede deshacer.')) return;

    try {
        const res = await fetch(`${API_BASE}/api/admin/requests/${requestId}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('modal').classList.remove('show');
            loadRequests();
            alert('✅ Solicitud eliminada correctamente');
        } else {
            alert(`❌ Error: ${data.message}`);
        }
    } catch (e) {
        console.error('Error:', e);
        alert('❌ Error al eliminar la solicitud');
    }
}

async function updateDecision(requestId, status) {
    try {
        const res = await fetch(`${API_BASE}/api/admin/requests/${requestId}/decision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (data.success) {
            loadRequests();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (e) {
        console.error('Error decision:', e);
    }
}

async function shipChange(requestId) {
    const trackingNumber = prompt('Ingresa el tracking de envio:');
    if (!trackingNumber) return;
    try {
        const res = await fetch(`${API_BASE}/api/admin/requests/${requestId}/ship-change`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackingNumber })
        });
        const data = await res.json();
        if (data.success) {
            alert('Cambio marcado como enviado');
            loadRequests();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (e) {
        console.error('Error ship change:', e);
    }
}

async function sendCoupon(requestId) {
    const couponCode = prompt('Codigo de cupon:');
    if (!couponCode) return;
    const amountRaw = prompt('Monto del cupon (MXN):');
    const couponAmount = Number(amountRaw || 0);
    if (!couponAmount || couponAmount <= 0) {
        alert('Monto invalido');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/api/admin/requests/${requestId}/send-coupon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ couponCode, couponAmount })
        });
        const data = await res.json();
        if (data.success) {
            alert('Cupon enviado');
            loadRequests();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (e) {
        console.error('Error send coupon:', e);
    }
}

async function completeRequest(requestId) {
    if (!confirm('¿Marcar solicitud como completada?')) return;
    try {
        const res = await fetch(`${API_BASE}/api/admin/requests/${requestId}/complete`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert('Solicitud marcada como completada');
            loadRequests();
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

function exportCSV() {
    const headers = ['ID', 'Orden', 'Correo', 'Tipo', 'Pago', 'Estado', 'Monto', 'Tracking', 'Fecha'];
    let source = [];
    if (activeTab === 'cambios') {
        source = filteredCambios.length ? filteredCambios : cambios;
    } else if (activeTab === 'reembolsos') {
        source = filteredReembolsos.length ? filteredReembolsos : reembolsos;
    } else if (activeTab === 'defectos') {
        source = filteredDefectos.length ? filteredDefectos : defectos;
    } else {
        source = filteredCompletadas.length ? filteredCompletadas : completadas;
    }
    const rows = source.map(r => [
        r.id,
        r.order_id,
        r.contact_email,
        r.return_type,
        r.payment_status,
        r.admin_status || 'open',
        r.amount,
        r.tracking_number || '—',
        new Date(r.created_at).toISOString()
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devoluciones-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearView() {
    const search = document.getElementById('search');
    const status = document.getElementById('filter-status');
    const label = document.getElementById('filter-label');
    const refund = document.getElementById('filter-refund');
    if (search) search.value = '';
    if (status) status.value = '';
    if (label) label.value = '';
    if (refund) refund.value = '';
    clearQuickChips();

    requests = [];
    cambios = [];
    reembolsos = [];
    defectos = [];
    mixtas = [];
    completadas = [];
    filteredCambios = [];
    filteredReembolsos = [];
    filteredDefectos = [];
    filteredMixtas = [];
    filteredCompletadas = [];
    currentTabCambios = 1;
    currentTabReembolsos = 1;
    currentTabDefectos = 1;
    currentTabMixtas = 1;
    currentTabCompletadas = 1;
    updateStats();
    renderTab('cambios', []);
    renderTab('reembolsos', []);
    renderTab('defectos', []);
    renderTab('mixtas', []);
    renderTab('completadas', []);
}

async function deleteAllRequests() {
    const proceed = confirm('¿Seguro que quieres eliminar TODOS los pedidos? Esta accion no se puede deshacer.');
    if (!proceed) return;
    const typed = prompt('Escribe BORRAR para confirmar la eliminacion total:');
    if (typed !== 'BORRAR') {
        alert('Confirmacion incorrecta. No se elimino nada.');
        return;
    }
    const confirmPass = prompt('Ingresa tu contraseña de admin para confirmar:');
    if (!confirmPass) {
        alert('Confirmacion cancelada.');
        return;
    }

    const btn = document.getElementById('btn-delete-all');
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`${API_BASE}/api/admin/requests/delete-all`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmPass })
        });
        const data = await res.json();
        if (!data.success) {
            alert(data.message || 'Error eliminando pedidos');
            return;
        }
        clearView();
        alert('Pedidos eliminados correctamente.');
    } catch (e) {
        console.error('Error eliminando pedidos:', e);
        alert('Error eliminando pedidos');
    } finally {
        if (btn) btn.disabled = false;
    }
}

let suppressChipClear = false;

function clearQuickChips() {
    document.querySelectorAll('.chip.active').forEach(chip => chip.classList.remove('active'));
}

function activateTab(tabName) {
    if (!tabName) return;
    activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = e.target.getAttribute('data-tab');
            if (!tabName) return;
            activateTab(tabName);
        });
    });
}

function applyQuickFilter(btn) {
    const statusEl = document.getElementById('filter-status');
    const labelEl = document.getElementById('filter-label');
    const refundEl = document.getElementById('filter-refund');

    if (btn.dataset.clear === 'true') {
        if (statusEl) statusEl.value = '';
        if (labelEl) labelEl.value = '';
        if (refundEl) refundEl.value = '';
    }

    if (btn.dataset.payment && statusEl) statusEl.value = btn.dataset.payment;
    if (btn.dataset.label && labelEl) labelEl.value = btn.dataset.label;
    if (btn.dataset.refund && refundEl) refundEl.value = btn.dataset.refund;

    const tabName = btn.dataset.tab;
    if (tabName) activateTab(tabName);

    clearQuickChips();
    btn.classList.add('active');

    suppressChipClear = true;
    applyFilter();
    suppressChipClear = false;
}

document.querySelectorAll('[data-quick]').forEach(btn => {
    btn.addEventListener('click', () => applyQuickFilter(btn));
});

// Event listeners para cambios
document.getElementById('prev-cambios').addEventListener('click', () => {
    if (currentTabCambios > 1) {
        currentTabCambios--;
        renderTab('cambios', filteredCambios.length ? filteredCambios : cambios);
    }
});
document.getElementById('next-cambios').addEventListener('click', () => {
    const data = filteredCambios.length ? filteredCambios : cambios;
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    if (currentTabCambios < totalPages) {
        currentTabCambios++;
        renderTab('cambios', data);
    }
});

// Event listeners para reembolsos
document.getElementById('prev-reembolsos').addEventListener('click', () => {
    if (currentTabReembolsos > 1) {
        currentTabReembolsos--;
        renderTab('reembolsos', filteredReembolsos.length ? filteredReembolsos : reembolsos);
    }
});
document.getElementById('next-reembolsos').addEventListener('click', () => {
    const data = filteredReembolsos.length ? filteredReembolsos : reembolsos;
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    if (currentTabReembolsos < totalPages) {
        currentTabReembolsos++;
        renderTab('reembolsos', data);
    }
});

// Event listeners para defectos
document.getElementById('prev-defectos').addEventListener('click', () => {
    if (currentTabDefectos > 1) {
        currentTabDefectos--;
        renderTab('defectos', filteredDefectos.length ? filteredDefectos : defectos);
    }
});
document.getElementById('next-defectos').addEventListener('click', () => {
    const data = filteredDefectos.length ? filteredDefectos : defectos;
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    if (currentTabDefectos < totalPages) {
        currentTabDefectos++;
        renderTab('defectos', data);
    }
});

// Event listeners para mixtas
document.getElementById('prev-mixtas').addEventListener('click', () => {
    if (currentTabMixtas > 1) {
        currentTabMixtas--;
        renderTab('mixtas', filteredMixtas.length ? filteredMixtas : mixtas);
    }
});
document.getElementById('next-mixtas').addEventListener('click', () => {
    const data = filteredMixtas.length ? filteredMixtas : mixtas;
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    if (currentTabMixtas < totalPages) {
        currentTabMixtas++;
        renderTab('mixtas', data);
    }
});

// Event listeners para completadas
document.getElementById('prev-completadas').addEventListener('click', () => {
    if (currentTabCompletadas > 1) {
        currentTabCompletadas--;
        renderTab('completadas', filteredCompletadas.length ? filteredCompletadas : completadas);
    }
});
document.getElementById('next-completadas').addEventListener('click', () => {
    const data = filteredCompletadas.length ? filteredCompletadas : completadas;
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    if (currentTabCompletadas < totalPages) {
        currentTabCompletadas++;
        renderTab('completadas', data);
    }
});

document.getElementById('btn-refresh').addEventListener('click', loadRequests);
document.getElementById('btn-export').addEventListener('click', exportCSV);
document.getElementById('btn-clear-view').addEventListener('click', clearView);
document.getElementById('btn-delete-all').addEventListener('click', deleteAllRequests);
document.getElementById('search').addEventListener('input', applyFilter);
document.getElementById('filter-status').addEventListener('change', applyFilter);
document.getElementById('filter-label').addEventListener('change', applyFilter);
document.getElementById('filter-refund').addEventListener('change', applyFilter);
document.getElementById('close-modal').addEventListener('click', () => document.getElementById('modal').classList.remove('show'));
document.getElementById('tbody-cambios-pending').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-request-id]');
    if (!row) return;
    const id = row.getAttribute('data-request-id');
    if (id) viewDetail(id);
});

document.getElementById('tbody-cambios-sent').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-request-id]');
    if (!row) return;
    const id = row.getAttribute('data-request-id');
    if (id) viewDetail(id);
});

document.getElementById('tbody-reembolsos').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-request-id]');
    if (!row) return;
    const id = row.getAttribute('data-request-id');
    if (id) viewDetail(id);
});

document.getElementById('tbody-defectos').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-request-id]');
    if (!row) return;
    const id = row.getAttribute('data-request-id');
    if (id) viewDetail(id);
});

document.getElementById('tbody-completadas').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-request-id]');
    if (!row) return;
    const id = row.getAttribute('data-request-id');
    if (id) viewDetail(id);
});

// Inicializar tabs y cargar datos
initTabs();
loadRequests();
