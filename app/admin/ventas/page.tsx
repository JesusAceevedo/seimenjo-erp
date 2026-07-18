'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/no-unescaped-entities */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { useThemeMode } from '../../../lib/useThemeMode';
import { useSessionToken } from '../../../lib/hooks/useSessionToken';
import { useEmpresaId } from '../../../lib/hooks/useEmpresaId';
import {
  obtenerSignedUrl,
  enviarFacturaPorCorreo,
  eliminarPedidoSano
} from '../gastos/actions';
import { EditVentaModal } from '../gastos/_components/EditModals';
import {
  RefreshCw, CheckCircle, AlertTriangle, Layers, Sun, Moon, X
} from 'lucide-react';
import IngresosTab from '../gastos/_components/IngresosTab';
import CfdiViewerModal from '../gastos/_components/CfdiViewerModal';

export const dynamic = 'force-dynamic';

export default function VentasFacturadasModule() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode } = useThemeMode();

  const getSessionToken = useSessionToken();
  const getEmpresaId = useEmpresaId();

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [cfdiViewerUrl, setCfdiViewerUrl] = useState<string | null>(null);

  // Estados de datos
  const [ventasFacturadas, setVentasFacturadas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [editingVenta, setEditingVenta] = useState<any>(null);
  const [facturacionAcumuladaModal, setFacturacionAcumuladaModal] = useState({ open: false });

  useEffect(() => {
    if (message && message.type !== 'info') {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const empresaId = await getEmpresaId();
      if (!empresaId) return;

      // 1. Todas las Ventas (Facturadas y no Facturadas)
      const { data: vAll } = await supabase
        .from('pedidos')
        .select('*, clientes(nombre_local, rfc, email_facturacion), facturas_clientes(*)')
        .eq('empresa_id', empresaId)
        .neq('estatus_pago', 'Cancelado')
        .order('created_at', { ascending: false });
      setVentasFacturadas(vAll || []);

      // 2. Clientes para facturación acumulada
      const { data: cliData } = await supabase
        .from('clientes')
        .select('id, nombre_local, rfc')
        .eq('empresa_id', empresaId)
        .order('nombre_local', { ascending: true });
      setClientes(cliData || []);
    } catch (err: any) {
      setMessage({ text: 'Error al cargar datos: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDownloadFile = async (url: string) => {
    try {
      const token = await getSessionToken();
      const res = await obtenerSignedUrl(url, token);
      if (res.success && res.url) {
        window.open(res.url, '_blank');
      } else {
        alert(`No se pudo descargar el archivo: ${res.error || 'error desconocido'}`);
      }
    } catch (err: any) {
      alert(`No se pudo descargar el archivo: ${err.message}`);
    }
  };

  const handleSendEmail = async (pedidoId: string) => {
    setMessage({ text: 'Enviando factura por correo...', type: 'info' });
    try {
      const token = await getSessionToken();
      const res = await enviarFacturaPorCorreo(pedidoId, token);
      if (res.success) {
        setMessage({ text: 'Factura enviada con éxito al correo del cliente.', type: 'success' });
      } else {
        alert(res.error || 'No se pudo realizar el envío del correo');
        setMessage(null);
      }
    } catch (err) {
      console.error(err);
      alert('Error en el servicio de envío de correos.');
      setMessage(null);
    }
  };

  const handleDeleteVenta = async (pedidoId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este pedido facturado y desvincular sus archivos?')) return;
    try {
      const token = await getSessionToken();
      const res = await eliminarPedidoSano(pedidoId, token);
      if (res.success) {
        setMessage({ text: 'Pedido eliminado con éxito.', type: 'success' });
        fetchData();
      } else {
        alert(`Error al eliminar pedido: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  return (
    <div className={`${isDarkMode ? 'dark' : ''} w-full h-full overflow-hidden flex flex-col`}>
      <div className="bg-gray-50 dark:bg-gray-900 h-full text-gray-900 dark:text-gray-100 transition-colors flex flex-col p-8 w-full max-w-[100vw] mx-auto overflow-hidden">
        
        {/* HEADER */}
        <div className="mb-8 flex justify-between items-start md:items-center flex-col md:flex-row gap-4 shrink-0">
          <div>
            <h2 className="text-3xl font-extrabold flex items-center gap-3">
              <Layers className="text-emerald-500 w-8 h-8" /> Ventas Facturadas
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-sans">
              Seguimiento de pedidos de venta, visualización de CFDI de facturas de clientes y control de ingresos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-650 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
              title="Refrescar datos"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-650 dark:text-blue-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>

        {/* FEEDBACK DE ESTADO */}
        {message && (
          <div className={`p-4 rounded-xl border mb-6 flex items-start justify-between gap-3 animate-in fade-in duration-300 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
              : message.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800/50'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
          }`}>
            <div className="flex items-start gap-3">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
              ) : message.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
              ) : (
                <RefreshCw className="w-5 h-5 mt-0.5 shrink-0 animate-spin" />
              )}
              <div className="text-sm font-medium">{message.text}</div>
            </div>
            {message.type !== 'info' && (
              <button
                onClick={() => setMessage(null)}
                className="text-gray-400 hover:text-gray-650 dark:hover:text-gray-300 transition-colors p-0.5 rounded-lg hover:bg-gray-150/50 dark:hover:bg-gray-800/50 shrink-0"
                title="Cerrar mensaje"
              >
                <X size={15} />
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 flex-1 overflow-hidden min-h-0">
          <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden h-full">
            {loading && ventasFacturadas.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 text-gray-400">
                <RefreshCw className="animate-spin mr-2" size={16} /> Cargando ventas...
              </div>
            ) : (
              <IngresosTab
                ventasFacturadas={ventasFacturadas}
                onOpenFacturacionAcumulada={() => setFacturacionAcumuladaModal({ open: true })}
                onDownloadFile={handleDownloadFile}
                onSendEmail={handleSendEmail}
                onViewCfdi={setCfdiViewerUrl}
                onDeleteVenta={handleDeleteVenta}
                onEditVenta={setEditingVenta}
                onRefresh={fetchData}
              />
            )}
          </div>
        </div>

        {/* MODAL DE EDICIÓN DE VENTA */}
        {editingVenta && (
          <EditVentaModal
            venta={editingVenta}
            onClose={() => setEditingVenta(null)}
            onSuccess={() => {
              setEditingVenta(null);
              fetchData();
            }}
          />
        )}

        {/* CFDI VIEWER */}
        {cfdiViewerUrl && (
          <CfdiViewerModal
            xmlUrl={cfdiViewerUrl}
            onClose={() => setCfdiViewerUrl(null)}
          />
        )}
      </div>
    </div>
  );
}
