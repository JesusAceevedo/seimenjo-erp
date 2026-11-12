'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useEmpresaId } from '../../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { usePeriod } from '../../../../lib/hooks/usePeriod';
import { formatCurrency, formatDate } from '../../../../lib/formatters';
import { vincularFacturaAPedido, desvincularFacturaDePedido, obtenerSignedUrl } from '../actions';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';
import CfdiViewerModal from './CfdiViewerModal';
import {
  Link2, Unlink, FileCode, FileText, CheckCircle, AlertTriangle,
  Search, RefreshCw, X, Sparkles, Eye, Copy, Check, ArrowRight,
  Clock, Landmark, Receipt, Calendar, ChevronLeft, ChevronRight, Filter, Layers
} from 'lucide-react';

interface AsignacionXmlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMonth?: string;
  initialSelectedPedidoIds?: string[];
  initialSelectedXmlIds?: string[];
}

// Limpia montos que puedan venir como strings formateados ('1,200.50', '$500', etc.)
const cleanNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val * 100) / 100;
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

// Buscador combinatorio Subset-Sum (encuentra subconjunto de 2..maxLen elementos que sume targetAmount)
function findSubsetSum<T extends { id: string; _amount: number }>(
  candidates: T[],
  targetAmount: number,
  tolerance = 0.5,
  maxLen = 5
): T[] | null {
  if (targetAmount <= 0 || candidates.length < 2) return null;
  const pool = candidates.filter(c => c._amount > 0 && c._amount <= targetAmount + tolerance).slice(0, 18);
  let bestMatch: T[] | null = null;
  let bestDiff = Infinity;

  const dfs = (startIdx: number, current: T[], currentSum: number) => {
    const diff = Math.abs(currentSum - targetAmount);
    if (current.length >= 2 && diff <= tolerance && diff < bestDiff) {
      bestDiff = diff;
      bestMatch = [...current];
      if (diff < 0.02) return true;
    }
    if (current.length >= maxLen || currentSum > targetAmount + tolerance) return false;

    for (let i = startIdx; i < pool.length; i++) {
      current.push(pool[i]);
      const foundExact = dfs(i + 1, current, currentSum + pool[i]._amount);
      current.pop();
      if (foundExact) return true;
    }
    return false;
  };

  dfs(0, [], 0);
  return bestMatch;
}

