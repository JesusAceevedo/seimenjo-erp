const fs = require('fs');

function refactorTab(filePath, typeStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Add CargaXmlMasivaModal import and state
  if (!content.includes('CargaXmlMasivaModal')) {
    content = content.replace(
      "import { supabase } from '../../../../lib/supabase';",
      "import { supabase } from '../../../../lib/supabase';\nimport CargaXmlMasivaModal from './CargaXmlMasivaModal';"
    );
  }
  
  // Add state
  const stateSearch = "  const [mostrarFiltros, setMostrarFiltros] = useState(false);";
  if (!content.includes('const [showXmlModal')) {
    content = content.replace(stateSearch, stateSearch + "\n  const [showXmlModal, setShowXmlModal] = useState(false);");
  }

  // 2. Remove the left panel <div className="lg:col-span-1 ..."> <form> ... </form> </div>
  // We will find the top-level grid: <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
  // Change to: <div className="flex flex-col h-full gap-6">
  content = content.replace(
    /\<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full"\>/,
    '<div className="flex flex-col h-full gap-6">'
  );

  // Now we need to remove the first div which is the form.
  // It starts with `<div className="lg:col-span-1 bg-gray-50` and ends before `<div className="lg:col-span-2 bg-white`
  const col1Idx = content.indexOf('<div className="lg:col-span-1 bg-gray-50');
  const col2Idx = content.indexOf('<div className="lg:col-span-2 bg-white');
  if (col1Idx !== -1 && col2Idx !== -1 && col1Idx < col2Idx) {
    content = content.substring(0, col1Idx) + content.substring(col2Idx);
  }

  // Change <div className="lg:col-span-2 bg-white ... to remove lg:col-span-2
  content = content.replace(
    /\<div className="lg:col-span-2 bg-white/g,
    '<div className="bg-white'
  );

  // 3. Add the button to open the modal next to the Export button or Title.
  // There's a title header:
  // <h2 className="text-lg font-bold flex items-center gap-2">
  //   <FolderOpen className="text-amber-500" />
  //   {tipo === 'gasto' ? 'Registro de Gastos y Facturas' : 'Registro de Ventas Facturadas'}
  // </h2>
  // Let's add it there!
  const headerSearch = '<h2 className="text-lg font-bold flex items-center gap-2">';
  const headerButton = `
  <div className="flex items-center justify-between w-full">
    <h2 className="text-lg font-bold flex items-center gap-2">
`;
  if (content.includes(headerSearch) && !content.includes('showXmlModal')) {
    // Actually, there's usually a div wrapping it. Let's find:
    // <div className="flex justify-between items-center mb-6">
    //   <h2...
    //     ...
    //   </h2>
    //   <div className="flex gap-2">
    //     ...
    //   </div>
    // </div>
    const flexGap2 = '<div className="flex gap-2">';
    const btnToInject = `
          <button
            onClick={() => setShowXmlModal(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <UploadCloud size={16} /> Subir Facturas
          </button>
`;
    content = content.replace(flexGap2, flexGap2 + btnToInject);
  }

  // 4. Inject Modal rendering at the end of the return statement
  if (!content.includes('<CargaXmlMasivaModal')) {
    const returnEnd = '</React.Fragment>';
    const returnEnd2 = '</>';
    const modalInject = `
      {showXmlModal && (
        <CargaXmlMasivaModal
          tipo="${typeStr}"
          onClose={() => setShowXmlModal(false)}
          onSuccess={() => {
            setShowXmlModal(false);
            fetchData();
          }}
        />
      )}
`;
    if (content.includes(returnEnd)) {
      content = content.replace(returnEnd, modalInject + returnEnd);
    } else if (content.includes(returnEnd2)) {
      content = content.replace(returnEnd2, modalInject + returnEnd2);
    } else {
      // Find the last </div> before );
      const lastDivIdx = content.lastIndexOf('</div>\n    </div>\n  );\n}');
      if (lastDivIdx !== -1) {
        content = content.substring(0, lastDivIdx) + modalInject + content.substring(lastDivIdx);
      }
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Refactored ${filePath}`);
}

refactorTab('app/admin/gastos/_components/EgresosTab.tsx', 'gasto');
refactorTab('app/admin/gastos/_components/IngresosTab.tsx', 'venta');
