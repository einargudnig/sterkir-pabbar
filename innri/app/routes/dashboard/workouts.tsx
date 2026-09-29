import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

import { requireUser } from "~/lib/auth.server";
import { assignedPlan } from "~/lib/onboarding.server";

import type { Route } from "./+types/workouts";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Mínar æfingar — Innri hringurinn" }];
}

/**
 * The member's week: one card per session in the plan, each opening that
 * session's page.
 *
 * The member layout has already redirected anyone without an assignment to the
 * questionnaire, so a missing plan here means the layout's check and this one
 * disagree — which the empty state below covers rather than throwing.
 */
export async function loader(args: Route.LoaderArgs) {
  const user = await requireUser(args);

  return { plan: await assignedPlan(user.id) };
}

export default function Workouts({ loaderData }: Route.ComponentProps) {
  const { plan } = loaderData;

  /**
   * A real state, not a defensive one: before Aron publishes his first plan
   * there is genuinely nothing to show, and a member who has paid deserves an
   * explanation rather than a blank page.
   */
  if (!plan) {
    return (
      <div className="max-w-prose">
        <h1 className="font-display text-title text-text">Mínar æfingar</h1>

        <p className="mt-4 text-text-soft">
          Planið þitt er í smíðum. Við látum þig vita um leið og það er tilbúið.
        </p>
      </div>
    );
  }

  const sessions = plan.sessions ?? [];

  return (
    <div>
      <header>
        <p className="font-mark text-xs uppercase tracking-mark text-bronze">
          {sessions.length}× í viku
        </p>

        <h1 className="mt-2 font-display text-title text-text">{plan.title}</h1>

        <p className="mt-2 text-text-soft">
          {plan.intro ??
            "Taktu æfingarnar í þeirri röð sem þér hentar — það skiptir meira máli að þær klárist en hvenær."}
        </p>
      </header>

      {/* Numbered, not weekday-bound: the week is the sessions in order, done
          whenever the member gets to them. A calendar would have to show a
          missed Wednesday, which is exactly the guilt the plan is built to
          avoid. See PRODUCT.md, "Design around the collapsed week". */}
      <ol className="mt-8 grid gap-3">
        {sessions.map((session, index) => (
          <li key={session._key}>
            <Link
              to={`/dashboard/workouts/${index + 1}`}
              className="flex items-center gap-4 rounded-xl border border-line bg-raised px-5 py-4 transition-colors hover:border-bronze"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line font-semibold text-text-soft">
                {index + 1}
              </span>

              <span className="flex grow flex-col gap-0.5">
                <span className="font-display text-subtitle text-text">{session.title}</span>

                <span className="text-sm text-text-muted">
                  {session.exercises?.length ?? 0} æfingar
                </span>
              </span>

              <ChevronRight className="size-5 shrink-0 text-text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-8 rounded-lg border border-line-soft bg-sunken p-4 text-sm text-text-muted">
        Engir fastir dagar. Missirðu úr æfingu tekurðu hana ekki upp seinna — þú heldur bara áfram
        þar sem frá var horfið.
      </p>
    </div>
  );
}
