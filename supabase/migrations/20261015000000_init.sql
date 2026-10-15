-- One row per user. Filled by the signup trigger, then by the resume analysis and the settings form.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  target_title text,
  location text,
  remote_only boolean not null default false,
  summary text,
  skills text[] not null default '{}',
  seniority text check (seniority in ('junior', 'mid', 'senior', 'lead')),
  years_experience int,
  suggested_titles text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Every listing the hourly scan has seen, keyed by the provider's job id.
create table public.jobs (
  id text primary key,
  title text not null,
  company text,
  location text,
  is_remote boolean,
  url text not null,
  description text,
  posted_at timestamptz,
  created_at timestamptz not null default now()
);

-- The primary key is what stops a user being pinged twice for the same job.
create table public.matches (
  user_id uuid not null references public.profiles on delete cascade,
  job_id text not null references public.jobs on delete cascade,
  score int not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);
create index matches_unnotified on public.matches (user_id) where notified_at is null;

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.matches enable row level security;

create policy "read own profile" on public.profiles for select using (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);
-- Users edit only their search settings; email and resume fields are written by the server.
revoke update on public.profiles from authenticated, anon;
grant update (target_title, location, remote_only) on public.profiles to authenticated;
create policy "read jobs" on public.jobs for select to authenticated using (true);
create policy "read own matches" on public.matches for select using (auth.uid() = user_id);
-- Inserts into jobs and matches only happen from the scan, which uses the service role and skips RLS.

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
