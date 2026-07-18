'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function TempDeleteJulyPage() {
  const [status, setStatus] = useState<string>('Inicializando...');
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const addLog = (msg: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  useEffect(() => {
    async function runDelete() {
      try {
        addLog('Verificando autenticación...');
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
          setStatus('Error: Debes estar autenticado para realizar esta operación.');
          addLog('Error de autenticación: Por favor inicia sesión en el admin primero.');
          setLoading(false);
          return;
        }

        addLog(`Usuario autenticado: ${user.email}`);

        // Obtener empresaId
        let empresaId = '';
        const sesionGuardada = localStorage.getItem('seimenjo_session');
        if (sesionGuardada) {
          try {
            const datosSesion = JSON.parse(sesionGuardada);
            empresaId = datosSesion.empresa_id;
          } catch (e) {}
        }
        if (!empresaId) {
          empresaId = user.user_metadata?.empresa_id;
        }

        if (!empresaId) {
          setStatus('Error: No se encontró la empresa activa en la sesión.');
          setLoading(false);
          return;
        }

        addLog(`Empresa ID activa: ${empresaId}`);
        addLog('Buscando movimientos bancarios de Julio 2026 a eliminar...');

        // Buscar movimientos de Julio 2026
        const { data: movements, error: fetchErr } = await supabase
          .from('movimientos_bancarios')
          .select('id, concepto, monto, fecha')
          .eq('empresa_id', empresaId)
          .gte('fecha', '2026-07-01')
          .lte('fecha', '2026-07-31');

        if (fetchErr) throw fetchErr;

        const count = movements?.length || 0;
        addLog(`Se encontraron ${count} movimientos en Julio 2026.`);

        if (count === 0) {
          setStatus('Sin acciones: No se encontraron movimientos en Julio 2026 para eliminar.');
          setLoading(false);
          return;
        }

        addLog('Procediendo a eliminar los movimientos (las conciliaciones asociadas se desvincularán automáticamente)...');

        const ids = (movements || []).map(m => m.id);
        
        const { error: delErr } = await supabase
          .from('movimientos_bancarios')
          .delete()
          .in('id', ids);

        if (delErr) throw delErr;

        setStatus(`Éxito: Se eliminaron ${count} movimientos bancarios de Julio 2026.`);
        addLog('Eliminación completada con éxito.');
        setLoading(false);
      } catch (err: any) {
        setStatus(`Error general: ${err.message}`);
        addLog(`Error: ${err.message}`);
        setLoading(false);
      }
    }

    runDelete();
  }, []);

  return (
    <div className="p-8 max-w-2xl mx-auto font-sans">
      <div className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-6 border border-gray-200 dark:border-gray-800 space-y-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Eliminar Movimientos de Julio 2026</h1>
        
        <div className={`p-4 rounded-xl text-sm font-bold ${loading ? 'bg-blue-50 text-blue-700' : status.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {status}
        </div>

        <div className="bg-gray-950 text-gray-200 p-4 rounded-xl font-mono text-xs max-h-60 overflow-y-auto space-y-1">
          {log.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>

        {!loading && (
          <p className="text-xs text-gray-500 text-center italic">
            Ya puedes cerrar esta página y volver a subir tu estado de cuenta de Julio.
          </p>
        )}
      </div>
    </div>
  );
}
