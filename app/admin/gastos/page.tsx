'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { useSessionToken } from '../../../lib/hooks/useSessionToken';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import {
  obtenerSignedUrl,
  sincronizarMetodosPagoXml,
  eliminarGasto,
  comprobarEgresoConFacturas
} from './actions';
import {
  autoConciliarMovimientos,
  guardarConciliacionManual,
  desconciliarMovimientoBancario,
  toggleMovimientoVisibilidad,
  actualizarCategoriaMovimientos,
  crearComprobanteDeposito,
  actualizarComprobanteDeposito,
  eliminarComprobanteDeposito,
  eliminarMultiplesComprobantes
} from './reconciliationActions';
import { EditGastoModal, EditMovimientoModal } from './_components/EditModals';
import {
  RefreshCw, CheckCircle, AlertTriangle, Sun, Moon, X,
  Landmark, FileText, Plus, DollarSign, Tag, Receipt
} from 'lucide-react';
import EgresosTab from './_components/EgresosTab';
import BancoTab from './_components/BancoTab';
import CfdiViewerModal from './_components/CfdiViewerModal';
import GastoConciliacionDrawer from './_components/GastoConciliacionDrawer';
import PeriodSelector from '../_components/PeriodSelector';
import { formatCurrency } from '../../../lib/formatters';

export const dynamic = 'force-dynamic';

