import { Button } from "~/components/ui/button";
import { requireUserId } from "~/lib/auth.server";

import type { Route } from "./+types/subscribe";

export async function loader(args: Route.LoaderArgs) {
  await requireUserId(args);

  return null;
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Áskrift — Innri hringurinn" }];
}

/**
 * Paywall. Phase 6 turns the button into Repeat's card widget and an order, and the
 * loader into a read of the local subscription mirror.
 *
 * The price is deliberately absent rather than invented — Aron has not set it,
 * and a placeholder number here is the kind of thing that ships by accident.
 */

const included = [
  "Æfingaplan sniðið að markmiði þínu og hversu oft þú kemst",
  "Næringarviðmið reiknuð út frá þínum tölum",
  "Myndbönd frá Aroni af hverri æfingu",
  "Fróðleikur sem bætist við jafnt og þétt",
] as const;

export default function Askrift() {
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <span className="crest-mark mb-6 w-10" aria-hidden="true" />

      <h1 className="font-display text-title text-text">Innri hringurinn</h1>

      <p className="mt-3 text-text-soft">
        Æfingaplan og næringarviðmið byggð fyrir pabba sem hafa ekki æft í nokkur ár — án þess að
        skuldbinda sig í einkaþjálfun.
      </p>

      <ul className="mt-8 grid gap-3">
        {included.map((item) => (
          <li key={item} className="flex gap-3 rounded-lg border border-line-soft bg-raised p-4">
            <span className="mt-2 size-1.5 flex-none rounded-full bg-bronze" />

            <span className="text-sm text-text-soft">{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-xl border border-line bg-sunken p-6">
        <p className="font-mark text-xs uppercase tracking-mark text-text-muted">Mánaðaráskrift</p>

        <p className="mt-2 text-sm text-text-muted">Verð kemur inn þegar Aron hefur ákveðið það.</p>

        <Button className="mt-5 w-full" disabled>
          Ganga í innri hringinn
        </Button>

        <p className="mt-3 text-xs text-text-muted">Greiðslugátt tengist í fasa 6.</p>
      </div>
    </main>
  );
}
