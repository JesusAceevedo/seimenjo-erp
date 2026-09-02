'use client';

import React, { useState, useEffect } from 'react';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { obtenerBalanzaComprobacion } from '../actions';
import { formatCurrency } from '../../../../lib/formatters';
import { FileText, Download, Scale, PieChart, RefreshCw } from 'lucide-react';

interface ReportesTabProps {
  selectedMonth: string;
}

export default function ReportesTab({ selectedMonth }: ReportesTabProps) {
  const getSessionToken = useSessionToken();

  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<'balanza' | 'er' | 'balance'>('balanza');
  const [balanzaData, setBalanzaData] = useState<any[]>([]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const token = await getSessionToken();
      const res = await obtenerBalanzaComprobacion(token, selectedMonth);
      if (res.success && res.data) {
        setBalanzaData(res.data);
      }
    } catch (err: any) {
      console.error('Error al cargar reporte:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [selectedMonth]);

  // Totales Balanza
  const totalCargos = balanzaData.reduce((s, c) => s + Number(c.cargos || 0), 0);
  const totalAbonos = balanzaData.reduce((s, c) => s + Number(c.abonos || 0), 0);

  // Cálculos para Estado de Resultados (Ventas - Costos - Gastos)
  const totalIngresos = balanzaData.filter(c => c.tipo === 'ingreso').reduce((s, c) => s + Number(c.abonos - c.cargos), 0);
  const totalCostos = balanzaData.filter(c => c.tipo === 'costo').reduce((s, c) => s + Number(c.cargos - c.abonos), 0);
  const totalGastos = balanzaData.filter(c => c.tipo === 'gasto').reduce((s, c) => s + Number(c.cargos - c.abonos), 0);
  const utilidadNeta = totalIngresos - totalCostos - totalGastos;

  // Exportar XML SAT (Fase 3 API Route)
  const handleExportSatXml = (tipo: 'CT' | 'B' | 'PL') => {
    window.open(`/admin/contabilidad/export?tipo=${tipo}&periodo=${selectedMonth}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-6 font-sans">
      {/* HEADER & REPORT NAVIGATION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-gray-200 dark:border-gray-800 pb-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveReport('balanza')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeReport === 'balanza'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            Balanza de Comprobación
          </button>
          <button
            onClick={() => setActiveReport('er')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeReport === 'er'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            Estado de Resultados
          </button>

        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExportSatXml('B')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md"
            title="Exportar Balanza XML para Anexo 20 SAT"
          >
            <Download size={14} /> XML Balanza SAT
          </button>
          <button
            onClick={() => handleExportSatXml('CT')}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md"
            title="Exportar Catálogo XML para Anexo 20 SAT"
          >
            <Download size={14} /> XML Catálogo SAT
          </button>
        </div>
      </div>

      {/* REPORT CONTENTS */}
      <div className="flex-1 overflow-y-auto pr-2">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Generando reporte contable...</div>
        ) : activeReport === 'balanza' ? (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Código CUC</th>
                  <th className="p-3.5">Nombre de la Cuenta</th>
                  <th className="p-3.5">Naturaleza</th>
                  <th className="p-3.5 text-right">Saldo Inicial</th>
                  <th className="p-3.5 text-right">Cargos (Debe)</th>
                  <th className="p-3.5 text-right">Abonos (Haber)</th>
                  <th className="p-3.5 text-right">Saldo Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {balanzaData.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">{row.codigo}</td>
                    <td className="p-3 font-bold text-gray-900 dark:text-white">{row.nombre}</td>
                    <td className="p-3 capitalize text-gray-500">{row.naturaleza}</td>
                    <td className="p-3 text-right font-mono text-gray-500">{formatCurrency(row.saldo_inicial)}</td>
                    <td className="p-3 text-right font-mono text-emerald-600 font-bold">{formatCurrency(row.cargos)}</td>
                    <td className="p-3 text-right font-mono text-blue-600 font-bold">{formatCurrency(row.abonos)}</td>
                    <td className="p-3 text-right font-mono font-black text-gray-900 dark:text-white">
                      {formatCurrency(row.saldo_final)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-800 font-bold border-t border-gray-200 dark:border-gray-800 text-xs">
                  <td colSpan={4} className="p-3.5 text-right uppercase">
                    Totales Balanza de Comprobación:
                  </td>
                  <td className="p-3.5 text-right font-mono text-emerald-600 text-sm">{formatCurrency(totalCargos)}</td>
                  <td className="p-3.5 text-right font-mono text-blue-600 text-sm">{formatCurrency(totalAbonos)}</td>
                  <td className="p-3.5 text-right font-mono text-gray-900 dark:text-white text-sm">
                    {formatCurrency(Math.abs(totalCargos - totalAbonos))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          /* ESTADO DE RESULTADOS */
          <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-8 rounded-2xl shadow-lg font-sans">
            <h3 className="text-xl font-black mb-1 text-center text-gray-900 dark:text-white">ESTADO DE RESULTADOS</h3>
            <p className="text-xs text-gray-500 text-center mb-6">Periodo: {selectedMonth}</p>

            <div className="space-y-4 text-xs font-mono">
              <div className="flex justify-between border-b pb-2">
                <span className="font-bold text-gray-700 dark:text-gray-300">INGRESOS POR VENTAS Y SERVICIOS (+)</span>
                <span className="font-bold text-emerald-600">{formatCurrency(totalIngresos)}</span>
              </div>

              <div className="flex justify-between border-b pb-2">
                <span className="font-bold text-gray-700 dark:text-gray-300">COSTO DE VENTAS (-)</span>
                <span className="font-bold text-red-500">{formatCurrency(totalCostos)}</span>
              </div>

              <div className="flex justify-between border-b pb-2 bg-gray-50 dark:bg-gray-800/40 p-2 rounded-lg font-bold">
                <span>UTILIDAD BRUTA</span>
                <span>{formatCurrency(totalIngresos - totalCostos)}</span>
              </div>

              <div className="flex justify-between border-b pb-2">
                <span className="font-bold text-gray-700 dark:text-gray-300">GASTOS GENERALES DE OPERACIÓN (-)</span>
                <span className="font-bold text-red-500">{formatCurrency(totalGastos)}</span>
              </div>

              <div className={`flex justify-between p-4 rounded-xl font-black text-sm border ${
                utilidadNeta >= 0
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400'
                  : 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/30 dark:text-red-400'
              }`}>
                <span>UTILIDAD / PÉRDIDA NETA DEL EJERCICIO</span>
                <span>{formatCurrency(utilidadNeta)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
