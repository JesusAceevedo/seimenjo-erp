'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Soup, LayoutDashboard, Users, FileDown, Settings, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import OnboardingWizard from './components/OnboardingWizard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loadingOnboarding, setLoadingOnboarding] = useState(true);
  const [activeModules, setActiveModules] = useState<string[]>([]);
  const [esSuperusuario, setEsSuperusuario] = useState(false);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data } = await supabase
          .from('configuracion_ticket')
          .select('logo_url')
          .limit(1)
          .maybeSingle();
        if (data?.logo_url) {
          setLogoUrl(data.logo_url);
        }
      } catch (err) {
        console.error('Error fetching logo for sidebar:', err);
      }
    };
    fetchLogo();
  }, []);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const sesionGuardada = localStorage.getItem('seimenjo_session');
        if (!sesionGuardada) {
          setLoadingOnboarding(false);
          return;
        }

        const datosSesion = JSON.parse(sesionGuardada);
        if (datosSesion.tipo === 'staff') {
          const isSuper = !!datosSesion.es_superusuario;
          setEsSuperusuario(isSuper);
          setUsuarioEmail(datosSesion.email || 'Usuario Staff');

          if (!isSuper && datosSesion.empresa_id) {
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

            if (empresaData?.logo_url) {
              setLogoUrl(empresaData.logo_url);
            }

            if (!empresaError && (!empresaData?.rfc || !empresaData?.razon_social)) {
              setNeedsOnboarding(true);
            }

            // Consultar los módulos activos de la empresa
            const { data: modulosData } = await supabase
              .from('modulos_empresa')
              .select('modulo')
              .eq('empresa_id', datosSesion.empresa_id)
              .eq('activo', true);

            if (modulosData) {
              setActiveModules(modulosData.map(m => m.modulo.toLowerCase()));
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
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-lg object-contain border border-gray-200 dark:border-gray-800 bg-white" />
          ) : (
            <Soup className="text-amber-500 w-8 h-8" />
          )}
          <div>
            <h1 className="font-bold text-lg leading-tight">SEIMENJO</h1>
            {empresaNombre ? (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide block w-fit mt-0.5">
                {empresaNombre}
              </span>
            ) : (
              <span className="text-xs text-gray-500">Administración</span>
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
              <LayoutDashboard size={18} /> Monitor de Ventas
            </button>
          )}

          {/* BOTÓN CLIENTES */}
          {hasModule('clientes') && (
            <button
              onClick={() => router.push('/admin/Clientes')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/Clientes') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <Users size={18} /> Catálogo de Clientes
            </button>
          )}
          
          {/* BOTÓN GASTOS */}
          {hasModule('gastos') && (
            <button
              onClick={() => router.push('/admin/egresos')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/egresos') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <FileDown size={18} /> Registro de Egresos
            </button>
          )}
          
          {/* BOTÓN CONCILIACIÓN */}
          {hasModule('gastos') && (
            <button
              onClick={() => router.push('/admin/gastos')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/gastos') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <FileDown size={18} /> Conciliación XML (SAT)
            </button>
          )}

          {/* BOTÓN STAFF & PERSONAL */}
          {hasModule('personal') && (
            <button
              onClick={() => router.push('/admin/staff')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/staff') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <Users size={18} /> Gestión de Personal
            </button>
          )}

          {/* BOTÓN CONFIGURACIÓN */}
          {hasModule('configuracion') && (
            <button
              onClick={() => router.push('/admin/configuracion')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/configuracion') ? 'bg-amber-600 text-white font-semibold' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'
                }`}
            >
              <Settings size={18} /> Configuración ERP
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

      <main className="flex-1 h-full overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}