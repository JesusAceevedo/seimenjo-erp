const fs = require('fs');

// 1. FIX CargaManualModal.tsx
let modalPath = 'app/admin/gastos/_components/CargaManualModal.tsx';
let modalContent = fs.readFileSync(modalPath, 'utf8');

// Replace the bad template literals in className
modalContent = modalContent.replace(
  /className\=\{\\\`px-3 py-1 rounded-md text-xs font-semibold transition-all \\\$\{[^\}]+\}\\\`\}/g,
  "className={'px-3 py-1 rounded-md text-xs font-semibold transition-all ' + (fileMode[type] === 'upload' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700')}"
);
modalContent = modalContent.replace(
  /className\=\{\\\`px-3 py-1 rounded-md text-xs font-semibold transition-all \\\$\{[^\}]+\}\\\`\}/g,
  "className={'px-3 py-1 rounded-md text-xs font-semibold transition-all ' + (fileMode[type] === 'link' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700')}"
);
// wait, the regex might not match if it has already been messed up.
// Let's just fix it manually:
const target1 = "className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${fileMode[type] === 'upload' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}";
const target2 = "className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${fileMode[type] === 'link' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'}`}";

modalContent = modalContent.replace(target1, "className={'px-3 py-1 rounded-md text-xs font-semibold transition-all ' + (fileMode[type] === 'upload' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700')}");
modalContent = modalContent.replace(target2, "className={'px-3 py-1 rounded-md text-xs font-semibold transition-all ' + (fileMode[type] === 'link' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700')}");

fs.writeFileSync(modalPath, modalContent, 'utf8');

// 2. INJECT TABS
function injectTab(filePath, typeStr, originalFn) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Import
  if (!content.includes('CargaManualModal')) {
    content = content.replace(
      "import CargaXmlMasivaModal from './CargaXmlMasivaModal';",
      "import CargaXmlMasivaModal from './CargaXmlMasivaModal';\nimport CargaManualModal from './CargaManualModal';"
    );
  }

  // State
  if (!content.includes('manualModal')) {
    content = content.replace(
      "const [showXmlModal, setShowXmlModal] = useState(false);",
      "const [showXmlModal, setShowXmlModal] = useState(false);\n  const [manualModal, setManualModal] = useState<{isOpen: boolean, id?: string}>({isOpen: false});"
    );
  }

  // Button
  const btnXml = `<button
            onClick={() => setShowXmlModal(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <UploadCloud size={16} /> Subir Facturas
          </button>`;
  
  const manualBtn = `<button
            onClick={() => setManualModal({isOpen: true})}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <FileText size={16} /> Carga Manual
          </button>`;

  if (content.includes(btnXml) && !content.includes('Carga Manual')) {
    content = content.replace(btnXml, btnXml + "\n          " + manualBtn);
  }

  // Modal
  const modalRender = `
      {manualModal.isOpen && (
        <CargaManualModal
          tipo="${typeStr}"
          registroId={manualModal.id}
          onClose={() => setManualModal({isOpen: false})}
          onSuccess={() => {
            setManualModal({isOpen: false});
            window.location.reload();
          }}
        />
      )}`;
  if (!content.includes('CargaManualModal tipo')) {
    content = content.replace("{showXmlModal && (", modalRender + "\n      {showXmlModal && (");
  }

  // Row Action Button
  const tableActionsSearch = `<div className="flex items-center justify-end gap-2">`;
  const rowBtn = `<button onClick={() => setManualModal({isOpen: true, id: ${typeStr === 'gasto' ? 'g.id' : 'v.id'}})} className="text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 p-1.5 rounded-lg transition-colors" title="Añadir Documentos Faltantes"><Plus size={14}/></button>`;
  
  if (content.includes(tableActionsSearch) && !content.includes('Añadir Documentos Faltantes')) {
    content = content.replace(tableActionsSearch, tableActionsSearch + "\n                              " + rowBtn);
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

injectTab('app/admin/gastos/_components/EgresosTab.tsx', 'gasto', 'onOpenComprobacionAcumulada');
injectTab('app/admin/gastos/_components/IngresosTab.tsx', 'venta', 'onOpenFacturacionAcumulada');

console.log("All fixed");
