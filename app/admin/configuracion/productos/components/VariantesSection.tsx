'use client';

import React from 'react';
import { Layers, Package, Plus, Trash2 } from 'lucide-react';
import { Producto, Variante } from '@/lib/modules/productos/types/producto.types';

interface VariantesSectionProps {
  selectedProd: Producto | null;
  variantes: Variante[];
  selectedVar: Variante | null;
  onSelectVar: (v: Variante) => void;
  varGramaje: string;
  setVarGramaje: (val: string) => void;
  varPrecioBase: string;
  setVarPrecioBase: (val: string) => void;
  handleSaveVariante: (e: React.FormEvent) => void;
  handleDeleteVariante: (id: string) => void;
  savingVar: boolean;
  loadingVars: boolean;
}

export function VariantesSection({
  selectedProd,
  variantes,
  selectedVar,
  onSelectVar,
  varGramaje,
  setVarGramaje,
  varPrecioBase,
  setVarPrecioBase,
  handleSaveVariante,
  handleDeleteVariante,
  savingVar,
  loadingVars
}: VariantesSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <Layers className="text-blue-500" size={20} />
        Variantes de Gramaje
      </h3>

      {selectedProd ? (
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-150 dark:border-gray-800 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-850 flex items-center justify-center">
              {selectedProd.imagen_url ? (
                <img src={selectedProd.imagen_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Package size={20} className="text-gray-400" />
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">{selectedProd.categoria}</span>
              <h4 className="font-extrabold text-sm text-gray-900 dark:text-white leading-tight">{selectedProd.nombre}</h4>
            </div>
          </div>

          {/* Formulario de Variantes */}
          <form onSubmit={handleSaveVariante} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-150 dark:border-gray-850 font-sans">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Gramaje (Ej. 1 Pz, 500g)</label>
              <input
                type="text"
                placeholder="Gramaje / Presentación"
                value={varGramaje}
                className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                onChange={e => setVarGramaje(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Precio Base ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={varPrecioBase}
                className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                onChange={e => setVarPrecioBase(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingVar}
              className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-sm transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={14} /> Registrar Variante
            </button>
          </form>

          {/* Tabla de Variantes */}
          <div className="overflow-hidden rounded-xl border border-gray-150 dark:border-gray-850">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                  <th className="p-3">Gramaje/Presentación</th>
                  <th className="p-3">Precio Base</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-850/40">
                {variantes.map(v => (
                  <tr
                    key={v.id}
                    onClick={() => onSelectVar(v)}
                    className={`cursor-pointer transition-colors ${
                      selectedVar?.id === v.id
                        ? 'bg-blue-600/5 dark:bg-blue-600/10 font-bold'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-900/20'
                    }`}
                  >
                    <td className="p-3 text-gray-900 dark:text-white">{v.gramaje}</td>
                    <td className="p-3 font-mono font-semibold text-gray-800 dark:text-gray-200">${Number(v.precio_base).toFixed(2)}</td>
                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleDeleteVariante(v.id)}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors"
                        title="Eliminar variante"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {variantes.length === 0 && !loadingVars && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-gray-400 italic">No hay variantes registradas para este producto.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400 italic text-sm font-sans flex flex-col items-center justify-center gap-2">
          <Package size={36} className="opacity-30" />
          <span>Selecciona un producto de la lista izquierda para gestionar sus variantes.</span>
        </div>
      )}
    </div>
  );
}
