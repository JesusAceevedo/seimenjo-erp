'use client';

import React, { useState, useMemo } from 'react';
import {
  Banknote,
  Landmark,
  ArrowRightLeft,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Receipt,
  Building2,
  Filter,
  DollarSign,
  TrendingDown,
  Info,
  ShieldAlert,
  Layers,
  Check,
  RefreshCw,
  Sparkles,
  Link2,
  Unlink,
  X
} from 'lucide-react';

type CashDepositPeriod = 'anterior' | 'actual' | 'siguiente';

const getCashMonthOffset = (monthKey: string, offset: number) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
};

interface CashTicketLink {
  movimiento_id: string;
  monto_asociado?: number | string | null;
}

interface CashTicketRow {
  id: string;
  fecha?: string;
  descripcion?: string;
  monto_efectivo?: number | string | null;
  propina_efectivo?: number | string | null;
  comprobantes_deposito_movimientos?: CashTicketLink[];
  _cashBase: number;
  _cashTip: number;
  _cashTotal: number;
  _cashLinks: CashTicketLink[];
  _cashLinked: number;
  _cashPending: number;
  _cashSalesPeriod: 'actual' | 'anterior';
}

interface CashCarryForwardRecord {
  id: string;
  fecha?: string;
  descripcion?: string;
  montoEfectivo?: number;
  propinaEfectivo?: number;
  montoPendiente: number;
}

interface CashDepositMovement {
  id: string;
  fecha?: string;
  concepto?: string;
  referencia?: string;
  deposito?: number | string | null;
  monto?: number | string | null;
  _cashPeriod: CashDepositPeriod;
  _cashAmount: number;
  _cashLinked: number;
  _cashAvailable: number;
  _isArrastre?: boolean;
  _razonArrastre?: string;
}

interface ArqueoEfectivoTabProps {
  comprobantes?: any[];
  movimientos?: any[];
  cuentasBancarias?: any[];
  selectedMonth?: string;
  cashDepositId?: string;
  cashTicketId?: string;
  gastos?: any[];
  token?: string;
  onReloadMovimientos?: () => void;
  onVincularComprobante?: (comprobanteId: string, movimientoId: string, montoAsociado?: number) => Promise<{ success: boolean; error?: string }>;
  onDesvincularComprobante?: (comprobanteId: string, movimientoId?: string | null) => Promise<{ success: boolean; error?: string }>;
}

