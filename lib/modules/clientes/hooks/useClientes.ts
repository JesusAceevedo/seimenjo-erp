'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClienteService } from '../services/cliente.service';
import {
  Cliente,
  ClienteFormData,
  PortalModalState,
  EditarClienteModalState
} from '../types/cliente.types';
import { useEmpresaId } from '../../../../lib/hooks/useEmpresaId';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';

const CLIENTE_INICIAL: ClienteFormData = {
  nombre_local: '',
  rfc: '',
  razon_social: '',
  regimen_fiscal: '',
  codigo_postal: '',
  uso_cfdi: '',
  email_facturacion: '',
  telefono: '',
  facturar_publico_general: false
};

const defaultService = new ClienteService();

export function useClientes(customService?: ClienteService) {
  const service = customService || defaultService;
  const getEmpresaId = useEmpresaId();
  const getSessionToken = useSessionToken();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros y paginación
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [pageClientes, setPageClientes] = useState(0);
  const [pageSizeClientes, setPageSizeClientes] = useState(8);

  // Modales
  const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState<ClienteFormData>(CLIENTE_INICIAL);
  const [isLoadingCliente, setIsLoadingCliente] = useState(false);
  const [errorClienteModal, setErrorClienteModal] = useState('');

  const [editarClienteModal, setEditarClienteModal] = useState<EditarClienteModalState>({
    open: false,
    cliente: null
  });
  const [isLoadingEditarCliente, setIsLoadingEditarCliente] = useState(false);
  const [errorEditarClienteModal, setErrorEditarClienteModal] = useState('');

  const [portalModal, setPortalModal] = useState<PortalModalState>({
    open: false,
    cliente: null,
    email: '',
    password: ''
  });
  const [habilitandoPortal, setHabilitandoPortal] = useState(false);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      const data = await service.obtenerClientes(empresaId || undefined);
      setClientes(data);
    } catch (err: unknown) {
      console.error('Error al cargar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, [service, getEmpresaId]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // Ajuste de tamaño de página dinámico
  useEffect(() => {
    const calcularPageSize = () => {
      const vh = window.innerHeight;
      const espacioClientes = vh - 325;
      setPageSizeClientes(Math.max(3, Math.floor(espacioClientes / 56)));
    };
    calcularPageSize();
    window.addEventListener('resize', calcularPageSize);
    return () => window.removeEventListener('resize', calcularPageSize);
  }, []);

  const clientesFiltrados = useMemo(() => {
    const query = busquedaCliente.trim().toLowerCase();
    if (!query) return clientes;
    return clientes.filter(c =>
      c.nombre_local?.toLowerCase().includes(query) ||
      c.razon_social?.toLowerCase().includes(query) ||
      c.rfc?.toLowerCase().includes(query)
    );
  }, [clientes, busquedaCliente]);

  const paginatedClientes = useMemo(() => {
    return clientesFiltrados.slice(
      pageClientes * pageSizeClientes,
      (pageClientes + 1) * pageSizeClientes
    );
  }, [clientesFiltrados, pageClientes, pageSizeClientes]);

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingCliente(true);
    setErrorClienteModal('');
    try {
      const empresaId = await getEmpresaId();
      await service.guardarCliente({ ...nuevoCliente, empresa_id: empresaId || null });
      setIsClienteModalOpen(false);
      setNuevoCliente(CLIENTE_INICIAL);
      await fetchClientes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar cliente';
      setErrorClienteModal(msg);
    } finally {
      setIsLoadingCliente(false);
    }
  };

  const handleActualizarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editarClienteModal.cliente) return;
    setIsLoadingEditarCliente(true);
    setErrorEditarClienteModal('');

    try {
      await service.guardarCliente(
        editarClienteModal.cliente as unknown as ClienteFormData,
        editarClienteModal.cliente.id
      );
      setEditarClienteModal({ open: false, cliente: null });
      await fetchClientes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar cliente';
      setErrorEditarClienteModal(msg);
    } finally {
      setIsLoadingEditarCliente(false);
    }
  };

  const handleEliminarCliente = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) return;
    try {
      await service.eliminarCliente(id);
      await fetchClientes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar cliente';
      alert(msg);
    }
  };

  const handleHabilitarPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalModal.cliente) return;
    setHabilitandoPortal(true);

    try {
      const token = await getSessionToken();
      if (!token) throw new Error('No hay sesión activa.');

      const res = await service.habilitarAccesoPortal(
        portalModal.cliente.id,
        portalModal.cliente.nombre_local,
        portalModal.email,
        portalModal.password,
        token
      );
      if (!res.success) {
        alert(res.error || 'Error al habilitar portal');
      } else {
        alert('¡Portal B2B habilitado con éxito para ' + portalModal.cliente.nombre_local + '!');
        setPortalModal({ open: false, cliente: null, email: '', password: '' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al habilitar portal';
      alert(msg);
    } finally {
      setHabilitandoPortal(false);
    }
  };

  const abrirModalPortal = (cliente: Cliente) => {
    setPortalModal({
      open: true,
      cliente,
      email: cliente.email_facturacion || '',
      password: ''
    });
  };

  return {
    clientes,
    loading,
    clientesFiltrados,
    paginatedClientes,
    busquedaCliente,
    setBusquedaCliente,
    pageClientes,
    setPageClientes,
    pageSizeClientes,

    // Modal Crear
    isClienteModalOpen,
    setIsClienteModalOpen,
    nuevoCliente,
    setNuevoCliente,
    isLoadingCliente,
    errorClienteModal,
    handleCrearCliente,

    // Modal Editar
    editarClienteModal,
    setEditarClienteModal,
    isLoadingEditarCliente,
    errorEditarClienteModal,
    handleActualizarCliente,

    // Eliminar
    handleEliminarCliente,

    // Modal Portal
    portalModal,
    setPortalModal,
    habilitandoPortal,
    abrirModalPortal,
    handleHabilitarPortal,

    fetchClientes
  };
}
