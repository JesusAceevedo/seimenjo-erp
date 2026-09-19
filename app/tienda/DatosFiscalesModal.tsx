'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2, X, CheckCircle2, AlertTriangle, Save, RefreshCw,
  Mail, Phone, MapPin, FileSpreadsheet, ShieldCheck
} from 'lucide-react';
import {
  CATALOGO_REGIMEN_FISCAL,
  CATALOGO_USO_CFDI
} from '../../lib/sat-catalogs';
import {
  obtenerDatosFiscalesCliente,
  actualizarDatosFiscalesCliente
} from './actions';

interface DatosFiscalesModalProps {
  clienteId: string;
  onClose: () => void;
  onSaved?: (clienteActualizado: any) => void;
}

export default function DatosFiscalesModal({ clienteId, onClose, onSaved }: DatosFiscalesModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulario
  const [rfc, setRfc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [regimenFiscal, setRegimenFiscal] = useState('626');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [usoCfdi, setUsoCfdi] = useState('G01');
  const [emailFacturacion, setEmailFacturacion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [nombreLocal, setNombreLocal] = useState('');

  useEffect(() => {
    let isMounted = true;

    const cargarDatos = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await obtenerDatosFiscalesCliente(clienteId);
        if (!res.success || !res.cliente) {
          throw new Error(res.error || 'No se pudieron cargar los datos fiscales actuales.');
        }

        const c = res.cliente;
        if (isMounted) {
          setRfc(c.rfc || '');
          setRazonSocial(c.razon_social || '');
          setRegimenFiscal(c.regimen_fiscal || '626');
          setCodigoPostal(c.codigo_postal || '');
          setUsoCfdi(c.uso_cfdi || 'G01');
          setEmailFacturacion(c.email_facturacion || '');
          setTelefono(c.telefono || '');
          setNombreLocal(c.nombre_local || '');
        }
      } catch (err: unknown) {
        console.error('Error al cargar datos fiscales:', err);
        const msg = err instanceof Error ? err.message : 'Error al consultar información';
        if (isMounted) setErrorMsg(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    cargarDatos();

    return () => {
      isMounted = false;
    };
  }, [clienteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const rfcLimpio = rfc.trim().toUpperCase().replace(/[^A-Z0-9&Ñ]/g, '');
    if (rfcLimpio.length < 12 || rfcLimpio.length > 13) {
      setErrorMsg('El RFC debe contener entre 12 (Persona Moral) y 13 (Persona Física) caracteres.');
      return;
    }

    if (!razonSocial.trim()) {
      setErrorMsg('La Razón Social o Nombre Fiscal oficial ante el SAT es obligatoria.');
      return;
    }

    const cpLimpio = codigoPostal.trim();
    if (!/^\d{5}$/.test(cpLimpio)) {
      setErrorMsg('El Código Postal fiscal debe contener exactamente 5 dígitos numéricos.');
      return;
    }

    if (!emailFacturacion.trim() || !emailFacturacion.includes('@') || !emailFacturacion.includes('.')) {
      setErrorMsg('Por favor ingresa un correo de facturación válido para el envío de tus CFDI.');
      return;
    }

    setSaving(true);
    try {
      const res = await actualizarDatosFiscalesCliente({
        clienteId,
        rfc: rfcLimpio,
        razonSocial: razonSocial.trim().toUpperCase(),
        regimenFiscal,
        codigoPostal: cpLimpio,
        usoCfdi,
        emailFacturacion: emailFacturacion.trim().toLowerCase(),
        telefono: telefono.trim(),
        nombreLocal: nombreLocal.trim()
      });

      if (!res.success || !res.cliente) {
        throw new Error(res.error || 'Error al guardar los datos fiscales');
      }

      setSuccessMsg('¡Tus datos fiscales se han actualizado con éxito!');
      if (onSaved) {
        onSaved(res.cliente);
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      console.error('Error al actualizar datos fiscales:', err);
      const msg = err instanceof Error ? err.message : 'Error inesperado al guardar';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[150] p-4 transition-all">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-amber-500/5 dark:bg-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">
                Mis Datos Fiscales (CFDI 4.0)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Información requerida por el SAT para emitir tus facturas electrónicas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido / Formulario */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
              <p className="text-sm font-medium">Cargando tus datos fiscales...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Notificaciones */}
              {errorMsg && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-700 dark:text-red-400 flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-xl text-xs text-green-700 dark:text-green-400 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-green-500" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Nota informativa SAT */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Aviso CFDI 4.0:</strong> La <strong>Razón Social</strong> y el <strong>Código Postal</strong> deben coincidir exactamente como aparecen en tu <em>Constancia de Situación Fiscal (CSF)</em> sin incluir el régimen societario (ej. omite &quot;S.A. de C.V.&quot;).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* RFC */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    RFC <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={13}
                    value={rfc}
                    onChange={(e) => setRfc(e.target.value.toUpperCase().replace(/[^A-Z0-9&Ñ]/g, ''))}
                    placeholder="ABCD900101XYZ"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-mono font-bold text-gray-900 dark:text-white uppercase focus:ring-2 focus:ring-amber-500 outline-none transition"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">12 dígitos para empresas o 13 para personas físicas</span>
                </div>

                {/* Código Postal */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Código Postal Fiscal <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={codigoPostal}
                      onChange={(e) => setCodigoPostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      placeholder="77500"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-mono font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Exactamente 5 dígitos de tu domicilio fiscal</span>
                </div>
              </div>

              {/* Razón Social */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Nombre o Razón Social Fiscal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value.toUpperCase())}
                  placeholder="NOMBRE FISCAL TAL COMO APARECE EN LA CONSTANCIA SAT"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-900 dark:text-white uppercase focus:ring-2 focus:ring-amber-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Régimen Fiscal */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Régimen Fiscal <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={regimenFiscal}
                    onChange={(e) => setRegimenFiscal(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition"
                  >
                    {CATALOGO_REGIMEN_FISCAL.map((reg) => (
                      <option key={reg.clave} value={reg.clave}>
                        {reg.clave} - {reg.descripcion}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Uso de CFDI */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Uso de CFDI Predeterminado <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={usoCfdi}
                    onChange={(e) => setUsoCfdi(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-xs font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition"
                  >
                    {CATALOGO_USO_CFDI.map((uso) => (
                      <option key={uso.clave} value={uso.clave}>
                        {uso.clave} - {uso.descripcion}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email de Facturación */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Correo para Facturas <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      required
                      value={emailFacturacion}
                      onChange={(e) => setEmailFacturacion(e.target.value)}
                      placeholder="facturacion@miempresa.com"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Aquí recibirás los archivos XML y PDF de tus compras</span>
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Teléfono de Contacto
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="9981234567"
                      className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Nombre Comercial / Sucursal */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Nombre Comercial / Sucursal
                </label>
                <input
                  type="text"
                  value={nombreLocal}
                  onChange={(e) => setNombreLocal(e.target.value)}
                  placeholder="Ej. Sucursal Centro"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{saving ? 'Guardando...' : 'Guardar Datos Fiscales'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
