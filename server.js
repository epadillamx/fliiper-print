const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const printer = require("pdf-to-printer");
const fs = require("fs");

const app = express();
app.use(bodyParser.json({ limit: "5mb" })); // soporta JSON grande

// Detectar Windows
const isWindows = process.platform === "win32";

// === Librería ESC/POS solo en Windows ===
let escpos, escposUSB;
if (isWindows) {
  escpos = require("escpos");
  escposUSB = escpos.USB;
}

// GET /printers -> lista impresoras
app.get("/printers", async (req, res) => {
  try {
    const printers = await printer.getPrinters();
    res.json({ printers });
  } catch (err) {
    res.status(500).json({ error: "Error obteniendo impresoras", details: err.message });
  }
});

// POST /print -> PDF
app.post("/print", async (req, res) => {

  const { html, printerName } = req.body;
  if (!html) return res.status(400).json({ error: "Falta parámetro 'html'" });

  const pdfPath = "./ticket.pdf";
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const fullHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket</title>
    </head>
    <body style="margin: 0; padding: 10px; font-family: 'Courier New', monospace;">
        ${html}
    </body>
    </html>
    `;
    await page.setContent(fullHtml);

    await page.pdf({
      path: pdfPath,
      printBackground: true,
      width: '3.15in',   // 80 mm
      height: '11.69in', // 297 mm
      margin: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    await browser.close();

    await printer.print(pdfPath, printerName ? { printer: printerName } : {});
    fs.unlinkSync(pdfPath);

    res.json({ success: true, message: "Ticket enviado a imprimir (PDF)" });
  } catch (err) {
    res.status(500).json({ error: "Error al imprimir", details: err.message });
  }
});

// POST /print/raw -> ESC/POS solo en Windows
app.post("/print/raw", async (req, res) => {
  if (!isWindows) {
    return res.status(400).json({ error: "ESC/POS solo disponible en Windows" });
  }

  const { lines, cut, printerName } = req.body;
  if (!lines || !Array.isArray(lines)) {
    return res.status(400).json({ error: "Falta el parámetro 'lines' como array" });
  }

  try {
    let device;

    if (printerName) {
      const devices = escposUSB.findPrinter();
      const match = devices.find(d => d.deviceDescriptor && d.deviceDescriptor.iProduct === printerName);
      if (match) {
        device = new escposUSB(match.deviceDescriptor.idVendor, match.deviceDescriptor.idProduct);
      } else {
        return res.status(404).json({ error: `No se encontró la impresora ${printerName}` });
      }
    } else {
      device = new escposUSB();
    }

    const printerRaw = new escpos.Printer(device);

    device.open(() => {
      lines.forEach(line => {
        const { text, align, style, size } = line;
        if (align) printerRaw.align(align);
        if (style) printerRaw.style(style.toLowerCase());
        if (size && Array.isArray(size)) printerRaw.size(size[0], size[1]);
        printerRaw.text(text || "");
      });
      if (cut) printerRaw.cut();
      printerRaw.close();
    });

    res.json({ success: true, message: "Ticket enviado a imprimir (ESC/POS JSON)" });
  } catch (err) {
    res.status(500).json({ error: "Error al imprimir RAW", details: err.message });
  }
});

// Servidor
const PORT = 3000;
app.listen(PORT, () =>
  console.log(`API http://localhost:${PORT}`)
);
