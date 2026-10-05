'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useEmpresaId } from '../../../../lib/hooks/useEmpresaId';
import { usePeriod } from '../../../../lib/hooks/usePeriod';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import {
  vincularComprobanteAMovimiento,
  desvincularComprobanteDeMovimiento
} from '@/app/admin/gastos/reconciliationActions';
import { fetchCuentasBancarias } from '@/lib/cuentasBancarias';

export function useFacturaPublicoGeneralData() {
  const getEmpresaId = useEmpresaId();
  const getSessionToken = useSessionToken();
  const { selectedMonth, refreshPeriodStatus } = usePeriod();

  const [loading, setLoading] = useState(true);
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [movimientosDeposito, setMovimientosDeposito] = useState<any[]>([]);
  const [cargasEstadosCuenta, setCargasEstadosCuenta] = useState<any[]>([]);

  // Pestaña principal activa: 'facturas', 'tickets', 'comparativos' o 'depositos'
  const [tabActiva, setTabActiva] = useState<'cierre' | 'facturas' | 'tickets' | 'comparativos' | 'depositos'>('facturas');

  // Subpestaña para la sección de comparativos: 'efectivo', 'tarjetas', 'bbva_banco' o 'desfase_mes'
  const [subTabComparativo, setSubTabComparativo] = useState<'efectivo' | 'tarjetas' | 'bbva_banco' | 'desfase_mes'>('efectivo');

  // Movimientos bancarios excluidos de la factura global del mes actual
  const [excludedMovementIds, setExcludedMovementIds] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('factura_pg_excluded_mb');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Comprobantes / tickets excluidos de la factura global del mes actual
  const [excludedComprobanteIds, setExcludedComprobanteIds] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('factura_pg_excluded_comp');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Marcados manuales como pertenecientes a otro mes
  const [manualOtherMonthIds, setManualOtherMonthIds] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('factura_pg_manual_other_month');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Tickets de BBVA entrantes del próximo mes marcados manual o forzados
  const [manualProximoMesCompIds, setManualProximoMesCompIds] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('factura_pg_proximo_mes_comp');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const [manualStayMesCompIds, setManualStayMesCompIds] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('factura_pg_stay_mes_comp');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Filtros para Tickets
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCuentaId, setSelectedCuentaId] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'publico' | 'terceros'>('todos');

  // Filtros para Facturas Emitidas
  const [searchFacturasQuery, setSearchFacturasQuery] = useState('');
  const [filtroFacturasTipo, setFiltroFacturasTipo] = useState<'todas' | 'terceros' | 'publico'>('todas');

  // Facturados a terceros en tickets (Persistencia local)
  const [facturadosTerceros, setFacturadosTerceros] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('facturados_terceros_tickets');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Monto manual facturado a terceros por mes (Persistencia local)
  const [montoManualTercerosMap, setMontoManualTercerosMap] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('monto_manual_terceros_mes');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Días no laborables / descansos del mes (Persistencia multi-usuario)
  const [diasNoLaborablesMap, setDiasNoLaborablesMap] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('factura_pg_dias_no_laborables');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Ventas de fin de mes acreditadas al día siguiente (Desfase de Cierre bancario)
  const [ventasDiaSiguienteMap, setVentasDiaSiguienteMap] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('factura_pg_ventas_dia_siguiente');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Depósitos bancarios marcados como "No es Venta" (reembolsos, traspasos, etc.)
  const [noEsVentaMovementsMap, setNoEsVentaMovementsMap] = useState<Record<string, Record<string, string>>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('factura_pg_no_es_venta');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const [cashDepositPeriodsMap, setCashDepositPeriodsMap] = useState<Record<string, Record<string, 'anterior' | 'actual' | 'siguiente'>>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('seimenjo_periodo_depositos_efectivo') || localStorage.getItem('factura_pg_depositos_efectivo_periodo');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const [cashCarryForwardMap] = useState<Record<string, Array<{
    id: string;
    fecha?: string;
    descripcion?: string;
    montoEfectivo?: number;
    propinaEfectivo?: number;
    montoPendiente: number;
  }>>>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('seimenjo_efectivo_pendiente_siguiente_mes') || '{}');
      } catch {
        return {};
      }
    }
    return {};
  });

  const currentNoEsVentaMap = useMemo(() => {
    return noEsVentaMovementsMap[selectedMonth || 'GLOBAL'] || {};
  }, [noEsVentaMovementsMap, selectedMonth]);

  // Tickets marcados como "Pendiente por depositar" (aún sin depósito en banco, pero cuentan para la Factura Global)
  const [pendienteDepositoMap, setPendienteDepositoMap] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('factura_pg_pendiente_deposito');
        return saved ? JSON.parse(saved) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const currentPendienteDepositoIds = useMemo(() => {
    return new Set(pendienteDepositoMap[selectedMonth || 'GLOBAL'] || []);
  }, [pendienteDepositoMap, selectedMonth]);

  const currentExcludedMbIds = useMemo(() => {
    return new Set(excludedMovementIds[selectedMonth] || []);
  }, [excludedMovementIds, selectedMonth]);

  const currentExcludedCompIds = useMemo(() => {
    return new Set(excludedComprobanteIds[selectedMonth] || []);
  }, [excludedComprobanteIds, selectedMonth]);

  const currentManualOtherIds = useMemo(() => {
    return new Set(manualOtherMonthIds[selectedMonth] || []);
  }, [manualOtherMonthIds, selectedMonth]);

  const currentManualProximoMesIds = useMemo(() => {
    return new Set(manualProximoMesCompIds[selectedMonth] || []);
  }, [manualProximoMesCompIds, selectedMonth]);

  const currentManualStayMesIds = useMemo(() => {
    return new Set(manualStayMesCompIds[selectedMonth] || []);
  }, [manualStayMesCompIds, selectedMonth]);

  const currentDiasNoLaborables = useMemo(() => {
    return diasNoLaborablesMap[selectedMonth] || [];
  }, [diasNoLaborablesMap, selectedMonth]);

  // Función auxiliar para persistir ajustes mensuales en Supabase
  const saveAjustesToSupabase = useCallback(async (
    monthKey: string,
    overrides?: {
      montoManual?: number;
      excludedMb?: string[];
      excludedComp?: string[];
      manualOther?: string[];
      proximoMes?: string[];
      stayMes?: string[];
      diasNoLaborables?: string[];
      noEsVenta?: Array<{ id: string; razon: string }>;
      pendienteDeposito?: string[];
      cashDepositPeriods?: Record<string, 'anterior' | 'actual' | 'siguiente'>;
    }
  ) => {
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return { success: false, error: 'Sin empresa' };

      const rawNoEsVenta = overrides?.noEsVenta ?? Object.entries(noEsVentaMovementsMap[monthKey] || {}).map(([id, razon]) => ({ id, razon }));

      const payload: any = {
        empresa_id: empresaId,
        mes: monthKey,
        monto_manual_terceros: overrides?.montoManual ?? (montoManualTercerosMap[monthKey] || 0),
        movimientos_excluidos: overrides?.excludedMb ?? (excludedMovementIds[monthKey] || []),
        comprobantes_excluidos: overrides?.excludedComp ?? (excludedComprobanteIds[monthKey] || []),
        manual_otro_mes: overrides?.manualOther ?? (manualOtherMonthIds[monthKey] || []),
        proximo_mes_comprobantes: overrides?.proximoMes ?? (manualProximoMesCompIds[monthKey] || []),
        stay_mes_comprobantes: overrides?.stayMes ?? (manualStayMesCompIds[monthKey] || []),
        dias_no_laborables: overrides?.diasNoLaborables ?? (diasNoLaborablesMap[monthKey] || []),
        no_es_venta_movimientos: rawNoEsVenta,
        pendiente_deposito_comprobantes: overrides?.pendienteDeposito ?? (pendienteDepositoMap[monthKey] || []),
        depositos_efectivo_periodo: overrides?.cashDepositPeriods ?? (cashDepositPeriodsMap[monthKey] || {}),
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase
        .from('factura_global_ajustes')
        .upsert(payload, { onConflict: 'empresa_id,mes' });

      if (upsertErr) {
        console.error('Error al guardar ajustes en Supabase:', upsertErr);
        return { success: false, error: upsertErr.message };
      }
      return { success: true };
    } catch (err: any) {
      console.warn('Ajuste guardado localmente (sincronización con BD pendiente):', err);
      return { success: false, error: err?.message || String(err) };
    }
  }, [
    getEmpresaId,
    noEsVentaMovementsMap,
    montoManualTercerosMap,
    excludedMovementIds,
    excludedComprobanteIds,
    manualOtherMonthIds,
    manualProximoMesCompIds,
    manualStayMesCompIds,
    diasNoLaborablesMap,
    pendienteDepositoMap,
    cashDepositPeriodsMap
  ]);

  const guardarAjustesPeriodo = useCallback(async () => {
    if (!selectedMonth) return { success: false, error: 'No hay período seleccionado' };
    return await saveAjustesToSupabase(selectedMonth);
  }, [selectedMonth, saveAjustesToSupabase]);

  const toggleNoEsVentaMovement = (movId: string, razon: string = 'Reembolso') => {
    const monthKey = selectedMonth || 'GLOBAL';
    setNoEsVentaMovementsMap(prev => {
      const current = { ...(prev[monthKey] || {}) };
      if (current[movId]) {
        delete current[movId];
      } else {
        current[movId] = razon;
      }
      const next = { ...prev, [monthKey]: current };
      if (typeof window !== 'undefined') {
        localStorage.setItem('factura_pg_no_es_venta', JSON.stringify(next));
      }
      const rawList = Object.entries(current).map(([id, r]) => ({ id, razon: r }));
      saveAjustesToSupabase(monthKey, { noEsVenta: rawList });
      return next;
    });
  };

  const setCashDepositPeriod = (movementId: string, period: 'anterior' | 'actual' | 'siguiente') => {
    const monthKey = selectedMonth || 'GLOBAL';
    setCashDepositPeriodsMap(prev => {
      const monthPeriods = { ...(prev[monthKey] || {}), [movementId]: period };
      const next = { ...prev, [monthKey]: monthPeriods };
      if (typeof window !== 'undefined') {
        const shared = JSON.parse(localStorage.getItem('seimenjo_periodo_depositos_efectivo') || '{}');
        localStorage.setItem('seimenjo_periodo_depositos_efectivo', JSON.stringify({ ...shared, [monthKey]: monthPeriods }));
        localStorage.setItem('factura_pg_depositos_efectivo_periodo', JSON.stringify(next));
      }
      saveAjustesToSupabase(monthKey, { cashDepositPeriods: monthPeriods });
      return next;
    });
  };

  const togglePendienteDeposito = (compId: string) => {
    const monthKey = selectedMonth || 'GLOBAL';
    setPendienteDepositoMap(prev => {
      const list = prev[monthKey] || [];
      const updated = list.includes(compId) ? list.filter(id => id !== compId) : [...list, compId];
      const next = { ...prev, [monthKey]: updated };
      if (typeof window !== 'undefined') {
        localStorage.setItem('factura_pg_pendiente_deposito', JSON.stringify(next));
      }
      saveAjustesToSupabase(monthKey, { pendienteDeposito: updated });
      return next;
    });
  };

  const toggleExcludeMovement = (movId: string) => {
    if (!selectedMonth) return;
    setExcludedMovementIds(prev => {
      const list = prev[selectedMonth] || [];
      const updated = list.includes(movId) ? list.filter(id => id !== movId) : [...list, movId];
      const next = { ...prev, [selectedMonth]: updated };
      if (typeof window !== 'undefined') {
        localStorage.setItem('factura_pg_excluded_mb', JSON.stringify(next));
      }
      saveAjustesToSupabase(selectedMonth, { excludedMb: updated });
      return next;
    });
  };

  const toggleExcludeComprobante = (compId: string) => {
    if (!selectedMonth) return;
    setExcludedComprobanteIds(prev => {
      const list = prev[selectedMonth] || [];
      const updated = list.includes(compId) ? list.filter(id => id !== compId) : [...list, compId];
      const next = { ...prev, [selectedMonth]: updated };
      if (typeof window !== 'undefined') {
        localStorage.setItem('factura_pg_excluded_comp', JSON.stringify(next));
      }
      saveAjustesToSupabase(selectedMonth, { excludedComp: updated });
      return next;
    });
  };

  const toggleManualOtherMonth = (itemId: string) => {
    if (!selectedMonth) return;
    setManualOtherMonthIds(prev => {
      const list = prev[selectedMonth] || [];
      const updated = list.includes(itemId) ? list.filter(id => id !== itemId) : [...list, itemId];
      const next = { ...prev, [selectedMonth]: updated };
      if (typeof window !== 'undefined') {
        localStorage.setItem('factura_pg_manual_other_month', JSON.stringify(next));
      }
      saveAjustesToSupabase(selectedMonth, { manualOther: updated });
      return next;
    });
  };

  const toggleProximoMesComp = (compId: string, isCurrentlyProximo: boolean) => {
    if (!selectedMonth) return;
    if (isCurrentlyProximo) {
      const nextProx = (manualProximoMesCompIds[selectedMonth] || []).filter(id => id !== compId);
      const nextStay = Array.from(new Set([...(manualStayMesCompIds[selectedMonth] || []), compId]));
      
      setManualProximoMesCompIds(prev => {
        const next = { ...prev, [selectedMonth]: nextProx };
        if (typeof window !== 'undefined') localStorage.setItem('factura_pg_proximo_mes_comp', JSON.stringify(next));
        return next;
      });
      setManualStayMesCompIds(prev => {
        const next = { ...prev, [selectedMonth]: nextStay };
        if (typeof window !== 'undefined') localStorage.setItem('factura_pg_stay_mes_comp', JSON.stringify(next));
        return next;
      });
      saveAjustesToSupabase(selectedMonth, { proximoMes: nextProx, stayMes: nextStay });
    } else {
      const nextStay = (manualStayMesCompIds[selectedMonth] || []).filter(id => id !== compId);
      const nextProx = Array.from(new Set([...(manualProximoMesCompIds[selectedMonth] || []), compId]));

      setManualStayMesCompIds(prev => {
        const next = { ...prev, [selectedMonth]: nextStay };
        if (typeof window !== 'undefined') localStorage.setItem('factura_pg_stay_mes_comp', JSON.stringify(next));
        return next;
      });
      setManualProximoMesCompIds(prev => {
        const next = { ...prev, [selectedMonth]: nextProx };
        if (typeof window !== 'undefined') localStorage.setItem('factura_pg_proximo_mes_comp', JSON.stringify(next));
        return next;
      });
      saveAjustesToSupabase(selectedMonth, { proximoMes: nextProx, stayMes: nextStay });
    }
  };

  const setAllExcludedMovements = (ids: string[], exclude: boolean) => {
    if (!selectedMonth) return;
    setExcludedMovementIds(prev => {
      let list = prev[selectedMonth] || [];
      if (exclude) {
        list = Array.from(new Set([...list, ...ids]));
      } else {
        list = list.filter(id => !ids.includes(id));
      }
      const next = { ...prev, [selectedMonth]: list };
      if (typeof window !== 'undefined') {
        localStorage.setItem('factura_pg_excluded_mb', JSON.stringify(next));
      }
      saveAjustesToSupabase(selectedMonth, { excludedMb: list });
      return next;
    });
  };

  const toggleDiaNoLaborable = (dateStr: string) => {
    if (!selectedMonth) return;
    setDiasNoLaborablesMap(prev => {
      const list = prev[selectedMonth] || [];
      const updated = list.includes(dateStr) ? list.filter(d => d !== dateStr) : [...list, dateStr].sort();
      const next = { ...prev, [selectedMonth]: updated };
      if (typeof window !== 'undefined') {
        localStorage.setItem('factura_pg_dias_no_laborables', JSON.stringify(next));
      }
      saveAjustesToSupabase(selectedMonth, { diasNoLaborables: updated });
      return next;
    });
  };

  const setDiasNoLaborablesBulk = (dates: string[]) => {
    if (!selectedMonth) return;
    setDiasNoLaborablesMap(prev => {
      const next = { ...prev, [selectedMonth]: dates.sort() };
      if (typeof window !== 'undefined') {
        localStorage.setItem('factura_pg_dias_no_laborables', JSON.stringify(next));
      }
      saveAjustesToSupabase(selectedMonth, { diasNoLaborables: dates.sort() });
      return next;
    });
  };

  const toggleFacturadoTercero = async (id: string) => {
    const current = !!facturadosTerceros[id];
    const nextVal = !current;
    setFacturadosTerceros(prev => {
      const updated = { ...prev, [id]: nextVal };
      if (typeof window !== 'undefined') {
        localStorage.setItem('facturados_terceros_tickets', JSON.stringify(updated));
      }
      return updated;
    });

    try {
      await supabase
        .from('comprobantes_deposito')
        .update({ facturado_tercero: nextVal })
        .eq('id', id);
    } catch (err) {
      console.warn('Error al persistir facturado_tercero en BD:', err);
    }
  };

  const setMontoManualTercero = (mesKey: string, monto: number) => {
    const safeMonto = Math.max(0, monto);
    setMontoManualTercerosMap(prev => {
      const updated = { ...prev, [mesKey]: safeMonto };
      if (typeof window !== 'undefined') {
        localStorage.setItem('monto_manual_terceros_mes', JSON.stringify(updated));
      }
      return updated;
    });
    saveAjustesToSupabase(mesKey, { montoManual: safeMonto });
  };

  const setVentasDiaSiguienteMonto = (monto: number) => {
    if (!selectedMonth) return;
    const safeMonto = Math.max(0, isNaN(monto) ? 0 : monto);
    setVentasDiaSiguienteMap(prev => {
      const next = { ...prev, [selectedMonth]: safeMonto };
      if (typeof window !== 'undefined') {
        localStorage.setItem('factura_pg_ventas_dia_siguiente', JSON.stringify(next));
      }
      return next;
    });
  };

  const formatCurrency = useCallback((val: number | string | null | undefined) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(num);
  }, []);

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage.from('facturas').download(filePath);
      if (error || !data) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'documento';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error al descargar archivo:', err?.message || err);
    }
  };

  const esMovimientoEfectivo = useCallback((concepto: string): boolean => {
    if (!concepto) return false;
    const c = concepto.toUpperCase();
    if (
      c.includes('RETIRO') ||
      c.includes('DISPOSICION') ||
      c.includes('DISPOSICIÓN') ||
      c.includes('DISP.') ||
      c.includes('CARGO')
    ) {
      return false;
    }
    return (
      c.includes('EFECTIVO') ||
      c.includes('DEPOSITO CAJERO') ||
      c.includes('PRACTICAJA') ||
      c.includes('VENTANILLA')
    );
  }, []);

  const extractDateOnly = useCallback((dateStr?: string | null) => {
    if (!dateStr) return '';
    const clean = String(dateStr).trim();
    if (clean.includes('T')) return clean.split('T')[0];
    if (clean.includes(' ')) return clean.split(' ')[0];
    return clean.substring(0, 10);
  }, []);

  const extractYearMonth = useCallback((dateStr?: string | null) => {
    if (!dateStr) return '';
    const clean = String(dateStr).trim();
    if (clean.includes('-')) {
      const parts = clean.split('T')[0].split('-');
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}`;
      if (parts[2]?.length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}`;
    }
    if (clean.includes('/')) {
      const parts = clean.split('/');
      if (parts[2]?.length >= 4) return `${parts[2].substring(0, 4)}-${parts[1].padStart(2, '0')}`;
    }
    try {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
      }
    } catch (e) {}
    return clean.substring(0, 7);
  }, []);

  const isEndOfMonth = useCallback((dateStr?: string | null, targetMonth?: string) => {
    if (!dateStr) return false;
    const dateOnly = extractDateOnly(dateStr);
    if (!dateOnly) return false;
    const parts = dateOnly.split('-');
    if (parts.length < 3) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day >= lastDayOfMonth - 1;
  }, [extractDateOnly]);

  const isCargaUsuario = useCallback((c: any): boolean => {
    if (!c) return false;
    const notas = (c.notas || '').toLowerCase();
    const nombre = (c.nombre_archivo || '').toLowerCase();
    if (notas.includes('asociación automática') || notas.includes('asociacion automatica') || notas.includes('sistema')) {
      return false;
    }
    if (nombre.startsWith('carga existente') || nombre.includes('carga existente')) {
      return false;
    }
    return true;
  }, []);

  const formatPeriodoCarga = useCallback((c: any): string => {
    if (c.notas && c.notas.includes('Fecha del documento:')) {
      const match = c.notas.match(/Fecha del documento:\s*([^|]+)/i);
      if (match) return match[1].trim();
    }
    return c.nombre_archivo || 'Carga de Estado de Cuenta';
  }, []);

  const checkIsOtherMonth = useCallback((item: { fecha?: string; descripcion?: string; concepto?: string; es_venta_mes_anterior?: boolean; mes_venta?: string | null }, targetMonth: string) => {
    if (!targetMonth) return { isOtherMonth: false, razon: '', mesDetectado: '' };
    const desc = ((item.descripcion || '') + ' ' + (item.concepto || '')).toLowerCase();

    // 0. Marca explícita o tag de venta de mes anterior
    if ((item as any).es_venta_mes_anterior === true || (item as any).es_venta_mes_anterior === 'true') {
      return {
        isOtherMonth: true,
        razon: 'Marcado explícitamente como Venta de Mes Anterior',
        mesDetectado: (item as any).mes_venta || 'Mes anterior'
      };
    }

    if (desc.includes('[venta_mes_anterior]') || desc.includes('[venta_mes:') || desc.includes('mes anterior') || desc.includes('mes previo')) {
      const matchMes = (item.descripcion || '').match(/\[VENTA_MES:([^\]]+)\]/i);
      return {
        isOtherMonth: true,
        razon: 'Marcado como venta diferida de mes anterior',
        mesDetectado: matchMes ? matchMes[1] : (item as any).mes_venta || 'Mes anterior'
      };
    }

    // 0.1 Detectar "ventas del día DD/MM/YYYY" donde el mes difiere del mes seleccionado
    const matchVentaDia = desc.match(/ventas del d[ií]a\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
    if (matchVentaDia) {
      const saleMonth = `${matchVentaDia[3]}-${matchVentaDia[2].padStart(2, '0')}`;
      if (saleMonth !== targetMonth) {
        return {
          isOtherMonth: true,
          razon: `Venta del día ${matchVentaDia[1]}/${matchVentaDia[2]}/${matchVentaDia[3]} corresponde al período ${saleMonth}`,
          mesDetectado: saleMonth
        };
      }
    }

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

    const targetMesNum = targetMonth.split('-')[1];

    for (const m of meses) {
      if (m.num !== targetMesNum && desc.includes(m.name)) {
        return {
          isOtherMonth: true,
          razon: `Menciona ${m.name.toUpperCase()}`,
          mesDetectado: m.name.charAt(0).toUpperCase() + m.name.slice(1)
        };
      }
    }

    if (item.fecha) {
      const itemMes = extractYearMonth(item.fecha);
      if (itemMes && itemMes !== targetMonth) {
        return {
          isOtherMonth: true,
          razon: `Fecha original (${item.fecha}) pertenece al mes ${itemMes}`,
          mesDetectado: itemMes
        };
      }
    }

    return { isOtherMonth: false, razon: '', mesDetectado: '' };
  }, [extractYearMonth]);

  // ─────────────────────────────────────────────────────────────────────────────
  // FASE 1: FETCH CON FILTRADO POR RANGO DE FECHAS (PREVIENE OVERFETCHING)
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) {
        setLoading(false);
        return;
      }

      // Rango de fechas con margen de 7 días antes y después para capturar desfases y arrastres
      let startMargin: string | null = null;
      let endMargin: string | null = null;

      if (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)) {
        const [yearStr, monthStr] = selectedMonth.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);

        const startDate = new Date(Date.UTC(year, month - 1, 1));
        startDate.setUTCDate(startDate.getUTCDate() - 7);
        startMargin = startDate.toISOString().split('T')[0];

        const endDate = new Date(Date.UTC(year, month, 0));
        endDate.setUTCDate(endDate.getUTCDate() + 7);
        endMargin = endDate.toISOString().split('T')[0];
      }

      // 0. Cargar Empresa Activa
      const { data: empData } = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('id', empresaId)
        .maybeSingle();
      setEmpresaNombre(empData?.nombre || '');

      // 1. Cuentas Bancarias (Carga robusta con fallback global y auto-inicialización)
      const cbData = await fetchCuentasBancarias(empresaId);
      setCuentasBancarias(cbData || []);

      // 2. Cargas de Estados de Cuenta
      const { data: cargasData, error: cargasErr } = await supabase
        .from('cargas_estados_cuenta')
        .select('*, cuentas_bancarias(nombre)')
        .eq('empresa_id', empresaId)
        .order('fecha_carga', { ascending: false });

      if (cargasErr) console.warn('Error al cargar cargas_estados_cuenta:', cargasErr);
      setCargasEstadosCuenta(cargasData || []);

      // 3. Comprobantes / Cortes POS (con rango de fechas acotado)
      let compQuery = supabase
        .from('comprobantes_deposito')
        .select('*, comprobantes_deposito_movimientos(*)')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });

      if (startMargin && endMargin) {
        compQuery = compQuery.gte('fecha', startMargin).lte('fecha', endMargin);
      }

      const { data: compWithRel, error: compRelErr } = await compQuery;
      let compData: any[] = [];
      if (!compRelErr && compWithRel) {
        compData = compWithRel;
      } else {
        let compSimpleQuery = supabase
          .from('comprobantes_deposito')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false });

        if (startMargin && endMargin) {
          compSimpleQuery = compSimpleQuery.gte('fecha', startMargin).lte('fecha', endMargin);
        }
        const { data: compSimple } = await compSimpleQuery;
        compData = compSimple || [];
      }
      setComprobantes(compData);

      // 4. Facturas Clientes Emitidas (con rango de fechas acotado)
      let fcQuery = supabase
        .from('facturas_clientes')
        .select('*, clientes(id, nombre_local, razon_social, rfc), pedidos(id, numero_pedido, cliente_nombre, precio_total), estatus_factura(nombre)')
        .eq('empresa_id', empresaId)
        .order('fecha_emision', { ascending: false });

      if (startMargin && endMargin) {
        fcQuery = fcQuery.gte('fecha_emision', startMargin).lte('fecha_emision', endMargin);
      }
      const { data: fcData, error: fcErr } = await fcQuery;
      if (fcErr) console.warn('Error al cargar facturas_clientes:', fcErr);
      setFacturas(fcData || []);

      // 5. Pedidos (con rango de fechas acotado)
      let pQuery = supabase
        .from('pedidos')
        .select('id, numero_pedido, cliente_id, cliente_nombre, precio_total, fecha_pedido, folio_factura, metodo_pago, clientes(id, nombre_local, razon_social, rfc, facturar_publico_general, es_anonimo), facturas_clientes(*)')
        .eq('empresa_id', empresaId)
        .order('fecha_pedido', { ascending: false });

      if (startMargin && endMargin) {
        pQuery = pQuery.gte('fecha_pedido', startMargin).lte('fecha_pedido', endMargin);
      }
      const { data: pData, error: pErr } = await pQuery;
      if (pErr) console.warn('Error al cargar pedidos:', pErr);
      setPedidos(pData || []);

      // 6. Depósitos Bancarios (Movimientos de Cargas Usuario)
      let mbQuery = supabase
        .from('movimientos_bancarios')
        .select('*, conciliaciones_bancarias(*, gastos(*), pedidos(*, facturas_clientes(*))), comprobantes_deposito_movimientos(*, comprobantes_deposito(*)), cuentas_bancarias(*), estatus_conciliacion_bancaria(*)')
        .eq('empresa_id', empresaId)
        .or('tipo_movimiento.eq.Deposito,deposito.gt.0')
        .order('fecha', { ascending: false });

      if (startMargin && endMargin) {
        mbQuery = mbQuery.gte('fecha', startMargin).lte('fecha', endMargin);
      }
      const { data: mbData, error: mbErr } = await mbQuery;
      let mbResult: any[] = [];
      if (!mbErr && mbData) {
        mbResult = mbData;
      } else {
        let mbSimpleQuery = supabase
          .from('movimientos_bancarios')
          .select('*, comprobantes_deposito_movimientos(*, comprobantes_deposito(*)), cuentas_bancarias(*), estatus_conciliacion_bancaria(*)')
          .eq('empresa_id', empresaId)
          .or('tipo_movimiento.eq.Deposito,deposito.gt.0')
          .order('fecha', { ascending: false });

        if (startMargin && endMargin) {
          mbSimpleQuery = mbSimpleQuery.gte('fecha', startMargin).lte('fecha', endMargin);
        }
        const { data: mbSimple } = await mbSimpleQuery;
        mbResult = mbSimple || [];
      }
      setMovimientosDeposito(mbResult);

      // 7. Sincronizar ajustes del mes desde Supabase (Persistencia Multi-usuario)
      const monthKey = selectedMonth || 'GLOBAL';
      try {
        const { data: ajData } = await supabase
          .from('factura_global_ajustes')
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('mes', monthKey)
          .maybeSingle();

        if (ajData) {
          if (ajData.movimientos_excluidos && Array.isArray(ajData.movimientos_excluidos)) {
            setExcludedMovementIds(prev => ({ ...prev, [monthKey]: ajData.movimientos_excluidos }));
          }
          if (ajData.comprobantes_excluidos && Array.isArray(ajData.comprobantes_excluidos)) {
            setExcludedComprobanteIds(prev => ({ ...prev, [monthKey]: ajData.comprobantes_excluidos }));
          }
          if (ajData.manual_otro_mes && Array.isArray(ajData.manual_otro_mes)) {
            setManualOtherMonthIds(prev => ({ ...prev, [monthKey]: ajData.manual_otro_mes }));
          }
          if (ajData.proximo_mes_comprobantes && Array.isArray(ajData.proximo_mes_comprobantes)) {
            setManualProximoMesCompIds(prev => ({ ...prev, [monthKey]: ajData.proximo_mes_comprobantes }));
          }
          if (ajData.stay_mes_comprobantes && Array.isArray(ajData.stay_mes_comprobantes)) {
            setManualStayMesCompIds(prev => ({ ...prev, [monthKey]: ajData.stay_mes_comprobantes }));
          }
          if (ajData.monto_manual_terceros !== undefined && ajData.monto_manual_terceros !== null) {
            setMontoManualTercerosMap(prev => ({ ...prev, [monthKey]: Number(ajData.monto_manual_terceros) }));
          }
          if (ajData.dias_no_laborables && Array.isArray(ajData.dias_no_laborables)) {
            setDiasNoLaborablesMap(prev => ({ ...prev, [monthKey]: ajData.dias_no_laborables }));
          }
          if (ajData.no_es_venta_movimientos && Array.isArray(ajData.no_es_venta_movimientos)) {
            const mapped: Record<string, string> = {};
            ajData.no_es_venta_movimientos.forEach((item: any) => {
              if (typeof item === 'string') mapped[item] = 'Reembolso';
              else if (item && item.id) mapped[item.id] = item.razon || 'Reembolso';
            });
            setNoEsVentaMovementsMap(prev => ({ ...prev, [monthKey]: mapped }));
          }
          if (ajData.depositos_efectivo_periodo && typeof ajData.depositos_efectivo_periodo === 'object') {
            setCashDepositPeriodsMap(prev => ({
              ...prev,
              [monthKey]: { ...ajData.depositos_efectivo_periodo, ...(prev[monthKey] || {}) }
            }));
          }
          if (ajData.pendiente_deposito_comprobantes && Array.isArray(ajData.pendiente_deposito_comprobantes)) {
            setPendienteDepositoMap(prev => ({ ...prev, [monthKey]: ajData.pendiente_deposito_comprobantes }));
          }
        }

        // Incorporar facturado_tercero de comprobantes en BD
        const remoteTerceros: Record<string, boolean> = {};
        compData.forEach((c: any) => {
          if (c.facturado_tercero) {
            remoteTerceros[c.id] = true;
          }
        });
        if (Object.keys(remoteTerceros).length > 0) {
          setFacturadosTerceros(prev => ({ ...prev, ...remoteTerceros }));
        }
      } catch (errSync) {
        console.warn('Aviso: Sincronización remota de ajustes en factura_global_ajustes omitida:', errSync);
      }

    } catch (err: any) {
      console.error('Error al cargar datos de factura público general:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // Cargas emitidas por usuario
  const userCargas = useMemo(() => {
    return cargasEstadosCuenta.filter(c => isCargaUsuario(c));
  }, [cargasEstadosCuenta, isCargaUsuario]);

  const userCargasMes = useMemo(() => {
    return userCargas.filter(c => {
      if (!selectedMonth) return true;
      const mesFecha = extractYearMonth(c.fecha_carga);
      const notas = (c.notas || '');
      if (mesFecha === selectedMonth || notas.includes(selectedMonth)) return true;
      return movimientosDeposito.some(m => m.carga_id === c.id && extractYearMonth(m.fecha) === selectedMonth);
    });
  }, [userCargas, selectedMonth, movimientosDeposito, extractYearMonth]);

  const userCargaMesIds = useMemo(() => {
    return new Set(userCargasMes.map(c => c.id));
  }, [userCargasMes]);

  // Acciones de vinculación/desvinculación con persistencia y refresco
  const vincularComprobante = async (comprobanteId: string, movimientoBancarioId: string, montoAsociado?: number) => {
    try {
      const token = await getSessionToken();
      const res = await vincularComprobanteAMovimiento(comprobanteId, movimientoBancarioId, token, montoAsociado);
      if (res && res.success) {
        await fetchData();
      }
      return res;
    } catch (err: any) {
      console.error('Error al vincular comprobante con movimiento:', err);
      return { success: false, error: err.message || 'Error al vincular comprobante.' };
    }
  };

  const desvincularComprobante = async (comprobanteId: string, movimientoBancarioId: string | null = null) => {
    try {
      const token = await getSessionToken();
      const res = await desvincularComprobanteDeMovimiento(comprobanteId, movimientoBancarioId, token);
      if (res && res.success) {
        await fetchData();
      }
      return res;
    } catch (err: any) {
      console.error('Error al desvincular comprobante:', err);
      return { success: false, error: err.message || 'Error al desvincular comprobante.' };
    }
  };

  // Mapa de relación de tickets y depósitos bancarios asociados
  const ticketVinculacionMap = useMemo(() => {
    const map = new Map<string, {
      totalVinculado: number;
      dif: number;
      isCuadrado100: boolean;
      isParcial: boolean;
      movIds: Set<string>;
      montoObjetivo: number;
      esCuadreEfectivo: boolean;
      movDetails: Array<{ id: string; montoAsociado: number; concepto: string; fecha: string; esEfectivo: boolean }>;
    }>();

    const movMap = new Map<string, any>();
    movimientosDeposito.forEach(m => movMap.set(m.id, m));

    comprobantes.forEach((comp: any) => {
      const cdms = comp.comprobantes_deposito_movimientos || [];
      let totalVinculado = 0;
      const movIds = new Set<string>();
      const movDetails: Array<{ id: string; montoAsociado: number; concepto: string; fecha: string; esEfectivo: boolean }> = [];

      cdms.forEach((rel: any) => {
        const mov = movMap.get(rel.movimiento_id);
        const esEfectivo = !!mov && esMovimientoEfectivo(mov.concepto || '');
        const montoAsoc = rel.monto_asociado !== undefined && rel.monto_asociado !== null
          ? Number(rel.monto_asociado)
          : (mov && !esEfectivo ? Number(mov.deposito || mov.monto || 0) : 0);
        totalVinculado += montoAsoc;
        movIds.add(rel.movimiento_id);
        if (mov) {
          movDetails.push({
            id: mov.id,
            montoAsociado: montoAsoc,
            concepto: mov.concepto || '',
            fecha: mov.fecha || '',
            esEfectivo
          });
        }
      });

      const esCuadreEfectivo = movDetails.length > 0 && movDetails.every(mov => mov.esEfectivo) &&
        Number(comp.monto_efectivo || 0) + Number(comp.propina_efectivo || 0) > 0;
      const montoObjetivo = esCuadreEfectivo
        ? Number(comp.monto_efectivo || 0) + Number(comp.propina_efectivo || 0)
        : Number(comp.monto || 0);
      const dif = montoObjetivo - totalVinculado;
      const isCuadrado100 = totalVinculado > 0 && Math.abs(dif) < 0.05;
      const isParcial = totalVinculado > 0 && !isCuadrado100;

      map.set(comp.id, {
        totalVinculado,
        dif,
        isCuadrado100,
        isParcial,
        montoObjetivo,
        esCuadreEfectivo,
        movIds,
        movDetails
      });
    });

    return map;
  }, [comprobantes, movimientosDeposito, esMovimientoEfectivo]);

  // Mapa de depósitos a su ticket vinculado (con validación de 100% y advertencia si difiere)
  const movVinculacionMap = useMemo(() => {
    const map = new Map<string, {
      ticket: any;
      isCuadrado100: boolean;
      isParcial: boolean;
      dif: number;
      montoAsociado: number;
      totalVinculado: number;
      tickets: Array<{ ticket: any; montoAsociado: number }>;
      esCuadreEfectivo: boolean;
      advertencia: string | null;
    }>();
    const cashTicketsByMovement = new Map<string, Array<{ ticket: any; montoAsociado: number }>>();
    const movementMap = new Map(movimientosDeposito.map(movimiento => [movimiento.id, movimiento]));

    comprobantes.forEach((comp: any) => {
      const vInfo = ticketVinculacionMap.get(comp.id);
      if (!vInfo || vInfo.movDetails.length === 0) return;

      vInfo.movDetails.forEach(md => {
        if (md.esEfectivo) {
          const tickets = cashTicketsByMovement.get(md.id) || [];
          const cashAmount = Number(comp.monto_efectivo || 0) + Number(comp.propina_efectivo || 0);
          tickets.push({ ticket: comp, montoAsociado: Math.min(cashAmount, md.montoAsociado) });
          cashTicketsByMovement.set(md.id, tickets);
          return;
        }

        const compDesc = comp.descripcion || `Ticket #${comp.id.slice(0, 6)}`;
        const advertencia = !vInfo.isCuadrado100
          ? `⚠️ El ticket (${compDesc}) por $${vInfo.montoObjetivo.toLocaleString('es-MX', { minimumFractionDigits: 2 })} no coincide al 100% con los depósitos asociados (suma: $${vInfo.totalVinculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}). Diferencia: ${vInfo.dif > 0 ? '+' : ''}$${vInfo.dif.toLocaleString('es-MX', { minimumFractionDigits: 2 })}. No se descuenta del saldo bancario hasta que el cuadre sea exacto.`
          : null;

        map.set(md.id, {
          ticket: comp,
          tickets: [{ ticket: comp, montoAsociado: md.montoAsociado }],
          isCuadrado100: vInfo.isCuadrado100,
          isParcial: vInfo.isParcial,
          dif: vInfo.dif,
          montoAsociado: md.montoAsociado,
          totalVinculado: vInfo.totalVinculado,
          esCuadreEfectivo: false,
          advertencia
        });
      });
    });

    cashTicketsByMovement.forEach((tickets, movementId) => {
      const movement = movementMap.get(movementId);
      if (!movement) return;

      const totalVinculado = tickets.reduce((sum, item) => sum + item.montoAsociado, 0);
      const montoDeposito = Math.abs(Number(movement.deposito || movement.monto || 0));
      const dif = montoDeposito - totalVinculado;
      const isCuadrado100 = totalVinculado > 0 && Math.abs(dif) < 0.05;
      const isParcial = totalVinculado > 0 && !isCuadrado100;
      const advertencia = !isCuadrado100
        ? `⚠️ El depósito en efectivo por $${montoDeposito.toLocaleString('es-MX', { minimumFractionDigits: 2 })} no coincide al 100% con los importes en efectivo de ${tickets.length} corte(s) asociado(s) (suma: $${totalVinculado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}). Diferencia: ${dif > 0 ? '+' : ''}$${dif.toLocaleString('es-MX', { minimumFractionDigits: 2 })}.`
        : null;

      map.set(movementId, {
        ticket: tickets[0].ticket,
        tickets,
        isCuadrado100,
        isParcial,
        dif,
        montoAsociado: totalVinculado,
        totalVinculado,
        esCuadreEfectivo: true,
        advertencia
      });
    });

    return map;
  }, [comprobantes, movimientosDeposito, ticketVinculacionMap]);

  // Clasificación de tickets y cortes POS del mes
  const allTicketsMes = useMemo(() => {
    return comprobantes.filter(c => {
      if (c.tipo === 'deposito_ventanilla') return false;
      if (c.descripcion && c.descripcion.includes('COMPROBANTE_EFECTIVO_')) return false;
      const mes = extractYearMonth(c.fecha);
      if (selectedMonth && mes !== selectedMonth) return false;
      if (selectedCuentaId && c.cuenta_bancaria_id && c.cuenta_bancaria_id !== selectedCuentaId) return false;
      return true;
    }).map(c => {
      const autoCheck = checkIsOtherMonth(c, selectedMonth);
      const isOtherMonth = currentManualOtherIds.has(c.id) || autoCheck.isOtherMonth;
      const hasExplicitPref = excludedComprobanteIds[selectedMonth] !== undefined;
      const isExcluded = hasExplicitPref ? currentExcludedCompIds.has(c.id) : isOtherMonth;

      const vInfo = ticketVinculacionMap.get(c.id);
      const totalVinculado = vInfo?.totalVinculado || 0;
      const difPendiente = vInfo?.dif ?? Number(c.monto || 0);
      const isCuadrado100 = vInfo?.isCuadrado100 || false;
      const isParcial = vInfo?.isParcial || false;
      const associatedMovs = vInfo?.movDetails || [];

      return {
        ...c,
        _isOtherMonth: isOtherMonth,
        _otherMonthRazon: autoCheck.razon || (currentManualOtherIds.has(c.id) ? 'Marcado manualmente' : ''),
        _mesDetectado: autoCheck.mesDetectado,
        _isExcluded: isExcluded,
        _totalVinculado: totalVinculado,
        _montoObjetivoVinculacion: vInfo?.montoObjetivo ?? Number(c.monto || 0),
        _esCuadreEfectivo: vInfo?.esCuadreEfectivo || false,
        _difPendiente: difPendiente,
        _isCuadrado100: isCuadrado100,
        _isParcial: isParcial,
        _associatedMovs: associatedMovs,
        // Pendiente por depositar: solo aplica mientras el ticket no esté cuadrado al 100% con depósitos
        _isPendienteDeposito: currentPendienteDepositoIds.has(c.id) && !isCuadrado100
      };
    });
  }, [comprobantes, selectedMonth, selectedCuentaId, currentManualOtherIds, currentExcludedCompIds, excludedComprobanteIds, extractYearMonth, checkIsOtherMonth, ticketVinculacionMap, currentPendienteDepositoIds]);

  const ticketsMes = useMemo(() => {
    return allTicketsMes.filter(t => !t._isExcluded);
  }, [allTicketsMes]);

  const depositosVentanillaMes = useMemo(() => {
    return comprobantes.filter(c => {
      if (c.tipo !== 'deposito_ventanilla') return false;
      const mes = extractYearMonth(c.fecha);
      if (selectedMonth && mes !== selectedMonth) return false;
      if (currentExcludedCompIds.has(c.id)) return false;
      if (checkIsOtherMonth(c, selectedMonth).isOtherMonth) return false;
      return true;
    });
  }, [comprobantes, selectedMonth, currentExcludedCompIds, extractYearMonth, checkIsOtherMonth]);

  const checkIsPG = useCallback((rfcStr?: string, nameStr?: string, folioStr?: string, usoCfdi?: string, clienteObj?: any) => {
    const rfc = (rfcStr || '').trim().toUpperCase();
    const name = (nameStr || '').trim().toUpperCase();
    const folio = (folioStr || '').trim().toLowerCase();

    if (rfc.includes('XAXX010101') || rfc.includes('XEXX010101')) return true;
    if (name.includes('PUBLICO') || name.includes('PÚBLICO') || name.includes('MOSTRADOR') || name.includes('GENERAL')) return true;
    if (folio.includes('global') || folio.includes('pg') || folio.includes('pub')) return true;
    if (usoCfdi === 'S01') return true;
    if (clienteObj?.facturar_publico_general || clienteObj?.es_anonimo) return true;
    return false;
  }, []);

  const resolveClienteInfo = useCallback((obj: any, isPG: boolean) => {
    const rfc = (
      obj.clientes?.rfc ||
      obj.rfc_receptor ||
      obj.rfcReceptor ||
      obj.rfc ||
      ''
    ).trim().toUpperCase();

    const name = (
      obj.clientes?.nombre_local ||
      obj.clientes?.razon_social ||
      obj.razon_social_receptor ||
      obj.nombre_receptor ||
      obj.cliente_nombre ||
      ''
    ).trim();

    return {
      clienteRfc: rfc || (isPG ? 'XAXX010101000' : 'S/N'),
      clienteNombre: name || (isPG ? 'Público en General' : 'Cliente Tercero')
    };
  }, []);

  const pedidosMes = useMemo(() => {
    return pedidos.filter(p => {
      const inv = (p.facturas_clientes && p.facturas_clientes.length > 0) ? p.facturas_clientes[0] : null;
      const fechaRef = inv?.fecha_emision || p.fecha_pedido || p.creado_en || '';
      const mes = extractYearMonth(fechaRef);
      if (selectedMonth && mes !== selectedMonth) return false;
      return true;
    });
  }, [pedidos, selectedMonth, extractYearMonth]);

  // UNIFICACIÓN TOTAL DE FACTURAS EMITIDAS
  const todasLasFacturasMes = useMemo(() => {
    const directFacturas = facturas
      .filter(f => {
        const fechaRef = f.fecha_emision || f.fecha_timbrado || f.created_at || f.creado_en || '';
        const mes = extractYearMonth(fechaRef);
        if (selectedMonth && mes !== selectedMonth) return false;
        return true;
      })
      .map(f => {
        const isPG = checkIsPG(
          f.clientes?.rfc || f.rfc_receptor || f.rfcReceptor,
          f.clientes?.nombre_local || f.clientes?.razon_social || f.razon_social_receptor || f.nombre_receptor || f.pedidos?.cliente_nombre,
          f.serie_folio,
          f.uso_cfdi_clave,
          f.clientes
        );
        const { clienteRfc, clienteNombre } = resolveClienteInfo(f, isPG);
        const totalVal = Number(f.total || 0);
        const subtotalVal = Number(f.subtotal || (totalVal > 0 ? totalVal / 1.16 : 0));
        const ivaVal = Number(f.iva_trasladado || (totalVal - subtotalVal));

        return {
          ...f,
          _isPG: isPG,
          _clienteNombre: clienteNombre,
          _clienteRfc: clienteRfc,
          _subtotal: subtotalVal,
          _iva: ivaVal,
          _total: totalVal
        };
      });

    const pedidosConFactura = pedidosMes
      .filter(p => {
        const hasFactura = !!p.folio_factura || (p.facturas_clientes && p.facturas_clientes.length > 0) || !!p.uuid_fiscal;
        if (!hasFactura) return false;

        const alreadyIn = directFacturas.some(f => 
          (f.pedido_id && f.pedido_id === p.id) ||
          (p.folio_factura && f.serie_folio && f.serie_folio.toLowerCase().trim() === p.folio_factura.toLowerCase().trim()) ||
          (f.uuid_fiscal && p.uuid_fiscal && f.uuid_fiscal.toUpperCase().trim() === p.uuid_fiscal.toUpperCase().trim()) ||
          (p.facturas_clientes && p.facturas_clientes.some((pfc: any) => pfc.id === f.id))
        );
        return !alreadyIn;
      })
      .map(p => {
        const inv = (p.facturas_clientes && p.facturas_clientes.length > 0) ? p.facturas_clientes[0] : null;
        const isPG = checkIsPG(
          p.clientes?.rfc || p.rfc || p.rfc_receptor || inv?.rfc_receptor,
          p.cliente_nombre || p.clientes?.nombre_local || p.clientes?.razon_social || inv?.razon_social_receptor,
          p.folio_factura || inv?.serie_folio,
          inv?.uso_cfdi_clave,
          p.clientes
        );
        const { clienteRfc, clienteNombre } = resolveClienteInfo({ ...p, ...inv }, isPG);
        const totalVal = Number(inv?.total || p.precio_total || 0);
        const subtotalVal = Number(inv?.subtotal || p.subtotal || (totalVal > 0 ? totalVal / 1.16 : 0));
        const ivaVal = Number(inv?.iva_trasladado || p.iva || (totalVal - subtotalVal));

        return {
          id: `pedido_${p.id}`,
          _isFromPedido: true,
          pedido_id: p.id,
          serie_folio: p.folio_factura || inv?.serie_folio || `PED-#${p.numero_pedido || p.id.substring(0, 6)}`,
          fecha_emision: inv?.fecha_emision || p.fecha_pedido || p.creado_en,
          total: totalVal,
          subtotal: subtotalVal,
          iva_trasladado: ivaVal,
          uuid_fiscal: inv?.uuid_fiscal || p.uuid_fiscal || '',
          xml_url: inv?.xml_url || p.xml_url || null,
          pdf_url: inv?.pdf_url || p.pdf_url || p.factura_url || null,
          pedidos: p,
          clientes: p.clientes,
          _isPG: isPG,
          _clienteNombre: clienteNombre,
          _clienteRfc: clienteRfc,
          _subtotal: subtotalVal,
          _iva: ivaVal,
          _total: totalVal
        };
      });

    return [...directFacturas, ...pedidosConFactura];
  }, [facturas, pedidosMes, selectedMonth, checkIsPG, resolveClienteInfo, extractYearMonth]);

  // DEPÓSITOS BANCARIOS DEL ESTADO DE CUENTA
  const depositosMes = useMemo(() => {
    return movimientosDeposito
      .filter(m => {
        if (!m.carga_id || !userCargaMesIds.has(m.carga_id)) return false;

        const c = (m.concepto || '').toUpperCase();
        const isRetiro = (
          m.tipo_movimiento === 'Retiro' ||
          Number(m.retiro || 0) > 0 ||
          c.includes('RETIRO') ||
          c.includes('DISPOSICION') ||
          c.includes('DISPOSICIÓN')
        );
        if (isRetiro) return false;

        const ctaNombre = (m.cuentas_bancarias?.nombre || '').toUpperCase();
        if (ctaNombre.includes('CAJA CHICA')) return false;

        const mes = extractYearMonth(m.fecha);
        if (selectedMonth && mes !== selectedMonth) return false;
        return true;
      })
      .map(m => {
        const montoVal = Math.abs(Number(m.monto || m.deposito || 0));
        const cdms = m.comprobantes_deposito_movimientos || [];
        const hasTickets = cdms.length > 0;
        const concs = m.conciliaciones_bancarias || [];
        const hasInvoice = concs.length > 0 || !!m.factura_url || !!m.xml_url || !!m.comprobante_url;

        let isOtherMonth = currentManualOtherIds.has(m.id);
        let otherMonthRazon = isOtherMonth ? 'Marcado manualmente' : '';
        let mesDetectado = '';

        if (!isOtherMonth) {
          const directCheck = checkIsOtherMonth(m, selectedMonth);
          if (directCheck.isOtherMonth) {
            isOtherMonth = true;
            otherMonthRazon = directCheck.razon;
            mesDetectado = directCheck.mesDetectado;
          }
        }

        if (!isOtherMonth && hasTickets) {
          for (const c of cdms) {
            const comp = c.comprobantes_deposito;
            if (comp) {
              const compCheck = checkIsOtherMonth(comp, selectedMonth);
              if (compCheck.isOtherMonth) {
                isOtherMonth = true;
                otherMonthRazon = `Ticket vinculado (${comp.descripcion || 'Sin título'}): ${compCheck.razon}`;
                mesDetectado = compCheck.mesDetectado;
                break;
              }
            }
          }
        }

        const hasExplicitPreference = excludedMovementIds[selectedMonth] !== undefined;
        const isExcluded = hasExplicitPreference ? currentExcludedMbIds.has(m.id) : isOtherMonth;

        const isNoVenta = !!currentNoEsVentaMap[m.id];
        const noVentaRazon = currentNoEsVentaMap[m.id] || '';

        const vData = movVinculacionMap.get(m.id);
        const isVinculadoCuadrado100 = !!(vData && vData.isCuadrado100);
        const isVinculadoIncompleto = !!(vData && vData.isParcial);
        const ticketAsociado = vData?.ticket || null;
        const advertenciaCuadre = vData?.advertencia || null;

        let statusName = 'Sin Conciliar';
        if (hasInvoice) {
          statusName = 'Facturado';
        } else if (isVinculadoCuadrado100) {
          statusName = 'Conciliado 100% con Ticket';
        } else if (hasTickets || isVinculadoIncompleto) {
          statusName = 'Vinculado Parcial (Pendiente)';
        }

        return {
          ...m,
          _monto: montoVal,
          _hasInvoice: hasInvoice,
          _hasTickets: hasTickets,
          _statusName: statusName,
          _isOtherMonth: isOtherMonth,
          _otherMonthRazon: otherMonthRazon,
          _mesDetectado: mesDetectado,
          _isExcluded: isExcluded,
          _isNoVenta: isNoVenta,
          _noVentaRazon: noVentaRazon,
          _vinculadoCuadrado100: isVinculadoCuadrado100,
          _vinculadoIncompleto: isVinculadoIncompleto,
          _ticketAsociado: ticketAsociado,
          _ticketsAsociados: vData?.tickets || (ticketAsociado ? [{ ticket: ticketAsociado, montoAsociado: vData?.montoAsociado || 0 }] : []),
          _esDepositoEfectivo: esMovimientoEfectivo(m.concepto || ''),
          _ticketTotalVinculado: vData?.totalVinculado ?? 0,
          _ticketDiferencia: vData?.dif ?? Number(ticketAsociado?.monto || 0),
          _advertenciaCuadre: advertenciaCuadre,
          _montoAsociadoAlTicket: vData?.montoAsociado ?? (hasTickets ? montoVal : 0),
          _cdms: cdms,
          _concs: concs
        };
      });
  }, [movimientosDeposito, userCargaMesIds, selectedMonth, currentManualOtherIds, currentExcludedMbIds, excludedMovementIds, extractYearMonth, checkIsOtherMonth, currentNoEsVentaMap, movVinculacionMap, esMovimientoEfectivo]);

  const {
    totalMontoDepositosMes,
    totalDepositosFacturadosMes,
    montoDepositosFacturadosMes,
    totalDepositosConTicketMes,
    montoDepositosConTicketMes,
    totalMontoExcluidoOtroMes,
    totalMontoDepositosNoEsVenta,
    totalMontoDepositosVinculadosCuadrados,
    totalMontoDepositosPendientesAsociar
  } = useMemo(() => {
    let totalMonto = 0;
    let countFact = 0;
    let montoFact = 0;
    let countTicket = 0;
    let montoTicket = 0;
    let montoExcluido = 0;
    let montoNoVenta = 0;
    let montoVinculadoCuadrado = 0;

    depositosMes.forEach(d => {
      totalMonto += d._monto;
      if (d._hasInvoice) {
        countFact++;
        montoFact += d._monto;
      }
      if (d._hasTickets || d._vinculadoCuadrado100) {
        countTicket++;
        montoTicket += d._monto;
      }
      if (d._isExcluded) {
        montoExcluido += d._monto;
      }
      if (d._isNoVenta) {
        montoNoVenta += d._monto;
      }
      if (d._vinculadoCuadrado100) {
        montoVinculadoCuadrado += d._monto;
      }
    });

    const depositosNetosCalc = Math.max(0, totalMonto - montoExcluido - montoNoVenta);
    const pendientesAsociar = Math.max(0, depositosNetosCalc - montoVinculadoCuadrado);

    return {
      totalMontoDepositosMes: totalMonto,
      totalDepositosFacturadosMes: countFact,
      montoDepositosFacturadosMes: montoFact,
      totalDepositosConTicketMes: countTicket,
      montoDepositosConTicketMes: montoTicket,
      totalMontoExcluidoOtroMes: montoExcluido,
      totalMontoDepositosNoEsVenta: montoNoVenta,
      totalMontoDepositosVinculadosCuadrados: montoVinculadoCuadrado,
      totalMontoDepositosPendientesAsociar: pendientesAsociar
    };
  }, [depositosMes]);

  const movimientosOtroMes = useMemo(() => {
    return depositosMes.filter(d => d._isOtherMonth || d._isExcluded);
  }, [depositosMes]);

  const ticketsOtroMes = useMemo(() => {
    return allTicketsMes.filter(t => t._isOtherMonth || t._isExcluded);
  }, [allTicketsMes]);

  const {
    facturasTercerosMes,
    facturasPgMes,
    montoFacturasTerceros,
    ivaFacturasTerceros,
    montoFacturasPg,
    totalFacturadoMes
  } = useMemo(() => {
    const facTerceros = todasLasFacturasMes.filter(f => !f._isPG);
    const facPg = todasLasFacturasMes.filter(f => f._isPG);
    const sumFacTerceros = facTerceros.reduce((acc, f) => acc + Number(f._total || f.total || 0), 0);
    const sumIvaFacTerceros = facTerceros.reduce((acc, f) => acc + Number(f._iva ?? f.iva_trasladado ?? 0), 0);
    const sumFacPg = facPg.reduce((acc, f) => acc + Number(f._total || f.total || 0), 0);

    return {
      facturasTercerosMes: facTerceros,
      facturasPgMes: facPg,
      montoFacturasTerceros: sumFacTerceros,
      ivaFacturasTerceros: sumIvaFacTerceros,
      montoFacturasPg: sumFacPg,
      totalFacturadoMes: sumFacTerceros + sumFacPg
    };
  }, [todasLasFacturasMes]);

  const { isSakura, hasBbva, hasParrot } = useMemo(() => {
    const isSak = (empresaNombre || '').toLowerCase().includes('sakura');
    const hasB = isSak && cuentasBancarias.some(cb => cb.nombre?.toUpperCase().includes('BBVA'));
    const hasP = isSak && (cuentasBancarias.some(cb => cb.nombre?.toUpperCase().includes('PARROT')) || ticketsMes.some(t => t.tipo === 'corte_parrot'));
    return { isSakura: isSak, hasBbva: hasB, hasParrot: hasP };
  }, [empresaNombre, cuentasBancarias, ticketsMes]);
  const isSeimenjo = !isSakura && (empresaNombre || '').toLowerCase().includes('seimenjo');

  // BASE PARROT: SOLO EFECTIVO + PARROTPAY PARA FACTURA GLOBAL
  const {
    totalEfectivoParrot,
    totalParrotPayParrot,
    totalFacturableParrotBase,
    totalPropinasParrotEfecPPay,
    tercerosEfecParrot,
    tercerosParrotPay,
    totalTercerosDeducibles,
    efectivoPublicoGeneral,
    parrotPayPublicoGeneral,
    manualTercerosVal,
    currentMonthKey
  } = useMemo(() => {
    let sumEfectivo = 0;
    let sumParrotPay = 0;
    let sumPropinas = 0;
    let sumTercerosEfec = 0;
    let sumTercerosParrotPay = 0;

    ticketsMes.forEach(c => {
      const efec = Number(c.monto_efectivo || 0);
      const parrotPay = Number(c.monto_parrotpay || 0);
      const propEfec = Number(c.propina_efectivo || 0);
      const propPPay = Number(c.propina_parrotpay || 0);

      sumEfectivo += efec;
      sumParrotPay += parrotPay;
      // De Parrot solo se toman propinas de Efectivo y ParrotPay.
      // Las propinas de tarjeta se toman exclusivamente de los tickets BBVA (ver comparativoTarjetas).
      sumPropinas += (propEfec + propPPay);

      if (facturadosTerceros[c.id]) {
        sumTercerosEfec += efec;
        sumTercerosParrotPay += parrotPay;
      }
    });

    const monthKey = selectedMonth || 'GLOBAL';
    const manualVal = Number(montoManualTercerosMap[monthKey] || 0);

    const baseFacturable = sumEfectivo + sumParrotPay;
    const totalTerceros = montoFacturasTerceros + sumTercerosEfec + sumTercerosParrotPay + manualVal;

    const factPubGen = Math.max(0, baseFacturable - totalTerceros);
    const efecPubGen = Math.max(0, sumEfectivo - sumTercerosEfec - (montoFacturasTerceros + manualVal));
    const parrotPubGen = Math.max(0, sumParrotPay - sumTercerosParrotPay);

    return {
      totalEfectivoParrot: sumEfectivo,
      totalParrotPayParrot: sumParrotPay,
      totalFacturableParrotBase: baseFacturable,
      totalPropinasParrotEfecPPay: sumPropinas,
      tercerosEfecParrot: sumTercerosEfec,
      tercerosParrotPay: sumTercerosParrotPay,
      totalTercerosDeducibles: totalTerceros,
      totalFacturaParrotNeto: factPubGen,
      efectivoPublicoGeneral: efecPubGen,
      parrotPayPublicoGeneral: parrotPubGen,
      manualTercerosVal: manualVal,
      currentMonthKey: monthKey
    };
  }, [ticketsMes, facturadosTerceros, montoManualTercerosMap, selectedMonth, montoFacturasTerceros]);

  // COMPARATIVO TARJETAS DÉBITO Y CRÉDITO (PARROT VS CORTE BBVA)
  const comparativoTarjetas = useMemo(() => {
    let parrotDebito = 0;
    let parrotCredito = 0;
    let parrotAmex = 0;
    let parrotPropinasTarj = 0;

    let bbvaDebito = 0;
    let bbvaCredito = 0;
    let bbvaAmex = 0;
    let bbvaPropinasTarj = 0;

    const dailyMap: Record<string, {
      fecha: string;
      parrotDebito: number;
      parrotCredito: number;
      parrotAmex: number;
      parrotTotal: number;
      bbvaDebito: number;
      bbvaCredito: number;
      bbvaAmex: number;
      bbvaTotal: number;
    }> = {};

    ticketsMes.forEach(c => {
      const fecha = extractDateOnly(c.fecha);
      if (!fecha) return;

      if (!dailyMap[fecha]) {
        dailyMap[fecha] = {
          fecha,
          parrotDebito: 0,
          parrotCredito: 0,
          parrotAmex: 0,
          parrotTotal: 0,
          bbvaDebito: 0,
          bbvaCredito: 0,
          bbvaAmex: 0,
          bbvaTotal: 0
        };
      }

      const isBbvaCut = (c.tipo === 'corte_bbva') ||
        (c.descripcion && c.descripcion.toUpperCase().includes('BBVA')) ||
        (c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('BBVA') && c.tipo !== 'corte_parrot');

      const deb = Number(c.monto_debito || 0);
      const cred = Number(c.monto_credito || 0);
      const amex = Number(c.monto_amex || 0);
      let prop = Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0);
      if (prop === 0) {
        if (Number(c.propina_tarjeta || 0) > 0) {
          prop = Number(c.propina_tarjeta);
        } else if (Number(c.propina || 0) > 0 && !c.monto_efectivo) {
          prop = Number(c.propina);
        } else if (c.tipo === 'corte_bbva' && Number(c.monto || 0) > (deb + cred + amex) && !c.monto_efectivo) {
          prop = Number(c.monto) - (deb + cred + amex);
        }
      }

      if (isBbvaCut) {
        bbvaDebito += deb;
        bbvaCredito += cred;
        bbvaAmex += amex;
        bbvaPropinasTarj += prop;

        dailyMap[fecha].bbvaDebito += deb;
        dailyMap[fecha].bbvaCredito += cred;
        dailyMap[fecha].bbvaAmex += amex;
        dailyMap[fecha].bbvaTotal += (deb + cred + amex);
      } else {
        parrotDebito += deb;
        parrotCredito += cred;
        parrotAmex += amex;
        parrotPropinasTarj += prop;

        dailyMap[fecha].parrotDebito += deb;
        dailyMap[fecha].parrotCredito += cred;
        dailyMap[fecha].parrotAmex += amex;
        dailyMap[fecha].parrotTotal += (deb + cred + amex);
      }
    });

    const totalTarjetasParrot = parrotDebito + parrotCredito + parrotAmex;
    const totalTarjetasBbva = bbvaDebito + bbvaCredito + bbvaAmex;
    const diferenciaTarjetas = totalTarjetasBbva - totalTarjetasParrot;

    const dailyRows = Object.values(dailyMap).sort((a, b) => b.fecha.localeCompare(a.fecha));

    return {
      parrotDebito,
      parrotCredito,
      parrotAmex,
      totalTarjetasParrot,
      parrotPropinasTarj,
      bbvaDebito,
      bbvaCredito,
      bbvaAmex,
      totalTarjetasBbva,
      bbvaPropinasTarj,
      diferenciaTarjetas,
      dailyRows
    };
  }, [ticketsMes, cuentasBancarias, extractDateOnly]);

  // PROPINAS EXCLUIDAS: Parrot (Efectivo + ParrotPay) + Tarjetas según tickets BBVA
  const totalPropinasExcluidas = totalPropinasParrotEfecPPay + comparativoTarjetas.bbvaPropinasTarj;

  // TICKETS PENDIENTES POR DEPOSITAR (marcados manualmente; aún sin depósito en el estado de cuenta)
  const { ticketsPendientesDeposito, montoTicketsPendientesDeposito } = useMemo(() => {
    const list = ticketsMes.filter(t => t._isPendienteDeposito);
    const monto = list.reduce((acc, t) => acc + Math.max(0, Number(t._difPendiente ?? t.monto ?? 0)), 0);
    return { ticketsPendientesDeposito: list, montoTicketsPendientesDeposito: monto };
  }, [ticketsMes]);

  // Identificador y detección de tickets BBVA
  const isTicketBbva = useCallback((c: any) => {
    return (
      c.tipo === 'corte_bbva' ||
      (c.descripcion && c.descripcion.toUpperCase().includes('BBVA')) ||
      (c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('BBVA') && c.tipo !== 'corte_parrot')
    );
  }, [cuentasBancarias]);

  // Tickets de BBVA que no tienen depósito al 100% en el estado de cuenta
  const ticketsBbvaSinDeposito = useMemo(() => {
    return ticketsMes.filter(t => isTicketBbva(t) && !t._isCuadrado100);
  }, [ticketsMes, isTicketBbva]);

  // FACTURA AL PÚBLICO EN GENERAL:
  // Efectivo Parrot + ParrotPay + todas las Tarjetas BBVA − Terceros − Propinas.
  // La marca de pendiente solo afecta la conciliación; no excluye tickets del subtotal.
  const totalFacturaPublicoGeneral = Math.max(
    0,
    totalFacturableParrotBase + (comparativoTarjetas.totalTarjetasBbva || 0) - totalTercerosDeducibles - totalPropinasExcluidas
  );

  // BBVA: TICKETS VS ESTADO DE CUENTA
  const comparativoBbvaBanco = useMemo(() => {
    const totalTicketsBbvaSinPropina = comparativoTarjetas.totalTarjetasBbva;
    const totalPropinaBbvaTarjetas = comparativoTarjetas.bbvaPropinasTarj;
    const totalTicketsBbvaConPropina = totalTicketsBbvaSinPropina + totalPropinaBbvaTarjetas;

    let totalDepositosBbvaGeneral = 0;
    let totalDepositosBbvaTarjetas = 0;
    let totalDepositosBbvaEfectivo = 0;
    let totalExcluidosBbvaTarjetas = 0;
    let totalExcluidosBbvaEfectivo = 0;
    const bbvaMovimientos: any[] = [];

    depositosMes.forEach(d => {
      const isBbva = d.cuentas_bancarias?.nombre?.toUpperCase().includes('BBVA') ||
                     cuentasBancarias.some(cb => cb.id === d.cuenta_bancaria_id && cb.nombre?.toUpperCase().includes('BBVA')) ||
                     (!d.cuenta_bancaria_id && cuentasBancarias.length === 1);

      if (isBbva) {
        totalDepositosBbvaGeneral += d._monto;
        bbvaMovimientos.push(d);

        const esEfectivo = esMovimientoEfectivo(d.concepto || '');

        if (d._isExcluded) {
          if (esEfectivo) {
            totalExcluidosBbvaEfectivo += d._monto;
          } else {
            totalExcluidosBbvaTarjetas += d._monto;
          }
        } else {
          if (esEfectivo) {
            totalDepositosBbvaEfectivo += d._monto;
          } else {
            totalDepositosBbvaTarjetas += d._monto;
          }
        }
      }
    });

    const bbvaMovIds = new Set(bbvaMovimientos.map(m => m.id));

    let totalEntrantesProximoMesSinPropina = 0;
    let totalEntrantesProximoMesPropina = 0;
    let totalEntrantesProximoMesConPropina = 0;
    const entrantesProximoMesTickets: any[] = [];
    const ticketsBbvaDetallados: any[] = [];

    ticketsMes.forEach(c => {
      const isBbvaCut = (c.tipo === 'corte_bbva') ||
        (c.descripcion && c.descripcion.toUpperCase().includes('BBVA')) ||
        (c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('BBVA') && c.tipo !== 'corte_parrot');

      if (!isBbvaCut) return;

      const deb = Number(c.monto_debito || 0);
      const cred = Number(c.monto_credito || 0);
      const amex = Number(c.monto_amex || 0);
      const sinProp = deb + cred + amex;
      let prop = Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0);
      if (prop === 0) {
        if (Number(c.propina_tarjeta || 0) > 0) prop = Number(c.propina_tarjeta);
        else if (Number(c.propina || 0) > 0 && !c.monto_efectivo) prop = Number(c.propina);
        else if (c.tipo === 'corte_bbva' && Number(c.monto || 0) > sinProp && !c.monto_efectivo) prop = Number(c.monto) - sinProp;
      }
      const conProp = sinProp + prop;

      const cdms = c.comprobantes_deposito_movimientos || [];
      const hasMovInCurrentMonth = cdms.some((rel: any) => bbvaMovIds.has(rel.movimiento_id));
      const isManualEntrante = currentManualProximoMesIds.has(c.id);
      const isManualStay = currentManualStayMesIds.has(c.id);

      const isEnd = isEndOfMonth(c.fecha, selectedMonth);
      const isEntrante = isManualEntrante || (!isManualStay && !hasMovInCurrentMonth && isEnd);

      const itemDetail = {
        ...c,
        _sinProp: sinProp,
        _prop: prop,
        _conProp: conProp,
        _hasMovInCurrentMonth: hasMovInCurrentMonth,
        _isEntranteProximoMes: isEntrante,
        _isManualEntrante: isManualEntrante,
        _isEnd: isEnd
      };

      ticketsBbvaDetallados.push(itemDetail);

      if (isEntrante) {
        totalEntrantesProximoMesSinPropina += sinProp;
        totalEntrantesProximoMesPropina += prop;
        totalEntrantesProximoMesConPropina += conProp;
        entrantesProximoMesTickets.push(itemDetail);
      }
    });

    const totalTicketsAcreditadosMes = Math.max(0, totalTicketsBbvaConPropina - totalEntrantesProximoMesConPropina);
    const diferenciaTicketsVsBanco = totalDepositosBbvaTarjetas - totalTicketsAcreditadosMes;
    const diferenciaSinPropina = totalDepositosBbvaTarjetas - totalTicketsBbvaSinPropina;
    const diferenciaBrutaConPropina = totalDepositosBbvaTarjetas - totalTicketsBbvaConPropina;

    return {
      totalTicketsBbvaSinPropina,
      totalPropinaBbvaTarjetas,
      totalTicketsBbvaConPropina,
      totalEntrantesProximoMesSinPropina,
      totalEntrantesProximoMesPropina,
      totalEntrantesProximoMesConPropina,
      totalTicketsAcreditadosMes,
      totalDepositosBbvaGeneral,
      totalDepositosBbvaTarjetas,
      totalDepositosBbvaEfectivo,
      totalExcluidosBbvaTarjetas,
      totalExcluidosBbvaEfectivo,
      diferenciaTicketsVsBanco,
      diferenciaSinPropina,
      diferenciaBrutaConPropina,
      entrantesProximoMesTickets,
      ticketsBbvaDetallados,
      bbvaMovimientos
    };
  }, [
    comparativoTarjetas.totalTarjetasBbva,
    comparativoTarjetas.bbvaPropinasTarj,
    depositosMes,
    cuentasBancarias,
    ticketsMes,
    currentManualProximoMesIds,
    currentManualStayMesIds,
    selectedMonth,
    esMovimientoEfectivo,
    isEndOfMonth
  ]);

  // CONTROL Y ARQUEO DE EFECTIVO
  const controlEfectivo = useMemo(() => {
    const ventasEfectivoParrot = ticketsMes.reduce((sum, ticket) =>
      sum + Number(ticket.monto_efectivo || 0) + Number(ticket.propina_efectivo || 0), 0
    );
    const periodMap = cashDepositPeriodsMap[selectedMonth || 'GLOBAL'] || {};
    const periodForCashDeposit = (deposit: any) =>
      periodMap[deposit.id] || (deposit._isExcluded || deposit._isOtherMonth ? 'anterior' : 'actual');

    let montoFichasVentanilla = 0;
    const fichasVentanilla: any[] = [];
    depositosVentanillaMes.forEach(c => {
      montoFichasVentanilla += Number(c.monto || 0);
      fichasVentanilla.push(c);
    });

    let montoEfectivoEstadoCuenta = 0;
    let montoEfectivoExcluidoOtroMes = 0;
    let montoEfectivoMesSiguiente = 0;
    const depositosBancoEfectivo: any[] = [];
    const depositosBancoEfectivoAnterior: any[] = [];
    depositosMes.forEach(d => {
      if (esMovimientoEfectivo(d.concepto || '') && !d._isNoVenta) {
        const periodo = periodForCashDeposit(d);
        if (periodo === 'anterior') {
          montoEfectivoExcluidoOtroMes += d._monto;
          depositosBancoEfectivoAnterior.push(d);
        } else if (periodo === 'siguiente') {
          montoEfectivoMesSiguiente += d._monto;
        } else {
          montoEfectivoEstadoCuenta += d._monto;
          depositosBancoEfectivo.push(d);
        }
      }
    });

    const depositosActualesIds = new Set(depositosBancoEfectivo.map(deposito => deposito.id));
    const depositosAnterioresIds = new Set(depositosBancoEfectivoAnterior.map(deposito => deposito.id));
    const cashAmountForTicket = (ticket: any) => Number(ticket.monto_efectivo || 0) + Number(ticket.propina_efectivo || 0);
    const linkedCashForTicket = (ticket: any, depositIds: Set<string>) => {
      const totalCash = cashAmountForTicket(ticket);
      const linked = (ticket.comprobantes_deposito_movimientos || []).reduce((sum: number, relation: any) => {
        if (!depositIds.has(relation.movimiento_id)) return sum;
        return sum + Number(relation.monto_asociado || 0);
      }, 0);
      return Math.min(totalCash, linked);
    };

    const totalEfectivoConciliado = ticketsMes.reduce(
      (sum, ticket) => sum + linkedCashForTicket(ticket, depositosActualesIds),
      0
    );
    const efectivoPendienteTicketsMes = ticketsMes.reduce(
      (sum, ticket) => sum + Math.max(0, cashAmountForTicket(ticket) - linkedCashForTicket(ticket, depositosActualesIds)),
      0
    );
    const previousMonth = selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth)
      ? (() => {
        const [year, month] = selectedMonth.split('-').map(Number);
        return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
      })()
      : '';
    const carryForwardRecords = cashCarryForwardMap[previousMonth] || [];
    const efectivoPendienteMesAnterior = carryForwardRecords.reduce((sum, record) => {
      const ticket = comprobantes.find((item: any) => item.id === record.id);
      const linked = ticket ? linkedCashForTicket(ticket, depositosAnterioresIds) : 0;
      return sum + Math.max(0, Number(record.montoPendiente || 0) - linked);
    }, 0);

    const totalDepositosEfectivoRealizados = totalEfectivoConciliado;
    const montoEfectivoSinAsignar = Math.max(0, montoEfectivoEstadoCuenta - totalEfectivoConciliado);
    const diferenciaEfectivo = ventasEfectivoParrot - totalEfectivoConciliado;
    const faltaPorDepositar = Math.max(0, diferenciaEfectivo);
    const sobranteEfectivo = diferenciaEfectivo < 0 ? Math.abs(diferenciaEfectivo) : 0;
    const porcentajeDepositado = ventasEfectivoParrot > 0 
      ? Math.min(100, Math.round((totalEfectivoConciliado / ventasEfectivoParrot) * 100))
      : 100;

    const dailyCashMap: Record<string, {
      fecha: string;
      ventasEfectivoParrot: number;
      depositosVentanilla: number;
      depositosBanco: number;
      totalDepositado: number;
      diferenciaDia: number;
    }> = {};

    ticketsMes.forEach(c => {
      const fecha = extractDateOnly(c.fecha);
      if (!fecha) return;
      if (!dailyCashMap[fecha]) {
        dailyCashMap[fecha] = {
          fecha,
          ventasEfectivoParrot: 0,
          depositosVentanilla: 0,
          depositosBanco: 0,
          totalDepositado: 0,
          diferenciaDia: 0
        };
      }
      dailyCashMap[fecha].ventasEfectivoParrot += Number(c.monto_efectivo || 0);
    });

    depositosVentanillaMes.forEach(c => {
      const fecha = extractDateOnly(c.fecha);
      if (!fecha) return;
      if (!dailyCashMap[fecha]) {
        dailyCashMap[fecha] = {
          fecha,
          ventasEfectivoParrot: 0,
          depositosVentanilla: 0,
          depositosBanco: 0,
          totalDepositado: 0,
          diferenciaDia: 0
        };
      }
      dailyCashMap[fecha].depositosVentanilla += Number(c.monto || 0);
    });

    depositosBancoEfectivo.forEach(d => {
      const fecha = extractDateOnly(d.fecha);
      if (!fecha) return;
      if (!dailyCashMap[fecha]) {
        dailyCashMap[fecha] = {
          fecha,
          ventasEfectivoParrot: 0,
          depositosVentanilla: 0,
          depositosBanco: 0,
          totalDepositado: 0,
          diferenciaDia: 0
        };
      }
      dailyCashMap[fecha].depositosBanco += d._monto;
    });

    let runningPending = 0;
    const dailyCashRows = Object.values(dailyCashMap).map(row => {
      const depTotal = Math.max(row.depositosVentanilla, row.depositosBanco);
      const dif = row.ventasEfectivoParrot - depTotal;
      return {
        ...row,
        totalDepositado: depTotal,
        diferenciaDia: dif
      };
    }).sort((a, b) => a.fecha.localeCompare(b.fecha)).map(row => {
      runningPending += row.diferenciaDia;
      return {
        ...row,
        saldoPendienteAcumulado: Math.max(0, runningPending)
      };
    }).reverse();

    return {
      ventasEfectivoParrot,
      montoFichasVentanilla,
      montoEfectivoEstadoCuenta,
      montoEfectivoExcluidoOtroMes,
      totalDepositosEfectivoRealizados,
      totalEfectivoConciliado,
      montoEfectivoSinAsignar,
      efectivoPendienteTicketsMes,
      efectivoPendienteMesAnterior,
      montoEfectivoMesSiguiente,
      diferenciaEfectivo,
      faltaPorDepositar,
      sobranteEfectivo,
      porcentajeDepositado,
      fichasVentanilla,
      depositosBancoEfectivo,
      dailyCashRows
    };
  }, [depositosVentanillaMes, depositosMes, ticketsMes, comprobantes, cashDepositPeriodsMap, cashCarryForwardMap, selectedMonth, esMovimientoEfectivo, extractDateOnly]);

  // Tablas visibles filtradas
  const displayedTickets = useMemo(() => {
    return ticketsMes.filter(c => {
      const isTercero = !!facturadosTerceros[c.id];
      if (filtroTipo === 'publico' && isTercero) return false;
      if (filtroTipo === 'terceros' && !isTercero) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (c.descripcion || '').toLowerCase().includes(q);
        const fechaMatch = (c.fecha || '').includes(q);
        const montoMatch = String(c.monto || '').includes(q);
        if (!descMatch && !fechaMatch && !montoMatch) return false;
      }

      return true;
    });
  }, [ticketsMes, facturadosTerceros, filtroTipo, searchQuery]);

  const displayedFacturas = useMemo(() => {
    return todasLasFacturasMes.filter(f => {
      if (filtroFacturasTipo === 'terceros' && f._isPG) return false;
      if (filtroFacturasTipo === 'publico' && !f._isPG) return false;

      if (searchFacturasQuery.trim()) {
        const q = searchFacturasQuery.toLowerCase();
        const folioMatch = (f.serie_folio || '').toLowerCase().includes(q);
        const clienteMatch = (f._clienteNombre || '').toLowerCase().includes(q);
        const rfcMatch = (f._clienteRfc || '').toLowerCase().includes(q);
        const uuidMatch = (f.uuid_fiscal || '').toLowerCase().includes(q);
        const totalMatch = String(f.total || f._total || '').includes(q);
        if (!folioMatch && !clienteMatch && !rfcMatch && !uuidMatch && !totalMatch) return false;
      }

      return true;
    });
  }, [todasLasFacturasMes, filtroFacturasTipo, searchFacturasQuery]);

  // EXPORTACIÓN EXCEL COMPLETA (7 HOJAS)
  const exportFacturaPublicoExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const summaryRows: any[] = [
        { 'Concepto': '--- FACTURA PÚBLICO EN GENERAL ---', 'Importe': '', 'Notas': '' },
        { 'Concepto': 'Ventas en Efectivo Parrot (Sin Propina)', 'Importe': totalEfectivoParrot, 'Notas': 'Base facturable de Parrot' },
        { 'Concepto': 'Ventas en ParrotPay (Sin Propina)', 'Importe': totalParrotPayParrot, 'Notas': 'Base facturable de Parrot (si aplica)' },
        { 'Concepto': 'TOTAL BASE FACTURABLE PARROT', 'Importe': totalFacturableParrotBase, 'Notas': 'Efectivo + ParrotPay' },
        { 'Concepto': 'Tarjetas BBVA Oficiales (Sin Propina)', 'Importe': comparativoTarjetas.totalTarjetasBbva, 'Notas': 'Según tickets BBVA (depositadas + pendientes)' },
        { 'Concepto': '   de los cuales: Tickets Pendientes por Depositar', 'Importe': montoTicketsPendientesDeposito, 'Notas': `${ticketsPendientesDeposito.length} ticket(s) sin depósito en banco aún` },
        { 'Concepto': 'Propinas (Efectivo, ParrotPay y Tarjetas)', 'Importe': -totalPropinasExcluidas, 'Notas': 'Excluidas de la base de la Factura Global' },
        { 'Concepto': 'Facturas a Clientes Terceros (Individual)', 'Importe': -montoFacturasTerceros, 'Notas': 'Deducible / Ya emitidas' },
        { 'Concepto': 'Tickets POS Marcados a Terceros', 'Importe': -(tercerosEfecParrot + tercerosParrotPay), 'Notas': 'Deducible de facturación' },
        { 'Concepto': 'Monto Manual Facturado a Terceros', 'Importe': -manualTercerosVal, 'Notas': 'Ajuste manual del mes' },
        { 'Concepto': 'TOTAL SUGERIDO FACTURA PÚBLICO GENERAL', 'Importe': totalFacturaPublicoGeneral, 'Notas': 'Importe a timbrar en el SAT' },
        ...(isSeimenjo ? [
          { 'Concepto': 'IVA TRASLADADO FACTURA GLOBAL', 'Importe': ivaFacturaGlobal, 'Notas': 'IVA incluido desglosado del total cobrado' },
          { 'Concepto': 'IVA TRASLADADO FACTURAS A TERCEROS', 'Importe': ivaFacturasTerceros, 'Notas': 'Suma del IVA de CFDI individuales emitidos en el período' },
          { 'Concepto': 'TOTAL IVA TRASLADADO DEL PERÍODO', 'Importe': totalIvaTrasladadoPeriodo, 'Notas': 'Factura Global + CFDI individuales a terceros' }
        ] : []),
        { 'Concepto': '', 'Importe': '', 'Notas': '' },
        { 'Concepto': '--- CONTROL DE EFECTIVO Y DEPÓSITOS (CARGAS USUARIO) ---', 'Importe': '', 'Notas': '' },
        { 'Concepto': 'Ventas Efectivo Parrot', 'Importe': controlEfectivo.ventasEfectivoParrot, 'Notas': 'Cobrado en tienda' },
        { 'Concepto': 'Depósitos Efectivo Realizados (Banco / Fichas)', 'Importe': controlEfectivo.totalDepositosEfectivoRealizados, 'Notas': 'Depositado en practicaja/banco' },
        { 'Concepto': 'FALTA POR DEPOSITAR EN EFECTIVO', 'Importe': controlEfectivo.faltaPorDepositar, 'Notas': controlEfectivo.faltaPorDepositar > 0 ? 'FALTANTE PENDIENTE EN TIENDA' : '100% CUBIERTO' },
        { 'Concepto': '', 'Importe': '', 'Notas': '' },
        { 'Concepto': '--- COMPARATIVO TARJETAS PARROT VS BBVA ---', 'Importe': '', 'Notas': '' },
        { 'Concepto': 'Corte Oficial BBVA Tarjetas (Sin Propina)', 'Importe': comparativoTarjetas.totalTarjetasBbva, 'Notas': 'Fuente Oficial / Correcta' },
        { 'Concepto': 'Tarjetas Registradas en Parrot (Sin Propina)', 'Importe': comparativoTarjetas.totalTarjetasParrot, 'Notas': 'Registro meseros / caja' },
        { 'Concepto': 'Diferencia Tarjetas (BBVA - Parrot)', 'Importe': comparativoTarjetas.diferenciaTarjetas, 'Notas': 'Variación comparativa' },
        { 'Concepto': '', 'Importe': '', 'Notas': '' },
        { 'Concepto': '--- CONCILIACIÓN BBVA (TICKETS VS BANCO - CARGAS USUARIO) ---', 'Importe': '', 'Notas': '' },
        { 'Concepto': 'Tickets BBVA Tarjetas (Sin Propina)', 'Importe': comparativoBbvaBanco.totalTicketsBbvaSinPropina, 'Notas': 'Importes de tarjeta sin propina' },
        { 'Concepto': 'Propinas BBVA Tarjetas (0% SAT)', 'Importe': comparativoBbvaBanco.totalPropinaBbvaTarjetas, 'Notas': 'Propinas cobradas en terminales' },
        { 'Concepto': 'Total Tickets BBVA (Con Propina)', 'Importe': comparativoBbvaBanco.totalTicketsBbvaConPropina, 'Notas': 'Base de tickets + propinas' },
        { 'Concepto': 'Ingresos Entrantes Próximo Mes (No en cuenta / 31 ago)', 'Importe': -comparativoBbvaBanco.totalEntrantesProximoMesConPropina, 'Notas': 'Tickets del mes que ingresan al banco el próximo mes' },
        { 'Concepto': 'Tickets BBVA Acreditados en Mes', 'Importe': comparativoBbvaBanco.totalTicketsAcreditadosMes, 'Notas': 'Tickets efectivamente depositados en este mes' },
        { 'Concepto': 'Ingresos Estado de Cuenta BBVA (Tarjetas/TPV)', 'Importe': comparativoBbvaBanco.totalDepositosBbvaTarjetas, 'Notas': 'Abonos en cuenta BBVA de cargas usuario' },
        { 'Concepto': 'Variación Conciliada (Banco vs Tickets Acreditados)', 'Importe': comparativoBbvaBanco.diferenciaTicketsVsBanco, 'Notas': 'Comisiones / Desfases' },
        { 'Concepto': '', 'Importe': '', 'Notas': '' },
        { 'Concepto': '--- DESFASE DE MES (EXCLUSIONES DE OTRO MES) ---', 'Importe': '', 'Notas': '' },
        { 'Concepto': 'Abonos Tarjetas de Otro Mes Excluidos', 'Importe': comparativoBbvaBanco.totalExcluidosBbvaTarjetas, 'Notas': 'No facturados en este mes' },
        { 'Concepto': 'Depósitos Efectivo de Otro Mes Excluidos', 'Importe': controlEfectivo.montoEfectivoExcluidoOtroMes, 'Notas': 'No facturados en este mes' },
        { 'Concepto': '', 'Importe': '', 'Notas': '' },
        { 'Concepto': 'PROPINAS TOTALES EXCLUIDAS (0% SAT)', 'Importe': totalPropinasExcluidas, 'Notas': 'No sujetas a IVA/ISR' },
      ];

      const cashRows = controlEfectivo.dailyCashRows.map(r => ({
        'Fecha': r.fecha,
        'Ventas Efectivo Parrot': r.ventasEfectivoParrot,
        'Depósitos Ventanilla / Practicaja': r.depositosVentanilla,
        'Depósitos Estado de Cuenta': r.depositosBanco,
        'Total Depositado': r.totalDepositado,
        'Diferencia del Día': r.diferenciaDia,
        'Faltante Acumulado ($)': r.saldoPendienteAcumulado,
        'Estatus': (r.saldoPendienteAcumulado || 0) > 0 ? 'Falta Depositar' : 'Al Día'
      }));

      const tarjetasRows = comparativoTarjetas.dailyRows.map(r => ({
        'Fecha': r.fecha,
        'Parrot Débito': r.parrotDebito,
        'Parrot Crédito': r.parrotCredito,
        'Parrot AMEX': r.parrotAmex,
        'Total Tarjetas Parrot': r.parrotTotal,
        'BBVA Débito (Oficial)': r.bbvaDebito,
        'BBVA Crédito (Oficial)': r.bbvaCredito,
        'BBVA AMEX (Oficial)': r.bbvaAmex,
        'Total Corte BBVA (Oficial)': r.bbvaTotal,
        'Diferencia (BBVA - Parrot)': r.bbvaTotal - r.parrotTotal
      }));

      const facturasRows = todasLasFacturasMes.map(f => ({
        'Folio': f.serie_folio || 'S/F',
        'Fecha': f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
        'Cliente / Receptor': f._clienteNombre,
        'RFC Receptor': f._clienteRfc,
        'Tipo': f._isPG ? 'Público en General' : 'Cliente Tercero (Individual)',
        'Origen': f._isFromPedido ? `Pedido #${f.pedidos?.numero_pedido || 'Asignado'}` : (f.pedidos?.numero_pedido ? `Pedido #${f.pedidos.numero_pedido}` : 'Factura Directa'),
        'Subtotal': Number(f.subtotal || f._subtotal || 0),
        'IVA Trasladado': Number(f.iva_trasladado || f._iva || 0),
        'Total': Number(f.total || f._total || 0),
        'UUID': f.uuid_fiscal || ''
      }));

      const detailRows = ticketsMes.map(c => {
        const efec = Number(c.monto_efectivo || 0);
        const parrot = hasParrot ? Number(c.monto_parrotpay || 0) : 0;
        const bbva = (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0));
        const propinaTotal = Number(c.propina_efectivo || 0) + Number(c.propina_parrotpay || 0) + Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0);
        const isTercero = !!facturadosTerceros[c.id];

        return {
          'Fecha': c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
          'Tipo Comprobante': c.tipo || 'Corte POS',
          'Descripción / Folio': c.descripcion || `Corte POS ${c.fecha}`,
          'Venta Efectivo (Base)': efec,
          'Venta ParrotPay (Base)': parrot,
          'Tarjetas Débito (Sin Propina)': Number(c.monto_debito || 0),
          'Tarjetas Crédito (Sin Propina)': Number(c.monto_credito || 0),
          'Tarjetas AMEX (Sin Propina)': Number(c.monto_amex || 0),
          'Total Tarjetas': bbva,
          'Propinas Excluidas': propinaTotal,
          'Facturado a Tercero': isTercero ? 'SÍ' : 'NO'
        };
      });

      const depositosRows = depositosMes.map(d => ({
        'Fecha': d.fecha ? new Date(d.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
        'Concepto': d.concepto || '',
        'Cuenta Bancaria': d.cuentas_bancarias?.nombre || '',
        'Tipo': esMovimientoEfectivo(d.concepto) ? 'Efectivo / Practicaja' : 'Tarjetas / TPV / Otros',
        'Monto Depósito': d._monto,
        'Estatus Conciliación': d._statusName,
        'Excluido Factura Global': d._isExcluded ? 'SÍ' : 'NO'
      }));

      const desfaseRows = movimientosOtroMes.map(d => {
        const cdms = d._cdms || [];
        const ticketDesc = cdms.map((c: any) => c.comprobantes_deposito?.descripcion || `Ticket ${c.comprobante_id}`).join(', ');
        const ticketFecha = cdms.map((c: any) => c.comprobantes_deposito?.fecha || '').join(', ');

        return {
          'Fecha Banco': d.fecha ? new Date(d.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
          'Concepto Banco': d.concepto || '',
          'Cuenta Bancaria': d.cuentas_bancarias?.nombre || 'BBVA',
          'Tipo': esMovimientoEfectivo(d.concepto) ? 'Efectivo / Practicaja' : 'Tarjetas / TPV',
          'Monto Depósito': d._monto,
          'Ticket / Corte Vinculado': ticketDesc || 'Sin ticket asignado',
          'Fecha Ticket': ticketFecha || '-',
          'Mes Real Detectado': d._mesDetectado || 'Otro Mes',
          'Motivo Desfase': d._otherMonthRazon || 'Desfase de período',
          'Excluido de Factura Global': d._isExcluded ? 'SÍ (Excluido)' : 'NO (Incluido)'
        };
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Factura y Arqueo');

      const wsCash = XLSX.utils.json_to_sheet(cashRows);
      XLSX.utils.book_append_sheet(wb, wsCash, 'Arqueo Efectivo y Depósitos');

      const wsTarjetas = XLSX.utils.json_to_sheet(tarjetasRows);
      XLSX.utils.book_append_sheet(wb, wsTarjetas, 'Tarjetas Parrot vs BBVA');

      const wsFacturas = XLSX.utils.json_to_sheet(facturasRows);
      XLSX.utils.book_append_sheet(wb, wsFacturas, 'Facturas Emitidas');

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Tickets y Cortes POS');

      const wsDepositos = XLSX.utils.json_to_sheet(depositosRows);
      XLSX.utils.book_append_sheet(wb, wsDepositos, 'Depósitos Bancarios');

      const wsDesfase = XLSX.utils.json_to_sheet(desfaseRows);
      XLSX.utils.book_append_sheet(wb, wsDesfase, 'Movimientos de Otro Mes');

      XLSX.writeFile(wb, `Factura_Publico_General_${selectedMonth || 'Todos'}.xlsx`);
    } catch (err: any) {
      console.error('Error al exportar Excel:', err?.message || err);
      alert('Error al generar archivo Excel: ' + (err?.message || err));
    }
  };

  // Auditoría exhaustiva de días del mes: Laborables vs. Descanso vs. Tickets capturados
  const auditoriaDiasMes = useMemo(() => {
    if (!selectedMonth || !/^\d{4}-\d{2}$/.test(selectedMonth)) {
      return {
        dias: [],
        totalDiasMes: 0,
        totalDiasLaborables: 0,
        totalDiasNoLaborables: 0,
        diasConTicket: 0,
        diasLaborablesSinTicket: 0,
        listaFaltantes: [],
        porcentajeCumplimiento: 100
      };
    }

    const [yStr, mStr] = selectedMonth.split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const noLaborablesSet = new Set(currentDiasNoLaborables);

    // Mapear tickets y comprobantes del mes por fecha
    const ticketsPorFecha: Record<string, any[]> = {};
    (comprobantes || []).forEach(c => {
      if (!c.fecha) return;
      const fOnly = extractDateOnly(c.fecha);
      if (!ticketsPorFecha[fOnly]) ticketsPorFecha[fOnly] = [];
      ticketsPorFecha[fOnly].push(c);
    });

    const diasList: Array<{
      dateStr: string;
      dayNum: number;
      dayName: string;
      dayOfWeek: number;
      esNoLaborable: boolean;
      tieneTicket: boolean;
      esFaltante: boolean;
      tickets: any[];
      totalVentaDia: number;
    }> = [];

    const diasNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    let laborablesCount = 0;
    let conTicketCount = 0;
    let faltantesCount = 0;
    const faltantesDates: string[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const dObj = new Date(`${dateStr}T12:00:00Z`);
      const dayOfWeek = dObj.getUTCDay();
      const dayName = diasNombres[dayOfWeek];

      const esNoLab = noLaborablesSet.has(dateStr);
      const dayTickets = ticketsPorFecha[dateStr] || [];
      const tieneTicket = dayTickets.length > 0;
      const esFaltante = !esNoLab && !tieneTicket;

      const totalDia = dayTickets.reduce((sum, t) => {
        const ef = Number(t.monto_efectivo || 0);
        const pp = Number(t.monto_parrotpay || 0);
        const tot = Number(t.monto || 0);
        return sum + (ef + pp > 0 ? (ef + pp) : tot);
      }, 0);

      if (!esNoLab) {
        laborablesCount++;
        if (tieneTicket) {
          conTicketCount++;
        } else {
          faltantesCount++;
          faltantesDates.push(dateStr);
        }
      }

      diasList.push({
        dateStr,
        dayNum: day,
        dayName,
        dayOfWeek,
        esNoLaborable: esNoLab,
        tieneTicket,
        esFaltante,
        tickets: dayTickets,
        totalVentaDia: totalDia
      });
    }

    const cumplimiento = laborablesCount > 0 ? Math.round((conTicketCount / laborablesCount) * 100) : 100;

    return {
      dias: diasList,
      totalDiasMes: daysInMonth,
      totalDiasLaborables: laborablesCount,
      totalDiasNoLaborables: noLaborablesSet.size,
      diasConTicket: conTicketCount,
      diasLaborablesSinTicket: faltantesCount,
      listaFaltantes: faltantesDates,
      porcentajeCumplimiento: cumplimiento
    };
  }, [selectedMonth, currentDiasNoLaborables, comprobantes, extractDateOnly]);

  // Todas las ventas (tickets POS, terminales bancarias BBVA, depósitos) ya incluyen el 16% de IVA
  const totalConIvaFacturaGlobal = Math.max(0, totalFacturaPublicoGeneral);
  const subtotalFacturaGlobal = Number((totalConIvaFacturaGlobal / 1.16).toFixed(2));
  const ivaFacturaGlobal = Number((totalConIvaFacturaGlobal - subtotalFacturaGlobal).toFixed(2));
  const totalIvaTrasladadoPeriodo = Number((ivaFacturaGlobal + ivaFacturasTerceros).toFixed(2));

  // BOLSA DE VENTAS DEL MES Y CONCILIACIÓN DE DESFASE TEMPORAL
  // Tickets de cierre de mes (últimos 2 días) aún no depositados en el banco
  const ticketsFinDeMesPendientes = useMemo(() => {
    if (!selectedMonth) return [];
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(month)) return [];

    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const thresholdDay = Math.max(1, lastDayOfMonth - 1);

    return ticketsMes.filter(t => {
      if (!t.fecha) return false;
      const d = new Date(t.fecha);
      const day = d.getUTCDate();
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      if (y !== year || m !== month) return false;
      if (day < thresholdDay) return false;
      // Los marcados como "Pendiente por depositar" ya se reconocen aparte (evita doble conteo)
      return !t._isCuadrado100 && !t._isPendienteDeposito;
    });
  }, [ticketsMes, selectedMonth]);

  const montoTicketsFinDeMesPendientes = useMemo(() => {
    return ticketsFinDeMesPendientes.reduce((acc, t) => acc + Number(t.monto || 0), 0);
  }, [ticketsFinDeMesPendientes]);

  const sugerenciaVentasFinDeMes = useMemo(() => {
    if (montoTicketsFinDeMesPendientes > 0) {
      return Number(montoTicketsFinDeMesPendientes.toFixed(2));
    }
    if (!auditoriaDiasMes || !auditoriaDiasMes.dias || auditoriaDiasMes.dias.length === 0) return 0;
    const diasConVenta = auditoriaDiasMes.dias.filter(d => d.totalVentaDia > 0);
    if (diasConVenta.length === 0) return 0;
    const ultimoDia = diasConVenta[diasConVenta.length - 1];
    return Number(ultimoDia.totalVentaDia || 0);
  }, [montoTicketsFinDeMesPendientes, auditoriaDiasMes]);

  const ventasDiaSiguienteMes = Number(ventasDiaSiguienteMap[selectedMonth || 'GLOBAL'] || 0);
  const bolsaTotalVentasMes = totalEfectivoParrot + (comparativoTarjetas?.totalTarjetasBbva || 0) + totalParrotPayParrot;
  const depositosMesPasadoExcluidos = totalMontoExcluidoOtroMes;
  const depositosNoEsVentaExcluidos = totalMontoDepositosNoEsVenta;
  const depositosNetosMes = Math.max(0, totalMontoDepositosMes - depositosMesPasadoExcluidos - depositosNoEsVentaExcluidos);
  const depositosPendientesDeVincular = totalMontoDepositosPendientesAsociar;
  const depositosVinculadosCuadrados = totalMontoDepositosVinculadosCuadrados;
  const diferenciaBolsaCierre = bolsaTotalVentasMes - depositosNetosMes - ventasDiaSiguienteMes - montoTicketsPendientesDeposito;

  return {
    loading,
    empresaNombre,
    isSakura,
    isSeimenjo,
    cuentasBancarias,
    selectedMonth,
    refreshPeriodStatus,
    fetchData,
    tabActiva,
    setTabActiva,
    subTabComparativo,
    setSubTabComparativo,
    // Estados y setters de filtros
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
    // Toggles y acciones
    toggleExcludeMovement,
    toggleExcludeComprobante,
    toggleManualOtherMonth,
    toggleProximoMesComp,
    setAllExcludedMovements,
    toggleNoEsVentaMovement,
    cashDepositPeriods: cashDepositPeriodsMap[selectedMonth || 'GLOBAL'] || {},
    setCashDepositPeriod,
    vincularComprobante,
    desvincularComprobante,
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
    // Totales calculados oficiales Factura Global
    subtotalFacturaGlobal,
    ivaFacturaGlobal,
    totalConIvaFacturaGlobal,
    ivaFacturasTerceros,
    totalIvaTrasladadoPeriodo,
    totalFacturableParrotBase,
    // Datos crudos y comprobantes
    comprobantes,
    // Datos procesados
    userCargasMes,
    pedidosMes,
    todasLasFacturasMes,
    displayedFacturas,
    ticketsMes,
    displayedTickets,
    depositosMes,
    movimientosDeposito,
    movimientosOtroMes,
    ticketsOtroMes,
    facturasTercerosMes,
    facturasPgMes,
    totalFacturadoMes,
    // Métricas Factura PG
    totalFacturaPublicoGeneral,
    totalEfectivoParrot,
    totalParrotPayParrot,
    totalTercerosDeducibles,
    efectivoPublicoGeneral,
    parrotPayPublicoGeneral,
    manualTercerosVal,
    currentMonthKey,
    totalPropinasExcluidas,
    // Comparativos y Arqueo
    controlEfectivo,
    comparativoTarjetas,
    comparativoBbvaBanco,
    // Métricas Depósitos
    totalMontoDepositosMes,
    totalDepositosConTicketMes,
    montoDepositosConTicketMes,
    totalDepositosFacturadosMes,
    montoDepositosFacturadosMes,
    totalMontoExcluidoOtroMes,
    // Bolsa de Ventas y Conciliación de Desfase
    bolsaTotalVentasMes,
    depositosMesPasadoExcluidos,
    depositosNoEsVentaExcluidos,
    depositosNetosMes,
    depositosPendientesDeVincular,
    depositosVinculadosCuadrados,
    ventasDiaSiguienteMes,
    setVentasDiaSiguienteMonto,
    diferenciaBolsaCierre,
    sugerenciaVentasFinDeMes,
    ticketsFinDeMesPendientes,
    montoTicketsFinDeMesPendientes,
    // Tickets pendientes por depositar
    togglePendienteDeposito,
    ticketsPendientesDeposito,
    montoTicketsPendientesDeposito,
    ticketsBbvaSinDeposito,
    isTicketBbva,
    guardarAjustesPeriodo,
  };
}
