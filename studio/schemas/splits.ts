/**
 * The split a plan follows, by days a week. Mirrors `SPLITS` in
 * `innri/app/lib/onboarding.ts`, which shows the same names to members — the
 * two packages share no code, so change both together.
 *
 * Five days is not defined yet, so there is no template for it; a 5-day plan
 * can still be made from the plain "Æfingaplan" button.
 */
export const SPLIT_DAYS = {
  1: ["Allur líkaminn"],
  2: ["Efri hluti", "Neðri hluti"],
  3: ["Ýta", "Toga", "Fætur"],
  4: ["Efri hluti A", "Neðri hluti A", "Efri hluti B", "Neðri hluti B"],
} as const;

const SPLIT_NAMES = {
  1: "allur líkaminn",
  2: "efri/neðri",
  3: "ýta/toga/fætur",
  4: "efri/neðri tvisvar",
} as const;

/**
 * One "Nýtt plan" template per split: the frequency set and the days already
 * named, so Aron only picks the goal and fills in the exercises. The empty
 * exercise lists fail validation until filled, so a skeleton cannot be
 * published by accident.
 */
export const planTemplates = Object.entries(SPLIT_DAYS).map(([count, days]) => ({
  id: `trainingPlan-${count}`,
  title: `Æfingaplan — ${count} ${count === "1" ? "dagur" : "dagar"} (${SPLIT_NAMES[Number(count) as keyof typeof SPLIT_NAMES]})`,
  schemaType: "trainingPlan",
  value: {
    sessionsPerWeek: Number(count),
    sessions: days.map((title, index) => ({
      _type: "session",
      _key: `dagur-${index + 1}`,
      title,
      exercises: [],
    })),
  },
}));
