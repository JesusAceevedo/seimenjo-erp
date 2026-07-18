// Cálculos de nómina conforme a la Ley Federal del Trabajo (LFT) y LISR

// --- TABLAS ISR 2025-2026 (Mensual - Aproximación basada en UMA 2026 ~$113.14) ---
// Fuente: LISR Art. 96 y tablas publicadas por SAT
interface IsrBracket {
  inferior: number;
  superior: number;
  cuota_fija: number;
  porcentaje: number;
}

const TABLA_ISR_MENSUAL: IsrBracket[] = [
  { inferior: 0.01, superior: 8_952.49, cuota_fija: 0, porcentaje: 1.92 },
  { inferior: 8_952.50, superior: 75_984.55, cuota_fija: 171.88, porcentaje: 6.40 },
  { inferior: 75_984.56, superior: 133_536.07, cuota_fija: 4_460.65, porcentaje: 10.88 },
  { inferior: 133_536.08, superior: 155_229.80, cuota_fija: 10_723.41, porcentaje: 16.00 },
  { inferior: 155_229.81, superior: 185_852.57, cuota_fija: 14_194.45, porcentaje: 17.92 },
  { inferior: 185_852.58, superior: 374_837.88, cuota_fija: 19_679.76, porcentaje: 21.36 },
  { inferior: 374_837.89, superior: 758_473.73, cuota_fija: 60_070.93, porcentaje: 23.52 },
  { inferior: 758_473.74, superior: 1_000_000.00, cuota_fija: 150_231.24, porcentaje: 30.00 },
  { inferior: 1_000_000.01, superior: 3_000_000.00, cuota_fija: 222_689.12, porcentaje: 32.00 },
  { inferior: 3_000_000.01, superior: Infinity, cuota_fija: 862_689.12, porcentaje: 35.00 },
];

// Subsidio al empleo mensual 2025-2026 (para ingresos bajos)
function calcularSubsidio(ingresoMensual: number): number {
  if (ingresoMensual <= 10_000) return 400;
  if (ingresoMensual <= 15_000) return 200;
  if (ingresoMensual <= 20_000) return 100;
  return 0;
}

// --- TABLAS IMSS 2026 (Cuotas Obrero-Patronales) ---
// UMA 2026 estimada: ~$113.14/día = ~$3,437/mes
const UMA_DIARIA = 113.14;
const UMA_MENSUAL = UMA_DIARIA * 30.4;

interface ImssCuota {
  concepto: string;
  obrero: number;  // % sobre SBC
  patron: number;  // % sobre SBC
  exento_uma: boolean; // si aplica solo sobre excedente de 3 UMAs
}

const TABLA_IMSS: ImssCuota[] = [
  { concepto: 'Gastos Médicos (Enfermedad y Maternidad)', obrero: 0.375, patron: 1.10, exento_uma: true },
  { concepto: 'Invalidez y Vida', obrero: 0.625, patron: 1.75, exento_uma: true },
  { concepto: 'Cesantía y Vejez', obrero: 0, patron: 3.15, exento_uma: false },
  { concepto: 'Guarderías', obrero: 0, patron: 1.00, exento_uma: false },
  { concepto: 'Riesgos de Trabajo', obrero: 0, patron: 0.5, exento_uma: false }, // Variable según riesgo
  { concepto: 'Retiro', obrero: 0, patron: 2.00, exento_uma: false },
  { concepto: 'INFONAVIT', obrero: 0, patron: 5.00, exento_uma: false },
];

function calcularImss(salarioDiario: number): { obrero: number; patronal: number } {
  const sbcMensual = salarioDiario * 30.4;
  const baseExenta = 3 * UMA_MENSUAL; // 3 UMAs mensuales
  const excedente = Math.max(0, sbcMensual - baseExenta);

  let obrero = 0;
  let patronal = 0;

  for (const cuota of TABLA_IMSS) {
    if (cuota.exento_uma) {
      obrero += (excedente * cuota.obrero) / 100;
      patronal += (excedente * cuota.patron) / 100;
    } else {
      obrero += (sbcMensual * cuota.obrero) / 100;
      patronal += (sbcMensual * cuota.patron) / 100;
    }
  }

  return { obrero: Math.round(obrero * 100) / 100, patronal: Math.round(patronal * 100) / 100 };
}

// --- CÁLCULO DE VACACIONES (Vacaciones Dignas - Art. 76 LFT) ---
// Reforma 2023: 12 días año 1, +2 hasta 20, luego +2 cada 5 años
function calcularDiasVacaciones(aniosAntiguedad: number): number {
  if (aniosAntiguedad < 1) return 0;
  if (aniosAntiguedad === 1) return 12;
  if (aniosAntiguedad === 2) return 14;
  if (aniosAntiguedad === 3) return 16;
  if (aniosAntiguedad === 4) return 18;
  if (aniosAntiguedad <= 9) return 20; // 5-9 años
  if (aniosAntiguedad <= 14) return 22; // 10-14
  if (aniosAntiguedad <= 19) return 24; // 15-19
  if (aniosAntiguedad <= 24) return 26; // 20-24
  return 28; // 25+
}

