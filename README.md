
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

curl -X POST http://localhost:3000/print \
-H "Content-Type: application/json" \
-d '{
  "html": "<style>.center { text-align: center; } .bold { font-weight: bold; } .small { font-size: 12px; } .line { border-bottom: 1px dashed #999; margin: 10px 0; }</style><div class=\"center bold\">COMANDA #4908</div><div class=\"line\"></div><div class=\"small\"><div>Cuenta: 4530 - Orden 1</div><div>Mesa: MESA (4)</div><div>Mesero: PROMWEBSOFT</div><div>Fecha y hora del pedido: 2021-12-10 11:06:35</div></div><div class=\"line\"></div><table width=\"100%\" class=\"small\"><tr class=\"bold\"><td>CANTIDAD</td><td>PRODUCTO</td></tr><tr><td>-> 1.0</td><td>BURRITO</td></tr><tr><td>-> 1.0</td><td>COCá COLA SIN AZUCRA 600ML</td></tr><tr><td>-> 1.0</td><td>AREPA SOLO HUEVO</td></tr><tr><td>-> 1.0</td><td>FRUTO PERA PEQUEÑO</td></tr></table><div class=\"line\"></div><div class=\"center small\">Impresa por primera vez<br>2021-12-10 11:15:11</div>",
  "printerName": "EPSON TM-T20III Receipt"
}'

```

```Bash
curl -X POST http://localhost:3000/print/raw \
-H "Content-Type: application/json" \
-d '{"printerName":"EPSON TM-T20III Receipt","cut":true,"lines":[{"text":"TICKET DE PRUEBA","align":"CT","style":"B","size":[2,2]},{"text":"Linea normal","align":"LT"},{"text":"Gracias por su compra!","align":"CT","style":"U"}]}'

  ```