'use client';

import React from 'react';
import { Key, CheckSquare, Square } from 'lucide-react';
import { Perfil, Sucursal, Empresa } from '../../../../lib/modules/staff/types/staff.types';

interface StaffCreationFormProps {
  nuevoStaff: {
    nombre: string;
    email: string;
    password: string;
  };
  setNuevoStaff: React.Dispatch<React.SetStateAction<{
    nombre: string;
    email: string;
    password: string;
  }>>;
  selectedPerfilId: string;
  setSelectedPerfilId: (id: string) => void;
  perfiles: Perfil[];
  sucursales: Sucursal[];
  selectedSucursales: string[];
  toggleSucursalSeleccionada: (id: string) => void;
  empresas: Empresa[];
  selectedEmpresas: string[];
  toggleEmpresaSeleccionada: (id: string) => void;
  guardandoUsuario: boolean;
  handleCrearUsuario: (e: React.FormEvent) => Promise<void>;
}

export function StaffCreationForm({
  nuevoStaff,
  setNuevoStaff,
  selectedPerfilId,
  setSelectedPerfilId,
  perfiles,
  sucursales,
  selectedSucursales,
  toggleSucursalSeleccionada,
  empresas,
  selectedEmpresas,
  toggleEmpresaSeleccionada,
  guardandoUsuario,
  handleCrearUsuario
}: StaffCreationFormProps) {
  return (
    <form onSubmit={handleCrearUsuario} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 font-sans space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre Completo *</label>
          <input
            type="text"
            placeholder="Ej. Juan Pérez"
            required
            value={nuevoStaff.nombre}
            className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
            onChange={e => setNuevoStaff(prev => ({ ...prev, nombre: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Correo Electrónico *</label>
          <input
            type="email"
            placeholder="correo@empresa.com"
            required
            value={nuevoStaff.email}
            className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white font-mono"
            onChange={e => setNuevoStaff(prev => ({ ...prev, email: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Contraseña Temporal *</label>
          <input
            type="password"
            placeholder="Contraseña temporal"
            required
            value={nuevoStaff.password}
            className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
            onChange={e => setNuevoStaff(prev => ({ ...prev, password: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Perfil Asignado *</label>
          <select
            value={selectedPerfilId}
            required
            className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
            onChange={e => setSelectedPerfilId(e.target.value)}
          >
            <option value="">Seleccionar perfil...</option>
            {perfiles.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Selector Multi-Sucursal */}
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Sucursales Permitidas *</label>
        <div className="grid grid-cols-2 gap-2 bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 max-h-36 overflow-y-auto">
          {sucursales.map(suc => (
            <button
              key={suc.id}
              type="button"
              onClick={() => toggleSucursalSeleccionada(suc.id)}
              className="flex items-center gap-1.5 text-xs text-left hover:text-amber-500 transition-colors"
            >
              {selectedSucursales.includes(suc.id) ? (
                <CheckSquare size={14} className="text-amber-500 shrink-0" />
              ) : (
                <Square size={14} className="shrink-0" />
              )}
              <span className="truncate">{suc.nombre}</span>
            </button>
          ))}
          {sucursales.length === 0 && (
            <span className="text-[10px] text-gray-400 italic col-span-2">No hay sucursales registradas</span>
          )}
        </div>
      </div>

      {/* Selector Multi-Empresa */}
      {empresas.length > 1 && (
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Empresas Permitidas (Opcional)</label>
          <div className="grid grid-cols-2 gap-2 bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 max-h-36 overflow-y-auto">
            {empresas.map(emp => (
              <button
                key={emp.id}
                type="button"
                onClick={() => toggleEmpresaSeleccionada(emp.id)}
                className="flex items-center gap-1.5 text-xs text-left hover:text-amber-500 transition-colors"
              >
                {selectedEmpresas.includes(emp.id) ? (
                  <CheckSquare size={14} className="text-amber-500 shrink-0" />
                ) : (
                  <Square size={14} className="shrink-0" />
                )}
                <span className="truncate">{emp.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={guardandoUsuario}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm h-9"
      >
        <Key size={14} /> {guardandoUsuario ? 'Registrando Auth...' : 'Crear Usuario de Staff'}
      </button>
    </form>
  );
}
