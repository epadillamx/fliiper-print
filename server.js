const express = require('express');
const escpos = require('escpos');
const USB = require('escpos-usb');
const Network = require('escpos-network');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();

// Middleware para JSON
app.use(express.json());

// Función para encontrar impresora por nombre
async function encontrarImpresora(nombreImpresora) {
  try {
    // Para Windows - usar wmic para listar impresoras
    const { stdout } = await execPromise('wmic printer get name,portname /format:csv');
    const lineas = stdout.split('\n').filter(linea => linea.trim());
    
    for (const linea of lineas) {
      if (linea.toLowerCase().includes(nombreImpresora.toLowerCase())) {
        // Extraer información del puerto si es necesario
        console.log(`Impresora encontrada: ${nombreImpresora}`);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error buscando impresora:', error);
    return false;
  }
}

// Función para imprimir usando comando del sistema (más compatible)
async function imprimirConComando(contenido, nombreImpresora) {
  return new Promise((resolve, reject) => {
    // Crear archivo temporal
    const fs = require('fs');
    const path = require('path');
    const tempFile = path.join(__dirname, 'temp_ticket.txt');
    
    fs.writeFileSync(tempFile, contenido, 'utf8');
    
    // Comando para imprimir en Windows
    const comando = `print /D:"${nombreImpresora}" "${tempFile}"`;
    
    exec(comando, (error, stdout, stderr) => {
      // Limpiar archivo temporal
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        console.warn('No se pudo eliminar archivo temporal:', e.message);
      }
      
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

// Función para conectar con impresora usando diferentes métodos
async function conectarImpresora(nombreImpresora) {
  // Método 1: Intentar conexión USB directa
  try {
    const device = new USB();
    const printer = new escpos.Printer(device);
    
    await new Promise((resolve, reject) => {
      device.open((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    return { printer, device, tipo: 'USB' };
  } catch (error) {
    console.log('Conexión USB falló, intentando método alternativo...');
  }
  
  // Método 2: Usar comando del sistema
  const impresora = await encontrarImpresora(nombreImpresora);
  if (impresora) {
    return { printer: null, device: null, tipo: 'SYSTEM', nombre: nombreImpresora };
  }
  
  throw new Error(`No se pudo conectar con la impresora: ${nombreImpresora}`);
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

// Función para crear contenido del ticket
function crearContenidoTicket(datos) {
  const { comanda, ordenDeCompra, productos, fecha, hora, zonaHoraria } = datos;
  
  let contenido = '';
  contenido += '        COMANDA\n';
  contenido += '================\n\n';
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
  contenido += '--------------------------------\n\n';
  
  productos.forEach((item, index) => {
    contenido += `${index + 1}. ${item.producto}\n`;
    contenido += `   Cantidad: ${item.cantidad || 1}\n\n`;
  });
  
  contenido += '--------------------------------\n\n';
  contenido += '        ¡Gracias!\n\n\n\n';
  
  return contenido;
}

// Función para crear contenido de cuenta/factura
function crearContenidoCuenta(datos) {
  const { header, ordenDeCompra, productos, subtotal, descuento, iva, totalAPagar, fecha, hora } = datos;
  
  let contenido = '';
  
  // Header de la empresa
  if (header) {
    contenido += `${header.empresa || ''}\n`.toUpperCase();
    if (header.direccion) {
      contenido += `${header.direccion}\n`;
    }
    contenido += '\n';
  }
  
  contenido += '        CUENTA\n';
  contenido += '================\n\n';
  contenido += `Orden: ${ordenDeCompra}\n`;
  
  if (fecha && hora) {
    contenido += `Fecha: ${fecha} ${hora}\n`;
  }
  contenido += '\n';
  
  contenido += 'PRODUCTOS:\n';
  contenido += '--------------------------------\n';
  
  productos.forEach((item, index) => {
    contenido += `${index + 1}. ${item.producto}\n`;
    contenido += `   Cant: ${item.cantidad} x ${item.precioUnitario.toFixed(2)}\n`;
    contenido += `   Subtotal: ${item.total.toFixed(2)}\n\n`;
  });
  
  contenido += '--------------------------------\n';
  contenido += `SUBTOTAL:        ${subtotal.toFixed(2)}\n`;
  
  if (descuento && descuento.cantidad > 0) {
    contenido += `DESCUENTO (${descuento.porcentaje}%): -${descuento.cantidad.toFixed(2)}\n`;
  }
  
  if (iva && iva.cantidad > 0) {
    contenido += `IVA (${iva.porcentaje}%):      +${iva.cantidad.toFixed(2)}\n`;
  }
  
  contenido += '================================\n';
  contenido += `TOTAL A PAGAR:   ${totalAPagar.toFixed(2)}\n`;
  contenido += '================================\n\n';
  contenido += '        ¡Gracias por su compra!\n\n\n\n';
  
  return contenido;
}

// Endpoint para imprimir comanda
app.post('/imprimir-comanda', async (req, res) => {
  try {
    const { nombreImpresora, ...datosComanda } = req.body;
    const { comanda, ordenDeCompra, productos, fecha, hora, zonaHoraria } = datosComanda;

    // Validar datos requeridos
    if (!nombreImpresora) {
      return res.status(400).json({ 
        error: 'Se requiere el nombre de la impresora en el JSON' 
      });
    }

    if (!comanda || !ordenDeCompra || !productos || !Array.isArray(productos)) {
      return res.status(400).json({ 
        error: 'Datos incompletos. Se requiere comanda, ordenDeCompra y productos' 
      });
    }

    console.log(`Intentando imprimir en: ${nombreImpresora}`);

    // Conectar con la impresora
    const conexion = await conectarImpresora(nombreImpresora);

    if (conexion.tipo === 'USB') {
      // Método USB directo con ESC/POS
      const { printer, device } = conexion;
      
      printer.flush();
      
      printer
        .font('a')
        .align('ct')
        .style('bu')
        .size(1, 1)
        .text('COMANDA')
        .text('================')
        .align('lt')
        .style('normal')
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
        .text('--------------------------------')
        .text('');

      productos.forEach((item, index) => {
        printer
          .text(`${index + 1}. ${item.producto}`)
          .text(`   Cantidad: ${item.cantidad || 1}`)
          .text('');
      });

      printer
        .text('--------------------------------')
        .text('')
        .align('ct')
        .text('¡Gracias!')
        .text('')
        .text('')
        .text('')
        .cut()
        .close(() => {
          printer.flush();
          console.log('Impresión USB completada y buffer liberado');
        });

    } else {
      // Método usando comando del sistema
      const contenidoTicket = crearContenidoTicket(datosComanda);
      await imprimirConComando(contenidoTicket, nombreImpresora);
      console.log('Impresión por comando del sistema completada');
    }

    res.json({ 
      success: true, 
      message: 'Comanda impresa correctamente',
      impresora: nombreImpresora,
      metodo: conexion.tipo,
      comanda: comanda,
      orden: ordenDeCompra
    });

  } catch (error) {
    console.error('Error en impresión:', error);
    
    res.status(500).json({ 
      error: 'Error al imprimir comanda', 
      details: error.message 
    });
  }
});

// Endpoint para imprimir cuenta/factura
app.post('/imprimir-cuenta', async (req, res) => {
  try {
    const { nombreImpresora, header, ...datosCuenta } = req.body;
    const { ordenDeCompra, productos, subtotal, iva, totalAPagar } = datosCuenta;

    // Validar datos requeridos
    if (!nombreImpresora) {
      return res.status(400).json({ 
        error: 'Se requiere el nombre de la impresora en el JSON' 
      });
    }

    if (!ordenDeCompra || !productos || !Array.isArray(productos) || !totalAPagar) {
      return res.status(400).json({ 
        error: 'Datos incompletos. Se requiere ordenDeCompra, productos y totalAPagar' 
      });
    }

    console.log(`Imprimiendo cuenta en: ${nombreImpresora}`);

    // Conectar con la impresora
    const conexion = await conectarImpresora(nombreImpresora);

    if (conexion.tipo === 'USB') {
      // Método USB directo con ESC/POS
      const { printer, device } = conexion;
      
      printer.flush();
      
      // Header de la empresa
      if (header) {
        printer
          .font('a')
          .align('ct')
          .style('bu')
          .size(1, 1)
          .text(header.empresa ? header.empresa.toUpperCase() : '');
        
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
        .text('================')
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
        .text('--------------------------------');

      productos.forEach((item, index) => {
        printer
          .text(`${index + 1}. ${item.producto}`)
          .text(`   Cant: ${item.cantidad} x ${item.precioUnitario.toFixed(2)}`)
          .text(`   Subtotal: ${item.total.toFixed(2)}`)
          .text('');
      });

      printer.text('--------------------------------');
      printer.text(`SUBTOTAL:        ${subtotal.toFixed(2)}`);
      
      if (datosCuenta.descuento && datosCuenta.descuento.cantidad > 0) {
        printer.text(`DESCUENTO (${datosCuenta.descuento.porcentaje}%): -${datosCuenta.descuento.cantidad.toFixed(2)}`);
      }
      
      if (iva && iva.cantidad > 0) {
        printer.text(`IVA (${iva.porcentaje}%):      +${iva.cantidad.toFixed(2)}`);
      }

      printer
        .text('================================')
        .style('bu')
        .text(`TOTAL A PAGAR:   ${totalAPagar.toFixed(2)}`)
        .style('normal')
        .text('================================')
        .text('')
        .align('ct')
        .text('¡Gracias por su compra!')
        .text('')
        .text('')
        .text('')
        .cut()
        .close(() => {
          printer.flush();
          console.log('Impresión de cuenta USB completada y buffer liberado');
        });

    } else {
      // Método usando comando del sistema
      const contenidoCuenta = crearContenidoCuenta(req.body);
      await imprimirConComando(contenidoCuenta, nombreImpresora);
      console.log('Impresión de cuenta por comando del sistema completada');
    }

    res.json({ 
      success: true, 
      message: 'Cuenta impresa correctamente',
      impresora: nombreImpresora,
      metodo: conexion.tipo,
      orden: ordenDeCompra,
      total: totalAPagar
    });

  } catch (error) {
    console.error('Error en impresión de cuenta:', error);
    
    res.status(500).json({ 
      error: 'Error al imprimir cuenta', 
      details: error.message 
    });
  }
});

// Endpoint para listar impresoras disponibles
app.get('/listar-impresoras', async (req, res) => {
  try {
    const { stdout } = await execPromise('wmic printer get name /format:csv');
    const lineas = stdout.split('\n')
      .filter(linea => linea.trim() && !linea.includes('Node,Name'))
      .map(linea => linea.split(',').pop().trim())
      .filter(nombre => nombre);

    res.json({ 
      success: true, 
      impresoras: lineas 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error listando impresoras', 
      details: error.message 
    });
  }
});

// Endpoint de prueba de conexión
app.post('/test-printer', async (req, res) => {
  try {
    const { nombreImpresora } = req.body;
    
    if (!nombreImpresora) {
      return res.status(400).json({ 
        error: 'Se requiere el nombre de la impresora' 
      });
    }

    const conexion = await conectarImpresora(nombreImpresora);
    
    if (conexion.tipo === 'USB' && conexion.device) {
      conexion.device.close();
    }
    
    res.json({ 
      success: true, 
      message: 'Impresora conectada correctamente',
      impresora: nombreImpresora,
      metodo: conexion.tipo
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'No se pudo conectar con la impresora', 
      details: error.message 
    });
  }
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('Error no manejado:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
  console.log('Endpoints disponibles:');
  console.log('  POST /imprimir-comanda - Imprimir comanda (incluir nombreImpresora en JSON)');
  console.log('  POST /imprimir-cuenta - Imprimir cuenta/factura (incluir nombreImpresora en JSON)');
  console.log('  GET /listar-impresoras - Listar impresoras instaladas');
  console.log('  POST /test-printer - Probar conexión de impresora');
  console.log('  GET /health - Estado del servidor');
});

module.exports = app;