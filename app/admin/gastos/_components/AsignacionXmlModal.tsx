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
  Clock, Landmark, Receipt, Calendar, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';

interface AsignacionXmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMonth?: string;
}

// Limpia montos que puedan venir como strings formateados ('1,200.50', '$500', etc.)
const cleanNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
};

// Extrae el mes YYYY-MM de cualquier campo de fecha (ISO, string, fecha)
const getDocMonth = (dateVal: any): string => {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (str.length >= 7 && str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }
  }
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
  } catch {}
  return '';
};

export default function AsignacionXmlModal({
  isOpen,
  onClose,
  onSuccess,
  initialMonth
}: AsignacionXmlModalProps) {
  const getSessionToken = useSessionToken();
  const getEmpresaId = useEmpresaId();
  const { selectedMonth: periodMonth } = usePeriod();
  const { openCfdi } = useCfdiViewer();

  // Control de mes activo en el modal
  const [activeMonth, setActiveMonth] = useState<string>(() => {
    return initialMonth || periodMonth || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();
  });
  const [filtrarPorMes, setFiltrarPorMes] = useState(true);

  // Actualizar mes si cambia initialMonth o periodMonth al abrir
  useEffect(() => {
    if (isOpen) {
      const m = initialMonth || periodMonth;
      if (m) setActiveMonth(m);
    }
  }, [isOpen, initialMonth, periodMonth]);

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
  const [soloCoincidentes, setSoloCoincidentes] = useState(true);
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

  // Navegación de mes
  const handlePrevMonth = () => {
    const [y, m] = activeMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const newM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setActiveMonth(newM);
  };

  const handleNextMonth = () => {
    const [y, m] = activeMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const newM = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setActiveMonth(newM);
  };

  // Facturas y Pedidos filtrados estrictamente por el mes activo
  const facturasDelMes = useMemo(() => {
    return facturas.filter(f => {
      if (!filtrarPorMes) return true;
      const m = getDocMonth(f.fecha_emision || f.fecha_timbrado || f.created_at);
      return m === activeMonth;
    });
  }, [facturas, activeMonth, filtrarPorMes]);

  const pedidosDelMes = useMemo(() => {
    return pedidos.filter(p => {
      if (!filtrarPorMes) return true;
      const m = getDocMonth(p.fecha_pedido || p.creado_en);
      return m === activeMonth;
    });
  }, [pedidos, activeMonth, filtrarPorMes]);

  // Selección activa
  const activeXml = useMemo(() => {
    return facturas.find(f => f.id === selectedXmlId) || null;
  }, [facturas, selectedXmlId]);

  const activePedido = useMemo(() => {
    return pedidos.find(p => p.id === selectedPedidoId) || null;
  }, [pedidos, selectedPedidoId]);

  // Función helper de coincidencia
  const checkCoincidencia = useCallback((p: any, xml: any) => {
    if (!xml || !p) return { isMatch: false, isExact: false, dif: 0, tipo: '' };

    const xmlTotal = cleanNumber(xml.total);
    const xmlSubtotal = cleanNumber(xml.subtotal);
    const pTotal = cleanNumber(p.precio_total);
    const pEnvio = cleanNumber(p.costo_envio);
    const pNeto = pEnvio > 0 ? cleanNumber(pTotal - pEnvio) : pTotal;

    const difTotal = Math.abs(pTotal - xmlTotal);
    const difSubtotal = xmlSubtotal > 0 ? Math.abs(pTotal - xmlSubtotal) : 999;
    const difNeto = pEnvio > 0 ? Math.abs(pNeto - xmlTotal) : 999;

    // 1. Total exacto (< $0.05)
    if (difTotal < 0.05) {
      return { isMatch: true, isExact: true, dif: pTotal - xmlTotal, tipo: 'total_exacto' };
    }
    // 2. Coincidencia con Subtotal (< $0.05)
    if (difSubtotal < 0.05) {
      return { isMatch: true, isExact: true, dif: pTotal - xmlSubtotal, tipo: 'subtotal_exacto' };
    }
    // 3. Coincidencia sin costo de envío (< $0.05)
    if (difNeto < 0.05) {
      return { isMatch: true, isExact: true, dif: pNeto - xmlTotal, tipo: 'sin_envio' };
    }
    // 4. Redondeo de centavos del SAT (< $0.50 de diferencia)
    if (difTotal <= 0.50) {
      return { isMatch: true, isExact: false, dif: pTotal - xmlTotal, tipo: 'centavos' };
    }

    return { isMatch: false, isExact: false, dif: pTotal - xmlTotal, tipo: '' };
  }, []);

  // Filtrado y enriquecimiento de Facturas XML
  const facturasFiltradas = useMemo(() => {
    return facturasDelMes.filter(f => {
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
    }).map(f => {
      // Contar cuántos pedidos en el mes coinciden con este XML
      const coincs = pedidosDelMes.filter(p => checkCoincidencia(p, f).isMatch);
      return {
        ...f,
        _matchingPedidosCount: coincs.length
      };
    });
  }, [facturasDelMes, pedidosDelMes, filtroXmlEstatus, busquedaXml, checkCoincidencia]);

  // Filtrado de Pedidos en base al XML seleccionado y búsqueda
  const pedidosProcesados = useMemo(() => {
    const list = pedidosDelMes.filter(p => {
      // Filtro de estatus de factura del pedido
      const hasInvoice = (p.facturas_clientes && p.facturas_clientes.length > 0) || !!p.folio_factura;
      if (filtroPedidoEstatus === 'sin_factura' && hasInvoice) {
        // Excepción: si el pedido está vinculado a la factura activa seleccionada, permitir verlo para poder consultar o desvincular
        const isLinkedToActive = activeXml && (activeXml.pedido_id === p.id || (p.facturas_clientes && p.facturas_clientes.some((fc: any) => fc.id === activeXml.id)));
        if (!isLinkedToActive) return false;
      }
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

    const targetRfc = activeXml ? (activeXml.rfc_receptor || activeXml.clientes?.rfc || '').trim().toUpperCase() : null;
    const targetCliente = activeXml ? (activeXml.clientes?.nombre_local || activeXml.razon_social_receptor || '').trim().toLowerCase() : null;
    const isPgXml = targetRfc?.includes('XAXX010101') || (targetCliente && (targetCliente.includes('publico') || targetCliente.includes('general')));

    const mapped = list.map(p => {
      const { isMatch, isExact, dif, tipo } = activeXml ? checkCoincidencia(p, activeXml) : { isMatch: false, isExact: false, dif: 0, tipo: '' };

      const isPgPedido = !p.clientes?.rfc || p.clientes.rfc.includes('XAXX010101') || !p.cliente_id;
      const isClientMatch = (isPgXml && isPgPedido) ||
        (targetRfc && p.clientes?.rfc && p.clientes.rfc.trim().toUpperCase() === targetRfc) ||
        (targetCliente && (p.cliente_nombre || p.clientes?.nombre_local || '').toLowerCase().includes(targetCliente));

      // Verificar si ya está asignado a este mismo XML
      const isLinkedToThisXml = activeXml && (activeXml.pedido_id === p.id || (p.facturas_clientes && p.facturas_clientes.some((fc: any) => fc.id === activeXml.id)));

      // Verificar si ya está asignado a otra factura
      const hasOtherInvoice = !isLinkedToThisXml && ((p.facturas_clientes && p.facturas_clientes.length > 0) || !!p.folio_factura);

      let score = 0;
      if (isLinkedToThisXml) score += 200;
      if (isExact) score += 100;
      else if (isMatch) score += 80;
      if (isClientMatch) score += 50;
      if (!hasOtherInvoice) score += 20;

      return {
        ...p,
        _isMatch: isMatch,
        _isExact: isExact,
        _difMonto: dif,
        _matchTipo: tipo,
        _isClientMatch: isClientMatch,
        _isPgPedido: isPgPedido,
        _isLinkedToThisXml: isLinkedToThisXml,
        _hasOtherInvoice: hasOtherInvoice,
        _matchScore: score
      };
    });

    // Si hay un XML seleccionado y 'soloCoincidentes' está activo:
    if (activeXml && soloCoincidentes) {
      const coincidentes = mapped.filter(p => p._isMatch || p._isLinkedToThisXml);
      // Si la factura es de Público en General: mostrar tanto los que coincidan como todas las ventas sin factura (ej. KEI)
      if (isPgXml) {
        return mapped
          .filter(p => p._isMatch || p._isLinkedToThisXml || !p._hasOtherInvoice)
          .sort((a, b) => b._matchScore - a._matchScore);
      }
      if (coincidentes.length > 0) {
        return coincidentes.sort((a, b) => b._matchScore - a._matchScore);
      }
      // Si no hay coincidencias exactas por monto, mostrar todos los pedidos sin factura del mes para no dejar la vista vacía
      return mapped
        .filter(p => !p._hasOtherInvoice)
        .sort((a, b) => b._matchScore - a._matchScore);
    }

    // Ordenar con los que coinciden en la parte superior
    return mapped.sort((a, b) => {
      if (activeXml) {
        if (b._matchScore !== a._matchScore) return b._matchScore - a._matchScore;
        const diffA = Math.abs(a._difMonto);
        const diffB = Math.abs(b._difMonto);
        if (diffA !== diffB) return diffA - diffB;
      }
      return (b.numero_pedido || 0) - (a.numero_pedido || 0);
    });
  }, [pedidosDelMes, activeXml, soloCoincidentes, filtroPedidoEstatus, busquedaPedido, checkCoincidencia]);

  // Contadores globales para el mes
  const kpis = useMemo(() => {
    const xmlSinAsignar = facturasDelMes.filter(f => !f.pedido_id);
    const pedidosSinXml = pedidosDelMes.filter(p => (!p.facturas_clientes || p.facturas_clientes.length === 0) && !p.folio_factura);

    let coincidenciasExactas = 0;
    xmlSinAsignar.forEach(xml => {
      const matches = pedidosSinXml.filter(ped => checkCoincidencia(ped, xml).isMatch);
      if (matches.length > 0) coincidenciasExactas++;
    });

    return {
      xmlSinAsignarCount: xmlSinAsignar.length,
      pedidosSinXmlCount: pedidosSinXml.length,
      coincidenciasDisponibles: coincidenciasExactas
    };
  }, [facturasDelMes, pedidosDelMes, checkCoincidencia]);

  // Vincular
  const handleVincular = async (xmlId: string, pedidoId: string) => {
    setProcessingId(xmlId);
    setMessage(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Sesión expirada.');

      const res = await vincularFacturaAPedido(xmlId, pedidoId, token);
      if (res.success) {
        setMessage({ text: 'Factura XML asignada exitosamente al pedido.', type: 'success' });
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
    const unlinkedXmls = facturasDelMes.filter(f => !f.pedido_id);
    const unlinkedPedidos = pedidosDelMes.filter(p => (!p.facturas_clientes || p.facturas_clientes.length === 0) && !p.folio_factura);

    const parejas: { xmlId: string; pedidoId: string; monto: number }[] = [];
    const usedPedidosIds = new Set<string>();

    unlinkedXmls.forEach(xml => {
      const candidates = unlinkedPedidos.filter(ped => !usedPedidosIds.has(ped.id) && checkCoincidencia(ped, xml).isMatch);

      if (candidates.length === 1) {
        parejas.push({
          xmlId: xml.id,
          pedidoId: candidates[0].id,
          monto: cleanNumber(xml.total)
        });
        usedPedidosIds.add(candidates[0].id);
      }
    });

    if (parejas.length === 0) {
      alert(`No se encontraron parejas 1 a 1 con coincidencia de importe exacto sin ambigüedad en el mes ${activeMonth}.`);
      return;
    }

    if (!confirm(`Se detectaron ${parejas.length} coincidencias exactas en el mes ${activeMonth}.\n\n¿Deseas vincularlas automáticamente?`)) {
      return;
    }

    setAutoMatching(true);
    setMessage({ text: `Procesando ${parejas.length} asignaciones automáticas del mes ${activeMonth}...`, type: 'info' });

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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 transition-all animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-6xl shadow-2xl h-[92vh] flex flex-col font-sans overflow-hidden">

        {/* CABECERA PRINCIPAL: TÍTULO, SELECTOR DE MES Y ACCIONES */}
        <div className="p-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Link2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                  Asignación de XML a Pedidos
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  Estilo Conciliación
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Selecciona un XML a la izquierda para ver <strong>únicamente los pedidos con importe coincidente</strong> en el mes.
              </p>
            </div>
          </div>

          {/* SELECTOR DE MES */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
              title="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1.5 px-2 font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
              <Calendar size={13} className="text-blue-500" />
              <span>{activeMonth}</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
              title="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>

            <label className="flex items-center gap-1 pl-2 border-l border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!filtrarPorMes}
                onChange={e => setFiltrarPorMes(!e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
              />
              <span>Ver Todo</span>
            </label>
          </div>

          {/* BOTONES DE ACCIÓN SUPERIOR */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoAsignar}
              disabled={autoMatching || loading || kpis.coincidenciasDisponibles === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Vincular automáticamente parejas con monto exacto no ambiguo del mes"
            >
              <Sparkles size={13} className={autoMatching ? 'animate-spin' : ''} />
              <span>{autoMatching ? 'Procesando...' : `Auto-Asignar (${kpis.coincidenciasDisponibles})`}</span>
            </button>

            <button
              onClick={fetchData}
              className="p-1.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              title="Refrescar datos"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X size={17} />
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
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 sm:p-4 min-h-0 overflow-hidden bg-gray-50/40 dark:bg-gray-900/20">

          {/* PANEL IZQUIERDO: FACTURAS XML */}
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden shadow-xs">
            {/* Cabecera & Filtros XML */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileCode className="text-amber-500 w-4 h-4" />
                  <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                    Facturas XML ({facturasFiltradas.length})
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    [{filtrarPorMes ? activeMonth : 'Todo'}]
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
                  placeholder="Buscar folio, UUID, cliente, RFC, monto..."
                  value={busquedaXml}
                  onChange={e => setBusquedaXml(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Lista XML */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-2 space-y-1">
              {facturasFiltradas.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No hay facturas XML con los filtros actuales en el mes {activeMonth}.
                </div>
              ) : (
                facturasFiltradas.map((f) => {
                  const isSelected = selectedXmlId === f.id;
                  const isAssigned = !!f.pedido_id;
                  const clientName = f.clientes?.nombre_local || f.clientes?.razon_social || f.razon_social_receptor || 'Cliente';
                  const rfc = f.rfc_receptor || f.clientes?.rfc || 'S/N';
                  const folio = f.serie_folio || (f.uuid_fiscal ? f.uuid_fiscal.substring(0, 8) : 'Sin Folio');
                  const matchingCount = f._matchingPedidosCount || 0;

                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        setSelectedXmlId(isSelected ? null : f.id);
                        setSelectedPedidoId(null);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-2 ring-amber-500/30'
                          : isAssigned
                          ? 'border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/20 hover:border-gray-300'
                          : matchingCount > 0
                          ? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-500'
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
                            ) : matchingCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-white shadow-xs">
                                <Sparkles size={9} /> {matchingCount} coincidencia{matchingCount > 1 ? 's' : ''}
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
                              <span>UUID: {f.uuid_fiscal.substring(0, 14)}...</span>
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

          {/* PANEL DERECHO: PEDIDOS DE VENTA / MOVIMIENTOS COINCIDENTES */}
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden shadow-xs">
            {/* Cabecera & Filtros Pedidos */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 shrink-0 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Receipt className="text-blue-500 w-4 h-4" />
                  <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                    {activeXml
                      ? soloCoincidentes
                        ? `Pedidos que Cuadran con $${cleanNumber(activeXml.total).toFixed(2)} (${pedidosProcesados.length})`
                        : `Todos los Pedidos (${pedidosProcesados.length})`
                      : `Pedidos / Movimientos (${pedidosProcesados.length})`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-800/60 p-0.5 rounded-lg text-[10px]">
                    <button
                      onClick={() => setFiltroPedidoEstatus('sin_factura')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        filtroPedidoEstatus === 'sin_factura'
                          ? 'bg-white dark:bg-gray-950 text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Sin Factura ({kpis.pedidosSinXmlCount})
                    </button>
                    <button
                      onClick={() => setFiltroPedidoEstatus('facturados')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        filtroPedidoEstatus === 'facturados'
                          ? 'bg-white dark:bg-gray-950 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Facturados
                    </button>
                    <button
                      onClick={() => setFiltroPedidoEstatus('todos')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        filtroPedidoEstatus === 'todos'
                          ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-white shadow-xs'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Todos
                    </button>
                  </div>

                  {/* TOGGLE SOLO COINCIDENTES */}
                  {activeXml && (
                    <button
                      type="button"
                      onClick={() => setSoloCoincidentes(prev => !prev)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all flex items-center gap-1 ${
                        soloCoincidentes
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300'
                      }`}
                    >
                      <Filter size={10} />
                      <span>{soloCoincidentes ? '✓ Sólo Coincidentes' : 'Ver Todos'}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar # pedido, cliente, RFC, monto..."
                  value={busquedaPedido}
                  onChange={e => setBusquedaPedido(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Lista Pedidos */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-2 space-y-1">
              {!activeXml ? (
                <div className="text-center py-16 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-3">
                    <Link2 size={24} />
                  </div>
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Selecciona una Factura XML
                  </h4>
                  <p className="text-[11px] text-gray-400 max-w-sm mx-auto mt-1">
                    Haz clic en una factura a la izquierda para desplegar de inmediato únicamente los pedidos que coinciden con su importe en este mes.
                  </p>
                </div>
              ) : pedidosProcesados.length === 0 ? (
                <div className="text-center py-14 px-4">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Sin coincidencias por importe
                  </h4>
                  <p className="text-[11px] text-gray-400 max-w-sm mx-auto mt-1">
                    No se encontraron pedidos de <strong>{formatCurrency(activeXml.total)}</strong> en el mes {activeMonth}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSoloCoincidentes(false)}
                    className="mt-3 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100"
                  >
                    Mostrar todos los pedidos del mes
                  </button>
                </div>
              ) : (
                pedidosProcesados.map((p) => {
                  const isSelected = selectedPedidoId === p.id;
                  const clientName = p.clientes?.nombre_local || p.cliente_nombre || 'Cliente General';
                  const rfc = p.clientes?.rfc || 'S/N';
                  const isMatch = p._isMatch;
                  const isExact = p._isExact;
                  const isLinkedToThis = p._isLinkedToThisXml;
                  const hasOtherInvoice = p._hasOtherInvoice;
                  const difMonto = p._difMonto;

                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPedidoId(isSelected ? null : p.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 shadow-xs ring-2 ring-blue-500/30'
                          : isLinkedToThis
                          ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : isExact
                          ? 'border-emerald-500/70 bg-emerald-500/10 hover:border-emerald-500 font-medium'
                          : isMatch
                          ? 'border-teal-400/60 bg-teal-50/20 dark:bg-teal-950/20 hover:border-teal-500'
                          : hasOtherInvoice
                          ? 'border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/20 opacity-70'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                              Pedido #{p.numero_pedido}
                            </span>

                            {isLinkedToThis ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-600 text-white shadow-xs">
                                <CheckCircle size={9} /> Vinculado a este XML
                              </span>
                            ) : isExact ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white shadow-xs">
                                <Sparkles size={9} /> Coincide Importe Exacto
                              </span>
                            ) : isMatch ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                                Coincide ({p._matchTipo === 'sin_envio' ? 'Sin Envío' : 'Centavos'})
                              </span>
                            ) : null}

                            {p._isClientMatch && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                Mismo Cliente
                              </span>
                            )}

                            {hasOtherInvoice ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500" title={`Asignado a factura: ${p.folio_factura}`}>
                                Folio: {p.folio_factura || 'Facturado'}
                              </span>
                            ) : !isLinkedToThis ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Sin Factura
                              </span>
                            ) : null}

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

                          {activeXml && !isLinkedToThis && (
                            <button
                              type="button"
                              disabled={processingId === activeXml.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVincular(activeXml.id, p.id);
                              }}
                              className={`mt-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 shadow-xs ml-auto cursor-pointer ${
                                isExact
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                              }`}
                            >
                              <Link2 size={11} />
                              <span>{hasOtherInvoice ? 'Reasignar' : isExact ? 'Asignar' : 'Vincular'}</span>
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
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-lg">
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
                    Math.abs(cleanNumber(activePedido.precio_total) - cleanNumber(activeXml.total)) < 0.05
                      ? 'text-emerald-500'
                      : 'text-amber-500'
                  }`}>
                    {Math.abs(cleanNumber(activePedido.precio_total) - cleanNumber(activeXml.total)) < 0.05
                      ? '✓ Monto Exacto'
                      : formatCurrency(cleanNumber(activePedido.precio_total) - cleanNumber(activeXml.total))}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedXmlId(null);
                  setSelectedPedidoId(null);
                }}
                className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 font-bold cursor-pointer"
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
                <span>{processingId === activeXml.id ? 'Vinculando...' : 'Asignar Factura a Pedido'}</span>
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
