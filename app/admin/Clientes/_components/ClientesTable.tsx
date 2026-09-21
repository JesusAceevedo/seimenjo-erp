'use client';

import React from 'react';
import { Edit3, Trash2, Key, ChevronLeft, ChevronRight } from 'lucide-react';
import { Cliente } from '../../../../lib/modules/clientes/types/cliente.types';
import {
  getDescripcionRegimenFiscal,
  getDescripcionUsoCfdi
} from '../../../../lib/sat-catalogs';

interface ClientesTableProps {
  clientes: Cliente[];
  page: number;
  pageSize: number;
  totalClientes: number;
  onPageChange: (newPage: number) => void;
  onEdit: (cliente: Cliente) => void;
  onDelete: (id: string) => void;
  onOpenPortal: (cliente: Cliente) => void;
  loading: boolean;
}

export function ClientesTable({
  clientes,
  page,
  pageSize,
  totalClientes,
  onPageChange,
  onEdit,
  onDelete,
  onOpenPortal,
  loading
}: ClientesTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalClientes / pageSize));

  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl flex flex-col flex-1 overflow-hidden">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              <th className="p-4">Nombre Comercial</th>
              <th className="p-4">Razón Social / RFC</th>
              <th className="p-4">Régimen Fiscal</th>
              <th className="p-4">Uso de CFDI</th>
              <th className="p-4">C.P. / Correo</th>
              <th className="p-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  <div className="flex justify-center items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500"></div>
                    <span>Cargando clientes...</span>
                  </div>
                </td>
              </tr>
            ) : clientes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  No se encontraron clientes registrados con los filtros aplicados.
                </td>
              </tr>
            ) : (
              clientes.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="p-4 font-bold text-amber-600 dark:text-amber-500">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{c.nombre_local}</span>
                      {c.facturar_publico_general && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-100 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40">
                          🌐 Público en General
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 space-y-0.5">
                    <div className="font-semibold text-gray-900 dark:text-white">{c.razon_social || 'N/A'}</div>
                    <div className="text-gray-400 font-mono text-[11px]">{c.rfc}</div>
                  </td>
                  <td className="p-4 font-medium text-gray-700 dark:text-gray-300">
                    {c.regimen_fiscal ? `${c.regimen_fiscal} - ${getDescripcionRegimenFiscal(c.regimen_fiscal)}` : 'No definido'}
                  </td>
                  <td className="p-4 font-medium text-gray-700 dark:text-gray-300">
                    {c.uso_cfdi ? `${c.uso_cfdi} - ${getDescripcionUsoCfdi(c.uso_cfdi)}` : 'No definido'}
                  </td>
                  <td className="p-4 space-y-0.5 text-gray-600 dark:text-gray-400">
                    <div>C.P: <span className="font-mono text-gray-900 dark:text-white">{c.codigo_postal || 'N/A'}</span></div>
                    <div className="text-[11px] truncate max-w-[180px]">{c.email_facturacion || 'Sin correo'}</div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onOpenPortal(c)}
                        title="Habilitar o cambiar acceso al Portal de Clientes"
                        className="p-1.5 rounded-lg border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                      >
                        <Key size={15} />
                      </button>
                      <button
                        onClick={() => onEdit(c)}
                        title="Editar datos fiscales"
                        className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        title="Eliminar cliente"
                        className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CONTROLES DE PAGINACIÓN */}
      <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <button
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 text-xs font-medium transition-colors"
        >
          <ChevronLeft size={14} /> Anterior
        </button>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Página {page + 1} de {totalPages} ({totalClientes} clientes)
        </span>
        <button
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 text-xs font-medium transition-colors"
        >
          Siguiente <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
