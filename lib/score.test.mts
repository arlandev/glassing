// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_SCORE, levelOf, scoreJob } from "./score.ts";

const dev = {
  mode: "resume",
  target_title: "Frontend Engineer",
  location: "Austin, TX",
  remote_only: false,
  skills: ["react", "typescript", "css", "node.js", "c++"],
  seniority: "senior",
};

test("a strong match scores 100", () => {
  const job = {
    title: "Senior Frontend Engineer",
    description: "We use React, TypeScript, modern CSS, Node.js and some C++.",
    location: "Austin, TX",
    is_remote: false,
  };
  assert.equal(scoreJob(dev, job), 100);
});

test("an unrelated job stays under the threshold", () => {
  const job = { title: "Registered Nurse", description: "Patient care in the ICU.", location: "Austin, TX", is_remote: false };
  assert.ok(scoreJob(dev, job) < MIN_SCORE);
});

test("remote-only users never match on-site jobs", () => {
  const job = { title: "Frontend Engineer", description: "react", location: "Austin, TX", is_remote: false };
  assert.equal(scoreJob({ ...dev, remote_only: true }, job), 0);
});

test("skills match whole terms only", () => {
  const job = { title: "Frontend Engineer", description: "reactive systems, csss", location: null, is_remote: true };
  // title 40 + no skills + one level off 5 + remote 10
  assert.equal(scoreJob(dev, job), 55);
});

test("seniority comes from the job title", () => {
  assert.equal(levelOf("Jr. Data Analyst"), 0);
  assert.equal(levelOf("Data Analyst"), 1);
  assert.equal(levelOf("Sr Data Analyst"), 2);
  assert.equal(levelOf("Senior Staff Engineer"), 3);
});

const titleOnly = { mode: "title", target_title: "AI Engineer", location: null, remote_only: false, skills: [], seniority: null };

test("title mode: a full title match passes without a resume", () => {
  const job = { title: "Senior AI Engineer", description: null, location: "Makati City", is_remote: false };
  assert.equal(scoreJob(titleOnly, job), 100);
});

test("title mode: half a title stays under the threshold", () => {
  const job = { title: "Software Engineer", description: "we use ai", location: "Makati City", is_remote: false };
  assert.ok(scoreJob(titleOnly, job) < MIN_SCORE);
});

test("title mode: remote-only still filters on-site jobs", () => {
  const job = { title: "AI Engineer", description: null, location: "Makati City", is_remote: false };
  assert.equal(scoreJob({ ...titleOnly, remote_only: true }, job), 0);
});

test("resume mode without a resume can't reach the threshold", () => {
  const job = { title: "AI Engineer", description: null, location: null, is_remote: true };
  assert.ok(scoreJob({ ...titleOnly, mode: "resume" }, job) < MIN_SCORE);
});
