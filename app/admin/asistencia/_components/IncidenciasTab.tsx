'use client';

import { useState } from 'react';
import { AlertCircle, FileText } from 'lucide-react';
import type { Incidencia, EmpleadoDetalle } from '../types';
import { createIncidencia } from '../actions';

interface Props {
  incidencias: Incidencia[];
  empleados: EmpleadoDetalle[];
  empresaId: string | null;
  onSaved: () => void;
}

export default function IncidenciasTab({ incidencias, empleados, empresaId, onSaved }: Props) {
  const [form, setForm] = useState({
    empleado_id: '', tipo_incidencia: 'vacaciones',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    motivo: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.empleado_id || !empresaId) return;
    try {
      const start = new Date(form.fecha_inicio);
      const end = new Date(form.fecha_fin);
      const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      await createIncidencia({
        empleado_id: form.empleado_id, tipo_incidencia: form.tipo_incidencia,
        fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
        total_dias: diffDays, motivo: form.motivo, estatus: 'aprobado'
      });
      setForm({
        empleado_id: '', tipo_incidencia: 'vacaciones',
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: new Date().toISOString().split('T')[0], motivo: ''
      });
      onSaved();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const labelMap: Record<string, string> = {
    vacaciones: 'Vacaciones Dignas LFT',
    permiso_sin_goce: 'Permiso sin goce de sueldo',
    permiso_con_goce: 'Permiso con goce de sueldo',
    incapacidad_enfermedad: 'Incapacidad (Enfermedad general)',
    incapacidad_riesgo: 'Incapacidad (Riesgo de trabajo)',
    descanso_programado: 'Día de Descanso Programado (Cambio)'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
          <AlertCircle className="text-amber-500" size={18} /> Registrar Incidencia / Permiso
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Empleado *</label>
            <select required value={form.empleado_id} onChange={e => setForm({ ...form, empleado_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none">
              <option value="">Seleccionar...</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre_completo}</option>)}
            </select></div>
          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo *</label>
            <select value={form.tipo_incidencia} onChange={e => setForm({ ...form, tipo_incidencia: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              {Object.entries(labelMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha Inicio *</label>
              <input type="date" required value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800" /></div>
            <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha Fin *</label>
              <input type="date" required value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800" /></div>
          </div>
          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Motivo</label>
            <textarea rows={3} value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
              placeholder="Detallar causa o folio de incapacidad..." /></div>
          <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg transition-colors">Registrar Incidencia</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
          <FileText className="text-amber-500" size={18} /> Historial de Permisos e Incidencias
        </h3>
        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-100/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold">
                <th className="p-3">Empleado</th><th className="p-3">Incidencia</th><th className="p-3">Período</th>
                <th className="p-3">Días</th><th className="p-3 text-right">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
              {incidencias.map(inc => (
                <tr key={inc.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                  <td className="p-3 font-semibold text-gray-900 dark:text-white">{inc.empleados_detalle?.nombre_completo || 'Empleado'}</td>
                  <td className="p-3 capitalize text-gray-600 dark:text-gray-300">{inc.tipo_incidencia.replace(/_/g, ' ')}</td>
                  <td className="p-3 text-gray-500">{inc.fecha_inicio} al {inc.fecha_fin}</td>
                  <td className="p-3 font-semibold text-gray-700 dark:text-gray-300">{inc.total_dias} días</td>
                  <td className="p-3 text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 uppercase">
                      {inc.estatus}
                    </span>
                  </td>
                </tr>
              ))}
              {incidencias.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-400 italic">Sin incidencias registradas</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
