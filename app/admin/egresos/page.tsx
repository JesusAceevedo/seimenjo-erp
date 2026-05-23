'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { 
  Plus, Users, Sun, Moon, Eye, ChevronLeft, ChevronRight, FileText, Save, X, Receipt
} from 'lucide-react';
export const dynamic = 'force-dynamic';
export default function AdminGastos() {
  const router = useRouter();

  // Estados de Datos
  const [gastos, setGastos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [conceptosDisponibles, setConceptosDisponibles] = useState<string[]>([]);
  
  // Estados de UI
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const [page, setPage] = useState(0);
  const pageSize = 10;
  
  // Estados del Modal Manual
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nuevoProveedorNombre, setNuevoProveedorNombre] = useState('');
  const [isConceptoOtro, setIsConceptoOtro] = useState(false);
  const [nuevoGasto, setNuevoGasto] = useState({
    fecha_gasto: new Date().toISOString().split('T')[0],
    proveedor_id: '',
    categoria_id: '',
    concepto: '',
    monto: '',
    metodo_pago: 'Efectivo'
  });

  // --- CONSULTAS A BASE DE DATOS ---
  const fetchGastos = async () => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('gastos')
      .select(`*, proveedores(nombre_comercial, rfc), categorias_gasto(nombre)`)
      .order('fecha_gasto', { ascending: false })
      .range(from, to);

    if (error) console.error("Error cargando gastos:", error);
    if (data) setGastos(data);
  };

  const fetchCatalogos = async () => {
    const [cats, provs] = await Promise.all([
      supabase.from('categorias_gasto').select('*').order('nombre'),
      supabase.from('proveedores').select('*').order('nombre_comercial')
    ]);
    
    if (cats.error) console.error("Error cargando categorías:", cats.error);
    if (provs.error) console.error("Error cargando proveedores:", provs.error);

    if (cats.data) setCategorias(cats.data);
    if (provs.data) setProveedores(provs.data);
  };

  const cargarConceptosPorCategoria = async (categoriaId: string) => {
    if (!categoriaId) {
      setConceptosDisponibles([]);
      return;
    }
    const { data, error } = await supabase
      .from('conceptos_permitidos')
      .select('concepto_nombre')
      .eq('categoria_id', categoriaId);

    if (error) {
      console.error("Error al cargar conceptos:", error);
    } else if (data) {
      setConceptosDisponibles(data.map(item => item.concepto_nombre));
    }
  };

  useEffect(() => {
    fetchGastos();
    fetchCatalogos();
  }, [page]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/admin/login');
    };
    init();
  }, [router]);

  // --- LÓGICA DE GUARDADO MANUAL ---
  const handleGuardarGasto = async () => {
    if (!nuevoGasto.concepto || !nuevoGasto.monto || !nuevoGasto.categoria_id) {
      alert("Por favor llena los campos obligatorios (Concepto, Monto y Categoría).");
      return;
    }

    let proveedorFinalId = nuevoGasto.proveedor_id;

    // Si es un proveedor nuevo, crearlo en la tabla proveedores
    if (proveedorFinalId === 'nuevo' && nuevoProveedorNombre.trim() !== '') {
      const { data: newProv, error: provError } = await supabase
        .from('proveedores')
        .insert([{ nombre_comercial: nuevoProveedorNombre.trim() }])
        .select('id')
        .single();
        
      if (!provError && newProv) {
        proveedorFinalId = newProv.id;
      } else {
        proveedorFinalId = '';
      }
    }

    // Insertar el gasto en la BD
    const { error } = await supabase.from('gastos').insert([{
      fecha_gasto: nuevoGasto.fecha_gasto,
      proveedor_id: proveedorFinalId && proveedorFinalId !== 'nuevo' ? proveedorFinalId : null,
      categoria_id: nuevoGasto.categoria_id,
      concepto: nuevoGasto.concepto,
      monto: Number(nuevoGasto.monto),
      metodo_pago: nuevoGasto.metodo_pago
      // NOTA: Se ha omitido 'registrado_por' temporalmente para evitar el error de foreign key
      // registrado_por: (await supabase.auth.getUser()).data.user?.id 
    }]);

    if (!error) {
      setIsModalOpen(false);
      setNuevoProveedorNombre('');
      setIsConceptoOtro(false);
      setConceptosDisponibles([]);
      setNuevoGasto({
        fecha_gasto: new Date().toISOString().split('T')[0],
        proveedor_id: '', categoria_id: '', concepto: '', monto: '', metodo_pago: 'Efectivo'
      });
      fetchGastos();
      fetchCatalogos();
    } else {
      // Ahora si hay un error, el sistema te lo notificará claramente en pantalla
      alert(`Error de Base de Datos: ${error.message} \n\nDetalles: ${error.details || 'Revisa la consola'}`);
      console.error("Detalle completo del error Supabase:", error);
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors flex">

        {/* ÁREA PRINCIPAL */}
        <main className="flex-1 flex flex-col p-8 w-full max-w-[100vw] md:max-w-[calc(100vw-16rem)] mx-auto">

          {/* HEADER */}
          <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="text-blue-500" /> Registro de Egresos
            </h2>
            <div className="flex items-center gap-3">
              <button onClick={toggleDarkMode} className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold shadow-lg transition-colors"
              >
                <Plus size={18} /> Registrar Gasto Manual
              </button>
            </div>
          </div>

          {/* TABLA PRINCIPAL DE GASTOS */}
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl flex flex-col flex-1 overflow-hidden">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Proveedor / Local</th>
                    <th className="p-4">Concepto / Categoría</th>
                    <th className="p-4 text-center">Método</th>
                    <th className="p-4 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
                  {gastos.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-4 font-mono text-gray-600 dark:text-gray-300">
                        {new Date(g.fecha_gasto).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{g.proveedores?.nombre_comercial || 'Gasto Sin Proveedor'}</div>
                        <div className="font-mono text-[10px] text-gray-500">{g.proveedores?.rfc || 'Sin RFC'}</div>
                      </td>
                      <td className="p-4 space-y-1">
                        <div className="font-medium text-sm">{g.concepto || 'Sin descripción'}</div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                          {g.categorias_gasto?.nombre || 'Sin Categoría'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-600 dark:text-gray-400">
                          {g.metodo_pago || 'Efectivo'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-sm text-red-600 dark:text-red-400">
                        - ${Number(g.monto).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {gastos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                        No hay gastos registrados aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors"><ChevronLeft size={16} /> Anterior</button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Página {page + 1}</span>
              <button disabled={gastos.length < pageSize} onClick={() => setPage(page + 1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors">Siguiente <ChevronRight size={16} /></button>
            </div>
          </div>

        </main>

        {/* MODAL DE CAPTURA MANUAL */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-extrabold flex items-center gap-2 text-gray-900 dark:text-white">
                  <Receipt className="text-blue-500"/> Captura de Gasto
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Fecha */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Fecha del Gasto</label>
                    <input 
                      type="date" 
                      value={nuevoGasto.fecha_gasto}
                      style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" 
                      onChange={e => setNuevoGasto({...nuevoGasto, fecha_gasto: e.target.value})} 
                    />
                  </div>
                  {/* Categoría */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Categoría (Obligatorio)</label>
                    <select 
                      value={nuevoGasto.categoria_id}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" 
                      onChange={e => {
                        const id = e.target.value;
                        setNuevoGasto({...nuevoGasto, categoria_id: id, concepto: ''});
                        setIsConceptoOtro(false);
                        cargarConceptosPorCategoria(id);
                      }}
                    >
                      <option value="">Selecciona la clasificación...</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>

                {/* Proveedor / Origen */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">¿Dónde se compró? (Proveedor)</label>
                  <select 
                    value={nuevoGasto.proveedor_id}
                    className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white mb-3" 
                    onChange={e => setNuevoGasto({...nuevoGasto, proveedor_id: e.target.value})}
                  >
                    <option value="">Seleccionar proveedor registrado...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                    <option value="nuevo" className="font-bold text-blue-500">+ Registrar Nuevo Proveedor Rápido</option>
                  </select>

                  {/* Input condicional para proveedor nuevo */}
                  {nuevoGasto.proveedor_id === 'nuevo' && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                      <input 
                        type="text" 
                        placeholder="Ej. Mercado Libre, Hielería, etc..." 
                        value={nuevoProveedorNombre}
                        className="w-full border-b-2 border-blue-500 bg-transparent p-2 text-sm text-gray-900 dark:text-white focus:outline-none" 
                        onChange={e => setNuevoProveedorNombre(e.target.value)} 
                      />
                    </div>
                  )}
                </div>

                {/* Concepto y Monto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">¿Qué se compró? (Concepto)</label>
                    <select 
                      value={isConceptoOtro ? 'OTRO' : nuevoGasto.concepto}
                      disabled={!nuevoGasto.categoria_id}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white disabled:opacity-50" 
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'OTRO') {
                          setIsConceptoOtro(true);
                          setNuevoGasto({...nuevoGasto, concepto: ''});
                        } else {
                          setIsConceptoOtro(false);
                          setNuevoGasto({...nuevoGasto, concepto: val});
                        }
                      }}
                    >
                      <option value="">
                        {nuevoGasto.categoria_id ? "Selecciona un concepto..." : "Primero selecciona una categoría arriba"}
                      </option>
                      {conceptosDisponibles.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      {nuevoGasto.categoria_id && <option value="OTRO">Otro (especificar...)</option>}
                    </select>

                    {/* Campo de texto libre alternativo si seleccionan OTRO */}
                    {isConceptoOtro && (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                        <input 
                          type="text" 
                          placeholder="Escribe el concepto específico aquí..." 
                          value={nuevoGasto.concepto}
                          className="w-full bg-white dark:bg-gray-950 border border-blue-500 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none" 
                          onChange={e => setNuevoGasto({...nuevoGasto, concepto: e.target.value})} 
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Pagado ($)</label>
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      value={nuevoGasto.monto}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white font-bold text-red-500" 
                      onChange={e => setNuevoGasto({...nuevoGasto, monto: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Método de Pago</label>
                    <select 
                      value={nuevoGasto.metodo_pago}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" 
                      onChange={e => setNuevoGasto({...nuevoGasto, metodo_pago: e.target.value})}
                    >
                      <option value="Efectivo">Efectivo (Caja Chica)</option>
                      <option value="Transferencia">Transferencia Bancaria</option>
                      <option value="Tarjeta">Tarjeta de Débito/Crédito</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleGuardarGasto} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2">
                  <Save size={18}/> Guardar Gasto
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
