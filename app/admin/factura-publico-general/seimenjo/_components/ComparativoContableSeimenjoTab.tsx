'use client';

import React, { useMemo, useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Info,
  Search,
  Printer,
  Building2,
  Receipt,
  Landmark,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react';

interface ComparativoContableSeimenjoTabProps {
  pedidosMes: any[];
  todasLasFacturasMes: any[];
  movimientosDeposito: any[];
  depositosMes: any[];
  selectedMonth: string;
  formatCurrency: (amount: number | string | null | undefined) => string;
}

export function ComparativoContableSeimenjoTab({
  pedidosMes,
  todasLasFacturasMes,
  movimientosDeposito,
  depositosMes,
  selectedMonth,
  formatCurrency,
}: ComparativoContableSeimenjoTabProps) {
  const [filtroEstatus, setFiltroEstatus] = useState<'todos' | 'cuadrados' | 'sin_factura' | 'sin_deposito'>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Obtener depósitos bancarios del período
  const depositos = useMemo(() => {
    // Si depositosMes tiene datos los usamos, de lo contrario filtramos movimientosDeposito por selectedMonth
    const base = depositosMes && depositosMes.length > 0 ? depositosMes : movimientosDeposito;
    return (base || []).filter((m: any) => {
      const fecha = String(m.fecha || '');
      if (selectedMonth && !fecha.startsWith(selectedMonth)) return false;
      const tipo = String(m.tipo_movimiento || '').toLowerCase();
      const dep = Number(m.deposito || m.monto || 0);
      return tipo === 'deposito' || dep > 0;
    }).sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)));
  }, [depositosMes, movimientosDeposito, selectedMonth]);

  // 2. Construir el mapeo tripartita: Movimiento Bancario <-> Pedido <-> Factura
  const filasComparativo = useMemo(() => {
    const pedidosMap = new Map<string, any>();
    (pedidosMes || []).forEach((p: any) => {
      pedidosMap.set(p.id, p);
    });

    const facturasPorPedidoMap = new Map<string, any>();
    (todasLasFacturasMes || []).forEach((f: any) => {
      if (f.pedido_id) {
        facturasPorPedidoMap.set(f.pedido_id, f);
      }
    });

    const pedidosYaAsignados = new Set<string>();
    const filas: any[] = [];

    // Paso A: Iterar cada depósito bancario del estado de cuenta
    depositos.forEach((m: any, idx: number) => {
      const depMonto = Math.abs(Number(m.deposito || m.monto || 0));

      // Buscar pedidos vinculados por conciliaciones_bancarias O por movimiento_bancario_id
      const concs = m.conciliaciones_bancarias || [];
      let pedidosAsociados: any[] = [];

      concs.forEach((c: any) => {
        if (c.pedido_id && pedidosMap.has(c.pedido_id)) {
          pedidosAsociados.push(pedidosMap.get(c.pedido_id));
        } else if (c.pedidos) {
          pedidosAsociados.push(c.pedidos);
        }
      });

      // Si no vino por conciliaciones_bancarias, buscar por movimiento_bancario_id en pedidos
      if (pedidosAsociados.length === 0) {
        const porMovId = (pedidosMes || []).filter((p: any) => p.movimiento_bancario_id === m.id);
        if (porMovId.length > 0) {
          pedidosAsociados = porMovId;
        }
      }

      // Si aún no se encontró pero el concepto bancario menciona el número de pedido (ej. "NO. 237")
      if (pedidosAsociados.length === 0 && m.concepto) {
        const conceptoUpper = String(m.concepto).toUpperCase();
        const matchNum = conceptoUpper.match(/(?:NO\.|PEDIDO|PED|#)\s*([0-9]{1,4})/);
        if (matchNum && matchNum[1]) {
          const numBuscado = matchNum[1];
          const porNumero = (pedidosMes || []).find((p: any) => String(p.numero_pedido) === numBuscado && Math.abs(Number(p.precio_total || 0) - depMonto) <= 0.05);
          if (porNumero) {
            pedidosAsociados.push(porNumero);
          }
        }
        // Coincidencia por cliente Yamato
        if (pedidosAsociados.length === 0 && conceptoUpper.includes('YAMATO')) {
          const porYamato = (pedidosMes || []).find((p: any) => {
            const cli = String(p.clientes?.nombre_local || p.cliente_nombre || '').toUpperCase();
            return cli.includes('YAMATO') && Math.abs(Number(p.precio_total || 0) - depMonto) <= 0.05;
          });
          if (porYamato) {
            pedidosAsociados.push(porYamato);
          }
        }
      }

      if (pedidosAsociados.length > 0) {
        pedidosAsociados.forEach((p: any) => {
          pedidosYaAsignados.add(p.id);

          // Buscar la factura del pedido
          const fc = p.facturas_clientes?.[0] || facturasPorPedidoMap.get(p.id);
          const pedMonto = Number(p.precio_total || 0);
          const facMonto = fc ? Number(fc.total || 0) : 0;
          const dif = depMonto - facMonto;
          const esCuadrado = fc && Math.abs(depMonto - pedMonto) <= 0.05 && Math.abs(depMonto - facMonto) <= 0.05;

          filas.push({
            id: `dep_${m.id}_ped_${p.id}`,
            tipoFila: 'triada',
            movimientoId: m.id,
            fechaBanco: m.fecha,
            conceptoBanco: m.concepto,
            montoBanco: depMonto,
            pedidoId: p.id,
            numeroPedido: p.numero_pedido,
            clienteNombre: p.clientes?.nombre_local || p.cliente_nombre || 'Cliente sin nombre',
            clienteRfc: p.clientes?.rfc || '',
            montoPedido: pedMonto,
            facturaId: fc?.id,
            facturaFolio: fc?.serie_folio || (fc?.uuid_fiscal ? `UUID:${fc.uuid_fiscal.substring(0, 8)}` : (p.folio_factura || '')),
            facturaUuid: fc?.uuid_fiscal || '',
            montoFactura: facMonto,
            tieneFactura: Boolean(fc),
            diferencia: dif,
            esCuadrado,
            estatus: esCuadrado ? 'cuadrado' : (!fc ? 'sin_factura' : 'diferencia'),
          });
        });
      } else {
        // Depósito bancario sin pedido asignado (ej. Depósito de efectivo $3,000)
        // Verificar si hay una factura suelta asociada directamente a este movimiento
        const facDirecta = (todasLasFacturasMes || []).find((f: any) => f.movimiento_bancario_id === m.id || Math.abs(Number(f.total || 0) - depMonto) <= 0.05 && !f.pedido_id);
        const facMonto = facDirecta ? Number(facDirecta.total || 0) : 0;
        const dif = depMonto - facMonto;
        const tieneFac = Boolean(facDirecta);

        filas.push({
          id: `dep_${m.id}_solo`,
          tipoFila: 'deposito_solo',
          movimientoId: m.id,
          fechaBanco: m.fecha,
          conceptoBanco: m.concepto,
          montoBanco: depMonto,
          pedidoId: null,
          numeroPedido: null,
          clienteNombre: facDirecta?.razon_social_receptor || 'Venta Mostrador / Sin Pedido',
          clienteRfc: facDirecta?.rfc_receptor || '',
          montoPedido: 0,
          facturaId: facDirecta?.id,
          facturaFolio: facDirecta?.serie_folio || (facDirecta?.uuid_fiscal ? `UUID:${facDirecta.uuid_fiscal.substring(0, 8)}` : ''),
          facturaUuid: facDirecta?.uuid_fiscal || '',
          montoFactura: facMonto,
          tieneFactura: tieneFac,
          diferencia: dif,
          esCuadrado: tieneFac && Math.abs(dif) <= 0.05,
          estatus: tieneFac && Math.abs(dif) <= 0.05 ? 'cuadrado' : 'sin_pedido',
        });
      }
    });

    // Paso B: Agregar pedidos de este mes que NO tuvieron depósito reflejado en el mes
    (pedidosMes || []).forEach((p: any) => {
      if (!pedidosYaAsignados.has(p.id)) {
        const fc = p.facturas_clientes?.[0] || facturasPorPedidoMap.get(p.id);
        const pedMonto = Number(p.precio_total || 0);
        const facMonto = fc ? Number(fc.total || 0) : 0;

        filas.push({
          id: `ped_${p.id}_sin_dep`,
          tipoFila: 'pedido_sin_deposito',
          movimientoId: null,
          fechaBanco: null,
          conceptoBanco: 'Pendiente de reflejar en banco / Pago diferido',
          montoBanco: 0,
          pedidoId: p.id,
          numeroPedido: p.numero_pedido,
          clienteNombre: p.clientes?.nombre_local || p.cliente_nombre || 'Cliente sin nombre',
          clienteRfc: p.clientes?.rfc || '',
          montoPedido: pedMonto,
          facturaId: fc?.id,
          facturaFolio: fc?.serie_folio || (fc?.uuid_fiscal ? `UUID:${fc.uuid_fiscal.substring(0, 8)}` : (p.folio_factura || '')),
          facturaUuid: fc?.uuid_fiscal || '',
          montoFactura: facMonto,
          tieneFactura: Boolean(fc),
          diferencia: 0 - facMonto,
          esCuadrado: false,
          estatus: 'sin_deposito',
        });
      }
    });

    return filas;
  }, [depositos, pedidosMes, todasLasFacturasMes]);

  // 3. Totales contables oficiales
  const metricas = useMemo(() => {
    let totalEntroBanco = 0;
    depositos.forEach((m: any) => {
      totalEntroBanco += Math.abs(Number(m.deposito || m.monto || 0));
    });

    let totalPedidosPeriodo = 0;
    (pedidosMes || []).forEach((p: any) => {
      totalPedidosPeriodo += Number(p.precio_total || 0);
    });

    let totalFacturadoIndividual = 0;
    (todasLasFacturasMes || []).forEach((f: any) => {
      totalFacturadoIndividual += Number(f.total || 0);
    });

    // Base neta no facturada individualmente en el banco
    const baseFacturaGlobal = Math.max(0, totalEntroBanco - totalFacturadoIndividual);
    const subtotalGlobal = baseFacturaGlobal > 0 ? baseFacturaGlobal / 1.16 : 0;
    const ivaGlobal = baseFacturaGlobal > 0 ? baseFacturaGlobal - subtotalGlobal : 0;

    const totalCuadrados = filasComparativo.filter(f => f.esCuadrado).length;
    const totalSinFactura = filasComparativo.filter(f => !f.tieneFactura).length;
    const totalSinDeposito = filasComparativo.filter(f => f.estatus === 'sin_deposito').length;

    return {
      totalEntroBanco,
      totalPedidosPeriodo,
      totalFacturadoIndividual,
      baseFacturaGlobal,
      subtotalGlobal,
      ivaGlobal,
      totalCuadrados,
      totalSinFactura,
      totalSinDeposito,
      totalFilas: filasComparativo.length,
    };
  }, [depositos, pedidosMes, todasLasFacturasMes, filasComparativo]);

  // 4. Filtrado para la tabla
  const filasFiltradas = useMemo(() => {
    return filasComparativo.filter((f: any) => {
      if (filtroEstatus === 'cuadrados' && !f.esCuadrado) return false;
      if (filtroEstatus === 'sin_factura' && f.tieneFactura) return false;
      if (filtroEstatus === 'sin_deposito' && f.estatus !== 'sin_deposito') return false;

      if (!searchQuery.trim()) return true;
      const s = searchQuery.toLowerCase().trim();
      const numPed = String(f.numeroPedido || '').toLowerCase();
      const cli = String(f.clienteNombre || '').toLowerCase();
      const rfc = String(f.clienteRfc || '').toLowerCase();
      const fol = String(f.facturaFolio || '').toLowerCase();
      const con = String(f.conceptoBanco || '').toLowerCase();
      const monB = String(f.montoBanco || '');
      const monP = String(f.montoPedido || '');
      const monF = String(f.montoFactura || '');

      return (
        numPed.includes(s) ||
        cli.includes(s) ||
        rfc.includes(s) ||
        fol.includes(s) ||
        con.includes(s) ||
        monB.includes(s) ||
        monP.includes(s) ||
        monF.includes(s)
      );
    });
  }, [filasComparativo, filtroEstatus, searchQuery]);

  // 5. Exportar a CSV/Excel para el contador
  const exportarReporteContable = () => {
    const headers = [
      '#',
      'Fecha Banco',
      'Concepto Banco',
      'Entro al Banco ($)',
      'No. Pedido',
      'Cliente',
      'RFC Cliente',
      'Monto Pedido ($)',
      'Folio CFDI',
      'UUID Fiscal',
      'Monto Facturado ($)',
      'Diferencia ($)',
      'Estatus Cuadratura',
    ];

    const rows = filasComparativo.map((f, idx) => [
      idx + 1,
      f.fechaBanco || 'N/A',
      `"${(f.conceptoBanco || '').replace(/"/g, '""')}"`,
      f.montoBanco.toFixed(2),
      f.numeroPedido ? `#${f.numeroPedido}` : 'N/A',
      `"${(f.clienteNombre || '').replace(/"/g, '""')}"`,
      f.clienteRfc || 'N/A',
      f.montoPedido.toFixed(2),
      f.facturaFolio || 'SIN FACTURA',
      f.facturaUuid || 'N/A',
      f.montoFactura.toFixed(2),
      (f.montoBanco - f.montoFactura).toFixed(2),
      f.esCuadrado ? 'CUADRADO' : (!f.tieneFactura ? 'PENDIENTE FACTURAR' : (f.montoBanco === 0 ? 'PENDIENTE BANCO' : 'DIFERENCIA')),
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Auditoria_Contable_Seimenjo_${selectedMonth || 'Periodo'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con botones de reporte */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <Landmark size={20} />
            </span>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                Auditoría Contable: Banco ↔ Pedidos ↔ Facturas
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Conciliación de 3 vías diseñada para contadores. Compara ingresos bancarios contra ventas de fábrica y CFDIs timbrados.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportarReporteContable}
            className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
          >
            <FileSpreadsheet size={15} />
            <span>Exportar Libro Contable (.CSV)</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition-all"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Cuadratura y Dictamen Fiscal (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Entró al Banco */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Landmark size={14} className="text-blue-500" /> 1. Entró al Banco
            </span>
            <span className="font-mono text-[11px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 px-1.5 py-0.5 rounded">
              {depositos.length} depósitos
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-gray-900 dark:text-white">
            {formatCurrency(metricas.totalEntroBanco)}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            Total acreditado en el estado de cuenta
          </div>
        </div>

        {/* Card 2: Pedidos Registrados */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Building2 size={14} className="text-amber-500" /> 2. Pedidos Fábrica
            </span>
            <span className="font-mono text-[11px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 px-1.5 py-0.5 rounded">
              {(pedidosMes || []).length} pedidos
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-gray-900 dark:text-white">
            {formatCurrency(metricas.totalPedidosPeriodo)}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            Ventas registradas y solicitadas en Seimenjo
          </div>
        </div>

        {/* Card 3: Facturado con CFDI */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Receipt size={14} className="text-emerald-500" /> 3. Facturado CFDI
            </span>
            <span className="font-mono text-[11px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 px-1.5 py-0.5 rounded">
              {(todasLasFacturasMes || []).length} facturas
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(metricas.totalFacturadoIndividual)}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">
            Comprobantes fiscales emitidos a clientes
          </div>
        </div>

        {/* Card 4: Base Factura al Público en General */}
        <div className={`p-4 rounded-xl border shadow-sm space-y-1 ${
          metricas.baseFacturaGlobal <= 0.05
            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
            : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-gray-600 dark:text-gray-300">
              <ShieldCheck size={14} className={metricas.baseFacturaGlobal <= 0.05 ? 'text-emerald-600' : 'text-amber-600'} />
              4. Base Factura Global
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
              metricas.baseFacturaGlobal <= 0.05
                ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
                : 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
            }`}>
              {metricas.baseFacturaGlobal <= 0.05 ? 'Amparado 100%' : 'Por Timbrar'}
            </span>
          </div>
          <div className={`text-2xl font-black font-mono ${
            metricas.baseFacturaGlobal <= 0.05 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
          }`}>
            {formatCurrency(metricas.baseFacturaGlobal)}
          </div>
          <div className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
            {metricas.baseFacturaGlobal <= 0.05 ? (
              <span>✨ No requiere Factura Global adicional (mes cubierto con CFDIs individuales)</span>
            ) : (
              <span>Subtotal: {formatCurrency(metricas.subtotalGlobal)} · IVA 16%: {formatCurrency(metricas.ivaGlobal)}</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Dictamen y Dictamen Contable Informativo */}
      <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
        metricas.baseFacturaGlobal <= 0.05
          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
          : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
      }`}>
        <Info size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
        <div className="space-y-1">
          <strong className="block font-bold">Dictamen para Revisión Contable:</strong>
          <p>
            {metricas.baseFacturaGlobal <= 0.05 ? (
              <span>
                El total de ingresos bancarios de <strong>{formatCurrency(metricas.totalEntroBanco)}</strong> está amparado en su totalidad por facturas individuales emitidas con RFC directo (como Sakura Ramen, Yamato, Makimori, Konamon, Dai, Angie Medina). 
                <strong> No debe timbrarse Factura al Público en General por los depósitos bancarios de este mes</strong> para evitar duplicar el ingreso acumulable ante el SAT.
              </span>
            ) : (
              <span>
                Existe un saldo en cuenta bancaria de <strong>{formatCurrency(metricas.baseFacturaGlobal)}</strong> no respaldado por facturas individuales a clientes. Este importe corresponde al remanente a incluir en la Factura al Público en General de Seimenjo para el período {selectedMonth}.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 4. Barra de Filtros y Buscador */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFiltroEstatus('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filtroEstatus === 'todos'
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
            }`}
          >
            Todos ({filasComparativo.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstatus('cuadrados')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              filtroEstatus === 'cuadrados'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Tríadas Cuadradas ({metricas.totalCuadrados})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstatus('sin_factura')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              filtroEstatus === 'sin_factura'
                ? 'bg-amber-600 text-white'
                : 'bg-white dark:bg-gray-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50'
            }`}
          >
            <AlertTriangle size={13} />
            <span>Pendientes Facturar ({metricas.totalSinFactura})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstatus('sin_deposito')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              filtroEstatus === 'sin_deposito'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50'
            }`}
          >
            <span>Sin Depósito en Mes ({metricas.totalSinDeposito})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente, pedido, folio, importe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* 5. Tabla Tripartita Contable */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 text-[10px] font-black uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">1. Fecha y Concepto Banco</th>
                <th className="py-3 px-3 text-right">Entró al Banco ($)</th>
                <th className="py-3 px-3">2. Pedido y Cliente</th>
                <th className="py-3 px-3 text-right">Monto Pedido ($)</th>
                <th className="py-3 px-3">3. Factura Individual CFDI</th>
                <th className="py-3 px-3 text-right">Facturado ($)</th>
                <th className="py-3 px-3 text-center">Cuadratura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-sans">
              {filasFiltradas.map((fila: any, idx: number) => {
                const dif = fila.montoBanco - fila.montoFactura;
                const esCuadrado = fila.esCuadrado;

                return (
                  <tr
                    key={fila.id}
                    className={`hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors ${
                      esCuadrado ? '' : fila.estatus === 'sin_factura' ? 'bg-amber-50/20' : fila.estatus === 'sin_deposito' ? 'bg-blue-50/20' : ''
                    }`}
                  >
                    {/* # */}
                    <td className="py-3 px-3 text-center font-mono text-[10px] text-gray-400">
                      {idx + 1}
                    </td>

                    {/* 1. Banco */}
                    <td className="py-3 px-3 max-w-xs">
                      {fila.fechaBanco ? (
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{fila.fechaBanco}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={fila.conceptoBanco}>
                            {fila.conceptoBanco}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-block text-[11px] text-gray-400 italic">
                          Sin depósito en este mes
                        </span>
                      )}
                    </td>

                    {/* Entró al Banco ($) */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                      {fila.montoBanco > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(fila.montoBanco)}</span>
                      ) : (
                        <span className="text-gray-400">$0.00</span>
                      )}
                    </td>

                    {/* 2. Pedido y Cliente */}
                    <td className="py-3 px-3 max-w-xs">
                      {fila.numeroPedido ? (
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-extrabold text-gray-900 dark:text-white">
                              #{fila.numeroPedido}
                            </span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 truncate">
                              {fila.clienteNombre}
                            </span>
                          </div>
                          {fila.clienteRfc && (
                            <span className="text-[10px] text-gray-400 font-mono">RFC: {fila.clienteRfc}</span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-block text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                          {fila.clienteNombre || 'Sin pedido vinculado'}
                        </span>
                      )}
                    </td>

                    {/* Monto Pedido ($) */}
                    <td className="py-3 px-3 text-right font-mono font-semibold text-gray-700 dark:text-gray-300">
                      {fila.montoPedido > 0 ? formatCurrency(fila.montoPedido) : <span className="text-gray-400">$0.00</span>}
                    </td>

                    {/* 3. Factura CFDI */}
                    <td className="py-3 px-3">
                      {fila.tieneFactura ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {fila.facturaFolio || 'CFDI Timbrado'}
                            </span>
                          </div>
                          {fila.facturaUuid && (
                            <span className="text-[9px] text-gray-400 font-mono block truncate" title={fila.facturaUuid}>
                              {fila.facturaUuid.substring(0, 16)}...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          ⚠️ Sin Factura CFDI
                        </span>
                      )}
                    </td>

                    {/* Facturado ($) */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                      {fila.montoFactura > 0 ? (
                        <span className="text-blue-600 dark:text-blue-400">{formatCurrency(fila.montoFactura)}</span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-bold">$0.00</span>
                      )}
                    </td>

                    {/* Cuadratura */}
                    <td className="py-3 px-3 text-center">
                      {esCuadrado ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 size={11} />
                          <span>Cuadrado ($0.00)</span>
                        </span>
                      ) : !fila.tieneFactura ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <AlertTriangle size={11} />
                          <span>Falta CFDI</span>
                        </span>
                      ) : fila.estatus === 'sin_deposito' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                          <span>Sin cobro en mes</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                          <span>Dif: {formatCurrency(dif)}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400 italic">
                    No se encontraron registros con los filtros seleccionados
                  </td>
                </tr>
              )}
            </tbody>
            {filasFiltradas.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-mono font-bold text-xs border-t-2 border-gray-300 dark:border-gray-700">
                  <td colSpan={2} className="py-3 px-3 text-left uppercase text-[10px] font-black tracking-wider">
                    Totales del Período ({selectedMonth})
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(metricas.totalEntroBanco)}
                  </td>
                  <td className="py-3 px-3 text-center text-[10px] text-gray-500 font-sans font-normal">
                    Total Pedidos:
                  </td>
                  <td className="py-3 px-3 text-right text-gray-800 dark:text-gray-200">
                    {formatCurrency(metricas.totalPedidosPeriodo)}
                  </td>
                  <td className="py-3 px-3 text-center text-[10px] text-gray-500 font-sans font-normal">
                    Total Facturado:
                  </td>
                  <td className="py-3 px-3 text-right text-blue-600 dark:text-blue-400">
                    {formatCurrency(metricas.totalFacturadoIndividual)}
                  </td>
                  <td className="py-3 px-3 text-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    Base PG: {formatCurrency(metricas.baseFacturaGlobal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
