'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Landmark, Banknote, CreditCard, Layers, ChevronDown, Check } from 'lucide-react';

interface AccountSelectorDropdownProps {
  selectedCuentaId: string;
  onSelect: (cuentaId: string) => void;
  cuentasBancarias?: any[];
  className?: string;
  placeholder?: string;
}

export default function AccountSelectorDropdown({
  selectedCuentaId,
  onSelect,
  cuentasBancarias = [],
  className = '',
  placeholder = 'Todas las Cuentas'
}: AccountSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selCuenta = cuentasBancarias?.find(c => c.id === selectedCuentaId);

  const getAccountIcon = (nombre?: string) => {
    const n = (nombre || '').toUpperCase();
    if (n.includes('BBVA') || n.includes('BANCOMER')) {
      return <Landmark size={14} className="text-blue-500 shrink-0" />;
    }
    if (n.includes('CAJA') || n.includes('EFECTIVO')) {
      return <Banknote size={14} className="text-emerald-500 shrink-0" />;
    }
    if (n.includes('PARROT')) {
      return <CreditCard size={14} className="text-purple-500 shrink-0" />;
    }
    return <Layers size={14} className="text-amber-500 shrink-0" />;
  };

  const displayText = selCuenta 
    ? `${selCuenta.nombre} (${selCuenta.moneda || 'MXN'})`
    : placeholder;

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:border-amber-500 dark:hover:border-amber-500 px-3 py-1.5 rounded-xl text-xs text-gray-900 dark:text-white font-sans font-semibold outline-none focus:ring-2 focus:ring-amber-500/30 transition-all cursor-pointer shadow-xs min-w-[165px]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5 truncate">
          {getAccountIcon(selCuenta?.nombre)}
          <span className="truncate">{displayText}</span>
        </span>
        <ChevronDown 
          size={14} 
          className={`text-gray-400 dark:text-gray-500 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl z-[999] py-1 font-sans animate-in fade-in slide-in-from-top-1 duration-150 backdrop-blur-md"
          role="listbox"
        >
          {/* Opción Todas las Cuentas */}
          <button
            type="button"
            onClick={() => {
              onSelect('');
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
              !selectedCuentaId
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80 font-medium'
            }`}
            role="option"
            aria-selected={!selectedCuentaId}
          >
            <span className="flex items-center gap-2">
              <Layers size={14} className="text-amber-500 shrink-0" />
              <span>{placeholder}</span>
            </span>
            {!selectedCuentaId && <Check size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />}
          </button>

          {cuentasBancarias && cuentasBancarias.length > 0 && (
            <div className="h-px bg-gray-150 dark:bg-gray-800 my-1" />
          )}

          {/* Opciones de Cuentas */}
          {cuentasBancarias?.map((c) => {
            const isSelected = c.id === selectedCuentaId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c.id);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/80 font-medium'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <span className="flex items-center gap-2 truncate">
                  {getAccountIcon(c.nombre)}
                  <span className="truncate">{c.nombre} ({c.moneda || 'MXN'})</span>
                </span>
                {isSelected && <Check size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
