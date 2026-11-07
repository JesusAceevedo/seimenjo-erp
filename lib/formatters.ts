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
 * Formatea una fecha como DD/MM/AAAA (ej: "13/10/2026", "09/10/2026", "01/10/2026").
 * Soporta strings ISO ("2026-10-09", "2026-10-09T14:30:00Z"), objetos Date o timestamps.
 * Evita desfasamientos por zona horaria.
 * @example formatDate("2026-10-09") // "09/10/2026"
 */
export const formatDate = (val: string | Date | null | undefined): string => {
  if (!val) return '—';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '—';
    // Si viene como YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss...
    const matchIso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matchIso) {
      const yyyy = matchIso[1];
      const mm = matchIso[2].padStart(2, '0');
      const dd = matchIso[3].padStart(2, '0');
      return `${dd}/${mm}/${yyyy}`;
    }
    // Si viene como DD/MM/YYYY o D/M/YYYY o DD/MM/YY
    const matchSlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (matchSlash) {
      const dd = matchSlash[1].padStart(2, '0');
      const mm = matchSlash[2].padStart(2, '0');
      const rawYear = matchSlash[3];
      const yyyy = rawYear.length === 2 ? `20${rawYear}` : rawYear;
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  const d = typeof val === 'string' ? new Date(val) : val;
  if (!d || isNaN(d.getTime())) return typeof val === 'string' ? val : '—';

  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
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

/**
 * Extrae o formatea una referencia bancaria legible a partir del campo referencia y del concepto.
 * Si el campo referencia es nulo, vacío o contiene un UUID interno sintético, busca en el concepto
 * patrones como "Ref. XXXXX", "/XXXXX", "RECIBO NO. * XXXXX", etc.
 */
export const extractReferenciaBancaria = (referencia?: string | null, concepto?: string | null): string => {
  const ref = (referencia || '').trim();
  if (ref && !ref.startsWith('COMPROBANTE_EFECTIVO_')) {
    return ref;
  }
  const c = (concepto || '').trim();
  if (!c) return '';

  const matchRef = c.match(/Ref\.\s*([A-Za-z0-9_-]+)/i);
  if (matchRef && matchRef[1]) return matchRef[1];

  const matchSlash = c.match(/\/([0-9]{4,})/);
  if (matchSlash && matchSlash[1]) return matchSlash[1];

  const matchRecibo = c.match(/RECIBO\s+NO\.\s*\*\s*([0-9]+)/i);
  if (matchRecibo && matchRecibo[1]) return matchRecibo[1];

  const matchNum = c.match(/\b(00[0-9]{4,})\b/);
  if (matchNum && matchNum[1]) return matchNum[1];

  return '';
};

