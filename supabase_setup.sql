-- =====================================================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS (SUPABASE)
-- Copia y pega este código en el SQL Editor de Supabase para configurar
-- las tablas y funciones de los catálogos.
-- =====================================================================

-- 1. MODIFICACIÓN DE LA TABLA EXISTENTE 'categorias_gasto'
-- Agrega la columna 'tipo' para clasificar en Materia Prima / Operativo
ALTER TABLE categorias_gasto ADD COLUMN IF NOT EXISTS tipo TEXT CHECK (tipo IN ('Materia Prima', 'Operativo'));

-- 2. TABLA DE REPARTIDORES
CREATE TABLE IF NOT EXISTS repartidores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y Políticas
ALTER TABLE repartidores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a usuarios autenticados en repartidores" 
    ON repartidores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insertar valores iniciales
INSERT INTO repartidores (nombre) VALUES 
('SR. PEPE'), 
('PLAYITA'), 
('FELIPE')
ON CONFLICT (nombre) DO NOTHING;


-- 3. TABLA DE FORMAS DE PAGO (GLOBAL)
CREATE TABLE IF NOT EXISTS formas_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y Políticas
ALTER TABLE formas_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a usuarios autenticados en formas_pago" 
    ON formas_pago FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insertar valores iniciales
INSERT INTO formas_pago (nombre) VALUES 
('Efectivo'), 
('Transferencia'), 
('Tarjeta de Crédito / Débito'),
('Cheque')
ON CONFLICT (nombre) DO NOTHING;


