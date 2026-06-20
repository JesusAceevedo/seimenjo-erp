const fs = require('fs');

const tabPath = 'app/admin/gastos/_components/BancoTab.tsx';
let content = fs.readFileSync(tabPath, 'utf8');

// 1. Update BancoTabProps
content = content.replace(
  /bancoSubTab: 'movimientos' \| 'global' \| 'catalogo' \| 'formas_pago';/,
  "bancoSubTab: 'movimientos' | 'global';"
);
content = content.replace(
  /setBancoSubTab: \(sub: 'movimientos' \| 'global' \| 'catalogo' \| 'formas_pago'\) \=\> void;/,
  "setBancoSubTab: (sub: 'movimientos' | 'global') => void;"
);

// 2. Remove the buttons for Catalogo and Formas Pago
content = content.replace(
  /\{ key: 'catalogo', label: 'Catálogo de Estatus', icon: \<Settings size=\{14\} \/\> \},/g,
  ""
);
content = content.replace(
  /\{ key: 'formas_pago', label: 'Formas de Pago', icon: \<CreditCard size=\{14\} \/\> \},/g,
  ""
);

// 3. Remove the blocks {bancoSubTab === 'catalogo' && (...)}
// Because it's hard to regex nested braces accurately, I'll use a simpler script that splits by {bancoSubTab === 'catalogo' && ( and deletes until the next major block or end of file.
// Actually, they are at the end of the component.
// Let's just find the start of catalogo and the end of the file.
// Wait, we need to keep the closing `</div>` for the main component.

const catalogoIndex = content.indexOf("{bancoSubTab === 'catalogo'");
if (catalogoIndex !== -1) {
  // Let's find the very last </div></div>); }
  const matchEnd = content.match(/<\/div>\s*<\/div>\s*\);\s*\}\s*$/);
  if (matchEnd) {
    content = content.substring(0, catalogoIndex) + matchEnd[0];
  }
}

fs.writeFileSync(tabPath, content, 'utf8');
console.log("BancoTab.tsx refactored successfully");
