'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// app/admin/proveedores/page.tsx
// Página independiente de gestión de proveedores.

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { obtenerSignedUrl } from '../gastos/actions';
import ProveedoresTab from '../_components/ProveedoresTab';
import { useThemeMode } from '../../../lib/useThemeMode';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProveedorModal {
  open: boolean;
  proveedor: any | null;
  loading: boolean;
  error: string;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProveedoresPage() {
  const router = useRouter();
  const { isDarkMode } = useThemeMode();

  // Estado
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [selectedProveedor, setSelectedProveedor] = useState<any | null>(null);
  const [proveedorFacturas, setProveedorFacturas] = useState<any[]>([]);
  const [cargandoFacturasProveedor, setCargandoFacturasProveedor] = useState(false);
  const [proveedorModal, setProveedorModal] = useState<ProveedorModal>({
    open: false, proveedor: null, loading: false, error: ''
  });

  const getSessionToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProveedores = useCallback(async () => {
    const { data } = await supabase
      .from('proveedores')
      .select('*')
      .order('nombre_comercial', { ascending: true });
    setProveedores(data || []);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/admin/login');
      await fetchProveedores();
    };
    init();
  }, [router, fetchProveedores]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const cargarDetallesProveedor = async (proveedor: any) => {
    setSelectedProveedor(proveedor);
    setCargandoFacturasProveedor(true);
    setProveedorFacturas([]);
    try {
      const { data } = await supabase
        .from('gastos')
        .select('id, fecha_gasto, concepto, monto, uuid_fiscal, gasto_padre_id, xml_url, pdf_url')
        .eq('proveedor_id', proveedor.id)
        .order('fecha_gasto', { ascending: false });
      setProveedorFacturas(data || []);
    } catch (err) {
      console.error('Error al cargar facturas del proveedor:', err);
    } finally {
      setCargandoFacturasProveedor(false);
    }
  };

  const handleSaveProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorModal.proveedor) return;
    setProveedorModal(prev => ({ ...prev, loading: true, error: '' }));

    try {
      const { id, ...fields } = proveedorModal.proveedor;
      // Obtener empresa_id de la sesión
      const sesion = localStorage.getItem('seimenjo_session');
      const empresaId = sesion ? JSON.parse(sesion).empresa_id : null;

      if (id) {
        const { error } = await supabase.from('proveedores').update(fields).eq('id', id);
        if (error) throw error;
        // Refrescar el proveedor seleccionado
        const { data: updated } = await supabase.from('proveedores').select('*').eq('id', id).single();
        if (updated) await cargarDetallesProveedor(updated);
      } else {
        const { data: res, error } = await supabase
          .from('proveedores')
          .insert({ ...fields, empresa_id: empresaId })
          .select()
          .single();
        if (error) throw error;
        if (res) await cargarDetallesProveedor(res);
      }

      setProveedorModal({ open: false, proveedor: null, loading: false, error: '' });
      await fetchProveedores();
    } catch (err: any) {
      setProveedorModal(prev => ({ ...prev, loading: false, error: err.message || 'Error al guardar el proveedor' }));
    }
  };

  const handleDeleteProveedor = async (id: string) => {
    if (!confirm('¿Deseas eliminar este proveedor? Esta acción no se puede deshacer.')) return;
    try {
      const { error } = await supabase.from('proveedores').delete().eq('id', id);
      if (error) throw error;
      setSelectedProveedor(null);
      setProveedorFacturas([]);
      await fetchProveedores();
    } catch (err: any) {
      alert('Error al eliminar el proveedor: ' + err.message);
    }
  };

  const handleDownloadFile = async (path: string) => {
    try {
      const token = await getSessionToken();
      const res = await obtenerSignedUrl(path, token);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert('No se pudo obtener el enlace: ' + res.error);
      }
    } catch (err: any) {
      alert('Error al descargar: ' + err.message);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`flex flex-col h-full font-sans ${isDarkMode ? 'dark' : ''}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center gap-3 shrink-0">
        <div className="flex-1">
          <h1 className="text-lg font-black text-gray-900 dark:text-white">Proveedores</h1>
          <p className="text-xs text-gray-400 mt-0.5">Gestión de proveedores, datos bancarios e historial de facturas</p>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white dark:bg-gray-950">
        <ProveedoresTab
          proveedores={proveedores}
          busquedaProveedor={busquedaProveedor}
          setBusquedaProveedor={setBusquedaProveedor}
          selectedProveedor={selectedProveedor}
          proveedorFacturas={proveedorFacturas}
          cargandoFacturasProveedor={cargandoFacturasProveedor}
          proveedorModal={proveedorModal}
          setProveedorModal={setProveedorModal as any}
          cargarDetallesProveedor={cargarDetallesProveedor}
          handleSaveProveedor={handleSaveProveedor}
          handleDeleteProveedor={handleDeleteProveedor}
          onDownloadFile={handleDownloadFile}
        />
      </div>
    </div>
  );
}
