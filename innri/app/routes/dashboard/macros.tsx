import { requireUser } from "~/lib/auth.server";
import { formatWholeNumber } from "~/lib/format";
import { KCAL_PER_GRAM, type MacroTargets } from "~/lib/macros";
import { latestMacros } from "~/lib/onboarding.server";

import type { Route } from "./+types/macros";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Mín macros — Innri hringurinn" }];
}

/**
 * The member's stored targets — a snapshot, never recomputed on read.
 *
 * `macro_targets` is append-only, so the newest row is current and the ones
 * behind it are the audit trail: the numbers a member was shown in October are
 * still answerable in March, even if the formula has moved since.
 */
export async function loader(args: Route.LoaderArgs) {
  const user = await requireUser(args);

  const stored = await latestMacros(user.id);

  if (!stored) {
    return { macros: null };
  }

  const macros: MacroTargets = {
    kcal: stored.kcal,
    proteinG: stored.proteinG,
    carbsG: stored.carbsG,
    fatG: stored.fatG,
    formulaVersion: stored.formulaVersion,
  };

  return { macros };
}

type MacroRow = {
  readonly label: string;
  readonly grams: number;
  readonly kcal: number;
  readonly hint: string;
};

/**
 * Shares out the calorie total across the three macros.
 *
 * `KCAL_PER_GRAM` comes from the formula module rather than a second copy here:
 * `macros.test.ts` asserts that the split reconciles to the stored total for
 * every possible member, and that assertion is worthless if this page divides
 * by different numbers than the calculation multiplied by.
 */
const toRows = (macros: MacroTargets): readonly MacroRow[] => [
  {
    label: "Prótein",
    grams: macros.proteinG,
    kcal: macros.proteinG * KCAL_PER_GRAM.protein,
    hint: "Hafðu próteingjafa með í hverri máltíð.",
  },
  {
    label: "Kolvetni",
    grams: macros.carbsG,
    kcal: macros.carbsG * KCAL_PER_GRAM.carbs,
    hint: "Mest í kringum æfingar ef þú getur valið.",
  },
  {
    label: "Fita",
    grams: macros.fatG,
    kcal: macros.fatG * KCAL_PER_GRAM.fat,
    hint: "Ekki skera hana niður í núll — hún stýrir hormónum.",
  },
];

const shareOf = (row: MacroRow | undefined, total: number): number =>
  row === undefined ? 0 : Math.round((row.kcal / total) * 100);

export default function Macros({ loaderData }: Route.ComponentProps) {
  const { macros } = loaderData;

  /**
   * Reachable when the questionnaire was answered but the targets were not
   * written — which the completion transaction makes impossible, so this exists
   * for the member rather than for the happy path.
   */
  if (!macros) {
    return (
      <div className="max-w-prose">
        <h1 className="font-display text-title text-text">Mín macros</h1>

        <p className="mt-4 text-text-soft">
          Við náðum ekki að reikna viðmiðin þín. Sendu Aroni skilaboð og hann kippir því í lag.
        </p>
      </div>
    );
  }

  const rows = toRows(macros);

  return (
    <div>
      <header>
        <h1 className="font-display text-title text-text">Mín macros</h1>

        <p className="mt-2 text-text-soft">
          Þetta eru viðmið, ekki reglur. Hittirðu nálægt þeim flesta daga ertu á réttri leið.
        </p>
      </header>

      <div className="mt-8 rounded-xl border border-line bg-raised p-6">
        <p className="font-mark text-xs uppercase tracking-mark text-text-muted">
          Hitaeiningar á dag
        </p>

        <p className="mt-2 font-display text-display leading-none text-bronze">
          {formatWholeNumber(macros.kcal)}
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {rows.map((row, index) => {
          /**
           * The last share is the remainder rather than its own rounding, so
           * the three add up to 100. Three independent roundings show
           * 38/38/25 — and a page whose only job is to be trusted cannot print
           * numbers that sum to 101%.
           */
          const share =
            index === rows.length - 1
              ? 100 - shareOf(rows[0], macros.kcal) - shareOf(rows[1], macros.kcal)
              : shareOf(row, macros.kcal);

          return (
            <div key={row.label} className="rounded-xl border border-line-soft bg-sunken p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm text-text-soft">{row.label}</h2>

                {/* Not font-mark: Orbitron draws a slashed zero, so "30%"
                    renders as "3Ø%". `.impeccable.md` reserves it for the
                    wordmark and all-caps labels, never for digits. */}
                <span className="text-xs text-text-muted">{share}%</span>
              </div>

              <p className="mt-1 font-display text-subtitle text-text">
                {formatWholeNumber(row.grams)} g
              </p>

              <p className="mt-2 text-sm text-text-muted">{row.hint}</p>
            </div>
          );
        })}
      </div>

      {/* Not fine print. Auto-generated calorie targets for strangers is the
          one part of this product that can actually hurt someone, so the
          caveat sits in the flow rather than in a footer. */}
      <div className="mt-8 rounded-lg border border-line-soft bg-sunken p-4">
        <p className="text-sm text-text-soft">
          Þessi viðmið eru reiknuð út frá því sem þú gafst upp í upphafi. Þau koma ekki í stað
          ráðgjafar frá lækni eða næringarfræðingi.
        </p>

        <p className="mt-2 text-sm text-text-muted">
          Ef þú ert með undirliggjandi sjúkdóm, tekur lyf sem hafa áhrif á matarlyst eða efnaskipti,
          eða hefur sögu um átröskun — talaðu við lækni áður en þú fylgir þessu.
        </p>
      </div>
    </div>
  );
}
