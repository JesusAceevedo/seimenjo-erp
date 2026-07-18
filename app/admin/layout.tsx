'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Soup, LayoutDashboard, Users, FileDown, Settings, LogOut, Package, Truck, Boxes, Clock, Landmark, Receipt, FileText, DollarSign, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import OnboardingWizard from './components/OnboardingWizard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('seimenjo_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('seimenjo_sidebar_collapsed', String(newVal));
      return newVal;
    });
  };
  const [logoError, setLogoError] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loadingOnboarding, setLoadingOnboarding] = useState(true);
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [esSuperusuario, setEsSuperusuario] = useState(false);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null);
  const [switchableCompanies, setSwitchableCompanies] = useState<{ id: string; nombre: string }[]>([]);
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitchCompany = async (newEmpresaId: string) => {
    if (!newEmpresaId || newEmpresaId === empresaId) return;
    setIsSwitching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error: dbError } = await supabase
        .from('usuarios_staff')
        .update({ empresa_id: newEmpresaId })
        .eq('supabase_auth_id', session.user.id);

      if (dbError) throw dbError;

      const sesionGuardada = localStorage.getItem('seimenjo_session');
      if (sesionGuardada) {
        const datosSesion = JSON.parse(sesionGuardada);
        datosSesion.empresa_id = newEmpresaId;
        localStorage.setItem('seimenjo_session', JSON.stringify(datosSesion));
      }

      window.location.reload();
    } catch (err) {
      console.error('Error al cambiar de empresa:', err);
      alert('No se pudo cambiar de empresa: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setIsSwitching(false);
    }
  };

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const isLoginPage = pathname === '/admin/login' || pathname === '/login';

        // 1. Verificar si hay sesión en localStorage del ERP
        const sesionGuardada = localStorage.getItem('seimenjo_session');
        if (!sesionGuardada) {
          if (!isLoginPage) {
            setLoadingOnboarding(false);
            router.push('/admin/login');
            return;
          }
          setLoadingOnboarding(false);
          return;
        }

        // 2. Si ya coinciden los datos del localStorage con el estado actual, y los módulos ya están cargados,
        // evitar volver a consultar las APIs de Supabase para evitar demoras innecesarias.
        const datosSesion = JSON.parse(sesionGuardada);
        if (
          empresaId === datosSesion.empresa_id &&
          usuarioEmail === (datosSesion.email || 'Usuario Staff') &&
          activeModules.length > 0 &&
          !isLoginPage
        ) {
          setLoadingOnboarding(false);
          return;
        }

        const isSuper = !!datosSesion.es_superusuario;
        setEsSuperusuario(isSuper);
        setUsuarioEmail(datosSesion.email || 'Usuario Staff');
        if (datosSesion.empresa_id) {
          setEmpresaId(datosSesion.empresa_id);
        }

        // 3. Esperar a que Supabase Auth restaure la sesión en memoria (hasta 1.5 segundos con reintentos)
        let session = null;
        for (let i = 0; i < 5; i++) {
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s) {
            session = s;
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // 4. Si sigue sin haber sesión activa en memoria, verificar si hay token en localStorage antes de redirigir
        const urlPart = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectId = urlPart.includes('//') ? (urlPart.split('//')[1]?.split('.')[0] || 'ioxfhgmeapwyfrgvtyjd') : 'ioxfhgmeapwyfrgvtyjd';
        const supabaseSessionKey = `sb-${projectId}-auth-token`;
        const hasSupabaseSessionInStorage = typeof window !== 'undefined' && !!localStorage.getItem(supabaseSessionKey);

        if (!session && !hasSupabaseSessionInStorage) {
          if (!isLoginPage) {
            console.warn('Sesión de Supabase no detectada o expirada. Redirigiendo a login...');
            localStorage.removeItem('seimenjo_session');
            setLoadingOnboarding(false);
            router.push('/admin/login');
            return;
          }
          setLoadingOnboarding(false);
          return;
        }

        // 5. Cargar información de la empresa e inquilino
        const targetEmpresaId = datosSesion.empresa_id;
        if (targetEmpresaId) {
          // Consultar si la empresa ya tiene RFC o Razón Social registrada
          const { data: empresaData, error: empresaError } = await supabase
            .from('empresas')
            .select('nombre, rfc, razon_social, logo_url')
            .eq('id', targetEmpresaId)
            .maybeSingle();

          if (empresaData?.nombre) {
            setEmpresaNombre(empresaData.nombre);
          }

          if (empresaData?.logo_url && empresaData.logo_url !== 'null' && empresaData.logo_url !== 'undefined') {
            setLogoUrl(empresaData.logo_url);
            setLogoError(false);
          } else {
            setLogoUrl(null);
          }

          if (!isSuper && !empresaError && (!empresaData || !empresaData.rfc || !empresaData.razon_social)) {
            setNeedsOnboarding(true);
          }

          // Consultar los módulos activos de la empresa
          const { data: modulosData } = await supabase
            .from('modulos_empresa')
            .select('modulo')
            .eq('empresa_id', targetEmpresaId)
            .eq('activo', true);

          if (modulosData) {
            setActiveModules(modulosData.map(m => m.modulo.toLowerCase()));
          }
        } else if (!isSuper) {
          // Si no hay empresa_id y no es superusuario, requiere configuración
          setNeedsOnboarding(true);
        }

        // Cargar catálogo de empresas para cambio de contexto
        if (isSuper) {
          const { data: emps } = await supabase.from('empresas').select('id, nombre').order('nombre');
          if (emps) {
            setSwitchableCompanies(emps);
          }
        } else {
          // Obtener el registro de staff para encontrar su id
          const { data: staffUser } = await supabase
            .from('usuarios_staff')
            .select('id')
            .eq('supabase_auth_id', datosSesion.id)
            .maybeSingle();

          if (staffUser) {
            const { data: pivotEmps } = await supabase
              .from('empresas_usuario_pivot')
              .select('empresa_id, empresas(id, nombre)')
              .eq('usuario_id', staffUser.id);
            
            const list = (pivotEmps?.map((p: any) => {
              const emp = p.empresas;
              if (Array.isArray(emp)) return emp[0];
              return emp;
            }).filter(Boolean) as unknown as { id: string; nombre: string }[]) || [];
            
            // Asegurar que la empresa actual esté en la lista
            if (targetEmpresaId && !list.some(e => e.id === targetEmpresaId)) {
              const { data: curEmp } = await supabase.from('empresas').select('id, nombre').eq('id', targetEmpresaId).maybeSingle();
              if (curEmp) list.push(curEmp);
            }
            setSwitchableCompanies(list);
          }
        }
      } catch (err) {
        console.error('Error al validar onboarding/módulos:', err);
      } finally {
        setLoadingOnboarding(false);
      }
    };

    checkOnboarding();
  }, [pathname]);

  const hasModule = (moduleName: string) => {
    if (esSuperusuario) return true;
    if (moduleName === 'ventas') {
      return activeModules.includes('ventas') || activeModules.includes('pedidos');
    }
    return activeModules.includes(moduleName);
  };

  const isLoginPage = pathname === '/admin/login' || pathname === '/login';

  // Si estamos en el login, renderizamos una vista limpia y centrada
  // sin la barra lateral ni el contenedor general del administrador.
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        {children}
      </div>
    );
  }

  // Si se está verificando el estado de onboarding, mostramos pantalla de carga
  if (loadingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  // Esta función comprueba la ruta exacta o sub-ruta para el resto del ERP
  const isSelected = (path: string) => pathname === path || pathname.startsWith(path);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {needsOnboarding && empresaId && (
        <OnboardingWizard
          empresaId={empresaId}
          onSuccess={() => {
            setNeedsOnboarding(false);
            window.location.reload();
          }}
        />
      )}
      <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out`}>
        <div className={`p-4 border-b border-gray-200 dark:border-gray-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between gap-2'}`}>
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {logoUrl && !logoError ? (
                <img src={logoUrl} alt="Logo" onError={() => setLogoError(true)} className="w-8 h-8 rounded-lg object-contain border border-gray-200 dark:border-gray-800 bg-white" />
              ) : (
                <Soup className="text-amber-500 w-7 h-7" />
              )}
              <div className="min-w-0 flex-1">
                <h1 className="font-bold text-sm leading-tight truncate" title={empresaNombre || 'Mi Empresa'}>
                  {empresaNombre || 'Mi Empresa'}
                </h1>
                {switchableCompanies.length > 1 ? (
                  <div className="mt-0.5 relative">
                    <select
                      disabled={isSwitching}
                      value={empresaId || ''}
                      onChange={(e) => handleSwitchCompany(e.target.value)}
                      className="w-full text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded font-semibold uppercase tracking-wide border-none outline-none cursor-pointer focus:ring-1 focus:ring-amber-500/50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23b45309%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:6px_6px] bg-[right_4px_center] bg-no-repeat pr-4"
                    >
                      {switchableCompanies.map(c => (
                        <option key={c.id} value={c.id} className="text-gray-900 bg-white dark:bg-gray-950 dark:text-white text-xs">
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 py-0.2 rounded font-semibold uppercase tracking-wide block w-fit mt-0.5">
                    {empresaNombre ? 'Staff' : 'Administración'}
                  </span>
                )}
              </div>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="flex items-center justify-center shrink-0">
              {logoUrl && !logoError ? (
                <img src={logoUrl} alt="Logo" onError={() => setLogoError(true)} className="w-8 h-8 rounded-lg object-contain border border-gray-200 dark:border-gray-800 bg-white" />
              ) : (
                <Soup className="text-amber-500 w-7 h-7" />
              )}
            </div>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-250 shrink-0 transition-colors"
            title={isSidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
 
        <nav className={`flex-1 overflow-y-auto space-y-1 font-sans ${isSidebarCollapsed ? 'p-2' : 'p-3'}`}>
          {/* BOTÓN VENTAS */}
          {hasModule('ventas') && (
            <button
              onClick={() => router.push('/admin/monitor')}
              title={isSidebarCollapsed ? "Pedidos" : undefined}
              className={`w-full flex items-center rounded-lg font-medium transition-all ${
                isSidebarCollapsed 
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isSelected('/admin/monitor') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <LayoutDashboard size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Pedidos</span>}
            </button>
          )}
 
          {/* BOTÓN CLIENTES */}
          {hasModule('clientes') && (
            <button
              onClick={() => router.push('/admin/Clientes')}
              title={isSidebarCollapsed ? "Clientes" : undefined}
              className={`w-full flex items-center rounded-lg font-medium transition-all ${
                isSidebarCollapsed 
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isSelected('/admin/Clientes') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <Users size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Clientes</span>}
            </button>
          )}
          {hasModule('productos') && (
            <button
              onClick={() => router.push('/admin/productos')}
              title={isSidebarCollapsed ? "Productos" : undefined}
              className={`w-full flex items-center rounded-lg font-medium transition-all ${
                isSidebarCollapsed 
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isSelected('/admin/productos') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <Package size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Productos</span>}
            </button>
          )}
          {hasModule('inventario') && (
            <button
              onClick={() => router.push('/admin/inventario')}
              title={isSidebarCollapsed ? "Inventario" : undefined}
              className={`w-full flex items-center rounded-lg font-medium transition-all ${
                isSidebarCollapsed 
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isSelected('/admin/inventario') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <Boxes size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Inventario</span>}
            </button>
          )}
          {/* BOTÓN EGRESOS */}
          {hasModule('gastos') && (
            <button
              onClick={() => router.push('/admin/egresos')}
              title={isSidebarCollapsed ? "Egresos" : undefined}
              className={`w-full flex items-center rounded-lg font-medium transition-all ${
                isSidebarCollapsed 
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isSelected('/admin/egresos') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <FileText size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Egresos</span>}
            </button>
          )}
 
          {/* BOTÓN CONTABILIDAD */}
          {(hasModule('gastos') || hasModule('facturacion')) && (
            <button
              onClick={() => router.push('/admin/contabilidad')}
              title={isSidebarCollapsed ? "Contabilidad" : undefined}
              className={`w-full flex items-center rounded-lg font-medium transition-all ${
                isSidebarCollapsed 
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isSelected('/admin/contabilidad') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <Receipt size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Contabilidad</span>}
            </button>
          )}
 
          {/* BOTÓN CONCILIACIÓN BANCARIA */}
          {hasModule('facturacion') && (
            <button
              onClick={() => router.push('/admin/conciliacion')}
              title={isSidebarCollapsed ? "Conciliación Bancaria" : undefined}
              className={`w-full flex items-center rounded-lg font-medium transition-all ${
                isSidebarCollapsed 
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isSelected('/admin/conciliacion') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <Landmark size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Conciliación Bancaria</span>}
            </button>
          )}
 
          {/* BOTÓN EXPEDIENTE */}
          {hasModule('expediente') && (
            <button
              onClick={() => router.push('/admin/expediente')}
              title={isSidebarCollapsed ? "Expediente" : undefined}
              className={`w-full flex items-center rounded-lg font-medium transition-all ${
                isSidebarCollapsed 
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isSelected('/admin/expediente') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <FileDown size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Expediente</span>}
            </button>
          )}
 
          {/* BOTÓN PROVEEDORES */}
          {hasModule('proveedores') && (
            <button
              onClick={() => router.push('/admin/proveedores')}
              title={isSidebarCollapsed ? "Proveedores" : undefined}
              className={`w-full flex items-center rounded-lg font-medium transition-all ${
                isSidebarCollapsed 
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isSelected('/admin/proveedores') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <Truck size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Proveedores</span>}
            </button>
          )}
 
          {/* BOTÓN STAFF & PERSONAL */}
          {hasModule('personal') && (
            <>
              <button
                onClick={() => router.push('/admin/staff')}
                title={isSidebarCollapsed ? "Personal" : undefined}
                className={`w-full flex items-center rounded-lg font-medium transition-all ${
                  isSidebarCollapsed 
                    ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                    : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
                } ${isSelected('/admin/staff') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                <Users size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Personal</span>}
              </button>
 
              <button
                onClick={() => router.push('/admin/asistencia')}
                title={isSidebarCollapsed ? "Asistencia y Nóminas" : undefined}
                className={`w-full flex items-center rounded-lg font-medium transition-all ${
                  isSidebarCollapsed 
                    ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                    : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
                } ${isSelected('/admin/asistencia') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                <Clock size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Asistencia y Nóminas</span>}
              </button>
            </>
          )}
 
          {/* BOTÓN CONFIGURACIÓN */}
          {hasModule('configuracion') && (
            <button
              onClick={() => router.push('/admin/configuracion')}
              title={isSidebarCollapsed ? "Configuración" : undefined}
              className={`w-full flex items-center rounded-lg font-medium transition-all ${
                isSidebarCollapsed 
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850' 
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isSelected('/admin/configuracion') ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <Settings size={isSidebarCollapsed ? 20 : 16} /> {!isSidebarCollapsed && <span>Configuración</span>}
            </button>
          )}
        </nav>
 
        {/* SECCIÓN USUARIO Y LOGOUT AL INFERIOR */}
        {usuarioEmail && (
          <div className={`mt-auto border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex items-center font-sans ${isSidebarCollapsed ? 'justify-center p-3' : 'justify-between p-4 gap-3'}`}>
            {!isSidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate" title={usuarioEmail}>
                  {usuarioEmail}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                  {esSuperusuario ? 'Superusuario' : 'Staff Operador'}
                </p>
              </div>
            )}
            <button
              onClick={async () => {
                if (confirm('¿Deseas cerrar sesión?')) {
                  localStorage.removeItem('seimenjo_session');
                  await supabase.auth.signOut();
                  router.push('/admin/login');
                }
              }}
              title="Cerrar Sesión"
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 h-full overflow-auto flex flex-col">
        {children}
      </main>
    </div>
  );
}