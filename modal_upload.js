const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

// 0. Add state
content = content.replace(
  /const \[message, setMessage\] = useState<\{ text: string; type: 'success' \| 'error' \| 'info' \} \| null>\(null\);/,
  `const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);\n  const [showUploadPanel, setShowUploadPanel] = useState<boolean>(false);`
);

// 1. Grid parent
content = content.replace(
  /<div className=\{\`grid grid-cols-1 \$\{showUploadPanel \? 'lg:grid-cols-3 gap-8' : ''\} flex-1 overflow-hidden min-h-0\`\}>/,
  `<div className="flex flex-1 overflow-hidden min-h-0 w-full">`
);
content = content.replace(
  /<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden min-h-0">/,
  `<div className="flex flex-1 overflow-hidden min-h-0 w-full gap-8">`
);

// 2. Start of upload panel
content = content.replace(
  /\{\/\* COLUMNA IZQUIERDA: PANEL DE INGESTA \*\/\}\r?\n\s*\{activeTab !== 'banco' && \(\r?\n\s*<div className="lg:col-span-1 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl space-y-6 overflow-y-auto h-full">/,
  `{/* MODAL: PANEL DE INGESTA */}\n          {showUploadPanel && (\n            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 transition-all">\n              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[95vh] overflow-y-auto text-gray-900 dark:text-gray-100 flex flex-col font-sans relative">\n                <button\n                  type="button"\n                  onClick={() => setShowUploadPanel(false)}\n                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"\n                >\n                  <X size={24} />\n                </button>`
);

// 3. End of upload panel
content = content.replace(
  /<\/form>\r?\n\s*<\/div>\r?\n\s*\)\}\r?\n\r?\n\s*\{\/\* COLUMNA DERECHA: PESTAÑAS DE VISUALIZACIÓN \*\/\}/,
  `              </form>\n              </div>\n            </div>\n          )}\n\n          {/* COLUMNA DERECHA: PESTAÑAS DE VISUALIZACIÓN */}`
);

// 4. Right column wrapper
content = content.replace(
  /<div className=\{\`\$\{\(activeTab === 'banco' \|\| activeTab === 'proveedores'\) \? 'lg:col-span-3' : 'lg:col-span-2'\} bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full\`\}>/,
  `<div className="flex-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full w-full">`
);
content = content.replace(
  /<div className=\{\`\$\{\(activeTab === 'banco'\) \? 'lg:col-span-3' : 'lg:col-span-2'\} bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full\`\}>/,
  `<div className="flex-1 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full w-full">`
);

// 5. Add Button
const targetHeader = `<div className="flex items-center gap-3">\n            <button\n              onClick={fetchData}`;
const replaceHeader = `<div className="flex items-center gap-3">\n            <button\n              onClick={() => setShowUploadPanel(true)}\n              className="p-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm flex items-center gap-2"\n              title="Ingresar factura"\n            >\n              <UploadCloud size={16} /> Ingresar Factura\n            </button>\n            <button\n              onClick={fetchData}`;
content = content.replace(targetHeader, replaceHeader);

fs.writeFileSync(file, content, 'utf8');
console.log('Upload Modal and Button script completed.');
