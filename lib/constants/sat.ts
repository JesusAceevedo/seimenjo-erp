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

export function getMetodoPagoLabel(codigo?: string | null): string {
  if (!codigo) return 'Desconocido';
  const cleanCode = codigo.trim().padStart(2, '0');
  const found = SAT_FORMAS_PAGO.find(fp => fp.codigo === cleanCode);
  return found ? `${found.codigo} - ${found.nombre}` : `${cleanCode} - Otro`;
}
