// ===== CONFIGURACION =====
const API_BASE = (function() {
    if (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isDev ? 'http://localhost:3000' : window.location.origin;
})();

// ===== ESTADO =====
let orderData = null;
let seleccion = {};
let cambioConfig = { itemIndex: null, nuevaVariantId: null, nuevaTalla: '', nuevaColor: '', nuevaSize: '' };
let tipoFinal = '';
const GUIDE_COST = 150;

function formatMoney(value) {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}

function formatReplacement(s) {
    if (!s) return 'Sin seleccionar';
    const color = s.replacementColor || '';
    const size = s.replacementSize || '';
    if (color || size) {
        const parts = [];
        if (color) parts.push(`Color: ${color}`);
        if (size) parts.push(`Talla: ${size}`);
        return parts.join(' • ');
    }
    return s.replacementTitle || 'Sin seleccionar';
}

// ===== TOAST SYSTEM =====
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

    const closeBtn = document.createElement('span');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '✕';
    closeBtn.setAttribute('aria-label', 'Cerrar notificacion');
    closeBtn.addEventListener('click', () => removeToast(toast));

    toast.textContent = message;
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }

    return toast;
}

function removeToast(toast) {
    if (!toast) return;
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 350);
}

function showErrorToast(message) {
    return showToast(message, 'error');
}

function showSuccessToast(message) {
    return showToast(message, 'success');
}

function showWarningToast(message) {
    return showToast(message, 'warning');
}

function showLoadingToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast info';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `<div class="loading-state"><div class="loading-spinner"></div>${message}</div>`;
    container.appendChild(toast);
    return toast;
}

// ===== UTILIDADES =====
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerText = message;
        el.classList.add('show');
    }
}

function hideError(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.classList.remove('show');
        el.innerText = '';
    }
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function nav(stepNumber) {
    document.querySelectorAll('.step-view').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${stepNumber}`).classList.add('active');

    document.querySelectorAll('.progress-step').forEach((el, i) => {
        if (i < stepNumber) el.classList.add('active');
        else el.classList.remove('active');
    });
    window.scrollTo(0, 0);
}

// ===== PASO 1: LOGIN =====
async function buscarPedido() {
    const orden = document.getElementById('orden').value.trim();
    const email = document.getElementById('email').value.trim();
    const termsAccepted = document.getElementById('terms-accept');
    const btn = document.getElementById('btn-search');
    const msgEl = document.getElementById('login-msg');

    hideError('login-msg');

    // Validaciones
    if (!orden) {
        showErrorToast("❌ Por favor, ingresa el numero de pedido");
        return;
    }
    if (!email || !validateEmail(email)) {
        showErrorToast("❌ Por favor, ingresa un correo valido (ej: nombre@ejemplo.com)");
        return;
    }
    if (!termsAccepted || !termsAccepted.checked) {
        showErrorToast("❌ Debes aceptar las condiciones del cambio para continuar");
        return;
    }

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerHTML = '<div class="loading-spinner" style="display:inline-block;margin-right:8px;"></div>Buscando...';

    let loadingToast = null;

    try {
        loadingToast = showLoadingToast("Validando tu pedido...");

        const res = await fetch(`${API_BASE}/api/validate-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            body: JSON.stringify({ orderNumber: orden, email: email })
        });
        const data = await res.json();

        removeToast(loadingToast);

        if (data.valid) {
            orderData = data;
            showSuccessToast(`✓ ¡Bienvenido, ${data.customer}! Pedido encontrado`);
            renderProductos();
            setTimeout(() => nav(2), 500);
        } else {
            showErrorToast(`❌ ${data.message || "Pedido no encontrado. Verifica tu numero de orden y correo"}`);
        }
    } catch (e) {
        console.error('Error:', e);
        removeToast(loadingToast);
        showErrorToast("❌ Error de conexion. Por favor, verifica que el servidor este activo e intenta nuevamente");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// ===== PASO 2: RENDERIZAR PRODUCTOS =====
function renderProductos() {
    const c = document.getElementById('product-list-container');
    c.innerHTML = '';

    orderData.items.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'product-row';
        row.id = `row-${idx}`;

        const header = document.createElement('div');
        header.className = 'prod-header';
        header.innerHTML = `
                <div class="chk-box" id="chk-${idx}" role="checkbox" aria-checked="false" tabindex="0">
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <img src="${item.image || ''}" alt="${item.name}" class="prod-img">
                <div class="prod-info">
                    <div class="prod-title">${item.name}</div>
                    <div class="prod-meta">${item.current_variant_title || 'Unitalla'}</div>
                </div>
                <div class="prod-price">$${item.price}</div>
            `;

        header.addEventListener('click', () => toggleRow(idx));
        const chkbox = header.querySelector('.chk-box');
        chkbox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleRow(idx);
            }
        });

        const body = document.createElement('div');
        body.className = 'prod-body';
        body.id = `body-${idx}`;
        body.innerHTML = `
                <label for="reason-${idx}">Razon del cambio (Requerido)</label>
                <select id="reason-${idx}">
                    <option value="">Selecciona...</option>
                    <option value="Talla/Color incorrecto">Talla/Color</option>
                    <option value="No era lo que esperaba">No era lo que esperaba</option>
                    <option value="Defecto">Defecto</option>
                </select>
                <label for="request-type-${idx}" style="margin-top:10px;">Tipo de solicitud</label>
                <select id="request-type-${idx}">
                    <option value="">Selecciona...</option>
                    <option value="Cambio">Cambio</option>
                    <option value="Reembolso">Devolucion</option>
                </select>
                <div class="muted" id="type-hint-${idx}" style="margin-top:6px;"></div>
                <label for="file-${idx}" style="margin-top:10px;">Subir foto</label>
                <input type="file" id="file-${idx}" accept="image/*">
                <div id="file-error-${idx}" class="error-message"></div>
                <div class="photo-preview" id="preview-${idx}"></div>
            `;

        const reasonSelect = body.querySelector(`#reason-${idx}`);
        reasonSelect.addEventListener('change', () => updateData(idx));
        const typeSelect = body.querySelector(`#request-type-${idx}`);
        typeSelect.addEventListener('change', () => updateData(idx));
        const fileInput = body.querySelector(`#file-${idx}`);
        fileInput.addEventListener('change', () => updateData(idx));

        row.appendChild(header);
        row.appendChild(body);
        c.appendChild(row);
    });
}

