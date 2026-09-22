import { createCookie } from "react-router";
import { z } from "zod";

import { serverEnv } from "~/lib/env.server";
import {
  ACTIVITY_VALUES,
  GOAL_VALUES,
  type HealthFlags,
  LIMITS,
  SEX_VALUES,
  type Step,
} from "~/lib/onboarding";

/**
 * What a step submission is allowed to contain, and where part-finished answers
 * live until the member reaches the end.
 *
 * Deliberately holds no database import. Everything here is a decision about
 * the member's answers — what is valid, what is still missing, which step that
 * puts them on — and none of it needs Postgres to be true. Keeping the writes
 * in `onboarding.server.ts` is what lets `onboarding-steps.test.ts` exercise
 * this whole state machine without a connection string, which matters because
 * `anti-slop/no-module-mocking` rules out faking one.
 *
 * Answers accumulate in a signed cookie and land in Postgres in one
 * transaction at the end. The alternative — a draft row filled in column by
 * column — would mean half-answered health data sitting in the database for
 * everyone who opened the wizard and thought better of it, and a nullable
 * mirror of a table that is documented as holding completed runs only.
 *
 * The cost is honest: a member who switches device mid-wizard starts again.
 * Four steps, and the answers are about their own body, so there is nothing to
 * look up.
 */

const DRAFT_COOKIE = "sp_onboarding";

const TWO_WEEKS_IN_SECONDS = 60 * 60 * 24 * 14;

let cookie: ReturnType<typeof createCookie> | null = null;

/**
 * Built on first use rather than at import, because the secret is read through
 * `serverEnv()` and a build has no reason to hold production secrets.
 *
 * Signed, and that is not ceremony: this cookie is the only thing asserting
 * that the member confirmed being over 18 and acknowledged the health warning.
 * Unsigned, both could be handed to the server by anyone willing to edit a
 * cookie, and the age gate would be decoration.
 */
const draftCookie = () => {
  cookie ??= createCookie(DRAFT_COOKIE, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv().NODE_ENV === "production",
    maxAge: TWO_WEEKS_IN_SECONDS,
    secrets: [serverEnv().SESSION_SECRET],
  });

  return cookie;
};

const draftSchema = z.object({
  confirmedAdult: z.boolean().optional(),

  chronicCondition: z.boolean().optional(),
  medication: z.boolean().optional(),
  eatingDisorder: z.boolean().optional(),
  injury: z.boolean().optional(),

  /** ISO timestamp, set the moment the warning was accepted. */
  acknowledgedHealthAt: z.string().optional(),

  weightKg: z.number().int().optional(),
  heightCm: z.number().int().optional(),
  age: z.number().int().optional(),
  sex: z.enum(SEX_VALUES).optional(),
  activityLevel: z.enum(ACTIVITY_VALUES).optional(),

  goal: z.enum(GOAL_VALUES).optional(),
  sessionsPerWeek: z.number().int().optional(),
});

export type OnboardingDraft = z.infer<typeof draftSchema>;

/**
 * Written out field by field rather than derived from `HEALTH_FLAGS`, so that
 * adding a flag to that list breaks this function until its draft field and
 * its database column exist too. `HealthFlags` is a Record over the union — a
 * missing key is a type error, not a silently unrecorded answer.
 */
export const healthFlagsFromDraft = (draft: OnboardingDraft): HealthFlags => ({
  chronicCondition: draft.chronicCondition ?? false,
  medication: draft.medication ?? false,
  eatingDisorder: draft.eatingDisorder ?? false,
  injury: draft.injury ?? false,
});

/** Any flag at all means Aron needs to know before the app hands out numbers. */
export const needsAcknowledgement = (draft: OnboardingDraft): boolean => {
  const flags = healthFlagsFromDraft(draft);

  return flags.chronicCondition || flags.medication || flags.eatingDisorder || flags.injury;
};

export const readDraft = async (request: Request): Promise<OnboardingDraft> => {
  const parsed = draftSchema.safeParse(await draftCookie().parse(request.headers.get("cookie")));

  /**
   * An unparseable cookie is treated as no cookie. It means a rotated secret, a
   * schema that has moved on, or tampering — and in all three the right answer
   * is to let the member start the four steps again rather than to show them an
   * error about a cookie.
   */
  return parsed.success ? parsed.data : {};
};

export const draftHeader = async (draft: OnboardingDraft): Promise<string> =>
  draftCookie().serialize(draft);

export const clearedDraftHeader = async (): Promise<string> =>
  draftCookie().serialize("", { maxAge: 0 });

/* ── Step submissions ──────────────────────────────────────────────────── */

const optionalCheckbox = z
  .string()
  .optional()
  .transform((value) => value === "on");

const requiredCheckbox = (message: string) =>
  z
    .string()
    .optional()
    .transform((value) => value === "on")
    .refine((checked) => checked, { message });

type Bounds = { readonly min: number; readonly max: number };

/**
 * The field labels are written lowercase because most messages embed them
 * mid-sentence ("Sláðu inn þyngd"). One message starts with the label, and an
 * Icelandic sentence does not begin in lowercase.
 */
const sentenceCase = (label: string): string =>
  label.charAt(0).toLocaleUpperCase("is-IS") + label.slice(1);

/**
 * A number typed by someone on a phone.
 *
 * Accepts the Icelandic decimal comma and rounds, because "94,5" is what a
 * bathroom scale shows and rejecting it would read as the app being broken.
 * The column is a smallint and half a kilo does not move a macro target.
 */
