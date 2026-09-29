import { UserButton } from "@clerk/react-router";
import { Lock } from "lucide-react";
import { NavLink, Outlet } from "react-router";

import { hasActiveAccess } from "~/lib/access";
import { formatDate } from "~/lib/format";
import { requireOnboarded } from "~/lib/subscription.server";

import type { Route } from "./+types/member";

/**
 * Shell for the member area, for everyone who has answered the questionnaire —
 * and for admins, who need not have, since /admin lives inside it.
 *
 * Paid or not, a member gets the same chrome. Without access the plan and
 * macros tabs are locked and a banner says access opens once the claim is
 * paid; Fróðleikur stays readable. The lock that matters is the paid layout's
 * loader (`layouts/paid.tsx`) — these tabs are only what the member sees.
 */
export async function loader(args: Route.LoaderArgs) {
  /**
   * Reads only the local database — never Repeat — so a Repeat outage does
   * not lock members out.
   */
  const user = await requireOnboarded(args);

  const hasAccess = hasActiveAccess(user, new Date());

  return {
    userId: user.clerkUserId,
    isAdmin: user.isAdmin,
    hasAccess,
    /** Set when a grant ran out, so the banner can say so instead of "welcome". */
    lapsedOn:
      !hasAccess && user.accessGrantedUntil !== null ? formatDate(user.accessGrantedUntil) : null,
  };
}

const navigation = [
  { to: "/dashboard/workouts", label: "Mínar æfingar", paid: true },
  { to: "/dashboard/macros", label: "Mín macros", paid: true },
  { to: "/articles", label: "Fróðleikur", paid: false },
] as const;

const TAB = "-mb-px block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors";

function AccessBanner({ lapsedOn }: { lapsedOn: string | null }) {
  return (
    <section className="mb-8 rounded-xl border border-bronze-deep bg-raised p-5">
      <h2 className="font-display text-subtitle text-text">
        {lapsedOn === null
          ? "Fullur aðgangur opnast þegar greiðslan berst"
          : `Aðgangurinn þinn rann út ${lapsedOn}`}
      </h2>

      <p className="mt-2 text-text-soft">
        {lapsedOn === null
          ? "Aron sendir þér kröfu í heimabankann. Um leið og hún er greidd opnast æfingaplanið þitt og macros — þau bíða tilbúin. Fróðleikur er opinn á meðan."
          : "Aron sendir þér nýja kröfu í heimabankann. Þegar hún er greidd opnast planið og macros aftur, óbreytt. Fróðleikur er opinn á meðan."}
      </p>
    </section>
  );
}

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
                className={({ isActive }) =>
                  [
                    "rounded-md px-2 py-1 text-sm transition-colors",
                    isActive ? "text-text" : "text-text-muted hover:text-text",
                  ].join(" ")
                }
              >
                Umsjón
              </NavLink>
            )}

            {/* Settings edits the plan's inputs and the subscription — paid
                layout, so there is nothing behind it to show before access. */}
            {loaderData.hasAccess && (
              <NavLink
                to="/settings"
                className="rounded-md px-2 py-1 text-sm text-text-muted transition-colors hover:text-text"
              >
                Stillingar
              </NavLink>
            )}

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
                {item.paid && !loaderData.hasAccess ? (
                  <span
                    aria-disabled="true"
                    title="Opnast þegar greiðslan berst"
                    className={`${TAB} flex cursor-not-allowed items-center gap-1.5 border-transparent text-text-muted`}
                  >
                    <Lock aria-hidden="true" className="size-3.5" />
                    {item.label}
                  </span>
                ) : (
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      [
                        TAB,
                        isActive
                          ? "border-bronze text-text"
                          : "border-transparent text-text-muted hover:text-text-soft",
                      ].join(" ")
                    }
                  >
                    {item.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 pb-20">
        {!loaderData.hasAccess && <AccessBanner lapsedOn={loaderData.lapsedOn} />}

        <Outlet />
      </main>
    </div>
  );
}
