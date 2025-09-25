// print-hello.js - Imprime "Hola Mundo" en Epson TM-T20III usando comandos ESC/POS
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// CONFIGURACIÓN DE LA IMPRESORA
// Cambia estos valores por los que obtuviste del script anterior
const PRINTER_NAME = "EPSON TM-T20III Receipt"; // Nombre exacto de tu impresora
const PRINTER_PORT = "USB001"; // Puerto de tu impresora

async function printHelloWorld() {
    console.log('🖨️  Enviando "Hola Mundo" a la impresora Epson TM-T20III...\n');
    
    try {
        // Crear comandos ESC/POS para impresora térmica
        const escpos = createESCPOSCommands();
        
        // Crear archivo temporal con datos binarios
        const tempFile = path.join(__dirname, 'print_temp.prn');
        
        // Escribir comandos ESC/POS como buffer binario
        fs.writeFileSync(tempFile, Buffer.from(escpos));
        
        console.log(`📄 Archivo temporal creado: ${tempFile}`);
        console.log(`🎯 Enviando a impresora: ${PRINTER_NAME}`);
        console.log(`🔌 Puerto: ${PRINTER_PORT}\n`);
        
        // Enviar archivo directamente al puerto de la impresora
        try {
            // Método 1: Copiar archivo directamente al puerto
            execSync(`copy "${tempFile}" "${PRINTER_PORT}" /B`, { shell: true });
            
            console.log('✅ ¡Impresión enviada correctamente!');
            console.log('📝 Comandos ESC/POS enviados:');
            console.log('   - Inicialización de impresora');
            console.log('   - Texto centrado: HOLA MUNDO');
            console.log('   - Información de fecha y hora');
            console.log('   - Corte automático de papel');
            
        } catch (copyError) {
            console.log('⚠️  Método directo falló, intentando con PowerShell...');
            
            // Método 2: Usar PowerShell para enviar datos binarios
            const powershellCommand = `
                $data = [System.IO.File]::ReadAllBytes('${tempFile}')
                $port = new-Object System.IO.Ports.SerialPort '${PRINTER_PORT}',9600,None,8,one
                $port.Open()
                $port.Write($data, 0, $data.Length)
                $port.Close()
            `;
            
            execSync(`powershell -Command "${powershellCommand}"`, { shell: true });
            console.log('✅ ¡Impresión enviada con PowerShell!');
        }
        
        // Limpiar archivo temporal
        setTimeout(() => {
            try {
                fs.unlinkSync(tempFile);
                console.log('🧹 Archivo temporal eliminado');
            } catch (err) {
                console.log('⚠️  No se pudo eliminar archivo temporal');
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error en la impresión:', error.message);
        console.log('\n💡 Soluciones posibles:');
        console.log('   1. Verifica que la impresora esté encendida');
        console.log('   2. Verifica que el puerto sea correcto (USB001, COM1, etc.)');
        console.log('   3. Intenta ejecutar como administrador');
        console.log('   4. Verifica que no haya otros programas usando la impresora');
    }
}

function createESCPOSCommands() {
    // Comandos ESC/POS para Epson TM-T20III
    const ESC = 0x1B;
    const GS = 0x1D;
    const LF = 0x0A;
    const CR = 0x0D;
    
    const commands = [];
    
    // Inicializar impresora
    commands.push(ESC, 0x40);
    
    // Configurar codificación
    commands.push(ESC, 0x74, 0x13); // Codificación Windows-1252
    
    // Centrar texto
    commands.push(ESC, 0x61, 0x01);
    
    // Texto en negrita
    commands.push(ESC, 0x45, 0x01);
    
    // Título grande
    commands.push(GS, 0x21, 0x11); // Doble tamaño
    const titulo = "HOLA MUNDO";
    for (let i = 0; i < titulo.length; i++) {
        commands.push(titulo.charCodeAt(i));
    }
    commands.push(LF, LF);
    
    // Resetear tamaño
    commands.push(GS, 0x21, 0x00);
    
    // Subtítulo
    const subtitulo = "Impreso desde Node.js";
    for (let i = 0; i < subtitulo.length; i++) {
        commands.push(subtitulo.charCodeAt(i));
    }
    commands.push(LF, LF);
    
    // Línea separadora
    commands.push(ESC, 0x45, 0x00); // Quitar negrita
    const linea = "================================";
    for (let i = 0; i < linea.length; i++) {
        commands.push(linea.charCodeAt(i));
    }
    commands.push(LF);
    
    // Fecha y hora
    const fecha = new Date().toLocaleString();
    const fechaTexto = `Fecha: ${fecha}`;
    for (let i = 0; i < fechaTexto.length; i++) {
        commands.push(fechaTexto.charCodeAt(i));
    }
    commands.push(LF);
    
    // Información de impresora
    const printerInfo = `Impresora: ${PRINTER_NAME}`;
    for (let i = 0; i < printerInfo.length; i++) {
        commands.push(printerInfo.charCodeAt(i));
    }
    commands.push(LF);
    
    // Puerto
    const portInfo = `Puerto: ${PRINTER_PORT}`;
    for (let i = 0; i < portInfo.length; i++) {
        commands.push(portInfo.charCodeAt(i));
    }
    commands.push(LF);
    
    // Línea separadora final
    for (let i = 0; i < linea.length; i++) {
        commands.push(linea.charCodeAt(i));
    }
    commands.push(LF, LF, LF);
    
    // Cortar papel
    commands.push(GS, 0x56, 0x41, 0x03);
    
    return commands;
}

// Función para verificar si la impresora está disponible
function checkPrinter() {
    console.log('🔍 Verificando disponibilidad de la impresora...\n');
    
    try {
        const result = execSync(`wmic printer where "name='${PRINTER_NAME}'" get Name,Status /format:csv`, { 
            encoding: 'utf8',
            timeout: 5000 
        });
        
        if (result.includes(PRINTER_NAME)) {
            console.log('✅ Impresora encontrada y disponible');
            printHelloWorld();
        } else {
            console.error('❌ Impresora no encontrada');
            console.log('\n💡 Ejecuta primero list-printers.js para obtener el nombre correcto');
            console.log(`💡 Nombre actual configurado: "${PRINTER_NAME}"`);
        }
    } catch (error) {
        console.log('⚠️  No se pudo verificar la impresora, intentando imprimir de todos modos...');
        printHelloWorld();
    }
}

// Ejecutar
console.log('🖨️  SCRIPT DE IMPRESIÓN EPSON TM-T20III');
console.log('======================================\n');

checkPrinter();