export default function AsignacionXmlModal({
  isOpen,
  onClose,
  onSuccess,
  initialMonth,
  initialSelectedPedidoIds,
  initialSelectedXmlIds
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

  // Datos
  const [loading, setLoading] = useState(true);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Selecciones Múltiples N:M (ambos paneles soportan 1 o múltiples elementos)
  const [selectedXmlIds, setSelectedXmlIds] = useState<string[]>([]);
  const [selectedPedidoIds, setSelectedPedidoIds] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);

  // Opciones al vincular
  const [actualizarEstatusPago, setActualizarEstatusPago] = useState(true);
  const [marcarFacturadoCompleto, setMarcarFacturadoCompleto] = useState(false);

  // Filtros
  const [filtroXmlEstatus, setFiltroXmlEstatus] = useState<'pendientes' | 'parciales' | 'asignadas' | 'todas'>('pendientes');
  const [busquedaXml, setBusquedaXml] = useState('');
  const [filtroPedidoEstatus, setFiltroPedidoEstatus] = useState<'pendientes' | 'parciales' | 'facturados' | 'todos'>('pendientes');
  const [soloCoincidentes, setSoloCoincidentes] = useState(false);
  const [busquedaPedido, setBusquedaPedido] = useState('');

  // Fallback visor CFDI
  const [cfdiViewerUrl, setCfdiViewerUrl] = useState<string | null>(null);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);

  // Actualizar mes y preselecciones al abrir
  useEffect(() => {
    if (isOpen) {
      const m = initialMonth || periodMonth;
      if (m) setActiveMonth(m);
      setSelectedPedidoIds(initialSelectedPedidoIds || []);
      setSelectedXmlIds(initialSelectedXmlIds || []);
    }
  }, [isOpen, initialMonth, periodMonth, initialSelectedPedidoIds, initialSelectedXmlIds]);

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

  // Carga de datos con relación N:M facturas_clientes_pedidos
  const fetchData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) {
        setLoading(false);
        return;
      }

      const [fRes, pRes] = await Promise.all([
        supabase
          .from('facturas_clientes')
          .select('*, clientes(id, nombre_local, razon_social, rfc), pedidos(id, numero_pedido, precio_total, cliente_nombre), facturas_clientes_pedidos(id, pedido_id, monto_asignado, pedidos(id, numero_pedido, precio_total, cliente_nombre))')
          .eq('empresa_id', empresaId)
          .order('fecha_emision', { ascending: false }),
        supabase
          .from('pedidos')
          .select('*, clientes(id, nombre_local, razon_social, rfc), facturas_clientes(*), facturas_clientes_pedidos(id, factura_id, monto_asignado, facturas_clientes(id, serie_folio, uuid_fiscal, total)), movimientos_bancarios(id, fecha, concepto, monto)')
          .eq('empresa_id', empresaId)
          .neq('estatus_pago', 'Cancelado')
          .order('fecha_pedido', { ascending: false }),
      ]);

      if (fRes.error) throw fRes.error;
      if (pRes.error) throw pRes.error;

      setFacturas(fRes.data || []);
      setPedidos(pRes.data || []);
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

  // Enriquecer Facturas y Pedidos con saldos N:M
  const facturasEnriquecidas = useMemo(() => {
    return facturas.map(f => {
      const totalXml = cleanNumber(f.total);
      const jLinks = Array.isArray(f.facturas_clientes_pedidos) ? f.facturas_clientes_pedidos : [];
      const pedidosVinculados: { id: string; numero_pedido?: any; precio_total?: number; monto_asignado: number }[] = [];

      jLinks.forEach((jl: any) => {
        const pObj = Array.isArray(jl.pedidos) ? jl.pedidos[0] : jl.pedidos;
        if (jl.pedido_id) {
          pedidosVinculados.push({
            id: jl.pedido_id,
            numero_pedido: pObj?.numero_pedido,
            precio_total: cleanNumber(pObj?.precio_total),
            monto_asignado: cleanNumber(jl.monto_asignado || totalXml),
          });
        }
      });

      if (pedidosVinculados.length === 0 && f.pedido_id) {
        const pObj = Array.isArray(f.pedidos) ? f.pedidos[0] : f.pedidos;
        pedidosVinculados.push({
          id: f.pedido_id,
          numero_pedido: pObj?.numero_pedido,
          precio_total: cleanNumber(pObj?.precio_total),
          monto_asignado: totalXml,
        });
      }

      const montoAsignado = cleanNumber(pedidosVinculados.reduce((acc, item) => acc + item.monto_asignado, 0));
      const saldoDisponible = Math.max(0, cleanNumber(totalXml - montoAsignado));
      const esParcial = pedidosVinculados.length > 0 && saldoDisponible > 0.05;
      const esAsignadaCompleta = pedidosVinculados.length > 0 && saldoDisponible <= 0.05;

      return {
        ...f,
        _totalXml: totalXml,
        _pedidosVinculados: pedidosVinculados,
        _montoAsignado: montoAsignado,
        _saldoDisponible: pedidosVinculados.length === 0 ? totalXml : saldoDisponible,
        _esParcial: esParcial,
        _esAsignadaCompleta: esAsignadaCompleta,
      };
    });
  }, [facturas]);

  const pedidosEnriquecidos = useMemo(() => {
    return pedidos.map(p => {
      const totalPedido = cleanNumber(p.precio_total);
      const jLinks = Array.isArray(p.facturas_clientes_pedidos) ? p.facturas_clientes_pedidos : [];
      const facturasVinculadasMap = new Map<string, { id: string; serie_folio?: string; uuid_fiscal?: string; total: number; monto_asignado: number }>();

      jLinks.forEach((jl: any) => {
        const fc = Array.isArray(jl.facturas_clientes) ? jl.facturas_clientes[0] : jl.facturas_clientes;
        const fId = jl.factura_id || fc?.id;
        if (fId) {
          facturasVinculadasMap.set(fId, {
            id: fId,
            serie_folio: fc?.serie_folio,
            uuid_fiscal: fc?.uuid_fiscal,
            total: cleanNumber(fc?.total),
            monto_asignado: cleanNumber(jl.monto_asignado || fc?.total),
          });
        }
      });

      (Array.isArray(p.facturas_clientes) ? p.facturas_clientes : []).forEach((fc: any) => {
        if (fc?.id && !facturasVinculadasMap.has(fc.id)) {
          facturasVinculadasMap.set(fc.id, {
            id: fc.id,
            serie_folio: fc.serie_folio,
            uuid_fiscal: fc.uuid_fiscal,
            total: cleanNumber(fc.total),
            monto_asignado: cleanNumber(fc.total),
          });
        }
      });

      const facturasVinculadas = Array.from(facturasVinculadasMap.values());
      const montoFacturado = cleanNumber(facturasVinculadas.reduce((acc, item) => acc + item.monto_asignado, 0));
      const saldoPorFacturar = Math.max(0, cleanNumber(totalPedido - montoFacturado));
      const tieneFolioManual = facturasVinculadas.length === 0 && !!p.folio_factura;
      const esParcial = facturasVinculadas.length > 0 && saldoPorFacturar > 0.05;
      const esFacturadoCompleto = (facturasVinculadas.length > 0 && saldoPorFacturar <= 0.05) || tieneFolioManual;

      return {
        ...p,
        _totalPedido: totalPedido,
        _facturasVinculadas: facturasVinculadas,
        _montoFacturado: montoFacturado,
        _saldoPorFacturar: facturasVinculadas.length === 0 ? totalPedido : saldoPorFacturar,
        _esParcial: esParcial,
        _esFacturadoCompleto: esFacturadoCompleto,
      };
    });
  }, [pedidos]);

  // Filtrado por mes
  const facturasDelMes = useMemo(() => {
    return facturasEnriquecidas.filter(f => {
      if (!filtrarPorMes) return true;
      const m = getDocMonth(f.fecha_emision || f.fecha_timbrado || f.created_at);
      return m === activeMonth;
    });
  }, [facturasEnriquecidas, activeMonth, filtrarPorMes]);

  const pedidosDelMes = useMemo(() => {
    return pedidosEnriquecidos.filter(p => {
      if (!filtrarPorMes) return true;
      const m = getDocMonth(p.fecha_pedido || p.creado_en);
      return m === activeMonth;
    });
  }, [pedidosEnriquecidos, activeMonth, filtrarPorMes]);

  // Elementos seleccionados actualmente
  const selectedXmls = useMemo(() => {
    return facturasEnriquecidas.filter(f => selectedXmlIds.includes(f.id));
  }, [facturasEnriquecidas, selectedXmlIds]);

  const selectedPedidos = useMemo(() => {
    return pedidosEnriquecidos.filter(p => selectedPedidoIds.includes(p.id));
  }, [pedidosEnriquecidos, selectedPedidoIds]);

  const activeXml = selectedXmls.length === 1 ? selectedXmls[0] : null;
  const activePedido = selectedPedidos.length === 1 ? selectedPedidos[0] : null;

  const totalXmlSeleccionados = useMemo(() => {
    return cleanNumber(selectedXmls.reduce((sum, f) => sum + (f._saldoDisponible > 0 ? f._saldoDisponible : f._totalXml), 0));
  }, [selectedXmls]);

  const totalPedidosSeleccionados = useMemo(() => {
    return cleanNumber(selectedPedidos.reduce((sum, p) => sum + (p._saldoPorFacturar > 0 ? p._saldoPorFacturar : p._totalPedido), 0));
  }, [selectedPedidos]);

  const toggleSelectXml = (id: string) => {
    setSelectedXmlIds(prev =>
      prev.includes(id) ? prev.filter(xId => xId !== id) : [...prev, id]
    );
  };

  const toggleSelectPedido = (id: string) => {
    setSelectedPedidoIds(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  // Helper de coincidencia entre un pedido y un XML
  const checkCoincidencia = useCallback((p: any, xml: any) => {
    if (!xml || !p) return { isMatch: false, isExact: false, dif: 0, tipo: '' };

    const xmlTarget = xml._saldoDisponible > 0 ? xml._saldoDisponible : cleanNumber(xml.total);
    const xmlSubtotal = cleanNumber(xml.subtotal);
    const pTarget = p._saldoPorFacturar > 0 ? p._saldoPorFacturar : cleanNumber(p.precio_total);
    const pEnvio = cleanNumber(p.costo_envio);
    const pNeto = pEnvio > 0 ? cleanNumber(pTarget - pEnvio) : pTarget;

    const difTotal = Math.abs(pTarget - xmlTarget);
    const difSubtotal = xmlSubtotal > 0 ? Math.abs(pTarget - xmlSubtotal) : 999;
    const difNeto = pEnvio > 0 ? Math.abs(pNeto - xmlTarget) : 999;

    if (difTotal < 0.05) {
      return { isMatch: true, isExact: true, dif: pTarget - xmlTarget, tipo: 'total_exacto' };
    }
    if (difSubtotal < 0.05) {
      return { isMatch: true, isExact: true, dif: pTarget - xmlSubtotal, tipo: 'subtotal_exacto' };
    }
    if (difNeto < 0.05) {
      return { isMatch: true, isExact: true, dif: pNeto - xmlTarget, tipo: 'sin_envio' };
    }
    if (difTotal <= 0.50) {
      return { isMatch: true, isExact: false, dif: pTarget - xmlTarget, tipo: 'centavos' };
    }

    return { isMatch: false, isExact: false, dif: pTarget - xmlTarget, tipo: '' };
  }, []);

  // Detector Combinatorio Subset-Sum:
  // 1) Si hay 1 XML seleccionado (o varios XMLs) y la suma de 2..5 pedidos pendientes del mismo cliente cuadra con totalXmlSeleccionados
  const sugerenciaGrupoPedidos = useMemo(() => {
    if (selectedXmls.length === 0) return null;
    const targetMonto = totalXmlSeleccionados;
    if (targetMonto <= 0) return null;

    // Si ya hay un pedido 1 a 1 con monto exacto, aún podemos sugerir grupos si no hay exacto o como alternativa
    const refXml = selectedXmls[0];
    const targetRfc = (refXml.rfc_receptor || refXml.clientes?.rfc || '').trim().toUpperCase();
    const targetCliente = (refXml.clientes?.nombre_local || refXml.razon_social_receptor || '').trim().toLowerCase();

    const disponibles = pedidosDelMes.filter(p => !p._esFacturadoCompleto && p._saldoPorFacturar > 0);
    const delMismoCliente = disponibles.filter(p => {
      const rfcP = (p.clientes?.rfc || '').trim().toUpperCase();
      const nomP = (p.clientes?.nombre_local || p.cliente_nombre || '').trim().toLowerCase();
      return (targetRfc && rfcP === targetRfc) || (targetCliente && nomP.includes(targetCliente));
    });

    const poolPrioritario = (delMismoCliente.length >= 2 ? delMismoCliente : disponibles).map(p => ({
      ...p,
      _amount: p._saldoPorFacturar,
    }));

    return findSubsetSum(poolPrioritario, targetMonto, 0.5, 6);
  }, [selectedXmls, totalXmlSeleccionados, pedidosDelMes]);

  // 2) Si hay 1 Pedido seleccionado y la suma de 2..5 facturas XML del mismo cliente cuadra con el saldo del pedido
  const sugerenciaGrupoXmls = useMemo(() => {
    if (selectedPedidos.length === 0) return null;
    const targetMonto = totalPedidosSeleccionados;
    if (targetMonto <= 0) return null;

    const refPed = selectedPedidos[0];
    const targetRfc = (refPed.clientes?.rfc || '').trim().toUpperCase();
    const targetCliente = (refPed.clientes?.nombre_local || refPed.cliente_nombre || '').trim().toLowerCase();

    const disponibles = facturasDelMes.filter(f => !f._esAsignadaCompleta && f._saldoDisponible > 0);
    const delMismoCliente = disponibles.filter(f => {
      const rfcF = (f.rfc_receptor || f.clientes?.rfc || '').trim().toUpperCase();
      const nomF = (f.clientes?.nombre_local || f.razon_social_receptor || '').trim().toLowerCase();
      return (targetRfc && rfcF === targetRfc) || (targetCliente && nomF.includes(targetCliente));
    });

    const poolPrioritario = (delMismoCliente.length >= 2 ? delMismoCliente : disponibles).map(f => ({
      ...f,
      _amount: f._saldoDisponible,
    }));

    return findSubsetSum(poolPrioritario, targetMonto, 0.5, 5);
  }, [selectedPedidos, totalPedidosSeleccionados, facturasDelMes]);

  // Filtrado de Facturas XML (Panel Izquierdo)
  const facturasFiltradas = useMemo(() => {
    return facturasDelMes.filter(f => {
      const isSelected = selectedXmlIds.includes(f.id);
      if (!isSelected) {
        if (filtroXmlEstatus === 'pendientes' && f._esAsignadaCompleta) return false;
        if (filtroXmlEstatus === 'parciales' && !f._esParcial) return false;
        if (filtroXmlEstatus === 'asignadas' && f._pedidosVinculados.length === 0) return false;
      }

      if (busquedaXml.trim()) {
        const q = busquedaXml.toLowerCase();
        const folio = (f.serie_folio || '').toLowerCase();
        const uuid = (f.uuid_fiscal || '').toLowerCase();
        const rfc = (f.rfc_receptor || f.clientes?.rfc || '').toLowerCase();
        const cliente = (f.clientes?.nombre_local || f.razon_social_receptor || '').toLowerCase();
        const monto = (f.total || '').toString();

        if (!folio.includes(q) && !uuid.includes(q) && !rfc.includes(q) && !cliente.includes(q) && !monto.includes(q)) {
          return false;
        }
      }

      return true;
    }).map(f => {
      const coincs = pedidosDelMes.filter(p => !p._esFacturadoCompleto && checkCoincidencia(p, f).isMatch);
      // Si hay un pedido activo a la derecha, evaluar si esta factura es del mismo cliente o coincide
      const sameClientAsPedido = activePedido && (
        ((activePedido.clientes?.rfc || '').trim().toUpperCase() && (f.rfc_receptor || f.clientes?.rfc || '').trim().toUpperCase() === (activePedido.clientes?.rfc || '').trim().toUpperCase()) ||
        ((activePedido.clientes?.nombre_local || activePedido.cliente_nombre || '').toLowerCase() && (f.clientes?.nombre_local || f.razon_social_receptor || '').toLowerCase().includes((activePedido.clientes?.nombre_local || activePedido.cliente_nombre || '').toLowerCase()))
      );
      return {
        ...f,
        _matchingPedidosCount: coincs.length,
        _sameClientAsPedido: Boolean(sameClientAsPedido),
      };
    }).sort((a, b) => {
      if (activePedido && a._sameClientAsPedido !== b._sameClientAsPedido) {
        return a._sameClientAsPedido ? -1 : 1;
      }
      return 0;
    });
  }, [facturasDelMes, pedidosDelMes, filtroXmlEstatus, busquedaXml, checkCoincidencia, selectedXmlIds, activePedido]);

  // Filtrado de Pedidos (Panel Derecho)
  const pedidosProcesados = useMemo(() => {
    const list = pedidosDelMes.filter(p => {
      const isSelected = selectedPedidoIds.includes(p.id);
      const isLinkedToSelectedXml = selectedXmls.some(xml => xml._pedidosVinculados.some((pv: any) => pv.id === p.id));

      if (!isSelected && !isLinkedToSelectedXml) {
        if (filtroPedidoEstatus === 'pendientes' && p._esFacturadoCompleto) return false;
        if (filtroPedidoEstatus === 'parciales' && !p._esParcial) return false;
        if (filtroPedidoEstatus === 'facturados' && p._facturasVinculadas.length === 0 && !p.folio_factura) return false;
      }

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

    const refXml = selectedXmls[0] || null;
    const targetRfc = refXml ? (refXml.rfc_receptor || refXml.clientes?.rfc || '').trim().toUpperCase() : null;
    const targetCliente = refXml ? (refXml.clientes?.nombre_local || refXml.razon_social_receptor || '').trim().toLowerCase() : null;

    const mapped = list.map(p => {
      // Comparar contra la suma de XMLs seleccionados o contra el XML único
      const virtualXml = selectedXmls.length > 0
        ? { total: totalXmlSeleccionados, _saldoDisponible: totalXmlSeleccionados, subtotal: selectedXmls.length === 1 ? selectedXmls[0].subtotal : 0 }
        : null;

      const { isMatch, isExact, dif, tipo } = virtualXml ? checkCoincidencia(p, virtualXml) : { isMatch: false, isExact: false, dif: 0, tipo: '' };

      const isClientMatch = Boolean(
        (targetRfc && p.clientes?.rfc && p.clientes.rfc.trim().toUpperCase() === targetRfc) ||
        (targetCliente && (p.cliente_nombre || p.clientes?.nombre_local || '').toLowerCase().includes(targetCliente))
      );

      const isLinkedToSelectedXml = selectedXmls.some(xml => xml._pedidosVinculados.some((pv: any) => pv.id === p.id));
      const isInSuggestedGroup = Boolean(sugerenciaGrupoPedidos?.some(sp => sp.id === p.id));

      let score = 0;
      if (isLinkedToSelectedXml) score += 250;
      if (isExact) score += 120;
      else if (isMatch) score += 90;
      if (isInSuggestedGroup) score += 85;
      if (isClientMatch) score += 60;
      if (p._esParcial) score += 30;
      if (!p._esFacturadoCompleto) score += 20;

      return {
        ...p,
        _isMatch: isMatch,
        _isExact: isExact,
        _difMonto: dif,
        _matchTipo: tipo,
        _isClientMatch: isClientMatch,
        _isLinkedToThisXml: isLinkedToSelectedXml,
        _isInSuggestedGroup: isInSuggestedGroup,
        _matchScore: score,
      };
    });

    if (selectedXmls.length > 0 && soloCoincidentes) {
      const coincidentes = mapped.filter(p => p._isMatch || p._isLinkedToThisXml || p._isInSuggestedGroup || p._isClientMatch);
      if (coincidentes.length > 0) {
        return coincidentes.sort((a, b) => b._matchScore - a._matchScore);
      }
    }

    return mapped.sort((a, b) => {
      if (selectedXmls.length > 0) {
        if (b._matchScore !== a._matchScore) return b._matchScore - a._matchScore;
        const diffA = Math.abs(a._difMonto);
        const diffB = Math.abs(b._difMonto);
        if (diffA !== diffB) return diffA - diffB;
      }
      return (b.numero_pedido || 0) - (a.numero_pedido || 0);
    });
  }, [pedidosDelMes, selectedXmls, totalXmlSeleccionados, soloCoincidentes, filtroPedidoEstatus, busquedaPedido, checkCoincidencia, selectedPedidoIds, sugerenciaGrupoPedidos]);

  // KPIs del modal
  const kpis = useMemo(() => {
    const xmlPendientes = facturasDelMes.filter(f => !f._esAsignadaCompleta);
    const xmlParciales = facturasDelMes.filter(f => f._esParcial);
    const pedidosPendientes = pedidosDelMes.filter(p => !p._esFacturadoCompleto);
    const pedidosParciales = pedidosDelMes.filter(p => p._esParcial);

    let coincidenciasExactas = 0;
    xmlPendientes.forEach(xml => {
      const matches = pedidosPendientes.filter(ped => checkCoincidencia(ped, xml).isMatch);
      if (matches.length > 0) coincidenciasExactas++;
    });

    return {
      xmlPendientesCount: xmlPendientes.length,
      xmlParcialesCount: xmlParciales.length,
      pedidosPendientesCount: pedidosPendientes.length,
      pedidosParcialesCount: pedidosParciales.length,
      coincidenciasDisponibles: coincidenciasExactas,
    };
  }, [facturasDelMes, pedidosDelMes, checkCoincidencia]);

  // Vincular N Facturas <-> M Pedidos
  const handleVincular = async (customXmlIds?: string[], customPedidoIds?: string[]) => {
    const targetXmls = customXmlIds || selectedXmlIds;
    const targetPedidos = customPedidoIds || selectedPedidoIds;
    if (targetXmls.length === 0 || targetPedidos.length === 0) return;

    setProcessing(true);
    setMessage(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Sesión expirada.');

      const res = await vincularFacturaAPedido(targetXmls, targetPedidos, token, {
        actualizarEstatusPago,
        marcarFacturadoCompleto,
      });

      if (res.success) {
        const relLabel =
          targetXmls.length === 1 && targetPedidos.length > 1
            ? `1 Factura consolidada asignada a ${targetPedidos.length} pedidos`
            : targetXmls.length > 1 && targetPedidos.length === 1
            ? `${targetXmls.length} Facturas asignadas al pedido`
            : `${targetXmls.length} Factura(s) vinculada(s) con ${targetPedidos.length} pedido(s)`;

        setMessage({ text: `¡Listo! ${relLabel}.`, type: 'success' });
        setSelectedXmlIds([]);
        setSelectedPedidoIds([]);
        setMarcarFacturadoCompleto(false);
        await fetchData();
        onSuccess?.();
      } else {
        throw new Error(res.error || 'No se pudo realizar la vinculación.');
      }
    } catch (err: any) {
      setMessage({ text: `Error al vincular: ${err.message}`, type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // Desvincular (total o un par específico factura-pedido)
  const handleDesvincular = async (xmlId: string, pedidoIdEspecifico?: string) => {
    const msg = pedidoIdEspecifico
      ? '¿Deseas desvincular esta factura únicamente de este pedido?'
      : '¿Deseas desvincular esta factura de todos sus pedidos asociados?';
    if (!confirm(msg)) return;

    setProcessing(true);
    setMessage(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Sesión expirada.');

      const res = await desvincularFacturaDePedido(xmlId, token, pedidoIdEspecifico);
      if (res.success) {
        setMessage({ text: 'Vínculo eliminado correctamente.', type: 'info' });
        await fetchData();
        onSuccess?.();
      } else {
        throw new Error(res.error || 'No se pudo desvincular.');
      }
    } catch (err: any) {
      setMessage({ text: `Error al desvincular: ${err.message}`, type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  // Auto-Asignación Masiva (1 a 1 exactos no ambiguos)
  const handleAutoAsignar = async () => {
    const unlinkedXmls = facturasDelMes.filter(f => f._pedidosVinculados.length === 0);
    const unlinkedPedidos = pedidosDelMes.filter(p => !p._esFacturadoCompleto && p._facturasVinculadas.length === 0);

    const parejas: { xmlId: string; pedidoId: string; monto: number }[] = [];
    const usedPedidosIds = new Set<string>();

    unlinkedXmls.forEach(xml => {
      const candidates = unlinkedPedidos.filter(ped => !usedPedidosIds.has(ped.id) && checkCoincidencia(ped, xml).isMatch);
      if (candidates.length === 1) {
        parejas.push({
          xmlId: xml.id,
          pedidoId: candidates[0].id,
          monto: cleanNumber(xml.total),
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
        const res = await vincularFacturaAPedido(p.xmlId, p.pedidoId, token, { actualizarEstatusPago });
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

  const diferenciaSeleccion = cleanNumber(totalPedidosSeleccionados - totalXmlSeleccionados);
  const cuadraExacto = selectedXmlIds.length > 0 && selectedPedidoIds.length > 0 && Math.abs(diferenciaSeleccion) <= 0.5;
  const quedaráParcialPedido = selectedXmlIds.length > 0 && selectedPedidoIds.length > 0 && diferenciaSeleccion > 0.5;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 transition-all animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-7xl shadow-2xl h-[94vh] flex flex-col font-sans overflow-hidden">

        {/* CABECERA PRINCIPAL: TÍTULO, SELECTOR DE MES Y ACCIONES */}
        <div className="p-3.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Layers size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                  Mesa de Conciliación Fiscal: Facturas XML ↔ Pedidos
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Soporta 1:N (Consolidadas) · N:1 (Parciales) · N:M
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Marca <strong>1 o varias Facturas XML</strong> a la izquierda y <strong>1 o varios Pedidos</strong> a la derecha para vincularlos.
              </p>
            </div>
          </div>

          {/* SELECTOR DE MES */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 p-1 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1.5 px-2 font-mono text-xs font-bold text-gray-800 dark:text-gray-200">
              <Calendar size={13} className="text-indigo-500" />
              <span>{activeMonth}</span>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>

            <label className="flex items-center gap-1 pl-2 border-l border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 cursor-pointer select-none pr-1">
              <input
                type="checkbox"
                checked={!filtrarPorMes}
                onChange={e => setFiltrarPorMes(!e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
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
              title="Vincular automáticamente parejas 1 a 1 con monto exacto no ambiguo del mes"
            >
              <Sparkles size={13} className={autoMatching ? 'animate-spin' : ''} />
              <span>{autoMatching ? 'Procesando...' : `Auto-Asignar 1:1 (${kpis.coincidenciasDisponibles})`}</span>
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
              <span className="font-semibold">{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-gray-400 font-bold cursor-pointer">×</button>
          </div>
        )}

        {/* CUERPO PRINCIPAL: LADO A LADO */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 p-3 min-h-0 overflow-hidden bg-gray-50/40 dark:bg-gray-900/20">

          {/* ── PANEL IZQUIERDO: FACTURAS XML (Soporta Multi-Select) ──────────────── */}
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden shadow-xs">
            {/* Cabecera & Filtros XML */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 shrink-0 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5">
                  <FileCode className="text-amber-500 w-4 h-4" />
                  <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                    1. Facturas XML ({facturasFiltradas.length})
                  </span>
                  {selectedXmlIds.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">
                      {selectedXmlIds.length} marcada{selectedXmlIds.length > 1 ? 's' : ''} ({formatCurrency(totalXmlSeleccionados)})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-800/60 p-0.5 rounded-lg text-[10px]">
                  <button
                    onClick={() => setFiltroXmlEstatus('pendientes')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                      filtroXmlEstatus === 'pendientes'
                        ? 'bg-white dark:bg-gray-950 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Disponibles ({kpis.xmlPendientesCount})
                  </button>
                  {kpis.xmlParcialesCount > 0 && (
                    <button
                      onClick={() => setFiltroXmlEstatus('parciales')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        filtroXmlEstatus === 'parciales'
                          ? 'bg-white dark:bg-gray-950 text-indigo-600 dark:text-indigo-400 shadow-xs'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      Parciales ({kpis.xmlParcialesCount})
                    </button>
                  )}
                  <button
                    onClick={() => setFiltroXmlEstatus('asignadas')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                      filtroXmlEstatus === 'asignadas'
                        ? 'bg-white dark:bg-gray-950 text-emerald-600 dark:text-emerald-400 shadow-xs'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Asignadas
                  </button>
                  <button
                    onClick={() => setFiltroXmlEstatus('todas')}
                    className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
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

              {/* BANNER DE SUGERENCIA N:1 (Múltiples XMLs que suman el Pedido seleccionado) */}
              {sugerenciaGrupoXmls && sugerenciaGrupoXmls.length >= 2 && (
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-50 to-emerald-50 dark:from-amber-950/40 dark:to-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-[11px] flex items-center justify-between gap-2 animate-in fade-in duration-200">
                  <div className="min-w-0">
                    <div className="font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <Sparkles size={12} className="text-emerald-500 shrink-0" />
                      <span>Suma de {sugerenciaGrupoXmls.length} Facturas XML cuadra con el Pedido:</span>
                    </div>
                    <div className="text-[10px] text-gray-600 dark:text-gray-300 font-mono truncate mt-0.5">
                      {sugerenciaGrupoXmls.map(x => `${x.serie_folio || 'XML'} (${formatCurrency(x._amount)})`).join(' + ')} = <strong>{formatCurrency(sugerenciaGrupoXmls.reduce((s, x) => s + x._amount, 0))}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedXmlIds(sugerenciaGrupoXmls.map(x => x.id))}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shrink-0 cursor-pointer shadow-xs"
                  >
                    Marcar {sugerenciaGrupoXmls.length} XMLs
                  </button>
                </div>
              )}
            </div>

            {/* Lista XML */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-2 space-y-1.5">
              {facturasFiltradas.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No hay facturas XML con los filtros actuales en el mes {activeMonth}.
                </div>
              ) : (
                facturasFiltradas.map((f) => {
                  const isSelected = selectedXmlIds.includes(f.id);
                  const pedidosVinc = f._pedidosVinculados || [];
                  const isAssigned = pedidosVinc.length > 0;
                  const clientName = f.clientes?.nombre_local || f.clientes?.razon_social || f.razon_social_receptor || 'Cliente';
                  const rfc = f.rfc_receptor || f.clientes?.rfc || 'S/N';
                  const folio = f.serie_folio || (f.uuid_fiscal ? f.uuid_fiscal.substring(0, 8) : 'Sin Folio');
                  const matchingCount = f._matchingPedidosCount || 0;

                  return (
                    <div
                      key={f.id}
                      onClick={() => toggleSelectXml(f.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-2 ring-amber-500/30'
                          : f._esParcial
                          ? 'border-indigo-300 dark:border-indigo-800/60 bg-indigo-50/20 dark:bg-indigo-950/15 hover:border-indigo-500'
                          : isAssigned
                          ? 'border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/20 hover:border-gray-300'
                          : matchingCount > 0 || f._sameClientAsPedido
                          ? 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-500'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-amber-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-gray-300 dark:border-gray-700 pointer-events-none mt-0.5 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs text-gray-900 dark:text-white font-mono">
                                Folio: {folio}
                              </span>

                              {f._esParcial ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                                  Disp: {formatCurrency(f._saldoDisponible)}
                                </span>
                              ) : isAssigned ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                  <CheckCircle size={9} /> {pedidosVinc.length > 1 ? `${pedidosVinc.length} Pedidos` : `Pedido #${pedidosVinc[0]?.numero_pedido || pedidosVinc[0]?.id?.substring(0, 5)}`}
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

                              {f._sameClientAsPedido && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                  Mismo Cliente
                                </span>
                              )}
                            </div>

                            <div className="font-semibold text-xs text-gray-800 dark:text-gray-200 truncate mt-0.5">
                              {clientName}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2">
                              <span>RFC: {rfc}</span>
                              <span>·</span>
                              <span>{f.fecha_emision ? formatDate(f.fecha_emision) : 'Sin fecha'}</span>
                            </div>

                            {/* Chips de pedidos ya vinculados a este XML */}
                            {pedidosVinc.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                                {pedidosVinc.map((pv: any) => (
                                  <span
                                    key={pv.id}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                  >
                                    <span>#PED-{pv.numero_pedido || pv.id.substring(0, 5)} ({formatCurrency(pv.monto_asignado)})</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDesvincular(f.id, pv.id)}
                                      className="hover:text-red-500 ml-0.5 cursor-pointer"
                                      title="Desvincular este pedido de la factura"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}

                            {f.uuid_fiscal && (
                              <div className="text-[9px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                                <span>UUID: {f.uuid_fiscal.substring(0, 14)}...</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyUuid(f.uuid_fiscal);
                                  }}
                                  className="text-gray-400 hover:text-gray-600 cursor-pointer"
                                  title="Copiar UUID"
                                >
                                  {copiedUuid === f.uuid_fiscal ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                            {formatCurrency(f.total)}
                          </div>
                          {f._esParcial && (
                            <div className="text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              Libre: {formatCurrency(f._saldoDisponible)}
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                            {f.xml_url && (
                              <button
                                type="button"
                                onClick={() => handleViewCfdi(f.xml_url)}
                                className="p-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors cursor-pointer"
                                title="Ver CFDI XML"
                              >
                                <Eye size={12} />
                              </button>
                            )}
                            {f.pdf_url && (
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(f.pdf_url)}
                                className="p-1 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors cursor-pointer"
                                title="Descargar PDF"
                              >
                                <FileText size={12} />
                              </button>
                            )}
                            {isAssigned && (
                              <button
                                type="button"
                                disabled={processing}
                                onClick={() => handleDesvincular(f.id)}
                                className="p-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
                                title="Desvincular de todos los pedidos"
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

          {/* ── PANEL DERECHO: PEDIDOS DE VENTA (Soporta Multi-Select) ──────────── */}
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden shadow-xs">
            {/* Cabecera & Filtros Pedidos */}
            <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 shrink-0 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Receipt className="text-blue-500 w-4 h-4" />
                  <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                    2. Pedidos de Venta ({pedidosProcesados.length})
                  </span>
                  {selectedPedidoIds.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white">
                      {selectedPedidoIds.length} marcado{selectedPedidoIds.length > 1 ? 's' : ''} ({formatCurrency(totalPedidosSeleccionados)})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-800/60 p-0.5 rounded-lg text-[10px]">
                    <button
                      onClick={() => setFiltroPedidoEstatus('pendientes')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        filtroPedidoEstatus === 'pendientes'
                          ? 'bg-white dark:bg-gray-950 text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Por Facturar ({kpis.pedidosPendientesCount})
                    </button>
                    {kpis.pedidosParcialesCount > 0 && (
                      <button
                        onClick={() => setFiltroPedidoEstatus('parciales')}
                        className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                          filtroPedidoEstatus === 'parciales'
                            ? 'bg-white dark:bg-gray-950 text-indigo-600 dark:text-indigo-400 shadow-xs'
                            : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        Parciales ({kpis.pedidosParcialesCount})
                      </button>
                    )}
                    <button
                      onClick={() => setFiltroPedidoEstatus('facturados')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        filtroPedidoEstatus === 'facturados'
                          ? 'bg-white dark:bg-gray-950 text-emerald-600 dark:text-emerald-400 shadow-xs'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Facturados
                    </button>
                    <button
                      onClick={() => setFiltroPedidoEstatus('todos')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${
                        filtroPedidoEstatus === 'todos'
                          ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-white shadow-xs'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Todos
                    </button>
                  </div>

                  {selectedXmls.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSoloCoincidentes(prev => !prev)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                        soloCoincidentes
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300'
                      }`}
                    >
                      <Filter size={10} />
                      <span>{soloCoincidentes ? '✓ Filtro Cliente/Monto' : 'Filtrar Coincidentes'}</span>
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

              {/* BANNER DE SUGERENCIA 1:N (Combinación de Pedidos que suman la Factura XML seleccionada) */}
              {sugerenciaGrupoPedidos && sugerenciaGrupoPedidos.length >= 2 && (
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-300 dark:border-emerald-800 text-[11px] flex items-center justify-between gap-2 animate-in fade-in duration-200">
                  <div className="min-w-0">
                    <div className="font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <Sparkles size={12} className="text-emerald-500 shrink-0" />
                      <span>Combinación Exacta ({sugerenciaGrupoPedidos.length} pedidos suman {formatCurrency(sugerenciaGrupoPedidos.reduce((s, p) => s + p._amount, 0))}):</span>
                    </div>
                    <div className="text-[10px] text-gray-600 dark:text-gray-300 font-mono truncate mt-0.5">
                      {sugerenciaGrupoPedidos.map(p => `#${p.numero_pedido} (${formatCurrency(p._amount)})`).join(' + ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedPedidoIds(sugerenciaGrupoPedidos.map(p => p.id))}
                      className="px-2 py-1 rounded-lg bg-white dark:bg-gray-900 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold text-[10px] cursor-pointer"
                    >
                      Seleccionar
                    </button>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleVincular(selectedXmlIds, sugerenciaGrupoPedidos.map(p => p.id))}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer shadow-xs"
                    >
                      Vincular Grupo
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Lista Pedidos */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-2 space-y-1.5">
              {pedidosProcesados.length === 0 ? (
                <div className="text-center py-14 px-4">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle size={20} />
                  </div>
                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    No hay pedidos con los filtros actuales
                  </h4>
                  <p className="text-[11px] text-gray-400 max-w-sm mx-auto mt-1">
                    Puedes cambiar el filtro a &ldquo;Todos&rdquo; o desactivar &ldquo;Filtro Cliente/Monto&rdquo;.
                  </p>
                </div>
              ) : (
                pedidosProcesados.map((p) => {
                  const isSelected = selectedPedidoIds.includes(p.id);
                  const clientName = p.clientes?.nombre_local || p.cliente_nombre || 'Cliente General';
                  const rfc = p.clientes?.rfc || 'S/N';
                  const isMatch = p._isMatch;
                  const isExact = p._isExact;
                  const isLinkedToThis = p._isLinkedToThisXml;
                  const facturasVinc = p._facturasVinculadas || [];

                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleSelectPedido(p.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 shadow-xs ring-2 ring-blue-500/30'
                          : isLinkedToThis
                          ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                          : isExact
                          ? 'border-emerald-500/70 bg-emerald-500/10 hover:border-emerald-500 font-medium'
                          : p._isInSuggestedGroup
                          ? 'border-teal-500/70 bg-teal-50/30 dark:bg-teal-950/20 hover:border-teal-500'
                          : p._esParcial
                          ? 'border-indigo-300 dark:border-indigo-800/60 bg-indigo-50/20 dark:bg-indigo-950/15 hover:border-indigo-500'
                          : isMatch
                          ? 'border-teal-400/60 bg-teal-50/20 dark:bg-teal-950/20 hover:border-teal-500'
                          : p._esFacturadoCompleto
                          ? 'border-gray-100 dark:border-gray-800/60 bg-gray-50/40 dark:bg-gray-900/20 opacity-75'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 hover:border-blue-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-700 pointer-events-none mt-0.5 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs text-gray-900 dark:text-white">
                                Pedido #{p.numero_pedido}
                              </span>

                              {isLinkedToThis ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-600 text-white shadow-xs">
                                  <CheckCircle size={9} /> Vinculado al XML
                                </span>
                              ) : isExact ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500 text-white shadow-xs">
                                  <Sparkles size={9} /> Monto Exacto
                                </span>
                              ) : p._isInSuggestedGroup ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-teal-600 text-white shadow-xs">
                                  <Sparkles size={9} /> Parte de Suma Exacta
                                </span>
                              ) : null}

                              {p._esParcial ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                                  Parcial: Falta {formatCurrency(p._saldoPorFacturar)}
                                </span>
                              ) : p._esFacturadoCompleto ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                  Facturado 100%
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  Sin Factura
                                </span>
                              )}

                              {p._isClientMatch && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                                  Mismo Cliente
                                </span>
                              )}

                              {(p.movimiento_bancario_id || p.movimientos_bancarios) && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  <Landmark size={9} /> Banco
                                </span>
                              )}
                            </div>

                            <div className="font-semibold text-xs text-gray-800 dark:text-gray-200 truncate mt-0.5">
                              {clientName}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2">
                              <span>RFC: {rfc}</span>
                              <span>·</span>
                              <span>{p.fecha_pedido ? formatDate(p.fecha_pedido) : 'Sin fecha'}</span>
                              <span>·</span>
                              <span>{p.estatus_pago || 'No liquidado'}</span>
                            </div>

                            {/* Chips de facturas ya vinculadas a este pedido */}
                            {facturasVinc.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                                {facturasVinc.map((fv: any) => (
                                  <span
                                    key={fv.id}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                  >
                                    <span>XML {fv.serie_folio || fv.uuid_fiscal?.substring(0, 6)} ({formatCurrency(fv.monto_asignado)})</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDesvincular(fv.id, p.id)}
                                      className="hover:text-red-500 ml-0.5 cursor-pointer"
                                      title="Desvincular esta factura del pedido"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono">
                            {formatCurrency(p.precio_total)}
                          </div>
                          {p._esParcial && (
                            <div className="text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              Cubierto: {formatCurrency(p._montoFacturado)}
                            </div>
                          )}

                          {selectedXmls.length > 0 && !isLinkedToThis && (
                            <button
                              type="button"
                              disabled={processing}
                              onClick={(e) => {
                                e.stopPropagation();
                                const targetPedidos = selectedPedidoIds.length > 0 && selectedPedidoIds.includes(p.id)
                                  ? selectedPedidoIds
                                  : [p.id];
                                handleVincular(selectedXmlIds, targetPedidos);
                              }}
                              className={`mt-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 shadow-xs ml-auto cursor-pointer ${
                                isExact
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                              }`}
                            >
                              <Link2 size={11} />
                              <span>
                                {selectedPedidoIds.length > 1 && selectedPedidoIds.includes(p.id)
                                  ? `Vincular (${selectedPedidoIds.length})`
                                  : p._esParcial
                                  ? 'Sumar XML'
                                  : 'Asignar'}
                              </span>
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

        {/* ── BARRA INFERIOR DE CONCILIACIÓN N:M ────────────────────────────── */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col gap-2 shrink-0 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Resumen XMLs */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
                <FileCode size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-gray-400 block">
                  {selectedXmlIds.length > 1 ? `Facturas XML (${selectedXmlIds.length})` : 'Factura XML'}
                </span>
                {selectedXmlIds.length > 0 ? (
                  <span className="text-xs font-black text-gray-900 dark:text-white truncate block font-mono">
                    {selectedXmlIds.length === 1
                      ? `${selectedXmls[0]?.serie_folio || selectedXmls[0]?.uuid_fiscal?.substring(0, 8)} — ${formatCurrency(totalXmlSeleccionados)}`
                      : `${selectedXmlIds.length} Facturas XML — Suma: ${formatCurrency(totalXmlSeleccionados)}`}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">Marca 1 o más XMLs a la izquierda</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-900 text-[10px] font-extrabold text-gray-600 dark:text-gray-300">
              <span>{selectedXmlIds.length || 0} XML</span>
              <ArrowRight size={13} className="text-indigo-500" />
              <span>{selectedPedidoIds.length || 0} Pedido(s)</span>
            </div>

            {/* Resumen Pedidos */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
                <Receipt size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[9px] uppercase font-bold text-gray-400 block">
                  {selectedPedidoIds.length > 1 ? `Pedidos Seleccionados (${selectedPedidoIds.length})` : 'Pedido Seleccionado'}
                </span>
                {selectedPedidoIds.length > 0 ? (
                  <span className="text-xs font-black text-gray-900 dark:text-white truncate block font-mono">
                    {selectedPedidoIds.length === 1
                      ? `Pedido #${selectedPedidos[0]?.numero_pedido} — ${formatCurrency(totalPedidosSeleccionados)}`
                      : `${selectedPedidoIds.length} Pedidos — Suma: ${formatCurrency(totalPedidosSeleccionados)}`}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 italic">Marca 1 o más pedidos a la derecha</span>
                )}
              </div>
            </div>

            {/* Diferencia & Botón Principal */}
            <div className="flex items-center gap-3 shrink-0 ml-auto">
              {selectedXmlIds.length > 0 && selectedPedidoIds.length > 0 && (
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-gray-400 block">Balance / Diferencia</span>
                  <span className={`text-xs font-mono font-extrabold ${
                    cuadraExacto
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : quedaráParcialPedido
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {cuadraExacto
                      ? '✓ Cuadra Exacto ($0.00)'
                      : quedaráParcialPedido
                      ? `Falta por cubrir: ${formatCurrency(diferenciaSeleccion)}`
                      : `Saldo XML libre: ${formatCurrency(Math.abs(diferenciaSeleccion))}`}
                  </span>
                </div>
              )}

              {(selectedXmlIds.length > 0 || selectedPedidoIds.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedXmlIds([]);
                    setSelectedPedidoIds([]);
                  }}
                  className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 font-bold cursor-pointer"
                >
                  Limpiar
                </button>
              )}

              <button
                type="button"
                disabled={selectedXmlIds.length === 0 || selectedPedidoIds.length === 0 || processing}
                onClick={() => handleVincular()}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Check size={14} />
                <span>
                  {processing
                    ? 'Vinculando...'
                    : `Vincular ${selectedXmlIds.length} XML(s) ➔ ${selectedPedidoIds.length} Pedido(s)`}
                </span>
              </button>
            </div>
          </div>

          {/* Opciones de Liquidación y Cierre de Diferencia */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1.5 border-t border-gray-100 dark:border-gray-800/80 text-[11px] text-gray-600 dark:text-gray-400">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={actualizarEstatusPago}
                  onChange={e => setActualizarEstatusPago(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                />
                <span>Marcar pedidos como <strong>Liquidados</strong> y heredar forma de pago del XML</span>
              </label>

              {quedaráParcialPedido && (
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-indigo-700 dark:text-indigo-300 font-semibold">
                  <input
                    type="checkbox"
                    checked={marcarFacturadoCompleto}
                    onChange={e => setMarcarFacturadoCompleto(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                  />
                  <span>Dar pedido(s) por 100% facturados (ignorar diferencia de {formatCurrency(diferenciaSeleccion)} por envío/ajuste)</span>
                </label>
              )}
            </div>

            <span className="text-[10px] text-gray-400">
              Tip: Puedes seleccionar varios XML para un mismo pedido o 1 XML para varios pedidos.
            </span>
          </div>
        </div>

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
