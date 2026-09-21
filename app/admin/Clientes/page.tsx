'use client';

import React from 'react';
import { Plus, Search, Sun, Moon, Users } from 'lucide-react';
import { useThemeMode } from '../../../lib/useThemeMode';
import { useClientes } from '../../../lib/modules/clientes/hooks/useClientes';
import { ClientesTable } from './_components/ClientesTable';
import { ClienteFormModal } from './_components/ClienteFormModal';
import { ClientePortalModal } from './_components/ClientePortalModal';

export default function ClientesPage() {
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const {
    loading,
    clientesFiltrados,
    paginatedClientes,
    busquedaCliente,
    setBusquedaCliente,
    pageClientes,
    setPageClientes,
    pageSizeClientes,

    // Modal Crear
    isClienteModalOpen,
    setIsClienteModalOpen,
    nuevoCliente,
    setNuevoCliente,
    isLoadingCliente,
    errorClienteModal,
    handleCrearCliente,

    // Modal Editar
    editarClienteModal,
    setEditarClienteModal,
    isLoadingEditarCliente,
    errorEditarClienteModal,
    handleActualizarCliente,

    // Eliminar
    handleEliminarCliente,

    // Modal Portal
    portalModal,
    setPortalModal,
    habilitandoPortal,
    abrirModalPortal,
    handleHabilitarPortal
  } = useClientes();

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-full overflow-hidden flex flex-col font-sans`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex overflow-hidden">
        
        {/* ÁREA PRINCIPAL */}
        <main className="flex-1 flex flex-col p-8 w-full max-w-[100vw] overflow-hidden h-full">
          
          {/* HEADER */}
          <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
            <div>
              <h2 className="text-3xl font-extrabold flex items-center gap-3">
                <Users className="text-amber-500 w-8 h-8" /> Catálogo de Clientes
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
                Administración de clientes B2B, datos fiscales CFDI 4.0 y credenciales de acceso al portal.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-amber-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                aria-label="Cambiar modo de color"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={() => setIsClienteModalOpen(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-semibold shadow-lg transition-colors text-sm"
              >
                <Plus size={18} /> Registrar Cliente SAT
              </button>
            </div>
          </div>

          {/* BUSCADOR */}
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-3.5 rounded-xl shadow-md mb-6 flex gap-4 items-center shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar clientes por nombre comercial, razón social o RFC..."
                value={busquedaCliente}
                onChange={e => {
                  setBusquedaCliente(e.target.value);
                  setPageClientes(0);
                }}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          {/* TABLA MODULAR DE CLIENTES */}
          <ClientesTable
            clientes={paginatedClientes}
            page={pageClientes}
            pageSize={pageSizeClientes}
            totalClientes={clientesFiltrados.length}
            onPageChange={setPageClientes}
            onEdit={cliente => setEditarClienteModal({ open: true, cliente })}
            onDelete={handleEliminarCliente}
            onOpenPortal={abrirModalPortal}
            loading={loading}
          />
        </main>

        {/* MODAL: REGISTRAR CLIENTE */}
        <ClienteFormModal
          open={isClienteModalOpen}
          isEditing={false}
          formData={nuevoCliente}
          setFormData={setNuevoCliente}
          onSubmit={handleCrearCliente}
          onClose={() => setIsClienteModalOpen(false)}
          loading={isLoadingCliente}
          error={errorClienteModal}
        />

        {/* MODAL: EDITAR CLIENTE */}
        <ClienteFormModal
          open={editarClienteModal.open}
          isEditing={true}
          formData={(editarClienteModal.cliente as any) || {}}
          setFormData={data => setEditarClienteModal(prev => ({ ...prev, cliente: data }))}
          onSubmit={handleActualizarCliente}
          onClose={() => setEditarClienteModal({ open: false, cliente: null })}
          loading={isLoadingEditarCliente}
          error={errorEditarClienteModal}
        />

        {/* MODAL: HABILITAR PORTAL B2B */}
        <ClientePortalModal
          portalModal={portalModal}
          setPortalModal={setPortalModal}
          onSubmit={handleHabilitarPortal}
          loading={habilitandoPortal}
        />
      </div>
    </div>
  );
}
