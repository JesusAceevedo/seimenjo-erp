'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ProductoService } from '../services/producto.service';
import {
  Producto,
  Variante,
  Cliente,
  PrecioEspecial,
  CatalogItem,
  CatalogType
} from '../types/producto.types';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error_description === 'string') return obj.error_description;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

const defaultService = new ProductoService();

export function useProductos(customService?: ProductoService) {
  const service = customService || defaultService;
  // --- LISTAS DE DATOS ---
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selectedProd, setSelectedProd] = useState<Producto | null>(null);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [selectedVar, setSelectedVar] = useState<Variante | null>(null);
  const [preciosEspeciales, setPreciosEspeciales] = useState<PrecioEspecial[]>([]);

  // --- CATÁLOGOS AUXILIARES ---
  const [categoriasCatalog, setCategoriasCatalog] = useState<CatalogItem[]>([]);
  const [unidadesCatalog, setUnidadesCatalog] = useState<CatalogItem[]>([]);
  const [showCatalogModal, setShowCatalogModal] = useState<null | CatalogType>(null);
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

  // --- CONTROL DE CARGAS Y MENSAJES ---
  const [loadingProds, setLoadingProds] = useState(true);
  const [loadingVars, setLoadingVars] = useState(false);
  const [loadingPrecios, setLoadingPrecios] = useState(false);
  const [savingProd, setSavingProd] = useState(false);
  const [savingVar, setSavingVar] = useState(false);
  const [savingPrecio, setSavingPrecio] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- MÉTODOS DE RECARGA ---
  const reloadProductos = useCallback(async () => {
    try {
      const data = await service.obtenerTodosLosProductos();
      setProductos(data);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Error al recargar productos: ' + getErrorMessage(err));
    }
  }, [service]);

  const reloadCatalogos = useCallback(async () => {
    try {
      const { categorias, unidades } = await service.obtenerCatalogos();
      setCategoriasCatalog(categorias);
      setUnidadesCatalog(unidades);
    } catch (err: unknown) {
      console.error('Error al recargar catálogos:', err);
    }
  }, [service]);

  // --- CARGA INICIAL CON COMPLIANCE PARA REACT 19 ---
  useEffect(() => {
    let ignore = false;

    async function init() {
      try {
        const [prods, clis, cats] = await Promise.all([
          service.obtenerTodosLosProductos(),
          service.obtenerClientes(),
          service.obtenerCatalogos()
        ]);
        if (!ignore) {
          setProductos(prods);
          setClientes(clis);
          setCategoriasCatalog(cats.categorias);
          setUnidadesCatalog(cats.unidades);
          if (cats.categorias.length > 0) {
            setProdCategoria(cats.categorias[0].nombre);
          }
          if (cats.unidades.length > 0) {
            setProdUnidadMedida(cats.unidades[0].nombre);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setErrorMsg('Error al cargar datos iniciales: ' + getErrorMessage(err));
        }
      } finally {
        if (!ignore) {
          setLoadingProds(false);
        }
      }
    }

    void init();
    return () => {
      ignore = true;
    };
  }, [service]);

  // --- SELECCIÓN Y CARGA DE VARIANTES ---
  const handleSelectProducto = useCallback(async (prod: Producto | null) => {
    setSelectedProd(prod);
    setSelectedVar(null);
    setPreciosEspeciales([]);

    if (!prod) {
      setVariantes([]);
      return;
    }

    setLoadingVars(true);
    try {
      const vars = await service.obtenerVariantesPorProducto(prod.id);
      setVariantes(vars);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Error al cargar variantes: ' + getErrorMessage(err));
    } finally {
      setLoadingVars(false);
    }
  }, [service]);

  // --- SELECCIÓN Y CARGA DE PRECIOS ESPECIALES ---
  const handleSelectVariante = useCallback(async (variante: Variante | null) => {
    setSelectedVar(variante);

    if (!variante) {
      setPreciosEspeciales([]);
      return;
    }

    setLoadingPrecios(true);
    try {
      const pe = await service.obtenerPreciosEspecialesPorVariante(variante.id);
      setPreciosEspeciales(pe);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Error al cargar tarifas especiales: ' + getErrorMessage(err));
    } finally {
      setLoadingPrecios(false);
    }
  }, [service]);

  // --- ACCIONES DE FORMULARIO DE PRODUCTO ---
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

  const handleImagenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProdImagenFile(file);
      const url = URL.createObjectURL(file);
      setProdImagenPreview(url);
    }
  };

  const handleClearImage = () => {
    setProdImagenFile(null);
    setProdImagenPreview(null);
    setProdImagenUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEditProducto = (prod: Producto) => {
    setProdId(prod.id);
    setProdNombre(prod.nombre);
    setProdCategoria(prod.categoria);
    setProdImagenUrl(prod.imagen_url || '');
    setProdImagenPreview(prod.imagen_url || null);
    setProdPrecioBase(prod.precio_base !== null && prod.precio_base !== undefined ? String(prod.precio_base) : '');
    setProdUnidadMedida(prod.unidad_medida || 'Pieza');
    setProdImagenFile(null);
  };

  const handleSaveProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProd(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const saved = await service.guardarProducto({
        id: prodId,
        nombre: prodNombre,
        categoria: prodCategoria,
        precioBase: prodPrecioBase,
        unidadMedida: prodUnidadMedida,
        imagenFile: prodImagenFile,
        imagenUrlExistente: prodImagenUrl
      });

      setSuccessMsg(prodId ? 'Producto actualizado con éxito.' : 'Producto creado con éxito.');
      resetProductoForm();
      await reloadProductos();

      if (selectedProd && selectedProd.id === saved.id) {
        setSelectedProd(saved);
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Error al guardar producto: ' + getErrorMessage(err));
    } finally {
      setSavingProd(false);
    }
  };

  const handleDeleteProducto = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar este producto? Esto eliminará también todas sus variantes y precios especiales asociados.')) return;

    try {
      await service.eliminarProducto(id);
      setSuccessMsg('Producto eliminado.');
      if (selectedProd?.id === id) {
        setSelectedProd(null);
        setVariantes([]);
        setSelectedVar(null);
        setPreciosEspeciales([]);
      }
      await reloadProductos();
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg('Error al eliminar producto: ' + getErrorMessage(err));
    }
  };

  // --- ACCIONES DE VARIANTES ---
  const handleSaveVariante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProd) return;

    const price = parseFloat(varPrecioBase);
    if (isNaN(price) || price <= 0) {
      alert('El precio base debe ser un número positivo.');
      return;
    }

    setSavingVar(true);
    try {
      const nuevaVariante = await service.agregarVariante({
        productoId: selectedProd.id,
        gramaje: varGramaje,
        precioBase: price
      });

      setVarGramaje('');
      setVarPrecioBase('');
      const updatedVars = await service.obtenerVariantesPorProducto(selectedProd.id);
      setVariantes(updatedVars);
      await handleSelectVariante(nuevaVariante);
    } catch (err: unknown) {
      console.error(err);
      alert('Error al registrar variante: ' + getErrorMessage(err));
    } finally {
      setSavingVar(false);
    }
  };

  const handleDeleteVariante = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta variante?')) return;
    try {
      await service.eliminarVariante(id);
      if (selectedVar?.id === id) {
        setSelectedVar(null);
        setPreciosEspeciales([]);
      }
      if (selectedProd) {
        const updatedVars = await service.obtenerVariantesPorProducto(selectedProd.id);
        setVariantes(updatedVars);
      }
    } catch (err: unknown) {
      console.error(err);
      alert('Error al eliminar variante: ' + getErrorMessage(err));
    }
  };

  // --- ACCIONES DE PRECIOS ESPECIALES ---
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
      await service.guardarPrecioEspecial({
        clienteId: selectedClienteId,
        varianteId: selectedVar.id,
        precioPactado: price
      });

      setPrecioPactado('');
      setSelectedClienteId('');
      setFiltroCliente('');
      const pe = await service.obtenerPreciosEspecialesPorVariante(selectedVar.id);
      setPreciosEspeciales(pe);
    } catch (err: unknown) {
      console.error(err);
      alert('Error al registrar precio especial: ' + getErrorMessage(err));
    } finally {
      setSavingPrecio(false);
    }
  };

  const handleDeletePrecioEspecial = async (id: string) => {
    if (!confirm('¿Estás seguro de quitar este precio especial?')) return;
    try {
      await service.eliminarPrecioEspecial(id);
      if (selectedVar) {
        const pe = await service.obtenerPreciosEspecialesPorVariante(selectedVar.id);
        setPreciosEspeciales(pe);
      }
    } catch (err: unknown) {
      console.error(err);
      alert('Error al eliminar precio especial: ' + getErrorMessage(err));
    }
  };

  // --- ACCIONES DE CATÁLOGOS AUXILIARES ---
  const handleSaveCatalogItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogInput.trim() || !showCatalogModal) return;

    setCatalogSaving(true);
    setCatalogError(null);

    try {
      await service.guardarElementoCatalogo(
        showCatalogModal,
        catalogInput,
        editingCatalogItem?.id
      );
      setCatalogInput('');
      setEditingCatalogItem(null);
      await reloadCatalogos();
    } catch (err: unknown) {
      console.error(err);
      setCatalogError('Error al guardar: ' + getErrorMessage(err));
    } finally {
      setCatalogSaving(false);
    }
  };

  const handleDeleteCatalogItem = async (item: CatalogItem) => {
    if (!showCatalogModal) return;
    if (!confirm(`¿Estás seguro de eliminar "${item.nombre}"?`)) return;

    setCatalogSaving(true);
    setCatalogError(null);

    try {
      await service.eliminarElementoCatalogo(showCatalogModal, item.id);
      await reloadCatalogos();
    } catch (err: unknown) {
      console.error(err);
      setCatalogError('Error al eliminar: ' + getErrorMessage(err));
    } finally {
      setCatalogSaving(false);
    }
  };

  // --- CLIENTES FILTRADOS ---
  const clientesFiltrados = useMemo(() => {
    if (!filtroCliente.trim()) return clientes;
    const query = filtroCliente.toLowerCase();
    return clientes.filter(c =>
      c.nombre_local.toLowerCase().includes(query) ||
      (c.razon_social && c.razon_social.toLowerCase().includes(query))
    );
  }, [clientes, filtroCliente]);

  return {
    // Listas y selecciones
    productos,
    selectedProd,
    handleSelectProducto,
    variantes,
    selectedVar,
    handleSelectVariante,
    preciosEspeciales,
    clientes,
    clientesFiltrados,

    // Catálogos
    categoriasCatalog,
    unidadesCatalog,
    showCatalogModal,
    setShowCatalogModal,
    catalogInput,
    setCatalogInput,
    editingCatalogItem,
    setEditingCatalogItem,
    catalogError,
    catalogSaving,

    // Formulario de Producto
    prodId,
    prodNombre,
    setProdNombre,
    prodCategoria,
    setProdCategoria,
    prodPrecioBase,
    setProdPrecioBase,
    prodUnidadMedida,
    setProdUnidadMedida,
    prodImagenPreview,
    fileInputRef,
    handleImagenChange,
    handleClearImage,
    resetProductoForm,
    handleEditProducto,
    handleSaveProducto,
    handleDeleteProducto,

    // Formulario de Variante
    varGramaje,
    setVarGramaje,
    varPrecioBase,
    setVarPrecioBase,
    handleSaveVariante,
    handleDeleteVariante,

    // Formulario de Precios Especiales
    selectedClienteId,
    setSelectedClienteId,
    precioPactado,
    setPrecioPactado,
    filtroCliente,
    setFiltroCliente,
    handleSavePrecioEspecial,
    handleDeletePrecioEspecial,

    // Acciones de Catálogo
    handleSaveCatalogItem,
    handleDeleteCatalogItem,

    // Estados de carga y alertas
    loadingProds,
    loadingVars,
    loadingPrecios,
    savingProd,
    savingVar,
    savingPrecio,
    errorMsg,
    successMsg
  };
}
