const { SerialPort } = require('serialport');
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
escpos.Serial = require('escpos-serialport');

// Función para detectar puertos serie disponibles
async function detectarPuertos() {
    try {
        const ports = await SerialPort.list();
        console.log('Puertos serie disponibles:');
        ports.forEach(port => {
            console.log(`- Puerto: ${port.path}`);
            console.log(`  Fabricante: ${port.manufacturer || 'N/A'}`);
            console.log(`  ID del Producto: ${port.productId || 'N/A'}`);
            console.log(`  ID del Vendedor: ${port.vendorId || 'N/A'}`);
            console.log('---');
        });
        return ports;
    } catch (error) {
        console.error('Error al listar puertos:', error);
        return [];
    }
}

// Función para detectar impresoras USB
async function detectarImpresorasUSB() {
    try {
        const device = new escpos.USB();
        console.log('Buscando impresoras USB...');
        
        // Intentar conectar directamente (escpos-usb detecta automáticamente)
        return device;
    } catch (error) {
        console.log('No se encontraron impresoras USB o error:', error.message);
        return null;
    }
}

// Función para imprimir via USB
async function imprimirUSB() {
    try {
        const device = new escpos.USB();
        const printer = new escpos.Printer(device);
        
        await device.open();
        
        printer
            .font('a')
            .align('ct')
            .style('bu')
            .size(1, 1)
            .text('HOLA')
            .text('')
            .text('Impreso desde Node.js')
            .text('')
            .cut()
            .close();
            
        console.log('✅ Impresión completada via USB');
        
    } catch (error) {
        console.error('❌ Error al imprimir via USB:', error.message);
        throw error;
    }
}

// Función para imprimir via puerto serie
async function imprimirSerie(puerto) {
    try {
        const device = new escpos.Serial(puerto, {
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none'
        });
        
        const printer = new escpos.Printer(device);
        
        await device.open();
        
        printer
            .font('a')
            .align('ct')
            .style('bu')
            .size(1, 1)
            .text('HOLA')
            .text('')
            .text('Impreso desde Node.js')
            .text('Puerto: ' + puerto)
            .text('')
            .cut()
            .close();
            
        console.log(`✅ Impresión completada en puerto ${puerto}`);
        
    } catch (error) {
        console.error(`❌ Error al imprimir en puerto ${puerto}:`, error.message);
        throw error;
    }
}

// Función principal
async function main() {
    console.log('🔍 Detectando impresora EPSON TM-T20III...\n');
    
    // Intentar primero por USB
    console.log('1. Intentando conexión USB...');
    try {
        await imprimirUSB();
        return; // Si funciona por USB, terminamos aquí
    } catch (error) {
        console.log('   Conexión USB falló, intentando puertos serie...\n');
    }
    
    // Si USB falla, buscar en puertos serie
    console.log('2. Detectando puertos serie...');
    const puertos = await detectarPuertos();
    
    if (puertos.length === 0) {
        console.log('❌ No se encontraron puertos disponibles');
        return;
    }
    
    // Intentar imprimir en cada puerto serie encontrado
    console.log('\n3. Intentando imprimir en cada puerto...');
    for (const puerto of puertos) {
        console.log(`\n   Probando puerto: ${puerto.path}`);
        try {
            await imprimirSerie(puerto.path);
            console.log('✅ ¡Impresora encontrada y funcionando!');
            return; // Si funciona, terminamos
        } catch (error) {
            console.log(`   Puerto ${puerto.path} no respondió`);
            continue;
        }
    }
    
    console.log('\n❌ No se pudo conectar con la impresora en ningún puerto');
    console.log('\n💡 Sugerencias:');
    console.log('   - Verifica que la impresora esté encendida');
    console.log('   - Revisa que el cable esté bien conectado');
    console.log('   - En Windows, verifica el puerto en el Administrador de dispositivos');
    console.log('   - Prueba instalar los drivers de EPSON TM-T20III');
}

// Ejecutar el script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    detectarPuertos,
    imprimirUSB,
    imprimirSerie,
    main
};