SELECT 
    table_name AS tabla,
    column_name AS columna,
    data_type AS tipo_dato,
    is_nullable AS permite_nulos
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
ORDER BY 
    table_name, 
    ordinal_position;