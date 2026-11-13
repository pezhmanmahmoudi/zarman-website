-- Installed extensions and the objects that belong to them. Read-only.
-- Used to leave out only the entries of extensions that do not exist in the local restore-test
-- server (Supabase-only extensions), and to report them by name.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
-- Names in deparsed definitions depend on search_path; pin it so both sides print them identically.
SET LOCAL search_path = pg_catalog;
COPY (
  SELECT e.extname AS extension, e.extversion AS version, 'extension' AS member_kind,
         n.nspname AS schema_name, e.extname AS member_name, e.oid::bigint AS member_oid,
         'pg_extension'::regclass::oid::bigint AS member_classid
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  UNION ALL
  SELECT e.extname, e.extversion,
         CASE d.classid
           WHEN 'pg_class'::regclass THEN (SELECT CASE c.relkind WHEN 'S' THEN 'sequence' WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized view' ELSE 'table' END FROM pg_class c WHERE c.oid = d.objid)
           WHEN 'pg_proc'::regclass THEN 'function'
           WHEN 'pg_type'::regclass THEN 'type'
           WHEN 'pg_namespace'::regclass THEN 'schema'
           ELSE 'other' END,
         coalesce(
           (SELECT n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE d.classid = 'pg_class'::regclass AND c.oid = d.objid),
           (SELECT n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE d.classid = 'pg_proc'::regclass AND p.oid = d.objid),
           (SELECT n.nspname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE d.classid = 'pg_type'::regclass AND t.oid = d.objid),
           '-'),
         coalesce(
           (SELECT c.relname::text FROM pg_class c WHERE d.classid = 'pg_class'::regclass AND c.oid = d.objid),
           (SELECT p.proname::text FROM pg_proc p WHERE d.classid = 'pg_proc'::regclass AND p.oid = d.objid),
           (SELECT t.typname::text FROM pg_type t WHERE d.classid = 'pg_type'::regclass AND t.oid = d.objid),
           (SELECT s.nspname::text FROM pg_namespace s WHERE d.classid = 'pg_namespace'::regclass AND s.oid = d.objid),
           pg_describe_object(d.classid, d.objid, d.objsubid)),
         d.objid::bigint,
         d.classid::bigint
  FROM pg_depend d JOIN pg_extension e ON e.oid = d.refobjid
  WHERE d.refclassid = 'pg_extension'::regclass AND d.deptype = 'e'
  ORDER BY 1, 3, 4, 5
) TO STDOUT WITH (FORMAT csv, HEADER);
COMMIT;
