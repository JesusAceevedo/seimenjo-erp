drop extension if exists "pg_net";

create type "public"."estado_pedido" as enum ('Pendiente', 'Pagado', 'Cancelado', 'Facturado');

create sequence "public"."conceptos_permitidos_id_seq";

create sequence "public"."pedidos_numero_pedido_seq";

create sequence "public"."roles_id_seq";


  create table "public"."categorias_gasto" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "nombre" character varying(100) not null,
    "descripcion" text
      );


alter table "public"."categorias_gasto" enable row level security;


  create table "public"."clientes" (
    "id" uuid not null default gen_random_uuid(),
    "rfc" character varying,
    "nombre_local" character varying not null,
    "telefono" character varying not null,
    "es_anonimo" boolean default true,
    "razon_social" character varying(255),
    "regimen_fiscal" character varying(5),
    "codigo_postal" character varying(10),
    "uso_cfdi" character varying(5),
    "email_facturacion" character varying(255)
      );


alter table "public"."clientes" enable row level security;


  create table "public"."conceptos_permitidos" (
    "id" integer not null default nextval('public.conceptos_permitidos_id_seq'::regclass),
    "categoria_id" uuid,
    "concepto_nombre" text not null
      );


alter table "public"."conceptos_permitidos" enable row level security;


  create table "public"."gastos" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "fecha_gasto" date not null default CURRENT_DATE,
    "concepto" character varying(255) not null,
    "monto" numeric(10,2) not null,
    "metodo_pago" character varying(50),
    "folio_factura" character varying(100),
    "categoria_id" uuid,
    "proveedor_id" uuid,
    "registrado_por" uuid,
    "comentarios" text,
    "created_at" timestamp with time zone default now(),
    "xml_url" text,
    "tipo_egreso" character varying(50),
    "ticket_url" character varying,
    "estatus_facturado" boolean default false
      );


alter table "public"."gastos" enable row level security;


  create table "public"."pedido_detalles" (
    "id" uuid not null default gen_random_uuid(),
    "pedido_id" uuid,
    "variante_id" uuid,
    "cantidad" integer not null,
    "precio_aplicado" numeric(10,2) not null,
    "subtotal" numeric(10,2) not null,
    "comentarios" text
      );



  create table "public"."pedidos" (
    "id" uuid not null default gen_random_uuid(),
    "numero_pedido" integer not null default nextval('public.pedidos_numero_pedido_seq'::regclass),
    "cliente_id" uuid,
    "fecha_pedido" date default CURRENT_DATE,
    "fecha_produccion" date,
    "fecha_entrega" date,
    "costo_envio" numeric(10,2) default 0,
    "entregado_por" character varying,
    "precio_total" numeric(10,2) not null,
    "estatus_pago" character varying default 'Pendiente'::character varying,
    "metodo_pago" character varying,
    "folio_factura" character varying,
    "comentarios" text,
    "created_at" timestamp with time zone default now(),
    "cliente_nombre" text,
    "cliente_telefono" text,
    "estatus_pedido" text default 'Pendiente'::text,
    "motivo_cancelacion" text
      );



  create table "public"."precios_especiales" (
    "id" uuid not null default gen_random_uuid(),
    "cliente_id" uuid,
    "variante_id" uuid,
    "precio_pactado" numeric(10,2) not null
      );


alter table "public"."precios_especiales" enable row level security;


  create table "public"."producto_variantes" (
    "id" uuid not null default gen_random_uuid(),
    "producto_id" uuid,
    "gramaje" character varying not null,
    "precio_base" numeric(10,2) not null
      );


alter table "public"."producto_variantes" enable row level security;


  create table "public"."productos" (
    "id" uuid not null default gen_random_uuid(),
    "nombre" character varying not null,
    "categoria" character varying not null,
    "imagen_url" character varying
      );


alter table "public"."productos" enable row level security;


  create table "public"."proveedores" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "nombre_comercial" character varying(255) not null,
    "rfc" character varying(20),
    "razon_social" character varying(255),
    "telefono" character varying(50),
    "email" character varying(255)
      );


