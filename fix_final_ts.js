const fs = require('fs');
const path = require('path');

const pageFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

// 1. Add state for categorias
if (!pageContent.includes('const [categorias, setCategorias]')) {
  pageContent = pageContent.replace(
    /const \[gastosFacturados, setGastosFacturados\] = useState<GastoFacturado\[\]>\(\[\]\);/,
    `const [gastosFacturados, setGastosFacturados] = useState<GastoFacturado[]>([]);\n  const [categorias, setCategorias] = useState<{id: string, nombre: string}[]>([]);`
  );
}

// 2. Fetch it in fetchData
const fetchLogic = `
      // Categorias
      const { data: catData } = await supabase.from('categorias_gasto').select('id, nombre');
      if (catData) setCategorias(catData);
`;
if (!pageContent.includes('setCategorias(catData)')) {
  pageContent = pageContent.replace(
    /const \{ data: proveedoresData \} = await supabase/,
    `${fetchLogic}\n      const { data: proveedoresData } = await supabase`
  );
}

// 3. Fix the prop passing
pageContent = pageContent.replace(
  /categorias=\{categoriasGasto\}/,
  `categorias={categorias}`
);

// 4. Remove onViewCfdi from BancoTab and ProveedoresTab
pageContent = pageContent.replace(
  /handleDeleteFormaPago\}\r?\n\s*onDownloadFile=\{handleDownloadFile\}\r?\n\s*onViewCfdi=\{\(xmlUrl\) => setCfdiViewerModal\(\{ open: true, xmlUrl \}\)\} \/>/,
  `handleDeleteFormaPago}\n                onDownloadFile={handleDownloadFile} />`
);

pageContent = pageContent.replace(
  /onUploadPDF=\{handleUploadProveedorPDF\}\r?\n\s*onViewCfdi=\{\(xmlUrl\) => setCfdiViewerModal\(\{ open: true, xmlUrl \}\)\} \/>/,
  `onUploadPDF={handleUploadProveedorPDF} />`
);

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log('Fixed final TS errors.');
