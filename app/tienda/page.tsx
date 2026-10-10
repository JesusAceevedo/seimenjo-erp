'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import {
  ShoppingCart, LogOut, Plus, Minus, Send, CheckCircle2, AlertTriangle,
  FileText, FileCode, RefreshCw, Lock, Sparkles, Sun, Moon,
  Package, Clock, Truck, ChevronDown, ChevronUp, CheckCircle, Eye,
  Building2, Calendar, X
} from 'lucide-react';
import Image from 'next/image';
import { useProtectedRoute } from '../../lib/useProtectedRoute';
import { useThemeMode } from '../../lib/useThemeMode';
import { obtenerSignedUrlCliente, notificarPedidoTelegramAction } from './actions';
import ClienteCfdiModal from './ClienteCfdiModal';
import DatosFiscalesModal from './DatosFiscalesModal';

// Interfaces de tipado
interface Producto { id: string; nombre: string; categoria: string; imagen_url: string; }
interface Variante { id: string; producto_id: string; gramaje: string; precio_base: number; }
interface ItemCarrito { variante_id: string; producto_nombre: string; gramaje: string; cantidad: number; precio_unitario: number; }

export interface FacturaClienteResumen {
  id: string;
  uuid_fiscal?: string | null;
  serie_folio?: string | null;
  xml_url?: string | null;
  pdf_url?: string | null;
  fecha_emision?: string | null;
  total?: number | null;
  estatus_factura?: { nombre?: string } | null;
}

interface DetallePedido {
  id: string;
  variante_id: string;
  cantidad: number;
  precio_aplicado: number;
  subtotal: number;
  comentarios?: string;
  producto_variantes?: {
    gramaje: string;
    productos?: {
      nombre: string;
    } | null;
  } | null;
}

interface PedidoCliente {
  id: string;
  numero_pedido: number | string;
  fecha_pedido?: string;
  creado_en?: string;
  fecha_entrega?: string;
  estatus_pedido: string;
  estatus_pago: string;
  precio_total: number;
  comentarios?: string;
  pedido_detalles?: DetallePedido[];
  facturas_clientes?: FacturaClienteResumen[];
}

