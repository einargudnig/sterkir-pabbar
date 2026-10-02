# Innri hringurinn — paid members' area

**Status:** v1 live since 2026-10-02 · **Owner:** Einar · **Client:** Aron

A paid members' area at `app.sterkirpabbar.is`. A new member answers a health-screened
questionnaire, gets stored macro targets and a pre-built training plan matched to their goal and
number of days, and is invoiced by Aron. Once the claim is paid they get their plan, their macros,
Aron's articles and an AI assistant.

This file is how the app works **now**. Why it works that way, including reversed decisions
(Repeat, the testing window, equipment), is in `docs/decisions.md`. Infrastructure is in
`docs/solutions/deployment.md`.

## Shape

```
sterkirpabbar.is        Astro, static, marketing          (src/)
app.sterkirpabbar.is    React Router v8 on Vercel          (innri/)
sterkirpabbar.sanity.studio   content for both             (studio/)
```

```
                 app.sterkirpabbar.is  (React Router v8, Vercel)
          ┌──────────┬──────────┴───────┬─────────────────┐
          ▼          ▼                  ▼                 ▼
        Clerk     Neon Postgres       Sanity        Vercel AI Gateway
     (identity)  (members, answers,  (plans,        (assistant, OpenAI
                  macros, claims,     exercises,     via BYOK key)
                  assistant usage)    articles, FAQ)
```

## Stack

| Layer      | Choice                                                          |
| ---------- | --------------------------------------------------------------- |
| App        | React Router v8 (framework mode), in `innri/`                   |
| Auth       | Clerk (`@clerk/react-router`), production instance              |
| Database   | Neon Postgres + Drizzle                                         |
| Content    | Sanity, queried server-side in loaders at request time          |
| Payments   | None. Aron sends a claim (krafa); access is granted on `/admin` |
| Assistant  | AI SDK `streamText` through the Vercel AI Gateway               |
| Components | shadcn/ui on Base UI, mapped onto the brand tokens              |
| Validation | Zod — env vars, form parsing, webhook and request bodies        |

## Routes

Paths and filenames are English; every word a member reads is Icelandic.

```
/                     redirect: signed out → /sign-in
                                questionnaire unfinished → /onboarding
                                no access → /articles, paid tabs locked
                                else → /dashboard
/sign-in, /sign-up    Clerk
/onboarding           the questionnaire; step in the URL
/waiting              retired, redirects to /
/dashboard            redirects to the first tab
/dashboard/workouts   Mínar æfingar, and /workouts/:session for one day
/dashboard/macros     Mín macros
/articles             Fróðleikur, and /articles/:slug
/settings             account, measurements, days per week, paid-until date
/admin                Aron: claims sent and paid, grants, rerun the questionnaire

/api/clerk/webhook    user created/deleted → users table (signature verified)
/api/assistant        the chat bubble's endpoint
```

## Gates

Four levels, defined in `innri/app/lib/auth.server.ts` and `gates.server.ts`. A route inherits the
guard of the layout it sits under.

| Level                  | Routes                                     | Enforced by                |
| ---------------------- | ------------------------------------------ | -------------------------- |
| public                 | `/sign-in`, `/sign-up`                     | —                          |
| signed in              | `/onboarding`                              | its own loader             |
| questionnaire finished | `/articles`, `/admin` (layouts/member)     | the member layout's loader |
| paid                   | `/dashboard/*`, `/settings` (layouts/paid) | the paid layout's loader   |

- Access is `isAdmin`, or `access_granted_until` in the future (`hasActiveAccess` in
  `app/lib/access.ts`), strictly greater-than at the boundary.
- The member layout lets admins through without a questionnaire; `/admin` adds `requireAdmin`
  and answers 404 to anyone else.
- A locked tab is cosmetic. The paid layout's redirect keeps the plan off the wire, and it beats
  the child loaders running in parallel with it.
- **Resource routes run no layout loader.** `/api/assistant` calls `requireActiveAccess` as its
  first line, and that call is the only thing guarding it.
- **Put a new route under the paid layout** unless an unpaid member should see it.

## Data model

`innri/app/db/schema.ts`, migrations in `innri/drizzle/`.

- `users` — `clerk_user_id`, `is_admin`, `access_granted_until`, and who to invoice: `name`,
  `kennitala` (checksum-verified, personal), `phone`, `ready_at` (the invoicing queue, set once).
- `onboarding` — append-only, one row per completed run: goal, sessions per week, measurements,
  experience, limitations, health flags, `confirmed_adult`, `acknowledged_health_at`.
- `macro_targets` — append-only snapshot: kcal, protein, carbs, fat, `formula_version`, and the
  onboarding row it came from.
- `plan_assignments` — append-only, the Sanity plan id. Plan content stays in Sanity.
- `claims` — one row per claim Aron sends: `days`, `sent_at`, `paid_at`. At most one open
  claim per member.
- `assistant_usage` — per assistant message: model, tokens, duration, outcome
  (`answered | failed | aborted`). Never the text.
- **DORMANT, never read:** the Repeat columns on `users` (`subscription_status`,
  `repeat_subscription_id`, `current_period_end`, `checkout_claimed_at`), the
  `subscription_status` enum and `repeat_events`. Don't drop them without a deliberate
  production migration.

