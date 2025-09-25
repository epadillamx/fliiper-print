const express = require('express');
const escpos = require('escpos');
const USB = require('escpos-usb');
const Network = require('escpos-network');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware para JSON
app.use(express.json());

// Configuración específica para EPSON TM-T20III
const EPSON_CONFIG = {
  vendorId: 0x04b8,  // Vendor ID de Epson
  productId: 0x0202, // Product ID común para TM-T20III
  nombre: 'EPSON TM-T20III Receipt',
  aliases: ['epson', 'tm-t20iii', 'tm-t20', 'receipt', 'pos']
};

// Función mejorada para encontrar impresora EPSON TM-T20III
async function encontrarImpresoraEpson(nombreImpresora = EPSON_CONFIG.nombre) {
  try {
    console.log(`🔍 Buscando impresora: ${nombreImpresora}`);
    
    // Para Windows - usar wmic para listar impresoras con más detalles
    const { stdout } = await execPromise('wmic printer get name,portname,status,sharename /format:csv');
    const lineas = stdout.split('\n').filter(linea => linea.trim() && !linea.includes('Node,Name'));
    
    let impresoraEncontrada = null;
    
    for (const linea of lineas) {
      const campos = linea.split(',');
      if (campos.length >= 2) {
        const nombre = campos[1]?.trim() || '';
        const puerto = campos[2]?.trim() || '';
        const estado = campos[3]?.trim() || '';
        
        // Buscar por nombre exacto
        if (nombre.toLowerCase() === nombreImpresora.toLowerCase()) {
          impresoraEncontrada = { nombre, puerto, estado };
          break;
        }
        
        // Buscar por aliases de EPSON TM-T20III
        const nombreLower = nombre.toLowerCase();
        if (EPSON_CONFIG.aliases.some(alias => nombreLower.includes(alias))) {
          impresoraEncontrada = { nombre, puerto, estado };
          console.log(`✅ Impresora EPSON encontrada: ${nombre}`);
          break;
        }
      }
    }
    
    if (impresoraEncontrada) {
      console.log(`📋 Detalles de impresora:`, impresoraEncontrada);
      return impresoraEncontrada;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error buscando impresora:', error);
    return null;
  }
}

// Función mejorada para conectar con impresora EPSON TM-T20III
async function conectarImpresoraEpson(nombreImpresora = EPSON_CONFIG.nombre) {
  console.log(`🔌 Intentando conectar con: ${nombreImpresora}`);
  
  // Método 1: Conexión USB directa (específica para EPSON TM-T20III)
  try {
    console.log('🔄 Intentando conexión USB directa...');
    
    // Configurar dispositivo USB con configuración específica para TM-T20III
    const device = new USB(EPSON_CONFIG.vendorId, EPSON_CONFIG.productId);
    const printer = new escpos.Printer(device);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout en conexión USB'));
      }, 5000);
      
      device.open((error) => {
        clearTimeout(timeout);
        if (error) {
          console.log('⚠️ Error USB específico:', error.message);
          reject(error);
        } else {
          console.log('✅ Conexión USB directa exitosa');
          resolve();
        }
      });
    });
    
    return { 
      printer, 
      device, 
      tipo: 'USB_DIRECT',
      modelo: 'TM-T20III',
      configuracion: 'Epson específica'
    };
  } catch (error) {
    console.log('⚠️ Conexión USB directa falló:', error.message);
  }
  
  // Método 2: USB genérico
  try {
    console.log('🔄 Intentando conexión USB genérica...');
    const device = new USB();
    const printer = new escpos.Printer(device);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout en conexión USB genérica'));
      }, 3000);
      
      device.open((error) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      });
    });
    
    console.log('✅ Conexión USB genérica exitosa');
    return { 
      printer, 
      device, 
      tipo: 'USB_GENERIC',
      modelo: 'TM-T20III'
    };
  } catch (error) {
    console.log('⚠️ Conexión USB genérica falló:', error.message);
  }
  
  // Método 3: Conexión por red (si la TM-T20III tiene adaptador de red)
  try {
    console.log('🔄 Intentando conexión por red...');
    const networkDevice = await conectarPorRed();
    if (networkDevice) {
      return networkDevice;
    }
  } catch (error) {
    console.log('⚠️ Conexión por red falló:', error.message);
  }
  
  // Método 4: Usar comando del sistema Windows
  const impresora = await encontrarImpresoraEpson(nombreImpresora);
  if (impresora) {
    console.log('✅ Usando método de sistema Windows');
    return { 
      printer: null, 
      device: null, 
      tipo: 'WINDOWS_SYSTEM', 
      nombre: impresora.nombre,
      puerto: impresora.puerto,
      estado: impresora.estado,
      modelo: 'TM-T20III'
    };
  }
  
  throw new Error(`❌ No se pudo conectar con la impresora: ${nombreImpresora}`);
}

