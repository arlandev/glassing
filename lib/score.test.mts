// Run with: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_SCORE, levelOf, scoreJob } from "./score.ts";

const dev = {
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
