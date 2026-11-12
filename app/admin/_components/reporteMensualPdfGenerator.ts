export interface RubroConceptoSummary {
  key: 'PROVEEDOR' | 'NOMINA' | 'IMPUESTO' | 'COMISION' | 'OPERATIVO' | 'EFECTIVO' | 'TRASPASO';
  label: string;
  descripcion: string;
  tratamientoFiscal: string;
  esNeutroFiscal: boolean;
  movsBancoCount: number;
  montoBancoTotal: number;
  movsConciliadosCount: number;
  facturasCount: number;
  subtotalFacturado: number;
  ivaFacturado: number;
  totalFacturado: number;
  montoDeducibleSubtotal: number;
  montoNoDeducible: number;
}

export interface ProveedorDiotSummary {
  rfc: string;
  nombre: string;
  facturasCount: number;
  conciliadasCount: number;
  subtotal: number;
  ivaAcreditable: number;
  total: number;
  pagadoEfectivo: number;
  pagadoBanco: number;
}

export interface SemaforoFiscalItem {
  titulo: string;
  nivel: 'verde' | 'amarillo' | 'rojo';
  etiqueta: string;
  resumen: string;
  montoDiferencia: number;
}

export interface TrabajoMensualMetrics {
  // Movimientos del Estado de Cuenta
  totalMovsEstadoCuenta: number;
  totalDepositosCount: number;
  totalDepositosMonto: number;
  totalRetirosCount: number;
  totalRetirosMonto: number;
  movsFacturadosConciliadosCount: number;
  movsFacturadosConciliadosMonto: number;
  movsComprobadosReglaCount: number; // Comisiones, Nómina, Impuestos, Traspasos
  movsComprobadosReglaMonto: number;
  movsNoDeduciblesCount: number;
  movsNoDeduciblesMonto: number;
  movsPendientesCount: number;
  movsPendientesMonto: number;
  porcentajeAvanceEstadoCuenta: number;

  // Facturas Recibidas (Gastos) y Emitidas
  totalFacturasGastosCount: number;
  totalFacturasGastosMonto: number;
  facturasGastosConciliadasCount: number;
  facturasGastosConciliadasMonto: number;
  facturasEfectivoDeduciblesCount: number;
  facturasEfectivoDeduciblesMonto: number;
  facturasConXmlCount: number;
  facturasBancariasSinConciliarCount: number;
  facturasBancariasSinConciliarMonto: number;
  porcentajeFacturasConciliadas: number;
  totalFacturasEmitidasCount: number;
  totalFacturasEmitidasMonto: number;
}

export interface ReporteMensualPdfPayload {
  empresaNombre: string;
  empresaRfc: string;
  selectedMonth: string;
  modalidadIsrLabel: string;
  tasaIsr: number;
  trabajo: TrabajoMensualMetrics;
  rubros: RubroConceptoSummary[];
  semaforo: SemaforoFiscalItem[];
  diotProveedores: ProveedorDiotSummary[];
  ingresos: {
    globalSubtotal: number;
    globalIva: number;
    globalTotalConIva: number;
    subtotalTerceros: number;
    ivaTerceros: number;
    totalTercerosConIva: number;
    countTerceros: number;
    totalDepositosNetos: number;
    ingresosSinIva: number;
    ingresosConIva: number;
    ivaTrasladado: number;
  };
  efectivo: {
    totalEfectivoRetiradoBanco: number;
    retirosCount: number;
    totalEfectivoFacturadoBruto: number;
    facturasEfectivoCount: number;
    totalEfectivoFacturadoDeducible: number;
    subtotalEfectivoFacturadoDeducible: number;
    ivaEfectivoFacturadoDeducible: number;
    excedenteEfectivoRetiradoSinFactura: number;
    totalEfectivoNoDeducibleTope2000: number;
    efectivoPagadoConCajaVentas: number;
  };
  impuestos: {
    deduccionesAutorizadas: number;
    noDeducibles: number;
    utilidadOperativaReal: number;
    margenOperativoPct: number;
    utilidadFiscal: number;
    baseGravableIsr: number;
    isrEstimado: number;
    ivaTrasladado: number;
    ivaAcreditable: number;
    saldoFavorIvaAnterior: number;
    ivaAPagar: number;
    ivaSaldoAFavorMes: number;
    totalImpuestosAPagar: number;
    tasaEfectivaSobreIngresos: number;
    gananciaNetaDespuesImpuestos: number;
    sobrecostoFiscalNoDeducibles: number;
  };
}

