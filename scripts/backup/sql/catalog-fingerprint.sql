-- Definition-level fingerprint of the database catalog. Read-only.
-- One row per object: (kind, identity, detail). "detail" holds the object's attributes and an MD5 of
-- its full definition (pg_get_functiondef, pg_get_triggerdef, policy expressions, view and index
-- definitions, column lists, constraint definitions) plus its permissions, expanded from the ACL and
-- sorted (grantee:privilege, '*' = WITH GRANT OPTION). The same query runs on production and on the
-- restored copy; every row must match exactly.
-- Extension member objects are excluded on both sides (CREATE EXTENSION recreates them).
-- The local restore-test superuser "zarman_restore_admin" is ignored.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
-- Names in deparsed definitions depend on search_path; pin it so both sides print them identically.
SET LOCAL search_path = pg_catalog;
COPY (
WITH member AS (
  SELECT classid, objid FROM pg_depend WHERE deptype = 'e'
), ns AS (
  SELECT s.oid, s.nspname, s.nspowner, s.nspacl FROM pg_namespace s
  WHERE s.nspname <> 'information_schema' AND s.nspname !~ '^pg_'
    AND NOT EXISTS (SELECT 1 FROM member m WHERE m.classid = 'pg_namespace'::regclass AND m.objid = s.oid)
), rel AS (
  SELECT c.oid, c.relname, c.relkind, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity,
         c.relpersistence, c.reloptions, c.relispartition, c.relpartbound, n.nspname
  FROM pg_class c JOIN ns n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f', 'c')
    AND NOT EXISTS (SELECT 1 FROM member m WHERE m.classid = 'pg_class'::regclass AND m.objid = c.oid)
)
SELECT kind, identity, detail FROM (
  SELECT 'schema' AS kind, n.nspname::text AS identity,
         'owner=' || pg_get_userbyid(n.nspowner)
         || ' acl=' || array_to_string(array(
              SELECT v FROM (
                SELECT (CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END) || ':' || a.privilege_type
                       || (CASE WHEN a.is_grantable THEN '*' ELSE '' END) AS v
                FROM aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a) z
              ORDER BY v COLLATE "C"), ',')
         -- pg_dump never dumps privileges that equal an extension's initial privileges (pg_init_privs 'e');
         -- the platform/extension recreates them. Marked so the comparison can report them, not fail on them.
         || CASE WHEN EXISTS (SELECT 1 FROM pg_init_privs ip WHERE ip.classoid = 'pg_namespace'::regclass AND ip.objoid = n.oid
                              AND ip.privtype = 'e' AND ip.initprivs = n.nspacl)
                 THEN ' acl_source=extension-initial' ELSE '' END AS detail
  FROM ns n

  UNION ALL
  SELECT 'relation', c.nspname || '.' || c.relname,
         'kind=' || c.relkind::text || ' owner=' || pg_get_userbyid(c.relowner)
         || ' rls=' || c.relrowsecurity || ' force_rls=' || c.relforcerowsecurity
         || ' persistence=' || c.relpersistence::text || ' options=' || coalesce(array_to_string(c.reloptions, ','), '')
         || ' partition_of=' || coalesce((SELECT pn.nspname || '.' || pc.relname FROM pg_inherits i JOIN pg_class pc ON pc.oid = i.inhparent
                                          JOIN pg_namespace pn ON pn.oid = pc.relnamespace WHERE i.inhrelid = c.oid AND c.relispartition), '')
         || ' bound=' || coalesce(pg_get_expr(c.relpartbound, c.oid), '')
         || ' columns=' || md5(array_to_string(array(
              SELECT a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
                     || (CASE WHEN a.attnotnull THEN ' not-null' ELSE '' END)
                     || coalesce(' default=' || pg_get_expr(ad.adbin, ad.adrelid), '')
                     || (CASE WHEN a.attidentity::text <> '' THEN ' identity=' || a.attidentity::text ELSE '' END)
                     || (CASE WHEN a.attgenerated::text <> '' THEN ' generated=' || a.attgenerated::text ELSE '' END)
                     || coalesce(' collate=' || co.collname, '')
              FROM pg_attribute a
              LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
              LEFT JOIN pg_collation co ON co.oid = a.attcollation AND co.collname <> 'default'
              WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
              ORDER BY a.attnum), '|'))
         || (CASE WHEN c.relkind IN ('v', 'm') THEN ' view=' || md5(pg_get_viewdef(c.oid)) ELSE '' END)
         || (CASE WHEN c.relkind = 'S' THEN ' sequence=' || coalesce((
              SELECT format_type(s.seqtypid, NULL) || '/' || s.seqstart || '/' || s.seqincrement || '/' || s.seqmin || '/' || s.seqmax
                     || '/' || s.seqcache || '/' || s.seqcycle
              FROM pg_sequence s WHERE s.seqrelid = c.oid), '') ELSE '' END)
         || (CASE WHEN c.relkind <> 'c' THEN ' acl=' || array_to_string(array(
              SELECT v FROM (
                SELECT (CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END) || ':' || a.privilege_type
                       || (CASE WHEN a.is_grantable THEN '*' ELSE '' END) AS v
                FROM aclexplode(coalesce(c.relacl, acldefault(CASE WHEN c.relkind = 'S' THEN 's'::"char" ELSE 'r'::"char" END, c.relowner))) a) z
              ORDER BY v COLLATE "C"), ',') ELSE '' END)
  FROM rel c

  UNION ALL
  SELECT 'column_acl', c.nspname || '.' || c.relname || '.' || a.attname,
         array_to_string(array(
           SELECT v FROM (
             SELECT (CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END) || ':' || x.privilege_type
                    || (CASE WHEN x.is_grantable THEN '*' ELSE '' END) AS v
             FROM aclexplode(a.attacl) x) z
           ORDER BY v COLLATE "C"), ',')
  FROM rel c JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE a.attacl IS NOT NULL AND a.attnum > 0 AND NOT a.attisdropped

  UNION ALL
  SELECT 'constraint', n.nspname || '.' || coalesce(cr.relname, ct.typname) || '.' || k.conname,
         'type=' || k.contype::text || ' deferrable=' || k.condeferrable || '/' || k.condeferred
         || ' validated=' || k.convalidated || ' def=' || md5(pg_get_constraintdef(k.oid))
  FROM pg_constraint k
  JOIN ns n ON n.oid = k.connamespace
  LEFT JOIN pg_class cr ON cr.oid = k.conrelid
  LEFT JOIN pg_type ct ON ct.oid = k.contypid
  WHERE NOT EXISTS (SELECT 1 FROM member m WHERE m.classid = 'pg_class'::regclass AND m.objid = k.conrelid)
    AND NOT EXISTS (SELECT 1 FROM member m WHERE m.classid = 'pg_type'::regclass AND m.objid = k.contypid)

  UNION ALL
  SELECT 'index', n.nspname || '.' || tc.relname || '.' || ic.relname, md5(pg_get_indexdef(ic.oid))
  FROM pg_index x
  JOIN pg_class ic ON ic.oid = x.indexrelid
  JOIN pg_class tc ON tc.oid = x.indrelid
  JOIN ns n ON n.oid = ic.relnamespace
  WHERE NOT EXISTS (SELECT 1 FROM member m WHERE m.classid = 'pg_class'::regclass AND m.objid = x.indrelid)

  UNION ALL
  SELECT 'function', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'kind=' || p.prokind::text || ' owner=' || pg_get_userbyid(p.proowner) || ' security_definer=' || p.prosecdef
         || ' config=' || coalesce(array_to_string(p.proconfig, ';'), '')
         || ' def=' || md5(CASE WHEN p.prokind IN ('f', 'p', 'w') THEN pg_get_functiondef(p.oid) ELSE coalesce(p.prosrc, '') END)
         || ' acl=' || array_to_string(array(
              SELECT v FROM (
                SELECT (CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END) || ':' || a.privilege_type
                       || (CASE WHEN a.is_grantable THEN '*' ELSE '' END) AS v
                FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a) z
              ORDER BY v COLLATE "C"), ',')
  FROM pg_proc p JOIN ns n ON n.oid = p.pronamespace
  WHERE NOT EXISTS (SELECT 1 FROM member m WHERE m.classid = 'pg_proc'::regclass AND m.objid = p.oid)

  UNION ALL
  SELECT 'trigger', c.nspname || '.' || c.relname || '.' || t.tgname,
         'enabled=' || t.tgenabled::text || ' def=' || md5(pg_get_triggerdef(t.oid))
  FROM pg_trigger t JOIN rel c ON c.oid = t.tgrelid
  WHERE NOT t.tgisinternal

  UNION ALL
  SELECT 'policy', c.nspname || '.' || c.relname || '.' || p.polname,
         'permissive=' || p.polpermissive || ' cmd=' || p.polcmd::text
         || ' roles=' || array_to_string(array(
              SELECT v FROM (SELECT CASE WHEN r = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END AS v FROM unnest(p.polroles) r) z
              ORDER BY v COLLATE "C"), ',')
         || ' using=' || md5(coalesce(pg_get_expr(p.polqual, p.polrelid), ''))
         || ' check=' || md5(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''))
  FROM pg_policy p JOIN rel c ON c.oid = p.polrelid

  UNION ALL
  SELECT 'type', n.nspname || '.' || t.typname,
         'typtype=' || t.typtype::text || ' owner=' || pg_get_userbyid(t.typowner)
         || (CASE WHEN t.typtype = 'e' THEN ' labels=' || md5(array_to_string(array(
               SELECT e.enumlabel FROM pg_enum e WHERE e.enumtypid = t.oid ORDER BY e.enumsortorder), ',')) ELSE '' END)
         || (CASE WHEN t.typtype = 'd' THEN ' base=' || format_type(t.typbasetype, t.typtypmod) || ' not_null=' || t.typnotnull
               || ' default=' || coalesce(t.typdefault, '') ELSE '' END)
  FROM pg_type t JOIN ns n ON n.oid = t.typnamespace
  WHERE t.typtype IN ('e', 'd')
    AND NOT EXISTS (SELECT 1 FROM member m WHERE m.classid = 'pg_type'::regclass AND m.objid = t.oid)

  UNION ALL
  SELECT 'publication', p.pubname::text,
         'owner=' || pg_get_userbyid(p.pubowner) || ' all_tables=' || p.puballtables
         || ' ops=' || p.pubinsert || '/' || p.pubupdate || '/' || p.pubdelete || '/' || p.pubtruncate
         || ' tables=' || array_to_string(array(
              SELECT v FROM (SELECT pt.schemaname || '.' || pt.tablename AS v FROM pg_publication_tables pt WHERE pt.pubname = p.pubname) z
              ORDER BY v COLLATE "C"), ',')
  FROM pg_publication p

  UNION ALL
  SELECT 'event_trigger', e.evtname::text,
         'event=' || e.evtevent || ' function=' || e.evtfoid::regproc::text || ' enabled=' || e.evtenabled::text
         || ' tags=' || coalesce(array_to_string(e.evttags, ','), '') || ' owner=' || pg_get_userbyid(e.evtowner)
  FROM pg_event_trigger e

  UNION ALL
  SELECT 'default_acl', pg_get_userbyid(d.defaclrole) || '/' || coalesce(n.nspname, '*') || '/' || d.defaclobjtype::text,
         array_to_string(array(
           SELECT v FROM (
             SELECT (CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END) || ':' || a.privilege_type
                    || (CASE WHEN a.is_grantable THEN '*' ELSE '' END) AS v
             FROM aclexplode(d.defaclacl) a) z
           ORDER BY v COLLATE "C"), ',')
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace

  UNION ALL
  SELECT 'role', r.rolname::text,
         'super=' || r.rolsuper || ' inherit=' || r.rolinherit || ' createrole=' || r.rolcreaterole || ' createdb=' || r.rolcreatedb
         || ' login=' || r.rolcanlogin || ' replication=' || r.rolreplication || ' bypassrls=' || r.rolbypassrls || ' connlimit=' || r.rolconnlimit
         || ' settings=' || coalesce((
              SELECT array_to_string(array(SELECT v FROM (SELECT x AS v FROM unnest(s.setconfig) x) z ORDER BY v COLLATE "C"), ';')
              FROM pg_db_role_setting s WHERE s.setrole = r.oid AND s.setdatabase = 0), '')
         || ' member_of=' || array_to_string(array(
              SELECT v FROM (
                SELECT b.rolname || (CASE WHEN m.admin_option THEN '(admin)' ELSE '' END)
                       || (CASE WHEN m.inherit_option THEN '' ELSE '(noinherit)' END)
                       || (CASE WHEN m.set_option THEN '' ELSE '(noset)' END) AS v
                FROM pg_auth_members m JOIN pg_roles b ON b.oid = m.roleid WHERE m.member = r.oid) z
              ORDER BY v COLLATE "C"), ',')
  FROM pg_roles r
  WHERE r.rolname !~ '^pg_' AND r.rolname <> 'zarman_restore_admin'
) f
ORDER BY kind COLLATE "C", identity COLLATE "C"
) TO STDOUT WITH (FORMAT csv, HEADER);
COMMIT;
