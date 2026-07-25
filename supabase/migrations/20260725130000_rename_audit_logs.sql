-- MIGRACIÓN: Renombrar audit_logs a registros_auditoria para unificar idioma al español
-- Fecha: 2026-07-25

DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'audit_logs'
    ) THEN
        ALTER TABLE public.audit_logs RENAME TO registros_auditoria;
    END IF;
END $$;
