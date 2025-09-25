// print-hello.js - Script simple para imprimir en Epson TM-T20III
const { execSync } = require('child_process');
const fs = require('fs');

// Configuración
const PRINTER_NAME = "EPSON TM-T20III Receipt";

function imprimir() {
    console.log('🖨️  Imprimiendo HOLA MUNDO...\n');
    
    // Crear contenido simple para 88mm con centrado perfecto
    const ancho = 42; // Ancho real disponible para texto (sin márgenes)
    
    // Función para centrar texto perfectamente
    function centrar(texto) {
        if (texto.length >= ancho) return texto.substring(0, ancho);
        const espacios = Math.floor((ancho - texto.length) / 2);
        return ' '.repeat(espacios) + texto;
    }
    
    const separador = '='.repeat(ancho);
    const separadorCorto = '-'.repeat(ancho);
    
    const contenido = `${separador}
${centrar('HOLA MUNDO')}
${centrar('Desde Node.js 22')}
${separador}

Fecha: ${new Date().toLocaleString()}

Impresora: EPSON TM-T20III Receipt
Papel: 88mm

${separadorCorto}
${centrar('¡Funciona perfectamente!')}
${separadorCorto}


`;
    
    // Guardar archivo
    const archivo = 'ticket.txt';
    fs.writeFileSync(archivo, contenido, 'utf8');
    
    console.log(`📄 Archivo creado: ${archivo}`);
    
    try {
        // Imprimir especificando la impresora exacta
        execSync(`print /D:"${PRINTER_NAME}" ${archivo}`, { shell: true });
        console.log(`✅ ¡Enviado a ${PRINTER_NAME}!`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('💡 Verifica que la impresora esté encendida');
        console.log(`💡 Nombre de impresora: ${PRINTER_NAME}`);
    }
}

// Ejecutar
imprimir();