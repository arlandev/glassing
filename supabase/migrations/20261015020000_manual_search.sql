-- Last "search now" click. One manual search per scheduled-scan window; only the server writes it.
alter table public.profiles add column last_manual_scan_at timestamptz;
