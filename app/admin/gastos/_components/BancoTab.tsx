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
  Layers, Check, X, UploadCloud, Paperclip, AlertTriangle, Filter, Eye
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
  precio_total: number;
  cliente_nombre?: string;
  fecha_pedido?: string;
}

export interface BancoTabProps {
  // Sub-tab activo
  bancoSubTab: 'movimientos' | 'ingresos_comprobantes' | 'cargas' | 'global' | 'comprobantes';
  setBancoSubTab: (sub: 'movimientos' | 'ingresos_comprobantes' | 'cargas' | 'global' | 'comprobantes') => void;

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
  handleOpenReconcileModal?: (m: MovimientoBancario) => void;
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
  onCrearComprobante?: (payload: any) => Promise<any>;
  onActualizarComprobante?: (id: string, payload: any) => Promise<any>;
  onEliminarComprobante?: (id: string) => Promise<any>;
  onVincularComprobante?: (comprobanteId: string, movimientoBancarioId: string, montoAsociado?: number) => Promise<any>;
  onDesvincularComprobante?: (comprobanteId: string, movimientoBancarioId?: string | null) => Promise<any>;
  onFusionarReembolso?: (movId1: string, movId2: string, payload: { soporteReembolsoUrl?: string | null; comentarios?: string | null }) => Promise<any>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function filterMovimientos(
  movimientos: MovimientoBancario[],
  busqueda: string,
  tiposSelected: string[],
  estatusSelected: string[],
  visibilidadesSelected: string[],
  categoriasSelected: string[],
  cuentaId: string
): MovimientoBancario[] {
  return movimientos.filter((m) => {
    if (cuentaId && m.cuenta_bancaria_id !== cuentaId) return false;
    if (busqueda.trim()) {
      const b = busqueda.toLowerCase();
      if (
        !m.concepto?.toLowerCase().includes(b) &&
        !m.referencia?.toLowerCase().includes(b) &&
        !String(m.monto).includes(b) &&
        !m.rfc_proveedor?.toLowerCase().includes(b)
      ) return false;
    }
    
    // Tipo filter (exclusion checklist: checked = hide)
    if (tiposSelected.includes(m.tipo_movimiento)) return false;
    
    // Estatus filter (exclusion checklist: checked = hide)
    const estatusClave = m.estatus_conciliacion_bancaria?.clave || 'pendiente';
    if (estatusSelected.includes(estatusClave)) return false;
    
    // Visibilidad filter (exclusion checklist: checked = hide)
    if (visibilidadesSelected.length > 0) {
      if (visibilidadesSelected.includes('visibles_egresos') && m.visible_egresos) return false;
      if (visibilidadesSelected.includes('visibles_ingresos') && m.visible_ingresos) return false;
      if (visibilidadesSelected.includes('ocultos') && !m.visible_egresos && !m.visible_ingresos) return false;
    }

    // Categoría filter (exclusion checklist: checked = hide)
    const catId = m.categoria_movimiento_id || 'sin_categoria';
    if (categoriasSelected.includes(catId)) return false;
    
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
  const [ingresosSubSeccion, setIngresosSubSeccion] = React.useState<'comprobantes' | 'global'>('comprobantes');

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

  const [newCompForm, setNewCompForm] = React.useState<{
    tipo: 'deposito_ventanilla' | 'corte_tarjeta';
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
    propinaAmex: ''
  });

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
          'Tipo': isVentanilla ? 'Depósito Ventanilla' : 'Corte Tarjeta',
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

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">

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
                    disabled={!selectedCuentaId}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md"
                    title="Exportar Reporte Excel"
                  >
                    <FileSpreadsheet size={14} />
                    Exportar Reporte
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
                      {selectedMovimientos.length} movimientos seleccionados
                    </span>
                    <button
                      onClick={() => setSelectedMovimientos([])}
                      className="text-[10px] text-gray-550 hover:text-red-500 underline"
                    >
                      Desmarcar todos
                    </button>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
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

                            {/* Mostrar detalles de la conciliación si existen */}
                            {m.conciliaciones_bancarias && m.conciliaciones_bancarias.length > 0 && (
                              <div className="mt-2 space-y-1.5">
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
                            )}

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
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold border"
                              style={{ backgroundColor: `${color}15`, borderColor: `${color}40`, color }}>
                              {m.estatus_conciliacion_bancaria?.nombre || 'Pendiente'}
                            </span>
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
                              {m.pdf_ticket_url ? m.pdf_ticket_url.split(',').filter(Boolean).map((url, i, a) => (
                                <button key={i} onClick={() => onDownloadFile(url)}
                                  className="p-1 rounded text-[10px] text-amber-500 hover:bg-amber-500/10 flex items-center gap-0.5" title={`Ticket ${i + 1}`}>
                                  <CreditCard size={13} />{a.length > 1 && <span className="text-[8px] font-bold font-mono">{i + 1}</span>}
                                </button>
                              )) : <button disabled className="p-1 rounded text-[10px] text-gray-300 cursor-not-allowed"><CreditCard size={13} /></button>}
                              
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
          <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
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
            </div>

            {ingresosSubSeccion === 'comprobantes' ? (
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
                          value={newCompForm.tipo}
                          onChange={(e) => setNewCompForm(p => ({ ...p, tipo: e.target.value as any }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                        >
                          <option value="deposito_ventanilla">Depósito en Ventanilla</option>
                          <option value="corte_tarjeta">Corte Diario de Tarjeta</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Fecha</label>
                          <input
                            type="date"
                            value={newCompForm.fecha}
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
                              value={newCompForm.monto}
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
                                            parseInputNumber(newCompForm.montoCredito || 0) +
                                            parseInputNumber(newCompForm.montoAmex || 0);
                                return formatCurrency(tot);
                              })()}
                            </div>
                          </div>
                        )}
                      </div>

                      {newCompForm.tipo === 'corte_tarjeta' && (
                        <div className="p-3 bg-amber-50/50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-2.5">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Desglose por Tipo de Tarjeta</span>
                          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                            <div>
                              <label className="text-[9px] text-gray-500 block">Débito</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={newCompForm.montoDebito}
                                onChange={(e) => setNewCompForm(p => ({ ...p, montoDebito: e.target.value }))}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-gray-500 block">Crédito</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={newCompForm.montoCredito}
                                onChange={(e) => setNewCompForm(p => ({ ...p, montoCredito: e.target.value }))}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-gray-500 block">AMEX</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={newCompForm.montoAmex}
                                onChange={(e) => setNewCompForm(p => ({ ...p, montoAmex: e.target.value }))}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded text-xs text-gray-900 dark:text-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Cuenta de Destino Relacionada</label>
                        <select
                          value={newCompForm.cuentaBancariaId}
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
                          value={newCompForm.descripcion}
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
                              propinaAmex: ''
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
                              parseInputNumber(newCompForm.propinaAmex || 0);

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
                              propina_amex: parseInputNumber(newCompForm.propinaAmex || 0)
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
                              propinaAmex: ''
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
                      <h4 className="text-xs font-extrabold uppercase text-amber-500 flex items-center gap-1.5">
                        <List size={14} /> Comprobantes Registrados y Conciliación
                      </h4>
                      <span className="text-[10px] font-bold text-gray-400">
                        {comprobantes.length} comprobantes en total
                      </span>
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
                          {comprobantes.map(c => {
                            const isVentanilla = c.tipo === 'deposito_ventanilla';
                            const sumAsoc = c.comprobantes_deposito_movimientos?.reduce((s, r) => s + Number(r.monto_asociado || 0), 0) || 0;
                            const isFullyAssoc = Math.abs(Number(c.monto) - sumAsoc) < 0.05;

                            return (
                              <tr key={c.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/20 transition-all">
                                <td className="p-3 font-mono text-gray-500">{new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</td>
                                <td className="p-3">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                                      isVentanilla ? 'bg-blue-100 dark:bg-blue-955/30 text-blue-600 dark:text-blue-400' : 'bg-purple-100 dark:bg-purple-955/30 text-purple-600 dark:text-purple-400'
                                    }`}>
                                      {isVentanilla ? 'Depósito Ventanilla' : 'Corte Tarjeta'}
                                    </span>
                                    {isFullyAssoc ? (
                                      <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-955/30 dark:text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Conciliado</span>
                                    ) : (
                                      <span className="bg-amber-100 text-amber-700 dark:bg-amber-955/30 dark:text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Pendiente</span>
                                    )}
                                  </div>
                                  {!isVentanilla && (
                                    <div className="mt-1 text-[9px] text-gray-400 font-mono space-y-0.5">
                                      {c.monto_debito > 0 && <div>D: {formatCurrency(c.monto_debito)}</div>}
                                      {c.monto_credito > 0 && <div>C: {formatCurrency(c.monto_credito)}</div>}
                                      {c.monto_amex > 0 && <div>A: {formatCurrency(c.monto_amex)}</div>}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-gray-600 dark:text-gray-300 font-semibold">{c.cuentas_bancarias?.nombre || '-'}</td>
                                <td className="p-3 text-gray-700 dark:text-gray-200">{c.descripcion || '-'}</td>
                                <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                                  {formatCurrency(c.monto)}
                                  {sumAsoc > 0 && (
                                    <div className="text-[9px] font-normal text-emerald-500">Asoc: {formatCurrency(sumAsoc)}</div>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  {c.ticket_url ? (
                                    <button
                                      onClick={() => handleViewTicket(c.ticket_url!)}
                                      className="p-1 bg-amber-50 dark:bg-amber-955/20 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded border border-amber-200 dark:border-amber-900/40 text-[9px] font-bold inline-flex items-center gap-0.5"
                                    >
                                      <Eye size={10} /> Ver
                                    </button>
                                  ) : (
                                    <span className="text-[9px] text-gray-400 italic">Sin Ticket</span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => {
                                        setEditingCompId(c.id);
                                        setNewCompForm({
                                          tipo: c.tipo,
                                          fecha: c.fecha,
                                          monto: String(c.monto || ''),
                                          montoDebito: String(c.monto_debito || ''),
                                          montoCredito: String(c.monto_credito || ''),
                                          montoAmex: String(c.monto_amex || ''),
                                          cuentaBancariaId: c.cuenta_bancaria_id || '',
                                          descripcion: c.descripcion || ''
                                        });
                                      }}
                                      className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-955/20 rounded font-bold text-[10px] flex items-center gap-0.5"
                                    >
                                      <Edit3 size={11} /> Editar
                                    </button>
                                    <button
                                      onClick={() => handleRemoveComprobante(c.id)}
                                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 rounded font-bold text-[10px]"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {comprobantes.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                                No hay comprobantes registrados en el período seleccionado.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 overflow-hidden">
                {/* Depósitos bancarios */}
                <div className="flex flex-col min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 shrink-0">
                    <h4 className="text-xs font-extrabold uppercase text-amber-500 flex items-center gap-1.5">
                      <CreditCard size={14} /> 1. Selecciona un Depósito Bancario
                    </h4>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                          <th className="p-3 w-12 text-center" />
                          <th className="p-3">Fecha</th>
                          <th className="p-3">Concepto</th>
                          <th className="p-3 text-right">Depósito</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                        {movimientos
                          .filter((m) => m.tipo_movimiento === 'Deposito' && m.estatus_conciliacion_bancaria?.clave !== 'comprobado')
                          .map((m) => (
                            <tr key={m.id}
                              onClick={() => { setSelectedGlobalDepositId(m.id); setSelectedGlobalPedidosIds([]); }}
                              className={`cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-900/20 transition-all ${selectedGlobalDepositId === m.id ? 'bg-amber-500/10 hover:bg-amber-500/15' : ''}`}>
                              <td className="p-3 text-center">
                                <input type="radio" name="global_deposit" checked={selectedGlobalDepositId === m.id}
                                  onChange={() => { setSelectedGlobalDepositId(m.id); setSelectedGlobalPedidosIds([]); }}
                                  className="w-3.5 h-3.5 text-amber-500 focus:ring-amber-500" />
                              </td>
                              <td className="p-3 font-mono text-gray-500">{new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</td>
                              <td className="p-3">
                                <div className="font-bold text-gray-800 dark:text-gray-200">{m.concepto}</div>
                                {m.referencia && <span className="text-[10px] text-gray-400">Ref: {m.referencia}</span>}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-500">+{formatCurrency(m.deposito)}</td>
                            </tr>
                          ))}
                        {movimientos.filter((m) => m.tipo_movimiento === 'Deposito' && m.estatus_conciliacion_bancaria?.clave !== 'comprobado').length === 0 && (
                          <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No hay depósitos pendientes de conciliar en este período</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pedidos pendientes */}
                <div className="flex flex-col min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-3 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 shrink-0 flex justify-between items-center">
                    <h4 className="text-xs font-extrabold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Layers size={14} /> 2. Selecciona las Ventas a Asociar
                    </h4>
                    {selectedGlobalDepositId && (
                      <button
                        onClick={() => {
                          const allIds = pedidosPendientes.map((p) => p.id);
                          const allSelected = selectedGlobalPedidosIds.length === pedidosPendientes.length;
                          setSelectedGlobalPedidosIds(allSelected ? [] : allIds);
                        }}
                        className="text-[10px] font-bold text-blue-500 hover:underline">
                        {selectedGlobalPedidosIds.length === pedidosPendientes.length ? 'Desmarcar Todos' : 'Seleccionar Todos'}
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto">
                    {!selectedGlobalDepositId ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                        <CreditCard size={32} className="text-amber-500 mb-2.5 opacity-50" />
                        <p className="text-xs font-semibold text-gray-500">Ningún depósito seleccionado</p>
                        <p className="text-[10px] text-gray-400 mt-1 max-w-[250px]">Selecciona un depósito bancario para desplegar los pedidos.</p>
                      </div>
                    ) : (
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
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SUB-TAB 4: CARGAS DE ESTADO DE CUENTA ───────────────────────── */}
        {bancoSubTab === 'cargas' && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
            <CargasTab
              token={token || ''}
              cuentasBancarias={cuentasBancarias || []}
              onStartSustituirCarga={onStartSustituirCarga || (() => {})}
              onReloadMovimientos={onReloadMovimientos || (() => {})}
              onOpenUploadModal={onOpenUploadModal || (() => {})}
            />
          </div>
        )}

        

        

      </div>

      {reconcileModal.open && reconcileModal.movimiento && (() => {
        const isOutflow = reconcileModal.movimiento.tipo_movimiento === 'Retiro';
        const movMonto = Math.abs(Number(reconcileModal.movimiento.monto));
        const totalEgresosSistema = isOutflow 
          ? gastosReconciliables
              .filter((g) => reconcileModal.gastosSeleccionados.includes(g.id))
              .reduce((s, g) => s + Number(g.monto), 0)
          : pedidosPendientes
              .filter((p) => reconcileModal.pedidosSeleccionados.includes(p.id))
              .reduce((s, p) => s + Number(p.precio_total), 0);
        const totalXmlsCargados = Object.values(uploadedXmlAmounts).reduce((s, val) => s + val, 0);
        const totalComprobado = totalEgresosSistema + totalXmlsCargados;
        const dif = movMonto - totalComprobado;
        const match = Math.abs(dif) < 0.05;
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setReconcileModal((p) => ({ ...p, open: false })); }}>
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[95vh] overflow-y-auto p-6 space-y-4 font-sans">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                    Conciliación de Movimiento - {reconcileModal.movimiento.fecha ? new Date(reconcileModal.movimiento.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : 'Sin Fecha'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Movimiento: <strong>{reconcileModal.movimiento.concepto}</strong> — {formatCurrency(reconcileModal.movimiento.monto)} {reconcileModal.movimiento.fecha && `— ${new Date(reconcileModal.movimiento.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}`}
                  </p>
                </div>
                <button onClick={() => setReconcileModal((p) => ({ ...p, open: false }))}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Búsqueda */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">
                  {isOutflow ? 'Buscar egreso' : 'Buscar pedido'}
                </label>
                <input type="text" value={manualMatchSearch} placeholder="Concepto, monto, RFC, número..."
                  onChange={(e) => setManualMatchSearch(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none transition-all" />
              </div>

              {/* Lista de egresos o pedidos reconciliables */}
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-2">
                  {isOutflow ? 'Egresos del Sistema' : 'Pedidos/Ventas del Sistema'}
                </label>
                <div className="space-y-1 max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl">
                  {isOutflow ? (
                    gastosReconciliables
                      .filter((g) => {
                        // Excluir egresos en efectivo
                        const metodo = String(g.metodo_pago || '').toLowerCase();
                        if (metodo.includes('efectivo') || metodo.includes('01')) {
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
                        const s = manualMatchSearch.toLowerCase();
                        return (
                          p.numero_pedido?.toLowerCase().includes(s) || 
                          String(p.precio_total).includes(s) ||
                          p.cliente_nombre?.toLowerCase().includes(s)
                        );
                      })
                      .map((p) => {
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
                                <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">Pedido #{p.numero_pedido}</div>
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
                    <div className="p-4 text-center text-xs text-gray-400 italic">No hay pedidos/ventas sin conciliar</div>
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
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs font-sans">
                  <div>
                    <span className="font-bold text-amber-900 dark:text-amber-300 block">Excedente de pago de {formatCurrency(dif)}</span>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      El pago bancario supera los comprobantes seleccionados. ¿Deseas guardar el excedente como Saldo a Favor del proveedor?
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-amber-800 dark:text-amber-300 shrink-0">
                    <input
                      type="checkbox"
                      checked={guardarExcedenteComoSaldoFavor}
                      onChange={(e) => setGuardarExcedenteComoSaldoFavor(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                    />
                    <span>Guardar Saldo a Favor</span>
                  </label>
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
                          value={newCompForm.tipo}
                          onChange={(e) => setNewCompForm(p => ({ ...p, tipo: e.target.value as any }))}
                          className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1.5 rounded-lg text-xs text-gray-900 dark:text-white"
                        >
                          <option value="deposito_ventanilla">Ventanilla</option>
                          <option value="corte_tarjeta">Corte Tarjeta</option>
                        </select>
                      </div>
                      {newCompForm.tipo === 'deposito_ventanilla' ? (
                        <div>
                          <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Monto</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            step="0.01"
                            value={newCompForm.monto}
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
                                          parseInputNumber(newCompForm.propinaAmex || 0);
                              return formatCurrency(tot);
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {newCompForm.tipo === 'corte_tarjeta' && (
                      <div className="p-2 bg-gray-100 dark:bg-gray-900/30 border border-gray-250 dark:border-gray-800 rounded-lg space-y-2 text-[9px] font-sans">
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="text-gray-400 font-bold block">Imp. Débito</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.montoDebito}
                              onChange={(e) => setNewCompForm(p => ({ ...p, montoDebito: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 font-bold block">Prop. Débito</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.propinaDebito}
                              onChange={(e) => setNewCompForm(p => ({ ...p, propinaDebito: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="text-gray-400 font-bold block">Imp. Crédito</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.montoCredito}
                              onChange={(e) => setNewCompForm(p => ({ ...p, montoCredito: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 font-bold block">Prop. Crédito</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.propinaCredito}
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
                              value={newCompForm.montoAmex}
                              onChange={(e) => setNewCompForm(p => ({ ...p, montoAmex: e.target.value }))}
                              className="w-full bg-white dark:bg-gray-955 border border-gray-300 dark:border-gray-700 p-1 rounded font-mono text-[10px] text-gray-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 font-bold block">Prop. Amex</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              value={newCompForm.propinaAmex}
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
                          value={newCompForm.fecha}
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
                            className="w-full py-1.5 bg-white hover:bg-gray-100 dark:bg-gray-950 dark:hover:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 text-gray-700 dark:text-gray-300"
                          >
                            {compUploadLoading ? <RefreshCw size={12} className="animate-spin" /> : <UploadCloud size={12} />}
                            {newCompForm.archivoUrl ? 'Cargado ✓' : 'Subir Ticket...'}
                          </button>
                        </div>
                      ) : (
                        <input
                          type="url"
                          placeholder="Enlace de Google Drive..."
                          value={newCompForm.archivoUrl}
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
                        value={newCompForm.descripcion}
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
                            parseInputNumber(newCompForm.propinaAmex || 0);

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
                            propina_debito: parseInputNumber(newCompForm.propinaDebito || 0),
                            propina_credito: parseInputNumber(newCompForm.propinaCredito || 0),
                            monto_amex: parseInputNumber(newCompForm.montoAmex || 0),
                            propina_amex: parseInputNumber(newCompForm.propinaAmex || 0)
                          });
                          if (res && !res.success) throw new Error(res.error);
                          
                          setNewCompForm(p => ({
                            ...p,
                            monto: '',
                            montoDebito: '',
                            montoCredito: '',
                            propinaDebito: '',
                            propinaCredito: '',
                            montoAmex: '',
                            propinaAmex: '',
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

        // Filtrar movimientos disponibles: excluir ya vinculados a ESTE comprobante, vinculados a otros comprobantes, y los ya completamente conciliados
        const availableMovs = movimientos.filter(m => 
          m.tipo_movimiento === 'Deposito' && 
          !associatedMovs.some(am => am.id === m.id) && 
          !comprobantes.some(c => c.id !== currentCompToLink.id && c.comprobantes_deposito_movimientos?.some(rel => rel.movimiento_id === m.id)) &&
          m.estatus_conciliacion_bancaria?.clave !== 'comprobado' &&
          (!currentCompToLink.cuenta_bancaria_id || m.cuenta_bancaria_id === currentCompToLink.cuenta_bancaria_id)
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
                      setLinkingBatch(true);
                      try {
                        const ids = Array.from(selectedLinkMovIds);
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
    </div>
  );
}
