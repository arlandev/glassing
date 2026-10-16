// Run with: npm test
import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import { test } from "node:test";
import { isBudgetError } from "./budget.ts";

const apiError = (status: number, type: string, message: string) =>
  Anthropic.APIError.generate(status, { type: "error", error: { type, message } }, message, new Headers());

test("billing errors and usage-limit messages count as the budget running out", () => {
  assert.ok(isBudgetError(apiError(402, "billing_error", "payment required")));
  assert.ok(isBudgetError(apiError(400, "invalid_request_error", "You have reached your specified API usage limits.")));
  assert.ok(isBudgetError(apiError(400, "invalid_request_error", "Your credit balance is too low to access the API.")));
});

test("ordinary failures don't", () => {
  assert.ok(!isBudgetError(apiError(429, "rate_limit_error", "Number of requests has exceeded your rate limit")));
  assert.ok(!isBudgetError(apiError(500, "api_error", "Internal server error")));
  assert.ok(!isBudgetError(new Error("network down")));
});
