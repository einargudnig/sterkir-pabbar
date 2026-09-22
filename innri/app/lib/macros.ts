import type { ActivityLevel, Goal, Sex } from "~/lib/onboarding";

/**
 * Macro targets from a member's onboarding answers.
 *
 * Pure and plain on purpose. Nothing here touches the database, the request, or
 * Sanity, because this is the one module in the app whose output a member will
 * act on with their body — so it has to be testable in isolation and provable
 * against its floor.
 *
 * Mifflin-St Jeor for resting metabolism, an activity multiplier for daily
 * expenditure, then the goal's deficit or surplus. That part is mechanical.
 * `FORMULA` is not.
 */

/**
 * ── THE JUDGMENT CALLS ────────────────────────────────────────────────────
 *
 * These six numbers are health decisions, not implementation details, and
 * `docs/solutions/inner-circle.md` reserves them for Einar and Aron rather than
 * the agent. They are grouped here, with their reasoning, so that changing one
 * is a deliberate five-line edit rather than an archaeology exercise.
 *
 * **v1 values are conservative defaults awaiting Aron's sign-off.** They are
 * defensible and safe to ship behind a paywall nobody has paid through yet;
 * they are not yet what a coach has said he believes.
 *
 * Bump `version` whenever any other value here changes. Every stored row
 * carries it, so a member asking "why did the app tell me 1.800 kcal in
 * October" can be answered with the rules that were actually in force.
 */
export const FORMULA = {
  version: 1,

  /**
   * The hard floor. No combination of inputs may produce a target below this,
   * and `macros.test.ts` asserts that across the whole input space.
   *
   * 1.500 kcal is the common conservative floor for adult men outside clinical
   * supervision. The members here are fathers who have not trained in years —
   * the failure mode that actually matters is a target so low they cannot hold
   * it through a week with a sleepless night in it.
   */
  kcalFloor: 1500,

  /** Fat loss. 20% below expenditure — slow enough to survive a bad week. */
  deficit: 0.2,

  /** Muscle gain. 10% above — enough to build on, small enough to stay lean. */
  surplus: 0.1,

  /**
   * Protein per kilo of bodyweight. 1,8 g/kg preserves muscle in a deficit
   * without becoming a number nobody can eat.
   */
  proteinPerKg: 1.8,

  /**
   * Ceiling on protein as a share of the day's calories.
   *
   * Without it, a heavy member on the floor gets an arithmetically impossible
   * plan: 250 kg at 1,8 g/kg is 450 g of protein, which is 1.800 kcal on its
   * own — more than the floor, leaving negative carbohydrates. The cap is what
   * makes the split total correctly for every member rather than most of them.
   */
  proteinMaxShare: 0.4,

  /** Fat as a share of calories. Below ~20% starts costing hormone function. */
  fatShare: 0.25,
} as const;

/**
 * Mifflin-St Jeor's sex constant.
 *
 * `annad` has no published constant, and inventing one is not an option — so
 * this uses the midpoint of the two that exist (-78). It is the choice that
 * makes the fewest claims: it never gives someone a target derived from a body
 * the formula was not fitted to, and it errs neither high nor low.
 */
const SEX_CONSTANT = {
  karl: 5,
  kona: -161,
  annad: (5 + -161) / 2,
} satisfies Record<Sex, number>;

/** Standard Harris-Benedict activity multipliers, as in the plan document. */
const ACTIVITY_MULTIPLIER = {
  kyrrseta: 1.2,
  lett: 1.375,
  midlungs: 1.55,
  mikil: 1.725,
} satisfies Record<ActivityLevel, number>;

const GOAL_ADJUSTMENT = {
  fitutap: 1 - FORMULA.deficit,
  vodvauppbygging: 1 + FORMULA.surplus,
} satisfies Record<Goal, number>;

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export type MacroInput = {
  readonly weightKg: number;
  readonly heightCm: number;
  readonly age: number;
  readonly sex: Sex;
  readonly activityLevel: ActivityLevel;
  readonly goal: Goal;
};

export type MacroTargets = {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  readonly formulaVersion: number;
};

/** Resting metabolic rate. Mifflin-St Jeor (1990). */
export const restingMetabolicRate = (input: MacroInput): number =>
  10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + SEX_CONSTANT[input.sex];

/** Resting rate scaled by how the member spends their day. */
export const dailyExpenditure = (input: MacroInput): number =>
  restingMetabolicRate(input) * ACTIVITY_MULTIPLIER[input.activityLevel];

/**
 * The member's stored targets.
 *
 * Carbohydrate is the balancing macro rather than a fourth independent
 * calculation: protein and fat are the two with a physiological reason for
 * their size, so whatever calories remain are carbohydrate. That is also what
 * keeps the three rows on `/dashboard/macros` adding up to the total shown
 * above them — a member who finds the numbers do not reconcile has no reason to
 * trust any of them.
 */
export const computeMacros = (input: MacroInput): MacroTargets => {
  const target = dailyExpenditure(input) * GOAL_ADJUSTMENT[input.goal];

  const kcal = Math.max(FORMULA.kcalFloor, Math.round(target));

  const proteinCeiling = (FORMULA.proteinMaxShare * kcal) / KCAL_PER_GRAM.protein;

  const proteinG = Math.round(Math.min(FORMULA.proteinPerKg * input.weightKg, proteinCeiling));

  const fatG = Math.round((FORMULA.fatShare * kcal) / KCAL_PER_GRAM.fat);

  const remaining = kcal - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;

  return {
    kcal,
    proteinG,
    carbsG: Math.round(remaining / KCAL_PER_GRAM.carbs),
    fatG,
    formulaVersion: FORMULA.version,
  };
};

/** What the three rows on the macros page add up to. Exported for the test. */
export const caloriesFromMacros = (targets: MacroTargets): number =>
  targets.proteinG * KCAL_PER_GRAM.protein +
  targets.carbsG * KCAL_PER_GRAM.carbs +
  targets.fatG * KCAL_PER_GRAM.fat;

export { KCAL_PER_GRAM };