alter table "public"."proveedores" enable row level security;


  create table "public"."roles" (
    "id" integer not null default nextval('public.roles_id_seq'::regclass),
    "nombre" character varying(50) not null
      );


alter table "public"."roles" enable row level security;


  create table "public"."usuarios_staff" (
    "id" uuid not null default gen_random_uuid(),
    "supabase_auth_id" uuid not null,
    "correo" character varying not null,
    "activo" boolean default true,
    "rol_id" integer
      );


alter table "public"."usuarios_staff" enable row level security;

alter sequence "public"."conceptos_permitidos_id_seq" owned by "public"."conceptos_permitidos"."id";

alter sequence "public"."pedidos_numero_pedido_seq" owned by "public"."pedidos"."numero_pedido";

alter sequence "public"."roles_id_seq" owned by "public"."roles"."id";

CREATE UNIQUE INDEX categorias_gasto_pkey ON public.categorias_gasto USING btree (id);

CREATE UNIQUE INDEX clientes_pkey ON public.clientes USING btree (id);

CREATE UNIQUE INDEX conceptos_permitidos_pkey ON public.conceptos_permitidos USING btree (id);

CREATE UNIQUE INDEX gastos_pkey ON public.gastos USING btree (id);

CREATE INDEX idx_clientes_rfc ON public.clientes USING btree (rfc);

CREATE INDEX idx_pedidos_numero ON public.pedidos USING btree (numero_pedido);

CREATE UNIQUE INDEX pedido_detalles_pkey ON public.pedido_detalles USING btree (id);

CREATE UNIQUE INDEX pedidos_pkey ON public.pedidos USING btree (id);

CREATE UNIQUE INDEX precios_especiales_pkey ON public.precios_especiales USING btree (id);

CREATE UNIQUE INDEX producto_variantes_pkey ON public.producto_variantes USING btree (id);

CREATE UNIQUE INDEX productos_pkey ON public.productos USING btree (id);

CREATE UNIQUE INDEX proveedores_pkey ON public.proveedores USING btree (id);

CREATE UNIQUE INDEX rfc_unico ON public.proveedores USING btree (rfc);

CREATE UNIQUE INDEX roles_nombre_key ON public.roles USING btree (nombre);

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id);

CREATE UNIQUE INDEX unica_relacion_concepto ON public.conceptos_permitidos USING btree (categoria_id, concepto_nombre);

CREATE UNIQUE INDEX unique_cliente_variante ON public.precios_especiales USING btree (cliente_id, variante_id);

CREATE UNIQUE INDEX unique_rfc ON public.proveedores USING btree (rfc);

CREATE UNIQUE INDEX usuarios_staff_correo_key ON public.usuarios_staff USING btree (correo);

CREATE UNIQUE INDEX usuarios_staff_pkey ON public.usuarios_staff USING btree (id);

CREATE UNIQUE INDEX usuarios_staff_supabase_auth_id_key ON public.usuarios_staff USING btree (supabase_auth_id);

alter table "public"."categorias_gasto" add constraint "categorias_gasto_pkey" PRIMARY KEY using index "categorias_gasto_pkey";

alter table "public"."clientes" add constraint "clientes_pkey" PRIMARY KEY using index "clientes_pkey";

alter table "public"."conceptos_permitidos" add constraint "conceptos_permitidos_pkey" PRIMARY KEY using index "conceptos_permitidos_pkey";

alter table "public"."gastos" add constraint "gastos_pkey" PRIMARY KEY using index "gastos_pkey";

alter table "public"."pedido_detalles" add constraint "pedido_detalles_pkey" PRIMARY KEY using index "pedido_detalles_pkey";

alter table "public"."pedidos" add constraint "pedidos_pkey" PRIMARY KEY using index "pedidos_pkey";

alter table "public"."precios_especiales" add constraint "precios_especiales_pkey" PRIMARY KEY using index "precios_especiales_pkey";

alter table "public"."producto_variantes" add constraint "producto_variantes_pkey" PRIMARY KEY using index "producto_variantes_pkey";

alter table "public"."productos" add constraint "productos_pkey" PRIMARY KEY using index "productos_pkey";

