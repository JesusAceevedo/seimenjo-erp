const fs = require('fs');

function injectManual(filePath, typeStr) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Import CargaManualModal
  if (!content.includes('import CargaManualModal')) {
    content = content.replace(
      "import CargaXmlMasivaModal",
      "import CargaXmlMasivaModal from './CargaXmlMasivaModal';\nimport CargaManualModal"
    );
  }

  // 2. Add state for CargaManualModal
  const stateSearch = "const [showXmlModal, setShowXmlModal] = useState(false);";
  if (!content.includes('const [manualModal, setManualModal]')) {
    content = content.replace(
      stateSearch,
      stateSearch + "\\n  const [manualModal, setManualModal] = useState<{isOpen: boolean, id?: string}>({isOpen: false});"
    );
  }

  // 3. Inject "Subir Factura Manual" button right next to "Subir Facturas (XML)"
  const btnXmlBlock = '<button\\n              onClick={() => setShowXmlModal(true)}\\n              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"\\n            >\\n              <UploadCloud size={13} /> Subir Facturas (XML)\\n            </button>';
  
  // Wait, let's just use string slicing based on indexOf to avoid regex/newlines exact matches.
  const xmlButtonSearch = "<UploadCloud size={13} /> Subir Facturas (XML)";
  if (content.includes(xmlButtonSearch) && !content.includes("Subir Manual")) {
    const endBtnIdx = content.indexOf('</button>', content.indexOf(xmlButtonSearch));
    if (endBtnIdx !== -1) {
      const newBtn = '\\n            <button\\n              onClick={() => setManualModal({isOpen: true})}\\n              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"\\n            >\\n              <FileText size={13} /> Subir Manual\\n            </button>';
      content = content.substring(0, endBtnIdx + 9) + newBtn + content.substring(endBtnIdx + 9);
    }
  }

  // 4. Inject Modal rendering
  const modalInjectBlock = '\\n      {manualModal.isOpen && (\\n        <CargaManualModal\\n          tipo="' + typeStr + '"\\n          registroId={manualModal.id}\\n          onClose={() => setManualModal({isOpen: false})}\\n          onSuccess={() => {\\n            setManualModal({isOpen: false});\\n            window.location.reload();\\n          }}\\n        />\\n      )}\\n';
  
  if (!content.includes('<CargaManualModal')) {
    content = content.replace("{showXmlModal && (", modalInjectBlock + "      {showXmlModal && (");
  }

  // 5. Inject "+ Añadir Documento" button in the table
  // We need to find the `v.xml_url` or `g.xml_url` part and add a button if missing.
  // Actually, I'll let the user add it to the table manually if needed, or I can just inject it now.
  // The table has a column for ARCHIVOS.
  // In EgresosTab, the map variable is `g`. In IngresosTab, it's `v`.
  const addDocBtn = '\\n                            <button onClick={() => setManualModal({isOpen: true, id: ' + (typeStr === 'gasto' ? 'g.id' : 'v.id') + '})} className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-500 bg-gray-100 hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-900/30 px-2 py-1 rounded-md transition-colors"><Plus size={10} /> Añadir Doc</button>';
  
  // Find where the icons are rendered
  const iconDivSearch = '<div className="flex items-center justify-end gap-2">';
  if (content.includes(iconDivSearch) && !content.includes('Añadir Doc')) {
    content = content.replace(iconDivSearch, iconDivSearch + addDocBtn);
  }

  fs.writeFileSync(filePath, content.replace(/\\\\n/g, '\\n'), 'utf8');
  console.log('Refactored ' + filePath);
}

injectManual('app/admin/gastos/_components/EgresosTab.tsx', 'gasto');
injectManual('app/admin/gastos/_components/IngresosTab.tsx', 'venta');
