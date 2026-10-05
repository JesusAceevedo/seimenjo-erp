'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FilePlus2,
  FileText,
  Info,
  LoaderCircle,
  Receipt,
  Scale,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import PeriodSelector from '../../_components/PeriodSelector';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { useFacturaPublicoGeneralData } from '../_hooks/useFacturaPublicoGeneralData';
import { crearPedidoDesdeFacturaSeimenjo, vincularFacturaAPedidoSeimenjo } from './actions';
import { ComparativoContableSeimenjoTab } from './_components/ComparativoContableSeimenjoTab';

interface PedidoResumen {
  id: string;
  numero_pedido?: number | null;
  cliente_id?: string | null;
  fecha_pedido?: string | null;
  cliente_nombre?: string | null;
  clientes?: { id?: string; nombre_local?: string; razon_social?: string; rfc?: string } | null;
  precio_total?: number | null;
  folio_factura?: string | null;
  uuid_fiscal?: string | null;
  facturas_clientes?: Array<{ id?: string; serie_folio?: string | null; uuid_fiscal?: string | null }> | null;
}

interface FacturaResumen {
  id?: string;
  uuid_fiscal?: string | null;
  serie_folio?: string | null;
  fecha_emision?: string | null;
  fecha?: string | null;
  _clienteNombre?: string | null;
  cliente_nombre?: string | null;
  nombre_receptor?: string | null;
  razon_social_receptor?: string | null;
  _clienteRfc?: string | null;
  rfc_receptor?: string | null;
  rfc?: string | null;
  cliente_id?: string | null;
  clientes?: { id?: string; nombre_local?: string; razon_social?: string; rfc?: string } | null;
  _subtotal?: number | string | null;
  _total?: number | string | null;
  total?: number | string | null;
  pedido_id?: string | null;
  pedidos?: { id?: string | null } | null;
  _isFromPedido?: boolean;
  _isPG?: boolean;
  uso_cfdi_clave?: string | null;
}

