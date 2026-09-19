'use client';

import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Printer, Loader2, AlertTriangle, FileCode } from 'lucide-react';
import { XMLParser } from 'fast-xml-parser';
import CfdiRepresentation from '../admin/_components/CfdiRepresentation';
import { obtenerContenidoXmlCliente, obtenerSignedUrlCliente } from './actions';

interface ClienteCfdiModalProps {
  xmlUrl: string | null;
  serieFolio?: string | null;
  onClose: () => void;
}

export default function ClienteCfdiModal({ xmlUrl, serieFolio, onClose }: ClienteCfdiModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cfdiData, setCfdiData] = useState<any>(null);
  const [descargandoXml, setDescargandoXml] = useState(false);

  useEffect(() => {
    if (!xmlUrl) {
      setError('No hay ruta de XML especificada.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    const cargarYProcesarXml = async () => {
      try {
        setLoading(true);
        setError(null);
        setCfdiData(null);

        // 1. Obtener contenido del XML vía Server Action con supabaseAdmin
        const res = await obtenerContenidoXmlCliente(xmlUrl);
        if (!res.success || !res.xmlContent) {
          throw new Error(res.error || 'No se pudo obtener el contenido del archivo XML.');
        }

        // 2. Parsear XML a JSON
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
        const json = parser.parse(res.xmlContent);

        // 3. Localizar el nodo Comprobante (manejando namespaces como cfdi:Comprobante o Comprobante)
        let comprobante = null;
        for (const key of Object.keys(json)) {
          const cleanKey = key.includes(':') ? key.split(':')[1] : key;
          if (cleanKey.toLowerCase() === 'comprobante') {
            comprobante = json[key];
            break;
          }
        }

        if (!comprobante) {
          throw new Error('El archivo no contiene una estructura CFDI Comprobante válida.');
        }

        if (isMounted) {
          setCfdiData(comprobante);
        }
      } catch (err: unknown) {
        console.error('Error al procesar CFDI:', err);
        const msg = err instanceof Error ? err.message : 'Error desconocido al procesar la factura';
        if (isMounted) {
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    cargarYProcesarXml();

    return () => {
      isMounted = false;
    };
  }, [xmlUrl]);

  const handleDescargarXmlRaw = async () => {
    if (!xmlUrl) return;
    setDescargandoXml(true);
    try {
      const res = await obtenerSignedUrlCliente(xmlUrl);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert(res.error || 'No se pudo descargar el XML');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descargar XML';
      alert(msg);
    } finally {
      setDescargandoXml(false);
    }
  };

  if (!xmlUrl) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-3 sm:p-6 transition-all cfdi-modal-backdrop">
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #cfdi-print-area, #cfdi-print-area * {
            visibility: visible !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
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

      <div className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-800 p-4 sm:p-5 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[95vh] flex flex-col font-sans relative cfdi-modal-container">
        {/* Cabecera del modal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0 bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-gray-900 dark:text-white">
                Representación Impresa (CFDI)
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {serieFolio ? `Folio: ${serieFolio}` : 'Factura Fiscal'}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={handleDescargarXmlRaw}
              disabled={descargandoXml || loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              title="Descargar archivo XML original"
            >
              <FileCode className="w-4 h-4" />
              <span>XML</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={loading || !cfdiData}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              title="Imprimir o guardar como documento PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir a PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition"
              title="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Área de Contenido del CFDI */}
        <div className="flex-1 overflow-y-auto rounded-xl custom-scrollbar pb-4 cfdi-modal-content">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
              <p className="font-semibold text-sm">Generando representación visual del CFDI...</p>
              <p className="text-xs text-gray-400 mt-1">Leyendo datos del emisor, receptor, conceptos y timbre fiscal.</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-650 dark:text-red-400 p-8 rounded-2xl text-center max-w-lg mx-auto my-12">
              <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-3" />
              <h3 className="font-extrabold text-base mb-1">No se pudo cargar la representación</h3>
              <p className="text-xs leading-relaxed mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded-lg hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          ) : cfdiData ? (
            <CfdiRepresentation cfdiData={cfdiData} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
