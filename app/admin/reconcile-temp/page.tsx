'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReconcileTempPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/contabilidad');
  }, [router]);

  return <div className="p-8 text-center text-sm text-gray-500">Redireccionando...</div>;
}