function toggleRow(idx) {
    const chk = document.getElementById(`chk-${idx}`);
    const body = document.getElementById(`body-${idx}`);
    const row = document.getElementById(`row-${idx}`);

    if (chk.classList.contains('checked')) {
        chk.classList.remove('checked');
        chk.setAttribute('aria-checked', 'false');
        body.classList.remove('open');
        row.classList.remove('active');
        delete seleccion[idx];
    } else {
        chk.classList.add('checked');
        chk.setAttribute('aria-checked', 'true');
        body.classList.add('open');
        row.classList.add('active');
        seleccion[idx] = { reason: '', requestType: '', replacementVariantId: null, replacementTitle: '', replacementColor: '', replacementSize: '' };
    }

    const changeBox = document.getElementById('change-items');
    if (changeBox && changeBox.style.display === 'block') {
        renderChangeItems();
    }
}

function updateData(idx) {
    if (seleccion[idx]) {
        const reasonValue = document.getElementById(`reason-${idx}`).value;
        const typeSelect = document.getElementById(`request-type-${idx}`);
        const typeHint = document.getElementById(`type-hint-${idx}`);
        const reasonLower = String(reasonValue || '').toLowerCase();

        seleccion[idx].reason = reasonValue;

        if (typeSelect) {
            let allowedTypes = ['Cambio', 'Reembolso'];
            if (reasonLower === 'talla/color incorrecto') {
                allowedTypes = ['Cambio'];
            } else if (reasonLower === 'no era lo que esperaba') {
                allowedTypes = ['Reembolso'];
            }

            Array.from(typeSelect.options).forEach(opt => {
                if (!opt.value) return;
                opt.disabled = !allowedTypes.includes(opt.value);
            });

            if (!allowedTypes.includes(typeSelect.value)) {
                typeSelect.value = allowedTypes.length === 1 ? allowedTypes[0] : '';
            }

            if (typeHint) {
                if (reasonLower === 'talla/color incorrecto') {
                    typeHint.textContent = 'Solo disponible como Cambio.';
                } else if (reasonLower === 'no era lo que esperaba') {
                    typeHint.textContent = 'Solo disponible como Devolucion.';
                } else if (reasonLower === 'defecto') {
                    typeHint.textContent = 'Disponible como Cambio o Devolucion.';
                } else {
                    typeHint.textContent = '';
                }
            }

            seleccion[idx].requestType = typeSelect.value;

            if (seleccion[idx].requestType !== 'Cambio') {
                seleccion[idx].replacementVariantId = null;
                seleccion[idx].replacementTitle = '';
                seleccion[idx].replacementColor = '';
                seleccion[idx].replacementSize = '';
            }
        }
        const fileInput = document.getElementById(`file-${idx}`);
        if (fileInput.files[0]) {
            const file = fileInput.files[0];
            const maxSize = 5 * 1024 * 1024; // 5MB
            const preview = document.getElementById(`preview-${idx}`);

            if (file.size > maxSize) {
                showError(`file-error-${idx}`, 'La foto no debe superar 5MB');
                seleccion[idx].file = null;
                fileInput.classList.add('error');
                if (preview) preview.classList.remove('active');
                return;
            }

            if (!file.type.startsWith('image/')) {
                showError(`file-error-${idx}`, 'Solo se aceptan imagenes');
                seleccion[idx].file = null;
                fileInput.classList.add('error');
                if (preview) preview.classList.remove('active');
                return;
            }

            seleccion[idx].file = file;
            hideError(`file-error-${idx}`);
            fileInput.classList.remove('error');

            // Preview
            const reader = new FileReader();
            reader.onload = (e) => {
                if (!preview) return;
                preview.innerHTML = `
                        <img src="${e.target.result}" alt="Preview">
                        <p>${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)</p>
                        <button type="button" class="photo-remove" onclick="removePhoto(${idx})">Eliminar foto</button>
                    `;
                preview.classList.add('active');
            };
            reader.readAsDataURL(file);
        }
    }
    const changeBox = document.getElementById('change-items');
    if (changeBox && changeBox.style.display !== 'none') {
        renderChangeItems();
    }
}

