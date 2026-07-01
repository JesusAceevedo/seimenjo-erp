'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useThemeMode } from '@/lib/useThemeMode';
import { useSessionToken } from '@/lib/hooks/useSessionToken';
import {
  Users,
  Clock,
  Briefcase,
  Settings,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  FileText,
  UserCheck,
  Award,
  RefreshCw,
  Sliders,
  ChevronRight
} from 'lucide-react';

interface Departamento {
  id: string;
  nombre: string;
  descripcion: string;
}

interface Puesto {
  id: string;
  nombre: string;
  salario_diario_base: number;
  puntos_propina: number;
  departamento_id?: string;
  departamentos?: { nombre: string };
}

interface StaffMember {
  id: string;
  correo: string;
  activo: boolean;
}

interface EmpleadoDetalle {
  id: string;
  usuario_staff_id: string;
  primer_apellido: string;
  segundo_apellido?: string;
  primer_nombre: string;
  segundo_nombre?: string;
  nombre_completo?: string;
  curp: string;
  rfc: string;
  nss: string;
  telefono: string;
  banco: string;
  cuenta_clabe: string;
  sueldo_diario: number;
  salario_diario_integrado: number;
  zkteco_user_id: string;
  tipo_contrato: string;
  fecha_ingreso: string;
  activo: boolean;
  puesto_id: string;
}

interface Turno {
  id: string;
  nombre: string;
  tipo_turno: 'fijo' | 'partido' | 'rotativo';
  hora_entrada_1: string;
  hora_salida_1: string;
  hora_entrada_2?: string;
  hora_salida_2?: string;
  tolerancia_minutos: number;
}

interface HorarioEmpleado {
  id?: string;
  empleado_id: string;
  dia_semana: number;
  turno_id: string;
  es_dia_descanso: boolean;
}

interface ChecadaRaw {
  id: string;
  zkteco_user_id: string;
  dispositivo_sn: string;
  timestamp: string;
  tipo_evento: string;
  metodo_verificacion: string;
  empleado?: { nombre_completo: string };
}

interface Incidencia {
  id: string;
  empleado_id: string;
  tipo_incidencia: string;
  fecha_inicio: string;
  fecha_fin: string;
  total_dias: number;
  motivo: string;
  estatus: 'pendiente' | 'aprobado' | 'rechazado';
  empleados_detalle?: { nombre_completo: string };
}

