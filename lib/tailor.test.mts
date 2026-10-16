// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { unverifiedNumbers } from "./tailor.ts";

const original = { bullets: ["cut page load time by 40% across 4 teams", "2019 - 2022"] };

test("numbers kept from the original pass", () => {
  assert.deepEqual(unverifiedNumbers(original, { bullets: ["4 teams saw 40% faster pages (2019 - 2022)"] }), []);
});

test("invented numbers are flagged", () => {
  assert.deepEqual(unverifiedNumbers(original, { bullets: ["cut load time by 60% for 4 teams", "saved $1,200,000"] }), [
    "60",
    "1,200,000",
  ]);
});
