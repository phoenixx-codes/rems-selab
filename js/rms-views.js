/**
 * RMS prototype — modals, screens, forms
 * Depends on: rms-state.js, rms-main.js (navigate, renderView, currentRole)
 */
let orderFilter = 'all';
let kitchenFilter = 'active';

function openModal(title, bodyHtml, footerHtml, onOpen) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalFooter').innerHTML = footerHtml || '';
  document.getElementById('modalOverlay').classList.add('open');
  if (onOpen) onOpen();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function confirmDialog(title, message, onOk) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  const ov = document.getElementById('confirmOverlay');
  ov.classList.add('open');
  const ok = document.getElementById('confirmOk');
  const cancel = document.getElementById('confirmCancel');
  const cleanup = () => {
    ov.classList.remove('open');
    ok.onclick = null;
    cancel.onclick = null;
  };
  cancel.onclick = () => cleanup();
  ok.onclick = () => { cleanup(); onOk(); };
}

function renderDashboard() {
  const m = dashboardMetrics();
  const el = document.getElementById('mainContent');
  el.innerHTML =
    '<div class="grid-cards">' +
    '<div class="card"><div class="label">Today\'s orders</div><div class="value">' + m.todayCount + '</div><div class="sub">Created today</div></div>' +
    '<div class="card"><div class="label">Active pipeline</div><div class="value">' + m.activeOrders + '</div><div class="sub">Draft / pending / preparing</div></div>' +
    '<div class="card"><div class="label">Billed revenue</div><div class="value">' + money(m.revenue) + '</div><div class="sub">All time (prototype)</div></div>' +
    '<div class="card"><div class="label">Low stock SKUs</div><div class="value">' + m.lowStock + '</div><div class="sub">At or below threshold</div></div>' +
    '</div>' +
    '<div class="panel"><div class="panel-head"><h3>Quick actions</h3></div>' +
    '<div class="flex">' +
    (currentRole === 'admin' ? '<button type="button" class="btn btn-primary btn-sm" data-go="menu">Manage menu</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-go="tables">Manage tables</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-go="users">Users</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-go="reports">View reports</button>' : '') +
    (currentRole === 'staff' || currentRole === 'admin' ? '<button type="button" class="btn btn-primary btn-sm" data-go="orders">Open orders</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-go="billing">Billing</button>' : '') +
    (currentRole === 'kitchen' || currentRole === 'admin' ? '<button type="button" class="btn btn-secondary btn-sm" data-go="kitchen">Kitchen board</button>' : '') +
    '</div></div>';
  el.querySelectorAll('[data-go]').forEach(b => {
    b.addEventListener('click', () => navigate(b.dataset.go));
  });
}

function renderMenu() {
  if (currentRole !== 'admin') {
    document.getElementById('mainContent').innerHTML = '<p class="empty">Menu management is restricted to Admin.</p>';
    return;
  }
  const q = (document.getElementById('globalSearch').value || '').toLowerCase();
  const filtered = state.menuItems.filter(m =>
    !q || m.name.toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q));
  const cats = [...new Set(state.menuItems.map(m => m.category || 'General'))];
  const invOpts = state.inventory.map(i =>
    '<option value="' + i.id + '">' + escapeHtml(i.name) + '</option>').join('');
  let rows = '';
  filtered.forEach(m => {
    const rec = (m.recipe || []).map(r => {
      const inv = state.inventory.find(i => i.id === r.inventoryId);
      return inv ? inv.name + ' ×' + r.qty : '';
    }).filter(Boolean).join(', ');
    rows += '<tr data-id="' + m.id + '">' +
      '<td>' + escapeHtml(m.name) + '</td>' +
      '<td>' + escapeHtml(m.category || '') + '</td>' +
      '<td>' + money(m.price) + '</td>' +
      '<td><span class="badge ' + (m.available ? 'badge-completed' : 'badge-draft') + '">' + (m.available ? 'Available' : 'Sold out') + '</span></td>' +
      '<td style="font-size:0.8rem;color:var(--muted);">' + escapeHtml(rec || '—') + '</td>' +
      '<td class="flex" style="gap:0.35rem;">' +
      '<button type="button" class="btn btn-sm btn-secondary" data-act="edit-menu" data-id="' + m.id + '">Edit</button>' +
      '<button type="button" class="btn btn-sm btn-secondary" data-act="toggle-menu" data-id="' + m.id + '">Toggle</button>' +
      '<button type="button" class="btn btn-sm btn-danger" data-act="del-menu" data-id="' + m.id + '">Delete</button>' +
      '</td></tr>';
  });
  document.getElementById('mainContent').innerHTML =
    '<div class="panel"><div class="panel-head"><h3>Menu items</h3>' +
    '<div class="toolbar"><button type="button" class="btn btn-primary btn-sm" id="btnAddMenu">Add item</button></div></div>' +
    (filtered.length ? '<table class="data-table"><thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Status</th><th>Recipe (stock)</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p class="empty">No items match search.</p>') +
    '</div>';
  document.getElementById('btnAddMenu').onclick = () => openMenuModal(null, cats, invOpts);
  document.getElementById('mainContent').querySelectorAll('[data-act="edit-menu"]').forEach(b => {
    b.onclick = () => openMenuModal(b.dataset.id, cats, invOpts);
  });
  document.getElementById('mainContent').querySelectorAll('[data-act="toggle-menu"]').forEach(b => {
    b.onclick = () => {
      const m = getMenuItem(b.dataset.id);
      if (m) { m.available = !m.available; saveState(state); toast('Availability updated'); renderMenu(); }
    };
  });
  document.getElementById('mainContent').querySelectorAll('[data-act="del-menu"]').forEach(b => {
    b.onclick = () => confirmDialog('Delete menu item', 'Remove this dish from the menu?', () => {
      state.menuItems = state.menuItems.filter(x => x.id !== b.dataset.id);
      saveState(state); toast('Item deleted'); renderMenu();
    });
  });
}

