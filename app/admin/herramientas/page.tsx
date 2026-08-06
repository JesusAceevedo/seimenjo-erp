'use client';

import React from 'react';
import { Wrench, FileSpreadsheet, Sparkles } from 'lucide-react';
import ConversorEstadoCuenta from './_components/ConversorEstadoCuenta';

export default function HerramientasPage() {
  const [activeTab, setActiveTab] = React.useState<'conversor_bancario'>('conversor_bancario');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900 font-sans p-6 space-y-6">
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-955/40 text-amber-500 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm">
            <Wrench size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              Herramientas <Sparkles size={18} className="text-amber-500" />
            </h1>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
              Utilidades administrativas y conversión de archivos para la gestión contable del ERP.
            </p>
          </div>
        </div>
      </div>

      {/* PESTAÑAS DE HERRAMIENTAS */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <button
          onClick={() => setActiveTab('conversor_bancario')}
          className={`px-4 py-2.5 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'conversor_bancario'
              ? 'border-amber-500 text-amber-500 bg-amber-50/50 dark:bg-amber-955/20 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
          }`}
        >
          <FileSpreadsheet size={16} />
          Conversor PDF a Excel (Estados de Cuenta)
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'conversor_bancario' && <ConversorEstadoCuenta />}
      </div>
    </div>
  );
}
