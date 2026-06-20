const fs = require('fs');
const path = require('path');

const targetPath = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Step 1: Update the useState for activeTab
content = content.replace(
  /const \[activeTab, setActiveTab\] = useState<'egresos' \| 'ingresos' \| 'banco' \| 'proveedores'>\('egresos'\);/g,
  "const [activeTab, setActiveTab] = useState<'carga' | 'egresos' | 'ingresos' | 'banco'>('carga');"
);

// Step 2: Extract the form / panel de ingesta contents
const startMarker = `          {/* COLUMNA IZQUIERDA: PANEL DE INGESTA */}`;
const endMarker = `          {/* COLUMNA DERECHA: PESTAÑAS DE VISUALIZACIÓN */}`;

const idxStart = content.indexOf(startMarker);
const idxEnd = content.indexOf(endMarker);

if (idxStart === -1 || idxEnd === -1) {
  console.error("Could not find Panel de Ingesta boundaries.");
  process.exit(1);
}

// The string between startMarker and endMarker looks like:
// {activeTab !== 'banco' && (
//   <div className="lg:col-span-1 ...">
//      ...
//   </div>
// )}
// Let's just grab the whole thing and replace the wrapper conditions.
let panelContent = content.substring(idxStart + startMarker.length, idxEnd);

// We need to unwrap it from `{activeTab !== 'banco' && (` and `)}`
const unwrapStart = panelContent.indexOf('{activeTab !== \'banco\' && (');
const unwrapEnd = panelContent.lastIndexOf(')}');

if (unwrapStart !== -1 && unwrapEnd !== -1) {
  panelContent = panelContent.substring(unwrapStart + "{activeTab !== 'banco' && (".length, unwrapEnd);
}

// Step 3: Replace the layout container
const layoutStartStr = `<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden min-h-0">`;
const idxLayoutStart = content.indexOf(layoutStartStr);

const beforeLayout = content.substring(0, idxLayoutStart);
const afterTabsStart = content.substring(idxEnd);

const newLayoutHeader = `<div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full">

`;

content = beforeLayout + newLayoutHeader + afterTabsStart;

// Step 4: Update the tabs buttons
const tabsStrStart = `{/* PESTAÑAS */}`;
const tabsStrEnd = `{/* TAB 1: EGRESOS */}`;
const idxTabsStart = content.indexOf(tabsStrStart);
const idxTabsEnd = content.indexOf(tabsStrEnd, idxTabsStart);

const oldTabsStr = content.substring(idxTabsStart, idxTabsEnd);
let newTabsStr = oldTabsStr.replace(
  /<button\s+onClick=\{\(\) => setActiveTab\('proveedores'\)\}[\s\S]*?<\/button>/,
  ""
);

const newCargaTabStr = `<button
                onClick={() => setActiveTab('carga')}
                className={\`flex-1 py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 \${activeTab === 'carga'
                    ? 'border-purple-500 text-purple-500'
                    : 'border-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }\`}
              >
                <UploadCloud size={16} /> Carga de Facturas
              </button>
              `;

newTabsStr = newTabsStr.replace(
  /<div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50\/50 dark:bg-gray-900\/30">\s*<button/,
  `<div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">\n              ${newCargaTabStr}<button`
);

content = content.replace(oldTabsStr, newTabsStr);

// Step 5: Insert the Carga Tab content
const idxEgresosTab = content.indexOf('{/* TAB 1: EGRESOS */}');
const cargaContent = `
            {/* TAB 0: CARGA DE FACTURAS */}
            {activeTab === 'carga' && (
              <div className="p-6 overflow-y-auto h-full flex justify-center">
                <div className="w-full max-w-2xl space-y-6">
${panelContent}
                </div>
              </div>
            )}

            `;

content = content.slice(0, idxEgresosTab) + cargaContent + content.slice(idxEgresosTab);

// Step 6: Remove Proveedores Tab rendering
content = content.replace(/{\/\* TAB 4: PROVEEDORES \*\/}[\s\S]*?<\/ProveedoresTab>\s*\)\s*}/, "");

// Step 7: The wrapper div we added "flex-1 flex flex-col..." and "bg-white..." needs to be closed at the end of the tabs.
// We replaced `<div className="grid...` with `<div class... flex-1...><div class... bg-white...>` (2 divs).
// We deleted `          </div>\n\n          {/* COLUMNA DERECHA...` which had `<div className={...}>`. So the total number of closing divs is still correct (we replaced 2 divs with 2 divs). Wait.
// Original:
// <div grid>
//   <div col-1>...</div>
//   <div col-2>...</div>
// </div>
// New:
// <div flex-1>
//   <div bg-white>...</div>
// </div>
// In the original, the right column div was closed at the very end. The grid div was also closed.
// So yes, it perfectly matches 2 closing divs.
// But let's check `idxEnd`. `idxEnd` was pointing to `{/* COLUMNA DERECHA...`. We sliced from `afterTabsStart` which includes the right column div `<div className={\`\${(activeTab === 'banco'...`. 
// WAIT! If we include `afterTabsStart`, it still has the `<div className={\`\${(activeTab === 'banco' || activeTab === 'proveedores') ? 'lg:col-span-3' : 'lg:col-span-2'}`.
// Let's remove that div declaration, we don't need it. We already provided `newLayoutHeader`.

// Let's do a better replace for Step 7:
const rightColumnStart = "          {/* COLUMNA DERECHA: PESTAÑAS DE VISUALIZACIÓN */}";
const rightColumnDivMatch = /<div className=\{`\$\{\(activeTab === 'banco' \|\| activeTab === 'proveedores'\) \? 'lg:col-span-3' : 'lg:col-span-2'\} bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full`\}>/;

content = content.replace(rightColumnStart, "");
content = content.replace(rightColumnDivMatch, "");


// Write back
fs.writeFileSync(targetPath, content, 'utf8');
console.log("File updated successfully.");