// Función para conexión por red (para TM-T20III con adaptador Ethernet)
async function conectarPorRed() {
  try {
    const ipsComunes = [
      '192.168.1.100', '192.168.1.200', '192.168.1.50',
      '192.168.0.100', '192.168.0.200', '192.168.0.50',
      '10.0.0.100', '10.0.0.200'
    ];
    
    const puerto = 9100; // Puerto estándar para impresoras ESC/POS
    
    for (const ip of ipsComunes) {
      try {
        console.log(`🔄 Probando IP: ${ip}:${puerto}`);
        
        // Crear dispositivo de red
        const device = new Network(ip, puerto);
        const printer = new escpos.Printer(device);
        
        // Probar conexión con timeout
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout'));
          }, 2000);
          
          device.open((error) => {
            clearTimeout(timeout);
            if (error) reject(error);
            else resolve();
          });
        });
        
        console.log(`✅ Conexión de red exitosa: ${ip}:${puerto}`);
        return {
          printer,
          device,
          tipo: 'NETWORK',
          ip: ip,
          puerto: puerto,
          modelo: 'TM-T20III'
        };
        
      } catch (error) {
        continue; // Probar siguiente IP
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error en conexión por red:', error);
    return null;
  }
}

// Función mejorada para imprimir con comando del sistema
async function imprimirConComandoEpson(contenido, nombreImpresora) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(__dirname, `temp_ticket_${Date.now()}.txt`);
    
    try {
      // Escribir contenido con codificación UTF-8
      fs.writeFileSync(tempFile, contenido, 'utf8');
      
      // Comandos específicos para Windows con diferentes métodos
      const comandos = [
        `print /D:"${nombreImpresora}" "${tempFile}"`,
        `type "${tempFile}" > PRN`,
        `copy "${tempFile}" "${nombreImpresora}"`
      ];
      
      let exitoso = false;
      
      const probarComando = (index) => {
        if (index >= comandos.length) {
          reject(new Error('Todos los métodos de impresión fallaron'));
          return;
        }
        
        const comando = comandos[index];
        console.log(`🔄 Ejecutando comando ${index + 1}: ${comando}`);
        
        exec(comando, (error, stdout, stderr) => {
          if (error) {
            console.log(`⚠️ Comando ${index + 1} falló:`, error.message);
            probarComando(index + 1);
          } else {
            console.log(`✅ Comando ${index + 1} exitoso`);
            exitoso = true;
            resolve(stdout);
          }
        });
      };
      
      probarComando(0);
      
      // Limpiar archivo temporal después de un tiempo
      setTimeout(() => {
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }
        } catch (e) {
          console.warn('No se pudo eliminar archivo temporal:', e.message);
        }
      }, 5000);
      
    } catch (error) {
      reject(error);
    }
  });
}

