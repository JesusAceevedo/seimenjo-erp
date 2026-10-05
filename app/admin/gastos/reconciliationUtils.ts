// app/admin/gastos/reconciliationUtils.ts
// Utilidades de comprobantes y conciliación

/**
 * Determina si un comprobante (ticket, depósito o corte) corresponde a ventas del mes anterior
 * o diferidas de otro período, por lo que debe ser identificado visualmente y excluido de la Factura Global.
 */
export function isComprobanteVentaMesAnterior(c: any, targetMonth?: string): boolean {
  if (!c) return false;
  if (c.es_venta_mes_anterior === true || c.es_venta_mes_anterior === 'true') return true;
  const desc = (c.descripcion || '').toLowerCase();
  if (desc.includes('[venta_mes_anterior]') || desc.includes('[venta_mes:') || desc.includes('mes anterior') || desc.includes('mes previo')) {
    return true;
  }

  if (c.mes_venta && targetMonth && c.mes_venta !== targetMonth) {
    return true;
  }

  // Detectar "ventas del día DD/MM/YYYY" donde el mes de la venta difiere del mes del depósito
  if (c.fecha) {
    const depMonth = String(c.fecha).substring(0, 7);
    const match = desc.match(/ventas del d[ií]a\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
    if (match) {
      const saleMonth = `${match[3]}-${match[2].padStart(2, '0')}`;
      if (saleMonth !== depMonth) {
        return true;
      }
    }
  }

  return false;
}
