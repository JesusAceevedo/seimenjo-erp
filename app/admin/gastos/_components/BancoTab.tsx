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
  Layers, Check, X, UploadCloud
} from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import type { MovimientoBancario, EstatusConciliacion, GastoReconciliable, FormaPago } from '../../types';
import { supabase } from '../../../../lib/supabase';

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
  bancoSubTab: 'movimientos' | 'global';
  setBancoSubTab: (sub: 'movimientos' | 'global') => void;

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
  handleSaveReconciliation?: (customGastosIds?: string[], customEstatusClave?: string, customPedidosIds?: string[]) => void;
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

const SAT_FORMAS_PAGO_FE = [
  { codigo: '01', nombre: 'Efectivo' },
  { codigo: '02', nombre: 'Cheque nominativo' },
  { codigo: '03', nombre: 'Transferencia electrónica' },
  { codigo: '04', nombre: 'Tarjeta de crédito' },
  { codigo: '05', nombre: 'Monedero electrónico' },
  { codigo: '06', nombre: 'Dinero electrónico' },
  { codigo: '08', nombre: 'Vales de despensa' },
  { codigo: '12', nombre: 'Dación en pago' },
  { codigo: '13', nombre: 'Pago por subrogación' },
  { codigo: '14', nombre: 'Pago por consignación' },
  { codigo: '15', nombre: 'Condonación' },
  { codigo: '17', nombre: 'Compensación' },
  { codigo: '23', font: 'Novación' },
  { codigo: '24', nombre: 'Confusión' },
  { codigo: '25', nombre: 'Remisión de deuda' },
  { codigo: '26', nombre: 'Prescripción o caducidad' },
  { codigo: '27', nombre: 'A satisfacción del acreedor' },
  { codigo: '28', nombre: 'Tarjeta de débito' },
  { codigo: '29', nombre: 'Tarjeta de servicios' },
  { codigo: '30', nombre: 'Aplicación de anticipos' },
  { codigo: '31', nombre: 'Intermediario pagos' },
  { codigo: '99', nombre: 'Por definir' }
];

