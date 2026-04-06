/**
 * RMS prototype — data, localStorage, domain helpers
 */
const LS_KEY = 'rms_prototype_v1';

function defaultState() {
  const genId = () => 'id_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
  const invMain = [
    { id: genId(), name: 'Basmati Rice (kg)', quantity: 50, threshold: 10, unit: 'kg' },
    { id: genId(), name: 'Chicken (kg)', quantity: 25, threshold: 5, unit: 'kg' },
    { id: genId(), name: 'Tomatoes (kg)', quantity: 15, threshold: 4, unit: 'kg' },
    { id: genId(), name: 'Cooking Oil (L)', quantity: 20, threshold: 3, unit: 'L' },
  ];
  const invIds = Object.fromEntries(invMain.map(i => [i.name, i.id]));
  return {
    settings: { taxRate: 0.05, serviceChargePercent: 0 },
    users: [
      { id: genId(), username: 'admin', name: 'Admin User', role: 'admin' },
      { id: genId(), username: 'staff1', name: 'Staff User', role: 'staff' },
      { id: genId(), username: 'kitchen1', name: 'Kitchen User', role: 'kitchen' },
    ],
    menuItems: [
      { id: genId(), name: 'Butter Chicken', category: 'Mains', price: 320, available: true, recipe: [{ inventoryId: invIds['Chicken (kg)'], qty: 0.15 }, { inventoryId: invIds['Tomatoes (kg)'], qty: 0.05 }] },
      { id: genId(), name: 'Vegetable Biryani', category: 'Mains', price: 220, available: true, recipe: [{ inventoryId: invIds['Basmati Rice (kg)'], qty: 0.12 }, { inventoryId: invIds['Cooking Oil (L)'], qty: 0.02 }] },
      { id: genId(), name: 'Masala Dosa', category: 'South', price: 90, available: true, recipe: [{ inventoryId: invIds['Basmati Rice (kg)'], qty: 0.08 }] },
      { id: genId(), name: 'Fresh Lime Soda', category: 'Beverages', price: 60, available: true, recipe: [] },
    ],
    tables: [
      { id: genId(), number: 'T1', capacity: 4, status: 'available' },
      { id: genId(), number: 'T2', capacity: 2, status: 'available' },
      { id: genId(), number: 'T3', capacity: 6, status: 'reserved' },
      { id: genId(), number: 'T4', capacity: 4, status: 'available' },
    ],
    inventory: invMain,
    orders: [],
    feedback: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      const s = defaultState();
      saveState(s);
      return s;
    }
    const parsed = JSON.parse(raw);
    const d = defaultState();
    return {
      settings: Object.assign({}, d.settings, parsed.settings || {}),
      users: Array.isArray(parsed.users) && parsed.users.length ? parsed.users : d.users,
      menuItems: Array.isArray(parsed.menuItems) ? parsed.menuItems : d.menuItems,
      tables: Array.isArray(parsed.tables) ? parsed.tables : d.tables,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : d.inventory,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
    };
  } catch (e) {
    const s = defaultState();
    saveState(s);
    return s;
  }
}

function saveState(s) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

let state = loadState();

function uid() {
  return 'id_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

function toast(msg, type) {
  const w = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'error' ? 'error' : 'success');
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => { t.remove(); }, 3200);
}

function money(n) {
  return '₹' + (Number(n) || 0).toFixed(2);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function getMenuItem(id) {
  return state.menuItems.find(m => m.id === id);
}

function getTable(id) {
  return state.tables.find(t => t.id === id);
}

function getOrder(id) {
  return state.orders.find(o => o.id === id);
}

function orderLineSubtotal(line) {
  const m = getMenuItem(line.menuItemId);
  if (!m) return 0;
  return m.price * (line.qty || 1);
}

function computeOrderSubtotal(order) {
  return (order.items || []).reduce((s, l) => s + orderLineSubtotal(l), 0);
}

function badgeClassForTable(st) {
  if (st === 'occupied') return 'badge-occupied';
  if (st === 'reserved') return 'badge-reserved';
  return 'badge-available';
}

function badgeClassForOrder(st) {
  const map = { draft: 'badge-draft', pending: 'badge-pending', preparing: 'badge-preparing', completed: 'badge-completed', billed: 'badge-billed' };
  return map[st] || 'badge-draft';
}

function deductInventoryForOrder(order) {
  if (order._inventoryDeducted) return;
  (order.items || []).forEach(line => {
    const m = getMenuItem(line.menuItemId);
    if (!m || !m.recipe) return;
    m.recipe.forEach(r => {
      const inv = state.inventory.find(i => i.id === r.inventoryId);
      if (inv) inv.quantity = Math.max(0, inv.quantity - r.qty * (line.qty || 1));
    });
  });
  order._inventoryDeducted = true;
}

function syncTableWithOrders() {
  state.tables.forEach(t => {
    const active = state.orders.some(o => o.tableId === t.id && ['draft', 'pending', 'preparing', 'completed'].includes(o.status));
    if (active) t.status = 'occupied';
    else if (t.status === 'occupied') t.status = 'available';
  });
}

function canEditOrder(o) {
  return o && (o.status === 'draft' || o.status === 'pending');
}

function formatDate(iso) {
  try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
}

function dashboardMetrics() {
  const orders = state.orders;
  const today = new Date().toDateString();
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today);
  const revenue = orders.filter(o => o.status === 'billed').reduce((s, o) => s + (o.total || 0), 0);
  const activeOrders = orders.filter(o => ['pending', 'preparing', 'draft'].includes(o.status)).length;
  const lowStock = state.inventory.filter(i => i.quantity <= i.threshold).length;
  return { revenue, activeOrders, todayCount: todayOrders.length, lowStock, menuCount: state.menuItems.length };
}
