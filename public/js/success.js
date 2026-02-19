const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');
const requestIdParam = urlParams.get('request_id');

const API_BASE = (function() {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isDev ? 'http://localhost:3000' : window.location.origin;
})();

async function verifyPayment() {
    const container = document.getElementById('content');

    if (sessionId) {
        container.innerHTML = `
            <div class="success-icon">⏳</div>
            <h1>Verificando pago...</h1>
            <p>Estamos confirmando tu pago con Stripe. Por favor espera.</p>
        `;

        try {
            const verifyRes = await fetch(`${API_BASE}/api/verify-payment/${encodeURIComponent(sessionId)}`);
            const verifyData = await verifyRes.json();

            if (!verifyData.success) {
                throw new Error('No se pudo verificar el pago');
            }

            const paymentStatus = verifyData.paymentStatus;
            const isPaid = paymentStatus === 'paid' || paymentStatus === 'no_payment_required';
            const metadata = verifyData.metadata || {};
            const finalRequestId = metadata.requestId || requestIdParam || localStorage.getItem('mon_request_id');

            if (!isPaid) {
                container.innerHTML = `
                    <div class="success-icon">⏳</div>
                    <h1>Pago en proceso</h1>
                    <p>Tu pago aun no se confirma. Intenta de nuevo en unos minutos.</p>
                    <a href="/success.html?session_id=${encodeURIComponent(sessionId)}" class="btn">Reintentar verificacion</a>
                `;
                return;
            }

            await renderStripeSuccess(finalRequestId);
        } catch (error) {
            console.error('Error verificando pago Stripe:', error);
            container.innerHTML = `
                <div class="success-icon">❌</div>
                <h1>Error</h1>
                <p>Ocurrió un error al procesar tu pago. Por favor, contacta con soporte.</p>
                <a href="/" class="btn">Volver al inicio</a>
            `;
        }
        return;
    }

    if (requestIdParam) {
        renderSuccess(requestIdParam, true);
        return;
    }

    container.innerHTML = `
        <div class="success-icon">❌</div>
        <h1>Error</h1>
        <p>No se encontro informacion del pago.</p>
        <a href="/" class="btn">Volver al inicio</a>
    `;
}

