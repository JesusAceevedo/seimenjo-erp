'use client';

import React from 'react';
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Landmark,
  Receipt,
  Scale,
} from 'lucide-react';

interface FacturaTerceroResumen {
  id?: string | null;
  uuid_fiscal?: string | null;
  fecha_emision?: string | null;
  fecha?: string | null;
  serie_folio?: string | null;
  rfc_receptor?: string | null;
  rfc?: string | null;
  _clienteNombre?: string | null;
  cliente_nombre?: string | null;
  nombre_receptor?: string | null;
  _subtotal?: number | string | null;
  subtotal?: number | string | null;
  _iva?: number | string | null;
  iva_trasladado?: number | string | null;
  _total?: number | string | null;
  total?: number | string | null;
}

interface AuditoriaResumen {
  diasLaborablesSinTicket: number;
  totalDiasLaborables: number;
}

interface ControlEfectivoResumen {
  faltaPorDepositar: number;
}

interface ResumenContableTabProps {
  selectedMonth: string;
  formatCurrency: (value: number | string | null | undefined) => string;
  totalEfectivoParrot: number;
  totalParrotPayParrot: number;
  totalTarjetasBbva: number;
  totalTercerosDeducibles: number;
  manualTercerosVal: number;
  currentMonthKey: string;
  setMontoManualTercero: (key: string, value: number) => void;
  totalPropinasExcluidas: number;
  subtotalFacturaGlobal: number;
  ivaFacturaGlobal: number;
  totalConIvaFacturaGlobal: number;
  ivaFacturasTerceros: number;
  totalIvaTrasladadoPeriodo: number;
  totalFacturaPublicoGeneral: number;
  facturasTercerosMes: FacturaTerceroResumen[];
  auditoriaDiasMes: AuditoriaResumen;
  controlEfectivo: ControlEfectivoResumen;
  diferenciaTarjetas: number;
  depositosPendientesDeVincular: number;
  ticketsPendientesDeposito: unknown[];
  montoTicketsPendientesDeposito: number;
  onOpenTab: (tab: 'facturas' | 'tickets' | 'comparativos' | 'depositos') => void;
  onOpenComparativo: (tab: 'efectivo' | 'tarjetas' | 'bbva_banco' | 'desfase_mes') => void;
  onExport: () => void;
}

