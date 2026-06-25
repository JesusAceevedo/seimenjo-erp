'use client';

import React, { useState, useEffect } from 'react';
import { Boxes, Package, ArrowRightLeft, Plus, History } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';

export default function InventarioPage() {
  const { isDarkMode } = useThemeMode();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'movimientos' | 'ajustes'>('dashboard');
  const [stock, setStock] = useState<any[]>([]);
  const [almacenes, setAlmacenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventario();
  }, []);

  const fetchInventario = async () => {
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;

      const { data: almacenesData } = await supabase.from('almacenes').select('*');
      if (almacenesData) setAlmacenes(almacenesData);

      const { data: stockData } = await supabase
        .from('inventario_stock')
        .select(`
          id,
          cantidad_actual,
          costo_promedio,
          almacen_id,
          almacenes (nombre),
          producto_variantes (
            gramaje,
            precio_base,
            productos (nombre)
          )
        `);
      if (stockData) setStock(stockData);
    } catch (error) {
      console.error('Error fetching inventario', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 flex-1 overflow-y-auto text-gray-900 dark:text-gray-100 transition-colors flex flex-col p-8 w-full max-w-[100vw] mx-auto">
        <div className="mb-8 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3">
              <Boxes className="text-amber-500 w-8 h-8" /> Control de Inventario
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Supervisa el stock en tus sucursales, registra entradas manuales y transfiere mercancía.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6 shrink-0">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-3 border-b-2 font-semibold text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'dashboard' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Package className="w-4 h-4" /> Existencias
          </button>
          <button
            onClick={() => setActiveTab('movimientos')}
            className={`px-4 py-3 border-b-2 font-semibold text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'movimientos' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <History className="w-4 h-4" /> Movimientos
          </button>
          <button
            onClick={() => setActiveTab('ajustes')}
            className={`px-4 py-3 border-b-2 font-semibold text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'ajustes' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <Plus className="w-4 h-4" /> Nuevo Ajuste
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-8">
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
                            <td colSpan={5} className="py-8 text-center text-gray-500">
                              No hay inventario registrado. El stock se genera automáticamente con las entradas.
                            </td>
                          </tr>
                        ) : (
                          stock.map((item) => (
                            <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-900/50">
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
                                <span className={`font-bold ${Number(item.cantidad_actual) <= 10 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
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