Money is whole krónur. ISK has no minor unit, so don't copy the store-money-in-cents habit from
Stripe examples.

Activity multipliers: kyrrseta 1.2 · létt virkni 1.375 · miðlungs virkni 1.55 · mikil virkni 1.725.

## Sanity

`studio/schemas/`; `bun run types:sanity` regenerates `innri/app/lib/sanity.types.ts`.

- `exercise` — name, muscle group (folders in the Studio), cue (140 chars), video URL
- `trainingPlan` — goal, sessions per week, intro, sessions → exercise refs + sets, reps, note.
  One "Nýtt plan" template per split (`studio/schemas/splits.ts`, a copy of `SPLITS` in
  `innri/app/lib/onboarding.ts`; the packages share no code).
- `article` — Fróðleikur
- `faqEntry` — approved answers for the assistant. `reviewNote` never reaches the model.
- `siteContent` — the landing page

Validators guard silent breaks: **one published plan per goal + days** (the app queries one exact
pair), and **Vimeo or YouTube video URLs only**.

The app sets `perspective: "published"` explicitly. With a token Sanity can return drafts, and a
member would see Aron's half-written plan as he typed it.

## The assistant

`routes/api/assistant.ts` (HTTP, auth, limits) and `app/lib/assistant.server.ts` (prompt,
tools, usage). The bubble is `components/assistant-chat.tsx`, rendered in the paid layout.

- `ASSISTANT_ENABLED` is the kill switch; `ASSISTANT_MODEL` and `ASSISTANT_DAILY_LIMIT` (30)
  are in `env.server.ts`.
- **Evals:** `bun --env-file=.env.development.local run eval` in `innri/`, optionally
  `--only SP-032,SP-045`. They run Aron's cases plus off-topic cases
  (`evals/assistant/cases.json`) against the real model, prompt and tools, with a synthetic
  member and the FAQ _drafts_. A judge model grades pass/fail and flags critical failures.
  Not part of `bun run check`: it costs money and answers vary run to run. **Re-run after any
  prompt or FAQ change.**

## Tests that matter

Not coverage. These five carry almost all the risk:

1. **Macro calculation** — `macros.test.ts` sweeps the input space: no member below the floor,
   no negative macro, no split that doesn't add up to the total.
2. **Marking a claim paid** extends the grant exactly once (`admin.server.integration.test.ts`).
3. **The gates** — `hasActiveAccess` at the exact boundary, and `assertOnboarded` /
   `assertAccess` against real rows (`gates.server.integration.test.ts`).
4. **Plan assignment** — including when no plan is published for the chosen days
   (`onboarding.server.integration.test.ts`).
5. **The assistant's behaviour** — the evals above.

Integration tests run against a throwaway local Postgres, never Neon.

## Things that bit us

- **Unchecked radios were invisible.** `--input` measured 1.05:1 against `bg-raised`. Fixed in
  `input.tsx` and `radio-group.tsx` with `border-bronze-deep`. **Don't fix it by remapping
  `--input`**: Clerk's theme reads it as a field _fill_, shadcn as a _border_, and the sign-in
  field turned solid bronze.
- **No `toLocaleString("is-IS")` in a component.** Chrome builds with partial ICU silently fall
  back to `en-GB`: "1,812" instead of "1.812", and a hydration mismatch. Use `app/lib/format.ts`.
- **Orbitron draws a slashed zero.** "30%" reads "3Ø%". Digits use the body font (see
  `.impeccable.md`).
- **Default button height is 32px.** Use the `touch` size (44px) for a primary action on a phone.

## Written by Einar, not the agent

The macro formula's judgment calls in `app/lib/macros.ts`: deficit, surplus, protein per kg,
fat share, and above all the hard calorie floor. They have health consequences and should reflect
what Aron believes as a coach.

## Risks

- **Content.** The product is only as good as the plans and videos Aron publishes. A member only
  sees days that have a published plan, so gaps don't show as dead ends.
- **A Sanity outage breaks plans for paying members.** Accepted, softened by the CDN. If it ever
  bites: snapshot the assigned plan into Postgres at assignment time, at the cost of edits no
  longer reaching members.
- **Video URLs are copyable** by any member. See the Sanity decision in `docs/decisions.md`.
- **Scale is not a risk.** At 10× this is a few thousand rows and cached CDN reads.

## Open

Carried over from before launch; confirm which are still open.

| Item                                                                                     | Owner             |
| ---------------------------------------------------------------------------------------- | ----------------- |
| Aron's sign-off on the macro formula, then bump `formula_version`                        | Aron, then Einar  |
| Legal position on prescribing macros in Iceland                                          | Aron              |
| Price and VSK treatment                                                                  | Aron + accountant |
| ehf./kennitala — still `TODO(client)` in `src/config/site.ts`                            | Aron              |
| Delete the test account `einar+prufa@maul.is` from production                            | Einar             |
| A Playwright smoke test (sign-up → questionnaire → dashboard) was planned, never written | Einar             |
| Landing page sales section for the members' area (phase 7)                               | Einar             |
