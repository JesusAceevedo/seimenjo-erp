'use client';

import React from 'react';
import { Package } from 'lucide-react';
import ProductosTab from '../configuracion/ProductosTab';
import { useThemeMode } from '../../../lib/useThemeMode';

export default function ProductosPage() {
  const { isDarkMode } = useThemeMode();

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 flex-1 overflow-y-auto text-gray-900 dark:text-gray-100 transition-colors flex flex-col p-8 w-full max-w-[100vw] mx-auto">
        <div className="mb-8 shrink-0">
          <h2 className="text-3xl font-extrabold flex items-center gap-3">
            <Package className="text-amber-500 w-8 h-8" /> Catálogo de Productos y Precios
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
            Administra el catálogo de productos, sus variantes de gramaje y los precios especiales pactados con tus clientes de crédito.
          </p>
        </div>
        <ProductosTab />
      </div>
    </div>
  );
}
