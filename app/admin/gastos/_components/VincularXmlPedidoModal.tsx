'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { X, Link as LinkIcon, FileCode, Search, RefreshCw, AlertTriangle, CheckCircle, Mail, Check, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../../lib/formatters';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { supabase } from '../../../../lib/supabase';
import { obtenerFacturasClientesSinVincular, vincularFacturaAPedido, enviarFacturaPorCorreo } from '../actions';

interface VincularXmlPedidoModalProps {
  pedidoId: string;
  pedidoData?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VincularXmlPedidoModal({
  pedidoId,
  pedidoData,
  onClose,
  onSuccess
}: VincularXmlPedidoModalProps) {
  const getSessionToken = useSessionToken();

  const [pedido, setPedido] = useState<any>(pedidoData || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [facturasSinVincular, setFacturasSinVincular] = useState<any[]>([]);
  const [selectedFacturaId, setSelectedFacturaId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviarPorCorreo, setEnviarPorCorreo] = useState(true);

  // 1. Cargar datos del pedido si no vinieron en props
  useEffect(() => {
    if (!pedido && pedidoId) {
      const fetchPedido = async () => {
        try {
          const { data, error: pErr } = await supabase
            .from('pedidos')
            .select('id, numero_pedido, precio_total, fecha_pedido, cliente_nombre, clientes(id, nombre_local, razon_social, rfc)')
            .eq('id', pedidoId)
            .maybeSingle();

          if (pErr) throw pErr;
          if (data) setPedido(data);
        } catch (e: any) {
          console.error('Error al cargar datos del pedido para vinculación:', e);
        }
      };
      fetchPedido();
    }
  }, [pedido, pedidoId]);

  // 2. Cargar facturas sueltas sin vincular
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

  // Monto del pedido a vincular
  const montoPedido = Number(pedido?.precio_total || 0);

  // 3. Procesar y ordenar inteligentemente las facturas
  const facturasConAnalisis = useMemo(() => {
    const q = search.trim().toLowerCase();

    return facturasSinVincular
      .filter((f) => {
        if (!q) return true;
        return (
          (f.serie_folio && f.serie_folio.toLowerCase().includes(q)) ||
          (f.uuid_fiscal && f.uuid_fiscal.toLowerCase().includes(q)) ||
          (f.clientes?.nombre_local && f.clientes.nombre_local.toLowerCase().includes(q)) ||
          (f.clientes?.razon_social && f.clientes.razon_social.toLowerCase().includes(q)) ||
          (f.clientes?.rfc && f.clientes.rfc.toLowerCase().includes(q)) ||
          f.total?.toString().includes(q)
        );
      })
      .map((f) => {
        const totalFactura = Number(f.total || 0);
        const diferencia = totalFactura - montoPedido;
        const esExacto = montoPedido > 0 && Math.abs(diferencia) <= 0.05;

        // Comprobación de coincidencia de cliente / RFC
        const rfcPedido = (pedido?.clientes?.rfc || '').trim().toUpperCase();
        const rfcFactura = (f.clientes?.rfc || '').trim().toUpperCase();
        const mismoRfc = Boolean(rfcPedido && rfcFactura && rfcPedido === rfcFactura);

        const idClientePedido = pedido?.clientes?.id || pedido?.cliente_id;
        const idClienteFactura = f.clientes?.id || f.cliente_id;
        const mismoCliente = Boolean(idClientePedido && idClienteFactura && idClientePedido === idClienteFactura);

        // Puntuación de afinidad para ordenar
        let score = 0;
        if (esExacto && (mismoRfc || mismoCliente)) {
          score = 100; // Coincidencia perfecta: monto exacto y mismo cliente
        } else if (esExacto) {
          score = 75; // Monto exacto
        } else if (mismoRfc || mismoCliente) {
          score = 50; // Mismo cliente
        }

        return {
          ...f,
          totalNum: totalFactura,
          diferencia,
          esExacto,
          mismoRfc,
          mismoCliente,
          score
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const dateA = new Date(a.fecha_emision || 0).getTime();
        const dateB = new Date(b.fecha_emision || 0).getTime();
        return dateB - dateA;
      });
  }, [facturasSinVincular, search, montoPedido, pedido]);

  // 4. Preseleccionar automáticamente la factura sugerida si hay coincidencia exacta
  useEffect(() => {
    if (!selectedFacturaId && facturasConAnalisis.length > 0) {
      const sugerida = facturasConAnalisis.find(f => f.score === 100) || facturasConAnalisis.find(f => f.esExacto);
      if (sugerida) {
        setSelectedFacturaId(sugerida.id);
      }
    }
  }, [facturasConAnalisis, selectedFacturaId]);

  const facturaSeleccionada = useMemo(() => {
    return facturasConAnalisis.find(f => f.id === selectedFacturaId) || null;
  }, [facturasConAnalisis, selectedFacturaId]);

  // 5. Vincular acción
  const handleVincular = async () => {
    if (!selectedFacturaId) return;

    setSaving(true);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await vincularFacturaAPedido(selectedFacturaId, pedidoId, token);
      if (res.success) {
        if (enviarPorCorreo) {
          try {
            await enviarFacturaPorCorreo(pedidoId, token);
          } catch (mailErr) {
            console.warn('Error al enviar correo tras vincular factura:', mailErr);
          }
        }
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

  const nombreClientePedido =
    pedido?.clientes?.nombre_local ||
    pedido?.clientes?.razon_social ||
    pedido?.cliente_nombre ||
    'Cliente Ocasional';
  const rfcClientePedido = pedido?.clientes?.rfc || null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 dark:border-gray-900 bg-gray-50/60 dark:bg-gray-900/30">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <LinkIcon className="text-blue-500" /> Vincular Factura XML a Pedido
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Selecciona una factura subida mediante Carga Masiva para vincularla a este pedido.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Tarjeta Informativa del Pedido a Vincular */}
        <div className="p-4 bg-blue-50/60 dark:bg-blue-950/25 border-b border-blue-100 dark:border-blue-900/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base shrink-0 shadow-inner">
                📦
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-sm text-gray-900 dark:text-white">
                    Pedido #{pedido?.numero_pedido || pedidoId.slice(0, 8)}
                  </span>
                  {pedido?.fecha_pedido && (
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                      • {formatDate(pedido.fecha_pedido)}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate max-w-sm">
                  {nombreClientePedido}
                  {rfcClientePedido && (
                    <span className="text-gray-400 font-mono ml-1.5 font-normal">({rfcClientePedido})</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                Importe del Pedido
              </span>
              <span className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
                {formatCurrency(montoPedido)}
              </span>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-900 bg-gray-50/30 dark:bg-gray-900/10">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar factura por Folio, UUID, Cliente o RFC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
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
          ) : facturasConAnalisis.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <FileCode size={36} className="mx-auto text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-semibold">No se encontraron facturas masivas pendientes por vincular.</p>
              <p className="text-xs text-gray-400">Si aún no has subido el XML, puedes cargarlo en la opción "Subir Masivo (XML)".</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                  Facturas sueltas encontradas ({facturasConAnalisis.length})
                </span>
                {facturasConAnalisis.some(f => f.esExacto) && (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle size={13} /> Coincidencia de monto exacto detectada
                  </span>
                )}
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {facturasConAnalisis.map((f) => {
                  const isSelected = selectedFacturaId === f.id;

                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedFacturaId(f.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? f.esExacto
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                            : 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                          : f.esExacto
                          ? 'bg-emerald-50/25 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400 hover:bg-emerald-50/40'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="font-bold text-xs text-gray-900 dark:text-white font-mono">
                            Folio: {f.serie_folio || 'SF'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono truncate max-w-[180px]" title={f.uuid_fiscal}>
                            UUID: {f.uuid_fiscal}
                          </span>

                          {/* BADGES INTELIGENTES */}
                          {f.esExacto && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1 shadow-2xs">
                              <Check size={11} strokeWidth={3} /> Monto Exacto
                            </span>
                          )}
                          {f.mismoRfc && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                              👤 Mismo RFC
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                          <span className="font-medium truncate max-w-[220px]">
                            {f.clientes?.nombre_local || f.clientes?.razon_social || 'Cliente Desconocido'}
                          </span>
                          {f.clientes?.rfc && <span className="font-mono text-[10px] text-gray-400">({f.clientes.rfc})</span>}
                        </div>
                      </div>

                      {/* Columna Importes y Diferencia */}
                      <div className="text-right shrink-0 space-y-0.5">
                        <div className={`font-extrabold text-sm font-mono ${
                          f.esExacto
                            ? 'text-emerald-600 dark:text-emerald-400 text-base'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {formatCurrency(f.totalNum)}
                        </div>

                        {montoPedido > 0 && !f.esExacto && (
                          <div className={`text-[10px] font-mono font-bold ${
                            f.diferencia > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'
                          }`}>
                            Dif: {f.diferencia > 0 ? `+${formatCurrency(f.diferencia)}` : `-${formatCurrency(Math.abs(f.diferencia))}`}
                          </div>
                        )}

                        <div className="text-[10px] text-gray-400 font-mono">
                          {f.fecha_emision ? formatDate(f.fecha_emision) : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Panel Comparativo Dinámico de la Factura Seleccionada */}
          {facturaSeleccionada && (
            <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
              facturaSeleccionada.esExacto
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                {facturaSeleccionada.esExacto ? (
                  <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <span>
                  {facturaSeleccionada.esExacto ? (
                    <>
                      <strong>Coincidencia Exacta:</strong> El importe de la factura seleccionada ({formatCurrency(facturaSeleccionada.totalNum)}) coincide al 100% con el pedido ({formatCurrency(montoPedido)}).
                    </>
                  ) : (
                    <>
                      <strong>Atención:</strong> Factura {formatCurrency(facturaSeleccionada.totalNum)} vs Pedido {formatCurrency(montoPedido)} (Diferencia de {facturaSeleccionada.diferencia > 0 ? `+${formatCurrency(facturaSeleccionada.diferencia)}` : `-${formatCurrency(Math.abs(facturaSeleccionada.diferencia))}`}).
                    </>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/20 flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={enviarPorCorreo}
              onChange={(e) => setEnviarPorCorreo(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
            />
            <Mail size={14} className="text-blue-500" />
            <span>Enviar factura por correo al cliente al vincular</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleVincular}
              disabled={!selectedFacturaId || saving}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
    </div>
  );
}
