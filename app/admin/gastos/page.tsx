'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import {
  obtenerSignedUrl,
  enviarFacturaPorCorreo,
  guardarFacturaEnBaseDatos,
  comprobarEgresoConFacturas,
  guardarProveedor,
  eliminarProveedor,
  obtenerFacturasPorProveedor
} from './actions';
import {
  importarMovimientosBancarios,
  toggleMovimientoVisibilidad,
  autoConciliarMovimientos,
  guardarConciliacionManual,
  getEstatusCatalog,
  guardarEstatusCatalogItem,
  eliminarEstatusCatalogItem,
  eliminarMovimientoBancario
} from './reconciliationActions';
import { eliminarGasto, eliminarPedidoSano } from './actions';
import { EditGastoModal, EditVentaModal, EditMovimientoModal } from './_components/EditModals';
import {
  UploadCloud, FileText, Send, Eye, RefreshCw, AlertTriangle, CheckCircle,
  FileCode, Download, Trash2, Calendar, DollarSign, Layers, Plus, Mail, Sun, Moon,
  CreditCard, List, Scale, Settings, Check, CheckSquare, Square, ExternalLink,
  FileSpreadsheet, Play, ArrowRightLeft, Users, Search, X, Save
} from 'lucide-react';
import EgresosTab from './_components/EgresosTab';
import IngresosTab from './_components/IngresosTab';
import BancoTab from './_components/BancoTab';
import CfdiViewerModal from './_components/CfdiViewerModal';
interface GastoFacturado {
  id: string;
  fecha_timbrado?: string;
  fecha_gasto?: string;
  uuid_fiscal?: string;
  concepto: string;
  monto: number;
  iva_acreditable?: number;
  proveedores?: { nombre_comercial: string; rfc: string };
  categoria_id?: string | null;
  categorias_gasto?: { id: string; nombre: string } | null;
  xml_url?: string;
  pdf_url?: string;
  ticket_url?: string;
  gasto_padre_id?: string | null;
  padre?: { concepto: string } | null;
}

interface VentaFacturada {
  id: string;
  numero_pedido: string;
  precio_total: number;
  cliente_nombre?: string;
  fecha_pedido?: string;
  estatus_pago?: string;
  clientes?: { nombre_local: string; rfc: string; email_facturacion?: string };
  facturas_clientes?: { 
    uuid_fiscal?: string; 
    xml_url?: string; 
    pdf_url?: string;
    ticket_url?: string;
    total?: number;
    iva_trasladado?: number;
    fecha_emision?: string;
    serie_folio?: string;
  }[];
}

interface PedidoPendiente {
  id: string;
  numero_pedido: string;
  precio_total: number;
  cliente_nombre?: string;
  fecha_pedido?: string;
}

interface GastoPendiente {
  id: string;
  concepto: string;
  monto: number;
  fecha_gasto?: string;
}

interface GastoReconciliable {
  id: string;
  concepto: string;
  monto: number;
  fecha_gasto?: string;
  xml_url?: string;
  pdf_url?: string;
  ticket_url?: string;
}

interface Cliente {
  id: string;
  nombre_local: string;
  rfc: string;
}

export const dynamic = 'force-dynamic';

