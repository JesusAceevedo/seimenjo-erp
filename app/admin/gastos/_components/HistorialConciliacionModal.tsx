'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */

import React, { useState, useEffect } from 'react';
import {
  X, FileText, FileCode, AlertTriangle, CheckCircle2,
  Calendar, DollarSign, CreditCard, Download, Copy,
  Edit3, Save, RefreshCw, Check, Link as LinkIcon, Eye,
  Building2, Landmark, Tag, Layers, ArrowUpRight, ArrowDownLeft,
  Paperclip, ArrowRightLeft, ShieldAlert, Sparkles, UploadCloud,
  ChevronRight, Clock, HelpCircle, Receipt, ExternalLink, Plus
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useCfdiViewer } from '../../_components/CfdiViewerContext';
import {
  actualizarAuditoriaMovimientoAction,
  adjuntarArchivoDirectoAction
} from '../reconciliationActions';

interface HistorialConciliacionModalProps {
  open: boolean;
  onClose: () => void;
  movimiento: any | null;
  allMovimientos?: any[];
  onRefresh?: () => void;
  onDownloadFile: (url: string) => void;
  onOpenReconcileModal?: (m: any) => void;
  token?: string;
}

export default function HistorialConciliacionModal({
  open,
  onClose,
  movimiento,
  allMovimientos = [],
  onRefresh,
  onDownloadFile,
  onOpenReconcileModal,
  token
}: HistorialConciliacionModalProps) {
  const { openCfdi } = useCfdiViewer();

  const [comentarios, setComentarios] = useState('');
  const [isEditingComms, setIsEditingComms] = useState(false);
  const [savingComms, setSavingComms] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'detalle' | 'documentos' | 'auditoria'>('detalle');

  // Estados para carga directa de archivos
  const [uploadingFileType, setUploadingFileType] = useState<'xml' | 'pdf_factura' | 'pdf_ticket' | 'soporte_reembolso' | null>(null);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string | null>(null);

  // Estados para consulta dinámica de relaciones (Junction + Direct FK)
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [fetchedConciliaciones, setFetchedConciliaciones] = useState<any[]>([]);
  const [fetchedComprobantes, setFetchedComprobantes] = useState<any[]>([]);
  const [fetchedSiblingMovs, setFetchedSiblingMovs] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!movimiento || !open) return;

    setComentarios(movimiento.comentarios || '');
    setIsEditingComms(false);
    setUploadProgressMsg(null);
    setUploadingFileType(null);

    // Cargar lo que ya viene en memoria
    const initialConc = movimiento.conciliaciones_bancarias || [];
    const initialComp = movimiento.comprobantes_deposito_movimientos || [];
    setFetchedConciliaciones(initialConc);
    setFetchedComprobantes(initialComp);

    // Consulta exhaustiva en Supabase para obtener 100% de facturas vinculadas
    const loadFullDetails = async () => {
      setLoadingDetails(true);
      try {
        // 1. Consultar conciliaciones_bancarias por movimiento_id
        const { data: concData } = await supabase
          .from('conciliaciones_bancarias')
          .select(`
            id,
            monto_asociado,
            gasto:gastos(
              id,
              concepto,
              monto,
              subtotal,
              iva_acreditable,
              fecha_gasto,
              fecha_timbrado,
              uuid_fiscal,
              xml_url,
              pdf_url,
              ticket_url,
              metodo_pago,
              proveedores(id, nombre_comercial, rfc, saldo_favor)
            ),
            pedido:pedidos(
              id,
              numero_pedido,
              precio_total,
              cliente_nombre,
              fecha_pedido,
              metodo_pago,
              clientes(id, nombre_local, rfc),
              facturas_clientes(*)
            )
          `)
          .eq('movimiento_id', movimiento.id);

        // 2. Consultar gastos directos por movimiento_bancario_id
        const { data: directGastos } = await supabase
          .from('gastos')
          .select(`
            id,
            concepto,
            monto,
            subtotal,
            iva_acreditable,
            fecha_gasto,
            fecha_timbrado,
            uuid_fiscal,
            xml_url,
            pdf_url,
            ticket_url,
            metodo_pago,
            proveedores(id, nombre_comercial, rfc, saldo_favor)
          `)
          .eq('movimiento_bancario_id', movimiento.id);

        // 3. Consultar pedidos directos por movimiento_bancario_id
        const { data: directPedidos } = await supabase
          .from('pedidos')
          .select(`
            id,
            numero_pedido,
            precio_total,
            cliente_nombre,
            fecha_pedido,
            metodo_pago,
            clientes(id, nombre_local, rfc),
            facturas_clientes(*)
          `)
          .eq('movimiento_bancario_id', movimiento.id);

        // 4. Consultar comprobantes de depósito
        const { data: directComps } = await supabase
          .from('comprobantes_deposito_movimientos')
          .select(`
            monto_asociado,
            comprobantes_deposito(*)
          `)
          .eq('movimiento_id', movimiento.id);

        // Fusionar sin duplicados
        const mergedConc: any[] = concData ? [...concData] : [];

        if (directGastos) {
          directGastos.forEach((g: any) => {
            if (!mergedConc.some(c => c.gasto?.id === g.id)) {
              mergedConc.push({
                id: 'direct-gasto-' + g.id,
                monto_asociado: g.monto,
                gasto: g,
                pedido: null
              });
            }
          });
        }

        if (directPedidos) {
          directPedidos.forEach((p: any) => {
            if (!mergedConc.some(c => c.pedido?.id === p.id)) {
              mergedConc.push({
                id: 'direct-pedido-' + p.id,
                monto_asociado: p.precio_total,
                gasto: null,
                pedido: p
              });
            }
          });
        }

        setFetchedConciliaciones(mergedConc);

        if (directComps && directComps.length > 0) {
          setFetchedComprobantes(directComps);
        }

        // 5. Cargar trazabilidad de pagos en partes (múltiples abonos a la misma factura)
        const siblingMap: Record<string, any[]> = {};
        for (const link of mergedConc) {
          const targetGastoId = link.gasto?.id;
          const targetPedidoId = link.pedido?.id;
          const docId = targetGastoId || targetPedidoId;
          if (!docId) continue;

          const siblingList: any[] = [];
          if (targetGastoId) {
            const { data: sConcs } = await supabase
              .from('conciliaciones_bancarias')
              .select(`
                monto_asociado,
                movimiento_bancario:movimientos_bancarios(id, fecha, concepto, monto, retiro, deposito)
              `)
              .eq('gasto_id', targetGastoId);

            if (sConcs) {
              sConcs.forEach((sc: any) => {
                if (sc.movimiento_bancario) {
                  siblingList.push({
                    id: sc.movimiento_bancario.id,
                    fecha: sc.movimiento_bancario.fecha,
                    concepto: sc.movimiento_bancario.concepto,
                    monto: Math.abs(Number(sc.movimiento_bancario.monto || sc.movimiento_bancario.retiro || sc.movimiento_bancario.deposito || 0)),
                    montoAsociado: Number(sc.monto_asociado || sc.movimiento_bancario.monto || 0),
                    isCurrent: sc.movimiento_bancario.id === movimiento.id
                  });
                }
              });
            }

            // También revisar si hay gastos con movimiento_bancario_id
            const { data: siblingGastos } = await supabase
              .from('gastos')
              .select('id, movimiento_bancario_id, monto, movimientos_bancarios(*)')
              .eq('id', targetGastoId);

            if (siblingGastos) {
              siblingGastos.forEach((sg: any) => {
                if (sg.movimientos_bancarios && !siblingList.some(item => item.id === sg.movimientos_bancarios.id)) {
                  siblingList.push({
                    id: sg.movimientos_bancarios.id,
                    fecha: sg.movimientos_bancarios.fecha,
                    concepto: sg.movimientos_bancarios.concepto,
                    monto: Math.abs(Number(sg.movimientos_bancarios.monto || sg.movimientos_bancarios.retiro || sg.movimientos_bancarios.deposito || 0)),
                    montoAsociado: Number(sg.monto),
                    isCurrent: sg.movimientos_bancarios.id === movimiento.id
                  });
                }
              });
            }
          } else if (targetPedidoId) {
            const { data: sConcs } = await supabase
              .from('conciliaciones_bancarias')
              .select(`
                monto_asociado,
                movimiento_bancario:movimientos_bancarios(id, fecha, concepto, monto, retiro, deposito)
              `)
              .eq('pedido_id', targetPedidoId);

            if (sConcs) {
              sConcs.forEach((sc: any) => {
                if (sc.movimiento_bancario) {
                  siblingList.push({
                    id: sc.movimiento_bancario.id,
                    fecha: sc.movimiento_bancario.fecha,
                    concepto: sc.movimiento_bancario.concepto,
                    monto: Math.abs(Number(sc.movimiento_bancario.monto || sc.movimiento_bancario.retiro || sc.movimiento_bancario.deposito || 0)),
                    montoAsociado: Number(sc.monto_asociado || sc.movimiento_bancario.monto || 0),
                    isCurrent: sc.movimiento_bancario.id === movimiento.id
                  });
                }
              });
            }
          }

          const uniqueSiblings = Array.from(new Map(siblingList.map(item => [item.id, item])).values());
          if (uniqueSiblings.length > 0) {
            siblingMap[docId] = uniqueSiblings;
          }
        }

        setFetchedSiblingMovs(siblingMap);
      } catch (err) {
        console.error('Error al consultar detalles completos del movimiento:', err);
      } finally {
        setLoadingDetails(false);
      }
    };

    loadFullDetails();
  }, [movimiento, open]);

  if (!open || !movimiento) return null;

  // Formateador de moneda
  const formatCurrency = (val: number | string | null | undefined) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(num);
  };

  const handleCopy = (text: string, id: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedText(id);
      setTimeout(() => setCopiedText(null), 2000);
    }
  };

  const handleSaveComentarios = async () => {
    setSavingComms(true);
    try {
      if (token) {
        const res = await actualizarAuditoriaMovimientoAction(movimiento.id, comentarios, token);
        if (!res.success) throw new Error(res.error);
      } else {
        const { error } = await supabase
          .from('movimientos_bancarios')
          .update({ comentarios: comentarios || null })
          .eq('id', movimiento.id);
        if (error) throw error;
      }
      setIsEditingComms(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Error al guardar comentarios: ${err.message}`);
    } finally {
      setSavingComms(false);
    }
  };

  // Carga directa de archivos
  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileType: 'xml' | 'pdf_factura' | 'pdf_ticket' | 'soporte_reembolso') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFileType(fileType);
    setUploadProgressMsg(`Subiendo ${file.name}...`);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `movimientos/${movimiento.id}/${Date.now()}_${cleanName}`;

      const { error: uploadErr } = await supabase.storage
        .from('facturas')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      if (token) {
        const res = await adjuntarArchivoDirectoAction(movimiento.id, fileType, filePath, token);
        if (!res.success) throw new Error(res.error);
      } else {
        const fieldMap: Record<string, string> = {
          xml: 'xml_url',
          pdf_factura: 'pdf_factura_url',
          pdf_ticket: 'pdf_ticket_url',
          soporte_reembolso: 'soporte_reembolso_url'
        };
        const currentVals = movimiento[fieldMap[fileType]] ? String(movimiento[fieldMap[fileType]]).split(',').filter(Boolean) : [];
        if (!currentVals.includes(filePath)) currentVals.push(filePath);

        const { error: updateErr } = await supabase
          .from('movimientos_bancarios')
          .update({ [fieldMap[fileType]]: currentVals.join(',') })
          .eq('id', movimiento.id);
        if (updateErr) throw updateErr;
      }

      setUploadProgressMsg(`¡Archivo adjuntado correctamente!`);
      setTimeout(() => setUploadProgressMsg(null), 3000);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error(err);
      alert(`Error al subir archivo: ${err.message}`);
    } finally {
      setUploadingFileType(null);
      e.target.value = '';
    }
  };

  // --- DATOS Y CÁLCULOS DEL MOVIMIENTO ---
  const isRetiro = movimiento.tipo_movimiento === 'Retiro' || (Number(movimiento.retiro) > 0 && !movimiento.deposito);
  const montoMovimiento = Math.abs(Number(movimiento.monto) || (isRetiro ? Number(movimiento.retiro) : Number(movimiento.deposito)) || 0);
  const statusColor = movimiento.estatus_conciliacion_bancaria?.color || '#9CA3AF';
  const statusNombre = movimiento.estatus_conciliacion_bancaria?.nombre || 'Pendiente';

  // Conciliaciones bancarias asociadas (usando las consultadas dinámicamente)
  const conciliaciones = fetchedConciliaciones.length > 0 ? fetchedConciliaciones : ((movimiento.conciliaciones_bancarias as any[]) || []);
  
  // Suma total de facturas/gastos/pedidos asociados
  const totalFacturadoAsociado = conciliaciones.reduce((sum: number, link: any) => {
    return sum + Number(link.monto_asociado || (link.gasto ? link.gasto.monto : link.pedido ? link.pedido.precio_total : 0));
  }, 0);

  // Comprobantes de depósito asociados
  const compMovs = fetchedComprobantes.length > 0 ? fetchedComprobantes : ((movimiento.comprobantes_deposito_movimientos as any[]) || []);
  const totalComprobantesDeposito = compMovs.reduce((sum: number, c: any) => sum + Number(c.monto_asociado || c.comprobantes_deposito?.monto || 0), 0);

  const totalComprobado = totalFacturadoAsociado + totalComprobantesDeposito;
  const difMonto = montoMovimiento - totalComprobado;
  const esMatchExacto = Math.abs(difMonto) < 0.05 && totalComprobado > 0;
  const tieneSaldoFavor = difMonto > 0.05 && totalComprobado > 0;
  const tieneSaldoContra = difMonto < -0.05 && totalComprobado > 0;
  const sinDocumentos = totalComprobado === 0;

  // --- DETECCIÓN DE FORMA/MÉTODO DE PAGO Y DISCREPANCIAS FISCALES ---
  const conceptoBanco = (movimiento.concepto || '').toUpperCase();
  let metodoPagoBancoDetectado: 'Efectivo / Cajero' | 'Transferencia SPEI' | 'Tarjeta de Débito / Crédito' | 'Indeterminado' = 'Indeterminado';
  let metodoBancoCodigo: '01' | '03' | '04_28' | null = null;

  if (
    conceptoBanco.includes('EFECTIVO') ||
    conceptoBanco.includes('CAJERO') ||
    conceptoBanco.includes('RETIRO CAJERO') ||
    conceptoBanco.includes('DEPOSITO CAJERO') ||
    conceptoBanco.includes('PRACTICAJA') ||
    conceptoBanco.includes('DISP.') ||
    conceptoBanco.includes('DISPOSICION')
  ) {
    metodoPagoBancoDetectado = 'Efectivo / Cajero';
    metodoBancoCodigo = '01';
  } else if (
    conceptoBanco.includes('SPEI') ||
    conceptoBanco.includes('TRANSFERENCIA') ||
    conceptoBanco.includes('TRF') ||
    conceptoBanco.includes('TRANSF') ||
    conceptoBanco.includes('TEF') ||
    conceptoBanco.includes('TRASPASO')
  ) {
    metodoPagoBancoDetectado = 'Transferencia SPEI';
    metodoBancoCodigo = '03';
  } else if (
    conceptoBanco.includes('TARJETA') ||
    conceptoBanco.includes('PAGO CON TARJETA') ||
    conceptoBanco.includes('TDC') ||
    conceptoBanco.includes('T.DEB') ||
    conceptoBanco.includes('T.CRE') ||
    conceptoBanco.includes('DEBITO') ||
    conceptoBanco.includes('CREDITO') ||
    conceptoBanco.includes('POS')
  ) {
    metodoPagoBancoDetectado = 'Tarjeta de Débito / Crédito';
    metodoBancoCodigo = '04_28';
  }

  // Lista de discrepancias fiscales encontradas
  const discrepancias: Array<{
    tipo: 'alerta' | 'advertencia';
    titulo: string;
    detalle: string;
    facturaNombre: string;
    montoFactura: number;
    metodoCfdi: string;
  }> = [];

  conciliaciones.forEach((link: any) => {
    const isGasto = !!link.gasto;
    const item = isGasto ? link.gasto : link.pedido;
    if (!item) return;

    const mpCfdi = isGasto ? item.metodo_pago : (item.facturas_clientes?.[0]?.metodo_pago || item.metodo_pago);
    if (!mpCfdi || !metodoBancoCodigo) return;

    const cleanMp = String(mpCfdi).trim().padStart(2, '0');

    if (metodoBancoCodigo === '01' && cleanMp !== '01') {
      discrepancias.push({
        tipo: 'alerta',
        titulo: 'Discrepancia: Retiro Bancario en Efectivo vs Factura Electrónica',
        detalle: `El banco registra retiro en cajero/efectivo pero el CFDI indica método ${cleanMp} (Pago electrónico / Tarjeta / Transferencia).`,
        facturaNombre: isGasto ? item.concepto : `Pedido #${item.numero_pedido}`,
        montoFactura: isGasto ? Number(item.monto) : Number(item.precio_total),
        metodoCfdi: cleanMp
      });
    } else if (metodoBancoCodigo === '04_28' && cleanMp !== '04' && cleanMp !== '28') {
      discrepancias.push({
        tipo: 'alerta',
        titulo: 'Discrepancia: Cargo a Tarjeta vs Factura en Efectivo / Transferencia',
        detalle: `El banco registra compra con Tarjeta pero el CFDI tiene forma de pago ${cleanMp} (${cleanMp === '01' ? 'Efectivo' : cleanMp === '03' ? 'Transferencia' : 'Otro'}).`,
        facturaNombre: isGasto ? item.concepto : `Pedido #${item.numero_pedido}`,
        montoFactura: isGasto ? Number(item.monto) : Number(item.precio_total),
        metodoCfdi: cleanMp
      });
    } else if (metodoBancoCodigo === '03' && cleanMp !== '03' && cleanMp !== '99') {
      discrepancias.push({
        tipo: 'advertencia',
        titulo: 'Discrepancia: Transferencia SPEI vs Forma de Pago en Factura',
        detalle: `El banco procesó transferencia electrónica pero el CFDI indica forma de pago ${cleanMp} (${cleanMp === '01' ? 'Efectivo' : 'Tarjeta'}).`,
        facturaNombre: isGasto ? item.concepto : `Pedido #${item.numero_pedido}`,
        montoFactura: isGasto ? Number(item.monto) : Number(item.precio_total),
        metodoCfdi: cleanMp
      });
    }
  });

  // --- TRAZABILIDAD DE FACTURAS COMPARTIDAS / DIVIDIDAS EN MÚLTIPLES MOVIMIENTOS ---
  const multiPaymentsInfo: Array<{
    documentoId: string;
    documentoConcepto: string;
    documentoTotal: number;
    movimientosHermanos: Array<{
      id: string;
      fecha: string;
      concepto: string;
      monto: number;
      montoAsociado: number;
      isCurrent: boolean;
    }>;
    sumaTotalPagos: number;
    saldoRestante: number;
  }> = [];

  conciliaciones.forEach((link: any) => {
    const isG = !!link.gasto;
    const targetId = isG ? link.gasto?.id : link.pedido?.id;
    if (!targetId) return;

    const docTotal = Number(isG ? link.gasto?.monto : link.pedido?.precio_total || 0);
    const docConcepto = isG ? link.gasto?.concepto : `Pedido #${link.pedido?.numero_pedido}`;
    let linkedMovements = fetchedSiblingMovs[targetId] || [];

    if (linkedMovements.length === 0) {
      const lmList: any[] = [];
      allMovimientos.forEach((otherM: any) => {
        const oLink = otherM.conciliaciones_bancarias?.find((l: any) =>
          (isG && l.gasto?.id === targetId) || (!isG && l.pedido?.id === targetId)
        );
        if (oLink) {
          lmList.push({
            id: otherM.id,
            fecha: otherM.fecha,
            concepto: otherM.concepto,
            monto: Math.abs(Number(otherM.monto) || Number(otherM.retiro) || Number(otherM.deposito) || 0),
            montoAsociado: Number(oLink.monto_asociado || Math.abs(otherM.monto) || 0),
            isCurrent: otherM.id === movimiento.id
          });
        }
      });
      linkedMovements = lmList;
    }

    if (linkedMovements.length > 1) {
      const sumaPagos = linkedMovements.reduce((sum, x) => sum + Number(x.montoAsociado || x.monto || 0), 0);
      multiPaymentsInfo.push({
        documentoId: targetId,
        documentoConcepto: docConcepto,
        documentoTotal: docTotal,
        movimientosHermanos: linkedMovements,
        sumaTotalPagos: sumaPagos,
        saldoRestante: Math.max(0, docTotal - sumaPagos)
      });
    }
  });

  // Reembolso fusionado si existe
  const reembolsoMov = movimiento.movimiento_reembolso_id
    ? allMovimientos.find(m => m.id === movimiento.movimiento_reembolso_id)
    : null;

  // Extraer todos los archivos directos o indirectos
  const directXmls = movimiento.xml_url ? String(movimiento.xml_url).split(',').filter(Boolean) : [];
  const directPdfs = movimiento.pdf_factura_url ? String(movimiento.pdf_factura_url).split(',').filter(Boolean) : [];
  const directTickets = movimiento.pdf_ticket_url ? String(movimiento.pdf_ticket_url).split(',').filter(Boolean) : [];
  const directReembolso = movimiento.soporte_reembolso_url ? String(movimiento.soporte_reembolso_url).split(',').filter(Boolean) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden font-sans">
        
        {/* ── CABECERA ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 text-white border-b border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-extrabold tracking-tight">Historial y Auditoría de Conciliación</h2>
                <span
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider"
                  style={{
                    backgroundColor: `${statusColor}25`,
                    borderColor: `${statusColor}60`,
                    color: statusColor === '#9CA3AF' ? '#D1D5DB' : statusColor
                  }}
                >
                  {statusNombre}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                  isRetiro ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {isRetiro ? 'Retiro / Egreso' : 'Depósito / Ingreso'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                <span>Fecha: <strong className="text-gray-200">{new Date(movimiento.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' })}</strong></span>
                {movimiento.cuentas_bancarias && (
                  <>
                    <span>•</span>
                    <span>Cuenta: <strong className="text-gray-200">{movimiento.cuentas_bancarias.nombre} ({movimiento.cuentas_bancarias.moneda || 'MXN'})</strong></span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenReconcileModal && (
              <button
                type="button"
                onClick={() => { onClose(); onOpenReconcileModal(movimiento); }}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-gray-950 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                title="Abrir Conciliador Manual"
              >
                <ArrowRightLeft size={13} /> Conciliar Facturas
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
              title="Cerrar ventana"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── BARRA DE TABS ─────────────────────────────────────────────────── */}
        <div className="px-6 bg-gray-50 dark:bg-gray-955/60 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('detalle')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'detalle'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Receipt size={14} /> Ficha y Facturas ({conciliaciones.length})
            </button>
            <button
              onClick={() => setActiveTab('documentos')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'documentos'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Paperclip size={14} /> Archivos y Adjuntos ({directXmls.length + directPdfs.length + directTickets.length + directReembolso.length})
            </button>
            <button
              onClick={() => setActiveTab('auditoria')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'auditoria'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Clock size={14} /> Notas y Auditoría
            </button>
          </div>

          {/* Indicador rápido de balance */}
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Monto Movimiento:</span>
            <span className={`font-mono font-extrabold ${isRetiro ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {isRetiro ? `-${formatCurrency(montoMovimiento)}` : `+${formatCurrency(montoMovimiento)}`}
            </span>
          </div>
        </div>

        {/* ── CONTENIDO PRINCIPAL SCROLLEABLE ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* INDICADOR DE CARGA DE DETALLES */}
          {loadingDetails && (
            <div className="p-2.5 bg-blue-50 dark:bg-blue-955/30 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-800 dark:text-blue-200 font-bold flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2">
                <RefreshCw size={13} className="animate-spin text-blue-600 dark:text-blue-400" />
                <span>Consultando relaciones y facturas vinculadas en tiempo real...</span>
              </div>
            </div>
          )}

          {/* MENSAJE DE ÉXITO O PROGRESO DE SUBIDA */}
          {uploadProgressMsg && (
            <div className="p-3 bg-amber-50 dark:bg-amber-955/30 border border-amber-300 dark:border-amber-700/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
              <RefreshCw size={14} className="animate-spin text-amber-600" />
              <span>{uploadProgressMsg}</span>
            </div>
          )}

          {/* ── TAB 1: DETALLE Y FACTURAS ──────────────────────────────────── */}
          {activeTab === 'detalle' && (
            <>
              {/* TARJETAS SUPERIORES DE BALANCE Y COBERTURA */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* 1. Detalle del Banco */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-750 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">
                      <span>Importe Bancario</span>
                      <Landmark size={14} />
                    </div>
                    <div className={`text-2xl font-black font-mono mt-1 ${isRetiro ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {isRetiro ? `-${formatCurrency(montoMovimiento)}` : `+${formatCurrency(montoMovimiento)}`}
                    </div>
                    <p className="text-[11px] text-gray-700 dark:text-gray-300 font-bold mt-2 break-words line-clamp-2" title={movimiento.concepto}>
                      {movimiento.concepto}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400 space-y-1">
                    {movimiento.referencia && (
                      <div className="flex justify-between">
                        <span>Referencia:</span>
                        <strong className="font-mono text-gray-700 dark:text-gray-300">{movimiento.referencia}</strong>
                      </div>
                    )}
                    {movimiento.rfc_proveedor && (
                      <div className="flex justify-between">
                        <span>RFC Detectado:</span>
                        <strong className="font-mono text-gray-700 dark:text-gray-300">{movimiento.rfc_proveedor}</strong>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Método Banco:</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{metodoPagoBancoDetectado}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Total Comprobado / Facturado */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-750 flex flex-col justify-between shadow-xs">
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">
                      <span>Suma Facturas / Docs</span>
                      <Receipt size={14} />
                    </div>
                    <div className="text-2xl font-black font-mono mt-1 text-gray-900 dark:text-white">
                      {formatCurrency(totalComprobado)}
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                      {conciliaciones.length} Factura{conciliaciones.length !== 1 ? 's' : ''} asignada{conciliaciones.length !== 1 ? 's' : ''}
                      {compMovs.length > 0 && ` + ${compMovs.length} Ficha/Comprobante`}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-500 dark:text-gray-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Total Facturas CFDI:</span>
                      <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{formatCurrency(totalFacturadoAsociado)}</span>
                    </div>
                    {totalComprobantesDeposito > 0 && (
                      <div className="flex justify-between">
                        <span>Fichas Depósito / POS:</span>
                        <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{formatCurrency(totalComprobantesDeposito)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Categoría:</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{movimiento.categorias_movimiento_bancario?.nombre || 'Sin categoría'}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Estado de Cobertura / Saldo a Favor o en Contra */}
                <div className={`p-4 rounded-xl border flex flex-col justify-between shadow-xs ${
                  esMatchExacto
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                    : tieneSaldoContra
                    ? 'bg-rose-50/70 dark:bg-rose-955/20 border-rose-200 dark:border-rose-800/60'
                    : tieneSaldoFavor
                    ? 'bg-amber-50/70 dark:bg-amber-955/20 border-amber-200 dark:border-amber-800/60'
                    : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-750'
                }`}>
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-1">
                      <span className={
                        esMatchExacto ? 'text-emerald-700 dark:text-emerald-400' :
                        tieneSaldoContra ? 'text-rose-700 dark:text-rose-400' :
                        tieneSaldoFavor ? 'text-amber-700 dark:text-amber-400' : 'text-gray-500'
                      }>
                        {esMatchExacto ? 'Conciliación Exacta' :
                         tieneSaldoContra ? 'Saldo en Contra / Pago Incompleto' :
                         tieneSaldoFavor ? 'Saldo a Favor / Excedente' : 'Sin Documentos'}
                      </span>
                      {esMatchExacto ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-amber-600" />}
                    </div>

                    <div className="text-2xl font-black font-mono mt-1 text-gray-900 dark:text-white">
                      {esMatchExacto ? (
                        <span className="text-emerald-600 dark:text-emerald-400">100% Cubierto</span>
                      ) : (
                        <span className={tieneSaldoContra ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}>
                          {formatCurrency(Math.abs(difMonto))}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] mt-2 text-gray-600 dark:text-gray-300">
                      {esMatchExacto && 'El monto del movimiento coincide exactamente con las facturas vinculadas.'}
                      {tieneSaldoContra && `La factura es mayor al movimiento. Quedan ${formatCurrency(Math.abs(difMonto))} pendientes por liquidar en otro movimiento.`}
                      {tieneSaldoFavor && `El movimiento bancario supera los comprobantes asignados. Hay un excedente no justificado de ${formatCurrency(difMonto)}.`}
                      {sinDocumentos && 'No se han vinculado facturas ni comprobantes a este movimiento.'}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-200 dark:border-gray-700/60 flex items-center justify-between text-[10px]">
                    <span className="text-gray-500">Diferencia neta:</span>
                    <strong className={`font-mono ${esMatchExacto ? 'text-emerald-600' : 'text-amber-600 font-bold'}`}>
                      {difMonto >= 0 ? `+${formatCurrency(difMonto)}` : `-${formatCurrency(Math.abs(difMonto))}`}
                    </strong>
                  </div>
                </div>
              </div>

              {/* ── BANNERS DE ALERTAS: DISCREPANCIA DE PAGO (EFECTIVO VS TARJETA) ── */}
              {discrepancias.length > 0 && (
                <div className="space-y-2.5">
                  {discrepancias.map((disc, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-l-4 border-amber-500 dark:border-amber-400 border-y border-r border-amber-200/80 dark:border-amber-900/50 text-xs shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                          <ShieldAlert size={16} />
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h4 className="font-extrabold text-amber-900 dark:text-amber-200 text-xs">{disc.titulo}</h4>
                            <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[10px] font-black">
                              Alerta Fiscal SAT
                            </span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300 text-[11px] leading-relaxed">
                            {disc.detalle}
                          </p>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 pt-1 flex items-center gap-2 flex-wrap">
                            <span>Documento: <strong className="text-gray-700 dark:text-gray-300">{disc.facturaNombre}</strong></span>
                            <span>•</span>
                            <span>Importe Factura: <strong className="font-mono text-gray-700 dark:text-gray-300">{formatCurrency(disc.montoFactura)}</strong></span>
                            <span>•</span>
                            <span>Forma de Pago CFDI: <strong className="font-mono text-amber-700 dark:text-amber-300">{disc.metodoCfdi}</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── BANNER DE FACTURA COMPARTIDA EN MÚLTIPLES PAGOS ──────────── */}
              {multiPaymentsInfo.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <LinkIcon size={14} className="text-indigo-600 dark:text-indigo-400" />
                      Trazabilidad de Pagos en Partes (Factura Dividida en {multiPaymentsInfo[0].movimientosHermanos.length} Exhibiciones)
                    </h3>
                  </div>

                  {multiPaymentsInfo.map((mp, idx) => {
                    const pctPagado = Math.min(100, (mp.sumaTotalPagos / mp.documentoTotal) * 100);
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-955/30 border border-indigo-200 dark:border-indigo-800/80 shadow-xs space-y-3"
                      >
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <div>
                            <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">{mp.documentoConcepto}</span>
                            <div className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                              Total Factura: <strong className="font-mono">{formatCurrency(mp.documentoTotal)}</strong> | Suma Pagos Estado de Cuenta: <strong className="font-mono">{formatCurrency(mp.sumaTotalPagos)}</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-600 text-white shadow-xs">
                              {pctPagado.toFixed(1)}% Liquidado
                            </span>
                            {mp.saldoRestante > 0 && (
                              <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                                Resta: {formatCurrency(mp.saldoRestante)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Línea de tiempo de los pagos bancarios */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                          {mp.movimientosHermanos.map((hm, hidx) => (
                            <div
                              key={hidx}
                              className={`p-2.5 rounded-xl border text-xs flex flex-col justify-between transition-all ${
                                hm.isCurrent
                                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold'
                                  : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border-indigo-200 dark:border-indigo-800/60'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] mb-1 opacity-90">
                                <span>{hm.isCurrent ? '👉 Pago Actual' : `🔗 Pago #${hidx + 1}`}</span>
                                <span className="font-mono">{new Date(hm.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</span>
                              </div>
                              <div className="text-[11px] truncate" title={hm.concepto}>
                                {hm.concepto}
                              </div>
                              <div className="mt-2 pt-1.5 border-t border-indigo-400/30 flex justify-between items-center">
                                <span className="text-[10px] opacity-80">Imputado:</span>
                                <span className="font-mono font-black">{formatCurrency(hm.montoAsociado)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── LISTADO DESGLOSADO DE FACTURAS VINCULADAS ──────────────────── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} /> Facturas y Documentos Vinculados ({conciliaciones.length})
                  </h3>
                  {onOpenReconcileModal && (
                    <button
                      type="button"
                      onClick={() => { onClose(); onOpenReconcileModal(movimiento); }}
                      className="text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} /> Asignar o Vincular Más Facturas
                    </button>
                  )}
                </div>

                {conciliaciones.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 space-y-2">
                    <AlertTriangle size={24} className="mx-auto text-amber-500 opacity-60" />
                    <p className="text-xs font-bold text-gray-600 dark:text-gray-300">Este movimiento bancario no tiene facturas fiscales vinculadas.</p>
                    <p className="text-[11px] text-gray-400 max-w-md mx-auto">
                      Puedes vincular una factura existente de egresos/ingresos o subir el archivo XML directamente en la pestaña de Archivos.
                    </p>
                    {onOpenReconcileModal && (
                      <button
                        type="button"
                        onClick={() => { onClose(); onOpenReconcileModal(movimiento); }}
                        className="mt-3 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-gray-950 text-xs font-bold transition-all shadow inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowRightLeft size={14} /> Iniciar Conciliación
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {conciliaciones.map((link: any, idx: number) => {
                      const isGasto = !!link.gasto;
                      const item = isGasto ? link.gasto : link.pedido;
                      if (!item) return null;

                      const uuid = item.uuid_fiscal || item.facturas_clientes?.[0]?.uuid_fiscal;
                      const xmlUrl = item.xml_url || item.facturas_clientes?.[0]?.xml_url;
                      const pdfUrl = item.pdf_url || item.facturas_clientes?.[0]?.pdf_url;
                      const ticketUrl = item.ticket_url || item.facturas_clientes?.[0]?.ticket_url;

                      const proveedorNombre = isGasto ? item.proveedores?.nombre_comercial : (item.cliente_nombre || item.clientes?.nombre_local);
                      const rfc = isGasto ? item.proveedores?.rfc : item.clientes?.rfc;
                      const montoAsoc = Number(link.monto_asociado || (isGasto ? item.monto : item.precio_total));
                      const fechaDoc = item.fecha_gasto || item.fecha_pedido || item.fecha_timbrado;

                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 shadow-xs space-y-3 hover:border-amber-300 dark:hover:border-amber-600 transition-colors"
                        >
                          {/* Encabezado del Documento */}
                          <div className="flex justify-between items-start flex-wrap gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  isGasto ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200' : 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                                }`}>
                                  {isGasto ? 'Factura de Pago (Egreso / Proveedor)' : 'Factura de Cobro (Ingreso / Pedido)'}
                                </span>
                                {item.metodo_pago && (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    Método: {item.metodo_pago}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                {isGasto ? item.concepto : `Pedido #${item.numero_pedido} - ${item.cliente_nombre || 'Cliente'}`}
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 flex-wrap">
                                <span>Emisor/Receptor: <strong className="text-gray-700 dark:text-gray-200">{proveedorNombre || 'No especificado'}</strong></span>
                                {rfc && <span className="font-mono text-[10px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-500">RFC: {rfc}</span>}
                              </p>
                            </div>

                            <div className="text-right">
                              <div className="text-xs text-gray-400 uppercase font-bold">Monto Imputado</div>
                              <div className="text-lg font-black font-mono text-amber-600 dark:text-amber-400">
                                {formatCurrency(montoAsoc)}
                              </div>
                              {montoAsoc !== (isGasto ? Number(item.monto) : Number(item.precio_total)) && (
                                <div className="text-[10px] text-gray-400">
                                  Total Factura: {formatCurrency(isGasto ? item.monto : item.precio_total)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* UUID Fiscal y Fecha */}
                          <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-[10px] font-bold uppercase">UUID Fiscal:</span>
                              {uuid ? (
                                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                                  <span>{uuid}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(uuid, `uuid-${idx}`)}
                                    className="p-1 text-gray-400 hover:text-amber-500 rounded transition-colors"
                                    title="Copiar UUID"
                                  >
                                    {copiedText === `uuid-${idx}` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                  </button>
                                </div>
                              ) : (
                                <span className="italic text-gray-400 text-[11px]">Sin UUID (Factura manual / en proceso)</span>
                              )}
                            </div>

                            {fechaDoc && (
                              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                Fecha Factura: <strong className="text-gray-700 dark:text-gray-300 font-mono">{new Date(fechaDoc).toLocaleDateString('es-MX', { timeZone: 'UTC' })}</strong>
                              </div>
                            )}
                          </div>

                          {/* Botones de acción directa por factura */}
                          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800 flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {xmlUrl && (
                                <button
                                  type="button"
                                  onClick={() => openCfdi(xmlUrl.split(',')[0])}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-955/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                                >
                                  <Eye size={13} /> Ver Representación CFDI
                                </button>
                              )}
                              {xmlUrl && (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(xmlUrl.split(',')[0])}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-955/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <FileCode size={13} /> XML
                                </button>
                              )}
                              {pdfUrl && (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(pdfUrl.split(',')[0])}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 dark:bg-red-955/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100 flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <FileText size={13} /> PDF
                                </button>
                              )}
                              {ticketUrl && (
                                <button
                                  type="button"
                                  onClick={() => onDownloadFile(ticketUrl.split(',')[0])}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-955/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <CreditCard size={13} /> Ticket
                                </button>
                              )}
                            </div>

                            <span className="text-[10px] text-gray-400 italic">
                              ID: {item.id.substring(0, 8)}...
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── COMPROBANTES DE DEPÓSITO / VENTANILLA / PARROT ────────────── */}
              {compMovs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt size={14} /> Fichas de Depósito y Cortes Terminal POS / Parrot ({compMovs.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {compMovs.map((c: any, cidx: number) => {
                      const comp = c.comprobantes_deposito || {};
                      const isVentanilla = comp.tipo === 'deposito_ventanilla';
                      return (
                        <div
                          key={cidx}
                          className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/40 text-xs space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              isVentanilla ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                            }`}>
                              {isVentanilla ? 'Depósito en Ventanilla' : 'Tarjeta / POS Parrot'}
                            </span>
                            <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              {formatCurrency(c.monto_asociado || comp.monto)}
                            </span>
                          </div>
                          <div className="font-bold text-gray-800 dark:text-gray-200 truncate">{comp.descripcion || 'Ficha de Depósito'}</div>
                          {comp.archivo_url && (
                            <button
                              type="button"
                              onClick={() => onDownloadFile(comp.archivo_url)}
                              className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Download size={11} /> Ver Comprobante Adjunto
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── REEMBOLSO FUSIONADO ──────────────────────────────────────── */}
              {reembolsoMov && (
                <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-800/60 text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <ArrowRightLeft size={14} /> Reembolso Bancario Fusionado
                    </span>
                    <span className="font-mono font-black text-amber-700 dark:text-amber-400">
                      {formatCurrency(Math.abs(reembolsoMov.monto))}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-[11px]">
                    Movimiento par: <strong className="text-gray-900 dark:text-white">{reembolsoMov.concepto}</strong> ({new Date(reembolsoMov.fecha).toLocaleDateString('es-MX', { timeZone: 'UTC' })})
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── TAB 2: ARCHIVOS Y ASIGNACIÓN DIRECTA ───────────────────────── */}
          {activeTab === 'documentos' && (
            <div className="space-y-6">
              
              {/* ZONA DE CARGA RÁPIDA / DROPZONE DIRECTO */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-gray-50 to-gray-100/50 dark:from-gray-800/40 dark:to-gray-900/60 border-2 border-dashed border-amber-300 dark:border-amber-700/60 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500 text-gray-950">
                    <UploadCloud size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900 dark:text-white">Asignación y Carga Directa de Documentos</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Sube y asocia directamente archivos a este movimiento bancario</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                  
                  {/* Subir XML */}
                  <label className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-2xs hover:shadow-xs group">
                    <input
                      type="file"
                      accept=".xml"
                      className="hidden"
                      onChange={(e) => handleDirectFileUpload(e, 'xml')}
                      disabled={uploadingFileType !== null}
                    />
                    <FileCode size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    <div>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">+ Subir Factura XML</span>
                      <span className="text-[10px] text-gray-400">Extrae CFDI y vincula</span>
                    </div>
                  </label>

                  {/* Subir PDF Factura */}
                  <label className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-red-500 dark:hover:border-red-400 transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-2xs hover:shadow-xs group">
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={(e) => handleDirectFileUpload(e, 'pdf_factura')}
                      disabled={uploadingFileType !== null}
                    />
                    <FileText size={24} className="text-red-500 group-hover:scale-110 transition-transform" />
                    <div>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">+ Subir PDF Factura</span>
                      <span className="text-[10px] text-gray-400">Representación PDF</span>
                    </div>
                  </label>

                  {/* Subir Ticket */}
                  <label className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-amber-500 dark:hover:border-amber-400 transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-2xs hover:shadow-xs group">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => handleDirectFileUpload(e, 'pdf_ticket')}
                      disabled={uploadingFileType !== null}
                    />
                    <CreditCard size={24} className="text-amber-500 group-hover:scale-110 transition-transform" />
                    <div>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">+ Subir Ticket / Voucher</span>
                      <span className="text-[10px] text-gray-400">Ticket de compra / POS</span>
                    </div>
                  </label>

                  {/* Subir Soporte Reembolso */}
                  <label className="p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-400 transition-all flex flex-col items-center justify-center text-center gap-2 cursor-pointer shadow-2xs hover:shadow-xs group">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => handleDirectFileUpload(e, 'soporte_reembolso')}
                      disabled={uploadingFileType !== null}
                    />
                    <Paperclip size={24} className="text-purple-500 group-hover:scale-110 transition-transform" />
                    <div>
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">+ Soporte Reembolso</span>
                      <span className="text-[10px] text-gray-400">Póliza o comprobante</span>
                    </div>
                  </label>

                </div>
              </div>

              {/* LISTA DE ARCHIVOS ACTUALMENTE VINCULADOS */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Archivos Disponibles en este Movimiento
                </h3>

                {directXmls.length === 0 && directPdfs.length === 0 && directTickets.length === 0 && directReembolso.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs italic bg-gray-50 dark:bg-gray-800/20 rounded-xl border border-gray-200 dark:border-gray-800">
                    No hay archivos adjuntos directamente a este movimiento.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* XMLs */}
                    {directXmls.map((path, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-955/20 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileCode size={20} className="text-blue-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-blue-950 dark:text-blue-200 truncate block">CFDI XML #{idx + 1}</span>
                            <span className="text-[10px] text-gray-500 truncate block">{path.split('/').pop()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openCfdi(path)}
                            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                            title="Ver Representación CFDI"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDownloadFile(path)}
                            className="p-1.5 rounded-lg bg-white dark:bg-gray-800 text-blue-600 border border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Descargar archivo"
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* PDFs */}
                    {directPdfs.map((path, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-red-50/60 dark:bg-red-955/20 border border-red-200 dark:border-red-800/60 flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={20} className="text-red-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-red-950 dark:text-red-200 truncate block">Factura PDF #{idx + 1}</span>
                            <span className="text-[10px] text-gray-500 truncate block">{path.split('/').pop()}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDownloadFile(path)}
                          className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-2xs shrink-0 cursor-pointer"
                          title="Descargar o Ver PDF"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Tickets */}
                    {directTickets.map((path, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CreditCard size={20} className="text-amber-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-amber-950 dark:text-amber-200 truncate block">Ticket / Comprobante #{idx + 1}</span>
                            <span className="text-[10px] text-gray-500 truncate block">{path.split('/').pop()}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDownloadFile(path)}
                          className="p-1.5 rounded-lg bg-amber-500 text-gray-950 hover:bg-amber-600 transition-colors shadow-2xs shrink-0 cursor-pointer"
                          title="Descargar Ticket"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ))}

                    {/* Soporte Reembolso */}
                    {directReembolso.map((path, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-955/20 border border-purple-200 dark:border-purple-800/60 flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Paperclip size={20} className="text-purple-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-purple-950 dark:text-purple-200 truncate block">Soporte Reembolso #{idx + 1}</span>
                            <span className="text-[10px] text-gray-500 truncate block">{path.split('/').pop()}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDownloadFile(path)}
                          className="p-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-2xs shrink-0 cursor-pointer"
                          title="Descargar Soporte"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ))}

                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: COMENTARIOS Y AUDITORÍA ─────────────────────────────── */}
          {activeTab === 'auditoria' && (
            <div className="space-y-6">
              
              {/* Sección de Comentarios */}
              <div className="p-5 rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-750 shadow-xs space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Edit3 size={16} className="text-amber-500" />
                    <h3 className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                      Comentarios y Notas Internas
                    </h3>
                  </div>
                  {!isEditingComms ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingComms(true)}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-955/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 size={12} /> Editar Comentarios
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingComms(false)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveComentarios}
                        disabled={savingComms}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        {savingComms ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                        Guardar
                      </button>
                    </div>
                  )}
                </div>

                {isEditingComms ? (
                  <textarea
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    rows={4}
                    placeholder="Escribe comentarios, justificaciones contables, aclaraciones o números de póliza..."
                    className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                ) : (
                  <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap min-h-[70px]">
                    {movimiento.comentarios ? movimiento.comentarios : <span className="text-gray-400 italic">Sin comentarios registrados. Haz clic en "Editar Comentarios" para agregar notas contables o de auditoría.</span>}
                  </div>
                )}
              </div>

              {/* Registro de Auditoría y Trazabilidad */}
              <div className="p-5 rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-750 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-indigo-500" />
                  <h3 className="text-xs font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Registro de Auditoría y Trazabilidad
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">ID Movimiento:</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200 font-bold">{movimiento.id}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Fecha Creación / Carga:</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200">
                      {movimiento.creado_en ? new Date(movimiento.creado_en).toLocaleString('es-MX') : 'No registrado'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800">
                    <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Mes de Conciliación:</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      {movimiento.mes_conciliacion || 'Automático por fecha'}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* ── PIE DEL MODAL ─────────────────────────────────────────────────── */}
        <div className="px-6 py-3.5 bg-gray-50 dark:bg-gray-955 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>ERP Seimenjo • Auditoría Financiera</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
