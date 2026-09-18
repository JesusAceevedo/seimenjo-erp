'use client';

import React from 'react';
import {
  CalendarClock,
  Receipt,
} from 'lucide-react';

interface DesfaseMesSubTabProps {
  movimientosOtroMes: any[];
  ticketsOtroMes: any[];
  comparativoBbvaBanco: any;
  totalMontoExcluidoOtroMes: number;
  setAllExcludedMovements: (ids: string[], exclude: boolean) => void;
  toggleExcludeMovement: (id: string) => void;
  toggleExcludeComprobante: (id: string) => void;
  toggleProximoMesComp: (id: string, isCurrentlyProximo: boolean) => void;
  formatCurrency: (val: number | string | null | undefined) => string;
  esMovimientoEfectivo: (concepto: string) => boolean;
}

export const DesfaseMesSubTab: React.FC<DesfaseMesSubTabProps> = ({
  movimientosOtroMes,
  ticketsOtroMes,
  comparativoBbvaBanco,
  totalMontoExcluidoOtroMes,
  setAllExcludedMovements,
  toggleExcludeMovement,
  toggleExcludeComprobante,
  toggleProximoMesComp,
  formatCurrency,
  esMovimientoEfectivo,
}) => {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      
      {/* BANNER EXPLICATIVO */}
      <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200 flex items-start gap-3">
        <CalendarClock className="text-purple-500 w-6 h-6 shrink-0 mt-0.5" />
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <h5 className="text-xs font-black uppercase tracking-wide">
              Desfase de Período: Movimientos y Tickets que Pertenecen a Otro Mes
            </h5>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllExcludedMovements(movimientosOtroMes.map(m => m.id), true)}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black transition cursor-pointer shadow-xs"
              >
                Excluir Todos de la Factura Global
              </button>
              <button
                type="button"
                onClick={() => setAllExcludedMovements(movimientosOtroMes.map(m => m.id), false)}
                className="px-2.5 py-1 bg-white dark:bg-gray-800 hover:bg-gray-100 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 rounded-lg text-[10px] font-bold transition cursor-pointer"
              >
                Incluir Todos
              </button>
            </div>
          </div>
          <p className="text-xs opacity-90">
            Identifica cobros o depósitos acreditados en este estado de cuenta pero cuyas ventas o tickets corresponden contablemente a otro mes (por ejemplo, ventas de fin de mes acreditadas en los primeros días del mes siguiente).
          </p>
          <p className="text-[11px] font-medium text-purple-700 dark:text-purple-300">
            💡 Los movimientos marcados como <strong>Excluidos</strong> no se sumarán a la base de la Factura Global de este mes ni alterarán los comparativos de tickets.
          </p>
        </div>
      </div>

      {/* CARDS RESUMEN DE DESFASE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
          <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 block">Movimientos con Desfase Detectados</span>
          <h4 className="text-xl font-black font-mono text-purple-700 dark:text-purple-300 mt-1">
            {movimientosOtroMes.length} <span className="text-xs font-normal">movimientos</span>
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">
            Monto total acreditado: {formatCurrency(movimientosOtroMes.reduce((acc, m) => acc + m._monto, 0))}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
          <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block">Total Excluido de Factura Global</span>
          <h4 className="text-xl font-black font-mono text-amber-700 dark:text-amber-300 mt-1">
            {formatCurrency(totalMontoExcluidoOtroMes)}
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">
            Deducción automática aplicada a este mes para no facturar ventas ajenas al período.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
          <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Abonos Netos del Mes Actual (BBVA)</span>
          <h4 className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-1">
            {formatCurrency(comparativoBbvaBanco.totalDepositosBbvaTarjetas)}
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">
            Abonos en cuenta correspondientes estrictamente al mes seleccionado.
          </p>
        </div>
      </div>

      {/* TABLA DE MOVIMIENTOS BANCARIOS CON DESFASE */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <CalendarClock size={14} className="text-purple-500" /> Detalle de Movimientos Bancarios Acreditados de Otro Mes ({movimientosOtroMes.length})
          </span>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
              <th className="p-3">Fecha Banco</th>
              <th className="p-3">Concepto Bancario</th>
              <th className="p-3 text-right font-black">Monto Depósito</th>
              <th className="p-3">Ticket / Corte Vinculado</th>
              <th className="p-3 text-center">Mes Perteneciente</th>
              <th className="p-3">Motivo de Desfase</th>
              <th className="p-3 text-center">¿Contabilizar en Factura Global?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {movimientosOtroMes.map((m: any) => {
              const cdms = m._cdms || [];
              return (
                <tr key={m.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="p-3 font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                  </td>
                  <td className="p-3 font-bold text-gray-800 dark:text-gray-200 max-w-xs truncate" title={m.concepto}>
                    {m.concepto || 'Depósito bancario'}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(m._monto)}
                  </td>
                  <td className="p-3">
                    {cdms.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {cdms.map((c: any, idx: number) => {
                          const comp = c.comprobantes_deposito;
                          const title = comp?.descripcion || `Ticket ${c.comprobante_id?.substring(0, 6)}`;
                          const fechaComp = comp?.fecha ? new Date(comp.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '';
                          return (
                            <span key={idx} className="font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 text-[10px] inline-flex items-center gap-1 max-w-[200px] truncate" title={`${title} (${fechaComp})`}>
                              🎫 {title} {fechaComp ? `(${fechaComp})` : ''}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">Sin ticket vinculado</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-300">
                      {m._mesDetectado || 'Otro Mes'}
                    </span>
                  </td>
                  <td className="p-3 text-[11px] text-gray-600 dark:text-gray-400 max-w-xs truncate" title={m._otherMonthRazon}>
                    {m._otherMonthRazon || 'Desfase de período'}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleExcludeMovement(m.id)}
                      className={`px-3 py-1 rounded-full text-[10px] font-black transition cursor-pointer flex items-center justify-center gap-1 mx-auto ${
                        m._isExcluded
                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-955/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-955/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {m._isExcluded ? (
                        <>🚫 Excluido de Factura (Clic para Incluir)</>
                      ) : (
                        <>✅ Incluido en Factura (Clic para Excluir)</>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}

            {movimientosOtroMes.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                  No se detectaron movimientos con desfase de mes para el período seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* TICKETS DE OTRO MES DETECTADOS */}
      {ticketsOtroMes.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
            <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Receipt size={14} className="text-indigo-500" /> Tickets / Cortes Detectados que Pertenecen a Otro Mes ({ticketsOtroMes.length})
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                <th className="p-3">Fecha Ticket</th>
                <th className="p-3">Descripción / Folio</th>
                <th className="p-3 text-right font-black">Monto Ticket</th>
                <th className="p-3 text-center">Mes Perteneciente</th>
                <th className="p-3">Motivo</th>
                <th className="p-3 text-center">¿Contabilizar en Factura Global?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {ticketsOtroMes.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="p-3 font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {t.fecha ? new Date(t.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                  </td>
                  <td className="p-3 font-bold text-gray-800 dark:text-gray-200 max-w-xs truncate" title={t.descripcion}>
                    {t.descripcion || 'Ticket de venta'}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                    {formatCurrency(t.monto)}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-300">
                      {t._mesDetectado || 'Otro Mes'}
                    </span>
                  </td>
                  <td className="p-3 text-[11px] text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {t._otherMonthRazon || 'Desfase de período'}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleExcludeComprobante(t.id)}
                      className={`px-3 py-1 rounded-full text-[10px] font-black transition cursor-pointer flex items-center justify-center gap-1 mx-auto ${
                        t._isExcluded
                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-955/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-955/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {t._isExcluded ? (
                        <>🚫 Excluido de Factura (Clic para Incluir)</>
                      ) : (
                        <>✅ Incluido en Factura (Clic para Excluir)</>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TICKETS BBVA DEL FIN DE MES (ENTRANTES DEL PRÓXIMO MES) */}
      {comparativoBbvaBanco.entrantesProximoMesTickets.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border-b border-purple-200 dark:border-purple-800 flex justify-between items-center flex-wrap gap-2">
            <span className="text-xs font-black uppercase text-purple-900 dark:text-purple-300 flex items-center gap-2">
              <Receipt size={14} className="text-purple-600 dark:text-purple-400" /> Tickets BBVA con Desfase (Ingresan al Banco en el Próximo Mes) ({comparativoBbvaBanco.entrantesProximoMesTickets.length})
            </span>
            <div className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300 flex items-center gap-3">
              <span>Total con Propina: <strong>{formatCurrency(comparativoBbvaBanco.totalEntrantesProximoMesConPropina)}</strong></span>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                <th className="p-3">Fecha Ticket</th>
                <th className="p-3">Descripción / Terminal</th>
                <th className="p-3 text-right">Tarjetas (Sin Prop)</th>
                <th className="p-3 text-right text-indigo-600 dark:text-indigo-400">Propina</th>
                <th className="p-3 text-right font-black text-purple-700 dark:text-purple-300">Total Cobrado</th>
                <th className="p-3 text-center">Estatus</th>
                <th className="p-3 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {comparativoBbvaBanco.entrantesProximoMesTickets.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors bg-purple-50/30 dark:bg-purple-950/10">
                  <td className="p-3 font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {t.fecha ? new Date(t.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                  </td>
                  <td className="p-3 font-bold text-gray-800 dark:text-gray-200 max-w-xs truncate" title={t.descripcion}>
                    {t.descripcion || 'Ticket BBVA'}
                  </td>
                  <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300">
                    {formatCurrency(t._sinProp)}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    +{formatCurrency(t._prop)}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-purple-700 dark:text-purple-300">
                    {formatCurrency(t._conProp)}
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-800 dark:bg-purple-955 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      ⏳ Ingresa Próx. Mes
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => toggleProximoMesComp(t.id, true)}
                      className="px-2.5 py-1 rounded-lg text-[9px] font-black transition cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-100 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 shadow-xs"
                    >
                      Mover a Este Mes
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
