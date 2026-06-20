const fs = require('fs');
const path = require('path');

const targetPath = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add cuentasBancarias state
const searchState = `const [movimientos, setMovimientos] = useState<any[]>([]);`;
if (content.includes(searchState) && !content.includes('const [cuentasBancarias')) {
  content = content.replace(
    searchState,
    `${searchState}\n  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);`
  );
}

// 2. Add fetch logic
const searchFetch = `      setFormasPago(fpData || []);`;
if (content.includes(searchFetch) && !content.includes('from(\'cuentas_bancarias\')')) {
  content = content.replace(
    searchFetch,
    `${searchFetch}\n\n      // 12. Cuentas Bancarias\n      const { data: ctasData } = await supabase\n        .from('cuentas_bancarias')\n        .select('*')\n        .order('nombre', { ascending: true });\n      setCuentasBancarias(ctasData || []);`
  );
}

// 3. Add to BancoTab props
const searchBancoTab = `<BancoTab
                  bancoSubTab={bancoSubTab}`;
if (content.includes(searchBancoTab) && !content.includes('cuentasBancarias={cuentasBancarias}')) {
  content = content.replace(
    searchBancoTab,
    `<BancoTab\n                  cuentasBancarias={cuentasBancarias}\n                  bancoSubTab={bancoSubTab}`
  );
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Added cuentasBancarias successfully.');
