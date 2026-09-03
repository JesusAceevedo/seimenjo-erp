'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/gastos/_components/BancoTab.tsx
// Tab de Conciliación Bancaria con sub-tabs:
//   1. Movimientos de cuenta (tabla + filtros + paginación)
//   2. Facturación global (depósitos vs. pedidos)
//   3. Catálogo de estatus
//   4. Métodos de pago

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  FileCode, FileText, CreditCard, List, Scale, Settings,
  ArrowRightLeft, Play, RefreshCw, FileSpreadsheet, Plus, Trash2, Edit3,
  Layers, Check, X, UploadCloud, Paperclip, AlertTriangle, Filter, Eye, Link, Ticket, Landmark,
  Tag, Lock, Unlock, ChevronDown, ChevronRight, Users, Receipt, SlidersHorizontal, TrendingUp, TrendingDown,
  History, Sparkles, ShieldAlert
} from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import type { MovimientoBancario, EstatusConciliacion, GastoReconciliable, FormaPago, ComprobanteDeposito } from '../../types';
import { supabase } from '../../../../lib/supabase';
import { getMetodoPagoLabel } from '../../../../lib/constants/sat';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';
import CargasTab from './CargasTab';
import { generarSaldoFavorDesdeConciliacion } from '../../proveedores/proveedoresActions';
import { esComisionTpv, esComisionBancaria } from '../commissionUtils';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import {
  actualizarCategoriaMovimientos,
  depurarMovimientosDuplicadosAction,
  obtenerPropuestasAutoConciliacion,
  aplicarPropuestasConciliacion,
  PropuestaConciliacionItem
} from '../reconciliationActions';
import AutoConciliacionModal from './AutoConciliacionModal';
import HistorialConciliacionModal from './HistorialConciliacionModal';

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
  numero_pedido?: string | null;
  folio_factura?: string;
  precio_total: number;
  cliente_nombre?: string;
  fecha_pedido?: string;
  metodo_pago?: string;
  forma_pago?: string;
  uuid_fiscal?: string;
  clientes?: {
    nombre_local?: string;
    razon_social?: string;
    rfc?: string;
    [key: string]: any;
  } | null;
  nombreReceptor?: string;
  rfcReceptor?: string;
  rfc?: string;
  facturas_clientes?: any[];
  [key: string]: any;
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
  handleAutoReconcile?: () => void;

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
  formasPagoModal?: FormasPagoModalState;
  setFormasPagoModal?: React.Dispatch<React.SetStateAction<FormasPagoModalState>>;
  handleSaveFormaPago?: () => void;
  handleDeleteFormaPago?: (id: string) => void;

  // Archivos
  onDownloadFile: (url: string) => void;
  onViewCfdi?: (xmlUrl: string) => void;

  // Cuentas
  selectedCuentaId?: string;
  setSelectedCuentaId?: (id: string) => void;
  handleUnlinkReconciliation?: (movimientoId: string) => void;
  handleBulkMoveMovimientos?: (movimientoIds: string[], cuentaBancariaId: string | null) => Promise<void>;
  handleUpdateMesConciliacion?: (movimientoId: string, mes: string) => Promise<void>;

  comprobantes?: ComprobanteDeposito[];
  selectedMonth?: string;
  onCrearComprobante?: (payload: any) => Promise<any>;
  onActualizarComprobante?: (id: string, payload: any) => Promise<any>;
  onEliminarComprobante?: (id: string) => Promise<any>;
  onEliminarMultiplesComprobantes?: (ids: string[]) => Promise<any>;
  onVincularComprobante?: (comprobanteId: string, movimientoBancarioId: string, montoAsociado?: number) => Promise<any>;
  onDesvincularComprobante?: (comprobanteId: string, movimientoBancarioId?: string | null) => Promise<any>;
  onFusionarReembolso?: (movId1: string, movId2: string, payload: { soporteReembolsoUrl?: string | null; comentarios?: string | null }) => Promise<any>;
  onConsolidarComisiones?: () => void;
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
  cuentaId: string,
  categoriasCatalog: any[] = []
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
              String(p.numero_pedido ?? '').toLowerCase().includes(b) ||
              String(p.folio_factura ?? '').toLowerCase().includes(b) ||
              String(p.cliente_nombre ?? '').toLowerCase().includes(b) ||
              String(p.clientes?.nombre_local ?? '').toLowerCase().includes(b) ||
              String(p.clientes?.rfc ?? '').toLowerCase().includes(b) ||
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
    
    // Tipo filter (INCLUSIÓN: si hay seleccionados, debe coincidir con alguno)
    if (tiposSelected.length > 0) {
      const rawType = (m.tipo_movimiento || '').toLowerCase();
      const isRetiro = rawType === 'retiro' || rawType === 'cargo' || rawType === 'egreso' || Number(m.retiro || 0) > 0 || (Number(m.monto || 0) < 0);
      const isDeposito = rawType === 'deposito' || rawType === 'abono' || rawType === 'ingreso' || Number(m.deposito || 0) > 0 || (Number(m.monto || 0) > 0 && !isRetiro);

      const matchTipo = (isDeposito && tiposSelected.includes('Deposito')) || (isRetiro && tiposSelected.includes('Retiro'));
      if (!matchTipo) return false;
    }
    
    // Estatus filter (INCLUSIÓN: si hay seleccionados, debe coincidir con alguno)
    if (estatusSelected.length > 0) {
      const estatusClave = (m.estatus_conciliacion_bancaria?.clave || 'pendiente').toLowerCase();
      const rawEstatusId = m.estatus_conciliacion_id || m.estatus_conciliacion_bancaria?.id;
      const estatusId = rawEstatusId ? String(rawEstatusId) : '';
      const estatusNombre = (m.estatus_conciliacion_bancaria?.nombre || '').toLowerCase().trim();

      const matchEstatus = estatusSelected.some((sel) => {
        const selLow = String(sel).toLowerCase();
        const selStr = String(sel);
        if (selStr === estatusClave || (estatusId && selStr === estatusId) || selLow === estatusClave) return true;
        if (estatusNombre && selLow === estatusNombre) return true;
        if ((selLow === 'no_deducible' || selLow.includes('no_deducible')) && (esComisionTpv(m.concepto || '') || esComisionBancaria(m.concepto || ''))) {
          return true;
        }
        return false;
      });

      if (!matchEstatus) return false;
    } else {
      return false;
    }
    
    // Visibilidad filter (INCLUSIÓN: si hay seleccionados, debe coincidir con alguno)
    if (visibilidadesSelected.length > 0) {
      const isVisibleEgresos = !!m.visible_egresos;
      const isVisibleIngresos = !!m.visible_ingresos;
      const isOculto = !isVisibleEgresos && !isVisibleIngresos;

      const matchesVis =
        (visibilidadesSelected.includes('visibles_egresos') && isVisibleEgresos) ||
        (visibilidadesSelected.includes('visibles_ingresos') && isVisibleIngresos) ||
        (visibilidadesSelected.includes('ocultos') && isOculto);
      if (!matchesVis) return false;
    } else {
      return false;
    }

    // Categoría filter (INCLUSIÓN: los seleccionados se muestran, los desmarcados se ocultan)
    if (categoriasSelected.length > 0) {
      const rawCatId = m.categoria_movimiento_id || m.categoria_id || m.categorias_movimiento_bancario?.id;
      const catId = rawCatId ? String(rawCatId) : '';
      const catNombre = (m.categorias_movimiento_bancario?.nombre || '').trim().toLowerCase();
      
      const isTpvConcept = esComisionTpv(m.concepto || '', m.categorias_movimiento_bancario?.nombre);
      const isBancoConcept = esComisionBancaria(m.concepto || '', m.categorias_movimiento_bancario?.nombre);
      const isSinCat = !catId && !catNombre && !isTpvConcept && !isBancoConcept;

      // Obtener si TPV está seleccionada
      const tpvCatIds = (categoriasCatalog || [])
        .filter(c => {
          const n = (c.nombre || '').toLowerCase().trim();
          return n.includes('tpv') || n.includes('terminal') || n.includes('punto de venta');
        })
        .map(c => String(c.id));

      const isTpvSelected = tpvCatIds.length > 0
        ? tpvCatIds.every(id => categoriasSelected.includes(id) || categoriasSelected.includes(String(id))) || categoriasSelected.includes('comision_tpv')
        : (categoriasSelected.includes('comision_tpv') || categoriasSelected.includes('cat-tpv'));

      // Obtener si Comisión Bancaria está seleccionada
      const bancoCatIds = (categoriasCatalog || [])
        .filter(c => {
          const n = (c.nombre || '').toLowerCase().trim();
          return (n.includes('comisión') || n.includes('comision')) && (n.includes('bancari') || n.includes('banco'));
        })
        .map(c => String(c.id));

      const isBancoSelected = bancoCatIds.length > 0
        ? bancoCatIds.every(id => categoriasSelected.includes(id) || categoriasSelected.includes(String(id))) || categoriasSelected.includes('comision_banco')
        : (categoriasSelected.includes('comision_banco') || categoriasSelected.includes('cat-banco'));

      // Obtener si Nómina está seleccionada
      const nominaCatIds = (categoriasCatalog || [])
        .filter(c => {
          const n = (c.nombre || '').toLowerCase().trim();
          return n.includes('nomina') || n.includes('nómina') || n.includes('sueldo');
        })
        .map(c => String(c.id));

      const isNominaSelected = nominaCatIds.length > 0
        ? nominaCatIds.some(id => categoriasSelected.includes(id) || categoriasSelected.includes(String(id))) || categoriasSelected.includes('comision_nomina')
        : (categoriasSelected.includes('comision_nomina') || categoriasSelected.includes('cat-nomina'));

      // Obtener si Traspasos está seleccionada
      const traspasoCatIds = (categoriasCatalog || [])
        .filter(c => {
          const n = (c.nombre || '').toLowerCase().trim();
          return n.includes('traspaso');
        })
        .map(c => String(c.id));

      const isTraspasoSelected = traspasoCatIds.length > 0
        ? traspasoCatIds.some(id => categoriasSelected.includes(id) || categoriasSelected.includes(String(id))) || categoriasSelected.includes('comision_traspaso')
        : (categoriasSelected.includes('comision_traspaso') || categoriasSelected.includes('cat-traspaso'));

      let matchesCat = false;

      // Caso 1: TPV (por concepto o por nombre de categoría)
      if (isTpvConcept || catNombre.includes('tpv') || catNombre.includes('terminal')) {
        matchesCat = isTpvSelected;
      }
      // Caso 2: Comisión Bancaria (por concepto o por nombre de categoría)
      else if (isBancoConcept || catNombre.includes('bancari')) {
        matchesCat = isBancoSelected;
      }
      // Caso 3: Nómina (por concepto o por nombre de categoría)
      else if (catNombre.includes('nomina') || catNombre.includes('sueldo') || (m.concepto || '').toUpperCase().includes('NOMINA')) {
        matchesCat = isNominaSelected;
      }
      // Caso 4: Traspasos (por concepto o por nombre de categoría)
      else if (catNombre.includes('traspaso') || (m.concepto || '').toUpperCase().includes('TRASPASO')) {
        matchesCat = isTraspasoSelected;
      }
      // Caso 5: Sin Categoría
      else if (isSinCat) {
        matchesCat = categoriasSelected.includes('sin_categoria');
      }
      // Caso 6: Categoría asignada específica
      else {
        const matchesById = catId ? (categoriasSelected.includes(catId) || categoriasSelected.includes(String(catId))) : false;
        const matchesByName = catNombre
          ? (categoriasCatalog || []).some(c => (c.nombre || '').trim().toLowerCase() === catNombre && (categoriasSelected.includes(c.id) || categoriasSelected.includes(String(c.id))))
          : false;

        matchesCat = matchesById || matchesByName;
      }

      if (!matchesCat) return false;
    } else {
      // Si explícitamente se desmarcaron todas las categorías, no mostrar nada
      return false;
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
  selectedCuentaId: propSelectedCuentaId,
  setSelectedCuentaId: propSetSelectedCuentaId,
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
  onConsolidarComisiones,
}: BancoTabProps) {
  const router = useRouter();
  const { openCfdi } = useCfdiViewer();
  const handleViewCfdi = onViewCfdi || openCfdi;
  const getSessionToken = useSessionToken();

  const [internalSelectedCuentaId, setInternalSelectedCuentaId] = React.useState('');
  const selectedCuentaId = propSelectedCuentaId !== undefined ? propSelectedCuentaId : internalSelectedCuentaId;
  const setSelectedCuentaId = React.useCallback((id: string) => {
    setInternalSelectedCuentaId(id);
    if (propSetSelectedCuentaId) {
      propSetSelectedCuentaId(id);
    }
  }, [propSetSelectedCuentaId]);

  const [tiposSelected, setTiposSelected] = React.useState<string[]>(['Deposito', 'Retiro']);
  const [filtroTipoRapido, setFiltroTipoRapido] = React.useState<'todos' | 'egresos' | 'ingresos'>('todos');
  const [filtroEspecial, setFiltroEspecial] = React.useState<'todos' | 'discrepancias' | 'multi_pagos' | 'saldo_diferencia' | 'conciliados'>('todos');
  const [historialMovimiento, setHistorialMovimiento] = React.useState<any | null>(null);
  const [estatusSelected, setEstatusSelected] = React.useState<string[]>([]);
  const [visibilidadesSelected, setVisibilidadesSelected] = React.useState<string[]>(['visibles_egresos', 'visibles_ingresos', 'ocultos']);
  const [categoriasSelected, setCategoriasSelected] = React.useState<string[]>([]);
  const [selectedMovimientos, setSelectedMovimientos] = React.useState<string[]>([]);
  const [showFiltrosAvanzados, setShowFiltrosAvanzados] = React.useState<boolean>(false);
  const [guardarExcedenteComoSaldoFavor, setGuardarExcedenteComoSaldoFavor] = React.useState<boolean>(false);
  const [ingresosSubSeccion, setIngresosSubSeccion] = React.useState<'comprobantes' | 'global' | 'factura_publico'>('comprobantes');
  const [compSubFiltro, setCompSubFiltro] = React.useState<'todos' | 'tickets' | 'depositos'>('todos');

  const filteredComprobantes = React.useMemo(() => {
    return comprobantes.filter(c => {
      if (compSubFiltro === 'tickets' && c.tipo === 'deposito_ventanilla') return false;
      if (compSubFiltro === 'depositos' && c.tipo !== 'deposito_ventanilla') return false;
      if (!selectedCuentaId) return true;

      const selCuenta = cuentasBancarias?.find(cb => cb.id === selectedCuentaId);
      const isCaja = selCuenta?.nombre?.toUpperCase().includes('CAJA CHICA') || selCuenta?.nombre?.toUpperCase().includes('EFECTIVO');
      const isParrot = selCuenta?.nombre?.toUpperCase().includes('PARROT');
      const isBBVA = selCuenta?.nombre?.toUpperCase().includes('BBVA');

      // Si el comprobante ya tiene una cuenta bancaria asignada
      if (c.cuenta_bancaria_id) {
        if (c.cuenta_bancaria_id === selectedCuentaId) return true;
        // Si es un corte con efectivo y la cuenta seleccionada es Caja Chica
        if (isCaja && (Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0)) return true;
        return false;
      }

      // Si no tiene cuenta_bancaria_id explícita:
      if (isCaja && (Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0)) return true;
      if (isParrot && (Number(c.monto_parrotpay || 0) > 0 || Number(c.propina_parrotpay || 0) > 0 || c.tipo === 'corte_parrot')) return true;

      if (isBBVA) {
        if (c.tipo === 'corte_parrot') return false;
        const tarjetaTotalBBVA = Number(c.monto_debito || 0) + Number(c.propina_debito || 0) + Number(c.monto_credito || 0) + Number(c.propina_credito || 0) + Number(c.monto_amex || 0) + Number(c.propina_amex || 0);
        if (tarjetaTotalBBVA > 0 || c.tipo === 'corte_bbva') return true;
      }

      return false;
    });
  }, [comprobantes, compSubFiltro, selectedCuentaId, cuentasBancarias]);
  const [modoConciliacionIngreso, setModoConciliacionIngreso] = React.useState<'pedidos' | 'fichas'>('fichas');
  const [selectedGlobalDepositIds, setSelectedGlobalDepositIds] = React.useState<string[]>([]);
  const [selectedGlobalComprobanteIds, setSelectedGlobalComprobanteIds] = React.useState<string[]>([]);
  const [conciliacionMasivaModal, setConciliacionMasivaModal] = React.useState<{
    open: boolean,
    comprobantes: string[],
    movimientos: string[],
    loading: boolean,
    error: string,
    result: any
  }>({ open: false, comprobantes: [], movimientos: [], loading: false, error: '', result: null });

  const [depurandoDuplicados, setDepurandoDuplicados] = React.useState<boolean>(false);

  const handleDepurarDuplicados = async () => {
    if (!confirm('¿Deseas buscar y eliminar movimientos bancarios duplicados (por misma referencia bancaria o misma fecha/concepto/monto)? Se conservará siempre el registro conciliado o el más antiguo.')) {
      return;
    }
    setDepurandoDuplicados(true);
    try {
      const activeToken = token || (await getSessionToken());
      const res = await depurarMovimientosDuplicadosAction(activeToken);
      if (res.success) {
        alert(res.message || `Se depuraron ${res.countDeleted || 0} movimientos duplicados.`);
        if (onReloadMovimientos) onReloadMovimientos();
        else router.refresh();
      } else {
        alert(`Error al depurar duplicados: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error al depurar duplicados: ${err.message || err}`);
    } finally {
      setDepurandoDuplicados(false);
    }
  };

  // Estados de Agrupación Visual Desplegable para Categorías y Comisiones
  const [agruparVisual, setAgruparVisual] = React.useState<boolean>(true);
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});
  const [expandedTpv, setExpandedTpv] = React.useState<boolean>(false);
  const [expandedBanco, setExpandedBanco] = React.useState<boolean>(false);
  const [expandedTpvAtemporal, setExpandedTpvAtemporal] = React.useState<boolean>(false);
  const [expandedBancoAtemporal, setExpandedBancoAtemporal] = React.useState<boolean>(false);

  // Estados de Auto-Conciliación Inteligente con Propuestas
  const [autoConciliacionModalOpen, setAutoConciliacionModalOpen] = React.useState<boolean>(false);
  const [propuestasAutoConciliacion, setPropuestasAutoConciliacion] = React.useState<PropuestaConciliacionItem[]>([]);
  const [loadingPropuestas, setLoadingPropuestas] = React.useState<boolean>(false);
  const [isApplyingPropuestas, setIsApplyingPropuestas] = React.useState<boolean>(false);

  const handleOpenAutoConciliacion = async () => {
    if (!selectedCuentaId) {
      alert('Por favor selecciona una cuenta bancaria.');
      return;
    }
    setLoadingPropuestas(true);
    setAutoConciliacionModalOpen(true);
    try {
      const activeToken = token || (await getSessionToken());
      const res = await obtenerPropuestasAutoConciliacion(activeToken, selectedCuentaId, selectedMonth);
      if (res.success && res.propuestas) {
        setPropuestasAutoConciliacion(res.propuestas);
      } else {
        alert(res.error || 'Error al obtener propuestas');
        setAutoConciliacionModalOpen(false);
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || String(err)));
      setAutoConciliacionModalOpen(false);
    } finally {
      setLoadingPropuestas(false);
    }
  };

  const handleApplyPropuestas = async (selected: PropuestaConciliacionItem[]) => {
    if (selected.length === 0) return;
    setIsApplyingPropuestas(true);
    try {
      const activeToken = token || (await getSessionToken());
      const res = await aplicarPropuestasConciliacion(selected, activeToken);
      if (res.success) {
        alert(`¡Conciliación exitosa! Se conciliaron ${res.appliedCount} movimientos.`);
        setAutoConciliacionModalOpen(false);
        if (onReloadMovimientos) onReloadMovimientos();
        else router.refresh();
      } else {
        alert('Error al aplicar conciliaciones: ' + (res.error || 'Error desconocido'));
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || String(err)));
    } finally {
      setIsApplyingPropuestas(false);
    }
  };

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
  const [tiposAtemporalSelected, setTiposAtemporalSelected] = React.useState<string[]>(['Deposito', 'Retiro']);
  const [estatusAtemporalSelected, setEstatusAtemporalSelected] = React.useState<string[]>(['no_deducible', 'pendiente', 'parcial', 'conciliado_post_cierre', 'conciliado']);
  const [ciclosAtemporalSelected, setCiclosAtemporalSelected] = React.useState<string[]>(['cerrado_definitivo', 'pre_cerrado', 'abierto']);
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

  const getCatName = React.useCallback((m: any) => {
    return m.categorias_movimiento_bancario?.nombre || (categoriasMovimiento?.find(c => c.id === (m.categoria_movimiento_id || m.categoria_id))?.nombre || '');
  }, [categoriasMovimiento]);

  const uniqueCategoriasMovimiento = React.useMemo(() => {
    const map = new Map<string, any>();

    const hasTpvInCat = (categoriasMovimiento || []).some(c => {
      const n = (c.nombre || '').toLowerCase();
      return n.includes('tpv') || n.includes('terminal') || n.includes('punto de venta');
    });

    const hasBancoInCat = (categoriasMovimiento || []).some(c => {
      const n = (c.nombre || '').toLowerCase();
      return n.includes('bancari') || n.includes('banco');
    });

    const hasNominaInCat = (categoriasMovimiento || []).some(c => {
      const n = (c.nombre || '').toLowerCase();
      return n.includes('nomina') || n.includes('nómina') || n.includes('sueldo');
    });

    const hasTraspasoInCat = (categoriasMovimiento || []).some(c => {
      const n = (c.nombre || '').toLowerCase();
      return n.includes('traspaso');
    });

    if (!hasTpvInCat) {
      map.set('comisión tpv', { id: 'comision_tpv', nombre: 'Comisión TPV' });
    }

    if (!hasBancoInCat) {
      map.set('comisión bancaria', { id: 'comision_banco', nombre: 'Comisión Bancaria' });
    }

    if (!hasNominaInCat) {
      map.set('nómina y sueldos', { id: 'comision_nomina', nombre: 'Nómina y Sueldos' });
    }

    if (!hasTraspasoInCat) {
      map.set('traspasos entre cuentas', { id: 'comision_traspaso', nombre: 'Traspasos entre Cuentas' });
    }

    (categoriasMovimiento || []).forEach(c => {
      const key = (c.nombre || '').toLowerCase().trim();
      if (key && !map.has(key)) {
        map.set(key, c);
      }
    });

    return Array.from(map.values());
  }, [categoriasMovimiento]);

  // Auto-seleccionar por defecto todos los estatus y categorías
  const estatusInitRef = React.useRef(false);
  React.useEffect(() => {
    if (estatusCatalog && estatusCatalog.length > 0 && !estatusInitRef.current) {
      estatusInitRef.current = true;
      const allClaves = Array.from(new Set(estatusCatalog.map(e => e.clave).filter(Boolean)));
      setEstatusSelected(allClaves);
    }
  }, [estatusCatalog]);

  const catInitRef = React.useRef(false);
  React.useEffect(() => {
    if (uniqueCategoriasMovimiento && uniqueCategoriasMovimiento.length > 0 && !catInitRef.current) {
      catInitRef.current = true;
      const allCats = Array.from(new Set(['sin_categoria', ...uniqueCategoriasMovimiento.flatMap(c => [c.id, String(c.id)])]));
      setCategoriasSelected(allCats);
      setCategoriasAtemporalSelected(allCats);
    }
  }, [uniqueCategoriasMovimiento]);

  const isMovRetiro = React.useCallback((m: any) => {
    const rawType = (m.tipo_movimiento || '').toLowerCase();
    return rawType === 'retiro' || rawType === 'cargo' || rawType === 'egreso' || Number(m.retiro || 0) > 0 || Number(m.monto || 0) < 0;
  }, []);

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
      const isNoDeducibleStatus = clave === 'no_deducible' || clave === 'pendiente';
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
        if (filtroEstatusNoDeducible === 'sin_comprobar' && clave === 'conciliado' && !hasPostCloseNote) return false;
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

  const allTpvAtemporal = React.useMemo(() => {
    return atemporalNoDeducibles.filter((m: any) => isMovRetiro(m) && (esComisionTpv(m.concepto, getCatName(m)) || (m.concepto || '').includes('Total de comisiones TPV')));
  }, [atemporalNoDeducibles, isMovRetiro, getCatName]);

  const allBancoAtemporal = React.useMemo(() => {
    return atemporalNoDeducibles.filter((m: any) => isMovRetiro(m) && (esComisionBancaria(m.concepto, getCatName(m)) || (m.concepto || '').includes('Total de comisiones bancarias')));
  }, [atemporalNoDeducibles, isMovRetiro, getCatName]);

  const totalTpvAtemporalMonto = React.useMemo(() => {
    return allTpvAtemporal.reduce((sum: number, m: any) => sum + Math.abs(Number(m.monto || m.retiro || 0)), 0);
  }, [allTpvAtemporal]);

  const totalBancoAtemporalMonto = React.useMemo(() => {
    return allBancoAtemporal.reduce((sum: number, m: any) => sum + Math.abs(Number(m.monto || m.retiro || 0)), 0);
  }, [allBancoAtemporal]);

  const regularAtemporal = React.useMemo(() => {
    if (!agruparVisual) return atemporalNoDeducibles;
    const tpvIds = new Set(allTpvAtemporal.map(m => m.id));
    const bancoIds = new Set(allBancoAtemporal.map(m => m.id));
    return atemporalNoDeducibles.filter((m: any) => !tpvIds.has(m.id) && !bancoIds.has(m.id));
  }, [atemporalNoDeducibles, agruparVisual, allTpvAtemporal, allBancoAtemporal]);

  const activeAtemporalList = agruparVisual ? regularAtemporal : atemporalNoDeducibles;
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
    return activeAtemporalList.slice(start, start + pageSizeAtemporal);
  }, [activeAtemporalList, pageAtemporal, pageSizeAtemporal]);

  const totalPaginasAtemporal = Math.max(1, Math.ceil(activeAtemporalList.length / pageSizeAtemporal));

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

  const [parrotGroups, setParrotGroups] = React.useState<any[]>([]);
  const [isParrotUploading, setIsParrotUploading] = React.useState(false);
  const parrotFileInputRef = React.useRef<HTMLInputElement>(null);
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
          if (path === 'no_lleva') {
            return (
              <div key={idx} className="flex justify-between items-center bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded border border-amber-300 dark:border-amber-700 text-[10px] font-sans">
                <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  🚫 Sin Ticket (Para Expediente)
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveReconciliationFile && handleRemoveReconciliationFile(field, idx)}
                  className="text-red-500 hover:text-red-600 text-[9px] uppercase font-bold hover:underline cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            );
          }
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
      return hasTicket ? 'conciliado' : 'parcial';
    } else {
      const hasInvoice = (reconcileModal.movimiento?.tipo_movimiento === 'Deposito') || (gastosIds.length > 0) || (pedidosIds.length > 0);
      if (!hasInvoice) {
        return 'no_deducible';
      } else if (hasXml) {
        return 'conciliado';
      } else {
        return 'parcial';
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

  const handleSingleUpdateCategory = async (movimientoId: string, categoriaId: string) => {
    if (handleUpdateCategoria) {
      handleUpdateCategoria(movimientoId, categoriaId);
      return;
    }
    try {
      const activeToken = token || (await getSessionToken());
      const catId = (!categoriaId || categoriaId === '' || categoriaId === 'SIN_CATEGORIA') ? null : categoriaId;
      const res = await actualizarCategoriaMovimientos([movimientoId], catId, activeToken);
      if (!res.success) throw new Error(res.error);
      if (onReloadMovimientos) {
        onReloadMovimientos();
      }
    } catch (err: any) {
      alert(`Error al asignar categoría: ${err.message}`);
    }
  };

  const handleBulkUpdateCategory = async (categoriaId: string) => {
    if (selectedMovimientos.length === 0) return;
    const catId = (!categoriaId || categoriaId === '' || categoriaId === 'SIN_CATEGORIA') ? null : categoriaId;
    try {
      const activeToken = token || (await getSessionToken());
      const res = await actualizarCategoriaMovimientos(selectedMovimientos, catId, activeToken);
      if (!res.success) throw new Error(res.error);
      
      const movedIds = [...selectedMovimientos];
      setSelectedMovimientos([]);
      
      if (onReloadMovimientos) {
        onReloadMovimientos();
      } else if (handleUpdateCategoria) {
        movedIds.forEach(id => handleUpdateCategoria(id, categoriaId === 'SIN_CATEGORIA' ? '' : categoriaId));
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

  const baseFiltered = filterMovimientos(
    movimientos, 
    busquedaBanco, 
    tiposSelected, 
    estatusSelected, 
    visibilidadesSelected, 
    categoriasSelected, 
    selectedCuentaId,
    categoriasMovimiento || []
  );

  const filtered = React.useMemo(() => {
    let res = baseFiltered;
    if (filtroTipoRapido === 'egresos') {
      res = res.filter(m => isMovRetiro(m));
    } else if (filtroTipoRapido === 'ingresos') {
      res = res.filter(m => !isMovRetiro(m));
    }

    if (filtroEspecial === 'discrepancias') {
      res = res.filter(m => {
        const c = (m.concepto || '').toUpperCase();
        const isCashBanco = c.includes('EFECTIVO') || c.includes('CAJERO') || c.includes('RETIRO CAJERO') || c.includes('DEPOSITO CAJERO') || c.includes('PRACTICAJA');
        const isCardBanco = c.includes('TARJETA') || c.includes('PAGO CON TARJETA') || c.includes('TDC') || c.includes('T.DEB') || c.includes('POS');
        const conList = m.conciliaciones_bancarias || [];
        return conList.some((link: any) => {
          const item = link.gasto || link.pedido;
          const mp = item?.metodo_pago;
          if (!mp) return false;
          const cleanMp = String(mp).trim().padStart(2, '0');
          if (isCashBanco && cleanMp !== '01') return true;
          if (isCardBanco && cleanMp !== '04' && cleanMp !== '28') return true;
          return false;
        });
      });
    } else if (filtroEspecial === 'multi_pagos') {
      res = res.filter(m => {
        const conList = m.conciliaciones_bancarias || [];
        return conList.some((link: any) => {
          const targetId = link.gasto?.id || link.pedido?.id;
          if (!targetId) return false;
          return movimientos.some((otherM: any) => 
            otherM.id !== m.id && otherM.conciliaciones_bancarias?.some((ol: any) => (ol.gasto?.id === targetId || ol.pedido?.id === targetId))
          );
        });
      });
    } else if (filtroEspecial === 'saldo_diferencia') {
      res = res.filter(m => {
        const conList = m.conciliaciones_bancarias || [];
        if (conList.length === 0) return false;
        const totalAsoc = conList.reduce((sum: number, l: any) => sum + Number(l.monto_asociado || l.gasto?.monto || l.pedido?.precio_total || 0), 0);
        const movMonto = Math.abs(Number(m.monto || m.retiro || m.deposito || 0));
        return Math.abs(movMonto - totalAsoc) > 0.05;
      });
    } else if (filtroEspecial === 'conciliados') {
      res = res.filter(m => (m.conciliaciones_bancarias && m.conciliaciones_bancarias.length > 0) || (m.estatus_conciliacion_bancaria?.clave === 'conciliado'));
    }

    return res;
  }, [baseFiltered, filtroTipoRapido, filtroEspecial, isMovRetiro, movimientos]);

  const countTodos = baseFiltered.length;
  const egresosList = React.useMemo(() => baseFiltered.filter(m => isMovRetiro(m)), [baseFiltered, isMovRetiro]);
  const ingresosList = React.useMemo(() => baseFiltered.filter(m => !isMovRetiro(m)), [baseFiltered, isMovRetiro]);
  const countEgresos = egresosList.length;
  const countIngresos = ingresosList.length;
  const totalEgresosMonto = React.useMemo(() => egresosList.reduce((acc, m) => acc + Math.abs(Number(m.monto || m.retiro || 0)), 0), [egresosList]);
  const totalIngresosMonto = React.useMemo(() => ingresosList.reduce((acc, m) => acc + Math.abs(Number(m.monto || m.deposito || 0)), 0), [ingresosList]);

  const isSupplierOrSale = React.useCallback((catName: string) => {
    if (!catName) return false;
    const cn = catName.toUpperCase().trim();
    return (
      cn.includes('PROVEEDOR') ||
      cn.includes('PROVEEDORES') ||
      cn.includes('COMPRA') ||
      cn.includes('GASTO FACTURADO') ||
      cn.includes('FACTURA') ||
      cn.includes('VENTA') ||
      cn.includes('CLIENTE')
    );
  }, []);

  const accumulatedGroups = React.useMemo(() => {
    if (!agruparVisual) return [];

    const groupMap = new Map<string, {
      key: string;
      title: string;
      categoryName: string;
      theme: 'rose' | 'indigo' | 'purple' | 'blue' | 'amber' | 'cyan' | 'emerald';
      iconType: 'tpv' | 'banco' | 'nomina' | 'traspaso' | 'prestamo' | 'ajuste' | 'otro';
      movimientos: MovimientoBancario[];
      totalMonto: number;
      isRetiro: boolean;
    }>();

    filtered.forEach(m => {
      const isRet = isMovRetiro(m);
      const catName = getCatName(m);

      // Si es Pago a Proveedor, Cobro de Venta o Facturado, NO se acumula (permanece en la lista regular)
      if (isSupplierOrSale(catName)) {
        return;
      }

      let groupKey = '';
      let groupTitle = '';
      let theme: 'rose' | 'indigo' | 'purple' | 'blue' | 'amber' | 'cyan' | 'emerald' = 'purple';
      let iconType: 'tpv' | 'banco' | 'nomina' | 'traspaso' | 'prestamo' | 'ajuste' | 'otro' = 'otro';

      if (isRet && (esComisionTpv(m.concepto, catName) || (m.concepto || '').includes('Total de comisiones TPV'))) {
        groupKey = 'cat-tpv';
        groupTitle = 'Total de Comisiones TPV';
        theme = 'rose';
        iconType = 'tpv';
      } else if (isRet && (esComisionBancaria(m.concepto, catName) || (m.concepto || '').includes('Total de comisiones bancarias'))) {
        groupKey = 'cat-banco';
        groupTitle = 'Total de Comisiones Bancarias';
        theme = 'indigo';
        iconType = 'banco';
      } else if (catName && catName.trim() !== '') {
        const cn = catName.toUpperCase();
        if (cn.includes('NOMINA') || cn.includes('NÓMINA') || cn.includes('SUELDO') || cn.includes('SALARIO')) {
          groupKey = 'cat-nomina';
          groupTitle = 'Total de Nómina y Sueldos';
          theme = 'purple';
          iconType = 'nomina';
        } else if (cn.includes('TRASPASO')) {
          groupKey = 'cat-traspaso';
          groupTitle = 'Total de Traspasos entre Cuentas';
          theme = 'blue';
          iconType = 'traspaso';
        } else if (cn.includes('PRESTAMO') || cn.includes('PRÉSTAMO')) {
          groupKey = 'cat-prestamo';
          groupTitle = 'Total de Préstamos Bancarios';
          theme = 'amber';
          iconType = 'prestamo';
        } else if (cn.includes('AJUSTE')) {
          groupKey = 'cat-ajuste';
          groupTitle = 'Total de Ajustes Contables';
          theme = 'cyan';
          iconType = 'ajuste';
        } else {
          groupKey = `cat-${catName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          groupTitle = `Total de ${catName}`;
          theme = 'emerald';
          iconType = 'otro';
        }
      }

      if (groupKey) {
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            key: groupKey,
            title: groupTitle,
            categoryName: catName || groupTitle.replace('Total de ', ''),
            theme,
            iconType,
            movimientos: [],
            totalMonto: 0,
            isRetiro: isRet
          });
        }
        const grp = groupMap.get(groupKey)!;
        grp.movimientos.push(m);
        grp.totalMonto += Math.abs(Number(m.monto || m.retiro || m.deposito || 0));
      }
    });

    return Array.from(groupMap.values()).filter(g => g.movimientos.length > 0);
  }, [filtered, agruparVisual, isMovRetiro, getCatName, isSupplierOrSale]);

  const accumulatedMovIds = React.useMemo(() => {
    if (!agruparVisual) return new Set<string>();
    const set = new Set<string>();
    accumulatedGroups.forEach(g => {
      g.movimientos.forEach(m => set.add(m.id));
    });
    return set;
  }, [accumulatedGroups, agruparVisual]);

  const allTpvMovs = React.useMemo(() => {
    return (accumulatedGroups.find(g => g.key === 'cat-tpv')?.movimientos) || [];
  }, [accumulatedGroups]);

  const allBancoMovs = React.useMemo(() => {
    return (accumulatedGroups.find(g => g.key === 'cat-banco')?.movimientos) || [];
  }, [accumulatedGroups]);

  const regularFiltered = React.useMemo(() => {
    if (!agruparVisual) return filtered;
    return filtered.filter(m => !accumulatedMovIds.has(m.id));
  }, [filtered, agruparVisual, accumulatedMovIds]);

  const activeFilteredList = agruparVisual ? regularFiltered : filtered;
  const paginated = activeFilteredList.slice(bancoPage * bancoPageSize, (bancoPage + 1) * bancoPageSize);
  const totalPages = Math.max(1, Math.ceil(activeFilteredList.length / bancoPageSize));

  const handleParrotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true, dateNF: 'dd/mm/yyyy' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false, dateNF: 'dd/mm/yyyy' }) as any[];

          if (rawData.length === 0) {
            alert('El archivo está vacío.');
            return;
          }

          const groups = new Map<string, any>();

          rawData.forEach(row => {
            const keys = Object.keys(row);
            const getVal = (possibleKeys: string[]) => {
              for (const k of keys) {
                if (possibleKeys.some(pk => k.toLowerCase().includes(pk))) {
                  return row[k];
                }
              }
              return '';
            };

            const rawFecha = getVal(['fecha', 'date']);
            if (!rawFecha) return;

            let yyyyMmDd = '';
            if (rawFecha instanceof Date) {
              yyyyMmDd = rawFecha.toISOString().substring(0, 10);
            } else {
              const str = String(rawFecha).trim().split(' ')[0];
              if (str.includes('/')) {
                const parts = str.split('/');
                if (parts.length === 3) {
                  if (parts[2].length === 4) {
                    yyyyMmDd = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                  } else if (parts[0].length === 4) {
                    yyyyMmDd = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                  }
                }
              } else if (str.includes('-')) {
                const parts = str.split('-');
                if (parts.length === 3) {
                  if (parts[0].length === 4) {
                    yyyyMmDd = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                  } else if (parts[2].length === 4) {
                    yyyyMmDd = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                  }
                }
              } else {
                yyyyMmDd = str;
              }
            }

            if (!yyyyMmDd || yyyyMmDd.length < 8) return;

            const tipoPago = String(getVal(['tipo de pago', 'type']) || '').toLowerCase();
            const parseNum = (val: any) => {
              if (typeof val === 'number') return isNaN(val) ? 0 : val;
              if (!val) return 0;
              const clean = String(val).replace(/[^0-9.-]/g, '');
              const n = parseFloat(clean);
              return isNaN(n) ? 0 : n;
            };

            const propina = parseNum(getVal(['propina', 'tip']));
            const totalSinPropina = parseNum(getVal(['total sin propina', 'subtotal']));
            const rawTotal = parseNum(getVal(['total']));
            const total = rawTotal > 0 ? rawTotal : (totalSinPropina + propina);

            if (!groups.has(yyyyMmDd)) {
              groups.set(yyyyMmDd, {
                fecha: yyyyMmDd,
                montoCredito: 0,
                propinaCredito: 0,
                montoDebito: 0,
                propinaDebito: 0,
                montoEfectivo: 0,
                propinaEfectivo: 0,
                montoParrotpay: 0,
                propinaParrotpay: 0,
                totalAgrupado: 0
              });
            }

            const g = groups.get(yyyyMmDd);
            
            if (tipoPago.includes('crédito') || tipoPago.includes('credito')) {
              g.montoCredito += totalSinPropina;
              g.propinaCredito += propina;
            } else if (tipoPago.includes('débito') || tipoPago.includes('debito')) {
              g.montoDebito += totalSinPropina;
              g.propinaDebito += propina;
            } else if (tipoPago.includes('efectivo')) {
              g.montoEfectivo += totalSinPropina;
              g.propinaEfectivo += propina;
            } else {
              g.montoParrotpay += totalSinPropina;
              g.propinaParrotpay += propina;
            }
            g.totalAgrupado += total;
          });

          const sortedGroups = Array.from(groups.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
          setParrotGroups(sortedGroups);
        } catch (innerErr: any) {
          console.error(innerErr);
          alert('Error analizando archivo Parrot: ' + innerErr.message);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      console.error(err);
      alert('Error cargando archivo: ' + err.message);
    }
  };

  const handleBulkInsertParrot = async () => {
    if (!onCrearComprobante) {
      alert('Error: la función para crear comprobantes no está disponible.');
      return;
    }

    const parrotCuenta = cuentasBancarias?.find(c => 
      (c.nombre_banco || '').toLowerCase().includes('parrot') || 
      (c.alias || '').toLowerCase().includes('parrot') || 
      (c.nombre || '').toLowerCase().includes('parrot')
    );

    if (!parrotCuenta) {
      if (!confirm('No se encontró una cuenta bancaria con el nombre "Parrot". Los comprobantes se guardarán sin cuenta bancaria asociada. ¿Deseas continuar?')) {
        return;
      }
    }

    setIsParrotUploading(true);
    let successCount = 0;
    let errorCount = 0;
    let lastError = '';

    try {
      for (const g of parrotGroups) {
        const mCredito = Number(g.montoCredito || 0);
        const pCredito = Number(g.propinaCredito || 0);
        const mDebito = Number(g.montoDebito || 0);
        const pDebito = Number(g.propinaDebito || 0);
        const mEfectivo = Number(g.montoEfectivo || 0);
        const pEfectivo = Number(g.propinaEfectivo || 0);
        const mParrotpay = Number(g.montoParrotpay || 0);
        const pParrotpay = Number(g.propinaParrotpay || 0);

        const tot = mCredito + pCredito + mDebito + pDebito + mEfectivo + pEfectivo + mParrotpay + pParrotpay;

        const payload = {
          tipo: 'corte_parrot',
          fecha: g.fecha,
          monto: tot > 0 ? tot : Number(g.totalAgrupado || 0),
          monto_credito: mCredito,
          propina_credito: pCredito,
          monto_debito: mDebito,
          propina_debito: pDebito,
          monto_efectivo: mEfectivo,
          propina_efectivo: pEfectivo,
          monto_parrotpay: mParrotpay,
          propina_parrotpay: pParrotpay,
          montoCredito: String(mCredito),
          propinaCredito: String(pCredito),
          montoDebito: String(mDebito),
          propinaDebito: String(pDebito),
          montoEfectivo: String(mEfectivo),
          propinaEfectivo: String(pEfectivo),
          montoParrotpay: String(mParrotpay),
          propinaParrotpay: String(pParrotpay),
          descripcion: `Corte Parrot POS - Ventas ${g.fecha}`,
          cuenta_bancaria_id: parrotCuenta ? parrotCuenta.id : null,
          cuentaBancariaId: parrotCuenta ? parrotCuenta.id : null,
          storage_provider: 'Supabase',
          storageProvider: 'Supabase'
        };

        const res = await onCrearComprobante(payload);
        if (res && res.error) {
          console.error('Error insertando comprobante Parrot:', res.error);
          errorCount++;
          lastError = res.error;
        } else {
          successCount++;
        }
      }

      if (onReloadMovimientos) {
        await onReloadMovimientos();
      }

      if (errorCount > 0) {
        alert(`Se procesaron los comprobantes:\n✓ ${successCount} guardados correctamente\n✗ ${errorCount} fallaron (${lastError})`);
      } else {
        alert(`Se registraron ${successCount} comprobantes de Parrot exitosamente.`);
      }
      setParrotGroups([]);
    } catch (err: any) {
      console.error(err);
      alert('Ocurrió un error al guardar los comprobantes masivos: ' + err.message);
    } finally {
      setIsParrotUploading(false);
    }
  };


  return (
    <div className="flex flex-col flex-1 font-sans overflow-hidden">
      <div className="flex-1 overflow-y-auto flex flex-col min-h-0">

        {/* ── SUB-TAB 1: MOVIMIENTOS ───────────────────────────────────────── */}
        {bancoSubTab === 'movimientos' && (
          <div className="flex-1 flex flex-col gap-4 p-4 overflow-hidden min-h-0">
            {/* Tabla de movimientos */}
            <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              {/* Filtros y Selector de Egresos/Ingresos */}
              <div className="p-3.5 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-3.5 shrink-0">
                
                {/* SELECTOR SEGMENTADO: TODOS | EGRESOS / RETIROS | INGRESOS / DEPÓSITOS */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-gray-200/70 dark:bg-gray-900 p-1 rounded-xl border border-gray-250 dark:border-gray-800 shadow-xs">
                    <button
                      type="button"
                      onClick={() => { setFiltroTipoRapido('todos'); setBancoPage(0); }}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        filtroTipoRapido === 'todos'
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs font-black'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <List size={13} />
                      <span>Todos ({countTodos})</span>
                    </button>

                    {filtroBancoTipo !== 'Deposito' && (
                      <button
                        type="button"
                        onClick={() => { setFiltroTipoRapido('egresos'); setBancoPage(0); }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          filtroTipoRapido === 'egresos'
                            ? 'bg-red-600 text-white shadow-sm font-black'
                            : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                        }`}
                      >
                        <TrendingDown size={13} />
                        <span>Egresos / Retiros (-) ({countEgresos} · {formatCurrency(totalEgresosMonto)})</span>
                      </button>
                    )}

                    {filtroBancoTipo !== 'Retiro' && (
                      <button
                        type="button"
                        onClick={() => { setFiltroTipoRapido('ingresos'); setBancoPage(0); }}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          filtroTipoRapido === 'ingresos'
                            ? 'bg-emerald-600 text-white shadow-sm font-black'
                            : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        }`}
                      >
                        <TrendingUp size={13} />
                        <span>Ingresos / Depósitos (+) ({countIngresos} · {formatCurrency(totalIngresosMonto)})</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">
                      Mostrando: {filtroTipoRapido === 'todos' ? 'Todos los movimientos' : filtroTipoRapido === 'egresos' ? 'Solo Egresos / Retiros' : 'Solo Ingresos / Depósitos'}
                    </span>
                  </div>
                </div>

                {/* FILTROS DE HISTORIAL Y AUDITORÍA ESPECIAL */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-1">Filtro de Historial:</span>
                  <button
                    type="button"
                    onClick={() => { setFiltroEspecial('todos'); setBancoPage(0); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      filtroEspecial === 'todos'
                        ? 'bg-amber-500 text-gray-950 font-black shadow-2xs'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFiltroEspecial('conciliados'); setBancoPage(0); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      filtroEspecial === 'conciliados'
                        ? 'bg-emerald-600 text-white font-black shadow-2xs'
                        : 'bg-emerald-50 dark:bg-emerald-955/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800'
                    }`}
                  >
                    <Check size={11} /> 100% Conciliados
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFiltroEspecial('discrepancias'); setBancoPage(0); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      filtroEspecial === 'discrepancias'
                        ? 'bg-rose-600 text-white font-black shadow-2xs'
                        : 'bg-rose-50 dark:bg-rose-955/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    <ShieldAlert size={11} /> Discrepancias de Pago (Efectivo/Tarjeta)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFiltroEspecial('multi_pagos'); setBancoPage(0); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      filtroEspecial === 'multi_pagos'
                        ? 'bg-indigo-600 text-white font-black shadow-2xs'
                        : 'bg-indigo-50 dark:bg-indigo-955/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800'
                    }`}
                  >
                    <Link size={11} /> Pagos en Partes (Múltiples Exhibiciones)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFiltroEspecial('saldo_diferencia'); setBancoPage(0); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      filtroEspecial === 'saldo_diferencia'
                        ? 'bg-amber-600 text-white font-black shadow-2xs'
                        : 'bg-amber-50 dark:bg-amber-955/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    <AlertTriangle size={11} /> Diferencias (Saldo a Favor/Contra)
                  </button>
                </div>

                {/* Búsqueda, Cuenta y Acciones agrupadas */}
                <div className="flex gap-3 items-center flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Buscar concepto, ref, rfc, monto..."
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
                    onClick={handleOpenAutoConciliacion}
                    disabled={!selectedCuentaId}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                    title="Conciliación Inteligente Automática con Propuestas"
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
                    onClick={handleDepurarDuplicados}
                    disabled={depurandoDuplicados}
                    className="px-3.5 py-2 bg-red-600/90 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer"
                    title="Buscar y eliminar movimientos bancarios duplicados (conservando el conciliado o más antiguo)"
                  >
                    <Trash2 size={14} className={depurandoDuplicados ? 'animate-spin' : ''} />
                    <span>{depurandoDuplicados ? 'Depurando...' : 'Depurar Duplicados'}</span>
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
                    onClick={() => setAgruparVisual(!agruparVisual)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      agruparVisual
                        ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                        : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                    }`}
                    title="Alternar entre vista acumulada por categorías (Nómina, TPV, Traspasos, Préstamos, etc.) o listado plano (los pagos a proveedores siempre se muestran individuales para conciliar)"
                  >
                    <Layers size={14} />
                    {agruparVisual ? 'Vista Acumulada por Categorías ▾' : 'Vista Plana (Todos los registros)'}
                  </button>

                  <button
                    onClick={() => {
                      setTiposSelected(['Deposito', 'Retiro']);
                      setVisibilidadesSelected(['visibles_egresos', 'visibles_ingresos', 'ocultos']);
                      const allClaves = Array.from(new Set((estatusCatalog || []).map(e => e.clave).filter(Boolean)));
                      setEstatusSelected(allClaves);
                      setCategoriasSelected(Array.from(new Set(['sin_categoria', ...uniqueCategoriasMovimiento.flatMap(c => [c.id, String(c.id)])])));
                      setBusquedaBanco('');
                      setBancoPage(0);
                    }}
                    className="px-3.5 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-700 transition-all shrink-0"
                  >
                    Restablecer Filtros
                  </button>
                </div>

                {/* Resumen Horizontal de Saldos y Comisiones Acumuladas */}
                {selectedCuentaId && (() => {
                  const cuenta = cuentasBancarias?.find(c => c.id === selectedCuentaId);
                  const depositos = filtered.filter(m => m.tipo_movimiento === 'Deposito').reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);
                  const retiros = filtered.filter(m => m.tipo_movimiento === 'Retiro').reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);
                  const saldoInicial = Number(cuenta?.saldo_inicial || 0);
                  const saldoCalculado = saldoInicial + depositos - retiros;

                  const isMovRetiro = (m: MovimientoBancario) => {
                    const rawType = (m.tipo_movimiento || '').toLowerCase();
                    return rawType === 'retiro' || rawType === 'cargo' || rawType === 'egreso' || Number(m.retiro || 0) > 0 || Number(m.monto || 0) < 0;
                  };

                  const tpvComisionesTotal = filtered
                    .filter(m => isMovRetiro(m) && (esComisionTpv(m.concepto, getCatName(m)) || (m.concepto || '').includes('Total de comisiones TPV')))
                    .reduce((acc, m) => acc + Math.abs(Number(m.monto || m.retiro || 0)), 0);

                  const bancoComisionesTotal = filtered
                    .filter(m => isMovRetiro(m) && (esComisionBancaria(m.concepto, getCatName(m)) || (m.concepto || '').includes('Total de comisiones bancarias')))
                    .reduce((acc, m) => acc + Math.abs(Number(m.monto || m.retiro || 0)), 0);

                  return (
                    <div className="flex flex-col gap-2 shrink-0 font-sans">
                      <div className="flex gap-6 items-center bg-gray-50/50 dark:bg-gray-900/30 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-[11px] flex-wrap">
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

                      {/* Barra de Comisiones Acumuladas */}
                      <div className="flex gap-4 items-center bg-purple-50/40 dark:bg-purple-955/20 p-2.5 rounded-xl border border-purple-200/80 dark:border-purple-900/40 text-[11px] flex-wrap">
                        <span className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1">
                          <Layers size={13} /> Comisiones Acumuladas:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-600 dark:text-gray-400 font-medium">Total Comisiones TPV:</span>
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-955/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/40">
                            {formatCurrency(tpvComisionesTotal)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-600 dark:text-gray-400 font-medium">Total Comisiones Bancarias:</span>
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-955/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-900/40">
                            {formatCurrency(bancoComisionesTotal)}
                          </span>
                        </div>
                        {onConsolidarComisiones && (
                          <button
                            onClick={onConsolidarComisiones}
                            className="ml-auto px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-extrabold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                            title="Consolidar comisiones individuales en registros acumulados TPV y Bancarias"
                          >
                            <Layers size={12} /> Consolidar Comisiones
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Grid de Checklists de Filtro (Colapsable) */}
                {showFiltrosAvanzados && (
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${(!filtroBancoTipo || filtroBancoTipo === 'todos') ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 text-xs font-sans animate-in fade-in duration-200`}>
                    {/* Tipo (se oculta cuando el módulo es específico de Egresos/Retiros o Ingresos/Depósitos) */}
                    {(!filtroBancoTipo || filtroBancoTipo === 'todos') && (
                      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Tipo de Movimiento</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTiposSelected(tiposSelected.length === 2 ? [] : ['Deposito', 'Retiro']);
                              setBancoPage(0);
                            }}
                            className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            {tiposSelected.length === 2 ? 'Desmarcar todos' : 'Marcar todos'}
                          </button>
                        </div>
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
                    )}

                    {/* Estatus */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Estatus Conciliación</span>
                        <button
                          type="button"
                          onClick={() => {
                            const allClaves = Array.from(new Set((estatusCatalog || []).map(e => e.clave).filter(Boolean)));
                            const isAll = allClaves.length > 0 && allClaves.every(c => estatusSelected.includes(c));
                            setEstatusSelected(isAll ? [] : allClaves);
                            setBancoPage(0);
                          }}
                          className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          {(() => {
                            const allClaves = Array.from(new Set((estatusCatalog || []).map(e => e.clave).filter(Boolean)));
                            const isAll = allClaves.length > 0 && allClaves.every(c => estatusSelected.includes(c));
                            return isAll ? 'Desmarcar todos' : 'Marcar todos';
                          })()}
                        </button>
                      </div>
                      <div className="space-y-1.5 flex-1 max-h-24 overflow-y-auto pr-1">
                        {(() => {
                          const map = new Map<string, { clave: string; nombre: string; id: string; allClaves: string[] }>();
                          (estatusCatalog || []).forEach(e => {
                            const normName = (e.nombre || '').trim();
                            if (!normName) return;
                            const key = normName.toLowerCase();
                            if (map.has(key)) {
                              const existing = map.get(key)!;
                              if (!existing.allClaves.includes(e.clave)) {
                                existing.allClaves.push(e.clave);
                              }
                            } else {
                              map.set(key, {
                                clave: e.clave,
                                nombre: normName,
                                id: e.id || e.clave,
                                allClaves: [e.clave]
                              });
                            }
                          });
                          return Array.from(map.values()).map((e) => {
                            const isChecked = e.allClaves.some(c => estatusSelected.includes(c));
                            return (
                              <label key={e.id} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(chk) => {
                                    let newEstatus: string[];
                                    if (chk.target.checked) {
                                      newEstatus = Array.from(new Set([...estatusSelected, ...e.allClaves]));
                                    } else {
                                      newEstatus = estatusSelected.filter(es => !e.allClaves.includes(es));
                                    }
                                    setEstatusSelected(newEstatus);
                                    setBancoPage(0);
                                  }}
                                  className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                                />
                                <span>{e.nombre}</span>
                              </label>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Visibilidad ERP */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Visibilidad ERP</span>
                        <button
                          type="button"
                          onClick={() => {
                            setVisibilidadesSelected(visibilidadesSelected.length === 3 ? [] : ['visibles_egresos', 'visibles_ingresos', 'ocultos']);
                            setBancoPage(0);
                          }}
                          className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          {visibilidadesSelected.length === 3 ? 'Desmarcar todos' : 'Marcar todos'}
                        </button>
                      </div>
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
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">Categoría de Movimiento</span>
                        <button
                          type="button"
                          onClick={() => {
                            const allCats = Array.from(new Set(['sin_categoria', ...uniqueCategoriasMovimiento.flatMap(c => [c.id, String(c.id)])]));
                            const isAll = allCats.length > 0 && allCats.every(c => categoriasSelected.includes(c));
                            setCategoriasSelected(isAll ? [] : allCats);
                            setBancoPage(0);
                          }}
                          className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          {(() => {
                            const allCats = Array.from(new Set(['sin_categoria', ...uniqueCategoriasMovimiento.flatMap(c => [c.id, String(c.id)])]));
                            const isAll = allCats.length > 0 && allCats.every(c => categoriasSelected.includes(c));
                            return isAll ? 'Desmarcar todos' : 'Marcar todos';
                          })()}
                        </button>
                      </div>
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
                        {uniqueCategoriasMovimiento.map((c) => {
                          const cIdStr = String(c.id);
                          const isChecked = categoriasSelected.includes(c.id) || categoriasSelected.includes(cIdStr);
                          return (
                            <label key={c.id} className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300 text-[11px] font-semibold hover:text-gray-900 dark:hover:text-white">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(chk) => {
                                  let newCats: string[];
                                  if (chk.target.checked) {
                                    newCats = Array.from(new Set([...categoriasSelected, c.id, cIdStr]));
                                  } else {
                                    newCats = categoriasSelected.filter(cs => cs !== c.id && cs !== cIdStr);
                                  }
                                  setCategoriasSelected(newCats);
                                  setBancoPage(0);
                                }}
                                className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950"
                              />
                              <span>{c.nombre}</span>
                            </label>
                          );
                        })}
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
                    ) : (() => {
                      const renderSingleMovRow = (m: MovimientoBancario, isChild = false, childTheme?: 'rose' | 'indigo' | 'purple' | 'blue' | 'amber' | 'cyan' | 'emerald') => {
                        const color = m.estatus_conciliacion_bancaria?.color || '#9CA3AF';
                        const dateStr = new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' });
                        const isRetiro = isMovRetiro(m);

                        let rowBgClass = 'hover:bg-gray-50 dark:hover:bg-gray-900/10 transition-colors';
                        if (isChild) {
                          switch (childTheme) {
                            case 'rose':
                              rowBgClass = 'bg-rose-50/40 dark:bg-rose-955/20 border-l-4 border-rose-400 dark:border-rose-600 hover:bg-rose-100/50';
                              break;
                            case 'indigo':
                              rowBgClass = 'bg-indigo-50/40 dark:bg-indigo-955/20 border-l-4 border-indigo-400 dark:border-indigo-600 hover:bg-indigo-100/50';
                              break;
                            case 'purple':
                              rowBgClass = 'bg-purple-50/40 dark:bg-purple-955/20 border-l-4 border-purple-400 dark:border-purple-600 hover:bg-purple-100/50';
                              break;
                            case 'blue':
                              rowBgClass = 'bg-blue-50/40 dark:bg-blue-955/20 border-l-4 border-blue-400 dark:border-blue-600 hover:bg-blue-100/50';
                              break;
                            case 'amber':
                              rowBgClass = 'bg-amber-50/40 dark:bg-amber-955/20 border-l-4 border-amber-400 dark:border-amber-600 hover:bg-amber-100/50';
                              break;
                            case 'cyan':
                              rowBgClass = 'bg-cyan-50/40 dark:bg-cyan-955/20 border-l-4 border-cyan-400 dark:border-cyan-600 hover:bg-cyan-100/50';
                              break;
                            case 'emerald':
                            default:
                              rowBgClass = 'bg-emerald-50/40 dark:bg-emerald-955/20 border-l-4 border-emerald-400 dark:border-emerald-600 hover:bg-emerald-100/50';
                              break;
                          }
                        }

                        return (
                          <tr key={m.id} className={rowBgClass}>
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
                            <td className="p-3 font-mono text-gray-500 font-medium">
                              {isChild && <span className="text-gray-400 mr-1">└</span>}
                              {dateStr}
                            </td>
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
                                className="w-full bg-transparent border-gray-200 dark:border-gray-700 rounded text-[10px] p-1.5 focus:ring-blue-500 dark:text-gray-300 cursor-pointer"
                                value={m.categoria_movimiento_id || m.categoria_id || ''}
                                onChange={(e) => handleSingleUpdateCategory(m.id, e.target.value)}
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
                              {(() => {
                                // Extraer todos los XMLs del movimiento y sus conciliaciones
                                const xmlSet = new Set<string>();
                                if (m.xml_url) m.xml_url.split(',').filter(Boolean).forEach((u: string) => xmlSet.add(u));
                                m.conciliaciones_bancarias?.forEach((l: any) => {
                                  if (l.gasto?.xml_url) l.gasto.xml_url.split(',').filter(Boolean).forEach((u: string) => xmlSet.add(u));
                                  l.pedido?.facturas_clientes?.forEach((f: any) => {
                                    if (f.xml_url) f.xml_url.split(',').filter(Boolean).forEach((u: string) => xmlSet.add(u));
                                  });
                                });
                                const allXmls = Array.from(xmlSet);

                                // Extraer todos los PDFs
                                const pdfSet = new Set<string>();
                                if (m.pdf_factura_url) m.pdf_factura_url.split(',').filter(Boolean).forEach((u: string) => pdfSet.add(u));
                                m.conciliaciones_bancarias?.forEach((l: any) => {
                                  if (l.gasto?.pdf_url) l.gasto.pdf_url.split(',').filter(Boolean).forEach((u: string) => pdfSet.add(u));
                                  l.pedido?.facturas_clientes?.forEach((f: any) => {
                                    if (f.pdf_url) f.pdf_url.split(',').filter(Boolean).forEach((u: string) => pdfSet.add(u));
                                  });
                                });
                                const allPdfs = Array.from(pdfSet);

                                // Extraer Tickets y Comprobantes
                                const ticketSet = new Set<string>();
                                if (m.pdf_ticket_url) m.pdf_ticket_url.split(',').filter(Boolean).forEach((u: string) => ticketSet.add(u));
                                m.conciliaciones_bancarias?.forEach((l: any) => {
                                  if (l.gasto?.ticket_url) l.gasto.ticket_url.split(',').filter(Boolean).forEach((u: string) => ticketSet.add(u));
                                  l.pedido?.facturas_clientes?.forEach((f: any) => {
                                    if (f.ticket_url) f.ticket_url.split(',').filter(Boolean).forEach((u: string) => ticketSet.add(u));
                                  });
                                });
                                const associatedComps = (comprobantes || []).filter(c => 
                                  c.comprobantes_deposito_movimientos?.some(rel => rel.movimiento_id === m.id)
                                );
                                associatedComps.forEach(c => {
                                  if (c.archivo_url) ticketSet.add(c.archivo_url);
                                });
                                const allTickets = Array.from(ticketSet);

                                // Reembolso
                                const allReembolsos = m.soporte_reembolso_url ? m.soporte_reembolso_url.split(',').filter(Boolean) : [];
                                const totalFiles = allXmls.length + allPdfs.length + allTickets.length + allReembolsos.length;

                                return (
                                  <div className="flex items-center justify-center gap-1 flex-wrap max-w-[170px] mx-auto">
                                    {/* XML Badge */}
                                    {allXmls.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleViewCfdi ? handleViewCfdi(allXmls[0]) : onDownloadFile(allXmls[0])}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-955/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 flex items-center gap-0.5 transition-all shadow-2xs cursor-pointer"
                                        title={`CFDI XML (${allXmls.length}) - Clic para ver representación`}
                                      >
                                        <FileCode size={12} />
                                        <span className="font-mono text-[9px]">XML{allXmls.length > 1 ? ` (${allXmls.length})` : ''}</span>
                                      </button>
                                    )}

                                    {/* PDF Badge */}
                                    {allPdfs.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => onDownloadFile(allPdfs[0])}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 dark:bg-red-955/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 flex items-center gap-0.5 transition-all shadow-2xs cursor-pointer"
                                        title={`Factura PDF (${allPdfs.length})`}
                                      >
                                        <FileText size={12} />
                                        <span className="font-mono text-[9px]">PDF{allPdfs.length > 1 ? ` (${allPdfs.length})` : ''}</span>
                                      </button>
                                    )}

                                    {/* Ticket Badge */}
                                    {allTickets.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => onDownloadFile(allTickets[0])}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-955/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 flex items-center gap-0.5 transition-all shadow-2xs cursor-pointer"
                                        title={`Ticket / Comprobante (${allTickets.length})`}
                                      >
                                        <CreditCard size={12} />
                                        <span className="font-mono text-[9px]">Tkt{allTickets.length > 1 ? ` (${allTickets.length})` : ''}</span>
                                      </button>
                                    )}

                                    {/* Reembolso Badge */}
                                    {allReembolsos.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => onDownloadFile(allReembolsos[0])}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-955/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 flex items-center gap-0.5 transition-all shadow-2xs cursor-pointer"
                                        title="Soporte de Reembolso"
                                      >
                                        <Paperclip size={12} />
                                      </button>
                                    )}

                                    {/* Botón rápido para adjuntar o ver archivos */}
                                    <button
                                      type="button"
                                      onClick={() => setHistorialMovimiento(m)}
                                      className="p-1 rounded text-[10px] font-bold text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 transition-all flex items-center gap-0.5 cursor-pointer"
                                      title={totalFiles === 0 ? "Sin archivos. Clic para adjuntar o ver historial" : "Gestionar y adjuntar más archivos"}
                                    >
                                      <Plus size={11} />
                                      {totalFiles === 0 && <span className="text-[8px]">Doc</span>}
                                    </button>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex gap-1.5 justify-center items-center">
                                {/* Botón de Historial y Auditoría Completa */}
                                <button
                                  type="button"
                                  onClick={() => setHistorialMovimiento(m)}
                                  className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-955/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 hover:scale-105 transition-all shadow-2xs border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                                  title="Ver Historial Completo y Auditoría de Conciliación"
                                >
                                  <History size={13} />
                                </button>

                                {/* Conciliación Manual */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenReconcileModal?.(m)}
                                  className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-955/40 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                                  title="Conciliación Manual"
                                >
                                  <ArrowRightLeft size={13} />
                                </button>

                                {/* Editar */}
                                <button
                                  type="button"
                                  onClick={() => onEditMovimiento(m)}
                                  disabled={m.estatus_conciliacion_bancaria?.clave !== 'pendiente'}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    m.estatus_conciliacion_bancaria?.clave !== 'pendiente'
                                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                      : 'text-blue-500 hover:bg-blue-500/15 cursor-pointer'
                                  }`}
                                  title={m.estatus_conciliacion_bancaria?.clave !== 'pendiente' ? "No editable (Conciliado)" : "Editar"}
                                >
                                  <Edit3 size={13} />
                                </button>

                                {/* Eliminar */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMovimiento?.(m.id)}
                                  disabled={m.estatus_conciliacion_bancaria?.clave !== 'pendiente'}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    m.estatus_conciliacion_bancaria?.clave !== 'pendiente'
                                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                      : 'text-red-500 hover:bg-red-500/15 cursor-pointer'
                                  }`}
                                  title={m.estatus_conciliacion_bancaria?.clave !== 'pendiente' ? "No eliminable (Conciliado)" : "Eliminar"}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      };

                      const renderedRows: React.ReactNode[] = [];

                      // Solo en la página 1 (bancoPage === 0) renderizar los grupos acumulados si agruparVisual es true
                      if (agruparVisual && bancoPage === 0) {
                        const themeMap: Record<string, {
                          row: string;
                          check: string;
                          date: string;
                          chevron: string;
                          btn: string;
                          icon: string;
                          badge: string;
                          countBadge: string;
                          monto: string;
                          groupBadge: string;
                        }> = {
                          rose: {
                            row: 'bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent border-l-4 border-rose-500 dark:border-rose-400 border-y border-rose-200/60 dark:border-rose-900/50 font-sans font-bold shadow-xs transition-all hover:bg-rose-100/40 dark:hover:bg-rose-955/50',
                            check: 'text-rose-600 focus:ring-rose-500 border-rose-300',
                            date: 'text-rose-700 dark:text-rose-300',
                            chevron: 'bg-rose-500/20 text-rose-600 dark:text-rose-400',
                            btn: 'text-rose-950 dark:text-rose-100 hover:text-rose-600',
                            icon: 'text-rose-600',
                            badge: 'bg-rose-500/20 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border-rose-400/30',
                            countBadge: 'bg-rose-500/15 dark:bg-rose-900/70 text-rose-800 dark:text-rose-200 border-rose-300/40',
                            monto: 'text-rose-600 dark:text-rose-400',
                            groupBadge: 'bg-rose-100/80 dark:bg-rose-955/60 text-rose-700 dark:text-rose-300 border-rose-300/60 dark:border-rose-800/80'
                          },
                          indigo: {
                            row: 'bg-gradient-to-r from-indigo-500/15 via-indigo-500/5 to-transparent border-l-4 border-indigo-500 dark:border-indigo-400 border-y border-indigo-200/60 dark:border-indigo-900/50 font-sans font-bold shadow-xs transition-all hover:bg-indigo-100/40 dark:hover:bg-indigo-955/50',
                            check: 'text-indigo-600 focus:ring-indigo-500 border-indigo-300',
                            date: 'text-indigo-700 dark:text-indigo-300',
                            chevron: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
                            btn: 'text-indigo-950 dark:text-indigo-100 hover:text-indigo-600',
                            icon: 'text-indigo-600',
                            badge: 'bg-indigo-500/20 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-400/30',
                            countBadge: 'bg-indigo-500/15 dark:bg-indigo-900/70 text-indigo-800 dark:text-indigo-200 border-indigo-300/40',
                            monto: 'text-indigo-600 dark:text-indigo-400',
                            groupBadge: 'bg-indigo-100/80 dark:bg-indigo-955/60 text-indigo-700 dark:text-indigo-300 border-indigo-300/60 dark:border-indigo-800/80'
                          },
                          purple: {
                            row: 'bg-gradient-to-r from-purple-500/15 via-purple-500/5 to-transparent border-l-4 border-purple-500 dark:border-purple-400 border-y border-purple-200/60 dark:border-purple-900/50 font-sans font-bold shadow-xs transition-all hover:bg-purple-100/40 dark:hover:bg-purple-955/50',
                            check: 'text-purple-600 focus:ring-purple-500 border-purple-300',
                            date: 'text-purple-700 dark:text-purple-300',
                            chevron: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
                            btn: 'text-purple-950 dark:text-purple-100 hover:text-purple-600',
                            icon: 'text-purple-600',
                            badge: 'bg-purple-500/20 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border-purple-400/30',
                            countBadge: 'bg-purple-500/15 dark:bg-purple-900/70 text-purple-800 dark:text-purple-200 border-purple-300/40',
                            monto: 'text-purple-600 dark:text-purple-400',
                            groupBadge: 'bg-purple-100/80 dark:bg-purple-955/60 text-purple-700 dark:text-purple-300 border-purple-300/60 dark:border-purple-800/80'
                          },
                          blue: {
                            row: 'bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-transparent border-l-4 border-blue-500 dark:border-blue-400 border-y border-blue-200/60 dark:border-blue-900/50 font-sans font-bold shadow-xs transition-all hover:bg-blue-100/40 dark:hover:bg-blue-955/50',
                            check: 'text-blue-600 focus:ring-blue-500 border-blue-300',
                            date: 'text-blue-700 dark:text-blue-300',
                            chevron: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
                            btn: 'text-blue-950 dark:text-blue-100 hover:text-blue-600',
                            icon: 'text-blue-600',
                            badge: 'bg-blue-500/20 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 border-blue-400/30',
                            countBadge: 'bg-blue-500/15 dark:bg-blue-900/70 text-blue-800 dark:text-blue-200 border-blue-300/40',
                            monto: 'text-blue-600 dark:text-blue-400',
                            groupBadge: 'bg-blue-100/80 dark:bg-blue-955/60 text-blue-700 dark:text-blue-300 border-blue-300/60 dark:border-blue-800/80'
                          },
                          amber: {
                            row: 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-l-4 border-amber-500 dark:border-amber-400 border-y border-amber-200/60 dark:border-amber-900/50 font-sans font-bold shadow-xs transition-all hover:bg-amber-100/40 dark:hover:bg-amber-955/50',
                            check: 'text-amber-600 focus:ring-amber-500 border-amber-300',
                            date: 'text-amber-700 dark:text-amber-300',
                            chevron: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
                            btn: 'text-amber-950 dark:text-amber-100 hover:text-amber-600',
                            icon: 'text-amber-600',
                            badge: 'bg-amber-500/20 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border-amber-400/30',
                            countBadge: 'bg-amber-500/15 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 border-amber-300/40',
                            monto: 'text-amber-600 dark:text-amber-400',
                            groupBadge: 'bg-amber-100/80 dark:bg-amber-955/60 text-amber-700 dark:text-amber-300 border-amber-300/60 dark:border-amber-800/80'
                          },
                          cyan: {
                            row: 'bg-gradient-to-r from-cyan-500/15 via-cyan-500/5 to-transparent border-l-4 border-cyan-500 dark:border-cyan-400 border-y border-cyan-200/60 dark:border-cyan-900/50 font-sans font-bold shadow-xs transition-all hover:bg-cyan-100/40 dark:hover:bg-cyan-955/50',
                            check: 'text-cyan-600 focus:ring-cyan-500 border-cyan-300',
                            date: 'text-cyan-700 dark:text-cyan-300',
                            chevron: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
                            btn: 'text-cyan-950 dark:text-cyan-100 hover:text-cyan-600',
                            icon: 'text-cyan-600',
                            badge: 'bg-cyan-500/20 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 border-cyan-400/30',
                            countBadge: 'bg-cyan-500/15 dark:bg-cyan-900/70 text-cyan-800 dark:text-cyan-200 border-cyan-300/40',
                            monto: 'text-cyan-600 dark:text-cyan-400',
                            groupBadge: 'bg-cyan-100/80 dark:bg-cyan-955/60 text-cyan-700 dark:text-cyan-300 border-cyan-300/60 dark:border-cyan-800/80'
                          },
                          emerald: {
                            row: 'bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-l-4 border-emerald-500 dark:border-emerald-400 border-y border-emerald-200/60 dark:border-emerald-900/50 font-sans font-bold shadow-xs transition-all hover:bg-emerald-100/40 dark:hover:bg-emerald-955/50',
                            check: 'text-emerald-600 focus:ring-emerald-500 border-emerald-300',
                            date: 'text-emerald-700 dark:text-emerald-300',
                            chevron: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
                            btn: 'text-emerald-950 dark:text-emerald-100 hover:text-emerald-600',
                            icon: 'text-emerald-600',
                            badge: 'bg-emerald-500/20 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border-emerald-400/30',
                            countBadge: 'bg-emerald-500/15 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200 border-emerald-300/40',
                            monto: 'text-emerald-600 dark:text-emerald-400',
                            groupBadge: 'bg-emerald-100/80 dark:bg-emerald-955/60 text-emerald-700 dark:text-emerald-300 border-emerald-300/60 dark:border-emerald-800/80'
                          }
                        };

                        accumulatedGroups.forEach(group => {
                          const isExpanded = !!expandedCategories[group.key];
                          const st = themeMap[group.theme] || themeMap.emerald;
                          const ids = group.movimientos.map(m => m.id);
                          const allChecked = ids.length > 0 && ids.every(id => selectedMovimientos.includes(id));
                          const firstMov = group.movimientos[0];
                          const dateFormatted = firstMov?.fecha ? new Date(firstMov.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '-';

                          let IconComponent = <Tag size={16} className={st.icon} />;
                          if (group.iconType === 'tpv') IconComponent = <Layers size={16} className={st.icon} />;
                          if (group.iconType === 'banco') IconComponent = <Landmark size={16} className={st.icon} />;
                          if (group.iconType === 'nomina') IconComponent = <Users size={16} className={st.icon} />;
                          if (group.iconType === 'traspaso') IconComponent = <ArrowRightLeft size={16} className={st.icon} />;
                          if (group.iconType === 'prestamo') IconComponent = <CreditCard size={16} className={st.icon} />;
                          if (group.iconType === 'ajuste') IconComponent = <SlidersHorizontal size={16} className={st.icon} />;

                          renderedRows.push(
                            <tr key={`group-header-${group.key}`} className={st.row}>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMovimientos(prev => Array.from(new Set([...prev, ...ids])));
                                    } else {
                                      setSelectedMovimientos(prev => prev.filter(id => !ids.includes(id)));
                                    }
                                  }}
                                  className={`w-3.5 h-3.5 ${st.check} rounded cursor-pointer`}
                                />
                              </td>
                              <td className={`p-3 font-mono text-[11px] ${st.date} font-black`}>
                                {dateFormatted}
                              </td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => setExpandedCategories(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                                  className={`flex items-center gap-2.5 ${st.btn} font-extrabold text-xs cursor-pointer group/btn`}
                                >
                                  <div className={`p-1 rounded-md ${st.chevron} transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                    <ChevronDown size={14} className="shrink-0" />
                                  </div>
                                  {IconComponent}
                                  <span className="text-xs font-black tracking-tight">{group.title} ({group.movimientos.length} movimientos en total)</span>
                                  <span className={`text-[10px] ${st.countBadge} px-2.5 py-0.5 rounded-full font-mono font-bold ml-1 border`}>
                                    {isExpanded ? '▲ Ocultar listado' : `▼ Desplegar todos (${group.movimientos.length})`}
                                  </span>
                                </button>
                              </td>
                              <td className="p-3">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${st.badge} border shadow-2xs`}>
                                  {group.categoryName}
                                </span>
                              </td>
                              <td className={`p-3 text-right font-mono font-black ${st.monto} text-sm`}>
                                {group.isRetiro ? `-${formatCurrency(group.totalMonto)}` : `+${formatCurrency(group.totalMonto)}`}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${st.groupBadge} border`}>
                                  Agrupado ({group.movimientos.length})
                                </span>
                              </td>
                              <td className={`p-3 text-center text-xs ${st.date} font-bold`}>-</td>
                              <td className={`p-3 text-center text-xs ${st.date} font-bold`}>-</td>
                              <td className="p-3 text-center">
                                {(group.key === 'cat-tpv' || group.key === 'cat-banco') && onConsolidarComisiones && (
                                  <button
                                    type="button"
                                    onClick={onConsolidarComisiones}
                                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[10px] font-black rounded-xl transition-all shadow-md shadow-purple-500/20 hover:shadow-purple-500/30 flex items-center gap-1.5 mx-auto cursor-pointer"
                                    title="Consolidar en 1 solo registro físico en la base de datos"
                                  >
                                    <Layers size={12} /> Consolidar DB
                                  </button>
                                )}
                              </td>
                            </tr>
                          );

                          if (isExpanded) {
                            group.movimientos.forEach(m => {
                              renderedRows.push(renderSingleMovRow(m, true, group.theme));
                            });
                          }
                        });
                      }

                      // Renderizar movimientos individuales paginados
                      paginated.forEach(m => {
                        renderedRows.push(renderSingleMovRow(m, false));
                      });

                      return renderedRows;
                    })()}
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

            {ingresosSubSeccion === 'comprobantes' && (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 gap-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-hidden">
                  
                  {/* Formulario de creación */}
                  <div className="flex flex-col min-h-0 bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-xl p-4 overflow-auto shadow-sm font-sans">
                    <div className="flex items-center justify-between gap-2 mb-4 border-b border-gray-150 dark:border-gray-900 pb-2 flex-wrap">
                      <h4 className="text-xs font-extrabold uppercase text-amber-500 flex items-center gap-1.5">
                        <Plus size={14} /> Registrar Comprobante Independiente
                      </h4>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => parrotFileInputRef.current?.click()}
                          className="px-2 py-1 text-[10px] font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded flex items-center gap-1 transition-colors"
                          title="Importar Excel/CSV de Parrot POS"
                        >
                          <FileSpreadsheet size={12} /> Importar Parrot
                        </button>
                        <input
                          type="file"
                          ref={parrotFileInputRef}
                          accept=".csv,.xlsx,.xls"
                          className="hidden"
                          onChange={handleParrotUpload}
                        />
                      </div>
                    </div>

                    {parrotGroups.length > 0 && (
                      <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                            Ventas Parrot Cargadas ({parrotGroups.length} días)
                          </h5>
                          <div className="flex gap-2 items-center">
                            <button
                              type="button"
                              onClick={handleBulkInsertParrot}
                              disabled={isParrotUploading}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded font-bold transition-colors disabled:opacity-50"
                            >
                              {isParrotUploading ? 'Guardando...' : 'Registrar Todos'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setParrotGroups([])}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                          {parrotGroups.map((g, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setNewCompForm(p => ({
                                  ...p,
                                  tipo: 'corte_parrot',
                                  fecha: g.fecha,
                                  montoCredito: String(g.montoCredito),
                                  propinaCredito: String(g.propinaCredito),
                                  montoDebito: String(g.montoDebito),
                                  propinaDebito: String(g.propinaDebito),
                                  montoEfectivo: String(g.montoEfectivo),
                                  propinaEfectivo: String(g.propinaEfectivo),
                                  montoParrotpay: String(g.montoParrotpay),
                                  propinaParrotpay: String(g.propinaParrotpay),
                                }));
                              }}
                              className="w-full text-left px-2 py-1.5 bg-white dark:bg-gray-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-100 dark:border-emerald-800/30 rounded text-[10px] text-gray-700 dark:text-gray-300 transition-colors flex justify-between items-center"
                            >
                              <span className="font-bold">{g.fecha}</span>
                              <span className="font-mono">{formatCurrency(g.totalAgrupado)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
                              if (!onActualizarComprobante) {
                                throw new Error('No se ha configurado la acción para actualizar comprobantes en esta sección.');
                              }
                              res = await onActualizarComprobante(editingCompId, payload);
                            } else {
                              if (!onCrearComprobante) {
                                throw new Error('No se ha configurado la acción para crear comprobantes en esta sección.');
                              }
                              res = await onCrearComprobante(payload);
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
                        <button
                          type="button"
                          onClick={() => setConciliacionMasivaModal(p => ({ ...p, open: true }))}
                          className="px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg text-xs font-black shadow-md flex items-center gap-1.5 transition-all"
                        >
                          <Scale size={14} /> Conciliación Masiva
                        </button>
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
                          ({filteredComprobantes.length} de {comprobantes.length})
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
                          {filteredComprobantes.map(c => {
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
                                            fecha: c.fecha ? String(c.fecha).substring(0, 10) : getDefaultDateForSelectedMonth(),
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
                          {filteredComprobantes.length === 0 && (
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
                      if (clave === 'conciliado') return false;
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
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-4 font-sans">
                <div className="p-4 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                  <FileText size={36} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Módulo de Factura Público en General</h3>
                  <p className="text-xs text-gray-500 max-w-md mt-1 font-sans">
                    Este módulo ahora cuenta con su propia pantalla dedicada e independiente en el menú de Operación Administrativa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/admin/factura-publico-general')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg transition-all flex items-center gap-2"
                >
                  <FileText size={15} /> Ir a Factura Público en General ↗
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── SUB-TAB 4: CARGAS DE ESTADO DE CUENTA ───────────────────────── */}
        {bancoSubTab === 'cargas' && (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto min-h-0">
            <CargasTab
              token={token || ''}
              selectedMonth={selectedMonth}
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
                  <div className={`grid grid-cols-1 sm:grid-cols-2 ${(!filtroBancoTipo || filtroBancoTipo === 'todos') ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 text-xs font-sans animate-in fade-in duration-200`}>
                    {/* TIPO DE MOVIMIENTO */}
                    {(!filtroBancoTipo || filtroBancoTipo === 'todos') && (
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
                    )}

                    {/* ESTATUS CONCILIACIÓN */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-3 rounded-xl flex flex-col shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 block">Estatus Conciliación</span>
                      <div className="space-y-1.5 flex-1 max-h-32 overflow-y-auto pr-1">
                        {[
                          { clave: 'no_deducible', nombre: 'Movimiento no Deducible' },
                          { clave: 'pendiente', nombre: 'Pendiente de Conciliar' },
                          { clave: 'parcial', nombre: 'Parcialmente Conciliado' },
                          { clave: 'conciliado_post_cierre', nombre: '🏷️ Conciliado Post-Cierre' },
                          { clave: 'conciliado', nombre: 'Conciliado' }
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
                        {uniqueCategoriasMovimiento.map((cat) => (
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
                    ) : (() => {
                      const renderSingleAtemporalRow = (m: any, isChild = false, childTheme?: 'rose' | 'indigo') => {
                        const pInfo = getPeriodStatusForMov(m.fecha);
                        const hasPostCloseNote = m.comentarios?.includes('Conciliado después del periodo de cierre');
                        const isOutflow = m.tipo_movimiento === 'Retiro' || Number(m.retiro || 0) > 0;
                        const amt = Math.abs(Number(m.monto || m.retiro || m.deposito || 0));

                        let rowBgClass = 'hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors';
                        if (isChild) {
                          rowBgClass = childTheme === 'rose'
                            ? 'bg-rose-50/40 dark:bg-rose-955/20 border-l-4 border-rose-400 dark:border-rose-600 hover:bg-rose-100/50'
                            : 'bg-indigo-50/40 dark:bg-indigo-955/20 border-l-4 border-indigo-400 dark:border-indigo-600 hover:bg-indigo-100/50';
                        }

                        return (
                          <tr key={m.id} className={rowBgClass}>
                            <td className="p-3 font-mono">
                              <div className="font-bold text-gray-900 dark:text-gray-100">
                                {isChild && <span className="text-gray-400 mr-1">└</span>}
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
                      };

                      const renderedAtemporalRows: React.ReactNode[] = [];

                      // Solo en la página 1 (pageAtemporal === 0) renderizar los 2 grupos unificados si agruparVisual es true
                      if (agruparVisual && pageAtemporal === 0) {
                        // 1. Grupo TPV Atemporal
                        if (allTpvAtemporal.length > 0) {
                          renderedAtemporalRows.push(
                            <tr key="atemporal-group-tpv-global" className="bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent border-l-4 border-rose-500 dark:border-rose-400 border-y border-rose-200/60 dark:border-rose-900/50 font-sans font-bold shadow-xs transition-all hover:bg-rose-100/40 dark:hover:bg-rose-955/50">
                              <td className="p-3 font-mono text-xs text-rose-700 dark:text-rose-300 font-black">
                                {allTpvAtemporal[0].fecha ? new Date(allTpvAtemporal[0].fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '—'}
                              </td>
                              <td className="p-3">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100/80 dark:bg-rose-955/60 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-800/80">
                                  Agrupado ({allTpvAtemporal.length})
                                </span>
                              </td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => setExpandedTpvAtemporal(!expandedTpvAtemporal)}
                                  className="flex items-center gap-2.5 text-rose-950 dark:text-rose-100 hover:text-rose-600 font-extrabold text-xs cursor-pointer group/btn"
                                >
                                  <div className={`p-1 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-transform duration-200 ${expandedTpvAtemporal ? 'rotate-0' : '-rotate-90'}`}>
                                    <ChevronDown size={14} className="shrink-0" />
                                  </div>
                                  <Layers size={16} className="text-rose-600 shrink-0" />
                                  <span className="text-xs font-black tracking-tight">Total de Comisiones TPV ({allTpvAtemporal.length} movimientos en total)</span>
                                  <span className="text-[10px] bg-rose-500/15 dark:bg-rose-900/70 text-rose-800 dark:text-rose-200 px-2.5 py-0.5 rounded-full font-mono font-bold ml-1 border border-rose-300/40">
                                    {expandedTpvAtemporal ? '▲ Ocultar listado' : `▼ Desplegar todos (${allTpvAtemporal.length})`}
                                  </span>
                                </button>
                              </td>
                              <td className="p-3 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                                -{formatCurrency(totalTpvAtemporalMonto)}
                              </td>
                              <td className="p-3">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 border border-rose-400/30 shadow-2xs">
                                  Comisión TPV
                                </span>
                              </td>
                              <td className="p-3 text-gray-400 italic text-[10px]">-</td>
                              <td className="p-3 text-gray-400 italic text-[10px]">-</td>
                              <td className="p-3 text-center">
                                {onConsolidarComisiones && (
                                  <button
                                    type="button"
                                    onClick={onConsolidarComisiones}
                                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[10px] font-black rounded-xl transition-all shadow-md shadow-purple-500/20 hover:shadow-purple-500/30 flex items-center gap-1.5 mx-auto cursor-pointer"
                                    title="Consolidar en 1 solo registro de BD"
                                  >
                                    <Layers size={12} /> Consolidar DB
                                  </button>
                                )}
                              </td>
                            </tr>
                          );

                          if (expandedTpvAtemporal) {
                            allTpvAtemporal.forEach(m => {
                              renderedAtemporalRows.push(renderSingleAtemporalRow(m, true, 'rose'));
                            });
                          }
                        }

                        // 2. Grupo Bancario Atemporal
                        if (allBancoAtemporal.length > 0) {
                          renderedAtemporalRows.push(
                            <tr key="atemporal-group-banco-global" className="bg-gradient-to-r from-indigo-500/15 via-indigo-500/5 to-transparent border-l-4 border-indigo-500 dark:border-indigo-400 border-y border-indigo-200/60 dark:border-indigo-900/50 font-sans font-bold shadow-xs transition-all hover:bg-indigo-100/40 dark:hover:bg-indigo-955/50">
                              <td className="p-3 font-mono text-xs text-indigo-700 dark:text-indigo-300 font-black">
                                {allBancoAtemporal[0].fecha ? new Date(allBancoAtemporal[0].fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '—'}
                              </td>
                              <td className="p-3">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100/80 dark:bg-indigo-955/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300/60 dark:border-indigo-800/80">
                                  Agrupado ({allBancoAtemporal.length})
                                </span>
                              </td>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => setExpandedBancoAtemporal(!expandedBancoAtemporal)}
                                  className="flex items-center gap-2.5 text-indigo-950 dark:text-indigo-100 hover:text-indigo-600 font-extrabold text-xs cursor-pointer group/btn"
                                >
                                  <div className={`p-1 rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-transform duration-200 ${expandedBancoAtemporal ? 'rotate-0' : '-rotate-90'}`}>
                                    <ChevronDown size={14} className="shrink-0" />
                                  </div>
                                  <Landmark size={16} className="text-indigo-600 shrink-0" />
                                  <span className="text-xs font-black tracking-tight">Total de Comisiones Bancarias ({allBancoAtemporal.length} movimientos en total)</span>
                                  <span className="text-[10px] bg-indigo-500/15 dark:bg-indigo-900/70 text-indigo-800 dark:text-indigo-200 px-2.5 py-0.5 rounded-full font-mono font-bold ml-1 border border-indigo-300/40">
                                    {expandedBancoAtemporal ? '▲ Ocultar listado' : `▼ Desplegar todos (${allBancoAtemporal.length})`}
                                  </span>
                                </button>
                              </td>
                              <td className="p-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                -{formatCurrency(totalBancoAtemporalMonto)}
                              </td>
                              <td className="p-3">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border border-indigo-400/30 shadow-2xs">
                                  Comisión Bancaria
                                </span>
                              </td>
                              <td className="p-3 text-gray-400 italic text-[10px]">-</td>
                              <td className="p-3 text-gray-400 italic text-[10px]">-</td>
                              <td className="p-3 text-center">
                                {onConsolidarComisiones && (
                                  <button
                                    type="button"
                                    onClick={onConsolidarComisiones}
                                    className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-[10px] font-black rounded-xl transition-all shadow-md shadow-purple-500/20 hover:shadow-purple-500/30 flex items-center gap-1.5 mx-auto cursor-pointer"
                                    title="Consolidar en 1 solo registro de BD"
                                  >
                                    <Layers size={12} /> Consolidar DB
                                  </button>
                                )}
                              </td>
                            </tr>
                          );

                          if (expandedBancoAtemporal) {
                            allBancoAtemporal.forEach(m => {
                              renderedAtemporalRows.push(renderSingleAtemporalRow(m, true, 'indigo'));
                            });
                          }
                        }
                      }

                      // Resto de movimientos atemporales paginados
                      paginadosAtemporal.forEach((m: any) => {
                        renderedAtemporalRows.push(renderSingleAtemporalRow(m, false));
                      });

                      return renderedAtemporalRows;
                    })()}
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

        const selectedPedidosList = pedidosPendientes.filter((p: any) => reconcileModal.pedidosSeleccionados.includes(p.id));

        const sumAllXmls = Object.values(uploadedXmlAmounts).reduce((s, val) => s + val, 0);

        const totalXmlsCargados = Object.entries(uploadedXmlAmounts).reduce((s, [path, val]) => {
          const fileName = path.split('/').pop() || '';
          const isAlreadyInSelectedGastos = selectedGastosList.some((g: any) => {
            if (!g.xml_url) return false;
            const gPaths = g.xml_url.split(',');
            return gPaths.some((gp: string) => gp === path || gp.endsWith(fileName) || path.endsWith(gp.split('/').pop() || ''));
          });
          const isAlreadyInSelectedPedidos = selectedPedidosList.some((p: any) => {
            const xmlUrls: string[] = [];
            if (p.xml_url) xmlUrls.push(...p.xml_url.split(','));
            if (p.factura_xml_url) xmlUrls.push(...p.factura_xml_url.split(','));
            if (p.facturas_clientes) {
              p.facturas_clientes.forEach((fc: any) => {
                if (fc.xml_url) xmlUrls.push(...fc.xml_url.split(','));
              });
            }
            return xmlUrls.some((xp: string) => xp === path || xp.endsWith(fileName) || path.endsWith(xp.split('/').pop() || ''));
          });
          return (isAlreadyInSelectedGastos || isAlreadyInSelectedPedidos) ? s : s + val;
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
                        // Excluir ventas/facturas en efectivo a menos que ya estén seleccionadas
                        const metodo = String(p.metodo_pago || p.forma_pago || '').toLowerCase();
                        if ((metodo.includes('efectivo') || metodo === '01') && !reconcileModal.pedidosSeleccionados.includes(p.id)) {
                          return false;
                        }

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
                        const clienteNombre = p.clientes?.nombre_local || p.clientes?.razon_social || p.cliente_nombre || p.nombreReceptor || '';
                        const clienteRfc = p.clientes?.rfc || p.rfcReceptor || p.rfc || '';
                        const hasFactura = !!p.folio_factura || (p.facturas_clientes && p.facturas_clientes.length > 0);
                        const folioText = p.folio_factura || p.facturas_clientes?.[0]?.serie_folio || '';
                        const titleText = p.numero_pedido ? `Pedido #${p.numero_pedido}` : (folioText ? `Factura: ${folioText}` : 'Venta');

                        return (
                          <div key={p.id} className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/30 border-b border-gray-100 dark:border-gray-900 last:border-0 font-sans">
                            <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                              <input type="checkbox" checked={reconcileModal.pedidosSeleccionados.includes(p.id)}
                                onChange={() => {
                                  setReconcileModal((prev) => {
                                    const sel = [...prev.pedidosSeleccionados];
                                    const idx = sel.indexOf(p.id);
                                    idx > -1 ? sel.splice(idx, 1) : sel.push(p.id);
                                    
                                    const nextStatus = autoEstatus(prev.gastosSeleccionados, sel);

                                    const xmlList: string[] = prev.xmlUrl ? prev.xmlUrl.split(',') : [];
                                    const pdfList: string[] = prev.pdfFacturaUrl ? prev.pdfFacturaUrl.split(',') : [];

                                    pedidosPendientes.filter(item => sel.includes(item.id)).forEach(item => {
                                      const inv = item.facturas_clientes?.[0];
                                      if (inv?.xml_url) xmlList.push(inv.xml_url);
                                      if (inv?.pdf_url) pdfList.push(inv.pdf_url);
                                    });

                                    const newXmlUrl = Array.from(new Set(xmlList.map(s => s.trim()).filter(Boolean))).join(',');
                                    const newPdfUrl = Array.from(new Set(pdfList.map(s => s.trim()).filter(Boolean))).join(',');
                                    
                                    return { 
                                      ...prev, 
                                      pedidosSeleccionados: sel,
                                      estatusClave: nextStatus,
                                      xmlUrl: newXmlUrl,
                                      pdfFacturaUrl: newPdfUrl
                                    };
                                  });
                                }}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-white dark:bg-gray-950 border-gray-300 dark:border-gray-700 mt-1 shrink-0" />
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-gray-900 dark:text-white">{titleText}</span>
                                  {hasFactura ? (
                                    <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-[9px] font-bold border border-blue-200 dark:border-blue-800">
                                      Factura: {folioText || 'Vinculada'}
                                    </span>
                                  ) : (
                                    <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded text-[9px] font-bold border border-amber-200 dark:border-amber-800">
                                      Pend. Facturar
                                    </span>
                                  )}
                                </div>

                                {clienteNombre && (
                                  <div className="text-[11px] font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 truncate">
                                    <span className="font-bold text-blue-600 dark:text-blue-400 truncate">{clienteNombre}</span>
                                    {clienteRfc && <span className="font-mono text-[10px] text-gray-400 font-normal shrink-0">({clienteRfc})</span>}
                                  </div>
                                )}

                                <div className="text-[10px] text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2 gap-y-0.5 items-center font-medium">
                                  <span className="font-extrabold text-xs font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(p.precio_total)}</span>
                                  <span>•</span>
                                  <span>{p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : 'Sin fecha'}</span>
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
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold shadow transition-all shrink-0 cursor-pointer"
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
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-gray-500 block">Ticket / Comprobante</label>
                      <button
                        type="button"
                        onClick={() => {
                          const current = reconcileModal.pdfTicketUrl || '';
                          if (current === 'no_lleva') {
                            setReconcileModal((p) => ({ ...p, pdfTicketUrl: '' }));
                          } else {
                            setReconcileModal((p) => ({ ...p, pdfTicketUrl: 'no_lleva' }));
                          }
                        }}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition-all border cursor-pointer ${
                          reconcileModal.pdfTicketUrl === 'no_lleva'
                            ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-2xs'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-amber-400'
                        }`}
                        title="Marcar que esta operación no requiere ticket físico para el expediente de compras"
                      >
                        {reconcileModal.pdfTicketUrl === 'no_lleva' ? '✓ Sin Ticket' : '+ Sin Ticket'}
                      </button>
                    </div>

                    {reconcileModal.pdfTicketUrl !== 'no_lleva' ? (
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
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow cursor-pointer"
                        >
                          <UploadCloud size={14} /> Subir Ticket
                        </button>
                      </div>
                    ) : (
                      <div className="p-2 bg-amber-50/70 dark:bg-amber-950/30 border border-dashed border-amber-300 dark:border-amber-800 rounded-lg text-center font-sans">
                        <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                          🚫 Marcado como "Sin Ticket"
                        </p>
                        <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">
                          No se solicitará ticket en el Expediente
                        </p>
                      </div>
                    )}
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
                  {(totalXmlsCargados > 0 || sumAllXmls > 0) && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block font-semibold">XMLs Asignados:</span>
                      <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">{formatCurrency(sumAllXmls || totalXmlsCargados)}</span>
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

      {/* MODAL DE CONCILIACIÓN MASIVA (M TICKETS vs N DEPÓSITOS) */}
      {conciliacionMasivaModal.open && (() => {
        const availableTickets = (comprobantes || []).filter(c => {
          if (selectedCuentaId && c.cuenta_bancaria_id && c.cuenta_bancaria_id !== selectedCuentaId) return false;
          const linkedSum = (c.comprobantes_deposito_movimientos || []).reduce((acc, rel) => acc + Number(rel.monto_asociado), 0);
          return Number(c.monto) > linkedSum + 0.05;
        });

        const availableDeposits = (movimientos || []).filter(m => {
          if (m.tipo_movimiento !== 'Deposito') return false;
          if (selectedCuentaId && m.cuenta_bancaria_id !== selectedCuentaId) return false;
          if (m.estatus_conciliacion_bancaria?.clave === 'conciliado') return false;
          const linkedSum = comprobantes.reduce((acc, c) => {
            const rel = c.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === m.id);
            return acc + (rel ? Number(rel.monto_asociado) : 0);
          }, 0);
          return Number(m.deposito || m.monto) > linkedSum + 0.05;
        });

        const selectedTickets = availableTickets.filter(c => conciliacionMasivaModal.comprobantes.includes(c.id));
        const selectedDeposits = availableDeposits.filter(m => conciliacionMasivaModal.movimientos.includes(m.id));

        const sumTickets = selectedTickets.reduce((acc, c) => {
          const linkedSum = (c.comprobantes_deposito_movimientos || []).reduce((a, r) => a + Number(r.monto_asociado), 0);
          return acc + (Number(c.monto) - linkedSum);
        }, 0);

        const sumDeposits = selectedDeposits.reduce((acc, m) => {
          const linkedSum = comprobantes.reduce((a, c) => {
            const rel = c.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === m.id);
            return a + (rel ? Number(rel.monto_asociado) : 0);
          }, 0);
          return acc + (Number(m.deposito || m.monto) - linkedSum);
        }, 0);

        const diff = sumTickets - sumDeposits;

        return (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-6xl w-full h-[85vh] flex flex-col shadow-2xl">
              <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/30 shrink-0">
                <div>
                  <h3 className="font-extrabold text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                    <Scale size={20} className="text-amber-500" /> Conciliación Masiva (Multi-Ticket vs Multi-Depósito)
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-sans max-w-2xl">
                    Selecciona múltiples tickets/cortes y cruza contra múltiples depósitos bancarios. El sistema distribuirá los montos automáticamente.
                  </p>
                </div>
                <button
                  onClick={() => setConciliacionMasivaModal(p => ({ ...p, open: false, comprobantes: [], movimientos: [] }))}
                  className="text-gray-400 hover:text-gray-655 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-gray-150 dark:divide-gray-800 min-h-0">
                {/* Lado Izquierdo: Tickets */}
                <div className="flex flex-col min-h-0 bg-gray-50/30 dark:bg-gray-900/10">
                  <div className="p-3 border-b border-gray-150 dark:border-gray-800 shrink-0 flex justify-between items-center bg-white dark:bg-gray-955">
                    <h4 className="text-xs font-black uppercase text-gray-500 flex items-center gap-2">
                      <Ticket size={14} className="text-amber-500" /> 1. Tickets Disponibles ({availableTickets.length})
                    </h4>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
                      {selectedTickets.length} selec.
                    </span>
                  </div>
                  <div className="flex-1 overflow-auto p-3 space-y-2 font-sans">
                    {availableTickets.map(c => {
                      const isSelected = conciliacionMasivaModal.comprobantes.includes(c.id);
                      const linkedSum = (c.comprobantes_deposito_movimientos || []).reduce((a, r) => a + Number(r.monto_asociado), 0);
                      const pendingAmt = Number(c.monto) - linkedSum;
                      return (
                        <label key={c.id} className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${isSelected ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-955/20 shadow-sm' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-955 hover:border-amber-300'}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setConciliacionMasivaModal(p => {
                                const next = new Set(p.comprobantes);
                                if (e.target.checked) next.add(c.id); else next.delete(c.id);
                                return { ...p, comprobantes: Array.from(next) };
                              });
                            }}
                            className="mt-0.5 accent-amber-500 w-4 h-4 rounded cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[9px] font-mono text-gray-500">{new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</span>
                              <span className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded uppercase font-bold">{c.tipo.replace('_', ' ')}</span>
                            </div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{c.descripcion || 'Sin descripción'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-black font-mono text-gray-900 dark:text-white">{formatCurrency(pendingAmt)}</div>
                            {linkedSum > 0 && <div className="text-[9px] text-emerald-500 font-bold">Total: {formatCurrency(c.monto)}</div>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Lado Derecho: Depósitos */}
                <div className="flex flex-col min-h-0 bg-gray-50/30 dark:bg-gray-900/10">
                  <div className="p-3 border-b border-gray-150 dark:border-gray-800 shrink-0 flex justify-between items-center bg-white dark:bg-gray-955">
                    <h4 className="text-xs font-black uppercase text-gray-500 flex items-center gap-2">
                      <Landmark size={14} className="text-emerald-500" /> 2. Depósitos Bancarios ({availableDeposits.length})
                    </h4>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                      {selectedDeposits.length} selec.
                    </span>
                  </div>
                  <div className="flex-1 overflow-auto p-3 space-y-2 font-sans">
                    {availableDeposits.map(m => {
                      const isSelected = conciliacionMasivaModal.movimientos.includes(m.id);
                      const linkedSum = comprobantes.reduce((a, c) => {
                        const rel = c.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === m.id);
                        return a + (rel ? Number(rel.monto_asociado) : 0);
                      }, 0);
                      const pendingAmt = Number(m.deposito || m.monto) - linkedSum;
                      return (
                        <label key={m.id} className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${isSelected ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-955/20 shadow-sm' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-955 hover:border-emerald-300'}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              setConciliacionMasivaModal(p => {
                                const next = new Set(p.movimientos);
                                if (e.target.checked) next.add(m.id); else next.delete(m.id);
                                return { ...p, movimientos: Array.from(next) };
                              });
                            }}
                            className="mt-0.5 accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[9px] font-mono text-gray-500">{new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</span>
                              {m.referencia && <span className="text-[8px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded font-bold truncate max-w-[100px]">Ref: {m.referencia}</span>}
                            </div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 line-clamp-2">{m.concepto}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">+{formatCurrency(pendingAmt)}</div>
                            {linkedSum > 0 && <div className="text-[9px] text-gray-400 font-bold">Total: {formatCurrency(m.deposito || m.monto)}</div>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer de Totales y Acción */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-955 flex items-center justify-between shrink-0 rounded-b-2xl">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Suma Tickets</span>
                    <span className="text-lg font-black font-mono text-amber-500">{formatCurrency(sumTickets)}</span>
                  </div>
                  <div className="text-gray-300 dark:text-gray-700 text-2xl font-light">-</div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Suma Depósitos</span>
                    <span className="text-lg font-black font-mono text-emerald-500">{formatCurrency(sumDeposits)}</span>
                  </div>
                  <div className="text-gray-300 dark:text-gray-700 text-2xl font-light">=</div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Diferencia</span>
                    <span className={`text-lg font-black font-mono ${Math.abs(diff) < 0.05 ? 'text-gray-800 dark:text-gray-200' : (diff > 0 ? 'text-red-500' : 'text-blue-500')}`}>
                      {formatCurrency(diff)}
                    </span>
                  </div>
                  {diff > 0.05 && sumDeposits > 0 && (
                    <div className="ml-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-2 rounded-lg text-[10px] text-red-700 dark:text-red-400 max-w-xs flex items-start gap-1.5 leading-tight">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <p><b>Diferencia detectada:</b> Si este saldo es comisión de la plataforma, se registrará y enviará a la cuenta de comisiones.</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConciliacionMasivaModal(p => ({ ...p, open: false }))}
                    className="px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={conciliacionMasivaModal.loading || selectedTickets.length === 0 || selectedDeposits.length === 0}
                    onClick={async () => {
                      if (diff > 0.05) {
                        const isCommission = confirm(`Has seleccionado ${formatCurrency(sumTickets)} en Tickets, pero el banco solo depositó ${formatCurrency(sumDeposits)}.\n\nFaltan ${formatCurrency(diff)}.\n\n¿Deseas registrar esta diferencia como "Comisión Retenida" y continuar con la vinculación?`);
                        if (!isCommission) return;
                      } else if (diff < -0.05) {
                        alert(`⛔ Tienes más dinero en depósitos (${formatCurrency(sumDeposits)}) que tickets seleccionados (${formatCurrency(sumTickets)}). Por favor selecciona más tickets o deselecciona depósitos.`);
                        return;
                      }

                      setConciliacionMasivaModal(p => ({ ...p, loading: true }));
                      try {
                        // Si hay comisión retenida (diff > 0.05), la registramos como un comprobante de comisión
                        if (diff > 0.05 && onCrearComprobante) {
                          await onCrearComprobante({
                            tipo: 'deposito_ventanilla',
                            fecha: selectedTickets[0]?.fecha || new Date().toISOString().substring(0, 10),
                            monto: diff,
                            descripcion: `Comisión / Descuento Plataforma (Retención Múltiple) - Diferencia tickets vs depósitos`,
                            cuentaBancariaId: selectedTickets[0]?.cuenta_bancaria_id || selectedCuentaId || null
                          });
                        }

                        // ALGORITMO FIFO SIMPLE (M:N)
                        const tQueue = selectedTickets.map(c => {
                          const linkedSum = (c.comprobantes_deposito_movimientos || []).reduce((a, r) => a + Number(r.monto_asociado), 0);
                          return { id: c.id, pending: Number(c.monto) - linkedSum };
                        }).sort((a,b) => a.id.localeCompare(b.id));

                        const dQueue = selectedDeposits.map(m => {
                          const linkedSum = comprobantes.reduce((a, c) => {
                            const rel = c.comprobantes_deposito_movimientos?.find(r => r.movimiento_id === m.id);
                            return a + (rel ? Number(rel.monto_asociado) : 0);
                          }, 0);
                          return { id: m.id, pending: Number(m.deposito || m.monto) - linkedSum };
                        }).sort((a,b) => a.id.localeCompare(b.id));

                        let dIdx = 0;
                        for (let i = 0; i < tQueue.length; i++) {
                          const t = tQueue[i];
                          while (t.pending > 0.01 && dIdx < dQueue.length) {
                            const d = dQueue[dIdx];
                            const linkAmt = Math.min(t.pending, d.pending);
                            
                            if (linkAmt > 0.01) {
                              const res = await onVincularComprobante?.(t.id, d.id, linkAmt);
                              if (res && !res.success) {
                                alert('Error al vincular: ' + res.error);
                                setConciliacionMasivaModal(p => ({ ...p, loading: false }));
                                return;
                              }
                            }

                            t.pending -= linkAmt;
                            d.pending -= linkAmt;
                            
                            if (d.pending <= 0.01) {
                              dIdx++;
                            }
                          }
                        }

                        setConciliacionMasivaModal({ open: false, comprobantes: [], movimientos: [], loading: false, error: '', result: null });
                        onReloadMovimientos?.();
                      } catch (err: any) {
                        alert(err.message || 'Error en conciliación');
                        setConciliacionMasivaModal(p => ({ ...p, loading: false }));
                      }
                    }}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg transition-all flex items-center gap-2"
                  >
                    {conciliacionMasivaModal.loading ? <RefreshCw size={14} className="animate-spin" /> : <Link size={14} />}
                    {conciliacionMasivaModal.loading ? 'Vinculando...' : 'Vincular Seleccionados'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      <AutoConciliacionModal
        isOpen={autoConciliacionModalOpen}
        onClose={() => setAutoConciliacionModalOpen(false)}
        propuestas={propuestasAutoConciliacion}
        loading={loadingPropuestas}
        isApplying={isApplyingPropuestas}
        onApply={handleApplyPropuestas}
        onAdjustManual={(mov) => {
          setAutoConciliacionModalOpen(false);
          handleOpenReconcileModal?.(mov);
        }}
        onDownloadFile={onDownloadFile}
      />
      <HistorialConciliacionModal
        open={!!historialMovimiento}
        onClose={() => setHistorialMovimiento(null)}
        movimiento={historialMovimiento}
        allMovimientos={movimientos}
        onRefresh={onReloadMovimientos}
        onDownloadFile={onDownloadFile}
        onOpenReconcileModal={handleOpenReconcileModal}
        token={token}
      />
    </div>
  );
}
