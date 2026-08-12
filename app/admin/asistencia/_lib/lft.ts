// TABLAS OFICIALES DE ISR SAT 2025-2026 (Anexo 8 RMF - LISR Art. 96)
interface IsrBracket {
  inferior: number;
  superior: number;
  cuota_fija: number;
  porcentaje: number;
}

// Tarifa Oficial SAT Quincenal (15 días)
const TABLA_ISR_QUINCENAL: IsrBracket[] = [
  { inferior: 0.01, superior: 373.02, cuota_fija: 0.00, porcentaje: 1.92 },
  { inferior: 373.03, superior: 3166.03, cuota_fija: 7.16, porcentaje: 6.40 },
  { inferior: 3166.04, superior: 5564.01, cuota_fija: 185.92, porcentaje: 10.88 },
  { inferior: 5564.02, superior: 6467.91, cuota_fija: 446.42, porcentaje: 16.00 },
  { inferior: 6467.92, superior: 7743.86, cuota_fija: 591.02, porcentaje: 17.92 },
  { inferior: 7743.87, superior: 15618.25, cuota_fija: 725.38, porcentaje: 21.36 },
  { inferior: 15618.26, superior: 24616.50, cuota_fija: 2500.48, porcentaje: 23.52 },
  { inferior: 24616.51, superior: 46996.95, cuota_fija: 4616.95, porcentaje: 30.00 },
  { inferior: 46996.96, superior: 62662.60, cuota_fija: 11331.08, porcentaje: 32.00 },
  { inferior: 62662.61, superior: Infinity, cuota_fija: 16344.09, porcentaje: 35.00 },
];

// Tarifa Oficial SAT Mensual (30.4 días)
const TABLA_ISR_MENSUAL: IsrBracket[] = [
  { inferior: 0.01, superior: 746.04, cuota_fija: 0.00, porcentaje: 1.92 },
  { inferior: 746.05, superior: 6332.05, cuota_fija: 14.32, porcentaje: 6.40 },
  { inferior: 6332.06, superior: 11128.01, cuota_fija: 371.83, porcentaje: 10.88 },
  { inferior: 11128.02, superior: 12935.82, cuota_fija: 892.84, porcentaje: 16.00 },
  { inferior: 12935.83, superior: 15487.71, cuota_fija: 1182.05, porcentaje: 17.92 },
  { inferior: 15487.72, superior: 31236.49, cuota_fija: 1638.98, porcentaje: 21.36 },
  { inferior: 31236.50, superior: 49233.00, cuota_fija: 5000.95, porcentaje: 23.52 },
  { inferior: 49233.01, superior: 93993.90, cuota_fija: 9233.89, porcentaje: 30.00 },
  { inferior: 93993.91, superior: 125325.20, cuota_fija: 22662.16, porcentaje: 32.00 },
  { inferior: 125325.21, superior: Infinity, cuota_fija: 32688.18, porcentaje: 35.00 },
];

// Subsidio al empleo mensual 2025-2026 (Decreto SAT)
function calcularSubsidio(ingresoMensual: number): number {
  if (ingresoMensual <= 9081.00) return 390.00;
  return 0;
}

// TABLAS IMSS 2025-2026 (Cuotas Obrero-Patronales Ley del Seguro Social)
const UMA_DIARIA = 108.57; // UMA Vigente Oficial