function normalizePartyName(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseAccountingDate(value?: string | null) {
  if (!value) return null;
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const date = new Date(`${datePart}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPublicoGeneralFactura(factura: FacturaResumen): boolean {
  if (factura._isPG) {
    const nombre = String(
      factura._clienteNombre || factura.clientes?.nombre_local || factura.clientes?.razon_social ||
      factura.razon_social_receptor || factura.nombre_receptor || factura.cliente_nombre || ''
    ).toUpperCase();
    if (nombre.includes('PUBLICO EN GENERAL') || nombre.includes('PÚBLICO EN GENERAL') || nombre.includes('VENTA AL PUBLICO') || nombre.includes('VENTA AL PÚBLICO')) {
      return true;
    }
  }

  const rfc = String(factura._clienteRfc || factura.clientes?.rfc || factura.rfc_receptor || factura.rfc || '').trim().toUpperCase();
  const nombre = String(
    factura._clienteNombre || factura.clientes?.nombre_local || factura.clientes?.razon_social ||
    factura.razon_social_receptor || factura.nombre_receptor || factura.cliente_nombre || ''
  ).toUpperCase();
  const folio = String(factura.serie_folio || '').toUpperCase();

  if (nombre.includes('PUBLICO EN GENERAL') || nombre.includes('PÚBLICO EN GENERAL') || nombre.includes('VENTA AL PUBLICO') || nombre.includes('VENTA AL PÚBLICO')) return true;
  if (folio.includes('GLOBAL') || folio.startsWith('PG-') || folio === 'PG') return true;

  if ((rfc.includes('XAXX010101') || rfc.includes('XEXX010101')) && (nombre === '' || nombre === 'PUBLICO' || nombre === 'MOSTRADOR')) {
    return true;
  }
  return false;
}

function shareSignificantWord(strA?: string | null, strB?: string | null): boolean {
  if (!strA || !strB) return false;
  const getWords = (s: string) => s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(w => w.length >= 3 && !['del', 'las', 'los', 'san', 'con', 'sin', 'por', 'para', 'ramen', 'playa'].includes(w));
  const wordsA = new Set(getWords(strA));
  return getWords(strB).some(w => wordsA.has(w));
}

function getClientDisplayName(
  cliente?: { nombre_local?: string; razon_social?: string; rfc?: string } | null,
  fallback?: string | null
): string {
  const local = (cliente?.nombre_local || '').trim();
  const razon = (cliente?.razon_social || '').trim();
  const fb = (fallback || '').trim();

  if (local && razon && local.toLowerCase() !== razon.toLowerCase()) {
    return `${local} (${razon})`;
  }
  return local || razon || fb || 'Cliente sin nombre';
}

export default function SeimenjoPedidosPage() {
  const router = useRouter();
  const getSessionToken = useSessionToken();
  const {
    loading,
    empresaNombre,
    selectedMonth,
    refreshPeriodStatus,
    fetchData,
    pedidosMes,
    todasLasFacturasMes,
    movimientosDeposito,
    depositosMes,
    formatCurrency,
  } = useFacturaPublicoGeneralData();
  const [seimenjoTabActiva, setSeimenjoTabActiva] = useState<'auditoria_contable' | 'gestion_pedidos'>('auditoria_contable');
  const [creatingFacturaId, setCreatingFacturaId] = useState('');
  const [selectedPedidoByFactura, setSelectedPedidoByFactura] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filtroPedidosTab, setFiltroPedidosTab] = useState<'todos' | 'sin_folio' | 'incompletos'>('todos');

  const isSeimenjo = empresaNombre.toLowerCase().includes('seimenjo') && !empresaNombre.toLowerCase().includes('sakura');
  const pedidos = pedidosMes as PedidoResumen[];

  // Pedidos con relación CFDI confirmada en facturas_clientes
  const pedidosFacturados = useMemo(() => pedidos.filter(pedido =>
    Boolean(pedido.facturas_clientes?.length)
  ), [pedidos]);

  // Pedidos disponibles para asociar un CFDI (no tienen CFDI confirmado en BD)
  const pedidosAsignables = useMemo(() => pedidos.filter(pedido =>
    !pedido.facturas_clientes?.length
  ), [pedidos]);

  // Desglose de pedidos asignables
  const pedidosPendientesSinFolio = useMemo(() => pedidosAsignables.filter(p =>
    !p.folio_factura
  ), [pedidosAsignables]);

  const pedidosConFolioIncompleto = useMemo(() => pedidosAsignables.filter(p =>
    Boolean(p.folio_factura)
  ), [pedidosAsignables]);

  // Lista a mostrar en la tabla según el filtro
  const pedidosTablaDisplay = useMemo(() => {
    if (filtroPedidosTab === 'sin_folio') return pedidosPendientesSinFolio;
    if (filtroPedidosTab === 'incompletos') return pedidosConFolioIncompleto;
    return pedidosAsignables;
  }, [filtroPedidosTab, pedidosPendientesSinFolio, pedidosConFolioIncompleto, pedidosAsignables]);

  // Facturas individuales de clientes sin pedido vinculado (excluye estrictamente Factura Global)
  const facturasSinPedido = useMemo(() => {
    return (todasLasFacturasMes as FacturaResumen[]).filter(factura => {
      if (factura._isFromPedido || factura.pedido_id || factura.pedidos?.id) return false;
      if (isPublicoGeneralFactura(factura)) return false;
      return true;
    });
  }, [todasLasFacturasMes]);

  const pedidosCandidatosParaFactura = (factura: FacturaResumen) => {
    const facturaRfc = String(factura._clienteRfc || factura.clientes?.rfc || factura.rfc_receptor || factura.rfc || '').trim().toUpperCase();
    const facturaNombreRaw = factura._clienteNombre || factura.clientes?.nombre_local || factura.clientes?.razon_social ||
      factura.razon_social_receptor || factura.nombre_receptor || factura.cliente_nombre || '';
    const facturaNombreNorm = normalizePartyName(facturaNombreRaw);
    const facturaFecha = parseAccountingDate(factura.fecha_emision || factura.fecha);
    const totalFactura = Number(factura._total || factura.total || 0);
    const folioFactura = String(factura.serie_folio || '').trim().toUpperCase();
    const uuidFactura = String(factura.uuid_fiscal || '').trim().toUpperCase();

    return pedidosAsignables.map(pedido => {
      const pedidoRfc = String(pedido.clientes?.rfc || '').trim().toUpperCase();
      const pedidoNombreRaw = pedido.clientes?.nombre_local || pedido.clientes?.razon_social || pedido.cliente_nombre || '';
      const pedidoNombreNorm = normalizePartyName(pedidoNombreRaw);

      const mismaCuentaCliente = Boolean(
        (factura.cliente_id && pedido.cliente_id && factura.cliente_id === pedido.cliente_id) ||
        (facturaRfc && pedidoRfc && facturaRfc === pedidoRfc) ||
        (facturaNombreNorm && pedidoNombreNorm && (facturaNombreNorm === pedidoNombreNorm || facturaNombreNorm.includes(pedidoNombreNorm) || pedidoNombreNorm.includes(facturaNombreNorm))) ||
        shareSignificantWord(facturaNombreRaw, pedidoNombreRaw)
      );

      const diferenciaImporte = Math.abs(Number(pedido.precio_total || 0) - totalFactura);
      const pedidoFecha = parseAccountingDate(pedido.fecha_pedido);
      const diferenciaDias = facturaFecha && pedidoFecha
        ? Math.abs(facturaFecha.getTime() - pedidoFecha.getTime()) / 86400000
        : Number.POSITIVE_INFINITY;

      const pedidoFolio = String(pedido.folio_factura || '').trim().toUpperCase();
      const coincideFolio = Boolean(
        (folioFactura && pedidoFolio && (pedidoFolio === folioFactura || pedidoFolio.includes(folioFactura) || folioFactura.includes(pedidoFolio))) ||
        (uuidFactura && pedidoFolio && pedidoFolio.includes(uuidFactura))
      );

      const coincideCliente = mismaCuentaCliente && diferenciaImporte <= 0.05 && diferenciaDias <= 45;
      const coincideMontoYFecha = diferenciaImporte <= 0.05 && diferenciaDias <= 15;
      const coincide = (coincideFolio && diferenciaImporte <= 0.05) || coincideCliente || coincideMontoYFecha;

      return {
        pedido,
        coincide,
        coincideFolio,
        coincideCliente,
        coincideMontoYFecha,
        diferenciaImporte,
        diferenciaDias,
      };
    }).sort((a, b) =>
      Number(b.coincideFolio) - Number(a.coincideFolio) ||
      Number(b.coincideCliente) - Number(a.coincideCliente) ||
      Number(b.coincideMontoYFecha) - Number(a.coincideMontoYFecha) ||
      Number(b.coincide) - Number(a.coincide) ||
      a.diferenciaImporte - b.diferenciaImporte ||
      a.diferenciaDias - b.diferenciaDias
    );
  };

  const asignarFactura = async (factura: FacturaResumen, pedidoId: string) => {
    if (!factura.id || !pedidoId || isPublicoGeneralFactura(factura)) return;
    setCreatingFacturaId(factura.id);
    setFeedback(null);
    try {
      const token = await getSessionToken();
      const result = await vincularFacturaAPedidoSeimenjo(factura.id, pedidoId, token);
      if (!result.success) throw new Error(result.error || 'No se pudo vincular la factura.');
      setFeedback({
        type: 'success',
        text: `Factura asignada exitosamente al pedido #${result.pedido?.numero_pedido ?? ''}.`,
      });
      setSelectedPedidoByFactura(prev => {
        const next = { ...prev };
        delete next[factura.id!];
        return next;
      });
      await fetchData();
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Ocurrió un error al vincular la factura.' });
    } finally {
      setCreatingFacturaId('');
    }
  };

  const crearPedido = async (factura: FacturaResumen) => {
    if (!factura.id || isPublicoGeneralFactura(factura)) return;
    setCreatingFacturaId(factura.id);
    setFeedback(null);
    try {
      const token = await getSessionToken();
      const result = await crearPedidoDesdeFacturaSeimenjo(factura.id, token);
      if (!result.success) throw new Error(result.error || 'No se pudo crear el pedido.');
      setFeedback({
        type: 'success',
        text: `Pedido #${result.pedido?.numero_pedido ?? ''} creado y vinculado exitosamente con el CFDI ${factura.serie_folio || ''}.`.trim(),
      });
      setSelectedPedidoByFactura(prev => {
        const next = { ...prev };
        delete next[factura.id!];
        return next;
      });
      await fetchData();
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'Ocurrió un error al crear el pedido.',
      });
    } finally {
      setCreatingFacturaId('');
    }
  };

  if (!loading && !isSeimenjo) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-5 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-white p-5 dark:border-amber-900 dark:bg-gray-900">
          <h1 className="text-lg font-black">Módulo exclusivo de Seimenjo</h1>
          <p className="mt-1 text-sm text-gray-500">Esta vista no está habilitada para la empresa activa.</p>
          <button type="button" onClick={() => router.push('/admin/factura-publico-general')} className="mt-4 text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">
            Volver a Factura al Público en General
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col gap-3 border-b border-gray-200 pb-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/factura-publico-general')}
              className="mt-0.5 rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              aria-label="Volver"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                Seimenjo · Período {selectedMonth}
              </p>
              <h1 className="text-xl font-black">Pedidos y Facturación B2B</h1>
              <p className="mt-0.5 text-xs text-gray-500">
                Control de pedidos de fábrica, vinculación con CFDI emitidos y asignación de facturas sin pedido.
              </p>
            </div>
          </div>
          <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
        </header>

        {/* Nota informativa sobre clientes comerciales de Seimenjo */}
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
          <Info size={16} className="shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            <strong>Empresa activa: PLAYA SEIMENJO.</strong> Los registros identificados como &ldquo;SAKURA&rdquo; corresponden al cliente comercial <strong>RAMEN DE PLAYA (RFC RPL231122S52)</strong> registrado en Seimenjo, no a la empresa emisora Sakura.
          </span>
        </div>

        {feedback && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'}`}>
            {feedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {feedback.text}
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <span className="text-[10px] font-black uppercase text-gray-500">Pedidos del período</span>
            <strong className="mt-1 block font-mono text-2xl">{pedidos.length}</strong>
            <span className="text-[10px] text-gray-500">
              Total: {formatCurrency(pedidos.reduce((sum, pedido) => sum + Number(pedido.precio_total || 0), 0))}
            </span>
          </article>
          <article className="rounded-lg border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-gray-900">
            <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300">Pedidos con CFDI vinculado</span>
            <strong className="mt-1 block font-mono text-2xl text-emerald-700 dark:text-emerald-300">{pedidosFacturados.length}</strong>
            <span className="text-[10px] text-gray-500">CFDI formal confirmado en BD</span>
          </article>
          <article className={`rounded-lg border p-4 ${pedidosAsignables.length ? 'border-amber-300 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
            <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300">Pedidos por facturar</span>
            <strong className="mt-1 block font-mono text-2xl text-amber-800 dark:text-amber-300">{pedidosAsignables.length}</strong>
            <span className="text-[10px] text-gray-500">
              {pedidosPendientesSinFolio.length} sin folio · {pedidosConFolioIncompleto.length} provisional/incompleto
            </span>
          </article>
          <article className={`rounded-lg border p-4 ${facturasSinPedido.length ? 'border-sky-300 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/20' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'}`}>
            <span className="text-[10px] font-black uppercase text-sky-800 dark:text-sky-300">Facturas sin pedido</span>
            <strong className="mt-1 block font-mono text-2xl text-sky-800 dark:text-sky-300">{facturasSinPedido.length}</strong>
            <span className="text-[10px] text-gray-500">CFDI individuales sin pedido asociado</span>
          </article>
        </section>

        {/* Selector de Pestañas Principales */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
          <button
            type="button"
            onClick={() => setSeimenjoTabActiva('auditoria_contable')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              seimenjoTabActiva === 'auditoria_contable'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
            }`}
          >
            <Scale size={15} />
            <span>1. Auditoría Contable (Banco ↔ Pedidos ↔ Facturas)</span>
          </button>
          <button
            type="button"
            onClick={() => setSeimenjoTabActiva('gestion_pedidos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              seimenjoTabActiva === 'gestion_pedidos'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-800'
            }`}
          >
            <ShoppingBag size={15} />
            <span>2. Gestión de Pedidos y Vinculación CFDI ({pedidosAsignables.length} por facturar)</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
            <LoaderCircle size={16} className="animate-spin" /> Cargando pedidos y facturas…
          </div>
        ) : seimenjoTabActiva === 'auditoria_contable' ? (
          <ComparativoContableSeimenjoTab
            pedidosMes={pedidosMes}
            todasLasFacturasMes={todasLasFacturasMes}
            movimientosDeposito={movimientosDeposito}
            depositosMes={depositosMes}
            selectedMonth={selectedMonth}
            formatCurrency={formatCurrency}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* TABLA DE PEDIDOS POR FACTURAR */}
            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <header className="flex flex-col gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black">
                    <ShoppingBag size={15} className="text-amber-600" /> Pedidos por facturar ({pedidosAsignables.length})
                  </h2>
                  <p className="mt-0.5 text-[10px] text-gray-500">Pedidos sin CFDI formal vinculado en facturas_clientes.</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFiltroPedidosTab('todos')}
                    className={`rounded px-2 py-1 text-[10px] font-bold transition-colors ${filtroPedidosTab === 'todos' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
                  >
                    Todos ({pedidosAsignables.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroPedidosTab('sin_folio')}
                    className={`rounded px-2 py-1 text-[10px] font-bold transition-colors ${filtroPedidosTab === 'sin_folio' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
                  >
                    Sin folio ({pedidosPendientesSinFolio.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltroPedidosTab('incompletos')}
                    className={`rounded px-2 py-1 text-[10px] font-bold transition-colors ${filtroPedidosTab === 'incompletos' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}
                  >
                    Provisionales ({pedidosConFolioIncompleto.length})
                  </button>
                </div>
              </header>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-[9px] uppercase text-gray-500 dark:bg-gray-800">
                    <tr>
                      <th className="p-3">Pedido</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {pedidosTablaDisplay.map(pedido => {
                      const clienteDisplay = getClientDisplayName(pedido.clientes, pedido.cliente_nombre);
                      const rfc = pedido.clientes?.rfc || '';
                      return (
                        <tr key={pedido.id}>
                          <td className="p-3 font-mono font-bold">#{pedido.numero_pedido || '—'}</td>
                          <td className="p-3 text-gray-500">{pedido.fecha_pedido || '—'}</td>
                          <td className="p-3">
                            <span className="font-medium">{clienteDisplay}</span>
                            {rfc && <span className="block text-[10px] text-gray-500 font-mono">{rfc}</span>}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold">{formatCurrency(pedido.precio_total || 0)}</td>
                          <td className="p-3">
                            {pedido.folio_factura ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                                title="Tiene un folio registrado en el pedido pero sin vinculación formal de CFDI en facturas_clientes"
                              >
                                Folio: {pedido.folio_factura}
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                Sin facturar
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {pedidosTablaDisplay.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-400">
                          No hay pedidos en este filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* TABLA DE FACTURAS SIN PEDIDO ASOCIADO */}
            <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <header className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-black">
                    <FileText size={15} className="text-sky-600" /> Facturas sin pedido asociado ({facturasSinPedido.length})
                  </h2>
                  <p className="mt-0.5 text-[10px] text-gray-500">Asigna el CFDI a un pedido existente (o provisional) o crea un pedido nuevo.</p>
                </div>
                <span className="font-mono text-xs font-bold">{facturasSinPedido.length}</span>
              </header>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-[9px] uppercase text-gray-500 dark:bg-gray-800">
                    <tr>
                      <th className="p-3">Fecha / folio</th>
                      <th className="p-3">Receptor</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {facturasSinPedido.map(factura => {
                      const facturaId = factura.id || '';
                      const candidatos = pedidosCandidatosParaFactura(factura);
                      const pedidoSugerido = candidatos.find(item => item.coincide)?.pedido;
                      const pedidoSeleccionadoId = selectedPedidoByFactura[facturaId] || pedidoSugerido?.id || '';
                      const clienteDisplay = getClientDisplayName(
                        factura.clientes,
                        factura._clienteNombre || factura.nombre_receptor || factura.razon_social_receptor || factura.cliente_nombre
                      );
                      const rfc = factura._clienteRfc || factura.clientes?.rfc || factura.rfc_receptor || factura.rfc || '';

                      return (
                        <tr key={facturaId || factura.uuid_fiscal}>
                          <td className="p-3 font-mono">
                            {factura.fecha_emision || factura.fecha || '—'}
                            <span className="block text-[10px] text-gray-500">{factura.serie_folio || factura.uuid_fiscal || 'Sin folio'}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-medium">{clienteDisplay}</span>
                            {rfc && <span className="block text-[10px] text-gray-500 font-mono">{rfc}</span>}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold">{formatCurrency(factura._total || factura.total || 0)}</td>
                          <td className="p-3">
                            <div className="flex min-w-56 flex-col gap-1.5">
                              {pedidosAsignables.length > 0 ? (
                                <>
                                  <select
                                    value={pedidoSeleccionadoId}
                                    onChange={event => setSelectedPedidoByFactura(previous => ({ ...previous, [facturaId]: event.target.value }))}
                                    className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-[10px] dark:border-gray-700 dark:bg-gray-950"
                                    aria-label={`Seleccionar pedido para factura ${factura.serie_folio || factura.uuid_fiscal || facturaId}`}
                                  >
                                    <option value="">Seleccionar pedido disponible…</option>
                                    {candidatos.map(({ pedido, coincideFolio, coincideCliente, coincideMontoYFecha }) => {
                                      const clientStr = getClientDisplayName(pedido.clientes, pedido.cliente_nombre);
                                      const folioTag = pedido.folio_factura ? ` [Folio actual: ${pedido.folio_factura}]` : '';
                                      let prefix = '';
                                      if (coincideFolio) {
                                        prefix = '★ Folio coincidente: ';
                                      } else if (coincideCliente) {
                                        prefix = '★ Coincide cliente e importe: ';
                                      } else if (coincideMontoYFecha) {
                                        prefix = '★ Coincide importe exacto y fecha: ';
                                      }
                                      return (
                                        <option key={pedido.id} value={pedido.id}>
                                          {prefix}#{pedido.numero_pedido || '—'} · {clientStr} · {formatCurrency(pedido.precio_total || 0)} · {pedido.fecha_pedido || '—'}{folioTag}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {pedidoSugerido && (() => {
                                    const topCand = candidatos.find(c => c.pedido.id === pedidoSugerido.id);
                                    let reason = 'por coincidencia de cliente, importe o folio';
                                    if (topCand?.coincideFolio) reason = 'por folio coincidente';
                                    else if (topCand?.coincideCliente) reason = 'por cliente e importe idénticos';
                                    else if (topCand?.coincideMontoYFecha) reason = 'por importe idéntico ($' + Number(factura._total || factura.total || 0).toFixed(2) + ') y fecha próxima';
                                    return (
                                      <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                                        <Sparkles size={10} /> Sugerido {reason}
                                      </span>
                                    );
                                  })()}
                                  <button
                                    type="button"
                                    onClick={() => asignarFactura(factura, pedidoSeleccionadoId)}
                                    disabled={!facturaId || !pedidoSeleccionadoId || creatingFacturaId === facturaId}
                                    className="inline-flex items-center justify-center gap-1 rounded-md bg-sky-700 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {creatingFacturaId === facturaId ? <LoaderCircle size={12} className="animate-spin" /> : <Receipt size={12} />}
                                    Asignar CFDI al pedido
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-gray-500">No hay pedidos disponibles para vincular.</span>
                              )}
                              <button
                                type="button"
                                onClick={() => crearPedido(factura)}
                                disabled={!facturaId || creatingFacturaId === facturaId}
                                className="inline-flex items-center justify-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-[10px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                {creatingFacturaId === facturaId ? <LoaderCircle size={12} className="animate-spin" /> : <FilePlus2 size={12} />}
                                Crear pedido nuevo desde CFDI
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {facturasSinPedido.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-400">
                          Todas las facturas individuales están vinculadas a un pedido.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        <footer className="text-[10px] text-gray-500">
          <Receipt size={12} className="mr-1 inline" /> Los pedidos con relación confirmada en facturas_clientes se consideran formalmente facturados. Los pedidos con folios provisionales o relaciones incompletas pueden vincularse a su CFDI correspondiente. Las facturas de Público en General no se convierten en pedidos individuales.
        </footer>
      </div>
    </main>
  );
}