export const ResumenContableTab: React.FC<ResumenContableTabProps> = ({
  selectedMonth,
  formatCurrency,
  totalEfectivoParrot,
  totalParrotPayParrot,
  totalTarjetasBbva,
  totalTercerosDeducibles,
  manualTercerosVal,
  currentMonthKey,
  setMontoManualTercero,
  totalPropinasExcluidas,
  subtotalFacturaGlobal,
  ivaFacturaGlobal,
  totalConIvaFacturaGlobal,
  ivaFacturasTerceros,
  totalIvaTrasladadoPeriodo,
  totalFacturaPublicoGeneral,
  facturasTercerosMes,
  auditoriaDiasMes,
  controlEfectivo,
  diferenciaTarjetas,
  depositosPendientesDeVincular,
  ticketsPendientesDeposito,
  montoTicketsPendientesDeposito,
  onOpenTab,
  onOpenComparativo,
  onExport,
}) => {
  const reviewItems = [
    {
      label: 'Días laborables sin ticket',
      value: `${auditoriaDiasMes.diasLaborablesSinTicket} de ${auditoriaDiasMes.totalDiasLaborables}`,
      needsReview: auditoriaDiasMes.diasLaborablesSinTicket > 0,
    },
    {
      label: 'Efectivo por depositar',
      value: formatCurrency(controlEfectivo.faltaPorDepositar),
      needsReview: controlEfectivo.faltaPorDepositar > 0.005,
    },
    {
      label: 'Diferencia tarjetas Parrot vs. BBVA',
      value: formatCurrency(diferenciaTarjetas),
      needsReview: Math.abs(diferenciaTarjetas) > 0.01,
    },
    {
      label: 'Depósitos pendientes de cuadre',
      value: formatCurrency(depositosPendientesDeVincular),
      needsReview: depositosPendientesDeVincular > 0.005,
    },
  ];
  const reviewCount = reviewItems.filter(item => item.needsReview).length;

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">Cierre mensual · {selectedMonth}</p>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">Resumen contable</h3>
          <p className="text-[11px] text-gray-500">Ventas, CFDI emitidos, IVA trasladado y puntos por revisar.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${reviewCount ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'}`}>
            {reviewCount ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
            {reviewCount ? `${reviewCount} revisión(es) pendiente(s)` : 'Sin pendientes de revisión'}
          </span>
          <button type="button" onClick={onExport} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold">
            <FileSpreadsheet size={14} /> Exportar cierre
          </button>
        </div>
      </header>

      <section className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] border-b border-gray-200 dark:border-gray-800">
        <div className="p-4 sm:p-5">
          <h4 className="text-xs font-black uppercase tracking-wide text-gray-800 dark:text-gray-200">Integración de Factura Global</h4>
          <p className="text-[10px] text-gray-500 mt-1">Importes cobrados con IVA incluido; las deducciones evitan duplicar ventas y excluir propinas.</p>
          <dl className="mt-3 divide-y divide-gray-100 dark:divide-gray-800 text-xs">
            <div className="flex justify-between gap-3 py-2"><dt className="text-gray-600 dark:text-gray-300">Efectivo Parrot</dt><dd className="font-mono font-semibold">{formatCurrency(totalEfectivoParrot)}</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt className="text-gray-600 dark:text-gray-300">ParrotPay</dt><dd className="font-mono font-semibold">{formatCurrency(totalParrotPayParrot)}</dd></div>
            <div className="flex justify-between gap-3 py-2"><dt className="text-gray-600 dark:text-gray-300">Tarjetas BBVA oficiales</dt><dd className="font-mono font-semibold">{formatCurrency(totalTarjetasBbva)}</dd></div>
            <div className="flex justify-between gap-3 py-2 text-purple-700 dark:text-purple-300"><dt>Menos: deducción total de terceros</dt><dd className="font-mono font-semibold">−{formatCurrency(totalTercerosDeducibles)}</dd></div>
            <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-[10px] text-gray-500">
              <label htmlFor="accountant-manual-third-party-adjustment">Ajuste manual incluido en la deducción</label>
              <div className="flex items-center gap-2">
                <span>$</span>
                <input
                  id="accountant-manual-third-party-adjustment"
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualTercerosVal || ''}
                  onChange={event => setMontoManualTercero(currentMonthKey, Number(event.target.value))}
                  className="w-28 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 font-mono text-xs text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex justify-between gap-3 py-2 text-gray-500"><dt>Menos: propinas excluidas</dt><dd className="font-mono font-semibold">−{formatCurrency(totalPropinasExcluidas)}</dd></div>
            <div className="flex justify-between gap-3 border-t border-gray-300 dark:border-gray-700 py-3 font-black"><dt>Total cobrado asignado a Factura Global</dt><dd className="font-mono text-emerald-700 dark:text-emerald-300">{formatCurrency(totalFacturaPublicoGeneral)}</dd></div>
          </dl>
        </div>

        <div className="p-4 sm:p-5 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/30">
          <h4 className="text-xs font-black uppercase tracking-wide text-gray-800 dark:text-gray-200">Desglose fiscal</h4>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-gray-600 dark:text-gray-300">Base Factura Global</dt><dd className="font-mono font-semibold">{formatCurrency(subtotalFacturaGlobal)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600 dark:text-gray-300">IVA incluido en Factura Global</dt><dd className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(ivaFacturaGlobal)}</dd></div>
            <div className="flex justify-between gap-3 border-t border-gray-200 dark:border-gray-700 pt-2 font-black"><dt>Total CFDI Global</dt><dd className="font-mono">{formatCurrency(totalConIvaFacturaGlobal)}</dd></div>
            <div className="flex justify-between gap-3 border-t border-gray-200 dark:border-gray-700 pt-2"><dt className="text-gray-600 dark:text-gray-300">IVA de CFDI a terceros ({facturasTercerosMes.length})</dt><dd className="font-mono font-semibold">{formatCurrency(ivaFacturasTerceros)}</dd></div>
            <div className="flex justify-between gap-3 pt-1 font-black text-emerald-800 dark:text-emerald-300"><dt>IVA trasladado del período</dt><dd className="font-mono">{formatCurrency(totalIvaTrasladadoPeriodo)}</dd></div>
          </dl>
          <p className="mt-3 text-[10px] leading-relaxed text-gray-500">El IVA de terceros corresponde a CFDI individuales; no se agrega al total a timbrar de la Factura Global.</p>
        </div>
      </section>

      <section className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wide text-gray-800 dark:text-gray-200">Control de revisión</h4>
            <p className="text-[10px] text-gray-500 mt-1">Los importes pendientes se conservan visibles para que el contador pueda validar su tratamiento.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onOpenTab('tickets')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-[10px] font-bold hover:bg-gray-50 dark:hover:bg-gray-800"><Receipt size={12} /> Tickets POS</button>
            <button type="button" onClick={() => onOpenTab('facturas')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-[10px] font-bold hover:bg-gray-50 dark:hover:bg-gray-800"><FileText size={12} /> Facturas y CFDI</button>
            <button type="button" onClick={() => { onOpenTab('comparativos'); onOpenComparativo('efectivo'); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-[10px] font-bold hover:bg-gray-50 dark:hover:bg-gray-800"><Scale size={12} /> Arqueo</button>
            <button type="button" onClick={() => { onOpenTab('comparativos'); onOpenComparativo('bbva_banco'); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-[10px] font-bold hover:bg-gray-50 dark:hover:bg-gray-800"><Landmark size={12} /> Conciliación BBVA</button>
            <button type="button" onClick={() => onOpenTab('depositos')} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 text-[10px] font-bold hover:bg-gray-50 dark:hover:bg-gray-800"><ArrowRight size={12} /> Depósitos</button>
          </div>
        </div>
        <div className="overflow-x-auto mt-3">
          <table className="w-full min-w-[600px] text-left text-[11px]">
            <thead><tr className="text-[9px] uppercase text-gray-500 border-b border-gray-200 dark:border-gray-800"><th className="py-2 pr-3">Validación</th><th className="py-2 pr-3">Resultado</th><th className="py-2">Estado</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {reviewItems.map(item => (
                <tr key={item.label}>
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{item.label}</td>
                  <td className="py-2 pr-3 font-mono">{item.value}</td>
                  <td className={`py-2 font-bold ${item.needsReview ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{item.needsReview ? 'Revisar' : 'Sin diferencia'}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">Tickets pendientes de depósito</td>
                <td className="py-2 pr-3 font-mono">{ticketsPendientesDeposito.length} · {formatCurrency(montoTicketsPendientesDeposito)}</td>
                <td className={`py-2 font-bold ${ticketsPendientesDeposito.length ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{ticketsPendientesDeposito.length ? 'Identificados' : 'Sin pendientes'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <details className="border-b border-gray-200 dark:border-gray-800">
        <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 text-xs font-bold">
          <span>CFDI individuales a terceros · {facturasTercerosMes.length} documentos</span>
          <span className="font-mono text-purple-700 dark:text-purple-300">Total {formatCurrency(totalTercerosDeducibles)} · IVA {formatCurrency(ivaFacturasTerceros)}</span>
        </summary>
        <div className="overflow-x-auto max-h-[360px] border-t border-gray-200 dark:border-gray-800">
          <table className="w-full min-w-[700px] text-left text-[10px]">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase"><tr><th className="p-2.5">Fecha / folio</th><th className="p-2.5">RFC / receptor</th><th className="p-2.5 text-right">Base</th><th className="p-2.5 text-right">IVA</th><th className="p-2.5 text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {facturasTercerosMes.map(invoice => (
                <tr key={invoice.id || invoice.uuid_fiscal}>
                  <td className="p-2.5 font-mono">{invoice.fecha_emision || invoice.fecha || '-'}<span className="block text-gray-400">{invoice.serie_folio || invoice.uuid_fiscal || '-'}</span></td>
                  <td className="p-2.5">{invoice.rfc_receptor || invoice.rfc || '-'}<span className="block text-gray-400">{invoice._clienteNombre || invoice.cliente_nombre || invoice.nombre_receptor || 'Cliente'}</span></td>
                  <td className="p-2.5 text-right font-mono">{formatCurrency(invoice._subtotal || invoice.subtotal || 0)}</td>
                  <td className="p-2.5 text-right font-mono">{formatCurrency(invoice._iva ?? invoice.iva_trasladado ?? 0)}</td>
                  <td className="p-2.5 text-right font-mono font-bold">{formatCurrency(invoice._total || invoice.total || 0)}</td>
                </tr>
              ))}
              {facturasTercerosMes.length === 0 && <tr><td colSpan={5} className="p-5 text-center text-gray-400">No hay CFDI a terceros en este período.</td></tr>}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
};