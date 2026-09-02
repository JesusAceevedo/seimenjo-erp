'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useEmpresaId } from '../../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { sincronizarAsientos, revertirAsiento, obtenerCatalogoCuentas } from '../actions';
import { formatCurrency } from '../../../../lib/formatters';
import AsientoModal from './AsientoModal';
import { RefreshCw, Plus, RotateCcw, FileText, CheckCircle, AlertTriangle, Eye, X } from 'lucide-react';

interface PolizasTabProps {
  selectedMonth: string;
}

export default function PolizasTab({ selectedMonth }: PolizasTabProps) {
  const getEmpresaId = useEmpresaId();
  const getSessionToken = useSessionToken();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [asientos, setAsientos] = useState<any[]>([]);
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [filterTipo, setFilterTipo] = useState<string>('todos');

  // Modal póliza manual
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Drawer de vista previa de asiento
  const [selectedAsiento, setSelectedAsiento] = useState<any | null>(null);

  const fetchAsientos = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      const { data, error } = await supabase
        .from('asientos')
        .select('*, asientos_detalle(*, cuentas_contables(codigo, nombre))')
        .eq('empresa_id', empresaId)
        .eq('periodo', selectedMonth)
        .order('numero_folio', { ascending: false });

      if (error) throw error;
      setAsientos(data || []);

      const token = await getSessionToken();
      const catRes = await obtenerCatalogoCuentas(token);
      if (catRes.success && catRes.data) {
        setCuentas(catRes.data);
      }
    } catch (err: any) {
      console.error('Error al cargar asientos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsientos();
  }, [selectedMonth]);

  const handleSyncPeriod = async () => {
    setSyncing(true);
    try {
      const token = await getSessionToken();
      const res = await sincronizarAsientos(token, selectedMonth);
      if (res.success) {
        alert(`Sincronización finalizada. Se generaron o actualizaron ${res.count || 0} pólizas contables.`);
        fetchAsientos();
      } else {
        alert('Error en la sincronización: ' + res.error);
      }
    } catch (err: any) {
      alert('Error en la sincronización: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRevert = async (asientoId: string) => {
    if (!confirm('¿Estás seguro de revertir (cancelar con contra-asiento) esta póliza?')) return;
    try {
      const token = await getSessionToken();
      const res = await revertirAsiento(asientoId, token);
      if (res.success) {
        alert('Póliza revertida exitosamente.');
        fetchAsientos();
      } else {
        alert('Error al revertir: ' + res.error);
      }
    } catch (err: any) {
      alert('Error al revertir: ' + err.message);
    }
  };

  const filteredAsientos = asientos.filter(a => {
    if (filterTipo !== 'todos' && a.tipo !== filterTipo) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 font-sans">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-200 dark:border-gray-800 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-gray-500 uppercase">Filtrar por tipo:</label>
          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-xl text-xs font-bold"
          >
            <option value="todos">Todos los Tipos</option>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
            <option value="diario">Diario</option>
            <option value="traspaso">Traspaso</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncPeriod}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar Asientos Automáticos'}
          </button>

          <button
            onClick={() => setIsManualModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            <Plus size={16} /> Nueva Póliza Manual
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-y-auto pr-2">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Cargando pólizas contables del periodo...</div>
        ) : filteredAsientos.length === 0 ? (
          <div className="text-center py-12 text-gray-400 italic">
            No hay pólizas registradas en el periodo {selectedMonth}. Haz clic en "Sincronizar Asientos Automáticos" para generar las pólizas de egresos e ingresos.
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Folio</th>
                  <th className="p-3.5">Fecha</th>
                  <th className="p-3.5">Tipo</th>
                  <th className="p-3.5">Concepto</th>
                  <th className="p-3.5">Origen / Referencia</th>
                  <th className="p-3.5 text-right">Total Cargo</th>
                  <th className="p-3.5 text-right">Total Abono</th>
                  <th className="p-3.5 text-center">Estatus</th>
                  <th className="p-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {filteredAsientos.map(a => {
                  const totalCargo = (a.asientos_detalle || []).reduce((s: number, d: any) => s + Number(d.cargo || 0), 0);
                  const totalAbono = (a.asientos_detalle || []).reduce((s: number, d: any) => s + Number(d.abono || 0), 0);

                  return (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">#{a.numero_folio}</td>
                      <td className="p-3 font-mono text-gray-600 dark:text-gray-400">{a.fecha}</td>
                      <td className="p-3 uppercase text-[10px] font-bold">
                        <span className={`px-2 py-0.5 rounded-full ${
                          a.tipo === 'ingreso' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                          a.tipo === 'egreso' ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}>
                          {a.tipo}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-gray-900 dark:text-white max-w-xs truncate">{a.concepto}</td>
                      <td className="p-3 text-[10px] text-gray-500 font-mono">
                        {a.referencia_tabla ? `${a.referencia_tabla}:${a.referencia_id?.substring(0, 8)}` : 'Manual'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(totalCargo)}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600">{formatCurrency(totalAbono)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          a.estatus === 'contabilizado' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                          a.estatus === 'cancelado' ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {a.estatus}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedAsiento(a)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg"
                            title="Ver Asiento Partida Doble"
                          >
                            <Eye size={16} />
                          </button>
                          {a.estatus === 'contabilizado' && (
                            <button
                              onClick={() => handleRevert(a.id)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                              title="Revertir Póliza (Contra-asiento)"
                            >
                              <RotateCcw size={16} />
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
        )}
      </div>

      {/* MODAL DETALLE DE ASIENTO (DRAWER/MODAL) */}
      {selectedAsiento && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-3xl w-full shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Póliza #{selectedAsiento.numero_folio} ({selectedAsiento.tipo?.toUpperCase()})
                </h3>
                <p className="text-xs text-gray-500">{selectedAsiento.concepto} | Fecha: {selectedAsiento.fecha}</p>
              </div>
              <button onClick={() => setSelectedAsiento(null)} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>

            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="p-3">Código</th>
                    <th className="p-3">Cuenta Contable</th>
                    <th className="p-3">Concepto Línea</th>
                    <th className="p-3 text-right">Cargo (Debe)</th>
                    <th className="p-3 text-right">Abono (Haber)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(selectedAsiento.asientos_detalle || []).map((det: any) => (
                    <tr key={det.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{det.cuentas_contables?.codigo}</td>
                      <td className="p-3 font-bold text-gray-900 dark:text-white">{det.cuentas_contables?.nombre}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">{det.concepto}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600">{formatCurrency(det.cargo)}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600">{formatCurrency(det.abono)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedAsiento(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR ASIENTO MANUAL */}
      {isManualModalOpen && (
        <AsientoModal
          cuentas={cuentas}
          onClose={() => setIsManualModalOpen(false)}
          onSuccess={() => {
            setIsManualModalOpen(false);
            fetchAsientos();
          }}
        />
      )}
    </div>
  );
}
