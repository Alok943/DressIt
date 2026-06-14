// PostHog analytics. Reads VITE_POSTHOG_KEY / VITE_POSTHOG_HOST from .env.
// No key (e.g. local dev) -> events log to console instead, so the contract still works.
// In prod, set VITE_POSTHOG_HOST="/ingest" — vercel.json rewrites it to PostHog,
// so events go same-origin and slip past ad-blockers. ui_host keeps toolbar links
// pointing at the real PostHog app. Local dev leaves it direct (us.i.posthog.com).
import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let enabled = false;

export function initAnalytics() {
  if (!KEY) {
    console.info("[analytics] no VITE_POSTHOG_KEY — events will log to console only");
    return;
  }
  posthog.init(KEY, {
    api_host: HOST,
    ui_host: "https://us.posthog.com", // proxied api_host -> point toolbar at real app
    capture_pageview: true,
    autocapture: false, // we send explicit, named events from the funnel
    persistence: "localStorage",
  });
  enabled = true;
}

// single funnel event helper — same signature the app already uses
export function track(event, props = {}) {
  if (enabled) posthog.capture(event, props);
  else console.debug("[track]", event, props);
}
