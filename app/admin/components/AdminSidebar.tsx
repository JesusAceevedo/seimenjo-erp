'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Soup,
  LayoutDashboard,
  Users,
  FileDown,
  Settings,
  LogOut,
  Package,
  Truck,
  Boxes,
  Clock,
  Landmark,
  Receipt,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import CompanySwitcher from './CompanySwitcher';

interface AdminSidebarProps {
  logoUrl: string | null;
  empresaNombre: string | null;
  empresaId: string | null;
  switchableCompanies: { id: string; nombre: string }[];
  isSwitching: boolean;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  hasModule: (moduleName: string) => boolean;
  usuarioEmail: string | null;
  esSuperusuario: boolean;
  onSwitchCompany: (newEmpresaId: string) => void;
  onSignOut: () => void;
}

export default function AdminSidebar({
  logoUrl,
  empresaNombre,
  empresaId,
  switchableCompanies,
  isSwitching,
  isSidebarCollapsed,
  toggleSidebar,
  hasModule,
  usuarioEmail,
  esSuperusuario,
  onSwitchCompany,
  onSignOut,
}: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [logoError, setLogoError] = React.useState(false);

  const isSelected = (path: string) => pathname === path || pathname.startsWith(path);

  const navItems = [
    { module: 'ventas', path: '/admin/monitor', label: 'Pedidos', icon: LayoutDashboard },
    { module: 'clientes', path: '/admin/Clientes', label: 'Clientes', icon: Users },
    { module: 'productos', path: '/admin/productos', label: 'Productos', icon: Package },
    { module: 'inventario', path: '/admin/inventario', label: 'Inventario', icon: Boxes },
    { module: 'gastos', path: '/admin/egresos', label: 'Egresos', icon: FileText },
    { module: 'contabilidad', path: '/admin/contabilidad', label: 'Contabilidad', icon: Receipt },
    { module: 'conciliacion', path: '/admin/conciliacion', label: 'Conciliación Bancaria', icon: Landmark },
    { module: 'expediente', path: '/admin/expediente', label: 'Expediente', icon: FileDown },
    { module: 'proveedores', path: '/admin/proveedores', label: 'Proveedores', icon: Truck },
    { module: 'personal', path: '/admin/staff', label: 'Personal', icon: Users },
    { module: 'asistencia', path: '/admin/asistencia', label: 'Asistencia y Nóminas', icon: Clock },
    { module: 'configuracion', path: '/admin/configuracion', label: 'Configuración', icon: Settings },
  ];

  return (
    <aside
      className={`${
        isSidebarCollapsed ? 'w-16' : 'w-64'
      } bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out`}
    >
      <div
        className={`p-4 border-b border-gray-200 dark:border-gray-800 flex items-center ${
          isSidebarCollapsed ? 'justify-center' : 'justify-between gap-2'
        }`}
      >
        {!isSidebarCollapsed && (
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt="Logo"
                onError={() => setLogoError(true)}
                className="w-8 h-8 rounded-lg object-contain border border-gray-200 dark:border-gray-800 bg-white"
              />
            ) : (
              <Soup className="text-amber-500 w-7 h-7" />
            )}
            <div className="min-w-0 flex-1">
              <h1
                className="font-bold text-sm leading-tight truncate"
                title={empresaNombre || 'Mi Empresa'}
              >
                {empresaNombre || 'Mi Empresa'}
              </h1>
              <CompanySwitcher
                empresaId={empresaId}
                switchableCompanies={switchableCompanies}
                isSwitching={isSwitching}
                onSwitchCompany={onSwitchCompany}
              />
            </div>
          </div>
        )}
        {isSidebarCollapsed && (
          <div className="flex items-center justify-center shrink-0">
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt="Logo"
                onError={() => setLogoError(true)}
                className="w-8 h-8 rounded-lg object-contain border border-gray-200 dark:border-gray-800 bg-white"
              />
            ) : (
              <Soup className="text-amber-500 w-7 h-7" />
            )}
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-250 shrink-0 transition-colors"
          title={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      <nav className={`flex-1 overflow-y-auto space-y-1 font-sans ${isSidebarCollapsed ? 'p-2' : 'p-3'}`}>
        {navItems.map(
          (item) =>
            hasModule(item.module) && (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-lg font-medium transition-all ${
                  isSidebarCollapsed
                    ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850'
                    : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
                } ${
                  isSelected(item.path)
                    ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <item.icon size={isSidebarCollapsed ? 20 : 16} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            )
        )}
      </nav>

      {usuarioEmail && (
        <div
          className={`mt-auto border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex items-center font-sans ${
            isSidebarCollapsed ? 'justify-center p-3' : 'justify-between p-4 gap-3'
          }`}
        >
          {!isSidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p
                className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate"
                title={usuarioEmail}
              >
                {usuarioEmail}
              </p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                {esSuperusuario ? 'Superusuario' : 'Staff Operador'}
              </p>
            </div>
          )}
          <button
            onClick={onSignOut}
            title="Cerrar Sesión"
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </aside>
  );
}
