/*
  Supabase migration: estructura inicial de la base de datos para Seimenjo‑ERP
  Incluye tablas esenciales usadas por la UI admin:
    - productos
    - clientes
    - facturas
    - gastos
    - egresos
    - staff
  Cada tabla tiene una columna `id` UUID generada automáticamente y timestamps.
*/

create extension if not exists "uuid-ossp";

-- Tabla productos
create table if not exists productos (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  descripcion text,
  precio numeric(12,2) not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tabla clientes
create table if not exists clientes (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  email text unique,
  telefono text,
  direccion text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tabla facturas (relacionada con cliente y productos)
create table if not exists facturas (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references clientes(id) on delete cascade,
  fecha timestamp with time zone default now(),
  total numeric(12,2) not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tabla detalle_factura (productos asociados a una factura)
create table if not exists detalle_factura (
  id uuid primary key default uuid_generate_v4(),
  factura_id uuid references facturas(id) on delete cascade,
  producto_id uuid references productos(id) on delete restrict,
  cantidad integer not null default 1,
  precio_unitario numeric(12,2) not null,
  created_at timestamp with time zone default now()
);

-- Tabla gastos
create table if not exists gastos (
  id uuid primary key default uuid_generate_v4(),
  descripcion text not null,
  monto numeric(12,2) not null,
  fecha timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Tabla egresos
create table if not exists egresos (
  id uuid primary key default uuid_generate_v4(),
  descripcion text not null,
  monto numeric(12,2) not null,
  fecha timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Tabla staff (empleados)
create table if not exists staff (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  email text unique,
  rol text,
  creado_en timestamp with time zone default now(),
  actualizado_en timestamp with time zone default now()
);

-- Índices comunes para mejorar búsquedas
create index if not exists idx_productos_nombre on productos(nombre);
create index if not exists idx_clientes_nombre on clientes(nombre);
create index if not exists idx_facturas_cliente on facturas(cliente_id);