const numberField = (label: string, bounds: Bounds) =>
  z
    .string()
    .optional()
    .transform((value) => (value ?? "").trim().replace(",", "."))
    .refine((value) => value.length > 0, { message: `Sláðu inn ${label}` })
    .refine((value) => value.length === 0 || /^\d+(\.\d+)?$/u.test(value), {
      message: `${sentenceCase(label)} verður að vera tala`,
    })
    .transform((value) => Math.round(Number(value)))
    .refine((value) => value >= bounds.min && value <= bounds.max, {
      message: `Sláðu inn ${label} á milli ${bounds.min} og ${bounds.max}`,
    });

const healthSchema = z.object({
  confirmedAdult: requiredCheckbox("Þjónustan er fyrir 18 ára og eldri"),
  chronicCondition: optionalCheckbox,
  medication: optionalCheckbox,
  eatingDisorder: optionalCheckbox,
  injury: optionalCheckbox,
});

const acknowledgeSchema = z.object({
  acknowledged: requiredCheckbox("Þú þarft að staðfesta þetta til að halda áfram"),
});

const measurementsSchema = z.object({
  weightKg: numberField("þyngd", LIMITS.weightKg),
  heightCm: numberField("hæð", LIMITS.heightCm),
  age: numberField("aldur", LIMITS.age),
  sex: z.enum(SEX_VALUES, { error: "Veldu kyn" }),
  activityLevel: z.enum(ACTIVITY_VALUES, { error: "Veldu hversu virkur þú ert" }),
});

const goalSchema = z.object({
  goal: z.enum(GOAL_VALUES, { error: "Veldu markmið" }),
});

const frequencySchema = z.object({
  sessionsPerWeek: numberField("fjölda æfinga", { min: 1, max: 7 }),
});

/**
 * Every field name any step can submit.
 *
 * A closed union rather than `Record<string, string>`: the error map is read by
 * name in the wizard's JSX, so a typo in either place should be a type error
 * rather than a message that silently never renders.
 */
export const FIELD_NAMES = [
  "confirmedAdult",
  "chronicCondition",
  "medication",
  "eatingDisorder",
  "injury",
  "acknowledged",
  "weightKg",
  "heightCm",
  "age",
  "sex",
  "activityLevel",
  "goal",
  "sessionsPerWeek",
] as const;

export type FieldName = (typeof FIELD_NAMES)[number];

export type StepErrors = Partial<Readonly<Record<FieldName, string>>>;

export type StepSubmission =
  | { readonly ok: true; readonly patch: OnboardingDraft }
  | { readonly ok: false; readonly errors: StepErrors };

/** First issue per field — a member fixes one thing at a time. */
const errorsFrom = (error: z.ZodError) => {
  const errors: Partial<Record<FieldName, string>> = {};

  for (const issue of error.issues) {
    /**
     * Matched against the known names rather than cast from the issue path, so
     * an issue on something the wizard does not render cannot land in a map the
     * JSX reads by key.
     */
    const field = FIELD_NAMES.find((name) => name === issue.path[0]);

    if (field !== undefined) {
      errors[field] ??= issue.message;
    }
  }

  return errors;
};

/**
 * Validates one step's submission into a patch for the draft.
 *
 * The acknowledgement step stores a timestamp rather than a boolean: a column
 * saying "yes" is not evidence, and "yes, at 21:04 on the 22nd" is.
 */
export const submitStep = (step: Step, formData: FormData): StepSubmission => {
  const values = Object.fromEntries(formData);

  if (step === "health") {
    const result = healthSchema.safeParse(values);

    return result.success
      ? { ok: true, patch: result.data }
      : { ok: false, errors: errorsFrom(result.error) };
  }

  if (step === "acknowledge") {
    const result = acknowledgeSchema.safeParse(values);

    return result.success
      ? { ok: true, patch: { acknowledgedHealthAt: new Date().toISOString() } }
      : { ok: false, errors: errorsFrom(result.error) };
  }

  if (step === "measurements") {
    const result = measurementsSchema.safeParse(values);

    return result.success
      ? { ok: true, patch: result.data }
      : { ok: false, errors: errorsFrom(result.error) };
  }

  if (step === "goal") {
    const result = goalSchema.safeParse(values);

    /**
     * Changing the goal clears the frequency. The options are per-goal, so a
     * member who backs up from "3× fyrir fitutap" and picks muscle gain must
     * not silently keep a frequency that has no plan behind it.
     */
    return result.success
      ? { ok: true, patch: { goal: result.data.goal, sessionsPerWeek: undefined } }
      : { ok: false, errors: errorsFrom(result.error) };
  }

  const result = frequencySchema.safeParse(values);

  return result.success
    ? { ok: true, patch: result.data }
    : { ok: false, errors: errorsFrom(result.error) };
};

/**
 * Where the member belongs right now.
 *
 * Called by the loader so that a bookmarked or hand-edited `?step=` cannot land
 * someone on the goal step with no measurements behind it — the completion
 * handler would reject the draft, and it would do it three clicks later.
 */
export const firstIncompleteStep = (draft: OnboardingDraft): Step => {
  if (draft.confirmedAdult !== true) {
    return "health";
  }

  if (needsAcknowledgement(draft) && draft.acknowledgedHealthAt === undefined) {
    return "acknowledge";
  }

  if (
    draft.weightKg === undefined ||
    draft.heightCm === undefined ||
    draft.age === undefined ||
    draft.sex === undefined ||
    draft.activityLevel === undefined
  ) {
    return "measurements";
  }

  if (draft.goal === undefined) {
    return "goal";
  }

  return "frequency";
};
