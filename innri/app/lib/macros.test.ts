import { describe, expect, it } from "vitest";

import { formatWholeNumber } from "~/lib/format";
import {
  caloriesFromMacros,
  computeMacros,
  FORMULA,
  KCAL_PER_GRAM,
  type MacroInput,
} from "~/lib/macros";
import { ACTIVITY_VALUES, GOAL_VALUES, LIMITS, SEX_VALUES } from "~/lib/onboarding";

/**
 * These are the tests that matter most in the repo.
 *
 * Not because the arithmetic is hard, but because this is the one module whose
 * output a member acts on with their body. The properties below hold for every
 * input the questionnaire can produce — which is the only claim worth making
 * about a safety floor. A handful of example rows would prove nothing about the
 * combination that happens to break it.
 */

/**
 * Every input the wizard can submit. `LIMITS` bounds the three numbers and the
 * enums bound the rest, so this is the complete space rather than a sample —
 * stepping by 2 to keep it inside a second while still hitting both ends and
 * every parity.
 */
function* everyInput(): Generator<MacroInput> {
  for (let weightKg = LIMITS.weightKg.min; weightKg <= LIMITS.weightKg.max; weightKg += 2) {
    for (let heightCm = LIMITS.heightCm.min; heightCm <= LIMITS.heightCm.max; heightCm += 2) {
      for (let age = LIMITS.age.min; age <= LIMITS.age.max; age += 2) {
        for (const sex of SEX_VALUES) {
          for (const activityLevel of ACTIVITY_VALUES) {
            for (const goal of GOAL_VALUES) {
              yield { weightKg, heightCm, age, sex, activityLevel, goal };
            }
          }
        }
      }
    }
  }
}

const describeInput = (input: MacroInput) =>
  `${input.weightKg}kg ${input.heightCm}cm ${input.age}y ${input.sex} ${input.activityLevel} ${input.goal}`;

describe("the calorie floor", () => {
  it("is never breached, by any combination of answers", () => {
    for (const input of everyInput()) {
      const { kcal } = computeMacros(input);

      if (kcal < FORMULA.kcalFloor) {
        throw new Error(`${describeInput(input)} produced ${kcal} kcal, below the floor`);
      }
    }
  });

  it("binds for the smallest member the wizard accepts", () => {
    const smallest = computeMacros({
      weightKg: LIMITS.weightKg.min,
      heightCm: LIMITS.heightCm.min,
      age: LIMITS.age.max,
      sex: "kona",
      activityLevel: "kyrrseta",
      goal: "fitutap",
    });

    expect(smallest.kcal).toBe(FORMULA.kcalFloor);
  });
});

describe("the macro split", () => {
  it("gives every member a positive amount of all three", () => {
    for (const input of everyInput()) {
      const targets = computeMacros(input);

      if (targets.proteinG <= 0 || targets.carbsG <= 0 || targets.fatG <= 0) {
        throw new Error(`${describeInput(input)} produced ${JSON.stringify(targets)}`);
      }
    }
  });

  /**
   * The three rows on /dashboard/macros must add up to the total above them.
   * Two kcal is the most the three independent roundings can drift.
   */
  it("reconciles to the stored total", () => {
    for (const input of everyInput()) {
      const targets = computeMacros(input);

      const drift = Math.abs(caloriesFromMacros(targets) - targets.kcal);

      if (drift > 2) {
        throw new Error(`${describeInput(input)} drifted ${drift} kcal from its total`);
      }
    }
  });

  it("caps protein rather than producing an impossible plan", () => {
    for (const input of everyInput()) {
      const targets = computeMacros(input);

      const share = (targets.proteinG * KCAL_PER_GRAM.protein) / targets.kcal;

      if (share > FORMULA.proteinMaxShare + 0.01) {
        throw new Error(`${describeInput(input)} put ${share} of the day into protein`);
      }
    }
  });

  it("caps the heaviest member, who cannot eat 1,8 g/kg on the floor", () => {
    const heaviest = computeMacros({
      weightKg: LIMITS.weightKg.max,
      heightCm: LIMITS.heightCm.min,
      age: LIMITS.age.max,
      sex: "kona",
      activityLevel: "kyrrseta",
      goal: "fitutap",
    });

    expect(heaviest.proteinG).toBeLessThan(FORMULA.proteinPerKg * LIMITS.weightKg.max);
    expect(heaviest.carbsG).toBeGreaterThan(0);
  });
});

describe("the answers that change the number", () => {
  const dad: MacroInput = {
    weightKg: 94,
    heightCm: 182,
    age: 41,
    sex: "karl",
    activityLevel: "kyrrseta",
    goal: "fitutap",
  };

  /**
   * Worked by hand from Mifflin-St Jeor so a future change to the formula has
   * to be deliberate: 10×94 + 6,25×182 − 5×41 + 5 = 1877,5 resting;
   * ×1,2 = 2253 daily; ×0,8 = 1802 with the deficit.
   */
  it("matches the formula worked by hand", () => {
    expect(computeMacros(dad)).toStrictEqual({
      kcal: 1802,
      proteinG: 169,
      carbsG: 169,
      fatG: 50,
      formulaVersion: FORMULA.version,
    });
  });

  it("gives the muscle-gain goal more than the fat-loss goal", () => {
    const gaining = computeMacros({ ...dad, goal: "vodvauppbygging" });

    expect(gaining.kcal).toBeGreaterThan(computeMacros(dad).kcal);
  });

  it("places annad between the two constants it is drawn from", () => {
    const male = computeMacros({ ...dad, sex: "karl" }).kcal;

    const female = computeMacros({ ...dad, sex: "kona" }).kcal;

    const neither = computeMacros({ ...dad, sex: "annad" }).kcal;

    expect(neither).toBeLessThan(male);
    expect(neither).toBeGreaterThan(female);
  });

  it("stamps the formula version onto every result", () => {
    expect(computeMacros(dad).formulaVersion).toBe(FORMULA.version);
  });
});

describe("Icelandic number formatting", () => {
  it("groups thousands with a period, as Icelandic does", () => {
    expect(formatWholeNumber(1812)).toBe("1.812");
    expect(formatWholeNumber(171)).toBe("171");
    expect(formatWholeNumber(12345)).toBe("12.345");
  });

  /**
   * The reason this function exists rather than `toLocaleString("is-IS")`:
   * browsers without `is-IS` in their ICU data fall back silently, and the
   * result has to be identical on the server and in every browser or React
   * throws a hydration mismatch over it.
   */
  it("is independent of whatever locale data the runtime happens to ship", () => {
    for (const value of [0, 1, 999, 1000, 100000, 1000000]) {
      expect(formatWholeNumber(value)).toBe(
        value.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, "."),
      );
    }
  });
});
