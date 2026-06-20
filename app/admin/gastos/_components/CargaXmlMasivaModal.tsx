'use client';
import React, { useState, useRef } from 'react';
import { UploadCloud, X, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';

interface CargaXmlMasivaModalProps {
  onClose: () => void;
  onSuccess: () => void;
  tipo: 'gasto' | 'venta';
}

export default function CargaXmlMasivaModal({ onClose, onSuccess, tipo }: CargaXmlMasivaModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [resultados, setResultados] = useState<{ nombre: string; estatus: 'ok' | 'error'; mensaje?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.xml'));
      setArchivos(prev => [...prev, ...files]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const files = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.xml'));
      setArchivos(prev => [...prev, ...files]);
    }
  };

  const procesarArchivos = async () => {
    if (archivos.length === 0) return;
    setProcesando(true);
    setResultados([]);

    const nuevosResultados: any[] = [];
    const tableStr = tipo === 'gasto' ? 'gastos' : 'facturas_clientes';

    for (const file of archivos) {
      try {
        const text = await file.text();
        
        // Extracción super básica usando regex para evitar fallos por namespaces variables del SAT
        const totalMatch = text.match(/Total="([^"]+)"/i) || text.match(/total="([^"]+)"/i);
        const folioMatch = text.match(/Folio="([^"]+)"/i) || text.match(/folio="([^"]+)"/i);
        const uuidMatch = text.match(/UUID="([^"]+)"/i) || text.match(/uuid="([^"]+)"/i);
        const fechaMatch = text.match(/Fecha="([^"]+)"/i) || text.match(/fecha="([^"]+)"/i);

        const rfcEmisorMatch = text.match(/<cfdi:Emisor[^>]*Rfc="([^"]+)"/i) || text.match(/<cfdi:Emisor[^>]*rfc="([^"]+)"/i);
        const rfcReceptorMatch = text.match(/<cfdi:Receptor[^>]*Rfc="([^"]+)"/i) || text.match(/<cfdi:Receptor[^>]*rfc="([^"]+)"/i);
        const nombreEmisorMatch = text.match(/<cfdi:Emisor[^>]*Nombre="([^"]+)"/i) || text.match(/<cfdi:Emisor[^>]*nombre="([^"]+)"/i);

        if (!totalMatch || !uuidMatch) {
          nuevosResultados.push({ nombre: file.name, estatus: 'error', mensaje: 'XML inválido o no es CFDI v3.3/v4.0' });
          continue;
        }

        const total = parseFloat(totalMatch[1] || '0');
        const folio = folioMatch ? folioMatch[1] : `SF-${Math.floor(Math.random()*1000)}`;
        const uuid = uuidMatch[1];
        const fecha_emision = fechaMatch ? fechaMatch[1].split('T')[0] : new Date().toISOString().split('T')[0];
        
        const rfc = tipo === 'gasto' ? (rfcEmisorMatch ? rfcEmisorMatch[1] : 'XAXX010101000') : (rfcReceptorMatch ? rfcReceptorMatch[1] : 'XAXX010101000');
        const proveedor_cliente_nombre = tipo === 'gasto' ? (nombreEmisorMatch ? nombreEmisorMatch[1] : 'PROVEEDOR DESCONOCIDO') : 'CLIENTE';

        // 1. Subir XML al storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${tipo}s/${Date.now()}_${uuid}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('comprobantes').upload(fileName, file);

        let xmlUrl = null;
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(fileName);
          xmlUrl = urlData.publicUrl;
        }

        // 2. Insertar en base de datos
        const { error: dbError } = await supabase.from(tableStr).insert([{
          folio_factura: folio,
          uuid: uuid,
          monto_total: total,
          monto_pagado: 0,
          saldo_pendiente: total,
          fecha_emision: fecha_emision,
          rfc_proveedor: tipo === 'gasto' ? rfc : null,
          proveedor_nombre_temp: tipo === 'gasto' ? proveedor_cliente_nombre : null,
          rfc_cliente: tipo === 'venta' ? rfc : null,
          cliente_nombre_temp: tipo === 'venta' ? proveedor_cliente_nombre : null,
          xml_url: xmlUrl,
          estatus_factura_id: null,
          categoria_gasto_id: null
        }]);

        if (dbError) throw dbError;
        nuevosResultados.push({ nombre: file.name, estatus: 'ok' });

      } catch (err: any) {
        console.error(err);
        nuevosResultados.push({ nombre: file.name, estatus: 'error', mensaje: err.message || 'Error de procesamiento' });
      }
    }

    setResultados(nuevosResultados);
    setProcesando(false);
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/20">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="text-amber-500" /> Carga Masiva de XML
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {tipo === 'gasto' ? 'Sube las facturas de tus proveedores.' : 'Sube las facturas emitidas a clientes.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          
          {resultados.length === 0 ? (
            <>
              {/* Drag Area */}
              <div
                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                  dragActive 
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' 
                    : 'border-gray-300 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xml"
                  className="hidden"
                  onChange={handleChange}
                />
                <div className="w-16 h-16 bg-white dark:bg-gray-950 shadow-sm border border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-center mb-4 text-gray-400 dark:text-gray-500">
                  <UploadCloud size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
                  Arrastra tus archivos XML aquí
                </h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  O haz clic para explorar tu computadora. Puedes seleccionar múltiples archivos a la vez. (Solo formato .xml)
                </p>
              </div>

              {/* Lista previa */}
              {archivos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{archivos.length} archivos listos</span>
                    <button onClick={() => setArchivos([])} className="text-red-500 hover:underline">Limpiar lista</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2">
                    {archivos.map((f, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
                        <FileText size={18} className="text-amber-500 shrink-0" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{f.name}</span>
                        <button onClick={() => setArchivos(archivos.filter((_, idx) => idx !== i))} className="ml-auto text-gray-400 hover:text-red-500 shrink-0">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            // Resultados
            <div className="space-y-4">
              <h3 className="font-bold text-gray-800 dark:text-gray-200">Resumen de Carga</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {resultados.map((res, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
                    res.estatus === 'ok' 
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' 
                      : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
                  }`}>
                    {res.estatus === 'ok' ? (
                      <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle size={18} className="text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{res.nombre}</p>
                      {res.mensaje && <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">{res.mensaje}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/20 flex justify-end gap-3">
          {resultados.length === 0 ? (
            <>
              <button
                onClick={onClose}
                disabled={procesando}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={procesarArchivos}
                disabled={archivos.length === 0 || procesando}
                className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {procesando ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Procesando...</>
                ) : (
                  <>Procesar {archivos.length} XMLs</>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-6 py-2.5 rounded-xl font-bold text-sm transition-colors"
            >
              Cerrar y Ver Resultados
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
