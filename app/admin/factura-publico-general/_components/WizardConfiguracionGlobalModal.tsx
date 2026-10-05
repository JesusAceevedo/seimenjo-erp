'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  UserCheck,
  CreditCard,
  Building2,
  Landmark,
  Scale,
  Sparkles,
  FileSpreadsheet,
  Clock,
  ExternalLink,
  HelpCircle,
  FileText,
  DollarSign,
  AlertCircle,
  Search,
  ArrowDownRight,
  RotateCcw,
  TrendingDown,
  Target,
  ArrowRightLeft,
  Link2,
  Unlink,
  ChevronDown,
  Ban,
  ShieldAlert,
  ListFilter,
  Check,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface WizardConfiguracionGlobalModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  formatCurrency: (val: number | string | null | undefined) => string;
  currentDiasNoLaborables: string[];
  toggleDiaNoLaborable: (dateStr: string) => void;
  setDiasNoLaborablesBulk: (dates: string[]) => void;
  auditoriaDiasMes: {
    dias: Array<{
      dateStr: string;
      dayNum: number;
      dayName: string;
      dayOfWeek: number;
      esNoLaborable: boolean;
      tieneTicket: boolean;
      esFaltante: boolean;
      tickets: any[];
      totalVentaDia: number;
    }>;
    totalDiasMes: number;
    totalDiasLaborables: number;
    totalDiasNoLaborables: number;
    diasConTicket: number;
    diasLaborablesSinTicket: number;
    listaFaltantes: string[];
    porcentajeCumplimiento: number;
  };
  ticketsMes: any[];
  ticketsOtroMes: any[];
  depositosMes?: any[];
  movimientosOtroMes?: any[];
  toggleExcludeMovement?: (id: string) => void;
  toggleManualOtherMonth?: (id: string) => void;
  bolsaTotalVentasMes?: number;
  depositosMesPasadoExcluidos?: number;
  depositosNoEsVentaExcluidos?: number;
  depositosNetosMes?: number;
  depositosPendientesDeVincular?: number;
  depositosVinculadosCuadrados?: number;
  toggleNoEsVentaMovement?: any;
  vincularComprobante?: (comprobanteId: string, movimientoBancarioId: any, montoAsociado?: number) => Promise<any>;
  desvincularComprobante?: (comprobanteId: string, movimientoBancarioId?: any) => Promise<any>;
  ventasDiaSiguienteMes?: number;
  setVentasDiaSiguienteMonto?: (monto: number) => void;
  diferenciaBolsaCierre?: number;
  sugerenciaVentasFinDeMes?: number;
  ticketsFinDeMesPendientes?: any[];
  montoTicketsFinDeMesPendientes?: number;
  togglePendienteDeposito?: (compId: string) => void;
  ticketsPendientesDeposito?: any[];
  montoTicketsPendientesDeposito?: number;
  facturasTercerosMes: any[];
  totalTercerosDeducibles: number;
  totalEfectivoParrot: number;
  totalParrotPayParrot: number;
  comparativoTarjetas: any;
  totalPropinasExcluidas: number;
  controlEfectivo: any;
  totalMontoDepositosMes: number;
  totalFacturaPublicoGeneral: number;
  subtotalFacturaGlobal: number;
  ivaFacturaGlobal: number;
  totalConIvaFacturaGlobal: number;
  ivaFacturasTerceros: number;
  totalIvaTrasladadoPeriodo: number;
  isSeimenjo: boolean;
  exportFacturaPublicoExcel: () => void;
  refreshPeriodStatus: () => void;
  guardarAjustesPeriodo?: () => Promise<{ success: boolean; error?: any }>;
  ticketsBbvaSinDeposito?: any[];
}

