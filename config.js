globalThis.RestaurantConfig = {
  Debug: false,
  Locale: 'pt-BR',

  Money: {
    cashItem: 'money',
    allowBankFallback: true,
    bankAccount: 'bank'
  },

  Ownership: {
    maxRestaurantsPerCitizen: 1,
    ownerGrade: 4,
    defaultEmployeeGrade: 0,
    allowOwnerSellBack: true,
    sellBackPercent: 0.55,
    requireOwnerToManage: true
  },

  Billing: {
    maxDistance: 4.0,
    minAmount: 1,
    maxAmount: 500000,
    employeeCommissionPercent: 0, // coloque 10 para funcionário ganhar 10% da cobrança
    societyPercent: 100,
    requireCustomerConfirmation: true
  },

  Ordering: {
    enablePlayerMenuPurchase: true,
    sendOrderToKitchen: true,
    autoGiveItemsOnOrder: false, // false = pedido entra na fila; true = player recebe direto
    orderExpireMinutes: 30
  },

  Zones: {
    defaultSize: { x: 1.5, y: 1.5, z: 2.0 },
    debug: false,
    drawSprite: true
  },

  Restaurants: {
    burgershot: {
      label: 'Burger Shot',
      job: 'burgershot',
      price: 250000,
      blip: { enabled: true, sprite: 106, color: 1, scale: 0.75 },

      coords: {
        buy: { x: -1194.75, y: -892.62, z: 13.99, w: 35.0 },
        cashier: { x: -1193.15, y: -895.55, z: 13.99, w: 35.0 },
        boss: { x: -1198.25, y: -901.21, z: 13.99, w: 35.0 },
        stash: { x: -1202.12, y: -895.18, z: 13.99, w: 35.0 },
        shop: { x: -1204.22, y: -894.65, z: 13.99, w: 35.0 },
        craft: { x: -1198.44, y: -898.62, z: 13.99, w: 35.0 },
        kitchen: { x: -1197.10, y: -899.75, z: 13.99, w: 35.0 }
      },

      stash: {
        slots: 80,
        weight: 200000
      },

      shopItems: [
        { name: 'bread', price: 5, count: 100 },
        { name: 'meat', price: 18, count: 100 },
        { name: 'lettuce', price: 4, count: 100 },
        { name: 'potato', price: 6, count: 100 },
        { name: 'cola_syrup', price: 10, count: 100 }
      ],

      menu: [
        { item: 'burger', label: 'Hambúrguer', price: 80, count: 1 },
        { item: 'fries', label: 'Batata Frita', price: 45, count: 1 },
        { item: 'cola', label: 'Cola', price: 25, count: 1 }
      ],

      craftItems: [
        {
          item: 'burger',
          label: 'Hambúrguer',
          count: 1,
          duration: 6000,
          ingredients: { bread: 1, meat: 1, lettuce: 1 }
        },
        {
          item: 'fries',
          label: 'Batata Frita',
          count: 1,
          duration: 5000,
          ingredients: { potato: 2 }
        },
        {
          item: 'cola',
          label: 'Cola',
          count: 1,
          duration: 3000,
          ingredients: { cola_syrup: 1 }
        }
      ]
    },

    pizza_this: {
      label: 'Pizza This',
      job: 'pizzathis',
      price: 320000,
      blip: { enabled: true, sprite: 267, color: 5, scale: 0.75 },

      coords: {
        buy: { x: 810.88, y: -750.52, z: 26.78, w: 90.0 },
        cashier: { x: 811.12, y: -752.25, z: 26.78, w: 90.0 },
        boss: { x: 803.85, y: -757.25, z: 26.78, w: 90.0 },
        stash: { x: 805.55, y: -761.70, z: 26.78, w: 90.0 },
        shop: { x: 803.22, y: -761.35, z: 26.78, w: 90.0 },
        craft: { x: 810.22, y: -761.75, z: 26.78, w: 90.0 },
        kitchen: { x: 808.25, y: -761.25, z: 26.78, w: 90.0 }
      },

      stash: { slots: 90, weight: 250000 },

      shopItems: [
        { name: 'dough', price: 8, count: 100 },
        { name: 'cheese', price: 12, count: 100 },
        { name: 'tomato_sauce', price: 8, count: 100 },
        { name: 'pepperoni', price: 18, count: 100 },
        { name: 'water', price: 8, count: 100 }
      ],

      menu: [
        { item: 'pizza_slice', label: 'Fatia de Pizza', price: 70, count: 1 },
        { item: 'pepperoni_pizza', label: 'Pizza de Pepperoni', price: 160, count: 1 },
        { item: 'water', label: 'Água', price: 20, count: 1 }
      ],

      craftItems: [
        {
          item: 'pizza_slice',
          label: 'Fatia de Pizza',
          count: 2,
          duration: 6500,
          ingredients: { dough: 1, cheese: 1, tomato_sauce: 1 }
        },
        {
          item: 'pepperoni_pizza',
          label: 'Pizza de Pepperoni',
          count: 1,
          duration: 8500,
          ingredients: { dough: 2, cheese: 2, tomato_sauce: 1, pepperoni: 2 }
        }
      ]
    }
  }
};