function removePhoto(idx) {
    const fileInput = document.getElementById(`file-${idx}`);
    fileInput.value = '';
    const preview = document.getElementById(`preview-${idx}`);
    if (preview) preview.classList.remove('active');
    hideError(`file-error-${idx}`);
    fileInput.classList.remove('error');
    if (seleccion[idx]) {
        seleccion[idx].file = null;
    }
}

function validarSeleccion() {
    const keys = Object.keys(seleccion);
    if (keys.length === 0) {
        showErrorToast("❌ Selecciona al menos un producto para continuar");
        return;
    }

    for (let k of keys) {
        if (!seleccion[k].reason) {
            showErrorToast("❌ Selecciona la razon de devolucion para todos los productos");
            return;
        }
        if (!seleccion[k].requestType) {
            showErrorToast("❌ Selecciona el tipo de solicitud para todos los productos");
            return;
        }
        if (String(seleccion[k].reason).toLowerCase() === 'defecto' && !seleccion[k].file) {
            showErrorToast("❌ En defecto es obligatorio subir una foto del producto");
            return;
        }
    }
    
    // Verificar si hay cambios
    const hasChanges = keys.some(k => seleccion[k]?.requestType === 'Cambio');
    if (hasChanges) {
        // Si hay cambios, ir al step 3 para seleccionar tallas
        nav(3);
        renderChangeItems();
    } else {
        // Si solo hay devoluciones/reembolsos, ir directo al resumen de pago (step 4)
        tipoFinal = resolveTipoFinal();
        irAPago(tipoFinal);
        nav(4);
    }
}

