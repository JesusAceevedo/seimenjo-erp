// app/admin/gastos/templateUtils.ts
// Generador y descargador de plantilla Excel para la carga de estados de cuenta

export interface CategoriaCatalogo {
  id?: string;
  clave?: string;
  nombre: string;
  descripcion?: string | null;
  requiere_comprobante?: boolean | null;
}

export const CATEGORIAS_DEFAULT: CategoriaCatalogo[] = [
  {
    clave: 'EGRESO_COMPRA',
    nombre: 'Pago a Proveedor',
    descripcion: 'Egreso por compras, insumos, servicios o gastos operativos (requiere factura/CFDI).',
    requiere_comprobante: true
  },
  {
    clave: 'INGRESO_VENTA',
    nombre: 'Cobro de Venta',
    descripcion: 'Ingreso por ventas de mostrador, transferencias de clientes o facturas cobradas.',
    requiere_comprobante: true
  },
  {
    clave: 'COMISION_BANCO',
    nombre: 'Comisión Bancaria',
    descripcion: 'Comisiones cobradas directamente por el banco (manejo de cuenta, cheques, SPEI). No deducible/sin factura.',
    requiere_comprobante: false
  },
  {
    clave: 'COMISION_TPV',
    nombre: 'Comisión TPV',
    descripcion: 'Comisión descontada por terminales de cobro Clip, MercadoPago, Parrot, etc.',
    requiere_comprobante: false
  },
  {
    clave: 'TRASPASO',
    nombre: 'Traspaso entre Cuentas',
    descripcion: 'Movimientos de fondos entre cuentas propias de la empresa o transferencias a Caja Chica.',
    requiere_comprobante: false
  },
  {
    clave: 'PRESTAMO',
    nombre: 'Préstamo Bancario',
    descripcion: 'Ingreso por préstamo recibido o salida por amortización de capital e intereses.',
    requiere_comprobante: false
  },
  {
    clave: 'AJUSTE',
    nombre: 'Ajuste Contable',
    descripcion: 'Ajustes o redondeos menores de centavos y correcciones contables.',
    requiere_comprobante: false
  }
];

