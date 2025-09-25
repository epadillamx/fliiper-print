
# Fliiper Print

Imprimi comandas y cuentas

```Bash
node list-printers.js

```

## Instalar PM2 globalmente
```Bash

npm install -g pm2
```
## Instalar PM2 globalmente
```Bash
npm install
```
## Iniciar la aplicación con PM2
```Bash
pm2 start ecosystem.config.js --env production
```

## Configurar arranque automático
```Bash
pm2 startup
pm2 save
```


## Examples

```Bash
curl -X POST http://localhost:3000/imprimir-comanda \
  -H "Content-Type: application/json" \
  -d '{"nombreImpresora":"EPSON TM-T20III","comanda":1,"ordenDeCompra":91,"productos":[{"producto":"Coca Cola 350 ml","cantidad":1}]}'
```

```Bash
curl -X POST http://localhost:3000/imprimir-cuenta \
  -H "Content-Type: application/json" \
  -d '{
    "header": {
      "empresa": "Brava",
      "direccion": "2cerrada orkkdasdsa"
    },
    "nombreImpresora": "EPSON TM-T20III",
    "ordenDeCompra": 91,
    "productos": [
      {
        "producto": "Coca Cola ml",
        "cantidad": 5,
        "precioUnitario": 25.00,
        "total": 125.00
      },
      {
        "producto": "Audífonos Bluetooth JBL 20h pz",
        "cantidad": 1,
        "precioUnitario": 750.00,
        "total": 750.00
      }
    ],
    "subtotal": 754.31,
    "descuento": {
      "porcentaje": 0,
      "cantidad": 0.00
    },
    "iva": {
      "porcentaje": 16,
      "cantidad": 120.69
    },
    "totalAPagar": 875.00,
    "fecha": "24/09/2025",
    "hora": "01:43 p.m."
  }'

  ```