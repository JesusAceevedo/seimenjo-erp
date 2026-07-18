'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../lib/hooks/useSessionToken';
import {
  obtenerSignedUrl,
} from '../gastos/actions';
import {
  importarMovimientosBancarios,
  toggleMovimientoVisibilidad,
  autoConciliarMovimientos,
  guardarConciliacionManual,
  getEstatusCatalog,
  guardarEstatusCatalogItem,
  eliminarEstatusCatalogItem,
  eliminarMovimientoBancario,
  desconciliarMovimientoBancario,
  actualizarMesConciliacionMovimiento,
  crearComprobanteDeposito,
  actualizarComprobanteDeposito,
  eliminarComprobanteDeposito,
  vincularComprobanteAMovimiento,
  desvincularComprobanteDeMovimiento,
  obtenerComprobantesDeposito,
  fusionarMovimientosReembolso
} from '../gastos/reconciliationActions';
import { ComprobanteDeposito } from '../types';
import {
  RefreshCw, AlertTriangle, CheckCircle, Sun, Moon,
  Calendar, ArrowRightLeft, Landmark
} from 'lucide-react';
import BancoTab from '../gastos/_components/BancoTab';
import PeriodSelector from '../_components/PeriodSelector';

export const dynamic = 'force-dynamic';

export default function BankReconciliationModule() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useThemeMode();

  // Helper de Formato Contable
  const formatCurrency = (val: number) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(num);
  };

  const getSessionToken = useSessionToken();
  const getEmpresaId = useEmpresaId();
  const { selectedMonth, periodStatus, refreshPeriodStatus } = usePeriod();

  // --- ESTADOS DE CONCILIACIÓN BANCARIA ---
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [estatusCatalog, setEstatusCatalog] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [categoriasMovimiento, setCategoriasMovimiento] = useState<any[]>([]);
  const [bancoSubTab, setBancoSubTab] = useState<'movimientos' | 'global' | 'comprobantes'>('movimientos');
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [selectedCuentaId, setSelectedCuentaId] = useState<string>('');
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([]);
  const [gastosReconciliables, setGastosReconciliables] = useState<any[]>([]);
  const [selectedGlobalDepositId, setSelectedGlobalDepositId] = useState<string | null>(null);
  const [selectedGlobalPedidosIds, setSelectedGlobalPedidosIds] = useState<string[]>([]);
  const [showMigrationBanner, setShowMigrationBanner] = useState<boolean>(false);
  const [comprobantes, setComprobantes] = useState<ComprobanteDeposito[]>([]);

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
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modales
  const [reconcileModal, setReconcileModal] = useState<{
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
  }>({
    open: false,
    movimiento: null,
    xmlUrl: '',
    pdfFacturaUrl: '',
    pdfTicketUrl: '',
    soporteReembolsoUrl: '',
    storageProvider: 'Supabase',
    gastosSeleccionados: [],
    pedidosSeleccionados: [],
    estatusClave: '',
    loading: false,
    error: ''
  });

  const [manualMatchSearch, setManualMatchSearch] = useState<string>('');
  
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

  useEffect(() => {
    if (message && message.type !== 'info') {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchData = async () => {
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      // 1. Cuentas bancarias
      let cbData = null;
      const { data: cbDataTry, error: cbError } = await supabase
        .from('cuentas_bancarias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre', { ascending: true });

      if (cbError && cbError.code === '42703') {
        const { data: cbGlobal, error: cbGlobalError } = await supabase
          .from('cuentas_bancarias')
          .select('*')
          .order('nombre', { ascending: true });
        if (!cbGlobalError) {
          cbData = cbGlobal;
        }
      } else if (!cbError) {
        cbData = cbDataTry;
      }
      setCuentasBancarias(cbData || []);

      // 2. Movimientos bancarios
      const { data: movs, error: movsErr } = await supabase
        .from('movimientos_bancarios')
        .select(`
          *,
          movimiento_reembolso_id,
          estatus_conciliacion_bancaria(*),
          categorias_movimiento_bancario(*),
          cuentas_bancarias(*),
          comprobantes_deposito_movimientos(
            monto_asociado,
            comprobantes_deposito(*)
          ),
          conciliaciones_bancarias(
            monto_asociado,
            gasto:gastos(
              id,
              concepto,
              monto,
              fecha_gasto,
              xml_url,
              pdf_url,
              ticket_url,
              metodo_pago,
              proveedores(nombre_comercial, rfc)
            ),
            pedido:pedidos(
              id,
              numero_pedido,
              precio_total,
              cliente_nombre,
              fecha_pedido,
              clientes(nombre_local, rfc),
              facturas_clientes(*)
            )
          )
        `)
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });

      if (movsErr) {
        if (
          movsErr.message.includes('mes_conciliacion') || 
          movsErr.message.includes('relationship') ||
          movsErr.message.includes('comprobantes_deposito_movimientos') ||
          movsErr.code === '42703' ||
          movsErr.code === '42P01'
        ) {
          setShowMigrationBanner(true);
        }
        throw movsErr;
      }

      setMovimientos(movs || []);

      // 3. Catálogo de estatus
      const token = await getSessionToken();
      const { catalog: catalogData } = await getEstatusCatalog(token);
      if (catalogData) {
        setEstatusCatalog(catalogData);
      }

      // 4. Métodos de Pago
      const { data: fpData } = await supabase
        .from('formas_pago')
        .select('*')
        .order('nombre', { ascending: true });
      setFormasPago(fpData || []);

      // 5. Categorías de movimiento bancario
      const { data: catMovs } = await supabase
        .from('categorias_movimiento_bancario')
        .select('*')
        .order('nombre', { ascending: true });
      setCategoriasMovimiento(catMovs || []);

      // 6. Pedidos pendientes
      const { data: pPend } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, precio_total, cliente_nombre, fecha_pedido')
        .eq('empresa_id', empresaId)
        .is('folio_factura', null)
        .eq('estatus_pago', 'Liquidado')
        .order('created_at', { ascending: false });
      setPedidosPendientes(pPend || []);

      // 7. Gastos reconciliables
      const { data: gReconcile } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto, xml_url, pdf_url, ticket_url, metodo_pago, proveedores(nombre_comercial, rfc)')
        .eq('empresa_id', empresaId)
        .is('movimiento_bancario_id', null)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setGastosReconciliables(gReconcile || []);

      // 8. Comprobantes de depósito
      let compData = null;
      let compErr = null;
      try {
        const { data, error } = await supabase
          .from('comprobantes_deposito')
          .select(`
            *,
            cuentas_bancarias(*),
            comprobantes_deposito_movimientos(
              monto_asociado,
              movimiento_id
            )
          `)
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false });
        compData = data;
        compErr = error;
      } catch (e: any) {
        compErr = e;
      }

      if (compErr) {
        if (compErr.code === '42P01' || String(compErr.message).includes('relation "public.comprobantes_deposito" does not exist')) {
          setShowMigrationBanner(true);
        } else {
          console.error('Error fetching comprobantes_deposito:', compErr);
        }
      } else {
        setComprobantes(compData || []);
      }

    } catch (err: any) {
      console.error('Error fetching data:', err);
      setMessage({ text: 'Error al cargar datos: ' + (err.message || String(err)), type: 'error' });
    }
  };

  useEffect(() => {
    const init = async () => {
      const token = await getSessionToken();
      if (!token) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryToken = await getSessionToken();
        if (!retryToken) {
          return router.push('/admin/login');
        }
      }
      await fetchData();
    };
    init();
  }, [router]);

  // --- ACCIONES ---
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCuentaId) return;
    setExcelFile(file);
    setIsUploading(true);

    try {
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
            setIsUploading(false);
            return;
          }

          let headerIndex = 0;
          for (let i = 0; i < Math.min(15, rawData.length); i++) {
            const row = rawData[i];
            if (row && row.some((cell: any) => typeof cell === 'string' && (cell.toLowerCase().includes('fecha') || cell.toLowerCase().includes('concepto')))) {
              headerIndex = i;
              break;
            }
          }

          const headers = (rawData[headerIndex] || []).map((h: any) => String(h || '').trim());
          const rows = rawData.slice(headerIndex + 1).filter((row: any) => row && row.length > 0);

          const objectsData = rows.map((row: any) => {
            const obj: any = {};
            headers.forEach((h: string, idx: number) => {
              obj[h] = row[idx];
            });
            return obj;
          });

          // Detect columns mapping
          const mapping = { fecha: '', concepto: '', retiro: '', deposito: '', referencia: '' };
          headers.forEach((h: string) => {
            const hl = h.toLowerCase();
            if (hl.includes('fecha') || hl.includes('date')) mapping.fecha = h;
            else if (hl.includes('concepto') || hl.includes('descrip') || hl.includes('detalle')) mapping.concepto = h;
            else if (hl.includes('retiro') || hl.includes('cargo') || hl.includes('egreso') || hl.includes('salida')) mapping.retiro = h;
            else if (hl.includes('deposito') || hl.includes('abono') || hl.includes('ingreso') || hl.includes('entrada')) mapping.deposito = h;
            else if (hl.includes('ref') || hl.includes('nota') || hl.includes('id')) mapping.referencia = h;
          });

          // Perform import using reconciliationActions
          const token = await getSessionToken();
          const parsedMovements = objectsData.map((row: any) => {
            const fechaStr = row[mapping.fecha];
            let fecha = new Date().toISOString().substring(0, 10);
            if (fechaStr) {
              const parsedDate = new Date(fechaStr);
              if (!isNaN(parsedDate.getTime())) {
                fecha = parsedDate.toISOString().substring(0, 10);
              }
            }

            const rawRetiro = parseFloat(String(row[mapping.retiro] || 0).replace(/[^0-9.-]/g, '')) || 0;
            const rawDeposito = parseFloat(String(row[mapping.deposito] || 0).replace(/[^0-9.-]/g, '')) || 0;

            const isRetiro = rawRetiro > 0;
            const monto = isRetiro ? -rawRetiro : rawDeposito;

            return {
              fecha,
              concepto: String(row[mapping.concepto] || 'Movimiento sin concepto'),
              retiro: rawRetiro,
              deposito: rawDeposito,
              monto,
              tipo_movimiento: isRetiro ? 'Retiro' : 'Deposito',
              referencia: row[mapping.referencia] ? String(row[mapping.referencia]) : undefined,
              cuenta_bancaria_id: selectedCuentaId,
              mes_conciliacion: selectedMonth
            };
          });

          const importRes = await importarMovimientosBancarios(parsedMovements, token);
          if (importRes.success) {
            setMessage({ text: `Se importaron ${importRes.count} movimientos bancarios correctamente.`, type: 'success' });
            setExcelFile(null);
            await fetchData();
          } else {
            throw new Error(importRes.error);
          }
        } catch (e: any) {
          alert('Error al parsear el archivo Excel: ' + e.message);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      alert('Error en la importación: ' + err.message);
      setIsUploading(false);
    }
  };

  const handleAutoReconcile = async () => {
    if (!selectedCuentaId) {
      alert('Por favor selecciona una cuenta bancaria.');
      return;
    }
    setMessage({ text: 'Iniciando conciliación inteligente automática...', type: 'info' });
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
    setReconcileModal({
      open: true,
      movimiento: m,
      xmlUrl: m.xml_url || '',
      pdfFacturaUrl: m.pdf_factura_url || '',
      pdfTicketUrl: m.pdf_ticket_url || '',
      soporteReembolsoUrl: m.soporte_reembolso_url || '',
      storageProvider: m.storage_provider || 'Supabase',
      gastosSeleccionados: m.conciliaciones_bancarias?.filter((c: any) => !!c.gasto).map((c: any) => c.gasto.id) || [],
      pedidosSeleccionados: m.conciliaciones_bancarias?.filter((c: any) => !!c.pedido).map((c: any) => c.pedido.id) || [],
      estatusClave: m.estatus_conciliacion_bancaria?.clave || '',
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
      const res = await guardarConciliacionManual(reconcileModal.movimiento.id, {
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
        setMessage({ text: 'Conciliación manual guardada correctamente.', type: 'success' });
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

  const handleToggleVisibility = async (id: string, modulo: 'egresos'|'ingresos', visible: boolean) => {
    try {
      const token = await getSessionToken();
      const res = await toggleMovimientoVisibilidad(id, modulo, visible, token);
      if (res.success) {
        await fetchData();
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert('Error al cambiar visibilidad: ' + err.message);
    }
  };

  const handleUpdateCategoria = async (movimientoId: string, categoriaId: string) => {
    try {
      const { error } = await supabase
        .from('movimientos_bancarios')
        .update({ categoria_movimiento_id: categoriaId || null })
        .eq('id', movimientoId);
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      alert('Error al asignar categoría: ' + err.message);
    }
  };

  const handleGlobalLink = async () => {
    if (!selectedGlobalDepositId) {
      alert('Por favor selecciona un depósito.');
      return;
    }
    if (selectedGlobalPedidosIds.length === 0) {
      alert('Selecciona al menos un pedido.');
      return;
    }

    try {
      const token = await getSessionToken();
      const res = await guardarConciliacionManual(selectedGlobalDepositId, {
        gastosIds: [],
        pedidosIds: selectedGlobalPedidosIds,
        xmlUrl: '',
        pdfFacturaUrl: '',
        pdfTicketUrl: '',
        soporteReembolsoUrl: '',
        storageProvider: 'Supabase',
        estatusClave: 'comprobado'
      }, token);

      if (res.success) {
        setSelectedGlobalDepositId(null);
        setSelectedGlobalPedidosIds([]);
        setMessage({ text: 'Factura global/Pedidos asociados correctamente.', type: 'success' });
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      alert('Error en vinculación global: ' + err.message);
    }
  };

  const handleSaveCatalogItem = async () => {
    if (!catalogEditModal.nombre) {
      alert('El nombre es obligatorio.');
      return;
    }
    setCatalogEditModal((prev: any) => ({ ...prev, loading: true }));
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
        setCatalogEditModal((prev: any) => ({ ...prev, open: false }));
        await fetchData();
      } else {
        alert(res.error || 'Error al guardar estatus.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setCatalogEditModal((prev: any) => ({ ...prev, loading: false }));
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
    setFormasPagoModal((prev: any) => ({ ...prev, loading: true }));
    try {
      const { error } = await supabase.from('formas_pago').insert({ nombre: formasPagoModal.nombre });
      if (error) throw error;
      setFormasPagoModal((prev: any) => ({ ...prev, open: false, nombre: '' }));
      await fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setFormasPagoModal((prev: any) => ({ ...prev, loading: false }));
    }
  };

  const handleDeleteFormaPago = async (id: string) => {
    if (confirm('¿Deseas eliminar este método de pago?')) {
      try {
        const { error } = await supabase.from('formas_pago').delete().eq('id', id);
        if (error) throw error;
        await fetchData();
      } catch (err: any) {
        alert('Error: ' + err.message);
      }
    }
  };

  const handleDeleteMovimientoDirect = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este movimiento bancario?')) return;
    const token = await getSessionToken();
    const res = await eliminarMovimientoBancario(id, token);
    if (res.success) {
      alert('Movimiento eliminado exitosamente');
      await fetchData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleDownloadFile = async (url: string) => {
    try {
      const token = await getSessionToken();
      const res = await obtenerSignedUrl(url, token);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert(res.error || 'No se pudo obtener el archivo firmado.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al descargar archivo.');
    }
  };

  const handleUnlinkReconciliation = async (movimientoId: string) => {
    if (!confirm('¿Deseas quitar la conciliación de este movimiento? Se conservarán los gastos/pedidos intactos en el ERP.')) return;
    try {
      const token = await getSessionToken();
      const res = await desconciliarMovimientoBancario(movimientoId, token);
      if (res.success) {
        setMessage({ text: 'Movimiento desconciliado exitosamente.', type: 'success' });
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      alert('Error al desconciliar: ' + err.message);
    }
  };

  const handleBulkMoveMovimientos = async (movimientoIds: string[], cuentaBancariaId: string | null) => {
    try {
      const { error } = await supabase
        .from('movimientos_bancarios')
        .update({ cuenta_bancaria_id: cuentaBancariaId })
        .in('id', movimientoIds);
      if (error) throw error;
      setMessage({ text: 'Movimientos reubicados exitosamente.', type: 'success' });
      await fetchData();
    } catch (err: any) {
      alert('Error al mover movimientos: ' + err.message);
    }
  };

  const handleFusionarReembolso = async (
    movId1: string,
    movId2: string,
    payload: { soporteReembolsoUrl?: string | null; comentarios?: string | null }
  ) => {
    try {
      const token = await getSessionToken();
      const res = await fusionarMovimientosReembolso(movId1, movId2, payload, token);
      if (res.success) {
        setMessage({ text: 'Reembolsos fusionados exitosamente.', type: 'success' });
        await fetchData();
        return { success: true };
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      alert('Error al fusionar reembolsos: ' + err.message);
      return { success: false, error: err.message };
    }
  };

  const handleUpdateMesConciliacion = async (movimientoId: string, mes: string) => {
    try {
      const token = await getSessionToken();
      const res = await actualizarMesConciliacionMovimiento(movimientoId, mes, token);
      if (res.success) {
        setMessage({ text: 'Movimiento vinculado al mes de conciliación correctamente.', type: 'success' });
        await fetchData();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      alert('Error al vincular a otro mes: ' + err.message);
    }
  };

  const handleCrearComprobante = async (payload: {
    tipo: 'deposito_ventanilla' | 'corte_tarjeta';
    fecha: string;
    monto: number;
    descripcion?: string;
    archivo_url?: string;
    storage_provider?: 'Supabase' | 'GoogleDrive';
    cuenta_bancaria_id?: string | null;
    movimiento_bancario_id?: string | null;
    monto_debito?: number;
    monto_credito?: number;
    propina_debito?: number;
    propina_credito?: number;
    monto_amex?: number;
    propina_amex?: number;
  }) => {
    const token = await getSessionToken();
    const res = await crearComprobanteDeposito(payload, token);
    if (res.success) {
      await fetchData();
    }
    return res;
  };

  const handleActualizarComprobante = async (id: string, payload: any) => {
    const token = await getSessionToken();
    const res = await actualizarComprobanteDeposito(id, payload, token);
    if (res.success) {
      await fetchData();
    }
    return res;
  };

  const handleEliminarComprobante = async (id: string) => {
    const token = await getSessionToken();
    const res = await eliminarComprobanteDeposito(id, token);
    if (res.success) {
      await fetchData();
    }
    return res;
  };

  const handleVincularComprobante = async (comprobanteId: string, movimientoBancarioId: string, montoAsociado?: number) => {
    const token = await getSessionToken();
    const res = await vincularComprobanteAMovimiento(comprobanteId, movimientoBancarioId, token, montoAsociado);
    if (res.success) {
      await fetchData();
    }
    return res;
  };

  const handleDesvincularComprobante = async (comprobanteId: string, movimientoBancarioId: string | null = null) => {
    const token = await getSessionToken();
    const res = await desvincularComprobanteDeMovimiento(comprobanteId, movimientoBancarioId, token);
    if (res.success) {
      await fetchData();
    }
    return res;
  };

  // --- FILTRO DE MOVIMIENTOS POR MES SELECCIONADO Y CUENTA ---
  const movementsForSelectedMonth = movimientos.filter(m => {
    const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
    return mes === selectedMonth;
  });

  // --- CÁLCULO DE SALDOS E INGRESOS/EGRESOS POR CUENTA ---
  const getAccountStats = (cuenta: any) => {
    const cuentaMovs = movimientos.filter(m => m.cuenta_bancaria_id === cuenta.id);
    const movsDelMes = cuentaMovs.filter(m => {
      const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
      return mes === selectedMonth;
    });

    const isCajaChica = cuenta.nombre.toUpperCase().includes('CAJA CHICA');
    let ingresos = 0;
    let egresos = 0;

    movsDelMes.forEach(m => {
      const val = Number(m.monto) || 0;
      
      const isTraspaso = m.categorias_movimiento_bancario?.nombre?.toLowerCase().includes('traspaso') ||
                          m.categorias_movimiento_bancario?.nombre?.toLowerCase().includes('traspazo');
      if (isCajaChica && isTraspaso) {
        return; // Omitir traspasos en Caja Chica
      }

      if (isCajaChica) {
        // En Caja Chica, los retiros se suman (se consideran ingresos)
        if (val < 0) {
          ingresos += Math.abs(val);
        } else {
          ingresos += val;
        }
      } else {
        if (val > 0) {
          ingresos += val;
        } else {
          egresos += Math.abs(val);
        }
      }
    });

    const saldoInicial = Number(cuenta.saldo_inicial || 0);
    const saldoActual = isCajaChica 
      ? (saldoInicial + ingresos) 
      : (saldoInicial + ingresos - egresos);

    return {
      saldoInicial,
      ingresos,
      egresos,
      saldoActual
    };
  };

  const getGeneralStats = () => {
    let totalSaldoInicial = 0;
    let totalIngresos = 0;
    let totalEgresos = 0;
    let totalSaldoActual = 0;

    cuentasBancarias.forEach(cuenta => {
      const stats = getAccountStats(cuenta);
      totalSaldoInicial += stats.saldoInicial;
      totalIngresos += stats.ingresos;
      totalEgresos += stats.egresos;
      totalSaldoActual += stats.saldoActual;
    });

    return {
      saldoInicial: totalSaldoInicial,
      ingresos: totalIngresos,
      egresos: totalEgresos,
      saldoActual: totalSaldoActual
    };
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex flex-col p-8 w-full max-w-[100vw] mx-auto overflow-hidden">

        {/* HEADER */}
        <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3">
              <Landmark className="text-amber-500 w-8 h-8" /> Conciliación Bancaria
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Asocia tus movimientos bancarios del estado de cuenta con facturas de gastos y ventas.
            </p>
            {periodStatus !== 'abierto' && (
              <div className={`mt-3 inline-block px-3 py-1.5 rounded-lg text-[10px] font-bold border ${
                periodStatus === 'cerrado_definitivo'
                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900/50'
              }`}>
                Período {selectedMonth} — {periodStatus === 'cerrado_definitivo' ? 'Cerrado Definitivamente' : 'Cerrado'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <PeriodSelector onPeriodChange={() => { setBancoPage(0); refreshPeriodStatus(); }} />

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

        {/* MIGRATION ERROR BANNER */}
        {showMigrationBanner && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400 text-xs font-sans">
            <div className="flex gap-2 items-center font-bold mb-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Acción requerida: Base de Datos Desactualizada</span>
            </div>
            Para habilitar el soporte de vinculación de movimientos a otros meses, comentarios o el registro de tickets de depósito / cortes de tarjeta, ejecuta el siguiente script SQL en la consola SQL de tu Supabase Dashboard:
            <code className="block mt-2 bg-gray-900 text-gray-100 p-2.5 rounded font-mono select-all border border-gray-800 whitespace-pre overflow-x-auto">
{`ALTER TABLE public.movimientos_bancarios ADD COLUMN IF NOT EXISTS mes_conciliacion TEXT;
ALTER TABLE public.movimientos_bancarios ADD COLUMN IF NOT EXISTS comentarios TEXT;
ALTER TABLE public.movimientos_bancarios ADD COLUMN IF NOT EXISTS movimiento_reembolso_id UUID REFERENCES public.movimientos_bancarios(id) ON DELETE SET NULL;

ALTER TABLE public.facturas_clientes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();

DROP POLICY IF EXISTS "Aislamiento multiempresa para facturas_clientes" ON public.facturas_clientes;
CREATE POLICY "Aislamiento multiempresa para facturas_clientes" ON public.facturas_clientes
    FOR ALL TO authenticated USING (is_superusuario() OR empresa_id = get_auth_empresa_id()) WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

CREATE TABLE IF NOT EXISTS public.comprobantes_deposito (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('deposito_ventanilla', 'corte_tarjeta')),
    fecha DATE NOT NULL,
    monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    descripcion TEXT,
    archivo_url TEXT,
    storage_provider TEXT CHECK (storage_provider IN ('Supabase', 'GoogleDrive')) DEFAULT 'Supabase',
    cuenta_bancaria_id UUID REFERENCES public.cuentas_bancarias(id) ON DELETE SET NULL,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.comprobantes_deposito_movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comprobante_id UUID REFERENCES public.comprobantes_deposito(id) ON DELETE CASCADE,
    movimiento_id UUID REFERENCES public.movimientos_bancarios(id) ON DELETE CASCADE,
    monto_asociado NUMERIC(12,2) NOT NULL CHECK (monto_asociado > 0),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_comprobante_movimiento UNIQUE (comprobante_id, movimiento_id)
);

ALTER TABLE public.comprobantes_deposito ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobantes_deposito_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multiempresa para comprobantes_deposito" ON public.comprobantes_deposito;
CREATE POLICY "Aislamiento multiempresa para comprobantes_deposito" ON public.comprobantes_deposito
    FOR ALL TO authenticated USING (is_superusuario() OR (SELECT auth.uid()) IS NOT NULL) WITH CHECK (is_superusuario() OR (SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Aislamiento multiempresa para comprobantes_deposito_movimientos" ON public.comprobantes_deposito_movimientos;
CREATE POLICY "Aislamiento multiempresa para comprobantes_deposito_movimientos" ON public.comprobantes_deposito_movimientos
    FOR ALL TO authenticated USING (is_superusuario() OR (SELECT auth.uid()) IS NOT NULL) WITH CHECK (is_superusuario() OR (SELECT auth.uid()) IS NOT NULL);

GRANT ALL ON TABLE public.comprobantes_deposito TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.comprobantes_deposito_movimientos TO anon, authenticated, service_role;

-- Recargar el cache del esquema en Supabase
NOTIFY pgrst, 'reload schema';`}
            </code>
          </div>
        )}

        {/* FEEDBACK DE ESTADO */}
        {message && (
          <div className={`p-4 rounded-xl border mb-6 flex items-start justify-between gap-3 animate-in fade-in duration-300 ${message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
              : message.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
            }`}>
            <div className="flex items-start gap-3">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
              ) : message.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              ) : (
                <RefreshCw className="w-5 h-5 mt-0.5 shrink-0 animate-spin" />
              )}
              <div className="text-sm font-medium">{message.text}</div>
            </div>
            {message.type !== 'info' && (
              <button
                onClick={() => setMessage(null)}
                className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-300 transition-colors p-0.5 rounded-lg hover:bg-gray-150/50 dark:hover:bg-gray-800/50 shrink-0"
                title="Cerrar mensaje"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        {/* BANCOS / CUENTAS DE BANCO RESUMEN VISUAL (SALDOS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0 font-sans">
          {/* Card para el Saldo Total General */}
          <div
            className="p-5 rounded-2xl border border-transparent bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-md flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-sm truncate w-40 text-blue-50">Saldo Total General</h3>
                <p className="text-[10px] text-blue-200 mt-0.5">Suma de todas las cuentas</p>
              </div>
              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded font-mono bg-white/20 text-white">
                MXN
              </span>
            </div>
            {(() => {
              const stats = getGeneralStats();
              return (
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] text-blue-100 border-b border-white/10 pb-1">
                    <span>Ingresos:</span>
                    <span className="font-mono font-bold text-emerald-300">+{formatCurrency(stats.ingresos)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-blue-100 border-b border-white/10 pb-1">
                    <span>Egresos:</span>
                    <span className="font-mono font-bold text-red-300">-{formatCurrency(stats.egresos)}</span>
                  </div>
                  <div className="pt-1 flex justify-between items-baseline">
                    <span className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Saldo:</span>
                    <span className="text-lg font-black font-mono">{formatCurrency(stats.saldoActual)}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {cuentasBancarias.map((cuenta) => {
            const stats = getAccountStats(cuenta);
            const isSelected = selectedCuentaId === cuenta.id;
            return (
              <div
                key={cuenta.id}
                onClick={() => {
                  setSelectedCuentaId(isSelected ? '' : cuenta.id);
                  setBancoPage(0);
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer select-none shadow-sm flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500 ring-2 ring-amber-500/20'
                    : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-850 dark:text-gray-250 truncate w-40">{cuenta.nombre}</h3>
                    {cuenta.numero_cuenta && (
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">Nº: {cuenta.numero_cuenta}</p>
                    )}
                  </div>
                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded font-mono ${
                    isSelected ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-550 dark:text-gray-450'
                  }`}>
                    {cuenta.moneda}
                  </span>
                </div>
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-900 pb-1">
                    <span>Ingresos:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-500">+{formatCurrency(stats.ingresos)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-900 pb-1">
                    <span>Egresos:</span>
                    <span className="font-mono font-bold text-red-650 dark:text-red-500">-{formatCurrency(stats.egresos)}</span>
                  </div>
                  <div className="pt-1 flex justify-between items-baseline">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Saldo:</span>
                    <span className="text-lg font-black font-mono text-gray-900 dark:text-white">{formatCurrency(stats.saldoActual)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CONTAINER PRINCIPAL */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden flex-1 h-full min-h-0">
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            <BancoTab
              bancoSubTab={bancoSubTab}
              setBancoSubTab={setBancoSubTab}
              cuentasBancarias={cuentasBancarias}
              movimientos={movementsForSelectedMonth}
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
              handleUploadReconciliationFile={handleUploadReconciliationFile}
              handleRemoveReconciliationFile={handleRemoveReconciliationFile}
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
              handleDeleteMovimiento={handleDeleteMovimientoDirect}
              onDownloadFile={handleDownloadFile}
              onEditMovimiento={() => {}}
              selectedCuentaId={selectedCuentaId}
              setSelectedCuentaId={setSelectedCuentaId}
              handleUnlinkReconciliation={handleUnlinkReconciliation}
              handleBulkMoveMovimientos={handleBulkMoveMovimientos}
              handleUpdateMesConciliacion={handleUpdateMesConciliacion}
              comprobantes={comprobantes}
              onCrearComprobante={handleCrearComprobante}
              onActualizarComprobante={handleActualizarComprobante}
              onEliminarComprobante={handleEliminarComprobante}
              onVincularComprobante={handleVincularComprobante}
              onDesvincularComprobante={handleDesvincularComprobante}
              onFusionarReembolso={handleFusionarReembolso}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

interface XProps {
  size: number;
}
function X({ size }: XProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  );
}
