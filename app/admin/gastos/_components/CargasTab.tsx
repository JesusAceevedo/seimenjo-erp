'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Trash2, 
  RefreshCw, 
  Eye, 
  Calendar, 
  Building2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  FileText, 
  Search,
  UploadCloud,
  Check,
  Download,
  Tag
} from 'lucide-react';
import { 
  obtenerCargasEstadosCuenta, 
  obtenerMovimientosPorCarga, 
  eliminarCargaEstadoCuenta,
  importarMovimientosBancarios
} from '../reconciliationActions';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { supabase } from '../../../../lib/supabase';
import { 
  descargarPlantillaEstadoCuenta, 
  CATEGORIAS_DEFAULT, 
  CategoriaCatalogo 
} from '../templateUtils';

interface CargasTabProps {
  token?: string;
  selectedMonth?: string;
  cuentasBancarias?: Array<{ id: string; nombre: string; numero_cuenta?: string }>;
  onStartSustituirCarga?: (carga: any) => void;
  onReloadMovimientos?: () => void;
  onOpenUploadModal?: () => void;
}

export function CargasTab({
  token,
  selectedMonth,
  cuentasBancarias = [],
  onReloadMovimientos
}: CargasTabProps) {
  const getSessionToken = useSessionToken();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cargas, setCargas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoriasMovimiento, setCategoriasMovimiento] = useState<CategoriaCatalogo[]>(CATEGORIAS_DEFAULT);
  
  // Estado para el modal de detalle de movimientos
  const [selectedCargaDetail, setSelectedCargaDetail] = useState<any | null>(null);
  const [cargaMovimientos, setCargaMovimientos] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Estado para modal de confirmación de eliminación
  const [cargaToDelete, setCargaToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estados para Carga de Archivo Excel y Mapeo
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [cargaIdToReplace, setCargaIdToReplace] = useState<string | null>(null);
  const [replaceTargetName, setReplaceTargetName] = useState<string | null>(null);
  const [selectedCuentaDestino, setSelectedCuentaDestino] = useState<string>('');
  const [selectedDefaultCategoria, setSelectedDefaultCategoria] = useState<string>('');
  const [acumularComisiones, setAcumularComisiones] = useState<boolean>(true);
  
  // Periodo asignado para la carga (por defecto el periodo activo o mes actual)
  const [periodoAsignado, setPeriodoAsignado] = useState<string>(() => {
    return selectedMonth || new Date().toISOString().substring(0, 7);
  });

  const formatDateSafe = (dateStr?: string | null) => {
    if (!dateStr) return 'S/F';
    const clean = String(dateStr).split('T')[0].trim();
    const parts = clean.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }
    return clean;
  };

  const formatCargaFecha = (carga: any) => {
    if (!carga) return 'S/F';
    // Si en notas viene el rango o fecha exacta de documento (ej: "Fecha del documento: 2026-08-11 al 2026-08-26 | Período: 2026-08")
    if (carga.notas) {
      const matchRango = carga.notas.match(/Fecha del documento:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*al\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
      if (matchRango) {
        const f1 = formatDateSafe(matchRango[1]);
        const f2 = formatDateSafe(matchRango[2]);
        return `${f1} al ${f2}`;
      }
      const matchSimple = carga.notas.match(/Fecha del documento:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
      if (matchSimple) {
        return formatDateSafe(matchSimple[1]);
      }
    }

    if (carga.fecha_carga) {
      return formatDateSafe(carga.fecha_carga);
    }

    if (carga.creado_en) {
      return formatDateSafe(carga.creado_en);
    }

    return 'S/F';
  };

  useEffect(() => {
    if (selectedMonth) {
      setPeriodoAsignado(selectedMonth);
    }
  }, [selectedMonth]);

  // Cargar catálogo de categorías
  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const { data } = await supabase
          .from('categorias_movimiento_bancario')
          .select('id, clave, nombre, descripcion, requiere_comprobante')
          .order('nombre');
        if (data && data.length > 0) {
          setCategoriasMovimiento(data);
        }
      } catch (err) {
        console.error('Error al cargar categorías de movimiento:', err);
      }
    };
    fetchCategorias();
  }, []);

  const [columnMapping, setColumnMapping] = useState<{
    fecha: string;
    concepto: string;
    retiro: string;
    deposito: string;
    referencia: string;
    categoria: string;
  }>({
    fecha: '',
    concepto: '',
    retiro: '',
    deposito: '',
    referencia: '',
    categoria: ''
  });

  const fetchCargas = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const activeToken = token || await getSessionToken();
      const res = await obtenerCargasEstadosCuenta(activeToken);
      if (res.success && res.data) {
        setCargas(res.data);
      } else {
        setErrorMessage(res.error || 'Error al obtener el historial de cargas.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCargas();
  }, [token]);

  // Manejo de subida y lectura del archivo Excel/CSV
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    setErrorMessage(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true, dateNF: 'yyyy-mm-dd' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' }) as any[];
        
        if (rawData.length === 0) {
          alert('El archivo seleccionado está vacío.');
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

        const headers = (rawData[headerIndex] || []).map((h: any, idx: number) => {
          const str = String(h || '').trim();
          return str || `Columna_${idx + 1}`;
        });
        const rows = rawData.slice(headerIndex + 1).filter((row: any) => row && row.length > 0);

        setExcelHeaders(headers);

        const objectsData = rows.map((row: any) => {
          const obj: any = { _rawRow: row };
          headers.forEach((h: string, idx: number) => {
            obj[h] = row[idx];
          });
          return obj;
        });

        setExcelData(objectsData);

        // Auto-detect columns mapping
        const mapping = { fecha: '', concepto: '', retiro: '', deposito: '', referencia: '', categoria: '' };
        headers.forEach((h: string) => {
          const hl = h.toLowerCase().trim();
          if (!mapping.fecha && (
            hl.includes('fecha') || hl.includes('date') || hl.includes('d/m') || hl.includes('d-m') || 
            hl.startsWith('f.') || hl.startsWith('f_') || hl === 'd' || hl.includes('día') || hl.includes('dia') ||
            hl.includes('día') || hl.includes('operacion') || hl.includes('valor')
          )) {
            mapping.fecha = h;
          } else if (!mapping.concepto && (hl.includes('concepto') || hl.includes('descrip') || hl.includes('detalle') || hl.includes('leyenda') || hl.includes('movimiento'))) {
            mapping.concepto = h;
          } else if (!mapping.retiro && (hl.includes('retiro') || hl.includes('cargo') || hl.includes('egreso') || hl.includes('salida') || hl.includes('debito'))) {
            mapping.retiro = h;
          } else if (!mapping.deposito && (hl.includes('deposito') || hl.includes('abono') || hl.includes('ingreso') || hl.includes('entrada') || hl.includes('credito'))) {
            mapping.deposito = h;
          } else if (!mapping.referencia && (hl.includes('ref') || hl.includes('nota') || hl.includes('folio') || hl.includes('consecutivo') || hl.includes('id'))) {
            mapping.referencia = h;
          } else if (!mapping.categoria && (hl.includes('categ') || hl.includes('clasif') || hl.includes('rubro') || hl.includes('tipo mov') || hl.includes('category'))) {
            mapping.categoria = h;
          }
        });

        // Inspeccionar primera fila de datos si la fecha no se detectó por encabezado
        if (!mapping.fecha && objectsData.length > 0) {
          const firstRow = objectsData[0];
          for (const key of Object.keys(firstRow)) {
            if (key === '_rawRow') continue;
            const val = String(firstRow[key] || '').trim();
            if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(val) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(val) || /^\d{5}$/.test(val)) {
              mapping.fecha = key;
              break;
            }
          }
        }

        setColumnMapping(mapping);
        setShowMappingModal(true);
      } catch (err) {
        console.error('Error reading file:', err);
        alert('Error al leer el archivo. Asegúrate de subir un archivo Excel (.xlsx, .xls) o CSV válido.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleStartNuevaCarga = () => {
    setCargaIdToReplace(null);
    setReplaceTargetName(null);
    setSelectedCuentaDestino('');
    setPeriodoAsignado(selectedMonth || new Date().toISOString().substring(0, 7));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleStartSustituir = (carga: any) => {
    setCargaIdToReplace(carga.id);
    setReplaceTargetName(carga.nombre_archivo);
    setSelectedCuentaDestino(carga.cuenta_bancaria_id || '');
    if (carga.fecha_carga) {
      setPeriodoAsignado(carga.fecha_carga.substring(0, 7));
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleConfirmImport = async () => {
    if (!columnMapping.fecha || !columnMapping.concepto) {
      alert('Debes asignar al menos la Columna de Fecha y la Columna de Concepto.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setShowMappingModal(false);

    try {
      const fechaColIdx = excelHeaders.indexOf(columnMapping.fecha);

      const formatted = excelData.map(row => {
        let fechaRaw = row[columnMapping.fecha];

        if ((fechaRaw === undefined || fechaRaw === null || fechaRaw === '') && fechaColIdx >= 0 && row._rawRow) {
          fechaRaw = row._rawRow[fechaColIdx];
        }

        if ((fechaRaw === undefined || fechaRaw === null || fechaRaw === '') && row._rawRow) {
          const foundDateCell = row._rawRow.find((c: any) => {
            const str = String(c || '').trim();
            return /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(str) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(str) || /^\d{5}$/.test(str);
          });
          if (foundDateCell) {
            fechaRaw = foundDateCell;
          }
        }

        const catVal = columnMapping.categoria ? (row[columnMapping.categoria] ?? '') : '';

        return {
          fecha: String(fechaRaw || ''),
          concepto: String(row[columnMapping.concepto] || row._rawRow?.[1] || ''),
          retiro: row[columnMapping.retiro] !== undefined ? String(row[columnMapping.retiro]) : '0',
          deposito: row[columnMapping.deposito] !== undefined ? String(row[columnMapping.deposito]) : '0',
          referencia: columnMapping.referencia ? String(row[columnMapping.referencia] || '') : '',
          categoria: String(catVal || '').trim() || undefined
        };
      }).filter(m => m.concepto);

      if (formatted.length === 0) {
        throw new Error('No se encontraron filas con concepto válido en el archivo. Verifica el mapeo de la Columna de Concepto.');
      }

      const activeToken = token || await getSessionToken();
      const fileName = excelFile?.name || (cargaIdToReplace ? 'Carga_Sustituida.xlsx' : 'Estado_de_cuenta.xlsx');

      const res = await importarMovimientosBancarios(
        formatted,
        activeToken,
        selectedCuentaDestino || undefined,
        fileName,
        cargaIdToReplace || undefined,
        acumularComisiones,
        periodoAsignado || undefined,
        selectedDefaultCategoria || undefined
      );

      if (res.success) {
        if (res.count === 0) {
          const total = (res as any).totalLeidos || formatted.length;
          setErrorMessage(`⚠️ Se leyeron ${total} movimientos, pero no se importó ninguno porque TODOS ya existen previamente en la base de datos (duplicados detectados por referencia o fecha/concepto/monto). Si deseas sustituir o volver a cargar este archivo para actualizar sus categorías, usa la opción "Sustituir Carga" (icono 🔄) o elimina la carga previa.`);
        } else if ((res as any).duplicadosOmitidos && (res as any).duplicadosOmitidos > 0) {
          setSuccessMessage(`¡Éxito! Se importaron ${res.count} movimientos bancarios nuevos asignados al período ${periodoAsignado} (${(res as any).duplicadosOmitidos} registros ya existían y fueron omitidos para evitar duplicados).`);
        } else {
          setSuccessMessage(`¡Éxito! Se procesaron e importaron ${res.count} movimientos bancarios asignados al período ${periodoAsignado}.`);
        }
        await fetchCargas();
        onReloadMovimientos?.();
      } else {
        throw new Error(res.error || 'No se pudo completar la importación.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al procesar el archivo.');
    } finally {
      setIsUploading(false);
      setExcelFile(null);
      setCargaIdToReplace(null);
      setReplaceTargetName(null);
    }
  };

  const handleOpenDetail = async (carga: any) => {
    setSelectedCargaDetail(carga);
    setLoadingDetail(true);
    try {
      const activeToken = token || await getSessionToken();
      const res = await obtenerMovimientosPorCarga(carga.id, activeToken);
      if (res.success && res.data) {
        setCargaMovimientos(res.data);
      } else {
        setCargaMovimientos([]);
      }
    } catch (err) {
      console.error('Error fetching detail movements:', err);
      setCargaMovimientos([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteCarga = async () => {
    if (!cargaToDelete) return;
    setDeleting(true);
    try {
      const activeToken = token || await getSessionToken();
      const res = await eliminarCargaEstadoCuenta(cargaToDelete.id, activeToken);
      if (res.success) {
        setCargas(prev => prev.filter(c => c.id !== cargaToDelete.id));
        setCargaToDelete(null);
        setSuccessMessage('Carga de estado de cuenta y sus movimientos eliminados correctamente.');
        onReloadMovimientos?.();
      } else {
        alert(res.error || 'Error al eliminar la carga.');
      }
    } catch (err: any) {
      alert('Error al procesar eliminación: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredCargas = cargas.filter(c => {
    // Filtro por periodo (AAAA-MM) basado en la fecha de carga o periodo
    if (selectedMonth) {
      const fechaCargaStr = (c.fecha_carga || '').substring(0, 7);
      if (fechaCargaStr !== selectedMonth) return false;
    }

    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase().trim();
    const nombreMatch = (c.nombre_archivo || '').toLowerCase().includes(s);
    const cuentaMatch = (c.cuentas_bancarias?.nombre || '').toLowerCase().includes(s);
    const fechaMatch = (c.fecha_carga || '').includes(s);
    return nombreMatch || cuentaMatch || fechaMatch;
  });

  const totalRegistrosSum = filteredCargas.reduce((acc, curr) => acc + (curr.total_registros || 0), 0);
  const totalDepositosSum = filteredCargas.reduce((acc, curr) => acc + Number(curr.total_depositos || 0), 0);
  const totalRetirosSum = filteredCargas.reduce((acc, curr) => acc + Number(curr.total_retiros || 0), 0);

  return (
    <div className="space-y-6 font-sans pb-12 overflow-y-auto">
      {/* Input oculto para carga de archivos */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Mensajes de Feedback */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800">
            <X size={14} />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Tarjetas de Métricas de Cargas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Cargas Registradas</span>
            <FileSpreadsheet className="text-amber-500" size={18} />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {filteredCargas.length}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            {selectedMonth ? `Período: ${selectedMonth}` : 'Archivos procesados'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Movimientos Importados</span>
            <FileText className="text-blue-500" size={18} />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {totalRegistrosSum.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Registros bancarios activos</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Depósitos ($)</span>
            <ArrowDownLeft className="text-emerald-500" size={18} />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            ${totalDepositosSum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Sumatoria de abonos cargados</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Retiros ($)</span>
            <ArrowUpRight className="text-rose-500" size={18} />
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400">
            ${totalRetirosSum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Sumatoria de cargos cargados</p>
        </div>
      </div>

      {/* Acciones principales y Búsqueda */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por archivo, cuenta o fecha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pl-9 pr-4 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => descargarPlantillaEstadoCuenta(categoriasMovimiento)}
            title="Descargar plantilla de ejemplo con instrucciones y catálogo de categorías (.xlsx)"
            className="px-3.5 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-200 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download size={15} className="text-amber-500" />
            <span>Plantilla de Ejemplo (.xlsx)</span>
          </button>

          <button
            onClick={fetchCargas}
            title="Recargar historial"
            className="p-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-600 dark:text-gray-300"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleStartNuevaCarga}
            disabled={isUploading}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Procesando carga...
              </>
            ) : (
              <>
                <UploadCloud size={16} /> Nueva Carga de Estado de Cuenta
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabla de Historial de Cargas */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-800/60 uppercase font-bold text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-4">Archivo / Carga</th>
                <th className="p-4">Período / Fecha</th>
                <th className="p-4">Cuenta Destino</th>
                <th className="p-4 text-center">Registros</th>
                <th className="p-4 text-right">Depósitos ($)</th>
                <th className="p-4 text-right">Retiros ($)</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    <RefreshCw className="animate-spin inline-block mr-2" size={18} /> Cargando historial de cargas...
                  </td>
                </tr>
              ) : filteredCargas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <FileSpreadsheet size={32} className="mx-auto mb-2 opacity-40 text-amber-500" />
                    No se encontraron cargas de estado de cuenta {selectedMonth ? `para el período ${selectedMonth}` : 'registradas'}.
                  </td>
                </tr>
              ) : (
                filteredCargas.map((carga) => (
                  <tr key={carga.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-600 dark:text-amber-400">
                          <FileSpreadsheet size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white max-w-[240px] truncate" title={carga.nombre_archivo}>
                            {carga.nombre_archivo}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {carga.notas ? carga.notas : `ID: ${carga.id.substring(0, 8)}`}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                          <Calendar size={13} className="text-amber-500 shrink-0" />
                          <span>{formatCargaFecha(carga)}</span>
                        </div>
                        {carga.creado_en && (
                          <div className="text-[10px] text-gray-400 pl-4">
                            Cargado: {new Date(carga.creado_en).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        <Building2 size={12} className="text-gray-400" />
                        {carga.cuentas_bancarias?.nombre || 'General / Auto-enrutado'}
                      </span>
                    </td>

                    <td className="p-4 text-center whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                        {carga.total_registros || 0} movs.
                      </span>
                    </td>

                    <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      +${Number(carga.total_depositos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="p-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      -${Number(carga.total_retiros || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(carga)}
                          title="Ver detalle de movimientos"
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          onClick={() => handleStartSustituir(carga)}
                          title="Sustituir / Actualizar carga con un nuevo archivo"
                          className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400 transition-colors"
                        >
                          <RefreshCw size={15} />
                        </button>

                        <button
                          onClick={() => setCargaToDelete(carga)}
                          title="Eliminar esta carga y sus registros"
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg text-rose-600 dark:text-rose-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE MAPEO DE COLUMNAS Y ASIGNACIÓN DE PERÍODO */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-xl shadow-2xl text-gray-900 dark:text-gray-100 flex flex-col font-sans max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between mb-3 border-b border-gray-150 dark:border-gray-800 pb-3">
              <h3 className="text-base font-extrabold flex items-center gap-2 text-amber-500">
                <FileSpreadsheet size={20} />
                {cargaIdToReplace ? `Sustituir Carga: ${replaceTargetName}` : 'Configurar Nueva Carga de Estado de Cuenta'}
              </h3>
              <button
                onClick={() => {
                  setShowMappingModal(false);
                  setExcelFile(null);
                  setCargaIdToReplace(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Asigna el período contable, cuenta destino y verifica la correspondencia de columnas antes de procesar el archivo.
            </p>

            {/* Banner de descarga de plantilla con catálogo de categorías */}
            <div className="flex items-center justify-between p-3 mb-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-xl text-xs">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-[11px]">
                <FileSpreadsheet size={16} className="text-amber-500 shrink-0" />
                <span>¿Deseas verificar la estructura o nombres de categorías?</span>
              </div>
              <button
                type="button"
                onClick={() => descargarPlantillaEstadoCuenta(categoriasMovimiento)}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-sm transition-colors cursor-pointer shrink-0"
              >
                <Download size={13} /> Descargar Plantilla
              </button>
            </div>

            {/* Configuración de Período, Cuenta Destino y Categoría Predeterminada */}
            <div className="space-y-3 mb-4 p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-gray-700 dark:text-gray-200 uppercase mb-1">
                    📅 Período Asignado (Mes / Año)
                  </label>
                  <input
                    type="month"
                    value={periodoAsignado}
                    onChange={(e) => setPeriodoAsignado(e.target.value)}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Los movimientos se ligarán a este período.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-gray-700 dark:text-gray-200 uppercase mb-1">
                    🏦 Cuenta Bancaria Destino
                  </label>
                  <select
                    value={selectedCuentaDestino}
                    onChange={(e) => setSelectedCuentaDestino(e.target.value)}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Detección Automática (BBVA / Caja / Parrot) --</option>
                    {cuentasBancarias.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre} {cuenta.numero_cuenta ? `(${cuenta.numero_cuenta})` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Opcional: forzar todos los movimientos a esta cuenta.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-gray-700 dark:text-gray-200 uppercase mb-1 flex items-center gap-1.5">
                  <Tag size={13} className="text-amber-500" />
                  Categoría Predeterminada (Fallback / Opcional)
                </label>
                <select
                  value={selectedDefaultCategoria}
                  onChange={(e) => setSelectedDefaultCategoria(e.target.value)}
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Sin categoría fija (usar columna del Excel o dejar Sin Categoría) --</option>
                  {categoriasMovimiento.map((cat) => (
                    <option key={cat.id || cat.clave} value={cat.id || cat.clave}>
                      {cat.nombre} {cat.requiere_comprobante === false ? '(Exento de comprobante)' : '(Requiere CFDI)'}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Se asignará automáticamente a los movimientos que no tengan categoría especificada en el archivo Excel.
                </span>
              </div>
            </div>

            {/* Mapeo de Columnas */}
            <div className="space-y-3 mb-4">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                Mapeo de Columnas del Archivo ({excelHeaders.length} detectadas)
              </span>

              {[
                { field: 'fecha', label: 'Columna de Fecha (Obligatorio)', required: true },
                { field: 'concepto', label: 'Columna de Concepto / Detalle (Obligatorio)', required: true },
                { field: 'retiro', label: 'Columna de Retiros / Cargos / Egresos', required: false },
                { field: 'deposito', label: 'Columna de Depósitos / Abonos / Ingresos', required: false },
                { field: 'referencia', label: 'Columna de Referencia / ID de Transacción', required: false },
                { field: 'categoria', label: 'Columna de Categoría / Clasificación (Opcional)', required: false }
              ].map(({ field, label }) => {
                const selectedHeader = (columnMapping as any)[field];
                const sampleVals = selectedHeader 
                  ? excelData.slice(0, 2).map(r => String(r[selectedHeader] ?? '')).filter(Boolean).join(', ')
                  : '';
                return (
                  <div key={field}>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{label}</label>
                    <select
                      value={selectedHeader}
                      onChange={(e) => setColumnMapping(prev => ({ ...prev, [field]: e.target.value }))}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">-- No asociar / Vacío --</option>
                      {excelHeaders.map(header => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                    {sampleVals && (
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate" title={`Valores de muestra: ${sampleVals}`}>
                        Muestra: <span className="text-gray-600 dark:text-gray-300 font-semibold">{sampleVals}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Opción para clasificar comisiones */}
            <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={acumularComisiones}
                  onChange={(e) => setAcumularComisiones(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4"
                />
                <span>Identificar automáticamente comisiones bancarias y TPV (incluyendo COM IVA) como registros separados No Facturables</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowMappingModal(false);
                  setExcelFile(null);
                  setCargaIdToReplace(null);
                }}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={!columnMapping.fecha || !columnMapping.concepto || isUploading}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 dark:disabled:bg-gray-850 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} /> Importando...
                  </>
                ) : (
                  <>
                    <Check size={16} /> Confirmar e Importar Carga
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLE DE MOVIMIENTOS */}
      {selectedCargaDetail && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-150 font-sans">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="text-amber-500" size={18} />
                  Detalle de Carga: {selectedCargaDetail.nombre_archivo}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {(() => {
                    const docFechas = cargaMovimientos.map(m => m.fecha).filter(Boolean).sort();
                    const minF = docFechas[0];
                    const maxF = docFechas[docFechas.length - 1];
                    const label = minF ? (minF === maxF ? formatDateSafe(minF) : `${formatDateSafe(minF)} al ${formatDateSafe(maxF)}`) : formatCargaFecha(selectedCargaDetail);
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                        <Calendar size={12} /> Fecha del Documento: {label}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    • Cargado el {selectedCargaDetail.creado_en ? new Date(selectedCargaDetail.creado_en).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : formatCargaFecha(selectedCargaDetail)} • {cargaMovimientos.length} movimientos
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCargaDetail(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {loadingDetail ? (
                <div className="py-12 text-center text-gray-400">
                  <RefreshCw className="animate-spin inline mr-2" size={18} /> Cargando detalle...
                </div>
              ) : cargaMovimientos.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No se encontraron movimientos activos para esta carga.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-800/80 uppercase font-bold text-[10px] text-gray-500">
                      <tr>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Concepto</th>
                        <th className="p-3">Referencia</th>
                        <th className="p-3 text-right">Monto ($)</th>
                        <th className="p-3">Estatus Conciliación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {cargaMovimientos.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="p-3 whitespace-nowrap text-gray-700 dark:text-gray-300 font-mono">
                            {formatDateSafe(m.fecha)}
                          </td>
                          <td className="p-3 font-medium text-gray-900 dark:text-white max-w-xs truncate" title={m.concepto}>
                            {m.concepto}
                          </td>
                          <td className="p-3 font-mono text-gray-500">
                            {m.referencia || '-'}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                            m.tipo_movimiento === 'Deposito' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {m.tipo_movimiento === 'Deposito' ? '+' : '-'}${Math.abs(Number(m.monto)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span 
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ 
                                backgroundColor: (m.estatus_conciliacion_bancaria?.color || '#9CA3AF') + '22',
                                color: m.estatus_conciliacion_bancaria?.color || '#9CA3AF'
                              }}
                            >
                              {m.estatus_conciliacion_bancaria?.nombre || 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-end">
              <button
                onClick={() => setSelectedCargaDetail(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE CARGA */}
      {cargaToDelete && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-150 font-sans">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-gray-900 dark:text-gray-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-base font-extrabold text-gray-900 dark:text-white mb-2">
              ¿Eliminar Carga de Estado de Cuenta?
            </h3>

            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
              Estás a punto de eliminar la carga <strong className="text-amber-500">{cargaToDelete.nombre_archivo}</strong>. Esta acción eliminará los <strong>{cargaToDelete.total_registros} movimientos bancarios</strong> asociados a esta carga.
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 mb-6">
              ⚠️ Si algún movimiento de esta carga se encuentra conciliado con un gasto o pedido, la conciliación se liberará automáticamente.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCargaToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeleteCarga}
                disabled={deleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} /> Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Confirmar Eliminación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CargasTab;

