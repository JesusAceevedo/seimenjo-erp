const ts = require('typescript');
const path = require('path');
const fs = require('fs');

console.log('=== VERIFICANDO ERRORES DE TYPESCRIPT EN TODO EL PROYECTO ===\n');

const configPath = path.join(__dirname, 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) {
  console.error('Error al leer tsconfig.json:', configFile.error.messageText);
  process.exit(1);
}

const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  __dirname
);

const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
const diagnostics = ts.getPreEmitDiagnostics(program);

let errorCount = 0;

diagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    // Solo mostrar errores de nuestro código fuente (ignorar node_modules)
    const filePath = diagnostic.file.fileName;
    if (!filePath.includes('node_modules') && !filePath.includes('.next')) {
      errorCount++;
      const { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      );
      console.log(`❌ [${filePath}:${line + 1}:${character + 1}]`);
      console.log(`   Error: ${message}\n`);
    }
  }
});

if (errorCount === 0) {
  console.log('✅ ¡NINGÚN ERROR ENCONTRADO! El proyecto pasa la verificación de TypeScript al 100%.');
} else {
  console.log(`\n❌ Se encontraron ${errorCount} errores de TypeScript en total.`);
}
