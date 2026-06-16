'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Package, Plus, Edit2, Trash2, DollarSign, Layers,
  Search, Image, UploadCloud, CheckCircle, AlertTriangle,
  Save, RefreshCw, User, X
} from 'lucide-react';

interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  imagen_url: string | null;
  precio_base?: number | null;
  unidad_medida?: string | null;
}

interface Variante {
  id: string;
  producto_id: string;
  gramaje: string;
  precio_base: number;
}

interface Cliente {
  id: string;
  nombre_local: string;
  razon_social: string | null;
}

interface PrecioEspecial {
  id: string;
  cliente_id: string;
  variante_id: string;
  precio_pactado: number;
  clientes?: Cliente;
}

export default function ProductosTab() {
  // --- ESTADOS DE DATOS ---
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedProd, setSelectedProd] = useState<Producto | null>(null);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [selectedVar, setSelectedVar] = useState<Variante | null>(null);
  const [preciosEspeciales, setPreciosEspeciales] = useState<PrecioEspecial[]>([]);

  // --- CATALOGOS DE BASE DE DATOS ---
  interface CatalogItem {
    id: string;
    nombre: string;
  }
  const [categoriasCatalog, setCategoriasCatalog] = useState<CatalogItem[]>([]);
  const [unidadesCatalog, setUnidadesCatalog] = useState<CatalogItem[]>([]);
  const [showCatalogModal, setShowCatalogModal] = useState<null | 'categorias' | 'unidades'>(null);
  const [catalogInput, setCatalogInput] = useState('');
  const [editingCatalogItem, setEditingCatalogItem] = useState<CatalogItem | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSaving, setCatalogSaving] = useState(false);

  // --- FORMULARIO DE PRODUCTO ---
  const [prodId, setProdId] = useState<string | null>(null);
  const [prodNombre, setProdNombre] = useState('');
  const [prodCategoria, setProdCategoria] = useState('Fideos');
  const [prodImagenFile, setProdImagenFile] = useState<File | null>(null);
  const [prodImagenPreview, setProdImagenPreview] = useState<string | null>(null);
  const [prodImagenUrl, setProdImagenUrl] = useState('');
  const [prodPrecioBase, setProdPrecioBase] = useState('');
  const [prodUnidadMedida, setProdUnidadMedida] = useState('Pieza');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- FORMULARIO DE VARIANTE ---
  const [varGramaje, setVarGramaje] = useState('');
  const [varPrecioBase, setVarPrecioBase] = useState('');

  // --- FORMULARIO DE PRECIO ESPECIAL ---
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [precioPactado, setPrecioPactado] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');

  // --- CONTROL DE CARGAS Y ALERTAS ---
  const [loadingProds, setLoadingProds] = useState(false);
  const [loadingVars, setLoadingVars] = useState(false);
  const [loadingPrecios, setLoadingPrecios] = useState(false);
  const [savingProd, setSavingProd] = useState(false);
  const [savingVar, setSavingVar] = useState(false);
  const [savingPrecio, setSavingPrecio] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- CARGA INICIAL DE CATÁLOGOS ---
  const loadProductos = async () => {
    setLoadingProds(true);
    try {
      const { data, error } = await supabase
        .from('productos')
        .select('*')
        .order('nombre');
      if (error) throw error;
      setProductos(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al cargar productos: ' + err.message);
    } finally {
      setLoadingProds(false);
    }
  };

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre_local, razon_social')
        .order('nombre_local');
      if (error) throw error;
      setClientes(data || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const loadCatalogos = async () => {
    try {
      const { data: cats } = await supabase
        .from('cat_categorias_producto')
        .select('id, nombre')
        .order('nombre');
      const activeCats = cats || [];
      setCategoriasCatalog(activeCats);

      const { data: unis } = await supabase
        .from('cat_unidades_medida')
        .select('id, nombre')
        .order('nombre');
      const activeUnis = unis || [];
      setUnidadesCatalog(activeUnis);

      if (activeCats.length > 0 && !prodId) {
        setProdCategoria(prev => prev || activeCats[0].nombre);
      }
      if (activeUnis.length > 0 && !prodId) {
        setProdUnidadMedida(prev => prev || activeUnis[0].nombre);
      }
    } catch (err) {
      console.error('Error al cargar catálogos:', err);
    }
  };

  useEffect(() => {
    loadProductos();
    loadClientes();
    loadCatalogos();
  }, []);

  // --- CARGA DE VARIANTES AL SELECCIONAR PRODUCTO ---
  const loadVariantes = async (productoId: string) => {
    setLoadingVars(true);
    try {
      const { data, error } = await supabase
        .from('producto_variantes')
        .select('*')
        .eq('producto_id', productoId)
        .order('gramaje');
      if (error) throw error;
      setVariantes(data || []);
      // Reset selected variant
      setSelectedVar(null);
      setPreciosEspeciales([]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al cargar variantes: ' + err.message);
    } finally {
      setLoadingVars(false);
    }
  };

  useEffect(() => {
    if (selectedProd) {
      loadVariantes(selectedProd.id);
    } else {
      setVariantes([]);
      setSelectedVar(null);
      setPreciosEspeciales([]);
    }
  }, [selectedProd]);

  // --- CARGA DE PRECIOS ESPECIALES AL SELECCIONAR VARIANTE ---
  const loadPreciosEspeciales = async (varianteId: string) => {
    setLoadingPrecios(true);
    try {
      const { data, error } = await supabase
        .from('precios_especiales')
        .select('*, clientes(id, nombre_local, razon_social)')
        .eq('variante_id', varianteId);
      if (error) throw error;
      setPreciosEspeciales(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al cargar precios especiales: ' + err.message);
    } finally {
      setLoadingPrecios(false);
    }
  };

  useEffect(() => {
    if (selectedVar) {
      loadPreciosEspeciales(selectedVar.id);
    } else {
      setPreciosEspeciales([]);
    }
  }, [selectedVar]);

  // --- MANEJO DE PREVISUALIZACIÓN DE IMAGEN ---
  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProdImagenFile(file);
      const url = URL.createObjectURL(file);
      setProdImagenPreview(url);
    }
  };

  // --- ACCIÓN: GUARDAR / EDITAR PRODUCTO (SUBIDA A STORAGE Y UPSERT) ---
  const handleSaveProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodNombre.trim()) {
      setErrorMsg('El nombre del producto es obligatorio.');
      return;
    }

    setSavingProd(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let finalImageUrl = prodImagenUrl;

      // 1. Subir imagen a Supabase Storage si se seleccionó una nueva
      if (prodImagenFile) {
        const fileExt = prodImagenFile.name.split('.').pop();
        const fileName = `productos/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('productos-imagenes')
          .upload(fileName, prodImagenFile);

        if (uploadError) throw new Error('Error al subir imagen: ' + uploadError.message);

        // Obtener la URL pública final
        const { data: publicUrlData } = supabase.storage
          .from('productos-imagenes')
          .getPublicUrl(fileName);

        finalImageUrl = publicUrlData.publicUrl;
      }

      // 2. Insertar / Actualizar (Upsert) en la tabla 'productos'
      const payload: any = {
        nombre: prodNombre.trim(),
        categoria: prodCategoria,
        imagen_url: finalImageUrl || null,
        precio_base: prodPrecioBase ? parseFloat(prodPrecioBase) : null,
        unidad_medida: prodUnidadMedida || null
      };

      if (prodId) {
        payload.id = prodId; // Si estamos editando, incluimos el ID
      }

      const { data: savedData, error: upsertError } = await supabase
        .from('productos')
        .upsert(payload)
        .select()
        .single();

      if (upsertError) throw upsertError;

      // 3. Sincronizar automáticamente con la tabla de producto_variantes para compatibilidad
      if (prodPrecioBase && prodUnidadMedida) {
        const parsedPrice = parseFloat(prodPrecioBase);
        if (!isNaN(parsedPrice) && parsedPrice >= 0) {
          // Buscar si el producto ya tiene variantes existentes
          const { data: existingVars } = await supabase
            .from('producto_variantes')
            .select('id, gramaje')
            .eq('producto_id', savedData.id);

          // Si hay variantes, actualizamos la primera variante existente
          // o la que coincida con la unidad de medida. De lo contrario, se crea una nueva.
          const defaultVar = existingVars?.find(v => v.gramaje === prodUnidadMedida) || existingVars?.[0];

          const varPayload: any = {
            producto_id: savedData.id,
            gramaje: prodUnidadMedida.trim(),
            precio_base: parsedPrice
          };

          if (defaultVar) {
            varPayload.id = defaultVar.id;
          }

          const { error: varError } = await supabase
            .from('producto_variantes')
            .upsert(varPayload);

          if (varError) {
            console.error('Error al sincronizar variante por defecto:', varError);
          }
        }
      }

      setSuccessMsg(prodId ? 'Producto actualizado con éxito.' : 'Producto creado con éxito.');

      // Limpiar formulario de producto
      resetProductoForm();
      await loadProductos();

      // Si estábamos editando el seleccionado actual, refrescarlo
      if (selectedProd && selectedProd.id === savedData.id) {
        setSelectedProd(savedData);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al guardar producto: ' + err.message);
    } finally {
      setSavingProd(false);
    }
  };

  const resetProductoForm = () => {
    setProdId(null);
    setProdNombre('');
    setProdCategoria(categoriasCatalog[0]?.nombre || 'Fideos');
    setProdImagenFile(null);
    setProdImagenPreview(null);
    setProdImagenUrl('');
    setProdPrecioBase('');
    setProdUnidadMedida(unidadesCatalog[0]?.nombre || 'Pieza');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getCatalogTable = () => {
    return showCatalogModal === 'categorias'
      ? 'cat_categorias_producto'
      : 'cat_unidades_medida';
  };

  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogInput.trim() || !showCatalogModal) return;

    setCatalogSaving(true);
    setCatalogError(null);

    const tableName = getCatalogTable();
    const payload: any = { nombre: catalogInput.trim() };

    if (editingCatalogItem) {
      payload.id = editingCatalogItem.id;
    }

    try {
      const { error } = await supabase
        .from(tableName)
        .upsert(payload);

      if (error) throw error;

      setCatalogInput('');
      setEditingCatalogItem(null);
      await loadCatalogos();
    } catch (err: any) {
      console.error(err);
      setCatalogError('Error al guardar: ' + err.message);
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleDeleteCatalogItem = async (item: CatalogItem) => {
    if (!showCatalogModal) return;
    if (!confirm(`¿Estás seguro de eliminar "${item.nombre}"?`)) return;

    setCatalogSaving(true);
    setCatalogError(null);

    const tableName = getCatalogTable();

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', item.id);

      if (error) throw error;

      await loadCatalogos();
    } catch (err: any) {
      console.error(err);
      setCatalogError('Error al eliminar: ' + err.message);
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleEditProducto = (prod: Producto) => {
    setProdId(prod.id);
    setProdNombre(prod.nombre);
    setProdCategoria(prod.categoria);
    setProdImagenUrl(prod.imagen_url || '');
    setProdImagenPreview(prod.imagen_url || null);
    setProdPrecioBase(prod.precio_base ? String(prod.precio_base) : '');
    setProdUnidadMedida(prod.unidad_medida || 'Pieza');
    setProdImagenFile(null);
  };

  const handleDeleteProducto = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar este producto? Esto eliminará también todas sus variantes y precios especiales asociados.')) return;

    try {
      const { error } = await supabase.from('productos').delete().eq('id', id);
      if (error) throw error;

      setSuccessMsg('Producto eliminado.');
      if (selectedProd?.id === id) {
        setSelectedProd(null);
      }
      await loadProductos();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al eliminar producto: ' + err.message);
    }
  };

  // --- ACCIÓN: REGISTRAR VARIANTE ---
  const handleSaveVariante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProd) return;
    if (!varGramaje.trim() || !varPrecioBase.trim()) {
      alert('Gramaje y Precio Base son obligatorios.');
      return;
    }

    const price = parseFloat(varPrecioBase);
    if (isNaN(price) || price <= 0) {
      alert('El precio base debe ser un número positivo.');
      return;
    }

    setSavingVar(true);
    try {
      const { data, error } = await supabase
        .from('producto_variantes')
        .insert({
          producto_id: selectedProd.id,
          gramaje: varGramaje.trim(),
          precio_base: price
        })
        .select()
        .single();

      if (error) throw error;

      setVarGramaje('');
      setVarPrecioBase('');
      await loadVariantes(selectedProd.id);
      setSelectedVar(data); // Auto-seleccionar la nueva variante
    } catch (err: any) {
      console.error(err);
      alert('Error al registrar variante: ' + err.message);
    } finally {
      setSavingVar(false);
    }
  };

  const handleDeleteVariante = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta variante?')) return;
    try {
      const { error } = await supabase.from('producto_variantes').delete().eq('id', id);
      if (error) throw error;

      if (selectedVar?.id === id) {
        setSelectedVar(null);
      }
      if (selectedProd) {
        await loadVariantes(selectedProd.id);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error al eliminar variante: ' + err.message);
    }
  };

  // --- ACCIÓN: REGISTRAR PRECIO ESPECIAL ---
  const handleSavePrecioEspecial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVar) return;
    if (!selectedClienteId || !precioPactado.trim()) {
      alert('Selecciona un cliente e ingresa el precio pactado.');
      return;
    }

    const price = parseFloat(precioPactado);
    if (isNaN(price) || price <= 0) {
      alert('El precio pactado debe ser un número positivo.');
      return;
    }

    setSavingPrecio(true);
    try {
      const { error } = await supabase
        .from('precios_especiales')
        .upsert({
          cliente_id: selectedClienteId,
          variante_id: selectedVar.id,
          precio_pactado: price
        }, {
          onConflict: 'cliente_id,variante_id'
        });

      if (error) throw error;

      setPrecioPactado('');
      setSelectedClienteId('');
      setFiltroCliente('');
      await loadPreciosEspeciales(selectedVar.id);
    } catch (err: any) {
      console.error(err);
      alert('Error al registrar precio especial: ' + err.message);
    } finally {
      setSavingPrecio(false);
    }
  };

  const handleDeletePrecioEspecial = async (id: string) => {
    if (!confirm('¿Estás seguro de quitar este precio especial?')) return;
    try {
      const { error } = await supabase.from('precios_especiales').delete().eq('id', id);
      if (error) throw error;

      if (selectedVar) {
        await loadPreciosEspeciales(selectedVar.id);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error al eliminar precio especial: ' + err.message);
    }
  };

  // --- BUSCADOR DE CLIENTES FILTRADOS ---
  const clientesFiltrados = useMemo(() => {
    if (!filtroCliente.trim()) return clientes;
    return clientes.filter(c =>
      c.nombre_local.toLowerCase().includes(filtroCliente.toLowerCase()) ||
      (c.razon_social && c.razon_social.toLowerCase().includes(filtroCliente.toLowerCase()))
    );
  }, [clientes, filtroCliente]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

      {/* 1. ADMINISTRACIÓN DE PRODUCTOS */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Package className="text-amber-500" size={20} />
            {prodId ? 'Editar Producto' : 'Crear Producto'}
          </h3>

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl text-xs flex gap-2">
              <AlertTriangle className="shrink-0 w-4 h-4 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs flex gap-2">
              <CheckCircle className="shrink-0 w-4 h-4 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSaveProducto} className="space-y-4 font-sans">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre del Producto *</label>
              <input
                type="text"
                placeholder="Nombre del Producto"
                value={prodNombre}
                className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-amber-500 outline-none text-gray-900 dark:text-white"
                onChange={e => setProdNombre(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Categoría</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCatalogModal('categorias');
                      setCatalogInput('');
                      setEditingCatalogItem(null);
                      setCatalogError(null);
                    }}
                    className="text-[10px] text-amber-600 hover:text-amber-500 font-bold"
                  >
                    Gestionar
                  </button>
                </div>
                <select
                  value={prodCategoria}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                  onChange={e => setProdCategoria(e.target.value)}
                >
                  {categoriasCatalog.length > 0 ? (
                    categoriasCatalog.map(c => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))
                  ) : (
                    <>
                      <option value="Fideos">Fideos</option>
                      <option value="Tortillas">Tortillas</option>
                      <option value="Salsas">Salsas</option>
                      <option value="Caldo">Caldo</option>
                      <option value="Toppings">Toppings</option>
                      <option value="Otros">Otros</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Unidad de Medida</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCatalogModal('unidades');
                      setCatalogInput('');
                      setEditingCatalogItem(null);
                      setCatalogError(null);
                    }}
                    className="text-[10px] text-amber-600 hover:text-amber-500 font-bold"
                  >
                    Gestionar
                  </button>
                </div>
                <select
                  value={prodUnidadMedida}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                  onChange={e => setProdUnidadMedida(e.target.value)}
                >
                  {unidadesCatalog.length > 0 ? (
                    unidadesCatalog.map(u => (
                      <option key={u.id} value={u.nombre}>{u.nombre}</option>
                    ))
                  ) : (
                    <>
                      <option value="Pieza">Pieza</option>
                      <option value="Kg">Kg</option>
                      <option value="Litro">Litro</option>
                      <option value="Caja">Caja</option>
                      <option value="Paquete">Paquete</option>
                      <option value="Gramo">Gramo</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Precio Base ($) *</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={prodPrecioBase}
                className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-amber-500 outline-none text-gray-900 dark:text-white"
                onChange={e => setProdPrecioBase(e.target.value)}
                required
              />
            </div>

            {/* SECCIÓN IMAGEN */}
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Foto del Producto</label>
              <div className="mt-1 flex flex-col gap-3">
                {prodImagenPreview ? (
                  <div className="relative w-full h-40 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden group">
                    <img
                      src={prodImagenPreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-600 text-white p-1.5 rounded-full shadow transition-all opacity-90 group-hover:opacity-100"
                      onClick={() => {
                        setProdImagenFile(null);
                        setProdImagenPreview(null);
                        setProdImagenUrl('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative w-full border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImagenChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Selecciona una foto (.jpg, .png)
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">Sube la foto del producto a Supabase Storage</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {prodId && (
                <button
                  type="button"
                  onClick={resetProductoForm}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-sm transition-all text-center"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={savingProd}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {savingProd ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} /> {prodId ? 'Actualizar' : 'Guardar Producto'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* LISTA DE PRODUCTOS */}
        <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold uppercase text-gray-500 tracking-wider">Productos Registrados</h4>
            {loadingProds && <RefreshCw size={14} className="animate-spin text-gray-400" />}
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {productos.map(p => (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProd(p);
                  // Resetea edición si se hace clic en otro
                  if (prodId !== p.id) resetProductoForm();
                }}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${selectedProd?.id === p.id
                    ? 'border-amber-500 bg-amber-600/5 dark:bg-amber-600/10'
                    : 'border-gray-150 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50'
                  }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden shrink-0 border border-gray-200/50 dark:border-gray-800">
                    {p.imagen_url ? (
                      <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={18} className="text-gray-400" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <h5 className="font-bold text-sm truncate text-gray-900 dark:text-white leading-tight">{p.nombre}</h5>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center mt-0.5">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase">{p.categoria}</span>
                      {p.precio_base !== null && p.precio_base !== undefined && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold font-mono">
                          • ${Number(p.precio_base).toFixed(2)} / {p.unidad_medida || 'Pieza'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProducto(p);
                    }}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-850 rounded text-gray-500 hover:text-amber-500 transition-colors"
                    title="Editar producto"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteProducto(p.id, e)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-850 rounded text-gray-500 hover:text-red-500 transition-colors"
                    title="Eliminar producto"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            {productos.length === 0 && !loadingProds && (
              <div className="text-center py-6 text-gray-400 italic text-sm">
                No hay productos cargados.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. VARIANTES DEL PRODUCTO SELECCIONADO */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Layers className="text-blue-500" size={20} />
            Variantes de Gramaje
          </h3>

          {selectedProd ? (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-150 dark:border-gray-800 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-850 flex items-center justify-center">
                  {selectedProd.imagen_url ? (
                    <img src={selectedProd.imagen_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package size={20} className="text-gray-400" />
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">{selectedProd.categoria}</span>
                  <h4 className="font-extrabold text-sm text-gray-900 dark:text-white leading-tight">{selectedProd.nombre}</h4>
                </div>
              </div>

              {/* Formulario de Variantes */}
              <form onSubmit={handleSaveVariante} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-150 dark:border-gray-850 font-sans">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Gramaje (Ej. 1 Pz, 500g)</label>
                  <input
                    type="text"
                    placeholder="Gramaje / Presentación"
                    value={varGramaje}
                    className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onChange={e => setVarGramaje(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Precio Base ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={varPrecioBase}
                    className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onChange={e => setVarPrecioBase(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingVar}
                  className="w-full h-9 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs shadow-sm transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={14} /> Registrar Variante
                </button>
              </form>

              {/* Tabla de Variantes */}
              <div className="overflow-hidden rounded-xl border border-gray-150 dark:border-gray-850">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                      <th className="p-3">Gramaje/Presentación</th>
                      <th className="p-3">Precio Base</th>
                      <th className="p-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-850/40">
                    {variantes.map(v => (
                      <tr
                        key={v.id}
                        onClick={() => setSelectedVar(v)}
                        className={`cursor-pointer transition-colors ${selectedVar?.id === v.id
                            ? 'bg-blue-600/5 dark:bg-blue-600/10 font-bold'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-900/20'
                          }`}
                      >
                        <td className="p-3 text-gray-900 dark:text-white">{v.gramaje}</td>
                        <td className="p-3 font-mono font-semibold text-gray-800 dark:text-gray-200">${Number(v.precio_base).toFixed(2)}</td>
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleDeleteVariante(v.id)}
                            className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors"
                            title="Eliminar variante"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {variantes.length === 0 && !loadingVars && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-400 italic">No hay variantes registradas para este producto.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 italic text-sm font-sans flex flex-col items-center justify-center gap-2">
              <Package size={36} className="opacity-30" />
              <span>Selecciona un producto de la lista izquierda para gestionar sus variantes.</span>
            </div>
          )}
        </div>

        {/* 3. MATRIZ DE PRECIOS PACTADOS (PRECIOS ESPECIALES) */}
        {selectedVar && (
          <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <DollarSign className="text-green-500" size={20} />
                Precios Pactados por Cliente
              </h3>
              <p className="text-[11px] text-gray-400 font-sans mt-0.5">
                Define tarifas exclusivas para la variante <span className="font-semibold text-blue-500">{selectedVar.gramaje}</span> de <span className="font-semibold text-amber-500">{selectedProd?.nombre}</span>.
              </p>
            </div>

            {/* Formulario de Precios Especiales */}
            <form onSubmit={handleSavePrecioEspecial} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end p-4 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-150 dark:border-gray-850 font-sans">
              <div className="relative">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Cliente B2B *</label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    placeholder="Filtrar cliente..."
                    value={filtroCliente}
                    className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 pr-7"
                    onChange={e => {
                      setFiltroCliente(e.target.value);
                      setSelectedClienteId('');
                    }}
                  />
                  {filtroCliente && (
                    <button
                      type="button"
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                      onClick={() => {
                        setFiltroCliente('');
                        setSelectedClienteId('');
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                {/* Desplegable de coincidencia */}
                {!selectedClienteId && filtroCliente.trim().length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl z-20 text-xs">
                    {clientesFiltrados.slice(0, 10).map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedClienteId(c.id);
                          setFiltroCliente(c.nombre_local);
                        }}
                        className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer border-b border-gray-100 dark:border-gray-900 text-gray-900 dark:text-white"
                      >
                        <div className="font-bold">{c.nombre_local}</div>
                        <div className="text-[10px] text-gray-400 truncate">{c.razon_social}</div>
                      </div>
                    ))}
                    {clientesFiltrados.length === 0 && (
                      <div className="p-3 text-center text-gray-400 italic">No se hallaron clientes.</div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Precio Pactado ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={`Base: $${Number(selectedVar.precio_base).toFixed(2)}`}
                  value={precioPactado}
                  className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                  onChange={e => setPrecioPactado(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={savingPrecio || !selectedClienteId}
                className="w-full h-9 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-xs shadow-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <Save size={14} /> Registrar Tarifa
              </button>
            </form>

            {/* Tabla de Precios Especiales */}
            <div className="overflow-hidden rounded-xl border border-gray-150 dark:border-gray-850">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Razón Social</th>
                    <th className="p-3">Precio Especial Pactado</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-850/40">
                  {preciosEspeciales.map(pe => (
                    <tr key={pe.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20">
                      <td className="p-3 font-semibold text-gray-900 dark:text-white">{pe.clientes?.nombre_local}</td>
                      <td className="p-3 text-gray-400">{pe.clientes?.razon_social || 'N/A'}</td>
                      <td className="p-3 font-mono font-bold text-green-600 dark:text-green-400">
                        ${Number(pe.precio_pactado).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeletePrecioEspecial(pe.id)}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors"
                          title="Eliminar tarifa especial"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {preciosEspeciales.length === 0 && !loadingPrecios && (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-400 italic">No hay tarifas especiales asignadas para esta variante.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE GESTIÓN DE CATÁLOGOS */}
      {showCatalogModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-850">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Gestionar {showCatalogModal === 'categorias' ? 'Categorías' : 'Unidades de Medida'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCatalogModal(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-650 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                <X size={20} />
              </button>
            </div>

            {catalogError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl text-xs flex gap-2">
                <AlertTriangle className="shrink-0 w-4 h-4 mt-0.5" />
                <span>{catalogError}</span>
              </div>
            )}

            {/* Formulario de registro/edición */}
            <form onSubmit={handleSaveCatalogItem} className="flex gap-2 items-end">
              <div className="flex-1 col-span-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">
                  {editingCatalogItem ? 'Editar Nombre' : 'Nuevo Elemento'}
                </label>
                <input
                  type="text"
                  placeholder={showCatalogModal === 'categorias' ? 'Ej. Postres, Bebidas' : 'Ej. Metro, Docena'}
                  value={catalogInput}
                  className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  onChange={e => setCatalogInput(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-1">
                {editingCatalogItem && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatalogItem(null);
                      setCatalogInput('');
                    }}
                    className="h-8 px-3 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-350 text-xs font-bold hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={catalogSaving}
                  className="h-8 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <Save size={13} />
                  {editingCatalogItem ? 'Actualizar' : 'Agregar'}
                </button>
              </div>
            </form>

            {/* Lista de elementos del catálogo */}
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {(showCatalogModal === 'categorias' ? categoriasCatalog : unidadesCatalog).map(item => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg border border-gray-100 dark:border-gray-900 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <span className="text-xs text-gray-900 dark:text-white font-medium">{item.nombre}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatalogItem(item);
                        setCatalogInput(item.nombre);
                      }}
                      className="p-1 text-gray-400 hover:text-amber-500 rounded hover:bg-gray-100 dark:hover:bg-gray-850"
                      title="Editar"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCatalogItem(item)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-gray-850"
                      title="Eliminar"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {(showCatalogModal === 'categorias' ? categoriasCatalog : unidadesCatalog).length === 0 && (
                <div className="text-center py-6 text-gray-400 italic text-xs">
                  No hay elementos registrados en este catálogo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
