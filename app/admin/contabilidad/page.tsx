'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { usePeriod } from '../../../lib/hooks/usePeriod';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../lib/hooks/useSessionToken';
import { formatCurrency } from '../../../lib/formatters';

// Server Actions
import {
  obtenerSignedUrl,
  enviarFacturaPorCorreo,
  sincronizarMetodosPagoXml,
  eliminarGasto,
  eliminarPedidoSano,
  eliminarFacturaCliente
} from '../gastos/actions';

// Tabs and Modals Components
import EgresosTab from '../gastos/_components/EgresosTab';
import IngresosTab from '../gastos/_components/IngresosTab';
import CfdiViewerModal from '../gastos/_components/CfdiViewerModal';
import GastoConciliacionDrawer from '../gastos/_components/GastoConciliacionDrawer';
import PeriodSelector from '../_components/PeriodSelector';
import { EditGastoModal, EditVentaModal } from '../gastos/_components/EditModals';

// Icons
import {
  TrendingUp, TrendingDown, Scale, CreditCard, RefreshCw,
  Receipt, Layers, DollarSign, FileCode
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function ContabilidadDashboard() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const getEmpresaId = useEmpresaId();
  const getSessionToken = useSessionToken();
  const { selectedMonth, periodStatus, refreshPeriodStatus } = usePeriod();

  // Active Tab: 'egresos' | 'ingresos'
  const [activeTab, setActiveTab] = useState<'egresos' | 'ingresos'>('egresos');

  // Loading & Message
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Core Data States
  const [gastosFacturados, setGastosFacturados] = useState<any[]>([]);
  const [categoriasGasto, setCategoriasGasto] = useState<any[]>([]);
  const [ventasFacturadas, setVentasFacturadas] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);

  // Modals & Drawer States
  const [cfdiViewerUrl, setCfdiViewerUrl] = useState<string | null>(null);
  const [selectedGastoConciliacion, setSelectedGastoConciliacion] = useState<any | null>(null);
  const [isConciliacionDrawerOpen, setIsConciliacionDrawerOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState<any>(null);
  const [editingVenta, setEditingVenta] = useState<any>(null);

  // Auto-dismiss messages
  useEffect(() => {
    if (message && message.type !== 'info') {
      const timer = setTimeout(() => setMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      // 1. Gastos facturados y no deducibles (con XML o marcados como no deducibles/solo ticket)
      const { data: gFac } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc), categorias_gasto(nombre), padre:gastos!gasto_padre_id(concepto), movimientos_bancarios(*, estatus_conciliacion_bancaria(*), cuentas_bancarias(*))')
        .eq('empresa_id', empresaId)
        .or('uuid_fiscal.not.is.null,es_deducible.eq.false')
        .order('fecha_gasto', { ascending: false });
      setGastosFacturados(gFac || []);

      const { data: cGasto } = await supabase.from('categorias_gasto').select('*').or(`empresa_id.is.null,empresa_id.eq.${empresaId}`).order('nombre');
      setCategoriasGasto(cGasto || []);

      // 2. Todas las Ventas (Facturadas y no Facturadas)
      const { data: vAll } = await supabase
        .from('pedidos')
        .select('*, clientes(nombre_local, rfc, email_facturacion), facturas_clientes(*)')
        .eq('empresa_id', empresaId)
        .neq('estatus_pago', 'Cancelado')
        .order('creado_en', { ascending: false });
      setVentasFacturadas(vAll || []);

      // 2b. Facturas XML de ingreso sin vincular (carga masiva que no encontró un pedido candidato)
      const { data: fIngresosSueltas } = await supabase
        .from('facturas_clientes')
        .select('*, clientes(nombre_local, rfc, email_facturacion), estatus_factura(nombre)')
        .eq('empresa_id', empresaId)
        .is('pedido_id', null)
        .order('fecha_emision', { ascending: false });

      const ventasSueltas = (fIngresosSueltas || []).map((f: any) => ({
        id: f.id,
        numero_pedido: '',
        folio_factura: f.serie_folio || (f.uuid_fiscal ? `UUID:${f.uuid_fiscal.substring(0, 8)}` : ''),
        precio_total: Number(f.total || 0),
        cliente_nombre: f.clientes?.nombre_local,
        fecha_pedido: f.fecha_emision,
        estatus_pago: 'Liquidado',
        clientes: f.clientes,
        facturas_clientes: [f],
        movimiento_bancario_id: f.movimiento_bancario_id ?? null,
        _esFacturaSuelta: true
      }));
      setVentasFacturadas([...ventasSueltas, ...(vAll || [])]);

      // 3. Formas de pago del SAT (Catálogo cargado de BD)
      const { data: fpData } = await supabase
        .from('formas_pago')
        .select('*')
        .order('codigo', { ascending: true });
      setFormasPago(fpData || []);

    } catch (err: any) {
      console.error('Error fetching accounting data:', err);
      setMessage({ text: 'Error al cargar datos: ' + (err.message || String(err)), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // --- FILTRADO DE DATOS DEL PERIODO ---
  const filteredGastos = useMemo(() => {
    return gastosFacturados.filter(g => {
      const dateStr = g.fecha_gasto || '';
      return dateStr.substring(0, 7) === selectedMonth;
    });
  }, [gastosFacturados, selectedMonth]);

  const filteredVentas = useMemo(() => {
    return ventasFacturadas.filter(v => {
      const dateStr = v.fecha_pedido || v.creado_en || '';
      return dateStr.substring(0, 7) === selectedMonth;
    });
  }, [ventasFacturadas, selectedMonth]);

  // --- KPIS METRICS CALCULATION ---
  const totalVentasPeriodo = useMemo(() => {
    return filteredVentas
      .filter(v => v.estatus_pago !== 'Cancelado')
      .reduce((sum, v) => sum + Number(v.precio_total || 0), 0);
  }, [filteredVentas]);

  const totalGastosPeriodo = useMemo(() => {
    return filteredGastos
      .filter(g => !g.gasto_padre_id)
      .reduce((sum, g) => sum + Number(g.monto || 0), 0);
  }, [filteredGastos]);

  const totalIvaPeriodo = useMemo(() => {
    return filteredGastos
      .filter(g => !g.gasto_padre_id)
      .reduce((sum, g) => {
        let iva = 0;
        if (g.iva_acreditable !== undefined && g.iva_acreditable !== null) {
          iva = Number(g.iva_acreditable);
        } else if (g.subtotal && Number(g.monto) > Number(g.subtotal)) {
          iva = Number(g.monto) - Number(g.subtotal);
        } else if (g.uuid_fiscal) {
          iva = Number(g.monto) - (Number(g.monto) / 1.16);
        }
        return sum + iva;
      }, 0);
  }, [filteredGastos]);

  const balanceNeto = useMemo(() => {
    return totalVentasPeriodo - totalGastosPeriodo;
  }, [totalVentasPeriodo, totalGastosPeriodo]);

  const gastosBreakdownByMetodo = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredGastos.forEach(g => {
      if (g.gasto_padre_id) return;
      const cod = g.metodo_pago || '99';
      const fp = formasPago.find(f => f.codigo === cod.trim().padStart(2, '0'));
      const label = fp ? `${fp.codigo} - ${fp.nombre}` : `${cod} - Otro`;
      breakdown[label] = (breakdown[label] || 0) + Number(g.monto || 0);
    });
    return breakdown;
  }, [filteredGastos, formasPago]);

  // --- HANDLERS CONTABILIDAD ---
  const handleDownloadFile = async (url: string) => {
    try {
      const token = await getSessionToken();
      const res = await obtenerSignedUrl(url, token);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert(`No se pudo descargar el archivo: ${res.error || 'error desconocido'}`);
      }
    } catch (err: any) {
      alert(`No se pudo descargar el archivo: ${err.message}`);
    }
  };

  const handleSendEmail = async (pedidoId: string) => {
    setMessage({ text: 'Enviando factura por correo...', type: 'info' });
    try {
      const token = await getSessionToken();
      const res = await enviarFacturaPorCorreo(pedidoId, token);
      if (res.success) {
        setMessage({ text: 'Factura enviada con éxito al correo del cliente.', type: 'success' });
      } else {
        alert(res.error || 'No se pudo realizar el envío del correo');
        setMessage(null);
      }
    } catch (err) {
      console.error(err);
      alert('Error en el servicio de envío de correos.');
      setMessage(null);
    }
  };

  const handleDeleteGasto = async (id: string) => {
    if (periodStatus === 'cerrado_definitivo') {
      alert('No se pueden eliminar egresos en un periodo cerrado definitivamente.');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;
    const token = await getSessionToken();
    const res = await eliminarGasto(id, token);
    if (res.success) {
      alert('Gasto eliminado exitosamente');
      fetchData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleDeleteVenta = async (id: string) => {
    if (periodStatus === 'cerrado_definitivo') {
      alert('No se pueden eliminar ventas en un periodo cerrado definitivamente.');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar esta venta/pedido?')) return;
    const token = await getSessionToken();
    const res = await eliminarPedidoSano(id, token);
    if (res.success) {
      alert('Venta eliminada exitosamente');
      fetchData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleDeleteFacturaSuelta = async (facturaId: string) => {
    if (periodStatus === 'cerrado_definitivo') {
      alert('No se pueden eliminar facturas en un periodo cerrado definitivamente.');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar esta factura XML de ingreso?')) return;
    const token = await getSessionToken();
    const res = await eliminarFacturaCliente(facturaId, token);
    if (res.success) {
      alert('Factura de ingreso eliminada exitosamente');
      fetchData();
    } else {
      alert('Error: ' + res.error);
    }
  };

  const handleUpdateCategoriaGasto = async (gastoId: string, categoriaId: string | null) => {
    if (periodStatus === 'cerrado_definitivo') {
      alert('No se pueden realizar modificaciones en un periodo cerrado definitivamente.');
      return;
    }
    try {
      const catId = categoriaId === '' ? null : categoriaId;
      const { error } = await supabase
        .from('gastos')
        .update({ categoria_id: catId })
        .eq('id', gastoId);
      
      if (error) throw error;
      setGastosFacturados(prev => prev.map(g => g.id === gastoId ? { ...g, categoria_id: catId } : g));
    } catch (err) {
      console.error(err);
      alert('Error al actualizar categoría del gasto.');
    }
  };


  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-full overflow-hidden flex flex-col font-sans`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex overflow-hidden">
        
        {/* MAIN BODY */}
        <main className="flex-1 flex flex-col p-8 w-full min-w-0 mx-auto overflow-hidden h-full compact-container">
          
          {/* HEADER */}
          <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0 compact-margin">
            <div>
              <h2 className="text-3xl font-extrabold flex items-center gap-3 compact-title">
                <Receipt className="text-blue-500 w-8 h-8" /> Módulo de Contabilidad
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
                Administración de egresos, ingresos facturados, control de proveedores y balance contable del periodo.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <PeriodSelector onPeriodChange={() => refreshPeriodStatus()} />
              <button
                onClick={fetchData}
                className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
                title="Refrescar datos"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* DASHBOARD KPIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-6 shrink-0 font-sans compact-kpi-grid">
            {/* Ventas */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all compact-kpi-card">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl compact-kpi-icon">
                <TrendingUp size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Total Ingresos (Ventas)</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white block truncate compact-kpi-value">
                  {loading ? '...' : formatCurrency(totalVentasPeriodo)}
                </span>
              </div>
            </div>

            {/* Gastos */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all compact-kpi-card">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl compact-kpi-icon">
                <TrendingDown size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Total Gastos (Egresos)</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white block truncate compact-kpi-value">
                  {loading ? '...' : formatCurrency(totalGastosPeriodo)}
                </span>
              </div>
            </div>

            {/* IVA Acreditable */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all compact-kpi-card">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl compact-kpi-icon">
                <FileCode size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">IVA Acreditable</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 block truncate compact-kpi-value">
                  {loading ? '...' : formatCurrency(totalIvaPeriodo)}
                </span>
              </div>
            </div>

            {/* Balance Neto */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all compact-kpi-card">
              <div className={`p-3 rounded-xl compact-kpi-icon ${balanceNeto >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                <Scale size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Balance Neto</span>
                <span className={`text-2xl font-black block truncate compact-kpi-value ${balanceNeto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {loading ? '...' : formatCurrency(balanceNeto)}
                </span>
              </div>
            </div>

            {/* Egresos por Método de Pago */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex flex-col justify-between hover:border-blue-500/30 transition-all min-h-[110px] compact-kpi-card">
              <div className="flex items-center gap-2 border-b border-gray-150 dark:border-gray-850 pb-1.5 mb-1.5">
                <CreditCard size={16} className="text-blue-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Egresos por Método</span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[70px] space-y-1 pr-1 font-mono text-[10px]">
                {loading ? (
                  <div className="text-gray-400 italic">Cargando...</div>
                ) : Object.keys(gastosBreakdownByMetodo).length > 0 ? (
                  Object.entries(gastosBreakdownByMetodo).map(([metodo, monto]) => (
                    <div key={metodo} className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                      <span className="truncate max-w-[120px]">{metodo}:</span>
                      <span className="font-bold">{formatCurrency(monto)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 italic">Sin egresos en el período</div>
                )}
              </div>
            </div>
          </div>

          {/* TAB BUTTONS */}
          <div className="flex border-b border-gray-200 dark:border-gray-850 mb-6 shrink-0 gap-2">
            <button
              onClick={() => setActiveTab('egresos')}
              className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                activeTab === 'egresos'
                  ? 'border-blue-500 text-blue-500 bg-blue-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <DollarSign size={16} /> Gastos y Egresos
            </button>
            <button
              onClick={() => setActiveTab('ingresos')}
              className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-bold text-xs uppercase tracking-wider transition-all ${
                activeTab === 'ingresos'
                  ? 'border-blue-500 text-blue-500 bg-blue-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Layers size={16} /> Ventas e Ingresos
            </button>

          </div>

          {/* FEEDBACK DE ESTADO */}
          {message && (
            <div className={`p-4 rounded-xl border mb-6 flex items-start justify-between gap-3 animate-in fade-in duration-300 shrink-0 ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' :
              message.type === 'error' ? 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30' :
              'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30'
            }`}>
              <span className="text-xs font-bold font-sans">{message.text}</span>
              <button onClick={() => setMessage(null)} className="text-xs font-bold hover:opacity-70 font-sans">✕</button>
            </div>
          )}

          {/* TAB CONTENTS */}
          <div className="flex-1 overflow-hidden flex flex-col relative min-h-0 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl">
            {activeTab === 'egresos' && (
              <EgresosTab
                gastosFacturados={filteredGastos}
                categorias={categoriasGasto}
                formasPago={formasPago}
                onUpdateCategoria={handleUpdateCategoriaGasto}
                onUpdateMetodoPago={async (id, metodo) => {
                  try {
                    const matchingFp = formasPago.find(f => f.codigo === metodo);
                    const formaPagoId = matchingFp ? matchingFp.id : null;

                    const { error } = await supabase.from('gastos').update({ 
                      metodo_pago: metodo,
                      forma_pago_id: formaPagoId
                    }).eq('id', id);
                    if (error) throw error;
                    
                    setGastosFacturados(prev => prev.map(g => g.id === id ? { 
                      ...g, 
                      metodo_pago: metodo || undefined,
                      forma_pago_id: formaPagoId || undefined
                    } : g));
                  } catch (err: any) {
                    alert('Error al actualizar método de pago: ' + err.message);
                  }
                }}
                onSincronizarPagos={async () => {
                  try {
                    const token = await getSessionToken();
                    const res = await sincronizarMetodosPagoXml(token);
                    if (res.success) {
                      alert(`Sincronización terminada. Se corrigieron ${res.count} registros.`);
                      await fetchData();
                    } else {
                      throw new Error(res.error);
                    }
                  } catch (err: any) {
                    alert(`Error al sincronizar: ${err.message}`);
                  }
                }}
                onDownloadFile={handleDownloadFile}
                onViewCfdi={setCfdiViewerUrl}
                onDeleteGasto={handleDeleteGasto}
                onEditGasto={setEditingGasto}
                onRefresh={fetchData}
                onViewConciliacion={(gasto) => {
                  setSelectedGastoConciliacion(gasto);
                  setIsConciliacionDrawerOpen(true);
                }}
              />
            )}

            {activeTab === 'ingresos' && (
              <IngresosTab
                ventasFacturadas={filteredVentas}
                onDownloadFile={handleDownloadFile}
                onViewCfdi={setCfdiViewerUrl}
                onSendEmail={handleSendEmail}
                onEditVenta={setEditingVenta}
                onDeleteVenta={handleDeleteVenta}
                onDeleteFacturaSuelta={handleDeleteFacturaSuelta}
                onRefresh={fetchData}
              />
            )}



          </div>
        </main>
      </div>

      {/* DRAWER DE CONCILIACIÓN */}
      <GastoConciliacionDrawer
        open={isConciliacionDrawerOpen}
        onClose={() => {
          setIsConciliacionDrawerOpen(false);
          setSelectedGastoConciliacion(null);
        }}
        gasto={selectedGastoConciliacion}
        onRefresh={fetchData}
        onDownloadFile={handleDownloadFile}
        onViewCfdi={setCfdiViewerUrl}
      />

      {/* CFDI XML VIEWER */}
      {cfdiViewerUrl && (
        <CfdiViewerModal xmlUrl={cfdiViewerUrl} onClose={() => setCfdiViewerUrl(null)} />
      )}

      {/* EDIT EXPENSE MODAL */}
      {editingGasto && (
        <EditGastoModal 
          gasto={editingGasto} 
          categorias={categoriasGasto}
          onClose={() => setEditingGasto(null)} 
          onSuccess={() => { setEditingGasto(null); fetchData(); }} 
        />
      )}

      {/* EDIT SALE/ORDER MODAL */}
      {editingVenta && (
        <EditVentaModal 
          venta={editingVenta} 
          onClose={() => setEditingVenta(null)} 
          onSuccess={() => { setEditingVenta(null); fetchData(); }} 
        />
      )}
    </div>
  );
}
