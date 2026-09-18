import { planByGoalAndFrequencyQuery, sanity } from "~/lib/sanity.server";
import type { PlanByGoalAndFrequencyQueryResult } from "~/lib/sanity.types";

import type { Route } from "./+types/workouts";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Mínar æfingar — Innri hringurinn" }];
}

/**
 * Phase 3 reads the member's goal and frequency from `plan_assignments` and
 * passes those in. Until onboarding writes that row there is nothing to read,
 * so this asks for the combination the seed data publishes.
 */
export async function loader(_args: Route.LoaderArgs) {
  const plan = await sanity.fetch(planByGoalAndFrequencyQuery, {
    goal: "fitutap",
    sessionsPerWeek: 3,
  });

  return { plan };
}

type Session = NonNullable<PlanByGoalAndFrequencyQueryResult>["sessions"];

function SessionCard({ session }: { session: NonNullable<Session>[number] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-raised">
      <header className="px-6 py-5">
        <h2 className="font-display text-subtitle text-text">{session.title}</h2>
      </header>

      <div>
        <ul className="divide-y divide-line-soft border-t border-line-soft">
          {session.exercises?.map((item) => (
            <li key={item._key} className="px-6 py-4">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-medium text-text">{item.exercise?.name ?? "Æfing vantar"}</h3>

                <span className="whitespace-nowrap font-mark text-sm text-bronze">
                  {item.sets} × {item.reps}
                </span>
              </div>

              {/* The per-plan note wins over the exercise's general cue: it was
                  written about this exercise in this plan specifically. */}
              {(item.note ?? item.exercise?.cue) && (
                <p className="mt-1.5 text-sm text-text-muted">{item.note ?? item.exercise?.cue}</p>
              )}

              {!item.exercise?.videoUrl && (
                <p className="mt-2 text-xs text-text-muted italic">Myndband kemur</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
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

  return (
    <div>
      <header>
        <h1 className="font-display text-title text-text">{plan.title}</h1>

        <p className="mt-2 text-text-soft">
          {plan.intro ??
            "Taktu æfingarnar í þeirri röð sem þér hentar — það skiptir meira máli að þær klárist en hvenær."}
        </p>
      </header>

      <div className="mt-8 grid gap-5">
        {plan.sessions?.map((session) => (
          <SessionCard key={session._key} session={session} />
        ))}
      </div>

      <p className="mt-8 rounded-lg border border-line-soft bg-sunken p-4 text-sm text-text-muted">
        Missirðu úr æfingu tekurðu hana ekki upp seinna — þú heldur bara áfram þar sem frá var
        horfið.
      </p>
    </div>
  );
}