alter table "public"."proveedores" add constraint "proveedores_pkey" PRIMARY KEY using index "proveedores_pkey";

alter table "public"."roles" add constraint "roles_pkey" PRIMARY KEY using index "roles_pkey";

alter table "public"."usuarios_staff" add constraint "usuarios_staff_pkey" PRIMARY KEY using index "usuarios_staff_pkey";

alter table "public"."conceptos_permitidos" add constraint "conceptos_permitidos_categoria_id_fkey" FOREIGN KEY (categoria_id) REFERENCES public.categorias_gasto(id) ON DELETE CASCADE not valid;

alter table "public"."conceptos_permitidos" validate constraint "conceptos_permitidos_categoria_id_fkey";

alter table "public"."conceptos_permitidos" add constraint "unica_relacion_concepto" UNIQUE using index "unica_relacion_concepto";

alter table "public"."gastos" add constraint "gastos_categoria_id_fkey" FOREIGN KEY (categoria_id) REFERENCES public.categorias_gasto(id) not valid;

alter table "public"."gastos" validate constraint "gastos_categoria_id_fkey";

alter table "public"."gastos" add constraint "gastos_proveedor_id_fkey" FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id) not valid;

alter table "public"."gastos" validate constraint "gastos_proveedor_id_fkey";

alter table "public"."gastos" add constraint "gastos_registrado_por_fkey" FOREIGN KEY (registrado_por) REFERENCES public.usuarios_staff(id) not valid;

alter table "public"."gastos" validate constraint "gastos_registrado_por_fkey";

alter table "public"."pedido_detalles" add constraint "pedido_detalles_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE not valid;

alter table "public"."pedido_detalles" validate constraint "pedido_detalles_pedido_id_fkey";

alter table "public"."pedido_detalles" add constraint "pedido_detalles_variante_id_fkey" FOREIGN KEY (variante_id) REFERENCES public.producto_variantes(id) ON DELETE RESTRICT not valid;

alter table "public"."pedido_detalles" validate constraint "pedido_detalles_variante_id_fkey";

alter table "public"."pedidos" add constraint "pedidos_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL not valid;

alter table "public"."pedidos" validate constraint "pedidos_cliente_id_fkey";

alter table "public"."pedidos" add constraint "pedidos_estatus_pedido_check" CHECK ((estatus_pedido = ANY (ARRAY['Pendiente'::text, 'Pagado'::text, 'Cancelado'::text, 'Facturado'::text]))) not valid;

alter table "public"."pedidos" validate constraint "pedidos_estatus_pedido_check";

alter table "public"."precios_especiales" add constraint "precios_especiales_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE not valid;

alter table "public"."precios_especiales" validate constraint "precios_especiales_cliente_id_fkey";

alter table "public"."precios_especiales" add constraint "precios_especiales_variante_id_fkey" FOREIGN KEY (variante_id) REFERENCES public.producto_variantes(id) ON DELETE CASCADE not valid;

alter table "public"."precios_especiales" validate constraint "precios_especiales_variante_id_fkey";

alter table "public"."precios_especiales" add constraint "unique_cliente_variante" UNIQUE using index "unique_cliente_variante";

alter table "public"."producto_variantes" add constraint "producto_variantes_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE not valid;

alter table "public"."producto_variantes" validate constraint "producto_variantes_producto_id_fkey";

alter table "public"."proveedores" add constraint "rfc_unico" UNIQUE using index "rfc_unico";

alter table "public"."proveedores" add constraint "unique_rfc" UNIQUE using index "unique_rfc";

alter table "public"."roles" add constraint "roles_nombre_key" UNIQUE using index "roles_nombre_key";

alter table "public"."usuarios_staff" add constraint "usuarios_staff_correo_key" UNIQUE using index "usuarios_staff_correo_key";

alter table "public"."usuarios_staff" add constraint "usuarios_staff_rol_id_fkey" FOREIGN KEY (rol_id) REFERENCES public.roles(id) not valid;

alter table "public"."usuarios_staff" validate constraint "usuarios_staff_rol_id_fkey";

