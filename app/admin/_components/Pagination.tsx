'use client';
// app/admin/_components/Pagination.tsx
// Controles de paginación reutilizables con soporte para total conocido y desconocido.

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  /** Página actual (0-indexada) */
  page: number;
  /** Número de registros en la página actual */
  currentCount: number;
  /** Tamaño de página */
  pageSize: number;
  /** Callback al cambiar de página */
  onPageChange: (newPage: number) => void;
  /** Total de registros (opcional; si no se provee, se usa currentCount < pageSize para desactivar Siguiente) */
  total?: number;
}

export default function Pagination({ page, currentCount, pageSize, onPageChange, total }: PaginationProps) {
  const totalPages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const isFirstPage = page === 0;
  const isLastPage = total !== undefined
    ? (page + 1) * pageSize >= total
    : currentCount < pageSize;

  return (
    <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
      <button
        disabled={isFirstPage}
        onClick={() => onPageChange(page - 1)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors"
      >
        <ChevronLeft size={16} /> Anterior
      </button>

      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
        {totalPages !== undefined
          ? `Página ${page + 1} de ${totalPages}`
          : `Página ${page + 1}`}
      </span>

      <button
        disabled={isLastPage}
        onClick={() => onPageChange(page + 1)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors"
      >
        Siguiente <ChevronRight size={16} />
      </button>
    </div>
  );
}
