'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Trash2, 
  RefreshCw, 
  Eye, 
  Calendar, 
  Building2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  FileText,
  Search
} from 'lucide-react';
import { 
  obtenerCargasEstadosCuenta, 
  obtenerMovimientosPorCarga, 
  eliminarCargaEstadoCuenta 
} from '../reconciliationActions';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';

interface CargasTabProps {
  token?: string;
  cuentasBancarias: Array<{ id: string; nombre: string; numero_cuenta?: string }>;
  onStartSustituirCarga: (carga: any) => void;
  onReloadMovimientos: () => void;
  onOpenUploadModal: () => void;
}

export function CargasTab({
  token,
  cuentasBancarias,
  onStartSustituirCarga,
  onReloadMovimientos,
  onOpenUploadModal
}: CargasTabProps) {
  const getSessionToken = useSessionToken();
  const [cargas, setCargas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para el modal de detalle de movimientos
  const [selectedCargaDetail, setSelectedCargaDetail] = useState<any | null>(null);
  const [cargaMovimientos, setCargaMovimientos] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Estado para modal de confirmación de eliminación
  const [cargaToDelete, setCargaToDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCargas = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const activeToken = token || await getSessionToken();
      const res = await obtenerCargasEstadosCuenta(activeToken);
      if (res.success && res.data) {
        setCargas(res.data);
      } else {
        setErrorMessage(res.error || 'Error al obtener el historial de cargas.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCargas();
  }, [token]);

  const handleOpenDetail = async (carga: any) => {
    setSelectedCargaDetail(carga);
    setLoadingDetail(true);
    try {
      const activeToken = token || await getSessionToken();
      const res = await obtenerMovimientosPorCarga(carga.id, activeToken);
      if (res.success && res.data) {
        setCargaMovimientos(res.data);
      } else {
        setCargaMovimientos([]);
      }
    } catch (err) {
      console.error('Error fetching detail movements:', err);
      setCargaMovimientos([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDeleteCarga = async () => {
    if (!cargaToDelete) return;
    setDeleting(true);
    try {
      const activeToken = token || await getSessionToken();
      const res = await eliminarCargaEstadoCuenta(cargaToDelete.id, activeToken);
      if (res.success) {
        setCargas(prev => prev.filter(c => c.id !== cargaToDelete.id));
        setCargaToDelete(null);
        onReloadMovimientos();
      } else {
        alert(res.error || 'Error al eliminar la carga.');
      }
    } catch (err: any) {
      alert('Error al procesar eliminación: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredCargas = cargas.filter(c => {
    const s = searchTerm.toLowerCase();
    const nombreMatch = (c.nombre_archivo || '').toLowerCase().includes(s);
    const cuentaMatch = (c.cuentas_bancarias?.nombre || '').toLowerCase().includes(s);
    const fechaMatch = (c.fecha_carga || '').includes(s);
    return nombreMatch || cuentaMatch || fechaMatch;
  });

  const totalRegistrosSum = cargas.reduce((acc, curr) => acc + (curr.total_registros || 0), 0);
  const totalDepositosSum = cargas.reduce((acc, curr) => acc + Number(curr.total_depositos || 0), 0);
  const totalRetirosSum = cargas.reduce((acc, curr) => acc + Number(curr.total_retiros || 0), 0);

  return (
    <div className="space-y-6 font-sans pb-12 overflow-y-auto">
      {/* Tarjetas de Métricas de Cargas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Cargas</span>
            <FileSpreadsheet className="text-amber-500" size={18} />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {cargas.length}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Archivos procesados</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Movimientos Importados</span>
            <FileText className="text-blue-500" size={18} />
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white">
            {totalRegistrosSum.toLocaleString()}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Registros bancarios en total</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Depósitos ($)</span>
            <ArrowDownLeft className="text-emerald-500" size={18} />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
            ${totalDepositosSum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Sumatoria de abonos cargados</p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Retiros ($)</span>
            <ArrowUpRight className="text-rose-500" size={18} />
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400">
            ${totalRetirosSum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Sumatoria de cargos cargados</p>
        </div>
      </div>

      {/* Acciones principales y Búsqueda */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por archivo, cuenta o fecha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 pl-9 pr-4 py-2 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={fetchCargas}
            title="Recargar historial"
            className="p-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors text-gray-600 dark:text-gray-300"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={onOpenUploadModal}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <FileSpreadsheet size={16} /> Nueva Carga de Estado de Cuenta
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle size={16} /> {errorMessage}
        </div>
      )}

      {/* Tabla de Historial de Cargas */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-800/60 uppercase font-bold text-[10px] text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="p-4">Archivo / Carga</th>
                <th className="p-4">Fecha de Carga</th>
                <th className="p-4">Cuenta Destino</th>
                <th className="p-4 text-center">Registros</th>
                <th className="p-4 text-right">Depósitos ($)</th>
                <th className="p-4 text-right">Retiros ($)</th>
                <th className="p-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">
                    <RefreshCw className="animate-spin inline-block mr-2" size={18} /> Cargando historial de cargas...
                  </td>
                </tr>
              ) : filteredCargas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-400">
                    <FileSpreadsheet size={32} className="mx-auto mb-2 opacity-40" />
                    No se encontraron cargas de estado de cuenta registraras.
                  </td>
                </tr>
              ) : (
                filteredCargas.map((carga) => (
                  <tr key={carga.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-600 dark:text-amber-400">
                          <FileSpreadsheet size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white max-w-[220px] truncate" title={carga.nombre_archivo}>
                            {carga.nombre_archivo}
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">ID: {carga.id.substring(0, 8)}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
                          <Calendar size={13} className="text-amber-500 shrink-0" />
                          <span>
                            {carga.fecha_carga 
                              ? (carga.fecha_carga.length === 10 || !carga.fecha_carga.includes('T')
                                  ? carga.fecha_carga 
                                  : new Date(carga.fecha_carga).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }))
                              : 'N/A'}
                          </span>
                        </div>
                        {carga.creado_en && (
                          <div className="text-[10px] text-gray-400 pl-4">
                            Cargado: {new Date(carga.creado_en).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        <Building2 size={12} className="text-gray-400" />
                        {carga.cuentas_bancarias?.nombre || 'General / Auto-enrutado'}
                      </span>
                    </td>

                    <td className="p-4 text-center whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                        {carga.total_registros || 0} movs.
                      </span>
                    </td>

                    <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      +${Number(carga.total_depositos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="p-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                      -${Number(carga.total_retiros || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>

                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(carga)}
                          title="Ver detalle de movimientos"
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          onClick={() => onStartSustituirCarga(carga)}
                          title="Sustituir / Actualizar carga con un nuevo archivo"
                          className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400 transition-colors"
                        >
                          <RefreshCw size={15} />
                        </button>

                        <button
                          onClick={() => setCargaToDelete(carga)}
                          title="Eliminar esta carga y sus registros"
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg text-rose-600 dark:text-rose-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE DETALLE DE MOVIMIENTOS */}
      {selectedCargaDetail && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-150 font-sans">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/50">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <FileSpreadsheet className="text-amber-500" size={18} />
                  Detalle de Carga: {selectedCargaDetail.nombre_archivo}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {(() => {
                    const docFechas = cargaMovimientos.map(m => m.fecha).filter(Boolean).sort();
                    const minF = docFechas[0];
                    const maxF = docFechas[docFechas.length - 1];
                    const label = minF ? (minF === maxF ? minF : `${minF} al ${maxF}`) : (selectedCargaDetail.fecha_carga ? selectedCargaDetail.fecha_carga.substring(0, 10) : 'N/A');
                    return (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                        <Calendar size={12} /> Fecha del Documento: {label}
                      </span>
                    );
                  })()}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    • Cargado el {new Date(selectedCargaDetail.creado_en || selectedCargaDetail.fecha_carga).toLocaleString('es-MX')} • {cargaMovimientos.length} movimientos
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCargaDetail(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {loadingDetail ? (
                <div className="py-12 text-center text-gray-400">
                  <RefreshCw className="animate-spin inline mr-2" size={18} /> Cargando detalle...
                </div>
              ) : cargaMovimientos.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No se encontraron movimientos activos para esta carga.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-800/80 uppercase font-bold text-[10px] text-gray-500">
                      <tr>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Concepto</th>
                        <th className="p-3">Referencia</th>
                        <th className="p-3 text-right">Monto ($)</th>
                        <th className="p-3">Estatus Conciliación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {cargaMovimientos.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                          <td className="p-3 whitespace-nowrap text-gray-700 dark:text-gray-300 font-mono">
                            {m.fecha}
                          </td>
                          <td className="p-3 font-medium text-gray-900 dark:text-white max-w-xs truncate" title={m.concepto}>
                            {m.concepto}
                          </td>
                          <td className="p-3 font-mono text-gray-500">
                            {m.referencia || '-'}
                          </td>
                          <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                            m.tipo_movimiento === 'Deposito' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {m.tipo_movimiento === 'Deposito' ? '+' : '-'}${Math.abs(Number(m.monto)).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span 
                              className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ 
                                backgroundColor: (m.estatus_conciliacion_bancaria?.color || '#9CA3AF') + '22',
                                color: m.estatus_conciliacion_bancaria?.color || '#9CA3AF'
                              }}
                            >
                              {m.estatus_conciliacion_bancaria?.nombre || 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex justify-end">
              <button
                onClick={() => setSelectedCargaDetail(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-xs rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE CARGA */}
      {cargaToDelete && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-150 font-sans">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6 text-gray-900 dark:text-gray-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-base font-extrabold text-gray-900 dark:text-white mb-2">
              ¿Eliminar Carga de Estado de Cuenta?
            </h3>

            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
              Estás a punto de eliminar la carga <strong className="text-amber-500">{cargaToDelete.nombre_archivo}</strong>. Esta acción eliminará los <strong>{cargaToDelete.total_registros} movimientos bancarios</strong> asociados a esta carga.
            </p>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 mb-6">
              ⚠️ Si algún movimiento de esta carga se encuentra conciliado con un gasto o pedido, la conciliación se liberará automáticamente.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCargaToDelete(null)}
                disabled={deleting}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleDeleteCarga}
                disabled={deleting}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="animate-spin" size={14} /> Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Confirmar Eliminación
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CargasTab;