// Función para formatear fecha
function formatearFecha(fechaStr, horaStr) {
  const fecha = new Date(fechaStr + ' ' + horaStr);
  return fecha.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Función para crear contenido del ticket optimizado para TM-T20III
function crearContenidoTicketEpson(datos) {
  const { comanda, ordenDeCompra, productos, fecha, hora, zonaHoraria } = datos;
  
  let contenido = '';
  
  // Header centrado (32 caracteres de ancho para TM-T20III)
  contenido += '        COMANDA         \n';
  contenido += '========================\n\n';
  
  contenido += `Comanda: ${comanda}\n`;
  contenido += `Orden: ${ordenDeCompra}\n\n`;
  
  if (fecha && hora) {
    const fechaFormateada = formatearFecha(fecha, hora);
    contenido += `Fecha: ${fechaFormateada}\n`;
    if (zonaHoraria) {
      contenido += `Zona: ${zonaHoraria}\n`;
    }
    contenido += '\n';
  }
  
  contenido += 'PRODUCTOS:\n';
  contenido += '------------------------\n\n';
  
  productos.forEach((item, index) => {
    const numero = `${index + 1}. `;
    const producto = item.producto;
    const cantidad = `Cant: ${item.cantidad || 1}`;
    
    contenido += numero + producto + '\n';
    contenido += '   ' + cantidad + '\n\n';
  });
  
  contenido += '------------------------\n\n';
  contenido += '      ¡Gracias!        \n\n';
  
  // Comandos ESC/POS para cortar papel
  contenido += '\x1B\x69'; // Corte parcial
  contenido += '\n\n';
  
  return contenido;
}

// Función para crear contenido de cuenta optimizado para TM-T20III
function crearContenidoCuentaEpson(datos) {
  const { header, ordenDeCompra, productos, subtotal, descuento, iva, totalAPagar, fecha, hora } = datos;
  
  let contenido = '';
  
  // Header de la empresa
  if (header) {
    const empresa = header.empresa || '';
    contenido += `${empresa.toUpperCase()}\n`;
    if (header.direccion) {
      contenido += `${header.direccion}\n`;
    }
    contenido += '\n';
  }
  
  contenido += '        CUENTA          \n';
  contenido += '========================\n\n';
  contenido += `Orden: ${ordenDeCompra}\n`;
  
  if (fecha && hora) {
    contenido += `Fecha: ${fecha} ${hora}\n`;
  }
  contenido += '\n';
  
  contenido += 'PRODUCTOS:\n';
  contenido += '------------------------\n';
  
  productos.forEach((item, index) => {
    contenido += `${index + 1}. ${item.producto}\n`;
    contenido += `   ${item.cantidad} x ${item.precioUnitario.toFixed(2)}\n`;
    contenido += `   Total: $${item.total.toFixed(2)}\n\n`;
  });
  
  contenido += '------------------------\n';
  contenido += `SUBTOTAL:    $${subtotal.toFixed(2)}\n`;
  
  if (descuento && descuento.cantidad > 0) {
    contenido += `DESC.(${descuento.porcentaje}%): -$${descuento.cantidad.toFixed(2)}\n`;
  }
  
  if (iva && iva.cantidad > 0) {
    contenido += `IVA(${iva.porcentaje}%):     +$${iva.cantidad.toFixed(2)}\n`;
  }
  
  contenido += '========================\n';
  contenido += `TOTAL:       $${totalAPagar.toFixed(2)}\n`;
  contenido += '========================\n\n';
  contenido += '   ¡Gracias por su     \n';
  contenido += '      compra!          \n\n';
  
  // Comando de corte
  contenido += '\x1B\x69';
  contenido += '\n\n';
  
  return contenido;
}

// Endpoint mejorado para imprimir comanda
app.post('/imprimir-comanda', async (req, res) => {
  try {
    const { nombreImpresora = EPSON_CONFIG.nombre, ...datosComanda } = req.body;
    const { comanda, ordenDeCompra, productos, fecha, hora, zonaHoraria } = datosComanda;

    // Validar datos requeridos
    if (!comanda || !ordenDeCompra || !productos || !Array.isArray(productos)) {
      return res.status(400).json({ 
        error: 'Datos incompletos. Se requiere comanda, ordenDeCompra y productos' 
      });
    }

    console.log(`\n🖨️ === INICIANDO IMPRESIÓN DE COMANDA ===`);
    console.log(`📝 Comanda: ${comanda}, Orden: ${ordenDeCompra}`);
    console.log(`🎯 Impresora destino: ${nombreImpresora}`);

    // Conectar con la impresora
    const conexion = await conectarImpresoraEpson(nombreImpresora);

    if (conexion.tipo.includes('USB') || conexion.tipo === 'NETWORK') {
      // Método directo con ESC/POS
      const { printer, device } = conexion;
      
      console.log('🔄 Imprimiendo con ESC/POS...');
      
      printer
        .flush()
        .font('a')
        .align('ct')
        .style('bu')
        .size(1, 1)
        .text('COMANDA')
        .text('========================')
        .align('lt')
        .style('normal')
        .size(0, 0)
        .text('')
        .text(`Comanda: ${comanda}`)
        .text(`Orden: ${ordenDeCompra}`)
        .text('');

      if (fecha && hora) {
        const fechaFormateada = formatearFecha(fecha, hora);
        printer.text(`Fecha: ${fechaFormateada}`);
        if (zonaHoraria) {
          printer.text(`Zona: ${zonaHoraria}`);
        }
        printer.text('');
      }

      printer
        .text('PRODUCTOS:')
        .text('------------------------')
        .text('');

      productos.forEach((item, index) => {
        printer
          .text(`${index + 1}. ${item.producto}`)
          .text(`   Cant: ${item.cantidad || 1}`)
          .text('');
      });

      printer
        .text('------------------------')
        .text('')
        .align('ct')
        .text('¡Gracias!')
        .text('')
        .text('')
        .cut()
        .close(() => {
          console.log('✅ Impresión ESC/POS completada');
        });

    } else {
      // Método usando comando del sistema
      console.log('🔄 Imprimiendo con comando del sistema...');
      const contenidoTicket = crearContenidoTicketEpson(datosComanda);
      await imprimirConComandoEpson(contenidoTicket, conexion.nombre || nombreImpresora);
      console.log('✅ Impresión por comando del sistema completada');
    }

    const respuesta = {
      success: true,
      message: 'Comanda impresa correctamente en EPSON TM-T20III',
      impresora: conexion.nombre || nombreImpresora,
      metodo: conexion.tipo,
      modelo: 'TM-T20III',
      comanda: comanda,
      orden: ordenDeCompra,
      timestamp: new Date().toISOString()
    };

    console.log('✅ === IMPRESIÓN COMPLETADA ===\n');
    res.json(respuesta);

  } catch (error) {
    console.error('❌ Error en impresión:', error);
    
    res.status(500).json({ 
      error: 'Error al imprimir comanda', 
      details: error.message,
      impresora: req.body.nombreImpresora || 'No especificada',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint mejorado para imprimir cuenta
app.post('/imprimir-cuenta', async (req, res) => {
  try {
    const { nombreImpresora = EPSON_CONFIG.nombre, header, ...datosCuenta } = req.body;
    const { ordenDeCompra, productos, subtotal, iva, totalAPagar } = datosCuenta;

    // Validar datos requeridos
    if (!ordenDeCompra || !productos || !Array.isArray(productos) || !totalAPagar) {
      return res.status(400).json({ 
        error: 'Datos incompletos. Se requiere ordenDeCompra, productos y totalAPagar' 
      });
    }

    console.log(`\n🧾 === INICIANDO IMPRESIÓN DE CUENTA ===`);
    console.log(`📝 Orden: ${ordenDeCompra}, Total: $${totalAPagar}`);
    console.log(`🎯 Impresora destino: ${nombreImpresora}`);

    // Conectar con la impresora
    const conexion = await conectarImpresoraEpson(nombreImpresora);

    if (conexion.tipo.includes('USB') || conexion.tipo === 'NETWORK') {
      // Método directo con ESC/POS
      const { printer, device } = conexion;
      
      console.log('🔄 Imprimiendo cuenta con ESC/POS...');
      
      printer.flush();
      
      // Header de la empresa
      if (header && header.empresa) {
        printer
          .font('a')
          .align('ct')
          .style('bu')
          .size(1, 1)
          .text(header.empresa.toUpperCase());
        
        if (header.direccion) {
          printer
            .style('normal')
            .size(0, 0)
            .text(header.direccion);
        }
        printer.text('');
      }

      printer
        .font('a')
        .align('ct')
        .style('bu')
        .size(1, 1)
        .text('CUENTA')
        .text('========================')
        .align('lt')
        .style('normal')
        .size(0, 0)
        .text('')
        .text(`Orden: ${ordenDeCompra}`)
        .text('');

      if (datosCuenta.fecha && datosCuenta.hora) {
        printer.text(`Fecha: ${datosCuenta.fecha} ${datosCuenta.hora}`);
        printer.text('');
      }

      printer
        .text('PRODUCTOS:')
        .text('------------------------');

      productos.forEach((item, index) => {
        printer
          .text(`${index + 1}. ${item.producto}`)
          .text(`   ${item.cantidad} x $${item.precioUnitario.toFixed(2)}`)
          .text(`   Total: $${item.total.toFixed(2)}`)
          .text('');
      });

      printer.text('------------------------');
      printer.text(`SUBTOTAL:    $${subtotal.toFixed(2)}`);
      
      if (datosCuenta.descuento && datosCuenta.descuento.cantidad > 0) {
        printer.text(`DESC.(${datosCuenta.descuento.porcentaje}%): -$${datosCuenta.descuento.cantidad.toFixed(2)}`);
      }
      
      if (iva && iva.cantidad > 0) {
        printer.text(`IVA(${iva.porcentaje}%):     +$${iva.cantidad.toFixed(2)}`);
      }

      printer
        .text('========================')
        .style('bu')
        .text(`TOTAL:       $${totalAPagar.toFixed(2)}`)
        .style('normal')
        .text('========================')
        .text('')
        .align('ct')
        .text('¡Gracias por su compra!')
        .text('')
        .text('')
        .cut()
        .close(() => {
          console.log('✅ Impresión de cuenta ESC/POS completada');
        });

    } else {
      // Método usando comando del sistema
      console.log('🔄 Imprimiendo cuenta con comando del sistema...');
      const contenidoCuenta = crearContenidoCuentaEpson(req.body);
      await imprimirConComandoEpson(contenidoCuenta, conexion.nombre || nombreImpresora);
      console.log('✅ Impresión de cuenta por comando del sistema completada');
    }

    const respuesta = {
      success: true,
      message: 'Cuenta impresa correctamente en EPSON TM-T20III',
      impresora: conexion.nombre || nombreImpresora,
      metodo: conexion.tipo,
      modelo: 'TM-T20III',
      orden: ordenDeCompra,
      total: totalAPagar,
      timestamp: new Date().toISOString()
    };

    console.log('✅ === IMPRESIÓN DE CUENTA COMPLETADA ===\n');
    res.json(respuesta);

  } catch (error) {
    console.error('❌ Error en impresión de cuenta:', error);
    
    res.status(500).json({ 
      error: 'Error al imprimir cuenta', 
      details: error.message,
      impresora: req.body.nombreImpresora || 'No especificada',
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint mejorado para listar impresoras
app.get('/listar-impresoras', async (req, res) => {
  try {
    console.log('🔍 Listando impresoras disponibles...');
    
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
          const esEpson = EPSON_CONFIG.aliases.some(alias => 
            nombre.toLowerCase().includes(alias)
          );
          
          if (esEpson) {
            epsonEncontrada = true;
          }
          
          impresoras.push({
            nombre,
            puerto,
            estado,
            esEpson,
            recomendada: esEpson
          });
        }
      }
    }

    res.json({ 
      success: true, 
      impresoras: impresoras,
      epsonEncontrada,
      configuracionEpson: EPSON_CONFIG,
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

// Endpoint mejorado de prueba de conexión
app.post('/test-printer', async (req, res) => {
  try {
    const { nombreImpresora = EPSON_CONFIG.nombre } = req.body;
    
    console.log(`🧪 === PRUEBA DE CONEXIÓN ===`);
    console.log(`🎯 Probando impresora: ${nombreImpresora}`);

    const conexion = await conectarImpresoraEpson(nombreImpresora);
    
    // Cerrar conexión si es USB/Network
    if (conexion.device && typeof conexion.device.close === 'function') {
      conexion.device.close();
    }
    
    const resultado = {
      success: true,
      message: 'Conexión exitosa con EPSON TM-T20III',
      impresora: conexion.nombre || nombreImpresora,
      metodo: conexion.tipo,
      modelo: conexion.modelo || 'TM-T20III',
      puerto: conexion.puerto || 'N/A',
      estado: conexion.estado || 'Conectada',
      ip: conexion.ip || null,
      timestamp: new Date().toISOString()
    };
    
    console.log('✅ Prueba de conexión exitosa');
    console.log('✅ === FIN PRUEBA DE CONEXIÓN ===\n');
    
    res.json(resultado);
  } catch (error) {
    console.error('❌ Prueba de conexión falló:', error.message);
    
    res.status(500).json({ 
      error: 'No se pudo conectar con la impresora', 
      details: error.message,
      sugerencias: [
        'Verificar que la impresora esté encendida',
        'Instalar drivers oficiales de Epson',
        'Verificar conexión USB/Red',
        'Ejecutar como administrador'
      ],
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint de salud mejorado
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    servicio: 'Servidor de Impresión EPSON TM-T20III',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    configuracion: EPSON_CONFIG
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
  console.log(`\n🚀 === SERVIDOR DE IMPRESIÓN EPSON TM-T20III ===`);
  console.log(`📡 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🖨️ Configurado para: ${EPSON_CONFIG.nombre}`);
  console.log(`🔧 Vendor ID: 0x${EPSON_CONFIG.vendorId.toString(16).toUpperCase()}`);
  console.log(`🔧 Product ID: 0x${EPSON_CONFIG.productId.toString(16).toUpperCase()}`);
  console.log('\n📋 Endpoints disponibles:');
  console.log(`  POST http://localhost:${PORT}/imprimir-comanda - Imprimir comanda`);
  console.log(`  POST http://localhost:${PORT}/imprimir-cuenta - Imprimir cuenta/factura`);
  console.log(`  GET  http://localhost:${PORT}/listar-impresoras - Listar impresoras`);
  console.log(`  POST http://localhost:${PORT}/test-printer - Probar conexión`);
  console.log(`  GET  http://localhost:${PORT}/health - Estado del servidor`);
  console.log('\n✅ Servidor listo para recibir peticiones\n');
});

module.exports = app;