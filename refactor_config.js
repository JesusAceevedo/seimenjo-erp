const fs = require('fs');

const configPath = 'app/admin/configuracion/page.tsx';
let content = fs.readFileSync(configPath, 'utf8');

// 1. Update the tabs type in useState
content = content.replace(
  /useState\<'ventas' \| 'clientes' \| 'gastos' \| 'productos' \| 'tickets' \| 'superusuario'\>\('ventas'\);/,
  "useState<'ventas' | 'clientes' | 'facturacion' | 'productos' | 'tickets' | 'superusuario'>('ventas');"
);

// 2. Add new states for Facturación
const stateSearch = `  const [productoVariantes, setProductoVariantes] = useState<ProductoVariante[]>([]);`;
const newStates = `
  // --- ESTADOS DE FACTURACION ---
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [estatusConciliacion, setEstatusConciliacion] = useState<any[]>([]);
  const [formasPagoBanco, setFormasPagoBanco] = useState<any[]>([]);

  const [nuevaCuenta, setNuevaCuenta] = useState({ nombre: '', numero_cuenta: '', moneda: 'MXN' });
  const [nuevoEstatusConciliacion, setNuevoEstatusConciliacion] = useState({ estatus: '', color: '#94a3b8' });
  const [nuevaFormaPagoBanco, setNuevaFormaPagoBanco] = useState({ forma_pago: '' });
`;
if (!content.includes('const [cuentasBancarias')) {
  content = content.replace(stateSearch, stateSearch + '\n' + newStates);
}

// 3. Update loadAllData
const loadSearch = `    // 7. Proveedores`;
const newLoad = `
    // FACTURACION Y CONCILIACION
    const cb = await fetchCatalog('cuentas_bancarias', 'nombre');
    setCuentasBancarias(cb);
    const ec = await fetchCatalog('estatus_conciliacion', 'estatus');
    setEstatusConciliacion(ec);
    const fpb = await fetchCatalog('formas_pago_banco', 'forma_pago');
    setFormasPagoBanco(fpb);

`;
if (!content.includes('fetchCatalog(\'cuentas_bancarias\'')) {
  content = content.replace(loadSearch, newLoad + loadSearch);
}

// 4. Update the Tab Button from Gastos to Facturación
content = content.replace(
  /onClick=\{\(\) \=\> setActiveTab\('gastos'\)\}/g,
  "onClick={() => setActiveTab('facturacion')}"
);
content = content.replace(
  /activeTab === 'gastos'/g,
  "activeTab === 'facturacion'"
);
content = content.replace(
  /\<FolderOpen size=\{16\} \/\> Módulo de Gastos/g,
  "<FileText size={16} /> Módulo de Facturación"
);

// 5. Inject the new blocks into the Facturación tab
// We know it starts with {activeTab === 'facturacion' && (
// And it ends where the next tab begins {activeTab === 'productos' && (

