'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { X, Link as LinkIcon, FileCode, Search, RefreshCw, AlertTriangle, CheckCircle, Mail, Check, AlertCircle, Sparkles, Unlink } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../../lib/formatters';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { supabase } from '../../../../lib/supabase';
import { obtenerFacturasClientesSinVincular, vincularFacturaAPedido, desvincularFacturaDePedido, enviarFacturaPorCorreo } from '../actions';

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
  const [facturasDisponibles, setFacturasDisponibles] = useState<any[]>([]);
  const [selectedFacturaIds, setSelectedFacturaIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviarPorCorreo, setEnviarPorCorreo] = useState(false);
  const [actualizarEstatusPago, setActualizarEstatusPago] = useState(true);
  const [marcarFacturadoCompleto, setMarcarFacturadoCompleto] = useState(false);

  // 1. Cargar datos completos del pedido (incluyendo facturas ya vinculadas)
  const fetchPedido = async () => {
    if (!pedidoId) return;
    try {
      const { data, error: pErr } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, precio_total, fecha_pedido, cliente_nombre, estatus_pago, folio_factura, clientes(id, nombre_local, razon_social, rfc), facturas_clientes(*), facturas_clientes_pedidos(id, factura_id, monto_asignado, facturas_clientes(id, serie_folio, uuid_fiscal, total))')
        .eq('id', pedidoId)
        .maybeSingle();

      if (pErr) throw pErr;
      if (data) setPedido(data);
    } catch (e: any) {
      console.error('Error al cargar datos del pedido para vinculación:', e);
    }
  };

  useEffect(() => {
    fetchPedido();
  }, [pedidoId]);

  // 2. Cargar facturas sueltas o con saldo disponible
  const fetchFacturas = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await obtenerFacturasClientesSinVincular(token, true);
      if (res.success && res.data) {
        setFacturasDisponibles(res.data);
      } else {
        setError(res.error || 'No se pudieron cargar las facturas disponibles.');
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

  // Facturas que ya están vinculadas a este pedido
  const facturasYaVinculadas = useMemo(() => {
    const map = new Map<string, any>();
    (pedido?.facturas_clientes_pedidos || []).forEach((jl: any) => {
      const fc = Array.isArray(jl.facturas_clientes) ? jl.facturas_clientes[0] : jl.facturas_clientes;
      const fId = jl.factura_id || fc?.id;
      if (fId) {
        map.set(fId, {
          id: fId,
          serie_folio: fc?.serie_folio,
          uuid_fiscal: fc?.uuid_fiscal,
          total: Number(fc?.total || 0),
          monto_asignado: Number(jl.monto_asignado || fc?.total || 0),
        });
      }
    });
    (pedido?.facturas_clientes || []).forEach((fc: any) => {
      if (fc?.id && !map.has(fc.id)) {
        map.set(fc.id, {
          id: fc.id,
          serie_folio: fc.serie_folio,
          uuid_fiscal: fc.uuid_fiscal,
          total: Number(fc.total || 0),
          monto_asignado: Number(fc._monto_asignado || fc.total || 0),
        });
      }
    });
    return Array.from(map.values());
  }, [pedido]);

  const montoPedido = Number(pedido?.precio_total || 0);
  const montoYaCubierto = useMemo(() => {
    return facturasYaVinculadas.reduce((acc, f) => acc + Number(f.monto_asignado || 0), 0);
  }, [facturasYaVinculadas]);
  const saldoRestantePedido = Math.max(0, Math.round((montoPedido - montoYaCubierto) * 100) / 100);
  const metaMonto = saldoRestantePedido > 0 ? saldoRestantePedido : montoPedido;

  // 3. Procesar y ordenar inteligentemente las facturas candidatas (excluyendo las ya vinculadas a este pedido)
  const facturasConAnalisis = useMemo(() => {
    const q = search.trim().toLowerCase();
    const yaIds = new Set(facturasYaVinculadas.map(f => f.id));

    return facturasDisponibles
      .filter((f) => !yaIds.has(f.id))
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
        const saldoFactura = f._saldo_disponible !== undefined ? Number(f._saldo_disponible) : totalFactura;
        const diferencia = saldoFactura - metaMonto;
        const esExacto = metaMonto > 0 && Math.abs(diferencia) <= 0.05;

        const rfcPedido = (pedido?.clientes?.rfc || '').trim().toUpperCase();
        const rfcFactura = (f.clientes?.rfc || f.rfc_receptor || '').trim().toUpperCase();
        const mismoRfc = Boolean(rfcPedido && rfcFactura && rfcPedido === rfcFactura);

        const idClientePedido = pedido?.clientes?.id || pedido?.cliente_id;
        const idClienteFactura = f.clientes?.id || f.cliente_id;
        const mismoCliente = Boolean(idClientePedido && idClienteFactura && idClientePedido === idClienteFactura);

        let score = 0;
        if (esExacto && (mismoRfc || mismoCliente)) {
          score = 100;
        } else if (esExacto) {
          score = 75;
        } else if (mismoRfc || mismoCliente) {
          score = 50;
        }

        return {
          ...f,
          totalNum: totalFactura,
          saldoNum: saldoFactura,
          diferencia,
          esExacto,
          mismoRfc,
          mismoCliente,
          score,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const dateA = new Date(a.fecha_emision || 0).getTime();
        const dateB = new Date(b.fecha_emision || 0).getTime();
        return dateB - dateA;
      });
  }, [facturasDisponibles, facturasYaVinculadas, search, metaMonto, pedido]);

  // Detector de combinación de múltiples facturas que sumen metaMonto
  const sugerenciaMultiFacturas = useMemo<any[] | null>(() => {
    if (metaMonto <= 0 || facturasConAnalisis.length < 2) return null;
    const candidatosCliente = facturasConAnalisis.filter(f => f.mismoRfc || f.mismoCliente);
    const pool = (candidatosCliente.length >= 2 ? candidatosCliente : facturasConAnalisis).slice(0, 15);

    let bestGroup: any[] | null = null;
    let bestDiff = Infinity;

    const dfs = (idx: number, curr: any[], sum: number): boolean => {
      const diff = Math.abs(sum - metaMonto);
      if (curr.length >= 2 && diff <= 0.5 && diff < bestDiff) {
        bestDiff = diff;
        bestGroup = [...curr];
        if (diff < 0.02) return true;
      }
      if (curr.length >= 4 || sum > metaMonto + 0.5) return false;
      for (let i = idx; i < pool.length; i++) {
        curr.push(pool[i]);
        if (dfs(i + 1, curr, sum + pool[i].saldoNum)) return true;
        curr.pop();
      }
      return false;
    };

    dfs(0, [], 0);
    return bestGroup;
  }, [facturasConAnalisis, metaMonto]);

  // Preseleccionar automáticamente si hay coincidencia exacta 1 a 1
  useEffect(() => {
    if (selectedFacturaIds.length === 0 && facturasConAnalisis.length > 0) {
      const sugerida = facturasConAnalisis.find(f => f.score === 100) || facturasConAnalisis.find(f => f.esExacto);
      if (sugerida) {
        setSelectedFacturaIds([sugerida.id]);
      }
    }
  }, [facturasConAnalisis]);

  const toggleFactura = (id: string) => {
    setSelectedFacturaIds(prev =>
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  const facturasSeleccionadas = useMemo(() => {
    return facturasConAnalisis.filter(f => selectedFacturaIds.includes(f.id));
  }, [facturasConAnalisis, selectedFacturaIds]);

  const sumaFacturasSeleccionadas = useMemo(() => {
    return Math.round(facturasSeleccionadas.reduce((acc, f) => acc + f.saldoNum, 0) * 100) / 100;
  }, [facturasSeleccionadas]);

  const diferenciaSeleccion = Math.round((sumaFacturasSeleccionadas - metaMonto) * 100) / 100;
  const esSumaExacta = selectedFacturaIds.length > 0 && Math.abs(diferenciaSeleccion) <= 0.05;

  const handleDesvincularExistente = async (facturaId: string) => {
    if (!confirm('¿Deseas desvincular esta factura de este pedido?')) return;
    setSaving(true);
    try {
      const token = await getSessionToken();
      const res = await desvincularFacturaDePedido(facturaId, token, pedidoId);
      if (res.success) {
        await Promise.all([fetchPedido(), fetchFacturas()]);
        onSuccess();
      } else {
        setError(res.error || 'No se pudo desvincular.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al desvincular.');
    } finally {
      setSaving(false);
    }
  };

  // Vincular acción (1 o múltiples facturas -> este pedido)
  const handleVincular = async () => {
    if (selectedFacturaIds.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await vincularFacturaAPedido(selectedFacturaIds, pedidoId, token, {
        actualizarEstatusPago,
        marcarFacturadoCompleto,
      });
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
        setError(res.error || 'Error al vincular la(s) factura(s).');
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
      <div className="bg-white dark:bg-gray-950 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-900 bg-gray-50/60 dark:bg-gray-900/30">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <LinkIcon className="text-blue-500" size={18} /> Asignar Factura(s) XML a Pedido
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Puedes seleccionar <strong>1 o varias facturas XML</strong> para cubrir el importe total o parcial de este pedido.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Tarjeta Informativa del Pedido y su Cobertura Actual */}
        <div className="p-4 bg-blue-50/60 dark:bg-blue-950/25 border-b border-blue-100 dark:border-blue-900/40 space-y-2.5">
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

            <div className="flex items-center gap-4 text-right shrink-0">
              {montoYaCubierto > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    Ya Facturado
                  </span>
                  <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(montoYaCubierto)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                  {montoYaCubierto > 0 ? 'Saldo por Facturar' : 'Importe del Pedido'}
                </span>
                <span className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
                  {formatCurrency(metaMonto)}
                </span>
              </div>
            </div>
          </div>

          {/* Facturas ya vinculadas al pedido */}
          {facturasYaVinculadas.length > 0 && (
            <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/50 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[10px] font-bold text-gray-500 uppercase mr-1">Facturas actuales:</span>
              {facturasYaVinculadas.map((fv) => (
                <span
                  key={fv.id}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shadow-2xs"
                >
                  <span>Folio {fv.serie_folio || fv.uuid_fiscal?.substring(0, 8)} ({formatCurrency(fv.monto_asignado)})</span>
                  <button
                    type="button"
                    onClick={() => handleDesvincularExistente(fv.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                    title="Desvincular esta factura del pedido"
                  >
                    <Unlink size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="p-3.5 border-b border-gray-100 dark:border-gray-900 bg-gray-50/30 dark:bg-gray-900/10 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar factura por Folio, UUID, Cliente, RFC o monto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
            />
          </div>

          {sugerenciaMultiFacturas && sugerenciaMultiFacturas.length >= 2 && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles size={15} className="text-emerald-600 shrink-0" />
                <span className="text-[11px] text-emerald-900 dark:text-emerald-200 truncate">
                  <strong>Combinación Exacta:</strong> {sugerenciaMultiFacturas.map((x: any) => `${x.serie_folio || 'XML'} (${formatCurrency(x.saldoNum)})`).join(' + ')} = <strong>{formatCurrency(metaMonto)}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFacturaIds(sugerenciaMultiFacturas.map((x: any) => x.id))}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-[10px] shrink-0 cursor-pointer"
              >
                Seleccionar {sugerenciaMultiFacturas.length} XMLs
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
              <RefreshCw className="animate-spin text-blue-500" size={24} />
              <span className="text-xs">Cargando facturas disponibles...</span>
            </div>
          ) : facturasConAnalisis.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <FileCode size={36} className="mx-auto text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-semibold">No se encontraron facturas disponibles por vincular.</p>
              <p className="text-xs text-gray-400">Si aún no has subido el XML, puedes cargarlo en &ldquo;Subir Masivo (XML)&rdquo;.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Facturas disponibles ({facturasConAnalisis.length})
                </span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  Marcadas: {selectedFacturaIds.length} | Suma: {formatCurrency(sumaFacturasSeleccionadas)}
                </span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {facturasConAnalisis.map((f) => {
                  const isSelected = selectedFacturaIds.includes(f.id);
                  const esConsolidadaParcial = f._pedidos_vinculados_count > 0;

                  return (
                    <div
                      key={f.id}
                      onClick={() => toggleFactura(f.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? f.esExacto
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                            : 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                          : f.esExacto
                          ? 'bg-emerald-50/25 dark:bg-emerald-950/15 border-emerald-200 dark:border-emerald-800/60 hover:border-emerald-400'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 pointer-events-none shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <span className="font-bold text-xs text-gray-900 dark:text-white font-mono">
                              Folio: {f.serie_folio || 'SF'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono truncate max-w-[150px]" title={f.uuid_fiscal}>
                              UUID: {f.uuid_fiscal?.substring(0, 12)}...
                            </span>

                            {f.esExacto && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-1">
                                <Check size={10} strokeWidth={3} /> Monto Exacto
                              </span>
                            )}
                            {f.mismoRfc && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                                👤 Mismo RFC
                              </span>
                            )}
                            {esConsolidadaParcial && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                                🔗 Compartida ({f._pedidos_vinculados_count} ped.)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                            <span className="font-medium truncate max-w-[220px]">
                              {f.clientes?.nombre_local || f.clientes?.razon_social || f.razon_social_receptor || 'Cliente'}
                            </span>
                            {(f.clientes?.rfc || f.rfc_receptor) && (
                              <span className="font-mono text-[10px] text-gray-400">({f.clientes?.rfc || f.rfc_receptor})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 space-y-0.5">
                        <div className={`font-extrabold text-sm font-mono ${
                          f.esExacto ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {formatCurrency(f.saldoNum)}
                        </div>
                        {esConsolidadaParcial && (
                          <div className="text-[9px] text-gray-400 font-mono">
                            de {formatCurrency(f.totalNum)}
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

          {/* Panel Comparativo Dinámico de la Selección */}
          {selectedFacturaIds.length > 0 && (
            <div className={`p-3 rounded-xl border text-xs space-y-2 animate-in fade-in duration-150 ${
              esSumaExacta
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}>
              <div className="flex items-center gap-2">
                {esSumaExacta ? (
                  <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <span>
                  {esSumaExacta ? (
                    <>
                      <strong>Coincidencia Exacta:</strong> {selectedFacturaIds.length} factura(s) ({formatCurrency(sumaFacturasSeleccionadas)}) cubren al 100% el saldo del pedido ({formatCurrency(metaMonto)}).
                    </>
                  ) : diferenciaSeleccion < 0 ? (
                    <>
                      <strong>Facturación Parcial:</strong> Asignarás {formatCurrency(sumaFacturasSeleccionadas)} a un saldo de {formatCurrency(metaMonto)}. Quedará un saldo pendiente por facturar de <strong>{formatCurrency(Math.abs(diferenciaSeleccion))}</strong>.
                    </>
                  ) : (
                    <>
                      <strong>Factura Mayor al Pedido:</strong> La factura ({formatCurrency(sumaFacturasSeleccionadas)}) supera al pedido ({formatCurrency(metaMonto)}) por <strong>+{formatCurrency(diferenciaSeleccion)}</strong>. El excedente quedará libre para asignarlo a otros pedidos.
                    </>
                  )}
                </span>
              </div>

              {diferenciaSeleccion < -0.05 && (
                <label className="flex items-center gap-2 pt-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marcarFacturadoCompleto}
                    onChange={e => setMarcarFacturadoCompleto(e.target.checked)}
                    className="rounded text-indigo-600 w-3.5 h-3.5"
                  />
                  <span>Dar pedido por 100% facturado (ignorar diferencia de {formatCurrency(Math.abs(diferenciaSeleccion))} por envío/descuento)</span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/20 flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-700 dark:text-gray-300">
            <label className="flex items-center gap-1.5 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={actualizarEstatusPago}
                onChange={(e) => setActualizarEstatusPago(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
              />
              <span>Actualizar pedido a <strong>Liquidado</strong></span>
            </label>

            <label className="flex items-center gap-1.5 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={enviarPorCorreo}
                onChange={(e) => setEnviarPorCorreo(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
              />
              <Mail size={13} className="text-blue-500" />
              <span>Enviar por correo al cliente</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleVincular}
              disabled={selectedFacturaIds.length === 0 || saving}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Vinculando...</>
              ) : (
                <>Vincular {selectedFacturaIds.length} Factura(s) al Pedido</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
