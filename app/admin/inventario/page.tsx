'use client';

import React from 'react';
import { Boxes, Package, ArrowRightLeft, Plus, History, RefreshCw, Search, AlertCircle, DollarSign, Layers } from 'lucide-react';
import { useThemeMode } from '../../../lib/useThemeMode';
import { useInventario } from '../../../lib/modules/inventario/hooks/useInventario';

export default function InventarioPage() {
  const { isDarkMode } = useThemeMode();
  const {
    activeTab,
    setActiveTab,
    stock,
    almacenes,
    almacenSeleccionado,
    setAlmacenSeleccionado,
    busqueda,
    setBusqueda,
    loading,
    metricas,
    fetchInventario
  } = useInventario();

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 flex-1 overflow-y-auto text-gray-900 dark:text-gray-100 transition-colors flex flex-col p-8 w-full max-w-[100vw] mx-auto">
        
        {/* HEADER */}
        <div className="mb-6 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3">
              <Boxes className="text-amber-500 w-8 h-8" /> Control de Inventario
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Supervisa el stock en tus sucursales, existencias por almacén y costo promedio ponderado.
            </p>
          </div>
          <button
            onClick={fetchInventario}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
          <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Layers size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Variantes Registradas</p>
              <h4 className="text-xl font-bold">{metricas.totalVariantes}</h4>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Package size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Unidades en Stock</p>
              <h4 className="text-xl font-bold">{metricas.unidadesTotales.toFixed(2)}</h4>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-lg">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Valorización Estimada</p>
              <h4 className="text-xl font-bold">${metricas.valorizacionTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</h4>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Bajo Stock (&le; 10)</p>
              <h4 className={`text-xl font-bold ${metricas.articulosBajoStock > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                {metricas.articulosBajoStock}
              </h4>
            </div>
          </div>
        </div>

        {/* TABS Y FILTROS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 dark:border-gray-800 mb-6 shrink-0 gap-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-3 border-b-2 font-semibold text-sm flex items-center gap-2 transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Package className="w-4 h-4" /> Existencias
            </button>
            <button
              onClick={() => setActiveTab('movimientos')}
              className={`px-4 py-3 border-b-2 font-semibold text-sm flex items-center gap-2 transition-colors ${
                activeTab === 'movimientos'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <History className="w-4 h-4" /> Movimientos
            </button>
            <button
              onClick={() => setActiveTab('ajustes')}
              className={`px-4 py-3 border-b-2 font-semibold text-sm flex items-center gap-2 transition-colors ${
                activeTab === 'ajustes'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Plus className="w-4 h-4" /> Nuevo Ajuste
            </button>
          </div>

          {activeTab === 'dashboard' && (
            <div className="flex items-center gap-3 pb-2 md:pb-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {almacenes.length > 0 && (
                <select
                  value={almacenSeleccionado}
                  onChange={e => setAlmacenSeleccionado(e.target.value)}
                  className="text-xs py-1.5 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Todos los Almacenes</option>
                  {almacenes.map(alm => (
                    <option key={alm.id} value={alm.id}>{alm.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
                  <h3 className="text-lg font-bold mb-4">Stock por Almacén</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 text-sm text-gray-500">
                          <th className="py-3 px-4 font-semibold">Producto</th>
                          <th className="py-3 px-4 font-semibold">Gramaje</th>
                          <th className="py-3 px-4 font-semibold">Almacén</th>
                          <th className="py-3 px-4 font-semibold text-right">Costo Promedio</th>
                          <th className="py-3 px-4 font-semibold text-right">Stock Actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stock.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                              No hay inventario registrado con los filtros seleccionados.
                            </td>
                          </tr>
                        ) : (
                          stock.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                              <td className="py-3 px-4 font-medium">{item.producto_variantes?.productos?.nombre || 'Producto Desconocido'}</td>
                              <td className="py-3 px-4 text-sm text-gray-500">{item.producto_variantes?.gramaje || 'N/A'}</td>
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">
                                  {item.almacenes?.nombre || 'N/A'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-sm">
                                ${(Number(item.costo_promedio) || 0).toFixed(2)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`font-bold ${Number(item.cantidad_actual) <= 10 ? 'text-red-500 font-mono' : 'text-green-600 dark:text-green-400 font-mono'}`}>
                                  {Number(item.cantidad_actual).toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'movimientos' && (
                <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex flex-col items-center justify-center text-center h-64">
                  <History className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4" />
                  <h3 className="text-lg font-bold text-gray-600 dark:text-gray-300">Próximamente: Historial de Movimientos</h3>
                  <p className="text-gray-400 text-sm mt-2 max-w-md">Aquí podrás ver el kardex detallado con todas las entradas, salidas y transferencias registradas.</p>
                </div>
              )}

              {activeTab === 'ajustes' && (
                <div className="bg-white dark:bg-gray-950 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 flex flex-col items-center justify-center text-center h-64">
                  <ArrowRightLeft className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4" />
                  <h3 className="text-lg font-bold text-gray-600 dark:text-gray-300">Próximamente: Ajustes Manuales</h3>
                  <p className="text-gray-400 text-sm mt-2 max-w-md">Aquí podrás realizar ajustes de inventario, registrar mermas o transferir mercancía entre sucursales.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

