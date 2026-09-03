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
  Package,
  Building2
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function FacturaPublicoGeneralPage() {
  const router = useRouter();
  const { isDarkMode } = useThemeMode();
  const getEmpresaId = useEmpresaId();
  const { selectedMonth, refreshPeriodStatus } = usePeriod();

  const [loading, setLoading] = useState(true);
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<any[]>([]);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [movimientosDeposito, setMovimientosDeposito] = useState<any[]>([]);

  // Pestaña principal activa: 'facturas', 'tickets' o 'depositos'
  const [tabActiva, setTabActiva] = useState<'facturas' | 'tickets' | 'depositos'>('facturas');

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

      // 0. Cargar Información de la Empresa Activa
      const { data: empData } = await supabase
        .from('empresas')
        .select('id, nombre')
        .eq('id', empresaId)
        .maybeSingle();
      setEmpresaNombre(empData?.nombre || '');

      // 1. Cargar Cuentas Bancarias estrictamente de la empresa activa
      const { data: cbData, error: cbErr } = await supabase
        .from('cuentas_bancarias')
        .select('*')
        .eq('empresa_id', empresaId)
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
        .select('id, numero_pedido, cliente_nombre, precio_total, subtotal, iva, fecha_pedido, folio_factura, uuid_fiscal, factura_url, xml_url, pdf_url, metodo_pago, clientes(id, nombre_local, razon_social, rfc, facturar_publico_general, es_anonimo), facturas_clientes(*)')
        .eq('empresa_id', empresaId)
        .order('fecha_pedido', { ascending: false });

      if (pErr) console.warn('Error al cargar pedidos:', pErr);
      setPedidos(pData || []);

      // 5. Cargar Depósitos Bancarios (Movimientos del Estado de Cuenta)
      const { data: mbData, error: mbErr } = await supabase
        .from('movimientos_bancarios')
        .select('*, conciliaciones_bancarias(*, gasto(*), pedido(*, facturas_clientes(*))), cuentas_bancarias(*), estatus_conciliacion_bancaria(*)')
        .eq('empresa_id', empresaId)
        .or('tipo_movimiento.eq.Deposito,deposito.gt.0')
        .order('fecha', { ascending: false });

      if (mbErr) console.warn('Error al cargar depósitos bancarios:', mbErr);
      setMovimientosDeposito(mbData || []);

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

  // Helper robusto para extraer mes 'YYYY-MM'
  const extractYearMonth = (dateStr?: string | null) => {
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
  };

  // Clasificador de Público en General vs Cliente Tercero
  const checkIsPG = (rfcStr?: string, nameStr?: string, folioStr?: string, usoCfdi?: string, clienteObj?: any) => {
    const rfc = (rfcStr || '').trim().toUpperCase();
    const name = (nameStr || '').trim().toUpperCase();
    const folio = (folioStr || '').trim().toLowerCase();

    if (rfc.includes('XAXX010101') || rfc.includes('XEXX010101')) return true;
    if (name.includes('PUBLICO') || name.includes('PÚBLICO') || name.includes('MOSTRADOR') || name.includes('GENERAL')) return true;
    if (folio.includes('global') || folio.includes('pg') || folio.includes('pub')) return true;
    if (usoCfdi === 'S01') return true;
    if (clienteObj?.facturar_publico_general || clienteObj?.es_anonimo) return true;
    return false;
  };

  // Resolución de RFC y Nombre del receptor
  const resolveClienteInfo = (obj: any, isPG: boolean) => {
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
  };

  // Pedidos del mes (considera fecha de emisión de factura si ya cuenta con una)
  const pedidosMes = useMemo(() => {
    return pedidos.filter(p => {
      const inv = (p.facturas_clientes && p.facturas_clientes.length > 0) ? p.facturas_clientes[0] : null;
      const fechaRef = inv?.fecha_emision || p.fecha_pedido || p.creado_en || '';
      const mes = extractYearMonth(fechaRef);
      if (selectedMonth && mes !== selectedMonth) return false;
      return true;
    });
  }, [pedidos, selectedMonth]);

  // UNIFICACIÓN TOTAL DE FACTURAS EMITIDAS (facturas_clientes + pedidos con factura)
  const todasLasFacturasMes = useMemo(() => {
    // 1. Facturas directas de facturas_clientes
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

    // 2. Pedidos con factura (folio_factura, uuid o factura_url) no duplicados en facturas_clientes
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
  }, [facturas, pedidosMes, selectedMonth]);

  // Depósitos bancarios del estado de cuenta del mes
  const depositosMes = useMemo(() => {
    return movimientosDeposito
      .filter(m => {
        const mes = extractYearMonth(m.fecha);
        if (selectedMonth && mes !== selectedMonth) return false;
        return true;
      })
      .map(m => {
        const montoVal = Math.abs(Number(m.monto || m.deposito || 0));
        const hasConc = (m.conciliaciones_bancarias && m.conciliaciones_bancarias.length > 0);
        const hasInvoice = hasConc || !!m.factura_url || !!m.xml_url || !!m.comprobante_url;
        const statusName = m.estatus_conciliacion_bancaria?.nombre || (hasInvoice ? 'Conciliado / Facturado' : 'Sin Conciliar');
        return {
          ...m,
          _monto: montoVal,
          _hasInvoice: hasInvoice,
          _statusName: statusName
        };
      });
  }, [movimientosDeposito, selectedMonth]);

  const {
    totalMontoDepositosMes,
    totalDepositosFacturadosMes,
    montoDepositosFacturadosMes
  } = useMemo(() => {
    let totalMonto = 0;
    let countFact = 0;
    let montoFact = 0;

    depositosMes.forEach(d => {
      totalMonto += d._monto;
      if (d._hasInvoice) {
        countFact++;
        montoFact += d._monto;
      }
    });

    return {
      totalMontoDepositosMes: totalMonto,
      totalDepositosFacturadosMes: countFact,
      montoDepositosFacturadosMes: montoFact
    };
  }, [depositosMes]);

  // CUENTAS Y TOTALES EXACTOS DE FACTURACIÓN: FACTURAS A TERCEROS VS PÚBLICO EN GENERAL
  const {
    facturasTercerosMes,
    facturasPgMes,
    montoFacturasTerceros,
    montoFacturasPg,
    totalFacturadoMes
  } = useMemo(() => {
    const facTerceros = todasLasFacturasMes.filter(f => !f._isPG);
    const facPg = todasLasFacturasMes.filter(f => f._isPG);
    const sumFacTerceros = facTerceros.reduce((acc, f) => acc + Number(f._total || f.total || 0), 0);
    const sumFacPg = facPg.reduce((acc, f) => acc + Number(f._total || f.total || 0), 0);

    return {
      facturasTercerosMes: facTerceros,
      facturasPgMes: facPg,
      montoFacturasTerceros: sumFacTerceros,
      montoFacturasPg: sumFacPg,
      totalFacturadoMes: sumFacTerceros + sumFacPg
    };
  }, [todasLasFacturasMes]);

  // Determinación de negocio y cuentas activas (BBVA y ParrotPay pertenecen a Sakura)
  const { isSakura, hasBbva, hasParrot } = useMemo(() => {
    const isSak = (empresaNombre || '').toLowerCase().includes('sakura');
    const hasB = isSak && cuentasBancarias.some(cb => cb.nombre?.toUpperCase().includes('BBVA'));
    const hasP = isSak && (cuentasBancarias.some(cb => cb.nombre?.toUpperCase().includes('PARROT')) || ticketsMes.some(t => t.tipo === 'corte_parrot'));
    return { isSakura: isSak, hasBbva: hasB, hasParrot: hasP };
  }, [empresaNombre, cuentasBancarias, ticketsMes]);

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
      const isParrotTicket = hasParrot && ((c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('PARROT')) || c.tipo === 'corte_parrot');

      const efec = Number(c.monto_efectivo || 0);
      const parrot = hasParrot ? Number(c.monto_parrotpay || 0) : 0;
      const bbva = hasBbva ? (isParrotTicket ? 0 : (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0))) : 0;
      const otherCards = (!hasBbva && !hasParrot) ? (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0) + Number(c.monto_parrotpay || 0)) : 0;
      const baseTotal = efec + bbva + parrot + otherCards;

      const propinaTotal = Number(c.propina_efectivo || 0) + (hasParrot ? Number(c.propina_parrotpay || 0) : 0) +
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
    // Incluye facturas emitidas a clientes individuales + tickets marcados + monto manual
    const tercerosFinal = montoFacturasTerceros + tercerosBase + manualVal;
    const facturaPublico = Math.max(0, brutasBase - tercerosFinal);
    const efecPublico = Math.max(0, efecBase - tercerosEfec);
    const bbvaPublico = hasBbva ? Math.max(0, bbvaBase - tercerosBbva) : 0;
    const parrotPublico = hasParrot ? Math.max(0, parrotBase - tercerosParrot) : 0;

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
  }, [ticketsMes, cuentasBancarias, facturadosTerceros, montoManualTercerosMap, selectedMonth, montoFacturasTerceros, hasBbva, hasParrot]);

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

  // Filtrado de tabla visible de Facturas Emitidas (Unificadas)
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

  // Exportar Excel Completo
  const exportFacturaPublicoExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const summaryRows: any[] = [
        { 'Concepto': 'Facturación a Clientes Terceros (Individual)', 'Venta Bruta Base': montoFacturasTerceros, 'Facturado a Terceros': montoFacturasTerceros, 'Factura Público en General': 0 },
        { 'Concepto': 'Facturación al Público en General (Global)', 'Venta Bruta Base': montoFacturasPg, 'Facturado a Terceros': 0, 'Factura Público en General': montoFacturasPg },
        { 'Concepto': '--- GRAN TOTAL FACTURADO EN EL MES ---', 'Venta Bruta Base': totalFacturadoMes, 'Facturado a Terceros': montoFacturasTerceros, 'Factura Público en General': montoFacturasPg },
        { 'Concepto': 'Depósitos Bancarios del Mes (Estado de Cuenta)', 'Venta Bruta Base': totalMontoDepositosMes, 'Facturado a Terceros': montoDepositosFacturadosMes, 'Factura Público en General': Math.max(0, totalMontoDepositosMes - montoDepositosFacturadosMes) },
        { 'Concepto': 'Ventas Efectivo (Sin Propina)', 'Venta Bruta Base': totalEfectivoBase, 'Facturado a Terceros': totalTercerosEfectivo, 'Factura Público en General': efectivoPublicoGeneral },
      ];
      if (hasBbva) {
        summaryRows.push({ 'Concepto': 'Ventas Tarjetas BBVA/POS (Sin Propina)', 'Venta Bruta Base': totalBbvaBase, 'Facturado a Terceros': totalTercerosBbva, 'Factura Público en General': bbvaPublicoGeneral });
      }
      if (hasParrot) {
        summaryRows.push({ 'Concepto': 'Ventas ParrotPay (Sin Propina)', 'Venta Bruta Base': totalParrotBase, 'Facturado a Terceros': totalTercerosParrot, 'Factura Público en General': parrotPublicoGeneral });
      }
      summaryRows.push(
        { 'Concepto': 'Monto Manual Facturado a Terceros', 'Venta Bruta Base': 0, 'Facturado a Terceros': manualTercerosVal, 'Factura Público en General': -manualTercerosVal },
        { 'Concepto': 'PROPINAS TOTALES (NO CONTABILIZADAS / 0% IMPUESTO)', 'Venta Bruta Base': 0, 'Facturado a Terceros': 0, 'Factura Público en General': totalPropinasExcluidas }
      );

      // Hoja de Facturas Emitidas (Unificadas)
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

      // Hoja de Tickets POS
      const detailRows = ticketsMes.map(c => {
        const isParrotTicket = hasParrot && ((c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('PARROT')) || c.tipo === 'corte_parrot');

        const efec = Number(c.monto_efectivo || 0);
        const parrot = hasParrot ? Number(c.monto_parrotpay || 0) : 0;
        const bbva = hasBbva ? (isParrotTicket ? 0 : (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0))) : 0;
        const otherCards = (!hasBbva && !hasParrot) ? (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0) + Number(c.monto_parrotpay || 0)) : 0;
        const baseTotal = efec + bbva + parrot + otherCards;
        const propinaTotal = Number(c.propina_efectivo || 0) + (hasParrot ? Number(c.propina_parrotpay || 0) : 0) +
                             (isParrotTicket ? 0 : (Number(c.propina_debito || 0) + Number(c.propina_credito || 0) + Number(c.propina_amex || 0)));
        const isTercero = !!facturadosTerceros[c.id];

        const row: any = {
          'Fecha': c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
          'Descripción / Folio': c.descripcion || `Corte POS ${c.fecha}`,
          'Importe sin Propina (Base)': baseTotal,
          'Venta Efectivo (Base)': efec,
        };
        if (hasBbva) row['Venta Tarjetas BBVA (Base)'] = bbva;
        if (hasParrot) row['Venta ParrotPay (Base)'] = parrot;
        if (!hasBbva && !hasParrot && otherCards > 0) row['Venta Tarjetas / Terminal'] = otherCards;
        row['Propinas Excluidas ($)'] = propinaTotal;
        row['Facturado a Terceros (Individual)'] = isTercero ? 'SÍ (Facturado a Cliente)' : 'NO (Público General)';
        row['Monto a Público en General'] = isTercero ? 0 : baseTotal;
        return row;
      });

      // Hoja de Depósitos Bancarios del Estado de Cuenta
      const depositosRows = depositosMes.map(d => ({
        'Fecha': d.fecha ? new Date(d.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : '',
        'Concepto / Banco': d.concepto || '',
        'Cuenta Bancaria': d.cuentas_bancarias?.nombre || '',
        'Monto Depósito': d._monto,
        'Estatus Conciliación': d._statusName,
        'Facturas / Pedidos Vinculados': (d.conciliaciones_bancarias || []).map((c: any) => c.pedido?.numero_pedido ? `Pedido #${c.pedido.numero_pedido}` : (c.pedido?.folio_factura || 'Vinculado')).join(', ') || '-'
      }));

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Factura Global');

      const wsFacturas = XLSX.utils.json_to_sheet(facturasRows);
      XLSX.utils.book_append_sheet(wb, wsFacturas, 'Facturas Emitidas');

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Tickets y Cortes POS');

      const wsDepositos = XLSX.utils.json_to_sheet(depositosRows);
      XLSX.utils.book_append_sheet(wb, wsDepositos, 'Depósitos Bancarios');

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

          {/* TARJETAS RESUMEN DE FACTURACIÓN: TERCEROS VS PÚBLICO EN GENERAL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. FACTURADO A TERCEROS */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-955 border border-purple-200 dark:border-purple-900/50 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><UserCheck size={14} /> Facturas a Terceros</span>
                  <span className="text-[9px] font-black bg-purple-100 dark:bg-purple-955 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full">
                    {facturasTercerosMes.length} Facturas
                  </span>
                </span>
                <h3 className="text-2xl font-black font-mono text-purple-700 dark:text-purple-300 mt-2">
                  {formatCurrency(montoFacturasTerceros)}
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-sans">
                  Facturas individuales emitidas con RFC específico de clientes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setTabActiva('facturas'); setFiltroFacturasTipo('terceros'); }}
                className="mt-4 w-full py-1.5 bg-purple-50 dark:bg-purple-950 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 border border-purple-200 dark:border-purple-800"
              >
                Ver Facturas a Terceros ({facturasTercerosMes.length})
              </button>
            </div>

            {/* 2. FACTURADO AL PÚBLICO EN GENERAL */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-955 border border-emerald-200 dark:border-emerald-900/50 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Globe size={14} /> Factura Público en General</span>
                  <span className="text-[9px] font-black bg-emerald-100 dark:bg-emerald-955 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    {facturasPgMes.length} Facturas
                  </span>
                </span>
                <h3 className="text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-2">
                  {formatCurrency(montoFacturasPg)}
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-sans">
                  Facturas globales emitidas con RFC genérico XAXX010101000.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setTabActiva('facturas'); setFiltroFacturasTipo('publico'); }}
                className="mt-4 w-full py-1.5 bg-emerald-50 dark:bg-emerald-955 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 border border-emerald-200 dark:border-emerald-800"
              >
                Ver Facturas Público General ({facturasPgMes.length})
              </button>
            </div>

            {/* 3. GRAN TOTAL FACTURADO EN EL MES */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 flex items-center justify-between">
                  <span>🧾 Gran Total Facturado</span>
                  <span className="text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">
                    {todasLasFacturasMes.length} Facturas
                  </span>
                </span>
                <h3 className="text-2xl font-black font-mono mt-2">
                  {formatCurrency(totalFacturadoMes)}
                </h3>
                <div className="mt-1 text-[10px] text-blue-100 space-y-0.5 font-sans">
                  <div className="flex justify-between">
                    <span>A Terceros:</span>
                    <span className="font-mono font-bold">{formatCurrency(montoFacturasTerceros)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Público General:</span>
                    <span className="font-mono font-bold">{formatCurrency(montoFacturasPg)}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={exportFacturaPublicoExcel}
                className="mt-3 w-full py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1.5 shadow"
              >
                <FileSpreadsheet size={13} /> Exportar Reporte Excel
              </button>
            </div>

            {/* 4. DEPÓSITOS BANCARIOS (ESTADO DE CUENTA) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-gray-955 border border-sky-200 dark:border-sky-900/50 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Building2 size={14} /> Depósitos Bancarios</span>
                  <span className="text-[9px] font-black bg-sky-100 dark:bg-sky-955 text-sky-700 dark:text-sky-300 px-2 py-0.5 rounded-full">
                    {depositosMes.length} Depósitos
                  </span>
                </span>
                <h3 className="text-2xl font-black font-mono text-sky-700 dark:text-sky-300 mt-2">
                  {formatCurrency(totalMontoDepositosMes)}
                </h3>
                
                <div className="mt-1 space-y-0.5 text-[10px] text-gray-500 dark:text-gray-400 font-sans">
                  <div className="flex justify-between">
                    <span>Con Factura / Conciliados:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      {totalDepositosFacturadosMes} ({formatCurrency(montoDepositosFacturadosMes)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Sin Conciliar / Pendientes:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                      {depositosMes.length - totalDepositosFacturadosMes} ({formatCurrency(totalMontoDepositosMes - montoDepositosFacturadosMes)})
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTabActiva('depositos')}
                className="mt-3 w-full py-1.5 bg-sky-50 dark:bg-sky-950 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 border border-sky-200 dark:border-sky-800"
              >
                Ver Depósitos Bancarios
              </button>
            </div>

          </div>

          {/* BARRA SECUNDARIA: CONTROL DE VENTAS NETAS Y TICKETS (SI APLICA) */}
          {(ticketsMes.length > 0 || totalFacturaPublicoGeneral > 0 || manualTercerosVal > 0) && (
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Estimado Pendiente por Facturar PG</span>
                  <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(totalFacturaPublicoGeneral)}</span>
                </div>
                <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 hidden sm:block" />
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Efectivo</span>
                  <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{formatCurrency(efectivoPublicoGeneral)}</span>
                </div>
                {hasBbva && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Tarjetas BBVA</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{formatCurrency(bbvaPublicoGeneral)}</span>
                  </div>
                )}
                {hasParrot && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">ParrotPay</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{formatCurrency(parrotPublicoGeneral)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase text-gray-500">Monto Manual a Restar ($):</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={manualTercerosVal || ''}
                  onChange={(e) => setMontoManualTercero(currentMonthKey, Number(e.target.value))}
                  placeholder="0.00"
                  className="w-24 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-gray-900 dark:text-gray-100 outline-none focus:ring-1 focus:ring-purple-500"
                />
                {manualTercerosVal > 0 && (
                  <button
                    type="button"
                    onClick={() => setMontoManualTercero(currentMonthKey, 0)}
                    className="text-[10px] text-red-500 hover:underline font-bold"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* NAVEGACIÓN ENTRE PESTAÑAS: FACTURAS EMITIDAS VS CONTROL DE TICKETS VS DEPÓSITOS BANCARIOS */}
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
              <span>Facturas Emitidas ({todasLasFacturasMes.length})</span>
            </button>

            {(isSakura || ticketsMes.length > 0) && (
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
            )}

            <button
              type="button"
              onClick={() => setTabActiva('depositos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
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
            /* ── PESTAÑA 1: TODAS LAS FACTURAS EMITIDAS ── */
            <div className="bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
              
              {/* BARRA DE HERRAMIENTAS Y FILTROS DE FACTURAS */}
              <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
                <div>
                  <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <FileText size={16} className="text-blue-500" /> Facturas Emitidas ({displayedFacturas.length} de {todasLasFacturasMes.length})
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Listado unificado de facturas emitidas por la empresa en el período ({formatCurrency(totalFacturadoMes)} en total).
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
                      Todas ({todasLasFacturasMes.length})
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
                      <th className="p-3">Origen / Pedido</th>
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
                          {f._isFromPedido ? (
                            <span className="inline-flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              <Package size={11} /> Pedido #{f.pedidos?.numero_pedido || f.pedido_id?.substring(0, 6)}
                            </span>
                          ) : f.pedidos?.numero_pedido ? (
                            <span className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-md font-mono text-[11px]">
                              <Package size={11} /> Pedido #{f.pedidos.numero_pedido}
                            </span>
                          ) : f.pedido_id ? (
                            <span className="text-[11px] text-gray-500 font-mono">Pedido ID: {f.pedido_id.substring(0, 8)}</span>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Factura directa</span>
                          )}
                        </td>

                        {/* Subtotal */}
                        <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">
                          {formatCurrency(f.subtotal || f._subtotal)}
                        </td>

                        {/* IVA */}
                        <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                          {formatCurrency(f.iva_trasladado || f._iva)}
                        </td>

                        {/* Total */}
                        <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                          {formatCurrency(f.total || f._total)}
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
          ) : tabActiva === 'tickets' ? (
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
                      {hasBbva && <th className="p-3 text-right">Tarjetas BBVA</th>}
                      {hasParrot && <th className="p-3 text-right">ParrotPay</th>}
                      {!hasBbva && !hasParrot && <th className="p-3 text-right">Tarjetas / Terminal</th>}
                      <th className="p-3 text-right text-gray-400">Propinas (Excluidas)</th>
                      <th className="p-3 text-center">Factura de Terceros (Individual)</th>
                      <th className="p-3 text-center">Destino</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {displayedTickets.map(c => {
                      const isParrotTicket = hasParrot && ((c.cuenta_bancaria_id && cuentasBancarias?.find(cb => cb.id === c.cuenta_bancaria_id)?.nombre?.toUpperCase().includes('PARROT')) || c.tipo === 'corte_parrot');

                      const efec = Number(c.monto_efectivo || 0);
                      const parrot = hasParrot ? Number(c.monto_parrotpay || 0) : 0;
                      const bbva = hasBbva ? (isParrotTicket ? 0 : (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0))) : 0;
                      const otherCards = (!hasBbva && !hasParrot) ? (Number(c.monto_debito || 0) + Number(c.monto_credito || 0) + Number(c.monto_amex || 0) + Number(c.monto_parrotpay || 0)) : 0;
                      const baseTotal = efec + bbva + parrot + otherCards;

                      const propinaTotal = Number(c.propina_efectivo || 0) + (hasParrot ? Number(c.propina_parrotpay || 0) : 0) +
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
                          {hasBbva && (
                            <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                              {formatCurrency(bbva)}
                            </td>
                          )}
                          {hasParrot && (
                            <td className="p-3 text-right font-mono text-purple-600 dark:text-purple-400">
                              {formatCurrency(parrot)}
                            </td>
                          )}
                          {!hasBbva && !hasParrot && (
                            <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                              {formatCurrency(otherCards)}
                            </td>
                          )}
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
          ) : (
            /* ── PESTAÑA 3: DEPÓSITOS BANCARIOS (DEL ESTADO DE CUENTA) ── */
            <div className="bg-white dark:bg-gray-955 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex-1 min-h-0 flex flex-col">
              
              {/* BARRA DE HERRAMIENTAS */}
              <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center flex-wrap gap-3 shrink-0">
                <div>
                  <h4 className="text-xs font-black uppercase text-gray-800 dark:text-gray-200 flex items-center gap-2">
                    <Building2 size={16} className="text-blue-500" /> Depósitos Bancarios del Estado de Cuenta ({depositosMes.length})
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Movimientos de ingreso ingresados vía Estado de Cuenta. Muestra el estatus de conciliación y facturación de cada depósito.
                  </p>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Depósitos: <strong className="text-blue-600 dark:text-blue-400">{formatCurrency(totalMontoDepositosMes)}</strong>
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Facturados: <strong>{totalDepositosFacturadosMes} ({formatCurrency(montoDepositosFacturadosMes)})</strong>
                  </span>
                </div>
              </div>

              {/* TABLA DE DEPÓSITOS */}
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide sticky top-0 bg-white dark:bg-gray-955 z-10">
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Concepto / Referencia Banco</th>
                      <th className="p-3">Cuenta Bancaria</th>
                      <th className="p-3 text-right">Monto Depósito</th>
                      <th className="p-3 text-center">Estatus Conciliación</th>
                      <th className="p-3 text-center">Facturas / Pedidos Vinculados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {depositosMes.map(d => {
                      const cuentaNombre = d.cuentas_bancarias?.nombre || 'Cuenta Principal';
                      const concs = d.conciliaciones_bancarias || [];
                      return (
                        <tr key={d.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-900/50 transition-colors">
                          <td className="p-3 font-mono font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {d.fecha ? new Date(d.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' }) : ''}
                          </td>
                          <td className="p-3 font-bold text-gray-800 dark:text-gray-200 max-w-xs truncate" title={d.concepto}>
                            {d.concepto || 'Depósito bancario'}
                          </td>
                          <td className="p-3 font-medium text-gray-500 dark:text-gray-400 text-[11px]">
                            {cuentaNombre}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(d._monto)}
                          </td>
                          <td className="p-3 text-center">
                            {d._hasInvoice ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-955/50 dark:text-emerald-300 inline-flex items-center gap-1">
                                <CheckCircle2 size={12} /> {d._statusName}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-955/50 dark:text-amber-300 inline-flex items-center gap-1">
                                <AlertCircle size={12} /> Sin Conciliar
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center font-sans">
                            {concs.length > 0 ? (
                              <div className="flex flex-col items-center gap-1 text-[10px]">
                                {concs.map((c: any, idx: number) => {
                                  const p = c.pedido;
                                  const title = p?.numero_pedido ? `Pedido #${p.numero_pedido}` : (p?.folio_factura ? `Factura ${p.folio_factura}` : 'Factura Vinculada');
                                  return (
                                    <span key={idx} className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                                      {title}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 italic">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {depositosMes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400 italic">
                          {loading ? 'Cargando depósitos bancarios...' : 'No se encontraron depósitos bancarios para el período seleccionado.'}
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
