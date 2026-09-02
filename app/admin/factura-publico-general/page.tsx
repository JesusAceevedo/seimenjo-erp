'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import PeriodSelector from '../_components/PeriodSelector';
import {
  FileText,
  FileSpreadsheet,
  RefreshCw,
  ArrowLeft,
  Search,
  List,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Percent,
  Filter,
  Check,
  X
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function FacturaPublicoGeneralPage() {
  const router = useRouter();
  const { isDarkMode } = useThemeMode();
  const getEmpresaId = useEmpresaId();
  const { selectedMonth, refreshPeriodStatus } = usePeriod();

  const [loading, setLoading] = useState(true);
  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuentaId, setSelectedCuentaId] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'publico' | 'terceros'>('todos');

  // Facturados a terceros (Persistencia local)
  const [facturadosTerceros, setFacturadosTerceros] = useState<Record<string, boolean>>(() => {
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

  // Monto manual facturado a terceros por mes (Persistencia local)
  const [montoManualTercerosMap, setMontoManualTercerosMap] = useState<Record<string, number>>(() => {
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

  const toggleFacturadoTercero = (id: string) => {
    setFacturadosTerceros(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      if (typeof window !== 'undefined') {
        localStorage.setItem('facturados_terceros_tickets', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const setMontoManualTercero = (mesKey: string, monto: number) => {
    setMontoManualTercerosMap(prev => {
      const updated = { ...prev, [mesKey]: Math.max(0, monto) };
      if (typeof window !== 'undefined') {
        localStorage.setItem('monto_manual_terceros_mes', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const formatCurrency = (val: number | string | null | undefined) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(num);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) {
        setLoading(false);
        return;
      }

      // 1. Cargar Cuentas Bancarias
      const { data: cbData, error: cbErr } = await supabase
        .from('cuentas_bancarias')
        .select('*')
        .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
        .order('nombre', { ascending: true });

      if (cbErr) {
        console.warn('Error al cargar cuentas bancarias:', cbErr.message || cbErr);
      }
      setCuentasBancarias(cbData || []);

      // 2. Cargar Comprobantes / Tickets
      const { data: compData, error: compErr } = await supabase
        .from('comprobantes_deposito')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });

      if (compErr) throw compErr;
      setComprobantes(compData || []);
    } catch (err: any) {
      console.error('Error al cargar datos de factura público general:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // Filtrado de tickets por mes y criterios base
  const ticketsMes = useMemo(() => {
    return comprobantes.filter(c => {
      if (c.tipo === 'deposito_ventanilla') return false;
      if (c.descripcion && c.descripcion.includes('COMPROBANTE_EFECTIVO_')) return false;
      const mes = c.fecha ? c.fecha.substring(0, 7) : '';
      if (selectedMonth && mes !== selectedMonth) return false;
      if (selectedCuentaId && c.cuenta_bancaria_id && c.cuenta_bancaria_id !== selectedCuentaId) return false;
      return true;
    });
  }, [comprobantes, selectedMonth, selectedCuentaId]);

  // Cálculos de Facturación
  const {
    totalVentasBrutasBase,
    totalPropinasExcluidas,
    totalTercerosBase,
    totalEfectivoBase,
    totalBbvaBase,
    totalParrotBase,
    totalTercerosEfectivo,
    totalTercerosBbva,
    totalTercerosParrot,
    totalTercerosFinal,
    totalFacturaPublicoGeneral,
    efectivoPublicoGeneral,
    bbvaPublicoGeneral,
    parrotPublicoGeneral,
    manualTercerosVal,
    currentMonthKey
  } = useMemo(() => {
    let brutasBase = 0;
    let propinas = 0;
    let tercerosBase = 0;

    let efecBase = 0;
    let bbvaBase = 0;
    let parrotBase = 0;

    let tercerosEfec = 0;
    let tercerosBbva = 0;
    let tercerosParrot = 0;

    ticketsMes.forEach(c => {
      const isParrotTicket = (c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('PARROT')) || c.tipo === 'corte_parrot';

      const efec = Number(c.monto_efectivo || 0);
      const parrot = Number(c.monto_parrotpay || 0);
      const bbva = isParrotTicket ? 0 : (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0));
      const baseTotal = efec + bbva + parrot;

      const propinaTotal = Number(c.propina_efectivo || 0) + Number(c.propina_parrotpay || 0) +
                           (isParrotTicket ? 0 : (Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0)));

      brutasBase += baseTotal;
      propinas += propinaTotal;

      efecBase += efec;
      bbvaBase += bbva;
      parrotBase += parrot;

      if (facturadosTerceros[c.id]) {
        tercerosBase += baseTotal;
        tercerosEfec += efec;
        tercerosBbva += bbva;
        tercerosParrot += parrot;
      }
    });

    const monthKey = selectedMonth || 'GLOBAL';
    const manualVal = Number(montoManualTercerosMap[monthKey] || 0);

    const tercerosFinal = tercerosBase + manualVal;
    const facturaPublico = Math.max(0, brutasBase - tercerosFinal);
    const efecPublico = Math.max(0, efecBase - tercerosEfec);
    const bbvaPublico = Math.max(0, bbvaBase - tercerosBbva);
    const parrotPublico = Math.max(0, parrotBase - tercerosParrot);

    return {
      totalVentasBrutasBase: brutasBase,
      totalPropinasExcluidas: propinas,
      totalTercerosBase: tercerosBase,
      totalEfectivoBase: efecBase,
      totalBbvaBase: bbvaBase,
      totalParrotBase: parrotBase,
      totalTercerosEfectivo: tercerosEfec,
      totalTercerosBbva: tercerosBbva,
      totalTercerosParrot: tercerosParrot,
      totalTercerosFinal: tercerosFinal,
      totalFacturaPublicoGeneral: facturaPublico,
      efectivoPublicoGeneral: efecPublico,
      bbvaPublicoGeneral: bbvaPublico,
      parrotPublicoGeneral: parrotPublico,
      manualTercerosVal: manualVal,
      currentMonthKey: monthKey
    };
  }, [ticketsMes, cuentasBancarias, facturadosTerceros, montoManualTercerosMap, selectedMonth]);

  // Filtrado de tabla visible
  const displayedTickets = useMemo(() => {
    return ticketsMes.filter(c => {
      const isTercero = !!facturadosTerceros[c.id];
      if (filtroTipo === 'publico' && isTercero) return false;
      if (filtroTipo === 'terceros' && !isTercero) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (c.descripcion || '').toLowerCase().includes(q);
        const fechaMatch = (c.fecha || '').includes(q);
        const montoMatch = String(c.monto || '').includes(q);
        if (!descMatch && !fechaMatch && !montoMatch) return false;
      }

      return true;
    });
  }, [ticketsMes, facturadosTerceros, filtroTipo, searchQuery]);

  // Exportar Excel
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
        { 'Concepto': 'PROPINAS TOTALES (NO CONTABILIZADAS / 0% IMPUESTO)', 'Venta Bruta Base': 0, 'Facturado a Terceros': 0, 'Factura Público en General': totalPropinasExcluidas }
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
          'Facturado a Terceros (Individual)': isTercero ? 'SÍ (Facturado a Cliente)' : 'NO (Público General)',
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
      alert(`Error al exportar a Excel: ${err.message}`);
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-full overflow-hidden flex flex-col font-sans`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex overflow-hidden">
        
        {/* MAIN BODY */}
        <main className="flex-1 flex flex-col p-8 w-full min-w-0 mx-auto overflow-y-auto h-full space-y-6">
          
          {/* HEADER */}
          <div className="flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={() => router.push('/admin/contabilidad')}
                  className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                  title="Volver a Contabilidad y Bancos"
                >
                  <ArrowLeft size={16} />
                </button>
                <h2 className="text-3xl font-extrabold flex items-center gap-3">
                  <FileText className="text-emerald-500 w-8 h-8" /> Factura Público en General
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
                Cálculo y control de ventas mensuales para facturación global. Resta automáticamente propinas y tickets facturados a clientes.
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
              <button
                onClick={fetchData}
                className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-emerald-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
                title="Refrescar datos"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* TARJETAS RESUMEN DE FACTURACIÓN AL PÚBLICO EN GENERAL */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* KPI TOTAL A FACTURAR */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">Total a Facturar Público en General</span>
                <h3 className="text-3xl font-black font-mono mt-1">{formatCurrency(totalFacturaPublicoGeneral)}</h3>
                <p className="text-[10px] text-emerald-100 mt-1 font-sans">
                  Ventas netas sin propinas ni facturas individuales a clientes ({selectedMonth || 'Todos los períodos'}).
                </p>
              </div>
              <button
                type="button"
                onClick={exportFacturaPublicoExcel}
                className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow"
              >
                <FileSpreadsheet size={14} /> Exportar Reporte Excel
              </button>
            </div>

            {/* DESGLOSE POR MÉTODO DE PAGO */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">💳 Desglose Neto por Método</span>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-1.5">
                  <span className="text-gray-600 dark:text-gray-400 font-sans">💵 Efectivo:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(efectivoPublicoGeneral)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-1.5">
                  <span className="text-gray-600 dark:text-gray-400 font-sans">💳 Tarjetas BBVA:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(bbvaPublicoGeneral)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-1.5">
                  <span className="text-gray-600 dark:text-gray-400 font-sans">🦜 ParrotPay:</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(parrotPublicoGeneral)}</span>
                </div>
              </div>
            </div>

            {/* FACTURADO A TERCEROS */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-955 border border-purple-200 dark:border-purple-900/40 shadow-sm flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">👤 Facturado a Clientes Terceros</span>
                <h3 className="text-2xl font-extrabold font-mono text-purple-700 dark:text-purple-300 mt-0.5">{formatCurrency(totalTercerosFinal)}</h3>
                {totalTercerosBase > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5 font-sans">
                    Tickets marcados: {formatCurrency(totalTercerosBase)}
                  </p>
                )}
              </div>

              <div className="pt-2 border-t border-purple-100 dark:border-purple-900/30 space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-purple-700 dark:text-purple-300 flex items-center justify-between">
                  <span>✏️ Importe Manual a Restar ($):</span>
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
                  placeholder="Monto adicional a descontar..."
                  className="w-full bg-purple-50/80 dark:bg-purple-955/50 border border-purple-300 dark:border-purple-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-purple-900 dark:text-purple-100 outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                />
              </div>
            </div>

            {/* PROPINAS EXCLUIDAS */}
            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">🚫 Propinas (No Contabilizadas)</span>
                <h3 className="text-2xl font-extrabold font-mono text-gray-600 dark:text-gray-400 mt-1">{formatCurrency(totalPropinasExcluidas)}</h3>
                <p className="text-[10px] text-gray-400 mt-1 font-sans">Las propinas están 100% excluidas de la facturación fiscal.</p>
              </div>
              <span className="text-[9px] font-extrabold text-gray-400 uppercase bg-gray-200 dark:bg-gray-800 px-2.5 py-1 rounded-lg w-fit">
                0% Impuesto / Sin Facturar
              </span>
            </div>

          </div>

          {/* TABLA INTERACTIVA DE CONTROL DE TICKETS */}
          <div className="bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
            
            {/* BARRA DE HERRAMIENTAS Y FILTROS */}
            <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
              <div>
                <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <List size={16} className="text-emerald-500" /> Control de Facturación por Ticket ({displayedTickets.length} de {ticketsMes.length})
                </h4>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Marca la casilla "Factura de Terceros" en los tickets que ya fueron facturados a clientes particulares para restarlos de la factura global.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Selector de Cuentas */}
                <select
                  value={selectedCuentaId}
                  onChange={(e) => setSelectedCuentaId(e.target.value)}
                  className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-2.5 py-1 rounded-lg text-xs text-gray-900 dark:text-white font-sans font-semibold outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Todas las Cuentas</option>
                  {cuentasBancarias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                  ))}
                </select>

                {/* Filtro Tipo */}
                <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-900 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFiltroTipo('todos')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                      filtroTipo === 'todos'
                        ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Todos ({ticketsMes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroTipo('publico')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                      filtroTipo === 'publico'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Público General
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroTipo('terceros')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                      filtroTipo === 'terceros'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Facturados a Terceros
                  </button>
                </div>

                {/* Búsqueda */}
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar ticket..."
                    className="pl-8 pr-3 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                  />
                </div>
              </div>
            </div>

            {/* TABLA */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-955 z-10">
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
                  {displayedTickets.map(c => {
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
                  {displayedTickets.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                        {loading ? 'Cargando tickets...' : 'No se encontraron tickets para el período o filtros seleccionados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </main>
      </div>
    </div>
  );
}
