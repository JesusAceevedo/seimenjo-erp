const fs = require('fs');
const path = require('path');

// 1. Fix EgresosTab
const egresosFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', '_components', 'EgresosTab.tsx');
let egresosContent = fs.readFileSync(egresosFile, 'utf8');

if (!egresosContent.includes('Eye,')) {
   egresosContent = egresosContent.replace(
      /import\s+\{([^}]*)\}\s+from\s+['"]lucide-react['"];/,
      (match, p1) => \`import { \${p1}, Eye } from 'lucide-react';\`
   );
}

// Add onViewCfdi to destructured props
egresosContent = egresosContent.replace(
   /onDownloadFile,\r?\n\s*onAssignFactura,/,
   \`onDownloadFile,\n  onViewCfdi,\n  onAssignFactura,\`
);
// wait, my previous script tried this: egresosContent.replace(/onDownloadFile,\r?\n\s*onAssignFactura,/, `onDownloadFile,\n  onViewCfdi,\n  onAssignFactura,`)
// Let's do a more robust replace for destructured props
egresosContent = egresosContent.replace(
   /onDownloadFile,\s*onAssignFactura/,
   \`onDownloadFile, onViewCfdi, onAssignFactura\`
);

// fix g.xml_url is possibly undefined
egresosContent = egresosContent.replace(
   /onViewCfdi\(g\.xml_url\.split\('\,'\)\[0\]\)/g,
   \`onViewCfdi(g.xml_url!.split(',')[0])\`
);

fs.writeFileSync(egresosFile, egresosContent, 'utf8');

// 2. Fix IngresosTab
const ingresosFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', '_components', 'IngresosTab.tsx');
let ingresosContent = fs.readFileSync(ingresosFile, 'utf8');

if (!ingresosContent.includes('Eye,')) {
   ingresosContent = ingresosContent.replace(
      /import\s+\{([^}]*)\}\s+from\s+['"]lucide-react['"];/,
      (match, p1) => \`import { \${p1}, Eye } from 'lucide-react';\`
   );
}

ingresosContent = ingresosContent.replace(
   /onDownloadFile,\s*onAssignFactura/,
   \`onDownloadFile, onViewCfdi, onAssignFactura\`
);

ingresosContent = ingresosContent.replace(
   /onViewCfdi\(v\.xml_url\.split\('\,'\)\[0\]\)/g,
   \`onViewCfdi(v.xml_url!.split(',')[0])\`
);

fs.writeFileSync(ingresosFile, ingresosContent, 'utf8');

// 3. Fix page.tsx (BancoTab shouldn't have onViewCfdi)
const pageFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

const badBancoProps = \`<BancoTab
                bancoSubTab={bancoSubTab}
                setBancoSubTab={setBancoSubTab}
                movimientos={movimientosBancarios}
                categoriasGasto={categoriasGasto}
                formasPago={formasPago}
                isLoading={isLoading}
                onAddMovimiento={handleAddMovimiento}
                onUpdateMovimiento={handleUpdateMovimiento}
                onDeleteMovimiento={handleDeleteMovimiento}
                onAddFormaPago={handleAddFormaPago}
                onUpdateFormaPago={handleUpdateFormaPago}
                onDeleteFormaPago={handleDeleteFormaPago}
                onDownloadFile={handleDownloadFile}
                onViewCfdi={(xmlUrl) => setCfdiViewerModal({ open: true, xmlUrl })} />\`;

const goodBancoProps = \`<BancoTab
                bancoSubTab={bancoSubTab}
                setBancoSubTab={setBancoSubTab}
                movimientos={movimientosBancarios}
                categoriasGasto={categoriasGasto}
                formasPago={formasPago}
                isLoading={isLoading}
                onAddMovimiento={handleAddMovimiento}
                onUpdateMovimiento={handleUpdateMovimiento}
                onDeleteMovimiento={handleDeleteMovimiento}
                onAddFormaPago={handleAddFormaPago}
                onUpdateFormaPago={handleUpdateFormaPago}
                onDeleteFormaPago={handleDeleteFormaPago}
                onDownloadFile={handleDownloadFile} />\`;

pageContent = pageContent.replace(badBancoProps, goodBancoProps);
fs.writeFileSync(pageFile, pageContent, 'utf8');

console.log('Fixed TS Errors.');
