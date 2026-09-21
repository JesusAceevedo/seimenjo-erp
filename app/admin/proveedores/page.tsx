'use client';

import React from 'react';
import ProveedoresTab from '../_components/ProveedoresTab';
import { useThemeMode } from '../../../lib/useThemeMode';
import { useProveedores } from '../../../lib/modules/proveedores/hooks/useProveedores';

export default function ProveedoresPage() {
  const { isDarkMode } = useThemeMode();
  const {
    proveedores,
    busquedaProveedor,
    setBusquedaProveedor,
    selectedProveedor,
    proveedorFacturas,
    cargandoFacturasProveedor,
    proveedorModal,
    setProveedorModal,
    cargarDetallesProveedor,
    handleSaveProveedor,
    handleDeleteProveedor,
    handleDownloadFile,
    fetchProveedores
  } = useProveedores();

  return (
    <div className={`flex flex-col h-full font-sans ${isDarkMode ? 'dark' : ''}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <h1 className="text-lg font-black text-gray-900 dark:text-white">Proveedores</h1>
          <p className="text-xs text-gray-400 mt-0.5">Gestión de proveedores, datos bancarios e historial de facturas</p>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white dark:bg-gray-950">
        <ProveedoresTab
          proveedores={proveedores}
          busquedaProveedor={busquedaProveedor}
          setBusquedaProveedor={setBusquedaProveedor}
          selectedProveedor={selectedProveedor}
          proveedorFacturas={proveedorFacturas}
          cargandoFacturasProveedor={cargandoFacturasProveedor}
          proveedorModal={proveedorModal as any}
          setProveedorModal={setProveedorModal as any}
          cargarDetallesProveedor={cargarDetallesProveedor}
          handleSaveProveedor={handleSaveProveedor}
          handleDeleteProveedor={handleDeleteProveedor}
          onDownloadFile={handleDownloadFile}
          onReloadProveedores={fetchProveedores}
        />
      </div>
    </div>
  );
}

