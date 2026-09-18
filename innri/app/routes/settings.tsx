import { Button } from "~/components/ui/button";

import type { Route } from "./+types/settings";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Stillingar — Innri hringurinn" }];
}

export default function Stillingar() {
  return (
    <div className="max-w-lg">
      <h1 className="font-display text-title text-text">Stillingar</h1>

      <section className="mt-8">
        <h2 className="text-sm text-text-soft">Aðgangur</h2>

        <div className="mt-3 rounded-xl border border-line-soft bg-raised p-5">
          <p className="text-sm text-text-muted">
            Netfang og lykilorð verða hér þegar Clerk tengist (fasi 1).
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm text-text-soft">Mínar upplýsingar</h2>

        <div className="mt-3 rounded-xl border border-line-soft bg-raised p-5">
          <p className="text-sm text-text-soft">
            Þyngd, hæð, aldur og virkni. Breytist þeim eru næringarviðmiðin reiknuð upp á nýtt.
          </p>

          <Button variant="outline" className="mt-4" disabled>
            Uppfæra mælingar
          </Button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm text-text-soft">Áskrift</h2>

        <div className="mt-3 rounded-xl border border-line-soft bg-raised p-5">
          <p className="text-sm text-text-muted">Staða áskriftar og uppsögn koma í fasa 6.</p>
        </div>
      </section>
    </div>
  );
}