alter table "public"."usuarios_staff" add constraint "usuarios_staff_supabase_auth_id_key" UNIQUE using index "usuarios_staff_supabase_auth_id_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.revisar_si_es_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM usuarios_staff 
    WHERE supabase_auth_id = auth.uid() AND rol = 'Admin'
  );
$function$
;

grant delete on table "public"."categorias_gasto" to "anon";

grant insert on table "public"."categorias_gasto" to "anon";

grant references on table "public"."categorias_gasto" to "anon";

grant select on table "public"."categorias_gasto" to "anon";

grant trigger on table "public"."categorias_gasto" to "anon";

grant truncate on table "public"."categorias_gasto" to "anon";

grant update on table "public"."categorias_gasto" to "anon";

grant delete on table "public"."categorias_gasto" to "authenticated";

grant insert on table "public"."categorias_gasto" to "authenticated";

grant references on table "public"."categorias_gasto" to "authenticated";

grant select on table "public"."categorias_gasto" to "authenticated";

grant trigger on table "public"."categorias_gasto" to "authenticated";

grant truncate on table "public"."categorias_gasto" to "authenticated";

grant update on table "public"."categorias_gasto" to "authenticated";

grant delete on table "public"."categorias_gasto" to "service_role";

grant insert on table "public"."categorias_gasto" to "service_role";

grant references on table "public"."categorias_gasto" to "service_role";

grant select on table "public"."categorias_gasto" to "service_role";

grant trigger on table "public"."categorias_gasto" to "service_role";

grant truncate on table "public"."categorias_gasto" to "service_role";

grant update on table "public"."categorias_gasto" to "service_role";

grant delete on table "public"."clientes" to "anon";

grant insert on table "public"."clientes" to "anon";

grant references on table "public"."clientes" to "anon";

grant select on table "public"."clientes" to "anon";

grant trigger on table "public"."clientes" to "anon";

grant truncate on table "public"."clientes" to "anon";

grant update on table "public"."clientes" to "anon";

grant delete on table "public"."clientes" to "authenticated";

grant insert on table "public"."clientes" to "authenticated";

grant references on table "public"."clientes" to "authenticated";

grant select on table "public"."clientes" to "authenticated";

grant trigger on table "public"."clientes" to "authenticated";

grant truncate on table "public"."clientes" to "authenticated";

grant update on table "public"."clientes" to "authenticated";

grant delete on table "public"."clientes" to "service_role";

grant insert on table "public"."clientes" to "service_role";

grant references on table "public"."clientes" to "service_role";

grant select on table "public"."clientes" to "service_role";

grant trigger on table "public"."clientes" to "service_role";

grant truncate on table "public"."clientes" to "service_role";

grant update on table "public"."clientes" to "service_role";

grant delete on table "public"."conceptos_permitidos" to "anon";

grant insert on table "public"."conceptos_permitidos" to "anon";

grant references on table "public"."conceptos_permitidos" to "anon";

grant select on table "public"."conceptos_permitidos" to "anon";

grant trigger on table "public"."conceptos_permitidos" to "anon";

grant truncate on table "public"."conceptos_permitidos" to "anon";

grant update on table "public"."conceptos_permitidos" to "anon";

grant delete on table "public"."conceptos_permitidos" to "authenticated";

grant insert on table "public"."conceptos_permitidos" to "authenticated";

grant references on table "public"."conceptos_permitidos" to "authenticated";

grant select on table "public"."conceptos_permitidos" to "authenticated";

grant trigger on table "public"."conceptos_permitidos" to "authenticated";

grant truncate on table "public"."conceptos_permitidos" to "authenticated";

grant update on table "public"."conceptos_permitidos" to "authenticated";

grant delete on table "public"."conceptos_permitidos" to "service_role";

grant insert on table "public"."conceptos_permitidos" to "service_role";

grant references on table "public"."conceptos_permitidos" to "service_role";

grant select on table "public"."conceptos_permitidos" to "service_role";

grant trigger on table "public"."conceptos_permitidos" to "service_role";

grant truncate on table "public"."conceptos_permitidos" to "service_role";

grant update on table "public"."conceptos_permitidos" to "service_role";

