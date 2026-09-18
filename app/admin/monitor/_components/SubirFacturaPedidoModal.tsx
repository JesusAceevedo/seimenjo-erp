'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileCode,
  FileText,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Check
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { formatCurrency } from '../../../../lib/formatters';
import { enviarFacturaPorCorreo, obtenerEmailClientePedido } from '../../gastos/actions';

interface SubirFacturaPedidoModalProps {
  pedido: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (emailDetails?: any) => void;
  getSessionToken: () => Promise<string>;
}

export default function SubirFacturaPedidoModal({
  pedido,
  isOpen,
  onClose,
  onSuccess,
  getSessionToken
}: SubirFacturaPedidoModalProps) {
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{
    uuid: string;
    serie: string;
    folio: string;
    fecha: string;
    subtotal: number;
    iva: number;
    total: number;
    emisorRfc: string;
    receptorRfc: string;
    receptorNombre: string;
    usoCfdi: string;
    formaPago: string;
    metodoPago?: string;
    fechaTimbrado: string;
  } | null>(null);

  const [estatusPago, setEstatusPago] = useState<'Liquidado' | 'Pendiente'>('Liquidado');
  const [emailDestino, setEmailDestino] = useState('');
  const [enviarPorCorreo, setEnviarPorCorreo] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [cargandoEmail, setCargandoEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pedido) {
      setXmlFile(null);
      setPdfFile(null);
      setParsedData(null);
      setError(null);
      setProcesando(false);
      setEnviarPorCorreo(true);
      setEstatusPago(pedido.estatus_pago === 'Liquidado' ? 'Liquidado' : 'Pendiente');

      const fetchClienteEmail = async () => {
        setCargandoEmail(true);

        // 1. Normalizar clientes si viene como array u objeto desde Supabase
        const clienteRel = Array.isArray(pedido.clientes) ? pedido.clientes[0] : pedido.clientes;
        const immediateEmail = (clienteRel?.email_facturacion || clienteRel?.email || '').toString().trim();

        if (immediateEmail) {
          setEmailDestino(immediateEmail);
          setCargandoEmail(false);
          return;
        }

        // 2. Invocar la Server Action con permisos de servicio y soporte multiempresa
        try {
          const token = await getSessionToken();
          const res = await obtenerEmailClientePedido({
            pedidoId: pedido.id,
            clienteId: pedido.cliente_id || clienteRel?.id,
            clienteNombre: pedido.cliente_nombre || clienteRel?.nombre_local || clienteRel?.razon_social,
            rfc: clienteRel?.rfc,
            token
          });
          if (res?.success && res.email) {
            setEmailDestino(res.email);
            setCargandoEmail(false);
            return;
          }
        } catch (actionErr) {
          console.warn('No se pudo recuperar correo vía server action:', actionErr);
        }

        // 3. Fallback client-side directo por cliente_id
        if (pedido.cliente_id) {
          const { data: cli } = await supabase
            .from('clientes')
            .select('email_facturacion')
            .eq('id', pedido.cliente_id)
            .maybeSingle();
          if (cli?.email_facturacion) {
            setEmailDestino(cli.email_facturacion);
            setCargandoEmail(false);
            return;
          }
        }

        // 4. Fallback client-side por nombre o razón social
        const nom = pedido.cliente_nombre || clienteRel?.nombre_local || clienteRel?.razon_social;
        if (nom) {
          const cleanNom = nom.trim();
          const { data: cliNom } = await supabase
            .from('clientes')
            .select('email_facturacion')
            .or(`nombre_local.ilike.%${cleanNom}%,razon_social.ilike.%${cleanNom}%`)
            .not('email_facturacion', 'is', null)
            .limit(1)
            .maybeSingle();
          if (cliNom?.email_facturacion) {
            setEmailDestino(cliNom.email_facturacion);
            setCargandoEmail(false);
            return;
          }
        }

        setEmailDestino('');
        setCargandoEmail(false);
      };

      fetchClienteEmail();
    }
  }, [pedido]);

  if (!isOpen || !pedido) return null;

  const handleXmlSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      setError('Por favor selecciona un archivo XML de factura SAT válido.');
      return;
    }

    setError(null);
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, 'application/xml');

      const parseError = xmlDoc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        throw new Error('El archivo no contiene una estructura XML válida.');
      }

      const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0] || xmlDoc.getElementsByTagName('Comprobante')[0];
      if (!comprobante) {
        throw new Error('No es un CFDI del SAT válido (no se localizó el nodo Comprobante).');
      }

      const total = parseFloat(comprobante.getAttribute('Total') || comprobante.getAttribute('total') || '0');
      const subtotal = parseFloat(comprobante.getAttribute('SubTotal') || comprobante.getAttribute('subtotal') || '0');
      const fecha = comprobante.getAttribute('Fecha') || comprobante.getAttribute('fecha') || '';
      const serie = comprobante.getAttribute('Serie') || comprobante.getAttribute('serie') || '';
      const folio = comprobante.getAttribute('Folio') || comprobante.getAttribute('folio') || '';
      const formaPago = comprobante.getAttribute('FormaPago') || comprobante.getAttribute('formaPago') || '03';
      const metodoPago = comprobante.getAttribute('MetodoPago') || comprobante.getAttribute('metodoPago') || 'PUE';

      const emisor = xmlDoc.getElementsByTagName('cfdi:Emisor')[0] || xmlDoc.getElementsByTagName('Emisor')[0];
      const emisorRfc = emisor?.getAttribute('Rfc') || emisor?.getAttribute('rfc') || '';

      const receptor = xmlDoc.getElementsByTagName('cfdi:Receptor')[0] || xmlDoc.getElementsByTagName('Receptor')[0];
      const receptorRfc = receptor?.getAttribute('Rfc') || receptor?.getAttribute('rfc') || '';
      const receptorNombre = receptor?.getAttribute('Nombre') || receptor?.getAttribute('nombre') || '';
      const usoCfdi = receptor?.getAttribute('UsoCFDI') || receptor?.getAttribute('usoCFDI') || 'G03';

      const timbre = xmlDoc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] || xmlDoc.getElementsByTagName('TimbreFiscalDigital')[0];
      const uuid = timbre?.getAttribute('UUID') || '';
      const fechaTimbrado = timbre?.getAttribute('FechaTimbrado') || '';

      let globalIva = 0;
      const cfdiImpuestos = xmlDoc.querySelector('Comprobante > Impuestos, cfdi\\:Comprobante > cfdi\\:Impuestos');
      if (cfdiImpuestos) {
        const traslados = cfdiImpuestos.getElementsByTagName('cfdi:Traslado').length > 0
          ? cfdiImpuestos.getElementsByTagName('cfdi:Traslado')
          : cfdiImpuestos.getElementsByTagName('Traslado');

        for (let i = 0; i < traslados.length; i++) {
          const t = traslados[i];
          if (t.getAttribute('Impuesto') === '002') {
            globalIva += parseFloat(t.getAttribute('Importe') || '0');
          }
        }
      }

      const cleanFp = formaPago.trim().padStart(2, '0');
      const cleanMp = metodoPago.trim().toUpperCase();

      setParsedData({
        uuid: uuid.toUpperCase(),
        serie,
        folio,
        fecha,
        subtotal,
        iva: globalIva,
        total,
        emisorRfc,
        receptorRfc,
        receptorNombre,
        usoCfdi,
        formaPago: cleanFp,
        metodoPago: cleanMp,
        fechaTimbrado
      });
      setXmlFile(file);

      // Si el XML indica PPD (crédito) o forma 99 (por definir), inferir Pendiente. Si es PUE, Liquidado.
      if (cleanMp === 'PPD' || cleanFp === '99') {
        setEstatusPago('Pendiente');
      } else {
        setEstatusPago('Liquidado');
      }

      // Si aún no tenemos correo destino o venía vacío, consultar por RFC o razón social del XML usando la Server Action
      if (!emailDestino && (receptorRfc || receptorNombre)) {
        try {
          const token = await getSessionToken();
          const res = await obtenerEmailClientePedido({
            pedidoId: pedido.id,
            clienteId: pedido.cliente_id,
            clienteNombre: receptorNombre,
            rfc: receptorRfc,
            token
          });
          if (res?.success && res.email) {
            setEmailDestino(res.email);
          }
        } catch (xmlMailErr) {
          console.warn('Error resolviendo correo por XML:', xmlMailErr);
        }
      }
    } catch (err: any) {
      console.error('Error parsing XML:', err);
      setError(err.message || 'Error al procesar el archivo XML');
      setXmlFile(null);
      setParsedData(null);
    }
  };

  const handlePdfSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor selecciona un archivo PDF válido.');
      return;
    }
    setError(null);
    setPdfFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xmlFile || !parsedData) {
      setError('Debes cargar al menos el archivo XML de la factura.');
      return;
    }

    if (enviarPorCorreo && !emailDestino.trim()) {
      setError('Para enviar por correo, ingresa una dirección de correo válida.');
      return;
    }

    setProcesando(true);
    setError(null);

    try {
      const yearMonth = parsedData.fecha ? parsedData.fecha.substring(0, 7) : new Date().toISOString().substring(0, 7);
      const uuidClean = parsedData.uuid || Date.now().toString();

      // 1. Subir XML a Supabase Storage bucket 'facturas'
      const xmlPath = `facturas/ventas/${yearMonth}/${uuidClean}_${xmlFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: xmlUpErr } = await supabase.storage.from('facturas').upload(xmlPath, xmlFile, { upsert: true });
      if (xmlUpErr) throw new Error(`Error al subir XML: ${xmlUpErr.message}`);

      // 2. Subir PDF si se adjuntó
      let pdfPath: string | null = null;
      if (pdfFile) {
        pdfPath = `facturas/ventas/${yearMonth}/${uuidClean}_${pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: pdfUpErr } = await supabase.storage.from('facturas').upload(pdfPath, pdfFile, { upsert: true });
        if (pdfUpErr) throw new Error(`Error al subir PDF: ${pdfUpErr.message}`);
      }

      // 3. Obtener empresa_id activa
      let empresaId = pedido.empresa_id;
      if (!empresaId) {
        const { data: { user } } = await supabase.auth.getUser();
        empresaId = user?.user_metadata?.empresa_id;
      }

      // 4. Actualizar correo del cliente si se capturó/modificó
      if (pedido.cliente_id && emailDestino.trim()) {
        await supabase
          .from('clientes')
          .update({ email_facturacion: emailDestino.trim() })
          .eq('id', pedido.cliente_id);
      }

      // 5. Obtener forma_pago_id
      let formaPagoId: string | null = null;
      if (parsedData.formaPago) {
        const code = parsedData.formaPago.trim().padStart(2, '0');
        const { data: fpData } = await supabase
          .from('formas_pago')
          .select('id')
          .eq('codigo', code)
          .maybeSingle();
        if (fpData) formaPagoId = fpData.id;
      }

      // 6. Obtener estatus_factura_id ('Facturado')
      const { data: efData } = await supabase
        .from('estatus_factura')
        .select('id')
        .ilike('nombre', 'Facturado')
        .maybeSingle();

      const folioStr = parsedData.folio ? `${parsedData.serie}${parsedData.folio}`.trim() : (parsedData.uuid ? `UUID-${parsedData.uuid.substring(0, 6)}` : 'FACTURADO');

      // 7. Insertar o actualizar registro en facturas_clientes
      const { data: existingFc } = await supabase
        .from('facturas_clientes')
        .select('id')
        .eq('pedido_id', pedido.id)
        .maybeSingle();

      const facturaPayload: any = {
        pedido_id: pedido.id,
        cliente_id: pedido.cliente_id || null,
        serie_folio: folioStr,
        uuid_fiscal: parsedData.uuid || null,
        total: parsedData.total,
        subtotal: parsedData.subtotal,
        iva_trasladado: parsedData.iva,
        xml_url: xmlPath,
        pdf_url: pdfPath,
        fecha_emision: parsedData.fecha ? parsedData.fecha.split('T')[0] : new Date().toISOString().split('T')[0],
        forma_pago_id: formaPagoId,
        estatus_factura_id: efData?.id || null,
        uso_cfdi_clave: parsedData.usoCfdi || 'G03',
        empresa_id: empresaId,
        fecha_timbrado: parsedData.fechaTimbrado || null
      };

      if (existingFc) {
        const { error: updErr } = await supabase
          .from('facturas_clientes')
          .update(facturaPayload)
          .eq('id', existingFc.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('facturas_clientes')
          .insert([facturaPayload]);
        if (insErr) throw insErr;
      }

      // 8. Actualizar pedido con folio_factura, estatus_pago, método de pago y fecha
      const updatePedidoPayload: Record<string, any> = {
        folio_factura: folioStr,
        estatus_pago: estatusPago
      };

      if (parsedData.formaPago) {
        updatePedidoPayload.metodo_pago = parsedData.formaPago.trim().padStart(2, '0');
      }

      if (parsedData.fecha) {
        const fechaXml = parsedData.fecha.split('T')[0];
        if (!pedido.fecha_pedido) {
          updatePedidoPayload.fecha_pedido = fechaXml;
        }
      }

      await supabase
        .from('pedidos')
        .update(updatePedidoPayload)
        .eq('id', pedido.id);

      // 9. Enviar factura por correo si está habilitado
      let emailDetails: any = null;
      if (enviarPorCorreo && emailDestino.trim()) {
        const token = await getSessionToken();
        const mailRes = await enviarFacturaPorCorreo(pedido.id, token, emailDestino.trim());
        if (mailRes.success) {
          emailDetails = mailRes;
        } else {
          console.warn('Factura guardada, pero el envío de correo falló:', mailRes.error);
        }
      }

      onSuccess(emailDetails);
      onClose();
    } catch (err: any) {
      console.error('Error al subir factura:', err);
      setError(err.message || 'Error al guardar la factura del pedido.');
    } finally {
      setProcesando(false);
    }
  };

  const diferenciaMontos = parsedData ? Math.abs(parsedData.total - Number(pedido.precio_total || 0)) : 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-900 bg-gray-50/60 dark:bg-gray-900/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                <UploadCloud size={18} />
              </span>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">
                Subir Factura al Pedido #{pedido.numero_pedido}
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Cliente: <strong className="text-gray-700 dark:text-gray-300">{(Array.isArray(pedido.clientes) ? pedido.clientes[0]?.nombre_local : pedido.clientes?.nombre_local) || pedido.cliente_nombre || 'Cliente'}</strong> | Monto Pedido: <strong className="text-emerald-600 font-mono">{formatCurrency(pedido.precio_total)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={procesando}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Área Dropzone / Selector XML */}
          <div className="space-y-1.5">
            <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide text-[10px]">
              Archivo XML (CFDI 4.0) *
            </label>
            <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-4 text-center transition-colors bg-gray-50/50 dark:bg-gray-900/20">
              <input
                type="file"
                accept=".xml"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleXmlSelect(e.target.files[0]);
                  }
                }}
                disabled={procesando}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              {xmlFile ? (
                <div className="flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                  <FileCode size={20} />
                  <span className="truncate max-w-[280px]">{xmlFile.name}</span>
                  <Check size={16} className="text-emerald-500" />
                </div>
              ) : (
                <div className="space-y-1">
                  <UploadCloud size={24} className="mx-auto text-gray-400" />
                  <p className="text-gray-600 dark:text-gray-400 font-medium">
                    Arrastra el archivo <strong className="text-blue-500">.XML</strong> o haz clic para seleccionarlo
                  </p>
                  <p className="text-[10px] text-gray-400">Requerido por el SAT</p>
                </div>
              )}
            </div>
          </div>

          {/* Área Dropzone / Selector PDF */}
          <div className="space-y-1.5">
            <label className="block font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide text-[10px]">
              Archivo PDF (Representación Impresa - Opcional)
            </label>
            <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-500 rounded-xl p-3 text-center transition-colors bg-gray-50/50 dark:bg-gray-900/20">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handlePdfSelect(e.target.files[0]);
                  }
                }}
                disabled={procesando}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              {pdfFile ? (
                <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400 font-bold">
                  <FileText size={18} />
                  <span className="truncate max-w-[280px]">{pdfFile.name}</span>
                  <Check size={16} className="text-emerald-500" />
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <FileText size={16} className="text-gray-400" />
                  <span>Seleccionar PDF de la factura (opcional)</span>
                </div>
              )}
            </div>
          </div>

          {/* Resumen extraído del XML */}
          {parsedData && (
            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={12} /> CFDI 4.0 Validado
                </span>
                <span className="font-mono text-[10px] text-gray-500">
                  Folio: <strong className="text-gray-900 dark:text-white">{parsedData.serie}{parsedData.folio || 'S/F'}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-gray-400 block text-[10px]">UUID Fiscal:</span>
                  <span className="font-mono text-[10px] text-gray-700 dark:text-gray-300 truncate block" title={parsedData.uuid}>
                    {parsedData.uuid}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Receptor (RFC):</span>
                  <span className="font-mono text-[10px] text-gray-700 dark:text-gray-300 truncate block">
                    {parsedData.receptorRfc}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">Total CFDI:</span>
                  <span className="font-bold font-mono text-emerald-600 text-sm">
                    {formatCurrency(parsedData.total)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px]">IVA Trasladado:</span>
                  <span className="font-bold font-mono text-gray-700 dark:text-gray-300">
                    {formatCurrency(parsedData.iva)}
                  </span>
                </div>
              </div>

              {/* Selector de Estatus de Pago integrado */}
              <div className="pt-2 border-t border-blue-200/70 dark:border-blue-900/50 flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300 text-[11px] font-bold">
                  Estatus de pago del pedido:
                </span>
                <select
                  value={estatusPago}
                  onChange={(e) => setEstatusPago(e.target.value as 'Liquidado' | 'Pendiente')}
                  className="px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm"
                >
                  <option value="Liquidado">🟢 Liquidado</option>
                  <option value="Pendiente">🔴 Pendiente de pago</option>
                </select>
              </div>

              {diferenciaMontos > 0.05 && (
                <div className="p-2 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-[10px] flex items-center gap-1.5 mt-1">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span>
                    El total del XML ({formatCurrency(parsedData.total)}) difiere del pedido ({formatCurrency(pedido.precio_total)}). Se registrará con el total del comprobante fiscal.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Sección de Envío por Correo Electrónico */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-blue-500" />
                <span className="font-bold text-gray-900 dark:text-white">
                  Envío por Correo Electrónico
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enviarPorCorreo}
                  onChange={(e) => setEnviarPorCorreo(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {enviarPorCorreo && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    Correo del Cliente (Destinatario) *
                  </label>
                  {cargandoEmail ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 font-medium">
                      <Loader2 size={11} className="animate-spin" /> Buscando correo en catálogo...
                    </span>
                  ) : emailDestino ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                      <CheckCircle2 size={11} /> Recuperado del cliente
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-500 font-medium">
                      Sin correo en catálogo (ingresa uno)
                    </span>
                  )}
                </div>
                <input
                  type="email"
                  placeholder="cliente@ejemplo.com"
                  value={emailDestino}
                  onChange={(e) => setEmailDestino(e.target.value)}
                  disabled={procesando}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-[10px] text-gray-400">
                  Se enviará la factura con los archivos XML y PDF adjuntos y enlaces seguros de descarga.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-900">
            <button
              type="button"
              onClick={onClose}
              disabled={procesando}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={procesando || !xmlFile}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              {procesando ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Subiendo y enviando...</span>
                </>
              ) : enviarPorCorreo ? (
                <>
                  <Mail size={14} />
                  <span>Subir Factura y Enviar Correo</span>
                </>
              ) : (
                <>
                  <UploadCloud size={14} />
                  <span>Subir Factura</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
