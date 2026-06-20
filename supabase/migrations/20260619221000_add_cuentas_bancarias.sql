-- Crear tabla de cuentas bancarias
CREATE TABLE IF NOT EXISTS public.cuentas_bancarias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    numero_cuenta TEXT,
    saldo_inicial NUMERIC DEFAULT 0,
    moneda TEXT DEFAULT 'MXN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar relación en movimientos_bancarios
ALTER TABLE public.movimientos_bancarios
ADD COLUMN IF NOT EXISTS cuenta_bancaria_id UUID REFERENCES public.cuentas_bancarias(id) ON DELETE SET NULL;

-- Actualizar permisos de RLS (Row Level Security)
ALTER TABLE public.cuentas_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users"
    ON public.cuentas_bancarias FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users only"
    ON public.cuentas_bancarias FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only"
    ON public.cuentas_bancarias FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only"
    ON public.cuentas_bancarias FOR DELETE
    USING (auth.role() = 'authenticated');
