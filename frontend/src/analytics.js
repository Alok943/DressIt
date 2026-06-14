// PostHog analytics. Reads VITE_POSTHOG_KEY / VITE_POSTHOG_HOST from .env.
// No key (e.g. local dev) -> events log to console instead, so the contract still works.
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