// Prima vacacional = 25% del salario de los días de vacaciones (Art. 80)
function calcularPrimaVacacional(sueldoDiario: number, aniosAntiguedad: number, diasPeriodo: number): number {
  const diasVacacion = calcularDiasVacaciones(aniosAntiguedad);
  const proporcionVacacional = diasPeriodo / 365;
  const diasVacProporcionales = Math.min(diasVacacion * proporcionVacacional, diasVacacion);
  return sueldoDiario * diasVacProporcionales * 0.25;
}

// --- CÁLCULO DE AGUINALDO (Art. 87 LFT) ---
// 15 días de salario mínimo, proporcional si no trabajó el año completo
function calcularAguinaldo(sueldoDiario: number, diasTrabajadosAnio: number): number {
  if (diasTrabajadosAnio <= 0) return 0;
  const proporcion = Math.min(diasTrabajadosAnio / 365, 1);
  return sueldoDiario * 15 * proporcion;
}

// --- PRIMA DOMINICAL (Art. 71 LFT) ---
// 25% adicional sobre el salario diario por trabajar en domingo
function calcularPrimaDominical(sueldoDiario: number, domingosTrabajados: number): number {
  return sueldoDiario * domingosTrabajados * 0.25;
}

// --- HORAS EXTRA (Art. 66-68 LFT) ---
// Dobles: primeras 9 horas a la semana
// Triples: excedentes de 9 horas
function calcularHorasExtra(sueldoDiario: number, horasDobles: number, horasTriples: number) {
  const horaNormal = sueldoDiario / 8;
  return {
    pagoDoble: horaNormal * horasDobles * 2,
    pagoTriple: horaNormal * horasTriples * 3,
    total: horaNormal * horasDobles * 2 + horaNormal * horasTriples * 3,
  };
}

// --- DESCUENTO POR RETARDOS ---
// Se descuenta el tiempo no laborado (doble por ser tiempo no trabajado dentro de la jornada)
function calcularDescuentoRetardos(sueldoDiario: number, minutosRetardo: number): number {
  const minutoNormal = sueldoDiario / (8 * 60);
  return minutoNormal * minutosRetardo;
}

// --- ISR (Art. 96 LISR) ---
function calcularIsr(ingresoGravableMensual: number): { isr: number; subsidio: number } {
  // Trim or round to avoid floating point edge cases
  const ingreso = Math.round(ingresoGravableMensual * 100) / 100;

  let bracket = TABLA_ISR_MENSUAL.find(b => ingreso >= b.inferior && ingreso <= b.superior);
  if (!bracket) {
    bracket = TABLA_ISR_MENSUAL[TABLA_ISR_MENSUAL.length - 1];
  }

  const isrBase = bracket.cuota_fija + ((ingreso - bracket.inferior) * bracket.porcentaje) / 100;
  const subsidio = calcularSubsidio(ingreso);
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
    sueldoDiario, salarioDiarioIntegrado, diasTrabajados,
    horasDobles, horasTriples, minutosRetardo,
    domingosTrabajados, antiguedadAnios, diasTrabajadosAnio,
    esNominaAguinaldo = false, montoPropina = 0
  } = input;

  // Percepciones
  const sueldoOrdinario = sueldoDiario * diasTrabajados;
  const { pagoDoble, pagoTriple } = calcularHorasExtra(sueldoDiario, horasDobles, horasTriples);
  const primaDominical = calcularPrimaDominical(sueldoDiario, domingosTrabajados);
  const primaVacacional = calcularPrimaVacacional(sueldoDiario, antiguedadAnios, diasTrabajados);
  const aguinaldo = esNominaAguinaldo ? 0 : calcularAguinaldo(sueldoDiario, diasTrabajadosAnio);
  const propina = montoPropina;

  const totalPercepciones = sueldoOrdinario + pagoDoble + pagoTriple + primaDominical + primaVacacional + aguinaldo + propina;

  // Deducciones
  const { isr, subsidio } = calcularIsr(totalPercepciones);
  const { obrero: imssObrero, patronal: imssPatronal } = calcularImss(salarioDiarioIntegrado);
  const descuentoRetardos = calcularDescuentoRetardos(sueldoDiario, minutosRetardo);

  const totalDeducciones = isr + imssObrero + descuentoRetardos;

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
    neto: Math.round((totalPercepciones - totalDeducciones) * 100) / 100,
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
