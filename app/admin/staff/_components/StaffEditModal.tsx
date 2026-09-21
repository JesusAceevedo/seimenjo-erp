'use client';

import React from 'react';
import { UserCheck, CheckSquare, Square } from 'lucide-react';
import { UsuarioStaff, Perfil, Sucursal, Empresa } from '../../../../lib/modules/staff/types/staff.types';

interface StaffEditModalProps {
  editingStaff: UsuarioStaff | null;
  setEditingStaff: (staff: UsuarioStaff | null) => void;
  empresaId: string | null;
  perfiles: Perfil[];
  editPerfilId: string;
  setEditPerfilId: (id: string) => void;
  sucursales: Sucursal[];
  editSucursales: string[];
  setEditSucursales: React.Dispatch<React.SetStateAction<string[]>>;
  empresas: Empresa[];
  editEmpresas: string[];
  setEditEmpresas: React.Dispatch<React.SetStateAction<string[]>>;
  actualizandoUsuario: boolean;
  handleActualizarUsuario: (e: React.FormEvent) => Promise<void>;
}

export function StaffEditModal({
  editingStaff,
  setEditingStaff,
  empresaId,
  perfiles,
  editPerfilId,
  setEditPerfilId,
  sucursales,
  editSucursales,
  setEditSucursales,
  empresas,
  editEmpresas,
  setEditEmpresas,
  actualizandoUsuario,
  handleActualizarUsuario
}: StaffEditModalProps) {
  if (!editingStaff) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-gray-150 dark:border-gray-850">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UserCheck className="text-amber-500" size={18} /> Editar Usuario Administrador
          </h3>
          <button
            type="button"
            onClick={() => setEditingStaff(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-bold font-sans"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleActualizarUsuario} className="space-y-4 font-sans text-xs">
          <div>
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase block mb-1">
              Nombre Completo
            </label>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">
              {editingStaff.id === empresaId ? 'Administrador Creador' : (editingStaff.correo as string).split('@')[0]}
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase block mb-1">
              Correo Electrónico
            </label>
            <p className="font-mono text-gray-600 dark:text-gray-400 text-xs">{editingStaff.correo}</p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase block mb-1">
              Perfil Asignado *
            </label>
            <select
              value={editPerfilId}
              required
              className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-gray-950 dark:text-white outline-none"
              onChange={e => setEditPerfilId(e.target.value)}
            >
              <option value="">Seleccionar perfil...</option>
              {perfiles.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          {/* Selector Multi-Sucursal */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase block mb-2">
              Sucursales Permitidas *
            </label>
            <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800 max-h-32 overflow-y-auto">
              {sucursales.map(suc => (
                <button
                  key={suc.id}
                  type="button"
                  onClick={() => {
                    setEditSucursales(prev =>
                      prev.includes(suc.id) ? prev.filter(id => id !== suc.id) : [...prev, suc.id]
                    );
                  }}
                  className="flex items-center gap-1.5 text-xs text-left hover:text-amber-500 transition-colors"
                >
                  {editSucursales.includes(suc.id) ? (
                    <CheckSquare size={14} className="text-amber-500 shrink-0" />
                  ) : (
                    <Square size={14} className="shrink-0" />
                  )}
                  <span className="truncate">{suc.nombre}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selector Multi-Empresa */}
          {empresas.length > 1 && (
            <div>
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase block mb-2">
                Empresas Permitidas (Opcional)
              </label>
              <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800 max-h-32 overflow-y-auto">
                {empresas.map(emp => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setEditEmpresas(prev =>
                        prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                      );
                    }}
                    className="flex items-center gap-1.5 text-xs text-left hover:text-amber-500 transition-colors"
                  >
                    {editEmpresas.includes(emp.id) ? (
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

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-150 dark:border-gray-850">
            <button
              type="button"
              onClick={() => setEditingStaff(null)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={actualizandoUsuario}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-bold transition-all shadow-sm"
            >
              {actualizandoUsuario ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
