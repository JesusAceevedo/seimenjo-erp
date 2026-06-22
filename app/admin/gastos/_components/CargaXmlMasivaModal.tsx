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

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Debes iniciar sesión para realizar esta acción.');
      }

      // Obtener el ID de la tabla 'usuarios_staff' (el ID de autenticación difiere del ID de base de datos)
      let staffId = null;
      if (tipo === 'gasto') {
        const { data: staffData, error: staffError } = await supabase
          .from('usuarios_staff')
          .select('id')
          .eq('supabase_auth_id', user.id)
          .maybeSingle();
        if (staffError || !staffData) {
          throw new Error('No se encontró tu registro de usuario de personal (Staff).');
        }
        staffId = staffData.id;
      }

      // Obtener formas_pago y estatus_factura una sola vez para optimizar rendimiento
      const { data: formasPagoData } = await supabase.from('formas_pago').select('id, nombre');
      const { data: estatusData } = await supabase
        .from('estatus_factura')
        .select('id')
        .ilike('nombre', 'Facturado')
        .maybeSingle();
      
      let defaultEstatusId = null;
      if (estatusData) {
        defaultEstatusId = estatusData.id;
      } else {
        const { data: firstE } = await supabase.from('estatus_factura').select('id').limit(1).maybeSingle();
        if (firstE) defaultEstatusId = firstE.id;
      }

      for (const file of archivos) {
        try {
          const text = await file.text();
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, 'application/xml');

          // Verificar errores de parseo
          const parseErrorNode = xmlDoc.getElementsByTagName('parsererror');
          if (parseErrorNode.length > 0) {
            nuevosResultados.push({ nombre: file.name, estatus: 'error', mensaje: 'El archivo no tiene un formato XML válido.' });
            continue;
          }

          // 1. Nodo Comprobante
          const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0] || xmlDoc.getElementsByTagName('Comprobante')[0];
          if (!comprobante) {
            nuevosResultados.push({ nombre: file.name, estatus: 'error', mensaje: 'Falta elemento cfdi:Comprobante.' });
            continue;
          }

          const tipoDeComprobante = comprobante.getAttribute('TipoDeComprobante') || comprobante.getAttribute('tipoDeComprobante') || 'I';

          let total = parseFloat(comprobante.getAttribute('Total') || comprobante.getAttribute('total') || '0');
          let subtotal = parseFloat(comprobante.getAttribute('SubTotal') || comprobante.getAttribute('subtotal') || '0');
          let fecha = comprobante.getAttribute('Fecha') || comprobante.getAttribute('fecha') || '';
          let serie = comprobante.getAttribute('Serie') || comprobante.getAttribute('serie') || '';
          let folio = comprobante.getAttribute('Folio') || comprobante.getAttribute('folio') || '';
          let formaPagoCode = comprobante.getAttribute('FormaPago') || comprobante.getAttribute('formaPago') || '';

          // Check if it is a Complemento de Pago (REP)
          const pagoNodes = xmlDoc.getElementsByTagName('pago20:Pago').length > 0
            ? xmlDoc.getElementsByTagName('pago20:Pago')
            : xmlDoc.getElementsByTagName('pago10:Pago').length > 0
              ? xmlDoc.getElementsByTagName('pago10:Pago')
              : xmlDoc.getElementsByTagName('Pago');

          let isComplementoPago = false;
          let uuidsRelacionados: string[] = [];

          if (tipoDeComprobante === 'P' || pagoNodes.length > 0) {
            isComplementoPago = true;
            let totalPago = 0;
            let fechaPago = '';
            let formaPagoPago = '';

            for (let i = 0; i < pagoNodes.length; i++) {
              const pNode = pagoNodes[i];
              totalPago += parseFloat(pNode.getAttribute('Monto') || pNode.getAttribute('monto') || '0');
              if (!fechaPago) {
                fechaPago = pNode.getAttribute('FechaPago') || pNode.getAttribute('fechaPago') || '';
              }
              if (!formaPagoPago) {
                formaPagoPago = pNode.getAttribute('FormaDePagoP') || pNode.getAttribute('formaDePagoP') || '';
              }
            }

            total = totalPago;
            subtotal = totalPago;
            if (fechaPago) {
              fecha = fechaPago;
            }
            if (formaPagoPago) {
              formaPagoCode = formaPagoPago;
            }

            // Extract DoctoRelacionado UUIDs
            const docRelNodes = xmlDoc.getElementsByTagName('pago20:DoctoRelacionado').length > 0
              ? xmlDoc.getElementsByTagName('pago20:DoctoRelacionado')
              : xmlDoc.getElementsByTagName('pago10:DoctoRelacionado').length > 0
                ? xmlDoc.getElementsByTagName('pago10:DoctoRelacionado')
                : xmlDoc.getElementsByTagName('DoctoRelacionado');

            for (let i = 0; i < docRelNodes.length; i++) {
              const dNode = docRelNodes[i];
              const refUuid = dNode.getAttribute('IdDocumento') || dNode.getAttribute('idDocumento') || '';
              if (refUuid && !uuidsRelacionados.includes(refUuid.toUpperCase())) {
                uuidsRelacionados.push(refUuid.toUpperCase());
              }
            }
          }

          // 2. Nodo Emisor
          const emisor = xmlDoc.getElementsByTagName('cfdi:Emisor')[0] || xmlDoc.getElementsByTagName('Emisor')[0];
          const emisorRfc = emisor?.getAttribute('Rfc') || emisor?.getAttribute('rfc') || '';
          const emisorNombre = emisor?.getAttribute('Nombre') || emisor?.getAttribute('nombre') || '';

          // 3. Nodo Receptor
          const receptor = xmlDoc.getElementsByTagName('cfdi:Receptor')[0] || xmlDoc.getElementsByTagName('Receptor')[0];
          const rfcReceptor = receptor?.getAttribute('Rfc') || receptor?.getAttribute('rfc') || '';
          const nombreReceptor = receptor?.getAttribute('Nombre') || receptor?.getAttribute('nombre') || '';
          const usoCfdi = receptor?.getAttribute('UsoCFDI') || receptor?.getAttribute('usoCFDI') || '';

          // 4. Complemento -> TimbreFiscalDigital
          const timbre = xmlDoc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] || xmlDoc.getElementsByTagName('TimbreFiscalDigital')[0];
          const uuid = timbre?.getAttribute('UUID') || '';
          const fechaTimbrado = timbre?.getAttribute('FechaTimbrado') || '';

          if (!uuid) {
            nuevosResultados.push({ nombre: file.name, estatus: 'error', mensaje: 'No se detectó el UUID del Timbre Fiscal Digital.' });
            continue;
          }

          // 5. Impuestos -> Traslados (IVA 002 Global)
          let globalIva = 0;
          if (!isComplementoPago) {
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
          }

          const rfc = tipo === 'gasto' ? emisorRfc : rfcReceptor;
          const proveedor_cliente_nombre = tipo === 'gasto' ? emisorNombre : nombreReceptor;
          const folioStr = folio ? `${serie}${folio}`.trim() : (serie ? serie.trim() : `SF-${Math.floor(Math.random() * 1000)}`);
          const fecha_emision = fecha ? fecha.split('T')[0] : new Date().toISOString().split('T')[0];

          // Mapear la forma de pago para esta factura
          let formaPagoId = null;
          let metodoPago = 'Transferencia'; // fallback por defecto
          if (formasPagoData && formasPagoData.length > 0) {
            const code = formaPagoCode || '03';
            let term = 'Efectivo';
            if (code === '03') term = 'Transferencia';
            else if (code === '04' || code === '28') term = 'Tarjeta';
            else if (code === '02') term = 'Cheque';

            const match = formasPagoData.find(f => f.nombre.toLowerCase().includes(term.toLowerCase()));
            if (match) {
              formaPagoId = match.id;
              metodoPago = match.nombre;
            } else {
              formaPagoId = formasPagoData[0].id;
              metodoPago = formasPagoData[0].nombre;
            }
          }

          // 1. Subir XML al storage
          const fileExt = file.name.split('.').pop();
          const fileName = `${tipo}s/${Date.now()}_${uuid}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('facturas').upload(fileName, file);

          let xmlUrl = '';
          if (!uploadError) {
            xmlUrl = fileName;
          }

          // 2. Insertar en base de datos
          let insertPayload: any = {};

          if (tipo === 'gasto') {
            let empresaId = '';
            try {
              const sesionGuardada = localStorage.getItem('seimenjo_session');
              if (sesionGuardada) {
                const datosSesion = JSON.parse(sesionGuardada);
                empresaId = datosSesion.empresa_id;
              }
            } catch (e) {
              console.error('Error reading active company from localStorage:', e);
            }

            if (!empresaId) {
              empresaId = user.user_metadata?.empresa_id;
            }

            if (!empresaId) {
              throw new Error('No se pudo identificar la empresa activa en tu sesión.');
            }

            // Buscar o crear proveedor por RFC
            let proveedorId = null;
            if (rfc) {
              const { data: prov } = await supabase
                .from('proveedores')
                .select('id')
                .eq('rfc', rfc.toUpperCase())
                .eq('empresa_id', empresaId)
                .maybeSingle();

              if (prov) {
                proveedorId = prov.id;
              } else {
                const { data: newProv, error: errP } = await supabase
                  .from('proveedores')
                  .insert({
                    rfc: rfc.toUpperCase(),
                    nombre_comercial: proveedor_cliente_nombre || rfc,
                    razon_social: proveedor_cliente_nombre || rfc,
                    empresa_id: empresaId
                  })
                  .select('id')
                  .single();
                if (errP) throw errP;
                proveedorId = newProv.id;
              }
            }
            
            insertPayload = {
              folio_factura: folioStr,
              uuid_fiscal: uuid.toUpperCase(),
              monto: total,
              subtotal: subtotal || total,
              iva_acreditable: globalIva,
              xml_url: xmlUrl,
              fecha_gasto: fecha_emision,
              empresa_id: empresaId,
              concepto: `Gasto por factura XML (UUID: ${uuid.substring(0, 8)})`,
              registrado_por: staffId,
              proveedor_id: proveedorId,
              forma_pago_id: formaPagoId,
              estatus_factura_id: defaultEstatusId,
              estatus_facturado: true,
              metodo_pago: metodoPago,
              fecha_timbrado: fechaTimbrado || null
            };
          } else {
            let empresaId = '';
            try {
              const sesionGuardada = localStorage.getItem('seimenjo_session');
              if (sesionGuardada) {
                const datosSesion = JSON.parse(sesionGuardada);
                empresaId = datosSesion.empresa_id;
              }
            } catch (e) {
              console.error('Error reading active company from localStorage:', e);
            }

            if (!empresaId) {
              empresaId = user.user_metadata?.empresa_id;
            }

            if (!empresaId) {
              throw new Error('No se pudo identificar la empresa activa en tu sesión.');
            }

            // Buscar o crear cliente por RFC
            let clienteId = null;
            if (rfc) {
              const { data: cli } = await supabase
                .from('clientes')
                .select('id')
                .eq('rfc', rfc.toUpperCase())
                .eq('empresa_id', empresaId)
                .maybeSingle();

              if (cli) {
                clienteId = cli.id;
              } else {
                const { data: newCli, error: errC } = await supabase
                  .from('clientes')
                  .insert({
                    rfc: rfc.toUpperCase(),
                    nombre_local: proveedor_cliente_nombre || 'CLIENTE DESCONOCIDO',
                    telefono: '0000000000',
                    es_anonimo: false,
                    empresa_id: empresaId
                  })
                  .select('id')
                  .single();
                if (errC) throw errC;
                clienteId = newCli.id;
              }
            }

            insertPayload = {
              serie_folio: folioStr,
              uuid_fiscal: uuid.toUpperCase(),
              total: total,
              subtotal: subtotal || total,
              iva_trasladado: globalIva,
              xml_url: xmlUrl,
              fecha_emision: fecha_emision,
              cliente_id: clienteId,
              forma_pago_id: formaPagoId,
              estatus_factura_id: defaultEstatusId,
              uso_cfdi_clave: usoCfdi || 'G03',
              empresa_id: empresaId,
              fecha_timbrado: fechaTimbrado || null
            };
          }

          // Verificar duplicados por UUID fiscal antes de insertar
          if (insertPayload.uuid_fiscal) {
            const { data: duplicate } = await supabase
              .from(tableStr)
              .select('id')
              .ilike('uuid_fiscal', insertPayload.uuid_fiscal)
              .maybeSingle();
            if (duplicate) {
              nuevosResultados.push({
                nombre: file.name,
                estatus: 'error',
                mensaje: `Esta factura ya está registrada (UUID: ${insertPayload.uuid_fiscal}).`
              });
              continue;
            }
          }

          const { error: dbError } = await supabase.from(tableStr).insert([insertPayload]);
          if (dbError) throw dbError;
          nuevosResultados.push({ nombre: file.name, estatus: 'ok' });

        } catch (err: any) {
          console.error(err);
          nuevosResultados.push({ nombre: file.name, estatus: 'error', mensaje: err.message || 'Error de procesamiento' });
        }
      }
    } catch (gErr: any) {
      console.error(gErr);
      nuevosResultados.push({ nombre: 'General', estatus: 'error', mensaje: gErr.message || 'Error de sesión' });
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
