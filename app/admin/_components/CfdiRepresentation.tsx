'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface CfdiRepresentationProps {
  cfdiData: any;
}

const TAX_NAMES: Record<string, string> = {
  '001': 'ISR',
  '002': 'IVA',
  '003': 'IEPS'
};

// Robust helpers to extract elements and attributes regardless of namespace prefix or casing
function getElement(obj: any, name: string): any {
  if (!obj) return null;
  // Try with 'cfdi:' or other prefix
  if (obj[`cfdi:${name}`]) return obj[`cfdi:${name}`];
  if (obj[name]) return obj[name];
  
  // Case insensitive match
  const lowerName = name.toLowerCase();
  for (const key of Object.keys(obj)) {
    const cleanKey = key.includes(':') ? key.split(':')[1] : key;
    if (cleanKey.toLowerCase() === lowerName) {
      return obj[key];
    }
  }
  return null;
}

function getAttribute(obj: any, attrName: string): any {
  if (!obj) return '';
  // Try direct match
  if (obj[attrName] !== undefined) return obj[attrName];
  // Try with '@_' prefix
  if (obj[`@_${attrName}`] !== undefined) return obj[`@_${attrName}`];
  
  // Case-insensitive match
  const lowerAttr = attrName.toLowerCase();
  for (const key of Object.keys(obj)) {
    const cleanKey = key.startsWith('@_') ? key.slice(2) : (key.includes(':') ? key.split(':')[1] : key);
    if (cleanKey.toLowerCase() === lowerAttr) {
      return obj[key];
    }
  }
  return '';
}