function openMenuModal(id, cats, invOpts) {
  const m = id ? getMenuItem(id) : null;
  const catOptions = cats.map(c => '<option value="' + escapeHtml(c) + '"' + (m && m.category === c ? ' selected' : '') + '>' + escapeHtml(c) + '</option>').join('');
  const recipeRows = (m && m.recipe && m.recipe.length ? m.recipe : [{ inventoryId: '', qty: 0 }]).map((r) =>
    '<div class="flex recipe-row" style="margin-bottom:0.5rem;">' +
    '<select class="recipe-inv grow">' + '<option value="">Ingredient</option>' + invOpts + '</select>' +
    '<input type="number" class="recipe-qty" step="0.01" min="0" placeholder="Qty / unit" style="width:100px;" value="' + (r.qty || '') + '" />' +
    '</div>').join('');
  const body =
    '<div class="form-row"><label>Name</label><input type="text" id="fMenuName" value="' + escapeHtml(m ? m.name : '') + '" /></div>' +
    '<div class="form-row"><label>Category</label><select id="fMenuCat">' + catOptions + '<option value="__new__">+ New category</option></select>' +
    '<input type="text" id="fMenuCatNew" placeholder="New category name" style="margin-top:0.5rem;display:none;" /></div>' +
    '<div class="form-row"><label>Price (₹)</label><input type="number" id="fMenuPrice" step="0.01" min="0" value="' + (m ? m.price : '') + '" /></div>' +
    '<div class="form-row"><label>Recipe (deducts stock per 1 plate when order → Preparing)</label><div id="recipeList">' + recipeRows + '</div>' +
    '<button type="button" class="btn btn-sm btn-secondary" id="addRecipeRow">+ Ingredient line</button></div>';
  const footer = '<button type="button" class="btn btn-secondary" data-close>Cancel</button><button type="button" class="btn btn-primary" id="saveMenu">Save</button>';
  openModal(m ? 'Edit menu item' : 'Add menu item', body, footer, () => {
    const catSel = document.getElementById('fMenuCat');
    const catNew = document.getElementById('fMenuCatNew');
    catSel.onchange = () => { catNew.style.display = catSel.value === '__new__' ? 'block' : 'none'; };
    if (m && m.recipe) {
      document.querySelectorAll('.recipe-row').forEach((row, idx) => {
        const rid = m.recipe[idx] && m.recipe[idx].inventoryId;
        if (rid) row.querySelector('.recipe-inv').value = rid;
      });
    }
    document.getElementById('addRecipeRow').onclick = () => {
      const div = document.createElement('div');
      div.className = 'flex recipe-row';
      div.style.marginBottom = '0.5rem';
      div.innerHTML = '<select class="recipe-inv grow"><option value="">Ingredient</option>' + invOpts + '</select>' +
        '<input type="number" class="recipe-qty" step="0.01" min="0" placeholder="Qty / unit" style="width:100px;" />';
      document.getElementById('recipeList').appendChild(div);
    };
    document.getElementById('saveMenu').onclick = () => {
      const name = document.getElementById('fMenuName').value.trim();
      let category = catSel.value === '__new__' ? catNew.value.trim() : catSel.value;
      const price = parseFloat(document.getElementById('fMenuPrice').value);
      if (!name || !category || !(price >= 0)) { toast('Fill name, category, and price', 'error'); return; }
      const recipe = [];
      document.querySelectorAll('.recipe-row').forEach(row => {
        const invId = row.querySelector('.recipe-inv').value;
        const qty = parseFloat(row.querySelector('.recipe-qty').value);
        if (invId && qty > 0) recipe.push({ inventoryId: invId, qty });
      });
      if (m) {
        m.name = name; m.category = category; m.price = price; m.recipe = recipe;
      } else {
        state.menuItems.push({ id: uid(), name, category, price, available: true, recipe });
      }
      saveState(state); closeModal(); toast('Menu saved'); renderMenu();
    };
    document.querySelector('[data-close]').onclick = closeModal;
  });
}

function renderTables() {
  let rows = '';
  state.tables.forEach(t => {
    rows += '<tr data-id="' + t.id + '"><td>' + escapeHtml(t.number) + '</td><td>' + t.capacity + '</td>' +
      '<td><span class="badge ' + badgeClassForTable(t.status) + '">' + t.status + '</span></td>' +
      '<td class="flex">' +
      (currentRole === 'admin' ? '<button type="button" class="btn btn-sm btn-secondary" data-act="edit-tbl" data-id="' + t.id + '">Edit</button>' +
        '<button type="button" class="btn btn-sm btn-danger" data-act="del-tbl" data-id="' + t.id + '">Delete</button>' : '') +
      '<select class="tbl-status" data-id="' + t.id + '" ' + (currentRole === 'staff' || currentRole === 'admin' ? '' : 'disabled') + '>' +
      ['available', 'occupied', 'reserved'].map(s => '<option value="' + s + '"' + (t.status === s ? ' selected' : '') + '>' + s + '</option>').join('') +
      '</select></td></tr>';
  });
  document.getElementById('mainContent').innerHTML =
    '<div class="panel"><div class="panel-head"><h3>Tables</h3>' +
    (currentRole === 'admin' ? '<div class="toolbar"><button type="button" class="btn btn-primary btn-sm" id="btnAddTable">Add table</button></div>' : '') +
    '</div>' +
    '<table class="data-table"><thead><tr><th>Table</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="4" class="empty">No tables</td></tr>') + '</tbody></table></div>' +
    '<p style="color:var(--muted);font-size:0.85rem;margin-top:0.75rem;">Occupied updates automatically when an order is active on a table. Staff can set Reserved for holds.</p>';
  if (currentRole === 'admin') {
    document.getElementById('btnAddTable').onclick = () => openTableModal(null);
    document.querySelectorAll('[data-act="edit-tbl"]').forEach(b => { b.onclick = () => openTableModal(b.dataset.id); });
    document.querySelectorAll('[data-act="del-tbl"]').forEach(b => {
      b.onclick = () => confirmDialog('Delete table', 'Remove this table?', () => {
        state.tables = state.tables.filter(x => x.id !== b.dataset.id);
        saveState(state); toast('Table removed'); renderTables();
      });
    });
  }
  document.querySelectorAll('.tbl-status').forEach(sel => {
    sel.onchange = () => {
      const t = getTable(sel.dataset.id);
      if (t) { t.status = sel.value; saveState(state); toast('Table status updated'); renderTables(); }
    };
  });
}

