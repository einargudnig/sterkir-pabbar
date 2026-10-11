import { ChevronLeft } from "lucide-react";
import { Link } from "react-router";
import { z } from "zod";

import { ExerciseVideo } from "~/components/exercise-video";
import { requireUser } from "~/lib/auth.server";
import { assignedPlan } from "~/lib/onboarding.server";
import { toVideoEmbed } from "~/lib/video";

import type { Route } from "./+types/session";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.session.title ?? "Æfing"} — Innri hringurinn` }];
}

/**
 * The URL carries the session's 1-based position, not its Sanity `_key`:
 * `/dashboard/workouts/2` reads as "æfing 2 af 3", which is what the page says.
 * If Aron reorders sessions a bookmark points at a different one — harmless
 * while nothing is tracked against it.
 */
const paramsSchema = z.object({ session: z.coerce.number().int().min(1) });

export async function loader(args: Route.LoaderArgs) {
  const user = await requireUser(args);

  const params = paramsSchema.safeParse(args.params);

  const plan = await assignedPlan(user.id);

  const sessions = plan?.sessions ?? [];

  const position = params.success ? params.data.session : 0;

  const session = sessions[position - 1];

  if (!session) {
    throw new Response("Æfingin fannst ekki", { status: 404 });
  }

  const next = sessions.length > 1 ? (position % sessions.length) + 1 : null;

  const exercises = (session.exercises ?? []).map((item) => ({
    ...item,
    embed: item.exercise?.videoUrl ? toVideoEmbed(item.exercise.videoUrl) : null,
  }));

  return {
    session: { ...session, exercises },
    position,
    total: sessions.length,
    next: next === null ? null : { position: next, title: sessions[next - 1]?.title },
  };
}

export default function Session({ loaderData }: Route.ComponentProps) {
  const { session, position, total, next } = loaderData;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/dashboard/workouts"
          className="-ml-1 flex items-center gap-1 rounded-md px-1 py-1 text-sm text-text-soft transition-colors hover:text-text"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Vikan
        </Link>

        <p className="font-mark text-xs uppercase tracking-mark text-text-muted">
          Æfing {position} af {total}
        </p>
      </div>

      <h1 className="mt-6 font-display text-title text-text">{session.title}</h1>

      <section className="mt-6 overflow-hidden rounded-xl border border-line bg-raised">
        <ul className="divide-y divide-line-soft">
          {session.exercises.map((item) => (
            <li key={item._key} className="px-6 py-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-medium text-text">{item.exercise?.name ?? "Æfing vantar"}</h2>

                {/* Same rule as the macro shares: Orbitron slashes its zero,
                    so "3 × 10" would read "3 × 1Ø". Sets and reps are the most
                    looked-at numbers in the app — they get the body font. */}
                <span className="whitespace-nowrap text-sm font-medium text-bronze">
                  {item.sets} × {item.reps}
                </span>
              </div>

              {/* The per-plan note wins over the exercise's general cue: it was
                  written about this exercise in this plan specifically. */}
              {(item.note ?? item.exercise?.cue) && (
                <p className="mt-1.5 text-sm text-text-muted">{item.note ?? item.exercise?.cue}</p>
              )}

              {item.embed ? (
                <ExerciseVideo embed={item.embed} name={item.exercise?.name ?? "æfing"} />
              ) : (
                <p className="mt-2 text-xs text-text-muted italic">Myndband kemur</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {next && (
        <p className="mt-6 text-sm text-text-muted">
          Næst á eftir:{" "}
          <Link
            to={`/dashboard/workouts/${next.position}`}
            className="text-text-soft underline underline-offset-4 hover:text-text"
          >
            {next.title}
          </Link>
        </p>
      )}
    </div>
  );
}
