'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  FileText, FileCode, CheckCircle, AlertTriangle, XCircle, Search, Calendar,
  Download, RefreshCw, Layers, DollarSign, CreditCard
} from 'lucide-react';
import DocumentViewer from '../_components/DocumentViewer';

interface ExpedienteItem {
  id: string;
  tipo: 'Egreso' | 'Ingreso' | 'Movimiento';
  fecha: string;
  concepto: string;
  monto: number;
  xml_url?: string;
  pdf_url?: string;
  ticket_url?: string;
  statusColor: 'green' | 'yellow' | 'red';
  statusLabel: string;
}

export default function ExpedienteDigital() {
  const [items, setItems] = useState<ExpedienteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterEstatus, setFilterEstatus] = useState('todos');
  
  const [viewer, setViewer] = useState<{ open: boolean; title: string; docs: any[] }>({
    open: false, title: '', docs: []
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Gastos
      const { data: gastos } = await supabase
        .from('gastos_facturados')
        .select('id, fecha_gasto, concepto, monto, xml_url, pdf_url, ticket_url')
        .order('fecha_gasto', { ascending: false })
        .limit(300);

      // 2. Fetch Ingresos (Facturas)
      const { data: ingresos } = await supabase
        .from('facturas_clientes')
        .select('id, fecha_emision, serie_folio, total, xml_url, pdf_url, ticket_url')
        .order('fecha_emision', { ascending: false })
        .limit(300);

      // 3. Fetch Movimientos Bancarios
      const { data: movimientos } = await supabase
        .from('movimientos_bancarios')
        .select('id, fecha, concepto, monto, xml_url, pdf_factura_url, pdf_ticket_url')
        .order('fecha', { ascending: false })
        .limit(300);

      const allItems: ExpedienteItem[] = [];

      // Procesar Gastos
      (gastos || []).forEach((g: any) => {
        const missing = [];
        if (!g.xml_url) missing.push('XML');
        if (!g.pdf_url) missing.push('PDF');
        if (!g.ticket_url) missing.push('Ticket');
        
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
          id: g.id,
          tipo: 'Egreso',
          fecha: g.fecha_gasto || '',
          concepto: g.concepto || 'Sin concepto',
          monto: Number(g.monto) || 0,
          xml_url: g.xml_url,
          pdf_url: g.pdf_url,
          ticket_url: g.ticket_url,
          statusColor: color,
          statusLabel: label
        });
      });

      // Procesar Ingresos
      (ingresos || []).forEach((i: any) => {
        const missing = [];
        if (!i.xml_url) missing.push('XML');
        if (!i.pdf_url) missing.push('PDF');
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
          concepto: `Factura ${i.serie_folio || 'S/F'}`,
          monto: Number(i.total) || 0,
          xml_url: i.xml_url,
          pdf_url: i.pdf_url,
          ticket_url: i.ticket_url,
          statusColor: color,
          statusLabel: label
        });
      });

      // Procesar Movimientos
      (movimientos || []).forEach((m: any) => {
        const missing = [];
        if (!m.xml_url) missing.push('XML');
        if (!m.pdf_factura_url) missing.push('PDF');
        if (!m.pdf_ticket_url) missing.push('Ticket');
        
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
          id: m.id,
          tipo: 'Movimiento',
          fecha: m.fecha || '',
          concepto: m.concepto || 'Movimiento Banco',
          monto: Number(m.monto) || 0,
          xml_url: m.xml_url,
          pdf_url: m.pdf_factura_url,
          ticket_url: m.pdf_ticket_url,
          statusColor: color,
          statusLabel: label
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
  }, []);

  const filteredItems = items.filter(item => {
    if (filterTipo !== 'todos' && item.tipo !== filterTipo) return false;
    if (filterEstatus !== 'todos' && item.statusColor !== filterEstatus) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!item.concepto.toLowerCase().includes(s) && !String(item.monto).includes(s)) return false;
    }
    return true;
  });

  const handleOpenViewer = (item: ExpedienteItem) => {
    const docs: {url: string, type: 'pdf' | 'xml', label: string}[] = [];
    if (item.xml_url) {
      item.xml_url.split(',').forEach((url, i) => {
        if (url) docs.push({ url, type: 'xml', label: `XML ${i + 1}` });
      });
    }
    if (item.pdf_url) {
      item.pdf_url.split(',').forEach((url, i) => {
        if (url) docs.push({ url, type: 'pdf', label: `Factura PDF ${i + 1}` });
      });
    }
    if (item.ticket_url) {
      item.ticket_url.split(',').forEach((url, i) => {
        if (url) docs.push({ url, type: 'pdf', label: `Ticket PDF ${i + 1}` });
      });
    }
    setViewer({ open: true, title: item.concepto, docs });
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
          <button onClick={fetchData} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-md">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 pt-0 overflow-hidden flex flex-col min-h-0">
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex-1 overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse text-xs min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  <th className="p-4 w-24">Tipo</th>
                  <th className="p-4 w-28">Fecha</th>
                  <th className="p-4">Concepto / Detalle</th>
                  <th className="p-4 text-right w-32">Monto</th>
                  <th className="p-4 text-center w-48">Auditoría (Semáforo)</th>
                  <th className="p-4 text-center w-32">Expediente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 font-sans">
                {loading && items.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">Cargando expediente...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">No se encontraron registros.</td></tr>
                ) : filteredItems.map((item) => (
                  <tr key={`${item.tipo}-${item.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/10 transition-colors">
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
                      <button
                        onClick={() => handleOpenViewer(item)}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg text-[10px] font-bold transition-colors inline-flex items-center gap-1"
                      >
                        <Search size={12} /> Revisar Archivos
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <DocumentViewer
        open={viewer.open}
        onClose={() => setViewer({ open: false, title: '', docs: [] })}
        title={viewer.title}
        documents={viewer.docs}
      />
    </div>
  );
}
