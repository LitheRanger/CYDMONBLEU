// Panel Admin Devoluciones - Vanilla JS

const API_BASE = 'http://localhost:3000'; // Cambia si tu backend está en otro host/puerto

let activeTab = 'cambios';

const pageSize = 20;
const tabState = {
    cambios: { page: 1, data: [] },
    reembolsos: { page: 1, data: [] },
    defectos: { page: 1, data: [] },
    completadas: { page: 1, data: [] }
};

function activateTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabBtn) tabBtn.classList.add('active');
    if (tabContent) tabContent.classList.add('active');
    activeTab = tabName;
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        e.preventDefault();
        const tabName = btn.getAttribute('data-tab');
        if (tabName) activateTab(tabName);
    });
});

// Modal logic
const modal = document.getElementById('modal');
const closeModalBtn = document.getElementById('close-modal');
if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => modal.classList.remove('show'));
}

function openModal(detail, id) {
    document.getElementById('detail-id').textContent = id || '—';
    // Si detail es un objeto, renderizar bonito
    if (typeof detail === 'object' && detail !== null) {
        document.getElementById('detail-body').innerHTML = renderDetailHtml(detail);
    } else {
        document.getElementById('detail-body').innerHTML = detail;
    }
    modal.classList.add('show');
}

function renderDetailHtml(r) {
    return `
        <div class="detail-section">
            <div><b>Orden:</b> ${r.order_id || ''}</div>
            <div><b>Cliente:</b> ${r.customer || ''}</div>
            <div><b>Contacto:</b> ${r.contact || ''}</div>
            <div><b>Pago:</b> ${r.payment_status || ''}</div>
            <div><b>Tipo:</b> ${r.type || ''}</div>
            <div><b>Tracking:</b> ${r.tracking || ''}</div>
            <div><b>Guía:</b> ${r.label || ''}</div>
            <div><b>Fecha:</b> ${r.date || ''}</div>
        </div>
        <div class="detail-section">
            <b>Items:</b>
            <pre>${JSON.stringify(r.items, null, 2)}</pre>
        </div>
        <div class="detail-section">
            <b>Historial:</b>
            <pre>${JSON.stringify(r.history, null, 2)}</pre>
        </div>
        <div class="detail-actions">
            <button class="action-btn accept" onclick="window.accionSolicitud && accionSolicitud('${r.order_id}','accepted','${r.type}')">Aceptar</button>
            <button class="action-btn reject" onclick="window.accionSolicitud && accionSolicitud('${r.order_id}','rejected','${r.type}')">Rechazar</button>
            <button class="action-btn complete" onclick="window.accionSolicitud && accionSolicitud('${r.order_id}','completed','${r.type}')">Completar</button>
            ${r.label_url ? `<button class='action-btn download' onclick='window.descargarGuia && descargarGuia("${r.order_id}", "${r.label_url}")'>Descargar Guía</button>` : ''}
            <button class='action-btn retry' onclick='window.reintentarGuia && reintentarGuia("${r.order_id}")'>Reintentar Guía</button>
        </div>
    `;
}

window.descargarGuia = function(orderId, url) {
    // Descarga directa de la guía
    window.open(url, '_blank');
};

window.reintentarGuia = function(orderId) {
    fetch(`${API_BASE}/api/admin/requests/${orderId}/retry-label`, { method: 'POST' })
        .then(res => res.json())
        .then(() => alert('Reintento de guía solicitado.'))
        .catch(() => alert('Error al reintentar la guía.'));
};

function updatePagination(tab) {
    const state = tabState[tab];
    const totalPages = Math.max(1, Math.ceil(state.data.length / pageSize));
    const pageInfo = document.getElementById(`page-info-${tab}`);
    const prevBtn = document.getElementById(`prev-${tab}`);
    const nextBtn = document.getElementById(`next-${tab}`);
    if (pageInfo) pageInfo.textContent = `Página ${state.page} de ${totalPages}`;
    if (prevBtn) prevBtn.disabled = state.page <= 1;
    if (nextBtn) nextBtn.disabled = state.page >= totalPages;
    const pagDiv = document.getElementById(`pagination-${tab}`);
    if (pagDiv) pagDiv.style.display = state.data.length > pageSize ? 'flex' : 'none';
}