grant delete on table "public"."gastos" to "anon";

grant insert on table "public"."gastos" to "anon";

grant references on table "public"."gastos" to "anon";

grant select on table "public"."gastos" to "anon";

grant trigger on table "public"."gastos" to "anon";

grant truncate on table "public"."gastos" to "anon";

grant update on table "public"."gastos" to "anon";

grant delete on table "public"."gastos" to "authenticated";

grant insert on table "public"."gastos" to "authenticated";

grant references on table "public"."gastos" to "authenticated";

grant select on table "public"."gastos" to "authenticated";

grant trigger on table "public"."gastos" to "authenticated";

grant truncate on table "public"."gastos" to "authenticated";

grant update on table "public"."gastos" to "authenticated";

grant delete on table "public"."gastos" to "service_role";

grant insert on table "public"."gastos" to "service_role";

grant references on table "public"."gastos" to "service_role";

grant select on table "public"."gastos" to "service_role";

grant trigger on table "public"."gastos" to "service_role";

grant truncate on table "public"."gastos" to "service_role";

grant update on table "public"."gastos" to "service_role";

grant delete on table "public"."pedido_detalles" to "anon";

grant insert on table "public"."pedido_detalles" to "anon";

grant references on table "public"."pedido_detalles" to "anon";

grant select on table "public"."pedido_detalles" to "anon";

grant trigger on table "public"."pedido_detalles" to "anon";

grant truncate on table "public"."pedido_detalles" to "anon";

grant update on table "public"."pedido_detalles" to "anon";

grant delete on table "public"."pedido_detalles" to "authenticated";

grant insert on table "public"."pedido_detalles" to "authenticated";

grant references on table "public"."pedido_detalles" to "authenticated";

grant select on table "public"."pedido_detalles" to "authenticated";

grant trigger on table "public"."pedido_detalles" to "authenticated";

grant truncate on table "public"."pedido_detalles" to "authenticated";

grant update on table "public"."pedido_detalles" to "authenticated";

grant delete on table "public"."pedido_detalles" to "service_role";

grant insert on table "public"."pedido_detalles" to "service_role";

grant references on table "public"."pedido_detalles" to "service_role";

grant select on table "public"."pedido_detalles" to "service_role";

grant trigger on table "public"."pedido_detalles" to "service_role";

grant truncate on table "public"."pedido_detalles" to "service_role";

grant update on table "public"."pedido_detalles" to "service_role";

grant delete on table "public"."pedidos" to "anon";

grant insert on table "public"."pedidos" to "anon";

grant references on table "public"."pedidos" to "anon";

grant select on table "public"."pedidos" to "anon";

grant trigger on table "public"."pedidos" to "anon";

grant truncate on table "public"."pedidos" to "anon";

grant update on table "public"."pedidos" to "anon";

grant delete on table "public"."pedidos" to "authenticated";

grant insert on table "public"."pedidos" to "authenticated";

grant references on table "public"."pedidos" to "authenticated";

grant select on table "public"."pedidos" to "authenticated";

grant trigger on table "public"."pedidos" to "authenticated";

grant truncate on table "public"."pedidos" to "authenticated";

grant update on table "public"."pedidos" to "authenticated";

grant delete on table "public"."pedidos" to "service_role";

grant insert on table "public"."pedidos" to "service_role";

grant references on table "public"."pedidos" to "service_role";

grant select on table "public"."pedidos" to "service_role";

grant trigger on table "public"."pedidos" to "service_role";

grant truncate on table "public"."pedidos" to "service_role";

grant update on table "public"."pedidos" to "service_role";

grant delete on table "public"."precios_especiales" to "anon";

grant insert on table "public"."precios_especiales" to "anon";

grant references on table "public"."precios_especiales" to "anon";

grant select on table "public"."precios_especiales" to "anon";

grant trigger on table "public"."precios_especiales" to "anon";

grant truncate on table "public"."precios_especiales" to "anon";

grant update on table "public"."precios_especiales" to "anon";

grant delete on table "public"."precios_especiales" to "authenticated";

grant insert on table "public"."precios_especiales" to "authenticated";

