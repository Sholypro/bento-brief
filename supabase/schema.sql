-- Bento brief : schéma Supabase
-- Les tables sont fermées (RLS sans politique, aucun droit pour anon et authenticated).
-- L'app passe uniquement par les fonctions bento_*, protégées par une clé d'accès dont seul le hash est stocké.
-- La tâche planifiée Claude écrit directement en SQL via le connecteur Supabase.

create table if not exists public.bento_briefs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  brief jsonb not null
);

create table if not exists public.bento_config (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.bento_feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  verdict text not null check (verdict in ('important', 'pas_important')),
  item jsonb not null default '{}'::jsonb
);

create table if not exists public.bento_keys (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  label text,
  key_hash text not null unique
);

create index if not exists bento_briefs_created_idx on public.bento_briefs (created_at desc);
create index if not exists bento_feedback_created_idx on public.bento_feedback (created_at desc);

alter table public.bento_briefs enable row level security;
alter table public.bento_config enable row level security;
alter table public.bento_feedback enable row level security;
alter table public.bento_keys enable row level security;

revoke all on public.bento_briefs, public.bento_config, public.bento_feedback, public.bento_keys from anon, authenticated;

insert into public.bento_config (id, config) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- Vérifie la clé d'accès de l'app
create or replace function public.bento_check(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or not exists (
    select 1 from public.bento_keys
    where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  ) then
    raise exception 'clé invalide' using errcode = '28000';
  end if;
end;
$$;

-- Dernier brief + réglages
create or replace function public.bento_get(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  b record;
begin
  perform public.bento_check(p_key);
  select brief, created_at into b from public.bento_briefs order by created_at desc limit 1;
  return jsonb_build_object(
    'brief', b.brief,
    'storedAt', b.created_at,
    'config', (select config from public.bento_config where id = 1)
  );
end;
$$;

-- Réglages (boîtes suivies, expéditeurs prioritaires)
create or replace function public.bento_save_config(p_key text, p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bento_check(p_key);
  if jsonb_typeof(p_config) <> 'object' or length(p_config::text) > 20000 then
    raise exception 'réglages invalides' using errcode = '22023';
  end if;
  insert into public.bento_config (id, config, updated_at) values (1, p_config, now())
  on conflict (id) do update set config = excluded.config, updated_at = now();
  return p_config;
end;
$$;

-- Apprentissage : « Important » ou « Pas important » sur un élément du brief
create or replace function public.bento_feedback(p_key text, p_kind text, p_item jsonb, p_verdict text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bento_check(p_key);
  if p_verdict not in ('important', 'pas_important') or length(coalesce(p_item, '{}'::jsonb)::text) > 4000 then
    raise exception 'retour invalide' using errcode = '22023';
  end if;
  insert into public.bento_feedback (kind, verdict, item) values (left(p_kind, 20), p_verdict, coalesce(p_item, '{}'::jsonb));
end;
$$;

revoke all on function public.bento_check(text) from public, anon, authenticated;
revoke all on function public.bento_get(text) from public;
revoke all on function public.bento_save_config(text, jsonb) from public;
revoke all on function public.bento_feedback(text, text, jsonb, text) from public;
grant execute on function public.bento_get(text) to anon;
grant execute on function public.bento_save_config(text, jsonb) to anon;
grant execute on function public.bento_feedback(text, text, jsonb, text) to anon;

revoke execute on function public.bento_get(text) from authenticated;
revoke execute on function public.bento_save_config(text, jsonb) from authenticated;
revoke execute on function public.bento_feedback(text, text, jsonb, text) from authenticated;

-- Créer une clé d'accès (à lancer une fois, la clé en clair n'est affichée qu'ici) :
-- with k as (select 'bento_' || encode(extensions.gen_random_bytes(20), 'hex') as key),
-- ins as (insert into public.bento_keys (label, key_hash) select 'Mon appareil', encode(extensions.digest(key, 'sha256'), 'hex') from k returning id)
-- select k.key from k, ins;

-- Écriture du brief par la tâche planifiée (insertion + nettoyage, réservé au connecteur Supabase)
create or replace function public.bento_push(p_brief jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if jsonb_typeof(p_brief) <> 'object' or not (p_brief ? 'essentials') then
    raise exception 'brief invalide' using errcode = '22023';
  end if;
  insert into public.bento_briefs (brief) values (p_brief) returning id into new_id;
  delete from public.bento_briefs where created_at < now() - interval '7 days';
  delete from public.bento_feedback where created_at < now() - interval '120 days';
  return jsonb_build_object('id', new_id, 'ok', true);
end;
$$;
revoke all on function public.bento_push(jsonb) from public, anon, authenticated;
