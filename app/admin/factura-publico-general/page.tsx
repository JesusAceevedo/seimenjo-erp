'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import PeriodSelector from '../_components/PeriodSelector';
import {
  FileText,
  FileSpreadsheet,
  RefreshCw,
  ArrowLeft,
  Search,
  List,
  DollarSign,
  Users,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Percent,
  Filter,
  Check,
  X,
  Receipt,
  Download,
  Globe,
  UserCheck,
  Package
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function FacturaPublicoGeneralPage() {
  const router = useRouter();
  const { isDarkMode } = useThemeMode();
  const getEmpresaId = useEmpresaId();
  const { selectedMonth, refreshPeriodStatus } = usePeriod();

  const [loading, setLoading] = useState(true);
  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);

  // Pestaña principal activa: 'facturas' o 'tickets'
  const [tabActiva, setTabActiva] = useState<'facturas' | 'tickets'>('facturas');

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

  const toggleFacturadoTercero = (id: string) => {
    setFacturadosTerceros(prev => {
      const updated = { ...prev, [id]: !prev[id] };
      if (typeof window !== 'undefined') {
        localStorage.setItem('facturados_terceros_tickets', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const setMontoManualTercero = (mesKey: string, monto: number) => {
    setMontoManualTercerosMap(prev => {
      const updated = { ...prev, [mesKey]: Math.max(0, monto) };
      if (typeof window !== 'undefined') {
        localStorage.setItem('monto_manual_terceros_mes', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const formatCurrency = (val: number | string | null | undefined) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(num);
  };

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) {
        setLoading(false);
        return;
      }

      // 1. Cargar Cuentas Bancarias
      const { data: cbData, error: cbErr } = await supabase
        .from('cuentas_bancarias')
        .select('*')
        .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
        .order('nombre', { ascending: true });

      if (cbErr) {
        console.warn('Error al cargar cuentas bancarias:', cbErr.message || cbErr);
      }
      setCuentasBancarias(cbData || []);

      // 2. Cargar Comprobantes / Tickets
      const { data: compData, error: compErr } = await supabase
        .from('comprobantes_deposito')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });

      if (compErr) throw compErr;
      setComprobantes(compData || []);

      // 3. Cargar Facturas Clientes Emitidas (con clientes y pedidos)
      const { data: fcData, error: fcErr } = await supabase
        .from('facturas_clientes')
        .select('*, clientes(id, nombre_local, razon_social, rfc), pedidos(id, numero_pedido, cliente_nombre, precio_total), estatus_factura(nombre)')
        .eq('empresa_id', empresaId)
        .order('fecha_emision', { ascending: false });

      if (fcErr) console.warn('Error al cargar facturas_clientes:', fcErr);
      setFacturas(fcData || []);

      // 4. Cargar Pedidos del Periodo
      const { data: pData, error: pErr } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, cliente_nombre, precio_total, fecha_pedido, folio_factura, metodo_pago, clientes(id, nombre_local, razon_social, rfc), facturas_clientes(id, serie_folio, total, uuid_fiscal)')
        .eq('empresa_id', empresaId)
        .order('fecha_pedido', { ascending: false });

      if (pErr) console.warn('Error al cargar pedidos:', pErr);
      setPedidos(pData || []);

    } catch (err: any) {
      console.error('Error al cargar datos de factura público general:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // Filtrado de tickets por mes y criterios base
  const ticketsMes = useMemo(() => {
    return comprobantes.filter(c => {
      if (c.tipo === 'deposito_ventanilla') return false;
      if (c.descripcion && c.descripcion.includes('COMPROBANTE_EFECTIVO_')) return false;
      const mes = c.fecha ? c.fecha.substring(0, 7) : '';
      if (selectedMonth && mes !== selectedMonth) return false;
      if (selectedCuentaId && c.cuenta_bancaria_id && c.cuenta_bancaria_id !== selectedCuentaId) return false;
      return true;
    });
  }, [comprobantes, selectedMonth, selectedCuentaId]);

  // Facturas emitidas en el mes
  const facturasMes = useMemo(() => {
    return facturas
      .filter(f => {
        const mes = f.fecha_emision ? f.fecha_emision.substring(0, 7) : '';
        if (selectedMonth && mes !== selectedMonth) return false;
        return true;
      })
      .map(f => {
        const rfc = (f.clientes?.rfc || '').trim().toUpperCase();
        const name = (f.clientes?.nombre_local || f.clientes?.razon_social || '').toUpperCase();
        const isPG = rfc.includes('XAXX010101') || name.includes('PUBLICO') || f.uso_cfdi_clave === 'S01' || (f.serie_folio || '').toLowerCase().includes('global');
        return {
          ...f,
          _isPG: isPG,
          _clienteNombre: f.clientes?.nombre_local || f.clientes?.razon_social || (isPG ? 'Público en General' : 'Cliente General'),
          _clienteRfc: f.clientes?.rfc || (isPG ? 'XAXX010101000' : 'S/N')
        };
      });
  }, [facturas, selectedMonth]);

  // Pedidos del mes
  const pedidosMes = useMemo(() => {
    return pedidos.filter(p => {
      const mes = p.fecha_pedido ? p.fecha_pedido.substring(0, 7) : '';
      if (selectedMonth && mes !== selectedMonth) return false;
      return true;
    });
  }, [pedidos, selectedMonth]);

  // CÁLCULO ESTRICTO DE FACTURAS Y PEDIDOS A CLIENTES TERCEROS
  const {
    facturasTercerosMes,
    facturasPgMes,
    montoFacturasTerceros,
    montoFacturasPg,
    pedidosTercerosExtra,
    montoPedidosTercerosExtra,
    totalFacturadoTercerosPedidosYFacturas
  } = useMemo(() => {
    const facTerceros = facturasMes.filter(f => !f._isPG);
    const facPg = facturasMes.filter(f => f._isPG);
    const sumFacTerceros = facTerceros.reduce((acc, f) => acc + Number(f.total || 0), 0);
    const sumFacPg = facPg.reduce((acc, f) => acc + Number(f.total || 0), 0);

    // Pedidos facturados con cliente tercero que no estén ya contados en facturas_clientes
    const pedExtra = pedidosMes.filter(p => {
      const hasFactura = !!p.folio_factura || (p.facturas_clientes && p.facturas_clientes.length > 0);
      if (!hasFactura) return false;
      const rfc = (p.clientes?.rfc || '').toUpperCase();
      const name = (p.cliente_nombre || p.clientes?.nombre_local || '').toUpperCase();
      const isPg = rfc.includes('XAXX010101') || name.includes('PUBLICO');
      if (isPg) return false;

      // Si ya está reflejado en facTerceros, no duplicar
      const alreadyInFac = facTerceros.some(f => f.pedido_id === p.id || (p.folio_factura && f.serie_folio === p.folio_factura));
      return !alreadyInFac;
    });
    const sumPedExtra = pedExtra.reduce((acc, p) => acc + Number(p.precio_total || 0), 0);

    return {
      facturasTercerosMes: facTerceros,
      facturasPgMes: facPg,
      montoFacturasTerceros: sumFacTerceros,
      montoFacturasPg: sumFacPg,
      pedidosTercerosExtra: pedExtra,
      montoPedidosTercerosExtra: sumPedExtra,
      totalFacturadoTercerosPedidosYFacturas: sumFacTerceros + sumPedExtra
    };
  }, [facturasMes, pedidosMes]);

  // Cálculos Globales de Facturación
  const {
    totalVentasBrutasBase,
    totalPropinasExcluidas,
    totalTercerosBase,
    totalEfectivoBase,
    totalBbvaBase,
    totalParrotBase,
    totalTercerosEfectivo,
    totalTercerosBbva,
    totalTercerosParrot,
    totalTercerosFinal,
    totalFacturaPublicoGeneral,
    efectivoPublicoGeneral,
    bbvaPublicoGeneral,
    parrotPublicoGeneral,
    manualTercerosVal,
    currentMonthKey
  } = useMemo(() => {
    let brutasBase = 0;
    let propinas = 0;
    let tercerosBase = 0;

    let efecBase = 0;
    let bbvaBase = 0;
    let parrotBase = 0;

    let tercerosEfec = 0;
    let tercerosBbva = 0;
    let tercerosParrot = 0;

    ticketsMes.forEach(c => {
      const isParrotTicket = (c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('PARROT')) || c.tipo === 'corte_parrot';

      const efec = Number(c.monto_efectivo || 0);
      const parrot = Number(c.monto_parrotpay || 0);
      const bbva = isParrotTicket ? 0 : (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0));
      const baseTotal = efec + bbva + parrot;

      const propinaTotal = Number(c.propina_efectivo || 0) + Number(c.propina_parrotpay || 0) +
                           (isParrotTicket ? 0 : (Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0)));

      brutasBase += baseTotal;
      propinas += propinaTotal;

      efecBase += efec;
      bbvaBase += bbva;
      parrotBase += parrot;

      if (facturadosTerceros[c.id]) {
        tercerosBase += baseTotal;
        tercerosEfec += efec;
        tercerosBbva += bbva;
        tercerosParrot += parrot;
      }
    });

    const monthKey = selectedMonth || 'GLOBAL';
    const manualVal = Number(montoManualTercerosMap[monthKey] || 0);

    // Total a descontar por facturas a terceros:
    // Incluye facturas emitidas a clientes individuales + pedidos facturados a clientes + tickets marcados + monto manual
    const tercerosFinal = totalFacturadoTercerosPedidosYFacturas + tercerosBase + manualVal;
    const facturaPublico = Math.max(0, brutasBase - tercerosFinal);
    const efecPublico = Math.max(0, efecBase - tercerosEfec);
    const bbvaPublico = Math.max(0, bbvaBase - tercerosBbva);
    const parrotPublico = Math.max(0, parrotBase - tercerosParrot);

    return {
      totalVentasBrutasBase: brutasBase,
      totalPropinasExcluidas: propinas,
      totalTercerosBase: tercerosBase,
      totalEfectivoBase: efecBase,
      totalBbvaBase: bbvaBase,
      totalParrotBase: parrotBase,
      totalTercerosEfectivo: tercerosEfec,
      totalTercerosBbva: tercerosBbva,
      totalTercerosParrot: tercerosParrot,
      totalTercerosFinal: tercerosFinal,
      totalFacturaPublicoGeneral: facturaPublico,
      efectivoPublicoGeneral: efecPublico,
      bbvaPublicoGeneral: bbvaPublico,
      parrotPublicoGeneral: parrotPublico,
      manualTercerosVal: manualVal,
      currentMonthKey: monthKey
    };
  }, [ticketsMes, cuentasBancarias, facturadosTerceros, montoManualTercerosMap, selectedMonth, totalFacturadoTercerosPedidosYFacturas]);

  // Filtrado de tabla visible de Tickets
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

  // Filtrado de tabla visible de Facturas Emitidas
  const displayedFacturas = useMemo(() => {
    return facturasMes.filter(f => {
      if (filtroFacturasTipo === 'terceros' && f._isPG) return false;
      if (filtroFacturasTipo === 'publico' && !f._isPG) return false;

      if (searchFacturasQuery.trim()) {
        const q = searchFacturasQuery.toLowerCase();
        const folioMatch = (f.serie_folio || '').toLowerCase().includes(q);
        const clienteMatch = (f._clienteNombre || '').toLowerCase().includes(q);
        const rfcMatch = (f._clienteRfc || '').toLowerCase().includes(q);
        const uuidMatch = (f.uuid_fiscal || '').toLowerCase().includes(q);
        const totalMatch = String(f.total || '').includes(q);
        if (!folioMatch && !clienteMatch && !rfcMatch && !uuidMatch && !totalMatch) return false;
      }

      return true;
    });
  }, [facturasMes, filtroFacturasTipo, searchFacturasQuery]);

  // Exportar Excel Completo
  const exportFacturaPublicoExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const summaryRows = [
        { 'Concepto': 'Ventas Efectivo (Sin Propina)', 'Venta Bruta Base': totalEfectivoBase, 'Facturado a Terceros': totalTercerosEfectivo, 'Factura Público en General': efectivoPublicoGeneral },
        { 'Concepto': 'Ventas Tarjetas BBVA/POS (Sin Propina)', 'Venta Bruta Base': totalBbvaBase, 'Facturado a Terceros': totalTercerosBbva, 'Factura Público en General': bbvaPublicoGeneral },
        { 'Concepto': 'Ventas ParrotPay (Sin Propina)', 'Venta Bruta Base': totalParrotBase, 'Facturado a Terceros': totalTercerosParrot, 'Factura Público en General': parrotPublicoGeneral },
        { 'Concepto': 'Facturas / Pedidos a Clientes Terceros', 'Venta Bruta Base': 0, 'Facturado a Terceros': totalFacturadoTercerosPedidosYFacturas, 'Factura Público en General': -totalFacturadoTercerosPedidosYFacturas },
        { 'Concepto': 'Monto Manual Facturado a Terceros', 'Venta Bruta Base': 0, 'Facturado a Terceros': manualTercerosVal, 'Factura Público en General': -manualTercerosVal },
        { 'Concepto': '--- TOTAL A FACTURAR GLOBAL ---', 'Venta Bruta Base': totalVentasBrutasBase, 'Facturado a Terceros': totalTercerosFinal, 'Factura Público en General': totalFacturaPublicoGeneral },
        { 'Concepto': 'PROPINAS TOTALES (NO CONTABILIZADAS / 0% IMPUESTO)', 'Venta Bruta Base': 0, 'Facturado a Terceros': 0, 'Factura Público en General': totalPropinasExcluidas }
      ];

      // Hoja de Facturas Emitidas
      const facturasRows = facturasMes.map(f => ({
        'Folio': f.serie_folio || 'S/F',
        'Fecha': f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
        'Cliente / Receptor': f._clienteNombre,
        'RFC Receptor': f._clienteRfc,
        'Tipo': f._isPG ? 'Público en General' : 'Cliente Tercero (Individual)',
        'Pedido': f.pedidos?.numero_pedido ? `Pedido #${f.pedidos.numero_pedido}` : (f.pedido_id ? 'Asignado' : 'Sin pedido'),
        'Subtotal': Number(f.subtotal || 0),
        'IVA Trasladado': Number(f.iva_trasladado || 0),
        'Total': Number(f.total || 0),
        'UUID': f.uuid_fiscal || ''
      }));

      // Hoja de Tickets POS
      const detailRows = ticketsMes.map(c => {
        const isParrotTicket = (c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('PARROT')) || c.tipo === 'corte_parrot';

        const efec = Number(c.monto_efectivo || 0);
        const parrot = Number(c.monto_parrotpay || 0);
        const bbva = isParrotTicket ? 0 : (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0));
        const baseTotal = efec + bbva + parrot;
        const propinaTotal = Number(c.propina_efectivo || 0) + Number(c.propina_parrotpay || 0) +
                             (isParrotTicket ? 0 : (Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0)));
        const isTercero = !!facturadosTerceros[c.id];

        return {
          'Fecha': c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
          'Descripción / Folio': c.descripcion || `Corte POS ${c.fecha}`,
          'Importe sin Propina (Base)': baseTotal,
          'Venta Efectivo (Base)': efec,
          'Venta Tarjetas BBVA (Base)': bbva,
          'Venta ParrotPay (Base)': parrot,
          'Propinas Excluidas ($)': propinaTotal,
          'Facturado a Terceros (Individual)': isTercero ? 'SÍ (Facturado a Cliente)' : 'NO (Público General)',
          'Monto a Público en General': isTercero ? 0 : baseTotal
        };
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Factura Global');

      const wsFacturas = XLSX.utils.json_to_sheet(facturasRows);
      XLSX.utils.book_append_sheet(wb, wsFacturas, 'Facturas Emitidas');

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Tickets y Cortes POS');

      XLSX.writeFile(wb, `Factura_Publico_General_${selectedMonth || 'Todos'}.xlsx`);
    } catch (err: any) {
      console.error('Error al exportar Excel:', err?.message || err);
      alert('Error al generar archivo Excel: ' + (err?.message || err));
    }
  };

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
                  className="p-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                  title="Volver a Contabilidad y Bancos"
                >
                  <ArrowLeft size={16} />
                </button>
                <h2 className="text-3xl font-extrabold flex items-center gap-3">
                  <FileText className="text-emerald-500 w-8 h-8" /> Factura Público en General
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
                Cálculo y control de ventas mensuales para facturación global. Muestra facturas emitidas y resta automáticamente facturas a terceros y propinas.
              </p>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
              <button
                onClick={fetchData}
                className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-emerald-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
                title="Refrescar datos"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* TARJETAS RESUMEN DE FACTURACIÓN AL PÚBLICO EN GENERAL */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* KPI TOTAL A FACTURAR PÚBLICO EN GENERAL */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">Total a Facturar Público en General</span>
                <h3 className="text-3xl font-black font-mono mt-1">{formatCurrency(totalFacturaPublicoGeneral)}</h3>
                <p className="text-[10px] text-emerald-100 mt-1 font-sans">
                  Ventas netas sin propinas ni facturas individuales a clientes ({selectedMonth || 'Todos los períodos'}).
                </p>
              </div>
              <button
                type="button"
                onClick={exportFacturaPublicoExcel}
                className="mt-4 w-full py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow"
              >
                <FileSpreadsheet size={14} /> Exportar Reporte Excel
              </button>
            </div>

            {/* DESGLOSE POR MÉTODO DE PAGO */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">💳 Desglose Neto por Método</span>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-1.5">
                  <span className="text-gray-600 dark:text-gray-400 font-sans">💵 Efectivo:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(efectivoPublicoGeneral)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-1.5">
                  <span className="text-gray-600 dark:text-gray-400 font-sans">💳 Tarjetas BBVA:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(bbvaPublicoGeneral)}</span>
                </div>
                <div className="flex justify-between border-b border-gray-100 dark:border-gray-900 pb-1.5">
                  <span className="text-gray-600 dark:text-gray-400 font-sans">🦜 ParrotPay:</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(parrotPublicoGeneral)}</span>
                </div>
              </div>
            </div>

            {/* FACTURADO A TERCEROS (INCLUYE FACTURAS Y PEDIDOS) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-955 border border-purple-200 dark:border-purple-900/40 shadow-sm flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block flex items-center justify-between">
                  <span>👤 Facturado a Clientes Terceros</span>
                  <span className="text-[9px] font-extrabold bg-purple-100 dark:bg-purple-955 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded">
                    {facturasTercerosMes.length + pedidosTercerosExtra.length} Facturas/Pedidos
                  </span>
                </span>
                <h3 className="text-2xl font-extrabold font-mono text-purple-700 dark:text-purple-300 mt-0.5">
                  {formatCurrency(totalTercerosFinal)}
                </h3>
                
                <div className="mt-1 space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400 font-sans">
                  <div className="flex justify-between">
                    <span>Facturas / Pedidos Terceros:</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                      {formatCurrency(totalFacturadoTercerosPedidosYFacturas)}
                    </span>
                  </div>
                  {totalTercerosBase > 0 && (
                    <div className="flex justify-between">
                      <span>Tickets POS Marcados:</span>
                      <span className="font-bold text-gray-700 dark:text-gray-300 font-mono">
                        {formatCurrency(totalTercerosBase)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-purple-100 dark:border-purple-900/30 space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-purple-700 dark:text-purple-300 flex items-center justify-between">
                  <span>✏️ Importe Manual a Restar ($):</span>
                  {manualTercerosVal > 0 && (
                    <button
                      type="button"
                      onClick={() => setMontoManualTercero(currentMonthKey, 0)}
                      className="text-[9px] text-red-500 hover:underline font-bold"
                    >
                      Limpiar
                    </button>
                  )}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualTercerosVal || ''}
                  onChange={(e) => setMontoManualTercero(currentMonthKey, Number(e.target.value))}
                  placeholder="Monto adicional a descontar..."
                  className="w-full bg-purple-50/80 dark:bg-purple-955/50 border border-purple-300 dark:border-purple-800 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-purple-900 dark:text-purple-100 outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                />
              </div>
            </div>

            {/* PROPINAS EXCLUIDAS */}
            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">🚫 Propinas (No Contabilizadas)</span>
                <h3 className="text-2xl font-extrabold font-mono text-gray-600 dark:text-gray-400 mt-1">{formatCurrency(totalPropinasExcluidas)}</h3>
                <p className="text-[10px] text-gray-400 mt-1 font-sans">Las propinas están 100% excluidas de la facturación fiscal.</p>
              </div>
              <span className="text-[9px] font-extrabold text-gray-400 uppercase bg-gray-200 dark:bg-gray-800 px-2.5 py-1 rounded-lg w-fit">
                0% Impuesto / Sin Facturar
              </span>
            </div>

          </div>

          {/* NAVEGACIÓN ENTRE PESTAÑAS: FACTURAS EMITIDAS VS CONTROL DE TICKETS */}
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
            <button
              type="button"
              onClick={() => setTabActiva('facturas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                tabActiva === 'facturas'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
              }`}
            >
              <FileText size={15} />
              <span>Facturas Emitidas ({facturasMes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTabActiva('tickets')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                tabActiva === 'tickets'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
              }`}
            >
              <List size={15} />
              <span>Cortes y Tickets POS ({ticketsMes.length})</span>
            </button>
          </div>

          {/* CONTENEDOR PRINCIPAL SEGÚN PESTAÑA */}
          {tabActiva === 'facturas' ? (
            /* ── PESTAÑA 1: TODAS LAS FACTURAS EMITIDAS ── */
            <div className="bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
              
              {/* BARRA DE HERRAMIENTAS Y FILTROS DE FACTURAS */}
              <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
                <div>
                  <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <FileText size={16} className="text-blue-500" /> Facturas Emitidas ({displayedFacturas.length} de {facturasMes.length})
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Listado completo de CFDIs emitidos por la empresa en el período. Identifica fácilmente facturas a terceros individuales vs facturas globales.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Filtro Tipo de Factura */}
                  <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-900 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFiltroFacturasTipo('todas')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                        filtroFacturasTipo === 'todas'
                          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Todas ({facturasMes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroFacturasTipo('terceros')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                        filtroFacturasTipo === 'terceros'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      👤 Clientes Terceros ({facturasTercerosMes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroFacturasTipo('publico')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                        filtroFacturasTipo === 'publico'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      🌐 Público General ({facturasPgMes.length})
                    </button>
                  </div>

                  {/* Búsqueda de facturas */}
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      value={searchFacturasQuery}
                      onChange={(e) => setSearchFacturasQuery(e.target.value)}
                      placeholder="Buscar folio, cliente, RFC, monto..."
                      className="pl-8 pr-3 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 w-56"
                    />
                  </div>
                </div>
              </div>

              {/* TABLA DE FACTURAS EMITIDAS */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-955 z-10">
                      <th className="p-3">Folio / Serie</th>
                      <th className="p-3">Fecha Emisión</th>
                      <th className="p-3">Cliente / Receptor</th>
                      <th className="p-3">RFC Receptor</th>
                      <th className="p-3 text-center">Clasificación</th>
                      <th className="p-3">Pedido Vinculado</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="p-3 text-right">IVA</th>
                      <th className="p-3 text-right font-black">Total Factura</th>
                      <th className="p-3 text-center">Archivos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {displayedFacturas.map(f => (
                      <tr key={f.id} className={`hover:bg-gray-50/80 dark:hover:bg-gray-900/50 transition-colors ${f._isPG ? 'bg-emerald-50/20 dark:bg-emerald-955/10' : 'bg-purple-50/20 dark:bg-purple-955/10'}`}>
                        {/* Folio */}
                        <td className="p-3 font-mono font-black text-gray-900 dark:text-white">
                          {f.serie_folio || 'S/F'}
                        </td>

                        {/* Fecha */}
                        <td className="p-3 font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {f.fecha_emision ? new Date(f.fecha_emision).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : 'Sin fecha'}
                        </td>

                        {/* Cliente */}
                        <td className="p-3 font-bold text-gray-800 dark:text-gray-100">
                          {f._clienteNombre}
                        </td>

                        {/* RFC */}
                        <td className="p-3 font-mono text-gray-500 dark:text-gray-400">
                          {f._clienteRfc}
                        </td>

                        {/* Clasificación */}
                        <td className="p-3 text-center">
                          {f._isPG ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-955/50 text-emerald-800 dark:text-emerald-300">
                              <Globe size={11} /> Público General
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-955/50 text-purple-800 dark:text-purple-300">
                              <UserCheck size={11} /> Cliente Tercero
                            </span>
                          )}
                        </td>

                        {/* Pedido Vinculado */}
                        <td className="p-3">
                          {f.pedidos?.numero_pedido ? (
                            <span className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              <Package size={11} /> Pedido #{f.pedidos.numero_pedido}
                            </span>
                          ) : f.pedido_id ? (
                            <span className="text-[11px] text-gray-500 font-mono">Pedido ID: {f.pedido_id.substring(0, 8)}</span>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Sin pedido directo</span>
                          )}
                        </td>

                        {/* Subtotal */}
                        <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">
                          {formatCurrency(f.subtotal)}
                        </td>

                        {/* IVA */}
                        <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                          {formatCurrency(f.iva_trasladado)}
                        </td>

                        {/* Total */}
                        <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                          {formatCurrency(f.total)}
                        </td>

                        {/* Archivos */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {f.xml_url && (
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(f.xml_url, `${f.serie_folio || 'factura'}.xml`)}
                                className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold hover:bg-blue-200 transition-colors"
                                title="Descargar XML"
                              >
                                XML
                              </button>
                            )}
                            {f.pdf_url && (
                              <button
                                type="button"
                                onClick={() => handleDownloadFile(f.pdf_url, `${f.serie_folio || 'factura'}.pdf`)}
                                className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-bold hover:bg-red-200 transition-colors"
                                title="Descargar PDF"
                              >
                                PDF
                              </button>
                            )}
                            {!f.xml_url && !f.pdf_url && (
                              <span className="text-[10px] text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {displayedFacturas.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-gray-400 italic">
                          {loading ? 'Cargando facturas emitidas...' : 'No se encontraron facturas emitidas para este mes.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          ) : (
            /* ── PESTAÑA 2: CONTROL DE FACTURACIÓN POR TICKET POS ── */
            <div className="bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
              
              {/* BARRA DE HERRAMIENTAS Y FILTROS */}
              <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
                <div>
                  <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <List size={16} className="text-emerald-500" /> Control de Facturación por Ticket ({displayedTickets.length} de {ticketsMes.length})
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Marca la casilla "Factura de Terceros" en los tickets que ya fueron facturados a clientes particulares para restarlos de la factura global.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Selector de Cuentas */}
                  <select
                    value={selectedCuentaId}
                    onChange={(e) => setSelectedCuentaId(e.target.value)}
                    className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-2.5 py-1 rounded-lg text-xs text-gray-900 dark:text-white font-sans font-semibold outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Todas las Cuentas</option>
                    {cuentasBancarias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                    ))}
                  </select>

                  {/* Filtro Tipo */}
                  <div className="flex items-center gap-1 bg-gray-200/60 dark:bg-gray-900 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFiltroTipo('todos')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                        filtroTipo === 'todos'
                          ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Todos ({ticketsMes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroTipo('publico')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                        filtroTipo === 'publico'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Público General
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroTipo('terceros')}
                      className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                        filtroTipo === 'terceros'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Facturados a Terceros
                    </button>
                  </div>

                  {/* Búsqueda */}
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar ticket..."
                      className="pl-8 pr-3 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                    />
                  </div>
                </div>
              </div>

              {/* TABLA DE TICKETS */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-955 z-10">
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Descripción / Folio</th>
                      <th className="p-3 text-right">Venta Base (Sin Propina)</th>
                      <th className="p-3 text-right">Efectivo</th>
                      <th className="p-3 text-right">Tarjetas BBVA</th>
                      <th className="p-3 text-right">ParrotPay</th>
                      <th className="p-3 text-right text-gray-400">Propinas (Excluidas)</th>
                      <th className="p-3 text-center">Factura de Terceros (Individual)</th>
                      <th className="p-3 text-center">Destino</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {displayedTickets.map(c => {
                      const isParrotTicket = (c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('PARROT')) || c.tipo === 'corte_parrot';

                      const efec = Number(c.monto_efectivo || 0);
                      const parrot = Number(c.monto_parrotpay || 0);
                      const bbva = isParrotTicket ? 0 : (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0));
                      const baseTotal = efec + bbva + parrot;

                      const propinaTotal = Number(c.propina_efectivo || 0) + Number(c.propina_parrotpay || 0) +
                                           (isParrotTicket ? 0 : (Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0)));
                      const isTercero = !!facturadosTerceros[c.id];

                      return (
                        <tr key={c.id} className={`hover:bg-gray-50/80 dark:hover:bg-gray-900/50 transition-colors ${isTercero ? 'bg-purple-50/30 dark:bg-purple-955/10' : ''}`}>
                          <td className="p-3 font-mono font-medium text-gray-600 dark:text-gray-400">
                            {c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                          </td>
                          <td className="p-3 font-bold text-gray-800 dark:text-gray-200">
                            {c.descripcion || `Corte POS ${c.fecha}`}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                            {formatCurrency(baseTotal)}
                          </td>
                          <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(efec)}
                          </td>
                          <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                            {formatCurrency(bbva)}
                          </td>
                          <td className="p-3 text-right font-mono text-purple-600 dark:text-purple-400">
                            {formatCurrency(parrot)}
                          </td>
                          <td className="p-3 text-right font-mono text-gray-400 line-through">
                            {formatCurrency(propinaTotal)}
                          </td>
                          <td className="p-3 text-center">
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={isTercero}
                                onChange={() => toggleFacturadoTercero(c.id)}
                                className="w-4 h-4 text-purple-600 focus:ring-purple-500 rounded cursor-pointer"
                              />
                              <span className={`text-[10px] font-extrabold ${isTercero ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
                                Facturado a Tercero
                              </span>
                            </label>
                          </td>
                          <td className="p-3 text-center">
                            {isTercero ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 dark:bg-purple-955/50 dark:text-purple-300">
                                👤 Factura Tercero
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-955/50 dark:text-emerald-300">
                                🧾 Público General
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {displayedTickets.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                          {loading ? 'Cargando tickets...' : 'No se encontraron tickets para el período o filtros seleccionados.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}
