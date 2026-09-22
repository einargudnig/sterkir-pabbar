import { describe, expect, it } from "vitest";

import { stepsFor } from "~/lib/onboarding";
import {
  firstIncompleteStep,
  healthFlagsFromDraft,
  needsAcknowledgement,
  type OnboardingDraft,
  submitStep,
} from "~/lib/onboarding-draft.server";

/**
 * The wizard's state machine, tested without a browser.
 *
 * Not component tests — `docs/solutions/inner-circle.md` rejects those. What is
 * worth testing here is the part that decides what a member is allowed to
 * submit and where they go next, because getting it wrong either loses their
 * answers or lets them past the age gate.
 */

const form = (entries: Readonly<Record<string, string>>): FormData => {
  const data = new FormData();

  for (const [key, value] of Object.entries(entries)) {
    data.append(key, value);
  }

  return data;
};

const answered: OnboardingDraft = {
  confirmedAdult: true,
  chronicCondition: false,
  medication: false,
  eatingDisorder: false,
  injury: false,
  weightKg: 94,
  heightCm: 182,
  age: 41,
  sex: "karl",
  activityLevel: "kyrrseta",
  goal: "fitutap",
};

describe("the health step", () => {
  it("refuses to continue without the age confirmation", () => {
    const result = submitStep("health", form({}));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.confirmedAdult).toBe("Þjónustan er fyrir 18 ára og eldri");
    }
  });

  it("records an unchecked flag as false rather than leaving it unset", () => {
    const result = submitStep("health", form({ confirmedAdult: "on", injury: "on" }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.patch).toStrictEqual({
        confirmedAdult: true,
        chronicCondition: false,
        medication: false,
        eatingDisorder: false,
        injury: true,
      });
    }
  });
});

describe("the acknowledgement", () => {
  it("is asked for when any flag is checked, and only then", () => {
    expect(needsAcknowledgement({ ...answered, medication: true })).toBe(true);
    expect(needsAcknowledgement(answered)).toBe(false);

    expect(stepsFor(true)).toContain("acknowledge");
    expect(stepsFor(false)).not.toContain("acknowledge");
  });

  it("stores when it was accepted, not merely that it was", () => {
    const result = submitStep("acknowledge", form({ acknowledged: "on" }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(Date.parse(result.patch.acknowledgedHealthAt ?? "")).toBeGreaterThan(0);
    }
  });

  it("cannot be skipped by posting the step with nothing in it", () => {
    expect(submitStep("acknowledge", form({})).ok).toBe(false);
  });
});

describe("the measurements step", () => {
  const valid = {
    weightKg: "94",
    heightCm: "182",
    age: "41",
    sex: "karl",
    activityLevel: "kyrrseta",
  };

  it("accepts the Icelandic decimal comma a bathroom scale shows", () => {
    const result = submitStep("measurements", form({ ...valid, weightKg: "94,5" }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.patch.weightKg).toBe(95);
    }
  });

  it("names the field that is empty", () => {
    const result = submitStep("measurements", form({ ...valid, heightCm: "" }));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.heightCm).toBe("Sláðu inn hæð");
    }
  });

  it("rejects an age the product is not for", () => {
    const result = submitStep("measurements", form({ ...valid, age: "16" }));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.age).toContain("18");
    }
  });

  it("rejects a weight outside what a person can be", () => {
    expect(submitStep("measurements", form({ ...valid, weightKg: "900" })).ok).toBe(false);
  });

  it("rejects a value that is not a number at all", () => {
    const result = submitStep("measurements", form({ ...valid, weightKg: "níutíu" }));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.weightKg).toBe("Þyngd verður að vera tala");
    }
  });

  it("rejects an activity level that is not one of the four", () => {
    expect(submitStep("measurements", form({ ...valid, activityLevel: "ofurmenni" })).ok).toBe(
      false,
    );
  });
});

describe("changing the goal", () => {
  /**
   * The frequency options are per-goal. Keeping a frequency across a goal
   * change is how a member ends up assigned a plan that does not exist.
   */
  it("clears the frequency chosen for the previous goal", () => {
    const result = submitStep("goal", form({ goal: "vodvauppbygging" }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.patch).toStrictEqual({
        goal: "vodvauppbygging",
        sessionsPerWeek: undefined,
      });
    }
  });
});

describe("where an unfinished member belongs", () => {
  it("starts at the health screen with an empty draft", () => {
    expect(firstIncompleteStep({})).toBe("health");
  });

  it("stops at the acknowledgement when a flag was checked", () => {
    expect(firstIncompleteStep({ confirmedAdult: true, eatingDisorder: true })).toBe("acknowledge");
  });

  it("passes the acknowledgement once it carries a timestamp", () => {
    expect(
      firstIncompleteStep({
        confirmedAdult: true,
        eatingDisorder: true,
        acknowledgedHealthAt: new Date().toISOString(),
      }),
    ).toBe("measurements");
  });

  it("never asks for an acknowledgement nobody triggered", () => {
    expect(firstIncompleteStep({ confirmedAdult: true })).toBe("measurements");
  });

  it("stops at measurements when one of the five is missing", () => {
    const { sex: _dropped, ...withoutSex } = answered;

    expect(firstIncompleteStep(withoutSex)).toBe("measurements");
  });

  it("reaches the frequency step only with everything before it answered", () => {
    expect(firstIncompleteStep(answered)).toBe("frequency");
  });
});

describe("the health flags handed to the database", () => {
  it("defaults every unanswered flag to false, never null", () => {
    expect(healthFlagsFromDraft({})).toStrictEqual({
      chronicCondition: false,
      medication: false,
      eatingDisorder: false,
      injury: false,
    });
  });
});
