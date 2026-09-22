/**
 * The shared vocabulary of the onboarding wizard.
 *
 * Plain module, not `.server`: the wizard's components render these labels, the
 * Zod schemas parse against these values, and `db/schema.ts` builds its pgEnums
 * from the same tuples. Declaring them once is what stops the three from
 * drifting — a value added here without a label is a type error, and a value
 * added to the database enum alone would not compile.
 */

export const STEPS = ["health", "acknowledge", "measurements", "goal", "frequency"] as const;

export type Step = (typeof STEPS)[number];

export const isStep = (value: string | null): value is Step => STEPS.some((step) => step === value);

export const GOAL_VALUES = ["fitutap", "vodvauppbygging"] as const;

export type Goal = (typeof GOAL_VALUES)[number];

export const SEX_VALUES = ["karl", "kona", "annad"] as const;

export type Sex = (typeof SEX_VALUES)[number];

export const ACTIVITY_VALUES = ["kyrrseta", "lett", "midlungs", "mikil"] as const;

export type ActivityLevel = (typeof ACTIVITY_VALUES)[number];

/**
 * The four health answers that change what the member is shown.
 *
 * `confirmedAdult` is deliberately not one of them: it is a condition of using
 * the product at all rather than something recorded and worked around, so it is
 * validated separately and blocks the step when unchecked.
 */
export const HEALTH_FLAGS = [
  {
    name: "chronicCondition",
    label: "Ég er með hjartasjúkdóm, sykursýki eða annan langvinnan sjúkdóm",
  },
  { name: "medication", label: "Ég tek lyf sem hafa áhrif á matarlyst eða efnaskipti" },
  { name: "eatingDisorder", label: "Ég hef sögu um átröskun" },
  { name: "injury", label: "Ég er að glíma við meiðsli sem takmarka hreyfingu" },
] as const;

export type HealthFlagName = (typeof HEALTH_FLAGS)[number]["name"];

export type HealthFlags = Readonly<Record<HealthFlagName, boolean>>;

/**
 * A Record rather than a list of objects, so adding a value to ACTIVITY_VALUES
 * without writing its label does not compile.
 *
 * Every level carries a concrete example. "Miðlungs virkni" means nothing to
 * someone who has not trained in years, and a member who guesses wrong here
 * carries that error into every number the app gives them.
 */
export const ACTIVITY_LABELS = {
  kyrrseta: { label: "Kyrrseta", example: "Skrifstofuvinna, lítil hreyfing utan vinnu" },
  lett: { label: "Létt virkni", example: "Gangandi part úr degi, létt hreyfing stöku sinnum" },
  midlungs: { label: "Miðlungs virkni", example: "Á fótunum megnið af deginum" },
  mikil: { label: "Mikil virkni", example: "Líkamleg vinna alla daga" },
} satisfies Record<ActivityLevel, { readonly label: string; readonly example: string }>;

export const GOAL_LABELS = {
  fitutap: { label: "Fitutap", description: "Léttast og halda styrk á meðan." },
  vodvauppbygging: { label: "Vöðvauppbygging", description: "Þyngjast og byggja upp styrk." },
} satisfies Record<Goal, { readonly label: string; readonly description: string }>;

export const SEX_LABELS = {
  karl: "Karl",
  kona: "Kona",
  annad: "Annað",
} satisfies Record<Sex, string>;

/**
 * Bounds, in one place because two callers need to agree on them: the Zod
 * schema that rejects a bad submission, and the `min`/`max` attributes that let
 * the browser catch it first.
 */
export const LIMITS = {
  weightKg: { min: 40, max: 250 },
  heightCm: { min: 130, max: 220 },
  age: { min: 18, max: 90 },
} as const;

/**
 * The steps this member will actually walk through.
 *
 * The acknowledgement step exists only for someone who checked a health flag.
 * Showing it to everyone would make it furniture — a page you click past —
 * which is the opposite of what an acknowledgement is for.
 */
export const stepsFor = (needsAcknowledgement: boolean): readonly Step[] =>
  needsAcknowledgement ? STEPS : STEPS.filter((step) => step !== "acknowledge");