-- 4. TABLA DE ESTATUS DE FACTURA
CREATE TABLE IF NOT EXISTS estatus_factura (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y Políticas
ALTER TABLE estatus_factura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a usuarios autenticados en estatus_factura" 
    ON estatus_factura FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insertar valores iniciales
INSERT INTO estatus_factura (nombre) VALUES 
('Pendiente'), 
('Solicitada'), 
('Facturado'), 
('No Facturado')
ON CONFLICT (nombre) DO NOTHING;


-- 5. TABLA DE RÉGIMENES FISCALES (SAT CFDI 4.0)
CREATE TABLE IF NOT EXISTS regimenes_fiscales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y Políticas
ALTER TABLE regimenes_fiscales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a usuarios autenticados en regimenes_fiscales" 
    ON regimenes_fiscales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insertar valores oficiales del SAT
INSERT INTO regimenes_fiscales (clave, descripcion) VALUES
('601', 'General de Ley Personas Morales'),
('603', 'Personas Morales con Fines no Lucrativos'),
('605', 'Sueldos y Salarios e Ingresos Asimilados a Salarios'),
('606', 'Arrendamiento'),
('608', 'Demás ingresos'),
('612', 'Personas Físicas con Actividades Empresariales y Profesionales'),
('621', 'Incorporación Fiscal'),
('626', 'Régimen Simplificado de Confianza (RESICO)')
ON CONFLICT (clave) DO NOTHING;


-- 6. TABLA DE USOS DE CFDI (SAT CFDI 4.0)
CREATE TABLE IF NOT EXISTS usos_cfdi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y Políticas
ALTER TABLE usos_cfdi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a usuarios autenticados en usos_cfdi" 
    ON usos_cfdi FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insertar valores oficiales del SAT
INSERT INTO usos_cfdi (clave, descripcion) VALUES
('G01', 'Adquisición de mercancías'),
('G03', 'Gastos en general'),
('D01', 'Honorarios médicos, dentales y gastos hospitalarios'),
('I01', 'Construcciones'),
('S01', 'Sin efectos fiscales'),
('P01', 'Por definir'),
('CP01', 'Pagos')
ON CONFLICT (clave) DO NOTHING;


-- 7. FUNCIONES RPC PARA OBTENER Y CONFIGURAR EL CONSECUTIVO DEL PEDIDO
-- Estas funciones manipulan directamente la secuencia Postgres que genera el 'numero_pedido'

-- Función para obtener el siguiente valor sin incrementarlo permanentemente
CREATE OR REPLACE FUNCTION get_siguiente_pedido_numero()
RETURNS INT AS $$
DECLARE
    last_val INT;
    is_called BOOL;
BEGIN
    -- Obtenemos el estado de la secuencia
    SELECT last_value, is_called INTO last_val, is_called FROM pedidos_numero_pedido_seq;
    IF is_called THEN
        RETURN last_val + 1;
    ELSE
        RETURN last_val;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Si la secuencia no existe, retornamos un valor predeterminado
        RETURN 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para alterar/redefinir el número del siguiente pedido
CREATE OR REPLACE FUNCTION set_siguiente_pedido_numero(num INT)
RETURNS INT AS $$
BEGIN
    -- Establecemos el valor de la secuencia
    PERFORM setval('pedidos_numero_pedido_seq', num - 1, true);
    RETURN num;
EXCEPTION
    WHEN OTHERS THEN
        RETURN -1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =====================================================================
-- 8. CONCESIÓN DE PRIVILEGIOS (GRANTS)
-- Requerido cuando auto_expose_new_tables = false en local/nube
-- =====================================================================
GRANT ALL ON TABLE public.repartidores TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.formas_pago TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.estatus_factura TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.regimenes_fiscales TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.usos_cfdi TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_siguiente_pedido_numero() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_siguiente_pedido_numero(INT) TO anon, authenticated, service_role;

GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.pedidos_numero_pedido_seq TO anon, authenticated, service_role;


-- =====================================================================
-- 9. TABLA DE CONFIGURACIÓN DE TICKETS / RECIBOS POS
-- =====================================================================
CREATE TABLE IF NOT EXISTS configuracion_ticket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encabezado TEXT,
    pie_pagina TEXT,
    logo_url TEXT,
    promo_tipo TEXT CHECK (promo_tipo IN ('imagen', 'qr', 'ninguno')) DEFAULT 'ninguno',
    promo_imagen_url TEXT,
    promo_qr_link TEXT,
    promo_qr_descripcion TEXT,
    opciones_visualizacion JSONB DEFAULT '{"mostrar_telefono": true, "mostrar_facturacion": true, "mostrar_comentarios": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS y Políticas de Seguridad
ALTER TABLE configuracion_ticket ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura publica de la configuracion del ticket" 
    ON configuracion_ticket FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Permitir todo a usuarios autenticados en configuracion_ticket" 
    ON configuracion_ticket FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Registro inicial por defecto para evitar consultas vacías
INSERT INTO configuracion_ticket (id, encabezado, pie_pagina, promo_tipo, opciones_visualizacion)
VALUES (
    'd3b07384-d113-44f2-a270-2094c48970e5',
    'RAMEN DE PLAYA S.A. DE C.V.\nRPL231122S52\nCalle 8 Nte, Lote 3, Local 1\nPlaya del Carmen, Solidaridad, Q. Roo',
    'Dudas y comentarios. Instagram: @Sakura_ramenme',
    'ninguno',
    '{"mostrar_telefono": true, "mostrar_facturacion": true, "mostrar_comentarios": true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Concesión de privilegios a los roles de Supabase
GRANT ALL ON TABLE public.configuracion_ticket TO anon, authenticated, service_role;


-- =====================================================================
-- 10. POLÍTICAS DE ESCRITURA PARA PRODUCTOS, VARIANTES Y PRECIOS ESPECIALES
-- =====================================================================
CREATE POLICY "Permitir todo a usuarios autenticados en productos" 
    ON productos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo a usuarios autenticados en producto_variantes" 
    ON producto_variantes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo a usuarios autenticados en precios_especiales" 
    ON precios_especiales FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir todo a usuarios autenticados en categorias_gasto" 
    ON categorias_gasto FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =====================================================================
-- 11. PARAMETRIZACIÓN FISCAL DE EMPRESAS Y CONTROL DE ACCESOS
-- =====================================================================
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS razon_social TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS codigo_postal TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS regimen_fiscal_id UUID REFERENCES public.regimenes_fiscales(id);
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS email_contacto TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT 'MXN';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS logo_ticket_url TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS csd_cer_url TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS csd_key_url TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS csd_password_encriptada TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS limite_sucursales INT DEFAULT 3;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS limite_usuarios INT DEFAULT 10;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS facturacion_activa BOOLEAN DEFAULT FALSE;

-- Tabla Pivot de Sucursales Permitidas por Usuario Staff
CREATE TABLE IF NOT EXISTS public.sucursales_usuario_pivot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.usuarios_staff(id) ON DELETE CASCADE,
    sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE CASCADE,
    UNIQUE (usuario_id, sucursal_id)
);

ALTER TABLE public.sucursales_usuario_pivot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo a usuarios autenticados en sucursales_usuario_pivot" 
    ON public.sucursales_usuario_pivot FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================================================================
-- 12. ACTUALIZACIÓN DE ESTATUS DE PEDIDOS (ENTREGADO)
-- =====================================================================
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estatus_pedido_check;
ALTER TABLE public.pedidos ADD CONSTRAINT pedidos_estatus_pedido_check CHECK (estatus_pedido = ANY (ARRAY['Pendiente'::text, 'Pagado'::text, 'Cancelado'::text, 'Facturado'::text, 'Entregado'::text]));

-- =====================================================================
-- 13. CONCESIÓN DE PRIVILEGIOS ADICIONALES (GRANTS)
-- =====================================================================
GRANT ALL ON TABLE public.empresas TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sucursales TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.modulos_empresa TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.perfiles_seguridad TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.usuarios_staff TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.configuracion_ticket TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sucursales_usuario_pivot TO anon, authenticated, service_role;

-- =====================================================================
-- 14. INICIALIZACIÓN DE BUCKETS Y POLÍTICAS DE ALMACENAMIENTO (STORAGE)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
('empresas-logos', 'empresas-logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']),
('empresas-csd', 'empresas-csd', false, 1048576, ARRAY['application/octet-stream', 'application/x-x509-ca-cert', 'application/pkcs8', 'application/x-pkcs12']),
('csd-private', 'csd-private', false, 1048576, ARRAY['application/octet-stream', 'application/x-x509-ca-cert', 'application/pkcs8', 'application/x-pkcs12']),
('ticket-assets', 'ticket-assets', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg']),
('productos-imagenes', 'productos-imagenes', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/jpg']),
('facturas', 'facturas', false, 10485760, ARRAY['text/xml', 'application/xml', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para empresas-logos (Público)
DROP POLICY IF EXISTS "Permitir select público en empresas-logos" ON storage.objects;
CREATE POLICY "Permitir select público en empresas-logos" 
    ON storage.objects FOR SELECT TO public USING (bucket_id = 'empresas-logos');

DROP POLICY IF EXISTS "Permitir insert/update/delete a autenticados en empresas-logos" ON storage.objects;
CREATE POLICY "Permitir insert/update/delete a autenticados en empresas-logos" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'empresas-logos') 
    WITH CHECK (bucket_id = 'empresas-logos');

-- Políticas de Storage para csd-private (Privado)
DROP POLICY IF EXISTS "Permitir todo a autenticados en csd-private" ON storage.objects;
CREATE POLICY "Permitir todo a autenticados en csd-private" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'csd-private') 
    WITH CHECK (bucket_id = 'csd-private');

-- Políticas de Storage para empresas-csd (Privado)
DROP POLICY IF EXISTS "Permitir todo a autenticados en empresas-csd" ON storage.objects;
CREATE POLICY "Permitir todo a autenticados en empresas-csd" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'empresas-csd') 
    WITH CHECK (bucket_id = 'empresas-csd');

-- Políticas de Storage para ticket-assets (Público)
DROP POLICY IF EXISTS "Permitir select público en ticket-assets" ON storage.objects;
CREATE POLICY "Permitir select público en ticket-assets" 
    ON storage.objects FOR SELECT TO public USING (bucket_id = 'ticket-assets');

DROP POLICY IF EXISTS "Permitir insert/update/delete a autenticados en ticket-assets" ON storage.objects;
CREATE POLICY "Permitir insert/update/delete a autenticados en ticket-assets" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'ticket-assets') 
    WITH CHECK (bucket_id = 'ticket-assets');

