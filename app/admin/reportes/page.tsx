'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  FileBarChart,
  Download,
  Search,
  Calendar,
  Filter,
  RefreshCw,
  FileText,
  Landmark,
  Receipt,
  FileDown,
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Paperclip,
  X,
  FileCode,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSessionToken } from '../../../lib/hooks/useSessionToken';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import { useThemeMode } from '../../../lib/useThemeMode';
import PeriodSelector from '../_components/PeriodSelector';
import { obtenerMovimientosNoDeduciblesAtemporal } from '../gastos/reconciliationActions';

interface ReportRecord {
  id: string;
  fecha: string;
  modulo: 'contabilidad' | 'conciliacion' | 'expediente' | 'herramientas';
  moduloLabel: string;
  cuentaNombre: string;
  folio: string;
  concepto: string;
  contraparte: string;
  rfc: string;
  monto: number;
  tipo: 'ingreso' | 'egreso';
  estatusClave: 'conciliado' | 'pendiente' | 'atemporal' | 'comprobado' | 'cancelado';
  estatusNombre: string;
  xmlUrl?: string | null;
  pdfUrl?: string | null;
  ticketUrl?: string | null;
  soporteUrl?: string | null;
  rawItem?: any;
}

export default function ReportesOperacionPage() {
  const getSessionToken = useSessionToken();
  const getEmpresaId = useEmpresaId();
  const { isDarkMode } = useThemeMode();
  const { selectedMonth, refreshPeriodStatus } = usePeriod();

  // Estados principales
  const [loading, setLoading] = useState<boolean>(true);
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);

  // Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroModulo, setFiltroModulo] = useState<string>('todos');
  const [filtroEstatus, setFiltroEstatus] = useState<string>('todos');
  const [filtroCuenta, setFiltroCuenta] = useState<string>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('periodo_actual');
  const [filtroTipoOperacion, setFiltroTipoOperacion] = useState<'todos' | 'ingreso' | 'egreso'>('todos');

  // Sub-tab activa
  const [subTab, setSubTab] = useState<'general' | 'contabilidad' | 'conciliacion' | 'expediente' | 'herramientas'>('general');

  // Paginación
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(15);

  // Modal de Detalle
  const [selectedRecord, setSelectedRecord] = useState<ReportRecord | null>(null);

  // Helper de Formato de Moneda
  const formatCurrency = (val: number) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(num);
  };

  // Carga y consolidación de datos desde los módulos - FILTRADO ESTRICTO POR EMPRESA
  const fetchReportData = async () => {
    try {
      setLoading(true);
      const token = await getSessionToken();
      const activeEmpresaId = await getEmpresaId();

      if (!activeEmpresaId) {
        setLoading(false);
        return;
      }

      // 1. Cuentas Bancarias (Empresa actual)
      const { data: cBancarias } = await supabase
        .from('cuentas_bancarias')
        .select('*')
        .eq('empresa_id', activeEmpresaId)
        .order('nombre', { ascending: true });
      setCuentasBancarias(cBancarias || []);

      const cuentasMap = new Map((cBancarias || []).map((c: any) => [c.id, c.nombre]));

      // 2. Movimientos Bancarios (Conciliación Bancaria) - FILTRADO POR EMPRESA
      const { data: movsBancarios } = await supabase
        .from('movimientos_bancarios')
        .select(`
          *,
          estatus_conciliacion_bancaria(clave, nombre, color),
          categorias_movimiento_bancario(nombre)
        `)
        .eq('empresa_id', activeEmpresaId)
        .order('fecha', { ascending: false });

      // 3. Gastos (Contabilidad & Egresos) - FILTRADO POR EMPRESA
      const { data: gastosData } = await supabase
        .from('gastos')
        .select('*, proveedores(razon_social, rfc), categorias_gastos(nombre)')
        .eq('empresa_id', activeEmpresaId)
        .order('fecha', { ascending: false });

      // 4. Facturas de Clientes (Expediente SAT) - FILTRADO POR EMPRESA
      const { data: facturasClientes } = await supabase
        .from('facturas_clientes')
        .select('*, clientes(nombre_local, rfc)')
        .eq('empresa_id', activeEmpresaId)
        .order('fecha_emision', { ascending: false });

      // 5. Atemporales (Empresa actual)
      const atemporalRes = await obtenerMovimientosNoDeduciblesAtemporal(token);
      const atemporales = atemporalRes.success
        ? (atemporalRes.data || []).filter((a: any) => !a.empresa_id || a.empresa_id === activeEmpresaId)
        : [];

      const consolidated: ReportRecord[] = [];

      // A) Procesar Movimientos Bancarios
      (movsBancarios || []).forEach((m: any) => {
        const isIngreso = Number(m.deposito || 0) > 0 || (Number(m.monto || 0) > 0 && !m.retiro);
        const montoAbs = Math.abs(Number(m.monto || m.deposito || m.retiro || 0));
        const estatusKey = m.estatus_conciliacion_bancaria?.clave || (m.conciliado ? 'conciliado' : 'pendiente');

        consolidated.push({
          id: `mov-${m.id}`,
          fecha: m.fecha ? m.fecha.substring(0, 10) : '',
          modulo: 'conciliacion',
          moduloLabel: 'Conciliación Bancaria',
          cuentaNombre: cuentasMap.get(m.cuenta_bancaria_id) || 'Cuenta General',
          folio: m.referencia || m.secuencia || `MOV-${m.id.substring(0, 6)}`,
          concepto: m.concepto || 'Movimiento Bancario',
          contraparte: m.beneficiario_remitente || m.rfc_tercero || 'Tercero General',
          rfc: m.rfc_tercero || '—',
          monto: isIngreso ? montoAbs : -montoAbs,
          tipo: isIngreso ? 'ingreso' : 'egreso',
          estatusClave: estatusKey === 'conciliado' ? 'conciliado' : estatusKey === 'atemporal' ? 'atemporal' : 'pendiente',
          estatusNombre: m.estatus_conciliacion_bancaria?.nombre || (m.conciliado ? 'Conciliado' : 'Pendiente'),
          xmlUrl: m.xml_url || null,
          pdfUrl: m.pdf_factura_url || null,
          ticketUrl: m.pdf_ticket_url || null,
          soporteUrl: m.soporte_reembolso_url || null,
          rawItem: m,
        });
      });

      // B) Procesar Gastos (Contabilidad)
      (gastosData || []).forEach((g: any) => {
        const montoAbs = Math.abs(Number(g.monto_total || g.monto || 0));
        consolidated.push({
          id: `gasto-${g.id}`,
          fecha: g.fecha ? g.fecha.substring(0, 10) : '',
          modulo: 'contabilidad',
          moduloLabel: 'Contabilidad & Gastos',
          cuentaNombre: 'Registro Contable',
          folio: g.folio_factura || g.uuid_sat || `GSTO-${g.id.substring(0, 6)}`,
          concepto: g.concepto || g.descripcion || 'Gasto Operativo',
          contraparte: g.proveedores?.razon_social || g.proveedor_nombre || 'Proveedor',
          rfc: g.proveedores?.rfc || g.rfc_emisor || '—',
          monto: -montoAbs,
          tipo: 'egreso',
          estatusClave: g.conciliado ? 'conciliado' : 'comprobado',
          estatusNombre: g.conciliado ? 'Conciliado' : 'Comprobado',
          xmlUrl: g.xml_url || null,
          pdfUrl: g.pdf_url || null,
          ticketUrl: g.ticket_url || null,
          soporteUrl: g.comprobante_url || null,
          rawItem: g,
        });
      });

      // C) Procesar Expediente (Facturas Clientes)
      (facturasClientes || []).forEach((f: any) => {
        const montoAbs = Math.abs(Number(f.total || f.monto || 0));
        consolidated.push({
          id: `factura-${f.id}`,
          fecha: f.fecha_emision ? f.fecha_emision.substring(0, 10) : (f.creado_en ? f.creado_en.substring(0, 10) : ''),
          modulo: 'expediente',
          moduloLabel: 'Expediente SAT/Facturas',
          cuentaNombre: 'Facturación Clientes',
          folio: f.folio || f.serie_folio || f.uuid || `FACT-${f.id.substring(0, 6)}`,
          concepto: f.concepto || `Factura de Venta ${f.folio || ''}`,
          contraparte: f.clientes?.nombre_local || f.receptor_nombre || 'Cliente',
          rfc: f.clientes?.rfc || f.receptor_rfc || '—',
          monto: montoAbs,
          tipo: 'ingreso',
          estatusClave: f.estatus === 'Cancelado' ? 'cancelado' : 'comprobado',
          estatusNombre: f.estatus || 'Emitida',
          xmlUrl: f.xml_url || null,
          pdfUrl: f.pdf_url || null,
          rawItem: f,
        });
      });

      // D) Procesar Atemporales (Herramientas & Ajustes)
      (atemporales || []).forEach((a: any) => {
        const isIngreso = Number(a.deposito || 0) > 0;
        const montoAbs = Math.abs(Number(a.monto || a.retiro || a.deposito || 0));
        consolidated.push({
          id: `atemporal-${a.id}`,
          fecha: a.fecha ? a.fecha.substring(0, 10) : '',
          modulo: 'herramientas',
          moduloLabel: 'Caja Chica & Herramientas',
          cuentaNombre: 'Registro Atemporal',
          folio: a.referencia || `ATEMP-${a.id.substring(0, 6)}`,
          concepto: a.concepto || 'Ajuste Atemporal',
          contraparte: a.rfc_tercero || 'Atemporal',
          rfc: a.rfc_tercero || '—',
          monto: isIngreso ? montoAbs : -montoAbs,
          tipo: isIngreso ? 'ingreso' : 'egreso',
          estatusClave: 'atemporal',
          estatusNombre: 'Atemporal / No Deducible',
          rawItem: a,
        });
      });

      // Ordenar por fecha descendente
      consolidated.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      setRecords(consolidated);
    } catch (err: any) {
      console.error('Error al cargar datos del reporte:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // Filtrado reactivo de registros por PERIODO ERP (Año-Mes)
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 1. SubTab / Módulo
      if (subTab !== 'general' && r.modulo !== subTab) return false;
      if (filtroModulo !== 'todos' && r.modulo !== filtroModulo) return false;

      // 2. Estatus
      if (filtroEstatus !== 'todos' && r.estatusClave !== filtroEstatus) return false;

      // 3. Cuenta
      if (filtroCuenta !== 'todos' && r.cuentaNombre !== filtroCuenta) return false;

      // 4. Filtro por PERIODO ERP (selectedMonth o filtroPeriodo)
      if (filtroPeriodo === 'periodo_actual') {
        const monthFromFecha = r.fecha ? r.fecha.substring(0, 7) : '';
        const mesConciliacion = r.rawItem?.mes_conciliacion || '';
        if (monthFromFecha !== selectedMonth && mesConciliacion !== selectedMonth) {
          return false;
        }
      } else if (filtroPeriodo !== 'todos') {
        const monthFromFecha = r.fecha ? r.fecha.substring(0, 7) : '';
        const mesConciliacion = r.rawItem?.mes_conciliacion || '';
        if (monthFromFecha !== filtroPeriodo && mesConciliacion !== filtroPeriodo) {
          return false;
        }
      }

      // 5. Tipo de Operación (Ventas / Ingresos vs Egresos / Gastos)
      if (filtroTipoOperacion !== 'todos' && r.tipo !== filtroTipoOperacion) {
        return false;
      }

      // 6. Búsqueda por Texto (Concepto, Folio, RFC, Contraparte)
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const matchConcepto = (r.concepto || '').toLowerCase().includes(q);
        const matchFolio = (r.folio || '').toLowerCase().includes(q);
        const matchRfc = (r.rfc || '').toLowerCase().includes(q);
        const matchContraparte = (r.contraparte || '').toLowerCase().includes(q);
        if (!matchConcepto && !matchFolio && !matchRfc && !matchContraparte) {
          return false;
        }
      }

      return true;
    });
  }, [records, subTab, filtroModulo, filtroEstatus, filtroCuenta, filtroPeriodo, filtroTipoOperacion, selectedMonth, busqueda]);

  // Cálculos estadísticos KPI
  const kpis = useMemo(() => {
    const total = filteredRecords.length;
    let ingresos = 0;
    let egresos = 0;
    let conciliadosCount = 0;
    let pendientesCount = 0;

    filteredRecords.forEach((r) => {
      if (r.tipo === 'ingreso') {
        ingresos += r.monto;
      } else {
        egresos += Math.abs(r.monto);
      }

      if (r.estatusClave === 'conciliado' || r.estatusClave === 'comprobado') {
        conciliadosCount++;
      } else {
        pendientesCount++;
      }
    });

    const saldoNeto = ingresos - egresos;
    const tasaConciliacion = total > 0 ? Math.round((conciliadosCount / total) * 100) : 0;

    return { total, ingresos, egresos, saldoNeto, conciliadosCount, pendientesCount, tasaConciliacion };
  }, [filteredRecords]);

  // Paginación
  const paginatedRecords = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));

  // Exportar a Excel
  const handleExportExcel = () => {
    try {
      const exportRows = filteredRecords.map((r) => ({
        Fecha: r.fecha,
        Módulo: r.moduloLabel,
        Origen: r.cuentaNombre,
        'Folio / UUID': r.folio,
        Concepto: r.concepto,
        'Cliente / Proveedor': r.contraparte,
        RFC: r.rfc,
        'Tipo Operación': r.tipo.toUpperCase(),
        Monto: r.monto,
        Estatus: r.estatusNombre,
        'Tiene XML': r.xmlUrl ? 'SÍ' : 'NO',
        'Tiene PDF': r.pdfUrl ? 'SÍ' : 'NO',
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);

      // Formatear anchos de columna
      ws['!cols'] = [
        { wch: 12 },
        { wch: 24 },
        { wch: 20 },
        { wch: 22 },
        { wch: 40 },
        { wch: 30 },
        { wch: 16 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
        { wch: 10 },
        { wch: 10 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Periodo_${selectedMonth}`);
      XLSX.writeFile(wb, `Reporte_Operacion_${selectedMonth}_${new Date().toISOString().substring(0, 10)}.xlsx`);
    } catch (err: any) {
      console.error('Error al exportar Excel:', err);
      alert(`Error al exportar Excel: ${err.message}`);
    }
  };

  return (
    <div className={`w-full h-full flex flex-col font-sans overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 ${isDarkMode ? 'dark' : ''}`}>
      {/* ENCABEZADO SUPERIOR CON SELECTOR DE PERIODO ERP */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 md:p-6 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl shadow-md shadow-amber-500/20">
            <FileBarChart size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Reportes de Operación Administrativa
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Análisis consolidado por Periodo ERP (Contabilidad, Conciliación, Expediente y Herramientas).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* SELECTOR DE PERIODO ERP */}
          <PeriodSelector onPeriodChange={() => { setCurrentPage(0); refreshPeriodStatus(); }} />

          <button
            type="button"
            onClick={fetchReportData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            title="Refrescar reporte"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refrescar</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download size={15} />
            <span>Exportar Excel Completo</span>
          </button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL SCROLLABLE */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {/* TARJETAS KPI DE RESUMEN (INTERACTIVAS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div
            onClick={() => { setFiltroTipoOperacion('todos'); setCurrentPage(0); }}
            className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] ${
              filtroTipoOperacion === 'todos'
                ? 'border-amber-500 ring-2 ring-amber-500/20'
                : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold">
              <span>Total Registros</span>
              <FileText size={16} className="text-amber-500" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
                {kpis.total.toLocaleString()}
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Click para ver todos</p>
            </div>
          </div>

          <div
            onClick={() => { setFiltroTipoOperacion('ingreso'); setCurrentPage(0); }}
            className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] ${
              filtroTipoOperacion === 'ingreso'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/5'
                : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <span>Ventas & Ingresos</span>
              <ArrowUpRight size={18} />
            </div>
            <div className="mt-2">
              <span className="text-xl md:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCurrency(kpis.ingresos)}
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Click para aislar Ventas</p>
            </div>
          </div>

          <div
            onClick={() => { setFiltroTipoOperacion('egreso'); setCurrentPage(0); }}
            className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 shadow-sm flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.01] ${
              filtroTipoOperacion === 'egreso'
                ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/5'
                : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-bold">
              <span>Egresos & Gastos</span>
              <ArrowDownRight size={18} />
            </div>
            <div className="mt-2">
              <span className="text-xl md:text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
                -{formatCurrency(kpis.egresos)}
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Click para aislar Egresos</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-bold">
              <span>Saldo Operativo Neto</span>
              <DollarSign size={16} className={kpis.saldoNeto >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
            </div>
            <div className="mt-2">
              <span className={`text-xl md:text-2xl font-black tracking-tight ${kpis.saldoNeto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCurrency(kpis.saldoNeto)}
              </span>
              <p className="text-[10px] text-gray-400 mt-0.5">Balance neto del periodo</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-bold">
              <span>Conciliados</span>
              <CheckCircle2 size={18} />
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tight text-blue-600 dark:text-blue-400">
                  {kpis.tasaConciliacion}%
                </span>
                <span className="text-xs font-bold text-gray-400">({kpis.conciliadosCount})</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{kpis.pendientesCount} registros pendientes</p>
            </div>
          </div>
        </div>

        {/* CONTROLES DE SUB-TAB Y FILTROS AVANZADOS */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm space-y-4">
          {/* BARRA DE NAVEGACIÓN SUB-TABS */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => { setSubTab('general'); setCurrentPage(0); }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                subTab === 'general'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <FileBarChart size={15} /> Vista General ({filteredRecords.length})
            </button>

            <button
              type="button"
              onClick={() => { setSubTab('contabilidad'); setCurrentPage(0); }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                subTab === 'contabilidad'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Receipt size={15} /> Contabilidad & Gastos
            </button>

            <button
              type="button"
              onClick={() => { setSubTab('conciliacion'); setCurrentPage(0); }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                subTab === 'conciliacion'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Landmark size={15} /> Conciliación Bancaria
            </button>

            <button
              type="button"
              onClick={() => { setSubTab('expediente'); setCurrentPage(0); }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                subTab === 'expediente'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <FileDown size={15} /> Expediente SAT
            </button>

            <button
              type="button"
              onClick={() => { setSubTab('herramientas'); setCurrentPage(0); }}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                subTab === 'herramientas'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Wrench size={15} /> Herramientas & Atemporal
            </button>
          </div>

          {/* FILTROS DE BÚSQUEDA, TIPO DE OPERACIÓN Y ALCANCE DE PERIODO */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Buscador */}
            <div className="md:col-span-4 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar concepto, folio, RFC, cliente..."
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setCurrentPage(0); }}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* Filtro Tipo de Operación (Ventas vs Egresos) */}
            <div className="md:col-span-3">
              <select
                value={filtroTipoOperacion}
                onChange={(e) => { setFiltroTipoOperacion(e.target.value as any); setCurrentPage(0); }}
                className="w-full p-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-extrabold text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="todos">Ver Ventas y Egresos (Todos)</option>
                <option value="ingreso">📈 Solo Ventas e Ingresos</option>
                <option value="egreso">📉 Solo Egresos y Gastos</option>
              </select>
            </div>

            {/* Alcance de Periodo */}
            <div className="md:col-span-2">
              <select
                value={filtroPeriodo}
                onChange={(e) => { setFiltroPeriodo(e.target.value); setCurrentPage(0); }}
                className="w-full p-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-extrabold text-amber-600 dark:text-amber-400 focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="periodo_actual">Periodo ({selectedMonth})</option>
                <option value="todos">Todos (Histórico)</option>
              </select>
            </div>

            {/* Filtro Estatus */}
            <div className="md:col-span-2">
              <select
                value={filtroEstatus}
                onChange={(e) => { setFiltroEstatus(e.target.value); setCurrentPage(0); }}
                className="w-full p-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="todos">Todos los Estatus</option>
                <option value="conciliado">Conciliados</option>
                <option value="comprobado">Comprobados</option>
                <option value="pendiente">Pendientes</option>
                <option value="atemporal">Atemporales</option>
              </select>
            </div>

            {/* Filtro Cuenta */}
            <div className="md:col-span-2">
              <select
                value={filtroCuenta}
                onChange={(e) => { setFiltroCuenta(e.target.value); setCurrentPage(0); }}
                className="w-full p-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="todos">Todas las Cuentas</option>
                {cuentasBancarias.map((c) => (
                  <option key={c.id} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* TABLA DETALLADA DE REGISTROS */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="bg-gray-100/80 dark:bg-gray-950/80 text-gray-500 dark:text-gray-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-gray-200 dark:border-gray-800 select-none">
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5">Módulo / Origen</th>
                  <th className="p-3.5">Folio / UUID</th>
                  <th className="p-3.5">Concepto & Detalle</th>
                  <th className="p-3.5">Contraparte / RFC</th>
                  <th className="p-3.5 text-right">Monto</th>
                  <th className="p-3.5 text-center">Estatus</th>
                  <th className="p-3.5 text-center">Adjuntos</th>
                  <th className="p-3.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-gray-400 font-medium">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw size={24} className="animate-spin text-amber-500" />
                        <span>Consolidando y analizando registros detallados...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-gray-400 font-medium">
                      No se encontraron registros en la empresa actual que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  paginatedRecords.map((r) => {
                    const isIngreso = r.tipo === 'ingreso';

                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-amber-500/5 transition-colors group"
                      >
                        {/* Fecha */}
                        <td className="p-3.5 font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300">
                          {r.fecha || '—'}
                        </td>

                        {/* Módulo / Origen */}
                        <td className="p-3.5">
                          <span className="font-extrabold block text-gray-900 dark:text-white">
                            {r.moduloLabel}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {r.cuentaNombre}
                          </span>
                        </td>

                        {/* Folio / UUID */}
                        <td className="p-3.5 font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400 max-w-[140px] truncate" title={r.folio}>
                          {r.folio}
                        </td>

                        {/* Concepto */}
                        <td className="p-3.5 max-w-[260px]">
                          <span className="font-extrabold text-gray-900 dark:text-gray-100 line-clamp-2" title={r.concepto}>
                            {r.concepto}
                          </span>
                        </td>

                        {/* Contraparte / RFC */}
                        <td className="p-3.5 max-w-[180px]">
                          <span className="font-bold text-gray-800 dark:text-gray-200 block truncate" title={r.contraparte}>
                            {r.contraparte}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400 block">
                            {r.rfc}
                          </span>
                        </td>

                        {/* Monto */}
                        <td className={`p-3.5 text-right font-mono font-black text-sm ${
                          isIngreso ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {isIngreso ? '+' : ''}{formatCurrency(r.monto)}
                        </td>

                        {/* Estatus */}
                        <td className="p-3.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            r.estatusClave === 'conciliado' || r.estatusClave === 'comprobado'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : r.estatusClave === 'atemporal'
                              ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                              : r.estatusClave === 'cancelado'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          }`}>
                            {r.estatusNombre}
                          </span>
                        </td>

                        {/* Adjuntos */}
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {r.xmlUrl && (
                              <a href={r.xmlUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded" title="Ver XML SAT">
                                <FileCode size={14} />
                              </a>
                            )}
                            {r.pdfUrl && (
                              <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded" title="Ver PDF Factura">
                                <FileText size={14} />
                              </a>
                            )}
                            {r.ticketUrl && (
                              <a href={r.ticketUrl} target="_blank" rel="noopener noreferrer" className="p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded" title="Ver Ticket">
                                <Paperclip size={14} />
                              </a>
                            )}
                            {!r.xmlUrl && !r.pdfUrl && !r.ticketUrl && (
                              <span className="text-[10px] text-gray-400 italic">—</span>
                            )}
                          </div>
                        </td>

                        {/* Acción */}
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedRecord(r)}
                            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 dark:hover:text-white transition-all cursor-pointer"
                            title="Ver Detalle del Registro"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* CONTROLES DE PAGINACIÓN */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">
              Mostrando {filteredRecords.length === 0 ? 0 : currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredRecords.length)} de {filteredRecords.length} registros
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(currentPage - 1)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <span className="px-2 font-mono font-bold text-gray-700 dark:text-gray-300">
                Pág. {currentPage + 1} de {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL SLIDE-OVER DE DETALLE DEL REGISTRO */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end transition-opacity">
          <div className="w-full max-w-xl bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col overflow-hidden border-l border-gray-200 dark:border-gray-800 font-sans">
            {/* Header Modal */}
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-xl">
                  <FileBarChart size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    Detalle del Registro
                  </h3>
                  <p className="text-xs text-gray-400 font-mono">
                    ID: {selectedRecord.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Modal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Bloque Módulo & Estatus */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Módulo de Origen</span>
                  <span className="font-black text-sm text-gray-900 dark:text-white block mt-0.5">{selectedRecord.moduloLabel}</span>
                  <span className="text-xs text-gray-500 font-mono">{selectedRecord.cuentaNombre}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Estatus</span>
                  <span className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {selectedRecord.estatusNombre}
                  </span>
                </div>
              </div>

              {/* Bloque Importe */}
              <div className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl border border-amber-500/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-bold">Monto Registrado</span>
                  <p className={`text-2xl font-black font-mono mt-0.5 ${
                    selectedRecord.tipo === 'ingreso' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {selectedRecord.tipo === 'ingreso' ? '+' : ''}{formatCurrency(selectedRecord.monto)}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl text-xs font-black uppercase bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {selectedRecord.tipo}
                </span>
              </div>

              {/* Campos Detallados */}
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-gray-400 font-bold uppercase text-[10px] block">Concepto</span>
                  <p className="font-bold text-gray-900 dark:text-gray-100 text-sm mt-0.5">{selectedRecord.concepto}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px] block">Fecha de Operación</span>
                    <p className="font-mono font-bold text-gray-800 dark:text-gray-200 mt-0.5">{selectedRecord.fecha || '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px] block">Folio / Referencia</span>
                    <p className="font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">{selectedRecord.folio}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px] block">Cliente / Proveedor</span>
                    <p className="font-bold text-gray-800 dark:text-gray-200 mt-0.5">{selectedRecord.contraparte}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 font-bold uppercase text-[10px] block">RFC</span>
                    <p className="font-mono font-bold text-gray-800 dark:text-gray-200 mt-0.5">{selectedRecord.rfc}</p>
                  </div>
                </div>
              </div>

              {/* Archivos Adjuntos */}
              <div>
                <span className="text-gray-400 font-bold uppercase text-[10px] block mb-2">Archivos y Documentos de Soporte</span>
                <div className="grid grid-cols-2 gap-2">
                  {selectedRecord.xmlUrl ? (
                    <a href={selectedRecord.xmlUrl} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2 hover:bg-emerald-500/20 transition-colors">
                      <FileCode size={16} /> Ver XML SAT
                    </a>
                  ) : (
                    <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 font-medium flex items-center gap-2 opacity-50">
                      <FileCode size={16} /> Sin XML
                    </div>
                  )}

                  {selectedRecord.pdfUrl ? (
                    <a href={selectedRecord.pdfUrl} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-2 hover:bg-rose-500/20 transition-colors">
                      <FileText size={16} /> Ver PDF Factura
                    </a>
                  ) : (
                    <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 font-medium flex items-center gap-2 opacity-50">
                      <FileText size={16} /> Sin PDF Factura
                    </div>
                  )}
                </div>
              </div>

              {/* Raw Objeto JSON de Inspección */}
              <div>
                <span className="text-gray-400 font-bold uppercase text-[10px] block mb-2">Trazabilidad Técnica (JSON Data)</span>
                <pre className="p-3 bg-gray-950 text-emerald-400 font-mono text-[10px] rounded-xl overflow-x-auto max-h-48">
                  {JSON.stringify(selectedRecord.rawItem || selectedRecord, null, 2)}
                </pre>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-5 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold rounded-xl transition-all cursor-pointer text-xs"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
