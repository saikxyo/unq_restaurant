const Config = globalThis.RestaurantConfig;
const Target = global.exports.ox_target;
const Inventory = global.exports.ox_inventory;
const Ox = global.exports.ox_lib;

let serverState = {};
let zones = [];

function notify(description, type = 'inform') {
  emit('ox_lib:notify', { title: 'Restaurantes', description, type });
}

function coords(c) {
  return [c.x, c.y, c.z];
}

function zoneSize() {
  const s = Config.Zones.defaultSize;
  return [s.x, s.y, s.z];
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

async function inputDialog(title, rows) {
  try {
    return await Ox.inputDialog(title, rows);
  } catch (e) {
    notify('ox_lib inputDialog indisponível.', 'error');
    return null;
  }
}

async function alertDialog(data) {
  try {
    return await Ox.alertDialog(data);
  } catch (e) {
    return 'cancel';
  }
}

function registerContext(menu) {
  return Ox.registerContext(menu);
}

function showContext(id) {
  return Ox.showContext(id);
}

function progress(data) {
  return Ox.progressBar(data);
}

function requestState() {
  emitNet('mx_restaurants:server:requestState');
}

onNet('mx_restaurants:client:state', (state) => {
  serverState = state || {};
});

onNet('mx_restaurants:client:refresh', () => {
  requestState();
});

setTimeout(requestState, 2000);
setInterval(requestState, 60000);

function addBlips() {
  for (const [, data] of Object.entries(Config.Restaurants)) {
    if (!data.blip?.enabled) continue;
    const c = data.coords.cashier || data.coords.buy;
    const blip = AddBlipForCoord(c.x, c.y, c.z);
    SetBlipSprite(blip, data.blip.sprite || 106);
    SetBlipDisplay(blip, 4);
    SetBlipScale(blip, data.blip.scale || 0.75);
    SetBlipColour(blip, data.blip.color || 1);
    SetBlipAsShortRange(blip, true);
    BeginTextCommandSetBlipName('STRING');
    AddTextComponentString(data.label);
    EndTextCommandSetBlipName(blip);
  }
}

function registerTarget(id, pointName, options, size = null) {
  const data = Config.Restaurants[id];
  const c = data.coords[pointName];
  if (!c) return;

  const zoneId = Target.addBoxZone({
    coords: coords(c),
    name: `mx_restaurants_${id}_${pointName}`,
    size: size || zoneSize(),
    rotation: c.w || 0,
    debug: Config.Zones.debug,
    drawSprite: Config.Zones.drawSprite,
    options
  });

  zones.push(zoneId);
}

function openBuyMenu(id) {
  const data = Config.Restaurants[id];
  const state = serverState[id] || {};

  registerContext({
    id: `mx_restaurants_buy_${id}`,
    title: data.label,
    options: [
      {
        title: state.owned ? 'Restaurante já vendido' : `Comprar por R$ ${formatMoney(data.price)}`,
        description: state.owned ? 'Esse estabelecimento já possui dono.' : 'Comprar o restaurante e receber o job de dono.',
        icon: 'store',
        disabled: !!state.owned,
        onSelect: () => emitNet('mx_restaurants:server:buyRestaurant', id)
      }
    ]
  });

  showContext(`mx_restaurants_buy_${id}`);
}

function openCustomerMenu(id) {
  const data = Config.Restaurants[id];
  const options = data.menu.map((food) => ({
    title: `${food.label} - R$ ${formatMoney(food.price)}`,
    description: Config.Ordering.autoGiveItemsOnOrder ? 'Comprar e receber agora.' : 'Enviar pedido para a cozinha.',
    icon: 'utensils',
    onSelect: () => emitNet('mx_restaurants:server:orderMenuItem', id, food.item)
  }));

  registerContext({
    id: `mx_restaurants_menu_${id}`,
    title: `Cardápio - ${data.label}`,
    options
  });

  showContext(`mx_restaurants_menu_${id}`);
}

function openCraftMenu(id) {
  const data = Config.Restaurants[id];
  const options = data.craftItems.map((recipe) => {
    const ingredients = Object.entries(recipe.ingredients || {})
      .map(([name, count]) => `${count}x ${name}`)
      .join(', ');

    return {
      title: recipe.label,
      description: ingredients,
      icon: 'kitchen-set',
      onSelect: () => emitNet('mx_restaurants:server:craft', id, recipe.item)
    };
  });

  registerContext({
    id: `mx_restaurants_craft_${id}`,
    title: `Produção - ${data.label}`,
    options
  });

  showContext(`mx_restaurants_craft_${id}`);
}

async function openBillingMenu(id) {
  const input = await inputDialog('Cobrar cliente', [
    { type: 'number', label: 'ID do cliente', required: true, min: 1 },
    { type: 'number', label: 'Valor', required: true, min: Config.Billing.minAmount, max: Config.Billing.maxAmount },
    { type: 'input', label: 'Descrição', required: false, placeholder: 'Ex: Combo, pedido, evento...' }
  ]);

  if (!input) return;
  emitNet('mx_restaurants:server:createBill', id, input[0], input[1], input[2] || 'Consumo no restaurante');
}

function openCashierEmployeeMenu(id) {
  const data = Config.Restaurants[id];

  registerContext({
    id: `mx_restaurants_cashier_employee_${id}`,
    title: `Caixa - ${data.label}`,
    options: [
      { title: 'Cobrar cliente', icon: 'cash-register', onSelect: () => openBillingMenu(id) },
      { title: 'Ver cardápio', icon: 'book-open', onSelect: () => openCustomerMenu(id) }
    ]
  });

  showContext(`mx_restaurants_cashier_employee_${id}`);
}

async function openBossMenu(id, bossData = null) {
  if (!bossData) {
    emitNet('mx_restaurants:server:openBossData', id);
    return;
  }

  const data = Config.Restaurants[id];
  registerContext({
    id: `mx_restaurants_boss_${id}`,
    title: `Administração - ${data.label}`,
    options: [
      { title: `Saldo: R$ ${formatMoney(bossData.balance)}`, icon: 'wallet', disabled: true },
      { title: 'Depositar dinheiro', icon: 'money-bill-transfer', onSelect: () => bossDeposit(id) },
      { title: 'Sacar dinheiro', icon: 'hand-holding-dollar', onSelect: () => bossWithdraw(id) },
      { title: 'Contratar funcionário', icon: 'user-plus', onSelect: () => bossHire(id) },
      { title: 'Demitir funcionário', icon: 'user-minus', onSelect: () => bossFire(id) },
      { title: 'Vender restaurante', icon: 'store-slash', onSelect: () => bossSell(id) }
    ]
  });
  showContext(`mx_restaurants_boss_${id}`);
}

onNet('mx_restaurants:client:bossData', (id, data) => {
  openBossMenu(id, data);
});

async function bossDeposit(id) {
  const input = await inputDialog('Depositar', [{ type: 'number', label: 'Valor', required: true, min: 1 }]);
  if (input) emitNet('mx_restaurants:server:deposit', id, input[0]);
}

async function bossWithdraw(id) {
  const input = await inputDialog('Sacar', [{ type: 'number', label: 'Valor', required: true, min: 1 }]);
  if (input) emitNet('mx_restaurants:server:withdraw', id, input[0]);
}

async function bossHire(id) {
  const input = await inputDialog('Contratar funcionário', [
    { type: 'number', label: 'ID do player', required: true, min: 1 },
    { type: 'number', label: 'Grade', required: true, min: 0, max: Config.Ownership.ownerGrade }
  ]);
  if (input) emitNet('mx_restaurants:server:hire', id, input[0], input[1]);
}

async function bossFire(id) {
  const input = await inputDialog('Demitir funcionário', [
    { type: 'number', label: 'ID do player', required: true, min: 1 }
  ]);
  if (input) emitNet('mx_restaurants:server:fire', id, input[0]);
}

async function bossSell(id) {
  const data = Config.Restaurants[id];
  const value = Math.floor(data.price * Config.Ownership.sellBackPercent);
  const result = await alertDialog({
    header: 'Vender restaurante',
    content: `Deseja vender ${data.label} por R$ ${formatMoney(value)}?`,
    centered: true,
    cancel: true
  });
  if (result === 'confirm') emitNet('mx_restaurants:server:sellRestaurant', id);
}

function openOrders(id) {
  emitNet('mx_restaurants:server:getOrders', id);
}

onNet('mx_restaurants:client:orders', (id, orders) => {
  const data = Config.Restaurants[id];
  const options = (orders || []).map((order) => ({
    title: `#${order.id} - ${order.label}`,
    description: `Cliente: ${order.customerName}`,
    icon: 'receipt',
    onSelect: () => emitNet('mx_restaurants:server:finishOrder', id, order.id)
  }));

  if (!options.length) {
    options.push({ title: 'Nenhum pedido na fila', icon: 'circle-info', disabled: true });
  }

  registerContext({
    id: `mx_restaurants_orders_${id}`,
    title: `Pedidos - ${data.label}`,
    options
  });

  showContext(`mx_restaurants_orders_${id}`);
});

onNet('mx_restaurants:client:confirmBill', async (bill) => {
  const result = await alertDialog({
    header: `Cobrança - ${bill.restaurantLabel}`,
    content: `${bill.employeeName} está cobrando R$ ${formatMoney(bill.amount)}.\n\n${bill.note || ''}`,
    centered: true,
    cancel: true,
    labels: { confirm: 'Pagar', cancel: 'Recusar' }
  });

  if (result === 'confirm') emitNet('mx_restaurants:server:payBill', bill.billId);
  else emitNet('mx_restaurants:server:declineBill', bill.billId);
});

onNet('mx_restaurants:client:craftProgress', async (id, item, label, duration) => {
  const ok = await progress({
    duration,
    label: `Produzindo ${label}...`,
    useWhileDead: false,
    canCancel: true,
    disable: { move: true, car: true, combat: true },
    anim: { dict: 'mini@repair', clip: 'fixing_a_ped' }
  });

  if (ok) emitNet('mx_restaurants:server:finishCraft', id, item);
});

function createZones() {
  for (const [id, data] of Object.entries(Config.Restaurants)) {
    registerTarget(id, 'buy', [
      { label: `Comprar ${data.label}`, icon: 'store', onSelect: () => openBuyMenu(id) }
    ]);

    registerTarget(id, 'cashier', [
      { label: 'Abrir cardápio', icon: 'book-open', onSelect: () => openCustomerMenu(id) },
      { label: 'Caixa do funcionário', icon: 'cash-register', groups: data.job, onSelect: () => openCashierEmployeeMenu(id) }
    ]);

    registerTarget(id, 'boss', [
      { label: 'Administrar restaurante', icon: 'briefcase', groups: data.job, onSelect: () => openBossMenu(id) }
    ]);

    registerTarget(id, 'stash', [
      { label: 'Abrir baú', icon: 'box', groups: data.job, onSelect: () => Inventory.openInventory('stash', `mx_restaurant_${id}_stash`) }
    ]);

    registerTarget(id, 'shop', [
      { label: 'Comprar ingredientes', icon: 'basket-shopping', groups: data.job, onSelect: () => Inventory.openInventory('shop', { type: `mx_restaurant_${id}_shop` }) }
    ]);

    registerTarget(id, 'craft', [
      { label: 'Produzir comidas', icon: 'kitchen-set', groups: data.job, onSelect: () => openCraftMenu(id) }
    ]);

    registerTarget(id, 'kitchen', [
      { label: 'Ver pedidos', icon: 'receipt', groups: data.job, onSelect: () => openOrders(id) }
    ]);
  }
}

on('onClientResourceStart', (res) => {
  if (res !== GetCurrentResourceName()) return;
  addBlips();
  createZones();
  requestState();
});
