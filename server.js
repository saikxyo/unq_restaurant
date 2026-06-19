const Config = globalThis.RestaurantConfig;
const Core = global.exports.qbx_core;
const Inventory = global.exports.ox_inventory;
const MySQL = global.exports.oxmysql;

const owners = new Map();
const balances = new Map();
const activeBills = new Map();
const activeOrders = new Map();
let billId = 0;
let orderId = 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args) => Config.Debug && console.log('[mx_restaurants]', ...args);

function restaurant(id) {
  return Config.Restaurants[id];
}

function notify(src, description, type = 'inform', title = 'Restaurantes') {
  emitNet('ox_lib:notify', src, { title, description, type });
}

function player(src) {
  try { return Core.GetPlayer(src); } catch { return null; }
}

function playerData(src) {
  const p = player(src);
  return p?.PlayerData || null;
}

function citizenId(src) {
  return playerData(src)?.citizenid;
}

function charName(src) {
  const info = playerData(src)?.charinfo || {};
  return `${info.firstname || 'ID'} ${info.lastname || src}`.trim();
}

function jobName(src) {
  return playerData(src)?.job?.name;
}

function jobGrade(src) {
  const grade = playerData(src)?.job?.grade;
  if (typeof grade === 'number') return grade;
  return Number(grade?.level || grade?.grade || 0);
}

function isEmployee(src, id) {
  const data = restaurant(id);
  return !!data && jobName(src) === data.job;
}

function isOwner(src, id) {
  return owners.get(id) === citizenId(src);
}

function isBoss(src, id) {
  return isEmployee(src, id) && (isOwner(src, id) || jobGrade(src) >= Config.Ownership.ownerGrade);
}

async function dbQuery(query, params = []) {
  try {
    return await MySQL.query_async(query, params);
  } catch (e) {
    return await MySQL.query(query, params);
  }
}

async function dbSingle(query, params = []) {
  const rows = await dbQuery(query, params);
  return Array.isArray(rows) ? rows[0] : rows;
}

async function dbInsert(query, params = []) {
  try { return await MySQL.insert_async(query, params); }
  catch { return await MySQL.insert(query, params); }
}

async function dbUpdate(query, params = []) {
  try { return await MySQL.update_async(query, params); }
  catch { return await MySQL.update(query, params); }
}

async function loadDatabase() {
  const rows = await dbQuery('SELECT restaurant, owner_citizenid, balance FROM mx_restaurants');
  owners.clear();
  balances.clear();

  for (const row of rows || []) {
    owners.set(row.restaurant, row.owner_citizenid);
    balances.set(row.restaurant, Number(row.balance || 0));
  }

  log('loaded restaurants', owners.size);
}

async function saveRestaurant(id) {
  await dbInsert(
    `INSERT INTO mx_restaurants (restaurant, owner_citizenid, balance)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE owner_citizenid = VALUES(owner_citizenid), balance = VALUES(balance)`,
    [id, owners.get(id) || null, Number(balances.get(id) || 0)]
  );
}

async function deleteRestaurant(id) {
  await dbUpdate('DELETE FROM mx_restaurants WHERE restaurant = ?', [id]);
  owners.delete(id);
  balances.delete(id);
}

function countOwned(cid) {
  let count = 0;
  for (const owner of owners.values()) if (owner === cid) count++;
  return count;
}

function hasItemMoney(src, amount) {
  return Number(Inventory.GetItem(src, Config.Money.cashItem, null, true) || 0) >= amount;
}

function removeMoney(src, amount) {
  amount = Number(amount);
  if (amount <= 0) return false;

  if (hasItemMoney(src, amount)) {
    return Inventory.RemoveItem(src, Config.Money.cashItem, amount);
  }

  if (Config.Money.allowBankFallback) {
    const p = player(src);
    const current = Number(p?.PlayerData?.money?.[Config.Money.bankAccount] || 0);
    if (current >= amount && p?.Functions?.RemoveMoney) {
      return p.Functions.RemoveMoney(Config.Money.bankAccount, amount, 'restaurant-payment');
    }
  }

  return false;
}

function addMoney(src, amount) {
  return Inventory.AddItem(src, Config.Money.cashItem, Number(amount));
}

