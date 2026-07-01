'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { useSessionToken } from '../../../lib/hooks/useSessionToken';
import { 
  Plus, Users, Sun, Moon, Eye, ChevronLeft, ChevronRight, FileText, Save, X, Receipt, Search,
  TrendingUp, TrendingDown, Scale, CreditCard, Calendar, Filter, Trash2, Pencil, Link as LinkIcon
} from 'lucide-react';
import { toggleMovimientoVisibilidad, conciliarGastoEfectivoAutomatico } from '../gastos/reconciliationActions';

export const dynamic = 'force-dynamic';

const SAT_FORMAS_PAGO = [
  { codigo: '01', nombre: 'Efectivo' },
  { codigo: '02', nombre: 'Cheque nominativo' },
  { codigo: '03', nombre: 'Transferencia electrónica' },
  { codigo: '04', nombre: 'Tarjeta de crédito' },
  { codigo: '05', nombre: 'Monedero electrónico' },
  { codigo: '06', nombre: 'Dinero electrónico' },
  { codigo: '08', nombre: 'Vales de despensa' },
  { codigo: '12', nombre: 'Dación en pago' },
  { codigo: '13', nombre: 'Pago por subrogación' },
  { codigo: '14', nombre: 'Pago por consignación' },
  { codigo: '15', nombre: 'Condonación' },
  { codigo: '17', nombre: 'Compensación' },
  { codigo: '23', nombre: 'Novación' },
  { codigo: '24', nombre: 'Confusión' },
  { codigo: '25', nombre: 'Remisión de deuda' },
  { codigo: '26', nombre: 'Prescripción o caducidad' },
  { codigo: '27', nombre: 'A satisfacción del acreedor' },
  { codigo: '28', nombre: 'Tarjeta de débito' },
  { codigo: '29', nombre: 'Tarjeta de servicios' },
  { codigo: '30', nombre: 'Aplicación de anticipos' },
  { codigo: '31', nombre: 'Intermediario pagos' },
  { codigo: '99', nombre: 'Por definir' }
];

function getMetodoPagoLabel(codigo?: string | null): string {
  if (!codigo) return 'Desconocido';
  const cleanCode = codigo.trim().padStart(2, '0');
  const found = SAT_FORMAS_PAGO.find(fp => fp.codigo === cleanCode);
  return found ? `${found.codigo} - ${found.nombre}` : `${cleanCode} - Otro`;
}

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
  codigo?: string | null;
}

interface Gasto {
  id: string;
  fecha_gasto: string;
  proveedores?: Proveedor | null;
  categorias_gasto?: CategoriaGasto | null;
  concepto?: string | null;
  metodo_pago?: string | null;
  monto: number;
  movimiento_bancario_id?: string | null;
  gasto_padre_id?: string | null;
  padre?: { concepto: string } | null;
}

