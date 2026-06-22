'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Building2, Landmark, ShieldCheck, Settings, UploadCloud,
  Check, AlertCircle, Loader2, Sparkles, KeyRound, FileCode
} from 'lucide-react';
import { inicializarNuevaEmpresa } from '../actions/adminAuth';

interface OnboardingWizardProps {
  empresaId: string;
  onSuccess: () => void;
}

export default function OnboardingWizard({ empresaId, onSuccess }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [subiendoArchivo, setSubiendoArchivo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Catálogo de regímenes fiscales
  const [regimenes, setRegimenes] = useState<any[]>([]);

  // --- DATOS DEL FORMULARIO ---
  // Paso 1: Perfil Comercial y Marca
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [emailContacto, setEmailContacto] = useState('');
  const [moneda, setMoneda] = useState('MXN');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Paso 2: Datos Fiscales
  const [razonSocial, setRazonSocial] = useState('');
  const [rfc, setRfc] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [selectedRegimenId, setSelectedRegimenId] = useState('');

  // Paso 3: Certificados de Sello Digital (CSD)
  const [csdCerUrl, setCsdCerUrl] = useState('');
  const [csdKeyUrl, setCsdKeyUrl] = useState('');
  const [csdPassword, setCsdPassword] = useState('');
  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);

  // Paso 4: Módulos y Parámetros
  const [modulos, setModulos] = useState<string[]>(['ventas', 'gastos', 'clientes', 'personal', 'productos', 'produccion']);

  useEffect(() => {
    const fetchRegimenes = async () => {
      try {
        const { data, error } = await supabase
          .from('regimenes_fiscales')
          .select('*')
          .order('clave');
        if (!error && data) {
          setRegimenes(data);
        }
      } catch (err) {
        console.error('Error fetching regimenes:', err);
      }
    };
    fetchRegimenes();
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setLogoFile(e.target.files[0]);
    }
  };

  const uploadLogo = async (): Promise<string> => {
    if (!logoFile) return logoUrl;
    setSubiendoArchivo('Logotipo');
    const fileExt = logoFile.name.split('.').pop();
    const filePath = `logos/${empresaId}_logo_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('empresas-logos')
      .upload(filePath, logoFile, { upsert: true });

    if (uploadError) {
      throw new Error(`Error al subir logotipo: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('empresas-logos')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const uploadCsdFiles = async (): Promise<{ cerPath: string; keyPath: string }> => {
    let cerPath = csdCerUrl;
    let keyPath = csdKeyUrl;

    if (cerFile) {
      setSubiendoArchivo('Certificado .cer');
      const cerName = `csd/${empresaId}_csd_${Date.now()}.cer`;
      const { error: cerError } = await supabase.storage
        .from('csd-private')
        .upload(cerName, cerFile, { upsert: true });

      if (cerError) throw new Error(`Error al subir certificado CER: ${cerError.message}`);
      cerPath = cerName;
    }

    if (keyFile) {
      setSubiendoArchivo('Llave privada .key');
      const keyName = `csd/${empresaId}_csd_${Date.now()}.key`;
      const { error: keyError } = await supabase.storage
        .from('csd-private')
        .upload(keyName, keyFile, { upsert: true });

      if (keyError) throw new Error(`Error al subir llave KEY: ${keyError.message}`);
      keyPath = keyName;
    }

    return { cerPath, keyPath };
  };

  const handleNextStep = () => {
    setErrorMsg('');
    if (step === 1) {
      if (!nombre.trim()) return setErrorMsg('El nombre comercial de la empresa es obligatorio.');
      if (!emailContacto.trim()) return setErrorMsg('El email de contacto es obligatorio.');
      if (!telefono.trim()) return setErrorMsg('El teléfono es obligatorio.');
    } else if (step === 2) {
      if (!rfc.trim()) return setErrorMsg('El RFC es obligatorio.');
      if (rfc.trim().length < 12 || rfc.trim().length > 13) return setErrorMsg('El RFC debe tener entre 12 y 13 caracteres.');
      if (!razonSocial.trim()) return setErrorMsg('La razón social es obligatoria.');
      if (!codigoPostal.trim()) return setErrorMsg('El código postal fiscal es obligatorio.');
      if (!selectedRegimenId) return setErrorMsg('Debes seleccionar un régimen fiscal.');
    } else if (step === 3) {
      if (!cerFile && !csdCerUrl) return setErrorMsg('El archivo de certificado (.cer) es obligatorio.');
      if (!keyFile && !csdKeyUrl) return setErrorMsg('El archivo de llave (.key) es obligatorio.');
      if (!csdPassword.trim()) return setErrorMsg('La contraseña del sello digital es obligatoria.');
    }
    setStep(step + 1);
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    setStep(step - 1);
  };

  const toggleModulo = (modName: string) => {
    setModulos(prev =>
      prev.includes(modName) ? prev.filter(m => m !== modName) : [...prev, modName]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMsg('');
    setSubiendoArchivo(null);

    try {
      // 1. Subir archivos a Storage
      const uploadedLogoUrl = await uploadLogo();
      const { cerPath, keyPath } = await uploadCsdFiles();

      setSubiendoArchivo('Guardando configuración...');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      // 2. Llamar Server Action para inicializar la empresa en BD
      const res = await inicializarNuevaEmpresa({
        empresaId,
        nombre: nombre.trim(),
        razon_social: razonSocial.trim().toUpperCase(),
        rfc: rfc.trim().toUpperCase(),
        codigo_postal: codigoPostal.trim(),
        regimen_fiscal_id: selectedRegimenId,
        email_contacto: emailContacto.trim(),
        telefono: telefono.trim(),
        moneda,
        logo_url: uploadedLogoUrl,
        logo_ticket_url: uploadedLogoUrl,
        csd_cer_url: cerPath,
        csd_key_url: keyPath,
        csd_password_encriptada: btoa(csdPassword), // Encriptación simulación básica en base64
        modulos
      }, token);

      if (!res.success) {
        throw new Error(res.error || 'Fallo al guardar la configuración');
      }

      alert('¡Empresa inicializada con éxito! Bienvenido al ERP.');
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error inesperado durante la inicialización');
    } finally {
      setLoading(false);
      setSubiendoArchivo(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl p-8 max-h-[95vh] flex flex-col transition-all">

        {/* ENCABEZADO STEPPER */}
        <div className="text-center mb-8 shrink-0">
          <div className="inline-flex p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 mb-3 text-amber-500">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Configuración Inicial de Empresa
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Completa estos sencillos pasos para activar tu tenant del ERP
          </p>
        </div>

        {/* INDICADORES DE PASOS */}
        <div className="flex justify-between items-center mb-8 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shrink-0">
          {[
            { num: 1, label: 'Marca', icon: Building2 },
            { num: 2, label: 'Fiscal', icon: Landmark },
            { num: 3, label: 'CSD', icon: KeyRound },
            { num: 4, label: 'Módulos', icon: Settings }
          ].map((s) => {
            const Icon = s.icon;
            const active = step >= s.num;
            const current = step === s.num;

            return (
              <div key={s.num} className="flex flex-col items-center gap-1.5 flex-1 relative">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border ${active
                    ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                    : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600'
                  } ${current ? 'ring-4 ring-amber-500/20 scale-110 font-bold' : ''}`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : <Icon size={14} />}
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${active ? 'text-amber-600 dark:text-amber-500' : 'text-slate-400 dark:text-slate-600'
                  }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* CONTENEDOR DE PASOS */}
        <div className="flex-1 overflow-y-auto pr-1 mb-6 space-y-4">

          {errorMsg && (
            <div className="bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border border-red-200 dark:border-red-800/30 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-semibold">{errorMsg}</p>
            </div>
          )}

          {/* PASO 1: PERFIL COMERCIAL */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Paso 1: Identidad Comercial y Marca
              </h3>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Nombre Comercial *</label>
                <input
                  type="text"
                  placeholder="Mi Empresa Ejemplo"
                  value={nombre}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 outline-none"
                  onChange={e => setNombre(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Teléfono de Contacto *</label>
                  <input
                    type="tel"
                    placeholder="9981234567"
                    value={telefono}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 outline-none"
                    onChange={e => setTelefono(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Email Comercial *</label>
                  <input
                    type="email"
                    placeholder="contacto@empresa.com"
                    value={emailContacto}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 outline-none font-mono"
                    onChange={e => setEmailContacto(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Moneda Base</label>
                  <select
                    value={moneda}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 outline-none"
                    onChange={e => setMoneda(e.target.value)}
                  >
                    <option value="MXN">Peso Mexicano (MXN)</option>
                    <option value="USD">Dólar Estadounidense (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block mb-1">Logotipo de la Empresa</label>
                  <div className="flex items-center gap-3">
                    <label className="flex flex-col items-center justify-center px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0">
                      <UploadCloud size={14} className="mr-1 inline-block" /> Seleccionar Logo
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    </label>
                    <span className="text-[11px] text-slate-500 truncate font-mono">
                      {logoFile ? logoFile.name : 'Ningún logotipo seleccionado (se usará el de sistema)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PASO 2: DATOS FISCALES */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Paso 2: Datos Fiscales de Facturación
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">RFC (Persona Física o Moral) *</label>
                  <input
                    type="text"
                    maxLength={13}
                    placeholder="RFC120101AA1"
                    value={rfc}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 outline-none uppercase font-mono"
                    onChange={e => setRfc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/gi, ''))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Código Postal Fiscal *</label>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="77500"
                    value={codigoPostal}
                    className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 outline-none font-mono"
                    onChange={e => setCodigoPostal(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Razón Social * (Mayúsculas, Sin Régimen Societario)</label>
                <input
                  type="text"
                  placeholder="RAMEN DE PLAYA"
                  value={razonSocial}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 outline-none uppercase"
                  onChange={e => setRazonSocial(e.target.value.toUpperCase())}
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Ej. "RAMEN DE PLAYA" en vez de "RAMEN DE PLAYA S.A. DE C.V."
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Régimen Fiscal (SAT 4.0) *</label>
                <select
                  value={selectedRegimenId}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 outline-none"
                  onChange={e => setSelectedRegimenId(e.target.value)}
                >
                  <option value="">Seleccione régimen fiscal...</option>
                  {regimenes.map((reg) => (
                    <option key={reg.id} value={reg.id}>{reg.clave} - {reg.descripcion}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* PASO 3: CERTIFICADOS DE SELLO DIGITAL */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                Paso 3: Carga de Certificados Digitales (CSD)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Zona de Arrastre CER */}
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-center hover:border-amber-500 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept=".cer"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={e => e.target.files && setCerFile(e.target.files[0])}
                  />
                  <FileCode className="text-amber-500 w-10 h-10 mb-2" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Certificado Fiscal (.cer)</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1 truncate max-w-full">
                    {cerFile ? cerFile.name : 'Arrastra o haz clic para subir'}
                  </span>
                </div>

                {/* Zona de Arrastre KEY */}
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-2xl bg-slate-50 dark:bg-slate-900/40 text-center hover:border-amber-500 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept=".key"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={e => e.target.files && setKeyFile(e.target.files[0])}
                  />
                  <KeyRound className="text-amber-500 w-10 h-10 mb-2" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Llave Privada (.key)</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-1 truncate max-w-full">
                    {keyFile ? keyFile.name : 'Arrastra o haz clic para subir'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Contraseña del Certificado (CSD)</label>
                <input
                  type="password"
                  placeholder="Contraseña del sello digital"
                  value={csdPassword}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/20 outline-none"
                  onChange={e => setCsdPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* PASO 4: MÓDULOS DEL SISTEMA */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Paso 4: Módulos Activos y Finalización
              </h3>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-2">Selección de Módulos Activos</label>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  {[
                    { id: 'ventas', label: 'Ventas' },
                    { id: 'gastos', label: 'Gastos' },
                    { id: 'clientes', label: 'Clientes' },
                    { id: 'personal', label: 'Personal (Staff)' },
                    { id: 'configuracion', label: 'Configuración ERP' },
                    { id: 'productos', label: 'Productos' },
                    { id: 'produccion', label: 'Producción' }
                  ].map((mod) => {
                    const isSelected = modulos.includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => toggleModulo(mod.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all ${isSelected
                            ? 'bg-amber-600/10 text-amber-700 dark:text-amber-400 border-amber-600/30'
                            : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                          }`}
                      >
                        <span>{mod.label}</span>
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 dark:border-slate-700'
                          }`}>
                          {isSelected && <Check size={10} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 text-amber-800 dark:text-amber-400 border border-amber-500/20 rounded-2xl text-[11px] leading-relaxed">
                <strong>Parámetro de Impresión Térmica Inicial:</strong> Se creará un ticket POS predeterminado con encabezado y pie de página utilizando el Nombre Comercial del Paso 1. Se podrá personalizar posteriormente.
              </div>
            </div>
          )}

        </div>

        {/* CONTROLES DE NAVEGACIÓN */}
        <div className="flex gap-4 shrink-0 border-t border-slate-100 dark:border-slate-800 pt-6 mt-auto">
          {step > 1 && (
            <button
              onClick={handlePrevStep}
              disabled={loading}
              className="flex-1 py-3 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-all disabled:opacity-50"
            >
              Atrás
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={handleNextStep}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl transition-all shadow-md"
            >
              Siguiente
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{subiendoArchivo || 'Inicializando...'}</span>
                </>
              ) : (
                'Finalizar y Activar Empresa'
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