function updateSummary(tab) {
    const summary = document.getElementById(`summary-${tab}`);
    if (!summary) return;
    const total = tabState[tab].data.length;
    const state = tabState[tab];
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (state.page - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    summary.textContent = `Mostrando ${total ? start + 1 : 0}–${end} de ${total} registros`;
}

function renderTable(tab, data) {
    tabState[tab].data = data;
    const state = tabState[tab];
    const tbody = document.getElementById(`tbody-${tab}`);
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!data.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 8;
        td.textContent = 'Sin registros';
        tr.appendChild(td);
        tbody.appendChild(tr);
        updateSummary(tab);
        updatePagination(tab);
        return;
    }
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * pageSize;
    const pageData = data.slice(start, start + pageSize);
    pageData.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.order_id || ''}</td>
            <td>${r.customer || ''}</td>
            <td>${r.contact || ''}</td>
            <td>${r.payment_status || ''}</td>
            <td>${r.type || ''}</td>
            <td>${r.tracking || ''}</td>
            <td>${r.label || ''}</td>
            <td>${r.date || ''}</td>
        `;
        tr.classList.add('clickable-row');
        tr.addEventListener('click', () => {
            openModal(r, r.order_id);
        });
        // Acciones
        const actionsTd = document.createElement('td');
        actionsTd.className = 'actions';
        if (tab === 'cambios' || tab === 'reembolsos' || tab === 'defectos') {
            const acceptBtn = document.createElement('button');
            acceptBtn.textContent = 'Aceptar';
            acceptBtn.className = 'action-btn accept';
            acceptBtn.onclick = e => { e.stopPropagation(); accionSolicitud(r.order_id, 'accepted', tab); };
            actionsTd.appendChild(acceptBtn);
            const rejectBtn = document.createElement('button');
            rejectBtn.textContent = 'Rechazar';
            rejectBtn.className = 'action-btn reject';
            rejectBtn.onclick = e => { e.stopPropagation(); accionSolicitud(r.order_id, 'rejected', tab); };
            actionsTd.appendChild(rejectBtn);
        }
        if (tab === 'cambios' || tab === 'completadas') {
            const completeBtn = document.createElement('button');
            completeBtn.textContent = 'Completar';
            completeBtn.className = 'action-btn complete';
            completeBtn.onclick = e => { e.stopPropagation(); accionSolicitud(r.order_id, 'completed', tab); };
            actionsTd.appendChild(completeBtn);
        }
        tr.appendChild(actionsTd);
        tbody.appendChild(tr);
    });
    updateSummary(tab);
    updatePagination(tab);
}

function accionSolicitud(orderId, action, tab) {
    // Aquí deberías ajustar la URL y método según tu API real
    fetch(`${API_BASE}/api/admin/requests/${orderId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action })
    })
    .then(res => res.json())
    .then(() => loadTabData(tab))
    .catch(() => alert('Error al actualizar la solicitud.'));
}

['cambios', 'reembolsos', 'defectos', 'completadas'].forEach(tab => {
    const prevBtn = document.getElementById(`prev-${tab}`);
    const nextBtn = document.getElementById(`next-${tab}`);
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (tabState[tab].page > 1) {
                tabState[tab].page--;
                renderTable(tab, tabState[tab].data);
            }
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.max(1, Math.ceil(tabState[tab].data.length / pageSize));
            if (tabState[tab].page < totalPages) {
                tabState[tab].page++;
                renderTable(tab, tabState[tab].data);
            }
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    loadTabData('cambios');
    loadTabData('reembolsos');
    loadTabData('defectos');
    loadTabData('completadas');
});

function loadTabData(tab) {
    fetch(`${API_BASE}/api/admin/requests`)
        .then(res => res.json())
        .then(data => {
            let filtered = [];
            if (tab === 'cambios') filtered = data.filter(r => r.type === 'cambio');
            else if (tab === 'reembolsos') filtered = data.filter(r => r.type === 'reembolso');
            else if (tab === 'defectos') filtered = data.filter(r => r.type === 'defecto');
            else if (tab === 'completadas') filtered = data.filter(r => r.status === 'completada');
            renderTable(tab, filtered);
        })
        .catch(() => {
            renderTable(tab, []);
        });
}

document.getElementById('btn-refresh').addEventListener('click', () => {
    ['cambios', 'reembolsos', 'defectos', 'completadas'].forEach(tab => loadTabData(tab));
});

document.getElementById('btn-export').addEventListener('click', () => {
    // Exportar los datos del tab activo
    const tab = activeTab;
    const data = tabState[tab].data;
    if (!data.length) return alert('No hay datos para exportar.');
    const csv = exportToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${tab}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

function exportToCSV(data) {
    if (!data.length) return '';
    const keys = Object.keys(data[0]);
    const rows = [keys.join(',')];
    data.forEach(row => {
        rows.push(keys.map(k => JSON.stringify(row[k] ?? '')).join(','));
    });
    return rows.join('\n');
}

renderTable('cambios', []);
renderTable('reembolsos', []);
renderTable('defectos', []);
renderTable('completadas', []);
updatePagination('cambios');
updatePagination('reembolsos');
updatePagination('defectos');
updatePagination('completadas');
