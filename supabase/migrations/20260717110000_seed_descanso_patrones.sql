-- =========================================================================
-- SEED: Patrones de descanso por defecto para restaurantes
-- Ejecutar después de la migración de tablas
-- =========================================================================

-- Patrón A: Descanso semanal (Martes)
INSERT INTO public.patrones_descanso (empresa_id, nombre, tipo_patron)
SELECT id, 'Semana A (Martes)', 'semanal'
FROM public.empresas
WHERE NOT EXISTS (
    SELECT 1 FROM public.patrones_descanso WHERE empresa_id = empresas.id AND nombre = 'Semana A (Martes)'
);

-- Días del Patrón A (Martes = día 2)
INSERT INTO public.patron_descanso_dias (patron_id, semana_idx, dia_semana, es_descanso)
SELECT pd.id, 0, 2, TRUE
FROM public.patrones_descanso pd
WHERE pd.nombre = 'Semana A (Martes)'
AND NOT EXISTS (
    SELECT 1 FROM public.patron_descanso_dias
    WHERE patron_id = pd.id AND semana_idx = 0 AND dia_semana = 2
);

-- Patrón B: Descanso quincenal (Martes + Miércoles)
INSERT INTO public.patrones_descanso (empresa_id, nombre, tipo_patron)
SELECT id, 'Semana B (Martes+Miércoles)', 'quincenal'
FROM public.empresas
WHERE NOT EXISTS (
    SELECT 1 FROM public.patrones_descanso WHERE empresa_id = empresas.id AND nombre = 'Semana B (Martes+Miércoles)'
);

-- Días del Patrón B (Semana 0: Martes=2 y Miércoles=3 como descanso)
INSERT INTO public.patron_descanso_dias (patron_id, semana_idx, dia_semana, es_descanso)
SELECT pd.id, 0, 2, TRUE
FROM public.patrones_descanso pd
WHERE pd.nombre = 'Semana B (Martes+Miércoles)'
AND NOT EXISTS (
    SELECT 1 FROM public.patron_descanso_dias
    WHERE patron_id = pd.id AND semana_idx = 0 AND dia_semana = 2
);

INSERT INTO public.patron_descanso_dias (patron_id, semana_idx, dia_semana, es_descanso)
SELECT pd.id, 0, 3, TRUE
FROM public.patrones_descanso pd
WHERE pd.nombre = 'Semana B (Martes+Miércoles)'
AND NOT EXISTS (
    SELECT 1 FROM public.patron_descanso_dias
    WHERE patron_id = pd.id AND semana_idx = 0 AND dia_semana = 3
);

-- Semana 1 del Patrón B: solo Miércoles=3 (cuando alterna, patrón alternado)
INSERT INTO public.patron_descanso_dias (patron_id, semana_idx, dia_semana, es_descanso)
SELECT pd.id, 1, 3, TRUE
FROM public.patrones_descanso pd
WHERE pd.nombre = 'Semana B (Martes+Miércoles)'
AND NOT EXISTS (
    SELECT 1 FROM public.patron_descanso_dias
    WHERE patron_id = pd.id AND semana_idx = 1 AND dia_semana = 3
);
