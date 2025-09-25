// list-printers.js - Lista las impresoras disponibles
const { spawn } = require('child_process');
const os = require('os');

async function listPrinters() {
    console.log('🖨️  Buscando impresoras disponibles...\n');
    
    try {
        if (os.platform() === 'win32') {
            // Windows - usando wmic para obtener información detallada
            const wmic = spawn('wmic', ['printer', 'get', 'Name,PortName,DriverName,Status', '/format:csv']);
            
            let output = '';
            
            wmic.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            wmic.on('close', (code) => {
                if (code === 0) {
                    parsePrinterInfo(output);
                } else {
                    console.error('❌ Error al obtener información de impresoras');
                }
            });
            
        } else {
            // Linux/Mac - usando lpstat
            const lpstat = spawn('lpstat', ['-p', '-d']);
            
            let output = '';
            
            lpstat.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            lpstat.on('close', (code) => {
                if (code === 0) {
                    parseLinuxPrinterInfo(output);
                } else {
                    console.error('❌ Error al obtener información de impresoras');
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

function parsePrinterInfo(output) {
    const lines = output.split('\n').filter(line => line.trim() !== '');
    
    console.log('📋 IMPRESORAS ENCONTRADAS:\n');
    console.log('=' .repeat(80));
    
    let printerCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 4 && parts[1].trim()) {
            printerCount++;
            
            const name = parts[2] || 'N/A';
            const port = parts[3] || 'N/A';
            const driver = parts[1] || 'N/A';
            const status = parts[4] || 'N/A';
            
            console.log(`🖨️  IMPRESORA #${printerCount}`);
            console.log(`   Nombre: ${name.trim()}`);
            console.log(`   Puerto: ${port.trim()}`);
            console.log(`   Driver: ${driver.trim()}`);
            console.log(`   Estado: ${status.trim()}`);
            
            // Detectar si es Epson TM-T20III
            if (name.toLowerCase().includes('tm-t20') || name.toLowerCase().includes('epson')) {
                console.log('   ⭐ ¡Esta parece ser tu Epson TM-T20III!');
                console.log('\n   📝 DATOS PARA EL SCRIPT DE IMPRESIÓN:');
                console.log(`   const printerName = "${name.trim()}";`);
                console.log(`   const printerPort = "${port.trim()}";`);
            }
            
            console.log('-'.repeat(50));
        }
    }
    
    if (printerCount === 0) {
        console.log('❌ No se encontraron impresoras instaladas');
    }
    
    console.log(`\n📊 Total de impresoras encontradas: ${printerCount}`);
    console.log('\n💡 Copia el nombre y puerto de tu Epson TM-T20III para usar en el siguiente script');
}

function parseLinuxPrinterInfo(output) {
    const lines = output.split('\n');
    
    console.log('📋 IMPRESORAS ENCONTRADAS:\n');
    console.log('=' .repeat(80));
    
    let printerCount = 0;
    
    lines.forEach(line => {
        if (line.startsWith('printer ')) {
            printerCount++;
            const parts = line.split(' ');
            const name = parts[1];
            const status = line.includes('enabled') ? 'Habilitada' : 'Deshabilitada';
            
            console.log(`🖨️  IMPRESORA #${printerCount}`);
            console.log(`   Nombre: ${name}`);
            console.log(`   Estado: ${status}`);
            
            if (name.toLowerCase().includes('tm-t20') || name.toLowerCase().includes('epson')) {
                console.log('   ⭐ ¡Esta parece ser tu Epson TM-T20III!');
                console.log('\n   📝 DATOS PARA EL SCRIPT DE IMPRESIÓN:');
                console.log(`   const printerName = "${name}";`);
            }
            
            console.log('-'.repeat(50));
        }
    });
    
    if (printerCount === 0) {
        console.log('❌ No se encontraron impresoras instaladas');
    }
    
    console.log(`\n📊 Total de impresoras encontradas: ${printerCount}`);
}

// Ejecutar la función
listPrinters();