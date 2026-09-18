import { useSearchParams } from "react-router";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { requireUserId } from "~/lib/auth.server";
import { availableFrequenciesQuery, sanity } from "~/lib/sanity.server";

import type { Route } from "./+types/onboarding";

export async function loader(args: Route.LoaderArgs) {
  await requireUserId(args);

  /**
   * Only frequencies with a published plan behind them. Phase 3 re-queries this
   * once the goal is chosen; until the wizard persists answers it asks for the
   * fat-loss plans, which is what the seed data publishes.
   *
   * A member must never be offered an option that leads nowhere — that is what
   * lets Aron launch with one plan and add the rest as he films.
   */
  const frequencies = await sanity.fetch(availableFrequenciesQuery, {
    goal: "fitutap",
  });

  return { frequencies };
}

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Upphaf — Innri hringurinn" }];
}

/**
 * Onboarding wizard.
 *
 * The step lives in the URL rather than component state so the phone back
 * button walks backwards through the wizard instead of leaving it — the single
 * most common way a form like this loses someone.
 *
 * Phase 3 replaces the local state with an action per step, persists answers to
 * Postgres as they are given (so a member who drops out mid-wizard resumes
 * rather than restarts), and drives the frequency options from the training
 * plans actually published in Sanity.
 */

const STEPS = ["health", "measurements", "goal", "frequency"] as const;

type Step = (typeof STEPS)[number];

const isStep = (value: string | null): value is Step => STEPS.some((step) => step === value);

const HEALTH_FLAGS = [
  { id: "aldur", label: "Ég er 18 ára eða eldri", mustBeChecked: true },
  {
    id: "sjukdomur",
    label: "Ég er með hjartasjúkdóm, sykursýki eða annan langvinnan sjúkdóm",
    mustBeChecked: false,
  },
  {
    id: "lyf",
    label: "Ég tek lyf sem hafa áhrif á matarlyst eða efnaskipti",
    mustBeChecked: false,
  },
  {
    id: "atroskun",
    label: "Ég hef sögu um átröskun",
    mustBeChecked: false,
  },
  {
    id: "meidsli",
    label: "Ég er að glíma við meiðsli sem takmarka hreyfingu",
    mustBeChecked: false,
  },
] as const;

const ACTIVITY_LEVELS = [
  { value: "kyrrseta", label: "Kyrrseta", example: "Skrifstofuvinna, lítil hreyfing utan vinnu" },
  {
    value: "lett",
    label: "Létt virkni",
    example: "Gangandi part úr degi, létt hreyfing stöku sinnum",
  },
  { value: "midlungs", label: "Miðlungs virkni", example: "Á fótunum megnið af deginum" },
  { value: "mikil", label: "Mikil virkni", example: "Líkamleg vinna alla daga" },
] as const;

function StepHeader({ step }: { step: Step }) {
  const index = STEPS.indexOf(step);

  return (
    <div className="mb-8">
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((item, position) => (
          <span
            key={item}
            className={`h-1 flex-1 rounded-full ${
              position <= index ? "bg-bronze" : "bg-line-soft"
            }`}
          />
        ))}
      </div>

      <p className="mt-3 font-mark text-xs uppercase tracking-mark text-text-muted">
        Skref {index + 1} af {STEPS.length}
      </p>
    </div>
  );
}

