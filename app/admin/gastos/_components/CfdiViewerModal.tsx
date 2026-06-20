'use client';

import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Loader2 } from 'lucide-react';
import { obtenerSignedUrl } from '../actions';
import { supabase } from '../../../../lib/supabase';
import { XMLParser } from 'fast-xml-parser';

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

        {/* METADATOS EXTRA */}
        <div className="text-[10px] text-gray-400 border-t pt-4 break-words">
          <p><strong>Forma de Pago:</strong> {cfdiData.FormaPago} | <strong>Método de Pago:</strong> {cfdiData.MetodoPago}</p>
          <p><strong>Moneda:</strong> {cfdiData.Moneda}</p>
          <p className="mt-2 text-gray-300">Sello Digital SAT: {timbre.SelloSAT?.substring(0, 50)}...</p>
          <p className="text-gray-300">Este documento es una representación impresa de un CFDI.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 transition-all">
      <div className="bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-4 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[95vh] flex flex-col font-sans relative">
        {/* Header Options */}
        <div className="flex justify-between items-center mb-4 shrink-0 bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-500 w-6 h-6" />
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Visor de Factura (CFDI)</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const printContents = document.getElementById('cfdi-print-area')?.innerHTML;
                if (printContents) {
                  const originalContents = document.body.innerHTML;
                  document.body.innerHTML = printContents;
                  window.print();
                  document.body.innerHTML = originalContents;
                  window.location.reload(); // Reload to restore React state cleanly
                }
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
        <div className="flex-1 overflow-y-auto rounded-xl custom-scrollbar pb-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
