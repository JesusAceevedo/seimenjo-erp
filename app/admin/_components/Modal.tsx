'use client';
// app/admin/_components/Modal.tsx
// Wrapper genérico de modal que estandariza el overlay y el contenedor.
// Elimina el patrón repetido de "fixed inset-0 bg-black/60 backdrop-blur-sm" en toda la app.

import React from 'react';

interface ModalProps {
  /** Si el modal debe mostrarse */
  open: boolean;
  /** Callback al cerrar (click fuera o ESC) */
  onClose?: () => void;
  /** Ancho máximo del modal (default: max-w-2xl) */
  maxWidth?: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, maxWidth = 'max-w-2xl', children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Cierra al hacer clic en el overlay, pero no en el contenido
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full ${maxWidth} shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100`}
      >
        {children}
      </div>
    </div>
  );
}