grant references on table "public"."precios_especiales" to "authenticated";

grant select on table "public"."precios_especiales" to "authenticated";

grant trigger on table "public"."precios_especiales" to "authenticated";

grant truncate on table "public"."precios_especiales" to "authenticated";

grant update on table "public"."precios_especiales" to "authenticated";

grant delete on table "public"."precios_especiales" to "service_role";

grant insert on table "public"."precios_especiales" to "service_role";

grant references on table "public"."precios_especiales" to "service_role";

grant select on table "public"."precios_especiales" to "service_role";

grant trigger on table "public"."precios_especiales" to "service_role";

grant truncate on table "public"."precios_especiales" to "service_role";

grant update on table "public"."precios_especiales" to "service_role";

grant delete on table "public"."producto_variantes" to "anon";

grant insert on table "public"."producto_variantes" to "anon";

grant references on table "public"."producto_variantes" to "anon";

grant select on table "public"."producto_variantes" to "anon";

grant trigger on table "public"."producto_variantes" to "anon";

grant truncate on table "public"."producto_variantes" to "anon";

grant update on table "public"."producto_variantes" to "anon";

grant delete on table "public"."producto_variantes" to "authenticated";

grant insert on table "public"."producto_variantes" to "authenticated";

grant references on table "public"."producto_variantes" to "authenticated";

grant select on table "public"."producto_variantes" to "authenticated";

grant trigger on table "public"."producto_variantes" to "authenticated";

grant truncate on table "public"."producto_variantes" to "authenticated";

grant update on table "public"."producto_variantes" to "authenticated";

grant delete on table "public"."producto_variantes" to "service_role";

grant insert on table "public"."producto_variantes" to "service_role";

grant references on table "public"."producto_variantes" to "service_role";

grant select on table "public"."producto_variantes" to "service_role";

grant trigger on table "public"."producto_variantes" to "service_role";

grant truncate on table "public"."producto_variantes" to "service_role";

grant update on table "public"."producto_variantes" to "service_role";

grant delete on table "public"."productos" to "anon";

grant insert on table "public"."productos" to "anon";

grant references on table "public"."productos" to "anon";

grant select on table "public"."productos" to "anon";

grant trigger on table "public"."productos" to "anon";

grant truncate on table "public"."productos" to "anon";

grant update on table "public"."productos" to "anon";

grant delete on table "public"."productos" to "authenticated";

grant insert on table "public"."productos" to "authenticated";

grant references on table "public"."productos" to "authenticated";

grant select on table "public"."productos" to "authenticated";

grant trigger on table "public"."productos" to "authenticated";

grant truncate on table "public"."productos" to "authenticated";

grant update on table "public"."productos" to "authenticated";

grant delete on table "public"."productos" to "service_role";

grant insert on table "public"."productos" to "service_role";

grant references on table "public"."productos" to "service_role";

grant select on table "public"."productos" to "service_role";

grant trigger on table "public"."productos" to "service_role";

grant truncate on table "public"."productos" to "service_role";

grant update on table "public"."productos" to "service_role";

grant delete on table "public"."proveedores" to "anon";

grant insert on table "public"."proveedores" to "anon";

grant references on table "public"."proveedores" to "anon";

grant select on table "public"."proveedores" to "anon";

grant trigger on table "public"."proveedores" to "anon";

grant truncate on table "public"."proveedores" to "anon";

grant update on table "public"."proveedores" to "anon";

grant delete on table "public"."proveedores" to "authenticated";

grant insert on table "public"."proveedores" to "authenticated";

grant references on table "public"."proveedores" to "authenticated";

grant select on table "public"."proveedores" to "authenticated";

grant trigger on table "public"."proveedores" to "authenticated";

grant truncate on table "public"."proveedores" to "authenticated";

grant update on table "public"."proveedores" to "authenticated";

grant delete on table "public"."proveedores" to "service_role";

grant insert on table "public"."proveedores" to "service_role";

grant references on table "public"."proveedores" to "service_role";

grant select on table "public"."proveedores" to "service_role";

grant trigger on table "public"."proveedores" to "service_role";

