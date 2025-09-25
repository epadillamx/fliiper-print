// epos-print.js - Script simple con Epson ePOS SDK for JavaScript
// Datos de tu impresora: EPSON TM-T20III Receipt, Puerto: TMUSB001

const epos = require('epos');

// Configuración de tu impresora TM-T20III
const PRINTER_CONFIG = {
    type: epos.DEVICE_TYPE_PRINTER,
    deviceName: 'EPSON TM-T20III Receipt',
    port: 'TMUSB001',
    model: 'TM-T20III'
};

function imprimirHolaMundo() {
    console.log('🖨️  Imprimiendo HOLA MUNDO con ePOS SDK...\n');
    console.log('📋 Configuración:');
    console.log(`   Modelo: ${PRINTER_CONFIG.model}`);
    console.log(`   Nombre: ${PRINTER_CONFIG.deviceName}`);
    console.log(`   Puerto: ${PRINTER_CONFIG.port}\n`);
    
    try {
        // Crear objeto ePOS-Print
        const printer = new epos.ePOSPrint();
        
        // Inicializar impresora
        printer.addTextAlign(printer.ALIGN_CENTER);
        printer.addTextSize(2, 2); // Texto doble tamaño
        printer.addTextStyle(false, false, true, epos.COLOR_1); // Negrita
        
        // Título principal
        printer.addText('HOLA MUNDO\n');
        
        // Resetear formato
        printer.addTextSize(1, 1);
        printer.addTextStyle(false, false, false, epos.COLOR_1);
        
        // Subtítulo
        printer.addText('Epson ePOS SDK for JavaScript\n');
        printer.addText('================================\n\n');
        
        // Información del ticket (alineado a la izquierda)
        printer.addTextAlign(printer.ALIGN_LEFT);
        printer.addText(`Fecha: ${new Date().toLocaleString()}\n`);
        printer.addText(`Modelo: ${PRINTER_CONFIG.model}\n`);
        printer.addText(`Puerto: ${PRINTER_CONFIG.port}\n`);
        printer.addText('Papel: 88mm\n');
        printer.addText('SDK: Epson ePOS SDK\n\n');
        
        // Mensaje final centrado
        printer.addTextAlign(printer.ALIGN_CENTER);
        printer.addText('--------------------------------\n');
        printer.addText('¡Impresión exitosa!\n');
        printer.addText('--------------------------------\n\n');
        
        // Cortar papel
        printer.addCut(printer.CUT_FEED);
        
        // Configurar conexión
        const device = new epos.Device();
        
        console.log('🔌 Conectando a la impresora...');
        
        // Conectar al dispositivo
        device.connect(PRINTER_CONFIG.deviceName, PRINTER_CONFIG.type, {
            crypto: false,
            buffer: false
        }, (data, code) => {
            if (code === 'OK') {
                console.log('✅ Conectado correctamente');
                console.log('📄 Enviando documento...');
                
                // Enviar datos de impresión
                device.send(printer.toString(), (response, errorCode) => {
                    if (errorCode === 'OK') {
                        console.log('✅ ¡HOLA MUNDO impreso correctamente!');
                        console.log('📋 Revisa tu Epson TM-T20III');
                    } else {
                        console.error('❌ Error al imprimir:', errorCode);
                        console.log('💡 Verifica que la impresora tenga papel');
                    }
                    
                    // Desconectar
                    device.disconnect(() => {
                        console.log('🔌 Desconectado de la impresora');
                    });
                });
                
            } else {
                console.error('❌ Error de conexión:', code);
                console.log('\n💡 Soluciones:');
                console.log('   1. Verifica que la impresora esté encendida');
                console.log('   2. Ejecuta como administrador');
                console.log('   3. Instala: npm install epos');
                console.log('   4. Verifica el nombre exacto de la impresora');
            }
        });
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
        console.log('\n📦 Instalación requerida:');
        console.log('   npm install epos');
        console.log('\n🔧 Requisitos:');
        console.log('   - Epson TM-T20III driver instalado');
        console.log('   - Node.js 22');
        console.log('   - Windows con permisos de administrador');
    }
}

// Función para verificar SDK
function verificarSDK() {
    try {
        require('epos');
        console.log('✅ Epson ePOS SDK encontrado');
        return true;
    } catch (error) {
        console.log('❌ Epson ePOS SDK no encontrado');
        console.log('📦 Instala con: npm install epos');
        return false;
    }
}

// Ejecutar
console.log('🚀 EPSON ePOS SDK - HOLA MUNDO');
console.log('=' .repeat(40));

if (verificarSDK()) {
    console.log('');
    imprimirHolaMundo();
} else {
    console.log('\n💡 Primero instala el SDK:');
    console.log('   npm install epos');
}