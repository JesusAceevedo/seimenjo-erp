'use client';

import { useState, useEffect } from 'react';
import type { EmpleadoDetalle, Turno } from '../types';
import { saveHorarioIndividual } from '../actions';

interface Props {
  empleado: EmpleadoDetalle;
  horariosEmpleados: any[];
  turnos: Turno[];
  onClose: () => void;
  onSaved: () => void;
}

export default function HorarioIndividualModal({ empleado, horariosEmpleados, turnos, onClose, onSaved }: Props) {
  const [schedule, setSchedule] = useState<{ [key: number]: { turno_id: string | null; es_dia_descanso: boolean } }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initial: typeof schedule = {};
    for (let i = 0; i <= 6; i++) {
      initial[i] = { turno_id: null, es_dia_descanso: true };
    }
    horariosEmpleados
      .filter((h: any) => h.empleado_id === empleado.id)
      .forEach((h: any) => {
        initial[h.dia_semana] = { turno_id: h.turno_id, es_dia_descanso: h.es_dia_descanso };
      });
    setSchedule(initial);
  }, [empleado, horariosEmpleados]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const upsertData = Object.keys(schedule).map(dayKey => {
        const dayNum = Number(dayKey);
        const item = schedule[dayNum];
        return {
          empleado_id: empleado.id,
          dia_semana: dayNum,
          turno_id: item.es_dia_descanso ? null : item.turno_id,
          es_dia_descanso: item.es_dia_descanso
        };
      });
      await saveHorarioIndividual(upsertData);
      onSaved();
    } catch (err: any) {
      alert('Error al guardar horario: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Asignar Horario Semanal</h3>
            <p className="text-xs text-gray-500 mt-1">{empleado.nombre_completo}</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg transition-colors">Cerrar</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {dayNames.map((dayName, idx) => {
            const dayVal = idx === 0 ? 0 : idx;
            const item = schedule[dayVal] || { turno_id: null, es_dia_descanso: true };
            return (
              <div key={dayVal} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <span className="font-bold text-gray-800 dark:text-gray-200 w-24">{dayName}</span>
                <div className="flex-1 flex gap-3 items-center">
                  <select
                    value={item.es_dia_descanso ? 'descanso' : (item.turno_id || '')}
                    onChange={e => {
                      const val = e.target.value;
                      setSchedule(prev => {
                        const updated = { ...prev };
                        if (val === 'descanso') {
                          updated[dayVal] = { turno_id: null, es_dia_descanso: true };
                        } else {
                          updated[dayVal] = { turno_id: val, es_dia_descanso: false };
                        }
                        return updated;
                      });
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="descanso">Día de Descanso</option>
                    {turnos.map(t => (
                      <option key={t.id} value={t.id}>Turno: {t.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-lg transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 text-white text-xs font-bold rounded-lg transition-colors">
            {saving ? 'Guardando...' : 'Guardar Horario'}
          </button>
        </div>
      </div>
    </div>
  );
}