export const WizardConfiguracionGlobalModal: React.FC<WizardConfiguracionGlobalModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  formatCurrency,
  currentDiasNoLaborables,
  toggleDiaNoLaborable,
  setDiasNoLaborablesBulk,
  auditoriaDiasMes,
  ticketsMes,
  ticketsOtroMes,
  depositosMes = [],
  movimientosOtroMes = [],
  toggleExcludeMovement,
  toggleManualOtherMonth,
  bolsaTotalVentasMes = 0,
  depositosMesPasadoExcluidos = 0,
  depositosNoEsVentaExcluidos = 0,
  depositosNetosMes = 0,
  depositosPendientesDeVincular = 0,
  depositosVinculadosCuadrados = 0,
  toggleNoEsVentaMovement,
  vincularComprobante,
  desvincularComprobante,
  ventasDiaSiguienteMes = 0,
  setVentasDiaSiguienteMonto,
  diferenciaBolsaCierre = 0,
  sugerenciaVentasFinDeMes = 0,
  ticketsFinDeMesPendientes = [],
  montoTicketsFinDeMesPendientes = 0,
  togglePendienteDeposito,
  ticketsPendientesDeposito = [],
  montoTicketsPendientesDeposito = 0,
  facturasTercerosMes,
  totalTercerosDeducibles,
  totalEfectivoParrot,
  totalParrotPayParrot,
  comparativoTarjetas,
  totalPropinasExcluidas,
  controlEfectivo,
  totalMontoDepositosMes,
  totalFacturaPublicoGeneral,
  subtotalFacturaGlobal,
  ivaFacturaGlobal,
  totalConIvaFacturaGlobal,
  ivaFacturasTerceros,
  totalIvaTrasladadoPeriodo,
  isSeimenjo,
  exportFacturaPublicoExcel,
  refreshPeriodStatus,
  guardarAjustesPeriodo,
  ticketsBbvaSinDeposito = []
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSavingFinal, setIsSavingFinal] = useState(false);
  const totalSteps = 7;

  // Estados locales para la conciliación de la Bolsa y Desfase en Paso 3
  const [vistaStep3, setVistaStep3] = useState<'depositos' | 'tickets'>('depositos');
  const [searchDeposito, setSearchDeposito] = useState('');
  const [filtroDeposito, setFiltroDeposito] = useState<
    'todos' | 'mes_actual' | 'mes_pasado' | 'no_es_venta' | 'cuadrados_ticket' | 'pendientes_vincular'
  >('todos');
  const [searchTicket, setSearchTicket] = useState('');
  const [filtroTicket, setFiltroTicket] = useState<'todos' | 'cuadrados' | 'parciales' | 'sin_vincular' | 'pendiente_deposito'>('todos');
  const [openNoEsVentaId, setOpenNoEsVentaId] = useState<string | null>(null);
  const [mostrarDetalleTicketsFinDeMes, setMostrarDetalleTicketsFinDeMes] = useState(false);

  // Estados del Modal de Vinculación Ticket-Centrista (idéntico a BancoTab)
  const [activeCompToLink, setActiveCompToLink] = useState<any | null>(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkDateFrom, setLinkDateFrom] = useState('');
  const [linkDateTo, setLinkDateTo] = useState('');
  const [selectedLinkMovIds, setSelectedLinkMovIds] = useState<Set<string>>(new Set());
  const [linkingBatch, setLinkingBatch] = useState(false);

  const [inputDiaSiguiente, setInputDiaSiguiente] = useState<string>(
    ventasDiaSiguienteMes > 0 ? String(ventasDiaSiguienteMes) : ''
  );

  React.useEffect(() => {
    setInputDiaSiguiente(ventasDiaSiguienteMes > 0 ? String(ventasDiaSiguienteMes) : '');
  }, [ventasDiaSiguienteMes]);

  const filteredDepositos = useMemo(() => {
    return (depositosMes || []).filter(d => {
      const isExcl = !!d._isExcluded || !!d._isOtherMonth;
      const isNoVenta = !!d._isNoVenta;
      const isCuadrado = !!d._vinculadoCuadrado100;
      const isPendiente = !isCuadrado && !isExcl && !isNoVenta;

      if (filtroDeposito === 'mes_pasado' && !isExcl) return false;
      if (filtroDeposito === 'no_es_venta' && !isNoVenta) return false;
      if (filtroDeposito === 'mes_actual' && (isExcl || isNoVenta)) return false;
      if (filtroDeposito === 'cuadrados_ticket' && !isCuadrado) return false;
      if (filtroDeposito === 'pendientes_vincular' && !isPendiente) return false;

      if (searchDeposito) {
        const q = searchDeposito.toLowerCase();
        const concepto = (d.concepto || '').toLowerCase();
        const fecha = (d.fecha || '').toLowerCase();
        const monto = String(d._monto || '');
        const ticketDesc = (d._ticketAsociado?.descripcion || '').toLowerCase();
        if (!concepto.includes(q) && !fecha.includes(q) && !monto.includes(q) && !ticketDesc.includes(q)) return false;
      }
      return true;
    });
  }, [depositosMes, filtroDeposito, searchDeposito]);

  const filteredTickets = useMemo(() => {
    return (ticketsMes || []).filter(t => {
      const isCuadrado = !!t._isCuadrado100;
      const isParcial = !!t._isParcial;
      const isPendienteDep = !!t._isPendienteDeposito;
      const isSinVincular = !isCuadrado && !isParcial && !isPendienteDep;

      if (filtroTicket === 'cuadrados' && !isCuadrado) return false;
      if (filtroTicket === 'parciales' && !isParcial) return false;
      if (filtroTicket === 'sin_vincular' && !isSinVincular) return false;
      if (filtroTicket === 'pendiente_deposito' && !isPendienteDep) return false;

      if (searchTicket) {
        const q = searchTicket.toLowerCase();
        const desc = (t.descripcion || '').toLowerCase();
        const fecha = (t.fecha || '').toLowerCase();
        const monto = String(t.monto || '');
        if (!desc.includes(q) && !fecha.includes(q) && !monto.includes(q)) return false;
      }
      return true;
    });
  }, [ticketsMes, filtroTicket, searchTicket]);

  if (!isOpen) return null;

  const stepsInfo = [
    { num: 1, title: 'Días No Laborables', subtitle: 'Descansos / Cierres', icon: Calendar },
    { num: 2, title: 'Auditoría Tickets', subtitle: 'Verificar Días Trabajados', icon: Receipt },
    { num: 3, title: 'Desfase Meses', subtitle: 'Ventas Previas vs. Siguientes', icon: Clock },
    { num: 4, title: 'Facturas a Terceros', subtitle: 'Deducción de Clientes', icon: UserCheck },
    { num: 5, title: 'Parrot vs. BBVA', subtitle: 'Efectivo + Propinas', icon: CreditCard },
    { num: 6, title: 'Estados de Cuenta', subtitle: 'Contraste Milimétrico', icon: Landmark },
    { num: 7, title: 'Resultado Final', subtitle: 'Factura Global e IVA', icon: Sparkles }
  ];

  // Helper para marcar días fijos de la semana como descanso (ej. todos los martes)
  const handleBulkWeekdays = (dayOfWeekTarget: number) => {
    const dates = auditoriaDiasMes.dias
      .filter(d => d.dayOfWeek === dayOfWeekTarget)
      .map(d => d.dateStr);

    // Si ya todos están marcados, desmarcarlos; de lo contrario, marcarlos todos
    const allAlreadyMarked = dates.every(dt => currentDiasNoLaborables.includes(dt));
    let next: string[];
    if (allAlreadyMarked) {
      next = currentDiasNoLaborables.filter(dt => !dates.includes(dt));
    } else {
      next = Array.from(new Set([...currentDiasNoLaborables, ...dates]));
    }
    setDiasNoLaborablesBulk(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-2 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl w-full h-[98vh] max-w-[99vw] shadow-2xl flex flex-col overflow-hidden font-sans">
        
        {/* CABECERA DEL ASISTENTE */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20">
              <Sparkles size={22} className="text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full text-emerald-100">
                  Flujo Consecuente • Período {selectedMonth || 'Actual'}
                </span>
                <span className="text-[10px] font-bold text-emerald-200">
                  Paso {currentStep} de {totalSteps}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold tracking-tight mt-0.5">
                Asistente de Configuración y Cierre de Factura Global
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportFacturaPublicoExcel}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all border border-white/20"
              title="Descargar cálculo en Excel"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
              title="Cerrar Asistente"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* STEPPER DE NAVEGACIÓN SUPERIOR */}
        <div className="bg-gray-50/80 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800 p-2 sm:p-3 overflow-x-auto shrink-0 flex items-center gap-1 sm:gap-2">
          {stepsInfo.map(step => {
            const Icon = step.icon;
            const isActive = currentStep === step.num;
            const isDone = currentStep > step.num;

            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setCurrentStep(step.num)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                    : isDone
                    ? 'bg-emerald-100 dark:bg-emerald-955/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/50'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-800'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  isActive ? 'bg-white text-emerald-700' : isDone ? 'bg-emerald-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {isDone ? '✓' : step.num}
                </div>
                <div className="text-left hidden md:block">
                  <div className="text-[11px] leading-tight font-extrabold">{step.title}</div>
                  <div className={`text-[9px] font-normal ${isActive ? 'text-emerald-100' : 'text-gray-400'}`}>{step.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* CUERPO PRINCIPAL DEL PASO ACTIVO */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ════════════════════════════════════════════════════════════════════════
              PASO 1: DÍAS NO LABORABLES DEL MES (DESCANSO / CIERRE)
          ════════════════════════════════════════════════════════════════════════ */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                <div>
                  <h4 className="text-sm font-black text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <Calendar size={18} className="text-amber-500" /> Paso 1: Configurar Días No Trabajados en el Mes
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-2xl leading-relaxed">
                    Haz clic sobre los días en los que el establecimiento estuvo <strong>cerrado o no laboró</strong> (días de descanso, festivos, remodelación). Para estos días <strong>no se exigirán tickets</strong> en la auditoría fiscal.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleBulkWeekdays(2)} // 2 = Martes
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 shadow-2xs"
                  >
                    Marcar/Desmarcar Martes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkWeekdays(1)} // 1 = Lunes
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 shadow-2xs"
                  >
                    Marcar/Desmarcar Lunes
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiasNoLaborablesBulk([])}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-955/20 border border-red-200 dark:border-red-900/40 shadow-2xs"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Calendario visual del mes */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
                <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((dia, idx) => (
                    <span key={idx} className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                      {dia}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2 font-mono">
                  {/* Espacio inicial para alinear con el día de la semana */}
                  {Array.from({ length: auditoriaDiasMes.dias[0]?.dayOfWeek || 0 }).map((_, i) => (
                    <div key={`empty-${i}`} className="p-3 rounded-xl bg-gray-50/50 dark:bg-gray-950/30 opacity-40 border border-dashed border-gray-200 dark:border-gray-800" />
                  ))}

                  {auditoriaDiasMes.dias.map(d => {
                    const isNoLab = d.esNoLaborable;

                    return (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => toggleDiaNoLaborable(d.dateStr)}
                        className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer min-h-[75px] ${
                          isNoLab
                            ? 'bg-amber-100/70 dark:bg-amber-955/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-2xs'
                            : 'bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 hover:border-emerald-400 text-gray-800 dark:text-gray-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="text-sm font-extrabold">{d.dayNum}</span>
                          <span className={`text-[8.5px] font-black uppercase px-1 py-0.2 rounded ${
                            isNoLab ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-955/40 text-emerald-700 dark:text-emerald-300'
                          }`}>
                            {isNoLab ? 'Cerrado' : 'Abierto'}
                          </span>
                        </div>
                        <div className="mt-1 text-[9px] font-sans">
                          {isNoLab ? (
                            <span className="text-amber-700 dark:text-amber-400 font-bold">🚫 Descanso</span>
                          ) : (
                            <span className={d.tieneTicket ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 italic'}>
                              {d.tieneTicket ? `${d.tickets.length} ticket/corte` : 'Laborable'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resumen del paso 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Total Días del Mes</span>
                  <span className="text-lg font-black text-gray-900 dark:text-white font-mono mt-0.5 block">{auditoriaDiasMes.totalDiasMes} días</span>
                </div>
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-955/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">Días Laborables</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5 block">{auditoriaDiasMes.totalDiasLaborables} días</span>
                </div>
                <div className="p-3 bg-amber-50/50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block">Días Descanso / Cerrado</span>
                  <span className="text-lg font-black text-amber-700 dark:text-amber-300 font-mono mt-0.5 block">{auditoriaDiasMes.totalDiasNoLaborables} días</span>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PASO 2: AUDITORÍA DE TICKETS EN DÍAS LABORABLES
          ════════════════════════════════════════════════════════════════════════ */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex items-start gap-3">
                <Receipt className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-sm font-black text-blue-900 dark:text-blue-100">
                    Paso 2: Validación de Captura de Tickets de Días Laborables
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                    Comprobamos si todos los días que se marcaron como <strong>laborables</strong> cuentan con su corte/ticket capturado en el sistema.
                  </p>
                </div>
              </div>

              {/* Alerta de días faltantes */}
              {auditoriaDiasMes.diasLaborablesSinTicket > 0 ? (
                <div className="p-4 bg-red-500/10 border-2 border-red-500/30 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="text-red-500 shrink-0 mt-0.5 animate-bounce" size={22} />
                  <div className="flex-1">
                    <h5 className="text-xs font-black uppercase text-red-700 dark:text-red-300">
                      ⚠️ Advertencia: Se detectaron {auditoriaDiasMes.diasLaborablesSinTicket} día(s) laborable(s) sin ticket registrado
                    </h5>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Los siguientes días fueron marcados como trabajados pero no tienen corte o ticket capturado:
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {auditoriaDiasMes.listaFaltantes.map(fDate => (
                        <span key={fDate} className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-red-100 text-red-800 dark:bg-red-955 dark:text-red-300 border border-red-300 dark:border-red-800">
                          {new Date(fDate + 'T12:00:00Z').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'UTC' })}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => router.push('/admin/ventas?tab=tickets')}
                        className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-sm inline-flex items-center gap-1.5 transition-all"
                      >
                        <ExternalLink size={13} /> Ir a Ventas / Captura de Tickets ↗
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="px-3 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-300 transition-all"
                      >
                        ← Corregir días de descanso en el Paso 1
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                  <div>
                    <h5 className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-200">
                      ✓ Captura de Tickets al 100% Completa
                    </h5>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      Todos los {auditoriaDiasMes.totalDiasLaborables} días laborables del mes tienen al menos un corte o ticket registrado correctamente.
                    </p>
                  </div>
                </div>
              )}

              {/* Lista compacta de desglose diario */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-3 bg-gray-50/70 dark:bg-gray-950/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs">
                  <span className="font-extrabold text-gray-700 dark:text-gray-300 uppercase">Detalle Día por Día</span>
                  <span className="font-mono text-gray-500">{auditoriaDiasMes.diasConTicket} de {auditoriaDiasMes.totalDiasLaborables} laborables cubiertos ({auditoriaDiasMes.porcentajeCumplimiento}%)</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 font-mono text-xs">
                  {auditoriaDiasMes.dias.map(d => (
                    <div key={d.dateStr} className={`p-2.5 flex items-center justify-between transition-all ${
                      d.esFaltante ? 'bg-red-50/60 dark:bg-red-955/20 border-l-4 border-l-red-500' : d.esNoLaborable ? 'bg-gray-50/40 dark:bg-gray-900/20 text-gray-400' : ''
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold w-24">{d.dateStr} ({d.dayName})</span>
                        {d.esNoLaborable ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400">Descanso</span>
                        ) : d.tieneTicket ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 dark:bg-emerald-955/40 text-emerald-700 dark:text-emerald-300">
                            {d.tickets.length} Ticket(s) ✓
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-100 dark:bg-red-955/40 text-red-700 dark:text-red-300">
                            Sin Ticket ⚠️
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        {d.tieneTicket ? (
                          <span className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(d.totalVentaDia)}</span>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">-</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PASO 3: DESFASE DE MESES & CONCILIACIÓN DE BOLSA BANCARIA
          ════════════════════════════════════════════════════════════════════════ */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* CABECERA EXPLICATIVA */}
              <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl flex items-start gap-3">
                <Clock className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={22} />
                <div>
                  <h4 className="text-sm font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
                    Paso 3: Conciliación de Bolsa de Ventas vs. Depósitos Bancarios y Desfase
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                    Compara la <strong>bolsa total de ventas registradas</strong> (efectivo, tarjetas y ParrotPay) contra los <strong>depósitos del estado de cuenta</strong>. Marca qué depósitos corresponden a ventas de meses previos para restarlos de la bolsa, y registra las ventas que el banco acreditó al día siguiente del cierre para alcanzar el <strong>cuadre perfecto en ceros ($0.00)</strong>.
                  </p>
                </div>
              </div>

              {/* 1. LAS 3 VÍAS DE VENTA DEL MES Y LA GRAN BOLSA TOTAL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
                {/* 1.1 Efectivo */}
                <div className="p-3.5 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 font-sans">
                      💵 1. Venta Efectivo
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-955 text-emerald-700 dark:text-emerald-300 font-sans">
                      POS
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {formatCurrency(totalEfectivoParrot)}
                  </div>
                  <span className="text-[10px] text-gray-400 font-sans block mt-0.5">
                    Cobrado en caja / mostrador
                  </span>
                </div>

                {/* 1.2 Tarjeta */}
                <div className="p-3.5 bg-white dark:bg-gray-900 border border-sky-200 dark:border-sky-800/60 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 font-sans">
                      💳 2. Venta Tarjeta
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-955 text-sky-700 dark:text-sky-300 font-sans">
                      BBVA
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-sky-700 dark:text-sky-300 mt-1">
                    {formatCurrency(comparativoTarjetas.totalTarjetasBbva)}
                  </div>
                  <span className="text-[10px] text-gray-400 font-sans block mt-0.5">
                    Terminales bancarias BBVA
                  </span>
                </div>

                {/* 1.3 ParrotPay */}
                <div className="p-3.5 bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800/60 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 font-sans">
                      🦜 3. Venta ParrotPay
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-955 text-purple-700 dark:text-purple-300 font-sans">
                      Digital
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
                    {formatCurrency(totalParrotPayParrot)}
                  </div>
                  <span className="text-[10px] text-gray-400 font-sans block mt-0.5">
                    Cobros app ParrotPay
                  </span>
                </div>

                {/* 1.4 BOLSA TOTAL DE VENTAS */}
                <div className="p-3.5 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl shadow-md flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100 font-sans flex items-center gap-1">
                        <Target size={12} /> BOLSA TOTAL VENTAS
                      </span>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-white/20 text-white font-sans">
                        100% Meta
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white mt-1">
                      {formatCurrency(bolsaTotalVentasMes)}
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-100 font-sans mt-0.5 block">
                    Total base a contrastar con banco
                  </span>
                </div>
              </div>

              {/* 2. VISOR DINÁMICO DE CONCILIACIÓN DE LA BOLSA HACIA CEROS */}
              <div className="p-4 sm:p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Scale size={16} className="text-emerald-500" />
                      Balance Dinámico: Restando Desfases hasta llegar a Ceros ($0.00)
                    </h5>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Conforme marcas depósitos que son del mes pasado o registras las ventas que el banco acreditó al día siguiente, el balance resta automáticamente.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Diferencia Residual</span>
                    <span className={`text-xl font-black font-mono ${
                      Math.abs(diferenciaBolsaCierre) <= 1
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : diferenciaBolsaCierre > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-sky-600 dark:text-sky-400'
                    }`}>
                      {formatCurrency(diferenciaBolsaCierre)}
                    </span>
                  </div>
                </div>

                {/* Cascada de resta visual */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
                  {/* Bolsa Inicial */}
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/80">
                    <span className="text-[10px] font-sans font-bold text-gray-400 uppercase block">1. Bolsa Ventas POS</span>
                    <span className="text-base font-black text-gray-900 dark:text-white mt-1 block">
                      +{formatCurrency(bolsaTotalVentasMes)}
                    </span>
                    <span className="text-[9.5px] font-sans text-gray-500 mt-0.5 block">Ventas registradas</span>
                  </div>

                  {/* Depósitos Mes Actual (Netos) */}
                  <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-955/20 border border-sky-200 dark:border-sky-800/50">
                    <span className="text-[10px] font-sans font-bold text-sky-600 dark:text-sky-400 uppercase block">2. (-) Depósitos Este Mes</span>
                    <span className="text-base font-black text-sky-700 dark:text-sky-300 mt-1 block">
                      -{formatCurrency(depositosNetosMes)}
                    </span>
                    <span className="text-[9.5px] font-sans text-gray-500 mt-0.5 block">
                      Banco ({formatCurrency(totalMontoDepositosMes)}) menos mes anterior (-{formatCurrency(depositosMesPasadoExcluidos)})
                    </span>
                  </div>

                  {/* Ventas Ingresadas al Día Siguiente */}
                  <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-955/20 border border-purple-200 dark:border-purple-800/50">
                    <span className="text-[10px] font-sans font-bold text-purple-600 dark:text-purple-400 uppercase block">3. (-) Ventas Día Siguiente</span>
                    <span className="text-base font-black text-purple-700 dark:text-purple-300 mt-1 block">
                      -{formatCurrency(ventasDiaSiguienteMes)}
                    </span>
                    <span className="text-[9.5px] font-sans text-gray-500 mt-0.5 block">Acreditadas post-cierre</span>
                  </div>

                  {/* Estado del Balance */}
                  <div className={`p-3 rounded-xl border flex flex-col justify-between ${
                    Math.abs(diferenciaBolsaCierre) <= 1
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
                      : diferenciaBolsaCierre > 0
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200'
                      : 'bg-blue-500/15 border-blue-500/40 text-blue-900 dark:text-blue-200'
                  }`}>
                    <div>
                      <span className="text-[10px] font-sans font-black uppercase block">4. Resultado Cuadre</span>
                      <span className="text-base font-black mt-1 block font-mono">
                        {Math.abs(diferenciaBolsaCierre) <= 1 ? '$0.00 (Cuadrado)' : formatCurrency(diferenciaBolsaCierre)}
                      </span>
                    </div>
                    <span className="text-[9.5px] font-sans font-bold mt-1 block">
                      {Math.abs(diferenciaBolsaCierre) <= 1
                        ? '✓ En Ceros Perfecto'
                        : diferenciaBolsaCierre > 0
                        ? '⚠️ Falta por justificar'
                        : 'ℹ️ Sobrante en banco'}
                    </span>
                  </div>
                </div>

                {/* Banner de Estado Final de la Bolsa */}
                {Math.abs(diferenciaBolsaCierre) <= 1 ? (
                  <div className="p-3.5 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-2xl flex items-center gap-3 text-emerald-900 dark:text-emerald-100">
                    <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider block">
                        ✅ ¡CUADRE PERFECTO EN CEROS ALCANZADO ($0.00)!
                      </span>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-200 mt-0.5">
                        La bolsa de ventas total está 100% justificada entre los depósitos del mes y las ventas acreditadas al día siguiente. No hay dinero faltante ni duplicidades fiscales.
                      </p>
                    </div>
                  </div>
                ) : diferenciaBolsaCierre > 1 ? (
                  <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-900 dark:text-amber-100">
                    <AlertTriangle size={22} className="text-amber-500 shrink-0" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider block">
                        ⚠️ Diferencia restante por justificar: {formatCurrency(diferenciaBolsaCierre)}
                      </span>
                      <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-0.5">
                        Puedes marcar en la tabla inferior qué depósitos del banco corresponden al mes pasado para no duplicarlos, o registrar las ventas de fin de mes que el banco acreditó al día siguiente del cierre.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-blue-500/15 border border-blue-500/30 rounded-2xl flex items-center gap-3 text-blue-900 dark:text-blue-100">
                    <HelpCircle size={22} className="text-blue-500 shrink-0" />
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider block">
                        ℹ️ Depósitos bancarios superan la bolsa en: {formatCurrency(Math.abs(diferenciaBolsaCierre))}
                      </span>
                      <p className="text-[11px] text-blue-800 dark:text-blue-200 mt-0.5">
                        Es posible que haya más depósitos en el estado de cuenta que pertenezcan a meses previos (ej. cobranzas de meses pasados). Revísalos abajo y márcalos si corresponde.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. SECCIÓN: VENTAS DE CIERRE INGRESADAS AL DÍA SIGUIENTE (ARRASTRE FIN DE MES) */}
              <div className="p-4 bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800/60 rounded-3xl shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-955/60 text-purple-700 dark:text-purple-300">
                      <Clock size={16} />
                    </div>
                    <div>
                      <h5 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">
                        Ventas de Fin de Mes Acreditadas al Día Siguiente en el Banco
                      </h5>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        Ventas registradas en tickets al cierre del mes que el banco acreditó al día siguiente (ej. se depositaron $100 y el ticket de fin de mes fue de $10; la venta total fue $110).
                      </p>
                    </div>
                  </div>

                  {montoTicketsFinDeMesPendientes > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (setVentasDiaSiguienteMonto) {
                          setVentasDiaSiguienteMonto(montoTicketsFinDeMesPendientes);
                          setInputDiaSiguiente(String(montoTicketsFinDeMesPendientes));
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-955 dark:text-purple-300 text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-2xs"
                      title="Aplicar el monto exacto de los tickets de fin de mes aún no depositados"
                    >
                      <span>💡 Aplicar {ticketsFinDeMesPendientes.length} tickets fin de mes:</span>
                      <strong className="font-mono">{formatCurrency(montoTicketsFinDeMesPendientes)}</strong>
                    </button>
                  ) : sugerenciaVentasFinDeMes > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (setVentasDiaSiguienteMonto) {
                          setVentasDiaSiguienteMonto(sugerenciaVentasFinDeMes);
                          setInputDiaSiguiente(String(sugerenciaVentasFinDeMes));
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-955 dark:text-purple-300 text-[11px] font-bold transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                      title="Usar la venta registrada del último día como sugerencia de flotante"
                    >
                      <span>💡 Aplicar sugerencia fin de mes:</span>
                      <strong className="font-mono">{formatCurrency(sugerenciaVentasFinDeMes)}</strong>
                    </button>
                  ) : null}
                </div>

                {ticketsFinDeMesPendientes.length > 0 && (
                  <div className="p-2.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                        <Receipt size={13} className="text-purple-600" />
                        Detectados {ticketsFinDeMesPendientes.length} tickets de venta emitidos en el cierre aún no depositados en el banco
                      </span>
                      <div className="flex items-center gap-2">
                        {togglePendienteDeposito && (
                          <button
                            type="button"
                            onClick={() => {
                              ticketsFinDeMesPendientes.forEach(t => togglePendienteDeposito(t.id));
                            }}
                            className="px-2 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Marcar todos como Pendientes
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setMostrarDetalleTicketsFinDeMes(prev => !prev)}
                          className="text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
                        >
                          {mostrarDetalleTicketsFinDeMes ? 'Ocultar ▲' : 'Ver tickets ▼'}
                        </button>
                      </div>
                    </div>
                    {mostrarDetalleTicketsFinDeMes && (
                      <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pt-2 border-t border-purple-200/40 font-mono text-[11px]">
                        {ticketsFinDeMesPendientes.map(t => (
                          <div key={t.id} className="flex justify-between items-center py-1 px-2 rounded bg-white/60 dark:bg-gray-800/60">
                            <div>
                              <span className="font-bold text-gray-800 dark:text-gray-200">{t.fecha ? String(t.fecha).substring(0, 10) : ''}</span>
                              <span className="ml-2 text-gray-500 font-sans">{t.descripcion || 'Ticket POS'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-purple-700 dark:text-purple-300">{formatCurrency(t.monto)}</span>
                              {togglePendienteDeposito && (
                                <button
                                  type="button"
                                  onClick={() => togglePendienteDeposito(t.id)}
                                  className="px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] cursor-pointer"
                                >
                                  Marcar Pendiente
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Banner específico para Tickets de Tarjeta BBVA sin depósito al cierre */}
                {ticketsBbvaSinDeposito.length > 0 && (
                  <div className="p-3 rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 text-xs">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CreditCard size={15} className="text-sky-600 dark:text-sky-400" />
                        <span className="font-bold text-sky-900 dark:text-sky-200">
                          Tickets de Tarjeta BBVA sin depósito en banco ({ticketsBbvaSinDeposito.length}):
                        </span>
                        <strong className="font-mono text-sky-700 dark:text-sky-300">
                          {formatCurrency(ticketsBbvaSinDeposito.reduce((acc, t) => acc + Number(t.monto || 0), 0))}
                        </strong>
                      </div>
                      {togglePendienteDeposito && (
                        <button
                          type="button"
                          onClick={() => {
                            ticketsBbvaSinDeposito.forEach(t => {
                              if (!t._isPendienteDeposito) togglePendienteDeposito(t.id);
                            });
                          }}
                          className="px-3 py-1 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer shadow-xs"
                        >
                          ✓ Marcar cortes BBVA como Pendientes por Depositar
                        </button>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 font-mono text-[11px]">
                      {ticketsBbvaSinDeposito.map(t => {
                        const isPend = !!t._isPendienteDeposito;
                        return (
                          <div key={t.id} className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-sky-100 dark:border-sky-900/40">
                            <div>
                              <span className="font-bold text-gray-800 dark:text-gray-200">{t.fecha ? String(t.fecha).substring(0, 10) : ''}</span>
                              <span className="ml-2 text-gray-600 dark:text-gray-300 font-sans">{t.descripcion || 'Corte BBVA'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sky-700 dark:text-sky-300">{formatCurrency(t.monto)}</span>
                              {togglePendienteDeposito && (
                                <button
                                  type="button"
                                  onClick={() => togglePendienteDeposito(t.id)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                                    isPend
                                      ? 'bg-sky-700 text-white'
                                      : 'bg-white dark:bg-gray-700 border border-sky-300 text-sky-700 dark:text-sky-200 hover:bg-sky-50'
                                  }`}
                                >
                                  {isPend ? '✓ Pendiente por Depositar' : 'Marcar Pendiente'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-600 dark:text-gray-300 font-bold whitespace-nowrap">
                      Monto ingresado post-cierre:
                    </span>
                    <div className="relative flex-1 max-w-xs">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={inputDiaSiguiente}
                        onChange={e => setInputDiaSiguiente(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const val = parseFloat(inputDiaSiguiente);
                        if (setVentasDiaSiguienteMonto) {
                          setVentasDiaSiguienteMonto(isNaN(val) ? 0 : val);
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition cursor-pointer shadow-xs"
                    >
                      Guardar
                    </button>
                    {ventasDiaSiguienteMes > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (setVentasDiaSiguienteMonto) {
                            setVentasDiaSiguienteMonto(0);
                            setInputDiaSiguiente('');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-300 text-xs font-bold transition cursor-pointer"
                        title="Restablecer a $0"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                    Ajuste actual aplicado: <strong className="text-purple-600 dark:text-purple-300">-{formatCurrency(ventasDiaSiguienteMes)}</strong>
                  </span>
                </div>
              </div>

              {/* 4. CONCILIACIÓN INTERACTIVA: DEPÓSITOS DEL BANCO O CENTRO DE TICKETS */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden shadow-sm space-y-0">
                {/* Switcher de Vista: Depósitos del Estado de Cuenta vs Centro de Tickets */}
                <div className="p-4 bg-gray-50/90 dark:bg-gray-950/70 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="flex items-center gap-2 p-1 rounded-2xl bg-gray-200 dark:bg-gray-800 text-xs font-black">
                    <button
                      type="button"
                      onClick={() => setVistaStep3('depositos')}
                      className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                        vistaStep3 === 'depositos'
                          ? 'bg-white dark:bg-gray-700 text-sky-700 dark:text-sky-300 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <Landmark size={14} />
                      <span>Depósitos Estado de Cuenta ({depositosMes.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVistaStep3('tickets')}
                      className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                        vistaStep3 === 'tickets'
                          ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      <Receipt size={14} />
                      <span>Centro de Tickets ({ticketsMes.length})</span>
                    </button>
                  </div>

                  <span className="text-[11px] text-gray-500 font-sans">
                    {vistaStep3 === 'depositos'
                      ? 'Marca "No es Venta" o "Mes Pasado", y revisa depósitos ya vinculados.'
                      : 'El Ticket es el centro: vincula 1 o más depósitos. Se descuenta del banco al cuadrar al 100%.'}
                  </span>
                </div>

                {/* VISTA 1: DEPÓSITOS DEL ESTADO DE CUENTA */}
                {vistaStep3 === 'depositos' && (
                  <div className="space-y-0">
                    {/* Filtros y Buscador de Depósitos */}
                    <div className="p-3 bg-gray-50/50 dark:bg-gray-950/40 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={searchDeposito}
                          onChange={e => setSearchDeposito(e.target.value)}
                          placeholder="Buscar concepto o ticket..."
                          className="pl-8 pr-3 py-1 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      {/* Filtros Rápidos */}
                      <div className="flex items-center bg-gray-200 dark:bg-gray-800 p-0.5 rounded-xl text-[10px] font-bold overflow-x-auto max-w-full">
                        <button
                          type="button"
                          onClick={() => setFiltroDeposito('todos')}
                          className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroDeposito === 'todos' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          Todos ({depositosMes.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroDeposito('mes_actual')}
                          className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroDeposito === 'mes_actual' ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          Mes Actual ({depositosMes.filter(d => !d._isExcluded && !d._isOtherMonth && !d._isNoVenta).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroDeposito('mes_pasado')}
                          className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroDeposito === 'mes_pasado' ? 'bg-white dark:bg-gray-700 text-amber-700 dark:text-amber-300 shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          Mes Pasado ({depositosMes.filter(d => d._isExcluded || d._isOtherMonth).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroDeposito('no_es_venta')}
                          className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroDeposito === 'no_es_venta' ? 'bg-white dark:bg-gray-700 text-rose-700 dark:text-rose-300 shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          No es Venta ({depositosMes.filter(d => d._isNoVenta).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroDeposito('cuadrados_ticket')}
                          className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroDeposito === 'cuadrados_ticket' ? 'bg-white dark:bg-gray-700 text-sky-700 dark:text-sky-300 shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          Cuadrados 100% ({depositosMes.filter(d => d._vinculadoCuadrado100).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroDeposito('pendientes_vincular')}
                          className={`px-2 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroDeposito === 'pendientes_vincular' ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-300 shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          Pendientes ({depositosMes.filter(d => !d._vinculadoCuadrado100 && !d._isExcluded && !d._isNoVenta).length})
                        </button>
                      </div>
                    </div>

                    {/* Lista de Depósitos */}
                    <div className="max-h-[340px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 font-mono text-xs">
                      {filteredDepositos.map(d => {
                        const isExcl = !!d._isExcluded || !!d._isOtherMonth;
                        const isNoVenta = !!d._isNoVenta;
                        const isCuadrado100 = !!d._vinculadoCuadrado100;
                        const isIncompleto = !!d._vinculadoIncompleto;
                        const descLower = (d.concepto || '').toLowerCase();
                        const hasKeywordNotice =
                          descLower.includes('agosto') ||
                          descLower.includes('julio') ||
                          descLower.includes('septiembre') ||
                          descLower.includes('mes anterior') ||
                          descLower.includes('mes previo');

                        return (
                          <div
                            key={d.id}
                            className={`p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 transition-all ${
                              isNoVenta
                                ? 'bg-rose-50/60 dark:bg-rose-955/20 border-l-4 border-l-rose-500'
                                : isExcl
                                ? 'bg-amber-50/60 dark:bg-amber-955/20 border-l-4 border-l-amber-500'
                                : isCuadrado100
                                ? 'bg-sky-50/40 dark:bg-sky-955/15 border-l-4 border-l-sky-500'
                                : isIncompleto
                                ? 'bg-amber-50/40 dark:bg-amber-955/15 border-l-4 border-l-amber-400'
                                : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/40'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 dark:text-white">
                                  {d.fecha ? String(d.fecha).substring(0, 10) : 'Fecha N/A'}
                                </span>
                                {isNoVenta && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800 dark:bg-rose-955 dark:text-rose-300">
                                    🚫 No es Venta: {d._noVentaRazon || 'Reembolso'}
                                  </span>
                                )}
                                {isExcl && !isNoVenta && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-300">
                                    🔁 Deducido: Mes Pasado
                                  </span>
                                )}
                                {isCuadrado100 && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-sky-100 text-sky-800 dark:bg-sky-955 dark:text-sky-300 flex items-center gap-1 font-sans">
                                    <Check size={11} /> 100% Cuadrado: {d._ticketAsociado?.descripcion || 'Ticket'}
                                  </span>
                                )}
                                {hasKeywordNotice && !isExcl && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-955 dark:text-purple-300 font-sans">
                                    🏷️ {d._otherMonthRazon || 'Desfase Detectado'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-600 dark:text-gray-400 truncate mt-0.5">
                                {d.concepto || 'Sin concepto bancario'}
                              </p>
                              {/* Advertencia si no coincide al 100% */}
                              {isIncompleto && d._advertenciaCuadre && (
                                <div className="mt-1 p-1.5 rounded-lg bg-amber-100/70 dark:bg-amber-950/40 border border-amber-300/60 dark:border-amber-800/60 text-[10px] text-amber-900 dark:text-amber-200 flex items-start gap-1.5 font-sans leading-tight">
                                  <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                  <span>{d._advertenciaCuadre}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap justify-end">
                              <div className="text-right">
                                <span className={`text-sm font-black ${
                                  isExcl || isNoVenta ? 'line-through text-gray-400' : 'text-emerald-600 dark:text-emerald-400'
                                }`}>
                                  {formatCurrency(d._monto)}
                                </span>
                                {(isExcl || isNoVenta) && (
                                  <span className="block text-[10px] text-rose-600 font-bold">
                                    -{formatCurrency(d._monto)}
                                  </span>
                                )}
                              </div>

                              {/* BOTÓN: NO ES VENTA (REEMBOLSO / TRASPASO) */}
                              <div className="relative">
                                {isNoVenta ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleNoEsVentaMovement && toggleNoEsVentaMovement(d.id)}
                                    className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                    title="Deshacer 'No es Venta' y reintegrar a ventas activas"
                                  >
                                    <RotateCcw size={11} />
                                    <span>Deshacer No Venta</span>
                                  </button>
                                ) : (
                                  <div className="flex items-center">
                                    <button
                                      type="button"
                                      onClick={() => setOpenNoEsVentaId(openNoEsVentaId === d.id ? null : d.id)}
                                      className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-rose-400 text-gray-700 dark:text-gray-300 hover:text-rose-600 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                      title="Clasificar como reembolso, traspaso u otro no operativo para restarlo del saldo"
                                    >
                                      <Ban size={11} className="text-rose-500" />
                                      <span>No es Venta</span>
                                      <ChevronDown size={10} />
                                    </button>

                                    {openNoEsVentaId === d.id && (
                                      <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-30 p-1.5 space-y-1 font-sans text-xs">
                                        <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100 dark:border-gray-700">
                                          Seleccionar Motivo
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (toggleNoEsVentaMovement) toggleNoEsVentaMovement(d.id, 'Reembolso');
                                            setOpenNoEsVentaId(null);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-955/30 text-gray-700 dark:text-gray-200 font-semibold flex items-center gap-1.5"
                                        >
                                          <span>💸</span> Reembolso de Proveedor
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (toggleNoEsVentaMovement) toggleNoEsVentaMovement(d.id, 'Traspaso');
                                            setOpenNoEsVentaId(null);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-955/30 text-gray-700 dark:text-gray-200 font-semibold flex items-center gap-1.5"
                                        >
                                          <span>🔄</span> Traspaso entre Cuentas
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (toggleNoEsVentaMovement) toggleNoEsVentaMovement(d.id, 'Aportación');
                                            setOpenNoEsVentaId(null);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-955/30 text-gray-700 dark:text-gray-200 font-semibold flex items-center gap-1.5"
                                        >
                                          <span>🏦</span> Préstamo / Aportación
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (toggleNoEsVentaMovement) toggleNoEsVentaMovement(d.id, 'Ajuste No Operativo');
                                            setOpenNoEsVentaId(null);
                                          }}
                                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-955/30 text-gray-700 dark:text-gray-200 font-semibold flex items-center gap-1.5"
                                        >
                                          <span>⚙️</span> Otro Ajuste No Operativo
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* BOTÓN: ES DEL MES PASADO */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (toggleExcludeMovement) {
                                    toggleExcludeMovement(d.id);
                                  } else if (toggleManualOtherMonth) {
                                    toggleManualOtherMonth(d.id);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                  isExcl
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                    : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-amber-500 text-gray-700 dark:text-gray-300 hover:text-amber-600'
                                }`}
                                title={isExcl ? 'Haz clic para restaurarlo a las ventas de este mes' : 'Marcar como venta del mes pasado para restarlo'}
                              >
                                {isExcl ? (
                                  <>
                                    <RotateCcw size={11} />
                                    <span>Mes Pasado (Activo)</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock size={11} />
                                    <span>Es del Mes Pasado</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {filteredDepositos.length === 0 && (
                        <div className="p-8 text-center text-gray-400 italic">
                          No se encontraron depósitos bancarios que coincidan con el filtro o búsqueda.
                        </div>
                      )}
                    </div>

                    {/* Pie de Tabla de Depósitos con Desglose Completo */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center text-xs font-mono text-gray-600 dark:text-gray-400 gap-2">
                      <div>
                        Mostrando <strong>{filteredDepositos.length}</strong> de {depositosMes.length} depósitos bancarios
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span>Total Banco: <strong>{formatCurrency(totalMontoDepositosMes)}</strong></span>
                        <span className="text-amber-600 font-bold">Mes Pasado: -{formatCurrency(depositosMesPasadoExcluidos)}</span>
                        <span className="text-rose-600 font-bold">No es Venta: -{formatCurrency(depositosNoEsVentaExcluidos)}</span>
                        <span className="text-sky-600 font-bold">Cuadrados 100%: -{formatCurrency(depositosVinculadosCuadrados)}</span>
                        <span className="text-purple-700 dark:text-purple-300 font-extrabold bg-purple-100 dark:bg-purple-955 px-2 py-0.5 rounded-lg">
                          Pendiente por Cuadrar: {formatCurrency(depositosPendientesDeVincular)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* VISTA 2: CENTRO DE TICKETS (EL TICKET ES EL CENTRO QUE TIENE ASOCIADOS 1 O MÁS DEPÓSITOS) */}
                {vistaStep3 === 'tickets' && (
                  <div className="space-y-0">
                    {/* Filtros y Buscador de Tickets */}
                    <div className="p-3 bg-gray-50/50 dark:bg-gray-950/40 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={searchTicket}
                          onChange={e => setSearchTicket(e.target.value)}
                          placeholder="Buscar ticket por descripción o fecha..."
                          className="pl-8 pr-3 py-1 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>

                      <div className="flex items-center bg-gray-200 dark:bg-gray-800 p-0.5 rounded-xl text-[10px] font-bold overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setFiltroTicket('todos')}
                          className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroTicket === 'todos' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          Todos ({ticketsMes.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroTicket('cuadrados')}
                          className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroTicket === 'cuadrados' ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-300 shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          Cuadrados 100% ({ticketsMes.filter(t => t._isCuadrado100).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroTicket('parciales')}
                          className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroTicket === 'parciales' ? 'bg-white dark:bg-gray-700 text-amber-700 dark:text-amber-300 shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          Parciales ({ticketsMes.filter(t => t._isParcial).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroTicket('sin_vincular')}
                          className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroTicket === 'sin_vincular' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          Sin Depósitos ({ticketsMes.filter(t => !t._isCuadrado100 && !t._isParcial && !t._isPendienteDeposito).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setFiltroTicket('pendiente_deposito')}
                          className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                            filtroTicket === 'pendiente_deposito' ? 'bg-white dark:bg-gray-700 text-sky-700 dark:text-sky-300 shadow-2xs' : 'text-gray-500'
                          }`}
                        >
                          Pendientes por Depositar ({ticketsPendientesDeposito.length})
                        </button>
                      </div>
                    </div>

                    {/* Lista de Tickets con Sus Depósitos Asociados */}
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 p-3 space-y-3 font-mono text-xs">
                      {filteredTickets.map(t => {
                        const isCuadrado100 = !!t._isCuadrado100;
                        const isParcial = !!t._isParcial;
                        const isPendienteDep = !!t._isPendienteDeposito;
                        const associated = t._associatedMovs || [];

                        return (
                          <div
                            key={t.id}
                            className={`p-3.5 rounded-2xl border transition-all ${
                              isCuadrado100
                                ? 'bg-emerald-50/40 dark:bg-emerald-955/15 border-emerald-300/60 dark:border-emerald-800/50'
                                : isPendienteDep
                                ? 'bg-sky-50/50 dark:bg-sky-955/15 border-sky-300/70 dark:border-sky-800/50'
                                : isParcial
                                ? 'bg-amber-50/40 dark:bg-amber-955/15 border-amber-300/60 dark:border-amber-800/50'
                                : 'bg-gray-50/30 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-2 border-b border-gray-200/60 dark:border-gray-800/60">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-900 dark:text-white">
                                  {t.fecha ? String(t.fecha).substring(0, 10) : 'Fecha N/A'}
                                </span>
                                <span className="font-sans font-bold text-gray-700 dark:text-gray-300">
                                  {t.descripcion || 'Ticket de Venta / Corte POS'}
                                </span>
                                {isPendienteDep && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-sky-100 text-sky-800 dark:bg-sky-955 dark:text-sky-300 flex items-center gap-1 font-sans">
                                    <Clock size={11} /> Pendiente por depositar ({formatCurrency(Math.max(0, Number(t._difPendiente ?? t.monto ?? 0)))})
                                  </span>
                                )}
                                {isCuadrado100 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-955 dark:text-emerald-300 flex items-center gap-1 font-sans">
                                    <Check size={11} /> Cuadrado al 100%
                                  </span>
                                ) : isParcial ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-300 flex items-center gap-1 font-sans">
                                    <AlertTriangle size={11} /> Parcial (Faltan {formatCurrency(t._difPendiente)})
                                  </span>
                                ) : !isPendienteDep ? (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300 font-sans">
                                    Sin depósitos asociados
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                                <div className="text-right">
                                  <span className="text-[10px] text-gray-400 font-sans block">Monto Ticket:</span>
                                  <span className="text-base font-black text-gray-900 dark:text-white font-mono">
                                    {formatCurrency(t.monto)}
                                  </span>
                                </div>
                                {!isCuadrado100 && togglePendienteDeposito && (
                                  <button
                                    type="button"
                                    id={`btn-pendiente-deposito-${t.id}`}
                                    onClick={() => togglePendienteDeposito(t.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                                      isPendienteDep
                                        ? 'bg-sky-600 hover:bg-sky-700 text-white'
                                        : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:border-sky-500 text-gray-700 dark:text-gray-300 hover:text-sky-600'
                                    }`}
                                    title={isPendienteDep
                                      ? 'Quitar marca de pendiente por depositar'
                                      : 'Marcar como pendiente por depositar: se reconoce en el cuadre y cuenta para la Factura al Público en General'}
                                  >
                                    {isPendienteDep ? <RotateCcw size={13} /> : <Clock size={13} />}
                                    <span>{isPendienteDep ? 'Quitar Pendiente' : 'Pendiente por Depositar'}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCompToLink(t);
                                    setSelectedLinkMovIds(new Set());
                                    setLinkSearchQuery('');
                                    setLinkDateFrom('');
                                    setLinkDateTo('');
                                  }}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                >
                                  <Link2 size={13} />
                                  <span>{associated.length > 0 ? 'Administrar Depósitos' : 'Vincular Depósitos'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Desglose de depósitos asociados a este ticket */}
                            {associated.length > 0 ? (
                              <div className="pt-2 space-y-1.5">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-sans">
                                  Depósitos Bancarios Asociados ({associated.length}):
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                  {associated.map((am: any) => (
                                    <div
                                      key={am.id}
                                      className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs"
                                    >
                                      <div className="min-w-0 flex-1 pr-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-bold text-gray-400">{am.fecha ? String(am.fecha).substring(0, 10) : ''}</span>
                                          <p className="font-bold text-gray-800 dark:text-gray-200 truncate text-[11px]">{am.concepto}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(am.montoAsociado)}</span>
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            if (confirm(`¿Desvincular este depósito bancario del ticket?`)) {
                                              if (desvincularComprobante) {
                                                await desvincularComprobante(t.id, am.id);
                                              }
                                            }
                                          }}
                                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-955/30 rounded cursor-pointer"
                                          title="Desvincular depósito"
                                        >
                                          <Unlink size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="pt-2 text-[11px] text-gray-400 font-sans italic">
                                {isPendienteDep
                                  ? 'Marcado como pendiente por depositar: se reconoce como ingreso del mes en el cuadre y cuenta para la Factura al Público en General. Cuando llegue el depósito, vincúlalo y la marca se quitará sola al cuadrar al 100%.'
                                  : <>Ningún depósito del estado de cuenta está asociado aún a este ticket. Haz clic en &ldquo;Vincular Depósitos&rdquo; para asociarlo o márcalo como &ldquo;Pendiente por Depositar&rdquo;.</>}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {filteredTickets.length === 0 && (
                        <div className="p-8 text-center text-gray-400 italic font-sans">
                          No se encontraron tickets con el filtro o término de búsqueda indicado.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* MODAL EMERGENTE: VINCULADOR TICKET-CENTRISTA (2 COLUMNAS COMO EN BANCOTAB) */}
              {activeCompToLink && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3 bg-black/75 backdrop-blur-md font-sans animate-in fade-in duration-150">
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full h-[96vh] max-w-[98vw] flex flex-col overflow-hidden">
                    
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-950/60">
                      <div>
                        <h4 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                          <Link2 className="text-purple-600" size={17} />
                          Vincular Depósitos Bancarios al Ticket
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {activeCompToLink.descripcion || 'Ticket de Venta'} &bull; Fecha: {activeCompToLink.fecha ? String(activeCompToLink.fecha).substring(0, 10) : ''} &bull; Monto: <strong>{formatCurrency(activeCompToLink.monto)}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCompToLink(null);
                          setSelectedLinkMovIds(new Set());
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {/* Contenido en 2 Columnas */}
                    <div className="flex-1 overflow-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5 min-h-0 text-xs">
                      
                      {/* Columna Izquierda: Ticket y Depósitos ya Vinculados */}
                      {(() => {
                        const compMonto = Number(activeCompToLink.monto || 0);
                        const associated = activeCompToLink._associatedMovs || [];
                        const movsSum = associated.reduce((acc: number, m: any) => acc + Number(m.montoAsociado || 0), 0);

                        // Depósitos seleccionados
                        const available = (depositosMes || []).filter(m => {
                          if (m._isExcluded || m._isNoVenta) return false;
                          if (associated.some((am: any) => am.id === m.id)) return false;
                          return true;
                        });

                        const selectedSum = Array.from(selectedLinkMovIds).reduce((acc, id) => {
                          const m = available.find(x => x.id === id);
                          return acc + (m ? Number(m._monto || 0) : 0);
                        }, 0);

                        const totalSum = movsSum + selectedSum;
                        const dif = compMonto - totalSum;
                        const isMatch = Math.abs(dif) < 0.05;

                        return (
                          <div className="flex flex-col gap-3 min-h-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                              Depósitos Ya Vinculados a este Ticket ({associated.length})
                            </span>

                            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[160px] max-h-[40vh] pr-1 font-mono">
                              {associated.map((am: any) => (
                                <div
                                  key={am.id}
                                  className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex justify-between items-center"
                                >
                                  <div className="min-w-0 flex-1 pr-2">
                                    <span className="text-[9.5px] text-gray-400 block">{am.fecha ? String(am.fecha).substring(0, 10) : ''}</span>
                                    <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{am.concepto}</p>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(am.montoAsociado)}</span>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(`¿Desvincular este depósito bancario del ticket?`)) {
                                          if (desvincularComprobante) {
                                            await desvincularComprobante(activeCompToLink.id, am.id);
                                            setActiveCompToLink(null);
                                          }
                                        }
                                      }}
                                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-955/30 rounded cursor-pointer"
                                      title="Desvincular"
                                    >
                                      <Unlink size={13} />
                                    </button>
                                  </div>
                                </div>
                              ))}

                              {associated.length === 0 && (
                                <div className="p-6 text-center text-gray-400 italic border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                                  No hay depósitos bancarios asociados a este ticket todavía.
                                </div>
                              )}
                            </div>

                            {/* Resumen del Cuadre */}
                            <div className="p-3.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl space-y-1.5 font-mono">
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-500 font-sans">Monto del Ticket:</span>
                                <strong className="text-gray-900 dark:text-white">{formatCurrency(compMonto)}</strong>
                              </div>
                              <div className="flex justify-between text-xs text-emerald-600">
                                <span className="font-sans">Ya Vinculados:</span>
                                <strong>+{formatCurrency(movsSum)}</strong>
                              </div>
                              {selectedSum > 0 && (
                                <div className="flex justify-between text-xs text-purple-600">
                                  <span className="font-sans">Seleccionados ({selectedLinkMovIds.size}):</span>
                                  <strong>+{formatCurrency(selectedSum)}</strong>
                                </div>
                              )}
                              <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700 flex justify-between items-baseline">
                                <span className="text-[10px] font-black uppercase text-gray-400 font-sans">Diferencia Residual:</span>
                                <strong className={`text-sm ${isMatch ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  {isMatch ? '$0.00 (Exacto 100%)' : formatCurrency(dif)}
                                </strong>
                              </div>

                              <div className="pt-1">
                                {isMatch ? (
                                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-955 dark:text-emerald-200 text-[10px] font-bold flex items-center gap-1 font-sans">
                                    <CheckCircle2 size={13} />
                                    <span>✓ Cuadra perfectamente al 100%. Se descontará del saldo del estado de cuenta.</span>
                                  </div>
                                ) : (
                                  <div className="p-2 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-200 text-[10px] font-bold flex items-center gap-1 font-sans">
                                    <AlertTriangle size={13} className="shrink-0" />
                                    <span>⚠️ Difiere por {formatCurrency(dif)}. Solo se descuenta del banco si coincide al 100%.</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Columna Derecha: Depósitos Disponibles del Banco para Asociar */}
                      {(() => {
                        const associated = activeCompToLink._associatedMovs || [];
                        const available = (depositosMes || []).filter(m => {
                          if (m._isExcluded || m._isNoVenta) return false;
                          if (associated.some((am: any) => am.id === m.id)) return false;

                          if (linkSearchQuery) {
                            const q = linkSearchQuery.toLowerCase();
                            const c = (m.concepto || '').toLowerCase();
                            const f = (m.fecha || '').toLowerCase();
                            const val = String(m._monto || '');
                            if (!c.includes(q) && !f.includes(q) && !val.includes(q)) return false;
                          }
                          if (linkDateFrom && m.fecha && m.fecha < linkDateFrom) return false;
                          if (linkDateTo && m.fecha && m.fecha > linkDateTo) return false;

                          return true;
                        });

                        return (
                          <div className="flex flex-col gap-3 min-h-0 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 pt-3 md:pt-0 md:pl-5">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">
                                Depósitos Disponibles ({available.length})
                              </span>
                              <input
                                type="text"
                                value={linkSearchQuery}
                                onChange={e => setLinkSearchQuery(e.target.value)}
                                placeholder="Buscar por concepto o monto..."
                                className="px-2.5 py-1 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[11px] w-44"
                              />
                            </div>

                            {/* Filtro de Fechas */}
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500">
                              <span>Desde:</span>
                              <input
                                type="date"
                                value={linkDateFrom}
                                onChange={e => setLinkDateFrom(e.target.value)}
                                className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px]"
                              />
                              <span>Hasta:</span>
                              <input
                                type="date"
                                value={linkDateTo}
                                onChange={e => setLinkDateTo(e.target.value)}
                                className="px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-[10px]"
                              />
                              {(linkDateFrom || linkDateTo) && (
                                <button
                                  type="button"
                                  onClick={() => { setLinkDateFrom(''); setLinkDateTo(''); }}
                                  className="text-red-500 hover:underline"
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>

                            {/* Lista de selección de depósitos */}
                            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[300px] max-h-[60vh] font-mono pr-1">
                              {available.map(m => {
                                const isSelected = selectedLinkMovIds.has(m.id);
                                return (
                                  <label
                                    key={m.id}
                                    className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                                      isSelected
                                        ? 'bg-purple-50 dark:bg-purple-955/30 border-purple-400'
                                        : 'bg-white dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        setSelectedLinkMovIds(prev => {
                                          const next = new Set(prev);
                                          if (next.has(m.id)) next.delete(m.id);
                                          else next.add(m.id);
                                          return next;
                                        });
                                      }}
                                      className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <span className="text-[9.5px] text-gray-400 block">{m.fecha ? String(m.fecha).substring(0, 10) : ''}</span>
                                      <p className="font-bold text-gray-800 dark:text-gray-200 truncate text-[11px]">{m.concepto}</p>
                                    </div>
                                    <span className="font-black text-gray-900 dark:text-white shrink-0">
                                      {formatCurrency(m._monto)}
                                    </span>
                                  </label>
                                );
                              })}

                              {available.length === 0 && (
                                <div className="p-8 text-center text-gray-400 italic">
                                  No hay depósitos bancarios disponibles con los filtros aplicados.
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Footer con Acciones */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/60 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCompToLink(null);
                          setSelectedLinkMovIds(new Set());
                        }}
                        className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        Cerrar
                      </button>

                      {selectedLinkMovIds.size > 0 && (
                        <button
                          type="button"
                          disabled={linkingBatch}
                          onClick={async () => {
                            const compMonto = Number(activeCompToLink.monto || 0);
                            const associated = activeCompToLink._associatedMovs || [];
                            const movsSum = associated.reduce((acc: number, m: any) => acc + Number(m.montoAsociado || 0), 0);

                            const available = (depositosMes || []).filter(m => !m._isExcluded && !m._isNoVenta);
                            const ids = Array.from(selectedLinkMovIds);
                            const selectedSum = ids.reduce((acc, id) => {
                              const m = available.find(x => x.id === id);
                              return acc + (m ? Number(m._monto || 0) : 0);
                            }, 0);

                            const totalSum = movsSum + selectedSum;
                            const dif = compMonto - totalSum;
                            const isMatch = Math.abs(dif) < 0.05;

                            if (!isMatch) {
                              const confirmPartial = confirm(
                                `⚠️ ADVERTENCIA DE CUADRE NO EXACTO\n\n` +
                                `• Monto del Ticket: ${formatCurrency(compMonto)}\n` +
                                `• Total con Depósitos Seleccionados: ${formatCurrency(totalSum)}\n` +
                                `• Diferencia: ${formatCurrency(dif)}\n\n` +
                                `REGLA CONTABLE: El importe de estos depósitos NO se descontará del saldo del estado de cuenta hasta que el cuadre sea exacto al 100% ($0.00).\n\n` +
                                `¿Deseas vincularlos de todas formas como asociación parcial?`
                              );
                              if (!confirmPartial) return;
                            }

                            setLinkingBatch(true);
                            try {
                              for (const movId of ids) {
                                const m = available.find(x => x.id === movId);
                                const montoAsoc = m ? Number(m._monto || 0) : undefined;
                                if (vincularComprobante) {
                                  await vincularComprobante(activeCompToLink.id, movId, montoAsoc);
                                }
                              }
                              setSelectedLinkMovIds(new Set());
                              setActiveCompToLink(null);
                            } finally {
                              setLinkingBatch(false);
                            }
                          }}
                          className="px-5 py-2 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer flex items-center gap-2 shadow-lg disabled:opacity-50"
                        >
                          {linkingBatch ? (
                            <>
                              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Vinculando...</span>
                            </>
                          ) : (
                            <>
                              <Link2 size={13} />
                              <span>Vincular {selectedLinkMovIds.size} Depósito{selectedLinkMovIds.size > 1 ? 's' : ''} al Ticket</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* 5. RESUMEN COMPLEMENTARIO: TICKETS POS DE MES ANTERIOR */}
              {ticketsOtroMes.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-amber-600" />
                    <span className="font-bold text-amber-900 dark:text-amber-200">
                      {ticketsOtroMes.length} tickets de corte físico también detectados como venta de mes anterior
                    </span>
                  </div>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                    -{formatCurrency(ticketsOtroMes.reduce((acc, t) => acc + Number(t.monto || 0), 0))}
                  </span>
                </div>
              )}

            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PASO 4: VENTAS FACTURADAS A TERCEROS (DEDUCCIÓN CFDI)
          ════════════════════════════════════════════════════════════════════════ */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl flex items-start gap-3">
                <UserCheck className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-sm font-black text-purple-900 dark:text-purple-100">
                    Paso 4: Descuento de Facturación a Terceros (Clientes con RFC)
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                    Las ventas generadas por el punto de venta que ya fueron facturadas individualmente a clientes con su propio RFC se <strong>restan del total</strong> para que no se dupliquen dentro de la Factura Global.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Facturas a Terceros Emitidas</span>
                  <span className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono mt-1 block">
                    {facturasTercerosMes.length} facturas
                  </span>
                </div>
                <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl sm:col-span-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Total a Deducir de la Base Global</span>
                  <span className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono mt-1 block">
                    -{formatCurrency(totalTercerosDeducibles)}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    (Resta directa a la venta de mostrador para evitar doble causación de IVA)
                  </span>
                </div>
              </div>

              {/* Lista de facturas a terceros */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-3 bg-gray-50/70 dark:bg-gray-950/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs font-bold">
                  <span>Facturas Individuales Emitidas ({facturasTercerosMes.length})</span>
                  <span className="font-mono text-purple-600">Total: {formatCurrency(totalTercerosDeducibles)}</span>
                </div>
                <div className="max-h-[220px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 font-mono text-xs">
                  {facturasTercerosMes.map(f => (
                    <div key={f.id || f.uuid_fiscal} className="p-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-800 dark:text-gray-200">{f.fecha_emision || f.fecha || '-'} • {f.rfc_receptor || f.rfc || 'RFC'}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-sm">{f.cliente_nombre || f.nombre_receptor || 'Cliente'}</div>
                      </div>
                      <span className="font-bold text-purple-600 dark:text-purple-400">-{formatCurrency(f._total || f.total || 0)}</span>
                    </div>
                  ))}
                  {facturasTercerosMes.length === 0 && (
                    <div className="p-6 text-center text-gray-400 italic">No se registraron facturas a terceros en este período.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PASO 5: REGLA PARROT VS. BBVA Y DESCUENTO DE PROPINAS
          ════════════════════════════════════════════════════════════════════════ */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-2xl flex items-start gap-3">
                <CreditCard className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-sm font-black text-sky-900 dark:text-sky-100">
                    Paso 5: Regla Parrot (Solo Efectivo + ParrotPay) vs. Tarjetas BBVA Oficiales y Propinas
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                    En el punto de venta a veces no capturan todas las tarjetas o hay desfases con la terminal. Por norma estricta: <strong>de Parrot solo se toma Efectivo y ParrotPay</strong>; las tarjetas se toman de la cuenta bancaria BBVA; y se <strong>descuenta el 100% de las propinas</strong>.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-4 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-xs">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">1. Efectivo Parrot</span>
                  <span className="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-1 block">
                    {formatCurrency(totalEfectivoParrot)}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Ventas en efectivo registradas en POS</span>
                </div>

                <div className="p-4 bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 rounded-2xl shadow-xs">
                  <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase block">2. ParrotPay</span>
                  <span className="text-xl font-black text-purple-700 dark:text-purple-300 font-mono mt-1 block">
                    {formatCurrency(totalParrotPayParrot)}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Pagos procesados vía app/ParrotPay</span>
                </div>

                <div className="p-4 bg-white dark:bg-gray-900 border border-sky-200 dark:border-sky-800 rounded-2xl shadow-xs">
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase block">3. Tarjetas BBVA Oficial</span>
                  <span className="text-xl font-black text-sky-700 dark:text-sky-300 font-mono mt-1 block">
                    {formatCurrency(comparativoTarjetas.totalTarjetasBbva)}
                  </span>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Ventas por TDD/TDC según terminal bancaria</span>
                  {montoTicketsPendientesDeposito > 0 && (
                    <div className="mt-2 pt-2 border-t border-sky-100 dark:border-sky-900/40 text-[11px] font-mono text-sky-600 dark:text-sky-300 space-y-0.5">
                      <div className="flex justify-between">
                        <span className="font-sans text-gray-500">Depositadas en banco:</span>
                        <span>{formatCurrency(comparativoTarjetas.totalTarjetasBbva - montoTicketsPendientesDeposito)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="font-sans text-sky-600 dark:text-sky-400">↳ Pendientes por depositar ({ticketsPendientesDeposito.length}):</span>
                        <span>+{formatCurrency(montoTicketsPendientesDeposito)}</span>
                      </div>
                    </div>
                  )}
                  {montoTicketsPendientesDeposito === 0 && ticketsBbvaSinDeposito.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-sky-100 dark:border-sky-900/40 flex items-center justify-between text-[11px] gap-1">
                      <span className="text-sky-600 dark:text-sky-400 font-bold text-[10px]">
                        {ticketsBbvaSinDeposito.length} corte(s) BBVA sin depósito ({formatCurrency(ticketsBbvaSinDeposito.reduce((acc, t) => acc + Number(t.monto || 0), 0))})
                      </span>
                      {togglePendienteDeposito && (
                        <button
                          type="button"
                          onClick={() => ticketsBbvaSinDeposito.forEach((t: any) => togglePendienteDeposito(t.id))}
                          className="px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] cursor-pointer whitespace-nowrap"
                        >
                          Marcar Pendientes
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Deducción de propinas y brecha de tarjetas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                  <span className="text-xs font-black uppercase text-rose-700 dark:text-rose-300 block mb-1">
                    📉 Descuento del 100% de Propinas
                  </span>
                  <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">
                    -{formatCurrency(totalPropinasExcluidas)}
                  </div>
                  <div className="mt-2 space-y-0.5 text-[11px] font-mono">
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span className="font-sans">Parrot (Efectivo + ParrotPay):</span>
                      <span>{formatCurrency(Math.max(0, totalPropinasExcluidas - comparativoTarjetas.bbvaPropinasTarj))}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span className="font-sans">Tarjetas (Tickets BBVA):</span>
                      <span>{formatCurrency(comparativoTarjetas.bbvaPropinasTarj)}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2 leading-snug">
                    Las propinas no son acumulables ni causan IVA. De Parrot solo se toman las propinas de <strong>Efectivo y ParrotPay</strong>; las propinas de tarjeta se toman <strong>únicamente de los tickets BBVA</strong>.
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 block mb-1">
                      Comparativo de Tarjetas: POS vs. BBVA
                    </span>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 font-mono mt-2">
                      <div className="flex justify-between">
                        <span>Terminal BBVA Banco:</span>
                        <strong className="text-sky-600">{formatCurrency(comparativoTarjetas.totalTarjetasBbva)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Punto de Venta Parrot:</span>
                        <span>{formatCurrency(comparativoTarjetas.totalTarjetasParrot)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-800 font-bold">
                        <span>Diferencia no capturada en POS:</span>
                        <span className="text-amber-600">{formatCurrency(comparativoTarjetas.diferenciaTarjetas)}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 mt-2 italic">
                    ✓ Se toma el importe oficial de BBVA para asegurar que no falte ni un peso en la declaración.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PASO 6: CONTRASTE MILIMÉTRICO CON ESTADOS DE CUENTA
          ════════════════════════════════════════════════════════════════════════ */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl flex items-start gap-3">
                <Landmark className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-100">
                    Paso 6: Contraste Milimétrico con Cargas de Estados de Cuenta
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                    Validamos milimétricamente las entradas y depósitos del estado de cuenta bancario contra las ventas en efectivo y comprobantes.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
                {/* 1. Depósitos Bancarios */}
                <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl space-y-2 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 block">
                      Total Depósitos Estado de Cuenta
                    </span>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatCurrency(totalMontoDepositosMes)}
                    </div>
                    <div className="text-xs space-y-1 mt-2 text-gray-500 font-sans">
                      <div className="flex justify-between">
                        <span>Excluidos Mes Pasado:</span>
                        <strong className="text-amber-600">-{formatCurrency(depositosMesPasadoExcluidos)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Acreditados Día Siguiente:</span>
                        <strong className="text-purple-600">+{formatCurrency(ventasDiaSiguienteMes)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Tickets Pendientes por Depositar ({ticketsPendientesDeposito.length}):</span>
                        <strong className="text-sky-600">+{formatCurrency(montoTicketsPendientesDeposito)}</strong>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-gray-100 dark:border-gray-800 font-bold text-gray-800 dark:text-gray-200">
                        <span>Ingresos Netos Mes:</span>
                        <span>{formatCurrency(depositosNetosMes + ventasDiaSiguienteMes + montoTicketsPendientesDeposito)}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 font-sans block">
                    ✓ Conciliado contra movimientos bancarios
                  </span>
                </div>

                {/* 2. Control Efectivo */}
                <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl space-y-2 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 block">
                      Control de Efectivo: Tickets ↔ Depósitos
                    </span>
                    <div className="text-xs space-y-1 mt-2">
                      <div className="flex justify-between">
                        <span className="font-sans text-gray-500">Venta efectivo Parrot (incl. propina):</span>
                        <span className="font-bold">{formatCurrency(controlEfectivo.ventasEfectivoParrot)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-gray-500">Conciliado con tickets:</span>
                        <span className="font-bold text-emerald-600">{formatCurrency(controlEfectivo.totalEfectivoConciliado)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-sans text-gray-500">Pendiente del mes actual:</span>
                        <span className="font-bold text-amber-600">{formatCurrency(controlEfectivo.efectivoPendienteTicketsMes)}</span>
                      </div>
                      {controlEfectivo.efectivoPendienteMesAnterior > 0 && (
                        <div className="flex justify-between">
                          <span className="font-sans text-gray-500">Arrastre pendiente del mes anterior:</span>
                          <span className="font-bold text-purple-600">{formatCurrency(controlEfectivo.efectivoPendienteMesAnterior)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="font-sans text-gray-500">Abonos de efectivo sin ticket asignado:</span>
                        <span className="font-bold text-blue-600">{formatCurrency(controlEfectivo.montoEfectivoSinAsignar)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-gray-100 dark:border-gray-800 font-bold">
                        <span className="font-sans">Efectivo sin conciliar:</span>
                        <span className={controlEfectivo.faltaPorDepositar > 5 ? 'text-amber-500' : 'text-emerald-500'}>
                          {formatCurrency(controlEfectivo.faltaPorDepositar)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="w-full bg-gray-200 dark:bg-gray-800 h-2 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${Math.min(100, controlEfectivo.porcentajeDepositado)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 font-sans block text-right mt-1">
                      {controlEfectivo.porcentajeDepositado}% del efectivo conciliado
                    </span>
                  </div>
                </div>

                {/* 3. Bolsa Total vs Banco (Cuadre en Ceros) */}
                <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
                  Math.abs(diferenciaBolsaCierre) <= 1
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                }`}>
                  <div>
                    <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300 block">
                      Cuadre Bolsa de Ventas vs Banco
                    </span>
                    <div className="text-xs space-y-1 mt-2">
                      <div className="flex justify-between font-sans">
                        <span className="text-gray-500">Bolsa Total Ventas:</span>
                        <span className="font-bold font-mono">{formatCurrency(bolsaTotalVentasMes)}</span>
                      </div>
                      <div className="flex justify-between font-sans">
                        <span className="text-gray-500">Ingresos Reconocidos:</span>
                        <span className="font-bold font-mono text-emerald-600">
                          {formatCurrency(depositosNetosMes + ventasDiaSiguienteMes + montoTicketsPendientesDeposito)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-gray-100 dark:border-gray-800 font-bold">
                        <span className="font-sans">Diferencia:</span>
                        <span className={`font-mono ${
                          Math.abs(diferenciaBolsaCierre) <= 1 ? 'text-emerald-600' : 'text-amber-500'
                        }`}>
                          {Math.abs(diferenciaBolsaCierre) <= 1 ? '$0.00 (Cuadrado)' : formatCurrency(diferenciaBolsaCierre)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`mt-3 p-2 rounded-xl text-[10px] font-bold font-sans flex items-center gap-1.5 ${
                    Math.abs(diferenciaBolsaCierre) <= 1
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-955 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-300'
                  }`}>
                    {Math.abs(diferenciaBolsaCierre) <= 1 ? (
                      <>
                        <CheckCircle2 size={13} className="shrink-0" />
                        <span>✓ Cuadre perfecto en ceros</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={13} className="shrink-0" />
                        <span>Ajustar desfases en el Paso 3</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              PASO 7: RESULTADO FINAL Y CÁLCULO OFICIAL DE FACTURA GLOBAL
          ════════════════════════════════════════════════════════════════════════ */}
          {currentStep === 7 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 rounded-3xl shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={18} className="text-amber-300" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-100">
                    Cálculo Oficial Consecuente • Período {selectedMonth}
                  </span>
                </div>
                <h4 className="text-xl sm:text-2xl font-black">
                  Resumen de cierre para contador
                </h4>
                <p className="text-xs text-emerald-100 mt-1 max-w-2xl leading-relaxed">
                  Período {selectedMonth} · Importes conciliados, CFDI individuales e IVA trasladado.
                </p>
              </div>

              <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h5 className="text-xs font-black uppercase text-gray-800 dark:text-gray-100">Estado de la información capturada</h5>
                    <p className="text-[10px] text-gray-500 mt-0.5">Cifras rápidas y accesos a su detalle de origen.</p>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500">Corte {selectedMonth}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/70 border border-gray-100 dark:border-gray-700">
                    <span className="text-[9px] uppercase font-black text-gray-500">Tickets POS</span>
                    <strong className="block text-lg font-mono text-gray-900 dark:text-white">{ticketsMes.length}</strong>
                    <span className={`text-[10px] font-bold ${auditoriaDiasMes.diasLaborablesSinTicket > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {auditoriaDiasMes.diasLaborablesSinTicket > 0
                        ? `${auditoriaDiasMes.diasLaborablesSinTicket} día(s) laborable(s) sin ticket`
                        : 'Días laborables cubiertos'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50">
                    <span className="text-[9px] uppercase font-black text-purple-700 dark:text-purple-300">CFDI a terceros</span>
                    <strong className="block text-lg font-mono text-purple-800 dark:text-purple-200">{facturasTercerosMes.length}</strong>
                    <span className="text-[10px] text-purple-700 dark:text-purple-300">
                      IVA trasladado: {formatCurrency(ivaFacturasTerceros)}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50">
                    <span className="text-[9px] uppercase font-black text-amber-700 dark:text-amber-300">Efectivo por depositar</span>
                    <strong className="block text-lg font-mono text-amber-800 dark:text-amber-200">{formatCurrency(controlEfectivo.faltaPorDepositar)}</strong>
                    <span className="text-[10px] text-amber-700 dark:text-amber-300">Según cortes Parrot y depósitos asignados</span>
                  </div>
                  <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50">
                    <span className="text-[9px] uppercase font-black text-sky-700 dark:text-sky-300">Depósitos pendientes de cuadre</span>
                    <strong className="block text-lg font-mono text-sky-800 dark:text-sky-200">{formatCurrency(depositosPendientesDeVincular)}</strong>
                    <span className="text-[10px] text-sky-700 dark:text-sky-300">Saldo bancario sin vinculación completa</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" onClick={() => setCurrentStep(2)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Receipt size={12} /> Detalle de tickets
                  </button>
                  <button type="button" onClick={() => setCurrentStep(3)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Landmark size={12} /> Depósitos y desfases
                  </button>
                  <button type="button" onClick={() => setCurrentStep(4)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <FileText size={12} /> CFDI de terceros
                  </button>
                  <button type="button" onClick={() => setCurrentStep(6)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Building2 size={12} /> Estados de cuenta
                  </button>
                </div>
              </section>

              {/* Cascada Financiera (Waterfall) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm space-y-3 font-mono text-xs">
                  <h5 className="font-sans font-black text-xs uppercase text-gray-700 dark:text-gray-300">
                    Integración del total cobrado (IVA incluido)
                  </h5>
                  <div className="space-y-2 divide-y divide-gray-100 dark:divide-gray-800/60">
                    <div className="flex justify-between pt-1">
                      <span className="font-sans text-gray-500">💵 (+) Efectivo Parrot:</span>
                      <span className="font-bold text-emerald-600">+{formatCurrency(totalEfectivoParrot)}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="font-sans text-gray-500">🦜 (+) ParrotPay:</span>
                      <span className="font-bold text-purple-600">+{formatCurrency(totalParrotPayParrot)}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="font-sans text-gray-500">💳 (+) Tarjetas BBVA Oficiales:</span>
                      <span className="font-bold text-sky-600">+{formatCurrency(comparativoTarjetas.totalTarjetasBbva)}</span>
                    </div>
                    {ticketsPendientesDeposito.length > 0 ? (
                      <div className="pt-1 pl-4 space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="font-sans text-sky-400">↳ incluye tickets BBVA pendientes por depositar ({ticketsPendientesDeposito.length}):</span>
                          <span className="text-sky-300 font-bold font-mono">+{formatCurrency(montoTicketsPendientesDeposito)}</span>
                        </div>
                        {ticketsPendientesDeposito.map((tp: any) => (
                          <div key={tp.id} className="flex justify-between pl-2 text-[10px] text-gray-400">
                            <span>• {tp.fecha ? String(tp.fecha).substring(0, 10) : ''} ({tp.descripcion || 'Corte BBVA'}):</span>
                            <span className="font-mono text-sky-300">{formatCurrency(tp._difPendiente ?? tp.monto)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      ticketsBbvaSinDeposito.length > 0 && (
                        <div className="mt-1 pl-4 p-2 rounded-xl bg-sky-950/40 border border-sky-800/40 text-[11px] flex items-center justify-between gap-2">
                          <span className="text-sky-300">
                            ⚠️ Hay {ticketsBbvaSinDeposito.length} ticket(s) BBVA sin depósito ({formatCurrency(ticketsBbvaSinDeposito.reduce((acc, t) => acc + Number(t.monto || 0), 0))})
                          </span>
                          {togglePendienteDeposito && (
                            <button
                              type="button"
                              onClick={() => ticketsBbvaSinDeposito.forEach((t: any) => togglePendienteDeposito(t.id))}
                              className="px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] whitespace-nowrap cursor-pointer"
                            >
                              Marcar como Pendiente
                            </button>
                          )}
                        </div>
                      )
                    )}
                    <div className="flex justify-between pt-1">
                      <span className="font-sans text-gray-500">👥 (-) Facturas de Terceros (RFC):</span>
                      <span className="font-bold text-purple-600">-{formatCurrency(totalTercerosDeducibles)}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="font-sans text-gray-500">📉 (-) Propinas excluidas:</span>
                      <span className="font-bold text-gray-500">-{formatCurrency(totalPropinasExcluidas)}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="font-sans text-gray-500">🔄 (-) Ventas Mes Pasado Excluidas:</span>
                      <span className="font-bold text-amber-600">
                        -{formatCurrency(ticketsOtroMes.reduce((acc, t) => acc + Number(t.monto || 0), 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tarjeta de Importes SAT */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-950 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between border border-gray-800">
                  <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full inline-block">
                      Importes para Timbrado CFDI 4.0
                    </span>

                    <div className="space-y-3 font-mono">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-400 font-sans">Subtotal (Base Gravable):</span>
                        <span className="text-xl font-black text-white">{formatCurrency(subtotalFacturaGlobal)}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-400 font-sans">IVA Trasladado (16%):</span>
                        <span className="text-xl font-black text-emerald-400">+{formatCurrency(ivaFacturaGlobal)}</span>
                      </div>
                      <div className="pt-3 border-t border-gray-800 flex justify-between items-baseline">
                        <span className="text-sm font-black font-sans text-gray-200">TOTAL FACTURA GLOBAL:</span>
                        <span className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">
                          {formatCurrency(totalConIvaFacturaGlobal)}
                        </span>
                      </div>
                      <div className="pt-3 border-t border-gray-800/70 space-y-2 font-sans">
                        <span className="text-[10px] font-black uppercase tracking-wide text-emerald-300">IVA trasladado del período</span>
                        <div className="flex justify-between gap-3 text-xs text-gray-400">
                          <span>Factura Global</span>
                          <strong className="font-mono text-emerald-300">{formatCurrency(ivaFacturaGlobal)}</strong>
                        </div>
                        <div className="flex justify-between gap-3 text-xs text-gray-400">
                          <span>Facturas individuales a terceros ({facturasTercerosMes.length})</span>
                          <strong className="font-mono text-emerald-300">{formatCurrency(ivaFacturasTerceros)}</strong>
                        </div>
                        <div className="flex justify-between gap-3 border-t border-gray-800 pt-2 text-sm font-black text-gray-200">
                          <span>Total IVA trasladado</span>
                          <strong className="font-mono text-emerald-300">{formatCurrency(totalIvaTrasladadoPeriodo)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-gray-800/80 flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={exportFacturaPublicoExcel}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <FileSpreadsheet size={15} /> Exportar Reporte Cierre Excel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingFinal}
                      onClick={async () => {
                        setIsSavingFinal(true);
                        try {
                          if (guardarAjustesPeriodo) {
                            const res = await guardarAjustesPeriodo();
                            if (res && res.error) {
                              throw new Error(typeof res.error === 'string' ? res.error : res.error.message || 'Error al guardar');
                            }
                          }
                          refreshPeriodStatus();
                          alert(`✓ Configuración, días inhábiles y cierre del período ${selectedMonth} guardados exitosamente.`);
                          onClose();
                        } catch (e: any) {
                          alert(`Error al guardar configuración: ${e?.message || 'Error desconocido'}`);
                        } finally {
                          setIsSavingFinal(false);
                        }
                      }}
                      className="px-4 py-2 bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-900 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isSavingFinal ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Guardando...
                        </>
                      ) : (
                        'Guardar y Finalizar'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <details className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                <summary className="cursor-pointer list-none p-4 flex flex-wrap items-center justify-between gap-2 text-xs font-black text-gray-800 dark:text-gray-100">
                  <span className="inline-flex items-center gap-2"><FileText size={14} className="text-purple-600" /> Detalle de CFDI individuales a terceros ({facturasTercerosMes.length})</span>
                  <span className="font-mono text-purple-700 dark:text-purple-300">IVA: {formatCurrency(ivaFacturasTerceros)}</span>
                </summary>
                <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-800">
                  <table className="w-full min-w-[680px] text-left text-[10px]">
                    <thead className="bg-gray-50 dark:bg-gray-800/60 uppercase text-gray-500">
                      <tr>
                        <th className="p-2.5">Fecha / Folio</th>
                        <th className="p-2.5">RFC / Cliente</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                        <th className="p-2.5 text-right">IVA</th>
                        <th className="p-2.5 text-right">Total CFDI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {facturasTercerosMes.map(invoice => (
                        <tr key={invoice.id || invoice.uuid_fiscal}>
                          <td className="p-2.5 font-mono text-gray-600 dark:text-gray-300">{invoice.fecha_emision || invoice.fecha || '-'}<span className="block text-gray-400">{invoice.serie_folio || invoice.uuid_fiscal || '-'}</span></td>
                          <td className="p-2.5 text-gray-700 dark:text-gray-200">{invoice.rfc_receptor || invoice.rfc || '-'}<span className="block text-gray-400">{invoice._clienteNombre || invoice.cliente_nombre || invoice.nombre_receptor || 'Cliente'}</span></td>
                          <td className="p-2.5 text-right font-mono">{formatCurrency(invoice._subtotal || invoice.subtotal || 0)}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-700 dark:text-emerald-300">{formatCurrency(invoice._iva ?? invoice.iva_trasladado ?? 0)}</td>
                          <td className="p-2.5 text-right font-mono font-bold">{formatCurrency(invoice._total || invoice.total || 0)}</td>
                        </tr>
                      ))}
                      {facturasTercerosMes.length === 0 && (
                        <tr><td colSpan={5} className="p-5 text-center text-gray-400">No hay CFDI a terceros en este período.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}

        </div>

        {/* PIE DE PÁGINA: NAVEGACIÓN ANTERIOR / SIGUIENTE */}
        <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center shrink-0">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  currentStep === i + 1 ? 'w-6 bg-emerald-600' : currentStep > i + 1 ? 'w-2 bg-emerald-400' : 'w-2 bg-gray-300 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
              className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all flex items-center gap-1 cursor-pointer"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-black bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md transition-all cursor-pointer"
            >
              Cerrar Asistente
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
