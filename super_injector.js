const fs = require('fs');

function inject(file, typeStr) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Import
  if (!content.includes('CargaManualModal')) {
    content = content.replace("import CargaXmlMasivaModal from './CargaXmlMasivaModal';", "import CargaXmlMasivaModal from './CargaXmlMasivaModal';\nimport CargaManualModal from './CargaManualModal';");
  }

  // 2. State
  if (!content.includes('manualModal')) {
    content = content.replace("const [showXmlModal, setShowXmlModal] = useState(false);", "const [showXmlModal, setShowXmlModal] = useState(false);\n  const [manualModal, setManualModal] = useState<{isOpen: boolean, id?: string}>({isOpen: false});");
  }

  // 3. Modal Render
  const modalStr = `
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
  if (!content.includes('tipo="' + typeStr + '"')) {
    content = content.replace("{showXmlModal && (", modalStr + "\n      {showXmlModal && (");
  }

  // 4. Row button
  const rowBtn = `\n                            <button onClick={() => setManualModal({isOpen: true, id: ${typeStr === 'gasto' ? 'g.id' : 'v.id'}})} className="text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 p-1.5 rounded-lg transition-colors" title="Añadir Documentos Faltantes"><Plus size={14}/></button>`;
  if (!content.includes('Añadir Documentos Faltantes')) {
    content = content.replace(/<div className="flex items-center justify-end gap-2">/g, '<div className="flex items-center justify-end gap-2">' + rowBtn);
  }

  // 5. Header buttons!
  // I'll find `<div className="flex items-center gap-2">\n            <span className="text-xs font-semibold`
  // and completely replace the rest of the flex-wrap div manually.
  
  // Let's use regex to grab the block:
  // It starts with `          <div className="flex gap-2">` or `<button\n            onClick={onOpenComprobacionAcumulada}`
  // In the raw file (after git checkout), the block looks like:
  /*
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            ...
          </div>
          <button
            onClick={onOpenComprobacionAcumulada}
            className="..."
          >
            <Plus size={13} /> Comprobación Acumulada
          </button>
        </div>
  */
  // Wait, the "Subir Facturas (XML)" button was ALREADY injected by a previous commit!
  // Let's print out what the file actually contains around "Comprobación Acumulada".
  fs.writeFileSync(file, content, 'utf8');
}

inject('app/admin/gastos/_components/EgresosTab.tsx', 'gasto');
inject('app/admin/gastos/_components/IngresosTab.tsx', 'venta');

console.log("Super injector part 1 complete.");
