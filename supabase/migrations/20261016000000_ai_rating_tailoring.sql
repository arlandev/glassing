-- The uploaded resume, transcribed verbatim as structured JSON. Tailoring rewrites from this; only the server writes it.
alter table public.profiles add column resume jsonb;

-- Haiku's second-pass rating of a match (1-5) and a one-line reason.
alter table public.matches
  add column ai_score smallint check (ai_score between 1 and 5),
  add column ai_note text;

-- One tailored resume per user per job. `resume` stays null while Sonnet is writing it.
create table public.tailorings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  job_id text not null references public.jobs on delete cascade,
  resume jsonb,
  changes text[] not null default '{}',
  unverified_numbers text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);
alter table public.tailorings enable row level security;
create policy "read own tailorings" on public.tailorings for select using (auth.uid() = user_id);

-- Claims a tailoring slot within the daily/monthly limits (UTC calendar day and month).
-- A per-user lock makes the count-then-insert safe against parallel clicks.
create function public.claim_tailoring(p_user uuid, p_job text, p_day_limit int, p_month_limit int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  existing uuid;
  today int;
  this_month int;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user::text));
  select id into existing from public.tailorings where user_id = p_user and job_id = p_job;
  if existing is not null then
    return jsonb_build_object('id', existing, 'existing', true);
  end if;
  select count(*) filter (where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'),
         count(*) filter (where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc')
    into today, this_month
    from public.tailorings where user_id = p_user;
  if today >= p_day_limit then return jsonb_build_object('limit', 'day'); end if;
  if this_month >= p_month_limit then return jsonb_build_object('limit', 'month'); end if;
  insert into public.tailorings (user_id, job_id) values (p_user, p_job) returning id into new_id;
  return jsonb_build_object('id', new_id, 'today', today + 1, 'month', this_month + 1);
end;
$$;
revoke execute on function public.claim_tailoring from public, anon, authenticated;

-- Small server-only key/value store (e.g. when the last spend-limit alert went out).
create table public.app_state (key text primary key, value timestamptz not null);
alter table public.app_state enable row level security;