export default function AdminGastos() {
  const router = useRouter();
  const getSessionToken = useSessionToken();

  const handleEliminarGastoDefinitivo = async (gasto: Gasto) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este gasto permanentemente?')) return;
    
    if (gasto.movimiento_bancario_id) {
      const token = await getSessionToken();
      const res = await toggleMovimientoVisibilidad(gasto.movimiento_bancario_id, 'egresos', false, token);
      if (res.success) {
        setGastos(prev => prev.filter(g => g.id !== gasto.id));
        fetchPeriodData();
      } else {
        alert(res.error || 'Error al eliminar el gasto conciliado.');
      }
    } else {
      const { error } = await supabase.from('gastos').delete().eq('id', gasto.id);
      if (!error) {
        setGastos(prev => prev.filter(g => g.id !== gasto.id));
        fetchPeriodData();
      } else {
        alert('Error al eliminar: ' + error.message);
      }
    }
  };

  const handleUpdateCategoria = async (gastoId: string, categoriaId: string | null) => {
    try {
      const { error } = await supabase.from('gastos').update({ categoria_id: categoriaId }).eq('id', gastoId);
      if (error) throw error;
      setGastos(prev => prev.map(g => g.id === gastoId ? { ...g, categorias_gasto: categorias.find(c => c.id === categoriaId) || null } : g));
    } catch (err: any) {
      alert(`Error al actualizar categoría: ${err.message}`);
    }
  };

  const handleUpdateMetodoPago = async (gastoId: string, metodo: string | null) => {
    try {
      const { error } = await supabase.from('gastos').update({ metodo_pago: metodo }).eq('id', gastoId);
      if (error) throw error;
      setGastos(prev => prev.map(g => g.id === gastoId ? { ...g, metodo_pago: metodo } : g));
    } catch (err: any) {
      alert(`Error al actualizar método de pago: ${err.message}`);
    }
  };

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
  // Estados de UI y Filtros
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [formasPagoList, setFormasPagoList] = useState<FormaPago[]>([]);
  const [busquedaGasto, setBusquedaGasto] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const [verTodosFiltro, setVerTodosFiltro] = useState(false);
  const [verTodosModal, setVerTodosModal] = useState(false);

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
  const [nuevoGasto, setNuevoGasto] = useState({
    id: '',
    fecha_gasto: new Date().toISOString().split('T')[0],
    proveedor_id: '',
    categoria_id: '',
    concepto: '',
    monto: '',
    metodo_pago: '01'
  });

  // Modal para asociar a gasto principal
  const [associationModal, setAssociationModal] = useState<{
    isOpen: boolean;
    childGasto: Gasto | null;
    searchParent: string;
    parentGastoId: string | null;
    loading: boolean;
  }>({
    isOpen: false,
    childGasto: null,
    searchParent: '',
    parentGastoId: null,
    loading: false
  });

  // Expansión de parcialidades (hijos)
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const toggleParentExpand = (id: string) => {
    setExpandedParents(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSaveAssociation = async () => {
    if (!associationModal.childGasto || !associationModal.parentGastoId) return;
    setAssociationModal(prev => ({ ...prev, loading: true }));
    try {
      const { error } = await supabase
        .from('gastos')
        .update({ gasto_padre_id: associationModal.parentGastoId })
        .eq('id', associationModal.childGasto.id);

      if (error) throw error;

      alert('Asociación realizada con éxito.');
      setAssociationModal({
        isOpen: false,
        childGasto: null,
        searchParent: '',
        parentGastoId: null,
        loading: false
      });
      fetchPeriodData();
    } catch (err: any) {
      alert(`Error al asociar gasto: ${err.message}`);
    } finally {
      setAssociationModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleRemoveAssociation = async () => {
    if (!associationModal.childGasto) return;
    if (!confirm('¿Estás seguro de desvincular esta parcialidad/complemento de su gasto principal?')) return;
    setAssociationModal(prev => ({ ...prev, loading: true }));
    try {
      const { error } = await supabase
        .from('gastos')
        .update({ gasto_padre_id: null })
        .eq('id', associationModal.childGasto.id);

      if (error) throw error;

      alert('Desvinculación realizada con éxito.');
      setAssociationModal({
        isOpen: false,
        childGasto: null,
        searchParent: '',
        parentGastoId: null,
        loading: false
      });
      fetchPeriodData();
    } catch (err: any) {
      alert(`Error al desasociar gasto: ${err.message}`);
    } finally {
      setAssociationModal(prev => ({ ...prev, loading: false }));
    }
  };

  const parentCandidates = useMemo(() => {
    if (!associationModal.childGasto) return [];
    const child = associationModal.childGasto;
    return gastos.filter(g => {
      // Excluir el mismo gasto
      if (g.id === child.id) return false;
      // Excluir si ya es hijo de otro
      if (g.gasto_padre_id) return false;
      
      // Aplicar filtro de búsqueda
      if (associationModal.searchParent) {
        const s = associationModal.searchParent.toLowerCase();
        const conceptoMatch = g.concepto?.toLowerCase().includes(s);
        const proveedoresMatch = g.proveedores?.nombre_comercial?.toLowerCase().includes(s);
        const rfcMatch = g.proveedores?.rfc?.toLowerCase().includes(s);
        const montoMatch = g.monto?.toString().includes(s);
        return conceptoMatch || proveedoresMatch || rfcMatch || montoMatch;
      }
      return true;
    }).slice(0, 15);
  }, [gastos, associationModal.childGasto, associationModal.searchParent]);

  // Mapa de hijos por id de padre
  const hijosMap = useMemo(() => {
    const map = new Map<string, Gasto[]>();
    gastos.forEach(g => {
      if (g.gasto_padre_id) {
        const list = map.get(g.gasto_padre_id) || [];
        list.push(g);
        map.set(g.gasto_padre_id, list);
      }
    });
    return map;
  }, [gastos]);

  // --- CONSULTAS A BASE DE DATOS ---
  const getEmpresaId = async () => {
    let empresaId = null;
    const sessionData = localStorage.getItem('seimenjo_session');
    if (sessionData) {
      try {
        const datosSesion = JSON.parse(sessionData);
        empresaId = datosSesion.empresa_id;
      } catch (e) {}
    }
    if (!empresaId) {
      const { data: { user } } = await supabase.auth.getUser();
      empresaId = user?.user_metadata?.empresa_id;
    }
    return empresaId;
  };

  const fetchPeriodData = useCallback(async () => {
    setIsLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) {
        setIsLoading(false);
        return;
      }

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
        .select('precio_total, created_at, estatus_pago')
        .eq('empresa_id', empresaId);

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
        .select(`*, proveedores(id, nombre_comercial, rfc), categorias_gasto(id, nombre), padre:gastos!gasto_padre_id(concepto)`)
        .eq('empresa_id', empresaId)
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
    const empresaId = await getEmpresaId();
    if (!empresaId) return;

    const [cats, provs, formas] = await Promise.all([
      supabase.from('categorias_gasto').select('*').or(`empresa_id.is.null,empresa_id.eq.${empresaId}`).order('nombre'),
      supabase.from('proveedores').select('*').or(`empresa_id.is.null,empresa_id.eq.${empresaId}`).order('nombre_comercial'),
      supabase.from('formas_pago').select('*').order('nombre', { ascending: true })
    ]);
    
    if (cats.error) console.error("Error cargando categorías:", cats.error);
    if (provs.error) console.error("Error cargando proveedores:", provs.error);

    if (cats.data) setCategorias(cats.data);
    if (provs.data) setProveedores(provs.data);
    if (formas.data) setFormasPagoList(formas.data);
  };

  // Carga inicial y autenticación
  useEffect(() => {
    const init = async () => {
      const token = await getSessionToken();
      if (!token) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryToken = await getSessionToken();
        if (!retryToken) return router.push('/admin/login');
      }
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
      if (g.gasto_padre_id) return;

      if (g.fecha_gasto) {
        const fechaG = new Date(g.fecha_gasto + 'T00:00:00');
        // Validar si entra en el rango del KPI
        if (kpiStartDate && fechaG < kpiStartDate) return;
        if (kpiEndDate && fechaG > kpiEndDate) return;
      }

      const monto = Number(g.monto || 0);
      total += monto;
      const metodo = g.metodo_pago || '99';
      const label = getMetodoPagoLabel(metodo);
      breakdown[label] = (breakdown[label] || 0) + monto;
    });

    const balance = totalVentasPeriodo - total;

    return { total, breakdown, balance };
  }, [gastos, totalVentasPeriodo, filtroRango, fechaInicio, fechaFin]);

  // Gastos filtrados por método de pago y búsqueda
  const gastosFiltrados = useMemo(() => {
    let filtrados = gastos.filter(g => !g.gasto_padre_id);

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
        return (
          concepto.includes(term) || 
          proveedor.includes(term) || 
          proveedorRfc.includes(term) || 
          categoria.includes(term) ||
          g.monto?.toString().includes(term)
        );
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

    const empresaId = await getEmpresaId();
    if (!empresaId) return alert('No se pudo identificar la empresa actual. Cierra sesión e inténtalo de nuevo.');

    // Insertar o actualizar el gasto en la BD
    if (nuevoGasto.id) {
      const { error } = await supabase.from('gastos').update({
        fecha_gasto: nuevoGasto.fecha_gasto,
        proveedor_id: proveedorFinalId && proveedorFinalId !== 'nuevo' ? proveedorFinalId : null,
        categoria_id: nuevoGasto.categoria_id || null,
        concepto: nuevoGasto.concepto,
        monto: Number(nuevoGasto.monto),
        metodo_pago: nuevoGasto.metodo_pago
      }).eq('id', nuevoGasto.id).eq('empresa_id', empresaId);

      if (!error) {
        setIsModalOpen(false);
        setNuevoProveedorNombre('');
        setNuevoProveedorRfc('');
        setNuevoGasto({
          id: '',
          fecha_gasto: new Date().toISOString().split('T')[0],
          proveedor_id: '', categoria_id: '', concepto: '', monto: '', metodo_pago: '01'
        });
        fetchPeriodData();
        fetchCatalogos();
      } else {
        alert(`Error al actualizar: ${error.message} \n\nDetalles: ${error.details || 'Revisa la consola'}`);
        console.error("Detalle completo del error Supabase:", error);
      }
    } else {
      const { data: newGasto, error } = await supabase.from('gastos').insert([{
        fecha_gasto: nuevoGasto.fecha_gasto,
        proveedor_id: proveedorFinalId && proveedorFinalId !== 'nuevo' ? proveedorFinalId : null,
        categoria_id: nuevoGasto.categoria_id || null,
        concepto: nuevoGasto.concepto,
        monto: Number(nuevoGasto.monto),
        metodo_pago: nuevoGasto.metodo_pago,
        empresa_id: empresaId
      }]).select('id').single();

      if (!error) {
        if (newGasto) {
          const token = await getSessionToken();
          await conciliarGastoEfectivoAutomatico(newGasto.id, token);
        }
        setIsModalOpen(false);
        setNuevoProveedorNombre('');
        setNuevoProveedorRfc('');
        setNuevoGasto({
          id: '',
          fecha_gasto: new Date().toISOString().split('T')[0],
          proveedor_id: '', categoria_id: '', concepto: '', monto: '', metodo_pago: '01'
        });
        fetchPeriodData();
        fetchCatalogos();
      } else {
        alert(`Error al registrar: ${error.message} \n\nDetalles: ${error.details || 'Revisa la consola'}`);
        console.error("Detalle completo del error Supabase:", error);
      }
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
                onClick={() => {
                  setNuevoGasto({
                    id: '',
                    fecha_gasto: new Date().toISOString().split('T')[0],
                    proveedor_id: '', categoria_id: '', concepto: '', monto: '', metodo_pago: '01'
                  });
                  setIsModalOpen(true);
                }} 
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
                onChange={(e) => {
                  if (e.target.value === 'VER_TODOS') {
                    setVerTodosFiltro(true);
                    return;
                  }
                  setFiltroMetodoPago(e.target.value);
                }}
                className="border border-gray-200 dark:border-gray-800 p-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-900 outline-none text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Todos los métodos</option>
                {formasPagoList.map(f => (
                  <option key={f.id} value={f.codigo || ''}>
                    {f.codigo ? `${f.codigo} - ${f.nombre}` : f.nombre}
                  </option>
                ))}
                {!verTodosFiltro && (
                  <option value="VER_TODOS">🔍 Mostrar todos los códigos SAT...</option>
                )}
                {verTodosFiltro && (
                  <>
                    <option disabled className="text-gray-400 font-bold border-t">--- Todos los Códigos SAT ---</option>
                    {SAT_FORMAS_PAGO.filter(sat => !formasPagoList.some(f => f.codigo === sat.codigo)).map(sat => (
                      <option key={sat.codigo} value={sat.codigo}>
                        {sat.codigo} - {sat.nombre}
                      </option>
                    ))}
                  </>
                )}
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
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50 text-xs">
                  {paginatedGastos.map((g) => {
                    const hijos = hijosMap.get(g.id) || [];
                    const hasHijos = hijos.length > 0;
                    const isExpanded = !!expandedParents[g.id];

                    return (
                      <React.Fragment key={g.id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                          <td className="p-4 font-mono text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-1.5">
                              {hasHijos && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleParentExpand(g.id);
                                  }}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-all text-gray-500 hover:text-indigo-600"
                                  title={isExpanded ? "Contraer parcialidades" : "Mostrar parcialidades"}
                                >
                                  <ChevronRight size={14} className={`transform transition-transform ${isExpanded ? 'rotate-90 text-indigo-500 font-bold' : 'text-gray-400'}`} />
                                </button>
                              )}
                              <span>
                                {new Date(g.fecha_gasto).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-sm text-gray-800 dark:text-gray-200">{g.proveedores?.nombre_comercial || 'Gasto Sin Proveedor'}</div>
                            <div className="font-mono text-[10px] text-gray-500">{g.proveedores?.rfc || 'Sin RFC'}</div>
                          </td>
                          <td className="p-4 space-y-1">
                            <div className="font-medium text-sm">{g.concepto || 'Sin descripción'}</div>
                            <div className="flex gap-1.5 flex-wrap items-center mt-1">
                              <select
                                value={g.categorias_gasto?.id || ''}
                                onChange={(e) => handleUpdateCategoria(g.id, e.target.value || null)}
                                className="text-[10px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 rounded outline-none py-0.5 px-1 cursor-pointer"
                              >
                                <option value="">Sin Categoría</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                              </select>
                              {g.movimiento_bancario_id && (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-450 border border-amber-200 dark:border-amber-800/50">
                                  Banco
                                </span>
                              )}
                              {hasHijos && (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-750 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                                  {hijos.length} {hijos.length === 1 ? 'Parcialidad' : 'Parcialidades'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <select
                              value={g.metodo_pago || ''}
                              onChange={(e) => {
                                if (e.target.value === 'VER_TODOS') {
                                  setVerTodos(true);
                                  return;
                                }
                                handleUpdateMetodoPago(g.id, e.target.value || null);
                              }}
                              className="px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-md text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 text-xs outline-none cursor-pointer text-center"
                            >
                              <option value="">Desconocido</option>
                              {formasPagoList.map(f => (
                                <option key={f.id} value={f.codigo || ''}>
                                  {f.codigo ? `${f.codigo} - ${f.nombre}` : f.nombre}
                                </option>
                              ))}
                              {!verTodos && (
                                <option value="VER_TODOS">🔍 Mostrar todos...</option>
                              )}
                              {verTodos && (
                                <>
                                  <option disabled className="text-gray-400 font-bold border-t">--- Todos los Códigos SAT ---</option>
                                  {SAT_FORMAS_PAGO.filter(sat => !formasPagoList.some(f => f.codigo === sat.codigo)).map(sat => (
                                    <option key={sat.codigo} value={sat.codigo}>
                                      {sat.codigo} - {sat.nombre}
                                    </option>
                                  ))}
                                </>
                              )}
                            </select>
                          </td>
                          <td className="p-4 text-right font-bold text-sm text-red-600 dark:text-red-400">
                            - {formatCurrency(g.monto)}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center items-center gap-2">
                              <button
                                onClick={() => setAssociationModal({
                                  isOpen: true,
                                  childGasto: g,
                                  searchParent: '',
                                  parentGastoId: g.gasto_padre_id || null,
                                  loading: false
                                })}
                                title="Asociar a Gasto Principal / Parcialidad"
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded transition-colors"
                              >
                                <LinkIcon size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setNuevoGasto({
                                    id: g.id,
                                    fecha_gasto: g.fecha_gasto || new Date().toISOString().split('T')[0],
                                    proveedor_id: g.proveedores?.id || '',
                                    categoria_id: g.categorias_gasto?.id || '',
                                    concepto: g.concepto || '',
                                    monto: g.monto.toString(),
                                    metodo_pago: g.metodo_pago || '01'
                                  });
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors"
                                title="Editar gasto"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleEliminarGastoDefinitivo(g)}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                                title={g.movimiento_bancario_id ? "Eliminar gasto y desmarcar del banco" : "Eliminar gasto"}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Parcialidades/hijos anidados */}
                        {hasHijos && isExpanded && hijos.map(h => (
                          <tr key={h.id} className="bg-indigo-50/10 dark:bg-indigo-950/5 border-l-4 border-indigo-400 dark:border-indigo-600 transition-colors">
                            {/* Fecha */}
                            <td className="p-4 pl-8 font-mono text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {new Date(h.fecha_gasto).toLocaleDateString('es-MX', { timeZone: 'UTC' })}
                            </td>

                            {/* Proveedor */}
                            <td className="p-4 text-gray-550 dark:text-gray-450 font-bold">
                              {h.proveedores?.nombre_comercial || 'Gasto Sin Proveedor'}
                            </td>

                            {/* Concepto / Categoría */}
                            <td className="p-4 space-y-1">
                              <div className="font-medium text-gray-800 dark:text-gray-200">{h.concepto || 'Sin descripción'}</div>
                              <div className="flex gap-1.5 items-center mt-1">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-100/60 dark:bg-indigo-900/30 text-indigo-750 dark:text-indigo-400">
                                  Parcialidad / REP
                                </span>
                                <span className="text-[10px] text-gray-400 italic">
                                  Categoría: {categorias.find(c => c.id === h.categorias_gasto?.id)?.nombre || 'Sin clasificar'}
                                </span>
                              </div>
                            </td>

                            {/* Método de pago */}
                            <td className="p-4 text-center text-gray-600 dark:text-gray-400">
                              {getMetodoPagoLabel(h.metodo_pago)}
                            </td>

                            {/* Monto */}
                            <td className="p-4 text-right font-semibold text-gray-600 dark:text-gray-400 text-xs">
                              - {formatCurrency(h.monto)}
                            </td>

                            {/* Acciones del hijo */}
                            <td className="p-4 text-center">
                              <div className="flex justify-center items-center gap-2">
                                <button
                                  onClick={() => setAssociationModal({
                                    isOpen: true,
                                    childGasto: h,
                                    searchParent: '',
                                    parentGastoId: h.gasto_padre_id || null,
                                    loading: false
                                  })}
                                  title="Cambiar/Quitar Asociación"
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded transition-colors"
                                >
                                  <LinkIcon size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setNuevoGasto({
                                      id: h.id,
                                      fecha_gasto: h.fecha_gasto || new Date().toISOString().split('T')[0],
                                      proveedor_id: h.proveedores?.id || '',
                                      categoria_id: h.categorias_gasto?.id || '',
                                      concepto: h.concepto || '',
                                      monto: h.monto.toString(),
                                      metodo_pago: h.metodo_pago || '01'
                                    });
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors"
                                  title="Editar gasto parcial"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleEliminarGastoDefinitivo(h)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                                  title="Eliminar gasto parcial"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  {gastosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500 dark:text-gray-400">
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
                  <Receipt className="text-blue-500"/> {nuevoGasto.id ? 'Editar Gasto' : 'Captura de Gasto'}
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
                        setNuevoGasto({...nuevoGasto, categoria_id: id});
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
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Descripción del Gasto u Observaciones</label>
                    <input 
                      type="text" 
                      placeholder="Escribe la descripción o detalles del gasto..." 
                      value={nuevoGasto.concepto}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:border-blue-500" 
                      onChange={e => setNuevoGasto({...nuevoGasto, concepto: e.target.value})} 
                    />
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
                      value={nuevoGasto.metodo_pago || ''}
                      className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-lg text-sm text-gray-900 dark:text-white" 
                      onChange={(e) => {
                        if (e.target.value === 'VER_TODOS') {
                          setVerTodosModal(true);
                          return;
                        }
                        setNuevoGasto({...nuevoGasto, metodo_pago: e.target.value});
                      }}
                    >
                      <option value="">Seleccionar método...</option>
                      {formasPagoList.map(f => (
                        <option key={f.id} value={f.codigo || ''}>
                          {f.codigo ? `${f.codigo} - ${f.nombre}` : f.nombre}
                        </option>
                      ))}
                      {!verTodosModal && (
                        <option value="VER_TODOS">🔍 Mostrar todos los códigos SAT...</option>
                      )}
                      {verTodosModal && (
                        <>
                          <option disabled className="text-gray-400 font-bold border-t">--- Todos los Códigos SAT ---</option>
                          {SAT_FORMAS_PAGO.filter(sat => !formasPagoList.some(f => f.codigo === sat.codigo)).map(sat => (
                            <option key={sat.codigo} value={sat.codigo}>
                              {sat.codigo} - {sat.nombre}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleGuardarGasto} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2">
                  <Save size={18}/> {nuevoGasto.id ? 'Guardar Cambios' : 'Guardar Gasto'}
                </button>
              </div>

            </div>
          </div>
        )}

        {associationModal.isOpen && associationModal.childGasto && (
          <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
              
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-900 bg-white dark:bg-gray-955 sticky top-0 z-10">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                    <LinkIcon className="text-indigo-500" size={18} />
                    Asociar a Gasto Principal
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Establece este comprobante/REP como parcialidad de otra factura.
                  </p>
                </div>
                <button 
                  onClick={() => setAssociationModal({ isOpen: false, childGasto: null, searchParent: '', parentGastoId: null, loading: false })}
                  className="p-1.5 text-gray-400 hover:text-gray-605 dark:hover:text-gray-300 hover:bg-gray-105 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                
                {/* Información del Gasto Seleccionado */}
                <div className="p-3.5 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl space-y-2">
                  <span className="text-[10px] font-extrabold uppercase text-gray-400 dark:text-gray-550 tracking-wider block">Gasto Seleccionado (Hijo)</span>
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">{associationModal.childGasto.concepto}</h4>
                      <p className="text-[10px] text-gray-500 mt-1 font-semibold">{associationModal.childGasto.proveedores?.nombre_comercial} ({associationModal.childGasto.proveedores?.rfc || 'Sin RFC'})</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-red-500 dark:text-red-400 block">-{formatCurrency(associationModal.childGasto.monto)}</span>
                      <span className="text-[10px] text-gray-400 font-mono block mt-0.5">{new Date(associationModal.childGasto.fecha_gasto).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</span>
                    </div>
                  </div>
                </div>

                {/* Input de Búsqueda de Padre */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-gray-550 dark:text-gray-400 uppercase tracking-wider block">Buscar Factura Principal (Padre)</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                    <input
                      type="text"
                      placeholder="Filtrar por concepto, monto o proveedor..."
                      value={associationModal.searchParent}
                      onChange={(e) => setAssociationModal(prev => ({ ...prev, searchParent: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 pl-9 pr-3 py-2 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-semibold text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Lista de Candidatos */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-gray-550 dark:text-gray-400 uppercase tracking-wider block">Seleccionar del Listado</label>
                  <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                    {parentCandidates.map(p => {
                      const isSelected = associationModal.parentGastoId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setAssociationModal(prev => ({ ...prev, parentGastoId: p.id }))}
                          className={`p-3 text-xs flex justify-between items-center cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-l-2 border-indigo-500 font-bold' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-900/40'
                          }`}
                        >
                          <div className="space-y-0.5 max-w-[70%]">
                            <p className="text-gray-800 dark:text-gray-200 truncate">{p.concepto}</p>
                            <p className="text-[10px] text-gray-500 font-semibold">{p.proveedores?.nombre_comercial}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-gray-900 dark:text-white">-{formatCurrency(p.monto)}</p>
                            <p className="text-[10px] text-gray-400 font-mono">{new Date(p.fecha_gasto).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</p>
                          </div>
                        </div>
                      );
                    })}
                    {parentCandidates.length === 0 && (
                      <p className="p-4 text-center text-xs text-gray-400 italic bg-gray-50/50 dark:bg-gray-900/20">No se encontraron facturas candidatas</p>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-5 border-t border-gray-100 dark:border-gray-900 flex justify-between gap-3 bg-gray-50 dark:bg-gray-900/10">
                <div>
                  {associationModal.childGasto.gasto_padre_id && (
                    <button
                      type="button"
                      onClick={handleRemoveAssociation}
                      disabled={associationModal.loading}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-red-655 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                    >
                      Desvincular
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAssociationModal({ isOpen: false, childGasto: null, searchParent: '', parentGastoId: null, loading: false })}
                    disabled={associationModal.loading}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAssociation}
                    disabled={associationModal.loading || !associationModal.parentGastoId}
                    className="bg-indigo-650 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center bg-indigo-600"
                  >
                    {associationModal.loading ? 'Guardando...' : 'Confirmar Asociación'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
