'use client';

import React from 'react';
import {
  Wallet,
  CreditCard,
  Building2,
  CalendarClock,
} from 'lucide-react';
import { ArqueoEfectivoSubTab } from '../subtabs/ArqueoEfectivoSubTab';
import { ComparativoTarjetasSubTab } from '../subtabs/ComparativoTarjetasSubTab';
import { ConciliacionBbvaSubTab } from '../subtabs/ConciliacionBbvaSubTab';
import { DesfaseMesSubTab } from '../subtabs/DesfaseMesSubTab';

interface ComparativosTabProps {
  subTabComparativo: 'efectivo' | 'tarjetas' | 'bbva_banco' | 'desfase_mes';
  setSubTabComparativo: (subTab: 'efectivo' | 'tarjetas' | 'bbva_banco' | 'desfase_mes') => void;
  selectedMonth: string;
  controlEfectivo: any;
  comparativoTarjetas: any;
  comparativoBbvaBanco: any;
  userCargasMes: any[];
  movimientosOtroMes: any[];
  ticketsOtroMes: any[];
  totalMontoExcluidoOtroMes: number;
  formatCurrency: (val: number | string | null | undefined) => string;
  formatPeriodoCarga: (c: any) => string;
  setAllExcludedMovements: (ids: string[], exclude: boolean) => void;
  toggleExcludeMovement: (id: string) => void;
  toggleExcludeComprobante: (id: string) => void;
  toggleProximoMesComp: (id: string, isCurrentlyProximo: boolean) => void;
  esMovimientoEfectivo: (concepto: string) => boolean;
}

export const ComparativosTab: React.FC<ComparativosTabProps> = ({
  subTabComparativo,
  setSubTabComparativo,
  selectedMonth,
  controlEfectivo,
  comparativoTarjetas,
  comparativoBbvaBanco,
  userCargasMes,
  movimientosOtroMes,
  ticketsOtroMes,
  totalMontoExcluidoOtroMes,
  formatCurrency,
  formatPeriodoCarga,
  setAllExcludedMovements,
  toggleExcludeMovement,
  toggleExcludeComprobante,
  toggleProximoMesComp,
  esMovimientoEfectivo,
}) => {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
      
      {/* SELECTOR DE SUBPESTAÑAS DE COMPARATIVO */}
      <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSubTabComparativo('efectivo')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTabComparativo === 'efectivo'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Wallet size={14} />
            <span>💵 Arqueo de Efectivo ({formatCurrency(controlEfectivo.faltaPorDepositar)} pendiente)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTabComparativo('tarjetas')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTabComparativo === 'tarjetas'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <CreditCard size={14} />
            <span>💳 Tarjetas (Parrot vs BBVA Oficial)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTabComparativo('bbva_banco')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTabComparativo === 'bbva_banco'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <Building2 size={14} />
            <span>🏦 Conciliación BBVA ({formatCurrency(comparativoBbvaBanco.totalDepositosBbvaTarjetas)} en Banco)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTabComparativo('desfase_mes')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              subTabComparativo === 'desfase_mes'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <CalendarClock size={14} />
            <span>📅 Movimientos de Otro Mes ({movimientosOtroMes.length})</span>
            {movimientosOtroMes.length > 0 && (
              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                subTabComparativo === 'desfase_mes'
                  ? 'bg-purple-800 text-purple-100'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-300'
              }`}>
                Desfase
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] text-gray-400 font-mono">
          Período: <strong className="text-gray-700 dark:text-gray-200">{selectedMonth || 'Todos los meses'}</strong>
        </div>
      </div>

      {/* VISTA SEGÚN SUBPESTAÑA SELECCIONADA */}
      {subTabComparativo === 'efectivo' ? (
        <ArqueoEfectivoSubTab
          controlEfectivo={controlEfectivo}
          formatCurrency={formatCurrency}
        />
      ) : subTabComparativo === 'tarjetas' ? (
        <ComparativoTarjetasSubTab
          comparativoTarjetas={comparativoTarjetas}
          formatCurrency={formatCurrency}
        />
      ) : subTabComparativo === 'bbva_banco' ? (
        <ConciliacionBbvaSubTab
          comparativoBbvaBanco={comparativoBbvaBanco}
          userCargasMes={userCargasMes}
          formatPeriodoCarga={formatPeriodoCarga}
          formatCurrency={formatCurrency}
          toggleProximoMesComp={toggleProximoMesComp}
          esMovimientoEfectivo={esMovimientoEfectivo}
        />
      ) : (
        <DesfaseMesSubTab
          movimientosOtroMes={movimientosOtroMes}
          ticketsOtroMes={ticketsOtroMes}
          comparativoBbvaBanco={comparativoBbvaBanco}
          totalMontoExcluidoOtroMes={totalMontoExcluidoOtroMes}
          setAllExcludedMovements={setAllExcludedMovements}
          toggleExcludeMovement={toggleExcludeMovement}
          toggleExcludeComprobante={toggleExcludeComprobante}
          toggleProximoMesComp={toggleProximoMesComp}
          formatCurrency={formatCurrency}
          esMovimientoEfectivo={esMovimientoEfectivo}
        />
      )}

    </div>
  );
};
