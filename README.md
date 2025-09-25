
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
-d '{"html":"<h1>Turno N° 1</h1><p>Sucursal Centro</p><div>26/06/2025</div>","printerName":"EPSON TM-T20III Receipt"}'

```

```Bash
curl -X POST http://localhost:3000/print/raw \
-H "Content-Type: application/json" \
-d '{"printerName":"EPSON TM-T20III Receipt","cut":true,"lines":[{"text":"TICKET DE PRUEBA","align":"CT","style":"B","size":[2,2]},{"text":"Linea normal","align":"LT"},{"text":"Gracias por su compra!","align":"CT","style":"U"}]}'

  ```