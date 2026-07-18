'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Trash2, Info, AlertTriangle, Sun, CheckCircle } from 'lucide-react';
import type { EmpleadoDetalle } from '../types';
import { loadDiasFestivos, saveDiaFestivo, deleteDiaFestivo } from '../actions';

interface Props {
  empresaId: string | null;
  empleados: EmpleadoDetalle[];
}

const DIAS_FESTIVOS_LFT = [
  { fecha: '2026-01-01', descripcion: 'Año Nuevo' },
  { fecha: '2026-02-02', descripcion: 'Día de la Constitución (1er lunes feb)' },
  { fecha: '2026-03-16', descripcion: 'Natalicio de Benito Juárez (3er lunes mar)' },
  { fecha: '2026-05-01', descripcion: 'Día del Trabajo' },
  { fecha: '2026-09-16', descripcion: 'Día de la Independencia' },
  { fecha: '2026-10-05', descripcion: 'Día de la Revolución (3er lunes nov)' },
  { fecha: '2026-12-25', descripcion: 'Navidad' },
  { fecha: '2026-12-01', descripcion: 'Transmisión del Poder Ejecutivo (cada 6 años)' },
];

const DIAS_VACACIONES = [
  { anios: 1, dias: 12 },
  { anios: 2, dias: 14 },
  { anios: 3, dias: 16 },
  { anios: 4, dias: 18 },
  { anios: 5, dias: 20 },
  { anios: 10, dias: 22 },
  { anios: 15, dias: 24 },
  { anios: 20, dias: 26 },
  { anios: 25, dias: 28 },
];

function getDiasVacaciones(anios: number): number {
  if (anios >= 25) return 28;
  if (anios >= 20) return 26;
  if (anios >= 15) return 24;
  if (anios >= 10) return 22;
  if (anios >= 5) return 20;
  if (anios >= 4) return 18;
  if (anios >= 3) return 16;
  if (anios >= 2) return 14;
  if (anios >= 1) return 12;
  return 0;
}

