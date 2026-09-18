'use client';

import React from 'react';
import {
  Coins,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface ArqueoEfectivoSubTabProps {
  controlEfectivo: any;
  formatCurrency: (val: number | string | null | undefined) => string;
}

export const ArqueoEfectivoSubTab: React.FC<ArqueoEfectivoSubTabProps> = ({
  controlEfectivo,
  formatCurrency,
}) => {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      
      {/* ALERTA VISUAL DE FALTANTE */}
      <div className={`p-4 rounded-2xl border flex items-center justify-between flex-wrap gap-4 ${
        controlEfectivo.faltaPorDepositar > 0
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
      }`}>
        <div className="flex items-center gap-3">
          {controlEfectivo.faltaPorDepositar > 0 ? (
            <AlertTriangle className="text-amber-500 w-8 h-8 shrink-0" />
          ) : (
            <CheckCircle2 className="text-emerald-500 w-8 h-8 shrink-0" />
          )}
          <div>
            <h5 className="text-sm font-black uppercase tracking-wide">
              {controlEfectivo.faltaPorDepositar > 0
                ? `⚠️ Hace falta por depositar en el banco: ${formatCurrency(controlEfectivo.faltaPorDepositar)}`
                : '✅ Efectivo 100% depositado en el banco (Sin faltante)'}
            </h5>
            <p className="text-xs opacity-90 mt-0.5">
              Total Ventas Efectivo Parrot: <strong>{formatCurrency(controlEfectivo.ventasEfectivoParrot)}</strong> | Total Depósitos Realizados en Banco (Cargas Usuario): <strong>{formatCurrency(controlEfectivo.totalDepositosEfectivoRealizados)}</strong> ({controlEfectivo.porcentajeDepositado}% completado).
            </p>
          </div>
        </div>
      </div>

      {/* TABLA CRONOLÓGICA DÍA POR DÍA DE EFECTIVO */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Coins size={14} className="text-amber-500" /> Desglose Diario: Cobro de Efectivo vs Depósito en Banco (Cargas Usuario)
          </span>
          <span className="text-[10px] text-gray-400 font-mono">
            {controlEfectivo.dailyCashRows.length} días con movimientos
          </span>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
              <th className="p-3">Fecha</th>
              <th className="p-3 text-right">Venta Efectivo Parrot</th>
              <th className="p-3 text-right">Ficha Ventanilla / Practicaja</th>
              <th className="p-3 text-right">Depósito Estado de Cuenta (Usuario)</th>
              <th className="p-3 text-right font-black">Total Depositado</th>
              <th className="p-3 text-right">Diferencia del Día</th>
              <th className="p-3 text-right font-black text-amber-600 dark:text-amber-400">Saldo Pendiente Acumulado</th>
              <th className="p-3 text-center">Estatus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {controlEfectivo.dailyCashRows.map((r: any) => (
              <tr key={r.fecha} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                <td className="p-3 font-mono font-medium text-gray-700 dark:text-gray-300">
                  {r.fecha}
                </td>
                <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                  {formatCurrency(r.ventasEfectivoParrot)}
                </td>
                <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">
                  {r.depositosVentanilla > 0 ? formatCurrency(r.depositosVentanilla) : '-'}
                </td>
                <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">
                  {r.depositosBanco > 0 ? formatCurrency(r.depositosBanco) : '-'}
                </td>
                <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(r.totalDepositado)}
                </td>
                <td className="p-3 text-right font-mono font-bold">
                  <span className={r.diferenciaDia > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {r.diferenciaDia > 0 ? `+${formatCurrency(r.diferenciaDia)}` : formatCurrency(r.diferenciaDia)}
                  </span>
                </td>
                <td className="p-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                  {formatCurrency(r.saldoPendienteAcumulado || 0)}
                </td>
                <td className="p-3 text-center">
                  {(r.saldoPendienteAcumulado || 0) > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-955/50 dark:text-amber-300">
                      Falta Depositar
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-955/50 dark:text-emerald-300">
                      Depositado
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {controlEfectivo.dailyCashRows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400 italic">
                  No hay movimientos de efectivo registrados en el período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
