'use client';

import React, { useState, useEffect } from 'react';
import {
  X, FileText, FileCode, AlertTriangle, CheckCircle,
  Calendar, DollarSign, CreditCard, Download, Copy,
  Edit3, Save, RefreshCw, Check, Link as LinkIcon, Eye
} from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import { supabase } from '../../../../lib/supabase';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';

interface GastoConciliacionDrawerProps {
  open: boolean;
  onClose: () => void;
  gasto: any | null;
  onRefresh?: () => void;
  onDownloadFile: (url: string) => void;
  onViewCfdi?: (xmlUrl: string) => void;
}

export default function GastoConciliacionDrawer({
  open,
  onClose,
  gasto,
  onRefresh,
  onDownloadFile,
  onViewCfdi
}: GastoConciliacionDrawerProps) {
  const { openCfdi } = useCfdiViewer();
  const handleViewCfdi = onViewCfdi || openCfdi;

  const [comentarios, setComentarios] = useState('');
  const [isEditingComms, setIsEditingComms] = useState(false);
  const [savingComms, setSavingComms] = useState(false);
  const [copiedUuid, setCopiedUuid] = useState(false);

  useEffect(() => {
    if (gasto) {
      const initialComms =
        gasto.movimientos_bancarios?.comentarios ||
        gasto.comentarios ||
        '';
      setComentarios(initialComms);
    }
    setIsEditingComms(false);
  }, [gasto, open]);

  if (!open || !gasto) return null;

  const handleCopyUuid = () => {
    if (gasto.uuid_fiscal) {
      navigator.clipboard.writeText(gasto.uuid_fiscal);
      setCopiedUuid(true);
      setTimeout(() => setCopiedUuid(false), 2000);
    }
  };

  const handleSaveComentarios = async () => {
    setSavingComms(true);
    try {
      if (gasto.movimiento_bancario_id) {
        // Save comment on the linked bank movement
        const { error } = await supabase
          .from('movimientos_bancarios')
          .update({ comentarios })
          .eq('id', gasto.movimiento_bancario_id);
        if (error) throw error;
      }

      // Also update the comment on the expense for safety
      const { error: gastoError } = await supabase
        .from('gastos')
        .update({ comentarios })
        .eq('id', gasto.id);
      if (gastoError) throw gastoError;

      setIsEditingComms(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Error al guardar comentarios: ${err.message}`);
    } finally {
      setSavingComms(false);
    }
  };

  const mov = gasto.movimientos_bancarios;
  const tieneMovimiento = !!mov;

  // Estatus badge styling helpers
  const estatusNombre = mov?.estatus_conciliacion_bancaria?.nombre || (gasto.es_deducible === false ? 'No Deducible' : 'Pendiente');
  const estatusColor = mov?.estatus_conciliacion_bancaria?.color || (gasto.es_deducible === false ? '#EF4444' : '#9CA3AF');

  // Detect payment discrepancy manually in frontend for display
  const esMovimientoEfectivo = (concepto: string): boolean => {
    if (!concepto) return false;
    const c = concepto.toUpperCase();
    return c.includes('EFECTIVO') || c.includes('CAJERO') || c.includes('RETIRO CAJERO') || c.includes('DEPOSITO CAJERO');
  };

  const obtenerMetodoPagoBanco = (concepto: string): string => {
    if (!concepto) return 'unknown';
    const c = concepto.toUpperCase();
    if (c.includes('EFECTIVO') || c.includes('CAJERO') || c.includes('RETIRO CAJERO') || c.includes('DEPOSITO CAJERO')) {
      return '01';
    }
    if (c.includes('SPEI') || c.includes('TRANSFERENCIA') || c.includes('TRF') || c.includes('TRANSF') || c.includes('TEF') || c.includes('TRASPASO')) {
      return '03';
    }
    if (c.includes('TARJETA') || c.includes('PAGO CON TARJETA') || c.includes('TDC') || c.includes('T.DEB') || c.includes('T.CRE') || c.includes('DEBITO') || c.includes('CREDITO')) {
      return '04_28';
    }
    return 'unknown';
  };

  const detectarDiscrepanciaPago = (conceptoBanco: string, metodoPagoGasto: string | null | undefined) => {
    if (!metodoPagoGasto) return { tieneDiscrepancia: false };
    const mpBanco = obtenerMetodoPagoBanco(conceptoBanco);
    if (mpBanco === 'unknown') return { tieneDiscrepancia: false };

    const cleanGastoCode = metodoPagoGasto.trim().padStart(2, '0');

    if (mpBanco === '01' && cleanGastoCode !== '01') {
      return { tieneDiscrepancia: true, detalle: 'El banco indica retiro en efectivo pero el comprobante indica pago electrónico.' };
    }
    if (mpBanco === '03' && cleanGastoCode !== '03') {
      return { tieneDiscrepancia: true, detalle: 'El banco indica transferencia pero el comprobante indica tarjeta/efectivo.' };
    }
    if (mpBanco === '04_28' && cleanGastoCode !== '04' && cleanGastoCode !== '28') {
      return { tieneDiscrepancia: true, detalle: 'El banco indica tarjeta pero el comprobante indica transferencia/efectivo.' };
    }
    return { tieneDiscrepancia: false };
  };

  const disc = mov ? detectarDiscrepanciaPago(mov.concepto, gasto.metodo_pago) : { tieneDiscrepancia: false, detalle: '' };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col z-50 transition-all duration-300 font-sans">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
        <div>
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
            {gasto.proveedores?.nombre_comercial || 'Gasto Sin Proveedor'}
          </h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
            {gasto.proveedores?.rfc || 'Sin RFC'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          title="Cerrar panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* SECTION 1: Datos de la Factura */}
        <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={12} />
            <span>Datos del Gasto / Factura</span>
          </div>
          <div className="p-3 space-y-2.5 text-xs">
            {gasto.uuid_fiscal && (
              <div className="space-y-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 block font-semibold">UUID Fiscal (CFDI)</span>
                <div className="flex items-center justify-between bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-2.5 py-1.5">
                  <span className="font-mono text-[9px] text-gray-600 dark:text-gray-400 truncate max-w-[280px]">
                    {gasto.uuid_fiscal}
                  </span>
                  <button
                    onClick={handleCopyUuid}
                    className="p-1 text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    title="Copiar UUID"
                  >
                    {copiedUuid ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[10px] text-gray-400 dark:text-gray-550 block">Fecha Emisión</span>
                <span className="font-mono font-bold text-gray-850 dark:text-gray-250">
                  {gasto.fecha_timbrado
                    ? new Date(gasto.fecha_timbrado).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                    : gasto.fecha_gasto
                      ? new Date(gasto.fecha_gasto).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 dark:text-gray-550 block">Método Pago (SAT)</span>
                <span className="font-semibold text-gray-850 dark:text-gray-250 block truncate" title={gasto.metodo_pago}>
                  {gasto.metodo_pago || '—'}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-2">
              <span className="text-[10px] text-gray-400 dark:text-gray-550 block">Concepto / Descripción</span>
              <p className="text-gray-800 dark:text-gray-300 font-medium leading-relaxed mt-0.5">
                {gasto.concepto}
              </p>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-2.5 grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-gray-400 dark:text-gray-550 block">Importe Total</span>
                <span className="text-base font-black text-gray-900 dark:text-white font-mono">
                  {formatCurrency(gasto.monto)}
                </span>
              </div>
              {gasto.iva_acreditable !== undefined && (
                <div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-550 block">IVA Acreditable</span>
                  <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                    {formatCurrency(gasto.iva_acreditable)}
                  </span>
                </div>
              )}
            </div>

            {/* Archivos adjuntos */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-2.5">
              <span className="text-[10px] text-gray-400 dark:text-gray-550 block mb-1.5">Archivos Adjuntos</span>
              <div className="flex flex-wrap gap-2">
                {gasto.xml_url ? (
                  <>
                    <button
                      onClick={() => onDownloadFile(gasto.xml_url)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold transition-all text-[10px]"
                    >
                      <FileCode size={11} /> XML
                    </button>
                    {handleViewCfdi && (
                      <button
                        onClick={() => handleViewCfdi(gasto.xml_url!.split(',')[0])}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold transition-all text-[10px]"
                        title="Ver representación impresa del XML"
                      >
                        <Eye size={11} /> Ver PDF de XML (CFDI)
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 italic bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-800">
                    XML no disponible
                  </span>
                )}

                {gasto.pdf_url ? (
                  <button
                    onClick={() => onDownloadFile(gasto.pdf_url)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 font-bold transition-all text-[10px]"
                  >
                    <Download size={11} /> PDF Factura
                  </button>
                ) : (
                  <span className="text-[10px] text-gray-400 dark:text-gray-600 italic bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-800">
                    PDF no disponible
                  </span>
                )}

                {gasto.ticket_url && gasto.ticket_url !== 'no_lleva' && (
                  <button
                    onClick={() => onDownloadFile(gasto.ticket_url)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-900/50 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-900/60 font-bold transition-all text-[10px]"
                  >
                    <Download size={11} /> Ticket
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: Conciliación Bancaria */}
        <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <CreditCard size={12} />
              <span>Detalles de Conciliación Bancaria</span>
            </div>
            <span
              className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black text-white uppercase tracking-wider"
              style={{ backgroundColor: estatusColor }}
            >
              {estatusNombre}
            </span>
          </div>

          <div className="p-3 space-y-3 text-xs">
            {tieneMovimiento ? (
              <>
                {/* Discrepancy warning if any */}
                {disc.tieneDiscrepancia && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900/30 text-amber-800 dark:text-amber-400 rounded-lg flex gap-2 line-height-relaxed">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                    <div className="text-[10px] font-medium">
                      <strong>Discrepancia de Pago:</strong> {disc.detalle}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-550 block">Fecha Movimiento</span>
                    <span className="font-mono font-bold text-gray-850 dark:text-gray-250">
                      {new Date(mov.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-550 block">Cuenta Bancaria</span>
                    <span className="font-bold text-gray-850 dark:text-gray-250 block">
                      {mov.cuentas_bancarias?.nombre || 'BBVA'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-800 pt-2">
                  <span className="text-[10px] text-gray-400 dark:text-gray-550 block">Concepto en Banco</span>
                  <p className="font-mono text-[10px] text-gray-700 dark:text-gray-300 font-semibold break-all mt-0.5">
                    {mov.concepto}
                  </p>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-800 pt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-550 block">Importe Banco</span>
                    <span className="text-sm font-black text-gray-900 dark:text-white font-mono">
                      {formatCurrency(mov.monto)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-550 block">Tipo Movimiento</span>
                    <span className={`font-bold uppercase tracking-wider text-[10px] ${mov.tipo_movimiento === 'Retiro' ? 'text-red-500' : 'text-emerald-500'}`}>
                      {mov.tipo_movimiento}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-5 text-gray-400 dark:text-gray-500 space-y-1">
                <LinkIcon size={24} className="mx-auto text-gray-300 dark:text-gray-700" />
                <p className="font-bold text-[11px]">Gasto Sin Conciliación Bancaria</p>
                <p className="text-[10px]">Este gasto aún no está enlazado a ningún movimiento del banco.</p>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: Comentarios de Conciliación */}
        <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileText size={12} />
              <span>Comentarios / Notas</span>
            </div>
            {!isEditingComms && (
              <button
                onClick={() => setIsEditingComms(true)}
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-[9px] uppercase font-bold flex items-center gap-1"
              >
                <Edit3 size={10} /> Editar
              </button>
            )}
          </div>

          <div className="p-3 text-xs">
            {isEditingComms ? (
              <div className="space-y-2">
                <textarea
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-800 dark:text-gray-100 outline-none focus:ring-1 focus:ring-blue-500 min-h-[90px] resize-none font-sans"
                  placeholder="Escribe comentarios o notas de conciliación aquí..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setIsEditingComms(false);
                      setComentarios(
                        gasto.movimientos_bancarios?.comentarios ||
                        gasto.comentarios ||
                        ''
                      );
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold border border-gray-200 dark:border-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500 dark:text-gray-400 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveComentarios}
                    disabled={savingComms}
                    className="px-2.5 py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md flex items-center gap-1 transition-all"
                  >
                    {savingComms ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Save size={10} />
                    )}
                    <span>Guardar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-950 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 min-h-[50px] leading-relaxed whitespace-pre-wrap">
                  {comentarios || 'Sin comentarios registrados.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 flex justify-end shrink-0 bg-gray-50 dark:bg-gray-900/60">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-250 dark:border-gray-850 hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all shadow-sm"
        >
          Cerrar Detalle
        </button>
      </div>
    </div>
  );
}
