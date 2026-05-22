'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Plus, Filter, Soup, ShoppingCart, Truck, FileCheck, Search, Sun, Moon, FileText, ChevronLeft, ChevronRight, Users, LayoutDashboard } from 'lucide-react';

// --- ESTADOS INICIALES (Optimizados fuera del componente para no recrearlos en cada render) ---
const PEDIDO_INICIAL = {
  cliente_id: '', cliente_nombre: '', cliente_telefono: '',
  fecha_produccion: '', fecha_entrega: '', entregado_por: '', costo_envio: 0, comentarios_generales: '',
  items: [{ variante_id: '', cantidad: 0, comentarios: '' }]
};

export default function AdminMonitor() {
  const router = useRouter();

  // Datos principales
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);

  // Paginación y Filtros
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroRango, setFiltroRango] = useState('todo');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Estados de UI y Modales
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [liquidarModal, setLiquidarModal] = useState({ open: false, pedido: null as any, fecha: '', costo_envio: 0, entregado_por: '' });
  const [facturaModal, setFacturaModal] = useState({ open: false, pedido: null as any, folio: '' });

  // Formulario
  const [nuevoPedido, setNuevoPedido] = useState(PEDIDO_INICIAL);

  // --- CONSULTAS A BASE DE DATOS ---
  const fetchPedidos = async () => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_detalles(*, producto_variantes(gramaje, precio_base, productos(nombre))), clientes(nombre_local)')
      // CORRECCIÓN: Ordenar por created_at (fecha y HORA exacta) para garantizar que el más nuevo esté arriba
      .order('created_at', { ascending: false })
      .range(from, to);

    setPedidos(data || []);
  };

  useEffect(() => {
    fetchPedidos();
  }, [page]); // Solo recarga si cambia la página

  useEffect(() => {
    const init = async () => {
      // Verificación de sesión optimizada
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');

      // Carga paralela de catálogos para mayor velocidad
      const [prodsRes, clisRes] = await Promise.all([
        supabase.from('producto_variantes').select('id, gramaje, precio_base, productos(nombre)'),
        supabase.from('clientes').select('id, nombre_local')
      ]);

      if (prodsRes.data) setProductos(prodsRes.data);
      if (clisRes.data) setClientes(clisRes.data);
    };
    init();
  }, [router]);

  // --- LÓGICA DE FILTRADO OPTIMIZADA ---
  const clientesFiltrados = useMemo(() =>
    clientes.filter(c => c.nombre_local?.toLowerCase().includes(filtroCliente.toLowerCase())),
    [clientes, filtroCliente]);

  const pedidosFiltrados = useMemo(() => {
    let filtrados = [...pedidos];
    const hoy = new Date();

    if (filtroRango === 'semana') {
      const haceUnaSemana = new Date(); haceUnaSemana.setDate(hoy.getDate() - 7);
      filtrados = filtrados.filter(p => new Date(p.created_at) >= haceUnaSemana);
    } else if (filtroRango === 'mes') {
      const haceUnMes = new Date(); haceUnMes.setMonth(hoy.getMonth() - 1);
      filtrados = filtrados.filter(p => new Date(p.created_at) >= haceUnMes);
    } else if (filtroRango === 'rango' && fechaInicio && fechaFin) {
      filtrados = filtrados.filter(p => {
        const d = new Date(p.created_at);
        return d >= new Date(fechaInicio) && d <= new Date(fechaFin);
      });
    }

    // Doble garantía de ordenamiento en el frontend usando created_at
    return filtrados.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [pedidos, filtroRango, fechaInicio, fechaFin]);

  // --- FUNCIONES DE ACCIÓN ---
  const capturarPedidoDetallado = async () => {
    let totalCalculado = Number(nuevoPedido.costo_envio) || 0;

    const itemsProcesados = nuevoPedido.items.filter(i => i.variante_id).map(item => {
      const pDb = productos.find(p => p.id === item.variante_id);
      const precioUnitario = pDb ? Number(pDb.precio_base) : 0;
      const subtotalItem = precioUnitario * item.cantidad;
      totalCalculado += subtotalItem;
      return { variante_id: item.variante_id, cantidad: item.cantidad, comentarios: item.comentarios, precio_aplicado: precioUnitario, subtotal: subtotalItem };
    });

    const { data: pedido, error } = await supabase.from('pedidos').insert([{
      cliente_id: nuevoPedido.cliente_id || null,
      cliente_nombre: nuevoPedido.cliente_nombre,
      cliente_telefono: nuevoPedido.cliente_telefono,
      estatus_pedido: 'Pendiente',
      estatus_pago: 'Pendiente',
      precio_total: totalCalculado,
      fecha_pedido: new Date().toISOString().split('T')[0], // La fecha sin hora para logística
      fecha_produccion: nuevoPedido.fecha_produccion || null,
      fecha_entrega: nuevoPedido.fecha_entrega || null,
      entregado_por: nuevoPedido.entregado_por,
      costo_envio: nuevoPedido.costo_envio,
      comentarios: nuevoPedido.comentarios_generales
    }]).select().single();

    if (pedido && !error && itemsProcesados.length > 0) {
      const detalles = itemsProcesados.map(item => ({ pedido_id: pedido.id, ...item }));
      await supabase.from('pedido_detalles').insert(detalles);
      setIsModalOpen(false);
      setNuevoPedido(PEDIDO_INICIAL);
      fetchPedidos();
    }
  };

  const confirmarLiquidacion = async () => {
    const p = liquidarModal.pedido;
    const nuevoTotal = Number(p.precio_total) - Number(p.costo_envio || 0) + Number(liquidarModal.costo_envio || 0);

    const { error } = await supabase.from('pedidos').update({
      estatus_pago: 'Liquidado',
      fecha_produccion: liquidarModal.fecha,
      fecha_entrega: liquidarModal.fecha,
      costo_envio: liquidarModal.costo_envio,
      entregado_por: liquidarModal.entregado_por,
      precio_total: nuevoTotal
    }).eq('id', p.id);

    if (!error) {
      setLiquidarModal({ ...liquidarModal, open: false });
      fetchPedidos();
    }
  };

  const confirmarFactura = async () => {
    const { error } = await supabase.from('pedidos').update({
      folio_factura: facturaModal.folio
    }).eq('id', facturaModal.pedido.id);

    if (!error) {
      setFacturaModal({ ...facturaModal, open: false });
      fetchPedidos();
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors flex">

     

        {/* ÁREA PRINCIPAL */}
        <main className="flex-1 flex flex-col p-8 w-full max-w-[100vw] md:max-w-[calc(100vw-16rem)]">

          {/* HEADER */}
          <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">Monitor Maestro de Pedidos</h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-amber-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button onClick={() => setIsModalOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold shadow-lg transition-colors">
                <Plus size={18} /> Nuevo Pedido
              </button>
            </div>
          </div>

          {/* FILTROS */}
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-4 rounded-xl shadow-md mb-6 flex gap-4 items-center flex-wrap">
            <Filter size={18} className="text-gray-400" />
            <select className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 outline-none" onChange={(e) => setFiltroRango(e.target.value)}>
              <option value="todo">Todos los pedidos</option>
              <option value="semana">Última semana</option>
              <option value="mes">Último mes</option>
              <option value="rango">Rango personalizado</option>
            </select>
            {filtroRango === 'rango' && (
              <div className="flex gap-2">
                <input type="date" className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900" onChange={e => setFechaInicio(e.target.value)} />
                <input type="date" className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900" onChange={e => setFechaFin(e.target.value)} />
              </div>
            )}
          </div>

          {/* TABLA PRINCIPAL CON PAGINACIÓN */}
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl flex flex-col flex-1 overflow-hidden">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="p-4"># Pedido / Cliente</th>
                    <th className="p-4">Fechas Operativas</th>
                    <th className="p-4">Detalle de Carga</th>
                    <th className="p-4 font-medium">Logística / Reparto</th>
                    <th className="p-4 text-right">Finanzas</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
                  {pedidosFiltrados.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-4">
                        <div className="text-amber-600 dark:text-amber-500 font-mono font-bold text-sm"># {p.numero_pedido || p.id.split('-')[0]}</div>
                        <div className="font-semibold mt-0.5">{p.clientes?.nombre_local || p.cliente_nombre || 'Ocasional'}</div>
                      </td>
                      <td className="p-4 space-y-1 font-mono text-[11px]">
                        <div><span className="text-gray-500">Ped:</span> {new Date(p.fecha_pedido).toLocaleDateString()}</div>
                        <div><span className="text-amber-600 dark:text-amber-500">Prod:</span> {p.fecha_produccion || 'N/A'}</div>
                        <div><span className="text-emerald-600 dark:text-emerald-500">Ent:</span> {p.fecha_entrega || 'N/A'}</div>
                      </td>
                      <td className="p-4 space-y-1">
                        <div className="bg-gray-50 dark:bg-gray-900/60 p-2 rounded border border-gray-200 dark:border-gray-800 space-y-1">
                          {p.pedido_detalles?.map((d: any) => (
                            <div key={d.id}>📦 <span className="font-semibold">{d.producto_variantes?.productos?.nombre} ({d.producto_variantes?.gramaje}):</span> {d.cantidad} un.</div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 space-y-1">
                        <div>🚚 Envío: <span className="font-semibold">${Number(p.costo_envio).toFixed(2)}</span></div>
                        <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1"><Truck className="w-3 h-3" /> <span className="font-medium">{p.entregado_por || 'N/A'}</span></div>
                      </td>
                      <td className="p-4 text-right space-y-1">
                        <div className="font-bold text-sm">${Number(p.precio_total).toFixed(2)}</div>
                        <div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] ${p.estatus_pago === 'Liquidado' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'}`}>
                            {p.estatus_pago === 'Liquidado' ? '🟢 Liquidado' : '🔴 Pendiente'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center space-y-2">
                        {p.estatus_pago !== 'Liquidado' ? (
                          <button onClick={() => setLiquidarModal({ open: true, pedido: p, fecha: new Date().toISOString().split('T')[0], costo_envio: Number(p.costo_envio) || 0, entregado_por: p.entregado_por || '' })} className="w-full px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded shadow transition-colors">Liquidar Orden</button>
                        ) : (
                          <div className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded py-1 px-2 text-[10px] flex items-center justify-center gap-1"><FileCheck className="w-3 h-3" /> Cobro Listo</div>
                        )}
                        {p.folio_factura ? (
                          <div className="text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded py-1 px-2 text-[10px] flex flex-col items-center justify-center"><span>Facturado</span><span className="font-mono text-[9px] text-gray-500">{p.folio_factura}</span></div>
                        ) : (
                          <button onClick={() => setFacturaModal({ open: true, pedido: p, folio: p.folio_factura || '' })} className="w-full px-2 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded text-[10px] transition-colors">Solicitar Factura</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors"><ChevronLeft size={16} /> Anterior</button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Página {page + 1}</span>
              <button disabled={pedidos.length < pageSize} onClick={() => setPage(page + 1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors">Siguiente <ChevronRight size={16} /></button>
            </div>
          </div>
        </main>

        {/* MODAL: NUEVA ORDEN */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-extrabold mb-6 flex items-center gap-2"><Plus className="text-amber-500" /> Nueva Orden de Producción</h3>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">1. Información del Cliente</h4>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <input placeholder="Buscar cliente..." className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 pl-10 rounded-lg text-sm" onChange={(e) => setFiltroCliente(e.target.value)} />
                </div>
                <select className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm" onChange={e => setNuevoPedido({ ...nuevoPedido, cliente_id: e.target.value })}>
                  <option value="">Seleccionar cliente registrado o dejar en blanco...</option>
                  {clientesFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre_local}</option>)}
                </select>
              </div>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-3">2. Fechas Operativas y Logística</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="date" className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm" onChange={e => setNuevoPedido({ ...nuevoPedido, fecha_produccion: e.target.value })} />
                  <input type="date" className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm" onChange={e => setNuevoPedido({ ...nuevoPedido, fecha_entrega: e.target.value })} />
                  <select className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm" onChange={e => setNuevoPedido({ ...nuevoPedido, entregado_por: e.target.value })}>
                    <option value="">Sin asignar repartidor</option>
                    <option value="SR. PEPE">SR. PEPE</option><option value="PLAYITA">PLAYITA</option><option value="FELIPE">FELIPE</option>
                  </select>
                  <input type="number" placeholder="Costo Envío ($)" className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm" onChange={e => setNuevoPedido({ ...nuevoPedido, costo_envio: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">3. Carga de Productos</h4>
                {nuevoPedido.items.map((item, idx) => (
                  <div key={idx} className="mb-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                    <div className="flex gap-3 mb-3">
                      <select className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 flex-1 rounded-lg text-sm" onChange={e => {
                        const items = [...nuevoPedido.items]; items[idx].variante_id = e.target.value; setNuevoPedido({ ...nuevoPedido, items });
                      }}>
                        <option value="">Seleccionar producto...</option>
                        {productos.map(p => <option key={p.id} value={p.id}>{p.productos.nombre} ({p.gramaje}) - ${p.precio_base}</option>)}
                      </select>
                      <input type="number" placeholder="Pz" className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 w-24 rounded-lg text-sm" onChange={e => {
                        const items = [...nuevoPedido.items]; items[idx].cantidad = parseInt(e.target.value); setNuevoPedido({ ...nuevoPedido, items });
                      }} />
                    </div>
                  </div>
                ))}
                <button onClick={() => setNuevoPedido({ ...nuevoPedido, items: [...nuevoPedido.items, { variante_id: '', cantidad: 0, comentarios: '' }] })} className="text-amber-600 dark:text-amber-500 font-semibold text-sm hover:underline">+ Agregar otro producto</button>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-semibold border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancelar</button>
                <button onClick={capturarPedidoDetallado} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg transition-colors">Procesar Orden Completa</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: LIQUIDACIÓN */}
        {liquidarModal.open && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-bold mb-4">Confirmar Liquidación</h3>
              <div className="space-y-4">
                <input type="date" value={liquidarModal.fecha} className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm" onChange={e => setLiquidarModal({ ...liquidarModal, fecha: e.target.value })} />
                <select value={liquidarModal.entregado_por} className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm" onChange={e => setLiquidarModal({ ...liquidarModal, entregado_por: e.target.value })}>
                  <option value="">Sin asignar</option>
                  <option value="SR. PEPE">SR. PEPE</option><option value="PLAYITA">PLAYITA</option><option value="FELIPE">FELIPE</option>
                </select>
                <input type="number" value={liquidarModal.costo_envio} placeholder="Costo Envío" className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm" onChange={e => setLiquidarModal({ ...liquidarModal, costo_envio: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => setLiquidarModal({ ...liquidarModal, open: false })} className="flex-1 py-2 font-semibold border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancelar</button>
                <button onClick={confirmarLiquidacion} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-lg transition-colors">Liquidar Orden</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: FACTURACIÓN */}
        {facturaModal.open && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText size={20} className="text-blue-500" /> Solicitar Factura</h3>
              <input type="text" placeholder="Ej. SAT-82931" value={facturaModal.folio} className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm uppercase" onChange={e => setFacturaModal({ ...facturaModal, folio: e.target.value })} />
              <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => setFacturaModal({ ...facturaModal, open: false })} className="flex-1 py-2 font-semibold border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancelar</button>
                <button onClick={confirmarFactura} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg transition-colors">Guardar Folio</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

