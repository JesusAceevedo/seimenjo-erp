'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Receipt,
  UserCheck,
  CreditCard,
  Wallet,
  Sparkles,
} from 'lucide-react';

interface ChecklistCierreFiscalProps {
  totalTickets: number;
  totalTercerosDeducibles: number;
  totalTarjetasBbva: number;
  diferenciaTarjetas: number;
  faltaPorDepositar: number;
  totalFacturaPublicoGeneral: number;
  formatCurrency: (val: number | string | null | undefined) => string;
  selectedMonth: string;
}

export const ChecklistCierreFiscal: React.FC<ChecklistCierreFiscalProps> = ({
  totalTickets,
  totalTercerosDeducibles,
  totalTarjetasBbva,
  diferenciaTarjetas,
  faltaPorDepositar,
  totalFacturaPublicoGeneral,
  formatCurrency,
  selectedMonth,
}) => {
  const [expanded, setExpanded] = useState(false);

  const step1Done = totalTickets > 0;
  const step2Done = totalTercerosDeducibles > 0;
  const step3Done = totalTarjetasBbva > 0;
  const step4Done = faltaPorDepositar === 0;

  const completedSteps = [step1Done, step2Done, step3Done, step4Done].filter(Boolean).length;

  return (
    <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/5 to-purple-500/10 border border-emerald-500/20 rounded-2xl p-3.5 shadow-xs transition-all">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-emerald-600 text-white shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-wide text-gray-900 dark:text-gray-100">
                Asistente de Cierre Mensual Fiscal ({selectedMonth || 'Período Actual'})
              </h4>
              <span className="text-[10px] font-extrabold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-955 dark:text-emerald-300">
                {completedSteps} de 4 comprobaciones
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-sans">
              Base calculada lista para Factura Global: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(totalFacturaPublicoGeneral)}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer"
        >
          <span>{expanded ? 'Ocultar verificación' : 'Ver checklist de pasos'}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-gray-200/60 dark:border-gray-800/60 text-xs">
          
          {/* PASO 1 */}
          <div className={`p-2.5 rounded-xl border flex items-start gap-2 ${step1Done ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'}`}>
            <div className="mt-0.5 shrink-0">
              {step1Done ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Receipt size={15} className="text-gray-400" />}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 block">1. Cortes y Tickets POS</span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {step1Done ? `${totalTickets} cortes procesados` : 'Sin tickets registrados'}
              </p>
            </div>
          </div>

          {/* PASO 2 */}
          <div className={`p-2.5 rounded-xl border flex items-start gap-2 ${step2Done ? 'bg-purple-500/10 border-purple-500/20' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'}`}>
            <div className="mt-0.5 shrink-0">
              {step2Done ? <CheckCircle2 size={15} className="text-purple-500" /> : <UserCheck size={15} className="text-gray-400" />}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 block">2. Facturas de Terceros</span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {step2Done ? `-${formatCurrency(totalTercerosDeducibles)} deducidos` : 'Sin facturas a terceros'}
              </p>
            </div>
          </div>

          {/* PASO 3 */}
          <div className={`p-2.5 rounded-xl border flex items-start gap-2 ${step3Done ? 'bg-blue-500/10 border-blue-500/20' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'}`}>
            <div className="mt-0.5 shrink-0">
              {step3Done ? <CheckCircle2 size={15} className="text-blue-500" /> : <CreditCard size={15} className="text-gray-400" />}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 block">3. Tarjetas BBVA Oficial</span>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {step3Done ? `${formatCurrency(totalTarjetasBbva)} (Brecha: ${formatCurrency(diferenciaTarjetas)})` : 'Sin corte BBVA'}
              </p>
            </div>
          </div>

          {/* PASO 4 */}
          <div className={`p-2.5 rounded-xl border flex items-start gap-2 ${step4Done ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
            <div className="mt-0.5 shrink-0">
              {step4Done ? <CheckCircle2 size={15} className="text-emerald-500" /> : <AlertTriangle size={15} className="text-amber-500" />}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 block">4. Arqueo de Efectivo</span>
              <p className="text-[11px] font-semibold mt-0.5">
                {step4Done ? (
                  <span className="text-emerald-600 dark:text-emerald-400">100% en banco</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Falta {formatCurrency(faltaPorDepositar)}</span>
                )}
              </p>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