// Helpers para fechas de entrega
const getFechaOffsetStr = (diasOffset: number = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + diasOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatearFechaEntrega = (fechaIso?: string, formatoLargo = false) => {
  if (!fechaIso) return '';
  try {
    const [y, m, d] = fechaIso.split('-').map(Number);
    if (!y || !m || !d) return fechaIso;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('es-MX', {
      weekday: formatoLargo ? 'long' : 'short',
      day: 'numeric',
      month: formatoLargo ? 'long' : 'short',
      year: 'numeric'
    });
  } catch {
    return fechaIso;
  }
};

export default function Tienda() {
  useProtectedRoute(); // Protege esta ruta - redirige a login si no hay sesión
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const [sesion, setSesion] = useState<any>(null);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [preciosEspeciales, setPreciosEspeciales] = useState<Record<string, number>>({});
  const [empresaNombre, setEmpresaNombre] = useState('Portal SEIMENJO');
  const [empresaLogoUrl, setEmpresaLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);

  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [comentarios, setComentarios] = useState('');
  // Por defecto "Mañana" preseleccionado para que nunca viaje vacío
  const [fechaEntrega, setFechaEntrega] = useState<string>(() => getFechaOffsetStr(1));
  const [ultimoPedidoFechaEntrega, setUltimoPedidoFechaEntrega] = useState('');
  const [carritoMovilAbierto, setCarritoMovilAbierto] = useState(false);

  const fechaHoyStr = getFechaOffsetStr(0);
  const fechaMananaStr = getFechaOffsetStr(1);
  const fechaPasadoStr = getFechaOffsetStr(2);

  const [loading, setLoading] = useState(true);
  const [errorCritico, setErrorCritico] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pedidoExitoso, setPedidoExitoso] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});

  const [seleccionGramaje, setSeleccionGramaje] = useState<Record<string, string>>({});

  // Pestañas de navegación
  const [activeTab, setActiveTab] = useState<'comprar' | 'pedidos' | 'facturas'>('comprar');

  // Estados del Historial de Pedidos del Cliente
  const [misPedidos, setMisPedidos] = useState<PedidoCliente[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [errorPedidos, setErrorPedidos] = useState('');
  const [pedidoDetalleAbierto, setPedidoDetalleAbierto] = useState<Record<string, boolean>>({});

  const toggleDetallePedido = (id: string) => {
    setPedidoDetalleAbierto(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const cargarMisPedidos = async (clienteId: string) => {
    setLoadingPedidos(true);
    setErrorPedidos('');
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          numero_pedido,
          fecha_pedido,
          fecha_entrega,
          estatus_pedido,
          estatus_pago,
          precio_total,
          comentarios,
          creado_en,
          pedido_detalles(
            id,
            variante_id,
            cantidad,
            precio_aplicado,
            subtotal,
            comentarios,
            producto_variantes(
              gramaje,
              productos(nombre)
            )
          ),
          facturas_clientes(
            id,
            uuid_fiscal,
            serie_folio,
            xml_url,
            pdf_url,
            fecha_emision,
            total,
            estatus_factura(nombre)
          )
        `)
        .eq('cliente_id', clienteId)
        .order('creado_en', { ascending: false });

      if (error) throw error;
      setMisPedidos((data as unknown as PedidoCliente[]) || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error al cargar pedidos:", err);
        setErrorPedidos(err.message || 'Error al cargar los pedidos');
      } else {
        console.error("Error al cargar pedidos:", err);
        setErrorPedidos('Error al cargar los pedidos');
      }
    } finally {
      setLoadingPedidos(false);
    }
  };

  // Estados del Portal de Facturas
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [errorFacturas, setErrorFacturas] = useState('');
  const [descargandoDoc, setDescargandoDoc] = useState<string | null>(null);
  const [cfdiViewerState, setCfdiViewerState] = useState<{ open: boolean; xmlUrl: string | null; serieFolio?: string | null }>({
    open: false,
    xmlUrl: null
  });
  const [modalDatosFiscalesOpen, setModalDatosFiscalesOpen] = useState(false);

  const cargarFacturas = async (clienteId: string) => {
    setLoadingFacturas(true);
    setErrorFacturas('');
    try {
      const { data, error } = await supabase
        .from('facturas_clientes')
        .select('*, pedidos(numero_pedido, estatus_pedido, precio_total), estatus_factura(nombre)')
        .eq('cliente_id', clienteId)
        .order('fecha_emision', { ascending: false });

      if (error) throw error;
      setFacturas(data || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error al cargar facturas:", err);
        setErrorFacturas(err.message || 'Error al cargar las facturas');
      } else {
        console.error("Error al cargar facturas:", err);
        setErrorFacturas('Error al cargar las facturas');
      }
    } finally {
      setLoadingFacturas(false);
    }
  };

  const descargarArchivo = async (path: string) => {
    if (!path) {
      alert("No se encontró la ruta del archivo de la factura.");
      return;
    }

    if (path.startsWith('http://') || path.startsWith('https://')) {
      window.open(path, '_blank');
      return;
    }

    setDescargandoDoc(path);
    try {
      // 1. Obtener URL firmada vía Server Action seguro con supabaseAdmin (sin bloqueo de RLS en storage)
      const res = await obtenerSignedUrlCliente(path);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
        return;
      }

      // 2. Fallback de cliente si la acción no retornó URL directa
      const { data, error } = await supabase.storage.from('facturas').createSignedUrl(path, 120);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        alert(res?.error || "No se pudo generar el enlace de descarga.");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error("Error al descargar archivo:", err);
        alert('Error al descargar el archivo: ' + err.message);
      } else {
        console.error("Error al descargar archivo:", err);
        alert('Error al descargar el archivo');
      }
    } finally {
      setDescargandoDoc(null);
    }
  };

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const sesionGuardada = localStorage.getItem('seimenjo_session');
        if (!sesionGuardada) {
          router.push('/');
          return;
        }

        const datosSesion = JSON.parse(sesionGuardada);

        // 0. Obtener fila del cliente de manera explícita
        const { data: dbClient, error: dbClientErr } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', datosSesion.id)
          .maybeSingle();

        // 1. Cargar Productos
        const { data: dataProductos, error: errProd } = await supabase.from('productos').select('*');
        if (errProd) throw new Error(`Fallo al cargar productos: ${errProd.message}`);

        // 2. Cargar Variantes
        const { data: dataVariantes, error: errVar } = await supabase.from('producto_variantes').select('*');
        if (errVar) throw new Error(`Fallo al cargar variantes: ${errVar.message}`);

        // 3. Cargar Precios Especiales e Información de la Sucursal (empresa_id)
        const mapaPrecios: Record<string, number> = {};
        let clientEmpresaId = datosSesion.empresa_id || null;

        if (datosSesion.tipo === 'b2b' && datosSesion.id) {
          // Si no está en la sesión guardada en localStorage, lo obtenemos de la base de datos
          if (!clientEmpresaId && dbClient) {
            clientEmpresaId = dbClient.empresa_id;
          }

          if (clientEmpresaId) {
            const { data: empData } = await supabase
              .from('empresas')
              .select('nombre, logo_url')
              .eq('id', clientEmpresaId)
              .maybeSingle();
            if (empData) {
              setEmpresaNombre(empData.nombre);
              if (empData.logo_url && empData.logo_url !== 'null' && empData.logo_url !== 'undefined') {
                setEmpresaLogoUrl(empData.logo_url);
                setLogoError(false);
              } else {
                setEmpresaLogoUrl(null);
              }
            }
          }

          const { data: dataPrecios, error: errPrecios } = await supabase
            .from('precios_especiales')
            .select('variante_id, precio_pactado')
            .eq('cliente_id', datosSesion.id);

          if (errPrecios) throw new Error(`Fallo al cargar precios especiales: ${errPrecios.message}`);

          if (dataPrecios) {
            dataPrecios.forEach((pe) => {
              mapaPrecios[pe.variante_id] = pe.precio_pactado;
            });
          }

          // Cargar facturas y pedidos del cliente
          cargarFacturas(datosSesion.id);
          cargarMisPedidos(datosSesion.id);
        }

        setSesion({ ...datosSesion, empresa_id: clientEmpresaId });

        setProductos(dataProductos || []);
        setVariantes(dataVariantes || []);
        setPreciosEspeciales(mapaPrecios);

        setDebugInfo({
          clienteId: datosSesion.id,
          tipoUsuario: datosSesion.tipo,
          sessionEmpresaId: datosSesion.empresa_id || 'NULL',
          dbClientFound: !!dbClient,
          dbClientEmpresaId: dbClient?.empresa_id || 'NULL',
          dbClientNombre: dbClient?.nombre_local || 'NULL',
          dbClientErr: dbClientErr?.message || 'Ninguno',
          productosLength: dataProductos?.length || 0,
          variantesLength: dataVariantes?.length || 0,
          preciosEspecialesLength: Object.keys(mapaPrecios).length
        });

        // Selecciones iniciales
        const seleccionesIniciales: Record<string, string> = {};
        dataProductos?.forEach(prod => {
          const varianteAsociada = dataVariantes?.find(v => v.producto_id === prod.id);
          if (varianteAsociada) seleccionesIniciales[prod.id] = varianteAsociada.id;
        });
        setSeleccionGramaje(seleccionesIniciales);

      } catch (err: unknown) {
        let message = 'Error de conexión con la base de datos.';
        if (err instanceof Error) message = err.message;
        console.error("Error detectado en cargarDatos:", err);
        setErrorCritico(message);
      } finally {
        // Garantizamos que la pantalla de carga se quite pase lo que pase
        setLoading(false);
      }
    };

    cargarDatos();
  }, [router]);

  const cerrarSesion = () => {
    localStorage.removeItem('seimenjo_session');
    router.push('/');
  };

  const modificarCarrito = (varianteId: string, operacion: 'sumar' | 'restar') => {
    setCarrito(prev => {
      const itemExistente = prev.find(item => item.variante_id === varianteId);
      const variante = variantes.find(v => v.id === varianteId);
      const producto = productos.find(p => p.id === variante?.producto_id);

      if (!variante || !producto) return prev;

      const precioReal = preciosEspeciales[variante.id] || variante.precio_base;

      if (operacion === 'sumar') {
        if (itemExistente) return prev.map(item => item.variante_id === varianteId ? { ...item, cantidad: item.cantidad + 1 } : item);
        return [...prev, { variante_id: variante.id, producto_nombre: producto.nombre, gramaje: variante.gramaje, cantidad: 1, precio_unitario: precioReal }];
      } else {
        if (itemExistente && itemExistente.cantidad > 1) return prev.map(item => item.variante_id === varianteId ? { ...item, cantidad: item.cantidad - 1 } : item);
        return prev.filter(item => item.variante_id !== varianteId);
      }
    });
  };

  const fijarCantidadCarrito = (varianteId: string, cantidad: number) => {
    const qty = Math.max(0, Math.floor(cantidad));
    setCarrito(prev => {
      const variante = variantes.find(v => v.id === varianteId);
      const producto = productos.find(p => p.id === variante?.producto_id);
      if (!variante || !producto) return prev;

      const precioReal = preciosEspeciales[variante.id] || variante.precio_base;
      const itemExistente = prev.find(item => item.variante_id === varianteId);

      if (qty <= 0) {
        return prev.filter(item => item.variante_id !== varianteId);
      }

      if (itemExistente) {
        return prev.map(item => item.variante_id === varianteId ? { ...item, cantidad: qty } : item);
      } else {
        return [...prev, {
          variante_id: variante.id,
          producto_nombre: producto.nombre,
          gramaje: variante.gramaje,
          cantidad: qty,
          precio_unitario: precioReal
        }];
      }
    });
  };

  const totalCarrito = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);

  const enviarPedido = async () => {
    if (carrito.length === 0) return;

    // Validación OBLIGATORIA de Fecha de Entrega
    if (!fechaEntrega || !fechaEntrega.trim()) {
      alert('⚠️ La Fecha de Entrega es OBLIGATORIA.\n\nPor favor selecciona cuándo necesitas recibir este pedido antes de enviar.');
      return;
    }

    if (fechaEntrega < fechaHoyStr) {
      alert('⚠️ La Fecha de Entrega no puede ser anterior al día de hoy.');
      return;
    }

    setEnviando(true);

    let pedidoId: string | null = null;
    try {
      const sesionInfo = sesion as unknown as { tipo?: string; id?: string; empresa_id?: string; nombre_local?: string; razon_social?: string; [key: string]: unknown };
      // El pedido pertenece a la empresa que vende (Playa Seimenjo)
      const pedidoEmpresaId = sesionInfo?.empresa_id || '57360007-11ae-4da7-a08c-2aa11f691930';

      // 1. Insertar el Pedido (con fecha_entrega obligatoria)
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          cliente_id: sesionInfo?.tipo === 'b2b' ? sesionInfo.id : null,
          empresa_id: pedidoEmpresaId,
          precio_total: totalCarrito,
          fecha_entrega: fechaEntrega,
          comentarios: comentarios || null
        })
        .select('id')
        .single();

      if (pedidoError) throw pedidoError;
      pedidoId = pedidoData.id;

      // 2. Insertar Detalles con validación de UUID
      const detallesAInsertar = carrito.map(item => ({
        pedido_id: pedidoId, 
        variante_id: item.variante_id, 
        cantidad: item.cantidad,
        precio_aplicado: item.precio_unitario,
        subtotal: item.cantidad * item.precio_unitario,
        empresa_id: pedidoEmpresaId
      }));

      const { error: detallesError } = await supabase
        .from('pedido_detalles')
        .insert(detallesAInsertar);

      if (detallesError) throw detallesError;

      // 3. Notificación al Bot de Telegram
      if (pedidoId) {
        try {
          await notificarPedidoTelegramAction(pedidoId);
        } catch (tgErr) {
          console.warn('[Telegram] Error enviando alerta a Telegram:', tgErr);
        }
      }

      // Éxito
      setUltimoPedidoFechaEntrega(fechaEntrega);
      setPedidoExitoso(true);
      setCarrito([]);
      setComentarios('');
      setFechaEntrega(getFechaOffsetStr(1)); // Restaurar a mañana por defecto
      setCarritoMovilAbierto(false);
      if (sesionInfo?.id) {
        cargarMisPedidos(sesionInfo.id);
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error("Error al procesar el pedido:", err);
      alert(`Error al enviar: ${message}`);

      // Limpiar pedido huérfano si fallaron los detalles para evitar registros duplicados/incompletos
      if (pedidoId) {
        await supabase.from('pedidos').delete().eq('id', pedidoId);
      }
    } finally {
      setEnviando(false);
    }
  };

  const getBadgeEstatusPedido = (estatus: string) => {
    switch (estatus?.toLowerCase()) {
      case 'entregado':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60',
          label: 'Entregado',
          icon: CheckCircle
        };
      case 'en producción':
      case 'en produccion':
      case 'produccion':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60',
          label: 'En Producción',
          icon: Truck
        };
      case 'cancelado':
        return {
          bg: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60',
          label: 'Cancelado',
          icon: AlertTriangle
        };
      default:
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60',
          label: estatus || 'Pendiente',
          icon: Clock
        };
    }
  };

  if (loading) return (
    <div className={`${isDarkMode ? 'dark' : ''} min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors`}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
    </div>
  );

  if (errorCritico) return (
    <div className={`${isDarkMode ? 'dark' : ''} min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 text-center transition-colors`}>
      <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Algo salió mal</h2>
      <p className="text-gray-600 dark:text-gray-450 max-w-md">{errorCritico}</p>
      <button onClick={() => window.location.reload()} className="mt-6 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-bold">Reintentar</button>
    </div>
  );

  if (pedidoExitoso) return (
    <div className={`${isDarkMode ? 'dark' : ''} min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 text-center transition-colors`}>
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 sm:p-12 max-w-md w-full shadow-2xl flex flex-col items-center">
        <CheckCircle2 className="w-20 h-20 text-emerald-500 mb-4 animate-bounce" />
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 font-sans">¡Pedido Recibido!</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4 font-sans text-sm">
          Tu solicitud fue registrada con éxito en estatus <strong className="text-amber-600 dark:text-amber-400">Pendiente</strong>. Nuestro equipo de cocina la procesará a la brevedad.
        </p>
        {ultimoPedidoFechaEntrega && (
          <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-center gap-2 w-full">
            <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Fecha de entrega programada: <strong className="capitalize">{formatearFechaEntrega(ultimoPedidoFechaEntrega)}</strong></span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => {
              setPedidoExitoso(false);
              setActiveTab('pedidos');
              if (sesion?.id) cargarMisPedidos(sesion.id);
            }}
            className="flex-1 bg-amber-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-amber-500 transition shadow-lg flex items-center justify-center gap-2 text-sm"
          >
            <Package className="w-4 h-4" />
            Ver mis pedidos
          </button>
          <button
            onClick={() => setPedidoExitoso(false)}
            className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm"
          >
            Hacer otro pedido
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`${isDarkMode ? 'dark' : ''} min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col transition-colors`}>
      {/* CABECERA PRINCIPAL Y NAV DE PESTAÑAS */}
      <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4 sm:space-x-8">
              <div className="flex items-center">
                {empresaLogoUrl && !logoError ? (
                  <Image src={empresaLogoUrl} alt="Logo" onError={() => setLogoError(true)} width={32} height={32} className="h-8 w-8 rounded-lg object-contain mr-2 border border-amber-100 dark:border-amber-900 bg-white shadow-sm" />
                ) : (
                  <Sparkles className="h-6 w-6 text-amber-500 mr-2 animate-pulse" />
                )}
                <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight font-sans hidden sm:inline">{empresaNombre}</span>
              </div>
              <nav className="flex space-x-1 sm:space-x-2" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('comprar')}
                  className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${activeTab === 'comprar'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900'
                    }`}
                >
                  🛒 Solicitar Pedido
                </button>
                {sesion?.tipo === 'b2b' && (
                  <>
                    <button
                      onClick={() => {
                        setActiveTab('pedidos');
                        if (sesion?.id) cargarMisPedidos(sesion.id);
                      }}
                      className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${activeTab === 'pedidos'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900'
                        }`}
                    >
                      <Package className="w-4 h-4" />
                      <span>Mis Pedidos</span>
                      {misPedidos.length > 0 && (
                        <span className="ml-1 text-[11px] bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-extrabold px-1.5 py-0.2 rounded-full">
                          {misPedidos.length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('facturas');
                        if (sesion?.id) cargarFacturas(sesion.id);
                      }}
                      className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${activeTab === 'facturas'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900'
                        }`}
                    >
                      📄 Facturas
                    </button>
                    <button
                      onClick={() => setModalDatosFiscalesOpen(true)}
                      className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900"
                      title="Ver y actualizar datos fiscales CFDI 4.0"
                    >
                      <Building2 className="w-4 h-4 text-amber-500" />
                      <span className="hidden sm:inline">Datos Fiscales</span>
                      <span className="sm:hidden">Fiscal</span>
                    </button>
                  </>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              {activeTab === 'comprar' && (
                <button
                  type="button"
                  onClick={() => setCarritoMovilAbierto(true)}
                  className="md:hidden relative p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold transition-all flex items-center justify-center"
                  title="Ver carrito de compras"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {totalItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-md animate-pulse">
                      {totalItems}
                    </span>
                  )}
                </button>
              )}
              <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400">
                Cliente: <span className="font-semibold text-amber-600 dark:text-amber-400">{sesion?.nombre_local || sesion?.email}</span>
              </span>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-gray-150 dark:bg-gray-800 text-gray-600 dark:text-amber-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                onClick={cerrarSesion}
                className="flex items-center text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-bold bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-1.5 rounded-lg transition-all"
              >
                <LogOut className="w-4 h-4 mr-1.5" /> Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {activeTab === 'comprar' ? (
          <>
            {/* SECCIÓN IZQUIERDA: CATÁLOGO */}
            <div className="flex-1 p-4 sm:p-6 pb-28 md:pb-6 overflow-y-auto bg-gray-50 dark:bg-gray-900 transition-colors">
              <div className="mb-6">
                <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Catálogo de Productos</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Agrega productos a tu carrito y envía tu orden en segundos.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {productos.map(producto => {
                  const variantesProducto = variantes.filter(v => v.producto_id === producto.id);
                  const varianteSeleccionadaId = seleccionGramaje[producto.id];
                  const varianteActiva = variantesProducto.find(v => v.id === varianteSeleccionadaId);

                  const precioBase = varianteActiva?.precio_base || 0;
                  const precioPactado = varianteActiva ? preciosEspeciales[varianteActiva.id] : undefined;
                  const tienePrecioEspecial = precioPactado !== undefined;

                  const itemEnCarrito = carrito.find(item => item.variante_id === varianteSeleccionadaId);

                  return (
                    <div key={producto.id} className="bg-white dark:bg-gray-950 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-all flex flex-col justify-between">
                      {/* Imagen si existe, o cabecera compacta si no existe */}
                      {producto.imagen_url ? (
                        <div className="h-36 w-full relative overflow-hidden bg-gray-100 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={producto.imagen_url}
                            alt={producto.nombre}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-black/60 text-amber-400 backdrop-blur-sm border border-amber-400/30 shadow-sm">
                            {producto.categoria}
                          </span>
                        </div>
                      ) : (
                        <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            {producto.categoria}
                          </span>
                        </div>
                      )}

                      <div className="p-5 pt-3 flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 leading-snug">
                            {producto.nombre}
                          </h3>

                          <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">
                            Presentación (Gramaje)
                          </label>
                          {variantesProducto.length <= 1 ? (
                            <div className="w-full py-2 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-xs mb-4 text-gray-800 dark:text-gray-200 font-medium">
                              {variantesProducto[0]?.gramaje || 'Única'}
                            </div>
                          ) : (
                            <select
                              className="w-full py-2 px-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg shadow-sm focus:border-amber-500 focus:ring-amber-500 text-xs mb-4 outline-none font-medium cursor-pointer"
                              value={varianteSeleccionadaId || ''}
                              onChange={(e) => setSeleccionGramaje({ ...seleccionGramaje, [producto.id]: e.target.value })}
                            >
                              {variantesProducto.map(v => (
                                <option key={v.id} value={v.id}>{v.gramaje}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800/80 mt-2">
                          <div>
                            {tienePrecioEspecial ? (
                              <>
                                <p className="text-[10px] text-red-500 line-through font-semibold">${precioBase.toFixed(2)} MXN</p>
                                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">${precioPactado.toFixed(2)}</p>
                              </>
                            ) : (
                              <p className="text-xl font-black text-gray-900 dark:text-white">${precioBase.toFixed(2)}</p>
                            )}
                          </div>

                          {/* Selector de cantidad numérico con teclado directo y botones +/- */}
                          <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-1 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <button
                              type="button"
                              onClick={() => varianteActiva && modificarCarrito(varianteActiva.id, 'restar')}
                              className="w-7 h-7 flex items-center justify-center rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition shadow-sm"
                              title="Restar 1"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>

                            <input
                              type="number"
                              min="0"
                              max="9999"
                              value={itemEnCarrito?.cantidad || 0}
                              onChange={(e) => {
                                if (varianteActiva) {
                                  const val = parseInt(e.target.value, 10);
                                  fijarCantidadCarrito(varianteActiva.id, isNaN(val) ? 0 : val);
                                }
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-14 text-center font-black text-sm bg-transparent text-gray-900 dark:text-white focus:outline-none focus:bg-amber-50 dark:focus:bg-amber-950/30 focus:ring-1 focus:ring-amber-500 rounded mx-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="0"
                              title="Escribe la cantidad directamente (ej. 90)"
                            />

                            <button
                              type="button"
                              onClick={() => varianteActiva && modificarCarrito(varianteActiva.id, 'sumar')}
                              className="w-7 h-7 flex items-center justify-center rounded bg-amber-600 text-white hover:bg-amber-500 active:scale-95 transition shadow-sm"
                              title="Sumar 1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RENDERIZADO DEL PANEL DE CHECKOUT COMPARTIDO */}
            {(() => null)()}

            {/* SECCIÓN DERECHA: CARRITO Y CHECKOUT EN ESCRITORIO */}
            <div className="hidden md:flex md:w-96 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-xl flex-col h-[calc(100vh-4rem)] sticky top-16 transition-colors">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-amber-500/10 dark:bg-amber-500/5">
                <h2 className="text-base font-bold text-amber-900 dark:text-amber-400 flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2" /> Mi Orden
                </h2>
                <span className="bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full">
                  {totalItems} items
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {carrito.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <ShoppingCart className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm">Tu orden está vacía</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {carrito.map(item => (
                      <div key={item.variante_id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-2xs">
                        <div className="flex-1 pr-2">
                          <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{item.producto_nombre}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.gramaje} • ${(item.precio_unitario).toFixed(2)} c/u</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 shadow-xs">
                            <button
                              type="button"
                              onClick={() => modificarCarrito(item.variante_id, 'restar')}
                              className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                              title="Restar 1"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="9999"
                              value={item.cantidad}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                fijarCantidadCarrito(item.variante_id, isNaN(val) ? 0 : val);
                              }}
                              onFocus={(e) => e.target.select()}
                              className="w-12 text-center text-xs font-black bg-transparent text-gray-900 dark:text-white focus:outline-none focus:bg-amber-50 dark:focus:bg-amber-950/30 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              title="Escribe la cantidad directamente"
                            />
                            <button
                              type="button"
                              onClick={() => modificarCarrito(item.variante_id, 'sumar')}
                              className="w-6 h-6 flex items-center justify-center text-white bg-amber-600 hover:bg-amber-500 rounded transition"
                              title="Sumar 1"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-sm font-black text-gray-900 dark:text-white w-16 text-right">${(item.cantidad * item.precio_unitario).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
                {/* Selector de Fecha de Entrega - DESTACADO Y OBLIGATORIO */}
                <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/70 dark:from-amber-950/30 dark:to-orange-950/20 border-2 border-amber-400 dark:border-amber-500/80 rounded-2xl shadow-sm mb-4 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      Fecha de Entrega
                      <span className="text-[10px] bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-black tracking-normal uppercase border border-red-300 dark:border-red-800">
                        Obligatorio *
                      </span>
                    </label>
                  </div>

                  <p className="text-[11px] text-amber-800 dark:text-amber-300/90 font-medium mb-2.5">
                    ¿Cuándo necesitas recibir este pedido?
                  </p>

                  {/* Acceso rápido a fechas frecuentes */}
                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                    <button
                      type="button"
                      onClick={() => setFechaEntrega(fechaHoyStr)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border-2 transition-all flex flex-col items-center justify-center min-h-[46px] active:scale-95 ${
                        fechaEntrega === fechaHoyStr
                          ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400/50'
                          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-800 hover:border-amber-400'
                      }`}
                    >
                      <span>Hoy</span>
                      <span className="text-[10px] font-normal opacity-85">{fechaHoyStr.slice(8)}/{fechaHoyStr.slice(5, 7)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFechaEntrega(fechaMananaStr)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border-2 transition-all flex flex-col items-center justify-center min-h-[46px] active:scale-95 ${
                        fechaEntrega === fechaMananaStr
                          ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400/50'
                          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-800 hover:border-amber-400'
                      }`}
                    >
                      <span className="flex items-center gap-0.5">Mañana ⭐</span>
                      <span className="text-[10px] font-normal opacity-85">{fechaMananaStr.slice(8)}/{fechaMananaStr.slice(5, 7)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFechaEntrega(fechaPasadoStr)}
                      className={`py-2 px-1 text-xs font-bold rounded-xl border-2 transition-all flex flex-col items-center justify-center min-h-[46px] active:scale-95 ${
                        fechaEntrega === fechaPasadoStr
                          ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400/50'
                          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-800 hover:border-amber-400'
                      }`}
                    >
                      <span>Pasado mñn</span>
                      <span className="text-[10px] font-normal opacity-85">{fechaPasadoStr.slice(8)}/{fechaPasadoStr.slice(5, 7)}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                      O elige otra fecha en el calendario:
                    </label>
                    <input
                      type="date"
                      min={fechaHoyStr}
                      required
                      value={fechaEntrega}
                      onChange={(e) => setFechaEntrega(e.target.value)}
                      className="w-full text-xs font-bold border-2 border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl shadow-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none p-2.5 cursor-pointer"
                      style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                    />
                  </div>

                  {fechaEntrega ? (
                    <div className="mt-2.5 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                      <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="leading-tight">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold uppercase">Entrega programada:</span>
                        <strong className="capitalize text-emerald-950 dark:text-emerald-100 text-xs">{formatearFechaEntrega(fechaEntrega, true)}</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 p-2 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>⚠️ Selecciona la fecha de entrega</span>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-amber-500" />
                    Notas / Comentarios (opcional)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl p-2.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none shadow-xs"
                    placeholder="Instrucciones especiales, horario de entrega, etc..."
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                  />
                </div>

                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-600 dark:text-gray-400 font-semibold text-sm">Total a Pagar</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">${totalCarrito.toFixed(2)}</span>
                </div>

                <button
                  type="button"
                  onClick={enviarPedido}
                  disabled={carrito.length === 0 || enviando}
                  className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-98 focus:outline-none disabled:opacity-50 transition-all cursor-pointer"
                >
                  {enviando ? 'Procesando Pedido...' : 'Confirmar y Enviar Pedido'}
                  {!enviando && <Send className="w-4 h-4 ml-2" />}
                </button>
              </div>
            </div>

            {/* BARRA FLOTANTE INFERIOR EN MÓVIL */}
            {activeTab === 'comprar' && carrito.length > 0 && !carritoMovilAbierto && (
              <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t-2 border-amber-400 dark:border-amber-600/80 shadow-2xl">
                <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 font-bold">
                      <Truck className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[170px]">
                        Entrega: {fechaEntrega === fechaHoyStr ? 'Hoy' : fechaEntrega === fechaMananaStr ? 'Mañana' : fechaEntrega}
                      </span>
                    </div>
                    <div className="text-base font-black text-gray-900 dark:text-white leading-tight">
                      ${totalCarrito.toFixed(2)} <span className="text-xs font-normal text-gray-500">({totalItems} items)</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCarritoMovilAbierto(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-2.5 px-4 rounded-xl shadow-md flex items-center gap-1.5 text-sm transition-all shrink-0"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Ver Orden ({totalItems})</span>
                  </button>
                </div>
              </div>
            )}

            {/* MODAL DESLIZANTE DE CHECKOUT EN MÓVIL */}
            {carritoMovilAbierto && (
              <div className="fixed inset-0 z-50 md:hidden flex flex-col bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                <div className="mt-auto bg-white dark:bg-gray-950 rounded-t-3xl max-h-[92vh] flex flex-col shadow-2xl border-t border-gray-200 dark:border-gray-800 animate-in slide-in-from-bottom duration-300">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-amber-500/10 dark:bg-amber-500/5 rounded-t-3xl">
                    <h2 className="text-base font-bold text-amber-900 dark:text-amber-400 flex items-center">
                      <ShoppingCart className="w-5 h-5 mr-2" /> Mi Orden ({totalItems} items)
                    </h2>
                    <button
                      type="button"
                      onClick={() => setCarritoMovilAbierto(false)}
                      className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                      title="Cerrar orden"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="overflow-y-auto flex-1 p-4 space-y-4">
                    {/* Lista de productos */}
                    {carrito.length === 0 ? (
                      <div className="py-8 text-center text-gray-400">
                        <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Tu orden está vacía</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {carrito.map(item => (
                          <div key={item.variante_id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-2xs">
                            <div className="flex-1 pr-2">
                              <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{item.producto_nombre}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.gramaje} • ${(item.precio_unitario).toFixed(2)} c/u</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 shadow-xs">
                                <button
                                  type="button"
                                  onClick={() => modificarCarrito(item.variante_id, 'restar')}
                                  className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-white rounded active:scale-95"
                                  title="Restar 1"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max="9999"
                                  value={item.cantidad}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    fijarCantidadCarrito(item.variante_id, isNaN(val) ? 0 : val);
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  className="w-12 text-center text-xs font-black bg-transparent text-gray-900 dark:text-white focus:outline-none focus:bg-amber-50 dark:focus:bg-amber-950/30 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => modificarCarrito(item.variante_id, 'sumar')}
                                  className="w-7 h-7 flex items-center justify-center text-white bg-amber-600 hover:bg-amber-500 rounded active:scale-95"
                                  title="Sumar 1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <p className="text-sm font-black text-gray-900 dark:text-white w-16 text-right">${(item.cantidad * item.precio_unitario).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selector de Fecha de Entrega Móvil */}
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/70 dark:from-amber-950/30 dark:to-orange-950/20 border-2 border-amber-400 dark:border-amber-500/80 rounded-2xl shadow-sm transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          Fecha de Entrega
                          <span className="text-[10px] bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-black tracking-normal uppercase border border-red-300 dark:border-red-800">
                            Obligatorio *
                          </span>
                        </label>
                      </div>

                      <p className="text-[11px] text-amber-800 dark:text-amber-300/90 font-medium mb-2.5">
                        ¿Cuándo necesitas recibir este pedido?
                      </p>

                      {/* Botones táctiles grandes para dedo en móvil */}
                      <div className="grid grid-cols-3 gap-2 mb-2.5">
                        <button
                          type="button"
                          onClick={() => setFechaEntrega(fechaHoyStr)}
                          className={`py-2 px-1 text-xs font-bold rounded-xl border-2 transition-all flex flex-col items-center justify-center min-h-[48px] active:scale-95 ${
                            fechaEntrega === fechaHoyStr
                              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400/50'
                              : 'bg-white dark:bg-gray-900 text-gray-750 dark:text-gray-200 border-gray-200 dark:border-gray-800 hover:border-amber-400'
                          }`}
                        >
                          <span>Hoy</span>
                          <span className="text-[10px] font-normal opacity-85">{fechaHoyStr.slice(8)}/{fechaHoyStr.slice(5, 7)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFechaEntrega(fechaMananaStr)}
                          className={`py-2 px-1 text-xs font-bold rounded-xl border-2 transition-all flex flex-col items-center justify-center min-h-[48px] active:scale-95 ${
                            fechaEntrega === fechaMananaStr
                              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400/50'
                              : 'bg-white dark:bg-gray-900 text-gray-750 dark:text-gray-200 border-gray-200 dark:border-gray-800 hover:border-amber-400'
                          }`}
                        >
                          <span className="flex items-center gap-0.5">Mañana ⭐</span>
                          <span className="text-[10px] font-normal opacity-85">{fechaMananaStr.slice(8)}/{fechaMananaStr.slice(5, 7)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFechaEntrega(fechaPasadoStr)}
                          className={`py-2 px-1 text-xs font-bold rounded-xl border-2 transition-all flex flex-col items-center justify-center min-h-[48px] active:scale-95 ${
                            fechaEntrega === fechaPasadoStr
                              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-400/50'
                              : 'bg-white dark:bg-gray-900 text-gray-750 dark:text-gray-200 border-gray-200 dark:border-gray-800 hover:border-amber-400'
                          }`}
                        >
                          <span>Pasado mñn</span>
                          <span className="text-[10px] font-normal opacity-85">{fechaPasadoStr.slice(8)}/{fechaPasadoStr.slice(5, 7)}</span>
                        </button>
                      </div>

                      <div className="relative">
                        <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                          O elige otra fecha en el calendario:
                        </label>
                        <input
                          type="date"
                          min={fechaHoyStr}
                          required
                          value={fechaEntrega}
                          onChange={(e) => setFechaEntrega(e.target.value)}
                          className="w-full text-xs font-bold border-2 border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl shadow-xs focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none p-2.5 cursor-pointer"
                          style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                        />
                      </div>

                      {fechaEntrega ? (
                        <div className="mt-2.5 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                          <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div className="leading-tight">
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold uppercase">Entrega programada:</span>
                            <strong className="capitalize text-emerald-950 dark:text-emerald-100 text-xs">{formatearFechaEntrega(fechaEntrega, true)}</strong>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2.5 p-2 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xl text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>⚠️ Selecciona la fecha de entrega</span>
                        </div>
                      )}
                    </div>

                    {/* Notas / comentarios */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-500" />
                        Notas / Comentarios (opcional)
                      </label>
                      <textarea
                        rows={2}
                        className="w-full text-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl p-2.5 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none shadow-xs"
                        placeholder="Instrucciones especiales, horario de entrega, etc..."
                        value={comentarios}
                        onChange={(e) => setComentarios(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Footer móvil con total y botón */}
                  <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-600 dark:text-gray-400 font-semibold text-sm">Total a Pagar</span>
                      <span className="text-2xl font-black text-gray-900 dark:text-white">${totalCarrito.toFixed(2)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={enviarPedido}
                      disabled={carrito.length === 0 || enviando}
                      className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-98 focus:outline-none disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {enviando ? 'Procesando Pedido...' : 'Confirmar y Enviar Pedido'}
                      {!enviando && <Send className="w-4 h-4 ml-2" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'pedidos' ? (
          /* PESTAÑA DE MIS PEDIDOS */
          <div className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full bg-gray-50 dark:bg-gray-900 transition-colors">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center">
                  <Package className="w-6 h-6 mr-2 text-amber-500" /> Mis Pedidos
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Da seguimiento al estado de tus órdenes, producción y entrega.
                </p>
              </div>
              <button
                onClick={() => sesion?.id && cargarMisPedidos(sesion.id)}
                disabled={loadingPedidos}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPedidos ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>

            {errorPedidos && (
              <div className="bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-4 rounded-xl mb-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{errorPedidos}</p>
              </div>
            )}

            {loadingPedidos ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600 mb-3"></div>
                <p className="text-gray-500 text-sm font-medium">Cargando tus pedidos...</p>
              </div>
            ) : misPedidos.length === 0 ? (
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center shadow-sm">
                <Package className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">Aún no tienes pedidos registrados</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto mb-6">
                  Explora nuestro catálogo para armar tu orden de ramen y enviarla directamente a cocina.
                </p>
                <button
                  onClick={() => setActiveTab('comprar')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl shadow-lg transition"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Ir al Catálogo de Productos
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {misPedidos.map((pedido) => {
                  const estatusInfo = getBadgeEstatusPedido(pedido.estatus_pedido);
                  const EstatusIcon = estatusInfo.icon;
                  const estaAbierto = !!pedidoDetalleAbierto[pedido.id];
                  const totalItems = pedido.pedido_detalles?.reduce((acc, d) => acc + d.cantidad, 0) || 0;
                  const fechaStr = pedido.creado_en
                    ? new Date(pedido.creado_en).toLocaleString('es-MX', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'N/A';

                  return (
                    <div
                      key={pedido.id}
                      className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow transition overflow-hidden"
                    >
                      {/* Cabecera de la tarjeta del pedido */}
                      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800/60">
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                            <Package className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-extrabold text-gray-900 dark:text-white">
                                Pedido #{pedido.numero_pedido || pedido.id.slice(0, 8)}
                              </span>
                              <span className="text-xs text-gray-450 dark:text-gray-500 font-medium">
                                • {fechaStr}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {totalItems} {totalItems === 1 ? 'artículo' : 'artículos'} solicitados
                              </span>
                              {pedido.fecha_entrega && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-900/40">
                                  <Calendar className="w-3 h-3 text-amber-500" />
                                  Entrega: {formatearFechaEntrega(pedido.fecha_entrega)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Badges de estatus y total */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${estatusInfo.bg}`}>
                            <EstatusIcon className="w-3.5 h-3.5" />
                            <span>{estatusInfo.label}</span>
                          </span>

                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            pedido.estatus_pago?.toLowerCase() === 'liquidado'
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                              : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                          }`}>
                            {pedido.estatus_pago?.toLowerCase() === 'liquidado' ? '💵 Liquidado' : '⏳ Pago Pendiente'}
                          </span>

                          {pedido.facturas_clientes && pedido.facturas_clientes.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                              <FileText className="w-3.5 h-3.5" />
                              Facturado
                            </span>
                          )}

                          <div className="text-right ml-auto sm:ml-2">
                            <div className="text-base font-black text-gray-900 dark:text-white">
                              ${Number(pedido.precio_total).toFixed(2)} <span className="text-xs font-normal text-gray-500">MXN</span>
                            </div>
                          </div>

                          <button
                            onClick={() => toggleDetallePedido(pedido.id)}
                            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition"
                            title={estaAbierto ? 'Ocultar detalles' : 'Ver detalles'}
                          >
                            {estaAbierto ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* Detalles del pedido (acordeón desplegable) */}
                      {estaAbierto && (
                        <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-900/40">
                          {/* Factura del pedido si existe */}
                          {pedido.facturas_clientes && pedido.facturas_clientes.length > 0 && (
                            <div className="mb-4 p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                      Factura Fiscal: {pedido.facturas_clientes[0].serie_folio || 'CFDI Emitido'}
                                    </span>
                                  </div>
                                  {pedido.facturas_clientes[0].uuid_fiscal && (
                                    <p className="font-mono text-[10px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
                                      UUID: {pedido.facturas_clientes[0].uuid_fiscal}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {pedido.facturas_clientes[0].xml_url && (
                                    <button
                                      onClick={() => descargarArchivo(pedido.facturas_clientes![0].xml_url!)}
                                      disabled={descargandoDoc === pedido.facturas_clientes[0].xml_url}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50"
                                      title="Descargar XML"
                                    >
                                      {descargandoDoc === pedido.facturas_clientes[0].xml_url ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <FileCode className="w-3.5 h-3.5" />
                                      )}
                                      XML
                                    </button>
                                  )}
                                  {pedido.facturas_clientes[0].pdf_url ? (
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => descargarArchivo(pedido.facturas_clientes![0].pdf_url!)}
                                        disabled={descargandoDoc === pedido.facturas_clientes[0].pdf_url}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50"
                                        title="Descargar PDF"
                                      >
                                        {descargandoDoc === pedido.facturas_clientes[0].pdf_url ? (
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <FileText className="w-3.5 h-3.5" />
                                        )}
                                        PDF
                                      </button>
                                      {pedido.facturas_clientes[0].xml_url && (
                                        <button
                                          onClick={() => setCfdiViewerState({
                                            open: true,
                                            xmlUrl: pedido.facturas_clientes![0].xml_url!,
                                            serieFolio: pedido.facturas_clientes![0].serie_folio || pedido.facturas_clientes![0].uuid_fiscal
                                          })}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition shadow-sm hover:scale-105 active:scale-95"
                                          title="Ver representación impresa CFDI"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          CFDI
                                        </button>
                                      )}
                                    </div>
                                  ) : pedido.facturas_clientes[0].xml_url ? (
                                    <button
                                      onClick={() => setCfdiViewerState({
                                        open: true,
                                        xmlUrl: pedido.facturas_clientes![0].xml_url!,
                                        serieFolio: pedido.facturas_clientes![0].serie_folio || pedido.facturas_clientes![0].uuid_fiscal
                                      })}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow-sm hover:scale-105 active:scale-95"
                                      title="Ver representación impresa del XML (CFDI)"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      Ver PDF (CFDI)
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          )}

                          {pedido.fecha_entrega && (
                            <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                              <div>
                                <span className="font-bold">Fecha programada de entrega: </span>
                                <span className="capitalize">{formatearFechaEntrega(pedido.fecha_entrega)}</span>
                              </div>
                            </div>
                          )}

                          {pedido.comentarios && (
                            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-900 dark:text-amber-200">
                              <span className="font-bold block mb-0.5">Instrucciones de entrega:</span>
                              <p className="italic">{pedido.comentarios}</p>
                            </div>
                          )}

                          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                            Productos Solicitados
                          </h4>

                          <div className="space-y-2">
                            {pedido.pedido_detalles && pedido.pedido_detalles.length > 0 ? (
                              pedido.pedido_detalles.map((detalle) => {
                                const prodNombre = detalle.producto_variantes?.productos?.nombre || 'Producto';
                                const prodGramaje = detalle.producto_variantes?.gramaje || '';

                                return (
                                  <div
                                    key={detalle.id}
                                    className="flex justify-between items-center bg-white dark:bg-gray-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800 text-sm"
                                  >
                                    <div>
                                      <p className="font-bold text-gray-900 dark:text-white">
                                        {prodNombre}
                                      </p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {prodGramaje && `${prodGramaje} • `}
                                        {detalle.cantidad} {detalle.cantidad === 1 ? 'unidad' : 'unidades'} x ${Number(detalle.precio_aplicado).toFixed(2)}
                                      </p>
                                    </div>
                                    <div className="text-right font-bold text-gray-900 dark:text-white">
                                      ${Number(detalle.subtotal).toFixed(2)}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-xs text-gray-450 dark:text-gray-500 italic">No hay desglose de productos disponible.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* PESTAÑA DE MIS FACTURAS */
          <div className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full bg-gray-50 dark:bg-gray-900 transition-colors">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center">
                  <FileText className="w-6 h-6 mr-2 text-amber-500" /> Historial de Facturas
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Consulta y descarga tus facturas fiscales en formato XML y PDF.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalDatosFiscalesOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold shadow-sm transition-all"
                  title="Ver y actualizar datos fiscales para facturación CFDI 4.0"
                >
                  <Building2 className="w-4 h-4 text-amber-500" />
                  Mis Datos Fiscales
                </button>
                <button
                  onClick={() => sesion?.id && cargarFacturas(sesion.id)}
                  disabled={loadingFacturas}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingFacturas ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>
            </div>

            {errorFacturas && (
              <div className="bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-900/50 p-4 rounded-xl mb-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{errorFacturas}</p>
              </div>
            )}

            {loadingFacturas ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600 mb-3"></div>
                <p className="text-gray-500 text-sm font-medium">Cargando facturas...</p>
              </div>
            ) : facturas.length === 0 ? (
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center shadow-sm">
                <FileText className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">Sin facturas emitidas</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
                  Actualmente no tienes facturas registradas en este portal. Una vez que tus pedidos sean entregados y facturados, aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-bold text-gray-500 dark:text-gray-450 uppercase">
                        <th className="p-4">UUID Fiscal / Folio</th>
                        <th className="p-4">Pedido Relacionado</th>
                        <th className="p-4">Fecha Emisión</th>
                        <th className="p-4 text-right">Total</th>
                        <th className="p-4">Estatus Factura</th>
                        <th className="p-4 text-center">Descargas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-850 text-sm">
                      {facturas.map((fac) => {
                        const esEntregado = fac.pedidos?.estatus_pedido === 'Entregado';
                        const numPedido = fac.pedidos?.numero_pedido || 'N/A';
                        const tieneXml = Boolean(fac.xml_url);
                        const tienePdf = Boolean(fac.pdf_url);
                        const tieneArchivos = tieneXml || tienePdf;

                        return (
                          <tr key={fac.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                            <td className="p-4">
                              <div className="font-mono text-xs font-bold text-gray-900 dark:text-white" title={fac.uuid_fiscal}>
                                {fac.serie_folio || (fac.uuid_fiscal ? `${fac.uuid_fiscal.substring(0, 8)}...` : 'Sin Folio')}
                              </div>
                              <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">{fac.uuid_fiscal || 'Sin UUID'}</div>
                            </td>
                            <td className="p-4">
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded text-xs">
                                #{numPedido}
                              </span>
                            </td>
                            <td className="p-4 text-gray-600 dark:text-gray-450">
                              {fac.fecha_emision ? new Date(fac.fecha_emision).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="p-4 text-right font-bold text-gray-900 dark:text-white">
                              ${Number(fac.total || 0).toFixed(2)} MXN
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${fac.estatus_factura?.nombre === 'Facturado'
                                  ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/50'
                                  : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                                }`}>
                                {fac.estatus_factura?.nombre || 'Desconocido'}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              {tieneArchivos ? (
                                <div className="flex justify-center items-center gap-2">
                                  {tieneXml ? (
                                    <button
                                      onClick={() => descargarArchivo(fac.xml_url)}
                                      disabled={descargandoDoc === fac.xml_url}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 rounded-lg text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50"
                                      title="Descargar archivo XML"
                                    >
                                      {descargandoDoc === fac.xml_url ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <FileCode className="w-3.5 h-3.5" />
                                      )}
                                      XML
                                    </button>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                  {tienePdf ? (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => descargarArchivo(fac.pdf_url)}
                                        disabled={descargandoDoc === fac.pdf_url}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-lg text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95 disabled:opacity-50"
                                        title="Descargar archivo PDF"
                                      >
                                        {descargandoDoc === fac.pdf_url ? (
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <FileText className="w-3.5 h-3.5" />
                                        )}
                                        PDF
                                      </button>
                                      {tieneXml && (
                                        <button
                                          onClick={() => setCfdiViewerState({
                                            open: true,
                                            xmlUrl: fac.xml_url,
                                            serieFolio: fac.serie_folio || fac.uuid_fiscal
                                          })}
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95"
                                          title="Ver representación impresa CFDI"
                                        >
                                          <Eye className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                          CFDI
                                        </button>
                                      )}
                                    </div>
                                  ) : tieneXml ? (
                                    <button
                                      onClick={() => setCfdiViewerState({
                                        open: true,
                                        xmlUrl: fac.xml_url,
                                        serieFolio: fac.serie_folio || fac.uuid_fiscal
                                      })}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60 rounded-lg text-xs font-bold transition-all shadow-sm hover:scale-105 active:scale-95"
                                      title="Ver representación impresa del XML (CFDI) para consultar o imprimir a PDF"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      Ver PDF (CFDI)
                                    </button>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>
                              ) : !esEntregado && fac.pedidos ? (
                                <div className="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 py-1.5 px-3 rounded-lg w-max mx-auto font-medium">
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Disponible al entregar</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 text-xs italic">
                                  Sin archivos adjuntos
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Representación Impresa CFDI */}
      {cfdiViewerState.open && cfdiViewerState.xmlUrl && (
        <ClienteCfdiModal
          xmlUrl={cfdiViewerState.xmlUrl}
          serieFolio={cfdiViewerState.serieFolio}
          onClose={() => setCfdiViewerState({ open: false, xmlUrl: null })}
        />
      )}

      {/* Modal de Actualización de Datos Fiscales */}
      {modalDatosFiscalesOpen && sesion?.id && (
        <DatosFiscalesModal
          clienteId={sesion.id}
          onClose={() => setModalDatosFiscalesOpen(false)}
          onSaved={(clienteActualizado) => {
            setSesion((prev: any) => {
              const updated = {
                ...prev,
                nombre_local: clienteActualizado.nombre_local || prev?.nombre_local,
                rfc: clienteActualizado.rfc,
                razon_social: clienteActualizado.razon_social,
                email_facturacion: clienteActualizado.email_facturacion
              };
              try {
                localStorage.setItem('seimenjo_session', JSON.stringify(updated));
              } catch {
                // ignore
              }
              return updated;
            });
          }}
        />
      )}
    </div>
  );
}