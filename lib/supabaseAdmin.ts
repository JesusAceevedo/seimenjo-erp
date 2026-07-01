// lib/supabaseAdmin.ts
// Cliente Supabase con Service Role compartido por todos los Server Actions.
// Solo se debe importar desde archivos 'use server' o rutas de API.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// ---------------------------------------------------------------------------
// Helper: Validar token de usuario y retornar empresaId + userId
// ---------------------------------------------------------------------------
export async function getUserEmpresaId(token: string): Promise<{ empresaId: string; userId: string }> {
  if (!token) throw new Error('Usuario no autenticado (Token no proporcionado).');

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) throw new Error('Sesión de usuario inválida o expirada.');

  const { data: staff, error: staffErr } = await supabaseAdmin
    .from('usuarios_staff')
    .select('empresa_id')
    .eq('supabase_auth_id', user.id)
    .single();

  if (staffErr || !staff) throw new Error('No se encontró el perfil de staff asociado a tu cuenta.');
  return { empresaId: staff.empresa_id, userId: user.id };
}

// Helper para validar staff, empresa y privilegios de superusuario
export async function verifyStaffUser(token: string): Promise<{ empresaId: string | null; userId: string; esSuperusuario: boolean }> {
  if (!token) throw new Error('Usuario no autenticado (Token no proporcionado).');

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) throw new Error('Sesión de usuario inválida o expirada.');

  const { data: staff, error: staffErr } = await supabaseAdmin
    .from('usuarios_staff')
    .select('empresa_id, es_superusuario')
    .eq('supabase_auth_id', user.id)
    .single();

  if (staffErr || !staff) throw new Error('No se encontró el perfil de staff asociado a tu cuenta.');
  return { empresaId: staff.empresa_id, userId: user.id, esSuperusuario: !!staff.es_superusuario };
}

// ---------------------------------------------------------------------------
// Helper: Mapear código SAT de forma de pago a ID en BD
// ---------------------------------------------------------------------------
export async function getFormaPagoIdByCode(code: string): Promise<string | null> {
  try {
    const cleanCode = code ? code.trim().padStart(2, '0') : '99';
    // 1. Intentar coincidencia directa por la columna codigo
    const { data: directMatch } = await supabaseAdmin
      .from('formas_pago')
      .select('id')
      .eq('codigo', cleanCode)
      .maybeSingle();

    if (directMatch) return directMatch.id;

    // 2. Si no hay coincidencia directa, obtener todo el catálogo para fallbacks
    const { data: allFp } = await supabaseAdmin.from('formas_pago').select('id, nombre, codigo');
    if (!allFp || allFp.length === 0) return null;

    let match = allFp.find(f => f.codigo === cleanCode);
    if (!match) {
      // Coincidencia por prefijo en el nombre por compatibilidad
      match = allFp.find(f => f.nombre.toLowerCase().startsWith(cleanCode.toLowerCase() + ' - ') || f.nombre.toLowerCase().startsWith(cleanCode.toLowerCase() + ' '));
    }
    if (!match) {
      let term = 'Efectivo';
      if (cleanCode === '03') term = 'Transferencia';
      else if (cleanCode === '04') term = 'Tarjeta de Crédito';
      else if (cleanCode === '28') term = 'Tarjeta de Débito';
      else if (cleanCode === '02') term = 'Cheque';
      else if (cleanCode === '99') term = 'Por definir';

      match = allFp.find(f => f.nombre.toLowerCase() === term.toLowerCase());
      if (!match && (cleanCode === '04' || cleanCode === '28')) {
        match = allFp.find(f => f.nombre.toLowerCase().includes('tarjeta'));
      }
      if (!match) {
        match = allFp.find(f => f.nombre.toLowerCase().includes(term.toLowerCase()));
      }
    }
    return match ? match.id : allFp[0].id;
  } catch (err) {
    console.error('Error auto-mapping FormaPago:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper: Obtener ID de estatus de factura por nombre
// ---------------------------------------------------------------------------
export async function getEstatusFacturaIdByName(name = 'Facturado'): Promise<number | null> {
  try {
    const { data } = await supabaseAdmin
      .from('estatus_factura')
      .select('id')
      .ilike('nombre', name)
      .maybeSingle();
    if (data) return data.id;

    const { data: first } = await supabaseAdmin
      .from('estatus_factura')
      .select('id')
      .limit(1)
      .maybeSingle();
    return first ? first.id : null;
  } catch (err) {
    console.error('Error fetching EstatusFactura:', err);
    return null;
  }
}