function openTableModal(id) {
  const t = id ? getTable(id) : null;
  const body = '<div class="form-row"><label>Table number / code</label><input type="text" id="fTblNum" value="' + escapeHtml(t ? t.number : '') + '" /></div>' +
    '<div class="form-row"><label>Capacity</label><input type="number" id="fTblCap" min="1" value="' + (t ? t.capacity : 4) + '" /></div>';
  const footer = '<button type="button" class="btn btn-secondary" data-close>Cancel</button><button type="button" class="btn btn-primary" id="saveTbl">Save</button>';
  openModal(t ? 'Edit table' : 'Add table', body, footer, () => {
    document.getElementById('saveTbl').onclick = () => {
      const number = document.getElementById('fTblNum').value.trim();
      const cap = parseInt(document.getElementById('fTblCap').value, 10);
      if (!number || cap < 1) { toast('Invalid table data', 'error'); return; }
      if (t) { t.number = number; t.capacity = cap; }
      else state.tables.push({ id: uid(), number, capacity: cap, status: 'available' });
      saveState(state); closeModal(); toast('Table saved'); renderTables();
    };
    document.querySelector('[data-close]').onclick = closeModal;
  });
}

function renderUsers() {
  if (currentRole !== 'admin') {
    document.getElementById('mainContent').innerHTML = '<p class="empty">User management is restricted to Admin.</p>';
    return;
  }
  let rows = '';
  state.users.forEach(u => {
    rows += '<tr><td>' + escapeHtml(u.username) + '</td><td>' + escapeHtml(u.name) + '</td>' +
      '<td><span class="badge badge-completed">' + u.role + '</span></td>' +
      '<td class="flex"><button type="button" class="btn btn-sm btn-secondary" data-act="edit-user" data-id="' + u.id + '">Edit</button>' +
      '<button type="button" class="btn btn-sm btn-danger" data-act="del-user" data-id="' + u.id + '">Delete</button></td></tr>';
  });
  document.getElementById('mainContent').innerHTML =
    '<div class="panel"><div class="panel-head"><h3>Team accounts (prototype)</h3><button type="button" class="btn btn-primary btn-sm" id="btnAddUser">Add user</button></div>' +
    '<p style="font-size:0.85rem;color:var(--muted);margin-bottom:0.75rem;">Login is simulated by role buttons; these records are for SRS data model demo.</p>' +
    '<table class="data-table"><thead><tr><th>Username</th><th>Name</th><th>Role</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  document.getElementById('btnAddUser').onclick = () => openUserModal(null);
  document.querySelectorAll('[data-act="edit-user"]').forEach(b => b.onclick = () => openUserModal(b.dataset.id));
  document.querySelectorAll('[data-act="del-user"]').forEach(b => {
    b.onclick = () => confirmDialog('Delete user', 'Remove this user record?', () => {
      state.users = state.users.filter(x => x.id !== b.dataset.id);
      saveState(state); toast('User removed'); renderUsers();
    });
  });
}

