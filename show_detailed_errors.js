const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

const targetErrorUI = `{massUploadResults.errores > 0 && <li className="text-red-600">✖ Errores: <b>{massUploadResults.errores}</b></li>}`;

const newErrorUI = `{massUploadResults.errores > 0 && (
                               <li className="text-red-600">
                                 ✖ Errores: <b>{massUploadResults.errores}</b>
                                 {massUploadResults.detallesErrores && massUploadResults.detallesErrores.length > 0 && (
                                   <ul className="mt-2 text-xs text-red-500 bg-red-100 dark:bg-red-900/40 p-2 rounded max-h-32 overflow-y-auto">
                                     {massUploadResults.detallesErrores.map((err: string, i: number) => (
                                       <li key={i} className="mb-1 border-b border-red-200 dark:border-red-800 pb-1">{err}</li>
                                     ))}
                                   </ul>
                                 )}
                               </li>
                             )}`;

content = content.replace(targetErrorUI, newErrorUI);
fs.writeFileSync(file, content, 'utf8');
console.log('page.tsx updated to show detailed errors');
