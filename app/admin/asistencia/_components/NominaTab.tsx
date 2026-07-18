'use client';

import { useState } from 'react';
import { DollarSign, Sliders, CheckCircle, RefreshCw, Info } from 'lucide-react';
import type { EmpleadoDetalle, Puesto, ChecadaRaw } from '../types';
import { calcularNominaCompleta, saveDiaFestivo, deleteDiaFestivo, loadDiasFestivos } from '../actions';

interface Props {
  empleados: EmpleadoDetalle[];
  puestos: Puesto[];
  checadasRaw: ChecadaRaw[];
  empresaId: string | null;
}

export default function NominaTab({ empleados, puestos, checadasRaw, empresaId }: Props) {
  const [periodo, setPeriodo] = useState({
    fecha_inicio: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    monto_propinas: 0
  });
  const [resultados, setResultados] = useState<any[]>([]);
  const [calculando, setCalculando] = useState(false);

  const handleCalcular = async () => {
    if (!empresaId) return;
    setCalculando(true);
    try {
      const res = await calcularNominaCompleta(
        empresaId, periodo.fecha_inicio, periodo.fecha_fin, periodo.monto_propinas
      );
      setResultados(res);
    } catch (err: any) {
      alert('Error en cálculo: ' + err.message);
    } finally {
      setCalculando(false);
    }
  };

  const totalOrdinario = resultados.reduce((s, r) => s + r.percepciones.sueldoOrdinario, 0);
  const totalExtras = resultados.reduce((s, r) => s + r.percepciones.horasExtraDobles + r.percepciones.horasExtraTriples, 0);
  const totalPropinas = resultados.reduce((s, r) => s + r.percepciones.propina, 0);
  const totalIsr = resultados.reduce((s, r) => s + r.deducciones.isr, 0);
  const totalImss = resultados.reduce((s, r) => s + r.deducciones.imssObrero, 0);
  const totalNeto = resultados.reduce((s, r) => s + r.neto, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-wide flex items-center gap-2">
          <Sliders className="text-amber-500" size={18} /> Parámetros del Período
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs items-end">
          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Inicio *</label>
            <input type="date" value={periodo.fecha_inicio} onChange={e => setPeriodo({ ...periodo, fecha_inicio: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800" /></div>
          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Fin *</label>
            <input type="date" value={periodo.fecha_fin} onChange={e => setPeriodo({ ...periodo, fecha_fin: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800" /></div>
          <div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Bolsa Propinas ($)</label>
            <input type="number" value={periodo.monto_propinas} onChange={e => setPeriodo({ ...periodo, monto_propinas: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800" /></div>
          <div className="flex items-end">
            <button onClick={handleCalcular} disabled={calculando}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2 h-9">
              {calculando ? <><RefreshCw size={14} className="animate-spin" /> Calculando...</> : <><DollarSign size={14} /> Calcular</>}
            </button>
          </div>
          <div className="flex items-end">
            <button onClick={() => window.location.reload()} className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-2 rounded-lg transition-colors text-xs h-9">
              Limpiar
            </button>
          </div>
        </div>
      </div>

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
                    <th className="p-2 text-center">Días</th>
                    <th className="p-2 text-right">Ordinario</th>
                    <th className="p-2 text-right">H.Extra</th>
                    <th className="p-2 text-right">Dominical</th>
                    <th className="p-2 text-right">Vacaciones</th>
                    <th className="p-2 text-right">Propina</th>
                    <th className="p-2 text-right">ISR</th>
                    <th className="p-2 text-right">IMSS</th>
                    <th className="p-2 text-right">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                  {resultados.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                      <td className="p-2 font-semibold text-gray-900 dark:text-white">{r.nombre}</td>
                      <td className="p-2 text-gray-500">{r.puesto}</td>
                      <td className="p-2 text-center font-mono font-bold text-gray-700">{r.diasTrabajados}</td>
                      <td className="p-2 text-right text-gray-700">${r.percepciones.sueldoOrdinario.toFixed(2)}</td>
                      <td className="p-2 text-right text-amber-600">${(r.percepciones.horasExtraDobles + r.percepciones.horasExtraTriples).toFixed(2)}</td>
                      <td className="p-2 text-right text-blue-600">${r.percepciones.primaDominical.toFixed(2)}</td>
                      <td className="p-2 text-right text-purple-600">${r.percepciones.primaVacacional.toFixed(2)}</td>
                      <td className="p-2 text-right text-emerald-600 font-semibold">${r.percepciones.propina.toFixed(2)}</td>
                      <td className="p-2 text-right text-rose-600">-${r.deducciones.isr.toFixed(2)}</td>
                      <td className="p-2 text-right text-rose-500">-${r.deducciones.imssObrero.toFixed(2)}</td>
                      <td className="p-2 text-right text-gray-900 dark:text-white font-extrabold">${r.neto.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-900 font-bold border-t-2 border-gray-300 dark:border-gray-700">
                    <td className="p-2 text-gray-900 dark:text-white" colSpan={3}>Totales</td>
                    <td className="p-2 text-right">${totalOrdinario.toFixed(2)}</td>
                    <td className="p-2 text-right text-amber-600">${totalExtras.toFixed(2)}</td>
                    <td className="p-2 text-right text-blue-600">${resultados.reduce((s, r) => s + r.percepciones.primaDominical, 0).toFixed(2)}</td>
                    <td className="p-2 text-right text-purple-600">${resultados.reduce((s, r) => s + r.percepciones.primaVacacional, 0).toFixed(2)}</td>
                    <td className="p-2 text-right text-emerald-600">${totalPropinas.toFixed(2)}</td>
                    <td className="p-2 text-right text-rose-600">-${totalIsr.toFixed(2)}</td>
                    <td className="p-2 text-right text-rose-500">-${totalImss.toFixed(2)}</td>
                    <td className="p-2 text-right text-emerald-600">${totalNeto.toFixed(2)}</td>
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
    </div>
  );
}
