// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderMatchesEmail } from "./email.ts";

const job = { title: "AI Engineer", company: "Acme", location: "Makati City", url: "https://example.com/1", score: 82 };

test("subject names the search and pluralizes", () => {
  assert.equal(renderMatchesEmail({ title: "AI Engineer", country: "ph" }, [job], "").subject, "1 new ai engineer job in philippines");
  assert.equal(renderMatchesEmail({ title: "AI Engineer", country: "ph" }, [job, job], "").subject, "2 new ai engineer jobs in philippines");
});

test("listing text from job boards is escaped in the html", () => {
  const evil = { ...job, title: '<img src=x onerror="alert(1)">', url: 'https://x.test/"><script>' };
  const { html } = renderMatchesEmail({ title: "AI Engineer", country: "ph" }, [evil], "");
  assert.ok(!html.includes("<img src=x") && !html.includes("<script>"));
});

test("plain-text version carries the greeting and links", () => {
  const { text } = renderMatchesEmail({ title: "AI Engineer", country: "ph" }, [job], "https://glassing.arlanabante.com");
  assert.ok(text.startsWith("hey - glassing found some jobs for you."));
  assert.ok(text.includes("https://example.com/1") && text.includes("open glassing: https://glassing.arlanabante.com"));
});
