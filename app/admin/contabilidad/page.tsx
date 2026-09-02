'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import { formatCurrency } from '../../../lib/formatters';

// Tabs Components
import CatalogTab from './_components/CatalogTab';
import PolizasTab from './_components/PolizasTab';
import ReportesTab from './_components/ReportesTab';
import ReglasConciliacionTab from './_components/ReglasConciliacionTab';
import PeriodSelector from '../_components/PeriodSelector';

// Icons
import {
  TrendingUp, TrendingDown, Scale, RefreshCw,
  Receipt, BookOpen, BarChart3, SlidersHorizontal, Folder
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ContabilidadDashboard() {
  const router = useRouter();
  const { isDarkMode } = useThemeMode();
  const getEmpresaId = useEmpresaId();
  const { selectedMonth, periodStatus, refreshPeriodStatus } = usePeriod();

  const [activeTab, setActiveTab] = useState<'polizas' | 'reglas' | 'catalogo' | 'reportes'>('polizas');

  // Loading & Message
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Totales del Periodo para KPIs
  const [totalGastos, setTotalGastos] = useState<number>(0);
  const [totalVentas, setTotalVentas] = useState<number>(0);

  // Auto-dismiss messages
  useEffect(() => {
    if (message && message.type !== 'info') {
      const timer = setTimeout(() => setMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Cargar totales del periodo
  const fetchData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      // 1. Gastos del periodo
      const { data: gData } = await supabase
        .from('gastos')
        .select('monto, fecha_gasto, gasto_padre_id')
        .eq('empresa_id', empresaId)
        .is('gasto_padre_id', null);

      const filteredG = (gData || []).filter(g => (g.fecha_gasto || '').substring(0, 7) === selectedMonth);
      const sumG = filteredG.reduce((acc, g) => acc + Number(g.monto || 0), 0);
      setTotalGastos(sumG);

      // 2. Ventas del periodo
      const { data: vData } = await supabase
        .from('pedidos')
        .select('precio_total, fecha_pedido, creado_en, estatus_pago')
        .eq('empresa_id', empresaId)
        .neq('estatus_pago', 'Cancelado');

      const filteredV = (vData || []).filter(v => {
        const d = v.fecha_pedido || v.creado_en || '';
        return d.substring(0, 7) === selectedMonth;
      });
      const sumV = filteredV.reduce((acc, v) => acc + Number(v.precio_total || 0), 0);
      setTotalVentas(sumV);

    } catch (err: any) {
      console.error('Error fetching accounting summary:', err);
      setMessage({ text: 'Error al cargar resumen: ' + (err.message || String(err)), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const balanceNeto = useMemo(() => {
    return totalVentas - totalGastos;
  }, [totalVentas, totalGastos]);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-full overflow-hidden flex flex-col font-sans`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex overflow-hidden">
        
        {/* MAIN BODY */}
        <main className="flex-1 flex flex-col p-8 w-full min-w-0 mx-auto overflow-hidden h-full compact-container">
          
          {/* HEADER */}
          <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0 compact-margin">
            <div>
              <h2 className="text-3xl font-extrabold flex items-center gap-3 compact-title">
                <Receipt className="text-blue-500 w-8 h-8" /> Módulo de Contabilidad y Pólizas
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
                Libro Mayor, Pólizas de Partida Doble CUC SAT, Reglas Automatizadas, Catálogo y Reportes Financieros.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
              <button
                onClick={fetchData}
                className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm cursor-pointer"
                title="Refrescar datos"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* DASHBOARD KPIS DEL PERIODO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 shrink-0 font-sans compact-kpi-grid">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <TrendingUp size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 font-semibold uppercase block">Ingresos Periodo</span>
                <span className="text-xl font-black text-emerald-600 truncate block">{formatCurrency(totalVentas)}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                <TrendingDown size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 font-semibold uppercase block">Egresos Periodo</span>
                <span className="text-xl font-black text-red-600 truncate block">{formatCurrency(totalGastos)}</span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4">
              <div className={`p-3 rounded-xl ${balanceNeto >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                <Scale size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 font-semibold uppercase block">Resultado Neto Contable</span>
                <span className={`text-2xl font-black truncate block ${balanceNeto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(balanceNeto)}
                </span>
              </div>
            </div>
          </div>

          {/* BARRA SUPERIOR CON SELECCIÓN DE PESTAÑAS */}
          <div className="flex border-b border-gray-200 dark:border-gray-850 mb-6 shrink-0 gap-2 overflow-x-auto items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('polizas')}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'polizas'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/5'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <BookOpen size={16} /> Pólizas CUC SAT
              </button>
              <button
                onClick={() => setActiveTab('reglas')}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'reglas'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/5'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <SlidersHorizontal size={16} /> Reglas Automatizadas
              </button>
              <button
                onClick={() => setActiveTab('catalogo')}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'catalogo'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/5'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Folder size={16} /> Catálogo de Cuentas
              </button>
              <button
                onClick={() => setActiveTab('reportes')}
                className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === 'reportes'
                    ? 'border-blue-500 text-blue-500 bg-blue-500/5'
                    : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 size={16} /> Reportes Financieros
              </button>
            </div>
          </div>

          {/* FEEDBACK DE ESTADO */}
          {message && (
            <div className={`p-4 rounded-xl border mb-6 flex items-start justify-between gap-3 animate-in fade-in duration-300 shrink-0 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' :
              message.type === 'error' ? 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30' :
              'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30'
            }`}>
              <span className="text-xs font-bold font-sans">{message.text}</span>
              <button onClick={() => setMessage(null)} className="text-xs font-bold hover:opacity-70 font-sans cursor-pointer">✕</button>
            </div>
          )}

          {/* CONTENIDOS ADAPTATIVOS */}
          <div className="flex-1 overflow-hidden flex flex-col relative min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl">
            
            {activeTab === 'polizas' && (
              <PolizasTab selectedMonth={selectedMonth} />
            )}

            {activeTab === 'reglas' && (
              <ReglasConciliacionTab selectedMonth={selectedMonth} />
            )}

            {activeTab === 'catalogo' && (
              <CatalogTab />
            )}

            {activeTab === 'reportes' && (
              <ReportesTab selectedMonth={selectedMonth} />
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
