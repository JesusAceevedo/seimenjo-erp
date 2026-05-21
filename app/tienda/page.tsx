'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, LogOut, Plus, Minus, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
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

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const sesionGuardada = localStorage.getItem('seimenjo_session');
        if (!sesionGuardada) {
          router.push('/');
          return;
        }
        
        const datosSesion = JSON.parse(sesionGuardada);
        setSesion(datosSesion);

        // 1. Cargar Productos
        const { data: dataProductos, error: errProd } = await supabase.from('productos').select('*');
        if (errProd) throw new Error(`Fallo al cargar productos: ${errProd.message}`);
        
        // 2. Cargar Variantes
        const { data: dataVariantes, error: errVar } = await supabase.from('producto_variantes').select('*');
        if (errVar) throw new Error(`Fallo al cargar variantes: ${errVar.message}`);
        
        // 3. Cargar Precios Especiales
        let mapaPrecios: Record<string, number> = {};
        if (datosSesion.tipo === 'b2b' && datosSesion.id) {
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
        }

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
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* SECCIÓN IZQUIERDA: CATÁLOGO */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-lg shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Catálogo SEIMENJO</h1>
            <p className="text-gray-600 text-sm">
              Comprando como: <span className="font-semibold text-indigo-700">{sesion?.nombre_local}</span> {sesion?.tipo === 'anonimo' && '(Anónimo)'}
            </p>
          </div>
          <button onClick={cerrarSesion} className="flex items-center text-red-600 hover:text-red-800 text-sm font-medium">
            <LogOut className="w-4 h-4 mr-1" /> Salir
          </button>
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
              <div key={producto.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
                <div className="h-48 bg-indigo-50 w-full relative flex items-center justify-center border-b border-gray-100">
                  <span className="text-indigo-300 font-bold tracking-widest">{producto.categoria.toUpperCase()}</span>
                </div>
                
                <div className="p-5">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 leading-tight">{producto.nombre}</h3>
                  
                  <label className="block text-sm font-medium text-gray-700 mb-1">Presentación (Gramaje)</label>
                  <select 
                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm mb-4 text-gray-900"
                    value={varianteSeleccionadaId || ''}
                    onChange={(e) => setSeleccionGramaje({...seleccionGramaje, [producto.id]: e.target.value})}
                  >
                    {variantesProducto.map(v => (
                      <option key={v.id} value={v.id}>{v.gramaje}</option>
                    ))}
                  </select>

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
      <div className="w-full md:w-96 bg-white border-l border-gray-200 shadow-xl flex flex-col h-screen sticky top-0">
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
    </div>
  );
}