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
  ChevronDown,
  Wrench,
  FolderKanban,
  FileBarChart,
  FileSpreadsheet,
  Layers,
  Sun,
  Moon,
} from 'lucide-react';
import CompanySwitcher from './CompanySwitcher';
import { useThemeMode } from '../../../lib/useThemeMode';

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
  const { isDarkMode, toggleDarkMode } = useThemeMode();

  // Módulos que integran "Operación Administrativa"
  const adminOpSubItems = [
    { module: 'gastos', path: '/admin/gastos', label: 'Gastos y Egresos', icon: FileText },
    { module: 'ventas', path: '/admin/ventas', label: 'Ventas e Ingresos', icon: Layers },
    { module: 'conciliacion', path: '/admin/conciliacion', label: 'Conciliación Bancaria', icon: Landmark },
    { module: 'contabilidad', path: '/admin/contabilidad', label: 'Contabilidad y Pólizas', icon: Receipt },
    { module: 'contabilidad', path: '/admin/factura-publico-general', label: 'Factura Público en General', icon: Receipt },
    { module: 'contabilidad', path: '/admin/cargas-estados-cuenta', label: 'Cargas de Estados de Cuenta', icon: FileSpreadsheet },
    { module: 'expediente', path: '/admin/expediente', label: 'Expediente', icon: FileDown },
    { module: 'herramientas', path: '/admin/herramientas', label: 'Herramientas', icon: Wrench },
    { module: 'reportes', path: '/admin/reportes', label: 'Reportes Financieros', icon: FileBarChart },
  ];

  const isSubItemActive = adminOpSubItems.some(item => pathname === item.path || pathname.startsWith(item.path));
  const [isOpAdminOpen, setIsOpAdminOpen] = React.useState(isSubItemActive);

  // Mantener abierto si se navega a uno de los submódulos
  React.useEffect(() => {
    if (isSubItemActive) {
      setIsOpAdminOpen(true);
    }
  }, [pathname, isSubItemActive]);

  const isSelected = (path: string) => {
    if (pathname === path) return true;
    return pathname.startsWith(path + '/');
  };

  // Módulos estándar principales
  const topNavItems = [
    { module: 'ventas', path: '/admin/monitor', label: 'Pedidos', icon: LayoutDashboard },
    { module: 'gastos', path: '/admin/egresos', label: 'Egresos', icon: FileText },
    { module: 'clientes', path: '/admin/Clientes', label: 'Clientes', icon: Users },
    { module: 'productos', path: '/admin/productos', label: 'Productos', icon: Package },
    { module: 'inventario', path: '/admin/inventario', label: 'Inventario', icon: Boxes },
  ];

  const bottomNavItems = [
    { module: 'proveedores', path: '/admin/proveedores', label: 'Proveedores', icon: Truck },
    { module: 'personal', path: '/admin/staff', label: 'Personal', icon: Users },
    { module: 'asistencia', path: '/admin/asistencia', label: 'Asistencia y Nóminas', icon: Clock },
    { module: 'configuracion', path: '/admin/configuracion', label: 'Configuración', icon: Settings },
  ];

  const hasAnyOpAdminModule = adminOpSubItems.some(item => hasModule(item.module));

  return (
    <aside
      className={`${isSidebarCollapsed ? 'w-16' : 'w-64'
        } bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 transition-all duration-300 ease-in-out`}
    >
      <div
        className={`p-4 border-b border-gray-200 dark:border-gray-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between gap-2'
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

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-600" />}
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-250 transition-colors"
            title={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {isSidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>

      <nav className={`flex-1 overflow-y-auto space-y-1 font-sans ${isSidebarCollapsed ? 'p-2' : 'p-3'}`}>
        {/* Módulos Principales Superiores */}
        {topNavItems.map(
          (item) =>
            hasModule(item.module) && (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-lg font-medium transition-all ${isSidebarCollapsed
                    ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850'
                    : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
                  } ${isSelected(item.path)
                    ? 'bg-amber-600 text-white font-semibold hover:bg-amber-600 dark:hover:bg-amber-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
              >
                <item.icon size={isSidebarCollapsed ? 20 : 16} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </button>
            )
        )}

        {/* Agrupador: Operación Administrativa */}
        {hasAnyOpAdminModule && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsOpAdminOpen(!isOpAdminOpen)}
              title={isSidebarCollapsed ? 'Operación Administrativa' : undefined}
              className={`w-full flex items-center justify-between rounded-lg font-medium transition-all ${isSidebarCollapsed
                  ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850'
                  : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
                } ${isSubItemActive
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              <div className="flex items-center gap-3">
                <FolderKanban size={isSidebarCollapsed ? 20 : 16} className="text-amber-500 shrink-0" />
                {!isSidebarCollapsed && <span className="font-extrabold text-xs tracking-tight">Operación Administrativa</span>}
              </div>
              {!isSidebarCollapsed && (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 text-gray-400 ${isOpAdminOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                />
              )}
            </button>

            {/* Submódulos de Operación Administrativa */}
            {(isOpAdminOpen || isSidebarCollapsed) && (
              <div className={isSidebarCollapsed ? 'space-y-1 mt-1' : 'ml-4 pl-2 border-l border-gray-200 dark:border-gray-800 space-y-1 mt-1'}>
                {adminOpSubItems.map(
                  (subItem) =>
                    hasModule(subItem.module) && (
                      <button
                        key={subItem.path}
                        onClick={() => router.push(subItem.path)}
                        title={isSidebarCollapsed ? subItem.label : undefined}
                        className={`w-full flex items-center rounded-lg font-medium transition-all ${isSidebarCollapsed
                            ? 'justify-center p-2 hover:bg-gray-100 dark:hover:bg-gray-850'
                            : 'gap-2.5 px-2.5 py-2 text-xs text-left hover:bg-gray-100 dark:hover:bg-gray-800'
                          } ${isSelected(subItem.path)
                            ? 'bg-amber-600 text-white font-bold hover:bg-amber-600 dark:hover:bg-amber-600 shadow-xs'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                          }`}
                      >
                        <subItem.icon size={isSidebarCollapsed ? 18 : 14} className="shrink-0" />
                        {!isSidebarCollapsed && <span className="leading-tight">{subItem.label}</span>}
                      </button>
                    )
                )}
              </div>
            )}
          </div>
        )}

        {/* Módulos Principales Inferiores */}
        {bottomNavItems.map(
          (item) =>
            hasModule(item.module) && (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                title={isSidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-lg font-medium transition-all ${isSidebarCollapsed
                    ? 'justify-center p-2.5 hover:bg-gray-100 dark:hover:bg-gray-850'
                    : 'gap-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800'
                  } ${isSelected(item.path)
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
          className={`mt-auto border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex items-center font-sans ${isSidebarCollapsed ? 'justify-center p-3' : 'justify-between p-4 gap-3'
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
