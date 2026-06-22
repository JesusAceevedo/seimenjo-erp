'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  FileText, UploadCloud, Eye, RefreshCw, AlertTriangle,
  CheckCircle, Trash2, Link as LinkIcon, QrCode, Sliders, X
} from 'lucide-react';

interface ConfigTicket {
  id: string;
  encabezado: string;
  pie_pagina: string;
  logo_url: string | null;
  promo_tipo: 'imagen' | 'qr' | 'ninguno';
  promo_imagen_url: string | null;
  promo_qr_link: string | null;
  promo_qr_descripcion: string | null;
  opciones_visualizacion: {
    mostrar_telefono: boolean;
    mostrar_facturacion: boolean;
    mostrar_comentarios: boolean;
  };
}

const DEFAULT_CONFIG: ConfigTicket = {
  id: 'd3b07384-d113-44f2-a270-2094c48970e5',
  encabezado: '',
  pie_pagina: '',
  logo_url: null,
  promo_tipo: 'ninguno',
  promo_imagen_url: null,
  promo_qr_link: null,
  promo_qr_descripcion: null,
  opciones_visualizacion: {
    mostrar_telefono: true,
    mostrar_facturacion: true,
    mostrar_comentarios: true
  }
};

export default function TicketConfigTab() {
  const [config, setConfig] = useState<ConfigTicket>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  // --- ARCHIVOS ---
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [promoFile, setPromoFile] = useState<File | null>(null);
  const [promoPreview, setPromoPreview] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const promoInputRef = useRef<HTMLInputElement>(null);

  // --- ERRORES Y ÉXITOS ---
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const getEmpresa = async () => {
      let activeEmpId = null;
      const sessionData = localStorage.getItem('seimenjo_session');
      if (sessionData) {
        try {
          const datosSesion = JSON.parse(sessionData);
          activeEmpId = datosSesion.empresa_id;
        } catch (e) {}
      }
      if (!activeEmpId) {
        const { data: { user } } = await supabase.auth.getUser();
        activeEmpId = user?.user_metadata?.empresa_id;
      }
      setEmpresaId(activeEmpId);
    };
    getEmpresa();
  }, []);

  // --- CARGA DE CONFIGURACIÓN ---
  const loadConfig = async () => {
    if (!empresaId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('configuracion_ticket')
        .select('*')
        .eq('id', empresaId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        // Formatear opciones_visualizacion por si viene vacío
        const opciones = data.opciones_visualizacion || DEFAULT_CONFIG.opciones_visualizacion;
        setConfig({
          ...data,
          opciones_visualizacion: {
            mostrar_telefono: opciones.mostrar_telefono ?? true,
            mostrar_facturacion: opciones.mostrar_facturacion ?? true,
            mostrar_comentarios: opciones.mostrar_comentarios ?? true
          }
        });
        if (data.logo_url) setLogoPreview(data.logo_url);
        if (data.promo_imagen_url) setPromoPreview(data.promo_imagen_url);
      } else {
        setConfig({
          ...DEFAULT_CONFIG,
          id: empresaId
        });
        setLogoPreview(null);
        setPromoPreview(null);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al obtener la configuración de tickets: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (empresaId) {
      loadConfig();
    }
  }, [empresaId]);

  // --- VALIDADOR DE IMAGEN (JPG, Tamaño, Dimensiones) ---
  const validateImage = (
    file: File,
    maxSizeKB: number,
    minDim: number,
    maxDim: number
  ): Promise<{ valid: boolean; error: string | null }> => {
    return new Promise((resolve) => {
      // 1. Tipo de archivo
      if (file.type !== 'image/jpeg' && !file.name.toLowerCase().endsWith('.jpg') && !file.name.toLowerCase().endsWith('.jpeg')) {
        resolve({ valid: false, error: 'El archivo debe ser una imagen en formato JPG (.jpg / .jpeg)' });
        return;
      }

      // 2. Tamaño en KB
      const fileSizeKB = file.size / 1024;
      if (fileSizeKB > maxSizeKB) {
        resolve({ valid: false, error: `El archivo supera el tamaño máximo permitido de ${maxSizeKB} KB (Peso actual: ${fileSizeKB.toFixed(1)} KB)` });
        return;
      }

      // 3. Dimensiones de pixeles
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const width = img.naturalWidth;
          const height = img.naturalHeight;
          if (width < minDim || width > maxDim || height < minDim || height > maxDim) {
            resolve({
              valid: false,
              error: `Dimensiones inválidas: ${width}x${height}px. Debe tener dimensiones cuadradas mínimas de ${minDim}px y máximas de ${maxDim}px.`
            });
          } else {
            resolve({ valid: true, error: null });
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // --- SELECCIONAR LOGO ---
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const validation = await validateImage(file, 700, 250, 500);
    if (!validation.valid) {
      setErrorMsg(validation.error);
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  // --- SELECCIONAR IMAGEN PROMO ---
  const handlePromoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const validation = await validateImage(file, 300, 250, 500);
    if (!validation.valid) {
      setErrorMsg(validation.error);
      if (promoInputRef.current) promoInputRef.current.value = '';
      return;
    }

    setPromoFile(file);
    setPromoPreview(URL.createObjectURL(file));
  };

  // --- SUBIDA A STORAGE ---
  const uploadAsset = async (file: File, prefix: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `tickets/${prefix}_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('ticket-assets')
      .upload(fileName, file);

    if (error) throw new Error(`Fallo al cargar ${prefix} al storage: ${error.message}`);

    const { data: publicUrlData } = supabase.storage
      .from('ticket-assets')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  };

  // --- ACCIÓN: GUARDAR CONFIGURACIÓN ---
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let finalLogoUrl = config.logo_url;
      let finalPromoImageUrl = config.promo_imagen_url;

      // 1. Subir logotipo si hay archivo seleccionado
      if (logoFile) {
        finalLogoUrl = await uploadAsset(logoFile, 'logo');
      }

      // 2. Subir imagen promocional si hay archivo y el tipo es 'imagen'
      if (promoFile && config.promo_tipo === 'imagen') {
        finalPromoImageUrl = await uploadAsset(promoFile, 'promo');
      }

      // 3. Upsert en base de datos
      const payload = {
        id: empresaId || config.id,
        encabezado: config.encabezado.trim(),
        pie_pagina: config.pie_pagina.trim(),
        logo_url: finalLogoUrl,
        promo_tipo: config.promo_tipo,
        promo_imagen_url: config.promo_tipo === 'imagen' ? finalPromoImageUrl : null,
        promo_qr_link: config.promo_tipo === 'qr' ? config.promo_qr_link?.trim() : null,
        promo_qr_descripcion: config.promo_tipo === 'qr' ? config.promo_qr_descripcion?.trim() : null,
        opciones_visualizacion: config.opciones_visualizacion
      };

      const { error } = await supabase
        .from('configuracion_ticket')
        .upsert(payload);

      if (error) throw error;

      setSuccessMsg('Configuración de tickets guardada con éxito.');
      setLogoFile(null);
      setPromoFile(null);
      await loadConfig();
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al guardar configuración: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = () => {
    setConfig(prev => ({ ...prev, logo_url: null }));
    setLogoPreview(null);
    setLogoFile(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleRemovePromoImage = () => {
    setConfig(prev => ({ ...prev, promo_imagen_url: null }));
    setPromoPreview(null);
    setPromoFile(null);
    if (promoInputRef.current) promoInputRef.current.value = '';
  };

  // Generador de QR URL
  const qrPreviewUrl = config.promo_qr_link
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(config.promo_qr_link)}`
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <RefreshCw className="animate-spin mr-2" /> Cargando configuración de ticket...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

      {/* FORMULARIO DE CONFIGURACIÓN */}
      <div className="lg:col-span-2 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sliders className="text-amber-500" size={20} />
            Personalización de Tickets POS
          </h3>
          <p className="text-xs text-gray-400 mt-1 font-sans">
            Configura el encabezado, pie de página, logotipo y promociones del ticket de tus locales.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-850 dark:text-red-405 border border-red-200 dark:border-red-900/50 rounded-xl text-xs flex gap-2">
            <AlertTriangle className="shrink-0 w-4 h-4 mt-0.5 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs flex gap-2">
            <CheckCircle className="shrink-0 w-4 h-4 mt-0.5 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-6 font-sans">
          {/* 1. ENCABEZADO Y PIE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Encabezado del recibo (Max 255 car.)</label>
              <textarea
                rows={3}
                placeholder="Razón Social, RFC, Dirección..."
                value={config.encabezado}
                maxLength={255}
                className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-950 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                onChange={e => setConfig({ ...config, encabezado: e.target.value })}
                required
              />
              <span className="text-[9px] text-gray-400 float-right mt-1">{config.encabezado.length}/255</span>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">Pie de página del recibo (Max 255 car.)</label>
              <textarea
                rows={3}
                placeholder="Mensaje de agradecimiento, redes sociales..."
                value={config.pie_pagina}
                maxLength={255}
                className="w-full mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-2.5 rounded-xl text-xs text-gray-950 dark:text-white focus:ring-1 focus:ring-amber-500 outline-none"
                onChange={e => setConfig({ ...config, pie_pagina: e.target.value })}
                required
              />
              <span className="text-[9px] text-gray-400 float-right mt-1">{config.pie_pagina.length}/255</span>
            </div>
          </div>

          {/* 2. LOGOTIPO */}
          <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-150 dark:border-gray-800 rounded-xl space-y-3">
            <div>
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Logotipo de Ticket</h4>
              <p className="text-[10px] text-gray-400">Debe ser JPG cuadrado, máximo 700 KB, dimensiones entre 250px y 500px.</p>
            </div>

            <div className="flex gap-4 items-center">
              {logoPreview ? (
                <div className="relative w-24 h-24 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden flex items-center justify-center shadow-inner">
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="w-full h-full object-contain filter grayscale"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white p-1 rounded-full shadow"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : (
                <div className="relative w-24 h-24 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 p-2">
                  <input
                    type="file"
                    accept=".jpg,.jpeg"
                    ref={logoInputRef}
                    onChange={handleLogoChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud size={18} className="text-gray-400 mb-1" />
                  <span className="text-[9px] font-semibold text-gray-600 dark:text-gray-350 leading-tight">Subir JPG</span>
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                  ⚠️ Blanco y Negro requerido
                </span>
                <p className="text-[10px] text-gray-400">La vista previa aplica escala de grises de forma automática para simular el resultado térmico.</p>
              </div>
            </div>
          </div>

          {/* 3. SECCIÓN PROMOCIONAL (TABS) */}
          <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-150 dark:border-gray-800 rounded-xl space-y-4">
            <div>
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Sección Promocional (Final del Ticket)</h4>
              <p className="text-[10px] text-gray-400">Añade incentivos como una imagen promocional o un código QR dinámico.</p>
            </div>

            {/* Selector de Tipo Promocional */}
            <div className="flex gap-2">
              {(['ninguno', 'imagen', 'qr'] as const).map(tipo => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setConfig({ ...config, promo_tipo: tipo })}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border capitalize transition-all ${config.promo_tipo === tipo
                      ? 'bg-amber-600/10 text-amber-600 border-amber-500/40'
                      : 'bg-white dark:bg-gray-950 text-gray-500 border-gray-200 dark:border-gray-800'
                    }`}
                >
                  {tipo === 'qr' ? 'Código QR' : tipo === 'imagen' ? 'Imagen Promocional' : 'Ninguno'}
                </button>
              ))}
            </div>

            {/* TAB: IMAGEN */}
            {config.promo_tipo === 'imagen' && (
              <div className="flex gap-4 items-center animate-in fade-in slide-in-from-top-1.5 duration-200">
                {promoPreview ? (
                  <div className="relative w-24 h-24 bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden flex items-center justify-center">
                    <img
                      src={promoPreview}
                      alt="Promo"
                      className="w-full h-full object-contain filter grayscale"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePromoImage}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white p-1 rounded-full shadow"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="relative w-24 h-24 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 p-2">
                    <input
                      type="file"
                      accept=".jpg,.jpeg"
                      ref={promoInputRef}
                      onChange={handlePromoChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud size={18} className="text-gray-400 mb-1" />
                    <span className="text-[9px] font-semibold text-gray-600 dark:text-gray-350 leading-tight">Subir Promo</span>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                    ⚠️ Imagen Blanco y Negro (Max 300 KB)
                  </span>
                  <p className="text-[10px] text-gray-400">JPG de 250px a 500px. Grayscale simulado en el visor.</p>
                </div>
              </div>
            )}

            {/* TAB: QR */}
            {config.promo_tipo === 'qr' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1.5 duration-200">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Enlace/Link del QR *</label>
                    <div className="relative mt-1">
                      <LinkIcon className="absolute left-2.5 top-2 text-gray-400" size={14} />
                      <input
                        type="url"
                        placeholder="https://instagram.com/mi_local"
                        value={config.promo_qr_link || ''}
                        className="w-full bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 pl-8 rounded-lg text-xs text-gray-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                        onChange={e => setConfig({ ...config, promo_qr_link: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Descripción de Código QR (Max 255 car.)</label>
                    <input
                      type="text"
                      placeholder="Escanea para obtener 10% de descuento..."
                      value={config.promo_qr_descripcion || ''}
                      maxLength={255}
                      className="w-full mt-1 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 p-2 rounded-lg text-xs text-gray-950 dark:text-white focus:outline-none"
                      onChange={e => setConfig({ ...config, promo_qr_descripcion: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 shadow-inner">
                  {qrPreviewUrl ? (
                    <>
                      <img
                        src={qrPreviewUrl}
                        alt="QR Preview"
                        className="w-28 h-28 object-contain"
                      />
                      <span className="text-[9px] text-gray-400 mt-1 italic">Previsualización QR automática</span>
                    </>
                  ) : (
                    <div className="text-center text-gray-400 py-6">
                      <QrCode size={36} className="mx-auto opacity-35 mb-1" />
                      <span className="text-[10px]">Ingresa una URL para previsualizar el QR</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. CHECKBOXES DE VISUALIZACIÓN */}
          <div className="p-4 bg-gray-50/50 dark:bg-gray-900/40 border border-gray-150 dark:border-gray-800 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Opciones de Impresión del Recibo</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 bg-white dark:bg-gray-950 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.opciones_visualizacion.mostrar_telefono}
                  className="rounded text-amber-500 focus:ring-amber-500 bg-gray-50 dark:bg-gray-900 w-4 h-4"
                  onChange={e => setConfig({
                    ...config,
                    opciones_visualizacion: {
                      ...config.opciones_visualizacion,
                      mostrar_telefono: e.target.checked
                    }
                  })}
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Mostrar Teléfono</span>
              </label>

              <label className="flex items-center gap-2 bg-white dark:bg-gray-950 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.opciones_visualizacion.mostrar_facturacion}
                  className="rounded text-amber-500 focus:ring-amber-500 bg-gray-50 dark:bg-gray-900 w-4 h-4"
                  onChange={e => setConfig({
                    ...config,
                    opciones_visualizacion: {
                      ...config.opciones_visualizacion,
                      mostrar_facturacion: e.target.checked
                    }
                  })}
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Datos Facturación</span>
              </label>

              <label className="flex items-center gap-2 bg-white dark:bg-gray-950 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.opciones_visualizacion.mostrar_comentarios}
                  className="rounded text-amber-500 focus:ring-amber-500 bg-gray-50 dark:bg-gray-900 w-4 h-4"
                  onChange={e => setConfig({
                    ...config,
                    opciones_visualizacion: {
                      ...config.opciones_visualizacion,
                      mostrar_comentarios: e.target.checked
                    }
                  })}
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Mostrar Comentarios</span>
              </label>
            </div>
          </div>

          {/* BOTÓN DE ACCIÓN */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <RefreshCw className="animate-spin w-4 h-4" /> Guardando configuración...
              </>
            ) : (
              <>
                <RefreshCw size={16} /> Guardar Ajustes de Recibo
              </>
            )}
          </button>
        </form>
      </div>

      {/* VISUALIZADOR DEL TICKET (THERMAL RECEIPT PREVIEW) */}
      <div className="lg:col-span-1 bg-yellow-50/20 dark:bg-yellow-950/5 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col space-y-4">
        <h4 className="text-sm font-bold uppercase text-gray-500 tracking-wider flex items-center gap-1.5">
          <Eye size={16} /> Previsualización en Vivo POS
        </h4>

        {/* Ticket Container */}
        <div className="bg-white text-black p-5 border border-gray-350 shadow-md flex-1 font-mono text-xs max-w-[280px] mx-auto w-full select-none" style={{ minHeight: '400px' }}>
          <div className="text-center space-y-2">
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo"
                className="w-20 h-20 object-contain mx-auto filter grayscale"
              />
            )}
            <p className="font-bold whitespace-pre-wrap uppercase text-[11px] leading-tight">
              {config.encabezado || 'MI LOCAL COMIDA'}
            </p>
          </div>

          <div className="border-t border-dashed border-black my-3"></div>

          <div className="space-y-0.5 text-[10px]">
            <p><strong>Pedido:</strong> #12345</p>
            <p><strong>Fecha:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Cliente:</strong> Cliente B2B Ejemplo</p>
            {config.opciones_visualizacion.mostrar_telefono && <p>Tel: 9988776655</p>}
            {config.opciones_visualizacion.mostrar_facturacion && <p>RFC: RFC010101AA1</p>}
          </div>

          <div className="border-t border-dashed border-black my-3"></div>

          {/* Desglose */}
          <table className="w-full text-[10px]">
            <tbody>
              <tr>
                <td className="py-1">2x Fideo Vegano FRB (1 Pz)</td>
                <td className="text-right py-1 font-semibold">$32.00</td>
              </tr>
              <tr>
                <td className="py-1">1x Gyoza RMN (1 Pq)</td>
                <td className="text-right py-1 font-semibold">$80.00</td>
              </tr>
            </tbody>
          </table>

          <div className="border-t border-dashed border-black my-3"></div>

          {/* Totales */}
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>$112.00</span>
            </div>
            <div className="flex justify-between">
              <span>Costo Envío:</span>
              <span>$25.00</span>
            </div>
            <div className="flex justify-between font-bold text-xs">
              <span>TOTAL:</span>
              <span>$137.00</span>
            </div>
          </div>

          {config.opciones_visualizacion.mostrar_comentarios && (
            <>
              <div className="border-t border-dashed border-black my-3"></div>
              <p className="text-[9px] italic">Comentarios: Entregar sin salsa picante.</p>
            </>
          )}

          <div className="border-t border-dashed border-black my-3"></div>

          {/* Promo */}
          {config.promo_tipo === 'imagen' && promoPreview && (
            <div className="text-center py-2">
              <img
                src={promoPreview}
                alt="Promo"
                className="w-24 h-24 object-contain mx-auto filter grayscale"
              />
              <span className="text-[8px] text-gray-400 font-sans mt-0.5 block">Promo final de ticket</span>
            </div>
          )}

          {config.promo_tipo === 'qr' && qrPreviewUrl && (
            <div className="text-center space-y-1.5 py-1">
              <img
                src={qrPreviewUrl}
                alt="QR Code"
                className="w-20 h-20 object-contain mx-auto"
              />
              {config.promo_qr_descripcion && (
                <p className="text-[9px] font-bold leading-tight max-w-[150px] mx-auto uppercase">
                  {config.promo_qr_descripcion}
                </p>
              )}
            </div>
          )}

          <div className="border-t border-dashed border-black my-3"></div>

          <p className="text-center text-[9px] leading-tight whitespace-pre-wrap mt-2">
            {config.pie_pagina || 'Gracias por visitarnos'}
          </p>
        </div>
      </div>

    </div>
  );
}
