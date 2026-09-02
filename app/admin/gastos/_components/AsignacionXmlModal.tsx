'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useEmpresaId } from '../../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { usePeriod } from '../../../../lib/hooks/usePeriod';
import { formatCurrency } from '../../../../lib/formatters';
import { vincularFacturaAPedido, desvincularFacturaDePedido, obtenerSignedUrl } from '../actions';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';
import CfdiViewerModal from './CfdiViewerModal';
import {
  Link2, Unlink, FileCode, FileText, CheckCircle, AlertTriangle,
  Search, RefreshCw, X, Sparkles, Eye, Copy, Check, ArrowRight,
  Clock, Landmark, Receipt
} from 'lucide-react';

interface AsignacionXmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AsignacionXmlModal({
  isOpen,
  onClose,
  onSuccess
}: AsignacionXmlModalProps) {
  const getSessionToken = useSessionToken();
  const getEmpresaId = useEmpresaId();
  const { selectedMonth } = usePeriod();
  const { openCfdi } = useCfdiViewer();

  // Datos
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Selecciones
  const [selectedXmlId, setSelectedXmlId] = useState<string | null>(null);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [autoMatching, setAutoMatching] = useState(false);

  // Filtros
  const [filtroXmlEstatus, setFiltroXmlEstatus] = useState<'sin_asignar' | 'asignadas' | 'todas'>('sin_asignar');
  const [busquedaXml, setBusquedaXml] = useState('');
  const [filtroPedidoEstatus, setFiltroPedidoEstatus] = useState<'sin_factura' | 'facturados' | 'todos'>('sin_factura');
  const [busquedaPedido, setBusquedaPedido] = useState('');

  // Fallback visor CFDI
  const [cfdiViewerUrl, setCfdiViewerUrl] = useState<string | null>(null);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);

  const handleCopyUuid = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    setCopiedUuid(uuid);
    setTimeout(() => setCopiedUuid(null), 2000);
  };

  const handleViewCfdi = (xmlUrl: string) => {
    if (openCfdi) {
      openCfdi(xmlUrl);
    } else {
      setCfdiViewerUrl(xmlUrl);
    }
  };

  const handleDownloadFile = async (url: string) => {
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Sesión expirada.');
      const res = await obtenerSignedUrl(url, token);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert('Error al obtener URL: ' + (res.error || 'Desconocido'));
      }
    } catch (err: any) {
      alert('Error al descargar archivo: ' + err.message);
    }
  };

  // Carga de datos
  const fetchData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) {
        setLoading(false);
        return;
      }

      // 1. Facturas XML de Clientes
      const { data: facturasData, error: fErr } = await supabase
        .from('facturas_clientes')
        .select('*, clientes(id, nombre_local, razon_social, rfc), pedidos(id, numero_pedido, precio_total, cliente_nombre)')
        .eq('empresa_id', empresaId)
        .order('fecha_emision', { ascending: false });

      if (fErr) throw fErr;

      // 2. Pedidos de Venta
      const { data: pedidosData, error: pErr } = await supabase
        .from('pedidos')
        .select('*, clientes(id, nombre_local, razon_social, rfc), facturas_clientes(*), movimientos_bancarios(id, fecha, concepto, monto)')
        .eq('empresa_id', empresaId)
        .neq('estatus_pago', 'Cancelado')
        .order('fecha_pedido', { ascending: false });

      if (pErr) throw pErr;

      setFacturas(facturasData || []);
      setPedidos(pedidosData || []);
    } catch (err: any) {
      console.error('Error al cargar datos:', err);
      setMessage({ text: `Error al cargar: ${err.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [getEmpresaId]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  // Selección activa
  const activeXml = useMemo(() => {
    return facturas.find(f => f.id === selectedXmlId) || null;
  }, [facturas, selectedXmlId]);

  const activePedido = useMemo(() => {
    return pedidos.find(p => p.id === selectedPedidoId) || null;
  }, [pedidos, selectedPedidoId]);

  // Filtrado de XMLs
  const facturasFiltradas = useMemo(() => {
    return facturas.filter(f => {
      if (selectedMonth && f.fecha_emision) {
        const mesF = f.fecha_emision.substring(0, 7);
        if (mesF !== selectedMonth) return false;
      }

      if (filtroXmlEstatus === 'sin_asignar' && f.pedido_id) return false;
      if (filtroXmlEstatus === 'asignadas' && !f.pedido_id) return false;

      if (busquedaXml.trim()) {
        const q = busquedaXml.toLowerCase();
        const folio = (f.serie_folio || '').toLowerCase();
        const uuid = (f.uuid_fiscal || '').toLowerCase();
        const rfc = (f.rfc_receptor || '').toLowerCase();
        const cliente = (f.clientes?.nombre_local || f.razon_social_receptor || '').toLowerCase();
        const monto = (f.total || '').toString();

        if (!folio.includes(q) && !uuid.includes(q) && !rfc.includes(q) && !cliente.includes(q) && !monto.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [facturas, selectedMonth, filtroXmlEstatus, busquedaXml]);

  // Filtrado y Coincidencias por Importe de Pedidos
  const pedidosProcesados = useMemo(() => {
    const targetAmount = activeXml ? Number(activeXml.total || 0) : null;
    const targetRfc = activeXml ? (activeXml.rfc_receptor || activeXml.clientes?.rfc || '').trim().toUpperCase() : null;
    const targetCliente = activeXml ? (activeXml.clientes?.nombre_local || activeXml.razon_social_receptor || '').trim().toLowerCase() : null;

    const filtered = pedidos.filter(p => {
      if (selectedMonth) {
        const fecha = p.fecha_pedido ? p.fecha_pedido.substring(0, 7) : (p.creado_en ? p.creado_en.substring(0, 7) : '');
        if (fecha && fecha !== selectedMonth) return false;
      }

      const hasInvoice = (p.facturas_clientes && p.facturas_clientes.length > 0) || !!p.folio_factura;
      if (filtroPedidoEstatus === 'sin_factura' && hasInvoice) return false;
      if (filtroPedidoEstatus === 'facturados' && !hasInvoice) return false;

      if (busquedaPedido.trim()) {
        const q = busquedaPedido.toLowerCase();
        const num = (p.numero_pedido || '').toString();
        const folio = (p.folio_factura || '').toLowerCase();
        const cliente = (p.cliente_nombre || p.clientes?.nombre_local || '').toLowerCase();
        const rfc = (p.clientes?.rfc || '').toLowerCase();
        const monto = (p.precio_total || '').toString();

        if (!num.includes(q) && !folio.includes(q) && !cliente.includes(q) && !rfc.includes(q) && !monto.includes(q)) {
          return false;
        }
      }

      return true;
    });

    return filtered.map(p => {
      const pMonto = Number(p.precio_total || 0);
      const isExactAmount = targetAmount !== null && Math.abs(pMonto - targetAmount) < 0.05;
      const isClientMatch = (targetRfc && p.clientes?.rfc && p.clientes.rfc.trim().toUpperCase() === targetRfc) ||
        (targetCliente && (p.cliente_nombre || p.clientes?.nombre_local || '').toLowerCase().includes(targetCliente));

      let score = 0;
      if (isExactAmount) score += 100;
      if (isClientMatch) score += 50;

      return {
        ...p,
        _isExactAmount: isExactAmount,
        _isClientMatch: isClientMatch,
        _matchScore: score,
        _difMonto: targetAmount !== null ? pMonto - targetAmount : 0
      };
    }).sort((a, b) => {
      if (targetAmount !== null) {
        if (b._matchScore !== a._matchScore) return b._matchScore - a._matchScore;
        const diffA = Math.abs(a._difMonto);
        const diffB = Math.abs(b._difMonto);
        if (diffA !== diffB) return diffA - diffB;
      }
      return (b.numero_pedido || 0) - (a.numero_pedido || 0);
    });
  }, [pedidos, selectedMonth, filtroPedidoEstatus, busquedaPedido, activeXml]);

  // Contadores
  const kpis = useMemo(() => {
    const xmlSinAsignar = facturas.filter(f => !f.pedido_id && (!selectedMonth || (f.fecha_emision && f.fecha_emision.substring(0, 7) === selectedMonth)));
    const pedidosSinXml = pedidos.filter(p => (!p.facturas_clientes || p.facturas_clientes.length === 0) && !p.folio_factura && (!selectedMonth || (p.fecha_pedido && p.fecha_pedido.substring(0, 7) === selectedMonth)));

    let coincidenciasExactas = 0;
    xmlSinAsignar.forEach(xml => {
      const matches = pedidosSinXml.filter(ped => Math.abs(Number(ped.precio_total || 0) - Number(xml.total || 0)) < 0.05);
      if (matches.length > 0) coincidenciasExactas++;
    });

    return {
      xmlSinAsignarCount: xmlSinAsignar.length,
      pedidosSinXmlCount: pedidosSinXml.length,
      coincidenciasDisponibles: coincidenciasExactas
    };
  }, [facturas, pedidos, selectedMonth]);

  // Vincular
  const handleVincular = async (xmlId: string, pedidoId: string) => {
    setProcessingId(xmlId);
    setMessage(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Sesión expirada.');

      const res = await vincularFacturaAPedido(xmlId, pedidoId, token);
      if (res.success) {
        setMessage({ text: 'Factura XML vinculada exitosamente al pedido.', type: 'success' });
        setSelectedXmlId(null);
        setSelectedPedidoId(null);
        await fetchData();
        onSuccess?.();
      } else {
        throw new Error(res.error || 'No se pudo vincular la factura.');
      }
    } catch (err: any) {
      setMessage({ text: `Error al vincular: ${err.message}`, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  // Desvincular
  const handleDesvincular = async (xmlId: string) => {
    if (!confirm('¿Deseas desvincular esta factura del pedido? El folio del pedido será restablecido.')) return;
    setProcessingId(xmlId);
    setMessage(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Sesión expirada.');

      const res = await desvincularFacturaDePedido(xmlId, token);
      if (res.success) {
        setMessage({ text: 'Factura desvinculada correctamente.', type: 'info' });
        await fetchData();
        onSuccess?.();
      } else {
        throw new Error(res.error || 'No se pudo desvincular.');
      }
    } catch (err: any) {
      setMessage({ text: `Error al desvincular: ${err.message}`, type: 'error' });
    } finally {
      setProcessingId(null);
    }
  };

  // Auto-Asignación Masiva
  const handleAutoAsignar = async () => {
    const unlinkedXmls = facturas.filter(f => !f.pedido_id);
    const unlinkedPedidos = pedidos.filter(p => (!p.facturas_clientes || p.facturas_clientes.length === 0) && !p.folio_factura);

    const parejas: { xmlId: string; pedidoId: string; monto: number }[] = [];
    const usedPedidosIds = new Set<string>();

    unlinkedXmls.forEach(xml => {
      const xmlMonto = Number(xml.total || 0);
      const candidates = unlinkedPedidos.filter(ped => !usedPedidosIds.has(ped.id) && Math.abs(Number(ped.precio_total || 0) - xmlMonto) < 0.05);

      if (candidates.length === 1) {
        parejas.push({
          xmlId: xml.id,
          pedidoId: candidates[0].id,
          monto: xmlMonto
        });
        usedPedidosIds.add(candidates[0].id);
      }
    });

    if (parejas.length === 0) {
      alert('No se encontraron parejas 1 a 1 con coincidencia de importe exacto sin ambigüedad.');
      return;
    }

    if (!confirm(`Se detectaron ${parejas.length} coincidencias exactas por importe sin ambigüedad.\n\n¿Deseas vincularlas automáticamente?`)) {
      return;
    }

    setAutoMatching(true);
    setMessage({ text: `Procesando ${parejas.length} asignaciones automáticas...`, type: 'info' });

    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Sesión expirada.');

      let exitoCount = 0;
      for (const p of parejas) {
        const res = await vincularFacturaAPedido(p.xmlId, p.pedidoId, token);
        if (res.success) exitoCount++;
      }

      setMessage({ text: `¡Auto-asignación completada! Se vincularon ${exitoCount} facturas XML con sus pedidos.`, type: 'success' });
      await fetchData();
      onSuccess?.();
    } catch (err: any) {
      setMessage({ text: `Error en auto-asignación: ${err.message}`, type: 'error' });
    } finally {
      setAutoMatching(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 transition-all">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-6xl shadow-2xl h-[90vh] flex flex-col font-sans overflow-hidden">

        {/* CABECERA DEL MODAL */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Link2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                  Asignación de XML a Pedidos
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Estilo Conciliación
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Selecciona una factura XML a la izquierda para visualizar inmediatamente los pedidos con importe coincidente a la derecha.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoAsignar}
              disabled={autoMatching || loading || kpis.coincidenciasDisponibles === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Vincular automáticamente registros con coincidencia exacta y no ambigua de monto"
            >
              <Sparkles size={14} className={autoMatching ? 'animate-spin' : ''} />
              <span>{autoMatching ? 'Procesando...' : `Auto-Asignar (${kpis.coincidenciasDisponibles})`}</span>
            </button>

            <button
              onClick={fetchData}
              className="p-2 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              title="Refrescar datos"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* FEEDBACK BANNER */}
        {message && (
          <div className={`px-4 py-2 text-xs border-b flex items-center justify-between shrink-0 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : message.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex items-center gap-2">
              {message.type === 'success' && <CheckCircle size={14} />}
              {message.type === 'error' && <AlertTriangle size={14} />}
              {message.type === 'info' && <RefreshCw size={14} className="animate-spin" />}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-gray-400 font-bold">×</button>
          </div>
        )}

        {/* CUERPO PRINCIPAL: LADO A LADO */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-4 min-h-0 overflow-hidden bg-gray-50/40 dark:bg-gray-900/20">

          {/* PANEL IZQUIERDO: FACTURAS XML */}
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden shadow-xs">
            {/* Cabecera & Filtros XML */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="text-amber-500 w-4 h-4" />
                  <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                    Facturas XML ({facturasFiltradas.length})
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-800/60 p-0.5 rounded-lg text-[10px]">
                  <button
                    onClick={() => setFiltroXmlEstatus('sin_asignar')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      filtroXmlEstatus === 'sin_asignar'
                        ? 'bg-white dark:bg-gray-950 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Sin Asignar ({kpis.xmlSinAsignarCount})
                  </button>
                  <button
                    onClick={() => setFiltroXmlEstatus('asignadas')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      filtroXmlEstatus === 'asignadas'
                        ? 'bg-white dark:bg-gray-950 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Asignadas
                  </button>
                  <button
                    onClick={() => setFiltroXmlEstatus('todas')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      filtroXmlEstatus === 'todas'
                        ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Todas
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar folio, UUID, RFC, cliente, monto..."
                  value={busquedaXml}
                  onChange={e => setBusquedaXml(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Lista XML */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-2 space-y-1">
              {facturasFiltradas.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No hay facturas XML con los filtros actuales.
                </div>
              ) : (
                facturasFiltradas.map((f) => {
                  const isSelected = selectedXmlId === f.id;
                  const isAssigned = !!f.pedido_id;
                  const clientName = f.clientes?.nombre_local || f.clientes?.razon_social || f.razon_social_receptor || 'Cliente';
                  const rfc = f.rfc_receptor || f.clientes?.rfc || 'S/N';
                  const folio = f.serie_folio || (f.uuid_fiscal ? f.uuid_fiscal.substring(0, 8) : 'Sin Folio');

                  return (
                    <div
                      key={f.id}
                      onClick={() => setSelectedXmlId(isSelected ? null : f.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500'
                          : isAssigned
                          ? 'border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/20 hover:border-gray-300'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                              Folio: {folio}
                            </span>
                            {isAssigned ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle size={9} /> Pedido #{f.pedidos?.numero_pedido || f.pedido_id.substring(0, 6)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                <Clock size={9} /> Sin Asignar
                              </span>
                            )}
                          </div>

                          <div className="font-semibold text-xs text-gray-800 dark:text-gray-200 truncate mt-0.5">
                            {clientName}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2">
                            <span>RFC: {rfc}</span>
                            <span>·</span>
                            <span>{f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha'}</span>
                          </div>

                          {f.uuid_fiscal && (
                            <div className="text-[9px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                              <span>UUID: {f.uuid_fiscal.substring(0, 16)}...</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyUuid(f.uuid_fiscal);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                                title="Copiar UUID"
                              >
                                {copiedUuid === f.uuid_fiscal ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                            {formatCurrency(f.total)}
                          </div>

                          <div className="flex items-center justify-end gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                            {f.xml_url && (
                              <button
                                type="button"
                                onClick={() => handleViewCfdi(f.xml_url)}
                                className="p-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                                title="Ver CFDI XML"
                              >
                                <Eye size={12} />
                              </button>
                            )}
                            {f.pdf_url && (
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(f.pdf_url)}
                                className="p-1 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                                title="Descargar PDF"
                              >
                                <FileText size={12} />
                              </button>
                            )}
                            {isAssigned && (
                              <button
                                type="button"
                                disabled={processingId === f.id}
                                onClick={() => handleDesvincular(f.id)}
                                className="p-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 transition-colors"
                                title="Desvincular del pedido"
                              >
                                <Unlink size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PANEL DERECHO: PEDIDOS DE VENTA / MOVIMIENTOS */}
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden shadow-xs">
            {/* Cabecera & Filtros Pedidos */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="text-blue-500 w-4 h-4" />
                  <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                    Pedidos / Movimientos ({pedidosProcesados.length})
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-800/60 p-0.5 rounded-lg text-[10px]">
                  <button
                    onClick={() => setFiltroPedidoEstatus('sin_factura')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      filtroPedidoEstatus === 'sin_factura'
                        ? 'bg-white dark:bg-gray-950 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Sin Factura ({kpis.pedidosSinXmlCount})
                  </button>
                  <button
                    onClick={() => setFiltroPedidoEstatus('facturados')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      filtroPedidoEstatus === 'facturados'
                        ? 'bg-white dark:bg-gray-950 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Facturados
                  </button>
                  <button
                    onClick={() => setFiltroPedidoEstatus('todos')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                      filtroPedidoEstatus === 'todos'
                        ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-white shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Todos
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar # pedido, cliente, RFC, monto..."
                  value={busquedaPedido}
                  onChange={e => setBusquedaPedido(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Lista Pedidos */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-2 space-y-1">
              {pedidosProcesados.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No hay pedidos de venta con los filtros actuales.
                </div>
              ) : (
                pedidosProcesados.map((p) => {
                  const isSelected = selectedPedidoId === p.id;
                  const hasInvoice = (p.facturas_clientes && p.facturas_clientes.length > 0) || !!p.folio_factura;
                  const clientName = p.clientes?.nombre_local || p.cliente_nombre || 'Cliente General';
                  const rfc = p.clientes?.rfc || 'S/N';
                  const isExact = (p as any)._isExactAmount;
                  const isClientMatch = (p as any)._isClientMatch;
                  const difMonto = (p as any)._difMonto;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPedidoId(isSelected ? null : p.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 shadow-xs ring-1 ring-blue-500'
                          : isExact
                          ? 'border-emerald-500/70 bg-emerald-500/10 hover:border-emerald-500 font-medium'
                          : hasInvoice
                          ? 'border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/20 hover:border-gray-300'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                              Pedido #{p.numero_pedido}
                            </span>

                            {activeXml && isExact && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white shadow-xs animate-pulse">
                                <Sparkles size={9} /> Coincide Importe
                              </span>
                            )}

                            {activeXml && isClientMatch && !isExact && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                Mismo Cliente
                              </span>
                            )}

                            {hasInvoice ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                                <CheckCircle size={9} className="text-emerald-500" /> {p.folio_factura || 'Facturado'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Pend. Facturar
                              </span>
                            )}

                            {(p.movimiento_bancario_id || p.movimientos_bancarios) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800" title={p.movimientos_bancarios?.concepto ? `Banco: ${p.movimientos_bancarios.concepto}` : 'Banco Conciliado'}>
                                <Landmark size={9} /> Banco Conciliado
                              </span>
                            )}
                          </div>

                          <div className="font-semibold text-xs text-gray-800 dark:text-gray-200 truncate mt-0.5">
                            {clientName}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2">
                            <span>RFC: {rfc}</span>
                            <span>·</span>
                            <span>{p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha'}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono">
                            {formatCurrency(p.precio_total)}
                          </div>

                          {activeXml && (
                            <div className={`text-[9px] font-mono mt-0.5 font-bold ${
                              isExact ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'
                            }`}>
                              {isExact ? '✓ Cuadra ($0.00)' : `Dif: ${formatCurrency(difMonto)}`}
                            </div>
                          )}

                          {activeXml && !hasInvoice && (
                            <button
                              type="button"
                              disabled={processingId === activeXml.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVincular(activeXml.id, p.id);
                              }}
                              className={`mt-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black transition-all flex items-center gap-1 shadow-xs ml-auto ${
                                isExact
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                              }`}
                            >
                              <Link2 size={10} />
                              <span>{isExact ? 'Asignar' : 'Vincular'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* BARRA INFERIOR DE ACCIÓN (SIDE-BY-SIDE MATCH BAR) */}
        {activeXml && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-between gap-4 shrink-0 shadow-lg">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg shrink-0">
                <FileCode size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-gray-400 block">XML Seleccionado</span>
                <span className="text-xs font-black text-gray-900 dark:text-white truncate block">
                  {activeXml.serie_folio || activeXml.uuid_fiscal?.substring(0, 8)} — {formatCurrency(activeXml.total)}
                </span>
              </div>
            </div>

            <ArrowRight size={18} className="text-gray-300 dark:text-gray-600 shrink-0 hidden sm:block" />

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg shrink-0">
                <Receipt size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-gray-400 block">Pedido Seleccionado</span>
                {activePedido ? (
                  <span className="text-xs font-black text-gray-900 dark:text-white truncate block">
                    Pedido #{activePedido.numero_pedido} — {formatCurrency(activePedido.precio_total)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">
                    Selecciona un pedido en la lista derecha
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activePedido && (
                <div className="text-right mr-1 hidden md:block">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Diferencia</span>
                  <span className={`text-xs font-mono font-bold ${
                    Math.abs(Number(activePedido.precio_total || 0) - Number(activeXml.total || 0)) < 0.05
                      ? 'text-emerald-500'
                      : 'text-amber-500'
                  }`}>
                    {Math.abs(Number(activePedido.precio_total || 0) - Number(activeXml.total || 0)) < 0.05
                      ? '✓ Monto Exacto'
                      : formatCurrency(Number(activePedido.precio_total || 0) - Number(activeXml.total || 0))}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedXmlId(null);
                  setSelectedPedidoId(null);
                }}
                className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 font-bold"
              >
                Limpiar
              </button>

              <button
                type="button"
                disabled={!activePedido || processingId === activeXml.id}
                onClick={() => {
                  if (activePedido) {
                    handleVincular(activeXml.id, activePedido.id);
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Check size={14} />
                <span>{processingId === activeXml.id ? 'Vinculando...' : 'Vincular Factura a Pedido'}</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Visor CFDI local fallback */}
      {cfdiViewerUrl && (
        <CfdiViewerModal
          xmlUrl={cfdiViewerUrl}
          onClose={() => setCfdiViewerUrl(null)}
        />
      )}
    </div>
  );
}
