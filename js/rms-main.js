/**
 * RMS prototype — navigation, view routing, startup
 * Load after: rms-state.js, rms-views.js
 */
let currentRole = null;
let currentView = 'dashboard';

const NAV_DEF = {
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: '◆' },
    { id: 'menu', label: 'Menu', icon: '☰' },
    { id: 'tables', label: 'Tables', icon: '▢' },
    { id: 'inventory', label: 'Inventory', icon: '◈' },
    { id: 'users', label: 'Users', icon: '●' },
    { id: 'orders', label: 'All Orders', icon: '◎' },
    { id: 'billing', label: 'Billing', icon: '₹' },
    { id: 'kitchen', label: 'Kitchen', icon: '⌂' },
    { id: 'reports', label: 'Reports', icon: '▤' },
    { id: 'feedback', label: 'Feedback', icon: '★' },
  ],
  staff: [
    { id: 'dashboard', label: 'Dashboard', icon: '◆' },
    { id: 'tables', label: 'Assign Tables', icon: '▢' },
    { id: 'orders', label: 'Orders', icon: '◎' },
    { id: 'billing', label: 'Billing', icon: '₹' },
    { id: 'feedback', label: 'Feedback', icon: '★' },
  ],
  kitchen: [
    { id: 'kitchen', label: 'Kitchen Board', icon: '⌂' },
  ],
};

function setRole(role) {
  currentRole = role;
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  document.getElementById('rolePill').textContent = 'Role: ' + role;
  buildNav();
  navigate(role === 'kitchen' ? 'kitchen' : 'dashboard');
}

function buildNav() {
  const ul = document.getElementById('mainNav');
  ul.innerHTML = '';
  const items = NAV_DEF[currentRole] || [];
  items.forEach(it => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.dataset.view = it.id;
    a.innerHTML = '<span>' + it.icon + '</span> ' + it.label;
    a.addEventListener('click', (e) => { e.preventDefault(); navigate(it.id); });
    li.appendChild(a);
    ul.appendChild(li);
  });
}

function updateNavActive() {
  document.querySelectorAll('#mainNav a').forEach(a => {
    a.classList.toggle('active', a.dataset.view === currentView);
  });
}

function navigate(view) {
  if (currentRole === 'kitchen' && view !== 'kitchen') view = 'kitchen';
  currentView = view;
  updateNavActive();
  const gs = document.getElementById('globalSearch');
  gs.classList.toggle('hidden', view !== 'menu');
  if (view === 'menu' && currentRole === 'admin') {
    gs.oninput = () => renderMenu();
    gs.onkeyup = () => renderMenu();
  }
  const titles = {
    dashboard: 'Dashboard', menu: 'Menu Management', tables: 'Tables', inventory: 'Inventory', users: 'Users',
    orders: 'Orders', billing: 'Billing', kitchen: 'Kitchen', reports: 'Reports', feedback: 'Feedback',
  };
  document.getElementById('pageTitle').textContent = titles[view] || view;
  renderView();
}

function renderView() {
  syncTableWithOrders();
  saveState(state);
  const map = {
    dashboard: renderDashboard,
    menu: renderMenu,
    tables: renderTables,
    inventory: renderInventory,
    users: renderUsers,
    orders: renderOrders,
    billing: renderBilling,
    kitchen: renderKitchen,
    reports: renderReports,
    feedback: renderFeedback,
  };
  const fn = map[currentView];
  if (fn) fn();
}

function initRms() {
  document.querySelectorAll('[data-role]').forEach(btn => {
    btn.addEventListener('click', () => setRole(btn.dataset.role));
  });
  document.getElementById('btnLogout').addEventListener('click', () => {
    document.getElementById('appShell').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    currentRole = null;
  });
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRms);
} else {
  initRms();
}