-- Políticas de Storage para productos-imagenes (Público)
DROP POLICY IF EXISTS "Permitir select público en productos-imagenes" ON storage.objects;
CREATE POLICY "Permitir select público en productos-imagenes" 
    ON storage.objects FOR SELECT TO public USING (bucket_id = 'productos-imagenes');

DROP POLICY IF EXISTS "Permitir insert/update/delete a autenticados en productos-imagenes" ON storage.objects;
CREATE POLICY "Permitir insert/update/delete a autenticados en productos-imagenes" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'productos-imagenes') 
    WITH CHECK (bucket_id = 'productos-imagenes');

-- Políticas de Storage para facturas (Privado)
DROP POLICY IF EXISTS "Permitir todo a autenticados en facturas" ON storage.objects;
CREATE POLICY "Permitir todo a autenticados en facturas" 
    ON storage.objects FOR ALL TO authenticated 
    USING (bucket_id = 'facturas') 
    WITH CHECK (bucket_id = 'facturas');

-- =====================================================================
-- 15. POLÍTICAS DE RLS PARA TABLAS DE CONFIGURACIÓN Y ACCESO
-- =====================================================================

-- modulos_empresa
ALTER TABLE public.modulos_empresa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en modulos_empresa" ON public.modulos_empresa;
CREATE POLICY "Permitir todo a autenticados en modulos_empresa" 
    ON public.modulos_empresa FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- empresas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en empresas" ON public.empresas;