function openUserModal(id) {
  const u = id ? state.users.find(x => x.id === id) : null;
  const body = '<div class="form-row"><label>Username</label><input type="text" id="fUsrName" value="' + escapeHtml(u ? u.username : '') + '" /></div>' +
    '<div class="form-row"><label>Display name</label><input type="text" id="fUsrDisp" value="' + escapeHtml(u ? u.name : '') + '" /></div>' +
    '<div class="form-row"><label>Role</label><select id="fUsrRole">' +
    ['admin', 'staff', 'kitchen'].map(r => '<option value="' + r + '"' + (u && u.role === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>';
  const footer = '<button type="button" class="btn btn-secondary" data-close>Cancel</button><button type="button" class="btn btn-primary" id="saveUser">Save</button>';
  openModal(u ? 'Edit user' : 'Add user', body, footer, () => {
    document.getElementById('saveUser').onclick = () => {
      const username = document.getElementById('fUsrName').value.trim();
      const name = document.getElementById('fUsrDisp').value.trim();
      const role = document.getElementById('fUsrRole').value;
      if (!username || !name) { toast('Username and name required', 'error'); return; }
      if (u) { u.username = username; u.name = name; u.role = role; }
      else state.users.push({ id: uid(), username, name, role });
      saveState(state); closeModal(); toast('User saved'); renderUsers();
    };
    document.querySelector('[data-close]').onclick = closeModal;
  });
}

function renderInventory() {
  if (currentRole !== 'admin') {
    document.getElementById('mainContent').innerHTML = '<p class="empty">Inventory is restricted to Admin.</p>';
    return;
  }
  let rows = '';
  state.inventory.forEach(i => {
    const low = i.quantity <= i.threshold;
    rows += '<tr><td>' + escapeHtml(i.name) + '</td><td class="' + (low ? 'low-stock' : '') + '">' + i.quantity + ' ' + escapeHtml(i.unit) + '</td><td>' + i.threshold + '</td>' +
      '<td class="flex"><button type="button" class="btn btn-sm btn-secondary" data-act="edit-inv" data-id="' + i.id + '">Edit</button>' +
      '<button type="button" class="btn btn-sm btn-danger" data-act="del-inv" data-id="' + i.id + '">Delete</button></td></tr>';
  });
  document.getElementById('mainContent').innerHTML =
    '<div class="panel"><div class="panel-head"><h3>Stock</h3><button type="button" class="btn btn-primary btn-sm" id="btnAddInv">Add SKU</button></div>' +
    '<table class="data-table"><thead><tr><th>Item</th><th>Qty</th><th>Threshold</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<div class="panel"><h3 style="margin-bottom:0.5rem;">Low stock</h3><ul id="lowList" style="margin-left:1.1rem;color:var(--muted);"></ul></div>';
  const lowItems = state.inventory.filter(i => i.quantity <= i.threshold);
  document.getElementById('lowList').innerHTML = lowItems.length ? lowItems.map(i => '<li class="low-stock">' + escapeHtml(i.name) + ' — ' + i.quantity + ' ' + escapeHtml(i.unit) + '</li>').join('') : '<li>All SKUs above threshold.</li>';
  document.getElementById('btnAddInv').onclick = () => openInvModal(null);
  document.querySelectorAll('[data-act="edit-inv"]').forEach(b => b.onclick = () => openInvModal(b.dataset.id));
  document.querySelectorAll('[data-act="del-inv"]').forEach(b => {
    b.onclick = () => confirmDialog('Delete inventory row', 'Remove this SKU?', () => {
      state.inventory = state.inventory.filter(x => x.id !== b.dataset.id);
      state.menuItems.forEach(m => { m.recipe = (m.recipe || []).filter(r => r.inventoryId !== b.dataset.id); });
      saveState(state); toast('SKU removed'); renderInventory();
    });
  });
}

function openInvModal(id) {
  const i = id ? state.inventory.find(x => x.id === id) : null;
  const body = '<div class="form-row"><label>Name</label><input type="text" id="fInvName" value="' + escapeHtml(i ? i.name : '') + '" /></div>' +
    '<div class="form-row"><label>Quantity</label><input type="number" id="fInvQty" step="0.01" min="0" value="' + (i ? i.quantity : '') + '" /></div>' +
    '<div class="form-row"><label>Low-stock threshold</label><input type="number" id="fInvTh" step="0.01" min="0" value="' + (i ? i.threshold : '') + '" /></div>' +
    '<div class="form-row"><label>Unit</label><input type="text" id="fInvUnit" value="' + escapeHtml(i ? i.unit : 'unit') + '" /></div>';
  const footer = '<button type="button" class="btn btn-secondary" data-close>Cancel</button><button type="button" class="btn btn-primary" id="saveInv">Save</button>';
  openModal(i ? 'Edit inventory' : 'Add inventory', body, footer, () => {
    document.getElementById('saveInv').onclick = () => {
      const name = document.getElementById('fInvName').value.trim();
      const quantity = parseFloat(document.getElementById('fInvQty').value);
      const threshold = parseFloat(document.getElementById('fInvTh').value);
      const unit = document.getElementById('fInvUnit').value.trim() || 'unit';
      if (!name || !(quantity >= 0) || !(threshold >= 0)) { toast('Invalid inventory fields', 'error'); return; }
      if (i) { i.name = name; i.quantity = quantity; i.threshold = threshold; i.unit = unit; }
      else state.inventory.push({ id: uid(), name, quantity, threshold, unit });
      saveState(state); closeModal(); toast('Inventory saved'); renderInventory();
    };
    document.querySelector('[data-close]').onclick = closeModal;
  });
}

function renderOrders() {
  const filterSel = '<select id="orderFilter" class="grow" style="max-width:200px;">' +
    ['all', 'draft', 'pending', 'preparing', 'completed', 'billed'].map(f => '<option value="' + f + '"' + (orderFilter === f ? ' selected' : '') + '>' + f + '</option>').join('') + '</select>';
  let list = state.orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (orderFilter !== 'all') list = list.filter(o => o.status === orderFilter);
  let rows = '';
  list.forEach(o => {
    const tbl = getTable(o.tableId);
    rows += '<tr><td><code>' + o.id.slice(-8) + '</code></td><td>' + (tbl ? escapeHtml(tbl.number) : '—') + '</td>' +
      '<td><span class="badge ' + badgeClassForOrder(o.status) + '">' + o.status + '</span></td>' +
      '<td>' + money(computeOrderSubtotal(o)) + '</td><td style="font-size:0.8rem;color:var(--muted);">' + formatDate(o.createdAt) + '</td>' +
      '<td class="flex">' +
      '<button type="button" class="btn btn-sm btn-secondary" data-act="view-order" data-id="' + o.id + '">Open</button>' +
      (canEditOrder(o) ? '<button type="button" class="btn btn-sm btn-secondary" data-act="edit-order" data-id="' + o.id + '">Edit</button>' : '') +
      (o.status === 'draft' ? '<button type="button" class="btn btn-sm btn-primary" data-act="submit-order" data-id="' + o.id + '">Send to kitchen</button>' : '') +
      ((currentRole === 'admin' && o.status !== 'billed') ? '<button type="button" class="btn btn-sm btn-danger" data-act="del-order" data-id="' + o.id + '">Delete</button>' : '') +
      '</td></tr>';
  });
  const canCreate = currentRole === 'staff' || currentRole === 'admin';
  document.getElementById('mainContent').innerHTML =
    '<div class="panel"><div class="panel-head"><h3>Orders</h3><div class="toolbar flex">' + filterSel +
    (canCreate ? '<button type="button" class="btn btn-primary btn-sm" id="btnNewOrder">New order</button>' : '') +
    '</div></div>' +
    (list.length ? '<table class="data-table"><thead><tr><th>ID</th><th>Table</th><th>Status</th><th>Subtotal</th><th>Created</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p class="empty">No orders in this filter.</p>') +
    '</div>';
  document.getElementById('orderFilter').onchange = (e) => { orderFilter = e.target.value; renderOrders(); };
  if (canCreate) document.getElementById('btnNewOrder').onclick = () => openOrderComposer(null);
  document.querySelectorAll('[data-act="view-order"]').forEach(b => b.onclick = () => openOrderComposer(b.dataset.id));
  document.querySelectorAll('[data-act="edit-order"]').forEach(b => b.onclick = () => openOrderComposer(b.dataset.id));
  document.querySelectorAll('[data-act="submit-order"]').forEach(b => b.onclick = () => submitOrderToKitchen(b.dataset.id));
  document.querySelectorAll('[data-act="del-order"]').forEach(b => {
    b.onclick = () => confirmDialog('Delete order', 'Remove this order permanently?', () => {
      state.orders = state.orders.filter(x => x.id !== b.dataset.id);
      saveState(state); toast('Order deleted'); renderOrders();
    });
  });
}

function submitOrderToKitchen(oid) {
  const o = getOrder(oid);
  if (!o || !o.items.length) { toast('Add items first', 'error'); return; }
  const tbl = getTable(o.tableId);
  if (!tbl) { toast('Invalid table', 'error'); return; }
  o.status = 'pending';
  o.createdAt = o.createdAt || new Date().toISOString();
  saveState(state);
  toast('Order sent to kitchen');
  renderOrders();
}

function openOrderComposer(orderId) {
  const existing = orderId ? getOrder(orderId) : null;
  const readOnly = existing && !canEditOrder(existing);
  const tableOpts = state.tables.map(t =>
    '<option value="' + t.id + '"' + (existing && existing.tableId === t.id ? ' selected' : '') + '>' + escapeHtml(t.number) + ' (' + t.status + ')</option>').join('');
  const lines = existing ? existing.items.slice() : [];
  function lineHtml() {
    let h = '';
    lines.forEach((line, idx) => {
      const m = getMenuItem(line.menuItemId);
      h += '<div class="flex" style="align-items:center;margin-bottom:0.35rem;" data-line="' + idx + '">' +
        '<span class="grow">' + escapeHtml(m ? m.name : '?') + ' × ' + line.qty + '</span>' +
        '<span style="min-width:70px;">' + money(orderLineSubtotal(line)) + '</span>' +
        (readOnly ? '' : '<button type="button" class="btn btn-sm btn-danger" data-rm-line="' + idx + '">−</button>') + '</div>';
    });
    return h || '<p class="empty" style="padding:0.5rem;">No lines yet</p>';
  }
  const menuPick = state.menuItems.filter(m => m.available).map(m =>
    '<option value="' + m.id + '">' + escapeHtml(m.name) + ' — ' + money(m.price) + '</option>').join('');
  const body = '<div class="form-row"><label>Table</label><select id="ordTable" ' + (readOnly ? 'disabled' : '') + '><option value="">Select…</option>' + tableOpts + '</select></div>' +
    '<div class="split-2" style="margin-top:1rem;">' +
    '<div><label style="display:block;margin-bottom:0.35rem;color:var(--muted);font-size:0.8rem;">Menu</label>' +
    (readOnly ? '' : '<div class="flex" style="margin-bottom:0.5rem;"><select id="ordMenu" class="grow">' + menuPick + '</select>' +
    '<input type="number" id="ordQty" min="1" value="1" style="width:64px;" /><button type="button" class="btn btn-primary btn-sm" id="ordAdd">Add</button></div>') +
    '<input type="search" id="ordMenuSearch" placeholder="Filter menu…" style="width:100%;margin-bottom:0.5rem;' + (readOnly ? 'display:none;' : '') + '" />' +
    '<div class="menu-grid" id="ordMenuGrid"></div></div>' +
    '<div class="panel" style="margin:0;"><strong>Cart</strong><div id="ordCart" style="margin-top:0.5rem;">' + lineHtml() + '</div>' +
    '<div style="margin-top:0.75rem;font-weight:700;">Subtotal: <span id="ordSub">' + money(lines.reduce((s, l) => s + orderLineSubtotal(l), 0)) + '</span></div>' +
    (readOnly ? '' : '<div class="form-row" style="margin-top:0.75rem;"><label>Notes (order)</label><textarea id="ordNotes" rows="2">' + escapeHtml(existing && existing.notes ? existing.notes : '') + '</textarea></div>') +
    '</div></div>';
  const footer = '<button type="button" class="btn btn-secondary" data-close>Close</button>' +
    (readOnly ? '' : '<button type="button" class="btn btn-primary" id="ordSave">Save order</button>') +
    (!readOnly && existing && existing.status === 'draft' ? '<button type="button" class="btn btn-secondary" id="ordSend">Save & send to kitchen</button>' : '');
  openModal(existing ? 'Order' : 'New order', body, footer, () => {
    const notesEl = document.getElementById('ordNotes');
    function refreshCart() {
      document.getElementById('ordCart').innerHTML = lineHtml();
      document.getElementById('ordSub').textContent = money(lines.reduce((s, l) => s + orderLineSubtotal(l), 0));
      document.getElementById('ordCart').querySelectorAll('[data-rm-line]').forEach(btn => {
        btn.onclick = () => { lines.splice(parseInt(btn.dataset.rmLine, 10), 1); refreshCart(); };
      });
    }
    function renderMenuTiles(q) {
      const g = document.getElementById('ordMenuGrid');
      const qq = (q || '').toLowerCase();
      const items = state.menuItems.filter(m => m.available && (!qq || m.name.toLowerCase().includes(qq) || (m.category || '').toLowerCase().includes(qq)));
      g.innerHTML = items.map(m =>
        '<div class="menu-tile" data-mid="' + m.id + '"><strong>' + escapeHtml(m.name) + '</strong><div style="color:var(--accent);">' + money(m.price) + '</div><div style="font-size:0.75rem;color:var(--muted);">' + escapeHtml(m.category || '') + '</div></div>').join('') || '<p class="empty">No matches</p>';
      if (!readOnly) {
        g.querySelectorAll('.menu-tile').forEach(tile => {
          tile.onclick = () => {
            const qty = parseInt(document.getElementById('ordQty').value, 10) || 1;
            const mid = tile.dataset.mid;
            const ex = lines.find(l => l.menuItemId === mid);
            if (ex) ex.qty += qty; else lines.push({ menuItemId: mid, qty, notes: '' });
            refreshCart();
            tile.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 280 });
          };
        });
      }
    }
    const searchEl = document.getElementById('ordMenuSearch');
    if (searchEl) { searchEl.oninput = () => renderMenuTiles(searchEl.value); renderMenuTiles(''); } else renderMenuTiles('');
    const addBtn = document.getElementById('ordAdd');
    if (addBtn) {
      addBtn.onclick = () => {
        const mid = document.getElementById('ordMenu').value;
        const qty = parseInt(document.getElementById('ordQty').value, 10) || 1;
        if (!mid) return;
        const ex = lines.find(l => l.menuItemId === mid);
        if (ex) ex.qty += qty; else lines.push({ menuItemId: mid, qty, notes: '' });
        refreshCart();
      };
    }
    refreshCart();
    document.querySelector('[data-close]').onclick = closeModal;
    const saveBtn = document.getElementById('ordSave');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const tableId = document.getElementById('ordTable').value;
        if (!tableId) { toast('Select a table', 'error'); return; }
        if (!lines.length) { toast('Add at least one item', 'error'); return; }
        const notes = notesEl ? notesEl.value.trim() : '';
        if (existing) {
          existing.tableId = tableId; existing.items = lines.map(l => ({ ...l })); existing.notes = notes;
        } else {
          state.orders.push({
            id: uid(),
            tableId,
            items: lines.map(l => ({ ...l })),
            status: 'draft',
            createdAt: new Date().toISOString(),
            notes,
            _inventoryDeducted: false,
          });
        }
        saveState(state); closeModal(); toast('Order saved'); renderOrders();
      };
    }
    const sendBtn = document.getElementById('ordSend');
    if (sendBtn) {
      sendBtn.onclick = () => {
        const tableId = document.getElementById('ordTable').value;
        if (!tableId || !lines.length) { toast('Table and items required', 'error'); return; }
        const notes = notesEl ? notesEl.value.trim() : '';
        let o = existing;
        if (!o) {
          o = { id: uid(), tableId, items: lines.map(l => ({ ...l })), status: 'draft', createdAt: new Date().toISOString(), notes, _inventoryDeducted: false };
          state.orders.push(o);
        } else {
          o.tableId = tableId; o.items = lines.map(l => ({ ...l })); o.notes = notes;
        }
        o.status = 'pending';
        saveState(state); closeModal(); toast('Order sent to kitchen'); renderOrders();
      };
    }
  });
}

