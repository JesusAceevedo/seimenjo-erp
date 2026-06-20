const fs = require('fs');
const path = require('path');

const file = path.join('d:', 'seimenjo-erp', 'app', 'admin', 'gastos', '_components', 'BancoTab.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the ReconcileModal entirely from the end of the file
const startModalIdx = content.indexOf('{/* Modal de Conciliación Manual');
if (startModalIdx !== -1) {
  content = content.substring(0, startModalIdx) + '    </div>\n  );\n}';
}

const panelHtml = `
              {/* Panel Lateral Lado-a-Lado */}
              {reconcileModal.open && reconcileModal.movimiento && (
                <div className="w-full lg:w-80 shrink-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl flex flex-col min-h-0 overflow-hidden animate-in slide-in-from-right-8 duration-300">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 text-sm flex items-center gap-2">
                        <ArrowRightLeft size={16} className="text-amber-500" /> Conciliación
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 truncate max-w-[200px]" title={reconcileModal.movimiento.concepto}>
                        {reconcileModal.movimiento.concepto}
                      </p>
                      <p className={\`text-sm font-black mt-1 \${reconcileModal.movimiento.tipo_movimiento === 'Retiro' ? 'text-red-500' : 'text-emerald-500'}\`}>
                        {reconcileModal.movimiento.tipo_movimiento === 'Retiro' ? '-' : '+'}{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(reconcileModal.movimiento.monto)}
                      </p>
                    </div>
                    <button onClick={() => setReconcileModal(p => ({ ...p, open: false }))} className="text-gray-400 hover:text-gray-600 bg-white dark:bg-gray-800 rounded-full p-1 border border-gray-200 dark:border-gray-700 shadow-sm">
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm font-sans bg-gray-50/30 dark:bg-gray-950">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase">1. Seleccionar Estatus Rápido</label>
                      <select 
                        value={reconcileModal.estatusClave}
                        onChange={(e) => setReconcileModal(p => ({ ...p, estatusClave: e.target.value }))}
                        className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-amber-500 font-bold shadow-sm"
                      >
                        <option value="">Seleccionar estatus...</option>
                        {estatusCatalog.map(cat => (
                          <option key={cat.clave} value={cat.clave}>{cat.nombre}</option>
                        ))}
                      </select>
                    </div>
                    
                    {reconcileModal.movimiento.tipo_movimiento === 'Retiro' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">O vincular Gastos Pendientes</label>
                        <div className="relative">
                          <input type="text" placeholder="Buscar gasto..." value={manualMatchSearch} onChange={e => setManualMatchSearch(e.target.value)} className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 pl-8 pr-3 py-2 rounded-lg text-xs outline-none" />
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                          {(gastosFacturados || []).filter(g => g.estatus !== 'Pagado' && (!manualMatchSearch || g.concepto.toLowerCase().includes(manualMatchSearch.toLowerCase()) || String(g.monto).includes(manualMatchSearch))).map(g => (
                            <label key={g.id} className={\`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors \${reconcileModal.gastosSeleccionados.includes(g.id) ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-amber-300'}\`}>
                              <input type="checkbox" checked={reconcileModal.gastosSeleccionados.includes(g.id)} onChange={e => {
                                setReconcileModal(p => ({
                                  ...p, gastosSeleccionados: e.target.checked ? [...p.gastosSeleccionados, g.id] : p.gastosSeleccionados.filter(id => id !== g.id)
                                }));
                              }} className="mt-0.5 accent-amber-500 w-4 h-4" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate text-gray-800 dark:text-gray-200">{g.concepto}</p>
                                <p className="text-[10px] text-gray-500">{g.proveedores?.nombre_comercial || 'Sin proveedor'}</p>
                              </div>
                              <div className="text-xs font-black text-red-500">\${g.monto}</div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {reconcileModal.movimiento.tipo_movimiento === 'Deposito' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">O vincular Ventas Pendientes</label>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                          {(ventasFacturadas || []).filter(v => v.estatus !== 'Pagado' && (!manualMatchSearch || v.serie_folio?.toLowerCase().includes(manualMatchSearch.toLowerCase()) || String(v.total).includes(manualMatchSearch))).map(v => (
                            <label key={v.id} className={\`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors \${reconcileModal.pedidosSeleccionados.includes(v.id) ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-amber-300'}\`}>
                              <input type="checkbox" checked={reconcileModal.pedidosSeleccionados.includes(v.id)} onChange={e => {
                                setReconcileModal(p => ({
                                  ...p, pedidosSeleccionados: e.target.checked ? [...p.pedidosSeleccionados, v.id] : p.pedidosSeleccionados.filter(id => id !== v.id)
                                }));
                              }} className="mt-0.5 accent-amber-500 w-4 h-4" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate text-gray-800 dark:text-gray-200">Fac {v.serie_folio}</p>
                                <p className="text-[10px] text-gray-500">{v.clientes?.nombre_comercial || 'Sin cliente'}</p>
                              </div>
                              <div className="text-xs font-black text-emerald-500">\${v.total}</div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {reconcileModal.error && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs rounded-xl font-semibold">
                        {reconcileModal.error}
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 shrink-0">
                    <button 
                      onClick={handleSaveReconciliation}
                      disabled={reconcileModal.loading || (!reconcileModal.estatusClave && reconcileModal.gastosSeleccionados.length === 0 && reconcileModal.pedidosSeleccionados.length === 0)}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md transition-all flex justify-center items-center gap-2"
                    >
                      {reconcileModal.loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />}
                      {reconcileModal.loading ? 'Guardando...' : 'Confirmar Conciliación'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sub-tab 2: Global */}`;

content = content.replace(/            <\/div>\r?\n\s*\)\}\r?\n\r?\n\s*\{\/\* Sub-tab 2: Global \*\/\}/, panelHtml);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated BancoTab layout to side-by-side!");
