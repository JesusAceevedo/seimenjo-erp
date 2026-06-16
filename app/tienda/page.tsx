'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { 
  ShoppingCart, LogOut, Plus, Minus, Send, CheckCircle2, AlertTriangle, 
  FileText, FileCode, Download, RefreshCw, Lock, Sparkles
} from 'lucide-react';
import { useProtectedRoute } from '../../lib/useProtectedRoute';

// Interfaces de tipado
interface Producto { id: string; nombre: string; categoria: string; imagen_url: string; }
interface Variante { id: string; producto_id: string; gramaje: string; precio_base: number; }
interface ItemCarrito { variante_id: string; producto_nombre: string; gramaje: string; cantidad: number; precio_unitario: number; }

export default function Tienda() {
  useProtectedRoute(); // Protege esta ruta - redirige a login si no hay sesión
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);
  
  const [productos, setProductos] = useState<Producto[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [preciosEspeciales, setPreciosEspeciales] = useState<Record<string, number>>({});
  
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [comentarios, setComentarios] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [errorCritico, setErrorCritico] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [pedidoExitoso, setPedidoExitoso] = useState(false);

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
    } catch (err: any) {
      console.error("Error al cargar facturas:", err);
      setErrorFacturas(err.message || 'Error al cargar las facturas');
    } finally {
      setLoadingFacturas(false);
    }
  };

  const descargarArchivo = async (path: string, type: 'xml' | 'pdf') => {
    try {
      const { data, error } = await supabase.storage.from('facturas').createSignedUrl(path, 60);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        alert("No se pudo generar el enlace de descarga.");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error al descargar el archivo: " + err.message);
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

        // 1. Cargar Productos
        const { data: dataProductos, error: errProd } = await supabase.from('productos').select('*');
        if (errProd) throw new Error(`Fallo al cargar productos: ${errProd.message}`);
        
        // 2. Cargar Variantes
        const { data: dataVariantes, error: errVar } = await supabase.from('producto_variantes').select('*');
        if (errVar) throw new Error(`Fallo al cargar variantes: ${errVar.message}`);
        
        // 3. Cargar Precios Especiales e Información de la Sucursal (empresa_id)
        let mapaPrecios: Record<string, number> = {};
        let clientEmpresaId = datosSesion.empresa_id || null;

        if (datosSesion.tipo === 'b2b' && datosSesion.id) {
          // Si no está en la sesión guardada en localStorage, lo obtenemos de la base de datos
          if (!clientEmpresaId) {
            const { data: clientData } = await supabase
              .from('clientes')
              .select('empresa_id')
              .eq('id', datosSesion.id)
              .maybeSingle();
            if (clientData) {
              clientEmpresaId = clientData.empresa_id;
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

        // Selecciones iniciales
        const seleccionesIniciales: Record<string, string> = {};
        dataProductos?.forEach(prod => {
          const varianteAsociada = dataVariantes?.find(v => v.producto_id === prod.id);
          if (varianteAsociada) seleccionesIniciales[prod.id] = varianteAsociada.id;
        });
        setSeleccionGramaje(seleccionesIniciales);
        
      } catch (error: any) {
        console.error("Error detectado en cargarDatos:", error);
        setErrorCritico(error.message || 'Error de conexión con la base de datos.');
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

  try {
    // 1. Insertar el Pedido
    const { data: pedidoData, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        cliente_id: sesion?.tipo === 'b2b' ? sesion.id : null,
        empresa_id: sesion?.empresa_id || null,
        precio_total: totalCarrito,
        comentarios: comentarios || null
      })
      .select('id')
      .single();

    if (pedidoError) throw pedidoError;

    // 2. Insertar Detalles con validación de UUID
    // Nos aseguramos de que el pedido_id sea un string limpio
    const pedidoId = pedidoData.id; 

    const detallesAInsertar = carrito.map(item => ({
      pedido_id: pedidoId, // Supabase detectará automáticamente que es un UUID
      variante_id: item.variante_id, // Asegúrate de que esto sea el UUID real (string)
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

  } catch (error: any) {
    console.error("Error al procesar el pedido:", error);
    // Mostramos un mensaje claro para identificar si es el Pedido o el Detalle
    alert(`Error al enviar: ${error.message || 'Error desconocido'}`);
  } finally {
    setEnviando(false);
  }
};
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (errorCritico) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Algo salió mal</h2>
      <p className="text-gray-600 max-w-md">{errorCritico}</p>
      <button onClick={() => window.location.reload()} className="mt-6 bg-indigo-600 text-white px-4 py-2 rounded">Reintentar</button>
    </div>
  );

  if (pedidoExitoso) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <CheckCircle2 className="w-20 h-20 text-green-500 mb-4" />
      <h2 className="text-3xl font-bold text-gray-900 mb-2">¡Pedido Recibido!</h2>
      <p className="text-gray-600 mb-8">Tu orden está en estatus Pendiente. La liquidación será contra entrega.</p>
      <button onClick={() => setPedidoExitoso(false)} className="bg-indigo-600 text-white px-6 py-3 rounded-md font-medium hover:bg-indigo-700 transition">
        Realizar otro pedido
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* CABECERA PRINCIPAL Y NAV DE PESTAÑAS */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-8">
              <div className="flex items-center">
                <Sparkles className="h-6 w-6 text-indigo-600 mr-2 animate-pulse" />
                <span className="text-xl font-bold text-gray-900 tracking-tight">Portal SEIMENJO</span>
              </div>
              <nav className="flex space-x-1" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('comprar')}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    activeTab === 'comprar'
                      ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
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
                    className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                      activeTab === 'facturas'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📄 Mis Facturas
                  </button>
                )}
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="hidden sm:inline text-xs text-gray-500">
                Cliente: <span className="font-semibold text-indigo-700">{sesion?.nombre_local || sesion?.email}</span>
              </span>
              <button
                onClick={cerrarSesion}
                className="flex items-center text-red-600 hover:text-red-800 text-sm font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all"
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
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="mb-6">
                <h2 className="text-xl font-extrabold text-gray-900">Catálogo de Productos</h2>
                <p className="text-sm text-gray-500">Agrega productos a tu carrito y envía tu orden en segundos.</p>
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
                    <div key={producto.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
                      <div className="h-48 bg-indigo-50 w-full relative flex items-center justify-center border-b border-gray-100">
                        <span className="text-indigo-300 font-bold tracking-widest">{producto.categoria.toUpperCase()}</span>
                      </div>
                      
                      <div className="p-5">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 leading-tight">{producto.nombre}</h3>
                        
                        <label className="block text-sm font-medium text-gray-700 mb-1">Presentación (Gramaje)</label>
                        {variantesProducto.length <= 1 ? (
                          <div className="w-full py-2 px-3 bg-gray-50 border border-gray-200 rounded-md text-sm mb-4 text-gray-800 font-medium">
                            {variantesProducto[0]?.gramaje || 'Única'}
                          </div>
                        ) : (
                          <select 
                            className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm mb-4 text-gray-900"
                            value={varianteSeleccionadaId || ''}
                            onChange={(e) => setSeleccionGramaje({...seleccionGramaje, [producto.id]: e.target.value})}
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
                                <p className="text-xs text-red-500 line-through">${precioBase.toFixed(2)} MXN</p>
                                <p className="text-2xl font-bold text-green-600">${precioPactado.toFixed(2)}</p>
                              </>
                            ) : (
                              <p className="text-2xl font-bold text-gray-900">${precioBase.toFixed(2)}</p>
                            )}
                          </div>
                          
                          <div className="flex items-center bg-gray-100 rounded-lg p-1">
                            <button onClick={() => varianteActiva && modificarCarrito(varianteActiva.id, 'restar')} className="p-1 rounded bg-white text-gray-600 shadow hover:bg-gray-50 transition">
                              <Minus className="w-5 h-5" />
                            </button>
                            <span className="w-10 text-center font-semibold text-gray-900">{itemEnCarrito ? itemEnCarrito.cantidad : 0}</span>
                            <button onClick={() => varianteActiva && modificarCarrito(varianteActiva.id, 'sumar')} className="p-1 rounded bg-indigo-600 text-white shadow hover:bg-indigo-700 transition">
                              <Plus className="w-5 h-5" />
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
            <div className="w-full md:w-96 bg-white border-l border-gray-200 shadow-xl flex flex-col h-[calc(100vh-4rem)] sticky top-16">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-indigo-50">
                <h2 className="text-lg font-bold text-indigo-900 flex items-center"><ShoppingCart className="w-5 h-5 mr-2" /> Mi Orden</h2>
                <span className="bg-indigo-200 text-indigo-800 text-xs font-bold px-2 py-1 rounded-full">{carrito.reduce((acc, item) => acc + item.cantidad, 0)} items</span>
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
                      <div key={item.variante_id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{item.producto_nombre}</p>
                          <p className="text-xs text-gray-500">{item.gramaje} x {item.cantidad} uni.</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900">${(item.cantidad * item.precio_unitario).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Instrucciones</label>
                  <textarea rows={2} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900" placeholder="Ej. Entregar por la puerta..." value={comentarios} onChange={(e) => setComentarios(e.target.value)}></textarea>
                </div>
                
                <div className="flex justify-between items-center mb-6">
                  <span className="text-gray-600 font-medium">Total a Pagar</span>
                  <span className="text-2xl font-black text-gray-900">${totalCarrito.toFixed(2)}</span>
                </div>

                <button onClick={enviarPedido} disabled={carrito.length === 0 || enviando} className="w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-sm text-sm font-bold text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 transition-all">
                  {enviando ? 'Procesando...' : 'Enviar Orden'}
                  {!enviando && <Send className="w-4 h-4 ml-2" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* PESTAÑA DE MIS FACTURAS */
          <div className="flex-1 p-6 overflow-y-auto max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-extrabold text-gray-900 flex items-center">
                  <FileText className="w-6 h-6 mr-2 text-indigo-600" /> Historial de Facturas
                </h2>
                <p className="text-sm text-gray-500">Consulta y descarga tus facturas fiscales en formato XML y PDF.</p>
              </div>
              <button 
                onClick={() => sesion?.id && cargarFacturas(sesion.id)} 
                disabled={loadingFacturas}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingFacturas ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>

            {errorFacturas && (
              <div className="bg-red-50 text-red-650 border border-red-200 p-4 rounded-xl mb-6 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{errorFacturas}</p>
              </div>
            )}

            {loadingFacturas ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-3"></div>
                <p className="text-gray-500 text-sm font-medium">Cargando facturas...</p>
              </div>
            ) : facturas.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
                <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-800 mb-1">Sin facturas emitidas</h3>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  Actualmente no tienes facturas registradas en este portal. Una vez que tus pedidos sean entregados y facturados, aparecerán aquí.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                        <th className="p-4">UUID Fiscal / Folio</th>
                        <th className="p-4">Pedido Relacionado</th>
                        <th className="p-4">Fecha Emisión</th>
                        <th className="p-4 text-right">Total</th>
                        <th className="p-4">Estatus Factura</th>
                        <th className="p-4 text-center">Descargas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {facturas.map((fac) => {
                        const esEntregado = fac.pedidos?.estatus_pedido === 'Entregado';
                        const numPedido = fac.pedidos?.numero_pedido || 'N/A';
                        
                        return (
                          <tr key={fac.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-4">
                              <div className="font-mono text-xs font-bold text-gray-900" title={fac.uuid_fiscal}>
                                {fac.serie_folio || `${fac.uuid_fiscal.substring(0, 8)}...`}
                              </div>
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5">{fac.uuid_fiscal}</div>
                            </td>
                            <td className="p-4">
                              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs">
                                #{numPedido}
                              </span>
                            </td>
                            <td className="p-4 text-gray-600">
                              {new Date(fac.fecha_emision).toLocaleDateString()}
                            </td>
                            <td className="p-4 text-right font-bold text-gray-900">
                              ${Number(fac.total).toFixed(2)} MXN
                            </td>
                            <td className="p-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                fac.estatus_factura?.nombre === 'Facturado' 
                                  ? 'bg-green-50 text-green-700 border border-green-200' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {fac.estatus_factura?.nombre || 'Desconocido'}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              {esEntregado ? (
                                <div className="flex justify-center gap-2">
                                  {fac.xml_url ? (
                                    <button
                                      onClick={() => descargarArchivo(fac.xml_url, 'xml')}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-sm"
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
                                      onClick={() => descargarArchivo(fac.pdf_url, 'pdf')}
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-bold transition-all shadow-sm"
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
                                <div className="flex items-center justify-center gap-1.5 text-amber-600 text-xs bg-amber-50 border border-amber-200 py-1.5 px-3 rounded-lg w-max mx-auto font-medium">
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