grant truncate on table "public"."proveedores" to "service_role";

grant update on table "public"."proveedores" to "service_role";

grant delete on table "public"."roles" to "anon";

grant insert on table "public"."roles" to "anon";

grant references on table "public"."roles" to "anon";

grant select on table "public"."roles" to "anon";

grant trigger on table "public"."roles" to "anon";

grant truncate on table "public"."roles" to "anon";

grant update on table "public"."roles" to "anon";

grant delete on table "public"."roles" to "authenticated";

grant insert on table "public"."roles" to "authenticated";

grant references on table "public"."roles" to "authenticated";

grant select on table "public"."roles" to "authenticated";

grant trigger on table "public"."roles" to "authenticated";

grant truncate on table "public"."roles" to "authenticated";

grant update on table "public"."roles" to "authenticated";

grant delete on table "public"."roles" to "service_role";

grant insert on table "public"."roles" to "service_role";

grant references on table "public"."roles" to "service_role";

grant select on table "public"."roles" to "service_role";

grant trigger on table "public"."roles" to "service_role";

grant truncate on table "public"."roles" to "service_role";

grant update on table "public"."roles" to "service_role";

grant delete on table "public"."usuarios_staff" to "anon";

grant insert on table "public"."usuarios_staff" to "anon";

grant references on table "public"."usuarios_staff" to "anon";

grant select on table "public"."usuarios_staff" to "anon";

grant trigger on table "public"."usuarios_staff" to "anon";

grant truncate on table "public"."usuarios_staff" to "anon";

grant update on table "public"."usuarios_staff" to "anon";

grant delete on table "public"."usuarios_staff" to "authenticated";

grant insert on table "public"."usuarios_staff" to "authenticated";

grant references on table "public"."usuarios_staff" to "authenticated";

grant select on table "public"."usuarios_staff" to "authenticated";

grant trigger on table "public"."usuarios_staff" to "authenticated";

grant truncate on table "public"."usuarios_staff" to "authenticated";

grant update on table "public"."usuarios_staff" to "authenticated";

grant delete on table "public"."usuarios_staff" to "service_role";

grant insert on table "public"."usuarios_staff" to "service_role";

grant references on table "public"."usuarios_staff" to "service_role";

grant select on table "public"."usuarios_staff" to "service_role";

grant trigger on table "public"."usuarios_staff" to "service_role";

grant truncate on table "public"."usuarios_staff" to "service_role";

grant update on table "public"."usuarios_staff" to "service_role";


  create policy "Permitir lectura de categorias a staff"
  on "public"."categorias_gasto"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Permitir lectura publica de clientes"
  on "public"."clientes"
  as permissive
  for select
  to public
using (true);



  create policy "allow_delete_clientes"
  on "public"."clientes"
  as permissive
  for delete
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "allow_insert_clientes"
  on "public"."clientes"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));



  create policy "allow_select_clientes"
  on "public"."clientes"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "allow_update_clientes"
  on "public"."clientes"
  as permissive
  for update
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Permitir lectura de conceptos a staff"
  on "public"."conceptos_permitidos"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Permitir insertar gastos"
  on "public"."gastos"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Permitir leer gastos"
  on "public"."gastos"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Permitir inserción de detalles"
  on "public"."pedido_detalles"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Permitir solo inserción de detalles"
  on "public"."pedido_detalles"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Permitir inserción de pedidos"
  on "public"."pedidos"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Permitir inserción total"
  on "public"."pedidos"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Permitir lectura publica de precios"
  on "public"."precios_especiales"
  as permissive
  for select
  to public
using (true);



  create policy "Permitir lectura pública de variantes"
  on "public"."producto_variantes"
  as permissive
  for select
  to public
using (true);



  create policy "Permitir lectura pública de productos"
  on "public"."productos"
  as permissive
  for select
  to public
using (true);



  create policy "Permitir insertar proveedores"
  on "public"."proveedores"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Permitir lectura de proveedores a staff"
  on "public"."proveedores"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Permitir lectura de staff"
  on "public"."usuarios_staff"
  as permissive
  for select
  to public
using ((auth.uid() = supabase_auth_id));



