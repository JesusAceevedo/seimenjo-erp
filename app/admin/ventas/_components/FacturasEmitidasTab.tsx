'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/ventas/_components/FacturasEmitidasTab.tsx
// Apartado de Facturas Emitidas por la empresa, ligadas por el RFC del cliente.

import React, { useState, useMemo } from 'react';
import {
  FileText,
  UploadCloud,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Mail,
  Copy,
  Check,
  CreditCard,
  Building2,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Link2,
  RefreshCw,
  ExternalLink,
  Receipt,
  X,
  Sparkles
} from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import { getMetodoPagoLabel } from '../../../../lib/constants/sat';
import CargaXmlMasivaModal from '../../gastos/_components/CargaXmlMasivaModal';
import CargaManualModal from '../../gastos/_components/CargaManualModal';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import {
  vincularFacturaClientePorRfc,
  autoVincularFacturasEmitidasPorRfc
} from '../../gastos/actions';

interface FacturasEmitidasTabProps {
  facturas: any[];
  clientes: any[];
  empresaRfc?: string | null;
  selectedMonth?: string;
  onDownloadFile: (url: string) => void;
  onViewCfdi?: (xmlUrl: string) => void;
  onSendEmail?: (pedidoId: string) => void;
  onDeleteFactura?: (facturaId: string) => Promise<void>;
  onRefresh: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function FacturasEmitidasTab({
  facturas,
  clientes,
  empresaRfc,
  selectedMonth,
  onDownloadFile,
  onViewCfdi,
  onSendEmail,
  onDeleteFactura,
  onRefresh
}: FacturasEmitidasTabProps) {
  const { openCfdi } = useCfdiViewer();
  const handleViewCfdi = onViewCfdi || openCfdi;
  const getSessionToken = useSessionToken();

  // Modales de carga
  const [showXmlModal, setShowXmlModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Modal para ligar/cambiar cliente por RFC
  const [rfcModal, setRfcModal] = useState<{
    isOpen: boolean;
    factura: any | null;
    rfcInput: string;
    nombreInput: string;
    loading: boolean;
    error: string;
  }>({
    isOpen: false,
    factura: null,
    rfcInput: '',
    nombreInput: '',
    loading: false,
    error: ''
  });

  // Filtros
  const [search, setSearch] = useState('');
  const [rfcFilter, setRfcFilter] = useState<string>('');
  const [filtroPeriodo, setFiltroPeriodo] = useState<'mes' | 'todos'>('mes');
  const [filtroPedido, setFiltroPedido] = useState<'todos' | 'con_pedido' | 'sin_pedido'>('todos');
  const [filtroDocs, setFiltroDocs] = useState<'todos' | 'con_xml' | 'con_pdf'>('todos');

  // Paginación
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // Copiado de UUID
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);

  // Estado de auto-vinculación en lote
  const [isAutoLinking, setIsAutoLinking] = useState(false);
  const [autoLinkMessage, setAutoLinkMessage] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUuid(id);
    setTimeout(() => setCopiedUuid(null), 2000);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'S/F';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'S/F';
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr.substring(0, 10);
    }
  };

  // Filtrado de facturas
  const facturasFiltradas = useMemo(() => {
    return facturas.filter((f) => {
      // 1. Filtro por Periodo
      if (filtroPeriodo === 'mes' && selectedMonth) {
        const fechaRef = f.fecha_emision || f.fecha_timbrado || f.created_at || '';
        const mesFactura = fechaRef.substring(0, 7);
        if (mesFactura !== selectedMonth) return false;
      }

      // 2. Filtro rápido por RFC
      if (rfcFilter) {
        const rfc = (f.clientes?.rfc || f.rfc_receptor || '').toUpperCase();
        if (rfc !== rfcFilter.toUpperCase()) return false;
      }

      // 3. Filtro por Pedido
      if (filtroPedido === 'con_pedido' && !f.pedido_id) return false;
      if (filtroPedido === 'sin_pedido' && f.pedido_id) return false;

      // 4. Filtro por Documentos
      if (filtroDocs === 'con_xml' && !f.xml_url) return false;
      if (filtroDocs === 'con_pdf' && !f.pdf_url) return false;

      // 5. Búsqueda de texto
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const folio = (f.serie_folio || '').toLowerCase();
        const uuid = (f.uuid_fiscal || '').toLowerCase();
        const clienteNom = (f.clientes?.nombre_local || f.clientes?.razon_social || '').toLowerCase();
        const rfc = (f.clientes?.rfc || f.rfc_receptor || '').toLowerCase();
        const totalStr = String(f.total || '');
        const pedidoNum = f.pedidos?.numero_pedido ? String(f.pedidos.numero_pedido) : '';

        const match =
          folio.includes(q) ||
          uuid.includes(q) ||
          clienteNom.includes(q) ||
          rfc.includes(q) ||
          totalStr.includes(q) ||
          pedidoNum.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [facturas, filtroPeriodo, selectedMonth, rfcFilter, filtroPedido, filtroDocs, search]);

  // Métricas y KPIs
  const metricas = useMemo(() => {
    let totalFacturado = 0;
    let totalSubtotal = 0;
    let totalIva = 0;
    const rfcsSet = new Set<string>();

    facturasFiltradas.forEach((f) => {
      const tot = Number(f.total || 0);
      const sub = Number(f.subtotal || (tot > 0 ? tot / 1.16 : 0));
      const iva = Number(f.iva_trasladado || (tot - sub));

      totalFacturado += tot;
      totalSubtotal += sub;
      totalIva += iva;

      const rfc = (f.clientes?.rfc || f.rfc_receptor || '').trim().toUpperCase();
      if (rfc) rfcsSet.add(rfc);
    });

    return {
      totalFacturado,
      totalSubtotal,
      totalIva,
      cantidadFacturas: facturasFiltradas.length,
      clientesUnicos: rfcsSet.size
    };
  }, [facturasFiltradas]);

  // Paginación
  const totalPages = Math.ceil(facturasFiltradas.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const from = page * pageSize;
    return facturasFiltradas.slice(from, from + pageSize);
  }, [facturasFiltradas, page, pageSize]);

  // Lista única de RFCs para el filtro dropdown
  const rfcsDisponibles = useMemo(() => {
    const map = new Map<string, { rfc: string; nombre: string; count: number }>();
    facturas.forEach((f) => {
      const rfc = (f.clientes?.rfc || f.rfc_receptor || '').trim().toUpperCase();
      if (!rfc) return;
      const nombre = f.clientes?.nombre_local || f.clientes?.razon_social || 'Cliente';
      const existing = map.get(rfc);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(rfc, { rfc, nombre, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [facturas]);

  // Manejador para abrir modal de ligar por RFC
  const handleOpenRfcModal = (factura: any) => {
    const currentRfc = (factura.clientes?.rfc || '').trim().toUpperCase();
    const currentNombre = factura.clientes?.nombre_local || factura.clientes?.razon_social || '';
    setRfcModal({
      isOpen: true,
      factura,
      rfcInput: currentRfc,
      nombreInput: currentNombre,
      loading: false,
      error: ''
    });
  };

  // Guardar vinculación por RFC
  const handleGuardarRfcVinculacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfcModal.factura || !rfcModal.rfcInput.trim()) {
      setRfcModal((prev) => ({ ...prev, error: 'Ingresa un RFC válido.' }));
      return;
    }

    setRfcModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('No hay sesión activa.');

      const res = await vincularFacturaClientePorRfc(
        rfcModal.factura.id,
        rfcModal.rfcInput.trim().toUpperCase(),
        token,
        rfcModal.nombreInput.trim()
      );

      if (!res.success) {
        throw new Error(res.error || 'No se pudo vincular la factura al cliente.');
      }

      setRfcModal({
        isOpen: false,
        factura: null,
        rfcInput: '',
        nombreInput: '',
        loading: false,
        error: ''
      });
      onRefresh();
    } catch (err: any) {
      setRfcModal((prev) => ({ ...prev, loading: false, error: err.message || 'Error al guardar.' }));
    }
  };

  // Auto-vincular facturas sueltas por RFC
  const handleAutoVincular = async () => {
    setIsAutoLinking(true);
    setAutoLinkMessage(null);
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('Sesión no disponible.');
      const res = await autoVincularFacturasEmitidasPorRfc(token);
      if (res.success) {
        setAutoLinkMessage(
          res.vinculadasCount > 0
            ? `Se vincularon automáticamente ${res.vinculadasCount} facturas a sus clientes por RFC.`
            : 'Todas las facturas ya cuentan con un cliente vinculado por RFC.'
        );
        onRefresh();
      } else {
        alert(res.error || 'Error al auto-vincular');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsAutoLinking(false);
      setTimeout(() => setAutoLinkMessage(null), 6000);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-gray-900 dark:text-gray-100 font-sans">
      {/* BARRA SUPERIOR DE ACCIONES Y KPIS */}
      <div className="p-4 md:p-6 pb-2 border-b border-gray-200 dark:border-gray-800 shrink-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Receipt size={20} />
              </span>
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  Facturas Emitidas
                  {empresaRfc && (
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      RFC Emisor: {empresaRfc}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Control y auditoría de todos los CFDI emitidos por la empresa, organizados y vinculados por el RFC del cliente.
                </p>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAutoVincular}
              disabled={isAutoLinking}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              title="Escanear y vincular facturas automáticamente por RFC"
            >
              <Sparkles size={14} className={isAutoLinking ? 'animate-spin' : ''} />
              {isAutoLinking ? 'Vinculando...' : 'Re-ligar por RFC'}
            </button>

            <button
              onClick={() => setShowXmlModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm cursor-pointer"
            >
              <UploadCloud size={14} /> Subir XML Masivo
            </button>

            <button
              onClick={() => setShowManualModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
            >
              <Plus size={14} /> Carga Manual
            </button>
          </div>
        </div>

        {/* Mensaje de auto-vinculación */}
        {autoLinkMessage && (
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-800 dark:text-indigo-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-indigo-500" />
              <span>{autoLinkMessage}</span>
            </div>
            <button
              onClick={() => setAutoLinkMessage(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* TARJETAS KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Facturado</span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block mt-0.5 truncate">
              {formatCurrency(metricas.totalFacturado)}
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Subtotal Neto</span>
            <span className="text-base font-black text-gray-900 dark:text-white block mt-0.5 truncate">
              {formatCurrency(metricas.totalSubtotal)}
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">IVA Trasladado</span>
            <span className="text-base font-black text-blue-600 dark:text-blue-400 block mt-0.5 truncate">
              {formatCurrency(metricas.totalIva)}
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Facturas Emitidas</span>
            <span className="text-base font-black text-gray-900 dark:text-white block mt-0.5">
              {metricas.cantidadFacturas} comprobantes
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xs">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Clientes / RFCs</span>
            <span className="text-base font-black text-indigo-600 dark:text-indigo-400 block mt-0.5">
              {metricas.clientesUnicos} clientes
            </span>
          </div>
        </div>

        {/* BARRA DE FILTROS Y BÚSQUEDA */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por folio, UUID, RFC o nombre de cliente..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filtro por RFC específico */}
          <div className="flex items-center gap-1">
            <select
              value={rfcFilter}
              onChange={(e) => {
                setRfcFilter(e.target.value);
                setPage(0);
              }}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
            >
              <option value="">Todos los RFCs de clientes ({rfcsDisponibles.length})</option>
              {rfcsDisponibles.map((item) => (
                <option key={item.rfc} value={item.rfc}>
                  {item.rfc} — {item.nombre} ({item.count})
                </option>
              ))}
            </select>

            {rfcFilter && (
              <button
                onClick={() => setRfcFilter('')}
                className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-bold"
                title="Quitar filtro de RFC"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Switch Periodo vs Todo el año */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-900 p-0.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs">
            <button
              onClick={() => {
                setFiltroPeriodo('mes');
                setPage(0);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filtroPeriodo === 'mes'
                  ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              {selectedMonth || 'Mes actual'}
            </button>
            <button
              onClick={() => {
                setFiltroPeriodo('todos');
                setPage(0);
              }}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                filtroPeriodo === 'todos'
                  ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              Todo el año / Histórico
            </button>
          </div>

          {/* Filtro Pedido */}
          <select
            value={filtroPedido}
            onChange={(e) => {
              setFiltroPedido(e.target.value as any);
              setPage(0);
            }}
            className="px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="todos">Todos los pedidos</option>
            <option value="con_pedido">Con Pedido Vinculado</option>
            <option value="sin_pedido">Directas (Sin Pedido)</option>
          </select>
        </div>
      </div>

      {/* TABLA PRINCIPAL DE FACTURAS EMITIDAS */}
      <div className="flex-1 overflow-auto min-h-0 bg-white dark:bg-gray-950">
        {paginatedData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400 space-y-3">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-400">
              <Receipt size={32} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                No se encontraron facturas emitidas
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {search || rfcFilter
                  ? 'Prueba ajustando los términos de búsqueda o limpiando el filtro de RFC.'
                  : 'Sube comprobantes XML masivos o registra una factura manualmente.'}
              </p>
            </div>
            {(search || rfcFilter || filtroPedido !== 'todos') && (
              <button
                onClick={() => {
                  setSearch('');
                  setRfcFilter('');
                  setFiltroPedido('todos');
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-xs border-b border-gray-200 dark:border-gray-800 text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">
              <tr>
                <th className="p-3 pl-4">Fecha</th>
                <th className="p-3">Folio & UUID Fiscal</th>
                <th className="p-3">Cliente / RFC Receptor (Ligado)</th>
                <th className="p-3">Pedido</th>
                <th className="p-3">Forma de Pago / SAT</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3 text-right">IVA</th>
                <th className="p-3 text-right">Total Factura</th>
                <th className="p-3 text-center">Estatus</th>
                <th className="p-3 pr-4 text-center">Documentos & Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-xs">
              {paginatedData.map((f) => {
                const clientRfc = (f.clientes?.rfc || f.rfc_receptor || '').trim().toUpperCase();
                const clientName = f.clientes?.nombre_local || f.clientes?.razon_social || 'Cliente Sin Registrar';
                const hasXml = !!f.xml_url;
                const hasPdf = !!f.pdf_url;
                const totalVal = Number(f.total || 0);
                const subtotalVal = Number(f.subtotal || (totalVal > 0 ? totalVal / 1.16 : 0));
                const ivaVal = Number(f.iva_trasladado || (totalVal - subtotalVal));
                const estatusNombre = f.estatus_factura?.nombre || 'Facturado';

                return (
                  <tr
                    key={f.id}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-900/40 transition-colors group"
                  >
                    {/* Fecha */}
                    <td className="p-3 pl-4 font-mono text-gray-600 dark:text-gray-300 text-[11px] whitespace-nowrap">
                      {formatDate(f.fecha_emision || f.fecha_timbrado || f.created_at)}
                    </td>

                    {/* Folio y UUID */}
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-gray-900 dark:text-white text-xs">
                          {f.serie_folio || 'Sin Folio'}
                        </span>
                        {f.uuid_fiscal && (
                          <div className="flex items-center gap-1">
                            <span
                              className="font-mono text-[10px] text-gray-400 truncate max-w-[140px]"
                              title={f.uuid_fiscal}
                            >
                              {f.uuid_fiscal}
                            </span>
                            <button
                              onClick={() => copyToClipboard(f.uuid_fiscal, f.id)}
                              className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                              title="Copiar UUID"
                            >
                              {copiedUuid === f.id ? (
                                <Check size={11} className="text-emerald-500" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Cliente y RFC Receptor (LIGADO POR RFC) */}
                    <td className="p-3">
                      <div className="flex flex-col gap-1 max-w-[240px]">
                        <span
                          className="font-bold text-gray-900 dark:text-white truncate"
                          title={clientName}
                        >
                          {clientName}
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {clientRfc ? (
                            <button
                              type="button"
                              onClick={() => {
                                setRfcFilter(clientRfc);
                                setPage(0);
                              }}
                              className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
                              title={`Filtrar todas las facturas del RFC ${clientRfc}`}
                            >
                              <span>RFC:</span>
                              <span>{clientRfc}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                              Sin RFC asignado
                            </span>
                          )}

                          {/* Botón rápido para Ligar / Reasignar por RFC */}
                          <button
                            type="button"
                            onClick={() => handleOpenRfcModal(f)}
                            className="p-0.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors cursor-pointer"
                            title="Ligar o cambiar cliente por RFC"
                          >
                            <Link2 size={12} />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Pedido */}
                    <td className="p-3">
                      {f.pedidos ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          #PED-{f.pedidos.numero_pedido || f.pedidos.id.substring(0, 5)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic font-medium">
                          Directa (Sin Pedido)
                        </span>
                      )}
                    </td>

                    {/* Forma de Pago / SAT */}
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5 text-[10px]">
                        <span className="text-gray-700 dark:text-gray-300 font-medium truncate max-w-[130px]">
                          {f.formas_pago?.codigo
                            ? `${f.formas_pago.codigo} - ${f.formas_pago.nombre}`
                            : '03 - Transferencia'}
                        </span>
                        {f.uso_cfdi_clave && (
                          <span className="text-gray-400 font-mono text-[9px]">
                            Uso: {f.uso_cfdi_clave}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Subtotal */}
                    <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400 text-xs">
                      {formatCurrency(subtotalVal)}
                    </td>

                    {/* IVA */}
                    <td className="p-3 text-right font-mono text-gray-500 dark:text-gray-400 text-xs">
                      {formatCurrency(ivaVal)}
                    </td>

                    {/* Total */}
                    <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-xs whitespace-nowrap">
                      {formatCurrency(totalVal)}
                    </td>

                    {/* Estatus */}
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 size={10} /> {estatusNombre}
                      </span>
                    </td>

                    {/* Documentos & Acciones */}
                    <td className="p-3 pr-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Ver CFDI */}
                        {hasXml && (
                          <button
                            type="button"
                            onClick={() => handleViewCfdi(f.xml_url)}
                            className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                            title="Visualizar CFDI interactivo"
                          >
                            <Eye size={14} />
                          </button>
                        )}

                        {/* Descargar XML */}
                        {hasXml ? (
                          <button
                            type="button"
                            onClick={() => onDownloadFile(f.xml_url)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                            title="Descargar archivo XML SAT"
                          >
                            XML
                          </button>
                        ) : (
                          <span className="text-[9px] text-gray-400 italic">No XML</span>
                        )}

                        {/* Descargar PDF */}
                        {hasPdf ? (
                          <button
                            type="button"
                            onClick={() => onDownloadFile(f.pdf_url)}
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors cursor-pointer"
                            title="Descargar representación impresa PDF"
                          >
                            PDF
                          </button>
                        ) : (
                          <span className="text-[9px] text-gray-400 italic">No PDF</span>
                        )}

                        {/* Enviar Correo */}
                        {f.pedido_id && onSendEmail && (
                          <button
                            type="button"
                            onClick={() => onSendEmail(f.pedido_id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                            title="Enviar factura al correo del cliente"
                          >
                            <Mail size={13} />
                          </button>
                        )}

                        {/* Eliminar */}
                        {onDeleteFactura && (
                          <button
                            type="button"
                            onClick={() => onDeleteFactura(f.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            title="Eliminar factura"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* FOOTER CON PAGINACIÓN */}
      <div className="p-3 md:px-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between text-xs text-gray-500 shrink-0">
        <div className="flex items-center gap-2">
          <span>Mostrando</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="px-2 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} por pág.
              </option>
            ))}
          </select>
          <span>de {facturasFiltradas.length} facturas</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-400">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: LIGAR / CAMBIAR CLIENTE POR RFC */}
      {rfcModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-gray-900 dark:text-white space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Link2 size={18} />
                </span>
                <h4 className="font-extrabold text-sm">Ligar Factura por RFC</h4>
              </div>
              <button
                onClick={() => setRfcModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p>
                Factura:{' '}
                <strong className="text-gray-800 dark:text-gray-200">
                  {rfcModal.factura?.serie_folio || rfcModal.factura?.uuid_fiscal?.substring(0, 8)}
                </strong>{' '}
                — Importe: <strong>{formatCurrency(rfcModal.factura?.total || 0)}</strong>
              </p>
              <p>
                Asocia esta factura emitida a un cliente existente o nuevo a través de su{' '}
                <strong>RFC de receptor</strong>.
              </p>
            </div>

            {rfcModal.error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
                {rfcModal.error}
              </div>
            )}

            <form onSubmit={handleGuardarRfcVinculacion} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                  RFC del Cliente / Receptor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. XAXX010101000"
                  value={rfcModal.rfcInput}
                  onChange={(e) => setRfcModal((prev) => ({ ...prev, rfcInput: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Selector de sugerencias de clientes existentes */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                  O seleccionar cliente del catálogo:
                </label>
                <select
                  onChange={(e) => {
                    const selectedCli = clientes.find((c) => c.id === e.target.value);
                    if (selectedCli) {
                      setRfcModal((prev) => ({
                        ...prev,
                        rfcInput: (selectedCli.rfc || '').toUpperCase(),
                        nombreInput: selectedCli.nombre_local || selectedCli.razon_social || ''
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">-- Seleccionar cliente existente --</option>
                  {clientes
                    .filter((c) => !!c.rfc)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre_local || c.razon_social} ({c.rfc})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                  Nombre Comercial o Razón Social (si es nuevo)
                </label>
                <input
                  type="text"
                  placeholder="Ej. Comercializadora del Caribe S.A."
                  value={rfcModal.nombreInput}
                  onChange={(e) => setRfcModal((prev) => ({ ...prev, nombreInput: e.target.value }))}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRfcModal((prev) => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={rfcModal.loading}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {rfcModal.loading ? 'Vinculando...' : 'Ligar Cliente por RFC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CARGA MASIVA DE XML DE VENTAS */}
      {showXmlModal && (
        <CargaXmlMasivaModal
          onClose={() => setShowXmlModal(false)}
          onSuccess={() => {
            setShowXmlModal(false);
            onRefresh();
          }}
          tipo="venta"
          empresaRfc={empresaRfc}
        />
      )}

      {/* MODAL: CARGA MANUAL DE FACTURAS DE VENTA */}
      {showManualModal && (
        <CargaManualModal
          tipo="venta"
          empresaRfc={empresaRfc}
          onClose={() => setShowManualModal(false)}
          onSuccess={() => {
            setShowManualModal(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