export function ArqueoEfectivoTab({
  comprobantes = [],
  movimientos = [],
  cuentasBancarias = [],
  selectedMonth = '',
  cashDepositId,
  cashTicketId,
  gastos = [],
  onReloadMovimientos,
  onVincularComprobante,
  onDesvincularComprobante
}: ArqueoEfectivoTabProps) {
  const cashNavigationTarget = cashDepositId
    ? { depositId: cashDepositId, ticketId: cashTicketId || '' }
    : null;
  const [activeSubView, setActiveSubView] = useState<'resumen' | 'diario' | 'movimientos' | 'tickets'>(() =>
    cashNavigationTarget ? 'movimientos' : 'resumen'
  );
  const [activeCashDeposit, setActiveCashDeposit] = useState<CashDepositMovement | null>(null);
  const [dismissedNavigationDepositId, setDismissedNavigationDepositId] = useState('');
  const [selectedCashTicketIds, setSelectedCashTicketIds] = useState<Set<string>>(new Set());
  const [savingCashAssignments, setSavingCashAssignments] = useState(false);
  const [cashCarryForwardByMonth, setCashCarryForwardByMonth] = useState<Record<string, CashCarryForwardRecord[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('seimenjo_efectivo_pendiente_siguiente_mes') || '{}');
    } catch {
      return {};
    }
  });

  const allPeriodsStorageKey = 'seimenjo_periodo_depositos_efectivo';
  const storageKey = `seimenjo_arrastre_efectivo_${selectedMonth || 'global'}`;
  const [cashDepositPeriodsByMonth, setCashDepositPeriodsByMonth] = useState<Record<string, Record<string, CashDepositPeriod>>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(allPeriodsStorageKey);
      const parsed = saved ? JSON.parse(saved) : {};
      const legacyIds: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const monthKey = selectedMonth || 'global';
      const legacyMap = Object.fromEntries(legacyIds.map(id => [id, 'anterior' as CashDepositPeriod]));
      return { ...parsed, [monthKey]: { ...legacyMap, ...(parsed[monthKey] || {}) } };
    } catch {
      return {};
    }
  });

  const currentMonthKey = selectedMonth || 'global';
  const currentCashDepositPeriods = cashDepositPeriodsByMonth[currentMonthKey] || {};
  const legacyArrastreIds = useMemo(() => {
    if (typeof window === 'undefined') return new Set<string>();
    try {
      return new Set<string>(JSON.parse(localStorage.getItem(storageKey) || '[]'));
    } catch {
      return new Set<string>();
    }
  }, [storageKey]);

  const setCashDepositPeriod = (id: string, period: CashDepositPeriod) => {
    setCashDepositPeriodsByMonth(previous => {
      const next = { ...previous, [currentMonthKey]: { ...(previous[currentMonthKey] || {}), [id]: period } };
      localStorage.setItem(allPeriodsStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const formatCurrency = (val: number | string | null | undefined) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(num);
  };

  const esMovimientoEfectivo = (concepto: string = ''): boolean => {
    const c = concepto.toUpperCase();
    if (['RETIRO', 'CARGO', 'DISP.', 'DISPOSICIÓN', 'DISPOSICION'].some(term => c.includes(term))) return false;
    return c.includes('EFECTIVO') || c.includes('CAJERO') || c.includes('DEPOSITO CAJERO') || c.includes('PRACTICAJA') || c.includes('VENTANILLA');
  };

  // Helper de detección automática de desfase de mes
  const checkIsOtherMonthAuto = (item: { fecha?: string; concepto?: string; descripcion?: string }) => {
    if (!selectedMonth) return { isOtherMonth: false, razon: '' };
    const desc = ((item.concepto || '') + ' ' + (item.descripcion || '')).toLowerCase();
    
    const meses = [
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

    const currentMesNum = selectedMonth.split('-')[1];

    for (const m of meses) {
      if (m.num !== currentMesNum && desc.includes(m.name)) {
        return {
          isOtherMonth: true,
          razon: `Menciona en concepto "${m.name.toUpperCase()}"`
        };
      }
    }

    // Si el depósito es del día 1 o 2 del mes, suele ser arrastre de la venta del último fin de semana del mes anterior
    if (item.fecha) {
      const parts = item.fecha.split('T')[0].split('-');
      if (parts.length === 3) {
        const dia = parseInt(parts[2], 10);
        if (dia <= 2) {
          return {
            isOtherMonth: true,
            razon: `Depósito en día ${dia} (Posible arrastre de fin de mes anterior)`
          };
        }
      }
    }

    return { isOtherMonth: false, razon: '' };
  };

  // 1. Filtrar cortes de Parrot con desglose de efectivo para el mes seleccionado
  const ticketsEfectivoMes = useMemo(() => {
    return comprobantes.filter(c => {
      if (c.tipo === 'deposito_ventanilla') return false;
      const mes = c.fecha ? c.fecha.substring(0, 7) : '';
      if (selectedMonth && mes !== selectedMonth) return false;
      const efec = Number(c.monto_efectivo || 0) + Number(c.propina_efectivo || 0);
      return efec > 0;
    });
  }, [comprobantes, selectedMonth]);

  const totalVentasEfectivoParrot = useMemo(() => {
    return ticketsEfectivoMes.reduce((acc, c) => {
      const mEfec = Number(c.monto_efectivo || 0);
      const pEfec = Number(c.propina_efectivo || 0);
      return acc + mEfec + pEfec;
    }, 0);
  }, [ticketsEfectivoMes]);

  const totalPropinaEfectivoParrot = useMemo(() => {
    return ticketsEfectivoMes.reduce((acc, c) => acc + Number(c.propina_efectivo || 0), 0);
  }, [ticketsEfectivoMes]);

  // 2. Filtrar depósitos bancarios de efectivo en BBVA del mes seleccionado
  const depositosEfectivoBanco = useMemo<CashDepositMovement[]>(() => {
    return movimientos.filter(m => {
      const isDep = m.tipo_movimiento === 'Deposito' || Number(m.deposito || 0) > 0 || Number(m.monto || 0) > 0;
      if (!isDep) return false;
      const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
      if (selectedMonth && mes !== selectedMonth) return false;
      const accountName = (m.cuentas_bancarias?.nombre || cuentasBancarias.find(account => account.id === m.cuenta_bancaria_id)?.nombre || '').toUpperCase();
      if (accountName && !accountName.includes('BBVA') && !accountName.includes('BANCOMER')) return false;
      return esMovimientoEfectivo(m.concepto || '');
    }).map(m => {
      const autoCheck = checkIsOtherMonthAuto(m);
      const period = currentCashDepositPeriods[m.id] || (legacyArrastreIds.has(m.id) || autoCheck.isOtherMonth ? 'anterior' : 'actual');
      const cashAmount = Math.abs(Number(m.deposito || m.monto || 0));
      const linkedAmount = comprobantes.reduce((sum, comprobante) => {
        const relation = (comprobante.comprobantes_deposito_movimientos || []).find((item: CashTicketLink) => item.movimiento_id === m.id);
        if (!relation) return sum;
        const ticketCashAmount = Number(comprobante.monto_efectivo || 0) + Number(comprobante.propina_efectivo || 0);
        return sum + Math.min(ticketCashAmount, Number(relation.monto_asociado || 0));
      }, 0);
      return {
        ...m,
        _cashAmount: cashAmount,
        _cashLinked: linkedAmount,
        _cashAvailable: Math.max(0, cashAmount - linkedAmount),
        _cashPeriod: period,
        _isArrastre: period === 'anterior',
        _razonArrastre: autoCheck.razon || (legacyArrastreIds.has(m.id) ? 'Marcado manualmente como arrastre' : '')
      };
    });
  }, [movimientos, comprobantes, selectedMonth, currentCashDepositPeriods, legacyArrastreIds, cuentasBancarias]);

  const navigationCashDeposit = cashNavigationTarget
    ? depositosEfectivoBanco.find(item => item.id === cashNavigationTarget.depositId) || null
    : null;
  const activeCashDepositForModal = activeCashDeposit || (
    navigationCashDeposit?.id !== dismissedNavigationDepositId ? navigationCashDeposit : null
  );

  const totalDepositosEfectivoBanco = useMemo(() => {
    return depositosEfectivoBanco.reduce((acc, m) => acc + Math.abs(Number(m.deposito || m.monto || 0)), 0);
  }, [depositosEfectivoBanco]);

  // Depósitos catalogados como arrastre del mes anterior
  const depositosArrastreMesAnterior = useMemo(() => {
    return depositosEfectivoBanco
      .filter(m => m._cashPeriod === 'anterior')
      .reduce((acc, m) => acc + Math.abs(Number(m.deposito || m.monto || 0)), 0);
  }, [depositosEfectivoBanco]);

  const depositosMesSiguiente = useMemo(() => {
    return depositosEfectivoBanco
      .filter(m => m._cashPeriod === 'siguiente')
      .reduce((acc, m) => acc + Math.abs(Number(m.deposito || m.monto || 0)), 0);
  }, [depositosEfectivoBanco]);

  // Depósitos acreditados correspondientes a las ventas de este mes
  const depositosEfectivoAcreditadosEsteMes = useMemo(() => {
    return depositosEfectivoBanco
      .filter(m => m._cashPeriod === 'actual')
      .reduce((acc, m) => acc + Math.abs(Number(m.deposito || m.monto || 0)), 0);
  }, [depositosEfectivoBanco]);

  const cashTicketRows = useMemo<CashTicketRow[]>(() => {
    const cashDepositIds = new Set(depositosEfectivoBanco.filter(m => m._cashPeriod === 'actual').map(m => m.id));
    return ticketsEfectivoMes.map(ticket => {
      const efectivo = Number(ticket.monto_efectivo || 0);
      const propina = Number(ticket.propina_efectivo || 0);
      const total = efectivo + propina;
      const cashLinks = (ticket.comprobantes_deposito_movimientos || []).filter((relation: CashTicketLink) => cashDepositIds.has(relation.movimiento_id));
      const linked = Math.min(total, cashLinks.reduce((sum: number, relation: CashTicketLink) => sum + Number(relation.monto_asociado || 0), 0));
      return {
        ...ticket,
        _cashBase: efectivo,
        _cashTip: propina,
        _cashTotal: total,
        _cashLinks: cashLinks,
        _cashLinked: linked,
        _cashPending: Math.max(0, total - linked),
        _cashSalesPeriod: 'actual' as const
      };
    });
  }, [ticketsEfectivoMes, depositosEfectivoBanco]);

  const previousSalesMonth = getCashMonthOffset(selectedMonth, -1);
  const previousCashTicketRecords = cashCarryForwardByMonth[previousSalesMonth] || [];
  const carryForwardCashRows = useMemo<CashTicketRow[]>(() => {
    const previousDepositIds = new Set(depositosEfectivoBanco.filter(deposit => deposit._cashPeriod === 'anterior').map(deposit => deposit.id));
    return previousCashTicketRecords.map(record => {
      const ticket = comprobantes.find(item => item.id === record.id);
      const cashLinks = ((ticket?.comprobantes_deposito_movimientos || []) as CashTicketLink[])
        .filter(relation => previousDepositIds.has(relation.movimiento_id));
      const linked = cashLinks.reduce((sum, relation) => sum + Number(relation.monto_asociado || 0), 0);
      return {
        id: record.id,
        fecha: record.fecha || ticket?.fecha,
        descripcion: record.descripcion || ticket?.descripcion,
        _cashBase: Number(record.montoEfectivo || record.montoPendiente),
        _cashTip: Number(record.propinaEfectivo || 0),
        _cashTotal: Number(record.montoPendiente),
        _cashLinks: cashLinks,
        _cashLinked: Math.min(Number(record.montoPendiente), linked),
        _cashPending: Math.max(0, Number(record.montoPendiente) - linked),
        _cashSalesPeriod: 'anterior' as const
      };
    }).filter(ticket => ticket._cashPending > 0.005);
  }, [previousCashTicketRecords, comprobantes, depositosEfectivoBanco]);

  const visibleCashTicketRows = [...carryForwardCashRows, ...cashTicketRows];
  const eligibleCashTicketRows = activeCashDepositForModal?._cashPeriod === 'anterior'
    ? carryForwardCashRows
    : activeCashDepositForModal?._cashPeriod === 'actual'
      ? cashTicketRows
      : [];
  const selectedCashTicketRows = eligibleCashTicketRows.filter(ticket => selectedCashTicketIds.has(ticket.id));
  const selectedCashTicketTotal = selectedCashTicketRows.reduce((sum, ticket) => sum + ticket._cashPending, 0);
  const refreshedActiveCashDeposit = activeCashDepositForModal
    ? depositosEfectivoBanco.find(deposit => deposit.id === activeCashDepositForModal.id) || activeCashDepositForModal
    : null;
  const activeDepositPending = refreshedActiveCashDeposit
    ? Math.max(0, refreshedActiveCashDeposit._cashAmount - refreshedActiveCashDeposit._cashLinked)
    : 0;
  const cashAssignmentDifference = activeDepositPending - selectedCashTicketTotal;
  const activeCashLinkedTickets = eligibleCashTicketRows.filter(ticket =>
    activeCashDepositForModal && ticket._cashLinks.some(link => link.movimiento_id === activeCashDepositForModal.id)
  );

  const openCashDeposit = (deposit: CashDepositMovement) => {
    setActiveCashDeposit(deposit);
    setSelectedCashTicketIds(new Set());
  };

  const unlinkCashTicket = async (ticket: CashTicketRow) => {
    if (!activeCashDepositForModal || !onDesvincularComprobante) return;
    if (!window.confirm(`¿Quitar el vínculo de "${ticket.descripcion || 'este corte'}" con este depósito?`)) return;

    const result = await onDesvincularComprobante(ticket.id, activeCashDepositForModal.id);
    if (!result?.success) {
      alert(result?.error || 'No se pudo quitar el vínculo.');
      return;
    }
    await onReloadMovimientos?.();
  };

  const saveCashAssignments = async () => {
    if (!activeCashDepositForModal || !onVincularComprobante || Math.abs(cashAssignmentDifference) > 0.05 || selectedCashTicketRows.length === 0) return;
    setSavingCashAssignments(true);
    try {
      for (const ticket of selectedCashTicketRows) {
        const result = await onVincularComprobante(ticket.id, activeCashDepositForModal.id, Number(ticket._cashPending.toFixed(2)));
        if (result && !result.success) throw new Error(result.error || 'No se pudo vincular el ticket.');
      }
      setActiveCashDeposit(null);
      setDismissedNavigationDepositId(cashNavigationTarget?.depositId || '');
      setSelectedCashTicketIds(new Set());
      onReloadMovimientos?.();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'No se pudieron guardar las asignaciones.');
    } finally {
      setSavingCashAssignments(false);
    }
  };

  const closeCashDepositModal = () => {
    setActiveCashDeposit(null);
    setDismissedNavigationDepositId(cashNavigationTarget?.depositId || '');
  };

  const saveUnassignedCashTicketsForNextMonth = () => {
    const records = visibleCashTicketRows
      .filter(ticket => ticket._cashPending > 0.005)
      .map(ticket => ({
        id: ticket.id,
        fecha: ticket.fecha,
        descripcion: ticket.descripcion,
        montoEfectivo: ticket._cashBase,
        propinaEfectivo: ticket._cashTip,
        montoPendiente: Number(ticket._cashPending.toFixed(2))
      }));
    const next = { ...cashCarryForwardByMonth, [currentMonthKey]: records };
    setCashCarryForwardByMonth(next);
    localStorage.setItem('seimenjo_efectivo_pendiente_siguiente_mes', JSON.stringify(next));
    alert(`${records.length} ticket(s) pendientes quedaron listos para conciliarse contra depósitos del mes siguiente.`);
  };

  // 3. Gastos menores pagados en efectivo (Caja Chica)
  const gastosEfectivoMes = useMemo(() => {
    return gastos.filter(g => {
      const mes = g.fecha_gasto ? g.fecha_gasto.substring(0, 7) : (g.fecha ? g.fecha.substring(0, 7) : '');
      if (selectedMonth && mes !== selectedMonth) return false;
      const met = (g.metodo_pago || g.formas_pago?.codigo || '').toLowerCase();
      return met.includes('efectivo') || met === '01';
    });
  }, [gastos, selectedMonth]);

  const totalGastosEfectivo = useMemo(() => {
    return gastosEfectivoMes.reduce((acc, g) => acc + Number(g.monto || 0), 0);
  }, [gastosEfectivoMes]);

  // Total de efectivo justificado (Depósitos del mes + Gastos en efectivo pagados con la venta)
  const totalEfectivoJustificado = useMemo(() => {
    return depositosEfectivoAcreditadosEsteMes + totalGastosEfectivo;
  }, [depositosEfectivoAcreditadosEsteMes, totalGastosEfectivo]);

  // Saldo que falta por depositar en el banco
  const saldoPendientePorDepositar = useMemo(() => {
    const dif = totalVentasEfectivoParrot - totalEfectivoJustificado;
    return Math.max(0, dif);
  }, [totalVentasEfectivoParrot, totalEfectivoJustificado]);

  const porcentajeDepositado = useMemo(() => {
    if (totalVentasEfectivoParrot <= 0) return 100;
    return Math.min(100, Math.round((totalEfectivoJustificado / totalVentasEfectivoParrot) * 100));
  }, [totalEfectivoJustificado, totalVentasEfectivoParrot]);

  // 4. Desglose cronológico día a día (Arqueo Diario)
  const dailyCashRows = useMemo(() => {
    const dailyMap: Record<string, {
      fecha: string;
      ventasEfectivo: number;
      depositosBanco: number;
      gastosEfectivo: number;
    }> = {};

    ticketsEfectivoMes.forEach(c => {
      const f = c.fecha ? c.fecha.split('T')[0] : '';
      if (!f) return;
      if (!dailyMap[f]) {
        dailyMap[f] = { fecha: f, ventasEfectivo: 0, depositosBanco: 0, gastosEfectivo: 0 };
      }
      dailyMap[f].ventasEfectivo += (Number(c.monto_efectivo || 0) + Number(c.propina_efectivo || 0));
    });

    depositosEfectivoBanco.forEach(m => {
      if (m._cashPeriod !== 'actual') return;
      const f = m.fecha ? m.fecha.split('T')[0] : '';
      if (!f) return;
      if (!dailyMap[f]) {
        dailyMap[f] = { fecha: f, ventasEfectivo: 0, depositosBanco: 0, gastosEfectivo: 0 };
      }
      dailyMap[f].depositosBanco += Math.abs(Number(m.deposito || m.monto || 0));
    });

    gastosEfectivoMes.forEach(g => {
      const f = (g.fecha_gasto || g.fecha || '').split('T')[0];
      if (!f) return;
      if (!dailyMap[f]) {
        dailyMap[f] = { fecha: f, ventasEfectivo: 0, depositosBanco: 0, gastosEfectivo: 0 };
      }
      dailyMap[f].gastosEfectivo += Number(g.monto || 0);
    });

    let runningAccumulated = 0;
    const sorted = Object.values(dailyMap).sort((a, b) => a.fecha.localeCompare(b.fecha));

    return sorted.map(row => {
      const justificadoDia = row.depositosBanco + row.gastosEfectivo;
      const diferenciaDia = row.ventasEfectivo - justificadoDia;
      runningAccumulated += diferenciaDia;
      return {
        ...row,
        justificadoDia,
        diferenciaDia,
        saldoAcumulado: Math.max(0, runningAccumulated)
      };
    }).reverse();
  }, [ticketsEfectivoMes, depositosEfectivoBanco, gastosEfectivoMes]);

  return (
    <div className="flex flex-col gap-5 font-sans h-full overflow-y-auto pr-1 pb-10">
      
      {/* HEADER DE CONTROL Y ARQUEO */}
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-955/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Banknote size={20} />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                Control y Arqueo de Efectivo (Parrot POS ➔ BBVA)
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Efectivo y propinas de cada corte Parrot conciliados únicamente contra depósitos de efectivo en BBVA.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
            <button
              onClick={() => setActiveSubView('resumen')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubView === 'resumen'
                  ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Layers size={13} className="inline mr-1" /> Resumen & Cuadre
            </button>
            <button
              onClick={() => setActiveSubView('diario')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubView === 'diario'
                  ? 'bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Calendar size={13} className="inline mr-1" /> Flujo Diario ({dailyCashRows.length} días)
            </button>
            <button
              onClick={() => setActiveSubView('tickets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubView === 'tickets'
                  ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Receipt size={13} className="inline mr-1" /> Tickets efectivo ({visibleCashTicketRows.length})
            </button>
            <button
              onClick={() => setActiveSubView('movimientos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubView === 'movimientos'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Landmark size={13} className="inline mr-1" /> Depósitos Banco ({depositosEfectivoBanco.length})
            </button>
          </div>
        </div>

        {/* TARJETAS PRINCIPALES DE ARQUEO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          
          {/* Card 1: Venta Efectivo Parrot */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Venta Efectivo Parrot</span>
              <Banknote size={16} />
            </div>
            <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalVentasEfectivoParrot)}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex justify-between">
              <span>{ticketsEfectivoMes.length} cortes registrados</span>
              {totalPropinaEfectivoParrot > 0 && <span>Propina: {formatCurrency(totalPropinaEfectivoParrot)}</span>}
            </div>
          </div>

          {/* Card 2: Depósitos Acreditados en BBVA */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-300 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Depósitos Efectivo en BBVA</span>
              <Landmark size={16} />
            </div>
            <div className="text-xl font-black font-mono text-blue-600 dark:text-blue-400">
              {formatCurrency(depositosEfectivoAcreditadosEsteMes)}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex justify-between">
              <span>{depositosEfectivoBanco.filter(m => m._cashPeriod === 'actual').length} abonos de este mes</span>
              {depositosArrastreMesAnterior > 0 && (
                <span className="text-purple-600 dark:text-purple-400 font-bold" title="Arrastre del mes anterior excluido">
                  Arrastre: -{formatCurrency(depositosArrastreMesAnterior)}
                </span>
              )}
              {depositosMesSiguiente > 0 && <span className="text-sky-600 dark:text-sky-400 font-bold">Mes siguiente: {formatCurrency(depositosMesSiguiente)}</span>}
            </div>
          </div>

          {/* Card 3: Gastos Pagados en Efectivo (Caja Chica) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
            <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">Compras en Efectivo (Caja)</span>
              <Receipt size={16} />
            </div>
            <div className="text-xl font-black font-mono text-purple-600 dark:text-purple-400">
              {formatCurrency(totalGastosEfectivo)}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              {gastosEfectivoMes.length} compras pagadas con efectivo de caja
            </div>
          </div>

          {/* Card 4: Falta por Depositar / Saldo en Caja */}
          <div className={`p-4 rounded-xl border ${
            saldoPendientePorDepositar > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider">
                {saldoPendientePorDepositar > 0 ? 'Falta por Depositar / En Caja' : 'Efectivo 100% Cuadrado'}
              </span>
              {saldoPendientePorDepositar > 0 ? <AlertTriangle size={16} className="text-amber-500" /> : <CheckCircle2 size={16} className="text-emerald-500" />}
            </div>
            <div className={`text-xl font-black font-mono ${
              saldoPendientePorDepositar > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {formatCurrency(saldoPendientePorDepositar)}
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 flex justify-between">
              <span>{porcentajeDepositado}% justificado</span>
              <span>{saldoPendientePorDepositar > 0 ? 'Pendiente en local' : 'Completado'}</span>
            </div>
          </div>

        </div>

      </div>

      {/* VISTA 1: RESUMEN Y CUADRE MATEMÁTICO */}
      {activeSubView === 'resumen' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Columna Izquierda: Ecuación de Conciliación */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <ArrowRightLeft size={15} className="text-emerald-500" /> Ecuación de Cuadre de Efectivo
            </h4>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-955/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">(+)</span>
                  <span className="font-sans font-semibold text-gray-800 dark:text-gray-200">Total Venta en Efectivo (Parrot POS):</span>
                </div>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatCurrency(totalVentasEfectivoParrot)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-955/60 text-blue-700 dark:text-blue-400 font-bold text-[10px]">(-)</span>
                  <span className="font-sans font-semibold text-gray-800 dark:text-gray-200">Depósitos Bancarios Acreditados en BBVA (Este Mes):</span>
                </div>
                <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                  -{formatCurrency(depositosEfectivoAcreditadosEsteMes)}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-955/60 text-purple-700 dark:text-purple-400 font-bold text-[10px]">(-)</span>
                  <span className="font-sans font-semibold text-gray-800 dark:text-gray-200">Compras de Insumos/Cocina pagadas en Efectivo:</span>
                </div>
                <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                  -{formatCurrency(totalGastosEfectivo)}
                </span>
              </div>

              <div className="h-px bg-gray-200 dark:bg-gray-800 my-2" />

              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 dark:bg-amber-955/30 border border-amber-200 dark:border-amber-900/40">
                <div>
                  <span className="font-sans font-black text-xs text-amber-900 dark:text-amber-200 block">
                    (=) Efectivo Pendiente de Depositar (Saldo Físico Restante):
                  </span>
                  <span className="font-sans text-[10px] text-amber-700 dark:text-amber-400">
                    Dinero en el local que aún no ha entrado al banco o se depositará en el siguiente mes
                  </span>
                </div>
                <span className="font-bold text-amber-600 dark:text-amber-400 text-base">
                  {formatCurrency(saldoPendientePorDepositar)}
                </span>
              </div>
            </div>

            {/* Aclaración sobre el estado de cuenta */}
            <div className="p-3 bg-blue-50/50 dark:bg-blue-955/20 border border-blue-200/60 dark:border-blue-900/30 rounded-xl text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
              <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Integración con el Estado de Cuenta de BBVA:</span>
                El importe de tu estado de cuenta bancario ya contiene una parte de este efectivo depositado mediante practicajas. Al marcar los depósitos como <strong>Traspaso</strong>, se amortiza el saldo de Caja Chica y se evita duplicar las ventas de comensales.
              </div>
            </div>
          </div>

          {/* Columna Derecha: Control de Desfase entre Meses */}
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
                <Clock size={15} className="text-purple-500" /> Desfase Temporal entre Meses
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                El dinero depositado los primeros días del mes suele ser la recaudación del fin de semana anterior.
              </p>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                  <span className="text-[10px] font-sans font-bold text-gray-400 uppercase block mb-1">
                    Depósitos de Arrastre (Mes Anterior)
                  </span>
                  <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                    {formatCurrency(depositosArrastreMesAnterior)}
                  </div>
                  <span className="text-[10px] font-sans text-gray-500 block mt-0.5">
                    {depositosEfectivoBanco.filter(m => m._isArrastre).length} depósitos no atribuibles a ventas de este mes
                  </span>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                  <span className="text-[10px] font-sans font-bold text-gray-400 uppercase block mb-1">
                    Total Depósitos Brutos BBVA (Efectivo)
                  </span>
                  <div className="text-lg font-black text-gray-900 dark:text-white">
                    {formatCurrency(totalDepositosEfectivoBanco)}
                  </div>
                  <span className="text-[10px] font-sans text-gray-500 block mt-0.5">
                    Sumatoria de todos los abonos de practicaja/ventanilla
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveSubView('movimientos')}
              className="mt-4 w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Ver y Clasificar Depósitos de Arrastre</span>
              <ChevronDown size={14} />
            </button>
          </div>

        </div>
      )}

      {activeSubView === 'tickets' && (
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-gray-50/70 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Receipt size={14} className="text-emerald-600" /> Cortes Parrot · solo efectivo
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5">Se muestran únicamente monto_efectivo y propina_efectivo; no se usan importes de tarjeta ni el total completo del POS.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 uppercase font-bold text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Corte</th>
                  <th className="p-3 text-right">Efectivo</th>
                  <th className="p-3 text-right">Propina efectivo</th>
                  <th className="p-3 text-right">Total efectivo</th>
                  <th className="p-3 text-right">Vinculado BBVA</th>
                  <th className="p-3 text-right">Pendiente</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {visibleCashTicketRows.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400 italic">No hay ventas en efectivo pendientes o registradas en este período.</td></tr>
                ) : visibleCashTicketRows.map(ticket => (
                  <tr key={ticket.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="p-3 whitespace-nowrap font-mono">{ticket.fecha ? String(ticket.fecha).slice(0, 10) : 'S/F'}</td>
                    <td className="p-3">
                      <span className="block font-bold text-emerald-700 dark:text-emerald-300">Corte de efectivo Parrot</span>
                      <span className="block text-[10px] text-gray-500 max-w-sm truncate" title={ticket.descripcion}>{ticket.descripcion || 'Desglose efectivo del ticket'}</span>
                    </td>
                    <td className="p-3 text-right font-mono">{formatCurrency(ticket._cashBase)}</td>
                    <td className="p-3 text-right font-mono">{formatCurrency(ticket._cashTip)}</td>
                    <td className="p-3 text-right font-mono font-bold">{formatCurrency(ticket._cashTotal)}</td>
                    <td className="p-3 text-right font-mono text-emerald-600">{formatCurrency(ticket._cashLinked)}</td>
                    <td className="p-3 text-right font-mono font-bold text-amber-600">{formatCurrency(ticket._cashPending)}</td>
                    <td className="p-3 text-center">
                      <span className={`text-[10px] font-bold ${ticket._cashPending > 0.005 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {ticket._cashPending > 0.005 ? ticket._cashSalesPeriod === 'actual' ? 'Pasa al siguiente mes' : 'Arrastre pendiente' : 'Asignado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubView === 'tickets' && visibleCashTicketRows.some(ticket => ticket._cashPending > 0.005) && (
        <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-amber-900 dark:text-amber-200">
            {visibleCashTicketRows.filter(ticket => ticket._cashPending > 0.005).length} ticket(s) sin depósito · {formatCurrency(visibleCashTicketRows.reduce((sum, ticket) => sum + ticket._cashPending, 0))} quedarán como arrastre para el mes siguiente.
          </span>
          <button type="button" onClick={saveUnassignedCashTicketsForNextMonth} className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold">
            Pasar pendientes al siguiente mes
          </button>
        </div>
      )}

      {activeCashDepositForModal && (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Asignar tickets a depósito de efectivo">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-black flex items-center gap-2"><Link2 size={16} className="text-blue-600" /> Asignar tickets a depósito de efectivo</h4>
                <p className="text-xs text-gray-500 mt-1">{String(activeCashDepositForModal.fecha || '').slice(0, 10)} · {activeCashDepositForModal.concepto || 'Depósito BBVA'} · Total depósito: <strong>{formatCurrency(activeCashDepositForModal._cashAmount)}</strong></p>
              </div>
              <button type="button" onClick={closeCashDepositModal} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Cerrar"><X size={17} /></button>
            </div>
            <div className="p-4 overflow-auto space-y-4">
              {activeCashLinkedTickets.length > 0 && (
                <section>
                  <h5 className="text-[10px] font-black uppercase text-gray-500 mb-2">Tickets ya vinculados a este depósito</h5>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg">
                    {activeCashLinkedTickets.map(ticket => {
                      const linkedAmount = ticket._cashLinks
                        .filter(link => link.movimiento_id === activeCashDepositForModal.id)
                        .reduce((sum, link) => sum + Number(link.monto_asociado || 0), 0);
                      const isFocused = ticket.id === cashNavigationTarget?.ticketId;
                      return (
                        <div key={ticket.id} className={`p-3 flex items-center gap-3 ${isFocused ? 'bg-amber-50 dark:bg-amber-950/30' : ''}`}>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold truncate">{ticket.descripcion || 'Corte de efectivo Parrot'}</span>
                            <span className="block text-[10px] text-gray-500">
                              Efectivo del corte: {formatCurrency(ticket._cashTotal)} · De este depósito: {formatCurrency(linkedAmount)} · Pendiente del corte: {formatCurrency(ticket._cashPending)}
                            </span>
                          </span>
                          {isFocused && <span className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">Ticket seleccionado</span>}
                          {onDesvincularComprobante && (
                            <button type="button" onClick={() => unlinkCashTicket(ticket)} className="shrink-0 px-2 py-1 rounded border border-rose-200 text-[10px] font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300">
                              Quitar vínculo
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              <section>
                <div className="flex justify-between gap-3 mb-2">
                  <h5 className="text-[10px] font-black uppercase text-gray-500">Tickets disponibles · {activeCashDepositForModal._cashPeriod === 'anterior' ? 'arrastre mes anterior' : 'ventas de este mes'}</h5>
                  <span className="text-xs font-mono text-blue-700 dark:text-blue-300">Saldo del depósito: {formatCurrency(activeDepositPending)}</span>
                </div>
                <div className="max-h-[45vh] overflow-auto divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-lg">
                  {eligibleCashTicketRows.filter(ticket => ticket._cashPending > 0.005 && !ticket._cashLinks.some(link => link.movimiento_id === activeCashDepositForModal.id)).map(ticket => {
                    const isSelected = selectedCashTicketIds.has(ticket.id);
                    return (
                      <label key={ticket.id} className={`p-3 flex items-center gap-3 cursor-pointer ${isSelected ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                        <input type="checkbox" checked={isSelected} onChange={() => setSelectedCashTicketIds(previous => {
                          const next = new Set(previous);
                          if (next.has(ticket.id)) next.delete(ticket.id); else next.add(ticket.id);
                          return next;
                        })} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-bold truncate">{ticket.descripcion || 'Corte de efectivo Parrot'}</span>
                          <span className="block text-[10px] text-gray-500">{String(ticket.fecha || '').slice(0, 10)} · {ticket._cashSalesPeriod === 'anterior' ? 'Arrastre' : 'Este mes'}</span>
                        </span>
                        <span className="text-right font-mono text-xs font-black">{formatCurrency(ticket._cashPending)}</span>
                      </label>
                    );
                  })}
                  {eligibleCashTicketRows.filter(ticket => ticket._cashPending > 0.005 && !ticket._cashLinks.some(link => link.movimiento_id === activeCashDepositForModal.id)).length === 0 && <p className="p-5 text-center text-xs text-gray-400">No hay tickets de efectivo pendientes para este depósito.</p>}
                </div>
              </section>
              <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${Math.abs(cashAssignmentDifference) <= 0.05 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <div><span className="text-xs font-black block">Diferencia de esta asignación de efectivo</span><span className="text-[10px]">Saldo por asignar del depósito menos efectivo de tickets seleccionados; no compara la venta total del corte.</span></div>
                <strong className="font-mono text-right">Depósito pendiente {formatCurrency(activeDepositPending)} − tickets nuevos {formatCurrency(selectedCashTicketTotal)} = {formatCurrency(cashAssignmentDifference)}</strong>
              </div>
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
              <span className="text-[10px] text-gray-500">Tickets pendientes sin depósito se pueden pasar al siguiente mes desde la pestaña de tickets.</span>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={closeCashDepositModal} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-xs font-bold">Cerrar</button>
                <button type="button" onClick={saveCashAssignments} disabled={savingCashAssignments || selectedCashTicketRows.length === 0 || Math.abs(cashAssignmentDifference) > 0.05} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">
                  {savingCashAssignments ? 'Guardando...' : 'Confirmar suma exacta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: ARQUEO DÍA POR DÍA (FLUJO CRONOLÓGICO) */}
      {activeSubView === 'diario' && (
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 bg-gray-50/70 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Calendar size={14} className="text-amber-500" /> Arqueo Cronológico Diario de Efectivo
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Comparativa diaria entre venta registrada en comanda y dinero ingresado al banco o utilizado para compras.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-gray-500">
              {dailyCashRows.length} días con actividad
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 uppercase font-bold text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <th className="p-3">Fecha</th>
                  <th className="p-3 text-right">Venta Efectivo Parrot</th>
                  <th className="p-3 text-right">Depósito BBVA</th>
                  <th className="p-3 text-right">Compras Efectivo</th>
                  <th className="p-3 text-right font-bold">Total Justificado</th>
                  <th className="p-3 text-right">Diferencia Jornada</th>
                  <th className="p-3 text-right font-bold text-amber-600 dark:text-amber-400">Saldo Pendiente Acumulado</th>
                  <th className="p-3 text-center">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                {dailyCashRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400 font-sans italic">
                      No hay registros de efectivo en este período.
                    </td>
                  </tr>
                ) : (
                  dailyCashRows.map(row => (
                    <tr key={row.fecha} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="p-3 font-semibold text-gray-800 dark:text-gray-200">
                        {row.fecha}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(row.ventasEfectivo)}
                      </td>
                      <td className="p-3 text-right text-blue-600 dark:text-blue-400">
                        {row.depositosBanco > 0 ? formatCurrency(row.depositosBanco) : '-'}
                      </td>
                      <td className="p-3 text-right text-purple-600 dark:text-purple-400">
                        {row.gastosEfectivo > 0 ? formatCurrency(row.gastosEfectivo) : '-'}
                      </td>
                      <td className="p-3 text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrency(row.justificadoDia)}
                      </td>
                      <td className="p-3 text-right">
                        <span className={row.diferenciaDia > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'}>
                          {row.diferenciaDia > 0 ? `+${formatCurrency(row.diferenciaDia)}` : formatCurrency(row.diferenciaDia)}
                        </span>
                      </td>
                      <td className="p-3 text-right font-black text-amber-600 dark:text-amber-400">
                        {formatCurrency(row.saldoAcumulado)}
                      </td>
                      <td className="p-3 text-center font-sans">
                        {row.saldoAcumulado > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 dark:bg-amber-955/60 text-amber-800 dark:text-amber-300">
                            Falta Depositar
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-955/60 text-emerald-800 dark:text-emerald-300">
                            Depositado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 3: GESTIÓN Y CLASIFICACIÓN DE DEPÓSITOS DE EFECTIVO BANCARIOS */}
      {activeSubView === 'movimientos' && (
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Landmark size={14} className="text-blue-500" /> Depósitos en Efectivo Registrados en BBVA
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Usa el botón de acción para clasificar si un depósito pertenece al mes en curso o si fue un arrastre del mes anterior.
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-gray-600 dark:text-gray-300">
              Total BBVA Efectivo: <span className="text-blue-600 dark:text-blue-400">{formatCurrency(totalDepositosEfectivoBanco)}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 uppercase font-bold text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                  <th className="p-3">Fecha</th>
                  <th className="p-3">Concepto Bancario</th>
                  <th className="p-3">Referencia</th>
                  <th className="p-3 text-right font-mono">Monto ($)</th>
                  <th className="p-3 text-center">Clasificación de Período</th>
                  <th className="p-3 text-center">Asignación de tickets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {depositosEfectivoBanco.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400 italic">
                      No se encontraron depósitos de efectivo en el extracto de este período.
                    </td>
                  </tr>
                ) : (
                  depositosEfectivoBanco.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="p-3 whitespace-nowrap font-mono font-semibold text-gray-700 dark:text-gray-300">
                        {m.fecha ? m.fecha.split('T')[0] : 'S/F'}
                      </td>
                      <td className="p-3 font-medium text-gray-900 dark:text-white max-w-sm truncate" title={m.concepto}>
                        {m.concepto}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-gray-500">
                        {m.referencia || '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(Math.abs(Number(m.deposito || m.monto || 0)))}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          m._cashPeriod === 'anterior'
                            ? 'bg-purple-100 dark:bg-purple-955/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : m._cashPeriod === 'siguiente'
                              ? 'bg-sky-100 dark:bg-sky-955/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                              : 'bg-emerald-100 dark:bg-emerald-955/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}>
                          {m._cashPeriod === 'anterior' ? 'Mes anterior' : m._cashPeriod === 'siguiente' ? 'Mes siguiente' : 'Este mes'}
                        </span>
                        {m._razonArrastre && (
                          <span className="block text-[9px] text-gray-400 font-mono mt-0.5">
                            {m._razonArrastre}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <select
                            value={m._cashPeriod}
                            onChange={event => setCashDepositPeriod(m.id, event.target.value as CashDepositPeriod)}
                            className="max-w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1 text-[10px] font-bold"
                            aria-label={`Mes de venta al que corresponde el depósito ${m.concepto || m.id}`}
                          >
                            <option value="anterior">Mes anterior</option>
                            <option value="actual">Este mes</option>
                            <option value="siguiente">Mes siguiente</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => openCashDeposit(m)}
                            disabled={m._cashPeriod === 'siguiente'}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold disabled:opacity-40"
                          >
                            <Link2 size={11} /> Asignar tickets · {formatCurrency(m._cashLinked)}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
