import { index, layout, prefix, route, type RouteConfig } from "@react-router/dev/routes";

/**
 * Paths and filenames are English; everything a member reads on the page is
 * Icelandic. See the route map in docs/solutions/inner-circle.md.
 *
 * Two nested gates, each a layout loader, so a route is guarded by where it
 * sits rather than by remembering to call something:
 *
 *   member layout   questionnaire answered — Fróðleikur, readable while a
 *                   member waits for their claim to be paid
 *   paid layout     inside it, plus access — the plan, macros and settings
 *
 * Put a new route under the paid layout unless someone who has not paid should
 * see it. The routes outside both — subscribe, onboarding, admin — are
 * signed-in-only and guard themselves. `waiting` is retired to a redirect.
 * `subscribe` is Repeat's checkout, dormant until it is live.
 */
export default [
  index("routes/home.tsx"),

  route("sign-in/*", "routes/sign-in.tsx"),
  route("sign-up/*", "routes/sign-up.tsx"),
  route("subscribe", "routes/subscribe.tsx"),
  route("onboarding", "routes/onboarding.tsx"),
  route("waiting", "routes/waiting.tsx"),

  layout("layouts/member.tsx", [
    layout("layouts/paid.tsx", [
      ...prefix("dashboard", [
        index("routes/dashboard/index.tsx"),
        route("workouts", "routes/dashboard/workouts.tsx"),
        route("workouts/:session", "routes/dashboard/session.tsx"),
        route("macros", "routes/dashboard/macros.tsx"),
      ]),

      route("settings", "routes/settings.tsx"),
    ]),

    ...prefix("articles", [
      index("routes/articles/index.tsx"),
      route(":slug", "routes/articles/article.tsx"),
    ]),
  ]),

  route("admin", "routes/admin.tsx"),

  // Resource routes — no component, called by other systems, never by a member.
  route("api/clerk/webhook", "routes/api/clerk-webhook.ts"),
  route("api/repeat/webhook", "routes/api/repeat-webhook.ts"),
  route("api/cron/repeat-sync", "routes/api/repeat-sync.ts"),
] satisfies RouteConfig;
