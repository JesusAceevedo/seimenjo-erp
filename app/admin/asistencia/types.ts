export interface Departamento {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface Puesto {
  id: string;
  nombre: string;
  salario_diario_base: number;
  salario_mensual_base?: number;
  puntos_propina: number;
  departamento_id?: string;
  departamentos?: { nombre: string };
}

export interface StaffMember {
  id: string;
  correo: string;
  activo: boolean;
}

export interface EmpleadoDetalle {
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
  fotografia_url?: string;
  banco: string;
  cuenta_clabe: string;
  sueldo_diario: number;
  sueldo_mensual?: number;
  salario_diario_integrado: number;
  zkteco_user_id: string;
  exento_reloj_checador?: boolean;
  tipo_contrato: string;
  fecha_ingreso: string;
  fecha_antiguedad?: string;
  fecha_baja?: string;
  domicilio?: string;
  es_sindicalizado?: boolean;
  activo: boolean;
  puesto_id: string;
}

export interface Turno {
  id: string;
  nombre: string;
  tipo_turno: 'fijo' | 'partido' | 'rotativo';
  hora_entrada_1: string;
  hora_salida_1: string;
  hora_entrada_2?: string;
  hora_salida_2?: string;
  tolerancia_minutos: number;
}

export interface HorarioEmpleado {
  id?: string;
  empleado_id: string;
  dia_semana: number;
  turno_id: string;
  es_dia_descanso: boolean;
}

export interface ChecadaRaw {
  id: string;
  empresa_id?: string;
  zkteco_user_id: string;
  dispositivo_sn: string;
  timestamp: string;
  tipo_evento: string;
  metodo_verificacion: string;
  procesado?: boolean;
  empleado?: { nombre_completo: string };
}

export interface Incidencia {
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

export interface PatronDescanso {
  id: string;
  empresa_id?: string;
  nombre: string;
  tipo_patron: 'semanal' | 'quincenal' | 'mensual';
  activo: boolean;
}

export interface PatronDescansoDia {
  id?: string;
  patron_id: string;
  semana_idx: number;
  dia_semana: number;
  es_descanso: boolean;
}

export interface EmpleadoPatronDescanso {
  id?: string;
  empleado_id: string;
  patron_id: string;
  fecha_inicio: string;
  alterna: boolean;
}

export interface DescansoMensual {
  id?: string;
  empleado_id: string;
  fecha: string;
  es_descanso: boolean;
  motivo: 'patron' | 'cambio' | 'extraordinario';
}

export interface TurnoPuesto {
  id?: string;
  puesto_id: string;
  turno_id: string;
  activo: boolean;
}

export interface RotacionTurno {
  id?: string;
  empleado_id: string;
  secuencia: number;
  turno_id: string;
}

export interface ZkTecoComando {
  id: string;
  comando_id: string;
  comando_texto: string;
  categoria: string;
  dispositivo_sn?: string;
  procesado: boolean;
  resultado?: string;
  creado_en: string;
  procesado_en?: string;
}

export interface DiasFestivo {
  id: string;
  empresa_id?: string;
  fecha: string;
  descripcion: string;
  es_recurrente: boolean;
}

export interface dashboardStat {
  empleado: EmpleadoDetalle;
  faltas: number;
  retardos: number;
  salidasTemprano: number;
  horasExtras: number;
  totalHorasTrabajadas: number;
  dailyDetails: any[];
}

export interface NominaResultado {
  empleado: EmpleadoDetalle;
  puesto: string;
  sueldoDiario: number;
  diasTrabajados: number;
  sueldoOrdinario: number;
  horasExtra: number;
  pagoExtraDoble: number;
  pagoExtraTriple: number;
  primaDominical: number;
  horasEstimadas: number;
  propinaAsignada: number;
  isr: number;
  imss: number;
  neto: number;
}

export type TabId = 'monitoreo' | 'empleados' | 'turnos' | 'incidencias' | 'nomina' | 'reloj' | 'descansos' | 'compliance';