async function addBalance(id, amount) {
  const current = Number(balances.get(id) || 0);
  balances.set(id, current + Number(amount));
  await saveRestaurant(id);
}

async function removeBalance(id, amount) {
  const current = Number(balances.get(id) || 0);
  if (current < amount) return false;
  balances.set(id, current - Number(amount));
  await saveRestaurant(id);
  return true;
}

function registerInventories() {
  for (const [id, data] of Object.entries(Config.Restaurants)) {
    Inventory.RegisterStash(
      `mx_restaurant_${id}_stash`,
      `Baú - ${data.label}`,
      data.stash?.slots || 80,
      data.stash?.weight || 200000,
      false,
      { [data.job]: 0 }
    );

    Inventory.RegisterShop(`mx_restaurant_${id}_shop`, {
      name: `Estoque - ${data.label}`,
      inventory: data.shopItems || [],
      groups: { [data.job]: 0 }
    });
  }
}

on('onResourceStart', async (res) => {
  if (res !== GetCurrentResourceName()) return;
  await wait(1000);
  registerInventories();
  await loadDatabase();
  console.log('[mx_restaurants] iniciado com sucesso.');
});

onNet('mx_restaurants:server:requestState', () => {
  const src = source;
  const payload = {};
  for (const id of Object.keys(Config.Restaurants)) {
    payload[id] = {
      owned: owners.has(id),
      owner: owners.get(id) || null,
      balance: balances.get(id) || 0,
      isOwner: isOwner(src, id),
      isEmployee: isEmployee(src, id),
      isBoss: isBoss(src, id)
    };
  }
  emitNet('mx_restaurants:client:state', src, payload);
});

onNet('mx_restaurants:server:buyRestaurant', async (id) => {
  const src = source;
  const data = restaurant(id);
  if (!data) return;

  const cid = citizenId(src);
  if (!cid) return notify(src, 'Personagem não encontrado.', 'error');
  if (owners.has(id)) return notify(src, 'Esse restaurante já possui dono.', 'error');
  if (countOwned(cid) >= Config.Ownership.maxRestaurantsPerCitizen) {
    return notify(src, 'Você já atingiu o limite de restaurantes por personagem.', 'error');
  }
  if (!removeMoney(src, data.price)) return notify(src, `Você precisa de R$ ${data.price.toLocaleString('pt-BR')}.`, 'error');

  owners.set(id, cid);
  balances.set(id, 0);
  await saveRestaurant(id);

  const p = player(src);
  const ok = p?.Functions?.SetJob?.(data.job, Config.Ownership.ownerGrade);
  notify(src, `Você comprou ${data.label} e recebeu o job ${data.job}.`, ok === false ? 'warning' : 'success');
  emitNet('mx_restaurants:client:refresh', -1);
});

onNet('mx_restaurants:server:sellRestaurant', async (id) => {
  const src = source;
  const data = restaurant(id);
  if (!data) return;
  if (!Config.Ownership.allowOwnerSellBack) return notify(src, 'Venda desativada na configuração.', 'error');
  if (!isOwner(src, id)) return notify(src, 'Somente o dono pode vender esse restaurante.', 'error');

  const value = Math.floor(data.price * Config.Ownership.sellBackPercent);
  await deleteRestaurant(id);
  addMoney(src, value);
  notify(src, `Restaurante vendido por R$ ${value.toLocaleString('pt-BR')}.`, 'success');
  emitNet('mx_restaurants:client:refresh', -1);
});

onNet('mx_restaurants:server:openBossData', (id) => {
  const src = source;
  const data = restaurant(id);
  if (!data) return;
  if (!isBoss(src, id)) return notify(src, 'Você não tem permissão.', 'error');

  emitNet('mx_restaurants:client:bossData', src, id, {
    label: data.label,
    balance: balances.get(id) || 0,
    owner: owners.get(id) || null
  });
});

onNet('mx_restaurants:server:deposit', async (id, amount) => {
  const src = source;
  amount = Math.floor(Number(amount || 0));
  if (!restaurant(id) || !isBoss(src, id)) return notify(src, 'Sem permissão.', 'error');
  if (amount <= 0) return notify(src, 'Valor inválido.', 'error');
  if (!removeMoney(src, amount)) return notify(src, 'Você não tem esse dinheiro.', 'error');
  await addBalance(id, amount);
  notify(src, `Depositado R$ ${amount.toLocaleString('pt-BR')}.`, 'success');
});

