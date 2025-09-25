const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware para JSON
app.use(express.json());

// Configuración específica para EPSON TM-T20III USB
const EPSON_CONFIG = {
  vendorId: '0x04b8',  // Epson
  productId: '0x0202', // TM-T20III
  deviceName: 'EPSON TM-T20III',
  usbPath: '\\\\.\\USBPRINT001', // Path típico para impresoras USB
  paperWidth: {
    PAPER_58MM: 58,
    PAPER_80MM: 80
  },
  // Configuración de la tienda
  SHOPID: "TU EMPRESA",
  ADDRESS: "Dirección de tu negocio",
  TEL: "Tel: 123-456-7890"
};

// Comandos ESC/POS para TM-T20III
const ESC_POS_COMMANDS = {
  INIT: [0x1B, 0x40],                    // Inicializar impresora
  ALIGN_LEFT: [0x1B, 0x61, 0x00],       // Alinear izquierda
  ALIGN_CENTER: [0x1B, 0x61, 0x01],     // Alinear centro
  ALIGN_RIGHT: [0x1B, 0x61, 0x02],      // Alinear derecha
  BOLD_ON: [0x1B, 0x45, 0x01],          // Negrita ON
  BOLD_OFF: [0x1B, 0x45, 0x00],         // Negrita OFF
  DOUBLE_ON: [0x1D, 0x21, 0x11],        // Doble tamaño
  DOUBLE_OFF: [0x1D, 0x21, 0x00],       // Tamaño normal
  FEED_LINE: [0x0A],                     // Salto de línea
  CUT_PAPER: [0x1D, 0x56, 0x00],        // Cortar papel
  OPEN_DRAWER: [0x1B, 0x70, 0x00, 0x19, 0xFA] // Abrir cajón
};

//**********************************************************
//* Clase para manejo directo de USB con EPSON TM-T20III
//**********************************************************
class EpsonUSBManager {
  constructor() {
    this.seqNo = 1;
    this.paperWidth = EPSON_CONFIG.paperWidth.PAPER_80MM;
    this.commandBuffer = [];
  }

