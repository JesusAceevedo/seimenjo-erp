'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useThemeMode } from '../../../lib/useThemeMode';
import PeriodSelector from '../_components/PeriodSelector';
import {
  FileText,
  FileSpreadsheet,
  RefreshCw,
  ArrowLeft,
  List,
  Scale,
  Building2,
} from 'lucide-react';

import { useFacturaPublicoGeneralData } from './_hooks/useFacturaPublicoGeneralData';
import { ChecklistCierreFiscal } from './_components/ChecklistCierreFiscal';
import { KpiCardsSection } from './_components/KpiCardsSection';
import { ControlBarSecondary } from './_components/ControlBarSecondary';
import { FacturasEmitidasTab } from './_components/tabs/FacturasEmitidasTab';
import { TicketsPosTab } from './_components/tabs/TicketsPosTab';
import { ComparativosTab } from './_components/tabs/ComparativosTab';
import { DepositosBancariosTab } from './_components/tabs/DepositosBancariosTab';

export const dynamic = 'force-dynamic';

export default function FacturaPublicoGeneralPage() {
  const router = useRouter();
  const { isDarkMode } = useThemeMode();

  const {
    loading,
    cuentasBancarias,
    selectedMonth,
    refreshPeriodStatus,
    fetchData,
    tabActiva,
    setTabActiva,
    subTabComparativo,
    setSubTabComparativo,
    searchQuery,
    setSearchQuery,
    selectedCuentaId,
    setSelectedCuentaId,
    filtroTipo,
    setFiltroTipo,
    searchFacturasQuery,
    setSearchFacturasQuery,
    filtroFacturasTipo,
    setFiltroFacturasTipo,
    toggleExcludeMovement,
    toggleExcludeComprobante,
    toggleProximoMesComp,
    setAllExcludedMovements,
    facturadosTerceros,
    toggleFacturadoTercero,
    setMontoManualTercero,
    handleDownloadFile,
    exportFacturaPublicoExcel,
    formatCurrency,
    formatPeriodoCarga,
    esMovimientoEfectivo,
    userCargasMes,
    todasLasFacturasMes,
    displayedFacturas,
    ticketsMes,
    displayedTickets,
    depositosMes,
    movimientosOtroMes,
    ticketsOtroMes,
    facturasTercerosMes,
    facturasPgMes,
    totalFacturadoMes,
    totalFacturaPublicoGeneral,
    totalEfectivoParrot,
    totalParrotPayParrot,
    totalTercerosDeducibles,
    efectivoPublicoGeneral,
    parrotPayPublicoGeneral,
    manualTercerosVal,
    currentMonthKey,
    totalPropinasExcluidas,
    controlEfectivo,
    comparativoTarjetas,
    comparativoBbvaBanco,
    totalMontoDepositosMes,
    totalDepositosConTicketMes,
    montoDepositosConTicketMes,
    totalDepositosFacturadosMes,
    montoDepositosFacturadosMes,
    totalMontoExcluidoOtroMes,
  } = useFacturaPublicoGeneralData();

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="flex h-screen overflow-hidden">
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto p-4 md:p-6 space-y-6">

          {/* CABECERA */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-sm">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={() => router.push('/admin/contabilidad')}
                  className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  title="Volver a Contabilidad y Bancos"
                >
                  <ArrowLeft size={16} />
                </button>
                <h2 className="text-3xl font-extrabold flex items-center gap-3">
                  <FileText className="text-emerald-500 w-8 h-8" /> Factura Público en General y Control
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
                Cálculo de factura global Parrot (solo Efectivo + ParrotPay). Comparativo de tarjetas BBVA oficial, conciliación bancaria basada en cargas del usuario y control de faltante en efectivo.
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
              <button
                type="button"
                onClick={exportFacturaPublicoExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                title="Descargar reporte Excel completo con comparativos"
              >
                <FileSpreadsheet size={15} /> Exportar Excel Completo
              </button>
              <button
                onClick={fetchData}
                className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-emerald-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm cursor-pointer"
                title="Refrescar datos"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* ASISTENTE DE CIERRE FISCAL MENSUAL */}
          <ChecklistCierreFiscal
            totalTickets={ticketsMes.length}
            totalTercerosDeducibles={totalTercerosDeducibles}
            totalTarjetasBbva={comparativoTarjetas.totalTarjetasBbva}
            diferenciaTarjetas={comparativoTarjetas.diferenciaTarjetas}
            faltaPorDepositar={controlEfectivo.faltaPorDepositar}
            totalFacturaPublicoGeneral={totalFacturaPublicoGeneral}
            formatCurrency={formatCurrency}
            selectedMonth={selectedMonth}
          />

          {/* TARJETAS EJECUTIVAS DE CONTROL Y FACTURACIÓN */}
          <KpiCardsSection
            totalFacturaPublicoGeneral={totalFacturaPublicoGeneral}
            totalEfectivoParrot={totalEfectivoParrot}
            totalParrotPayParrot={totalParrotPayParrot}
            totalTercerosDeducibles={totalTercerosDeducibles}
            controlEfectivo={controlEfectivo}
            comparativoTarjetas={comparativoTarjetas}
            comparativoBbvaBanco={comparativoBbvaBanco}
            userCargasMes={userCargasMes}
            formatCurrency={formatCurrency}
            formatPeriodoCarga={formatPeriodoCarga}
            setTabActiva={setTabActiva}
            setSubTabComparativo={setSubTabComparativo}
          />

          {/* BARRA SECUNDARIA: CONTROL DE VENTAS NETAS Y TICKETS */}
          <ControlBarSecondary
            totalFacturaPublicoGeneral={totalFacturaPublicoGeneral}
            efectivoPublicoGeneral={efectivoPublicoGeneral}
            parrotPayPublicoGeneral={parrotPayPublicoGeneral}
            totalParrotPayParrot={totalParrotPayParrot}
            totalTarjetasBbva={comparativoTarjetas.totalTarjetasBbva}
            totalPropinasExcluidas={totalPropinasExcluidas}
            manualTercerosVal={manualTercerosVal}
            currentMonthKey={currentMonthKey}
            setMontoManualTercero={setMontoManualTercero}
            formatCurrency={formatCurrency}
          />

          {/* NAVEGACIÓN ENTRE PESTAÑAS PRINCIPALES */}
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 flex-wrap">
            <button
              type="button"
              onClick={() => setTabActiva('facturas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tabActiva === 'facturas'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
              }`}
            >
              <FileText size={15} />
              <span>Facturas Emitidas ({todasLasFacturasMes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('tickets')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tabActiva === 'tickets'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
              }`}
            >
              <List size={15} />
              <span>Cortes y Tickets POS ({ticketsMes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('comparativos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tabActiva === 'comparativos'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
              }`}
            >
              <Scale size={15} />
              <span>Comparativos y Arqueo</span>
              {controlEfectivo.faltaPorDepositar > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[9px] bg-amber-400 text-gray-900 font-bold">
                  ⚠️ Falta depositar
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('depositos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tabActiva === 'depositos'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
              }`}
            >
              <Building2 size={15} />
              <span>Depósitos Bancarios ({depositosMes.length})</span>
            </button>
          </div>

          {/* CONTENEDOR PRINCIPAL SEGÚN PESTAÑA */}
          {tabActiva === 'facturas' ? (
            <FacturasEmitidasTab
              displayedFacturas={displayedFacturas}
              todasLasFacturasMes={todasLasFacturasMes}
              facturasTercerosMes={facturasTercerosMes}
              facturasPgMes={facturasPgMes}
              totalFacturadoMes={totalFacturadoMes}
              filtroFacturasTipo={filtroFacturasTipo}
              setFiltroFacturasTipo={setFiltroFacturasTipo}
              searchFacturasQuery={searchFacturasQuery}
              setSearchFacturasQuery={setSearchFacturasQuery}
              handleDownloadFile={handleDownloadFile}
              formatCurrency={formatCurrency}
              loading={loading}
            />
          ) : tabActiva === 'tickets' ? (
            <TicketsPosTab
              displayedTickets={displayedTickets}
              ticketsMes={ticketsMes}
              cuentasBancarias={cuentasBancarias}
              selectedCuentaId={selectedCuentaId}
              setSelectedCuentaId={setSelectedCuentaId}
              filtroTipo={filtroTipo}
              setFiltroTipo={setFiltroTipo}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              facturadosTerceros={facturadosTerceros}
              toggleFacturadoTercero={toggleFacturadoTercero}
              formatCurrency={formatCurrency}
              loading={loading}
            />
          ) : tabActiva === 'comparativos' ? (
            <ComparativosTab
              subTabComparativo={subTabComparativo}
              setSubTabComparativo={setSubTabComparativo}
              selectedMonth={selectedMonth}
              controlEfectivo={controlEfectivo}
              comparativoTarjetas={comparativoTarjetas}
              comparativoBbvaBanco={comparativoBbvaBanco}
              userCargasMes={userCargasMes}
              movimientosOtroMes={movimientosOtroMes}
              ticketsOtroMes={ticketsOtroMes}
              totalMontoExcluidoOtroMes={totalMontoExcluidoOtroMes}
              formatCurrency={formatCurrency}
              formatPeriodoCarga={formatPeriodoCarga}
              setAllExcludedMovements={setAllExcludedMovements}
              toggleExcludeMovement={toggleExcludeMovement}
              toggleExcludeComprobante={toggleExcludeComprobante}
              toggleProximoMesComp={toggleProximoMesComp}
              esMovimientoEfectivo={esMovimientoEfectivo}
            />
          ) : (
            <DepositosBancariosTab
              depositosMes={depositosMes}
              totalMontoDepositosMes={totalMontoDepositosMes}
              totalDepositosConTicketMes={totalDepositosConTicketMes}
              montoDepositosConTicketMes={montoDepositosConTicketMes}
              totalDepositosFacturadosMes={totalDepositosFacturadosMes}
              montoDepositosFacturadosMes={montoDepositosFacturadosMes}
              totalMontoExcluidoOtroMes={totalMontoExcluidoOtroMes}
              toggleExcludeMovement={toggleExcludeMovement}
              formatCurrency={formatCurrency}
              loading={loading}
            />
          )}

        </main>
      </div>
    </div>
  );
}
