CREATE POLICY "Permitir todo a usuarios autenticados en categorias_gasto" 
ON public.categorias_gasto FOR ALL TO authenticated 
USING (true) WITH CHECK (true);


