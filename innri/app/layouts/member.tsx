import { UserButton } from "@clerk/react-router";
import { NavLink, Outlet } from "react-router";

import { requireActiveAccess } from "~/lib/subscription.server";

import type { Route } from "./+types/member";

/**
 * Shell for everything behind the paywall.
 *
 * The guard lives in this loader, not in the children, so a route added under
 * this layout is gated by existing there rather than by someone remembering to
 * call something.
 */
export async function loader(args: Route.LoaderArgs) {
  /**
   * The member gate, for this whole subtree in one place: questionnaire
   * answered, then access. Every page under here renders a plan or numbers
   * derived from the questionnaire, and access reads only the local database —
   * never Repeat — so a Repeat outage does not lock members out.
   */
  const user = await requireActiveAccess(args);

  return { userId: user.clerkUserId, isAdmin: user.isAdmin };
}

const navigation = [
  { to: "/dashboard/workouts", label: "Mínar æfingar" },
  { to: "/dashboard/macros", label: "Mín macros" },
  { to: "/articles", label: "Fróðleikur" },
] as const;

export default function MemberLayout({ loaderData }: Route.ComponentProps) {
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
            {/* Convenience only: /admin guards itself with requireAdmin and
                answers 404 to everyone else, link or no link. */}
            {loaderData.isAdmin && (
              <NavLink
                to="/admin"
                className="rounded-md px-2 py-1 text-sm text-text-muted transition-colors hover:text-text"
              >
                Umsjón
              </NavLink>
            )}

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
            width, and a bottom bar would fight the phone's own gesture area.
            No overflow container: the tabs' -mb-px pulls the active underline
            onto the header border, and a scroll container clips that pixel into
            a permanent scrollbar. */}
        <nav className="mx-auto max-w-4xl px-4">
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
