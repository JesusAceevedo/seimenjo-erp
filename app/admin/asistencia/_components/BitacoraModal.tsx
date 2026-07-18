'use client';

import { useState } from 'react';
import { dashboardStat } from '../types';
import { createIncidencia } from '../actions';

interface Props {
  data: dashboardStat;
  onClose: () => void;
  onSaved?: () => void;
}

export default function BitacoraModal({ data, onClose, onSaved }: Props) {
  const [justifyingDay, setJustifyingDay] = useState<any | null>(null);
  const [form, setForm] = useState({
    tipo_incidencia: 'justificacion_falta',
    motivo: '',
    soporte: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSaveJustification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justifyingDay || saving) return;
    setSaving(true);
    try {
      const fullMotivo = `${form.motivo}${form.soporte ? ` (Soporte/Folio: ${form.soporte})` : ''}`;
      await createIncidencia({
        empleado_id: data.empleado.id,
        tipo_incidencia: form.tipo_incidencia,
        fecha_inicio: justifyingDay.date,
        fecha_fin: justifyingDay.date,
        total_dias: 1,
        motivo: fullMotivo,
        estatus: 'aprobado'
      });
      
      // Reset form
      setJustifyingDay(null);
      setForm({ tipo_incidencia: 'justificacion_falta', motivo: '', soporte: '' });
      
      // Trigger reload
      if (onSaved) onSaved();
      alert('✅ Justificación guardada y aplicada con éxito');
    } catch (err: any) {
      alert('Error al guardar justificación: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Bitácora de Asistencia</h3>
            <p className="text-xs text-gray-500 mt-1">{data.empleado.nombre_completo}</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg transition-colors">Cerrar</button>
        </div>
        <div className="px-6 pt-6">
          <div className="grid grid-cols-4 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-xl text-center border border-gray-100 dark:border-gray-800">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Faltas</p>
              <p className="text-base font-bold text-rose-500">{data.faltas}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Retardos</p>
              <p className="text-base font-bold text-amber-500">{data.retardos}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Sal. Temprano</p>
              <p className="text-base font-bold text-amber-600">{data.salidasTemprano}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">H. Extras</p>
              <p className="text-base font-bold text-emerald-500">{data.horasExtras} hrs</p>
            </div>
          </div>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-2 max-h-[50vh]">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Desglose de Jornada</h4>
          <div className="divide-y divide-gray-100 dark:divide-gray-800/40">
            {data.dailyDetails.map((day: any, idx: number) => {
              const dateParts = day.date.split('-');
              const formattedDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]), 12, 0, 0)
                .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
              
              const statusLower = day.status.toLowerCase();
              const isAbsent = statusLower === 'falta';
              const hasLate = day.detail.includes('(Retardo)');
              const isIncomplete = day.detail.includes('(Incompleta)') || day.detail.includes('(Salida Temprano)');
              const canJustify = isAbsent || hasLate || isIncomplete;

              return (
                <div key={idx} className="border-b border-gray-100 dark:border-gray-800/40 last:border-0">
                  <div className="py-3 flex items-center justify-between text-xs hover:bg-gray-50/50 dark:hover:bg-gray-900/10 px-1 rounded transition-colors">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-white capitalize block">{formattedDate}</span>
                      <span className="text-[9px] text-gray-400">{day.date}</span>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div className="space-y-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold block text-right ${day.color}`}>{day.status.toUpperCase()}</span>
                        <span className="block text-[10px] font-mono text-gray-500 dark:text-gray-300">{day.detail}</span>
                      </div>
                      {canJustify && (!justifyingDay || justifyingDay.date !== day.date) && (
                        <button
                          onClick={() => {
                            let defaultType = 'justificacion_falta';
                            if (hasLate) defaultType = 'justificacion_retardo';
                            else if (isIncomplete) defaultType = 'omision_salida';
                            
                            setForm({ tipo_incidencia: defaultType, motivo: '', soporte: '' });
                            setJustifyingDay(day);
                          }}
                          className="text-[9px] font-bold text-amber-600 hover:text-amber-500 bg-amber-500/10 px-2 py-1 rounded transition-colors"
                        >
                          Justificar
                        </button>
                      )}
                    </div>
                  </div>
                  {justifyingDay && justifyingDay.date === day.date && (
                    <form onSubmit={handleSaveJustification} className="p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-amber-500/20 text-xs space-y-3 mb-3">
                      <p className="font-bold text-amber-600 dark:text-amber-400">Crear Justificación para este día</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Tipo de Justificación</label>
                          <select
                            value={form.tipo_incidencia}
                            onChange={e => setForm({ ...form, tipo_incidencia: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded focus:outline-none"
                          >
                            <option value="justificacion_falta">Justificar Falta</option>
                            <option value="justificacion_retardo">Justificar Retardo</option>
                            <option value="omision_entrada">Omisión Checada Entrada</option>
                            <option value="omision_salida">Omisión Checada Salida</option>
                            <option value="justificacion_omision">Omisión General / Otro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Soporte (Folio / Enlace)</label>
                          <input
                            type="text"
                            value={form.soporte}
                            onChange={e => setForm({ ...form, soporte: e.target.value })}
                            placeholder="Ej. Receta médica, Pase, etc."
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-gray-500 uppercase mb-1">Motivo / Comentarios *</label>
                        <textarea
                          required
                          rows={2}
                          value={form.motivo}
                          onChange={e => setForm({ ...form, motivo: e.target.value })}
                          placeholder="Explicación detallada..."
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setJustifyingDay(null)}
                          className="px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded font-bold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold transition-colors"
                        >
                          {saving ? 'Guardando...' : 'Guardar Justificación'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
