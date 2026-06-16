'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import {
  obtenerSignedUrl,
  enviarFacturaPorCorreo,
  guardarFacturaEnBaseDatos,
  comprobarEgresoConFacturas
} from './actions';
import {
  UploadCloud, FileText, Send, Eye, RefreshCw, AlertTriangle, CheckCircle,
  FileCode, Download, Trash2, Calendar, DollarSign, Layers, Plus, Mail, Sun, Moon
} from 'lucide-react';
interface GastoFacturado {
  id: string;
  fecha_timbrado?: string;
  fecha_gasto?: string;
  uuid_fiscal?: string;
  concepto: string;
  monto: number;
  iva_acreditable?: number;
  proveedores?: { nombre_comercial: string; rfc: string };
  categorias_gasto?: { nombre: string };
  xml_url?: string;
  pdf_url?: string;
  gasto_padre_id?: string | null;
  padre?: { concepto: string } | null;
}

interface VentaFacturada {
  id: string;
  numero_pedido: string;
  precio_total: number;
  cliente_nombre?: string;
  fecha_pedido?: string;
  estatus_pago?: string;
  clientes?: { nombre_local: string; rfc: string; email_facturacion?: string };
  facturas_clientes?: { 
    uuid_fiscal?: string; 
    xml_url?: string; 
    pdf_url?: string;
    total?: number;
    iva_trasladado?: number;
    fecha_emision?: string;
    serie_folio?: string;
  }[];
}

interface PedidoPendiente {
  id: string;
  numero_pedido: string;
  precio_total: number;
  cliente_nombre?: string;
  fecha_pedido?: string;
}

interface GastoPendiente {
  id: string;
  concepto: string;
  monto: number;
  fecha_gasto?: string;
}

interface Cliente {
  id: string;
  nombre_local: string;
  rfc: string;
}

export const dynamic = 'force-dynamic';

