const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Configuración basada en el patrón TSC exitoso, adaptado para EPSON USB
const EPSON_CONFIG = {
  // Configuración para impresora USB instalada
  NOMBRE_IMPRESORA: 'EPSON TM-T20III Receipt', // Nombre de la impresora instalada
  
  // Configuración de la tienda
  SHOPID: "TU EMPRESA",
  ADDRESS: "Dirección de tu negocio", 
  TEL: "Tel: 123-456-7890",
  
  // Rutas de archivos temporales
  TEMP_PATH: './temp_impresion/',
  
  // Configuración de papel
  PAPER_WIDTH: 80, // 80mm = ~48 caracteres
};

class EpsonUSBPrintService {
  constructor() {
    this.seqNo = 1;
    this.isProcessing = false;
    
    // Crear directorio temporal si no existe (como en el ejemplo TSC)
    if (!fs.existsSync(EPSON_CONFIG.TEMP_PATH)) {
      fs.mkdirSync(EPSON_CONFIG.TEMP_PATH, { recursive: true });
    }
  }

  // Función de sleep como en el ejemplo TSC
  sleep(waitTimeInMs) {
    return new Promise(resolve => setTimeout(resolve, waitTimeInMs));
  }

  // Verificar si hay proceso de impresión en curso (como en el ejemplo TSC)
  checkProcessingLock() {
    const lockFile = path.join(EPSON_CONFIG.TEMP_PATH, 'temp_impresion');
    return fs.existsSync(lockFile);
  }

  // Crear lock de procesamiento (como en el ejemplo TSC)
  createProcessingLock() {
    const lockFile = path.join(EPSON_CONFIG.TEMP_PATH, 'temp_impresion');
    const now = new Date();
    fs.writeFileSync(lockFile, now.toString());
  }

  // Remover lock de procesamiento (como en el ejemplo TSC)
  removeProcessingLock() {
    const lockFile = path.join(EPSON_CONFIG.TEMP_PATH, 'temp_impresion');
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  }