export default function Onboarding({ loaderData }: Route.ComponentProps) {
  const { frequencies } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("step");
  const step: Step = isStep(requested) ? requested : "health";

  const goTo = (next: Step) => {
    setSearchParams({ step: next });
  };

  const index = STEPS.indexOf(step);
  const previous = index > 0 ? STEPS[index - 1] : null;
  const next = index < STEPS.length - 1 ? STEPS[index + 1] : null;

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <StepHeader step={step} />

      {step === "health" && (
        <section>
          <h1 className="font-display text-title text-text">Fyrst — heilsan</h1>

          <p className="mt-2 text-text-soft">
            Þetta er ekki formsatriði. Svörin ráða því hvort við getum gefið þér næringarviðmið
            yfirleitt.
          </p>

          <ul className="mt-6 grid gap-3">
            {HEALTH_FLAGS.map((flag) => (
              <li
                key={flag.id}
                className="flex items-start gap-3 rounded-lg border border-line-soft bg-raised p-4"
              >
                <input type="checkbox" id={flag.id} className="mt-1 size-4 accent-bronze" />

                <label htmlFor={flag.id} className="text-sm text-text-soft">
                  {flag.label}
                </label>
              </li>
            ))}
          </ul>

          {/* Phase 3 decision, needs Aron's sign-off: which of these hard-stop
              the wizard, which show a "talk to your doctor first" acknowledgement,
              and which are recorded and otherwise ignored. */}
          <p className="mt-4 text-xs text-text-muted">
            Svörin eru geymd með þínum upplýsingum og eru ekki sýnileg öðrum.
          </p>
        </section>
      )}

      {step === "measurements" && (
        <section>
          <h1 className="font-display text-title text-text">Mælingar</h1>

          <p className="mt-2 text-text-soft">
            Án þessara talna eru næringarviðmiðin ágiskun. Þú getur breytt þeim síðar.
          </p>

          <div className="mt-6 grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="thyngd">Þyngd (kg)</Label>
              <Input id="thyngd" type="number" inputMode="numeric" min={40} max={250} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="haed">Hæð (cm)</Label>
              <Input id="haed" type="number" inputMode="numeric" min={130} max={220} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="aldur">Aldur</Label>
              <Input id="aldur" type="number" inputMode="numeric" min={18} max={90} />
            </div>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm text-text-soft">
                Hversu virkur ertu dags daglega?
              </legend>

              <RadioGroup defaultValue="kyrrseta">
                {ACTIVITY_LEVELS.map((level) => (
                  <label
                    key={level.value}
                    className="flex items-start gap-3 rounded-lg border border-line-soft bg-raised p-4"
                  >
                    <RadioGroupItem value={level.value} className="mt-1" />

                    <span>
                      <span className="block text-sm text-text">{level.label}</span>
                      <span className="block text-sm text-text-muted">{level.example}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
          </div>
        </section>
      )}

      {step === "goal" && (
        <section>
          <h1 className="font-display text-title text-text">Hvert er markmiðið?</h1>

          <p className="mt-2 text-text-soft">
            Þetta ræður næringarviðmiðunum. Þú getur skipt um síðar.
          </p>

          <div className="mt-6">
            <RadioGroup defaultValue="fitutap">
              <label className="flex items-start gap-3 rounded-lg border border-line-soft bg-raised p-5">
                <RadioGroupItem value="fitutap" className="mt-1" />

                <span>
                  <span className="block text-text">Fitutap</span>
                  <span className="block text-sm text-text-muted">
                    Léttast og halda styrk á meðan.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-line-soft bg-raised p-5">
                <RadioGroupItem value="vodvauppbygging" className="mt-1" />

                <span>
                  <span className="block text-text">Vöðvauppbygging</span>
                  <span className="block text-sm text-text-muted">
                    Þyngjast og byggja upp styrk.
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>
        </section>
      )}

      {step === "frequency" && (
        <section>
          <h1 className="font-display text-title text-text">Hversu oft viltu æfa?</h1>

          <p className="mt-2 text-text-soft">
            Veldu það sem þú treystir þér til í verstu viku mánaðarins, ekki þeirri bestu.
          </p>

          {/* Phase 3: these options come from the training plans published in
              Sanity, so Aron can launch with one frequency and add the rest as
              he films them. Never render an option with no plan behind it. */}
          <div className="mt-6">
            <RadioGroup defaultValue={String(frequencies[0] ?? 3)}>
              {frequencies.map((count) => (
                <label
                  key={count}
                  className="flex items-center gap-3 rounded-lg border border-line-soft bg-raised p-5"
                >
                  <RadioGroupItem value={String(count)} />

                  <span className="text-text">{count} sinnum í viku</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </section>
      )}

      <div className="mt-10 flex items-center justify-between gap-4">
        {previous ? (
          <Button variant="ghost" onClick={() => goTo(previous)}>
            Til baka
          </Button>
        ) : (
          <span />
        )}

        {next ? (
          <Button onClick={() => goTo(next)}>Áfram</Button>
        ) : (
          <Button>Klára og sjá planið</Button>
        )}
      </div>
    </main>
  );
}
