import { UserButton } from "@clerk/react-router";
import { NavLink, Outlet, redirect } from "react-router";

import { requireUser } from "~/lib/auth.server";
import { hasCompletedOnboarding } from "~/lib/onboarding.server";

import type { Route } from "./+types/member";

/**
 * Shell for everything behind the paywall.
 *
 * The guard lives in this loader, not in the children, so a route added under
 * this layout is gated by existing there rather than by someone remembering to
 * call something. Phase 6 adds the subscription check to the same place.
 */
export async function loader(args: Route.LoaderArgs) {
  const user = await requireUser(args);

  /**
   * Phase 6 adds the subscription check here — `current_period_end > now()` or
   * a live `access_granted_until` — so it gates this whole subtree in one place
   * rather than once per route.
   */

  /**
   * Every page under here renders a plan or numbers derived from the
   * questionnaire, so a member who has not answered it has nothing to show.
   * Gating it here rather than per route means a new tab added to the dashboard
   * cannot forget to check.
   */
  if (!(await hasCompletedOnboarding(user.id))) {
    throw redirect("/onboarding");
  }

  return { userId: user.clerkUserId };
}

const navigation = [
  { to: "/dashboard/workouts", label: "Mínar æfingar" },
  { to: "/dashboard/macros", label: "Mín macros" },
  { to: "/articles", label: "Fróðleikur" },
] as const;

export default function MemberLayout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-base/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/dashboard" className="flex items-center gap-2.5">
            <span className="crest-mark w-6" aria-hidden="true" />

            <span className="font-mark text-xs uppercase tracking-mark text-text-soft">
              Innri hringurinn
            </span>
          </NavLink>

          <div className="flex items-center gap-3">
            <NavLink
              to="/settings"
              className="rounded-md px-2 py-1 text-sm text-text-muted transition-colors hover:text-text"
            >
              Stillingar
            </NavLink>

            <UserButton />
          </div>
        </div>

        {/* Horizontal rather than a bottom bar: three destinations fit at every
            width, and a bottom bar would fight the phone's own gesture area. */}
        <nav className="mx-auto max-w-4xl overflow-x-auto px-4">
          <ul className="flex gap-1">
            {navigation.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      "-mb-px block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
                      isActive
                        ? "border-bronze text-text"
                        : "border-transparent text-text-muted hover:text-text-soft",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 pb-20">
        <Outlet />
      </main>
    </div>
  );
}
