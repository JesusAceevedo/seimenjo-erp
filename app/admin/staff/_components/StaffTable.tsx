'use client';

import React from 'react';
import { UsuarioStaff } from '../../../../lib/modules/staff/types/staff.types';

interface StaffTableProps {
  usuariosStaff: UsuarioStaff[];
  empresaId: string | null;
  handleToggleActivo: (id: string, activoActual: boolean) => Promise<void>;
  startEditingStaff: (staff: UsuarioStaff) => void;
}

export function StaffTable({
  usuariosStaff,
  empresaId,
  handleToggleActivo,
  startEditingStaff
}: StaffTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
            <th className="p-3">Nombre</th>
            <th className="p-3">Correo</th>
            <th className="p-3">Perfil</th>
            <th className="p-3 text-center">Estatus</th>
            <th className="p-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
          {usuariosStaff.map(st => (
            <tr key={st.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
              <td className="p-3 font-semibold text-gray-800 dark:text-gray-200">
                {st.id === empresaId ? 'Administrador Creador' : (st.correo.split('@')[0])}
              </td>
              <td className="p-3 font-mono text-[11px] text-gray-600 dark:text-gray-400">
                {st.correo}
              </td>
              <td className="p-3 font-medium text-gray-700 dark:text-gray-300">
                {st.perfiles_seguridad?.nombre || (st.es_superusuario ? '★ Superusuario' : 'Sin perfil')}
              </td>
              <td className="p-3 text-center">
                {st.activo ? (
                  <button
                    type="button"
                    onClick={() => handleToggleActivo(st.id, st.activo)}
                    className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all cursor-pointer"
                    title="Clic para inhabilitar"
                  >
                    Activo
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleActivo(st.id, st.activo)}
                    className="bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-emerald-500/10 hover:text-emerald-500 transition-all cursor-pointer"
                    title="Clic para habilitar"
                  >
                    Inactivo
                  </button>
                )}
              </td>
              <td className="p-3 text-right">
                <button
                  type="button"
                  onClick={() => startEditingStaff(st)}
                  className="text-amber-600 hover:text-amber-500 font-bold hover:underline"
                >
                  Editar
                </button>
              </td>
            </tr>
          ))}
          {usuariosStaff.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center text-gray-400 italic">
                No hay operadores registrados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
