// print-hello.js - Script simple con notepad /p para Epson TM-T20III
const { execSync } = require('child_process');
const fs = require('fs');

// Configuración
const PRINTER_NAME = "EPSON TM-T20III Receipt";

function imprimir() {
    console.log('🖨️  Imprimiendo HOLA MUNDO con notepad /p...\n');
    
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
    console.log(`🎯 Configurando impresora: ${PRINTER_NAME}`);
    
    let impresoraPredeterminadaOriginal = null;
    
    try {
        // 1. Obtener impresora predeterminada actual
        console.log('🔍 Obteniendo impresora predeterminada actual...');
        try {
            const resultado = execSync('wmic printer where default=true get name /format:csv', { 
                encoding: 'utf8', 
                shell: true 
            });
            const lineas = resultado.split('\n').filter(linea => linea.includes(','));
            if (lineas.length > 0) {
                impresoraPredeterminadaOriginal = lineas[0].split(',')[1];
                console.log(`📌 Predeterminada actual: ${impresoraPredeterminadaOriginal}`);
            }
        } catch (error) {
            console.log('⚠️  No se pudo obtener impresora predeterminada original');
        }
        
        // 2. Establecer Epson como predeterminada
        console.log('🔄 Configurando Epson como predeterminada...');
        execSync(`wmic printer where name="${PRINTER_NAME}" call SetDefaultPrinter`, { 
            shell: true 
        });
        console.log('✅ Epson configurada como predeterminada');
        
        // 3. Imprimir con notepad /p
        console.log('🖨️  Enviando a notepad /p...');
        execSync(`notepad /p ${archivo}`, { 
            shell: true,
            stdio: 'ignore'
        });
        console.log('✅ ¡Enviado a imprimir con notepad /p!');
        
        // 4. Restaurar impresora predeterminada original
        if (impresoraPredeterminadaOriginal) {
            console.log('🔄 Restaurando impresora predeterminada original...');
            try {
                execSync(`wmic printer where name="${impresoraPredeterminadaOriginal}" call SetDefaultPrinter`, { 
                    shell: true 
                });
                console.log(`✅ Restaurada: ${impresoraPredeterminadaOriginal}`);
            } catch (error) {
                console.log('⚠️  No se pudo restaurar impresora predeterminada original');
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('💡 Soluciones:');
        console.log('   1. Ejecuta como ADMINISTRADOR');
        console.log('   2. Verifica que la impresora esté encendida');
        console.log(`   3. Verifica el nombre: "${PRINTER_NAME}"`);
        
        // Intentar restaurar predeterminada en caso de error
        if (impresoraPredeterminadaOriginal) {
            try {
                execSync(`wmic printer where name="${impresoraPredeterminadaOriginal}" call SetDefaultPrinter`, { 
                    shell: true 
                });
                console.log(`✅ Impresora predeterminada restaurada: ${impresoraPredeterminadaOriginal}`);
            } catch (restoreError) {
                console.log('⚠️  No se pudo restaurar impresora predeterminada');
            }
        }
    }
}

// Ejecutar
imprimir();