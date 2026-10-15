-- Country to search in (ISO 3166-1 alpha-2, lowercase), passed to JSearch. `location` is now an optional city in it.
alter table public.profiles add column country text not null default 'us' check (country ~ '^[a-z]{2}$');
grant update (country) on public.profiles to authenticated;
