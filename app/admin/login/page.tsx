'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { LogIn, AlertCircle, Loader, Sun, Moon, KeyRound, ArrowLeft, CheckCircle2, Mail, ShieldCheck, RefreshCw } from 'lucide-react';
import { useThemeMode } from '../../../lib/useThemeMode';
import { solicitarCodigoRecuperacion, verificarCodigoYCambiarPassword } from '../actions/passwordRecovery';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const router = useRouter();

  // Estados para recuperación de contraseña
  const [modalRecuperarOpen, setModalRecuperarOpen] = useState(false);
  const [recuperarPaso, setRecuperarPaso] = useState<1 | 2>(1);
  const [recuperarEmail, setRecuperarEmail] = useState('');
  const [recuperarCodigo, setRecuperarCodigo] = useState('');
  const [recuperarPassword, setRecuperarPassword] = useState('');
  const [recuperarPasswordConfirm, setRecuperarPasswordConfirm] = useState('');
  const [recuperarLoading, setRecuperarLoading] = useState(false);
  const [recuperarError, setRecuperarError] = useState('');
  const [recuperarSuccess, setRecuperarSuccess] = useState('');

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data } = await supabase
          .from('configuracion_ticket')
          .select('logo_url')
          .limit(1)
          .maybeSingle();
        if (data?.logo_url && data.logo_url !== 'null' && data.logo_url !== 'undefined') {
          setLogoUrl(data.logo_url);
          setLogoError(false);
        } else {
          setLogoUrl(null);
        }
      } catch (err) {
        console.error('Error fetching logo for login:', err);
      }
    };
    fetchLogo();
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 1. Autenticar en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      setError(authError?.message || 'Usuario no encontrado');
      setLoading(false);
      return;
    }

    // 2. Depuración: Ver qué UUID recibimos
    console.log("UUID de Auth:", authData.user.id);
    
    // 3. Validar tipo de usuario desde metadata
    const tipoUsuario = authData.user.user_metadata?.tipo_usuario;
    const clienteId = authData.user.user_metadata?.cliente_id;

    if (tipoUsuario === 'cliente' && clienteId) {
      // Obtener la sucursal (empresa_id) a la cual está asociado el cliente
      const { data: clientData } = await supabase
        .from('clientes')
        .select('empresa_id')
        .eq('id', clienteId)
        .maybeSingle();

      // Registrar sesión de cliente con empresa_id
      localStorage.setItem('seimenjo_session', JSON.stringify({
        id: clienteId,
        tipo: 'b2b',
        email: authData.user.email,
        empresa_id: clientData?.empresa_id || null
      }));
      router.push('/tienda');
      setLoading(false);
      return;
    }
    
    // De lo contrario, validar si es Staff (cualquier staff con registro en usuarios_staff)
    const { data: staff, error: staffError } = await supabase
      .from('usuarios_staff')
      .select('id, es_superusuario, empresa_id')
      .eq('supabase_auth_id', authData.user.id)
      .maybeSingle();

    if (staffError) {
      console.error("Error al buscar staff:", staffError);
    }

    console.log("Resultado de búsqueda en staff:", staff);

    if (staff) {
      localStorage.setItem('seimenjo_session', JSON.stringify({
        id: authData.user.id,
        tipo: 'staff',
        email: authData.user.email,
        es_superusuario: staff.es_superusuario,
        empresa_id: staff.empresa_id
      }));
      router.push('/admin/monitor');
    } else {
      setError('Acceso denegado. No tienes permisos asignados.');
      await supabase.auth.signOut();
    }
    setLoading(false);
  };

  const abrirModalRecuperacion = () => {
    setRecuperarEmail(email.trim());
    setRecuperarPaso(1);
    setRecuperarCodigo('');
    setRecuperarPassword('');
    setRecuperarPasswordConfirm('');
    setRecuperarError('');
    setRecuperarSuccess('');
    setModalRecuperarOpen(true);
  };

  const handleSolicitarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecuperarLoading(true);
    setRecuperarError('');
    setRecuperarSuccess('');

    try {
      const res = await solicitarCodigoRecuperacion(recuperarEmail);
      if (!res.success) {
        setRecuperarError(res.error || 'Error al enviar código');
      } else {
        setRecuperarPaso(2);
        setRecuperarSuccess(`Código enviado a ${recuperarEmail}. Revisa tu bandeja de entrada.`);
      }
    } catch (err: any) {
      setRecuperarError(err.message || 'Error inesperado');
    } finally {
      setRecuperarLoading(false);
    }
  };

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecuperarLoading(true);
    setRecuperarError('');

    if (recuperarPassword.length < 6) {
      setRecuperarError('La contraseña debe tener al menos 6 caracteres.');
      setRecuperarLoading(false);
      return;
    }

    if (recuperarPassword !== recuperarPasswordConfirm) {
      setRecuperarError('Las contraseñas no coinciden.');
      setRecuperarLoading(false);
      return;
    }

    try {
      const res = await verificarCodigoYCambiarPassword(
        recuperarEmail,
        recuperarCodigo,
        recuperarPassword
      );

      if (!res.success) {
        setRecuperarError(res.error || 'Error al restablecer la contraseña');
      } else {
        setRecuperarSuccess('¡Tu contraseña ha sido actualizada con éxito! Redirigiendo...');
        setTimeout(() => {
          setEmail(recuperarEmail);
          setPassword('');
          setModalRecuperarOpen(false);
          setRecuperarPaso(1);
          setRecuperarCodigo('');
          setRecuperarPassword('');
          setRecuperarPasswordConfirm('');
          setRecuperarSuccess('');
        }, 2000);
      }
    } catch (err: any) {
      setRecuperarError(err.message || 'Error inesperado');
    } finally {
      setRecuperarLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white flex flex-col justify-center items-center px-4 py-12 transition-colors">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-amber-400 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            aria-label="Cambiar modo de color"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl && !logoError ? (
            <img src={logoUrl} alt="Logo" onError={() => setLogoError(true)} className="w-16 h-16 rounded-2xl object-contain border border-amber-500/20 bg-white mx-auto mb-4" />
          ) : (
            <div className="inline-flex mb-4 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
              <LogIn className="w-8 h-8 text-amber-400" />
            </div>
          )}
          <h1 className="text-4xl font-bold mb-2">
            SEIMENJO
          </h1>
          <p className="text-gray-600 dark:text-gray-300 font-light">
            Portal de Acceso
          </p>
        </div>

        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-[0_20px_80px_rgba(15,23,42,0.2)] dark:shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-800 p-4 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-200 font-light">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                placeholder="tu@correo.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={abrirModalRecuperacion}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold py-3 px-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  Ingresar
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* MODAL DE RECUPERACIÓN DE CONTRASEÑA */}
      {modalRecuperarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                <ShieldCheck className="w-5 h-5" />
                <span>Recuperar Contraseña</span>
              </div>
              <button
                type="button"
                onClick={() => setModalRecuperarOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-bold px-2 py-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {recuperarError && (
              <div className="mb-4 bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-800 p-3 rounded-lg flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-200">{recuperarError}</p>
              </div>
            )}

            {recuperarSuccess && (
              <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-3 rounded-lg flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 dark:text-emerald-300">{recuperarSuccess}</p>
              </div>
            )}

            {recuperarPaso === 1 ? (
              /* PASO 1: SOLICITAR CÓDIGO */
              <form onSubmit={handleSolicitarCodigo} className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Ingresa tu correo electrónico registrado. Te enviaremos un código de seguridad de 6 dígitos para restablecer tu contraseña.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Correo Electrónico
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={recuperarEmail}
                      onChange={(e) => setRecuperarEmail(e.target.value)}
                      placeholder="cliente@ejemplo.com"
                      className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalRecuperarOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={recuperarLoading || !recuperarEmail.trim()}
                    className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {recuperarLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Enviar Código'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* PASO 2: INGRESAR CÓDIGO Y NUEVA CONTRASEÑA */
              <form onSubmit={handleCambiarPassword} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Código enviado a: <strong className="text-gray-800 dark:text-gray-200">{recuperarEmail}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setRecuperarPaso(1); setRecuperarError(''); }}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" /> Cambiar
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Código de Verificación (6 dígitos)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={recuperarCodigo}
                    onChange={(e) => setRecuperarCodigo(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full text-center tracking-[8px] font-mono text-xl py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                  />
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 text-center">
                    Válido por 15 minutos. Revisa también tu carpeta de Spam.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={recuperarPassword}
                    onChange={(e) => setRecuperarPassword(e.target.value)}
                    placeholder="Al menos 6 caracteres"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={recuperarPasswordConfirm}
                    onChange={(e) => setRecuperarPasswordConfirm(e.target.value)}
                    placeholder="Repite la contraseña"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSolicitarCodigo}
                    disabled={recuperarLoading}
                    className="py-2.5 px-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-xs transition-colors flex items-center justify-center gap-1"
                    title="Reenviar código de verificación"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${recuperarLoading ? 'animate-spin' : ''}`} />
                    Reenviar
                  </button>
                  <button
                    type="submit"
                    disabled={recuperarLoading || recuperarCodigo.length < 6 || !recuperarPassword}
                    className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {recuperarLoading ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        Restablecer Contraseña
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-gray-500 dark:text-gray-400 text-xs mt-8 font-light">
        © 2025 SEIMENJO Admin. Todos los derechos reservados.
      </p>
    </div>
  );
}