function renderKitchen() {
  const kf = '<select id="kFilter" style="max-width:220px;">' +
    '<option value="active">Active (pending / preparing)</option><option value="pending">Pending only</option><option value="preparing">Preparing only</option><option value="completed">Completed</option><option value="all">All non-billed</option></select>';
  let orders = state.orders.filter(o => o.status !== 'draft' && o.status !== 'billed');
  const filtVal = kitchenFilter;
  if (filtVal === 'active') orders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
  else if (filtVal === 'pending') orders = orders.filter(o => o.status === 'pending');
  else if (filtVal === 'preparing') orders = orders.filter(o => o.status === 'preparing');
  else if (filtVal === 'completed') orders = orders.filter(o => o.status === 'completed');
  orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let cards = '';
  orders.forEach(o => {
    const tbl = getTable(o.tableId);
    const items = (o.items || []).map(l => {
      const m = getMenuItem(l.menuItemId);
      return '<li>' + escapeHtml(m ? m.name : '?') + ' × ' + l.qty + '</li>';
    }).join('');
    const nextBtn = o.status === 'pending'
      ? '<button type="button" class="btn btn-primary btn-sm" data-k="' + o.id + '" data-next="preparing">Start preparing</button>'
      : o.status === 'preparing'
        ? '<button type="button" class="btn btn-primary btn-sm" data-k="' + o.id + '" data-next="completed">Mark completed</button>'
        : '<span style="color:var(--muted);font-size:0.85rem;">Waiting for billing</span>';
    cards += '<div class="card" style="margin-bottom:0.75rem;"><div class="flex" style="justify-content:space-between;margin-bottom:0.5rem;">' +
      '<strong>Table ' + (tbl ? escapeHtml(tbl.number) : '?') + '</strong><span class="badge ' + badgeClassForOrder(o.status) + '">' + o.status + '</span></div>' +
      '<ul style="margin-left:1.1rem;color:var(--muted);font-size:0.9rem;">' + items + '</ul>' +
      '<div class="flex" style="margin-top:0.75rem;">' + nextBtn + '</div></div>';
  });
  document.getElementById('mainContent').innerHTML =
    '<div class="panel"><div class="panel-head"><h3>Kitchen board</h3><div class="toolbar">' + kf + '</div></div>' +
    (cards || '<p class="empty">No tickets in this filter.</p>') + '</div>';
  const sel = document.getElementById('kFilter');
  sel.value = filtVal;
  sel.onchange = () => { kitchenFilter = sel.value; renderKitchen(); };
  document.querySelectorAll('[data-k]').forEach(btn => {
    btn.onclick = () => advanceKitchenOrder(btn.dataset.k, btn.dataset.next);
  });
}

