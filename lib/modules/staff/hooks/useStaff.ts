'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { StaffService } from '../services/staff.service';
import {
  Empresa,
  Perfil,
  Sucursal,
  UsuarioStaff,
  PermisosModulo,
  CrearUsuarioStaffInput,
  ActualizarUsuarioStaffInput
} from '../types/staff.types';

const INITIAL_PERMISOS: Record<string, PermisosModulo> = {
  ventas: { read: true, write: false },
  clientes: { read: true, write: false },
  productos: { read: true, write: false },
  proveedores: { read: true, write: false },
  gastos: { read: true, write: false },
  inventario: { read: true, write: false },
  expediente: { read: true, write: false },
  contabilidad: { read: true, write: false },
  conciliacion: { read: true, write: false },
  personal: { read: true, write: false },
  asistencia: { read: true, write: false },
  configuracion: { read: true, write: false }
};

const defaultService = new StaffService();

export function useStaff(customService?: StaffService) {
  const service = customService || defaultService;
  const router = useRouter();
  const getToken = useSessionToken();

  // Estados de contexto
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [esSuperusuario, setEsSuperusuario] = useState(false);
  const [loading, setLoading] = useState(true);

  // Listas de datos
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('');
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [usuariosStaff, setUsuariosStaff] = useState<UsuarioStaff[]>([]);

  // Formulario Perfil
  const [nuevoPerfilNombre, setNuevoPerfilNombre] = useState('');
  const [permisosPerfil, setPermisosPerfil] = useState<Record<string, PermisosModulo>>(INITIAL_PERMISOS);

  // Formulario Usuario Staff
  const [nuevoStaff, setNuevoStaff] = useState({
    nombre: '',
    email: '',
    password: ''
  });
  const [selectedPerfilId, setSelectedPerfilId] = useState('');
  const [selectedSucursales, setSelectedSucursales] = useState<string[]>([]);
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);

  // Edición Usuario Staff
  const [editingStaff, setEditingStaff] = useState<UsuarioStaff | null>(null);
  const [editPerfilId, setEditPerfilId] = useState('');
  const [editSucursales, setEditSucursales] = useState<string[]>([]);
  const [editEmpresas, setEditEmpresas] = useState<string[]>([]);
  const [actualizandoUsuario, setActualizandoUsuario] = useState(false);

  const loadData = useCallback(async (empId: string | null, isSuper: boolean) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const empsList = await service.obtenerEmpresas(isSuper, session.user.id, empId || undefined);
      setEmpresas(empsList);

      let targetEmpresa = empId;
      if (isSuper) {
        targetEmpresa = selectedEmpresaId || empsList[0]?.id || null;
      }

      if (!targetEmpresa) {
        setLoading(false);
        return;
      }

      const { perfiles, sucursales, usuariosStaff } = await service.obtenerDatosEmpresa(targetEmpresa);
      setPerfiles(perfiles);
      setSucursales(sucursales);
      setUsuariosStaff(usuariosStaff);
    } catch (err: unknown) {
      console.error('Error al cargar datos de Personal:', err);
    } finally {
      setLoading(false);
    }
  }, [service, selectedEmpresaId]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/admin/login');

      const { data: staffData } = await supabase
        .from('usuarios_staff')
        .select('es_superusuario, empresa_id')
        .eq('supabase_auth_id', session.user.id)
        .maybeSingle();

      if (staffData) {
        setEmpresaId(staffData.empresa_id);
        setEsSuperusuario(staffData.es_superusuario);
        await loadData(staffData.empresa_id, staffData.es_superusuario);
      } else {
        router.push('/admin/login');
      }
    };
    checkAuth();
  }, [router, selectedEmpresaId, loadData]);

  // Acciones de Perfiles
  const handleCrearPerfil = async () => {
    const targetEmpresa = esSuperusuario ? selectedEmpresaId : empresaId;
    if (!targetEmpresa) return alert('Debes seleccionar o pertenecer a una empresa.');
    if (!nuevoPerfilNombre.trim()) return alert('El nombre del perfil es obligatorio.');

    try {
      await service.crearPerfil(targetEmpresa, nuevoPerfilNombre, permisosPerfil);
      alert('Perfil creado correctamente.');
      setNuevoPerfilNombre('');
      setPermisosPerfil(INITIAL_PERMISOS);
      await loadData(empresaId, esSuperusuario);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear perfil';
      alert(msg);
    }
  };

  const handleEliminarPerfil = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este perfil?')) return;
    try {
      await service.eliminarPerfil(id);
      await loadData(empresaId, esSuperusuario);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar perfil';
      alert(msg);
    }
  };

  const togglePermiso = (modulo: string, accion: 'read' | 'write') => {
    setPermisosPerfil(prev => ({
      ...prev,
      [modulo]: {
        ...prev[modulo],
        [accion]: !prev[modulo]?.[accion]
      }
    }));
  };

  // Acciones de Usuario Staff
  const toggleEmpresaSeleccionada = (empId: string) => {
    setSelectedEmpresas(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const toggleSucursalSeleccionada = (sucId: string) => {
    setSelectedSucursales(prev =>
      prev.includes(sucId) ? prev.filter(id => id !== sucId) : [...prev, sucId]
    );
  };

  const handleCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmpresa = esSuperusuario ? selectedEmpresaId : empresaId;
    if (!targetEmpresa) return alert('Debes seleccionar una empresa.');
    if (!selectedPerfilId) return alert('Debes asignar un perfil al usuario.');

    setGuardandoUsuario(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No hay sesión activa');

      const input: CrearUsuarioStaffInput = {
        email: nuevoStaff.email,
        passwordTemporal: nuevoStaff.password,
        nombre: nuevoStaff.nombre,
        empresaId: targetEmpresa,
        perfilId: selectedPerfilId,
        sucursalesPermitidas: selectedSucursales,
        empresasPermitidas: selectedEmpresas
      };

      const res = await service.crearUsuarioStaff(input, token);
      if (!res.success) {
        alert('Error: ' + res.error);
      } else {
        alert('¡Usuario staff creado exitosamente!');
        setNuevoStaff({ nombre: '', email: '', password: '' });
        setSelectedPerfilId('');
        setSelectedSucursales([]);
        setSelectedEmpresas([]);
        await loadData(empresaId, esSuperusuario);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear usuario';
      alert(msg);
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const handleActualizarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    setActualizandoUsuario(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No hay sesión activa');

      const input: ActualizarUsuarioStaffInput = {
        id: editingStaff.id,
        perfilId: editPerfilId,
        sucursalesPermitidas: editSucursales,
        empresasPermitidas: editEmpresas
      };

      const res = await service.actualizarUsuarioStaff(input, token);
      if (!res.success) {
        alert('Error: ' + res.error);
      } else {
        alert('Usuario actualizado correctamente.');
        setEditingStaff(null);
        await loadData(empresaId, esSuperusuario);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar usuario';
      alert(msg);
    } finally {
      setActualizandoUsuario(false);
    }
  };

  const startEditingStaff = async (st: UsuarioStaff) => {
    setEditingStaff(st);
    setEditPerfilId((st.perfil_id as string) || '');
    setEditSucursales((st.sucursales_permitidas as string[]) || []);

    try {
      const { data: pivots } = await supabase
        .from('empresas_usuario_pivot')
        .select('empresa_id')
        .eq('usuario_id', st.id);

      const empIds = pivots?.map(p => p.empresa_id) || [];
      setEditEmpresas(empIds);
    } catch (e) {
      console.error(e);
      setEditEmpresas([]);
    }
  };

  const handleToggleActivo = async (id: string, activoActual: boolean) => {
    try {
      await service.cambiarEstatusActivo(id, !activoActual);
      await loadData(empresaId, esSuperusuario);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estatus';
      alert(msg);
    }
  };

  return {
    empresaId,
    esSuperusuario,
    loading,
    empresas,
    selectedEmpresaId,
    setSelectedEmpresaId,
    perfiles,
    sucursales,
    usuariosStaff,

    // Perfil
    nuevoPerfilNombre,
    setNuevoPerfilNombre,
    permisosPerfil,
    togglePermiso,
    handleCrearPerfil,
    handleEliminarPerfil,

    // Crear Staff
    nuevoStaff,
    setNuevoStaff,
    selectedPerfilId,
    setSelectedPerfilId,
    selectedSucursales,
    setSelectedSucursales,
    selectedEmpresas,
    toggleEmpresaSeleccionada,
    toggleSucursalSeleccionada,
    guardandoUsuario,
    handleCrearUsuario,

    // Editar Staff
    editingStaff,
    setEditingStaff,
    editPerfilId,
    setEditPerfilId,
    editSucursales,
    setEditSucursales,
    editEmpresas,
    setEditEmpresas,
    actualizandoUsuario,
    startEditingStaff,
    handleActualizarUsuario,

    // Acciones
    handleToggleActivo,
    loadData
  };
}
