'use client';

import { useState, useMemo } from 'react';
import { DollarSign, Sliders, CheckCircle, RefreshCw, Info, Calendar, Award, AlertTriangle, Settings, ChevronRight, X, Clock, Eye, ShieldCheck, FileText, Check, Download, Printer } from 'lucide-react';
import type { EmpleadoDetalle, Puesto, ChecadaRaw, Turno, Incidencia } from '../types';
import { calcularNominaCompleta, createIncidencia } from '../actions';

interface Props {
  empleados: EmpleadoDetalle[];
  puestos: Puesto[];
  checadasRaw: ChecadaRaw[];
  empresaId: string | null;
  turnos?: Turno[];
  horariosEmpleados?: any[];
  incidencias?: Incidencia[];
}

export default function NominaTab({
  empleados, puestos, checadasRaw, empresaId,
  turnos = [], horariosEmpleados = [], incidencias = []
}: Props) {
  const [subTab, setSubTab] = useState<'general' | 'propinas_diarias' | 'horas_extras'>('general');
  const [searchHorasExtra, setSearchHorasExtra] = useState('');
  const [filtroSoloConExtras, setFiltroSoloConExtras] = useState(false);
  const [selectedEmpHorasExtraModal, setSelectedEmpHorasExtraModal] = useState<any | null>(null);

  // Fecha actual en formato YYYY-MM-DD
  const todayLocalStr = new Date().toLocaleDateString('en-CA');

  // Modo de selección de fecha (por defecto 'diario')
  const [periodoMode, setPeriodoMode] = useState<'diario' | 'quincena' | 'personalizado'>('diario');

  const [periodo, setPeriodo] = useState({
    fecha_inicio: todayLocalStr,
    fecha_fin: todayLocalStr,
    monto_propinas: 0
  });

  const [resultados, setResultados] = useState<any[]>([]);
  const [calculando, setCalculando] = useState(false);
  const [modalidadHorasExtra, setModalidadHorasExtra] = useState<'lft' | 'proporcional' | 'ninguna'>('lft');

  // Parámetros de Propina Diaria (Configurables)
  const [descontarFaltas, setDescontarFaltas] = useState(true);
  const [descontarRetardos, setDescontarRetardos] = useState(true);
  const [toleranciaMinutos, setToleranciaMinutos] = useState(0); // 0 mins por defecto (1 min tarde pierde propina)
  const [criterioReparto, setCriterioReparto] = useState<'puntos' | 'igualitario' | 'horas'>('puntos');
  const [montoPropinasDiarias, setMontoPropinasDiarias] = useState(1000);

  const [selectedEmpDetail, setSelectedEmpDetail] = useState<any | null>(null);
  const [justificarDate, setJustificarDate] = useState<string | null>(null);
  const [justificarForm, setJustificarForm] = useState({ tipo: 'falta_justificada', motivo: '' });
  const [guardandoIncidencia, setGuardandoIncidencia] = useState(false);

  const handleGuardarJustificacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpDetail || !justificarDate || !empresaId) return;
    setGuardandoIncidencia(true);
    try {
      await createIncidencia({
        empresa_id: empresaId,
        empleado_id: selectedEmpDetail.empleado_id,
        tipo: justificarForm.tipo,
        fecha_inicio: justificarDate,
        fecha_fin: justificarDate,
        motivo: justificarForm.motivo || 'Justificado desde nómina',
        estatus: 'aprobado'
      });
      setJustificarDate(null);
      setJustificarForm({ tipo: 'falta_justificada', motivo: '' });
      // Recalcular nómina automáticamente
      const res = await calcularNominaCompleta(
        empresaId, periodo.fecha_inicio, periodo.fecha_fin, periodo.monto_propinas, 0, modalidadHorasExtra
      );
      setResultados(res);
      const empActualizado = res.find(r => r.empleado_id === selectedEmpDetail.empleado_id);
      if (empActualizado) setSelectedEmpDetail(empActualizado);
      alert('Día justificado/incidencia aplicada correctamente.');
    } catch (err: any) {
      alert('Error al justificar: ' + err.message);
    } finally {
      setGuardandoIncidencia(false);
    }
  };

  const parseInputNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    let cleaned = String(val).trim();
    if (!cleaned) return 0;
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      const lastPart = parts[parts.length - 1];
      if (lastPart.length === 3 && parts.length > 1) {
        cleaned = cleaned.replace(/,/g, '');
      } else if (parts.length === 2) {
        cleaned = cleaned.replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const [incluirHoyEnFaltas, setIncluirHoyEnFaltas] = useState<boolean>(false);
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [quincenaNum, setQuincenaNum] = useState<1 | 2>(now.getDate() <= 15 ? 1 : 2);
  const [quincenaMonth, setQuincenaMonth] = useState<string>(currentMonthStr);

  const updateQuincenaDates = (num: 1 | 2, monthStr: string) => {
    if (!monthStr) return;
    const [yearStr, mStr] = monthStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(mStr, 10) - 1;
    let start: Date;
    let end: Date;
    if (num === 1) {
      start = new Date(year, month, 1);
      end = new Date(year, month, 15);
    } else {
      start = new Date(year, month, 16);
      end = new Date(year, month + 1, 0);
    }
    const toStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    setPeriodo(prev => ({
      ...prev,
      fecha_inicio: toStr(start),
      fecha_fin: toStr(end)
    }));
  };

  // Manejar cambio de modo de período
  const handlePeriodoModeChange = (mode: 'diario' | 'quincena' | 'personalizado') => {
    setPeriodoMode(mode);
    if (mode === 'diario') {
      setPeriodo(prev => ({ ...prev, fecha_inicio: todayLocalStr, fecha_fin: todayLocalStr }));
    } else if (mode === 'quincena') {
      updateQuincenaDates(quincenaNum, quincenaMonth);
    }
  };

  const handleCalcular = async () => {
    if (!empresaId) return;
    setCalculando(true);
    try {
      const res = await calcularNominaCompleta(
        empresaId, periodo.fecha_inicio, periodo.fecha_fin, periodo.monto_propinas, 0, modalidadHorasExtra, incluirHoyEnFaltas
      );
      setResultados(res);
    } catch (err: any) {
      alert('Error en cálculo: ' + err.message);
    } finally {
      setCalculando(false);
    }
  };

  const exportToCsv = () => {
    if (!resultados || resultados.length === 0) {
      alert('Primero debes calcular la nómina para exportar los datos a Excel.');
      return;
    }

    const headers = [
      'Empleado',
      'Puesto',
      'Salario Mensual',
      'Sueldo Diario',
      'Días',
      'Ordinario',
      'H. Extra',
      'Dominical',
      'Vacaciones',
      'Propina',
      'ISR',
      'IMSS',
      'Neto'
    ];

    const rows = resultados.map((r: any) => [
      `"${(r.nombre || '').replace(/"/g, '""')}"`,
      `"${(r.puesto || 'General').replace(/"/g, '""')}"`,
      (r.sueldoMensual || Math.round((r.sueldoDiario || 0) * 30)).toFixed(2),
      (r.sueldoDiario || 0).toFixed(2),
      r.diasTrabajados || 0,
      (r.percepciones?.sueldoOrdinario || 0).toFixed(2),
      ((r.percepciones?.horasExtraDobles || 0) + (r.percepciones?.horasExtraTriples || 0)).toFixed(2),
      (r.percepciones?.primaDominical || 0).toFixed(2),
      (r.percepciones?.primaVacacional || 0).toFixed(2),
      (r.percepciones?.propina || 0).toFixed(2),
      (r.deducciones?.isr || 0).toFixed(2),
      (r.deducciones?.imssObrero || 0).toFixed(2),
      (r.neto || 0).toFixed(2)
    ]);

    const totMensual = resultados.reduce((sum, r) => sum + (r.sueldoMensual || Math.round((r.sueldoDiario || 0) * 30)), 0);
    const totDiario = resultados.reduce((sum, r) => sum + (r.sueldoDiario || 0), 0);
    const totDias = resultados.reduce((sum, r) => sum + (r.diasTrabajados || 0), 0);
    const totOrdinario = resultados.reduce((sum, r) => sum + (r.percepciones?.sueldoOrdinario || 0), 0);
    const totHExtra = resultados.reduce((sum, r) => sum + (r.percepciones?.horasExtraDobles || 0) + (r.percepciones?.horasExtraTriples || 0), 0);
    const totDominical = resultados.reduce((sum, r) => sum + (r.percepciones?.primaDominical || 0), 0);
    const totVacaciones = resultados.reduce((sum, r) => sum + (r.percepciones?.primaVacacional || 0), 0);
    const totPropina = resultados.reduce((sum, r) => sum + (r.percepciones?.propina || 0), 0);
    const totISR = resultados.reduce((sum, r) => sum + (r.deducciones?.isr || 0), 0);
    const totIMSS = resultados.reduce((sum, r) => sum + (r.deducciones?.imssObrero || 0), 0);
    const totNeto = resultados.reduce((sum, r) => sum + (r.neto || 0), 0);

    const totalRow = [
      '"Totales"',
      '""',
      totMensual.toFixed(2),
      totDiario.toFixed(2),
      totDias,
      totOrdinario.toFixed(2),
      totHExtra.toFixed(2),
      totDominical.toFixed(2),
      totVacaciones.toFixed(2),
      totPropina.toFixed(2),
      totISR.toFixed(2),
      totIMSS.toFixed(2),
      totNeto.toFixed(2)
    ];

    const csvString = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(',')), totalRow.join(',')].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Nomina_Detalle_${periodo.fecha_inicio}_al_${periodo.fecha_fin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToCsvHorasExtras = () => {
    if (!resultados || resultados.length === 0) {
      alert('Primero debes calcular la nómina para generar el reporte de Horas Extras.');
      return;
    }

    const headers = [
      '"Empleado"',
      '"Puesto"',
      '"Fecha"',
      '"Día"',
      '"Horario Entrada (Prog)"',
      '"Horario Salida (Prog)"',
      '"Entrada (Real)"',
      '"Salida (Real)"',
      '"Estado"',
      '"Horas Laboradas"',
      '"Horas Extras"',
      '"Sueldo Diario ($)"',
      '"Valor Hora Simple ($)"',
      '"Pago Hora Simple ($)"'
    ];

    const emps = resultados.filter(r => {
      const q = searchHorasExtra.toLowerCase();
      const matchSearch = !q || (r.nombre || '').toLowerCase().includes(q) || (r.puesto || '').toLowerCase().includes(q);
      const totalHE = (r.horasDobles || 0) + (r.horasTriples || 0);
      const matchExtras = !filtroSoloConExtras || totalHE > 0;
      return matchSearch && matchExtras;
    });

    const rows: string[][] = [];

    emps.forEach(r => {
      const horaSimple = r.sueldoDiario / 8;
      (r.detallesDias || []).forEach((d: any) => {
        const dateObj = new Date(d.fecha + 'T12:00:00');
        const dow = dateObj.getDay();
        const schedule = horariosEmpleados.find((h: any) => h.empleado_id === r.empleado_id && h.dia_semana === dow);
        const turno = schedule?.turno_id ? turnos.find((t: any) => t.id === schedule.turno_id) : null;

        const hInProg = d.esDescanso ? 'Descanso' : (turno ? (turno.hora_entrada_1?.substring(0, 5) || '09:00') : '09:00');
        const hOutProg = d.esDescanso ? 'Descanso' : (turno ? (turno.hora_salida_1?.substring(0, 5) || '17:00') : '17:00');

        const entradaReal = d.entradas && d.entradas.length >= 1 ? d.entradas[0] : '-';
        const salidaReal = d.entradas && d.entradas.length >= 2 ? d.entradas[d.entradas.length - 1] : '-';

        const hrsExtrasDia = d.horasExtra || 0;
        const pagoDiaSimple = hrsExtrasDia * horaSimple;

        rows.push([
          `"${r.nombre || ''}"`,
          `"${r.puesto || 'General'}"`,
          `"${d.fecha}"`,
          `"${d.diaSemana}"`,
          `"${hInProg}"`,
          `"${hOutProg}"`,
          `"${entradaReal}"`,
          `"${salidaReal}"`,
          `"${d.estado}"`,
          (d.horasTrabajadas || 0).toFixed(1),
          hrsExtrasDia.toFixed(1),
          r.sueldoDiario.toFixed(2),
          horaSimple.toFixed(2),
          pagoDiaSimple.toFixed(2)
        ]);
      });
    });

    const csvString = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Individual_Horas_Extras_${periodo.fecha_inicio}_al_${periodo.fecha_fin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPdfPrint = () => {
    if (!resultados || resultados.length === 0) {
      alert('Primero debes calcular la nómina para generar el reporte en PDF.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes (popups) para abrir el reporte en PDF.');
      return;
    }

    const totMensual = resultados.reduce((sum, r) => sum + (r.sueldoMensual || Math.round((r.sueldoDiario || 0) * 30)), 0);
    const totDiario = resultados.reduce((sum, r) => sum + (r.sueldoDiario || 0), 0);
    const totDias = resultados.reduce((sum, r) => sum + (r.diasTrabajados || 0), 0);
    const totOrdinario = resultados.reduce((sum, r) => sum + (r.percepciones?.sueldoOrdinario || 0), 0);
    const totHExtra = resultados.reduce((sum, r) => sum + (r.percepciones?.horasExtraDobles || 0) + (r.percepciones?.horasExtraTriples || 0), 0);
    const totDominical = resultados.reduce((sum, r) => sum + (r.percepciones?.primaDominical || 0), 0);
    const totVacaciones = resultados.reduce((sum, r) => sum + (r.percepciones?.primaVacacional || 0), 0);
    const totPropina = resultados.reduce((sum, r) => sum + (r.percepciones?.propina || 0), 0);
    const totISR = resultados.reduce((sum, r) => sum + (r.deducciones?.isr || 0), 0);
    const totIMSS = resultados.reduce((sum, r) => sum + (r.deducciones?.imssObrero || 0), 0);
    const totNeto = resultados.reduce((sum, r) => sum + (r.neto || 0), 0);

    const formatMoney = (val: number) => `$${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte de Nómina ${periodo.fecha_inicio} a ${periodo.fecha_fin}</title>
          <style>
            @page {
              size: landscape;
              margin: 8mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 12px;
              color: #111827;
              background: #fff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #111827;
              padding-bottom: 10px;
              margin-bottom: 14px;
            }
            .header h1 {
              font-size: 18px;
              font-weight: 900;
              margin: 0;
              color: #111827;
            }
            .header p {
              font-size: 11px;
              color: #4b5563;
              margin: 3px 0 0 0;
            }
            .kpi-container {
              display: flex;
              gap: 10px;
              margin-bottom: 14px;
            }
            .kpi-card {
              flex: 1;
              padding: 8px 10px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
              background: #f9fafb;
            }
            .kpi-card .title {
              font-size: 8.5px;
              font-weight: 700;
              color: #6b7280;
              text-transform: uppercase;
            }
            .kpi-card .value {
              font-size: 14px;
              font-weight: 800;
              margin-top: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9.5px;
            }
            th {
              background-color: #f3f4f6;
              color: #111827;
              font-weight: 800;
              text-align: left;
              padding: 6px 6px;
              border-bottom: 2px solid #374151;
              text-transform: uppercase;
              font-size: 8.5px;
            }
            td {
              padding: 5px 6px;
              border-bottom: 1px solid #e5e7eb;
            }
            tr:nth-child(even) {
              background-color: #fcfcfc;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .total-row {
              background-color: #f3f4f6 !important;
              font-weight: 900;
              border-top: 2px solid #111827;
              border-bottom: 2px solid #111827;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>REPORTE GENERAL DE NÓMINA</h1>
              <p>Período Activo: <strong>${periodo.fecha_inicio}</strong> al <strong>${periodo.fecha_fin}</strong> | Cumplimiento LFT & SAT LISR Art. 96</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 11px; font-weight: 800; color: #111827;">RAMEN DE PLAYA / SEIMENJO</p>
              <p style="font-size: 9px; color: #6b7280;">Emisión: ${new Date().toLocaleDateString('es-MX')} ${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          <div class="kpi-container">
            <div class="kpi-card">
              <div class="title">Sueldos Ordinarios</div>
              <div class="value" style="color: #111827;">${formatMoney(totOrdinario)}</div>
            </div>
            <div class="kpi-card">
              <div class="title">Horas Extra</div>
              <div class="value" style="color: #d97706;">${formatMoney(totHExtra)}</div>
            </div>
            <div class="kpi-card">
              <div class="title">Propinas</div>
              <div class="value" style="color: #059669;">${formatMoney(totPropina)}</div>
            </div>
            <div class="kpi-card">
              <div class="title">Retención ISR</div>
              <div class="value" style="color: #dc2626;">-${formatMoney(totISR)}</div>
            </div>
            <div class="kpi-card">
              <div class="title">Cuotas IMSS</div>
              <div class="value" style="color: #e11d48;">-${formatMoney(totIMSS)}</div>
            </div>
            <div class="kpi-card" style="background: #ecfdf5; border-color: #a7f3d0;">
              <div class="title" style="color: #047857;">Total Neto a Pagar</div>
              <div class="value" style="color: #047857;">${formatMoney(totNeto)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Puesto</th>
                <th class="text-right">Salario Mensual</th>
                <th class="text-right">Sueldo Diario</th>
                <th class="text-center">Días</th>
                <th class="text-right">Ordinario</th>
                <th class="text-right">H. Extra</th>
                <th class="text-right">Dominical</th>
                <th class="text-right">Vacaciones</th>
                <th class="text-right">Propina</th>
                <th class="text-right">ISR</th>
                <th class="text-right">IMSS</th>
                <th class="text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              ${resultados.map((r: any) => `
                <tr>
                  <td class="font-bold">${r.nombre || ''} ${r.exentoReloj ? '<span style="font-size: 8px; color: #2563eb; background: #eff6ff; padding: 1px 4px; border-radius: 3px; border: 1px solid #bfdbfe;">Sueldo Fijo</span>' : ''}</td>
                  <td style="color: #4b5563;">${r.puesto || 'General'}</td>
                  <td class="text-right font-mono" style="color: #059669; font-weight: 700;">${formatMoney(r.sueldoMensual || Math.round((r.sueldoDiario || 0) * 30))}</td>
                  <td class="text-right font-mono" style="color: #6b7280;">${formatMoney(r.sueldoDiario || 0)}</td>
                  <td class="text-center font-mono font-bold">${r.diasTrabajados || 0}</td>
                  <td class="text-right font-mono">${formatMoney(r.percepciones?.sueldoOrdinario || 0)}</td>
                  <td class="text-right font-mono" style="color: #d97706;">${formatMoney((r.percepciones?.horasExtraDobles || 0) + (r.percepciones?.horasExtraTriples || 0))}</td>
                  <td class="text-right font-mono" style="color: #2563eb;">${formatMoney(r.percepciones?.primaDominical || 0)}</td>
                  <td class="text-right font-mono" style="color: #7c3aed;">${formatMoney(r.percepciones?.primaVacacional || 0)}</td>
                  <td class="text-right font-mono" style="color: #059669; font-weight: 600;">${formatMoney(r.percepciones?.propina || 0)}</td>
                  <td class="text-right font-mono" style="color: #dc2626;">${r.deducciones?.isr > 0 ? `-${formatMoney(r.deducciones.isr)}` : '$0.00'}</td>
                  <td class="text-right font-mono" style="color: #e11d48;">${r.deducciones?.imssObrero > 0 ? `-${formatMoney(r.deducciones.imssObrero)}` : '$0.00'}</td>
                  <td class="text-right font-mono font-bold" style="font-size: 10.5px;">${formatMoney(r.neto || 0)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="2">TOTALES GENERATION</td>
                <td class="text-right font-mono">${formatMoney(totMensual)}</td>
                <td class="text-right font-mono">${formatMoney(totDiario)}</td>
                <td class="text-center font-mono">${totDias}</td>
                <td class="text-right font-mono">${formatMoney(totOrdinario)}</td>
                <td class="text-right font-mono">${formatMoney(totHExtra)}</td>
                <td class="text-right font-mono">${formatMoney(totDominical)}</td>
                <td class="text-right font-mono">${formatMoney(totVacaciones)}</td>
                <td class="text-right font-mono">${formatMoney(totPropina)}</td>
                <td class="text-right font-mono" style="color: #dc2626;">-${formatMoney(totISR)}</td>
                <td class="text-right font-mono" style="color: #e11d48;">-${formatMoney(totIMSS)}</td>
                <td class="text-right font-mono" style="font-size: 11px; color: #047857;">${formatMoney(totNeto)}</td>
              </tr>
            </tbody>
          </table>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const exportToPdfPrintHorasExtras = () => {
    if (!resultados || resultados.length === 0) {
      alert('Primero debes calcular la nómina para generar el reporte de Horas Extras en PDF.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes (popups) para abrir el reporte en PDF.');
      return;
    }

    const emps = resultados.filter(r => {
      const q = searchHorasExtra.toLowerCase();
      const matchSearch = !q || (r.nombre || '').toLowerCase().includes(q) || (r.puesto || '').toLowerCase().includes(q);
      const totalHE = (r.horasDobles || 0) + (r.horasTriples || 0);
      const matchExtras = !filtroSoloConExtras || totalHE > 0;
      return matchSearch && matchExtras;
    });

    const formatMoney = (val: number) => `$${val.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reporte Individual de Asistencia y Horas Extras</title>
          <style>
            @page { size: landscape; margin: 8mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 12px; color: #111827; background: #fff; }
            .emp-page { page-break-after: always; margin-bottom: 24px; }
            .emp-page:last-child { page-break-after: avoid; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d97706; padding-bottom: 8px; margin-bottom: 12px; }
            .header h1 { font-size: 16px; font-weight: 900; margin: 0; color: #d97706; }
            .header p { font-size: 10px; color: #4b5563; margin: 2px 0 0 0; }
            .kpi-container { display: flex; gap: 10px; margin-bottom: 12px; }
            .kpi-card { flex: 1; padding: 6px 8px; border-radius: 6px; border: 1px solid #e5e7eb; background: #f9fafb; }
            .kpi-card .title { font-size: 8px; font-weight: 700; color: #6b7280; text-transform: uppercase; }
            .kpi-card .value { font-size: 13px; font-weight: 800; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; }
            th { background-color: #fffbeb; color: #92400e; font-weight: 800; text-align: left; padding: 5px 6px; border-bottom: 2px solid #d97706; text-transform: uppercase; font-size: 8px; }
            td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; }
            tr:nth-child(even) { background-color: #fcfcfc; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .total-row { background-color: #fffbeb !important; font-weight: 900; }
            .signatures { display: flex; justify-content: space-around; margin-top: 35px; }
            .sig-box { text-align: center; border-top: 1px solid #9ca3af; width: 230px; padding-top: 4px; font-size: 9.5px; font-weight: 700; color: #374151; }
          </style>
        </head>
        <body>
          ${emps.map((r, empIdx) => {
            const horaSimple = r.sueldoDiario / 8;
            const totalHE = (r.horasDobles || 0) + (r.horasTriples || 0);
            const pagoSimples = totalHE * horaSimple;
            const pagoLft = (r.percepciones?.horasExtraDobles || 0) + (r.percepciones?.horasExtraTriples || 0);
            const horasTotales = r.totalHorasTrabajadas || (r.diasTrabajados * 8);
            const diasPeriodo = r.diasTotalesPeriodo || 7;
            const horasSemanales = (horasTotales / diasPeriodo) * 7;

            return `
              <div class="emp-page">
                <div class="header">
                  <div>
                    <h1>DESGLOSE INDIVIDUAL DE ASISTENCIA Y HORAS EXTRAS (HOJA ${empIdx + 1} DE ${emps.length})</h1>
                    <p>Empleado: <strong>${r.nombre || ''}</strong> | Puesto: <strong>${r.puesto || 'General'}</strong> | Período: <strong>${periodo.fecha_inicio}</strong> al <strong>${periodo.fecha_fin}</strong></p>
                  </div>
                  <div style="text-align: right; font-size: 9.5px; color: #4b5563;">
                    Sueldo Diario: <strong>${formatMoney(r.sueldoDiario)}</strong><br/>
                    Valor Hora Simple: <strong style="color: #059669;">${formatMoney(horaSimple)}/h</strong>
                  </div>
                </div>

                <div class="kpi-container">
                  <div class="kpi-card">
                    <div class="title">Horas Trab. Período</div>
                    <div class="value" style="color: #111827;">${horasTotales.toFixed(1)} hrs</div>
                  </div>
                  <div class="kpi-card">
                    <div class="title">Promedio Horas / Semana</div>
                    <div class="value" style="color: ${horasSemanales > 48 ? '#d97706' : '#111827'};">${horasSemanales.toFixed(1)} h/sem</div>
                  </div>
                  <div class="kpi-card">
                    <div class="title">Total Horas Extras</div>
                    <div class="value" style="color: #b45309;">${totalHE.toFixed(1)} hrs</div>
                  </div>
                  <div class="kpi-card">
                    <div class="title">Pago a Horas Simples</div>
                    <div class="value" style="color: #059669;">${formatMoney(pagoSimples)}</div>
                  </div>
                  <div class="kpi-card">
                    <div class="title">Ref. Pago LFT (Dobles/Triples)</div>
                    <div class="value" style="color: #2563eb;">${formatMoney(pagoLft)}</div>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Día</th>
                      <th>Horario Programado</th>
                      <th class="text-center">Entrada Real</th>
                      <th class="text-center">Salida Real</th>
                      <th class="text-center">Estado</th>
                      <th class="text-center">Horas Laboradas</th>
                      <th class="text-center">Horas Extras</th>
                      <th class="text-right">Pago Hora Simple</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(r.detallesDias || []).map((d: any) => {
                      const hrsExtrasDia = d.horasExtra || 0;
                      const pagoDiaSimple = hrsExtrasDia * horaSimple;

                      const dateObj = new Date(d.fecha + 'T12:00:00');
                      const dow = dateObj.getDay();
                      const schedule = horariosEmpleados.find((h: any) => h.empleado_id === r.empleado_id && h.dia_semana === dow);
                      const turno = schedule?.turno_id ? turnos.find((t: any) => t.id === schedule.turno_id) : null;
                      const horarioProg = d.esDescanso
                        ? '☀️ Descanso'
                        : turno
                        ? `${turno.hora_entrada_1?.substring(0,5)} - ${turno.hora_salida_1?.substring(0,5)}`
                        : '09:00 - 17:00';

                      const entradaReal = d.entradas && d.entradas.length >= 1 ? d.entradas[0] : '-';
                      const salidaReal = d.entradas && d.entradas.length >= 2 ? d.entradas[d.entradas.length - 1] : '-';

                      return `
                        <tr style="${hrsExtrasDia > 0 ? 'background-color: #fffbeb;' : ''}">
                          <td class="font-bold font-mono">${d.fecha}</td>
                          <td style="color: #4b5563;" class="capitalize">${d.diaSemana}</td>
                          <td class="font-mono" style="color: #374151;">${horarioProg}</td>
                          <td class="text-center font-mono font-bold" style="color: ${entradaReal !== '-' ? '#059669' : '#9ca3af'};">${entradaReal}</td>
                          <td class="text-center font-mono font-bold" style="color: ${salidaReal !== '-' ? '#2563eb' : '#9ca3af'};">${salidaReal}</td>
                          <td class="text-center">${d.estado === 'descanso' ? '☀️ Descanso' : d.estado === 'justificado' ? '🛡️ Justificado' : d.estado === 'exento' ? 'Sueldo Fijo' : d.tieneChecadas ? '✅ Asistencia' : '❌ Sin checada'}</td>
                          <td class="text-center font-mono font-bold">${d.horasTrabajadas ? `${d.horasTrabajadas.toFixed(1)} h` : '-'}</td>
                          <td class="text-center font-mono font-bold" style="color: ${hrsExtrasDia > 0 ? '#b45309' : '#9ca3af'};">${hrsExtrasDia > 0 ? `+${hrsExtrasDia.toFixed(1)} h` : '0.0 h'}</td>
                          <td class="text-right font-mono font-bold" style="color: #059669;">${formatMoney(pagoDiaSimple)}</td>
                        </tr>
                      `;
                    }).join('')}
                    <tr class="total-row">
                      <td colspan="6">TOTALES DÍAS EVALUADOS</td>
                      <td class="text-center font-mono" style="color: #111827;">${horasTotales.toFixed(1)} h</td>
                      <td class="text-center font-mono" style="color: #b45309;">${totalHE.toFixed(1)} hrs</td>
                      <td class="text-right font-mono" style="color: #059669; font-size: 11px;">${formatMoney(pagoSimples)}</td>
                    </tr>
                  </tbody>
                </table>

                <div class="signatures">
                  <div class="sig-box">Firma del Empleado (Recibí de Conformidad)</div>
                  <div class="sig-box">Autorizado por (Recursos Humanos / Nómina)</div>
                </div>
              </div>
            `;
          }).join('')}

          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 300);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const totalOrdinario = resultados.reduce((s, r) => s + (r.percepciones?.sueldoOrdinario || 0), 0);
  const totalExtras = resultados.reduce((s, r) => s + (r.percepciones?.horasExtraDobles || 0) + (r.percepciones?.horasExtraTriples || 0), 0);
  const totalPropinas = resultados.reduce((s, r) => s + (r.percepciones?.propina || 0), 0);
  const totalIsr = resultados.reduce((s, r) => s + (r.deducciones?.isr || 0), 0);
  const totalImss = resultados.reduce((s, r) => s + (r.deducciones?.imssObrero || 0), 0);
  const totalNeto = resultados.reduce((s, r) => s + (r.neto || 0), 0);

  // Cálculo Dinámico de Propinas Diarias por Día (Sin considerar días futuros que no han transcurrido)
  const propinasDiariasCalc = useMemo(() => {
    const now = new Date();

    if (!empleados.length || !periodo.fecha_inicio || !periodo.fecha_fin) {
      return { empTotals: [], dateList: [], totalPenalties: 0, totalTipsAssigned: 0, elapsedDaysCount: 0 };
    }

    const dateList: string[] = [];
    let cur = new Date(periodo.fecha_inicio + 'T00:00:00');
    const end = new Date(periodo.fecha_fin + 'T23:59:59');
    while (cur <= end) {
      dateList.push(cur.toLocaleDateString('en-CA'));
      cur.setDate(cur.getDate() + 1);
    }

    // Días transcurridos en el rango (<= hoy)
    const elapsedDates = dateList.filter(d => d <= todayLocalStr);
    const elapsedDaysCount = elapsedDates.length || 1;
    const poolPerDay = (montoPropinasDiarias || 0) / elapsedDaysCount;

    let totalPenalties = 0;

    const empDailyMap = new Map<string, any[]>();
    empleados.forEach(e => empDailyMap.set(e.id, []));

    dateList.forEach(dateStr => {
      const parts = dateStr.split('-');
      const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
      const dayOfWeek = dateObj.getDay();
      const isFuture = dateStr > todayLocalStr;

      let dailyEligiblePointsSum = 0;

      const dayEmps = empleados.map(emp => {
        const empLogs = checadasRaw.filter(l => l.zkteco_user_id === emp.zkteco_user_id);
        const dayLogs = empLogs
          .filter(l => new Date(l.timestamp).toLocaleDateString('en-CA') === dateStr)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const hasChecked = dayLogs.length > 0;
        const schedule = horariosEmpleados.find(h => h.empleado_id === emp.id && h.dia_semana === dayOfWeek);
        const esDescanso = schedule ? schedule.es_dia_descanso : true;
        const turno = schedule?.turno_id ? turnos.find(t => t.id === schedule.turno_id) : null;
        const puesto = puestos.find(p => p.id === emp.puesto_id);
        const puntosPuesto = puesto?.puntos_propina || 1;

        let eligible = true;
        let reason = 'Elegible';
        let retardoMins = 0;

        if (isFuture) {
          // Día futuro que aún no ha transcurrido: NO es falta, NO penaliza
          eligible = false;
          reason = 'Día futuro (No transcurrido)';
        } else if (!hasChecked) {
          if (!schedule || esDescanso) {
            eligible = false;
            reason = 'Día Libre / Descanso';
          } else if (dateStr === todayLocalStr) {
            // Verificar si el turno de hoy ya inició o superó el tiempo límite
            let turnoHaIniciado = true;
            if (turno && turno.hora_entrada_1) {
              const [hIn, mIn] = turno.hora_entrada_1.split(':').map(Number);
              const shiftLimit = new Date();
              shiftLimit.setHours(hIn, mIn + (turno.tolerancia_minutos || 0), 59, 999);
              if (now < shiftLimit) {
                turnoHaIniciado = false;
              }
            }
            if (!turnoHaIniciado) {
              eligible = true;
              reason = 'Turno por iniciar hoy';
            } else if (descontarFaltas) {
              eligible = false;
              reason = 'Sin propina por Falta / Inasistencia';
              totalPenalties++;
            }
          } else if (descontarFaltas) {
            // Día pasado sin registro
            eligible = false;
            reason = 'Sin propina por Falta / Inasistencia';
            totalPenalties++;
          }
        } else {
          // Checó entrada
          if (turno && turno.hora_entrada_1) {
            const [hIn, mIn] = turno.hora_entrada_1.split(':').map(Number);
            const entrada = new Date(dayLogs[0].timestamp);
            const shiftStart = new Date(entrada);
            shiftStart.setHours(hIn, mIn, 0, 0);

            if (entrada > shiftStart) {
              retardoMins = Math.round((entrada.getTime() - shiftStart.getTime()) / (1000 * 60));
              if (descontarRetardos && retardoMins > toleranciaMinutos) {
                eligible = false;
                reason = `Sin propina por Retardo (${retardoMins} min > ${toleranciaMinutos} min tol.)`;
                totalPenalties++;
              }
            }
          }
        }

        let weight = 0;
        if (eligible && !isFuture) {
          if (criterioReparto === 'puntos') weight = puntosPuesto;
          else if (criterioReparto === 'igualitario') weight = 1;
          else if (criterioReparto === 'horas') {
            if (dayLogs.length > 1) {
              const hrs = (new Date(dayLogs[dayLogs.length - 1].timestamp).getTime() - new Date(dayLogs[0].timestamp).getTime()) / (1000 * 60 * 60);
              weight = Math.max(1, hrs);
            } else weight = 8;
          }
          dailyEligiblePointsSum += weight;
        }

        return { emp, eligible, reason, retardoMins, weight, hasChecked, dayLogs, turno, isFuture };
      });

      const eligibleItems = dayEmps.filter(item => item.eligible && !item.isFuture && dailyEligiblePointsSum > 0);
      let dayAccumulated = 0;

      dayEmps.forEach(item => {
        let finalShare = 0;
        if (item.eligible && !item.isFuture && dailyEligiblePointsSum > 0) {
          const eligibleIdx = eligibleItems.findIndex(e => e.emp.id === item.emp.id);
          const rawShare = (poolPerDay * item.weight) / dailyEligiblePointsSum;
          if (eligibleIdx === eligibleItems.length - 1) {
            finalShare = Math.max(0, Math.round((poolPerDay - dayAccumulated) * 100) / 100);
          } else {
            finalShare = Math.round(rawShare * 100) / 100;
            dayAccumulated += finalShare;
          }
        }

        empDailyMap.get(item.emp.id)!.push({
          date: dateStr,
          eligible: item.eligible,
          reason: item.reason,
          retardoMins: item.retardoMins,
          share: finalShare,
          hasChecked: item.hasChecked,
          isFuture: item.isFuture,
          checkInTime: item.dayLogs.length > 0 ? new Date(item.dayLogs[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'
        });
      });
    });

    let totalTipsAssigned = 0;
    const empTotals = empleados.map(emp => {
      const puesto = puestos.find(p => p.id === emp.puesto_id);
      const dailyDetails = empDailyMap.get(emp.id) || [];
      const diasElegibles = dailyDetails.filter(d => d.eligible && !d.isFuture).length;
      const diasPenalizados = dailyDetails.filter(d => !d.eligible && d.reason.includes('Sin propina por')).length;
      const propinaTotal = dailyDetails.reduce((sum, d) => sum + d.share, 0);

      totalTipsAssigned += propinaTotal;

      return {
        empleado: emp,
        puesto: puesto?.nombre || 'General',
        puntosPuesto: puesto?.puntos_propina || 1,
        diasElegibles,
        diasPenalizados,
        propinaTotal: Math.round(propinaTotal * 100) / 100,
        dailyDetails
      };
    });

    return {
      empTotals,
      dateList,
      totalPenalties,
      totalTipsAssigned: Math.round(totalTipsAssigned * 100) / 100,
      elapsedDaysCount
    };
  }, [empleados, puestos, checadasRaw, horariosEmpleados, turnos, periodo, descontarFaltas, descontarRetardos, toleranciaMinutos, criterioReparto, montoPropinasDiarias, todayLocalStr]);

  // Toggle colapsable de filtros (por defecto ocultos como en Contabilidad)
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-6">
      {/* Sub-Navegación de Nómina y Propinas + Botón Toggle de Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-950 p-2.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setSubTab('general')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'general'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <DollarSign size={16} /> Nómina General LFT
          </button>
          <button
            onClick={() => setSubTab('propinas_diarias')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'propinas_diarias'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <Award size={16} /> Submódulo: Propina Diaria
          </button>
          <button
            onClick={() => setSubTab('horas_extras')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === 'horas_extras'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <Clock size={16} /> Reporte: Horas Extras (Simples)
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
            Período Activo: <strong>{periodo.fecha_inicio}</strong> al <strong>{periodo.fecha_fin}</strong>
          </span>
        </div>
      </div>

      {/* Selector de Modo de Período y Filtros (Siempre Visible) */}
      <div className="bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-3">
          <h3 className="text-xs font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
            <Calendar className="text-amber-500" size={16} /> Configuración de Período y Rango de Fechas
          </h3>
          {/* Botones Selector de Modo */}
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl gap-1">
            <button
              onClick={() => handlePeriodoModeChange('diario')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodoMode === 'diario'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🎯 Diario (Hoy)
            </button>
            <button
              onClick={() => handlePeriodoModeChange('quincena')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodoMode === 'quincena'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              🗓️ Quincena Actual
            </button>
            <button
              onClick={() => handlePeriodoModeChange('personalizado')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                periodoMode === 'personalizado'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              📅 Rango Personalizado
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs items-end">
          {periodoMode === 'diario' && (
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha / Día *</label>
              <input
                type="date"
                value={periodo.fecha_inicio}
                onChange={e => {
                  const val = e.target.value;
                  setPeriodo(prev => ({ ...prev, fecha_inicio: val, fecha_fin: val }));
                }}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-bold"
              />
            </div>
          )}

          {periodoMode === 'quincena' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Período Quincenal *</label>
                <select
                  value={quincenaNum}
                  onChange={e => {
                    const num = Number(e.target.value) as 1 | 2;
                    setQuincenaNum(num);
                    updateQuincenaDates(num, quincenaMonth);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-bold text-xs"
                >
                  <option value={1}>1ª Quincena (1 - 15)</option>
                  <option value={2}>2ª Quincena (16 - 30/31)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Mes y Año *</label>
                <input
                  type="month"
                  value={quincenaMonth}
                  onChange={e => {
                    const m = e.target.value;
                    setQuincenaMonth(m);
                    updateQuincenaDates(quincenaNum, m);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-bold text-xs"
                />
              </div>
            </>
          )}

          {periodoMode === 'personalizado' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha Inicio *</label>
                <input
                  type="date"
                  value={periodo.fecha_inicio}
                  onChange={e => setPeriodo(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fecha Fin *</label>
                <input
                  type="date"
                  value={periodo.fecha_fin}
                  onChange={e => setPeriodo(prev => ({ ...prev, fecha_fin: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-bold"
                />
              </div>
            </>
          )}
          {subTab === 'general' ? (
            <>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bolsa Propinas ($)</label>
                <input
                  type="number"
                  value={periodo.monto_propinas}
                  onChange={e => setPeriodo({ ...periodo, monto_propinas: parseInputNumber(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Pago Horas Extra</label>
                <select
                  value={modalidadHorasExtra}
                  onChange={e => setModalidadHorasExtra(e.target.value as 'lft' | 'proporcional' | 'ninguna')}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-bold text-xs"
                >
                  <option value="lft">Conforme LFT (Dobles / Triples)</option>
                  <option value="proporcional">Proporcional Directo (Hora Sencilla = Sueldo ÷ 8)</option>
                  <option value="ninguna">🚫 No contar Horas Extra (Solo Salario Regular)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">📅 Día de Hoy</label>
                <select
                  value={incluirHoyEnFaltas ? 'si' : 'no'}
                  onChange={e => setIncluirHoyEnFaltas(e.target.value === 'si')}
                  className="w-full px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-bold text-xs"
                >
                  <option value="no">Excluir HOY de Faltas (En curso)</option>
                  <option value="si">Contabilizar HOY como Falta</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bolsa Propinas Período ($)</label>
              <input
                type="number"
                value={montoPropinasDiarias}
                onChange={e => setMontoPropinasDiarias(parseInputNumber(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-emerald-600 dark:text-emerald-400 font-bold"
              />
            </div>
          )}

          {subTab === 'horas_extras' ? (
            <div className="flex items-end col-span-5 md:col-span-5 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 mt-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={handleCalcular}
                disabled={calculando}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 h-10 shadow-sm"
              >
                {calculando ? <><RefreshCw size={15} className="animate-spin" /> Actualizando...</> : <><Clock size={15} /> Generar / Actualizar Reporte HE</>}
              </button>
              <button
                onClick={exportToCsvHorasExtras}
                title="Exportar Reporte de Horas Extras a Excel (.csv)"
                className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition-colors flex items-center gap-2 text-xs h-10 shadow-sm whitespace-nowrap"
              >
                <Download size={15} /> Exportar Excel (.csv)
              </button>
              <button
                onClick={exportToPdfPrintHorasExtras}
                title="Imprimir / Exportar Reporte de Horas Extras en PDF"
                className="px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl transition-colors flex items-center gap-2 text-xs h-10 shadow-sm whitespace-nowrap"
              >
                <Printer size={15} /> Imprimir Reporte PDF
              </button>
            </div>
          ) : subTab === 'general' ? (
            <div className="flex items-end col-span-5 md:col-span-5 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 mt-2">
              <button
                onClick={handleCalcular}
                disabled={calculando}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2 h-10 shadow-sm"
              >
                {calculando ? <><RefreshCw size={15} className="animate-spin" /> Calculando...</> : <><DollarSign size={15} /> Calcular Nómina</>}
              </button>
              <button
                onClick={exportToCsv}
                title="Exportar a Excel (CSV)"
                className="px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl transition-colors flex items-center gap-2 text-xs h-10 shadow-sm"
              >
                <Download size={15} /> Exportar Excel (.csv)
              </button>
              <button
                onClick={exportToPdfPrint}
                title="Imprimir o Guardar Reporte PDF"
                className="px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl transition-colors flex items-center gap-2 text-xs h-10 shadow-sm"
              >
                <Printer size={15} /> Exportar PDF
              </button>
              <button onClick={() => window.location.reload()} className="px-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-2 rounded-xl transition-colors text-xs h-10">
                Limpiar
              </button>
            </div>
          ) : (
            <div className="flex items-end col-span-2">
              <p className="text-[10px] text-gray-400 italic">
                * Los días futuros posteriores a hoy ({todayLocalStr}) son excluidos automáticamente de las faltas y sanciones.
              </p>
            </div>
          )}
        </div>
      </div>

      {subTab === 'general' ? (
        <>
          {resultados.length > 0 && (
            <>
              {/* Totales del periodo */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Sueldos</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">${totalOrdinario.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Horas Extra</p>
                  <p className="text-lg font-bold text-amber-600">${totalExtras.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Propinas</p>
                  <p className="text-lg font-bold text-emerald-600">${totalPropinas.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">ISR</p>
                  <p className="text-lg font-bold text-rose-600">-${totalIsr.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">IMSS</p>
                  <p className="text-lg font-bold text-rose-500">-${totalImss.toFixed(2)}</p>
                </div>
                <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Neto a Pagar</p>
                  <p className="text-lg font-bold text-emerald-600">${totalNeto.toFixed(2)}</p>
                </div>
              </div>

              {/* Tabla detallada */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                    <CheckCircle className="text-emerald-500" size={18} /> Nómina LFT — Detalle por Empleado
                  </h3>
                  <span className="text-[10px] text-gray-400">Ley Federal del Trabajo · LISR Art. 96 · LSS</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px] whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-100/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold">
                        <th className="p-2">Empleado</th>
                        <th className="p-2">Puesto</th>
                        <th className="p-2 text-right">Salario Mensual</th>
                        <th className="p-2 text-right">Sueldo Diario</th>
                        <th className="p-2 text-center">Días</th>
                        <th className="p-2 text-right">Ordinario</th>
                        <th className="p-2 text-right">H.Extra</th>
                        <th className="p-2 text-right">Dominical</th>
                        <th className="p-2 text-right">Vacaciones</th>
                        <th className="p-2 text-right">Propina</th>
                        <th className="p-2 text-right">ISR</th>
                        <th className="p-2 text-right">IMSS</th>
                        <th className="p-2 text-right">Neto</th>
                        <th className="p-2 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {resultados.map((r, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-2 font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <span>{r.nombre}</span>
                            {r.exentoReloj && (
                              <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-[9px] font-bold border border-blue-500/20">
                                Sueldo Fijo
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-gray-500">{r.puesto}</td>
                          <td className="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400">${(r.sueldoMensual || Math.round((r.sueldoDiario || 0) * 30)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-2 text-right text-gray-500 font-mono">${(r.sueldoDiario || 0).toFixed(2)}</td>
                          <td className="p-2 text-center font-mono font-bold text-gray-700 dark:text-gray-300">{r.diasTrabajados}</td>
                          <td className="p-2 text-right text-gray-700 dark:text-gray-300">${r.percepciones.sueldoOrdinario.toFixed(2)}</td>
                          <td className="p-2 text-right text-amber-600">${(r.percepciones.horasExtraDobles + r.percepciones.horasExtraTriples).toFixed(2)}</td>
                          <td className="p-2 text-right text-blue-600">${r.percepciones.primaDominical.toFixed(2)}</td>
                          <td className="p-2 text-right text-purple-600">${r.percepciones.primaVacacional.toFixed(2)}</td>
                          <td className="p-2 text-right text-emerald-600 font-semibold">${r.percepciones.propina.toFixed(2)}</td>
                          <td className="p-2 text-right text-rose-600">{r.deducciones.isr > 0 ? `-$${r.deducciones.isr.toFixed(2)}` : '$0.00'}</td>
                          <td className="p-2 text-right text-rose-500">{r.deducciones.imssObrero > 0 ? `-$${r.deducciones.imssObrero.toFixed(2)}` : '$0.00'}</td>
                          <td className="p-2 text-right text-gray-900 dark:text-white font-extrabold">${r.neto.toFixed(2)}</td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => setSelectedEmpDetail(r)}
                              className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded font-bold text-[10px] transition-colors flex items-center gap-1 mx-auto"
                            >
                              <Eye size={12} /> Detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-900 font-bold border-t-2 border-gray-300 dark:border-gray-700">
                        <td className="p-2 text-gray-900 dark:text-white" colSpan={5}>Totales</td>
                        <td className="p-2 text-right">${totalOrdinario.toFixed(2)}</td>
                        <td className="p-2 text-right text-amber-600">${totalExtras.toFixed(2)}</td>
                        <td className="p-2 text-right text-blue-600">${resultados.reduce((s, r) => s + (r.percepciones?.primaDominical || 0), 0).toFixed(2)}</td>
                        <td className="p-2 text-right text-purple-600">${resultados.reduce((s, r) => s + (r.percepciones?.primaVacacional || 0), 0).toFixed(2)}</td>
                        <td className="p-2 text-right text-emerald-600">${totalPropinas.toFixed(2)}</td>
                        <td className="p-2 text-right text-rose-600">-${totalIsr.toFixed(2)}</td>
                        <td className="p-2 text-right text-rose-500">-${totalImss.toFixed(2)}</td>
                        <td className="p-2 text-right text-emerald-600">${totalNeto.toFixed(2)}</td>
                        <td className="p-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex gap-4 text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                  <span className="flex items-center gap-1"><Info size={12} /> ISR calculado con tablas LISR mensuales</span>
                  <span>IMSS obrero sobre SBC excedente de 3 UMAs</span>
                  <span>Prima vacacional 25% proporcional</span>
                  <span>Propinas distribuidas proporcional a sueldo</span>
                </div>
              </div>
            </>
          )}
        </>
      ) : subTab === 'propinas_diarias' ? (
        <div className="space-y-6">
          {/* Panel de Configuración de Parámetros */}
          <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                {/* SUBMÓDULO: PROPINA DIARIA REPARTIBLE CON PARÁMETROS CONFIGURABLES */}
                <Settings className="text-amber-500" size={18} /> Reglas Modificables de Reparto de Propina
              </h3>
              <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded font-bold">
                Cálculo Diario Automático
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Opción 1: Descontar Faltas */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
                <label className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={descontarFaltas}
                    onChange={e => setDescontarFaltas(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span>Sanción por Falta / Inasistencia</span>
                </label>
                <p className="text-[10px] text-gray-400">
                  Si un empleado falta ese día, pierde automáticamente el derecho a la propina diaria.
                </p>
              </div>

              {/* Opción 2: Descontar Retardos */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
                <label className="flex items-center gap-2 font-bold text-gray-800 dark:text-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={descontarRetardos}
                    onChange={e => setDescontarRetardos(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span>Sanción por Llegada Tarde</span>
                </label>
                <p className="text-[10px] text-gray-400">
                  Si llega tarde superando la tolerancia, no tiene derecho a la propina de ese día.
                </p>
              </div>

              {/* Opción 3: Tolerancia en Minutos */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">
                  Tolerancia de Retardo (Minutos)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={toleranciaMinutos}
                    onChange={e => setToleranciaMinutos(Math.max(0, parseInputNumber(e.target.value)))}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 font-bold text-xs text-gray-900 dark:text-white"
                  />
                  <span className="text-[10px] text-gray-400 font-semibold shrink-0">min</span>
                </div>
                <p className="text-[10px] text-gray-400">
                  {toleranciaMinutos === 0
                    ? '⚡ Si llega 1 min tarde, pierde la propina inmediatamente.'
                    : `Permite hasta ${toleranciaMinutos} min de margen antes de retirar la propina.`}
                </p>
              </div>

              {/* Opción 4: Criterio de Reparto & Bolsa */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">
                  Criterio de Reparto Diario
                </label>
                <select
                  value={criterioReparto}
                  onChange={e => setCriterioReparto(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-xs font-semibold text-gray-900 dark:text-white"
                >
                  <option value="puntos">Puntos por Puesto (Matriz)</option>
                  <option value="igualitario">Reparto Igualitario (Partes Iguales)</option>
                  <option value="horas">Proporcional a Horas Trabajadas</option>
                </select>
                <div className="pt-1">
                  <label className="block text-[9px] font-bold text-gray-400 uppercase">Bolsa del Período ($ MXN)</label>
                  <input
                    type="number"
                    value={montoPropinasDiarias}
                    onChange={e => setMontoPropinasDiarias(parseInputNumber(e.target.value))}
                    className="w-full px-2 py-1 rounded bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tarjetas de Resumen KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                <DollarSign size={12} className="text-emerald-500" /> Bolsa Total a Repartir
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">${montoPropinasDiarias.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">${(montoPropinasDiarias / (propinasDiariasCalc.elapsedDaysCount || 1)).toFixed(2)} por día transcurrido</p>
            </div>

            <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                <Calendar size={12} className="text-amber-500" /> Días Transcurridos
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{propinasDiariasCalc.elapsedDaysCount} / {propinasDiariasCalc.dateList.length} Días</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{periodo.fecha_inicio} al {periodo.fecha_fin}</p>
            </div>

            <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                <AlertTriangle size={12} className="text-rose-500" /> Sanciones Aplicadas
              </p>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">{propinasDiariasCalc.totalPenalties}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Días-Empleado sin propina por falta/retardo</p>
            </div>

            <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
                <Award size={12} className="text-blue-500" /> Propina Asignada
              </p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">${propinasDiariasCalc.totalTipsAssigned.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">Repartida a personal elegible</p>
            </div>
          </div>

          {/* Tabla de Reparto Diario de Propinas */}
          <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                  <Award className="text-amber-500" size={18} /> Tabla de Reparto de Propinas por Empleado
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Calculado día a día solo para días transcurridos hasta hoy ({todayLocalStr}).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-100/60 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-semibold">
                    <th className="p-3">Empleado</th>
                    <th className="p-3">Puesto</th>
                    <th className="p-3 text-center">Puntos</th>
                    <th className="p-3 text-center">Días Elegibles</th>
                    <th className="p-3 text-center">Sanciones</th>
                    <th className="p-3 text-right">% Participación</th>
                    <th className="p-3 text-right">Propina Asignada</th>
                    <th className="p-3 text-right">Bitácora Diario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                  {propinasDiariasCalc.empTotals.map(row => {
                    const pct = propinasDiariasCalc.totalTipsAssigned > 0
                      ? ((row.propinaTotal / propinasDiariasCalc.totalTipsAssigned) * 100).toFixed(1)
                      : '0.0';

                    return (
                      <tr key={row.empleado.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                        <td className="p-3 font-semibold text-gray-900 dark:text-white">{row.empleado.nombre_completo}</td>
                        <td className="p-3 text-gray-500">{row.puesto}</td>
                        <td className="p-3 text-center font-mono font-bold text-amber-600">{row.puntosPuesto} pts</td>
                        <td className="p-3 text-center font-bold text-emerald-600">{row.diasElegibles} días</td>
                        <td className="p-3 text-center">
                          {row.diasPenalizados > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                              {row.diasPenalizados} sin propina
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-medium">Sin sanciones</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-400">{pct}%</td>
                        <td className="p-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                          ${row.propinaTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedEmpDetail(row)}
                            className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 rounded font-semibold text-[10px] transition-colors inline-flex items-center gap-1"
                          >
                            Ver Días <ChevronRight size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {propinasDiariasCalc.empTotals.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-400 italic">No hay empleados activos para el reparto</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-900 font-bold border-t-2 border-gray-300 dark:border-gray-700">
                    <td colSpan={6} className="p-3 text-gray-900 dark:text-white">Total Propina Distribuida</td>
                    <td className="p-3 text-right text-emerald-600 text-sm font-extrabold">
                      ${propinasDiariasCalc.totalTipsAssigned.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Modal / Bitácora Diaria del Empleado */}
          {selectedEmpDetail && selectedEmpDetail.dailyDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Award className="text-amber-500" size={18} /> Desglose Diario de Propina
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedEmpDetail.empleado.nombre_completo} ({selectedEmpDetail.puesto})</p>
                  </div>
                  <button onClick={() => setSelectedEmpDetail(null)} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5 overflow-y-auto space-y-3 flex-1">
                  <div className="grid grid-cols-3 gap-3 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-center text-xs border border-gray-100 dark:border-gray-800">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Días Elegibles</p>
                      <p className="text-sm font-bold text-emerald-600">{selectedEmpDetail.diasElegibles} días</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Sanciones</p>
                      <p className="text-sm font-bold text-rose-500">{selectedEmpDetail.diasPenalizados} días</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">Total Acumulado</p>
                      <p className="text-sm font-bold text-amber-600">${selectedEmpDetail.propinaTotal.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="divide-y divide-gray-100 dark:divide-gray-800/40">
                    {selectedEmpDetail.dailyDetails.map((day: any, idx: number) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-gray-900 dark:text-white block">{day.date}</span>
                          <span className="text-[10px] text-gray-400">Entrada: {day.checkInTime}</span>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            day.isFuture
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                              : day.eligible
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : day.reason.includes('Sin propina')
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                          }`}>
                            {day.isFuture ? `⚪ ${day.reason}` : day.eligible ? `✅ Elegible ($${day.share.toFixed(2)})` : `❌ ${day.reason}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                  <button onClick={() => setSelectedEmpDetail(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl transition-colors">
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* VISTA DE REPORTE DE HORAS EXTRAS (PAGO EN HORAS SIMPLES) */}
          {/* Tarjetas KPI de Horas Extras */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Plantilla Evaluada</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{resultados.length} Empleados</p>
            </div>
            <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <p className="text-[10px] text-amber-500 uppercase font-bold">Con Horas Extras</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {resultados.filter(r => ((r.horasDobles || 0) + (r.horasTriples || 0)) > 0).length} Empleados
              </p>
            </div>
            <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Total Horas Extras</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                {resultados.reduce((s, r) => s + (r.horasDobles || 0) + (r.horasTriples || 0), 0).toFixed(1)} hrs
              </p>
            </div>
            <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 shadow-sm">
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Pago Total a Horas Simples</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                ${resultados.reduce((s, r) => s + (((r.horasDobles || 0) + (r.horasTriples || 0)) * (r.sueldoDiario / 8)), 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 shadow-sm">
              <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">Ref. Pago Doble/Triple (LFT)</p>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400">
                ${resultados.reduce((s, r) => s + (r.percepciones?.horasExtraDobles || 0) + (r.percepciones?.horasExtraTriples || 0), 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Filtro y Buscador */}
          <div className="bg-white dark:bg-gray-950 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Buscar por empleado o puesto..."
                value={searchHorasExtra}
                onChange={e => setSearchHorasExtra(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 font-medium text-gray-900 dark:text-white"
              />
              <Info size={14} className="absolute left-3 top-3 text-gray-400" />
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 cursor-pointer shrink-0 bg-gray-50 dark:bg-gray-900 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800">
              <input
                type="checkbox"
                checked={filtroSoloConExtras}
                onChange={e => setFiltroSoloConExtras(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Mostrar solo con Horas Extras (&gt; 0 hrs)</span>
            </label>
          </div>

          {/* Tabla de Horas Extras */}
          <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden space-y-4 p-5">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
                  <Clock className="text-amber-500" size={18} /> Reporte de Horas Extras Evaluadas en Hora Simple (Sueldo ÷ 8)
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Desglose de horas trabajadas en el período ({periodo.fecha_inicio} a {periodo.fecha_fin}), horas promedio por semana y su equivalente pagado a cuota por hora simple.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3">Empleado / Puesto</th>
                    <th className="p-3 text-right">Sueldo Diario</th>
                    <th className="p-3 text-right">Valor Hora Simple</th>
                    <th className="p-3 text-center">Horas Trab. Periodo</th>
                    <th className="p-3 text-center">Prom. Hrs / Semana</th>
                    <th className="p-3 text-center">Horas Extras</th>
                    <th className="p-3 text-right">Pago Horas Simples</th>
                    <th className="p-3 text-right">Ref. Pago LFT</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {resultados
                    .filter(r => {
                      const q = searchHorasExtra.toLowerCase();
                      const matchSearch = !q || (r.nombre || '').toLowerCase().includes(q) || (r.puesto || '').toLowerCase().includes(q);
                      const totalHE = (r.horasDobles || 0) + (r.horasTriples || 0);
                      const matchExtras = !filtroSoloConExtras || totalHE > 0;
                      return matchSearch && matchExtras;
                    })
                    .map(r => {
                      const horaSimple = r.sueldoDiario / 8;
                      const totalHE = (r.horasDobles || 0) + (r.horasTriples || 0);
                      const pagoSimples = totalHE * horaSimple;
                      const pagoLft = (r.percepciones?.horasExtraDobles || 0) + (r.percepciones?.horasExtraTriples || 0);
                      const horasTotales = r.totalHorasTrabajadas || (r.diasTrabajados * 8);
                      const diasPeriodo = r.diasTotalesPeriodo || 7;
                      const horasSemanales = (horasTotales / diasPeriodo) * 7;

                      return (
                        <tr key={r.empleado_id} className={`hover:bg-amber-500/5 transition-colors ${totalHE > 0 ? 'bg-amber-500/5 font-semibold' : ''}`}>
                          <td className="p-3">
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              {r.nombre}
                              {r.exentoReloj && (
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-extrabold border border-blue-200">Sueldo Fijo</span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400">{r.puesto || 'General'}</div>
                          </td>
                          <td className="p-3 text-right font-mono text-gray-700 dark:text-gray-300 font-bold">
                            ${r.sueldoDiario.toFixed(2)}
                          </td>
                          <td className="p-3 text-right font-mono text-gray-500 dark:text-gray-400">
                            ${horaSimple.toFixed(2)}/h
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-gray-900 dark:text-white">
                            {horasTotales.toFixed(1)} hrs
                          </td>
                          <td className="p-3 text-center font-mono font-bold">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                              horasSemanales > 48
                                ? 'bg-amber-100 dark:bg-amber-955/30 text-amber-700 dark:text-amber-400 border border-amber-200'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}>
                              {horasSemanales.toFixed(1)} hrs/sem
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold">
                            <span className={`px-2.5 py-1 rounded-xl text-xs font-black ${
                              totalHE > 0
                                ? 'bg-amber-500 text-white shadow-xs'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                            }`}>
                              {totalHE.toFixed(1)} hrs
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                            ${pagoSimples.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">
                            ${pagoLft.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedEmpHorasExtraModal(r)}
                              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg font-bold text-[10px] transition-colors inline-flex items-center gap-1 border border-amber-500/20"
                            >
                              <Eye size={12} /> Ver Días
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {resultados.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                        No hay cálculos generados. Haz clic en <strong>"Generar / Actualizar Reporte HE"</strong> para procesar las checadas del período.
                      </td>
                    </tr>
                  )}
                </tbody>
                {resultados.length > 0 && (
                  <tfoot>
                    <tr className="bg-amber-500/10 font-bold border-t-2 border-amber-500/30">
                      <td colSpan={5} className="p-3 text-amber-900 dark:text-amber-100 font-black">
                        TOTALES REPORTE HORAS EXTRAS
                      </td>
                      <td className="p-3 text-center font-mono font-black text-amber-700 dark:text-amber-300 text-sm">
                        {resultados.reduce((s, r) => s + (r.horasDobles || 0) + (r.horasTriples || 0), 0).toFixed(1)} hrs
                      </td>
                      <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        ${resultados.reduce((s, r) => s + (((r.horasDobles || 0) + (r.horasTriples || 0)) * (r.sueldoDiario / 8)), 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        ${resultados.reduce((s, r) => s + (r.percepciones?.horasExtraDobles || 0) + (r.percepciones?.horasExtraTriples || 0), 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLE DEL EMPLEADO Y JUSTIFICACIONES EN NÓMINA GENERAL */}
      {selectedEmpDetail && selectedEmpDetail.percepciones && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-950 w-full max-w-4xl rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">{selectedEmpDetail.nombre}</h3>
                  {selectedEmpDetail.exentoReloj && (
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded text-xs font-bold border border-blue-500/20">
                      Sueldo Fijo
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 font-semibold">{selectedEmpDetail.puesto} · Período del {periodo.fecha_inicio} al {periodo.fecha_fin}</p>
              </div>
              <button onClick={() => setSelectedEmpDetail(null)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Tarjetas Metricas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Salario Mensual</span>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400">${(selectedEmpDetail.sueldoMensual || Math.round((selectedEmpDetail.sueldoDiario || 0) * 30)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  <span className="text-[10px] text-gray-400">${(selectedEmpDetail.sueldoDiario || 0).toFixed(2)}/día</span>
                </div>
                <div className="p-3.5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Días Pagados</span>
                  <p className="text-base font-black text-gray-900 dark:text-white">{selectedEmpDetail.diasTrabajados || 0} / {selectedEmpDetail.diasTotalesPeriodo || 15} días</p>
                  <span className="text-[10px] text-emerald-600 font-bold">Base 15 días LFT</span>
                </div>
                <div className="p-3.5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Faltas No Justificadas</span>
                  <p className={`text-base font-black ${selectedEmpDetail.faltasNoJustificadas > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {selectedEmpDetail.faltasNoJustificadas || 0} faltas
                  </p>
                  <span className="text-[10px] text-gray-400">Descontadas en período</span>
                </div>
                <div className="p-3.5 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Horas Extra / Retardos</span>
                  <p className="text-base font-black text-amber-600 font-mono">
                    {(selectedEmpDetail.horasDobles || 0) + (selectedEmpDetail.horasTriples || 0)}h extra
                  </p>
                  <span className="text-[10px] text-gray-400">{selectedEmpDetail.retardosMinutos || 0} mins retardo</span>
                </div>
              </div>

              {/* Desglose Día por Día con opción de Justificar */}
              {selectedEmpDetail.detallesDias && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Calendar size={14} className="text-amber-500" /> Detalle Diario del Período
                    </h4>
                    <span className="text-[10px] text-gray-400">Presiona "Justificar" en cualquier día para autorizar permiso o quitar falta</span>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-100/60 dark:bg-gray-900/60 text-gray-500 font-bold border-b border-gray-200 dark:border-gray-800">
                          <th className="p-2.5">Fecha</th>
                          <th className="p-2.5">Día</th>
                          <th className="p-2.5">Estatus</th>
                          <th className="p-2.5">Checadas Biométricas</th>
                          <th className="p-2.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40 text-xs">
                        {selectedEmpDetail.detallesDias.map((d: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                            <td className="p-2.5 font-bold text-gray-800 dark:text-gray-200 font-mono">{d.fecha}</td>
                            <td className="p-2.5 capitalize text-gray-600 dark:text-gray-400">{d.diaSemana}</td>
                            <td className="p-2.5">
                              {d.estado === 'asistencia' && <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-[10px] font-bold">✅ Asistencia</span>}
                              {d.estado === 'descanso' && <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded text-[10px] font-bold">🏖️ Descanso (Pagado LFT)</span>}
                              {d.estado === 'exento' && <span className="px-2 py-0.5 bg-purple-500/10 text-purple-600 rounded text-[10px] font-bold">⭐ Sueldo Fijo</span>}
                              {d.estado === 'justificado' && <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[10px] font-bold">📋 {d.incidenciaNombre || 'Justificado'}</span>}
                              {d.estado === 'falta' && <span className="px-2 py-0.5 bg-rose-500/10 text-rose-600 rounded text-[10px] font-bold">❌ Falta No Justificada</span>}
                              {d.estado === 'futuro' && <span className="px-2 py-0.5 bg-gray-100 text-gray-400 rounded text-[10px]">⚪ Fecha Futura</span>}
                            </td>
                            <td className="p-2.5 text-gray-500 font-mono text-[11px]">
                              {d.entradas && d.entradas.length > 0 ? d.entradas.join(' - ') : '-'}
                            </td>
                            <td className="p-2.5 text-right">
                              {d.estado === 'falta' && (
                                <button
                                  onClick={() => setJustificarDate(d.fecha)}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold transition-colors shadow-sm"
                                >
                                  Justificar Día
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Percepciones vs Deducciones */}
              {selectedEmpDetail.percepciones && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/20 space-y-2">
                    <h5 className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase">Percepciones (+)</h5>
                    <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                      <div className="flex justify-between"><span>Sueldo Ordinario ({selectedEmpDetail.diasTrabajados} días):</span><span className="font-bold">${selectedEmpDetail.percepciones.sueldoOrdinario.toFixed(2)}</span></div>
                      {(selectedEmpDetail.percepciones.horasExtraDobles + selectedEmpDetail.percepciones.horasExtraTriples) > 0 && (
                        <div className="flex justify-between"><span>Horas Extra:</span><span className="font-bold">${(selectedEmpDetail.percepciones.horasExtraDobles + selectedEmpDetail.percepciones.horasExtraTriples).toFixed(2)}</span></div>
                      )}
                      {selectedEmpDetail.percepciones.primaDominical > 0 && (
                        <div className="flex justify-between"><span>Prima Dominical:</span><span className="font-bold">${selectedEmpDetail.percepciones.primaDominical.toFixed(2)}</span></div>
                      )}
                      {selectedEmpDetail.percepciones.primaVacacional > 0 && (
                        <div className="flex justify-between"><span>Prima Vacacional:</span><span className="font-bold">${selectedEmpDetail.percepciones.primaVacacional.toFixed(2)}</span></div>
                      )}
                      {selectedEmpDetail.percepciones.aguinaldo > 0 && (
                        <div className="flex justify-between"><span>Aguinaldo:</span><span className="font-bold">${selectedEmpDetail.percepciones.aguinaldo.toFixed(2)}</span></div>
                      )}
                      {(selectedEmpDetail.percepciones.propina || selectedEmpDetail.propinaAsignada || 0) > 0 && (
                        <div className="flex justify-between"><span>Propina:</span><span className="font-bold">${(selectedEmpDetail.percepciones.propina || selectedEmpDetail.propinaAsignada || 0).toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-emerald-500/20 font-black text-emerald-700 dark:text-emerald-300"><span>Total Percepciones:</span><span>${selectedEmpDetail.percepciones.total.toFixed(2)}</span></div>
                    </div>
                  </div>

                  <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/20 space-y-2">
                    <h5 className="text-xs font-black text-rose-700 dark:text-rose-300 uppercase">Deducciones (-)</h5>
                    <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
                      <div className="flex justify-between"><span>ISR (Art. 96 LISR):</span><span className="font-bold">-${selectedEmpDetail.deducciones.isr.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>IMSS Obrero:</span><span className="font-bold">-${selectedEmpDetail.deducciones.imssObrero.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span>Descuento Retardos:</span><span className="font-bold">-${(selectedEmpDetail.deducciones.descuentoRetardos || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between pt-2 border-t border-rose-500/20 font-black text-rose-700 dark:text-rose-300"><span>Total Deducciones:</span><span>-${selectedEmpDetail.deducciones.total.toFixed(2)}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Neto a Recibir</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">${(selectedEmpDetail.neto || 0).toFixed(2)}</span>
              </div>
              <button onClick={() => setSelectedEmpDetail(null)} className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-xl transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MINI PARA JUSTIFICAR DÍA */}
      {justificarDate && selectedEmpDetail && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-950 w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 pb-3">
              <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase flex items-center gap-2">
                <ShieldCheck className="text-amber-500" size={18} /> Justificar Día ({justificarDate})
              </h4>
              <button onClick={() => setJustificarDate(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleGuardarJustificacion} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Empleado</label>
                <input type="text" disabled value={selectedEmpDetail.nombre} className="w-full p-2 bg-gray-100 dark:bg-gray-900 rounded-lg font-bold text-gray-700 dark:text-gray-300" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo de Incidencia / Justificación *</label>
                <select
                  value={justificarForm.tipo}
                  onChange={e => setJustificarForm({ ...justificarForm, tipo: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl font-bold"
                >
                  <option value="falta_justificada">Falta Justificada (Sin Descuento)</option>
                  <option value="permiso">Permiso con Goce de Sueldo</option>
                  <option value="incapacidad">Incapacidad Médica</option>
                  <option value="vacaciones">Día de Vacaciones</option>
                  <option value="retardo_justificado">Retardo Justificado</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Motivo / Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Ej. Permiso médico o trámite administrativo justificado por gerencia"
                  value={justificarForm.motivo}
                  onChange={e => setJustificarForm({ ...justificarForm, motivo: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={guardandoIncidencia}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white font-bold py-2.5 rounded-xl transition-colors"
                >
                  {guardandoIncidencia ? 'Guardando...' : 'Aplicar Justificación'}
                </button>
                <button type="button" onClick={() => setJustificarDate(null)} className="px-4 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DESGLOSE DIARIO DE HORAS EXTRAS */}
      {selectedEmpHorasExtraModal && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-950 w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900 shrink-0">
              <div>
                <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase flex items-center gap-2">
                  <Clock className="text-amber-500" size={18} /> Desglose de Horas Extras: {selectedEmpHorasExtraModal.nombre}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                  {selectedEmpHorasExtraModal.puesto} · Sueldo Diario: <strong className="text-gray-900 dark:text-white">${selectedEmpHorasExtraModal.sueldoDiario?.toFixed(2)}</strong> · Valor Hora Simple: <strong className="text-emerald-600 dark:text-emerald-400">${(selectedEmpHorasExtraModal.sueldoDiario / 8).toFixed(2)}/h</strong>
                </p>
              </div>
              <button onClick={() => setSelectedEmpHorasExtraModal(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 uppercase text-[10px] font-bold border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Día</th>
                      <th className="p-2.5">Estado / Checadas</th>
                      <th className="p-2.5 text-center">Horas Laboradas</th>
                      <th className="p-2.5 text-center">Horas Extras</th>
                      <th className="p-2.5 text-right">Pago Hora Simple</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(selectedEmpHorasExtraModal.detallesDias || []).map((d: any, idx: number) => {
                      const horaSimple = selectedEmpHorasExtraModal.sueldoDiario / 8;
                      const hrsExtrasDia = d.horasExtra || 0;
                      const pagoDiaSimple = hrsExtrasDia * horaSimple;

                      return (
                        <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-900/50 ${hrsExtrasDia > 0 ? 'bg-amber-500/5 font-bold' : ''}`}>
                          <td className="p-2.5 font-mono text-gray-900 dark:text-white font-bold">{d.fecha}</td>
                          <td className="p-2.5 text-gray-500 capitalize">{d.diaSemana}</td>
                          <td className="p-2.5">
                            {d.entradas && d.entradas.length > 0 ? (
                              <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
                                🕒 {d.entradas.join(' → ')}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400 italic">
                                {d.estado === 'descanso' ? '☀️ Descanso' : d.estado === 'justificado' ? '🛡️ Justificado' : 'Sin checada'}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold">
                            {d.horasTrabajadas ? `${d.horasTrabajadas.toFixed(1)} h` : '-'}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${hrsExtrasDia > 0 ? 'bg-amber-500 text-white font-black' : 'text-gray-400'}`}>
                              {hrsExtrasDia > 0 ? `+${hrsExtrasDia.toFixed(1)} h` : '0.0 h'}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                            ${pagoDiaSimple.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Total Horas Extras / Pago a Horas Simples</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {((selectedEmpHorasExtraModal.horasDobles || 0) + (selectedEmpHorasExtraModal.horasTriples || 0)).toFixed(1)} hrs = ${(((selectedEmpHorasExtraModal.horasDobles || 0) + (selectedEmpHorasExtraModal.horasTriples || 0)) * (selectedEmpHorasExtraModal.sueldoDiario / 8)).toFixed(2)}
                </span>
              </div>
              <button onClick={() => setSelectedEmpHorasExtraModal(null)} className="px-5 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white text-white dark:text-gray-900 text-xs font-bold rounded-xl transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
