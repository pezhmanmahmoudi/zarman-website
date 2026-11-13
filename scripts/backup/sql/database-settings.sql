-- Database-level properties (locale, encoding, ALTER DATABASE ... SET values). Read-only.
-- pg_dump --create stores these in the dump; they are also exported here for the report.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
-- Names in deparsed definitions depend on search_path; pin it so both sides print them identically.
SET LOCAL search_path = pg_catalog;
COPY (
  SELECT 'locale_provider' AS k, datlocprovider::text AS v FROM pg_database WHERE datname = current_database()
  UNION ALL SELECT 'icu_locale', coalesce(datlocale, '') FROM pg_database WHERE datname = current_database()
  UNION ALL SELECT 'encoding', pg_encoding_to_char(encoding) FROM pg_database WHERE datname = current_database()
  UNION ALL SELECT 'server_version_num', current_setting('server_version_num')
  UNION ALL SELECT 'setting:' || split_part(s.c, '=', 1), substr(s.c, length(split_part(s.c, '=', 1)) + 2)
  FROM pg_db_role_setting r CROSS JOIN LATERAL unnest(r.setconfig) AS s(c)
  WHERE r.setrole = 0 AND r.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
  ORDER BY 1
) TO STDOUT WITH (FORMAT csv, HEADER);
COMMIT;