function advanceKitchenOrder(orderId, next) {
  const o = getOrder(orderId);
  if (!o) return;
  if (next === 'preparing' && o.status === 'pending') {
    o.status = 'preparing';
    deductInventoryForOrder(o);
  } else if (next === 'completed' && o.status === 'preparing') {
    o.status = 'completed';
  }
  saveState(state);
  toast('Order updated');
  renderKitchen();
}

function renderBilling() {
  const billable = state.orders.filter(o => o.status === 'completed');
  let rows = '';
  billable.forEach(o => {
    const tbl = getTable(o.tableId);
    const sub = computeOrderSubtotal(o);
    rows += '<tr><td><code>' + o.id.slice(-8) + '</code></td><td>' + (tbl ? escapeHtml(tbl.number) : '') + '</td><td>' + money(sub) + '</td>' +
      '<td><button type="button" class="btn btn-sm btn-primary" data-bill="' + o.id + '">Generate bill</button></td></tr>';
  });
  document.getElementById('mainContent').innerHTML =
    '<div class="panel"><div class="panel-head"><h3>Ready for billing</h3><p style="color:var(--muted);font-size:0.85rem;">Kitchen completed orders appear here.</p></div>' +
    (rows ? '<table class="data-table"><thead><tr><th>Order</th><th>Table</th><th>Subtotal</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p class="empty">No completed orders awaiting bill.</p>') +
    '</div>';
  document.querySelectorAll('[data-bill]').forEach(b => b.onclick = () => openBillModal(b.dataset.bill));
}

