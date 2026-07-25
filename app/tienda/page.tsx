'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import {
  ShoppingCart, LogOut, Plus, Minus, Send, CheckCircle2, AlertTriangle,
  FileText, FileCode, RefreshCw, Lock, Sparkles, Sun, Moon
} from 'lucide-react';
import Image from 'next/image';
import { useProtectedRoute } from '../../lib/useProtectedRoute';
import { useThemeMode } from '../../lib/useThemeMode';

// Interfaces de tipado
interface Producto { id: string; nombre: string; categoria: string; imagen_url: string; }
interface Variante { id: string; producto_id: string; gramaje: string; precio_base: number; }
interface ItemCarrito { variante_id: string; producto_nombre: string; gramaje: string; cantidad: number; precio_unitario: number; }

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

  const [loading, setLoading] = useState(true);
  const [errorCritico, setErrorCritico] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pedidoExitoso, setPedidoExitoso] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});

  const [seleccionGramaje, setSeleccionGramaje] = useState<Record<string, string>>({});

  // Estados del Portal de Facturas
  const [activeTab, setActiveTab] = useState<'comprar' | 'facturas'>('comprar');
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  const [errorFacturas, setErrorFacturas] = useState('');

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
    try {
      const { data, error } = await supabase.storage.from('facturas').createSignedUrl(path, 60);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        alert("No se pudo generar el enlace de descarga.");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err);
        alert('Error al descargar el archivo: ' + err.message);
      } else {
        console.error(err);
        alert('Error al descargar el archivo');
      }
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

          // Cargar facturas
          cargarFacturas(datosSesion.id);
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

  const totalCarrito = carrito.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);

  const enviarPedido = async () => {
    if (carrito.length === 0) return;
    setEnviando(true);

    let pedidoId: string | null = null;
    try {
      const sesionInfo = sesion as unknown as { tipo?: string; id?: string; empresa_id?: string; [key: string]: unknown };
      // 1. Insertar el Pedido
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          cliente_id: sesionInfo?.tipo === 'b2b' ? sesionInfo.id : null,
          empresa_id: sesionInfo?.empresa_id || null,
          precio_total: totalCarrito,
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
        subtotal: item.cantidad * item.precio_unitario
      }));

      const { error: detallesError } = await supabase
        .from('pedido_detalles')
        .insert(detallesAInsertar);

      if (detallesError) throw detallesError;

      // Éxito
      setPedidoExitoso(true);
      setCarrito([]);
      setComentarios('');
      alert("¡Pedido enviado correctamente!");

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
      <CheckCircle2 className="w-20 h-20 text-emerald-500 mb-4" />
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 font-sans">¡Pedido Recibido!</h2>
      <p className="text-gray-600 dark:text-gray-450 mb-8 font-sans">Tu orden está en estatus Pendiente. La liquidación será contra entrega.</p>
      <button onClick={() => setPedidoExitoso(false)} className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-500 transition shadow-lg">
        Realizar otro pedido
      </button>
    </div>
  );

  

  return (
    <div className={`${isDarkMode ? 'dark' : ''} min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col transition-colors`}>
      {/* CABECERA PRINCIPAL Y NAV DE PESTAÑAS */}
      <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-8">
              <div className="flex items-center">
                {empresaLogoUrl && !logoError ? (
                  <Image src={empresaLogoUrl} alt="Logo" onError={() => setLogoError(true)} width={32} height={32} className="h-8 w-8 rounded-lg object-contain mr-2 border border-amber-100 dark:border-amber-900 bg-white shadow-sm" />
                ) : (
                  <Sparkles className="h-6 w-6 text-amber-500 mr-2 animate-pulse" />
                )}
                <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight font-sans">{empresaNombre}</span>
              </div>
              <nav className="flex space-x-1" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('comprar')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'comprar'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900'
                    }`}
                >
                  🛒 Realizar Pedido
                </button>
                {sesion?.tipo === 'b2b' && (
                  <button
                    onClick={() => {
                      setActiveTab('facturas');
                      if (sesion?.id) cargarFacturas(sesion.id);
                    }}
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'facturas'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900'
                      }`}
                  >
                    📄 Mis Facturas
                  </button>
                )}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
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
            <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900 transition-colors">
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
                    <div key={producto.id} className="bg-white dark:bg-gray-950 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-800 hover:shadow-lg transition-all">
                      <div className="h-36 bg-amber-500/10 dark:bg-amber-500/5 w-full relative flex items-center justify-center border-b border-gray-100 dark:border-gray-800/60">
                        <span className="text-amber-600 dark:text-amber-400 font-extrabold text-xs tracking-widest uppercase">{producto.categoria}</span>
                      </div>

                      <div className="p-5">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4 leading-tight min-h-[2.5rem]">{producto.nombre}</h3>

                        <label className="block text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase mb-1">Presentación (Gramaje)</label>
                        {variantesProducto.length <= 1 ? (
                          <div className="w-full py-2 px-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md text-xs mb-4 text-gray-800 dark:text-gray-200 font-medium">
                            {variantesProducto[0]?.gramaje || 'Única'}
                          </div>
                        ) : (
                          <select
                            className="w-full border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md shadow-sm focus:border-amber-500 focus:ring-amber-500 text-xs mb-4 outline-none"
                            value={varianteSeleccionadaId || ''}
                            onChange={(e) => setSeleccionGramaje({ ...seleccionGramaje, [producto.id]: e.target.value })}
                          >
                            {variantesProducto.map(v => (
                              <option key={v.id} value={v.id}>{v.gramaje}</option>
                            ))}
                          </select>
                        )}

                        <div className="flex items-end justify-between mt-4">
                          <div>
                            {tienePrecioEspecial ? (
                              <>
                                <p className="text-[10px] text-red-500 line-through font-semibold">${precioBase.toFixed(2)} MXN</p>
                                <p className="text-xl font-black text-green-600 dark:text-emerald-500">${precioPactado.toFixed(2)}</p>
                              </>
                            ) : (
                              <p className="text-xl font-black text-gray-900 dark:text-white">${precioBase.toFixed(2)}</p>
                            )}
                          </div>

                          <div className="flex items-center bg-gray-150 dark:bg-gray-900 rounded-lg p-1">
                            <button onClick={() => varianteActiva && modificarCarrito(varianteActiva.id, 'restar')} className="p-1 rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-10 text-center font-bold text-xs text-gray-900 dark:text-white">{itemEnCarrito ? itemEnCarrito.cantidad : 0}</span>
                            <button onClick={() => varianteActiva && modificarCarrito(varianteActiva.id, 'sumar')} className="p-1 rounded bg-amber-600 text-white shadow hover:bg-amber-500 transition">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECCIÓN DERECHA: CARRITO Y CHECKOUT */}
            <div className="w-full md:w-96 bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-xl flex flex-col h-[calc(100vh-4rem)] sticky top-16 transition-colors">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-amber-500/10 dark:bg-amber-500/5">
                <h2 className="text-base font-bold text-amber-900 dark:text-amber-400 flex items-center"><ShoppingCart className="w-5 h-5 mr-2" /> Mi Orden</h2>
                <span className="bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full">{carrito.reduce((acc, item) => acc + item.cantidad, 0)} items</span>
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
                      <div key={item.variante_id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                        <div>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{item.producto_nombre}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.gramaje} x {item.cantidad} uni.</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">${(item.cantidad * item.precio_unitario).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30">
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-450 dark:text-gray-500 uppercase mb-1">Instrucciones</label>
                  <textarea rows={2} className="w-full text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500 outline-none p-2" placeholder="Ej. Entregar por la puerta..." value={comentarios} onChange={(e) => setComentarios(e.target.value)}></textarea>
                </div>

                <div className="flex justify-between items-center mb-6">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">Total a Pagar</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">${totalCarrito.toFixed(2)}</span>
                </div>

                <button onClick={enviarPedido} disabled={carrito.length === 0 || enviando} className="w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none disabled:opacity-50 transition-all">
                  {enviando ? 'Procesando...' : 'Enviar Orden'}
                  {!enviando && <Send className="w-4 h-4 ml-2" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* PESTAÑA DE MIS FACTURAS */
          <div className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full bg-gray-50 dark:bg-gray-900 transition-colors">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center">
                  <FileText className="w-6 h-6 mr-2 text-amber-500" /> Historial de Facturas
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Consulta y descarga tus facturas fiscales en formato XML y PDF.</p>
              </div>
              <button
                onClick={() => sesion?.id && cargarFacturas(sesion.id)}
                disabled={loadingFacturas}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingFacturas ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
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

                        return (
                          <tr key={fac.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors">
                            <td className="p-4">
                              <div className="font-mono text-xs font-bold text-gray-900 dark:text-white" title={fac.uuid_fiscal}>
                                {fac.serie_folio || `${fac.uuid_fiscal.substring(0, 8)}...`}
                              </div>
                              <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">{fac.uuid_fiscal}</div>
                            </td>
                            <td className="p-4">
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded text-xs">
                                #{numPedido}
                              </span>
                            </td>
                            <td className="p-4 text-gray-600 dark:text-gray-450">
                              {new Date(fac.fecha_emision).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right font-bold text-gray-900 dark:text-white">
                              ${Number(fac.total).toFixed(2)} MXN
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
                              {esEntregado ? (
                                <div className="flex justify-center gap-2">
                                  {fac.xml_url ? (
                                    <button
                                      onClick={() => descargarArchivo(fac.xml_url)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 rounded-lg text-xs font-bold transition-all shadow-sm"
                                      title="Descargar XML"
                                    >
                                      <FileCode className="w-3.5 h-3.5" />
                                      XML
                                    </button>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                  {fac.pdf_url ? (
                                    <button
                                      onClick={() => descargarArchivo(fac.pdf_url)}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 rounded-lg text-xs font-bold transition-all shadow-sm"
                                      title="Descargar PDF"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      PDF
                                    </button>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 py-1.5 px-3 rounded-lg w-max mx-auto font-medium">
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Disponible al entregar</span>
                                </div>
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
    </div>
  );
}