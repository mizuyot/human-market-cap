"use client";

import type { AnalyticsEventName } from "./analytics-events";

const SESSION_KEY = "hmc_analytics_session";

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[A-Za-z0-9-]{8,80}$/.test(existing)) return existing;
    const next = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return "anonymous-session";
  }
}

/** Fire-and-forget product analytics. Never throws to callers. */
export function trackEvent(
  name: AnalyticsEventName,
  options: { uid?: string | null; props?: Record<string, string | number | boolean | null | undefined> } = {},
): void {
  if (typeof window === "undefined") return;
  const body = {
    name,
    sessionId: sessionId(),
    uid: options.uid ?? null,
    path: `${window.location.pathname}${window.location.search}`.slice(0, 240),
    referrer: document.referrer ? document.referrer.slice(0, 240) : "",
    props: options.props ?? {},
  };
  const payload = JSON.stringify(body);
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon("/api/analytics", blob)) return;
    }
  } catch {
    // fall through to fetch
  }
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