async function renderSuccess(requestId, noPayment) {
    const container = document.getElementById('content');
    const orderData = JSON.parse(localStorage.getItem('mon_order_data') || '{}');
    const contactEmail = localStorage.getItem('mon_contact_email') || '';
    const trackingNumber = '—';

    let summaryHtml = '';
    if (orderData.items && Array.isArray(orderData.items)) {
        summaryHtml = `
            <div style="background: var(--bg-lighter); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: left; border: 1px solid var(--border-light);">
                <h3 style="font-family: 'HelveticaNeueLTProHv', sans-serif; font-size: 18px; margin-bottom: 20px; color: var(--primary);">📋 Resumen de tu Solicitud</h3>
                
                <!-- Información de la orden -->
                <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--primary);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px; line-height: 1.6;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">Número de Orden</div>
                            <div style="font-size: 16px; font-weight: 700; color: var(--primary);">${orderData.orderNumber || '—'}</div>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">Cliente</div>
                            <div style="font-size: 14px; font-weight: 600;">${orderData.customer || '—'}</div>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">Tipo de Solicitud</div>
                            <div style="font-size: 14px; font-weight: 600;">${orderData.tipo || '—'}</div>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">Fecha</div>
                            <div style="font-size: 14px; font-weight: 600;">${orderData.fecha || '—'}</div>
                        </div>
                    </div>
                </div>

                <!-- Items -->
                <div style="margin-top: 20px;">
                    <div style="font-weight: 700; color: var(--primary); margin-bottom: 12px; font-size: 14px;">Productos Seleccionados (${orderData.items.length})</div>
                    ${orderData.items.map((item, idx) => `
                        <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid var(--text-primary);">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${item.name}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">
                                        ${item.quantity ? `Cantidad: ${item.quantity} •` : ''} Precio: $${parseFloat(item.price || 0).toFixed(2)}
                                    </div>
                                </div>
                                <div>
                                    <div style="font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">Tipo de Solicitud</div>
                                    <div style="font-size: 13px; font-weight: 700; color: var(--primary);">${item.requestType || '—'}</div>
                                </div>
                            </div>
                            <div style="padding-top: 12px; border-top: 1px solid var(--border-light);">
                                <div style="font-size: 12px; margin-bottom: 8px; line-height: 1.6;">
                                    <strong>Motivo:</strong> ${item.reason || '—'}
                                </div>
                                ${item.requestType === 'Cambio' && (item.replacementColor || item.replacementSize || item.replacementTitle) ? `
                                    <div style="font-size: 12px; color: var(--text-secondary); background: rgba(0,0,0,0.02); padding: 8px; border-radius: 6px;">
                                        <strong>🔄 Nueva Prenda:</strong> 
                                        ${[
                                            item.replacementTitle ? item.replacementTitle : '',
                                            item.replacementColor ? `Color: ${item.replacementColor}` : '',
                                            item.replacementSize ? `Talla: ${item.replacementSize}` : ''
                                        ].filter(Boolean).join(' • ')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Total -->
                <div style="background: var(--bg-light); padding: 16px; border-radius: 8px; margin-top: 16px; border: 1px solid var(--border-light);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600; font-size: 14px;">Total de la Orden:</span>
                        <span style="font-size: 18px; font-weight: 700; color: var(--primary);">$${parseFloat(orderData.orderTotal || 0).toFixed(2)} ${orderData.orderCurrency || 'MXN'}</span>
                    </div>
                </div>

                <!-- Email -->
                <div style="background: rgba(56, 142, 60, 0.08); padding: 12px; border-radius: 8px; margin-top: 16px; border-left: 3px solid var(--success-color); font-size: 12px;">
                    <strong>📧 Confirmación enviada a:</strong> ${contactEmail}
                </div>
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

async function renderStripeSuccess(requestId) {
    const container = document.getElementById('content');
    const orderData = JSON.parse(localStorage.getItem('mon_order_data') || '{}');
    const contactEmail = localStorage.getItem('mon_contact_email') || '';
    const trackingNumber = '—';

    let summaryHtml = '';
    if (orderData.items && Array.isArray(orderData.items)) {
        summaryHtml = `
            <div style="background: var(--bg-lighter); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: left; border: 1px solid var(--border-light);">
                <h3 style="font-family: 'HelveticaNeueLTProHv', sans-serif; font-size: 18px; margin-bottom: 20px; color: var(--primary);">📋 Resumen de tu Solicitud</h3>
                
                <!-- Información de la orden -->
                <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px; border-left: 4px solid var(--primary);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px; line-height: 1.6;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">Número de Orden</div>
                            <div style="font-size: 16px; font-weight: 700; color: var(--primary);">${orderData.orderNumber || '—'}</div>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">Cliente</div>
                            <div style="font-size: 14px; font-weight: 600;">${orderData.customer || '—'}</div>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">Tipo de Solicitud</div>
                            <div style="font-size: 14px; font-weight: 600;">${orderData.tipo || '—'}</div>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">Fecha</div>
                            <div style="font-size: 14px; font-weight: 600;">${orderData.fecha || '—'}</div>
                        </div>
                    </div>
                </div>

                <!-- Items -->
                <div style="margin-top: 20px;">
                    <div style="font-weight: 700; color: var(--primary); margin-bottom: 12px; font-size: 14px;">Productos Seleccionados (${orderData.items.length})</div>
                    ${orderData.items.map((item, idx) => `
                        <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid var(--text-primary);">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div>
                                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">${item.name}</div>
                                    <div style="font-size: 12px; color: var(--text-secondary);">
                                        ${item.quantity ? `Cantidad: ${item.quantity} •` : ''} Precio: $${parseFloat(item.price || 0).toFixed(2)}
                                    </div>
                                </div>
                                <div>
                                    <div style="font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 11px; margin-bottom: 4px;">Tipo de Solicitud</div>
                                    <div style="font-size: 13px; font-weight: 700; color: var(--primary);">${item.requestType || '—'}</div>
                                </div>
                            </div>
                            <div style="padding-top: 12px; border-top: 1px solid var(--border-light);">
                                <div style="font-size: 12px; margin-bottom: 8px; line-height: 1.6;">
                                    <strong>Motivo:</strong> ${item.reason || '—'}
                                </div>
                                ${item.requestType === 'Cambio' && (item.replacementColor || item.replacementSize || item.replacementTitle) ? `
                                    <div style="font-size: 12px; color: var(--text-secondary); background: rgba(0,0,0,0.02); padding: 8px; border-radius: 6px;">
                                        <strong>🔄 Nueva Prenda:</strong> 
                                        ${[
                                            item.replacementTitle ? item.replacementTitle : '',
                                            item.replacementColor ? `Color: ${item.replacementColor}` : '',
                                            item.replacementSize ? `Talla: ${item.replacementSize}` : ''
                                        ].filter(Boolean).join(' • ')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Total -->
                <div style="background: var(--bg-light); padding: 16px; border-radius: 8px; margin-top: 16px; border: 1px solid var(--border-light);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600; font-size: 14px;">Total de la Orden:</span>
                        <span style="font-size: 18px; font-weight: 700; color: var(--primary);">$${parseFloat(orderData.orderTotal || 0).toFixed(2)} ${orderData.orderCurrency || 'MXN'}</span>
                    </div>
                </div>

                <!-- Email -->
                <div style="background: rgba(56, 142, 60, 0.08); padding: 12px; border-radius: 8px; margin-top: 16px; border-left: 3px solid var(--success-color); font-size: 12px;">
                    <strong>📧 Confirmación enviada a:</strong> ${contactEmail}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
                <span class="status-pill">✓ Pago Confirmado</span>
                <h1>¡Pago Exitoso!</h1>
                <p>Tu solicitud de ${orderData.tipo || 'devolucion'} ha sido procesada exitosamente.</p>
                
                <div style="background: var(--bg-light); padding: 24px; border-radius: 12px; margin: 24px 0; border: 1px solid var(--border-light);">
                    <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; font-weight: 600;">Numero de seguimiento:</div>
                    <div id="tracking-number" style="font-size: 20px; font-weight: 700; color: var(--primary); font-family: 'HelveticaNeueLTProHv', sans-serif; margin-bottom: 16px;">${trackingNumber}</div>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button id="btn-copy-tracking" type="button" style="padding: 10px 20px; background: var(--primary); color: var(--secondary); border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; transition: var(--transition);">Copiar</button>
                        <a id="btn-track-link" href="#" target="_blank" rel="noopener" style="padding: 10px 20px; background: var(--secondary); color: var(--primary); border: 1px solid var(--primary); border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; transition: var(--transition); display: inline-block;">Rastrear</a>
                    </div>
                </div>

                ${summaryHtml}

                <p>Recibiras un correo con los detalles y las instrucciones para enviar tu producto.</p>
                <p style="font-size:14px; color: var(--text-secondary);">Guarda tu numero de seguimiento para consultar el estado de tu solicitud.</p>

                <div style="margin: 24px 0;">
                    <a id="btn-download-label" href="#" style="display: inline-block; padding: 14px 32px; background: var(--primary); color: var(--secondary); border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 12px; opacity: 0.5; pointer-events: none; transition: var(--transition);">Descargar guia</a>
                    <div id="label-note" style="font-size: 13px; color: var(--text-secondary);">Preparando tu guia...</div>
                </div>
                
                <a href="/" style="display: inline-block; padding: 14px 32px; background: var(--secondary); color: var(--primary); border: 2px solid var(--primary); border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; transition: var(--transition);">Volver al inicio</a>
            `;

    const copyBtn = document.getElementById('btn-copy-tracking');
    const trackLink = document.getElementById('btn-track-link');
    if (copyBtn) {
        copyBtn.style.opacity = '0.5';
        copyBtn.style.pointerEvents = 'none';
    }
    if (trackLink) {
        trackLink.style.opacity = '0.5';
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

        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
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