const facturacionTabStart = "{activeTab === 'facturacion' && (";
const blocksToInject = `
              {/* BLOQUE: CUENTAS BANCARIAS */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 lg:col-span-2">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Globe className="text-blue-500" size={20} /> Cuentas Bancarias
                </h3>
                <ErrorBanner table="cuentas_bancarias" />
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="Nombre (Ej. Banamex)" value={nuevaCuenta.nombre} className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm outline-none" onChange={e => setNuevaCuenta({...nuevaCuenta, nombre: e.target.value})} />
                  <input type="text" placeholder="Número Cuenta" value={nuevaCuenta.numero_cuenta} className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm outline-none" onChange={e => setNuevaCuenta({...nuevaCuenta, numero_cuenta: e.target.value})} />
                  <button onClick={() => handleSaveItem('cuentas_bancarias', nuevaCuenta, setCuentasBancarias, 'nombre', () => setNuevaCuenta({ nombre: '', numero_cuenta: '', moneda: 'MXN' }))} className="bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1"><Plus size={16}/> Agregar</button>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 text-gray-500"><tr><th className="p-3">Cuenta</th><th className="p-3">Número</th><th className="p-3 text-right">Acción</th></tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {cuentasBancarias.map(cb => (
                        <tr key={cb.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-semibold">{cb.nombre}</td>
                          <td className="p-3 text-gray-500">{cb.numero_cuenta}</td>
                          <td className="p-3 text-right"><button onClick={() => handleDeleteItem('cuentas_bancarias', cb.id, setCuentasBancarias, 'nombre')} className="text-gray-400 hover:text-red-500"><Trash2 size={15}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BLOQUE: ESTATUS CONCILIACION */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Settings className="text-blue-500" size={20} /> Estatus de Conciliación
                </h3>
                <ErrorBanner table="estatus_conciliacion" />
                <div className="flex gap-2">
                  <input type="text" placeholder="Ej. Comisión Bancaria" value={nuevoEstatusConciliacion.estatus} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm outline-none" onChange={e => setNuevoEstatusConciliacion({...nuevoEstatusConciliacion, estatus: e.target.value})} />
                  <input type="color" value={nuevoEstatusConciliacion.color} onChange={e => setNuevoEstatusConciliacion({...nuevoEstatusConciliacion, color: e.target.value})} className="w-10 h-10 p-1 rounded bg-white border border-gray-300"/>
                  <button onClick={() => handleSaveItem('estatus_conciliacion', nuevoEstatusConciliacion, setEstatusConciliacion, 'estatus', () => setNuevoEstatusConciliacion({ estatus: '', color: '#94a3b8' }))} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1"><Plus size={16}/> Agregar</button>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 text-gray-500"><tr><th className="p-3">Estatus</th><th className="p-3 text-right">Acción</th></tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {estatusConciliacion.map(ec => (
                        <tr key={ec.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-semibold flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: ec.color}}></div>{ec.estatus}</td>
                          <td className="p-3 text-right"><button onClick={() => handleDeleteItem('estatus_conciliacion', ec.id, setEstatusConciliacion, 'estatus')} className="text-gray-400 hover:text-red-500"><Trash2 size={15}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BLOQUE: FORMAS DE PAGO BANCO */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <CreditCard className="text-blue-500" size={20} /> Formas de Pago Bancario
                </h3>
                <ErrorBanner table="formas_pago_banco" />
                <div className="flex gap-2">
                  <input type="text" placeholder="Ej. SPEI" value={nuevaFormaPagoBanco.forma_pago} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm outline-none" onChange={e => setNuevaFormaPagoBanco({forma_pago: e.target.value})} />
                  <button onClick={() => handleSaveItem('formas_pago_banco', nuevaFormaPagoBanco, setFormasPagoBanco, 'forma_pago', () => setNuevaFormaPagoBanco({ forma_pago: '' }))} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1"><Plus size={16}/> Agregar</button>
                </div>
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 text-gray-500"><tr><th className="p-3">Forma Pago</th><th className="p-3 text-right">Acción</th></tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {formasPagoBanco.map(fpb => (
                        <tr key={fpb.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-semibold">{fpb.forma_pago}</td>
                          <td className="p-3 text-right"><button onClick={() => handleDeleteItem('formas_pago_banco', fpb.id, setFormasPagoBanco, 'forma_pago')} className="text-gray-400 hover:text-red-500"><Trash2 size={15}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
`;

if (!content.includes('BLOQUE: CUENTAS BANCARIAS')) {
  // Let's find the closing div of the Facturación grid and insert right before it.
  // Actually, Facturación tab has:
  // {activeTab === 'facturacion' && (
  //   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
  //     {/* BLOQUE: CATEGORÍAS DE GASTO */} ...
  //     {/* BLOQUE: PROVEEDORES */} ...
  //   </div>
  // )}
  // Let's insert before {/* BLOQUE: PROVEEDORES */}
  // The Proveedores block might be large. Let's find: {/* BLOQUE: PROVEEDORES */}
  
  content = content.replace("{/* BLOQUE: PROVEEDORES */}", blocksToInject + '\n\n              {/* BLOQUE: PROVEEDORES */}');
}

fs.writeFileSync(configPath, content, 'utf8');
console.log("Configuracion page.tsx refactored successfully");
