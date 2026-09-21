'use client';

import React from 'react';
import { Users, Building, Sun, Moon, UserCheck } from 'lucide-react';
import { useThemeMode } from '../../../lib/useThemeMode';
import { useStaff } from '../../../lib/modules/staff/hooks/useStaff';
import { PerfilesSection } from './_components/PerfilesSection';
import { StaffCreationForm } from './_components/StaffCreationForm';
import { StaffTable } from './_components/StaffTable';
import { StaffEditModal } from './_components/StaffEditModal';

export default function StaffPage() {
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const {
    empresaId,
    esSuperusuario,
    loading,
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    perfiles,
    sucursales,
    usuariosStaff,

    // Perfil
    nuevoPerfilNombre,
    setNuevoPerfilNombre,
    permisosPerfil,
    togglePermiso,
    handleCrearPerfil,
    handleEliminarPerfil,

    // Crear Staff
    nuevoStaff,
    setNuevoStaff,
    selectedPerfilId,
    setSelectedPerfilId,
    selectedSucursales,
    toggleSucursalSeleccionada,
    selectedEmpresas,
    toggleEmpresaSeleccionada,
    guardandoUsuario,
    handleCrearUsuario,

    // Editar Staff
    editingStaff,
    setEditingStaff,
    editPerfilId,
    setEditPerfilId,
    editSucursales,
    setEditSucursales,
    editEmpresas,
    setEditEmpresas,
    actualizandoUsuario,
    startEditingStaff,
    handleActualizarUsuario,

    // Acciones
    handleToggleActivo
  } = useStaff();

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full`}>
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors p-8 flex flex-col w-full max-w-[100vw]">
        
        {/* HEADER */}
        <div className="mb-8 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3">
              <Users className="text-amber-500 w-8 h-8" /> Ventana 5: Control de Personal y Roles
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Configura roles de seguridad JSONB y da de alta cuentas internas de operadores asignadas a sucursales.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {esSuperusuario && empresas.length > 0 && (
              <div className="flex items-center gap-2 bg-white dark:bg-gray-950 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-sans font-semibold">
                <Building size={14} className="text-amber-500" />
                <span>Empresa Inquilina:</span>
                <select
                  value={selectedEmpresaId}
                  className="bg-transparent text-gray-950 dark:text-white outline-none border-none cursor-pointer"
                  onChange={e => setSelectedEmpresaId(e.target.value)}
                >
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-amber-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
              aria-label="Alternar modo oscuro"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center italic text-gray-500">
            Cargando personal y roles...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 items-start">
            
            {/* IZQUIERDA: PERFILES / ROLES (Permisos JSONB) */}
            <PerfilesSection
              nuevoPerfilNombre={nuevoPerfilNombre}
              setNuevoPerfilNombre={setNuevoPerfilNombre}
              permisosPerfil={permisosPerfil}
              togglePermiso={togglePermiso}
              handleCrearPerfil={handleCrearPerfil}
              perfiles={perfiles}
              handleEliminarPerfil={handleEliminarPerfil}
            />

            {/* DERECHA: USUARIOS STAFF */}
            <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UserCheck className="text-amber-500" size={20} /> Crear Usuario Interno (Staff)
              </h3>

              <StaffCreationForm
                nuevoStaff={nuevoStaff}
                setNuevoStaff={setNuevoStaff}
                selectedPerfilId={selectedPerfilId}
                setSelectedPerfilId={setSelectedPerfilId}
                perfiles={perfiles}
                sucursales={sucursales}
                selectedSucursales={selectedSucursales}
                toggleSucursalSeleccionada={toggleSucursalSeleccionada}
                empresas={empresas}
                selectedEmpresas={selectedEmpresas}
                toggleEmpresaSeleccionada={toggleEmpresaSeleccionada}
                guardandoUsuario={guardandoUsuario}
                handleCrearUsuario={handleCrearUsuario}
              />

              <StaffTable
                usuariosStaff={usuariosStaff}
                empresaId={empresaId}
                handleToggleActivo={handleToggleActivo}
                startEditingStaff={startEditingStaff}
              />
            </div>

          </div>
        )}

        {/* MODAL DE EDICIÓN DE STAFF */}
        <StaffEditModal
          editingStaff={editingStaff}
          setEditingStaff={setEditingStaff}
          empresaId={empresaId}
          perfiles={perfiles}
          editPerfilId={editPerfilId}
          setEditPerfilId={setEditPerfilId}
          sucursales={sucursales}
          editSucursales={editSucursales}
          setEditSucursales={setEditSucursales}
          empresas={empresas}
          editEmpresas={editEmpresas}
          setEditEmpresas={setEditEmpresas}
          actualizandoUsuario={actualizandoUsuario}
          handleActualizarUsuario={handleActualizarUsuario}
        />

      </div>
    </div>
  );
}
