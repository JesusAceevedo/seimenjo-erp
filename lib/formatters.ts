// lib/formatters.ts
// Funciones de formato compartidas en todo el ERP.

/**
 * Formatea un número como moneda MXN.
 * @example formatCurrency(1234.5) // "$1,234.50"
 */
export const formatCurrency = (val: number | string | null | undefined): string => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(num);
};

/**
 * Formatea una fecha ISO como dd/mm/yyyy (zona local).
 * @example formatDate("2026-06-19") // "19/06/2026"
 */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Abrevia un UUID para mostrar en tablas.
 * @example shortUuid("550e8400-e29b-41d4-a716-446655440000") // "550e8400..."
 */
export const shortUuid = (uuid: string | null | undefined, len = 8): string => {
  if (!uuid) return '—';
  return uuid.length > len ? `${uuid.substring(0, len)}…` : uuid;
};
