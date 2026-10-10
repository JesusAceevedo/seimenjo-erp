'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Package,
  Calendar,
  Truck,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Save
} from 'lucide-react';
import { Pedido, ProductoVariante, Repartidor } from '../../types';
import {
  recuperarDetalleDeFacturaXml,
  guardarDetallePedidoFaltante,
  ConceptoRecuperado
} from '../actions';

interface CompletarDetallePedidoModalProps {
  pedido: Pedido | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productos: ProductoVariante[];
  repartidores: Repartidor[];
  preciosEspecialesCliente?: Record<string, number>;
  initialNotice?: { type: 'success' | 'warning' | 'error'; message: string };
  recoveredItems?: ConceptoRecuperado[];
  getSessionToken: () => Promise<string>;
}

export default function CompletarDetallePedidoModal({
  pedido,
  isOpen,
  onClose,
  onSuccess,
  productos,
  repartidores,
  preciosEspecialesCliente = {},
  initialNotice,
  recoveredItems = [],
  getSessionToken
}: CompletarDetallePedidoModalProps) {
  const [notice, setNotice] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [fechaProduccion, setFechaProduccion] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [entregadoPor, setEntregadoPor] = useState('');
  const [costoEnvio, setCostoEnvio] = useState<number>(0);
  const [comentarios, setComentarios] = useState('');
  const [items, setItems] = useState<
    Array<{
      id: string;
      variante_id: string;
      cantidad: number;
      comentarios: string;
      precio_aplicado: number;
    }>
  >([]);
  const [actualizarPrecioTotal, setActualizarPrecioTotal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [reintentandoXml, setReintentandoXml] = useState(false);

  // Inicializar estado cuando se abre con el pedido
  useEffect(() => {
    if (pedido && isOpen) {
      setFechaProduccion(pedido.fecha_produccion || '');
      setFechaEntrega(pedido.fecha_entrega || '');
      setEntregadoPor(pedido.entregado_por || '');
      setCostoEnvio(Number(pedido.costo_envio) || 0);
      setComentarios(pedido.comentarios || pedido.comentarios_generales || '');
      setActualizarPrecioTotal(false);
      setNotice(initialNotice || null);

      if (recoveredItems && recoveredItems.length > 0) {
        setItems(
          recoveredItems.map((rec, idx) => ({
            id: `rec-${idx}-${Date.now()}`,
            variante_id: rec.variante_id || '',
            cantidad: rec.cantidad || 1,
            comentarios: rec.comentarios || '',
            precio_aplicado: rec.precio_unitario || 0
          }))
        );
      } else if (pedido.pedido_detalles && pedido.pedido_detalles.length > 0) {
        setItems(
          pedido.pedido_detalles.map((d, idx) => {
            const pDb = productos.find((p) => p.id === d.producto_variantes?.id);
            const precio =
              preciosEspecialesCliente[d.producto_variantes?.id || ''] ??
              pDb?.precio_base ??
              0;
            return {
              id: `det-${idx}-${d.id}`,
              variante_id: d.producto_variantes?.id || '',
              cantidad: d.cantidad || 1,
              comentarios: d.comentarios || '',
              precio_aplicado: precio
            };
          })
        );
      } else {
        setItems([{ id: `new-0-${Date.now()}`, variante_id: '', cantidad: 1, comentarios: '', precio_aplicado: 0 }]);
      }
    }
  }, [pedido, isOpen, initialNotice, recoveredItems, productos, preciosEspecialesCliente]);

  const handleReintentarLecturaXml = async () => {
    if (!pedido) return;
    setReintentandoXml(true);
    setNotice(null);
    try {
      const token = await getSessionToken();
      const res = await recuperarDetalleDeFacturaXml(pedido.id, token);
      if (res.success && res.conceptos && res.conceptos.length > 0) {
        setItems(
          res.conceptos.map((rec, idx) => ({
            id: `rec-retry-${idx}-${Date.now()}`,
            variante_id: rec.variante_id || '',
            cantidad: rec.cantidad || 1,
            comentarios: rec.comentarios || '',
            precio_aplicado: rec.precio_unitario || 0
          }))
        );
        setNotice({
          type: 'success',
          message: `Se recuperaron ${res.conceptos.length} conceptos desde la factura ${res.folioFactura || ''}. Verifica los productos y completa las fechas operativas.`
        });
      } else {
        setNotice({
          type: 'warning',
          message: res.error || 'No se pudo recuperar el detalle desde la factura XML. Completa los datos manualmente.'
        });
      }
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err.message || 'Error al conectar con la factura XML.'
      });
    } finally {
      setReintentandoXml(false);
    }
  };

  const handleVarianteChange = (index: number, varianteId: string) => {
    const updated = [...items];
    const pDb = productos.find((p) => p.id === varianteId);
    const precioPactado = preciosEspecialesCliente[varianteId];
    const precio = precioPactado !== undefined ? Number(precioPactado) : (pDb ? Number(pDb.precio_base) : 0);

    updated[index].variante_id = varianteId;
    updated[index].precio_aplicado = precio;
    setItems(updated);
  };

  const handleCantidadChange = (index: number, cantidad: number) => {
    const updated = [...items];
    updated[index].cantidad = Math.max(1, cantidad);
    setItems(updated);
  };

  const handleComentariosChange = (index: number, text: string) => {
    const updated = [...items];
    updated[index].comentarios = text;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: `item-${Date.now()}-${Math.random()}`, variante_id: '', cantidad: 1, comentarios: '', precio_aplicado: 0 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{ id: `item-${Date.now()}`, variante_id: '', cantidad: 1, comentarios: '', precio_aplicado: 0 }]);
      return;
    }
    setItems(items.filter((_, idx) => idx !== index));
  };

  // Cálculos de totales
  const subtotalProductosCalculado = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.precio_aplicado || 0) * (it.cantidad || 0), 0);
  }, [items]);

  const totalCalculadoConEnvio = useMemo(() => {
    return subtotalProductosCalculado + (Number(costoEnvio) || 0);
  }, [subtotalProductosCalculado, costoEnvio]);

  const totalOriginal = Number(pedido?.precio_total || 0);
  const diferenciaMontos = Math.abs(totalCalculadoConEnvio - totalOriginal);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(val);
  };

  const handleGuardar = async () => {
    if (!pedido) return;

    const itemsValidos = items.filter((i) => i.variante_id);
    if (itemsValidos.length === 0) {
      alert('Por favor selecciona al menos un producto para completar el detalle del pedido.');
      return;
    }

    setGuardando(true);
    try {
      const token = await getSessionToken();
      const res = await guardarDetallePedidoFaltante({
        pedidoId: pedido.id,
        items: itemsValidos.map((it) => ({
          variante_id: it.variante_id,
          cantidad: it.cantidad,
          comentarios: it.comentarios,
          precio_aplicado: it.precio_aplicado,
          subtotal: it.precio_aplicado * it.cantidad
        })),
        fecha_produccion: fechaProduccion || undefined,
        fecha_entrega: fechaEntrega || undefined,
        entregado_por: entregadoPor || undefined,
        costo_envio: Number(costoEnvio) || 0,
        comentarios: comentarios || undefined,
        actualizarPrecioTotal,
        nuevoPrecioTotal: totalCalculadoConEnvio,
        token
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        alert(res.error || 'Error al guardar la información.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error inesperado al guardar información faltante: ' + (err.message || String(err)));
    } finally {
      setGuardando(false);
    }
  };

  if (!isOpen || !pedido) return null;

  const clienteNombre = pedido.clientes?.nombre_local || pedido.cliente_nombre || 'Cliente General';
  const folioFactura = pedido.folio_factura || (Array.isArray(pedido.facturas_clientes) ? pedido.facturas_clientes[0]?.serie_folio : pedido.facturas_clientes?.serie_folio);
  const tieneFactura = !!folioFactura;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Encabezado */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-900 bg-gray-50/70 dark:bg-gray-900/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Package size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Completar Información Faltante</span>
                <span className="font-mono text-amber-600 dark:text-amber-500 text-sm">
                  #{pedido.numero_pedido || pedido.id.split('-')[0]}
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                <span>Cliente: <strong className="text-gray-700 dark:text-gray-300">{clienteNombre}</strong></span>
                <span>•</span>
                <span>Total: <strong className="text-gray-700 dark:text-gray-300">{formatCurrency(totalOriginal)}</strong></span>
                {folioFactura && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 dark:text-blue-400 font-mono">Factura: {folioFactura}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo con scroll */}
        <div className="p-5 overflow-y-auto space-y-5 text-gray-900 dark:text-gray-100">
          {/* Banner de Estado / Notificación */}
          {notice && (
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                notice.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                  : notice.type === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
                  : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {notice.type === 'success' ? (
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold mb-0.5">
                    {notice.type === 'success'
                      ? 'Detalle Recuperado de Factura'
                      : 'Información Faltante Requerida'}
                  </div>
                  <div>{notice.message}</div>
                </div>
              </div>

              {tieneFactura && (
                <button
                  type="button"
                  onClick={handleReintentarLecturaXml}
                  disabled={reintentandoXml}
                  className="shrink-0 px-2.5 py-1 bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  title="Intentar recuperar partidas automáticamente del archivo XML"
                >
                  {reintentandoXml ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  <span>Reintentar XML</span>
                </button>
              )}
            </div>
          )}

          {/* Sección 1: Fechas Operativas y Logística */}
          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
              <Calendar size={14} /> Fechas Operativas y Logística
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Fecha de Producción {!pedido.fecha_produccion && <span className="text-amber-500 font-bold">(Faltante)</span>}
                </label>
                <input
                  type="date"
                  value={fechaProduccion}
                  onChange={(e) => setFechaProduccion(e.target.value)}
                  className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Fecha de Entrega {!pedido.fecha_entrega && <span className="text-amber-500 font-bold">(Faltante)</span>}
                </label>
                <input
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Repartidor Asignado {!pedido.entregado_por && <span className="text-amber-500 font-bold">(Faltante)</span>}
                </label>
                <select
                  value={entregadoPor}
                  onChange={(e) => setEntregadoPor(e.target.value)}
                  className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-xs outline-none focus:border-amber-500"
                >
                  <option value="">Sin asignar / Pendiente</option>
                  {repartidores.map((r) => (
                    <option key={r.id} value={r.nombre}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Costo de Envío ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costoEnvio}
                  onChange={(e) => setCostoEnvio(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-xs outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Sección 2: Carga de Productos / Detalle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Package size={14} /> Detalle de Carga / Productos
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-amber-600 dark:text-amber-500 hover:text-amber-700 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Agregar Producto
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const subtotalItem = (item.precio_aplicado || 0) * (item.cantidad || 0);

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2"
                  >
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <select
                          value={item.variante_id}
                          onChange={(e) => handleVarianteChange(idx, e.target.value)}
                          className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-xs outline-none focus:border-amber-500"
                        >
                          <option value="">Seleccionar producto...</option>
                          {productos.map((p) => {
                            const pactado = preciosEspecialesCliente[p.id];
                            const precio = pactado !== undefined ? pactado : p.precio_base;
                            const esPactado = pactado !== undefined;

                            return (
                              <option key={p.id} value={p.id}>
                                {p.productos?.nombre || 'Producto'} ({p.gramaje}) - ${precio} {esPactado ? '(Pactado)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="w-20">
                        <input
                          type="number"
                          min="1"
                          value={item.cantidad || ''}
                          onChange={(e) => handleCantidadChange(idx, parseInt(e.target.value) || 0)}
                          placeholder="Pz"
                          className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2 rounded-lg text-xs text-center outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="w-24 text-right font-mono font-bold text-xs text-gray-700 dark:text-gray-300">
                        {formatCurrency(subtotalItem)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                        title="Eliminar partida"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={item.comentarios}
                        onChange={(e) => handleComentariosChange(idx, e.target.value)}
                        placeholder="Descripción o comentarios de la partida (opcional)..."
                        className="w-full bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 rounded-lg text-[11px] outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen de totales */}
            <div className="bg-amber-50/50 dark:bg-amber-950/10 p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
              <div className="space-y-0.5">
                <div className="text-gray-600 dark:text-gray-400">
                  Total de partidas: <strong>{items.filter((i) => i.variante_id).length}</strong> | Piezas:{' '}
                  <strong>{items.reduce((acc, i) => acc + (i.cantidad || 0), 0)}</strong>
                </div>
                {diferenciaMontos > 0.05 && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">
                    Diferencia con total original ({formatCurrency(totalOriginal)}): {formatCurrency(diferenciaMontos)}
                  </div>
                )}
              </div>

              <div className="text-right">
                <div className="text-[11px] text-gray-500">Subtotal Calculado</div>
                <div className="text-base font-black text-amber-600 dark:text-amber-500 font-mono">
                  {formatCurrency(totalCalculadoConEnvio)}
                </div>
              </div>
            </div>

            {/* Opción de actualizar monto total si es necesario */}
            {diferenciaMontos > 0.05 && pedido.estatus_pago !== 'Liquidado' && (
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={actualizarPrecioTotal}
                  onChange={(e) => setActualizarPrecioTotal(e.target.checked)}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Actualizar el precio total del pedido a {formatCurrency(totalCalculadoConEnvio)}</span>
              </label>
            )}
          </div>

          {/* Sección 3: Observaciones Generales */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Comentarios u Observaciones Generales
            </label>
            <textarea
              rows={2}
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Notas de entrega, especificaciones de preparación, etc..."
              className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white p-2.5 rounded-lg text-xs resize-none outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Footer con acciones */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/30">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {guardando ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Guardando Información...</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>Guardar Información Faltante</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
