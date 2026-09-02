'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../lib/hooks/useSessionToken';
import { EditMovimientoModal } from '../gastos/_components/EditModals';
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
  fusionarMovimientosReembolso,
  resyncAllCajaChicaComprobantesAction
} from '../gastos/reconciliationActions';
import { ComprobanteDeposito } from '../types';
import {
  RefreshCw, AlertTriangle, CheckCircle, Sun, Moon,
  Calendar, ArrowRightLeft, Landmark, FileSpreadsheet, Link2
} from 'lucide-react';
import BancoTab from '../gastos/_components/BancoTab';
import PeriodSelector from '../_components/PeriodSelector';
import AsignacionXmlModal from '../gastos/_components/AsignacionXmlModal';

export const dynamic = 'force-dynamic';

export default function BankReconciliationModule() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const [showAsignacionXmlModal, setShowAsignacionXmlModal] = useState(false);

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
  const [bancoSubTab, setBancoSubTab] = useState<'movimientos' | 'ingresos_comprobantes' | 'cargas' | 'global' | 'comprobantes' | 'no_deducibles'>('movimientos');
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [selectedCuentaId, setSelectedCuentaId] = useState<string>('');
  const [pedidosPendientes, setPedidosPendientes] = useState<any[]>([]);
  const [gastosReconciliables, setGastosReconciliables] = useState<any[]>([]);
  const [selectedGlobalDepositId, setSelectedGlobalDepositId] = useState<string | null>(null);
  const [selectedGlobalPedidosIds, setSelectedGlobalPedidosIds] = useState<string[]>([]);
  const [editingMovimiento, setEditingMovimiento] = useState<any>(null);
  const [editMovimientoToken, setEditMovimientoToken] = useState<string>('');
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

  // Estados de carga e importación de Excel con Mapeo Manual
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [rawExcelRows, setRawExcelRows] = useState<any[]>([]);
  const [selectedHeaderRowIndex, setSelectedHeaderRowIndex] = useState<number>(0);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);
  const [sustituirCarga, setSustituirCarga] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modales
  const [reconcileModal, setReconcileModal] = useState<{
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
              proveedores(id, nombre_comercial, rfc, saldo_favor)
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

      // 6. Pedidos y Facturas de ingresos pendientes de conciliar
      const { data: pPend } = await supabase
        .from('pedidos')
        .select('*, clientes(nombre_local, rfc), facturas_clientes(*)')
        .eq('empresa_id', empresaId)
        .is('movimiento_bancario_id', null)
        .or('estatus_pago.is.null,estatus_pago.neq.Cancelado')
        .order('creado_en', { ascending: false });

      const { data: fIngresosSueltas } = await supabase
        .from('facturas_clientes')
        .select('*, clientes(nombre_local, rfc)')
        .eq('empresa_id', empresaId)
        .is('pedido_id', null)
        .is('movimiento_bancario_id', null)
        .order('fecha_emision', { ascending: false });

      const pedidosMapped = (pPend || []).map((p: any) => {
        const fcList = p.facturas_clientes;
        const fc = Array.isArray(fcList) ? fcList[0] : fcList;
        return {
          id: p.id,
          numero_pedido: p.numero_pedido || '',
          folio_factura: p.folio_factura || fc?.serie_folio || (fc?.uuid_fiscal ? `UUID:${fc.uuid_fiscal.substring(0, 8)}` : ''),
          precio_total: Number(fc?.total || p.precio_total || 0),
          cliente_nombre: p.cliente_nombre || p.clientes?.nombre_local || fc?.razon_social_receptor || '',
          fecha_pedido: p.fecha_pedido || fc?.fecha_emision || p.creado_en,
          metodo_pago: p.metodo_pago || fc?.metodo_pago || '',
          uuid_fiscal: p.uuid_fiscal || fc?.uuid_fiscal || ''
        };
      });

      const sueltasMapped = (fIngresosSueltas || []).map((f: any) => ({
        id: f.id,
        numero_pedido: '',
        folio_factura: f.serie_folio || (f.uuid_fiscal ? `UUID:${f.uuid_fiscal.substring(0, 8)}` : 'Factura XML'),
        precio_total: Number(f.total || 0),
        cliente_nombre: f.clientes?.nombre_local || f.razon_social_receptor || '',
        fecha_pedido: f.fecha_emision,
        metodo_pago: f.metodo_pago || '',
        uuid_fiscal: f.uuid_fiscal || '',
        _esFacturaSuelta: true
      }));

      setPedidosPendientes([...pedidosMapped, ...sueltasMapped]);

      // 7. Gastos reconciliables
      const { data: gReconcile } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto, xml_url, pdf_url, ticket_url, metodo_pago, proveedores(id, nombre_comercial, rfc, saldo_favor)')
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
        resyncAllCajaChicaComprobantesAction(empresaId).catch(console.error);
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

  // --- ACCIONES DE IMPORTACIÓN DE EXCEL Y CARGAS ---
  const updateHeadersAndMapping = (rows: any[], hIndex: number) => {
    const rawHeaderRow = rows[hIndex] || [];
    const headers = rawHeaderRow.map((h: any, idx: number) => {
      const str = String(h || '').trim();
      return str || `Columna ${idx + 1}`;
    });
    setExcelHeaders(headers);

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
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);

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
          
          if (!rawData || rawData.length === 0) {
            alert('El archivo está vacío.');
            return;
          }

          setRawExcelRows(rawData);

          let headerIndex = 0;
          for (let i = 0; i < Math.min(15, rawData.length); i++) {
            const row = rawData[i];
            if (row && row.some((cell: any) => typeof cell === 'string' && (cell.toLowerCase().includes('fecha') || cell.toLowerCase().includes('concepto') || cell.toLowerCase().includes('descripcion')))) {
              headerIndex = i;
              break;
            }
          }

          setSelectedHeaderRowIndex(headerIndex);
          updateHeadersAndMapping(rawData, headerIndex);
          setShowMappingModal(true);
        } catch (e: any) {
          alert('Error al leer el archivo Excel: ' + e.message);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      alert('Error al seleccionar el archivo: ' + err.message);
    }
  };

  const handleConfirmImport = async () => {
    if (!columnMapping.fecha || !columnMapping.concepto) {
      alert('Debes asignar al menos los campos Fecha y Concepto.');
      return;
    }
    if (!selectedCuentaId) {
      alert('Debes seleccionar la cuenta bancaria destino.');
      return;
    }

    setIsUploading(true);
    setShowMappingModal(false);

    try {
      const dataRows = rawExcelRows.slice(selectedHeaderRowIndex + 1).filter((row: any) => row && row.length > 0);
      const fechaColIdx = excelHeaders.indexOf(columnMapping.fecha);

      const parsedMovements = dataRows.map((rowArr: any) => {
        const rowObj: any = {};
        excelHeaders.forEach((h: string, idx: number) => {
          rowObj[h] = rowArr[idx];
        });

        let fechaRaw = rowObj[columnMapping.fecha];

        // Failsafe 1: Buscar por índice de columna si el objeto de encabezado falló
        if ((fechaRaw === undefined || fechaRaw === null || fechaRaw === '') && fechaColIdx >= 0 && rowArr) {
          fechaRaw = rowArr[fechaColIdx];
        }

        // Failsafe 2: Inspeccionar la fila para encontrar la celda con la fecha si la columna no se mapeó
        if ((fechaRaw === undefined || fechaRaw === null || fechaRaw === '') && rowArr) {
          const foundDateCell = rowArr.find((c: any) => {
            const str = String(c || '').trim();
            return /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(str) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str) || /^\d{5}$/.test(str);
          });
          if (foundDateCell) fechaRaw = foundDateCell;
        }

        const fechaStr = String(fechaRaw || '').trim();
        let fecha = new Date().toISOString().substring(0, 10);

        if (fechaStr) {
          if (/^\d{4,5}(\.\d+)?$/.test(fechaStr)) {
            const serial = parseFloat(fechaStr);
            const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
            if (!isNaN(date.getTime())) {
              const yyyy = date.getUTCFullYear();
              const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
              const dd = String(date.getUTCDate()).padStart(2, '0');
              fecha = `${yyyy}-${mm}-${dd}`;
            }
          } else {
            const dateOnly = fechaStr.split('T')[0].split(' ')[0].trim();
            if (dateOnly.includes('-')) {
              const parts = dateOnly.split('-');
              if (parts[0] && parts[0].length === 4) {
                fecha = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              } else if (parts[2] && parts[2].trim().length >= 2) {
                const yr = parts[2].trim().substring(0, 4);
                const yyyy = yr.length === 2 ? `20${yr}` : yr;
                fecha = `${yyyy}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            } else if (dateOnly.includes('/')) {
              const parts = dateOnly.split('/');
              if (parts[0] && parts[0].length === 4) {
                fecha = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              } else if (parts[2] && parts[2].trim().length >= 2) {
                const yr = parts[2].trim().substring(0, 4);
                const yyyy = yr.length === 2 ? `20${yr}` : yr;
                fecha = `${yyyy}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            } else {
              const d = new Date(fechaStr);
              if (!isNaN(d.getTime())) {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                fecha = `${yyyy}-${mm}-${dd}`;
              }
            }
          }
        }

        const rawRetiro = parseFloat(String(rowObj[columnMapping.retiro] || 0).replace(/[^0-9.-]/g, '')) || 0;
        const rawDeposito = parseFloat(String(rowObj[columnMapping.deposito] || 0).replace(/[^0-9.-]/g, '')) || 0;

        const isRetiro = rawRetiro > 0;
        const monto = isRetiro ? -rawRetiro : rawDeposito;

        return {
          fecha,
          concepto: String(rowObj[columnMapping.concepto] || 'Movimiento sin concepto'),
          retiro: rawRetiro,
          deposito: rawDeposito,
          monto,
          tipo_movimiento: isRetiro ? 'Retiro' : 'Deposito',
          referencia: columnMapping.referencia ? String(rowObj[columnMapping.referencia] || '') : undefined,
          cuenta_bancaria_id: selectedCuentaId,
          mes_conciliacion: selectedMonth,
          nombre_archivo: excelFile?.name
        };
      }).filter(m => m.fecha && m.concepto);

      const token = await getSessionToken();
      const importRes = await importarMovimientosBancarios(
        parsedMovements,
        token,
        selectedCuentaId,
        excelFile?.name || 'Estado_de_cuenta.xlsx',
        sustituirCarga?.id
      );

      if (importRes.success) {
        const actionText = sustituirCarga ? 'Sustituidos' : 'Importados';
        setMessage({ text: `${actionText} ${importRes.count} movimientos bancarios correctamente.`, type: 'success' });
        setExcelFile(null);
        setSustituirCarga(null);
        await fetchData();
      } else {
        throw new Error(importRes.error);
      }
    } catch (e: any) {
      alert('Error al importar los movimientos: ' + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartSustituirCarga = (carga: any) => {
    setSustituirCarga(carga);
    if (carga.cuenta_id) {
      setSelectedCuentaId(carga.cuenta_id);
    }
    fileInputRef.current?.click();
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

    if (linkedPedidos.length > 0) {
      setPedidosPendientes((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = linkedPedidos.filter((p) => !existingIds.has(p.id));
        return newItems.length > 0 ? [...newItems, ...prev] : prev;
      });
    }

    // Merge XML URLs from movement and linked gastos
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

  // --- FILTRO DE MOVIMIENTOS Y COMPROBANTES POR MES SELECCIONADO ---
  const movementsForSelectedMonth = movimientos.filter(m => {
    const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
    return mes === selectedMonth;
  });

  const comprobantesForSelectedMonth = comprobantes.filter(c => {
    if (!c.fecha) return true;
    return c.fecha.substring(0, 7) === selectedMonth;
  });

  // --- CÁLCULO DE SALDOS E INGRESOS/EGRESOS POR CUENTA ---
  const getAccountStats = (cuenta: any) => {
    const isCajaChica = cuenta.nombre.toUpperCase().includes('CAJA CHICA');

    if (isCajaChica) {
      const comprobantesMes = comprobantes.filter(c => {
        const mes = c.fecha ? c.fecha.substring(0, 7) : '';
        return (!selectedMonth || mes === selectedMonth) && c.tipo !== 'deposito_ventanilla';
      });

      const ingresosBase = comprobantesMes.reduce((sum, c) => sum + Number(c.monto_efectivo || 0), 0);
      const ingresosPropinas = comprobantesMes.reduce((sum, c) => sum + Number(c.propina_efectivo || 0), 0);
      const ingresos = ingresosBase + ingresosPropinas;

      const cuentaMovs = movimientos.filter(m => m.cuenta_bancaria_id === cuenta.id);
      const movsDelMes = cuentaMovs.filter(m => {
        const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
        return !selectedMonth || mes === selectedMonth;
      });

      let egresos = 0;

      movsDelMes.forEach(m => {
        const val = Number(m.monto) || 0;
        const isTraspaso = m.categorias_movimiento_bancario?.nombre?.toLowerCase().includes('traspaso') ||
                            m.categorias_movimiento_bancario?.nombre?.toLowerCase().includes('traspazo');
        if (isTraspaso) return;

        if (val < 0) {
          egresos += Math.abs(val);
        }
      });

      const saldoInicial = Number(cuenta.saldo_inicial || 0);
      const saldoActual = saldoInicial + ingresos - egresos;

      return {
        saldoInicial,
        ingresos,
        ingresosBase,
        ingresosPropinas,
        egresos,
        saldoActual
      };
    }

    const isBBVA = cuenta.nombre.toUpperCase().includes('BBVA');
    if (isBBVA) {
      const comprobantesMes = comprobantes.filter(c => {
        const mes = c.fecha ? c.fecha.substring(0, 7) : '';
        if (selectedMonth && mes !== selectedMonth) return false;
        if (c.tipo === 'deposito_ventanilla') return false;
        if (c.cuenta_bancaria_id && c.cuenta_bancaria_id !== cuenta.id) return false;
        if (c.tipo === 'corte_parrot') return false;
        return true;
      });

      const ingresosBase = comprobantesMes.reduce((sum, c) => {
        return sum + Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0);
      }, 0);

      const ingresosPropinas = comprobantesMes.reduce((sum, c) => {
        return sum + Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0);
      }, 0);

      const ingresos = ingresosBase + ingresosPropinas;

      const cuentaMovs = movimientos.filter(m => m.cuenta_bancaria_id === cuenta.id);
      const movsDelMes = cuentaMovs.filter(m => {
        const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
        return !selectedMonth || mes === selectedMonth;
      });

      let egresos = 0;

      movsDelMes.forEach(m => {
        const val = Number(m.monto) || 0;
        const isTraspaso = m.categorias_movimiento_bancario?.nombre?.toLowerCase().includes('traspaso') ||
                            m.categorias_movimiento_bancario?.nombre?.toLowerCase().includes('traspazo');
        if (isTraspaso) return;

        if (val < 0) {
          egresos += Math.abs(val);
        }
      });

      const saldoInicial = Number(cuenta.saldo_inicial || 0);
      const saldoActual = saldoInicial + ingresos - egresos;

      return {
        saldoInicial,
        ingresos,
        ingresosBase,
        ingresosPropinas,
        egresos,
        saldoActual
      };
    }

    const isParrot = cuenta.nombre.toUpperCase().includes('PARROT');
    if (isParrot) {
      const comprobantesMes = comprobantes.filter(c => {
        const mes = c.fecha ? c.fecha.substring(0, 7) : '';
        if (selectedMonth && mes !== selectedMonth) return false;
        if (c.tipo === 'deposito_ventanilla') return false;
        return true;
      });

      const ingresosBase = comprobantesMes.reduce((sum, c) => sum + Number(c.monto_parrotpay || 0), 0);
      const ingresosPropinas = comprobantesMes.reduce((sum, c) => sum + Number(c.propina_parrotpay || 0), 0);
      const ingresos = ingresosBase + ingresosPropinas;

      const cuentaMovs = movimientos.filter(m => m.cuenta_bancaria_id === cuenta.id);
      const movsDelMes = cuentaMovs.filter(m => {
        const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
        return !selectedMonth || mes === selectedMonth;
      });

      let egresos = 0;

      movsDelMes.forEach(m => {
        const val = Number(m.monto) || 0;
        if (val < 0) {
          egresos += Math.abs(val);
        }
      });

      const saldoInicial = Number(cuenta.saldo_inicial || 0);
      const saldoActual = saldoInicial + ingresos - egresos;

      return {
        saldoInicial,
        ingresos,
        ingresosBase,
        ingresosPropinas,
        egresos,
        saldoActual
      };
    }

    const cuentaMovs = movimientos.filter(m => m.cuenta_bancaria_id === cuenta.id);
    const movsDelMes = cuentaMovs.filter(m => {
      const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
      return !selectedMonth || mes === selectedMonth;
    });

    let ingresos = 0;
    let egresos = 0;

    movsDelMes.forEach(m => {
      const val = Number(m.monto) || 0;
      if (val > 0) {
        ingresos += val;
      } else if (val < 0) {
        egresos += Math.abs(val);
      }
    });

    const saldoInicial = Number(cuenta.saldo_inicial || 0);
    const saldoActual = saldoInicial + ingresos - egresos;

    return {
      saldoInicial,
      ingresos,
      ingresosBase: ingresos,
      ingresosPropinas: 0,
      egresos,
      saldoActual
    };
  };

  const getGeneralStats = () => {
    let totalSaldoInicial = 0;
    let totalIngresos = 0;
    let totalIngresosBase = 0;
    let totalIngresosPropinas = 0;
    let totalEgresos = 0;
    let totalSaldoActual = 0;

    cuentasBancarias.forEach(cuenta => {
      const stats = getAccountStats(cuenta);
      totalSaldoInicial += stats.saldoInicial;
      totalIngresos += stats.ingresos;
      totalIngresosBase += stats.ingresosBase || 0;
      totalIngresosPropinas += stats.ingresosPropinas || 0;
      totalEgresos += stats.egresos;
      totalSaldoActual += stats.saldoActual;
    });

    return {
      saldoInicial: totalSaldoInicial,
      ingresos: totalIngresos,
      ingresosBase: totalIngresosBase,
      ingresosPropinas: totalIngresosPropinas,
      egresos: totalEgresos,
      saldoActual: totalSaldoActual
    };
  };

  const isCompCuadrado = (c: any) => {
    const sumAsoc = (c.comprobantes_deposito_movimientos || []).reduce((acc: number, rel: any) => acc + Number(rel.monto_asociado || 0), 0);
    return Math.abs(Number(c.monto || 0) - sumAsoc) < 0.05;
  };

  const formatTicketMovimientosAsignados = (c: any, movsAll: any[]) => {
    const links = c.comprobantes_deposito_movimientos || [];
    if (links.length === 0) {
      return {
        montoAsociado: 0,
        diferencia: Number(c.monto || 0),
        estatus: 'Pendiente',
        movsText: 'Sin movimientos asignados',
        refsText: '-'
      };
    }

    const sumAsoc = links.reduce((sum: number, rel: any) => sum + Number(rel.monto_asociado || 0), 0);
    const isFully = Math.abs(Number(c.monto || 0) - sumAsoc) < 0.05;
    const diff = Number(c.monto || 0) - sumAsoc;

    const movsDescList: string[] = [];
    const refsList: string[] = [];

    links.forEach((rel: any) => {
      const m = rel.movimientos_bancarios || movsAll.find((item: any) => item.id === rel.movimiento_id);
      const fecha = m?.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '';
      const concepto = m?.concepto || 'Movimiento Bancario';
      const ref = m?.referencia || '';
      const montoAsoc = Number(rel.monto_asociado || 0);

      movsDescList.push(`${fecha} - ${concepto} ($${montoAsoc.toFixed(2)})`);
      if (ref) refsList.push(ref);
    });

    return {
      montoAsociado: sumAsoc,
      diferencia: Math.max(0, diff),
      estatus: isFully ? 'Conciliado' : 'Conciliado Parcial',
      movsText: movsDescList.join(' | '),
      refsText: refsList.join(', ') || '-'
    };
  };

  // --- EXPORTACIÓN A EXCEL SEPARADA PARA INGRESOS Y EGRESOS POR BANCO ---
  const getIngresosRowsForCuenta = (cuenta: any) => {
    const isCajaChica = cuenta.nombre?.toUpperCase().includes('CAJA CHICA');
    const isParrotPay = cuenta.nombre?.toUpperCase().includes('PARROT');
    const isBBVA = cuenta.nombre?.toUpperCase().includes('BBVA');

    const cuentaMovs = movimientos.filter(m => m.cuenta_bancaria_id === cuenta.id);
    const movsDelMes = cuentaMovs.filter(m => {
      const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
      return !selectedMonth || mes === selectedMonth;
    });

    const comprobantesMes = comprobantes.filter(c => {
      const mes = c.fecha ? c.fecha.substring(0, 7) : '';
      if (selectedMonth && mes !== selectedMonth) return false;

      // Si el comprobante ya está asignado explícitamente a otra cuenta (ej: Parrot)
      if (c.cuenta_bancaria_id && c.cuenta_bancaria_id !== cuenta.id) {
        if (isCajaChica && (Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0)) return true;
        return false;
      }

      if (c.cuenta_bancaria_id === cuenta.id) return true;
      if (isCajaChica && (Number(c.monto_efectivo || 0) > 0 || Number(c.propina_efectivo || 0) > 0)) return true;
      if (isParrotPay && (Number(c.monto_parrotpay || 0) > 0 || Number(c.propina_parrotpay || 0) > 0 || c.tipo === 'corte_parrot')) return true;

      if (isBBVA) {
        if (c.tipo === 'corte_parrot') return false;
        const tarjetaTotalBBVA = Number(c.monto_debito || 0) + Number(c.propina_debito || 0) + Number(c.monto_credito || 0) + Number(c.propina_credito || 0) + Number(c.monto_amex || 0) + Number(c.propina_amex || 0);
        if (tarjetaTotalBBVA > 0 || c.tipo === 'corte_bbva') return true;
      }

      return false;
    });

    const rows: any[] = [];

    // 1. TICKETS Y COMPROBANTES DE INGRESO
    comprobantesMes.forEach(c => {
      if (isCajaChica && c.tipo === 'deposito_ventanilla') return;

      let targetAmountTotal = Number(c.monto || 0);
      let targetAmountBase = Number(c.monto || 0);
      let targetAmountPropina = 0;
      let tipoDesc = c.tipo === 'deposito_ventanilla' ? 'Depósito Ventanilla' : 'Ticket / Corte POS';

      if (isCajaChica) {
        targetAmountBase = Number(c.monto_efectivo || 0);
        targetAmountPropina = Number(c.propina_efectivo || 0);
        targetAmountTotal = targetAmountBase + targetAmountPropina;
        tipoDesc = 'Venta Efectivo (Parrot/POS)';
      } else if (isParrotPay) {
        targetAmountBase = Number(c.monto_parrotpay || 0);
        targetAmountPropina = Number(c.propina_parrotpay || 0);
        targetAmountTotal = targetAmountBase + targetAmountPropina;
        tipoDesc = 'Venta ParrotPay (POS)';
      } else if (isBBVA && c.tipo !== 'deposito_ventanilla') {
        targetAmountBase = Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0);
        targetAmountPropina = Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0);
        targetAmountTotal = targetAmountBase + targetAmountPropina;
        tipoDesc = 'Venta Tarjetas BBVA/POS';
      }

      if (targetAmountTotal <= 0 && c.tipo !== 'deposito_ventanilla') return;

      const assignedInfo = formatTicketMovimientosAsignados(c, movimientos);

      rows.push({
        'Fecha Ticket': c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
        'Cuenta / Banco': cuenta.nombre,
        'Tipo Ingreso': tipoDesc,
        'Importe sin Propina': targetAmountBase,
        'Importe de la Propina': targetAmountPropina,
        'Importe Total': targetAmountTotal,
        'Estatus de la Conciliación': assignedInfo.estatus
      });
    });

    // 2. MOVIMIENTOS BANCARIOS DIRECTOS EN ESTADO DE CUENTA (Sólo para cuentas de banco generales sin cortes POS)
    if (!isBBVA && !isCajaChica && !isParrotPay) {
      movsDelMes.forEach(m => {
        const val = Number(m.monto || 0);
        const ref = m.referencia || '';
        if (ref.startsWith('COMPROBANTE_EFECTIVO_')) return;

        if (val > 0) {
          rows.push({
            'Fecha Ticket': m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
            'Cuenta / Banco': cuenta.nombre,
            'Tipo Ingreso': m.tipo_movimiento || 'Depósito Bancario Directo',
            'Importe sin Propina': val,
            'Importe de la Propina': 0,
            'Importe Total': val,
            'Estatus de la Conciliación': m.estatus_conciliacion_bancaria?.nombre || 'Directo en Banco'
          });
        }
      });
    }

    return rows;
  };

  const getEgresosRowsForCuenta = (cuenta: any) => {
    const cuentaMovs = movimientos.filter(m => m.cuenta_bancaria_id === cuenta.id);
    const movsDelMes = cuentaMovs.filter(m => {
      const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
      return !selectedMonth || mes === selectedMonth;
    });

    const rows: any[] = [];
    movsDelMes.forEach(m => {
      const val = Number(m.monto || 0);
      const isTraspaso = m.categorias_movimiento_bancario?.nombre?.toLowerCase().includes('traspaso') ||
                          m.categorias_movimiento_bancario?.nombre?.toLowerCase().includes('traspazo');
      if (isTraspaso) return;
      if (val < 0) {
        rows.push({
          'Fecha': m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
          'Banco / Cuenta': cuenta.nombre,
          'Tipo Egreso': m.tipo_movimiento || 'Retiro / Gasto',
          'Concepto / Descripción': m.concepto || 'Egreso',
          'Importe Egreso (-)': Math.abs(val),
          'Categoría Movimiento': m.categorias_movimiento_bancario?.nombre || 'Sin Categoría',
          'RFC Proveedor': m.rfc_proveedor || '-',
          'Estatus Conciliación': m.estatus_conciliacion_bancaria?.nombre || 'Registrado',
          'Referencia / Folio': m.referencia || '-'
        });
      }
    });
    return rows;
  };

  const exportReporteCuentaExcel = async (cuenta: any) => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const ingresosRows = getIngresosRowsForCuenta(cuenta);
      const egresosRows = getEgresosRowsForCuenta(cuenta);

      const wsIngresos = XLSX.utils.json_to_sheet(ingresosRows.length > 0 ? ingresosRows : [{ 'Aviso': 'Sin ingresos registrados en este período' }]);
      const wsEgresos = XLSX.utils.json_to_sheet(egresosRows.length > 0 ? egresosRows : [{ 'Aviso': 'Sin egresos registrados en este período' }]);

      XLSX.utils.book_append_sheet(wb, wsIngresos, 'Ingresos');
      XLSX.utils.book_append_sheet(wb, wsEgresos, 'Egresos');

      const cleanName = cuenta.nombre.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 25);
      const monthStr = selectedMonth ? `_${selectedMonth}` : '';
      XLSX.writeFile(wb, `Reporte_Banco_${cleanName}${monthStr}.xlsx`);
    } catch (err: any) {
      console.error('Error al exportar reporte en Excel:', err);
      alert(`Error al generar Excel: ${err.message}`);
    }
  };

  const exportReporteSoloIngresosExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const allIngresos: any[] = [];
      cuentasBancarias.forEach(cuenta => {
        const rows = getIngresosRowsForCuenta(cuenta);
        allIngresos.push(...rows);
      });

      const wsGlobal = XLSX.utils.json_to_sheet(allIngresos.length > 0 ? allIngresos : [{ 'Aviso': 'Sin ingresos en el período' }]);
      XLSX.utils.book_append_sheet(wb, wsGlobal, 'Ingresos Todos los Bancos');

      cuentasBancarias.forEach(cuenta => {
        const rows = getIngresosRowsForCuenta(cuenta);
        const wsBank = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Aviso': 'Sin ingresos registrados' }]);
        const sheetName = `Ingresos_${cuenta.nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)}`;
        XLSX.utils.book_append_sheet(wb, wsBank, sheetName);
      });

      const monthStr = selectedMonth ? `_${selectedMonth}` : '';
      XLSX.writeFile(wb, `Reporte_Solo_Ingresos${monthStr}.xlsx`);
    } catch (err: any) {
      console.error('Error al exportar reporte de ingresos:', err);
      alert(`Error al generar Excel: ${err.message}`);
    }
  };

  const exportReporteSoloEgresosExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const allEgresos: any[] = [];
      cuentasBancarias.forEach(cuenta => {
        const rows = getEgresosRowsForCuenta(cuenta);
        allEgresos.push(...rows);
      });

      const wsGlobal = XLSX.utils.json_to_sheet(allEgresos.length > 0 ? allEgresos : [{ 'Aviso': 'Sin egresos en el período' }]);
      XLSX.utils.book_append_sheet(wb, wsGlobal, 'Egresos Todos los Bancos');

      cuentasBancarias.forEach(cuenta => {
        const rows = getEgresosRowsForCuenta(cuenta);
        const wsBank = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Aviso': 'Sin egresos registrados' }]);
        const sheetName = `Egresos_${cuenta.nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)}`;
        XLSX.utils.book_append_sheet(wb, wsBank, sheetName);
      });

      const monthStr = selectedMonth ? `_${selectedMonth}` : '';
      XLSX.writeFile(wb, `Reporte_Solo_Egresos${monthStr}.xlsx`);
    } catch (err: any) {
      console.error('Error al exportar reporte de egresos:', err);
      alert(`Error al generar Excel: ${err.message}`);
    }
  };

  const exportReporteTodosLosBancosExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const summaryRows = cuentasBancarias.map(cuenta => {
        const stats = getAccountStats(cuenta);
        return {
          'Cuenta Bancaria': cuenta.nombre,
          'Moneda': cuenta.moneda || 'MXN',
          'Número Cuenta': cuenta.numero_cuenta || '-',
          'Saldo Inicial': stats.saldoInicial,
          'Total Ingresos (+)': stats.ingresos,
          'Total Egresos (-)': stats.egresos,
          'Saldo Actual': stats.saldoActual
        };
      });

      const statsGen = getGeneralStats();
      summaryRows.push({
        'Cuenta Bancaria': '--- TOTAL GENERAL ---',
        'Moneda': 'MXN',
        'Número Cuenta': '',
        'Saldo Inicial': statsGen.saldoInicial,
        'Total Ingresos (+)': statsGen.ingresos,
        'Total Egresos (-)': statsGen.egresos,
        'Saldo Actual': statsGen.saldoActual
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen General');

      cuentasBancarias.forEach(cuenta => {
        const ingresosRows = getIngresosRowsForCuenta(cuenta);
        const egresosRows = getEgresosRowsForCuenta(cuenta);
        const cleanName = cuenta.nombre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 18);

        const wsIng = XLSX.utils.json_to_sheet(ingresosRows.length > 0 ? ingresosRows : [{ 'Aviso': 'Sin ingresos' }]);
        XLSX.utils.book_append_sheet(wb, wsIng, `${cleanName}_Ingresos`);

        const wsEgr = XLSX.utils.json_to_sheet(egresosRows.length > 0 ? egresosRows : [{ 'Aviso': 'Sin egresos' }]);
        XLSX.utils.book_append_sheet(wb, wsEgr, `${cleanName}_Egresos`);
      });

      const monthStr = selectedMonth ? `_${selectedMonth}` : '';
      XLSX.writeFile(wb, `Reporte_Bancos_Completo${monthStr}.xlsx`);
    } catch (err: any) {
      console.error('Error al exportar todos los bancos:', err);
      alert(`Error al generar Excel: ${err.message}`);
    }
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
          <div className="flex items-center gap-3 flex-wrap">
            <PeriodSelector onPeriodChange={() => { setBancoPage(0); refreshPeriodStatus(); }} />

            <button
              onClick={() => setShowAsignacionXmlModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer"
              title="Abrir Asignación de Facturas XML a Pedidos por Coincidencia de Importe"
            >
              <Link2 size={15} />
              <span>Asignación XML</span>
            </button>

            <button
              onClick={exportReporteSoloIngresosExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer"
              title="Descargar únicamente el reporte de Ingresos en Excel (.xlsx)"
            >
              <FileSpreadsheet size={15} />
              <span>Reporte Ingresos</span>
            </button>

            <button
              onClick={exportReporteSoloEgresosExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer"
              title="Descargar únicamente el reporte de Egresos en Excel (.xlsx)"
            >
              <FileSpreadsheet size={15} />
              <span>Reporte Egresos</span>
            </button>

            <button
              onClick={exportReporteTodosLosBancosExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer"
              title="Descargar reporte completo en Excel con hojas separadas de Ingresos y Egresos por banco"
            >
              <FileSpreadsheet size={15} />
              <span>Bancos (Completo)</span>
            </button>

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
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.comprobantes_deposito_movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comprobante_id UUID REFERENCES public.comprobantes_deposito(id) ON DELETE CASCADE,
    movimiento_id UUID REFERENCES public.movimientos_bancarios(id) ON DELETE CASCADE,
    monto_asociado NUMERIC(12,2) NOT NULL CHECK (monto_asociado > 0),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
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
                  <div className="flex justify-between items-start text-[10px] text-blue-100 border-b border-white/10 pb-1">
                    <span>Ingresos Total:</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-300 block">+{formatCurrency(stats.ingresos)}</span>
                      {stats.ingresosPropinas > 0 && (
                        <span className="text-[9px] font-mono text-blue-200 block font-normal mt-0.5">
                          (Venta: {formatCurrency(stats.ingresosBase)} | Prop: {formatCurrency(stats.ingresosPropinas)})
                        </span>
                      )}
                    </div>
                  </div>
                  {stats.ingresosPropinas > 0 && (
                    <div className="flex justify-between text-[10px] text-blue-100 border-b border-white/10 pb-1">
                      <span>Propinas (Separadas):</span>
                      <span className="font-mono font-bold text-amber-300">+{formatCurrency(stats.ingresosPropinas)}</span>
                    </div>
                  )}
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
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportReporteCuentaExcel(cuenta);
                      }}
                      className="px-2 py-0.5 rounded font-mono text-[9px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-955/40 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1"
                      title={`Descargar Reporte Excel de ${cuenta.nombre}`}
                    >
                      <FileSpreadsheet size={11} /> Excel
                    </button>
                    <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded font-mono ${
                      isSelected ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-550 dark:text-gray-450'
                    }`}>
                      {cuenta.moneda}
                    </span>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between items-start text-[10px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-900 pb-1">
                    <span>Ingresos Total:</span>
                    <div className="text-right">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-500 block">+{formatCurrency(stats.ingresos)}</span>
                      {stats.ingresosPropinas > 0 && (
                        <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 block font-normal mt-0.5">
                          (Venta: {formatCurrency(stats.ingresosBase)} | Prop: {formatCurrency(stats.ingresosPropinas)})
                        </span>
                      )}
                    </div>
                  </div>
                  {stats.ingresosPropinas > 0 && (
                    <div className="flex justify-between items-center text-[10px] text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-900 pb-1">
                      <span>Propinas (Separadas):</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">+{formatCurrency(stats.ingresosPropinas)}</span>
                    </div>
                  )}
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
              onEditMovimiento={(m) => {
                getSessionToken().then((t) => {
                  setEditMovimientoToken(t || '');
                  setEditingMovimiento(m);
                });
              }}
              selectedCuentaId={selectedCuentaId}
              setSelectedCuentaId={setSelectedCuentaId}
              handleUnlinkReconciliation={handleUnlinkReconciliation}
              handleBulkMoveMovimientos={handleBulkMoveMovimientos}
              handleUpdateMesConciliacion={handleUpdateMesConciliacion}
              comprobantes={comprobantesForSelectedMonth}
              selectedMonth={selectedMonth}
              onCrearComprobante={handleCrearComprobante}
              onActualizarComprobante={handleActualizarComprobante}
              onEliminarComprobante={handleEliminarComprobante}
              onVincularComprobante={handleVincularComprobante}
              onDesvincularComprobante={handleDesvincularComprobante}
              onFusionarReembolso={handleFusionarReembolso}
              onStartSustituirCarga={handleStartSustituirCarga}
              onReloadMovimientos={fetchData}
              onOpenUploadModal={() => fileInputRef.current?.click()}
            />
          </div>
        </div>

      </div>

      {/* INPUT OCULTO PARA SUSTITUIR / CARGAR ESTADO DE CUENTA */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleExcelUpload}
        className="hidden"
      />

      {/* MODAL DE ASIGNACIÓN MANUAL DE ENCABEZADOS Y MAPEO DE COLUMNAS */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-xl shadow-2xl text-gray-900 dark:text-gray-100 flex flex-col font-sans max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold flex items-center gap-2 text-amber-500 mb-1">
              <FileSpreadsheet size={18} /> Asignación de Encabezados y Mapeo
            </h3>
            
            {sustituirCarga && (
              <div className="mt-2 mb-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                <div>
                  <span className="font-bold">Sustituyendo Carga Original: </span>
                  {sustituirCarga.nombre_archivo} ({sustituirCarga.total_movimientos} registros). Los movimientos anteriores y sus conciliaciones asociadas serán reemplazados.
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Selecciona la fila que contiene los nombres de las columnas (encabezados) y asigna la correspondencia de los datos.
            </p>

            {/* Selector de Cuenta Destino */}
            <div className="mb-4">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cuenta Bancaria Destino *</label>
              <select
                value={selectedCuentaId}
                onChange={(e) => setSelectedCuentaId(e.target.value)}
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="">-- Seleccionar Cuenta Bancaria --</option>
                {cuentasBancarias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                ))}
              </select>
            </div>

            {/* Selector de Fila de Encabezados */}
            <div className="mb-4 bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-200 dark:border-gray-800">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                Fila de Encabezados en el Archivo
              </label>
              <select
                value={selectedHeaderRowIndex}
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  setSelectedHeaderRowIndex(idx);
                  updateHeadersAndMapping(rawExcelRows, idx);
                }}
                className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
              >
                {rawExcelRows.slice(0, 15).map((row, idx) => {
                  const sampleText = Array.isArray(row) ? row.filter(Boolean).slice(0, 4).join(' | ') : '';
                  return (
                    <option key={idx} value={idx}>
                      Fila {idx + 1}: {sampleText || '(Fila vacía)'}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Mapeo de Campos */}
            <div className="space-y-3 mb-6">
              <h4 className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Correspondencia de Columnas</h4>
              {[
                { field: 'fecha', label: 'Columna de Fecha *', required: true },
                { field: 'concepto', label: 'Columna de Concepto / Detalle *', required: true },
                { field: 'retiro', label: 'Columna de Retiros / Cargos / Egresos', required: false },
                { field: 'deposito', label: 'Columna de Depósitos / Abonos / Ingresos', required: false },
                { field: 'referencia', label: 'Columna de Referencia / Folio', required: false }
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{label}</label>
                  <select
                    value={(columnMapping as any)[field]}
                    onChange={(e) => setColumnMapping(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">-- No asociar / Vacío --</option>
                    {excelHeaders.map(header => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setShowMappingModal(false);
                  setExcelFile(null);
                  setSustituirCarga(null);
                }}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!columnMapping.fecha || !columnMapping.concepto || !selectedCuentaId || isUploading}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 dark:disabled:bg-gray-850 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
              >
                {isUploading ? <RefreshCw size={14} className="animate-spin" /> : null}
                Confirmar e Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN DE MOVIMIENTO BANCARIO */}
      {editingMovimiento && (
        <EditMovimientoModal
          movimiento={editingMovimiento}
          token={editMovimientoToken}
          onClose={() => setEditingMovimiento(null)}
          onSuccess={() => { setEditingMovimiento(null); fetchData(); }}
        />
      )}

      {/* MODAL DE ASIGNACIÓN DE XML A PEDIDOS */}
      {showAsignacionXmlModal && (
        <AsignacionXmlModal
          isOpen={showAsignacionXmlModal}
          initialMonth={selectedMonth}
          onClose={() => setShowAsignacionXmlModal(false)}
          onSuccess={() => {
            setShowAsignacionXmlModal(false);
            fetchData();
          }}
        />
      )}
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
