'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  Sparkles
} from 'lucide-react';

interface ArqueoEfectivoTabProps {
  comprobantes?: any[];
  movimientos?: any[];
  cuentasBancarias?: any[];
  selectedMonth?: string;
  gastos?: any[];
  token?: string;
  onReloadMovimientos?: () => void;
}

export function ArqueoEfectivoTab({
  comprobantes = [],
  movimientos = [],
  cuentasBancarias = [],
  selectedMonth = '',
  gastos = [],
  token,
  onReloadMovimientos
}: ArqueoEfectivoTabProps) {
  const [activeSubView, setActiveSubView] = useState<'resumen' | 'diario' | 'movimientos'>('resumen');
  
  // Guardado local de IDs de movimientos bancarios marcados manualmente como "pertenecientes a otro mes (arrastre)"
  const storageKey = `seimenjo_arrastre_efectivo_${selectedMonth || 'global'}`;
  const [manualArrastreIds, setManualArrastreIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleManualArrastre = (id: string) => {
    setManualArrastreIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error('Error guardando en localStorage:', e);
      }
      return next;
    });
  };

  const formatCurrency = (val: number | string | null | undefined) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(num);
  };

  // Helper de detección de conceptos en efectivo
  const esMovimientoEfectivo = (concepto: string = ''): boolean => {
    const c = concepto.toUpperCase();
    return (
      c.includes('EFECTIVO') ||
      c.includes('CAJERO') ||
      c.includes('RETIRO CAJERO') ||
      c.includes('DEPOSITO CAJERO') ||
      c.includes('PRACTICAJA') ||
      c.includes('DISP.') ||
      c.includes('DISPOSICIÓN') ||
      c.includes('DISPOSICION') ||
      c.includes('VENTANILLA')
    );
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
  const depositosEfectivoBanco = useMemo(() => {
    return movimientos.filter(m => {
      const isDep = m.tipo_movimiento === 'Deposito' || Number(m.deposito || 0) > 0 || Number(m.monto || 0) > 0;
      if (!isDep) return false;
      const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
      if (selectedMonth && mes !== selectedMonth) return false;
      return esMovimientoEfectivo(m.concepto || '');
    }).map(m => {
      const autoCheck = checkIsOtherMonthAuto(m);
      const isArrastreManual = manualArrastreIds.has(m.id);
      const isArrastre = isArrastreManual || autoCheck.isOtherMonth;
      return {
        ...m,
        _isArrastre: isArrastre,
        _razonArrastre: autoCheck.razon || (isArrastreManual ? 'Marcado manualmente como arrastre' : '')
      };
    });
  }, [movimientos, selectedMonth, manualArrastreIds]);

  const totalDepositosEfectivoBanco = useMemo(() => {
    return depositosEfectivoBanco.reduce((acc, m) => acc + Math.abs(Number(m.deposito || m.monto || 0)), 0);
  }, [depositosEfectivoBanco]);

  // Depósitos catalogados como arrastre del mes anterior
  const depositosArrastreMesAnterior = useMemo(() => {
    return depositosEfectivoBanco
      .filter(m => m._isArrastre)
      .reduce((acc, m) => acc + Math.abs(Number(m.deposito || m.monto || 0)), 0);
  }, [depositosEfectivoBanco]);

  // Depósitos acreditados correspondientes a las ventas de este mes
  const depositosEfectivoAcreditadosEsteMes = useMemo(() => {
    return Math.max(0, totalDepositosEfectivoBanco - depositosArrastreMesAnterior);
  }, [totalDepositosEfectivoBanco, depositosArrastreMesAnterior]);

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
      if (m._isArrastre) return; // Excluir del flujo diario de este mes si es arrastre
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
              Seguimiento del efectivo cobrado en restaurante, compras pagadas con caja chica y depósitos en practicaja/ventanilla bancaria con control de desfases.
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
              <span>{depositosEfectivoBanco.filter(m => !m._isArrastre).length} abonos de este mes</span>
              {depositosArrastreMesAnterior > 0 && (
                <span className="text-purple-600 dark:text-purple-400 font-bold" title="Arrastre del mes anterior excluido">
                  Arrastre: -{formatCurrency(depositosArrastreMesAnterior)}
                </span>
              )}
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
                  <th className="p-3 text-center">Acción</th>
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
                        {m._isArrastre ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-955/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <Clock size={11} /> Arrastre Mes Anterior
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-955/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 size={11} /> Ventas de Este Mes
                          </span>
                        )}
                        {m._razonArrastre && (
                          <span className="block text-[9px] text-gray-400 font-mono mt-0.5">
                            {m._razonArrastre}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleManualArrastre(m.id)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            m._isArrastre
                              ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-955/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-955/40 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                          }`}
                        >
                          {m._isArrastre ? 'Cambiar a Este Mes' : 'Marcar como Arrastre'}
                        </button>
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
