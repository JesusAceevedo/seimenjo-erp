'use client';

import React from 'react';
import { Package, AlertTriangle, CheckCircle, UploadCloud, X, RefreshCw, Save } from 'lucide-react';
import { CatalogItem, CatalogType } from '@/lib/modules/productos/types/producto.types';

interface ProductoFormProps {
  prodId: string | null;
  prodNombre: string;
  setProdNombre: (val: string) => void;
  prodCategoria: string;
  setProdCategoria: (val: string) => void;
  prodPrecioBase: string;
  setProdPrecioBase: (val: string) => void;
  prodUnidadMedida: string;
  setProdUnidadMedida: (val: string) => void;
  prodImagenPreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImagenChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClearImage: () => void;
  resetProductoForm: () => void;
  handleSaveProducto: (e: React.FormEvent) => void;
  savingProd: boolean;
  errorMsg: string | null;
  successMsg: string | null;
  categoriasCatalog: CatalogItem[];
  unidadesCatalog: CatalogItem[];
  onOpenCatalogModal: (type: CatalogType) => void;
}

export function ProductoForm({
  prodId,
  prodNombre,
  setProdNombre,
  prodCategoria,
  setProdCategoria,
  prodPrecioBase,
  setProdPrecioBase,
  prodUnidadMedida,
  setProdUnidadMedida,
  prodImagenPreview,
  fileInputRef,
  handleImagenChange,
  handleClearImage,
  resetProductoForm,
  handleSaveProducto,
  savingProd,
  errorMsg,
  successMsg,
  categoriasCatalog,
  unidadesCatalog,
  onOpenCatalogModal
}: ProductoFormProps) {
  return (
    <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <Package className="text-amber-500" size={20} />
        {prodId ? 'Editar Producto' : 'Crear Producto'}
      </h3>

      {errorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl text-xs flex gap-2">
          <AlertTriangle className="shrink-0 w-4 h-4 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs flex gap-2">
          <CheckCircle className="shrink-0 w-4 h-4 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveProducto} className="space-y-4 font-sans">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre del Producto *</label>
          <input
            type="text"
            placeholder="Nombre del Producto"
            value={prodNombre}
            className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-amber-500 outline-none text-gray-900 dark:text-white"
            onChange={e => setProdNombre(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Categoría</label>
              <button
                type="button"
                onClick={() => onOpenCatalogModal('categorias')}
                className="text-[10px] text-amber-600 hover:text-amber-500 font-bold"
              >
                Gestionar
              </button>
            </div>
            <select
              value={prodCategoria}
              className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
              onChange={e => setProdCategoria(e.target.value)}
            >
              {categoriasCatalog.length > 0 ? (
                categoriasCatalog.map(c => (
                  <option key={c.id} value={c.nombre}>{c.nombre}</option>
                ))
              ) : (
                <>
                  <option value="Fideos">Fideos</option>
                  <option value="Tortillas">Tortillas</option>
                  <option value="Salsas">Salsas</option>
                  <option value="Caldo">Caldo</option>
                  <option value="Toppings">Toppings</option>
                  <option value="Otros">Otros</option>
                </>
              )}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Unidad de Medida</label>
              <button
                type="button"
                onClick={() => onOpenCatalogModal('unidades')}
                className="text-[10px] text-amber-600 hover:text-amber-500 font-bold"
              >
                Gestionar
              </button>
            </div>
            <select
              value={prodUnidadMedida}
              className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
              onChange={e => setProdUnidadMedida(e.target.value)}
            >
              {unidadesCatalog.length > 0 ? (
                unidadesCatalog.map(u => (
                  <option key={u.id} value={u.nombre}>{u.nombre}</option>
                ))
              ) : (
                <>
                  <option value="Pieza">Pieza</option>
                  <option value="Kg">Kg</option>
                  <option value="Litro">Litro</option>
                  <option value="Caja">Caja</option>
                  <option value="Paquete">Paquete</option>
                  <option value="Gramo">Gramo</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Precio Base ($) *</label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={prodPrecioBase}
            className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-amber-500 outline-none text-gray-900 dark:text-white"
            onChange={e => setProdPrecioBase(e.target.value)}
            required
          />
        </div>

        {/* SECCIÓN IMAGEN */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Foto del Producto</label>
          <div className="mt-1 flex flex-col gap-3">
            {prodImagenPreview ? (
              <div className="relative w-full h-40 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden group">
                <img
                  src={prodImagenPreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-600 text-white p-1.5 rounded-full shadow transition-all opacity-90 group-hover:opacity-100"
                  onClick={handleClearImage}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative w-full border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImagenChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <UploadCloud className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Selecciona una foto (.jpg, .png)
                </p>
                <p className="text-[10px] text-gray-400 mt-1">Sube la foto del producto a Supabase Storage</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {prodId && (
            <button
              type="button"
              onClick={resetProductoForm}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-sm transition-all text-center"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={savingProd}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {savingProd ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Guardando...
              </>
            ) : (
              <>
                <Save size={16} /> {prodId ? 'Actualizar' : 'Guardar Producto'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