function calcularImss(salarioDiarioIntegrado: number, diasTrabajados: number = 15): { obrero: number; patronal: number } {
  if (diasTrabajados <= 0 || salarioDiarioIntegrado <= 0) return { obrero: 0, patronal: 0 };

  const sbcDiario = salarioDiarioIntegrado;
  const sbcTotal = sbcDiario * diasTrabajados;

  // 1. Excedente de 3 UMA (Enfermedad y Maternidad)
  const tresUmaDiaria = 3 * UMA_DIARIA;
  const excedenteDiario = Math.max(0, sbcDiario - tresUmaDiaria);
  const excedenteTotal = excedenteDiario * diasTrabajados;

  // Cuotas Obrero:
  // - E&M Excedente: 0.40% sobre excedente 3 UMA
  // - E&M Dinero: 0.25% sobre SBC
  // - E&M Pensionados: 0.375% sobre SBC
  // - Invalidez y Vida: 0.625% sobre SBC
  // - Cesantía y Vejez: 1.125% sobre SBC
  const obreroExcedente = excedenteTotal * 0.004;
  const obreroSbc = sbcTotal * (0.0025 + 0.00375 + 0.00625 + 0.01125);
  const obreroTotal = obreroExcedente + obreroSbc;

  // Cuotas Patronal:
  // - E&M Fija: 20.40% sobre 1 UMA
  // - E&M Excedente: 1.10% sobre excedente 3 UMA
  // - E&M Dinero: 0.70% sobre SBC
  // - E&M Pensionados: 1.05% sobre SBC
  // - Invalidez y Vida: 1.75% sobre SBC
  // - Riesgos de Trabajo: 0.50% sobre SBC
  // - Guarderías: 1.00% sobre SBC
  // - Retiro: 2.00% sobre SBC
  // - Cesantía y Vejez: 3.15% sobre SBC
  // - INFONAVIT: 5.00% sobre SBC
  const patronFija = (1 * UMA_DIARIA * diasTrabajados) * 0.204;
  const patronExcedente = excedenteTotal * 0.011;
  const patronSbc = sbcTotal * (0.007 + 0.0105 + 0.0175 + 0.005 + 0.01 + 0.02 + 0.0315 + 0.05);
  const patronTotal = patronFija + patronExcedente + patronSbc;

  return {
    obrero: Math.round(obreroTotal * 100) / 100,
    patronal: Math.round(patronTotal * 100) / 100
  };
}

// --- CÁLCULO DE VACACIONES (Vacaciones Dignas - Art. 76 LFT) ---
function calcularDiasVacaciones(aniosAntiguedad: number): number {
  if (aniosAntiguedad < 1) return 0;
  if (aniosAntiguedad === 1) return 12;
  if (aniosAntiguedad === 2) return 14;
  if (aniosAntiguedad === 3) return 16;
  if (aniosAntiguedad === 4) return 18;
  if (aniosAntiguedad <= 9) return 20;
  if (aniosAntiguedad <= 14) return 22;
  if (aniosAntiguedad <= 19) return 24;
  if (aniosAntiguedad <= 24) return 26;
  return 28;
}

function calcularPrimaVacacional(sueldoDiario: number, aniosAntiguedad: number, diasPeriodo: number): number {
  const diasVacacion = calcularDiasVacaciones(aniosAntiguedad);
  const proporcionVacacional = diasPeriodo / 365;
  const diasVacProporcionales = Math.min(diasVacacion * proporcionVacacional, diasVacacion);
  return sueldoDiario * diasVacProporcionales * 0.25;
}

function calcularAguinaldo(sueldoDiario: number, diasTrabajadosAnio: number): number {
  const proporcionAnio = Math.min(1, diasTrabajadosAnio / 365);
  return 15 * sueldoDiario * proporcionAnio;
}

function calcularPrimaDominical(sueldoDiario: number, domingosTrabajados: number): number {
  return sueldoDiario * domingosTrabajados * 0.25;
}

function calcularHorasExtra(
  sueldoDiario: number,
  horasDobles: number,
  horasTriples: number,
  modalidad: 'lft' | 'proporcional' | 'ninguna' = 'lft',
  horasJornada: number = 8
) {
  if (modalidad === 'ninguna') {
    return {
      pagoDoble: 0,
      pagoTriple: 0,
      total: 0,
    };
  }
  const horaNormal = sueldoDiario / (horasJornada || 8);
  if (modalidad === 'proporcional') {
    const totalHoras = horasDobles + horasTriples;
    const pagoSencillo = horaNormal * totalHoras;
    return {
      pagoDoble: pagoSencillo,
      pagoTriple: 0,
      total: pagoSencillo,
    };
  }
  return {
    pagoDoble: horaNormal * horasDobles * 2,
    pagoTriple: horaNormal * horasTriples * 3,
    total: (horaNormal * horasDobles * 2) + (horaNormal * horasTriples * 3),
  };
}

function calcularDescuentoRetardos(sueldoDiario: number, minutosRetardo: number): number {
  const minutoNormal = sueldoDiario / (8 * 60);
  return minutoNormal * minutosRetardo;
}

