const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware para JSON
app.use(express.json());

// Configuración específica para EPSON TM-T20III con ePOS-Device
const EPSON_CONFIG = {
  deviceId: 'local_printer', // ID del dispositivo local
  deviceType: 'DEVICE_TYPE_PRINTER',
  crypto: false,
  buffer: false,
  paperWidth: {
    PAPER_58MM: 58,
    PAPER_80MM: 80
  },
  // Configuración de la tienda
  SHOPID: "TU EMPRESA",
  ADDRESS: "Dirección de tu negocio",
  TEL: "Tel: 123-456-7890"
};

//**********************************************************
//* Clase PrinterManager basada en la documentación oficial
//**********************************************************
class EpsonPrinterManager {
  constructor() {
    this.deviceObj = null;
    this.eposDevice = null;
    this.status = "";
    this.retry = 0;
    this.seqNo = 1;
    this.success = false;
    this.finish = false;
    this.paperWidth = EPSON_CONFIG.paperWidth.PAPER_80MM; // Por defecto 80mm
  }

  // Inicializar la impresora EPSON usando ePOS-Device
  async initialize() {
    return new Promise((resolve, reject) => {
      try {
        // Simular la inicialización del dispositivo ePOS-Device
        // En un entorno real, esto sería: eposDevice.createDevice()
        console.log('🔌 Inicializando dispositivo EPSON ePOS-Device...');
        
        this.deviceObj = {
          // Simular las constantes del dispositivo EPSON
          ALIGN_LEFT: 0,
          ALIGN_CENTER: 1,
          ALIGN_RIGHT: 2,
          CUT_FEED: 0,
          DRAWER_1: 0,
          PULSE_100: 100,
          
          // Métodos simulados del dispositivo
          addText: (text) => this.commandBuffer.push({type: 'text', data: text}),
          addTextAlign: (align) => this.commandBuffer.push({type: 'align', data: align}),
          addTextDouble: (enable) => this.commandBuffer.push({type: 'double', data: enable}),
          addFeedLine: (lines) => this.commandBuffer.push({type: 'feed', data: lines}),
          addCut: (type) => this.commandBuffer.push({type: 'cut', data: type}),
          addPulse: (drawer, pulse) => this.commandBuffer.push({type: 'pulse', data: {drawer, pulse}}),
          send: () => this.executeCommands()
        };
        
        this.commandBuffer = [];
        this.success = true;
        this.status = "OK";
        
        console.log('✅ Dispositivo EPSON inicializado correctamente');
        resolve(true);
      } catch (error) {
        console.error('❌ Error inicializando dispositivo EPSON:', error);
        reject(error);
      }
    });
  }

  // Ejecutar comandos de impresión
  async executeCommands() {
    try {
      console.log('🖨️ Ejecutando comandos de impresión...');
      
      let contenido = '';
      let currentAlign = 'left';
      let isDouble = false;
      
      for (const command of this.commandBuffer) {
        switch (command.type) {
          case 'text':
            if (currentAlign === 'center') {
              contenido += this.centerText(command.data);
            } else if (currentAlign === 'right') {
              contenido += this.rightAlign(command.data);
            } else {
              contenido += command.data;
            }
            break;
            
          case 'align':
            if (command.data === 1) currentAlign = 'center';
            else if (command.data === 2) currentAlign = 'right';
            else currentAlign = 'left';
            break;
            
          case 'double':
            isDouble = command.data;
            break;
            
          case 'feed':
            for (let i = 0; i < command.data; i++) {
              contenido += '\n';
            }
            break;
            
          case 'cut':
            contenido += '\x1B\x69'; // Comando ESC/POS para corte
            break;
            
          case 'pulse':
            console.log('📤 Abriendo cajón...');
            break;
        }
      }
      
      // Enviar a impresión
      await this.printToSystem(contenido);
      
      this.commandBuffer = [];
      this.finish = true;
      
    } catch (error) {
      console.error('❌ Error ejecutando comandos:', error);
      throw error;
    }
  }

