-- Authoritative Storage inventory from storage.buckets / storage.objects, as one JSON document.
-- Read-only. Every file must be downloaded and match this size, ETag (MD5) and content type.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
-- Names in deparsed definitions depend on search_path; pin it so both sides print them identically.
SET LOCAL search_path = pg_catalog;
SELECT json_build_object(
  'buckets', coalesce((SELECT json_agg(json_build_object(
      'id', b.id, 'public', b.public, 'file_size_limit', b.file_size_limit, 'allowed_mime_types', b.allowed_mime_types)
    ORDER BY b.id) FROM storage.buckets b), '[]'::json),
  'objects', coalesce((SELECT json_agg(json_build_object(
      'bucket', o.bucket_id, 'name', o.name, 'id', o.id,
      'size', (o.metadata ->> 'size')::bigint,
      'etag', o.metadata ->> 'eTag',
      'mimetype', o.metadata ->> 'mimetype',
      'updated_at', o.updated_at)
    ORDER BY o.bucket_id, o.name) FROM storage.objects o), '[]'::json)
);
COMMIT;
