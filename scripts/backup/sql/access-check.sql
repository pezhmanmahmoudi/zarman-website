-- Objects pg_dump must read that the connected role cannot. Read-only.
-- "required" = customer, financial, Auth and Storage data; any row there makes the backup fail.
-- Extension member objects are recreated by CREATE EXTENSION, except extension config tables,
-- whose rows pg_dump copies, so those are checked too.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
-- Names in deparsed definitions depend on search_path; pin it so both sides print them identically.
SET LOCAL search_path = pg_catalog;
COPY (
  SELECT n.nspname AS schema_name,
         c.relname AS object_name,
         c.relkind::text AS kind,
         CASE WHEN n.nspname IN ('public', 'auth', 'storage', 'supabase_migrations') THEN 'required' ELSE 'managed' END AS class
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'm', 'S')
    AND n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
    AND (NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
         OR EXISTS (SELECT 1 FROM pg_extension e WHERE c.oid = ANY (e.extconfig)))
    AND NOT (CASE WHEN c.relkind = 'S' THEN has_sequence_privilege(c.oid, 'SELECT') ELSE has_table_privilege(c.oid, 'SELECT') END)
  UNION ALL
  SELECT n.nspname, '(schema)', 'n',
         CASE WHEN n.nspname IN ('public', 'auth', 'storage', 'supabase_migrations') THEN 'required' ELSE 'managed' END
  FROM pg_namespace n
  WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_' AND NOT has_schema_privilege(n.oid, 'USAGE')
  ORDER BY 1, 2
) TO STDOUT WITH (FORMAT csv, HEADER);
COMMIT;
