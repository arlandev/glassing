// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { nextSearchAt } from "./cooldown.ts";

const at = (iso: string) => Date.parse(iso);

test("never searched: available now", () => {
  assert.equal(nextSearchAt(null, at("2026-10-15T13:30:00Z")), null);
});

test("searched this window: locked until the next scheduled run", () => {
  assert.equal(nextSearchAt("2026-10-15T12:05:00Z", at("2026-10-15T13:30:00Z")), at("2026-10-15T16:00:00Z"));
});

test("searched last window: available now", () => {
  assert.equal(nextSearchAt("2026-10-15T11:59:00Z", at("2026-10-15T12:01:00Z")), null);
});

test("windows line up with the 00/04/08/12/16/20 UTC cron runs", () => {
  assert.equal(nextSearchAt("2026-10-15T22:10:00Z", at("2026-10-15T23:59:00Z")), at("2026-10-16T00:00:00Z"));
});
