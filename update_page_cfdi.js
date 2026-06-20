const fs = require('fs');
const path = require('path');

const pageFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

if (!pageContent.includes('CfdiViewerModal')) {
   pageContent = pageContent.replace(
      /import ProveedoresTab from '\.\/_components\/ProveedoresTab';/,
      `import ProveedoresTab from './_components/ProveedoresTab';\nimport CfdiViewerModal from './_components/CfdiViewerModal';`
   );
}

if (!pageContent.includes('cfdiViewerModal')) {
   pageContent = pageContent.replace(
      /const \[emailModal, setEmailModal\] = useState/g,
      `const [cfdiViewerModal, setCfdiViewerModal] = useState<{open: boolean, xmlUrl: string | null}>({open: false, xmlUrl: null});\n  const [emailModal, setEmailModal] = useState`
   );
}

const onViewLogic = `onDownloadFile={handleDownloadFile}\n                onViewCfdi={(xmlUrl) => setCfdiViewerModal({ open: true, xmlUrl })}`;

pageContent = pageContent.replace(
   /onDownloadFile=\{handleDownloadFile\}\s*\/>/g,
   `${onViewLogic} />`
);

pageContent = pageContent.replace(
   /onDownloadFile=\{handleDownloadFile\}\s*onAssignFactura/g,
   `${onViewLogic}\n                onAssignFactura`
);

const modalRender = `{/* MODALES AUXILIARES */}
        {cfdiViewerModal.open && (
          <CfdiViewerModal 
             xmlUrl={cfdiViewerModal.xmlUrl} 
             onClose={() => setCfdiViewerModal({ open: false, xmlUrl: null })} 
          />
        )}`;

if (!pageContent.includes('<CfdiViewerModal')) {
   pageContent = pageContent.replace(
      /\{emailModal\.open && \(/,
      `${modalRender}\n\n        {emailModal.open && (`
   );
}

fs.writeFileSync(pageFile, pageContent, 'utf8');
console.log('page.tsx updated with CfdiViewerModal.');
