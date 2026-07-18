'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Sun, Users } from 'lucide-react';
import type { EmpleadoDetalle } from '../types';
import { loadPatronesDescanso, loadDescansosMensuales, generarDescansosMensuales, toggleDescansoMensual, toggleDescansoMensualDelete, bulkAssignDescansos } from '../actions';
import type { Departamento, Puesto } from '../types';

interface Props {
  empresaId: string | null;
  empleados: EmpleadoDetalle[];
  departamentos?: Departamento[];
  puestos?: Puesto[];
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CalendarioDescansos({ empresaId, empleados, departamentos = [], puestos = [] }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [descansos, setDescansos] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [patrones, setPatrones] = useState<any[]>([]);
  const [asignaciones, setAsignaciones] = useState<any[]>([]);

  // Bulk assign state
  const [bulkDate, setBulkDate] = useState('');
  const [bulkMotivo, setBulkMotivo] = useState<'patron' | 'cambio' | 'extraordinario'>('cambio');
  const [bulkFilterDepto, setBulkFilterDepto] = useState('');
  const [bulkFilterPuesto, setBulkFilterPuesto] = useState('');
  const [bulking, setBulking] = useState(false);

  const loadData = useCallback(async () => {
    if (!empresaId) return;
    try {
      const data = await loadPatronesDescanso(empresaId);
      setPatrones(data.patrones);
      setAsignaciones(data.asignaciones);

      const desc = await loadDescansosMensuales(empresaId, year, month);
      setDescansos(desc);
    } catch (e) {
      console.error(e);
    }
  }, [empresaId, year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const empleadoSeleccionado = empleados.find(e => e.id === selectedEmpId);
  const asignacion = asignaciones.find((a: any) => a.empleado_id === selectedEmpId);

  const isDescanso = (day: number): { esDescanso: boolean; motivo: string } | null => {
    const fecha = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = descansos.find((d: any) => d.empleado_id === selectedEmpId && d.fecha === fecha);
    if (d) return { esDescanso: d.es_descanso, motivo: d.motivo };
    return null;
  };

  const handleToggle = async (day: number) => {
    if (!selectedEmpId || !empresaId) return;
    const fecha = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = isDescanso(day);
    const newValue = existing ? !existing.esDescanso : true;
    const motivo = existing?.motivo === 'cambio' ? 'patron' : 'cambio';
    try {
      if (newValue) {
        await toggleDescansoMensual(selectedEmpId, fecha, true, motivo);
        setDescansos(prev => {
          const filtered = prev.filter((d: any) => !(d.empleado_id === selectedEmpId && d.fecha === fecha));
          return [...filtered, { empleado_id: selectedEmpId, fecha, es_descanso: true, motivo }];
        });
        setSaveMsg('✅ Descanso marcado');
      } else {
        await toggleDescansoMensualDelete(selectedEmpId, fecha);
        setDescansos(prev => prev.filter((d: any) => !(d.empleado_id === selectedEmpId && d.fecha === fecha)));
        setSaveMsg('❌ Descanso quitado');
      }
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (err: any) {
      const detail = err?.code ? `Código: ${err.code}\nMensaje: ${err.message}\nPista: ${err.hint || '(ninguna)'}` : (err.message || String(err));
      alert('Error al marcar descanso:\n' + detail);
      console.error('Toggle descanso error:', err);
    }
  };

  const handleGenerateMonth = async () => {
    if (!empresaId || !selectedEmpId) return;
    setGenerating(true);
    try {
      const count = await generarDescansosMensuales(empresaId, year, month);
      await loadData();
      setSaveMsg(`✅ ${count} descansos generados para el mes`);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      const detail = err?.code ? `Código: ${err.code}\nMensaje: ${err.message}\nPista: ${err.hint || '(ninguna)'}` : (err.message || String(err));
      alert('Error al generar:\n' + detail);
      console.error('Generate descanso error:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Bulk assign
  const filteredForBulk = empleados.filter(e => {
    if (e.activo === false) return false;
    if (bulkFilterDepto) {
      const p = puestos.find(p => p.id === e.puesto_id);
      if (!p || p.departamento_id !== bulkFilterDepto) return false;
    }
    if (bulkFilterPuesto && e.puesto_id !== bulkFilterPuesto) return false;
    return true;
  });

  const handleBulkAssign = async (esDescanso: boolean) => {
    if (!empresaId || !bulkDate) return;
    const ids = filteredForBulk.map(e => e.id);
    if (ids.length === 0) { alert('No hay empleados en el filtro seleccionado.'); return; }
    setBulking(true);
    try {
      const count = await bulkAssignDescansos(empresaId, bulkDate, ids, esDescanso, bulkMotivo);
      await loadData();
      setSaveMsg(`✅ ${count} empleados ${esDescanso ? 'marcados' : 'desmarcados'} para ${bulkDate}`);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      const detail = err?.code ? `Código: ${err.code}\nMensaje: ${err.message}\nPista: ${err.hint || '(ninguna)'}` : (err.message || String(err));
      alert('Error asignación múltiple:\n' + detail);
      console.error('Bulk assign error:', err);
    } finally {
      setBulking(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
            <Sun className="text-amber-500" size={18} /> Calendario de Descansos Mensuales
          </h3>
          <p className="text-xs text-gray-500 mt-1">Haz clic en un día para marcar/desmarcar como descanso</p>
        </div>
        {saveMsg && <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-3 py-1 rounded-lg">{saveMsg}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          {/* Month/Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <ChevronLeft size={20} className="text-gray-500" />
            </button>
            <h4 className="text-base font-bold text-gray-900 dark:text-white">
              {MONTHS[month - 1]} {year}
            </h4>
            <button onClick={() => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <ChevronRight size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase py-2">{d}</div>
            ))}
            {calendarCells.map((day, idx) => {
              if (day === null) return <div key={`e${idx}`} />;
              const today = new Date();
              const isToday = day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
              
              let esDesc = false;
              let motivo = '';
              let tooltip = '';
              let displayBadge = '';

              if (selectedEmpId) {
                const desc = isDescanso(day);
                esDesc = desc?.esDescanso ?? false;
                motivo = desc?.motivo || '';
                if (esDesc) {
                  displayBadge = 'DESC';
                }
              } else {
                const fecha = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayDescansos = descansos.filter((d: any) => d.fecha === fecha && d.es_descanso);
                if (dayDescansos.length > 0) {
                  esDesc = true;
                  motivo = 'todos';
                  displayBadge = `${dayDescansos.length} desc.`;
                  tooltip = dayDescansos.map((d: any) => d.empleados_detalle?.nombre_completo || 'Empleado').join('\n');
                }
              }

              const bgColor = selectedEmpId
                ? (esDesc
                  ? (motivo === 'cambio'
                    ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700'
                    : 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700')
                  : 'bg-gray-50 dark:bg-gray-900 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800')
                : (esDesc
                  ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 hover:bg-blue-200/50'
                  : 'bg-gray-50 dark:bg-gray-900 border-transparent hover:bg-gray-100 dark:hover:bg-gray-800');

              return (
                <button
                  key={day}
                  onClick={() => selectedEmpId && handleToggle(day)}
                  disabled={!selectedEmpId}
                  title={tooltip}
                  className={`aspect-square p-1 rounded-lg border text-xs font-semibold transition-all flex flex-col items-center justify-center ${bgColor} ${isToday ? 'ring-2 ring-amber-500' : ''} ${!selectedEmpId ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className={`${isToday ? 'text-amber-600' : esDesc ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>{day}</span>
                  {displayBadge && <span className="text-[7px] mt-0.5 text-blue-600 dark:text-blue-400 font-bold leading-none">{displayBadge}</span>}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 text-[10px] text-gray-500">
            {selectedEmpId ? (
              <>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300"></span> Descanso</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900/30 border border-orange-300"></span> Cambio</span>
              </>
            ) : (
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-300"></span> Días con Descansos (Pasa el cursor)</span>
            )}
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"></span> Laboral</span>
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="space-y-5">
          {/* Individual Employee */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Individual</h4>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Empleado</label>
              <select value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
                <option value="">Seleccionar...</option>
                {empleados.filter(e => e.activo !== false).map(e => (
                  <option key={e.id} value={e.id}>{e.nombre_completo}</option>
                ))}
              </select>
            </div>

            {asignacion && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-xs">
                <p className="font-bold text-gray-700 dark:text-gray-300">Patrón asignado:</p>
                <p className="text-gray-500">{patrones.find(p => p.id === asignacion.patron_id)?.nombre || 'N/A'}</p>
                <p className="text-gray-400 text-[10px]">Alterna: {asignacion.alterna ? 'Sí' : 'No'}</p>
              </div>
            )}

            <button onClick={handleGenerateMonth} disabled={generating || !selectedEmpId || !empresaId}
              className="w-full flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 disabled:dark:bg-gray-800 text-white transition-colors">
              <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
              {generating ? 'Generando...' : 'Generar Descansos del Mes'}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-800" />

          {/* Bulk Assign */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={13} /> Asignación Múltiple
            </h4>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha</label>
              <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Motivo</label>
              <select value={bulkMotivo} onChange={e => setBulkMotivo(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
                <option value="patron">Patrón</option>
                <option value="cambio">Cambio</option>
                <option value="extraordinario">Extraordinario</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Filtrar por Departamento</label>
              <select value={bulkFilterDepto} onChange={e => { setBulkFilterDepto(e.target.value); setBulkFilterPuesto(''); }}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
                <option value="">Todos</option>
                {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Filtrar por Puesto</label>
              <select value={bulkFilterPuesto} onChange={e => setBulkFilterPuesto(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
                <option value="">Todos</option>
                {puestos
                  .filter(p => !bulkFilterDepto || p.departamento_id === bulkFilterDepto)
                  .map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            <p className="text-[10px] text-gray-400 italic">{filteredForBulk.length} empleado(s) en el filtro</p>

            <div className="flex gap-2">
              <button onClick={() => handleBulkAssign(true)} disabled={bulking || !bulkDate || !empresaId}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-400 text-white transition-colors">
                {bulking ? 'Aplicando...' : 'Marcar Descanso'}
              </button>
              <button onClick={() => handleBulkAssign(false)} disabled={bulking || !bulkDate || !empresaId}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold px-3 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 disabled:bg-gray-400 text-white transition-colors">
                {bulking ? '...' : 'Quitar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
