import Anthropic from "@anthropic-ai/sdk";

export const AI_PAUSED = "ai is paused for now: this month's ai budget is used up. job alerts still work; try again later.";

// The account spend limit or an empty credit balance comes back as a billing error.
export const isBudgetError = (e: unknown) =>
  e instanceof Anthropic.APIError &&
  (e.status === 402 || e.type === "billing_error" || /usage limit|spend limit|credit balance/i.test(e.message));
