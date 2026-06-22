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
export async function getFormaPagoIdByCode(code: string): Promise<number | null> {
  try {
    const { data } = await supabaseAdmin.from('formas_pago').select('id, nombre');
    if (!data || data.length === 0) return null;

    let term = 'Efectivo';
    if (code === '03') term = 'Transferencia';
    else if (code === '04' || code === '28') term = 'Tarjeta';
    else if (code === '02') term = 'Cheque';

    const match = data.find(f => f.nombre.toLowerCase().includes(term.toLowerCase()));
    return match ? match.id : data[0].id;
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
