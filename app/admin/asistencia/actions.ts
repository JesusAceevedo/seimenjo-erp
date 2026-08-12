'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

function getServerSupabase() {
  return supabaseAdmin;
}

export async function getEmpresaId(): Promise<string | null> {
  try {
    const { data } = await getServerSupabase()
      .from('empresas')
      .select('id')
      .limit(1)
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export async function loadDepartamentos(empresaId: string) {
  const { data } = await getServerSupabase()
    .from('departamentos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nombre');
  return data ?? [];
}

export async function loadPuestos(empresaId: string) {
  const { data } = await getServerSupabase()
    .from('puestos_trabajo')
    .select('*, departamentos(nombre)')
    .eq('empresa_id', empresaId)
    .order('nombre');
  return data ?? [];
}

export async function loadEmpleados(empresaId: string) {
  const { data } = await getServerSupabase()
    .from('empleados_detalle')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nombre_completo');
  if (!data) return [];
  const seen = new Set<string>();
  return data.filter(e => {
    const key = (e.nombre_completo || e.id || '').trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function loadTurnos(empresaId: string) {
  const { data } = await getServerSupabase()
    .from('turnos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('nombre');
  return data ?? [];
}

export async function loadChecadasRaw(empresaId: string, daysBack = 30) {
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const { data } = await getServerSupabase()
    .from('asistencia_checadas_raw')
    .select('*')
    .eq('empresa_id', empresaId)
    .gte('timestamp', from.toISOString())
    .order('timestamp', { ascending: false });
  return data ?? [];
}

export async function loadIncidencias() {
  const { data } = await getServerSupabase()
    .from('incidencias_solicitudes')
    .select('*, empleados_detalle(nombre_completo)')
    .order('fecha_inicio', { ascending: false });
  return data ?? [];
}

export async function loadHorariosEmpleados() {
  const { data } = await getServerSupabase()
    .from('horarios_empleados')
    .select('*');
  return data ?? [];
}

export async function saveEmpleado(payload: any, isUpdate: boolean, id?: string) {
  const sanitizedPayload = {
    ...payload,
    sueldo_mensual: isNaN(Number(payload.sueldo_mensual)) ? 0 : Number(payload.sueldo_mensual),
    sueldo_diario: isNaN(Number(payload.sueldo_diario)) ? 0 : Number(payload.sueldo_diario),
    salario_diario_integrado: isNaN(Number(payload.salario_diario_integrado)) ? 0 : Number(payload.salario_diario_integrado),
  };

  try {
    if (isUpdate && id) {
      const { error } = await getServerSupabase()
        .from('empleados_detalle')
        .update(sanitizedPayload)
        .eq('id', id);
      if (error) {
        if (error.message?.includes('exento_reloj_checador')) {
          const { exento_reloj_checador, ...payloadWithoutExento } = sanitizedPayload;
          const { error: err2 } = await getServerSupabase()
            .from('empleados_detalle')
            .update(payloadWithoutExento)
            .eq('id', id);
          if (err2) throw err2;
        } else {
          throw error;
        }
      }
    } else {
      const { error } = await getServerSupabase()
        .from('empleados_detalle')
        .insert(sanitizedPayload);
      if (error) {
        if (error.message?.includes('exento_reloj_checador')) {
          const { exento_reloj_checador, ...payloadWithoutExento } = sanitizedPayload;
          const { error: err2 } = await getServerSupabase()
            .from('empleados_detalle')
            .insert(payloadWithoutExento);
          if (err2) throw err2;
        } else {
          throw error;
        }
      }
    }

    if (sanitizedPayload.zkteco_user_id) {
      const nameText = `${sanitizedPayload.primer_nombre || ''} ${sanitizedPayload.primer_apellido || ''}`.trim();
      const cmdText = `DATA UPDATE USERINFO PIN=${sanitizedPayload.zkteco_user_id}\tName=${nameText}\tPri=0\tPass=\tCard=\tGrp=1`;
      const cmdId = Math.floor(100000 + Math.random() * 900000).toString();
      const { error: cmdErr } = await getServerSupabase()
        .from('zkteco_comandos')
        .insert({
          empresa_id: sanitizedPayload.empresa_id,
          comando_id: cmdId,
          comando_texto: cmdText,
          categoria: 'usuarios',
          procesado: false
        });
      if (cmdErr) console.warn('[zkteco_comandos warn]', cmdErr);
    }
  } catch (err: any) {
    console.error('[saveEmpleado error]', err);
    throw new Error(err.message || 'Error al guardar empleado');
  }
}

export async function saveTurno(payload: any, isUpdate: boolean, id?: string) {
  if (isUpdate && id) {
    const { error } = await getServerSupabase()
      .from('turnos')
      .update(payload)
      .eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await getServerSupabase()
      .from('turnos')
      .insert(payload);
    if (error) throw error;
  }
}

export async function saveHorarioIndividual(upsertData: any[]) {
  const { error } = await getServerSupabase()
    .from('horarios_empleados')
    .upsert(upsertData, { onConflict: 'empleado_id,dia_semana' });
  if (error) throw error;
}

export async function applyGlobalSchedule(empleados: any[], day: number, turnoId: string | null, isDescanso: boolean) {
  const upsertData = empleados.map((emp: any) => ({
    empleado_id: emp.id,
    dia_semana: day,
    turno_id: turnoId,
    es_dia_descanso: isDescanso
  }));
  const { error } = await getServerSupabase()
    .from('horarios_empleados')
    .upsert(upsertData, { onConflict: 'empleado_id,dia_semana' });
  if (error) throw error;
}

export async function createIncidencia(payload: any) {
  const { error } = await getServerSupabase()
    .from('incidencias_solicitudes')
    .insert(payload);
  if (error) throw error;
}

export async function encolarComandoZkTeco(empresaId: string, comandoTexto: string, categoria: string, dispositivoSn?: string) {
  const cmdId = Math.floor(100000 + Math.random() * 900000).toString();
  const { error } = await getServerSupabase()
    .from('zkteco_comandos')
    .insert({
      empresa_id: empresaId,
      dispositivo_sn: dispositivoSn || null,
      comando_id: cmdId,
      comando_texto: comandoTexto,
      categoria: categoria,
      procesado: false
    });
  if (error) throw error;
  return cmdId;
}

export async function loadComandosPendientes(empresaId: string, limit = 50) {
  const { data } = await getServerSupabase()
    .from('zkteco_comandos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('creado_en', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function loadPatronesDescanso(empresaId: string) {
  const { data: patrones } = await getServerSupabase()
    .from('patrones_descanso')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('activo', true);
  const ids = (patrones || []).map(p => p.id);
  const { data: dias } = ids.length > 0
    ? await getServerSupabase()
        .from('patron_descanso_dias')
        .select('*')
        .in('patron_id', ids)
        .order('semana_idx').order('dia_semana')
    : { data: [] };
  const { data: asignaciones } = await getServerSupabase()
    .from('empleado_patron_descanso')
    .select('*');
  return { patrones: patrones ?? [], dias: dias ?? [], asignaciones: asignaciones ?? [] };
}

export async function savePatronDescanso(empresaId: string, nombre: string, tipoPatron: string, dias: any[]) {
  const { data: patron, error: err1 } = await getServerSupabase()
    .from('patrones_descanso')
    .insert({ empresa_id: empresaId, nombre, tipo_patron: tipoPatron })
    .select()
    .single();
  if (err1) throw err1;

  if (dias.length > 0) {
    const diasPayload = dias.map((d: any) => ({
      patron_id: patron.id,
      semana_idx: d.semana_idx,
      dia_semana: d.dia_semana,
      es_descanso: d.es_descanso
    }));
    const { error: err2 } = await getServerSupabase()
      .from('patron_descanso_dias')
      .insert(diasPayload);
    if (err2) throw err2;
  }

  return patron;
}

export async function assignPatronDescanso(empleadoId: string, patronId: string, alterna: boolean) {
  const { error } = await getServerSupabase()
    .from('empleado_patron_descanso')
    .upsert({
      empleado_id: empleadoId,
      patron_id: patronId,
      fecha_inicio: new Date().toISOString().split('T')[0],
      alterna
    }, { onConflict: 'empleado_id' });
  if (error) throw error;
}

export async function generarDescansosMensuales(empresaId: string, year: number, month: number) {
  const { data: empleados } = await getServerSupabase()
    .from('empleados_detalle')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('activo', true);
  if (!empleados) return 0;

  const { data: asignaciones } = await getServerSupabase()
    .from('empleado_patron_descanso')
    .select('*, patrones_descanso(*)');

  const { data: diasPatron } = await getServerSupabase()
    .from('patron_descanso_dias')
    .select('*');
  const diasMap = new Map<string, any[]>();
  (diasPatron || []).forEach(d => {
    if (!diasMap.has(d.patron_id)) diasMap.set(d.patron_id, []);
    diasMap.get(d.patron_id)!.push(d);
  });

  const records: any[] = [];
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  for (const emp of empleados) {
    const asignacion = (asignaciones || []).find((a: any) => a.empleado_id === emp.id);
    if (!asignacion) continue;

    const patronId = asignacion.patron_id;
    const alterna = asignacion.alterna;
    const dias = diasMap.get(patronId) || [];

    if (dias.length === 0) continue;

    const weeksInMonth = Math.ceil(endDate.getDate() / 7);
    let current = new Date(startDate);

    while (current <= endDate) {
      const weekOfMonth = Math.floor((current.getDate() - 1) / 7);
      const semanaIdx = alterna ? weekOfMonth % 2 : 0;
      const diaSemana = current.getDay();

      const rule = dias.find((d: any) => d.semana_idx === semanaIdx && d.dia_semana === diaSemana);
      if (rule && rule.es_descanso) {
        const yearStr = current.getFullYear();
        const monthStr = String(current.getMonth() + 1).padStart(2, '0');
        const dateStr = String(current.getDate()).padStart(2, '0');
        const fechaStr = `${yearStr}-${monthStr}-${dateStr}`;
        records.push({
          empleado_id: emp.id,
          fecha: fechaStr,
          es_descanso: true,
          motivo: 'patron'
        });
      }

      current.setDate(current.getDate() + 1);
    }
  }

  if (records.length > 0) {
    const { error } = await getServerSupabase()
      .from('descansos_mensuales')
      .upsert(records, { onConflict: 'empleado_id,fecha' });
    if (error) throw error;
  }

  return records.length;
}

export async function toggleDescansoMensual(empleadoId: string, fecha: string, esDescanso: boolean, motivo: string) {
  const { error } = await getServerSupabase()
    .from('descansos_mensuales')
    .upsert({
      empleado_id: empleadoId,
      fecha,
      es_descanso: esDescanso,
      motivo
    }, { onConflict: 'empleado_id,fecha' });
  if (error) {
    console.error('[toggleDescansoMensual] Database error:', error);
    throw new Error(`DB Error: ${error.message} (Code: ${error.code}, Hint: ${error.hint || 'none'})`);
  }
}

export async function loadDescansosMensuales(empresaId: string, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const { data, error } = await getServerSupabase()
    .from('descansos_mensuales')
    .select('*, empleados_detalle(nombre_completo)')
    .gte('fecha', startDate)
    .lte('fecha', endDate);
  if (error) console.error('[loadDescansosMensuales]', error);
  return data ?? [];
}

export async function toggleDescansoMensualDelete(empleadoId: string, fecha: string) {
  const { error } = await getServerSupabase()
    .from('descansos_mensuales')
    .delete()
    .eq('empleado_id', empleadoId)
    .eq('fecha', fecha);
  if (error) {
    console.error('[toggleDescansoMensualDelete] Database error:', error);
    throw new Error(`DB Error: ${error.message} (Code: ${error.code}, Hint: ${error.hint || 'none'})`);
  }
}

export async function bulkAssignDescansos(
  empresaId: string,
  fecha: string,
  empleadoIds: string[],
  esDescanso: boolean,
  motivo: string
) {
  if (empleadoIds.length === 0) return 0;
  if (esDescanso) {
    const records = empleadoIds.map(eid => ({
      empleado_id: eid,
      fecha,
      es_descanso: true,
      motivo
    }));
    const { error } = await getServerSupabase()
      .from('descansos_mensuales')
      .upsert(records, { onConflict: 'empleado_id,fecha' });
    if (error) {
      console.error('[bulkAssignDescansos] Database error:', error);
      throw new Error(`DB Error: ${error.message} (Code: ${error.code}, Hint: ${error.hint || 'none'})`);
    }
    return empleadoIds.length;
  } else {
    const { error } = await getServerSupabase()
      .from('descansos_mensuales')
      .delete()
      .in('empleado_id', empleadoIds)
      .eq('fecha', fecha);
    if (error) {
      console.error('[bulkAssignDescansos Delete] Database error:', error);
      throw new Error(`DB Error: ${error.message} (Code: ${error.code}, Hint: ${error.hint || 'none'})`);
    }
    return empleadoIds.length;
  }
}

export async function loadTurnosPuesto(empresaId: string) {
  const { data: puestos } = await getServerSupabase()
    .from('puestos_trabajo')
    .select('id')
    .eq('empresa_id', empresaId);
  const ids = (puestos || []).map(p => p.id);
  if (ids.length === 0) return [];
  const { data } = await getServerSupabase()
    .from('turnos_puesto')
    .select('*')
    .in('puesto_id', ids);
  return data ?? [];
}

export async function saveTurnosPuesto(puestoId: string, turnoIds: string[]) {
  await getServerSupabase()
    .from('turnos_puesto')
    .delete()
    .eq('puesto_id', puestoId);
  if (turnoIds.length > 0) {
    const records = turnoIds.map(turnoId => ({ puesto_id: puestoId, turno_id: turnoId, activo: true }));
    const { error } = await getServerSupabase()
      .from('turnos_puesto')
      .insert(records);
    if (error) throw error;
  }
}

export async function loadRotacionTurnos() {
  const { data } = await getServerSupabase()
    .from('rotacion_turnos')
    .select('*')
    .order('secuencia');
  return data ?? [];
}

export async function saveRotacionTurnos(empleadoId: string, turnos: { secuencia: number; turno_id: string }[]) {
  await getServerSupabase()
    .from('rotacion_turnos')
    .delete()
    .eq('empleado_id', empleadoId);
  if (turnos.length > 0) {
    const records = turnos.map(t => ({ empleado_id: empleadoId, secuencia: t.secuencia, turno_id: t.turno_id }));
    const { error } = await getServerSupabase()
      .from('rotacion_turnos')
      .insert(records);
    if (error) throw error;
  }
}

export async function loadDiasFestivos(empresaId: string) {
  const { data } = await getServerSupabase()
    .from('dias_festivos')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('fecha');
  return data ?? [];
}

export async function saveDiaFestivo(empresaId: string, fecha: string, descripcion: string, esRecurrente: boolean) {
  const { error } = await getServerSupabase()
    .from('dias_festivos')
    .insert({ empresa_id: empresaId, fecha, descripcion, es_recurrente: esRecurrente });
  if (error) throw error;
}

export async function deleteDiaFestivo(id: string) {
  const { error } = await getServerSupabase()
    .from('dias_festivos')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEmpleado(id: string) {
  const { error } = await getServerSupabase()
    .from('empleados_detalle')
    .update({ activo: false })
    .eq('id', id);
  if (error) throw error;
}

// --- NÓMINA LFT COMPLETA ---
export async function calcularNominaCompleta(
  empresaId: string,
  fechaInicio: string,
  fechaFin: string,
  montoPropinas: number = 0,
  utilidadFiscalAnual: number = 0,
  modalidadHorasExtra: 'lft' | 'proporcional' | 'ninguna' = 'lft',
  incluirHoyEnFaltas: boolean = false
) {
  const { calcularNomina } = await import('./_lib/lft');

  const [empleadosRes, checadasRes, incidenciasRes, horariosRes, turnosRes, descansosMensualesRes] = await Promise.all([
    getServerSupabase()
      .from('empleados_detalle')
      .select('*, puestos_trabajo(salario_diario_base, puntos_propina)')
      .eq('empresa_id', empresaId)
      .eq('activo', true),
    getServerSupabase()
      .from('asistencia_checadas_raw')
      .select('*')
      .eq('empresa_id', empresaId)
      .gte('timestamp', `${fechaInicio}T00:00:00Z`)
      .lte('timestamp', `${fechaFin}T23:59:59Z`),
    getServerSupabase()
      .from('incidencias_solicitudes')
      .select('*')
      .eq('estatus', 'aprobado')
      .gte('fecha_inicio', fechaInicio)
      .lte('fecha_fin', fechaFin),
    getServerSupabase()
      .from('horarios_empleados')
      .select('*'),
    getServerSupabase()
      .from('turnos')
      .select('*')
      .eq('empresa_id', empresaId),
    getServerSupabase()
      .from('descansos_mensuales')
      .select('*')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin),
  ]);

  const rawEmpleados = empleadosRes.data || [];
  const seenEmp = new Set<string>();
  const empleados = rawEmpleados.filter((emp: any) => {
    const key = (emp.nombre_completo || emp.id || '').trim().toLowerCase();
    if (seenEmp.has(key)) return false;
    seenEmp.add(key);
    return true;
  });
  const logs = checadasRes.data || [];
  const absences = incidenciasRes.data || [];
  const horariosList = horariosRes.data || [];
  const turnosList = turnosRes.data || [];
  const descansosMensualesList = descansosMensualesRes.data || [];
  if (!empleados.length) return [];

  const dateArray: string[] = [];
  let current = new Date(fechaInicio + 'T00:00:00');
  const end = new Date(fechaFin + 'T23:59:59');
  while (current <= end) {
    dateArray.push(current.toLocaleDateString('en-CA'));
    current.setDate(current.getDate() + 1);
  }

  const resultados = empleados.map((emp: any) => {
    const todayLocalStr = new Date().toLocaleDateString('en-CA');
    const isExentoReloj = !!emp.exento_reloj_checador || !emp.zkteco_user_id || String(emp.zkteco_user_id).trim() === '' || String(emp.zkteco_user_id).trim() === '0';

    let totalHorasTrabajadasAcc = 0;
    let faltasNoJustificadasCount = 0;
    const detallesDias = dateArray.map(d => {
      const dateObj = new Date(d + 'T12:00:00');
      const dow = dateObj.getDay();
      const schedule = horariosList.find((h: any) => h.empleado_id === emp.id && h.dia_semana === dow);
      const descansoMensual = descansosMensualesList.find((dm: any) => dm.empleado_id === emp.id && dm.fecha === d);
      
      const esDescanso = descansoMensual
        ? !!descansoMensual.es_descanso
        : !!(schedule && schedule.es_dia_descanso);

      const incidenciaObj = absences.find((a: any) =>
        a.empleado_id === emp.id && d >= a.fecha_inicio && d <= a.fecha_fin
      );
      const tieneIncidencia = !!incidenciaObj;

      const logsDia = logs
        .filter((l: any) => l.zkteco_user_id === emp.zkteco_user_id &&
          new Date(l.timestamp).toLocaleDateString('en-CA') === d)
        .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const tieneChecadas = logsDia.length >= 1;
      const esFuturo = d > todayLocalStr;

      let horasTrabajadasDia = 0;
      let horasExtraDia = 0;
      if (logsDia.length >= 2) {
        const entrada = new Date(logsDia[0].timestamp);
        const salida = new Date(logsDia[logsDia.length - 1].timestamp);

        const turno = schedule?.turno_id ? turnosList.find((t: any) => t.id === schedule.turno_id) : null;
        if (turno && turno.hora_entrada_1 && turno.hora_salida_1) {
          const [hIn, mIn] = turno.hora_entrada_1.split(':').map(Number);
          const [hOut, mOut] = turno.hora_salida_1.split(':').map(Number);

          const scheduledEntrada = new Date(`${d}T${String(hIn).padStart(2, '0')}:${String(mIn).padStart(2, '0')}:00`);
          let scheduledSalida = new Date(`${d}T${String(hOut).padStart(2, '0')}:${String(mOut).padStart(2, '0')}:00`);
          if (scheduledSalida < scheduledEntrada) {
            scheduledSalida.setDate(scheduledSalida.getDate() + 1);
          }

          // Si llegó antes de la hora de entrada de su horario, el conteo de trabajo inicia a la hora de entrada del turno
          const effectiveEntrada = entrada < scheduledEntrada ? scheduledEntrada : entrada;
          horasTrabajadasDia = Math.max(0, (salida.getTime() - effectiveEntrada.getTime()) / (1000 * 60 * 60));

          // Las horas extras se cuentan a partir de la hora de salida de su horario
          if (salida > scheduledSalida) {
            horasExtraDia = (salida.getTime() - scheduledSalida.getTime()) / (1000 * 60 * 60);
          } else {
            horasExtraDia = 0;
          }
        } else {
          horasTrabajadasDia = (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60);
          horasExtraDia = Math.max(0, horasTrabajadasDia - 8);
        }

        totalHorasTrabajadasAcc += horasTrabajadasDia;
      } else if (isExentoReloj && !esDescanso) {
        horasTrabajadasDia = 8;
        totalHorasTrabajadasAcc += 8;
      }

      let estado: 'asistencia' | 'descanso' | 'justificado' | 'exento' | 'falta' | 'futuro' = 'asistencia';
      if (esFuturo) estado = 'futuro';
      else if (d === todayLocalStr && !incluirHoyEnFaltas && !tieneChecadas && !esDescanso && !isExentoReloj && !tieneIncidencia) {
        estado = 'futuro';
      }
      else if (tieneIncidencia) estado = 'justificado';
      else if (esDescanso) estado = 'descanso';
      else if (isExentoReloj) estado = 'exento';
      else if (tieneChecadas) estado = 'asistencia';
      else {
        estado = 'falta';
        faltasNoJustificadasCount++;
      }

      return {
        fecha: d,
        diaSemana: dateObj.toLocaleDateString('es-MX', { weekday: 'short' }),
        esDescanso,
        tieneIncidencia,
        incidenciaNombre: incidenciaObj ? (incidenciaObj.tipo || 'Justificación') : null,
        tieneChecadas,
        entradas: logsDia.map((l: any) => new Date(l.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })),
        horasTrabajadas: Math.round(horasTrabajadasDia * 100) / 100,
        horasExtra: Math.round(horasExtraDia * 100) / 100,
        estado
      };
    });

    // En quincena LFT el pago base es de 15 días. El día 31 NO se paga extra por LFT.
    const esQuincena = dateArray.length >= 13 && dateArray.length <= 16;
    const baseDiasQuincena = esQuincena ? 15 : dateArray.length;
    const diasPagados = Math.max(0, baseDiasQuincena - faltasNoJustificadasCount);

    let horasDobles = 0;
    let horasTriples = 0;
    let minutosRetardo = 0;
    let countRetardos = 0;
    let domingosTrabajados = 0;

    if (!isExentoReloj) {
      // Art. 66, 67 y 68 LFT: El tiempo extraordinario no debe exceder de 3 horas diarias ni de 9 horas en una semana.
      // Las primeras 9 horas extraordinarias semanales (topadas a 3h por día) son DOBLES (200%).
      // Cualquier excedente (más de 3h en un día o a partir de la 10a hora extra semanal) es TRIPLE (300%).
      let horasDoblesSemanaActual = 0;

      for (let i = 0; i < dateArray.length; i++) {
        // Reinicio del contador semanal cada 7 días
        if (i > 0 && i % 7 === 0) {
          horasDoblesSemanaActual = 0;
        }

        const d = dateArray[i];
        const dateObj = new Date(d + 'T12:00:00');
        const dow = dateObj.getDay();
        const schedule = horariosList.find((h: any) => h.empleado_id === emp.id && h.dia_semana === dow);
        const descansoMensual = descansosMensualesList.find((dm: any) => dm.empleado_id === emp.id && dm.fecha === d);
        const esDescanso = descansoMensual
          ? !!descansoMensual.es_descanso
          : !!(schedule && schedule.es_dia_descanso);

        if (esDescanso) continue;

        const logsDia = logs
          .filter((l: any) => l.zkteco_user_id === emp.zkteco_user_id &&
            new Date(l.timestamp).toLocaleDateString('en-CA') === d)
          .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        if (logsDia.length >= 2) {
          const entrada = new Date(logsDia[0].timestamp);
          const salida = new Date(logsDia[logsDia.length - 1].timestamp);

          const turno = schedule?.turno_id ? turnosList.find((t: any) => t.id === schedule.turno_id) : null;
          let horasExtraDia = 0;

          if (turno && turno.hora_entrada_1 && turno.hora_salida_1) {
            const [hIn, mIn] = turno.hora_entrada_1.split(':').map(Number);
            const [hOut, mOut] = turno.hora_salida_1.split(':').map(Number);

            const scheduledEntrada = new Date(`${d}T${String(hIn).padStart(2, '0')}:${String(mIn).padStart(2, '0')}:00`);
            let scheduledSalida = new Date(`${d}T${String(hOut).padStart(2, '0')}:${String(mOut).padStart(2, '0')}:00`);
            if (scheduledSalida < scheduledEntrada) {
              scheduledSalida.setDate(scheduledSalida.getDate() + 1);
            }

            if (salida > scheduledSalida) {
              horasExtraDia = (salida.getTime() - scheduledSalida.getTime()) / (1000 * 60 * 60);
            }

            const entradaHora = entrada.getHours() * 60 + entrada.getMinutes();
            const turnoHora = hIn * 60 + mIn + (turno.tolerancia_minutos || 0);
            if (entradaHora > turnoHora) {
              minutosRetardo += entradaHora - turnoHora;
              countRetardos++;
            }
          } else {
            const horasTrabajadas = (salida.getTime() - entrada.getTime()) / (1000 * 60 * 60);
            horasExtraDia = Math.max(0, horasTrabajadas - 8);
          }

          if (horasExtraDia > 0) {
            const maxDoblesDia = Math.min(horasExtraDia, 3);
            const cupoSemanalRestante = Math.max(0, 9 - horasDoblesSemanaActual);
            const doblesHoy = Math.min(maxDoblesDia, cupoSemanalRestante);
            const triplesHoy = Math.max(0, horasExtraDia - doblesHoy);

            horasDobles += doblesHoy;
            horasTriples += triplesHoy;
            horasDoblesSemanaActual += doblesHoy;
          }

          if (dow === 0) domingosTrabajados++;
        }
      }
    }

    const sueldoDiario = emp.sueldo_diario || emp.puestos_trabajo?.salario_diario_base || 250;
    const sueldoMensual = emp.sueldo_mensual !== undefined && emp.sueldo_mensual !== null
      ? emp.sueldo_mensual
      : emp.puestos_trabajo?.salario_mensual_base || Math.round(sueldoDiario * 30);
    const sdi = emp.salario_diario_integrado || sueldoDiario * 1.045;

    let antiguedadAnios = 0;
    if (emp.fecha_ingreso) {
      const ingreso = new Date(emp.fecha_ingreso);
      antiguedadAnios = Math.floor((end.getTime() - ingreso.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    const inicioAnio = new Date(end.getFullYear(), 0, 1);
    const diasAnio = Math.floor((end.getTime() - inicioAnio.getTime()) / (24 * 60 * 60 * 1000)) + 1;

    const resultado = calcularNomina({
      sueldoDiario,
      sueldoMensual,
      salarioDiarioIntegrado: sdi,
      diasTrabajados: diasPagados,
      horasDobles: Math.round(horasDobles * 10) / 10,
      horasTriples: Math.round(horasTriples * 10) / 10,
      minutosRetardo,
      domingosTrabajados,
      antiguedadAnios,
      diasTrabajadosAnio: Math.min(diasAnio, diasPagados > 0 ? 365 : 0),
      montoPropina: 0,
      modalidadHorasExtra,
    });

    return {
      empleado_id: emp.id,
      nombre: emp.nombre_completo,
      puesto: emp.puestos_trabajo?.nombre || 'General',
      sueldoDiario,
      sueldoMensual,
      exentoReloj: isExentoReloj,
      diasTrabajados: diasPagados,
      diasTotalesPeriodo: baseDiasQuincena,
      totalHorasTrabajadas: isExentoReloj ? (diasPagados * 8) : (Math.round(totalHorasTrabajadasAcc * 10) / 10),
      faltasNoJustificadas: faltasNoJustificadasCount,
      retardosMinutos: minutosRetardo,
      retardosConteo: countRetardos,
      horasDobles,
      horasTriples,
      domingosTrabajados,
      detallesDias,
      propinaAsignada: 0,
      ...resultado,
    };
  });

  const totalSueldos = resultados.reduce((s, r) => s + r.percepciones.sueldoOrdinario, 0);
  for (const r of resultados) {
    const factor = totalSueldos > 0 ? r.percepciones.sueldoOrdinario / totalSueldos : 0;
    const propina = montoPropinas * factor;
    r.propinaAsignada = Math.round(propina * 100) / 100;
    r.percepciones.propina = r.propinaAsignada;
    r.percepciones.total = Math.round((r.percepciones.total + r.propinaAsignada) * 100) / 100;
    r.neto = Math.round((r.neto + r.propinaAsignada) * 100) / 100;
  }

  return resultados;
}

export async function loadVacacionesEmpleado(empleadoId: string) {
  const { data } = await getServerSupabase()
    .from('vacaciones_empleado')
    .select('*')
    .eq('empleado_id', empleadoId)
    .order('periodo_inicio', { ascending: false });
  return data ?? [];
}

export async function saveVacacionEmpleado(payload: {
  empleado_id: string;
  periodo_inicio: string;
  periodo_fin: string;
  dias_correspondientes: number;
}) {
  const { error } = await getServerSupabase()
    .from('vacaciones_empleado')
    .insert(payload);
  if (error) throw error;
}

