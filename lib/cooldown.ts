// "Search now" allows one manual search per scheduled-scan window: it unlocks again at the next scheduled run.
// Must match scan-cron's schedule on Railway (0 */4 * * *, UTC).
const WINDOW_MS = 4 * 60 * 60 * 1000;

export const windowStart = (now = Date.now()) => Math.floor(now / WINDOW_MS) * WINDOW_MS;

// When the user can search again (ms timestamp), or null if they can search now.
export function nextSearchAt(lastManual: string | null, now = Date.now()) {
  return lastManual && Date.parse(lastManual) >= windowStart(now) ? windowStart(now) + WINDOW_MS : null;
}