function renderChangeItems() {
    const list = document.getElementById('change-items-list');
    const changeBox = document.getElementById('change-items');
    const continueBtn = document.getElementById('btn-continue-summary');
    if (!list || !changeBox) return;

    const keys = Object.keys(seleccion);
    const changeKeys = keys.filter(idx => seleccion[idx]?.requestType === 'Cambio');
    if (changeKeys.length === 0) {
        changeBox.style.display = 'none';
        if (continueBtn) continueBtn.style.display = 'inline-block';
        return;
    }

    changeBox.style.display = 'block';
    if (continueBtn) continueBtn.style.display = 'none';
    list.innerHTML = '';
    changeKeys.forEach(idx => {
        const item = orderData.items[idx];
        const s = seleccion[idx];
        const hasChange = !!s.replacementVariantId;
        const replacementLabel = formatReplacement(s);

        const row = document.createElement('div');
        row.className = 'change-item';
        row.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:600;">${item.name}</div>
                    <div class="change-item-meta">Actual: ${item.current_variant_title || 'Unitalla'}</div>
                    <div class="change-item-meta">Nuevo: ${replacementLabel}</div>
                </div>
                <div class="change-actions">
                    <span class="change-status ${hasChange ? 'done' : 'pending'}">${hasChange ? 'Listo' : 'Pendiente'}</span>
                    <button class="btn" type="button" data-change-idx="${idx}" aria-label="Seleccionar talla o color de la prenda nueva para ${item.name}">Elegir talla/color</button>
                </div>
            `;
        list.appendChild(row);
    });

    list.querySelectorAll('button[data-change-idx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.getAttribute('data-change-idx');
            abrirModal(idx);
        });
    });
}

// ===== PASO 3: DECISION Y MODAL =====
function abrirModal(idx) {
    const targetIdx = (idx !== undefined && idx !== null) ? idx : Object.keys(seleccion)[0];
    const item = orderData.items[targetIdx];
    if (!item) {
        showErrorToast("❌ Selecciona un producto para cambio");
        return;
    }
    cambioConfig.itemIndex = targetIdx;
    cambioConfig.nuevaVariantId = seleccion[targetIdx]?.replacementVariantId || null;
    cambioConfig.nuevaTalla = seleccion[targetIdx]?.replacementTitle || '';
    cambioConfig.nuevaColor = seleccion[targetIdx]?.replacementColor || '';
    cambioConfig.nuevaSize = seleccion[targetIdx]?.replacementSize || '';

    document.getElementById('modal-talla').style.display = 'flex';
    document.getElementById('m-img').src = item.image || '';
    document.getElementById('m-img').alt = item.name;
    document.getElementById('m-name').innerText = item.name;
    document.getElementById('m-price').innerText = `$${item.price}`;

    const grid = document.getElementById('m-sizes');
    const selectedLabel = document.getElementById('m-selected');
    grid.innerHTML = '';

    if (selectedLabel) {
        const initial = formatReplacement({
            replacementColor: cambioConfig.nuevaColor,
            replacementSize: cambioConfig.nuevaSize,
            replacementTitle: cambioConfig.nuevaTalla
        });
        selectedLabel.textContent = `Nuevo: ${initial}`;
    }

    if (item.available_variants && item.available_variants.length > 0) {
        const optionNames = Array.isArray(item.option_names) ? item.option_names : [];
        const normalizedNames = optionNames.map(n => String(n || '').toLowerCase());
        const colorIndex = normalizedNames.findIndex(n => n.includes('color') || n.includes('colour'));
        const sizeIndex = normalizedNames.findIndex(n => n.includes('talla') || n.includes('size'));

        const getOptionValue = (variant, index) => {
            if (index === 0) return variant.option1 || '';
            if (index === 1) return variant.option2 || '';
            if (index === 2) return variant.option3 || '';
            return '';
        };

        const variants = item.available_variants.map(v => {
            const color = colorIndex >= 0 ? getOptionValue(v, colorIndex) : '';
            const size = sizeIndex >= 0 ? getOptionValue(v, sizeIndex) : '';
            return {
                ...v,
                color: color || 'Unico',
                size: size || (v.title || 'Unico')
            };
        });

        const uniqueColors = [...new Set(variants.map(v => v.color))];
        const hasMultipleColors = uniqueColors.length > 1;
        let selectedColor = cambioConfig.nuevaColor || (hasMultipleColors ? uniqueColors[0] : variants[0]?.color);

        const renderSizes = (color) => {
            const sizeLabel = document.createElement('div');
            sizeLabel.className = 'variant-label';
            sizeLabel.innerText = sizeIndex >= 0 ? 'Selecciona talla:' : 'Selecciona variante:';

            const sizeContainer = document.createElement('div');
            sizeContainer.className = 'size-grid';

            const filtered = color ? variants.filter(v => v.color === color) : variants;
            filtered.forEach(v => {
                const btn = document.createElement('button');
                btn.className = 'size-btn';
                btn.innerText = v.size;
                btn.type = 'button';
                btn.dataset.title = v.title;
                btn.dataset.variantId = v.id;

                if (v.inventory <= 0) {
                    btn.classList.add('disabled');
                    btn.disabled = true;
                    btn.title = 'Sin stock';
                } else {
                    if (cambioConfig.nuevaVariantId && String(cambioConfig.nuevaVariantId) === String(v.id)) {
                        btn.classList.add('selected');
                    }
                    btn.addEventListener('click', () => {
                        sizeContainer.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        cambioConfig.nuevaVariantId = v.id;
                        cambioConfig.nuevaTalla = v.title;
                        cambioConfig.nuevaColor = v.color || '';
                        cambioConfig.nuevaSize = v.size || '';
                        if (selectedLabel) {
                            selectedLabel.textContent = `Nuevo: ${formatReplacement({
                                replacementColor: cambioConfig.nuevaColor,
                                replacementSize: cambioConfig.nuevaSize,
                                replacementTitle: cambioConfig.nuevaTalla
                            })}`;
                        }
                    });
                }
                sizeContainer.appendChild(btn);
            });

            grid.appendChild(sizeLabel);
            grid.appendChild(sizeContainer);
        };

        if (hasMultipleColors) {
            const colorLabel = document.createElement('div');
            colorLabel.className = 'variant-label';
            colorLabel.innerText = 'Selecciona color:';
            grid.appendChild(colorLabel);

            const colorContainer = document.createElement('div');
            colorContainer.className = 'size-grid';

            uniqueColors.forEach(color => {
                const btn = document.createElement('button');
                btn.className = 'size-btn';
                btn.type = 'button';
                btn.innerText = color;

                if (String(selectedColor) === String(color)) {
                    btn.classList.add('selected');
                }

                btn.addEventListener('click', () => {
                    colorContainer.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    selectedColor = color;
                    cambioConfig.nuevaColor = color;
                    cambioConfig.nuevaSize = '';
                    cambioConfig.nuevaVariantId = null;
                    if (selectedLabel) {
                        selectedLabel.textContent = `Nuevo: ${formatReplacement({
                            replacementColor: cambioConfig.nuevaColor,
                            replacementSize: cambioConfig.nuevaSize,
                            replacementTitle: ''
                        })}`;
                    }
                    grid.querySelectorAll('.variant-label, .size-grid').forEach(el => {
                        if (el !== colorLabel && el !== colorContainer) el.remove();
                    });
                    renderSizes(selectedColor);
                });

                colorContainer.appendChild(btn);
            });

            grid.appendChild(colorContainer);
            renderSizes(selectedColor);
        } else {
            renderSizes(selectedColor);
        }
    } else {
        grid.innerHTML = '<p style="color: #666;">No hay variantes disponibles</p>';
    }

    document.getElementById('btn-close-modal').focus();
}

function cerrarModal() {
    document.getElementById('modal-talla').style.display = 'none';
    const fallback = document.getElementById('btn-continue-summary');
    if (fallback) fallback.focus();
}

function confirmarCambio() {
    if (!cambioConfig.nuevaVariantId) {
        showErrorToast("❌ Selecciona talla o color para continuar");
        return;
    }
    if (seleccion[cambioConfig.itemIndex]) {
        seleccion[cambioConfig.itemIndex].replacementVariantId = cambioConfig.nuevaVariantId;
        seleccion[cambioConfig.itemIndex].replacementTitle = cambioConfig.nuevaTalla;
        seleccion[cambioConfig.itemIndex].replacementColor = cambioConfig.nuevaColor;
        seleccion[cambioConfig.itemIndex].replacementSize = cambioConfig.nuevaSize;
    }
    cerrarModal();
    renderChangeItems();
    showSuccessToast("✓ Cambio guardado para el producto seleccionado");
}

// ===== PASO 4: PAGO =====
function resolveTipoFinal() {
    const keys = Object.keys(seleccion);
    const types = keys.map(k => seleccion[k]?.requestType).filter(Boolean);
    const unique = [...new Set(types)];
    if (unique.length === 1) return unique[0];
    return 'Mixto';
}

function irAPago(tipo) {
    tipoFinal = tipo || resolveTipoFinal();
    const txt = document.getElementById('pay-dynamic-text');
    const note = document.getElementById('pay-promo-note');

    const keys = Object.keys(seleccion);
    const changeKeys = keys.filter(k => seleccion[k]?.requestType === 'Cambio');
    if (changeKeys.length > 0) {
        const missing = changeKeys.filter(k => !seleccion[k].replacementVariantId);
        if (missing.length > 0) {
            showErrorToast("❌ Selecciona talla o color para todos los productos de Cambio antes de continuar");
            return;
        }
    }

    // Generar resumen de items
    const itemsList = document.getElementById('payment-items-list');
    itemsList.innerHTML = '';

    let totalItemsValue = 0;

    let refundItemsValue = 0;
    Object.keys(seleccion).forEach(idx => {
        const item = orderData.items[idx];
        const s = seleccion[idx];
        const typeLabel = s.requestType === 'Cambio' ? 'Cambio' : 'Devolucion';

        const qty = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        totalItemsValue += qty * price;
        if (s.requestType === 'Reembolso') {
            refundItemsValue += qty * price;
        }

        const html = `
                <div class="payment-item">
                    <div style="flex: 1;">
                        <div class="payment-item-name">${item.name}</div>
                        <span class="payment-item-reason">${s.reason}</span>
                        ${s.requestType === 'Cambio' ? `<div class="payment-item-reason" style="margin-top:6px;">Nueva prenda: ${formatReplacement(s)}</div>` : ''}
                    </div>
                    <div class="payment-item-type">${typeLabel}</div>
                </div>
            `;
        itemsList.innerHTML += html;
    });

    const refundBreakdown = document.getElementById('refund-breakdown');
    const refundItemsTotal = document.getElementById('refund-items-total');
    const refundGuideCost = document.getElementById('refund-guide-cost');
    const refundCouponTotal = document.getElementById('refund-coupon-total');
    const refundItemsLabel = document.getElementById('refund-items-label');
    const refundGuideLabel = document.getElementById('refund-guide-label');
    const refundCouponLabel = document.getElementById('refund-coupon-label');
    const refundGuideRow = document.getElementById('refund-guide-row');

    const reasons = Object.values(seleccion).map(s => String(s.reason || '').toLowerCase());
    const isDefectRequest = reasons.length > 0 && reasons.includes('defecto');
    const refundReasons = Object.values(seleccion)
        .filter(s => s.requestType === 'Reembolso')
        .map(s => String(s.reason || '').toLowerCase());
    const isNoEsperaba = refundReasons.length > 0 && refundReasons.includes('no era lo que esperaba');
    const payBtn = document.getElementById('btn-pay');
    const payAmount = document.getElementById('pay-amount');
    const payTitle = document.getElementById('pay-title');

    if (refundItemsValue > 0) {
        txt.innerHTML = "Al finalizar, se te enviara un <b>cupon de tienda</b> por el valor de las prendas seleccionadas.";
        note.style.display = 'none';

        const baseTotal = refundItemsValue;
        const couponValue = (isDefectRequest || isNoEsperaba)
            ? baseTotal
            : Math.max(baseTotal - GUIDE_COST, 0);

        if (refundBreakdown) refundBreakdown.style.display = 'block';
        if (refundItemsLabel) refundItemsLabel.textContent = 'Valor de prendas seleccionadas';

        if (refundCouponLabel) refundCouponLabel.textContent = 'Cupon por prendas seleccionadas';
        if (refundItemsTotal) refundItemsTotal.textContent = formatMoney(baseTotal);
        if (refundGuideCost) refundGuideCost.textContent = (isDefectRequest || isNoEsperaba)
            ? ''
            : `-${formatMoney(GUIDE_COST)}`;
        if (refundCouponTotal) refundCouponTotal.textContent = formatMoney(couponValue);
        if (refundGuideRow) refundGuideRow.style.display = (isDefectRequest || isNoEsperaba) ? 'none' : 'flex';
    } else {
        txt.innerHTML = "Estas pagando la guia de tu domicilio a nuestro taller";
        note.style.display = 'inline-block';
        note.innerText = "✨ ¡La guia de tu cambio nosotros la cubrimos!";

        if (refundBreakdown) refundBreakdown.style.display = 'none';
    }
    if (isDefectRequest) {
        if (payTitle) payTitle.style.display = 'none';
        if (payAmount) {
            payAmount.textContent = 'Defecto confirmado: no se requiere pago y te enviaremos la guia.';
            payAmount.classList.add('defect-note');
        }
        txt.innerHTML = '';
        note.style.display = 'none';
        if (payBtn) payBtn.innerText = 'Generar guia';
    } else {
        if (payTitle) payTitle.style.display = '';
        if (payAmount) {
            payAmount.textContent = '$150.00';
            payAmount.classList.remove('defect-note');
        }
        if (payBtn) payBtn.innerText = 'Procesar Pago';
    }
    nav(4);
}

// ===== PASO 5: PROCESAR PAGO =====
async function procesarPago() {
    const btn = document.getElementById('btn-pay');
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerHTML = '<div class="loading-spinner" style="display:inline-block;margin-right:8px;"></div>Procesando solicitud...';

    const formData = new FormData();
    const orderNumber = orderData.orderNumber || orderData.orderId;
    formData.append('orderId', orderData.orderId);
    formData.append('orderNumber', orderNumber);
    formData.append('returnType', tipoFinal);
    formData.append('contactEmail', document.getElementById('email').value);
    if (orderData && orderData.customer) {
        formData.append('customerName', orderData.customer);
    }

    const itemsPayload = [];
    Object.keys(seleccion).forEach(idx => {
        const s = seleccion[idx];
        const original = orderData.items[idx];

        const fileInput = document.getElementById(`file-${idx}`);
        const selectedFile = (fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0] : s.file;

        if (selectedFile) {
            formData.append(`evidence_${original.id}`, selectedFile);
        }

        const isCambioItem = s.requestType === 'Cambio';
        itemsPayload.push({
            variantId: original.id,
            name: original.name || 'Producto',
            current_variant_title: original.current_variant_title || '',
            quantity: original.quantity || 1,
            price: original.price,
            reason: s.reason,
            requestType: s.requestType,
            replacementVariantId: isCambioItem ? s.replacementVariantId : null,
            replacementTitle: isCambioItem ? (s.replacementTitle || '') : '',
            replacementColor: isCambioItem ? (s.replacementColor || '') : '',
            replacementSize: isCambioItem ? (s.replacementSize || '') : ''
        });
    });
    formData.append('items', JSON.stringify(itemsPayload));

    let loadingToast = showLoadingToast("Guardando tu solicitud...");

    try {
        // Paso 1: Guardar solicitud en DB
        const res = await fetch(`${API_BASE}/api/submit-return`, {
            method: 'POST',
            mode: 'cors',
            body: formData
        });
        const data = await res.json();

        removeToast(loadingToast);

        if (data.success && data.requestId) {
            if (data.skipPayment) {
                // Calcular cupón SOLO basado en los items de REEMBOLSO
                // Cupón = 100% del valor de las prendas devueltas (SIN descontar nada)
                const refundItems = Object.keys(seleccion).filter(idx => seleccion[idx].requestType === 'Reembolso');
                const couponValue = refundItems.reduce((sum, idx) => sum + parseFloat(orderData.items[idx].price || 0) * (orderData.items[idx].quantity || 1), 0);
                
                localStorage.setItem('mon_request_id', data.requestId);
                localStorage.setItem('mon_contact_email', document.getElementById('email').value || '');
                localStorage.setItem('mon_order_data', JSON.stringify({
                    orderId: orderData.orderId,
                    orderNumber: orderData.orderNumber,
                    customer: orderData.customer,
                    orderTotal: orderData.orderTotal,
                    orderCurrency: orderData.orderCurrency,
                    items: Object.keys(seleccion).map(idx => ({
                        name: orderData.items[idx].name,
                        price: orderData.items[idx].price,
                        quantity: orderData.items[idx].quantity,
                        reason: seleccion[idx].reason,
                        requestType: seleccion[idx].requestType,
                        replacementTitle: seleccion[idx].replacementTitle,
                        replacementColor: seleccion[idx].replacementColor,
                        replacementSize: seleccion[idx].replacementSize
                    })),
                    tipo: tipoFinal,
                    fecha: new Date().toLocaleDateString('es-MX'),
                    coupon: couponValue > 0 ? couponValue : null
                }));

                showSuccessToast("✓ Solicitud guardada. Generando guia...");
                setTimeout(() => {
                    window.location.href = `${API_BASE}/success.html?request_id=${encodeURIComponent(data.requestId)}`;
                }, 800);
                return;
            }
            // Paso 2: Crear sesión de Stripe
            loadingToast = showLoadingToast("Redirigiendo a pago seguro...");

            const checkoutRes = await fetch(`${API_BASE}/api/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                mode: 'cors',
                body: JSON.stringify({
                    requestId: data.requestId,
                    amount: data.paymentDetails.amount,
                    currency: data.paymentDetails.currency.toLowerCase(),
                    description: data.paymentDetails.description,
                    orderId: orderNumber,
                    contactEmail: document.getElementById('email').value
                })
            });

            const checkoutData = await checkoutRes.json();
            removeToast(loadingToast);

            if (checkoutData.success && checkoutData.url) {
                // Calcular cupón SOLO basado en los items de REEMBOLSO
                // Cupón = 100% del valor de las prendas devueltas (SIN descontar nada)
                const refundItems = Object.keys(seleccion).filter(idx => seleccion[idx].requestType === 'Reembolso');
                const couponValue = refundItems.reduce((sum, idx) => sum + parseFloat(orderData.items[idx].price || 0) * (orderData.items[idx].quantity || 1), 0);
                
                // Guardar requestId localmente antes de redirigir
                localStorage.setItem('mon_request_id', data.requestId);
                localStorage.setItem('mon_contact_email', document.getElementById('email').value || '');
                localStorage.setItem('mon_order_data', JSON.stringify({
                    orderId: orderData.orderId,
                    orderNumber: orderData.orderNumber,
                    customer: orderData.customer,
                    orderTotal: orderData.orderTotal,
                    orderCurrency: orderData.orderCurrency,
                    items: Object.keys(seleccion).map(idx => ({
                        name: orderData.items[idx].name,
                        price: orderData.items[idx].price,
                        quantity: orderData.items[idx].quantity,
                        reason: seleccion[idx].reason,
                        requestType: seleccion[idx].requestType,
                        replacementTitle: seleccion[idx].replacementTitle,
                        replacementColor: seleccion[idx].replacementColor,
                        replacementSize: seleccion[idx].replacementSize
                    })),
                    tipo: tipoFinal,
                    fecha: new Date().toLocaleDateString('es-MX'),
                    coupon: couponValue > 0 ? couponValue : null
                }));

                showSuccessToast("✓ Redirigiendo a pago...");

                // Redirigir a Stripe
                setTimeout(() => {
                    window.location.href = checkoutData.url;
                }, 800);
            } else {
                showErrorToast(`❌ ${checkoutData.message || "Error al iniciar pago"}`);
                btn.disabled = false;
                btn.innerText = originalText;
            }
        } else {
            showErrorToast(`❌ ${data.message || "Error al procesar la solicitud"}`);
            btn.disabled = false;
            btn.innerText = originalText;
        }
    } catch (e) {
        console.error('Error:', e);
        removeToast(loadingToast);
        showErrorToast("❌ Error de conexion. Por favor, intenta nuevamente");
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

function generateTrackingNumber() {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `MON-${random}-${timestamp}`;
}

function generateSummary() {
    const summaryEl = document.getElementById('summary-content');
    let html = '';

    const keys = Object.keys(seleccion);
    const grupos = {
        Cambio: keys.filter(k => seleccion[k]?.requestType === 'Cambio'),
        Devolucion: keys.filter(k => seleccion[k]?.requestType === 'Reembolso')
    };

    if (grupos.Cambio.length > 0) {
        html += '<div style="font-weight:700; margin-bottom:8px;">Productos para Cambio</div>';
        grupos.Cambio.forEach(idx => {
            const item = orderData.items[idx];
            const s = seleccion[idx];
            html += `
                    <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
                        <div style="font-weight: 600; margin-bottom: 4px;">${item.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">
                            Razon: ${s.reason}<br>
                            Nueva prenda: ${formatReplacement(s)}
                        </div>
                    </div>
                `;
        });
    }

    if (grupos.Devolucion.length > 0) {
        html += '<div style="font-weight:700; margin:16px 0 8px;">Productos para Devolucion</div>';
        grupos.Devolucion.forEach(idx => {
            const item = orderData.items[idx];
            const s = seleccion[idx];
            html += `
                    <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
                        <div style="font-weight: 600; margin-bottom: 4px;">${item.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">
                            Razon: ${s.reason}
                        </div>
                    </div>
                `;
        });
    }

    summaryEl.innerHTML = html;
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    // Paso 1
    document.getElementById('btn-search').addEventListener('click', buscarPedido);
    document.getElementById('email').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') buscarPedido();
    });

    // Paso 2
    document.getElementById('btn-next-prod').addEventListener('click', validarSeleccion);

    // Paso 3
    const continueToPayment = () => {
        renderChangeItems();
        irAPago();
    };

    document.getElementById('btn-change-continue').addEventListener('click', continueToPayment);
    document.getElementById('btn-continue-summary').addEventListener('click', continueToPayment);

    document.getElementById('link-back-3').addEventListener('click', () => nav(2));

    // Paso 4
    document.getElementById('btn-pay').addEventListener('click', procesarPago);
    document.getElementById('link-back-4').addEventListener('click', () => nav(3));

    // Modal
    document.getElementById('btn-close-modal').addEventListener('click', cerrarModal);
    document.getElementById('btn-confirm-size').addEventListener('click', confirmarCambio);
    const termsLink = document.getElementById('terms-link');
    const termsModal = document.getElementById('modal-terms');
    const acceptTermsBtn = document.getElementById('btn-accept-terms');
    const termsCheckbox = document.getElementById('terms-accept');
    let termsAccepted = false;

    const openTerms = () => {
        if (!termsModal) return;
        termsModal.classList.add('active');
        document.body.classList.add('terms-locked');
    };

    const acceptTerms = () => {
        termsAccepted = true;
        if (termsCheckbox) termsCheckbox.checked = true;
        if (termsModal) termsModal.classList.remove('active');
        document.body.classList.remove('terms-locked');
    };

    if (termsLink && termsModal) {
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openTerms();
        });
    }

    if (acceptTermsBtn) {
        acceptTermsBtn.addEventListener('click', acceptTerms);
    }

    openTerms();

    // ESC cierra modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal-talla');
            if (modal.style.display === 'flex') cerrarModal();
            if (termsModal && termsModal.classList.contains('active') && termsAccepted) {
                termsModal.classList.remove('active');
                document.body.classList.remove('terms-locked');
            }
        }
    });

    // Click fuera del modal cierra
    document.getElementById('modal-talla').addEventListener('click', (e) => {
        if (e.target.id === 'modal-talla') {
            cerrarModal();
        }
    });
});
