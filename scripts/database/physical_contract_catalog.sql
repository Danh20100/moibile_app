WITH trooi_tables AS (
    SELECT c.oid, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname <> 'spatial_ref_sys'
      AND c.relname <> 'schema_migrations'
), constraints AS (
    SELECT con.conname, con.contype
    FROM pg_constraint con
    JOIN trooi_tables t ON t.oid = con.conrelid
), explicit_indexes AS (
    SELECT idx.relname
    FROM pg_index i
    JOIN trooi_tables t ON t.oid = i.indrelid
    JOIN pg_class idx ON idx.oid = i.indexrelid
    LEFT JOIN pg_constraint con ON con.conindid = i.indexrelid
    WHERE con.oid IS NULL
)
SELECT json_build_object(
    'tables', (SELECT COALESCE(json_agg(relname ORDER BY relname), '[]'::json) FROM trooi_tables),
    'primaryKeys', (SELECT COALESCE(json_agg(conname ORDER BY conname), '[]'::json) FROM constraints WHERE contype = 'p'),
    'foreignKeys', (SELECT COALESCE(json_agg(conname ORDER BY conname), '[]'::json) FROM constraints WHERE contype = 'f'),
    'checks', (SELECT COALESCE(json_agg(conname ORDER BY conname), '[]'::json) FROM constraints WHERE contype = 'c'),
    'uniqueConstraints', (SELECT COALESCE(json_agg(conname ORDER BY conname), '[]'::json) FROM constraints WHERE contype = 'u'),
    'indexes', (SELECT COALESCE(json_agg(relname ORDER BY relname), '[]'::json) FROM explicit_indexes)
);
