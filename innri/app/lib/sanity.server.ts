import { createClient } from "@sanity/client";
import { defineQuery } from "groq";

/**
 * Sanity read client. Server-only — the token must never reach the browser,
 * which is why this file is `.server.ts` and every caller is a loader.
 *
 * `perspective: "published"` is load-bearing. With a token, Sanity can return
 * drafts, so without it a member would see Aron's half-written plan the moment
 * he started typing. Members see published documents or nothing.
 */
const projectId = process.env.SANITY_PROJECT_ID;

const dataset = process.env.SANITY_DATASET ?? "production";

const token = process.env.SANITY_READ_TOKEN;

if (!projectId) {
  throw new Error("SANITY_PROJECT_ID is not set.");
}

/**
 * Required rather than optional even though the dataset is currently public.
 * A missing token against a private dataset does not error — it returns empty
 * results, so the members' area would render "engar greinar" with nothing in
 * the logs. Failing at boot is the louder, cheaper failure.
 */
if (!token) {
  throw new Error("SANITY_READ_TOKEN is not set.");
}

export const sanity = createClient({
  projectId,
  dataset,
  apiVersion: "2024-10-01",
  useCdn: true,
  perspective: "published",
  token,
});

/**
 * A member's plan, found by the two answers they gave in onboarding.
 *
 * `studio/schemas/validators.ts` enforces that this pair matches at most one
 * published plan, so taking [0] is safe rather than arbitrary.
 */
export const planByGoalAndFrequencyQuery = defineQuery(`
  *[_type == "trainingPlan" && goal == $goal && sessionsPerWeek == $sessionsPerWeek][0]{
    _id,
    title,
    goal,
    sessionsPerWeek,
    intro,
    sessions[]{
      _key,
      title,
      exercises[]{
        _key,
        sets,
        reps,
        note,
        "exercise": exercise->{ _id, name, cue, videoUrl, muscleGroup }
      }
    }
  }
`);

/**
 * Which frequencies a member may choose, for a given goal.
 *
 * The onboarding wizard renders only these, so Aron controls launch scope by
 * publishing: an option never appears without a plan behind it.
 */
export const availableFrequenciesQuery = defineQuery(`
  array::unique(*[_type == "trainingPlan" && goal == $goal].sessionsPerWeek) | order(@ asc)
`);

export const articlesQuery = defineQuery(`
  *[_type == "article"] | order(title asc){
    _id,
    title,
    "slug": slug.current,
    category,
    excerpt
  }
`);

export const articleBySlugQuery = defineQuery(`
  *[_type == "article" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    category,
    excerpt,
    body
  }
`);