function getAntiguedad(fechaIngreso: string): number {
  if (!fechaIngreso) return 0;
  const ingreso = new Date(fechaIngreso);
  const hoy = new Date();
  return Math.floor((hoy.getTime() - ingreso.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export default function ComplianceTab({ empresaId, empleados }: Props) {
  const [activeSection, setActiveSection] = useState<'festivos' | 'vacaciones' | 'alertas'>('festivos');
  const [festivos, setFestivos] = useState<any[]>([]);
  const [nuevoFestivo, setNuevoFestivo] = useState({ fecha: '', descripcion: '', es_recurrente: false });
  const [empVacaciones, setEmpVacaciones] = useState<string>('');

  const loadFestivos = useCallback(async () => {
    if (!empresaId) return;
    const data = await loadDiasFestivos(empresaId);
    setFestivos(data);
  }, [empresaId]);

  useEffect(() => { loadFestivos(); }, [loadFestivos]);

  const handleAddFestivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId || !nuevoFestivo.fecha) return;
    try {
      await saveDiaFestivo(empresaId, nuevoFestivo.fecha, nuevoFestivo.descripcion, nuevoFestivo.es_recurrente);
      setNuevoFestivo({ fecha: '', descripcion: '', es_recurrente: false });
      loadFestivos();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteFestivo = async (id: string) => {
    try {
      await deleteDiaFestivo(id);
      loadFestivos();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleSeedLFT = async () => {
    if (!empresaId) return;
    for (const f of DIAS_FESTIVOS_LFT) {
      try {
        await saveDiaFestivo(empresaId, f.fecha, f.descripcion, true);
      } catch { }
    }
    loadFestivos();
  };

  const empleadoSeleccionado = empleados.find(e => e.id === empVacaciones);
  const antiguedad = empleadoSeleccionado ? getAntiguedad(empleadoSeleccionado.fecha_ingreso) : 0;
  const diasVac = getDiasVacaciones(antiguedad);

  // Compliance alerts
  const alerts = empleados.map(emp => {
    const issues: string[] = [];
    const ant = getAntiguedad(emp.fecha_ingreso);
    if (!emp.curp) issues.push('Falta CURP');
    if (!emp.rfc) issues.push('Falta RFC');
    if (!emp.nss) issues.push('Falta NSS (IMSS)');
    if (!emp.zkteco_user_id) issues.push('Sin PIN biométrico');
    if (ant >= 1 && diasVac <= 0) issues.push('Vacaciones no registradas');
    if (emp.sueldo_diario < 250) issues.push('Salario menor al mínimo');
    return { empleado: emp, issues, antiguedad: ant };
  }).filter(a => a.issues.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 overflow-x-auto pb-px">
        {[
          { key: 'festivos', label: 'Días Festivos (Art. 74)', icon: Sun },
          { key: 'vacaciones', label: 'Vacaciones Dignas', icon: Calendar },
          { key: 'alertas', label: 'Alertas de Cumplimiento', icon: AlertTriangle },
        ].map(s => {
          const Icon = s.icon;
          return (
            <button key={s.key} onClick={() => setActiveSection(s.key as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs tracking-wider uppercase transition-all whitespace-nowrap ${
                activeSection === s.key
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}>
              <Icon size={16} /> {s.label}
            </button>
          );
        })}
      </div>

      {activeSection === 'festivos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100 uppercase">Agregar Festivo</h4>
            <form onSubmit={handleAddFestivo} className="space-y-3 text-xs">
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha</label>
                <input type="date" required value={nuevoFestivo.fecha} onChange={e => setNuevoFestivo({ ...nuevoFestivo, fecha: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800" /></div>
              <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Descripción</label>
                <input type="text" required value={nuevoFestivo.descripcion} onChange={e => setNuevoFestivo({ ...nuevoFestivo, descripcion: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800" /></div>
              <label className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <input type="checkbox" checked={nuevoFestivo.es_recurrente} onChange={e => setNuevoFestivo({ ...nuevoFestivo, es_recurrente: e.target.checked })} />
                Recurrente (cada año)
              </label>
              <button type="submit" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg">Agregar</button>
            </form>
            <button onClick={handleSeedLFT} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-xs">
              Seed: Días Festivos LFT 2026
            </button>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100 uppercase">Festivos Registrados</h4>
            <div className="space-y-2">
              {festivos.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{f.fecha}</span>
                    <span className="text-gray-900 dark:text-white">{f.descripcion}</span>
                    {f.es_recurrente && <span className="text-[9px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded font-bold">Recurrente</span>}
                  </div>
                  <button onClick={() => handleDeleteFestivo(f.id)} className="text-rose-500 hover:text-rose-600 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {festivos.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">No hay festivos registrados</p>}
            </div>
          </div>
        </div>
      )}

      {activeSection === 'vacaciones' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100 uppercase">Vacaciones por Empleado</h4>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Empleado</label>
              <select value={empVacaciones} onChange={e => setEmpVacaciones(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs">
                <option value="">Seleccionar...</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre_completo}</option>)}
              </select>
            </div>
            {empleadoSeleccionado && (
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                <p className="font-bold text-gray-900 dark:text-white">{empleadoSeleccionado.nombre_completo}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-gray-400">Ingreso:</span><br /><span className="font-bold">{empleadoSeleccionado.fecha_ingreso}</span></div>
                  <div><span className="text-gray-400">Antigüedad:</span><br /><span className="font-bold text-amber-600">{antiguedad} años</span></div>
                  <div><span className="text-gray-400">Vacaciones:</span><br /><span className="font-bold text-emerald-600">{diasVac} días</span></div>
                  <div><span className="text-gray-400">Prima Vac. (25%):</span><br /><span className="font-bold text-blue-600">${(empleadoSeleccionado.sueldo_diario * diasVac * 0.25).toFixed(2)}</span></div>
                </div>
              </div>
            )}
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100 uppercase">Tabla de Vacaciones Dignas (LFT)</h4>
            <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left text-xs">
                <thead><tr className="bg-gray-100/60 dark:bg-gray-900/40 text-gray-500 font-semibold">
                  <th className="p-3">Años</th><th className="p-3">Días Vac.</th><th className="p-3">Prima Vac. (25%)</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                  {DIAS_VACACIONES.map(d => (
                    <tr key={d.anios} className={`hover:bg-gray-50 dark:hover:bg-gray-900/10 ${d.anios === antiguedad ? 'bg-amber-500/10 font-bold' : ''}`}>
                      <td className="p-3">{d.anios === 1 ? '1 año' : `${d.anios} años`}</td>
                      <td className="p-3 font-bold text-emerald-600">{d.dias} días</td>
                      <td className="p-3 text-blue-600">{(d.dias * 0.25).toFixed(2)} días de salario</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <Info size={12} /> Vacaciones Dignas (reforma 2023): 12 días año 1, +2 hasta 20, luego +2 cada 5 años
            </p>
          </div>
        </div>
      )}

      {activeSection === 'alertas' && (
        <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-gray-800 dark:text-gray-100 uppercase flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={16} /> Alertas de Cumplimiento LFT
          </h4>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-emerald-600 bg-emerald-500/10 rounded-xl">
              <CheckCircle size={32} className="mx-auto mb-2" />
              <p className="font-bold">Todos los empleados cumplen con los requisitos LFT básicos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((a, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-gray-900 dark:text-white text-sm">{a.empleado.nombre_completo}</p>
                    <span className="text-[10px] text-gray-400">{a.antiguedad} años antigüedad</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {a.issues.map((issue, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-semibold">{issue}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <p className="font-bold text-gray-700 dark:text-gray-300">Art. 61 - Jornada</p>
              <p className="text-gray-500">Máx. 8 hrs diurnas / 7 nocturnas</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <p className="font-bold text-gray-700 dark:text-gray-300">Art. 69 - Descanso Semanal</p>
              <p className="text-gray-500">1 día por semana, preferentemente domingo</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <p className="font-bold text-gray-700 dark:text-gray-300">Art. 87 - Aguinaldo</p>
              <p className="text-gray-500">15 días mínimo, pago antes del 20 dic</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
