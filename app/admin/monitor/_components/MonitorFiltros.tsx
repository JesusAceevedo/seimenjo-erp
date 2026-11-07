'use client';

import React, { useState } from 'react';
import {
  Filter,
  Search,
  X,
  FileSpreadsheet,
  RotateCcw,
  Clock,
  Layers,
  FileCheck,
  CreditCard,
  Truck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import DateRangeCalendarPicker from './DateRangeCalendarPicker';
import { Pedido } from '../../types';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { getMetodoPagoLabel } from '@/lib/constants/sat';

export type FiltroTiempoPreset = 'mes_actual' | 'semana' | 'mes_anterior' | 'rango' | 'todo';
export type FiltroOperativo = 'todos' | 'Pendiente' | 'Entregado' | 'Cancelado';
export type FiltroFactura = 'todos' | 'facturado' | 'sin_facturar';
export type FiltroPago = 'todos' | 'Pendiente' | 'Liquidado';

interface MonitorFiltrosProps {
  filtroRango: FiltroTiempoPreset;
  setFiltroRango: (val: FiltroTiempoPreset) => void;
  fechaInicio: string;
  setFechaInicio: (val: string) => void;
  fechaFin: string;
  setFechaFin: (val: string) => void;
  busquedaGlobal: string;
  setBusquedaGlobal: (val: string) => void;
  filtroOperativo: FiltroOperativo;
  setFiltroOperativo: (val: FiltroOperativo) => void;
  filtroFactura: FiltroFactura;
  setFiltroFactura: (val: FiltroFactura) => void;
  filtroPago: FiltroPago;
  setFiltroPago: (val: FiltroPago) => void;
  pedidosFiltrados: Pedido[];
  totalPedidosCargados: number;
  onResetFiltros: () => void;
}

export default function MonitorFiltros({
  filtroRango,
  setFiltroRango,
  fechaInicio,
  setFechaInicio,
  fechaFin,
  setFechaFin,
  busquedaGlobal,
  setBusquedaGlobal,
  filtroOperativo,
  setFiltroOperativo,
  filtroFactura,
  setFiltroFactura,
  filtroPago,
  setFiltroPago,
  pedidosFiltrados,
  totalPedidosCargados,
  onResetFiltros,
}: MonitorFiltrosProps) {
  const [isExporting, setIsExporting] = useState(false);

  // Determinar si hay filtros activos fuera del predeterminado
  const hayFiltrosActivos =
    filtroRango !== 'mes_actual' ||
    filtroOperativo !== 'todos' ||
    filtroFactura !== 'todos' ||
    filtroPago !== 'todos' ||
    busquedaGlobal.trim() !== '' ||
    fechaInicio !== '' ||
    fechaFin !== '';

  // Calcular suma del importe filtrado
  const totalMontoFiltrado = pedidosFiltrados.reduce((acc, p) => acc + (Number(p.precio_total) || 0), 0);

  // Función de exportación a Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      setIsExporting(true);

      const filas = pedidosFiltrados.map((p) => {
        const facRel = Array.isArray(p.facturas_clientes) ? p.facturas_clientes[0] : p.facturas_clientes;
        const folioFactura = p.folio_factura || facRel?.serie_folio || 'Sin Factura';

        // Concatenar detalles de productos
        let resumenProductos = 'Sin productos';
        if (p.pedido_detalles && p.pedido_detalles.length > 0) {
          resumenProductos = p.pedido_detalles
            .map((d: any) => {
              const pv = Array.isArray(d?.producto_variantes) ? d.producto_variantes[0] : d?.producto_variantes;
              const prod = Array.isArray(pv?.productos) ? pv.productos[0] : pv?.productos;
              const nombre = prod?.nombre || d?.producto_nombre || d?.comentarios || 'Producto';
              const gramaje = pv?.gramaje ? ` (${pv.gramaje})` : '';
              return `${nombre}${gramaje}: ${d.cantidad || 0} un.`;
            })
            .join(' | ');
        }

        return {
          '# Pedido': p.numero_pedido || p.id.split('-')[0],
          'Cliente': p.clientes?.nombre_local || p.cliente_nombre || 'Ocasional',
          'RFC': p.clientes?.rfc || 'N/A',
          'Fecha Pedido': formatDate(p.fecha_pedido),
          'Fecha Producción': p.fecha_produccion ? formatDate(p.fecha_produccion) : 'N/A',
          'Fecha Entrega': p.fecha_entrega ? formatDate(p.fecha_entrega) : 'N/A',
          'Detalle de Carga': resumenProductos,
          'Repartidor': p.entregado_por || 'N/A',
          'Costo Envío ($)': Number(p.costo_envio || 0),
          'Total ($)': Number(p.precio_total || 0),
          'Estatus Operativo': p.estatus_pedido || 'Pendiente',
          'Estatus Cobro': p.estatus_pago || 'Pendiente',
          'Método Pago': getMetodoPagoLabel(p.metodo_pago),
          'Folio Factura': folioFactura
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(filas);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos');

      // Anchos de columna automáticos sugeridos
      worksheet['!cols'] = [
        { wch: 12 }, // Pedido
        { wch: 28 }, // Cliente
        { wch: 15 }, // RFC
        { wch: 14 }, // Fecha Pedido
        { wch: 16 }, // Fecha Prod
        { wch: 16 }, // Fecha Ent
        { wch: 35 }, // Detalle
        { wch: 18 }, // Repartidor
        { wch: 14 }, // Envio
        { wch: 14 }, // Total
        { wch: 16 }, // Operativo
        { wch: 14 }, // Cobro
        { wch: 18 }, // Metodo
        { wch: 18 }, // Folio
      ];

      const fechaHoy = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `pedidos_${filtroRango}_${fechaHoy}.xlsx`);
    } catch (err) {
      console.error('Error al exportar a Excel:', err);
      alert('Ocurrió un error al generar el archivo Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-md mb-6 space-y-3 font-sans">
      {/* FILA 1: Presets de Fecha + Buscador + Exportar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Presets de Tiempo */}
        <div className="flex items-center flex-wrap gap-1.5 bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setFiltroRango('mes_actual');
              setFechaInicio('');
              setFechaFin('');
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filtroRango === 'mes_actual'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Mes actual
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroRango('semana');
              setFechaInicio('');
              setFechaFin('');
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filtroRango === 'semana'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Semanal
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroRango('mes_anterior');
              setFechaInicio('');
              setFechaFin('');
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filtroRango === 'mes_anterior'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Mes anterior
          </button>

          <button
            type="button"
            onClick={() => setFiltroRango('rango')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filtroRango === 'rango'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Personalizado
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroRango('todo');
              setFechaInicio('');
              setFechaFin('');
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filtroRango === 'todo'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Todo
          </button>
        </div>

        {/* Si está en Rango Personalizado, renderiza el Calendario Visual Interactivo */}
        {filtroRango === 'rango' && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <DateRangeCalendarPicker
              fechaInicio={fechaInicio}
              fechaFin={fechaFin}
              onChange={(inicio, fin) => {
                setFechaInicio(inicio);
                setFechaFin(fin);
              }}
            />
          </div>
        )}

        {/* Buscador Universal + Botón Exportar */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px] justify-end">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por monto ($), # pedido, cliente, RFC o folio..."
              value={busquedaGlobal}
              onChange={(e) => setBusquedaGlobal(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-800 rounded-xl text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-gray-400 text-xs sm:text-sm"
            />
            {busquedaGlobal && (
              <button
                type="button"
                onClick={() => setBusquedaGlobal('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting || pedidosFiltrados.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
            title="Exportar pedidos filtrados a hoja de Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* FILA 2: Estatus Operativo, Estatus Factura, Estatus Cobro y Botón Limpiar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* Estatus Operativo */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Operación:</span>
            <div className="flex items-center bg-gray-100 dark:bg-gray-900 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setFiltroOperativo('todos')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  filtroOperativo === 'todos'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroOperativo('Pendiente')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filtroOperativo === 'Pendiente'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                🟡 Pendientes
              </button>
              <button
                type="button"
                onClick={() => setFiltroOperativo('Entregado')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filtroOperativo === 'Entregado'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                🔵 Entregados
              </button>
              <button
                type="button"
                onClick={() => setFiltroOperativo('Cancelado')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filtroOperativo === 'Cancelado'
                    ? 'bg-gray-600 text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                ⚪ Cancelados
              </button>
            </div>
          </div>

          {/* Estatus Facturación */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Factura:</span>
            <div className="flex items-center bg-gray-100 dark:bg-gray-900 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setFiltroFactura('todos')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  filtroFactura === 'todos'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setFiltroFactura('facturado')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filtroFactura === 'facturado'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <FileCheck size={13} /> Facturados
              </button>
              <button
                type="button"
                onClick={() => setFiltroFactura('sin_facturar')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filtroFactura === 'sin_facturar'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Sin Facturar
              </button>
            </div>
          </div>

          {/* Estatus Cobranza */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Cobranza:</span>
            <div className="flex items-center bg-gray-100 dark:bg-gray-900 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setFiltroPago('todos')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  filtroPago === 'todos'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroPago('Pendiente')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filtroPago === 'Pendiente'
                    ? 'bg-red-500 text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                🔴 Por Cobrar
              </button>
              <button
                type="button"
                onClick={() => setFiltroPago('Liquidado')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  filtroPago === 'Liquidado'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                🟢 Liquidados
              </button>
            </div>
          </div>
        </div>

        {/* Resumen dinámico y Botón Reset */}
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Mostrando <span className="font-bold text-gray-900 dark:text-white">{pedidosFiltrados.length}</span> pedidos
            <span className="mx-1">•</span>
            Total: <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{formatCurrency(totalMontoFiltrado)}</span>
          </div>

          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={onResetFiltros}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer border border-amber-300 dark:border-amber-800"
              title="Restablecer todos los filtros a su estado inicial"
            >
              <RotateCcw size={13} />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

