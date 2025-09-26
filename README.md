
# Fliiper Print


Servidor de impresión en Node.js para tickets, soportando:

- Impresión vía PDF (`/print`) usando Puppeteer y `pdf-to-printer`.
- Impresión directa ESC/POS (`/print/raw`) usando `escpos` y `escpos-usb`.
- Listado de impresoras instaladas (`/printers`).

## 🖥 Requisitos

- **Node.js** >= 18.x  
- **npm** >= 9.x  
- Windows 10 / 11 (para impresión vía `pdf-to-printer`)  
- Impresora térmica USB compatible con ESC/POS (Ej: Epson TM-T20III)


Imprimi comandas y cuentas

```Bash
npm install escpos escpos-usb
npm install cors

```

```Bash
npm start

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

curl -X POST http://localhost:3000/print-comanda \
-H "Content-Type: application/json; charset=utf-8" \
-d '{
  "numeroComanda": "4908",
  "cuenta": "4530 - Orden 1",
  "mesa": "MESA (4)",
  "mesero": "PROMWEBSOFT",
  "fechaPedido": "2021-12-10 11:06:35",
  "productos": [
    {
      "cantidad": "-> 1.0",
      "nombre": "BURRITO"
    },
    {
      "cantidad": "-> 1.0", 
      "nombre": "COCA COLA SIN AZUCRA 600ML"
    },
    {
      "cantidad": "-> 1.0",
      "nombre": "AREPA SOLO HUEVO"
    },
    {
      "cantidad": "-> 1.0",
      "nombre": "FRUTO PERA PEQUEÑO"
    }
  ],
  "numeroImpresion": "1",
  "fechaImpresion": "2021-12-10 11:15:11",
  "printerName": "EPSON TM-T20III Receipt"
}'


curl -X POST http://localhost:3000/print-factura \
-H "Content-Type: application/json; charset=utf-8" \
-d '{
  "nombreNegocio": "BRAVA",
  "direccion": "Echenique 54",
  "productos": [
    {
      "descripcion": "Lorem ipsum x8",
      "precio": "$1.25"
    },
    {
      "descripcion": "Dolor sit amet x4",
      "precio": "$7.99"
    },
    {
      "descripcion": "Consectetur x2", 
      "precio": "$26.70"
    },
    {
      "descripcion": "Adipiscing elit x2",
      "precio": "$15.49"
    },
    {
      "descripcion": "Sed semper x2",
      "precio": "$18.79"
    },
    {
      "descripcion": "Accumsan ante x2",
      "precio": "$42.99"
    },
    {
      "descripcion": "Non laoreet x2",
      "precio": "$9.99"
    },
    {
      "descripcion": "Pul dapibus eu x2",
      "precio": "$27.50"
    }
  ],
  "subtotal": "$150.70",
  "ivaPercent": "16",
  "ivaValor": "$5.29", 
  "total": "$155.99",
  "propina": "$15.99",
  "totaltotal": "$130.99",
  "formaPago": "Credit",
  "printerName": "EPSON TM-T20III Receipt"
}'
```

```Bash
curl -X POST http://localhost:3000/print/raw \
-H "Content-Type: application/json" \
-d '{"printerName":"EPSON TM-T20III Receipt","cut":true,"lines":[{"text":"TICKET DE PRUEBA","align":"CT","style":"B","size":[2,2]},{"text":"Linea normal","align":"LT"},{"text":"Gracias por su compra!","align":"CT","style":"U"}]}'

  ```