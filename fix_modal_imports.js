const fs = require('fs');

function fixTab(path) {
  let content = fs.readFileSync(path, 'utf8');
  
  if (!content.includes("import CargaXmlMasivaModal")) {
    content = content.replace(
      "import { formatCurrency } from '../../../../lib/formatters';",
      "import { formatCurrency } from '../../../../lib/formatters';\nimport CargaXmlMasivaModal from './CargaXmlMasivaModal';"
    );
  }

  // fix onSuccess
  content = content.replace(/if \(typeof fetchGastos === 'function'\) fetchGastos\(\);\n\s*else if \(typeof fetchFacturas === 'function'\) fetchFacturas\(\);/g, "window.location.reload();");

  fs.writeFileSync(path, content, 'utf8');
}

fixTab('app/admin/gastos/_components/EgresosTab.tsx');
fixTab('app/admin/gastos/_components/IngresosTab.tsx');

console.log("Fixed modal imports");
