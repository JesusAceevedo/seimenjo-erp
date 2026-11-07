'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import {
  X, Check, Plus, RefreshCw, UploadCloud, Clock, Landmark, CreditCard, DollarSign, Receipt
} from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import DateInput from '@/components/ui/DateInput';
import type { ComprobanteDeposito } from '../../types';

export interface ComprobanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCompId: string | null;
  form: {
    tipo: string;
    fecha: string;
    monto: string;
    descripcion: string;
    archivoUrl: string;
    storageProvider: 'Supabase' | 'GoogleDrive';
    cuentaBancariaId: string;
    loading: boolean;
    error: string;
    montoDebito: string;
    montoCredito: string;
    propinaDebito: string;
    propinaCredito: string;
    montoAmex: string;
    propinaAmex: string;
    montoEfectivo: string;
    propinaEfectivo: string;
    montoParrotpay: string;
    propinaParrotpay: string;
    comisionTransacciones: string;
    ivaTransacciones: string;
    otrosCargos: string;
    desgloseTickets?: any[];
    esVentaMesAnterior: boolean;
    mesVenta: string;
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  cuentasBancarias?: any[];
  comprobantes?: ComprobanteDeposito[];
  selectedMonth?: string;
  compUploadLoading: boolean;
  handleUploadCompFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onCrearComprobante?: (payload: any) => Promise<any>;
  onActualizarComprobante?: (id: string, payload: any) => Promise<any>;
}

const parseInputNumber = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  let cleaned = String(val).trim();
  if (!cleaned) return 0;
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/,/g, '');
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

