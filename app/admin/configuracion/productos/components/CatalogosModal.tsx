'use client';

import React from 'react';
import { X, AlertTriangle, Save, Edit2, Trash2 } from 'lucide-react';
import { CatalogItem, CatalogType } from '@/lib/modules/productos/types/producto.types';

interface CatalogosModalProps {
  showCatalogModal: CatalogType | null;
  onClose: () => void;
  catalogError: string | null;
  catalogInput: string;
  setCatalogInput: (val: string) => void;
  editingCatalogItem: CatalogItem | null;
  setEditingCatalogItem: (item: CatalogItem | null) => void;
  catalogSaving: boolean;
  handleSaveCatalogItem: (e: React.FormEvent) => void;
  handleDeleteCatalogItem: (item: CatalogItem) => void;
  categoriasCatalog: CatalogItem[];
  unidadesCatalog: CatalogItem[];
}

export function CatalogosModal({
  showCatalogModal,
  onClose,
  catalogError,
  catalogInput,
  setCatalogInput,
  editingCatalogItem,
  setEditingCatalogItem,
  catalogSaving,
  handleSaveCatalogItem,
  handleDeleteCatalogItem,
  categoriasCatalog,
  unidadesCatalog
}: CatalogosModalProps) {
  if (!showCatalogModal) return null;

  const currentList = showCatalogModal === 'categorias' ? categoriasCatalog : unidadesCatalog;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-850">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            Gestionar {showCatalogModal === 'categorias' ? 'Categorías' : 'Unidades de Medida'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900"
          >
            <X size={20} />
          </button>
        </div>

        {catalogError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl text-xs flex gap-2">
            <AlertTriangle className="shrink-0 w-4 h-4 mt-0.5" />
            <span>{catalogError}</span>
          </div>
        )}

        {/* Formulario de registro/edición */}
        <form onSubmit={handleSaveCatalogItem} className="flex gap-2 items-end">
          <div className="flex-1 col-span-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase">
              {editingCatalogItem ? 'Editar Nombre' : 'Nuevo Elemento'}
            </label>
            <input
              type="text"
              placeholder={showCatalogModal === 'categorias' ? 'Ej. Postres, Bebidas' : 'Ej. Metro, Docena'}
              value={catalogInput}
              className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              onChange={e => setCatalogInput(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex gap-1">
            {editingCatalogItem && (
              <button
                type="button"
                onClick={() => {
                  setEditingCatalogItem(null);
                  setCatalogInput('');
                }}
                className="h-8 px-3 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-350 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={catalogSaving}
              className="h-8 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 disabled:opacity-50"
            >
              <Save size={13} />
              {editingCatalogItem ? 'Actualizar' : 'Agregar'}
            </button>
          </div>
        </form>

        {/* Lista de elementos del catálogo */}
        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
          {currentList.map(item => (
            <div
              key={item.id}
              className="p-2.5 rounded-lg border border-gray-100 dark:border-gray-900 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/50"
            >
              <span className="text-xs text-gray-900 dark:text-white font-medium">{item.nombre}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCatalogItem(item);
                    setCatalogInput(item.nombre);
                  }}
                  className="p-1 text-gray-400 hover:text-amber-500 rounded hover:bg-gray-100 dark:hover:bg-gray-850"
                  title="Editar"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCatalogItem(item)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-gray-850"
                  title="Eliminar"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {currentList.length === 0 && (
            <div className="text-center py-6 text-gray-400 italic text-xs">
              No hay elementos registrados en este catálogo.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
