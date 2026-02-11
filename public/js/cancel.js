const API_BASE = (function() {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isDev ? 'http://localhost:3000' : window.location.origin;
})();

const retryBtn = document.getElementById('btn-retry');
const requestId = localStorage.getItem('mon_request_id');
const orderDataRaw = localStorage.getItem('mon_order_data');
const contactEmail = localStorage.getItem('mon_contact_email');

if (!requestId || !orderDataRaw || !retryBtn) {
    if (retryBtn) retryBtn.style.display = 'none';
} else {
    retryBtn.addEventListener('click', async () => {
        retryBtn.disabled = true;
        retryBtn.textContent = 'Reintentando...';

        const orderData = JSON.parse(orderDataRaw || '{}');
        const orderId = orderData.orderId || '';
        const email = contactEmail || '';

        if (!orderId) {
            retryBtn.disabled = false;
            retryBtn.textContent = 'Reintentar pago';
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                mode: 'cors',
                body: JSON.stringify({
                    requestId,
                    amount: 150,
                    currency: 'mxn',
                    description: `Guia de devolucion - Orden ${orderId}`,
                    orderId,
                    contactEmail: email
                })
            });
            const data = await res.json();
            if (data.success && data.url) {
                window.location.href = data.url;
            } else {
                retryBtn.disabled = false;
                retryBtn.textContent = 'Reintentar pago';
            }
        } catch (e) {
            retryBtn.disabled = false;
            retryBtn.textContent = 'Reintentar pago';
        }
    });
}