// ISR (Art. 96 LISR) con Tarifa SAT Quincenal o Mensual según periodo
function calcularIsr(
  ingresoPeriodo: number,
  diasPeriodo: number = 15,
  sueldoMensualDirecto?: number
): { isr: number; subsidio: number } {
  if (!ingresoPeriodo || ingresoPeriodo <= 0) {
    return { isr: 0, subsidio: 0 };
  }

  const esQuincena = diasPeriodo >= 13 && diasPeriodo <= 16;
  const tabla = esQuincena ? TABLA_ISR_QUINCENAL : TABLA_ISR_MENSUAL;

  let bracket = tabla.find(b => ingresoPeriodo >= b.inferior && ingresoPeriodo <= b.superior);
  if (!bracket) {
    bracket = tabla[tabla.length - 1];
  }

  const impuestoMarginal = ((ingresoPeriodo - bracket.inferior) * bracket.porcentaje) / 100;
  const isrBase = bracket.cuota_fija + impuestoMarginal;

  const subsidio = esQuincena ? calcularSubsidio(ingresoPeriodo * 2) / 2 : calcularSubsidio(ingresoPeriodo);
  const isrNeto = Math.max(0, isrBase - subsidio);

  return {
    isr: Math.round(isrNeto * 100) / 100,
    subsidio: Math.round(subsidio * 100) / 100,
  };
}

// --- PRIMA DE ANTIGÜEDAD (Art. 162 LFT) ---
// 12 días de salario por cada año de servicio (para renuncia voluntaria o despido)
// Aquí solo calculamos el acumulado
function calcularPrimaAntiguedad(sueldoDiario: number, aniosServicio: number, salarioMinimo: number = 250): number {
  const salarioTope = Math.min(sueldoDiario, salarioMinimo * 2); // Doble del salario mínimo como tope
  return 12 * salarioTope * aniosServicio;
}

// --- PTU (Art. 117-131 LFT) ---
// 10% de las utilidades de la empresa, 50% proporcional a días, 50% proporcional a salario
function calcularPtu(utilidadFiscalAnual: number, empleados: { id: string; dias: number; salario: number }[]): Map<string, number> {
  const ptuTotal = utilidadFiscalAnual * 0.10;
  const mitadDias = ptuTotal * 0.50;
  const mitadSalario = ptuTotal * 0.50;

  const totalDias = empleados.reduce((s, e) => s + e.dias, 0);
  const totalSalario = empleados.reduce((s, e) => s + e.salario * e.dias, 0);

  const resultado = new Map<string, number>();
  for (const emp of empleados) {
    const porDias = totalDias > 0 ? mitadDias * (emp.dias / totalDias) : 0;
    const porSalario = totalSalario > 0 ? mitadSalario * ((emp.salario * emp.dias) / totalSalario) : 0;
    resultado.set(emp.id, Math.round((porDias + porSalario) * 100) / 100);
  }
  return resultado;
}

// --- FUNCIÓN PRINCIPAL DE CÁLCULO DE NÓMINA ---
export interface NominaInput {
  sueldoDiario: number;
  sueldoMensual?: number;
  salarioDiarioIntegrado: number;
  diasTrabajados: number;
  horasDobles: number;
  horasTriples: number;
  minutosRetardo: number;
  domingosTrabajados: number;
  antiguedadAnios: number;
  diasTrabajadosAnio: number; // Para aguinaldo
  esNominaAguinaldo?: boolean;
  montoPropina?: number;
  modalidadHorasExtra?: 'lft' | 'proporcional' | 'ninguna';
}

export interface NominaOutput {
  percepciones: {
    sueldoOrdinario: number;
    horasExtraDobles: number;
    horasExtraTriples: number;
    primaDominical: number;
    primaVacacional: number;
    aguinaldo: number;
    propina: number;
    otrasPercepciones: number;
    total: number;
  };
  deducciones: {
    isr: number;
    subsidioAlEmpleo: number;
    imssObrero: number;
    descuentoRetardos: number;
    otrasDeducciones: number;
    total: number;
  };
  neto: number;
  sdi: number;
  imssPatronal: number;
}

