import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  Receipt,
  Target,
  Scale,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Ban,
  Link2,
  Unlink,
  Check,
  ChevronDown,
  Search,
  Filter,
  DollarSign,
  Layers,
  ArrowRight,
  X
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
  bolsaTotalVentasMes?: number;
  totalEfectivoParrot?: number;
  totalParrotPayParrot?: number;
  totalMontoDepositosMes?: number;
  depositosNetosMes?: number;
  ventasDiaSiguienteMes?: number;
  setVentasDiaSiguienteMonto?: (monto: number) => void;
  diferenciaBolsaCierre?: number;
  depositosMes?: any[];
  depositosNoEsVentaExcluidos?: number;
  depositosPendientesDeVincular?: number;
  depositosVinculadosCuadrados?: number;
  toggleNoEsVentaMovement?: (movId: string, razon?: string | null) => Promise<boolean>;
  vincularComprobante?: (comprobanteId: string, movimientoIds: string[]) => Promise<any>;
  desvincularComprobante?: (comprobanteId: string, movimientoId: string) => Promise<any>;
  ticketsFinDeMesPendientes?: any[];
  montoTicketsFinDeMesPendientes?: number;
  ticketsMes?: any[];
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
  bolsaTotalVentasMes = 0,
  totalEfectivoParrot = 0,
  totalParrotPayParrot = 0,
  totalMontoDepositosMes = 0,
  depositosNetosMes = 0,
  ventasDiaSiguienteMes = 0,
  setVentasDiaSiguienteMonto,
  diferenciaBolsaCierre = 0,
  depositosMes = [],
  depositosNoEsVentaExcluidos = 0,
  depositosPendientesDeVincular = 0,
  depositosVinculadosCuadrados = 0,
  toggleNoEsVentaMovement,
  vincularComprobante,
  desvincularComprobante,
  ticketsFinDeMesPendientes = [],
  montoTicketsFinDeMesPendientes = 0,
  ticketsMes = [],
}) => {
  const router = useRouter();
  const [inputDiaSig, setInputDiaSig] = useState<string>(
    ventasDiaSiguienteMes > 0 ? String(ventasDiaSiguienteMes) : ''
  );

  // Sub-vista local
  const [vistaActiva, setVistaActiva] = useState<'depositos' | 'tickets' | 'desfase_auto'>('depositos');
  const [filtroDeposito, setFiltroDeposito] = useState<'todos' | 'mes_actual' | 'mes_pasado' | 'no_es_venta' | 'cuadrados_100' | 'incompletos_o_pendientes'>('todos');
  const [filtroTicket, setFiltroTicket] = useState<'todos' | 'cuadrados' | 'incompletos' | 'sin_vincular'>('todos');
  const [openNoEsVentaId, setOpenNoEsVentaId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Estado para el modal de 2 columnas para vincular ticket con depósitos
  const [activeCompToLink, setActiveCompToLink] = useState<any | null>(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [selectedLinkMovIds, setSelectedLinkMovIds] = useState<string[]>([]);
  const [linkingBatch, setLinkingBatch] = useState(false);

  // Depósitos filtrados
  const depositosFiltrados = depositosMes.filter(m => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchConcepto = (m.concepto || '').toLowerCase().includes(q);
      const matchMonto = String(m._monto || '').includes(q);
      if (!matchConcepto && !matchMonto) return false;
    }
    if (filtroDeposito === 'mes_actual') return !m._isExcluded && !m._isNoVenta;
    if (filtroDeposito === 'mes_pasado') return m._isExcluded;
    if (filtroDeposito === 'no_es_venta') return m._isNoVenta;
    if (filtroDeposito === 'cuadrados_100') return m._vinculadoCuadrado100;
    if (filtroDeposito === 'incompletos_o_pendientes') return !m._vinculadoCuadrado100 && !m._isNoVenta && !m._isExcluded;
    return true;
  });

  // Tickets filtrados
  const ticketsFiltrados = ticketsMes.filter(t => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = (t.descripcion || '').toLowerCase().includes(q);
      const matchMonto = String(t.monto || '').includes(q);
      if (!matchDesc && !matchMonto) return false;
    }
    if (filtroTicket === 'cuadrados') return t._isCuadrado100;
    if (filtroTicket === 'incompletos') return t._isParcial;
    if (filtroTicket === 'sin_vincular') return !t._isCuadrado100 && !t._isParcial;
    return true;
  });

  // Helpers para el modal de vinculación
  const openLinkModalForTicket = (ticket: any) => {
    setActiveCompToLink(ticket);
    const initialSelected = (ticket._associatedMovs || []).map((m: any) => m.id);
    setSelectedLinkMovIds(initialSelected);
    setLinkSearchQuery('');
  };

  const handleConfirmLink = async () => {
    if (!activeCompToLink || !vincularComprobante) return;
    try {
      setLinkingBatch(true);
      await vincularComprobante(activeCompToLink.id, selectedLinkMovIds);
      setActiveCompToLink(null);
    } catch (err: any) {
      alert(`Error al vincular: ${err?.message || 'Error desconocido'}`);
    } finally {
      setLinkingBatch(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">

      {/* 1. LAS 3 VÍAS DE VENTA Y LA GRAN BOLSA TOTAL */}
      {bolsaTotalVentasMes > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
          <div className="p-3 bg-white dark:bg-gray-800/80 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 font-sans block">
              💵 1. Venta Efectivo
            </span>
            <div className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
              {formatCurrency(totalEfectivoParrot)}
            </div>
            <span className="text-[9.5px] text-gray-400 font-sans block">Cobrado en mostrador POS</span>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800/80 border border-sky-200 dark:border-sky-800/60 rounded-xl">
            <span className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 font-sans block">
              💳 2. Venta Tarjeta
            </span>
            <div className="text-base font-black text-sky-700 dark:text-sky-300 mt-0.5">
              {formatCurrency(comparativoBbvaBanco?.totalVentasTarjetasParrot || 0)}
            </div>
            <span className="text-[9.5px] text-gray-400 font-sans block">Terminales bancarias BBVA</span>
          </div>

          <div className="p-3 bg-white dark:bg-gray-800/80 border border-purple-200 dark:border-purple-800/60 rounded-xl">
            <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 font-sans block">
              🦜 3. Venta ParrotPay
            </span>
            <div className="text-base font-black text-purple-700 dark:text-purple-300 mt-0.5">
              {formatCurrency(totalParrotPayParrot)}
            </div>
            <span className="text-[9.5px] text-gray-400 font-sans block">Cobros app digital</span>
          </div>

          <div className="p-3 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-xl shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100 font-sans flex items-center gap-1">
                <Target size={12} /> BOLSA TOTAL VENTAS
              </span>
              <span className="text-[9px] font-black px-1 rounded-full bg-white/20 text-white font-sans">
                Meta
              </span>
            </div>
            <div className="text-lg font-black mt-0.5">
              {formatCurrency(bolsaTotalVentasMes)}
            </div>
          </div>
        </div>
      )}

      {/* 2. VISOR DINÁMICO DE CONCILIACIÓN DE LA BOLSA HACIA CEROS */}
      {bolsaTotalVentasMes > 0 && (
        <div className="p-4 bg-white dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-2xl space-y-3 font-mono text-xs">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Scale size={16} className="text-emerald-500" />
              <span className="font-sans font-black uppercase text-gray-700 dark:text-gray-300">
                Conciliación Milimétrica de la Bolsa hacia Ceros ($0.00)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-sans text-[11px] text-gray-400">Diferencia Final:</span>
              <strong className={`text-base font-black ${
                Math.abs(diferenciaBolsaCierre) <= 1
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {Math.abs(diferenciaBolsaCierre) <= 1 ? '$0.00 (Cuadrado)' : formatCurrency(diferenciaBolsaCierre)}
              </strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <span className="text-gray-400 block font-sans">1. Bolsa Ventas Mes:</span>
              <strong className="text-gray-800 dark:text-gray-200 font-bold block mt-0.5">+{formatCurrency(bolsaTotalVentasMes)}</strong>
              <span className="text-[9.5px] text-gray-400 font-sans block mt-0.5">Efectivo + Tarjetas + Parrot</span>
            </div>
            <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-955/30 border border-sky-200 dark:border-sky-900">
              <span className="text-sky-600 dark:text-sky-400 block font-sans">2. (-) Depósitos Netos Mes:</span>
              <strong className="text-sky-700 dark:text-sky-300 font-bold block mt-0.5">-{formatCurrency(depositosNetosMes)}</strong>
              <span className="text-[9.5px] text-sky-600/80 dark:text-sky-400/80 font-sans block mt-0.5">
                Bruto: {formatCurrency(totalMontoDepositosMes)} | Excluidos: {formatCurrency(totalMontoExcluidoOtroMes + depositosNoEsVentaExcluidos)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-955/30 border border-purple-200 dark:border-purple-900">
              <span className="text-purple-600 dark:text-purple-400 block font-sans">3. (-) Ventas Día Siguiente:</span>
              <strong className="text-purple-700 dark:text-purple-300 font-bold block mt-0.5">-{formatCurrency(ventasDiaSiguienteMes)}</strong>
              <span className="text-[9.5px] text-purple-600/80 dark:text-purple-400/80 font-sans block mt-0.5">
                {montoTicketsFinDeMesPendientes > 0 ? `Sugerido por tickets: ${formatCurrency(montoTicketsFinDeMesPendientes)}` : 'Ventas flotantes pendientes'}
              </span>
            </div>
            <div className={`p-2.5 rounded-lg border ${
              Math.abs(diferenciaBolsaCierre) <= 1
                ? 'bg-emerald-50 dark:bg-emerald-955/30 border-emerald-300 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-50 dark:bg-amber-955/30 border-amber-300 text-amber-700 dark:text-amber-300'
            }`}>
              <span className="block font-sans">4. Balance Cuadre:</span>
              <strong className="font-bold block mt-0.5">
                {Math.abs(diferenciaBolsaCierre) <= 1 ? '✓ $0.00 en ceros' : formatCurrency(diferenciaBolsaCierre)}
              </strong>
              <span className="text-[9.5px] font-sans block mt-0.5">
                {Math.abs(diferenciaBolsaCierre) <= 1 ? 'Todo conciliado' : 'Pendiente de conciliar'}
              </span>
            </div>
          </div>

          {/* Sugerencia inteligente de ventas día siguiente por Tickets */}
          {montoTicketsFinDeMesPendientes > 0 && Math.abs(ventasDiaSiguienteMes - montoTicketsFinDeMesPendientes) > 0.05 && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Clock className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <span className="font-sans font-bold text-purple-900 dark:text-purple-200 block">
                    Detectamos {ticketsFinDeMesPendientes.length} tickets del fin de mes pendientes de depósito en banco por {formatCurrency(montoTicketsFinDeMesPendientes)}
                  </span>
                  <span className="text-[11px] text-purple-700 dark:text-purple-300 font-sans block mt-0.5">
                    El monto se conoce por el ticket: si en el banco se depositaron {formatCurrency(depositosNetosMes)} y faltaban {formatCurrency(montoTicketsFinDeMesPendientes)}, el saldo final de la venta fue {formatCurrency(depositosNetosMes + montoTicketsFinDeMesPendientes)}.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setInputDiaSig(String(montoTicketsFinDeMesPendientes));
                  if (setVentasDiaSiguienteMonto) {
                    setVentasDiaSiguienteMonto(montoTicketsFinDeMesPendientes);
                  }
                }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold font-sans cursor-pointer whitespace-nowrap shadow-xs text-xs self-end sm:self-center"
              >
                Aplicar {formatCurrency(montoTicketsFinDeMesPendientes)} al Cierre
              </button>
            </div>
          )}

          {/* Ajuste manual de ventas día siguiente */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2">
            <span className="font-sans text-[11px] text-gray-500">
              ⏱️ Ventas de fin de mes ingresadas en banco al día siguiente (ajuste manual):
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={inputDiaSig}
                onChange={e => setInputDiaSig(e.target.value)}
                placeholder="0.00"
                className="w-32 px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-mono font-bold"
              />
              <button
                type="button"
                onClick={() => {
                  const val = parseFloat(inputDiaSig);
                  if (setVentasDiaSiguienteMonto) {
                    setVentasDiaSiguienteMonto(isNaN(val) ? 0 : val);
                  }
                }}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold font-sans cursor-pointer shadow-xs"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. RESUMEN EN TARJETAS CONCILIATORIAS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono text-xs">
        <div className="p-3 bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-gray-500 font-sans block">Depósitos Brutos BBVA</span>
          <h4 className="text-base font-black text-gray-900 dark:text-white mt-0.5">
            {formatCurrency(totalMontoDepositosMes)}
          </h4>
          <span className="text-[9.5px] text-gray-400 font-sans block">{depositosMes.length} depósitos en el mes</span>
        </div>

        <div className="p-3 bg-white dark:bg-gray-800/80 border border-amber-200 dark:border-amber-800/60 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 font-sans block">(-) Excluido Mes Anterior</span>
          <h4 className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
            -{formatCurrency(totalMontoExcluidoOtroMes)}
          </h4>
          <span className="text-[9.5px] text-gray-400 font-sans block">Acreditado de ventas pasadas</span>
        </div>

        <div className="p-3 bg-white dark:bg-gray-800/80 border border-rose-200 dark:border-rose-800/60 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 font-sans block">(-) Excluido "No es Venta"</span>
          <h4 className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5">
            -{formatCurrency(depositosNoEsVentaExcluidos)}
          </h4>
          <span className="text-[9.5px] text-gray-400 font-sans block">Reembolsos, traspasos, otros</span>
        </div>

        <div className="p-3 bg-white dark:bg-gray-800/80 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
          <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 font-sans block">Cuadrados 100% con Tickets</span>
          <h4 className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatCurrency(depositosVinculadosCuadrados)}
          </h4>
          <span className="text-[9.5px] text-emerald-600/70 font-sans block">Coincidencia exacta al 100%</span>
        </div>

        <div className="p-3 bg-white dark:bg-gray-800/80 border border-sky-200 dark:border-sky-800/60 rounded-xl col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400 font-sans block">Saldo Pendiente de Cuadrar</span>
          <h4 className="text-base font-black text-sky-600 dark:text-sky-400 mt-0.5">
            {formatCurrency(depositosPendientesDeVincular)}
          </h4>
          <span className="text-[9.5px] text-gray-400 font-sans block">Pendientes de asociar al 100%</span>
        </div>
      </div>

      {/* 4. SELECTOR DE VISTA DE CONCILIACIÓN */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-gray-800/80 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setVistaActiva('depositos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              vistaActiva === 'depositos'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <DollarSign size={14} />
            <span>Todos los Depósitos del Mes ({depositosMes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaActiva('tickets')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              vistaActiva === 'tickets'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <Receipt size={14} />
            <span>Centro de Tickets ({ticketsMes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaActiva('desfase_auto')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              vistaActiva === 'desfase_auto'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <CalendarClock size={14} />
            <span>Desfase Automático ({movimientosOtroMes.length})</span>
          </button>
        </div>

        {/* Buscador general */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por concepto o monto..."
            className="w-full pl-8 pr-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs bg-gray-50 dark:bg-gray-900"
          />
        </div>
      </div>

      {/* VISTA 1: TODOS LOS DEPÓSITOS DEL MES CON NO ES VENTA Y VINCULACIÓN AL 100% */}
      {vistaActiva === 'depositos' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
          {/* Barra de filtros de depósitos */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-bold text-gray-500 uppercase mr-1 flex items-center gap-1">
                <Filter size={12} /> Filtrar:
              </span>
              {(['todos', 'mes_actual', 'mes_pasado', 'no_es_venta', 'cuadrados_100', 'incompletos_o_pendientes'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltroDeposito(f)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    filtroDeposito === f
                      ? 'bg-sky-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {f === 'todos' && `Todos (${depositosMes.length})`}
                  {f === 'mes_actual' && 'Ventas de este Mes'}
                  {f === 'mes_pasado' && 'Mes Pasado'}
                  {f === 'no_es_venta' && `🚫 No es Venta (${depositosMes.filter(m => m._isNoVenta).length})`}
                  {f === 'cuadrados_100' && `✅ Cuadrados 100% (${depositosMes.filter(m => m._vinculadoCuadrado100).length})`}
                  {f === 'incompletos_o_pendientes' && 'Incompletos / Pendientes'}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-gray-400 font-mono">
              Mostrando {depositosFiltrados.length} depósitos
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                <th className="p-3">Fecha Banco</th>
                <th className="p-3">Concepto Bancario</th>
                <th className="p-3 text-right font-black">Monto Depósito</th>
                <th className="p-3">Ticket Vinculado</th>
                <th className="p-3 text-center">Estatus Conciliatorio</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {depositosFiltrados.map((m: any) => {
                const isNoVenta = !!m._isNoVenta;
                const isMesPasado = !!m._isExcluded;
                const isCuadrado100 = !!m._vinculadoCuadrado100;
                const isIncompleto = !!m._vinculadoIncompleto;
                const ticket = m._ticketAsociado;
                const ticketsAsociados = m._ticketsAsociados || (ticket ? [{ ticket, montoAsociado: m._montoAsociadoAlTicket }] : []);

                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors ${
                      isNoVenta
                        ? 'bg-rose-50/30 dark:bg-rose-950/10'
                        : isMesPasado
                        ? 'bg-amber-50/30 dark:bg-amber-950/10'
                        : isCuadrado100
                        ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                        : ''
                    }`}
                  >
                    <td className="p-3 font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                    </td>
                    <td className="p-3 font-bold text-gray-800 dark:text-gray-200 max-w-xs truncate" title={m.concepto}>
                      {m.concepto || 'Depósito bancario'}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                      {formatCurrency(m._monto)}
                    </td>
                    <td className="p-3">
                      {ticketsAsociados.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {m._esDepositoEfectivo ? (
                            <>
                              <span className="font-bold text-indigo-700 dark:text-indigo-300 text-[11px] inline-flex items-center gap-1">
                                💵 {ticketsAsociados.length} corte(s) de efectivo vinculados
                              </span>
                              {ticketsAsociados.map(({ ticket: cashTicket, montoAsociado }: any) => (
                                <span key={cashTicket.id} className="text-[10px] text-gray-600 dark:text-gray-400 font-mono">
                                  {cashTicket.descripcion || 'Corte POS'}: efectivo {formatCurrency(Number(cashTicket.monto_efectivo || 0) + Number(cashTicket.propina_efectivo || 0))} · asignado aquí {formatCurrency(montoAsociado)}
                                </span>
                              ))}
                              <span className="text-[10px] text-gray-500 font-mono">
                                Depósito: {formatCurrency(m._monto)} | Total de cortes asignado: {formatCurrency(m._ticketTotalVinculado)}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-indigo-700 dark:text-indigo-300 text-[11px] inline-flex items-center gap-1">
                                🎫 {ticket.descripcion || 'Ticket'}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                Monto del corte: {formatCurrency(ticket.monto)} | Este depósito: {formatCurrency(m._montoAsociadoAlTicket)} | Total vinculado: {formatCurrency(m._ticketTotalVinculado)}
                              </span>
                            </>
                          )}
                          {isIncompleto && (
                            <>
                              <span className="text-[9.5px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                                ⚠️ Diferencia del depósito: {formatCurrency(m._ticketDiferencia)} (No se descuenta hasta 100%)
                              </span>
                            </>
                          )}
                          {m._esDepositoEfectivo && !isCuadrado100 && !isNoVenta && (
                            <button
                              type="button"
                              onClick={() => {
                                const params = new URLSearchParams({ cashDepositId: m.id });
                                if (ticketsAsociados[0]?.ticket?.id) {
                                  params.set('cashTicketId', ticketsAsociados[0].ticket.id);
                                }
                                router.push(`/admin/gastos?${params.toString()}`);
                              }}
                              className="self-start inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:underline"
                            >
                              <ArrowRight size={11} /> {ticketsAsociados.length ? 'Corregir en Ingresos' : 'Asignar tickets en Ingresos'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">Sin ticket asociado</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {isNoVenta ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-800 dark:bg-rose-955 dark:text-rose-300 border border-rose-300 dark:border-rose-800 inline-flex items-center gap-1">
                          <Ban size={10} /> NO ES VENTA ({m._noVentaRazon || 'Excluido'})
                        </span>
                      ) : isMesPasado ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-300 border border-amber-300 dark:border-amber-800 inline-flex items-center gap-1">
                          <CalendarClock size={10} /> MES PASADO
                        </span>
                      ) : isCuadrado100 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-955 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1">
                          <CheckCircle2 size={10} /> CUADRADO 100% (Descontado de Banco)
                        </span>
                      ) : isIncompleto ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-300 border border-amber-300 dark:border-amber-800 inline-flex items-center gap-1" title="El ticket no coincide al 100%, por lo que este importe permanece pendiente en el banco">
                          <AlertTriangle size={10} /> VINCULACIÓN INCOMPLETA
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          ⏳ Pendiente de Vincular
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 relative">
                        {/* Botón y menú "No es Venta" */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenNoEsVentaId(openNoEsVentaId === m.id ? null : m.id)}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer border ${
                              isNoVenta
                                ? 'bg-rose-600 text-white border-rose-700'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-rose-50'
                            }`}
                            title="Marcar como reembolso, traspaso u otro concepto no operativo"
                          >
                            <Ban size={11} />
                            <span>{isNoVenta ? 'No es Venta ✓' : 'No es Venta'}</span>
                            <ChevronDown size={10} />
                          </button>

                          {openNoEsVentaId === m.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-30 p-1.5 text-left text-xs font-sans">
                              <span className="text-[10px] font-bold text-gray-400 uppercase px-2 py-1 block">
                                Motivo de Exclusión
                              </span>
                              {(['Reembolso de Proveedor', 'Traspaso entre Cuentas', 'Aportación de Socios', 'Ajuste Bancario / Otro'] as const).map(razon => (
                                <button
                                  key={razon}
                                  type="button"
                                  onClick={async () => {
                                    if (toggleNoEsVentaMovement) {
                                      await toggleNoEsVentaMovement(m.id, razon);
                                    }
                                    setOpenNoEsVentaId(null);
                                  }}
                                  className="w-full text-left px-2 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-955/40 text-gray-700 dark:text-gray-200 rounded text-[11px] font-medium flex items-center justify-between"
                                >
                                  <span>{razon}</span>
                                  {m._noVentaRazon === razon && <Check size={12} className="text-rose-600" />}
                                </button>
                              ))}
                              {isNoVenta && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (toggleNoEsVentaMovement) {
                                      await toggleNoEsVentaMovement(m.id, null);
                                    }
                                    setOpenNoEsVentaId(null);
                                  }}
                                  className="w-full text-left px-2 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-955/40 rounded text-[11px] font-bold border-t border-gray-100 dark:border-gray-700 mt-1"
                                >
                                  Quitar "No es Venta"
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Botón Mes Anterior */}
                        <button
                          type="button"
                          onClick={() => toggleExcludeMovement(m.id)}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer border ${
                            isMesPasado
                              ? 'bg-amber-600 text-white border-amber-700'
                              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-amber-50'
                          }`}
                          title="Excluir porque la venta contable corresponde al mes anterior"
                        >
                          {isMesPasado ? 'Mes Pasado ✓' : 'Mes Pasado'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {depositosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400 italic">
                    No se encontraron depósitos con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA 2: CENTRO DE TICKETS DEL MES */}
      {vistaActiva === 'tickets' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-bold text-gray-500 uppercase mr-1 flex items-center gap-1">
                <Filter size={12} /> Filtrar Tickets:
              </span>
              {(['todos', 'cuadrados', 'incompletos', 'sin_vincular'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFiltroTicket(f)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    filtroTicket === f
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {f === 'todos' && `Todos (${ticketsMes.length})`}
                  {f === 'cuadrados' && `✅ Cuadrados 100% (${ticketsMes.filter(t => t._isCuadrado100).length})`}
                  {f === 'incompletos' && `⚠️ Parciales (${ticketsMes.filter(t => t._isParcial).length})`}
                  {f === 'sin_vincular' && 'Sin Vincular'}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-gray-400 font-mono">
              Mostrando {ticketsFiltrados.length} tickets
            </span>
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50/70 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                <th className="p-3">Fecha Ticket</th>
                <th className="p-3">Descripción / Folio</th>
                <th className="p-3 text-right font-black">Base de cuadre</th>
                <th className="p-3 text-right">Monto Depósitos Asociados</th>
                <th className="p-3 text-right">Diferencia</th>
                <th className="p-3 text-center">Estatus Cuadre 100%</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
              {ticketsFiltrados.map((t: any) => {
                const totalVinculado = t._totalVinculado || 0;
                const isCuadrado = !!t._isCuadrado100;
                const isParcial = !!t._isParcial;
                const dif = t._difPendiente || 0;
                const associatedMovs = t._associatedMovs || [];

                return (
                  <tr
                    key={t.id}
                    className={`hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors ${
                      isCuadrado
                        ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                        : isParcial
                        ? 'bg-amber-50/20 dark:bg-amber-950/10'
                        : ''
                    }`}
                  >
                    <td className="p-3 font-mono font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {t.fecha ? new Date(t.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                    </td>
                    <td className="p-3 font-bold text-gray-800 dark:text-gray-200 max-w-xs truncate" title={t.descripcion}>
                      {t.descripcion || 'Ticket de venta'}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                      {formatCurrency(t._montoObjetivoVinculacion ?? t.monto)}
                      {t._esCuadreEfectivo && <span className="block text-[9px] font-sans font-semibold text-emerald-600">Solo efectivo + propina</span>}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-sky-700 dark:text-sky-300">
                      {formatCurrency(totalVinculado)}
                      {associatedMovs.length > 0 && (
                        <span className="text-[10px] text-gray-400 block font-normal">
                          ({associatedMovs.length} depósito{associatedMovs.length > 1 ? 's' : ''})
                        </span>
                      )}
                    </td>
                    <td className={`p-3 text-right font-mono font-bold ${
                      isCuadrado ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {isCuadrado ? '$0.00' : formatCurrency(dif)}
                    </td>
                    <td className="p-3 text-center">
                      {isCuadrado ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-955 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 inline-flex items-center gap-1">
                          <CheckCircle2 size={10} /> CUADRADO 100%
                        </span>
                      ) : isParcial ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-955 dark:text-amber-300 border border-amber-300 dark:border-amber-800 inline-flex items-center gap-1" title="El ticket y sus depósitos difieren; no se descuenta de banco hasta coincidir con exactitud">
                          <AlertTriangle size={10} /> INCOMPLETO (Faltan {formatCurrency(dif)})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          Sin Depósitos
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => openLinkModalForTicket(t)}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold font-sans cursor-pointer shadow-xs inline-flex items-center gap-1"
                      >
                        <Link2 size={11} />
                        <span>Vincular Depósitos</span>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {ticketsFiltrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                    No se encontraron tickets con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* VISTA 3: DESFASE AUTOMÁTICO (TABLA EXISTENTE) */}
      {vistaActiva === 'desfase_auto' && (
        <div className="space-y-4">
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
      )}

      {/* MODAL DE 2 COLUMNAS PARA VINCULACIÓN TICKET-CENTRICA */}
      {activeCompToLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl sm:rounded-3xl w-full h-[96vh] max-w-[98vw] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header del modal */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20">
              <div className="flex items-center gap-2">
                <Link2 className="text-indigo-600 dark:text-indigo-400" size={20} />
                <div>
                  <h4 className="text-sm font-black text-gray-900 dark:text-white">
                    Vinculación Conciliatoria: Ticket con Depósitos Bancarios
                  </h4>
                  <p className="text-xs text-gray-500">
                    Asocia uno o más depósitos de banco a este ticket. Recuerda: solo se descontará del saldo bancario si coinciden al 100%.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveCompToLink(null)}
                className="p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Cuerpo del modal en 2 columnas */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-800 flex-1 overflow-y-auto">
              {/* Columna Izquierda: El Ticket Central */}
              <div className="p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50">
                <div className="border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 bg-white dark:bg-gray-800/90 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      🎫 TICKET CENTRAL (OBJETIVO)
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      ID: {activeCompToLink.id?.substring(0, 8)}
                    </span>
                  </div>

                  <div>
                    <h5 className="text-sm font-bold text-gray-900 dark:text-white">
                      {activeCompToLink.descripcion || 'Ticket de Venta'}
                    </h5>
                    <span className="text-xs text-gray-500 font-mono">
                      Fecha: {activeCompToLink.fecha ? new Date(activeCompToLink.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : 'Sin fecha'}
                    </span>
                  </div>

                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Monto del Ticket:</span>
                    <strong className="text-base font-black font-mono text-indigo-700 dark:text-indigo-300">
                      {formatCurrency(activeCompToLink.monto)}
                    </strong>
                  </div>
                </div>

                {/* Resumen del cuadre en tiempo real */}
                {(() => {
                  const compMonto = activeCompToLink.monto || 0;
                  const selectedMovs = depositosMes.filter(m => selectedLinkMovIds.includes(m.id));
                  const totalSelected = selectedMovs.reduce((acc, m) => acc + (m._monto || 0), 0);
                  const dif = Math.abs(compMonto - totalSelected);
                  const isCuadreExacto = dif < 0.05;

                  return (
                    <div className="space-y-3 font-mono text-xs">
                      <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                        <div className="flex justify-between items-center text-gray-500">
                          <span>Total Depósitos Seleccionados:</span>
                          <strong className="text-sky-600 font-bold">{formatCurrency(totalSelected)}</strong>
                        </div>
                        <div className="flex justify-between items-center text-gray-500">
                          <span>Monto Requerido (Ticket):</span>
                          <strong className="text-indigo-600 font-bold">{formatCurrency(compMonto)}</strong>
                        </div>
                        <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                          <span className="font-bold">Diferencia:</span>
                          <strong className={`font-black ${isCuadreExacto ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {isCuadreExacto ? '✓ $0.00 (100% Cuadrado)' : formatCurrency(dif)}
                          </strong>
                        </div>
                      </div>

                      {/* Advertencia obligatoria si no coincide al 100% */}
                      {!isCuadreExacto && selectedLinkMovIds.length > 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-955/40 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
                          <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={16} />
                          <div>
                            <strong className="block font-bold">⚠️ Advertencia de Cuadre Parcial</strong>
                            <span>
                              El ticket ({formatCurrency(compMonto)}) y los depósitos ({formatCurrency(totalSelected)}) no coinciden al 100% (diferencia de {formatCurrency(dif)}). Si confirmas la vinculación, se marcará con advertencia y <strong>NO se descontará del saldo pendiente en el estado de cuenta</strong> hasta que cuadren exactamente.
                            </span>
                          </div>
                        </div>
                      )}

                      {isCuadreExacto && selectedLinkMovIds.length > 0 && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-955/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-2">
                          <CheckCircle2 className="text-emerald-600 shrink-0" size={16} />
                          <span>
                            <strong>¡Cuadre al 100% perfecto!</strong> Al guardar, este importe se reconocerá como conciliado y se descontará del saldo de depósitos pendientes del estado de cuenta.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Columna Derecha: Selección de Depósitos Bancarios */}
              <div className="p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-gray-500 font-sans flex items-center gap-1">
                    <DollarSign size={12} /> Seleccionar Depósitos Bancarios del Mes
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {selectedLinkMovIds.length} seleccionados
                  </span>
                </div>

                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={linkSearchQuery}
                    onChange={e => setLinkSearchQuery(e.target.value)}
                    placeholder="Filtrar depósitos por concepto o monto..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs bg-gray-50 dark:bg-gray-900"
                  />
                </div>

                <div className="flex-1 overflow-y-auto min-h-[300px] max-h-[60vh] divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                  {depositosMes
                    .filter(m => {
                      if (!linkSearchQuery.trim()) return true;
                      const q = linkSearchQuery.toLowerCase();
                      return (m.concepto || '').toLowerCase().includes(q) || String(m._monto).includes(q);
                    })
                    .map((m: any) => {
                      const isSelected = selectedLinkMovIds.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedLinkMovIds(prev => prev.filter(id => id !== m.id));
                            } else {
                              setSelectedLinkMovIds(prev => [...prev, m.id]);
                            }
                          }}
                          className={`p-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/40'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-indigo-600 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 dark:text-gray-200 truncate" title={m.concepto}>
                                {m.concepto}
                              </p>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {m.fecha ? new Date(m.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                              </span>
                            </div>
                          </div>
                          <strong className="font-mono font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                            {formatCurrency(m._monto)}
                          </strong>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Footer del modal */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2 bg-gray-50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={() => setActiveCompToLink(null)}
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-bold font-sans cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmLink}
                disabled={linkingBatch}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold font-sans cursor-pointer shadow-xs disabled:opacity-50"
              >
                {linkingBatch ? 'Guardando...' : `Confirmar Vinculación (${selectedLinkMovIds.length} depósitos)`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