export default function ComprobanteModal({
  isOpen,
  onClose,
  editingCompId,
  form,
  setForm,
  cuentasBancarias,
  comprobantes,
  selectedMonth,
  compUploadLoading,
  handleUploadCompFile,
  onCrearComprobante,
  onActualizarComprobante
}: ComprobanteModalProps) {
  if (!isOpen) return null;

  const handleSubmit = async () => {
    const tot = form.tipo === 'deposito_ventanilla'
      ? parseInputNumber(form.monto)
      : parseInputNumber(form.montoDebito || 0) +
        parseInputNumber(form.montoCredito || 0) +
        parseInputNumber(form.propinaDebito || 0) +
        parseInputNumber(form.propinaCredito || 0) +
        parseInputNumber(form.montoAmex || 0) +
        parseInputNumber(form.propinaAmex || 0) +
        parseInputNumber(form.montoEfectivo || 0) +
        parseInputNumber(form.propinaEfectivo || 0) +
        parseInputNumber(form.montoParrotpay || 0) +
        parseInputNumber(form.propinaParrotpay || 0);

    if (!tot || tot <= 0) {
      setForm((p: any) => ({ ...p, error: 'Por favor ingresa un monto válido mayor a 0.' }));
      return;
    }
    if (!form.fecha) {
      setForm((p: any) => ({ ...p, error: 'Por favor selecciona la fecha del ticket o comprobante.' }));
      return;
    }

    // Validación de coherencia de mes entre descripción y fecha
    const descLower = (form.descripcion || '').toLowerCase();
    const mesesNombres = [
      { name: 'enero', num: '01' },
      { name: 'febrero', num: '02' },
      { name: 'marzo', num: '03' },
      { name: 'abril', num: '04' },
      { name: 'mayo', num: '05' },
      { name: 'junio', num: '06' },
      { name: 'julio', num: '07' },
      { name: 'agosto', num: '08' },
      { name: 'septiembre', num: '09' },
      { name: 'octubre', num: '10' },
      { name: 'noviembre', num: '11' },
      { name: 'diciembre', num: '12' }
    ];
    const fechaMes = form.fecha.substring(5, 7);
    const mesDetectado = mesesNombres.find(m => m.num !== fechaMes && descLower.includes(m.name));
    if (mesDetectado) {
      if (!confirm(`⚠️ Advertencia de Desfase de Mes:\n\nLa descripción menciona "${mesDetectado.name.toUpperCase()}", pero la fecha seleccionada es "${form.fecha}" (mes ${fechaMes}).\n\nSi este corte corresponde a las ventas de ${mesDetectado.name.toUpperCase()}, se recomienda ponerle la fecha de ese mes para evitar duplicarlo en los reportes del mes actual.\n\n¿Deseas guardar con fecha ${form.fecha} de todos modos?`)) {
        return;
      }
    }

    if (editingCompId) {
      const currentComp = comprobantes?.find(c => c.id === editingCompId);
      if (currentComp) {
        const linkedSum = (currentComp.comprobantes_deposito_movimientos || []).reduce((acc: number, rel: any) => acc + Number(rel.monto_asociado), 0);
        if (linkedSum > 0 && Math.abs(tot - linkedSum) >= 0.05) {
          if (!confirm(`Advertencia: El nuevo monto del comprobante (${formatCurrency(tot)}) no coincide con la suma de los movimientos vinculados (${formatCurrency(linkedSum)}). ¿Deseas continuar?`)) {
            return;
          }
        }
      }
    }

    setForm((p: any) => ({ ...p, loading: true, error: '' }));
    try {
      const payload = {
        tipo: form.tipo,
        fecha: form.fecha,
        monto: tot,
        descripcion: form.descripcion,
        archivo_url: form.archivoUrl,
        storage_provider: form.storageProvider,
        cuenta_bancaria_id: form.cuentaBancariaId || null,
        monto_debito: parseInputNumber(form.montoDebito || 0),
        monto_credito: parseInputNumber(form.montoCredito || 0),
        propina_debito: parseInputNumber(form.propinaDebito || 0),
        propina_credito: parseInputNumber(form.propinaCredito || 0),
        monto_amex: parseInputNumber(form.montoAmex || 0),
        propina_amex: parseInputNumber(form.propinaAmex || 0),
        monto_efectivo: parseInputNumber(form.montoEfectivo || 0),
        propina_efectivo: parseInputNumber(form.propinaEfectivo || 0),
        monto_parrotpay: parseInputNumber(form.montoParrotpay || 0),
        propina_parrotpay: parseInputNumber(form.propinaParrotpay || 0),
        comision_transacciones: parseInputNumber(form.comisionTransacciones || 0),
        iva_transacciones: parseInputNumber(form.ivaTransacciones || 0),
        otros_cargos: parseInputNumber(form.otrosCargos || 0),
        desglose_tickets: form.desgloseTickets || [],
        es_venta_mes_anterior: form.esVentaMesAnterior,
        mes_venta: form.mesVenta || null
      };

      let res;
      if (editingCompId) {
        if (!onActualizarComprobante) {
          throw new Error('No se ha configurado la acción para actualizar comprobantes.');
        }
        res = await onActualizarComprobante(editingCompId, payload);
      } else {
        if (!onCrearComprobante) {
          throw new Error('No se ha configurado la acción para crear comprobantes.');
        }
        const existingParrot = payload.tipo === 'corte_parrot'
          ? (comprobantes || []).find(c => c.fecha === payload.fecha && (c.tipo === 'corte_parrot' || (c.descripcion || '').toLowerCase().includes('corte parrot')))
          : null;
        if (existingParrot && onActualizarComprobante) {
          res = await onActualizarComprobante(existingParrot.id, {
            ...payload,
            archivo_url: payload.archivo_url || existingParrot.archivo_url || null,
            storage_provider: payload.storage_provider || existingParrot.storage_provider || 'Supabase',
            cuenta_bancaria_id: payload.cuenta_bancaria_id || existingParrot.cuenta_bancaria_id || null
          });
        } else {
          res = await onCrearComprobante(payload);
        }
      }

      if (res && !res.success) {
        throw new Error(res.error);
      }

      // Si se registraron comisiones de transacción en el ticket, registrar en la Bolsa
      const comVal = parseInputNumber(form.comisionTransacciones || 0);
      const ivaVal = parseInputNumber(form.ivaTransacciones || 0);
      const otrosVal = parseInputNumber(form.otrosCargos || 0);
      const totalComBolsa = comVal + ivaVal + otrosVal;

      if (totalComBolsa > 0 && !editingCompId && onCrearComprobante) {
        await onCrearComprobante({
          tipo: 'deposito_ventanilla',
          fecha: form.fecha,
          monto: totalComBolsa,
          descripcion: `Comisión Transacciones POS/Parrot (Comisión: ${formatCurrency(comVal)}, IVA: ${formatCurrency(ivaVal)}${otrosVal ? `, Otros: ${formatCurrency(otrosVal)}` : ''}) - Ticket ${form.descripcion || ''}`,
          cuentaBancariaId: form.cuentaBancariaId || null
        });
      }

      if (selectedMonth && payload.fecha.substring(0, 7) !== selectedMonth) {
        alert(`Atención: El comprobante se guardó con fecha ${payload.fecha}, la cual pertenece al período (${payload.fecha.substring(0, 7)}). Para visualizarlo en la lista de conciliación, selecciona ese período en la parte superior.`);
      }

      onClose();
    } catch (err: any) {
      setForm((p: any) => ({ ...p, error: err.message || 'Error al guardar.' }));
    } finally {
      setForm((p: any) => ({ ...p, loading: false }));
    }
  };

  const calculatedTotal = form.tipo === 'deposito_ventanilla'
    ? parseInputNumber(form.monto)
    : parseInputNumber(form.montoDebito || 0) +
      parseInputNumber(form.propinaDebito || 0) +
      parseInputNumber(form.montoCredito || 0) +
      parseInputNumber(form.propinaCredito || 0) +
      parseInputNumber(form.montoAmex || 0) +
      parseInputNumber(form.propinaAmex || 0) +
      parseInputNumber(form.montoEfectivo || 0) +
      parseInputNumber(form.propinaEfectivo || 0) +
      parseInputNumber(form.montoParrotpay || 0) +
      parseInputNumber(form.propinaParrotpay || 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200 font-sans">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
              {editingCompId ? <Receipt size={22} /> : <Plus size={22} />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                {editingCompId ? 'Editar Comprobante' : 'Registrar Comprobante Independiente'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {editingCompId ? 'Modifica los montos, desglose o adjuntos del comprobante' : 'Da de alta depósitos en ventanilla o cortes de punto de venta / Parrot'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {form.error && (
            <div className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-955/30 border border-rose-200 dark:border-rose-900/50 p-3 rounded-xl font-medium">
              {form.error}
            </div>
          )}

          {/* Tipo de Comprobante */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Tipo de Comprobante
            </label>
            <select
              value={form.tipo ?? 'deposito_ventanilla'}
              onChange={(e) => setForm((p: any) => ({ ...p, tipo: e.target.value }))}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="deposito_ventanilla">Depósito en Ventanilla</option>
              <option value="corte_tarjeta">Corte POS / Punto de Venta</option>
              <option value="corte_bbva">Corte BBVA</option>
              <option value="corte_parrot">Corte Parrot</option>
            </select>
          </div>

          {/* Fecha y Monto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Fecha
              </label>
              <DateInput
                value={form.fecha ?? ''}
                onChange={(e) => setForm((p: any) => ({ ...p, fecha: e.target.value }))}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-2 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {form.tipo === 'deposito_ventanilla' ? (
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                  Monto (MXN)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value={form.monto ?? ''}
                  onChange={(e) => setForm((p: any) => ({ ...p, monto: e.target.value }))}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block mb-1">
                  Monto Calculado Total
                </label>
                <div className="w-full bg-amber-50/60 dark:bg-amber-955/20 border border-amber-300 dark:border-amber-700 p-2.5 rounded-xl text-sm font-mono font-black text-amber-700 dark:text-amber-300 flex items-center justify-between">
                  <span>Total:</span>
                  <span>{formatCurrency(calculatedTotal)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Desglose POS / Parrot */}
          {form.tipo !== 'deposito_ventanilla' && (
            <div className="p-4 bg-amber-50/40 dark:bg-amber-955/15 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-3 font-sans">
              <span className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider block flex items-center gap-1.5">
                <Receipt size={14} /> Desglose POS / Parrot (Ventas y Tarjetas)
              </span>

              <div className="space-y-3 text-xs font-mono">
                {/* Efectivo */}
                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                  <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2 font-sans flex items-center gap-1">
                    <span>💵</span> Cobro en Efectivo
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-gray-500 font-sans block mb-1">Venta Efectivo</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.montoEfectivo ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, montoEfectivo: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold font-sans block mb-1">
                        Propina en Efectivo ⭐
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.propinaEfectivo ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, propinaEfectivo: e.target.value }))}
                        className="w-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 p-2 rounded-lg text-xs font-bold text-emerald-800 dark:text-emerald-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Tarjetas: Débito & Crédito */}
                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-sky-200 dark:border-sky-800/40 space-y-2.5">
                  <div className="text-[10px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider font-sans flex items-center gap-1">
                    <span>💳</span> Cobro en Terminal / Tarjetas
                  </div>

                  {/* Débito */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-gray-500 font-sans block mb-1">Imp. Débito (TDD)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.montoDebito ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, montoDebito: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-500 font-sans block mb-1">Prop. Débito</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.propinaDebito ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, propinaDebito: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Crédito */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-gray-500 font-sans block mb-1">Imp. Crédito (TDC)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.montoCredito ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, montoCredito: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-500 font-sans block mb-1">Prop. Crédito</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.propinaCredito ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, propinaCredito: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* AMEX */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-gray-500 font-sans block mb-1">Imp. AMEX</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.montoAmex ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, montoAmex: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-gray-500 font-sans block mb-1">Prop. AMEX</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.propinaAmex ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, propinaAmex: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* ParrotPay */}
                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-purple-200 dark:border-purple-800/40">
                  <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-2 font-sans flex items-center gap-1">
                    <span>🦜</span> ParrotPay / QR
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] text-purple-600 dark:text-purple-400 font-bold font-sans block mb-1">Monto ParrotPay</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.montoParrotpay ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, montoParrotpay: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-purple-600 dark:text-purple-400 font-bold font-sans block mb-1">Prop. ParrotPay</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.propinaParrotpay ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, propinaParrotpay: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Comisiones por Transacción */}
                <div className="p-3 bg-white dark:bg-gray-800/80 rounded-xl border border-rose-200 dark:border-rose-900/40 space-y-2 font-sans">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block uppercase">
                    📉 Comisiones por Transacción (Bolsa Facturación)
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[8px] text-gray-500 block mb-0.5">Comisión ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.comisionTransacciones ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const num = parseInputNumber(val);
                          const autoIva = num > 0 ? (num * 0.16).toFixed(2) : '';
                          setForm((p: any) => ({ ...p, comisionTransacciones: val, ivaTransacciones: autoIva }));
                        }}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-rose-300 dark:border-rose-900 p-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-400 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-gray-500 block mb-0.5">IVA (16%)</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.ivaTransacciones ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, ivaTransacciones: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-rose-300 dark:border-rose-900 p-1.5 rounded-lg text-xs text-rose-600 dark:text-rose-400 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-gray-500 block mb-0.5">Otros Cargos</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.otrosCargos ?? ''}
                        onChange={(e) => setForm((p: any) => ({ ...p, otrosCargos: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-1.5 rounded-lg text-xs text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>
                  {(() => {
                    const com = parseInputNumber(form.comisionTransacciones || 0);
                    const iva = parseInputNumber(form.ivaTransacciones || 0);
                    const otros = parseInputNumber(form.otrosCargos || 0);
                    const totalCom = com + iva + otros;
                    return totalCom > 0 ? (
                      <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-955/30 border border-rose-200 dark:border-rose-900/40 text-[10px] flex justify-between font-bold text-rose-600 dark:text-rose-400">
                        <span>Total Comisiones a Bolsa:</span>
                        <span className="font-mono">{formatCurrency(totalCom)}</span>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Cuenta Bancaria de Destino */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Cuenta de Destino Relacionada
            </label>
            <select
              value={form.cuentaBancariaId ?? ''}
              onChange={(e) => setForm((p: any) => ({ ...p, cuentaBancariaId: e.target.value }))}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="">- Ninguna / Seleccionar Banco -</option>
              {(cuentasBancarias || []).map(cb => (
                <option key={cb.id} value={cb.id}>{cb.nombre} - {cb.banco}</option>
              ))}
            </select>
          </div>

          {/* Descripción / Notas */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Descripción / Notas
            </label>
            <textarea
              rows={2}
              placeholder="Ej: Depósito efectivo ventas fin de semana, corte Parrot..."
              value={form.descripcion ?? ''}
              onChange={(e) => setForm((p: any) => ({ ...p, descripcion: e.target.value }))}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none resize-none"
            />
          </div>

          {/* Venta de Mes Anterior (Diferida) */}
          <div className={`p-3.5 rounded-xl border transition-all ${
            form.esVentaMesAnterior
              ? 'bg-amber-50/80 dark:bg-amber-955/30 border-amber-300 dark:border-amber-700/60 shadow-xs'
              : 'bg-gray-50/50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800'
          }`}>
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.esVentaMesAnterior}
                onChange={(e) => {
                  const checked = e.target.checked;
                  let defMes = '';
                  if (checked && form.fecha) {
                    const d = new Date(form.fecha + 'T12:00:00Z');
                    d.setUTCMonth(d.getUTCMonth() - 1);
                    defMes = d.toISOString().substring(0, 7);
                  }
                  setForm((p: any) => ({
                    ...p,
                    esVentaMesAnterior: checked,
                    mesVenta: checked ? (p.mesVenta || defMes) : ''
                  }));
                }}
                className="mt-0.5 w-4 h-4 text-amber-500 rounded accent-amber-500 cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-xs font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <Clock size={13} className="text-amber-500 shrink-0" /> Venta de Mes Anterior (Diferida)
                </span>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                  Marcar si este ingreso (ticket, corte o depósito) entró al banco este mes pero corresponde a ventas del mes anterior. Se excluirá de la Factura Global.
                </p>
              </div>
            </label>

            {form.esVentaMesAnterior && (
              <div className="mt-2.5 pt-2 border-t border-amber-200 dark:border-amber-900/40 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1">
                  Mes al que corresponde la venta:
                </span>
                <input
                  type="month"
                  value={form.mesVenta || ''}
                  onChange={(e) => setForm((p: any) => ({ ...p, mesVenta: e.target.value }))}
                  className="bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 px-2 py-1 rounded-md text-xs font-mono font-bold text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}
          </div>

          {/* Adjunto Ticket y Almacenamiento */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Proveedor de Almacenamiento
            </label>
            <div className="flex gap-4 mt-1 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="modal_comp_storage"
                  checked={form.storageProvider === 'Supabase'}
                  onChange={() => setForm((p: any) => ({ ...p, storageProvider: 'Supabase', archivoUrl: '' }))}
                />
                <span>Supabase Storage</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="modal_comp_storage"
                  checked={form.storageProvider === 'GoogleDrive'}
                  onChange={() => setForm((p: any) => ({ ...p, storageProvider: 'GoogleDrive', archivoUrl: '' }))}
                />
                <span>Google Drive Link</span>
              </label>
            </div>
          </div>

          {form.storageProvider === 'Supabase' ? (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Ticket de Depósito (Imagen / PDF)
              </label>
              <div className="relative overflow-hidden w-full">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleUploadCompFile}
                  disabled={compUploadLoading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled={compUploadLoading}
                  className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {compUploadLoading ? <RefreshCw size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                  {form.archivoUrl ? 'Archivo cargado con éxito ✓' : 'Seleccionar Archivo...'}
                </button>
              </div>
              {form.archivoUrl && (
                <p className="text-[10px] text-gray-400 font-mono mt-1 truncate">{form.archivoUrl.split('/').pop()}</p>
              )}
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                Enlace de Google Drive
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                value={form.archivoUrl}
                onChange={(e) => setForm((p: any) => ({ ...p, archivoUrl: e.target.value }))}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none font-mono"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={form.loading || compUploadLoading}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            {form.loading ? <RefreshCw size={14} className="animate-spin" /> : (editingCompId ? <Check size={14} /> : <Plus size={14} />)}
            {editingCompId ? 'Actualizar Comprobante' : 'Guardar Comprobante'}
          </button>
        </div>

      </div>
    </div>
  );
}
