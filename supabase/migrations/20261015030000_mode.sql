-- How a user's jobs are scored: against their resume, or on the job title alone (no resume needed).
alter table public.profiles add column mode text not null default 'resume' check (mode in ('resume', 'title'));
grant update (mode) on public.profiles to authenticated;