export default function EgresosModule() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useThemeMode();

  const getSessionToken = useSessionToken();
  const getEmpresaId = useEmpresaId();
  const { selectedMonth, periodStatus, refreshPeriodStatus } = usePeriod();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [cfdiViewerUrl, setCfdiViewerUrl] = useState<string | null>(null);

  // Subtabs en Gastos y Egresos
  const [activeTab, setActiveTab] = useState<'egresos' | 'banco' | 'no_deducibles'>('egresos');
  const [bancoSubTab, setBancoSubTab] = useState<'movimientos' | 'ingresos_comprobantes' | 'cargas' | 'global' | 'comprobantes' | 'no_deducibles'>('movimientos');

  // Estados de datos
  const [gastosFacturados, setGastosFacturados] = useState<any[]>([]);
  const [categoriasGasto, setCategoriasGasto] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [movimientosBancarios, setMovimientosBancarios] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [estatusCatalog, setEstatusCatalog] = useState<any[]>([]);
  const [categoriasMovimiento, setCategoriasMovimiento] = useState<any[]>([]);
  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [gastosPendientes, setGastosPendientes] = useState<any[]>([]);
  const [facturasSueltas, setFacturasSueltas] = useState<any[]>([]);
  const [gastosReconciliables, setGastosReconciliables] = useState<any[]>([]);
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([]);

  // Estados modales & drawer
  const [selectedGastoConciliacion, setSelectedGastoConciliacion] = useState<any | null>(null);
  const [isConciliacionDrawerOpen, setIsConciliacionDrawerOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<any>(null);
  const [editingMovimiento, setEditingMovimiento] = useState<any>(null);

  // Filtros BancoTab
  const [selectedCuentaId, setSelectedCuentaId] = useState('');
  const [busquedaBanco, setBusquedaBanco] = useState('');
  const [filtroBancoEstatus, setFiltroBancoEstatus] = useState('todos');
  const [filtroBancoVisibilidad, setFiltroBancoVisibilidad] = useState('todos');
  const [bancoPage, setBancoPage] = useState(0);
  const [reconcileModal, setReconcileModal] = useState<any>({ open: false, movimiento: null });
  const [manualMatchSearch, setManualMatchSearch] = useState('');
  const [catalogEditModal, setCatalogEditModal] = useState<any>({ open: false });
  const [formasPagoModal, setFormasPagoModal] = useState<any>({ open: false });

  // Modal Comprobación Acumulada
  const [comprobacionAcumuladaModal, setComprobacionAcumuladaModal] = useState<{
    open: boolean;
    egresoPadreId: string;
    seleccionados: string[];
    comentario: string;
    loading: boolean;
    error: string;
  }>({
    open: false,
    egresoPadreId: '',
    seleccionados: [],
    comentario: '',
    loading: false,
    error: ''
  });

  useEffect(() => {
    if (message && message.type !== 'info') {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      // 1. Gastos facturados y no deducibles
      const { data: gFac } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc), categorias_gasto(nombre), padre:gastos!gasto_padre_id(concepto), movimientos_bancarios(*, estatus_conciliacion_bancaria(*), cuentas_bancarias(*))')
        .eq('empresa_id', empresaId)
        .or('uuid_fiscal.not.is.null,es_deducible.eq.false')
        .order('fecha_gasto', { ascending: false });
      setGastosFacturados(gFac || []);

      const { data: cGasto } = await supabase.from('categorias_gasto').select('*').or(`empresa_id.is.null,empresa_id.eq.${empresaId}`).order('nombre');
      setCategoriasGasto(cGasto || []);

      // 2. Formas de pago
      const { data: fpData } = await supabase.from('formas_pago').select('*').order('codigo', { ascending: true });
      setFormasPago(fpData || []);

      // 3. Movimientos Bancarios (Extractos)
      const { data: movs } = await supabase
        .from('movimientos_bancarios')
        .select('*, estatus_conciliacion_bancaria(*), cuentas_bancarias(*), categorias_movimiento_bancario(*)')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });
      setMovimientosBancarios(movs || []);

      // 4. Cuentas Bancarias
      const { data: cBanc } = await supabase.from('cuentas_bancarias').select('*').eq('empresa_id', empresaId);
      setCuentasBancarias(cBanc || []);

      // 5. Estatus y Categorías
      const { data: estCat } = await supabase.from('estatus_conciliacion_bancaria').select('*');
      setEstatusCatalog(estCat || []);

      const { data: catMov } = await supabase.from('categorias_movimiento_bancario').select('*').order('nombre');
      setCategoriasMovimiento(catMov || []);

      // 6. Comprobantes
      const { data: compData } = await supabase
        .from('comprobantes_deposito')
        .select('*, cuentas_bancarias(*), comprobantes_deposito_movimientos(*, movimientos_bancarios(*))')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });
      setComprobantes(compData || []);

      // 7. Gastos reconciliables
      const { data: gReconcile } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto, xml_url, pdf_url, ticket_url, metodo_pago, proveedores(nombre_comercial, rfc)')
        .eq('empresa_id', empresaId)
        .is('movimiento_bancario_id', null)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setGastosReconciliables(gReconcile || []);

      // 8. Gastos pendientes de comprobar (manuales sin XML)
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

      // 9. Facturas XML de gastos sueltas (para comprobación acumulada)
      const { data: fSueltas } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc)')
        .eq('empresa_id', empresaId)
        .not('uuid_fiscal', 'is', null)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setFacturasSueltas(fSueltas || []);

      // 10. Pedidos pendientes
      const { data: pPend } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, precio_total, creado_en, metodo_pago, clientes(nombre_local, rfc)')
        .eq('empresa_id', empresaId)
        .is('movimiento_bancario_id', null)
        .order('creado_en', { ascending: false });
      setPedidosPendientes(pPend || []);

    } catch (err: any) {
      setMessage({ text: 'Error al cargar datos: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleDeleteGasto = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
    try {
      const token = await getSessionToken();
      const res = await eliminarGasto(id, token);
      if (res.success) {
        alert('Gasto eliminado exitosamente');
        fetchData();
      } else {
        alert('Error: ' + res.error);
      }
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const handleUpdateCategoriaGasto = async (gastoId: string, categoriaId: string | null) => {
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

  const handleUpdateCategoriaMovimiento = async (movimientoIds: string | string[], categoriaId: string | null) => {
    try {
      const token = await getSessionToken();
      const ids = Array.isArray(movimientoIds) ? movimientoIds : [movimientoIds];
      const catId = (!categoriaId || categoriaId === '' || categoriaId === 'SIN_CATEGORIA') ? null : categoriaId;
      const res = await actualizarCategoriaMovimientos(ids, catId, token);
      if (res.success) {
        fetchData();
      } else {
        alert('Error al actualizar categoría: ' + res.error);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error al actualizar categoría del movimiento bancario.');
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

  const handleAutoReconcile = async () => {
    setMessage({ text: 'Iniciando conciliación automática...', type: 'info' });
    try {
      const token = await getSessionToken();
      const res = await autoConciliarMovimientos(token);
      if (res.success) {
        setMessage({ text: `Conciliación terminada. Se conciliaron automáticamente ${res.matchedCount} movimientos.`, type: 'success' });
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setMessage({ text: 'Error en auto-conciliación: ' + err.message, type: 'error' });
    }
  };

  const handleOpenReconcileModal = (m: any) => {
    setManualMatchSearch('');
    const isBatch = Array.isArray(m);
    const primaryMov = isBatch ? m[0] : m;

    const linkedGastos: any[] = [];
    const linkedPedidos: any[] = [];
    if (!isBatch && primaryMov.conciliaciones_bancarias) {
      primaryMov.conciliaciones_bancarias.forEach((c: any) => {
        if (c.gasto) linkedGastos.push(c.gasto);
        if (c.pedido) linkedPedidos.push(c.pedido);
      });
    }

    if (linkedGastos.length > 0) {
      setGastosReconciliables((prev) => {
        const existingIds = new Set(prev.map((g) => g.id));
        const newItems = linkedGastos.filter((g) => !existingIds.has(g.id));
        return newItems.length > 0 ? [...newItems, ...prev] : prev;
      });
    }

    const xmlSources: string[] = [];
    if (!isBatch && primaryMov.xml_url) {
      xmlSources.push(...primaryMov.xml_url.split(','));
    }
    linkedGastos.forEach((g) => {
      if (g.xml_url) xmlSources.push(...g.xml_url.split(','));
    });
    const consolidatedXmlUrl = Array.from(new Set(xmlSources.map((s) => s.trim()).filter(Boolean))).join(',');

    setReconcileModal({
      open: true,
      movimiento: primaryMov,
      movimientosBatch: isBatch ? m : undefined,
      xmlUrl: isBatch ? '' : (consolidatedXmlUrl || primaryMov.xml_url || ''),
      pdfFacturaUrl: isBatch ? '' : (primaryMov.pdf_factura_url || ''),
      pdfTicketUrl: isBatch ? '' : (primaryMov.pdf_ticket_url || ''),
      soporteReembolsoUrl: isBatch ? '' : (primaryMov.soporte_reembolso_url || ''),
      storageProvider: primaryMov.storage_provider || 'Supabase',
      gastosSeleccionados: isBatch ? [] : (primaryMov.conciliaciones_bancarias?.filter((c: any) => !!c.gasto).map((c: any) => c.gasto.id) || []),
      pedidosSeleccionados: isBatch ? [] : (primaryMov.conciliaciones_bancarias?.filter((c: any) => !!c.pedido).map((c: any) => c.pedido.id) || []),
      estatusClave: isBatch ? '' : (primaryMov.estatus_conciliacion_bancaria?.clave || ''),
      loading: false,
      error: ''
    });
  };

  const handleSaveManualReconcile = async (
    customGastosIds?: string[],
    customEstatusClave?: string,
    customPedidosIds?: string[],
    comentario?: string
  ) => {
    if (!reconcileModal.movimiento) return;
    
    const gastosIds = customGastosIds || reconcileModal.gastosSeleccionados;
    const pedidosIds = customPedidosIds || reconcileModal.pedidosSeleccionados;
    const estatusClave = customEstatusClave || reconcileModal.estatusClave;
    
    setReconcileModal((prev: any) => ({ 
      ...prev, 
      loading: true, 
      error: '',
      ...(customGastosIds ? { gastosSeleccionados: customGastosIds } : {}),
      ...(customPedidosIds ? { pedidosSeleccionados: customPedidosIds } : {}),
      ...(customEstatusClave ? { estatusClave: customEstatusClave } : {})
    }));
    
    try {
      const token = await getSessionToken();
      const targetMovId = reconcileModal.movimientosBatch && reconcileModal.movimientosBatch.length > 0
        ? reconcileModal.movimientosBatch.map((x: any) => x.id)
        : reconcileModal.movimiento.id;

      const res = await guardarConciliacionManual(targetMovId, {
        gastosIds,
        pedidosIds,
        xmlUrl: reconcileModal.xmlUrl,
        pdfFacturaUrl: reconcileModal.pdfFacturaUrl,
        pdfTicketUrl: reconcileModal.pdfTicketUrl,
        soporteReembolsoUrl: reconcileModal.soporteReembolsoUrl,
        storageProvider: reconcileModal.storageProvider,
        estatusClave,
        comentarios: comentario
      }, token);

      if (res.success) {
        setReconcileModal((prev: any) => ({ ...prev, open: false }));
        setMessage({ text: 'Conciliación guardada correctamente.', type: 'success' });
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setReconcileModal((prev: any) => ({ ...prev, error: err.message || 'Error al guardar conciliación', loading: false }));
    }
  };

  const handleUploadReconciliationFile = async (e: React.ChangeEvent<HTMLInputElement>, field: 'xml' | 'pdf' | 'ticket' | 'soporte_reembolso') => {
    const file = e.target.files?.[0];
    if (!file || !reconcileModal.movimiento) return;

    setReconcileModal((prev: any) => ({ ...prev, loading: true, error: '' }));
    try {
      const timestamp = Date.now();
      const yearMonth = new Date(reconcileModal.movimiento.fecha).toISOString().substring(0, 7);
      const filePath = `reconciliation/${yearMonth}/${timestamp}_${file.name.replace(/\s+/g, '_')}`;

      const { error } = await supabase.storage.from('facturas').upload(filePath, file);
      if (error) throw error;

      const urlField = field === 'xml' ? 'xmlUrl' : field === 'pdf' ? 'pdfFacturaUrl' : field === 'ticket' ? 'pdfTicketUrl' : 'soporteReembolsoUrl';
      setReconcileModal((prev: any) => ({
        ...prev,
        [urlField]: prev[urlField] ? `${prev[urlField]},${filePath}` : filePath
      }));
    } catch (err: any) {
      setReconcileModal((prev: any) => ({ ...prev, error: 'Error al subir archivo: ' + err.message }));
    } finally {
      setReconcileModal((prev: any) => ({ ...prev, loading: false }));
    }
  };

  const handleRemoveReconciliationFile = (field: 'xml' | 'pdf' | 'ticket' | 'soporte_reembolso', indexToRemove: number) => {
    const urlField = field === 'xml' ? 'xmlUrl' : field === 'pdf' ? 'pdfFacturaUrl' : field === 'ticket' ? 'pdfTicketUrl' : 'soporteReembolsoUrl';
    setReconcileModal((prev: any) => {
      const paths = prev[urlField] ? prev[urlField].split(',') : [];
      const newPaths = paths.filter((_: any, idx: number) => idx !== indexToRemove).join(',');
      return {
        ...prev,
        [urlField]: newPaths
      };
    });
  };

  const handleUnlinkReconciliation = async (movimientoId: string) => {
    if (!confirm('¿Estás seguro de que deseas desvincular este movimiento bancario?')) return;
    try {
      const token = await getSessionToken();
      const res = await desconciliarMovimientoBancario(movimientoId, token);
      if (res.success) {
        setMessage({ text: 'Movimiento desconciliado correctamente.', type: 'success' });
        await fetchData();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert('Error al desconciliar: ' + err.message);
    }
  };

  // Movimientos bancarios de egresos / retiros
  const movimientosEgresos = useMemo(() => {
    return movimientosBancarios.filter(m => {
      const concepto = (m.concepto || '').toLowerCase();
      const ref = (m.referencia || '').toUpperCase();
      // Excluir traspasos de caja chica por depósito de ventas hacia banco
      if (concepto.includes('descuento caja chica por depósito') || concepto.includes('deposito de efectivo a banco')) return false;
      if (ref.startsWith('COMPROBANTE_DEPOSITO_')) return false;

      return (
        m.tipo_movimiento === 'Retiro' || 
        m.tipo_movimiento === 'Egreso' || 
        Number(m.retiro || 0) > 0 || 
        Number(m.monto || 0) < 0
      );
    });
  }, [movimientosBancarios]);

  // Filtrado por Mes Seleccionado
  const gastosForSelectedMonth = useMemo(() => {
    if (!selectedMonth) return gastosFacturados;
    return gastosFacturados.filter(g => {
      const mes = g.mes_conciliacion || (g.fecha_gasto ? g.fecha_gasto.substring(0, 7) : (g.fecha_timbrado ? g.fecha_timbrado.substring(0, 7) : ''));
      return mes === selectedMonth;
    });
  }, [gastosFacturados, selectedMonth]);

  const movimientosForSelectedMonth = useMemo(() => {
    return movimientosEgresos.filter(m => {
      const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
      return !selectedMonth || mes === selectedMonth;
    });
  }, [movimientosEgresos, selectedMonth]);

  const comprobantesForSelectedMonth = useMemo(() => {
    return comprobantes.filter(c => {
      if (!c.fecha) return true;
      return !selectedMonth || c.fecha.substring(0, 7) === selectedMonth;
    });
  }, [comprobantes, selectedMonth]);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex flex-col p-6 w-full max-w-[100vw] mx-auto overflow-hidden">
        
        {/* HEADER */}
        <div className="mb-4 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold flex items-center gap-3">
              <Receipt className="text-rose-500 w-7 h-7" /> Gastos, Egresos & Facturas de Proveedores
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Control de facturas XML asignadas, gastos de movimiento de cuenta bancaria y compras no deducibles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm cursor-pointer"
              title="Refrescar datos"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm cursor-pointer"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {/* SUBTABS SUPERIORES DE GASTOS Y EGRESOS */}
        <div className="flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('egresos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'egresos'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <FileText size={15} /> 💸 Facturas y Gastos Asignados ({gastosForSelectedMonth.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('banco');
              setBancoSubTab('movimientos');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'banco' && bancoSubTab === 'movimientos'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <Landmark size={15} /> 🏦 Gastos de Cuenta / Retiros ({movimientosForSelectedMonth.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('no_deducibles');
              setBancoSubTab('no_deducibles');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'no_deducibles' || bancoSubTab === 'no_deducibles'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <Tag size={15} /> ⚠️ No Deducibles (Atemporal)
          </button>
        </div>

        {/* FEEDBACK DE ESTADO */}
        {message && (
          <div className={`p-3 rounded-xl border mb-4 flex items-start justify-between gap-3 animate-in fade-in duration-300 text-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
              : message.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
          }`}>
            <div className="flex items-start gap-2.5">
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              ) : message.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <RefreshCw className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
              )}
              <div className="font-medium">{message.text}</div>
            </div>
            {message.type !== 'info' && (
              <button
                onClick={() => setMessage(null)}
                className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-300 transition-colors p-0.5 rounded-lg shrink-0 cursor-pointer"
                title="Cerrar mensaje"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 flex-1 overflow-hidden min-h-0">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">
            {loading && gastosFacturados.length === 0 && movimientosBancarios.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 text-gray-400 text-xs">
                <RefreshCw className="animate-spin mr-2" size={16} /> Cargando datos de egresos...
              </div>
            ) : (
              <>
                {/* VISTA 1: FACTURAS Y GASTOS ASIGNADOS */}
                {activeTab === 'egresos' && (
                  <EgresosTab
                    gastosFacturados={gastosForSelectedMonth}
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

                {/* VISTA 2 y 3: GASTOS DE CUENTA / RETIROS BANCARIOS Y NO DEDUCIBLES */}
                {(activeTab === 'banco' || activeTab === 'no_deducibles') && (
                  <BancoTab
                    bancoSubTab={bancoSubTab}
                    setBancoSubTab={setBancoSubTab}
                    selectedCuentaId={selectedCuentaId}
                    setSelectedCuentaId={setSelectedCuentaId}
                    comprobantes={comprobantesForSelectedMonth}
                    movimientos={movimientosForSelectedMonth}
                    cuentasBancarias={cuentasBancarias}
                    estatusCatalog={estatusCatalog}
                    categoriasMovimiento={categoriasMovimiento}
                    formasPago={formasPago}
                    gastosFacturados={gastosForSelectedMonth}
                    ventasFacturadas={[]}
                    pedidosPendientes={pedidosPendientes}
                    gastosReconciliables={gastosReconciliables}
                    selectedMonth={selectedMonth}
                    busquedaBanco={busquedaBanco}
                    setBusquedaBanco={setBusquedaBanco}
                    filtroBancoTipo="Retiro"
                    setFiltroBancoTipo={() => {}}
                    filtroBancoEstatus={filtroBancoEstatus}
                    setFiltroBancoEstatus={setFiltroBancoEstatus}
                    filtroBancoVisibilidad={filtroBancoVisibilidad}
                    setFiltroBancoVisibilidad={setFiltroBancoVisibilidad}
                    bancoPage={bancoPage}
                    setBancoPage={setBancoPage}
                    bancoPageSize={20}
                    excelFile={null}
                    isUploading={false}
                    handleExcelUpload={() => {}}
                    handleAutoReconcile={handleAutoReconcile}
                    reconcileModal={reconcileModal}
                    setReconcileModal={setReconcileModal}
                    manualMatchSearch={manualMatchSearch}
                    setManualMatchSearch={setManualMatchSearch}
                    handleOpenReconcileModal={handleOpenReconcileModal}
                    handleSaveReconciliation={handleSaveManualReconcile}
                    handleUploadReconciliationFile={handleUploadReconciliationFile}
                    handleRemoveReconciliationFile={handleRemoveReconciliationFile}
                    handleUnlinkReconciliation={handleUnlinkReconciliation}
                    selectedGlobalDepositId={null}
                    setSelectedGlobalDepositId={() => {}}
                    selectedGlobalPedidosIds={[]}
                    setSelectedGlobalPedidosIds={() => {}}
                    handleGlobalLink={() => {}}
                    catalogEditModal={catalogEditModal}
                    setCatalogEditModal={setCatalogEditModal}
                    handleSaveCatalogItem={() => {}}
                    handleDeleteCatalogItem={() => {}}
                    formasPagoModal={formasPagoModal}
                    setFormasPagoModal={setFormasPagoModal}
                    handleSaveFormaPago={() => {}}
                    handleDeleteFormaPago={() => {}}
                    onEditMovimiento={(mov) => setEditingMovimiento(mov)}
                    handleUpdateCategoria={handleUpdateCategoriaMovimiento}
                    onDownloadFile={handleDownloadFile}
                    onReloadMovimientos={fetchData}
                    handleToggleVisibility={async (id, modulo, visible) => {
                      try {
                        const token = await getSessionToken();
                        await toggleMovimientoVisibilidad(id, modulo, visible, token);
                        fetchData();
                      } catch (err: any) {
                        alert('Error al actualizar visibilidad: ' + err.message);
                      }
                    }}
                    onCrearComprobante={async (payload) => {
                      const token = await getSessionToken();
                      const empId = await getEmpresaId();
                      const res = await crearComprobanteDeposito({...payload, empresaId: empId}, token);
                      if (res.success) fetchData();
                      return res;
                    }}
                    onActualizarComprobante={async (id, payload) => {
                      const token = await getSessionToken();
                      const res = await actualizarComprobanteDeposito(id, payload, token);
                      if (res.success) fetchData();
                      return res;
                    }}
                    onEliminarComprobante={async (id) => {
                      const token = await getSessionToken();
                      const res = await eliminarComprobanteDeposito(id, token);
                      if (res.success) fetchData();
                      return res;
                    }}
                    onEliminarMultiplesComprobantes={async (ids) => {
                      const token = await getSessionToken();
                      const res = await eliminarMultiplesComprobantes(ids, token);
                      if (res.success) fetchData();
                      return res;
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* CFDI XML VIEWER MODAL */}
        {cfdiViewerUrl && (
          <CfdiViewerModal xmlUrl={cfdiViewerUrl} onClose={() => setCfdiViewerUrl(null)} />
        )}

        {/* DRAWER DE CONCILIACIÓN DE GASTO */}
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

        {/* EDIT EXPENSE MODAL */}
        {editingGasto && (
          <EditGastoModal 
            gasto={editingGasto} 
            categorias={categoriasGasto}
            onClose={() => setEditingGasto(null)} 
            onSuccess={() => { setEditingGasto(null); fetchData(); }} 
          />
        )}

        {/* EDIT BANK MOVEMENT MODAL */}
        {editingMovimiento && (
          <EditMovimientoModal
            movimiento={editingMovimiento}
            cuentasBancarias={cuentasBancarias}
            estatusCatalog={estatusCatalog}
            categorias={categoriasMovimiento}
            onClose={() => setEditingMovimiento(null)}
            onSuccess={() => { setEditingMovimiento(null); fetchData(); }}
          />
        )}

        {/* MODAL: COMPROBACIÓN ACUMULADA DE EGRESOS */}
        {comprobacionAcumuladaModal.open && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100 flex flex-col font-sans">
              <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-4 mb-4">
                <div>
                  <h3 className="text-xl font-extrabold flex items-center gap-2 text-rose-600 dark:text-rose-500">
                    <DollarSign /> Comprobación Acumulada de Egresos
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Asocia múltiples facturas XML de proveedores a un único egreso registrado manualmente.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start overflow-hidden flex-1 min-h-0 pr-2">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase block mb-1">1. Selecciona el Egreso Padre (Transferencia / Retiro Manual) *</label>
                  <select
                    value={comprobacionAcumuladaModal.egresoPadreId}
                    onChange={e => setComprobacionAcumuladaModal(prev => ({ ...prev, egresoPadreId: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs outline-none focus:ring-1 focus:ring-rose-500 font-bold"
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
                                isSel ? 'bg-rose-500/10 dark:bg-rose-500/5' : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => {}}
                                  className="rounded border-gray-300 dark:border-gray-700 text-rose-600 focus:ring-rose-500 cursor-pointer"
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
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
                >
                  {comprobacionAcumuladaModal.loading ? 'Comprobando...' : 'Asociar Facturas'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
