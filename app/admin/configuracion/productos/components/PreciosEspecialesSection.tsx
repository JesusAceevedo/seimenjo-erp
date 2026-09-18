'use client';

import React from 'react';
import { DollarSign, Save, Trash2, X } from 'lucide-react';
import { Producto, Variante, PrecioEspecial, Cliente } from '@/lib/modules/productos/types/producto.types';

interface PreciosEspecialesSectionProps {
  selectedProd: Producto | null;
  selectedVar: Variante;
  preciosEspeciales: PrecioEspecial[];
  clientesFiltrados: Cliente[];
  filtroCliente: string;
  setFiltroCliente: (val: string) => void;
  selectedClienteId: string;
  setSelectedClienteId: (id: string) => void;
  precioPactado: string;
  setPrecioPactado: (val: string) => void;
  handleSavePrecioEspecial: (e: React.FormEvent) => void;
  handleDeletePrecioEspecial: (id: string) => void;
  savingPrecio: boolean;
  loadingPrecios: boolean;
}

export function PreciosEspecialesSection({
  selectedProd,
  selectedVar,
  preciosEspeciales,
  clientesFiltrados,
  filtroCliente,
  setFiltroCliente,
  selectedClienteId,
  setSelectedClienteId,
  precioPactado,
  setPrecioPactado,
  handleSavePrecioEspecial,
  handleDeletePrecioEspecial,
  savingPrecio,
  loadingPrecios
}: PreciosEspecialesSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
      <div>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <DollarSign className="text-green-500" size={20} />
          Precios Pactados por Cliente
        </h3>
        <p className="text-[11px] text-gray-400 font-sans mt-0.5">
          Define tarifas exclusivas para la variante <span className="font-semibold text-blue-500">{selectedVar.gramaje}</span> de <span className="font-semibold text-amber-500">{selectedProd?.nombre}</span>.
        </p>
      </div>

      {/* Formulario de Precios Especiales */}
      <form onSubmit={handleSavePrecioEspecial} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-150 dark:border-gray-850 font-sans">
        <div className="relative">
          <label className="text-[10px] font-bold text-gray-500 uppercase">Cliente B2B *</label>
          <div className="relative mt-1">
            <input
              type="text"
              placeholder="Filtrar cliente..."
              value={filtroCliente}
              className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 pr-7"
              onChange={e => {
                setFiltroCliente(e.target.value);
                setSelectedClienteId('');
              }}
            />
            {filtroCliente && (
              <button
                type="button"
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setFiltroCliente('');
                  setSelectedClienteId('');
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          {/* Desplegable de coincidencia */}
          {!selectedClienteId && filtroCliente.trim().length > 0 && (
            <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl z-20 text-xs">
              {clientesFiltrados.slice(0, 10).map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedClienteId(c.id);
                    setFiltroCliente(c.nombre_local);
                  }}
                  className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer border-b border-gray-100 dark:border-gray-900 text-gray-900 dark:text-white"
                >
                  <div className="font-bold">{c.nombre_local}</div>
                  <div className="text-[10px] text-gray-400 truncate">{c.razon_social}</div>
                </div>
              ))}
              {clientesFiltrados.length === 0 && (
                <div className="p-3 text-center text-gray-400 italic">No se hallaron clientes.</div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Precio Pactado ($)</label>
          <input
            type="number"
            step="0.01"
            placeholder={`Base: $${Number(selectedVar.precio_base).toFixed(2)}`}
            value={precioPactado}
            className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
            onChange={e => setPrecioPactado(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          disabled={savingPrecio || !selectedClienteId}
          className="w-full h-9 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-xs shadow-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
        >
          <Save size={14} /> Registrar Tarifa
        </button>
      </form>

      {/* Tabla de Precios Especiales */}
      <div className="overflow-hidden rounded-xl border border-gray-150 dark:border-gray-850">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
              <th className="p-3">Cliente</th>
              <th className="p-3">Razón Social</th>
              <th className="p-3">Precio Especial Pactado</th>
              <th className="p-3 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-850/40">
            {preciosEspeciales.map(pe => (
              <tr key={pe.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                <td className="p-3 font-semibold text-gray-900 dark:text-white">{pe.clientes?.nombre_local}</td>
                <td className="p-3 text-gray-400">{pe.clientes?.razon_social || 'N/A'}</td>
                <td className="p-3 font-mono font-bold text-green-600 dark:text-green-400">
                  ${Number(pe.precio_pactado).toFixed(2)}
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleDeletePrecioEspecial(pe.id)}
                    className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors"
                    title="Eliminar tarifa especial"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {preciosEspeciales.length === 0 && !loadingPrecios && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-400 italic">No hay tarifas especiales asignadas para esta variante.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
