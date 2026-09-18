'use client';

import React from 'react';
import {
  Building2,
  CreditCard,
} from 'lucide-react';

interface ConciliacionBbvaSubTabProps {
  comparativoBbvaBanco: any;
  userCargasMes: any[];
  formatPeriodoCarga: (c: any) => string;
  formatCurrency: (val: number | string | null | undefined) => string;
  toggleProximoMesComp: (compId: string, isCurrentlyProximo: boolean) => void;
  esMovimientoEfectivo: (concepto: string) => boolean;
}

export const ConciliacionBbvaSubTab: React.FC<ConciliacionBbvaSubTabProps> = ({
  comparativoBbvaBanco,
  userCargasMes,
  formatPeriodoCarga,
  formatCurrency,
  toggleProximoMesComp,
  esMovimientoEfectivo,
}) => {
  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      
      {/* BANNER EXPLICATIVO CON LAS CARGAS ACTIVAS */}
      <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-900 dark:text-indigo-200 flex items-start gap-3">
        <Building2 className="text-indigo-500 w-6 h-6 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h5 className="text-xs font-black uppercase tracking-wide">
            BBVA: Tickets de Tarjeta (Con Propina Separada) vs Abonos en Estado de Cuenta
          </h5>
          <p className="text-xs opacity-90">
            El banco deposita en cuenta el total cobrado en la terminal física (Venta + Propina). Aquí se <strong>contabiliza y separa la propina</strong> mostrando su importe exacto para verificar que las liquidaciones bancarias concilien con precisión.
          </p>
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-[10px] font-bold uppercase text-indigo-800 dark:text-indigo-300">Cargas del usuario incluidas en este período:</span>
            {userCargasMes.map(c => (
              <span key={c.id} className="text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-955 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-md border border-indigo-300 dark:border-indigo-800">
                📄 {formatPeriodoCarga(c)} ({formatCurrency(c.total_depositos)})
              </span>
            ))}
            {userCargasMes.length === 0 && (
              <span className="text-[10px] text-amber-600 font-bold">
                ⚠️ No se encontraron cargas subidas por el usuario para este mes.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CARDS RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700">
          <span className="text-[10px] font-bold uppercase text-gray-400 block">Tickets BBVA (Sin Prop)</span>
          <h4 className="text-xl font-black font-mono text-gray-800 dark:text-gray-100 mt-1">
            {formatCurrency(comparativoBbvaBanco.totalTicketsBbvaSinPropina)}
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">
            Venta neta con tarjetas en terminales BBVA.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
          <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 block">Propinas en Tarjeta</span>
          <h4 className="text-xl font-black font-mono text-blue-700 dark:text-blue-300 mt-1">
            +{formatCurrency(comparativoBbvaBanco.totalPropinaBbvaTarjetas)}
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">
            Propinas (0% SAT) depositadas junto con ventas.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900">
          <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block">Total Tickets (Con Prop)</span>
          <h4 className="text-xl font-black font-mono text-indigo-700 dark:text-indigo-300 mt-1">
            {formatCurrency(comparativoBbvaBanco.totalTicketsBbvaConPropina)}
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">
            Total cobrado en terminales (Ventas + Propinas).
          </p>
        </div>

        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900">
          <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 block">Entrantes Próx. Mes</span>
          <h4 className="text-xl font-black font-mono text-purple-700 dark:text-purple-300 mt-1">
            -{formatCurrency(comparativoBbvaBanco.totalEntrantesProximoMesConPropina)}
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">
            Cobros fin de mes (ej. 31 ago) que ingresan el mes siguiente.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
          <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Ingresos en Banco (TPV)</span>
          <h4 className="text-xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-1">
            {formatCurrency(comparativoBbvaBanco.totalDepositosBbvaTarjetas)}
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">
            Liquidaciones acreditadas en la cuenta BBVA.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <span className="text-[10px] font-bold uppercase text-gray-600 dark:text-gray-400 block">Variación Conciliada</span>
          <h4 className={`text-xl font-black font-mono mt-1 ${
            Math.abs(comparativoBbvaBanco.diferenciaTicketsVsBanco) < 0.01 ? 'text-emerald-600' : comparativoBbvaBanco.diferenciaTicketsVsBanco >= 0 ? 'text-emerald-600' : 'text-amber-600'
          }`}>
            {comparativoBbvaBanco.diferenciaTicketsVsBanco >= 0 ? '+' : ''}{formatCurrency(comparativoBbvaBanco.diferenciaTicketsVsBanco)}
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">
            {Math.abs(comparativoBbvaBanco.diferenciaTicketsVsBanco) < 0.01
              ? 'Conciliación exacta al 100%.'
              : 'Banco vs Tickets acreditados en el mes.'}
          </p>
        </div>
      </div>

      {/* LISTADO DE CORTES DE TERMINAL BBVA REGISTRADOS */}
      {comparativoBbvaBanco.ticketsBbvaDetallados.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-2">
            <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <CreditCard size={14} className="text-blue-500" /> Cortes de Terminal BBVA Registrados ({comparativoBbvaBanco.ticketsBbvaDetallados.length})
            </span>
            <div className="text-[10px] text-gray-500 font-mono flex items-center gap-3 flex-wrap">
              <span>Ventas: <strong className="text-gray-800 dark:text-gray-200">{formatCurrency(comparativoBbvaBanco.totalTicketsBbvaSinPropina)}</strong></span>
              <span>Propinas: <strong className="text-indigo-600 dark:text-indigo-400">+{formatCurrency(comparativoBbvaBanco.totalPropinaBbvaTarjetas)}</strong></span>
              <span>Total: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(comparativoBbvaBanco.totalTicketsBbvaConPropina)}</strong></span>
              {comparativoBbvaBanco.totalEntrantesProximoMesConPropina > 0 && (
                <span className="text-purple-600 dark:text-purple-400 font-bold">
                  Entrantes Próx. Mes: -{formatCurrency(comparativoBbvaBanco.totalEntrantesProximoMesConPropina)}
                </span>
              )}
              <span className="text-indigo-700 dark:text-indigo-300 font-bold">
                Acreditados Mes: {formatCurrency(comparativoBbvaBanco.totalTicketsAcreditadosMes)}
              </span>
            </div>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                <th className="p-3">Fecha</th>
                <th className="p-3">Descripción / Terminal</th>
                <th className="p-3 text-right">Tarjetas (Sin Prop)</th>
                <th className="p-3 text-right text-indigo-600 dark:text-indigo-400">Propina (Separada)</th>
                <th className="p-3 text-right font-black text-gray-900 dark:text-white">Total Cobrado (Con Prop)</th>
                <th className="p-3 text-center">Estatus en Banco</th>
                <th className="p-3 text-center">Próximo Mes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {comparativoBbvaBanco.ticketsBbvaDetallados.map((c: any) => {
                return (
                  <tr key={c.id} className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors ${c._isEntranteProximoMes ? 'bg-purple-50/40 dark:bg-purple-950/20' : ''}`}>
                    <td className="p-3 font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                    </td>
                    <td className="p-3 font-bold text-gray-800 dark:text-gray-200 max-w-sm truncate" title={c.descripcion}>
                      {c.descripcion || 'Corte Terminal BBVA'}
                    </td>
                    <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300">
                      {formatCurrency(c._sinProp)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      +{formatCurrency(c._prop)}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                      {formatCurrency(c._conProp)}
                    </td>
                    <td className="p-3 text-center">
                      {c._isEntranteProximoMes ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-100 text-purple-800 dark:bg-purple-955 dark:text-purple-300 border border-purple-200 dark:border-purple-800" title="Cobrado a fin de mes pero ingresa a la cuenta bancaria en el próximo mes">
                          ⏳ Ingresa Próx. Mes
                        </span>
                      ) : c._hasMovInCurrentMonth ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-955 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          ✅ Acreditado en Mes
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-800 dark:bg-blue-955 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          Acreditado en Mes
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => toggleProximoMesComp(c.id, c._isEntranteProximoMes)}
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition cursor-pointer ${
                          c._isEntranteProximoMes
                            ? 'bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
                        }`}
                        title={c._isEntranteProximoMes ? 'Hacer clic para forzar su inclusión en este mes' : 'Hacer clic para marcar que ingresa el próximo mes'}
                      >
                        {c._isEntranteProximoMes ? '✓ Próx. Mes' : 'Mover a Próx. Mes'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* LISTADO DE DEPÓSITOS ACREDITADOS EN BBVA (SOLO DE CARGAS DEL USUARIO) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <Building2 size={14} className="text-indigo-500" /> Movimientos Bancarios de Depósito en Cuenta BBVA ({comparativoBbvaBanco.bbvaMovimientos.length})
          </span>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
              <th className="p-3">Fecha</th>
              <th className="p-3">Concepto Bancario</th>
              <th className="p-3">Tipo Movimiento</th>
              <th className="p-3 text-right font-black">Monto Acreditado</th>
              <th className="p-3 text-center">Estatus Conciliación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {comparativoBbvaBanco.bbvaMovimientos.map((m: any) => {
              const isCash = esMovimientoEfectivo(m.concepto);
              return (
                <tr key={m.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="p-3 font-mono font-medium text-gray-700 dark:text-gray-300">
                    {m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                  </td>
                  <td className="p-3 font-bold text-gray-800 dark:text-gray-200 max-w-sm truncate" title={m.concepto}>
                    {m.concepto || 'Depósito BBVA'}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                      isCash
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-300'
                        : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-955 dark:text-indigo-300'
                    }`}>
                      {isCash ? '💵 Efectivo / Practicaja' : '💳 Tarjetas / TPV'}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(m._monto)}
                  </td>
                  <td className="p-3 text-center">
                    {m._hasInvoice ? (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-955 dark:text-emerald-300">
                        Conciliado
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        Sin Conciliar
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {comparativoBbvaBanco.bbvaMovimientos.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                  No se encontraron depósitos en la cuenta BBVA para el período seleccionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
