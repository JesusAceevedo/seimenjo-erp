const fs = require('fs');

let content = fs.readFileSync('app/admin/gastos/page.tsx', 'utf8');

// 1. Remove ProveedoresTab import and usage
content = content.replace(/import ProveedoresTab from '\.\/_components\/ProveedoresTab';\r?\n?/g, '');
content = content.replace(/\{\/\*\s*TAB 4: PROVEEDORES\s*\*\/\}\s*\{activeTab === 'proveedores' && \(\s*<ProveedoresTab[\s\S]*?\/>\s*\)\}/g, '');

// 2. Fix GastoFacturado categorias_gasto type
content = content.replace(/categorias_gasto\?:\s*\{\s*nombre:\s*string\s*\};/g, 'categorias_gasto?: { id: string; nombre: string } | null;');

// 3. Add cuentasBancarias to useState
if (!content.includes('const [cuentasBancarias, setCuentasBancarias]')) {
  content = content.replace(
    /const \[gastosFacturados, setGastosFacturados\] = useState<GastoFacturado\[\]>\(\[\]\);/,
    `const [gastosFacturados, setGastosFacturados] = useState<GastoFacturado[]>([]);\n  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);`
  );
}

// 4. Fetch cuentasBancarias in fetchData
if (!content.includes('.from(\'cuentas_bancarias\')')) {
  content = content.replace(
    /const \{ data: dataIngresos \} = await supabase\r?\n\s*\.from\('facturas_clientes'\)/,
    `const { data: dataCuentas } = await supabase.from('cuentas_bancarias').select('*').order('nombre');\n      if (dataCuentas) setCuentasBancarias(dataCuentas);\n\n      const { data: dataIngresos } = await supabase\n        .from('facturas_clientes')`
  );
}

// 5. Pass cuentasBancarias to BancoTab
content = content.replace(
  /<BancoTab\r?\n\s*bancoSubTab=\{bancoSubTab\}\r?\n\s*setBancoSubTab=\{setBancoSubTab\}/,
  `<BancoTab\n                bancoSubTab={bancoSubTab}\n                setBancoSubTab={setBancoSubTab}\n                cuentasBancarias={cuentasBancarias}`
);

// 6. Fix EgresosTab props (Provide empty array and no-op for now)
content = content.replace(
  /<EgresosTab\r?\n\s*gastosFacturados=\{gastosFacturados\}\r?\n\s*onOpenComprobacionAcumulada/g,
  `<EgresosTab\n                gastosFacturados={gastosFacturados}\n                categorias={[]}\n                onUpdateCategoria={() => {}}\n                onOpenComprobacionAcumulada`
);

fs.writeFileSync('app/admin/gastos/page.tsx', content, 'utf8');
console.log("Built page.tsx successfully!");