export default function AsistenciaNominasPage() {
  const { isDarkMode } = useThemeMode();
  const getToken = useSessionToken();

  // Navigation
  const [activeTab, setActiveTab] = useState<'monitoreo' | 'empleados' | 'turnos' | 'incidencias' | 'nomina'>('monitoreo');
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Catalogos
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoDetalle[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  
  // Real-time states
  const [checadasRaw, setChecadasRaw] = useState<ChecadaRaw[]>([]);
  const [presenciaHoy, setPresenciaHoy] = useState<any[]>([]);

  // Incidencias
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);

  // Form states
  const [selectedEmpleado, setSelectedEmpleado] = useState<EmpleadoDetalle | null>(null);
  const [empleadoForm, setEmpleadoForm] = useState({
    usuario_staff_id: '',
    primer_apellido: '',
    segundo_apellido: '',
    primer_nombre: '',
    segundo_nombre: '',
    curp: '',
    rfc: '',
    nss: '',
    telefono: '',
    banco: '',
    cuenta_clabe: '',
    sueldo_diario: 250,
    salario_diario_integrado: 260,
    zkteco_user_id: '',
    tipo_contrato: 'indeterminado',
    fecha_ingreso: new Date().toISOString().split('T')[0],
    puesto_id: ''
  });

  const [nuevoTurno, setNuevoTurno] = useState<{
    nombre: string;
    tipo_turno: 'fijo' | 'partido' | 'rotativo';
    hora_entrada_1: string;
    hora_salida_1: string;
    hora_entrada_2?: string;
    hora_salida_2?: string;
    tolerancia_minutos: number;
  }>({
    nombre: '',
    tipo_turno: 'fijo',
    hora_entrada_1: '09:00',
    hora_salida_1: '17:00',
    hora_entrada_2: '',
    hora_salida_2: '',
    tolerancia_minutos: 15
  });

  const [nuevoIncidencia, setNuevoIncidencia] = useState({
    empleado_id: '',
    tipo_incidencia: 'vacaciones',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    motivo: ''
  });

  // Nomina & Propinas States
  const [periodoNomina, setPeriodoNomina] = useState({
    fecha_inicio: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    frecuencia: 'semanal',
    monto_propinas: 0
  });
  const [nominaCalculada, setNominaCalculada] = useState<any[]>([]);
  const [calculandoNomina, setCalculandoNomina] = useState(false);

  // --- CARGA DE CONTEXTO ---
  const loadContext = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const sesionGuardada = localStorage.getItem('seimenjo_session');
      if (sesionGuardada) {
        const datos = JSON.parse(sesionGuardada);
        if (datos.empresa_id) {
          setEmpresaId(datos.empresa_id);
          return;
        }
      }

      // Fallback a consultar usuarios_staff
      const { data: staff } = await supabase
        .from('usuarios_staff')
        .select('empresa_id')
        .eq('supabase_auth_id', session.user.id)
        .maybeSingle();
      if (staff) {
        setEmpresaId(staff.empresa_id);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // --- CARGAR DATOS GENERALES ---
  const loadData = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      // 1. Departamentos
      const { data: depts } = await supabase
        .from('departamentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre');
      setDepartamentos(depts || []);

      // 2. Puestos
      const { data: pst } = await supabase
        .from('puestos_trabajo')
        .select('*, departamentos(nombre)')
        .eq('empresa_id', empresaId)
        .order('nombre');
      setPuestos(pst || []);

      // 3. Usuarios Staff (ERP)
      const { data: stf } = await supabase
        .from('usuarios_staff')
        .select('id, correo, activo')
        .eq('empresa_id', empresaId);
      setStaffList(stf || []);

      // 4. Empleados Detalle
      const { data: empl } = await supabase
        .from('empleados_detalle')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre_completo');
      setEmpleados(empl || []);

      // 5. Turnos
      const { data: trn } = await supabase
        .from('turnos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre');
      setTurnos(trn || []);

      // 6. Checadas Raw
      const { data: chk } = await supabase
        .from('asistencia_checadas_raw')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('timestamp', { ascending: false })
        .limit(50);
      setChecadasRaw(chk || []);

      // 7. Incidencias
      const { data: inc } = await supabase
        .from('incidencias_solicitudes')
        .select('*, empleados_detalle(nombre_completo)')
        .order('fecha_inicio', { ascending: false });
      setIncidencias(inc || []);

      // 8. Calcular presencia de hoy
      calculateRealtimePresencia(chk || [], empl || []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  // Carga inicial
  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (empresaId) {
      loadData();
    }
  }, [empresaId, loadData]);

  // --- LÓGICA DE PRESENCIA REAL-TIME ---
  const calculateRealtimePresencia = (rawLogs: ChecadaRaw[], employees: EmpleadoDetalle[]) => {
    const today = new Date().toISOString().split('T')[0];
    const presenceMap = new Map<string, { lastCheck: string; status: 'PRESENTE' | 'AUSENTE'; log: any }>();

    // Inicializar todos como Ausentes
    employees.forEach(emp => {
      if (emp.zkteco_user_id) {
        presenceMap.set(emp.zkteco_user_id, {
          lastCheck: '--:--',
          status: 'AUSENTE',
          log: null
        });
      }
    });

    // Ordenar de más antiguo a más reciente para rastrear el último estado del día de hoy
    const todayLogs = rawLogs
      .filter(l => l.timestamp.startsWith(today))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    todayLogs.forEach(log => {
      const current = presenceMap.get(log.zkteco_user_id);
      const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (current) {
        presenceMap.set(log.zkteco_user_id, {
          lastCheck: timeStr,
          status: log.tipo_evento === 'CHECKIN' || log.tipo_evento === 'BREAK_IN' ? 'PRESENTE' : 'AUSENTE',
          log
        });
      }
    });

    const list: any[] = [];
    employees.forEach(emp => {
      const state = presenceMap.get(emp.zkteco_user_id) || { lastCheck: '--:--', status: 'AUSENTE', log: null };
      list.push({
        empleado: emp,
        ...state
      });
    });

    setPresenciaHoy(list);
  };

  // (Los catálogos de departamentos y puestos se alimentan desde Configuración)

  // --- GUARDAR EXPEDIENTE EMPLEADO ---
  const handleSaveEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empleadoForm.primer_apellido || !empleadoForm.primer_nombre || !empresaId) return;

    try {
      const payload: any = {
        empresa_id: empresaId,
        usuario_staff_id: empleadoForm.usuario_staff_id || null,
        primer_apellido: empleadoForm.primer_apellido,
        segundo_apellido: empleadoForm.segundo_apellido || null,
        primer_nombre: empleadoForm.primer_nombre,
        segundo_nombre: empleadoForm.segundo_nombre || null,
        curp: empleadoForm.curp || null,
        rfc: empleadoForm.rfc || null,
        nss: empleadoForm.nss || null,
        telefono: empleadoForm.telefono || null,
        banco: empleadoForm.banco || null,
        cuenta_clabe: empleadoForm.cuenta_clabe || null,
        sueldo_diario: empleadoForm.sueldo_diario,
        salario_diario_integrado: empleadoForm.salario_diario_integrado,
        zkteco_user_id: empleadoForm.zkteco_user_id || null,
        tipo_contrato: empleadoForm.tipo_contrato,
        fecha_ingreso: empleadoForm.fecha_ingreso,
        puesto_id: empleadoForm.puesto_id || null,
        activo: true
      };

      if (selectedEmpleado) {
        const { error } = await supabase
          .from('empleados_detalle')
          .update(payload)
          .eq('id', selectedEmpleado.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('empleados_detalle')
          .insert(payload);
        if (error) throw error;
      }

      setSelectedEmpleado(null);
      setEmpleadoForm({
        usuario_staff_id: '',
        primer_apellido: '',
        segundo_apellido: '',
        primer_nombre: '',
        segundo_nombre: '',
        curp: '',
        rfc: '',
        nss: '',
        telefono: '',
        banco: '',
        cuenta_clabe: '',
        sueldo_diario: 250,
        salario_diario_integrado: 260,
        zkteco_user_id: '',
        tipo_contrato: 'indeterminado',
        fecha_ingreso: new Date().toISOString().split('T')[0],
        puesto_id: ''
      });
      loadData();
    } catch (err: any) {
      alert('Error al guardar empleado: ' + err.message);
    }
  };

  const handleEditEmpleado = (emp: EmpleadoDetalle) => {
    setSelectedEmpleado(emp);
    setEmpleadoForm({
      usuario_staff_id: emp.usuario_staff_id || '',
      primer_apellido: emp.primer_apellido || '',
      segundo_apellido: emp.segundo_apellido || '',
      primer_nombre: emp.primer_nombre || '',
      segundo_nombre: emp.segundo_nombre || '',
      curp: emp.curp || '',
      rfc: emp.rfc || '',
      nss: emp.nss || '',
      telefono: emp.telefono || '',
      banco: emp.banco || '',
      cuenta_clabe: emp.cuenta_clabe || '',
      sueldo_diario: emp.sueldo_diario || 250,
      salario_diario_integrado: emp.salario_diario_integrado || 260,
      zkteco_user_id: emp.zkteco_user_id || '',
      tipo_contrato: emp.tipo_contrato || 'indeterminado',
      fecha_ingreso: emp.fecha_ingreso || new Date().toISOString().split('T')[0],
      puesto_id: emp.puesto_id || ''
    });
  };

  // --- CREAR TURNOS ---
  const handleCreateTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTurno.nombre || !empresaId) return;

    try {
      const { error } = await supabase.from('turnos').insert({
        empresa_id: empresaId,
        nombre: nuevoTurno.nombre,
        tipo_turno: nuevoTurno.tipo_turno,
        hora_entrada_1: nuevoTurno.hora_entrada_1,
        hora_salida_1: nuevoTurno.hora_salida_1,
        hora_entrada_2: nuevoTurno.tipo_turno === 'partido' ? nuevoTurno.hora_entrada_2 || null : null,
        hora_salida_2: nuevoTurno.tipo_turno === 'partido' ? nuevoTurno.hora_salida_2 || null : null,
        tolerancia_minutos: nuevoTurno.tolerancia_minutos
      });

      if (error) throw error;
      setNuevoTurno({
        nombre: '',
        tipo_turno: 'fijo',
        hora_entrada_1: '09:00',
        hora_salida_1: '17:00',
        hora_entrada_2: '',
        hora_salida_2: '',
        tolerancia_minutos: 15
      });
      loadData();
    } catch (err: any) {
      alert('Error al crear turno: ' + err.message);
    }
  };

  // --- CREAR INCIDENCIA ---
  const handleCreateIncidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoIncidencia.empleado_id || !empresaId) return;

    try {
      const start = new Date(nuevoIncidencia.fecha_inicio);
      const end = new Date(nuevoIncidencia.fecha_fin);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const { error } = await supabase.from('incidencias_solicitudes').insert({
        empleado_id: nuevoIncidencia.empleado_id,
        tipo_incidencia: nuevoIncidencia.tipo_incidencia,
        fecha_inicio: nuevoIncidencia.fecha_inicio,
        fecha_fin: nuevoIncidencia.fecha_fin,
        total_dias: diffDays,
        motivo: nuevoIncidencia.motivo,
        estatus: 'aprobado' // Auto-aprobado para fines de demostración
      });

      if (error) throw error;
      setNuevoIncidencia({
        empleado_id: '',
        tipo_incidencia: 'vacaciones',
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: new Date().toISOString().split('T')[0],
        motivo: ''
      });
      loadData();
    } catch (err: any) {
      alert('Error creando incidencia: ' + err.message);
    }
  };

  // --- CALCULO SIMULADO DE NOMINA Y PROPINAS ---
  const handleCalcularNomina = async () => {
    if (!empresaId) return;
    setCalculandoNomina(true);
    try {
      // 1. Obtener checadas en el rango de fechas
      const { data: rawLogs } = await supabase
        .from('asistencia_checadas_raw')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('timestamp', `${periodoNomina.fecha_inicio}T00:00:00Z`)
        .lte('timestamp', `${periodoNomina.fecha_fin}T23:59:59Z`);

      // Simulación de cálculo por cada empleado detallado
      const listaNomina = empleados.map(emp => {
        // Encontrar puesto del empleado
        const puesto = puestos.find(p => p.id === emp.puesto_id);
        const sueldoD = emp.sueldo_diario || puesto?.salario_diario_base || 250;
        
        // Simular logs
        const logsEmpleado = (rawLogs || []).filter(l => l.zkteco_user_id === emp.zkteco_user_id);
        
        // Simular dias trabajados y horas extras
        // En producción, esto computa las punch in / out del biométrico reales
        const diasTrabajados = logsEmpleado.length > 0 ? Math.min(6, Math.ceil(logsEmpleado.length / 2)) : 6; // Simulado
        const horasExtra = logsEmpleado.length > 12 ? (logsEmpleado.length - 12) * 1.5 : 0;
        
        // Regla LFT de horas extras dobles y triples
        const horasDobles = Math.min(9, horasExtra);
        const horasTriples = Math.max(0, horasExtra - 9);

        const sueldoOrdinario = sueldoD * diasTrabajados;
        const costoHora = sueldoD / 8;
        const pagoExtraDoble = horasDobles * costoHora * 2;
        const pagoExtraTriple = horasTriples * costoHora * 3;

        // Distribución de propinas
        // Método: Proporcional a horas estimadas trabajadas (dias * 8 horas)
        const horasEstimadas = diasTrabajados * 8;
        
        return {
          empleado: emp,
          puesto: puesto?.nombre || 'General',
          sueldoDiario: sueldoD,
          diasTrabajados,
          sueldoOrdinario,
          horasExtra,
          pagoExtraDoble,
          pagoExtraTriple,
          horasEstimadas,
          propinaAsignada: 0,
          isr: sueldoOrdinario * 0.08, // Simplificado 8%
          imss: sueldoOrdinario * 0.025, // Simplificado 2.5%
          neto: 0
        };
      });

      // Distribuir propinas
      const totalHoras = listaNomina.reduce((acc, curr) => acc + curr.horasEstimadas, 0);
      const propinasTotal = Number(periodoNomina.monto_propinas) || 0;

      const nominaFinal = listaNomina.map(item => {
        const factorPropina = totalHoras > 0 ? item.horasEstimadas / totalHoras : 0;
        const propinaAsignada = propinasTotal * factorPropina;
        const percepciones = item.sueldoOrdinario + item.pagoExtraDoble + item.pagoExtraTriple + propinaAsignada;
        const deducciones = item.isr + item.imss;
        
        return {
          ...item,
          propinaAsignada,
          neto: percepciones - deducciones
        };
      });

      setNominaCalculada(nominaFinal);
    } catch (err: any) {
      alert('Error en el cálculo: ' + err.message);
    } finally {
      setCalculandoNomina(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 font-sans p-6 space-y-6">
      
      {/* HEADER DE LA SECCIÓN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="text-amber-500" /> Control de Asistencia y Nómina
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Mapeo de checador biométrico ZKTeco ADMS, cálculo de incidencias, propinas y compliance de nómina LFT.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={loadData}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition-colors"
          >
            <RefreshCw size={14} /> Sincronizar
          </button>
        </div>
      </div>

      {/* TABS DE NAVEGACIÓN */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800 overflow-x-auto pb-px">
        {[
          { id: 'monitoreo', label: 'Monitoreo Real-Time', icon: Clock },
          { id: 'empleados', label: 'Expediente & Huellas', icon: Users },
          { id: 'turnos', label: 'Horarios y Turnos', icon: Calendar },
          { id: 'incidencias', label: 'Incidencias LFT', icon: AlertCircle },
          { id: 'nomina', label: 'Nómina & Propinas', icon: DollarSign }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs tracking-wider uppercase transition-all whitespace-nowrap ${
                active 
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold' 
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* CONTENIDO DE TABS */}
      <div className="space-y-6">
        
        {/* --- TAB 1: MONITOREO REAL-TIME --- */}
        {activeTab === 'monitoreo' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Presencia Actual */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <UserCheck className="text-emerald-500" size={18} /> Estatus de Personal Hoy
              </h3>
              
              <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold">
                      <th className="p-3">Empleado</th>
                      <th className="p-3">ID Biométrico</th>
                      <th className="p-3">Último Registro</th>
                      <th className="p-3 text-right">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                    {presenciaHoy.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                        <td className="p-3 font-semibold text-gray-900 dark:text-white">
                          {item.empleado.nombre_completo}
                        </td>
                        <td className="p-3 text-gray-500 font-mono">
                          {item.empleado.zkteco_user_id || 'No vinculado'}
                        </td>
                        <td className="p-3 text-gray-500">
                          {item.lastCheck}
                        </td>
                        <td className="p-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'PRESENTE' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {presenciaHoy.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-gray-400 italic">No hay empleados registrados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Logs Recientes del Dispositivo */}
            <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <Sliders className="text-amber-500" size={18} /> Actividad de Reloj (Raw)
              </h3>
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {checadasRaw.map((log) => {
                  const matchingEmp = empleados.find(e => e.zkteco_user_id === log.zkteco_user_id);
                  return (
                    <div key={log.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">
                          {matchingEmp ? matchingEmp.nombre_completo : `PIN: ${log.zkteco_user_id}`}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          log.tipo_evento === 'CHECKIN' ? 'bg-blue-500/10 text-blue-600' : 'bg-orange-500/10 text-orange-600'
                        }`}>
                          {log.tipo_evento}
                        </span>
                        <p className="text-[9px] text-gray-400 mt-1 font-mono">
                          SN: {log.dispositivo_sn.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                  );
                })}
                {checadasRaw.length === 0 && (
                  <p className="text-gray-400 text-center italic text-xs py-4">No se han recibido logs biométricos</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: EXPEDIENTE & VINCULACIÓN --- */}
        {activeTab === 'empleados' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Formulario de Expediente */}
            <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <FileText className="text-amber-500" size={18} /> {selectedEmpleado ? 'Modificar Empleado' : 'Nuevo Expediente'}
              </h3>
              
              <form onSubmit={handleSaveEmpleado} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Primer Apellido *</label>
                    <input
                      type="text"
                      required
                      value={empleadoForm.primer_apellido}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, primer_apellido: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Segundo Apellido</label>
                    <input
                      type="text"
                      value={empleadoForm.segundo_apellido}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, segundo_apellido: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="García"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Primer Nombre *</label>
                    <input
                      type="text"
                      required
                      value={empleadoForm.primer_nombre}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, primer_nombre: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="Juan"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Segundo Nombre</label>
                    <input
                      type="text"
                      value={empleadoForm.segundo_nombre}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, segundo_nombre: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="Carlos"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Puesto *</label>
                    <select
                      value={empleadoForm.puesto_id}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, puesto_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">Seleccionar...</option>
                      {puestos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ID Biométrico (PIN) *</label>
                    <input
                      type="text"
                      required
                      value={empleadoForm.zkteco_user_id}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, zkteco_user_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="Ej. 101"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Sueldo Diario ($) *</label>
                    <input
                      type="number"
                      required
                      value={empleadoForm.sueldo_diario}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, sueldo_diario: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Salario Diario Int. (SDI)</label>
                    <input
                      type="number"
                      value={empleadoForm.salario_diario_integrado}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, salario_diario_integrado: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">RFC</label>
                    <input
                      type="text"
                      maxLength={13}
                      value={empleadoForm.rfc}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, rfc: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="13 caracteres"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">CURP</label>
                    <input
                      type="text"
                      maxLength={18}
                      value={empleadoForm.curp}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, curp: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="18 caracteres"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">NSS (IMSS)</label>
                    <input
                      type="text"
                      maxLength={11}
                      value={empleadoForm.nss}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, nss: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="11 digitos"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={empleadoForm.telefono}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, telefono: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Banco</label>
                    <input
                      type="text"
                      value={empleadoForm.banco}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, banco: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="Ej. BBVA"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cuenta CLABE</label>
                    <input
                      type="text"
                      maxLength={18}
                      value={empleadoForm.cuenta_clabe}
                      onChange={e => setEmpleadoForm({ ...empleadoForm, cuenta_clabe: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      placeholder="18 digitos"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Usuario de Staff ERP Relacionado</label>
                  <select
                    value={empleadoForm.usuario_staff_id}
                    onChange={e => setEmpleadoForm({ ...empleadoForm, usuario_staff_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">Ninguno</option>
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>{s.correo}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg transition-colors"
                  >
                    Guardar
                  </button>
                  {selectedEmpleado && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmpleado(null);
                        setEmpleadoForm({
                          usuario_staff_id: '',
                          primer_apellido: '',
                          segundo_apellido: '',
                          primer_nombre: '',
                          segundo_nombre: '',
                          curp: '',
                          rfc: '',
                          nss: '',
                          telefono: '',
                          banco: '',
                          cuenta_clabe: '',
                          sueldo_diario: 250,
                          salario_diario_integrado: 260,
                          zkteco_user_id: '',
                          tipo_contrato: 'indeterminado',
                          fecha_ingreso: new Date().toISOString().split('T')[0],
                          puesto_id: ''
                        });
                      }}
                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-200 font-bold"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Listado de Expedientes */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <Users className="text-amber-500" size={18} /> Plantilla de Empleados
              </h3>

              <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold">
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Puesto</th>
                      <th className="p-3">PIN Biométrico</th>
                      <th className="p-3">Sueldo Diario</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                    {empleados.map(emp => {
                      const puesto = puestos.find(p => p.id === emp.puesto_id);
                      return (
                        <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-semibold text-gray-900 dark:text-white">
                            {emp.nombre_completo}
                          </td>
                          <td className="p-3 text-gray-600 dark:text-gray-300">
                            {puesto ? puesto.nombre : 'Sin Puesto'}
                          </td>
                          <td className="p-3 font-mono text-gray-500">
                            {emp.zkteco_user_id || 'N/A'}
                          </td>
                          <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">
                            ${emp.sueldo_diario} MXN
                          </td>
                          <td className="p-3 text-right space-x-1">
                            <button
                              onClick={() => handleEditEmpleado(emp)}
                              className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded font-semibold text-[10px] transition-colors"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {empleados.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-400 italic">No hay empleados registrados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 3: HORARIOS Y TURNOS --- */}
        {activeTab === 'turnos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Formulario Turno */}
            <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <Briefcase className="text-amber-500" size={18} /> Crear Nuevo Turno
              </h3>

              <form onSubmit={handleCreateTurno} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nombre del Turno *</label>
                  <input
                    type="text"
                    required
                    value={nuevoTurno.nombre}
                    onChange={e => setNuevoTurno({ ...nuevoTurno, nombre: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Ej. Cocina Turno A"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo de Turno *</label>
                    <select
                      value={nuevoTurno.tipo_turno}
                      onChange={e => setNuevoTurno({ ...nuevoTurno, tipo_turno: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="fijo">Fijo continuo</option>
                      <option value="partido">Partido (Dividido)</option>
                      <option value="rotativo">Rotativo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tolerancia (Minutos)</label>
                    <input
                      type="number"
                      value={nuevoTurno.tolerancia_minutos}
                      onChange={e => setNuevoTurno({ ...nuevoTurno, tolerancia_minutos: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                  <p className="font-bold text-[10px] text-gray-400 uppercase">Primer Segmento</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Hora Entrada 1 *</label>
                      <input
                        type="time"
                        required
                        value={nuevoTurno.hora_entrada_1}
                        onChange={e => setNuevoTurno({ ...nuevoTurno, hora_entrada_1: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Hora Salida 1 *</label>
                      <input
                        type="time"
                        required
                        value={nuevoTurno.hora_salida_1}
                        onChange={e => setNuevoTurno({ ...nuevoTurno, hora_salida_1: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {nuevoTurno.tipo_turno === 'partido' && (
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                    <p className="font-bold text-[10px] text-gray-400 uppercase">Segundo Segmento (Turno Partido)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Hora Entrada 2 *</label>
                        <input
                          type="time"
                          required
                          value={nuevoTurno.hora_entrada_2}
                          onChange={e => setNuevoTurno({ ...nuevoTurno, hora_entrada_2: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Hora Salida 2 *</label>
                        <input
                          type="time"
                          required
                          value={nuevoTurno.hora_salida_2}
                          onChange={e => setNuevoTurno({ ...nuevoTurno, hora_salida_2: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg transition-colors"
                >
                  Crear Turno
                </button>
              </form>
            </div>

            {/* Listado de Turnos */}
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
                        <span className="text-[9px] uppercase tracking-wide bg-amber-500/10 text-amber-600 px-1 py-0.5 rounded font-bold">
                          {t.tipo_turno}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">Tolerancia: {t.tolerancia_minutos} min</span>
                    </div>

                    <div className="text-xs text-gray-500 space-y-1">
                      <p className="flex justify-between">
                        <span>Horario 1:</span>
                        <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                          {t.hora_entrada_1.substring(0,5)} - {t.hora_salida_1.substring(0,5)}
                        </span>
                      </p>
                      {t.tipo_turno === 'partido' && t.hora_entrada_2 && (
                        <p className="flex justify-between">
                          <span>Horario 2:</span>
                          <span className="font-mono font-bold text-gray-700 dark:text-gray-300">
                            {t.hora_entrada_2.substring(0,5)} - {t.hora_salida_2?.substring(0,5)}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {turnos.length === 0 && (
                  <p className="text-gray-400 italic text-center text-xs py-6 col-span-2">No hay turnos creados</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 4: INCIDENCIAS LFT --- */}
        {activeTab === 'incidencias' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Registrar Incidencia */}
            <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <AlertCircle className="text-amber-500" size={18} /> Registrar Incidencia / Permiso
              </h3>

              <form onSubmit={handleCreateIncidencia} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Empleado *</label>
                  <select
                    required
                    value={nuevoIncidencia.empleado_id}
                    onChange={e => setNuevoIncidencia({ ...nuevoIncidencia, empleado_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none"
                  >
                    <option value="">Seleccionar empleado...</option>
                    {empleados.map(e => (
                      <option key={e.id} value={e.id}>{e.nombre_completo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo de Incidencia *</label>
                  <select
                    value={nuevoIncidencia.tipo_incidencia}
                    onChange={e => setNuevoIncidencia({ ...nuevoIncidencia, tipo_incidencia: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                  >
                    <option value="vacaciones">Vacaciones Dignas LFT</option>
                    <option value="permiso_sin_goce">Permiso sin goce de sueldo</option>
                    <option value="permiso_con_goce">Permiso con goce de sueldo</option>
                    <option value="incapacidad_enfermedad">Incapacidad (Enfermedad general)</option>
                    <option value="incapacidad_riesgo">Incapacidad (Riesgo de trabajo)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha Inicio *</label>
                    <input
                      type="date"
                      required
                      value={nuevoIncidencia.fecha_inicio}
                      onChange={e => setNuevoIncidencia({ ...nuevoIncidencia, fecha_inicio: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha Fin *</label>
                    <input
                      type="date"
                      required
                      value={nuevoIncidencia.fecha_fin}
                      onChange={e => setNuevoIncidencia({ ...nuevoIncidencia, fecha_fin: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Motivo / Descripción</label>
                  <textarea
                    rows={3}
                    value={nuevoIncidencia.motivo}
                    onChange={e => setNuevoIncidencia({ ...nuevoIncidencia, motivo: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 focus:outline-none"
                    placeholder="Detallar causa o folio de incapacidad del IMSS..."
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 rounded-lg transition-colors"
                >
                  Registrar Incidencia
                </button>
              </form>
            </div>

            {/* Listado Histórico */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <FileText className="text-amber-500" size={18} /> Historial de Permisos e Incidencias
              </h3>

              <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold">
                      <th className="p-3">Empleado</th>
                      <th className="p-3">Incidencia</th>
                      <th className="p-3">Período</th>
                      <th className="p-3">Días</th>
                      <th className="p-3 text-right">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                    {incidencias.map(inc => (
                      <tr key={inc.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                        <td className="p-3 font-semibold text-gray-900 dark:text-white">
                          {inc.empleados_detalle?.nombre_completo || 'Empleado'}
                        </td>
                        <td className="p-3 capitalize text-gray-600 dark:text-gray-300">
                          {inc.tipo_incidencia.replace(/_/g, ' ')}
                        </td>
                        <td className="p-3 text-gray-500">
                          {inc.fecha_inicio} al {inc.fecha_fin}
                        </td>
                        <td className="p-3 font-semibold text-gray-700 dark:text-gray-300">
                          {inc.total_dias} días
                        </td>
                        <td className="p-3 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                            Aprobado
                          </span>
                        </td>
                      </tr>
                    ))}
                    {incidencias.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-400 italic">No hay incidencias registradas</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 5: NOMINA LFT & PROPINAS --- */}
        {activeTab === 'nomina' && (
          <div className="space-y-6">
            
            {/* Parámetros de Generación */}
            <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                <Sliders className="text-amber-500" size={18} /> Parámetros del Período
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs align-bottom">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha de Inicio *</label>
                  <input
                    type="date"
                    value={periodoNomina.fecha_inicio}
                    onChange={e => setPeriodoNomina({ ...periodoNomina, fecha_inicio: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha de Fin *</label>
                  <input
                    type="date"
                    value={periodoNomina.fecha_fin}
                    onChange={e => setPeriodoNomina({ ...periodoNomina, fecha_fin: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bolsa de Propinas ($)</label>
                  <input
                    type="number"
                    value={periodoNomina.monto_propinas}
                    onChange={e => setPeriodoNomina({ ...periodoNomina, monto_propinas: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                    placeholder="Ej. 12000"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleCalcularNomina}
                    disabled={calculandoNomina}
                    className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 h-9"
                  >
                    {calculandoNomina ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Calculando...
                      </>
                    ) : (
                      <>
                        <DollarSign size={14} /> Calcular Nómina
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Resultado del Cálculo */}
            {nominaCalculada.length > 0 && (
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                    <CheckCircle className="text-emerald-500" size={18} /> Resumen de Nómina y Reparto
                  </h3>
                  <span className="text-[10px] text-gray-400">
                    Compliance LFT y Distribución de Pool por Horas Sincronizadas
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-100/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold">
                        <th className="p-3">Empleado</th>
                        <th className="p-3">Puesto</th>
                        <th className="p-3">Días Trab.</th>
                        <th className="p-3">Sueldo Base</th>
                        <th className="p-3">H. Extra (Dob./Trip.)</th>
                        <th className="p-3">Propina Repartida</th>
                        <th className="p-3">Retenciones (ISR/IMSS)</th>
                        <th className="p-3 text-right">Neto a Pagar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {nominaCalculada.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-semibold text-gray-900 dark:text-white">
                            {item.empleado.nombre_completo}
                          </td>
                          <td className="p-3 text-gray-500">
                            {item.puesto}
                          </td>
                          <td className="p-3 font-mono font-bold text-gray-700 dark:text-gray-300">
                            {item.diasTrabajados} días
                          </td>
                          <td className="p-3 text-gray-700 dark:text-gray-300 font-semibold">
                            ${item.sueldoOrdinario.toFixed(2)}
                          </td>
                          <td className="p-3 text-gray-500">
                            ${(item.pagoExtraDoble + item.pagoExtraTriple).toFixed(2)}
                            <span className="text-[10px] text-gray-400 block mt-0.5">
                              ({item.horasExtra.toFixed(1)} hrs extra)
                            </span>
                          </td>
                          <td className="p-3 text-emerald-600 dark:text-emerald-400 font-bold">
                            ${item.propinaAsignada.toFixed(2)}
                          </td>
                          <td className="p-3 text-rose-500 font-mono">
                            -${(item.isr + item.imss).toFixed(2)}
                            <span className="text-[9px] text-gray-400 block mt-0.5">
                              ISR: ${item.isr.toFixed(2)} | IMSS: ${item.imss.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-3 text-right text-gray-900 dark:text-white font-extrabold text-sm">
                            ${item.neto.toFixed(2)} MXN
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
