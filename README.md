
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



curl -X POST http://localhost:3000/print \
-H "Content-Type: application/json; charset=utf-8" \
-d '{
  "html": "<style>.center { text-align: center; } .bold { font-weight: bold; } .small { font-size: 10px; } .line { border-bottom: 1px dashed #999; margin: 10px 0; } .right { text-align: right; } .flex-row { display: flex; justify-content: space-between; margin: 2px 0; } .total-section { margin-top: 15px; padding-top: 10px; border-top: 1px solid #999; } .final-total { font-size: 14px; font-weight: bold; border-top: 2px solid #333; padding-top: 5px; margin-top: 5px; }</style><div class=\"center bold\">BUSINESS NAME</div><div class=\"center small\">123 Main Street<br>Suite 567<br>City Name, State 54321<br>123-456-7890</div><div class=\"line\"></div><div class=\"flex-row small\"><span>Lorem ipsum</span><span>$1.25</span></div><div class=\"flex-row small\"><span>Dolor sit amet</span><span>$7.99</span></div><div class=\"flex-row small\"><span>Consectetur</span><span>$26.70</span></div><div class=\"flex-row small\"><span>Adipiscing elit</span><span>$15.49</span></div><div class=\"flex-row small\"><span>Sed semper</span><span>$18.79</span></div><div class=\"flex-row small\"><span>Accumsan ante</span><span>$42.99</span></div><div class=\"flex-row small\"><span>Non laoreet</span><span>$9.99</span></div><div class=\"flex-row small\"><span>Pul dapibus eu</span><span>$27.50</span></div><div class=\"line\"></div><div class=\"total-section\"><div class=\"flex-row small\"><span>Sub Total</span><span>$150.70</span></div><div class=\"flex-row small\"><span>Sales Tax</span><span>$5.29</span></div><div class=\"line\"></div><div class=\"flex-row final-total\"><span>TOTAL</span><span>$155.99</span></div></div><div class=\"line\"></div><div class=\"center small\">Paid By: Credit</div><div class=\"center small\" style=\"margin-top: 15px;\">Credit Card: ****1234<br>Transaction ID: 234-567890<br>Approval Code: 123456</div><div class=\"line\"></div><div class=\"center small\">Thank You For Supporting<br>Local Business!</div>",
  "printerName": "EPSON TM-T20III Receipt"
}'

```

```Bash
curl -X POST http://localhost:3000/print/raw \
-H "Content-Type: application/json" \
-d '{"printerName":"EPSON TM-T20III Receipt","cut":true,"lines":[{"text":"TICKET DE PRUEBA","align":"CT","style":"B","size":[2,2]},{"text":"Linea normal","align":"LT"},{"text":"Gracias por su compra!","align":"CT","style":"U"}]}'

  ```