function openBillModal(orderId) {
  const o = getOrder(orderId);
  if (!o) return;
  const sub = computeOrderSubtotal(o);
  const taxRate = state.settings.taxRate;
  const svcPct = state.settings.serviceChargePercent;
  const body = '<div id="billPrint" class="print-bill">' +
    '<h3 style="color:var(--accent);margin-bottom:0.5rem;">RMS — Bill</h3>' +
    '<p style="font-size:0.85rem;color:var(--muted);">Table: ' + escapeHtml(getTable(o.tableId) ? getTable(o.tableId).number : '') + ' · ' + formatDate(new Date().toISOString()) + '</p>' +
    '<ul style="margin:1rem 0;">' + (o.items || []).map(l => {
      const m = getMenuItem(l.menuItemId);
      return '<li>' + escapeHtml(m ? m.name : '?') + ' × ' + l.qty + ' — ' + money(orderLineSubtotal(l)) + '</li>';
    }).join('') + '</ul>' +
    '<div class="form-row"><label>Discount (₹)</label><input type="number" id="billDisc" step="0.01" min="0" value="0" /></div>' +
    '<div class="form-row"><label>Service charge (%)</label><input type="number" id="billSvc" step="0.01" min="0" value="' + (svcPct * 100) + '" /></div>' +
    '<p style="margin-top:0.5rem;">Subtotal: <strong id="bSub">' + money(sub) + '</strong></p>' +
    '<p>Tax (' + (taxRate * 100).toFixed(1) + '%): <strong id="bTax">' + money(sub * taxRate) + '</strong></p>' +
    '<p>Service: <strong id="bSvc">' + money(sub * svcPct) + '</strong></p>' +
    '<p>Discount: <strong id="bDisc">₹0.00</strong></p>' +
    '<p style="font-size:1.2rem;margin-top:0.5rem;color:var(--accent);">Total: <strong id="bTotal">' + money(sub + sub * taxRate + sub * svcPct) + '</strong></p>' +
    '</div>' +
    '<p style="font-size:0.8rem;color:var(--muted);margin-top:0.75rem;">Tax rate from settings: ' + (taxRate * 100).toFixed(1) + '%. Adjust service % per bill.</p>';
  const footer = '<button type="button" class="btn btn-secondary" data-close>Cancel</button>' +
    '<button type="button" class="btn btn-secondary" id="btnPrintBill">Print / PDF</button>' +
    '<button type="button" class="btn btn-primary" id="btnFinalizeBill">Finalize & free table</button>';
  openModal('Billing', body, footer, () => {
    function recalc() {
      const disc = parseFloat(document.getElementById('billDisc').value) || 0;
      const svcP = (parseFloat(document.getElementById('billSvc').value) || 0) / 100;
      const afterDisc = Math.max(0, sub - disc);
      const tax = afterDisc * taxRate;
      const svc = afterDisc * svcP;
      const total = afterDisc + tax + svc;
      document.getElementById('bSub').textContent = money(sub);
      document.getElementById('bTax').textContent = money(tax);
      document.getElementById('bSvc').textContent = money(svc);
      document.getElementById('bDisc').textContent = money(disc);
      document.getElementById('bTotal').textContent = money(total);
    }
    document.getElementById('billDisc').oninput = recalc;
    document.getElementById('billSvc').oninput = recalc;
    recalc();
    document.getElementById('btnPrintBill').onclick = () => window.print();
    document.getElementById('btnFinalizeBill').onclick = () => {
      const disc = parseFloat(document.getElementById('billDisc').value) || 0;
      const svcP = (parseFloat(document.getElementById('billSvc').value) || 0) / 100;
      const afterDisc = Math.max(0, sub - disc);
      const tax = afterDisc * taxRate;
      const svc = afterDisc * svcP;
      const total = afterDisc + tax + svc;
      o.status = 'billed';
      o.subtotal = sub;
      o.discount = disc;
      o.tax = tax;
      o.serviceCharge = svc;
      o.total = total;
      o.billedAt = new Date().toISOString();
      const tbl = getTable(o.tableId);
      if (tbl) tbl.status = 'available';
      saveState(state);
      closeModal();
      toast('Bill finalized — table released');
      renderBilling();
    };
    document.querySelector('[data-close]').onclick = closeModal;
  });
}

let reportRange = '7';

