'use client';
// app/admin/_components/ActionButtons.tsx
// Botones de acciones de tabla (Editar, Eliminar y acción personalizada).
// Centraliza el estilo consistente de botones icon-only en las tablas del ERP.

import React from 'react';
import { Edit3, Trash2 } from 'lucide-react';

interface ActionButtonsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  /** Botones adicionales a la derecha de Editar/Eliminar */
  extra?: React.ReactNode;
  editTitle?: string;
  deleteTitle?: string;
}

export default function ActionButtons({
  onEdit,
  onDelete,
  extra,
  editTitle = 'Editar',
  deleteTitle = 'Eliminar'
}: ActionButtonsProps) {
  return (
    <div className="flex gap-2 justify-center">
      {extra}
      {onEdit && (
        <button
          onClick={onEdit}
          title={editTitle}
          className="p-2 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:bg-amber-500/20 rounded-lg text-gray-600 dark:text-gray-300 hover:text-amber-500 transition-colors"
        >
          <Edit3 size={15} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          title={deleteTitle}
          className="p-2 border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:bg-red-500/20 rounded-lg text-gray-600 dark:text-red-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
