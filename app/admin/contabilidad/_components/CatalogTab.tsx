'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useEmpresaId } from '../../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { obtenerConfiguracionContable, guardarConfiguracionContable } from '../actions';
import { Folder, FileText, Plus, Edit2, Settings, CheckCircle2, ShieldAlert } from 'lucide-react';

interface Account {
  id: string;
  codigo: string;
  nombre: string;
  nivel: number;
  tipo: string;
  naturaleza: string;
  es_agrupadora: boolean;
  estatus: string;
  padre_id?: string;
}

export default function CatalogTab() {
  const getEmpresaId = useEmpresaId();
  const getSessionToken = useSessionToken();

  const [loading, setLoading] = useState(true);
  const [cuentas, setCuentas] = useState<Account[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'catalogo' | 'mapeo'>('catalogo');
  const [configMap, setConfigMap] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Modal para nueva/editar cuenta
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<Account> | null>(null);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    nivel: 3,
    tipo: 'activo',
    naturaleza: 'deudora',
    es_agrupadora: false,
    padre_id: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      const token = await getSessionToken();

      // Cargar catálogo de cuentas
      const { data: catData, error: catErr } = await supabase
        .from('cuentas_contables')
        .select('*')
        .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
        .order('codigo', { ascending: true });

      if (catErr) throw catErr;
      setCuentas(catData || []);

      // Cargar mapeos de configuración
      const confRes = await obtenerConfiguracionContable(token);
      if (confRes.success && confRes.data) {
        setConfigMap(confRes.data);
      }
    } catch (err: any) {
      console.error('Error al cargar catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async (clave: string, cuentaId: string) => {
    setSavingKey(clave);
    try {
      const token = await getSessionToken();
      const res = await guardarConfiguracionContable(token, clave, cuentaId);
      if (res.success) {
        setConfigMap(prev => ({ ...prev, [clave]: cuentaId }));
      } else {
        alert('Error al guardar configuración: ' + res.error);
      }
    } catch (err: any) {
      alert('Error al guardar configuración: ' + err.message);
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const empresaId = await getEmpresaId();
      const payload = {
        empresa_id: empresaId,
        codigo: formData.codigo.trim(),
        nombre: formData.nombre.trim(),
        nivel: Number(formData.nivel),
        tipo: formData.tipo,
        naturaleza: formData.naturaleza,
        es_agrupadora: formData.es_agrupadora,
        padre_id: formData.padre_id || null,
        estatus: 'activo'
      };

      const { error } = await supabase.from('cuentas_contables').insert(payload);
      if (error) throw error;

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert('Error al crear cuenta contable: ' + (err.message || String(err)));
    }
  };

  const configKeys = [
    { key: 'cuenta_banco', label: 'Cuenta Principal de Banco', defaultCode: '102.01' },
    { key: 'cuenta_caja_chica', label: 'Caja Chica y Efectivo', defaultCode: '101.01' },
    { key: 'cuentas_por_cobrar', label: 'Clientes / Cuentas por Cobrar', defaultCode: '105.01' },
    { key: 'cuentas_por_pagar', label: 'Proveedores / Cuentas por Pagar', defaultCode: '201.01' },
    { key: 'iva_acreditable', label: 'IVA Acreditable Pagado (16%)', defaultCode: '118.01' },
    { key: 'iva_pendiente_acreditable', label: 'IVA Pendiente de Acreditar', defaultCode: '118.02' },
    { key: 'iva_trasladado', label: 'IVA Trasladado Cobrado (16%)', defaultCode: '208.01' },
    { key: 'iva_pendiente_trasladar', label: 'IVA Pendiente de Trasladar', defaultCode: '208.02' },
    { key: 'retencion_isr', label: 'Retención de ISR', defaultCode: '216.01' },
    { key: 'retencion_iva', label: 'Retención de IVA', defaultCode: '216.02' },
    { key: 'ventas', label: 'Ventas e Ingresos de Operación', defaultCode: '401.01' },
    { key: 'gastos_generales', label: 'Gastos Generales de Operación', defaultCode: '601.01' },
    { key: 'gastos_comisiones', label: 'Comisiones Bancarias y TPV', defaultCode: '601.02' }
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 font-sans">
      {/* HEADER & SUBTABS */}
      <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-800 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveSubTab('catalogo')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeSubTab === 'catalogo'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            Jerarquía CUC SAT
          </button>
          <button
            onClick={() => setActiveSubTab('mapeo')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeSubTab === 'mapeo'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            <Settings size={14} /> Mapeo de Cuentas por Empresa
          </button>
        </div>

        {activeSubTab === 'catalogo' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
          >
            <Plus size={16} /> Nueva Cuenta Contable
          </button>
        )}
      </div>

      {/* SUBTAB 1: JERARQUÍA CUC SAT */}
      {activeSubTab === 'catalogo' && (
        <div className="flex-1 overflow-y-auto pr-2">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Cargando catálogo contable...</div>
          ) : (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="p-3.5">Código CUC</th>
                    <th className="p-3.5">Nombre de la Cuenta</th>
                    <th className="p-3.5">Nivel</th>
                    <th className="p-3.5">Tipo</th>
                    <th className="p-3.5">Naturaleza</th>
                    <th className="p-3.5">Tipo Cuenta</th>
                    <th className="p-3.5 text-center">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                  {cuentas.map(c => {
                    const indentPadding = (c.nivel - 1) * 20;
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{c.codigo}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${indentPadding}px` }}>
                            {c.es_agrupadora ? (
                              <Folder size={16} className="text-amber-500 shrink-0" />
                            ) : (
                              <FileText size={14} className="text-gray-400 shrink-0" />
                            )}
                            <span className={c.nivel <= 2 ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}>
                              {c.nombre}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-gray-500">{c.nivel}</td>
                        <td className="p-3 uppercase text-[10px] font-bold text-gray-600 dark:text-gray-400">{c.tipo}</td>
                        <td className="p-3 capitalize text-gray-600 dark:text-gray-400">{c.naturaleza}</td>
                        <td className="p-3 text-[10px] text-gray-500">
                          {c.es_agrupadora ? 'Agrupadora' : 'Afectable'}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.estatus === 'activo' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {c.estatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: MAPEO DE CONFIGURACIÓN */}
      {activeSubTab === 'mapeo' && (
        <div className="flex-1 overflow-y-auto pr-2 max-w-4xl">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 p-4 rounded-xl mb-6 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-3">
            <ShieldAlert size={18} className="shrink-0 text-blue-500 mt-0.5" />
            <p>
              Asigna las cuentas contables de tu catálogo para cada operación automática del sistema. Si no configuras una cuenta, el motor utilizará la cuenta por defecto asignada al código CUC SAT.
            </p>
          </div>

          <div className="space-y-4">
            {configKeys.map(ck => {
              const selectedValue = configMap[ck.key] || '';
              return (
                <div key={ck.key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between gap-4 shadow-sm">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">{ck.label}</h4>
                    <span className="text-[10px] text-gray-500 font-mono">Clave interna: {ck.key} (Default SAT: {ck.defaultCode})</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={selectedValue}
                      onChange={(e) => handleSaveConfig(ck.key, e.target.value)}
                      disabled={savingKey === ck.key}
                      className="p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg text-xs font-sans focus:outline-none focus:border-blue-500 min-w-[280px]"
                    >
                      <option value="">-- Usar default CUC SAT ({ck.defaultCode}) --</option>
                      {cuentas.filter(c => !c.es_agrupadora).map(c => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} - {c.nombre}
                        </option>
                      ))}
                    </select>

                    {savingKey === ck.key && (
                      <span className="text-xs text-blue-500 animate-pulse font-bold">Guardando...</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL CREAR NUEVA CUENTA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <Plus size={20} className="text-emerald-500" /> Nueva Cuenta Contable
            </h3>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">Código CUC SAT (Ej: 101.02)</label>
                <input
                  type="text"
                  required
                  placeholder="101.02"
                  value={formData.codigo}
                  onChange={e => setFormData({ ...formData, codigo: e.target.value })}
                  className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">Nombre de la Cuenta</label>
                <input
                  type="text"
                  required
                  placeholder="Caja Sucursal Norte"
                  value={formData.nombre}
                  onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">Tipo</label>
                  <select
                    value={formData.tipo}
                    onChange={e => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800 capitalize"
                  >
                    <option value="activo">Activo</option>
                    <option value="pasivo">Pasivo</option>
                    <option value="capital">Capital</option>
                    <option value="ingreso">Ingreso</option>
                    <option value="costo">Costo</option>
                    <option value="gasto">Gasto</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">Naturaleza</label>
                  <select
                    value={formData.naturaleza}
                    onChange={e => setFormData({ ...formData, naturaleza: e.target.value })}
                    className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800 capitalize"
                  >
                    <option value="deudora">Deudora</option>
                    <option value="acreedora">Acreedora</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="es_agrupadora"
                  checked={formData.es_agrupadora}
                  onChange={e => setFormData({ ...formData, es_agrupadora: e.target.checked })}
                  className="rounded text-blue-600"
                />
                <label htmlFor="es_agrupadora" className="font-bold text-gray-700 dark:text-gray-300">
                  Es cuenta agrupadora (padre de otras cuentas)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-800 font-bold hover:bg-gray-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Guardar Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
