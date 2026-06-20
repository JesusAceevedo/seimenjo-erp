const fs = require('fs');

function refactorTab(filePath, typeStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Add CargaXmlMasivaModal import and UploadCloud
  if (!content.includes('CargaXmlMasivaModal')) {
    content = content.replace(
      "import { supabase } from '../../../../lib/supabase';",
      "import { supabase } from '../../../../lib/supabase';\nimport CargaXmlMasivaModal from './CargaXmlMasivaModal';"
    );
  }
  
  // Ensure UploadCloud is imported from lucide-react
  if (!content.includes('UploadCloud')) {
    content = content.replace(
      "import { ",
      "import { UploadCloud, "
    );
  }

  // 2. Add State showXmlModal
  const stateSearch = "  const [page, setPage] = useState(0);";
  if (!content.includes('const [showXmlModal')) {
    content = content.replace(
      stateSearch, 
      "  const [showXmlModal, setShowXmlModal] = useState(false);\n" + stateSearch
    );
  }

  // 3. Remove the left panel <div className="lg:col-span-1 ..."> <form> ... </form> </div>
  content = content.replace(
    /\<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full"\>/,
    '<div className="flex flex-col h-full gap-6">'
  );

  const col1Idx = content.indexOf('<div className="lg:col-span-1 bg-gray-50');
  const col2Idx = content.indexOf('<div className="lg:col-span-2 bg-white');
  if (col1Idx !== -1 && col2Idx !== -1 && col1Idx < col2Idx) {
    content = content.substring(0, col1Idx) + content.substring(col2Idx);
  }

  content = content.replace(
    /\<div className="lg:col-span-2 bg-white/g,
    '<div className="bg-white'
  );

  // 4. Inject button
  const headerSearch = '<h2 className="text-lg font-bold flex items-center gap-2">';
  if (content.includes(headerSearch) && !content.includes('showXmlModal(true)')) {
    const headerReplacement = `
    <div className="flex justify-between items-center w-full mb-4">
      <h2 className="text-lg font-bold flex items-center gap-2">
`;
    // Find the end of the h2
    const h2EndIdx = content.indexOf('</h2>', content.indexOf(headerSearch));
    if (h2EndIdx !== -1) {
      const buttonStr = `
      </h2>
      <button
        onClick={() => setShowXmlModal(true)}
        className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
      >
        <UploadCloud size={16} /> Subir Facturas
      </button>
    </div>
`;
      content = content.substring(0, h2EndIdx) + buttonStr + content.substring(h2EndIdx + 5);
    }
  }

  // 5. Inject Modal rendering at the end
  if (!content.includes('<CargaXmlMasivaModal')) {
    const modalInject = `
      {showXmlModal && (
        <CargaXmlMasivaModal
          tipo="${typeStr}"
          onClose={() => setShowXmlModal(false)}
          onSuccess={() => {
            setShowXmlModal(false);
            if (typeof fetchGastos === 'function') fetchGastos();
            else if (typeof fetchFacturas === 'function') fetchFacturas();
          }}
        />
      )}
`;
    // Find last </div> before );
    const matchEnd = content.match(/<\/div>\s*<\/div>\s*\);\s*\}\s*$/);
    if (matchEnd) {
      const endIdx = content.indexOf(matchEnd[0]);
      content = content.substring(0, endIdx) + modalInject + matchEnd[0];
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Refactored ${filePath} correctly`);
}

refactorTab('app/admin/gastos/_components/EgresosTab.tsx', 'gasto');
refactorTab('app/admin/gastos/_components/IngresosTab.tsx', 'venta');
