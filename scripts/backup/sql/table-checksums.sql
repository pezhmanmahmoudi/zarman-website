-- Row count and a content checksum for every table that holds data (all schemas, including auth,
-- storage and Supabase-managed ones). Read-only. The checksum is the MD5 of the sorted per-row MD5s
-- of each row's text form, rendered with fixed session settings so the production and restored
-- values are directly comparable. Partitioned parents are skipped (their rows live in the partitions).
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
-- Names in deparsed definitions depend on search_path; pin it so both sides print them identically.
SET LOCAL search_path = pg_catalog;
SET LOCAL TimeZone = 'UTC';
SET LOCAL DateStyle = 'ISO, YMD';
SET LOCAL IntervalStyle = 'postgres';
SET LOCAL extra_float_digits = 3;
SET LOCAL bytea_output = 'hex';
COPY (
  WITH t AS (
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
      AND has_table_privilege(c.oid, 'SELECT')
      AND (NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e')
           OR EXISTS (SELECT 1 FROM pg_extension e WHERE c.oid = ANY (e.extconfig)))
  ), x AS (
    SELECT nspname, relname,
           query_to_xml(format(
             'SELECT count(*) AS n, md5(coalesce(string_agg(h, %L ORDER BY h COLLATE "C"), %L)) AS h FROM (SELECT md5(r::text) AS h FROM %I.%I r) s',
             '', '', nspname, relname), false, true, '') AS doc
    FROM t
  )
  SELECT nspname AS schema_name,
         relname AS table_name,
         (xpath('/row/n/text()', doc))[1]::text::bigint AS row_count,
         (xpath('/row/h/text()', doc))[1]::text AS content_md5
  FROM x
  ORDER BY 1, 2
) TO STDOUT WITH (FORMAT csv, HEADER);
COMMIT;