  // Centrar texto según el ancho del papel
  centerText(text) {
    const width = this.paperWidth === EPSON_CONFIG.paperWidth.PAPER_58MM ? 32 : 48;
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  // Alinear texto a la derecha
  rightAlign(text) {
    const width = this.paperWidth === EPSON_CONFIG.paperWidth.PAPER_58MM ? 32 : 48;
    const padding = Math.max(0, width - text.length);
    return ' '.repeat(padding) + text;
  }

  // Imprimir usando comando del sistema
  async printToSystem(contenido) {
    return new Promise((resolve, reject) => {
      const tempFile = path.join(__dirname, `epson_ticket_${Date.now()}.txt`);
      
      try {
        fs.writeFileSync(tempFile, contenido, 'utf8');
        
        // Buscar impresora EPSON y enviar
        this.findAndPrintToEpson(tempFile)
          .then(() => {
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
            resolve();
          })
          .catch(reject);
          
      } catch (error) {
        reject(error);
      }
    });
  }

  // Buscar y enviar a impresora EPSON
  async findAndPrintToEpson(tempFile) {
    try {
      // Buscar impresoras EPSON disponibles
      const { stdout } = await execPromise('wmic printer get name,portname /format:csv');
      const lineas = stdout.split('\n').filter(linea => linea.trim());
      
      let impresoraEpson = null;
      
      for (const linea of lineas) {
        const campos = linea.split(',');
        if (campos.length >= 2) {
          const nombre = campos[1]?.trim();
          if (nombre && (
            nombre.toLowerCase().includes('epson') ||
            nombre.toLowerCase().includes('tm-t20') ||
            nombre.toLowerCase().includes('receipt')
          )) {
            impresoraEpson = nombre;
            break;
          }
        }
      }
      
      if (!impresoraEpson) {
        throw new Error('No se encontró impresora EPSON TM-T20III');
      }
      
      console.log(`📤 Enviando a impresora: ${impresoraEpson}`);
      
      // Intentar diferentes métodos de impresión
      const comandos = [
        `print /D:"${impresoraEpson}" "${tempFile}"`,
        `type "${tempFile}" > "${impresoraEpson}"`,
        `copy "${tempFile}" "${impresoraEpson}"`
      ];
      
      for (const comando of comandos) {
        try {
          await execPromise(comando);
          console.log('✅ Impresión exitosa');
          return;
        } catch (error) {
          console.log(`⚠️ Método falló: ${comando}`);
          continue;
        }
      }
      
      throw new Error('Todos los métodos de impresión fallaron');
      
    } catch (error) {
      throw new Error(`Error en impresión: ${error.message}`);
    }
  }

  // Imprimir recibo (basado en la documentación oficial)
  async printReceipt(paperWidth, orderData) {
    try {
      await this.initialize();
      
      this.paperWidth = paperWidth || EPSON_CONFIG.paperWidth.PAPER_80MM;
      
      // Abrir cajón (como en la documentación)
      this.deviceObj.addPulse(this.deviceObj.DRAWER_1, this.deviceObj.PULSE_100);
      
      // Header centrado
      this.deviceObj.addTextAlign(this.deviceObj.ALIGN_CENTER);
      this.deviceObj.addText('\n');
      this.deviceObj.addText(EPSON_CONFIG.SHOPID);
      this.deviceObj.addText('\n');
      this.deviceObj.addText(EPSON_CONFIG.ADDRESS);
      this.deviceObj.addText('\n');
      this.deviceObj.addText(EPSON_CONFIG.TEL);
      this.deviceObj.addText('\n\n');
      
      // Título del documento
      this.deviceObj.addTextDouble(true);
      if (orderData.type === 'comanda') {
        this.deviceObj.addText('COMANDA');
      } else {
        this.deviceObj.addText('CUENTA');
      }
      this.deviceObj.addTextDouble(false);
      this.deviceObj.addText('\n');
      this.deviceObj.addText('========================');
      this.deviceObj.addText('\n\n');
      
      // Información del pedido
      this.deviceObj.addTextAlign(this.deviceObj.ALIGN_LEFT);
      if (orderData.comanda) {
        this.deviceObj.addText(`Comanda: ${orderData.comanda}\n`);
      }
      if (orderData.ordenDeCompra) {
        this.deviceObj.addText(`Orden: ${orderData.ordenDeCompra}\n`);
      }
      
      // Timestamp (como en la documentación)
      this.deviceObj.addText(`${this.getTimestamp()}\n\n`);
      
      // Productos
      this.deviceObj.addText('PRODUCTOS:\n');
      this.deviceObj.addText('------------------------\n');
      
      if (orderData.productos && Array.isArray(orderData.productos)) {
        orderData.productos.forEach((item, index) => {
          let productLine = `${index + 1}. ${item.producto}`;
          let quantityLine = `   Cant: ${item.cantidad || 1}`;
          
          if (item.precioUnitario) {
            quantityLine += ` x $${item.precioUnitario.toFixed(2)}`;
          }
          
          if (item.total) {
            let totalLine = `   Total: $${item.total.toFixed(2)}`;
            this.deviceObj.addText(productLine + '\n');
            this.deviceObj.addText(quantityLine + '\n');
            this.deviceObj.addText(totalLine + '\n\n');
          } else {
            this.deviceObj.addText(productLine + '\n');
            this.deviceObj.addText(quantityLine + '\n\n');
          }
        });
      }
      
      this.deviceObj.addText('------------------------\n');
      
      // Totales (solo para cuentas)
      if (orderData.type === 'cuenta' && orderData.totalAPagar) {
        if (orderData.subtotal) {
          this.deviceObj.addText(`SUBTOTAL:    $${orderData.subtotal.toFixed(2)}\n`);
        }
        
        if (orderData.descuento && orderData.descuento.cantidad > 0) {
          this.deviceObj.addText(`DESC.(${orderData.descuento.porcentaje}%): -$${orderData.descuento.cantidad.toFixed(2)}\n`);
        }
        
        if (orderData.iva && orderData.iva.cantidad > 0) {
          this.deviceObj.addText(`IVA(${orderData.iva.porcentaje}%):     +$${orderData.iva.cantidad.toFixed(2)}\n`);
        }
        
        this.deviceObj.addText('========================\n');
        this.deviceObj.addTextDouble(true);
        this.deviceObj.addText(`TOTAL:       $${orderData.totalAPagar.toFixed(2)}`);
        this.deviceObj.addTextDouble(false);
        this.deviceObj.addText('\n========================\n\n');
      }
      
      // Footer
      this.deviceObj.addTextAlign(this.deviceObj.ALIGN_CENTER);
      if (orderData.type === 'comanda') {
        this.deviceObj.addText('¡Gracias!\n');
      } else {
        this.deviceObj.addText('¡Gracias por su compra!\n');
      }
      
      // Número de secuencia (como en la documentación)
      const strSeqNo = ('0000' + this.seqNo).slice(-4);
      this.deviceObj.addText(`Ticket: ${strSeqNo}\n`);
      
      this.deviceObj.addFeedLine(3);
      this.deviceObj.addCut(this.deviceObj.CUT_FEED);
      
      // Enviar a impresión
      await this.deviceObj.send();
      
      // Incrementar número de secuencia
      this.seqNo += 1;
      if (this.seqNo > 9999) {
        this.seqNo = 1;
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Error en impresión de recibo:', error);
      throw error;
    }
  }

  // Generar timestamp (como en la documentación oficial)
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
const printerManager = new EpsonPrinterManager();

//**********************************************************
//* Endpoints del servidor
//**********************************************************

// Endpoint para imprimir comanda
app.post('/imprimir-comanda', async (req, res) => {
  try {
    const { paperWidth = EPSON_CONFIG.paperWidth.PAPER_80MM, ...datosComanda } = req.body;
    const { comanda, ordenDeCompra, productos } = datosComanda;

    // Validar datos requeridos
    if (!comanda || !ordenDeCompra || !productos || !Array.isArray(productos)) {
      return res.status(400).json({ 
        error: 'Datos incompletos. Se requiere comanda, ordenDeCompra y productos' 
      });
    }

    console.log(`\n🖨️ === IMPRIMIENDO COMANDA EPSON ===`);
    console.log(`📝 Comanda: ${comanda}, Orden: ${ordenDeCompra}`);

    // Preparar datos para impresión
    const orderData = {
      ...datosComanda,
      type: 'comanda'
    };

    // Imprimir usando el manager oficial de EPSON
    await printerManager.printReceipt(paperWidth, orderData);

    const respuesta = {
      success: true,
      message: 'Comanda impresa correctamente en EPSON TM-T20III',
      metodo: 'ePOS-Device',
      modelo: 'TM-T20III',
      paperWidth: paperWidth + 'mm',
      comanda: comanda,
      orden: ordenDeCompra,
      seqNo: printerManager.seqNo - 1,
      timestamp: new Date().toISOString()
    };

    console.log('✅ === COMANDA IMPRESA EXITOSAMENTE ===\n');
    res.json(respuesta);

  } catch (error) {
    console.error('❌ Error en impresión de comanda:', error);
    
    res.status(500).json({ 
      error: 'Error al imprimir comanda', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint para imprimir cuenta
app.post('/imprimir-cuenta', async (req, res) => {
  try {
    const { paperWidth = EPSON_CONFIG.paperWidth.PAPER_80MM, ...datosCuenta } = req.body;
    const { ordenDeCompra, productos, totalAPagar } = datosCuenta;

    // Validar datos requeridos
    if (!ordenDeCompra || !productos || !Array.isArray(productos) || !totalAPagar) {
      return res.status(400).json({ 
        error: 'Datos incompletos. Se requiere ordenDeCompra, productos y totalAPagar' 
      });
    }

    console.log(`\n🧾 === IMPRIMIENDO CUENTA EPSON ===`);
    console.log(`📝 Orden: ${ordenDeCompra}, Total: $${totalAPagar}`);

    // Preparar datos para impresión
    const orderData = {
      ...datosCuenta,
      type: 'cuenta'
    };

    // Imprimir usando el manager oficial de EPSON
    await printerManager.printReceipt(paperWidth, orderData);

    const respuesta = {
      success: true,
      message: 'Cuenta impresa correctamente en EPSON TM-T20III',
      metodo: 'ePOS-Device',
      modelo: 'TM-T20III',
      paperWidth: paperWidth + 'mm',
      orden: ordenDeCompra,
      total: totalAPagar,
      seqNo: printerManager.seqNo - 1,
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

// Endpoint para listar impresoras
app.get('/listar-impresoras', async (req, res) => {
  try {
    console.log('🔍 Buscando impresoras EPSON...');
    
    const { stdout } = await execPromise('wmic printer get name,portname,status /format:csv');
    const lineas = stdout.split('\n')
      .filter(linea => linea.trim() && !linea.includes('Node,Name'));

    const impresoras = [];
    let epsonEncontrada = false;

    for (const linea of lineas) {
      const campos = linea.split(',');
      if (campos.length >= 2) {
        const nombre = campos[1]?.trim();
        const puerto = campos[2]?.trim();
        const estado = campos[3]?.trim();
        
        if (nombre) {
          const esEpson = nombre.toLowerCase().includes('epson') || 
                         nombre.toLowerCase().includes('tm-t20') ||
                         nombre.toLowerCase().includes('receipt');
          
          if (esEpson) {
            epsonEncontrada = true;
          }
          
          impresoras.push({
            nombre,
            puerto,
            estado,
            esEpson,
            recomendada: esEpson && nombre.toLowerCase().includes('tm-t20')
          });
        }
      }
    }

    res.json({ 
      success: true, 
      impresoras: impresoras,
      epsonEncontrada,
      configuracion: EPSON_CONFIG,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error listando impresoras', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de prueba
app.post('/test-printer', async (req, res) => {
  try {
    const { paperWidth = EPSON_CONFIG.paperWidth.PAPER_80MM } = req.body;
    
    console.log(`🧪 === PRUEBA DE IMPRESORA EPSON ===`);

    // Datos de prueba
    const testData = {
      type: 'comanda',
      comanda: 'TEST-001',
      ordenDeCompra: 'PRUEBA-' + Date.now(),
      productos: [
        {
          producto: 'Test de Impresión',
          cantidad: 1
        }
      ]
    };

    await printerManager.printReceipt(paperWidth, testData);
    
    const resultado = {
      success: true,
      message: 'Prueba de impresión exitosa en EPSON TM-T20III',
      metodo: 'ePOS-Device',
      modelo: 'TM-T20III',
      paperWidth: paperWidth + 'mm',
      seqNo: printerManager.seqNo - 1,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ === PRUEBA EXITOSA ===\n');
    res.json(resultado);
    
  } catch (error) {
    console.error('❌ Prueba falló:', error.message);
    
    res.status(500).json({ 
      error: 'Prueba de impresora falló', 
      details: error.message,
      sugerencias: [
        'Verificar que la impresora EPSON TM-T20III esté encendida',
        'Instalar drivers oficiales de Epson',
        'Verificar conexión USB',
        'Ejecutar como administrador'
      ],
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de configuración
app.get('/config', (req, res) => {
  res.json({
    success: true,
    configuracion: EPSON_CONFIG,
    paperWidths: [
      { value: 58, label: '58mm' },
      { value: 80, label: '80mm' }
    ],
    timestamp: new Date().toISOString()
  });
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    servicio: 'Servidor EPSON TM-T20III ePOS-Device',
    version: '3.0.0',
    api: 'ePOS-Device Compatible',
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
  console.log(`\n🚀 === SERVIDOR EPSON TM-T20III ePOS-DEVICE ===`);
  console.log(`📡 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🖨️ API Compatible con: EPSON ePOS-Device SDK`);
  console.log(`📋 Modelo soportado: TM-T20III`);
  console.log('\n📋 Endpoints disponibles:');
  console.log(`  POST http://localhost:${PORT}/imprimir-comanda - Imprimir comanda`);
  console.log(`  POST http://localhost:${PORT}/imprimir-cuenta - Imprimir cuenta/factura`);
  console.log(`  GET  http://localhost:${PORT}/listar-impresoras - Listar impresoras`);
  console.log(`  POST http://localhost:${PORT}/test-printer - Prueba de impresión`);
  console.log(`  GET  http://localhost:${PORT}/config - Ver configuración`);
  console.log(`  GET  http://localhost:${PORT}/health - Estado del servidor`);
  console.log('\n✅ Servidor listo - API ePOS-Device inicializada\n');
});

module.exports = app;