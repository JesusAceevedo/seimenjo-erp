'use client';

import { useState } from 'react';
import { Briefcase, Calendar } from 'lucide-react';
import type { Turno, EmpleadoDetalle } from '../types';
import { saveTurno, applyGlobalSchedule } from '../actions';

interface Props {
  turnos: Turno[];
  empleados: EmpleadoDetalle[];
  empresaId: string | null;
  onSaved: () => void;
}

export default function TurnosTab({ turnos, empleados, empresaId, onSaved }: Props) {
  const [selected, setSelected] = useState<Turno | null>(null);
  const [form, setForm] = useState({
    nombre: '', tipo_turno: 'fijo' as 'fijo' | 'partido' | 'rotativo',
    hora_entrada_1: '09:00', hora_salida_1: '17:00',
    hora_entrada_2: '', hora_salida_2: '', tolerancia_minutos: 15
  });

  const [globalDay, setGlobalDay] = useState(1);
  const [globalOption, setGlobalOption] = useState('descanso');
  const [applying, setApplying] = useState(false);

  const resetForm = () => {
    setSelected(null);
    setForm({ nombre: '', tipo_turno: 'fijo', hora_entrada_1: '09:00', hora_salida_1: '17:00', hora_entrada_2: '', hora_salida_2: '', tolerancia_minutos: 15 });
  };

  const handleEdit = (t: Turno) => {
    setSelected(t);
    setForm({
      nombre: t.nombre, tipo_turno: t.tipo_turno,
      hora_entrada_1: t.hora_entrada_1.substring(0, 5), hora_salida_1: t.hora_salida_1.substring(0, 5),
      hora_entrada_2: t.hora_entrada_2 ? t.hora_entrada_2.substring(0, 5) : '',
      hora_salida_2: t.hora_salida_2 ? t.hora_salida_2.substring(0, 5) : '',
      tolerancia_minutos: t.tolerancia_minutos
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !empresaId) return;
    try {
      const payload = {
        empresa_id: empresaId, nombre: form.nombre, tipo_turno: form.tipo_turno,
        hora_entrada_1: form.hora_entrada_1, hora_salida_1: form.hora_salida_1,
        hora_entrada_2: form.tipo_turno === 'partido' ? form.hora_entrada_2 || null : null,
        hora_salida_2: form.tipo_turno === 'partido' ? form.hora_salida_2 || null : null,
        tolerancia_minutos: form.tolerancia_minutos
      };
      await saveTurno(payload, !!selected, selected?.id);
      resetForm();
      onSaved();
    } catch (err: any) {
      alert('Error al guardar turno: ' + err.message);
    }
  };

  const handleGlobal = async () => {
    if (empleados.length === 0 || !empresaId) return;
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const isDescanso = globalOption === 'descanso';
    const optionName = isDescanso ? 'Día de Descanso' : `Turno: ${turnos.find(t => t.id === globalOption)?.nombre || ''}`;
    if (!confirm(`¿Asignar "${optionName}" a todos los empleados para ${dayNames[globalDay]}?`)) return;
    setApplying(true);
    try {
      await applyGlobalSchedule(empleados, globalDay, isDescanso ? null : globalOption, isDescanso);
      onSaved();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
            <Briefcase className="text-amber-500" size={18} /> {selected ? 'Modificar Turno' : 'Crear Nuevo Turno'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre *</label>
              <input type="text" required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo *</label>
                <select value={form.tipo_turno} onChange={e => setForm({ ...form, tipo_turno: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500">
                  <option value="fijo">Fijo continuo</option>
                  <option value="partido">Partido (Dividido)</option>
                  <option value="rotativo">Rotativo</option>
                </select></div>
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tolerancia (min)</label>
                <input type="number" value={form.tolerancia_minutos} onChange={e => setForm({ ...form, tolerancia_minutos: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500" /></div>
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
              <p className="font-bold text-[10px] text-gray-400 uppercase">Primer Segmento</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Entrada 1 *</label>
                  <input type="time" required value={form.hora_entrada_1} onChange={e => setForm({ ...form, hora_entrada_1: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none" /></div>
                <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Salida 1 *</label>
                  <input type="time" required value={form.hora_salida_1} onChange={e => setForm({ ...form, hora_salida_1: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none" /></div>
              </div>
            </div>
            {form.tipo_turno === 'partido' && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                <p className="font-bold text-[10px] text-gray-400 uppercase">Segundo Segmento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Entrada 2 *</label>
                    <input type="time" required value={form.hora_entrada_2} onChange={e => setForm({ ...form, hora_entrada_2: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none" /></div>
                  <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Salida 2 *</label>
                    <input type="time" required value={form.hora_salida_2} onChange={e => setForm({ ...form, hora_salida_2: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none" /></div>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg transition-colors">{selected ? 'Guardar Cambios' : 'Crear Turno'}</button>
              {selected && <button type="button" onClick={resetForm} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-200 font-bold">Cancelar</button>}
            </div>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
            <Calendar className="text-amber-500" size={18} /> Asignación por Empresa
          </h3>
          <p className="text-xs text-gray-500">Asigna descanso o turno a todos los empleados para un día específico.</p>
          <div className="space-y-3 text-xs">
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Día</label>
              <select value={globalDay} onChange={e => setGlobalDay(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500">
                <option value="1">Lunes</option><option value="2">Martes</option><option value="3">Miércoles</option>
                <option value="4">Jueves</option><option value="5">Viernes</option><option value="6">Sábado</option><option value="0">Domingo</option>
              </select></div>
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Turno o Descanso</label>
              <select value={globalOption} onChange={e => setGlobalOption(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500">
                <option value="descanso">Día de Descanso</option>
                {turnos.map(t => <option key={t.id} value={t.id}>Turno: {t.nombre}</option>)}
              </select></div>
            <button onClick={handleGlobal} disabled={applying}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 text-white font-bold py-2 rounded-lg transition-colors mt-2 text-xs">
              {applying ? 'Aplicando...' : 'Aplicar a Todos los Empleados'}
            </button>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
          <Calendar className="text-amber-500" size={18} /> Turnos Registrados
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {turnos.map(t => (
            <div key={t.id} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-xs text-gray-900 dark:text-white">{t.nombre}</h4>
                  <span className="text-[9px] uppercase tracking-wide bg-amber-500/10 text-amber-600 px-1 py-0.5 rounded font-bold">{t.tipo_turno}</span>
                </div>
                <span className="text-[10px] text-gray-400">Tol: {t.tolerancia_minutos} min</span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p className="flex justify-between"><span>Horario 1:</span><span className="font-mono font-bold text-gray-700 dark:text-gray-300">{t.hora_entrada_1.substring(0,5)} - {t.hora_salida_1.substring(0,5)}</span></p>
                {t.tipo_turno === 'partido' && t.hora_entrada_2 && (
                  <p className="flex justify-between"><span>Horario 2:</span><span className="font-mono font-bold text-gray-700 dark:text-gray-300">{t.hora_entrada_2.substring(0,5)} - {t.hora_salida_2?.substring(0,5)}</span></p>
                )}
              </div>
              <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => handleEdit(t)} className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded font-semibold text-[10px] transition-colors">Editar</button>
              </div>
            </div>
          ))}
          {turnos.length === 0 && <p className="text-gray-400 italic text-center text-xs py-6 col-span-2">No hay turnos creados</p>}
        </div>
      </div>
    </div>
  );
}
