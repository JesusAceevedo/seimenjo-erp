'use client';

import React from 'react';
import { Users, Save } from 'lucide-react';
import { ClienteFormData } from '../../../../lib/modules/clientes/types/cliente.types';
import {
  CATALOGO_REGIMEN_FISCAL,
  CATALOGO_USO_CFDI,
  getDescripcionRegimenFiscal,
  getDescripcionUsoCfdi
} from '../../../../lib/sat-catalogs';

interface ClienteFormModalProps {
  open: boolean;
  isEditing?: boolean;
  formData: ClienteFormData;
  setFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  loading: boolean;
  error?: string;
}

export function ClienteFormModal({
  open,
  isEditing = false,
  formData,
  setFormData,
  onSubmit,
  onClose,
  loading,
  error
}: ClienteFormModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100">
        <h3 className="text-xl font-extrabold mb-6 flex items-center gap-2">
          <Users className="text-amber-500" />
          {isEditing ? 'Editar Cliente SAT (CFDI 4.0)' : 'Alta Fiscal de Cliente (CFDI 4.0)'}
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Nombre Comercial / Local *
              </label>
              <input
                type="text"
                placeholder="Ej. Sakura Ramen"
                value={formData.nombre_local || ''}
                className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white"
                onChange={e => setFormData({ ...formData, nombre_local: e.target.value })}
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                RFC *
              </label>
              <input
                type="text"
                placeholder="Ej. XAXX010101000"
                value={formData.rfc || ''}
                className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white uppercase"
                onChange={e => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })}
                disabled={loading || formData.facturar_publico_general}
                required={!formData.facturar_publico_general}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Razón Social (SAT)
            </label>
            <input
              type="text"
              placeholder="Ej. Sakura Ramen S.A. de C.V."
              value={formData.razon_social || ''}
              className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white"
              onChange={e => setFormData({ ...formData, razon_social: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Régimen Fiscal
              </label>
              <select
                value={formData.regimen_fiscal || ''}
                className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white"
                onChange={e => setFormData({ ...formData, regimen_fiscal: e.target.value })}
                disabled={loading}
              >
                <option value="">Seleccionar Régimen Fiscal...</option>
                {CATALOGO_REGIMEN_FISCAL.map(r => (
                  <option key={r.clave} value={r.clave}>
                    {r.clave} - {r.descripcion}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Uso de CFDI
              </label>
              <select
                value={formData.uso_cfdi || ''}
                className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white"
                onChange={e => setFormData({ ...formData, uso_cfdi: e.target.value })}
                disabled={loading}
              >
                <option value="">Seleccionar Uso de CFDI...</option>
                {CATALOGO_USO_CFDI.map(u => (
                  <option key={u.clave} value={u.clave}>
                    {u.clave} - {u.descripcion}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Código Postal Fiscal
              </label>
              <input
                type="text"
                placeholder="Ej. 77710"
                value={formData.codigo_postal || ''}
                className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white"
                onChange={e => setFormData({ ...formData, codigo_postal: e.target.value })}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Teléfono de Contacto
              </label>
              <input
                type="text"
                placeholder="Ej. 9841234567"
                value={formData.telefono || ''}
                className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white"
                onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Correo de Facturación
            </label>
            <input
              type="email"
              placeholder="Ej. facturas@sakura.com"
              value={formData.email_facturacion || ''}
              className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-sm text-gray-900 dark:text-white"
              onChange={e => setFormData({ ...formData, email_facturacion: e.target.value })}
              disabled={loading}
            />
          </div>

          {/* Toggle Facturar a Público en General */}
          <div className="p-3 bg-amber-500/10 dark:bg-amber-500/5 rounded-xl border border-amber-500/20 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-900 dark:text-white block">
                Facturar en Global / Público en General
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Asigna automáticamente el RFC XAXX010101000 al emitir facturas
              </span>
            </div>
            <input
              type="checkbox"
              checked={Boolean(formData.facturar_publico_general)}
              onChange={e => {
                const checked = e.target.checked;
                setFormData({
                  ...formData,
                  facturar_publico_general: checked,
                  rfc: checked ? 'XAXX010101000' : formData.rfc
                });
              }}
              className="h-4 w-4 text-amber-600 rounded focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 font-semibold border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={16} />
              {loading ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Registrar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