function renderReports() {
  if (currentRole !== 'admin') {
    document.getElementById('mainContent').innerHTML = '<p class="empty">Reports are restricted to Admin.</p>';
    return;
  }
  const billed = state.orders.filter(o => o.status === 'billed');
  const rangeSel = '<select id="repRange"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All time</option></select>';
  const now = new Date();
  const cutoff = (days) => { const d = new Date(now); d.setDate(d.getDate() - days); return d; };
  function inRange(o, days) {
    if (days === 'all') return true;
    const d = new Date(o.billedAt || o.createdAt);
    return d >= cutoff(parseInt(days, 10));
  }
  const days = reportRange;
  const filtered = billed.filter(o => inRange(o, days === 'all' ? 'all' : days));
  const sum = filtered.reduce((s, o) => s + (o.total || 0), 0);
  const byCat = {};
  filtered.forEach(o => {
    (o.items || []).forEach(l => {
      const m = getMenuItem(l.menuItemId);
      const c = m ? (m.category || 'Other') : 'Other';
      byCat[c] = (byCat[c] || 0) + orderLineSubtotal(l);
    });
  });
  const maxCat = Math.max(1, ...Object.values(byCat));
  const bars = Object.keys(byCat).sort().map(c => {
    const h = Math.round((byCat[c] / maxCat) * 100);
    return '<div style="flex:1;text-align:center;"><div class="chart-bar" style="height:100px;"><div class="bar" style="height:' + h + '%;"></div></div><div style="font-size:0.65rem;color:var(--muted);margin-top:0.25rem;">' + escapeHtml(c) + '</div></div>';
  }).join('');
  document.getElementById('mainContent').innerHTML =
    '<div class="panel"><div class="panel-head"><h3>Sales analytics</h3><div class="toolbar">' + rangeSel + '</div></div>' +
    '<div class="grid-cards"><div class="card"><div class="label">Bills in range</div><div class="value">' + filtered.length + '</div></div>' +
    '<div class="card"><div class="label">Revenue</div><div class="value">' + money(sum) + '</div></div></div>' +
    '<div class="panel"><h3 style="margin-bottom:0.5rem;">Revenue by category (line totals)</h3><div class="flex" style="align-items:flex-end;min-height:120px;">' + (bars || '<p class="empty">No billed data in range.</p>') + '</div></div>' +
    '<div class="panel"><h3 style="margin-bottom:0.5rem;">Recent bills</h3>' +
    '<table class="data-table"><thead><tr><th>When</th><th>Table</th><th>Total</th></tr></thead><tbody>' +
    billed.slice(-12).reverse().map(o => '<tr><td>' + formatDate(o.billedAt) + '</td><td>' + escapeHtml(getTable(o.tableId) ? getTable(o.tableId).number : '') + '</td><td>' + money(o.total) + '</td></tr>').join('') +
    '</tbody></table></div>' +
    '<div class="panel"><h3 style="margin-bottom:0.75rem;">Billing defaults (tax & service)</h3>' +
    '<div class="flex" style="align-items:flex-end;">' +
    '<div class="form-row grow"><label>Tax rate (%)</label><input type="number" id="setTax" step="0.1" min="0" value="' + (state.settings.taxRate * 100) + '" /></div>' +
    '<div class="form-row grow"><label>Default service charge (%)</label><input type="number" id="setSvc" step="0.1" min="0" value="' + (state.settings.serviceChargePercent * 100) + '" /></div>' +
    '<button type="button" class="btn btn-primary" id="btnSaveSettings">Save settings</button></div>' +
    '<p style="font-size:0.8rem;color:var(--muted);margin-top:0.5rem;">Used for new bills (service can still be edited per bill).</p></div>';
  const rs = document.getElementById('repRange');
  rs.value = days;
  rs.onchange = () => { reportRange = rs.value; renderReports(); };
  document.getElementById('btnSaveSettings').onclick = () => {
    const tr = parseFloat(document.getElementById('setTax').value);
    const sv = parseFloat(document.getElementById('setSvc').value);
    if (!(tr >= 0) || !(sv >= 0)) { toast('Invalid percentages', 'error'); return; }
    state.settings.taxRate = tr / 100;
    state.settings.serviceChargePercent = sv / 100;
    saveState(state);
    toast('Settings saved');
  };
}

function renderFeedback() {
  const avg = state.feedback.length
    ? (state.feedback.reduce((s, f) => s + f.rating, 0) / state.feedback.length).toFixed(1)
    : '—';
  const list = state.feedback.slice().reverse().map(f =>
    '<div class="card" style="margin-bottom:0.5rem;"><strong>' + '★'.repeat(f.rating) + '☆'.repeat(5 - f.rating) + '</strong>' +
    '<p style="margin-top:0.35rem;font-size:0.9rem;">' + escapeHtml(f.comment || '') + '</p>' +
    '<div style="font-size:0.75rem;color:var(--muted);">' + formatDate(f.createdAt) + '</div></div>').join('');
  document.getElementById('mainContent').innerHTML =
    '<div class="grid-cards"><div class="card"><div class="label">Avg rating</div><div class="value">' + avg + '</div><div class="sub">From ' + state.feedback.length + ' entries</div></div></div>' +
    '<div class="split-2">' +
    '<div class="panel"><h3 style="margin-bottom:0.75rem;">Submit feedback</h3>' +
    '<div class="form-row"><label>Rating</label><select id="fbRating">' + [5, 4, 3, 2, 1].map(n => '<option value="' + n + '">' + n + ' stars</option>').join('') + '</select></div>' +
    '<div class="form-row"><label>Comments</label><textarea id="fbComment" rows="3" placeholder="Service, food quality…"></textarea></div>' +
    '<button type="button" class="btn btn-primary" id="fbSubmit">Submit</button></div>' +
    '<div class="panel"><h3 style="margin-bottom:0.75rem;">Recent</h3>' + (list || '<p class="empty">No feedback yet.</p>') + '</div></div>';
  document.getElementById('fbSubmit').onclick = () => {
    const rating = parseInt(document.getElementById('fbRating').value, 10);
    const comment = document.getElementById('fbComment').value.trim();
    state.feedback.push({ id: uid(), rating, comment, createdAt: new Date().toISOString() });
    saveState(state);
    toast('Thanks for the feedback');
    renderFeedback();
  };
}
