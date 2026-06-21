fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'mx_restaurants'
author 'Mexico Roleplay'
description 'Sistema completo de compra, administração e operação de restaurantes para Qbox JS + ox_lib + ox_target + ox_inventory'
version '1.0.0'

shared_scripts {
    'config.js'
}

client_scripts {
    'client.js'
}

server_scripts {
    'server.js'
}

dependencies {
    'qbx_core',
    'oxmysql',
    'ox_lib',
    'ox_target',
    'ox_inventory'
}
