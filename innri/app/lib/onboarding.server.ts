import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/db";
import { macroTargets, onboarding, planAssignments } from "~/db/schema";
import { computeMacros } from "~/lib/macros";
import { ACTIVITY_VALUES, GOAL_VALUES, SEX_VALUES } from "~/lib/onboarding";
import type { OnboardingDraft } from "~/lib/onboarding-draft.server";
import { planByGoalAndFrequencyQuery, sanity } from "~/lib/sanity.server";

/**
 * Everything the onboarding wizard writes, and everything the dashboard reads
 * back out of it.
 *
 * The validation and the draft cookie live next door in
 * `onboarding-draft.server.ts`, which holds no database import on purpose.
 */

const completeDraftSchema = z.object({
  confirmedAdult: z.literal(true),
  chronicCondition: z.boolean(),
  medication: z.boolean(),
  eatingDisorder: z.boolean(),
  injury: z.boolean(),
  acknowledgedHealthAt: z.string().optional(),
  weightKg: z.number().int(),
  heightCm: z.number().int(),
  age: z.number().int(),
  sex: z.enum(SEX_VALUES),
  activityLevel: z.enum(ACTIVITY_VALUES),
  goal: z.enum(GOAL_VALUES),
  sessionsPerWeek: z.number().int(),
});

export type CompletionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "incomplete" | "no-plan" };

/**
 * Writes the three rows that make a member a member, in one transaction.
 *
 * All three or none. A macro target without the answers it came from is
 * unexplainable, and a member with answers but no plan assignment lands on an
 * empty dashboard having just told us their weight — the worst possible first
 * screen.
 *
 * The Sanity lookup happens before the transaction opens. A network call inside
 * a transaction holds a Postgres connection open for the length of someone
 * else's outage, and this database is capped at one connection per instance.
 */
export const completeOnboarding = async (
  userId: string,
  draft: OnboardingDraft,
): Promise<CompletionResult> => {
  const parsed = completeDraftSchema.safeParse(draft);

  if (!parsed.success) {
    return { ok: false, reason: "incomplete" };
  }

  const answers = parsed.data;

  const plan = await sanity.fetch(planByGoalAndFrequencyQuery, {
    goal: answers.goal,
    sessionsPerWeek: answers.sessionsPerWeek,
  });

  /**
   * The wizard only offers frequencies that have a published plan, so reaching
   * this means Aron unpublished one between the member loading the step and
   * submitting it. Rare, and still not something to write half a member for.
   */
  if (!plan) {
    return { ok: false, reason: "no-plan" };
  }

  const macros = computeMacros({
    weightKg: answers.weightKg,
    heightCm: answers.heightCm,
    age: answers.age,
    sex: answers.sex,
    activityLevel: answers.activityLevel,
    goal: answers.goal,
  });

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(onboarding)
      .values({
        userId,
        goal: answers.goal,
        sessionsPerWeek: answers.sessionsPerWeek,
        weightKg: answers.weightKg,
        heightCm: answers.heightCm,
        age: answers.age,
        sex: answers.sex,
        activityLevel: answers.activityLevel,
        flaggedChronicCondition: answers.chronicCondition,
        flaggedMedication: answers.medication,
        flaggedEatingDisorder: answers.eatingDisorder,
        flaggedInjury: answers.injury,
        confirmedAdult: answers.confirmedAdult,
        acknowledgedHealthAt:
          answers.acknowledgedHealthAt === undefined
            ? null
            : new Date(answers.acknowledgedHealthAt),
      })
      .returning({ id: onboarding.id });

    const row = inserted[0];

    if (!row) {
      throw new Error("Onboarding insert returned no row.");
    }

    await tx.insert(macroTargets).values({
      userId,
      onboardingId: row.id,
      kcal: macros.kcal,
      proteinG: macros.proteinG,
      carbsG: macros.carbsG,
      fatG: macros.fatG,
      formulaVersion: macros.formulaVersion,
    });

    await tx.insert(planAssignments).values({ userId, sanityPlanId: plan._id });
  });

  return { ok: true };
};

/* ── Reading what was written ─────────────────────────────────────────────── */

/** The answers in force. Append-only table, so the newest row is current. */
export const latestOnboarding = async (userId: string) =>
  db.query.onboarding.findFirst({
    where: eq(onboarding.userId, userId),
    orderBy: [desc(onboarding.completedAt)],
  });

export const latestMacros = async (userId: string) =>
  db.query.macroTargets.findFirst({
    where: eq(macroTargets.userId, userId),
    orderBy: [desc(macroTargets.computedAt)],
  });

export const latestPlanAssignment = async (userId: string) =>
  db.query.planAssignments.findFirst({
    where: eq(planAssignments.userId, userId),
    orderBy: [desc(planAssignments.assignedAt)],
  });

/**
 * Whether this member has been through the wizard.
 *
 * Reads the plan assignment rather than the onboarding row: it is written last
 * in the transaction, so it is the one that means "there is something to show
 * them". The redirect chain hangs off this.
 */
export const hasCompletedOnboarding = async (userId: string): Promise<boolean> =>
  (await latestPlanAssignment(userId)) !== undefined;
