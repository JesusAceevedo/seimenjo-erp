const fs = require('fs');
const path = require('path');

const pageFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

// 1. Imports
if (!pageContent.includes('procesarLoteFacturas')) {
    pageContent = pageContent.replace(
        /obtenerFacturasPorProveedor\r?\n\} from '\.\/actions';/,
        `obtenerFacturasPorProveedor,\n  actualizarCategoriaGasto,\n  procesarLoteFacturas\n} from './actions';`
    );
}

// 2. handleUpdateGastoCategoria
const updateCatLogic = `
  const handleUpdateGastoCategoria = async (gastoId: string, categoriaId: string | null) => {
    setMessage({ text: 'Actualizando categoría...', type: 'info' });
    const token = await getSessionToken();
    const res = await actualizarCategoriaGasto(gastoId, categoriaId, token);
    if (res.success) {
       setMessage({ text: 'Categoría actualizada.', type: 'success' });
       fetchData();
    } else {
       setMessage({ text: res.error || 'Error al actualizar categoría.', type: 'error' });
    }
  };

  const handleMassUpload = async`;

if (!pageContent.includes('handleUpdateGastoCategoria')) {
   pageContent = pageContent.replace(/const handleMassUpload = async/, updateCatLogic);
}

// 3. EgresosTab Props
const egresosOld = `<EgresosTab
                gastosFacturados={gastosFacturados}
                onOpenComprobacionAcumulada={() => setComprobacionAcumuladaModal(prev => ({ ...prev, open: true }))}
                onDownloadFile={handleDownloadFile}
                onViewCfdi={(xmlUrl) => setCfdiViewerModal({ open: true, xmlUrl })} />`;

const egresosNew = `<EgresosTab
                gastosFacturados={gastosFacturados}
                categorias={categoriasGasto}
                onUpdateCategoria={handleUpdateGastoCategoria}
                onOpenComprobacionAcumulada={() => setComprobacionAcumuladaModal(prev => ({ ...prev, open: true }))}
                onDownloadFile={handleDownloadFile}
                onViewCfdi={(xmlUrl) => setCfdiViewerModal({ open: true, xmlUrl })} />`;

pageContent = pageContent.replace(egresosOld, egresosNew);

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log('Restored handleUpdateGastoCategoria and EgresosTab props');
