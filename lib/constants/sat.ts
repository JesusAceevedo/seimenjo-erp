export const SAT_FORMAS_PAGO: { codigo: string; nombre: string }[] = [
  { codigo: '01', nombre: 'Efectivo' },
  { codigo: '02', nombre: 'Cheque nominativo' },
  { codigo: '03', nombre: 'Transferencia electrónica' },
  { codigo: '04', nombre: 'Tarjeta de crédito' },
  { codigo: '05', nombre: 'Monedero electrónico' },
  { codigo: '06', nombre: 'Dinero electrónico' },
  { codigo: '08', nombre: 'Vales de despensa' },
  { codigo: '12', nombre: 'Dación en pago' },
  { codigo: '13', nombre: 'Pago por subrogación' },
  { codigo: '14', nombre: 'Pago por consignación' },
  { codigo: '15', nombre: 'Condonación' },
  { codigo: '17', nombre: 'Compensación' },
  { codigo: '23', nombre: 'Novación' },
  { codigo: '24', nombre: 'Confusión' },
  { codigo: '25', nombre: 'Remisión de deuda' },
  { codigo: '26', nombre: 'Prescripción o caducidad' },
  { codigo: '27', nombre: 'A satisfacción del acreedor' },
  { codigo: '28', nombre: 'Tarjeta de débito' },
  { codigo: '29', nombre: 'Tarjeta de servicios' },
  { codigo: '30', nombre: 'Aplicación de anticipos' },
  { codigo: '31', nombre: 'Intermediario pagos' },
  { codigo: '99', nombre: 'Por definir' }
];

export const SAT_FORMAS_PAGO_RECORD: Record<string, string> =
  SAT_FORMAS_PAGO.reduce((acc, fp) => {
    acc[fp.codigo] = fp.nombre;
    return acc;
  }, {} as Record<string, string>);

export const SAT_METODOS_PAGO_RECORD: Record<string, string> = {
  PUE: 'Pago en una sola exhibición',
  PPD: 'Pago en parcialidades o diferido',
};

export const SAT_MONEDAS_RECORD: Record<string, string> = {
  MXN: 'Peso Mexicano',
  USD: 'Dólar Americano',
  EUR: 'Euro',
};

export const SAT_TIPOS_COMPROBANTE_RECORD: Record<string, string> = {
  I: 'Ingreso',
  E: 'Egreso',
  T: 'Traslado',
  N: 'Nómina',
  P: 'Pago',
};

export const SAT_USO_CFDI_RECORD: Record<string, string> = {
  G01: 'Adquisición de mercancías',
  G02: 'Devoluciones, descuentos o bonificaciones',
  G03: 'Gastos en general',
  I01: 'Construcciones',
  I02: 'Mobiliario y equipo de oficina por inversiones',
  I03: 'Equipo de transporte',
  I04: 'Equipo de cómputo y accesorios',
  I05: 'Dados, troqueles, moldes, matrices y herramental',
  I06: 'Comunicaciones telefónicas',
  I07: 'Comunicaciones satelitales',
  I08: 'Otra maquinaria y equipo',
  D01: 'Honorarios médicos, dentales y gastos hospitalarios',
  D02: 'Gastos médicos por incapacidad o discapacidad',
  D03: 'Gastos funerales',
  D04: 'Donativos',
  D05: 'Intereses reales efectivamente pagados por créditos hipotecarios',
  D06: 'Aportaciones voluntarias al SAR',
  D07: 'Primas por seguros de gastos médicos',
  D08: 'Gastos de transportación escolar obligatoria',
  D09: 'Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones',
  D10: 'Pagos por servicios educativos (colegiaturas)',
  P01: 'Por definir',
  CP01: 'Pagos',
  CN01: 'Nómina',
  S01: 'Sin efectos fiscales',
};

export const SAT_REGIMEN_FISCAL_RECORD: Record<string, string> = {
  '601': 'General de Ley Personas Morales',
  '603': 'Personas Morales con Fines no Lucrativos',
  '605': 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
  '606': 'Arrendamiento',
  '607': 'Régimen de Enajenación o Adquisición de Bienes',
  '608': 'Demás ingresos',
  '610': 'Residentes en el Extranjero sin Establecimiento Permanente en México',
  '611': 'Ingresos por Dividendos (socios y accionistas)',
  '612': 'Personas Físicas con Actividades Empresariales y Profesionales',
  '614': 'Ingresos por intereses',
  '615': 'Régimen de los ingresos por obtención de premios',
  '616': 'Sin obligaciones fiscales',
  '620': 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
  '621': 'Incorporación Fiscal',
  '622': 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
  '623': 'Opcional para Grupos de Sociedades',
  '624': 'Coordinados',
  '625': 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  '626': 'Régimen Simplificado de Confianza (RESICO)',
};

export function getMetodoPagoLabel(codigo?: string | null): string {
  if (!codigo) return 'Desconocido';
  const cleanCode = codigo.trim().padStart(2, '0');
  const found = SAT_FORMAS_PAGO.find(fp => fp.codigo === cleanCode);
  return found ? `${found.codigo} - ${found.nombre}` : `${cleanCode} - Otro`;
}

export function getMetodoPagoDescripcion(codigo?: string | null): string {
  if (!codigo) return 'N/A';
  const upper = codigo.trim().toUpperCase();
  return SAT_METODOS_PAGO_RECORD[upper] || codigo;
}

export function getFormaPagoDescripcion(codigo?: string | null): string {
  if (!codigo) return 'N/A';
  const clean = codigo.trim().padStart(2, '0');
  return SAT_FORMAS_PAGO_RECORD[clean] || SAT_FORMAS_PAGO_RECORD[codigo.trim()] || codigo;
}

export function getMonedaDescripcion(codigo?: string | null): string {
  if (!codigo) return 'MXN';
  const upper = codigo.trim().toUpperCase();
  return SAT_MONEDAS_RECORD[upper] || codigo;
}

export function getTipoComprobanteDescripcion(codigo?: string | null): string {
  if (!codigo) return 'N/A';
  const upper = codigo.trim().toUpperCase();
  return SAT_TIPOS_COMPROBANTE_RECORD[upper] || codigo;
}

export function getUsoCfdiDescripcion(codigo?: string | null): string {
  if (!codigo) return '';
  const upper = codigo.trim().toUpperCase();
  return SAT_USO_CFDI_RECORD[upper] ? `${upper} - ${SAT_USO_CFDI_RECORD[upper]}` : codigo;
}

export function getRegimenFiscalDescripcion(codigo?: string | null): string {
  if (!codigo) return '';
  const clean = codigo.trim();
  return SAT_REGIMEN_FISCAL_RECORD[clean] ? `${clean} - ${SAT_REGIMEN_FISCAL_RECORD[clean]}` : codigo;
}