export default function CfdiRepresentation({ cfdiData }: CfdiRepresentationProps) {
  if (!cfdiData) return null;

  // Format Helpers
  const formatCurrency = (val: any) => 
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(val) || 0);

  const formatPercentage = (val: any) => {
    const num = Number(val);
    if (isNaN(num)) return val || '0%';
    return `${(num * 100).toFixed(2)}%`;
  };

  // Extract base nodes
  const emisor = getElement(cfdiData, 'Emisor') || {};
  const receptor = getElement(cfdiData, 'Receptor') || {};
  
  const conceptosNode = getElement(cfdiData, 'Conceptos') || {};
  const conceptosRaw = getElement(conceptosNode, 'Concepto');
  const conceptos = Array.isArray(conceptosRaw) ? conceptosRaw : conceptosRaw ? [conceptosRaw] : [];
  
  const complemento = getElement(cfdiData, 'Complemento') || {};
  const timbre = getElement(complemento, 'TimbreFiscalDigital') || {};

  // Impuestos globales
  const impuestosNode = getElement(cfdiData, 'Impuestos') || {};
  const trasladosNode = getElement(impuestosNode, 'Traslados') || {};
  const trasladosRaw = getElement(trasladosNode, 'Traslado');
  const traslados = Array.isArray(trasladosRaw) ? trasladosRaw : trasladosRaw ? [trasladosRaw] : [];

  const retencionesNode = getElement(impuestosNode, 'Retenciones') || {};
  const retencionesRaw = getElement(retencionesNode, 'Retencion');
  const retenciones = Array.isArray(retencionesRaw) ? retencionesRaw : retencionesRaw ? [retencionesRaw] : [];

  // Metadata attributes
  const serie = getAttribute(cfdiData, 'Serie');
  const folio = getAttribute(cfdiData, 'Folio');
  const fecha = getAttribute(cfdiData, 'Fecha');
  const total = getAttribute(cfdiData, 'Total');
  const subtotal = getAttribute(cfdiData, 'SubTotal');
  const metodoPago = getAttribute(cfdiData, 'MetodoPago');
  const formaPago = getAttribute(cfdiData, 'FormaPago');
  const moneda = getAttribute(cfdiData, 'Moneda') || 'MXN';
  const tipoCambio = getAttribute(cfdiData, 'TipoCambio');
  const tipoComprobante = getAttribute(cfdiData, 'TipoDeComprobante') || 'I';

  // Emisor & Receptor Attributes
  const emisorNombre = getAttribute(emisor, 'Nombre') || 'Emisor Desconocido';
  const emisorRfc = getAttribute(emisor, 'Rfc');
  const emisorRegimen = getAttribute(emisor, 'RegimenFiscal');

  const receptorNombre = getAttribute(receptor, 'Nombre') || 'Receptor Desconocido';
  const receptorRfc = getAttribute(receptor, 'Rfc');
  const receptorUso = getAttribute(receptor, 'UsoCFDI');
  const receptorDomicilio = getAttribute(receptor, 'DomicilioFiscalReceptor');
  const receptorRegimen = getAttribute(receptor, 'RegimenFiscalReceptor');

  // Timbre Attributes
  const timbreUuid = getAttribute(timbre, 'UUID');
  const timbreSelloSat = getAttribute(timbre, 'SelloSAT');
  const timbreFecha = getAttribute(timbre, 'FechaTimbrado');
  const timbreNoCertSat = getAttribute(timbre, 'NoCertificadoSAT');
  const timbreRfcProv = getAttribute(timbre, 'RfcProvCertif');
  const selloEmisor = getAttribute(cfdiData, 'Sello');
  const noCertificadoEmisor = getAttribute(cfdiData, 'NoCertificado');

  return (
    <div id="cfdi-print-area" className="bg-white text-black p-8 border rounded-xl shadow-inner font-sans text-sm mx-auto max-w-3xl">
      {/* HEADER */}
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider">{emisorNombre}</h1>
          <p className="font-bold text-gray-600">RFC: {emisorRfc}</p>
          {emisorRegimen && (
            <p className="text-gray-500 text-xs">Régimen Fiscal: {emisorRegimen}</p>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-blue-800">FACTURA</h2>
          <p className="text-gray-600 font-bold">
            Serie/Folio: <span className="text-black">{serie} {folio}</span>
          </p>
          <p className="text-gray-600 text-xs mt-1">Fecha: {fecha}</p>
          <p className="text-gray-600 text-xs mt-1">UUID: {timbreUuid || 'N/A'}</p>
        </div>
      </div>

      {/* CLIENTE INFO */}
      <div className="bg-gray-50 p-4 rounded-lg border mb-6">
        <h3 className="font-bold border-b pb-2 mb-2 uppercase text-xs text-gray-500">Receptor</h3>
        <p className="font-bold text-lg">{receptorNombre}</p>
        <p className="text-gray-600">RFC: {receptorRfc}</p>
        <p className="text-gray-600 text-xs">
          Uso CFDI: {receptorUso} 
          {receptorDomicilio && ` | Domicilio Fiscal: ${receptorDomicilio}`}
          {receptorRegimen && ` | Régimen: ${receptorRegimen}`}
        </p>
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
          {conceptos.map((c: any, i: number) => {
            const cImpuestos = getElement(c, 'Impuestos');
            const cTrasladosNode = getElement(cImpuestos, 'Traslados');
            const cTrasladosRaw = getElement(cTrasladosNode, 'Traslado');
            const cTraslados = Array.isArray(cTrasladosRaw) ? cTrasladosRaw : cTrasladosRaw ? [cTrasladosRaw] : [];
            
            const cRetencionesNode = getElement(cImpuestos, 'Retenciones');
            const cRetencionesRaw = getElement(cRetencionesNode, 'Retencion');
            const cRetenciones = Array.isArray(cRetencionesRaw) ? cRetencionesRaw : cRetencionesRaw ? [cRetencionesRaw] : [];

            return (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 px-2 valign-top align-top">{getAttribute(c, 'Cantidad')}</td>
                <td className="py-2 px-2 text-xs text-gray-500 valign-top align-top font-mono">{getAttribute(c, 'ClaveProdServ')}</td>
                <td className="py-2 px-2 align-top">
                  <div>{getAttribute(c, 'Descripcion')}</div>
                  {/* Detailed concept taxes */}
                  {(cTraslados.length > 0 || cRetenciones.length > 0) && (
                    <div className="text-[10px] text-gray-400 mt-1 flex flex-wrap gap-2">
                      {cTraslados.map((t: any, idx: number) => (
                        <span key={`ct-${idx}`} className="bg-gray-100 px-1 py-0.5 rounded">
                          Imp: {TAX_NAMES[getAttribute(t, 'Impuesto')] || getAttribute(t, 'Impuesto')} ({formatPercentage(getAttribute(t, 'TasaOCuota'))}) +{formatCurrency(getAttribute(t, 'Importe'))}
                        </span>
                      ))}
                      {cRetenciones.map((r: any, idx: number) => (
                        <span key={`cr-${idx}`} className="bg-red-50 text-red-700/60 px-1 py-0.5 rounded">
                          Ret: {TAX_NAMES[getAttribute(r, 'Impuesto')] || getAttribute(r, 'Impuesto')} ({formatPercentage(getAttribute(r, 'TasaOCuota'))}) -{formatCurrency(getAttribute(r, 'Importe'))}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-2 px-2 text-right align-top">{formatCurrency(getAttribute(c, 'ValorUnitario'))}</td>
                <td className="py-2 px-2 text-right font-medium align-top">{formatCurrency(getAttribute(c, 'Importe'))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* TOTALES */}
      <div className="flex justify-between items-start mb-8 gap-4">
        {/* Metadatos de Pago */}
        <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border flex-1">
          <p className="mb-1"><strong>Método de Pago:</strong> {metodoPago || 'N/A'}</p>
          <p className="mb-1"><strong>Forma de Pago:</strong> {formaPago || 'N/A'}</p>
          <p className="mb-1"><strong>Moneda:</strong> {moneda} {tipoCambio ? `(TC: ${tipoCambio})` : ''}</p>
          <p><strong>Tipo de Comprobante:</strong> {tipoComprobante}</p>
        </div>

        {/* Cuentas Totales */}
        <div className="w-80">
          <div className="flex justify-between py-1 border-b text-sm">
            <span className="font-bold text-gray-600">Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          {/* Traslados Desglosados */}
          {traslados.length > 0 && (
            <div className="py-1 border-b text-xs text-gray-600 space-y-1">
              <span className="font-bold block text-gray-700">Impuestos Trasladados:</span>
              {traslados.map((t: any, idx: number) => (
                <div key={`t-${idx}`} className="flex justify-between pl-2">
                  <span>{TAX_NAMES[getAttribute(t, 'Impuesto')] || 'Traslado'} ({formatPercentage(getAttribute(t, 'TasaOCuota'))}):</span>
                  <span>{formatCurrency(getAttribute(t, 'Importe'))}</span>
                </div>
              ))}
            </div>
          )}

          {/* Retenciones Desglosadas */}
          {retenciones.length > 0 && (
            <div className="py-1 border-b text-xs text-gray-600 space-y-1">
              <span className="font-bold block text-red-700/80">Impuestos Retenidos:</span>
              {retenciones.map((r: any, idx: number) => (
                <div key={`r-${idx}`} className="flex justify-between pl-2 text-red-600">
                  <span>Retención {TAX_NAMES[getAttribute(r, 'Impuesto')] || getAttribute(r, 'Impuesto')} ({formatPercentage(getAttribute(r, 'TasaOCuota') || getAttribute(r, 'TasaOCuota'))}):</span>
                  <span>-{formatCurrency(getAttribute(r, 'Importe'))}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between py-2 text-lg font-black text-blue-800">
            <span>Total:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      {/* TIMBRE FISCAL Y SELLO */}
      <div className="border-t-2 border-gray-800 pt-4 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="sm:col-span-1 flex justify-center items-start">
            <QRCodeSVG 
              value={`https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${timbreUuid || ''}&re=${emisorRfc || ''}&rr=${receptorRfc || ''}&tt=${total || ''}&fe=${selloEmisor ? selloEmisor.slice(-8) : ''}`} 
              size={140} 
              level={"M"} 
            />
          </div>
          <div className="sm:col-span-3 text-[9px] text-gray-600 flex flex-col gap-2 break-all font-mono">
            <div>
              <p className="font-bold text-gray-900 mb-0.5">Sello Digital del Emisor (CFDI):</p>
              <p>{selloEmisor || 'No disponible'}</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-0.5">Sello Digital del SAT:</p>
              <p>{timbreSelloSat || 'No disponible'}</p>
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-0.5">Cadena Original del complemento de certificación digital del SAT:</p>
              <p>{`||1.1|${timbreUuid || ''}|${timbreFecha || ''}|${timbreRfcProv || ''}|${selloEmisor || ''}|${timbreNoCertSat || ''}||`}</p>
            </div>
            <div className="mt-2 text-gray-500 font-sans text-[10px] space-y-0.5">
              <p><strong>Folio Fiscal (UUID):</strong> {timbreUuid}</p>
              <p><strong>Fecha y Hora de Certificación:</strong> {timbreFecha}</p>
              <p><strong>No. de Serie del Certificado del SAT:</strong> {timbreNoCertSat}</p>
              <p><strong>No. de Serie del Certificado del Emisor:</strong> {noCertificadoEmisor}</p>
              {timbreRfcProv && <p><strong>RfcProvCertif:</strong> {timbreRfcProv}</p>}
            </div>
          </div>
        </div>
        <p className="text-center text-gray-400 text-xs mt-6 font-sans">
          Este documento es una representación impresa de un CFDI.
        </p>
      </div>
    </div>
  );
}
