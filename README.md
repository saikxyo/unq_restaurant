# mx_restaurants

Sistema completo de restaurantes para FiveM Qbox em JavaScript.

## Recursos

- Compra de restaurante por player.
- Dono recebe job e grade configurável.
- Persistência de dono e saldo via oxmysql.
- Baú por restaurante via ox_inventory RegisterStash.
- Loja de ingredientes via ox_inventory RegisterShop.
- Produção/craft via ox_lib progressBar.
- Cardápio para clientes no caixa.
- Fila de pedidos para cozinha.
- Cobrança manual via caixa com confirmação do cliente.
- Conta/saldo da empresa.
- Menu boss: depositar, sacar, contratar, demitir e vender restaurante.
- Blips e zonas via ox_target.
- Configuração de múltiplos restaurantes em config.js.

## Dependências

- qbx_core
- oxmysql
- ox_lib
- ox_target
- ox_inventory

## Instalação

1. Coloque a pasta `mx_restaurants` em `resources/[local]/mx_restaurants`.
2. Importe `mx_restaurants.sql` no banco.
3. Garanta que os jobs existem no Qbox, exemplo: `burgershot` e `pizzathis`.
4. Garanta que os itens existem no ox_inventory.
5. Adicione no server.cfg:

```cfg
ensure oxmysql
ensure ox_lib
ensure ox_inventory
ensure ox_target
ensure qbx_core
ensure mx_restaurants
```

## Jobs necessários

Esse script define o job do player, mas o job precisa existir no seu Qbox.
Adicione jobs como `burgershot` e `pizzathis` na config de jobs do seu core.

Exemplo conceitual:

```lua
burgershot = {
    label = 'Burger Shot',
    type = 'restaurant',
    defaultDuty = true,
    offDutyPay = false,
    grades = {
        [0] = { name = 'Funcionário', payment = 50 },
        [1] = { name = 'Atendente', payment = 75 },
        [2] = { name = 'Cozinheiro', payment = 90 },
        [3] = { name = 'Gerente', payment = 120 },
        [4] = { name = 'Dono', isboss = true, payment = 150 }
    }
}
```

## Itens necessários no ox_inventory

Você precisa criar os itens usados no `config.js`:

```lua
['burger'] = { label = 'Hambúrguer', weight = 250, stack = true, close = true },
['fries'] = { label = 'Batata Frita', weight = 150, stack = true, close = true },
['cola'] = { label = 'Cola', weight = 250, stack = true, close = true },
['bread'] = { label = 'Pão', weight = 50, stack = true },
['meat'] = { label = 'Carne', weight = 100, stack = true },
['lettuce'] = { label = 'Alface', weight = 20, stack = true },
['potato'] = { label = 'Batata', weight = 80, stack = true },
['cola_syrup'] = { label = 'Xarope de Cola', weight = 80, stack = true },
['dough'] = { label = 'Massa', weight = 100, stack = true },
['cheese'] = { label = 'Queijo', weight = 80, stack = true },
['tomato_sauce'] = { label = 'Molho de Tomate', weight = 80, stack = true },
['pepperoni'] = { label = 'Pepperoni', weight = 80, stack = true },
['pizza_slice'] = { label = 'Fatia de Pizza', weight = 180, stack = true, close = true },
['pepperoni_pizza'] = { label = 'Pizza de Pepperoni', weight = 500, stack = true, close = true },
```

## Como criar novo restaurante

Copie um bloco dentro de `Config.Restaurants` em `config.js` e altere:

- `label`
- `job`
- `price`
- `coords`
- `shopItems`
- `menu`
- `craftItems`

Cada restaurante gera automaticamente:

- baú: `mx_restaurant_ID_stash`
- loja: `mx_restaurant_ID_shop`
- zonas de target
- cardápio
- craft
- pedidos
- conta da empresa

## Observações importantes

- O job precisa existir antes do player comprar.
- Os itens precisam existir antes de abrir loja/craft/cardápio.
- O script usa dinheiro em item `money`; se seu servidor usa outro nome, mude em `Config.Money.cashItem`.
- Se seu Qbox usa banco de forma diferente, ajuste `removeMoney` no `server.js`.
- Algumas versões de ox_lib em JS podem variar. Se `inputDialog`, `alertDialog` ou `progressBar` não forem expostos por export no seu build, use a versão Lua bridge ou módulos JS do ox_lib.

