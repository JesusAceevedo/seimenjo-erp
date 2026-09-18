'use client';

import React from 'react';
import { Package, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { Producto } from '@/lib/modules/productos/types/producto.types';

interface ProductosListProps {
  productos: Producto[];
  selectedProd: Producto | null;
  onSelectProducto: (prod: Producto) => void;
  onEditProducto: (prod: Producto) => void;
  onDeleteProducto: (id: string, e: React.MouseEvent) => void;
  loadingProds: boolean;
  prodId: string | null;
  resetProductoForm: () => void;
}

export function ProductosList({
  productos,
  selectedProd,
  onSelectProducto,
  onEditProducto,
  onDeleteProducto,
  loadingProds,
  prodId,
  resetProductoForm
}: ProductosListProps) {
  return (
    <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold uppercase text-gray-500 tracking-wider">Productos Registrados</h4>
        {loadingProds && <RefreshCw size={14} className="animate-spin text-gray-400" />}
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {productos.map(p => (
          <div
            key={p.id}
            onClick={() => {
              onSelectProducto(p);
              if (prodId !== p.id) resetProductoForm();
            }}
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
              selectedProd?.id === p.id
                ? 'border-amber-500 bg-amber-600/5 dark:bg-amber-600/10'
                : 'border-gray-150 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200/50 dark:border-gray-800">
                {p.imagen_url ? (
                  <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                ) : (
                  <Package size={18} className="text-gray-400" />
                )}
              </div>
              <div className="overflow-hidden">
                <h5 className="font-bold text-sm truncate text-gray-900 dark:text-white leading-tight">{p.nombre}</h5>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center mt-0.5">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">{p.categoria}</span>
                  {p.precio_base !== null && p.precio_base !== undefined && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold font-mono">
                      • ${Number(p.precio_base).toFixed(2)} / {p.unidad_medida || 'Pieza'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditProducto(p);
                }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-850 rounded text-gray-500 hover:text-amber-500 transition-colors"
                title="Editar producto"
              >
                <Edit2 size={13} />
              </button>
              <button
                onClick={(e) => onDeleteProducto(p.id, e)}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-850 rounded text-gray-500 hover:text-red-500 transition-colors"
                title="Eliminar producto"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {productos.length === 0 && !loadingProds && (
          <div className="text-center py-6 text-gray-400 italic text-sm">
            No hay productos cargados.
          </div>
        )}
      </div>
    </div>
  );
}
