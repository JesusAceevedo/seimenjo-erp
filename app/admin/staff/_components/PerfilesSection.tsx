'use client';

import React from 'react';
import { Shield, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { Perfil, PermisosModulo } from '../../../../lib/modules/staff/types/staff.types';

interface PerfilesSectionProps {
  nuevoPerfilNombre: string;
  setNuevoPerfilNombre: (nombre: string) => void;
  permisosPerfil: Record<string, PermisosModulo>;
  togglePermiso: (modulo: string, accion: 'read' | 'write') => void;
  handleCrearPerfil: () => void;
  perfiles: Perfil[];
  handleEliminarPerfil: (id: string) => void;
}

const MODULOS_LABEL: Record<string, string> = {
  ventas: 'Pedidos',
  clientes: 'Clientes',
  productos: 'Productos',
  inventario: 'Inventario',
  gastos: 'Egresos',
  contabilidad: 'Contabilidad',
  conciliacion: 'Conciliación Bancaria',
  expediente: 'Expediente',
  proveedores: 'Proveedores',
  personal: 'Personal (Staff)',
  asistencia: 'Asistencia y Nóminas',
  configuracion: 'Configuración'
};

export function PerfilesSection({
  nuevoPerfilNombre,
  setNuevoPerfilNombre,
  permisosPerfil,
  togglePermiso,
  handleCrearPerfil,
  perfiles,
  handleEliminarPerfil
}: PerfilesSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <Shield className="text-amber-500" size={20} /> Mapeo de Perfiles y Accesos
      </h3>

      {/* Formulario Perfil */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 font-sans space-y-4">
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre del Perfil / Rol *</label>
          <input
            type="text"
            placeholder="Ej. Cajero Principal"
            value={nuevoPerfilNombre}
            className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
            onChange={e => setNuevoPerfilNombre(e.target.value)}
          />
        </div>

        {/* Grid de Permisos Módulos */}
        <div>
          <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">
            Asignación de Permisos del Módulo
          </label>
          <div className="space-y-3 bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
            {Object.keys(MODULOS_LABEL).map(mod => (
              <div key={mod} className="flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {MODULOS_LABEL[mod]}
                </span>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => togglePermiso(mod, 'read')}
                    className="flex items-center gap-1 hover:text-amber-500 transition-colors"
                  >
                    {(permisosPerfil[mod] || { read: false }).read ? (
                      <CheckSquare size={14} className="text-emerald-500" />
                    ) : (
                      <Square size={14} />
                    )}
                    Ver (Lectura)
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePermiso(mod, 'write')}
                    className="flex items-center gap-1 hover:text-amber-500 transition-colors"
                  >
                    {(permisosPerfil[mod] || { write: false }).write ? (
                      <CheckSquare size={14} className="text-emerald-500" />
                    ) : (
                      <Square size={14} />
                    )}
                    Gestionar (Escritura)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCrearPerfil}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm h-9"
        >
          <Plus size={14} /> Guardar Perfil de Seguridad
        </button>
      </div>

      {/* Tabla de Perfiles */}
      <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
              <th className="p-3">Perfil</th>
              <th className="p-3">Permisos de Módulos (Lectura/Escritura)</th>
              <th className="p-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
            {perfiles.map(perf => (
              <tr key={perf.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                <td className="p-3 font-semibold text-gray-800 dark:text-gray-200">{perf.nombre}</td>
                <td className="p-3 text-[10px] space-y-0.5">
                  {Object.entries(perf.permisos || {}).map(([mod, rules]: [string, any]) => (
                    <div key={mod}>
                      <span className="font-bold text-gray-500 uppercase">
                        {MODULOS_LABEL[mod] || mod}:
                      </span>{' '}
                      <span className="text-gray-400">
                        {rules.read ? 'Lectura' : ''}
                        {rules.read && rules.write ? ' + ' : ''}
                        {rules.write ? 'Escritura' : ''}
                        {!rules.read && !rules.write ? 'Ninguno' : ''}
                      </span>
                    </div>
                  ))}
                </td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleEliminarPerfil(perf.id)}
                    className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                    title="Eliminar perfil"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
