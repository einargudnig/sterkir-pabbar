import type { Route } from "./+types/macros";

/**
 * PLACEHOLDER — replaced in phase 3.
 *
 * Macros come from the `macro_targets` table, computed once from the member's
 * onboarding answers and stored. They are deliberately NOT Sanity content:
 * they are per-member, and they are a stored snapshot so that changing the
 * formula never moves an existing member's numbers.
 */
type MacroTargets = {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
};

const placeholderMacros: MacroTargets = {
  kcal: 2450,
  proteinG: 175,
  carbsG: 245,
  fatG: 82,
};

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Mín macros — Innri hringurinn" }];
}

export function loader(_args: Route.LoaderArgs) {
  return { macros: placeholderMacros };
}

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

type MacroRow = {
  readonly label: string;
  readonly grams: number;
  readonly kcal: number;
  readonly hint: string;
};

/**
 * Shares out the calorie total across the three macros.
 *
 * Phase 3 moves this next to the calculation that produces the targets, where
 * it gets tested against the stored snapshot — the displayed split must always
 * reconcile to the stored kcal, or a member sees numbers that do not add up.
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

export default function Macros({ loaderData }: Route.ComponentProps) {
  const { macros } = loaderData;
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
          {macros.kcal.toLocaleString("is-IS")}
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {rows.map((row) => {
          const share = Math.round((row.kcal / macros.kcal) * 100);

          return (
            <div key={row.label} className="rounded-xl border border-line-soft bg-sunken p-5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm text-text-soft">{row.label}</h2>

                <span className="font-mark text-xs text-text-muted">{share}%</span>
              </div>

              <p className="mt-1 font-display text-subtitle text-text">{row.grams} g</p>

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
