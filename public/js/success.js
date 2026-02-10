const urlParams = new URLSearchParams(window.location.search);
const paymentId = urlParams.get('payment_id') || urlParams.get('collection_id');
const requestIdParam = urlParams.get('request_id');
const paypalToken = urlParams.get('token'); // PayPal order ID

const API_BASE = (function() {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isDev ? 'http://localhost:3000' : window.location.origin;
})();

async function verifyPayment() {
    const container = document.getElementById('content');

    // Si viene de PayPal (tiene token en la URL)
    if (paypalToken) {
        container.innerHTML = `
            <div class="success-icon">⏳</div>
            <h1>Procesando tu pago...</h1>
            <p>Estamos confirmando tu pago con PayPal. Por favor espera.</p>
        `;
        
        try {
            // Capturar el pago de PayPal
            const captureRes = await fetch(`${API_BASE}/api/capture-paypal-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: paypalToken,
                    requestId: requestIdParam || localStorage.getItem('mon_request_id')
                })
            });
            
            const captureData = await captureRes.json();
            
            if (captureData.success && captureData.status === 'approved') {
                const finalRequestId = requestIdParam || localStorage.getItem('mon_request_id');
                await renderPayPalSuccess(finalRequestId);
            } else {
                container.innerHTML = `
                    <div class="success-icon">❌</div>
                    <h1>Error en el pago</h1>
                    <p>${captureData.message || 'No se pudo completar tu pago. Por favor, intenta nuevamente.'}</p>
                    <a href="/" class="btn">Volver al inicio</a>
                `;
            }
        } catch (error) {
            console.error('Error capturando pago PayPal:', error);
            container.innerHTML = `
                <div class="success-icon">❌</div>
                <h1>Error</h1>
                <p>Ocurrió un error al procesar tu pago. Por favor, contacta con soporte.</p>
                <a href="/" class="btn">Volver al inicio</a>
            `;
        }
        return;
    }

    if (!paymentId && requestIdParam) {
        renderSuccess(requestIdParam, true);
        return;
    }

    if (!paymentId) {
        container.innerHTML = `
                    <div class="success-icon">❌</div>
                    <h1>Error</h1>
                    <p>No se encontro informacion del pago.</p>
                    <a href="/" class="btn">Volver al inicio</a>
                `;
        return;
    }

    try {
        const verifyRes = await fetch(`${API_BASE}/api/verify-mp-payment/${encodeURIComponent(paymentId)}`);
        const verifyData = await verifyRes.json();

        if (!verifyData.success) {
            throw new Error('No se pudo verificar el pago');
        }

        const paymentStatus = verifyData.paymentStatus;
        const amountValid = verifyData.amountValid;
        const isPaid = paymentStatus === 'approved';

        if (amountValid === false) {
            container.innerHTML = `
                        <div class="success-icon">❌</div>
                        <h1>Error de pago</h1>
                        <p>El monto del pago no coincide con la solicitud. Contacta soporte.</p>
                        <a href="/" class="btn">Volver al inicio</a>
                    `;
            return;
        }

        if (!isPaid) {
            container.innerHTML = `
                        <div class="success-icon">⏳</div>
                        <h1>Pago en proceso</h1>
                        <p>Tu pago aun no se confirma. Intenta de nuevo en unos minutos.</p>
                        <a href="/success.html?payment_id=${encodeURIComponent(paymentId)}" class="btn">Reintentar verificacion</a>
                    `;
            return;
        }

        const trackingNumber = '—';
        const orderData = JSON.parse(localStorage.getItem('mon_order_data') || '{}');

        let summaryHtml = '';
        if (orderData.items && orderData.items.length > 0) {
            summaryHtml = `
                        <div class="summary">
                            <h3>Resumen de tu solicitud</h3>
                            ${orderData.items.map(item => `
                                <div class="summary-item">
                                    <div style="font-weight:600;">${item.name}</div>
                                    <div style="font-size:12px;color:var(--text-secondary);">
                                        Razon: ${item.reason}
                                        ${item.replacementColor || item.replacementSize ? `<br>Nueva prenda: ${[item.replacementColor ? `Color: ${item.replacementColor}` : '', item.replacementSize ? `Talla: ${item.replacementSize}` : ''].filter(Boolean).join(' • ')}` : (item.replacementTitle ? `<br>Nueva prenda: ${item.replacementTitle}` : '')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
        }

        container.innerHTML = `
                    <div class="success-icon">✅</div>
                    <h1>¡Pago Confirmado!</h1>
                    <p>Tu solicitud de ${orderData.tipo || 'devolucion'} ha sido procesada exitosamente.</p>
                    
                    <div class="tracking">
                        <div class="tracking-label">Tu numero de seguimiento:</div>
                        <div class="tracking-number" id="tracking-number">${trackingNumber}</div>
                        <div class="tracking-actions">
                            <button class="tracking-btn" id="btn-copy-tracking" type="button">Copiar</button>
                            <a class="tracking-btn" id="btn-track-link" href="#" target="_blank" rel="noopener">Rastrear</a>
                        </div>
                    </div>

                    ${summaryHtml}

                    <p>Recibiras un correo con los detalles y las instrucciones para enviar tu producto.</p>
                    <p style="font-size:14px;">Guarda tu numero de seguimiento para consultar el estado de tu solicitud.</p>

                    <div class="label-section">
                        <a id="btn-download-label" class="btn disabled" href="#">Descargar guia</a>
                        <div id="label-note" class="label-note">Preparando tu guia...</div>
                    </div>
                    
                    <a href="/" class="btn">Volver al inicio</a>
                `;

        const copyBtn = document.getElementById('btn-copy-tracking');
        const trackLink = document.getElementById('btn-track-link');
        if (copyBtn) {
            copyBtn.setAttribute('disabled', 'disabled');
            copyBtn.style.opacity = '0.6';
            copyBtn.style.pointerEvents = 'none';
        }
        if (trackLink) {
            trackLink.setAttribute('aria-disabled', 'true');
            trackLink.style.opacity = '0.6';
            trackLink.style.pointerEvents = 'none';
        }

        const requestId = localStorage.getItem('mon_request_id');
        await initLabelDownload(requestId);

        // Limpiar localStorage
        localStorage.removeItem('mon_tracking');
        localStorage.removeItem('mon_request_id');
        localStorage.removeItem('mon_order_data');

    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = `
                    <div class="success-icon">✅</div>
                    <h1>¡Pago Confirmado!</h1>
                    <p>Tu solicitud ha sido procesada exitosamente.</p>
                    <p>Recibiras un correo con los detalles.</p>
                    <a href="/" class="btn">Volver al inicio</a>
                `;
    }
}

async function renderSuccess(requestId, noPayment) {
    const container = document.getElementById('content');
    const orderData = JSON.parse(localStorage.getItem('mon_order_data') || '{}');
    const trackingNumber = '—';

    let summaryHtml = '';
    if (orderData.items && Array.isArray(orderData.items)) {
        summaryHtml = `
                    <div class="summary">
                        <h3>Resumen</h3>
                        ${orderData.items.map(item => `
                            <div class="summary-item">
                                <div style="font-weight:600;">${item.name}</div>
                                <div style="font-size:12px;color:var(--text-secondary);">
                                    Razon: ${item.reason}
                                    ${item.replacementColor || item.replacementSize ? `<br>Nueva prenda: ${[item.replacementColor ? `Color: ${item.replacementColor}` : '', item.replacementSize ? `Talla: ${item.replacementSize}` : ''].filter(Boolean).join(' • ')}` : (item.replacementTitle ? `<br>Nueva prenda: ${item.replacementTitle}` : '')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
    }

    container.innerHTML = `
                <div class="success-icon">✅</div>
                <h1>¡Solicitud Recibida!</h1>
                <p>${noPayment ? 'Tu solicitud fue aprobada por defecto y no requiere pago.' : 'Tu solicitud ha sido procesada.'}</p>
                
                <div class="tracking">
                    <div class="tracking-label">Tu numero de seguimiento:</div>
                    <div class="tracking-number" id="tracking-number">${trackingNumber}</div>
                    <div class="tracking-actions">
                        <button class="tracking-btn" id="btn-copy-tracking" type="button">Copiar</button>
                        <a class="tracking-btn" id="btn-track-link" href="#" target="_blank" rel="noopener">Rastrear</a>
                    </div>
                </div>

                ${summaryHtml}

                <p>Recibiras un correo con los detalles y las instrucciones para enviar tu producto.</p>

                <div class="label-section">
                    <a id="btn-download-label" class="btn disabled" href="#">Descargar guia</a>
                    <div id="label-note" class="label-note">Preparando tu guia...</div>
                </div>
                
                <a href="/" class="btn">Volver al inicio</a>
            `;

    await initLabelDownload(requestId);
}

async function renderPayPalSuccess(requestId) {
    const container = document.getElementById('content');
    const orderData = JSON.parse(localStorage.getItem('mon_order_data') || '{}');
    const trackingNumber = '—';

    let summaryHtml = '';
    if (orderData.items && Array.isArray(orderData.items)) {
        summaryHtml = `
                    <div class="summary">
                        <h3>Resumen</h3>
                        ${orderData.items.map(item => `
                            <div class="summary-item">
                                <div style="font-weight:600;">${item.name}</div>
                                <div style="font-size:12px;color:var(--text-secondary);">
                                    Razon: ${item.reason}
                                    ${item.replacementColor || item.replacementSize ? `<br>Nueva prenda: ${[item.replacementColor ? `Color: ${item.replacementColor}` : '', item.replacementSize ? `Talla: ${item.replacementSize}` : ''].filter(Boolean).join(' • ')}` : (item.replacementTitle ? `<br>Nueva prenda: ${item.replacementTitle}` : '')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
    }

    container.innerHTML = `
                <div class="success-icon">✅</div>
                <h1>¡Pago Confirmado!</h1>
                <p>Tu solicitud de ${orderData.tipo || 'devolucion'} ha sido procesada exitosamente.</p>
                
                <div class="tracking">
                    <div class="tracking-label">Tu numero de seguimiento:</div>
                    <div class="tracking-number" id="tracking-number">${trackingNumber}</div>
                    <div class="tracking-actions">
                        <button class="tracking-btn" id="btn-copy-tracking" type="button">Copiar</button>
                        <a class="tracking-btn" id="btn-track-link" href="#" target="_blank" rel="noopener">Rastrear</a>
                    </div>
                </div>

                ${summaryHtml}

                <p>Recibiras un correo con los detalles y las instrucciones para enviar tu producto.</p>
                <p style="font-size:14px;">Guarda tu numero de seguimiento para consultar el estado de tu solicitud.</p>

                <div class="label-section">
                    <a id="btn-download-label" class="btn disabled" href="#">Descargar guia</a>
                    <div id="label-note" class="label-note">Preparando tu guia...</div>
                </div>
                
                <a href="/" class="btn">Volver al inicio</a>
            `;

    const copyBtn = document.getElementById('btn-copy-tracking');
    const trackLink = document.getElementById('btn-track-link');
    if (copyBtn) {
        copyBtn.setAttribute('disabled', 'disabled');
        copyBtn.style.opacity = '0.6';
        copyBtn.style.pointerEvents = 'none';
    }
    if (trackLink) {
        trackLink.setAttribute('aria-disabled', 'true');
        trackLink.style.opacity = '0.6';
        trackLink.style.pointerEvents = 'none';
    }

    await initLabelDownload(requestId);

    // Limpiar localStorage
    localStorage.removeItem('mon_tracking');
    localStorage.removeItem('mon_request_id');
    localStorage.removeItem('mon_order_data');
}

function base64ToBlob(base64, mime) {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
}

function getExtension(mime) {
    if (!mime) return 'pdf';
    const lower = mime.toLowerCase();
    if (lower.includes('pdf')) return 'pdf';
    if (lower.includes('png')) return 'png';
    if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
    return 'pdf';
}

async function initLabelDownload(requestId) {
    const btn = document.getElementById('btn-download-label');
    const note = document.getElementById('label-note');
    const trackingEl = document.getElementById('tracking-number');
    const copyBtn = document.getElementById('btn-copy-tracking');
    const trackLink = document.getElementById('btn-track-link');

    if (!btn || !note) return;

    if (!requestId) {
        note.textContent = 'Guia no disponible en este momento.';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/label/${encodeURIComponent(requestId)}`);
        const data = await res.json();

        if (!data.success) {
            note.textContent = 'Tu guia aun no esta lista. Intenta mas tarde.';
            return;
        }

        if (data.trackingNumber && trackingEl) {
            trackingEl.textContent = data.trackingNumber;
        }

        if (data.trackingNumber && trackLink) {
            trackLink.href = 'https://track.myeship.co/en/track/eship-es';
            trackLink.setAttribute('aria-disabled', 'false');
            trackLink.style.opacity = '1';
            trackLink.style.pointerEvents = 'auto';
        }

        if (data.trackingNumber && copyBtn) {
            copyBtn.removeAttribute('disabled');
            copyBtn.style.opacity = '1';
            copyBtn.style.pointerEvents = 'auto';
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(data.trackingNumber);
                    copyBtn.textContent = 'Copiado';
                    setTimeout(() => (copyBtn.textContent = 'Copiar'), 1200);
                } catch (e) {
                    const temp = document.createElement('textarea');
                    temp.value = data.trackingNumber;
                    document.body.appendChild(temp);
                    temp.select();
                    document.execCommand('copy');
                    document.body.removeChild(temp);
                    copyBtn.textContent = 'Copiado';
                    setTimeout(() => (copyBtn.textContent = 'Copiar'), 1200);
                }
            }, { once: true });
        }

        if (!data.labelBase64) {
            note.textContent = 'Tu guia aun no esta lista. Intenta mas tarde.';
            return;
        }

        const mime = data.labelMime || 'application/pdf';
        const blob = base64ToBlob(data.labelBase64, mime);
        const url = URL.createObjectURL(blob);
        const ext = getExtension(mime);
        const filename = `guia-${data.trackingNumber || 'myeship'}.${ext}`;

        btn.classList.remove('disabled');
        btn.href = url;
        btn.download = filename;
        note.textContent = data.trackingNumber
            ? `Tracking MyeShip: ${data.trackingNumber}`
            : 'Guia lista para descargar.';
    } catch (err) {
        console.error('Error descargando guia:', err);
        note.textContent = 'No se pudo obtener la guia. Intenta mas tarde.';
    }
}

verifyPayment();
