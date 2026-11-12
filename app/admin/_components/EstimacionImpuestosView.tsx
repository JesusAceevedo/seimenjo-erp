'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useEmpresaId } from '@/lib/hooks/useEmpresaId';
import { useFacturaPublicoGeneralData } from '@/app/admin/factura-publico-general/_hooks/useFacturaPublicoGeneralData';
import { formatDate } from '@/lib/formatters';
import {
  Calculator,
  Banknote,
  Landmark,
  FileText,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Scale,
  Receipt,
  Download,
  RefreshCw,
  Info,
  SlidersHorizontal,
  ArrowRight,
  ShieldAlert,
  CreditCard,
  Percent,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Users,
  Building2,
  FileCheck2,
  Printer,
  Layers,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { esComisionTpv, esComisionBancaria } from '@/app/admin/gastos/commissionUtils';
import {
  generarReporteMensualPdf,
  type RubroConceptoSummary,
  type ProveedorDiotSummary,
  type SemaforoFiscalItem,
  type TrabajoMensualMetrics,
} from './reporteMensualPdfGenerator';

interface EstimacionImpuestosViewProps {
  onNavigateToTab?: (tab: string) => void;
}

type ModalidadIsr = 'utilidad_fiscal' | 'coeficiente_utilidad' | 'resico_ingresos';
type FuenteIngresos = 'factura_global_mas_terceros' | 'depositos_banco' | 'solo_cfdi_emitidos';
type RubroKey = RubroConceptoSummary['key'];

export default function EstimacionImpuestosView({ onNavigateToTab }: EstimacionImpuestosViewProps) {
  const getEmpresaId = useEmpresaId();

  // Reutilizar exactamente los mismos datos y reglas de Factura Público en General
  const pgData = useFacturaPublicoGeneralData();
  const {
    loading: loadingPg,
    selectedMonth,
    isSeimenjo,
    empresaNombre,
    formatCurrency,
    fetchData: refreshPgData,
    // Datos de Factura Global (POS / Sakura)
    totalEfectivoParrot,
    totalParrotPayParrot,
    comparativoTarjetas,
    totalTercerosDeducibles,
    totalPropinasExcluidas,
    subtotalFacturaGlobal,
    ivaFacturaGlobal,
    totalConIvaFacturaGlobal,
    ivaFacturasTerceros,
    facturasTercerosMes,
    facturasPgMes,
    todasLasFacturasMes,
    depositosMes,
    depositosNetosMes,
    controlEfectivo,
    pedidosMes,
  } = pgData;

  const [loadingGastos, setLoadingGastos] = useState(true);
  const [empresaRfc, setEmpresaRfc] = useState<string>('');
  const [gastosRaw, setGastosRaw] = useState<any[]>([]);
  const [movimientosRaw, setMovimientosRaw] = useState<any[]>([]);
  const [conciliacionesRaw, setConciliacionesRaw] = useState<any[]>([]);
  const [formasPagoCatalog, setFormasPagoCatalog] = useState<any[]>([]);
  const [filtroRubroDetalle, setFiltroRubroDetalle] = useState<RubroKey | 'TODOS'>('TODOS');

  // Configuraciones interactivas de impuestos (persistidas en localStorage)
  const [modalidadIsr, setModalidadIsr] = useState<ModalidadIsr>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('seimenjo_tax_modalidad_isr') as ModalidadIsr) || 'utilidad_fiscal';
    }
    return 'utilidad_fiscal';
  });

  const [tasaIsr, setTasaIsr] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('seimenjo_tax_tasa_isr');
      return saved !== null ? Number(saved) : 30;
    }
    return 30;
  });

  const [coeficienteUtilidad, setCoeficienteUtilidad] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('seimenjo_tax_coeficiente');
      return saved !== null ? Number(saved) : 0.15;
    }
    return 0.15;
  });

  const [fuenteIngresos, setFuenteIngresos] = useState<FuenteIngresos>('factura_global_mas_terceros');
  const [aplicarTopeEfectivo2000, setAplicarTopeEfectivo2000] = useState<boolean>(true);
  const [incluirFacturasNoConciliadas, setIncluirFacturasNoConciliadas] = useState<boolean>(true);
  const [saldoFavorIvaAnterior, setSaldoFavorIvaAnterior] = useState<number>(0);

  // Secciones desplegables de detalle
  const [activeDetailTab, setActiveDetailTab] = useState<
    | 'resumen_ejecutivo'
    | 'trabajo_conceptos'
    | 'efectivo_vs_facturado'
    | 'otras_facturas'
    | 'pre_diot'
    | 'no_deducibles'
    | 'ingresos_global'
  >('resumen_ejecutivo');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('seimenjo_tax_modalidad_isr', modalidadIsr);
      localStorage.setItem('seimenjo_tax_tasa_isr', String(tasaIsr));
      localStorage.setItem('seimenjo_tax_coeficiente', String(coeficienteUtilidad));
    }
  }, [modalidadIsr, tasaIsr, coeficienteUtilidad]);

  const fetchGastosYMovimientos = async () => {
    setLoadingGastos(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      const [gRes, mRes, cRes, fpRes, empRes] = await Promise.all([
        supabase
          .from('gastos')
          .select('*, proveedores(nombre_comercial, razon_social, rfc), categorias_gasto(nombre)')
          .eq('empresa_id', empresaId)
          .order('fecha_gasto', { ascending: false }),
        supabase
          .from('movimientos_bancarios')
          .select('*, estatus_conciliacion_bancaria(*), cuentas_bancarias(*), categorias_movimiento_bancario(*)')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false }),
        supabase
          .from('conciliaciones_bancarias')
          .select('id, movimiento_id, gasto_id, pedido_id, monto_asociado')
          .eq('empresa_id', empresaId),
        supabase.from('formas_pago').select('*'),
        supabase.from('empresas').select('rfc, nombre').eq('id', empresaId).maybeSingle(),
      ]);

      setGastosRaw(gRes.data || []);
      setMovimientosRaw(mRes.data || []);
      setConciliacionesRaw(cRes.data || []);
      setFormasPagoCatalog(fpRes.data || []);
      if (empRes.data?.rfc) {
        setEmpresaRfc(empRes.data.rfc);
      }
    } catch (err) {
      console.error('Error al cargar gastos y movimientos para impuestos:', err);
    } finally {
      setLoadingGastos(false);
    }
  };

  useEffect(() => {
    fetchGastosYMovimientos();
  }, [selectedMonth]);

  const handleRefreshAll = async () => {
    await Promise.all([refreshPgData(), fetchGastosYMovimientos()]);
  };

  // Mapa de formas de pago por ID
  const formasPagoMap = useMemo(() => {
    const map = new Map<string, { codigo: string; nombre: string }>();
    formasPagoCatalog.forEach((fp: any) => {
      if (fp.id) map.set(fp.id, { codigo: String(fp.codigo || '').trim(), nombre: String(fp.nombre || '').trim() });
    });
    return map;
  }, [formasPagoCatalog]);

  // Helper para obtener el código SAT de forma de pago de un gasto ('01', '03', '04', '28', '99', etc.)
  const resolveMetodoPagoCodigo = (g: any): string => {
    const rawMp = String(g.metodo_pago || '').trim();
    if (rawMp) {
      if (rawMp.toLowerCase().includes('efectivo') || rawMp === '1' || rawMp === '01') return '01';
      if (rawMp.toLowerCase().includes('transferencia') || rawMp === '3' || rawMp === '03') return '03';
      if (rawMp.toLowerCase().includes('cheque') || rawMp === '2' || rawMp === '02') return '02';
      if (rawMp.toLowerCase().includes('crédito') || rawMp.toLowerCase().includes('credito') || rawMp === '4' || rawMp === '04') return '04';
      if (rawMp.toLowerCase().includes('débito') || rawMp.toLowerCase().includes('debito') || rawMp === '28') return '28';
      return rawMp.padStart(2, '0');
    }
    if (g.forma_pago_id && formasPagoMap.has(g.forma_pago_id)) {
      const fp = formasPagoMap.get(g.forma_pago_id)!;
      if (fp.codigo) return fp.codigo.padStart(2, '0');
      if (fp.nombre.toLowerCase().includes('efectivo')) return '01';
    }
    return '99';
  };

  // Helper para extraer Subtotal e IVA reales de una factura de gasto
  const resolveGastoDesgloseFiscal = (g: any) => {
    const total = Math.abs(Number(g.monto || 0));
    const rawIva = Number(g.iva_acreditable || 0);
    const rawSub = Number(g.subtotal || 0);

    let iva = 0;
    let subtotal = total;

    if (rawIva > 0) {
      iva = rawIva;
      subtotal = rawSub > 0 && rawSub <= total ? rawSub : Math.max(0, total - iva);
    } else if (rawSub > 0 && rawSub < total) {
      subtotal = rawSub;
      iva = Math.max(0, total - rawSub);
    } else if (rawSub > 0) {
      subtotal = rawSub;
      iva = 0;
    }

    return {
      subtotal: Number(subtotal.toFixed(2)),
      iva: Number(iva.toFixed(2)),
      total: Number(total.toFixed(2)),
    };
  };

  // Helper para saber si una factura de efectivo es de combustible/gasolina (exenta del tope de $2,000 si aplica o identificada)
  const esGastoCombustible = (g: any): boolean => {
    const text = `${g.concepto || ''} ${g.proveedores?.nombre_comercial || ''} ${g.categorias_gasto?.nombre || ''}`.toUpperCase();
    return (
      text.includes('GASOLIN') ||
      text.includes('COMBUSTIBLE') ||
      text.includes('MAGNA') ||
      text.includes('PREMIUM') ||
      text.includes('DIESEL') ||
      text.includes('PEMEX') ||
      text.includes('SERVICIO') && text.includes('ESTACION')
    );
  };

  // Helper para identificar si un retiro bancario es un Retiro de Efectivo (Cajero / Ventanilla / Practicaja)
  const esRetiroEfectivoBanco = (m: any): boolean => {
    const concepto = String(m.concepto || '').toUpperCase();
    const catClave = String(m.categorias_movimiento_bancario?.clave || '').toUpperCase();
    const catNombre = String(m.categorias_movimiento_bancario?.nombre || '').toUpperCase();
    const ref = String(m.referencia || '').toUpperCase();

    // Excluir ajustes virtuales de depósito de ventas
    if (concepto.includes('DESCUENTO CAJA CHICA POR DEPÓSITO') || concepto.includes('DEPOSITO DE EFECTIVO A BANCO')) {
      return false;
    }
    if (ref.startsWith('COMPROBANTE_DEPOSITO_')) return false;

    if (catClave === 'RETIRO_EFECTIVO' || catNombre.includes('RETIRO DE EFECTIVO') || catNombre.includes('CAJA CHICA')) {
      return true;
    }

    return (
      concepto.includes('RETIRO CAJERO') ||
      concepto.includes('DISP EFECTIVO') ||
      concepto.includes('DISPOSICION EFECTIVO') ||
      concepto.includes('DISPOSICIÓN EFECTIVO') ||
      concepto.includes('RETIRO EFECTIVO') ||
      concepto.includes('RETIRO EN EFECTIVO') ||
      concepto.includes('PRACTICAJA') ||
      concepto.includes('CAJERO AUTOMATICO') ||
      concepto.includes('CAJERO AUTOMÁTICO') ||
      (concepto.includes('EFECTIVO') && !concepto.includes('DEPOSITO'))
    );
  };

  // Clasificador de Movimientos Bancarios en los 7 Rubros Contables
  const classifyMovConcepto = (m: any): RubroKey => {
    const concepto = String(m.concepto || '').toUpperCase();
    const catClave = String(m.categorias_movimiento_bancario?.clave || '').toUpperCase();
    const catNombre = String(m.categorias_movimiento_bancario?.nombre || '').toUpperCase();

    if (esRetiroEfectivoBanco(m)) return 'EFECTIVO';

    if (
      catClave === 'TRASPASO' ||
      catClave === 'PRESTAMO' ||
      catClave === 'REEMBOLSO' ||
      catClave === 'AJUSTE' ||
      catNombre.includes('TRASPASO') ||
      catNombre.includes('REEMBOLSO') ||
      catNombre.includes('PRÉSTAMO') ||
      catNombre.includes('PRESTAMO') ||
      concepto.includes('TRASPASO ENTRE CUENTAS') ||
      concepto.includes('TRANSFERENCIA ENTRE CUENTAS PROPIAS')
    ) {
      return 'TRASPASO';
    }

    if (
      catClave === 'COMISION_TPV' ||
      catClave === 'COMISION_BANCO' ||
      esComisionTpv(m.concepto || '', m.categorias_movimiento_bancario?.nombre) ||
      esComisionBancaria(m.concepto || '', m.categorias_movimiento_bancario?.nombre)
    ) {
      return 'COMISION';
    }

    if (
      catClave === 'NOMINA' ||
      catClave === 'PROPINA' ||
      catNombre.includes('NOMINA') ||
      catNombre.includes('NÓMINA') ||
      catNombre.includes('SUELDO') ||
      catNombre.includes('SALARIO') ||
      concepto.includes('NOMINA') ||
      concepto.includes('NÓMINA') ||
      concepto.includes('SUELDO') ||
      concepto.includes('SALARIO') ||
      concepto.includes('FINIQUITO') ||
      concepto.includes('AGUINALDO') ||
      concepto.includes('PROPINAS')
    ) {
      return 'NOMINA';
    }

    if (
      catClave === 'IMPUESTO' ||
      catNombre.includes('IMPUESTO') ||
      concepto.includes('PAGO REFERENCIADO SAT') ||
      concepto.includes('TESORERIA DE LA FEDERACION') ||
      concepto.includes('TESORERÍA DE LA FEDERACIÓN') ||
      concepto.includes('IMSS') ||
      concepto.includes('INFONAVIT') ||
      concepto.includes('SIPARE') ||
      concepto.includes('IMPUESTO SOBRE NOMINA') ||
      concepto.includes('SECRETARIA DE FINANZAS') ||
      (concepto.includes('SAT') && concepto.includes('IMPUESTO'))
    ) {
      return 'IMPUESTO';
    }

    if (
      catClave === 'EGRESO_RENTA' ||
      catClave === 'EGRESO_GASTO' ||
      catNombre.includes('RENTA') ||
      catNombre.includes('SERVICIO') ||
      concepto.includes('RENTA ') ||
      concepto.includes('ARRENDAMIENTO') ||
      concepto.includes('CFE ') ||
      concepto.includes('COMISION FEDERAL DE ELECTRICIDAD') ||
      concepto.includes('TELMEX') ||
      concepto.includes('TOTALPLAY') ||
      concepto.includes('IZZI') ||
      concepto.includes('AGUA ')
    ) {
      return 'OPERATIVO';
    }

    return 'PROVEEDOR';
  };

  // Clasificador de Facturas / Gastos en los 7 Rubros Contables
  const classifyGastoConcepto = (g: any, codigoPago: string): RubroKey => {
    const text = `${g.concepto || ''} ${g.proveedores?.nombre_comercial || ''} ${g.proveedores?.razon_social || ''} ${g.categorias_gasto?.nombre || ''}`.toUpperCase();

    if (
      text.includes('TRASPASO') ||
      text.includes('REEMBOLSO ENTRE CUENTAS') ||
      text.includes('PRESTAMO') ||
      text.includes('PRÉSTAMO')
    ) {
      return 'TRASPASO';
    }

    if (
      esComisionTpv(g.concepto || '', g.categorias_gasto?.nombre) ||
      esComisionBancaria(g.concepto || '', g.categorias_gasto?.nombre) ||
      text.includes('COMISION BANCARIA') ||
      text.includes('COMISIÓN BANCARIA') ||
      text.includes('COMISION TPV')
    ) {
      return 'COMISION';
    }

    if (
      text.includes('NOMINA') ||
      text.includes('NÓMINA') ||
      text.includes('SUELDO') ||
      text.includes('SALARIO') ||
      text.includes('ASISTENCIA') ||
      text.includes('FINIQUITO') ||
      text.includes('AGUINALDO') ||
      text.includes('PROPINA')
    ) {
      return 'NOMINA';
    }

    if (
      text.includes('IMPUESTO') ||
      text.includes('CUOTA IMSS') ||
      text.includes('INFONAVIT') ||
      text.includes('TESORERIA DE LA FEDERACION') ||
      text.includes('DERECHOS ESTATALES') ||
      text.includes('ISN ')
    ) {
      return 'IMPUESTO';
    }

    if (codigoPago === '01') {
      return 'EFECTIVO';
    }

    if (
      text.includes('RENTA') ||
      text.includes('ARRENDAMIENTO') ||
      text.includes('CFE') ||
      text.includes('ELECTRICIDAD') ||
      text.includes('TELMEX') ||
      text.includes('INTERNET') ||
      text.includes('TOTALPLAY') ||
      text.includes('MANTENIMIENTO') ||
      text.includes('HONORARIOS') ||
      text.includes('CONTABILIDAD') ||
      text.includes('LIMPIEZA') ||
      text.includes('PAPELERIA') ||
      text.includes('GASOLIN') ||
      text.includes('COMBUSTIBLE')
    ) {
      return 'OPERATIVO';
    }

    return 'PROVEEDOR';
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CÁLCULO DE INGRESOS Y FACTURA GLOBAL (MISMA LÓGICA DE FACTURA PÚBLICO GENERAL)
  // ─────────────────────────────────────────────────────────────────────────────
  const ingresosAnalysis = useMemo(() => {
    // Facturas emitidas a terceros en el mes
    const totalTercerosConIva = facturasTercerosMes.reduce((acc: number, f: any) => acc + Number(f._total || f.total || 0), 0);
    const subtotalTerceros = facturasTercerosMes.reduce((acc: number, f: any) => {
      const tot = Number(f._total || f.total || 0);
      const sub = Number(f._subtotal || f.subtotal || (tot > 0 ? tot / 1.16 : 0));
      return acc + sub;
    }, 0);
    const ivaTerceros = facturasTercerosMes.reduce((acc: number, f: any) => {
      const tot = Number(f._total || f.total || 0);
      const sub = Number(f._subtotal || f.subtotal || (tot > 0 ? tot / 1.16 : 0));
      const iv = Number(f._iva ?? f.iva_trasladado ?? (tot - sub));
      return acc + iv;
    }, 0);

    // Facturas Público en General ya emitidas (timbradas) en el mes
    const totalPgEmitidasConIva = facturasPgMes.reduce((acc: number, f: any) => acc + Number(f._total || f.total || 0), 0);
    const subtotalPgEmitidas = facturasPgMes.reduce((acc: number, f: any) => {
      const tot = Number(f._total || f.total || 0);
      return acc + Number(f._subtotal || f.subtotal || (tot > 0 ? tot / 1.16 : 0));
    }, 0);
    const ivaPgEmitidas = Math.max(0, totalPgEmitidasConIva - subtotalPgEmitidas);

    // Depósitos bancarios del periodo
    const totalDepositosBancoBruto = (depositosMes || []).reduce((acc: number, d: any) => acc + Number(d._monto || d.deposito || d.monto || 0), 0);
    const totalDepositosNetos = isSeimenjo
      ? totalDepositosBancoBruto
      : Number(depositosNetosMes || totalDepositosBancoBruto);

    // Determinación de la Factura Global del Periodo:
    // Si es Seimenjo (B2B), la Factura Global sugerida es (Depósitos en Banco - Facturas Individuales a Terceros), o la Factura PG ya emitida si es mayor
    // Si es POS (Sakura), usamos subtotalFacturaGlobal, ivaFacturaGlobal, totalConIvaFacturaGlobal de useFacturaPublicoGeneralData
    let globalTotalConIva = 0;
    let globalSubtotal = 0;
    let globalIva = 0;

    if (isSeimenjo) {
      const baseGlobalSeimenjo = Math.max(totalPgEmitidasConIva, Math.max(0, totalDepositosNetos - totalTercerosConIva));
      globalTotalConIva = Number(baseGlobalSeimenjo.toFixed(2));
      globalSubtotal = Number((globalTotalConIva / 1.16).toFixed(2));
      globalIva = Number((globalTotalConIva - globalSubtotal).toFixed(2));
    } else {
      // Si ya no hay cortes POS cargados pero hay Factura PG emitida o depósitos, usar el mayor entre el cálculo POS y las PG emitidas
      const calcPosTotal = Number(totalConIvaFacturaGlobal || 0);
      if (calcPosTotal > 0) {
        globalTotalConIva = calcPosTotal;
        globalSubtotal = Number(subtotalFacturaGlobal || (calcPosTotal / 1.16));
        globalIva = Number(ivaFacturaGlobal || (calcPosTotal - globalSubtotal));
      } else if (totalPgEmitidasConIva > 0) {
        globalTotalConIva = totalPgEmitidasConIva;
        globalSubtotal = subtotalPgEmitidas;
        globalIva = ivaPgEmitidas;
      } else {
        const fallbackGlobal = Math.max(0, totalDepositosNetos - totalTercerosConIva);
        globalTotalConIva = Number(fallbackGlobal.toFixed(2));
        globalSubtotal = Number((globalTotalConIva / 1.16).toFixed(2));
        globalIva = Number((globalTotalConIva - globalSubtotal).toFixed(2));
      }
    }

    // Según la fuente seleccionada por el usuario:
    let ingresosTotalesConIva = 0;
    let ingresosSubtotalAcumulable = 0;
    let ivaTrasladadoTotal = 0;

    if (fuenteIngresos === 'factura_global_mas_terceros') {
      ingresosTotalesConIva = globalTotalConIva + totalTercerosConIva;
      ingresosSubtotalAcumulable = globalSubtotal + subtotalTerceros;
      ivaTrasladadoTotal = globalIva + ivaTerceros;
    } else if (fuenteIngresos === 'depositos_banco') {
      ingresosTotalesConIva = totalDepositosNetos;
      ingresosSubtotalAcumulable = Number((totalDepositosNetos / 1.16).toFixed(2));
      ivaTrasladadoTotal = Number((totalDepositosNetos - ingresosSubtotalAcumulable).toFixed(2));
    } else {
      // solo_cfdi_emitidos
      ingresosTotalesConIva = totalTercerosConIva + totalPgEmitidasConIva;
      ingresosSubtotalAcumulable = subtotalTerceros + subtotalPgEmitidas;
      ivaTrasladadoTotal = ivaTerceros + ivaPgEmitidas;
    }

    return {
      // Desglose Factura Global
      globalTotalConIva: Number(globalTotalConIva.toFixed(2)),
      globalSubtotal: Number(globalSubtotal.toFixed(2)),
      globalIva: Number(globalIva.toFixed(2)),
      // Desglose Facturas Terceros
      totalTercerosConIva: Number(totalTercerosConIva.toFixed(2)),
      subtotalTerceros: Number(subtotalTerceros.toFixed(2)),
      ivaTerceros: Number(ivaTerceros.toFixed(2)),
      countTerceros: facturasTercerosMes.length,
      // Desglose Facturas PG ya timbradas
      totalPgEmitidasConIva: Number(totalPgEmitidasConIva.toFixed(2)),
      countPgEmitidas: facturasPgMes.length,
      // Depósitos Bancarios
      totalDepositosBancoBruto: Number(totalDepositosBancoBruto.toFixed(2)),
      totalDepositosNetos: Number(totalDepositosNetos.toFixed(2)),
      countDepositos: (depositosMes || []).length,
      // Totales activos para el cálculo de impuestos
      ingresosTotalesConIva: Number(ingresosTotalesConIva.toFixed(2)),
      ingresosSubtotalAcumulable: Number(ingresosSubtotalAcumulable.toFixed(2)),
      ivaTrasladadoTotal: Number(ivaTrasladadoTotal.toFixed(2)),
    };
  }, [
    facturasTercerosMes,
    facturasPgMes,
    depositosMes,
    depositosNetosMes,
    isSeimenjo,
    totalConIvaFacturaGlobal,
    subtotalFacturaGlobal,
    ivaFacturaGlobal,
    fuenteIngresos,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. PROCESAMIENTO DE GASTOS/FACTURAS Y RETIROS BANCARIOS DEL MES
  // ─────────────────────────────────────────────────────────────────────────────
  const egresosAnalysis = useMemo(() => {
    // Filtrar gastos del mes seleccionado
    const gastosMesAll = gastosRaw.filter((g: any) => {
      if (!selectedMonth) return true;
      const mes =
        g.mes_conciliacion ||
        (g.fecha_gasto ? g.fecha_gasto.substring(0, 7) : g.fecha_timbrado ? g.fecha_timbrado.substring(0, 7) : '');
      return mes === selectedMonth;
    });

    // Evitar doble conteo de parcialidades hijas si el padre está en la lista
    const parentIdsInMonth = new Set(gastosMesAll.map((g: any) => String(g.id).trim().toLowerCase()));
    const gastosMes = gastosMesAll.filter((g: any) => {
      if (!g.gasto_padre_id) return true;
      return !parentIdsInMonth.has(String(g.gasto_padre_id).trim().toLowerCase());
    });

    // Mapa de conciliaciones por gasto_id y por movimiento_id
    const concByGasto = new Map<string, any[]>();
    const concByMov = new Map<string, any[]>();
    conciliacionesRaw.forEach((c: any) => {
      if (c.gasto_id) {
        const list = concByGasto.get(c.gasto_id) || [];
        list.push(c);
        concByGasto.set(c.gasto_id, list);
      }
      if (c.movimiento_id) {
        const list = concByMov.get(c.movimiento_id) || [];
        list.push(c);
        concByMov.set(c.movimiento_id, list);
      }
    });

    // Filtrar retiros bancarios del mes seleccionado
    const retirosBancoMes = movimientosRaw.filter((m: any) => {
      const concepto = String(m.concepto || '').toLowerCase();
      const ref = String(m.referencia || '').toUpperCase();
      if (concepto.includes('descuento caja chica por depósito') || concepto.includes('deposito de efectivo a banco')) {
        return false;
      }
      if (ref.startsWith('COMPROBANTE_DEPOSITO_')) return false;

      const isRetiro =
        m.tipo_movimiento === 'Retiro' ||
        m.tipo_movimiento === 'Egreso' ||
        Number(m.retiro || 0) > 0 ||
        Number(m.monto || 0) < 0;
      if (!isRetiro) return false;

      if (!selectedMonth) return true;
      const mes = m.mes_conciliacion || (m.fecha ? m.fecha.substring(0, 7) : '');
      return mes === selectedMonth;
    });

    // A) Separar Retiros de Efectivo del Banco vs Otros Retiros Bancarios (Transferencias, Tarjetas, Comisiones)
    const retirosEfectivoBanco: any[] = [];
    const otrosRetirosBanco: any[] = [];

    retirosBancoMes.forEach((m: any) => {
      const montoAbs = Math.abs(Number(m.retiro || m.monto || 0));
      const concs = concByMov.get(m.id) || [];
      const legacyGastos = gastosRaw.filter((g: any) => g.movimiento_bancario_id === m.id);
      const montoConciliado =
        concs.reduce((sum: number, c: any) => sum + Number(c.monto_asociado || 0), 0) +
        legacyGastos
          .filter((lg: any) => !concs.some((c: any) => c.gasto_id === lg.id))
          .reduce((sum: number, lg: any) => sum + Math.abs(Number(lg.monto || 0)), 0);

      const rubroMov = classifyMovConcepto(m);
      const enrichedMov = {
        ...m,
        _montoAbs: montoAbs,
        _montoConciliado: Math.min(montoAbs, montoConciliado),
        _montoSinConciliar: Math.max(0, montoAbs - montoConciliado),
        _tieneComprobante:
          concs.length > 0 ||
          legacyGastos.length > 0 ||
          Boolean(m.xml_url || m.pdf_factura_url || m.soporte_reembolso_url),
        _estatusClave: m.estatus_conciliacion_bancaria?.clave || 'pendiente',
        _rubro: rubroMov,
      };

      if (rubroMov === 'EFECTIVO') {
        retirosEfectivoBanco.push(enrichedMov);
      } else {
        otrosRetirosBanco.push(enrichedMov);
      }
    });

    const totalEfectivoRetiradoBanco = retirosEfectivoBanco.reduce((acc, m) => acc + m._montoAbs, 0);

    // B) Clasificar Facturas / Gastos del Mes: Efectivo ('01') vs Otras Formas de Pago ('03', '04', '28', etc.)
    const facturasEfectivo: any[] = [];
    const facturasOtrosMetodos: any[] = [];
    const facturasMarcadasNoDeducibles: any[] = [];
    const gastosMesEnriched: any[] = [];

    gastosMes.forEach((g: any) => {
      const codigoPago = resolveMetodoPagoCodigo(g);
      const { subtotal, iva, total } = resolveGastoDesgloseFiscal(g);
      const concs = concByGasto.get(g.id) || [];
      const esConciliado = Boolean(g.movimiento_bancario_id) || concs.length > 0;
      const tieneXml = Boolean(g.uuid_fiscal || g.xml_url);
      const esCombustible = esGastoCombustible(g);
      const supera2000 = codigoPago === '01' && total > 2000 && !esCombustible;
      const marcadaNoDeducible = g.es_deducible === false;
      const rubroGasto = classifyGastoConcepto(g, codigoPago);

      const enrichedGasto = {
        ...g,
        _codigoPago: codigoPago,
        _subtotal: subtotal,
        _iva: iva,
        _total: total,
        _esConciliado: esConciliado,
        _tieneXml: tieneXml,
        _esCombustible: esCombustible,
        _supera2000: supera2000,
        _marcadaNoDeducible: marcadaNoDeducible,
        _rubro: rubroGasto,
      };

      gastosMesEnriched.push(enrichedGasto);

      if (marcadaNoDeducible) {
        facturasMarcadasNoDeducibles.push(enrichedGasto);
      } else if (codigoPago === '01') {
        facturasEfectivo.push(enrichedGasto);
      } else {
        facturasOtrosMetodos.push(enrichedGasto);
      }
    });

    // Sub-análisis de Facturas en Efectivo (01)
    const facturasEfectivoMenores2000 = facturasEfectivo.filter(f => !f._supera2000);
    const facturasEfectivoMayores2000 = facturasEfectivo.filter(f => f._supera2000);

    const facturasEfectivoDeducibles = aplicarTopeEfectivo2000 ? facturasEfectivoMenores2000 : facturasEfectivo;
    const facturasEfectivoNoDeduciblesPorTope = aplicarTopeEfectivo2000 ? facturasEfectivoMayores2000 : [];

    const totalEfectivoFacturadoBruto = facturasEfectivo.reduce((acc, f) => acc + f._total, 0);
    const totalEfectivoFacturadoDeducible = facturasEfectivoDeducibles.reduce((acc, f) => acc + f._total, 0);
    const subtotalEfectivoFacturadoDeducible = facturasEfectivoDeducibles.reduce((acc, f) => acc + f._subtotal, 0);
    const ivaEfectivoFacturadoDeducible = facturasEfectivoDeducibles.reduce((acc, f) => acc + f._iva, 0);

    const totalEfectivoNoDeducibleTope2000 = facturasEfectivoNoDeduciblesPorTope.reduce((acc, f) => acc + f._total, 0);

    // Comparación: Efectivo Retirado del Banco vs Efectivo Facturado
    const efectivoRetiradoComprobado = Math.min(totalEfectivoRetiradoBanco, totalEfectivoFacturadoDeducible);
    const excedenteEfectivoRetiradoSinFactura = Math.max(0, totalEfectivoRetiradoBanco - totalEfectivoFacturadoBruto);
    const efectivoPagadoConCajaVentas = Math.max(0, totalEfectivoFacturadoBruto - totalEfectivoRetiradoBanco);

    // Sub-análisis de Otras Facturas (Transferencia 03, Tarjetas 04/28, Cheque 02, PPD 99)
    const facturasBancariasSinConciliar = facturasOtrosMetodos.filter(f => !f._esConciliado);
    const totalFacturasBancariasSinConciliar = facturasBancariasSinConciliar.reduce((acc, f) => acc + f._total, 0);

    const facturasOtrosElegibles = incluirFacturasNoConciliadas
      ? facturasOtrosMetodos
      : facturasOtrosMetodos.filter(f => f._esConciliado);

    const facturasOtrosExcluidasPorConciliacion = incluirFacturasNoConciliadas
      ? []
      : facturasOtrosMetodos.filter(f => !f._esConciliado);

    const totalOtrosFacturadoDeducible = facturasOtrosElegibles.reduce((acc, f) => acc + f._total, 0);
    const subtotalOtrosFacturadoDeducible = facturasOtrosElegibles.reduce((acc, f) => acc + f._subtotal, 0);
    const ivaOtrosFacturadoDeducible = facturasOtrosElegibles.reduce((acc, f) => acc + f._iva, 0);

    // Desglose por forma de pago de las otras facturas
    const desglosePorFormaPago = {
      transferencia03: facturasOtrosElegibles.filter(f => f._codigoPago === '03'),
      tarjetas04_28: facturasOtrosElegibles.filter(f => f._codigoPago === '04' || f._codigoPago === '28'),
      cheque02: facturasOtrosElegibles.filter(f => f._codigoPago === '02'),
      porDefinir99_otros: facturasOtrosElegibles.filter(
        f => !['01', '02', '03', '04', '28'].includes(f._codigoPago)
      ),
    };

    // Sub-análisis de Retiros Bancarios (No Efectivo) sin Factura / No Deducibles
    // Excluir traspasos, comisiones automáticas, nómina e impuestos pagados para no inflar falsamente los no deducibles
    const retirosBancariosSinFacturaList = otrosRetirosBanco.filter((m: any) => {
      if (m._estatusClave === 'excluido') return false;
      if (m._estatusClave === 'no_deducible') return true;
      if (['TRASPASO', 'COMISION', 'NOMINA', 'IMPUESTO'].includes(m._rubro)) return false;
      if (!m._tieneComprobante && m._montoSinConciliar > 0.05) return true;
      return false;
    });

    const totalRetirosBancariosSinFactura = retirosBancariosSinFacturaList.reduce(
      (acc, m) => acc + (m._estatusClave === 'no_deducible' ? m._montoAbs : m._montoSinConciliar),
      0
    );

    const totalFacturasMarcadasNoDeducibles = facturasMarcadasNoDeducibles.reduce((acc, f) => acc + f._total, 0);

    // Gran Total No Deducibles del Mes
    const totalNoDeduciblesGeneral =
      excedenteEfectivoRetiradoSinFactura +
      totalRetirosBancariosSinFactura +
      totalFacturasMarcadasNoDeducibles +
      totalEfectivoNoDeducibleTope2000;

    // Gran Total Deducciones Autorizadas (Subtotal e IVA Acreditable)
    const totalDeduccionesSubtotal = subtotalEfectivoFacturadoDeducible + subtotalOtrosFacturadoDeducible;
    const totalIvaAcreditable = ivaEfectivoFacturadoDeducible + ivaOtrosFacturadoDeducible;
    const totalFacturasDeduciblesConIva = totalEfectivoFacturadoDeducible + totalOtrosFacturadoDeducible;

    // ───────────────────────────────────────────────────────────────────────────
    // C) SEPARACIÓN POR LOS 7 CONCEPTOS CONTABLES (PROVEEDOR, NÓMINA, IMPUESTO, ETC.)
    // ───────────────────────────────────────────────────────────────────────────
    const todosRetirosEnriched = [...retirosEfectivoBanco, ...otrosRetirosBanco];
    const rubroDefs: Array<{
      key: RubroKey;
      label: string;
      descripcion: string;
      tratamientoFiscal: string;
      esNeutroFiscal: boolean;
    }> = [
      {
        key: 'PROVEEDOR',
        label: '1. Pagos a Proveedores e Insumos',
        descripcion: 'Compras de mercancía, materia prima y proveedores con CFDI',
        tratamientoFiscal: 'Deducible ISR + Acredita IVA',
        esNeutroFiscal: false,
      },
      {
        key: 'NOMINA',
        label: '2. Nóminas, Sueldos y Asistencia',
        descripcion: 'Dispersión de sueldos, salarios, finiquitos y propinas',
        tratamientoFiscal: 'Deducible ISR (Exento IVA)',
        esNeutroFiscal: false,
      },
      {
        key: 'IMPUESTO',
        label: '3. Impuestos y Contribuciones (SAT / IMSS)',
        descripcion: 'Pagos referenciados SAT, cuotas IMSS/INFONAVIT e impuestos estatales',
        tratamientoFiscal: 'Contribuciones Oficiales',
        esNeutroFiscal: false,
      },
      {
        key: 'COMISION',
        label: '4. Comisiones Bancarias y TPV',
        descripcion: 'Comisiones por terminal punto de venta (BBVA/Parrot/Clip) y manejo de cuenta',
        tratamientoFiscal: 'Gasto Financiero Deducible',
        esNeutroFiscal: false,
      },
      {
        key: 'OPERATIVO',
        label: '5. Renta, Servicios y Gastos Operativos',
        descripcion: 'Arrendamiento, CFE, agua, internet, mantenimiento y combustibles',
        tratamientoFiscal: 'Deducible ISR + Acredita IVA',
        esNeutroFiscal: false,
      },
      {
        key: 'EFECTIVO',
        label: '6. Retiros de Efectivo vs. Facturas (01)',
        descripcion: 'Disposiciones de cajero/ventanilla comprobadas con CFDI 01 <= $2,000',
        tratamientoFiscal: 'Deducible con CFDI 01 <= $2,000',
        esNeutroFiscal: false,
      },
      {
        key: 'TRASPASO',
        label: '7. Traspasos entre Cuentas y Reembolsos',
        descripcion: 'Movimientos entre cuentas propias, préstamos y ajustes (No afectos a impuestos)',
        tratamientoFiscal: 'Neutro (No Acumulable / No Gasto)',
        esNeutroFiscal: true,
      },
    ];

    const rubrosSummary: RubroConceptoSummary[] = rubroDefs.map((def) => {
      const movsRubro = todosRetirosEnriched.filter((m) => m._rubro === def.key);
      const gastosRubro = gastosMesEnriched.filter((g) => g._rubro === def.key);

      const montoBancoTotal = movsRubro.reduce((s, m) => s + m._montoAbs, 0);
      const movsConciliadosCount = movsRubro.filter(
        (m) => m._tieneComprobante || m._estatusClave === 'conciliado' || ['COMISION', 'NOMINA', 'IMPUESTO', 'TRASPASO'].includes(def.key)
      ).length;

      const gastosDeduciblesRubro = gastosRubro.filter(
        (g) => !g._marcadaNoDeducible && !(aplicarTopeEfectivo2000 && g._supera2000)
      );

      let subtotalFacturado = gastosDeduciblesRubro.reduce((s, g) => s + g._subtotal, 0);
      let ivaFacturado = gastosDeduciblesRubro.reduce((s, g) => s + g._iva, 0);
      let totalFacturado = gastosDeduciblesRubro.reduce((s, g) => s + g._total, 0);

      // Si es Comisión o Nómina pagada directamente en estado de cuenta sin registro duplicado en tabla gastos, reflejar su comprobación bancaria
      if (def.key === 'COMISION' && totalFacturado === 0 && montoBancoTotal > 0) {
        totalFacturado = montoBancoTotal;
        subtotalFacturado = Number((montoBancoTotal / 1.16).toFixed(2));
        ivaFacturado = Number((montoBancoTotal - subtotalFacturado).toFixed(2));
      } else if (def.key === 'NOMINA' && totalFacturado === 0 && montoBancoTotal > 0) {
        totalFacturado = montoBancoTotal;
        subtotalFacturado = montoBancoTotal;
        ivaFacturado = 0;
      }

      let montoNoDeducible = 0;
      if (def.key === 'EFECTIVO') {
        montoNoDeducible = excedenteEfectivoRetiradoSinFactura + totalEfectivoNoDeducibleTope2000;
      } else if (!def.esNeutroFiscal) {
        const noDedMovs = movsRubro
          .filter((m) => retirosBancariosSinFacturaList.some((r) => r.id === m.id))
          .reduce((s, m) => s + (m._estatusClave === 'no_deducible' ? m._montoAbs : m._montoSinConciliar), 0);
        const noDedGastos = gastosRubro
          .filter((g) => g._marcadaNoDeducible)
          .reduce((s, g) => s + g._total, 0);
        montoNoDeducible = noDedMovs + noDedGastos;
      }

      return {
        key: def.key,
        label: def.label,
        descripcion: def.descripcion,
        tratamientoFiscal: def.tratamientoFiscal,
        esNeutroFiscal: def.esNeutroFiscal,
        movsBancoCount: movsRubro.length,
        montoBancoTotal: Number(montoBancoTotal.toFixed(2)),
        movsConciliadosCount,
        facturasCount: gastosRubro.length,
        subtotalFacturado: Number(subtotalFacturado.toFixed(2)),
        ivaFacturado: Number(ivaFacturado.toFixed(2)),
        totalFacturado: Number(totalFacturado.toFixed(2)),
        montoDeducibleSubtotal: Number(subtotalFacturado.toFixed(2)),
        montoNoDeducible: Number(montoNoDeducible.toFixed(2)),
      };
    });

    // ───────────────────────────────────────────────────────────────────────────
    // D) CÉDULA PRE-DIOT POR PROVEEDOR (AGRUPADO POR RFC)
    // ───────────────────────────────────────────────────────────────────────────
    const diotMap = new Map<string, ProveedorDiotSummary>();
    [...facturasEfectivoDeducibles, ...facturasOtrosElegibles].forEach((g: any) => {
      const rfc = String(g.proveedores?.rfc || 'XAXX010101000').trim().toUpperCase();
      const nombre =
        g.proveedores?.nombre_comercial ||
        g.proveedores?.razon_social ||
        (rfc === 'XAXX010101000' ? 'Proveedores Varios / Sin RFC' : rfc);

      if (!diotMap.has(rfc)) {
        diotMap.set(rfc, {
          rfc,
          nombre,
          facturasCount: 0,
          conciliadasCount: 0,
          subtotal: 0,
          ivaAcreditable: 0,
          total: 0,
          pagadoEfectivo: 0,
          pagadoBanco: 0,
        });
      }
      const item = diotMap.get(rfc)!;
      item.facturasCount += 1;
      if (g._esConciliado || g._codigoPago === '01') item.conciliadasCount += 1;
      item.subtotal = Number((item.subtotal + g._subtotal).toFixed(2));
      item.ivaAcreditable = Number((item.ivaAcreditable + g._iva).toFixed(2));
      item.total = Number((item.total + g._total).toFixed(2));
      if (g._codigoPago === '01') {
        item.pagadoEfectivo = Number((item.pagadoEfectivo + g._total).toFixed(2));
      } else {
        item.pagadoBanco = Number((item.pagadoBanco + g._total).toFixed(2));
      }
    });

    const diotProveedores = Array.from(diotMap.values()).sort((a, b) => b.total - a.total);

    return {
      // Efectivo Retirado vs Facturado
      retirosEfectivoBanco,
      totalEfectivoRetiradoBanco: Number(totalEfectivoRetiradoBanco.toFixed(2)),
      facturasEfectivo,
      facturasEfectivoMenores2000,
      facturasEfectivoMayores2000,
      facturasEfectivoDeducibles,
      totalEfectivoFacturadoBruto: Number(totalEfectivoFacturadoBruto.toFixed(2)),
      totalEfectivoFacturadoDeducible: Number(totalEfectivoFacturadoDeducible.toFixed(2)),
      subtotalEfectivoFacturadoDeducible: Number(subtotalEfectivoFacturadoDeducible.toFixed(2)),
      ivaEfectivoFacturadoDeducible: Number(ivaEfectivoFacturadoDeducible.toFixed(2)),
      efectivoRetiradoComprobado: Number(efectivoRetiradoComprobado.toFixed(2)),
      excedenteEfectivoRetiradoSinFactura: Number(excedenteEfectivoRetiradoSinFactura.toFixed(2)),
      efectivoPagadoConCajaVentas: Number(efectivoPagadoConCajaVentas.toFixed(2)),
      totalEfectivoNoDeducibleTope2000: Number(totalEfectivoNoDeducibleTope2000.toFixed(2)),

      // Otras Facturas (Transferencia, Tarjetas, etc.)
      facturasOtrosMetodos,
      facturasOtrosElegibles,
      facturasOtrosExcluidasPorConciliacion,
      facturasBancariasSinConciliar,
      totalFacturasBancariasSinConciliar: Number(totalFacturasBancariasSinConciliar.toFixed(2)),
      desglosePorFormaPago,
      totalOtrosFacturadoDeducible: Number(totalOtrosFacturadoDeducible.toFixed(2)),
      subtotalOtrosFacturadoDeducible: Number(subtotalOtrosFacturadoDeducible.toFixed(2)),
      ivaOtrosFacturadoDeducible: Number(ivaOtrosFacturadoDeducible.toFixed(2)),

      // No Deducibles
      retirosBancariosSinFacturaList,
      totalRetirosBancariosSinFactura: Number(totalRetirosBancariosSinFactura.toFixed(2)),
      facturasMarcadasNoDeducibles,
      totalFacturasMarcadasNoDeducibles: Number(totalFacturasMarcadasNoDeducibles.toFixed(2)),
      totalNoDeduciblesGeneral: Number(totalNoDeduciblesGeneral.toFixed(2)),

      // Consolidado Deducciones
      totalDeduccionesSubtotal: Number(totalDeduccionesSubtotal.toFixed(2)),
      totalIvaAcreditable: Number(totalIvaAcreditable.toFixed(2)),
      totalFacturasDeduciblesConIva: Number(totalFacturasDeduciblesConIva.toFixed(2)),
      totalRetirosBancoMes: Number(retirosBancoMes.reduce((acc, m) => acc + Math.abs(Number(m.retiro || m.monto || 0)), 0).toFixed(2)),

      // Nuevos Análisis: 7 Conceptos, Pre-DIOT y Listas Enriquecidas
      rubrosSummary,
      diotProveedores,
      gastosMesEnriched,
      todosRetirosEnriched,
    };
  }, [
    gastosRaw,
    movimientosRaw,
    conciliacionesRaw,
    selectedMonth,
    aplicarTopeEfectivo2000,
    incluirFacturasNoConciliadas,
    formasPagoMap,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. CÁLCULO DE GANANCIAS (FINANCIERA VS FISCAL) E IMPUESTOS (IVA E ISR)
  // ─────────────────────────────────────────────────────────────────────────────
  const taxCalculation = useMemo(() => {
    const ingresosSinIva = ingresosAnalysis.ingresosSubtotalAcumulable;
    const ingresosConIva = ingresosAnalysis.ingresosTotalesConIva;
    const deduccionesAutorizadas = egresosAnalysis.totalDeduccionesSubtotal;
    const noDeducibles = egresosAnalysis.totalNoDeduciblesGeneral;

    // 1. Ganancia / Utilidad Operativa Real (Financiera)
    // Toma todos los ingresos (sin IVA) menos todos los gastos reales (deducibles + no deducibles)
    const utilidadOperativaReal = Number((ingresosSinIva - deduccionesAutorizadas - noDeducibles).toFixed(2));
    const margenOperativoPct = ingresosSinIva > 0 ? Number(((utilidadOperativaReal / ingresosSinIva) * 100).toFixed(1)) : 0;

    // 2. Utilidad Fiscal (Base Gravable para ISR en esquema general)
    // Como los No Deducibles no se pueden restar fiscalmente, la utilidad fiscal es mayor
    const utilidadFiscal = Math.max(0, Number((ingresosSinIva - deduccionesAutorizadas).toFixed(2)));
    const perdidaFiscal = ingresosSinIva < deduccionesAutorizadas ? Number((deduccionesAutorizadas - ingresosSinIva).toFixed(2)) : 0;

    // 3. Cálculo de ISR según modalidad elegida
    let baseGravableIsr = 0;
    let isrEstimado = 0;

    if (modalidadIsr === 'utilidad_fiscal') {
      baseGravableIsr = utilidadFiscal;
      isrEstimado = Number(((baseGravableIsr * tasaIsr) / 100).toFixed(2));
    } else if (modalidadIsr === 'coeficiente_utilidad') {
      baseGravableIsr = Number((ingresosSinIva * coeficienteUtilidad).toFixed(2));
      isrEstimado = Number(((baseGravableIsr * tasaIsr) / 100).toFixed(2));
    } else {
      // resico_ingresos
      baseGravableIsr = ingresosSinIva;
      isrEstimado = Number(((baseGravableIsr * tasaIsr) / 100).toFixed(2));
    }

    // 4. Cálculo de IVA
    const ivaTrasladado = ingresosAnalysis.ivaTrasladadoTotal;
    const ivaAcreditable = egresosAnalysis.totalIvaAcreditable;
    const ivaNetoAntesSaldoFavor = Number((ivaTrasladado - ivaAcreditable).toFixed(2));
    const ivaAPagar = Math.max(0, Number((ivaNetoAntesSaldoFavor - saldoFavorIvaAnterior).toFixed(2)));
    const ivaSaldoAFavorMes = ivaNetoAntesSaldoFavor - saldoFavorIvaAnterior < 0
      ? Number(Math.abs(ivaNetoAntesSaldoFavor - saldoFavorIvaAnterior).toFixed(2))
      : 0;

    // 5. Total Impuestos Estimados a Pagar
    const totalImpuestosAPagar = Number((isrEstimado + ivaAPagar).toFixed(2));
    const tasaEfectivaSobreIngresos = ingresosSinIva > 0
      ? Number(((totalImpuestosAPagar / ingresosSinIva) * 100).toFixed(1))
      : 0;

    // 6. Ganancia Neta Libre después de Impuestos
    const gananciaNetaDespuesImpuestos = Number((utilidadOperativaReal - totalImpuestosAPagar).toFixed(2));

    // 7. Costo Fiscal de los No Deducibles (cuánto impuesto se ahorraría si los No Deducibles tuvieran factura con IVA)
    const baseNoDeducibleSinIva = Number((noDeducibles / 1.16).toFixed(2));
    const ivaPerdidoNoDeducibles = Number((noDeducibles - baseNoDeducibleSinIva).toFixed(2));
    const isrExtraPorNoDeducibles = modalidadIsr === 'utilidad_fiscal'
      ? Number(((baseNoDeducibleSinIva * tasaIsr) / 100).toFixed(2))
      : 0;
    const sobrecostoFiscalNoDeducibles = Number((ivaPerdidoNoDeducibles + isrExtraPorNoDeducibles).toFixed(2));

    return {
      ingresosSinIva,
      ingresosConIva,
      deduccionesAutorizadas,
      noDeducibles,
      utilidadOperativaReal,
      margenOperativoPct,
      utilidadFiscal,
      perdidaFiscal,
      baseGravableIsr,
      isrEstimado,
      ivaTrasladado,
      ivaAcreditable,
      ivaAPagar,
      ivaSaldoAFavorMes,
      totalImpuestosAPagar,
      tasaEfectivaSobreIngresos,
      gananciaNetaDespuesImpuestos,
      ivaPerdidoNoDeducibles,
      isrExtraPorNoDeducibles,
      sobrecostoFiscalNoDeducibles,
    };
  }, [
    ingresosAnalysis,
    egresosAnalysis,
    modalidadIsr,
    tasaIsr,
    coeficienteUtilidad,
    saldoFavorIvaAnterior,
  ]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. MÉTRICAS DE TRABAJO CONTABLE REALIZADO EN EL MES Y SEMÁFORO FISCAL SAT
  // ─────────────────────────────────────────────────────────────────────────────
  const trabajoMensual = useMemo<TrabajoMensualMetrics>(() => {
    const retiros = egresosAnalysis.todosRetirosEnriched || [];
    const depositos = depositosMes || [];
    const totalMovsEstadoCuenta = retiros.length + depositos.length;

    const totalDepositosCount = depositos.length;
    const totalDepositosMonto = ingresosAnalysis.totalDepositosBancoBruto;

    const totalRetirosCount = retiros.length;
    const totalRetirosMonto = egresosAnalysis.totalRetirosBancoMes;

    // Movimientos de retiro facturados/conciliados con CFDI
    const retirosConCfdi = retiros.filter(
      (m: any) => m._tieneComprobante || m._estatusClave === 'conciliado'
    );
    // Depósitos conciliados o cubiertos por Factura Global / Clientes
    const depositosCubiertosCount =
      ingresosAnalysis.globalTotalConIva + ingresosAnalysis.totalTercerosConIva >= totalDepositosMonto * 0.95
        ? depositos.length
        : depositos.filter((d: any) => d._esConciliado || d.estatus_conciliacion_bancaria?.clave === 'conciliado').length;
    const depositosCubiertosMonto =
      depositosCubiertosCount === depositos.length
        ? totalDepositosMonto
        : Math.min(totalDepositosMonto, ingresosAnalysis.globalTotalConIva + ingresosAnalysis.totalTercerosConIva);

    const movsFacturadosConciliadosCount = retirosConCfdi.length + depositosCubiertosCount;
    const movsFacturadosConciliadosMonto = Number(
      (retirosConCfdi.reduce((s: number, m: any) => s + m._montoAbs, 0) + depositosCubiertosMonto).toFixed(2)
    );

    // Movimientos comprobados por regla especial (Comisiones, Nómina, Impuestos, Traspasos o Retiros de Efectivo cubiertos con CFDI 01)
    const retirosReglaEspecial = retiros.filter(
      (m: any) =>
        !retirosConCfdi.some((rc: any) => rc.id === m.id) &&
        (['COMISION', 'NOMINA', 'IMPUESTO', 'TRASPASO'].includes(m._rubro) ||
          (m._rubro === 'EFECTIVO' && egresosAnalysis.efectivoRetiradoComprobado > 0))
    );
    const movsComprobadosReglaCount = retirosReglaEspecial.length;
    const movsComprobadosReglaMonto = Number(
      retirosReglaEspecial.reduce((s: number, m: any) => s + m._montoAbs, 0).toFixed(2)
    );

    // Movimientos No Deducibles / Sin Factura
    const movsNoDeduciblesCount = egresosAnalysis.retirosBancariosSinFacturaList.length;
    const movsNoDeduciblesMonto = egresosAnalysis.totalRetirosBancariosSinFactura;

    // Movimientos Pendientes
    const resueltosCount = Math.min(
      totalMovsEstadoCuenta,
      movsFacturadosConciliadosCount + movsComprobadosReglaCount
    );
    const movsPendientesCount = Math.max(0, totalMovsEstadoCuenta - resueltosCount);
    const movsPendientesMonto = Number(
      (egresosAnalysis.totalRetirosBancariosSinFactura + egresosAnalysis.excedenteEfectivoRetiradoSinFactura).toFixed(2)
    );

    const porcentajeAvanceEstadoCuenta =
      totalMovsEstadoCuenta > 0
        ? Number(((resueltosCount / totalMovsEstadoCuenta) * 100).toFixed(1))
        : 100;

    // Facturas de Gastos y Emitidas
    const gastos = egresosAnalysis.gastosMesEnriched || [];
    const totalFacturasGastosCount = gastos.length;
    const totalFacturasGastosMonto = Number(gastos.reduce((s: number, g: any) => s + g._total, 0).toFixed(2));

    const gastosConciliadosBanco = gastos.filter((g: any) => g._esConciliado && g._codigoPago !== '01');
    const facturasGastosConciliadasCount = gastosConciliadosBanco.length;
    const facturasGastosConciliadasMonto = Number(
      gastosConciliadosBanco.reduce((s: number, g: any) => s + g._total, 0).toFixed(2)
    );

    const facturasEfectivoDeduciblesCount = egresosAnalysis.facturasEfectivoDeducibles?.length || 0;
    const facturasEfectivoDeduciblesMonto = egresosAnalysis.totalEfectivoFacturadoDeducible;

    const facturasConXmlCount = gastos.filter((g: any) => g._tieneXml).length;
    const facturasBancariasSinConciliarCount = egresosAnalysis.facturasBancariasSinConciliar?.length || 0;
    const facturasBancariasSinConciliarMonto = egresosAnalysis.totalFacturasBancariasSinConciliar || 0;

    const totalFacturasResueltas = facturasGastosConciliadasCount + facturasEfectivoDeduciblesCount;
    const porcentajeFacturasConciliadas =
      totalFacturasGastosCount > 0
        ? Number((Math.min(1, totalFacturasResueltas / totalFacturasGastosCount) * 100).toFixed(1))
        : 100;

    const totalFacturasEmitidasCount = ingresosAnalysis.countTerceros + ingresosAnalysis.countPgEmitidas;
    const totalFacturasEmitidasMonto = Number(
      (ingresosAnalysis.totalTercerosConIva + ingresosAnalysis.globalTotalConIva).toFixed(2)
    );

    return {
      totalMovsEstadoCuenta,
      totalDepositosCount,
      totalDepositosMonto,
      totalRetirosCount,
      totalRetirosMonto,
      movsFacturadosConciliadosCount,
      movsFacturadosConciliadosMonto,
      movsComprobadosReglaCount,
      movsComprobadosReglaMonto,
      movsNoDeduciblesCount,
      movsNoDeduciblesMonto,
      movsPendientesCount,
      movsPendientesMonto,
      porcentajeAvanceEstadoCuenta,
      totalFacturasGastosCount,
      totalFacturasGastosMonto,
      facturasGastosConciliadasCount,
      facturasGastosConciliadasMonto,
      facturasEfectivoDeduciblesCount,
      facturasEfectivoDeduciblesMonto,
      facturasConXmlCount,
      facturasBancariasSinConciliarCount,
      facturasBancariasSinConciliarMonto,
      porcentajeFacturasConciliadas,
      totalFacturasEmitidasCount,
      totalFacturasEmitidasMonto,
    };
  }, [egresosAnalysis, ingresosAnalysis, depositosMes]);

  const semaforoFiscal = useMemo<SemaforoFiscalItem[]>(() => {
    const items: SemaforoFiscalItem[] = [];

    // 1. Discrepancia de Ingresos (Depósitos en Banco vs. Factura Global + Terceros)
    const totalCfdiIngresos = ingresosAnalysis.globalTotalConIva + ingresosAnalysis.totalTercerosConIva;
    const difIngresos = Number((ingresosAnalysis.totalDepositosNetos - totalCfdiIngresos).toFixed(2));
    if (difIngresos > 100) {
      items.push({
        titulo: '1. Depósitos vs. Ingresos Facturados',
        nivel: 'rojo',
        etiqueta: 'Depósitos sin Facturar',
        resumen: `Los depósitos bancarios (${formatCurrency(ingresosAnalysis.totalDepositosNetos)}) superan en ${formatCurrency(difIngresos)} a la suma de Facturas + Global. Riesgo de ingresos omitidos ante el SAT.`,
        montoDiferencia: difIngresos,
      });
    } else {
      items.push({
        titulo: '1. Depósitos vs. Ingresos Facturados',
        nivel: 'verde',
        etiqueta: '100% Cubierto',
        resumen: `Todos los depósitos bancarios (${formatCurrency(ingresosAnalysis.totalDepositosNetos)}) están cubiertos por las Facturas a Clientes y la Factura Global (${formatCurrency(totalCfdiIngresos)}).`,
        montoDiferencia: 0,
      });
    }

    // 2. Arqueo Fiscal de Efectivo (Retiros en Banco vs. Facturas 01)
    if (egresosAnalysis.excedenteEfectivoRetiradoSinFactura > 50) {
      items.push({
        titulo: '2. Efectivo Retirado vs. Facturado (01)',
        nivel: 'amarillo',
        etiqueta: 'Efectivo sin CFDI',
        resumen: `Se retiraron ${formatCurrency(egresosAnalysis.totalEfectivoRetiradoBanco)} en efectivo del banco, pero solo hay ${formatCurrency(egresosAnalysis.totalEfectivoFacturadoDeducible)} en facturas 01 deducibles. Faltan ${formatCurrency(egresosAnalysis.excedenteEfectivoRetiradoSinFactura)} por comprobar.`,
        montoDiferencia: egresosAnalysis.excedenteEfectivoRetiradoSinFactura,
      });
    } else {
      items.push({
        titulo: '2. Efectivo Retirado vs. Facturado (01)',
        nivel: 'verde',
        etiqueta: 'Efectivo Comprobado',
        resumen: `El efectivo deducido con facturas 01 (${formatCurrency(egresosAnalysis.totalEfectivoFacturadoDeducible)}) cubre el 100% de los retiros de efectivo del banco (${formatCurrency(egresosAnalysis.totalEfectivoRetiradoBanco)}).`,
        montoDiferencia: 0,
      });
    }

    // 3. Facturas Bancarias (03/04/28) sin Cargo Conciliado en Banco
    const sinConcCount = egresosAnalysis.facturasBancariasSinConciliar?.length || 0;
    const sinConcMonto = egresosAnalysis.totalFacturasBancariasSinConciliar || 0;
    if (sinConcCount > 0) {
      items.push({
        titulo: '3. Facturas Bancarias (03/04/28) en Banco',
        nivel: 'amarillo',
        etiqueta: `${sinConcCount} Sin Conciliar`,
        resumen: `Hay ${sinConcCount} factura(s) con método Transferencia/Tarjeta por ${formatCurrency(sinConcMonto)} que aún no están vinculadas a un movimiento del estado de cuenta.`,
        montoDiferencia: sinConcMonto,
      });
    } else {
      items.push({
        titulo: '3. Facturas Bancarias (03/04/28) en Banco',
        nivel: 'verde',
        etiqueta: '100% Conciliadas',
        resumen: `Todas las facturas pagadas por transferencia o tarjeta cuentan con su movimiento bancario conciliado en el estado de cuenta.`,
        montoDiferencia: 0,
      });
    }

    return items;
  }, [ingresosAnalysis, egresosAnalysis, formatCurrency]);

  const handleGenerarReportePdf = () => {
    const modalidadLabel =
      modalidadIsr === 'utilidad_fiscal'
        ? 'Utilidad Fiscal (Ingresos - Deducciones)'
        : modalidadIsr === 'coeficiente_utilidad'
        ? `Coeficiente de Utilidad (${coeficienteUtilidad})`
        : 'RESICO (Tasa Directa s/ Ingresos)';

    generarReporteMensualPdf({
      empresaNombre: empresaNombre || 'Empresa Activa',
      empresaRfc: empresaRfc || 'N/D',
      selectedMonth: selectedMonth || 'Actual',
      modalidadIsrLabel: modalidadLabel,
      tasaIsr,
      trabajo: trabajoMensual,
      rubros: egresosAnalysis.rubrosSummary,
      semaforo: semaforoFiscal,
      diotProveedores: egresosAnalysis.diotProveedores,
      ingresos: {
        globalSubtotal: ingresosAnalysis.globalSubtotal,
        globalIva: ingresosAnalysis.globalIva,
        globalTotalConIva: ingresosAnalysis.globalTotalConIva,
        subtotalTerceros: ingresosAnalysis.subtotalTerceros,
        ivaTerceros: ingresosAnalysis.ivaTerceros,
        totalTercerosConIva: ingresosAnalysis.totalTercerosConIva,
        countTerceros: ingresosAnalysis.countTerceros,
        totalDepositosNetos: ingresosAnalysis.totalDepositosNetos,
        ingresosSinIva: taxCalculation.ingresosSinIva,
        ingresosConIva: taxCalculation.ingresosConIva,
        ivaTrasladado: taxCalculation.ivaTrasladado,
      },
      efectivo: {
        totalEfectivoRetiradoBanco: egresosAnalysis.totalEfectivoRetiradoBanco,
        retirosCount: egresosAnalysis.retirosEfectivoBanco.length,
        totalEfectivoFacturadoBruto: egresosAnalysis.totalEfectivoFacturadoBruto,
        facturasEfectivoCount: egresosAnalysis.facturasEfectivo.length,
        totalEfectivoFacturadoDeducible: egresosAnalysis.totalEfectivoFacturadoDeducible,
        subtotalEfectivoFacturadoDeducible: egresosAnalysis.subtotalEfectivoFacturadoDeducible,
        ivaEfectivoFacturadoDeducible: egresosAnalysis.ivaEfectivoFacturadoDeducible,
        excedenteEfectivoRetiradoSinFactura: egresosAnalysis.excedenteEfectivoRetiradoSinFactura,
        totalEfectivoNoDeducibleTope2000: egresosAnalysis.totalEfectivoNoDeducibleTope2000,
        efectivoPagadoConCajaVentas: egresosAnalysis.efectivoPagadoConCajaVentas,
      },
      impuestos: {
        deduccionesAutorizadas: taxCalculation.deduccionesAutorizadas,
        noDeducibles: taxCalculation.noDeducibles,
        utilidadOperativaReal: taxCalculation.utilidadOperativaReal,
        margenOperativoPct: taxCalculation.margenOperativoPct,
        utilidadFiscal: taxCalculation.utilidadFiscal,
        baseGravableIsr: taxCalculation.baseGravableIsr,
        isrEstimado: taxCalculation.isrEstimado,
        ivaTrasladado: taxCalculation.ivaTrasladado,
        ivaAcreditable: taxCalculation.ivaAcreditable,
        saldoFavorIvaAnterior,
        ivaAPagar: taxCalculation.ivaAPagar,
        ivaSaldoAFavorMes: taxCalculation.ivaSaldoAFavorMes,
        totalImpuestosAPagar: taxCalculation.totalImpuestosAPagar,
        tasaEfectivaSobreIngresos: taxCalculation.tasaEfectivaSobreIngresos,
        gananciaNetaDespuesImpuestos: taxCalculation.gananciaNetaDespuesImpuestos,
        sobrecostoFiscalNoDeducibles: taxCalculation.sobrecostoFiscalNoDeducibles,
      },
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPORTACIÓN EXCEL DEL REPORTE FISCAL E IMPUESTOS
  // ─────────────────────────────────────────────────────────────────────────────
  const handleExportTaxExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Resumen Ejecutivo de Impuestos y Ganancias
      const resumenRows = [
        { Concepto: '--- 1. INGRESOS Y FACTURA GLOBAL ---', Importe: '' },
        { Concepto: 'Total Factura Global (Público en General con IVA)', Importe: ingresosAnalysis.globalTotalConIva },
        { Concepto: 'Subtotal Factura Global (Base sin IVA)', Importe: ingresosAnalysis.globalSubtotal },
        { Concepto: 'IVA Trasladado Factura Global (16%)', Importe: ingresosAnalysis.globalIva },
        { Concepto: `Facturas Individuales a Terceros (${ingresosAnalysis.countTerceros} CFDI con IVA)`, Importe: ingresosAnalysis.totalTercerosConIva },
        { Concepto: 'Subtotal Facturas a Terceros (Base sin IVA)', Importe: ingresosAnalysis.subtotalTerceros },
        { Concepto: 'IVA Trasladado Facturas a Terceros (16%)', Importe: ingresosAnalysis.ivaTerceros },
        { Concepto: 'TOTAL INGRESOS BRUTOS DEL PERIODO (CON IVA)', Importe: taxCalculation.ingresosConIva },
        { Concepto: 'TOTAL INGRESOS ACUMULABLES (BASE SIN IVA)', Importe: taxCalculation.ingresosSinIva },
        { Concepto: '', Importe: '' },
        { Concepto: '--- 2. ANÁLISIS DE EFECTIVO (RETIRADO VS FACTURADO 01) ---', Importe: '' },
        { Concepto: 'Efectivo Retirado del Banco (Cajero / Ventanilla / Practicaja)', Importe: egresosAnalysis.totalEfectivoRetiradoBanco },
        { Concepto: 'Total Facturas Pagadas en Efectivo (01) Bruto', Importe: egresosAnalysis.totalEfectivoFacturadoBruto },
        { Concepto: 'Facturas en Efectivo Deducibles (con IVA)', Importe: egresosAnalysis.totalEfectivoFacturadoDeducible },
        { Concepto: 'Excedente de Efectivo Retirado SIN Factura (No Deducible)', Importe: egresosAnalysis.excedenteEfectivoRetiradoSinFactura },
        { Concepto: 'Facturas en Efectivo > $2,000 MXN (No Deducibles si aplica tope)', Importe: egresosAnalysis.totalEfectivoNoDeducibleTope2000 },
        { Concepto: 'Efectivo Facturado Cubierto con Caja / Ventas en Efectivo', Importe: egresosAnalysis.efectivoPagadoConCajaVentas },
        { Concepto: '', Importe: '' },
        { Concepto: '--- 3. DEDUCCIONES AUTORIZADAS Y NO DEDUCIBLES ---', Importe: '' },
        { Concepto: 'Subtotal Facturas Deducibles en Efectivo (01)', Importe: egresosAnalysis.subtotalEfectivoFacturadoDeducible },
        { Concepto: 'Subtotal Facturas Deducibles Transferencia / Tarjetas / Otros', Importe: egresosAnalysis.subtotalOtrosFacturadoDeducible },
        { Concepto: 'TOTAL DEDUCCIONES AUTORIZADAS (SUBTOTAL SIN IVA)', Importe: taxCalculation.deduccionesAutorizadas },
        { Concepto: 'TOTAL IVA ACREDITABLE DEL PERIODO', Importe: taxCalculation.ivaAcreditable },
        { Concepto: 'TOTAL GASTOS NO DEDUCIBLES Y RETIROS SIN FACTURA', Importe: taxCalculation.noDeducibles },
        { Concepto: '', Importe: '' },
        { Concepto: '--- 4. UTILIDAD Y CÁLCULO APROXIMADO DE IMPUESTOS ---', Importe: '' },
        { Concepto: 'Ganancia / Utilidad Operativa Real (Ingresos - Todos los Gastos)', Importe: taxCalculation.utilidadOperativaReal },
        { Concepto: 'Utilidad Fiscal (Base Gravable Ingresos - Deducciones)', Importe: taxCalculation.utilidadFiscal },
        { Concepto: `ISR Estimado (${tasaIsr}%)`, Importe: taxCalculation.isrEstimado },
        { Concepto: 'IVA Trasladado Cobrado (+)', Importe: taxCalculation.ivaTrasladado },
        { Concepto: 'IVA Acreditable Deducible (-)', Importe: -taxCalculation.ivaAcreditable },
        { Concepto: 'IVA Neto Estimado a Pagar (=)', Importe: taxCalculation.ivaAPagar },
        { Concepto: 'TOTAL IMPUESTOS ESTIMADOS A PAGAR (ISR + IVA)', Importe: taxCalculation.totalImpuestosAPagar },
        { Concepto: 'GANANCIA NETA LIBRE DESPUÉS DE IMPUESTOS', Importe: taxCalculation.gananciaNetaDespuesImpuestos },
      ];

      const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
      wsResumen['!cols'] = [{ wch: 62 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Impuestos');

      // Hoja 2: Efectivo Retirado vs Facturado (01)
      const efectivoRows = [
        ...egresosAnalysis.retirosEfectivoBanco.map((m: any) => ({
          Tipo: 'RETIRO EFECTIVO BANCO',
          Fecha: m.fecha ? formatDate(m.fecha) : '',
          Folio_Referencia: m.referencia || '',
          Concepto: m.concepto || '',
          Contraparte: m.cuentas_bancarias?.nombre || 'Banco',
          Subtotal: m._montoAbs,
          IVA: 0,
          Total: m._montoAbs,
          Estatus_Fiscal: m._tieneComprobante ? 'Comprobado en Banco' : 'Retiro de Efectivo',
        })),
        ...egresosAnalysis.facturasEfectivo.map((g: any) => ({
          Tipo: 'FACTURA EFECTIVO (01)',
          Fecha: g.fecha_gasto ? formatDate(g.fecha_gasto) : '',
          Folio_Referencia: g.folio_factura || g.uuid_fiscal || '',
          Concepto: g.concepto || '',
          Contraparte: g.proveedores?.nombre_comercial || g.proveedores?.rfc || '',
          Subtotal: g._subtotal,
          IVA: g._iva,
          Total: g._total,
          Estatus_Fiscal: g._supera2000
            ? 'Alerta > $2,000 MXN en Efectivo'
            : 'Deducible (01 - Efectivo <= $2,000)',
        })),
      ];
      const wsEfectivo = XLSX.utils.json_to_sheet(efectivoRows);
      wsEfectivo['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 22 }, { wch: 38 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsEfectivo, 'Efectivo Retirado vs Fact');

      // Hoja 3: Otras Facturas Deducibles (Transferencia, Tarjetas, etc.)
      const otrasFacturasRows = egresosAnalysis.facturasOtrosMetodos.map((g: any) => ({
        Fecha: g.fecha_gasto ? formatDate(g.fecha_gasto) : '',
        Forma_Pago: g._codigoPago,
        Folio_UUID: g.folio_factura || g.uuid_fiscal || '',
        Proveedor: g.proveedores?.nombre_comercial || '',
        RFC: g.proveedores?.rfc || '',
        Concepto: g.concepto || '',
        Subtotal: g._subtotal,
        IVA_Acreditable: g._iva,
        Total: g._total,
        Conciliado_Banco: g._esConciliado ? 'SÍ' : 'PENDIENTE',
      }));
      const wsOtras = XLSX.utils.json_to_sheet(otrasFacturasRows);
      wsOtras['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 28 }, { wch: 15 }, { wch: 38 }, { wch: 14 }, { wch: 15 }, { wch: 14 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsOtras, 'Facturas Bancarias Deducibles');

      // Hoja 4: No Deducibles y Sin Factura
      const noDedRows = [
        ...(egresosAnalysis.excedenteEfectivoRetiradoSinFactura > 0
          ? [{
              Origen: 'Excedente Efectivo Retirado sin Factura',
              Fecha: selectedMonth,
              Concepto: 'Diferencia entre retiros de efectivo del banco y facturas pagadas en efectivo (01)',
              Contraparte: 'Caja / Retiros Cajero',
              Monto_No_Deducible: egresosAnalysis.excedenteEfectivoRetiradoSinFactura,
              Motivo: 'Sin CFDI que ampare el efectivo retirado',
            }]
          : []),
        ...egresosAnalysis.retirosBancariosSinFacturaList.map((m: any) => ({
          Origen: 'Retiro Bancario sin Factura',
          Fecha: m.fecha ? formatDate(m.fecha) : '',
          Concepto: m.concepto || '',
          Contraparte: m.cuentas_bancarias?.nombre || '',
          Monto_No_Deducible: m._estatusClave === 'no_deducible' ? m._montoAbs : m._montoSinConciliar,
          Motivo: m._estatusClave === 'no_deducible' ? 'Marcado No Deducible' : 'Cargo en cuenta sin XML vinculado',
        })),
        ...egresosAnalysis.facturasMarcadasNoDeducibles.map((g: any) => ({
          Origen: 'Gasto Marcado No Deducible',
          Fecha: g.fecha_gasto ? formatDate(g.fecha_gasto) : '',
          Concepto: g.concepto || '',
          Contraparte: g.proveedores?.nombre_comercial || '',
          Monto_No_Deducible: g._total,
          Motivo: 'Marcado es_deducible = false',
        })),
        ...(aplicarTopeEfectivo2000
          ? egresosAnalysis.facturasEfectivoMayores2000.map((g: any) => ({
              Origen: 'Factura en Efectivo > $2,000',
              Fecha: g.fecha_gasto ? formatDate(g.fecha_gasto) : '',
              Concepto: g.concepto || '',
              Contraparte: g.proveedores?.nombre_comercial || '',
              Monto_No_Deducible: g._total,
              Motivo: 'Excede límite de $2,000 MXN pagado en efectivo (Art. 27 LISR)',
            }))
          : []),
      ];
      const wsNoDed = XLSX.utils.json_to_sheet(noDedRows);
      wsNoDed['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 42 }, { wch: 26 }, { wch: 18 }, { wch: 36 }];
      XLSX.utils.book_append_sheet(wb, wsNoDed, 'No Deducibles');

      // Hoja 5: Trabajo Realizado y Separación por Conceptos
      const conceptosRows = [
        {
          Rubro_Contable: '--- MÉTRICAS DEL TRABAJO CONTABLE DEL MES ---',
          Tratamiento_Fiscal: '',
          Movimientos_Banco: trabajoMensual.totalMovsEstadoCuenta,
          Egreso_Banco_Total: trabajoMensual.totalRetirosMonto,
          Facturas_CFDI: trabajoMensual.totalFacturasGastosCount,
          Subtotal_Facturado: '',
          IVA_Acreditable: '',
          Total_Facturado: trabajoMensual.totalFacturasGastosMonto,
          Monto_No_Deducible: '',
        },
        {
          Rubro_Contable: `Avance Conciliación Estado de Cuenta (${trabajoMensual.porcentajeAvanceEstadoCuenta}%)`,
          Tratamiento_Fiscal: 'Movs Conciliados + Reglas Especiales',
          Movimientos_Banco: trabajoMensual.movsFacturadosConciliadosCount + trabajoMensual.movsComprobadosReglaCount,
          Egreso_Banco_Total: trabajoMensual.movsFacturadosConciliadosMonto + trabajoMensual.movsComprobadosReglaMonto,
          Facturas_CFDI: trabajoMensual.facturasGastosConciliadasCount + trabajoMensual.facturasEfectivoDeduciblesCount,
          Subtotal_Facturado: '',
          IVA_Acreditable: '',
          Total_Facturado: trabajoMensual.facturasGastosConciliadasMonto + trabajoMensual.facturasEfectivoDeduciblesMonto,
          Monto_No_Deducible: trabajoMensual.movsNoDeduciblesMonto,
        },
        ...egresosAnalysis.rubrosSummary.map((r) => ({
          Rubro_Contable: r.label,
          Tratamiento_Fiscal: r.tratamientoFiscal,
          Movimientos_Banco: r.movsBancoCount,
          Egreso_Banco_Total: r.montoBancoTotal,
          Facturas_CFDI: r.facturasCount,
          Subtotal_Facturado: r.subtotalFacturado,
          IVA_Acreditable: r.ivaFacturado,
          Total_Facturado: r.totalFacturado,
          Monto_No_Deducible: r.montoNoDeducible,
        })),
      ];
      const wsConceptos = XLSX.utils.json_to_sheet(conceptosRows);
      wsConceptos['!cols'] = [
        { wch: 44 },
        { wch: 30 },
        { wch: 18 },
        { wch: 18 },
        { wch: 15 },
        { wch: 18 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, wsConceptos, 'Trabajo y Conceptos');

      // Hoja 6: Cédula Pre-DIOT Proveedores por RFC
      const diotRows = egresosAnalysis.diotProveedores.map((p) => ({
        RFC_Proveedor: p.rfc,
        Proveedor_Razon_Social: p.nombre,
        Cantidad_CFDI: p.facturasCount,
        CFDI_Conciliados: p.conciliadasCount,
        Subtotal_Base_Gravable: p.subtotal,
        IVA_Acreditable_16: p.ivaAcreditable,
        Total_Con_IVA: p.total,
        Pagado_Efectivo_01: p.pagadoEfectivo,
        Pagado_Banco_03_04_28: p.pagadoBanco,
      }));
      const wsDiot = XLSX.utils.json_to_sheet(diotRows);
      wsDiot['!cols'] = [
        { wch: 16 },
        { wch: 34 },
        { wch: 14 },
        { wch: 16 },
        { wch: 20 },
        { wch: 18 },
        { wch: 18 },
        { wch: 18 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, wsDiot, 'Pre_DIOT_Proveedores');

      XLSX.writeFile(wb, `Estimacion_Impuestos_${selectedMonth || 'Periodo'}.xlsx`);
    } catch (err: any) {
      alert('Error al exportar Excel fiscal: ' + (err?.message || String(err)));
    }
  };

  const isLoading = loadingPg || loadingGastos;

  return (
    <div className="space-y-6 font-sans">
      {/* BANNER SUPERIOR DE RESUMEN FISCAL E IMPUESTOS */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Calculator size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-black text-gray-900 dark:text-white">
                  Simulador y Pre-Cierre de Impuestos (IVA, ISR, Efectivo y No Deducibles)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Período {selectedMonth}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Conciliación Banco: {trabajoMensual.porcentajeAvanceEstadoCuenta}%
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Separa pagos a proveedor, nóminas, impuestos y comisiones; analiza efectivo retirado vs. efectivo facturado (01), Factura Global de ingresos, Pre-DIOT y genera tu Reporte Mensual en PDF.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={handleRefreshAll}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={handleGenerarReportePdf}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>Reporte Mensual (PDF)</span>
            </button>
            <button
              type="button"
              onClick={handleExportTaxExcel}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              <span>Exportar Excel (.XLSX)</span>
            </button>
          </div>
        </div>

        {/* BARRA DE PARÁMETROS FISCALES CONFIGURABLES */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-4 items-end">
          {/* Fuente de Ingresos */}
          <div className="md:col-span-4">
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              1. Base de Ingresos (Mismos datos Factura Global)
            </label>
            <select
              value={fuenteIngresos}
              onChange={(e) => setFuenteIngresos(e.target.value as FuenteIngresos)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="factura_global_mas_terceros">
                ✅ Factura Global Calculada + Facturas a Terceros ({formatCurrency(ingresosAnalysis.globalTotalConIva + ingresosAnalysis.totalTercerosConIva)})
              </option>
              <option value="depositos_banco">
                🏦 Depósitos Netos en Banco del Mes ({formatCurrency(ingresosAnalysis.totalDepositosNetos)})
              </option>
              <option value="solo_cfdi_emitidos">
                📄 Solo CFDI ya Timbrados en Sistema ({formatCurrency(ingresosAnalysis.totalTercerosConIva + ingresosAnalysis.totalPgEmitidasConIva)})
              </option>
            </select>
          </div>

          {/* Modalidad de ISR */}
          <div className="md:col-span-3">
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              2. Esquema de Cálculo ISR
            </label>
            <select
              value={modalidadIsr}
              onChange={(e) => {
                const nextMod = e.target.value as ModalidadIsr;
                setModalidadIsr(nextMod);
                if (nextMod === 'resico_ingresos' && tasaIsr > 5) setTasaIsr(2.5);
                if (nextMod !== 'resico_ingresos' && tasaIsr <= 5) setTasaIsr(30);
              }}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="utilidad_fiscal">Utilidad Fiscal (Ingresos − Deducciones)</option>
              <option value="coeficiente_utilidad">Coeficiente de Utilidad (Provisional PM)</option>
              <option value="resico_ingresos">Tasa Directa s/ Ingresos (RESICO)</option>
            </select>
          </div>

          {/* Tasa ISR % */}
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              Tasa ISR (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={tasaIsr}
                onChange={(e) => setTasaIsr(Math.max(0, Number(e.target.value)))}
                className="w-full pl-3 pr-7 py-2 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <Percent size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          {/* Coeficiente o Saldo a Favor IVA */}
          {modalidadIsr === 'coeficiente_utilidad' ? (
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Coeficiente de Utilidad (Ej. 0.1500)
              </label>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="1"
                value={coeficienteUtilidad}
                onChange={(e) => setCoeficienteUtilidad(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs font-mono font-black text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          ) : (
            <div className="md:col-span-3">
              <label className="block text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                Saldo a Favor IVA Anterior ($)
              </label>
              <input
                type="number"
                step="100"
                min="0"
                value={saldoFavorIvaAnterior || ''}
                placeholder="0.00"
                onChange={(e) => setSaldoFavorIvaAnterior(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}
        </div>

        {/* SWITCHES DE CRITERIO DE DEDUCIBILIDAD */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/80 flex flex-wrap items-center gap-5 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={aplicarTopeEfectivo2000}
              onChange={(e) => setAplicarTopeEfectivo2000(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="font-bold text-gray-700 dark:text-gray-300">
              Regla LISR Art. 27: Marcar como No Deducibles facturas en efectivo (`01`) mayores a $2,000 MXN
            </span>
            {egresosAnalysis.facturasEfectivoMayores2000.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300">
                {egresosAnalysis.facturasEfectivoMayores2000.length} detectada(s)
              </span>
            )}
          </label>

          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={incluirFacturasNoConciliadas}
              onChange={(e) => setIncluirFacturasNoConciliadas(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span className="font-bold text-gray-700 dark:text-gray-300">
              Incluir todas las facturas de gastos del mes (aunque aún no estén conciliadas en banco)
            </span>
          </label>
        </div>
      </div>

      {/* 5 TARJETAS KPI PRINCIPALES DEL DICTAMEN FISCAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* KPI 1: Ingresos Base (Factura Global + Terceros) */}
        <div
          onClick={() => setActiveDetailTab('ingresos_global')}
          className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.01] ${
            activeDetailTab === 'ingresos_global'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-[11px] font-black uppercase">
            <span>1. Ingresos (Sin IVA)</span>
            <TrendingUp size={16} />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-gray-900 dark:text-white">
            {formatCurrency(taxCalculation.ingresosSinIva)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex flex-col gap-0.5">
            <span>Con IVA: <strong>{formatCurrency(taxCalculation.ingresosConIva)}</strong></span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              IVA Cobrado: {formatCurrency(taxCalculation.ivaTrasladado)}
            </span>
          </div>
        </div>

        {/* KPI 2: Deducciones Autorizadas (Facturas Efectivo + Banco) */}
        <div
          onClick={() => setActiveDetailTab('otras_facturas')}
          className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.01] ${
            activeDetailTab === 'otras_facturas'
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-[11px] font-black uppercase">
            <span>2. Gastos Deducibles</span>
            <FileText size={16} />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-gray-900 dark:text-white">
            {formatCurrency(taxCalculation.deduccionesAutorizadas)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex flex-col gap-0.5">
            <span>Con IVA: <strong>{formatCurrency(egresosAnalysis.totalFacturasDeduciblesConIva)}</strong></span>
            <span className="text-blue-600 dark:text-blue-400 font-bold">
              IVA Acreditable: {formatCurrency(taxCalculation.ivaAcreditable)}
            </span>
          </div>
        </div>

        {/* KPI 3: Efectivo Retirado vs Facturado & No Deducibles */}
        <div
          onClick={() => setActiveDetailTab('efectivo_vs_facturado')}
          className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.01] ${
            activeDetailTab === 'efectivo_vs_facturado' || activeDetailTab === 'no_deducibles'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-[11px] font-black uppercase">
            <span>3. No Deducibles + Efectivo</span>
            <AlertTriangle size={16} />
          </div>
          <div className="mt-2 font-mono text-2xl font-black text-amber-600 dark:text-amber-400">
            {formatCurrency(taxCalculation.noDeducibles)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex flex-col gap-0.5">
            <span>
              Efec. sin Factura: <strong>{formatCurrency(egresosAnalysis.excedenteEfectivoRetiradoSinFactura)}</strong>
            </span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">
              Costo Fiscal Extra: {formatCurrency(taxCalculation.sobrecostoFiscalNoDeducibles)}
            </span>
          </div>
        </div>

        {/* KPI 4: Ganancias (Utilidad Operativa vs Fiscal) */}
        <div
          onClick={() => setActiveDetailTab('resumen_ejecutivo')}
          className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 shadow-sm cursor-pointer transition-all hover:scale-[1.01] ${
            activeDetailTab === 'resumen_ejecutivo'
              ? 'border-purple-500 ring-2 ring-purple-500/20'
              : 'border-gray-200 dark:border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-[11px] font-black uppercase">
            <span>4. Ganancia Operativa</span>
            <Scale size={16} />
          </div>
          <div className={`mt-2 font-mono text-2xl font-black ${
            taxCalculation.utilidadOperativaReal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {formatCurrency(taxCalculation.utilidadOperativaReal)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex flex-col gap-0.5">
            <span>Base Fiscal ISR: <strong>{formatCurrency(taxCalculation.baseGravableIsr)}</strong></span>
            <span className="text-purple-600 dark:text-purple-400 font-bold">
              Margen Real: {taxCalculation.margenOperativoPct}%
            </span>
          </div>
        </div>

        {/* KPI 5: Aproximado Total de Impuestos a Pagar (IVA + ISR) */}
        <div className="bg-gradient-to-br from-rose-600 via-rose-700 to-indigo-900 text-white rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-100 text-[11px] font-black uppercase">
            <span>5. Aprox. Impuestos a Pagar</span>
            <Calculator size={16} />
          </div>
          <div className="mt-2 font-mono text-2xl font-black tracking-tight">
            {formatCurrency(taxCalculation.totalImpuestosAPagar)}
          </div>
          <div className="mt-1.5 text-[11px] text-rose-100/90 flex flex-col gap-0.5 font-mono">
            <div className="flex justify-between">
              <span>IVA a Pagar:</span>
              <strong>{formatCurrency(taxCalculation.ivaAPagar)}</strong>
            </div>
            <div className="flex justify-between">
              <span>ISR ({tasaIsr}%):</span>
              <strong>{formatCurrency(taxCalculation.isrEstimado)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN DE ANÁLISIS FISCAL */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveDetailTab('resumen_ejecutivo')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeDetailTab === 'resumen_ejecutivo'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
          }`}
        >
          <Calculator size={15} />
          <span>1. Cédula de Impuestos y Ganancias</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailTab('trabajo_conceptos')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeDetailTab === 'trabajo_conceptos'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
          }`}
        >
          <Layers size={15} />
          <span>2. Trabajo del Mes y Conceptos (Proveedores, Nómina, Impuestos)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black">
            {trabajoMensual.porcentajeAvanceEstadoCuenta}%
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailTab('efectivo_vs_facturado')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeDetailTab === 'efectivo_vs_facturado'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
          }`}
        >
          <Banknote size={15} />
          <span>3. Efectivo Retirado vs. Efectivo Facturado (01)</span>
          {egresosAnalysis.excedenteEfectivoRetiradoSinFactura > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-gray-950 font-black">
              ⚠️ {formatCurrency(egresosAnalysis.excedenteEfectivoRetiradoSinFactura)} sin facturar
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailTab('otras_facturas')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeDetailTab === 'otras_facturas'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
          }`}
        >
          <CreditCard size={15} />
          <span>4. Otras Facturas (03/04/28) ({egresosAnalysis.facturasOtrosMetodos.length})</span>
          {egresosAnalysis.facturasBancariasSinConciliar?.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-gray-950 font-black">
              {egresosAnalysis.facturasBancariasSinConciliar.length} s/conciliar
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailTab('pre_diot')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeDetailTab === 'pre_diot'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
          }`}
        >
          <Building2 size={15} />
          <span>5. Pre-DIOT Proveedores ({egresosAnalysis.diotProveedores.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailTab('no_deducibles')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeDetailTab === 'no_deducibles'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
          }`}
        >
          <AlertTriangle size={15} />
          <span>6. No Deducibles</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailTab('ingresos_global')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeDetailTab === 'ingresos_global'
              ? 'bg-teal-600 text-white shadow-md'
              : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
          }`}
        >
          <Landmark size={15} />
          <span>7. Ingresos y Factura Global</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          VISTA 1: CÉDULA DE IMPUESTOS, GANANCIAS Y SEMÁFORO DE AUDITORÍA SAT
         ───────────────────────────────────────────────────────────────────────── */}
      {activeDetailTab === 'resumen_ejecutivo' && (
        <div className="space-y-6">
          {/* Semáforo de Discrepancia Fiscal (Banco vs. SAT) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {semaforoFiscal.map((item, idx) => {
              const badgeColor =
                item.nivel === 'verde'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : item.nivel === 'amarillo'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30';
              const cardBorder =
                item.nivel === 'verde'
                  ? 'border-emerald-500/30'
                  : item.nivel === 'amarillo'
                  ? 'border-amber-500/40'
                  : 'border-rose-500/40';
              return (
                <div
                  key={idx}
                  className={`bg-white dark:bg-gray-900 border ${cardBorder} rounded-2xl p-4 shadow-sm flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-black text-gray-900 dark:text-white">{item.titulo}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${badgeColor}`}>
                      {item.etiqueta}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{item.resumen}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna 1: Determinación de IVA (4 cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                  <Receipt size={16} className="text-emerald-500" /> A. Cálculo de IVA (16%)
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Flujo del Mes
                </span>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1.5">
                  <div className="flex justify-between font-sans font-bold text-gray-700 dark:text-gray-300">
                    <span>(+) IVA Factura Global:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(ingresosAnalysis.globalIva)}
                    </span>
                  </div>
                  <div className="flex justify-between font-sans font-bold text-gray-700 dark:text-gray-300">
                    <span>(+) IVA Facturas a Terceros:</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(ingresosAnalysis.ivaTerceros)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-1.5 font-sans font-black text-gray-900 dark:text-white">
                    <span>(=) Total IVA Trasladado (Cobrado):</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(taxCalculation.ivaTrasladado)}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1.5">
                  <div className="flex justify-between font-sans font-bold text-gray-700 dark:text-gray-300">
                    <span>(-) IVA Facturas Bancarias (03/04/28):</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      -{formatCurrency(egresosAnalysis.ivaOtrosFacturadoDeducible)}
                    </span>
                  </div>
                  <div className="flex justify-between font-sans font-bold text-gray-700 dark:text-gray-300">
                    <span>(-) IVA Facturas Efectivo Deducibles (01):</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      -{formatCurrency(egresosAnalysis.ivaEfectivoFacturadoDeducible)}
                    </span>
                  </div>
                  {saldoFavorIvaAnterior > 0 && (
                    <div className="flex justify-between font-sans font-bold text-gray-700 dark:text-gray-300">
                      <span>(-) Saldo a Favor IVA Anterior:</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400">
                        -{formatCurrency(saldoFavorIvaAnterior)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-1.5 font-sans font-black text-gray-900 dark:text-white">
                    <span>(=) Total IVA Acreditable:</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      -{formatCurrency(taxCalculation.ivaAcreditable + saldoFavorIvaAnterior)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`mt-4 p-4 rounded-xl border flex items-center justify-between ${
              taxCalculation.ivaAPagar > 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
            }`}>
              <div>
                <span className="text-xs font-black uppercase block">
                  {taxCalculation.ivaAPagar > 0 ? 'IVA Estimado a Pagar' : 'IVA Saldo a Favor'}
                </span>
                <span className="text-[10px] opacity-80">
                  {taxCalculation.ivaAPagar > 0 ? 'IVA Cobrado supera al IVA de Gastos' : 'IVA de Gastos cubre el IVA Cobrado'}
                </span>
              </div>
              <span className="text-xl font-black font-mono">
                {formatCurrency(taxCalculation.ivaAPagar > 0 ? taxCalculation.ivaAPagar : taxCalculation.ivaSaldoAFavorMes)}
              </span>
            </div>
          </div>

          {/* Columna 2: Determinación de ISR y Utilidad (4 cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                  <Scale size={16} className="text-indigo-500" /> B. Ganancias y Cálculo de ISR
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  Tasa {tasaIsr}%
                </span>
              </div>

              <div className="space-y-3 text-xs font-mono">
                {/* Comparación Utilidad Financiera vs Utilidad Fiscal */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1.5">
                  <div className="flex justify-between font-sans font-bold text-gray-700 dark:text-gray-300">
                    <span>(+) Ingresos Acumulables (Sin IVA):</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(taxCalculation.ingresosSinIva)}
                    </span>
                  </div>
                  <div className="flex justify-between font-sans font-bold text-gray-700 dark:text-gray-300">
                    <span>(-) Facturas Deducibles (Sin IVA):</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      -{formatCurrency(taxCalculation.deduccionesAutorizadas)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-1.5 font-sans font-black text-indigo-700 dark:text-indigo-300">
                    <span>(=) Utilidad Fiscal (Base ISR):</span>
                    <span className="font-mono">{formatCurrency(taxCalculation.utilidadFiscal)}</span>
                  </div>
                </div>

                {/* Efecto de los No Deducibles en la Ganancia Real */}
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                  <div className="flex justify-between font-sans font-bold text-amber-800 dark:text-amber-300">
                    <span>(-) Gastos No Deducibles y Retiros s/Factura:</span>
                    <span className="font-mono">-{formatCurrency(taxCalculation.noDeducibles)}</span>
                  </div>
                  <div className="flex justify-between border-t border-amber-500/20 pt-1.5 font-sans font-black text-gray-900 dark:text-white">
                    <span>(=) Ganancia Operativa Real:</span>
                    <span className={`font-mono ${taxCalculation.utilidadOperativaReal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(taxCalculation.utilidadOperativaReal)}
                    </span>
                  </div>
                  <p className="font-sans text-[10px] text-gray-500">
                    Los gastos no deducibles reducen tu dinero real en banco, pero el SAT no permite restarlos para el cálculo de ISR ni IVA.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-950 dark:text-indigo-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase block">ISR Estimado del Mes ({tasaIsr}%)</span>
                <span className="text-[10px] opacity-80">
                  Base aplicada: {formatCurrency(taxCalculation.baseGravableIsr)}
                </span>
              </div>
              <span className="text-xl font-black font-mono">
                {formatCurrency(taxCalculation.isrEstimado)}
              </span>
            </div>
          </div>

          {/* Columna 3: Resumen Efectivo Retirado vs Facturado + Resultado Neto (4 cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3 mb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                  <Banknote size={16} className="text-amber-500" /> C. Efectivo y Resultado Libre
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveDetailTab('efectivo_vs_facturado')}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Ver desglose →
                </button>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1.5">
                  <div className="flex justify-between font-sans font-bold text-gray-700 dark:text-gray-300">
                    <span>Efectivo Retirado del Banco:</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      {formatCurrency(egresosAnalysis.totalEfectivoRetiradoBanco)}
                    </span>
                  </div>
                  <div className="flex justify-between font-sans font-bold text-gray-700 dark:text-gray-300">
                    <span>Efectivo Facturado (`01` Deducible):</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(egresosAnalysis.totalEfectivoFacturadoDeducible)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-1.5 font-sans font-black">
                    <span>Efectivo Retirado sin Factura:</span>
                    <span className={`font-mono ${
                      egresosAnalysis.excedenteEfectivoRetiradoSinFactura > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'
                    }`}>
                      {formatCurrency(egresosAnalysis.excedenteEfectivoRetiradoSinFactura)}
                    </span>
                  </div>
                </div>

                {/* Alerta de Sobrecosto Fiscal por No Deducibles */}
                {taxCalculation.sobrecostoFiscalNoDeducibles > 0 && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-sans">
                    <div className="font-black text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <ShieldAlert size={14} /> Impacto de los No Deducibles:
                    </div>
                    <p className="text-[11px] text-rose-800/90 dark:text-rose-200/90 mt-1">
                      Tener <strong>{formatCurrency(taxCalculation.noDeducibles)}</strong> sin factura válida te genera un sobrecosto aproximado de{' '}
                      <strong className="underline">{formatCurrency(taxCalculation.sobrecostoFiscalNoDeducibles)}</strong> en impuestos adicionales ({formatCurrency(taxCalculation.ivaPerdidoNoDeducibles)} de IVA no acreditado + {formatCurrency(taxCalculation.isrExtraPorNoDeducibles)} de ISR).
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md">
              <div>
                <span className="text-xs font-black uppercase block">Ganancia Neta Libre (Post-Impuestos)</span>
                <span className="text-[10px] text-emerald-100">
                  Utilidad Real − Impuestos ({taxCalculation.tasaEfectivaSobreIngresos}% carga efectiva)
                </span>
              </div>
              <span className="text-xl font-black font-mono">
                {formatCurrency(taxCalculation.gananciaNetaDespuesImpuestos)}
              </span>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          VISTA 2: TRABAJO CONTABLE DEL MES Y SEPARACIÓN POR CONCEPTOS (7 RUBROS)
         ───────────────────────────────────────────────────────────────────────── */}
      {activeDetailTab === 'trabajo_conceptos' && (
        <div className="space-y-6">
          {/* Bloque A: Productividad y Trabajo Realizado en el Mes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tarjeta 1: Avance de Movimientos del Estado de Cuenta */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                    <Landmark size={16} className="text-indigo-500" /> A. Movimientos del Estado de Cuenta ({trabajoMensual.totalMovsEstadoCuenta})
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Cuántos movimientos bancarios del mes están facturados, comprobados o pendientes.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {trabajoMensual.porcentajeAvanceEstadoCuenta}% Conciliado
                </span>
              </div>

              <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, trabajoMensual.porcentajeAvanceEstadoCuenta))}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">
                    Depósitos ({trabajoMensual.totalDepositosCount} abonos)
                  </span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatCurrency(trabajoMensual.totalDepositosMonto)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">
                    Retiros / Egresos ({trabajoMensual.totalRetirosCount} cargos)
                  </span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                    {formatCurrency(trabajoMensual.totalRetirosMonto)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <span className="font-sans font-bold text-gray-700 dark:text-gray-300">
                    ✅ Movimientos Facturados / Conciliados ({trabajoMensual.movsFacturadosConciliadosCount}):
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(trabajoMensual.movsFacturadosConciliadosMonto)}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                  <span className="font-sans font-bold text-gray-700 dark:text-gray-300">
                    🏛️ Comisiones, Nómina, Impuestos y Traspasos ({trabajoMensual.movsComprobadosReglaCount}):
                  </span>
                  <span className="font-black text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(trabajoMensual.movsComprobadosReglaMonto)}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <span className="font-sans font-bold text-gray-700 dark:text-gray-300">
                    ⚠️ Cargos Bancarios Sin Factura / No Deducibles ({trabajoMensual.movsNoDeduciblesCount}):
                  </span>
                  <span className="font-black text-amber-600 dark:text-amber-400">
                    {formatCurrency(trabajoMensual.movsNoDeduciblesMonto)}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
                  <span className="font-sans font-bold text-gray-700 dark:text-gray-300">
                    ⏳ Movimientos Pendientes por Conciliar ({trabajoMensual.movsPendientesCount}):
                  </span>
                  <span className="font-black text-rose-600 dark:text-rose-400">
                    {formatCurrency(trabajoMensual.movsPendientesMonto)}
                  </span>
                </div>
              </div>
            </div>

            {/* Tarjeta 2: Facturas Conciliadas y Efectivo Deducido */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                    <FileCheck2 size={16} className="text-emerald-500" /> B. Facturas Conciliadas y Efectivo Deducido
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Resumen de CFDIs recibidos, conciliados con banco y efectivo legalmente deducido.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerarReportePdf}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer size={13} />
                  <span>Imprimir PDF del Mes</span>
                </button>
              </div>

              <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, trabajoMensual.porcentajeFacturasConciliadas))}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">
                    Total Facturas Gastos ({trabajoMensual.totalFacturasGastosCount} CFDI)
                  </span>
                  <span className="font-mono font-black text-gray-900 dark:text-white text-sm">
                    {formatCurrency(trabajoMensual.totalFacturasGastosMonto)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                  <span className="text-[10px] font-bold uppercase text-gray-500 block">
                    Efectivo Deducido `01` ({trabajoMensual.facturasEfectivoDeduciblesCount} CFDI)
                  </span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatCurrency(trabajoMensual.facturasEfectivoDeduciblesMonto)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between p-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <span className="font-sans font-bold text-gray-700 dark:text-gray-300">
                    🔗 Facturas Conciliadas con Banco ({trabajoMensual.facturasGastosConciliadasCount}):
                  </span>
                  <span className="font-black text-blue-600 dark:text-blue-400">
                    {formatCurrency(trabajoMensual.facturasGastosConciliadasMonto)}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <span className="font-sans font-bold text-gray-700 dark:text-gray-300">
                    📁 Facturas con XML Fiscal Validado:
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {trabajoMensual.facturasConXmlCount} de {trabajoMensual.totalFacturasGastosCount} CFDI
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <span className="font-sans font-bold text-gray-700 dark:text-gray-300">
                    🚨 Facturas Bancarias (03/04/28) Sin Conciliar ({trabajoMensual.facturasBancariasSinConciliarCount}):
                  </span>
                  <span className="font-black text-amber-600 dark:text-amber-400">
                    {formatCurrency(trabajoMensual.facturasBancariasSinConciliarMonto)}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded-lg bg-teal-500/5 border border-teal-500/20">
                  <span className="font-sans font-bold text-gray-700 dark:text-gray-300">
                    🧾 Ingresos Facturados (Global + {ingresosAnalysis.countTerceros} Clientes):
                  </span>
                  <span className="font-black text-teal-600 dark:text-teal-400">
                    {formatCurrency(trabajoMensual.totalFacturasEmitidasMonto)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bloque B: Tabla de Separación por los 7 Conceptos Contables */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                  <Briefcase size={15} className="text-purple-500" /> Cédula Desglosada por Conceptos (Pagos a Proveedor, Nóminas, Impuestos, Comisiones y Efectivo)
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Haz clic en cualquier rubro para filtrar y auditar los movimientos bancarios y facturas que lo integran.
                </p>
              </div>
              {filtroRubroDetalle !== 'TODOS' && (
                <button
                  type="button"
                  onClick={() => setFiltroRubroDetalle('TODOS')}
                  className="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-800 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Mostrar Todos los Rubros
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="p-3.5">Concepto / Rubro Contable</th>
                    <th className="p-3.5">Tratamiento Fiscal</th>
                    <th className="p-3.5 text-center">Movs. Banco</th>
                    <th className="p-3.5 text-right">Egreso en Banco ($)</th>
                    <th className="p-3.5 text-center">Facturas CFDI</th>
                    <th className="p-3.5 text-right">Subtotal Facturado</th>
                    <th className="p-3.5 text-right">IVA Acreditable</th>
                    <th className="p-3.5 text-right">Total Facturado</th>
                    <th className="p-3.5 text-right">No Deducible / S-CFDI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {egresosAnalysis.rubrosSummary.map((r) => {
                    const isSelected = filtroRubroDetalle === r.key;
                    return (
                      <tr
                        key={r.key}
                        onClick={() => setFiltroRubroDetalle(isSelected ? 'TODOS' : r.key)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-purple-500/10 dark:bg-purple-500/20'
                            : r.esNeutroFiscal
                            ? 'bg-gray-50/70 dark:bg-gray-900/50 text-gray-500 hover:bg-gray-100/70'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                        }`}
                      >
                        <td className="p-3.5">
                          <span className="font-black text-gray-900 dark:text-white block">{r.label}</span>
                          <span className="text-[10px] text-gray-500">{r.descripcion}</span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.esNeutroFiscal
                                ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {r.tratamientoFiscal}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold">{r.movsBancoCount}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {formatCurrency(r.montoBancoTotal)}
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold">{r.facturasCount}</td>
                        <td className="p-3.5 text-right font-mono">{formatCurrency(r.subtotalFacturado)}</td>
                        <td className="p-3.5 text-right font-mono text-blue-600 dark:text-blue-400">
                          {formatCurrency(r.ivaFacturado)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(r.totalFacturado)}
                        </td>
                        <td
                          className={`p-3.5 text-right font-mono ${
                            r.montoNoDeducible > 0
                              ? 'font-black text-amber-600 dark:text-amber-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {formatCurrency(r.montoNoDeducible)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bloque C: Detalle Filtrado por Concepto (Movimientos Bancarios vs Facturas del Rubro) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Movimientos Bancarios del Rubro Seleccionado */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Cargos en Estado de Cuenta — Concepto: {filtroRubroDetalle}
                </h4>
                <span className="text-[11px] font-mono font-bold text-gray-500">
                  {
                    (egresosAnalysis.todosRetirosEnriched || []).filter(
                      (m: any) => filtroRubroDetalle === 'TODOS' || m._rubro === filtroRubroDetalle
                    ).length
                  }{' '}
                  movimiento(s)
                </span>
              </div>
              <div className="overflow-x-auto max-h-[380px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500">
                    <tr>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Rubro</th>
                      <th className="p-3">Concepto Bancario</th>
                      <th className="p-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(egresosAnalysis.todosRetirosEnriched || [])
                      .filter((m: any) => filtroRubroDetalle === 'TODOS' || m._rubro === filtroRubroDetalle)
                      .map((m: any) => (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="p-3 font-mono whitespace-nowrap">{formatDate(m.fecha)}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300">
                              {m._rubro}
                            </span>
                          </td>
                          <td className="p-3 max-w-[240px] truncate" title={m.concepto}>
                            <span className="font-bold text-gray-900 dark:text-white block truncate">{m.concepto}</span>
                            <span className="text-[10px] text-gray-400">{m.cuentas_bancarias?.nombre || 'Banco'}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold">{formatCurrency(m._montoAbs)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Facturas CFDI del Rubro Seleccionado */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Facturas CFDI Registradas — Concepto: {filtroRubroDetalle}
                </h4>
                <span className="text-[11px] font-mono font-bold text-gray-500">
                  {
                    (egresosAnalysis.gastosMesEnriched || []).filter(
                      (g: any) => filtroRubroDetalle === 'TODOS' || g._rubro === filtroRubroDetalle
                    ).length
                  }{' '}
                  factura(s)
                </span>
              </div>
              <div className="overflow-x-auto max-h-[380px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500">
                    <tr>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Rubro / Pago</th>
                      <th className="p-3">Proveedor / Concepto</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(egresosAnalysis.gastosMesEnriched || [])
                      .filter((g: any) => filtroRubroDetalle === 'TODOS' || g._rubro === filtroRubroDetalle)
                      .map((g: any) => (
                        <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="p-3 font-mono whitespace-nowrap">{formatDate(g.fecha_gasto || g.fecha_timbrado)}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                              {g._rubro} · {g._codigoPago}
                            </span>
                          </td>
                          <td className="p-3 max-w-[240px] truncate" title={g.concepto}>
                            <span className="font-bold text-gray-900 dark:text-white block truncate">
                              {g.proveedores?.nombre_comercial || 'Proveedor'}
                            </span>
                            <span className="text-[10px] text-gray-400 block truncate">{g.concepto}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(g._total)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          VISTA 2: ANÁLISIS EFECTIVO RETIRADO DEL BANCO VS. EFECTIVO FACTURADO (01)
         ───────────────────────────────────────────────────────────────────────── */}
      {activeDetailTab === 'efectivo_vs_facturado' && (
        <div className="space-y-6">
          {/* Tarjetas de Comparativa de Efectivo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 block">
                1. Efectivo Retirado del Banco
              </span>
              <div className="text-2xl font-black font-mono mt-1 text-gray-900 dark:text-white">
                {formatCurrency(egresosAnalysis.totalEfectivoRetiradoBanco)}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                {egresosAnalysis.retirosEfectivoBanco.length} retiro(s) en cajero / ventanilla / practicaja
              </span>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">
                2. Efectivo Facturado Deducible (01)
              </span>
              <div className="text-2xl font-black font-mono mt-1 text-emerald-600 dark:text-emerald-400">
                {formatCurrency(egresosAnalysis.totalEfectivoFacturadoDeducible)}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                Base: {formatCurrency(egresosAnalysis.subtotalEfectivoFacturadoDeducible)} · IVA: {formatCurrency(egresosAnalysis.ivaEfectivoFacturadoDeducible)}
              </span>
            </div>

            <div className={`border rounded-2xl p-4 shadow-sm ${
              egresosAnalysis.excedenteEfectivoRetiradoSinFactura > 0
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
            }`}>
              <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300 block">
                3. Retirado SIN Factura (No Deducible)
              </span>
              <div className="text-2xl font-black font-mono mt-1 text-amber-600 dark:text-amber-400">
                {formatCurrency(egresosAnalysis.excedenteEfectivoRetiradoSinFactura)}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                {egresosAnalysis.excedenteEfectivoRetiradoSinFactura > 0
                  ? 'Retiros de efectivo que no tienen CFDI (01)'
                  : 'Todo el efectivo retirado está cubierto con facturas'}
              </span>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 block">
                4. Pagado con Caja Chica / Ventas Efec.
              </span>
              <div className="text-2xl font-black font-mono mt-1 text-purple-600 dark:text-purple-400">
                {formatCurrency(egresosAnalysis.efectivoPagadoConCajaVentas)}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                Efectivo facturado adicional a los retiros de banco (Venta Efec. POS: {formatCurrency(totalEfectivoParrot)})
              </span>
            </div>
          </div>

          {/* Tablas Lado a Lado: Retiros de Efectivo en Banco vs Facturas Pagadas en Efectivo (01) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Tabla A: Retiros de Efectivo en Estado de Cuenta */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                    <Landmark size={15} className="text-rose-500" /> Retiros de Efectivo del Banco ({egresosAnalysis.retirosEfectivoBanco.length})
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Disposiciones en cajero, ventanilla o practicaja detectadas en el estado de cuenta.
                  </p>
                </div>
                <span className="font-mono text-sm font-black text-rose-600 dark:text-rose-400">
                  {formatCurrency(egresosAnalysis.totalEfectivoRetiradoBanco)}
                </span>
              </div>

              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500">
                    <tr>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Cuenta / Concepto</th>
                      <th className="p-3 text-right">Retiro ($)</th>
                      <th className="p-3 text-center">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {egresosAnalysis.retirosEfectivoBanco.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                          No se registraron retiros de efectivo en cajero/ventanilla en este período.
                        </td>
                      </tr>
                    ) : (
                      egresosAnalysis.retirosEfectivoBanco.map((m: any) => (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="p-3 font-mono whitespace-nowrap">{formatDate(m.fecha)}</td>
                          <td className="p-3">
                            <span className="font-bold text-gray-900 dark:text-white block">{m.concepto}</span>
                            <span className="text-[10px] text-gray-400">{m.cuentas_bancarias?.nombre || 'Banco'} · Ref: {m.referencia || '—'}</span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                            {formatCurrency(m._montoAbs)}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              m._tieneComprobante
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}>
                              {m._tieneComprobante ? 'Con Factura' : 'Bolsa Efectivo'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tabla B: Facturas de Gastos Pagadas en Efectivo (01) */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                    <Receipt size={15} className="text-emerald-500" /> Facturas Pagadas en Efectivo `01` ({egresosAnalysis.facturasEfectivo.length})
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    CFDI recibidos con forma de pago 01 - Efectivo (alerta automática si supera $2,000 MXN).
                  </p>
                </div>
                <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(egresosAnalysis.totalEfectivoFacturadoBruto)}
                </span>
              </div>

              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500">
                    <tr>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Proveedor / Concepto</th>
                      <th className="p-3 text-right">Subtotal</th>
                      <th className="p-3 text-right">IVA</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-center">Dictamen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {egresosAnalysis.facturasEfectivo.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-400 italic">
                          No hay facturas con forma de pago 01 (Efectivo) en este período.
                        </td>
                      </tr>
                    ) : (
                      egresosAnalysis.facturasEfectivo.map((g: any) => (
                        <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="p-3 font-mono whitespace-nowrap">{formatDate(g.fecha_gasto || g.fecha_timbrado)}</td>
                          <td className="p-3 max-w-[200px]">
                            <span className="font-bold text-gray-900 dark:text-white block truncate" title={g.proveedores?.nombre_comercial}>
                              {g.proveedores?.nombre_comercial || 'Proveedor'}
                            </span>
                            <span className="text-[10px] text-gray-400 block truncate" title={g.concepto}>
                              {g.concepto}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono">{formatCurrency(g._subtotal)}</td>
                          <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(g._iva)}</td>
                          <td className="p-3 text-right font-mono font-bold">{formatCurrency(g._total)}</td>
                          <td className="p-3 text-center">
                            {g._supera2000 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                ⚠️ &gt; $2,000
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                Deducible
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
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          VISTA 4: OTRAS FACTURAS (NO EFECTIVO: TRANSFERENCIA 03, TARJETAS 04/28, ETC.)
         ───────────────────────────────────────────────────────────────────────── */}
      {activeDetailTab === 'otras_facturas' && (
        <div className="space-y-6">
          {/* Alerta de Facturas Bancarias (03/04/28) sin Conciliar en Banco */}
          {egresosAnalysis.facturasBancariasSinConciliar?.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-900 dark:text-amber-200">
                    Alerta Preventiva SAT: {egresosAnalysis.facturasBancariasSinConciliar.length} Factura(s) Bancarias (`03/04/28`) Pendientes de Conciliar en Estado de Cuenta
                  </h4>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                    Estas facturas indican pago por transferencia o tarjeta por un total de{' '}
                    <strong>{formatCurrency(egresosAnalysis.totalFacturasBancariasSinConciliar)}</strong>, pero aún no están ligadas a un cargo bancario. Para blindar la deducción de IVA e ISR ante el SAT, concílialas con el estado de cuenta.
                  </p>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-black text-amber-900 dark:text-amber-200 bg-white/70 dark:bg-gray-900/70 px-3 py-2 rounded-xl border border-amber-500/30 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={!incluirFacturasNoConciliadas}
                  onChange={(e) => setIncluirFacturasNoConciliadas(!e.target.checked)}
                  className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span>Solo deducir las ya conciliadas en banco</span>
              </label>
            </div>
          )}

          {/* Resumen por método de pago */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 block">
                03 · Transferencias Electrónicas
              </span>
              <div className="text-xl font-black font-mono mt-1">
                {formatCurrency(egresosAnalysis.desglosePorFormaPago.transferencia03.reduce((s, f) => s + f._total, 0))}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                {egresosAnalysis.desglosePorFormaPago.transferencia03.length} facturas · IVA:{' '}
                {formatCurrency(egresosAnalysis.desglosePorFormaPago.transferencia03.reduce((s, f) => s + f._iva, 0))}
              </span>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 block">
                04 / 28 · Tarjetas Crédito y Débito
              </span>
              <div className="text-xl font-black font-mono mt-1">
                {formatCurrency(egresosAnalysis.desglosePorFormaPago.tarjetas04_28.reduce((s, f) => s + f._total, 0))}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                {egresosAnalysis.desglosePorFormaPago.tarjetas04_28.length} facturas · IVA:{' '}
                {formatCurrency(egresosAnalysis.desglosePorFormaPago.tarjetas04_28.reduce((s, f) => s + f._iva, 0))}
              </span>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block">
                02 · Cheques Nominativos
              </span>
              <div className="text-xl font-black font-mono mt-1">
                {formatCurrency(egresosAnalysis.desglosePorFormaPago.cheque02.reduce((s, f) => s + f._total, 0))}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                {egresosAnalysis.desglosePorFormaPago.cheque02.length} facturas · IVA:{' '}
                {formatCurrency(egresosAnalysis.desglosePorFormaPago.cheque02.reduce((s, f) => s + f._iva, 0))}
              </span>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 block">
                99 / Otros · Por Definir / PPD
              </span>
              <div className="text-xl font-black font-mono mt-1">
                {formatCurrency(egresosAnalysis.desglosePorFormaPago.porDefinir99_otros.reduce((s, f) => s + f._total, 0))}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                {egresosAnalysis.desglosePorFormaPago.porDefinir99_otros.length} facturas · IVA:{' '}
                {formatCurrency(egresosAnalysis.desglosePorFormaPago.porDefinir99_otros.reduce((s, f) => s + f._iva, 0))}
              </span>
            </div>
          </div>

          {/* Tabla de Facturas No Efectivo */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                  Facturas Deducibles Pagadas por Banco (Transferencia, Tarjeta, Cheque, etc.)
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Subtotal Deducible: <strong>{formatCurrency(egresosAnalysis.subtotalOtrosFacturadoDeducible)}</strong> · IVA Acreditable: <strong>{formatCurrency(egresosAnalysis.ivaOtrosFacturadoDeducible)}</strong> · Total: <strong>{formatCurrency(egresosAnalysis.totalOtrosFacturadoDeducible)}</strong>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[460px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Forma Pago</th>
                    <th className="p-3">Proveedor / RFC</th>
                    <th className="p-3">Concepto</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-right">IVA Acreditable</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center">Conciliación Banco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {egresosAnalysis.facturasOtrosMetodos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-400 italic">
                        No hay facturas de transferencia/tarjeta registradas en este período.
                      </td>
                    </tr>
                  ) : (
                    egresosAnalysis.facturasOtrosMetodos.map((g: any) => (
                      <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="p-3 font-mono whitespace-nowrap">{formatDate(g.fecha_gasto || g.fecha_timbrado)}</td>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{g._codigoPago}</td>
                        <td className="p-3 max-w-[200px]">
                          <span className="font-bold text-gray-900 dark:text-white block truncate">
                            {g.proveedores?.nombre_comercial || 'Proveedor'}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">{g.proveedores?.rfc || '—'}</span>
                        </td>
                        <td className="p-3 max-w-[240px] truncate" title={g.concepto}>{g.concepto}</td>
                        <td className="p-3 text-right font-mono">{formatCurrency(g._subtotal)}</td>
                        <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(g._iva)}</td>
                        <td className="p-3 text-right font-mono font-bold">{formatCurrency(g._total)}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            g._esConciliado
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          }`}>
                            {g._esConciliado ? 'Conciliada' : 'Sin Conciliar'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          VISTA 5: CÉDULA PRE-DIOT PROVEEDORES (AGRUPADO POR RFC)
         ───────────────────────────────────────────────────────────────────────── */}
      {activeDetailTab === 'pre_diot' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                  <Building2 size={15} className="text-cyan-500" /> Relación Mensual de Operaciones con Terceros (Pre-DIOT por RFC de Proveedor)
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Agrupa todas las compras y gastos deducibles del mes por RFC para la declaración informativa DIOT ante el SAT.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="px-3 py-1 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold">
                  Base Total: {formatCurrency(egresosAnalysis.diotProveedores.reduce((s, p) => s + p.subtotal, 0))}
                </span>
                <span className="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-black">
                  IVA Acreditable: {formatCurrency(egresosAnalysis.diotProveedores.reduce((s, p) => s + p.ivaAcreditable, 0))}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="p-3.5">RFC Proveedor</th>
                    <th className="p-3.5">Razón Social / Nombre Comercial</th>
                    <th className="p-3.5 text-center">CFDI</th>
                    <th className="p-3.5 text-center">Conciliadas</th>
                    <th className="p-3.5 text-right">Base Gravable (Subtotal)</th>
                    <th className="p-3.5 text-right">IVA Acreditable (16%)</th>
                    <th className="p-3.5 text-right">Total con IVA</th>
                    <th className="p-3.5 text-right">Pagado Efectivo (01)</th>
                    <th className="p-3.5 text-right">Pagado Banco</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {egresosAnalysis.diotProveedores.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                        No hay operaciones con proveedores registradas en este período.
                      </td>
                    </tr>
                  ) : (
                    egresosAnalysis.diotProveedores.map((p) => (
                      <tr key={p.rfc} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="p-3.5 font-mono font-black text-cyan-700 dark:text-cyan-400">{p.rfc}</td>
                        <td className="p-3.5 font-bold text-gray-900 dark:text-white">{p.nombre}</td>
                        <td className="p-3.5 text-center font-mono">{p.facturasCount}</td>
                        <td className="p-3.5 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.conciliadasCount === p.facturasCount
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {p.conciliadasCount}/{p.facturasCount}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono">{formatCurrency(p.subtotal)}</td>
                        <td className="p-3.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(p.ivaAcreditable)}
                        </td>
                        <td className="p-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(p.total)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-gray-600 dark:text-gray-400">
                          {formatCurrency(p.pagadoEfectivo)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-gray-600 dark:text-gray-400">
                          {formatCurrency(p.pagadoBanco)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          VISTA 6: NO DEDUCIBLES Y EGRESOS BANCARIOS SIN FACTURA
         ───────────────────────────────────────────────────────────────────────── */}
      {activeDetailTab === 'no_deducibles' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-amber-600 block">
                1. Efectivo Retirado sin Factura
              </span>
              <div className="text-xl font-black font-mono mt-1 text-amber-600">
                {formatCurrency(egresosAnalysis.excedenteEfectivoRetiradoSinFactura)}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                Excedente de retiros en efectivo vs CFDI (01)
              </span>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-rose-600 block">
                2. Cargos Bancarios sin Factura
              </span>
              <div className="text-xl font-black font-mono mt-1 text-rose-600">
                {formatCurrency(egresosAnalysis.totalRetirosBancariosSinFactura)}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                {egresosAnalysis.retirosBancariosSinFacturaList.length} retiro(s) en estado de cuenta sin XML
              </span>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-purple-600 block">
                3. Efectivo &gt; $2,000 + Gastos No Ded.
              </span>
              <div className="text-xl font-black font-mono mt-1 text-purple-600">
                {formatCurrency(egresosAnalysis.totalEfectivoNoDeducibleTope2000 + egresosAnalysis.totalFacturasMarcadasNoDeducibles)}
              </div>
              <span className="text-[11px] text-gray-500 block mt-1">
                Facturas que no cumplen requisitos fiscales
              </span>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 shadow-sm">
              <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-300 block">
                4. Total No Deducibles del Mes
              </span>
              <div className="text-xl font-black font-mono mt-1 text-rose-600 dark:text-rose-400">
                {formatCurrency(egresosAnalysis.totalNoDeduciblesGeneral)}
              </div>
              <span className="text-[11px] text-rose-700/80 dark:text-rose-300/80 block mt-1">
                Sobrecosto en impuestos: {formatCurrency(taxCalculation.sobrecostoFiscalNoDeducibles)}
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
                Detalle de Movimientos Bancarios y Gastos No Deducibles ({egresosAnalysis.retirosBancariosSinFacturaList.length})
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Egresos del estado de cuenta que no cuentan con factura XML vinculada o están clasificados como No Deducibles.
              </p>
            </div>

            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-[10px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Cuenta</th>
                    <th className="p-3">Concepto / Referencia</th>
                    <th className="p-3 text-right">Monto No Deducible</th>
                    <th className="p-3 text-center">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {egresosAnalysis.retirosBancariosSinFacturaList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                        ¡Excelente! Todos los retiros bancarios (no efectivo) están conciliados con factura.
                      </td>
                    </tr>
                  ) : (
                    egresosAnalysis.retirosBancariosSinFacturaList.map((m: any) => (
                      <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="p-3 font-mono whitespace-nowrap">{formatDate(m.fecha)}</td>
                        <td className="p-3 font-bold">{m.cuentas_bancarias?.nombre || 'Banco'}</td>
                        <td className="p-3">
                          <span className="font-bold text-gray-900 dark:text-white block">{m.concepto}</span>
                          <span className="text-[10px] text-gray-400 font-mono">Ref: {m.referencia || '—'}</span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(m._estatusClave === 'no_deducible' ? m._montoAbs : m._montoSinConciliar)}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300">
                            {m._estatusClave === 'no_deducible' ? 'Marcado No Deducible' : 'Sin Factura XML'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────
          VISTA 5: INGRESOS, DEPÓSITOS Y DATOS DE FACTURA GLOBAL
         ───────────────────────────────────────────────────────────────────────── */}
      {activeDetailTab === 'ingresos_global' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Izquierda: Integración de Factura Global */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                <FileText size={15} className="text-teal-500" /> Integración de Factura Global (Mismos datos de Cierre)
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Conecta automáticamente los cortes POS, tarjetas BBVA, depósitos bancarios y facturas individuales a terceros.
              </p>
            </div>

            {!isSeimenjo ? (
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950">
                  <span className="font-sans text-gray-600 dark:text-gray-300">(+) Efectivo Parrot POS:</span>
                  <span className="font-bold">{formatCurrency(totalEfectivoParrot)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950">
                  <span className="font-sans text-gray-600 dark:text-gray-300">(+) ParrotPay:</span>
                  <span className="font-bold">{formatCurrency(totalParrotPayParrot)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950">
                  <span className="font-sans text-gray-600 dark:text-gray-300">(+) Tarjetas BBVA Oficiales:</span>
                  <span className="font-bold">{formatCurrency(comparativoTarjetas?.totalTarjetasBbva || 0)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-purple-500/5 text-purple-700 dark:text-purple-300">
                  <span className="font-sans">(-) Deducción Facturas a Terceros:</span>
                  <span className="font-bold">-{formatCurrency(totalTercerosDeducibles)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-500">
                  <span className="font-sans">(-) Propinas Excluidas:</span>
                  <span className="font-bold">-{formatCurrency(totalPropinasExcluidas)}</span>
                </div>
                <div className="flex justify-between p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 font-black text-teal-900 dark:text-teal-200">
                  <span className="font-sans">(=) Total Factura Global (Con IVA):</span>
                  <span>{formatCurrency(ingresosAnalysis.globalTotalConIva)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950">
                  <span className="font-sans text-gray-600 dark:text-gray-300">(+) Total Depósitos Bancarios del Mes:</span>
                  <span className="font-bold">{formatCurrency(ingresosAnalysis.totalDepositosNetos)}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-purple-500/5 text-purple-700 dark:text-purple-300">
                  <span className="font-sans">(-) Facturas Individuales a Clientes (Terceros):</span>
                  <span className="font-bold">-{formatCurrency(ingresosAnalysis.totalTercerosConIva)}</span>
                </div>
                <div className="flex justify-between p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/30 font-black text-teal-900 dark:text-teal-200">
                  <span className="font-sans">(=) Base para Factura Global (Con IVA):</span>
                  <span>{formatCurrency(ingresosAnalysis.globalTotalConIva)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Derecha: Consolidado Total de Ingresos Acumulables e IVA Trasladado */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
                <Landmark size={15} className="text-emerald-500" /> Resumen de Ingresos Acumulables del Periodo
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Suma de Factura Global al Público en General + Facturas Individuales a Clientes/Terceros.
              </p>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1.5">
                <div className="font-sans font-black text-gray-800 dark:text-gray-200">
                  1. Factura Global (Público en General)
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span className="font-sans">Subtotal Base Global:</span>
                  <span>{formatCurrency(ingresosAnalysis.globalSubtotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="font-sans">IVA 16% Global:</span>
                  <span>{formatCurrency(ingresosAnalysis.globalIva)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-gray-200 dark:border-gray-800 pt-1">
                  <span className="font-sans">Total con IVA:</span>
                  <span>{formatCurrency(ingresosAnalysis.globalTotalConIva)}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1.5">
                <div className="font-sans font-black text-gray-800 dark:text-gray-200">
                  2. Facturas Emitidas a Terceros ({ingresosAnalysis.countTerceros} CFDI)
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span className="font-sans">Subtotal Base Terceros:</span>
                  <span>{formatCurrency(ingresosAnalysis.subtotalTerceros)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span className="font-sans">IVA 16% Terceros:</span>
                  <span>{formatCurrency(ingresosAnalysis.ivaTerceros)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-gray-200 dark:border-gray-800 pt-1">
                  <span className="font-sans">Total con IVA:</span>
                  <span>{formatCurrency(ingresosAnalysis.totalTercerosConIva)}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                <div className="flex justify-between font-sans font-black text-emerald-950 dark:text-emerald-200">
                  <span>TOTAL INGRESOS BASE ISR (SIN IVA):</span>
                  <span className="font-mono text-base">{formatCurrency(taxCalculation.ingresosSinIva)}</span>
                </div>
                <div className="flex justify-between font-sans font-bold text-emerald-800 dark:text-emerald-300 text-[11px]">
                  <span>TOTAL IVA TRASLADADO DEL PERIODO:</span>
                  <span className="font-mono">{formatCurrency(taxCalculation.ivaTrasladado)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

