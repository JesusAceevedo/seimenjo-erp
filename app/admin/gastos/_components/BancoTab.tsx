'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/BancoTab.tsx
// Tab de Conciliación Bancaria con sub-tabs:
//   1. Movimientos de cuenta (tabla + filtros + paginación)
//   2. Facturación global (depósitos vs. pedidos)
//   3. Catálogo de estatus
//   4. Métodos de pago

import React from 'react';
import {
  FileCode, FileText, CreditCard, List, Scale, Settings,
  ArrowRightLeft, Play, RefreshCw, FileSpreadsheet, Plus, Trash2, Edit3,
  Layers, Check, X, UploadCloud, Paperclip, AlertTriangle, Filter, Eye, Link, Ticket, Landmark,
  Tag, Lock, Unlock
} from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import type { MovimientoBancario, EstatusConciliacion, GastoReconciliable, FormaPago, ComprobanteDeposito } from '../../types';
import { supabase } from '../../../../lib/supabase';
import { getMetodoPagoLabel } from '../../../../lib/constants/sat';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';
import CargasTab from './CargasTab';
import { generarSaldoFavorDesdeConciliacion } from '../../proveedores/proveedoresActions';

// ── Tipos de estado que se pasan como props ──────────────────────────────────

interface ReconcileModalState {
  open: boolean;
  movimiento: any | null;
  movimientosBatch?: any[];
  xmlUrl: string;
  pdfFacturaUrl: string;
  pdfTicketUrl: string;
  soporteReembolsoUrl: string;
  storageProvider: 'Supabase' | 'GoogleDrive';
  gastosSeleccionados: string[];
  pedidosSeleccionados: string[];
  estatusClave: string;
  loading: boolean;
  error: string;
}

interface CatalogEditModalState {
  open: boolean;
  id?: string;
  clave: string;
  nombre: string;
  descripcion: string;
  color: string;
  loading: boolean;
}

interface FormasPagoModalState {
  open: boolean;
  id?: string;
  nombre: string;
  loading: boolean;
}

interface PedidoPendiente {
  id: string;
  numero_pedido: string;
  folio_factura?: string;
  precio_total: number;
  cliente_nombre?: string;
  fecha_pedido?: string;
  metodo_pago?: string;
  uuid_fiscal?: string;
}

export interface BancoTabProps {
  // Sub-tab activo
  bancoSubTab: 'movimientos' | 'ingresos_comprobantes' | 'cargas' | 'global' | 'comprobantes' | 'no_deducibles';
  setBancoSubTab: (sub: 'movimientos' | 'ingresos_comprobantes' | 'cargas' | 'global' | 'comprobantes' | 'no_deducibles') => void;

  token?: string;
  onStartSustituirCarga?: (carga: any) => void;
  onReloadMovimientos?: () => void;
  onOpenUploadModal?: () => void;

  cuentasBancarias?: any[];
  gastosFacturados?: any[];
  ventasFacturadas?: any[];
  handleDeleteMovimiento?: (id: string) => void;
  onEditMovimiento: (movimiento: MovimientoBancario) => void;

  // Datos
  movimientos: MovimientoBancario[];
  estatusCatalog: EstatusConciliacion[];
  formasPago: FormaPago[];
  categoriasMovimiento?: any[];
  pedidosPendientes: PedidoPendiente[];
  gastosReconciliables: GastoReconciliable[];

  // Filtros y búsqueda
  busquedaBanco: string;
  setBusquedaBanco: (v: string) => void;
  filtroBancoTipo: string;
  setFiltroBancoTipo: (v: string) => void;
  filtroBancoEstatus: string;
  setFiltroBancoEstatus: (v: string) => void;
  filtroBancoVisibilidad: string;
  setFiltroBancoVisibilidad: (v: string) => void;

  // Paginación
  bancoPage: number;
  setBancoPage: (p: number) => void;
  bancoPageSize: number;

  // Excel / importación
  excelFile: File | null;
  isUploading: boolean;
  handleExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAutoReconcile: () => void;

  // Conciliación manual
  reconcileModal: ReconcileModalState;
  setReconcileModal: React.Dispatch<React.SetStateAction<ReconcileModalState>>;
  manualMatchSearch: string;
  setManualMatchSearch: (v: string) => void;
  handleOpenReconcileModal?: (m: any) => void;
  handleSaveReconciliation?: (
    customGastosIds?: string[],
    customEstatusClave?: string,
    customPedidosIds?: string[],
    comentario?: string
  ) => void;
  handleUploadReconciliationFile?: (e: React.ChangeEvent<HTMLInputElement>, field: 'xml' | 'pdf' | 'ticket' | 'soporte_reembolso') => Promise<void>;
  handleRemoveReconciliationFile?: (field: 'xml' | 'pdf' | 'ticket' | 'soporte_reembolso', indexToRemove: number) => void;
  handleToggleVisibility: (id: string, modulo: 'egresos'|'ingresos', visible: boolean) => void;
  handleUpdateCategoria?: (movimientoId: string, categoriaId: string) => void;

  // Globalcturación global
  selectedGlobalDepositId: string | null;
  setSelectedGlobalDepositId: (id: string | null) => void;
  selectedGlobalPedidosIds: string[];
  setSelectedGlobalPedidosIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleGlobalLink: () => void;

  // Catálogo de estatus
  catalogEditModal: CatalogEditModalState;
  setCatalogEditModal: React.Dispatch<React.SetStateAction<CatalogEditModalState>>;
  handleSaveCatalogItem: () => void;
  handleDeleteCatalogItem: (id: string) => void;

  // Métodos de pago
  formasPagoModal: FormasPagoModalState;
  setFormasPagoModal: React.Dispatch<React.SetStateAction<FormasPagoModalState>>;
  handleSaveFormaPago: () => void;
  handleDeleteFormaPago: (id: string) => void;

  // Archivos
  onDownloadFile: (url: string) => void;
  onViewCfdi?: (xmlUrl: string) => void;

  // Cuentas
  selectedCuentaId: string;
  setSelectedCuentaId: (id: string) => void;
  handleUnlinkReconciliation?: (movimientoId: string) => void;
  handleBulkMoveMovimientos?: (movimientoIds: string[], cuentaBancariaId: string | null) => Promise<void>;
  handleUpdateMesConciliacion?: (movimientoId: string, mes: string) => Promise<void>;

