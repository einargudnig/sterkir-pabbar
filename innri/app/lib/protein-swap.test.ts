import { describe, expect, it } from "vitest";

import { proteinSwap } from "./protein-swap";

const chicken = {
  originalGrams: 120,
  originalProteinPer100g: 31,
  originalState: "cooked",
} as const;

describe("proteinSwap", () => {
  it("matches the protein of the original portion", () => {
    const result = proteinSwap({
      ...chicken,
      replacementProteinPer100g: 26,
      replacementState: "cooked",
    });

    expect(result).toEqual({ ok: true, grams: 143, proteinGrams: 37.2 });
  });

  it("refuses to compare cooked with raw rather than return a precise wrong number", () => {
    const result = proteinSwap({
      ...chicken,
      replacementProteinPer100g: 20,
      replacementState: "raw",
    });

    expect(result).toEqual({ ok: false, reason: "state-mismatch" });
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses a replacement protein value of %s instead of dividing by it",
    (value) => {
      const result = proteinSwap({
        ...chicken,
        replacementProteinPer100g: value,
        replacementState: "cooked",
      });

      expect(result).toEqual({ ok: false, reason: "invalid-number" });
    },
  );
});
