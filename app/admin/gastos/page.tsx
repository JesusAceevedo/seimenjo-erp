'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Asumimos que supabase exporta la misma instancia
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { 
  UploadCloud, Soup, ShoppingCart, Users, LayoutDashboard, 
  Sun, Moon, Filter, Eye, ChevronLeft, ChevronRight, FileText, FileDown
} from 'lucide-react';

export default function AdminGastos() {
  const router = useRouter();

  // Estados
  const [gastos, setGastos] = useState<any[]>([]);
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const [page, setPage] = useState(0);
  const pageSize = 10;
  
  // Estado para Dropzone
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  // --- CONSULTAS A BASE DE DATOS ---
  const fetchGastos = async () => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data } = await supabase
      .from('gastos')
      .select(`
        *, 
        proveedores(nombre_comercial, rfc), 
        categorias_gasto(nombre)
      `)
      .order('fecha_gasto', { ascending: false })
      .range(from, to);

    if (data) setGastos(data);
  };

  useEffect(() => {
    fetchGastos();
  }, [page]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/admin/login');
    };
    init();
  }, [router]);

  // --- LÓGICA DE DROPZONE Y CARGA XML ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    procesarArchivo(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) procesarArchivo(file);
  };

  const procesarArchivo = async (file: File) => {
    setUploadStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/gastos/process-xml', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setUploadStatus('success');
        fetchGastos(); // Recargar la tabla
        setTimeout(() => setUploadStatus('idle'), 3000);
      } else {
        setUploadStatus('error');
        setTimeout(() => setUploadStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Error procesando:', error);
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors flex">

       

        {/* ÁREA PRINCIPAL */}
        <main className="flex-1 flex flex-col p-8 w-full max-w-[100vw] md:max-w-[calc(100vw-16rem)]">

          {/* HEADER */}
          <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">Registro e Historial de Gastos</h2>
            <div className="flex items-center gap-3">
              <button onClick={toggleDarkMode} className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>

          {/* DROPZONE DE CARGA (Diseño integrado) */}
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-xl shadow-md mb-6">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-4">Automatización Fiscal</h3>
            
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer relative
                ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'}
                ${uploadStatus === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}
                ${uploadStatus === 'success' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : ''}
              `}
            >
              <input 
                type="file" 
                accept=".xml,.pdf" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileInput}
              />
              
              {uploadStatus === 'idle' && (
                <>
                  <UploadCloud className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500 mb-3" />
                  <p className="text-gray-700 dark:text-gray-300 font-medium">Arrastra tu factura (XML/PDF) aquí o haz clic</p>
                  <p className="text-xs text-gray-500 mt-2">El sistema extraerá el RFC y registrará el gasto automáticamente</p>
                </>
              )}
              {uploadStatus === 'uploading' && <p className="text-blue-600 dark:text-blue-400 font-bold animate-pulse">Procesando archivo fiscal...</p>}
              {uploadStatus === 'success' && <p className="text-emerald-600 dark:text-emerald-400 font-bold">¡Gasto registrado exitosamente!</p>}
              {uploadStatus === 'error' && <p className="text-red-600 dark:text-red-400 font-bold">Error al procesar el archivo. Revisa el formato.</p>}
            </div>
          </div>

          {/* TABLA PRINCIPAL DE GASTOS */}
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl flex flex-col flex-1 overflow-hidden">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Proveedor / Emisor</th>
                    <th className="p-4">Concepto / Categoría</th>
                    <th className="p-4 text-right">Monto Operativo</th>
                    <th className="p-4 text-center">Comprobante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
                  {gastos.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-4 font-mono text-gray-600 dark:text-gray-300">
                        {new Date(g.fecha_gasto).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{g.proveedores?.nombre_comercial || 'N/A'}</div>
                        <div className="font-mono text-[10px] text-gray-500">{g.proveedores?.rfc}</div>
                      </td>
                      <td className="p-4 space-y-1">
                        <div className="font-medium">{g.concepto || 'Compra general'}</div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                          {g.categorias_gasto?.nombre || 'Sin Categoría'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-sm text-red-600 dark:text-red-400">
                        - ${Number(g.monto).toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        <button className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded text-gray-700 dark:text-gray-300 font-medium transition-colors">
                          <Eye size={14} /> Ver 
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <button disabled={page === 0} onClick={() => setPage(page - 1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors"><ChevronLeft size={16} /> Anterior</button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Página {page + 1}</span>
              <button disabled={gastos.length < pageSize} onClick={() => setPage(page + 1)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors">Siguiente <ChevronRight size={16} /></button>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}