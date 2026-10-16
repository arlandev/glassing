-- A paused search keeps its settings but gets no scans or match emails until resumed.
alter table public.profiles add column paused boolean not null default false;
grant update (paused) on public.profiles to authenticated;
