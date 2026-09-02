'use client';

import React, { useState, useEffect } from 'react';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import {
  obtenerReglasConciliacion,
  guardarReglaConciliacion,
  eliminarReglaConciliacion,
  sugerirConciliaciones
} from '../../gastos/reconciliationActions';
import { SlidersHorizontal, Plus, Trash2, CheckCircle2, Sparkles, AlertCircle, Save, X } from 'lucide-react';

interface ReglasConciliacionTabProps {
  selectedMonth: string;
}

export default function ReglasConciliacionTab({ selectedMonth }: ReglasConciliacionTabProps) {
  const getSessionToken = useSessionToken();

  const [loading, setLoading] = useState(true);
  const [reglas, setReglas] = useState<any[]>([]);
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [loadingSugerencias, setLoadingSugerencias] = useState(false);

  // Modal nueva regla
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    concepto_contiene: '',
    monto_min: '',
    monto_max: '',
    rfc_proveedor: '',
    es_deducible: true,
    orden: 10
  });

  const loadReglas = async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      const res = await obtenerReglasConciliacion(token);
      if (res.success && res.data) {
        setReglas(res.data);
      }
    } catch (err: any) {
      console.error('Error al cargar reglas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReglas();
  }, []);

  const handleCargarSugerencias = async () => {
    setLoadingSugerencias(true);
    try {
      const token = await getSessionToken();
      const res = await sugerirConciliaciones(token, selectedMonth);
      if (res.success && res.sugerencias) {
        setSugerencias(res.sugerencias);
      } else {
        alert('No se pudieron obtener sugerencias: ' + res.error);
      }
    } catch (err: any) {
      alert('Error al obtener sugerencias: ' + err.message);
    } finally {
      setLoadingSugerencias(false);
    }
  };

  const handleSaveRegla = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getSessionToken();
      const res = await guardarReglaConciliacion(token, formData);
      if (res.success) {
        setIsModalOpen(false);
        setFormData({
          nombre: '',
          concepto_contiene: '',
          monto_min: '',
          monto_max: '',
          rfc_proveedor: '',
          es_deducible: true,
          orden: 10
        });
        loadReglas();
      } else {
        alert('Error al guardar regla: ' + res.error);
      }
    } catch (err: any) {
      alert('Error al guardar regla: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRegla = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta regla de conciliación?')) return;
    try {
      const token = await getSessionToken();
      const res = await eliminarReglaConciliacion(token, id);
      if (res.success) {
        loadReglas();
      } else {
        alert('Error al eliminar regla: ' + res.error);
      }
    } catch (err: any) {
      alert('Error al eliminar regla: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 font-sans">
      {/* HEADER ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-200 dark:border-gray-800 pb-4 shrink-0">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-blue-500" /> Reglas Inteligentes de Banco & Sugerencias
          </h3>
          <p className="text-xs text-gray-500">
            Define condiciones automáticas para clasificar estados de cuenta y sugerir partidas en lote.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCargarSugerencias}
            disabled={loadingSugerencias}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            <Sparkles size={16} /> {loadingSugerencias ? 'Analizando...' : 'Sugerir Conciliaciones en Lote'}
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            <Plus size={16} /> Nueva Regla
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-6">
        {/* SUGERENCIAS EN LOTE */}
        {sugerencias.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-400 mb-3 flex items-center gap-2">
              <Sparkles size={16} /> Sugerencias de Coincidencia ({sugerencias.length} encontradas)
            </h4>
            <div className="space-y-2">
              {sugerencias.map((s, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800 text-xs flex justify-between items-center gap-4">
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white">
                      Movimiento: {s.movimiento?.concepto} (${Math.abs(Number(s.movimiento?.deposito || s.movimiento?.retiro || 0)).toFixed(2)})
                    </span>
                    <span className="block text-[10px] text-gray-500">
                      Coincide con {s.tipo}: {s.candidato?.concepto || s.candidato?.numero_pedido} - {s.motivo}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    s.confianza === 'alta' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    Confianza {s.confianza}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LISTADO DE REGLAS */}
        <div>
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Reglas Activas</h4>
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-xs">Cargando reglas bancarias...</div>
          ) : reglas.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs italic bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
              No hay reglas registradas. Crea una regla para clasificar automáticamente los movimientos bancarios al importar extractos.
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="p-3.5">Nombre</th>
                    <th className="p-3.5">Condición</th>
                    <th className="p-3.5">RFC Proveedor</th>
                    <th className="p-3.5">Categoría Asignada</th>
                    <th className="p-3.5 text-center">Orden</th>
                    <th className="p-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {reglas.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="p-3 font-bold text-gray-900 dark:text-white">{r.nombre}</td>
                      <td className="p-3 font-mono text-gray-600 dark:text-gray-400">
                        {r.concepto_contiene ? `Concepto contiene "${r.concepto_contiene}"` : 'General'}
                      </td>
                      <td className="p-3 font-mono text-gray-500">{r.rfc_proveedor || '—'}</td>
                      <td className="p-3 font-bold text-blue-600 dark:text-blue-400">
                        {r.categorias_movimiento_bancario?.nombre || 'Clasificación Automática'}
                      </td>
                      <td className="p-3 text-center font-mono">{r.orden}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteRegla(r.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CREAR REGLA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Plus size={18} className="text-emerald-500" /> Nueva Regla de Conciliación
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRegla} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">Nombre de la Regla *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de Comisiones MercadoPago"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">El concepto contiene el texto</label>
                <input
                  type="text"
                  placeholder="Ej: COMISION TPV"
                  value={formData.concepto_contiene}
                  onChange={e => setFormData({ ...formData, concepto_contiene: e.target.value })}
                  className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800 uppercase"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">RFC del Proveedor (Opcional)</label>
                <input
                  type="text"
                  placeholder="XAXX010101000"
                  value={formData.rfc_proveedor}
                  onChange={e => setFormData({ ...formData, rfc_proveedor: e.target.value })}
                  className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800 uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">Monto Mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.monto_min}
                    onChange={e => setFormData({ ...formData, monto_min: e.target.value })}
                    className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">Monto Máximo</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.monto_max}
                    onChange={e => setFormData({ ...formData, monto_max: e.target.value })}
                    className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-800 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {saving ? 'Guardando...' : 'Guardar Regla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
