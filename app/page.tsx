'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { Building2, User, ArrowRight, AlertCircle, Loader } from 'lucide-react';

export default function AccesoPortal() {
  const router = useRouter();
  const [modo, setModo] = useState<'b2b' | 'anonimo'>('b2b');
  
  // Estados B2B
  const [rfc, setRfc] = useState('');
  
  // Estados Anónimo
  const [nombreLocal, setNombreLocal] = useState('');
  const [telefono, setTelefono] = useState('');
  
  // Estados UI
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginB2B = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfc.trim()) return;
    
    setLoading(true);
    setError('');

    const rfcLimpio = rfc.trim().toUpperCase();

    // Consulta a Supabase
    const { data, error: sbError } = await supabase
      .from('clientes')
      .select('*')
      .eq('rfc', rfcLimpio)
      .single();

    if (sbError || !data) {
      setError('RFC no encontrado en el sistema. Verifica tus datos o ingresa como Pedido Rápido.');
      setLoading(false);
      return;
    }

    // Guardar sesión B2B en localStorage
    localStorage.setItem('seimenjo_session', JSON.stringify({ ...data, tipo: 'b2b' }));
    router.push('/tienda');
  };

  const handleLoginAnonimo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreLocal.trim() || !telefono.trim()) {
      setError('Por favor completa todos los campos.');
      return;
    }

    // Guardar sesión Anónima en localStorage
    const sessionAnonima = {
      id: null,
      nombre_local: nombreLocal.trim(),
      telefono: telefono.trim(),
      es_anonimo: true,
      tipo: 'anonimo'
    };

    localStorage.setItem('seimenjo_session', JSON.stringify(sessionAnonima));
    router.push('/tienda');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-blue-50 to-white flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block mb-4 p-3 bg-blue-100 rounded-xl">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            SEIMENJO
          </h1>
          <p className="text-gray-600 font-light">
            Portal de Pedidos
          </p>
        </div>

        {/* Card Principal */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 backdrop-blur-sm">
          
          {/* Selector de Modo - Tabs minimalistas */}
          <div className="flex gap-2 mb-8 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => { setModo('b2b'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                modo === 'b2b' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Socio
            </button>
            <button
              onClick={() => { setModo('anonimo'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                modo === 'anonimo' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-4 h-4" />
              Rápido
            </button>
          </div>

          {/* Mensaje de Error */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3 animate-in fade-in duration-300">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-light">{error}</p>
            </div>
          )}

          {/* Formulario B2B */}
          {modo === 'b2b' && (
            <form className="space-y-5" onSubmit={handleLoginB2B}>
              <div>
                <label htmlFor="rfc" className="block text-sm font-medium text-gray-900 mb-2">
                  RFC del Negocio
                </label>
                <input
                  id="rfc"
                  name="rfc"
                  type="text"
                  required
                  value={rfc}
                  onChange={(e) => setRfc(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 focus:border-blue-500"
                  placeholder="XAXX010101000"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    Acceder al Catálogo
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Formulario Anónimo */}
          {modo === 'anonimo' && (
            <form className="space-y-6" onSubmit={handleLoginAnonimo}>
              <div>
                <label htmlFor="nombreLocal" className="block text-sm font-medium text-gray-900 mb-2">
                  Nombre del Local / Restaurante
                </label>
                <input
                  id="nombreLocal"
                  name="nombreLocal"
                  type="text"
                  required
                  value={nombreLocal}
                  onChange={(e) => setNombreLocal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 focus:border-blue-500"
                  placeholder="Ej. Ichiraku Ramen"
                />
              </div>

              <div>
                <label htmlFor="telefono" className="block text-sm font-medium text-gray-900 mb-2">
                  Teléfono de Contacto
                </label>
                <input
                  id="telefono"
                  name="telefono"
                  type="tel" 
                  pattern="[0-9]{10}" 
                  title="El teléfono debe tener 10 dígitos numéricos"
                  required
                  onChange={(e) => setTelefono(e.target.value.replace(/[^0-9]/g, ''))} // Limpia texto al vuelo                  required
                                    placeholder="984 123 4567"


                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Continuar sin registro
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer minimalista */}
      <p className="text-center text-gray-500 text-xs mt-8 font-light">
        © 2025 SEIMENJO. Todos los derechos reservados.
      </p>
    </div>
  );
}