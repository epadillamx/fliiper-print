// print-hello.js - Script simple para imprimir en Epson TM-T20III
const { execSync } = require('child_process');
const fs = require('fs');

// Configuración
const PRINTER_NAME = "EPSON TM-T20III Receipt";

function imprimir() {
    console.log('🖨️  Imprimiendo HOLA MUNDO...\n');
    
    // Crear contenido simple para 88mm (48 caracteres)
    const contenido = `================================================
                  HOLA MUNDO                   
              Desde Node.js 22               
================================================

Fecha: ${new Date().toLocaleString()}

Impresora: EPSON TM-T20III Receipt
Papel: 88mm

================================
      ¡Funciona perfectamente!      
================================


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