export function esComisionTpv(concepto: string, categoriaNombre?: string | null): boolean {
  if (categoriaNombre && categoriaNombre.trim() !== '') {
    const cn = categoriaNombre.toUpperCase();
    if (cn.includes('TPV') || cn.includes('TERMINAL') || cn.includes('PUNTO DE VENTA') || cn.includes('COMISION TPV') || cn.includes('COMISIÓN TPV')) {
      return true;
    }
    // Si tiene una categoría asignada explícita diferente (ej. Nómina, Proveedor, Traspaso), NO es comisión TPV
    return false;
  }

  if (!concepto) return false;
  const c = concepto.toUpperCase();

  // Exclusiones explícitas de conceptos que no son comisiones aunque mencionen plataformas
  if (
    c.includes('NOMINA') ||
    c.includes('NÓMINA') ||
    c.includes('SUELDO') ||
    c.includes('SALARIO') ||
    c.includes('PAGO DE NOMINA') ||
    c.includes('PAGO NOMINA') ||
    c.includes('PENSION') ||
    c.includes('PENSIÓN')
  ) {
    return false;
  }

  // Palabras clave de comisiones o descuentos
  const tienePalabraComision =
    c.includes('COMISION') ||
    c.includes('COMISIÓ') ||
    c.includes('COMIS') ||
    c.includes('COM ') ||
    c.includes('COM.') ||
    c.includes('COM/') ||
    c.includes('IVA COM') ||
    c.includes('COM IVA') ||
    c.includes('DESC') ||
    c.includes('TASA') ||
    c.includes('FEE') ||
    c.includes('RETENCION') ||
    c.includes('RETENCIÓN');

  const esPlataformaTpv =
    c.includes('CLIP') ||
    c.includes('MERCADOPAGO') ||
    c.includes('MERCADO PAGO') ||
    c.includes('PARROT') ||
    c.includes('IZETTLE') ||
    c.includes('STRIPE') ||
    c.includes('SUMUP') ||
    c.includes('TPV') ||
    c.includes('POS') ||
    c.includes('TERMINAL');

  // Si menciona la plataforma TPV Y además tiene término de comisión/descuento/retención
  if (esPlataformaTpv && tienePalabraComision) {
    return true;
  }

  // Patrones directos de comisiones TPV y cargos de tarjeta
  return (
    c.includes('DESC TPV') ||
    c.includes('DESC. TPV') ||
    c.includes('COMISION TPV') ||
    c.includes('COMISIÓ TPV') ||
    c.includes('COMISION TRANSACCION') ||
    c.includes('COMISION TARJETA') ||
    c.includes('COMISION POS') ||
    c.includes('TERMINALES PUNTO DE VENTA') ||
    c.includes('TASA DE DESC') ||
    c.includes('TASA DESC') ||
    c.includes('VTAS TDC') ||
    c.includes('VTAS TDE') ||
    c.includes('COM VTAS') ||
    c.includes('COM. VTAS') ||
    c.includes('COM.VTAS') ||
    c.includes('COMIS VTAS') ||
    c.includes('COMIS. VTAS') ||
    c.includes('IVA COM VTAS') ||
    c.includes('IVA COM. VTAS') ||
    c.includes('COM IVA') ||
    c.includes('COM. IVA') ||
    c.includes('COM.IVA') ||
    c.includes('COM/IVA') ||
    c.includes('IVA/COM') ||
    c.includes('IVA COM') ||
    c.includes('IVA COM.') ||
    c.includes('COMISION IVA') ||
    c.includes('COMISIÓ IVA') ||
    c.includes('IVA COMISION') ||
    c.includes('IVA COMISIÓ') ||
    c.includes('COMIS IVA') ||
    c.includes('COMIS. IVA') ||
    c.includes('COMIS TPV') ||
    c.includes('COMIS. TPV')
  );
}

export function esComisionBancaria(concepto: string, categoriaNombre?: string | null): boolean {
  if (categoriaNombre && categoriaNombre.trim() !== '') {
    const cn = categoriaNombre.toUpperCase();
    if (cn.includes('BANCARIA') || (cn.includes('BANCO') && !cn.includes('TPV'))) {
      return true;
    }
    // Si tiene asignada otra categoría manual, NO es comisión bancaria
    return false;
  }

  if (!concepto) return false;
  const c = concepto.toUpperCase();
  if (esComisionTpv(concepto, categoriaNombre)) return false;

  // Exclusiones explícitas
  if (
    c.includes('NOMINA') ||
    c.includes('NÓMINA') ||
    c.includes('SUELDO') ||
    c.includes('SALARIO') ||
    c.includes('PAGO DE NOMINA')
  ) {
    return false;
  }

  return (
    c.includes('MANEJO DE CUENTA') ||
    c.includes('MANEJO CUENTA') ||
    c.includes('ANUALIDAD') ||
    c.includes('MEMBRESIA') ||
    c.includes('MEMBRESÍA') ||
    c.includes('COMISION SPEI') ||
    c.includes('COMISION SERVICIO') ||
    c.includes('INT/COM') ||
    c.includes('COM TRF') ||
    c.includes('CARGO COMISION')
  );
}
