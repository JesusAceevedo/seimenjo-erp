'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { X, Link as LinkIcon, FileCode, Search, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { obtenerFacturasClientesSinVincular, vincularFacturaAPedido } from '../actions';

interface VincularXmlPedidoModalProps {
  pedidoId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VincularXmlPedidoModal({
  pedidoId,
  onClose,
  onSuccess
}: VincularXmlPedidoModalProps) {
  const getSessionToken = useSessionToken();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [facturasSinVincular, setFacturasSinVincular] = useState<any[]>([]);
  const [selectedFacturaId, setSelectedFacturaId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchFacturas = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await obtenerFacturasClientesSinVincular(token);
      if (res.success && res.data) {
        setFacturasSinVincular(res.data);
      } else {
        setError(res.error || 'No se pudieron cargar las facturas sueltas.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar facturas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacturas();
  }, []);

  const handleVincular = async () => {
    if (!selectedFacturaId) return;

    setSaving(true);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await vincularFacturaAPedido(selectedFacturaId, pedidoId, token);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Error al vincular la factura.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al vincular.');
    } finally {
      setSaving(false);
    }
  };

  const filtradas = facturasSinVincular.filter((f) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (f.serie_folio && f.serie_folio.toLowerCase().includes(q)) ||
      (f.uuid_fiscal && f.uuid_fiscal.toLowerCase().includes(q)) ||
      (f.clientes?.nombre_local && f.clientes.nombre_local.toLowerCase().includes(q)) ||
      (f.clientes?.rfc && f.clientes.rfc.toLowerCase().includes(q)) ||
      f.total?.toString().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-900 bg-gray-50/60 dark:bg-gray-900/30">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <LinkIcon className="text-blue-500" /> Vincular Factura XML a Pedido
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Selecciona una factura subida mediante Carga Masiva para vincularla a este pedido.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-900 bg-gray-50/30 dark:bg-gray-900/10">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar factura por Folio, UUID, Cliente o RFC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <RefreshCw className="animate-spin text-blue-500" size={24} />
              <span className="text-xs">Cargando facturas sin vincular...</span>
            </div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <FileCode size={36} className="mx-auto text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-semibold">No se encontraron facturas masivas pendientes por vincular.</p>
              <p className="text-xs text-gray-400">Si aún no has subido el XML, puedes cargarlo en la opción "Subir Masivo (XML)".</p>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                Facturas sueltas encontradas ({filtradas.length})
              </span>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filtradas.map((f) => {
                  const isSelected = selectedFacturaId === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFacturaId(f.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900 dark:text-white font-mono">
                            Folio: {f.serie_folio || 'SF'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]" title={f.uuid_fiscal}>
                            UUID: {f.uuid_fiscal}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                          <span className="font-medium truncate max-w-[220px]">
                            {f.clientes?.nombre_local || 'Cliente Desconocido'}
                          </span>
                          {f.clientes?.rfc && <span className="font-mono text-[10px] text-gray-400">({f.clientes.rfc})</span>}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-sm font-mono text-blue-600 dark:text-blue-400">
                          {formatCurrency(f.total)}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-MX') : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/20 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleVincular}
            disabled={!selectedFacturaId || saving}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Vinculando...</>
            ) : (
              <>Vincular Factura Seleccionada</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
