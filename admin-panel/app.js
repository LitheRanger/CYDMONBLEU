// === UTILIDADES DE FORMATEO Y BADGES ===
function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}
function formatCurrency(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}
function badge(status) {
  const s = String(status || 'pending').toLowerCase();
  if (s === 'paid') return '<span class="badge paid">Pagado</span>';
  if (s === 'failed') return '<span class="badge failed">Fallido</span>';
  return '<span class="badge pending">Pendiente</span>';
}
function paymentBadge(r) {
  if (Number(r?.amount || 0) <= 0) return '<span class="badge info">Sin cobro</span>';
  return badge(r.payment_status);
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
// Muestra los detalles de la solicitud en el modal
function showDetailsModal(id) {
  const solicitud = allData.find(r => String(r.id) === String(id));
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('detail-body');
  if (!solicitud) {
    modalBody.innerHTML = '<p>No se encontraron detalles.</p>';
    modal.classList.add('show');
    return;
  }
  // Items (pueden venir como string JSON o array)
  let items = solicitud.items_json;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { items = []; }
  }
  modalBody.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start;">
        <div style="min-width:220px;">
          <div style="font-size:1.2em;font-weight:700;margin-bottom:4px;">#${solicitud.id || ''} ${solicitud.return_type ? '· ' + solicitud.return_type : ''}</div>
          <div style="color:#666;font-size:13px;margin-bottom:8px;">${solicitud.created_at ? (new Date(solicitud.created_at)).toLocaleString() : ''}</div>
          <div><b>Orden:</b> ${solicitud.order_number || solicitud.orden || '-'}</div>
          <div><b>Cliente:</b> ${solicitud.customer_name || solicitud.cliente || '-'}</div>
          <div><b>Email:</b> <a href="mailto:${solicitud.contact_email || solicitud.contacto || ''}">${solicitud.contact_email || solicitud.contacto || '-'}</a></div>
          <div><b>Monto:</b> $${solicitud.amount || '-'}</div>
          <div><b>Status:</b> <span style="color:${solicitud.admin_status==='completed'?'#388e3c':'#1976d2'};font-weight:600;">${solicitud.admin_status || '-'}</span></div>
          <div><b>Pago:</b> ${solicitud.payment_status || '-'}</div>
          <div><b>Tracking:</b> ${solicitud.tracking_number || '-'}</div>
          <div><b>Carrier:</b> ${solicitud.carrier || '-'}</div>
        </div>
        <div style="flex:1;min-width:220px;">
          <div style="font-weight:600;margin-bottom:6px;">Artículos</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fafbfc;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#f3f3f3;">
                <th style="padding:6px 8px;text-align:left;">Nombre</th>
                <th style="padding:6px 8px;text-align:left;">Razón</th>
                <th style="padding:6px 8px;text-align:left;">Talla</th>
                <th style="padding:6px 8px;text-align:left;">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              ${Array.isArray(items) && items.length ? items.map(item => `
                <tr>
                  <td style="padding:6px 8px;">${item.name || '-'}</td>
                  <td style="padding:6px 8px;">${item.reason || '-'}</td>
                  <td style="padding:6px 8px;">${item.current_variant_title || item.replacementTitle || '-'}</td>
                  <td style="padding:6px 8px;">${item.quantity || 1}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="padding:6px 8px;">Sin artículos</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div style="margin-top:10px;">
        <details style="font-size:12px;color:#888;">
          <summary style="cursor:pointer;">Ver JSON completo</summary>
          <pre style="background:#f3f3f3;padding:8px;border-radius:6px;max-height:200px;overflow:auto;">${JSON.stringify(solicitud, null, 2)}</pre>
        </details>
      </div>
    </div>
  `;
  // === UTILIDADES DE FORMATEO Y BADGES ===
  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }
  function formatCurrency(value) {
    const n = Number(value || 0);
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
  }
  function badge(status) {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'paid') return '<span class="badge paid">Pagado</span>';
    if (s === 'failed') return '<span class="badge failed">Fallido</span>';
    return '<span class="badge pending">Pendiente</span>';
  }
  function paymentBadge(r) {
    if (Number(r?.amount || 0) <= 0) return '<span class="badge info">Sin cobro</span>';
    return badge(r.payment_status);
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
  modal.classList.add('show');
}
// Renderiza la tabla de solicitudes para la pestaña activa
function renderTable(tab, data) {
  const tbodyMap = {
    cambios: 'tbody-cambios',
    reembolsos: 'tbody-reembolsos',
    defectos: 'tbody-defectos',
    completadas: 'tbody-completadas'
  };
  const tbody = document.getElementById(tbodyMap[tab]);
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!data.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 10;
    td.textContent = 'Sin solicitudes.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  data.forEach(r => {
    const tr = document.createElement('tr');
    const orderDisplay = r.order_number ? `#${r.order_number}` : (r.orden || '—');
    tr.innerHTML = `
      <td><strong>${orderDisplay}</strong><br><span style="font-size:0.85em;color:#999;">Req #${r.id}</span></td>
      <td>${r.customer_name || r.cliente || ''}</td>
      <td>${r.contact_email || r.contacto || ''}</td>
      <td>${r.return_type || ''}</td>
      <td>${paymentBadge(r)}</td>
      <td>${adminBadge(r.admin_status)}</td>
      <td>${refundBadge(r.refund_status)}</td>
      <td>${formatCurrency(r.amount)}</td>
      <td>${r.tracking_number || ''}</td>
      <td>${r.label_mime ? 'Sí' : ''}</td>
      <td>${r.created_at ? formatDate(r.created_at) : ''}</td>
      <td><button class="btn-details" data-id="${r.id}">Ver</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-details').forEach(btn => {
    btn.addEventListener('click', function() {
      const id = btn.getAttribute('data-id');
      showDetailsModal(id);
    });
  });
}
// Simple login (frontend only, no backend)
const loginForm = document.getElementById('login-form');
const loginContainer = document.getElementById('login-container');
const adminShell = document.getElementById('admin-shell');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

// --- AUTENTICACIÓN REAL HTTP BASIC ---
function getAuthHeader(user, pass) {
  return 'Basic ' + btoa(user + ':' + pass);
}
function saveAuth(user, pass) {
  localStorage.setItem('adminUser', user);
  localStorage.setItem('adminPass', pass);
}
function clearAuth() {
  localStorage.removeItem('adminUser');
  localStorage.removeItem('adminPass');
}
function getSavedAuth() {
  const user = localStorage.getItem('adminUser');
  const pass = localStorage.getItem('adminPass');
  return user && pass ? { user, pass } : null;
}

async function tryLogin(user, pass) {
  try {
    const res = await fetch(API_URL, {
      headers: { 'Authorization': getAuthHeader(user, pass) },
      credentials: 'include'
    });
    if (res.status === 401) throw new Error('Usuario o contraseña incorrectos');
    if (!res.ok) throw new Error('Error de red');
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Error de API');
    return true;
  } catch (e) {
    return false;
  }
}

loginForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  const user = document.getElementById('username').value;
  const pass = document.getElementById('password').value;
  const ok = await tryLogin(user, pass);
  if (ok) {
    saveAuth(user, pass);
    loginContainer.style.display = 'none';
    adminShell.style.display = 'block';
    loginError.textContent = '';
    loadAndRender();
  } else {
    loginError.textContent = 'Usuario o contraseña incorrectos';
  }
});

logoutBtn.addEventListener('click', function() {
  adminShell.style.display = 'none';
  loginContainer.style.display = 'flex';
  loginForm.reset();
  clearAuth();
});

// --- USAR CREDENCIALES GUARDADAS EN CADA PETICIÓN ---
async function fetchRequests() {
  const auth = getSavedAuth();
  try {
    const res = await fetch(API_URL, {
      headers: auth ? { 'Authorization': getAuthHeader(auth.user, auth.pass) } : {},
      credentials: 'include'
    });
    if (res.status === 401) throw new Error('No autorizado');
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Error de API');
    return json.data;
  } catch (e) {
    if (e.message === 'No autorizado') {
      clearAuth();
      adminShell.style.display = 'none';
      loginContainer.style.display = 'flex';
      loginError.textContent = 'Sesión expirada. Inicia sesión de nuevo.';
    } else {
      alert('Error cargando solicitudes: ' + e.message);
    }
    return [];
  }
}

// --- AUTOLOGIN SI HAY CREDENCIALES ---
window.addEventListener('DOMContentLoaded', async () => {
  const auth = getSavedAuth();
  if (auth) {
    const ok = await tryLogin(auth.user, auth.pass);
    if (ok) {
      loginContainer.style.display = 'none';
      adminShell.style.display = 'block';
      loginError.textContent = '';
      loadAndRender();
      return;
    } else {
      clearAuth();
    }
  }
  loginContainer.style.display = 'flex';
  adminShell.style.display = 'none';
});

// Tabs logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
tabBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// Mock API data
const API_URL = 'https://cambios.monbleu.mx/api/admin/requests';

async function fetchRequests() {
  const auth = getSavedAuth();
  try {
    const res = await fetch(API_URL, {
      headers: auth ? { 'Authorization': getAuthHeader(auth.user, auth.pass) } : {},
      credentials: 'include'
    });
    if (res.status === 401) throw new Error('No autorizado');
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Error de API');
    return json.data;
  } catch (e) {
    if (e.message === 'No autorizado') {
      clearAuth();
      adminShell.style.display = 'none';
      loginContainer.style.display = 'flex';
      loginError.textContent = 'Sesión expirada. Inicia sesión de nuevo.';
    } else {
      alert('Error cargando solicitudes: ' + e.message);
    }
    return [];
  }
}

function groupRequests(data) {
  const grupos = { cambios: [], reembolsos: [], defectos: [], completadas: [] };
  data.forEach(r => {
    if (r.admin_status === 'completed' || r.admin_status === 'completada') grupos.completadas.push(r);
    else if (r.return_type === 'defecto' || r.return_type === 'defectos') grupos.defectos.push(r);
    else if (r.return_type === 'reembolso' || r.return_type === 'reembolsos') grupos.reembolsos.push(r);
    else grupos.cambios.push(r);
  });
  return grupos;
}

async function loadAndRender() {
  const data = await fetchRequests();
  allData = data;
  currentPage = 1;
  // Clasificar pedidos en grupos usando return_type y admin_status, sin duplicados
  window.completadasData = allData.filter(r => r.admin_status === 'completed' || r.admin_status === 'completada');
  const completadasIds = new Set(window.completadasData.map(r => r.id));
  window.cambiosData = allData.filter(r => (r.return_type || '').toLowerCase().includes('cambio') && !completadasIds.has(r.id));
  window.reembolsosData = allData.filter(r => (r.return_type || '').toLowerCase().includes('reembolso') && !completadasIds.has(r.id));
  window.defectosData = allData.filter(r => (r.return_type || '').toLowerCase().includes('defecto') && !completadasIds.has(r.id));
  updateView();
}

// --- FILTROS, PAGINACIÓN Y EXPORTAR CSV ---
let allData = [];
let currentTab = 'cambios';
let currentPage = 1;
const pageSize = 20;

function filterData() {
  const search = document.getElementById('search').value.toLowerCase();
  const tabFilter = document.getElementById('filter-tab').value;
  let data = allData;
  if (tabFilter) data = data.filter(r => groupType(r) === tabFilter);
  if (search) {
    data = data.filter(r =>
      (r.order_number || r.orden || '').toLowerCase().includes(search) ||
      (r.customer_name || r.cliente || '').toLowerCase().includes(search) ||
      (r.contact_email || r.contacto || '').toLowerCase().includes(search)
    );
  }
  return data;
}

function groupType(r) {
  if (r.admin_status === 'completed' || r.admin_status === 'completada') return 'completadas';
  if (r.return_type === 'defecto' || r.return_type === 'defectos') return 'defectos';
  if (r.return_type === 'reembolso' || r.return_type === 'reembolsos') return 'reembolsos';
  return 'cambios';
}

function renderPaginated(tab, data) {
  const start = (currentPage - 1) * pageSize;
  const pageData = data.slice(start, start + pageSize);
  renderTable(tab, pageData);
  renderPagination(data.length);
// === PAGINACIÓN AVANZADA ===
function renderPagination(total) {
  let pag = document.getElementById('pagination');
  if (!pag) {
    pag = document.createElement('div');
    pag.className = 'pagination';
    pag.id = 'pagination';
    document.querySelector('.admin-shell').appendChild(pag);
  }
  pag.innerHTML = '';
  const totalPages = Math.ceil(total / pageSize) || 1;
  const prev = document.createElement('button');
  prev.textContent = 'Anterior';
  prev.disabled = currentPage <= 1;
  prev.onclick = () => { currentPage--; updateView(); };
  const next = document.createElement('button');
  next.textContent = 'Siguiente';
  next.disabled = currentPage >= totalPages;
  next.onclick = () => { currentPage++; updateView(); };
  const info = document.createElement('span');
  info.textContent = `Página ${currentPage} de ${totalPages}`;
  pag.appendChild(prev);
  pag.appendChild(info);
  pag.appendChild(next);
}
}

function renderPagination(total) {
  let pag = document.getElementById('pagination');
  if (!pag) {
    pag = document.createElement('div');
    pag.className = 'pagination';
    pag.id = 'pagination';
    document.querySelector('.admin-shell').appendChild(pag);
  }
  pag.innerHTML = '';
  const totalPages = Math.ceil(total / pageSize) || 1;
  const prev = document.createElement('button');
  prev.textContent = 'Anterior';
  prev.disabled = currentPage <= 1;
  prev.onclick = () => { currentPage--; updateView(); };
  const next = document.createElement('button');
  next.textContent = 'Siguiente';
  next.disabled = currentPage >= totalPages;
  next.onclick = () => { currentPage++; updateView(); };
  const info = document.createElement('span');
  info.textContent = `Página ${currentPage} de ${totalPages}`;
  pag.appendChild(prev);
  pag.appendChild(info);
  pag.appendChild(next);
}

document.getElementById('search').addEventListener('input', () => { currentPage = 1; updateView(); });
document.getElementById('filter-tab').addEventListener('change', () => { currentPage = 1; updateView(); });

document.getElementById('export-csv').addEventListener('click', () => {
  const data = filterData();
  let csv = '';
  if (data.length) {
    const keys = Object.keys(data[0]);
    csv += keys.join(',') + '\n';
    data.forEach(row => {
      csv += keys.map(k => '"' + String(row[k] || '').replace(/"/g, '""') + '"').join(',') + '\n';
    });
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'solicitudes.csv';
  a.click();
  URL.revokeObjectURL(url);
});

function updateView() {
  const tab = document.querySelector('.tab-btn.active').dataset.tab;
  let data = [];
  if (tab === 'cambios') data = window.cambiosData || [];
  else if (tab === 'reembolsos') data = window.reembolsosData || [];
  else if (tab === 'defectos') data = window.defectosData || [];
  else if (tab === 'completadas') data = window.completadasData || [];
  // Aplicar filtros de búsqueda
  const search = document.getElementById('search').value.toLowerCase();
  if (search) {
    data = data.filter(r =>
      (r.order_number || r.orden || '').toLowerCase().includes(search) ||
      (r.customer_name || r.cliente || '').toLowerCase().includes(search) ||
      (r.contact_email || r.contacto || '').toLowerCase().includes(search)
    );
  }
  renderPaginated(tab, data);
}

async function doAction(endpoint, body) {
  const auth = getSavedAuth();
  try {
    const res = await fetch('http://localhost:3000' + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(auth.user, auth.pass)
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Error de API');
    alert('Acción realizada correctamente');
    document.getElementById('modal').classList.remove('show');
    await loadAndRender();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}
document.getElementById('close-modal').addEventListener('click', function() {
  document.getElementById('modal').classList.remove('show');
});
