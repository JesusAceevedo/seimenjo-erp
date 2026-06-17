'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { 
  Plus, Users, Sun, Moon, Eye, ChevronLeft, ChevronRight, FileText, Save, X, Receipt, Search,
  TrendingUp, TrendingDown, Scale, CreditCard, Calendar, Filter
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface Proveedor {
  id: string;
  nombre_comercial: string;
  rfc?: string | null;
}

interface CategoriaGasto {
  id: string;
  nombre: string;
}

interface FormaPago {
  id: string;
  nombre: string;
}

interface Gasto {
  id: string;
  fecha_gasto: string;
  proveedores?: Proveedor | null;
  categorias_gasto?: CategoriaGasto | null;
  concepto?: string | null;
  metodo_pago?: string | null;
  monto: number;
}

export default function AdminGastos() {
  const router = useRouter();

  // Helper de Formato Contable
  const formatCurrency = (val: string | number) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(num);
  };

  // Estados de Datos
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [conceptosDisponibles, setConceptosDisponibles] = useState<string[]>([]);
  
  // Estados de UI y Filtros
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [formasPagoList, setFormasPagoList] = useState<FormaPago[]>([]);
  const [busquedaGasto, setBusquedaGasto] = useState('');

  // Calcular pageSize dinámicamente según la altura del viewport para evitar scroll principal
  useEffect(() => {
    const calcularPageSize = () => {
      const vh = window.innerHeight;
      // Para Egresos: padding (64px) + header (60px) + KPIs (120px) + filtros (80px) + cabeceras/márgenes (120px) = 444px
      const espacioDisponible = vh - 440;
      const alturaFila = 56; // Fila de gasto mide aprox 56px de alto
      const filasQueCaben = Math.floor(espacioDisponible / alturaFila);
      setPageSize(Math.max(3, filasQueCaben));
    };

    calcularPageSize();
    window.addEventListener('resize', calcularPageSize);
    return () => window.removeEventListener('resize', calcularPageSize);
  }, []);
  
  // Filtros de fecha y método de pago
  const [filtroRango, setFiltroRango] = useState<string>('todo');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');
  const [filtroMetodoPago, setFiltroMetodoPago] = useState<string>('');
  const [totalVentasPeriodo, setTotalVentasPeriodo] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Estados del Modal Manual
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nuevoProveedorNombre, setNuevoProveedorNombre] = useState('');
  const [nuevoProveedorRfc, setNuevoProveedorRfc] = useState('');
  const [isConceptoOtro, setIsConceptoOtro] = useState(false);
  const [nuevoGasto, setNuevoGasto] = useState({
    fecha_gasto: new Date().toISOString().split('T')[0],
    proveedor_id: '',
    categoria_id: '',
    concepto: '',
    monto: '',
    metodo_pago: 'Efectivo'
  });

  // --- CONSULTAS A BASE DE DATOS ---
  const fetchPeriodData = useCallback(async () => {
    setIsLoading(true);
    try {
      let startDateStr: string | null = null;
      let endDateStr: string | null = null;

      const hoy = new Date();
      if (filtroRango === 'semana') {
        const haceUnaSemana = new Date();
        haceUnaSemana.setDate(hoy.getDate() - 7);
        startDateStr = haceUnaSemana.toISOString().split('T')[0];
      } else if (filtroRango === 'mes') {
        const haceUnMes = new Date();
        haceUnMes.setMonth(hoy.getMonth() - 1);
        startDateStr = haceUnMes.toISOString().split('T')[0];
      } else if (filtroRango === 'rango' && fechaInicio) {
        startDateStr = fechaInicio;
        if (fechaFin) {
          endDateStr = fechaFin;
        }
      }

      // 1. Consultar ventas del período
      let salesQuery = supabase
        .from('pedidos')
        .select('precio_total, created_at, estatus_pago');

      // Si no se aplica filtro (rango todo), solo consideramos el mes en curso para los ingresos
      let salesStartDateStr = startDateStr;
      if (filtroRango === 'todo') {
        const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        salesStartDateStr = inicioMes.toISOString().split('T')[0];
      }

      if (salesStartDateStr) {
        salesQuery = salesQuery.gte('created_at', `${salesStartDateStr}T00:00:00.000Z`);
      }
      if (endDateStr) {
        salesQuery = salesQuery.lte('created_at', `${endDateStr}T23:59:59.999Z`);
      }

      const { data: salesData, error: salesError } = await salesQuery;
      if (salesError) throw salesError;

      const totalSales = (salesData || [])
        .filter(p => p.estatus_pago !== 'Cancelado')
        .reduce((sum, p) => sum + Number(p.precio_total || 0), 0);
      setTotalVentasPeriodo(totalSales);

      // 2. Consultar egresos del período
      let gastosQuery = supabase
        .from('gastos')
        .select(`*, proveedores(nombre_comercial, rfc), categorias_gasto(nombre)`)
        .is('gasto_padre_id', null)
        .order('fecha_gasto', { ascending: false });

      if (startDateStr) {
        gastosQuery = gastosQuery.gte('fecha_gasto', startDateStr);
      }
      if (endDateStr) {
        gastosQuery = gastosQuery.lte('fecha_gasto', endDateStr);
      }

      const { data: gastosData, error: gastosError } = await gastosQuery;
      if (gastosError) throw gastosError;

      setGastos((gastosData || []) as Gasto[]);
      setPage(0); // Reiniciar a la primera página al cambiar filtros
    } catch (err) {
      console.error("Error al cargar datos del período:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filtroRango, fechaInicio, fechaFin]);

  const fetchCatalogos = async () => {
    const [cats, provs, formas] = await Promise.all([
      supabase.from('categorias_gasto').select('*').order('nombre'),
      supabase.from('proveedores').select('*').order('nombre_comercial'),
      supabase.from('formas_pago').select('*').order('nombre', { ascending: true })
    ]);
    
    if (cats.error) console.error("Error cargando categorías:", cats.error);
    if (provs.error) console.error("Error cargando proveedores:", provs.error);

    if (cats.data) setCategorias(cats.data);
    if (provs.data) setProveedores(provs.data);
    if (formas.data) setFormasPagoList(formas.data);
  };

  const cargarConceptosPorCategoria = async (categoriaId: string) => {
    if (!categoriaId) {
      setConceptosDisponibles([]);
      return;
    }
    const { data, error } = await supabase
      .from('conceptos_permitidos')
      .select('concepto_nombre')
      .eq('categoria_id', categoriaId);

    if (error) {
      console.error("Error al cargar conceptos:", error);
    } else if (data) {
      setConceptosDisponibles(data.map(item => item.concepto_nombre));
    }
  };

  // Carga inicial y autenticación
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/admin/login');
      fetchCatalogos();
    };
    init();
  }, [router]);

  // Cargar datos al cambiar filtros
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPeriodData();
  }, [fetchPeriodData]);

  // Métricas de Gastos
  const kpiGastos = useMemo(() => {
    let total = 0;
    const breakdown: Record<string, number> = {};

    // Determinar rango para el KPI
    let kpiStartDate: Date | null = null;
    let kpiEndDate: Date | null = null;

    const hoy = new Date();
    if (filtroRango === 'todo') {
      kpiStartDate = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else if (filtroRango === 'semana') {
      const haceUnaSemana = new Date();
      haceUnaSemana.setDate(hoy.getDate() - 7);
      haceUnaSemana.setHours(0, 0, 0, 0);
      kpiStartDate = haceUnaSemana;
    } else if (filtroRango === 'mes') {
      const haceUnMes = new Date();
      haceUnMes.setMonth(hoy.getMonth() - 1);
      haceUnMes.setHours(0, 0, 0, 0);
      kpiStartDate = haceUnMes;
    } else if (filtroRango === 'rango' && fechaInicio) {
      kpiStartDate = new Date(fechaInicio + 'T00:00:00');
      if (fechaFin) {
        kpiEndDate = new Date(fechaFin + 'T23:59:59');
      }
    }

    gastos.forEach(g => {
      if (g.fecha_gasto) {
        const fechaG = new Date(g.fecha_gasto + 'T00:00:00');
        // Validar si entra en el rango del KPI
        if (kpiStartDate && fechaG < kpiStartDate) return;
        if (kpiEndDate && fechaG > kpiEndDate) return;
      }

      const monto = Number(g.monto || 0);
      total += monto;
      const metodo = g.metodo_pago || 'Efectivo';
      breakdown[metodo] = (breakdown[metodo] || 0) + monto;
    });

    const balance = totalVentasPeriodo - total;

    return { total, breakdown, balance };
  }, [gastos, totalVentasPeriodo, filtroRango, fechaInicio, fechaFin]);

  // Gastos filtrados por método de pago y búsqueda
  const gastosFiltrados = useMemo(() => {
    let filtrados = [...gastos];

    if (filtroMetodoPago) {
      filtrados = filtrados.filter(g => g.metodo_pago === filtroMetodoPago);
    }

    if (busquedaGasto.trim()) {
      const term = busquedaGasto.toLowerCase().trim();
      filtrados = filtrados.filter(g => {
        const concepto = (g.concepto || '').toLowerCase();
        const proveedor = (g.proveedores?.nombre_comercial || '').toLowerCase();
        const proveedorRfc = (g.proveedores?.rfc || '').toLowerCase();
        const categoria = (g.categorias_gasto?.nombre || '').toLowerCase();
        return concepto.includes(term) || proveedor.includes(term) || proveedorRfc.includes(term) || categoria.includes(term);
      });
    }

    return filtrados;
  }, [gastos, filtroMetodoPago, busquedaGasto]);

  // Paginación en memoria
  const paginatedGastos = useMemo(() => {
    const from = page * pageSize;
    const to = from + pageSize;
    return gastosFiltrados.slice(from, to);
  }, [gastosFiltrados, page, pageSize]);

  // --- LÓGICA DE GUARDADO MANUAL ---
  const handleGuardarGasto = async () => {
    if (!nuevoGasto.concepto || !nuevoGasto.monto || !nuevoGasto.categoria_id) {
      alert("Por favor llena los campos obligatorios (Concepto, Monto y Categoría).");
      return;
    }

    let proveedorFinalId = nuevoGasto.proveedor_id;

    // Si es un proveedor nuevo, crearlo en la tabla proveedores
    if (proveedorFinalId === 'nuevo' && nuevoProveedorNombre.trim() !== '') {
      const insertData: Partial<Proveedor> = { nombre_comercial: nuevoProveedorNombre.trim() };
      if (nuevoProveedorRfc.trim()) {
        insertData.rfc = nuevoProveedorRfc.trim().toUpperCase();
      }
      const { data: newProv, error: provError } = await supabase
        .from('proveedores')
        .insert([insertData])
        .select('id')
        .single();
        
      if (!provError && newProv) {
        proveedorFinalId = newProv.id;
      } else {
        proveedorFinalId = '';
      }
    }

    // Insertar el gasto en la BD
    const { error } = await supabase.from('gastos').insert([{
      fecha_gasto: nuevoGasto.fecha_gasto,
      proveedor_id: proveedorFinalId && proveedorFinalId !== 'nuevo' ? proveedorFinalId : null,
      categoria_id: nuevoGasto.categoria_id,
      concepto: nuevoGasto.concepto,
      monto: Number(nuevoGasto.monto),
      metodo_pago: nuevoGasto.metodo_pago
      // NOTA: Se ha omitido 'registrado_por' temporalmente para evitar el error de foreign key
      // registrado_por: (await supabase.auth.getUser()).data.user?.id 
    }]);

    if (!error) {
      setIsModalOpen(false);
      setNuevoProveedorNombre('');
      setNuevoProveedorRfc('');
      setIsConceptoOtro(false);
      setConceptosDisponibles([]);
      setNuevoGasto({
        fecha_gasto: new Date().toISOString().split('T')[0],
        proveedor_id: '', categoria_id: '', concepto: '', monto: '', metodo_pago: 'Efectivo'
      });
      fetchPeriodData();
      fetchCatalogos();
    } else {
      // Ahora si hay un error, el sistema te lo notificará claramente en pantalla
      alert(`Error de Base de Datos: ${error.message} \n\nDetalles: ${error.details || 'Revisa la consola'}`);
      console.error("Detalle completo del error Supabase:", error);
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex overflow-hidden">

        {/* ÁREA PRINCIPAL */}
        <main className="flex-1 flex flex-col p-8 w-full max-w-[100vw] md:max-w-[calc(100vw-16rem)] mx-auto overflow-hidden h-full">

          {/* HEADER */}
          <div className="mb-6 flex justify-between items-start md:items-center flex-col md:flex-row gap-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="text-blue-500" /> Registro de Egresos
            </h2>
            <div className="flex items-center gap-3">
              <button onClick={toggleDarkMode} className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-semibold shadow-lg transition-colors"
              >
                <Plus size={18} /> Registrar Gasto Manual
              </button>
            </div>
          </div>

          {/* DASHBOARD KPIS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 font-sans">
            {/* Ventas */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all">
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl animate-pulse">
                <TrendingUp size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Total Ventas (Ingresos)</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white block truncate">
                  {isLoading ? '...' : formatCurrency(totalVentasPeriodo)}
                </span>
              </div>
            </div>

            {/* Gastos */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                <TrendingDown size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Total Gastos (Egresos)</span>
                <span className="text-2xl font-black text-gray-900 dark:text-white block truncate">
                  {isLoading ? '...' : formatCurrency(kpiGastos.total)}
                </span>
              </div>
            </div>

            {/* Balance Neto */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex items-center gap-4 hover:border-blue-500/30 transition-all">
              <div className={`p-3 rounded-xl ${kpiGastos.balance >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                <Scale size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider block">Balance Neto</span>
                <span className={`text-2xl font-black block truncate ${kpiGastos.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {isLoading ? '...' : formatCurrency(kpiGastos.balance)}
                </span>
              </div>
            </div>

            {/* Desglose por Método de Pago */}
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-5 rounded-2xl shadow-lg flex flex-col justify-between hover:border-blue-500/30 transition-all min-h-[110px]">
              <div className="flex items-center gap-2 border-b border-gray-150 dark:border-gray-850 pb-1.5 mb-1.5">
                <CreditCard size={16} className="text-blue-500" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Egresos por Método</span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[70px] space-y-1 pr-1 font-mono text-[10px]">
                {isLoading ? (
                  <div className="text-gray-400 italic">Cargando...</div>
                ) : Object.entries(kpiGastos.breakdown).length > 0 ? (
                  Object.entries(kpiGastos.breakdown).map(([metodo, monto]) => (
                    <div key={metodo} className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                      <span className="truncate max-w-[100px]">{metodo}:</span>
                      <span className="font-bold">{formatCurrency(monto)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 italic">Sin egresos en el período</div>
                )}
              </div>
            </div>
          </div>

          {/* BUSCADOR Y FILTROS DE EGRESOS */}
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-4 rounded-xl shadow-md mb-6 flex gap-4 items-center flex-wrap font-sans">
            {/* Filtro Rango de Fechas */}
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-400" />
              <select 
                value={filtroRango}
                onChange={(e) => setFiltroRango(e.target.value)}
                className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 outline-none text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="todo">Todos los egresos</option>
                <option value="semana">Última semana</option>
                <option value="mes">Último mes</option>
                <option value="rango">Rango personalizado</option>
              </select>
            </div>

            {/* Inputs de Rango Personalizado */}
            {filtroRango === 'rango' && (
              <div className="flex gap-2 items-center animate-in fade-in duration-200">
                <input 
                  type="date" 
                  value={fechaInicio}
                  onChange={e => setFechaInicio(e.target.value)}
                  style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                  className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:border-blue-500 outline-none focus:ring-1 focus:ring-blue-500" 
                />
                <span className="text-xs text-gray-400 font-bold">a</span>
                <input 
                  type="date" 
                  value={fechaFin}
                  onChange={e => setFechaFin(e.target.value)}
                  style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                  className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:border-blue-500 outline-none focus:ring-1 focus:ring-blue-500" 
                />
              </div>
            )}

            {/* Filtro de Método de Pago */}
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <select 
                value={filtroMetodoPago}
                onChange={(e) => setFiltroMetodoPago(e.target.value)}
                className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 outline-none text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos los métodos</option>
                {formasPagoList.map(f => (
                  <option key={f.id} value={f.nombre}>{f.nombre}</option>
                ))}
              </select>
            </div>

            {/* Buscador de Texto */}
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar gastos por concepto, proveedor, RFC o categoría..."
                value={busquedaGasto}
                onChange={e => setBusquedaGasto(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
          </div>

          {/* TABLA PRINCIPAL DE GASTOS */}
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl flex flex-col flex-1 overflow-hidden">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Proveedor / Local</th>
                    <th className="p-4">Concepto / Categoría</th>
                    <th className="p-4 text-center">Método</th>
                    <th className="p-4 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
                  {paginatedGastos.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-4 font-mono text-gray-600 dark:text-gray-300">
                        {new Date(g.fecha_gasto).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{g.proveedores?.nombre_comercial || 'Gasto Sin Proveedor'}</div>
                        <div className="font-mono text-[10px] text-gray-500">{g.proveedores?.rfc || 'Sin RFC'}</div>
                      </td>
                      <td className="p-4 space-y-1">
                        <div className="font-medium text-sm">{g.concepto || 'Sin descripción'}</div>
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                          {g.categorias_gasto?.nombre || 'Sin Categoría'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-600 dark:text-gray-400">
                          {g.metodo_pago || 'Efectivo'}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-sm text-red-600 dark:text-red-400">
                        - {formatCurrency(g.monto)}
                      </td>
                    </tr>
                  ))}
                  {gastosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                        {isLoading ? 'Cargando egresos...' : gastos.length === 0 ? 'No hay gastos registrados en este período.' : 'Ningún gasto coincide con los filtros aplicados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <button 
                disabled={page === 0} 
                onClick={() => setPage(page - 1)} 
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                <ChevronLeft size={16} /> Anterior
              </button>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Página {page + 1} de {Math.max(1, Math.ceil(gastosFiltrados.length / pageSize))}
              </span>
              <button 
                disabled={(page + 1) * pageSize >= gastosFiltrados.length} 
                onClick={() => setPage(page + 1)} 
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                Siguiente <ChevronRight size={16} />
              </button>
            </div>
          </div>

        </main>

        {/* MODAL DE CAPTURA MANUAL */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-extrabold flex items-center gap-2 text-gray-900 dark:text-white">
                  <Receipt className="text-blue-500"/> Captura de Gasto
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Fecha */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Fecha del Gasto</label>
                    <input 
                      type="date" 
                      value={nuevoGasto.fecha_gasto}
                      style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" 
                      onChange={e => setNuevoGasto({...nuevoGasto, fecha_gasto: e.target.value})} 
                    />
                  </div>
                  {/* Categoría */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Categoría (Obligatorio)</label>
                    <select 
                      value={nuevoGasto.categoria_id}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" 
                      onChange={e => {
                        const id = e.target.value;
                        setNuevoGasto({...nuevoGasto, categoria_id: id, concepto: ''});
                        setIsConceptoOtro(false);
                        cargarConceptosPorCategoria(id);
                      }}
                    >
                      <option value="">Selecciona la clasificación...</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                </div>

                {/* Proveedor / Origen */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">¿Dónde se compró? (Proveedor)</label>
                  <select 
                    value={nuevoGasto.proveedor_id}
                    className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white mb-3" 
                    onChange={e => setNuevoGasto({...nuevoGasto, proveedor_id: e.target.value})}
                  >
                    <option value="">Seleccionar proveedor registrado...</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                    <option value="nuevo" className="font-bold text-blue-500">+ Registrar Nuevo Proveedor Rápido</option>
                  </select>

                  {/* Input condicional para proveedor nuevo */}
                  {nuevoGasto.proveedor_id === 'nuevo' && (
                    <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-2 font-sans">
                      <input 
                        type="text" 
                        placeholder="Nombre comercial del proveedor (ej. Mercado Libre)..." 
                        value={nuevoProveedorNombre}
                        className="w-full border-b-2 border-blue-500 bg-transparent p-2 text-sm text-gray-900 dark:text-white focus:outline-none" 
                        onChange={e => setNuevoProveedorNombre(e.target.value)} 
                      />
                      <input 
                        type="text" 
                        placeholder="RFC (Opcional, ej. XAXX010101000)..." 
                        value={nuevoProveedorRfc}
                        maxLength={13}
                        className="w-full border-b border-gray-300 dark:border-gray-700 bg-transparent p-2 text-xs text-gray-900 dark:text-white uppercase focus:outline-none focus:border-blue-500" 
                        onChange={e => setNuevoProveedorRfc(e.target.value)} 
                      />
                    </div>
                  )}
                </div>

                {/* Concepto y Monto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">¿Qué se compró? (Concepto)</label>
                    <select 
                      value={isConceptoOtro ? 'OTRO' : nuevoGasto.concepto}
                      disabled={!nuevoGasto.categoria_id}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white disabled:opacity-50" 
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'OTRO') {
                          setIsConceptoOtro(true);
                          setNuevoGasto({...nuevoGasto, concepto: ''});
                        } else {
                          setIsConceptoOtro(false);
                          setNuevoGasto({...nuevoGasto, concepto: val});
                        }
                      }}
                    >
                      <option value="">
                        {nuevoGasto.categoria_id ? "Selecciona un concepto..." : "Primero selecciona una categoría arriba"}
                      </option>
                      {conceptosDisponibles.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      {nuevoGasto.categoria_id && <option value="OTRO">Otro (especificar...)</option>}
                    </select>

                    {/* Campo de texto libre alternativo si seleccionan OTRO */}
                    {isConceptoOtro && (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                        <input 
                          type="text" 
                          placeholder="Escribe el concepto específico aquí..." 
                          value={nuevoGasto.concepto}
                          className="w-full bg-white dark:bg-gray-950 border border-blue-500 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none" 
                          onChange={e => setNuevoGasto({...nuevoGasto, concepto: e.target.value})} 
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Pagado ($)</label>
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      value={nuevoGasto.monto}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white font-bold text-red-500" 
                      onChange={e => setNuevoGasto({...nuevoGasto, monto: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Método de Pago</label>
                    <select 
                      value={nuevoGasto.metodo_pago}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" 
                      onChange={e => setNuevoGasto({...nuevoGasto, metodo_pago: e.target.value})}
                    >
                      <option value="">Seleccionar método...</option>
                      {formasPagoList.map(f => (
                        <option key={f.id} value={f.nombre}>{f.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleGuardarGasto} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2">
                  <Save size={18}/> Guardar Gasto
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