const fmtMoney = (val: number): string => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const escapeHtml = (str: string): string =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function generarReporteMensualPdf(payload: ReporteMensualPdfPayload): void {
  const {
    empresaNombre,
    empresaRfc,
    selectedMonth,
    modalidadIsrLabel,
    tasaIsr,
    trabajo,
    rubros,
    semaforo,
    diotProveedores,
    ingresos,
    efectivo,
    impuestos,
  } = payload;

  const fechaGeneracion = new Date().toLocaleString('es-MX', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const rubrosOperativos = rubros.filter((r) => !r.esNeutroFiscal);
  const rubrosNeutros = rubros.filter((r) => r.esNeutroFiscal);

  const sumBancoOperativo = rubrosOperativos.reduce((s, r) => s + r.montoBancoTotal, 0);
  const sumSubFactOperativo = rubrosOperativos.reduce((s, r) => s + r.subtotalFacturado, 0);
  const sumIvaFactOperativo = rubrosOperativos.reduce((s, r) => s + r.ivaFacturado, 0);
  const sumTotFactOperativo = rubrosOperativos.reduce((s, r) => s + r.totalFacturado, 0);
  const sumNoDedOperativo = rubrosOperativos.reduce((s, r) => s + r.montoNoDeducible, 0);

  const topDiot = diotProveedores.slice(0, 15);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Reporte Mensual Contable y Fiscal - ${escapeHtml(empresaNombre)} - ${escapeHtml(selectedMonth)}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 10mm 11mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #f1f5f9;
      margin: 0;
      padding: 0;
      font-size: 10.5px;
      line-height: 1.38;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .toolbar-title {
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.3px;
    }
    .toolbar-actions {
      display: flex;
      gap: 10px;
    }
    .btn {
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
    }
    .btn-primary {
      background: #4f46e5;
      color: #fff;
    }
    .btn-primary:hover {
      background: #4338ca;
    }
    .btn-secondary {
      background: #334155;
      color: #e2e8f0;
    }
    .page-container {
      max-width: 216mm;
      margin: 16px auto;
      background: #ffffff;
      padding: 14mm 14mm;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
      border-radius: 8px;
    }
    @media print {
      body {
        background: #ffffff;
      }
      .toolbar {
        display: none !important;
      }
      .page-container {
        margin: 0;
        padding: 0;
        max-width: 100%;
        box-shadow: none;
        border-radius: 0;
      }
      .page-break {
        page-break-before: always;
      }
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #1e293b;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: -0.3px;
    }
    .brand-subtitle {
      font-size: 11px;
      font-weight: 700;
      color: #4f46e5;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 10px;
      color: #475569;
    }
    .meta-badge {
      display: inline-block;
      background: #eef2ff;
      color: #3730a3;
      border: 1px solid #c7d2fe;
      font-weight: 900;
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 999px;
      margin-bottom: 4px;
    }
    .section-title {
      font-size: 11.5px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      background: #f8fafc;
      border-left: 4px solid #4f46e5;
      padding: 5px 10px;
      margin: 14px 0 8px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .kpi-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 10px;
      background: #ffffff;
    }
    .kpi-card.highlight {
      background: #1e1b4b;
      color: #ffffff;
      border-color: #1e1b4b;
    }
    .kpi-label {
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      display: block;
    }
    .kpi-card.highlight .kpi-label {
      color: #c7d2fe;
    }
    .kpi-value {
      font-size: 14px;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin-top: 3px;
    }
    .kpi-sub {
      font-size: 8.5px;
      color: #475569;
      margin-top: 2px;
    }
    .kpi-card.highlight .kpi-sub {
      color: #e0e7ff;
    }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .three-col {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
    }
    .box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 9px 11px;
      background: #ffffff;
    }
    .box-header {
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      color: #1e293b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }
    .progress-bar-bg {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
      margin: 5px 0 8px 0;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #4f46e5, #10b981);
      border-radius: 999px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 8.5px;
      padding: 5px 6px;
      border-bottom: 1.5px solid #cbd5e1;
      text-align: left;
    }
    td {
      padding: 5px 6px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .font-bold {
      font-weight: 800;
    }
    .row-total {
      background: #f8fafc;
      font-weight: 900;
      border-top: 1.5px solid #94a3b8;
    }
    .badge {
      display: inline-block;
      padding: 1.5px 6px;
      border-radius: 999px;
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .badge-verde {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #86efac;
    }
    .badge-amarillo {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fcd34d;
    }
    .badge-rojo {
      background: #ffe4e6;
      color: #9f1239;
      border: 1px solid #fda4af;
    }
    .badge-neutro {
      background: #e0f2fe;
      color: #075985;
      border: 1px solid #7dd3fc;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      border-bottom: 1px dashed #e2e8f0;
    }
    .stat-row:last-child {
      border-bottom: none;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 26px;
      padding-top: 16px;
    }
    .sig-block {
      text-align: center;
      border-top: 1px solid #475569;
      padding-top: 6px;
      font-size: 9.5px;
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-title">
      📄 Vista Previa del Reporte Mensual de Trabajo Contable e Impuestos — ${escapeHtml(empresaNombre)} (${escapeHtml(selectedMonth)})
    </div>
    <div class="toolbar-actions">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir / Guardar en PDF</button>
      <button class="btn btn-secondary" onclick="window.close()">Cerrar Ventana</button>
    </div>
  </div>

  <div class="page-container">
    <!-- ENCABEZADO MEMBRETADO -->
    <div class="header">
      <div>
        <h1 class="brand-title">${escapeHtml(empresaNombre || 'EMPRESA ACTIVA')}</h1>
        <div class="brand-subtitle">
          REPORTE MENSUAL DE TRABAJO CONTABLE, CONCILIACIÓN BANCARIA Y PRE-CIERRE DE IMPUESTOS
        </div>
        <div style="font-size: 10px; color: #475569; margin-top: 3px;">
          RFC: <strong>${escapeHtml(empresaRfc || 'N/D')}</strong> · Esquema ISR: <strong>${escapeHtml(modalidadIsrLabel)} (${tasaIsr}%)</strong>
        </div>
      </div>
      <div class="meta-box">
        <div class="meta-badge">PERÍODO: ${escapeHtml(selectedMonth)}</div>
        <div>Fecha de emisión: ${escapeHtml(fechaGeneracion)}</div>
        <div>Estatus Conciliación Bancaria: <strong>${trabajo.porcentajeAvanceEstadoCuenta}% Completado</strong></div>
      </div>
    </div>

    <!-- 5 KPIs EJECUTIVOS -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">1. Ingresos Acumulables</span>
        <div class="kpi-value" style="color: #059669;">${fmtMoney(ingresos.ingresosSinIva)}</div>
        <div class="kpi-sub">Con IVA: ${fmtMoney(ingresos.ingresosConIva)}</div>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">2. Deducciones c/Factura</span>
        <div class="kpi-value" style="color: #2563eb;">${fmtMoney(impuestos.deduccionesAutorizadas)}</div>
        <div class="kpi-sub">IVA Acred: ${fmtMoney(impuestos.ivaAcreditable)}</div>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">3. Efectivo Deducido (01)</span>
        <div class="kpi-value" style="color: #0d9488;">${fmtMoney(efectivo.totalEfectivoFacturadoDeducible)}</div>
        <div class="kpi-sub">Retirado Banco: ${fmtMoney(efectivo.totalEfectivoRetiradoBanco)}</div>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">4. No Deducibles / S-CFDI</span>
        <div class="kpi-value" style="color: #d97706;">${fmtMoney(impuestos.noDeducibles)}</div>
        <div class="kpi-sub">Costo Fiscal: ${fmtMoney(impuestos.sobrecostoFiscalNoDeducibles)}</div>
      </div>
      <div class="kpi-card highlight">
        <span class="kpi-label">5. Impuestos Aprox. Mes</span>
        <div class="kpi-value">${fmtMoney(impuestos.totalImpuestosAPagar)}</div>
        <div class="kpi-sub">IVA: ${fmtMoney(impuestos.ivaAPagar)} | ISR: ${fmtMoney(impuestos.isrEstimado)}</div>
      </div>
    </div>

    <!-- SECCIÓN 1: REPORTE DEL TRABAJO REALIZADO EN EL MES -->
    <div class="section-title">
      <span>1. Resumen del Trabajo Contable Realizado en el Mes (Productividad y Conciliación)</span>
      <span>Avance General: ${trabajo.porcentajeAvanceEstadoCuenta}%</span>
    </div>

    <div class="two-col">
      <!-- Estado de Cuenta Bancario -->
      <div class="box">
        <div class="box-header">
          <span>A. Movimientos del Estado de Cuenta (${trabajo.totalMovsEstadoCuenta} movs)</span>
          <span style="color: #4f46e5;">${trabajo.porcentajeAvanceEstadoCuenta}% Conciliado</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, trabajo.porcentajeAvanceEstadoCuenta))}%;"></div>
        </div>
        <div class="stat-row">
          <span>Total Depósitos Bancarios (${trabajo.totalDepositosCount} abonos):</span>
          <strong class="mono" style="color: #059669;">${fmtMoney(trabajo.totalDepositosMonto)}</strong>
        </div>
        <div class="stat-row">
          <span>Total Egresos / Cargos en Banco (${trabajo.totalRetirosCount} cargos):</span>
          <strong class="mono" style="color: #dc2626;">${fmtMoney(trabajo.totalRetirosMonto)}</strong>
        </div>
        <div class="stat-row">
          <span>✅ Movimientos Facturados / Conciliados con CFDI (${trabajo.movsFacturadosConciliadosCount}):</span>
          <strong class="mono">${fmtMoney(trabajo.movsFacturadosConciliadosMonto)}</strong>
        </div>
        <div class="stat-row">
          <span>🏛️ Comisiones, Nómina, Impuestos y Traspasos (${trabajo.movsComprobadosReglaCount}):</span>
          <strong class="mono">${fmtMoney(trabajo.movsComprobadosReglaMonto)}</strong>
        </div>
        <div class="stat-row">
          <span>⚠️ Movimientos Sin Factura / No Deducibles (${trabajo.movsNoDeduciblesCount}):</span>
          <strong class="mono" style="color: #d97706;">${fmtMoney(trabajo.movsNoDeduciblesMonto)}</strong>
        </div>
        <div class="stat-row">
          <span>⏳ Movimientos Pendientes por Conciliar (${trabajo.movsPendientesCount}):</span>
          <strong class="mono" style="color: #e11d48;">${fmtMoney(trabajo.movsPendientesMonto)}</strong>
        </div>
      </div>

      <!-- Facturas y Efectivo Deducido -->
      <div class="box">
        <div class="box-header">
          <span>B. Facturas Procesadas y Efectivo Deducido</span>
          <span style="color: #059669;">${trabajo.porcentajeFacturasConciliadas}% Conciliadas</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, trabajo.porcentajeFacturasConciliadas))}%;"></div>
        </div>
        <div class="stat-row">
          <span>Total Facturas de Gastos/Compras Registradas (${trabajo.totalFacturasGastosCount}):</span>
          <strong class="mono">${fmtMoney(trabajo.totalFacturasGastosMonto)}</strong>
        </div>
        <div class="stat-row">
          <span>🔗 Facturas Conciliadas con Estado de Cuenta (${trabajo.facturasGastosConciliadasCount}):</span>
          <strong class="mono" style="color: #2563eb;">${fmtMoney(trabajo.facturasGastosConciliadasMonto)}</strong>
        </div>
        <div class="stat-row">
          <span>💵 Efectivo Deducido con Facturas (01 ≤ $2,000) (${trabajo.facturasEfectivoDeduciblesCount}):</span>
          <strong class="mono" style="color: #059669;">${fmtMoney(trabajo.facturasEfectivoDeduciblesMonto)}</strong>
        </div>
        <div class="stat-row">
          <span>📁 Facturas con XML Fiscal Validado:</span>
          <strong class="mono">${trabajo.facturasConXmlCount} de ${trabajo.totalFacturasGastosCount} CFDI</strong>
        </div>
        <div class="stat-row">
          <span>🚨 Facturas Bancarias (03/04/28) Sin Conciliar (${trabajo.facturasBancariasSinConciliarCount}):</span>
          <strong class="mono" style="color: #d97706;">${fmtMoney(trabajo.facturasBancariasSinConciliarMonto)}</strong>
        </div>
        <div class="stat-row">
          <span>🧾 Facturas de Ingreso Emitidas (${trabajo.totalFacturasEmitidasCount} CFDI):</span>
          <strong class="mono" style="color: #0d9488;">${fmtMoney(trabajo.totalFacturasEmitidasMonto)}</strong>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 2: SEMÁFORO DE DISCREPANCIA FISCAL SAT -->
    <div class="section-title">
      <span>2. Semáforo de Auditoría y Discrepancia Fiscal (Banco vs. CFDI SAT)</span>
      <span>Control Preventivo</span>
    </div>
    <div class="three-col">
      ${semaforo
        .map(
          (item) => `
        <div class="box">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="font-size: 9.5px;">${escapeHtml(item.titulo)}</strong>
            <span class="badge badge-${item.nivel}">${escapeHtml(item.etiqueta)}</span>
          </div>
          <div style="font-size: 9px; color: #475569;">${escapeHtml(item.resumen)}</div>
        </div>
      `
        )
        .join('')}
    </div>

    <!-- SECCIÓN 3: DESGLOSE POR CONCEPTOS OPERATIVOS (PAGOS A PROVEEDOR, NÓMINA, IMPUESTOS, ETC.) -->
    <div class="section-title">
      <span>3. Separación por Conceptos Contables (Proveedores, Nóminas, Impuestos, Comisiones y Efectivo)</span>
      <span>Cruce Banco vs. Facturas</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>Concepto / Rubro Contable</th>
          <th>Tratamiento Fiscal</th>
          <th class="text-center">Movs Banco</th>
          <th class="text-right">Egreso en Banco</th>
          <th class="text-center">CFDI</th>
          <th class="text-right">Subtotal Fact.</th>
          <th class="text-right">IVA Acred.</th>
          <th class="text-right">Total Facturado</th>
          <th class="text-right">No Deducible / S-CFDI</th>
        </tr>
      </thead>
      <tbody>
        ${rubrosOperativos
          .map(
            (r) => `
          <tr>
            <td>
              <div class="font-bold">${escapeHtml(r.label)}</div>
              <div style="font-size: 8px; color: #64748b;">${escapeHtml(r.descripcion)}</div>
            </td>
            <td><span class="badge badge-verde">${escapeHtml(r.tratamientoFiscal)}</span></td>
            <td class="text-center mono">${r.movsBancoCount}</td>
            <td class="text-right mono font-bold">${fmtMoney(r.montoBancoTotal)}</td>
            <td class="text-center mono">${r.facturasCount}</td>
            <td class="text-right mono">${fmtMoney(r.subtotalFacturado)}</td>
            <td class="text-right mono" style="color: #2563eb;">${fmtMoney(r.ivaFacturado)}</td>
            <td class="text-right mono font-bold" style="color: #059669;">${fmtMoney(r.totalFacturado)}</td>
            <td class="text-right mono" style="color: ${r.montoNoDeducible > 0 ? '#d97706' : '#64748b'}; font-weight: ${
              r.montoNoDeducible > 0 ? '800' : '400'
            };">
              ${fmtMoney(r.montoNoDeducible)}
            </td>
          </tr>
        `
          )
          .join('')}
        <tr class="row-total">
          <td colspan="2">SUBTOTAL OPERATIVO Y FISCAL AFECTO A RESULTADOS</td>
          <td class="text-center mono">${rubrosOperativos.reduce((s, r) => s + r.movsBancoCount, 0)}</td>
          <td class="text-right mono">${fmtMoney(sumBancoOperativo)}</td>
          <td class="text-center mono">${rubrosOperativos.reduce((s, r) => s + r.facturasCount, 0)}</td>
          <td class="text-right mono">${fmtMoney(sumSubFactOperativo)}</td>
          <td class="text-right mono" style="color: #2563eb;">${fmtMoney(sumIvaFactOperativo)}</td>
          <td class="text-right mono" style="color: #059669;">${fmtMoney(sumTotFactOperativo)}</td>
          <td class="text-right mono" style="color: #d97706;">${fmtMoney(sumNoDedOperativo)}</td>
        </tr>
        ${rubrosNeutros
          .map(
            (r) => `
          <tr style="background: #f8fafc; color: #475569;">
            <td>
              <div class="font-bold">${escapeHtml(r.label)}</div>
              <div style="font-size: 8px;">${escapeHtml(r.descripcion)}</div>
            </td>
            <td><span class="badge badge-neutro">${escapeHtml(r.tratamientoFiscal)}</span></td>
            <td class="text-center mono">${r.movsBancoCount}</td>
            <td class="text-right mono">${fmtMoney(r.montoBancoTotal)}</td>
            <td class="text-center mono">${r.facturasCount}</td>
            <td class="text-right mono">${fmtMoney(r.subtotalFacturado)}</td>
            <td class="text-right mono">${fmtMoney(r.ivaFacturado)}</td>
            <td class="text-right mono">${fmtMoney(r.totalFacturado)}</td>
            <td class="text-right mono">$0.00</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <!-- SECCIÓN 4: CÉDULA DE INGRESOS (FACTURA GLOBAL) Y DICTAMEN DE IMPUESTOS (IVA / ISR) -->
    <div class="section-title">
      <span>4. Integración de Ingresos (Factura Global), Ganancias y Cálculo Estimado de Impuestos</span>
      <span>Pre-Cierre Fiscal</span>
    </div>

    <div class="two-col">
      <!-- Ingresos + IVA -->
      <div class="box">
        <div class="box-header">
          <span>A. Ingresos (Factura Global) y Cálculo de IVA (16%)</span>
          <span>Flujo del Mes</span>
        </div>
        <div class="stat-row">
          <span>(+) Factura Global Público en General (Subtotal):</span>
          <strong class="mono">${fmtMoney(ingresos.globalSubtotal)}</strong>
        </div>
        <div class="stat-row">
          <span>(+) Facturas Individuales a Clientes (${ingresos.countTerceros} CFDI Subt.):</span>
          <strong class="mono">${fmtMoney(ingresos.subtotalTerceros)}</strong>
        </div>
        <div class="stat-row" style="background: #f0fdf4; padding: 4px;">
          <strong>(=) Total Ingresos Acumulables (Sin IVA):</strong>
          <strong class="mono" style="color: #059669;">${fmtMoney(ingresos.ingresosSinIva)}</strong>
        </div>
        <div class="stat-row" style="margin-top: 4px;">
          <span>(+) IVA Trasladado Cobrado (Global + Clientes):</span>
          <strong class="mono" style="color: #059669;">${fmtMoney(impuestos.ivaTrasladado)}</strong>
        </div>
        <div class="stat-row">
          <span>(-) IVA Acreditable de Facturas Deducibles:</span>
          <strong class="mono" style="color: #2563eb;">-${fmtMoney(impuestos.ivaAcreditable)}</strong>
        </div>
        ${
          impuestos.saldoFavorIvaAnterior > 0
            ? `<div class="stat-row">
                <span>(-) Saldo a Favor de IVA de Períodos Anteriores:</span>
                <strong class="mono" style="color: #2563eb;">-${fmtMoney(impuestos.saldoFavorIvaAnterior)}</strong>
              </div>`
            : ''
        }
        <div class="stat-row" style="background: #eef2ff; padding: 5px; margin-top: 4px;">
          <strong>(=) ${impuestos.ivaAPagar > 0 ? 'IVA ESTIMADO A PAGAR' : 'SALDO A FAVOR DE IVA'}:</strong>
          <strong class="mono" style="font-size: 11.5px; color: ${impuestos.ivaAPagar > 0 ? '#be123c' : '#059669'};">
            ${fmtMoney(impuestos.ivaAPagar > 0 ? impuestos.ivaAPagar : impuestos.ivaSaldoAFavorMes)}
          </strong>
        </div>
      </div>

      <!-- Utilidad + ISR -->
      <div class="box">
        <div class="box-header">
          <span>B. Ganancias (Operativa vs. Fiscal) y Cálculo de ISR</span>
          <span>Tasa ${tasaIsr}%</span>
        </div>
        <div class="stat-row">
          <span>(+) Ingresos Acumulables del Período (Sin IVA):</span>
          <strong class="mono">${fmtMoney(ingresos.ingresosSinIva)}</strong>
        </div>
        <div class="stat-row">
          <span>(-) Deducciones Autorizadas con CFDI (Sin IVA):</span>
          <strong class="mono" style="color: #2563eb;">-${fmtMoney(impuestos.deduccionesAutorizadas)}</strong>
        </div>
        <div class="stat-row" style="background: #eef2ff; padding: 4px;">
          <strong>(=) Utilidad Fiscal (Base Gravable ISR):</strong>
          <strong class="mono" style="color: #3730a3;">${fmtMoney(impuestos.baseGravableIsr)}</strong>
        </div>
        <div class="stat-row" style="margin-top: 4px;">
          <span>(-) Gastos No Deducibles y Efectivo sin Factura:</span>
          <strong class="mono" style="color: #d97706;">-${fmtMoney(impuestos.noDeducibles)}</strong>
        </div>
        <div class="stat-row">
          <strong>(=) Ganancia Operativa Financiera Real (${impuestos.margenOperativoPct}%):</strong>
          <strong class="mono" style="color: ${impuestos.utilidadOperativaReal >= 0 ? '#059669' : '#dc2626'};">
            ${fmtMoney(impuestos.utilidadOperativaReal)}
          </strong>
        </div>
        <div class="stat-row" style="background: #ffe4e6; padding: 5px; margin-top: 4px;">
          <strong>(=) ISR ESTIMADO DEL MES (${tasaIsr}%):</strong>
          <strong class="mono" style="font-size: 11.5px; color: #be123c;">${fmtMoney(impuestos.isrEstimado)}</strong>
        </div>
        <div class="stat-row" style="background: #ecfdf5; padding: 5px; margin-top: 4px;">
          <strong>(=) GANANCIA NETA LIBRE (DESPUÉS DE IVA E ISR):</strong>
          <strong class="mono" style="font-size: 11.5px; color: #047857;">${fmtMoney(impuestos.gananciaNetaDespuesImpuestos)}</strong>
        </div>
      </div>
    </div>

    <!-- SECCIÓN 5: RESUMEN POR PROVEEDOR (PRE-DIOT) -->
    ${
      topDiot.length > 0
        ? `
      <div class="section-title">
        <span>5. Relación de Principales Proveedores del Mes (Cédula Pre-DIOT por RFC)</span>
        <span>Top ${topDiot.length} de ${diotProveedores.length} Proveedores</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>RFC Proveedor</th>
            <th>Razón Social / Nombre Comercial</th>
            <th class="text-center">CFDI</th>
            <th class="text-center">Conciliadas</th>
            <th class="text-right">Base Gravable (Subt.)</th>
            <th class="text-right">IVA Acreditable</th>
            <th class="text-right">Total Facturado</th>
          </tr>
        </thead>
        <tbody>
          ${topDiot
            .map(
              (p) => `
            <tr>
              <td class="mono font-bold">${escapeHtml(p.rfc)}</td>
              <td>${escapeHtml(p.nombre)}</td>
              <td class="text-center mono">${p.facturasCount}</td>
              <td class="text-center mono">${p.conciliadasCount}/${p.facturasCount}</td>
              <td class="text-right mono">${fmtMoney(p.subtotal)}</td>
              <td class="text-right mono" style="color: #2563eb;">${fmtMoney(p.ivaAcreditable)}</td>
              <td class="text-right mono font-bold">${fmtMoney(p.total)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
        : ''
    }

    <!-- FIRMAS DE REVISIÓN Y CIERRE -->
    <div class="signatures">
      <div class="sig-block">
        <strong>ELABORÓ Y CONCILIÓ</strong><br />
        Departamento de Contabilidad y Administración
      </div>
      <div class="sig-block">
        <strong>REVISÓ Y AUTORIZÓ PRE-CIERRE</strong><br />
        Dirección General — ${escapeHtml(empresaNombre)}
      </div>
    </div>
  </div>
</body>
</html>`;

  const printWin = window.open('', '_blank', 'width=1100,height=850');
  if (!printWin) {
    alert('Por favor permite las ventanas emergentes (pop-ups) en tu navegador para generar el Reporte PDF.');
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}

