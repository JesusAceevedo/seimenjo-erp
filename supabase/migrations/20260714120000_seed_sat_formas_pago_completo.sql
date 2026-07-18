-- Poblar tabla formas_pago con el catálogo completo de Formas de Pago del SAT (c_FormaPago CFDI 4.0)
-- Los registros existentes se actualizan; los nuevos se insertan.

INSERT INTO public.formas_pago (nombre, codigo) VALUES
  ('Efectivo', '01'),
  ('Cheque nominativo', '02'),
  ('Transferencia electrónica', '03'),
  ('Tarjeta de crédito', '04'),
  ('Monedero electrónico', '05'),
  ('Dinero electrónico', '06'),
  ('Vales de despensa', '08'),
  ('Dación en pago', '12'),
  ('Pago por subrogación', '13'),
  ('Pago por consignación', '14'),
  ('Condonación', '15'),
  ('Compensación', '17'),
  ('Novación', '23'),
  ('Confusión', '24'),
  ('Remisión de deuda', '25'),
  ('Prescripción o caducidad', '26'),
  ('A satisfacción del acreedor', '27'),
  ('Tarjeta de débito', '28'),
  ('Tarjeta de servicios', '29'),
  ('Aplicación de anticipos', '30'),
  ('Intermediario pagos', '31'),
  ('Por definir', '99')
ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre;

-- Recargar cache del esquema
NOTIFY pgrst, 'reload schema';
