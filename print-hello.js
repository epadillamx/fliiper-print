// print-hello.js - Imprime "Hola Mundo" en Epson TM-T20III
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// CONFIGURACIÓN DE LA IMPRESORA
// Cambia estos valores por los que obtuviste del script anterior
const PRINTER_NAME = "EPSON TM-T20III Receipt"; // Nombre exacto de tu impresora
const PRINTER_PORT = "USB001"; // Puerto de tu impresora

async function printHelloWorld() {
    console.log('🖨️  Enviando "Hola Mundo" a la impresora Epson TM-T20III...\n');
    
    try {
        // Crear el contenido a imprimir con comandos ESC/POS
        const printContent = createPrintContent();
        
        // Crear archivo temporal
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `print_${Date.now()}.txt`);
        
        // Escribir contenido al archivo temporal
        fs.writeFileSync(tempFile, printContent, 'utf8');
        
        console.log(`📄 Archivo temporal creado: ${tempFile}`);
        console.log(`🎯 Enviando a impresora: ${PRINTER_NAME}`);
        console.log(`🔌 Puerto: ${PRINTER_PORT}\n`);
        
        // Enviar a imprimir usando el comando print de Windows
        const printProcess = spawn('print', [`/D:${PRINTER_NAME}`, tempFile], {
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let error = '';
        
        printProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        printProcess.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        printProcess.on('close', (code) => {
            // Limpiar archivo temporal
            try {
                fs.unlinkSync(tempFile);
            } catch (err) {
                console.log('⚠️  No se pudo eliminar archivo temporal');
            }
            
            if (code === 0) {
                console.log('✅ ¡Impresión enviada correctamente!');
                console.log('📝 Contenido impreso:');
                console.log('   ================================');
                console.log('          HOLA MUNDO');
                console.log('     Impreso desde Node.js');
                console.log('   ================================');
                console.log(`   Fecha: ${new Date().toLocaleString()}`);
                console.log('   ================================\n');
            } else {
                console.error('❌ Error en la impresión:');
                console.error(`   Código de salida: ${code}`);
                if (error) {
                    console.error(`   Error: ${error}`);
                }
                console.log('\n💡 Verifica que:');
                console.log('   - La impresora esté encendida y conectada');
                console.log('   - El nombre de la impresora sea correcto');
                console.log('   - No haya atascos de papel');
            }
        });
        
        printProcess.on('error', (err) => {
            console.error('❌ Error al ejecutar comando de impresión:', err.message);
            
            // Limpiar archivo temporal en caso de error
            try {
                fs.unlinkSync(tempFile);
            } catch (cleanupErr) {
                // Ignorar error de limpieza
            }
        });
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

function createPrintContent() {
    // Crear contenido con formato para impresora de tickets
    const fecha = new Date().toLocaleString();
    
    const content = `
================================
          HOLA MUNDO
     Impreso desde Node.js
================================

🚀 ¡Funciona perfectamente!
📅 Fecha: ${fecha}
🖨️  Impresora: ${PRINTER_NAME}
🔌 Puerto: ${PRINTER_PORT}

--------------------------------
   Prueba de impresión exitosa
--------------------------------


`;
    
    return content;
}

// Función para verificar si la impresora está disponible
function checkPrinter() {
    console.log('🔍 Verificando disponibilidad de la impresora...\n');
    
    const wmic = spawn('wmic', ['printer', 'where', `name="${PRINTER_NAME}"`, 'get', 'Name,Status'], {
        shell: true
    });
    
    let output = '';
    
    wmic.stdout.on('data', (data) => {
        output += data.toString();
    });
    
    wmic.on('close', (code) => {
        if (code === 0 && output.includes(PRINTER_NAME)) {
            console.log('✅ Impresora encontrada y disponible');
            printHelloWorld();
        } else {
            console.error('❌ Impresora no encontrada o no disponible');
            console.log('\n💡 Ejecuta primero list-printers.js para obtener el nombre correcto');
        }
    });
    
    wmic.on('error', (err) => {
        console.log('⚠️  No se pudo verificar la impresora, intentando imprimir de todos modos...');
        printHelloWorld();
    });
}

// Ejecutar
console.log('🖨️  SCRIPT DE IMPRESIÓN EPSON TM-T20III');
console.log('======================================\n');

checkPrinter();