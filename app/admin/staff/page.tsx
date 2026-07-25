'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import {
  Users, Shield, Plus, Trash2, Key, CheckSquare, Square, Sun, Moon, Building, UserCheck
} from 'lucide-react';

// Type definitions for data structures
interface Empresa {
  id: string;
  nombre: string;
  [key: string]: unknown;
}
interface Perfil {
  id: string;
  nombre: string;
  permisos: Record<string, { read: boolean; write: boolean }>;
  [key: string]: unknown;
}
interface Sucursal {
  id: string;
  nombre: string;
  [key: string]: unknown;
}
interface UsuarioStaff {
  id: string;
  correo: string;
  activo: boolean;
  es_superusuario?: boolean;
  perfiles_seguridad?: { nombre: string };
  [key: string]: unknown;
}
import { crearUsuarioStaffAdmin, actualizarUsuarioStaffAdmin } from '../actions/adminAuth';
import { useSessionToken } from '../../../lib/hooks/useSessionToken';

export default function StaffPage() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const getToken = useSessionToken();

  // --- ESTADOS DE CONTEXTO ---
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [esSuperusuario, setEsSuperusuario] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- LISTAS DE DATOS ---
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(''); // Para Superusuario
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [usuariosStaff, setUsuariosStaff] = useState<UsuarioStaff[]>([]);

  // --- ESTADOS FORMULARIO PERFIL ---
  const [nuevoPerfilNombre, setNuevoPerfilNombre] = useState('');
  const initialStatePermisos = {
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
  const [permisosPerfil, setPermisosPerfil] = useState<Record<string, { read: boolean; write: boolean }>>(initialStatePermisos);

  // --- ESTADOS FORMULARIO USUARIO STAFF ---
  const [nuevoStaff, setNuevoStaff] = useState({
    nombre: '',
    email: '',
    password: ''
  });
  const [selectedPerfilId, setSelectedPerfilId] = useState('');
  const [selectedSucursales, setSelectedSucursales] = useState<string[]>([]);
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);

  const [editingStaff, setEditingStaff] = useState<UsuarioStaff | null>(null);
  const [editPerfilId, setEditPerfilId] = useState('');
  const [editSucursales, setEditSucursales] = useState<string[]>([]);
  const [editEmpresas, setEditEmpresas] = useState<string[]>([]);
  const [actualizandoUsuario, setActualizandoUsuario] = useState(false);

  const toggleEmpresaSeleccionada = (empId: string) => {
    setSelectedEmpresas(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  // --- CARGA DE DATOS ---
  const loadData = useCallback(async (empId: string | null, isSuper: boolean) => {
    setLoading(true);
    try {
      let targetEmpresa = empId;

      // Cargar catálogo de empresas
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        if (isSuper) {
          const { data: emps } = await supabase.from('empresas').select('*').order('nombre');
          const empsList = (emps as Empresa[]) || [];
          setEmpresas(empsList);
          targetEmpresa = selectedEmpresaId || empsList[0]?.id || null;
        } else {
          // Obtener el registro de staff para encontrar su id
          const { data: staffUser } = await supabase
            .from('usuarios_staff')
            .select('id')
            .eq('supabase_auth_id', session.user.id)
            .maybeSingle();

          if (staffUser) {
            const { data: pivotEmps } = await supabase
              .from('empresas_usuario_pivot')
              .select('empresa_id, empresas(id, nombre)')
              .eq('usuario_id', staffUser.id);
            
            const empsList = pivotEmps?.map(p => p.empresas).filter(Boolean) as unknown as Empresa[] || [];
            
            // Asegurar que la empresa actual esté en la lista
            if (empId && !empsList.some(e => e.id === empId)) {
              const { data: curEmp } = await supabase.from('empresas').select('*').eq('id', empId).maybeSingle();
              if (curEmp) empsList.push(curEmp as unknown as Empresa);
            }
            setEmpresas(empsList);
            targetEmpresa = empId;
          }
        }
      }

      if (!targetEmpresa) {
        setLoading(false);
        return;
      }

      // Consultar perfiles de la empresa
      const { data: perfs } = await supabase
        .from('perfiles_seguridad')
        .select('*')
        .eq('empresa_id', targetEmpresa)
        .order('nombre');
      setPerfiles((perfs as Perfil[]) || []);

      // Consultar sucursales
      const { data: sucs } = await supabase
        .from('sucursales')
        .select('*')
        .eq('empresa_id', targetEmpresa)
        .order('nombre');
      setSucursales((sucs as Sucursal[]) || []);

      // Consultar staff con sus perfiles
      const { data: staffList } = await supabase
        .from('usuarios_staff')
        .select('*, perfiles_seguridad(nombre)')
        .eq('empresa_id', targetEmpresa)
        .order('correo');
      setUsuariosStaff((staffList as UsuarioStaff[]) || []);
    } catch (err: unknown) {
      if (err instanceof Error) console.error('Error al cargar datos de Personal:', err); else console.error('Error al cargar datos de Personal:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEmpresaId]);

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

  // --- ACCIONES DE PERFILES (ROLES) ---
  const handleCrearPerfil = async () => {
    const targetEmpresa = esSuperusuario ? selectedEmpresaId : empresaId;
    if (!targetEmpresa) return alert('Debes seleccionar o pertenecer a una empresa.');
    if (!nuevoPerfilNombre.trim()) return alert('El nombre del perfil es obligatorio.');

    try {
      const { error } = await supabase
        .from('perfiles_seguridad')
        .insert([{
          empresa_id: targetEmpresa,
          nombre: nuevoPerfilNombre,
          permisos: permisosPerfil
        }]);

      if (error) throw error;

      alert('Perfil creado correctamente.');
      setNuevoPerfilNombre('');
      // Reset permisos
      setPermisosPerfil(initialStatePermisos);
      await loadData(empresaId, esSuperusuario);
    } catch (err: unknown) {
      if (err instanceof Error) {
         console.error(err);
         alert('Error al crear perfil: ' + err.message);
       } else {
         console.error(err);
         alert('Error al crear perfil');
       }
    }
  };

  const handleEliminarPerfil = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este perfil?')) return;
    try {
      const { error } = await supabase.from('perfiles_seguridad').delete().eq('id', id);
      if (error) throw error;
      await loadData(empresaId, esSuperusuario);
    } catch (err: unknown) {
      if (err instanceof Error) {
         console.error(err);
         alert('Error al eliminar perfil: ' + err.message);
       } else {
         console.error(err);
         alert('Error al eliminar perfil');
       }
    }
  };

  const togglePermiso = (modulo: string, accion: 'read' | 'write') => {
    setPermisosPerfil(prev => ({
      ...prev,
      [modulo]: {
        ...prev[modulo],
        [accion]: !prev[modulo][accion]
      }
    }));
  };

  // --- ACCIONES DE USUARIO STAFF ---
  const toggleSucursalSeleccionada = (sucId: string) => {
    setSelectedSucursales(prev =>
      prev.includes(sucId) ? prev.filter(id => id !== sucId) : [...prev, sucId]
    );
  };

  const handleCrearStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmpresa = esSuperusuario ? selectedEmpresaId : empresaId;
    if (!targetEmpresa) return alert('No hay empresa seleccionada.');
    if (!nuevoStaff.nombre.trim() || !nuevoStaff.email.trim() || !nuevoStaff.password.trim()) {
      return alert('Todos los campos de credenciales son obligatorios.');
    }
    if (!selectedPerfilId) return alert('Debes seleccionar un perfil para el usuario.');

    setGuardandoUsuario(true);
    try {
      // Garantizar que la empresa de origen del perfil esté agregada a las asignadas
      const companies = selectedEmpresas.includes(targetEmpresa)
        ? selectedEmpresas
        : [...selectedEmpresas, targetEmpresa];

      const token = await getToken();
      const res = await crearUsuarioStaffAdmin({
        email: nuevoStaff.email,
        passwordTemporal: nuevoStaff.password,
        nombre: nuevoStaff.nombre,
        empresaId: targetEmpresa,
        perfilId: selectedPerfilId,
        sucursalesPermitidas: selectedSucursales,
        empresasPermitidas: companies
      }, token);

      if (!res.success) throw new Error(res.error);

      alert('Usuario de Staff creado con éxito.');
      setNuevoStaff({ nombre: '', email: '', password: '' });
      setSelectedPerfilId('');
      setSelectedSucursales([]);
      setSelectedEmpresas([]);
      await loadData(empresaId, esSuperusuario);
    } catch (err: unknown) {
      if (err instanceof Error) {
         console.error(err);
         alert('Error al crear usuario de staff: ' + err.message);
       } else {
         console.error(err);
         alert('Error al crear usuario de staff');
       }
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const handleEliminarStaff = async (staffId: string) => {
    if (!confirm('¿Estás seguro de inhabilitar este operador?')) return;
    try {
      // Inhabilitar en base de datos
      const { error } = await supabase
        .from('usuarios_staff')
        .update({ activo: false })
        .eq('id', staffId);

      if (error) throw error;
      await loadData(empresaId, esSuperusuario);
      alert('Usuario inhabilitado correctamente.');
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : String(err);
      alert('Error al inhabilitar usuario: ' + errMsg);
    }
  };

  const startEditingStaff = async (st: UsuarioStaff) => {
    setEditingStaff(st);
    setEditPerfilId(st.perfil_id as string || '');
    setEditSucursales(st.sucursales_permitidas as string[] || []);
    
    // Consultar empresas permitidas de este usuario
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

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || actualizandoUsuario) return;
    setActualizandoUsuario(true);
    try {
      const token = await getToken();
      const res = await actualizarUsuarioStaffAdmin({
        userId: editingStaff.id,
        perfilId: editPerfilId,
        sucursalesPermitidas: editSucursales,
        empresasPermitidas: editEmpresas
      }, token);

      if (!res.success) throw new Error(res.error);

      alert('Usuario actualizado con éxito.');
      setEditingStaff(null);
      await loadData(empresaId, esSuperusuario);
    } catch (err: any) {
      alert('Error al actualizar usuario: ' + err.message);
    } finally {
      setActualizandoUsuario(false);
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full`}>
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors p-8 flex flex-col w-full max-w-[100vw]">

        {/* HEADER */}
        <div className="mb-8 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3">
              <Users className="text-amber-500 w-8 h-8" /> Ventana 5: Control de Personal y Roles
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Configura roles de seguridad JSONB y da de alta cuentas internas de operadores asignadas a sucursales.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {esSuperusuario && empresas.length > 0 && (
              <div className="flex items-center gap-2 bg-white dark:bg-gray-950 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-sans font-semibold">
                <Building size={14} className="text-amber-500" />
                <span>Empresa Inquilina:</span>
                <select
                  value={selectedEmpresaId}
                  className="bg-transparent text-gray-950 dark:text-white outline-none border-none cursor-pointer"
                  onChange={e => setSelectedEmpresaId(e.target.value)}
                >
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-amber-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center italic text-gray-500">Cargando personal y roles...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 items-start">

            {/* IZQUIERDA: PERFILES / ROLES (Permisos JSONB) */}
            <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Shield className="text-amber-500" size={20} /> Mapeo de Perfiles y Accesos
              </h3>

              {/* Formulario Perfil */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 font-sans space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre del Perfil / Rol *</label>
                  <input
                    type="text"
                    placeholder="Ej. Cajero Principal"
                    value={nuevoPerfilNombre}
                    className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                    onChange={e => setNuevoPerfilNombre(e.target.value)}
                  />
                </div>

                {/* Grid de Permisos Módulos */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Asignación de Permisos del Módulo</label>
                  <div className="space-y-3 bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
                    {(['ventas', 'clientes', 'productos', 'proveedores', 'gastos', 'inventario', 'expediente', 'contabilidad', 'conciliacion', 'personal', 'asistencia', 'configuracion']).map(mod => {
                      const getLabel = (m: string) => {
                        const labels: Record<string, string> = {
                          ventas: 'Pedidos',
                          clientes: 'Clientes',
                          productos: 'Productos',
                          inventario: 'Inventario',
                          gastos: 'Egresos',
                          contabilidad: 'Contabilidad',
                          conciliacion: 'Conciliación Bancaria',
                          expediente: 'Expediente',
                          proveedores: 'Proveedores',
                          personal: 'Personal (Staff)',
                          asistencia: 'Asistencia y Nóminas',
                          configuracion: 'Configuración'
                        };
                        return labels[m] || m;
                      };
                      return (
                        <div key={mod} className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {getLabel(mod)}
                          </span>
                          <div className="flex gap-4">
                            <button
                              onClick={() => togglePermiso(mod, 'read')}
                              className="flex items-center gap-1 hover:text-amber-500 transition-colors"
                            >
                              {(permisosPerfil[mod] || { read: false }).read ? (
                                <CheckSquare size={14} className="text-emerald-500" />
                              ) : (
                                <Square size={14} />
                              )}
                              Ver (Lectura)
                            </button>
                            <button
                              onClick={() => togglePermiso(mod, 'write')}
                              className="flex items-center gap-1 hover:text-amber-500 transition-colors"
                            >
                              {(permisosPerfil[mod] || { write: false }).write ? (
                                <CheckSquare size={14} className="text-emerald-500" />
                              ) : (
                                <Square size={14} />
                              )}
                              Gestionar (Escritura)
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={handleCrearPerfil}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm h-9"
                >
                  <Plus size={14} /> Guardar Perfil de Seguridad
                </button>
              </div>

              {/* Tabla de Perfiles */}
              <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                      <th className="p-3">Perfil</th>
                      <th className="p-3">Permisos de Módulos (Lectura/Escritura)</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                    {perfiles.map(perf => (
                      <tr key={perf.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                        <td className="p-3 font-semibold text-gray-800 dark:text-gray-200">{perf.nombre}</td>
                        <td className="p-3 text-[10px] space-y-0.5">
                          {Object.entries(perf.permisos || {}).map(([mod, rules]: [string, {read:boolean; write:boolean}]) => {
                            const getLabel = (m: string) => {
                              const labels: Record<string, string> = {
                                ventas: 'Pedidos',
                                clientes: 'Clientes',
                                productos: 'Productos',
                                inventario: 'Inventario',
                                gastos: 'Egresos',
                                contabilidad: 'Contabilidad',
                                conciliacion: 'Conciliación Bancaria',
                                expediente: 'Expediente',
                                proveedores: 'Proveedores',
                                personal: 'Personal (Staff)',
                                asistencia: 'Asistencia y Nóminas',
                                configuracion: 'Configuración'
                              };
                              return labels[m] || m;
                            };
                            return (
                              <div key={mod}>
                                <span className="font-bold text-gray-500 uppercase">
                                  {getLabel(mod)}:
                                </span>{' '}
                                <span className="text-gray-400">
                                  {rules.read ? 'Lectura' : ''}
                                  {rules.read && rules.write ? ' + ' : ''}
                                  {rules.write ? 'Escritura' : ''}
                                  {!rules.read && !rules.write ? 'Ninguno' : ''}
                                </span>
                              </div>
                            );
                          })}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleEliminarPerfil(perf.id)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {perfiles.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-4 text-center text-gray-400 italic">No hay perfiles definidos</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DERECHA: USUARIOS STAFF */}
            <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UserCheck className="text-amber-500" size={20} /> Crear Usuario Interno (Staff)
              </h3>

              {/* Formulario Staff */}
              <form onSubmit={handleCrearStaff} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 font-sans space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre Completo *</label>
                    <input
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      required
                      value={nuevoStaff.nombre}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevoStaff({ ...nuevoStaff, nombre: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Correo Electrónico *</label>
                    <input
                      type="email"
                      placeholder="correo@empresa.com"
                      required
                      value={nuevoStaff.email}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white font-mono"
                      onChange={e => setNuevoStaff({ ...nuevoStaff, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Contraseña Temporal *</label>
                    <input
                      type="password"
                      placeholder="Contraseña temporal"
                      required
                      value={nuevoStaff.password}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevoStaff({ ...nuevoStaff, password: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Perfil Asignado *</label>
                    <select
                      value={selectedPerfilId}
                      required
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setSelectedPerfilId(e.target.value)}
                    >
                      <option value="">Seleccionar perfil...</option>
                      {perfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selector Multi-Sucursal */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Sucursales Permitidas *</label>
                  <div className="grid grid-cols-2 gap-2 bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 max-h-36 overflow-y-auto">
                    {sucursales.map(suc => (
                      <button
                        key={suc.id}
                        type="button"
                        onClick={() => toggleSucursalSeleccionada(suc.id)}
                        className="flex items-center gap-1.5 text-xs text-left hover:text-amber-500 transition-colors"
                      >
                        {selectedSucursales.includes(suc.id) ? (
                          <CheckSquare size={14} className="text-amber-500 shrink-0" />
                        ) : (
                          <Square size={14} className="shrink-0" />
                        )}
                        <span className="truncate">{suc.nombre}</span>
                      </button>
                    ))}
                    {sucursales.length === 0 && (
                      <span className="text-[10px] text-gray-400 italic col-span-2">No hay sucursales registradas</span>
                    )}
                  </div>
                </div>

                {/* Selector Multi-Empresa */}
                {empresas.length > 1 && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Empresas Permitidas (Opcional)</label>
                    <div className="grid grid-cols-2 gap-2 bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 max-h-36 overflow-y-auto">
                      {empresas.map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => toggleEmpresaSeleccionada(emp.id)}
                          className="flex items-center gap-1.5 text-xs text-left hover:text-amber-500 transition-colors"
                        >
                          {selectedEmpresas.includes(emp.id) ? (
                            <CheckSquare size={14} className="text-amber-500 shrink-0" />
                          ) : (
                            <Square size={14} className="shrink-0" />
                          )}
                          <span className="truncate">{emp.nombre}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={guardandoUsuario}
                  className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm h-9"
                >
                  <Key size={14} /> {guardandoUsuario ? 'Registrando Auth...' : 'Crear Usuario de Staff'}
                </button>
              </form>

              {/* Tabla de Usuarios Staff */}
              <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Correo</th>
                      <th className="p-3">Perfil</th>
                      <th className="p-3 text-center">Estatus</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                    {usuariosStaff.map(st => (
                      <tr key={st.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                        <td className="p-3 font-semibold text-gray-800 dark:text-gray-200">
                          {st.id === empresaId ? 'Administrador Creador' : (st.correo.split('@')[0])}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-gray-600 dark:text-gray-400">{st.correo}</td>
                        <td className="p-3 font-medium text-gray-700 dark:text-gray-300">
                          {st.perfiles_seguridad?.nombre || (st.es_superusuario ? '★ Superusuario' : 'Sin perfil')}
                        </td>
                        <td className="p-3 text-center">
                          {st.activo ? (
                            <button
                              onClick={() => handleEliminarStaff(st.id)}
                              className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all"
                            >
                              Activo
                            </button>
                          ) : (
                            <span className="bg-gray-100 dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">
                              Inactivo
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => startEditingStaff(st)}
                            className="text-amber-600 hover:text-amber-500 font-bold hover:underline"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* MODAL DE EDICIÓN DE STAFF */}
        {editingStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-lg p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-150 dark:border-gray-850">
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <UserCheck className="text-amber-500" size={18} /> Editar Usuario Administrador
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-250 text-xs font-bold font-sans"
                >
                  Cerrar
                </button>
              </div>

              <form onSubmit={handleUpdateStaff} className="space-y-4 font-sans text-xs">
                <div>
                  <label className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase block mb-1">Nombre Completo</label>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {editingStaff.id === empresaId ? 'Administrador Creador' : (editingStaff.correo as string).split('@')[0]}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase block mb-1">Correo Electrónico</label>
                  <p className="font-mono text-gray-600 dark:text-gray-400 text-xs">{editingStaff.correo}</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase block mb-1">Perfil Asignado *</label>
                  <select
                    value={editPerfilId}
                    required
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-gray-950 dark:text-white outline-none"
                    onChange={e => setEditPerfilId(e.target.value)}
                  >
                    <option value="">Seleccionar perfil...</option>
                    {perfiles.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Selector Multi-Sucursal */}
                <div>
                  <label className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase block mb-2">Sucursales Permitidas *</label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800 max-h-32 overflow-y-auto">
                    {sucursales.map(suc => (
                      <button
                        key={suc.id}
                        type="button"
                        onClick={() => {
                          setEditSucursales(prev =>
                            prev.includes(suc.id) ? prev.filter(id => id !== suc.id) : [...prev, suc.id]
                          );
                        }}
                        className="flex items-center gap-1.5 text-xs text-left hover:text-amber-500 transition-colors"
                      >
                        {editSucursales.includes(suc.id) ? (
                          <CheckSquare size={14} className="text-amber-500 shrink-0" />
                        ) : (
                          <Square size={14} className="shrink-0" />
                        )}
                        <span className="truncate">{suc.nombre}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selector Multi-Empresa */}
                {empresas.length > 1 && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase block mb-2">Empresas Permitidas (Opcional)</label>
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-800 max-h-32 overflow-y-auto">
                      {empresas.map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setEditEmpresas(prev =>
                              prev.includes(emp.id) ? prev.filter(id => id !== emp.id) : [...prev, emp.id]
                            );
                          }}
                          className="flex items-center gap-1.5 text-xs text-left hover:text-amber-500 transition-colors"
                        >
                          {editEmpresas.includes(emp.id) ? (
                            <CheckSquare size={14} className="text-amber-500 shrink-0" />
                          ) : (
                            <Square size={14} className="shrink-0" />
                          )}
                          <span className="truncate">{emp.nombre}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-150 dark:border-gray-850">
                  <button
                    type="button"
                    onClick={() => setEditingStaff(null)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={actualizandoUsuario}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg font-bold transition-all shadow-sm"
                  >
                    {actualizandoUsuario ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