  comprobantes?: ComprobanteDeposito[];
  selectedMonth?: string;
  onCrearComprobante?: (payload: any) => Promise<any>;
  onActualizarComprobante?: (id: string, payload: any) => Promise<any>;
  onEliminarComprobante?: (id: string) => Promise<any>;
  onVincularComprobante?: (comprobanteId: string, movimientoBancarioId: string, montoAsociado?: number) => Promise<any>;
  onDesvincularComprobante?: (comprobanteId: string, movimientoBancarioId?: string | null) => Promise<any>;
  onFusionarReembolso?: (movId1: string, movId2: string, payload: { soporteReembolsoUrl?: string | null; comentarios?: string | null }) => Promise<any>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function matchesAmount(amountVal: number | string | null | undefined, search: string): boolean {
  if (amountVal === undefined || amountVal === null || !search.trim()) return false;
  const num = typeof amountVal === 'number' ? amountVal : parseFloat(String(amountVal).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return false;

  const numAbs = Math.abs(num);
  const numStr = numAbs.toString();
  const numFixed = numAbs.toFixed(2);
  const numFmt = formatCurrency(numAbs).toLowerCase();
  const numCleanDigits = numFixed.replace(/[^0-9]/g, '');

  const searchLower = search.toLowerCase().trim();
  const searchCleanDigits = searchLower.replace(/[^0-9]/g, '');

  if (numStr.includes(searchLower) || numFixed.includes(searchLower) || numFmt.includes(searchLower)) {
    return true;
  }

  if (searchCleanDigits.length >= 2 && numCleanDigits.includes(searchCleanDigits)) {
    return true;
  }

  return false;
}

function filterMovimientos(
  movimientos: MovimientoBancario[],
  busqueda: string,
  tiposSelected: string[],
  estatusSelected: string[],
  visibilidadesSelected: string[],
  categoriasSelected: string[],
  cuentaId: string
): MovimientoBancario[] {
  // Pass 1: identificar todos los IDs de Gastos y Pedidos que coinciden directamente con la búsqueda o cuyos movimientos vinculados coinciden
  const matchingGastoIds = new Set<string>();
  const matchingPedidoIds = new Set<string>();

  if (busqueda.trim()) {
    const b = busqueda.toLowerCase().trim();

    // Calcular mapa de totales acumulados combinados para cada gasto y pedido
    const gastoCombinedTotalMap: Record<string, number> = {};
    const pedidoCombinedTotalMap: Record<string, number> = {};

    movimientos.forEach((m) => {
      if (m.conciliaciones_bancarias) {
        m.conciliaciones_bancarias.forEach((link: any) => {
          if (link.gasto?.id) {
            const gId = link.gasto.id;
            const amt = Number(link.monto_asociado || link.gasto.monto || 0);
            gastoCombinedTotalMap[gId] = (gastoCombinedTotalMap[gId] || 0) + amt;
          }
          if (link.pedido?.id) {
            const pId = link.pedido.id;
            const amt = Number(link.monto_asociado || link.pedido.precio_total || 0);
            pedidoCombinedTotalMap[pId] = (pedidoCombinedTotalMap[pId] || 0) + amt;
          }
        });
      }
    });

    movimientos.forEach((m) => {
      const isDirectMatch =
        m.concepto?.toLowerCase().includes(b) ||
        m.referencia?.toLowerCase().includes(b) ||
        m.rfc_proveedor?.toLowerCase().includes(b) ||
        matchesAmount(m.monto, b) ||
        matchesAmount(m.retiro, b) ||
        matchesAmount(m.deposito, b);

      if (m.conciliaciones_bancarias) {
        let totalMovAcumulado = 0;
        m.conciliaciones_bancarias.forEach((link: any) => {
          const g = link.gasto;
          if (g) {
            const combinedTotal = gastoCombinedTotalMap[g.id] || g.monto;
            totalMovAcumulado += Number(link.monto_asociado || g.monto || 0);

            const gastoMatches =
              isDirectMatch ||
              g.concepto?.toLowerCase().includes(b) ||
              g.uuid_fiscal?.toLowerCase().includes(b) ||
              g.folio_factura?.toLowerCase().includes(b) ||
              g.proveedores?.nombre_comercial?.toLowerCase().includes(b) ||
              g.proveedores?.rfc?.toLowerCase().includes(b) ||
              matchesAmount(g.monto, b) ||
              matchesAmount(link.monto_asociado, b) ||
              matchesAmount(combinedTotal, b);

            if (gastoMatches) {
              matchingGastoIds.add(g.id);
            }
          }

          const p = link.pedido;
          if (p) {
            const combinedTotal = pedidoCombinedTotalMap[p.id] || p.precio_total;
            totalMovAcumulado += Number(link.monto_asociado || p.precio_total || 0);

            const pedidoMatches =
              isDirectMatch ||
              p.numero_pedido?.toLowerCase().includes(b) ||
              p.folio_factura?.toLowerCase().includes(b) ||
              p.cliente_nombre?.toLowerCase().includes(b) ||
              p.clientes?.nombre_local?.toLowerCase().includes(b) ||
              p.clientes?.rfc?.toLowerCase().includes(b) ||
              matchesAmount(p.precio_total, b) ||
              matchesAmount(link.monto_asociado, b) ||
              matchesAmount(combinedTotal, b);

            if (pedidoMatches) {
              matchingPedidoIds.add(p.id);
            }
          }
        });

        if (matchesAmount(totalMovAcumulado, b)) {
          m.conciliaciones_bancarias.forEach((link: any) => {
            if (link.gasto?.id) matchingGastoIds.add(link.gasto.id);
            if (link.pedido?.id) matchingPedidoIds.add(link.pedido.id);
          });
        }
      }
    });
  }

  return movimientos.filter((m) => {
    if (cuentaId && m.cuenta_bancaria_id !== cuentaId) return false;
    if (busqueda.trim()) {
      const b = busqueda.toLowerCase().trim();
      const directMatch =
        m.concepto?.toLowerCase().includes(b) ||
        m.referencia?.toLowerCase().includes(b) ||
        m.rfc_proveedor?.toLowerCase().includes(b) ||
        matchesAmount(m.monto, b) ||
        matchesAmount(m.retiro, b) ||
        matchesAmount(m.deposito, b);

      const hasMatchingLink = m.conciliaciones_bancarias?.some((link: any) => {
        return (
          (link.gasto && matchingGastoIds.has(link.gasto.id)) ||
          (link.pedido && matchingPedidoIds.has(link.pedido.id))
        );
      });

      if (!directMatch && !hasMatchingLink) return false;
    }
    
    // Tipo filter (EXCLUSION: checked = hide)
    if (tiposSelected.length > 0) {
      const rawType = (m.tipo_movimiento || '').toLowerCase();
      const isRetiro = rawType === 'retiro' || rawType === 'cargo' || rawType === 'egreso' || Number(m.retiro || 0) > 0 || (Number(m.monto || 0) < 0);
      const isDeposito = rawType === 'deposito' || rawType === 'abono' || rawType === 'ingreso' || Number(m.deposito || 0) > 0 || (Number(m.monto || 0) > 0 && !isRetiro);

      if (isDeposito && tiposSelected.includes('Deposito')) return false;
      if (isRetiro && tiposSelected.includes('Retiro')) return false;
    }
    
    // Estatus filter (EXCLUSION: checked = hide)
    if (estatusSelected.length > 0) {
      const estatusClave = m.estatus_conciliacion_bancaria?.clave || 'pendiente';
      if (estatusSelected.includes(estatusClave)) return false;
    }
    
    // Visibilidad filter (EXCLUSION: checked = hide)
    if (visibilidadesSelected.length > 0) {
      if (visibilidadesSelected.includes('visibles_egresos') && m.visible_egresos) return false;
      if (visibilidadesSelected.includes('visibles_ingresos') && m.visible_ingresos) return false;
      if (visibilidadesSelected.includes('ocultos') && !m.visible_egresos && !m.visible_ingresos) return false;
    }

    // Categoría filter (EXCLUSION: checked = hide)
    if (categoriasSelected.length > 0) {
      const catId = m.categoria_movimiento_id || m.categoria_id || m.categorias_movimiento_bancario?.id;
      const catNombre = m.categorias_movimiento_bancario?.nombre;

      const isSinCategoria = !catId && !catNombre;
      if (isSinCategoria && categoriasSelected.includes('sin_categoria')) return false;
      if (catId && categoriasSelected.includes(catId)) return false;
      if (catNombre && categoriasSelected.includes(catNombre)) return false;
    }
    
    return true;
  });
}

function obtenerMetodoPagoBanco(concepto: string): '01' | '03' | '04_28' | 'unknown' {
  if (!concepto) return 'unknown';
  const c = concepto.toUpperCase();
  if (c.includes('EFECTIVO') || c.includes('CAJERO') || c.includes('RETIRO CAJERO') || c.includes('DEPOSITO CAJERO')) {
    return '01'; // Efectivo
  }
  if (c.includes('SPEI') || c.includes('TRANSFERENCIA') || c.includes('TRF') || c.includes('TRANSF') || c.includes('TEF') || c.includes('TRASPASO')) {
    return '03'; // Transferencia
  }
  if (c.includes('TARJETA') || c.includes('PAGO CON TARJETA') || c.includes('TDC') || c.includes('T.DEB') || c.includes('T.CRE') || c.includes('DEBITO') || c.includes('CREDITO')) {
    return '04_28'; // Tarjeta
  }
  return 'unknown';
}

function detectarDiscrepanciaPago(conceptoBanco: string, metodoPagoGasto: string | null | undefined): { tieneDiscrepancia: boolean; detalle?: string } {
  if (!metodoPagoGasto) return { tieneDiscrepancia: false };
  const mpBanco = obtenerMetodoPagoBanco(conceptoBanco);
  if (mpBanco === 'unknown') return { tieneDiscrepancia: false };

  const cleanGastoCode = metodoPagoGasto.trim().padStart(2, '0');

  if (mpBanco === '01' && cleanGastoCode !== '01') {
    return { tieneDiscrepancia: true, detalle: 'El banco indica retiro en efectivo pero el comprobante indica pago electrónico.' };
  }
  if (mpBanco === '03' && cleanGastoCode !== '03') {
    return { tieneDiscrepancia: true, detalle: 'El banco indica transferencia pero el comprobante indica tarjeta/efectivo.' };
  }
  if (mpBanco === '04_28' && cleanGastoCode !== '04' && cleanGastoCode !== '28') {
    return { tieneDiscrepancia: true, detalle: 'El banco indica tarjeta pero el comprobante indica transferencia/efectivo.' };
  }

  return { tieneDiscrepancia: false };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function BancoTab({
  bancoSubTab, setBancoSubTab,
  cuentasBancarias = [],
  movimientos, estatusCatalog, formasPago, categoriasMovimiento = [], pedidosPendientes, gastosReconciliables,
  busquedaBanco, setBusquedaBanco,
  filtroBancoTipo, setFiltroBancoTipo,
  filtroBancoEstatus, setFiltroBancoEstatus,
  filtroBancoVisibilidad, setFiltroBancoVisibilidad,
  bancoPage, setBancoPage, bancoPageSize,
  excelFile, isUploading,
  handleExcelUpload, handleAutoReconcile,
  reconcileModal, setReconcileModal,
  manualMatchSearch, setManualMatchSearch,
  handleOpenReconcileModal, handleSaveReconciliation,
  handleUploadReconciliationFile, handleRemoveReconciliationFile,
  handleToggleVisibility, handleUpdateCategoria,
  selectedGlobalDepositId, setSelectedGlobalDepositId,
  selectedGlobalPedidosIds, setSelectedGlobalPedidosIds,
  handleGlobalLink,
  catalogEditModal, setCatalogEditModal,
  handleSaveCatalogItem, handleDeleteCatalogItem,
  formasPagoModal, setFormasPagoModal,
  handleSaveFormaPago, handleDeleteFormaPago,
  handleDeleteMovimiento,
  gastosFacturados = [],
  ventasFacturadas = [],
  onDownloadFile,
  onEditMovimiento,
  selectedCuentaId,
  setSelectedCuentaId,
  onViewCfdi,
  handleUnlinkReconciliation,
  handleBulkMoveMovimientos,
  handleUpdateMesConciliacion,
  comprobantes = [],
  selectedMonth,
  onCrearComprobante,
  onActualizarComprobante,
  onEliminarComprobante,
  onVincularComprobante,
  onDesvincularComprobante,
  onFusionarReembolso,
  token,
  onStartSustituirCarga,
  onReloadMovimientos,
  onOpenUploadModal,
}: BancoTabProps) {
  const { openCfdi } = useCfdiViewer();
  const handleViewCfdi = onViewCfdi || openCfdi;

  const [tiposSelected, setTiposSelected] = React.useState<string[]>([]);
  const [estatusSelected, setEstatusSelected] = React.useState<string[]>([]);
  const [visibilidadesSelected, setVisibilidadesSelected] = React.useState<string[]>([]);
  const [categoriasSelected, setCategoriasSelected] = React.useState<string[]>([]);
  const [selectedMovimientos, setSelectedMovimientos] = React.useState<string[]>([]);
  const [showFiltrosAvanzados, setShowFiltrosAvanzados] = React.useState<boolean>(false);
  const [guardarExcedenteComoSaldoFavor, setGuardarExcedenteComoSaldoFavor] = React.useState<boolean>(false);
  const [ingresosSubSeccion, setIngresosSubSeccion] = React.useState<'comprobantes' | 'global' | 'factura_publico'>('comprobantes');
  const [compSubFiltro, setCompSubFiltro] = React.useState<'todos' | 'tickets' | 'depositos'>('todos');
  const [modoConciliacionIngreso, setModoConciliacionIngreso] = React.useState<'pedidos' | 'fichas'>('fichas');
  const [selectedGlobalDepositIds, setSelectedGlobalDepositIds] = React.useState<string[]>([]);
  const [selectedGlobalComprobanteIds, setSelectedGlobalComprobanteIds] = React.useState<string[]>([]);

  const [facturadosTerceros, setFacturadosTerceros] = React.useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('facturados_terceros_tickets');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // ── Estados y lógica para Sección Atemporal de Movimientos No Deducibles ────────
  const [cierresMensualesMap, setCierresMensualesMap] = React.useState<Record<string, string>>({});
  const [filtroMesAtemporal, setFiltroMesAtemporal] = React.useState<string>('');
  const [filtroCicloAtemporal, setFiltroCicloAtemporal] = React.useState<string>('todos');
  const [filtroEstatusNoDeducible, setFiltroEstatusNoDeducible] = React.useState<string>('todos');
  const [busquedaAtemporal, setBusquedaAtemporal] = React.useState<string>('');
  const [showFiltrosAtemporal, setShowFiltrosAtemporal] = React.useState<boolean>(false);
  const [tiposAtemporalSelected, setTiposAtemporalSelected] = React.useState<string[]>([]);
  const [estatusAtemporalSelected, setEstatusAtemporalSelected] = React.useState<string[]>([]);
  const [ciclosAtemporalSelected, setCiclosAtemporalSelected] = React.useState<string[]>([]);
  const [categoriasAtemporalSelected, setCategoriasAtemporalSelected] = React.useState<string[]>([]);
  const [pageAtemporal, setPageAtemporal] = React.useState<number>(0);
  const pageSizeAtemporal = 10;

  React.useEffect(() => {
    const fetchCierres = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const companyId = session?.user?.user_metadata?.empresa_id || localStorage.getItem('seimenjo_empresa_id');
        if (!companyId) return;

        const { data } = await supabase
          .from('cierres_mensuales')
          .select('mes, estatus')
          .eq('empresa_id', companyId);

        if (data) {
          const map: Record<string, string> = {};
          data.forEach((item: { mes: string; estatus: string }) => {
            map[item.mes] = item.estatus;
          });
          setCierresMensualesMap(map);
        }
      } catch (err) {
        console.error('Error al cargar cierres mensuales:', err);
      }
    };
    fetchCierres();
  }, []);

  const getPeriodStatusForMov = React.useCallback((fecha?: string) => {
    if (!fecha) return { clave: 'abierto', label: 'Periodo Abierto', bgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
    const mesKey = fecha.substring(0, 7);
    const status = cierresMensualesMap[mesKey] || 'abierto';

    if (status === 'cerrado_definitivo' || status === 'cerrado') {
      return { clave: 'cerrado_definitivo', label: 'Cerrado Definitivo', bgClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' };
    } else if (status === 'pre_cerrado') {
      return { clave: 'pre_cerrado', label: 'Pre-cerrado', bgClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' };
    }
    return { clave: 'abierto', label: 'Periodo Abierto', bgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
  }, [cierresMensualesMap]);

  const opcionesMesesAtemporal = React.useMemo(() => {
    const setMeses = new Set<string>();
    movimientos.forEach((m: any) => {
      if (m.fecha) setMeses.add(m.fecha.substring(0, 7));
    });
    return Array.from(setMeses).sort().reverse();
  }, [movimientos]);

  const atemporalNoDeducibles = React.useMemo(() => {
    return movimientos.filter((m: any) => {
      const clave = m.estatus_conciliacion_bancaria?.clave;
      const hasPostCloseNote = m.comentarios?.includes('Conciliado después del periodo de cierre');
      const isNoDeducibleStatus = clave === 'no_deducible' || clave === 'pendiente' || clave === 'incompleto' || clave === 'no_detectado';
      const hasMissingProof = !m.xml_url && !m.pdf_factura_url && !m.pdf_ticket_url && !m.soporte_reembolso_url;

      // Exclusión estricta de Ingresos / Depósitos (considerar ÚNICAMENTE egresos / retiros de los estados de cuenta)
      const rawType = (m.tipo_movimiento || '').toLowerCase();
      const isOutflow = rawType === 'retiro' || rawType === 'cargo' || rawType === 'egreso' || Number(m.retiro || 0) > 0 || (Number(m.monto || 0) < 0) || m.tipo_movimiento === 'Retiro';
      if (!isOutflow) return false;

      // Si no hay filtro de estatus seleccionado explícitamente, aplicamos el filtro por defecto de candidatos no deducibles / pendientes / post-cierre
      if (estatusAtemporalSelected.length === 0 && filtroEstatusNoDeducible === 'todos') {
        const isCandidate = isNoDeducibleStatus || hasMissingProof || hasPostCloseNote;
        if (!isCandidate) return false;
      }

      // Filtro por cuenta seleccionada en cabecera principal
      if (selectedCuentaId && m.cuenta_bancaria_id !== selectedCuentaId) {
        return false;
      }

      // Búsqueda en texto
      if (busquedaAtemporal.trim()) {
        const q = busquedaAtemporal.toLowerCase().trim();
        const inConcepto = m.concepto?.toLowerCase().includes(q);
        const inRef = m.referencia?.toLowerCase().includes(q);
        const inCuenta = m.cuentas_bancarias?.nombre?.toLowerCase().includes(q);
        const inComments = m.comentarios?.toLowerCase().includes(q);
        const inMonto = String(m.monto || m.retiro || m.deposito || '').includes(q);
        if (!inConcepto && !inRef && !inCuenta && !inComments && !inMonto) return false;
      }

      // Filtro por Mes (Atemporal)
      if (filtroMesAtemporal) {
        if (!m.fecha || !m.fecha.startsWith(filtroMesAtemporal)) return false;
      }

      // Checklist: Tipo de Movimiento (EXCLUSION: checked = Ocultar)
      if (tiposAtemporalSelected.length > 0) {
        const rawType = (m.tipo_movimiento || '').toLowerCase();
        const isRetiro = rawType === 'retiro' || rawType === 'cargo' || rawType === 'egreso' || Number(m.retiro || 0) > 0 || (Number(m.monto || 0) < 0);
        const isDeposito = rawType === 'deposito' || rawType === 'abono' || rawType === 'ingreso' || Number(m.deposito || 0) > 0 || (Number(m.monto || 0) > 0 && !isRetiro);

        if (isDeposito && tiposAtemporalSelected.includes('Deposito')) return false;
        if (isRetiro && tiposAtemporalSelected.includes('Retiro')) return false;
      }

      // Checklist: Estatus Conciliación (EXCLUSION: checked = Ocultar)
      if (estatusAtemporalSelected.length > 0) {
        const currentClave = hasPostCloseNote ? 'conciliado_post_cierre' : (clave || 'pendiente');
        if (estatusAtemporalSelected.includes(currentClave) || (clave && estatusAtemporalSelected.includes(clave))) {
          return false;
        }
      }

      // Checklist: Ciclo Contable (EXCLUSION: checked = Ocultar)
      if (ciclosAtemporalSelected.length > 0) {
        const pStatus = getPeriodStatusForMov(m.fecha).clave;
        if (ciclosAtemporalSelected.includes(pStatus)) return false;
      }

      // Checklist: Categoría de movimiento (EXCLUSION: checked = Ocultar)
      if (categoriasAtemporalSelected.length > 0) {
        const catId = m.categoria_movimiento_id || m.categoria_id || m.categorias_movimiento_bancario?.id;
        const catNombre = m.categorias_movimiento_bancario?.nombre;

        const isSinCategoria = !catId && !catNombre;
        if (isSinCategoria && categoriasAtemporalSelected.includes('sin_categoria')) return false;
        if (catId && categoriasAtemporalSelected.includes(catId)) return false;
        if (catNombre && categoriasAtemporalSelected.includes(catNombre)) return false;
      }

      // Select Estatus alternativo
      if (filtroEstatusNoDeducible !== 'todos') {
        if (filtroEstatusNoDeducible === 'conciliado_post_cierre' && !hasPostCloseNote) return false;
        if (filtroEstatusNoDeducible === 'no_deducibles' && clave !== 'no_deducible') return false;
        if (filtroEstatusNoDeducible === 'sin_comprobar' && (clave === 'comprobado' || clave === 'conciliado') && !hasPostCloseNote) return false;
      }

      // Select Ciclo alternativo
      if (filtroCicloAtemporal !== 'todos') {
        const pStatus = getPeriodStatusForMov(m.fecha).clave;
        if (filtroCicloAtemporal === 'solo_cerrados' && pStatus !== 'cerrado_definitivo' && pStatus !== 'pre_cerrado') return false;
        if (filtroCicloAtemporal === 'solo_abiertos' && pStatus !== 'abierto') return false;
      }

      return true;
    });
  }, [
    movimientos,
    busquedaAtemporal,
    filtroMesAtemporal,
    selectedCuentaId,
    tiposAtemporalSelected,
    estatusAtemporalSelected,
    ciclosAtemporalSelected,
    categoriasAtemporalSelected,
    filtroCicloAtemporal,
    filtroEstatusNoDeducible,
    getPeriodStatusForMov
  ]);

  const exportAtemporalToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const rows = atemporalNoDeducibles.map((m: any) => {
        const pInfo = getPeriodStatusForMov(m.fecha);
        const hasPostCloseNote = m.comentarios?.includes('Conciliado después del periodo de cierre');
        const isOutflow = m.tipo_movimiento === 'Retiro' || Number(m.retiro || 0) > 0;
        return {
          'Fecha': m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
          'Mes (Periodo)': m.fecha ? m.fecha.substring(0, 7) : '',
          'Estado Ciclo': pInfo.label,
          'Cuenta Bancaria': m.cuentas_bancarias?.nombre || 'BBVA',
          'Tipo Movimiento': m.tipo_movimiento || (isOutflow ? 'Retiro' : 'Deposito'),
          'Concepto': m.concepto || '',
          'Referencia': m.referencia || '',
          'Monto Total': Math.abs(Number(m.monto || m.retiro || m.deposito || 0)),
          'Estatus Conciliación': m.estatus_conciliacion_bancaria?.nombre || (hasPostCloseNote ? 'Conciliado Post-Cierre' : 'No Deducible'),
          'Comprobante XML': m.xml_url ? 'Sí' : 'No',
          'Comprobante Ticket/PDF': (m.pdf_factura_url || m.pdf_ticket_url) ? 'Sí' : 'No',
          'Soporte Reembolso': m.soporte_reembolso_url ? 'Sí' : 'No',
          'Nota de Auditoría': m.comentarios || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const maxLens = Object.keys(rows[0] || {}).reduce((acc: any, key) => {
        let maxL = key.length;
        rows.forEach((row: any) => {
          const val = String(row[key] || '');
          if (val.length > maxL) maxL = val.length;
        });
        acc[key] = Math.min(maxL + 2, 40);
        return acc;
      }, {});

      ws['!cols'] = Object.keys(maxLens).map(key => ({ wch: maxLens[key] }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'No Deducibles Atemporal');
      XLSX.writeFile(wb, 'Reporte_Movimientos_No_Deducibles_Atemporal.xlsx');
    } catch (err: any) {
      console.error('Error al exportar reporte no deducible atemporal:', err);
      alert(`Error al generar reporte Excel: ${err.message}`);
    }
  };

  const totalRegistrosAtemporal = atemporalNoDeducibles.length;
  const montoTotalAtemporal = React.useMemo(() => {
    return atemporalNoDeducibles.reduce((acc, m) => acc + Math.abs(Number(m.monto || m.retiro || m.deposito || 0)), 0);
  }, [atemporalNoDeducibles]);

  const countCerradosAtemporal = React.useMemo(() => {
    return atemporalNoDeducibles.filter(m => {
      const p = getPeriodStatusForMov(m.fecha).clave;
      return p === 'cerrado_definitivo' || p === 'pre_cerrado';
    }).length;
  }, [atemporalNoDeducibles, getPeriodStatusForMov]);

  const countPostCierreAtemporal = React.useMemo(() => {
    return atemporalNoDeducibles.filter(m => m.comentarios?.includes('Conciliado después del periodo de cierre')).length;
  }, [atemporalNoDeducibles]);

  const paginadosAtemporal = React.useMemo(() => {
    const start = pageAtemporal * pageSizeAtemporal;
    return atemporalNoDeducibles.slice(start, start + pageSizeAtemporal);
  }, [atemporalNoDeducibles, pageAtemporal]);

  const totalPaginasAtemporal = Math.max(1, Math.ceil(atemporalNoDeducibles.length / pageSizeAtemporal));

  const toggleFacturadoTercero = (id: string) => {
    setFacturadosTerceros(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      if (typeof window !== 'undefined') {
        localStorage.setItem('facturados_terceros_tickets', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const [montoManualTercerosMap, setMontoManualTercerosMap] = React.useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('monto_manual_terceros_mes');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const setMontoManualTercero = (mesKey: string, monto: number) => {
    setMontoManualTercerosMap(prev => {
      const updated = { ...prev, [mesKey]: Math.max(0, monto) };
      if (typeof window !== 'undefined') {
        localStorage.setItem('monto_manual_terceros_mes', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const [desgloseComisionesModal, setDesgloseComisionesModal] = React.useState<{
    isOpen: boolean;
    targetComps: ComprobanteDeposito[];
    ventaBruta: string;
    propina: string;
    comisionTransacciones: string;
    ivaTransacciones: string;
    otrosCargos: string;
  }>({
    isOpen: false,
    targetComps: [],
    ventaBruta: '',
    propina: '',
    comisionTransacciones: '',
    ivaTransacciones: '',
    otrosCargos: ''
  });

  const parseInputNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    let cleaned = String(val).trim();
    if (!cleaned) return 0;
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      const lastPart = parts[parts.length - 1];
      if (lastPart.length === 3 && parts.length > 1) {
        cleaned = cleaned.replace(/,/g, '');
      } else if (parts.length === 2) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const [activeDepositMov, setActiveDepositMov] = React.useState<any | null>(null);
  const [activeCompToLink, setActiveCompToLink] = React.useState<ComprobanteDeposito | null>(null);
  const [editingCompId, setEditingCompId] = React.useState<string | null>(null);
  const currentCompToLink = activeCompToLink ? (comprobantes.find(c => c.id === activeCompToLink.id) || activeCompToLink) : null;

  const [fusionModal, setFusionModal] = React.useState<{
    open: boolean;
    mov1: any | null;
    mov2: any | null;
    soporteReembolsoUrl: string;
    comentarios: string;
    loading: boolean;
    error: string;
  }>({
    open: false,
    mov1: null,
    mov2: null,
    soporteReembolsoUrl: '',
    comentarios: '',
    loading: false,
    error: ''
  });

  const isCompCuadrado = (c: ComprobanteDeposito) => {
    const sum = (c.comprobantes_deposito_movimientos || []).reduce((acc, rel) => acc + Number(rel.monto_asociado), 0);
    return Math.abs(c.monto - sum) < 0.05;
  };

  const getDefaultDateForSelectedMonth = React.useCallback(() => {
    const todayStr = new Date().toISOString().substring(0, 10);
    if (selectedMonth && todayStr.substring(0, 7) !== selectedMonth) {
      return `${selectedMonth}-01`;
    }
    return todayStr;
  }, [selectedMonth]);

  const [newCompForm, setNewCompForm] = React.useState<{
    tipo: 'deposito_ventanilla' | 'corte_tarjeta' | 'corte_pos' | 'corte_bbva' | 'corte_parrot' | string;
    fecha: string;
    monto: string;
    descripcion: string;
    archivoUrl: string;
    storageProvider: 'Supabase' | 'GoogleDrive';
    cuentaBancariaId: string;
    loading: boolean;
    error: string;
    montoDebito: string;
    montoCredito: string;
    propinaDebito: string;
    propinaCredito: string;
    montoAmex: string;
    propinaAmex: string;
    montoEfectivo: string;
    propinaEfectivo: string;
    montoParrotpay: string;
    propinaParrotpay: string;
    comisionTransacciones: string;
    ivaTransacciones: string;
    otrosCargos: string;
  }>({
    tipo: 'deposito_ventanilla',
    fecha: new Date().toISOString().substring(0, 10),
    monto: '',
    descripcion: '',
    archivoUrl: '',
    storageProvider: 'Supabase',
    cuentaBancariaId: '',
    loading: false,
    error: '',
    montoDebito: '',
    montoCredito: '',
    propinaDebito: '',
    propinaCredito: '',
    montoAmex: '',
    propinaAmex: '',
    montoEfectivo: '',
    propinaEfectivo: '',
    montoParrotpay: '',
    propinaParrotpay: '',
    comisionTransacciones: '',
    ivaTransacciones: '',
    otrosCargos: ''
  });

  React.useEffect(() => {
    if (selectedMonth && !editingCompId) {
      setNewCompForm(p => ({
        ...p,
        fecha: getDefaultDateForSelectedMonth()
      }));
    }
  }, [selectedMonth, editingCompId, getDefaultDateForSelectedMonth]);

  const [compUploadLoading, setCompUploadLoading] = React.useState(false);

  const handleUploadCompFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompUploadLoading(true);
    try {
      const timestamp = Date.now();
      const filePath = `comprobantes_deposito/${timestamp}_${file.name.replace(/\s+/g, '_')}`;
      const { error } = await supabase.storage.from('facturas').upload(filePath, file);
      if (error) throw error;
      setNewCompForm(prev => ({
        ...prev,
        archivoUrl: filePath
      }));
    } catch (err: any) {
      alert('Error al subir archivo: ' + err.message);
    } finally {
      setCompUploadLoading(false);
    }
  };

  const [linkSearchQuery, setLinkSearchQuery] = React.useState('');
  const [selectedLinkMovIds, setSelectedLinkMovIds] = React.useState<Set<string>>(new Set());
  const [linkDateFrom, setLinkDateFrom] = React.useState('');
  const [linkDateTo, setLinkDateTo] = React.useState('');
  const [linkingBatch, setLinkingBatch] = React.useState(false);

  const [uploadedXmlAmounts, setUploadedXmlAmounts] = React.useState<{[key: string]: number}>({});
  const xmlAmountsCache = React.useRef<{[key: string]: number}>({});

  const parseXmlTotal = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'application/xml');
          const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0] || xmlDoc.getElementsByTagName('Comprobante')[0];
          if (!comprobante) {
            resolve(0);
            return;
          }
          const tipoDeComprobante = comprobante.getAttribute('TipoDeComprobante') || comprobante.getAttribute('tipoDeComprobante') || 'I';
          let total = parseFloat(comprobante.getAttribute('Total') || comprobante.getAttribute('total') || '0');
          
          const pagoNodes = xmlDoc.getElementsByTagName('pago20:Pago').length > 0
            ? xmlDoc.getElementsByTagName('pago20:Pago')
            : xmlDoc.getElementsByTagName('pago10:Pago').length > 0
              ? xmlDoc.getElementsByTagName('pago10:Pago')
              : xmlDoc.getElementsByTagName('Pago');
          if (tipoDeComprobante === 'P' || pagoNodes.length > 0) {
            let totalPago = 0;
            for (let i = 0; i < pagoNodes.length; i++) {
              totalPago += parseFloat(pagoNodes[i].getAttribute('Monto') || pagoNodes[i].getAttribute('monto') || '0');
            }
            total = totalPago;
          }
          resolve(total);
        } catch (err) {
          console.error('Error parsing XML total:', err);
          resolve(0);
        }
      };
      reader.onerror = () => resolve(0);
      reader.readAsText(file);
    });
  };

  const fetchAndParseXmlAmount = async (path: string): Promise<number> => {
    try {
      const { data, error } = await supabase.storage.from('facturas').download(path);
      if (error || !data) {
        console.error('Error downloading XML:', error);
        return 0;
      }
      const text = await data.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'application/xml');
      const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0] || xmlDoc.getElementsByTagName('Comprobante')[0];
      if (!comprobante) return 0;
      const tipoDeComprobante = comprobante.getAttribute('TipoDeComprobante') || comprobante.getAttribute('tipoDeComprobante') || 'I';
      let total = parseFloat(comprobante.getAttribute('Total') || comprobante.getAttribute('total') || '0');
      
      const pagoNodes = xmlDoc.getElementsByTagName('pago20:Pago').length > 0
        ? xmlDoc.getElementsByTagName('pago20:Pago')
        : xmlDoc.getElementsByTagName('pago10:Pago').length > 0
          ? xmlDoc.getElementsByTagName('pago10:Pago')
          : xmlDoc.getElementsByTagName('Pago');
      if (tipoDeComprobante === 'P' || pagoNodes.length > 0) {
        let totalPago = 0;
        for (let i = 0; i < pagoNodes.length; i++) {
          totalPago += parseFloat(pagoNodes[i].getAttribute('Monto') || pagoNodes[i].getAttribute('monto') || '0');
        }
        total = totalPago;
      }
      return total;
    } catch (err) {
      console.error('Error fetching/parsing XML total:', err);
      return 0;
    }
  };

  React.useEffect(() => {
    if (!reconcileModal.open) {
      setUploadedXmlAmounts({});
      xmlAmountsCache.current = {};
      return;
    }

    const paths = reconcileModal.xmlUrl ? reconcileModal.xmlUrl.split(',').filter(Boolean) : [];

    const loadAmounts = async () => {
      const nextAmounts: {[key: string]: number} = {};
      
      for (const path of paths) {
        // Check cache first
        if (xmlAmountsCache.current[path] !== undefined) {
          nextAmounts[path] = xmlAmountsCache.current[path];
          continue;
        }

        // Check if we have a local upload key in cache (e.g. key is the file name and path ends with it)
        const cachedKey = Object.keys(xmlAmountsCache.current).find(
          key => path === key || path.endsWith(key)
        );
        if (cachedKey !== undefined) {
          const amt = xmlAmountsCache.current[cachedKey];
          xmlAmountsCache.current[path] = amt;
          nextAmounts[path] = amt;
          continue;
        }

        // Fetch and parse
        const amt = await fetchAndParseXmlAmount(path);
        xmlAmountsCache.current[path] = amt;
        nextAmounts[path] = amt;
      }

      setUploadedXmlAmounts(nextAmounts);
    };

    loadAmounts();
  }, [reconcileModal.open, reconcileModal.xmlUrl]);

  const handleUploadFusionFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fusionModal.mov1) return;

    setFusionModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const timestamp = Date.now();
      const yearMonth = new Date(fusionModal.mov1.fecha).toISOString().substring(0, 7);
      const filePath = `reconciliation/${yearMonth}/${timestamp}_${file.name.replace(/\s+/g, '_')}`;

      const { error } = await supabase.storage.from('facturas').upload(filePath, file);
      if (error) throw error;

      setFusionModal(prev => ({
        ...prev,
        soporteReembolsoUrl: prev.soporteReembolsoUrl ? `${prev.soporteReembolsoUrl},${filePath}` : filePath
      }));
    } catch (err: any) {
      setFusionModal(prev => ({ ...prev, error: 'Error al subir archivo: ' + err.message }));
    } finally {
      setFusionModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleRemoveFusionFile = (idx: number) => {
    setFusionModal(prev => {
      const paths = prev.soporteReembolsoUrl.split(',').filter(Boolean);
      const newPaths = paths.filter((_, i) => i !== idx).join(',');
      return {
        ...prev,
        soporteReembolsoUrl: newPaths
      };
    });
  };

  const handleConfirmFusion = async () => {
    if (!fusionModal.mov1 || !fusionModal.mov2) return;
    setFusionModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      if (onFusionarReembolso) {
        const res = await onFusionarReembolso(fusionModal.mov1.id, fusionModal.mov2.id, {
          soporteReembolsoUrl: fusionModal.soporteReembolsoUrl,
          comentarios: fusionModal.comentarios
        });
        if (res && !res.success) {
          throw new Error(res.error || 'Error al fusionar movimientos.');
        }
        setFusionModal({
          open: false,
          mov1: null,
          mov2: null,
          soporteReembolsoUrl: '',
          comentarios: '',
          loading: false,
          error: ''
        });
        setSelectedMovimientos([]);
      }
    } catch (err: any) {
      setFusionModal(prev => ({ ...prev, error: err.message, loading: false }));
    }
  };

  const handleXmlUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const amount = await parseXmlTotal(file);
      if (amount > 0) {
        xmlAmountsCache.current[file.name] = amount;
        setUploadedXmlAmounts(prev => ({
          ...prev,
          [file.name]: amount
        }));
      }
    }
    if (handleUploadReconciliationFile) {
      await handleUploadReconciliationFile(e, 'xml');
    }
  };

  const renderFileListLocal = (field: 'xml' | 'pdf' | 'ticket' | 'soporte_reembolso') => {
    const urlField = field === 'xml' ? 'xmlUrl' : field === 'pdf' ? 'pdfFacturaUrl' : field === 'ticket' ? 'pdfTicketUrl' : 'soporteReembolsoUrl';
    const pathsStr = reconcileModal[urlField];
    if (!pathsStr) return null;
    const paths = pathsStr.split(',').filter(Boolean);

    return (
      <div className="space-y-1 w-full mt-1.5 font-sans">
        {paths.map((path, idx) => {
          const fileName = path.split('/').pop() || '';
          const xmlAmount = field === 'xml' ? (uploadedXmlAmounts[path] || uploadedXmlAmounts[fileName]) : null;
          return (
            <div key={idx} className="flex flex-col gap-1 bg-white dark:bg-gray-900 p-1.5 rounded border border-gray-200 dark:border-gray-800 text-[10px]">
              <div className="flex justify-between items-center w-full">
                <span className="truncate max-w-[150px] font-semibold text-gray-700 dark:text-gray-300" title={fileName}>
                  {fileName.length > 22 ? fileName.substring(0, 19) + '...' : fileName}
                </span>
                <div className="flex gap-1 items-center font-bold shrink-0">
                  <button
                    type="button"
                    onClick={() => onDownloadFile && onDownloadFile(path)}
                    className="text-blue-500 hover:text-blue-600 text-[9px] uppercase hover:underline"
                  >
                    Ver
                  </button>
                  <span className="text-gray-300 dark:text-gray-700">|</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveReconciliationFile && handleRemoveReconciliationFile(field, idx)}
                    className="text-red-500 hover:text-red-600 text-[9px] uppercase hover:underline"
                  >
                    Borrar
                  </button>
                </div>
              </div>
              {field === 'xml' && xmlAmount !== undefined && xmlAmount !== null && (
                <div className="text-[9px] text-blue-600 dark:text-blue-400 font-extrabold flex justify-between items-center mt-0.5 border-t border-gray-100 dark:border-gray-850 pt-1">
                  <span>Monto CFDI:</span>
                  <span>{formatCurrency(xmlAmount)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const esMovimientoEfectivo = (concepto: string): boolean => {
    if (!concepto) return false;
    const c = concepto.toUpperCase();
    return c.includes('EFECTIVO') || c.includes('CAJERO') || c.includes('RETIRO CAJERO') || c.includes('DEPOSITO CAJERO');
  };

  const autoEstatus = (gastosIds: string[], pedidosIds: string[] = []) => {
    const selectedGastos = gastosReconciliables.filter(g => gastosIds.includes(g.id));
    const hasXml = selectedGastos.some(g => !!g.xml_url) || !!reconcileModal.movimiento?.xml_url || !!reconcileModal.xmlUrl;
    const hasTicket = selectedGastos.some(g => !!g.ticket_url) || !!reconcileModal.movimiento?.pdf_ticket_url || !!reconcileModal.pdfTicketUrl;
    
    const isCash = reconcileModal.movimiento ? esMovimientoEfectivo(reconcileModal.movimiento.concepto) : false;
    if (isCash) {
      return hasTicket ? 'comprobado' : 'incompleto_comprobado';
    } else {
      const hasInvoice = (reconcileModal.movimiento?.tipo_movimiento === 'Deposito') || (gastosIds.length > 0) || (pedidosIds.length > 0);
      if (!hasInvoice) {
        return 'no_deducible';
      } else if (hasXml) {
        return 'comprobado';
      } else {
        return 'incompleto_comprobado';
      }
    }
  };

  const selectedGastosWithDiscrepancy = React.useMemo(() => {
    if (!reconcileModal.movimiento || reconcileModal.gastosSeleccionados.length === 0) return [];
    
    return gastosReconciliables
      .filter((g) => reconcileModal.gastosSeleccionados.includes(g.id))
      .map((g) => {
        const disc = detectarDiscrepanciaPago(reconcileModal.movimiento.concepto, g.metodo_pago);
        return { gasto: g, disc };
      })
      .filter((item) => item.disc.tieneDiscrepancia);
  }, [reconcileModal.movimiento, reconcileModal.gastosSeleccionados, gastosReconciliables]);

  const handleBulkUpdateCategory = async (categoriaId: string) => {
    if (selectedMovimientos.length === 0) return;
    const catId = (categoriaId === '' || categoriaId === 'SIN_CATEGORIA') ? null : categoriaId;
    try {
      const { error } = await supabase
        .from('movimientos_bancarios')
        .update({ categoria_movimiento_id: catId })
        .in('id', selectedMovimientos);
      if (error) throw error;
      
      const movedIds = [...selectedMovimientos];
      setSelectedMovimientos([]);
      
      if (handleUpdateCategoria && movedIds.length > 0) {
        handleUpdateCategoria(movedIds[0], categoriaId === 'SIN_CATEGORIA' ? '' : categoriaId);
      }
    } catch (err: any) {
      alert(`Error al asignar categorías de forma masiva: ${err.message}`);
    }
  };

  const exportReconciliationStatsToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      
      const rows = movimientos.map((m) => {
        const links = (m as any).conciliaciones_bancarias || [];
        const estatus = m.estatus_conciliacion_bancaria?.nombre || 'Pendiente';
        const categoria = m.categorias_movimiento_bancario?.nombre || 'Sin Categoría';
        const fechaMov = m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '';
        const importeMov = m.tipo_movimiento === 'Retiro' ? -Math.abs(Number(m.monto)) : Math.abs(Number(m.monto));

        if (links.length === 0) {
          return {
            'Fecha Movimiento': fechaMov,
            'Concepto Movimiento': m.concepto || '',
            'Tipo Movimiento': m.tipo_movimiento || '',
            'Importe Banco': importeMov,
            'Referencia Banco': m.referencia || '',
            'RFC Movimiento': m.rfc_proveedor || '',
            'Estatus Conciliación': estatus,
            'Categoría Movimiento': categoria,
            'Vinculado A': 'Sin vincular',
            'Folio/Concepto Relacionado': '',
            'Monto Asociado': 0,
            'Proveedor/Cliente Relacionado': '',
            'RFC Relacionado': '',
            'Metodo Pago Relacionado': '',
            'Tiene XML': m.xml_url ? 'Sí' : 'No',
            'Tiene Ticket': m.pdf_ticket_url ? 'Sí' : 'No',
            'Tiene PDF': m.pdf_factura_url ? 'Sí' : 'No',
            'Archivos XML': m.xml_url || '',
            'Archivos PDF': m.pdf_factura_url || '',
            'Archivos Ticket': m.pdf_ticket_url || ''
          };
        }

        return links.map((link: any) => {
          const isGasto = !!link.gasto;
          const relItem = isGasto ? link.gasto : link.pedido;
          
          let folioConcepto = '';
          let montoAsoc = Number(link.monto_asociado || 0);
          let relProvCliName = '';
          let relRfc = '';
          let relMetodoPago = '';
          
          let hasXml = 'No';
          let hasTicket = 'No';
          let hasPdf = 'No';
          
          let xmlUrlsStr = '';
          let pdfUrlsStr = '';
          let ticketUrlsStr = '';

          if (isGasto) {
            folioConcepto = relItem.concepto || '';
            const provArr = relItem.proveedores;
            const proveedor = Array.isArray(provArr) ? provArr[0] : provArr;
            relProvCliName = proveedor?.nombre_comercial || '';
            relRfc = proveedor?.rfc || '';
            relMetodoPago = relItem.metodo_pago ? getMetodoPagoLabel(relItem.metodo_pago) : '';
            
            hasXml = relItem.xml_url ? 'Sí' : 'No';
            hasTicket = relItem.ticket_url ? 'Sí' : 'No';
            hasPdf = relItem.pdf_url ? 'Sí' : 'No';
            
            xmlUrlsStr = relItem.xml_url || '';
            pdfUrlsStr = relItem.pdf_url || '';
            ticketUrlsStr = relItem.ticket_url || '';
          } else {
            folioConcepto = `Pedido #${relItem.numero_pedido || ''}`;
            const cliente = relItem.clientes;
            relProvCliName = relItem.cliente_nombre || cliente?.nombre_local || '';
            relRfc = cliente?.rfc || '';
            
            const facturas = relItem.facturas_clientes || [];
            const firstFactura = facturas[0] || {};
            
            hasXml = firstFactura.xml_url ? 'Sí' : 'No';
            hasTicket = firstFactura.ticket_url ? 'Sí' : 'No';
            hasPdf = firstFactura.pdf_url ? 'Sí' : 'No';
            
            xmlUrlsStr = facturas.map((f: any) => f.xml_url).filter(Boolean).join(', ');
            pdfUrlsStr = facturas.map((f: any) => f.pdf_url).filter(Boolean).join(', ');
            ticketUrlsStr = facturas.map((f: any) => f.ticket_url).filter(Boolean).join(', ');
          }

          const finalHasXml = (m.xml_url || hasXml === 'Sí') ? 'Sí' : 'No';
          const finalHasTicket = (m.pdf_ticket_url || hasTicket === 'Sí') ? 'Sí' : 'No';
          const finalHasPdf = (m.pdf_factura_url || hasPdf === 'Sí') ? 'Sí' : 'No';

          return {
            'Fecha Movimiento': fechaMov,
            'Concepto Movimiento': m.concepto || '',
            'Tipo Movimiento': m.tipo_movimiento || '',
            'Importe Banco': importeMov,
            'Referencia Banco': m.referencia || '',
            'RFC Movimiento': m.rfc_proveedor || '',
            'Estatus Conciliación': estatus,
            'Categoría Movimiento': categoria,
            'Vinculado A': isGasto ? 'Egreso (Gasto)' : 'Venta (Pedido)',
            'Folio/Concepto Relacionado': folioConcepto,
            'Monto Asociado': montoAsoc,
            'Proveedor/Cliente Relacionado': relProvCliName,
            'RFC Relacionado': relRfc,
            'Metodo Pago Relacionado': relMetodoPago,
            'Tiene XML': finalHasXml,
            'Tiene Ticket': finalHasTicket,
            'Tiene PDF': finalHasPdf,
            'Archivos XML': [m.xml_url, xmlUrlsStr].filter(Boolean).join(', '),
            'Archivos PDF': [m.pdf_factura_url, pdfUrlsStr].filter(Boolean).join(', '),
            'Archivos Ticket': [m.pdf_ticket_url, ticketUrlsStr].filter(Boolean).join(', ')
          };
        });
      }).flat();

      const ws = XLSX.utils.json_to_sheet(rows);
      
      const maxLens = Object.keys(rows[0] || {}).reduce((acc: any, key) => {
        let maxL = key.length;
        rows.forEach((row: any) => {
          const val = String(row[key] || '');
          if (val.length > maxL) maxL = val.length;
        });
        acc[key] = Math.min(maxL + 2, 40);
        return acc;
      }, {});

      ws['!cols'] = Object.keys(maxLens).map(key => ({ wch: maxLens[key] }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte Conciliación');

      XLSX.writeFile(wb, 'Reporte_Conciliacion_Bancaria.xlsx');
    } catch (err: any) {
      console.error('Error generating Excel report:', err);
      alert(`Error al generar reporte en Excel: ${err.message}`);
    }
  };

  const exportComprobantesToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      
      const rows = comprobantes.map((c) => {
        const isVentanilla = c.tipo === 'deposito_ventanilla';
        const linkedSum = (c.comprobantes_deposito_movimientos || []).reduce((acc, rel) => acc + Number(rel.monto_asociado), 0);
        const estatus = isCompCuadrado(c) ? 'Conciliado' : 'Pendiente';
        const fechaComp = c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '';
        
        return {
          'Fecha': fechaComp,
          'Tipo': isVentanilla ? 'Depósito Ventanilla' : 'Corte POS / Punto de Venta',
          'Estatus': estatus,
          'Banco Destino': c.cuentas_bancarias?.nombre || 'No especificado',
          'Descripción': c.descripcion || '',
          'Monto Total': Number(c.monto || 0),
          'Monto Asociado': linkedSum,
          'Diferencia (Sin Cuadrar)': Number(c.monto || 0) - linkedSum,
          // Desglose de Pagos (separados débito, crédito, amex y propinas)
          'Débito (Base)': isVentanilla ? 0 : Number(c.monto_debito || 0),
          'Débito (Propina)': isVentanilla ? 0 : Number(c.propina_debito || 0),
          'Crédito (Base)': isVentanilla ? 0 : Number(c.monto_credito || 0),
          'Crédito (Propina)': isVentanilla ? 0 : Number(c.propina_credito || 0),
          'Amex (Base)': isVentanilla ? 0 : Number(c.monto_amex || 0),
          'Amex (Propina)': isVentanilla ? 0 : Number(c.propina_amex || 0)
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      
      const maxLens = Object.keys(rows[0] || {}).reduce((acc: any, key) => {
        let maxL = key.length;
        rows.forEach((row: any) => {
          const val = String(row[key] || '');
          if (val.length > maxL) maxL = val.length;
        });
        acc[key] = Math.min(maxL + 2, 40);
        return acc;
      }, {});

      ws['!cols'] = Object.keys(maxLens).map(key => ({ wch: maxLens[key] }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Comprobantes');

      XLSX.writeFile(wb, 'Reporte_Comprobantes_Conciliacion.xlsx');
    } catch (err: any) {
      console.error('Error generating Excel report for comprobantes:', err);
      alert(`Error al generar reporte en Excel: ${err.message}`);
    }
  };

  const filtered = filterMovimientos(
    movimientos, 
    busquedaBanco, 
    tiposSelected, 
    estatusSelected, 
    visibilidadesSelected, 
    categoriasSelected, 
    selectedCuentaId
  );
  const paginated = filtered.slice(bancoPage * bancoPageSize, (bancoPage + 1) * bancoPageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / bancoPageSize));

  return (
    <div className="flex flex-col flex-1 font-sans overflow-hidden">
      {/* SUB-PESTAÑAS */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/20 dark:bg-gray-900/10 p-2 gap-2 shrink-0">
        {([
          { key: 'movimientos', label: 'Movimientos de Cuenta', icon: <List size={14} /> },
          { key: 'ingresos_comprobantes', label: 'Ingresos y Comprobantes', icon: <CreditCard size={14} /> },
          { key: 'no_deducibles', label: 'No Deducibles (Atemporal)', icon: <AlertTriangle size={14} /> },
          { key: 'cargas', label: 'Cargas de Estado de Cuenta', icon: <FileSpreadsheet size={14} /> },
        ] as const).map(({ key, label, icon }) => {
          const isActive = bancoSubTab === key || (key === 'ingresos_comprobantes' && (bancoSubTab === 'global' || bancoSubTab === 'comprobantes'));
          return (
            <button
              key={key}
              onClick={() => {
                setBancoSubTab(key);
                if (key === 'ingresos_comprobantes') {
                  setSelectedGlobalDepositId(null);
                  setSelectedGlobalPedidosIds([]);
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isActive
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                : 'text-gray-400 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              {icon} {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

        {/* ── SUB-TAB 1: MOVIMIENTOS ───────────────────────────────────────── */}
        {bancoSubTab === 'movimientos' && (
          <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden min-h-0">
            {/* Tabla de movimientos */}
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              {/* Filtros tipo Checklist */}
              <div className="p-3.5 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-3.5 shrink-0">
                {/* Búsqueda, Cuenta y Acciones agrupadas */}
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Buscar concepto, ref, rfc..."
                      value={busquedaBanco}
                      onChange={(e) => { setBusquedaBanco(e.target.value); setBancoPage(0); }}
                      className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                    />
                  </div>

                  <select
                    value={selectedCuentaId}
                    onChange={(e) => {
                      setSelectedCuentaId(e.target.value);
                      setBancoPage(0);
                    }}
                    className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-all text-gray-900 dark:text-gray-100 font-sans cursor-pointer font-semibold"
                  >
                    <option value="">-- Seleccionar Cuenta --</option>
                    {cuentasBancarias?.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                    ))}
                  </select>

                  <button
                    onClick={handleAutoReconcile}
                    disabled={!selectedCuentaId}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md"
                    title="Conciliación Inteligente Automática"
                  >
                    <Play size={14} />
                    Conciliación Auto
                  </button>

                  <button
                    onClick={exportReconciliationStatsToExcel}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                    title="Exportar Reporte Excel de Movimientos y Conciliación"
                  >
                    <FileSpreadsheet size={14} />
                    Exportar Reporte Excel
                  </button>

                  <button
                    onClick={() => setShowFiltrosAvanzados(!showFiltrosAvanzados)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                      showFiltrosAvanzados || tiposSelected.length > 0 || estatusSelected.length > 0 || visibilidadesSelected.length > 0 || categoriasSelected.length > 0
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Filter size={14} />
                    <span>{showFiltrosAvanzados ? 'Ocultar Filtros' : 'Mostrar Filtros'}</span>
                    {(tiposSelected.length > 0 || estatusSelected.length > 0 || visibilidadesSelected.length > 0 || categoriasSelected.length > 0) && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setTiposSelected([]);
                      setEstatusSelected([]);
                      setVisibilidadesSelected([]);
                      setCategoriasSelected([]);
                      setBusquedaBanco('');
                      setBancoPage(0);
                    }}
                    className="px-3.5 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-700 transition-all shrink-0"
                  >
                    Restablecer Filtros
                  </button>
                </div>

                {/* Resumen Horizontal de Saldos */}
                {selectedCuentaId && (() => {
                  const cuenta = cuentasBancarias?.find(c => c.id === selectedCuentaId);
                  const depositos = filtered.filter(m => m.tipo_movimiento === 'Deposito').reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);
                  const retiros = filtered.filter(m => m.tipo_movimiento === 'Retiro').reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);
                  const saldoInicial = Number(cuenta?.saldo_inicial || 0);
                  const saldoCalculado = saldoInicial + depositos - retiros;

                  return (
                    <div className="flex gap-6 items-center bg-gray-50/50 dark:bg-gray-900/30 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-[11px] font-sans flex-wrap shrink-0">
                      <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        Cuadre de Saldos:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-550 dark:text-gray-400 font-medium">Saldo Inicial:</span>
                        <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{formatCurrency(saldoInicial)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-600 dark:text-emerald-500 font-medium">+ Depósitos:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-500">{formatCurrency(depositos)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-red-600 dark:text-red-500 font-medium">- Retiros:</span>
                        <span className="font-mono font-bold text-red-600 dark:text-red-400">{formatCurrency(retiros)}</span>
                      </div>
                      <div className="h-4 w-px bg-gray-300 dark:bg-gray-700 hidden sm:block" />
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-gray-700 dark:text-gray-300">Saldo ERP:</span>
                        <span className="font-mono font-extrabold text-xs text-gray-900 dark:text-white bg-amber-500/10 dark:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/20">
                          {formatCurrency(saldoCalculado)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Grid de Checklists de Filtro (Colapsable) */}
                {showFiltrosAvanzados && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans animate-in fade-in duration-200">
                    {/* Tipo */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Tipo de Movimiento</span>
                      <div className="space-y-1.5 flex-1">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={tiposSelected.includes('Deposito')}
                            onChange={(e) => {
                              const newTipos = e.target.checked ? [...tiposSelected, 'Deposito'] : tiposSelected.filter(t => t !== 'Deposito');
                              setTiposSelected(newTipos);
                              setBancoPage(0);
                            }}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                          />
                          <span>Depósitos (+)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={tiposSelected.includes('Retiro')}
                            onChange={(e) => {
                              const newTipos = e.target.checked ? [...tiposSelected, 'Retiro'] : tiposSelected.filter(t => t !== 'Retiro');
                              setTiposSelected(newTipos);
                              setBancoPage(0);
                            }}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                          />
                          <span>Retiros (-)</span>
                        </label>
                      </div>
                    </div>

                    {/* Estatus */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Estatus Conciliación</span>
                      <div className="space-y-1.5 flex-1 max-h-24 overflow-y-auto pr-1">
                        {estatusCatalog.map((e) => (
                          <label key={e.id} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                            <input
                              type="checkbox"
                              checked={estatusSelected.includes(e.clave)}
                              onChange={(chk) => {
                                const newEstatus = chk.target.checked ? [...estatusSelected, e.clave] : estatusSelected.filter(es => es !== e.clave);
                                setEstatusSelected(newEstatus);
                                setBancoPage(0);
                              }}
                              className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                            />
                            <span>{e.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Visibilidad ERP */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Visibilidad ERP</span>
                      <div className="space-y-1.5 flex-1">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={visibilidadesSelected.includes('visibles_egresos')}
                            onChange={(e) => {
                              const newVis = e.target.checked ? [...visibilidadesSelected, 'visibles_egresos'] : visibilidadesSelected.filter(v => v !== 'visibles_egresos');
                              setVisibilidadesSelected(newVis);
                              setBancoPage(0);
                            }}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                          />
                          <span>Ver en Egresos</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={visibilidadesSelected.includes('visibles_ingresos')}
                            onChange={(e) => {
                              const newVis = e.target.checked ? [...visibilidadesSelected, 'visibles_ingresos'] : visibilidadesSelected.filter(v => v !== 'visibles_ingresos');
                              setVisibilidadesSelected(newVis);
                              setBancoPage(0);
                            }}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                          />
                          <span>Ver en Ingresos</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={visibilidadesSelected.includes('ocultos')}
                            onChange={(e) => {
                              const newVis = e.target.checked ? [...visibilidadesSelected, 'ocultos'] : visibilidadesSelected.filter(v => v !== 'ocultos');
                              setVisibilidadesSelected(newVis);
                              setBancoPage(0);
                            }}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                          />
                          <span>Ocultos en ERP</span>
                        </label>
                      </div>
                    </div>

                    {/* Categoría */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Categoría de Movimiento</span>
                      <div className="space-y-1.5 flex-1 max-h-24 overflow-y-auto pr-1">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={categoriasSelected.includes('sin_categoria')}
                            onChange={(chk) => {
                              const newCats = chk.target.checked ? [...categoriasSelected, 'sin_categoria'] : categoriasSelected.filter(c => c !== 'sin_categoria');
                              setCategoriasSelected(newCats);
                              setBancoPage(0);
                            }}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                          />
                          <span className="italic text-gray-400">Sin Categoría</span>
                        </label>
                        {categoriasMovimiento?.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                            <input
                              type="checkbox"
                              checked={categoriasSelected.includes(c.id)}
                              onChange={(chk) => {
                                const newCats = chk.target.checked ? [...categoriasSelected, c.id] : categoriasSelected.filter(cs => cs !== c.id);
                                setCategoriasSelected(newCats);
                                setBancoPage(0);
                              }}
                              className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                            />
                            <span>{c.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Barra de Acciones Masivas */}
              {selectedMovimientos.length > 0 && (
                <div className="p-3 bg-amber-500/10 border-b border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs font-semibold animate-in slide-in-from-top-2 duration-200 gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-800 dark:text-amber-400 font-bold">
                      {selectedMovimientos.length} movimientos seleccionados ({formatCurrency(
                        movimientos
                          .filter(m => selectedMovimientos.includes(m.id))
                          .reduce((s, m) => s + Math.abs(Number(m.monto) || (m.tipo_movimiento === 'Retiro' ? Number(m.retiro) : Number(m.deposito)) || 0), 0)
                      )})
                    </span>
                    <button
                      onClick={() => setSelectedMovimientos([])}
                      className="text-[10px] text-gray-550 hover:text-red-500 underline"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    {selectedMovimientos.length > 0 && (() => {
                      const selectedMovsObjects = movimientos.filter(m => selectedMovimientos.includes(m.id));
                      const selectedSum = selectedMovsObjects.reduce((acc, m) => {
                        const mVal = Math.abs(Number(m.monto) || (m.tipo_movimiento === 'Retiro' ? Number(m.retiro) : Number(m.deposito)) || 0);
                        return acc + mVal;
                      }, 0);
                      const firstType = selectedMovsObjects[0]?.tipo_movimiento;
                      const allSameType = selectedMovsObjects.length > 0 && selectedMovsObjects.every(m => m.tipo_movimiento === firstType);

                      if (allSameType && handleOpenReconcileModal) {
                        return (
                          <button
                            type="button"
                            onClick={() => handleOpenReconcileModal(selectedMovsObjects)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-all shadow flex items-center gap-1.5"
                            title="Sumar y conciliar los pagos seleccionados contra una factura"
                          >
                            <Link size={13} /> Conciliar Pagos Seleccionados ({formatCurrency(selectedSum)})
                          </button>
                        );
                      }
                      return null;
                    })()}

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 dark:text-gray-400 font-bold">Asignar Categoría en Lote:</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value !== '') {
                            handleBulkUpdateCategory(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-2 py-1 rounded text-xs outline-none focus:ring-1 focus:ring-amber-500 text-gray-800 dark:text-gray-200 font-medium"
                      >
                        <option value="">-- Seleccionar categoría --</option>
                        <option value="SIN_CATEGORIA">- Sin Categoría -</option>
                        {categoriasMovimiento?.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-600 dark:text-gray-400 font-bold">Mover a Cuenta en Lote:</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value !== '') {
                            const targetCuentaId = e.target.value === 'SIN_CUENTA' ? null : e.target.value;
                            handleBulkMoveMovimientos?.(selectedMovimientos, targetCuentaId);
                            setSelectedMovimientos([]);
                            e.target.value = '';
                          }
                        }}
                        className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-2 py-1 rounded text-xs outline-none focus:ring-1 focus:ring-amber-500 text-gray-800 dark:text-gray-200 font-medium"
                      >
                        <option value="">-- Seleccionar cuenta --</option>
                        <option value="SIN_CUENTA">- Sin Cuenta -</option>
                        {cuentasBancarias?.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                        ))}
                      </select>
                    </div>

                    {selectedMovimientos.length === 2 && (() => {
                      const m1 = movimientos.find(x => x.id === selectedMovimientos[0]);
                      const m2 = movimientos.find(x => x.id === selectedMovimientos[1]);
                      const isOppositeType = m1 && m2 && m1.tipo_movimiento !== m2.tipo_movimiento;
                      const hasSameAccount = m1 && m2 && m1.cuenta_bancaria_id === m2.cuenta_bancaria_id;
                      
                      if (isOppositeType && hasSameAccount) {
                        return (
                          <button
                            type="button"
                            onClick={() => setFusionModal({
                              open: true,
                              mov1: m1.tipo_movimiento === 'Retiro' ? m1 : m2,
                              mov2: m1.tipo_movimiento === 'Deposito' ? m1 : m2,
                              soporteReembolsoUrl: '',
                              comentarios: '',
                              loading: false,
                              error: ''
                            })}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-xs font-bold transition-all shadow flex items-center gap-1.5"
                          >
                            <ArrowRightLeft size={13} /> Fusionar Reembolso
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}

              {/* Tabla */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-xs min-w-[850px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={paginated.length > 0 && paginated.every(m => selectedMovimientos.includes(m.id))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const visibleIds = paginated.map(m => m.id);
                              setSelectedMovimientos(prev => Array.from(new Set([...prev, ...visibleIds])));
                            } else {
                              const visibleIds = paginated.map(m => m.id);
                              setSelectedMovimientos(prev => prev.filter(id => !visibleIds.includes(id)));
                            }
                          }}
                          className="w-3.5 h-3.5 text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950"
                        />
                      </th>
                      <th className="p-3 w-24">Fecha</th>
                      <th className="p-3">Detalle / Concepto</th>
                      <th className="p-3 w-36">Categoría</th>
                      <th className="p-3 text-right w-28">Monto</th>
                      <th className="p-3 text-center w-36">Estatus</th>
                      <th className="p-3 text-center w-28">ERP Egreso/Ingreso</th>
                      <th className="p-3 text-center w-24">Archivos</th>
                      <th className="p-3 text-center w-20">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                          No se encontraron movimientos bancarios (Total cargados: {movimientos?.length || 0}, Filtrados: {filtered?.length || 0})
                        </td>
                      </tr>
                    ) : paginated.map((m) => {
                      const color = m.estatus_conciliacion_bancaria?.color || '#9CA3AF';
                      const dateStr = new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' });
                      const isRetiro = m.tipo_movimiento === 'Retiro';
                      return (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10 transition-colors">
                          <td className="p-3 text-center w-10">
                            <input
                              type="checkbox"
                              checked={selectedMovimientos.includes(m.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMovimientos(prev => [...prev, m.id]);
                                } else {
                                  setSelectedMovimientos(prev => prev.filter(id => id !== m.id));
                                }
                              }}
                              className="w-3.5 h-3.5 text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-950"
                            />
                          </td>
                          <td className="p-3 font-mono text-gray-500">{dateStr}</td>
                          <td className="p-3">
                            <div className="font-bold text-gray-800 dark:text-gray-200">{m.concepto}</div>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1.5 mt-1">
                              {m.referencia && <span>Ref: {m.referencia}</span>}
                              {m.rfc_proveedor && (
                                <span className="font-mono text-[9px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-500">
                                  RFC: {m.rfc_proveedor}
                                </span>
                              )}
                            </div>

                             {/* Mostrar Fichas / Comprobantes de Depósito vinculados */}
                             {(() => {
                               const associatedComps = (comprobantes || []).filter(c => 
                                 c.comprobantes_deposito_movimientos?.some(rel => rel.movimiento_id === m.id)
                               );
                               if (associatedComps.length === 0) return null;
                               return (
                                 <div className="mt-2 space-y-1">
                                   {associatedComps.map(c => {
                                     const isVentanilla = c.tipo === 'deposito_ventanilla';
                                     const rel = c.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === m.id);
                                     return (
                                       <div key={c.id} className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-955/20 border border-amber-200/80 dark:border-amber-900/40 text-[10px] text-gray-700 dark:text-gray-300 font-sans flex justify-between items-center gap-2 shadow-xs">
                                         <div className="flex items-center gap-1.5 min-w-0">
                                           <span className={`px-1.5 py-0.2 rounded text-[8px] font-black uppercase ${
                                             isVentanilla ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                           }`}>
                                             {isVentanilla ? 'Ventanilla' : 'Tarjeta'}
                                           </span>
                                           <span className="font-bold truncate">{c.descripcion || 'Ficha de Depósito'}</span>
                                           <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                              {formatCurrency(rel?.monto_asociado || c.monto)}
                                            </span>
                                           <span className="font-mono text-[9px] text-gray-400">({new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })})</span>
                                         </div>
                                         <div className="flex items-center gap-1.5 shrink-0">
                                           {c.archivo_url && (
                                             <button
                                               type="button"
                                               onClick={() => onDownloadFile(c.archivo_url!)}
                                               className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-0.5"
                                               title="Ver Ticket / Comprobante"
                                             >
                                               <Eye size={10} /> Ticket
                                             </button>
                                           )}
                                         </div>
                                       </div>
                                     );
                                   })}
                                 </div>
                               );
                             })()}

                            {/* Mostrar detalles de la conciliación si existen */}
                            {m.conciliaciones_bancarias && m.conciliaciones_bancarias.length > 0 && (() => {
                              const totalAcumuladoGasto = m.conciliaciones_bancarias.reduce((sum: number, link: any) => {
                                return sum + Number(link.monto_asociado || (link.gasto ? link.gasto.monto : link.pedido ? link.pedido.precio_total : 0));
                              }, 0);
                              const montoMov = Math.abs(Number(m.monto));
                              const difMonto = montoMov - totalAcumuladoGasto;
                              const esCoincidente = Math.abs(difMonto) < 0.05;

                              return (
                                <div className="mt-2 space-y-1.5 font-sans">
                                  {/* BANNER VISUAL DE PAGOS VINCULADOS / DIVIDIDOS ENTRE MULTIPLES MOVIMIENTOS */}
                                  {(() => {
                                    const linkedMovementsMap: any[] = [];
                                    m.conciliaciones_bancarias.forEach((link: any) => {
                                      const isG = !!link.gasto;
                                      const targetId = isG ? link.gasto?.id : link.pedido?.id;
                                      if (!targetId) return;

                                      movimientos.forEach((otherM: any) => {
                                        if (otherM.id === m.id) return;
                                        const oLink = otherM.conciliaciones_bancarias?.find((l: any) =>
                                          (isG && l.gasto?.id === targetId) || (!isG && l.pedido?.id === targetId)
                                        );
                                        if (oLink && !linkedMovementsMap.some(x => x.id === otherM.id)) {
                                          linkedMovementsMap.push({
                                            ...otherM,
                                            monto_asociado: oLink.monto_asociado || Math.abs(otherM.monto)
                                          });
                                        }
                                      });
                                    });

                                    if (linkedMovementsMap.length === 0) return null;

                                    const allMovs = [m, ...linkedMovementsMap];
                                    const totalPagadoAcumulado = allMovs.reduce((sum, x) => sum + Math.abs(Number(x.monto)), 0);

                                    return (
                                      <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-955/40 border border-indigo-200 dark:border-indigo-800 text-[10px] text-indigo-900 dark:text-indigo-200 font-sans space-y-1 shadow-sm">
                                        <div className="flex items-center justify-between font-extrabold flex-wrap gap-1">
                                          <span className="flex items-center gap-1.5">
                                            <Link size={13} className="text-indigo-600 dark:text-indigo-400" />
                                            <span>🔗 FACTURA COMPARTIDA / DIVIDIDA EN {allMovs.length} PAGOS BANCARIOS VINCULADOS</span>
                                          </span>
                                          <span className="font-mono text-[10px] text-indigo-800 dark:text-indigo-200 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-lg font-black">
                                            Suma Pagos: {formatCurrency(totalPagadoAcumulado)}
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                          {allMovs.map((movItem: any, oidx: number) => {
                                            const isCurrent = movItem.id === m.id;
                                            const fDate = movItem.fecha ? new Date(movItem.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '';
                                            return (
                                              <span
                                                key={oidx}
                                                className={`px-2 py-1 rounded-lg border text-[9px] font-mono flex items-center gap-1.5 ${
                                                  isCurrent
                                                    ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-xs'
                                                    : 'bg-white dark:bg-gray-900 text-indigo-900 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800'
                                                }`}
                                              >
                                                <span>{isCurrent ? '👉 Este pago:' : '🔗 Pago par:'}</span>
                                                <span>📅 {fDate}</span>
                                                <strong className="truncate max-w-[140px]" title={movItem.concepto}>{movItem.concepto}</strong>
                                                <span className="font-bold">({formatCurrency(Math.abs(Number(movItem.monto)))})</span>
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Encabezado con el ACUMULADO DEL GASTO (Suma de Facturas) */}
                                  <div className="flex items-center justify-between bg-emerald-100/80 dark:bg-emerald-950/40 p-2 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px]">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-extrabold text-emerald-900 dark:text-emerald-300">
                                        📊 Acumulado Gasto: <span className="font-mono text-xs">{formatCurrency(totalAcumuladoGasto)}</span>
                                      </span>
                                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                                        ({m.conciliaciones_bancarias.length} factura{m.conciliaciones_bancarias.length > 1 ? 's' : ''})
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {!esCoincidente ? (
                                        <span className="text-[9px] font-black bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                                          ⚠️ Dif: {formatCurrency(Math.abs(difMonto))}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-black bg-emerald-200 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                          ✓ Cubierto 100%
                                        </span>
                                      )}
                                      {handleOpenReconcileModal && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenReconcileModal(m)}
                                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-all shadow-sm flex items-center gap-1 shrink-0"
                                          title="Asignar más facturas a este movimiento"
                                        >
                                          <Plus size={12} /> Asignar más Facturas
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {/* Lista de facturas vinculadas */}
                                  {m.conciliaciones_bancarias.map((link: any, idx: number) => {
                                    const isGasto = !!link.gasto;
                                    const item = isGasto ? link.gasto : link.pedido;
                                    if (!item) return null;
                                    
                                    const dateDocStr = item.fecha_gasto || item.fecha_pedido
                                      ? new Date(item.fecha_gasto || item.fecha_pedido).toLocaleDateString('es-MX', { timeZone: 'UTC' })
                                      : 'Sin fecha';
                                      
                                    const rfc = isGasto 
                                      ? item.proveedores?.rfc 
                                      : item.clientes?.rfc;
                                      
                                    const nombre = isGasto 
                                      ? item.proveedores?.nombre_comercial 
                                      : (item.cliente_nombre || item.clientes?.nombre_local);
                                      
                                    const metodo = isGasto && item.metodo_pago 
                                      ? getMetodoPagoLabel(item.metodo_pago) 
                                      : null;

                                    return (
                                      <div key={idx} className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-[10px] text-gray-600 dark:text-gray-300 font-sans space-y-1 shadow-sm">
                                        <div className="flex justify-between items-center font-semibold text-emerald-800 dark:text-emerald-400 gap-2 flex-wrap">
                                          <span>🔗 {isGasto ? 'Egreso (Gasto)' : 'Venta (Pedido)'}: {isGasto ? item.concepto : `Pedido #${item.numero_pedido}`}</span>
                                          <div className="flex items-center gap-2">
                                            <span className="font-mono bg-emerald-100/60 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                              Asoc: {formatCurrency(link.monto_asociado)}
                                            </span>
                                            {handleUnlinkReconciliation && (
                                              <button
                                                type="button"
                                                onClick={() => handleUnlinkReconciliation(m.id)}
                                                className="text-red-550 hover:text-white hover:bg-red-500 dark:hover:bg-red-650 px-1.5 py-0.5 rounded text-[9px] font-bold border border-red-200 dark:border-red-900/50 transition-all flex items-center gap-0.5"
                                                title="Desvincular o quitar conciliación"
                                              >
                                                <X size={10} /> Desvincular
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-550 dark:text-gray-400 text-[9px] font-medium">
                                          {dateDocStr && <span><strong>Fecha XML:</strong> {dateDocStr}</span>}
                                          {nombre && (
                                            <>
                                              <span>•</span>
                                              <span><strong>Asignado a:</strong> {nombre} {rfc && <span className="font-mono text-[8px] bg-gray-200/55 dark:bg-gray-800 px-1 py-0.2 rounded text-gray-500">({rfc})</span>}</span>
                                            </>
                                          )}
                                          {metodo && (
                                            <>
                                              <span>•</span>
                                              <span><strong>Método Pago:</strong> {metodo}</span>
                                            </>
                                          )}
                                          {item.monto !== undefined && (
                                            <>
                                              <span>•</span>
                                              <span><strong>Importe Total:</strong> {formatCurrency(isGasto ? item.monto : item.precio_total)}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {m.movimiento_reembolso_id && (() => {
                              const otherMov = movimientos.find(x => x.id === m.movimiento_reembolso_id);
                              return (
                                <div className="mt-2 p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-955/20 border border-amber-100 dark:border-amber-900/40 text-[10px] text-gray-600 dark:text-gray-300 font-sans space-y-1 shadow-sm animate-in slide-in-from-top-1 duration-150">
                                  <div className="flex justify-between items-center font-semibold text-amber-850 dark:text-amber-400 gap-2 flex-wrap">
                                    <span>🔄 Reembolso Fusionado: {otherMov ? otherMov.concepto : 'Movimiento Vinculado'}</span>
                                    <div className="flex items-center gap-2">
                                      {otherMov && (
                                        <span className="font-mono bg-amber-100/60 dark:bg-amber-900/50 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                          Monto: {formatCurrency(Math.abs(otherMov.monto))}
                                        </span>
                                      )}
                                      {handleUnlinkReconciliation && (
                                        <button
                                          type="button"
                                          onClick={() => handleUnlinkReconciliation(m.id)}
                                          className="text-red-550 hover:text-white hover:bg-red-500 dark:hover:bg-red-655 px-1.5 py-0.5 rounded text-[9px] font-bold border border-red-200 dark:border-red-900/50 transition-all flex items-center gap-0.5"
                                          title="Desvincular o deshacer fusión"
                                        >
                                          <X size={10} /> Desvincular
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {m.comentarios && (
                                    <p className="text-gray-550 dark:text-gray-400 text-[9px] italic mt-0.5">
                                      <strong>Nota:</strong> {m.comentarios}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="p-3">
                            <select
                              className="w-full bg-transparent border-gray-200 dark:border-gray-700 rounded text-[10px] p-1.5 focus:ring-blue-500 dark:text-gray-300"
                              value={m.categoria_movimiento_id || ''}
                              onChange={(e) => handleUpdateCategoria?.(m.id, e.target.value)}
                            >
                              <option value="">- Sin Categoría -</option>
                              {categoriasMovimiento?.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-right font-mono font-bold">
                            {isRetiro ? (
                              <span className="text-red-500">-{formatCurrency(m.retiro)}</span>
                            ) : (
                              <div className="flex flex-col items-end gap-1 font-sans">
                                <span className="text-emerald-500">+{formatCurrency(m.deposito)}</span>
                                {(() => {
                                  const associatedComps = (comprobantes || []).filter(c => 
                                    c.comprobantes_deposito_movimientos?.some(rel => rel.movimiento_id === m.id)
                                  );
                                  const compsSum = associatedComps.reduce((acc, c) => {
                                    const rel = c.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === m.id);
                                    return acc + (rel ? Number(rel.monto_asociado) : 0);
                                  }, 0);
                                  if (associatedComps.length > 0) {
                                    const match = Math.abs(compsSum - Number(m.deposito)) < 0.05;
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => setActiveDepositMov(m)}
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 transition-all hover:scale-105 ${
                                          match
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                            : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                                        }`}
                                        title={`Suma: ${formatCurrency(compsSum)} / Depósito: ${formatCurrency(m.deposito)}`}
                                      >
                                        <span>📋 {associatedComps.length} comp</span>
                                        <span>({formatCurrency(compsSum)})</span>
                                        {match ? <span>✓</span> : <span>⚠️</span>}
                                      </button>
                                    );
                                  }
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => setActiveDepositMov(m)}
                                      className="px-1.5 py-0.5 rounded text-[8px] font-bold border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 hover:text-gray-655 dark:hover:text-gray-250 transition-all hover:bg-gray-50 dark:hover:bg-gray-900/40"
                                    >
                                      + Comprobantes
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {(() => {
                              const associatedComps = (comprobantes || []).filter(c => 
                                c.comprobantes_deposito_movimientos?.some(rel => rel.movimiento_id === m.id)
                              );
                              const compsSum = associatedComps.reduce((acc, c) => {
                                const rel = c.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === m.id);
                                return acc + (rel ? Number(rel.monto_asociado) : 0);
                              }, 0);
                              const isFullyLinked = !isRetiro && associatedComps.length > 0 && Math.abs(compsSum - Number(m.deposito)) < 0.05;

                              if (isFullyLinked) {
                                return (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold border bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                                    Conciliado
                                  </span>
                                );
                              }
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border"
                                  style={{ backgroundColor: `${color}15`, borderColor: `${color}40`, color }}>
                                  {m.estatus_conciliacion_bancaria?.nombre || 'Pendiente'}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-3 text-center">
                            {isRetiro ? (
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={m.visible_egresos}
                                  onChange={() => handleToggleVisibility(m.id, 'egresos', !m.visible_egresos)}
                                  className="w-3.5 h-3.5 rounded text-amber-500 border-gray-300 focus:ring-amber-500" />
                                <span className="text-[10px] text-gray-500">En Egresos</span>
                              </label>
                            ) : (
                              <label className="inline-flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={m.visible_ingresos}
                                  onChange={() => handleToggleVisibility(m.id, 'ingresos', !m.visible_ingresos)}
                                  className="w-3.5 h-3.5 rounded text-amber-500 border-gray-300 focus:ring-amber-500" />
                                <span className="text-[10px] text-gray-500">En Ingresos</span>
                              </label>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex gap-1 justify-center flex-wrap max-w-[150px] mx-auto">
                              {/* XML */}
                              {m.xml_url ? m.xml_url.split(',').filter(Boolean).map((url, i, a) => (
                                <button key={i} onClick={() => onDownloadFile(url)}
                                  className="p-1 rounded text-[10px] text-blue-500 hover:bg-blue-500/10 flex items-center gap-0.5" title={`XML ${i + 1}`}>
                                  <FileCode size={13} />{a.length > 1 && <span className="text-[8px] font-bold font-mono">{i + 1}</span>}
                                </button>
                              )) : <button disabled className="p-1 rounded text-[10px] text-gray-300 cursor-not-allowed"><FileCode size={13} /></button>}
                              {/* PDF Factura */}
                              {m.pdf_factura_url ? (
                                m.pdf_factura_url.split(',').filter(Boolean).map((url, i, a) => (
                                  <button key={i} onClick={() => onDownloadFile(url)}
                                    className="p-1 rounded text-[10px] text-red-500 hover:bg-red-500/10 flex items-center gap-0.5" title={`PDF ${i + 1}`}>
                                    <FileText size={13} />{a.length > 1 && <span className="text-[8px] font-bold font-mono">{i + 1}</span>}
                                  </button>
                                ))
                              ) : m.xml_url && handleViewCfdi ? (
                                <button onClick={() => handleViewCfdi(m.xml_url!.split(',')[0])}
                                  className="p-1 rounded text-[10px] text-indigo-600 hover:bg-indigo-500/10 flex items-center gap-0.5" title="Ver Representación CFDI">
                                  <Eye size={13} />
                                </button>
                              ) : (
                                <button disabled className="p-1 rounded text-[10px] text-gray-300 cursor-not-allowed"><FileText size={13} /></button>
                              )}
                              {/* Ticket */}
                              {(() => {
                                const associatedComps = (comprobantes || []).filter(c => 
                                  c.comprobantes_deposito_movimientos?.some(rel => rel.movimiento_id === m.id)
                                );
                                const compTicketUrls = associatedComps.map(c => c.archivo_url).filter(Boolean) as string[];
                                const directTicketUrls = m.pdf_ticket_url ? m.pdf_ticket_url.split(',').filter(Boolean) : [];
                                const allTicketUrls = Array.from(new Set([...directTicketUrls, ...compTicketUrls]));

                                if (allTicketUrls.length > 0) {
                                  return allTicketUrls.map((url, i) => (
                                    <button key={i} onClick={() => onDownloadFile(url)}
                                      className="p-1 rounded text-[10px] text-amber-500 hover:bg-amber-500/10 flex items-center gap-0.5" title={`Ticket / Comprobante ${i + 1}`}>
                                      <CreditCard size={13} />{allTicketUrls.length > 1 && <span className="text-[8px] font-bold font-mono">{i + 1}</span>}
                                    </button>
                                  ));
                                }
                                return <button disabled className="p-1 rounded text-[10px] text-gray-300 cursor-not-allowed"><CreditCard size={13} /></button>;
                              })()}
                              
                              {/* Soporte Reembolso */}
                              {m.soporte_reembolso_url && m.soporte_reembolso_url.split(',').filter(Boolean).map((url, i, a) => (
                                <button key={i} onClick={() => onDownloadFile(url)}
                                  className="p-1 rounded text-[10px] text-amber-605 dark:text-amber-400 hover:bg-amber-500/10 flex items-center gap-0.5" title={`Soporte Reembolso ${i + 1}`}>
                                  <Paperclip size={13} />{a.length > 1 && <span className="text-[8px] font-bold font-mono">{i + 1}</span>}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleOpenReconcileModal?.(m)}
                                className="p-1.5 rounded text-amber-500 hover:bg-amber-500/15 transition-colors" title="Conciliación Manual">
                                <ArrowRightLeft size={13} />
                              </button>
                              <button onClick={() => onEditMovimiento(m)}
                                disabled={m.estatus_conciliacion_bancaria?.clave !== 'pendiente'}
                                className={`p-1.5 rounded transition-colors ${m.estatus_conciliacion_bancaria?.clave !== 'pendiente' ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-500/15'}`} title={m.estatus_conciliacion_bancaria?.clave !== 'pendiente' ? "No editable (Conciliado)" : "Editar"}>
                                <Edit3 size={13} />
                              </button>
                              <button onClick={() => handleDeleteMovimiento?.(m.id)}
                                disabled={m.estatus_conciliacion_bancaria?.clave !== 'pendiente'}
                                className={`p-1.5 rounded transition-colors ${m.estatus_conciliacion_bancaria?.clave !== 'pendiente' ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-red-500 hover:bg-red-500/15'}`} title={m.estatus_conciliacion_bancaria?.clave !== 'pendiente' ? "No eliminable (Conciliado)" : "Eliminar"}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs shrink-0 select-none">
                <span className="text-gray-500">
                  Mostrando {filtered.length === 0 ? 0 : bancoPage * bancoPageSize + 1}–{Math.min((bancoPage + 1) * bancoPageSize, filtered.length)} de {filtered.length} movimientos
                </span>
                <div className="flex gap-1">
                  <button disabled={bancoPage === 0} onClick={() => setBancoPage(bancoPage - 1)}
                    className="px-2.5 py-1 rounded bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-all font-semibold">
                    Anterior
                  </button>
                  <button disabled={bancoPage >= totalPages - 1} onClick={() => setBancoPage(bancoPage + 1)}
                    className="px-2.5 py-1 rounded bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-all font-semibold">
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SUB-TAB 2: INGRESOS Y COMPROBANTES (UNIFICADO) ───────────────── */}
        {(bancoSubTab === 'ingresos_comprobantes' || bancoSubTab === 'global' || bancoSubTab === 'comprobantes') && (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto min-h-0">
            {/* Control de Sub-sección interna */}
            <div className="flex items-center gap-2 mb-4 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-2xl w-fit shrink-0 border border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setIngresosSubSeccion('comprobantes')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  ingresosSubSeccion === 'comprobantes'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <CreditCard size={15} /> Comprobantes y Fichas de Depósito ({comprobantes.length})
              </button>
              <button
                type="button"
                onClick={() => setIngresosSubSeccion('global')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  ingresosSubSeccion === 'global'
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Scale size={15} /> Facturación Global y Conciliación Ventas
              </button>
              <button
                type="button"
                onClick={() => setIngresosSubSeccion('factura_publico')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  ingresosSubSeccion === 'factura_publico'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <FileText size={15} /> 🧾 Factura Público en General
              </button>
            </div>

            {ingresosSubSeccion === 'comprobantes' && (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 gap-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden">
                  
                  {/* Formulario de creación */}
                  <div className="flex flex-col min-h-0 bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-xl p-4 overflow-auto shadow-sm font-sans">
                    <h4 className="text-xs font-extrabold uppercase text-amber-500 flex items-center gap-1.5 mb-4 border-b border-gray-150 dark:border-gray-900 pb-2">
                      <Plus size={14} /> Registrar Comprobante Independiente
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Tipo de Comprobante</label>
                        <select
                          value={newCompForm.tipo ?? 'deposito_ventanilla'}
                          onChange={(e) => setNewCompForm(p => ({ ...p, tipo: e.target.value as any }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                        >
                          <option value="deposito_ventanilla">Depósito en Ventanilla</option>
                          <option value="corte_tarjeta">Corte POS / Punto de Venta</option>
                          <option value="corte_bbva">Corte BBVA</option>
                          <option value="corte_parrot">Corte Parrot</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Fecha</label>
                          <input
                            type="date"
                            value={newCompForm.fecha ?? ''}
                            onChange={(e) => setNewCompForm(p => ({ ...p, fecha: e.target.value }))}
                            className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                          />
                        </div>
                        {newCompForm.tipo === 'deposito_ventanilla' ? (
                          <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Monto (MXN)</label>
                            <input
                              type="number"
                              placeholder="0.00"
                              step="0.01"
                              value={newCompForm.monto ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, monto: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none font-mono"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">Monto Calculado</label>
                            <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-750 p-2 rounded-lg text-xs font-mono font-bold text-gray-900 dark:text-white">
                              {(() => {
                                const tot = parseInputNumber(newCompForm.montoDebito || 0) +
                                            parseInputNumber(newCompForm.propinaDebito || 0) +
                                            parseInputNumber(newCompForm.montoCredito || 0) +
                                            parseInputNumber(newCompForm.propinaCredito || 0) +
                                            parseInputNumber(newCompForm.montoAmex || 0) +
                                            parseInputNumber(newCompForm.propinaAmex || 0) +
                                            parseInputNumber(newCompForm.montoEfectivo || 0) +
                                            parseInputNumber(newCompForm.propinaEfectivo || 0) +
                                            parseInputNumber(newCompForm.montoParrotpay || 0) +
                                            parseInputNumber(newCompForm.propinaParrotpay || 0);
                                return formatCurrency(tot);
                              })()}
                            </div>
                          </div>
                        )}
                      </div>

                      {newCompForm.tipo !== 'deposito_ventanilla' && (
                        <div className="p-3 bg-amber-50/50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-3 font-sans">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Desglose POS / Parrot (Ventas y Tarjetas)</span>
                          
                          <div className="space-y-2.5 text-xs font-mono">
                            {/* Efectivo */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold font-sans block mb-0.5">💵 Venta Efectivo</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newCompForm.montoEfectivo ?? ''}
                                  onChange={(e) => setNewCompForm(p => ({ ...p, montoEfectivo: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold font-sans block mb-0.5">Prop. Efectivo</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newCompForm.propinaEfectivo ?? ''}
                                  onChange={(e) => setNewCompForm(p => ({ ...p, propinaEfectivo: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                            </div>

                            {/* ParrotPay */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-purple-600 dark:text-purple-400 font-bold font-sans block mb-0.5">🦜 ParrotPay</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newCompForm.montoParrotpay ?? ''}
                                  onChange={(e) => setNewCompForm(p => ({ ...p, montoParrotpay: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-purple-600 dark:text-purple-400 font-bold font-sans block mb-0.5">Prop. ParrotPay</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newCompForm.propinaParrotpay ?? ''}
                                  onChange={(e) => setNewCompForm(p => ({ ...p, propinaParrotpay: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                            </div>

                            {/* Débito */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-gray-500 font-sans block mb-0.5">Imp. Débito (TDD)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newCompForm.montoDebito ?? ''}
                                  onChange={(e) => setNewCompForm(p => ({ ...p, montoDebito: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-gray-500 font-sans block mb-0.5">Prop. Débito</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newCompForm.propinaDebito ?? ''}
                                  onChange={(e) => setNewCompForm(p => ({ ...p, propinaDebito: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                            </div>

                            {/* Crédito */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-gray-500 font-sans block mb-0.5">Imp. Crédito (TDC)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newCompForm.montoCredito ?? ''}
                                  onChange={(e) => setNewCompForm(p => ({ ...p, montoCredito: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-gray-500 font-sans block mb-0.5">Prop. Crédito</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newCompForm.propinaCredito ?? ''}
                                  onChange={(e) => setNewCompForm(p => ({ ...p, propinaCredito: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                            </div>

                            {/* AMEX */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-gray-500 font-sans block mb-0.5">Imp. AMEX</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newCompForm.montoAmex ?? ''}
                                  onChange={(e) => setNewCompForm(p => ({ ...p, montoAmex: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-gray-500 font-sans block mb-0.5">Prop. AMEX</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={newCompForm.propinaAmex ?? ''}
                                  onChange={(e) => setNewCompForm(p => ({ ...p, propinaAmex: e.target.value }))}
                                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                                />
                              </div>
                            </div>

                            {/* Comisiones por Transacción (Parrot/POS) */}
                            <div className="pt-2 border-t border-amber-200 dark:border-amber-900/40 space-y-2 font-sans">
                              <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 block uppercase">
                                📉 Comisiones por Transacción (Bolsa Facturación)
                              </span>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[8px] text-gray-500 block mb-0.5">Comisión ($)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={newCompForm.comisionTransacciones ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const num = parseInputNumber(val);
                                      const autoIva = num > 0 ? (num * 0.16).toFixed(2) : '';
                                      setNewCompForm(p => ({ ...p, comisionTransacciones: val, ivaTransacciones: autoIva }));
                                    }}
                                    className="w-full bg-white dark:bg-gray-900 border border-rose-300 dark:border-rose-900 p-1 rounded text-xs text-rose-600 dark:text-rose-400 font-mono font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8px] text-gray-500 block mb-0.5">IVA (16%)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={newCompForm.ivaTransacciones ?? ''}
                                    onChange={(e) => setNewCompForm(p => ({ ...p, ivaTransacciones: e.target.value }))}
                                    className="w-full bg-white dark:bg-gray-900 border border-rose-300 dark:border-rose-900 p-1 rounded text-xs text-rose-600 dark:text-rose-400 font-mono font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8px] text-gray-500 block mb-0.5">Otros Cargos</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={newCompForm.otrosCargos ?? ''}
                                    onChange={(e) => setNewCompForm(p => ({ ...p, otrosCargos: e.target.value }))}
                                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1 rounded text-xs text-gray-900 dark:text-white font-mono"
                                  />
                                </div>
                              </div>
                              {(() => {
                                const com = parseInputNumber(newCompForm.comisionTransacciones || 0);
                                const iva = parseInputNumber(newCompForm.ivaTransacciones || 0);
                                const otros = parseInputNumber(newCompForm.otrosCargos || 0);
                                const totalCom = com + iva + otros;
                                return totalCom > 0 ? (
                                  <div className="p-1.5 rounded bg-rose-50 dark:bg-rose-955/30 border border-rose-200 dark:border-rose-900/40 text-[9px]">
                                    <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400">
                                      <span>Total a Bolsa:</span>
                                      <span className="font-mono">{formatCurrency(totalCom)}</span>
                                    </div>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Cuenta de Destino Relacionada</label>
                        <select
                          value={newCompForm.cuentaBancariaId ?? ''}
                          onChange={(e) => setNewCompForm(p => ({ ...p, cuentaBancariaId: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                        >
                          <option value="">- Ninguna / Seleccionar Banco -</option>
                          {(cuentasBancarias || []).map(cb => (
                            <option key={cb.id} value={cb.id}>{cb.nombre} - {cb.banco}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Descripción / Notas</label>
                        <textarea
                          rows={2}
                          placeholder="Ej: Depósito efectivo ventas fin de semana..."
                          value={newCompForm.descripcion ?? ''}
                          onChange={(e) => setNewCompForm(p => ({ ...p, descripcion: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                        />
                      </div>

                      {/* Adjunto Ticket y Almacenamiento */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Proveedor de Almacenamiento</label>
                        <div className="flex gap-4 mt-1 text-xs">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="comp_storage"
                              checked={newCompForm.storageProvider === 'Supabase'}
                              onChange={() => setNewCompForm(p => ({ ...p, storageProvider: 'Supabase', archivoUrl: '' }))}
                            />
                            <span>Supabase Storage</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="comp_storage"
                              checked={newCompForm.storageProvider === 'GoogleDrive'}
                              onChange={() => setNewCompForm(p => ({ ...p, storageProvider: 'GoogleDrive', archivoUrl: '' }))}
                            />
                            <span>Google Drive Link</span>
                          </label>
                        </div>
                      </div>

                      {newCompForm.storageProvider === 'Supabase' ? (
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Ticket de Depósito (Imagen / PDF)</label>
                          <div className="relative overflow-hidden w-full">
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={handleUploadCompFile}
                              disabled={compUploadLoading}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <button
                              type="button"
                              disabled={compUploadLoading}
                              className="w-full py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                            >
                              {compUploadLoading ? <RefreshCw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                              {newCompForm.archivoUrl ? 'Archivo cargado con éxito ✓' : 'Seleccionar Archivo...'}
                            </button>
                          </div>
                          {newCompForm.archivoUrl && (
                            <p className="text-[9px] text-gray-400 font-mono mt-1 truncate">{newCompForm.archivoUrl.split('/').pop()}</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Enlace de Google Drive</label>
                          <input
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={newCompForm.archivoUrl}
                            onChange={(e) => setNewCompForm(p => ({ ...p, archivoUrl: e.target.value }))}
                            className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none font-mono"
                          />
                        </div>
                      )}

                      {newCompForm.error && (
                        <div className="text-[11px] text-red-500 bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/50 p-2.5 rounded-lg">{newCompForm.error}</div>
                      )}

                      {editingCompId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCompId(null);
                            setNewCompForm({
                              tipo: 'deposito_ventanilla',
                              fecha: new Date().toISOString().substring(0, 10),
                              monto: '',
                              descripcion: '',
                              archivoUrl: '',
                              storageProvider: 'Supabase',
                              cuentaBancariaId: '',
                              loading: false,
                              error: '',
                              montoDebito: '',
                              montoCredito: '',
                              propinaDebito: '',
                              propinaCredito: '',
                              montoAmex: '',
                              propinaAmex: '',
                              montoEfectivo: '',
                              propinaEfectivo: '',
                              montoParrotpay: '',
                              propinaParrotpay: '',
                              comisionTransacciones: '',
                              ivaTransacciones: '',
                              otrosCargos: ''
                            });
                          }}
                          className="w-full mb-2 py-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          Cancelar Edición
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={async () => {
                          const tot = newCompForm.tipo === 'deposito_ventanilla'
                            ? parseInputNumber(newCompForm.monto)
                            : parseInputNumber(newCompForm.montoDebito || 0) +
                              parseInputNumber(newCompForm.montoCredito || 0) +
                              parseInputNumber(newCompForm.propinaDebito || 0) +
                              parseInputNumber(newCompForm.propinaCredito || 0) +
                              parseInputNumber(newCompForm.montoAmex || 0) +
                              parseInputNumber(newCompForm.propinaAmex || 0) +
                              parseInputNumber(newCompForm.montoEfectivo || 0) +
                              parseInputNumber(newCompForm.propinaEfectivo || 0) +
                              parseInputNumber(newCompForm.montoParrotpay || 0) +
                              parseInputNumber(newCompForm.propinaParrotpay || 0);

                          if (!tot || tot <= 0) {
                            setNewCompForm(p => ({ ...p, error: 'Por favor ingresa un monto válido mayor a 0.' }));
                            return;
                          }
                          if (!newCompForm.fecha) {
                            setNewCompForm(p => ({ ...p, error: 'Por favor selecciona la fecha del ticket.' }));
                            return;
                          }

                          if (editingCompId) {
                            const currentComp = comprobantes.find(c => c.id === editingCompId);
                            if (currentComp) {
                              const linkedSum = (currentComp.comprobantes_deposito_movimientos || []).reduce((acc, rel) => acc + Number(rel.monto_asociado), 0);
                              if (linkedSum > 0 && Math.abs(tot - linkedSum) >= 0.05) {
                                if (!confirm(`Advertencia: El nuevo monto del comprobante (${formatCurrency(tot)}) no coincide con la suma de los movimientos vinculados (${formatCurrency(linkedSum)}). ¿Deseas continuar?`)) {
                                  return;
                                }
                              }
                            }
                          }

                          setNewCompForm(p => ({ ...p, loading: true, error: '' }));
                          try {
                            const payload = {
                              tipo: newCompForm.tipo,
                              fecha: newCompForm.fecha,
                              monto: tot,
                              descripcion: newCompForm.descripcion,
                              archivo_url: newCompForm.archivoUrl,
                              storage_provider: newCompForm.storageProvider,
                              cuenta_bancaria_id: newCompForm.cuentaBancariaId || null,
                              monto_debito: parseInputNumber(newCompForm.montoDebito || 0),
                              monto_credito: parseInputNumber(newCompForm.montoCredito || 0),
                              propina_debito: parseInputNumber(newCompForm.propinaDebito || 0),
                              propina_credito: parseInputNumber(newCompForm.propinaCredito || 0),
                              monto_amex: parseInputNumber(newCompForm.montoAmex || 0),
                              propina_amex: parseInputNumber(newCompForm.propinaAmex || 0),
                              monto_efectivo: parseInputNumber(newCompForm.montoEfectivo || 0),
                              propina_efectivo: parseInputNumber(newCompForm.propinaEfectivo || 0),
                              monto_parrotpay: parseInputNumber(newCompForm.montoParrotpay || 0),
                              propina_parrotpay: parseInputNumber(newCompForm.propinaParrotpay || 0),
                              comision_transacciones: parseInputNumber(newCompForm.comisionTransacciones || 0),
                              iva_transacciones: parseInputNumber(newCompForm.ivaTransacciones || 0),
                              otros_cargos: parseInputNumber(newCompForm.otrosCargos || 0)
                            };

                            let res;
                            if (editingCompId) {
                              res = await onActualizarComprobante?.(editingCompId, payload);
                            } else {
                              res = await onCrearComprobante?.(payload);
                            }

                            if (res && !res.success) {
                              throw new Error(res.error);
                            }

                            // Si se registraron comisiones de transacción en el ticket, registrar en la Bolsa
                            const comVal = parseInputNumber(newCompForm.comisionTransacciones || 0);
                            const ivaVal = parseInputNumber(newCompForm.ivaTransacciones || 0);
                            const otrosVal = parseInputNumber(newCompForm.otrosCargos || 0);
                            const totalComBolsa = comVal + ivaVal + otrosVal;

                            if (totalComBolsa > 0 && !editingCompId && onCrearComprobante) {
                              await onCrearComprobante({
                                tipo: 'deposito_ventanilla',
                                fecha: newCompForm.fecha,
                                monto: totalComBolsa,
                                descripcion: `Comisión Transacciones POS/Parrot (Comisión: ${formatCurrency(comVal)}, IVA: ${formatCurrency(ivaVal)}${otrosVal ? `, Otros: ${formatCurrency(otrosVal)}` : ''}) - Ticket ${newCompForm.descripcion || ''}`,
                                cuentaBancariaId: newCompForm.cuentaBancariaId || null
                              });
                            }

                            if (selectedMonth && payload.fecha.substring(0, 7) !== selectedMonth) {
                              alert(`Atención: El comprobante se guardó con fecha ${payload.fecha}, la cual pertenece al período (${payload.fecha.substring(0, 7)}). Para visualizarlo en la lista de conciliación, selecciona ese período en la parte superior.`);
                            }

                            setEditingCompId(null);
                            setNewCompForm({
                              tipo: 'deposito_ventanilla',
                              fecha: getDefaultDateForSelectedMonth(),
                              monto: '',
                              descripcion: '',
                              archivoUrl: '',
                              storageProvider: 'Supabase',
                              cuentaBancariaId: '',
                              loading: false,
                              error: '',
                              montoDebito: '',
                              montoCredito: '',
                              propinaDebito: '',
                              propinaCredito: '',
                              montoAmex: '',
                              propinaAmex: '',
                              montoEfectivo: '',
                              propinaEfectivo: '',
                              montoParrotpay: '',
                              propinaParrotpay: '',
                              comisionTransacciones: '',
                              ivaTransacciones: '',
                              otrosCargos: ''
                            });
                          } catch (err: any) {
                            setNewCompForm(p => ({ ...p, error: err.message || 'Error al guardar.' }));
                          } finally {
                            setNewCompForm(p => ({ ...p, loading: false }));
                          }
                        }}
                        disabled={newCompForm.loading || compUploadLoading}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 transition-all mt-2"
                      >
                        {newCompForm.loading ? <RefreshCw size={14} className="animate-spin" /> : (editingCompId ? <Check size={14} /> : <Plus size={14} />)}
                        {editingCompId ? 'Actualizar Comprobante' : 'Guardar Comprobante'}
                      </button>
                    </div>
                  </div>

                  {/* Tabla de comprobantes */}
                  <div className="lg:col-span-2 flex flex-col min-h-0 bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm font-sans">
                    <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 shrink-0 flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="text-xs font-extrabold uppercase text-amber-500 flex items-center gap-1.5">
                          <List size={14} /> Comprobantes Registrados
                        </h4>
                        
                        {/* SUB-PESTAÑAS TICKETS VS DEPÓSITOS */}
                        <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-900 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setCompSubFiltro('todos')}
                            className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                              compSubFiltro === 'todos'
                                ? 'bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => setCompSubFiltro('tickets')}
                            className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1.5 ${
                              compSubFiltro === 'tickets'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <Ticket size={13} /> Tickets / Cortes POS
                          </button>
                          <button
                            type="button"
                            onClick={() => setCompSubFiltro('depositos')}
                            className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1.5 ${
                              compSubFiltro === 'depositos'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <Landmark size={13} /> Depósitos Ventanilla
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={selectedCuentaId}
                          onChange={(e) => setSelectedCuentaId(e.target.value)}
                          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-2.5 py-1 rounded-lg text-xs text-gray-900 dark:text-white font-sans font-semibold outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="">Todas las Cuentas</option>
                          {cuentasBancarias?.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                          ))}
                        </select>
                        <span className="text-[10px] font-bold text-gray-400">
                          ({comprobantes.filter(c => {
                            if (compSubFiltro === 'tickets' && c.tipo === 'deposito_ventanilla') return false;
                            if (compSubFiltro === 'depositos' && c.tipo !== 'deposito_ventanilla') return false;
                            if (!selectedCuentaId) return true;

                            const selCuenta = cuentasBancarias?.find(cb => cb.id === selectedCuentaId);
                            const isCaja = selCuenta?.nombre?.toUpperCase().includes('CAJA CHICA') || selCuenta?.nombre?.toUpperCase().includes('EFECTIVO');
                            const isParrot = selCuenta?.nombre?.toUpperCase().includes('PARROT');
                            const isBBVA = selCuenta?.nombre?.toUpperCase().includes('BBVA');

                            // Si el comprobante ya tiene una cuenta bancaria destino asignada explícitamente (ej: Parrot)
                            if (c.cuenta_bancaria_id && c.cuenta_bancaria_id !== selectedCuentaId) {
                              if (isCaja && (Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0)) return true;
                              return false;
                            }

                            if (c.cuenta_bancaria_id === selectedCuentaId) return true;
                            if (isCaja && (Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0)) return true;
                            if (isParrot && (Number(c.monto_parrotpay || 0) > 0 || Number(c.propina_parrotpay || 0) > 0 || c.tipo === 'corte_parrot')) return true;

                            if (isBBVA) {
                              if (c.tipo === 'corte_parrot') return false;
                              const tarjetaTotalBBVA = Number(c.monto_debito || 0) + Number(c.propina_debito || 0) + Number(c.monto_credito || 0) + Number(c.propina_credito || 0) + Number(c.monto_amex || 0) + Number(c.propina_amex || 0);
                              if (tarjetaTotalBBVA > 0 || c.tipo === 'corte_bbva') return true;
                            }

                            if (!c.cuenta_bancaria_id) return true;
                            return false;
                          }).length} de {comprobantes.length})
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Tipo / Desglose</th>
                            <th className="p-3">Banco Destino</th>
                            <th className="p-3">Descripción</th>
                            <th className="p-3 text-right">Monto</th>
                            <th className="p-3 text-center">Ticket</th>
                            <th className="p-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                          {comprobantes
                            .filter(c => {
                              if (compSubFiltro === 'tickets' && c.tipo === 'deposito_ventanilla') return false;
                              if (compSubFiltro === 'depositos' && c.tipo !== 'deposito_ventanilla') return false;
                              if (!selectedCuentaId) return true;

                              const selCuenta = cuentasBancarias?.find(cb => cb.id === selectedCuentaId);
                              const isCaja = selCuenta?.nombre?.toUpperCase().includes('CAJA CHICA') || selCuenta?.nombre?.toUpperCase().includes('EFECTIVO');
                              const isParrot = selCuenta?.nombre?.toUpperCase().includes('PARROT');
                              const isBBVA = selCuenta?.nombre?.toUpperCase().includes('BBVA');

                              if (c.cuenta_bancaria_id && c.cuenta_bancaria_id !== selectedCuentaId) {
                                if (isCaja && (Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0)) return true;
                                return false;
                              }

                              if (c.cuenta_bancaria_id === selectedCuentaId) return true;
                              if (isCaja && (Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0)) return true;
                              if (isParrot && (Number(c.monto_parrotpay || 0) > 0 || Number(c.propina_parrotpay || 0) > 0 || c.tipo === 'corte_parrot')) return true;

                              if (isBBVA) {
                                if (c.tipo === 'corte_parrot') return false;
                                const tarjetaTotalBBVA = Number(c.monto_debito || 0) + Number(c.propina_debito || 0) + Number(c.monto_credito || 0) + Number(c.propina_credito || 0) + Number(c.monto_amex || 0) + Number(c.propina_amex || 0);
                                if (tarjetaTotalBBVA > 0 || c.tipo === 'corte_bbva') return true;
                              }

                              if (!c.cuenta_bancaria_id) return true;
                              return false;
                            })
                            .map(c => {
                              const isVentanilla = c.tipo === 'deposito_ventanilla';
                              const sumAsoc = c.comprobantes_deposito_movimientos?.reduce((s, r) => s + Number(r.monto_asociado || 0), 0) || 0;
                              const isFullyAssoc = Math.abs(Number(c.monto) - sumAsoc) < 0.05;

                              const selCuenta = cuentasBancarias?.find(cb => cb.id === selectedCuentaId);
                              const isCajaFilter = selCuenta?.nombre?.toUpperCase().includes('CAJA CHICA') || selCuenta?.nombre?.toUpperCase().includes('EFECTIVO');
                              const isParrotFilter = selCuenta?.nombre?.toUpperCase().includes('PARROT');
                              const isBBVAFilter = selCuenta?.nombre?.toUpperCase().includes('BBVA');
                              const tarjetaTotalBBVA = Number(c.monto_debito || 0) + Number(c.propina_debito || 0) + Number(c.monto_credito || 0) + Number(c.propina_credito || 0) + Number(c.monto_amex || 0) + Number(c.propina_amex || 0);

                              return (
                                <tr key={c.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/20 transition-all">
                                  <td className="p-3 font-mono text-gray-500">{new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                                        c.tipo === 'deposito_ventanilla' ? 'bg-blue-100 dark:bg-blue-955/30 text-blue-600 dark:text-blue-400' :
                                        c.tipo === 'corte_bbva' ? 'bg-sky-100 dark:bg-sky-955/30 text-sky-600 dark:text-sky-400' :
                                        c.tipo === 'corte_parrot' ? 'bg-emerald-100 dark:bg-emerald-955/30 text-emerald-600 dark:text-emerald-400' :
                                        'bg-purple-100 dark:bg-purple-955/30 text-purple-600 dark:text-purple-400'
                                      }`}>
                                        {c.tipo === 'deposito_ventanilla' ? 'Depósito Ventanilla' :
                                         c.tipo === 'corte_bbva' ? 'Corte BBVA' :
                                         c.tipo === 'corte_parrot' ? 'Corte Parrot' :
                                         'Corte POS'}
                                      </span>
                                      {isFullyAssoc ? (
                                        <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-955/30 dark:text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Conciliado</span>
                                      ) : (
                                        <span className="bg-amber-100 text-amber-700 dark:bg-amber-955/30 dark:text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Pendiente</span>
                                      )}
                                    </div>
                                    {!isVentanilla && (
                                      <div className="mt-1 text-[9px] font-mono space-y-0.5">
                                        {(Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0) && (
                                          <div className="text-emerald-600 dark:text-emerald-400 font-bold">💵 Efec: {formatCurrency(c.monto_efectivo || 0)}{Number(c.propina_efectivo || 0) > 0 ? ` (+Prop: ${formatCurrency(c.propina_efectivo!)})` : ''}</div>
                                        )}
                                        {(Number(c.monto_parrotpay || 0) > 0 || Number(c.propina_parrotpay || 0) > 0) && (
                                          <div className="text-purple-600 dark:text-purple-400 font-bold">🦜 ParrotPay: {formatCurrency(c.monto_parrotpay || 0)}{Number(c.propina_parrotpay || 0) > 0 ? ` (+Prop: ${formatCurrency(c.propina_parrotpay!)})` : ''}</div>
                                        )}
                                        {(Number(c.monto_debito || 0) > 0 || Number(c.propina_debito || 0) > 0) && (
                                          <div className={isBBVAFilter ? "text-sky-600 dark:text-sky-400 font-bold" : "text-gray-500"}>💳 Débito: {formatCurrency(c.monto_debito || 0)}{Number(c.propina_debito || 0) > 0 ? ` (+Prop: ${formatCurrency(c.propina_debito!)})` : ''}</div>
                                        )}
                                        {(Number(c.monto_credito || 0) > 0 || Number(c.propina_credito || 0) > 0) && (
                                          <div className={isBBVAFilter ? "text-sky-600 dark:text-sky-400 font-bold" : "text-gray-500"}>💳 Crédito: {formatCurrency(c.monto_credito || 0)}{Number(c.propina_credito || 0) > 0 ? ` (+Prop: ${formatCurrency(c.propina_credito!)})` : ''}</div>
                                        )}
                                        {(Number(c.monto_amex || 0) > 0 || Number(c.propina_amex || 0) > 0) && (
                                          <div className={isBBVAFilter ? "text-sky-600 dark:text-sky-400 font-bold" : "text-gray-500"}>💳 Amex: {formatCurrency(c.monto_amex || 0)}{Number(c.propina_amex || 0) > 0 ? ` (+Prop: ${formatCurrency(c.propina_amex!)})` : ''}</div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 font-medium text-gray-700 dark:text-gray-300">
                                    {cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre || '-'}
                                  </td>
                                  <td className="p-3 text-gray-600 dark:text-gray-400 font-mono text-[11px] max-w-[200px] truncate" title={c.descripcion || ''}>
                                    {c.descripcion || '-'}
                                  </td>
                                  <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                                    {isCajaFilter && (Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0) ? (
                                      <div>
                                        <span className="text-emerald-600 dark:text-emerald-400 block">{formatCurrency(Number(c.monto_efectivo || 0) + Number(c.propina_efectivo || 0))}</span>
                                        <span className="text-[9px] text-gray-400 font-mono block font-normal">({formatCurrency(c.monto_efectivo || 0)} Efec / {formatCurrency(c.monto)} Corte)</span>
                                      </div>
                                    ) : isParrotFilter && (Number(c.monto_parrotpay || 0) > 0 || Number(c.propina_parrotpay || 0) > 0) ? (
                                      <div>
                                        <span className="text-purple-600 dark:text-purple-400 block">{formatCurrency(Number(c.monto_parrotpay || 0) + Number(c.propina_parrotpay || 0))}</span>
                                        <span className="text-[9px] text-gray-400 font-mono block font-normal">({formatCurrency(c.monto_parrotpay || 0)} Parrot / {formatCurrency(c.monto)} Corte)</span>
                                      </div>
                                    ) : isBBVAFilter && tarjetaTotalBBVA > 0 ? (
                                      <div>
                                        <span className="text-sky-600 dark:text-sky-400 block">{formatCurrency(tarjetaTotalBBVA)}</span>
                                        <span className="text-[9px] text-gray-400 font-mono block font-normal">({formatCurrency(tarjetaTotalBBVA)} Tarjetas BBVA / {formatCurrency(c.monto)} Corte)</span>
                                      </div>
                                    ) : (
                                      formatCurrency(c.monto)
                                    )}
                                    {sumAsoc > 0 && (
                                      <div className="text-[9px] font-normal text-emerald-500">Asoc: {formatCurrency(sumAsoc)}</div>
                                    )}
                                  </td>
                                  <td className="p-3 text-center">
                                    {c.archivo_url ? (
                                      <button
                                        onClick={() => {
                                          if (onDownloadFile) onDownloadFile(c.archivo_url!);
                                          else if (handleViewCfdi) handleViewCfdi(c.archivo_url!);
                                          else window.open(c.archivo_url!, '_blank');
                                        }}
                                        className="p-1 bg-amber-50 dark:bg-amber-955/20 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-900/40 text-[9px] font-bold inline-flex items-center gap-0.5"
                                      >
                                        <Eye size={10} /> Ver
                                      </button>
                                    ) : (
                                      <span className="text-[9px] text-gray-400 italic">Sin Ticket</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="flex justify-end gap-1.5 flex-wrap">
                                      <button
                                        type="button"
                                        onClick={() => setActiveCompToLink(c)}
                                        className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-955/20 rounded font-bold text-[10px] flex items-center gap-0.5"
                                        title="Vincular con movimientos de la misma cuenta bancaria"
                                      >
                                        <Link size={11} /> Vincular Movs.
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingCompId(c.id);
                                          setNewCompForm({
                                            tipo: c.tipo,
                                            fecha: c.fecha,
                                            monto: String(c.monto || ''),
                                            archivoUrl: c.archivo_url || '',
                                            storageProvider: c.storage_provider || 'Supabase',
                                            cuentaBancariaId: c.cuenta_bancaria_id || '',
                                            descripcion: c.descripcion || '',
                                            loading: false,
                                            error: '',
                                            montoDebito: String(c.monto_debito || ''),
                                            montoCredito: String(c.monto_credito || ''),
                                            propinaDebito: String(c.propina_debito || ''),
                                            propinaCredito: String(c.propina_credito || ''),
                                            montoAmex: String(c.monto_amex || ''),
                                            propinaAmex: String(c.propina_amex || ''),
                                            montoEfectivo: String(c.monto_efectivo || ''),
                                            propinaEfectivo: String(c.propina_efectivo || ''),
                                            montoParrotpay: String(c.monto_parrotpay || ''),
                                            propinaParrotpay: String(c.propina_parrotpay || ''),
                                            comisionTransacciones: String(c.comision_transacciones || ''),
                                            ivaTransacciones: String(c.iva_transacciones || ''),
                                            otrosCargos: String(c.otros_cargos || '')
                                          });
                                        }}
                                        className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-955/20 rounded font-bold text-[10px] flex items-center gap-0.5"
                                      >
                                        <Edit3 size={11} /> Editar
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm('¿Estás seguro de eliminar este comprobante?')) {
                                            onEliminarComprobante?.(c.id);
                                          }
                                        }}
                                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 rounded font-bold text-[10px]"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          {comprobantes.filter(c => !selectedCuentaId || !c.cuenta_bancaria_id || c.cuenta_bancaria_id === selectedCuentaId).length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                                {selectedCuentaId ? (
                                  <div className="flex flex-col items-center justify-center gap-2 py-2">
                                    <span>No hay comprobantes registrados para la cuenta bancaria seleccionada.</span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCuentaId('')}
                                      className="px-3 py-1 bg-amber-500 text-white font-bold text-xs rounded-lg shadow-sm hover:bg-amber-600 transition-all"
                                    >
                                      Mostrar comprobantes de todas las cuentas
                                    </button>
                                  </div>
                                ) : (
                                  'No hay comprobantes registrados.'
                                )}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {ingresosSubSeccion === 'global' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-hidden">
                {/* 1. DEPÓSITOS BANCARIOS (SELECCIÓN SIMPLE O MÚLTIPLE CON CHECKBOXES) */}
                <div className="flex flex-col min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm font-sans">
                  {(() => {
                    const unconciliados = movimientos.filter((m) => {
                      if (m.tipo_movimiento !== 'Deposito') return false;
                      if (selectedCuentaId && m.cuenta_bancaria_id !== selectedCuentaId) return false;
                      const clave = m.estatus_conciliacion_bancaria?.clave || 'pendiente';
                      if (clave === 'conciliado' || clave === 'comprobado') return false;
                      const isLinked = comprobantes.some(c => c.comprobantes_deposito_movimientos?.some(rel => rel.movimiento_id === m.id));
                      if (isLinked) return false;
                      return true;
                    });
                    const selectedMovs = unconciliados.filter(m => (selectedGlobalDepositIds || []).includes(m.id));
                    const selectedSum = selectedMovs.reduce((acc, m) => acc + Number(m.deposito || m.monto || 0), 0);
                    const allSelected = unconciliados.length > 0 && selectedMovs.length === unconciliados.length;

                    return (
                      <>
                        <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 shrink-0 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-extrabold uppercase text-amber-500 flex items-center gap-1.5">
                              <CreditCard size={14} /> 1. Depósitos Bancarios
                            </h4>
                            <select
                              value={selectedCuentaId}
                              onChange={(e) => {
                                setSelectedCuentaId(e.target.value);
                                setSelectedGlobalDepositIds([]);
                                setSelectedGlobalComprobanteIds([]);
                                setSelectedGlobalDepositId(null);
                              }}
                              className="bg-white dark:bg-gray-950 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded text-[11px] font-bold text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-sm"
                            >
                              <option value="">Todas las Cuentas</option>
                              {cuentasBancarias?.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                              ))}
                            </select>
                            {selectedMovs.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-sm">
                                {selectedMovs.length} seleccionado{selectedMovs.length > 1 ? 's' : ''} (+{formatCurrency(selectedSum)})
                              </span>
                            )}
                          </div>
                          {unconciliados.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (allSelected) {
                                  setSelectedGlobalDepositIds([]);
                                  setSelectedGlobalDepositId(null);
                                } else {
                                  const ids = unconciliados.map(m => m.id);
                                  setSelectedGlobalDepositIds(ids);
                                  setSelectedGlobalDepositId(ids[0] || null);
                                }
                              }}
                              className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {allSelected ? 'Desmarcar Todos' : 'Seleccionar Todos'}
                            </button>
                          )}
                        </div>

                        <div className="flex-1 overflow-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                <th className="p-3 w-10 text-center" />
                                <th className="p-3">Fecha</th>
                                <th className="p-3">Concepto</th>
                                <th className="p-3 text-right">Depósito</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                              {unconciliados.map((m) => {
                                const isChecked = (selectedGlobalDepositIds || []).includes(m.id);
                                return (
                                  <tr
                                    key={m.id}
                                    onClick={() => {
                                      const current = [...(selectedGlobalDepositIds || [])];
                                      const idx = current.indexOf(m.id);
                                      if (idx > -1) {
                                        current.splice(idx, 1);
                                      } else {
                                        current.push(m.id);
                                      }
                                      setSelectedGlobalDepositIds(current);
                                      setSelectedGlobalDepositId(current[0] || null);
                                      setSelectedGlobalPedidosIds([]);
                                    }}
                                    className={`cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-all ${
                                      isChecked ? 'bg-amber-500/15 border-l-4 border-l-amber-500 font-medium' : ''
                                    }`}
                                  >
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // Se maneja en el onClick de la fila
                                        className="w-4 h-4 text-amber-500 focus:ring-amber-500 rounded cursor-pointer accent-amber-500"
                                      />
                                    </td>
                                    <td className="p-3 font-mono text-gray-500">{new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</td>
                                    <td className="p-3">
                                      <div className="font-bold text-gray-800 dark:text-gray-200">{m.concepto}</div>
                                      {m.referencia && <span className="text-[10px] text-gray-400">Ref: {m.referencia}</span>}
                                    </td>
                                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(m.deposito || m.monto)}</td>
                                  </tr>
                                );
                              })}
                              {unconciliados.length === 0 && (
                                <tr>
                                  <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                                    No hay depósitos pendientes de conciliar en este período
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 2. ASIGNACIÓN Y VINCULACIÓN A VENTAS / FICHAS */}
                <div className="flex flex-col min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm font-sans">
                  {(() => {
                    const selectedMovs = movimientos.filter(m => (selectedGlobalDepositIds || []).includes(m.id));
                    const selectedSum = selectedMovs.reduce((acc, m) => acc + Number(m.deposito || m.monto || 0), 0);

                    const selCuenta = cuentasBancarias?.find(cb => cb.id === selectedCuentaId);
                    const isCajaChicaFilter = selCuenta?.nombre?.toUpperCase().includes('CAJA CHICA') || selCuenta?.nombre?.toUpperCase().includes('EFECTIVO');
                    const isParrotPayFilter = selCuenta?.nombre?.toUpperCase().includes('PARROT');

                    const isCajaChicaTarget = selectedMovs.some(m => {
                      const conceptUpper = (m.concepto || '').toUpperCase();
                      const cuentaNombre = cuentasBancarias?.find(cb => cb.id === m.cuenta_bancaria_id)?.nombre?.toUpperCase() || '';
                      return conceptUpper.includes('CAJA CHICA') || conceptUpper.includes('EFECTIVO') || cuentaNombre.includes('CAJA CHICA');
                    }) || isCajaChicaFilter;

                    const isPlatformWithCommission = selectedMovs.some(m => {
                      const conceptUpper = (m.concepto || '').toUpperCase();
                      return (
                        conceptUpper.includes('SPEI RECIBIDOBANORTE') ||
                        conceptUpper.includes('PARROT') ||
                        conceptUpper.includes('BANORTE') ||
                        conceptUpper.includes('DESCUENTO') ||
                        conceptUpper.includes('COMISION') ||
                        conceptUpper.includes('COMISIÓ') ||
                        conceptUpper.includes('OELTRANSFER')
                      );
                    });

                    const getCompReconciliationAmount = (item: typeof comprobantes[0], isParrot: boolean, isCaja: boolean) => {
                      if (isCaja) {
                        const efecSum = Number(item.monto_efectivo || 0) + Number(item.propina_efectivo || 0);
                        return efecSum;
                      }
                      if (isParrot) {
                        const parrotSum = Number(item.monto_parrotpay || 0) + Number(item.propina_parrotpay || 0);
                        if (parrotSum > 0) return parrotSum;

                        const otrosMetodosSum = Number(item.monto_efectivo || 0) + Number(item.monto_debito || 0) + Number(item.monto_credito || 0) + Number(item.monto_amex || 0);
                        if (otrosMetodosSum === 0 && Number(item.monto || 0) > 0) {
                          return Number(item.monto || 0);
                        }

                        return 0;
                      }
                      return Number(item.monto || 0);
                    };

                    const getCompPendingAmount = (item: typeof comprobantes[0], isParrot: boolean, isCaja: boolean) => {
                      const effectiveMonto = getCompReconciliationAmount(item, isParrot, isCaja);
                      const sumAsoc = item.comprobantes_deposito_movimientos?.reduce((s, r) => s + Number(r.monto_asociado || 0), 0) || 0;
                      return Math.max(0, effectiveMonto - sumAsoc);
                    };

                    const unlinkedComprobantes = comprobantes.filter(c => {
                      if (selectedCuentaId && c.cuenta_bancaria_id && c.cuenta_bancaria_id !== selectedCuentaId) {
                        if (isCajaChicaFilter && (Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0)) {
                          // Incluir comprobante si tiene desglose de efectivo para Caja Chica
                        } else if (isParrotPayFilter && (Number(c.monto_parrotpay || 0) > 0 || Number(c.propina_parrotpay || 0) > 0)) {
                          // Incluir para ParrotPay
                        } else {
                          return false;
                        }
                      }
                      const effectiveMonto = getCompReconciliationAmount(c, isPlatformWithCommission || isParrotPayFilter, isCajaChicaTarget);
                      if ((isPlatformWithCommission || isParrotPayFilter || isCajaChicaTarget) && effectiveMonto === 0) return false;
                      const pending = getCompPendingAmount(c, isPlatformWithCommission || isParrotPayFilter, isCajaChicaTarget);
                      return pending >= 0.05;
                    });

                    const selectedComps = unlinkedComprobantes.filter(c => (selectedGlobalComprobanteIds || []).includes(c.id));
                    const selectedCompsSum = selectedComps.reduce((acc, c) => acc + getCompPendingAmount(c, isPlatformWithCommission, isCajaChicaTarget), 0);
                    const allCompsSelected = unlinkedComprobantes.length > 0 && selectedComps.length === unlinkedComprobantes.length;

                    const handleVincularComprobantes = async (targetComps: typeof unlinkedComprobantes) => {
                      if (targetComps.length === 0 || selectedMovs.length === 0) return;
                      const compsSum = targetComps.reduce((acc, c) => acc + getCompPendingAmount(c, isPlatformWithCommission, isCajaChicaTarget), 0);
                      const dif = compsSum - selectedSum;
                      const isExactMatch = Math.abs(dif) < 0.05;

                      if (!isExactMatch && !isPlatformWithCommission) {
                        alert(
                          `⛔ No se permite vincular esta selección.\n\n` +
                          `El total de los tickets/fichas seleccionados debe coincidir al 100% con el o los depósitos bancarios seleccionados.\n\n` +
                          `• Total Ticket(s): ${formatCurrency(compsSum)} (${targetComps.length} ticket/s)\n` +
                          `• Total Depósito(s): ${formatCurrency(selectedSum)} (${selectedMovs.length} depósito/s)\n` +
                          `• Diferencia pendiente: ${formatCurrency(dif)}`
                        );
                        return;
                      }

                      if (!isExactMatch && isPlatformWithCommission) {
                        const parrotVenta = targetComps.reduce((sum, c) => {
                          const pMonto = Number(c.monto_parrotpay || 0);
                          return sum + (pMonto > 0 ? pMonto : Number(c.monto || 0));
                        }, 0);
                        const parrotPropina = targetComps.reduce((sum, c) => sum + Number(c.propina_parrotpay || 0), 0);
                        const comisionBruta = dif > 0 ? (dif / 1.16).toFixed(2) : '0.00';
                        const ivaBruto = dif > 0 ? (dif - parseInputNumber(comisionBruta)).toFixed(2) : '0.00';

                        setDesgloseComisionesModal({
                          isOpen: true,
                          targetComps,
                          ventaBruta: parrotVenta.toFixed(2),
                          propina: parrotPropina.toFixed(2),
                          comisionTransacciones: comisionBruta,
                          ivaTransacciones: ivaBruto,
                          otrosCargos: '0.00'
                        });
                        return;
                      }

                      for (const comp of targetComps) {
                        for (const movId of selectedGlobalDepositIds) {
                          const mov = movimientos.find(m => m.id === movId);
                          const montoAsoc = (targetComps.length === 1 && selectedMovs.length > 1 && mov)
                            ? Number(mov.deposito || mov.monto)
                            : Number(comp.monto);
                          const res = await onVincularComprobante?.(comp.id, movId, montoAsoc);
                          if (res && !res.success) {
                            alert(res.error);
                            break;
                          }
                        }
                      }

                      setSelectedGlobalDepositIds([]);
                      setSelectedGlobalComprobanteIds([]);
                      setSelectedGlobalDepositId(null);
                    };

                    return (
                      <>
                        <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 shrink-0 flex justify-between items-center flex-wrap gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setModoConciliacionIngreso('pedidos')}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                                modoConciliacionIngreso === 'pedidos'
                                  ? 'bg-emerald-500 text-white shadow-sm'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                              }`}
                            >
                              <Layers size={11} className="inline mr-1" /> 2a. Ventas / Pedidos
                            </button>
                            <button
                              type="button"
                              onClick={() => setModoConciliacionIngreso('fichas')}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                                modoConciliacionIngreso === 'fichas'
                                  ? 'bg-amber-500 text-white shadow-sm'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                              }`}
                            >
                              <CreditCard size={11} className="inline mr-1" /> 2b. Fichas / Comprobantes
                            </button>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {selectedMovs.length > 0 && (
                              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-955/30 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/40">
                                Depósito(s) ({selectedMovs.length}): <span className="font-mono font-black">{formatCurrency(selectedSum)}</span>
                              </div>
                            )}

                            {modoConciliacionIngreso === 'fichas' && selectedComps.length > 0 && (
                              <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-955/30 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-900/40">
                                Ticket(s) ({selectedComps.length}): <span className="font-mono font-black">{formatCurrency(selectedCompsSum)}</span>
                              </div>
                            )}

                            {selectedMovs.length === 0 && selectedComps.length === 0 && (
                              <span className="text-[10px] text-gray-400 italic">
                                👈 Selecciona 1 o más depósitos e indica los tickets a vincular
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 overflow-auto">
                          {modoConciliacionIngreso === 'pedidos' ? (
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                  <th className="p-3 w-12 text-center" />
                                  <th className="p-3">Pedido</th>
                                  <th className="p-3">Cliente</th>
                                  <th className="p-3 text-right">Monto</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                                {pedidosPendientes.map((p) => (
                                  <tr
                                    key={p.id}
                                    onClick={() => {
                                      const sel = [...selectedGlobalPedidosIds];
                                      const idx = sel.indexOf(p.id);
                                      idx > -1 ? sel.splice(idx, 1) : sel.push(p.id);
                                      setSelectedGlobalPedidosIds(sel);
                                    }}
                                    className={`cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-900/20 transition-all ${selectedGlobalPedidosIds.includes(p.id) ? 'bg-blue-500/10 hover:bg-blue-500/15' : ''}`}
                                  >
                                    <td className="p-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={selectedGlobalPedidosIds.includes(p.id)}
                                        onChange={() => {
                                          const sel = [...selectedGlobalPedidosIds];
                                          const idx = sel.indexOf(p.id);
                                          idx > -1 ? sel.splice(idx, 1) : sel.push(p.id);
                                          setSelectedGlobalPedidosIds(sel);
                                        }}
                                        className="w-3.5 h-3.5 text-blue-500 focus:ring-blue-500 rounded"
                                      />
                                    </td>
                                    <td className="p-3 font-mono font-bold text-gray-800 dark:text-gray-200">#{p.numero_pedido}</td>
                                    <td className="p-3 text-gray-600 dark:text-gray-400">{p.cliente_nombre || 'N/A'}</td>
                                    <td className="p-3 text-right font-mono font-bold text-emerald-500">{formatCurrency(p.precio_total)}</td>
                                  </tr>
                                ))}
                                {pedidosPendientes.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                                      No hay pedidos pendientes de conciliar
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          ) : (
                            /* VISTA UNIFICADA DE FICHAS Y COMPROBANTES PENDIENTES DE VINCULAR */
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                  <th className="p-3 w-10 text-center">
                                    {unlinkedComprobantes.length > 0 && (
                                      <input
                                        type="checkbox"
                                        checked={allCompsSelected}
                                        onChange={() => {
                                          if (allCompsSelected) {
                                            setSelectedGlobalComprobanteIds([]);
                                          } else {
                                            setSelectedGlobalComprobanteIds(unlinkedComprobantes.map(c => c.id));
                                          }
                                        }}
                                        className="w-4 h-4 text-amber-500 focus:ring-amber-500 rounded cursor-pointer accent-amber-500"
                                        title={allCompsSelected ? "Desmarcar Todos" : "Seleccionar Todos los Tickets"}
                                      />
                                    )}
                                  </th>
                                  <th className="p-3">Fecha</th>
                                  <th className="p-3">Tipo / Ficha</th>
                                  <th className="p-3">Descripción</th>
                                  <th className="p-3 text-right">Monto Ticket</th>
                                  <th className="p-3 text-right">Acción</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                                {unlinkedComprobantes.map((c) => {
                                  const isVentanilla = c.tipo === 'deposito_ventanilla';
                                  const isChecked = (selectedGlobalComprobanteIds || []).includes(c.id);

                                  const targetForThisRow = selectedComps.length > 0 && isChecked
                                    ? selectedComps
                                    : [c];

                                  const targetSum = targetForThisRow.reduce((s, item) => s + getCompReconciliationAmount(item, isPlatformWithCommission, isCajaChicaTarget), 0);
                                  const rowDif = targetSum - selectedSum;
                                  const rowExact = Math.abs(rowDif) < 0.05;

                                  return (
                                    <tr
                                      key={c.id}
                                      onClick={() => {
                                        const current = [...(selectedGlobalComprobanteIds || [])];
                                        const idx = current.indexOf(c.id);
                                        if (idx > -1) current.splice(idx, 1);
                                        else current.push(c.id);
                                        setSelectedGlobalComprobanteIds(current);
                                      }}
                                      className={`cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-955/20 transition-all ${
                                        isChecked ? 'bg-amber-500/15 border-l-4 border-l-amber-500 font-medium' : rowExact ? 'bg-emerald-500/10' : ''
                                      }`}
                                    >
                                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            const current = [...(selectedGlobalComprobanteIds || [])];
                                            const idx = current.indexOf(c.id);
                                            if (idx > -1) current.splice(idx, 1);
                                            else current.push(c.id);
                                            setSelectedGlobalComprobanteIds(current);
                                          }}
                                          className="w-4 h-4 text-amber-500 focus:ring-amber-500 rounded cursor-pointer accent-amber-500"
                                        />
                                      </td>
                                      <td className="p-3 font-mono text-gray-500">{new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</td>
                                      <td className="p-3 font-bold">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${isVentanilla ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                          {isVentanilla ? 'Ventanilla' : 'Tarjeta'}
                                        </span>
                                      </td>
                                      <td className="p-3 text-gray-600 dark:text-gray-300">{c.descripcion || '-'}</td>
                                      <td className="p-3 text-right">
                                        {(() => {
                                          const pendingVal = getCompPendingAmount(c, isPlatformWithCommission, isCajaChicaTarget);
                                          const efecMontoTotal = Number(c.monto_efectivo || 0) + Number(c.propina_efectivo || 0);
                                          const pMontoTotal = Number(c.monto_parrotpay || 0) + Number(c.propina_parrotpay || 0);
                                          if (isCajaChicaTarget && efecMontoTotal > 0) {
                                            return (
                                              <div>
                                                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">{formatCurrency(pendingVal)}</span>
                                                <span className="text-[9px] text-gray-400 font-mono block font-normal">({formatCurrency(efecMontoTotal)} Efec / {formatCurrency(c.monto)} Corte)</span>
                                              </div>
                                            );
                                          }
                                          if (isPlatformWithCommission && pMontoTotal > 0) {
                                            return (
                                              <div>
                                                <span className="font-mono font-bold text-purple-600 dark:text-purple-400 block">{formatCurrency(pendingVal)}</span>
                                                <span className="text-[9px] text-gray-400 font-mono block font-normal">({formatCurrency(pMontoTotal)} Parrot / {formatCurrency(c.monto)} Corte)</span>
                                              </div>
                                            );
                                          }
                                          return <span className="font-mono font-bold text-gray-900 dark:text-white">{formatCurrency(pendingVal)}</span>;
                                        })()}
                                      </td>
                                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                                        {selectedMovs.length > 0 ? (
                                          <button
                                            type="button"
                                            onClick={() => handleVincularComprobantes(targetForThisRow)}
                                            className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all shadow flex items-center gap-1.5 ml-auto ${
                                              rowExact
                                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white animate-pulse'
                                                : isPlatformWithCommission
                                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                                : 'bg-red-500 hover:bg-red-600 text-white opacity-80'
                                            }`}
                                          >
                                            {rowExact
                                              ? `✓ Vincular (${targetForThisRow.length} ticket${targetForThisRow.length > 1 ? 's' : ''})`
                                              : isPlatformWithCommission
                                              ? `⚡ Vincular (${targetForThisRow.length} ticket${targetForThisRow.length > 1 ? 's' : ''} + Comisión ${formatCurrency(rowDif)})`
                                              : `🚫 No Cuadra (${formatCurrency(rowDif)})`}
                                          </button>
                                        ) : (
                                          <span className="text-[10px] text-gray-400 italic">
                                            👈 Marca depósitos a la izquierda
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {unlinkedComprobantes.length === 0 && (
                                  <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-400 italic">
                                      No hay fichas o comprobantes de depósito pendientes en este período
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {ingresosSubSeccion === 'factura_publico' && (
              <div className="flex-1 flex flex-col overflow-y-auto min-h-0 gap-6 font-sans">
                {(() => {
                  const ticketsMes = comprobantes.filter(c => {
                    if (c.tipo === 'deposito_ventanilla') return false;
                    if (c.descripcion && c.descripcion.includes('COMPROBANTE_EFECTIVO_')) return false;
                    const mes = c.fecha ? c.fecha.substring(0, 7) : '';
                    return !selectedMonth || mes === selectedMonth;
                  });

                  let totalVentasBrutasBase = 0;
                  let totalPropinasExcluidas = 0;
                  let totalTercerosBase = 0;

                  let totalEfectivoBase = 0;
                  let totalBbvaBase = 0;
                  let totalParrotBase = 0;

                  let totalTercerosEfectivo = 0;
                  let totalTercerosBbva = 0;
                  let totalTercerosParrot = 0;

                  ticketsMes.forEach(c => {
                    const isParrotTicket = (c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('PARROT')) || c.tipo === 'corte_parrot';

                    const efec = Number(c.monto_efectivo || 0);
                    const parrot = Number(c.monto_parrotpay || 0);
                    const bbva = isParrotTicket ? 0 : (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0));
                    const baseTotal = efec + bbva + parrot;

                    const propinaTotal = Number(c.propina_efectivo || 0) + Number(c.propina_parrotpay || 0) +
                                         (isParrotTicket ? 0 : (Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0)));

                    totalVentasBrutasBase += baseTotal;
                    totalPropinasExcluidas += propinaTotal;

                    totalEfectivoBase += efec;
                    totalBbvaBase += bbva;
                    totalParrotBase += parrot;

                    if (facturadosTerceros[c.id]) {
                      totalTercerosBase += baseTotal;
                      totalTercerosEfectivo += efec;
                      totalTercerosBbva += bbva;
                      totalTercerosParrot += parrot;
                    }
                  });

                  const currentMonthKey = selectedMonth || 'GLOBAL';
                  const manualTercerosVal = Number(montoManualTercerosMap[currentMonthKey] || 0);

                  const totalTercerosFinal = totalTercerosBase + manualTercerosVal;
                  const totalFacturaPublicoGeneral = Math.max(0, totalVentasBrutasBase - totalTercerosFinal);
                  const efectivoPublicoGeneral = Math.max(0, totalEfectivoBase - totalTercerosEfectivo);
                  const bbvaPublicoGeneral = Math.max(0, totalBbvaBase - totalTercerosBbva);
                  const parrotPublicoGeneral = Math.max(0, totalParrotBase - totalTercerosParrot);

                  const exportFacturaPublicoExcel = async () => {
                    try {
                      const XLSX = await import('xlsx');
                      const wb = XLSX.utils.book_new();

                      const summaryRows = [
                        { 'Concepto': 'Ventas Efectivo (Sin Propina)', 'Venta Bruta Base': totalEfectivoBase, 'Facturado a Terceros': totalTercerosEfectivo, 'Factura Público en General': efectivoPublicoGeneral },
                        { 'Concepto': 'Ventas Tarjetas BBVA/POS (Sin Propina)', 'Venta Bruta Base': totalBbvaBase, 'Facturado a Terceros': totalTercerosBbva, 'Factura Público en General': bbvaPublicoGeneral },
                        { 'Concepto': 'Ventas ParrotPay (Sin Propina)', 'Venta Bruta Base': totalParrotBase, 'Facturado a Terceros': totalTercerosParrot, 'Factura Público en General': parrotPublicoGeneral },
                        { 'Concepto': 'Monto Manual Facturado a Terceros', 'Venta Bruta Base': 0, 'Facturado a Terceros': manualTercerosVal, 'Factura Público en General': -manualTercerosVal },
                        { 'Concepto': '--- TOTAL A FACTURAR ---', 'Venta Bruta Base': totalVentasBrutasBase, 'Facturado a Terceros': totalTercerosFinal, 'Factura Público en General': totalFacturaPublicoGeneral },
                        { 'Concepto': 'PROPINAS TOTALES (NO CONTABILIZADAS)', 'Venta Bruta Base': 0, 'Facturado a Terceros': 0, 'Factura Público en General': totalPropinasExcluidas }
                      ];

                      const detailRows = ticketsMes.map(c => {
                        const isParrotTicket = (c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('PARROT')) || c.tipo === 'corte_parrot';

                        const efec = Number(c.monto_efectivo || 0);
                        const parrot = Number(c.monto_parrotpay || 0);
                        const bbva = isParrotTicket ? 0 : (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0));
                        const baseTotal = efec + bbva + parrot;
                        const propinaTotal = Number(c.propina_efectivo || 0) + Number(c.propina_parrotpay || 0) +
                                             (isParrotTicket ? 0 : (Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0)));
                        const isTercero = !!facturadosTerceros[c.id];

                        return {
                          'Fecha': c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
                          'Descripción / Folio': c.descripcion || `Corte POS ${c.fecha}`,
                          'Importe sin Propina (Base)': baseTotal,
                          'Venta Efectivo (Base)': efec,
                          'Venta Tarjetas BBVA (Base)': bbva,
                          'Venta ParrotPay (Base)': parrot,
                          'Propinas Excluidas ($)': propinaTotal,
                          'Facturado a Terceros (Individual)': isTercero ? 'SÍ (Facturado)' : 'NO (Público General)',
                          'Monto a Público en General': isTercero ? 0 : baseTotal
                        };
                      });

                      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
                      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Factura Global');

                      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
                      XLSX.utils.book_append_sheet(wb, wsDetail, 'Detalle Tickets');

                      const monthStr = selectedMonth ? `_${selectedMonth}` : '';
                      XLSX.writeFile(wb, `Factura_Publico_En_General${monthStr}.xlsx`);
                    } catch (err: any) {
                      alert(`Error al exportar: ${err.message}`);
                    }
                  };

                  return (
                    <div className="space-y-6">
                      {/* TARJETAS RESUMEN DE FACTURACIÓN AL PÚBLICO EN GENERAL */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* KPI TOTAL A FACTURAR */}
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">Factura Público en General</span>
                            <h3 className="text-2xl font-black font-mono mt-1">{formatCurrency(totalFacturaPublicoGeneral)}</h3>
                            <p className="text-[10px] text-emerald-100 mt-1">Suma de ventas netas sin propinas ni facturas a terceros</p>
                          </div>
                          <button
                            type="button"
                            onClick={exportFacturaPublicoExcel}
                            className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow"
                          >
                            <FileSpreadsheet size={14} /> Exportar Excel Público General
                          </button>
                        </div>

                        {/* DESGLOSE POR MÉTODO DE PAGO */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between space-y-2">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">💳 Desglose por Método (Público General)</span>
                          <div className="space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-1">
                              <span className="text-gray-600 dark:text-gray-400 font-sans">💵 Efectivo:</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(efectivoPublicoGeneral)}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-1">
                              <span className="text-gray-600 dark:text-gray-400 font-sans">💳 Tarjetas BBVA:</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(bbvaPublicoGeneral)}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-1">
                              <span className="text-gray-600 dark:text-gray-400 font-sans">🦜 ParrotPay:</span>
                              <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(parrotPublicoGeneral)}</span>
                            </div>
                          </div>
                        </div>

                        {/* FACTURADO A TERCEROS */}
                        <div className="p-5 rounded-2xl bg-white dark:bg-gray-955 border border-purple-200 dark:border-purple-900/40 shadow-sm flex flex-col justify-between space-y-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">👤 Facturado a Terceros</span>
                            <h3 className="text-xl font-extrabold font-mono text-purple-700 dark:text-purple-300 mt-0.5">{formatCurrency(totalTercerosFinal)}</h3>
                            {totalTercerosBase > 0 && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                Tickets marcados: {formatCurrency(totalTercerosBase)}
                              </p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-purple-100 dark:border-purple-900/30 space-y-1">
                            <label className="text-[10px] font-extrabold uppercase text-purple-700 dark:text-purple-300 flex items-center justify-between">
                              <span>✏️ Importe Manual ($):</span>
                              {manualTercerosVal > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setMontoManualTercero(currentMonthKey, 0)}
                                  className="text-[9px] text-red-500 hover:underline font-bold"
                                >
                                  Limpiar
                                </button>
                              )}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={manualTercerosVal || ''}
                              onChange={(e) => setMontoManualTercero(currentMonthKey, Number(e.target.value))}
                              placeholder="Escribe monto a descontar..."
                              className="w-full bg-purple-50/80 dark:bg-purple-955/50 border border-purple-300 dark:border-purple-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-purple-900 dark:text-purple-100 outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            />
                          </div>
                        </div>

                        {/* PROPINAS EXCLUIDAS */}
                        <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">🚫 Propinas (No Contabilizadas)</span>
                            <h3 className="text-xl font-extrabold font-mono text-gray-600 dark:text-gray-400 mt-1">{formatCurrency(totalPropinasExcluidas)}</h3>
                            <p className="text-[10px] text-gray-400 mt-1">Las propinas están totalmente excluidas de la facturación</p>
                          </div>
                          <span className="text-[9px] font-extrabold text-gray-400 uppercase bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded w-fit">
                            0% Impuesto / Sin Facturar
                          </span>
                        </div>
                      </div>

                      {/* TABLA INTERACTIVA DE TICKETS */}
                      <div className="bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-2">
                          <div>
                            <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200 flex items-center gap-2">
                              <List size={16} className="text-emerald-500" /> Control de Facturación por Ticket ({ticketsMes.length})
                            </h4>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Marca la casilla "Factura de Terceros" en los tickets que ya fueron facturados individualmente a clientes para restarlos automáticamente del público en general.
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                <th className="p-3">Fecha</th>
                                <th className="p-3">Descripción / Folio</th>
                                <th className="p-3 text-right">Venta Base (Sin Propina)</th>
                                <th className="p-3 text-right">Efectivo</th>
                                <th className="p-3 text-right">Tarjetas BBVA</th>
                                <th className="p-3 text-right">ParrotPay</th>
                                <th className="p-3 text-right text-gray-400">Propinas (Excluidas)</th>
                                <th className="p-3 text-center">Factura de Terceros (Individual)</th>
                                <th className="p-3 text-center">Destino</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                              {ticketsMes.map(c => {
                                const isParrotTicket = (c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('PARROT')) || c.tipo === 'corte_parrot';

                                const efec = Number(c.monto_efectivo || 0);
                                const parrot = Number(c.monto_parrotpay || 0);
                                const bbva = isParrotTicket ? 0 : (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0));
                                const baseTotal = efec + bbva + parrot;

                                const propinaTotal = Number(c.propina_efectivo || 0) + Number(c.propina_parrotpay || 0) +
                                                     (isParrotTicket ? 0 : (Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0)));
                                const isTercero = !!facturadosTerceros[c.id];

                                return (
                                  <tr key={c.id} className={`hover:bg-gray-50/80 dark:hover:bg-gray-900/50 transition-colors ${isTercero ? 'bg-purple-50/30 dark:bg-purple-955/10' : ''}`}>
                                    <td className="p-3 font-mono font-medium text-gray-600 dark:text-gray-400">
                                      {c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                                    </td>
                                    <td className="p-3 font-bold text-gray-800 dark:text-gray-200">
                                      {c.descripcion || `Corte POS ${c.fecha}`}
                                    </td>
                                    <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                                      {formatCurrency(baseTotal)}
                                    </td>
                                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                      {formatCurrency(efec)}
                                    </td>
                                    <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                                      {formatCurrency(bbva)}
                                    </td>
                                    <td className="p-3 text-right font-mono text-purple-600 dark:text-purple-400">
                                      {formatCurrency(parrot)}
                                    </td>
                                    <td className="p-3 text-right font-mono text-gray-400 line-through">
                                      {formatCurrency(propinaTotal)}
                                    </td>
                                    <td className="p-3 text-center">
                                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={isTercero}
                                          onChange={() => toggleFacturadoTercero(c.id)}
                                          className="w-4 h-4 text-purple-600 focus:ring-purple-500 rounded cursor-pointer"
                                        />
                                        <span className={`text-[10px] font-extrabold ${isTercero ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
                                          Facturado a Tercero
                                        </span>
                                      </label>
                                    </td>
                                    <td className="p-3 text-center">
                                      {isTercero ? (
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-955/50 dark:text-purple-300">
                                          👤 Factura Tercero
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-955/50 dark:text-emerald-300">
                                          🧾 Público General
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                              {ticketsMes.length === 0 && (
                                <tr>
                                  <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                                    No hay tickets o cortes registrados en este período.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── SUB-TAB 4: CARGAS DE ESTADO DE CUENTA ───────────────────────── */}
        {bancoSubTab === 'cargas' && (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto min-h-0">
            <CargasTab
              token={token || ''}
              cuentasBancarias={cuentasBancarias || []}
              onStartSustituirCarga={onStartSustituirCarga || (() => {})}
              onReloadMovimientos={onReloadMovimientos || (() => {})}
              onOpenUploadModal={onOpenUploadModal || (() => {})}
            />
          </div>
        )}

        {/* ── SUB-TAB 5: MOVIMIENTOS NO DEDUCIBLES (ATEMPORAL) ─────────────── */}
        {bancoSubTab === 'no_deducibles' && (
          <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden min-h-0">
            {/* TARJETAS KPI RESUMEN */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
              <div className="bg-white dark:bg-gray-950 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Egresos No Deducibles</span>
                  <span className="text-xl font-extrabold text-gray-900 dark:text-white font-mono mt-0.5 block">{totalRegistrosAtemporal}</span>
                </div>
                <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl">
                  <AlertTriangle size={20} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-950 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Monto Egreso No Deducible</span>
                  <span className="text-xl font-extrabold text-red-600 dark:text-red-400 font-mono mt-0.5 block">{formatCurrency(montoTotalAtemporal)}</span>
                </div>
                <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl">
                  <Scale size={20} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-950 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">En Periodos Cerrados</span>
                  <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono mt-0.5 block">{countCerradosAtemporal}</span>
                </div>
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
                  <Lock size={20} />
                </div>
              </div>

              <div className="bg-white dark:bg-gray-950 p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Conciliados Post-Cierre</span>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">{countPostCierreAtemporal}</span>
                </div>
                <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <Tag size={20} />
                </div>
              </div>
            </div>

            {/* TABLA Y FILTROS ATEMPORALES */}
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              {/* BARRA DE FILTROS PRINCIPAL */}
              <div className="p-3.5 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-3.5 shrink-0">
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Buscar concepto, ref, rfc..."
                      value={busquedaAtemporal}
                      onChange={(e) => { setBusquedaAtemporal(e.target.value); setPageAtemporal(0); }}
                      className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                    />
                  </div>

                  <select
                    value={selectedCuentaId}
                    onChange={(e) => { setSelectedCuentaId(e.target.value); setPageAtemporal(0); }}
                    className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-all text-gray-900 dark:text-gray-100 font-sans cursor-pointer font-semibold"
                  >
                    <option value="">-- Seleccionar Cuenta --</option>
                    {cuentasBancarias?.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                    ))}
                  </select>

                  <select
                    value={filtroMesAtemporal}
                    onChange={(e) => { setFiltroMesAtemporal(e.target.value); setPageAtemporal(0); }}
                    className="bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-amber-500 transition-all cursor-pointer font-sans"
                  >
                    <option value="">🗓️ Todos los Meses (Atemporal)</option>
                    {opcionesMesesAtemporal.map((m) => (
                      <option key={m} value={m}>
                        {new Date(m + '-02').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', timeZone: 'UTC' })}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={exportAtemporalToExcel}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                    title="Exportar Reporte Excel de Movimientos No Deducibles"
                  >
                    <FileSpreadsheet size={14} />
                    Exportar Reporte Excel
                  </button>

                  <button
                    onClick={() => setShowFiltrosAtemporal(!showFiltrosAtemporal)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border cursor-pointer ${
                      showFiltrosAtemporal || tiposAtemporalSelected.length > 0 || estatusAtemporalSelected.length > 0 || ciclosAtemporalSelected.length > 0 || categoriasAtemporalSelected.length > 0
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Filter size={14} />
                    <span>{showFiltrosAtemporal ? 'Ocultar Filtros' : 'Mostrar Filtros'}</span>
                    {(tiposAtemporalSelected.length > 0 || estatusAtemporalSelected.length > 0 || ciclosAtemporalSelected.length > 0 || categoriasAtemporalSelected.length > 0) && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setTiposAtemporalSelected([]);
                      setEstatusAtemporalSelected([]);
                      setCiclosAtemporalSelected([]);
                      setCategoriasAtemporalSelected([]);
                      setBusquedaAtemporal('');
                      setFiltroMesAtemporal('');
                      setFiltroCicloAtemporal('todos');
                      setFiltroEstatusNoDeducible('todos');
                      setPageAtemporal(0);
                    }}
                    className="px-3.5 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-700 transition-all shrink-0 cursor-pointer"
                  >
                    Restablecer Filtros
                  </button>
                </div>

                {/* GRID DE CHECKLISTS DE FILTRO (COLAPSABLE) */}
                {showFiltrosAtemporal && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans animate-in fade-in duration-200">
                    {/* TIPO DE MOVIMIENTO */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Tipo de Movimiento</span>
                      <div className="space-y-1.5 flex-1">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={tiposAtemporalSelected.includes('Deposito')}
                            onChange={(e) => {
                              const newTipos = e.target.checked ? [...tiposAtemporalSelected, 'Deposito'] : tiposAtemporalSelected.filter(t => t !== 'Deposito');
                              setTiposAtemporalSelected(newTipos);
                              setPageAtemporal(0);
                            }}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                          />
                          <span>Depósitos (+)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={tiposAtemporalSelected.includes('Retiro')}
                            onChange={(e) => {
                              const newTipos = e.target.checked ? [...tiposAtemporalSelected, 'Retiro'] : tiposAtemporalSelected.filter(t => t !== 'Retiro');
                              setTiposAtemporalSelected(newTipos);
                              setPageAtemporal(0);
                            }}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                          />
                          <span>Retiros (-)</span>
                        </label>
                      </div>
                    </div>

                    {/* ESTATUS CONCILIACIÓN */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Estatus Conciliación</span>
                      <div className="space-y-1.5 flex-1 max-h-32 overflow-y-auto pr-1">
                        {[
                          { clave: 'no_deducible', nombre: 'Movimiento no Deducible' },
                          { clave: 'pendiente', nombre: 'Pendiente de Conciliar' },
                          { clave: 'incompleto', nombre: 'Incompleto' },
                          { clave: 'conciliado_post_cierre', nombre: '🏷️ Conciliado Post-Cierre' },
                          { clave: 'comprobado', nombre: 'Comprobado' }
                        ].map((e) => (
                          <label key={e.clave} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                            <input
                              type="checkbox"
                              checked={estatusAtemporalSelected.includes(e.clave)}
                              onChange={(chk) => {
                                const newEstatus = chk.target.checked ? [...estatusAtemporalSelected, e.clave] : estatusAtemporalSelected.filter(es => es !== e.clave);
                                setEstatusAtemporalSelected(newEstatus);
                                setPageAtemporal(0);
                              }}
                              className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                            />
                            <span>{e.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* CICLO CONTABLE */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Ciclo Contable</span>
                      <div className="space-y-1.5 flex-1">
                        {[
                          { clave: 'cerrado_definitivo', nombre: '🔴 Cerrado Definitivo' },
                          { clave: 'pre_cerrado', nombre: '🟡 Pre-cerrado' },
                          { clave: 'abierto', nombre: '🟢 Periodo Abierto' }
                        ].map((c) => (
                          <label key={c.clave} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                            <input
                              type="checkbox"
                              checked={ciclosAtemporalSelected.includes(c.clave)}
                              onChange={(chk) => {
                                const newCiclos = chk.target.checked ? [...ciclosAtemporalSelected, c.clave] : ciclosAtemporalSelected.filter(ci => ci !== c.clave);
                                setCiclosAtemporalSelected(newCiclos);
                                setPageAtemporal(0);
                              }}
                              className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                            />
                            <span>{c.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* CATEGORÍA DE MOVIMIENTO */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Categoría de Movimiento</span>
                      <div className="space-y-1.5 flex-1 max-h-32 overflow-y-auto pr-1">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={categoriasAtemporalSelected.includes('sin_categoria')}
                            onChange={(chk) => {
                              const newCats = chk.target.checked ? [...categoriasAtemporalSelected, 'sin_categoria'] : categoriasAtemporalSelected.filter(c => c !== 'sin_categoria');
                              setCategoriasAtemporalSelected(newCats);
                              setPageAtemporal(0);
                            }}
                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                          />
                          <span className="italic text-gray-400">Sin Categoría</span>
                        </label>
                        {categoriasMovimiento.map((cat) => (
                          <label key={cat.id} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                            <input
                              type="checkbox"
                              checked={categoriasAtemporalSelected.includes(cat.id)}
                              onChange={(chk) => {
                                const newCats = chk.target.checked ? [...categoriasAtemporalSelected, cat.id] : categoriasAtemporalSelected.filter(c => c !== cat.id);
                                setCategoriasAtemporalSelected(newCats);
                                setPageAtemporal(0);
                              }}
                              className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                            />
                            <span>{cat.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TABLA ATEMPORAL */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-900/50 text-[10px] uppercase font-bold text-gray-500 tracking-wider sticky top-0 backdrop-blur-md">
                      <th className="p-3">Fecha / Mes</th>
                      <th className="p-3">Estado de Periodo</th>
                      <th className="p-3">Concepto & Cuenta</th>
                      <th className="p-3 text-right">Monto</th>
                      <th className="p-3">Estatus Conciliación</th>
                      <th className="p-3">Soporte Adjunto</th>
                      <th className="p-3">Notas de Auditoría</th>
                      <th className="p-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                    {paginadosAtemporal.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-gray-400">
                          No se encontraron movimientos no deducibles con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      paginadosAtemporal.map((m: any) => {
                        const pInfo = getPeriodStatusForMov(m.fecha);
                        const hasPostCloseNote = m.comentarios?.includes('Conciliado después del periodo de cierre');
                        const isOutflow = m.tipo_movimiento === 'Retiro' || Number(m.retiro || 0) > 0;
                        const amt = Math.abs(Number(m.monto || m.retiro || m.deposito || 0));

                        return (
                          <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                            <td className="p-3 font-mono">
                              <div className="font-bold text-gray-900 dark:text-gray-100">
                                {m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '—'}
                              </div>
                              <div className="text-[10px] text-gray-400 font-sans font-semibold">
                                {m.fecha ? m.fecha.substring(0, 7) : ''}
                              </div>
                            </td>

                            <td className="p-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${pInfo.bgClass}`}>
                                {pInfo.clave === 'cerrado_definitivo' ? <Lock size={10} /> : pInfo.clave === 'pre_cerrado' ? <Lock size={10} /> : <Unlock size={10} />}
                                {pInfo.label}
                              </span>
                            </td>

                            <td className="p-3 max-w-[260px]">
                              <div className="font-bold text-gray-800 dark:text-gray-200 truncate" title={m.concepto}>
                                {m.concepto}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 mt-0.5">
                                <Landmark size={11} className="text-amber-500" />
                                <span>{m.cuentas_bancarias?.nombre || 'BBVA'}</span>
                                {m.referencia && <span>| Ref: {m.referencia}</span>}
                              </div>
                            </td>

                            <td className="p-3 text-right font-mono font-bold">
                              <span className={isOutflow ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                                {isOutflow ? '-' : '+'}{formatCurrency(amt)}
                              </span>
                            </td>

                            <td className="p-3">
                              <span
                                className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-white uppercase tracking-wider shadow-sm"
                                style={{ backgroundColor: m.estatus_conciliacion_bancaria?.color || (hasPostCloseNote ? '#10B981' : '#EF4444') }}
                              >
                                {m.estatus_conciliacion_bancaria?.nombre || (hasPostCloseNote ? 'Conciliado Post-Cierre' : 'No Deducible')}
                              </span>
                            </td>

                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {m.xml_url && (
                                  <button onClick={() => handleViewCfdi?.(m.xml_url.split(',')[0])} className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded text-[10px] font-bold hover:bg-blue-500/20">
                                    XML
                                  </button>
                                )}
                                {m.pdf_factura_url && (
                                  <button onClick={() => onDownloadFile?.(m.pdf_factura_url)} className="px-2 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 rounded text-[10px] font-bold hover:bg-red-500/20">
                                    PDF
                                  </button>
                                )}
                                {m.pdf_ticket_url && (
                                  <button onClick={() => onDownloadFile?.(m.pdf_ticket_url)} className="px-2 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30 rounded text-[10px] font-bold hover:bg-violet-500/20">
                                    Ticket
                                  </button>
                                )}
                                {m.soporte_reembolso_url && (
                                  <button onClick={() => onDownloadFile?.(m.soporte_reembolso_url)} className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold hover:bg-emerald-500/20">
                                    Reembolso
                                  </button>
                                )}
                                {!m.xml_url && !m.pdf_factura_url && !m.pdf_ticket_url && !m.soporte_reembolso_url && (
                                  <span className="text-[10px] text-gray-400 italic">Sin soporte</span>
                                )}
                              </div>
                            </td>

                            <td className="p-3 max-w-[200px]">
                              {hasPostCloseNote ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold shadow-xs">
                                  <Tag size={11} className="text-amber-500" />
                                  Conciliado después de cierre
                                </span>
                              ) : (
                                <span className="text-[11px] text-gray-500 truncate block" title={m.comentarios}>
                                  {m.comentarios || 'Sin notas.'}
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-center">
                              {handleOpenReconcileModal && (
                                <button
                                  onClick={() => handleOpenReconcileModal(m)}
                                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] shadow-sm transition-all flex items-center gap-1 mx-auto"
                                >
                                  <Scale size={12} /> Comprobar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINACIÓN ATEMPORAL */}
              <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 flex items-center justify-between shrink-0">
                <span className="text-xs text-gray-500 font-mono">
                  Página {pageAtemporal + 1} de {totalPaginasAtemporal}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={pageAtemporal === 0}
                    onClick={() => setPageAtemporal((p) => Math.max(0, p - 1))}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={pageAtemporal >= totalPaginasAtemporal - 1}
                    onClick={() => setPageAtemporal((p) => p + 1)}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-bold disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        

        

      </div>

      {reconcileModal.open && reconcileModal.movimiento && (() => {
        const batchMovs = reconcileModal.movimientosBatch && reconcileModal.movimientosBatch.length > 0
          ? reconcileModal.movimientosBatch
          : [reconcileModal.movimiento];
        const isBatch = batchMovs.length > 1;

        const isOutflow = reconcileModal.movimiento.tipo_movimiento === 'Retiro';
        const movMonto = batchMovs.reduce((s, m) => s + Math.abs(Number(m.monto) || (m.tipo_movimiento === 'Retiro' ? Number(m.retiro) : Number(m.deposito)) || 0), 0);
        const selectedGastosList = gastosReconciliables.filter((g) => reconcileModal.gastosSeleccionados.includes(g.id));
        const totalEgresosSistema = isOutflow 
          ? selectedGastosList.reduce((s, g) => {
              const otherConcs = movimientos
                .filter((otherM: any) => otherM.id !== reconcileModal.movimiento.id)
                .flatMap((otherM: any) => otherM.conciliaciones_bancarias || [])
                .filter((c: any) => (c.gasto?.id === g.id || c.gasto_id === g.id));

              const priorOtherPayments = otherConcs.reduce((sum: number, c: any) => {
                return sum + Math.abs(Number(c.monto_asociado || c.monto || 0));
              }, 0);

              const totalGasto = Number(g.monto || 0);
              const pendBalance = Math.max(0, totalGasto - priorOtherPayments);
              const effectiveAmount = priorOtherPayments > 0 ? Math.min(movMonto, pendBalance) : totalGasto;
              return s + effectiveAmount;
            }, 0)
          : pedidosPendientes
              .filter((p) => reconcileModal.pedidosSeleccionados.includes(p.id))
              .reduce((s, p) => s + Number(p.precio_total), 0);

        const totalXmlsCargados = Object.entries(uploadedXmlAmounts).reduce((s, [path, val]) => {
          const fileName = path.split('/').pop() || '';
          const isAlreadyInSelectedGastos = selectedGastosList.some((g) => {
            if (!g.xml_url) return false;
            const gPaths = g.xml_url.split(',');
            return gPaths.some((gp: string) => gp === path || gp.endsWith(fileName) || path.endsWith(gp.split('/').pop() || ''));
          });
          return isAlreadyInSelectedGastos ? s : s + val;
        }, 0);

        const totalComprobado = totalEgresosSistema + totalXmlsCargados;
        const dif = movMonto - totalComprobado;
        const match = Math.abs(dif) < 0.05;

        const selectedProvRaw = selectedGastosList[0]?.proveedores;
        const selectedProv = selectedProvRaw ? (Array.isArray(selectedProvRaw) ? selectedProvRaw[0] : selectedProvRaw) : null;
        const saldoFavorProveedor = Number(selectedProv?.saldo_favor || 0);
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setReconcileModal((p) => ({ ...p, open: false })); }}>
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[95vh] overflow-y-auto p-6 space-y-4 font-sans">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                    {isBatch ? `Conciliación de Lote (${batchMovs.length} Pagos Seleccionados)` : `Conciliación de Movimiento - ${reconcileModal.movimiento.fecha ? new Date(reconcileModal.movimiento.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : 'Sin Fecha'}`}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isBatch ? (
                      <>Suma acumulada de pagos: <strong className="text-emerald-600 font-mono text-sm">{formatCurrency(movMonto)}</strong></>
                    ) : (
                      <>Movimiento: <strong>{reconcileModal.movimiento.concepto}</strong> — {formatCurrency(reconcileModal.movimiento.monto)} {reconcileModal.movimiento.fecha && `— ${new Date(reconcileModal.movimiento.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}`}</>
                    )}
                  </p>
                </div>
                <button onClick={() => setReconcileModal((p) => ({ ...p, open: false }))}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {isBatch && (
                <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-1 text-xs">
                  <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                    <span>📋 Desglose de Pagos del Estado de Cuenta a Sumar:</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {batchMovs.map((m: any, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-lg text-[10px] font-mono shadow-sm flex items-center gap-1">
                        <span className="text-gray-500 font-sans">{m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 font-sans">{m.concepto}</span>
                        <span className="font-bold text-red-500 dark:text-red-400">({formatCurrency(Math.abs(Number(m.monto) || Number(m.retiro) || Number(m.deposito) || 0))})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProv && (
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex items-center justify-between text-xs font-sans">
                  <div>
                    <span className="font-extrabold text-emerald-900 dark:text-emerald-300 block">
                      🏢 Proveedor Seleccionado: {selectedProv.nombre_comercial} {selectedProv.rfc && <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">({selectedProv.rfc})</span>}
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                      Saldo a Favor acumulado actual: <strong className="font-mono text-sm font-bold text-emerald-800 dark:text-emerald-200">{formatCurrency(saldoFavorProveedor)}</strong>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-extrabold shadow-sm">
                      Saldo a Favor: {formatCurrency(saldoFavorProveedor)}
                    </span>
                  </div>
                </div>
              )}

              {(() => {
                const modalPeriodInfo = getPeriodStatusForMov(reconcileModal.movimiento.fecha);
                const isModalClosed = modalPeriodInfo.clave === 'cerrado_definitivo' || modalPeriodInfo.clave === 'pre_cerrado';
                if (!isModalClosed) return null;
                return (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs flex items-center gap-2.5 text-amber-800 dark:text-amber-300 font-sans">
                    <Lock size={18} className="shrink-0 text-amber-500 animate-pulse" />
                    <div>
                      <span className="font-bold block text-amber-900 dark:text-amber-200">
                        Periodo Contable Cerrado ({reconcileModal.movimiento.fecha ? reconcileModal.movimiento.fecha.substring(0, 7) : ''})
                      </span>
                      <span className="text-[11px] leading-relaxed block">
                        Este movimiento pertenece a un periodo cerrado. La comprobación se guardará correctamente y agregará automáticamente la nota de auditoría: <strong>"Conciliado después del periodo de cierre"</strong>.
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Búsqueda */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">
                  {isOutflow ? 'Buscar egreso' : 'Buscar factura de ingreso / pedido'}
                </label>
                <input type="text" value={manualMatchSearch} 
                  placeholder={isOutflow ? "Concepto, monto, RFC, número..." : "Número pedido, folio factura, cliente, monto..."}
                  onChange={(e) => setManualMatchSearch(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none transition-all" />
              </div>

              {/* Lista de egresos o facturas/pedidos de ingresos reconciliables */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-500">
                    {isOutflow ? 'Egresos del Sistema (Facturas / Gastos)' : 'Facturas de Ingresos / Ventas del Sistema'}
                  </label>
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    Acumulado: {formatCurrency(totalEgresosSistema)} ({isOutflow ? reconcileModal.gastosSeleccionados.length : reconcileModal.pedidosSeleccionados.length} facturas)
                  </span>
                </div>
                <div className="space-y-1 max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl">
                  {isOutflow ? (
                    gastosReconciliables
                      .filter((g) => {
                        // Excluir egresos en efectivo a menos que ya estén seleccionados
                        const metodo = String(g.metodo_pago || '').toLowerCase();
                        if ((metodo.includes('efectivo') || metodo.includes('01')) && !reconcileModal.gastosSeleccionados.includes(g.id)) {
                          return false;
                        }

                        if (!manualMatchSearch.trim()) return true;
                        const s = manualMatchSearch.toLowerCase();
                        const provArr = g.proveedores;
                        const proveedor = Array.isArray(provArr) ? provArr[0] : provArr;
                        return (
                          g.concepto?.toLowerCase().includes(s) || 
                          String(g.monto).includes(s) ||
                          proveedor?.nombre_comercial?.toLowerCase().includes(s) ||
                          proveedor?.rfc?.toLowerCase().includes(s)
                        );
                      })
                      .map((g) => {
                        const provArr = g.proveedores;
                        const proveedor = Array.isArray(provArr) ? provArr[0] : provArr;
                        return (
                          <div key={g.id} className="flex items-center justify-between gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-900/30 border-b border-gray-100 dark:border-gray-900 last:border-0 font-sans">
                            <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                              <input type="checkbox" checked={reconcileModal.gastosSeleccionados.includes(g.id)}
                                onChange={() => {
                                  setReconcileModal((p) => {
                                    const sel = [...p.gastosSeleccionados];
                                    const idx = sel.indexOf(g.id);
                                    idx > -1 ? sel.splice(idx, 1) : sel.push(g.id);
                                    
                                    const nextStatus = autoEstatus(sel, p.pedidosSeleccionados);
                                    
                                    return { 
                                      ...p, 
                                      gastosSeleccionados: sel,
                                      estatusClave: nextStatus
                                    };
                                  });
                                }}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{g.concepto}</div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 items-center font-medium">
                                  <span className="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(g.monto)}</span>
                                  <span>•</span>
                                  <span>{g.fecha_gasto ? new Date(g.fecha_gasto).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : 'Sin fecha'}</span>
                                  {proveedor?.nombre_comercial && (
                                    <>
                                      <span>•</span>
                                      <span className="text-blue-600 dark:text-blue-400 font-semibold">{proveedor.nombre_comercial}</span>
                                    </>
                                  )}
                                  {g.metodo_pago && (
                                    <>
                                      <span>•</span>
                                      <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                        {getMetodoPagoLabel(g.metodo_pago)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </label>
                            
                            <button
                              type="button"
                              onClick={() => {
                                if (handleSaveReconciliation) {
                                  const nextStatus = autoEstatus([g.id], []);
                                  handleSaveReconciliation([g.id], nextStatus, []);
                                }
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold shadow transition-all shrink-0"
                            >
                              Conciliar
                            </button>
                          </div>
                        );
                      })
                  ) : (
                    pedidosPendientes
                      .filter((p) => {
                        if (!manualMatchSearch.trim()) return true;
                        const s = manualMatchSearch.toLowerCase().trim();
                        const numPed = String(p.numero_pedido ?? '').toLowerCase();
                        const folio = String(p.folio_factura ?? '').toLowerCase();
                        const cliente = String(p.cliente_nombre ?? '').toLowerCase();
                        const precioVal = Number(p.precio_total || 0);
                        const precioStr = String(p.precio_total ?? '');
                        const precioFixed = precioVal.toFixed(2);
                        const precioInt = Math.round(precioVal).toString();

                        return (
                          numPed.includes(s) || 
                          folio.includes(s) ||
                          cliente.includes(s) ||
                          precioStr.includes(s) ||
                          precioFixed.includes(s) ||
                          precioInt.includes(s)
                        );
                      })
                      .map((p) => {
                        const hasFactura = !!p.folio_factura;
                        const titleText = hasFactura
                          ? `Factura: ${p.folio_factura} ${p.numero_pedido ? `(Pedido #${p.numero_pedido})` : ''}`
                          : `Pedido #${p.numero_pedido}`;

                        return (
                          <div key={p.id} className="flex items-center justify-between gap-3 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-900/30 border-b border-gray-100 dark:border-gray-900 last:border-0 font-sans">
                            <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                              <input type="checkbox" checked={reconcileModal.pedidosSeleccionados.includes(p.id)}
                                onChange={() => {
                                  setReconcileModal((prev) => {
                                    const sel = [...prev.pedidosSeleccionados];
                                    const idx = sel.indexOf(p.id);
                                    idx > -1 ? sel.splice(idx, 1) : sel.push(p.id);
                                    
                                    const nextStatus = autoEstatus(prev.gastosSeleccionados, sel);
                                    
                                    return { 
                                      ...prev, 
                                      pedidosSeleccionados: sel,
                                      estatusClave: nextStatus
                                    };
                                  });
                                }}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate flex items-center gap-1.5">
                                  <span>{titleText}</span>
                                  {hasFactura && (
                                    <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                      Facturado
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 items-center font-medium">
                                  <span className="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(p.precio_total)}</span>
                                  <span>•</span>
                                  <span>{p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : 'Sin fecha'}</span>
                                  {p.cliente_nombre && (
                                    <>
                                      <span>•</span>
                                      <span className="text-blue-600 dark:text-blue-400 font-semibold">{p.cliente_nombre}</span>
                                    </>
                                  )}
                                  {p.metodo_pago && (
                                    <>
                                      <span>•</span>
                                      <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                        {getMetodoPagoLabel(p.metodo_pago)}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </label>
                            
                            <button
                              type="button"
                              onClick={() => {
                                if (handleSaveReconciliation) {
                                  const nextStatus = autoEstatus([], [p.id]);
                                  handleSaveReconciliation([], nextStatus, [p.id]);
                                }
                              }}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold shadow transition-all shrink-0"
                            >
                              Conciliar
                            </button>
                          </div>
                        );
                      })
                  )}
                  {isOutflow && gastosReconciliables.length === 0 && (
                    <div className="p-4 text-center text-xs text-gray-400 italic">No hay egresos sin conciliar</div>
                  )}
                  {!isOutflow && pedidosPendientes.length === 0 && (
                    <div className="p-4 text-center text-xs text-gray-400 italic">No hay facturas de ingresos ni pedidos sin conciliar</div>
                  )}
                </div>
              </div>

              {/* Adjuntar Archivos (XML, PDF, Ticket, Soporte) */}
              <div className="space-y-3 p-3.5 bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-800 rounded-xl font-sans shadow-sm">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400 block">Adjuntar Facturas, Tickets o Soportes a este Movimiento</span>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  
                  {/* Columna XML */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 block">Archivo XML (CFDI)</label>
                    <div className="relative overflow-hidden shrink-0">
                      <input
                        type="file"
                        accept=".xml"
                        onChange={handleXmlUploadChange}
                        disabled={reconcileModal.loading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        disabled={reconcileModal.loading}
                        className="w-full py-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow"
                      >
                        <UploadCloud size={14} /> Subir XML
                      </button>
                    </div>
                    {renderFileListLocal('xml')}
                  </div>

                  {/* Columna PDF */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 block">Representación PDF</label>
                    <div className="relative overflow-hidden shrink-0">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleUploadReconciliationFile && handleUploadReconciliationFile(e, 'pdf')}
                        disabled={reconcileModal.loading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        disabled={reconcileModal.loading}
                        className="w-full py-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow"
                      >
                        <UploadCloud size={14} /> Subir PDF
                      </button>
                    </div>
                    {renderFileListLocal('pdf')}
                  </div>

                  {/* Columna Ticket */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 block">Ticket / Comprobante</label>
                    <div className="relative overflow-hidden shrink-0">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleUploadReconciliationFile && handleUploadReconciliationFile(e, 'ticket')}
                        disabled={reconcileModal.loading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        disabled={reconcileModal.loading}
                        className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow"
                      >
                        <UploadCloud size={14} /> Subir Ticket
                      </button>
                    </div>
                    {renderFileListLocal('ticket')}
                  </div>

                  {/* Columna Soporte Reembolso */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 block">Soporte Reembolso</label>
                    <div className="relative overflow-hidden shrink-0">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleUploadReconciliationFile && handleUploadReconciliationFile(e, 'soporte_reembolso')}
                        disabled={reconcileModal.loading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        disabled={reconcileModal.loading}
                        className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow"
                      >
                        <UploadCloud size={14} /> Subir Soporte
                      </button>
                    </div>
                    {renderFileListLocal('soporte_reembolso')}
                  </div>

                </div>
              </div>

              {isOutflow && selectedGastosWithDiscrepancy.length > 0 && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-955/20 border border-amber-250 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-400 text-xs flex flex-col gap-1.5 font-sans shadow-sm">
                  <span className="font-extrabold flex items-center gap-1">
                    ⚠️ Advertencia Fiscal de Conciliación
                  </span>
                  <ul className="list-disc pl-4 space-y-1 font-medium">
                    {selectedGastosWithDiscrepancy.map((item) => (
                      <li key={item.gasto.id}>
                        El egreso <strong>"{item.gasto.concepto}"</strong> indica forma de pago {item.gasto.metodo_pago ? getMetodoPagoLabel(item.gasto.metodo_pago) : 'Desconocida'}, pero el retiro bancario es electrónico/tarjeta/efectivo.
                        <p className="italic text-[10px] opacity-90 mt-0.5">{item.disc.detalle}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    Tip: Para mantener la congruencia fiscal, te recomendamos cambiar el estatus resultante a "Movimiento no Deducible" en el selector inferior.
                  </p>
                </div>
              )}

              {/* Resumen de montos y conciliación */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex justify-between items-center flex-wrap gap-4 font-sans">
                <div className="flex gap-6 flex-wrap text-xs font-sans">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block font-semibold">Movimiento:</span>
                    <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">{formatCurrency(movMonto)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block font-semibold">{isOutflow ? 'Egresos/Facturas:' : 'Ventas/Pedidos:'}</span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalEgresosSistema)}</span>
                  </div>
                  {totalXmlsCargados > 0 && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block font-semibold">XMLs Asignados:</span>
                      <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">{formatCurrency(totalXmlsCargados)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block font-semibold">Total Comprobado:</span>
                    <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{formatCurrency(totalComprobado)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block font-semibold">Diferencia:</span>
                    <span className={`text-base font-mono font-extrabold ${match ? 'text-emerald-500' : 'text-amber-500'}`}>{formatCurrency(dif)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {match ? (
                    <span className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                      <Check size={14} /> Coincide
                    </span>
                  ) : (
                    <span className="bg-amber-100 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 animate-pulse">
                      ⚠️ Diferencia
                    </span>
                  )}
                </div>
              </div>

              {/* Estatus a asignar */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">Estatus resultante</label>
                <select value={reconcileModal.estatusClave}
                  onChange={(e) => setReconcileModal((p) => ({ ...p, estatusClave: e.target.value }))}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none transition-all">
                  <option value="">— Selecciona un estatus —</option>
                  {estatusCatalog.map((e) => <option key={e.id} value={e.clave}>{e.nombre}</option>)}
                </select>
              </div>

              {dif > 0.01 && isOutflow && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2 text-xs font-sans">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-amber-900 dark:text-amber-300 block">Excedente de pago de {formatCurrency(dif)}</span>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                        El pago bancario supera los comprobantes seleccionados. ¿Deseas guardar el excedente como Saldo a Favor del proveedor?
                      </p>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-amber-800 dark:text-amber-300 shrink-0 ml-3">
                      <input
                        type="checkbox"
                        checked={guardarExcedenteComoSaldoFavor}
                        onChange={(e) => setGuardarExcedenteComoSaldoFavor(e.target.checked)}
                        className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                      />
                      <span>Guardar Saldo a Favor</span>
                    </label>
                  </div>

                  {selectedProv && (
                    <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-300">
                      <span>
                        <strong>{selectedProv.nombre_comercial}</strong> — Saldo a Favor actual: <strong className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{formatCurrency(saldoFavorProveedor)}</strong>
                      </span>
                      {guardarExcedenteComoSaldoFavor && (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Nuevo saldo a favor estimado: <strong className="font-mono">{formatCurrency(saldoFavorProveedor + dif)}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {reconcileModal.error && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 rounded-lg">{reconcileModal.error}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setReconcileModal((p) => ({ ...p, open: false }))} disabled={reconcileModal.loading}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
                  Cancelar
                </button>
                 <button 
                  onClick={() => {
                    if (!handleSaveReconciliation) return;
                    const isExact = Math.abs(movMonto - totalComprobado) < 0.05;
                    let comentario = '';
                    if (!isExact && !guardarExcedenteComoSaldoFavor) {
                      const resComment = prompt('La conciliación no es exacta. Por favor, introduce un comentario explicando el porqué de la diferencia:');
                      if (resComment === null) return; // User cancelled
                      if (!resComment.trim()) {
                        alert('El comentario es obligatorio cuando la conciliación no es exacta.');
                        return;
                      }
                      comentario = resComment.trim();
                    } else if (guardarExcedenteComoSaldoFavor) {
                      comentario = `Excedente de ${formatCurrency(dif)} registrado como Saldo a Favor del proveedor.`;
                    }
                    handleSaveReconciliation(undefined, undefined, undefined, comentario);

                    if (guardarExcedenteComoSaldoFavor && dif > 0.01 && reconcileModal.movimiento) {
                      const firstG = gastosReconciliables.find(g => reconcileModal.gastosSeleccionados.includes(g.id));
                      if (firstG?.proveedor_id) {
                        generarSaldoFavorDesdeConciliacion(
                          firstG.proveedor_id,
                          reconcileModal.movimiento.id,
                          dif,
                          firstG.id,
                          `Sobrante de conciliación bancaria (${reconcileModal.movimiento.concepto || 'Movimiento'})`,
                          token || ''
                        );
                      }
                    }
                  }} 
                  disabled={reconcileModal.loading || !reconcileModal.estatusClave}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2"
                >
                  {reconcileModal.loading ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</> : <><Check size={14} /> Guardar Conciliación</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE ASOCIACIÓN DE COMPROBANTES DE DEPÓSITO (TICKETS Y CORTES) */}
      {activeDepositMov && (() => {
        const movMonto = Number(activeDepositMov.deposito || activeDepositMov.monto);
        const associated = (comprobantes || []).filter(c => 
          c.comprobantes_deposito_movimientos?.some(rel => rel.movimiento_id === activeDepositMov.id)
        );
        const compsSum = associated.reduce((acc, c) => {
          const rel = c.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === activeDepositMov.id);
          return acc + (rel ? Number(rel.monto_asociado) : 0);
        }, 0);
        const dif = movMonto - compsSum;
        const match = Math.abs(dif) < 0.05;

        const availableToLink = (comprobantes || []).filter(
          c => !associated.some(ac => ac.id === c.id) &&
               (!c.cuenta_bancaria_id || c.cuenta_bancaria_id === activeDepositMov.cuenta_bancaria_id)
        );

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/30">
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <CreditCard size={16} className="text-amber-500" /> Vincular Comprobantes al Depósito Bancario
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 font-sans">
                    Asocia tickets de depósito en ventanilla y cortes de tarjeta con este movimiento de {formatCurrency(movMonto)} ({new Date(activeDepositMov.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}).
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveDepositMov(null);
                    setNewCompForm(p => ({
                      ...p,
                      error: '',
                      archivoUrl: '',
                      montoDebito: '',
                      montoCredito: '',
                      propinaDebito: '',
                      propinaCredito: '',
                      montoAmex: '',
                      propinaAmex: ''
                    }));
                  }}
                  className="text-gray-400 hover:text-gray-655 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                
                {/* Izquierda: Comprobantes ya vinculados y estado de cuadre */}
                <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
                  <h4 className="text-xs font-extrabold uppercase text-amber-500 border-b border-gray-100 dark:border-gray-900 pb-1 shrink-0">
                    Comprobantes Vinculados ({associated.length})
                  </h4>
                  
                  <div className="flex-1 overflow-auto space-y-2">
                    {associated.map((c) => {
                      const isVentanilla = c.tipo === 'deposito_ventanilla';
                      const rel = c.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === activeDepositMov.id);
                      return (
                        <div
                          key={c.id}
                          className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 flex justify-between items-start gap-3 text-xs"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold ${
                                isVentanilla
                                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                  : 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                              }`}>
                                {isVentanilla ? 'Ventanilla' : 'Tarjeta'}
                              </span>
                              <span className="font-mono text-gray-550 text-[10px]">
                                {new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                              </span>
                            </div>
                            <p className="font-bold text-gray-800 dark:text-gray-255 truncate">{c.descripcion || 'Sin descripción'}</p>
                            {c.archivo_url && (
                              <button
                                type="button"
                                onClick={() => onDownloadFile(c.archivo_url!)}
                                className="text-[10px] text-amber-500 hover:underline flex items-center gap-0.5 font-bold"
                              >
                                📎 Ver Ticket ({c.storage_provider || 'Supabase'})
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0 font-sans">
                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-500">{formatCurrency(rel?.monto_asociado || c.monto)}</span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm('¿Deseas desvincular este comprobante del depósito?')) {
                                  const res = await onDesvincularComprobante?.(c.id, activeDepositMov.id);
                                  if (res && !res.success) {
                                    alert(res.error);
                                  }
                                }
                              }}
                              className="text-[10px] text-red-500 hover:bg-red-500/10 font-bold px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/30 transition-all"
                            >
                              Desvincular
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {associated.length === 0 && (
                      <div className="h-32 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-center text-gray-400 italic text-xs">
                        No hay comprobantes vinculados a este depósito
                      </div>
                    )}
                  </div>

                  {/* Resumen del cuadre de montos */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/40 border border-gray-250 dark:border-gray-800/80 rounded-xl space-y-1.5 shrink-0 font-sans">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-500">Monto del Depósito:</span>
                      <span className="font-mono text-gray-800 dark:text-gray-200 font-bold">{formatCurrency(movMonto)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-500">Suma Comprobantes:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-500 font-bold">+{formatCurrency(compsSum)}</span>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-800 pt-1.5 flex justify-between items-baseline">
                      <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Diferencia:</span>
                      <span className={`text-sm font-mono font-black ${match ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {formatCurrency(dif)}
                      </span>
                    </div>
                    <div className="flex justify-end pt-1">
                      {match ? (
                        <span className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                          ✓ Cuadra perfectamente
                        </span>
                      ) : (
                        <span className="bg-amber-100 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                          ⚠️ Pendiente por cuadrar ({formatCurrency(dif)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Derecha: Crear nuevo o Vincular comprobantes independientes existentes */}
                <div className="flex flex-col gap-4 min-h-0 overflow-hidden border-l border-gray-100 dark:border-gray-900 pl-6 font-sans">
                  
                  {/* Crear y Subir un Comprobante Nuevo en caliente */}
                  <div className="shrink-0 bg-gray-50/50 dark:bg-gray-900/30 p-4 border border-gray-200 dark:border-gray-800 rounded-xl space-y-3 font-sans">
                    <h4 className="text-[11px] font-black uppercase text-gray-500 tracking-wider">
                      + Registrar y Vincular Nuevo Ticket
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Tipo</label>
                        <select
                          value={newCompForm.tipo ?? 'deposito_ventanilla'}
                          onChange={(e) => setNewCompForm(p => ({ ...p, tipo: e.target.value as any }))}
                          className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1.5 rounded-lg text-xs text-gray-900 dark:text-white"
                        >
                          <option value="deposito_ventanilla">Ventanilla</option>
                          <option value="corte_tarjeta">Corte POS / Punto de Venta</option>
                          <option value="corte_bbva">Corte BBVA</option>
                          <option value="corte_parrot">Corte Parrot</option>
                        </select>
                      </div>
                      {newCompForm.tipo === 'deposito_ventanilla' ? (
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Monto</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            value={newCompForm.monto ?? ''}
                            onChange={(e) => setNewCompForm(p => ({ ...p, monto: e.target.value }))}
                            className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-1.5 rounded-lg text-xs font-mono text-gray-900 dark:text-white"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block mb-0.5">Monto Calculado</label>
                          <div className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-750 p-1.5 rounded-lg text-xs font-mono font-bold text-gray-900 dark:text-white">
                            {(() => {
                              const tot = parseInputNumber(newCompForm.montoDebito || 0) +
                                          parseInputNumber(newCompForm.montoCredito || 0) +
                                          parseInputNumber(newCompForm.propinaDebito || 0) +
                                          parseInputNumber(newCompForm.propinaCredito || 0) +
                                          parseInputNumber(newCompForm.montoAmex || 0) +
                                          parseInputNumber(newCompForm.propinaAmex || 0) +
                                          parseInputNumber(newCompForm.montoEfectivo || 0) +
                                          parseInputNumber(newCompForm.propinaEfectivo || 0) +
                                          parseInputNumber(newCompForm.montoParrotpay || 0) +
                                          parseInputNumber(newCompForm.propinaParrotpay || 0);
                              return formatCurrency(tot);
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {newCompForm.tipo !== 'deposito_ventanilla' && (
                      <div className="p-2 bg-gray-100 dark:bg-gray-900/30 border border-gray-250 dark:border-gray-800 rounded-lg space-y-2 text-[9px] font-sans">
                        {/* Efectivo */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold block">💵 Venta Efectivo</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={newCompForm.montoEfectivo ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, montoEfectivo: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold block">Prop. Efectivo</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={newCompForm.propinaEfectivo ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, propinaEfectivo: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                        {/* ParrotPay */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="text-purple-600 dark:text-purple-400 font-bold block">🦜 ParrotPay</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={newCompForm.montoParrotpay ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, montoParrotpay: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-purple-600 dark:text-purple-400 font-bold block">Prop. ParrotPay</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={newCompForm.propinaParrotpay ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, propinaParrotpay: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="text-gray-400 font-bold block">Imp. Débito (TDD)</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.montoDebito ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, montoDebito: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 font-bold block">Prop. Débito</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.propinaDebito ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, propinaDebito: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="text-gray-400 font-bold block">Imp. Crédito (TDC)</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.montoCredito ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, montoCredito: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 font-bold block">Prop. Crédito</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.propinaCredito ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, propinaCredito: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="text-gray-400 font-bold block">Imp. Amex</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.montoAmex ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, montoAmex: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 font-bold block">Prop. Amex</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.propinaAmex ?? ''}
                              onChange={(e) => setNewCompForm(p => ({ ...p, propinaAmex: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Fecha</label>
                        <input
                          type="date"
                          value={newCompForm.fecha ?? ''}
                          onChange={(e) => setNewCompForm(p => ({ ...p, fecha: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-1.5 rounded-lg text-xs text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Proveedor Almacén</label>
                        <div className="flex gap-2.5 mt-1 text-gray-955 dark:text-white">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name="modal_storage"
                              checked={newCompForm.storageProvider === 'Supabase'}
                              onChange={() => setNewCompForm(p => ({ ...p, storageProvider: 'Supabase', archivoUrl: '' }))}
                            />
                            <span className="text-[10px]">Supa</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input
                              type="radio"
                              name="modal_storage"
                              checked={newCompForm.storageProvider === 'GoogleDrive'}
                              onChange={() => setNewCompForm(p => ({ ...p, storageProvider: 'GoogleDrive', archivoUrl: '' }))}
                            />
                            <span className="text-[10px]">GDrive</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Archivo / Ticket</label>
                      {newCompForm.storageProvider === 'Supabase' ? (
                        <div className="relative overflow-hidden w-full">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={handleUploadCompFile}
                            disabled={compUploadLoading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <button
                            type="button"
                            disabled={compUploadLoading}
                            className="w-full py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-955 dark:hover:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 text-gray-700 dark:text-gray-300"
                          >
                            {compUploadLoading ? <RefreshCw size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                            {newCompForm.archivoUrl ? 'Cargado ✓' : 'Subir Ticket...'}
                          </button>
                        </div>
                      ) : (
                        <input
                          type="url"
                          placeholder="Enlace de Google Drive..."
                          value={newCompForm.archivoUrl ?? ''}
                          onChange={(e) => setNewCompForm(p => ({ ...p, archivoUrl: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1.5 rounded-lg text-[11px] font-mono text-gray-900 dark:text-white"
                        />
                      )}
                    </div>

                    <div className="text-xs">
                      <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Descripción</label>
                      <input
                        type="text"
                        placeholder="Nota (Ej: Ticket caja 1)"
                        value={newCompForm.descripcion ?? ''}
                        onChange={(e) => setNewCompForm(p => ({ ...p, descripcion: e.target.value }))}
                        className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1.5 rounded-lg text-xs text-gray-900 dark:text-white"
                      />
                    </div>

                    {newCompForm.error && (
                      <div className="text-[10px] text-red-500 font-semibold">{newCompForm.error}</div>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        const tot = newCompForm.tipo === 'deposito_ventanilla'
                          ? parseInputNumber(newCompForm.monto)
                          : parseInputNumber(newCompForm.montoDebito || 0) +
                            parseInputNumber(newCompForm.montoCredito || 0) +
                            parseInputNumber(newCompForm.propinaDebito || 0) +
                            parseInputNumber(newCompForm.propinaCredito || 0) +
                            parseInputNumber(newCompForm.montoAmex || 0) +
                            parseInputNumber(newCompForm.propinaAmex || 0) +
                            parseInputNumber(newCompForm.montoEfectivo || 0) +
                            parseInputNumber(newCompForm.propinaEfectivo || 0) +
                            parseInputNumber(newCompForm.montoParrotpay || 0) +
                            parseInputNumber(newCompForm.propinaParrotpay || 0);

                        if (!tot || tot <= 0) {
                          setNewCompForm(p => ({ ...p, error: 'Monto inválido.' }));
                          return;
                        }
                        setNewCompForm(p => ({ ...p, loading: true, error: '' }));
                        try {
                          const res = await onCrearComprobante?.({
                            tipo: newCompForm.tipo,
                            fecha: newCompForm.fecha,
                            monto: tot,
                            descripcion: newCompForm.descripcion,
                            archivo_url: newCompForm.archivoUrl,
                            storage_provider: newCompForm.storageProvider,
                            cuenta_bancaria_id: activeDepositMov.cuenta_bancaria_id,
                            movimiento_bancario_id: activeDepositMov.id,
                            monto_debito: parseInputNumber(newCompForm.montoDebito || 0),
                            monto_credito: parseInputNumber(newCompForm.montoCredito || 0),
                            propina_debito: parseInputNumber(newCompForm.propinaDebito || 0),
                            propina_credito: parseInputNumber(newCompForm.propinaCredito || 0),
                            monto_amex: parseInputNumber(newCompForm.montoAmex || 0),
                            propina_amex: parseInputNumber(newCompForm.propinaAmex || 0),
                            monto_efectivo: parseInputNumber(newCompForm.montoEfectivo || 0),
                            propina_efectivo: parseInputNumber(newCompForm.propinaEfectivo || 0),
                            monto_parrotpay: parseInputNumber(newCompForm.montoParrotpay || 0),
                            propina_parrotpay: parseInputNumber(newCompForm.propinaParrotpay || 0)
                          });
                          if (res && !res.success) throw new Error(res.error);
                          
                          if (selectedMonth && newCompForm.fecha.substring(0, 7) !== selectedMonth) {
                            alert(`Atención: El comprobante se guardó con fecha ${newCompForm.fecha}, la cual pertenece al período (${newCompForm.fecha.substring(0, 7)}). Para visualizarlo en la lista de conciliación, selecciona ese período en la parte superior.`);
                          }

                          setNewCompForm(p => ({
                            ...p,
                            fecha: getDefaultDateForSelectedMonth(),
                            monto: '',
                            montoDebito: '',
                            montoCredito: '',
                            propinaDebito: '',
                            propinaCredito: '',
                            montoAmex: '',
                            propinaAmex: '',
                            montoEfectivo: '',
                            propinaEfectivo: '',
                            montoParrotpay: '',
                            propinaParrotpay: '',
                            descripcion: '',
                            archivoUrl: '',
                            error: ''
                          }));
                        } catch (err: any) {
                          setNewCompForm(p => ({ ...p, error: err.message || 'Error al registrar.' }));
                        } finally {
                          setNewCompForm(p => ({ ...p, loading: false }));
                        }
                      }}
                      disabled={newCompForm.loading || compUploadLoading}
                      className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all"
                    >
                      {newCompForm.loading ? 'Registrando...' : 'Registrar y Vincular'}
                    </button>
                  </div>

                  {/* Vincular Comprobante Independiente existente */}
                  <div className="flex-1 flex flex-col min-h-0 font-sans mt-2">
                    <div className="flex justify-between items-center mb-2 shrink-0">
                      <h4 className="text-[11px] font-black uppercase text-gray-500 tracking-wider">
                        Vincular Existentes Pendientes ({availableToLink.length})
                      </h4>
                      {availableToLink.length > 3 && (
                        <input
                          type="text"
                          placeholder="Buscar..."
                          value={linkSearchQuery}
                          onChange={(e) => setLinkSearchQuery(e.target.value)}
                          className="bg-transparent border border-gray-300 dark:border-gray-700 px-2 py-0.5 rounded text-[10px] w-28 text-gray-900 dark:text-white"
                        />
                      )}
                    </div>

                    <div className="flex-1 overflow-auto space-y-1.5 border border-gray-150 dark:border-gray-800/80 rounded-xl p-2.5">
                      {availableToLink
                        .filter(c => {
                          if (!linkSearchQuery.trim()) return true;
                          const q = linkSearchQuery.toLowerCase();
                          return c.descripcion?.toLowerCase().includes(q) || String(c.monto).includes(q) || c.fecha.includes(q);
                        })
                        .map((c) => {
                          const isVentanilla = c.tipo === 'deposito_ventanilla';
                          return (
                            <div
                              key={c.id}
                              className="p-2.5 rounded-lg border border-gray-100 dark:border-gray-900 bg-gray-50/30 dark:bg-gray-900/10 flex justify-between items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-[9px] text-gray-550 dark:text-gray-400">
                                    {new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                                  </span>
                                  <span className={`text-[8px] px-1 py-0.1 rounded font-bold ${
                                    isVentanilla
                                      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                      : 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                                  }`}>
                                    {isVentanilla ? 'Ventanilla' : 'Tarjeta'}
                                  </span>
                                </div>
                                <p className="font-bold text-[11px] text-gray-700 dark:text-gray-300 truncate">{c.descripcion || 'Sin descripción'}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono font-extrabold text-xs text-gray-800 dark:text-gray-255">{formatCurrency(c.monto)}</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const res = await onVincularComprobante?.(c.id, activeDepositMov.id, Number(c.monto));
                                    if (res && !res.success) {
                                      alert(res.error);
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow"
                                >
                                  Vincular
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      {availableToLink.length === 0 && (
                        <div className="h-24 flex items-center justify-center text-gray-400 italic text-xs">
                          No hay comprobantes pendientes compatibles para vincular.
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>

              <div className="p-4 border-t border-gray-150 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-900/30">
                <button
                  onClick={() => {
                    setActiveDepositMov(null);
                    setNewCompForm(p => ({
                      ...p,
                      error: '',
                      archivoUrl: '',
                      montoDebito: '',
                      montoCredito: '',
                      propinaDebito: '',
                      propinaCredito: '',
                      montoAmex: '',
                      propinaAmex: ''
                    }));
                  }}
                  className="px-6 py-2 border border-gray-350 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow text-gray-700 dark:text-gray-300"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE VINCULACIÓN DE MOVIMIENTOS A UN COMPROBANTE (TICKET) */}
      {activeCompToLink && currentCompToLink && (() => {
        const compMonto = Number(currentCompToLink.monto);
        const associatedMovs = movimientos.filter(m => 
          currentCompToLink.comprobantes_deposito_movimientos?.some(rel => rel.movimiento_id === m.id)
        );
        const movsSum = movimientos.reduce((acc, m) => {
          const rel = currentCompToLink.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === m.id);
          return acc + (rel ? Number(rel.monto_asociado) : 0);
        }, 0);

        // Filtrar movimientos disponibles: EXCLUSIVAMENTE de la misma cuenta bancaria del comprobante
        const targetCuentaId = currentCompToLink.cuenta_bancaria_id || selectedCuentaId;
        const availableMovs = movimientos.filter(m => 
          m.tipo_movimiento === 'Deposito' && 
          !associatedMovs.some(am => am.id === m.id) && 
          !comprobantes.some(c => c.id !== currentCompToLink.id && c.comprobantes_deposito_movimientos?.some(rel => rel.movimiento_id === m.id)) &&
          m.estatus_conciliacion_bancaria?.clave !== 'comprobado' &&
          m.estatus_conciliacion_bancaria?.clave !== 'conciliado' &&
          (!targetCuentaId || m.cuenta_bancaria_id === targetCuentaId)
        );

        // Suma de movimientos seleccionados (calculada before totalSum)
        const selectedSum = availableMovs
          .filter(m => selectedLinkMovIds.has(m.id))
          .reduce((acc, m) => acc + Number(m.deposito || m.monto), 0);

        const totalSum = movsSum + selectedSum;
        const dif = compMonto - totalSum;
        const match = Math.abs(dif) < 0.05;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/30">
                <div>
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <ArrowRightLeft size={16} className="text-amber-500" /> Vincular Movimientos al Comprobante
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 font-sans">
                    Asocia depósitos bancarios de tu estado de cuenta con el comprobante de {formatCurrency(compMonto)} ({new Date(currentCompToLink.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}).
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveCompToLink(null);
                    setLinkSearchQuery('');
                    setSelectedLinkMovIds(new Set());
                    setLinkDateFrom('');
                    setLinkDateTo('');
                  }}
                  className="text-gray-400 hover:text-gray-655 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0 font-sans">
                
                {/* Izquierda: Movimientos ya vinculados y estado de cuadre */}
                <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
                  <h4 className="text-xs font-extrabold uppercase text-amber-500 border-b border-gray-100 dark:border-gray-900 pb-1 shrink-0">
                    Depósitos Bancarios Vinculados ({associatedMovs.length})
                  </h4>
                  
                  <div className="flex-1 overflow-auto space-y-2">
                    {associatedMovs.map((m) => {
                      const rel = currentCompToLink.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === m.id);
                      return (
                        <div
                          key={m.id}
                          className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-800 flex justify-between items-start gap-3 text-xs"
                        >
                          <div className="space-y-1 flex-1 min-w-0">
                            <span className="font-mono text-gray-500 text-[10px]">
                              {new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                            </span>
                            <p className="font-bold text-gray-800 dark:text-gray-255 truncate">{m.concepto}</p>
                            {m.referencia && <span className="text-[10px] text-gray-400">Ref: {m.referencia}</span>}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-500">{formatCurrency(m.deposito || m.monto)}</span>
                            {rel?.monto_asociado && Number(rel.monto_asociado) !== Number(m.deposito || m.monto) && (
                              <span className="text-[9px] text-gray-400 font-mono">Asoc: {formatCurrency(rel.monto_asociado)}</span>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm('¿Deseas desvincular este movimiento bancario del comprobante?')) {
                                  const res = await onDesvincularComprobante?.(currentCompToLink.id, m.id);
                                  if (res && !res.success) {
                                    alert(res.error);
                                  }
                                }
                              }}
                              className="text-[10px] text-red-500 hover:bg-red-500/10 font-bold px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/30 transition-all"
                            >
                              Desvincular
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {associatedMovs.length === 0 && (
                      <div className="h-32 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-center text-gray-400 italic text-xs">
                        No hay movimientos bancarios vinculados a este comprobante
                      </div>
                    )}
                  </div>

                  {/* Resumen del cuadre */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/40 border border-gray-250 dark:border-gray-800/80 rounded-xl space-y-1.5 shrink-0">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-500">Monto del Comprobante:</span>
                      <span className="font-mono text-gray-800 dark:text-gray-200 font-bold">{formatCurrency(compMonto)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-gray-500">Vinculados:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-500 font-bold">+{formatCurrency(movsSum)}</span>
                    </div>
                    {selectedSum > 0 && (
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-amber-600 dark:text-amber-400">+ Seleccionados ({selectedLinkMovIds.size}):</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">+{formatCurrency(selectedSum)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-800 pt-1.5 flex justify-between items-baseline">
                      <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Diferencia:</span>
                      <span className={`text-sm font-mono font-black ${match ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {formatCurrency(dif)}
                      </span>
                    </div>
                    <div className="flex justify-end pt-1">
                      {match ? (
                        <span className="bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                          ✓ Cuadra perfectamente
                        </span>
                      ) : (
                        <span className="bg-amber-100 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                          ⚠️ Pendiente por cuadrar ({formatCurrency(dif)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Derecha: Buscar y Vincular movimientos bancarios del estado de cuenta */}
                <div className="flex flex-col gap-4 min-h-0 overflow-hidden border-l border-gray-100 dark:border-gray-900 pl-6 font-sans">
                  <div className="flex flex-col gap-2 shrink-0">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[11px] font-black uppercase text-gray-500 tracking-wider">
                        Depósitos Disponibles ({availableMovs.length})
                      </h4>
                      <input
                        type="text"
                        placeholder="Buscar concepto o monto..."
                        value={linkSearchQuery}
                        onChange={(e) => setLinkSearchQuery(e.target.value)}
                        className="bg-transparent border border-gray-300 dark:border-gray-700 px-2 py-0.5 rounded text-[10px] w-40 text-gray-900 dark:text-white"
                      />
                    </div>
                    {/* Filtro por fechas */}
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-gray-500 font-semibold">Desde:</label>
                      <input
                        type="date"
                        value={linkDateFrom}
                        onChange={(e) => setLinkDateFrom(e.target.value)}
                        className="bg-transparent border border-gray-300 dark:border-gray-700 px-1.5 py-0.5 rounded text-[10px] text-gray-900 dark:text-white"
                      />
                      <label className="text-[10px] text-gray-500 font-semibold">Hasta:</label>
                      <input
                        type="date"
                        value={linkDateTo}
                        onChange={(e) => setLinkDateTo(e.target.value)}
                        className="bg-transparent border border-gray-300 dark:border-gray-700 px-1.5 py-0.5 rounded text-[10px] text-gray-900 dark:text-white"
                      />
                      {(linkDateFrom || linkDateTo) && (
                        <button type="button" onClick={() => { setLinkDateFrom(''); setLinkDateTo(''); }} className="text-[10px] text-red-500 hover:underline font-bold">Limpiar</button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto space-y-1.5 border border-gray-150 dark:border-gray-800/80 rounded-xl p-3">
                    {(() => {
                      const filteredMovs = availableMovs.filter(m => {
                        // Text search
                        if (linkSearchQuery.trim()) {
                          const q = linkSearchQuery.toLowerCase();
                          const matchesText = m.concepto?.toLowerCase().includes(q) || String(m.monto).includes(q) || m.fecha.includes(q);
                          if (!matchesText) return false;
                        }
                        // Date filter
                        if (linkDateFrom && m.fecha < linkDateFrom) return false;
                        if (linkDateTo && m.fecha > linkDateTo) return false;
                        return true;
                      });
                      if (filteredMovs.length === 0) {
                        return (
                          <div className="h-40 flex items-center justify-center text-gray-400 italic text-xs">
                            No hay depósitos bancarios compatibles pendientes por conciliar.
                          </div>
                        );
                      }
                      return filteredMovs.map((m) => {
                        const isSelected = selectedLinkMovIds.has(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/20'
                                : 'border-gray-100 dark:border-gray-900 bg-gray-50/30 dark:bg-gray-900/10 hover:bg-gray-100 dark:hover:bg-gray-900'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedLinkMovIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(m.id)) {
                                    next.delete(m.id);
                                  } else {
                                    next.add(m.id);
                                  }
                                  return next;
                                });
                              }}
                              className="accent-amber-500 w-4 h-4 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="font-mono text-[9px] text-gray-500 block">
                                {new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                              </span>
                              <p className="font-bold text-xs text-gray-750 dark:text-gray-255 truncate">{m.concepto}</p>
                              {m.referencia && <p className="text-[9px] text-gray-400">Ref: {m.referencia}</p>}
                            </div>
                            <span className="font-mono font-extrabold text-sm text-gray-850 dark:text-gray-200 shrink-0">
                              {formatCurrency(m.deposito || m.monto)}
                            </span>
                          </label>
                        );
                      });
                    })()}
                  </div>

                </div>

              </div>

              <div className="p-4 border-t border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/30">
                <button
                  onClick={() => {
                    setActiveCompToLink(null);
                    setLinkSearchQuery('');
                    setSelectedLinkMovIds(new Set());
                    setLinkDateFrom('');
                    setLinkDateTo('');
                  }}
                  className="px-6 py-2 border border-gray-350 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow text-gray-700 dark:text-gray-300"
                >
                  Cerrar
                </button>
                {selectedLinkMovIds.size > 0 && (
                  <button
                    disabled={linkingBatch}
                    onClick={async () => {
                      const ids = Array.from(selectedLinkMovIds);
                      const selectedMovObjs = ids.map(id => availableMovs.find(x => x.id === id)).filter((m): m is NonNullable<typeof m> => !!m);
                      const selectedSum = selectedMovObjs.reduce((acc, m) => acc + Number(m.deposito || m.monto || 0), 0);
                      const totalSum = movsSum + selectedSum;
                      const dif = Number(currentCompToLink.monto) - totalSum;
                      const isExactMatch = Math.abs(dif) < 0.05;

                      const isPlatformWithCommission = selectedMovObjs.some(m => {
                        const conceptUpper = (m.concepto || '').toUpperCase();
                        return (
                          conceptUpper.includes('SPEI RECIBIDOBANORTE') ||
                          conceptUpper.includes('PARROT') ||
                          conceptUpper.includes('BANORTE') ||
                          conceptUpper.includes('DESCUENTO') ||
                          conceptUpper.includes('COMISION') ||
                          conceptUpper.includes('COMISIÓ') ||
                          conceptUpper.includes('OELTRANSFER')
                        );
                      });

                      if (!isExactMatch && !isPlatformWithCommission) {
                        alert(
                          `⛔ No se permite vincular este movimiento.\n\n` +
                          `Para movimientos bancarios normales (BBVA), el importe depositado debe coincidir al 100% con el ticket.\n\n` +
                          `• Monto Ticket: ${formatCurrency(currentCompToLink.monto)}\n` +
                          `• Ya Vinculados: ${formatCurrency(movsSum)}\n` +
                          `• Depósitos Seleccionados: ${formatCurrency(selectedSum)}\n` +
                          `• Diferencia pendiente: ${formatCurrency(dif)}`
                        );
                        return;
                      }

                      if (!isExactMatch && isPlatformWithCommission) {
                        const confirmBolsa = confirm(
                          `⚡ Movimiento de Plataforma con Comisión Detectado (Parrot / SPEI Banorte)\n\n` +
                          `• Monto Ticket / Venta: ${formatCurrency(currentCompToLink.monto)}\n` +
                          `• Depósito Recibido: ${formatCurrency(selectedSum)}\n` +
                          `• Comisión Descontada: ${formatCurrency(dif)}\n\n` +
                          `¿Deseas vincular este depósito y enviar la diferencia de ${formatCurrency(dif)} a la Bolsa de Comisiones por Plataforma?`
                        );
                        if (!confirmBolsa) return;

                        if (onCrearComprobante && dif > 0) {
                          await onCrearComprobante({
                            tipo: 'deposito_ventanilla',
                            fecha: currentCompToLink.fecha,
                            monto: dif,
                            descripcion: `Comisión / Descuento Plataforma Parrot (SPEI Banorte) para Ticket ${currentCompToLink.descripcion || ''}`,
                            cuentaBancariaId: currentCompToLink.cuenta_bancaria_id || null
                          });
                        }
                      }

                      setLinkingBatch(true);
                      try {
                        for (const movId of ids) {
                          const mov = availableMovs.find(x => x.id === movId);
                          const montoAsoc = mov ? Number(mov.deposito || mov.monto) : undefined;
                          const res = await onVincularComprobante?.(currentCompToLink.id, movId, montoAsoc);
                          if (res && !res.success) {
                            alert(`Error vinculando movimiento: ${res.error}`);
                            break;
                          }
                        }
                        setSelectedLinkMovIds(new Set());
                        setActiveCompToLink(null);
                      } finally {
                        setLinkingBatch(false);
                      }
                    }}
                    className="px-6 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg transition-all flex items-center gap-2"
                  >
                    {linkingBatch ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Vinculando...
                      </>
                    ) : (
                      <>Vincular {selectedLinkMovIds.size} Movimiento{selectedLinkMovIds.size !== 1 ? 's' : ''}</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {fusionModal.open && fusionModal.mov1 && fusionModal.mov2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            <div className="p-5 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/30">
              <div>
                <h3 className="font-extrabold text-base text-gray-800 dark:text-white flex items-center gap-2">
                  <ArrowRightLeft className="text-amber-500" size={18} />
                  Fusionar Movimientos de Reembolso
                </h3>
                <p className="text-[10px] text-gray-405 dark:text-gray-400 mt-0.5">Se vincularán ambos movimientos bancarios y compartirán el soporte documental.</p>
              </div>
              <button
                type="button"
                onClick={() => setFusionModal(prev => ({ ...prev, open: false }))}
                className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 font-sans">
              {fusionModal.error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle size={15} />
                  <span>{fusionModal.error}</span>
                </div>
              )}

              {/* Movimientos seleccionados */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Movimientos a Fusionar</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Movimiento 1 (Retiro / Egreso) */}
                  <div className="p-3.5 bg-red-50/40 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 rounded-2xl flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-red-655 dark:text-red-400 uppercase">Egreso (Retiro)</span>
                      <p className="font-bold text-xs text-gray-800 dark:text-gray-200 mt-1 truncate">{fusionModal.mov1.concepto}</p>
                      <span className="text-[9px] text-gray-400 block mt-0.5">Fecha: {new Date(fusionModal.mov1.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</span>
                    </div>
                    <span className="text-sm font-extrabold text-red-505 mt-3 block">-{formatCurrency(fusionModal.mov1.retiro || Math.abs(fusionModal.mov1.monto))}</span>
                  </div>

                  {/* Movimiento 2 (Deposito / Ingreso) */}
                  <div className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex flex-col justify-between">
                    <div>
                      <span className="text-[9px] font-bold text-emerald-655 dark:text-emerald-400 uppercase">Ingreso (Depósito)</span>
                      <p className="font-bold text-xs text-gray-800 dark:text-gray-200 mt-1 truncate">{fusionModal.mov2.concepto}</p>
                      <span className="text-[9px] text-gray-400 block mt-0.5">Fecha: {new Date(fusionModal.mov2.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</span>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-505 mt-3 block">+{formatCurrency(fusionModal.mov2.deposito || Math.abs(fusionModal.mov2.monto))}</span>
                  </div>
                </div>
              </div>

              {/* Subir archivo de soporte */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Adjuntar Soporte de Reembolso</label>
                <div className="flex items-center gap-3">
                  <div className="relative overflow-hidden shrink-0">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleUploadFusionFile}
                      disabled={fusionModal.loading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={fusionModal.loading}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow"
                    >
                      <UploadCloud size={14} /> Subir Soporte
                    </button>
                  </div>
                  {fusionModal.loading && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      Subiendo archivo...
                    </span>
                  )}
                </div>

                {/* Lista de archivos subidos */}
                {fusionModal.soporteReembolsoUrl && (
                  <div className="space-y-1 mt-2">
                    {fusionModal.soporteReembolsoUrl.split(',').filter(Boolean).map((path, idx) => {
                      const fileName = path.split('/').pop() || '';
                      return (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900 p-2 rounded-xl border border-gray-250/60 dark:border-gray-800 text-[10px]">
                          <span className="truncate max-w-[300px] font-semibold text-gray-700 dark:text-gray-300" title={fileName}>
                            📎 {fileName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFusionFile(idx)}
                            className="text-red-550 hover:text-red-600 font-bold uppercase hover:underline"
                          >
                            Borrar
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Comentarios */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Comentarios / Notas internas</label>
                <textarea
                  rows={3}
                  value={fusionModal.comentarios}
                  onChange={(e) => setFusionModal(prev => ({ ...prev, comentarios: e.target.value }))}
                  placeholder="Ej. Reembolso cruzado para cuadrar movimientos..."
                  className="w-full border border-gray-250 dark:border-gray-800 rounded-xl p-2.5 text-xs bg-transparent dark:text-white focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none outline-0"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-150 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-900/30">
              <button
                type="button"
                disabled={fusionModal.loading}
                onClick={() => setFusionModal(prev => ({ ...prev, open: false }))}
                className="px-5 py-2 border border-gray-350 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 shadow text-gray-700 dark:text-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={fusionModal.loading}
                onClick={handleConfirmFusion}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white shadow-lg transition-all flex items-center gap-1.5"
              >
                {fusionModal.loading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>Confirmar Fusión</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DESGLOSE DE COMISIONES POR TRANSACCIÓN (PARROT / POS) */}
      {desgloseComisionesModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 font-sans">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/30">
              <div>
                <h3 className="font-extrabold text-base text-gray-800 dark:text-white flex items-center gap-2">
                  <CreditCard className="text-amber-500" size={18} />
                  Desglose de Transacciones y Comisiones (POS / Parrot)
                </h3>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Registra comisiones e IVA en la Bolsa de Comisiones por Plataforma para cuadrar la factura mensual.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDesgloseComisionesModal(p => ({ ...p, isOpen: false }))}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body matching user screenshot structure */}
            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              {(() => {
                const selectedMovs = movimientos.filter(m => (selectedGlobalDepositIds || []).includes(m.id));
                const selectedSum = selectedMovs.reduce((acc, m) => acc + Number(m.deposito || m.monto || 0), 0);
                const compsSum = desgloseComisionesModal.targetComps.reduce((acc, c) => acc + Number(c.monto || 0), 0);

                const com = parseInputNumber(desgloseComisionesModal.comisionTransacciones);
                const iva = parseInputNumber(desgloseComisionesModal.ivaTransacciones);
                const otros = parseInputNumber(desgloseComisionesModal.otrosCargos);
                const totalCom = com + iva + otros;

                const subtotalVentas = parseInputNumber(desgloseComisionesModal.ventaBruta) + parseInputNumber(desgloseComisionesModal.propina);
                const montoNetoDepositar = subtotalVentas - totalCom;
                const difConBanco = Math.abs(montoNetoDepositar - selectedSum);
                const cuadraBancos = difConBanco < 0.05;

                return (
                  <>
                    <div className="p-3 bg-amber-50/50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl font-mono text-[11px] space-y-1">
                      <div className="flex justify-between font-bold text-amber-800 dark:text-amber-300">
                        <span>Depósito(s) Banco Seleccionado(s):</span>
                        <span>{formatCurrency(selectedSum)}</span>
                      </div>
                      <div className="flex justify-between text-gray-500">
                        <span>Ticket(s) a Vincular ({desgloseComisionesModal.targetComps.length}):</span>
                        <span>{formatCurrency(compsSum)}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-955/30 border border-purple-200 dark:border-purple-900/40 text-[10px] font-sans text-purple-700 dark:text-purple-300 font-medium flex items-center gap-1.5">
                      <span>🦜 <b>Regla ParrotPay:</b> Únicamente computa la <b>Venta ParrotPay</b> y su <b>Propina</b>. Excluye Efectivo, TDC y TDD.</span>
                    </div>

                    <div className="space-y-3 font-mono">
                      {/* Venta Bruta */}
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <label className="text-[11px] font-sans font-bold text-gray-700 dark:text-gray-300">Venta bruta (consumo):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={desgloseComisionesModal.ventaBruta}
                          onChange={(e) => setDesgloseComisionesModal(p => ({ ...p, ventaBruta: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-right font-mono font-bold text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Propina */}
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <label className="text-[11px] font-sans font-bold text-gray-700 dark:text-gray-300">Propina:</label>
                        <input
                          type="number"
                          step="0.01"
                          value={desgloseComisionesModal.propina}
                          onChange={(e) => setDesgloseComisionesModal(p => ({ ...p, propina: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-right font-mono font-bold text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Total Venta */}
                      <div className="flex justify-between p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl font-bold border border-gray-200 dark:border-gray-800 text-xs">
                        <span className="font-sans text-gray-700 dark:text-gray-200">Total Venta + Propina:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{formatCurrency(subtotalVentas)}</span>
                      </div>

                      {/* Comisión transacciones */}
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <label className="text-[11px] font-sans font-bold text-rose-600 dark:text-rose-400">Comisión transacciones (-):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={desgloseComisionesModal.comisionTransacciones}
                          onChange={(e) => {
                            const val = e.target.value;
                            const num = parseInputNumber(val);
                            const autoIva = num > 0 ? (num * 0.16).toFixed(2) : '';
                            setDesgloseComisionesModal(p => ({ ...p, comisionTransacciones: val, ivaTransacciones: autoIva }));
                          }}
                          className="w-full bg-white dark:bg-gray-900 border border-rose-300 dark:border-rose-900 p-2 rounded-lg text-right font-mono font-bold text-rose-600 dark:text-rose-400"
                        />
                      </div>

                      {/* IVA transacciones */}
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <label className="text-[11px] font-sans font-bold text-rose-600 dark:text-rose-400">IVA transacciones 16% (-):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={desgloseComisionesModal.ivaTransacciones}
                          onChange={(e) => setDesgloseComisionesModal(p => ({ ...p, ivaTransacciones: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-900 border border-rose-300 dark:border-rose-900 p-2 rounded-lg text-right font-mono font-bold text-rose-600 dark:text-rose-400"
                        />
                      </div>

                      {/* Otros cargos */}
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <label className="text-[11px] font-sans font-bold text-gray-500">Otros cargos (-):</label>
                        <input
                          type="number"
                          step="0.01"
                          value={desgloseComisionesModal.otrosCargos}
                          onChange={(e) => setDesgloseComisionesModal(p => ({ ...p, otrosCargos: e.target.value }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-right font-mono text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Resumen Bolsa y Neto */}
                      <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                        <div className="p-3 bg-purple-50 dark:bg-purple-955/30 border border-purple-200 dark:border-purple-900/40 rounded-xl space-y-1">
                          <div className="flex justify-between font-bold text-purple-700 dark:text-purple-300 text-[11px]">
                            <span className="font-sans">📦 Total a Bolsa de Comisiones por Plataforma:</span>
                            <span>{formatCurrency(totalCom)}</span>
                          </div>
                          <p className="text-[9px] text-gray-500 font-sans">
                            (Comisión: {formatCurrency(com)} + IVA: {formatCurrency(iva)}{otros > 0 ? ` + Otros: ${formatCurrency(otros)}` : ''})
                          </p>
                        </div>

                        <div className={`p-3 rounded-xl border flex justify-between items-center ${
                          cuadraBancos
                            ? 'bg-emerald-50 dark:bg-emerald-955/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-955/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                        }`}>
                          <div>
                            <span className="font-sans font-bold block text-[11px]">Monto Neto a Depositar:</span>
                            <span className="text-[9px] font-sans opacity-80">
                              {cuadraBancos ? '✓ Cuadra 100% con el Banco' : `⚠️ Diferencia con banco: ${formatCurrency(montoNetoDepositar - selectedSum)}`}
                            </span>
                          </div>
                          <span className="font-mono font-black text-sm">{formatCurrency(montoNetoDepositar)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Footer buttons */}
            <div className="p-4 border-t border-gray-150 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-900/30">
              <button
                type="button"
                onClick={() => setDesgloseComisionesModal(p => ({ ...p, isOpen: false }))}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const com = parseInputNumber(desgloseComisionesModal.comisionTransacciones);
                  const iva = parseInputNumber(desgloseComisionesModal.ivaTransacciones);
                  const otros = parseInputNumber(desgloseComisionesModal.otrosCargos);
                  const totalCom = com + iva + otros;

                  const selectedMovs = movimientos.filter(m => (selectedGlobalDepositIds || []).includes(m.id));

                  // 1. Crear comprobante de comisión en la Bolsa
                  if (onCrearComprobante && totalCom > 0) {
                    await onCrearComprobante({
                      tipo: 'deposito_ventanilla',
                      fecha: desgloseComisionesModal.targetComps[0]?.fecha || new Date().toISOString().split('T')[0],
                      monto: totalCom,
                      descripcion: `Comisión Transacciones POS/Parrot (Comisión: ${formatCurrency(com)}, IVA: ${formatCurrency(iva)}${otros > 0 ? `, Otros: ${formatCurrency(otros)}` : ''}) - Ticket(s) Vinc.`,
                      cuentaBancariaId: desgloseComisionesModal.targetComps[0]?.cuenta_bancaria_id || null
                    });
                  }

                  // 2. Vincular los tickets seleccionados con los depósitos bancarios seleccionados
                  for (const comp of desgloseComisionesModal.targetComps) {
                    for (const movId of selectedGlobalDepositIds) {
                      const mov = movimientos.find(m => m.id === movId);
                      const montoAsoc = (desgloseComisionesModal.targetComps.length === 1 && selectedMovs.length > 1 && mov)
                        ? Number(mov.deposito || mov.monto)
                        : Number(comp.monto);
                      const res = await onVincularComprobante?.(comp.id, movId, montoAsoc);
                      if (res && !res.success) {
                        alert(res.error);
                        break;
                      }
                    }
                  }

                  setSelectedGlobalDepositIds([]);
                  setSelectedGlobalComprobanteIds([]);
                  setSelectedGlobalDepositId(null);
                  setDesgloseComisionesModal(p => ({ ...p, isOpen: false }));
                }}
                className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg flex items-center gap-1.5"
              >
                ✓ Confirmar y Registrar en Bolsa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
