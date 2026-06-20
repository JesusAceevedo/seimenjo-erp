const fs = require('fs');
const path = require('path');

const pageFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

// 1. Imports
if (!pageContent.includes('CfdiViewerModal')) {
  pageContent = pageContent.replace(
    /import EgresosTab from '\.\/_components\/EgresosTab';/,
    `import EgresosTab from './_components/EgresosTab';\nimport CfdiViewerModal from './_components/CfdiViewerModal';`
  );
}

// 2. State
if (!pageContent.includes('cfdiViewerModal')) {
  pageContent = pageContent.replace(
    /const \[emailModal, setEmailModal\] = useState/g,
    `const [cfdiViewerModal, setCfdiViewerModal] = useState<{open: boolean, xmlUrl: string | null}>({open: false, xmlUrl: null});\n  const [emailModal, setEmailModal] = useState`
  );
}

// 3. Props
const onViewLogic = `onDownloadFile={handleDownloadFile}\n                onViewCfdi={(xmlUrl) => setCfdiViewerModal({ open: true, xmlUrl })}`;

// Update EgresosTab
if (!pageContent.includes('onViewCfdi={(xmlUrl) => setCfdiViewerModal')) {
   pageContent = pageContent.replace(
      /<EgresosTab([^>]*)onDownloadFile=\{handleDownloadFile\}/,
      `<EgresosTab$1onDownloadFile={handleDownloadFile}\n                onViewCfdi={(xmlUrl) => setCfdiViewerModal({ open: true, xmlUrl })}`
   );
   
   pageContent = pageContent.replace(
      /<IngresosTab([^>]*)onDownloadFile=\{handleDownloadFile\}/,
      `<IngresosTab$1onDownloadFile={handleDownloadFile}\n                onViewCfdi={(xmlUrl) => setCfdiViewerModal({ open: true, xmlUrl })}`
   );
}

// 4. Error Display
const targetErrorUI = `{massUploadResults.errores > 0 && <li className="text-red-600">✖ Errores: <b>{massUploadResults.errores}</b></li>}`;
const newErrorUI = `{massUploadResults.errores > 0 && (
                               <li className="text-red-600">
                                 ✖ Errores: <b>{massUploadResults.errores}</b>
                                 {massUploadResults.detallesErrores && massUploadResults.detallesErrores.length > 0 && (
                                   <ul className="mt-2 text-xs text-red-500 bg-red-100 dark:bg-red-900/40 p-2 rounded max-h-32 overflow-y-auto">
                                     {massUploadResults.detallesErrores.map((err: any, i: number) => (
                                       <li key={i} className="mb-1 border-b border-red-200 dark:border-red-800 pb-1">{err}</li>
                                     ))}
                                   </ul>
                                 )}
                               </li>
                             )}`;
pageContent = pageContent.replace(targetErrorUI, newErrorUI);

// 5. Render Modal
const modalRender = `
        {/* CFDI VIEWER MODAL */}
        {cfdiViewerModal.open && (
          <CfdiViewerModal 
             xmlUrl={cfdiViewerModal.xmlUrl} 
             onClose={() => setCfdiViewerModal({ open: false, xmlUrl: null })} 
          />
        )}
`;
if (!pageContent.includes('<CfdiViewerModal')) {
  pageContent = pageContent.replace(
    /\{emailModal\.open && emailModal\.details && \(/,
    `${modalRender}\n      {emailModal.open && emailModal.details && (`
  );
}

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log('page.tsx fully restored safely');
