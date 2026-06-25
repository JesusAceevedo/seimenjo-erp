'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Soup, LayoutDashboard, Users, FileDown, Settings, LogOut, Package, Truck, Boxes } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import OnboardingWizard from './components/OnboardingWizard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
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

        // 2. Esperar a que Supabase Auth restaure la sesión en memoria
        let { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Espera corta para evitar condiciones de carrera en la carga del cliente de Supabase
          await new Promise(resolve => setTimeout(resolve, 200));
          const res = await supabase.auth.getSession();
          session = res.data.session;
        }

        // 3. Si sigue sin haber sesión activa en Supabase, verificar si hay token en localStorage antes de redirigir
        if (!session) {
          const urlPart = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const projectId = urlPart.includes('//') ? (urlPart.split('//')[1]?.split('.')[0] || 'ioxfhgmeapwyfrgvtyjd') : 'ioxfhgmeapwyfrgvtyjd';
          const supabaseSessionKey = `sb-${projectId}-auth-token`;
          const hasSupabaseSessionInStorage = typeof window !== 'undefined' && !!localStorage.getItem(supabaseSessionKey);

          if (hasSupabaseSessionInStorage) {
            console.log('Sesión en inicialización detectada en localStorage de Supabase. Evitando redirección.');
            setLoadingOnboarding(false);
            return;
          }

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

        // 4. Continuar con la validación utilizando la sesión autenticada garantizada
        const datosSesion = JSON.parse(sesionGuardada);
        if (datosSesion.tipo === 'staff') {
          const isSuper = !!datosSesion.es_superusuario;
          setEsSuperusuario(isSuper);
          setUsuarioEmail(datosSesion.email || 'Usuario Staff');

          if (datosSesion.empresa_id) {
            setEmpresaId(datosSesion.empresa_id);

            // Consultar si la empresa ya tiene RFC o Razón Social registrada
            const { data: empresaData, error: empresaError } = await supabase
              .from('empresas')
              .select('nombre, rfc, razon_social, logo_url')
              .eq('id', datosSesion.empresa_id)
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
          } else if (!isSuper) {
            // Si no hay empresa_id y no es superusuario, requiere configuración
            setNeedsOnboarding(true);
          }

          // Consultar los módulos activos de la empresa
          if (datosSesion.empresa_id) {
            const { data: modulosData } = await supabase
              .from('modulos_empresa')
              .select('modulo')
              .eq('empresa_id', datosSesion.empresa_id)
              .eq('activo', true);

            if (modulosData) {
              setActiveModules(modulosData.map(m => m.modulo.toLowerCase()));
            }
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
              if (datosSesion.empresa_id && !list.some(e => e.id === datosSesion.empresa_id)) {
                const { data: curEmp } = await supabase.from('empresas').select('id, nombre').eq('id', datosSesion.empresa_id).maybeSingle();
                if (curEmp) list.push(curEmp);
              }
              setSwitchableCompanies(list);
            }
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
      <aside className="w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
          {logoUrl && !logoError ? (
            <img src={logoUrl} alt="Logo" onError={() => setLogoError(true)} className="w-9 h-9 rounded-lg object-contain border border-gray-200 dark:border-gray-800 bg-white" />
          ) : (
            <Soup className="text-amber-500 w-8 h-8" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-lg leading-tight truncate" title={empresaNombre || 'Mi Empresa'}>
              {empresaNombre || 'Mi Empresa'}
            </h1>
            {switchableCompanies.length > 1 ? (
              <div className="mt-1 relative">
                <select
                  disabled={isSwitching}
                  value={empresaId || ''}
                  onChange={(e) => handleSwitchCompany(e.target.value)}
                  className="w-full text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide border-none outline-none cursor-pointer focus:ring-1 focus:ring-amber-500/50 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23b45309%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[right_8px_center] bg-no-repeat pr-6"
                >
                  {switchableCompanies.map(c => (
                    <option key={c.id} value={c.id} className="text-gray-900 bg-white dark:bg-gray-950 dark:text-white text-xs">
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide block w-fit mt-0.5">
                {empresaNombre ? 'Staff' : 'Administración'}
              </span>
            )}
          </div>
        </div>

        <nav className="p-4 space-y-2 font-sans">
          {/* BOTÓN VENTAS */}
          {hasModule('ventas') && (
            <button
              onClick={() => router.push('/admin/monitor')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/monitor') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <LayoutDashboard size={18} /> Pedidos
            </button>
          )}

          {/* BOTÓN CLIENTES */}
          {hasModule('clientes') && (
            <button
              onClick={() => router.push('/admin/Clientes')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/Clientes') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <Users size={18} /> Clientes
            </button>
          )}
          {hasModule('productos') && (
            <button
              onClick={() => router.push('/admin/productos')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/productos') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'}`}
            >
              <Package size={18} /> Productos
            </button>
          )}
          {hasModule('productos') && (
            <button
              onClick={() => router.push('/admin/inventario')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/inventario') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'}`}
            >
              <Boxes size={18} /> Inventario
            </button>
          )}
          {/* BOTÓN GASTOS */}
          {hasModule('gastos') && (
            <button
              onClick={() => router.push('/admin/egresos')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/egresos') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <FileDown size={18} /> Egresos
            </button>
          )}

          {/* BOTÓN CONCILIACIÓN */}
          {hasModule('gastos') && (
            <button
              onClick={() => router.push('/admin/gastos')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/gastos') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <FileDown size={18} /> Facturación
            </button>
          )}

          {/* BOTÓN EXPEDIENTE */}
          {hasModule('gastos') && (
            <button
              onClick={() => router.push('/admin/expediente')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/expediente') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <FileDown size={18} /> Expediente
            </button>
          )}

          {/* BOTÓN PROVEEDORES */}
          {hasModule('gastos') && (
            <button
              onClick={() => router.push('/admin/proveedores')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/proveedores') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <Truck size={18} /> Proveedores
            </button>
          )}

          {/* BOTÓN STAFF & PERSONAL */}
          {hasModule('personal') && (
            <button
              onClick={() => router.push('/admin/staff')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/staff') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <Users size={18} /> Personal
            </button>
          )}

          {/* BOTÓN CONFIGURACIÓN */}
          {hasModule('configuracion') && (
            <button
              onClick={() => router.push('/admin/configuracion')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/configuracion') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <Settings size={18} /> Configuración
            </button>
          )}

        </nav>


        {/* SECCIÓN USUARIO Y LOGOUT AL INFERIOR */}
        {usuarioEmail && (
          <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-between gap-3 font-sans">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate" title={usuarioEmail}>
                {usuarioEmail}
              </p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                {esSuperusuario ? 'Superusuario' : 'Staff Operador'}
              </p>
            </div>
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