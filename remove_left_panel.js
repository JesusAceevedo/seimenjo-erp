const fs = require('fs');

const path = 'app/admin/gastos/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Change the column span for the right panel to be always lg:col-span-3
content = content.replace(
  /\<div className\=\{\`\$\{\(activeTab \=\=\= 'banco'\) \? 'lg:col-span-3' : 'lg:col-span-2'\}\s+bg-white/g,
  '<div className={`lg:col-span-3 bg-white'
);

// 2. Remove the left panel: {activeTab !== 'banco' && ( ... )}
// The left panel starts around line 1469 with {/* COLUMNA IZQUIERDA: PANEL DE INGESTA */}
const searchStr = "{/* COLUMNA IZQUIERDA: PANEL DE INGESTA */}";
const startIdx = content.indexOf(searchStr);

if (startIdx !== -1) {
  // Let's find the closing brace for the left panel.
  // It's followed by {/* COLUMNA DERECHA: PESTAÑAS DE VISUALIZACIÓN */}
  const endSearchStr = "{/* COLUMNA DERECHA:";
  const endIdx = content.indexOf(endSearchStr, startIdx);
  
  if (endIdx !== -1) {
    content = content.substring(0, startIdx) + content.substring(endIdx);
  }
}

fs.writeFileSync(path, content, 'utf8');
console.log("Left panel removed and columns updated");
