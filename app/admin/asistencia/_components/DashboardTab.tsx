'use client';

import { useState, useMemo } from 'react';
import { RefreshCw, Clock, Settings, Sliders, UserCheck, AlertCircle, Award, DollarSign, TrendingUp, Filter, Sun, Bell, Download } from 'lucide-react';
import type { dashboardStat, ChecadaRaw, EmpleadoDetalle, Puesto, Departamento } from '../types';
import BitacoraModal from './BitacoraModal';

interface Props {
  dashboardStats: dashboardStat[];
  dashboardStartDate: string;
  dashboardEndDate: string;
  onStartDateChange: (d: string) => void;
  onEndDateChange: (d: string) => void;
  empleados: EmpleadoDetalle[];
  puestos: Puesto[];
  departamentos: Departamento[];
  horariosEmpleados: any[];
  turnos: any[];
  checadasRaw: ChecadaRaw[];
  presenciaHoy: any[];
  onSyncTime: () => void;
  syncingTime: boolean;
  onSaved?: () => void;
}

export default function DashboardTab({
  dashboardStats, dashboardStartDate, dashboardEndDate,
  onStartDateChange, onEndDateChange, empleados, puestos, departamentos,
  horariosEmpleados, turnos, checadasRaw, presenciaHoy,
  onSyncTime, syncingTime, onSaved
}: Props) {
  const [selectedStat, setSelectedStat] = useState<dashboardStat | null>(null);

  const handleDownloadExcel = () => {
    if (checadasRaw.length === 0) {
      alert('No hay movimientos registrados para descargar.');
      return;
    }
    
    // Headers: PIN, Nombre, Fecha, Hora, Tipo Evento, Dispositivo SN
    const headers = ['PIN', 'Nombre Empleado', 'Fecha', 'Hora', 'Tipo Evento', 'Dispositivo SN'];
    
    const rows = checadasRaw.map(log => {
      const emp = empleados.find(e => e.zkteco_user_id === log.zkteco_user_id);
      const name = emp ? `${emp.primer_nombre} ${emp.primer_apellido}`.trim() : 'Desconocido';
      const dateObj = new Date(log.timestamp);
      const dateStr = dateObj.toLocaleDateString('es-MX');
      const timeStr = dateObj.toLocaleTimeString('es-MX');
      return [
        log.zkteco_user_id || '',
        name,
        dateStr,
        timeStr,
        log.tipo_evento || '',
        log.dispositivo_sn || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `movimientos_reloj_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filters
  const [filtroDepto, setFiltroDepto] = useState<string>('');
  const [filtroPuesto, setFiltroPuesto] = useState<string>('');

  const empleadosConPuesto = useMemo(() => empleados.map(emp => {
    const puesto = puestos.find(p => p.id === emp.puesto_id);
    const depto = puesto ? departamentos.find(d => d.id === puesto.departamento_id) : null;
    return { ...emp, puesto, depto };
  }), [empleados, puestos, departamentos]);

  const filteredStats = useMemo(() => {
    return dashboardStats.filter(s => {
      const emp = empleadosConPuesto.find(e => e.id === s.empleado.id);
      if (!emp) return true;
      if (filtroDepto && emp.depto?.id !== filtroDepto) return false;
      if (filtroPuesto && emp.puesto?.id !== filtroPuesto) return false;
      return true;
    });
  }, [dashboardStats, filtroDepto, filtroPuesto, empleadosConPuesto]);

  // Metrics
  const totalFaltas = filteredStats.reduce((a, c) => a + c.faltas, 0);
  const totalRetardos = filteredStats.reduce((a, c) => a + c.retardos, 0);
  const totalSalidas = filteredStats.reduce((a, c) => a + c.salidasTemprano, 0);
  const totalExtras = filteredStats.reduce((a, c) => a + c.horasExtras, 0);

  // Cost tracking
  const costos = useMemo(() => {
    let sueldoDevengado = 0;
    let costoExtras = 0;
    for (const stat of filteredStats) {
      const emp = empleados.find(e => e.id === stat.empleado.id);
      const sd = emp?.sueldo_diario || 250;
      const diasConDatos = stat.dailyDetails.filter((d: any) => d.status === 'Asistencia' || d.status === 'Descanso Laborado').length;
      sueldoDevengado += sd * diasConDatos;
      costoExtras += stat.horasExtras * (sd / 8) * 2; // Costo aprox de extras (dobles)
    }
    return { sueldoDevengado, costoExtras, total: sueldoDevengado + costoExtras };
  }, [filteredStats, empleados]);

  // Alerts
  const alerts = useMemo(() => {
    const list: { empleado: string; tipo: string; desc: string; severity: 'high' | 'medium' | 'low' }[] = [];
    for (const stat of filteredStats) {
      if (stat.faltas >= 3) list.push({ empleado: stat.empleado.nombre_completo || '', tipo: 'Faltas', desc: `${stat.faltas} faltas en el período`, severity: 'high' });
      if (stat.retardos >= 5) list.push({ empleado: stat.empleado.nombre_completo || '', tipo: 'Retardos', desc: `${stat.retardos} retardos, requiere atención`, severity: 'medium' });
      if (stat.horasExtras > 12) list.push({ empleado: stat.empleado.nombre_completo || '', tipo: 'Horas Extra', desc: `${stat.horasExtras} hrs extra, posible sobretiempo excesivo`, severity: 'high' });
    }
    return list;
  }, [filteredStats]);

  // Presence today stats
  const presentes = presenciaHoy.filter(p => p.status === 'PRESENTE').length;
  const ausentes = presenciaHoy.filter(p => p.status === 'AUSENTE').length;

  return (
    <div className="space-y-6">
      {/* Controls Row: Date Range + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input type="date" value={dashboardStartDate} onChange={e => onStartDateChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-500" />
            <span className="text-gray-400 text-xs font-semibold">→</span>
            <input type="date" value={dashboardEndDate} onChange={e => onEndDateChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-500" />
          </div>
          <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-800 pl-3">
            <Filter size={14} className="text-gray-400" />
            <select value={filtroDepto} onChange={e => { setFiltroDepto(e.target.value); setFiltroPuesto(''); }}
              className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
              <option value="">Todos los Departamentos</option>
              {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
            <select value={filtroPuesto} onChange={e => setFiltroPuesto(e.target.value)}
              className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500">
              <option value="">Todos los Puestos</option>
              {puestos
                .filter(p => !filtroDepto || p.departamento_id === filtroDepto)
                .map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Row: 8 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-rose-500 mb-1"><span className="text-[10px] font-bold uppercase tracking-wider">Faltas</span><AlertCircle size={16} /></div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{totalFaltas}</p>
          <p className="text-[9px] text-gray-400">Ausencias injustificadas</p>
        </div>
        <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-amber-500 mb-1"><span className="text-[10px] font-bold uppercase tracking-wider">Retardos</span><Clock size={16} /></div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{totalRetardos}</p>
          <p className="text-[9px] text-gray-400">Llegadas tarde</p>
        </div>
        <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 mb-1"><span className="text-[10px] font-bold uppercase tracking-wider">Salidas Temprano</span><Sliders size={16} /></div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{totalSalidas}</p>
          <p className="text-[9px] text-gray-400">Antes del horario</p>
        </div>
        <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-emerald-500 mb-1"><span className="text-[10px] font-bold uppercase tracking-wider">Horas Extra</span><Award size={16} /></div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{totalExtras} hrs</p>
          <p className="text-[9px] text-gray-400">Excedentes del período</p>
        </div>
        <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-1"><span className="text-[10px] font-bold uppercase tracking-wider">En Turno</span><UserCheck size={16} /></div>
          <p className="text-xl font-bold text-emerald-600">{presentes}</p>
          <p className="text-[9px] text-gray-400">Empleados presentes hoy</p>
        </div>
        <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-1"><span className="text-[10px] font-bold uppercase tracking-wider">Ausentes</span><Sun size={16} /></div>
          <p className="text-xl font-bold text-gray-500">{ausentes}</p>
          <p className="text-[9px] text-gray-400">Sin checar hoy</p>
        </div>
        <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-blue-500 mb-1"><span className="text-[10px] font-bold uppercase tracking-wider">Costo Sueldos</span><DollarSign size={16} /></div>
          <p className="text-xl font-bold text-blue-600">${costos.sueldoDevengado.toLocaleString()}</p>
          <p className="text-[9px] text-gray-400">Sueldo ordinario devengado</p>
        </div>
        <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 mb-1"><span className="text-[10px] font-bold uppercase tracking-wider">Costo Extras</span><TrendingUp size={16} /></div>
          <p className="text-xl font-bold text-amber-600">${costos.costoExtras.toLocaleString()}</p>
          <p className="text-[9px] text-gray-400">Costo estimado horas extra</p>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase"><Bell size={14} /> Alertas ({alerts.length})</div>
          <div className="flex flex-wrap gap-2">
            {alerts.map((a, i) => (
              <span key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 ${
                a.severity === 'high' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'
              }`}>
                {a.empleado}: {a.desc}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Table + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
              <UserCheck className="text-emerald-500" size={18} /> Asistencia de Personal
              {filteredStats.length !== dashboardStats.length && (
                <span className="text-[10px] font-normal text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{filteredStats.length} de {dashboardStats.length}</span>
              )}
            </h3>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-gray-100/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold">
                  <th className="p-3">Empleado</th>
                  <th className="p-3">Puesto</th>
                  <th className="p-3 text-center">Faltas</th>
                  <th className="p-3 text-center">Retardos</th>
                  <th className="p-3 text-center">Hrs Extra</th>
                  <th className="p-3 text-right">Bitácora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                {filteredStats.map((stat, idx) => {
                  const emp = empleadosConPuesto.find(e => e.id === stat.empleado.id);
                  return (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                      <td className="p-3">
                        <span className="font-semibold text-gray-900 dark:text-white block">{stat.empleado.nombre_completo}</span>
                        <span className="text-[10px] text-gray-400">{emp?.depto?.nombre || ''}</span>
                      </td>
                      <td className="p-3 text-gray-500">{emp?.puesto?.nombre || '—'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${stat.faltas > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>{stat.faltas}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${stat.retardos > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>{stat.retardos}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${stat.horasExtras > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>{stat.horasExtras} hrs</span>
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => setSelectedStat(stat)} className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded font-semibold text-[10px] transition-colors">Ver</button>
                      </td>
                    </tr>
                  );
                })}
                {filteredStats.length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-center text-gray-400 italic">No hay datos para el filtro seleccionado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-1">
          {/* Presence Today */}
          <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
              <UserCheck className="text-emerald-500" size={16} /> Presencia Hoy
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {presenciaHoy.length === 0 && <p className="text-xs text-gray-400 italic text-center py-4">Sin datos de hoy</p>}
              {presenciaHoy.slice(0, 15).map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${p.status === 'PRESENTE' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <span className="font-semibold text-gray-900 dark:text-white">{p.empleado.nombre_completo}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold ${p.status === 'PRESENTE' ? 'text-emerald-600' : 'text-gray-400'}`}>{p.status}</span>
                    <span className="text-[9px] text-gray-400 ml-2">{p.lastCheck}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Device */}
          <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
              <Settings className="text-amber-500" size={16} /> Reloj Checador
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onSyncTime} disabled={syncingTime}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-gray-400 text-white transition-colors">
                <RefreshCw size={13} className={syncingTime ? 'animate-spin' : ''} />
                {syncingTime ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button onClick={handleDownloadExcel}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors">
                <Download size={13} />
                Descargar Excel
              </button>
            </div>
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {checadasRaw.slice(0, 8).map(log => {
                const emp = empleados.find(e => e.zkteco_user_id === log.zkteco_user_id);
                return (
                  <div key={log.id} className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{emp ? emp.nombre_completo : `PIN: ${log.zkteco_user_id}`}</p>
                      <p className="text-[9px] text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                      log.tipo_evento === 'CHECKIN' ? 'bg-blue-500/10 text-blue-600' : 'bg-orange-500/10 text-orange-600'
                    }`}>{log.tipo_evento}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedStat && (
        <BitacoraModal
          data={selectedStat}
          onClose={() => setSelectedStat(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