function getMetodoPagoLabel(codigo?: string): string {
  if (!codigo) return 'Desconocido';
  const cleanCode = codigo.trim().padStart(2, '0');
  const found = SAT_FORMAS_PAGO_FE.find(fp => fp.codigo === cleanCode);
  return found ? `${found.codigo} - ${found.nombre}` : `${cleanCode} - Otro`;
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
}: BancoTabProps) {

  const [tiposSelected, setTiposSelected] = React.useState<string[]>([]);
  const [estatusSelected, setEstatusSelected] = React.useState<string[]>([]);
  const [visibilidadesSelected, setVisibilidadesSelected] = React.useState<string[]>([]);
  const [categoriasSelected, setCategoriasSelected] = React.useState<string[]>([]);
  const [selectedMovimientos, setSelectedMovimientos] = React.useState<string[]>([]);

  const [uploadedXmlAmounts, setUploadedXmlAmounts] = React.useState<{[key: string]: number}>({});

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
      const { data } = supabase.storage.from('facturas').getPublicUrl(path);
      if (!data?.publicUrl) return 0;
      const res = await fetch(data.publicUrl);
      if (!res.ok) return 0;
      const text = await res.text();
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
    if (reconcileModal.open) {
      const paths = reconcileModal.xmlUrl ? reconcileModal.xmlUrl.split(',').filter(Boolean) : [];
      
      // Clean up deleted paths
      setUploadedXmlAmounts(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(key => {
          const stillExists = paths.some(p => p === key || p.endsWith(key));
          if (!stillExists) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });

      // Fetch newly added paths
      paths.forEach((path) => {
        setUploadedXmlAmounts(prev => {
          if (prev[path]) return prev;
          (async () => {
            const amt = await fetchAndParseXmlAmount(path);
            if (amt > 0) {
              setUploadedXmlAmounts(p => ({ ...p, [path]: amt }));
            }
          })();
          return prev;
        });
      });
    } else {
      setUploadedXmlAmounts({});
    }
  }, [reconcileModal.open, reconcileModal.xmlUrl]);

  const handleXmlUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const amount = await parseXmlTotal(file);
      if (amount > 0) {
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
          { key: 'global', label: 'Facturación Global (Ingresos)', icon: <Scale size={14} /> },
          ] as const).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => {
              setBancoSubTab(key);
              if (key === 'global') {
                setSelectedGlobalDepositId(null);
                setSelectedGlobalPedidosIds([]);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${bancoSubTab === key
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
              : 'text-gray-400 hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            {icon} {label}
          </button>
        ))}
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

                  <div className="relative overflow-hidden shrink-0">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleExcelUpload}
                      disabled={!selectedCuentaId || isUploading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={!selectedCuentaId || isUploading}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-md"
                    >
                      {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                      {excelFile ? excelFile.name : 'Cargar Estado'}
                    </button>
                  </div>

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
                  const depositos = filtered.filter(m => m.tipo_movimiento === 'Deposito').reduce((acc, m) => acc + Number(m.monto), 0);
                  const retiros = filtered.filter(m => m.tipo_movimiento === 'Retiro').reduce((acc, m) => acc + Number(m.monto), 0);
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

                {/* Grid de Checklists de Filtro */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-sans">
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
                            {isRetiro
                              ? <span className="text-red-500">-{formatCurrency(m.retiro)}</span>
                              : <span className="text-emerald-500">+{formatCurrency(m.deposito)}</span>}
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
                              ) : m.xml_url && onViewCfdi ? (
                                <button onClick={() => onViewCfdi(m.xml_url!.split(',')[0])}
                                  className="p-1 rounded text-[10px] text-red-500 hover:bg-red-500/10 flex items-center gap-0.5" title="Ver Representación PDF">
                                  <FileText size={13} />
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

        {/* ── SUB-TAB 2: FACTURACIÓN GLOBAL ───────────────────────────────── */}
        {bancoSubTab === 'global' && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden min-h-0">
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
                        <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No hay depósitos pendientes de conciliar</td></tr>
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
                          <th className="p-3 text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                        {pedidosPendientes.map((p) => (
                          <tr key={p.id}
                            onClick={() => {
                              const idx = selectedGlobalPedidosIds.indexOf(p.id);
                              const newIds = [...selectedGlobalPedidosIds];
                              idx > -1 ? newIds.splice(idx, 1) : newIds.push(p.id);
                              setSelectedGlobalPedidosIds(newIds);
                            }}
                            className="cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-900/20 transition-all">
                            <td className="p-3 text-center">
                              <input type="checkbox" checked={selectedGlobalPedidosIds.includes(p.id)}
                                onChange={() => {}} className="w-3.5 h-3.5 text-emerald-500 focus:ring-emerald-500 rounded" />
                            </td>
                            <td className="p-3 font-mono font-bold">#{p.numero_pedido}</td>
                            <td className="p-3">
                              <div className="font-semibold text-gray-800 dark:text-gray-200">{p.cliente_nombre || 'Cliente General'}</div>
                              {p.fecha_pedido && <span className="text-[10px] text-gray-400">{new Date(p.fecha_pedido).toLocaleDateString()}</span>}
                            </td>
                            <td className="p-3 text-right font-mono font-bold">{formatCurrency(p.precio_total)}</td>
                          </tr>
                        ))}
                        {pedidosPendientes.length === 0 && (
                          <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">No hay pedidos pendientes de asociar</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Resumen y acción */}
            {selectedGlobalDepositId && (() => {
              const dep = movimientos.find((m) => m.id === selectedGlobalDepositId);
              const depMonto = dep ? Number(dep.deposito || dep.monto) : 0;
              const totalVentas = pedidosPendientes.filter((p) => selectedGlobalPedidosIds.includes(p.id)).reduce((s, p) => s + Number(p.precio_total || 0), 0);
              const dif = depMonto - totalVentas;
              const match = Math.abs(dif) < 0.05;
              return (
                <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex justify-between items-center flex-wrap gap-4 shrink-0 font-sans">
                  <div className="flex gap-6 flex-wrap text-xs">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">Depósito Bancario:</span>
                      <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">{formatCurrency(depMonto)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">Ventas Seleccionadas ({selectedGlobalPedidosIds.length}):</span>
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalVentas)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400 block">Diferencia:</span>
                      <span className={`text-base font-mono font-extrabold ${match ? 'text-emerald-500' : 'text-amber-500'}`}>{formatCurrency(dif)}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleGlobalLink}
                    disabled={selectedGlobalPedidosIds.length === 0 || isUploading}
                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                  >
                    {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    Asociar y Conciliar
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        

        

      </div>

      {/* ── MODAL DE CONCILIACIÓN MANUAL (overlay global) ──────────────────── */}
      {reconcileModal.open && reconcileModal.movimiento && (() => {
        const isOutflow = reconcileModal.movimiento.tipo_movimiento === 'Retiro';
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
              {(() => {
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
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex justify-between items-center flex-wrap gap-4 font-sans">
                    <div className="flex gap-6 flex-wrap text-xs">
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
                );
              })()}

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

              {reconcileModal.error && (
                <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 rounded-lg">{reconcileModal.error}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setReconcileModal((p) => ({ ...p, open: false }))} disabled={reconcileModal.loading}
                  className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={() => handleSaveReconciliation && handleSaveReconciliation()} disabled={reconcileModal.loading || !reconcileModal.estatusClave}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2">
                  {reconcileModal.loading ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</> : <><Check size={14} /> Guardar Conciliación</>}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
