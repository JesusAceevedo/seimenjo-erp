'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import {
  Settings, Truck, CreditCard, FileCheck, Hash, Globe, FileText,
  FolderOpen, Users, Plus, Trash2, Save, Sun, Moon, AlertTriangle, Package
} from 'lucide-react';
import ProductosTab from './ProductosTab';
import TicketConfigTab from './TicketConfigTab';
import { crearBucketsAlmacenamiento, provisionarAdminEmpresa } from '../actions/adminAuth';


export default function ConfigPage() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const [activeTab, setActiveTab] = useState<'ventas' | 'clientes' | 'gastos' | 'productos' | 'tickets' | 'superusuario'>('ventas');

  // --- ESTADOS DE DATOS ---
  const [repartidores, setRepartidores] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [estatusFactura, setEstatusFactura] = useState<any[]>([]);
  const [regimenesFiscales, setRegimenesFiscales] = useState<any[]>([]);
  const [usosCfdi, setUsosCfdi] = useState<any[]>([]);
  const [categoriasGasto, setCategoriasGasto] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [productoVariantes, setProductoVariantes] = useState<any[]>([]);

  // --- ESTADOS DE SUPERUSUARIO ---
  const [esSuperusuario, setEsSuperusuario] = useState(false);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [sucursales, setSucursales] = useState<any[]>([]);
  const [modulosEmpresa, setModulosEmpresa] = useState<any[]>([]);
  const [nuevaEmpresa, setNuevaEmpresa] = useState({
    nombre: '',
    rfc: '',
    razon_social: '',
    codigo_postal: '',
    regimen_fiscal_id: '',
    email_contacto: '',
    telefono: '',
    moneda: 'MXN',
    logo_url: '',
    logo_ticket_url: '',
    csd_cer_url: '',
    csd_key_url: '',
    csd_password_encriptada: '',
    limite_sucursales: 3,
    limite_usuarios: 10,
    facturacion_activa: false
  });
  const [nuevaSucursal, setNuevaSucursal] = useState({ empresa_id: '', nombre: '', codigo: '' });

  // --- ESTADOS PARA CREACIÓN DE ADMIN DE EMPRESA ---
  const [adminEmpresaId, setAdminEmpresaId] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [creandoAdmin, setCreandoAdmin] = useState(false);

  // Consecutivo del Pedido
  const [siguientePedido, setSiguientePedido] = useState<number>(1000);
  const [guardandoConsecutivo, setGuardandoConsecutivo] = useState(false);

  // --- ESTADOS DE ERRORES DE TABLAS (BD DIRECTA) ---
  const [errors, setErrors] = useState<{ [key: string]: string | null }>({});

  // --- FORMULARIOS ---
  const [nuevoRepartidor, setNuevoRepartidor] = useState('');
  const [nuevaFormaPago, setNuevaFormaPago] = useState('');
  const [nuevoEstatusFactura, setNuevoEstatusFactura] = useState('');
  const [nuevoRegimen, setNuevoRegimen] = useState({ clave: '', descripcion: '' });
  const [nuevoUso, setNuevoUso] = useState({ clave: '', descripcion: '' });
  const [nuevaCategoria, setNuevaCategoria] = useState({ nombre: '', tipo: 'Operativo' });
  const [nuevoProveedor, setNuevoProveedor] = useState({
    nombre_comercial: '', rfc: '', razon_social: '', telefono: '', email: ''
  });
  const [nuevaVariante, setNuevaVariante] = useState({ producto_id: '', gramaje: '', precio_base: '' });

  // --- METODOS DE CARGA ---
  const fetchCatalog = async (tableName: string, orderBy = 'nombre') => {
    try {
      const { data, error } = await supabase.from(tableName).select('*').order(orderBy);
      if (error) throw error;
      setErrors(prev => ({ ...prev, [tableName]: null }));
      return data || [];
    } catch (err: any) {
      console.error(`Error al cargar ${tableName}:`, err);
      setErrors(prev => ({ ...prev, [tableName]: err.message || 'Error de base de datos' }));
      return [];
    }
  };

  const loadAllData = async () => {
    // 1. Repartidores
    const reps = await fetchCatalog('repartidores', 'nombre');
    setRepartidores(reps);

    // 2. Formas de Pago
    const fps = await fetchCatalog('formas_pago', 'nombre');
    setFormasPago(fps);

    // 3. Estatus de Factura
    const efs = await fetchCatalog('estatus_factura', 'nombre');
    setEstatusFactura(efs);

    // 4. Régimenes Fiscales
    const rfs = await fetchCatalog('regimenes_fiscales', 'clave');
    setRegimenesFiscales(rfs);

    // 5. Usos CFDI
    const ucs = await fetchCatalog('usos_cfdi', 'clave');
    setUsosCfdi(ucs);

    // 6. Categorías de Gasto
    const cgs = await fetchCatalog('categorias_gasto', 'nombre');
    setCategoriasGasto(cgs);

    // 7. Proveedores
    const provs = await fetchCatalog('proveedores', 'nombre_comercial');
    setProveedores(provs);

    // 8. Productos
    try {
      const { data: prodsData, error: prodsErr } = await supabase.from('productos').select('*').order('nombre');
      if (prodsErr) throw prodsErr;
      setProductos(prodsData || []);
      setErrors(prev => ({ ...prev, 'productos': null }));
    } catch (err: any) {
      console.error(err);
      setErrors(prev => ({ ...prev, 'productos': err.message }));
    }

    // 9. Variantes
    try {
      const { data: varsData, error: varsErr } = await supabase
        .from('producto_variantes')
        .select('*, productos(nombre)')
        .order('id');
      if (varsErr) throw varsErr;
      setProductoVariantes(varsData || []);
      setErrors(prev => ({ ...prev, 'producto_variantes': null }));
    } catch (err: any) {
      console.error(err);
      setErrors(prev => ({ ...prev, 'producto_variantes': err.message }));
    }

    // 10. Consecutivo del Pedido
    try {
      const { data: nextNum, error: seqErr } = await supabase.rpc('get_siguiente_pedido_numero');
      if (seqErr) throw seqErr;
      setSiguientePedido(nextNum || 1000);
      setErrors(prev => ({ ...prev, 'consecutivo': null }));
    } catch (err: any) {
      console.error(err);
      setErrors(prev => ({ ...prev, 'consecutivo': err.message || 'La función RPC no está configurada.' }));
    }
  };

  const loadSuperData = async () => {
    try {
      const [empRes, sucRes, modRes] = await Promise.all([
        supabase.from('empresas').select('*').order('nombre'),
        supabase.from('sucursales').select('*, empresas(nombre)').order('nombre'),
        supabase.from('modulos_empresa').select('*')
      ]);
      if (empRes.data) setEmpresas(empRes.data);
      if (sucRes.data) setSucursales(sucRes.data);
      if (modRes.data) setModulosEmpresa(modRes.data);
    } catch (err) {
      console.error("Error al cargar datos de superusuario:", err);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/admin/login');

      // Consultar si el usuario actual es Superusuario (usando supabase_auth_id)
      const { data: staffData } = await supabase
        .from('usuarios_staff')
        .select('es_superusuario')
        .eq('supabase_auth_id', session.user.id)
        .maybeSingle();

      if (staffData?.es_superusuario) {
        setEsSuperusuario(true);
        await crearBucketsAlmacenamiento();
        await loadSuperData();
      }

      await loadAllData();
    };
    checkAuth();
  }, [router]);

  // --- ACCIONES COMUNES ---
  const handleSaveItem = async (tableName: string, fields: any, setList: React.Dispatch<React.SetStateAction<any[]>>, orderBy = 'nombre', resetForm: () => void) => {
    try {
      const { error } = await supabase.from(tableName).insert([fields]);
      if (error) throw error;
      const updated = await fetchCatalog(tableName, orderBy);
      setList(updated);
      resetForm();
    } catch (err: any) {
      console.error(err);
      alert(`Error al guardar en ${tableName}: ${err.message || err.details || 'Error desconocido'}`);
    }
  };

  const handleDeleteItem = async (tableName: string, id: string, setList: React.Dispatch<React.SetStateAction<any[]>>, orderBy = 'nombre') => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      const updated = await fetchCatalog(tableName, orderBy);
      setList(updated);
    } catch (err: any) {
      console.error(err);
      alert(`Error al eliminar de ${tableName}: ${err.message || err.details || 'Error desconocido'}`);
    }
  };

  // Consecutivo
  const handleSaveConsecutivo = async () => {
    setGuardandoConsecutivo(true);
    try {
      const { data, error } = await supabase.rpc('set_siguiente_pedido_numero', { num: siguientePedido });
      if (error) throw error;
      alert(`Consecutivo actualizado a: ${siguientePedido} en la base de datos.`);
      setErrors(prev => ({ ...prev, 'consecutivo': null }));
    } catch (err: any) {
      console.error(err);
      alert(`Error al guardar consecutivo: ${err.message || 'Fallo de RPC'}`);
    } finally {
      setGuardandoConsecutivo(false);
    }
  };

  const handleUploadFile = async (file: File, bucket: string, folder: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { data, error } = await supabase.storage.from(bucket).upload(fileName, file);
      if (error) throw error;
      
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (err: any) {
      console.error(err);
      alert('Error al subir archivo: ' + err.message);
      return '';
    }
  };

  const handleCrearEmpresa = async () => {
    if (!nuevaEmpresa.nombre.trim()) return alert('El nombre de la empresa es obligatorio.');
    try {
      const { data, error } = await supabase
        .from('empresas')
        .insert([{
          nombre: nuevaEmpresa.nombre,
          rfc: nuevaEmpresa.rfc || null,
          razon_social: nuevaEmpresa.razon_social || null,
          codigo_postal: nuevaEmpresa.codigo_postal || null,
          regimen_fiscal_id: nuevaEmpresa.regimen_fiscal_id || null,
          email_contacto: nuevaEmpresa.email_contacto || null,
          telefono: nuevaEmpresa.telefono || null,
          moneda: nuevaEmpresa.moneda,
          logo_url: nuevaEmpresa.logo_url || null,
          logo_ticket_url: nuevaEmpresa.logo_ticket_url || null,
          csd_cer_url: nuevaEmpresa.csd_cer_url || null,
          csd_key_url: nuevaEmpresa.csd_key_url || null,
          csd_password_encriptada: nuevaEmpresa.csd_password_encriptada || null,
          limite_sucursales: nuevaEmpresa.limite_sucursales,
          limite_usuarios: nuevaEmpresa.limite_usuarios,
          facturacion_activa: nuevaEmpresa.facturacion_activa
        }])
        .select()
        .single();
      
      if (error) throw error;
      
      // Auto-inicializar módulos
      const modulosDefecto = ['ventas', 'clientes', 'gastos', 'facturacion', 'personal', 'configuracion'];
      const insertsModulos = modulosDefecto.map(m => ({ empresa_id: data.id, modulo: m, activo: true }));
      await supabase.from('modulos_empresa').insert(insertsModulos);
      
      setNuevaEmpresa({
        nombre: '', rfc: '', razon_social: '', codigo_postal: '', regimen_fiscal_id: '',
        email_contacto: '', telefono: '', moneda: 'MXN', logo_url: '', logo_ticket_url: '',
        csd_cer_url: '', csd_key_url: '', csd_password_encriptada: '',
        limite_sucursales: 3, limite_usuarios: 10, facturacion_activa: false
      });
      await loadSuperData();
      alert('Empresa creada e inicializada correctamente.');
    } catch (err: any) {
      console.error(err);
      alert('Error al crear empresa: ' + err.message);
    }
  };

  const handleCrearSucursal = async () => {
    if (!nuevaSucursal.empresa_id) return alert('Debes seleccionar una empresa.');
    if (!nuevaSucursal.nombre.trim()) return alert('El nombre de la sucursal es obligatorio.');
    try {
      const { error } = await supabase
        .from('sucursales')
        .insert([{
          empresa_id: nuevaSucursal.empresa_id,
          nombre: nuevaSucursal.nombre,
          codigo: nuevaSucursal.codigo || null
        }]);
      
      if (error) throw error;
      
      setNuevaSucursal({ empresa_id: '', nombre: '', codigo: '' });
      await loadSuperData();
      alert('Sucursal creada correctamente.');
    } catch (err: any) {
      console.error(err);
      alert('Error al crear sucursal: ' + err.message);
    }
  };

  const handleCrearAdminEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Validar selección de empresa
    if (!adminEmpresaId) {
      return alert('Error de Validación: Debes seleccionar una empresa de la lista.');
    }

    // 2. Validar nombre completo
    const nombreTrimmed = adminNombre.trim();
    if (!nombreTrimmed) {
      return alert('Error de Validación: El nombre del administrador es obligatorio.');
    }
    if (nombreTrimmed.length < 3) {
      return alert('Error de Validación: El nombre completo debe tener al menos 3 caracteres.');
    }

    // 3. Validar correo electrónico
    const emailTrimmed = adminEmail.trim();
    if (!emailTrimmed) {
      return alert('Error de Validación: El correo electrónico es obligatorio.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      return alert('Error de Validación: Por favor, ingresa una dirección de correo electrónico válida (Ej. admin@empresa.com).');
    }

    // 4. Validar contraseña
    const passwordTrimmed = adminPassword.trim();
    if (!passwordTrimmed) {
      return alert('Error de Validación: La contraseña temporal es obligatoria.');
    }
    if (passwordTrimmed.length < 6) {
      return alert('Error de Validación: La contraseña debe tener al menos 6 caracteres por seguridad.');
    }

    setCreandoAdmin(true);
    try {
      const res = await provisionarAdminEmpresa({
        empresaId: adminEmpresaId,
        nombre: nombreTrimmed,
        email: emailTrimmed,
        passwordTemporal: passwordTrimmed
      });

      if (!res.success) throw new Error(res.error);

      alert('¡Éxito! El administrador de la empresa ha sido creado correctamente.');
      setAdminNombre('');
      setAdminEmail('');
      setAdminPassword('');
      setAdminEmpresaId('');
    } catch (err: any) {
      console.error(err);
      alert('Error al crear administrador: ' + err.message);
    } finally {
      setCreandoAdmin(false);
    }
  };

  const handleToggleModulo = async (empresaId: string, modulo: string, estadoActual: boolean) => {
    try {
      const { error } = await supabase
        .from('modulos_empresa')
        .upsert({
          empresa_id: empresaId,
          modulo: modulo,
          activo: !estadoActual
        }, { onConflict: 'empresa_id,modulo' });
      
      if (error) throw error;
      await loadSuperData();
    } catch (err: any) {
      console.error(err);
      alert('Error al cambiar estatus del módulo: ' + err.message);
    }
  };

  const handleEliminarEmpresa = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta empresa? Se borrarán todas sus sucursales y módulos asociados.')) return;
    try {
      const { error } = await supabase.from('empresas').delete().eq('id', id);
      if (error) throw error;
      await loadSuperData();
    } catch (err: any) {
      console.error(err);
      alert('Error al eliminar empresa: ' + err.message);
    }
  };

  const handleEliminarSucursal = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta sucursal?')) return;
    try {
      const { error } = await supabase.from('sucursales').delete().eq('id', id);
      if (error) throw error;
      await loadSuperData();
    } catch (err: any) {
      console.error(err);
      alert('Error al eliminar sucursal: ' + err.message);
    }
  };



  // --- SEÑALIZACIÓN ERROR DB ---
  const ErrorBanner = ({ table }: { table: string }) => {
    const err = errors[table];
    if (!err) return null;
    return (
      <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 p-3 rounded-xl border border-red-200 dark:border-red-900/50 text-xs flex items-start gap-2 animate-in fade-in">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <div>
          <strong>Error de Base de Datos:</strong> {err}. 
          <p className="mt-1 text-gray-500 dark:text-gray-400 font-sans">
            Asegúrate de ejecutar el script <span className="font-mono bg-gray-100 dark:bg-gray-800 p-0.5 rounded">supabase_setup.sql</span> en el editor SQL para crear la tabla.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full`}>
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 transition-colors flex flex-col p-8 w-full max-w-[100vw] mx-auto">
        
        {/* HEADER DE CONFIGURACIÓN */}
        <div className="mb-8 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3">
              <Settings className="text-amber-500 w-8 h-8" /> Configuración de Catálogos ERP
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Administra centralizadamente catálogos, configuraciones fiscales y consecutivos en la base de datos Postgres.
            </p>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-amber-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS (TABS CON GLASSMORPHISM) */}
        <div className="flex gap-2 p-1.5 bg-gray-200/55 dark:bg-gray-950/40 backdrop-blur-md rounded-2xl mb-8 self-start border border-gray-300/30 dark:border-gray-800/30 font-sans">
          <button
            onClick={() => setActiveTab('ventas')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
              activeTab === 'ventas'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-800/50'
            }`}
          >
            <Truck size={16} /> Módulo de Ventas
          </button>
          <button
            onClick={() => setActiveTab('clientes')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
              activeTab === 'clientes'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-800/50'
            }`}
          >
            <Globe size={16} /> Módulo de Clientes (SAT)
          </button>
          <button
            onClick={() => setActiveTab('gastos')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
              activeTab === 'gastos'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-800/50'
            }`}
          >
            <FolderOpen size={16} /> Módulo de Gastos
          </button>
          <button
            onClick={() => setActiveTab('productos')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
              activeTab === 'productos'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-800/50'
            }`}
          >
            <Package size={16} /> Productos y Precios Especiales
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
              activeTab === 'tickets'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-800/50'
            }`}
          >
            <FileText size={16} /> Configuración de Tickets
          </button>
          {esSuperusuario && (
            <button
              onClick={() => setActiveTab('superusuario')}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'superusuario'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-800/50'
              }`}
            >
              <Globe size={16} /> Administración de Superusuario
            </button>
          )}
        </div>

        {/* --- CONTENIDO DE LAS PESTAÑAS --- */}
        <div className="flex-1 space-y-8 animate-in fade-in duration-300">
          
          {/* PESTAÑA: VENTAS */}
          {activeTab === 'ventas' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* BLOQUE: REPARTIDORES */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Truck className="text-amber-500" size={20} /> Catálogo de Repartidores
                </h3>
                
                <ErrorBanner table="repartidores" />

                {/* Formulario */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Nombre del Repartidor"
                    value={nuevoRepartidor}
                    className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-amber-500 outline-none text-gray-900 dark:text-white"
                    onChange={e => setNuevoRepartidor(e.target.value)}
                  />
                  <button
                    onClick={() => handleSaveItem('repartidores', { nombre: nuevoRepartidor }, setRepartidores, 'nombre', () => setNuevoRepartidor(''))}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Plus size={16} /> Agregar
                  </button>
                </div>

                {/* Tabla */}
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                        <th className="p-3">Nombre</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {repartidores.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-semibold">{r.nombre}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteItem('repartidores', r.id, setRepartidores, 'nombre')}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {repartidores.length === 0 && !errors['repartidores'] && (
                        <tr>
                          <td colSpan={2} className="p-4 text-center text-gray-400 italic">No hay repartidores registrados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BLOQUE: CONSECUTIVO DEL PEDIDO */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Hash className="text-amber-500" size={20} /> Consecutivo del Pedido
                </h3>
                
                <ErrorBanner table="consecutivo" />
                
                <p className="text-xs text-gray-500 dark:text-gray-400 font-sans">
                  Define el número consecutivo del siguiente pedido que se capture en el monitor maestro.
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={siguientePedido}
                    className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm font-mono focus:ring-1 focus:ring-amber-500 outline-none text-gray-900 dark:text-white"
                    onChange={e => setSiguientePedido(parseInt(e.target.value) || 0)}
                  />
                  <button
                    onClick={handleSaveConsecutivo}
                    disabled={guardandoConsecutivo}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <Save size={16} /> Guardar Consecutivo
                  </button>
                </div>
              </div>

              {/* BLOQUE: FORMAS DE PAGO */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <CreditCard className="text-amber-500" size={20} /> Formas de Pago
                </h3>
                
                <ErrorBanner table="formas_pago" />

                {/* Formulario */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej. Cheque, Tarjeta..."
                    value={nuevaFormaPago}
                    className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-amber-500 outline-none text-gray-900 dark:text-white"
                    onChange={e => setNuevaFormaPago(e.target.value)}
                  />
                  <button
                    onClick={() => handleSaveItem('formas_pago', { nombre: nuevaFormaPago }, setFormasPago, 'nombre', () => setNuevaFormaPago(''))}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Plus size={16} /> Agregar
                  </button>
                </div>

                {/* Tabla */}
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                        <th className="p-3">Forma de Pago</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {formasPago.map(fp => (
                        <tr key={fp.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-semibold">{fp.nombre}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteItem('formas_pago', fp.id, setFormasPago, 'nombre')}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formasPago.length === 0 && !errors['formas_pago'] && (
                        <tr>
                          <td colSpan={2} className="p-4 text-center text-gray-400 italic">No hay formas de pago registradas</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BLOQUE: ESTATUS DE FACTURA */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FileCheck className="text-amber-500" size={20} /> Estatus de Factura
                </h3>
                
                <ErrorBanner table="estatus_factura" />

                {/* Formulario */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ej. Facturado, Cancelado..."
                    value={nuevoEstatusFactura}
                    className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-amber-500 outline-none text-gray-900 dark:text-white"
                    onChange={e => setNuevoEstatusFactura(e.target.value)}
                  />
                  <button
                    onClick={() => handleSaveItem('estatus_factura', { nombre: nuevoEstatusFactura }, setEstatusFactura, 'nombre', () => setNuevoEstatusFactura(''))}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Plus size={16} /> Agregar
                  </button>
                </div>

                {/* Tabla */}
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                        <th className="p-3">Estatus</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {estatusFactura.map(ef => (
                        <tr key={ef.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-semibold">{ef.nombre}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteItem('estatus_factura', ef.id, setEstatusFactura, 'nombre')}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {estatusFactura.length === 0 && !errors['estatus_factura'] && (
                        <tr>
                          <td colSpan={2} className="p-4 text-center text-gray-400 italic">No hay estatus de factura registrados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* PESTAÑA: CLIENTES */}
          {activeTab === 'clientes' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* BLOQUE: RÉGIMENES FISCALES */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Globe className="text-emerald-500" size={20} /> Régimen Fiscal (SAT)
                </h3>
                
                <ErrorBanner table="regimenes_fiscales" />

                {/* Formulario */}
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Clave (Ej. 601)"
                    value={nuevoRegimen.clave}
                    className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 outline-none text-gray-900 dark:text-white font-mono"
                    onChange={e => setNuevoRegimen({ ...nuevoRegimen, clave: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Descripción"
                    value={nuevoRegimen.descripcion}
                    className="col-span-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 outline-none text-gray-900 dark:text-white"
                    onChange={e => setNuevoRegimen({ ...nuevoRegimen, descripcion: e.target.value })}
                  />
                  <button
                    onClick={() => handleSaveItem('regimenes_fiscales', nuevoRegimen, setRegimenesFiscales, 'clave', () => setNuevoRegimen({ clave: '', descripcion: '' }))}
                    className="col-span-3 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Plus size={16} /> Agregar Régimen
                  </button>
                </div>

                {/* Tabla */}
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                        <th className="p-3 w-16">Clave</th>
                        <th className="p-3">Descripción</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {regimenesFiscales.map(rf => (
                        <tr key={rf.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{rf.clave}</td>
                          <td className="p-3 font-semibold text-gray-700 dark:text-gray-300">{rf.descripcion}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteItem('regimenes_fiscales', rf.id, setRegimenesFiscales, 'clave')}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {regimenesFiscales.length === 0 && !errors['regimenes_fiscales'] && (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-gray-400 italic">No hay régimenes registrados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* BLOQUE: USOS DE CFDI */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FileText className="text-emerald-500" size={20} /> Uso de CFDI (SAT)
                </h3>
                
                <ErrorBanner table="usos_cfdi" />

                {/* Formulario */}
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Clave (Ej. G03)"
                    value={nuevoUso.clave}
                    className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 outline-none text-gray-900 dark:text-white font-mono"
                    onChange={e => setNuevoUso({ ...nuevoUso, clave: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Descripción"
                    value={nuevoUso.descripcion}
                    className="col-span-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 outline-none text-gray-900 dark:text-white"
                    onChange={e => setNuevoUso({ ...nuevoUso, descripcion: e.target.value })}
                  />
                  <button
                    onClick={() => handleSaveItem('usos_cfdi', nuevoUso, setUsosCfdi, 'clave', () => setNuevoUso({ clave: '', descripcion: '' }))}
                    className="col-span-3 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Plus size={16} /> Agregar Uso
                  </button>
                </div>

                {/* Tabla */}
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                        <th className="p-3 w-16">Clave</th>
                        <th className="p-3">Descripción</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {usosCfdi.map(uc => (
                        <tr key={uc.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{uc.clave}</td>
                          <td className="p-3 font-semibold text-gray-700 dark:text-gray-300">{uc.descripcion}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteItem('usos_cfdi', uc.id, setUsosCfdi, 'clave')}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {usosCfdi.length === 0 && !errors['usos_cfdi'] && (
                        <tr>
                          <td colSpan={3} className="p-4 text-center text-gray-400 italic">No hay usos de CFDI registrados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* PESTAÑA: GASTOS */}
          {activeTab === 'gastos' && (
            <div className="space-y-8 animate-in fade-in">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* BLOQUE: CATEGORÍAS DE GASTO */}
                <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <FolderOpen className="text-blue-500" size={20} /> Categorías de Gasto
                  </h3>
                  
                  <ErrorBanner table="categorias_gasto" />

                  {/* Formulario */}
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Nombre (Ej. Luz)"
                      value={nuevaCategoria.nombre}
                      className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                      onChange={e => setNuevaCategoria({ ...nuevaCategoria, nombre: e.target.value })}
                    />
                    <select
                      value={nuevaCategoria.tipo}
                      className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-sm focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                      onChange={e => setNuevaCategoria({ ...nuevaCategoria, tipo: e.target.value })}
                    >
                      <option value="Operativo">Operativo</option>
                      <option value="Materia Prima">Materia Prima</option>
                    </select>
                    <button
                      onClick={() => handleSaveItem('categorias_gasto', { nombre: nuevaCategoria.nombre, tipo: nuevaCategoria.tipo, descripcion: nuevaCategoria.tipo }, setCategoriasGasto, 'nombre', () => setNuevaCategoria({ nombre: '', tipo: 'Operativo' }))}
                      className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Plus size={16} /> Agregar
                    </button>
                  </div>

                  {/* Tabla */}
                  <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                          <th className="p-3">Categoría</th>
                          <th className="p-3">Tipo / Clasificación</th>
                          <th className="p-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                        {categoriasGasto.map(cg => (
                          <tr key={cg.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                            <td className="p-3 font-semibold">{cg.nombre}</td>
                            <td className="p-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                (cg.tipo === 'Materia Prima' || cg.descripcion === 'Materia Prima')
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/50'
                                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
                              }`}>
                                {cg.tipo || cg.descripcion || 'Operativo'}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleDeleteItem('categorias_gasto', cg.id, setCategoriasGasto, 'nombre')}
                                className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {categoriasGasto.length === 0 && !errors['categorias_gasto'] && (
                          <tr>
                            <td colSpan={3} className="p-4 text-center text-gray-400 italic">No hay categorías registradas</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* BLOQUE: METODO DE PAGO (ESPEJO DE FORMA DE PAGO) */}
                <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <CreditCard className="text-blue-500" size={20} /> Métodos de Pago (Consulta)
                  </h3>
                  
                  <ErrorBanner table="formas_pago" />
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-sans">
                    Este catálogo se comparte con las formas de pago de Ventas. Puedes gestionarlo desde la pestaña Ventas.
                  </p>
                  <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                          <th className="p-3">Método / Forma</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                        {formasPago.map(fp => (
                          <tr key={fp.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                            <td className="p-3 font-semibold">{fp.nombre}</td>
                          </tr>
                        ))}
                        {formasPago.length === 0 && !errors['formas_pago'] && (
                          <tr>
                            <td className="p-4 text-center text-gray-400 italic">No hay métodos registrados</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* BLOQUE: PROVEEDORES */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Users className="text-blue-500" size={20} /> Directorio de Proveedores
                </h3>
                
                <ErrorBanner table="proveedores" />

                {/* Formulario */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-100 dark:border-gray-800 font-sans">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre Comercial *</label>
                    <input
                      type="text"
                      placeholder="Nombre del Proveedor"
                      value={nuevoProveedor.nombre_comercial}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevoProveedor({ ...nuevoProveedor, nombre_comercial: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">RFC</label>
                    <input
                      type="text"
                      placeholder="XAXX010101000"
                      value={nuevoProveedor.rfc}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs uppercase text-gray-900 dark:text-white font-mono"
                      onChange={e => setNuevoProveedor({ ...nuevoProveedor, rfc: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Razón Social</label>
                    <input
                      type="text"
                      placeholder="Razón Social Completa"
                      value={nuevoProveedor.razon_social}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs uppercase text-gray-900 dark:text-white"
                      onChange={e => setNuevoProveedor({ ...nuevoProveedor, razon_social: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Teléfono</label>
                    <input
                      type="tel"
                      placeholder="Teléfono"
                      value={nuevoProveedor.telefono}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevoProveedor({ ...nuevoProveedor, telefono: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Email Contacto</label>
                    <input
                      type="email"
                      placeholder="email@proveedor.com"
                      value={nuevoProveedor.email}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevoProveedor({ ...nuevoProveedor, email: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={() => handleSaveItem('proveedores', nuevoProveedor, setProveedores, 'nombre_comercial', () => setNuevoProveedor({ nombre_comercial: '', rfc: '', razon_social: '', telefono: '', email: '' }))}
                    className="bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm h-9"
                  >
                    <Plus size={14} /> Registrar
                  </button>
                </div>

                {/* Tabla */}
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                        <th className="p-3">Nombre Comercial</th>
                        <th className="p-3">Razón Social / RFC</th>
                        <th className="p-3">Contacto</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {proveedores.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-semibold text-gray-800 dark:text-gray-200">{p.nombre_comercial}</td>
                          <td className="p-3">
                            <div className="font-semibold">{p.razon_social || 'N/A'}</div>
                            <div className="text-[10px] font-mono text-gray-400">{p.rfc || 'Sin RFC'}</div>
                          </td>
                          <td className="p-3">
                            <div>Tel: {p.telefono || 'Sin teléfono'}</div>
                            <div className="text-[10px] text-gray-400">{p.email || 'Sin correo'}</div>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleDeleteItem('proveedores', p.id, setProveedores, 'nombre_comercial')}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {proveedores.length === 0 && !errors['proveedores'] && (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-400 italic">No hay proveedores registrados</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'productos' && (
            <div className="animate-in fade-in duration-305">
              <ProductosTab />
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="animate-in fade-in duration-305">
              <TicketConfigTab />
            </div>
          )}

          {activeTab === 'superusuario' && esSuperusuario && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* SECCIÓN: EMPRESAS */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Globe className="text-amber-500" size={20} /> Registro de Empresas (Tenants)
                </h3>
                
                {/* Formulario Empresa Extendido */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-100 dark:border-gray-800 font-sans">
                  
                  {/* Fila 1: Datos de Identidad */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre Comercial / Nombre de Fantasía *</label>
                    <input
                      type="text"
                      placeholder="Ej. Sakura Ramen"
                      value={nuevaEmpresa.nombre}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Razón Social (Mayúsculas, sin S.A., S. de R.L., etc.) *</label>
                    <input
                      type="text"
                      placeholder="Ej. SAKURA RAMEN PLAYA"
                      value={nuevaEmpresa.razon_social}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white uppercase"
                      onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, razon_social: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">RFC *</label>
                    <input
                      type="text"
                      placeholder="Ej. SRA240614XX1"
                      value={nuevaEmpresa.rfc}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs uppercase text-gray-900 dark:text-white font-mono"
                      onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, rfc: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>

                  {/* Fila 2: Datos de Ubicación y CFDI */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Código Postal Fiscal *</label>
                    <input
                      type="text"
                      placeholder="Ej. 77710"
                      value={nuevaEmpresa.codigo_postal}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white font-mono"
                      onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, codigo_postal: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Régimen Fiscal (SAT) *</label>
                    <select
                      value={nuevaEmpresa.regimen_fiscal_id}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, regimen_fiscal_id: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar régimen...</option>
                      {regimenesFiscales.map(r => (
                        <option key={r.id} value={r.id}>{r.clave} - {r.descripcion}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Moneda Predeterminada</label>
                    <select
                      value={nuevaEmpresa.moneda}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, moneda: e.target.value })}
                    >
                      <option value="MXN">MXN - Peso Mexicano</option>
                      <option value="USD">USD - Dólar Americano</option>
                    </select>
                  </div>

                  {/* Fila 3: Datos de Contacto */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Email de Contacto</label>
                    <input
                      type="email"
                      placeholder="contacto@empresa.com"
                      value={nuevaEmpresa.email_contacto}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, email_contacto: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Teléfono de Contacto</label>
                    <input
                      type="tel"
                      placeholder="+52 9841234567"
                      value={nuevaEmpresa.telefono}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, telefono: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Límite Sucursales</label>
                      <input
                        type="number"
                        min={1}
                        value={nuevaEmpresa.limite_sucursales}
                        className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                        onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, limite_sucursales: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Límite Usuarios</label>
                      <input
                        type="number"
                        min={1}
                        value={nuevaEmpresa.limite_usuarios}
                        className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                        onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, limite_usuarios: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>

                  {/* Fila 4: Carga de Logos */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Logo Principal ERP (Público)</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-600/10 file:text-amber-500 hover:file:bg-amber-600/20"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = await handleUploadFile(file, 'empresas-logos', 'logos');
                          setNuevaEmpresa({ ...nuevaEmpresa, logo_url: url });
                        }
                      }}
                    />
                    {nuevaEmpresa.logo_url && (
                      <span className="text-[10px] text-emerald-500 mt-1 block font-semibold">✓ Cargado</span>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Logo para Ticket POS (Público)</label>
                    <input
                      type="file"
                      accept="image/*"
                      className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-600/10 file:text-amber-500 hover:file:bg-amber-600/20"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = await handleUploadFile(file, 'empresas-logos', 'tickets');
                          setNuevaEmpresa({ ...nuevaEmpresa, logo_ticket_url: url });
                        }
                      }}
                    />
                    {nuevaEmpresa.logo_ticket_url && (
                      <span className="text-[10px] text-emerald-500 mt-1 block font-semibold">✓ Cargado</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 h-full pt-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nuevaEmpresa.facturacion_activa}
                        onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, facturacion_activa: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 dark:bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                      <span className="ml-3 text-xs font-semibold text-gray-700 dark:text-gray-200 font-sans">Facturación Activa (CFDI 4.0)</span>
                    </label>
                  </div>

                  {/* Fila 5: CSD SAT */}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Certificado CSD (.cer) (Privado)</label>
                    <input
                      type="file"
                      accept=".cer"
                      className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-600/10 file:text-amber-500 hover:file:bg-amber-600/20"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = await handleUploadFile(file, 'empresas-csd', 'cer');
                          setNuevaEmpresa({ ...nuevaEmpresa, csd_cer_url: url });
                        }
                      }}
                    />
                    {nuevaEmpresa.csd_cer_url && (
                      <span className="text-[10px] text-emerald-500 mt-1 block font-semibold">✓ Cargado (.cer)</span>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Llave Privada CSD (.key) (Privado)</label>
                    <input
                      type="file"
                      accept=".key"
                      className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-600/10 file:text-amber-500 hover:file:bg-amber-600/20"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = await handleUploadFile(file, 'empresas-csd', 'key');
                          setNuevaEmpresa({ ...nuevaEmpresa, csd_key_url: url });
                        }
                      }}
                    />
                    {nuevaEmpresa.csd_key_url && (
                      <span className="text-[10px] text-emerald-500 mt-1 block font-semibold">✓ Cargado (.key)</span>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Contraseña CSD (Encriptada)</label>
                    <input
                      type="password"
                      placeholder="Contraseña del sello"
                      value={nuevaEmpresa.csd_password_encriptada}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevaEmpresa({ ...nuevaEmpresa, csd_password_encriptada: e.target.value })}
                    />
                  </div>

                  {/* Botón enviar */}
                  <div className="md:col-span-3 flex justify-end">
                    <button
                      onClick={handleCrearEmpresa}
                      className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 shadow-lg h-11"
                    >
                      <Plus size={16} /> Dar de Alta Empresa Inquilina
                    </button>
                  </div>
                </div>

                {/* Tabla de Empresas */}
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                        <th className="p-3">ID</th>
                        <th className="p-3">Nombre</th>
                        <th className="p-3">RFC</th>
                        <th className="p-3">Módulos Activos</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {empresas.map(emp => {
                        const modulosDisponibles = ['ventas', 'clientes', 'gastos', 'facturacion', 'personal', 'configuracion'];
                        return (
                          <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                            <td className="p-3 font-mono text-[10px] text-gray-400">{emp.id}</td>
                            <td className="p-3 font-semibold text-gray-800 dark:text-gray-200">{emp.nombre}</td>
                            <td className="p-3 font-mono uppercase text-gray-600 dark:text-gray-400">{emp.rfc || 'Sin RFC'}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-2">
                                {modulosDisponibles.map(m => {
                                  const moduloActivo = modulosEmpresa.find(me => me.empresa_id === emp.id && me.modulo === m && me.activo);
                                  return (
                                    <button
                                      key={m}
                                      onClick={() => handleToggleModulo(emp.id, m, !!moduloActivo)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                        moduloActivo
                                          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700'
                                      }`}
                                    >
                                      {m.toUpperCase()}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => handleEliminarEmpresa(emp.id)}
                                className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {empresas.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-gray-400 italic">No hay empresas registradas</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECCIÓN: CREACIÓN DE ADMINISTRADOR DE EMPRESA */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Users className="text-amber-500" size={20} /> Crear Administrador de Empresa
                </h3>
                <form onSubmit={handleCrearAdminEmpresa} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-100 dark:border-gray-800 font-sans">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Empresa Seleccionada *</label>
                    <select
                      value={adminEmpresaId}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setAdminEmpresaId(e.target.value)}
                      required
                    >
                      <option value="">Seleccionar empresa...</option>
                      {empresas.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre Completo *</label>
                    <input
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      value={adminNombre}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setAdminNombre(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Correo Electrónico *</label>
                    <input
                      type="email"
                      placeholder="admin@empresa.com"
                      value={adminEmail}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white font-mono"
                      onChange={e => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Contraseña Temporal *</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={adminPassword}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={creandoAdmin}
                      className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm h-10"
                    >
                      <Plus size={14} /> {creandoAdmin ? 'Creando...' : 'Crear y Asignar Administrador'}
                    </button>
                  </div>
                </form>
              </div>

              {/* SECCIÓN: SUCURSALES */}
              <div className="bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Truck className="text-amber-500" size={20} /> Registro de Sucursales
                </h3>

                {/* Formulario Sucursal */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-100 dark:border-gray-800 font-sans">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Empresa Asignada *</label>
                    <select
                      value={nuevaSucursal.empresa_id}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevaSucursal({ ...nuevaSucursal, empresa_id: e.target.value })}
                    >
                      <option value="">Seleccionar empresa...</option>
                      {empresas.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Nombre de Sucursal *</label>
                    <input
                      type="text"
                      placeholder="Ej. Sucursal Centro"
                      value={nuevaSucursal.nombre}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevaSucursal({ ...nuevaSucursal, nombre: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Código Sucursal (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ej. SUC-001"
                      value={nuevaSucursal.codigo}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-900 dark:text-white"
                      onChange={e => setNuevaSucursal({ ...nuevaSucursal, codigo: e.target.value })}
                    />
                  </div>
                  <button
                    onClick={handleCrearSucursal}
                    className="bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg font-bold text-xs transition-colors flex items-center justify-center gap-1 shadow-sm h-9"
                  >
                    <Plus size={14} /> Registrar Sucursal
                  </button>
                </div>

                {/* Tabla de Sucursales */}
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-100/60 dark:bg-gray-900/40 p-3 border-b border-gray-200 dark:border-gray-800 font-semibold text-gray-500">
                        <th className="p-3">ID</th>
                        <th className="p-3">Sucursal</th>
                        <th className="p-3">Empresa</th>
                        <th className="p-3">Código</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/40">
                      {sucursales.map(suc => (
                        <tr key={suc.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/10">
                          <td className="p-3 font-mono text-[10px] text-gray-400">{suc.id}</td>
                          <td className="p-3 font-semibold text-gray-800 dark:text-gray-200">{suc.nombre}</td>
                          <td className="p-3 text-gray-700 dark:text-gray-300">{suc.empresas?.nombre || 'N/A'}</td>
                          <td className="p-3 font-mono text-gray-600 dark:text-gray-400">{suc.codigo || 'N/A'}</td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleEliminarSucursal(suc.id)}
                              className="text-gray-400 hover:text-red-500 p-1 rounded-md transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {sucursales.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-gray-400 italic">No hay sucursales registradas</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
