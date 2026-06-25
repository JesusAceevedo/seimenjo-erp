'use client';
import React, { useState } from 'react';
import { X, UploadCloud, Link as LinkIcon, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';

const SAT_FORMAS_PAGO = [
  { codigo: '01', nombre: 'Efectivo' },
  { codigo: '02', nombre: 'Cheque nominativo' },
  { codigo: '03', nombre: 'Transferencia electrónica' },
  { codigo: '04', nombre: 'Tarjeta de crédito' },
  { codigo: '05', nombre: 'Monedero electrónico' },
  { codigo: '06', nombre: 'Dinero electrónico' },
  { codigo: '08', nombre: 'Vales de despensa' },
  { codigo: '12', nombre: 'Dación en pago' },
  { codigo: '13', nombre: 'Pago por subrogación' },
  { codigo: '14', nombre: 'Pago por consignación' },
  { codigo: '15', nombre: 'Condonación' },
  { codigo: '17', nombre: 'Compensación' },
  { codigo: '23', nombre: 'Novación' },
  { codigo: '24', nombre: 'Confusión' },
  { codigo: '25', nombre: 'Remisión de deuda' },
  { codigo: '26', nombre: 'Prescripción o caducidad' },
  { codigo: '27', nombre: 'A satisfacción del acreedor' },
  { codigo: '28', nombre: 'Tarjeta de débito' },
  { codigo: '29', nombre: 'Tarjeta de servicios' },
  { codigo: '30', nombre: 'Aplicación de anticipos' },
  { codigo: '31', nombre: 'Intermediario pagos' },
  { codigo: '99', nombre: 'Por definir' }
];

interface CargaManualModalProps {
  onClose: () => void;
  onSuccess: () => void;
  tipo: 'gasto' | 'venta';
  registroId?: string | null;
}

export default function CargaManualModal({ onClose, onSuccess, tipo, registroId }: CargaManualModalProps) {
  const [procesando, setProcesando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState('');
  const [verTodos, setVerTodos] = useState(false);

  // Catálogos
  const [formasPago, setFormasPago] = useState<{ id: string; nombre: string; codigo?: string | null }[]>([]);
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>([]);

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

  const [existingDocs, setExistingDocs] = useState<{ xml: boolean; pdf: boolean; ticket: boolean }>({
    xml: false,
    pdf: false,
    ticket: false
  });

  // Campos de captura manual / pre-llenados
  const [uuidFiscal, setUuidFiscal] = useState<string | null>(null);
  const [fechaTimbrado, setFechaTimbrado] = useState<string | null>(null);
  const [usoCfdi, setUsoCfdi] = useState<string>('G03');
  const [esDeducible, setEsDeducible] = useState(true);

  const [manualFields, setManualFields] = useState({
    fecha: new Date().toISOString().split('T')[0],
    rfc: '',
    nombre: '',
    folio: '',
    subtotal: '',
    iva: '',
    total: '',
    metodoPagoId: '',
    categoria_id: '',
    concepto: ''
  });

  // Cargar catálogos e información inicial
  React.useEffect(() => {
    const fetchCatalogos = async () => {
      const { data } = await supabase.from('formas_pago').select('id, nombre, codigo').order('nombre');
      if (data) {
        setFormasPago(data);
        if (!registroId && data.length > 0) {
          const tMatch = data.find(f => (f.codigo === '03') || f.nombre.toLowerCase().includes('transferencia'));
          setManualFields(prev => ({
            ...prev,
            metodoPagoId: tMatch ? tMatch.id : data[0].id
          }));
        }
      }
      
      const { data: catData } = await supabase.from('categorias_gasto').select('id, nombre').order('nombre');
      if (catData) {
        setCategorias(catData);
      }
    };
    fetchCatalogos();

    if (registroId) {
      const fetchDocs = async () => {
        const tableStr = tipo === 'gasto' ? 'gastos' : 'facturas_clientes';
        const { data, error } = await supabase
          .from(tableStr)
          .select('*, proveedores(*), clientes(*)')
          .eq('id', registroId)
          .maybeSingle();
        
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

          // Pre-llenar campos
          setManualFields({
            fecha: (tipo === 'gasto' ? data.fecha_gasto : data.fecha_emision) || new Date().toISOString().split('T')[0],
            rfc: (tipo === 'gasto' ? data.proveedores?.rfc : data.clientes?.rfc) || '',
            nombre: (tipo === 'gasto' ? data.proveedores?.nombre_comercial : data.clientes?.nombre_local) || '',
            folio: (tipo === 'gasto' ? data.folio_factura : data.serie_folio) || '',
            subtotal: (data.subtotal ?? '').toString(),
            iva: (tipo === 'gasto' ? data.iva_acreditable : data.iva_trasladado ?? '').toString(),
            total: (tipo === 'gasto' ? data.monto : data.total ?? '').toString(),
            metodoPagoId: data.forma_pago_id || '',
            categoria_id: data.categoria_id || '',
            concepto: data.concepto || ''
          });
          setUuidFiscal(data.uuid_fiscal || null);
          setFechaTimbrado(data.fecha_timbrado || null);
          setUsoCfdi(data.uso_cfdi_clave || 'G03');
          setEsDeducible(data.es_deducible !== false);
        }
      };
      fetchDocs();
    }
  }, [registroId, tipo]);

  const handleModeToggle = (docType: 'xml' | 'pdf' | 'ticket', mode: 'upload' | 'link') => {
    setFileMode(prev => ({ ...prev, [docType]: mode }));
  };

  // Procesar archivo XML seleccionado para auto-completar los campos manuales
  const handleFileChange = async (docType: 'xml' | 'pdf' | 'ticket', file: File | null) => {
    setFiles(prev => ({ ...prev, [docType]: file }));
    if (docType === 'xml' && file) {
      try {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'application/xml');

        const parseErrorNode = xmlDoc.getElementsByTagName('parsererror');
        if (parseErrorNode.length > 0) {
          throw new Error('El archivo no tiene un formato XML válido.');
        }

        const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0] || xmlDoc.getElementsByTagName('Comprobante')[0];
        if (!comprobante) {
          throw new Error('No es un CFDI de factura del SAT válido (Falta elemento cfdi:Comprobante).');
        }

        const tipoDeComprobante = comprobante.getAttribute('TipoDeComprobante') || comprobante.getAttribute('tipoDeComprobante') || 'I';

        let total = parseFloat(comprobante.getAttribute('Total') || comprobante.getAttribute('total') || '0');
        let subtotal = parseFloat(comprobante.getAttribute('SubTotal') || comprobante.getAttribute('subtotal') || '0');
        let fecha = comprobante.getAttribute('Fecha') || comprobante.getAttribute('fecha') || '';
        let serie = comprobante.getAttribute('Serie') || comprobante.getAttribute('serie') || '';
        let folio = comprobante.getAttribute('Folio') || comprobante.getAttribute('folio') || '';
        let formaPagoCode = comprobante.getAttribute('FormaPago') || comprobante.getAttribute('formaPago') || '';

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
        }

        const emisor = xmlDoc.getElementsByTagName('cfdi:Emisor')[0] || xmlDoc.getElementsByTagName('Emisor')[0];
        const emisorRfc = emisor?.getAttribute('Rfc') || emisor?.getAttribute('rfc') || '';
        const emisorNombre = emisor?.getAttribute('Nombre') || emisor?.getAttribute('nombre') || '';

        const receptor = xmlDoc.getElementsByTagName('cfdi:Receptor')[0] || xmlDoc.getElementsByTagName('Receptor')[0];
        const rfcReceptor = receptor?.getAttribute('Rfc') || receptor?.getAttribute('rfc') || '';
        const nombreReceptor = receptor?.getAttribute('Nombre') || receptor?.getAttribute('nombre') || '';
        const usoCfdiVal = receptor?.getAttribute('UsoCFDI') || receptor?.getAttribute('usoCFDI') || 'G03';

        const timbre = xmlDoc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] || xmlDoc.getElementsByTagName('TimbreFiscalDigital')[0];
        const uuid = timbre?.getAttribute('UUID') || '';
        const fechaTimbradoVal = timbre?.getAttribute('FechaTimbrado') || '';

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

        let mappedFpId = '';
        if (formasPago.length > 0) {
          const code = formaPagoCode ? formaPagoCode.trim().padStart(2, '0') : '03';
          const match = formasPago.find(f => f.codigo === code);
          mappedFpId = match ? match.id : (formasPago.find(f => f.codigo === '99')?.id || formasPago[0].id);
        }

        setUuidFiscal(uuid || null);
        setFechaTimbrado(fechaTimbradoVal || null);
        setUsoCfdi(usoCfdiVal);

        setManualFields(prev => ({
          ...prev,
          fecha: fecha ? fecha.split('T')[0] : prev.fecha,
          rfc: tipo === 'gasto' ? emisorRfc : rfcReceptor,
          nombre: tipo === 'gasto' ? emisorNombre : nombreReceptor,
          folio: folio ? `${serie}${folio}`.trim() : (serie ? serie.trim() : prev.folio),
          subtotal: subtotal.toString(),
          iva: globalIva.toString(),
          total: total.toString(),
          metodoPagoId: mappedFpId || prev.metodoPagoId,
          concepto: tipo === 'gasto'
            ? `Gasto por factura XML (UUID: ${uuid ? uuid.substring(0, 8) : 'S/N'})`
            : prev.concepto
        }));
      } catch (err: any) {
        console.error('Error parsing XML file:', err);
        setErrorGlobal('Error al parsear el archivo XML: ' + err.message);
      }
    }
  };

  const procesarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcesando(true);
    setErrorGlobal('');

    try {
      // Validaciones
      if (!registroId && !manualFields.fecha) {
        throw new Error('Debes proporcionar la fecha de la operación.');
      }
      if (!registroId && !manualFields.total) {
        throw new Error('Debes proporcionar el importe total.');
      }
      if (!registroId && tipo === 'gasto' && !manualFields.concepto) {
        throw new Error('Debes proporcionar el concepto del gasto.');
      }
      if (tipo === 'gasto' && !esDeducible) {
        const hasTicket = (fileMode.ticket === 'upload' && files.ticket) || (fileMode.ticket === 'link' && links.ticket) || existingDocs.ticket;
        if (!hasTicket) {
          throw new Error('Para un gasto no deducible (solo ticket), debes cargar el archivo o enlace del Ticket obligatoriamente.');
        }
      }

      // Subir Archivos a Supabase
      const timestamp = Date.now();
      const basePath = tipo === 'gasto' ? 'gastos/' : 'ventas/';
      let finalXmlUrl = fileMode.xml === 'link' ? links.xml : null;
      let finalPdfUrl = fileMode.pdf === 'link' ? links.pdf : null;
      let finalTicketUrl = fileMode.ticket === 'link' ? links.ticket : null;

      const oldFilesToDelete: { bucket: string; path: string }[] = [];

      const obtenerBucketYPath = (urlOrPath: string): { bucket: string; path: string } | null => {
        if (!urlOrPath) return null;
        if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
          return { bucket: 'facturas', path: urlOrPath };
        }
        try {
          const url = new URL(urlOrPath);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.findIndex(part => part === 'facturas' || part === 'comprobantes');
          if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
            return {
              bucket: pathParts[bucketIndex],
              path: pathParts.slice(bucketIndex + 1).join('/')
            };
          }
        } catch (e) {
          console.error('Error parsing URL:', e);
        }
        return null;
      };

      const uploadFile = async (file: File | null, prefix: string, oldUrlOrPath: string) => {
        if (!file) return null;
        const ext = file.name.split('.').pop();
        const uuidName = uuidFiscal || registroId || 'manual';
        const fileName = `${basePath}${timestamp}_${prefix}_uuid_${uuidName}.${ext}`;
        
        console.log(`Intentando subir al bucket 'facturas': ${fileName}`);
        const { error } = await supabase.storage.from('facturas').upload(fileName, file);
        if (error) {
          console.error('Upload Error:', error);
          throw new Error(`Error al subir ${prefix}: ` + error.message);
        }

        if (oldUrlOrPath) {
          const bucketPath = obtenerBucketYPath(oldUrlOrPath);
          if (bucketPath) {
            oldFilesToDelete.push(bucketPath);
          }
        }
        
        return fileName;
      };

      if (fileMode.xml === 'upload' && files.xml) finalXmlUrl = await uploadFile(files.xml, 'xml', links.xml);
      if (fileMode.pdf === 'upload' && files.pdf) finalPdfUrl = await uploadFile(files.pdf, 'pdf', links.pdf);
      if (fileMode.ticket === 'upload' && files.ticket) finalTicketUrl = await uploadFile(files.ticket, 'ticket', links.ticket);

      const tableStr = tipo === 'gasto' ? 'gastos' : 'facturas_clientes';

      // Guardar en Base de Datos
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Debes iniciar sesión para realizar esta acción.');
      }

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

      if (registroId) {
        // ACTUALIZAR (Adjuntar documentos faltantes o reemplazar existentes)
        const updateData: any = {};
        if (finalXmlUrl !== null) updateData.xml_url = finalXmlUrl;
        if (finalPdfUrl !== null) updateData.pdf_url = finalPdfUrl;
        if (finalTicketUrl !== null) updateData.ticket_url = finalTicketUrl;

        if (Object.keys(updateData).length > 0) {
          const { error } = await supabase.from(tableStr).update(updateData).eq('id', registroId);
          if (error) throw error;
        }
      } else {
        // CREAR NUEVO REGISTRO
        let insertPayload: any = {};

        // Resolver forma_pago_id y metodo_pago para la base de datos (guardando solo código en metodo_pago)
        let formaPagoId: string | null = null;
        let metodoPagoCode = '99';

        const selectedFp = formasPago.find(f => f.id === manualFields.metodoPagoId);
        if (selectedFp) {
          formaPagoId = selectedFp.id;
          metodoPagoCode = selectedFp.codigo || selectedFp.nombre.substring(0, 2) || '99';
        } else if (manualFields.metodoPagoId) {
          // Si no es un ID de la BD, se asume que seleccionaron un código SAT del desglose
          metodoPagoCode = manualFields.metodoPagoId;
          const fallbackFp = formasPago.find(f => f.codigo === '99' || f.nombre.toLowerCase().includes('definir'));
          formaPagoId = fallbackFp ? fallbackFp.id : null;
        }

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

        if (tipo === 'gasto') {
          // Buscar o crear proveedor por RFC
          let proveedorId = null;
          const targetRfc = manualFields.rfc.trim();
          if (targetRfc) {
            const { data: prov } = await supabase
              .from('proveedores')
              .select('id')
              .eq('rfc', targetRfc.toUpperCase())
              .eq('empresa_id', empresaId)
              .maybeSingle();

            if (prov) {
              proveedorId = prov.id;
            } else {
              const { data: newProv, error: errP } = await supabase
                .from('proveedores')
                .insert({
                  rfc: targetRfc.toUpperCase(),
                  nombre_comercial: manualFields.nombre.trim() || targetRfc,
                  razon_social: manualFields.nombre.trim() || targetRfc,
                  empresa_id: empresaId
                })
                .select('id')
                .single();
              if (errP) throw errP;
              proveedorId = newProv.id;
            }
          }
          
          insertPayload = {
            folio_factura: manualFields.folio || 'SF-MANUAL',
            uuid_fiscal: uuidFiscal?.toUpperCase() || null,
            monto: parseFloat(manualFields.total || '0'),
            subtotal: parseFloat(manualFields.subtotal || manualFields.total || '0'),
            iva_acreditable: parseFloat(manualFields.iva || '0'),
            xml_url: finalXmlUrl,
            pdf_url: finalPdfUrl,
            ticket_url: finalTicketUrl,
            fecha_gasto: manualFields.fecha,
            empresa_id: empresaId,
            concepto: manualFields.concepto || (uuidFiscal 
              ? `Gasto por factura XML (UUID: ${uuidFiscal.substring(0, 8)})` 
              : 'Gasto Manual'),
            registrado_por: staffId,
            proveedor_id: proveedorId,
            forma_pago_id: formaPagoId,
            categoria_id: manualFields.categoria_id || null,
            estatus_factura_id: uuidFiscal ? (await supabase.from('estatus_factura').select('id').ilike('nombre', 'Facturado').maybeSingle()).data?.id || null : null,
            estatus_facturado: !!uuidFiscal,
            metodo_pago: metodoPagoCode,
            fecha_timbrado: fechaTimbrado || null,
            es_deducible: esDeducible
          };
        } else {
          // Buscar o crear cliente por RFC
          let clienteId = null;
          const targetRfc = manualFields.rfc.trim();
          if (targetRfc) {
            const { data: cli } = await supabase
              .from('clientes')
              .select('id')
              .eq('rfc', targetRfc.toUpperCase())
              .eq('empresa_id', empresaId)
              .maybeSingle();

            if (cli) {
              clienteId = cli.id;
            } else {
              const { data: newCli, error: errC } = await supabase
                .from('clientes')
                .insert({
                  rfc: targetRfc.toUpperCase(),
                  nombre_local: manualFields.nombre.trim() || 'CLIENTE DESCONOCIDO',
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
            serie_folio: manualFields.folio || 'SF-MANUAL',
            uuid_fiscal: uuidFiscal?.toUpperCase() || null,
            total: parseFloat(manualFields.total || '0'),
            subtotal: parseFloat(manualFields.subtotal || manualFields.total || '0'),
            iva_trasladado: parseFloat(manualFields.iva || '0'),
            xml_url: finalXmlUrl,
            pdf_url: finalPdfUrl,
            ticket_url: finalTicketUrl,
            fecha_emision: manualFields.fecha,
            cliente_id: clienteId,
            forma_pago_id: formaPagoId,
            estatus_factura_id: uuidFiscal ? (await supabase.from('estatus_factura').select('id').ilike('nombre', 'Facturado').maybeSingle()).data?.id || null : null,
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
            throw new Error(`La factura con UUID ${insertPayload.uuid_fiscal} ya existe en el sistema.`);
          }
        }

        const { error } = await supabase.from(tableStr).insert([insertPayload]);
        if (error) throw error;
      }

      // Eliminar del Storage los archivos anteriores
      if (oldFilesToDelete.length > 0) {
        for (const item of oldFilesToDelete) {
          await supabase.storage.from(item.bucket).remove([item.path]);
        }
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
          <div className="flex bg-gray-100 dark:bg-gray-850 p-1 rounded-lg">
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
              className={'px-3 py-1 rounded-md text-xs font-semibold transition-all ' + (fileMode[type] === 'link' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700')}
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
                onChange={(e) => handleFileChange(type, e.target.files?.[0] || null)}
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
      <div className="bg-gray-50 dark:bg-gray-950 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-900">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="text-blue-500" /> {registroId ? 'Adjuntar Documentos' : 'Carga Manual / Ticket'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {registroId
                ? 'Agrega los documentos faltantes a este registro.'
                : (tipo === 'gasto'
                  ? 'Captura los datos del gasto. El XML es opcional (sirve para auto-completar).'
                  : 'Captura los datos de la venta. El XML es opcional.')}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={procesarManual} className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {errorGlobal && (
            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-start gap-2">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <p>{errorGlobal}</p>
            </div>
          )}

          {tipo === 'gasto' && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-gray-950 dark:text-white">Gasto No Deducible (Solo Ticket)</label>
                <p className="text-xs text-gray-500 mt-1">Marca esta opción si el gasto no cuenta con factura XML y solo tienes un ticket o nota de venta.</p>
              </div>
              <input
                type="checkbox"
                checked={!esDeducible}
                onChange={(e) => {
                  const val = !e.target.checked;
                  setEsDeducible(val);
                  if (!val) {
                    // Reset XML files since it's not deductible
                    setFiles(prev => ({ ...prev, xml: null, pdf: null }));
                    setLinks(prev => ({ ...prev, xml: '', pdf: '' }));
                    setUuidFiscal(null);
                    setFechaTimbrado(null);
                  }
                }}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>
          )}

          {/* Sección de Archivos */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Archivos de Soporte</h3>
            {esDeducible && renderFileSection("Archivo XML (Opcional)", "xml", ".xml", false)}
            {esDeducible && renderFileSection("Representación Impresa (PDF)", "pdf", ".pdf", false)}
            {renderFileSection(esDeducible ? "Ticket / Nota / Foto" : "Ticket / Nota / Foto (Obligatorio)", "ticket", "image/*,.pdf", !esDeducible)}
          </div>

          {/* Formulario de Campos */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800 pb-2 mb-2">
              Datos de la Operación
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Fecha <span className="text-red-550">*</span></label>
                <input
                  type="date"
                  required
                  value={manualFields.fecha}
                  onChange={e => setManualFields(prev => ({ ...prev, fecha: e.target.value }))}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Folio / Serie</label>
                <input
                  type="text"
                  placeholder="Folio o serie de factura"
                  value={manualFields.folio}
                  onChange={e => setManualFields(prev => ({ ...prev, folio: e.target.value }))}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">RFC {tipo === 'gasto' ? 'Proveedor' : 'Cliente'}</label>
                <input
                  type="text"
                  placeholder="RFC"
                  value={manualFields.rfc}
                  onChange={e => setManualFields(prev => ({ ...prev, rfc: e.target.value.toUpperCase() }))}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Nombre / Razón Social</label>
                <input
                  type="text"
                  placeholder="Nombre o razón social"
                  value={manualFields.nombre}
                  onChange={e => setManualFields(prev => ({ ...prev, nombre: e.target.value }))}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              {tipo === 'gasto' && (
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Descripción del Gasto u Observaciones <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Compra de papelería, comida de negocios..."
                    value={manualFields.concepto}
                    onChange={e => setManualFields(prev => ({ ...prev, concepto: e.target.value }))}
                    className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Subtotal ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={manualFields.subtotal}
                  onChange={e => setManualFields(prev => ({ ...prev, subtotal: e.target.value }))}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">IVA ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={manualFields.iva}
                  onChange={e => setManualFields(prev => ({ ...prev, iva: e.target.value }))}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Total ($) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={manualFields.total}
                  onChange={e => setManualFields(prev => ({ ...prev, total: e.target.value }))}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-red-500 dark:text-red-400 font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Forma de Pago <span className="text-red-500">*</span></label>
                  <button
                    type="button"
                    onClick={() => setVerTodos(!verTodos)}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-bold"
                  >
                    {verTodos ? "Mostrar solo comunes" : "Ver todos los códigos SAT"}
                  </button>
                </div>
                <select
                  required
                  value={manualFields.metodoPagoId}
                  onChange={e => setManualFields(prev => ({ ...prev, metodoPagoId: e.target.value }))}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                >
                  <option value="">Seleccionar forma de pago...</option>
                  
                  {/* Opciones comunes de la BD */}
                  {formasPago.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.codigo ? `${f.codigo} - ${f.nombre}` : f.nombre}
                    </option>
                  ))}

                  {/* Todas las opciones SAT si verTodos es true */}
                  {verTodos && (
                    <>
                      <option disabled className="text-gray-400 font-bold border-t">--- Todos los Códigos SAT ---</option>
                      {SAT_FORMAS_PAGO.filter(sat => !formasPago.some(f => f.codigo === sat.codigo)).map(sat => (
                        <option key={sat.codigo} value={sat.codigo}>
                          {sat.codigo} - {sat.nombre}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {tipo === 'gasto' && (
                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Categoría de Gasto</label>
                  <select
                    value={manualFields.categoria_id}
                    onChange={e => setManualFields(prev => ({ ...prev, categoria_id: e.target.value }))}
                    className="w-full mt-1 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-950 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  >
                    <option value="">Sin Categoría</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-900 bg-white dark:bg-gray-900 flex justify-end gap-3 shrink-0">
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