CREATE POLICY "Permitir todo a autenticados en empresas" 
    ON public.empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- perfiles_seguridad
ALTER TABLE public.perfiles_seguridad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en perfiles_seguridad" ON public.perfiles_seguridad;
CREATE POLICY "Permitir todo a autenticados en perfiles_seguridad" 
    ON public.perfiles_seguridad FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- usuarios_staff
ALTER TABLE public.usuarios_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a autenticados en usuarios_staff" ON public.usuarios_staff;
CREATE POLICY "Permitir todo a autenticados en usuarios_staff" 
    ON public.usuarios_staff FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =====================================================================
-- 16. AISLAMIENTO MULTIEMPRESA (ROLES, COLUMNAS Y POLÍTICAS RLS)
-- =====================================================================

-- 1. FUNCIONES AUXILIARES PARA RLS MULTIEMPRESA
CREATE OR REPLACE FUNCTION public.get_auth_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM public.usuarios_staff WHERE supabase_auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_superusuario()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(es_superusuario, false) FROM public.usuarios_staff WHERE supabase_auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. ALTERACIÓN DE TABLAS OPERATIVAS PARA INCLUIR COLUMNA DE EMPRESA Y VALOR POR DEFECTO
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.categorias_gasto ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.proveedores ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.repartidores ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();
ALTER TABLE public.precios_especiales ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE DEFAULT public.get_auth_empresa_id();

-- 3. HABILITACIÓN DE RLS Y REEMPLAZO DE POLÍTICAS EXISTENTES
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repartidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios_especiales ENABLE ROW LEVEL SECURITY;

-- Clientes
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en clientes" ON public.clientes;
DROP POLICY IF EXISTS "Aislamiento multiempresa para clientes" ON public.clientes;
CREATE POLICY "Aislamiento multiempresa para clientes" ON public.clientes FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Pedidos
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Aislamiento multiempresa para pedidos" ON public.pedidos;
CREATE POLICY "Aislamiento multiempresa para pedidos" ON public.pedidos FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Gastos
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en gastos" ON public.gastos;
DROP POLICY IF EXISTS "Aislamiento multiempresa para gastos" ON public.gastos;
CREATE POLICY "Aislamiento multiempresa para gastos" ON public.gastos FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Productos
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en productos" ON public.productos;
DROP POLICY IF EXISTS "Aislamiento multiempresa para productos" ON public.productos;
CREATE POLICY "Aislamiento multiempresa para productos" ON public.productos FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Categorías de Gasto
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en categorias_gasto" ON public.categorias_gasto;
DROP POLICY IF EXISTS "Aislamiento multiempresa para categorias_gasto" ON public.categorias_gasto;
CREATE POLICY "Aislamiento multiempresa para categorias_gasto" ON public.categorias_gasto FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Proveedores
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en proveedores" ON public.proveedores;
DROP POLICY IF EXISTS "Aislamiento multiempresa para proveedores" ON public.proveedores;
CREATE POLICY "Aislamiento multiempresa para proveedores" ON public.proveedores FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Repartidores
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en repartidores" ON public.repartidores;
DROP POLICY IF EXISTS "Aislamiento multiempresa para repartidores" ON public.repartidores;
CREATE POLICY "Aislamiento multiempresa para repartidores" ON public.repartidores FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- Precios Especiales
DROP POLICY IF EXISTS "Permitir todo a usuarios autenticados en precios_especiales" ON public.precios_especiales;
DROP POLICY IF EXISTS "Aislamiento multiempresa para precios_especiales" ON public.precios_especiales;
CREATE POLICY "Aislamiento multiempresa para precios_especiales" ON public.precios_especiales FOR ALL TO authenticated
  USING (is_superusuario() OR empresa_id = get_auth_empresa_id())
  WITH CHECK (is_superusuario() OR empresa_id = get_auth_empresa_id());

-- 4. CONCESIÓN DE PRIVILEGIOS
GRANT ALL ON TABLE public.clientes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.pedidos TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gastos TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.productos TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.categorias_gasto TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.proveedores TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.repartidores TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.precios_especiales TO anon, authenticated, service_role;


