'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Plus, Filter, Soup, ShoppingCart, Truck, FileCheck, Search, Sun, Moon, FileText, ChevronLeft, ChevronRight, Users, LayoutDashboard, Printer, Mail, FileCode, Edit3, DollarSign, AlertTriangle } from 'lucide-react';
import { useThemeMode } from '../../../lib/useThemeMode';
import { enviarFacturaPorCorreo } from '../gastos/actions';

// --- ESTADOS INICIALES (Optimizados fuera del componente para no recrearlos en cada render) ---
const PEDIDO_INICIAL = {
  cliente_id: '', cliente_nombre: '', cliente_telefono: '',
  fecha_produccion: '', fecha_entrega: '', entregado_por: '', costo_envio: 0, comentarios_generales: '',
  numero_pedido: '',
  items: [{ variante_id: '', cantidad: 0, comentarios: '' }]
};
export const dynamic = 'force-dynamic';
export default function AdminMonitor() {
  const router = useRouter();

  // Helper de Formato Contable
  const formatCurrency = (val: any) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(num);
  };

  // Datos principales
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [repartidoresList, setRepartidoresList] = useState<any[]>([]);
  const [formasPagoList, setFormasPagoList] = useState<any[]>([]);

  // Paginación y Filtros
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(6);
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroRango, setFiltroRango] = useState('todo');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [busquedaGlobal, setBusquedaGlobal] = useState('');
  const [popupBlockerWarning, setPopupBlockerWarning] = useState(false);

  // Calcular pageSize dinámicamente según la altura del viewport para evitar scroll principal
  useEffect(() => {
    const calcularPageSize = () => {
      const vh = window.innerHeight;
      // Para Monitor de Ventas: padding (64px) + header (60px) + KPIs (120px) + filtros (80px) + cabeceras/márgenes (120px) = 444px
      const espacioDisponible = vh - 450;
      const alturaFila = 85; // Fila de pedido mide aprox 85px de alto
      const filasQueCaben = Math.floor(espacioDisponible / alturaFila);
      setPageSize(Math.max(2, filasQueCaben));
    };

    calcularPageSize();
    window.addEventListener('resize', calcularPageSize);
    return () => window.removeEventListener('resize', calcularPageSize);
  }, []);

  // Estados de UI y Modales
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [liquidarModal, setLiquidarModal] = useState({ open: false, pedido: null as any, fecha: '', costo_envio: 0, entregado_por: '', metodo_pago: '' });
  const [emailModal, setEmailModal] = useState<{ open: boolean; details: any | null }>({ open: false, details: null });
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [editPedidoModal, setEditPedidoModal] = useState({ open: false, pedido: null as any, nuevoNumero: '', nuevoEstatus: '' });

  // Formulario
  const [nuevoPedido, setNuevoPedido] = useState(PEDIDO_INICIAL);
  const [preciosEspecialesCliente, setPreciosEspecialesCliente] = useState<Record<string, number>>({});

  // --- CARGA DE PRECIOS ESPECIALES AL SELECCIONAR CLIENTE EN FORMULARIO ---
  useEffect(() => {
    const fetchPreciosEspeciales = async () => {
      if (!nuevoPedido.cliente_id) {
        setPreciosEspecialesCliente({});
        return;
      }
      try {
        const { data, error } = await supabase
          .from('precios_especiales')
          .select('variante_id, precio_pactado')
          .eq('cliente_id', nuevoPedido.cliente_id);
        
        if (error) throw error;
        
        const mapa: Record<string, number> = {};
        if (data) {
          data.forEach(item => {
            mapa[item.variante_id] = item.precio_pactado;
          });
        }
        setPreciosEspecialesCliente(mapa);
      } catch (err) {
        console.error('Error fetching special prices:', err);
      }
    };
    fetchPreciosEspeciales();
  }, [nuevoPedido.cliente_id]);

  // --- CONSULTAS A BASE DE DATOS ---
  const fetchPedidos = async () => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data } = await supabase
      .from('pedidos')
      .select('*, pedido_detalles(*, producto_variantes(gramaje, precio_base, productos(nombre))), clientes(nombre_local, telefono, rfc)')
      .order('created_at', { ascending: false })
      .range(from, to);

    setPedidos(data || []);
  };

  useEffect(() => {
    fetchPedidos();
  }, [page, pageSize]); 
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/admin/login');

      const [prodsRes, clisRes, repsRes, formasRes] = await Promise.all([
        supabase.from('producto_variantes').select('id, gramaje, precio_base, productos(nombre)'),
        supabase.from('clientes').select('id, nombre_local'),
        supabase.from('repartidores').select('*').order('nombre', { ascending: true }),
        supabase.from('formas_pago').select('*').order('nombre', { ascending: true })
      ]);

      if (prodsRes.data) setProductos(prodsRes.data);
      if (clisRes.data) setClientes(clisRes.data);
      if (repsRes.data) setRepartidoresList(repsRes.data);
      if (formasRes.data) setFormasPagoList(formasRes.data);
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

    if (busquedaGlobal.trim()) {
      const term = busquedaGlobal.toLowerCase().trim();
      filtrados = filtrados.filter(p => {
        const numPedido = p.numero_pedido ? String(p.numero_pedido) : '';
        const idCorto = p.id ? p.id.split('-')[0] : '';
        const clienteNombre = (p.clientes?.nombre_local || p.cliente_nombre || '').toLowerCase();
        const clienteRfc = (p.clientes?.rfc || '').toLowerCase();
        return numPedido.includes(term) || idCorto.includes(term) || clienteNombre.includes(term) || clienteRfc.includes(term);
      });
    }

    return filtrados.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [pedidos, filtroRango, fechaInicio, fechaFin, busquedaGlobal]);

  const kpiMetricas = useMemo(() => {
    let totalIngresos = 0;
    let entregadosCount = 0;
    let pendientesPagoCount = 0;

    pedidosFiltrados.forEach(p => {
      totalIngresos += Number(p.precio_total || 0);
      if (p.estatus_pedido === 'Entregado') {
        entregadosCount++;
      }
      if (p.estatus_pago === 'Pendiente') {
        pendientesPagoCount++;
      }
    });

    return { totalIngresos, entregadosCount, pendientesPagoCount };
  }, [pedidosFiltrados]);

  // --- FUNCIONES DE ACCIÓN ---
  const capturarPedidoDetallado = async () => {
    let totalCalculado = Number(nuevoPedido.costo_envio) || 0;

    const itemsProcesados = nuevoPedido.items.filter(i => i.variante_id).map(item => {
      const pDb = productos.find(p => p.id === item.variante_id);
      const precioPactado = preciosEspecialesCliente[item.variante_id];
      const precioUnitario = precioPactado !== undefined ? Number(precioPactado) : (pDb ? Number(pDb.precio_base) : 0);
      const subtotalItem = precioUnitario * item.cantidad;
      totalCalculado += subtotalItem;
      return { variante_id: item.variante_id, cantidad: item.cantidad, comentarios: item.comentarios, precio_aplicado: precioUnitario, subtotal: subtotalItem };
    });

    const insertPayload: any = {
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
    };

    if (nuevoPedido.numero_pedido && !isNaN(parseInt(nuevoPedido.numero_pedido))) {
      insertPayload.numero_pedido = parseInt(nuevoPedido.numero_pedido);
    }

    const { data: pedido, error } = await supabase.from('pedidos').insert([insertPayload]).select().single();

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
      estatus_pedido: 'Entregado',
      fecha_produccion: liquidarModal.fecha,
      fecha_entrega: liquidarModal.fecha,
      costo_envio: liquidarModal.costo_envio,
      entregado_por: liquidarModal.entregado_por,
      metodo_pago: liquidarModal.metodo_pago,
      precio_total: nuevoTotal
    }).eq('id', p.id);

    if (!error) {
      setLiquidarModal({ open: false, pedido: null, fecha: '', costo_envio: 0, entregado_por: '', metodo_pago: '' });
      fetchPedidos();
    }
  };

  const handleResendInvoice = async (pedidoId: string) => {
    setIsSendingEmail(true);
    try {
      const res = await enviarFacturaPorCorreo(pedidoId);
      if (res.success) {
        setEmailModal({ open: true, details: res });
      } else {
        alert(res.error || 'No se pudo realizar el envío del correo');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error en el servicio de envío de correos: ' + err.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const guardarEdicionPedido = async () => {
    if (!editPedidoModal.nuevoNumero || isNaN(parseInt(editPedidoModal.nuevoNumero))) {
      alert("Por favor ingresa un número de pedido válido.");
      return;
    }
    const { error } = await supabase
      .from('pedidos')
      .update({ 
        numero_pedido: parseInt(editPedidoModal.nuevoNumero),
        estatus_pedido: editPedidoModal.nuevoEstatus
      })
      .eq('id', editPedidoModal.pedido.id);

    if (error) {
      alert("Error al actualizar el pedido: " + error.message);
    } else {
      setEditPedidoModal({ open: false, pedido: null, nuevoNumero: '', nuevoEstatus: '' });
      fetchPedidos();
    }
  };

  const imprimirTicketPOS = async (pedido: any) => {
    try {
      // 1. Obtener la configuración actual del ticket
      const { data: config, error } = await supabase
        .from('configuracion_ticket')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      const activeConfig = config || {
        encabezado: 'RAMEN DE PLAYA\nCalle 8 Nte Local 1',
        pie_pagina: 'Gracias por su compra!',
        logo_url: null,
        promo_tipo: 'ninguno',
        opciones_visualizacion: { mostrar_telefono: true, mostrar_facturacion: true, mostrar_comentarios: true }
      };

      // 2. Abrir ventana de impresión
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (!printWindow) {
        setPopupBlockerWarning(true);
        return;
      }

      // Preparar variables
      const opts = activeConfig.opciones_visualizacion || {};
      const logoHtml = activeConfig.logo_url 
        ? `<img src="${activeConfig.logo_url}" style="filter: grayscale(100%); max-height: 80px; margin: 10px auto; display: block;" />` 
        : '';
      
      const phoneHtml = opts.mostrar_telefono && (pedido.cliente_telefono || pedido.clientes?.telefono)
        ? `<p style="margin: 3px 0;"><strong>Tel:</strong> ${pedido.cliente_telefono || pedido.clientes?.telefono}</p>` 
        : '';
      
      const billingHtml = opts.mostrar_facturacion && pedido.clientes?.rfc
        ? `<p style="margin: 3px 0;"><strong>RFC:</strong> ${pedido.clientes.rfc}</p>` 
        : '';

      const commentsHtml = opts.mostrar_comentarios && pedido.comentarios
        ? `<div class="divider"></div><p style="font-size: 10px; font-style: italic; margin: 5px 0 0 0;"><strong>Notas:</strong> ${pedido.comentarios}</p>` 
        : '';

      // Items table rows
      const itemsHtml = pedido.pedido_detalles?.map((d: any) => {
        const prodNombre = d.producto_variantes?.productos?.nombre || 'Producto';
        const gramaje = d.producto_variantes?.gramaje || '';
        return `
          <tr>
            <td style="padding: 4px 0; max-width: 180px; word-wrap: break-word;">
              ${d.cantidad}x ${prodNombre} ${gramaje ? `(${gramaje})` : ''}
            </td>
            <td style="text-align: right; vertical-align: top; padding: 4px 0;">
              ${formatCurrency(d.subtotal)}
            </td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="2">Sin productos</td></tr>';

      // Promo section
      let promoHtml = '';
      if (activeConfig.promo_tipo === 'imagen' && activeConfig.promo_imagen_url) {
        promoHtml = `
          <div style="text-align: center; margin: 15px 0;">
            <img src="${activeConfig.promo_imagen_url}" style="filter: grayscale(100%); max-width: 120px; display: block; margin: 0 auto;" />
          </div>
        `;
      } else if (activeConfig.promo_tipo === 'qr' && activeConfig.promo_qr_link) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(activeConfig.promo_qr_link)}`;
        promoHtml = `
          <div style="text-align: center; margin: 15px 0; font-family: sans-serif;">
            <img src="${qrUrl}" style="width: 100px; height: 100px; display: block; margin: 0 auto;" />
            ${activeConfig.promo_qr_descripcion ? `<p style="font-size: 9px; font-weight: bold; margin: 5px 0 0 0; text-transform: uppercase;">${activeConfig.promo_qr_descripcion}</p>` : ''}
          </div>
        `;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>Ticket Pedido #${pedido.numero_pedido || pedido.id.split('-')[0]}</title>
            <style>
              @page { size: auto; margin: 0mm; }
              body {
                font-family: 'Courier New', Courier, monospace;
                font-size: 11px;
                line-height: 1.2;
                width: 76mm;
                margin: 0;
                padding: 8mm 4mm;
                box-sizing: border-box;
                color: #000;
                background-color: #fff;
              }
              .text-center { text-align: center; }
              .divider { border-top: 1px dashed #000; margin: 8px 0; }
              table { width: 100%; border-collapse: collapse; }
              .totals-table td { padding: 2px 0; }
              .total-row { font-size: 12px; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="text-center">
              ${logoHtml}
              <p style="font-weight: bold; font-size: 11px; margin: 5px 0 2px 0; white-space: pre-wrap; text-transform: uppercase;">
                ${activeConfig.encabezado || 'SEIMENJO'}
              </p>
            </div>
            <div class="divider"></div>
            <div style="margin-bottom: 5px;">
              <p style="margin: 3px 0;"><strong>Pedido:</strong> #${pedido.numero_pedido || pedido.id.split('-')[0]}</p>
              <p style="margin: 3px 0;"><strong>Fecha:</strong> ${new Date(pedido.created_at).toLocaleString()}</p>
              <p style="margin: 3px 0;"><strong>Cliente:</strong> ${pedido.clientes?.nombre_local || pedido.cliente_nombre || 'Ocasional'}</p>
              ${phoneHtml}
              ${billingHtml}
            </div>
            <div class="divider"></div>
            
            <table>
              <thead>
                <tr style="border-bottom: 1px solid #000;">
                  <th style="text-align: left; padding-bottom: 3px;">Detalle</th>
                  <th style="text-align: right; padding-bottom: 3px;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            
            <div class="divider"></div>
            
            <table class="totals-table">
              <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">${formatCurrency(Number(pedido.precio_total) - Number(pedido.costo_envio || 0))}</td>
              </tr>
              <tr>
                <td>Envío:</td>
                <td style="text-align: right;">${formatCurrency(pedido.costo_envio)}</td>
              </tr>
              <tr class="total-row">
                <td>TOTAL:</td>
                <td style="text-align: right;">${formatCurrency(pedido.precio_total)}</td>
              </tr>
            </table>

            ${commentsHtml}
            
            <div class="divider"></div>
            ${promoHtml}
            
            <p class="text-center" style="font-size: 8px; margin-top: 10px; white-space: pre-wrap;">
              ${activeConfig.pie_pagina || ''}
            </p>

            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err: any) {
      console.error(err);
      alert('Error al generar el ticket: ' + err.message);
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex overflow-hidden">

        {/* ÁREA PRINCIPAL */}
        <main className="flex-1 flex flex-col p-8 w-full max-w-[100vw] md:max-w-[calc(100vw-16rem)] overflow-hidden h-full">

          {/* HEADER */}
          <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">Monitor Maestro de Pedidos</h2>
            <div className="flex items-center gap-3">
              <button onClick={toggleDarkMode} className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-amber-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button onClick={() => setIsModalOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold shadow-lg transition-colors">
                <Plus size={18} /> Nuevo Pedido
              </button>
            </div>
          </div>

          {/* DASHBOARD KPIS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 font-sans">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-amber-500/30 transition-all">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <DollarSign size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Total Ingresos</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white">
                  ${kpiMetricas.totalIngresos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-amber-500/30 transition-all">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                <Truck size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Órdenes Entregadas</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white">
                  {kpiMetricas.entregadosCount} <span className="text-xs font-normal text-gray-400">pedidos</span>
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-amber-500/30 transition-all">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                <ShoppingCart size={24} />
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Cobros Pendientes</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white">
                  {kpiMetricas.pendientesPagoCount} <span className="text-xs font-normal text-gray-400">pedidos</span>
                </span>
              </div>
            </div>
          </div>

          {popupBlockerWarning && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-800 dark:text-amber-400 text-xs flex items-center justify-between gap-3 animate-in fade-in duration-300 font-sans">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <span><strong>Aviso de Impresión:</strong> Las ventanas emergentes están bloqueadas en tu navegador. Por favor habilítalas para esta página para poder imprimir tickets.</span>
              </div>
              <button onClick={() => setPopupBlockerWarning(false)} className="text-amber-500 hover:text-amber-600 font-bold">Entendido</button>
            </div>
          )}

          {/* FILTROS */}
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-4 rounded-xl shadow-md mb-6 flex gap-4 items-center flex-wrap">
            <Filter size={18} className="text-gray-400" />
            <select className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 outline-none text-gray-900 dark:text-white" onChange={(e) => setFiltroRango(e.target.value)}>
              <option value="todo">Todos los pedidos</option>
              <option value="semana">Última semana</option>
              <option value="mes">Último mes</option>
              <option value="rango">Rango personalizado</option>
            </select>

            <div className="relative flex-1 min-w-[200px] font-sans">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por # pedido, cliente o RFC..."
                value={busquedaGlobal}
                onChange={e => setBusquedaGlobal(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
            {filtroRango === 'rango' && (
              <div className="flex gap-4 items-center">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Fecha de Inicio</label>
                  <input type="date" className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ colorScheme: isDarkMode ? 'dark' : 'light' }} onChange={e => setFechaInicio(e.target.value)} />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Fecha de Fin</label>
                  <input type="date" className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ colorScheme: isDarkMode ? 'dark' : 'light' }} onChange={e => setFechaFin(e.target.value)} />
                </div>
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
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-mono font-bold text-sm">
                          <span># {p.numero_pedido || p.id.split('-')[0]}</span>
                          <button
                            onClick={() => setEditPedidoModal({ open: true, pedido: p, nuevoNumero: p.numero_pedido ? String(p.numero_pedido) : '', nuevoEstatus: p.estatus_pedido || 'Pendiente' })}
                            className="p-1 hover:bg-gray-150 dark:hover:bg-gray-800/20 rounded transition-colors text-gray-400 hover:text-amber-600 dark:hover:text-amber-500"
                            title="Editar pedido"
                          >
                            <Edit3 size={12} />
                          </button>
                        </div>
                        <div className="font-semibold mt-0.5 text-gray-900 dark:text-white">{p.clientes?.nombre_local || p.cliente_nombre || 'Ocasional'}</div>
                      </td>
                      <td className="p-4 space-y-1 font-mono text-[11px] text-gray-900 dark:text-white">
                        <div><span className="text-gray-500">Ped:</span> {new Date(p.fecha_pedido).toLocaleDateString()}</div>
                        <div><span className="text-amber-600 dark:text-amber-500">Prod:</span> {p.fecha_produccion || 'N/A'}</div>
                        <div><span className="text-emerald-600 dark:text-emerald-500">Ent:</span> {p.fecha_entrega || 'N/A'}</div>
                      </td>
                      <td className="p-4 space-y-1">
                        <div className="bg-gray-50 dark:bg-gray-900/60 p-2 rounded border border-gray-200 dark:border-gray-800 space-y-1 text-gray-900 dark:text-white">
                          {p.pedido_detalles?.map((d: any) => (
                            <div key={d.id}>📦 <span className="font-semibold">{d.producto_variantes?.productos?.nombre} ({d.producto_variantes?.gramaje}):</span> {d.cantidad} un.</div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 space-y-1 text-gray-900 dark:text-white">
                        <div>🚚 Envío: <span className="font-semibold">{formatCurrency(p.costo_envio)}</span></div>
                        <div className="text-gray-500 dark:text-gray-400 flex items-center gap-1"><Truck className="w-3 h-3" /> <span className="font-medium">{p.entregado_por || 'N/A'}</span></div>
                      </td>
                      <td className="p-4 text-right space-y-1">
                        <div className="font-bold text-sm text-gray-900 dark:text-white">{formatCurrency(p.precio_total)}</div>
                        <div className="text-gray-500 text-[10px] uppercase font-semibold">{p.metodo_pago || ''}</div>
                        <div className="space-y-1 mt-1">
                          <div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${p.estatus_pago === 'Liquidado' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'}`}>
                              {p.estatus_pago === 'Liquidado' ? '🟢 Liquidado' : '🔴 Pendiente'}
                            </span>
                          </div>
                          <div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${p.estatus_pedido === 'Entregado' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20' : p.estatus_pedido === 'Cancelado' ? 'bg-gray-100 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20' : 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'}`}>
                              {p.estatus_pedido || 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center space-y-2">
                        {p.estatus_pago !== 'Liquidado' ? (
                          <button onClick={() => setLiquidarModal({ open: true, pedido: p, fecha: new Date().toISOString().split('T')[0], costo_envio: Number(p.costo_envio) || 0, entregado_por: p.entregado_por || '', metodo_pago: p.metodo_pago || '' })} className="w-full px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded shadow transition-colors">Liquidar Orden</button>
                        ) : (
                          <div className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded py-1 px-2 text-[10px] flex items-center justify-center gap-1"><FileCheck className="w-3 h-3" /> Cobro Listo</div>
                        )}
                        {p.folio_factura ? (
                          <button
                            onClick={() => handleResendInvoice(p.id)}
                            disabled={isSendingEmail}
                            className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded shadow transition-colors text-[10px] flex items-center justify-center gap-1 uppercase font-sans font-semibold disabled:opacity-50"
                          >
                            <Mail size={11} /> Reenviar Factura
                          </button>
                        ) : (
                          <button disabled className="w-full px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 rounded text-[10px] font-sans font-medium cursor-not-allowed">Factura Pendiente</button>
                        )}
                        <button
                          onClick={() => imprimirTicketPOS(p)}
                          className="w-full px-2 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded text-[10px] transition-colors flex items-center justify-center gap-1 shadow-sm uppercase font-sans tracking-wide"
                        >
                          <Printer size={12} /> Ticket
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors"><ChevronLeft size={16} /> Anterior</button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Página {page + 1}</span>
              <button disabled={pedidos.length < pageSize} onClick={() => setPage(page + 1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors">Siguiente <ChevronRight size={16} /></button>
            </div>
          </div>
        </main>

        {/* MODAL: NUEVA ORDEN */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-extrabold mb-6 flex items-center gap-2 text-gray-900 dark:text-white"><Plus className="text-amber-500" /> Nueva Orden de Producción</h3>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-2">Número de Pedido (Manual / Opcional)</label>
                <input type="number" placeholder="Dejar en blanco para autogenerar..." className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-sm" value={nuevoPedido.numero_pedido} onChange={e => setNuevoPedido({ ...nuevoPedido, numero_pedido: e.target.value })} />
              </div>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">1. Información del Cliente</h4>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                  <input placeholder="Buscar cliente..." className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 pl-10 rounded-lg text-sm" onChange={(e) => setFiltroCliente(e.target.value)} />
                </div>
                <select className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2.5 rounded-lg text-sm" onChange={e => setNuevoPedido({ ...nuevoPedido, cliente_id: e.target.value })}>
                  <option value="">Seleccionar cliente registrado o dejar en blanco...</option>
                  {clientesFiltrados.map(c => <option key={c.id} value={c.id}>{c.nombre_local}</option>)}
                </select>
              </div>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase mb-3">2. Fechas Operativas y Logística</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Fecha de Producción</label>
                    <input type="date" className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-sm" style={{ colorScheme: isDarkMode ? 'dark' : 'light' }} onChange={e => setNuevoPedido({ ...nuevoPedido, fecha_produccion: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Fecha de Entrega</label>
                    <input type="date" className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-sm" style={{ colorScheme: isDarkMode ? 'dark' : 'light' }} onChange={e => setNuevoPedido({ ...nuevoPedido, fecha_entrega: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Repartidor Asignado</label>
                    <select className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-sm" value={nuevoPedido.entregado_por} onChange={e => setNuevoPedido({ ...nuevoPedido, entregado_por: e.target.value })}>
                      <option value="">Sin asignar repartidor</option>
                      {repartidoresList.map(r => (
                        <option key={r.id} value={r.nombre}>{r.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Costo de Envío ($)</label>
                    <input type="number" placeholder="0.00" className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-sm" onChange={e => setNuevoPedido({ ...nuevoPedido, costo_envio: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">3. Carga de Productos</h4>
                {nuevoPedido.items.map((item, idx) => (
                  <div key={idx} className="mb-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                    <div className="flex gap-3 mb-3">
                      <select className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 flex-1 rounded-lg text-sm" onChange={e => {
                        const items = [...nuevoPedido.items]; items[idx].variante_id = e.target.value; setNuevoPedido({ ...nuevoPedido, items });
                      }}>
                        <option value="">Seleccionar producto...</option>
                        {productos.map(p => {
                          const precioPactado = preciosEspecialesCliente[p.id];
                          const precioMostrar = precioPactado !== undefined ? precioPactado : p.precio_base;
                          const esEspecial = precioPactado !== undefined;
                          return (
                            <option key={p.id} value={p.id}>
                              {p.productos.nombre} ({p.gramaje}) - ${precioMostrar} {esEspecial ? '(Pactado)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      <input type="number" placeholder="Pz" className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 w-24 rounded-lg text-sm" onChange={e => {
                        const items = [...nuevoPedido.items]; items[idx].cantidad = parseInt(e.target.value); setNuevoPedido({ ...nuevoPedido, items });
                      }} />
                    </div>
                  </div>
                ))}
                <button onClick={() => setNuevoPedido({ ...nuevoPedido, items: [...nuevoPedido.items, { variante_id: '', cantidad: 0, comentarios: '' }] })} className="text-amber-600 dark:text-amber-500 font-semibold text-sm hover:underline">+ Agregar otro producto</button>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-semibold border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancelar</button>
                <button onClick={capturarPedidoDetallado} className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg transition-colors">Procesar Orden Completa</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: LIQUIDACIÓN */}
        {liquidarModal.open && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Confirmar Liquidación</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Fecha Real de Entrega / Pago</label>
                  <input type="date" value={liquidarModal.fecha} className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-sm" style={{ colorScheme: isDarkMode ? 'dark' : 'light' }} onChange={e => setLiquidarModal({ ...liquidarModal, fecha: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Forma de Pago</label>
                  <select value={liquidarModal.metodo_pago} className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-sm" onChange={e => setLiquidarModal({ ...liquidarModal, metodo_pago: e.target.value })}>
                    <option value="">Seleccionar forma de pago...</option>
                    {formasPagoList.map(f => (
                      <option key={f.id} value={f.nombre}>{f.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Repartidor</label>
                  <select value={liquidarModal.entregado_por} className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-sm" onChange={e => setLiquidarModal({ ...liquidarModal, entregado_por: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {repartidoresList.map(r => (
                      <option key={r.id} value={r.nombre}>{r.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Costo de Envío a cobrar ($)</label>
                  <input type="number" value={liquidarModal.costo_envio} placeholder="0.00" className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-sm" onChange={e => setLiquidarModal({ ...liquidarModal, costo_envio: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => setLiquidarModal({ ...liquidarModal, open: false })} className="flex-1 py-2 font-semibold border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancelar</button>
                <button onClick={confirmarLiquidacion} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-lg transition-colors">Liquidar Orden</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SIMULACION CORREO */}
        {emailModal.open && emailModal.details && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 text-gray-900 dark:text-gray-100 animate-in zoom-in-95 duration-200">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl">
              <h3 className="text-xl font-extrabold mb-4 flex items-center gap-2 text-emerald-500">
                <Mail /> Correo de Facturación Enviado (Simulado)
              </h3>
              
              <div className="space-y-4 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 font-mono text-xs space-y-1">
                  <div><span className="text-gray-400">De:</span> facturacion@seimenjo.com</div>
                  <div><span className="text-gray-400">Para:</span> {emailModal.details.email}</div>
                  <div><span className="text-gray-400">Asunto:</span> Factura Electrónica SAT CFDI 4.0 - Pedido #{emailModal.details.numero_pedido}</div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
                  <p>Estimado/a <strong>{emailModal.details.cliente}</strong>,</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Le hacemos llegar la factura correspondiente a su pedido con número <strong>#{emailModal.details.numero_pedido}</strong> por un total de <strong>{formatCurrency(emailModal.details.total)} MXN</strong>.
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    UUID Fiscal: {emailModal.details.uuid_fiscal}
                  </p>
                  
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-1">Archivos Adjuntos (Enlaces Firmados de Storage):</div>
                    <div className="flex flex-wrap gap-2">
                      {emailModal.details.xmlUrl && (
                        <a
                          href={emailModal.details.xmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-lg text-xs font-semibold hover:bg-blue-600/20 transition-all"
                        >
                          <FileCode size={14} /> Descargar XML
                        </a>
                      )}
                      {emailModal.details.pdfUrl && (
                        <a
                          href={emailModal.details.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 text-red-500 border border-red-500/20 rounded-lg text-xs font-semibold hover:bg-red-600/20 transition-all"
                        >
                          <FileText size={14} /> Descargar PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => setEmailModal({ open: false, details: null })}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EDITAR PEDIDO */}
        {editPedidoModal.open && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                <Edit3 size={20} className="text-amber-500" /> Editar Pedido
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Número de Pedido</label>
                  <input
                    type="number"
                    value={editPedidoModal.nuevoNumero}
                    className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2.5 rounded-lg text-sm"
                    onChange={e => setEditPedidoModal({ ...editPedidoModal, nuevoNumero: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Estatus del Pedido</label>
                  <select
                    value={editPedidoModal.nuevoEstatus}
                    className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2.5 rounded-lg text-sm"
                    onChange={e => setEditPedidoModal({ ...editPedidoModal, nuevoEstatus: e.target.value })}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="Pagado">Pagado</option>
                    <option value="Cancelado">Cancelado</option>
                    <option value="Facturado">Facturado</option>
                    <option value="Entregado">Entregado</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => setEditPedidoModal({ open: false, pedido: null, nuevoNumero: '', nuevoEstatus: '' })}
                  className="flex-1 py-2 font-semibold border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarEdicionPedido}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow-lg transition-colors"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
