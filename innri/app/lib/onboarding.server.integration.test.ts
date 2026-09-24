import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createMember, resetDatabase } from "../../test/db";
import { startFakeSanity } from "../../test/fake-sanity";
import { db } from "~/db";
import { macroTargets, onboarding, planAssignments } from "~/db/schema";
import { computeMacros } from "~/lib/macros";
import type { OnboardingDraft } from "~/lib/onboarding-draft.server";

import {
  completeOnboarding,
  hasCompletedOnboarding,
  latestMacros,
  latestOnboarding,
  latestPlanAssignment,
} from "./onboarding.server";

/**
 * Risk item 5 in docs/solutions/inner-circle.md: plan assignment, including
 * when no published plan exists for the chosen frequency.
 */

const complete: OnboardingDraft = {
  confirmedAdult: true,
  chronicCondition: false,
  medication: false,
  eatingDisorder: false,
  injury: false,
  weightKg: 92,
  heightCm: 181,
  age: 41,
  sex: "karl",
  activityLevel: "lett",
  goal: "fitutap",
  sessionsPerWeek: 3,
};

const plan = (id: string) => ({
  _id: id,
  title: "Fitutap, 3 sinnum",
  goal: "fitutap",
  sessionsPerWeek: 3,
});

const rowsFor = async (userId: string) => {
  const total = async (table: typeof onboarding | typeof macroTargets | typeof planAssignments) => {
    const [row] = await db.select({ n: count() }).from(table).where(eq(table.userId, userId));

    return row?.n ?? 0;
  };

  return {
    onboarding: await total(onboarding),
    macroTargets: await total(macroTargets),
    planAssignments: await total(planAssignments),
  };
};

let sanity: Awaited<ReturnType<typeof startFakeSanity>>;

beforeAll(async () => {
  sanity = await startFakeSanity();
});

afterAll(async () => {
  await sanity.close();
});

beforeEach(async () => {
  await resetDatabase();

  sanity.queries.length = 0;
  sanity.respondWith(plan("plan-fitutap-3"));
});

describe("completeOnboarding", () => {
  it("looks up the plan by the goal and frequency the member chose", async () => {
    const member = await createMember();

    await completeOnboarding(member.id, {
      ...complete,
      goal: "vodvauppbygging",
      sessionsPerWeek: 4,
    });

    const [query] = sanity.queries;

    expect(sanity.queries).toHaveLength(1);
    expect(query?.params.get("goal")).toBe('"vodvauppbygging"');
    expect(query?.params.get("sessionsPerWeek")).toBe("4");
  });

  it("writes the answers, the macros computed from them, and the plan, linked together", async () => {
    const member = await createMember();

    expect(await completeOnboarding(member.id, complete)).toEqual({ ok: true });

    const answers = await latestOnboarding(member.id);
    const macros = await latestMacros(member.id);
    const assignment = await latestPlanAssignment(member.id);

    expect(answers).toMatchObject({ weightKg: 92, goal: "fitutap", sessionsPerWeek: 3 });
    expect(macros?.onboardingId).toBe(answers?.id);
    expect(macros).toMatchObject(
      computeMacros({
        weightKg: 92,
        heightCm: 181,
        age: 41,
        sex: "karl",
        activityLevel: "lett",
        goal: "fitutap",
      }),
    );
    expect(assignment?.sanityPlanId).toBe("plan-fitutap-3");
    expect(await hasCompletedOnboarding(member.id)).toBe(true);
  });

  it("writes nothing when no published plan matches, and the member is not onboarded", async () => {
    const member = await createMember();

    sanity.respondWith(null);

    expect(await completeOnboarding(member.id, complete)).toEqual({ ok: false, reason: "no-plan" });
    expect(await rowsFor(member.id)).toEqual({
      onboarding: 0,
      macroTargets: 0,
      planAssignments: 0,
    });
    expect(await hasCompletedOnboarding(member.id)).toBe(false);
  });

  it("refuses a draft that skipped the age confirmation, without asking Sanity", async () => {
    const member = await createMember();

    const result = await completeOnboarding(member.id, { ...complete, confirmedAdult: false });

    expect(result).toEqual({ ok: false, reason: "incomplete" });
    expect(sanity.queries).toEqual([]);
    expect(await rowsFor(member.id)).toEqual({
      onboarding: 0,
      macroTargets: 0,
      planAssignments: 0,
    });
  });

  it("refuses a draft missing a measurement", async () => {
    const member = await createMember();
    const { weightKg: _, ...withoutWeight } = complete;

    expect(await completeOnboarding(member.id, withoutWeight)).toEqual({
      ok: false,
      reason: "incomplete",
    });
  });

  it("writes nothing when Sanity is down", async () => {
    const member = await createMember();

    sanity.failWith(503);

    await expect(completeOnboarding(member.id, complete)).rejects.toThrow();
    expect(await rowsFor(member.id)).toEqual({
      onboarding: 0,
      macroTargets: 0,
      planAssignments: 0,
    });
  });

  it("writes none of the three rows if the last one fails", async () => {
    const member = await createMember();

    sanity.respondWith({ ...plan("unused"), _id: null });

    await expect(completeOnboarding(member.id, complete)).rejects.toThrow();
    expect(await rowsFor(member.id)).toEqual({
      onboarding: 0,
      macroTargets: 0,
      planAssignments: 0,
    });
  });

  it("records when the health warning was acknowledged, and every flag", async () => {
    const member = await createMember();
    const acknowledgedAt = "2026-09-20T10:15:00.000Z";

    await completeOnboarding(member.id, {
      ...complete,
      medication: true,
      injury: true,
      acknowledgedHealthAt: acknowledgedAt,
    });

    expect(await latestOnboarding(member.id)).toMatchObject({
      flaggedMedication: true,
      flaggedInjury: true,
      flaggedChronicCondition: false,
      flaggedEatingDisorder: false,
      acknowledgedHealthAt: new Date(acknowledgedAt),
    });
  });

  it("keeps the old answers and plan when a member onboards again, and reads the new ones", async () => {
    const member = await createMember();

    await completeOnboarding(member.id, complete);

    sanity.respondWith(plan("plan-vodvar-4"));

    await completeOnboarding(member.id, {
      ...complete,
      weightKg: 85,
      goal: "vodvauppbygging",
      sessionsPerWeek: 4,
    });

    expect(await rowsFor(member.id)).toEqual({
      onboarding: 2,
      macroTargets: 2,
      planAssignments: 2,
    });
    expect((await latestOnboarding(member.id))?.weightKg).toBe(85);
    expect((await latestPlanAssignment(member.id))?.sanityPlanId).toBe("plan-vodvar-4");
    expect((await latestMacros(member.id))?.onboardingId).toBe(
      (await latestOnboarding(member.id))?.id,
    );
  });

  it("keeps one member's plan out of another's dashboard", async () => {
    const first = await createMember();
    const second = await createMember();

    await completeOnboarding(first.id, complete);

    expect(await hasCompletedOnboarding(second.id)).toBe(false);
    expect(await latestMacros(second.id)).toBeUndefined();
  });
});
