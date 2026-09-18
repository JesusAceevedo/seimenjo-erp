'use client';

import React from 'react';
import { useProductos } from '../../../lib/modules/productos/hooks/useProductos';
import { ProductoForm } from './productos/components/ProductoForm';
import { ProductosList } from './productos/components/ProductosList';
import { VariantesSection } from './productos/components/VariantesSection';
import { PreciosEspecialesSection } from './productos/components/PreciosEspecialesSection';
import { CatalogosModal } from './productos/components/CatalogosModal';

export default function ProductosTab() {
  const {
    // Listas y selecciones
    productos,
    selectedProd,
    handleSelectProducto,
    variantes,
    selectedVar,
    handleSelectVariante,
    preciosEspeciales,
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
  } = useProductos();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 1. COLUMNA IZQUIERDA: ADMINISTRACIÓN Y LISTA DE PRODUCTOS */}
      <div className="lg:col-span-1 space-y-6">
        <ProductoForm
          prodId={prodId}
          prodNombre={prodNombre}
          setProdNombre={setProdNombre}
          prodCategoria={prodCategoria}
          setProdCategoria={setProdCategoria}
          prodPrecioBase={prodPrecioBase}
          setProdPrecioBase={setProdPrecioBase}
          prodUnidadMedida={prodUnidadMedida}
          setProdUnidadMedida={setProdUnidadMedida}
          prodImagenPreview={prodImagenPreview}
          fileInputRef={fileInputRef}
          handleImagenChange={handleImagenChange}
          handleClearImage={handleClearImage}
          resetProductoForm={resetProductoForm}
          handleSaveProducto={handleSaveProducto}
          savingProd={savingProd}
          errorMsg={errorMsg}
          successMsg={successMsg}
          categoriasCatalog={categoriasCatalog}
          unidadesCatalog={unidadesCatalog}
          onOpenCatalogModal={type => {
            setShowCatalogModal(type);
            setCatalogInput('');
            setEditingCatalogItem(null);
          }}
        />

        <ProductosList
          productos={productos}
          selectedProd={selectedProd}
          onSelectProducto={handleSelectProducto}
          onEditProducto={handleEditProducto}
          onDeleteProducto={handleDeleteProducto}
          loadingProds={loadingProds}
          prodId={prodId}
          resetProductoForm={resetProductoForm}
        />
      </div>

      {/* 2. COLUMNA DERECHA: VARIACIONES DE GRAMAJE Y TARIFAS ESPECIALES */}
      <div className="lg:col-span-2 space-y-6">
        <VariantesSection
          selectedProd={selectedProd}
          variantes={variantes}
          selectedVar={selectedVar}
          onSelectVar={handleSelectVariante}
          varGramaje={varGramaje}
          setVarGramaje={setVarGramaje}
          varPrecioBase={varPrecioBase}
          setVarPrecioBase={setVarPrecioBase}
          handleSaveVariante={handleSaveVariante}
          handleDeleteVariante={handleDeleteVariante}
          savingVar={savingVar}
          loadingVars={loadingVars}
        />

        {selectedVar && (
          <PreciosEspecialesSection
            selectedProd={selectedProd}
            selectedVar={selectedVar}
            preciosEspeciales={preciosEspeciales}
            clientesFiltrados={clientesFiltrados}
            filtroCliente={filtroCliente}
            setFiltroCliente={setFiltroCliente}
            selectedClienteId={selectedClienteId}
            setSelectedClienteId={setSelectedClienteId}
            precioPactado={precioPactado}
            setPrecioPactado={setPrecioPactado}
            handleSavePrecioEspecial={handleSavePrecioEspecial}
            handleDeletePrecioEspecial={handleDeletePrecioEspecial}
            savingPrecio={savingPrecio}
            loadingPrecios={loadingPrecios}
          />
        )}
      </div>

      {/* 3. MODAL DE CATÁLOGOS AUXILIARES */}
      <CatalogosModal
        showCatalogModal={showCatalogModal}
        onClose={() => setShowCatalogModal(null)}
        catalogError={catalogError}
        catalogInput={catalogInput}
        setCatalogInput={setCatalogInput}
        editingCatalogItem={editingCatalogItem}
        setEditingCatalogItem={setEditingCatalogItem}
        catalogSaving={catalogSaving}
        handleSaveCatalogItem={handleSaveCatalogItem}
        handleDeleteCatalogItem={handleDeleteCatalogItem}
        categoriasCatalog={categoriasCatalog}
        unidadesCatalog={unidadesCatalog}
      />
    </div>
  );
}
