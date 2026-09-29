import { UserButton } from "@clerk/react-router";
import { redirect } from "react-router";

import { hasActiveAccess } from "~/lib/access";
import { requireUser } from "~/lib/auth.server";
import { formatDate } from "~/lib/format";
import { hasCompletedOnboarding } from "~/lib/onboarding.server";

import type { Route } from "./+types/waiting";

/**
 * Where a member waits between saying "Hell YEAH" and Aron marking the claim
 * paid on /admin. Also where a member lands when a grant runs out — the same
 * wait for the same thing, a claim paid.
 *
 * Signed-in only, outside the member layout: this page exists for people the
 * layout would turn away.
 */
export async function loader(args: Route.LoaderArgs) {
  const user = await requireUser(args);

  if (!(await hasCompletedOnboarding(user.id))) {
    throw redirect("/onboarding");
  }

  const now = new Date();

  if (hasActiveAccess(user, now)) {
    throw redirect("/");
  }

  return {
    name: user.name,
    lapsedAt: user.accessGrantedUntil === null ? null : formatDate(user.accessGrantedUntil),
  };
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Á leiðinni — Innri hringurinn" }];
}

/** First name only — "Takk, Siggi", not "Takk, Sigurður Jónsson". */
const firstName = (name: string | null): string | null => name?.trim().split(/\s+/u)[0] ?? null;

export default function Waiting({ loaderData }: Route.ComponentProps) {
  const { name, lapsedAt } = loaderData;

  const greeting = firstName(name);

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <span className="crest-mark w-10" aria-hidden="true" />

        <UserButton />
      </div>

      {lapsedAt === null ? (
        <>
          <h1 className="font-display text-title text-text">
            {greeting === null ? "Takk!" : `Takk, ${greeting}!`} Þú ert klár í slaginn.
          </h1>

          <p className="mt-3 text-text-soft">
            Aron hefur fengið skráninguna þína og sendir þér kröfu í heimabankann. Um leið og
            greiðslan berst opnar hann aðganginn og planið þitt bíður þín hér.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-display text-title text-text">Aðgangurinn þinn rann út</h1>

          <p className="mt-3 text-text-soft">
            Aðgangurinn gilti til {lapsedAt}. Aron sendir þér nýja kröfu í heimabankann og opnar
            aftur um leið og hún er greidd. Planið þitt og tölurnar bíða óbreytt.
          </p>
        </>
      )}

      <div className="mt-8 rounded-xl border border-line-soft bg-raised p-5">
        <p className="font-mark text-xs uppercase tracking-mark text-text-muted">Næstu skref</p>

        <ol className="mt-3 grid gap-2 text-sm text-text-soft">
          <li>1. Krafa birtist í heimabankanum þínum.</li>
          <li>2. Þú greiðir hana.</li>
          <li>3. Aron opnar aðganginn — þú kemst inn hér með sama netfangi.</li>
        </ol>
      </div>
    </main>
  );
}
