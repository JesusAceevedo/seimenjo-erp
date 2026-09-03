'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo } from 'react';
import { X, FileText, Search, Check, AlertTriangle, Link as LinkIcon, UploadCloud, RefreshCw, Layers } from 'lucide-react';
import { formatCurrency } from '../../../../lib/formatters';
import { useSessionToken } from '../../../../lib/hooks/useSessionToken';
import { useEmpresaId } from '../../../../lib/hooks/useEmpresaId';
import { vincularFacturaAPedido } from '../actions';
import { supabase } from '../../../../lib/supabase';

interface FacturacionAcumuladaModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ventas: any[];
}

export default function FacturacionAcumuladaModal({
  open,
  onClose,
  onSuccess,
  ventas
}: FacturacionAcumuladaModalProps) {
  const getSessionToken = useSessionToken();
  const getEmpresaId = useEmpresaId();

  const [search, setSearch] = useState('');
  const [selectedPedidoIds, setSelectedPedidoIds] = useState<string[]>([]);
  const [folioInput, setFolioInput] = useState('');
  const [uuidInput, setUuidInput] = useState('');
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtrar pedidos que no tienen factura vinculada
  const pedidosPendientesFactura = useMemo(() => {
    return ventas.filter(v => {
      if (v._esFacturaSuelta) return false;
      const hasFactura = !!v.folio_factura || (v.facturas_clientes && v.facturas_clientes.length > 0);
      return !hasFactura;
    });
  }, [ventas]);

  // Filtrar por búsqueda
  const filtrados = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return pedidosPendientesFactura;
    return pedidosPendientesFactura.filter(p => {
      const numPed = String(p.numero_pedido || '').toLowerCase();
      const cliName = String(p.clientes?.nombre_local || p.cliente_nombre || '').toLowerCase();
      const rfc = String(p.clientes?.rfc || '').toLowerCase();
      const montoStr = String(p.precio_total || '');
      return numPed.includes(q) || cliName.includes(q) || rfc.includes(q) || montoStr.includes(q);
    });
  }, [pedidosPendientesFactura, search]);

  const toggleSelectPedido = (id: string) => {
    setSelectedPedidoIds(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    if (selectedPedidoIds.length === filtrados.length) {
      setSelectedPedidoIds([]);
    } else {
      setSelectedPedidoIds(filtrados.map(p => p.id));
    }
  };

  const totalSeleccionado = useMemo(() => {
    return pedidosPendientesFactura
      .filter(p => selectedPedidoIds.includes(p.id))
      .reduce((sum, p) => sum + Number(p.precio_total || 0), 0);
  }, [pedidosPendientesFactura, selectedPedidoIds]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith('.xml')) {
        setXmlFile(file);
        setError(null);
      } else {
        alert('Por favor selecciona un archivo con extensión .xml');
      }
    }
  };

  const handleSaveFacturacionAcumulada = async () => {
    if (selectedPedidoIds.length === 0) {
      setError('Debes seleccionar al menos un pedido para facturar.');
      return;
    }
    if (!folioInput.trim() && !uuidInput.trim() && !xmlFile) {
      setError('Ingresa el Folio/UUID de la factura o adjunta un archivo XML.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = await getSessionToken();
      const empresaId = await getEmpresaId();
      if (!empresaId) throw new Error('No se identificó la empresa activa.');

      let facturaId = '';

      // Si se adjuntó archivo XML, procesarlo e insertarlo en facturas_clientes
      if (xmlFile) {
        const text = await xmlFile.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'application/xml');

        const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0] || xmlDoc.getElementsByTagName('Comprobante')[0];
        const timbre = xmlDoc.getElementsByTagName('tfd:TimbreFiscalDigital')[0] || xmlDoc.getElementsByTagName('TimbreFiscalDigital')[0];
        const uuid = timbre?.getAttribute('UUID') || uuidInput || '';

        const serie = comprobante?.getAttribute('Serie') || '';
        const folio = comprobante?.getAttribute('Folio') || '';
        const folioStr = (serie || folio) ? `${serie}${folio}`.trim() : (folioInput || `FA-${Date.now().toString().slice(-4)}`);
        const total = parseFloat(comprobante?.getAttribute('Total') || String(totalSeleccionado));

        const fileName = `ventas/${Date.now()}_${xmlFile.name.replace(/\s+/g, '_')}`;
        await supabase.storage.from('facturas').upload(fileName, xmlFile);

        // Insertar registro en facturas_clientes
        const { data: newFactura, error: insErr } = await supabase
          .from('facturas_clientes')
          .insert({
            empresa_id: empresaId,
            serie_folio: folioStr,
            uuid_fiscal: uuid ? uuid.toUpperCase() : null,
            total: total,
            subtotal: total / 1.16,
            iva_trasladado: total - (total / 1.16),
            xml_url: fileName,
            fecha_emision: new Date().toISOString().split('T')[0],
            pedido_id: selectedPedidoIds[0]
          })
          .select('id')
          .single();

        if (insErr) throw insErr;
        facturaId = newFactura.id;
      } else {
        // Si ingresó folio/UUID manualmente, buscar o crear el registro en facturas_clientes
        const folioStr = folioInput.trim() || `FA-${Date.now().toString().slice(-4)}`;
        const uuidStr = uuidInput.trim().toUpperCase();

        const { data: existingFactura } = await supabase
          .from('facturas_clientes')
          .select('id')
          .eq('empresa_id', empresaId)
          .or(`serie_folio.eq.${folioStr}${uuidStr ? `,uuid_fiscal.eq.${uuidStr}` : ''}`)
          .maybeSingle();

        if (existingFactura) {
          facturaId = existingFactura.id;
        } else {
          const { data: newFactura, error: insErr } = await supabase
            .from('facturas_clientes')
            .insert({
              empresa_id: empresaId,
              serie_folio: folioStr,
              uuid_fiscal: uuidStr || null,
              total: totalSeleccionado,
              subtotal: totalSeleccionado / 1.16,
              iva_trasladado: totalSeleccionado - (totalSeleccionado / 1.16),
              fecha_emision: new Date().toISOString().split('T')[0],
              pedido_id: selectedPedidoIds[0]
            })
            .select('id')
            .single();

          if (insErr) throw insErr;
          facturaId = newFactura.id;
        }
      }

      // Vincular todos los pedidos seleccionados a la factura creada/asociada
      const linkRes = await vincularFacturaAPedido(facturaId, selectedPedidoIds, token);
      if (!linkRes.success) {
        throw new Error(linkRes.error || 'Error al vincular los pedidos a la factura.');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar la facturación acumulada.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm font-sans animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-950 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-900 bg-gray-50/60 dark:bg-gray-900/30">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="text-emerald-600 dark:text-emerald-400" /> Facturación Acumulada / Múltiple
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Agrupa múltiples pedidos de venta pendientes para asignarles una sola factura o XML acumulado.
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Formulario de Factura & Resumen */}
        <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border-b border-emerald-100 dark:border-emerald-900/30 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
              Folio o Serie Factura
            </label>
            <input
              type="text"
              placeholder="Ej. A-105"
              value={folioInput}
              onChange={e => setFolioInput(e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-500 text-gray-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
              UUID Fiscal (Opcional)
            </label>
            <input
              type="text"
              placeholder="UUID de 36 caracteres..."
              value={uuidInput}
              onChange={e => setUuidInput(e.target.value)}
              className="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-500 text-gray-900 dark:text-white font-mono uppercase"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1">
              Archivo XML (CFDI)
            </label>
            <label className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs cursor-pointer hover:border-emerald-500 transition-colors">
              <UploadCloud size={14} className="text-emerald-500 shrink-0" />
              <span className="truncate text-gray-700 dark:text-gray-300">
                {xmlFile ? xmlFile.name : 'Subir XML...'}
              </span>
              <input type="file" accept=".xml" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        </div>

        {/* Barra de búsqueda y selección */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-900 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por número de pedido, cliente, RFC o monto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-emerald-500 text-gray-900 dark:text-white"
            />
          </div>
          {filtrados.length > 0 && (
            <button
              onClick={selectAllFiltered}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              {selectedPedidoIds.length === filtrados.length ? 'Desmarcar Todos' : 'Marcar Todos'}
            </button>
          )}
        </div>

        {/* Lista de Pedidos */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {filtrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <FileText size={36} className="mx-auto text-gray-300 dark:text-gray-700" />
              <p className="text-sm font-semibold">No hay pedidos pendientes de facturar.</p>
              <p className="text-xs text-gray-400">Todos los pedidos actuales ya cuentan con factura vinculada o están filtrados.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs pb-1">
                <span className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Pedidos sin facturar ({filtrados.length})
                </span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Seleccionados: {selectedPedidoIds.length} | Suma: {formatCurrency(totalSeleccionado)}
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filtrados.map((p) => {
                  const isSelected = selectedPedidoIds.includes(p.id);
                  const cliName = p.clientes?.nombre_local || p.cliente_nombre || 'Cliente Desconocido';
                  const cliRfc = p.clientes?.rfc || 'S/N';
                  const monto = Number(p.precio_total || 0);

                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleSelectPedido(p.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-emerald-300 dark:hover:border-emerald-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-gray-700 pointer-events-none"
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-gray-900 dark:text-white">
                              Pedido #{p.numero_pedido}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold uppercase">
                              {p.estatus_pago || 'Liquidado'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                            <span className="font-medium truncate max-w-[250px]">{cliName}</span>
                            <span className="font-mono text-[10px] text-gray-400">({cliRfc})</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-sm font-mono text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(monto)}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {p.fecha_pedido ? new Date(p.fecha_pedido).toLocaleDateString('es-MX') : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-900 bg-gray-50/50 dark:bg-gray-900/20 flex justify-between items-center">
          <div className="text-xs">
            <span className="text-gray-500 block">Total a Facturar:</span>
            <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalSeleccionado)}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl font-bold text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveFacturacionAcumulada}
              disabled={selectedPedidoIds.length === 0 || saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <><RefreshCw className="animate-spin text-white" size={14} /> Facturando...</>
              ) : (
                <><LinkIcon size={14} /> Facturar {selectedPedidoIds.length} Pedido(s)</>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
