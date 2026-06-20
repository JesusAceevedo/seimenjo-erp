const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'actions.ts');
let content = fs.readFileSync(file, 'utf8');

// Replace standard variables to include an array of error messages
content = content.replace(
  /let agregados = 0;\r?\n\s*let actualizados = 0;\r?\n\s*let ignorados = 0;\r?\n\s*let errores = 0;/,
  `let agregados = 0;\n    let actualizados = 0;\n    let ignorados = 0;\n    let errores = 0;\n    let detallesErrores: string[] = [];`
);

// Capture update errors
content = content.replace(
  /if \(\!updErr\) actualizados\+\+; else errores\+\+;/g,
  `if (!updErr) actualizados++; else { errores++; detallesErrores.push(\`Error al actualizar UUID \${xmlData.uuid}: \${updErr.message}\`); console.error('UpdErr:', updErr); }`
);

// Capture insert errors for Gastos
content = content.replace(
  /if \(\!insErr\) agregados\+\+; else errores\+\+;(\s*)\} else \{/g,
  `if (!insErr) agregados++; else { errores++; detallesErrores.push(\`Error al insertar Gasto UUID \${xmlData.uuid}: \${insErr.message}\`); console.error('InsErrGasto:', insErr); }$1} else {`
);

// Capture insert errors for Ventas
content = content.replace(
  /if \(\!insErr\) agregados\+\+; else errores\+\+;(\s*)\}/g,
  `if (!insErr) agregados++; else { errores++; detallesErrores.push(\`Error al insertar Venta UUID \${xmlData.uuid}: \${insErr.message}\`); console.error('InsErrVenta:', insErr); }$1}`
);

// Capture catch errors
content = content.replace(
  /catch \(err\) \{\r?\n\s*console.error\('Error procesando payload masivo:', err\);\r?\n\s*errores\+\+;\r?\n\s*\}/,
  `catch (err: any) {\n        console.error('Error procesando payload masivo:', err);\n        errores++;\n        detallesErrores.push(\`Error procesando XML: \${err.message}\`);\n      }`
);

// Return them in the resumen
content = content.replace(
  /return \{ success: true, resumen: \{ agregados, actualizados, ignorados, errores \} \};/,
  `return { success: true, resumen: { agregados, actualizados, ignorados, errores, detallesErrores } };`
);

fs.writeFileSync(file, content, 'utf8');
console.log('actions.ts updated with error tracking');
