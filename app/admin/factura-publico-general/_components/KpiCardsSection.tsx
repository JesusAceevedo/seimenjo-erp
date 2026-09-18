'use client';

import React from 'react';
import {
  Globe,
  Wallet,
  CreditCard,
  Building2,
  CheckCircle2,
} from 'lucide-react';

interface KpiCardsSectionProps {
  totalFacturaPublicoGeneral: number;
  totalEfectivoParrot: number;
  totalParrotPayParrot: number;
  totalTercerosDeducibles: number;
  controlEfectivo: any;
  comparativoTarjetas: any;
  comparativoBbvaBanco: any;
  userCargasMes: any[];
  formatCurrency: (val: number | string | null | undefined) => string;
  formatPeriodoCarga: (c: any) => string;
  setTabActiva: (tab: 'facturas' | 'tickets' | 'comparativos' | 'depositos') => void;
  setSubTabComparativo: (subTab: 'efectivo' | 'tarjetas' | 'bbva_banco' | 'desfase_mes') => void;
}

export const KpiCardsSection: React.FC<KpiCardsSectionProps> = ({
  totalFacturaPublicoGeneral,
  totalEfectivoParrot,
  totalParrotPayParrot,
  totalTercerosDeducibles,
  controlEfectivo,
  comparativoTarjetas,
  comparativoBbvaBanco,
  userCargasMes,
  formatCurrency,
  formatPeriodoCarga,
  setTabActiva,
  setSubTabComparativo,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      {/* 1. FACTURA PÚBLICO EN GENERAL (BASE PARROT: SOLO EFECTIVO + PARROTPAY) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900/50 shadow-sm flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Globe size={14} /> Base Factura PG (Parrot)</span>
            <span className="text-[9px] font-black bg-emerald-100 dark:bg-emerald-955 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
              Solo Efec + ParrotPay
            </span>
          </span>
          <h3 className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-2">
            {formatCurrency(totalFacturaPublicoGeneral)}
          </h3>
          <div className="mt-1 space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400 font-sans">
            <div className="flex justify-between">
              <span>Efectivo Parrot:</span>
              <span className="font-mono font-bold text-gray-700 dark:text-gray-200">{formatCurrency(totalEfectivoParrot)}</span>
            </div>
            {totalParrotPayParrot > 0 && (
              <div className="flex justify-between">
                <span>ParrotPay:</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{formatCurrency(totalParrotPayParrot)}</span>
              </div>
            )}
            <div className="flex justify-between text-purple-600 dark:text-purple-400">
              <span>Deducción Terceros:</span>
              <span className="font-mono font-bold">-{formatCurrency(totalTercerosDeducibles)}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-[9px] text-gray-400 flex items-center gap-1">
          <CheckCircle2 size={11} className="text-emerald-500" />
          <span>Tarjetas excluidas por regla de facturación</span>
        </div>
      </div>

      {/* 2. CONTROL DE EFECTIVO: ¿CUÁNTO FALTA POR DEPOSITAR? */}
      <div className={`p-5 rounded-2xl border shadow-sm flex flex-col justify-between ${
        controlEfectivo.faltaPorDepositar > 0
          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
          : 'bg-white dark:bg-gray-900 border-emerald-200 dark:border-emerald-900/40'
      }`}>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider flex items-center justify-between text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-1.5"><Wallet size={14} className={controlEfectivo.faltaPorDepositar > 0 ? "text-amber-500" : "text-emerald-500"} /> Falta por Depositar</span>
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
              controlEfectivo.faltaPorDepositar > 0
                ? 'bg-amber-100 dark:bg-amber-955 text-amber-800 dark:text-amber-300'
                : 'bg-emerald-100 dark:bg-emerald-955 text-emerald-800 dark:text-emerald-300'
            }`}>
              {controlEfectivo.faltaPorDepositar > 0 ? '⚠️ Pendiente' : '✅ 100% Depositado'}
            </span>
          </span>
          <h3 className={`text-2xl font-black font-mono mt-2 ${
            controlEfectivo.faltaPorDepositar > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {formatCurrency(controlEfectivo.faltaPorDepositar)}
          </h3>
          <div className="mt-1 space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400 font-sans">
            <div className="flex justify-between">
              <span>Venta Efectivo Parrot:</span>
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{formatCurrency(controlEfectivo.ventasEfectivoParrot)}</span>
            </div>
            <div className="flex justify-between">
              <span>Depositado en Banco (Cargas):</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(controlEfectivo.totalDepositosEfectivoRealizados)}</span>
            </div>
            {controlEfectivo.montoEfectivoExcluidoOtroMes > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>Excluido (Otro mes):</span>
                <span className="font-mono font-bold">-{formatCurrency(controlEfectivo.montoEfectivoExcluidoOtroMes)}</span>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setTabActiva('comparativos'); setSubTabComparativo('efectivo'); }}
          className={`mt-3 w-full py-1.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 border cursor-pointer ${
            controlEfectivo.faltaPorDepositar > 0
              ? 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-800/50 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
              : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
          }`}
        >
          Ver Arqueo de Efectivo
        </button>
      </div>

      {/* 3. COMPARATIVO TARJETAS: PARROT VS CORTE BBVA (OFICIAL) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-900/50 shadow-sm flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><CreditCard size={14} /> Tarjetas BBVA vs Parrot</span>
            <span className="text-[9px] font-black bg-blue-100 dark:bg-blue-955 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
              BBVA Oficial
            </span>
          </span>
          <h3 className="text-2xl font-black font-mono text-blue-700 dark:text-blue-300 mt-2">
            {formatCurrency(comparativoTarjetas.totalTarjetasBbva)}
          </h3>
          <div className="mt-1 space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400 font-sans">
            <div className="flex justify-between">
              <span>Corte BBVA (Sin prop):</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{formatCurrency(comparativoTarjetas.totalTarjetasBbva)}</span>
            </div>
            <div className="flex justify-between">
              <span>Parrot Tarjetas (Sin prop):</span>
              <span className="font-mono font-bold text-gray-600 dark:text-gray-300">{formatCurrency(comparativoTarjetas.totalTarjetasParrot)}</span>
            </div>
            <div className="flex justify-between">
              <span>Diferencia (Brecha):</span>
              <span className={`font-mono font-bold ${comparativoTarjetas.diferenciaTarjetas === 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {comparativoTarjetas.diferenciaTarjetas >= 0 ? '+' : ''}{formatCurrency(comparativoTarjetas.diferenciaTarjetas)}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setTabActiva('comparativos'); setSubTabComparativo('tarjetas'); }}
          className="mt-3 w-full py-1.5 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 border border-blue-200 dark:border-blue-800 cursor-pointer"
        >
          Ver Comparativo de Tarjetas
        </button>
      </div>

      {/* 4. BBVA: TICKETS VS ESTADO DE CUENTA */}
      <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-900/50 shadow-sm flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><Building2 size={14} /> BBVA: Tickets vs Banco</span>
            <span className="text-[9px] font-black bg-indigo-100 dark:bg-indigo-955 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
              Abonos TPV
            </span>
          </span>
          <h3 className="text-2xl font-black font-mono text-indigo-700 dark:text-indigo-300 mt-2">
            {formatCurrency(comparativoBbvaBanco.totalDepositosBbvaTarjetas)}
          </h3>
          <div className="mt-1 space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400 font-sans">
            <div className="flex justify-between">
              <span>Ingresos en Banco:</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(comparativoBbvaBanco.totalDepositosBbvaTarjetas)}</span>
            </div>
            {comparativoBbvaBanco.totalExcluidosBbvaTarjetas > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>Excluidos (Otro mes):</span>
                <span className="font-mono font-bold">-{formatCurrency(comparativoBbvaBanco.totalExcluidosBbvaTarjetas)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tickets BBVA (Sin prop):</span>
              <span className="font-mono font-bold text-gray-600 dark:text-gray-300">{formatCurrency(comparativoBbvaBanco.totalTicketsBbvaSinPropina)}</span>
            </div>
            <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-medium">
              <span>+ Propina en Tarjeta:</span>
              <span className="font-mono font-bold">+{formatCurrency(comparativoBbvaBanco.totalPropinaBbvaTarjetas)}</span>
            </div>
            <div className="flex justify-between text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-800 pt-0.5 font-semibold">
              <span>Total Tickets (Con prop):</span>
              <span className="font-mono font-bold text-gray-900 dark:text-white">{formatCurrency(comparativoBbvaBanco.totalTicketsBbvaConPropina)}</span>
            </div>
            {comparativoBbvaBanco.totalEntrantesProximoMesConPropina > 0 && (
              <>
                <div className="flex justify-between text-purple-600 dark:text-purple-400 font-medium" title="Tickets generados a fin de mes que se liquidan en banco el próximo mes">
                  <span>Entrantes Próx. Mes:</span>
                  <span className="font-mono font-bold">-{formatCurrency(comparativoBbvaBanco.totalEntrantesProximoMesConPropina)}</span>
                </div>
                <div className="flex justify-between text-indigo-700 dark:text-indigo-300 font-semibold border-t border-dashed border-gray-200 dark:border-gray-800 pt-0.5">
                  <span>Tickets Acreditados:</span>
                  <span className="font-mono font-bold">{formatCurrency(comparativoBbvaBanco.totalTicketsAcreditadosMes)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span>Variación:</span>
              <span className={`font-mono font-bold ${Math.abs(comparativoBbvaBanco.diferenciaTicketsVsBanco) < 0.01 ? 'text-emerald-500' : comparativoBbvaBanco.diferenciaTicketsVsBanco >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {comparativoBbvaBanco.diferenciaTicketsVsBanco >= 0 ? '+' : ''}{formatCurrency(comparativoBbvaBanco.diferenciaTicketsVsBanco)}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-1 flex-wrap">
            {userCargasMes.map(c => (
              <span key={c.id} className="text-[8px] font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 truncate max-w-full" title={formatPeriodoCarga(c)}>
                📄 {formatPeriodoCarga(c)}
              </span>
            ))}
            {userCargasMes.length === 0 && (
              <span className="text-[9px] text-amber-600 dark:text-amber-400 italic">
                Sin cargas del usuario en el mes
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setTabActiva('comparativos'); setSubTabComparativo('bbva_banco'); }}
            className="w-full py-1.5 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
          >
            Ver Conciliación BBVA
          </button>
        </div>
      </div>

    </div>
  );
};
