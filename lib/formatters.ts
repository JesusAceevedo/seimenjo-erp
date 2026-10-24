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
 * Formatea una fecha como DD/MM/AA (ej: "13/10/26", "09/10/26", "01/10/26").
 * Soporta strings ISO ("2026-10-09", "2026-10-09T14:30:00Z"), objetos Date o timestamps.
 * Evita desfasamientos por zona horaria.
 * @example formatDate("2026-10-09") // "09/10/26"
 */
export const formatDate = (val: string | Date | null | undefined): string => {
  if (!val) return '—';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '—';
    // Si viene como YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss...
    const matchIso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matchIso) {
      const yy = matchIso[1].slice(-2);
      const mm = matchIso[2].padStart(2, '0');
      const dd = matchIso[3].padStart(2, '0');
      return `${dd}/${mm}/${yy}`;
    }
    // Si viene como DD/MM/YYYY o D/M/YYYY o DD/MM/YY
    const matchSlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (matchSlash) {
      const dd = matchSlash[1].padStart(2, '0');
      const mm = matchSlash[2].padStart(2, '0');
      const yy = matchSlash[3].slice(-2);
      return `${dd}/${mm}/${yy}`;
    }
  }

  const d = typeof val === 'string' ? new Date(val) : val;
  if (!d || isNaN(d.getTime())) return typeof val === 'string' ? val : '—';

  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'UTC',
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
