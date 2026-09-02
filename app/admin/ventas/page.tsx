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
  enviarFacturaPorCorreo,
  eliminarPedidoSano
} from '../gastos/actions';
import {
  autoConciliarMovimientos,
  guardarConciliacionManual,
  desconciliarMovimientoBancario,
  actualizarCategoriaMovimientos,
  toggleMovimientoVisibilidad
} from '../gastos/reconciliationActions';
import { EditVentaModal, EditMovimientoModal } from '../gastos/_components/EditModals';
import {
  RefreshCw, CheckCircle, AlertTriangle, Layers, Sun, Moon, X,
  Landmark, Ticket, FileText, Plus, Scale, Link2
} from 'lucide-react';
import IngresosTab from '../gastos/_components/IngresosTab';
import BancoTab from '../gastos/_components/BancoTab';
import CfdiViewerModal from '../gastos/_components/CfdiViewerModal';
import PeriodSelector from '../_components/PeriodSelector';

export const dynamic = 'force-dynamic';

export default function VentasFacturadasModule() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useThemeMode();

  const getSessionToken = useSessionToken();
  const getEmpresaId = useEmpresaId();
  const { selectedMonth, periodStatus, refreshPeriodStatus } = usePeriod();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [cfdiViewerUrl, setCfdiViewerUrl] = useState<string | null>(null);

  // Subtabs en Ventas e Ingresos
  const [activeTab, setActiveTab] = useState<'ventas' | 'banco' | 'tickets'>('ventas');
  const [bancoSubTab, setBancoSubTab] = useState<'movimientos' | 'ingresos_comprobantes' | 'cargas' | 'global' | 'comprobantes' | 'no_deducibles'>('movimientos');

  // Estados de datos
  const [ventasFacturadas, setVentasFacturadas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [movimientosBancarios, setMovimientosBancarios] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [estatusCatalog, setEstatusCatalog] = useState<any[]>([]);
  const [categoriasMovimiento, setCategoriasMovimiento] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [comprobantes, setComprobantes] = useState<any[]>([]);

  // Estados modales & edición
  const [editingVenta, setEditingVenta] = useState<any>(null);
  const [editingMovimiento, setEditingMovimiento] = useState<any>(null);
  const [facturacionAcumuladaModal, setFacturacionAcumuladaModal] = useState({ open: false });

  // Filtros BancoTab
  const [busquedaBanco, setBusquedaBanco] = useState('');
  const [filtroBancoEstatus, setFiltroBancoEstatus] = useState('todos');
  const [filtroBancoVisibilidad, setFiltroBancoVisibilidad] = useState('todos');
  const [bancoPage, setBancoPage] = useState(0);
  const [reconcileModal, setReconcileModal] = useState<any>({ isOpen: false, row: null });
  const [manualMatchSearch, setManualMatchSearch] = useState('');
  const [selectedGlobalDepositId, setSelectedGlobalDepositId] = useState<string | null>(null);
  const [selectedGlobalPedidosIds, setSelectedGlobalPedidosIds] = useState<string[]>([]);
  const [catalogEditModal, setCatalogEditModal] = useState<any>({ isOpen: false, item: null, isEditing: false });
  const [formasPagoModal, setFormasPagoModal] = useState<any>({ isOpen: false, item: null, isEditing: false });

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

      // 1. Todas las Ventas
      const { data: vAll } = await supabase
        .from('pedidos')
        .select('*, clientes(nombre_local, rfc, email_facturacion), facturas_clientes(*)')
        .eq('empresa_id', empresaId)
        .neq('estatus_pago', 'Cancelado')
        .order('creado_en', { ascending: false });
      setVentasFacturadas(vAll || []);

      // 2. Clientes
      const { data: cliData } = await supabase
        .from('clientes')
        .select('id, nombre_local, rfc')
        .eq('empresa_id', empresaId)
        .order('nombre_local', { ascending: true });
      setClientes(cliData || []);

      // 3. Movimientos Bancarios (Extractos)
      const { data: movs } = await supabase
        .from('movimientos_bancarios')
        .select('*, estatus_conciliacion_bancaria(*), cuentas_bancarias(*)')
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

      const { data: fpData } = await supabase.from('formas_pago').select('*').order('codigo', { ascending: true });
      setFormasPago(fpData || []);

      // 6. Comprobantes y Fichas de Depósito / Tickets POS / Parrot
      const { data: compData } = await supabase
        .from('comprobantes_deposito')
        .select('*, cuentas_bancarias(*), comprobantes_deposito_movimientos(*, movimientos_bancarios(*))')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });
      setComprobantes(compData || []);

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

  const handleDeleteVenta = async (pedidoId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este pedido facturado y desvincular sus archivos?')) return;
    try {
      const token = await getSessionToken();
      const res = await eliminarPedidoSano(pedidoId, token);
      if (res.success) {
        setMessage({ text: 'Pedido eliminado con éxito.', type: 'success' });
        fetchData();
      } else {
        alert(`Error al eliminar pedido: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const handleUpdateCategoriaMovimiento = async (movimientoIds: string | string[], categoriaId: string | null) => {
    try {
      const token = await getSessionToken();
      const ids = Array.isArray(movimientoIds) ? movimientoIds : [movimientoIds];
      const res = await actualizarCategoriaMovimientos(ids, categoriaId, token);
      if (!res.success) {
        alert(`Error al asignar categoría: ${res.error}`);
      } else {
        fetchData();
      }
    } catch (err: any) {
      alert('Error al actualizar categoría: ' + err.message);
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

  // Filtrado por Mes Seleccionado
  const ventasForSelectedMonth = useMemo(() => {
    if (!selectedMonth) return ventasFacturadas;
    return ventasFacturadas.filter(v => {
      const mes = (v.fecha_pedido || v.creado_en || '').substring(0, 7);
      return mes === selectedMonth;
    });
  }, [ventasFacturadas, selectedMonth]);

  const depositosForSelectedMonth = useMemo(() => {
    const depositos = movimientosBancarios.filter(m => {
      const isDep = m.tipo_movimiento === 'Deposito' || Number(m.deposito || 0) > 0 || Number(m.monto || 0) > 0;
      const concepto = (m.concepto || '').toLowerCase();
      const ref = (m.referencia || '').toUpperCase();
      const isTraspasoVentas = concepto.includes('descuento caja chica por depósito') || ref.startsWith('COMPROBANTE_DEPOSITO_');
      return isDep || isTraspasoVentas;
    });
    return depositos.filter(m => {
      const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
      return !selectedMonth || mes === selectedMonth;
    });
  }, [movimientosBancarios, selectedMonth]);

  const comprobantesForSelectedMonth = useMemo(() => {
    return comprobantes.filter(c => {
      if (!c.fecha) return true;
      return !selectedMonth || c.fecha.substring(0, 7) === selectedMonth;
    });
  }, [comprobantes, selectedMonth]);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex flex-col p-6 w-full max-w-[100vw] mx-auto overflow-hidden">
        
        {/* HEADER & TABS PRINCIPALES */}
        <div className="mb-4 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
          <div>
            <h2 className="text-2xl font-extrabold flex items-center gap-3">
              <Layers className="text-emerald-500 w-7 h-7" /> Ventas, Ingresos & Tickets
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Seguimiento de pedidos liquidados, conciliación con extractos bancarios de depósitos y carga de tickets POS / cortes Parrot.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-650 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm cursor-pointer"
              title="Refrescar datos"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-650 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm cursor-pointer"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN ENTRE VENTAS / DEPÓSITOS / TICKETS */}
        <div className="flex items-center gap-2 mb-4 bg-white dark:bg-gray-950 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 shrink-0 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('ventas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'ventas'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <FileText size={15} /> 📈 Ventas y Pedidos ({ventasForSelectedMonth.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('banco');
              setBancoSubTab('movimientos');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'banco' && bancoSubTab === 'movimientos'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <Landmark size={15} /> 🏦 Depósitos Bancarios ({depositosForSelectedMonth.length})
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('tickets');
              setBancoSubTab('ingresos_comprobantes');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tickets' || (activeTab === 'banco' && bancoSubTab === 'ingresos_comprobantes')
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <Ticket size={15} /> 🎟️ Cargar Tickets y Cortes POS / Parrot ({comprobantesForSelectedMonth.length})
          </button>

          <button
            type="button"
            onClick={() => router.push('/admin/asignacion-xml')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 ml-auto"
            title="Ir a Asignación de Facturas XML a Pedidos por Coincidencia de Importe"
          >
            <Link2 size={15} /> 🔗 Asignación XML a Pedidos
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
            {loading && ventasFacturadas.length === 0 && movimientosBancarios.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 text-gray-400 text-xs">
                <RefreshCw className="animate-spin mr-2" size={16} /> Cargando datos...
              </div>
            ) : (
              <>
                {/* VISTA 1: TABLA DE VENTAS Y FACTURACIÓN */}
                {activeTab === 'ventas' && (
                  <IngresosTab
                    ventasFacturadas={ventasForSelectedMonth}
                    onOpenFacturacionAcumulada={() => setFacturacionAcumuladaModal({ open: true })}
                    onDownloadFile={handleDownloadFile}
                    onSendEmail={handleSendEmail}
                    onViewCfdi={setCfdiViewerUrl}
                    onDeleteVenta={handleDeleteVenta}
                    onEditVenta={setEditingVenta}
                    onRefresh={fetchData}
                  />
                )}

                {/* VISTA 2 y 3: DEPÓSITOS BANCARIOS Y CARGA DE TICKETS / COMPROBANTES */}
                {(activeTab === 'banco' || activeTab === 'tickets') && (
                  <BancoTab
                    bancoSubTab={bancoSubTab}
                    setBancoSubTab={setBancoSubTab}
                    comprobantes={comprobantesForSelectedMonth}
                    movimientos={depositosForSelectedMonth}
                    cuentasBancarias={cuentasBancarias}
                    estatusCatalog={estatusCatalog}
                    categoriasMovimiento={categoriasMovimiento}
                    formasPago={formasPago}
                    gastosFacturados={[]}
                    ventasFacturadas={ventasForSelectedMonth}
                    pedidosPendientes={[]}
                    gastosReconciliables={[]}
                    selectedMonth={selectedMonth}
                    busquedaBanco={busquedaBanco}
                    setBusquedaBanco={setBusquedaBanco}
                    filtroBancoTipo="Deposito"
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
                    selectedGlobalDepositId={selectedGlobalDepositId}
                    setSelectedGlobalDepositId={setSelectedGlobalDepositId}
                    selectedGlobalPedidosIds={selectedGlobalPedidosIds}
                    setSelectedGlobalPedidosIds={setSelectedGlobalPedidosIds}
                    handleGlobalLink={() => {}}
                    catalogEditModal={catalogEditModal}
                    setCatalogEditModal={setCatalogEditModal}
                    handleSaveCatalogItem={() => {}}
                    handleDeleteCatalogItem={() => {}}
                    formasPagoModal={formasPagoModal}
                    setFormasPagoModal={setFormasPagoModal}
                    handleSaveFormaPago={() => {}}
                    handleDeleteFormaPago={() => {}}
                    onDownloadFile={async (url) => {
                      try {
                        const token = await getSessionToken();
                        const res = await obtenerSignedUrl(url, token);
                        if (res.success && res.url) window.open(res.url, '_blank');
                      } catch (err: any) {
                        alert('Error al descargar archivo: ' + err.message);
                      }
                    }}
                    onEditMovimiento={(mov) => setEditingMovimiento(mov)}
                    handleUpdateCategoria={handleUpdateCategoriaMovimiento}
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
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* MODAL DE EDICIÓN DE VENTA */}
        {editingVenta && (
          <EditVentaModal
            venta={editingVenta}
            onClose={() => setEditingVenta(null)}
            onSuccess={() => {
              setEditingVenta(null);
              fetchData();
            }}
          />
        )}

        {/* MODAL DE EDICIÓN DE MOVIMIENTO BANCARIO */}
        {editingMovimiento && (
          <EditMovimientoModal
            isOpen={!!editingMovimiento}
            movimiento={editingMovimiento}
            cuentas={cuentasBancarias}
            estatusList={estatusCatalog}
            categorias={categoriasMovimiento}
            onClose={() => setEditingMovimiento(null)}
            onSuccess={() => {
              setEditingMovimiento(null);
              fetchData();
            }}
          />
        )}

        {/* CFDI VIEWER */}
        {cfdiViewerUrl && (
          <CfdiViewerModal
            xmlUrl={cfdiViewerUrl}
            onClose={() => setCfdiViewerUrl(null)}
          />
        )}
      </div>
    </div>
  );
}
