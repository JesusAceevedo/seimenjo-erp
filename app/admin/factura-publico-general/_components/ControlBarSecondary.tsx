'use client';

import React from 'react';

interface ControlBarSecondaryProps {
  totalFacturaPublicoGeneral: number;
  efectivoPublicoGeneral: number;
  parrotPayPublicoGeneral: number;
  totalParrotPayParrot: number;
  totalTarjetasBbva: number;
  totalPropinasExcluidas: number;
  manualTercerosVal: number;
  currentMonthKey: string;
  setMontoManualTercero: (key: string, val: number) => void;
  formatCurrency: (val: number | string | null | undefined) => string;
}

export const ControlBarSecondary: React.FC<ControlBarSecondaryProps> = ({
  totalFacturaPublicoGeneral,
  efectivoPublicoGeneral,
  parrotPayPublicoGeneral,
  totalParrotPayParrot,
  totalTarjetasBbva,
  totalPropinasExcluidas,
  manualTercerosVal,
  currentMonthKey,
  setMontoManualTercero,
  formatCurrency,
}) => {
  return (
    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Sugerido a Facturar PG</span>
          <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalFacturaPublicoGeneral)}
          </span>
        </div>
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block" />
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Efectivo Parrot</span>
          <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
            {formatCurrency(efectivoPublicoGeneral)}
          </span>
        </div>
        {totalParrotPayParrot > 0 && (
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 block">ParrotPay</span>
            <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(parrotPayPublicoGeneral)}
            </span>
          </div>
        )}
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block" />
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Tarjetas BBVA (Informativo / No Facturable)</span>
          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(totalTarjetasBbva)}
          </span>
        </div>
        <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block" />
        <div>
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Propinas Excluidas (0% SAT)</span>
          <span className="font-mono text-gray-400 line-through">
            {formatCurrency(totalPropinasExcluidas)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-extrabold uppercase text-gray-500">Monto Manual a Restar ($):</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={manualTercerosVal || ''}
          onChange={(e) => setMontoManualTercero(currentMonthKey, Number(e.target.value))}
          placeholder="0.00"
          className="w-24 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-500"
        />
        {manualTercerosVal > 0 && (
          <button
            type="button"
            onClick={() => setMontoManualTercero(currentMonthKey, 0)}
            className="text-[10px] text-red-500 hover:underline font-bold cursor-pointer"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
};
