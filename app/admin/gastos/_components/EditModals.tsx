'use client';
import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { editarMovimientoBancario } from '../reconciliationActions';

// ── EDITAR GASTO ────────────────────────────────────────────────────────────
export function EditGastoModal({ gasto, categorias, onClose, onSuccess }: any) {
  const [fecha, setFecha] = useState(gasto.fecha_gasto || '');
  const [concepto, setConcepto] = useState(gasto.concepto || '');
  const [monto, setMonto] = useState(gasto.monto || '');
  const [categoriaId, setCategoriaId] = useState(gasto.categoria_id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.from('gastos').update({
        fecha_gasto: fecha,
        concepto,
        monto: parseFloat(monto),
        categoria_id: categoriaId || null
      }).eq('id', gasto.id);
      if (err) throw err;
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Editar Egreso</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Descripción / Concepto</label>
            <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Monto Total</label>
            <input type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Clasificación</label>
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">- Selecciona -</option>
              {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={handleSave} disabled={loading} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold mt-2 disabled:opacity-50">
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EDITAR VENTA (PEDIDO) ───────────────────────────────────────────────────
export function EditVentaModal({ venta, onClose, onSuccess }: any) {
  const [fecha, setFecha] = useState(venta.fecha_pedido ? venta.fecha_pedido.split('T')[0] : '');
  const [clienteNombre, setClienteNombre] = useState(venta.cliente_nombre || venta.clientes?.nombre_local || '');
  const [precioTotal, setPrecioTotal] = useState(venta.precio_total || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.from('pedidos').update({
        fecha_pedido: fecha,
        cliente_nombre: clienteNombre,
        precio_total: parseFloat(precioTotal)
      }).eq('id', venta.id);
      if (err) throw err;
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Editar Ingreso (Venta/Pedido)</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Cliente</label>
            <input type="text" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Monto Total</label>
            <input type="number" step="0.01" value={precioTotal} onChange={e => setPrecioTotal(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={handleSave} disabled={loading} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-bold mt-2 disabled:opacity-50">
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EDITAR MOVIMIENTO BANCARIO ──────────────────────────────────────────────
export function EditMovimientoModal({ movimiento, token, onClose, onSuccess }: any) {
  const [fecha, setFecha] = useState(movimiento.fecha ? movimiento.fecha.split('T')[0] : '');
  const [concepto, setConcepto] = useState(movimiento.concepto || '');
  const [retiro, setRetiro] = useState(movimiento.retiro || 0);
  const [deposito, setDeposito] = useState(movimiento.deposito || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await editarMovimientoBancario(movimiento.id, {
        fecha,
        concepto,
        retiro: parseFloat(String(retiro)) || 0,
        deposito: parseFloat(String(deposito)) || 0
      }, token);
      if (!res.success) throw new Error(res.error);
      onSuccess();
    } catch (e: any) {
      setError(e.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Editar Movimiento Bancario</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 block mb-1">Concepto / Referencia</label>
            <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Retiro (-)</label>
              <input type="number" step="0.01" value={retiro} onChange={e => setRetiro(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 text-red-500 font-mono" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 block mb-1">Depósito (+)</label>
              <input type="number" step="0.01" value={deposito} onChange={e => setDeposito(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 p-2 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 text-emerald-500 font-mono" />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button onClick={handleSave} disabled={loading} className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-bold mt-2 disabled:opacity-50">
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
