const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', '_components', 'IngresosTab.tsx');
let content = fs.readFileSync(file, 'utf8');

const pdfButtonTarget = `                            {inv.pdf_url && inv.pdf_url.split(',').filter(Boolean).map((url, si) => (
                              <button key={si} onClick={() => onDownloadFile(url)} title="PDF"
                                className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded border border-red-200 dark:border-red-900/50 text-red-500">
                                <FileText size={13} />
                              </button>
                            ))}`;

const newButtons = `                            {inv.pdf_url && inv.pdf_url.split(',').filter(Boolean).map((url, si) => (
                              <button key={si} onClick={() => onDownloadFile(url)} title="PDF"
                                className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded border border-red-200 dark:border-red-900/50 text-red-500">
                                <FileText size={13} />
                              </button>
                            ))}
                            {!inv.pdf_url && inv.xml_url && onViewCfdi && (
                              <button onClick={() => onViewCfdi(inv.xml_url!.split(',')[0])} title="Ver XML"
                                className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 rounded border border-indigo-200 dark:border-indigo-900/50 text-indigo-500">
                                <Eye size={13} />
                              </button>
                            )}`;

content = content.replace(pdfButtonTarget, newButtons);
fs.writeFileSync(file, content, 'utf8');
console.log('IngresosTab.tsx fixed');
