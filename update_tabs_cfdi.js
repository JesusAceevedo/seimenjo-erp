const fs = require('fs');
const path = require('path');

const egresosFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', '_components', 'EgresosTab.tsx');
let egresosContent = fs.readFileSync(egresosFile, 'utf8');

// Add onViewCfdi to Props
egresosContent = egresosContent.replace(
   /onDownloadFile: \(url: string\) => void;/,
   `onDownloadFile: (url: string) => void;\n  onViewCfdi?: (xmlUrl: string) => void;`
);

egresosContent = egresosContent.replace(
   /onDownloadFile,\r?\n\s*onAssignFactura,/,
   `onDownloadFile,\n  onViewCfdi,\n  onAssignFactura,`
);

// Add the Eye component import if missing
if (!egresosContent.includes('Eye,')) {
   egresosContent = egresosContent.replace(
      /FileText, Download,/,
      `FileText, Download, Eye,`
   );
}

// Add the button right after PDF button
const pdfButtonTarget = `                    {g.pdf_url && g.pdf_url.split(',').filter(Boolean).map((url, idx, arr) => (
                      <button
                        key={idx}
                        onClick={() => onDownloadFile(url)}
                        title={\`Descargar PDF\${arr.length > 1 ? \` \${idx + 1}\` : ''}\`}
                        className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500 flex items-center gap-0.5"
                      >
                        <FileText size={13} />
                        {arr.length > 1 && <span className="text-[9px] font-bold">{idx + 1}</span>}
                      </button>
                    ))}`;

const viewCfdiButton = `                    {g.pdf_url && g.pdf_url.split(',').filter(Boolean).map((url, idx, arr) => (
                      <button
                        key={idx}
                        onClick={() => onDownloadFile(url)}
                        title={\`Descargar PDF\${arr.length > 1 ? \` \${idx + 1}\` : ''}\`}
                        className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500 flex items-center gap-0.5"
                      >
                        <FileText size={13} />
                        {arr.length > 1 && <span className="text-[9px] font-bold">{idx + 1}</span>}
                      </button>
                    ))}
                    {!g.pdf_url && g.xml_url && onViewCfdi && (
                      <button
                        onClick={() => onViewCfdi(g.xml_url.split(',')[0])}
                        title="Ver representación impresa del XML"
                        className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded border border-indigo-200 dark:border-indigo-900/50 text-indigo-600 flex items-center gap-0.5"
                      >
                        <Eye size={13} />
                      </button>
                    )}`;

egresosContent = egresosContent.replace(pdfButtonTarget, viewCfdiButton);
fs.writeFileSync(egresosFile, egresosContent, 'utf8');

const ingresosFile = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', '_components', 'IngresosTab.tsx');
let ingresosContent = fs.readFileSync(ingresosFile, 'utf8');

// Add onViewCfdi to Props
ingresosContent = ingresosContent.replace(
   /onDownloadFile: \(url: string\) => void;/,
   `onDownloadFile: (url: string) => void;\n  onViewCfdi?: (xmlUrl: string) => void;`
);

ingresosContent = ingresosContent.replace(
   /onDownloadFile,\r?\n\s*onAssignFactura,/,
   `onDownloadFile,\n  onViewCfdi,\n  onAssignFactura,`
);

if (!ingresosContent.includes('Eye,')) {
   ingresosContent = ingresosContent.replace(
      /FileText, Download,/,
      `FileText, Download, Eye,`
   );
}

const pdfButtonTargetIngresos = `                    {v.pdf_url && v.pdf_url.split(',').filter(Boolean).map((url, idx, arr) => (
                      <button
                        key={idx}
                        onClick={() => onDownloadFile(url)}
                        title={\`Descargar PDF\${arr.length > 1 ? \` \${idx + 1}\` : ''}\`}
                        className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500 flex items-center gap-0.5"
                      >
                        <FileText size={13} />
                        {arr.length > 1 && <span className="text-[9px] font-bold">{idx + 1}</span>}
                      </button>
                    ))}`;

const viewCfdiButtonIngresos = `                    {v.pdf_url && v.pdf_url.split(',').filter(Boolean).map((url, idx, arr) => (
                      <button
                        key={idx}
                        onClick={() => onDownloadFile(url)}
                        title={\`Descargar PDF\${arr.length > 1 ? \` \${idx + 1}\` : ''}\`}
                        className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500 flex items-center gap-0.5"
                      >
                        <FileText size={13} />
                        {arr.length > 1 && <span className="text-[9px] font-bold">{idx + 1}</span>}
                      </button>
                    ))}
                    {!v.pdf_url && v.xml_url && onViewCfdi && (
                      <button
                        onClick={() => onViewCfdi(v.xml_url.split(',')[0])}
                        title="Ver representación impresa del XML"
                        className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded border border-indigo-200 dark:border-indigo-900/50 text-indigo-600 flex items-center gap-0.5"
                      >
                        <Eye size={13} />
                      </button>
                    )}`;

ingresosContent = ingresosContent.replace(pdfButtonTargetIngresos, viewCfdiButtonIngresos);
fs.writeFileSync(ingresosFile, ingresosContent, 'utf8');

console.log('Tabs updated to support onViewCfdi');
