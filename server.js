const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const printer = require("pdf-to-printer");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: '*', // Acepta cualquier dominio
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
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

app.post("/print-comanda", async (req, res) => {
  console.log(req.body)
  const {
    printerName = 'EPSON TM-T20III Receipt',
    numeroComanda,
    cuenta,
    mesa,
    mesero,
    fechaPedido,
    productos,
    numeroImpresion,
    fechaImpresion,
    comentarios, // <-- NUEVO: array opcional de strings
  } = req.body;

  // Validar datos requeridos
  if (!numeroComanda) return res.status(400).json({ error: "Falta parámetro 'numeroComanda'" });
  if (!productos || !Array.isArray(productos)) return res.status(400).json({ error: "Falta parámetro 'productos' como array" });

  // --- Helpers de sanitización (defensivo) ---
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const normStr = (s) => esc((s ?? "").toString().trim());
  const normArr = (arr) =>
    Array.isArray(arr)
      ? arr
          .map((x) => normStr(x))
          .filter((x) => x.length > 0)
          .slice(0, 50)
      : [];

  const safeProductos = Array.isArray(productos) ? productos : [];
  const safeComentarios = normArr(comentarios);

  const pdfPath = "./comanda.pdf";

  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // Generar filas de productos dinámicamente
    const productosHtml = safeProductos
      .map((producto) => {
        const cantidad = normStr(producto?.cantidad ?? "-> 1.0");
        const nombre = normStr(producto?.nombre ?? "");
        return `
          <tr>
            <td>${cantidad}</td>
            <td>${nombre}</td>
          </tr>
        `;
      })
      .join("");

    // Bloque de comentarios (opcional)
    const comentariosBlock = safeComentarios.length
      ? `
      <div class="line"></div>
      <div class="small bold">COMENTARIOS</div>
      <table width="100%" class="small">
        ${safeComentarios
          .map(
            (c) => `
            <tr>
              <td style="width:10px;">•</td>
              <td>${c}</td>
            </tr>
          `
          )
          .join("")}
      </table>
      `
      : "";

    const fullHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket</title>
        <style>
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .small { font-size: 12px; }
            .line { border-bottom: 1px dashed #999; margin: 10px 0; }
            body { margin: 0; padding: 10px; font-family: 'Courier New', monospace; }
            table { border-collapse: collapse; }
            td { vertical-align: top; }
        </style>
    </head>
    <body>
        <div class="center bold">COMANDA #${normStr(numeroComanda)}</div>
        <div class="line"></div>
        <div class="small">
            <div>Cuenta: ${normStr(cuenta)}</div>
            <div>Mesa: ${normStr(mesa)}</div>
            <div>Mesero: ${normStr(mesero)}</div>
        </div>
        <div class="line"></div>
        <table width="100%" class="small">
            <tr class="bold">
                <td style="width:80px;">CANTIDAD</td>
                <td>PRODUCTO</td>
            </tr>
            ${productosHtml}
        </table>
        ${comentariosBlock}
        <div class="line"></div>
        <div class="center small">
            Cantidad de Impresiones: # ${normStr(numeroImpresion ?? "1")}<br>
            ${normStr(fechaImpresion ?? new Date().toLocaleString("es-ES"))}
        </div>
    </body>
    </html>
    `;

    await page.setContent(fullHtml, { waitUntil: "domcontentloaded" });

    await page.pdf({
      path: pdfPath,
      printBackground: true,
      width: "3.15in",   // 80 mm
      height: "11.69in", // 297 mm
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    await browser.close();

    await printer.print(pdfPath, printerName ? { printer: printerName } : {});
    fs.unlinkSync(pdfPath);

    res.json({ success: true, message: "Ticket enviado a imprimir correctamente" });
  } catch (err) {
    console.error("Error al imprimir:", err);
    res.status(500).json({ error: "Error al imprimir", details: err.message });
  }
});

app.post("/print-factura", async (req, res) => {
  const {
    printerName = 'EPSON TM-T20III Receipt',
    nombreNegocio,
    direccion,
    productos,
    subtotal,
    ivaPercent,
    ivaValor,
    descuentoPercent,
    descuentoValor,
    total,
    formaPago,
    propina,
    totaltotal,
    tipPercent,
    // nuevas claves:
    empleadoNombre,
    fechaImpresion,
    numeroCuenta,
    // 🆕 opcional
    copies,
  } = req.body;

  if (!productos || !Array.isArray(productos)) {
    return res.status(400).json({ error: "Falta parámetro 'productos' como array" });
  }

  // ===== Helpers =====
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  const normStr = (s) => esc((s ?? "").toString().trim());

  const normalizeCopies = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.min(20, Math.floor(n)); // cap de seguridad
  };

  const copiesUsed = normalizeCopies(copies);
  const pdfPath = "./factura.pdf";

  try {
    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    const productosHtml = productos
      .map((p) => {
        const desc = normStr(p?.descripcion ?? "");
        const unit = normStr(p?.unit ?? "");
        const qty  = normStr(p?.qty  ?? "");
        const parts = [desc];
        if (unit) parts.push("&nbsp;&nbsp;" + unit);
        if (qty)  parts.push("&nbsp;&nbsp;x" + qty);
        const leftText = parts.join("");
        return `
          <div class="flex-row small">
            <span>${leftText}</span>
            <span>${normStr(p?.precio || "")}</span>
          </div>
        `;
      })
      .join("");

    // Mostrar bloque de propina sólo si hay propina y total con propina
    const showPropina = !!propina && !!totaltotal && propina != 0.0;

    // tipPercent como número válido (10 o "10")
    const tipPercentNum = tipPercent === 0 ? 0 : Number(tipPercent);
    const hasValidTipPercent = Number.isFinite(tipPercentNum) && tipPercentNum > 0;
    const tipLabel = hasValidTipPercent ? `Propina (${Math.round(tipPercentNum)}%)` : "Propina";

    const showDescuento = !!descuentoValor;
    const descuentoPercentNum = descuentoPercent === 0 ? 0 : Number(descuentoPercent);
    const hasValidDescuentoPercent = Number.isFinite(descuentoPercentNum) && descuentoPercentNum > 0;
    const descuentoLabel = hasValidDescuentoPercent ? `Descuento (${Math.round(descuentoPercentNum)}%)` : "Descuento";

    const totalSinPropinaLabel = "TOTAL";

    const headerOperativoHtml = `
      <div class="small">
        <div>Mesero: ${normStr(empleadoNombre)}</div>
        <div>Numero de orden: ${normStr(numeroCuenta)}</div>
      </div>
    `;

    const footerFechaHtml = `
      <div class="line"></div>
      <div class="center small">${normStr(fechaImpresion || new Date().toLocaleString("es-CL"))}</div>
    `;

    // ===== IVA visible solo si > 0 =====
    const showIvaBlock = Number.isFinite(Number(ivaPercent)) && Number(ivaPercent) > 0;

    const ivaSectionHtml = showIvaBlock
      ? `
        <div class="flex-row small">
          <span>Sub Total</span>
          <span>${normStr(subtotal) || "$0.00"}</span>
        </div>
        <div class="flex-row small">
          <span>IVA ${Number.isFinite(Number(ivaPercent)) ? Number(ivaPercent) : "19"}%</span>
          <span>${normStr(ivaValor) || "$0.00"}</span>
        </div>
      `
      : "";

    const finalTotalLabel =
      showPropina
        ? (showIvaBlock ? "TOTAL (IVA + propina)" : "TOTAL (propina)")
        : (showIvaBlock ? "TOTAL (IVA)" : "TOTAL");

    // === HTML de UNA PÁGINA (una copia) ===
    const onePageInner = () => `
      <div class="center bold">${normStr(nombreNegocio) || ""}</div>
      <div class="center small">${normStr(direccion) || ""}<br/></div>

      <div class="line"></div>

      ${headerOperativoHtml}

      <div class="line"></div>

      <div class="flex-row small bold">
        <span>PRODUCTO</span>
        <span>PRECIO</span>
      </div>
      ${productosHtml}

      <div class="total-section">
        ${ivaSectionHtml}

        <!-- Total (IVA incluido) -->
        <div class="flex-row small bold">
          <span>${totalSinPropinaLabel}</span>
          <span>${total || "$0.00"}</span>
        </div>

        ${showDescuento || showPropina ? `<div class="line"></div>` : ""}

        ${
          showDescuento
            ? `
        <div class="flex-row small">
          <span>${normStr(descuentoLabel)}</span>
          <span>-${normStr(descuentoValor)}</span>
        </div>` : ""}

        ${
          showPropina
            ? `
          <div class="flex-row small">
            <span>${normStr(tipLabel)}</span>
            <span>${normStr(propina)}</span>
          </div>

          <div class="line"></div>

          <div class="flex-row final-total">
            <span>${normStr(finalTotalLabel)}</span>
            <span>${normStr(totaltotal)}</span>
          </div>
        ` : "" }
      </div>

      <div class="line"></div>

      <div class="center small">Forma Pago: ${normStr(formaPago) || "Efectivo"}</div>

      ${footerFechaHtml}
    `;

    // === Un SOLO documento con N páginas (una por copia) ===
    const pagesHtml = Array.from({ length: copiesUsed }, () => `<section class="page">${onePageInner()}</section>`).join("");

    const fullHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>Factura</title>
        <style>
          @page { margin: 0; } /* asegura 0 en TODAS las páginas */

          .center { text-align: center; }
          .bold { font-weight: bold; }
          .small { font-size: 10px; }
          .line { border-bottom: 1px dashed #999; margin: 10px 0; }
          .flex-row { display: flex; justify-content: space-between; margin: 2px 0; }
          .total-section { margin-top: 15px; padding-top: 10px; border-top: 1px solid #999; }
          .final-total { font-size: 14px; font-weight: bold; border-top: 2px solid #333; padding-top: 5px; margin-top: 5px; }

          /* 🔧 Importante: sin padding en body; el padding por página va en .page */
          body { margin: 0; padding: 0; font-family: 'Courier New', monospace; }

          /* Multi-página: cada sección es una copia con su propio padding */
          .page { 
            box-sizing: border-box;
            padding: 10px;              /* 👈 padding uniforme en CADA página */
            page-break-after: always; 
          }
          .page:last-child { page-break-after: auto; }
        </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
    `;

    await page.setContent(fullHtml, { waitUntil: "domcontentloaded" });

    await page.pdf({
      path: pdfPath,
      printBackground: true,
      width: "3.15in",
      height: "11.69in",
      margin: { top: 0, bottom: 0, left: 0, right: 0 }, // márgenes 0; padding se maneja en .page
    });

    await browser.close();

    // Imprimir con un SOLO job, sin pasar 'copies' al driver
    const options = printerName ? { printer: printerName } : {};
    await printer.print(pdfPath, options);
    fs.unlinkSync(pdfPath);

    res.json({
      success: true,
      message: "Factura enviada a imprimir correctamente",
      copiesUsed,
      multipage: true,
    });
  } catch (err) {
    console.error("Error al imprimir factura:", err);
    try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch {}
    res.status(500).json({ error: "Error al imprimir factura", details: err.message });
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


    const fullHtml = `Ejemoplo`;
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
const PORT  = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📄 API Comanda: http://localhost:${PORT}/print-comanda`);
  console.log(`🧾 API Factura: http://localhost:${PORT}/print-factura`);
  console.log(`🖨️  API Impresoras: http://localhost:${PORT}/printers`);
  console.log(`✅ CORS habilitado para desarrollo`);
});
