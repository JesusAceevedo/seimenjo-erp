-- Actualización de catálogo de Formas de Pago para coincidir con SAT y ordenar por uso común

-- Actualizar temporalmente referencias en gastos para evitar errores de llave foránea (si las hubiera, aunque metodo_pago es text en gastos)
UPDATE public.formas_pago SET nombre = 'Tarjeta de Débito' WHERE nombre = 'Tarjeta de Crédito / Débito';

INSERT INTO public.formas_pago (nombre) VALUES 
('Efectivo'),
('Transferencia'),
('Tarjeta de Crédito'),
('Tarjeta de Débito'),
('Cheque'),
('Por definir')
ON CONFLICT (nombre) DO NOTHING;

-- Asegurar orden lógico agregando un campo de orden si no existe, 
-- pero como no tenemos campo de orden en la tabla, nos aseguraremos de ordenar en el frontend o usar los IDs creados.
