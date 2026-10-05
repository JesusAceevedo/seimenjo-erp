'use client';
import React, { useState, useRef } from 'react';
import { UploadCloud, X, FileText, CheckCircle, AlertTriangle, FileCode } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { consultarSatYActualizarCfdi } from '../actions';

interface CargaXmlMasivaModalProps {
  onClose: () => void;
  onSuccess: () => void;
  tipo: 'gasto' | 'venta';
  empresaRfc?: string | null;
}

function getFileBaseName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  const base = lastDot !== -1 ? fileName.substring(0, lastDot) : fileName;
  return base.trim().toLowerCase();
}

export default function CargaXmlMasivaModal({ onClose, onSuccess, tipo, empresaRfc }: CargaXmlMasivaModalProps) {
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => {
        const n = f.name.toLowerCase();
        return n.endsWith('.xml') || n.endsWith('.pdf');
      });
      setArchivos(prev => {
        const existingKeys = new Set(prev.map(f => `${f.name.toLowerCase()}_${f.size}`));
        const uniqueNewFiles = files.filter(f => !existingKeys.has(`${f.name.toLowerCase()}_${f.size}`));
        return [...prev, ...uniqueNewFiles];
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).filter(f => {
        const n = f.name.toLowerCase();
        return n.endsWith('.xml') || n.endsWith('.pdf');
      });
      setArchivos(prev => {
        const existingKeys = new Set(prev.map(f => `${f.name.toLowerCase()}_${f.size}`));
        const uniqueNewFiles = files.filter(f => !existingKeys.has(`${f.name.toLowerCase()}_${f.size}`));
        return [...prev, ...uniqueNewFiles];
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const procesarArchivos = async () => {
    const xmlFiles = archivos.filter(f => f.name.toLowerCase().endsWith('.xml'));
    const pdfFiles = archivos.filter(f => f.name.toLowerCase().endsWith('.pdf'));

    if (xmlFiles.length === 0 && pdfFiles.length === 0) return;
    setProcesando(true);
    setResultados([]);

    const nuevosResultados: any[] = [];
    const tableStr = tipo === 'gasto' ? 'gastos' : 'facturas_clientes';

    // Mapa de PDFs disponibles por nombre base
    const pdfMap = new Map<string, File>();
    for (const p of pdfFiles) {
      pdfMap.set(getFileBaseName(p.name), p);
    }
    const usedPdfNames = new Set<string>();

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
      const { data: formasPagoData } = await supabase.from('formas_pago').select('id, nombre, codigo');
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

      // Obtener empresaId activo
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

      // Obtener RFC de la empresa activa para validación estricta
      let activeEmpresaRfc = (empresaRfc || '').trim().toUpperCase();
      if (!activeEmpresaRfc && empresaId) {
        const { data: empData } = await supabase
          .from('empresas')
          .select('rfc')
          .eq('id', empresaId)
          .maybeSingle();
        if (empData?.rfc) activeEmpresaRfc = empData.rfc.trim().toUpperCase();
      }

      // Obtener periodos cerrados de cierres_mensuales
      const { data: cierresData } = await supabase
        .from('cierres_mensuales')
        .select('mes, estatus')
        .eq('empresa_id', empresaId);

      const periodosCerrados = new Set(
        (cierresData || [])
          .filter(c => c.estatus === 'cerrado_definitivo')
          .map(c => c.mes)
      );

      // Procesar cada archivo XML
      for (const file of xmlFiles) {
        let insertPayload: any = {};
        try {
          const baseName = getFileBaseName(file.name);
          let matchingPdf = pdfMap.get(baseName);

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

          const isNomina = tipoDeComprobante === 'N' || 
            xmlDoc.getElementsByTagName('nomina12:Nomina').length > 0 || 
            xmlDoc.getElementsByTagName('cfdi:Nomina').length > 0 ||
            xmlDoc.getElementsByTagName('Nomina').length > 0;

          if (tipo === 'venta' && isNomina) {
            nuevosResultados.push({
              nombre: file.name,
              estatus: 'error',
              mensaje: 'Este comprobante es un recibo de Nómina (Tipo N). Los recibos de nómina corresponden a Egresos / Gastos de la empresa, no a facturas de venta.'
            });
            continue;
          }

          if (tipo === 'venta' && tipoDeComprobante !== 'I' && tipoDeComprobante !== 'P') {
            nuevosResultados.push({
              nombre: file.name,
              estatus: 'error',
              mensaje: `Tipo de comprobante '${tipoDeComprobante}' no válido para ventas. Sólo se permiten facturas de Ingreso (I) o Pagos (P).`
            });
            continue;
          }

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

          // Validación estricta de RFC por tipo de factura (SAT multi-empresa)
          if (activeEmpresaRfc) {
            if (tipo === 'gasto') {
              if (isNomina) {
                // En recibos de nómina, la empresa activa DEBE ser el Emisor (el patrón)
                const cleanEmisorRfc = (emisorRfc || '').trim().toUpperCase();
                if (cleanEmisorRfc && cleanEmisorRfc !== activeEmpresaRfc) {
                  nuevosResultados.push({
                    nombre: file.name,
                    estatus: 'error',
                    mensaje: `El recibo de nómina no pertenece a esta empresa. El RFC emisor (${emisorRfc}) no coincide con el RFC oficial (${activeEmpresaRfc}).`
                  });
                  continue;
                }
              } else {
                // Para egresos regulares, la empresa activa DEBE ser el Receptor del comprobante
                const cleanReceptorRfc = (rfcReceptor || '').trim().toUpperCase();
                if (cleanReceptorRfc && cleanReceptorRfc !== activeEmpresaRfc) {
                  nuevosResultados.push({
                    nombre: file.name,
                    estatus: 'error',
                    mensaje: `El XML no pertenece a esta empresa. El RFC receptor (${rfcReceptor}) no coincide con el RFC oficial de la empresa (${activeEmpresaRfc}).`
                  });
                  continue;
                }
              }
            } else {
              // Para ingresos (ventas), la empresa activa DEBE ser el Emisor del comprobante
              const cleanEmisorRfc = (emisorRfc || '').trim().toUpperCase();
              if (cleanEmisorRfc && cleanEmisorRfc !== activeEmpresaRfc) {
                nuevosResultados.push({
                  nombre: file.name,
                  estatus: 'error',
                  mensaje: `El XML no pertenece a esta empresa. El RFC emisor (${emisorRfc}) no coincide con el RFC oficial de la empresa (${activeEmpresaRfc}).`
                });
                continue;
              }
            }
          }

          // 4. Complemento -> TimbreFiscalDigital
          const timbre = xmlDoc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] || xmlDoc.getElementsByTagName('TimbreFiscalDigital')[0];
          const uuid = timbre?.getAttribute('UUID') || '';
          const fechaTimbrado = timbre?.getAttribute('FechaTimbrado') || '';

          if (!uuid) {
            nuevosResultados.push({ nombre: file.name, estatus: 'error', mensaje: 'No se detectó el UUID del Timbre Fiscal Digital.' });
            continue;
          }

          // Buscar PDF por UUID si no se encontró por nombre de archivo
          if (!matchingPdf && uuid) {
            const uuidClean = uuid.toLowerCase();
            matchingPdf = pdfFiles.find(p => {
              const pBase = getFileBaseName(p.name);
              return pBase === uuidClean || pBase.includes(uuidClean);
            });
          }

          if (matchingPdf) {
            usedPdfNames.add(matchingPdf.name);
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

          const rfc = tipo === 'gasto' ? (isNomina ? rfcReceptor : emisorRfc) : rfcReceptor;
          const proveedor_cliente_nombre = tipo === 'gasto' ? (isNomina ? (nombreReceptor || 'Personal Nómina') : emisorNombre) : nombreReceptor;
          const folioStr = folio ? `${serie}${folio}`.trim() : (serie ? serie.trim() : `SF-${Math.floor(Math.random() * 1000)}`);
          const fecha_emision = fecha ? fecha.split('T')[0] : new Date().toISOString().split('T')[0];

          // Mapear la forma de pago para esta factura
          let formaPagoId = null;
          let metodoPago = '99'; // fallback por defecto
          if (formasPagoData && formasPagoData.length > 0) {
            const code = formaPagoCode ? formaPagoCode.trim().padStart(2, '0') : '03';
            const match = formasPagoData.find(f => f.codigo === code);
            if (match) {
              formaPagoId = match.id;
            } else {
              formaPagoId = formasPagoData.find(f => f.codigo === '99')?.id || formasPagoData[0].id;
            }
            metodoPago = mapFormaPagoCodeToMetodo(code);
          }

          const timestamp = Date.now();

          // 1. Subir XML al storage
          const fileExt = file.name.split('.').pop() || 'xml';
          const fileName = `${tipo}s/${timestamp}_${uuid}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('facturas').upload(fileName, file);

          let xmlUrl = '';
          if (!uploadError) {
            xmlUrl = fileName;
          } else {
            console.error('Error al subir XML al storage:', uploadError);
          }

          // 2. Subir PDF al storage si existe archivo emparejado con el mismo nombre
          let pdfUrl = '';
          if (matchingPdf) {
            const pdfExt = matchingPdf.name.split('.').pop() || 'pdf';
            const pdfFileName = `${tipo}s/${timestamp}_${uuid}.${pdfExt}`;
            const { error: pdfUploadError } = await supabase.storage.from('facturas').upload(pdfFileName, matchingPdf);
            if (!pdfUploadError) {
              pdfUrl = pdfFileName;
            } else {
              console.error('Error al subir PDF al storage:', pdfUploadError);
            }
          }

          // 3. Insertar en base de datos
          insertPayload = {};
          let ambiguedadMensaje = '';

          if (tipo === 'gasto') {
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
              pdf_url: pdfUrl || null,
              fecha_gasto: fecha_emision,
              empresa_id: empresaId,
              concepto: isNomina ? `Nómina - ${proveedor_cliente_nombre}` : `Gasto por factura XML (UUID: ${uuid.substring(0, 8)})`,
              registrado_por: staffId,
              proveedor_id: proveedorId,
              forma_pago_id: formaPagoId,
              estatus_factura_id: defaultEstatusId,
              estatus_facturado: true,
              metodo_pago: metodoPago,
              fecha_timbrado: fechaTimbrado || null,
              es_deducible: true
            };
          } else {
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

            // Buscar pedido candidato único para vincular automáticamente si no hay ambigüedad
            let candidatePedido: any = null;

            if (clienteId && total > 0) {
              const { data: candidates } = await supabase
                .from('pedidos')
                .select('id, precio_total, folio_factura, movimiento_bancario_id')
                .eq('empresa_id', empresaId)
                .eq('cliente_id', clienteId)
                .is('folio_factura', null)
                .gte('precio_total', total - 0.05)
                .lte('precio_total', total + 0.05);

              if (candidates && candidates.length === 1) {
                candidatePedido = candidates[0];
              } else if (candidates && candidates.length > 1) {
                ambiguedadMensaje = ` (Factura subida: Se detectaron ${candidates.length} pedidos con el mismo monto para este cliente. Favor de vincular manualmente).`;
              }
            }

            insertPayload = {
              serie_folio: folioStr,
              uuid_fiscal: uuid.toUpperCase(),
              total: total,
              subtotal: subtotal || total,
              iva_trasladado: globalIva,
              xml_url: xmlUrl,
              pdf_url: pdfUrl || null,
              fecha_emision: fecha_emision,
              cliente_id: clienteId,
              pedido_id: candidatePedido ? candidatePedido.id : null,
              forma_pago_id: formaPagoId,
              estatus_factura_id: defaultEstatusId,
              uso_cfdi_clave: usoCfdi || 'G03',
              empresa_id: empresaId,
              fecha_timbrado: fechaTimbrado || null
            };
          }

          // 1. Validar que el periodo contable no esté cerrado definitivamente
          const mesFactura = fecha_emision.substring(0, 7); // 'YYYY-MM'
          if (periodosCerrados.has(mesFactura)) {
            nuevosResultados.push({
              nombre: file.name,
              estatus: 'error',
              mensaje: `El periodo contable ${mesFactura} se encuentra cerrado de manera definitiva. No se pueden subir facturas para este mes.`
            });
            continue;
          }

          // 2. Consultar si el CFDI está vigente o cancelado en el SAT
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || '';

          const satRes = await consultarSatYActualizarCfdi(
            tipo,
            emisorRfc,
            rfcReceptor,
            total,
            uuid,
            token
          );

          if (!satRes.success) {
            console.error('Error al consultar SAT:', satRes.error);
          }

          // Si el CFDI está cancelado en el SAT
          if (satRes.estado === 'Cancelado') {
            const { data: duplicate } = await supabase
              .from(tableStr)
              .select('id, pdf_url')
              .ilike('uuid_fiscal', uuid)
              .maybeSingle();

            if (duplicate) {
              if (pdfUrl && !duplicate.pdf_url) {
                await supabase.from(tableStr).update({ pdf_url: pdfUrl }).eq('id', duplicate.id);
              }
              // Ya existía en la BD y fue actualizada a Cancelada por el Server Action (liberando conciliaciones)
              nuevosResultados.push({
                nombre: file.name,
                estatus: 'error',
                mensaje: `La factura ya existía, pero se detectó que está CANCELADA en el SAT. Se ha actualizado su estatus a 'Cancelado' y se liberó la conciliación bancaria asociada.${pdfUrl ? ' (PDF adjuntado)' : ''}`
              });
              continue;
            } else {
              // No existía, la insertamos directamente con montos en 0 y estatus cancelado
              let canceladoEstatusId = null;
              const { data: canceladoEstatus } = await supabase
                .from('estatus_factura')
                .select('id')
                .ilike('nombre', 'Cancelado')
                .maybeSingle();

              if (canceladoEstatus) {
                canceladoEstatusId = canceladoEstatus.id;
              } else {
                const { data: newStatus } = await supabase
                  .from('estatus_factura')
                  .insert({ nombre: 'Cancelado' })
                  .select('id')
                  .single();
                if (newStatus) canceladoEstatusId = newStatus.id;
              }

              if (tipo === 'gasto') {
                insertPayload.monto = 0;
                insertPayload.subtotal = 0;
                insertPayload.iva_acreditable = 0;
                insertPayload.estatus_facturado = false;
                insertPayload.estatus_factura_id = canceladoEstatusId;
                insertPayload.pdf_url = pdfUrl || null;
              } else {
                insertPayload.total = 0;
                insertPayload.subtotal = 0;
                insertPayload.iva_trasladado = 0;
                insertPayload.estatus_factura_id = canceladoEstatusId;
                insertPayload.pdf_url = pdfUrl || null;
              }

              const { error: dbError } = await supabase.from(tableStr).insert([insertPayload]);
              if (dbError) throw dbError;

              nuevosResultados.push({
                nombre: file.name,
                estatus: 'ok',
                mensaje: `Factura guardada directamente con estatus 'Cancelado' debido a que se encuentra cancelada en el SAT.${pdfUrl ? ' (Con PDF registrado)' : ''}`
              });
              continue;
            }
          }

          // Si el CFDI está vigente, verificar duplicidad normal
          if (insertPayload.uuid_fiscal) {
            const { data: duplicate } = await supabase
              .from(tableStr)
              .select('id, pdf_url')
              .ilike('uuid_fiscal', insertPayload.uuid_fiscal)
              .maybeSingle();

            if (duplicate) {
              if (pdfUrl && !duplicate.pdf_url) {
                // Factura ya existía pero no tenía PDF; la vinculamos y actualizamos ahora
                await supabase
                  .from(tableStr)
                  .update({ pdf_url: pdfUrl })
                  .eq('id', duplicate.id);

                if (tipo === 'venta') {
                  const { data: fcFull } = await supabase
                    .from('facturas_clientes')
                    .select('pedido_id')
                    .eq('id', duplicate.id)
                    .single();
                  if (fcFull?.pedido_id) {
                    await supabase.from('pedidos').update({ pdf_url: pdfUrl }).eq('id', fcFull.pedido_id);
                    const { data: pedData } = await supabase.from('pedidos').select('movimiento_bancario_id').eq('id', fcFull.pedido_id).single();
                    if (pedData?.movimiento_bancario_id) {
                      await supabase.from('movimientos_bancarios').update({ pdf_factura_url: pdfUrl }).eq('id', pedData.movimiento_bancario_id);
                    }
                  }
                }

                nuevosResultados.push({
                  nombre: file.name,
                  estatus: 'ok',
                  mensaje: `Factura ya existía en sistema (UUID: ${insertPayload.uuid_fiscal.substring(0, 8)}). Se adjuntó exitosamente su archivo PDF.`
                });
                continue;
              }

              nuevosResultados.push({
                nombre: file.name,
                estatus: 'error',
                mensaje: `Esta factura ya está registrada (UUID: ${insertPayload.uuid_fiscal}) y se encuentra VIGENTE en el SAT.`
              });
              continue;
            }
          }

          const { error: dbError } = await supabase.from(tableStr).insert([insertPayload]);
          if (dbError) throw dbError;

          // Sincronizar folio en pedido y documentos en movimiento bancario si hubo vinculación
          if (tipo === 'venta' && insertPayload.pedido_id) {
            const folioStr = insertPayload.serie_folio || (insertPayload.uuid_fiscal ? `UUID:${insertPayload.uuid_fiscal.substring(0, 8)}` : '');
            await supabase.from('pedidos').update({
              folio_factura: folioStr,
              xml_url: insertPayload.xml_url || null,
              pdf_url: insertPayload.pdf_url || null
            }).eq('id', insertPayload.pedido_id);

            // Obtener pedido para verificar si tiene movimiento bancario
            const { data: pData } = await supabase.from('pedidos').select('movimiento_bancario_id').eq('id', insertPayload.pedido_id).single();
            if (pData?.movimiento_bancario_id) {
              await supabase.from('movimientos_bancarios').update({
                xml_url: insertPayload.xml_url || null,
                pdf_factura_url: insertPayload.pdf_url || null,
                visible_ingresos: true
              }).eq('id', pData.movimiento_bancario_id);
            }
          }

          const msgParts: string[] = [];
          if (matchingPdf && pdfUrl) {
            msgParts.push('XML y PDF registrados');
          } else if (matchingPdf && !pdfUrl) {
            msgParts.push('XML registrado (error al subir PDF)');
          } else {
            msgParts.push('XML registrado');
          }

          if (insertPayload?.pedido_id) {
            msgParts.push('Vinculado al Pedido');
          } else if (ambiguedadMensaje) {
            msgParts.push(ambiguedadMensaje.trim());
          }

          nuevosResultados.push({
            nombre: file.name,
            estatus: 'ok',
            mensaje: msgParts.join(' • ')
          });

        } catch (err: any) {
          console.error('Error procesando archivo:', file.name, err);
          let detailedMessage = err?.message || err?.details || err?.error_description || (typeof err === 'object' ? JSON.stringify(err) : String(err)) || 'Error de procesamiento';
          if (detailedMessage.includes('gastos_uuid_fiscal_key') || (err?.code === '23505' && detailedMessage.includes('uuid_fiscal'))) {
            detailedMessage = `Esta factura ya está registrada en la base de datos (UUID duplicado: ${insertPayload?.uuid_fiscal || 'existente'}).`;
          }
          nuevosResultados.push({ nombre: file.name, estatus: 'error', mensaje: detailedMessage });
        }
      }

      // Procesar PDFs que no coincidieron con ningún XML en esta misma carga
      const leftoverPdfs = pdfFiles.filter(p => !usedPdfNames.has(p.name));
      for (const pdf of leftoverPdfs) {
        try {
          const base = getFileBaseName(pdf.name);
          const isLikelyUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(base);
          let existingDoc: any = null;

          if (isLikelyUuid) {
            const { data } = await supabase
              .from(tableStr)
              .select('id, uuid_fiscal, pdf_url')
              .eq('empresa_id', empresaId)
              .ilike('uuid_fiscal', base)
              .maybeSingle();
            existingDoc = data;
          } else {
            const folioCol = tipo === 'gasto' ? 'folio_factura' : 'serie_folio';
            const { data } = await supabase
              .from(tableStr)
              .select(`id, uuid_fiscal, pdf_url, ${folioCol}`)
              .eq('empresa_id', empresaId)
              .ilike(folioCol, base)
              .maybeSingle();
            existingDoc = data;
          }

          if (existingDoc) {
            if (existingDoc.pdf_url) {
              nuevosResultados.push({
                nombre: pdf.name,
                estatus: 'error',
                mensaje: 'Esta factura ya contaba previamente con un archivo PDF registrado.'
              });
              continue;
            }

            const pdfExt = pdf.name.split('.').pop() || 'pdf';
            const pdfFileName = `${tipo}s/${Date.now()}_${existingDoc.uuid_fiscal || existingDoc.id}.${pdfExt}`;
            const { error: upErr } = await supabase.storage.from('facturas').upload(pdfFileName, pdf);
            if (upErr) throw upErr;

            await supabase.from(tableStr).update({ pdf_url: pdfFileName }).eq('id', existingDoc.id);

            if (tipo === 'venta') {
              const { data: fcData } = await supabase.from('facturas_clientes').select('pedido_id').eq('id', existingDoc.id).single();
              if (fcData?.pedido_id) {
                await supabase.from('pedidos').update({ pdf_url: pdfFileName }).eq('id', fcData.pedido_id);
                const { data: pData } = await supabase.from('pedidos').select('movimiento_bancario_id').eq('id', fcData.pedido_id).single();
                if (pData?.movimiento_bancario_id) {
                  await supabase.from('movimientos_bancarios').update({ pdf_factura_url: pdfFileName }).eq('id', pData.movimiento_bancario_id);
                }
              }
            }

            nuevosResultados.push({
              nombre: pdf.name,
              estatus: 'ok',
              mensaje: `PDF asociado a factura existente (${existingDoc.uuid_fiscal ? existingDoc.uuid_fiscal.substring(0, 8) : existingDoc.id}).`
            });
          } else {
            nuevosResultados.push({
              nombre: pdf.name,
              estatus: 'error',
              mensaje: 'No se encontró archivo XML con el mismo nombre ni factura registrada previamente en el sistema con este nombre/folio.'
            });
          }
        } catch (err: any) {
          nuevosResultados.push({
            nombre: pdf.name,
            estatus: 'error',
            mensaje: `Error al asociar PDF: ${err?.message || 'Error desconocido'}`
          });
        }
      }

    } catch (gErr: any) {
      console.error('Error general en procesarArchivos:', gErr);
      let detailedGeneralMessage = gErr?.message || gErr?.details || (typeof gErr === 'object' ? JSON.stringify(gErr) : String(gErr)) || 'Error de sesión';
      if (detailedGeneralMessage.includes('gastos_uuid_fiscal_key') || gErr?.code === '23505') {
        detailedGeneralMessage = 'Se intentó registrar una factura o gasto cuyo UUID fiscal ya existe en la base de datos.';
      }
      nuevosResultados.push({ nombre: 'General', estatus: 'error', mensaje: detailedGeneralMessage });
    }

    setResultados(nuevosResultados);
    setProcesando(false);
    onSuccess();
  };

  const xmlFiles = archivos.filter(f => f.name.toLowerCase().endsWith('.xml'));
  const pdfFiles = archivos.filter(f => f.name.toLowerCase().endsWith('.pdf'));
  const pdfBaseSet = new Set(pdfFiles.map(f => getFileBaseName(f.name)));
  const pairedCount = xmlFiles.filter(f => pdfBaseSet.has(getFileBaseName(f.name))).length;
  const standalonePdfs = pdfFiles.filter(p => !xmlFiles.some(x => getFileBaseName(x.name) === getFileBaseName(p.name)));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/20">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <UploadCloud className="text-amber-500" /> Carga Masiva de Facturas (XML / PDF)
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {tipo === 'gasto' 
                ? 'Sube las facturas de tus proveedores en XML y PDF (se emparejan automáticamente por nombre).' 
                : 'Sube las facturas emitidas a clientes en XML y PDF (se emparejan automáticamente por nombre).'}
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
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
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
                  accept=".xml,.pdf"
                  className="hidden"
                  onChange={handleChange}
                />
                <div className="w-16 h-16 bg-white dark:bg-gray-950 shadow-sm border border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-center mb-4 text-gray-400 dark:text-gray-500">
                  <UploadCloud size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-1">
                  Arrastra tus archivos XML y PDF aquí
                </h3>
                <p className="text-sm text-gray-500 max-w-md">
                  O haz clic para explorar tu equipo. Si tus archivos XML y PDF tienen el mismo nombre, se vincularán automáticamente al registrarlos.
                </p>
              </div>

              {/* Lista previa */}
              {archivos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <span className="font-bold text-amber-600 dark:text-amber-400">{xmlFiles.length} XML</span>
                      <span>•</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{pairedCount} con PDF</span>
                      {standalonePdfs.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-purple-600 dark:text-purple-400">{standalonePdfs.length} PDF sin XML</span>
                        </>
                      )}
                    </span>
                    <button onClick={() => setArchivos([])} className="text-red-500 hover:underline text-xs">Limpiar lista</button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {/* Tarjetas de XMLs */}
                    {xmlFiles.map((xml, i) => {
                      const matchingPdf = pdfFiles.find(p => getFileBaseName(p.name) === getFileBaseName(xml.name));
                      return (
                        <div key={`xml-${i}`} className="flex items-center gap-2.5 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
                          <FileCode size={20} className="text-amber-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{xml.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {matchingPdf ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 truncate max-w-[170px]">
                                  <FileText size={10} /> + PDF emparejado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-400">
                                  Solo XML
                                </span>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setArchivos(prev => prev.filter(f => f !== xml && (matchingPdf ? f !== matchingPdf : true)));
                            }} 
                            className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0 transition-colors"
                            title="Quitar comprobante"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}

                    {/* Tarjetas de PDFs sin XML en el lote */}
                    {standalonePdfs.map((pdf, i) => (
                      <div key={`pdf-${i}`} className="flex items-center gap-2.5 p-3 bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-900/30 rounded-xl">
                        <FileText size={20} className="text-purple-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{pdf.name}</p>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 mt-0.5">
                            PDF para factura previa
                          </span>
                        </div>
                        <button 
                          onClick={() => setArchivos(prev => prev.filter(f => f !== pdf))} 
                          className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0 transition-colors"
                          title="Quitar PDF"
                        >
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
                      {res.mensaje && <p className={`text-[10px] mt-0.5 ${res.estatus === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'}`}>{res.mensaje}</p>}
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
                ) : xmlFiles.length > 0 ? (
                  <>Procesar {xmlFiles.length} Factura{xmlFiles.length > 1 ? 's' : ''} {pdfFiles.length > 0 ? `(${pairedCount} con PDF)` : ''}</>
                ) : (
                  <>Asociar {pdfFiles.length} PDF{pdfFiles.length > 1 ? 's' : ''}</>
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

function mapFormaPagoCodeToMetodo(code: string): string {
  return code ? code.trim().padStart(2, '0') : '99';
}

