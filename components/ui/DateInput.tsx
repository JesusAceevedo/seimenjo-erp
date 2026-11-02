'use client';

import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

export interface DateInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
}

/**
 * Componente que reemplaza o envuelve a <input type="date" /> para garantizar que
 * SIEMPRE se muestre la fecha en formato Día / Mes / Año (DD/MM/AAAA) sin importar
 * la configuración de idioma (en-US / es-MX) del navegador o sistema operativo,
 * conservando el calendario nativo y todos los estilos originales.
 */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ className = '', style, value, defaultValue, onChange, disabled, readOnly, wrapperClassName = '', ...props }, forwardedRef) => {
    const internalRef = useRef<HTMLInputElement | null>(null);
    const [uncontrolledVal, setUncontrolledVal] = React.useState<string>(
      defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : ''
    );

    const setRef = (node: HTMLInputElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
    };

    const strVal = value !== undefined && value !== null ? String(value) : uncontrolledVal;
    const formatted = strVal ? formatDate(strVal) : '';
    const displayText = formatted && formatted !== '—' ? formatted : 'dd/mm/aaaa';
    const hasValue = Boolean(formatted && formatted !== '—');

    const handleTriggerPicker = () => {
      if (disabled || readOnly) return;
      const el = internalRef.current;
      if (!el) return;
      try {
        if (typeof (el as any).showPicker === 'function') {
          (el as any).showPicker();
        } else {
          el.focus();
        }
      } catch {
        el.focus();
      }
    };

    // Detectar clases de layout (width, flex, margin) para aplicarlas al contenedor también
    const hasFullWidth = /\bw-full\b/.test(className);
    const hasFlex1 = /\bflex-1\b/.test(className);
    const hasMt1 = /\bmt-1\b/.test(className);

    const containerClasses = [
      'relative inline-flex items-center',
      hasFullWidth ? 'w-full' : '',
      hasFlex1 ? 'flex-1' : '',
      hasMt1 ? 'mt-1' : '',
      wrapperClassName,
    ].filter(Boolean).join(' ');

    // Removemos mt-1 del className interno para no duplicar margen superior
    const innerClassName = className.replace(/\bmt-1\b/g, '').trim();

    return (
      <div className={containerClasses}>
        {/* Visualizador formateado en DD/MM/AAAA con las mismas clases del input */}
        <div
          aria-hidden="true"
          className={`${innerClassName} w-full flex items-center justify-between gap-1.5 select-none pointer-events-none ${
            !hasValue ? 'text-gray-400 dark:text-gray-500' : ''
          } ${disabled ? 'opacity-50' : ''}`}
          style={style}
        >
          <span className="truncate font-mono">{displayText}</span>
          <Calendar className="w-3.5 h-3.5 opacity-60 shrink-0" />
        </div>

        {/* Input nativo transparente encima para mantener toda la interacción, teclado y calendario nativo */}
        <input
          {...props}
          ref={setRef}
          type="date"
          lang="es-MX"
          value={value}
          defaultValue={defaultValue}
          onChange={(e) => {
            if (value === undefined) {
              setUncontrolledVal(e.target.value);
            }
            onChange?.(e);
          }}
          disabled={disabled}
          readOnly={readOnly}
          onClick={(e) => {
            handleTriggerPicker();
            props.onClick?.(e);
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
          style={style}
        />
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';
export default DateInput;
