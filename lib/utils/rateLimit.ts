/**
 * lib/utils/rateLimit.ts
 * Rate limiting en memoria ligero y seguro para Next.js Server Actions y API Routes.
 */

interface RateLimitRecord {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

interface RateLimitOptions {
  windowMs: number; // Ventana de tiempo en milisegundos
  maxRequests: number; // Máximo de solicitudes por ventana
  minIntervalMs?: number; // Cooldown mínimo entre solicitudes consecutivas
}

const store = new Map<string, RateLimitRecord>();

// Limpieza periódica para evitar fugas de memoria
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Cada 10 minutos
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, record] of store.entries()) {
    if (now - record.lastRequest > windowMs * 2) {
      store.delete(key);
    }
  }
}

/**
 * Verifica si una clave (IP, email, etc.) ha superado el rate limit.
 * @returns { allowed: boolean, remaining: number, retryAfterSec?: number, message?: string }
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): { allowed: boolean; remaining: number; retryAfterSec?: number; message?: string } {
  cleanupStaleEntries(options.windowMs);

  const now = Date.now();
  const record = store.get(key);

  if (!record) {
    store.set(key, { count: 1, firstRequest: now, lastRequest: now });
    return { allowed: true, remaining: options.maxRequests - 1 };
  }

  // Verificar intervalo mínimo (cooldown)
  if (options.minIntervalMs && now - record.lastRequest < options.minIntervalMs) {
    const retryAfterSec = Math.ceil((options.minIntervalMs - (now - record.lastRequest)) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
      message: `Por favor espera ${retryAfterSec} segundo(s) antes de intentar de nuevo.`
    };
  }

  // Si la ventana expiró, reiniciar contador
  if (now - record.firstRequest > options.windowMs) {
    record.count = 1;
    record.firstRequest = now;
    record.lastRequest = now;
    return { allowed: true, remaining: options.maxRequests - 1 };
  }

  // Si aún está dentro de la ventana
  if (record.count >= options.maxRequests) {
    const retryAfterSec = Math.ceil((options.windowMs - (now - record.firstRequest)) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec,
      message: `Has superado el límite de intentos permitidos. Intenta nuevamente en ${Math.ceil(retryAfterSec / 60)} minuto(s).`
    };
  }

  record.count += 1;
  record.lastRequest = now;
  return {
    allowed: true,
    remaining: options.maxRequests - record.count
  };
}

/**
 * Resetea el contador para una clave específica (útil cuando una acción tiene éxito).
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
