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
  const data = filterData().filter(r => groupType(r) === tab);
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
