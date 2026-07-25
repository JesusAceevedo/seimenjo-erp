'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle, Clock, AlertTriangle, FileCode, FileText,
  CreditCard, Landmark, ArrowRight, RefreshCw, Link as LinkIcon, Unlink, Eye, User, Calendar, Tag
} from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import {
  obtenerTrayectoriaPedido,
  vincularFacturaAPedido,
  desvincularFacturaDePedido,
  obtenerSignedUrl
} from '../actions';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';
import VincularXmlPedidoModal from './VincularXmlPedidoModal';

interface TrayectoriaPedidoModalProps {
  pedidoId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function TrayectoriaPedidoModal({
  pedidoId,
  onClose,
  onRefresh
}: TrayectoriaPedidoModalProps) {
  const getSessionToken = useSessionToken();
  const { openCfdi } = useCfdiViewer();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showVincularModal, setShowVincularModal] = useState(false);

  const fetchTrayectoria = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getSessionToken();
      const res = await obtenerTrayectoriaPedido(pedidoId, token);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || 'No se pudo cargar la trayectoria del pedido.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al obtener la trayectoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pedidoId) {
      fetchTrayectoria();
    }
  }, [pedidoId]);

  const handleDownload = async (url: string) => {
    try {
      const token = await getSessionToken();
      const res = await obtenerSignedUrl(url, token);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert(`Error al descargar: ${res.error || 'Desconocido'}`);
      }
    } catch (err: any) {
      alert(`Error al descargar: ${err.message}`);
    }
  };

  const handleDesvincularFactura = async (facturaId: string) => {
    if (!confirm('¿Deseas desvincular esta factura de este pedido? El pedido quedará en estatus "Pendiente de Facturar".')) return;

    setActionLoading(true);
    try {
      const token = await getSessionToken();
      const res = await desvincularFacturaDePedido(facturaId, token);
      if (res.success) {
        await fetchTrayectoria();
        if (onRefresh) onRefresh();
      } else {
        alert(`Error: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const pedido = data?.pedido;
  const facturas: any[] = data?.facturas || [];
  const movimiento = data?.movimientoBancario;
  const cliente = pedido?.clientes;
  const totalPedido = Number(pedido?.precio_total || 0);

  const hasInvoice = facturas.length > 0 || !!pedido?.folio_factura;
  const isConciliado = !!movimiento;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-900 bg-gray-50/60 dark:bg-gray-900/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs px-2.5 py-1 rounded-lg">
                Trayectoria de Venta
              </span>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">
                Pedido #{pedido?.numero_pedido || '—'}
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Rastreo unificado: Pedido ➔ Factura XML (SAT) ➔ Conciliación Bancaria
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <RefreshCw className="animate-spin text-emerald-500" size={28} />
              <span className="text-sm font-medium">Cargando la trayectoria del pedido...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-400 text-sm flex items-center gap-3">
              <AlertTriangle size={20} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Stepper Header Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Step 1 Badge */}
                <div className="p-4 rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black text-lg shrink-0 shadow-md">
                    1
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                      Venta / Pedido
                    </span>
                    <span className="text-sm font-extrabold text-gray-900 dark:text-white block font-mono">
                      {formatCurrency(totalPedido)}
                    </span>
                  </div>
                </div>

                {/* Step 2 Badge */}
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                  hasInvoice 
                    ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40' 
                    : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 shadow-md ${
                    hasInvoice ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    2
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                      hasInvoice ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      Factura CFDI
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white block truncate max-w-[150px]">
                      {hasInvoice ? (facturas[0]?.serie_folio || 'Facturado') : 'Pendiente de Facturar'}
                    </span>
                  </div>
                </div>

                {/* Step 3 Badge */}
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                  isConciliado 
                    ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40' 
                    : 'bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800'
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 shadow-md ${
                    isConciliado ? 'bg-purple-600 text-white' : 'bg-gray-400 text-white'
                  }`}>
                    3
                  </div>
                  <div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                      isConciliado ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'
                    }`}>
                      Conciliación Bancaria
                    </span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white block">
                      {isConciliado ? 'Pago Verificado' : 'Sin Conciliar en Banco'}
                    </span>
                  </div>
                </div>

              </div>

              {/* TIMELINE CARDS */}
              <div className="space-y-6 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-gray-200 dark:before:bg-gray-800 before:z-0">
                
                {/* 1. PEDIDO CARD */}
                <div className="relative z-10 pl-14">
                  <div className="absolute left-3 top-4 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow">
                    ✓
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                      <div>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          Paso 1: Venta Registrada
                        </span>
                        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                          Pedido #{pedido?.numero_pedido}
                        </h3>
                      </div>
                      <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-bold">
                        {pedido?.estatus_pago || 'Liquidado'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400 font-medium block">Cliente</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {cliente?.nombre_local || pedido?.cliente_nombre || 'Cliente Ocasional'}
                        </span>
                        {cliente?.rfc && <span className="block font-mono text-[10px] text-gray-400">{cliente.rfc}</span>}
                      </div>

                      <div>
                        <span className="text-gray-400 font-medium block">Fecha del Pedido</span>
                        <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">
                          {pedido?.fecha_pedido ? new Date(pedido.fecha_pedido).toLocaleDateString('es-MX') : '—'}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-400 font-medium block">Monto Total</span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                          {formatCurrency(totalPedido)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. FACTURA XML CARD */}
                <div className="relative z-10 pl-14">
                  <div className={`absolute left-3 top-4 w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shadow ${
                    hasInvoice ? 'bg-blue-600' : 'bg-amber-500'
                  }`}>
                    {hasInvoice ? '✓' : '!'}
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                      <div>
                        <span className={`text-xs font-bold uppercase tracking-wider ${
                          hasInvoice ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          Paso 2: Comprobante Fiscal (CFDI XML)
                        </span>
                        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                          {hasInvoice ? `Factura ${facturas[0]?.serie_folio || pedido?.folio_factura || 'Asignada'}` : 'Sin Factura Vinculada'}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {!hasInvoice ? (
                          <button
                            onClick={() => setShowVincularModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                          >
                            <LinkIcon size={13} /> Vincular XML Masivo
                          </button>
                        ) : (
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold flex items-center gap-1">
                            <CheckCircle size={12} /> Facturado
                          </span>
                        )}
                      </div>
                    </div>

                    {facturas.length > 0 ? (
                      <div className="space-y-3">
                        {facturas.map((f, i) => (
                          <div key={f.id || i} className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">
                                Folio: {f.serie_folio || 'SF'}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]" title={f.uuid_fiscal}>
                                UUID: {f.uuid_fiscal}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                              <div>
                                <span className="text-gray-400 block">Total XML</span>
                                <span className="font-bold font-mono text-gray-900 dark:text-white">{formatCurrency(f.total)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block">IVA Trasladado</span>
                                <span className="font-bold font-mono text-gray-700 dark:text-gray-300">{formatCurrency(f.iva_trasladado)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400 block">Fecha Emisión</span>
                                <span className="font-mono text-gray-700 dark:text-gray-300">
                                  {f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-MX') : '—'}
                                </span>
                              </div>
                              <div className="flex items-center justify-end gap-1.5">
                                {f.xml_url && (
                                  <button
                                    onClick={() => handleDownload(f.xml_url)}
                                    title="Descargar XML"
                                    className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 rounded-lg"
                                  >
                                    <FileCode size={13} />
                                  </button>
                                )}
                                {f.pdf_url && (
                                  <button
                                    onClick={() => handleDownload(f.pdf_url)}
                                    title="Descargar PDF"
                                    className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 rounded-lg"
                                  >
                                    <FileText size={13} />
                                  </button>
                                )}
                                {f.xml_url && (
                                  <button
                                    onClick={() => openCfdi(f.xml_url)}
                                    title="Ver CFDI"
                                    className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 rounded-lg"
                                  >
                                    <Eye size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDesvincularFactura(f.id)}
                                  disabled={actionLoading}
                                  title="Desvincular de este pedido"
                                  className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                                >
                                  <Unlink size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-800 dark:text-amber-400 text-xs flex items-center justify-between">
                        <span>No hay ninguna factura fiscal vinculada a este pedido.</span>
                        <button
                          onClick={() => setShowVincularModal(true)}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-[11px] transition-colors"
                        >
                          Asignar XML Manual
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. MOVIMIENTO BANCARIO CARD */}
                <div className="relative z-10 pl-14">
                  <div className={`absolute left-3 top-4 w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shadow ${
                    isConciliado ? 'bg-purple-600' : 'bg-gray-400'
                  }`}>
                    {isConciliado ? '✓' : '3'}
                  </div>
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                      <div>
                        <span className={`text-xs font-bold uppercase tracking-wider ${
                          isConciliado ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'
                        }`}>
                          Paso 3: Depósito Bancario / Estado de Cuenta
                        </span>
                        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                          {isConciliado ? 'Conciliado en Estado de Cuenta' : 'Sin Movimiento Bancario Vinculado'}
                        </h3>
                      </div>
                      {isConciliado ? (
                        <span className="px-3 py-1 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 rounded-full text-xs font-bold flex items-center gap-1">
                          <Landmark size={12} /> Conciliado
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full text-xs font-bold">
                          Pendiente de Conciliar
                        </span>
                      )}
                    </div>

                    {movimiento ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-gray-400 font-medium block">Concepto Bancario</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200 block truncate" title={movimiento.concepto}>
                            {movimiento.concepto}
                          </span>
                          {movimiento.cuentas_bancarias?.nombre && (
                            <span className="text-[10px] text-gray-400 block">{movimiento.cuentas_bancarias.nombre}</span>
                          )}
                        </div>

                        <div>
                          <span className="text-gray-400 font-medium block">Fecha del Depósito</span>
                          <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">
                            {movimiento.fecha ? new Date(movimiento.fecha).toLocaleDateString('es-MX') : '—'}
                          </span>
                        </div>

                        <div>
                          <span className="text-gray-400 font-medium block">Monto Depositado</span>
                          <span className="font-extrabold text-purple-600 dark:text-purple-400 text-sm font-mono">
                            +{formatCurrency(movimiento.deposito || movimiento.monto)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-500 dark:text-gray-400 text-xs">
                        Este pedido aún no ha sido conciliado manualmente con una fila del Estado de Cuenta Bancario. Puedes conciliarlo en el módulo de <strong className="text-gray-700 dark:text-gray-300">Conciliación Bancaria</strong>.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/20 flex justify-between items-center">
          <button
            onClick={fetchTrayectoria}
            className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* MODAL VINCULAR XML MANUAL */}
      {showVincularModal && (
        <VincularXmlPedidoModal
          pedidoId={pedidoId}
          onClose={() => setShowVincularModal(false)}
          onSuccess={async () => {
            setShowVincularModal(false);
            await fetchTrayectoria();
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
