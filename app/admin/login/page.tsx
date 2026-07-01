'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { LogIn, AlertCircle, Loader, Sun, Moon } from 'lucide-react';
import { useThemeMode } from '../../../lib/useThemeMode';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const { isDarkMode, toggleDarkMode } = useThemeMode();
  const router = useRouter();

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
            Panel de Administración
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
                placeholder="admin@seimenjo.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Contraseña
              </label>
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
                  Ingresar al Panel
                  <LogIn className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <p className="text-center text-gray-500 dark:text-gray-400 text-xs mt-8 font-light">
        © 2025 SEIMENJO Admin. Todos los derechos reservados.
      </p>
    </div>
  );
}