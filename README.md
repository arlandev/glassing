# glassing

Users sign up and upload a resume. Claude summarizes it and pulls out their skills. Every 4 hours, the app searches JSearch (LinkedIn, Indeed, Glassdoor and more, through Google for Jobs) for each user's target title, scores each listing in code, and emails each user any matches they haven't been sent before.

## How it fits together

| piece | file |
|---|---|
| sign up / sign in, dashboard | `app/page.tsx`, `components/` (deskkit design system, `app/deskkit.css`) |
| resume → summary, skills, seniority | `app/api/resume/route.ts` (Claude `claude-haiku-5-5` with a strict prompt in `lib/resume-prompt.ts`, reads the PDF directly) |
| scan every 4 hours → match → email | `app/api/scan/route.ts`, `lib/jsearch.ts`, `lib/email.ts` |
| match score (0–100) | `lib/score.ts`: title 40, skills 40, seniority 10, location 10. Matches below 60 are dropped |
| tables + row level security | `supabase/migrations/` |
| scan trigger (every 4 hours) | Railway service `scan-cron` (see Deploy) |

A user is never emailed the same job twice because `matches` has a primary key on `(user_id, job_id)`. Matches that fail to send stay unsent and go out on the next run.

## Setup (local)

1. `cp .env.example .env.local` and fill it in (each key says where it comes from).
2. `supabase start` runs Supabase in Docker and applies `supabase/migrations/`. Put its API URL and keys in `.env.local`.
3. `npm run dev` and open http://localhost:3000.

## Deploy (Railway)

Project `glassing` has two services:

- `glassing`: this app. Deploy with `railway up --service glassing`. Railpack runs `npm run build` and `npm start`. Its variables match `.env.example`, with `APP_URL=https://glassing.arlanabante.com`.
- `scan-cron`: image `curlimages/curl`, cron `0 */4 * * *` (UTC), start command
  `/bin/sh -c 'curl -fsS -m 300 -H "Authorization: Bearer $CRON_SECRET" "$SCAN_URL"'`.
  `CRON_SECRET` references `${{glassing.CRON_SECRET}}`; `SCAN_URL` is the app's Railway URL plus `/api/scan`.

Schema changes go to the hosted database with `supabase db push`.

Every page sits behind the shared `SITE_PASSWORD` gate (`proxy.ts`, `app/gate/page.tsx`). Delete `proxy.ts` to open the app to everyone.

Run a scan by hand:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/scan
```

## Tests

```bash
npm test
```
