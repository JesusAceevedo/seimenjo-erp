-- =====================================================================
-- MIGRACIÓN: RELACIÓN MUCHOS A MUCHOS (N:M) ENTRE FACTURAS Y PEDIDOS
-- Soporta:
--   1) 1 Factura XML -> Múltiples Pedidos (Facturación Consolidada / Acumulada)
--   2) Múltiples Facturas XML -> 1 Pedido (Facturación Parcial / Dividida)
--   3) N Facturas XML -> M Pedidos (Lote de cuenta corriente de cliente)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.facturas_clientes_pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_id UUID NOT NULL REFERENCES public.facturas_clientes(id) ON DELETE CASCADE,
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    monto_asignado NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_factura_pedido UNIQUE (factura_id, pedido_id)
);

-- Índices para consultas rápidas desde pedidos y desde facturas_clientes
CREATE INDEX IF NOT EXISTS idx_fcp_factura_id ON public.facturas_clientes_pedidos(factura_id);
CREATE INDEX IF NOT EXISTS idx_fcp_pedido_id ON public.facturas_clientes_pedidos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_fcp_empresa_id ON public.facturas_clientes_pedidos(empresa_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.facturas_clientes_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aislamiento multiempresa para facturas_clientes_pedidos" ON public.facturas_clientes_pedidos;
CREATE POLICY "Aislamiento multiempresa para facturas_clientes_pedidos" ON public.facturas_clientes_pedidos
    FOR ALL TO authenticated
    USING (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id())
    WITH CHECK (is_superusuario() OR empresa_id IS NULL OR empresa_id = get_auth_empresa_id());

DROP POLICY IF EXISTS "Lectura publica tienda facturas_clientes_pedidos" ON public.facturas_clientes_pedidos;
CREATE POLICY "Lectura publica tienda facturas_clientes_pedidos" ON public.facturas_clientes_pedidos
    FOR SELECT TO anon
    USING (true);

GRANT SELECT ON TABLE public.facturas_clientes_pedidos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.facturas_clientes_pedidos TO authenticated;
GRANT ALL ON TABLE public.facturas_clientes_pedidos TO service_role;

-- =====================================================================
-- BACKFILL AUTOMÁTICO DE DATOS EXISTENTES
-- =====================================================================

-- 1. Poblar desde facturas_clientes que ya tienen pedido_id directo
INSERT INTO public.facturas_clientes_pedidos (factura_id, pedido_id, monto_asignado, empresa_id)
SELECT
    fc.id AS factura_id,
    fc.pedido_id,
    LEAST(COALESCE(fc.total, 0), COALESCE(p.precio_total, COALESCE(fc.total, 0))) AS monto_asignado,
    COALESCE(fc.empresa_id, p.empresa_id) AS empresa_id
FROM public.facturas_clientes fc
JOIN public.pedidos p ON p.id = fc.pedido_id
WHERE fc.pedido_id IS NOT NULL
ON CONFLICT (factura_id, pedido_id) DO NOTHING;

-- 2. Poblar pedidos adicionales vinculados por coincidencia de folio_factura en la misma empresa
INSERT INTO public.facturas_clientes_pedidos (factura_id, pedido_id, monto_asignado, empresa_id)
SELECT
    fc.id AS factura_id,
    p.id AS pedido_id,
    COALESCE(p.precio_total, 0) AS monto_asignado,
    COALESCE(p.empresa_id, fc.empresa_id) AS empresa_id
FROM public.pedidos p
JOIN public.facturas_clientes fc
  ON fc.empresa_id = p.empresa_id
  AND p.folio_factura IS NOT NULL
  AND btrim(p.folio_factura) <> ''
  AND (
    lower(btrim(fc.serie_folio)) = lower(btrim(p.folio_factura))
    OR ('uuid:' || lower(left(fc.uuid_fiscal::text, 8))) = lower(btrim(p.folio_factura))
  )
ON CONFLICT (factura_id, pedido_id) DO NOTHING;

