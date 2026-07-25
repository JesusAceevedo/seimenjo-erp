'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import OnboardingWizard from './components/OnboardingWizard';
import AdminSidebar from './components/AdminSidebar';
import { CfdiViewerProvider } from './_components/CfdiViewerContext';

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
    setIsSidebarCollapsed((prev) => {
      const newVal = !prev;
      localStorage.setItem('seimenjo_sidebar_collapsed', String(newVal));
      return newVal;
    });
  };

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

  const handleSignOut = async () => {
    if (confirm('¿Deseas cerrar sesión?')) {
      localStorage.removeItem('seimenjo_session');
      await supabase.auth.signOut();
      router.push('/admin/login');
    }
  };

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const isLoginPage = pathname === '/admin/login' || pathname === '/login';

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

        let session = null;
        for (let i = 0; i < 5; i++) {
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s) {
            session = s;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

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

        const targetEmpresaId = datosSesion.empresa_id;
        if (targetEmpresaId) {
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
          } else {
            setLogoUrl(null);
          }

          if (!isSuper && !empresaError && (!empresaData || !empresaData.rfc || !empresaData.razon_social)) {
            setNeedsOnboarding(true);
          }

          const { data: modulosData } = await supabase
            .from('modulos_empresa')
            .select('modulo')
            .eq('empresa_id', targetEmpresaId)
            .eq('activo', true);

          if (modulosData) {
            setActiveModules(modulosData.map((m) => m.modulo.toLowerCase()));
          }
        } else if (!isSuper) {
          setNeedsOnboarding(true);
        }

        if (isSuper) {
          const { data: emps } = await supabase.from('empresas').select('id, nombre').order('nombre');
          if (emps) {
            setSwitchableCompanies(emps);
          }
        } else {
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

            const list =
              (pivotEmps
                ?.map((p: any) => {
                  const emp = p.empresas;
                  if (Array.isArray(emp)) return emp[0];
                  return emp;
                })
                .filter(Boolean) as unknown as { id: string; nombre: string }[]) || [];

            if (targetEmpresaId && !list.some((e) => e.id === targetEmpresaId)) {
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

  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        {children}
      </div>
    );
  }

  if (loadingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

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
      <AdminSidebar
        logoUrl={logoUrl}
        empresaNombre={empresaNombre}
        empresaId={empresaId}
        switchableCompanies={switchableCompanies}
        isSwitching={isSwitching}
        isSidebarCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        hasModule={hasModule}
        usuarioEmail={usuarioEmail}
        esSuperusuario={esSuperusuario}
        onSwitchCompany={handleSwitchCompany}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 h-full overflow-auto flex flex-col">
        <CfdiViewerProvider>{children}</CfdiViewerProvider>
      </main>
    </div>
  );
}