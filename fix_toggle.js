const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add state
content = content.replace(
  /const \[message, setMessage\] = useState<\{ text: string; type: 'success' \| 'error' \| 'info' \} \| null>\(null\);/,
  `const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);\n  const [showUploadPanel, setShowUploadPanel] = useState<boolean>(false);`
);

// 2. Add header button
const targetHeader = `<div className="flex items-center gap-3">\n            <button\n              onClick={fetchData}`;
const replaceHeader = `<div className="flex items-center gap-3">\n            <button\n              onClick={() => setShowUploadPanel(!showUploadPanel)}\n              className={\`p-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2 \${showUploadPanel ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}\`}\n              title="Ingresar factura"\n            >\n              <UploadCloud size={16} /> \n              {showUploadPanel ? 'Ocultar Carga' : 'Ingresar Factura'}\n            </button>\n            <button\n              onClick={fetchData}`;
content = content.replace(targetHeader, replaceHeader);

// 3. Grid wrapper
const targetGrid = `<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden min-h-0">`;
const replaceGrid = `<div className={\`grid grid-cols-1 \${showUploadPanel ? 'lg:grid-cols-3 gap-8' : ''} flex-1 overflow-hidden min-h-0\`}>`;
content = content.replace(targetGrid, replaceGrid);

// 4. Panel display
const targetPanel = `{/* COLUMNA IZQUIERDA: PANEL DE INGESTA */}\n          {activeTab !== 'banco' && (`;
const replacePanel = `{/* COLUMNA IZQUIERDA: PANEL DE INGESTA */}\n          {activeTab !== 'banco' && showUploadPanel && (`;
content = content.replace(targetPanel, replacePanel);

// 5. Right Col Span
const targetRightCol = `<div className={\`\${(activeTab === 'banco' ) ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full\`}>`;
const replaceRightCol = `<div className={\`\${(activeTab === 'banco' || !showUploadPanel) ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full\`}>`;
content = content.replace(targetRightCol, replaceRightCol);

fs.writeFileSync(file, content, 'utf8');
console.log('Toggle Upload Form completed.');
