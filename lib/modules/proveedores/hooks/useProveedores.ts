'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ProveedorService } from '../services/proveedor.service';
import {
  Proveedor,
  FacturaProveedor,
  ProveedorModalState,
  GuardarProveedorInput
} from '../types/proveedor.types';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';

const defaultService = new ProveedorService();

export function useProveedores(customService?: ProveedorService) {
  const service = customService || defaultService;
  const router = useRouter();
  const getSessionToken = useSessionToken();

  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loadingProveedores, setLoadingProveedores] = useState(true);
  const [busquedaProveedor, setBusquedaProveedor] = useState('');
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const [proveedorFacturas, setProveedorFacturas] = useState<FacturaProveedor[]>([]);
  const [cargandoFacturasProveedor, setCargandoFacturasProveedor] = useState(false);

  const [proveedorModal, setProveedorModal] = useState<ProveedorModalState>({
    open: false,
    proveedor: null,
    loading: false,
    error: ''
  });

  const fetchProveedores = useCallback(async () => {
    setLoadingProveedores(true);
    try {
      const data = await service.obtenerProveedores();
      setProveedores(data);
    } catch (err: unknown) {
      console.error('Error al cargar proveedores:', err);
    } finally {
      setLoadingProveedores(false);
    }
  }, [service]);

  useEffect(() => {
    const init = async () => {
      const token = await getSessionToken();
      if (!token) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryToken = await getSessionToken();
        if (!retryToken) return router.push('/admin/login');
      }
      await fetchProveedores();
    };
    init();
  }, [router, getSessionToken, fetchProveedores]);

  const cargarDetallesProveedor = useCallback(async (proveedor: Proveedor) => {
    setSelectedProveedor(proveedor);
    setCargandoFacturasProveedor(true);
    setProveedorFacturas([]);
    try {
      const facturas = await service.obtenerFacturas(proveedor.id);
      setProveedorFacturas(facturas);
    } catch (err: unknown) {
      console.error('Error al cargar facturas del proveedor:', err);
    } finally {
      setCargandoFacturasProveedor(false);
    }
  }, [service]);

  const handleSaveProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorModal.proveedor) return;

    setProveedorModal(prev => ({ ...prev, loading: true, error: '' }));

    try {
      const sesionRaw = localStorage.getItem('seimenjo_session');
      const empresaId = sesionRaw ? JSON.parse(sesionRaw).empresa_id : null;

      const input: GuardarProveedorInput = {
        id: proveedorModal.proveedor.id || null,
        rfc: proveedorModal.proveedor.rfc || '',
        nombre_comercial: proveedorModal.proveedor.nombre_comercial || '',
        razon_social: proveedorModal.proveedor.razon_social || null,
        alias: proveedorModal.proveedor.alias || null,
        telefono: proveedorModal.proveedor.telefono || null,
        email: proveedorModal.proveedor.email || null,
        contacto: proveedorModal.proveedor.contacto || null,
        dias_credito: proveedorModal.proveedor.dias_credito || 0,
        limite_credito: proveedorModal.proveedor.limite_credito || 0,
        banco: proveedorModal.proveedor.banco || null,
        cuenta_bancaria: proveedorModal.proveedor.cuenta_bancaria || null,
        clabe: proveedorModal.proveedor.clabe || null,
        titular_cuenta: proveedorModal.proveedor.titular_cuenta || null,
        empresa_id: empresaId
      };

      const proveedorGuardado = await service.guardarProveedor(input);

      setProveedorModal({ open: false, proveedor: null, loading: false, error: '' });
      await fetchProveedores();
      if (proveedorGuardado) {
        await cargarDetallesProveedor(proveedorGuardado);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el proveedor';
      setProveedorModal(prev => ({ ...prev, loading: false, error: msg }));
    }
  };

  const handleDeleteProveedor = async (id: string) => {
    if (!confirm('¿Deseas eliminar este proveedor? Esta acción no se puede deshacer.')) return;
    try {
      await service.eliminarProveedor(id);
      setSelectedProveedor(null);
      setProveedorFacturas([]);
      await fetchProveedores();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el proveedor';
      alert(msg);
    }
  };

  const handleDownloadFile = async (path: string) => {
    try {
      const token = await getSessionToken();
      if (!token) throw new Error('No hay sesión activa');
      const url = await service.obtenerUrlDescarga(path, token);
      window.open(url, '_blank');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al descargar el archivo';
      alert(msg);
    }
  };

  const proveedoresFiltrados = useMemo(() => {
    const query = busquedaProveedor.trim().toLowerCase();
    if (!query) return proveedores;
    return proveedores.filter(p =>
      p.nombre_comercial?.toLowerCase().includes(query) ||
      p.rfc?.toLowerCase().includes(query) ||
      p.alias?.toLowerCase().includes(query) ||
      p.razon_social?.toLowerCase().includes(query)
    );
  }, [proveedores, busquedaProveedor]);

  return {
    proveedores,
    proveedoresFiltrados,
    loadingProveedores,
    busquedaProveedor,
    setBusquedaProveedor,
    selectedProveedor,
    setSelectedProveedor,
    proveedorFacturas,
    cargandoFacturasProveedor,
    proveedorModal,
    setProveedorModal,
    fetchProveedores,
    cargarDetallesProveedor,
    handleSaveProveedor,
    handleDeleteProveedor,
    handleDownloadFile
  };
}
