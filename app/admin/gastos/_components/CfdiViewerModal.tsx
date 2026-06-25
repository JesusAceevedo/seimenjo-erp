'use client';

import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Loader2 } from 'lucide-react';
import { obtenerSignedUrl } from '../actions';
import { supabase } from '../../../../lib/supabase';
import { XMLParser } from 'fast-xml-parser';
import { QRCodeSVG } from 'qrcode.react';

interface CfdiViewerModalProps {
  xmlUrl: string | null;
  onClose: () => void;
}

export default function CfdiViewerModal({ xmlUrl, onClose }: CfdiViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cfdiData, setCfdiData] = useState<any>(null);

  useEffect(() => {
    if (!xmlUrl) {
      setError('No hay URL de XML proporcionada.');
      setLoading(false);
      return;
    }

    const loadXml = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Get Signed URL
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        const res = await obtenerSignedUrl(xmlUrl, token);

        if (!res.success || !res.url) {
          throw new Error(res.error || 'No se pudo obtener el archivo XML.');
        }

        // 2. Fetch XML content
        const fetchRes = await fetch(res.url);
        if (!fetchRes.ok) throw new Error('Error al descargar el XML.');
        const xmlText = await fetchRes.text();

        // 3. Parse XML
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
        const json = parser.parse(xmlText);

        const comprobante = json["cfdi:Comprobante"];
        if (!comprobante) {
          throw new Error('Estructura XML inválida (no es un comprobante CFDI válido).');
        }

        setCfdiData(comprobante);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error desconocido al cargar CFDI.');
      } finally {
        setLoading(false);
      }
    };

    loadXml();
  }, [xmlUrl]);

  if (!xmlUrl) return null;

  // Format Helpers
  const formatCurrency = (val: any) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val) || 0);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
          <p>Generando representación visual...</p>
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

    const emisor = cfdiData["cfdi:Emisor"] || {};
    const receptor = cfdiData["cfdi:Receptor"] || {};
    const conceptosRaw = cfdiData["cfdi:Conceptos"]?.["cfdi:Concepto"];
    const conceptos = Array.isArray(conceptosRaw) ? conceptosRaw : conceptosRaw ? [conceptosRaw] : [];
    const timbre = cfdiData["cfdi:Complemento"]?.["tfd:TimbreFiscalDigital"] || {};

    return (
      <div id="cfdi-print-area" className="bg-white text-black p-8 border rounded-xl shadow-inner font-sans text-sm mx-auto max-w-3xl">
        {/* HEADER */}
        <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">{emisor.Nombre || 'Emisor Desconocido'}</h1>
            <p className="font-bold text-gray-600">RFC: {emisor.Rfc}</p>
            <p className="text-gray-500 text-xs">Régimen Fiscal: {emisor.RegimenFiscal}</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-blue-800">FACTURA</h2>
            <p className="text-gray-600 font-bold">Serie/Folio: <span className="text-black">{cfdiData.Serie || ''} {cfdiData.Folio || ''}</span></p>
            <p className="text-gray-600 text-xs mt-1">Fecha: {cfdiData.Fecha}</p>
            <p className="text-gray-600 text-xs mt-1">UUID: {timbre.UUID || 'N/A'}</p>
          </div>
        </div>

        {/* CLIENTE INFO */}
        <div className="bg-gray-50 p-4 rounded-lg border mb-6">
          <h3 className="font-bold border-b pb-2 mb-2 uppercase text-xs text-gray-500">Receptor</h3>
          <p className="font-bold text-lg">{receptor.Nombre || 'Receptor Desconocido'}</p>
          <p className="text-gray-600">RFC: {receptor.Rfc}</p>
          <p className="text-gray-600 text-xs">Uso CFDI: {receptor.UsoCFDI} | Domicilio Fiscal: {receptor.DomicilioFiscalReceptor}</p>
        </div>

        {/* CONCEPTOS */}
        <table className="w-full text-left mb-6 text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-300">
              <th className="py-2 px-2 font-bold w-16">Cant</th>
              <th className="py-2 px-2 font-bold w-20">Clave</th>
              <th className="py-2 px-2 font-bold">Descripción</th>
              <th className="py-2 px-2 font-bold text-right w-24">V. Unitario</th>
              <th className="py-2 px-2 font-bold text-right w-24">Importe</th>
            </tr>
          </thead>
          <tbody>
            {conceptos.map((c: any, i: number) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 px-2">{c.Cantidad}</td>
                <td className="py-2 px-2 text-xs text-gray-500">{c.ClaveProdServ}</td>
                <td className="py-2 px-2">{c.Descripcion}</td>
                <td className="py-2 px-2 text-right">{formatCurrency(c.ValorUnitario)}</td>
                <td className="py-2 px-2 text-right font-medium">{formatCurrency(c.Importe)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTALES */}
        <div className="flex justify-end mb-8">
          <div className="w-64">
            <div className="flex justify-between py-1 border-b">
              <span className="font-bold text-gray-600">Subtotal:</span>
              <span>{formatCurrency(cfdiData.SubTotal)}</span>
            </div>
            {/* Impuestos (Simplificado) */}
            <div className="flex justify-between py-1 border-b">
              <span className="font-bold text-gray-600">Impuestos:</span>
              <span>{formatCurrency(Number(cfdiData.Total) - Number(cfdiData.SubTotal))}</span>
            </div>
            <div className="flex justify-between py-2 text-lg font-black text-blue-800">
              <span>Total:</span>
              <span>{formatCurrency(cfdiData.Total)}</span>
            </div>
          </div>
        </div>

        {/* METADATOS EXTRA Y TIMBRE FISCAL */}
        <div className="bg-gray-50 p-3 rounded-lg border mb-6 text-xs text-gray-700">
          <p><strong>Forma de Pago:</strong> {cfdiData.FormaPago || 'N/A'} | <strong>Método de Pago:</strong> {cfdiData.MetodoPago || 'N/A'} | <strong>Moneda:</strong> {cfdiData.Moneda || 'N/A'}</p>
        </div>

        <div className="border-t-2 border-gray-800 pt-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div className="sm:col-span-1 flex justify-center items-start">
              <QRCodeSVG 
                value={`https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${timbre.UUID || ''}&re=${emisor.Rfc || ''}&rr=${receptor.Rfc || ''}&tt=${cfdiData.Total || ''}&fe=${cfdiData.Sello ? cfdiData.Sello.slice(-8) : ''}`} 
                size={140} 
                level={"M"} 
              />
            </div>
            <div className="sm:col-span-3 text-[9px] text-gray-600 flex flex-col gap-2 break-all font-mono">
              <div>
                <p className="font-bold text-gray-900 mb-0.5">Sello Digital del Emisor (CFDI):</p>
                <p>{cfdiData.Sello || 'No disponible'}</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-0.5">Sello Digital del SAT:</p>
                <p>{timbre.SelloSAT || 'No disponible'}</p>
              </div>
              <div>
                <p className="font-bold text-gray-900 mb-0.5">Cadena Original del complemento de certificación digital del SAT:</p>
                <p>{`||1.1|${timbre.UUID || ''}|${timbre.FechaTimbrado || ''}|${timbre.RfcProvCertif || ''}|${cfdiData.Sello || ''}|${timbre.NoCertificadoSAT || ''}||`}</p>
              </div>
              <div className="mt-2 text-gray-500 font-sans text-[10px]">
                <p><strong>Folio Fiscal (UUID):</strong> {timbre.UUID}</p>
                <p><strong>Fecha y Hora de Certificación:</strong> {timbre.FechaTimbrado}</p>
                <p><strong>No. de Serie del Certificado del SAT:</strong> {timbre.NoCertificadoSAT}</p>
                <p><strong>No. de Serie del Certificado del Emisor:</strong> {cfdiData.NoCertificado}</p>
                <p><strong>RfcProvCertif:</strong> {timbre.RfcProvCertif || 'N/A'}</p>
              </div>
            </div>
          </div>
          <p className="text-center text-gray-400 text-xs mt-6 font-sans">Este documento es una representación impresa de un CFDI.</p>
        </div>
      </div>
    );
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
