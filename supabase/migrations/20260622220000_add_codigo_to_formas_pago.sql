-- Agregar columna codigo a formas_pago
ALTER TABLE public.formas_pago ADD COLUMN IF NOT EXISTS codigo TEXT;

-- Extraer códigos de los nombres existentes (ej. "01 - Efectivo" -> codigo = '01', nombre = 'Efectivo')
UPDATE public.formas_pago 
SET codigo = substring(nombre from '^([0-9]{2})'),
    nombre = substring(nombre from '^[0-9]{2}\s*-\s*(.*)$')
WHERE nombre ~ '^[0-9]{2}\s*-\s*';

-- Ajustes de respaldo para nombres estándar (en caso de que no tuvieran prefijo)
UPDATE public.formas_pago SET codigo = '01', nombre = 'Efectivo' WHERE (nombre = 'Efectivo' OR nombre = 'Efectivo') AND codigo IS NULL;
UPDATE public.formas_pago SET codigo = '02', nombre = 'Cheque nominativo' WHERE (nombre = 'Cheque' OR nombre = 'Cheque nominativo') AND codigo IS NULL;
UPDATE public.formas_pago SET codigo = '03', nombre = 'Transferencia electrónica' WHERE (nombre = 'Transferencia' OR nombre = 'Transferencia electrónica') AND codigo IS NULL;
UPDATE public.formas_pago SET codigo = '04', nombre = 'Tarjeta de crédito' WHERE (nombre = 'Tarjeta de crédito' OR nombre = 'Tarjeta de Crédito') AND codigo IS NULL;
UPDATE public.formas_pago SET codigo = '28', nombre = 'Tarjeta de débito' WHERE (nombre = 'Tarjeta de débito' OR nombre = 'Tarjeta de Débito') AND codigo IS NULL;
UPDATE public.formas_pago SET codigo = '99', nombre = 'Por definir' WHERE (nombre = 'Por definir' OR nombre = 'Por definir') AND codigo IS NULL;

-- Asignar 99 por defecto a cualquier nulo restante
UPDATE public.formas_pago SET codigo = '99' WHERE codigo IS NULL;

-- Eliminar posibles duplicados antes de aplicar el UNIQUE constraint
DELETE FROM public.formas_pago a USING public.formas_pago b 
WHERE a.id > b.id AND a.codigo = b.codigo;

-- Agregar restricción UNIQUE
ALTER TABLE public.formas_pago DROP CONSTRAINT IF EXISTS formas_pago_codigo_key;
ALTER TABLE public.formas_pago ADD CONSTRAINT formas_pago_codigo_key UNIQUE (codigo);

-- Limpiar los valores de metodo_pago en gastos (almacenar únicamente el código numérico de 2 dígitos)
UPDATE public.gastos 
SET metodo_pago = substring(metodo_pago from '^([0-9]{2})')
WHERE metodo_pago ~ '^[0-9]{2}';

UPDATE public.gastos SET metodo_pago = '01' WHERE metodo_pago = 'Efectivo';
UPDATE public.gastos SET metodo_pago = '03' WHERE metodo_pago = 'Transferencia';
UPDATE public.gastos SET metodo_pago = '02' WHERE metodo_pago = 'Cheque';
UPDATE public.gastos SET metodo_pago = '04' WHERE metodo_pago ILIKE '%crédito%' OR metodo_pago ILIKE '%tarjeta%crédito%';
UPDATE public.gastos SET metodo_pago = '28' WHERE metodo_pago ILIKE '%débito%' OR metodo_pago ILIKE '%tarjeta%débito%';
UPDATE public.gastos SET metodo_pago = '99' WHERE metodo_pago = 'Por definir' OR metodo_pago IS NULL;

-- Limpiar los valores de metodo_pago en pedidos (almacenar únicamente el código numérico de 2 dígitos)
UPDATE public.pedidos 
SET metodo_pago = substring(metodo_pago from '^([0-9]{2})')
WHERE metodo_pago ~ '^[0-9]{2}';

UPDATE public.pedidos SET metodo_pago = '01' WHERE metodo_pago = 'Efectivo';
UPDATE public.pedidos SET metodo_pago = '03' WHERE metodo_pago = 'Transferencia';
UPDATE public.pedidos SET metodo_pago = '02' WHERE metodo_pago = 'Cheque';
UPDATE public.pedidos SET metodo_pago = '04' WHERE metodo_pago ILIKE '%crédito%' OR metodo_pago ILIKE '%tarjeta%crédito%';
UPDATE public.pedidos SET metodo_pago = '28' WHERE metodo_pago ILIKE '%débito%' OR metodo_pago ILIKE '%tarjeta%débito%';
UPDATE public.pedidos SET metodo_pago = '99' WHERE metodo_pago = 'Por definir' OR metodo_pago IS NULL;
