'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  Departamento, Puesto, StaffMember, EmpleadoDetalle,
  Turno, HorarioEmpleado, ChecadaRaw, Incidencia, TabId,
  dashboardStat, ZkTecoComando
} from '../types';

export function useAsistencia() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('monitoreo');

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoDetalle[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [checadasRaw, setChecadasRaw] = useState<ChecadaRaw[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [horariosEmpleados, setHorariosEmpleados] = useState<any[]>([]);
  const [descansosMensuales, setDescansosMensuales] = useState<any[]>([]);
  const [comandos, setComandos] = useState<ZkTecoComando[]>([]);

  const [presenciaHoy, setPresenciaHoy] = useState<any[]>([]);

  // Calculate current fortnight dates (1-15 or 16-30/31)
  const getFortnightDates = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    let start: Date;
    let end: Date;
    if (day <= 15) {
      start = new Date(year, month, 1);
      end = new Date(year, month, 15);
    } else {
      start = new Date(year, month, 16);
      end = new Date(year, month + 1, 0);
    }
    const toLocalISO = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayVal = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayVal}`;
    };
    return { startDate: toLocalISO(start), endDate: toLocalISO(end) };
  };

  const defaultDates = getFortnightDates();

  const [dashboardStartDate, setDashboardStartDate] = useState(defaultDates.startDate);
  const [dashboardEndDate, setDashboardEndDate] = useState(defaultDates.endDate);

  const loadContext = useCallback(async () => {
    try {
      const sesionGuardada = localStorage.getItem('seimenjo_session');
      if (sesionGuardada) {
        const datos = JSON.parse(sesionGuardada);
        if (datos.empresa_id) {
          setEmpresaId(datos.empresa_id);
          return;
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: staff } = await supabase
        .from('usuarios_staff')
        .select('empresa_id')
        .eq('supabase_auth_id', session.user.id)
        .maybeSingle();
      if (staff) setEmpresaId(staff.empresa_id);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const [depts, pst, stf, empl, trn, chk, inc, hrEmp, descMens] = await Promise.all([
        supabase.from('departamentos').select('*').eq('empresa_id', empresaId).order('nombre'),
        supabase.from('puestos_trabajo').select('*, departamentos(nombre)').eq('empresa_id', empresaId).order('nombre'),
        supabase.from('usuarios_staff').select('id, correo, activo').eq('empresa_id', empresaId),
        supabase.from('empleados_detalle').select('*').eq('empresa_id', empresaId).order('nombre_completo'),
        supabase.from('turnos').select('*').eq('empresa_id', empresaId).order('nombre'),
        (() => {
          const from = new Date(); from.setDate(from.getDate() - 30);
          return supabase.from('asistencia_checadas_raw').select('*').eq('empresa_id', empresaId).gte('timestamp', from.toISOString()).order('timestamp', { ascending: false });
        })(),
        supabase.from('incidencias_solicitudes').select('*, empleados_detalle(nombre_completo)').order('fecha_inicio', { ascending: false }),
        supabase.from('horarios_empleados').select('*'),
        supabase.from('descansos_mensuales').select('*')
      ]);

      setDepartamentos(depts.data ?? []);
      setPuestos(pst.data ?? []);
      setStaffList(stf.data ?? []);
      setEmpleados(empl.data ?? []);
      setTurnos(trn.data ?? []);
      setChecadasRaw(chk.data ?? []);
      setIncidencias(inc.data ?? []);
      setHorariosEmpleados(hrEmp.data ?? []);
      setDescansosMensuales(descMens.data ?? []);

      calculateRealtimePresencia(chk.data ?? [], empl.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => { loadContext(); }, [loadContext]);
  useEffect(() => { if (empresaId) loadData(); }, [empresaId, loadData]);

  const calculateRealtimePresencia = (rawLogs: ChecadaRaw[], employees: EmpleadoDetalle[]) => {
    const localTodayStr = new Date().toLocaleDateString('en-CA');
    const presenceMap = new Map<string, { lastCheck: string; status: 'PRESENTE' | 'AUSENTE'; log: any }>();
    employees.forEach(emp => {
      if (emp.zkteco_user_id) {
        presenceMap.set(emp.zkteco_user_id, { lastCheck: '--:--', status: 'AUSENTE', log: null });
      }
    });

    // Group logs of today by employee pin
    const logsByEmp = new Map<string, ChecadaRaw[]>();
    rawLogs
      .filter(l => new Date(l.timestamp).toLocaleDateString('en-CA') === localTodayStr)
      .forEach(log => {
        if (!logsByEmp.has(log.zkteco_user_id)) {
          logsByEmp.set(log.zkteco_user_id, []);
        }
        logsByEmp.get(log.zkteco_user_id)!.push(log);
      });

    // Determine status for each employee based on log count and last log
    logsByEmp.forEach((empLogs, pin) => {
      const current = presenceMap.get(pin);
      if (!current) return;

      // Sort chronologically
      empLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const lastLog = empLogs[empLogs.length - 1];
      const timeStr = new Date(lastLog.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let status: 'PRESENTE' | 'AUSENTE' = 'AUSENTE';
      if (empLogs.length === 1) {
        // If there's only 1 check-in log today, they must be present (prevents device state error registering CHECKOUT at arrival)
        status = 'PRESENTE';
      } else {
        // If there are multiple logs, look at the last log type
        status = lastLog.tipo_evento === 'CHECKIN' || lastLog.tipo_evento === 'BREAK_IN' ? 'PRESENTE' : 'AUSENTE';
      }

      presenceMap.set(pin, {
        lastCheck: timeStr,
        status,
        log: lastLog
      });
    });

    const list = employees.map(emp => {
      const state = presenceMap.get(emp.zkteco_user_id) || { lastCheck: '--:--', status: 'AUSENTE', log: null };
      return { empleado: emp, ...state };
    });
    setPresenciaHoy(list);
  };

  const dashboardStats: dashboardStat[] = (() => {
    if (!dashboardStartDate || !dashboardEndDate || empleados.length === 0) return [];
    const dateArray: string[] = [];
    let current = new Date(dashboardStartDate + 'T00:00:00');
    const end = new Date(dashboardEndDate + 'T23:59:59');
    while (current <= end) {
      dateArray.push(current.toLocaleDateString('en-CA'));
      current.setDate(current.getDate() + 1);
    }
    const todayLocalStr = new Date().toLocaleDateString('en-CA');
    return empleados.map(emp => {
      const empLogs = checadasRaw.filter(l => l.zkteco_user_id === emp.zkteco_user_id);
      let faltas = 0, retardos = 0, salidasTemprano = 0, horasExtras = 0, totalHorasTrabajadas = 0;
      const dailyDetails: any[] = [];
      dateArray.forEach(dateStr => {
        const parts = dateStr.split('-');
        const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
        const dayOfWeek = dateObj.getDay();
        const schedule = horariosEmpleados.find(h => h.empleado_id === emp.id && h.dia_semana === dayOfWeek);
        
        // Buscar anulación/override en descansos mensuales
        const descOverride = descansosMensuales.find(dm => dm.empleado_id === emp.id && dm.fecha === dateStr);
        let esDiaDescanso = schedule ? schedule.es_dia_descanso : true;
        if (descOverride !== undefined) {
          esDiaDescanso = descOverride.es_descanso;
        }

        const hasIncidence = incidencias.find(i =>
          i.empleado_id === emp.id && dateStr >= i.fecha_inicio && dateStr <= i.fecha_fin && i.estatus === 'aprobado'
        );
        const dayLogs = empLogs
          .filter(l => new Date(l.timestamp).toLocaleDateString('en-CA') === dateStr)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const hasChecked = dayLogs.length > 0;

        // Identificar si tiene justificaciones aprobadas específicas de asistencia
        const excFalta = hasIncidence && hasIncidence.tipo_incidencia === 'justificacion_falta';
        const excRetardo = hasIncidence && hasIncidence.tipo_incidencia === 'justificacion_retardo';
        const excOmision = hasIncidence && (hasIncidence.tipo_incidencia === 'omision_entrada' || hasIncidence.tipo_incidencia === 'omision_salida' || hasIncidence.tipo_incidencia === 'justificacion_omision');

        if (schedule && schedule.turno_id && !esDiaDescanso) {
          const turno = turnos.find(t => t.id === schedule.turno_id);
          
          if (hasIncidence && !excFalta && !excRetardo && !excOmision) {
            if (hasIncidence.tipo_incidencia === 'descanso_programado') {
              dailyDetails.push({
                date: dateStr,
                status: hasChecked ? 'Descanso Laborado' : 'Descanso',
                detail: hasChecked ? `Entrada: ${new Date(dayLogs[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Día libre (Excepción)',
                color: hasChecked ? 'text-blue-600 bg-blue-500/10 border border-blue-500/20 font-semibold' : 'text-gray-400 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800'
              });
            } else {
              dailyDetails.push({
                date: dateStr, status: 'Incidencia',
                detail: hasIncidence.tipo_incidencia.toUpperCase().replace(/_/g, ' '),
                color: 'text-amber-600 bg-amber-500/10 border border-amber-500/20'
              });
            }
          } else if (!hasChecked) {
            if (excFalta) {
              dailyDetails.push({
                date: dateStr, status: 'Falta Justificada',
                detail: hasIncidence.motivo || 'Falta justificada administrativamente',
                color: 'text-blue-600 bg-blue-500/10 border border-blue-500/20 font-semibold'
              });
            } else if (excOmision) {
              dailyDetails.push({
                date: dateStr, status: 'Omisión Justificada',
                detail: hasIncidence.motivo || 'Omisión de checada justificada',
                color: 'text-indigo-600 bg-indigo-500/10 border border-indigo-500/20 font-semibold'
              });
            } else if (dateStr <= todayLocalStr) {
              faltas += 1;
              dailyDetails.push({ date: dateStr, status: 'Falta', detail: 'Sin registros', color: 'text-rose-600 bg-rose-500/10 border border-rose-500/20 font-semibold' });
            } else {
              dailyDetails.push({ date: dateStr, status: 'Programado', detail: turno ? turno.nombre : 'Turno', color: 'text-gray-400 bg-gray-100 dark:bg-gray-800' });
            }
          } else {
            const entrada = new Date(dayLogs[0].timestamp);
            const entradaStr = entrada.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let salidaStr = '--:--', isRetardo = false, isSalidaTemprano = false;
            
            if (turno) {
              const [hIn, mIn] = turno.hora_entrada_1.split(':').map(Number);
              const limitTime = new Date(entrada);
              limitTime.setHours(hIn, mIn + (turno.tolerancia_minutos || 0), 59, 999);
              if (entrada > limitTime) {
                if (excRetardo || excOmision) {
                  isRetardo = false;
                } else {
                  retardos += 1;
                  isRetardo = true;
                }
              }
            }
            
            if (dayLogs.length > 1) {
              const salida = new Date(dayLogs[dayLogs.length - 1].timestamp);
              salidaStr = salida.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              if (turno) {
                const [hOut, mOut] = turno.hora_salida_1.split(':').map(Number);
                const limitTimeOut = new Date(salida);
                limitTimeOut.setHours(hOut, mOut, 0, 0);
                if (salida < limitTimeOut) {
                  if (excOmision) {
                    isSalidaTemprano = false;
                  } else {
                    salidasTemprano += 1;
                    isSalidaTemprano = true;
                  }
                }
              }
              const hoursWorked = (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60);
              totalHorasTrabajadas += hoursWorked;
              if (hoursWorked > 8) horasExtras += (hoursWorked - 8);
            } else {
              if (excOmision) {
                isSalidaTemprano = false;
                salidaStr = 'Justificada';
              } else {
                isSalidaTemprano = true;
                salidasTemprano += 1;
              }
            }
            
            let statusDetail = `${entradaStr} - ${salidaStr}`;
            if (isRetardo) statusDetail += ' (Retardo)';
            if (hasIncidence && (excRetardo || excOmision)) {
              statusDetail += ` (${hasIncidence.tipo_incidencia === 'justificacion_retardo' ? 'Retardo Justif.' : 'Justificada'})`;
            }
            if (isSalidaTemprano && dayLogs.length === 1) statusDetail += ' (Incompleta)';
            else if (isSalidaTemprano) statusDetail += ' (Salida Temprano)';
            
            dailyDetails.push({
              date: dateStr,
              status: hasIncidence && (excRetardo || excOmision) ? 'Asistencia Justificada' : 'Asistencia',
              detail: statusDetail,
              color: isRetardo || isSalidaTemprano
                ? 'text-amber-700 bg-amber-500/10 border border-amber-500/20'
                : hasIncidence && (excRetardo || excOmision)
                  ? 'text-indigo-700 bg-indigo-500/10 border border-indigo-500/20 font-semibold'
                  : 'text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 font-semibold'
            });
          }
        } else {
          if (hasChecked) {
            dailyDetails.push({
              date: dateStr, status: 'Descanso Laborado',
              detail: `Entrada: ${new Date(dayLogs[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              color: 'text-blue-600 bg-blue-500/10 border border-blue-500/20 font-semibold'
            });
          } else {
            dailyDetails.push({ date: dateStr, status: 'Descanso', detail: 'Día libre', color: 'text-gray-400 bg-gray-50 dark:bg-gray-900' });
          }
        }
      });
      return { empleado: emp, faltas, retardos, salidasTemprano, horasExtras: Math.round(horasExtras * 10) / 10, totalHorasTrabajadas: Math.round(totalHorasTrabajadas * 10) / 10, dailyDetails };
    });
  })();

  return {
    empresaId, loading, activeTab, setActiveTab,
    departamentos, puestos, staffList, empleados, turnos, checadasRaw, incidencias, horariosEmpleados, comandos,
    presenciaHoy, dashboardStartDate, dashboardEndDate,
    setDashboardStartDate, setDashboardEndDate,
    dashboardStats, loadData, setComandos
  };
}
