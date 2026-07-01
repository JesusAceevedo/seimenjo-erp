-- Migration to create the zkteco_comandos table
CREATE TABLE IF NOT EXISTS public.zkteco_comandos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id(),
    dispositivo_sn VARCHAR(50),
    comando_id VARCHAR(50) NOT NULL,
    comando_texto TEXT NOT NULL,
    procesado BOOLEAN DEFAULT FALSE,
    resultado TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    procesado_en TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.zkteco_comandos ENABLE ROW LEVEL SECURITY;

-- Policy to allow select and write for authenticated users
CREATE POLICY "Allow select for staff" ON public.zkteco_comandos
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert for staff" ON public.zkteco_comandos
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for staff" ON public.zkteco_comandos
    FOR UPDATE TO authenticated USING (true);
