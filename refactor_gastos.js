const fs = require('fs');

const pagePath = 'app/admin/gastos/page.tsx';
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Remove proveedores from activeTab state
content = content.replace(
  /useState\<'egresos' \| 'ingresos' \| 'banco' \| 'proveedores'\>\('egresos'\)/g,
  "useState<'egresos' | 'ingresos' | 'banco'>('egresos')"
);

// 2. Remove the Proveedores button
const btnSearch = `<button
                onClick={() => setActiveTab('proveedores')}
                className={\`flex-1 py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 \${activeTab === 'proveedores'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }\`}
              >
                <Truck size={18} /> Proveedores
              </button>`;
content = content.replace(btnSearch, "");

// 3. Update grid col width
content = content.replace(
  /activeTab === 'banco' \|\| activeTab === 'proveedores'/g,
  "activeTab === 'banco'"
);

// 4. Remove the Proveedores tab render block
// Let's find exactly `{activeTab === 'proveedores' && (`
// And then slice until we hit the `</div>` that closes it.
// The easiest is just using `indexOf` and matching braces.
const provIdx = content.indexOf("{activeTab === 'proveedores' && (");
if (provIdx !== -1) {
  let openBraces = 0;
  let endIdx = provIdx;
  for (let i = provIdx; i < content.length; i++) {
    if (content[i] === '{') openBraces++;
    if (content[i] === '}') {
      openBraces--;
      if (openBraces === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  content = content.substring(0, provIdx) + content.substring(endIdx);
}

// 5. Update bancoSubTab
content = content.replace(
  /useState\<'movimientos' \| 'global' \| 'catalogo' \| 'formas_pago'\>\('movimientos'\)/g,
  "useState<'movimientos' | 'global'>('movimientos')"
);

fs.writeFileSync(pagePath, content, 'utf8');
console.log("Gastos page.tsx refactored successfully with accurate brace matching");
