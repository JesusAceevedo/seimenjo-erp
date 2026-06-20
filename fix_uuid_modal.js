const fs = require('fs');
const path = require('path');

// 1. Fix UUID Case Sensitivity in actions.ts
const actionsFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'actions.ts');
let actionsContent = fs.readFileSync(actionsFile, 'utf8');

actionsContent = actionsContent.replace(
  /\.eq\('uuid_fiscal', xmlData\.uuid\)/g,
  `.eq('uuid_fiscal', xmlData.uuid.toLowerCase())`
);

actionsContent = actionsContent.replace(
  /uuid_fiscal: xmlData\.uuid,/g,
  `uuid_fiscal: xmlData.uuid.toLowerCase(),`
);

fs.writeFileSync(actionsFile, actionsContent, 'utf8');

// 2. Render CfdiViewerModal in page.tsx
const pageFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let pageContent = fs.readFileSync(pageFile, 'utf8');

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
  // Let's just insert it right before the closing </div> of the main return
  // A safe place is right before the very last `</div>` or `{/* EMAIL MODAL */}` if it exists
  if (pageContent.includes('{emailModal.open && (')) {
     pageContent = pageContent.replace(
        /\{emailModal\.open && \(/,
        `${modalRender}\n        {emailModal.open && (`
     );
  } else {
     // fallback
     pageContent = pageContent.replace(
        /<\/div>\r?\n\s*<\/div>\r?\n\s*<\/div>\r?\n\s*$/i,
        `${modalRender}\n      </div>\n    </div>\n  </div>`
     );
  }
  fs.writeFileSync(pageFile, pageContent, 'utf8');
}
console.log('Fixed UUID case sensitivity and added CfdiViewerModal render.');
