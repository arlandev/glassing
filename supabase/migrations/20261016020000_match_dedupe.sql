-- JSearch returns a different job_id for the same posting on every search, so the same job kept coming back as a
-- "new" match. A match is now unique per user by normalized title + company (same as matchKey in lib/text.ts).
alter table public.matches add column dedupe_key text;

update public.matches m
set dedupe_key = lower(regexp_replace(trim(j.title), '\s+', ' ', 'g')) || '|' ||
                 lower(regexp_replace(trim(coalesce(j.company, '')), '\s+', ' ', 'g'))
from public.jobs j
where j.id = m.job_id;

-- Keep the earliest copy of each repeated match.
delete from public.matches m
using public.matches d
where m.user_id = d.user_id
  and m.dedupe_key = d.dedupe_key
  and (m.created_at, m.job_id) > (d.created_at, d.job_id);

alter table public.matches alter column dedupe_key set not null;
create unique index matches_user_dedupe on public.matches (user_id, dedupe_key);
