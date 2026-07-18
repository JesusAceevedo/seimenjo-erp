'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import CargaManualModal from '../gastos/_components/CargaManualModal';
import { Plus, Tag } from 'lucide-react';
import {
  FileText, FileCode, CheckCircle, AlertTriangle, XCircle, Search, Calendar,
  Download, RefreshCw, Layers, DollarSign, CreditCard
} from 'lucide-react';
import DocumentViewer from '../_components/DocumentViewer';
import Pagination from '../_components/Pagination';
import PeriodSelector from '../_components/PeriodSelector';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';

interface ExpedienteItem {
  id: string;
  tipo: 'Egreso' | 'Ingreso' | 'Movimiento';
  fecha: string;
  concepto: string;
  monto: number;
  uuid_fiscal?: string;
  xml_url?: string;
  pdf_url?: string;
  ticket_url?: string;
  soporte_reembolso_url?: string;
  statusColor: 'green' | 'yellow' | 'red';
  statusLabel: string;
  reconciliado: boolean;
}

export default function ExpedienteDigital() {
  const getEmpresaId = useEmpresaId();
  const { selectedMonth, periodStatus, refreshPeriodStatus } = usePeriod();

  const [items, setItems] = useState<ExpedienteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterEstatus, setFilterEstatus] = useState('todos');
  const [filterConciliado, setFilterConciliado] = useState('todos');
  
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 25;
  
  const [manualModal, setManualModal] = useState<{isOpen: boolean, id?: string, tipo?: 'gasto'|'venta'|'movimiento'}>({isOpen: false});
  const [viewer, setViewer] = useState<{ open: boolean; title: string; docs: any[] }>({
    open: false, title: '', docs: []
  });
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = (itemKey: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  useEffect(() => {
    setSelectedIds(new Set());
    setCurrentPage(0);
  }, [filterTipo, filterEstatus, filterConciliado, search]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      const periodStart = selectedMonth + '-01';
      const year = parseInt(selectedMonth.substring(0, 4));
      const month = parseInt(selectedMonth.substring(5, 7));
      const lastDay = new Date(year, month, 0).getDate();
      const periodEnd = selectedMonth + '-' + String(lastDay).padStart(2, '0');

      // 1. Fetch Gastos
      const { data: gastos } = await supabase
        .from('gastos')
        .select('id, fecha_gasto, concepto, monto, xml_url, pdf_url, ticket_url, uuid_fiscal, gasto_padre_id, soporte_reembolso_url, es_deducible, movimiento_bancario_id, proveedor_id, proveedores(nombre_comercial)')
        .eq('empresa_id', empresaId)
        .gte('fecha_gasto', periodStart)
        .lte('fecha_gasto', periodEnd)
        .order('fecha_gasto', { ascending: false });

      // 2. Fetch Ingresos (Facturas)
      const { data: ingresos } = await supabase
        .from('facturas_clientes')
        .select('id, fecha_emision, serie_folio, total, xml_url, pdf_url, ticket_url, pedido_id, pedidos(movimiento_bancario_id), cliente_id, clientes(nombre_local)')
        .eq('empresa_id', empresaId)
        .gte('fecha_emision', periodStart)
        .lte('fecha_emision', periodEnd)
        .order('fecha_emision', { ascending: false });

      // 3. Fetch Movimientos Bancarios
      const { data: movimientos } = await supabase
        .from('movimientos_bancarios')
        .select('id, fecha, concepto, monto, xml_url, pdf_factura_url, pdf_ticket_url, soporte_reembolso_url, estatus_conciliacion_bancaria(clave), categorias_movimiento_bancario(requiere_comprobante)')
        .eq('empresa_id', empresaId)
        .gte('fecha', periodStart)
        .lte('fecha', periodEnd)
        .order('fecha', { ascending: false });

      const allItems: ExpedienteItem[] = [];

      // Procesar Gastos con Agrupación de Parcialidades
      const gastosMap = new Map<string, any>();
      (gastos || []).forEach((g: any) => {
        gastosMap.set(g.id, {
          ...g,
          xmlUrls: g.xml_url ? [g.xml_url] : [],
          pdfUrls: g.pdf_url ? [g.pdf_url] : [],
          ticketUrls: g.ticket_url ? [g.ticket_url] : [],
          soporteReembolsoUrls: g.soporte_reembolso_url ? [g.soporte_reembolso_url] : [],
        });
      });

      // Asociar archivos de parcialidades al gasto padre
      (gastos || []).forEach((g: any) => {
        if (g.gasto_padre_id) {
          const parent = gastosMap.get(g.gasto_padre_id);
          if (parent) {
            if (g.xml_url) parent.xmlUrls.push(g.xml_url);
            if (g.pdf_url) parent.pdfUrls.push(g.pdf_url);
            if (g.ticket_url) parent.ticketUrls.push(g.ticket_url);
            if (g.soporte_reembolso_url) parent.soporteReembolsoUrls.push(g.soporte_reembolso_url);
          }
        }
      });

      // Filtrar y procesar solo gastos padres (evitando duplicar contadores y filas)
      const parentGastos = Array.from(gastosMap.values()).filter(g => !g.gasto_padre_id);

      parentGastos.forEach((g: any) => {
        // Unificar y limpiar URLs
        const xml_url = Array.from(new Set(g.xmlUrls.filter(Boolean))).join(',');
        const pdf_url = Array.from(new Set(g.pdfUrls.filter(Boolean))).join(',');
        const ticket_url = Array.from(new Set(g.ticketUrls.filter(Boolean))).join(',');
        const soporte_reembolso_url = Array.from(new Set(g.soporteReembolsoUrls.filter(Boolean))).join(',');

        const missing = [];
        const hasSoporte = !!soporte_reembolso_url;
        const isDeducible = g.es_deducible !== false;

        if (!hasSoporte) {
          if (isDeducible) {
            if (!xml_url) missing.push('XML');
            if (!pdf_url && !xml_url) missing.push('PDF');
            if (ticket_url !== 'no_lleva' && !ticket_url) missing.push('Ticket');
          } else {
            if (ticket_url !== 'no_lleva' && !ticket_url) missing.push('Ticket');
          }
        }
        
        let color: 'green' | 'yellow' | 'red' = 'green';
        let label = 'Completo';
        
        if (hasSoporte) {
          color = 'green';
          label = 'Completo (Reembolso)';
        } else if (ticket_url === 'no_lleva' && missing.length === 0) {
          color = 'green';
          label = 'Completo (Sin ticket)';
        } else if (missing.length === (isDeducible ? 3 : 1)) {
          color = 'red';
          label = 'Sin Documentos';
        } else if (missing.length > 0) {
          color = 'yellow';
          label = `Falta: ${missing.join(', ')}`;
        }

        allItems.push({
          id: g.id,
          tipo: 'Egreso',
          fecha: g.fecha_gasto || '',
          concepto: g.proveedores?.nombre_comercial || g.concepto || 'Sin concepto',
          monto: Number(g.monto) || 0,
          uuid_fiscal: g.uuid_fiscal,
          xml_url,
          pdf_url,
          ticket_url,
          soporte_reembolso_url,
          statusColor: color,
          statusLabel: label,
          reconciliado: !!g.movimiento_bancario_id
        });
      });

      // Procesar Ingresos
      (ingresos || []).forEach((i: any) => {
        const missing = [];
        if (!i.xml_url) missing.push('XML');
        if (!i.pdf_url && !i.xml_url) missing.push('PDF');
        if (!i.ticket_url) missing.push('Ticket');
        
        let color: 'green' | 'yellow' | 'red' = 'green';
        let label = 'Completo';
        
        if (missing.length === 3) {
          color = 'red';
          label = 'Sin Documentos';
        } else if (missing.length > 0) {
          color = 'yellow';
          label = `Falta: ${missing.join(', ')}`;
        }

        allItems.push({
          id: i.id,
          tipo: 'Ingreso',
          fecha: i.fecha_emision || '',
          concepto: i.clientes?.nombre_local || `Factura ${i.serie_folio || 'S/F'}`,
          monto: Number(i.total) || 0,
          xml_url: i.xml_url,
          pdf_url: i.pdf_url,
          ticket_url: i.ticket_url,
          statusColor: color,
          statusLabel: label,
          reconciliado: i.pedidos ? !!i.pedidos.movimiento_bancario_id : false
        });
      });

      // Procesar Movimientos
      (movimientos || []).forEach((m: any) => {
        let color: 'green' | 'yellow' | 'red' = 'green';
        let label = 'Completo';

        const hasSoporte = !!m.soporte_reembolso_url;

        // Si la categoría indica que no requiere comprobante, lo pasamos directamente como completo.
        if (m.categorias_movimiento_bancario && m.categorias_movimiento_bancario.requiere_comprobante === false) {
          color = 'green';
          label = 'Exento (No Requiere)';
        } else if (hasSoporte) {
          color = 'green';
          label = 'Completo (Reembolso)';
        } else {
          const missing = [];
          if (!m.xml_url) missing.push('XML');
          if (!m.pdf_factura_url && !m.xml_url) missing.push('PDF');
          if (m.pdf_ticket_url !== 'no_lleva' && !m.pdf_ticket_url) missing.push('Ticket');
          
          if (m.pdf_ticket_url === 'no_lleva' && missing.length === 0) {
            color = 'green';
            label = 'Completo (Sin ticket)';
          } else if (missing.length === 3) {
            color = 'red';
            label = 'Sin Documentos';
          } else if (missing.length > 0) {
            color = 'yellow';
            label = `Falta: ${missing.join(', ')}`;
          }
        }

        allItems.push({
          id: m.id,
          tipo: 'Movimiento',
          fecha: m.fecha || '',
          concepto: m.concepto || 'Movimiento Banco',
          monto: Number(m.monto) || 0,
          xml_url: m.xml_url,
          pdf_url: m.pdf_factura_url,
          ticket_url: m.pdf_ticket_url,
          soporte_reembolso_url: m.soporte_reembolso_url,
          statusColor: color,
          statusLabel: label,
          reconciliado: m.estatus_conciliacion_bancaria?.clave !== 'pendiente'
        });
      });

      allItems.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setItems(allItems);

    } catch (error) {
      console.error(error);
      alert('Error cargando expediente');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  const filteredItems = items.filter(item => {
    if (filterTipo !== 'todos' && item.tipo !== filterTipo) return false;
    if (filterEstatus !== 'todos' && item.statusColor !== filterEstatus) return false;
    if (filterConciliado !== 'todos') {
      if (filterConciliado === 'conciliados' && !item.reconciliado) return false;
      if (filterConciliado === 'sin_conciliar' && item.reconciliado) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      const uuidMatch = item.uuid_fiscal?.toLowerCase().includes(s);
      const xmlMatch = item.xml_url?.toLowerCase().includes(s);
      if (!item.concepto.toLowerCase().includes(s) && !String(item.monto).includes(s) && !uuidMatch && !xmlMatch) return false;
    }
    return true;
  });

  const allFilteredKeys = filteredItems.map(item => `${item.tipo}-${item.id}`);
  const isAllSelected = filteredItems.length > 0 && filteredItems.every(item => selectedIds.has(`${item.tipo}-${item.id}`));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredKeys.forEach(key => next.delete(key));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        allFilteredKeys.forEach(key => next.add(key));
        return next;
      });
    }
  };

  const handleOpenViewer = (item: ExpedienteItem) => {
    const docs: {url: string, type: 'pdf' | 'xml' | 'cfdi', label: string}[] = [];
    if (item.xml_url) {
      item.xml_url.split(',').forEach((url, i) => {
        if (url && url !== 'no_lleva') {
          docs.push({ url, type: 'xml', label: `XML ${i + 1}` });
          docs.push({ url, type: 'cfdi', label: `Rep. PDF XML ${i + 1}` });
        }
      });
    }
    if (item.pdf_url) {
      item.pdf_url.split(',').forEach((url, i) => {
        if (url && url !== 'no_lleva') docs.push({ url, type: 'pdf', label: `Factura PDF ${i + 1}` });
      });
    }
    if (item.ticket_url) {
      item.ticket_url.split(',').forEach((url, i) => {
        if (url && url !== 'no_lleva') docs.push({ url, type: 'pdf', label: `Ticket PDF ${i + 1}` });
      });
    }
    if (item.soporte_reembolso_url) {
      item.soporte_reembolso_url.split(',').forEach((url, i) => {
        if (url && url !== 'no_lleva') docs.push({ url, type: 'pdf', label: `Soporte Reembolso ${i + 1}` });
      });
    }
    setViewer({ open: true, title: item.concepto, docs });
  };

  const handleBulkNoTicket = async () => {
    const validSelected = items.filter(item => selectedIds.has(`${item.tipo}-${item.id}`) && (item.tipo === 'Egreso' || item.tipo === 'Movimiento'));
    if (validSelected.length === 0) {
      alert("Selecciona al menos un Egreso o Movimiento para marcar como 'No lleva ticket'.");
      return;
    }
    if (!confirm(`¿Estás seguro de que deseas marcar los ${validSelected.length} elementos seleccionados como 'No lleva ticket'?`)) return;
    
    setLoading(true);
    try {
      const gastosIds = validSelected.filter(i => i.tipo === 'Egreso').map(i => i.id);
      const movimientosIds = validSelected.filter(i => i.tipo === 'Movimiento').map(i => i.id);
      
      if (gastosIds.length > 0) {
        const { error } = await supabase
          .from('gastos')
          .update({ ticket_url: 'no_lleva' })
          .in('id', gastosIds);
        if (error) throw error;
      }
      
      if (movimientosIds.length > 0) {
        const { error } = await supabase
          .from('movimientos_bancarios')
          .update({ pdf_ticket_url: 'no_lleva' })
          .in('id', movimientosIds);
        if (error) throw error;
      }
      
      alert('Elementos actualizados correctamente.');
      setSelectedIds(new Set());
      await fetchData();
    } catch (err: any) {
      alert(`Error al actualizar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickNoTicket = async (id: string, tipo: 'Egreso' | 'Movimiento' | 'Ingreso') => {
    if (!confirm("¿Marcar esta operación como 'No lleva ticket'?")) return;
    setLoading(true);
    try {
      if (tipo === 'Egreso') {
        const { error } = await supabase
          .from('gastos')
          .update({ ticket_url: 'no_lleva' })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('movimientos_bancarios')
          .update({ pdf_ticket_url: 'no_lleva' })
          .eq('id', id);
        if (error) throw error;
      }
      await fetchData();
    } catch (err: any) {
      alert(`Error al actualizar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden font-sans">
      <div className="p-8 pb-4 shrink-0">
        <h2 className="text-3xl font-extrabold flex items-center gap-3 text-gray-900 dark:text-white">
          <Layers className="text-blue-500 w-8 h-8" /> Expediente Digital
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
          Auditoría de integridad documental para Gastos, Ingresos y Movimientos Bancarios.
        </p>

        {periodStatus !== 'abierto' && (
          <div className={`mt-4 p-3 rounded-xl border text-xs font-bold ${
            periodStatus === 'cerrado_definitivo'
              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50'
              : 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900/50'
          }`}>
            Período {selectedMonth} — {periodStatus === 'cerrado_definitivo' ? 'Cerrado Definitivamente (Solo Lectura)' : 'Cerrado (Periodo Bloqueado)'}
          </div>
        )}

        {/* Resumen de Semáforo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle className="text-emerald-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500">Expediente Completo</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{items.filter(i => i.statusColor === 'green').length}</div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <AlertTriangle className="text-yellow-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500">Documentos Faltantes</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{items.filter(i => i.statusColor === 'yellow').length}</div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="text-red-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500">Sin Documentos</div>
              <div className="text-xl font-black text-gray-900 dark:text-white">{items.filter(i => i.statusColor === 'red').length}</div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mt-6 bg-white dark:bg-gray-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Buscar por concepto o monto..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 pl-9 pr-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono" />
          </div>
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-semibold">
            <option value="todos">Todos los Orígenes</option>
            <option value="Egreso">Egresos (Gastos)</option>
            <option value="Ingreso">Ingresos (Ventas)</option>
            <option value="Movimiento">Banco (Movimientos)</option>
          </select>
          <select value={filterEstatus} onChange={e => setFilterEstatus(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-semibold">
            <option value="todos">Todos los Estados</option>
            <option value="green">Completos (Verde)</option>
            <option value="yellow">Faltantes (Amarillo)</option>
            <option value="red">Vacíos (Rojo)</option>
          </select>
          <select value={filterConciliado} onChange={e => setFilterConciliado(e.target.value)}
            className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 px-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 transition-all font-semibold">
            <option value="todos">Todas las Conciliaciones</option>
            <option value="conciliados">Conciliados</option>
            <option value="sin_conciliar">Sin Conciliar</option>
          </select>
          <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
          <button onClick={fetchData} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-md">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 pt-0 overflow-hidden flex flex-col min-h-0">
        {selectedIds.size > 0 && (
          <div className="relative z-50 mb-4 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between shadow-sm animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full text-xs font-black">
                {selectedIds.size} seleccionados
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-400 font-semibold">
                Acciones en lote disponibles para Egresos y Movimientos Bancarios.
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleBulkNoTicket}
                className="relative z-50 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
              >
                Asignar "No lleva ticket"
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="relative z-50 px-3.5 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg text-xs font-bold transition-all"
              >
                Desmarcar todos
              </button>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex-1 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse text-xs min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="p-4 w-24">Tipo</th>
                  <th className="p-4 w-28">Fecha</th>
                  <th className="p-4">Proveedor / Cliente / Detalle</th>
                  <th className="p-4 text-right w-32">Monto</th>
                  <th className="p-4 text-center w-48">Auditoría (Semáforo)</th>
                  <th className="p-4 text-center w-32">Expediente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                {loading && items.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">Cargando expediente...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">No se encontraron registros.</td></tr>
                ) : filteredItems.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((item) => {
                  const itemKey = `${item.tipo}-${item.id}`;
                  const isSelected = selectedIds.has(itemKey);
                  return (
                    <tr key={itemKey} className={`hover:bg-gray-50 dark:hover:bg-gray-900/10 transition-colors ${isSelected ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(itemKey)}
                          className="rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                        />
                      </td>
                      <td className="p-4 text-center">
                        <div className={`px-2 py-1 rounded-md inline-flex items-center gap-1 font-bold text-[10px] ${
                          item.tipo === 'Egreso' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' :
                          item.tipo === 'Ingreso' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' :
                          'bg-amber-50 text-amber-600 dark:bg-amber-900/20'
                        }`}>
                          {item.tipo === 'Egreso' ? <DollarSign size={12}/> : item.tipo === 'Ingreso' ? <Layers size={12}/> : <CreditCard size={12}/>}
                          {item.tipo}
                        </div>
                      </td>
                    <td className="p-4 font-mono text-gray-500">
                      {new Date(item.fecha).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-bold text-gray-800 dark:text-gray-200">
                      {item.concepto}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-gray-700 dark:text-gray-300">
                      {formatCurrency(item.monto)}
                    </td>
                    <td className="p-4 text-center">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${
                        item.statusColor === 'green' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50' :
                        item.statusColor === 'yellow' ? 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800/50' :
                        'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:border-red-800/50'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          item.statusColor === 'green' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                          item.statusColor === 'yellow' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]' :
                          'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                        }`} />
                        {item.statusLabel}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleOpenViewer(item)}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Search size={12} /> Revisar Archivos
                        </button>
                        <button
                          onClick={() => setManualModal({
                            isOpen: true,
                            id: item.id,
                            tipo: item.tipo === 'Egreso' ? 'gasto' : (item.tipo === 'Ingreso' ? 'venta' : 'movimiento')
                          })}
                          className="px-2 py-1.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-500 hover:text-blue-700 rounded-lg transition-colors"
                          title="Añadir Documentos Faltantes"
                        >
                          <Plus size={14} />
                        </button>
                        {(item.tipo === 'Egreso' || item.tipo === 'Movimiento') && item.ticket_url !== 'no_lleva' && !item.ticket_url && (
                          <button
                            onClick={() => handleQuickNoTicket(item.id, item.tipo)}
                            className="px-2 py-1.5 bg-amber-50 text-amber-600 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1"
                            title="Marcar como 'No lleva ticket'"
                          >
                            <Tag size={12} /> Sin ticket
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            currentCount={filteredItems.slice(currentPage * pageSize, (currentPage + 1) * pageSize).length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            total={filteredItems.length}
          />
        </div>
      </div>

      
      {manualModal.isOpen && (
        <CargaManualModal
          tipo={manualModal.tipo || 'gasto'}
          registroId={manualModal.id}
          onClose={() => setManualModal({isOpen: false})}
          onSuccess={() => {
            setManualModal({isOpen: false});
            window.location.reload();
          }}
        />
      )}
      <DocumentViewer
        open={viewer.open}
        onClose={() => setViewer({ open: false, title: '', docs: [] })}
        title={viewer.title}
        documents={viewer.docs}
      />
    </div>
  );
}