  // Buscar impresora EPSON instalada
  async findEpsonPrinter() {
    try {
      const { stdout } = await execPromise('wmic printer get name,status,portname /format:csv');
      const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('Node,Name'));
      
      for (const line of lines) {
        const fields = line.split(',');
        if (fields.length >= 2) {
          const name = fields[1]?.trim();
          const port = fields[2]?.trim();
          const status = fields[3]?.trim();
          
          if (name && (
            name.toLowerCase().includes('epson') ||
            name.toLowerCase().includes('tm-t20') ||
            name.toLowerCase().includes('receipt')
          )) {
            console.log(`Impresora EPSON encontrada: ${name}`);
            return { name, port, status, found: true };
          }
        }
      }
      
      return { found: false };
    } catch (error) {
      console.error('Error buscando impresora EPSON:', error);
      return { found: false, error: error.message };
    }
  }

  // Generar contenido del ticket (similar al ejemplo TSC pero para recibos)
  generarContenidoTicket(orderData) {
    const width = EPSON_CONFIG.PAPER_WIDTH;
    let contenido = '';
    
    // Header centrado
    contenido += this.centerText(EPSON_CONFIG.SHOPID) + '\n';
    contenido += this.centerText(EPSON_CONFIG.ADDRESS) + '\n';
    contenido += this.centerText(EPSON_CONFIG.TEL) + '\n\n';
    
    // Título del documento
    const titulo = orderData.type === 'comanda' ? 'COMANDA' : 'CUENTA';
    contenido += this.centerText('='.repeat(titulo.length + 4)) + '\n';
    contenido += this.centerText(`  ${titulo}  `) + '\n';
    contenido += this.centerText('='.repeat(titulo.length + 4)) + '\n\n';
    
    // Información del pedido
    if (orderData.comanda) {
      contenido += `Comanda: ${orderData.comanda}\n`;
    }
    if (orderData.ordenDeCompra) {
      contenido += `Orden: ${orderData.ordenDeCompra}\n`;
    }
    
    // Fecha y hora
    contenido += `Fecha: ${this.getTimestamp()}\n\n`;
    
    // Productos
    contenido += 'PRODUCTOS:\n';
    contenido += '-'.repeat(width) + '\n';
    
    if (orderData.productos && Array.isArray(orderData.productos)) {
      orderData.productos.forEach((item, index) => {
        contenido += `${index + 1}. ${item.producto}\n`;
        
        let quantityLine = `   Cant: ${item.cantidad || 1}`;
        if (item.precioUnitario) {
          quantityLine += ` x $${item.precioUnitario.toFixed(2)}`;
        }
        contenido += quantityLine + '\n';
        
        if (item.total) {
          contenido += `   Total: $${item.total.toFixed(2)}\n`;
        }
        contenido += '\n';
      });
    }
    
    contenido += '-'.repeat(width) + '\n';
    
    // Totales (solo para cuentas)
    if (orderData.type === 'cuenta' && orderData.totalAPagar) {
      if (orderData.subtotal) {
        contenido += this.rightAlign(`SUBTOTAL: $${orderData.subtotal.toFixed(2)}`) + '\n';
      }
      
      if (orderData.descuento && orderData.descuento.cantidad > 0) {
        contenido += this.rightAlign(`DESC.(${orderData.descuento.porcentaje}%): -$${orderData.descuento.cantidad.toFixed(2)}`) + '\n';
      }
      
      if (orderData.iva && orderData.iva.cantidad > 0) {
        contenido += this.rightAlign(`IVA(${orderData.iva.porcentaje}%): +$${orderData.iva.cantidad.toFixed(2)}`) + '\n';
      }
      
      contenido += '='.repeat(width) + '\n';
      contenido += this.rightAlign(`TOTAL: $${orderData.totalAPagar.toFixed(2)}`) + '\n';
      contenido += '='.repeat(width) + '\n\n';
    }
    
    // Footer
    const gracias = orderData.type === 'comanda' ? '¡Gracias!' : '¡Gracias por su compra!';
    contenido += this.centerText(gracias) + '\n';
    
    // Número de ticket
    const ticketNo = ('0000' + this.seqNo).slice(-4);
    contenido += this.centerText(`Ticket: ${ticketNo}`) + '\n\n\n\n';
    
    return contenido;
  }

  // Funciones de formato de texto
  centerText(text) {
    const width = EPSON_CONFIG.PAPER_WIDTH;
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  rightAlign(text) {
    const width = EPSON_CONFIG.PAPER_WIDTH;
    const padding = Math.max(0, width - text.length);
    return ' '.repeat(padding) + text;
  }

  // Generar timestamp (como en el ejemplo TSC)
  getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    
    return `${year}/${month}/${day} ${hour}:${minute}`;
  }

  // Función principal de impresión (basada en el patrón del ejemplo TSC)
  async imprimir(orderData) {
    console.log("PETICION EPSON USB v2024");
    
    // Verificar si hay proceso en curso (como en el ejemplo TSC)
    if (this.checkProcessingLock()) {
      return {
        success: false,
        message: "Hay proceso de impresión en curso",
        color: "#ef5350",
        orderData: orderData
      };
    }

    let mensajeimpresora = "";
    let color = "";

    try {
      // Crear lock de procesamiento (como en el ejemplo TSC)
      this.createProcessingLock();
      console.log("Lock de impresión creado");

      await this.sleep(1000);

      console.log("Datos de orden:", orderData);
      
      // Generar nombre de archivo temporal (similar al ejemplo TSC)
      const timestamp = Date.now();
      const nombreArchivo = `ticket_${timestamp}.txt`;
      const rutaCompleta = path.join(EPSON_CONFIG.TEMP_PATH, nombreArchivo);
      
      // Generar contenido del ticket
      const contenido = this.generarContenidoTicket(orderData);
      
      await this.sleep(2000);
      
      // Escribir archivo temporal (como en el ejemplo TSC)
      fs.writeFileSync(rutaCompleta, contenido, 'utf8');
      
      await this.sleep(1000);
      
      console.log(`Archivo generado: ${rutaCompleta}`);
      
      // Buscar impresora EPSON instalada
      const printer = await this.findEpsonPrinter();
      
      if (!printer.found) {
        throw new Error('No se encontró impresora EPSON instalada');
      }
      
      console.log(`Imprimiendo en: ${printer.name}`);
      
      // Intentar impresión con diferentes métodos (como múltiples intentos en TSC)
      let impresionExitosa = false;
      
      // Método 1: Comando print de Windows
      try {
        const comando1 = `print /D:"${printer.name}" "${rutaCompleta}"`;
        console.log(`Ejecutando: ${comando1}`);
        await execPromise(comando1);
        console.log("Método 1 exitoso");
        impresionExitosa = true;
      } catch (error) {
        console.log("Método 1 falló:", error.message);
      }
      
      // Método 2: Copy directo (si el método 1 falla)
      if (!impresionExitosa) {
        try {
          const comando2 = `copy "${rutaCompleta}" "${printer.name}"`;
          console.log(`Ejecutando: ${comando2}`);
          await execPromise(comando2);
          console.log("Método 2 exitoso");
          impresionExitosa = true;
        } catch (error) {
          console.log("Método 2 falló:", error.message);
        }
      }
      
      // Método 3: Type + redirection (último recurso)
      if (!impresionExitosa) {
        try {
          const comando3 = `type "${rutaCompleta}" > "${printer.name}"`;
          console.log(`Ejecutando: ${comando3}`);
          await execPromise(comando3);
          console.log("Método 3 exitoso");
          impresionExitosa = true;
        } catch (error) {
          console.log("Método 3 falló:", error.message);
        }
      }
      
      if (impresionExitosa) {
        mensajeimpresora = "Se imprimió correctamente";
        color = "#06d79c";
        
        // Incrementar número de secuencia (como en el ejemplo TSC)
        this.seqNo += 1;
        if (this.seqNo > 9999) {
          this.seqNo = 1;
        }
      } else {
        throw new Error('Todos los métodos de impresión fallaron');
      }
      
      console.log("Impresión completada");
      
      // Limpiar archivo temporal después de un tiempo
      setTimeout(() => {
        try {
          if (fs.existsSync(rutaCompleta)) {
            fs.unlinkSync(rutaCompleta);
          }
        } catch (e) {
          console.warn('No se pudo eliminar archivo temporal:', e.message);
        }
      }, 5000);
      
    } catch (error) {
      console.error("Error en impresión:", error);
      mensajeimpresora = error.message;
      color = "#ef5350";
    } finally {
      // Remover lock (como en el ejemplo TSC)
      this.removeProcessingLock();
      console.log("Lock de impresión removido");
    }

    return {
      success: color === "#06d79c",
      message: mensajeimpresora,
      color: color,
      orderData: orderData,
      seqNo: this.seqNo - 1
    };
  }
}

