const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', 'page.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the bad closing `)}` we added
content = content.replace(
  /<\/form>\r?\n\s*\)\}\r?\n\s*<\/div>\r?\n\s*<\/div>\r?\n\s*\)\}/,
  `</form>\n            </div>\n          </div>\n          )}`
);

// 2. Add the ternary again
// First, find the header block. It starts with "<div>" and has "Ingesta de Factura" and ends with `<form onSubmit={handleUploadAndProcess}`
const headerRegex = /<div>\r?\n\s*<h3 className="text-lg font-bold flex items-center gap-2">\r?\n\s*<FileCode size=\{20\} className="text-blue-500" \/> Ingesta de Factura\r?\n\s*<\/h3>\r?\n\s*<p className="text-xs text-gray-400 mt-1 font-sans">\r?\n\s*Sube el XML y PDF emitidos por el SAT para procesar\.\r?\n\s*<\/p>\r?\n\s*<\/div>\r?\n\s*<form onSubmit=\{handleUploadAndProcess\} className="space-y-4">/;

const replaceHeader = `              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <FileCode size={20} className="text-blue-500" /> Ingesta de Factura
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 font-sans">
                    Sube y procesa tus CFDI (XML) del SAT.
                  </p>
                </div>
              </div>

              {/* TABS DE MODO DE CARGA */}
              <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 mb-4">
                 <button onClick={() => setUploadMode('individual')} className={\`text-sm font-bold px-4 py-2 rounded-t-lg transition-colors \${uploadMode === 'individual' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}\`}>Carga Individual</button>
                 <button onClick={() => setUploadMode('masiva')} className={\`text-sm font-bold px-4 py-2 rounded-t-lg transition-colors \${uploadMode === 'masiva' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}\`}>Carga Masiva Global</button>
              </div>

              {/* SELECTOR DE TIPO (GLOBAL PARA AMBOS MODOS) */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">¿Qué vas a subir?</label>
                <div className="grid grid-cols-2 gap-2 mt-2 font-sans mb-4">
                  <button
                    type="button"
                    onClick={() => { setInvoiceType('gasto'); resetUploadForm(); }}
                    className={\`py-2 rounded-xl text-xs font-bold border transition-all \${invoiceType === 'gasto'
                        ? 'bg-red-600/10 text-red-500 border-red-500/40'
                        : 'bg-transparent text-gray-400 border-gray-200 dark:border-gray-800'
                      }\`}
                  >
                    Gastos (Proveedores)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInvoiceType('venta'); resetUploadForm(); }}
                    className={\`py-2 rounded-xl text-xs font-bold border transition-all \${invoiceType === 'venta'
                        ? 'bg-emerald-600/10 text-emerald-500 border-emerald-500/40'
                        : 'bg-transparent text-gray-400 border-gray-200 dark:border-gray-800'
                      }\`}
                  >
                    Ventas (Clientes)
                  </button>
                </div>
              </div>

              {uploadMode === 'masiva' ? (
                 <div className="space-y-4">
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center bg-gray-50 dark:bg-gray-900/50">
                       <UploadCloud className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                       <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Arrastra o selecciona múltiples archivos XML</p>
                       <p className="text-xs text-gray-500 mb-4">Puedes subir archivos estándar o Acuses de Cancelación.</p>
                       <input 
                          type="file" 
                          multiple 
                          accept=".xml" 
                          onChange={(e) => {
                            if (e.target.files) {
                               setMassXmlFiles(Array.from(e.target.files).slice(0, 100)); // Limite 100
                               setMassUploadStatus('idle');
                               setMassUploadResults(null);
                            }
                          }}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                       />
                    </div>
                    
                    {massXmlFiles.length > 0 && (
                       <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                          {massXmlFiles.length} archivo(s) listo(s) para procesar.
                       </div>
                    )}

                    {massUploadStatus === 'done' && massUploadResults && (
                       <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 font-sans text-sm">
                          <h4 className="font-bold text-green-800 dark:text-green-400 mb-2">Resumen de Procesamiento</h4>
                          <ul className="space-y-1 text-green-700 dark:text-green-300">
                             <li>✓ Agregados nuevos: <b>{massUploadResults.agregados}</b></li>
                             <li>✓ Actualizados/Cancelados: <b>{massUploadResults.actualizados}</b></li>
                             <li>- Ignorados (duplicados exactos): <b>{massUploadResults.ignorados}</b></li>
                             {massUploadResults.errores > 0 && <li className="text-red-600">✖ Errores: <b>{massUploadResults.errores}</b></li>}
                          </ul>
                       </div>
                    )}

                    <button
                      type="button"
                      disabled={massUploadStatus === 'processing' || massXmlFiles.length === 0}
                      onClick={handleMassUpload}
                      className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 dark:text-gray-900 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {massUploadStatus === 'processing' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileCode size={18} />}
                      {massUploadStatus === 'processing' ? 'Procesando Lote...' : 'Procesar Lote Masivo'}
                    </button>
                 </div>
              ) : (
              <form onSubmit={handleUploadAndProcess} className="space-y-4">`;

if (headerRegex.test(content)) {
   content = content.replace(headerRegex, replaceHeader);
   
   // Close the ternary properly at the end
   content = content.replace(
      /<\/form>\r?\n\s*<\/div>\r?\n\s*<\/div>\r?\n\s*\)\}/,
      `              </form>\n              )}\n              </div>\n            </div>\n          )}`
   );

   // Remove duplicate Type Selector
   const typeRegex = /\{\/\* SELECTOR DE TIPO \(GASTO VS VENTA\) \*\/\}[\s\S]*?Venta \(Cliente\)\r?\n\s*<\/button>\r?\n\s*<\/div>\r?\n\s*<\/div>/;
   content = content.replace(typeRegex, `{/* Selector was moved up */}`);
   
   fs.writeFileSync(file, content, 'utf8');
   console.log('Fixed UI ternary successfully.');
} else {
   console.log('HEADER REGEX DID NOT MATCH!');
}
