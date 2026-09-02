'use client';

import React, { useState, useEffect } from 'react';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { guardarAsientoManual, LineaAsientoInput } from '../actions';
import { formatCurrency } from '../../../../lib/formatters';
import { Plus, Trash2, Scale, Save, X } from 'lucide-react';

interface AccountOption {
  id: string;
  codigo: string;
  nombre: string;
}

interface AsientoModalProps {
  cuentas: AccountOption[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AsientoModal({ cuentas, onClose, onSuccess }: AsientoModalProps) {
  const getSessionToken = useSessionToken();

  const [tipo, setTipo] = useState<'ingreso' | 'egreso' | 'traspaso' | 'diario'>('diario');
  const [fecha, setFecha] = useState(new Date().toISOString().substring(0, 10));
  const [concepto, setConcepto] = useState('');
  const [lineas, setLineas] = useState<LineaAsientoInput[]>([
    { cuenta_contable_id: '', cargo: 0, abono: 0, concepto: '' },
    { cuenta_contable_id: '', cargo: 0, abono: 0, concepto: '' }
  ]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const totalCargo = lineas.reduce((s, l) => s + Number(l.cargo || 0), 0);
  const totalAbono = lineas.reduce((s, l) => s + Number(l.abono || 0), 0);
  const diferencia = Math.abs(totalCargo - totalAbono);
  const estaCuadrado = diferencia < 0.01 && totalCargo > 0;

  const handleAddLinea = () => {
    setLineas([...lineas, { cuenta_contable_id: '', cargo: 0, abono: 0, concepto: '' }]);
  };

  const handleRemoveLinea = (index: number) => {
    if (lineas.length <= 2) {
      alert('Un asiento contable requiere al menos 2 líneas de partida doble.');
      return;
    }
    setLineas(lineas.filter((_, i) => i !== index));
  };

  const handleUpdateLinea = (index: number, field: keyof LineaAsientoInput, value: any) => {
    const next = [...lineas];
    if (field === 'cargo' && Number(value) > 0) {
      next[index] = { ...next[index], cargo: Number(value), abono: 0 };
    } else if (field === 'abono' && Number(value) > 0) {
      next[index] = { ...next[index], abono: Number(value), cargo: 0 };
    } else {
      next[index] = { ...next[index], [field]: value };
    }
    setLineas(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!concepto.trim()) {
      setErrorMsg('Ingresa un concepto general para la póliza.');
      return;
    }

    if (!estaCuadrado) {
      setErrorMsg(`La póliza no está cuadrada. Total Cargo: ${formatCurrency(totalCargo)} | Total Abono: ${formatCurrency(totalAbono)}`);
      return;
    }

    // Validar que todas las líneas tengan cuenta asignada
    for (let i = 0; i < lineas.length; i++) {
      if (!lineas[i].cuenta_contable_id) {
        setErrorMsg(`La línea #${i + 1} no tiene cuenta contable seleccionada.`);
        return;
      }
    }

    setSaving(true);
    try {
      const token = await getSessionToken();
      const res = await guardarAsientoManual(
        {
          tipo,
          fecha,
          concepto: concepto.trim(),
          lineas
        },
        token
      );

      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || 'Error al guardar póliza manual.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error inesperado al guardar asiento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh]">
        {/* HEADER */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Scale className="text-blue-500" size={22} /> Póliza de Diario Manual (Ajuste Contable)
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={20} />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pt-4 space-y-4 font-sans pr-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 rounded-xl text-xs font-bold">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">Tipo de Póliza</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value as any)}
                className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800 font-bold"
              >
                <option value="diario">Diario</option>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
                <option value="traspaso">Traspaso</option>
              </select>
            </div>

            <div>
              <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">Fecha de Póliza</label>
              <input
                type="date"
                required
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800"
              />
            </div>

            <div>
              <label className="block font-bold mb-1 text-gray-700 dark:text-gray-300">Concepto General</label>
              <input
                type="text"
                required
                placeholder="Ajuste contable de inventario / cierre..."
                value={concepto}
                onChange={e => setConcepto(e.target.value)}
                className="w-full p-2.5 border rounded-xl bg-gray-50 dark:bg-gray-950 dark:border-gray-800"
              />
            </div>
          </div>

          {/* TABLA DE LÍNEAS PARTIDA DOBLE */}
          <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden mt-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="p-3">Cuenta Contable</th>
                  <th className="p-3">Concepto Línea</th>
                  <th className="p-3 text-right w-32">Cargo (Debe)</th>
                  <th className="p-3 text-right w-32">Abono (Haber)</th>
                  <th className="p-3 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {lineas.map((linea, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="p-2">
                      <select
                        value={linea.cuenta_contable_id}
                        onChange={e => handleUpdateLinea(idx, 'cuenta_contable_id', e.target.value)}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-800"
                      >
                        <option value="">-- Seleccionar Cuenta --</option>
                        {cuentas.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.codigo} - {c.nombre}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Detalle..."
                        value={linea.concepto || ''}
                        onChange={e => handleUpdateLinea(idx, 'concepto', e.target.value)}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-800"
                      />
                    </td>

                    <td className="p-2 text-right font-mono">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={linea.cargo || ''}
                        onChange={e => handleUpdateLinea(idx, 'cargo', e.target.value)}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-800 text-right font-bold text-emerald-600"
                      />
                    </td>

                    <td className="p-2 text-right font-mono">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={linea.abono || ''}
                        onChange={e => handleUpdateLinea(idx, 'abono', e.target.value)}
                        className="w-full p-2 border rounded-lg bg-white dark:bg-gray-950 dark:border-gray-800 text-right font-bold text-blue-600"
                      />
                    </td>

                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLinea(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-850 font-bold border-t border-gray-200 dark:border-gray-800 text-xs">
                  <td colSpan={2} className="p-3 text-right uppercase">
                    Totales Partida Doble:
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-600 text-sm">{formatCurrency(totalCargo)}</td>
                  <td className="p-3 text-right font-mono text-blue-600 text-sm">{formatCurrency(totalAbono)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={handleAddLinea}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200"
            >
              <Plus size={16} /> Agregar Línea
            </button>

            <div className="text-right">
              {estaCuadrado ? (
                <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                  ✓ Partida Doble Cuadrada
                </span>
              ) : (
                <span className="text-red-500 font-bold text-xs">
                  ✕ Descuadre: {formatCurrency(diferencia)}
                </span>
              )}
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-800 font-bold hover:bg-gray-300 text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !estaCuadrado}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md"
            >
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar y Contabilizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
