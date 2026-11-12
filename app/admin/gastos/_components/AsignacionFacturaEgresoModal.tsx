'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useEmpresaId } from '../../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { usePeriod } from '../../../../lib/hooks/usePeriod';
import { formatCurrency, formatDate } from '../../../../lib/formatters';
import {
  asignarFacturaAMovimientoEgreso,
  desvincularFacturaDeMovimientoEgreso
} from '../reconciliationActions';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';
import {
  X, Search, RefreshCw, CheckCircle, AlertTriangle,
  FileCode, FileText, Upload, Link2, Unlink, Landmark,
  Receipt, ArrowRight, Sparkles, Eye, Calendar
} from 'lucide-react';

interface AsignacionFacturaEgresoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMonth?: string;
  initialMovimientoId?: string;
}

const getDocMonth = (dateVal: any): string => {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (str.length >= 7 && str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length >= 2) return `${parts[0]}-${parts[1].padStart(2, '0')}`;
  }
  return '';
};

export default function AsignacionFacturaEgresoModal({
  isOpen,
  onClose,
  onSuccess,
  initialMonth,
  initialMovimientoId
}: AsignacionFacturaEgresoModalProps) {
  const getSessionToken = useSessionToken();
  const getEmpresaId = useEmpresaId();
  const { selectedMonth: periodMonth } = usePeriod();
  const { openCfdi } = useCfdiViewer();

  const [activeMonth, setActiveMonth] = useState<string>(() => {
    return (
      initialMonth ||
      periodMonth ||
      (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      })()
    );
  });
  const [filtrarPorMes, setFiltrarPorMes] = useState(true);
  const [soloSinFactura, setSoloSinFactura] = useState(true);
  const [busquedaMov, setBusquedaMov] = useState('');
  const [busquedaFac, setBusquedaFac] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [facturasDisponibles, setFacturasDisponibles] = useState<any[]>([]);
  const [facturasHijasMap, setFacturasHijasMap] = useState<Record<string, any[]>>({});

  const [selectedMovId, setSelectedMovId] = useState<string>(initialMovimientoId || '');
  const [selectedFacturasIds, setSelectedFacturasIds] = useState<string[]>([]);
  const [rightTab, setRightTab] = useState<'sistema' | 'subir'>('sistema');

  const [uploadedXmlPaths, setUploadedXmlPaths] = useState<string[]>([]);
  const [uploadedPdfPaths, setUploadedPdfPaths] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (initialMovimientoId) {
      setSelectedMovId(initialMovimientoId);
    }
  }, [initialMovimientoId]);

  useEffect(() => {
    if (initialMonth) setActiveMonth(initialMonth);
  }, [initialMonth]);

  const fetchData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setMessage(null);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      // 1. Retiros bancarios con sus conciliaciones y gastos vinculados
      const { data: movsData, error: movsErr } = await supabase
        .from('movimientos_bancarios')
        .select(`
          *,
          cuentas_bancarias(nombre, banco),
          estatus_conciliacion_bancaria(clave, nombre, color),
          conciliaciones_bancarias(
            id,
            monto_asociado,
            gasto_id,
            gastos(id, concepto, monto, fecha_gasto, uuid_fiscal, xml_url, pdf_url, estatus_facturado, folio_factura, proveedores(id, nombre_comercial, rfc))
          )
        `)
        .eq('empresa_id', empresaId)
        .or('tipo_movimiento.eq.Retiro,retiro.gt.0,monto.lt.0')
        .order('fecha', { ascending: false })
        .limit(400);

      if (movsErr) throw movsErr;

      // 2. Facturas XML cargadas en 'gastos' aún sin movimiento bancario ni egreso padre
      const { data: facsData, error: facsErr } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto, uuid_fiscal, folio_factura, xml_url, pdf_url, metodo_pago, proveedores(id, nombre_comercial, rfc)')
        .eq('empresa_id', empresaId)
        .is('movimiento_bancario_id', null)
        .is('gasto_padre_id', null)
        .or('uuid_fiscal.not.is.null,xml_url.not.is.null')
        .order('fecha_gasto', { ascending: false })
        .limit(400);

      if (facsErr) throw facsErr;

      // 3. Facturas hijas ya asociadas a egresos padre (gasto_padre_id IS NOT NULL)
      const { data: hijasData } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto, uuid_fiscal, folio_factura, xml_url, pdf_url, gasto_padre_id, proveedores(nombre_comercial, rfc)')
        .eq('empresa_id', empresaId)
        .not('gasto_padre_id', 'is', null);

      const mapHijas: Record<string, any[]> = {};
      (hijasData || []).forEach((h: any) => {
        if (!mapHijas[h.gasto_padre_id]) mapHijas[h.gasto_padre_id] = [];
        mapHijas[h.gasto_padre_id].push(h);
      });

      setMovimientos(movsData || []);
      setFacturasDisponibles(facsData || []);
      setFacturasHijasMap(mapHijas);

      if (initialMovimientoId && (movsData || []).some((m: any) => m.id === initialMovimientoId)) {
        setSelectedMovId(initialMovimientoId);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Error al cargar datos de asignación.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [isOpen, getEmpresaId, initialMovimientoId]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setSelectedFacturasIds([]);
      setUploadedXmlPaths([]);
      setUploadedPdfPaths([]);
    }
  }, [isOpen, fetchData]);

  const movTieneFactura = useCallback(
    (m: any) => {
      if (m.xml_url) return true;
      const concs = (m.conciliaciones_bancarias as any[]) || [];
      return concs.some((c: any) => {
        const g = c.gastos;
        if (!g) return false;
        if (g.uuid_fiscal || g.xml_url) return true;
        return (facturasHijasMap[g.id] || []).length > 0;
      });
    },
    [facturasHijasMap]
  );

  const filteredMovimientos = useMemo(() => {
    return movimientos.filter((m) => {
      if (initialMovimientoId && m.id === initialMovimientoId) return true;
      if (filtrarPorMes && activeMonth) {
        const mMonth = getDocMonth(m.mes_conciliacion || m.fecha);
        if (mMonth && mMonth !== activeMonth) return false;
      }
      if (soloSinFactura && movTieneFactura(m)) return false;
      if (busquedaMov.trim()) {
        const q = busquedaMov.toLowerCase();
        const concs = (m.conciliaciones_bancarias as any[]) || [];
        const egresoText = concs.map((c: any) => `${c.gastos?.concepto || ''} ${c.gastos?.proveedores?.nombre_comercial || ''}`).join(' ').toLowerCase();
        const movMontoStr = String(Math.abs(Number(m.monto || m.retiro || 0)));
        return (
          (m.concepto || '').toLowerCase().includes(q) ||
          (m.referencia || '').toLowerCase().includes(q) ||
          movMontoStr.includes(q) ||
          egresoText.includes(q)
        );
      }
      return true;
    });
  }, [movimientos, filtrarPorMes, activeMonth, soloSinFactura, busquedaMov, movTieneFactura, initialMovimientoId]);

  const selectedMov = useMemo(
    () => movimientos.find((m) => m.id === selectedMovId) || null,
    [movimientos, selectedMovId]
  );

  const movMonto = selectedMov ? Math.abs(Number(selectedMov.monto || selectedMov.retiro || 0)) : 0;

  // Facturas ya asignadas al movimiento seleccionado (directas con XML o hijas de su egreso padre)
  const facturasYaAsignadas = useMemo(() => {
    if (!selectedMov) return [];
    const list: any[] = [];
    const concs = (selectedMov.conciliaciones_bancarias as any[]) || [];
    concs.forEach((c: any) => {
      const g = c.gastos;
      if (!g) return;
      if (g.uuid_fiscal || g.xml_url) list.push(g);
      const hijas = facturasHijasMap[g.id] || [];
      hijas.forEach((h: any) => list.push(h));
    });
    return list;
  }, [selectedMov, facturasHijasMap]);

  // Ordenar facturas disponibles priorizando coincidencias con el movimiento seleccionado
  const filteredFacturas = useMemo(() => {
    const q = busquedaFac.trim().toLowerCase();
    const list = facturasDisponibles.filter((f) => {
      if (!q) return true;
      const prov = Array.isArray(f.proveedores) ? f.proveedores[0] : f.proveedores;
      return (
        (f.concepto || '').toLowerCase().includes(q) ||
        (f.folio_factura || '').toLowerCase().includes(q) ||
        (f.uuid_fiscal || '').toLowerCase().includes(q) ||
        (prov?.nombre_comercial || '').toLowerCase().includes(q) ||
        (prov?.rfc || '').toLowerCase().includes(q) ||
        String(f.monto || '').includes(q)
      );
    });

    if (!selectedMov) return list;

    return [...list].sort((a, b) => {
      const diffA = Math.abs(Number(a.monto || 0) - movMonto);
      const diffB = Math.abs(Number(b.monto || 0) - movMonto);
      const matchA = diffA <= 1 ? 0 : 1;
      const matchB = diffB <= 1 ? 0 : 1;
      if (matchA !== matchB) return matchA - matchB;
      return diffA - diffB;
    });
  }, [facturasDisponibles, busquedaFac, selectedMov, movMonto]);

  const sumaFacturasSeleccionadas = useMemo(() => {
    return facturasDisponibles
      .filter((f) => selectedFacturasIds.includes(f.id))
      .reduce((sum, f) => sum + Math.abs(Number(f.monto || 0)), 0);
  }, [facturasDisponibles, selectedFacturasIds]);

  const handleUploadFiles = async (files: FileList | null, type: 'xml' | 'pdf') => {
    if (!files || files.length === 0) return;
    setUploadingFiles(true);
    setMessage(null);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) throw new Error('No se encontró empresa activa.');

      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${empresaId}/egresos/${Date.now()}_${cleanName}`;
        const { error } = await supabase.storage.from('facturas').upload(path, file, { upsert: true });
        if (error) throw error;
        uploaded.push(path);
      }

      if (type === 'xml') {
        setUploadedXmlPaths((prev) => [...prev, ...uploaded]);
      } else {
        setUploadedPdfPaths((prev) => [...prev, ...uploaded]);
      }
      setMessage({ text: `${uploaded.length} archivo(s) ${type.toUpperCase()} listo(s) para asignar.`, type: 'info' });
    } catch (err: any) {
      setMessage({ text: 'Error al subir archivo: ' + (err.message || err), type: 'error' });
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleAsignar = async () => {
    if (!selectedMov) return;
    setSaving(true);
    setMessage(null);
    try {
      const token = await getSessionToken();
      const res = await asignarFacturaAMovimientoEgreso(
        {
          movimientoId: selectedMov.id,
          facturasIds: selectedFacturasIds,
          uploadedXmlPaths,
          uploadedPdfPaths,
          storageProvider: 'Supabase'
        },
        token
      );

      if (!res.success) throw new Error(res.error || 'No se pudo asignar la factura.');

      setMessage({ text: 'Factura(s) asignada(s) correctamente al movimiento bancario.', type: 'success' });
      setSelectedFacturasIds([]);
      setUploadedXmlPaths([]);
      setUploadedPdfPaths([]);
      await fetchData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setMessage({ text: err.message || 'Error al asignar factura.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDesvincularFactura = async (facturaId: string) => {
    if (!selectedMov) return;
    if (!confirm('¿Deseas desvincular esta factura del movimiento bancario? El egreso original se conservará.')) return;
    setSaving(true);
    try {
      const token = await getSessionToken();
      const res = await desvincularFacturaDeMovimientoEgreso(selectedMov.id, facturaId, token);
      if (!res.success) throw new Error(res.error);
      setMessage({ text: 'Factura desvinculada del movimiento.', type: 'info' });
      await fetchData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setMessage({ text: err.message || 'Error al desvincular.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const diferencia = movMonto - sumaFacturasSeleccionadas;

  return (
    <div
      className="fixed inset-0 bg-black/65 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden text-gray-900 dark:text-gray-100 font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4 bg-gray-50/70 dark:bg-gray-900/50 shrink-0">
          <div>
            <h3 className="text-lg font-extrabold flex items-center gap-2 text-gray-900 dark:text-white">
              <Receipt className="text-amber-500" size={20} />
              Asignación de Facturas a Pagos Bancarios (Egresos)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-gray-700 dark:text-gray-300">1. Egreso</span>
              <ArrowRight size={11} />
              <span className="font-semibold text-gray-700 dark:text-gray-300">2. Pago en Estado de Cuenta</span>
              <ArrowRight size={11} />
              <span className="font-bold text-amber-600 dark:text-amber-400">3. Asignación de Factura (CFDI)</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
              title="Actualizar datos"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Alerta de feedback */}
        {message && (
          <div
            className={`mx-6 mt-3 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0 ${
              message.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : message.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            }`}
          >
            {message.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            <span className="flex-1">{message.text}</span>
          </div>
        )}

        {/* Cuerpo Principal: 2 Columnas */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-0 overflow-hidden">
          {/* Columna Izquierda: Movimientos Pagados en Banco */}
          <div className="lg:col-span-5 border-r border-gray-200 dark:border-gray-800 flex flex-col min-h-0 bg-gray-50/30 dark:bg-gray-900/20">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                  <Landmark size={14} className="text-amber-500" />
                  Pagos en Estado de Cuenta ({filteredMovimientos.length})
                </span>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={soloSinFactura}
                    onChange={(e) => setSoloSinFactura(e.target.checked)}
                    className="rounded text-amber-500 focus:ring-amber-500"
                  />
                  Solo sin factura
                </label>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={busquedaMov}
                    onChange={(e) => setBusquedaMov(e.target.value)}
                    placeholder="Buscar concepto, monto, egreso..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-2 py-1">
                  <Calendar size={12} className="text-gray-400" />
                  <input
                    type="month"
                    value={activeMonth}
                    onChange={(e) => {
                      setActiveMonth(e.target.value);
                      setFiltrarPorMes(true);
                    }}
                    disabled={!filtrarPorMes}
                    className="text-[11px] bg-transparent outline-none disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() => setFiltrarPorMes((v) => !v)}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                      filtrarPorMes ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                    }`}
                    title="Alternar filtro por mes"
                  >
                    {filtrarPorMes ? 'Mes' : 'Todos'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-900">
              {loading ? (
                <div className="p-8 text-center text-xs text-gray-400">Cargando movimientos...</div>
              ) : filteredMovimientos.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  No hay movimientos pendientes de factura con los filtros actuales.
                </div>
              ) : (
                filteredMovimientos.map((m) => {
                  const isSel = m.id === selectedMovId;
                  const concs = (m.conciliaciones_bancarias as any[]) || [];
                  const tieneEgreso = concs.some((c: any) => !!c.gastos);
                  const tieneFac = movTieneFactura(m);
                  const montoAbs = Math.abs(Number(m.monto || m.retiro || 0));

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedMovId(m.id);
                        setSelectedFacturasIds([]);
                      }}
                      className={`w-full text-left p-3.5 transition-all cursor-pointer ${
                        isSel
                          ? 'bg-amber-50/90 dark:bg-amber-950/30 border-l-4 border-l-amber-500'
                          : 'hover:bg-white dark:hover:bg-gray-900/50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                            {m.concepto}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>{formatDate(m.fecha)}</span>
                            {m.cuentas_bancarias?.nombre && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[130px]">{m.cuentas_bancarias.nombre}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-black text-red-600 dark:text-red-400 font-mono shrink-0">
                          -{formatCurrency(montoAbs)}
                        </span>
                      </div>

                      {/* Badges del flujo 3 etapas */}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            tieneEgreso
                              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                          }`}
                        >
                          1. Egreso: {tieneEgreso ? 'Vinculado' : 'Directo'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                          2. Banco: Pagado
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            tieneFac
                              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          3. Factura: {tieneFac ? 'Asignada' : 'Pendiente'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Columna Derecha: Asignación de Factura */}
          <div className="lg:col-span-7 flex flex-col min-h-0">
            {!selectedMov ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
                <Landmark size={36} className="mb-3 opacity-30" />
                <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                  Selecciona un movimiento bancario a la izquierda
                </p>
                <p className="text-xs mt-1 max-w-sm">
                  Podrás vincular facturas XML ya cargadas en Gastos o subir el XML/PDF directamente sin duplicar el egreso.
                </p>
              </div>
            ) : (
              <>
                {/* Resumen del movimiento seleccionado y facturas ya asignadas */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 shrink-0 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Movimiento Seleccionado
                      </span>
                      <h4 className="text-sm font-extrabold text-gray-900 dark:text-white truncate">
                        {selectedMov.concepto}
                      </h4>
                      <p className="text-[11px] text-gray-500">
                        Fecha: {formatDate(selectedMov.fecha)} • Referencia: {selectedMov.referencia || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Importe Pagado</span>
                      <span className="text-lg font-black text-red-600 dark:text-red-400 font-mono">
                        {formatCurrency(movMonto)}
                      </span>
                    </div>
                  </div>

                  {/* Egreso vinculado en Paso 1 */}
                  {((selectedMov.conciliaciones_bancarias as any[]) || []).some((c: any) => !!c.gastos) && (
                    <div className="bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-2.5 text-xs">
                      <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block mb-1">
                        Egreso(s) Vinculado(s) en Paso 1 (no se duplicarán al asignar factura):
                      </span>
                      {((selectedMov.conciliaciones_bancarias as any[]) || []).map((c: any) =>
                        c.gastos ? (
                          <div key={c.id} className="flex items-center justify-between text-[11px] text-gray-700 dark:text-gray-300">
                            <span className="truncate font-semibold">{c.gastos.concepto}</span>
                            <span className="font-mono font-bold shrink-0 ml-2">{formatCurrency(c.gastos.monto)}</span>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}

                  {/* Facturas ya asignadas */}
                  {facturasYaAsignadas.length > 0 && (
                    <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2.5 space-y-1.5">
                      <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 block">
                        Facturas ya asignadas ({facturasYaAsignadas.length}):
                      </span>
                      {facturasYaAsignadas.map((f: any) => (
                        <div key={f.id} className="flex items-center justify-between gap-2 text-[11px] bg-white dark:bg-gray-900 px-2.5 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-gray-800 dark:text-gray-200 truncate block">
                              {f.folio_factura || f.concepto} ({formatCurrency(f.monto)})
                            </span>
                            {f.uuid_fiscal && (
                              <span className="text-[10px] font-mono text-gray-400">UUID: {f.uuid_fiscal.substring(0, 14)}...</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {f.xml_url && (
                              <button
                                type="button"
                                onClick={() => openCfdi(f.xml_url.split(',')[0].trim())}
                                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded cursor-pointer"
                                title="Ver CFDI"
                              >
                                <Eye size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDesvincularFactura(f.id)}
                              disabled={saving}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded cursor-pointer"
                              title="Desvincular factura"
                            >
                              <Unlink size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tabs: Facturas del Sistema vs Subir XML/PDF */}
                <div className="px-4 pt-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRightTab('sistema')}
                    className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                      rightTab === 'sistema'
                        ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Facturas XML en Sistema ({facturasDisponibles.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightTab('subir')}
                    className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                      rightTab === 'subir'
                        ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Upload size={13} />
                    Subir XML / PDF Directo
                    {(uploadedXmlPaths.length > 0 || uploadedPdfPaths.length > 0) && (
                      <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px]">
                        {uploadedXmlPaths.length + uploadedPdfPaths.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Contenido Tab */}
                <div className="flex-1 overflow-y-auto p-4 min-h-0">
                  {rightTab === 'sistema' ? (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={busquedaFac}
                          onChange={(e) => setBusquedaFac(e.target.value)}
                          placeholder="Buscar factura por proveedor, RFC, UUID, folio o monto..."
                          className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div className="border border-gray-200 dark:border-gray-800 rounded-xl divide-y divide-gray-100 dark:divide-gray-900">
                        {filteredFacturas.length === 0 ? (
                          <div className="p-6 text-center text-xs text-gray-400">
                            No hay facturas XML pendientes de asignar. Puedes subir una en la pestaña &ldquo;Subir XML / PDF Directo&rdquo;.
                          </div>
                        ) : (
                          filteredFacturas.map((f) => {
                            const isChecked = selectedFacturasIds.includes(f.id);
                            const prov = Array.isArray(f.proveedores) ? f.proveedores[0] : f.proveedores;
                            const isSuggested = Math.abs(Number(f.monto || 0) - movMonto) <= 1;

                            return (
                              <label
                                key={f.id}
                                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                                  isChecked
                                    ? 'bg-amber-50/70 dark:bg-amber-950/30'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedFacturasIds((prev) =>
                                      prev.includes(f.id) ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                                    );
                                  }}
                                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                                      {prov?.nombre_comercial || f.concepto}
                                    </span>
                                    {isSuggested && (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-black shrink-0">
                                        <Sparkles size={9} /> Coincide monto
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                    <span>{formatDate(f.fecha_gasto)}</span>
                                    {f.folio_factura && (
                                      <>
                                        <span>•</span>
                                        <span>Folio: {f.folio_factura}</span>
                                      </>
                                    )}
                                    {f.uuid_fiscal && (
                                      <>
                                        <span>•</span>
                                        <span className="font-mono text-[10px]">UUID: {f.uuid_fiscal.substring(0, 8)}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0 flex items-center gap-2">
                                  {f.xml_url && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        openCfdi(f.xml_url.split(',')[0].trim());
                                      }}
                                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                                      title="Previsualizar CFDI"
                                    >
                                      <Eye size={13} />
                                    </button>
                                  )}
                                  <span className="text-xs font-black font-mono text-gray-900 dark:text-white">
                                    {formatCurrency(f.monto)}
                                  </span>
                                </div>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-amber-500 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-gray-900/30">
                          <FileCode size={24} className="text-amber-500 mb-2" />
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            Subir XML de Factura (.xml)
                          </span>
                          <span className="text-[10px] text-gray-400 mt-1">
                            Se leerá el CFDI automáticamente
                          </span>
                          <input
                            type="file"
                            accept=".xml,text/xml,application/xml"
                            multiple
                            disabled={uploadingFiles}
                            onChange={(e) => handleUploadFiles(e.target.files, 'xml')}
                            className="hidden"
                          />
                        </label>

                        <label className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-gray-50/50 dark:bg-gray-900/30">
                          <FileText size={24} className="text-blue-500 mb-2" />
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                            Subir PDF de Factura (.pdf)
                          </span>
                          <span className="text-[10px] text-gray-400 mt-1">
                            Representación impresa opcional
                          </span>
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            multiple
                            disabled={uploadingFiles}
                            onChange={(e) => handleUploadFiles(e.target.files, 'pdf')}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {(uploadedXmlPaths.length > 0 || uploadedPdfPaths.length > 0) && (
                        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 space-y-1.5 text-xs">
                          <span className="font-bold text-gray-700 dark:text-gray-300 block">Archivos listos para asignar:</span>
                          {uploadedXmlPaths.map((p, idx) => (
                            <div key={p} className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-300">
                              <span className="truncate">XML: {p.split('/').pop()}</span>
                              <button
                                type="button"
                                onClick={() => setUploadedXmlPaths((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-red-500 hover:underline ml-2 cursor-pointer"
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                          {uploadedPdfPaths.map((p, idx) => (
                            <div key={p} className="flex items-center justify-between text-[11px] text-blue-700 dark:text-blue-300">
                              <span className="truncate">PDF: {p.split('/').pop()}</span>
                              <button
                                type="button"
                                onClick={() => setUploadedPdfPaths((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-red-500 hover:underline ml-2 cursor-pointer"
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer de cuadre */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 flex items-center justify-between gap-4 flex-wrap shrink-0">
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px] font-bold uppercase">Pago Banco</span>
                      <span className="font-black font-mono">{formatCurrency(movMonto)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] font-bold uppercase">Facturas Sel.</span>
                      <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(sumaFacturasSeleccionadas)}
                      </span>
                    </div>
                    {selectedFacturasIds.length > 0 && (
                      <div>
                        <span className="text-gray-400 block text-[10px] font-bold uppercase">Diferencia</span>
                        <span
                          className={`font-black font-mono ${
                            Math.abs(diferencia) <= 0.05 ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          {formatCurrency(diferencia)}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAsignar}
                    disabled={
                      saving ||
                      uploadingFiles ||
                      (selectedFacturasIds.length === 0 && uploadedXmlPaths.length === 0 && uploadedPdfPaths.length === 0)
                    }
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-extrabold text-xs flex items-center gap-2 shadow transition-all cursor-pointer"
                  >
                    <Link2 size={14} />
                    {saving ? 'Asignando...' : 'Asignar Factura al Movimiento'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

