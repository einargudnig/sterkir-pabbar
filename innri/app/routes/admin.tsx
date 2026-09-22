import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";

import { requireUserId } from "~/lib/auth.server";

import type { Route } from "./+types/admin";

/**
 * Signed-in only. The ROLE check — that this is actually Aron — needs the
 * `users.is_admin` column, so it lands in phase 5 with the database. Until then
 * every control on the page is disabled and the loader returns nothing, so a
 * signed-in stranger who guesses the URL sees an inert form.
 */
export async function loader(args: Route.LoaderArgs) {
  await requireUserId(args);

  return null;
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Umsjón — Innri hringurinn" }, { name: "robots", content: "noindex, nofollow" }];
}

/**
 * Aron's ops page. Not member-facing, so it sits outside the member layout and
 * gets its own check — phase 1 gates it on a Clerk role rather than on having a
 * subscription, since Aron will not be paying for his own product.
 *
 * Phase 5 makes these controls real. They exist for comping a friend, fixing a
 * payment that failed in a way Repeat could not retry, and extending someone who
 * had a genuinely bad month — not as the primary way anyone gets access.
 */
export default function Admin() {
  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-display text-title text-text">Umsjón</h1>

      <p className="mt-2 text-text-soft">Handvirkur aðgangur. Notist sparlega.</p>

      <div className="mt-8 rounded-xl border border-line-soft bg-raised p-5">
        <div className="grid gap-2">
          <Label htmlFor="netfang">Netfang meðlims</Label>
          <Input id="netfang" type="email" placeholder="nonni@example.is" />
        </div>

        <div className="mt-4 grid gap-2">
          <Label htmlFor="dagar">Dagar til viðbótar</Label>
          <Input id="dagar" type="number" inputMode="numeric" defaultValue={30} />
        </div>

        <Button className="mt-5 w-full" disabled>
          Veita aðgang
        </Button>

        <p className="mt-3 text-xs text-text-muted">Virkjast í fasa 5.</p>
      </div>
    </main>
  );
}
