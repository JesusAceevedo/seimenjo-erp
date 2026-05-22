'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Soup, LayoutDashboard, Users, FileDown } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Esta función comprueba la ruta exacta o sub-ruta
  const isSelected = (path: string) => pathname === path || pathname.startsWith(path);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <aside className="w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
          <Soup className="text-amber-500 w-8 h-8" />
          <div>
            <h1 className="font-bold text-lg leading-tight">SEIMENJO</h1>
            <span className="text-xs text-gray-500">Administración</span>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {/* BOTÓN VENTAS */}
          <button
            onClick={() => router.push('/admin/monitor')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/monitor') ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
          >
            <LayoutDashboard size={18} /> Ventana 1: Ventas
          </button>

          {/* BOTÓN CLIENTES */}
          <button
            onClick={() => router.push('/admin/Clientes')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/Clientes') ? 'bg-amber-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
          >
            <Users size={18} /> Ventana 2: Clientes
          </button>
          {/* BOTÓN GASTOS */}
          <button
            onClick={() => router.push('/admin/egresos')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/egresos') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
          >
            <FileDown size={18} /> Ventana 3: Gastos
          </button>
          {/* BOTÓN GASTOS */}
          <button
            onClick={() => router.push('/admin/gastos')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isSelected('/admin/gastos') ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
          >
            <FileDown size={18} /> Ventana 4: Conciliación
          </button>
        </nav>
      </aside>

      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}