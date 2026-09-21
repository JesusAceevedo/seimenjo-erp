'use client';

import React from 'react';
import { Key } from 'lucide-react';
import { PortalModalState } from '../../../../lib/modules/clientes/types/cliente.types';

interface ClientePortalModalProps {
  portalModal: PortalModalState;
  setPortalModal: React.Dispatch<React.SetStateAction<PortalModalState>>;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export function ClientePortalModal({
  portalModal,
  setPortalModal,
  onSubmit,
  loading
}: ClientePortalModalProps) {
  if (!portalModal.open || !portalModal.cliente) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-md shadow-2xl text-gray-900 dark:text-gray-100">
        <h3 className="text-xl font-extrabold mb-2 flex items-center gap-2">
          <Key className="text-amber-500" /> Habilitar Portal B2B
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Crea las credenciales de acceso a la tienda para{' '}
          <strong className="text-amber-600 dark:text-amber-500">{portalModal.cliente.nombre_local}</strong>.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Correo Electrónico *
            </label>
            <input
              type="email"
              value={portalModal.email}
              onChange={e => setPortalModal({ ...portalModal, email: e.target.value })}
              className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Contraseña de Acceso (mínimo 6 caracteres) *
            </label>
            <input
              type="password"
              value={portalModal.password}
              onChange={e => setPortalModal({ ...portalModal, password: e.target.value })}
              className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white"
              required
              minLength={6}
              disabled={loading}
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setPortalModal({ open: false, cliente: null, email: '', password: '' })}
              disabled={loading}
              className="flex-1 py-2.5 font-semibold border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg transition-colors text-sm disabled:opacity-50"
            >
              {loading ? 'Habilitando...' : 'Crear Acceso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
