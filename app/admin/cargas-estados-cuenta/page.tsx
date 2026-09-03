'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../lib/hooks/useSessionToken';
import { CargasTab } from '../gastos/_components/CargasTab';
import PeriodSelector from '../_components/PeriodSelector';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import { FileSpreadsheet, RefreshCw, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function CargasEstadosCuentaPage() {
  const router = useRouter();
  const { isDarkMode } = useThemeMode();
  const getEmpresaId = useEmpresaId();
  const getSessionToken = useSessionToken();
  const { selectedMonth, refreshPeriodStatus } = usePeriod();

  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [loadingCuentas, setLoadingCuentas] = useState(true);

  const fetchCuentas = async () => {
    setLoadingCuentas(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      const { data: cbData } = await supabase
        .from('cuentas_bancarias')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre', { ascending: true });

      setCuentasBancarias(cbData || []);
    } catch (err) {
      console.error('Error al cargar cuentas bancarias:', err);
    } finally {
      setLoadingCuentas(false);
    }
  };

  useEffect(() => {
    fetchCuentas();
  }, []);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-full overflow-hidden flex flex-col font-sans`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex overflow-hidden">
        
        {/* MAIN BODY */}
        <main className="flex-1 flex flex-col p-8 w-full min-w-0 mx-auto overflow-y-auto h-full">
          
          {/* HEADER */}
          <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
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
                  <FileSpreadsheet className="text-amber-500 w-8 h-8" /> Cargas de Estados de Cuenta
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
                Historial centralizado de archivos bancarios (Excel / CSV) procesados, asignación de períodos e importaciones masivas.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
              <button
                onClick={fetchCuentas}
                className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-amber-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
                title="Refrescar datos"
              >
                <RefreshCw size={18} className={loadingCuentas ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* CONTENEDOR DE TABLA DE CARGAS */}
          <div className="flex-1 min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-6">
            <CargasTab
              selectedMonth={selectedMonth}
              cuentasBancarias={cuentasBancarias}
              onReloadMovimientos={fetchCuentas}
            />
          </div>

        </main>
      </div>
    </div>
  );
}
