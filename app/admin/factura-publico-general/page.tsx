'use client';

import React, { useEffect, useState } from 'react';
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
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

import { useFacturaPublicoGeneralData } from './_hooks/useFacturaPublicoGeneralData';
import { ChecklistCierreFiscal } from './_components/ChecklistCierreFiscal';
import { FacturasEmitidasTab } from './_components/tabs/FacturasEmitidasTab';
import { TicketsPosTab } from './_components/tabs/TicketsPosTab';
import { ComparativosTab } from './_components/tabs/ComparativosTab';
import { DepositosBancariosTab } from './_components/tabs/DepositosBancariosTab';
import { ResumenContableTab } from './_components/tabs/ResumenContableTab';
import { WizardConfiguracionGlobalModal } from './_components/WizardConfiguracionGlobalModal';

export const dynamic = 'force-dynamic';

export default function FacturaPublicoGeneralPage() {
  const router = useRouter();
  const { isDarkMode } = useThemeMode();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const {
    loading,
    isSeimenjo,
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
    // Auditoría de días laborables y calendario
    currentDiasNoLaborables,
    toggleDiaNoLaborable,
    setDiasNoLaborablesBulk,
    auditoriaDiasMes,
    // Totales oficiales Factura Global
    subtotalFacturaGlobal,
    ivaFacturaGlobal,
    totalConIvaFacturaGlobal,
    ivaFacturasTerceros,
    totalIvaTrasladadoPeriodo,
    // Datos y comprobantes
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
    depositosNoEsVentaExcluidos,
    depositosPendientesDeVincular,
    depositosVinculadosCuadrados,
    toggleNoEsVentaMovement,
    cashDepositPeriods,
    setCashDepositPeriod,
    vincularComprobante,
    desvincularComprobante,
    toggleManualOtherMonth,
    bolsaTotalVentasMes,
    depositosMesPasadoExcluidos,
    depositosNetosMes,
    ventasDiaSiguienteMes,
    setVentasDiaSiguienteMonto,
    diferenciaBolsaCierre,
    sugerenciaVentasFinDeMes,
    ticketsFinDeMesPendientes,
    montoTicketsFinDeMesPendientes,
    togglePendienteDeposito,
    ticketsPendientesDeposito,
    montoTicketsPendientesDeposito,
    ticketsBbvaSinDeposito,
    guardarAjustesPeriodo,
  } = useFacturaPublicoGeneralData();
  const esSeimenjo = isSeimenjo;

  useEffect(() => {
    if (esSeimenjo) router.replace('/admin/factura-publico-general/seimenjo');
  }, [esSeimenjo, router]);

  if (esSeimenjo) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600 dark:bg-gray-950 dark:text-gray-300">
        <p className="text-sm font-medium">Abriendo el módulo de pedidos y facturación Seimenjo…</p>
      </main>
    );
  }

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
                Cálculo de factura global: Efectivo + ParrotPay + Tarjetas BBVA (incluye tickets pendientes por depositar) − Terceros − Propinas.
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {esSeimenjo && (
                <button
                  type="button"
                  onClick={() => router.push('/admin/factura-publico-general/seimenjo')}
                  className="px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-gray-900 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-black text-xs transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <List size={15} /> Pedidos Seimenjo
                </button>
              )}
              {/* BOTÓN ASISTENTE CONFIGURACIÓN PASO A PASO */}
              <button
                type="button"
                onClick={() => setIsWizardOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-md hover:shadow-lg transform active:scale-95 cursor-pointer ring-2 ring-indigo-400/30"
                title="Abrir Asistente Interactivo de 7 Pasos para Factura Global"
              >
                <Sparkles size={16} className="text-yellow-300 animate-pulse" />
                <span>Iniciar Configuración</span>
                {auditoriaDiasMes.diasLaborablesSinTicket > 0 ? (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-gray-950 font-black flex items-center gap-1">
                    <AlertTriangle size={10} /> {auditoriaDiasMes.diasLaborablesSinTicket} falta(n)
                  </span>
                ) : (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-400 text-gray-950 font-black flex items-center gap-1">
                    <CheckCircle2 size={10} /> 100% OK
                  </span>
                )}
              </button>

              {esSeimenjo && <button
                type="button"
                onClick={() => setTabActiva('cierre')}
                className="px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-gray-900 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-black text-xs transition-colors flex items-center gap-2 cursor-pointer"
                title="Abrir el cierre contable del período"
              >
                <FileText size={15} /> Cierre contable
              </button>}

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

          {tabActiva !== 'cierre' && <ChecklistCierreFiscal
            totalTickets={ticketsMes.length}
            totalTercerosDeducibles={totalTercerosDeducibles}
            totalTarjetasBbva={comparativoTarjetas.totalTarjetasBbva}
            diferenciaTarjetas={comparativoTarjetas.diferenciaTarjetas}
            faltaPorDepositar={controlEfectivo.faltaPorDepositar}
            totalFacturaPublicoGeneral={totalFacturaPublicoGeneral}
            formatCurrency={formatCurrency}
            selectedMonth={selectedMonth}
            onOpenWizard={() => setIsWizardOpen(true)}
            diasLaborablesSinTicket={auditoriaDiasMes.diasLaborablesSinTicket}
            totalLabel="Total cobrado con IVA incluido para Factura Global:"
          />}

          {/* NAVEGACIÓN ENTRE PESTAÑAS PRINCIPALES */}
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 flex-wrap">
            {esSeimenjo && <button
              type="button"
              onClick={() => setTabActiva('cierre')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                tabActiva === 'cierre'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
              }`}
            >
              <Scale size={15} />
              <span>Cierre contable</span>
            </button>}

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
          {tabActiva === 'cierre' ? (
            <ResumenContableTab
              selectedMonth={selectedMonth}
              formatCurrency={formatCurrency}
              totalEfectivoParrot={totalEfectivoParrot}
              totalParrotPayParrot={totalParrotPayParrot}
              totalTarjetasBbva={comparativoTarjetas.totalTarjetasBbva}
              totalTercerosDeducibles={totalTercerosDeducibles}
              manualTercerosVal={manualTercerosVal}
              currentMonthKey={currentMonthKey}
              setMontoManualTercero={setMontoManualTercero}
              totalPropinasExcluidas={totalPropinasExcluidas}
              subtotalFacturaGlobal={subtotalFacturaGlobal}
              ivaFacturaGlobal={ivaFacturaGlobal}
              totalConIvaFacturaGlobal={totalConIvaFacturaGlobal}
              ivaFacturasTerceros={ivaFacturasTerceros}
              totalIvaTrasladadoPeriodo={totalIvaTrasladadoPeriodo}
              totalFacturaPublicoGeneral={totalFacturaPublicoGeneral}
              facturasTercerosMes={facturasTercerosMes}
              auditoriaDiasMes={auditoriaDiasMes}
              controlEfectivo={controlEfectivo}
              diferenciaTarjetas={comparativoTarjetas.diferenciaTarjetas}
              depositosPendientesDeVincular={depositosPendientesDeVincular}
              ticketsPendientesDeposito={ticketsPendientesDeposito}
              montoTicketsPendientesDeposito={montoTicketsPendientesDeposito}
              onOpenTab={setTabActiva}
              onOpenComparativo={setSubTabComparativo}
              onExport={exportFacturaPublicoExcel}
            />
          ) : tabActiva === 'facturas' ? (
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
              bolsaTotalVentasMes={bolsaTotalVentasMes}
              totalEfectivoParrot={totalEfectivoParrot}
              totalParrotPayParrot={totalParrotPayParrot}
              totalMontoDepositosMes={totalMontoDepositosMes}
              depositosNetosMes={depositosNetosMes}
              ventasDiaSiguienteMes={ventasDiaSiguienteMes}
              setVentasDiaSiguienteMonto={setVentasDiaSiguienteMonto}
              diferenciaBolsaCierre={diferenciaBolsaCierre}
              depositosMes={depositosMes}
              depositosNoEsVentaExcluidos={depositosNoEsVentaExcluidos}
              depositosPendientesDeVincular={depositosPendientesDeVincular}
              depositosVinculadosCuadrados={depositosVinculadosCuadrados}
              toggleNoEsVentaMovement={toggleNoEsVentaMovement}
              cashDepositPeriods={cashDepositPeriods}
              setCashDepositPeriod={setCashDepositPeriod}
              vincularComprobante={vincularComprobante}
              desvincularComprobante={desvincularComprobante}
              ticketsFinDeMesPendientes={ticketsFinDeMesPendientes}
              montoTicketsFinDeMesPendientes={montoTicketsFinDeMesPendientes}
              ticketsMes={ticketsMes}
              togglePendienteDeposito={togglePendienteDeposito}
              ticketsPendientesDeposito={ticketsPendientesDeposito}
              montoTicketsPendientesDeposito={montoTicketsPendientesDeposito}
              ticketsBbvaSinDeposito={ticketsBbvaSinDeposito}
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

      {/* ASISTENTE MODAL CONFIGURACIÓN PASO A PASO (7 PASOS) */}
      <WizardConfiguracionGlobalModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        selectedMonth={selectedMonth}
        formatCurrency={formatCurrency}
        currentDiasNoLaborables={currentDiasNoLaborables}
        toggleDiaNoLaborable={toggleDiaNoLaborable}
        setDiasNoLaborablesBulk={setDiasNoLaborablesBulk}
        auditoriaDiasMes={auditoriaDiasMes}
        ticketsMes={ticketsMes}
        ticketsOtroMes={ticketsOtroMes}
        depositosMes={depositosMes}
        movimientosOtroMes={movimientosOtroMes}
        toggleExcludeMovement={toggleExcludeMovement}
        toggleManualOtherMonth={toggleManualOtherMonth}
        bolsaTotalVentasMes={bolsaTotalVentasMes}
        depositosMesPasadoExcluidos={depositosMesPasadoExcluidos}
        depositosNoEsVentaExcluidos={depositosNoEsVentaExcluidos}
        depositosNetosMes={depositosNetosMes}
        depositosPendientesDeVincular={depositosPendientesDeVincular}
        depositosVinculadosCuadrados={depositosVinculadosCuadrados}
        toggleNoEsVentaMovement={toggleNoEsVentaMovement}
        vincularComprobante={vincularComprobante}
        desvincularComprobante={desvincularComprobante}
        ventasDiaSiguienteMes={ventasDiaSiguienteMes}
        setVentasDiaSiguienteMonto={setVentasDiaSiguienteMonto}
        diferenciaBolsaCierre={diferenciaBolsaCierre}
        sugerenciaVentasFinDeMes={sugerenciaVentasFinDeMes}
        ticketsFinDeMesPendientes={ticketsFinDeMesPendientes}
        montoTicketsFinDeMesPendientes={montoTicketsFinDeMesPendientes}
        togglePendienteDeposito={togglePendienteDeposito}
        ticketsPendientesDeposito={ticketsPendientesDeposito}
        montoTicketsPendientesDeposito={montoTicketsPendientesDeposito}
        facturasTercerosMes={facturasTercerosMes}
        totalTercerosDeducibles={totalTercerosDeducibles}
        totalEfectivoParrot={totalEfectivoParrot}
        totalParrotPayParrot={totalParrotPayParrot}
        comparativoTarjetas={comparativoTarjetas}
        totalPropinasExcluidas={totalPropinasExcluidas}
        controlEfectivo={controlEfectivo}
        totalMontoDepositosMes={totalMontoDepositosMes}
        totalFacturaPublicoGeneral={totalFacturaPublicoGeneral}
        subtotalFacturaGlobal={subtotalFacturaGlobal}
        ivaFacturaGlobal={ivaFacturaGlobal}
        totalConIvaFacturaGlobal={totalConIvaFacturaGlobal}
        ivaFacturasTerceros={ivaFacturasTerceros}
        totalIvaTrasladadoPeriodo={totalIvaTrasladadoPeriodo}
        isSeimenjo={isSeimenjo}
        exportFacturaPublicoExcel={exportFacturaPublicoExcel}
        refreshPeriodStatus={refreshPeriodStatus}
        guardarAjustesPeriodo={guardarAjustesPeriodo}
        ticketsBbvaSinDeposito={ticketsBbvaSinDeposito}
      />
    </div>
  );
}

