export const ANALYTICS_EVENTS = [
  "page_view",
  "challenge_visit",
  "quiz_start",
  "valuation_complete",
  "share_click",
  "share_success",
  "api_error",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && (ANALYTICS_EVENTS as readonly string[]).includes(value);
}