  // Detectar impresora EPSON TM-T20III por USB
  async detectUSBPrinter() {
    try {
      console.log('🔍 Detectando impresora EPSON TM-T20III por USB...');
      
      // Método 1: Buscar por dispositivos USB
      try {
        const { stdout: usbDevices } = await execPromise('wmic path Win32_USBControllerDevice get dependent /format:csv');
        const usbLines = usbDevices.split('\n').filter(line => line.includes('USB'));
        
        for (const line of usbLines) {
          if (line.toLowerCase().includes('04b8') || line.toLowerCase().includes('epson')) {
            console.log('✅ Dispositivo EPSON encontrado en USB');
            return { found: true, method: 'USB_DEVICE', path: line.trim() };
          }
        }
      } catch (error) {
        console.log('⚠️ Búsqueda por dispositivos USB falló');
      }

      // Método 2: Buscar por puertos USB
      try {
        const { stdout: usbPorts } = await execPromise('wmic path Win32_SerialPort get deviceid,name /format:csv');
        const portLines = usbPorts.split('\n').filter(line => line.trim());
        
        for (const line of portLines) {
          if (line.toLowerCase().includes('usb') && line.toLowerCase().includes('com')) {
            const comPort = line.match(/COM\d+/);
            if (comPort) {
              console.log(`✅ Puerto USB encontrado: ${comPort[0]}`);
              return { found: true, method: 'USB_SERIAL', port: comPort[0] };
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Búsqueda por puertos serie falló');
      }

      // Método 3: Buscar impresoras con puerto USB
      try {
        const { stdout: printers } = await execPromise('wmic printer get name,portname /format:csv');
        const printerLines = printers.split('\n').filter(line => line.trim() && !line.includes('Node,Name'));
        
        for (const line of printerLines) {
          const fields = line.split(',');
          if (fields.length >= 2) {
            const name = fields[1]?.trim();
            const port = fields[2]?.trim();
            
            if (name && port && (port.includes('USB') || name.toLowerCase().includes('epson'))) {
              console.log(`✅ Impresora USB encontrada: ${name} en ${port}`);
              return { found: true, method: 'USB_PRINTER', name, port };
            }
          }
        }
      } catch (error) {
        console.log('⚠️ Búsqueda por impresoras USB falló');
      }

      return { found: false, method: 'NONE' };
    } catch (error) {
      console.error('❌ Error detectando impresora USB:', error);
      return { found: false, method: 'ERROR', error: error.message };
    }
  }

  // Crear contenido ESC/POS binario
  createESCPOSContent(orderData) {
    const buffer = [];
    
    // Inicializar impresora
    buffer.push(...ESC_POS_COMMANDS.INIT);
    
    // Abrir cajón (si es una venta)
    if (orderData.type === 'cuenta') {
      buffer.push(...ESC_POS_COMMANDS.OPEN_DRAWER);
    }
    
    // Header centrado
    buffer.push(...ESC_POS_COMMANDS.ALIGN_CENTER);
    buffer.push(...ESC_POS_COMMANDS.DOUBLE_ON);
    
    // Nombre de la empresa
    const shopName = EPSON_CONFIG.SHOPID;
    buffer.push(...this.textToBytes(shopName));
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    
    buffer.push(...ESC_POS_COMMANDS.DOUBLE_OFF);
    
    // Información de la empresa
    buffer.push(...this.textToBytes(EPSON_CONFIG.ADDRESS));
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    buffer.push(...this.textToBytes(EPSON_CONFIG.TEL));
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    
    // Título del documento
    buffer.push(...ESC_POS_COMMANDS.BOLD_ON);
    const title = orderData.type === 'comanda' ? 'COMANDA' : 'CUENTA';
    buffer.push(...this.textToBytes(title));
    buffer.push(...ESC_POS_COMMANDS.BOLD_OFF);
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    
    buffer.push(...this.textToBytes('========================'));
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    
    // Información del pedido
    buffer.push(...ESC_POS_COMMANDS.ALIGN_LEFT);
    
    if (orderData.comanda) {
      buffer.push(...this.textToBytes(`Comanda: ${orderData.comanda}`));
      buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    }
    
    if (orderData.ordenDeCompra) {
      buffer.push(...this.textToBytes(`Orden: ${orderData.ordenDeCompra}`));
      buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    }
    
    // Timestamp
    buffer.push(...this.textToBytes(`${this.getTimestamp()}`));
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    
    // Productos
    buffer.push(...this.textToBytes('PRODUCTOS:'));
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    buffer.push(...this.textToBytes('------------------------'));
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    
    if (orderData.productos && Array.isArray(orderData.productos)) {
      orderData.productos.forEach((item, index) => {
        buffer.push(...this.textToBytes(`${index + 1}. ${item.producto}`));
        buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
        
        let quantityLine = `   Cant: ${item.cantidad || 1}`;
        if (item.precioUnitario) {
          quantityLine += ` x $${item.precioUnitario.toFixed(2)}`;
        }
        buffer.push(...this.textToBytes(quantityLine));
        buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
        
        if (item.total) {
          buffer.push(...this.textToBytes(`   Total: $${item.total.toFixed(2)}`));
          buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
        }
        
        buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
      });
    }
    
    buffer.push(...this.textToBytes('------------------------'));
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    
    // Totales (solo para cuentas)
    if (orderData.type === 'cuenta' && orderData.totalAPagar) {
      if (orderData.subtotal) {
        buffer.push(...this.textToBytes(`SUBTOTAL:    $${orderData.subtotal.toFixed(2)}`));
        buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
      }
      
      if (orderData.descuento && orderData.descuento.cantidad > 0) {
        buffer.push(...this.textToBytes(`DESC.(${orderData.descuento.porcentaje}%): -$${orderData.descuento.cantidad.toFixed(2)}`));
        buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
      }
      
      if (orderData.iva && orderData.iva.cantidad > 0) {
        buffer.push(...this.textToBytes(`IVA(${orderData.iva.porcentaje}%):     +$${orderData.iva.cantidad.toFixed(2)}`));
        buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
      }
      
      buffer.push(...this.textToBytes('========================'));
      buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
      
      buffer.push(...ESC_POS_COMMANDS.BOLD_ON);
      buffer.push(...this.textToBytes(`TOTAL:       $${orderData.totalAPagar.toFixed(2)}`));
      buffer.push(...ESC_POS_COMMANDS.BOLD_OFF);
      buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
      
      buffer.push(...this.textToBytes('========================'));
      buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
      buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    }
    
    // Footer
    buffer.push(...ESC_POS_COMMANDS.ALIGN_CENTER);
    const thankYou = orderData.type === 'comanda' ? '¡Gracias!' : '¡Gracias por su compra!';
    buffer.push(...this.textToBytes(thankYou));
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    
    // Número de ticket
    const strSeqNo = ('0000' + this.seqNo).slice(-4);
    buffer.push(...this.textToBytes(`Ticket: ${strSeqNo}`));
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    buffer.push(...ESC_POS_COMMANDS.FEED_LINE);
    
    // Cortar papel
    buffer.push(...ESC_POS_COMMANDS.CUT_PAPER);
    
    return new Uint8Array(buffer);
  }

  // Convertir texto a bytes
  textToBytes(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) {
      bytes.push(text.charCodeAt(i));
    }
    return bytes;
  }

  // Enviar datos binarios a la impresora
  async printBinaryData(data, printerInfo) {
    try {
      console.log(`🖨️ Enviando datos binarios (${data.length} bytes)...`);
      
      // Crear archivo temporal binario
      const tempFile = path.join(__dirname, `epson_binary_${Date.now()}.bin`);
      fs.writeFileSync(tempFile, data);
      
      let success = false;
      
      // Método 1: Copy a puerto USB directo
      if (printerInfo.port) {
        try {
          await execPromise(`copy /b "${tempFile}" "${printerInfo.port}"`);
          console.log('✅ Enviado por puerto USB directo');
          success = true;
        } catch (error) {
          console.log('⚠️ Envío por puerto USB falló:', error.message);
        }
      }
      
      // Método 2: Copy a dispositivo PRN
      if (!success) {
        try {
          await execPromise(`copy /b "${tempFile}" PRN`);
          console.log('✅ Enviado por dispositivo PRN');
          success = true;
        } catch (error) {
          console.log('⚠️ Envío por PRN falló:', error.message);
        }
      }
      
      // Método 3: Usar LPT1 (puerto paralelo/USB)
      if (!success) {
        try {
          await execPromise(`copy /b "${tempFile}" LPT1`);
          console.log('✅ Enviado por LPT1');
          success = true;
        } catch (error) {
          console.log('⚠️ Envío por LPT1 falló:', error.message);
        }
      }
      
      // Método 4: Usar impresora por nombre si existe
      if (!success && printerInfo.name) {
        try {
          // Crear archivo de comandos batch
          const batchFile = path.join(__dirname, `print_${Date.now()}.bat`);
          const batchContent = `@echo off\ncopy /b "${tempFile}" "${printerInfo.name}"`;
          fs.writeFileSync(batchFile, batchContent);
          
          await execPromise(`"${batchFile}"`);
          console.log('✅ Enviado por nombre de impresora');
          success = true;
          
          // Limpiar archivo batch
          setTimeout(() => {
            try {
              if (fs.existsSync(batchFile)) fs.unlinkSync(batchFile);
            } catch (e) {}
          }, 1000);
        } catch (error) {
          console.log('⚠️ Envío por nombre de impresora falló:', error.message);
        }
      }
      
      // Limpiar archivo temporal
      setTimeout(() => {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (e) {
          console.warn('No se pudo eliminar archivo temporal:', e.message);
        }
      }, 3000);
      
      if (!success) {
        throw new Error('Todos los métodos de envío binario fallaron');
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Error enviando datos binarios:', error);
      throw error;
    }
  }

  // Imprimir recibo
  async printReceipt(orderData) {
    try {
      console.log('🔍 Detectando impresora EPSON TM-T20III...');
      
      const printerInfo = await this.detectUSBPrinter();
      
      if (!printerInfo.found) {
        throw new Error('No se detectó impresora EPSON TM-T20III. Verifica que esté conectada y encendida.');
      }
      
      console.log(`✅ Impresora detectada: ${printerInfo.method}`);
      
      // Crear contenido ESC/POS binario
      const binaryData = this.createESCPOSContent(orderData);
      
      // Enviar a la impresora
      await this.printBinaryData(binaryData, printerInfo);
      
      // Incrementar número de secuencia
      this.seqNo += 1;
      if (this.seqNo > 9999) {
        this.seqNo = 1;
      }
      
      return {
        success: true,
        method: printerInfo.method,
        seqNo: this.seqNo - 1,
        dataSize: binaryData.length
      };
      
    } catch (error) {
      console.error('❌ Error en impresión:', error);
      throw error;
    }
  }

  // Generar timestamp
  getTimestamp() {
    const now = new Date();
    
    let year = now.getFullYear();
    let month = (now.getMonth() + 1).toString().padStart(2, '0');
    let day = now.getDate().toString().padStart(2, '0');
    let hour = now.getHours().toString().padStart(2, '0');
    let minute = now.getMinutes().toString().padStart(2, '0');
    
    return `${year}/${month}/${day} ${hour}:${minute}`;
  }
}

// Instancia global del manager
const usbManager = new EpsonUSBManager();

//**********************************************************
//* Endpoints del servidor
//**********************************************************

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

    console.log(`\n🖨️ === IMPRIMIENDO COMANDA EPSON USB ===`);
    console.log(`📝 Comanda: ${comanda}, Orden: ${ordenDeCompra}`);

    // Preparar datos para impresión
    const orderData = {
      ...datosComanda,
      type: 'comanda'
    };

    // Imprimir usando USB directo
    const result = await usbManager.printReceipt(orderData);

    const respuesta = {
      success: true,
      message: 'Comanda impresa correctamente en EPSON TM-T20III (USB)',
      metodo: result.method,
      modelo: 'TM-T20III',
      conexion: 'USB Directo',
      comanda: comanda,
      orden: ordenDeCompra,
      seqNo: result.seqNo,
      dataSize: result.dataSize,
      timestamp: new Date().toISOString()
    };

    console.log('✅ === COMANDA IMPRESA EXITOSAMENTE ===\n');
    res.json(respuesta);

  } catch (error) {
    console.error('❌ Error en impresión de comanda:', error);
    
    res.status(500).json({ 
      error: 'Error al imprimir comanda', 
      details: error.message,
      sugerencias: [
        'Verificar que la EPSON TM-T20III esté encendida y conectada por USB',
        'Instalar drivers oficiales de Epson desde epson.com',
        'Verificar que Windows reconozca el dispositivo USB',
        'Ejecutar el servidor como administrador',
        'Revisar que no haya otras aplicaciones usando la impresora'
      ],
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

    console.log(`\n🧾 === IMPRIMIENDO CUENTA EPSON USB ===`);
    console.log(`📝 Orden: ${ordenDeCompra}, Total: $${totalAPagar}`);

    // Preparar datos para impresión
    const orderData = {
      ...datosCuenta,
      type: 'cuenta'
    };

    // Imprimir usando USB directo
    const result = await usbManager.printReceipt(orderData);

    const respuesta = {
      success: true,
      message: 'Cuenta impresa correctamente en EPSON TM-T20III (USB)',
      metodo: result.method,
      modelo: 'TM-T20III',
      conexion: 'USB Directo',
      orden: ordenDeCompra,
      total: totalAPagar,
      seqNo: result.seqNo,
      dataSize: result.dataSize,
      timestamp: new Date().toISOString()
    };

    console.log('✅ === CUENTA IMPRESA EXITOSAMENTE ===\n');
    res.json(respuesta);

  } catch (error) {
    console.error('❌ Error en impresión de cuenta:', error);
    
    res.status(500).json({ 
      error: 'Error al imprimir cuenta', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para detectar impresora
app.get('/detectar-impresora', async (req, res) => {
  try {
    console.log('🔍 Detectando impresora EPSON TM-T20III...');
    
    const printerInfo = await usbManager.detectUSBPrinter();
    
    res.json({
      success: printerInfo.found,
      message: printerInfo.found ? 'Impresora EPSON TM-T20III detectada' : 'Impresora no detectada',
      deteccion: printerInfo,
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
app.post('/test-printer', async (req, res) => {
  try {
    console.log(`🧪 === PRUEBA DE IMPRESORA EPSON USB ===`);

    // Datos de prueba
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

    const result = await usbManager.printReceipt(testData);
    
    const resultado = {
      success: true,
      message: 'Prueba de impresión USB exitosa en EPSON TM-T20III',
      metodo: result.method,
      modelo: 'TM-T20III',
      conexion: 'USB Directo',
      seqNo: result.seqNo,
      dataSize: result.dataSize,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ === PRUEBA USB EXITOSA ===\n');
    res.json(resultado);
    
  } catch (error) {
    console.error('❌ Prueba USB falló:', error.message);
    
    res.status(500).json({ 
      error: 'Prueba de impresora USB falló', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    servicio: 'Servidor EPSON TM-T20III USB Directo',
    version: '4.0.0',
    metodo: 'USB Binary ESC/POS',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 === SERVIDOR EPSON TM-T20III USB DIRECTO ===`);
  console.log(`📡 Puerto: ${PORT}`);
  console.log(`🖨️ Modelo: TM-T20III`);
  console.log(`🔌 Conexión: USB Directo (ESC/POS Binario)`);
  console.log(`🆔 Vendor ID: ${EPSON_CONFIG.vendorId}`);
  console.log(`🆔 Product ID: ${EPSON_CONFIG.productId}`);
  console.log('\n📋 Endpoints disponibles:');
  console.log(`  POST http://localhost:${PORT}/imprimir-comanda`);
  console.log(`  POST http://localhost:${PORT}/imprimir-cuenta`);
  console.log(`  GET  http://localhost:${PORT}/detectar-impresora`);
  console.log(`  POST http://localhost:${PORT}/test-printer`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log('\n⚠️  IMPORTANTE: Ejecutar como administrador para acceso USB');
  console.log('✅ Servidor listo para impresión USB directa\n');
});

module.exports = app;