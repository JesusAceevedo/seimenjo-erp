const fs = require('fs');
const path = require('path');

const pageFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

// 1. Remove ProveedoresTab rendering
pageContent = pageContent.replace(
  /\{\/\*\s*TAB 4: PROVEEDORES\s*\*\/\}\s*\{activeTab === 'proveedores' && \(\s*<ProveedoresTab[\s\S]*?\/>\s*\)\}/g,
  ''
);

// 2. Remove import ProveedoresTab if exists
pageContent = pageContent.replace(
  /import ProveedoresTab from '\.\/_components\/ProveedoresTab';\r?\n?/g,
  ''
);

// 3. Fix categorias_gasto type in GastoFacturado
pageContent = pageContent.replace(
  /categorias_gasto\?:\s*\{\s*nombre:\s*string\s*\};/g,
  'categorias_gasto?: { id: string; nombre: string } | null;'
);

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log("Fixed page.tsx");

const bancoTabFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', '_components', 'BancoTab.tsx');
let bancoContent = fs.readFileSync(bancoTabFile, 'utf8');

// Fix tipo_movimiento === 'deposito'
bancoContent = bancoContent.replace(
  /m\.tipo_movimiento === 'deposito'/g,
  "m.tipo_movimiento === 'Deposito'"
);
// Fix tipo_movimiento === 'retiro'
bancoContent = bancoContent.replace(
  /m\.tipo_movimiento === 'retiro'/g,
  "m.tipo_movimiento === 'Retiro'"
);

fs.writeFileSync(bancoTabFile, bancoContent, 'utf8');
console.log("Fixed BancoTab.tsx");
