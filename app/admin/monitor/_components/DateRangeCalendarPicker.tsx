'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

interface DateRangeCalendarPickerProps {
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;    // YYYY-MM-DD
  onChange: (inicio: string, fin: string) => void;
  className?: string;
  placeholder?: string;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEK_DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

// Helper para convertir Date local a YYYY-MM-DD sin desfasamiento UTC
const dateToYmd = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper para parsear YYYY-MM-DD como Date local
const ymdToDate = (ymd: string): Date | null => {
  if (!ymd) return null;
  const parts = ymd.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
};

export default function DateRangeCalendarPicker({
  fechaInicio,
  fechaFin,
  onChange,
  className = '',
  placeholder = 'Seleccionar rango de fechas...'
}: DateRangeCalendarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mes visible inicial (año y mes index 0-11)
  const initialDate = useMemo(() => {
    return ymdToDate(fechaInicio) || new Date();
  }, [fechaInicio]);

  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth());

  // Estado de selección provisional mientras el usuario hace clic
  const [tempStart, setTempStart] = useState<string>(fechaInicio);
  const [tempEnd, setTempEnd] = useState<string>(fechaFin);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sincronizar estado provisional cuando cambian las props
  useEffect(() => {
    setTempStart(fechaInicio);
    setTempEnd(fechaFin);
    if (fechaInicio) {
      const d = ymdToDate(fechaInicio);
      if (d) {
        setCurrentYear(d.getFullYear());
        setCurrentMonth(d.getMonth());
      }
    }
  }, [fechaInicio, fechaFin]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHoverDate(null);
        // Si quedó a medias la selección, revertir a lo que había
        setTempStart(fechaInicio);
        setTempEnd(fechaFin);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, fechaInicio, fechaFin]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Generador de días para un mes dado
  const getDaysInMonth = (year: number, month: number) => {
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lunes = 0, Domingo = 6
    const totalDays = new Date(year, month + 1, 0).getDate();
    return { firstDayIndex, totalDays };
  };

