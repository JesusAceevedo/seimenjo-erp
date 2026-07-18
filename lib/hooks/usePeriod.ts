'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useEmpresaId } from './useEmpresaId';

export function usePeriod() {
  const getEmpresaId = useEmpresaId();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('seimenjo_selected_period') || getInitialPeriod();
    }
    return getInitialPeriod();
  });

  const [periodStatus, setPeriodStatus] = useState<string>('abierto');
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);

  function getInitialPeriod() {
    const d = new Date();
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    return `${yr}-${mo}`;
  }

  const checkCierre = async (month: string) => {
    setIsLoadingStatus(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;
      const { data: cierreRecord, error } = await supabase
        .from('cierres_mensuales')
        .select('estatus')
        .eq('empresa_id', empresaId)
        .eq('mes', month)
        .maybeSingle();

      if (!error && cierreRecord) {
        setPeriodStatus(cierreRecord.estatus);
      } else {
        setPeriodStatus('abierto');
      }
    } catch (e) {
      console.error('Error fetching period status:', e);
      setPeriodStatus('abierto');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    checkCierre(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    const handlePeriodChange = () => {
      if (typeof window !== 'undefined') {
        const p = localStorage.getItem('seimenjo_selected_period') || getInitialPeriod();
        if (p !== selectedMonth) {
          setSelectedMonth(p);
        }
      }
    };
    window.addEventListener('seimenjo_period_changed', handlePeriodChange);
    return () => window.removeEventListener('seimenjo_period_changed', handlePeriodChange);
  }, [selectedMonth]);

  const changePeriod = (newPeriod: string) => {
    setSelectedMonth(newPeriod);
    if (typeof window !== 'undefined') {
      localStorage.setItem('seimenjo_selected_period', newPeriod);
      window.dispatchEvent(new Event('seimenjo_period_changed'));
    }
  };

  return {
    selectedMonth,
    periodStatus,
    isLoadingStatus,
    changePeriod,
    refreshPeriodStatus: () => checkCierre(selectedMonth),
  };
}
