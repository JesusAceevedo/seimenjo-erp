'use client';
import React, { useState, useEffect } from 'react';
import { X, FileText, FileCode, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { obtenerSignedUrl } from '../gastos/actions';
import { supabase } from '../../../lib/supabase';
import { XMLParser } from 'fast-xml-parser';
import { QRCodeSVG } from 'qrcode.react';
import CfdiRepresentation from './CfdiRepresentation';

interface DocumentViewerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  documents: { url: string; type: 'pdf' | 'xml' | 'cfdi'; label: string }[];
}

export default function DocumentViewer({ open, onClose, title, documents }: DocumentViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [cfdiData, setCfdiData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    setXmlContent(null);
    setCfdiData(null);
    setError(null);
  }, [open, documents]);

  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || documents.length === 0) return;
    const activeDoc = documents[activeIndex];
    
    const loadDoc = async () => {
      setLoading(true);
      setError(null);
      setSignedPdfUrl(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        // Obtenemos la URL firmada para cualquier tipo de documento (PDF o XML)
        const res = await obtenerSignedUrl(activeDoc.url, token);
        if (!res.success || !res.url) {
          throw new Error('No se pudo obtener el archivo.');
        }

        setSignedPdfUrl(res.url);

        if (activeDoc.type === 'xml' || activeDoc.type === 'cfdi') {
          const fetchRes = await fetch(res.url);
          if (!fetchRes.ok) throw new Error('Error al cargar el XML');
          const text = await fetchRes.text();
          setXmlContent(text);
          if (activeDoc.type === 'cfdi') {
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
            const json = parser.parse(text);
            
            let comprobante = null;
            for (const key of Object.keys(json)) {
              const cleanKey = key.includes(':') ? key.split(':')[1] : key;
              if (cleanKey.toLowerCase() === 'comprobante') {
                comprobante = json[key];
                break;
              }
            }

            if (!comprobante) {
              throw new Error('Estructura XML inválida (no es un comprobante CFDI válido o falta el nodo Comprobante).');
            }
            setCfdiData(comprobante);
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error desconocido al cargar el documento.');
      } finally {
        setLoading(false);
      }
    };

    loadDoc();
  }, [open, activeIndex, documents]);

  if (!open) return null;

  const activeDoc = documents[activeIndex];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col z-[100] font-sans cfdi-modal-backdrop">
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
          .cfdi-modal-wrapper,
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
      {/* HEADER */}
      <div className="bg-gray-900 text-white p-4 flex justify-between items-center shadow-md shrink-0">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="text-amber-500" /> Visor Documental: {title}
          </h2>
          <p className="text-xs text-gray-400 mt-1">Expediente Digital</p>
        </div>
        
        <div className="flex items-center gap-3">
          {documents.length > 1 && (
            <div className="flex bg-gray-800 rounded-lg p-1">
              {documents.map((doc, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeIndex === idx
                      ? 'bg-gray-700 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  {doc.type === 'pdf' ? <FileText size={14} /> : (doc.type === 'cfdi' ? <FileText size={14} /> : <FileCode size={14} />)}
                  {doc.label}
                </button>
              ))}
            </div>
          )}
          {activeDoc?.type === 'cfdi' && (
            <button
              onClick={() => {
                window.print();
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 font-bold text-xs flex items-center gap-2"
              title="Imprimir a PDF"
            >
              <Download size={14} /> Imprimir PDF
            </button>
          )}
          {activeDoc?.type !== 'cfdi' && (
            <a
              href={signedPdfUrl || '#'}
              target="_blank"
              rel="noreferrer"
              download
              className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
              title="Descargar Documento"
            >
              <Download size={18} />
            </a>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden p-4 md:p-6 bg-gray-950 flex justify-center cfdi-modal-wrapper">
        {documents.length === 0 ? (
          <div className="text-gray-500 flex flex-col items-center justify-center h-full">
            <AlertCircle size={48} className="mb-4 opacity-50" />
            <p>No hay documentos disponibles para visualizar.</p>
          </div>
        ) : (
          <div className="w-full max-w-5xl h-full bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col relative cfdi-modal-container">
            {loading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center z-10">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            )}
            
            {error ? (
              <div className="flex-1 flex flex-col items-center justify-center text-red-500 p-8 text-center">
                <AlertCircle size={48} className="mb-4 opacity-50" />
                <h3 className="font-bold text-lg mb-2">Error al cargar el documento</h3>
                <p className="text-sm">{error}</p>
                {activeDoc && (
                  <a href={activeDoc.url} target="_blank" rel="noreferrer" className="mt-4 underline text-sm text-blue-500">
                    Intentar abrir en una nueva pestaña
                  </a>
                )}
              </div>
            ) : !activeDoc ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                <AlertCircle size={48} className="mb-4 opacity-30 text-gray-400" />
                <h3 className="font-bold text-lg mb-2 text-gray-700 dark:text-gray-300">Sin documentos disponibles</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Este registro no tiene ningún archivo o comprobante adjunto.</p>
              </div>
            ) : activeDoc.type === 'pdf' ? (
              <iframe
                src={`${signedPdfUrl || ''}#view=FitH`}
                className="w-full h-full border-0"
                title={`PDF Viewer ${activeDoc.label || 'Documento'}`}
              />
            ) : activeDoc.type === 'cfdi' ? (
              <div className="flex-1 overflow-auto p-4 bg-gray-100 dark:bg-gray-800 cfdi-modal-content">
                {cfdiData && <CfdiRepresentation cfdiData={cfdiData} />}
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-4 bg-[#1E1E1E] text-[#D4D4D4] font-mono text-sm">
                <pre className="whitespace-pre-wrap"><code>{xmlContent}</code></pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
