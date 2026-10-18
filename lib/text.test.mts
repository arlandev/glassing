// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { clip, matchKey, mentionsRemote, sourceHost } from "./text.ts";

test("the same posting gets the same key however it's spaced or cased", () => {
  assert.equal(matchKey("AI Product Engineer", "HireArchi"), matchKey("  ai  product engineer ", "HIREARCHI"));
  assert.notEqual(matchKey("AI Product Engineer", "HireArchi"), matchKey("AI Product Engineer", "Other Co"));
  assert.notEqual(matchKey("データエンジニア", "株式会社A"), matchKey("営業", "株式会社A")); // non-latin titles stay distinct
});

test("clip cuts at a word and marks it", () => {
  assert.equal(clip("short note", 50), "short note");
  assert.equal(clip("partial fit: python overlap, but posting centers on .net and react", 40), "partial fit: python overlap, but posting…");
});

test("a posting that says it's remote counts as remote", () => {
  assert.ok(mentionsRemote("Data Analyst – Remote (Sales Analytics)"));
  assert.ok(mentionsRemote("this is a Work From Home role"));
  assert.ok(mentionsRemote("WFH setup, fully home-based"));
  assert.ok(!mentionsRemote("Senior Data Analyst, Makati City, onsite"));
  assert.ok(!mentionsRemote("this is a non-remote role, no remote work"));
  assert.ok(!mentionsRemote("remoteness")); // whole words only
});

test("source host keeps the board's domain", () => {
  assert.equal(sourceHost("https://ph.jobstreet.com/job/95298281"), "jobstreet.com");
  assert.equal(sourceHost("https://www.linkedin.com/jobs/view/1"), "linkedin.com");
  assert.equal(sourceHost("https://jobs.example.co.uk/x"), "example.co.uk");
  assert.equal(sourceHost("not a url"), null);
});