// Instancia global del servicio
const printService = new EpsonUSBPrintService();

// Endpoints del servidor

// Endpoint para imprimir comanda
app.post('/imprimir-comanda', async (req, res) => {
  try {
    const datosComanda = req.body;
    const { comanda, ordenDeCompra, productos } = datosComanda;

    // Validar datos requeridos
    if (!comanda || !ordenDeCompra || !productos || !Array.isArray(productos)) {
      return res.status(400).json({ 
        error: 'Datos incompletos. Se requiere comanda, ordenDeCompra y productos' 
      });
    }

    console.log(`\n=== IMPRIMIENDO COMANDA EPSON USB ===`);
    console.log(`Comanda: ${comanda}, Orden: ${ordenDeCompra}`);

    // Preparar datos para impresión
    const orderData = {
      ...datosComanda,
      type: 'comanda'
    };

    // Imprimir usando el servicio
    const result = await printService.imprimir(orderData);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        metodo: 'USB Windows Print',
        modelo: 'EPSON TM-T20III',
        comanda: comanda,
        orden: ordenDeCompra,
        seqNo: result.seqNo,
        color: result.color,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message,
        color: result.color,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error en endpoint de comanda:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para imprimir cuenta
app.post('/imprimir-cuenta', async (req, res) => {
  try {
    const datosCuenta = req.body;
    const { ordenDeCompra, productos, totalAPagar } = datosCuenta;

    // Validar datos requeridos
    if (!ordenDeCompra || !productos || !Array.isArray(productos) || !totalAPagar) {
      return res.status(400).json({ 
        error: 'Datos incompletos. Se requiere ordenDeCompra, productos y totalAPagar' 
      });
    }

    console.log(`\n=== IMPRIMIENDO CUENTA EPSON USB ===`);
    console.log(`Orden: ${ordenDeCompra}, Total: $${totalAPagar}`);

    // Preparar datos para impresión
    const orderData = {
      ...datosCuenta,
      type: 'cuenta'
    };

    // Imprimir usando el servicio
    const result = await printService.imprimir(orderData);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        metodo: 'USB Windows Print',
        modelo: 'EPSON TM-T20III',
        orden: ordenDeCompra,
        total: totalAPagar,
        seqNo: result.seqNo,
        color: result.color,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message,
        color: result.color,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Error en endpoint de cuenta:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para detectar impresora
app.get('/detectar-impresora', async (req, res) => {
  try {
    const printer = await printService.findEpsonPrinter();
    
    res.json({
      success: printer.found,
      message: printer.found ? 'Impresora EPSON encontrada' : 'Impresora EPSON no encontrada',
      printer: printer,
      configuracion: EPSON_CONFIG,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Error detectando impresora',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de prueba
app.get('/test-printer', async (req, res) => {
  try {
    console.log(`=== PRUEBA DE IMPRESORA EPSON USB ===`);

    const testData = {
      type: 'comanda',
      comanda: 'TEST-001',
      ordenDeCompra: 'PRUEBA-' + Date.now(),
      productos: [
        {
          producto: 'Test de Impresión USB',
          cantidad: 1
        }
      ]
    };

    const result = await printService.imprimir(testData);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        metodo: 'USB Windows Print',
        modelo: 'EPSON TM-T20III',
        seqNo: result.seqNo,
        color: result.color,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message,
        color: result.color,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Error en prueba:', error);
    res.status(500).json({ 
      error: 'Error en prueba de impresora', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    servicio: 'Servidor EPSON TM-T20III USB',
    version: '5.0.0',
    metodo: 'Windows Print System',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n=== SERVIDOR EPSON TM-T20III USB ===`);
  console.log(`Puerto: ${PORT}`);
  console.log(`Modelo: EPSON TM-T20III`);
  console.log(`Conexión: USB (Sistema Windows)`);
  console.log(`Patrón: Basado en TSC exitoso`);
  console.log('\nEndpoints:');
  console.log(`  POST http://localhost:${PORT}/imprimir-comanda`);
  console.log(`  POST http://localhost:${PORT}/imprimir-cuenta`);
  console.log(`  GET  http://localhost:${PORT}/detectar-impresora`);
  console.log(`  POST http://localhost:${PORT}/test-printer`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log('\nServidor listo para impresión USB');
});

module.exports = app;