  const handleDayClick = (ymd: string) => {
    // Si no hay fecha de inicio seleccionada o si ya había un rango completo cerrado:
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(ymd);
      setTempEnd('');
      setHoverDate(null);
    } else if (tempStart && !tempEnd) {
      // Segundo clic: definir fin
      if (ymd < tempStart) {
        // Clickeó antes del inicio: invertimos orden
        const nuevoInicio = ymd;
        const nuevoFin = tempStart;
        setTempStart(nuevoInicio);
        setTempEnd(nuevoFin);
        setHoverDate(null);
        onChange(nuevoInicio, nuevoFin);
        setIsOpen(false);
      } else {
        setTempEnd(ymd);
        setHoverDate(null);
        onChange(tempStart, ymd);
        setIsOpen(false);
      }
    }
  };

  // Rango activo efectivo (incluye hover si estamos seleccionando el segundo día)
  const effectiveStart = tempStart;
  const effectiveEnd = tempEnd || (tempStart && hoverDate ? (hoverDate >= tempStart ? hoverDate : tempStart) : '');
  const effectiveInvertedStart = tempStart && hoverDate && hoverDate < tempStart ? hoverDate : tempStart;

  // Renderizar la cuadrícula de un mes
  const renderCalendarMonth = (year: number, month: number) => {
    const { firstDayIndex, totalDays } = getDaysInMonth(year, month);
    const cells = [];

    // Celdas vacías iniciales para alinear al día de la semana
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className="h-8" />);
    }

    const todayStr = dateToYmd(new Date());

    for (let day = 1; day <= totalDays; day++) {
      const dayDate = new Date(year, month, day);
      const ymd = dateToYmd(dayDate);

      const startBound = hoverDate && hoverDate < tempStart ? hoverDate : effectiveStart;
      const endBound = hoverDate && hoverDate < tempStart ? tempStart : effectiveEnd;

      const isStart = Boolean(startBound && ymd === startBound);
      const isEnd = Boolean(endBound && ymd === endBound);
      const isSingleDay = isStart && isEnd;

      const isInRange = Boolean(startBound && endBound && ymd >= startBound && ymd <= endBound);
      const isToday = ymd === todayStr;

      let cellBg = '';
      let textCol = 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800';

      if (isSingleDay) {
        cellBg = 'bg-amber-500 text-white font-bold rounded-lg shadow-sm';
        textCol = 'text-white';
      } else if (isStart) {
        cellBg = 'bg-amber-500 text-white font-bold rounded-l-lg shadow-sm';
        textCol = 'text-white';
      } else if (isEnd) {
        cellBg = 'bg-amber-500 text-white font-bold rounded-r-lg shadow-sm';
        textCol = 'text-white';
      } else if (isInRange) {
        cellBg = 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-semibold';
        textCol = 'text-amber-900 dark:text-amber-200';
      }

      cells.push(
        <button
          key={ymd}
          type="button"
          onClick={() => handleDayClick(ymd)}
          onMouseEnter={() => {
            if (tempStart && !tempEnd) {
              setHoverDate(ymd);
            }
          }}
          className={`h-8 text-xs flex items-center justify-center transition-all cursor-pointer relative ${cellBg} ${textCol} ${
            isToday && !isInRange && !isStart && !isEnd ? 'border border-amber-400 font-bold' : ''
          }`}
          title={formatDate(ymd)}
        >
          {day}
        </button>
      );
    }

    return (
      <div className="w-64 p-3">
        <div className="text-center font-bold text-sm text-gray-800 dark:text-gray-200 mb-2">
          {MONTH_NAMES[month]} {year}
        </div>
        <div className="grid grid-cols-7 gap-1 text-[11px] font-semibold text-gray-400 mb-1 text-center">
          {WEEK_DAYS.map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells}
        </div>
      </div>
    );
  };

  // Calcular segundo mes para la vista dual en desktop
  const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  const nextMonthIndex = currentMonth === 11 ? 0 : currentMonth + 1;

  const displayLabel = useMemo(() => {
    if (fechaInicio && fechaFin) {
      if (fechaInicio === fechaFin) {
        return formatDate(fechaInicio);
      }
      return `${formatDate(fechaInicio)} — ${formatDate(fechaFin)}`;
    }
    if (fechaInicio) {
      return `Desde: ${formatDate(fechaInicio)}`;
    }
    return placeholder;
  }, [fechaInicio, fechaFin, placeholder]);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Botón Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
          fechaInicio || fechaFin
            ? 'bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-300'
            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <CalendarIcon size={14} className="text-amber-500 shrink-0" />
        <span className="font-mono tracking-tight">{displayLabel}</span>
        {(fechaInicio || fechaFin) && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setTempStart('');
              setTempEnd('');
              onChange('', '');
            }}
            className="ml-1 p-0.5 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-full cursor-pointer text-amber-800 dark:text-amber-200"
            title="Limpiar fechas"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {/* Popover del Calendario */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150">
          {/* Header con controles de navegación */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800/80 mb-2 px-2">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <CalendarIcon size={13} className="text-amber-500" />
              Selecciona el rango de fechas
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg transition-colors cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg transition-colors cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Cuerpos de los Calendarios (Dual en pantallas medianas+) */}
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-gray-800/60">
            {renderCalendarMonth(currentYear, currentMonth)}
            <div className="hidden sm:block">
              {renderCalendarMonth(nextMonthYear, nextMonthIndex)}
            </div>
          </div>

          {/* Footer con estado y confirmación */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800/80 mt-2 px-2 text-xs">
            <div className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">
              {tempStart ? (
                <>
                  <span className="text-amber-600 font-semibold">{formatDate(tempStart)}</span>
                  {tempEnd ? (
                    <> → <span className="text-amber-600 font-semibold">{formatDate(tempEnd)}</span></>
                  ) : (
                    <span className="italic text-gray-400"> (Elige fecha final)</span>
                  )}
                </>
              ) : (
                <span className="italic">Haz clic en el día de inicio</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTempStart('');
                  setTempEnd('');
                  onChange('', '');
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium cursor-pointer"
              >
                Borrar
              </button>
              {tempStart && (
                <button
                  type="button"
                  onClick={() => {
                    const finalEnd = tempEnd || tempStart;
                    onChange(tempStart, finalEnd);
                    setIsOpen(false);
                  }}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                >
                  <Check size={12} /> Aplicar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
