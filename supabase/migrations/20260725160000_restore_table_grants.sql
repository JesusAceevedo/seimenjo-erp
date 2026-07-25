-- MIGRACIÓN: Restaurar GRANTs en schema public para evaluación correcta de RLS en Supabase
-- Fecha: 2026-07-25

-- Conceder permisos de tabla a anon y authenticated para que RLS gestione el acceso a nivel de fila
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
