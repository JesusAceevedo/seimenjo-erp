const fs = require('fs');

// Fix BancoTab.tsx
const tabPath = 'app/admin/gastos/_components/BancoTab.tsx';
let tabContent = fs.readFileSync(tabPath, 'utf8');

tabContent = tabContent.replace(
  /bancoSubTab: 'movimientos' \| 'global' \| 'catalogo' \| 'formas_pago';/,
  "bancoSubTab: 'movimientos' | 'global';"
);
tabContent = tabContent.replace(
  /setBancoSubTab: \(sub: 'movimientos' \| 'global' \| 'catalogo' \| 'formas_pago'\) \=\> void;/,
  "setBancoSubTab: (sub: 'movimientos' | 'global') => void;"
);

// We know {bancoSubTab === 'catalogo' is around line 609. Let's just remove everything from {bancoSubTab === 'catalogo' until the end of the file except the last </div></div>); }
const catIdx = tabContent.indexOf("{bancoSubTab === 'catalogo'");
if (catIdx !== -1) {
  const matchEnd = tabContent.match(/<\/div>\s*<\/div>\s*\);\s*\}\s*$/);
  if (matchEnd) {
    tabContent = tabContent.substring(0, catIdx) + matchEnd[0];
  }
}

// Remove formas pago from the button list. The array is probably hardcoded.
// Something like: { key: 'formas_pago', ...
tabContent = tabContent.replace(/\{\s*key:\s*'catalogo'[\s\S]*?\},\s*/g, "");
tabContent = tabContent.replace(/\{\s*key:\s*'formas_pago'[\s\S]*?\},\s*/g, "");

fs.writeFileSync(tabPath, tabContent, 'utf8');

// Fix page.tsx
const pagePath = 'app/admin/gastos/page.tsx';
let pageContent = fs.readFileSync(pagePath, 'utf8');

// The button for proveedores is probably still there. Let's find it.
const btnIdx = pageContent.indexOf("onClick={() => setActiveTab('proveedores')}");
if (btnIdx !== -1) {
  // Let's find the <button tag before it
  const startIdx = pageContent.lastIndexOf("<button", btnIdx);
  // Let's find the </button> tag after it
  const endIdx = pageContent.indexOf("</button>", btnIdx) + 9;
  
  if (startIdx !== -1 && endIdx !== -1) {
    pageContent = pageContent.substring(0, startIdx) + pageContent.substring(endIdx);
  }
}

fs.writeFileSync(pagePath, pageContent, 'utf8');

console.log("BancoTab and Page fixed");
