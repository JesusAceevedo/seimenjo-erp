-- ==========================================
-- 1. TABLA DE EMPRESAS (TENANTS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    rfc TEXT UNIQUE,
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. TABLA DE SUCURSALES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.sucursales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
    nombre TEXT NOT NULL,
    codigo TEXT,
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 3. MÓDULOS ACTIVOS POR EMPRESA
-- ==========================================
CREATE TABLE IF NOT EXISTS public.modulos_empresa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE NOT NULL,
    modulo TEXT NOT NULL, -- Ej: 'ventas', 'gastos', 'clientes', 'facturacion'
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (empresa_id, modulo)
);

-- ==========================================
-- 4. PERFILES / ROLES DE SEGURIDAD
-- ==========================================
CREATE TABLE IF NOT EXISTS public.perfiles_seguridad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE, -- NULL significa perfil global/plantilla
    nombre TEXT NOT NULL,
    permisos JSONB NOT NULL DEFAULT '{}'::jsonb, -- Estructura: {"ventas": ["read", "create", "update"], "gastos": ["read"]}
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 5. USUARIOS STAFF (OPERADORES Y ADMINS)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.usuarios_staff (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL, -- NULL solo si es Superusuario global
    perfil_id UUID REFERENCES public.perfiles_seguridad(id) ON DELETE SET NULL,
    es_superusuario BOOLEAN DEFAULT FALSE NOT NULL,
    sucursales_permitidas JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de IDs de sucursales: ["uuid1", "uuid2"]
    creado_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