onNet('mx_restaurants:server:withdraw', async (id, amount) => {
  const src = source;
  amount = Math.floor(Number(amount || 0));
  if (!restaurant(id) || !isBoss(src, id)) return notify(src, 'Sem permissão.', 'error');
  if (amount <= 0) return notify(src, 'Valor inválido.', 'error');
  if (!(await removeBalance(id, amount))) return notify(src, 'Saldo insuficiente na empresa.', 'error');
  addMoney(src, amount);
  notify(src, `Sacado R$ ${amount.toLocaleString('pt-BR')}.`, 'success');
});

onNet('mx_restaurants:server:hire', (id, target, grade) => {
  const src = source;
  const data = restaurant(id);
  target = Number(target);
  grade = Number(grade ?? Config.Ownership.defaultEmployeeGrade);
  if (!data || !isBoss(src, id)) return notify(src, 'Sem permissão.', 'error');
  const t = player(target);
  if (!t) return notify(src, 'Player não encontrado.', 'error');
  t.Functions.SetJob(data.job, grade);
  notify(src, 'Funcionário contratado.', 'success');
  notify(target, `Você foi contratado no ${data.label}.`, 'success');
});

onNet('mx_restaurants:server:fire', (id, target) => {
  const src = source;
  const data = restaurant(id);
  target = Number(target);
  if (!data || !isBoss(src, id)) return notify(src, 'Sem permissão.', 'error');
  const t = player(target);
  if (!t) return notify(src, 'Player não encontrado.', 'error');
  t.Functions.SetJob('unemployed', 0);
  notify(src, 'Funcionário demitido.', 'success');
  notify(target, `Você foi demitido do ${data.label}.`, 'error');
});

onNet('mx_restaurants:server:createBill', (id, target, amount, note) => {
  const src = source;
  const data = restaurant(id);
  target = Number(target);
  amount = Math.floor(Number(amount || 0));

  if (!data || !isEmployee(src, id)) return notify(src, 'Você não trabalha aqui.', 'error');
  if (!GetPlayerPed(target)) return notify(src, 'Cliente não encontrado.', 'error');
  if (amount < Config.Billing.minAmount || amount > Config.Billing.maxAmount) return notify(src, 'Valor fora do limite.', 'error');

  const a = GetEntityCoords(GetPlayerPed(src));
  const b = GetEntityCoords(GetPlayerPed(target));
  const dist = Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2));
  if (dist > Config.Billing.maxDistance) return notify(src, 'Cliente muito longe.', 'error');

  const idBill = ++billId;
  activeBills.set(idBill, { restaurant: id, employee: src, target, amount, note: String(note || '') });

  if (!Config.Billing.requireCustomerConfirmation) {
    emit('mx_restaurants:server:payBill', idBill);
    return;
  }

  emitNet('mx_restaurants:client:confirmBill', target, {
    billId: idBill,
    restaurantLabel: data.label,
    employeeName: charName(src),
    amount,
    note: String(note || '')
  });

  notify(src, 'Cobrança enviada para o cliente.', 'success');
});

onNet('mx_restaurants:server:declineBill', (idBill) => {
  const src = source;
  const bill = activeBills.get(Number(idBill));
  if (!bill || bill.target !== src) return;
  activeBills.delete(Number(idBill));
  notify(src, 'Cobrança recusada.', 'inform');
  notify(bill.employee, 'Cliente recusou a cobrança.', 'error');
});

onNet('mx_restaurants:server:payBill', async (idBill) => {
  const src = source;
  const bill = activeBills.get(Number(idBill));
  if (!bill || bill.target !== src) return;
  activeBills.delete(Number(idBill));

  if (!removeMoney(src, bill.amount)) {
    notify(src, 'Dinheiro insuficiente.', 'error');
    return notify(bill.employee, 'Cliente não possui dinheiro suficiente.', 'error');
  }

  const commission = Math.floor(bill.amount * (Config.Billing.employeeCommissionPercent / 100));
  const society = bill.amount - commission;
  if (commission > 0 && GetPlayerPed(bill.employee)) addMoney(bill.employee, commission);
  await addBalance(bill.restaurant, society);

  notify(src, `Você pagou R$ ${bill.amount.toLocaleString('pt-BR')}.`, 'success');
  if (GetPlayerPed(bill.employee)) notify(bill.employee, 'Pagamento recebido.', 'success');
});

