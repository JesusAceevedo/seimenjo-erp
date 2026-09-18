'use client';

import React from 'react';
import { Scale } from 'lucide-react';

interface ComparativoTarjetasSubTabProps {
  comparativoTarjetas: any;
  formatCurrency: (val: number | string | null | undefined) => string;
}

export const ComparativoTarjetasSubTab: React.FC<ComparativoTarjetasSubTabProps> = ({
  comparativoTarjetas,
  formatCurrency,
}) => {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      
      {/* BANNER INFORMATIVO */}
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 flex items-start gap-3">
        <Scale className="text-blue-500 w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <h5 className="text-xs font-black uppercase tracking-wide">
            Corte de BBVA: Fuente Oficial y Correcta para Tarjetas
          </h5>
          <p className="text-xs opacity-90 mt-0.5">
            El corte de la terminal BBVA es el número financiero correcto. Esta sección es estrictamente comparativa y <strong>NO se contabiliza</strong> para generar la Factura al Público en General.
          </p>
        </div>
      </div>

      {/* CARDS RESUMEN DE TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
          <span className="text-[10px] font-bold uppercase text-gray-400 block">Total Tarjetas Parrot (Sin Propina)</span>
          <h4 className="text-xl font-black font-mono text-gray-800 dark:text-gray-100 mt-1">
            {formatCurrency(comparativoTarjetas.totalTarjetasParrot)}
          </h4>
          <div className="mt-2 text-[10px] space-y-0.5 text-gray-500 font-mono">
            <div>Débito: {formatCurrency(comparativoTarjetas.parrotDebito)}</div>
            <div>Crédito: {formatCurrency(comparativoTarjetas.parrotCredito)}</div>
            <div>AMEX: {formatCurrency(comparativoTarjetas.parrotAmex)}</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
          <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 block">Corte BBVA Terminal (Oficial / Sin Propina)</span>
          <h4 className="text-xl font-black font-mono text-blue-700 dark:text-blue-300 mt-1">
            {formatCurrency(comparativoTarjetas.totalTarjetasBbva)}
          </h4>
          <div className="mt-2 text-[10px] space-y-0.5 text-blue-600 dark:text-blue-400 font-mono">
            <div>Débito: {formatCurrency(comparativoTarjetas.bbvaDebito)}</div>
            <div>Crédito: {formatCurrency(comparativoTarjetas.bbvaCredito)}</div>
            <div>AMEX: {formatCurrency(comparativoTarjetas.bbvaAmex)}</div>
            {comparativoTarjetas.bbvaPropinasTarj > 0 && (
              <div className="text-indigo-600 dark:text-indigo-400 font-bold border-t border-blue-200 dark:border-blue-800 pt-0.5 mt-0.5">
                + Propina: {formatCurrency(comparativoTarjetas.bbvaPropinasTarj)}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
          <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 block">Diferencia (BBVA - Parrot)</span>
          <h4 className={`text-xl font-black font-mono mt-1 ${
            comparativoTarjetas.diferenciaTarjetas === 0 ? 'text-emerald-600' : 'text-purple-700 dark:text-purple-300'
          }`}>
            {comparativoTarjetas.diferenciaTarjetas >= 0 ? '+' : ''}{formatCurrency(comparativoTarjetas.diferenciaTarjetas)}
          </h4>
          <p className="mt-2 text-[10px] text-gray-500">
            {comparativoTarjetas.diferenciaTarjetas === 0
              ? 'Coincidencia exacta entre el corte de la terminal y las comandas.'
              : 'Variación entre lo cobrado en la terminal física y lo registrado por meseros.'}
          </p>
        </div>
      </div>

      {/* TABLA COMPARATIVA DÍA POR DÍA */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Scale size={14} className="text-blue-500" /> Comparativo Diario: Débito y Crédito (Parrot vs Corte BBVA)
          </span>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
              <th className="p-3">Fecha</th>
              <th className="p-3 text-right">Parrot Débito</th>
              <th className="p-3 text-right">Parrot Crédito</th>
              <th className="p-3 text-right font-black">Total Parrot</th>
              <th className="p-3 text-right text-blue-600 dark:text-blue-400">BBVA Débito (Oficial)</th>
              <th className="p-3 text-right text-blue-600 dark:text-blue-400">BBVA Crédito (Oficial)</th>
              <th className="p-3 text-right font-black text-blue-600 dark:text-blue-400">Total BBVA (Oficial)</th>
              <th className="p-3 text-right font-black">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {comparativoTarjetas.dailyRows.map((r: any) => {
              const dif = r.bbvaTotal - r.parrotTotal;
              return (
                <tr key={r.fecha} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="p-3 font-mono font-medium text-gray-700 dark:text-gray-300">
                    {r.fecha}
                  </td>
                  <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">
                    {formatCurrency(r.parrotDebito)}
                  </td>
                  <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">
                    {formatCurrency(r.parrotCredito)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                    {formatCurrency(r.parrotTotal)}
                  </td>
                  <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                    {formatCurrency(r.bbvaDebito)}
                  </td>
                  <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                    {formatCurrency(r.bbvaCredito)}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-blue-600 dark:text-blue-400">
                    {formatCurrency(r.bbvaTotal)}
                  </td>
                  <td className="p-3 text-right font-mono font-black">
                    <span className={dif === 0 ? 'text-emerald-500' : dif > 0 ? 'text-blue-500' : 'text-amber-500'}>
                      {dif >= 0 ? `+${formatCurrency(dif)}` : formatCurrency(dif)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {comparativoTarjetas.dailyRows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400 italic">
                  No hay cortes de tarjeta registrados en el período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
