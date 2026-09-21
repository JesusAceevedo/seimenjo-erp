'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { InventarioService } from '../services/inventario.service';
import { Almacen, StockItem, InventarioTab } from '../types/inventario.types';
import { supabase } from '../../../../lib/supabase';

const defaultService = new InventarioService();

export function useInventario(customService?: InventarioService) {
  const service = customService || defaultService;

  const [activeTab, setActiveTab] = useState<InventarioTab>('dashboard');
  const [stock, setStock] = useState<StockItem[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState<string>('');
  const [busqueda, setBusqueda] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchInventario = useCallback(async () => {
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) return;

      const [almacenesData, stockData] = await Promise.all([
        service.obtenerAlmacenes(),
        service.obtenerStock(almacenSeleccionado || undefined)
      ]);

      setAlmacenes(almacenesData);
      setStock(stockData);
    } catch (error) {
      console.error('Error al cargar inventario:', error);
    } finally {
      setLoading(false);
    }
  }, [service, almacenSeleccionado]);

  useEffect(() => {
    fetchInventario();
  }, [fetchInventario]);

  const stockFiltrado = useMemo(() => {
    let list = stock;
    if (almacenSeleccionado) {
      list = list.filter(item => item.almacen_id === almacenSeleccionado);
    }
    if (busqueda.trim()) {
      const query = busqueda.trim().toLowerCase();
      list = list.filter(item =>
        item.producto_variantes?.productos?.nombre?.toLowerCase().includes(query) ||
        item.producto_variantes?.gramaje?.toLowerCase().includes(query) ||
        item.almacenes?.nombre?.toLowerCase().includes(query)
      );
    }
    return list;
  }, [stock, almacenSeleccionado, busqueda]);

  const metricas = useMemo(() => {
    return service.calcularMetricas(stockFiltrado);
  }, [service, stockFiltrado]);

  return {
    activeTab,
    setActiveTab,
    stock: stockFiltrado,
    stockRaw: stock,
    almacenes,
    almacenSeleccionado,
    setAlmacenSeleccionado,
    busqueda,
    setBusqueda,
    loading,
    metricas,
    fetchInventario
  };
}
