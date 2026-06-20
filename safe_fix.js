const fs = require('fs');

function fix(filePath, typeStr) {
  let content = fs.readFileSync(filePath, 'utf8');

  const startStr = '<div className="flex gap-2">';
  // Note: the exact string varies in source. 
  // For EgresosTab:
  const searchA = 'onClick={onOpenComprobacionAcumulada}';
  const endA = '</button>';

  // For IngresosTab:
  const searchB = 'onClick={onOpenFacturacionAcumulada}';
  const endB = '</button>';

  const searchFn = typeStr === 'gasto' ? searchA : searchB;
  
  const startIdx = content.indexOf(startStr);
  const fnIdx = content.indexOf(searchFn);
  
  if (startIdx !== -1 && fnIdx !== -1) {
    const endIdx = content.indexOf(endA, fnIdx);
    if (endIdx !== -1) {
      const finalEndIdx = endIdx + endA.length;
      
      let replacement = '<div className="flex gap-2">\\n';
      replacement += '            <button\\n';
      replacement += '              onClick={() => setShowXmlModal(true)}\\n';
      replacement += '              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"\\n';
      replacement += '            >\\n';
      replacement += '              <UploadCloud size={13} /> Masivo (XML)\\n';
      replacement += '            </button>\\n';
      replacement += '            <button\\n';
      replacement += '              onClick={() => setManualModal({isOpen: true})}\\n';
      replacement += '              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"\\n';
      replacement += '            >\\n';
      replacement += '              <FileText size={13} /> Carga Manual\\n';
      replacement += '            </button>\\n';
      replacement += '            <button\\n';
      replacement += '              onClick={' + searchFn + '}\\n';
      replacement += '              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"\\n';
      replacement += '            >\\n';
      replacement += '              <Plus size={13} /> ' + (typeStr === 'gasto' ? 'Comprobación Acumulada' : 'Facturación Acumulada') + '\\n';
      replacement += '            </button>\\n';
      replacement += '          </div>';

      // Fix the formatting of `\n` in javascript string
      replacement = replacement.replace(/\\\\n/g, '\\n');

      content = content.substring(0, startIdx) + replacement + content.substring(finalEndIdx);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log("Fixed " + filePath);
    }
  } else {
    console.log("Failed to find markers in " + filePath);
  }
}

fix('app/admin/gastos/_components/EgresosTab.tsx', 'gasto');
fix('app/admin/gastos/_components/IngresosTab.tsx', 'venta');
