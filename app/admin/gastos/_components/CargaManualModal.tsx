'use client';
import React, { useState } from 'react';
import { X, UploadCloud, Link as LinkIcon, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';

interface CargaManualModalProps {
  onClose: () => void;
  onSuccess: () => void;
  tipo: 'gasto' | 'venta';
  registroId?: string | null;
}

export default function CargaManualModal({ onClose, onSuccess, tipo, registroId }: CargaManualModalProps) {
  const [procesando, setProcesando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState('');

  // Estados para archivos
  const [fileMode, setFileMode] = useState<{
    xml: 'upload' | 'link';
    pdf: 'upload' | 'link';
    ticket: 'upload' | 'link';
  }>({
    xml: 'upload',
    pdf: 'upload',
    ticket: 'upload'
  });

  const [files, setFiles] = useState<{
    xml: File | null;
    pdf: File | null;
    ticket: File | null;
  }>({
    xml: null,
    pdf: null,
    ticket: null
  });

  const [links, setLinks] = useState({
    xml: '',
    pdf: '',
    ticket: ''
  });

  const [existingDocs, setExistingDocs] = useState<{xml: boolean, pdf: boolean, ticket: boolean}>({
    xml: false,
    pdf: false,
    ticket: false
  });

  React.useEffect(() => {
    if (registroId) {
      const fetchDocs = async () => {
        const tableStr = tipo === 'gasto' ? 'gastos' : 'facturas_clientes';
        const { data } = await supabase.from(tableStr).select('xml_url, pdf_url, ticket_url').eq('id', registroId).single();
        if (data) {
          setExistingDocs({
            xml: !!data.xml_url,
            pdf: !!data.pdf_url,
            ticket: !!data.ticket_url
          });
          setLinks({
            xml: data.xml_url ? data.xml_url.split(',')[0] : '',
            pdf: data.pdf_url ? data.pdf_url.split(',')[0] : '',
            ticket: data.ticket_url ? data.ticket_url.split(',')[0] : ''
          });
        }
      };
      fetchDocs();
    }
  }, [registroId, tipo]);

  const handleModeToggle = (docType: 'xml' | 'pdf' | 'ticket', mode: 'upload' | 'link') => {
    setFileMode(prev => ({ ...prev, [docType]: mode }));
  };

  const procesarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcesando(true);
    setErrorGlobal('');

    try {
      // 1. Validaciones
      if (!registroId && fileMode.xml === 'upload' && !files.xml) {
        throw new Error('Debes proporcionar el XML (obligatorio) para crear una nueva factura.');
      }
      if (!registroId && fileMode.xml === 'link' && !links.xml) {
        throw new Error('Debes proporcionar el link del XML para crear una nueva factura.');
      }

      let parsedData: any = null;

      // 2. Si es NUEVA factura y subieron XML, extraemos data
      if (!registroId && fileMode.xml === 'upload' && files.xml) {
        const text = await files.xml.text();
        const totalMatch = text.match(/Total="([^"]+)"/i) || text.match(/total="([^"]+)"/i);
        const folioMatch = text.match(/Folio="([^"]+)"/i) || text.match(/folio="([^"]+)"/i);
        const uuidMatch = text.match(/UUID="([^"]+)"/i) || text.match(/uuid="([^"]+)"/i);
        const fechaMatch = text.match(/Fecha="([^"]+)"/i) || text.match(/fecha="([^"]+)"/i);

        const rfcEmisorMatch = text.match(/<cfdi:Emisor[^>]*Rfc="([^"]+)"/i) || text.match(/<cfdi:Emisor[^>]*rfc="([^"]+)"/i);
        const rfcReceptorMatch = text.match(/<cfdi:Receptor[^>]*Rfc="([^"]+)"/i) || text.match(/<cfdi:Receptor[^>]*rfc="([^"]+)"/i);
        const nombreEmisorMatch = text.match(/<cfdi:Emisor[^>]*Nombre="([^"]+)"/i) || text.match(/<cfdi:Emisor[^>]*nombre="([^"]+)"/i);

        if (!totalMatch || !uuidMatch) {
          throw new Error('XML inválido o no es CFDI v3.3/v4.0');
        }

        parsedData = {
          total: parseFloat(totalMatch[1] || '0'),
          folio: folioMatch ? folioMatch[1] : `SF-${Math.floor(Math.random()*1000)}`,
          uuid: uuidMatch[1],
          fecha_emision: fechaMatch ? fechaMatch[1].split('T')[0] : new Date().toISOString().split('T')[0],
          rfc: tipo === 'gasto' ? (rfcEmisorMatch ? rfcEmisorMatch[1] : 'XAXX010101000') : (rfcReceptorMatch ? rfcReceptorMatch[1] : 'XAXX010101000'),
          nombre: tipo === 'gasto' ? (nombreEmisorMatch ? nombreEmisorMatch[1] : 'PROVEEDOR DESCONOCIDO') : 'CLIENTE'
        };
      }

      // 3. Subir Archivos a Supabase
      const timestamp = Date.now();
      const basePath = tipo === 'gasto' ? 'gastos/' : 'ventas/';
      let finalXmlUrl = fileMode.xml === 'link' ? links.xml : null;
      let finalPdfUrl = fileMode.pdf === 'link' ? links.pdf : null;
      let finalTicketUrl = fileMode.ticket === 'link' ? links.ticket : null;

      const uploadFile = async (file: File | null, prefix: string) => {
        if (!file) return null;
        const ext = file.name.split('.').pop();
        const uuidName = parsedData?.uuid || registroId || 'manual';
        const fileName = `${basePath}${timestamp}_${prefix}_${uuidName}.${ext}`;
        const { error } = await supabase.storage.from('comprobantes').upload(fileName, file);
        if (error) throw new Error(`Error al subir ${prefix}: ${error.message}`);
        const { data } = supabase.storage.from('comprobantes').getPublicUrl(fileName);
        return data.publicUrl;
      };

      if (fileMode.xml === 'upload' && files.xml) finalXmlUrl = await uploadFile(files.xml, 'xml');
      if (fileMode.pdf === 'upload' && files.pdf) finalPdfUrl = await uploadFile(files.pdf, 'pdf');
      if (fileMode.ticket === 'upload' && files.ticket) finalTicketUrl = await uploadFile(files.ticket, 'ticket');

      const tableStr = tipo === 'gasto' ? 'gastos' : 'facturas_clientes';

      // 4. Guardar en Base de Datos
      if (registroId) {
        // ACTUALIZAR (Adjuntar documentos faltantes)
        const updateData: any = {};
        if (finalXmlUrl) updateData.xml_url = finalXmlUrl;
        if (finalPdfUrl) updateData.pdf_url = finalPdfUrl;
        if (finalTicketUrl) updateData.ticket_url = finalTicketUrl;

        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase.from(tableStr).update(updateData).eq('id', registroId);
          if (error) throw error;
        }
      } else {
        // CREAR NUEVO REGISTRO
        const { error } = await supabase.from(tableStr).insert([{
          folio_factura: parsedData?.folio || 'SIN-FOLIO',
          uuid: parsedData?.uuid || 'SIN-UUID',
          monto_total: parsedData?.total || 0,
          monto_pagado: 0,
          saldo_pendiente: parsedData?.total || 0,
          fecha_emision: parsedData?.fecha_emision || new Date().toISOString().split('T')[0],
          rfc_proveedor: tipo === 'gasto' ? parsedData?.rfc : null,
          proveedor_nombre_temp: tipo === 'gasto' ? parsedData?.nombre : null,
          rfc_cliente: tipo === 'venta' ? parsedData?.rfc : null,
          cliente_nombre_temp: tipo === 'venta' ? parsedData?.nombre : null,
          xml_url: finalXmlUrl,
          pdf_url: finalPdfUrl,
          ticket_url: finalTicketUrl
        }]);
        if (error) throw error;
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorGlobal(err.message || 'Ocurrió un error inesperado al procesar.');
    } finally {
      setProcesando(false);
    }
  };

  const renderFileSection = (
    title: string, 
    type: 'xml' | 'pdf' | 'ticket', 
    accept: string, 
    mandatory: boolean
  ) => {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            {title} {mandatory && <span className="text-red-500">*</span>}
            {existingDocs[type] && <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 text-[10px] font-bold rounded-full">Ya cargado</span>}
          </label>
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => handleModeToggle(type, 'upload')}
              className={'px-3 py-1 rounded-md text-xs font-semibold transition-all ' + (fileMode[type] === 'upload' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700')}
            >
              Archivo
            </button>
            <button
              type="button"
              onClick={() => handleModeToggle(type, 'link')}
              className={'px-3 py-1 rounded-md text-xs font-semibold transition-all ' + (fileMode[type] === 'upload' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700')}
            >
              Enlace
            </button>
          </div>
        </div>

        {fileMode[type] === 'upload' ? (
          <div className="flex items-center gap-3">
            <label className="flex-1 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50 dark:bg-gray-950/50">
              <input 
                type="file" 
                accept={accept}
                className="hidden" 
                onChange={(e) => setFiles(prev => ({ ...prev, [type]: e.target.files?.[0] || null }))}
              />
              <UploadCloud size={20} className="text-gray-400 mb-1" />
              <span className="text-xs font-medium text-gray-500">
                {files[type] ? files[type]?.name : 'Seleccionar Archivo'}
              </span>
            </label>
            {files[type] && <CheckCircle className="text-emerald-500 shrink-0" size={20} />}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                value={links[type]}
                onChange={(e) => setLinks(prev => ({ ...prev, [type]: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
            {links[type] && <CheckCircle className="text-emerald-500 shrink-0" size={20} />}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
      <div className="bg-gray-50 dark:bg-gray-950 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-900">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="text-blue-500" /> {registroId ? 'Adjuntar Documentos' : 'Carga Manual'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {registroId 
                ? 'Agrega los documentos faltantes a este registro.' 
                : (tipo === 'gasto' ? 'Sube el XML, PDF y Ticket del gasto.' : 'Sube el XML, PDF y Ticket de la venta.')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={procesarManual} className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {errorGlobal && (
            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <p>{errorGlobal}</p>
            </div>
          )}

          {renderFileSection("Archivo XML", "xml", ".xml", !registroId)}
          {renderFileSection("Representación Impresa (PDF)", "pdf", ".pdf", false)}
          {renderFileSection("Ticket / Nota / Foto", "ticket", "image/*,.pdf", false)}

        </form>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-900 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={procesando}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={procesarManual}
            disabled={procesando}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {procesando ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> Procesando...</>
            ) : (
              <>{registroId ? 'Guardar Cambios' : 'Crear Registro'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
