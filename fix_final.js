const fs = require('fs');

function fixTab(filePath, typeStr) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Search string: from `<div className="flex gap-2">` to `Comprobación Acumulada\n          </button>`
  const startStr = '<div className="flex gap-2">';
  const endStr = typeStr === 'gasto' ? '<Plus size={13} /> Comprobación Acumulada\n          </button>' : '<Plus size={13} /> Facturación Acumulada\n          </button>';

  const startIndex = content.indexOf(startStr);
  const endIndex = content.indexOf(endStr);

  if (startIndex !== -1 && endIndex !== -1) {
    const finalEndIndex = endIndex + endStr.length;
    
    const replacement = `<div className="flex gap-2">
            <button
              onClick={() => setShowXmlModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <UploadCloud size={13} /> Masivo (XML)
            </button>
            <button
              onClick={() => setManualModal({isOpen: true})}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <FileText size={13} /> Carga Manual
            </button>
            <button
              onClick={${typeStr === 'gasto' ? 'onOpenComprobacionAcumulada' : 'onOpenFacturacionAcumulada'}}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Plus size={13} /> ${typeStr === 'gasto' ? 'Comprobación Acumulada' : 'Facturación Acumulada'}
            </button>
          </div>`;

    content = content.substring(0, startIndex) + replacement + content.substring(finalEndIndex);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
  } else {
    console.log(`Could not find markers in ${filePath}`);
  }
}

fixTab('app/admin/gastos/_components/EgresosTab.tsx', 'gasto');
fixTab('app/admin/gastos/_components/IngresosTab.tsx', 'venta');
