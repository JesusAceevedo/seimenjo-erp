'use client';

import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Loader2 } from 'lucide-react';
import { obtenerSignedUrl } from '../actions';
import { supabase } from '../../../../lib/supabase';
import { XMLParser } from 'fast-xml-parser';
import CfdiRepresentation from '../../_components/CfdiRepresentation';

interface CfdiViewerModalProps {
  xmlUrl: string | null;
  onClose: () => void;
}

export default function CfdiViewerModal({ xmlUrl, onClose }: CfdiViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cfdiData, setCfdiData] = useState<any>(null);
  const [directFileUrl, setDirectFileUrl] = useState<string | null>(null);
  const [directFileType, setDirectFileType] = useState<'pdf' | 'image' | null>(null);

  useEffect(() => {
    if (!xmlUrl) {
      setError('No hay URL proporcionada.');
      setLoading(false);
      return;
    }

    const loadXml = async () => {
      try {
        setLoading(true);
        setError(null);
        setDirectFileUrl(null);
        setDirectFileType(null);

        // 1. Get Signed URL
        const cleanUrl = xmlUrl.trim().split(',')[0].trim();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        const res = await obtenerSignedUrl(cleanUrl, token);

        if (!res.success || !res.url) {
          throw new Error(res.error || 'No se pudo obtener el archivo.');
        }

        const lowerUrl = cleanUrl.toLowerCase();
        if (lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?')) {
          setDirectFileUrl(res.url);
          setDirectFileType('pdf');
          setLoading(false);
          return;
        }

        if (lowerUrl.match(/\.(png|jpg|jpeg|webp|gif|bmp)(\?|$)/)) {
          setDirectFileUrl(res.url);
          setDirectFileType('image');
          setLoading(false);
          return;
        }

        // 2. Fetch XML content
        const fetchRes = await fetch(res.url);
        if (!fetchRes.ok) throw new Error('Error al descargar el archivo: ' + (fetchRes.statusText || ''));
        const xmlText = await fetchRes.text();

        // Check if response starts with %PDF
        if (xmlText.startsWith('%PDF')) {
          setDirectFileUrl(res.url);
          setDirectFileType('pdf');
          setLoading(false);
          return;
        }

        // 3. Parse XML
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
        const json = parser.parse(xmlText);

        let comprobante = null;
        for (const key of Object.keys(json)) {
          const cleanKey = key.includes(':') ? key.split(':')[1] : key;
          if (cleanKey.toLowerCase() === 'comprobante') {
            comprobante = json[key];
            break;
          }
        }

        if (!comprobante) {
          // If not XML CFDI, fallback to iframe view
          setDirectFileUrl(res.url);
          setDirectFileType('pdf');
          return;
        }

        setCfdiData(comprobante);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error al cargar comprobante.');
      } finally {
        setLoading(false);
      }
    };

    loadXml();
  }, [xmlUrl]);

  if (!xmlUrl) return null;

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
          <p>Generando representación visual...</p>
        </div>
      );
    }

    if (directFileUrl) {
      if (directFileType === 'image') {
        return (
          <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-950 rounded-xl">
            <img src={directFileUrl} alt="Comprobante" className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md" />
            <a
              href={directFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-2"
            >
              <Download size={14} /> Abrir en pantalla completa
            </a>
          </div>
        );
      }
      return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-950 rounded-xl overflow-hidden">
          <iframe
            src={directFileUrl}
            className="w-full h-[75vh] border-0 rounded-lg"
            title="Visor de Documento"
          />
          <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex justify-end">
            <a
              href={directFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-2"
            >
              <Download size={14} /> Abrir en pestaña nueva
            </a>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-200 text-center">
          <p className="font-bold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      );
    }

    if (!cfdiData) return null;

    return <CfdiRepresentation cfdiData={cfdiData} />;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 transition-all cfdi-modal-backdrop">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide everything except print area */
          body * {
            visibility: hidden !important;
          }
          #cfdi-print-area, #cfdi-print-area * {
            visibility: visible !important;
          }
          /* Reset body and parents of print area to avoid top blank space and clipping */
          body {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .cfdi-modal-backdrop,
          .cfdi-modal-container,
          .cfdi-modal-content {
            position: static !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            background: transparent !important;
            backdrop-filter: none !important;
            filter: none !important;
            box-shadow: none !important;
          }
          #cfdi-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}} />
      <div className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-4 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[95vh] flex flex-col font-sans relative cfdi-modal-container">
        {/* Header Options */}
        <div className="flex justify-between items-center mb-4 shrink-0 bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-500 w-6 h-6" />
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Visor de Factura (CFDI)</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                window.print();
              }}
              disabled={loading || !cfdiData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
            >
              <Download size={16} /> Imprimir a PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto rounded-xl custom-scrollbar pb-4 cfdi-modal-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
