-- Migration: Fix get_auth_empresa_id for B2B clients to enable product loading
CREATE OR REPLACE FUNCTION public.get_auth_empresa_id()
RETURNS UUID AS $$
DECLARE
  v_empresa_id UUID;
  v_cliente_id_str TEXT;
BEGIN
  -- 1. Intento por staff
  SELECT empresa_id INTO v_empresa_id FROM public.usuarios_staff WHERE supabase_auth_id = auth.uid();
  IF v_empresa_id IS NOT NULL THEN
    RETURN v_empresa_id;
  END IF;

  -- 2. Intento por metadatos de cliente (B2B)
  v_cliente_id_str := auth.jwt() -> 'user_metadata' ->> 'cliente_id';
  IF v_cliente_id_str IS NOT NULL THEN
    SELECT empresa_id INTO v_empresa_id FROM public.clientes WHERE id = v_cliente_id_str::UUID;
    RETURN v_empresa_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
