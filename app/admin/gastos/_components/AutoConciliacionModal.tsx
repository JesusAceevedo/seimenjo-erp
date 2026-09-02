'use client';

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Building2,
  Receipt,
  CreditCard,
  Calendar,
  Layers,
  Search,
  CheckSquare,
  Square,
  FileText,
  SlidersHorizontal,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Clock,
  Tag
} from 'lucide-react';
import { PropuestaConciliacionItem } from '../reconciliationActions';

interface AutoConciliacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  propuestas: PropuestaConciliacionItem[];
  loading: boolean;
  isApplying: boolean;
  onApply: (selectedPropuestas: PropuestaConciliacionItem[]) => Promise<void>;
  onAdjustManual?: (movimiento: any) => void;
  onDownloadFile?: (url: string) => void;
}

export default function AutoConciliacionModal({
  isOpen,
  onClose,
  propuestas,
  loading,
  isApplying,
  onApply,
  onAdjustManual,
  onDownloadFile
}: AutoConciliacionModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => propuestas.map(p => p.id));
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'retiros' | 'depositos' | 'efectivo'>('todos');
  const [filtroConfianza, setFiltroConfianza] = useState<'todas' | 'exacta' | 'alta' | 'media'>('todas');
  const [busqueda, setBusqueda] = useState('');

  // Sincronizar selección inicial cuando cambian las propuestas
  React.useEffect(() => {
    if (propuestas && propuestas.length > 0) {
      setSelectedIds(propuestas.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  }, [propuestas]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Sin fecha';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
      return new Date(dateStr).toLocaleDateString('es-MX');
    } catch {
      return dateStr;
    }
  };

  // Filtrado de propuestas
  const propuestasFiltradas = useMemo(() => {
    return propuestas.filter(p => {
      // Filtro Tipo
      if (filtroTipo === 'retiros' && p.tipo !== 'retiro_gasto') return false;
      if (filtroTipo === 'depositos' && p.tipo !== 'deposito_pedido') return false;
      if (filtroTipo === 'efectivo' && p.tipo !== 'retiro_efectivo') return false;

      // Filtro Confianza
      if (filtroConfianza !== 'todas' && p.confianza !== filtroConfianza) return false;

      // Búsqueda
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const concepto = (p.movimiento.concepto || '').toLowerCase();
        const ref = (p.movimiento.referencia || '').toLowerCase();
        const prov = (p.coincidencia?.proveedor_nombre || '').toLowerCase();
        const rfcProv = (p.coincidencia?.proveedor_rfc || '').toLowerCase();
        const cli = (p.coincidencia?.cliente_nombre || '').toLowerCase();
        const folio = (p.coincidencia?.folio_factura || '').toLowerCase();
        const uuid = (p.coincidencia?.uuid_fiscal || '').toLowerCase();
        const montoStr = p.movimiento.monto.toString();

        const match =
          concepto.includes(q) ||
          ref.includes(q) ||
          prov.includes(q) ||
          rfcProv.includes(q) ||
          cli.includes(q) ||
          folio.includes(q) ||
          uuid.includes(q) ||
          montoStr.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [propuestas, filtroTipo, filtroConfianza, busqueda]);

  const toggleSelectAll = () => {
    const idsVisibles = propuestasFiltradas.map(p => p.id);
    const allSelected = idsVisibles.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !idsVisibles.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...idsVisibles])));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const propuestasSeleccionadas = useMemo(() => {
    return propuestas.filter(p => selectedIds.includes(p.id));
  }, [propuestas, selectedIds]);

  const totalMontoRetiros = useMemo(() => {
    return propuestasSeleccionadas
      .filter(p => p.movimiento.tipo_movimiento === 'Retiro')
      .reduce((sum, p) => sum + p.movimiento.monto, 0);
  }, [propuestasSeleccionadas]);

  const totalMontoDepositos = useMemo(() => {
    return propuestasSeleccionadas
      .filter(p => p.movimiento.tipo_movimiento === 'Deposito')
      .reduce((sum, p) => sum + p.movimiento.monto, 0);
  }, [propuestasSeleccionadas]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-gray-900 dark:text-gray-100">
        
        {/* ENCABEZADO */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-emerald-600/10 via-teal-600/5 to-transparent shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-md">
                <Sparkles size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black tracking-tight">Propuestas de Auto-Conciliación</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    {propuestas.length} {propuestas.length === 1 ? 'coincidencia' : 'coincidencias'}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Revisa y valida la comparación entre transferencias bancarias y facturas/gastos antes de conciliar.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isApplying}
              className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-850 transition-colors"
              title="Cerrar modal"
            >
              <XCircle size={22} />
            </button>
          </div>

          {/* BARRA RESUMEN DE SELECCIÓN Y KPIS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-200/60 dark:border-gray-800/60">
            <div className="bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="text-emerald-500" size={18} />
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Seleccionadas:</span>
              </div>
              <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                {selectedIds.length} <span className="text-xs text-gray-400 font-normal">/ {propuestas.length}</span>
              </span>
            </div>

            <div className="bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Egresos (Retiros):</span>
              <span className="text-sm font-black font-mono text-red-600 dark:text-red-400">
                {formatCurrency(totalMontoRetiros)}
              </span>
            </div>

            <div className="bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 p-3 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Total Ingresos (Depósitos):</span>
              <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalMontoDepositos)}
              </span>
            </div>
          </div>
        </div>

        {/* BARRA DE HERRAMIENTAS Y FILTROS */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-1.5 transition-colors shadow-sm"
            >
              {propuestasFiltradas.length > 0 &&
              propuestasFiltradas.every(p => selectedIds.includes(p.id)) ? (
                <>
                  <Square size={14} className="text-gray-500" />
                  <span>Deseleccionar Visibles</span>
                </>
              ) : (
                <>
                  <CheckSquare size={14} className="text-emerald-500" />
                  <span>Seleccionar Todos ({propuestasFiltradas.length})</span>
                </>
              )}
            </button>

            {/* Píldoras de tipo */}
            <div className="flex items-center bg-gray-200/80 dark:bg-gray-800/80 p-0.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setFiltroTipo('todos')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroTipo === 'todos'
                    ? 'bg-white dark:bg-gray-950 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Todos ({propuestas.length})
              </button>
              <button
                onClick={() => setFiltroTipo('retiros')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroTipo === 'retiros'
                    ? 'bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Egresos ({propuestas.filter(p => p.tipo === 'retiro_gasto').length})
              </button>
              <button
                onClick={() => setFiltroTipo('depositos')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroTipo === 'depositos'
                    ? 'bg-white dark:bg-gray-950 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Ingresos ({propuestas.filter(p => p.tipo === 'deposito_pedido').length})
              </button>
              <button
                onClick={() => setFiltroTipo('efectivo')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filtroTipo === 'efectivo'
                    ? 'bg-white dark:bg-gray-950 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Efectivo ({propuestas.filter(p => p.tipo === 'retiro_efectivo').length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-[240px]">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por concepto, proveedor, folio..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* LISTADO DE PROPUESTAS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gray-100/50 dark:bg-gray-900/40">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-gray-500">Buscando coincidencias inteligentes...</p>
            </div>
          ) : propuestasFiltradas.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-gray-300 dark:border-gray-800 rounded-3xl p-8 bg-white dark:bg-gray-950">
              <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
                No hay propuestas pendientes bajo los filtros seleccionados
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                No se encontraron movimientos pendientes que coincidan de forma automática con facturas o pedidos disponibles.
              </p>
            </div>
          ) : (
            propuestasFiltradas.map((propuesta, idx) => {
              const isSelected = selectedIds.includes(propuesta.id);
              const isRetiro = propuesta.movimiento.tipo_movimiento === 'Retiro';
              const hasDiscrepancia = propuesta.discrepancia?.tieneDiscrepancia;

              return (
                <div
                  key={propuesta.id}
                  onClick={() => toggleSelect(propuesta.id)}
                  className={`border rounded-2xl p-4 sm:p-5 transition-all cursor-pointer relative select-none ${
                    isSelected
                      ? 'bg-white dark:bg-gray-950 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/20'
                      : 'bg-white/60 dark:bg-gray-950/60 border-gray-200 dark:border-gray-800/80 opacity-70 hover:opacity-100'
                  }`}
                >
                  {/* CABECERA DE LA FILA: CHECKBOX + TIPO + CONFIANZA */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-850 gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by parent div
                        className="w-4 h-4 text-emerald-600 rounded border-gray-300 dark:border-gray-700 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                        Propuesta #{idx + 1}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full font-mono ${
                          propuesta.tipo === 'retiro_efectivo'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : isRetiro
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}
                      >
                        {propuesta.tipo === 'retiro_efectivo'
                          ? 'Efectivo'
                          : isRetiro
                          ? 'Egreso / Factura'
                          : 'Ingreso / Venta'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Badge de Confianza */}
                      <div
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          propuesta.confianza === 'exacta'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : propuesta.confianza === 'alta'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                        }`}
                        title={propuesta.motivoConfianza}
                      >
                        <Sparkles size={11} />
                        <span>{propuesta.motivoConfianza}</span>
                      </div>

                      {/* Botón de ajuste manual individual */}
                      {onAdjustManual && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAdjustManual(propuesta.movimiento.rawMovimiento || propuesta.movimiento);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-800/60 transition-colors flex items-center gap-1"
                          title="Abrir conciliación manual para seleccionar otra factura o ajustar"
                        >
                          <SlidersHorizontal size={12} />
                          <span>Corregir / Cambiar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* CUERPO COMPARATIVO LADO A LADO */}
                  <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-center">
                    
                    {/* LADO IZQUIERDO: MOVIMIENTO BANCARIO */}
                    <div className="lg:col-span-5 bg-gray-50/80 dark:bg-gray-900/60 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                          <Building2 size={13} className="text-gray-400" />
                          <span>Movimiento Bancario</span>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono">
                          {propuesta.movimiento.cuenta_nombre || 'Banco'}
                        </span>
                      </div>

                      <div className="pt-1">
                        <p className="text-xs font-extrabold text-gray-900 dark:text-white leading-snug line-clamp-2">
                          {propuesta.movimiento.concepto}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200/40 dark:border-gray-800/40 text-[11px]">
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold">Fecha Banco:</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <Calendar size={11} className="text-gray-400" />
                            {formatDate(propuesta.movimiento.fecha)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 block text-[10px] uppercase font-bold">Importe Banco:</span>
                          <span
                            className={`font-black font-mono text-sm ${
                              isRetiro ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {formatCurrency(propuesta.movimiento.monto)}
                          </span>
                        </div>
                      </div>

                      {propuesta.movimiento.referencia && (
                        <div className="text-[10px] text-gray-400 font-mono">
                          Ref: <span className="text-gray-600 dark:text-gray-300">{propuesta.movimiento.referencia}</span>
                        </div>
                      )}
                    </div>

                    {/* CONECTOR CENTRAL */}
                    <div className="lg:col-span-1 flex flex-col items-center justify-center py-1 gap-1">
                      <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                        <ArrowRight size={16} />
                      </div>
                      {propuesta.diasDiferencia !== undefined && (
                        <span className="text-[9px] font-bold text-gray-400 font-mono">
                          {propuesta.diasDiferencia === 0
                            ? 'Mismo día'
                            : `${Math.abs(propuesta.diasDiferencia)}d diff`}
                        </span>
                      )}
                      {propuesta.diferenciaMonto !== undefined && propuesta.diferenciaMonto > 0.05 && (
                        <span className="text-[9px] font-extrabold text-amber-700 dark:text-amber-300 font-mono bg-amber-100 dark:bg-amber-950/70 px-1.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800/80 text-center leading-tight">
                          Dif: ±{formatCurrency(propuesta.diferenciaMonto)}
                        </span>
                      )}
                    </div>

                    {/* LADO DERECHO: FACTURA / GASTO / PEDIDO */}
                    <div className="lg:col-span-5 bg-gray-50/80 dark:bg-gray-900/60 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                          <Receipt size={13} className="text-gray-400" />
                          <span>{propuesta.tipo === 'deposito_pedido' ? 'Pedido / Cliente' : 'Factura / Proveedor'}</span>
                        </div>
                        {propuesta.coincidencia?.folio_factura && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-mono border border-blue-200 dark:border-blue-800/40">
                            Folio: {propuesta.coincidencia.folio_factura}
                          </span>
                        )}
                      </div>

                      <div className="pt-1">
                        <p className="text-xs font-extrabold text-gray-900 dark:text-white truncate">
                          {propuesta.coincidencia?.proveedor_nombre || propuesta.coincidencia?.cliente_nombre || 'Sin nombre registrado'}
                        </p>
                        {propuesta.coincidencia?.proveedor_rfc && (
                          <p className="text-[10px] font-mono text-gray-400">
                            RFC: {propuesta.coincidencia.proveedor_rfc}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-200/40 dark:border-gray-800/40 text-[11px]">
                        <div>
                          <span className="text-gray-400 block text-[10px] uppercase font-bold">Fecha Documento:</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                            <Calendar size={11} className="text-gray-400" />
                            {formatDate(propuesta.coincidencia?.fecha_documento)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 block text-[10px] uppercase font-bold">Importe Documento:</span>
                          <span className="font-black font-mono text-sm text-gray-900 dark:text-white">
                            {formatCurrency(propuesta.coincidencia?.monto || 0)}
                          </span>
                        </div>
                      </div>

                      {/* INFORMACIÓN ADICIONAL: MÉTODO DE PAGO Y CATEGORÍA */}
                      <div className="flex items-center justify-between text-[10px] pt-1 text-gray-500 dark:text-gray-400 flex-wrap gap-1">
                        <div className="flex items-center gap-1">
                          <CreditCard size={11} className="text-gray-400" />
                          <span>Método: <strong>{propuesta.coincidencia?.metodo_pago || 'No especificado'}</strong></span>
                        </div>

                        {propuesta.coincidencia?.categoria_nombre && (
                          <div className="flex items-center gap-1">
                            <Tag size={10} className="text-gray-400" />
                            <span>{propuesta.coincidencia.categoria_nombre}</span>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* ALERTA DE DISCREPANCIA FISCAL */}
                  {hasDiscrepancia && (
                    <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                      <AlertTriangle size={15} className="shrink-0 text-amber-500" />
                      <span>{propuesta.discrepancia?.detalle}</span>
                    </div>
                  )}

                  {/* ALTERNATIVAS DISPONIBLES */}
                  {propuesta.alternativas && propuesta.alternativas.length > 0 && (
                    <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1.5">
                      <HelpCircle size={11} className="text-indigo-400" />
                      <span>
                        Se encontraron <strong>{propuesta.alternativas.length}</strong> facturas/pedidos adicionales con monto similar.
                        Puedes usar "Corregir / Cambiar" si deseas elegir una alternativa.
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* PIE DEL MODAL CON BOTONES DE ACCIÓN */}
        <div className="p-4 sm:p-5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {selectedIds.length === 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                Selecciona al menos una propuesta para aplicar la conciliación.
              </span>
            ) : (
              <span>
                Se aplicarán <strong>{selectedIds.length}</strong> conciliaciones seleccionadas.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-850 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => onApply(propuestasSeleccionadas)}
              disabled={selectedIds.length === 0 || isApplying}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              {isApplying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Aplicando Conciliaciones...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Aplicar {selectedIds.length} Conciliaciones</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
