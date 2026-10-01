/**
 * How much of one food gives the same protein as a portion of another.
 *
 * The assistant calls this instead of doing the sum itself: a language model
 * asked for 120 g × 31 ÷ 26 will usually be close and occasionally confidently
 * wrong, and a member weighing food deserves the exact number.
 *
 * Both foods have to be in the same state. Cooked chicken and raw beef differ by
 * the water lost in cooking, so mixing them answers a different question with
 * a precise-looking number. The caller gets a refusal to relay, not a guess.
 */
export type FoodState = "cooked" | "raw";

export type ProteinSwapInput = {
  readonly originalGrams: number;
  readonly originalProteinPer100g: number;
  readonly originalState: FoodState;
  readonly replacementProteinPer100g: number;
  readonly replacementState: FoodState;
};

export type ProteinSwapResult =
  | { readonly ok: true; readonly grams: number; readonly proteinGrams: number }
  | { readonly ok: false; readonly reason: "state-mismatch" | "invalid-number" };

const positive = (value: number) => Number.isFinite(value) && value > 0;

export const proteinSwap = (input: ProteinSwapInput): ProteinSwapResult => {
  if (input.originalState !== input.replacementState) {
    return { ok: false, reason: "state-mismatch" };
  }

  if (
    !positive(input.originalGrams) ||
    !positive(input.originalProteinPer100g) ||
    !positive(input.replacementProteinPer100g)
  ) {
    return { ok: false, reason: "invalid-number" };
  }

  const proteinGrams = (input.originalGrams * input.originalProteinPer100g) / 100;

  /** Whole grams: nobody's kitchen scale shows tenths, and 0.4 g of meat is noise. */
  return {
    ok: true,
    grams: Math.round((proteinGrams * 100) / input.replacementProteinPer100g),
    proteinGrams: Math.round(proteinGrams * 10) / 10,
  };
};
