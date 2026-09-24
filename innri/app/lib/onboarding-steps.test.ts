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
  equipment: "raektarstod",
  experience: "byrjandi",
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

  it("keeps what the member wrote about their limitations, trimmed", () => {
    const result = submitStep(
      "health",
      form({ confirmedAdult: "on", limitations: "  Slæmt vinstra hné  " }),
    );

    expect(result.ok && result.patch.limitations).toBe("Slæmt vinstra hné");
  });

  /**
   * A blank textarea is no answer, not an empty one Aron has to read past. The
   * key must still be in the patch, so clearing an earlier answer erases it.
   */
  it("stores a blank limitations box as no answer, overwriting an earlier one", () => {
    const result = submitStep("health", form({ confirmedAdult: "on", limitations: "   " }));

    expect(result.ok && "limitations" in result.patch).toBe(true);
    expect(result.ok && result.patch.limitations).toBeUndefined();
  });

  it("refuses limitations longer than the box allows", () => {
    const result = submitStep(
      "health",
      form({ confirmedAdult: "on", limitations: "a".repeat(501) }),
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.limitations).toBe("Hámark 500 stafir");
    }
  });
});

describe("the training step", () => {
  it("needs both equipment and experience, and says which is missing", () => {
    const result = submitStep("training", form({ equipment: "heima" }));

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors.experience).toBe("Veldu hversu mikla reynslu þú hefur");
      expect(result.errors.equipment).toBeUndefined();
    }
  });

  it("rejects equipment that is not one of the three", () => {
    expect(submitStep("training", form({ equipment: "sundlaug", experience: "vanur" })).ok).toBe(
      false,
    );
  });

  /** Frequencies are offered per equipment, so the old one may lead nowhere. */
  it("clears the frequency chosen for the previous equipment", () => {
    const result = submitStep("training", form({ equipment: "heima", experience: "vanur" }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.patch).toStrictEqual({
        equipment: "heima",
        experience: "vanur",
        sessionsPerWeek: undefined,
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
   * Equipment and frequency options are per-goal. Keeping either across a goal
   * change is how a member ends up assigned a plan that does not exist.
   */
  it("clears the equipment and frequency chosen for the previous goal", () => {
    const result = submitStep("goal", form({ goal: "vodvauppbygging" }));

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.patch).toStrictEqual({
        goal: "vodvauppbygging",
        equipment: undefined,
        sessionsPerWeek: undefined,
      });
    }
  });
});

describe("where an unfinished member belongs", () => {
  const planChosen: OnboardingDraft = {
    goal: "fitutap",
    equipment: "raektarstod",
    experience: "byrjandi",
    sessionsPerWeek: 3,
  };

  it("starts at the goal with an empty draft", () => {
    expect(firstIncompleteStep({})).toBe("goal");
  });

  it("asks about training once the goal is set", () => {
    expect(firstIncompleteStep({ goal: "fitutap" })).toBe("training");
  });

  it("stays on training until both equipment and experience are answered", () => {
    expect(firstIncompleteStep({ goal: "fitutap", equipment: "heima" })).toBe("training");
  });

  it("asks for the frequency before any health question", () => {
    const { sessionsPerWeek: _dropped, ...withoutFrequency } = planChosen;

    expect(firstIncompleteStep(withoutFrequency)).toBe("frequency");
  });

  it("reaches the health screen once the plan is chosen", () => {
    expect(firstIncompleteStep(planChosen)).toBe("health");
  });

  it("stops at the acknowledgement when a flag was checked", () => {
    expect(firstIncompleteStep({ ...planChosen, confirmedAdult: true, eatingDisorder: true })).toBe(
      "acknowledge",
    );
  });

  it("passes the acknowledgement once it carries a timestamp", () => {
    expect(
      firstIncompleteStep({
        ...planChosen,
        confirmedAdult: true,
        eatingDisorder: true,
        acknowledgedHealthAt: new Date().toISOString(),
      }),
    ).toBe("measurements");
  });

  it("never asks for an acknowledgement nobody triggered", () => {
    expect(firstIncompleteStep({ ...planChosen, confirmedAdult: true })).toBe("measurements");
  });

  /** Measurements are the whole second part, so they come last. */
  it("ends on measurements, with everything before them answered", () => {
    expect(firstIncompleteStep({ ...answered, sessionsPerWeek: 3 })).toBe("measurements");
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