onNet('mx_restaurants:server:orderMenuItem', async (id, item) => {
  const src = source;
  const data = restaurant(id);
  if (!data) return;
  const menu = data.menu.find((i) => i.item === item);
  if (!menu) return;

  if (!removeMoney(src, menu.price)) return notify(src, 'Dinheiro insuficiente.', 'error');
  await addBalance(id, menu.price);

  if (Config.Ordering.autoGiveItemsOnOrder) {
    Inventory.AddItem(src, menu.item, menu.count || 1);
    return notify(src, `Você comprou ${menu.label}.`, 'success');
  }

  const newOrder = {
    id: ++orderId,
    restaurant: id,
    customer: src,
    customerName: charName(src),
    item: menu.item,
    label: menu.label,
    count: menu.count || 1,
    createdAt: Date.now()
  };

  if (!activeOrders.has(id)) activeOrders.set(id, []);
  activeOrders.get(id).push(newOrder);

  notify(src, `Pedido enviado para ${data.label}.`, 'success');
  for (const pid of getPlayers()) {
    if (isEmployee(Number(pid), id)) notify(Number(pid), `Novo pedido: ${menu.label}.`, 'inform');
  }
});

onNet('mx_restaurants:server:getOrders', (id) => {
  const src = source;
  if (!restaurant(id) || !isEmployee(src, id)) return notify(src, 'Sem permissão.', 'error');
  const now = Date.now();
  const orders = (activeOrders.get(id) || []).filter((o) => now - o.createdAt < Config.Ordering.orderExpireMinutes * 60000);
  activeOrders.set(id, orders);
  emitNet('mx_restaurants:client:orders', src, id, orders);
});

onNet('mx_restaurants:server:finishOrder', (id, requestedOrderId) => {
  const src = source;
  if (!restaurant(id) || !isEmployee(src, id)) return notify(src, 'Sem permissão.', 'error');
  const orders = activeOrders.get(id) || [];
  const idx = orders.findIndex((o) => o.id === Number(requestedOrderId));
  if (idx < 0) return notify(src, 'Pedido não encontrado.', 'error');

  const order = orders[idx];
  orders.splice(idx, 1);
  activeOrders.set(id, orders);

  Inventory.AddItem(src, order.item, order.count);
  notify(src, `Pedido produzido: ${order.label}. Entregue ao cliente.`, 'success');
  if (GetPlayerPed(order.customer)) notify(order.customer, `Seu pedido ${order.label} ficou pronto.`, 'success');
});

onNet('mx_restaurants:server:craft', async (id, item) => {
  const src = source;
  const data = restaurant(id);
  if (!data || !isEmployee(src, id)) return notify(src, 'Você não trabalha aqui.', 'error');
  const recipe = data.craftItems.find((r) => r.item === item);
  if (!recipe) return;

  for (const [ingredient, count] of Object.entries(recipe.ingredients || {})) {
    if (Number(Inventory.GetItem(src, ingredient, null, true) || 0) < Number(count)) {
      return notify(src, `Ingrediente insuficiente: ${ingredient}`, 'error');
    }
  }

  emitNet('mx_restaurants:client:craftProgress', src, id, item, recipe.label, recipe.duration || 5000);
});

onNet('mx_restaurants:server:finishCraft', (id, item) => {
  const src = source;
  const data = restaurant(id);
  if (!data || !isEmployee(src, id)) return;
  const recipe = data.craftItems.find((r) => r.item === item);
  if (!recipe) return;

  for (const [ingredient, count] of Object.entries(recipe.ingredients || {})) {
    if (Number(Inventory.GetItem(src, ingredient, null, true) || 0) < Number(count)) return;
  }
  for (const [ingredient, count] of Object.entries(recipe.ingredients || {})) {
    Inventory.RemoveItem(src, ingredient, Number(count));
  }
  Inventory.AddItem(src, recipe.item, recipe.count || 1);
  notify(src, `${recipe.label} produzido.`, 'success');
});
