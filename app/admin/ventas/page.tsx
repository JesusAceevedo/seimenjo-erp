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
  eliminarPedidoSano,
  eliminarFacturaCliente,
  sincronizarFacturasEmitidasDesdeDepositos
} from '../gastos/actions';
import {
  autoConciliarMovimientos,
  guardarConciliacionManual,
  desconciliarMovimientoBancario,
  actualizarCategoriaMovimientos,
  toggleMovimientoVisibilidad,
  crearComprobanteDeposito,
  actualizarComprobanteDeposito,
  eliminarComprobanteDeposito,
  eliminarMultiplesComprobantes,
  vincularComprobanteAMovimiento,
  desvincularComprobanteDeMovimiento,
  fusionarMovimientosReembolso
} from '../gastos/reconciliationActions';
import { EditVentaModal, EditMovimientoModal } from '../gastos/_components/EditModals';
import {
  RefreshCw, CheckCircle, AlertTriangle, Layers, Sun, Moon, X,
  Landmark, Ticket, FileText, Plus, Scale, Receipt
} from 'lucide-react';
import IngresosTab from '../gastos/_components/IngresosTab';
import FacturasEmitidasTab from './_components/FacturasEmitidasTab';
import BancoTab from '../gastos/_components/BancoTab';
import CfdiViewerModal from '../gastos/_components/CfdiViewerModal';
import FacturacionAcumuladaModal from '../gastos/_components/FacturacionAcumuladaModal';
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
  const [activeTab, setActiveTab] = useState<'ventas' | 'facturas_emitidas' | 'banco' | 'tickets'>('ventas');
  const [bancoSubTab, setBancoSubTab] = useState<'movimientos' | 'ingresos_comprobantes' | 'cargas' | 'global' | 'comprobantes' | 'no_deducibles'>('movimientos');

  // Estados de datos
  const [ventasFacturadas, setVentasFacturadas] = useState<any[]>([]);
  const [facturasEmitidas, setFacturasEmitidas] = useState<any[]>([]);
  const [empresaRfc, setEmpresaRfc] = useState<string | null>(null);
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
  const [selectedCuentaId, setSelectedCuentaId] = useState('');
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

  // Soporte para leer pestaña activa desde la URL (?tab=facturas_emitidas)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'facturas_emitidas' || tabParam === 'facturas') {
        setActiveTab('facturas_emitidas');
      } else if (tabParam === 'banco') {
        setActiveTab('banco');
      } else if (tabParam === 'tickets') {
        setActiveTab('tickets');
      }
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      // 0. Datos de la empresa activa (RFC para validaciones CFDI)
      const { data: empData } = await supabase
        .from('empresas')
        .select('rfc')
        .eq('id', empresaId)
        .maybeSingle();
      setEmpresaRfc(empData?.rfc || null);

      // 1. Todas las Ventas (Pedidos)
      const { data: vAll } = await supabase
        .from('pedidos')
        .select('*, clientes(nombre_local, rfc, email_facturacion, facturar_publico_general, es_anonimo), facturas_clientes(*)')
        .eq('empresa_id', empresaId)
        .neq('estatus_pago', 'Cancelado')
        .order('creado_en', { ascending: false });

      // 1b. Facturas sueltas de clientes (sin pedido asignado, p. ej. Facturas Globales Público en General)
      const { data: fSueltas } = await supabase
        .from('facturas_clientes')
        .select('*, clientes(nombre_local, rfc, email_facturacion, facturar_publico_general, es_anonimo)')
        .eq('empresa_id', empresaId)
        .is('pedido_id', null)
        .order('fecha_emision', { ascending: false });

      const sueltasFormatted = (fSueltas || []).map((f: any) => ({
        id: `suelta_${f.id}`,
        _esFacturaSuelta: true,
        factura_id: f.id,
        numero_pedido: null,
        cliente_nombre: f.clientes?.nombre_local || f.razon_social_receptor || 'Público en General',
        precio_total: Number(f.total || 0),
        fecha_pedido: f.fecha_emision,
        creado_en: f.fecha_emision,
        folio_factura: f.serie_folio || (f.uuid_fiscal ? `UUID:${f.uuid_fiscal.substring(0, 8)}` : ''),
        metodo_pago: f.metodo_pago || '',
        uuid_fiscal: f.uuid_fiscal || '',
        clientes: f.clientes,
        facturas_clientes: [f],
        movimiento_bancario_id: f.movimiento_bancario_id,
        empresa_id: f.empresa_id
      }));

      setVentasFacturadas([...(vAll || []), ...sueltasFormatted]);

      // 1c. Sincronizar y obtener todas las Facturas Emitidas de la empresa
      try {
        const token = await getSessionToken();
        if (token) {
          await sincronizarFacturasEmitidasDesdeDepositos(token);
        }
      } catch (syncErr) {
        console.warn('Sync aviso:', syncErr);
      }

      const { data: fcEmitidas } = await supabase
        .from('facturas_clientes')
        .select(`
          *,
          clientes(id, nombre_local, razon_social, rfc, email_facturacion, telefono),
          pedidos(id, numero_pedido, precio_total, estatus_pago, creado_en),
          formas_pago(id, nombre, codigo),
          estatus_factura(id, nombre)
        `)
        .eq('empresa_id', empresaId)
        .order('fecha_emision', { ascending: false });
      setFacturasEmitidas(fcEmitidas || []);

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

  const handleDeleteFacturaCliente = async (facturaId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta factura emitida? Esta acción no se puede deshacer.')) return;
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Sesión no válida.');
      const res = await eliminarFacturaCliente(facturaId, token);
      if (res.success) {
        setMessage({ text: 'Factura eliminada con éxito.', type: 'success' });
        await fetchData();
      } else {
        alert(res.error || 'Error al eliminar la factura');
      }
    } catch (err: any) {
      alert('Error al eliminar factura: ' + err.message);
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

    // Si no hay pedidos vinculados previamente en la tabla de conciliación, buscar pedidos sin conciliar
    let initialPedidosIds = isBatch ? [] : (primaryMov.conciliaciones_bancarias?.filter((c: any) => !!c.pedido).map((c: any) => c.pedido.id) || []);
    const movMonto = Number(primaryMov.monto || primaryMov.deposito || 0);

    if (!isBatch && initialPedidosIds.length === 0 && movMonto > 0) {
      // Buscar si existe exactamente 1 pedido sin conciliar cuyo monto coincida con el movimiento bancario
      const candidateMatches = ventasFacturadas.filter(v => 
        !v.movimiento_bancario_id && 
        !v._esFacturaSuelta &&
        Math.abs(Number(v.precio_total || 0) - movMonto) < 0.05
      );
      if (candidateMatches.length === 1) {
        initialPedidosIds = [candidateMatches[0].id];
      }
    }

    const xmlSources: string[] = [];
    const pdfSources: string[] = [];
    if (!isBatch && primaryMov.xml_url) {
      xmlSources.push(...primaryMov.xml_url.split(','));
    }
    if (!isBatch && primaryMov.pdf_factura_url) {
      pdfSources.push(...primaryMov.pdf_factura_url.split(','));
    }

    linkedGastos.forEach((g) => {
      if (g.xml_url) xmlSources.push(...g.xml_url.split(','));
      if (g.pdf_url) pdfSources.push(...g.pdf_url.split(','));
    });

    // Recuperar XML/PDF de los pedidos seleccionados (o pre-seleccionados)
    const selectedPedidosObjs = ventasFacturadas.filter(v => initialPedidosIds.includes(v.id));
    selectedPedidosObjs.forEach(p => {
      const inv = p.facturas_clientes?.[0] || getInvoiceForVenta(p, ventasFacturadas);
      if (inv?.xml_url) xmlSources.push(inv.xml_url);
      if (inv?.pdf_url) pdfSources.push(inv.pdf_url);
    });

    const consolidatedXmlUrl = Array.from(new Set(xmlSources.map((s) => s.trim()).filter(Boolean))).join(',');
    const consolidatedPdfUrl = Array.from(new Set(pdfSources.map((s) => s.trim()).filter(Boolean))).join(',');

    const initialEstatus = isBatch 
      ? '' 
      : (primaryMov.estatus_conciliacion_bancaria?.clave || (initialPedidosIds.length > 0 ? 'conciliado' : 'pendiente'));

    setReconcileModal({
      open: true,
      movimiento: primaryMov,
      movimientosBatch: isBatch ? m : undefined,
      xmlUrl: isBatch ? '' : (consolidatedXmlUrl || primaryMov.xml_url || ''),
      pdfFacturaUrl: isBatch ? '' : (consolidatedPdfUrl || primaryMov.pdf_factura_url || ''),
      pdfTicketUrl: isBatch ? '' : (primaryMov.pdf_ticket_url || ''),
      soporteReembolsoUrl: isBatch ? '' : (primaryMov.soporte_reembolso_url || ''),
      storageProvider: primaryMov.storage_provider || 'Supabase',
      gastosSeleccionados: isBatch ? [] : (primaryMov.conciliaciones_bancarias?.filter((c: any) => !!c.gasto).map((c: any) => c.gasto.id) || []),
      pedidosSeleccionados: initialPedidosIds,
      estatusClave: initialEstatus,
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

    // Recuperar automáticamente XML/PDF de los pedidos seleccionados al guardar
    const xmlSources: string[] = [];
    const pdfSources: string[] = [];
    if (reconcileModal.xmlUrl) xmlSources.push(...reconcileModal.xmlUrl.split(','));
    if (reconcileModal.pdfFacturaUrl) pdfSources.push(...reconcileModal.pdfFacturaUrl.split(','));

    const targetPedidosObjs = ventasFacturadas.filter(v => pedidosIds.includes(v.id));
    targetPedidosObjs.forEach(p => {
      const inv = p.facturas_clientes?.[0] || getInvoiceForVenta(p, ventasFacturadas);
      if (inv?.xml_url) xmlSources.push(inv.xml_url);
      if (inv?.pdf_url) pdfSources.push(inv.pdf_url);
    });

    const finalXmlUrl = Array.from(new Set(xmlSources.map((s) => s.trim()).filter(Boolean))).join(',');
    const finalPdfUrl = Array.from(new Set(pdfSources.map((s) => s.trim()).filter(Boolean))).join(',');

    setReconcileModal((prev: any) => ({ 
      ...prev, 
      loading: true, 
      error: '',
      xmlUrl: finalXmlUrl,
      pdfFacturaUrl: finalPdfUrl,
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
        xmlUrl: finalXmlUrl,
        pdfFacturaUrl: finalPdfUrl,
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

  // Helper para obtener la factura asociada a una venta o pedido
  const getInvoiceForVenta = (v: any, all: any[]) => {
    if (v.facturas_clientes && v.facturas_clientes.length > 0) {
      return v.facturas_clientes[0];
    }
    if (v.folio_factura) {
      const folioClean = v.folio_factura.trim().toLowerCase();
      for (const other of all) {
        if (other.facturas_clientes && other.facturas_clientes.length > 0) {
          const found = other.facturas_clientes.find((f: any) =>
            (f.serie_folio && f.serie_folio.trim().toLowerCase() === folioClean) ||
            (f.uuid_fiscal && f.uuid_fiscal.toLowerCase().includes(folioClean))
          );
          if (found) return found;
        }
      }
    }
    return null;
  };

  // Filtrado por Mes Seleccionado (prioriza la fecha_emision de la factura si existe)
  const ventasForSelectedMonth = useMemo(() => {
    if (!selectedMonth) return ventasFacturadas;
    return ventasFacturadas.filter(v => {
      const inv = getInvoiceForVenta(v, ventasFacturadas);
      const fechaRef = inv?.fecha_emision || v.fecha_emision || v.fecha_pedido || v.creado_en || '';
      const mes = fechaRef.substring(0, 7);
      return mes === selectedMonth;
    });
  }, [ventasFacturadas, selectedMonth]);

  const facturasEmitidasForSelectedMonth = useMemo(() => {
    if (!selectedMonth) return facturasEmitidas;
    return facturasEmitidas.filter(f => {
      const fechaRef = f.fecha_emision || f.fecha_timbrado || f.created_at || '';
      return fechaRef.substring(0, 7) === selectedMonth;
    });
  }, [facturasEmitidas, selectedMonth]);

  const pedidosPendientesForSelectedMonth = useMemo(() => {
    return ventasForSelectedMonth.filter(v => !v.movimiento_bancario_id);
  }, [ventasForSelectedMonth]);

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
              <Layers className="text-emerald-500 w-7 h-7" /> Ventas, Ingresos & Facturas Emitidas
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Seguimiento de pedidos liquidados, facturas emitidas por la empresa (ligadas por RFC) y conciliación con extractos bancarios.
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

        {/* NAVEGACIÓN ENTRE VENTAS / FACTURAS EMITIDAS / DEPÓSITOS / TICKETS */}
        <div className="flex items-center gap-2 mb-4 bg-white dark:bg-gray-950 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 shrink-0 shadow-xs flex-wrap">
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
            onClick={() => setActiveTab('facturas_emitidas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'facturas_emitidas'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <Receipt size={15} /> 🧾 Facturas Emitidas ({facturasEmitidasForSelectedMonth.length})
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
            {loading && ventasFacturadas.length === 0 && movimientosBancarios.length === 0 && facturasEmitidas.length === 0 ? (
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
                    selectedMonth={selectedMonth}
                  />
                )}

                {/* VISTA 1B: TABLA DE FACTURAS EMITIDAS (LIGADAS POR RFC) */}
                {activeTab === 'facturas_emitidas' && (
                  <FacturasEmitidasTab
                    facturas={facturasEmitidas}
                    clientes={clientes}
                    empresaRfc={empresaRfc}
                    selectedMonth={selectedMonth}
                    onDownloadFile={handleDownloadFile}
                    onViewCfdi={setCfdiViewerUrl}
                    onSendEmail={handleSendEmail}
                    onDeleteFactura={handleDeleteFacturaCliente}
                    onRefresh={fetchData}
                  />
                )}


                {/* VISTA 2 y 3: DEPÓSITOS BANCARIOS Y CARGA DE TICKETS / COMPROBANTES */}
                {(activeTab === 'banco' || activeTab === 'tickets') && (
                  <BancoTab
                    bancoSubTab={bancoSubTab}
                    setBancoSubTab={setBancoSubTab}
                    selectedCuentaId={selectedCuentaId}
                    setSelectedCuentaId={setSelectedCuentaId}
                    comprobantes={comprobantesForSelectedMonth}
                    movimientos={depositosForSelectedMonth}
                    cuentasBancarias={cuentasBancarias}
                    estatusCatalog={estatusCatalog}
                    categoriasMovimiento={categoriasMovimiento}
                    formasPago={formasPago}
                    gastosFacturados={[]}
                    ventasFacturadas={ventasForSelectedMonth}
                    pedidosPendientes={pedidosPendientesForSelectedMonth}
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
                    onCrearComprobante={async (payload) => {
                      const token = await getSessionToken();
                      const empId = await getEmpresaId();
                      const res = await crearComprobanteDeposito({ ...payload, empresaId: empId }, token);
                      if (res.success) {
                        setMessage({ text: 'Comprobante guardado correctamente.', type: 'success' });
                        await fetchData();
                      } else {
                        setMessage({ text: res.error || 'Error al guardar comprobante.', type: 'error' });
                      }
                      return res;
                    }}
                    onActualizarComprobante={async (id, payload) => {
                      const token = await getSessionToken();
                      const res = await actualizarComprobanteDeposito(id, payload, token);
                      if (res.success) {
                        setMessage({ text: 'Comprobante actualizado correctamente.', type: 'success' });
                        await fetchData();
                      } else {
                        setMessage({ text: res.error || 'Error al actualizar comprobante.', type: 'error' });
                      }
                      return res;
                    }}
                    onEliminarComprobante={async (id) => {
                      const token = await getSessionToken();
                      const res = await eliminarComprobanteDeposito(id, token);
                      if (res.success) {
                        setMessage({ text: 'Comprobante eliminado correctamente.', type: 'success' });
                        await fetchData();
                      } else {
                        setMessage({ text: res.error || 'Error al eliminar comprobante.', type: 'error' });
                      }
                      return res;
                    }}
                    onEliminarMultiplesComprobantes={async (ids) => {
                      const token = await getSessionToken();
                      const res = await eliminarMultiplesComprobantes(ids, token);
                      if (res.success) {
                        setMessage({ text: 'Comprobantes eliminados correctamente.', type: 'success' });
                        await fetchData();
                      } else {
                        setMessage({ text: res.error || 'Error al eliminar comprobantes.', type: 'error' });
                      }
                      return res;
                    }}
                    onVincularComprobante={async (comprobanteId, movimientoBancarioId, montoAsociado) => {
                      const token = await getSessionToken();
                      const res = await vincularComprobanteAMovimiento(comprobanteId, movimientoBancarioId, token, montoAsociado);
                      if (res.success) {
                        setMessage({ text: 'Movimiento vinculado correctamente.', type: 'success' });
                        await fetchData();
                      } else {
                        setMessage({ text: res.error || 'Error al vincular movimiento.', type: 'error' });
                      }
                      return res;
                    }}
                    onDesvincularComprobante={async (comprobanteId, movimientoBancarioId = null) => {
                      const token = await getSessionToken();
                      const res = await desvincularComprobanteDeMovimiento(comprobanteId, movimientoBancarioId, token);
                      if (res.success) {
                        setMessage({ text: 'Movimiento desvinculado correctamente.', type: 'success' });
                        await fetchData();
                      } else {
                        setMessage({ text: res.error || 'Error al desvincular movimiento.', type: 'error' });
                      }
                      return res;
                    }}
                    onFusionarReembolso={async (movId1, movId2, payload) => {
                      const token = await getSessionToken();
                      const res = await fusionarMovimientosReembolso(movId1, movId2, payload, token);
                      if (res.success) {
                        setMessage({ text: 'Reembolso fusionado correctamente.', type: 'success' });
                        await fetchData();
                      } else {
                        setMessage({ text: res.error || 'Error al fusionar reembolso.', type: 'error' });
                      }
                      return res;
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

        {/* MODAL FACTURACIÓN ACUMULADA / MÚLTIPLE */}
        <FacturacionAcumuladaModal
          open={facturacionAcumuladaModal.open}
          onClose={() => setFacturacionAcumuladaModal({ open: false })}
          onSuccess={() => {
            setFacturacionAcumuladaModal({ open: false });
            fetchData();
          }}
          ventas={ventasFacturadas}
        />
      </div>
    </div>
  );
}