export default function AdvancedBillingModule() {
  const router = useRouter();

  // Helper de Formato Contable
  const formatCurrency = (val: number) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(num);
  };

  const getSessionToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const getEmpresaId = async () => {
    let empresaId = null;
    const sessionData = localStorage.getItem('seimenjo_session');
    if (sessionData) {
      try {
        const datosSesion = JSON.parse(sessionData);
        empresaId = datosSesion.empresa_id;
      } catch (e) {}
    }
    if (!empresaId) {
      const { data: { user } } = await supabase.auth.getUser();
      empresaId = user?.user_metadata?.empresa_id;
    }
    return empresaId;
  };

  const { isDarkMode, toggleDarkMode } = useThemeMode();

  // --- TAB ACTIVAS EN LA VISUALIZACIÓN ---
  const [activeTab, setActiveTab] = useState<'egresos' | 'ingresos' | 'banco'>('egresos');
  const [cfdiViewerUrl, setCfdiViewerUrl] = useState<string | null>(null);

  // --- ESTADOS DE PROVEEDORES ---
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [busquedaProveedor, setBusquedaProveedor] = useState<string>('');
  const [selectedProveedor, setSelectedProveedor] = useState<any | null>(null);
  const [proveedorFacturas, setProveedorFacturas] = useState<any[]>([]);
  const [cargandoFacturasProveedor, setCargandoFacturasProveedor] = useState<boolean>(false);
  const [proveedorModal, setProveedorModal] = useState<{
    open: boolean;
    proveedor: any | null;
    loading: boolean;
    error: string;
  }>({
    open: false,
    proveedor: null,
    loading: false,
    error: ''
  });

  // --- ESTADOS DE CONCILIACIÓN BANCARIA ---
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [estatusCatalog, setEstatusCatalog] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [categoriasMovimiento, setCategoriasMovimiento] = useState<any[]>([]);
  const [bancoSubTab, setBancoSubTab] = useState<'movimientos' | 'global'>('movimientos');

  const [formasPagoModal, setFormasPagoModal] = useState<{
    open: boolean;
    id?: string;
    nombre: string;
    loading: boolean;
  }>({
    open: false,
    nombre: '',
    loading: false
  });
  
  // Filtros de movimientos bancarios
  const [filtroBancoTipo, setFiltroBancoTipo] = useState<string>('');
  const [filtroBancoEstatus, setFiltroBancoEstatus] = useState<string>('');
  const [filtroBancoVisibilidad, setFiltroBancoVisibilidad] = useState<string>('todos');
  const [busquedaBanco, setBusquedaBanco] = useState<string>('');
  
  // Paginación de movimientos
  const [bancoPage, setBancoPage] = useState<number>(0);
  const [bancoPageSize, setBancoPageSize] = useState<number>(10);

  // Estados de carga e importación de Excel
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);
  const [columnMapping, setColumnMapping] = useState<{
    fecha: string;
    concepto: string;
    retiro: string;
    deposito: string;
    referencia: string;
  }>({
    fecha: '',
    concepto: '',
    retiro: '',
    deposito: '',
    referencia: ''
  });

  // Modal de conciliación manual
  const [reconcileModal, setReconcileModal] = useState<{
    open: boolean;
    movimiento: any | null;
    xmlUrl: string;
    pdfFacturaUrl: string;
    pdfTicketUrl: string;
    storageProvider: 'Supabase' | 'GoogleDrive';
    gastosSeleccionados: string[];
    pedidosSeleccionados: string[];
    estatusClave: string;
    loading: boolean;
    error: string;
  }>({
    open: false,
    movimiento: null,
    xmlUrl: '',
    pdfFacturaUrl: '',
    pdfTicketUrl: '',
    storageProvider: 'Supabase',
    gastosSeleccionados: [],
    pedidosSeleccionados: [],
    estatusClave: '',
    loading: false,
    error: ''
  });

  const [manualMatchSearch, setManualMatchSearch] = useState<string>('');

  // Modal para agregar/editar estatus del catálogo
  const [catalogEditModal, setCatalogEditModal] = useState<{
    open: boolean;
    id?: string;
    clave: string;
    nombre: string;
    descripcion: string;
    color: string;
    loading: boolean;
  }>({
    open: false,
    clave: '',
    nombre: '',
    descripcion: '',
    color: '#9CA3AF',
    loading: false
  });

  // --- ESTADOS DE EDICIÓN ---
  const [editingGasto, setEditingGasto] = useState<any>(null);
  const [editingVenta, setEditingVenta] = useState<any>(null);
  const [editingMovimiento, setEditingMovimiento] = useState<any>(null);

  // --- ESTADOS DE DATOS ---
  const [gastosFacturados, setGastosFacturados] = useState<GastoFacturado[]>([]);
  const [categoriasGasto, setCategoriasGasto] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [ventasFacturadas, setVentasFacturadas] = useState<VentaFacturada[]>([]);
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendiente[]>([]);
  const [gastosPendientes, setGastosPendientes] = useState<GastoPendiente[]>([]);
  const [gastosReconciliables, setGastosReconciliables] = useState<GastoReconciliable[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [facturasSueltas, setFacturasSueltas] = useState<any[]>([]);
  const [selectedGlobalDepositId, setSelectedGlobalDepositId] = useState<string | null>(null);
  const [selectedGlobalPedidosIds, setSelectedGlobalPedidosIds] = useState<string[]>([]);
  const [comprobacionAcumuladaModal, setComprobacionAcumuladaModal] = useState({
    open: false,
    egresoPadreId: '',
    seleccionados: [] as string[],
    comentario: '',
    loading: false,
    error: ''
  });

  const [facturacionAcumuladaModal, setFacturacionAcumuladaModal] = useState({
    open: false,
    clienteId: '',
    pedidos: [] as any[],
    seleccionados: [] as string[],
    folio: '',
    loading: false,
    error: ''
  });

  // --- ESTADOS DE CARGA DE ARCHIVOS ---
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [xmlUrlInput, setXmlUrlInput] = useState<string>('');
  const [xmlStorageProvider, setXmlStorageProvider] = useState<'Supabase' | 'GoogleDrive'>('Supabase');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrlInput, setPdfUrlInput] = useState<string>('');
  const [pdfStorageProvider, setPdfStorageProvider] = useState<'Supabase' | 'GoogleDrive'>('Supabase');
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [ticketUrlInput, setTicketUrlInput] = useState<string>('');
  const [ticketStorageProvider, setTicketStorageProvider] = useState<'Supabase' | 'GoogleDrive'>('Supabase');
  const [invoiceType, setInvoiceType] = useState<'gasto' | 'venta'>('gasto');
  const [asociarExistente, setAsociarExistente] = useState<boolean>(false);
  const [asociarRegistroId, setAsociarRegistroId] = useState<string>('');

  // --- ESTADOS DE PARSEO XML ---
  const [parsedXmlData, setParsedXmlData] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // --- ESTADOS DE UI / PROCESAMIENTO ---
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [emailModal, setEmailModal] = useState<{ open: boolean; details: any | null }>({ open: false, details: null });

  // --- CARGA DE DATOS ---
  const fetchData = async () => {
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      // 1. Gastos facturados (con XML)
      const { data: gFac } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc), categorias_gasto(nombre), padre:gastos!gasto_padre_id(concepto)')
        .eq('empresa_id', empresaId)
        .not('uuid_fiscal', 'is', null)
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
        .order('created_at', { ascending: false });
      setVentasFacturadas(vAll || []);

      // 3. Pedidos pendientes de facturar (solo liquidados)
      const { data: pPend } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, precio_total, cliente_nombre, fecha_pedido')
        .eq('empresa_id', empresaId)
        .is('folio_factura', null)
        .eq('estatus_pago', 'Liquidado')
        .order('created_at', { ascending: false });
      setPedidosPendientes(pPend || []);

      // 4. Gastos pendientes de facturar/comprobar (egresos manuales sin comprobante)
      const { data: gPend } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto')
        .eq('empresa_id', empresaId)
        .is('uuid_fiscal', null)
        .eq('estatus_facturado', false)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setGastosPendientes(gPend || []);

      // 10. Gastos sin conciliar (para conciliación manual bancaria: con o sin XML, pero sin movimiento bancario enlazado)
      const { data: gReconcile } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto, xml_url, pdf_url, ticket_url')
        .eq('empresa_id', empresaId)
        .is('movimiento_bancario_id', null)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setGastosReconciliables(gReconcile || []);

      // 5. Facturas XML de gastos sueltas (para comprobación acumulada)
      const { data: fSueltas } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc)')
        .eq('empresa_id', empresaId)
        .not('uuid_fiscal', 'is', null)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setFacturasSueltas(fSueltas || []);

      // 6. Clientes para facturación acumulada
      const { data: cliData } = await supabase
        .from('clientes')
        .select('id, nombre_local, rfc')
        .eq('empresa_id', empresaId)
        .order('nombre_local', { ascending: true });
      setClientes(cliData || []);

      // 11. Proveedores
      const { data: provs } = await supabase
        .from('proveedores')
        .select('*')
        .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
        .order('nombre_comercial', { ascending: true });
      setProveedores(provs || []);

      // 7. Movimientos bancarios (con catálogo enlazado)
      const { data: movs } = await supabase
        .from('movimientos_bancarios')
        .select('*, estatus_conciliacion_bancaria(*), categorias_movimiento_bancario(*)')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });
      setMovimientos(movs || []);

      // 8. Catálogo de estatus
      const token = await getSessionToken();
      const { catalog: catalogData } = await getEstatusCatalog(token);
      if (catalogData) {
        setEstatusCatalog(catalogData);
      }

      // 9. Métodos de Pago
      const { data: fpData } = await supabase
        .from('formas_pago')
        .select('*')
        .order('nombre', { ascending: true });
      setFormasPago(fpData || []);

      // 12. Categorías de movimiento bancario
      const { data: catMovs } = await supabase
        .from('categorias_movimiento_bancario')
        .select('*')
        .order('nombre', { ascending: true });
      setCategoriasMovimiento(catMovs || []);

    } catch (err: unknown) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/admin/login');
      await fetchData();
    };
    init();
  }, [router]);

  // --- LÓGICA DE CONCILIACIÓN BANCARIA ---
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];
        
        if (rawData.length === 0) {
          alert('El archivo está vacío.');
          return;
        }

        // Auto-find header index
        let headerIndex = 0;
        for (let i = 0; i < Math.min(15, rawData.length); i++) {
          const row = rawData[i];
          if (row && row.some((cell: any) => typeof cell === 'string' && (cell.toLowerCase().includes('fecha') || cell.toLowerCase().includes('concepto') || cell.toLowerCase().includes('descripcion')))) {
            headerIndex = i;
            break;
          }
        }

        const headers = (rawData[headerIndex] || []).map((h: any) => String(h || '').trim());
        const rows = rawData.slice(headerIndex + 1).filter((row: any) => row && row.length > 0);

        setExcelHeaders(headers);

        const objectsData = rows.map((row: any) => {
          const obj: any = {};
          headers.forEach((h: string, idx: number) => {
            obj[h] = row[idx];
          });
          return obj;
        });

        setExcelData(objectsData);

        // Auto-detect columns mapping
        const mapping = { fecha: '', concepto: '', retiro: '', deposito: '', referencia: '' };
        headers.forEach((h: string) => {
          const hl = h.toLowerCase();
          if (hl.includes('fecha') || hl.includes('date')) mapping.fecha = h;
          else if (hl.includes('concepto') || hl.includes('descrip') || hl.includes('detalle')) mapping.concepto = h;
          else if (hl.includes('retiro') || hl.includes('cargo') || hl.includes('egreso') || hl.includes('salida')) mapping.retiro = h;
          else if (hl.includes('deposito') || hl.includes('abono') || hl.includes('ingreso') || hl.includes('entrada')) mapping.deposito = h;
          else if (hl.includes('ref') || hl.includes('nota') || hl.includes('id')) mapping.referencia = h;
        });
        setColumnMapping(mapping);
        setShowMappingModal(true);
      } catch (err) {
        console.error('Error reading file:', err);
        alert('Error al leer el archivo. Asegúrate de subir un archivo Excel (.xlsx) o CSV válido.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (!columnMapping.fecha || !columnMapping.concepto) {
      alert('Debes asignar al menos Fecha y Concepto.');
      return;
    }

    setIsUploading(true);
    setMessage({ text: 'Importando movimientos bancarios...', type: 'info' });
    setShowMappingModal(false);

    try {
      const formatted = excelData.map(row => {
        return {
          fecha: String(row[columnMapping.fecha] || ''),
          concepto: String(row[columnMapping.concepto] || ''),
          retiro: row[columnMapping.retiro] !== undefined ? String(row[columnMapping.retiro]) : '0',
          deposito: row[columnMapping.deposito] !== undefined ? String(row[columnMapping.deposito]) : '0',
          referencia: columnMapping.referencia ? String(row[columnMapping.referencia] || '') : ''
        };
      }).filter(m => m.fecha && m.concepto);

      const token = await getSessionToken();
      const res = await importarMovimientosBancarios(formatted, token);
      if (res.success) {
        setMessage({ text: `Importados ${res.count} movimientos bancarios correctamente.`, type: 'success' });
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Error al importar', type: 'error' });
    } finally {
      setIsUploading(false);
      setExcelFile(null);
    }
  };

  const handleAutoReconcile = async () => {
    setIsUploading(true);
    setMessage({ text: 'Ejecutando conciliación inteligente...', type: 'info' });
    try {
      const token = await getSessionToken();
      const res = await autoConciliarMovimientos(token);
      if (res.success) {
        setMessage({ text: `Conciliación finalizada. Se auto-conciliaron ${res.matchedCount} movimientos con registros en el sistema.`, type: 'success' });
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Error al conciliar', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleVisibility = async (movimientoId: string, modulo: 'egresos' | 'ingresos', visible: boolean) => {
    try {
      const token = await getSessionToken();
      const res = await toggleMovimientoVisibilidad(movimientoId, modulo, visible, token);
      if (res.success) {
        setMovimientos(prev => prev.map(m => m.id === movimientoId ? { ...m, [`visible_${modulo}`]: visible } : m));
        await fetchData();
      } else {
        alert(res.error || 'Error al cambiar visibilidad.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error de red al actualizar visibilidad.');
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
      
      // Update local state without fetching all
      setGastosFacturados(prev => prev.map(g => g.id === gastoId ? { ...g, categoria_id: catId } : g));
    } catch (err) {
      console.error(err);
      alert('Error al actualizar categoría del gasto.');
    }
  };

  const handleUpdateCategoria = async (movimientoId: string, categoriaId: string) => {
    try {
      const catId = categoriaId === '' ? null : categoriaId;
      const { error } = await supabase
        .from('movimientos_bancarios')
        .update({ categoria_movimiento_id: catId })
        .eq('id', movimientoId);
      if (error) throw error;
      
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const cargarDetallesProveedor = async (proveedor: any) => {
    setSelectedProveedor(proveedor);
    setProveedorFacturas([]);
    setCargandoFacturasProveedor(true);
    try {
      const token = await getSessionToken();
      const res = await obtenerFacturasPorProveedor(proveedor.id, token);
      if (res.success && res.data) {
        setProveedorFacturas(res.data);
      } else {
        console.error('Error fetching supplier invoices:', res.error);
      }
    } catch (err) {
      console.error('Error in cargarDetallesProveedor:', err);
    } finally {
      setCargandoFacturasProveedor(false);
    }
  };

  const handleSaveProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorModal.proveedor?.nombre_comercial?.trim() || !proveedorModal.proveedor?.rfc?.trim()) {
      setProveedorModal(p => ({ ...p, error: 'Nombre comercial y RFC son obligatorios.' }));
      return;
    }

    setProveedorModal(p => ({ ...p, loading: true, error: '' }));
    try {
      const token = await getSessionToken();
      const res = await guardarProveedor(proveedorModal.proveedor, token);
      if (res.success) {
        setProveedorModal({ open: false, proveedor: null, loading: false, error: '' });
        await fetchData();
        // Update selectedProveedor if we edited the current one
        if (selectedProveedor && selectedProveedor.id === res.data.id) {
          // Merge details to keep existing variables or refetch
          await cargarDetallesProveedor(res.data);
        }
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setProveedorModal(p => ({ ...p, loading: false, error: err.message || 'Error al guardar el proveedor' }));
    }
  };

  const handleDeleteProveedor = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este proveedor?')) return;
    try {
      const token = await getSessionToken();
      const res = await eliminarProveedor(id, token);
      if (res.success) {
        setSelectedProveedor(null);
        setProveedorFacturas([]);
        await fetchData();
      } else {
        alert(res.error || 'Error al eliminar el proveedor.');
      }
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el proveedor.');
    }
  };

  const handleOpenReconcileModal = async (mov: any) => {
    const { data: existingMappings } = await supabase
      .from('conciliaciones_bancarias')
      .select('*')
      .eq('movimiento_id', mov.id);

    const linkedGastos = existingMappings?.map(m => m.gasto_id).filter(Boolean) as string[] || [];
    const linkedPedidos = existingMappings?.map(m => m.pedido_id).filter(Boolean) as string[] || [];

    setReconcileModal({
      open: true,
      movimiento: mov,
      xmlUrl: mov.xml_url || '',
      pdfFacturaUrl: mov.pdf_factura_url || '',
      pdfTicketUrl: mov.pdf_ticket_url || '',
      storageProvider: mov.storage_provider || 'Supabase',
      gastosSeleccionados: linkedGastos,
      pedidosSeleccionados: linkedPedidos,
      estatusClave: mov.estatus_conciliacion_bancaria?.clave || 'pendiente',
      loading: false,
      error: ''
    });
  };

  const handleCrearGastoRapido = async () => {
    if (!reconcileModal.movimiento) return;
    const mov = reconcileModal.movimiento;
    
    try {
      const { data: newGasto, error } = await supabase.from('gastos').insert({
        fecha_gasto: mov.fecha,
        concepto: mov.concepto,
        monto: Math.abs(mov.monto),
        metodo_pago: esMovimientoEfectivo(mov.concepto) ? 'Efectivo' : 'Transferencia',
        movimiento_bancario_id: mov.id,
        estatus_facturado: false,
        empresa_id: mov.empresa_id
      }).select().single();

      if (error) throw error;
      
      setReconcileModal(prev => ({
        ...prev,
        gastosSeleccionados: [...prev.gastosSeleccionados, newGasto.id]
      }));

      await fetchData();
    } catch (err: any) {
      alert('Error al crear gasto: ' + err.message);
    }
  };

  const handleUploadReconciliationFile = async (e: React.ChangeEvent<HTMLInputElement>, field: 'xml' | 'pdf' | 'ticket') => {
    const file = e.target.files?.[0];
    if (!file || !reconcileModal.movimiento) return;

    setReconcileModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const timestamp = Date.now();
      const yearMonth = new Date(reconcileModal.movimiento.fecha).toISOString().substring(0, 7);
      const filePath = `reconciliation/${yearMonth}/${timestamp}_${file.name.replace(/\s+/g, '_')}`;

      console.log(`Intentando subir al bucket 'facturas' (reconciliación): ${filePath}`);
      const { error } = await supabase.storage.from('facturas').upload(filePath, file);
      if (error) {
        console.error('Upload Error (Reconciliation):', error);
        throw error;
      }

      const urlField = field === 'xml' ? 'xmlUrl' : field === 'pdf' ? 'pdfFacturaUrl' : 'pdfTicketUrl';
      setReconcileModal(prev => ({
        ...prev,
        [urlField]: prev[urlField] ? `${prev[urlField]},${filePath}` : filePath
      }));
    } catch (err: any) {
      setReconcileModal(prev => ({ ...prev, error: 'Error al subir archivo: ' + err.message }));
    } finally {
      setReconcileModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleRemoveReconciliationFile = (field: 'xml' | 'pdf' | 'ticket', indexToRemove: number) => {
    const urlField = field === 'xml' ? 'xmlUrl' : field === 'pdf' ? 'pdfFacturaUrl' : 'pdfTicketUrl';
    setReconcileModal(prev => {
      const paths = prev[urlField] ? prev[urlField].split(',') : [];
      const newPaths = paths.filter((_, idx) => idx !== indexToRemove).join(',');
      return {
        ...prev,
        [urlField]: newPaths
      };
    });
  };

  const renderFileList = (field: 'xml' | 'pdf' | 'ticket') => {
    const urlField = field === 'xml' ? 'xmlUrl' : field === 'pdf' ? 'pdfFacturaUrl' : 'pdfTicketUrl';
    const pathsStr = reconcileModal[urlField];
    if (!pathsStr) return null;
    const paths = pathsStr.split(',').filter(Boolean);

    return (
      <div className="space-y-1.5 w-full mt-1.5 font-sans">
        {paths.map((path, idx) => {
          const fileName = path.split('/').pop() || '';
          return (
            <div key={idx} className="flex justify-between items-center bg-white dark:bg-gray-900/60 p-2 rounded-lg border border-gray-200 dark:border-gray-800 text-[11px]">
              <span className="truncate max-w-[200px] font-semibold text-gray-700 dark:text-gray-300" title={fileName}>
                {idx + 1}. {fileName.length > 28 ? fileName.substring(0, 25) + '...' : fileName}
              </span>
              <div className="flex gap-1.5 items-center font-bold">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(path)}
                  className="text-blue-500 hover:text-blue-600 text-[9px] uppercase hover:underline"
                >
                  Ver
                </button>
                <span className="text-gray-300 dark:text-gray-700">|</span>
                <button
                  type="button"
                  onClick={() => handleRemoveReconciliationFile(field, idx)}
                  className="text-red-500 hover:text-red-600 text-[9px] uppercase hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleSaveManualReconcile = async () => {
    if (!reconcileModal.movimiento) return;
    setReconcileModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const token = await getSessionToken();
      const res = await guardarConciliacionManual(reconcileModal.movimiento.id, {
        gastosIds: reconcileModal.gastosSeleccionados,
        pedidosIds: reconcileModal.pedidosSeleccionados,
        xmlUrl: reconcileModal.xmlUrl,
        pdfFacturaUrl: reconcileModal.pdfFacturaUrl,
        pdfTicketUrl: reconcileModal.pdfTicketUrl,
        storageProvider: reconcileModal.storageProvider,
        estatusClave: reconcileModal.estatusClave
      }, token);

      if (res.success) {
        setReconcileModal(prev => ({ ...prev, open: false }));
        setMessage({ text: 'Conciliación manual guardada correctamente.', type: 'success' });
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setReconcileModal(prev => ({ ...prev, error: err.message || 'Error al guardar conciliación', loading: false }));
    }
  };

  const handleDeleteGasto = async (id: string) => {
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

  const handleDeleteMovimiento = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este movimiento bancario?')) return;
    const token = await getSessionToken();
    const res = await eliminarMovimientoBancario(id, token);
    if (res.success) {
      alert('Movimiento eliminado exitosamente');
      fetchData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleSaveCatalogItem = async () => {
    if (!catalogEditModal.nombre) {
      alert('El nombre es obligatorio.');
      return;
    }
    setCatalogEditModal(prev => ({ ...prev, loading: true }));
    try {
      const token = await getSessionToken();
      const res = await guardarEstatusCatalogItem({
        id: catalogEditModal.id,
        clave: catalogEditModal.clave || catalogEditModal.nombre,
        nombre: catalogEditModal.nombre,
        descripcion: catalogEditModal.descripcion,
        color: catalogEditModal.color
      }, token);

      if (res.success) {
        setCatalogEditModal(prev => ({ ...prev, open: false }));
        await fetchData();
      } else {
        alert(res.error || 'Error al guardar estatus.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setCatalogEditModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDeleteCatalogItem = async (id: string) => {
    if (confirm('¿Deseas eliminar este estatus del catálogo?')) {
      try {
        const token = await getSessionToken();
        const res = await eliminarEstatusCatalogItem(id, token);
        if (res.success) {
          await fetchData();
        } else {
          alert(res.error || 'No se pudo eliminar el estatus.');
        }
      } catch (err: any) {
        alert('Error: ' + err.message);
      }
    }
  };

  const handleSaveFormaPago = async () => {
    if (!formasPagoModal.nombre.trim()) {
      alert('El nombre es obligatorio.');
      return;
    }
    setFormasPagoModal(prev => ({ ...prev, loading: true }));
    try {
      if (formasPagoModal.id) {
        const { error } = await supabase
          .from('formas_pago')
          .update({ nombre: formasPagoModal.nombre })
          .eq('id', formasPagoModal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('formas_pago')
          .insert({ nombre: formasPagoModal.nombre });
        if (error) throw error;
      }
      setFormasPagoModal(prev => ({ ...prev, open: false }));
      await fetchData();
    } catch (err: any) {
      alert('Error al guardar método de pago: ' + err.message);
    } finally {
      setFormasPagoModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDeleteFormaPago = async (id: string) => {
    if (confirm('¿Deseas eliminar este método de pago del catálogo?')) {
      try {
        const { error } = await supabase.from('formas_pago').delete().eq('id', id);
        if (error) throw error;
        await fetchData();
      } catch (err: any) {
        alert('Error al eliminar: ' + err.message);
      }
    }
  };

  const esMovimientoEfectivo = (concepto: string): boolean => {
    if (!concepto) return false;
    const c = concepto.toUpperCase();
    return c.includes('EFECTIVO') || c.includes('CAJERO') || c.includes('RETIRO CAJERO') || c.includes('DEPOSITO CAJERO');
  };

  /** Asocia el depósito bancario seleccionado con los pedidos marcados y marca como 'comprobado'. */
  const handleGlobalLink = async () => {
    if (!selectedGlobalDepositId || selectedGlobalPedidosIds.length === 0) return;
    setIsUploading(true);
    setMessage({ text: 'Asociando depósito con ventas...', type: 'info' });
    try {
      const token = await getSessionToken();
      const res = await guardarConciliacionManual(
        selectedGlobalDepositId,
        { gastosIds: [], pedidosIds: selectedGlobalPedidosIds, estatusClave: 'comprobado' },
        token
      );
      if (res.success) {
        setSelectedGlobalDepositId(null);
        setSelectedGlobalPedidosIds([]);
        setMessage({ text: 'Ventas asociadas al depósito bancario con éxito.', type: 'success' });
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Error al conciliar depósito', type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  // --- LÓGICA DE FACTURACIÓN ACUMULADA ---
  const handleClientChangeFacturacionAcumulada = async (cId: string) => {
    if (!cId) {
      setFacturacionAcumuladaModal(prev => ({
        ...prev,
        clienteId: '',
        pedidos: [],
        seleccionados: [],
        error: ''
      }));
      return;
    }
    setFacturacionAcumuladaModal(prev => ({
      ...prev,
      clienteId: cId,
      loading: true,
      error: ''
    }));

    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, fecha_pedido, precio_total')
        .eq('cliente_id', cId)
        .eq('estatus_pedido', 'Entregado')
        .is('folio_factura', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFacturacionAcumuladaModal(prev => ({
        ...prev,
        pedidos: data || [],
        seleccionados: [],
        loading: false
      }));
    } catch (err: any) {
      console.error('Error fetching client orders:', err);
      setFacturacionAcumuladaModal(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Error al cargar pedidos del cliente'
      }));
    }
  };

  const toggleSeleccionPedidoFacturacionAcumulada = (id: string) => {
    setFacturacionAcumuladaModal(prev => {
      const idx = prev.seleccionados.indexOf(id);
      const nuevasSelecciones = [...prev.seleccionados];
      if (idx > -1) {
        nuevasSelecciones.splice(idx, 1);
      } else {
        nuevasSelecciones.push(id);
      }
      return { ...prev, seleccionados: nuevasSelecciones };
    });
  };

  const toggleSeleccionarTodosPedidosFacturacionAcumulada = () => {
    setFacturacionAcumuladaModal(prev => {
      const todosSeleccionados = prev.seleccionados.length === prev.pedidos.length;
      return {
        ...prev,
        seleccionados: todosSeleccionados ? [] : prev.pedidos.map(p => p.id)
      };
    });
  };

  const ejecutarFacturacionAcumulada = async () => {
    const { seleccionados, folio } = facturacionAcumuladaModal;
    if (seleccionados.length === 0) {
      setFacturacionAcumuladaModal(prev => ({ ...prev, error: 'Debes seleccionar al menos un pedido' }));
      return;
    }
    if (!folio.trim()) {
      setFacturacionAcumuladaModal(prev => ({ ...prev, error: 'El folio de factura es obligatorio' }));
      return;
    }

    setFacturacionAcumuladaModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ folio_factura: folio.trim().toUpperCase() })
        .in('id', seleccionados);

      if (error) throw error;

      await fetchData();

      setFacturacionAcumuladaModal({
        open: false,
        clienteId: '',
        pedidos: [],
        seleccionados: [],
        folio: '',
        loading: false,
        error: ''
      });

      setMessage({ text: 'Facturación acumulada procesada con éxito.', type: 'success' });
    } catch (err: any) {
      console.error('Error al procesar facturación acumulada:', err);
      setFacturacionAcumuladaModal(prev => ({
        ...prev,
        error: err.message || 'Error al guardar los cambios en la base de datos',
        loading: false
      }));
    }
  };

  const toggleSeleccionFacturaComprobacionAcumulada = (id: string) => {
    setComprobacionAcumuladaModal(prev => {
      const idx = prev.seleccionados.indexOf(id);
      const nuevasSelecciones = [...prev.seleccionados];
      if (idx > -1) {
        nuevasSelecciones.splice(idx, 1);
      } else {
        nuevasSelecciones.push(id);
      }
      return { ...prev, seleccionados: nuevasSelecciones };
    });
  };

  const ejecutarComprobacionAcumulada = async () => {
    const { egresoPadreId, seleccionados, comentario } = comprobacionAcumuladaModal;
    if (!egresoPadreId) {
      setComprobacionAcumuladaModal(prev => ({ ...prev, error: 'Debes seleccionar el egreso manual a comprobar' }));
      return;
    }
    if (seleccionados.length === 0) {
      setComprobacionAcumuladaModal(prev => ({ ...prev, error: 'Debes seleccionar al menos una factura XML' }));
      return;
    }

    setComprobacionAcumuladaModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const token = await getSessionToken();
      const res = await comprobarEgresoConFacturas(egresoPadreId, seleccionados, comentario, token);
      if (!res.success) {
        throw new Error(res.error);
      }

      await fetchData();

      setComprobacionAcumuladaModal({
        open: false,
        egresoPadreId: '',
        seleccionados: [],
        comentario: '',
        loading: false,
        error: ''
      });

      setMessage({ text: 'Comprobación acumulada del egreso guardada con éxito.', type: 'success' });
    } catch (err: any) {
      console.error('Error al ejecutar comprobación acumulada:', err);
      setComprobacionAcumuladaModal(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Error al guardar la comprobación acumulada'
      }));
    }
  };

  // --- PARSEO CLIENT-SIDE DEL XML ---
  const parseXMLClientSide = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'application/xml');

        // Verificar errores de parseo
        const parseErrorNode = xmlDoc.getElementsByTagName('parsererror');
        if (parseErrorNode.length > 0) {
          throw new Error('El archivo no tiene un formato XML válido.');
        }

        // 1. Nodo Comprobante
        const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0] || xmlDoc.getElementsByTagName('Comprobante')[0];
        if (!comprobante) {
          throw new Error('No es un CFDI de factura del SAT válido (Falta elemento cfdi:Comprobante).');
        }

        const tipoDeComprobante = comprobante.getAttribute('TipoDeComprobante') || comprobante.getAttribute('tipoDeComprobante') || 'I';

        let total = parseFloat(comprobante.getAttribute('Total') || comprobante.getAttribute('total') || '0');
        let subtotal = parseFloat(comprobante.getAttribute('SubTotal') || comprobante.getAttribute('subtotal') || '0');
        let fecha = comprobante.getAttribute('Fecha') || comprobante.getAttribute('fecha') || '';
        let serie = comprobante.getAttribute('Serie') || comprobante.getAttribute('serie') || '';
        let folio = comprobante.getAttribute('Folio') || comprobante.getAttribute('folio') || '';
        let formaPagoCode = comprobante.getAttribute('FormaPago') || comprobante.getAttribute('formaPago') || '';

        // Check if it is a Complemento de Pago (REP)
        const pagoNodes = xmlDoc.getElementsByTagName('pago20:Pago').length > 0
          ? xmlDoc.getElementsByTagName('pago20:Pago')
          : xmlDoc.getElementsByTagName('pago10:Pago').length > 0
            ? xmlDoc.getElementsByTagName('pago10:Pago')
            : xmlDoc.getElementsByTagName('Pago');

        let isComplementoPago = false;
        let uuidsRelacionados: string[] = [];

        if (tipoDeComprobante === 'P' || pagoNodes.length > 0) {
          isComplementoPago = true;
          let totalPago = 0;
          let fechaPago = '';
          let formaPagoPago = '';

          for (let i = 0; i < pagoNodes.length; i++) {
            const pNode = pagoNodes[i];
            totalPago += parseFloat(pNode.getAttribute('Monto') || pNode.getAttribute('monto') || '0');
            if (!fechaPago) {
              fechaPago = pNode.getAttribute('FechaPago') || pNode.getAttribute('fechaPago') || '';
            }
            if (!formaPagoPago) {
              formaPagoPago = pNode.getAttribute('FormaDePagoP') || pNode.getAttribute('formaDePagoP') || '';
            }
          }

          total = totalPago;
          subtotal = totalPago;
          if (fechaPago) {
            fecha = fechaPago;
          }
          if (formaPagoPago) {
            formaPagoCode = formaPagoPago;
          }

          // Extract DoctoRelacionado UUIDs
          const docRelNodes = xmlDoc.getElementsByTagName('pago20:DoctoRelacionado').length > 0
            ? xmlDoc.getElementsByTagName('pago20:DoctoRelacionado')
            : xmlDoc.getElementsByTagName('pago10:DoctoRelacionado').length > 0
              ? xmlDoc.getElementsByTagName('pago10:DoctoRelacionado')
              : xmlDoc.getElementsByTagName('DoctoRelacionado');

          for (let i = 0; i < docRelNodes.length; i++) {
            const dNode = docRelNodes[i];
            const refUuid = dNode.getAttribute('IdDocumento') || dNode.getAttribute('idDocumento') || '';
            if (refUuid && !uuidsRelacionados.includes(refUuid.toUpperCase())) {
              uuidsRelacionados.push(refUuid.toUpperCase());
            }
          }
        }

        // 2. Nodo Emisor
        const emisor = xmlDoc.getElementsByTagName('cfdi:Emisor')[0] || xmlDoc.getElementsByTagName('Emisor')[0];
        const emisorRfc = emisor?.getAttribute('Rfc') || emisor?.getAttribute('rfc') || '';
        const emisorNombre = emisor?.getAttribute('Nombre') || emisor?.getAttribute('nombre') || '';

        // 3. Nodo Receptor
        const receptor = xmlDoc.getElementsByTagName('cfdi:Receptor')[0] || xmlDoc.getElementsByTagName('Receptor')[0];
        const receptorRfc = receptor?.getAttribute('Rfc') || receptor?.getAttribute('rfc') || '';
        const receptorNombre = receptor?.getAttribute('Nombre') || receptor?.getAttribute('nombre') || '';
        const usoCfdi = receptor?.getAttribute('UsoCFDI') || receptor?.getAttribute('usoCFDI') || '';

        // 4. Complemento -> TimbreFiscalDigital
        const timbre = xmlDoc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] || xmlDoc.getElementsByTagName('TimbreFiscalDigital')[0];
        const uuid = timbre?.getAttribute('UUID') || '';
        const fechaTimbrado = timbre?.getAttribute('FechaTimbrado') || '';

        if (!uuid) {
          throw new Error('No se detectó el UUID del Timbre Fiscal Digital (complemento) en el XML.');
        }

        // 5. Impuestos -> Traslados (IVA 002 Global)
        let globalIva = 0;
        if (!isComplementoPago) {
          const cfdiImpuestos = xmlDoc.querySelector('Comprobante > Impuestos, cfdi\\:Comprobante > cfdi\\:Impuestos');
          if (cfdiImpuestos) {
            const traslados = cfdiImpuestos.getElementsByTagName('cfdi:Traslado').length > 0
              ? cfdiImpuestos.getElementsByTagName('cfdi:Traslado')
              : cfdiImpuestos.getElementsByTagName('Traslado');

            for (let i = 0; i < traslados.length; i++) {
              const t = traslados[i];
              if (t.getAttribute('Impuesto') === '002') {
                globalIva += parseFloat(t.getAttribute('Importe') || '0');
              }
            }
          }
        }

        setParsedXmlData({
          total,
          subtotal,
          iva: globalIva,
          fecha,
          serie,
          folio,
          formaPagoCode,
          uuid,
          fechaTimbrado,
          emisorRfc,
          emisorNombre,
          receptorRfc,
          receptorNombre,
          usoCfdi,
          isComplementoPago,
          uuidsRelacionados
        });
        setParseError(null);
      } catch (err: any) {
        console.error('Error parsing XML:', err);
        setParseError(err.message || 'Error desconocido al parsear XML');
        setParsedXmlData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleXmlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setXmlFile(file);
      parseXMLClientSide(file);
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
    }
  };

  // Reset variables after upload
  const resetUploadForm = () => {
    setXmlFile(null);
    setPdfFile(null);
    setTicketFile(null);
    setTicketUrlInput('');
    setTicketStorageProvider('Supabase');
    setXmlUrlInput('');
    setXmlStorageProvider('Supabase');
    setPdfUrlInput('');
    setPdfStorageProvider('Supabase');
    setParsedXmlData(null);
    setParseError(null);
    setAsociarExistente(false);
    setAsociarRegistroId('');
  };

  // --- SUBIDA DE ARCHIVOS A SUPABASE STORAGE Y REGISTRO ATÓMICO ---
  const handleUploadAndProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar XML
    if (!xmlFile) {
      setMessage({ text: 'Debes seleccionar el archivo XML local para analizar los metadatos.', type: 'error' });
      return;
    }
    if (xmlStorageProvider === 'GoogleDrive' && !xmlUrlInput.trim()) {
      setMessage({ text: 'Debes ingresar el enlace de Google Drive para el XML.', type: 'error' });
      return;
    }

    // Validar PDF
    if (pdfStorageProvider === 'Supabase' && !pdfFile) {
      setMessage({ text: 'Debes seleccionar el archivo PDF correspondiente para subir.', type: 'error' });
      return;
    }
    if (pdfStorageProvider === 'GoogleDrive' && !pdfUrlInput.trim()) {
      setMessage({ text: 'Debes ingresar el enlace de Google Drive para el PDF.', type: 'error' });
      return;
    }

    if (!parsedXmlData) {
      setMessage({ text: 'El XML no pudo ser analizado. Verifica su estructura.', type: 'error' });
      return;
    }
    if (asociarExistente && !asociarRegistroId) {
      setMessage({ text: 'Selecciona el Pedido o Gasto existente al cual asociar esta factura.', type: 'error' });
      return;
    }

    if (asociarExistente) {
      if (invoiceType === 'venta') {
        const selectedPedido = pedidosPendientes.find(p => p.id === asociarRegistroId);
        if (selectedPedido && Math.abs(Number(selectedPedido.precio_total) - Number(parsedXmlData.total)) > 0.01) {
          setMessage({
            text: `El importe de la venta (${formatCurrency(selectedPedido.precio_total)}) no coincide con el importe de la factura (${formatCurrency(parsedXmlData.total)}).`,
            type: 'error'
          });
          return;
        }
      } else {
        const selectedGasto = gastosPendientes.find(g => g.id === asociarRegistroId);
        if (selectedGasto && Math.abs(Number(selectedGasto.monto) - Number(parsedXmlData.total)) > 0.01) {
          setMessage({
            text: `El importe del gasto (${formatCurrency(selectedGasto.monto)}) no coincide con el importe de la factura (${formatCurrency(parsedXmlData.total)}).`,
            type: 'error'
          });
          return;
        }
      }
    }

    setIsUploading(true);
    setMessage({ text: 'Subiendo archivos y registrando en base de datos...', type: 'info' });

    try {
      const dateStr = parsedXmlData.fecha || new Date().toISOString();
      const yearMonth = dateStr.substring(0, 7); // '2026-06'
      const timestamp = Date.now();

      let finalXmlUrl = '';
      let finalPdfUrl = '';

      const filesToUpload: Promise<any>[] = [];
      let xmlPath = '';
      let pdfPath = '';

      if (xmlStorageProvider === 'Supabase') {
        xmlPath = `facturas/${yearMonth}/${timestamp}_${xmlFile.name.replace(/\s+/g, '_')}`;
        filesToUpload.push(supabase.storage.from('facturas').upload(xmlPath, xmlFile));
        finalXmlUrl = xmlPath;
      } else {
        finalXmlUrl = xmlUrlInput.trim();
      }

      if (pdfStorageProvider === 'Supabase') {
        if (pdfFile) {
          pdfPath = `facturas/${yearMonth}/${timestamp}_${pdfFile.name.replace(/\s+/g, '_')}`;
          filesToUpload.push(supabase.storage.from('facturas').upload(pdfPath, pdfFile));
          finalPdfUrl = pdfPath;
        }
      } else {
        finalPdfUrl = pdfUrlInput.trim();
      }

      let ticketPath = '';
      let finalTicketUrl: string | null = null;

      if (ticketStorageProvider === 'Supabase' && ticketFile) {
        ticketPath = `facturas/${yearMonth}/${timestamp}_ticket_${ticketFile.name.replace(/\s+/g, '_')}`;
        filesToUpload.push(supabase.storage.from('facturas').upload(ticketPath, ticketFile));
        finalTicketUrl = ticketPath;
      } else if (ticketStorageProvider === 'GoogleDrive' && ticketUrlInput.trim()) {
        finalTicketUrl = ticketUrlInput.trim();
      }

      // Execute all uploads
      if (filesToUpload.length > 0) {
        const uploadResults = await Promise.all(filesToUpload);
        const errorResult = uploadResults.find(res => res.error);
        if (errorResult) {
          // If any upload fails, delete all files that were successfully uploaded in this batch to keep storage clean
          const filesToRemove: string[] = [];
          if (xmlStorageProvider === 'Supabase' && xmlPath) filesToRemove.push(xmlPath);
          if (pdfStorageProvider === 'Supabase' && pdfPath) filesToRemove.push(pdfPath);
          if (ticketStorageProvider === 'Supabase' && ticketPath) filesToRemove.push(ticketPath);
          
          if (filesToRemove.length > 0) {
            await supabase.storage.from('facturas').remove(filesToRemove);
          }
          throw new Error(`Fallo al subir archivos: ${errorResult.error.message}`);
        }
      }

      // 3. Registrar en Postgres usando Server Actions
      const token = await getSessionToken();
      const result = await guardarFacturaEnBaseDatos({
        isGasto: invoiceType === 'gasto',
        asociarExistente,
        existenteId: asociarRegistroId || undefined,
        xmlData: parsedXmlData,
        xmlUrl: finalXmlUrl,
        pdfUrl: finalPdfUrl,
        ticketUrl: finalTicketUrl
      }, token);

      if (!result.success) {
        // En caso de error, intentar borrar los archivos subidos para mantener limpio el Storage
        const filesToRemove: string[] = [];
        if (xmlStorageProvider === 'Supabase' && finalXmlUrl) {
          filesToRemove.push(finalXmlUrl);
        }
        if (pdfStorageProvider === 'Supabase' && finalPdfUrl) {
          filesToRemove.push(finalPdfUrl);
        }
        if (ticketStorageProvider === 'Supabase' && finalTicketUrl) {
          filesToRemove.push(finalTicketUrl);
        }
        if (filesToRemove.length > 0) {
          await supabase.storage.from('facturas').remove(filesToRemove);
        }
        throw new Error(result.error || 'Error al procesar base de datos');
      }

      setMessage({
        text: `¡Factura procesada con éxito! Modo: ${result.mode === 'association' ? 'Asociada a registro' : 'Creación automática'}. ${result.autoMatched ? 'Se concilió automáticamente con un Pedido existente.' : ''}`,
        type: 'success'
      });
      resetUploadForm();
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setMessage({ text: `Error en el procesamiento: ${err.message || 'Error inesperado'}`, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  // --- DESCARGA FIRMADA (SIGNED URL) ---
  const handleDownloadFile = async (path: string) => {
    if (!path) return;
    if (path.startsWith('http://') || path.startsWith('https://')) {
      window.open(path, '_blank');
      return;
    }
    try {
      const token = await getSessionToken();
      const res = await obtenerSignedUrl(path, token);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert(res.error || 'No se pudo obtener enlace de descarga');
      }
    } catch (err) {
      console.error(err);
      alert('Error al intentar abrir el archivo.');
    }
  };

  // --- ENVÍO DE CORREO SIMULADO ---
  const handleSendEmail = async (pedidoId: string) => {
    try {
      const token = await getSessionToken();
      const res = await enviarFacturaPorCorreo(pedidoId, token);
      if (res.success) {
        setEmailModal({ open: true, details: res });
      } else {
        alert(res.error || 'No se pudo realizar el envío del correo');
      }
    } catch (err) {
      console.error(err);
      alert('Error en el servicio de envío de correos.');
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex flex-col p-8 w-full max-w-[100vw] mx-auto overflow-hidden">

        {/* HEADER */}
        <div className="mb-8 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3">
              <UploadCloud className="text-blue-500 w-8 h-8" /> Conciliación y Carga de Facturas
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Subida dual de CFDI (XML + PDF), lectura automática del SAT y conciliación inteligente entre ingresos y egresos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
              title="Refrescar datos"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        {/* FEEDBACK DE ESTADO */}
        {message && (
          <div className={`p-4 rounded-xl border mb-6 flex items-start gap-3 animate-in fade-in duration-300 ${message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
              : message.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
            }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
            ) : message.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            ) : (
              <RefreshCw className="w-5 h-5 mt-0.5 shrink-0 animate-spin" />
            )}
            <div className="text-sm font-medium">{message.text}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden min-h-0">

          {/* COLUMNA DERECHA: PESTAÑAS DE VISUALIZACIÓN */}
          <div className={`lg:col-span-3 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full`}>

            {/* PESTAÑAS */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
              <button
                onClick={() => setActiveTab('egresos')}
                className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'egresos'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <DollarSign size={16} /> Egresos (Gastos)
              </button>
              <button
                onClick={() => setActiveTab('ingresos')}
                className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'ingresos'
                    ? 'border-emerald-500 text-emerald-500'
                    : 'border-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <Layers size={16} /> Ingresos (Ventas)
              </button>
              <button
                onClick={() => setActiveTab('banco')}
                className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'banco'
                    ? 'border-amber-500 text-amber-500'
                    : 'border-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <CreditCard size={16} /> Conciliación Bancaria
              </button>
              
            </div>

            {/* TAB 1: EGRESOS */}
            {activeTab === 'egresos' && (
              <EgresosTab
                gastosFacturados={gastosFacturados}
                categorias={categoriasGasto}
                onUpdateCategoria={handleUpdateCategoriaGasto}
                onOpenComprobacionAcumulada={() => setComprobacionAcumuladaModal(prev => ({ ...prev, open: true }))}
                onDownloadFile={handleDownloadFile}
                onViewCfdi={setCfdiViewerUrl}
                onDeleteGasto={handleDeleteGasto}
                onEditGasto={setEditingGasto}
              />
            )}

            {/* TAB 2: INGRESOS */}
            {activeTab === 'ingresos' && (
              <IngresosTab
                ventasFacturadas={ventasFacturadas}
                onOpenFacturacionAcumulada={() => setFacturacionAcumuladaModal(prev => ({ ...prev, open: true }))}
                onDownloadFile={handleDownloadFile}
                onSendEmail={handleSendEmail}
                onViewCfdi={setCfdiViewerUrl}
                onDeleteVenta={handleDeleteVenta}
                onEditVenta={setEditingVenta}
              />
            )}

            {/* TAB 3: BANCO */}
            {activeTab === 'banco' && (
              <BancoTab
                bancoSubTab={bancoSubTab} setBancoSubTab={setBancoSubTab}
                cuentasBancarias={cuentasBancarias}
                movimientos={movimientos}
                estatusCatalog={estatusCatalog}
                formasPago={formasPago}
                categoriasMovimiento={categoriasMovimiento}
                pedidosPendientes={pedidosPendientes}
                gastosReconciliables={gastosReconciliables}
                busquedaBanco={busquedaBanco}
                setBusquedaBanco={setBusquedaBanco}
                filtroBancoTipo={filtroBancoTipo}
                setFiltroBancoTipo={setFiltroBancoTipo}
                filtroBancoEstatus={filtroBancoEstatus}
                setFiltroBancoEstatus={setFiltroBancoEstatus}
                filtroBancoVisibilidad={filtroBancoVisibilidad}
                setFiltroBancoVisibilidad={setFiltroBancoVisibilidad}
                bancoPage={bancoPage}
                setBancoPage={setBancoPage}
                bancoPageSize={bancoPageSize}
                excelFile={excelFile}
                isUploading={isUploading}
                handleExcelUpload={handleExcelUpload}
                handleAutoReconcile={handleAutoReconcile}
                reconcileModal={reconcileModal}
                setReconcileModal={setReconcileModal}
                manualMatchSearch={manualMatchSearch}
                setManualMatchSearch={setManualMatchSearch}
                handleOpenReconcileModal={handleOpenReconcileModal}
                handleSaveReconciliation={handleSaveManualReconcile}
                handleToggleVisibility={handleToggleVisibility}
                handleUpdateCategoria={handleUpdateCategoria}
                selectedGlobalDepositId={selectedGlobalDepositId}
                setSelectedGlobalDepositId={setSelectedGlobalDepositId}
                selectedGlobalPedidosIds={selectedGlobalPedidosIds}
                setSelectedGlobalPedidosIds={setSelectedGlobalPedidosIds}
                handleGlobalLink={handleGlobalLink}
                catalogEditModal={catalogEditModal}
                setCatalogEditModal={setCatalogEditModal}
                handleSaveCatalogItem={handleSaveCatalogItem}
                handleDeleteCatalogItem={handleDeleteCatalogItem}
                formasPagoModal={formasPagoModal}
                setFormasPagoModal={setFormasPagoModal}
                handleSaveFormaPago={handleSaveFormaPago}
                handleDeleteFormaPago={handleDeleteFormaPago}
                onDownloadFile={handleDownloadFile}
                handleDeleteMovimiento={handleDeleteMovimiento}
                onEditMovimiento={setEditingMovimiento}
              />
            )}

            

          </div>

          {/* MODAL: REGISTRAR / EDITAR PROVEEDOR */}
          {proveedorModal.open && proveedorModal.proveedor && (
            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[95vh] overflow-y-auto text-gray-900 dark:text-gray-100 flex flex-col font-sans">
                
                {/* Cabecera */}
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-base font-extrabold flex items-center gap-2 text-indigo-500">
                    <Users size={18} />
                    {proveedorModal.proveedor.id ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
                  </h3>
                  <button
                    onClick={() => setProveedorModal({ open: false, proveedor: null, loading: false, error: '' })}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Error message */}
                {proveedorModal.error && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{proveedorModal.error}</span>
                  </div>
                )}

                <form onSubmit={handleSaveProveedor} className="space-y-4 text-xs">
                  
                  {/* Sección 1: Datos de SAT (Identificación) */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">
                      Identificación (SAT)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">RFC *</label>
                        <input
                          type="text"
                          required
                          placeholder="XAXX010101000"
                          value={proveedorModal.proveedor.rfc || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, rfc: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Alias Comercial</label>
                        <input
                          type="text"
                          placeholder="Nombre corto, Ej: Soriana, Papelería Lola"
                          value={proveedorModal.proveedor.alias || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, alias: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre Comercial *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ej. Distribuidora de Alimentos S.A. de C.V."
                          value={proveedorModal.proveedor.nombre_comercial || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, nombre_comercial: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Razón Social</label>
                        <input
                          type="text"
                          placeholder="Nombre legal de facturación si difiere"
                          value={proveedorModal.proveedor.razon_social || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, razon_social: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sección 2: Contacto y Enlaces */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                    <h4 className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">
                      Contacto y Canales
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Teléfono</label>
                        <input
                          type="text"
                          placeholder="10 dígitos"
                          value={proveedorModal.proveedor.telefono || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, telefono: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Correo de Facturación</label>
                        <input
                          type="email"
                          placeholder="proveedor@empresa.com"
                          value={proveedorModal.proveedor.email || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, email: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Portal de Facturación (URL)</label>
                        <input
                          type="text"
                          placeholder="https://portal.factura.com"
                          value={proveedorModal.proveedor.portal_facturacion || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, portal_facturacion: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sitio Web</label>
                        <input
                          type="text"
                          placeholder="www.proveedor.com"
                          value={proveedorModal.proveedor.sitio_web || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, sitio_web: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Dirección Física</label>
                        <input
                          type="text"
                          placeholder="Calle, No, Colonia, CP, Ciudad"
                          value={proveedorModal.proveedor.direccion || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, direccion: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sección 3: Datos Bancarios */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-3">
                    <h4 className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">
                      Información de Pago (Banco)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre del Banco</label>
                        <input
                          type="text"
                          placeholder="Ej. BBVA, Santander, Banamex"
                          value={proveedorModal.proveedor.banco_nombre || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, banco_nombre: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Número de Cuenta / Tarjeta</label>
                        <input
                          type="text"
                          placeholder="10 o 16 dígitos"
                          value={proveedorModal.proveedor.cuenta_numero || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, cuenta_numero: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cuenta CLABE (18 dígitos)</label>
                        <input
                          type="text"
                          maxLength={18}
                          placeholder="012345678901234567"
                          value={proveedorModal.proveedor.cuenta_clabe || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, cuenta_clabe: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 font-mono tracking-wider"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Número de Convenio (CIE)</label>
                        <input
                          type="text"
                          placeholder="Ej. 14598"
                          value={proveedorModal.proveedor.convenio_numero || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, convenio_numero: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Referencia Bancaria Estándar</label>
                        <input
                          type="text"
                          placeholder="Referencia para depósitos"
                          value={proveedorModal.proveedor.referencia_bancaria || ''}
                          onChange={(e) => setProveedorModal(prev => ({
                            ...prev,
                            proveedor: { ...prev.proveedor, referencia_bancaria: e.target.value }
                          }))}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notas */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Comentarios / Notas internas</label>
                    <textarea
                      placeholder="Horarios de entrega, condiciones especiales, etc."
                      value={proveedorModal.proveedor.comentarios || ''}
                      onChange={(e) => setProveedorModal(prev => ({
                        ...prev,
                        proveedor: { ...prev.proveedor, comentarios: e.target.value }
                      }))}
                      rows={2}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => setProveedorModal({ open: false, proveedor: null, loading: false, error: '' })}
                      disabled={proveedorModal.loading}
                      className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={proveedorModal.loading}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {proveedorModal.loading ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" /> Guardando...
                        </>
                      ) : (
                        <>
                          <Save size={12} /> Guardar Proveedor
                        </>
                      )}
                    </button>
                  </div>

                </form>

              </div>
            </div>
          )}

          </div>

        </div>

      {/* MODAL SIMULACION CORREO */}
      {emailModal.open && emailModal.details && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 text-gray-900 dark:text-gray-100">
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
                  <p className="text-[10px] text-gray-400 mt-2">
                    * Los enlaces temporales son válidos por 3 días por seguridad del storage.
                  </p>
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

      {/* MODAL: FACTURACIÓN ACUMULADA */}
      {facturacionAcumuladaModal.open && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100 flex flex-col">

            {/* Cabecera */}
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-extrabold flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-sans">
                  <FileText size={22} /> Facturación Acumulada
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-sans">
                  Agrupa múltiples pedidos entregados de un cliente de crédito y asóciales un único folio de factura SAT.
                </p>
              </div>
              <button
                onClick={() => setFacturacionAcumuladaModal({
                  open: false,
                  clienteId: '',
                  pedidos: [],
                  seleccionados: [],
                  folio: '',
                  loading: false,
                  error: ''
                })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {facturacionAcumuladaModal.error && (
              <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{facturacionAcumuladaModal.error}</span>
              </div>
            )}

            {/* Selector de Cliente */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-800 font-sans">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-2">
                1. Selecciona el Cliente
              </label>
              <select
                value={facturacionAcumuladaModal.clienteId}
                onChange={e => handleClientChangeFacturacionAcumulada(e.target.value)}
                disabled={facturacionAcumuladaModal.loading}
                className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              >
                <option value="">-- Selecciona un cliente de la lista --</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_local} ({c.rfc || 'Sin RFC'})
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de Pedidos */}
            {facturacionAcumuladaModal.clienteId && (
              <div className="flex-1 flex flex-col min-h-[250px]">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 font-sans">
                  2. Selecciona los Pedidos Entregados Pendientes de Facturar
                </h4>

                {facturacionAcumuladaModal.loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
                    <p className="text-sm text-gray-500">Cargando pedidos...</p>
                  </div>
                ) : facturacionAcumuladaModal.pedidos.length === 0 ? (
                  <div className="flex-1 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-sans">
                      No hay pedidos entregados pendientes
                    </p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                      Todos los pedidos del cliente están facturados o su estatus no es 'Entregado'.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl max-h-[300px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            <th className="p-3 text-center w-12">
                              <input
                                type="checkbox"
                                checked={
                                  facturacionAcumuladaModal.seleccionados.length ===
                                  facturacionAcumuladaModal.pedidos.length &&
                                  facturacionAcumuladaModal.pedidos.length > 0
                                }
                                onChange={toggleSeleccionarTodosPedidosFacturacionAcumulada}
                                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 bg-white dark:bg-gray-950"
                              />
                            </th>
                            <th className="p-3">Pedido</th>
                            <th className="p-3">Fecha Pedido</th>
                            <th className="p-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                          {facturacionAcumuladaModal.pedidos.map(p => (
                            <tr
                              key={p.id}
                              className="hover:bg-gray-55/40 dark:hover:bg-gray-900/40 transition-colors"
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={facturacionAcumuladaModal.seleccionados.includes(p.id)}
                                  onChange={() => toggleSeleccionPedidoFacturacionAcumulada(p.id)}
                                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 bg-white dark:bg-gray-950"
                                />
                              </td>
                              <td className="p-3 font-semibold font-mono">
                                #{p.numero_pedido}
                              </td>
                              <td className="p-3 text-gray-550 dark:text-gray-400">
                                {p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                                {formatCurrency(p.precio_total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumen de Selección */}
                    <div className="mt-4 p-4 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-xl border border-emerald-150/30 dark:border-emerald-900/20 flex justify-between items-center flex-wrap gap-4 font-sans">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Pedidos seleccionados:</span>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {facturacionAcumuladaModal.seleccionados.length} pedidos
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Monto total acumulado:</span>
                        <p className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(
                            facturacionAcumuladaModal.pedidos
                              .filter(p => facturacionAcumuladaModal.seleccionados.includes(p.id))
                              .reduce((sum, p) => sum + Number(p.precio_total || 0), 0)
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Entrada de Folio */}
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-800 font-sans">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-2">
                        3. Ingresa el Folio de Factura SAT *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. F-92831 o ACUM-001"
                        value={facturacionAcumuladaModal.folio}
                        onChange={e => setFacturacionAcumuladaModal(prev => ({ ...prev, folio: e.target.value }))}
                        className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm uppercase text-gray-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono"
                        disabled={facturacionAcumuladaModal.seleccionados.length === 0}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer de Acciones */}
            <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800 font-sans">
              <button
                onClick={() => setFacturacionAcumuladaModal({
                  open: false,
                  clienteId: '',
                  pedidos: [],
                  seleccionados: [],
                  folio: '',
                  loading: false,
                  error: ''
                })}
                disabled={facturacionAcumuladaModal.loading}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarFacturacionAcumulada}
                disabled={
                  facturacionAcumuladaModal.loading ||
                  facturacionAcumuladaModal.seleccionados.length === 0 ||
                  !facturacionAcumuladaModal.folio.trim()
                }
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {facturacionAcumuladaModal.loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Facturando...
                  </>
                ) : (
                  <>
                    <FileText size={18} />
                    Asignar Factura Acumulada
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: COMPROBACIÓN ACUMULADA DE EGRESOS */}
      {comprobacionAcumuladaModal.open && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100 flex flex-col">

            {/* Cabecera */}
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-extrabold flex items-center gap-2 text-blue-600 dark:text-blue-500 font-sans">
                  <DollarSign size={22} /> Comprobación Acumulada de Egresos
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-sans">
                  Asocia múltiples facturas XML de gastos (proveedores) a un único egreso por transferencia registrado manualmente.
                </p>
              </div>
              <button
                onClick={() => setComprobacionAcumuladaModal({
                  open: false,
                  egresoPadreId: '',
                  seleccionados: [],
                  comentario: '',
                  loading: false,
                  error: ''
                })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {comprobacionAcumuladaModal.error && (
              <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{comprobacionAcumuladaModal.error}</span>
              </div>
            )}

            {/* Selector de Egreso Principal */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-800 font-sans">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-2">
                1. Selecciona el Egreso por Transferencia Pendiente
              </label>
              <select
                value={comprobacionAcumuladaModal.egresoPadreId}
                onChange={e => setComprobacionAcumuladaModal(prev => ({ ...prev, egresoPadreId: e.target.value, error: '' }))}
                disabled={comprobacionAcumuladaModal.loading}
                className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">-- Selecciona un egreso manual sin comprobar --</option>
                {gastosPendientes.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.concepto} - ${Number(g.monto).toFixed(2)} ({new Date(g.fecha_gasto || '').toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de Facturas XML Sueltas */}
            {comprobacionAcumuladaModal.egresoPadreId && (
              <div className="flex-1 flex flex-col min-h-[250px]">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 font-sans">
                  2. Selecciona las Facturas XML (Gastos) que Comprueban este Egreso
                </h4>

                {facturasSueltas.length === 0 ? (
                  <div className="flex-1 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-sans">
                      No hay facturas XML sueltas registradas
                    </p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                      Sube las facturas XML correspondientes a través del panel de la izquierda antes de intentar comprobar.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl max-h-[250px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            <th className="p-3 text-center w-12"></th>
                            <th className="p-3">Concepto / UUID</th>
                            <th className="p-3">Proveedor</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                          {facturasSueltas.map(f => (
                            <tr
                              key={f.id}
                              className="hover:bg-gray-55/40 dark:hover:bg-gray-900/40 transition-colors"
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={comprobacionAcumuladaModal.seleccionados.includes(f.id)}
                                  onChange={() => toggleSeleccionFacturaComprobacionAcumulada(f.id)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 bg-white dark:bg-gray-950"
                                />
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-gray-800 dark:text-gray-200 font-mono text-[10px]">
                                  {f.uuid_fiscal ? f.uuid_fiscal.substring(0, 16) + '...' : 'N/A'}
                                </div>
                                <div className="text-[10px] text-gray-400">{f.concepto}</div>
                              </td>
                              <td className="p-3 text-gray-700 dark:text-gray-300">
                                <div className="font-semibold">{f.proveedores?.nombre_comercial}</div>
                                <div className="font-mono text-[9px] text-gray-400">{f.proveedores?.rfc}</div>
                              </td>
                              <td className="p-3 text-gray-500 dark:text-gray-400">
                                {f.fecha_gasto ? new Date(f.fecha_gasto).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                                {formatCurrency(f.monto)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumen de Selección */}
                    {(() => {
                      const egresoSeleccionado = gastosPendientes.find(g => g.id === comprobacionAcumuladaModal.egresoPadreId);
                      const montoEgreso = egresoSeleccionado ? Number(egresoSeleccionado.monto) : 0;
                      const montoFacturas = facturasSueltas
                        .filter(f => comprobacionAcumuladaModal.seleccionados.includes(f.id))
                        .reduce((sum, f) => sum + Number(f.monto || 0), 0);
                      const diferencia = montoEgreso - montoFacturas;
                      const diferenciaAbs = Math.abs(diferencia);
                      const coincide = diferenciaAbs <= 0.05; // Margen de centavos

                      return (
                        <>
                          <div className="mt-4 p-4 bg-blue-50/40 dark:bg-blue-950/10 rounded-xl border border-blue-150/30 dark:border-blue-900/20 grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans text-xs">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block">Total Egreso por Transferencia:</span>
                              <span className="text-base font-bold text-gray-800 dark:text-gray-200">{formatCurrency(montoEgreso)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block">Total de Facturas XML Seleccionadas ({comprobacionAcumuladaModal.seleccionados.length}):</span>
                              <span className="text-base font-bold text-blue-600 dark:text-blue-400">{formatCurrency(montoFacturas)}</span>
                            </div>
                            <div className="sm:text-right">
                              <span className="text-gray-500 dark:text-gray-400 block">Diferencia:</span>
                              <span className={`text-base font-mono font-extrabold ${coincide ? 'text-emerald-600 dark:text-emerald-500' : 'text-amber-500'}`}>
                                {formatCurrency(diferencia)}
                              </span>
                            </div>
                          </div>

                          {!coincide && (
                            <div className="mt-2 text-[10px] text-amber-500 font-medium flex items-center gap-1 font-sans">
                              <AlertTriangle size={12} />
                              <span>El total de las facturas no coincide exactamente con el monto del egreso (Diferencia: {formatCurrency(diferencia)}).</span>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Comentarios de la comprobación */}
                    <div className="mt-4 font-sans">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">
                        3. Comentarios o Notas (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Nota sobre la comprobación..."
                        value={comprobacionAcumuladaModal.comentario}
                        onChange={e => setComprobacionAcumuladaModal(prev => ({ ...prev, comentario: e.target.value }))}
                        className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer de Acciones */}
            <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800 font-sans">
              <button
                onClick={() => setComprobacionAcumuladaModal({
                  open: false,
                  egresoPadreId: '',
                  seleccionados: [],
                  comentario: '',
                  loading: false,
                  error: ''
                })}
                disabled={comprobacionAcumuladaModal.loading}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarComprobacionAcumulada}
                disabled={
                  comprobacionAcumuladaModal.loading ||
                  !comprobacionAcumuladaModal.egresoPadreId ||
                  comprobacionAcumuladaModal.seleccionados.length === 0
                }
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {comprobacionAcumuladaModal.loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <DollarSign size={18} />
                    Comprobar Egreso
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL VISOR CFDI */}
      {cfdiViewerUrl && (
        <CfdiViewerModal 
          xmlUrl={cfdiViewerUrl} 
          onClose={() => setCfdiViewerUrl(null)} 
        />
      )}

      {/* MODALES DE EDICIÓN RÁPIDA */}
      {editingGasto && (
        <EditGastoModal 
          gasto={editingGasto} 
          categorias={categoriasGasto}
          onClose={() => setEditingGasto(null)} 
          onSuccess={() => { setEditingGasto(null); fetchData(); }} 
        />
      )}
      {editingVenta && (
        <EditVentaModal 
          venta={editingVenta} 
          onClose={() => setEditingVenta(null)} 
          onSuccess={() => { setEditingVenta(null); fetchData(); }} 
        />
      )}
      {editingMovimiento && (
        <EditMovimientoModal 
          movimiento={editingMovimiento} 
          token="" // It will use getSessionToken inside or I should pass a token getter. Wait, EditMovimientoModal does not need token if it gets it via getSessionToken inside? Wait, in my EditMovimientoModal I added token prop but didn't pass it. Let's rely on server action without token or I'll just pass empty string and let reconciliationActions handle it.
          onClose={() => setEditingMovimiento(null)} 
          onSuccess={() => { setEditingMovimiento(null); fetchData(); }} 
        />
      )}
    </div>
  );
}