export default function AdvancedBillingModule() {
  const router = useRouter();

  // Helper de Formato Contable
  const formatCurrency = (val: number) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(num);
  };

  const { isDarkMode, toggleDarkMode } = useThemeMode();

  // --- TAB ACTIVAS EN LA VISUALIZACIÓN ---
  const [activeTab, setActiveTab] = useState<'egresos' | 'ingresos'>('egresos');

  // --- ESTADOS DE DATOS ---
  const [gastosFacturados, setGastosFacturados] = useState<GastoFacturado[]>([]);
  const [ventasFacturadas, setVentasFacturadas] = useState<VentaFacturada[]>([]);
  const [pedidosPendientes, setPedidosPendientes] = useState<PedidoPendiente[]>([]);
  const [gastosPendientes, setGastosPendientes] = useState<GastoPendiente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [facturasSueltas, setFacturasSueltas] = useState<any[]>([]);
  const [comprobacionAcumuladaModal, setComprobacionAcumuladaModal] = useState({
    open: false,
    egresoPadreId: '',
    seleccionados: [] as string[],
    comentario: '',
    loading: false,
    error: ''
  });

  const [facturacionAcumuladaModal, setFacturacionAcumuladaModal] = useState({
    open: false,
    clienteId: '',
    pedidos: [] as any[],
    seleccionados: [] as string[],
    folio: '',
    loading: false,
    error: ''
  });

  // --- ESTADOS DE CARGA DE ARCHIVOS ---
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [invoiceType, setInvoiceType] = useState<'gasto' | 'venta'>('gasto');
  const [asociarExistente, setAsociarExistente] = useState<boolean>(false);
  const [asociarRegistroId, setAsociarRegistroId] = useState<string>('');

  // --- ESTADOS DE PARSEO XML ---
  const [parsedXmlData, setParsedXmlData] = useState<any | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // --- ESTADOS DE UI / PROCESAMIENTO ---
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [emailModal, setEmailModal] = useState<{ open: boolean; details: any | null }>({ open: false, details: null });

  // --- CARGA DE DATOS ---
  const fetchData = async () => {
    try {
      // 1. Gastos facturados (con XML)
      const { data: gFac } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc), categorias_gasto(nombre), padre:gastos!gasto_padre_id(concepto)')
        .not('uuid_fiscal', 'is', null)
        .order('fecha_gasto', { ascending: false });
      setGastosFacturados(gFac || []);

      // 2. Todas las Ventas (Facturadas y no Facturadas)
      const { data: vAll } = await supabase
        .from('pedidos')
        .select('*, clientes(nombre_local, rfc, email_facturacion), facturas_clientes(*)')
        .neq('estatus_pago', 'Cancelado')
        .order('created_at', { ascending: false });
      setVentasFacturadas(vAll || []);

      // 3. Pedidos pendientes de facturar (solo liquidados)
      const { data: pPend } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, precio_total, cliente_nombre, fecha_pedido')
        .is('folio_factura', null)
        .eq('estatus_pago', 'Liquidado')
        .order('created_at', { ascending: false });
      setPedidosPendientes(pPend || []);

      // 4. Gastos pendientes de facturar/comprobar (egresos manuales sin comprobante)
      const { data: gPend } = await supabase
        .from('gastos')
        .select('id, concepto, monto, fecha_gasto')
        .is('uuid_fiscal', null)
        .eq('estatus_facturado', false)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setGastosPendientes(gPend || []);

      // 5. Facturas XML de gastos sueltas (para comprobación acumulada)
      const { data: fSueltas } = await supabase
        .from('gastos')
        .select('*, proveedores(nombre_comercial, rfc)')
        .not('uuid_fiscal', 'is', null)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });
      setFacturasSueltas(fSueltas || []);

      // 6. Clientes para facturación acumulada
      const { data: cliData } = await supabase
        .from('clientes')
        .select('id, nombre_local, rfc')
        .order('nombre_local', { ascending: true });
      setClientes(cliData || []);

    } catch (err: unknown) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/admin/login');
      await fetchData();
    };
    init();
  }, [router]);

  // --- LÓGICA DE FACTURACIÓN ACUMULADA ---
  const handleClientChangeFacturacionAcumulada = async (cId: string) => {
    if (!cId) {
      setFacturacionAcumuladaModal(prev => ({
        ...prev,
        clienteId: '',
        pedidos: [],
        seleccionados: [],
        error: ''
      }));
      return;
    }
    setFacturacionAcumuladaModal(prev => ({
      ...prev,
      clienteId: cId,
      loading: true,
      error: ''
    }));

    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, fecha_pedido, precio_total')
        .eq('cliente_id', cId)
        .eq('estatus_pedido', 'Entregado')
        .is('folio_factura', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFacturacionAcumuladaModal(prev => ({
        ...prev,
        pedidos: data || [],
        seleccionados: [],
        loading: false
      }));
    } catch (err: any) {
      console.error('Error fetching client orders:', err);
      setFacturacionAcumuladaModal(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Error al cargar pedidos del cliente'
      }));
    }
  };

  const toggleSeleccionPedidoFacturacionAcumulada = (id: string) => {
    setFacturacionAcumuladaModal(prev => {
      const idx = prev.seleccionados.indexOf(id);
      const nuevasSelecciones = [...prev.seleccionados];
      if (idx > -1) {
        nuevasSelecciones.splice(idx, 1);
      } else {
        nuevasSelecciones.push(id);
      }
      return { ...prev, seleccionados: nuevasSelecciones };
    });
  };

  const toggleSeleccionarTodosPedidosFacturacionAcumulada = () => {
    setFacturacionAcumuladaModal(prev => {
      const todosSeleccionados = prev.seleccionados.length === prev.pedidos.length;
      return {
        ...prev,
        seleccionados: todosSeleccionados ? [] : prev.pedidos.map(p => p.id)
      };
    });
  };

  const ejecutarFacturacionAcumulada = async () => {
    const { seleccionados, folio } = facturacionAcumuladaModal;
    if (seleccionados.length === 0) {
      setFacturacionAcumuladaModal(prev => ({ ...prev, error: 'Debes seleccionar al menos un pedido' }));
      return;
    }
    if (!folio.trim()) {
      setFacturacionAcumuladaModal(prev => ({ ...prev, error: 'El folio de factura es obligatorio' }));
      return;
    }

    setFacturacionAcumuladaModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ folio_factura: folio.trim().toUpperCase() })
        .in('id', seleccionados);

      if (error) throw error;

      await fetchData();

      setFacturacionAcumuladaModal({
        open: false,
        clienteId: '',
        pedidos: [],
        seleccionados: [],
        folio: '',
        loading: false,
        error: ''
      });

      setMessage({ text: 'Facturación acumulada procesada con éxito.', type: 'success' });
    } catch (err: any) {
      console.error('Error al procesar facturación acumulada:', err);
      setFacturacionAcumuladaModal(prev => ({
        ...prev,
        error: err.message || 'Error al guardar los cambios en la base de datos',
        loading: false
      }));
    }
  };

  const toggleSeleccionFacturaComprobacionAcumulada = (id: string) => {
    setComprobacionAcumuladaModal(prev => {
      const idx = prev.seleccionados.indexOf(id);
      const nuevasSelecciones = [...prev.seleccionados];
      if (idx > -1) {
        nuevasSelecciones.splice(idx, 1);
      } else {
        nuevasSelecciones.push(id);
      }
      return { ...prev, seleccionados: nuevasSelecciones };
    });
  };

  const ejecutarComprobacionAcumulada = async () => {
    const { egresoPadreId, seleccionados, comentario } = comprobacionAcumuladaModal;
    if (!egresoPadreId) {
      setComprobacionAcumuladaModal(prev => ({ ...prev, error: 'Debes seleccionar el egreso manual a comprobar' }));
      return;
    }
    if (seleccionados.length === 0) {
      setComprobacionAcumuladaModal(prev => ({ ...prev, error: 'Debes seleccionar al menos una factura XML' }));
      return;
    }

    setComprobacionAcumuladaModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const res = await comprobarEgresoConFacturas(egresoPadreId, seleccionados, comentario);
      if (!res.success) {
        throw new Error(res.error);
      }

      await fetchData();

      setComprobacionAcumuladaModal({
        open: false,
        egresoPadreId: '',
        seleccionados: [],
        comentario: '',
        loading: false,
        error: ''
      });

      setMessage({ text: 'Comprobación acumulada del egreso guardada con éxito.', type: 'success' });
    } catch (err: any) {
      console.error('Error al ejecutar comprobación acumulada:', err);
      setComprobacionAcumuladaModal(prev => ({
        ...prev,
        loading: false,
        error: err.message || 'Error al guardar la comprobación acumulada'
      }));
    }
  };

  // --- PARSEO CLIENT-SIDE DEL XML ---
  const parseXMLClientSide = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'application/xml');

        // Verificar errores de parseo
        const parseErrorNode = xmlDoc.getElementsByTagName('parsererror');
        if (parseErrorNode.length > 0) {
          throw new Error('El archivo no tiene un formato XML válido.');
        }

        // 1. Nodo Comprobante
        const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0] || xmlDoc.getElementsByTagName('Comprobante')[0];
        if (!comprobante) {
          throw new Error('No es un CFDI de factura del SAT válido (Falta elemento cfdi:Comprobante).');
        }

        const total = parseFloat(comprobante.getAttribute('Total') || comprobante.getAttribute('total') || '0');
        const subtotal = parseFloat(comprobante.getAttribute('SubTotal') || comprobante.getAttribute('subtotal') || '0');
        const fecha = comprobante.getAttribute('Fecha') || comprobante.getAttribute('fecha') || '';
        const serie = comprobante.getAttribute('Serie') || comprobante.getAttribute('serie') || '';
        const folio = comprobante.getAttribute('Folio') || comprobante.getAttribute('folio') || '';
        const formaPagoCode = comprobante.getAttribute('FormaPago') || comprobante.getAttribute('formaPago') || '';

        // 2. Nodo Emisor
        const emisor = xmlDoc.getElementsByTagName('cfdi:Emisor')[0] || xmlDoc.getElementsByTagName('Emisor')[0];
        const emisorRfc = emisor?.getAttribute('Rfc') || emisor?.getAttribute('rfc') || '';
        const emisorNombre = emisor?.getAttribute('Nombre') || emisor?.getAttribute('nombre') || '';

        // 3. Nodo Receptor
        const receptor = xmlDoc.getElementsByTagName('cfdi:Receptor')[0] || xmlDoc.getElementsByTagName('Receptor')[0];
        const receptorRfc = receptor?.getAttribute('Rfc') || receptor?.getAttribute('rfc') || '';
        const receptorNombre = receptor?.getAttribute('Nombre') || receptor?.getAttribute('nombre') || '';
        const usoCfdi = receptor?.getAttribute('UsoCFDI') || receptor?.getAttribute('usoCFDI') || '';

        // 4. Complemento -> TimbreFiscalDigital
        const timbre = xmlDoc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] || xmlDoc.getElementsByTagName('TimbreFiscalDigital')[0];
        const uuid = timbre?.getAttribute('UUID') || '';
        const fechaTimbrado = timbre?.getAttribute('FechaTimbrado') || '';

        if (!uuid) {
          throw new Error('No se detectó el UUID del Timbre Fiscal Digital (complemento) en el XML.');
        }

        // 5. Impuestos -> Traslados (IVA 002 Global)
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

        setParsedXmlData({
          total,
          subtotal,
          iva: globalIva,
          fecha,
          serie,
          folio,
          formaPagoCode,
          uuid,
          fechaTimbrado,
          emisorRfc,
          emisorNombre,
          receptorRfc,
          receptorNombre,
          usoCfdi
        });
        setParseError(null);
      } catch (err: any) {
        console.error('Error parsing XML:', err);
        setParseError(err.message || 'Error desconocido al parsear XML');
        setParsedXmlData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleXmlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setXmlFile(file);
      parseXMLClientSide(file);
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
    }
  };

  // Reset variables after upload
  const resetUploadForm = () => {
    setXmlFile(null);
    setPdfFile(null);
    setParsedXmlData(null);
    setParseError(null);
    setAsociarExistente(false);
    setAsociarRegistroId('');
  };

  // --- SUBIDA DE ARCHIVOS A SUPABASE STORAGE Y REGISTRO ATÓMICO ---
  const handleUploadAndProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xmlFile || !pdfFile) {
      setMessage({ text: 'Debes seleccionar tanto el archivo XML como el PDF correspondiente.', type: 'error' });
      return;
    }
    if (!parsedXmlData) {
      setMessage({ text: 'El XML no pudo ser analizado. Verifica su estructura.', type: 'error' });
      return;
    }
    if (asociarExistente && !asociarRegistroId) {
      setMessage({ text: 'Selecciona el Pedido o Gasto existente al cual asociar esta factura.', type: 'error' });
      return;
    }

    if (asociarExistente) {
      if (invoiceType === 'venta') {
        const selectedPedido = pedidosPendientes.find(p => p.id === asociarRegistroId);
        if (selectedPedido && Math.abs(Number(selectedPedido.precio_total) - Number(parsedXmlData.total)) > 0.01) {
          setMessage({
            text: `El importe de la venta (${formatCurrency(selectedPedido.precio_total)}) no coincide con el importe de la factura (${formatCurrency(parsedXmlData.total)}).`,
            type: 'error'
          });
          return;
        }
      } else {
        const selectedGasto = gastosPendientes.find(g => g.id === asociarRegistroId);
        if (selectedGasto && Math.abs(Number(selectedGasto.monto) - Number(parsedXmlData.total)) > 0.01) {
          setMessage({
            text: `El importe del gasto (${formatCurrency(selectedGasto.monto)}) no coincide con el importe de la factura (${formatCurrency(parsedXmlData.total)}).`,
            type: 'error'
          });
          return;
        }
      }
    }

    setIsUploading(true);
    setMessage({ text: 'Subiendo archivos y registrando en base de datos...', type: 'info' });

    try {
      // 1. Organizar rutas en el storage: facturas/YYYY-MM/timestamp_name
      const dateStr = parsedXmlData.fecha || new Date().toISOString();
      const yearMonth = dateStr.substring(0, 7); // '2026-06'
      const timestamp = Date.now();

      const xmlPath = `facturas/${yearMonth}/${timestamp}_${xmlFile.name.replace(/\s+/g, '_')}`;
      const pdfPath = `facturas/${yearMonth}/${timestamp}_${pdfFile.name.replace(/\s+/g, '_')}`;

      // 2. Subir al Bucket 'facturas' en Supabase Storage
      const [xmlUp, pdfUp] = await Promise.all([
        supabase.storage.from('facturas').upload(xmlPath, xmlFile),
        supabase.storage.from('facturas').upload(pdfPath, pdfFile)
      ]);

      if (xmlUp.error) throw new Error(`Fallo al subir XML: ${xmlUp.error.message}`);
      if (pdfUp.error) throw new Error(`Fallo al subir PDF: ${pdfUp.error.message}`);

      // 3. Registrar en Postgres usando Server Actions
      const result = await guardarFacturaEnBaseDatos({
        isGasto: invoiceType === 'gasto',
        asociarExistente,
        existenteId: asociarRegistroId || undefined,
        xmlData: parsedXmlData,
        xmlUrl: xmlPath,
        pdfUrl: pdfPath
      });

      if (!result.success) {
        // En caso de error, intentar borrar los archivos subidos para mantener limpio el Storage
        await Promise.all([
          supabase.storage.from('facturas').remove([xmlPath]),
          supabase.storage.from('facturas').remove([pdfPath])
        ]);
        throw new Error(result.error || 'Error al procesar base de datos');
      }

      setMessage({
        text: `¡Factura procesada con éxito! Modo: ${result.mode === 'association' ? 'Asociada a registro' : 'Creación automática'}. ${result.autoMatched ? 'Se concilió automáticamente con un Pedido existente.' : ''}`,
        type: 'success'
      });
      resetUploadForm();
      await fetchData();
    } catch (err: any) {
      console.error(err);
      setMessage({ text: `Error en el procesamiento: ${err.message || 'Error inesperado'}`, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  // --- DESCARGA FIRMADA (SIGNED URL) ---
  const handleDownloadFile = async (path: string) => {
    if (!path) return;
    try {
      const res = await obtenerSignedUrl(path);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert(res.error || 'No se pudo obtener enlace de descarga');
      }
    } catch (err) {
      console.error(err);
      alert('Error al intentar abrir el archivo.');
    }
  };

  // --- ENVÍO DE CORREO SIMULADO ---
  const handleSendEmail = async (pedidoId: string) => {
    try {
      const res = await enviarFacturaPorCorreo(pedidoId);
      if (res.success) {
        setEmailModal({ open: true, details: res });
      } else {
        alert(res.error || 'No se pudo realizar el envío del correo');
      }
    } catch (err) {
      console.error(err);
      alert('Error en el servicio de envío de correos.');
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex flex-col p-8 w-full max-w-[100vw] mx-auto overflow-hidden">

        {/* HEADER */}
        <div className="mb-8 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3">
              <UploadCloud className="text-blue-500 w-8 h-8" /> Conciliación y Carga de Facturas
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Subida dual de CFDI (XML + PDF), lectura automática del SAT y conciliación inteligente entre ingresos y egresos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
              title="Refrescar datos"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        {/* FEEDBACK DE ESTADO */}
        {message && (
          <div className={`p-4 rounded-xl border mb-6 flex items-start gap-3 animate-in fade-in duration-300 ${message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
              : message.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
            }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
            ) : message.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            ) : (
              <RefreshCw className="w-5 h-5 mt-0.5 shrink-0 animate-spin" />
            )}
            <div className="text-sm font-medium">{message.text}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1 overflow-hidden min-h-0">

          {/* COLUMNA IZQUIERDA: PANEL DE INGESTA */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl space-y-6 overflow-y-auto h-full">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FileCode size={20} className="text-blue-500" /> Ingesta de Factura
              </h3>
              <p className="text-xs text-gray-400 mt-1 font-sans">
                Sube el XML y PDF emitidos por el SAT para procesar.
              </p>
            </div>

            <form onSubmit={handleUploadAndProcess} className="space-y-4">

              {/* SELECTOR DE TIPO (GASTO VS VENTA) */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Tipo de Factura</label>
                <div className="grid grid-cols-2 gap-2 mt-2 font-sans">
                  <button
                    type="button"
                    onClick={() => { setInvoiceType('gasto'); resetUploadForm(); }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${invoiceType === 'gasto'
                        ? 'bg-red-600/10 text-red-500 border-red-500/40'
                        : 'bg-transparent text-gray-400 border-gray-200 dark:border-gray-800'
                      }`}
                  >
                    Gasto (Proveedor)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setInvoiceType('venta'); resetUploadForm(); }}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${invoiceType === 'venta'
                        ? 'bg-emerald-600/10 text-emerald-500 border-emerald-500/40'
                        : 'bg-transparent text-gray-400 border-gray-200 dark:border-gray-800'
                      }`}
                  >
                    Venta (Cliente)
                  </button>
                </div>
              </div>

              {/* LÓGICA DUAL DE CARGA DE ARCHIVOS */}
              <div className="grid grid-cols-1 gap-3 font-sans">
                {/* XML Input */}
                <div className="relative border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleXmlChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileCode className={`mx-auto h-8 w-8 mb-2 ${xmlFile ? 'text-blue-500' : 'text-gray-400'}`} />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {xmlFile ? xmlFile.name : 'Seleccionar XML (.xml)'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">Obligatorio para lectura de metadatos</p>
                </div>

                {/* PDF Input */}
                <div className="relative border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileText className={`mx-auto h-8 w-8 mb-2 ${pdfFile ? 'text-red-500' : 'text-gray-400'}`} />
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {pdfFile ? pdfFile.name : 'Seleccionar Representación PDF (.pdf)'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">Obligatorio para almacenamiento</p>
                </div>
              </div>

              {/* DATOS EXTRAÍDOS DEL XML (FRONTEND PREVIEW) */}
              {parsedXmlData && (
                <div className="p-3.5 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-100 dark:border-gray-800 text-xs space-y-2 font-mono">
                  <div className="font-bold text-blue-500 font-sans border-b border-gray-200 dark:border-gray-800 pb-1 flex justify-between">
                    <span>Resumen de Factura</span>
                    <span>SAT 4.0</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase">UUID</span>
                      <p className="truncate font-semibold text-gray-800 dark:text-gray-200" title={parsedXmlData.uuid}>
                        {parsedXmlData.uuid.substring(0, 18)}...
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase">Folio Fiscal</span>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {parsedXmlData.serie || ''}{parsedXmlData.folio || 'S/F'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase">RFC Emisor</span>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{parsedXmlData.emisorRfc}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase">RFC Receptor</span>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{parsedXmlData.receptorRfc}</p>
                    </div>
                    <div className="col-span-2 border-t border-dashed border-gray-200 dark:border-gray-800 pt-1.5 mt-1"></div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase">Subtotal</span>
                      <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(parsedXmlData.subtotal)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase">IVA (002)</span>
                      <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(parsedXmlData.iva)}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-gray-400 uppercase">Total XML</span>
                      <p className="text-base font-extrabold text-blue-500">{formatCurrency(parsedXmlData.total)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* PARSE ERROR INDICATOR */}
              {parseError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 text-xs flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <p>{parseError}</p>
                </div>
              )}

              {/* SECTOR DE CONCILIACIÓN / ASOCIACIÓN */}
              {parsedXmlData && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3 font-sans">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-500 uppercase">¿Asociar a existente?</label>
                    <input
                      type="checkbox"
                      checked={asociarExistente}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-gray-950"
                      onChange={e => { setAsociarExistente(e.target.checked); setAsociarRegistroId(''); }}
                    />
                  </div>

                  {asociarExistente && (
                    <div className="space-y-1.5 animate-in slide-in-from-top-1.5 duration-200">
                      <label className="text-[11px] font-semibold text-gray-500">
                        {invoiceType === 'gasto' ? 'Gasto Pendiente de Facturar' : 'Pedido de Venta Pendiente'}
                      </label>
                      <select
                        value={asociarRegistroId}
                        className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                        onChange={e => setAsociarRegistroId(e.target.value)}
                        required
                      >
                        <option value="">Selecciona...</option>
                        {invoiceType === 'gasto' ? (
                          gastosPendientes.map(g => (
                            <option key={g.id} value={g.id}>
                              {g.concepto.substring(0, 18)}... - ${g.monto} ({new Date(g.fecha_gasto || '').toLocaleDateString()})
                            </option>
                          ))
                        ) : (
                          pedidosPendientes.map(p => (
                            <option key={p.id} value={p.id}>
                              Ped #{p.numero_pedido} - {(p.cliente_nombre || '').substring(0, 12)} - ${p.precio_total}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  {!asociarExistente && (
                    <div className="text-[11px] text-gray-400 italic font-sans flex items-start gap-1">
                      <CheckCircle size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span>
                        Se creará un nuevo registro y el sistema buscará un pago pendiente por el mismo monto para conciliar de forma automática.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* BOTÓN DE SUBIDA */}
              <button
                type="submit"
                disabled={isUploading || !xmlFile || !pdfFile || !!parseError}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Procesando...
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} /> Subir y Conciliar Factura
                  </>
                )}
              </button>
            </form>
          </div>

          {/* COLUMNA DERECHA: PESTAÑAS DE VISUALIZACIÓN */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full">

            {/* PESTAÑAS */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
              <button
                onClick={() => setActiveTab('egresos')}
                className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'egresos'
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <DollarSign size={16} /> Egresos Facturados (Gastos)
              </button>
              <button
                onClick={() => setActiveTab('ingresos')}
                className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'ingresos'
                    ? 'border-emerald-500 text-emerald-500'
                    : 'border-transparent text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <Layers size={16} /> Ingresos Facturados (Ventas)
              </button>
            </div>

            {/* CONTENIDO TAB 1: EGRESOS (GASTOS) */}
            {activeTab === 'egresos' && (
              <div className="flex flex-col flex-1 font-sans">
                {/* BARRA DE ACCIONES DE EGRESOS */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 flex justify-between items-center gap-4 flex-wrap">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Egresos y Comprobación de Gastos
                  </span>
                  <button
                    onClick={() => setComprobacionAcumuladaModal(prev => ({ ...prev, open: true }))}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                  >
                    <Plus size={14} /> Comprobación Acumulada
                  </button>
                </div>

                <div className="overflow-auto flex-1">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      <th className="p-4">Fecha Timbrado</th>
                      <th className="p-4">UUID Fiscal / Folio</th>
                      <th className="p-4">Proveedor / Emisor</th>
                      <th className="p-4 text-right">Monto</th>
                      <th className="p-4 text-center">XML / PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
                    {gastosFacturados.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                        <td className="p-4 font-mono text-gray-600 dark:text-gray-400">
                          {g.fecha_timbrado ? new Date(g.fecha_timbrado || '').toLocaleDateString() : new Date(g.fecha_gasto || '').toLocaleDateString()}
                        </td>
                        <td className="p-4 font-mono">
                          <div className="text-gray-800 dark:text-gray-200 font-bold" title={g.uuid_fiscal}>
                            {g.uuid_fiscal ? g.uuid_fiscal.substring(0, 18) + '...' : 'N/A'}
                          </div>
                          <div className="text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap">
                            <span>{g.concepto}</span>
                            {g.gasto_padre_id && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 uppercase tracking-wide" title={g.padre?.concepto}>
                                Comprobante
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-gray-800 dark:text-gray-200">{g.proveedores?.nombre_comercial || 'N/A'}</div>
                          <div className="font-mono text-[10px] text-gray-400">{g.proveedores?.rfc}</div>
                        </td>
                        <td className="p-4 text-right font-mono">
                          <div className="font-bold text-red-500">-{formatCurrency(g.monto)}</div>
                          <div className="text-[10px] text-gray-400">IVA: {formatCurrency(g.iva_acreditable || 0)}</div>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-1 justify-center">
                            {g.xml_url && (
                              <button
                                onClick={() => handleDownloadFile(g.xml_url || '')}
                                className="p-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-900/50 text-blue-500"
                                title="Descargar XML"
                              >
                                <FileCode size={14} />
                              </button>
                            )}
                            {g.pdf_url && (
                              <button
                                onClick={() => handleDownloadFile(g.pdf_url || '')}
                                className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500"
                                title="Descargar PDF"
                              >
                                <FileText size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {gastosFacturados.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-gray-400 italic">
                          No hay gastos facturados registrados
                        </td>
                      </tr>
                    )}
                  </tbody>
                 </table>
               </div>
             </div>
           )}

            {/* CONTENIDO TAB 2: INGRESOS (VENTAS) */}
            {activeTab === 'ingresos' && (
              <div className="flex flex-col flex-1 font-sans">
                {/* BARRA DE ACCIONES DE INGRESOS */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/20 flex justify-between items-center gap-4 flex-wrap">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Registro de Ventas y Facturación
                  </span>
                  <button
                    onClick={() => setFacturacionAcumuladaModal(prev => ({ ...prev, open: true }))}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                  >
                    <Plus size={14} /> Facturación Acumulada
                  </button>
                </div>

                <div className="overflow-auto flex-1">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        <th className="p-4">Fecha Emisión</th>
                        <th className="p-4">UUID / Folio</th>
                        <th className="p-4">Cliente / Receptor</th>
                        <th className="p-4 text-right">Monto</th>
                        <th className="p-4 text-center">XML / PDF</th>
                        <th className="p-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
                      {ventasFacturadas.map((v) => {
                        const invoice = (v.facturas_clientes && v.facturas_clientes.length > 0) ? v.facturas_clientes[0] : null;
                        const clientName = v.clientes?.nombre_local || v.cliente_nombre || 'Cliente Ocasional';
                        const clientRfc = v.clientes?.rfc || 'S/N';
                        const totalAmount = invoice ? (invoice.total || 0) : v.precio_total;
                        const ivaAmount = invoice ? (invoice.iva_trasladado || 0) : (Number(v.precio_total) * 0.16);
                        const fechaDisplay = invoice?.fecha_emision || v.fecha_pedido;

                        return (
                          <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                            <td className="p-4 font-mono text-gray-600 dark:text-gray-400">
                              {fechaDisplay ? new Date(fechaDisplay).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="p-4 font-mono">
                              {invoice ? (
                                <>
                                  <div className="text-gray-800 dark:text-gray-200 font-bold" title={invoice.uuid_fiscal}>
                                    {(invoice.uuid_fiscal || '').substring(0, 18)}...
                                  </div>
                                  <div className="text-[10px] text-gray-400">
                                    Folio: {invoice.serie_folio || 'S/N'} | Pedido #{v.numero_pedido}
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-1">
                                  <div>
                                    {v.estatus_pago === 'Liquidado' ? (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20 font-sans font-bold">
                                        Pendiente de Facturar
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 font-sans font-bold">
                                        No Liquidado
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-400">
                                    Pedido #{v.numero_pedido}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-gray-800 dark:text-gray-200">{clientName}</div>
                              <div className="font-mono text-[10px] text-gray-400">{clientRfc}</div>
                            </td>
                            <td className="p-4 text-right font-mono">
                              <div className="font-bold text-emerald-500">+{formatCurrency(totalAmount)}</div>
                              <div className="text-[10px] text-gray-400">IVA: {formatCurrency(ivaAmount)}</div>
                            </td>
                            <td className="p-4 text-center">
                              {invoice ? (
                                <div className="flex gap-1 justify-center">
                                  {invoice.xml_url && (
                                    <button
                                      onClick={() => handleDownloadFile(invoice.xml_url || '')}
                                      className="p-1.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded border border-blue-200 dark:border-blue-900/50 text-blue-500"
                                      title="Descargar XML"
                                    >
                                      <FileCode size={14} />
                                    </button>
                                  )}
                                  {invoice.pdf_url && (
                                    <button
                                      onClick={() => handleDownloadFile(invoice.pdf_url || '')}
                                      className="p-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-200 dark:border-red-900/50 text-red-500"
                                      title="Descargar PDF"
                                    >
                                      <FileText size={14} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">No disponible</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {invoice ? (
                                <button
                                  onClick={() => handleSendEmail(v.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium shadow-sm transition-colors text-[10px] uppercase tracking-wider"
                                >
                                  <Mail size={12} /> Enviar
                                </button>
                              ) : (
                                <span className="text-gray-400 italic">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {ventasFacturadas.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-400 italic">
                            No hay ventas registradas
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* MODAL SIMULACION CORREO */}
      {emailModal.open && emailModal.details && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 text-gray-900 dark:text-gray-100">
            <h3 className="text-xl font-extrabold mb-4 flex items-center gap-2 text-emerald-500">
              <Mail /> Correo de Facturación Enviado (Simulado)
            </h3>

            <div className="space-y-4 text-sm">
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 font-mono text-xs space-y-1">
                <div><span className="text-gray-400">De:</span> facturacion@seimenjo.com</div>
                <div><span className="text-gray-400">Para:</span> {emailModal.details.email}</div>
                <div><span className="text-gray-400">Asunto:</span> Factura Electrónica SAT CFDI 4.0 - Pedido #{emailModal.details.numero_pedido}</div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2">
                <p>Estimado/a <strong>{emailModal.details.cliente}</strong>,</p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Le hacemos llegar la factura correspondiente a su pedido con número <strong>#{emailModal.details.numero_pedido}</strong> por un total de <strong>{formatCurrency(emailModal.details.total)} MXN</strong>.
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  UUID Fiscal: {emailModal.details.uuid_fiscal}
                </p>

                <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
                  <div className="text-xs font-bold text-gray-500 uppercase mb-1">Archivos Adjuntos (Enlaces Firmados de Storage):</div>
                  <div className="flex flex-wrap gap-2">
                    {emailModal.details.xmlUrl && (
                      <a
                        href={emailModal.details.xmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-lg text-xs font-semibold hover:bg-blue-600/20 transition-all"
                      >
                        <FileCode size={14} /> Descargar XML
                      </a>
                    )}
                    {emailModal.details.pdfUrl && (
                      <a
                        href={emailModal.details.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 text-red-500 border border-red-500/20 rounded-lg text-xs font-semibold hover:bg-red-600/20 transition-all"
                      >
                        <FileText size={14} /> Descargar PDF
                      </a>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    * Los enlaces temporales son válidos por 3 días por seguridad del storage.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setEmailModal({ open: false, details: null })}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FACTURACIÓN ACUMULADA */}
      {facturacionAcumuladaModal.open && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100 flex flex-col">

            {/* Cabecera */}
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-extrabold flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-sans">
                  <FileText size={22} /> Facturación Acumulada
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-sans">
                  Agrupa múltiples pedidos entregados de un cliente de crédito y asóciales un único folio de factura SAT.
                </p>
              </div>
              <button
                onClick={() => setFacturacionAcumuladaModal({
                  open: false,
                  clienteId: '',
                  pedidos: [],
                  seleccionados: [],
                  folio: '',
                  loading: false,
                  error: ''
                })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {facturacionAcumuladaModal.error && (
              <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{facturacionAcumuladaModal.error}</span>
              </div>
            )}

            {/* Selector de Cliente */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-800 font-sans">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-2">
                1. Selecciona el Cliente
              </label>
              <select
                value={facturacionAcumuladaModal.clienteId}
                onChange={e => handleClientChangeFacturacionAcumulada(e.target.value)}
                disabled={facturacionAcumuladaModal.loading}
                className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              >
                <option value="">-- Selecciona un cliente de la lista --</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre_local} ({c.rfc || 'Sin RFC'})
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de Pedidos */}
            {facturacionAcumuladaModal.clienteId && (
              <div className="flex-1 flex flex-col min-h-[250px]">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 font-sans">
                  2. Selecciona los Pedidos Entregados Pendientes de Facturar
                </h4>

                {facturacionAcumuladaModal.loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
                    <p className="text-sm text-gray-500">Cargando pedidos...</p>
                  </div>
                ) : facturacionAcumuladaModal.pedidos.length === 0 ? (
                  <div className="flex-1 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mb-2" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-sans">
                      No hay pedidos entregados pendientes
                    </p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                      Todos los pedidos del cliente están facturados o su estatus no es 'Entregado'.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl max-h-[300px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            <th className="p-3 text-center w-12">
                              <input
                                type="checkbox"
                                checked={
                                  facturacionAcumuladaModal.seleccionados.length ===
                                  facturacionAcumuladaModal.pedidos.length &&
                                  facturacionAcumuladaModal.pedidos.length > 0
                                }
                                onChange={toggleSeleccionarTodosPedidosFacturacionAcumulada}
                                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 bg-white dark:bg-gray-950"
                              />
                            </th>
                            <th className="p-3">Pedido</th>
                            <th className="p-3">Fecha Pedido</th>
                            <th className="p-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                          {facturacionAcumuladaModal.pedidos.map(p => (
                            <tr
                              key={p.id}
                              className="hover:bg-gray-55/40 dark:hover:bg-gray-900/40 transition-colors"
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={facturacionAcumuladaModal.seleccionados.includes(p.id)}
                                  onChange={() => toggleSeleccionPedidoFacturacionAcumulada(p.id)}
                                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 bg-white dark:bg-gray-950"
                                />
                              </td>
                              <td className="p-3 font-semibold font-mono">
                                #{p.numero_pedido}
                              </td>
                              <td className="p-3 text-gray-550 dark:text-gray-400">
                                {p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                                {formatCurrency(p.precio_total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumen de Selección */}
                    <div className="mt-4 p-4 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-xl border border-emerald-150/30 dark:border-emerald-900/20 flex justify-between items-center flex-wrap gap-4 font-sans">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Pedidos seleccionados:</span>
                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          {facturacionAcumuladaModal.seleccionados.length} pedidos
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Monto total acumulado:</span>
                        <p className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(
                            facturacionAcumuladaModal.pedidos
                              .filter(p => facturacionAcumuladaModal.seleccionados.includes(p.id))
                              .reduce((sum, p) => sum + Number(p.precio_total || 0), 0)
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Entrada de Folio */}
                    <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-gray-200 dark:border-gray-800 font-sans">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-2">
                        3. Ingresa el Folio de Factura SAT *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. F-92831 o ACUM-001"
                        value={facturacionAcumuladaModal.folio}
                        onChange={e => setFacturacionAcumuladaModal(prev => ({ ...prev, folio: e.target.value }))}
                        className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm uppercase text-gray-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono"
                        disabled={facturacionAcumuladaModal.seleccionados.length === 0}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer de Acciones */}
            <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800 font-sans">
              <button
                onClick={() => setFacturacionAcumuladaModal({
                  open: false,
                  clienteId: '',
                  pedidos: [],
                  seleccionados: [],
                  folio: '',
                  loading: false,
                  error: ''
                })}
                disabled={facturacionAcumuladaModal.loading}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarFacturacionAcumulada}
                disabled={
                  facturacionAcumuladaModal.loading ||
                  facturacionAcumuladaModal.seleccionados.length === 0 ||
                  !facturacionAcumuladaModal.folio.trim()
                }
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {facturacionAcumuladaModal.loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Facturando...
                  </>
                ) : (
                  <>
                    <FileText size={18} />
                    Asignar Factura Acumulada
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: COMPROBACIÓN ACUMULADA DE EGRESOS */}
      {comprobacionAcumuladaModal.open && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto text-gray-900 dark:text-gray-100 flex flex-col">

            {/* Cabecera */}
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-extrabold flex items-center gap-2 text-blue-600 dark:text-blue-500 font-sans">
                  <DollarSign size={22} /> Comprobación Acumulada de Egresos
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-sans">
                  Asocia múltiples facturas XML de gastos (proveedores) a un único egreso por transferencia registrado manualmente.
                </p>
              </div>
              <button
                onClick={() => setComprobacionAcumuladaModal({
                  open: false,
                  egresoPadreId: '',
                  seleccionados: [],
                  comentario: '',
                  loading: false,
                  error: ''
                })}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {comprobacionAcumuladaModal.error && (
              <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-900/50 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{comprobacionAcumuladaModal.error}</span>
              </div>
            )}

            {/* Selector de Egreso Principal */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-800 font-sans">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-2">
                1. Selecciona el Egreso por Transferencia Pendiente
              </label>
              <select
                value={comprobacionAcumuladaModal.egresoPadreId}
                onChange={e => setComprobacionAcumuladaModal(prev => ({ ...prev, egresoPadreId: e.target.value, error: '' }))}
                disabled={comprobacionAcumuladaModal.loading}
                className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">-- Selecciona un egreso manual sin comprobar --</option>
                {gastosPendientes.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.concepto} - ${Number(g.monto).toFixed(2)} ({new Date(g.fecha_gasto || '').toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de Facturas XML Sueltas */}
            {comprobacionAcumuladaModal.egresoPadreId && (
              <div className="flex-1 flex flex-col min-h-[250px]">
                <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 font-sans">
                  2. Selecciona las Facturas XML (Gastos) que Comprueban este Egreso
                </h4>

                {facturasSueltas.length === 0 ? (
                  <div className="flex-1 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center flex flex-col items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 font-sans">
                      No hay facturas XML sueltas registradas
                    </p>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm">
                      Sube las facturas XML correspondientes a través del panel de la izquierda antes de intentar comprobar.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-xl max-h-[250px]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500 dark:text-gray-400 uppercase">
                            <th className="p-3 text-center w-12"></th>
                            <th className="p-3">Concepto / UUID</th>
                            <th className="p-3">Proveedor</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                          {facturasSueltas.map(f => (
                            <tr
                              key={f.id}
                              className="hover:bg-gray-55/40 dark:hover:bg-gray-900/40 transition-colors"
                            >
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={comprobacionAcumuladaModal.seleccionados.includes(f.id)}
                                  onChange={() => toggleSeleccionFacturaComprobacionAcumulada(f.id)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 bg-white dark:bg-gray-950"
                                />
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-gray-800 dark:text-gray-200 font-mono text-[10px]">
                                  {f.uuid_fiscal ? f.uuid_fiscal.substring(0, 16) + '...' : 'N/A'}
                                </div>
                                <div className="text-[10px] text-gray-400">{f.concepto}</div>
                              </td>
                              <td className="p-3 text-gray-700 dark:text-gray-300">
                                <div className="font-semibold">{f.proveedores?.nombre_comercial}</div>
                                <div className="font-mono text-[9px] text-gray-400">{f.proveedores?.rfc}</div>
                              </td>
                              <td className="p-3 text-gray-500 dark:text-gray-400">
                                {f.fecha_gasto ? new Date(f.fecha_gasto).toLocaleDateString() : 'N/A'}
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-gray-800 dark:text-gray-200">
                                {formatCurrency(f.monto)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Resumen de Selección */}
                    {(() => {
                      const egresoSeleccionado = gastosPendientes.find(g => g.id === comprobacionAcumuladaModal.egresoPadreId);
                      const montoEgreso = egresoSeleccionado ? Number(egresoSeleccionado.monto) : 0;
                      const montoFacturas = facturasSueltas
                        .filter(f => comprobacionAcumuladaModal.seleccionados.includes(f.id))
                        .reduce((sum, f) => sum + Number(f.monto || 0), 0);
                      const diferencia = montoEgreso - montoFacturas;
                      const diferenciaAbs = Math.abs(diferencia);
                      const coincide = diferenciaAbs <= 0.05; // Margen de centavos

                      return (
                        <>
                          <div className="mt-4 p-4 bg-blue-50/40 dark:bg-blue-950/10 rounded-xl border border-blue-150/30 dark:border-blue-900/20 grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans text-xs">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block">Total Egreso por Transferencia:</span>
                              <span className="text-base font-bold text-gray-800 dark:text-gray-200">{formatCurrency(montoEgreso)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400 block">Total de Facturas XML Seleccionadas ({comprobacionAcumuladaModal.seleccionados.length}):</span>
                              <span className="text-base font-bold text-blue-600 dark:text-blue-400">{formatCurrency(montoFacturas)}</span>
                            </div>
                            <div className="sm:text-right">
                              <span className="text-gray-500 dark:text-gray-400 block">Diferencia:</span>
                              <span className={`text-base font-mono font-extrabold ${coincide ? 'text-emerald-600 dark:text-emerald-500' : 'text-amber-500'}`}>
                                {formatCurrency(diferencia)}
                              </span>
                            </div>
                          </div>

                          {!coincide && (
                            <div className="mt-2 text-[10px] text-amber-500 font-medium flex items-center gap-1 font-sans">
                              <AlertTriangle size={12} />
                              <span>El total de las facturas no coincide exactamente con el monto del egreso (Diferencia: {formatCurrency(diferencia)}).</span>
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Comentarios de la comprobación */}
                    <div className="mt-4 font-sans">
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">
                        3. Comentarios o Notas (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Nota sobre la comprobación..."
                        value={comprobacionAcumuladaModal.comentario}
                        onChange={e => setComprobacionAcumuladaModal(prev => ({ ...prev, comentario: e.target.value }))}
                        className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer de Acciones */}
            <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800 font-sans">
              <button
                onClick={() => setComprobacionAcumuladaModal({
                  open: false,
                  egresoPadreId: '',
                  seleccionados: [],
                  comentario: '',
                  loading: false,
                  error: ''
                })}
                disabled={comprobacionAcumuladaModal.loading}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={ejecutarComprobacionAcumulada}
                disabled={
                  comprobacionAcumuladaModal.loading ||
                  !comprobacionAcumuladaModal.egresoPadreId ||
                  comprobacionAcumuladaModal.seleccionados.length === 0
                }
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-500 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {comprobacionAcumuladaModal.loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <DollarSign size={18} />
                    Comprobar Egreso
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}