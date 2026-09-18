import { index, layout, prefix, route, type RouteConfig } from "@react-router/dev/routes";

/**
 * Paths and filenames are English; everything a member reads on the page is
 * Icelandic. See the route map in docs/solutions/inner-circle.md.
 *
 * Everything inside the member layout is gated by that layout's loader, so a
 * route added here is guarded by existing there. The three routes outside it —
 * subscribe, onboarding, admin — are signed-in-only and call `requireUserId`
 * themselves; they sit outside because they must stay reachable to someone who
 * has not paid yet.
 */
export default [
  index("routes/home.tsx"),

  route("sign-in/*", "routes/sign-in.tsx"),
  route("sign-up/*", "routes/sign-up.tsx"),
  route("subscribe", "routes/subscribe.tsx"),
  route("onboarding", "routes/onboarding.tsx"),

  layout("layouts/member.tsx", [
    ...prefix("dashboard", [
      index("routes/dashboard/index.tsx"),
      route("workouts", "routes/dashboard/workouts.tsx"),
      route("macros", "routes/dashboard/macros.tsx"),
    ]),

    ...prefix("articles", [
      index("routes/articles/index.tsx"),
      route(":slug", "routes/articles/article.tsx"),
    ]),

    route("settings", "routes/settings.tsx"),
  ]),

  route("admin", "routes/admin.tsx"),

  // Resource routes — no component, called by other systems, never by a member.
  route("api/clerk/webhook", "routes/api/clerk-webhook.ts"),
] satisfies RouteConfig;
