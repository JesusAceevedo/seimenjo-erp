'use client';

import React from 'react';
import { Calendar, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { usePeriod } from '../../../lib/hooks/usePeriod';

interface PeriodSelectorProps {
  onPeriodChange?: (period: string) => void;
}

export default function PeriodSelector({ onPeriodChange }: PeriodSelectorProps) {
  const { selectedMonth, periodStatus, changePeriod } = usePeriod();

  const getMonthOptionsList = () => {
    const options = [];
    const d = new Date();
    d.setMonth(d.getMonth() - 18);
    for (let i = 0; i < 25; i++) {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      options.push(`${yr}-${mo}`);
      d.setMonth(d.getMonth() + 1);
    }
    return options.reverse(); // Newest first
  };

  const getStatusDisplay = () => {
    switch (periodStatus) {
      case 'cerrado_definitivo':
        return {
          bg: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900/50',
          icon: <Lock className="w-3.5 h-3.5 text-red-500" />,
          label: 'Cerrado Definitivo',
          desc: 'Periodo bloqueado. No se permiten registros ni modificaciones.'
        };
      case 'pre_cerrado':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
          label: 'Pre-cerrado',
          desc: 'Cierre temporal. Nuevas facturas bloqueadas, se permiten ediciones correctivas.'
        };
      case 'abierto':
      default:
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
          icon: <Unlock className="w-3.5 h-3.5 text-emerald-500" />,
          label: 'Periodo Abierto',
          desc: 'Edición y registro libres en este periodo.'
        };
    }
  };

  const display = getStatusDisplay();

  const handlePeriodSelect = (val: string) => {
    changePeriod(val);
    if (onPeriodChange) onPeriodChange(val);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white dark:bg-gray-950 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all duration-300 font-sans">
      <div className="flex items-center gap-2">
        <Calendar className="text-amber-500 w-4 h-4 shrink-0 animate-pulse" />
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Periodo:</span>
        <select
          value={selectedMonth}
          onChange={(e) => handlePeriodSelect(e.target.value)}
          className="bg-transparent border-none text-xs font-bold text-gray-900 dark:text-white cursor-pointer outline-none focus:ring-0 p-0 pr-6"
        >
          {getMonthOptionsList().map((m) => (
            <option key={m} value={m} className="bg-white dark:bg-gray-950 text-gray-900 dark:text-white text-xs font-sans">
              {new Date(m + '-02').toLocaleDateString('es-MX', { year: 'numeric', month: 'long', timeZone: 'UTC' })}
            </option>
          ))}
        </select>
      </div>

      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${display.bg}`}
        title={display.desc}
      >
        {display.icon}
        <span>{display.label}</span>
      </div>
    </div>
  );
}
