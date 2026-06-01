  'use client';

  import React, { useState, useEffect, useMemo } from 'react';
  import { useRouter, usePathname } from 'next/navigation';
  import { supabase } from '../../../lib/supabase';
  import { useThemeMode } from '../../../lib/useThemeMode';
  import { Plus, Filter, Soup, ShoppingCart, Truck, FileCheck, Search, Sun, Moon, FileText, ChevronLeft, ChevronRight, Users, Save, Edit3, Trash2 } from 'lucide-react';

  // --- CATÁLOGOS MAESTROS DEL SAT (CFDI 4.0) ---
  const CATALOGO_REGIMEN_FISCAL = [
    { clave: '601', descripcion: 'General de Ley Personas Morales' },
    { clave: '603', descripcion: 'Personas Morales con Fines no Lucrativos' },
    { clave: '605', descripcion: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
    { clave: '606', descripcion: 'Arrendamiento' },
    { clave: '608', descripcion: 'Demás ingresos' },
    { clave: '612', descripcion: 'Personas Físicas con Actividades Empresariales y Profesionales' },
    { clave: '621', descripcion: 'Incorporación Fiscal' },
    { clave: '626', descripcion: 'Régimen Simplificado de Confianza (RESICO)' }
  ];

  const CATALOGO_USO_CFDI = [
    { clave: 'G01', descripcion: 'Adquisición de mercancías' },
    { clave: 'G03', descripcion: 'Gastos en general' },
    { clave: 'D01', descripcion: 'Honorarios médicos, dentales y gastos hospitalarios' },
    { clave: 'I01', descripcion: 'Construcciones' },
    { clave: 'S01', descripcion: 'Sin efectos fiscales' },
    { clave: 'P01', descripcion: 'Por definir' }
  ];

  const PEDIDO_INICIAL = { 
    cliente_id: '', cliente_nombre: '', cliente_telefono: '', 
    fecha_produccion: '', fecha_entrega: '', entregado_por: '', costo_envio: 0, comentarios_generales: '',
    items: [{ variante_id: '', cantidad: 0, comentarios: '' }] 
  };

  const CLIENTE_INICIAL = {
    nombre_local: '', rfc: '', razon_social: '', regimen_fiscal: '',
    codigo_postal: '', uso_cfdi: '', email_facturacion: '', telefono: ''
  };

  export default function AdminMonitor() {
    const router = useRouter();
    const pathname = usePathname(); // <-- NUEVO: Leemos la ruta de Next.js
    
    // Control de Navegación Interna basado en la URL del Layout
    // Si la ruta contiene "clientes" mostramos el módulo, si no, ventas.
    const vistaActiva = pathname?.toLowerCase().includes('clientes') ? 'clientes' : 'ventas';
    
    // Datos principales
    const [pedidos, setPedidos] = useState<any[]>([]);
    const [productos, setProductos] = useState<any[]>([]);
    const [clientes, setClientes] = useState<any[]>([]);
    
    // Paginación y Filtros de Órdenes
    const [page, setPage] = useState(0);
    const pageSize = 10;
    const [filtroCliente, setFiltroCliente] = useState('');
    const [filtroRango, setFiltroRango] = useState('todo');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');

    // Estados de UI y Modales
    const { isDarkMode, toggleDarkMode } = useThemeMode();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
    const [editarClienteModal, setEditarClienteModal] = useState({ open: false, cliente: null as any });
    const [liquidarModal, setLiquidarModal] = useState({ open: false, pedido: null as any, fecha: '', costo_envio: 0, entregado_por: '' });
    const [facturaModal, setFacturaModal] = useState({ open: false, pedido: null as any, folio: '' });
    
    // Formularios
    const [nuevoPedido, setNuevoPedido] = useState(PEDIDO_INICIAL);
    const [nuevoCliente, setNuevoCliente] = useState(CLIENTE_INICIAL);
    const [isLoadingCliente, setIsLoadingCliente] = useState(false);
    const [errorClienteModal, setErrorClienteModal] = useState('');
    const [isLoadingEditarCliente, setIsLoadingEditarCliente] = useState(false);
    const [errorEditarClienteModal, setErrorEditarClienteModal] = useState('');

    // --- CONSULTAS A BASE DE DATOS ---
    const fetchPedidos = async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data } = await supabase
        .from('pedidos')
        .select('*, pedido_detalles(*, producto_variantes(gramaje, precio_base, productos(nombre))), clientes(nombre_local)')
        .order('created_at', { ascending: false }) 
        .range(from, to);
        
      setPedidos(data || []);
    };

    const fetchClientesCompleto = async () => {
      const { data } = await supabase.from('clientes').select('*').order('nombre_local', { ascending: true });
      setClientes(data || []);
    };

    useEffect(() => {
      fetchPedidos();
    }, [page]);

    useEffect(() => {
      const init = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return router.push('/admin/login');
        
        const [prodsRes] = await Promise.all([
          supabase.from('producto_variantes').select('id, gramaje, precio_base, productos(nombre)')
        ]);
        
        if (prodsRes.data) setProductos(prodsRes.data);
        await fetchClientesCompleto();
      };
      init();
    }, [router]);

    // --- LÓGICA DE FILTRADO ---
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
      return filtrados.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [pedidos, filtroRango, fechaInicio, fechaFin]);

    // --- ACCIONES DE PEDIDOS ---
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
          fecha_pedido: new Date().toISOString().split('T')[0],
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

    // --- ACCIONES DE CLIENTES ---
    const guardarClienteFiscal = async () => {
      // Validar que todos los campos sean obligatorios
      if (!nuevoCliente.nombre_local?.trim()) {
        setErrorClienteModal('Nombre Comercial es obligatorio');
        return;
      }
      if (!nuevoCliente.rfc?.trim()) {
        setErrorClienteModal('RFC es obligatorio');
        return;
      }
      if (!nuevoCliente.razon_social?.trim()) {
        setErrorClienteModal('Razón Social es obligatoria');
        return;
      }
      if (!nuevoCliente.codigo_postal?.trim()) {
        setErrorClienteModal('Código Postal es obligatorio');
        return;
      }
      if (!nuevoCliente.telefono?.trim()) {
        setErrorClienteModal('Teléfono es obligatorio');
        return;
      }
      if (!nuevoCliente.email_facturacion?.trim()) {
        setErrorClienteModal('Email de Facturación es obligatorio');
        return;
      }
      if (!nuevoCliente.regimen_fiscal?.trim()) {
        setErrorClienteModal('Régimen Fiscal es obligatorio');
        return;
      }
      if (!nuevoCliente.uso_cfdi?.trim()) {
        setErrorClienteModal('Uso de CFDI es obligatorio');
        return;
      }
      
      setIsLoadingCliente(true);
      setErrorClienteModal('');
      
      try {
        const { error } = await supabase.from('clientes').insert([nuevoCliente]);
        
        if (error) {
          console.error('Error al registrar cliente:', error);
          setErrorClienteModal(`Error al registrar cliente: ${error.message || 'Error desconocido'}`);
          return;
        }
        
        setIsClienteModalOpen(false);
        setNuevoCliente(CLIENTE_INICIAL);
        setErrorClienteModal('');
        fetchClientesCompleto();
      } catch (err: any) {
        console.error('Error inesperado:', err);
        setErrorClienteModal(`Error inesperado: ${err.message || 'Error desconocido'}`);
      } finally {
        setIsLoadingCliente(false);
      }
    };

    const modificarClienteFiscal = async () => {
      const c = editarClienteModal.cliente;
      setIsLoadingEditarCliente(true);
      setErrorEditarClienteModal('');
      
      try {
        const { error } = await supabase.from('clientes').update({
          nombre_local: c.nombre_local, rfc: c.rfc, razon_social: c.razon_social,
          regimen_fiscal: c.regimen_fiscal, codigo_postal: c.codigo_postal,
          uso_cfdi: c.uso_cfdi, email_facturacion: c.email_facturacion, telefono: c.telefono
        }).eq('id', c.id);

        if (error) {
          console.error('Error al actualizar cliente:', error);
          setErrorEditarClienteModal(`Error al actualizar cliente: ${error.message || 'Error desconocido'}`);
          return;
        }
        
        setEditarClienteModal({ open: false, cliente: null });
        setErrorEditarClienteModal('');
        fetchClientesCompleto();
      } catch (err: any) {
        console.error('Error inesperado:', err);
        setErrorEditarClienteModal(`Error inesperado: ${err.message || 'Error desconocido'}`);
      } finally {
        setIsLoadingEditarCliente(false);
      }
    };

    const eliminarCliente = async (id: string) => {
      if (confirm('¿Estás seguro de eliminar este cliente? Se borrarán sus datos fiscales.')) {
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (!error) fetchClientesCompleto();
      }
    };

    const confirmarLiquidacion = async () => {
      const p = liquidarModal.pedido;
      const nuevoTotal = Number(p.precio_total) - Number(p.costo_envio || 0) + Number(liquidarModal.costo_envio || 0);

      const { error } = await supabase.from('pedidos').update({ 
        estatus_pago: 'Liquidado', fecha_produccion: liquidarModal.fecha, fecha_entrega: liquidarModal.fecha,
        costo_envio: liquidarModal.costo_envio, entregado_por: liquidarModal.entregado_por, precio_total: nuevoTotal
      }).eq('id', p.id);

      if (!error) { setLiquidarModal({ ...liquidarModal, open: false }); fetchPedidos(); }
    };

    const confirmarFactura = async () => {
      const { error } = await supabase.from('pedidos').update({ folio_factura: facturaModal.folio }).eq('id', facturaModal.pedido.id);
      if (!error) { setFacturaModal({ ...facturaModal, open: false }); fetchPedidos(); }
    };

    return (
      <div className={`${isDarkMode ? 'dark' : ''}`}>
        <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors flex">
          
          {/* EL ASIDE HA SIDO ELIMINADO AQUÍ PARA QUE TU LAYOUT PRINCIPAL TOME EL CONTROL */}

          {/* ÁREA PRINCIPAL DINÁMICA */}
          <main className="flex-1 flex flex-col p-8 w-full max-w-[100vw] overflow-y-auto">
            
            {/* HEADER GENERAL */}
            <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {vistaActiva === 'ventas' ? 'Monitor Maestro de Pedidos' : 'Catálogo Fiscal de Clientes'}
              </h2>
              <div className="flex items-center gap-3">
                <button onClick={toggleDarkMode} className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-amber-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                {vistaActiva === 'ventas' ? (
                  <button onClick={() => setIsModalOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold shadow-lg transition-colors">
                    <Plus size={18} /> Nuevo Pedido
                  </button>
                ) : (
                  <button onClick={() => setIsClienteModalOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold shadow-lg transition-colors">
                    <Plus size={18} /> Registrar Cliente SAT
                  </button>
                )}
              </div>
            </div>

            {/* VISTA 1: MONITOR DE VENTAS */}
            {vistaActiva === 'ventas' && (
              <div className="flex-1">
                <div className="space-y-4">
                  {pedidos.map(p => (
                    <div key={p.id} className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex justify-between items-center shadow-sm">
                      <div>
                        <span className="font-bold text-lg">{p.clientes?.nombre_local || p.cliente_nombre || 'Cliente Ocasional'}</span>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Estatus: {p.estatus_pedido}</div>
                      </div>
                      <span className="font-bold text-amber-600 text-xl">${p.precio_total}</span>
                    </div>
                  ))}
                  {pedidos.length === 0 && (
                    <div className="text-center text-gray-500 mt-10">
                      No hay pedidos registrados.
                    </div>
                  )}
                </div>
              </div>
            )}
          
            {/* VISTA 2: CATÁLOGO Y EDICIÓN DE CLIENTES */}
            {vistaActiva === 'clientes' && (
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl flex flex-col flex-1 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        <th className="p-4">Nombre Comercial</th>
                        <th className="p-4">Razón Social / RFC</th>
                        <th className="p-4">Régimen Fiscal</th>
                        <th className="p-4">Uso de CFDI</th>
                        <th className="p-4">C.P. / Correo</th>
                        <th className="p-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
                      {clientes.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                          <td className="p-4 font-bold text-amber-600 dark:text-amber-500">{c.nombre_local}</td>
                          <td className="p-4 space-y-0.5">
                            <div className="font-semibold text-gray-900 dark:text-white">{c.razon_social || 'N/A'}</div>
                            <div className="text-gray-400 font-mono text-[11px]">{c.rfc}</div>
                          </td>
                          <td className="p-4 font-medium text-gray-700 dark:text-gray-300">
                            {c.regimen_fiscal ? `${c.regimen_fiscal} - ${CATALOGO_REGIMEN_FISCAL.find(r => r.clave === c.regimen_fiscal)?.descripcion || ''}` : 'No definido'}
                          </td>
                          <td className="p-4 font-medium text-gray-700 dark:text-gray-300">
                            {c.uso_cfdi ? `${c.uso_cfdi} - ${CATALOGO_USO_CFDI.find(u => u.clave === c.uso_cfdi)?.descripcion || ''}` : 'No definido'}
                          </td>
                          <td className="p-4 space-y-0.5">
                            <div className="font-mono text-gray-900 dark:text-white">CP: {c.codigo_postal || 'N/A'}</div>
                            <div className="text-gray-400 text-[11px]">{c.email_facturacion || 'Sin correo'}</div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex gap-2 justify-center">
                              <button 
                                onClick={() => setEditarClienteModal({ open: true, cliente: c })}
                                className="p-2 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:bg-amber-500/20 rounded-lg text-gray-600 dark:text-gray-300 hover:text-amber-500 transition-colors"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button 
                                onClick={() => eliminarCliente(c.id)}
                                className="p-2 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:bg-red-500/20 rounded-lg text-gray-600 dark:text-red-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </main>

          {/* MODAL: NUEVA ORDEN DE PRODUCCIÓN */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100">
                <h3 className="text-xl font-extrabold mb-6 flex items-center gap-2"><Plus className="text-amber-500"/> Nueva Orden de Producción</h3>
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">1. Información del Cliente</h4>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                    <input placeholder="Buscar cliente..." className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 pl-10 rounded-lg text-sm text-gray-900 dark:text-white" onChange={(e) => setFiltroCliente(e.target.value)} />
                  </div>
                  <select className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setNuevoPedido({...nuevoPedido, cliente_id: e.target.value})}>
                    <option value="">Seleccionar cliente registrado o dejar en blanco...</option>
                    {clientesFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre_local}</option>)}
                  </select>
                </div>

                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                  <h4 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-3">2. Fechas Operativas y Logística</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="date" className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" style={{ colorScheme: 'dark' }} onChange={e => setNuevoPedido({...nuevoPedido, fecha_produccion: e.target.value})} />
                    <input type="date" className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" style={{ colorScheme: 'dark' }} onChange={e => setNuevoPedido({...nuevoPedido, fecha_entrega: e.target.value})} />
                    <select className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setNuevoPedido({...nuevoPedido, entregado_por: e.target.value})}>
                      <option value="">Sin asignar repartidor</option>
                      <option value="SR. PEPE">SR. PEPE</option><option value="PLAYITA">PLAYITA</option><option value="FELIPE">FELIPE</option>
                    </select>
                    <input type="number" placeholder="Costo Envío ($)" className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setNuevoPedido({...nuevoPedido, costo_envio: parseFloat(e.target.value) || 0})} />
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">3. Carga de Productos</h4>
                  {nuevoPedido.items.map((item, idx) => (
                    <div key={idx} className="mb-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                      <div className="flex gap-3 mb-3">
                        <select className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 flex-1 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => {
                          const items = [...nuevoPedido.items]; items[idx].variante_id = e.target.value; setNuevoPedido({...nuevoPedido, items});
                        }}>
                          <option value="">Seleccionar producto...</option>
                          {productos.map(p => <option key={p.id} value={p.id}>{p.productos.nombre} ({p.gramaje}) - ${p.precio_base}</option>)}
                        </select>
                        <input type="number" placeholder="Pz" className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 w-24 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => {
                          const items = [...nuevoPedido.items]; items[idx].cantidad = parseInt(e.target.value); setNuevoPedido({...nuevoPedido, items});
                        }} />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setNuevoPedido({...nuevoPedido, items: [...nuevoPedido.items, { variante_id: '', cantidad: 0, comentarios: '' }]})} className="text-amber-600 dark:text-amber-500 font-semibold text-sm hover:underline">+ Agregar otro producto</button>
                </div>

                <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-800">
                  <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-semibold border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors">Cancelar</button>
                  <button onClick={capturarPedidoDetallado} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg transition-colors">Procesar Orden Completa</button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: ALTA FISCAL DE CLIENTE */}
          {isClienteModalOpen && (
            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100">
                <h3 className="text-xl font-extrabold mb-6 flex items-center gap-2"><Users className="text-amber-500"/> Alta Fiscal de Cliente (CFDI 4.0)</h3>
                
                {/* Mostrar mensaje de error si existe */}
                {errorClienteModal && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                    {errorClienteModal}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nombre Comercial / Local *</label>
                      <input type="text" placeholder="Ej. Sakura Ramen" value={nuevoCliente.nombre_local} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setNuevoCliente({...nuevoCliente, nombre_local: e.target.value})} disabled={isLoadingCliente} required />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">RFC *</label>
                      <input type="text" placeholder="Ej. XAXX010101000" value={nuevoCliente.rfc} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white uppercase" onChange={e => setNuevoCliente({...nuevoCliente, rfc: e.target.value})} disabled={isLoadingCliente} required />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Razón Social Fiscal (Exacto como Constancia SAT) *</label>
                    <input type="text" placeholder="Ej. PUBLICO EN GENERAL" value={nuevoCliente.razon_social} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white uppercase" onChange={e => setNuevoCliente({...nuevoCliente, razon_social: e.target.value})} disabled={isLoadingCliente} required />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Código Postal Fiscal *</label>
                      <input type="text" placeholder="Ej. 77710" value={nuevoCliente.codigo_postal} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setNuevoCliente({...nuevoCliente, codigo_postal: e.target.value})} disabled={isLoadingCliente} required />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Teléfono *</label>
                      <input type="tel" placeholder="Ej. +52 9841234567" value={nuevoCliente.telefono} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setNuevoCliente({...nuevoCliente, telefono: e.target.value})} disabled={isLoadingCliente} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Email Envío Facturas *</label>
                      <input type="email" placeholder="correo@cliente.com" value={nuevoCliente.email_facturacion} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setNuevoCliente({...nuevoCliente, email_facturacion: e.target.value})} disabled={isLoadingCliente} required />
                    </div>
                    <div></div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Régimen Fiscal *</label>
                    <select value={nuevoCliente.regimen_fiscal} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setNuevoCliente({...nuevoCliente, regimen_fiscal: e.target.value})} disabled={isLoadingCliente} required>
                      <option value="">Selecciona una opción de la lista...</option>
                      {CATALOGO_REGIMEN_FISCAL.map(r => <option key={r.clave} value={r.clave}>{r.clave} | {r.descripcion}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Uso de CFDI *</label>
                    <select value={nuevoCliente.uso_cfdi} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setNuevoCliente({...nuevoCliente, uso_cfdi: e.target.value})} disabled={isLoadingCliente} required>
                      <option value="">Selecciona uso del comprobante...</option>
                      {CATALOGO_USO_CFDI.map(u => <option key={u.clave} value={u.clave}>{u.clave} | {u.descripcion}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800">
                  <button onClick={() => { setIsClienteModalOpen(false); setErrorClienteModal(''); }} disabled={isLoadingCliente} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancelar</button>
                  <button onClick={guardarClienteFiscal} disabled={isLoadingCliente} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoadingCliente ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Registrando...
                      </>
                    ) : (
                      <>
                        <Save size={16}/> Registrar Cliente
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: MODIFICAR / EDITAR CLIENTE EXISTENTE */}
          {editarClienteModal.open && (
            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100">
                <h3 className="text-xl font-extrabold mb-6 flex items-center gap-2"><Edit3 className="text-amber-500"/> Editar Datos Fiscales</h3>
                
                {/* Mostrar mensaje de error si existe */}
                {errorEditarClienteModal && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                    {errorEditarClienteModal}
                  </div>
                )}
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nombre Comercial *</label>
                      <input type="text" value={editarClienteModal.cliente?.nombre_local || ''} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setEditarClienteModal({open: true, cliente: {...editarClienteModal.cliente, nombre_local: e.target.value}})} disabled={isLoadingEditarCliente} required />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">RFC *</label>
                      <input type="text" value={editarClienteModal.cliente?.rfc || ''} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white uppercase" onChange={e => setEditarClienteModal({open: true, cliente: {...editarClienteModal.cliente, rfc: e.target.value}})} disabled={isLoadingEditarCliente} required />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Razón Social *</label>
                    <input type="text" value={editarClienteModal.cliente?.razon_social || ''} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white uppercase" onChange={e => setEditarClienteModal({open: true, cliente: {...editarClienteModal.cliente, razon_social: e.target.value}})} disabled={isLoadingEditarCliente} required />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Código Postal Fiscal *</label>
                      <input type="text" value={editarClienteModal.cliente?.codigo_postal || ''} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setEditarClienteModal({open: true, cliente: {...editarClienteModal.cliente, codigo_postal: e.target.value}})} disabled={isLoadingEditarCliente} required />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Teléfono *</label>
                      <input type="tel" value={editarClienteModal.cliente?.telefono || ''} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setEditarClienteModal({open: true, cliente: {...editarClienteModal.cliente, telefono: e.target.value}})} disabled={isLoadingEditarCliente} required />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Email Envío Facturas *</label>
                    <input type="email" value={editarClienteModal.cliente?.email_facturacion || ''} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setEditarClienteModal({open: true, cliente: {...editarClienteModal.cliente, email_facturacion: e.target.value}})} disabled={isLoadingEditarCliente} required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Régimen Fiscal *</label>
                    <select value={editarClienteModal.cliente?.regimen_fiscal || ''} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setEditarClienteModal({open: true, cliente: {...editarClienteModal.cliente, regimen_fiscal: e.target.value}})} disabled={isLoadingEditarCliente} required>
                      <option value="">Selecciona una opción...</option>
                      {CATALOGO_REGIMEN_FISCAL.map(r => <option key={r.clave} value={r.clave}>{r.clave} | {r.descripcion}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Uso de CFDI *</label>
                    <select value={editarClienteModal.cliente?.uso_cfdi || ''} className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setEditarClienteModal({open: true, cliente: {...editarClienteModal.cliente, uso_cfdi: e.target.value}})} disabled={isLoadingEditarCliente} required>
                      <option value="">Selecciona uso...</option>
                      {CATALOGO_USO_CFDI.map(u => <option key={u.clave} value={u.clave}>{u.clave} | {u.descripcion}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800">
                  <button onClick={() => { setEditarClienteModal({ open: false, cliente: null }); setErrorEditarClienteModal(''); }} disabled={isLoadingEditarCliente} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Cancelar</button>
                  <button onClick={modificarClienteFiscal} disabled={isLoadingEditarCliente} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoadingEditarCliente ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save size={16}/> Guardar Cambios
                      </>
                    )}
                  </button>
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
                  <input type="date" value={liquidarModal.fecha} className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" style={{ colorScheme: 'dark' }} onChange={e => setLiquidarModal({...liquidarModal, fecha: e.target.value})} />
                  <select value={liquidarModal.entregado_por} className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setLiquidarModal({...liquidarModal, entregado_por: e.target.value})}>
                    <option value="">Sin asignar</option>
                    <option value="SR. PEPE">SR. PEPE</option><option value="PLAYITA">PLAYITA</option><option value="FELIPE">FELIPE</option>
                  </select>
                  <input type="number" value={liquidarModal.costo_envio} placeholder="Costo Envío" className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white" onChange={e => setLiquidarModal({...liquidarModal, costo_envio: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200 dark:border-gray-800">
                  <button onClick={() => setLiquidarModal({...liquidarModal, open: false})} className="flex-1 py-2 font-semibold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancelar</button>
                  <button onClick={confirmarLiquidacion} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-lg transition-colors">Liquidar Orden</button>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: FACTURACIÓN */}
          {facturaModal.open && (
            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><FileText size={20} className="text-blue-500"/> Solicitar Factura</h3>
                <input type="text" placeholder="Ej. SAT-82931" value={facturaModal.folio} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm uppercase text-gray-900 dark:text-white" onChange={e => setFacturaModal({...facturaModal, folio: e.target.value})} />
                <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200 dark:border-gray-800">
                  <button onClick={() => setFacturaModal({...facturaModal, open: false})} className="flex-1 py-2 font-semibold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancelar</button>
                  <button onClick={confirmarFactura} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg transition-colors">Guardar Folio</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }
