const printer = require("printer");

const defaultPrinter = printer.getDefaultPrinterName();
// const printers = printer.getPrinters();
console.log(printers); // <- Útil si no conoces el nombre exacto

// Texto a imprimir
const texto = "Hola\n";

// Enviar a la impresora
printer.printDirect({
  data: texto,
  printer: defaultPrinter, // o reemplaza con el nombre exacto: "EPSON TM-T20III"
  type: "RAW",
  success: function (jobID) {
    console.log("Impresión enviada con ID: " + jobID);
  },
  error: function (err) {
    console.error("Error al imprimir: " + err);
  },
});
