'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../lib/hooks/useSessionToken';
import { formatCurrency } from '../../../lib/formatters';

// Server Actions
import {
  obtenerSignedUrl,
  enviarFacturaPorCorreo,
  comprobarEgresoConFacturas,
  sincronizarMetodosPagoXml,
  eliminarGasto,
  eliminarPedidoSano,
  eliminarFacturaCliente
} from '../gastos/actions';

// Tabs and Modals Components
import EgresosTab from '../gastos/_components/EgresosTab';
import IngresosTab from '../gastos/_components/IngresosTab';
import CfdiViewerModal from '../gastos/_components/CfdiViewerModal';
import GastoConciliacionDrawer from '../gastos/_components/GastoConciliacionDrawer';
import PeriodSelector from '../_components/PeriodSelector';
import { EditGastoModal, EditVentaModal } from '../gastos/_components/EditModals';

// Icons
import {
  TrendingUp, TrendingDown, Scale, CreditCard, RefreshCw, Sun, Moon,
  Receipt, Layers, DollarSign, Mail, FileCode, FileText, Users
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ContabilidadDashboard() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const getEmpresaId = useEmpresaId();
  const getSessionToken = useSessionToken();
  const { selectedMonth, periodStatus, refreshPeriodStatus } = usePeriod();

  // Active Tab: 'egresos' | 'ingresos'
  const [activeTab, setActiveTab] = useState<'egresos' | 'ingresos'>('egresos');

  // Loading & Message
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Core Data States
  const [gastosFacturados, setGastosFacturados] = useState<any[]>([]);
  const [categoriasGasto, setCategoriasGasto] = useState<any[]>([]);
  const [ventasFacturadas, setVentasFacturadas] = useState<any[]>([]);
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([]);
  const [gastosPendientes, setGastosPendientes] = useState<any[]>([]);
  const [gastosReconciliables, setGastosReconciliables] = useState<any[]>([]);
  const [facturasSueltas, setFacturasSueltas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);

  // Modals & Drawer States
  const [cfdiViewerUrl, setCfdiViewerUrl] = useState<string | null>(null);
  const [selectedGastoConciliacion, setSelectedGastoConciliacion] = useState<any | null>(null);
  const [isConciliacionDrawerOpen, setIsConciliacionDrawerOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<any>(null);
  const [editingVenta, setEditingVenta] = useState<any>(null);

  // Bulk Actions Modals
  const [facturacionAcumuladaModal, setFacturacionAcumuladaModal] = useState({
    open: false,
    clienteId: '',
    pedidos: [] as any[],
    seleccionados: [] as string[],
    folio: '',
    loading: false,
    error: ''
  });

  const [comprobacionAcumuladaModal, setComprobacionAcumuladaModal] = useState({
    open: false,
    egresoPadreId: '',
    seleccionados: [] as string[],
    comentario: '',
    loading: false,
    error: ''
  });

  // Auto-dismiss messages
  useEffect(() => {
    if (message && message.type !== 'info') {
      const timer = setTimeout(() => setMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      // 1. Gastos facturados y no deducibles (con XML o marcados como no deducibles/solo ticket)
      const { data: gFac } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc), categorias_gasto(nombre), padre:gastos!gasto_padre_id(concepto), movimientos_bancarios(*, estatus_conciliacion_bancaria(*), cuentas_bancarias(*))')
        .eq('empresa_id', empresaId)
        .or('uuid_fiscal.not.is.null,es_deducible.eq.false')
        .order('fecha_gasto', { ascending: false });
      setGastosFacturados(gFac || []);

      const { data: cGasto } = await supabase.from('categorias_gasto').select('*').or(`empresa_id.is.null,empresa_id.eq.${empresaId}`).order('nombre');
      setCategoriasGasto(cGasto || []);

      // 2. Todas las Ventas (Facturadas y no Facturadas)
      const { data: vAll } = await supabase
        .from('pedidos')
        .select('*, clientes(nombre_local, rfc, email_facturacion), facturas_clientes(*)')
        .eq('empresa_id', empresaId)
        .neq('estatus_pago', 'Cancelado')
        .order('creado_en', { ascending: false });
      setVentasFacturadas(vAll || []);

      // 2b. Facturas XML de ingreso sin vincular (carga masiva que no encontró un pedido candidato)
      const { data: fIngresosSueltas } = await supabase
        .from('facturas_clientes')
        .select('*, clientes(nombre_local, rfc, email_facturacion), estatus_factura(nombre)')
        .eq('empresa_id', empresaId)
        .is('pedido_id', null)
        .order('fecha_emision', { ascending: false });

      const ventasSueltas = (fIngresosSueltas || []).map((f: any) => ({
        id: f.id,
        numero_pedido: '',
        folio_factura: f.serie_folio || (f.uuid_fiscal ? `UUID:${f.uuid_fiscal.substring(0, 8)}` : ''),
        precio_total: Number(f.total || 0),
        cliente_nombre: f.clientes?.nombre_local,
        fecha_pedido: f.fecha_emision,
        estatus_pago: 'Liquidado',
        clientes: f.clientes,
        facturas_clientes: [f],
        movimiento_bancario_id: f.movimiento_bancario_id ?? null,
        _esFacturaSuelta: true
      }));
      setVentasFacturadas([...ventasSueltas, ...(vAll || [])]);

      // 3. Pedidos pendientes de facturar (solo liquidados)
      const { data: pPend } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, precio_total, cliente_nombre, fecha_pedido')
        .eq('empresa_id', empresaId)
        .is('folio_factura', null)
        .eq('estatus_pago', 'Liquidado')
        .order('creado_en', { ascending: false });
      setPedidosPendientes(pPend || []);

      // 4. Gastos pendientes de facturar/comprobar (egresos manuales sin comprobante)
      const { data: gPend } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto')
        .eq('empresa_id', empresaId)
        .is('uuid_fiscal', null)
        .eq('estatus_facturado', false)
        .eq('es_deducible', true)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setGastosPendientes(gPend || []);

      // 5. Gastos sin conciliar (para conciliación manual: con o sin XML, pero sin movimiento bancario enlazado)
      const { data: gReconcile } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto, xml_url, pdf_url, ticket_url, metodo_pago, proveedores(nombre_comercial, rfc)')
        .eq('empresa_id', empresaId)
        .is('movimiento_bancario_id', null)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setGastosReconciliables(gReconcile || []);

      // 6. Facturas XML de gastos sueltas (para comprobación acumulada)
      const { data: fSueltas } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc)')
        .eq('empresa_id', empresaId)
        .not('uuid_fiscal', 'is', null)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setFacturasSueltas(fSueltas || []);

      // 7. Clientes para facturación acumulada
      const { data: cliData } = await supabase
        .from('clientes')
        .select('id, nombre_local, rfc')
        .eq('empresa_id', empresaId)
        .order('nombre_local', { ascending: true });
      setClientes(cliData || []);



      // 9. Formas de pago del SAT (Catálogo cargado de BD)
      const { data: fpData } = await supabase
        .from('formas_pago')
        .select('*')
        .order('codigo', { ascending: true });
      setFormasPago(fpData || []);

    } catch (err: any) {
      console.error('Error fetching accounting data:', err);
      setMessage({ text: 'Error al cargar datos: ' + (err.message || String(err)), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // --- FILTRADO DE DATOS DEL PERIODO ---
  const filteredGastos = useMemo(() => {
    return gastosFacturados.filter(g => {
      const dateStr = g.fecha_gasto || '';
      return dateStr.substring(0, 7) === selectedMonth;
    });
  }, [gastosFacturados, selectedMonth]);

  const filteredVentas = useMemo(() => {
    return ventasFacturadas.filter(v => {
      const dateStr = v.fecha_pedido || v.creado_en || '';
      return dateStr.substring(0, 7) === selectedMonth;
    });
  }, [ventasFacturadas, selectedMonth]);

  // --- KPIS METRICS CALCULATION ---
  const totalVentasPeriodo = useMemo(() => {
    return filteredVentas
      .filter(v => v.estatus_pago !== 'Cancelado')
      .reduce((sum, v) => sum + Number(v.precio_total || 0), 0);
  }, [filteredVentas]);

  const totalGastosPeriodo = useMemo(() => {
    return filteredGastos
      .filter(g => !g.gasto_padre_id)
      .reduce((sum, g) => sum + Number(g.monto || 0), 0);
  }, [filteredGastos]);

  const totalIvaPeriodo = useMemo(() => {
    return filteredGastos
      .filter(g => !g.gasto_padre_id)
      .reduce((sum, g) => {
        let iva = 0;
        if (g.iva_acreditable !== undefined && g.iva_acreditable !== null) {
          iva = Number(g.iva_acreditable);
        } else if (g.subtotal && Number(g.monto) > Number(g.subtotal)) {
          iva = Number(g.monto) - Number(g.subtotal);
        } else if (g.uuid_fiscal) {
          iva = Number(g.monto) - (Number(g.monto) / 1.16);
        }
        return sum + iva;
      }, 0);
  }, [filteredGastos]);

  const balanceNeto = useMemo(() => {
    return totalVentasPeriodo - totalGastosPeriodo;
  }, [totalVentasPeriodo, totalGastosPeriodo]);

  const gastosBreakdownByMetodo = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredGastos.forEach(g => {
      if (g.gasto_padre_id) return;
      const cod = g.metodo_pago || '99';
      const fp = formasPago.find(f => f.codigo === cod.trim().padStart(2, '0'));
      const label = fp ? `${fp.codigo} - ${fp.nombre}` : `${cod} - Otro`;
      breakdown[label] = (breakdown[label] || 0) + Number(g.monto || 0);
    });
    return breakdown;
  }, [filteredGastos, formasPago]);

  // --- HANDLERS CONTABILIDAD ---
  const handleDownloadFile = async (url: string) => {
    try {
      const token = await getSessionToken();
      const res = await obtenerSignedUrl(url, token);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert(`No se pudo descargar el archivo: ${res.error || 'error desconocido'}`);
      }
    } catch (err: any) {
      alert(`No se pudo descargar el archivo: ${err.message}`);
    }
  };

  const handleSendEmail = async (pedidoId: string) => {
    setMessage({ text: 'Enviando factura por correo...', type: 'info' });
    try {
      const token = await getSessionToken();
      const res = await enviarFacturaPorCorreo(pedidoId, token);
      if (res.success) {
        setMessage({ text: 'Factura enviada con éxito al correo del cliente.', type: 'success' });
      } else {
        alert(res.error || 'No se pudo realizar el envío del correo');
        setMessage(null);
      }
    } catch (err) {
      console.error(err);
      alert('Error en el servicio de envío de correos.');
      setMessage(null);
    }
  };

  const handleDeleteGasto = async (id: string) => {
    if (periodStatus === 'cerrado_definitivo') {
      alert('No se pueden eliminar egresos en un periodo cerrado definitivamente.');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
    const token = await getSessionToken();
    const res = await eliminarGasto(id, token);
    if (res.success) {
      alert('Gasto eliminado exitosamente');
      fetchData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleDeleteVenta = async (id: string) => {
    if (periodStatus === 'cerrado_definitivo') {
      alert('No se pueden eliminar ventas en un periodo cerrado definitivamente.');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar esta venta/pedido?')) return;
    const token = await getSessionToken();
    const res = await eliminarPedidoSano(id, token);
    if (res.success) {
      alert('Venta eliminada exitosamente');
      fetchData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleDeleteFacturaSuelta = async (facturaId: string) => {
    if (periodStatus === 'cerrado_definitivo') {
      alert('No se pueden eliminar facturas en un periodo cerrado definitivamente.');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar esta factura XML de ingreso?')) return;
    const token = await getSessionToken();
    const res = await eliminarFacturaCliente(facturaId, token);
    if (res.success) {
      alert('Factura de ingreso eliminada exitosamente');
      fetchData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleUpdateCategoriaGasto = async (gastoId: string, categoriaId: string | null) => {
    if (periodStatus === 'cerrado_definitivo') {
      alert('No se pueden realizar modificaciones en un periodo cerrado definitivamente.');
      return;
    }
    try {
      const catId = categoriaId === '' ? null : categoriaId;
      const { error } = await supabase
        .from('gastos')
        .update({ categoria_id: catId })
        .eq('id', gastoId);
      
      if (error) throw error;
      setGastosFacturados(prev => prev.map(g => g.id === gastoId ? { ...g, categoria_id: catId } : g));
    } catch (err) {
      console.error(err);
      alert('Error al actualizar categoría del gasto.');
    }
  };



  // --- ACUMULADOS ACCIONES ---
  const handleOpenFacturacionAcumulada = async () => {
    setFacturacionAcumuladaModal(prev => ({ ...prev, open: true }));
  };

  const handleClienteChangeFacturacionAcumulada = async (cId: string) => {
    if (!cId) {
      setFacturacionAcumuladaModal(prev => ({ ...prev, clienteId: '', pedidos: [], seleccionados: [] }));
      return;
    }
    setFacturacionAcumuladaModal(prev => ({ ...prev, clienteId: cId, loading: true, error: '' }));
    try {
      const empresaId = await getEmpresaId();
      const { data: pData, error } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, precio_total, cliente_nombre, fecha_pedido')
        .eq('empresa_id', empresaId)
        .eq('cliente_id', cId)
        .is('folio_factura', null)
        .eq('estatus_pago', 'Liquidado')
        .order('creado_en', { ascending: false });

      if (error) throw error;
      setFacturacionAcumuladaModal(prev => ({ ...prev, pedidos: pData || [], seleccionados: [], loading: false }));
    } catch (err: any) {
      setFacturacionAcumuladaModal(prev => ({ ...prev, error: err.message, loading: false }));
    }
  };

  const ejecutarFacturacionAcumulada = async () => {
    const { seleccionados, folio } = facturacionAcumuladaModal;
    if (seleccionados.length === 0 || !folio.trim()) return;
    setFacturacionAcumuladaModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ folio_factura: folio })
        .in('id', seleccionados);

      if (error) throw error;
      alert('Factura acumulada asignada con éxito.');
      setFacturacionAcumuladaModal({
        open: false, clienteId: '', pedidos: [], seleccionados: [], folio: '', loading: false, error: ''
      });
      await fetchData();
    } catch (err: any) {
      setFacturacionAcumuladaModal(prev => ({ ...prev, error: err.message, loading: false }));
    }
  };

  const ejecutarComprobacionAcumulada = async () => {
    const { egresoPadreId, seleccionados } = comprobacionAcumuladaModal;
    if (!egresoPadreId || seleccionados.length === 0) return;
    setComprobacionAcumuladaModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const token = await getSessionToken();
      const res = await comprobarEgresoConFacturas(egresoPadreId, seleccionados, comprobacionAcumuladaModal.comentario, token);
      if (res.success) {
        alert('Comprobación acumulada guardada con éxito.');
        setComprobacionAcumuladaModal({
          open: false, egresoPadreId: '', seleccionados: [], comentario: '', loading: false, error: ''
        });
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setComprobacionAcumuladaModal(prev => ({ ...prev, error: err.message, loading: false }));
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-full overflow-hidden flex flex-col font-sans`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex overflow-hidden">
        
        {/* MAIN BODY */}
        <main className="flex-1 flex flex-col p-8 w-full min-w-0 mx-auto overflow-hidden h-full compact-container">
          
          {/* HEADER */}
          <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0 compact-margin">
            <div>
              <h2 className="text-3xl font-extrabold flex items-center gap-3 compact-title">
                <Receipt className="text-blue-500 w-8 h-8" /> Módulo de Contabilidad
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
                Administración de egresos, ingresos facturados, control de proveedores y balance contable del periodo.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
              <button
                onClick={fetchData}
                className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
                title="Refrescar datos"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
              <button 
                onClick={toggleDarkMode} 
                className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>

          {/* DASHBOARD KPIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-6 shrink-0 font-sans compact-kpi-grid">
            {/* Ventas */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all compact-kpi-card">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl compact-kpi-icon">
                <TrendingUp size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Total Ingresos (Ventas)</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white block truncate compact-kpi-value">
                  {loading ? '...' : formatCurrency(totalVentasPeriodo)}
                </span>
              </div>
            </div>

            {/* Gastos */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all compact-kpi-card">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl compact-kpi-icon">
                <TrendingDown size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Total Gastos (Egresos)</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white block truncate compact-kpi-value">
                  {loading ? '...' : formatCurrency(totalGastosPeriodo)}
                </span>
              </div>
            </div>

            {/* IVA Acreditable */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all compact-kpi-card">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl compact-kpi-icon">
                <FileCode size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">IVA Acreditable</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 block truncate compact-kpi-value">
                  {loading ? '...' : formatCurrency(totalIvaPeriodo)}
                </span>
              </div>
            </div>

            {/* Balance Neto */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all compact-kpi-card">
              <div className={`p-3 rounded-xl compact-kpi-icon ${balanceNeto >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                <Scale size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Balance Neto</span>
                <span className={`text-2xl font-black block truncate compact-kpi-value ${balanceNeto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {loading ? '...' : formatCurrency(balanceNeto)}
                </span>
              </div>
            </div>

            {/* Egresos por Método de Pago */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex flex-col justify-between hover:border-blue-500/30 transition-all min-h-[110px] compact-kpi-card">
              <div className="flex items-center gap-2 border-b border-gray-150 dark:border-gray-850 pb-1.5 mb-1.5">
                <CreditCard size={16} className="text-blue-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Egresos por Método</span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[70px] space-y-1 pr-1 font-mono text-[10px]">
                {loading ? (
                  <div className="text-gray-400 italic">Cargando...</div>
                ) : Object.keys(gastosBreakdownByMetodo).length > 0 ? (
                  Object.entries(gastosBreakdownByMetodo).map(([metodo, monto]) => (
                    <div key={metodo} className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                      <span className="truncate max-w-[120px]">{metodo}:</span>
                      <span className="font-bold">{formatCurrency(monto)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 italic">Sin egresos en el período</div>
                )}
              </div>
            </div>
          </div>

          {/* TAB BUTTONS */}
          <div className="flex border-b border-gray-200 dark:border-gray-850 mb-6 shrink-0 gap-2">
            <button
              onClick={() => setActiveTab('egresos')}
              className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                activeTab === 'egresos'
                  ? 'border-blue-500 text-blue-500 bg-blue-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <DollarSign size={16} /> Gastos y Egresos
            </button>
            <button
              onClick={() => setActiveTab('ingresos')}
              className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                activeTab === 'ingresos'
                  ? 'border-blue-500 text-blue-500 bg-blue-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Layers size={16} /> Ventas e Ingresos
            </button>

          </div>

          {/* FEEDBACK DE ESTADO */}
          {message && (
            <div className={`p-4 rounded-xl border mb-6 flex items-start justify-between gap-3 animate-in fade-in duration-300 shrink-0 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' :
              message.type === 'error' ? 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30' :
              'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30'
            }`}>
              <span className="text-xs font-bold font-sans">{message.text}</span>
              <button onClick={() => setMessage(null)} className="text-xs font-bold hover:opacity-70 font-sans">✕</button>
            </div>
          )}

          {/* TAB CONTENTS */}
          <div className="flex-1 overflow-hidden flex flex-col relative min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl">
            {activeTab === 'egresos' && (
              <EgresosTab
                gastosFacturados={filteredGastos}
                categorias={categoriasGasto}
                formasPago={formasPago}
                onUpdateCategoria={handleUpdateCategoriaGasto}
                onUpdateMetodoPago={async (id, metodo) => {
                  try {
                    const matchingFp = formasPago.find(f => f.codigo === metodo);
                    const formaPagoId = matchingFp ? matchingFp.id : null;

                    const { error } = await supabase.from('gastos').update({ 
                      metodo_pago: metodo,
                      forma_pago_id: formaPagoId
                    }).eq('id', id);
                    if (error) throw error;
                    
                    setGastosFacturados(prev => prev.map(g => g.id === id ? { 
                      ...g, 
                      metodo_pago: metodo || undefined,
                      forma_pago_id: formaPagoId || undefined
                    } : g));
                  } catch (err: any) {
                    alert('Error al actualizar método de pago: ' + err.message);
                  }
                }}
                onSincronizarPagos={async () => {
                  try {
                    const token = await getSessionToken();
                    const res = await sincronizarMetodosPagoXml(token);
                    if (res.success) {
                      alert(`Sincronización terminada. Se corrigieron ${res.count} registros.`);
                      await fetchData();
                    } else {
                      throw new Error(res.error);
                    }
                  } catch (err: any) {
                    alert(`Error al sincronizar: ${err.message}`);
                  }
                }}
                onOpenComprobacionAcumulada={() => setComprobacionAcumuladaModal(prev => ({ ...prev, open: true }))}
                onDownloadFile={handleDownloadFile}
                onViewCfdi={setCfdiViewerUrl}
                onDeleteGasto={handleDeleteGasto}
                onEditGasto={setEditingGasto}
                onRefresh={fetchData}
                onViewConciliacion={(gasto) => {
                  setSelectedGastoConciliacion(gasto);
                  setIsConciliacionDrawerOpen(true);
                }}
              />
            )}

            {activeTab === 'ingresos' && (
              <IngresosTab
                ventasFacturadas={filteredVentas}
                onOpenFacturacionAcumulada={handleOpenFacturacionAcumulada}
                onDownloadFile={handleDownloadFile}
                onViewCfdi={setCfdiViewerUrl}
                onSendEmail={handleSendEmail}
                onEditVenta={setEditingVenta}
                onDeleteVenta={handleDeleteVenta}
                onDeleteFacturaSuelta={handleDeleteFacturaSuelta}
                onRefresh={fetchData}
              />
            )}



          </div>
        </main>
      </div>

      {/* DRAWER DE CONCILIACIÓN */}
      <GastoConciliacionDrawer
        open={isConciliacionDrawerOpen}
        onClose={() => {
          setIsConciliacionDrawerOpen(false);
          setSelectedGastoConciliacion(null);
        }}
        gasto={selectedGastoConciliacion}
        onRefresh={fetchData}
        onDownloadFile={handleDownloadFile}
        onViewCfdi={setCfdiViewerUrl}
      />

      {/* CFDI XML VIEWER */}
      {cfdiViewerUrl && (
        <CfdiViewerModal xmlUrl={cfdiViewerUrl} onClose={() => setCfdiViewerUrl(null)} />
      )}

      {/* EDIT EXPENSE MODAL */}
      {editingGasto && (
        <EditGastoModal 
          gasto={editingGasto} 
          categorias={categoriasGasto}
          onClose={() => setEditingGasto(null)} 
          onSuccess={() => { setEditingGasto(null); fetchData(); }} 
        />
      )}

      {/* EDIT SALE/ORDER MODAL */}
      {editingVenta && (
        <EditVentaModal 
          venta={editingVenta} 
          onClose={() => setEditingVenta(null)} 
          onSuccess={() => { setEditingVenta(null); fetchData(); }} 
        />
      )}

      {/* MODAL: FACTURACIÓN ACUMULADA */}
      {facturacionAcumuladaModal.open && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 text-gray-900 dark:text-gray-100 flex flex-col font-sans">
            <h3 className="text-xl font-extrabold mb-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
              <Layers /> Facturación Acumulada de Ingresos
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Agrupa múltiples pedidos de venta liquidados y asígnales una sola factura del SAT.
            </p>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[60vh] pr-2">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">1. Selecciona el Cliente *</label>
                <select
                  value={facturacionAcumuladaModal.clienteId}
                  onChange={e => handleClienteChangeFacturacionAcumulada(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                >
                  <option value="">-- Seleccione Cliente --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre_local} ({c.rfc})</option>
                  ))}
                </select>
              </div>

              {facturacionAcumuladaModal.clienteId && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase block mb-2">
                      2. Selecciona Pedidos a Facturar ({facturacionAcumuladaModal.pedidos.length} liquidados pendientes)
                    </label>
                    {facturacionAcumuladaModal.pedidos.length === 0 ? (
                      <div className="text-xs text-gray-400 italic p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        No hay pedidos liquidados pendientes de facturar para este cliente.
                      </div>
                    ) : (
                      <div className="border border-gray-250 dark:border-gray-800 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto divide-y divide-gray-150 dark:divide-gray-850">
                        {facturacionAcumuladaModal.pedidos.map((p: any) => {
                          const isSel = facturacionAcumuladaModal.seleccionados.includes(p.id);
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                setFacturacionAcumuladaModal(prev => {
                                  const n = prev.seleccionados.includes(p.id)
                                    ? prev.seleccionados.filter((id: string) => id !== p.id)
                                    : [...prev.seleccionados, p.id];
                                  return { ...prev, seleccionados: n };
                                });
                              }}
                              className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                isSel ? 'bg-emerald-500/10 dark:bg-emerald-500/5' : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => {}} // handled by outer click
                                  className="rounded border-gray-300 dark:border-gray-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div>
                                  <span className="font-bold text-gray-800 dark:text-gray-200">Pedido #{p.numero_pedido}</span>
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 block">
                                    {p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString() : 'Sin fecha'}
                                  </span>
                                </div>
                              </div>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(p.precio_total)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {facturacionAcumuladaModal.seleccionados.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-850">
                      <label className="text-xs font-bold text-gray-500 uppercase block mb-2">3. Ingresa el Folio de Factura SAT *</label>
                      <input
                        type="text"
                        placeholder="Ej. ACUM-2026-001"
                        value={facturacionAcumuladaModal.folio}
                        onChange={e => setFacturacionAcumuladaModal(prev => ({ ...prev, folio: e.target.value }))}
                        className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs uppercase text-gray-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setFacturacionAcumuladaModal({
                  open: false, clienteId: '', pedidos: [], seleccionados: [], folio: '', loading: false, error: ''
                })}
                disabled={facturacionAcumuladaModal.loading}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarFacturacionAcumulada}
                disabled={facturacionAcumuladaModal.loading || facturacionAcumuladaModal.seleccionados.length === 0 || !facturacionAcumuladaModal.folio.trim()}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
              >
                {facturacionAcumuladaModal.loading ? 'Asignando...' : 'Asignar Factura Acumulada'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPROBACIÓN ACUMULADA DE EGRESOS */}
      {comprobacionAcumuladaModal.open && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100 flex flex-col font-sans">
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-extrabold flex items-center gap-2 text-blue-600 dark:text-blue-500">
                  <DollarSign /> Comprobación Acumulada de Egresos
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Asocia múltiples facturas XML de gastos (proveedores) a un único egreso por transferencia registrado manualmente.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start overflow-hidden flex-1 min-h-0 pr-2">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">1. Selecciona el Egreso Padre (Transferencia registrado manualmente) *</label>
                <select
                  value={comprobacionAcumuladaModal.egresoPadreId}
                  onChange={e => setComprobacionAcumuladaModal(prev => ({ ...prev, egresoPadreId: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                >
                  <option value="">-- Selecciona el Gasto Principal --</option>
                  {gastosPendientes.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.fecha_gasto ? new Date(g.fecha_gasto).toLocaleDateString() : 'Sin fecha'} - {g.concepto} - {formatCurrency(g.monto)}
                    </option>
                  ))}
                </select>
              </div>

              {comprobacionAcumuladaModal.egresoPadreId && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-2">2. Selecciona Facturas XML de Proveedores a Asociar</label>
                  <div className="border border-gray-250 dark:border-gray-850 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto divide-y divide-gray-150 dark:divide-gray-800">
                    {facturasSueltas.length === 0 ? (
                      <div className="text-xs text-gray-400 italic p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        No hay facturas XML pendientes disponibles.
                      </div>
                    ) : (
                      facturasSueltas.map(f => {
                        const isSel = comprobacionAcumuladaModal.seleccionados.includes(f.id);
                        return (
                          <div
                            key={f.id}
                            onClick={() => {
                              setComprobacionAcumuladaModal(prev => {
                                const n = prev.seleccionados.includes(f.id)
                                  ? prev.seleccionados.filter((id: string) => id !== f.id)
                                  : [...prev.seleccionados, f.id];
                                return { ...prev, seleccionados: n };
                              });
                            }}
                            className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                              isSel ? 'bg-blue-500/10 dark:bg-blue-500/5' : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={() => {}}
                                className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <div>
                                <span className="font-bold text-gray-800 dark:text-gray-200">{f.concepto || 'Sin concepto'}</span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 block">
                                  {f.fecha_gasto ? new Date(f.fecha_gasto).toLocaleDateString() : 'Sin fecha'} - RFC: {f.proveedores?.rfc || 'Sin RFC'}
                                </span>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{formatCurrency(f.monto)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800 shrink-0">
              <button
                onClick={() => setComprobacionAcumuladaModal({
                  open: false, egresoPadreId: '', seleccionados: [], comentario: '', loading: false, error: ''
                })}
                disabled={comprobacionAcumuladaModal.loading}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarComprobacionAcumulada}
                disabled={comprobacionAcumuladaModal.loading || !comprobacionAcumuladaModal.egresoPadreId || comprobacionAcumuladaModal.seleccionados.length === 0}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
              >
                {comprobacionAcumuladaModal.loading ? 'Comprobando...' : 'Asociar Facturas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