export async function descargarPlantillaEstadoCuenta(
  categoriasDisponibles?: CategoriaCatalogo[],
  fileName: string = 'Plantilla_Carga_Estado_de_Cuenta.xlsx'
) {
  const XLSX = await import('xlsx');

  const catList = (categoriasDisponibles && categoriasDisponibles.length > 0)
    ? categoriasDisponibles
    : CATEGORIAS_DEFAULT;

  // 1. Hoja 1: Plantilla de Movimientos
  const movimientosData = [
    ['Fecha', 'Concepto', 'Retiro', 'Depósito', 'Referencia', 'Categoría'],
    ['2026-08-01', 'PAGO FACTURA PROVEEDOR DISTRIBUIDORA SA RFC DIS120304XYZ', 14500.00, 0, 'SPEI-874102', 'Pago a Proveedor'],
    ['2026-08-02', 'COBRO DE VENTA MOSTRADOR TERMINAL PARROT LOTE 4410', 0, 8950.00, 'TPV-00912', 'Cobro de Venta'],
    ['2026-08-03', 'COMISION MENSUAL MANEJO DE CUENTA BBVA BANCOMER', 450.00, 0, 'COM-0801', 'Comisión Bancaria'],
    ['2026-08-04', 'COMISION TPV TERMINAL CLIP PROCESAMIENTO', 125.50, 0, 'CLIP-8821', 'Comisión TPV'],
    ['2026-08-05', 'TRASPASO DE FONDOS CUENTA BBVA A CAJA CHICA', 5000.00, 0, 'TRASP-501', 'Traspaso entre Cuentas'],
    ['2026-08-06', 'PAGO MENSUALIDAD PRESTAMO BANCARIO CREDITO PYME', 12000.00, 0, 'CRED-1049', 'Préstamo Bancario'],
    ['2026-08-07', 'AJUSTE POR REDONDEO DE CENTAVOS LIQUIDACION', 0.85, 0, 'AJ-202608', 'Ajuste Contable'],
  ];

  const wsMovimientos = XLSX.utils.aoa_to_sheet(movimientosData);

  // Ajuste de ancho de columnas para Hoja 1
  wsMovimientos['!cols'] = [
    { wch: 14 }, // Fecha
    { wch: 65 }, // Concepto
    { wch: 14 }, // Retiro
    { wch: 14 }, // Depósito
    { wch: 18 }, // Referencia
    { wch: 28 }, // Categoría
  ];

  // 2. Hoja 2: Instrucciones y Catálogo de Categorías
  const instruccionesData: any[][] = [
    ['GUÍA E INSTRUCCIONES PARA LA CARGA DE ESTADOS DE CUENTA'],
    [''],
    ['1. REGLAS DE ESTRUCTURA Y FORMATO DE COLUMNAS'],
    ['Columna', 'Obligatorio', 'Formato Recomendado', 'Descripción y Recomendaciones'],
    ['Fecha', 'SÍ', 'AAAA-MM-DD o DD/MM/AAAA (ej. 2026-08-15 o 15/08/2026)', 'Fecha real de la operación en el banco.'],
    ['Concepto', 'SÍ', 'Texto descriptivo (ej. Proveedor, SPEI, Detalle)', 'Descripción bancaria. Si incluye el RFC del emisor/receptor, el sistema lo detectará automáticamente.'],
    ['Retiro', 'NO', 'Número decimal positivo (ej. 14500.00)', 'Importe de salida/cargo de dinero. Si la fila es un depósito, colocar 0 o dejar vacío.'],
    ['Depósito', 'NO', 'Número decimal positivo (ej. 8950.00)', 'Importe de entrada/abono de dinero. Si la fila es un retiro, colocar 0 o dejar vacío.'],
    ['Referencia', 'NO', 'Texto o número (ej. SPEI-874102, REF-1092)', 'Folio o número de rastreo bancario único para evitar registros duplicados.'],
    ['Categoría', 'OPCIONAL', 'Texto con el nombre de la categoría', 'Asigna la categoría antes de subirlo. Puedes usar cualquiera de los nombres listados abajo.'],
    [''],
    ['2. CATÁLOGO DE CATEGORÍAS DISPONIBLES EN EL SISTEMA'],
    ['Nombre de la Categoría', 'Clave del Sistema', 'Requiere CFDI / Factura', 'Descripción'],
  ];

  catList.forEach(c => {
    instruccionesData.push([
      c.nombre,
      c.clave || 'PERSONALIZADA',
      c.requiere_comprobante ? 'SÍ (Exige XML/PDF)' : 'NO (Exento de CFDI)',
      c.descripcion || 'Sin descripción adicional'
    ]);
  });

  instruccionesData.push(
    [''],
    ['3. CONSEJOS IMPORTANTES'],
    ['• Prevención de duplicados: El sistema valida automáticamente las referencias bancarias y combinaciones de fecha + concepto + monto para evitar duplicidades.'],
    ['• Mapeo en el sistema: Al subir tu archivo en la plataforma, podrás verificar la correspondencia de cada columna y asignar una categoría por defecto si alguna fila está vacía.'],
    ['• Si dejas la columna de Categoría vacía, el movimiento se guardará como "Sin Categoría" y podrás asignarla posteriormente en la pestaña de Banco o por Reglas de Conciliación.']
  );

  const wsInstrucciones = XLSX.utils.aoa_to_sheet(instruccionesData);

  // Ajuste de ancho de columnas para Hoja 2
  wsInstrucciones['!cols'] = [
    { wch: 28 },
    { wch: 22 },
    { wch: 26 },
    { wch: 75 },
  ];

  // 3. Crear libro y agregar hojas
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsMovimientos, 'Plantilla_Movimientos');
  XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones_y_Categorias');

  // 4. Descargar archivo
  XLSX.writeFile(wb, fileName);
}
