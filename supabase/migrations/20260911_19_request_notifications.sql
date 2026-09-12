-- Durable request mail delivery. Apply after 20260911_18 customer-request schema.
-- Service-role-only RPCs; public request writes cannot call or edit this outbox.
begin;

create table if not exists public.exchange_request_email_events (
  event_id text primary key check (length(event_id) between 1 and 200),
  event_type text not null check (length(event_type) between 1 and 80),
  provider_id text,
  occurred_at timestamptz not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  received_at timestamptz not null default now()
);
create index if not exists exchange_request_email_events_provider_idx on public.exchange_request_email_events(provider_id);
create unique index if not exists exchange_request_notification_provider_idx on public.exchange_request_notification_deliveries(provider_id) where provider_id is not null;
create index if not exists exchange_request_notification_retry_idx on public.exchange_request_notification_deliveries(next_attempt_at, created_at) where status in ('pending', 'leased');

alter table public.exchange_request_email_events enable row level security;
revoke all on public.exchange_request_email_events from public, anon, authenticated;
grant select, insert, update on public.exchange_request_email_events to service_role;

-- Aggregate verified facts, rather than trusting callback arrival order. A
-- callback may arrive before the worker records provider acceptance.
create or replace function public.apply_request_email_events(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d public.exchange_request_notification_deliveries%rowtype;
  accepted_time timestamptz;
  delivered_time timestamptz;
  has_bounce boolean;
  has_failed boolean;
  has_suppression boolean;
begin
  select * into d from public.exchange_request_notification_deliveries where id = p_id for update;
  if not found or d.provider_id is null then return; end if;
  select
    min(occurred_at) filter (where event_type in ('email.sent', 'email.delivered')),
    min(occurred_at) filter (where event_type = 'email.delivered'),
    coalesce(bool_or(event_type = 'email.bounced'), false),
    coalesce(bool_or(event_type = 'email.failed'), false),
    coalesce(bool_or(event_type in ('email.complained', 'email.suppressed')), false)
  into accepted_time, delivered_time, has_bounce, has_failed, has_suppression
  from public.exchange_request_email_events where provider_id = d.provider_id;
  update public.exchange_request_notification_deliveries set
    status = case when has_suppression then 'suppressed'
                  when has_bounce or has_failed then 'failed'
                  when delivered_time is not null then 'delivered'
                  when accepted_time is not null and status not in ('delivered', 'failed', 'suppressed') then 'provider_accepted'
                  else status end,
    provider_accepted_at = coalesce(provider_accepted_at, accepted_time),
    delivered_at = coalesce(delivered_at, delivered_time),
    last_error = case when has_suppression then 'provider_suppressed'
                      when has_bounce then 'provider_bounced'
                      when has_failed then 'provider_failed'
                      when delivered_time is not null then null else last_error end,
    updated_at = now()
  where id = d.id;
  if d.audience = 'customer' and (has_bounce or has_suppression) then
    insert into public.exchange_request_tasks(request_id, kind, description, dedupe_key)
    values(d.request_id, 'contact_update', 'Customer email could not be delivered. Verify the account contact address.', 'email-contact:' || d.id::text)
    on conflict (dedupe_key) do nothing;
  end if;
end;
$$;

create or replace function public.claim_request_notifications(p_worker_id uuid, p_limit integer default 1, p_lease_seconds integer default 120)
returns setof public.exchange_request_notification_deliveries
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_worker_id is null or p_limit not between 1 and 25 or p_lease_seconds not between 30 and 300 then
    raise exception 'Invalid notification claim';
  end if;
  return query
  with candidates as (
    select d.id from public.exchange_request_notification_deliveries d
    where ((d.status = 'pending' and d.next_attempt_at <= now())
       or (d.status = 'leased' and d.lease_expires_at <= now()))
      and not exists (
        select 1 from public.exchange_request_notification_deliveries prior
        where prior.request_id = d.request_id and prior.audience = d.audience
          and prior.recipient_email is not distinct from d.recipient_email
          and prior.channel = d.channel and prior.event_sequence < d.event_sequence
          and prior.status in ('pending', 'leased', 'reconciliation_required')
      )
    order by d.created_at, d.event_sequence, d.id
    for update of d skip locked limit p_limit
  )
  update public.exchange_request_notification_deliveries d
  set status = 'leased', lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempts = d.attempts + 1, updated_at = now()
  from candidates where d.id = candidates.id returning d.*;
end;
$$;

create or replace function public.prepare_request_notification(p_id uuid, p_worker_id uuid, p_payload jsonb, p_template_version text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.exchange_request_notification_deliveries%rowtype;
begin
  -- Serialize provider acknowledgement with early callbacks, including the
  -- interval where provider_id is not yet visible on the delivery row.
  if p_provider_id is not null then perform pg_advisory_xact_lock(hashtextextended(p_provider_id, 0)); end if;
  select * into d from public.exchange_request_notification_deliveries where id = p_id for update;
  if not found or d.status <> 'leased' or d.lease_owner is distinct from p_worker_id or d.lease_expires_at <= now() then
    raise exception 'Notification lease lost';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_template_version is null
      or jsonb_typeof(p_payload->'to') <> 'array' or jsonb_array_length(p_payload->'to') <> 1
      or p_payload->'to'->>0 is distinct from d.recipient_email
      or not (p_payload ?& array['from', 'subject', 'html', 'text']) then
    raise exception 'Invalid notification payload';
  end if;
  if d.rendered_payload is not null and (d.rendered_payload is distinct from p_payload or d.template_version is distinct from p_template_version) then
    raise exception 'Notification payload is immutable';
  end if;
  if d.first_attempt_at is not null and d.first_attempt_at <= now() - interval '23 hours' then
    raise exception 'Notification requires reconciliation';
  end if;
  update public.exchange_request_notification_deliveries
  set rendered_payload = coalesce(rendered_payload, p_payload),
      template_version = coalesce(template_version, p_template_version),
      first_attempt_at = coalesce(first_attempt_at, now()), updated_at = now()
  where id = p_id returning * into d;
  return to_jsonb(d);
end;
$$;

create or replace function public.finish_request_notification(
  p_id uuid, p_worker_id uuid, p_status text, p_provider_id text default null,
  p_error_code text default null, p_next_attempt_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare d public.exchange_request_notification_deliveries%rowtype;
begin
  select * into d from public.exchange_request_notification_deliveries where id = p_id for update;
  if not found or d.status <> 'leased' or d.lease_owner is distinct from p_worker_id or d.lease_expires_at <= now() then
    raise exception 'Notification lease lost';
  end if;
  if p_status not in ('pending', 'provider_accepted', 'failed', 'reconciliation_required')
      or (p_status = 'provider_accepted' and (coalesce(length(p_provider_id), 0) = 0 or d.first_attempt_at is null))
      or (p_status = 'pending' and (p_next_attempt_at is null or p_next_attempt_at <= now()))
      or (p_error_code is not null and p_error_code !~ '^[a-z_]{1,100}$') then
    raise exception 'Invalid notification outcome';
  end if;
  update public.exchange_request_notification_deliveries set
    status = p_status,
    provider_id = coalesce(provider_id, p_provider_id),
    provider_accepted_at = case when p_status = 'provider_accepted' then coalesce(provider_accepted_at, now()) else provider_accepted_at end,
    last_error = p_error_code,
    next_attempt_at = coalesce(p_next_attempt_at, next_attempt_at),
    lease_owner = null, lease_expires_at = null, updated_at = now()
  where id = p_id;
  perform public.apply_request_email_events(p_id);
  select * into d from public.exchange_request_notification_deliveries where id = p_id;
  return to_jsonb(d);
end;
$$;

create or replace function public.record_request_email_event(
  p_event_id text, p_event_type text, p_provider_id text,
  p_occurred_at timestamptz, p_payload_hash text
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare existing_hash text; delivery_id uuid;
begin
  if p_provider_id is not null then perform pg_advisory_xact_lock(hashtextextended(p_provider_id, 0)); end if;
  insert into public.exchange_request_email_events(event_id, event_type, provider_id, occurred_at, payload_hash)
  values(p_event_id, p_event_type, p_provider_id, p_occurred_at, p_payload_hash)
  on conflict (event_id) do nothing;
  select payload_hash into existing_hash from public.exchange_request_email_events where event_id = p_event_id;
  if existing_hash is distinct from p_payload_hash then raise exception 'Provider event payload conflict'; end if;
  select id into delivery_id from public.exchange_request_notification_deliveries where provider_id = p_provider_id;
  if delivery_id is not null then perform public.apply_request_email_events(delivery_id); end if;
  return jsonb_build_object('recorded', true);
end;
$$;

revoke all on function public.apply_request_email_events(uuid) from public, anon, authenticated;
revoke all on function public.claim_request_notifications(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.prepare_request_notification(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.finish_request_notification(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.record_request_email_event(text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.claim_request_notifications(uuid, integer, integer) to service_role;
grant execute on function public.prepare_request_notification(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.finish_request_notification(uuid, uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.record_request_email_event(text, text, text, timestamptz, text) to service_role;

commit;
