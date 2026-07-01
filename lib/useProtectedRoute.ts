import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook para proteger rutas que requieren autenticación
 * Redirige a "/" si no hay sesión en localStorage
 * 
 * Rutas públicas (no requieren sesión):
 * - / (login)
 * - /tienda (compras sin registro)
 * - /admin/login
 */
export function useProtectedRoute() {
  const router = useRouter();

  useEffect(() => {
    // Solo verificar en el cliente
    if (typeof window === 'undefined') return;

    const sesionGuardada = localStorage.getItem('seimenjo_session');
    
    if (!sesionGuardada) {
      // Sin sesión, redirigir a login
      router.push('/');
    }
  }, [router]);
}