export function calcularNomina(input: NominaInput): NominaOutput {
  const {
    sueldoDiario, sueldoMensual, salarioDiarioIntegrado, diasTrabajados,
    horasDobles, horasTriples, minutosRetardo,
    domingosTrabajados, antiguedadAnios, diasTrabajadosAnio,
    esNominaAguinaldo = false, montoPropina = 0,
    modalidadHorasExtra = 'lft'
  } = input;

  // Percepciones
  const sueldoOrdinario = sueldoMensual && sueldoMensual > 0
    ? Math.round((sueldoMensual * (diasTrabajados / 30)) * 100) / 100
    : Math.round((sueldoDiario * diasTrabajados) * 100) / 100;
  const { pagoDoble, pagoTriple } = calcularHorasExtra(sueldoDiario, horasDobles, horasTriples, modalidadHorasExtra);
  const primaDominical = calcularPrimaDominical(sueldoDiario, domingosTrabajados);
  const primaVacacional = 0; // Prima vacacional se otorga cuando el trabajador toma sus días de vacaciones
  const aguinaldo = esNominaAguinaldo ? calcularAguinaldo(sueldoDiario, diasTrabajadosAnio) : 0;
  const propina = montoPropina;

  const totalPercepciones = sueldoOrdinario + pagoDoble + pagoTriple + primaDominical + primaVacacional + aguinaldo + propina;

  // Exención de ISR conforme a Ley del Impuesto Sobre la Renta (LISR Art. 93 Fracciones I y XIV):
  // 1. 50% de las horas dobles exento, topado a 5 UMAs por semana de trabajo (o proporcional al periodo)
  // 2. 100% de las horas triples son gravadas para ISR
  // 3. 1 UMA diaria exenta por cada domingo trabajado con prima dominical
  const umaDiaria = UMA_DIARIA || 108.57;
  const semanasEnPeriodo = Math.max(1, diasTrabajados / 7);
  const topeExencionHorasExtraUma = 5 * umaDiaria * semanasEnPeriodo;

  const exencionDobleRaw = pagoDoble * 0.5;
  const horasExtraExentas = Math.min(exencionDobleRaw, topeExencionHorasExtraUma);
  const horasExtraGravadas = (pagoDoble - horasExtraExentas) + pagoTriple;

  const exencionPrimaDominical = Math.min(primaDominical, domingosTrabajados * umaDiaria);
  const primaDominicalGravada = Math.max(0, primaDominical - exencionPrimaDominical);

  // Total Ingreso Gravable para ISR
  const ingresoGravableIsr = sueldoOrdinario + horasExtraGravadas + primaDominicalGravada + aguinaldo + propina;

  // Deducciones
  let isr = 0;
  let subsidio = 0;
  if (ingresoGravableIsr > 0 && diasTrabajados > 0) {
    const isrRes = calcularIsr(ingresoGravableIsr, diasTrabajados, sueldoMensual);
    isr = isrRes.isr;
    subsidio = isrRes.subsidio;
  }

  let imssObrero = 0;
  let imssPatronal = 0;
  if (totalPercepciones > 0 && diasTrabajados > 0) {
    const sdiEffective = salarioDiarioIntegrado > 0 ? salarioDiarioIntegrado : sueldoDiario * 1.0493;
    const { obrero, patronal } = calcularImss(sdiEffective, diasTrabajados);
    imssObrero = obrero;
    imssPatronal = patronal;
  }

  const descuentoRetardos = diasTrabajados > 0 ? calcularDescuentoRetardos(sueldoDiario, minutosRetardo) : 0;

  const totalDeduccionesRaw = isr + imssObrero + descuentoRetardos;
  const totalDeducciones = Math.min(totalPercepciones, totalDeduccionesRaw);

  const neto = Math.max(0, Math.round((totalPercepciones - totalDeducciones) * 100) / 100);

  return {
    percepciones: {
      sueldoOrdinario: Math.round(sueldoOrdinario * 100) / 100,
      horasExtraDobles: Math.round(pagoDoble * 100) / 100,
      horasExtraTriples: Math.round(pagoTriple * 100) / 100,
      primaDominical: Math.round(primaDominical * 100) / 100,
      primaVacacional: Math.round(primaVacacional * 100) / 100,
      aguinaldo: Math.round(aguinaldo * 100) / 100,
      propina: Math.round(propina * 100) / 100,
      otrasPercepciones: 0,
      total: Math.round(totalPercepciones * 100) / 100,
    },
    deducciones: {
      isr: Math.round(isr * 100) / 100,
      subsidioAlEmpleo: Math.round(subsidio * 100) / 100,
      imssObrero: Math.round(imssObrero * 100) / 100,
      descuentoRetardos: Math.round(descuentoRetardos * 100) / 100,
      otrasDeducciones: 0,
      total: Math.round(totalDeducciones * 100) / 100,
    },
    neto,
    sdi: salarioDiarioIntegrado,
    imssPatronal: Math.round(imssPatronal * 100) / 100,
  };
}

export const LFT = {
  calcularDiasVacaciones,
  calcularPrimaVacacional,
  calcularAguinaldo,
  calcularPrimaDominical,
  calcularHorasExtra,
  calcularIsr,
  calcularImss,
  calcularPrimaAntiguedad,
  calcularPtu,
};
