const fs = require('fs');

const path = 'app/admin/expediente/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Imports
if (!content.includes('CargaManualModal')) {
  content = content.replace(
    "import { supabase } from '../../../lib/supabase';",
    "import { supabase } from '../../../lib/supabase';\nimport CargaManualModal from '../gastos/_components/CargaManualModal';\nimport { Plus } from 'lucide-react';"
  );
}

// 2. State
const stateSearch = "const [viewer, setViewer]";
if (!content.includes('manualModal')) {
  content = content.replace(
    stateSearch,
    "const [manualModal, setManualModal] = useState<{isOpen: boolean, id?: string, tipo?: 'gasto'|'venta'}>({isOpen: false});\n  " + stateSearch
  );
}

// 3. Render Modal
const modalStr = `
      {manualModal.isOpen && (
        <CargaManualModal
          tipo={manualModal.tipo || 'gasto'}
          registroId={manualModal.id}
          onClose={() => setManualModal({isOpen: false})}
          onSuccess={() => {
            setManualModal({isOpen: false});
            window.location.reload();
          }}
        />
      )}
`;
if (!content.includes('<CargaManualModal')) {
  // Put it before DocumentViewer
  content = content.replace("<DocumentViewer", modalStr + "      <DocumentViewer");
}

// 4. Inject buttons on the red semaphores
// Look for `<XCircle className="text-red-500"` or `<AlertCircle className="text-red-500"`
// Actually, it's easier to add a general "Añadir Documentos" button to the end of the row.
// There is an Action column:
// `<button onClick={() => setViewer(...)`
const btnSearch = `onClick={() => setViewer({`;
const addBtn = `<button onClick={() => setManualModal({isOpen: true, id: doc.id, tipo: doc.tipo})} className="p-2 text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl transition-colors" title="Añadir/Actualizar Documentos"><Plus size={18} /></button>\n                        <button `;

if (content.includes(btnSearch) && !content.includes('Añadir/Actualizar Documentos')) {
  content = content.replace(/<button onClick=\{\(\) => setViewer\(\{/g, addBtn + 'onClick={() => setViewer({');
}

fs.writeFileSync(path, content, 'utf8');
console.log("Injected Expediente");
