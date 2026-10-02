# Decisions

The calls that shaped this repo, oldest first, each with its reason. A decision that was later
reversed stays here, marked **Superseded**, so the reversal still has its context.

How the app works today is in `docs/solutions/inner-circle.md`; infrastructure is in
`docs/solutions/deployment.md`. Plans and logs that these entries came from are in git history:
`git show 931162b:docs/solutions/<file>.md`.

## v1 launched — 2026-10-02

The members' area is live at `app.sterkirpabbar.is` with manual invoicing, the questionnaire,
plans, macros, Fróðleikur, `/admin` and the AI assistant. Built as paid work for Aron, billed
through Gigover at 8,000 ISK/hr from 2026-09-15.

---

## 2026-09-15 — The Astro landing page stays; the members' area is a separate app

**Decision.** `sterkirpabbar.is` stays the static Astro site. The members' area is a React
Router app in `innri/`, on its own subdomain and Vercel project.

**Why.** The landing page is static, SEO-critical, converts cold traffic, and Aron already
edits it through the Studio. The members' area is stateful and app-shaped. Splitting them keeps
each on the right runtime and keeps the page that brings in revenue out of harm's way. A
subdomain rather than a path rewrite keeps preview deploys normal and avoids running Clerk
behind a proxy with a basename.

## 2026-09-15 — No separate API service, no workspace tooling

**Decision.** React Router loaders, actions and resource routes are the backend. `src/`,
`innri/` and `studio/` are sibling directories with no Turborepo or workspaces.

**Why.** A second service adds CORS, service-to-service auth, a network hop and duplicated
types, for no benefit with one client and one developer. Three packages built by one person
don't need workspace tooling. Revisit only if the copied `@theme` block starts drifting.

## 2026-09-15 — Types are generated, never written

**Decision.** Drizzle for database columns, `sanity typegen` for content, Zod for anything
crossing a trust boundary (env vars, forms, webhooks, request bodies).

**Why.** Code an agent writes can't drift from a schema when the schema is the only place the
types come from. A type error is deterministic; an instruction in `CLAUDE.md` is a suggestion.

## 2026-09-15 — One lint stack, strict only where new code lives

**Decision.** oxlint and oxfmt replace ESLint and Prettier. `oxlint.config.ts` (not
`.oxlintrc.json`, which can't register a local JS plugin) runs:

- **anti-slop**, vendored at `tools/oxlint/anti-slop/`, against low-evidence TypeScript;
- **@shadcn/lint**, pinned exactly (it was v0.1.0), against off-token styling;
- the existing correctness, suspicious and perf rules.

The two strict sets apply to `innri/**` only. `@shadcn/lint` is off inside
`innri/app/components/ui/**`, which defines the design system rather than consuming it, and
`shadcn/no-raw-colors` allows exactly five classes (`text-hero`, `text-display`, `text-title`,
`text-subtitle`, `text-lead`) because Tailwind shares the `text-` prefix between size and colour.

**Why.** Turning the strict sets on repo-wide surfaced about 44 old violations in `src/` and
`studio/`. A wall of errors an agent is told to ignore is worse than no wall. That backlog is
its own task, deliberately out of the critical path.

## 2026-09-15 — `src/styles/global.css` is the one design system

**Decision.** `innri/app/app.css` copies its `@font-face` and `@theme` blocks verbatim, then
maps shadcn's semantic tokens (`--background`, `--primary`, …) onto the brand values.

**Why.** `shadcn init` ships its own palette, and it overrode the brand font without a sound.
Left alone, the app would end up looking like default shadcn while the landing page looks like
Sterkir pabbar. One copied file, lint enforcing it.

## 2026-09-15 — Test the risky modules, not coverage

**Decision.** Thorough tests on the five modules listed in `inner-circle.md`, and no component
unit tests or coverage gates.

**Why.** On a project of about 120 hours, a broad UI suite buys little and rots fast. A small
number of tests carries almost all the risk.

## 2026-09-15 — Videos on unlisted Vimeo or YouTube

**Decision.** No Mux for v1. The Studio rejects any video URL that isn't Vimeo or YouTube.

**Why.** Mux was cut from v1 scope; no further reason was recorded. A Drive or Dropbox share
link looks fine in the Studio and is a broken player for every member, hence the validator.

## 2026-09-15 — Macros are a stored snapshot, and the history is append-only

**Decision.** `macro_targets` stores the numbers with a `formula_version`; they are not
recomputed on read. `onboarding`, `macro_targets` and `plan_assignments` are append-only: a
change writes a new row and the latest is current.

**Why.** If the formula changes, members' numbers must not shift silently, and "why did the app
tell me 1,800 kcal in October" must stay answerable. These are health numbers.

## 2026-09-15 — The choices a member sees come from what Aron has published

**Decision.** The questionnaire offers only goal and frequency combinations that have a
published plan in Sanity.

**Why.** The biggest risk is that Aron doesn't produce all the content. He can launch with one
plan, and no member ever sees an option that leads nowhere.

## 2026-09-15 — Stripe isn't an option; payment provider search

**Decision.** Stripe doesn't support Iceland as a merchant country (checked on
stripe.com/global on 2026-09-15). Rapyd's hosted page has no subscription engine, about 30–40h of
billing code to build by hand. Merchant-of-record platforms (Paddle, Polar) couldn't confirm
Iceland as a _seller_ country. Kling was chosen, then replaced by Repeat on 2026-09-22.

**Superseded** on 2026-09-28 by manual invoicing, below.

## 2026-09-16 — The Sanity dataset stays public, on the free plan

**Decision.** No Growth plan ($15/user/month) for a private dataset.

**Why.** A private dataset wouldn't protect the valuable asset, Aron on video: any paying
member can copy a video URL out of the page. It would only protect plan text, which is largely
commodity. If the videos need protecting, the money goes to the video host (Vimeo domain
privacy or Mux signed URLs), not the CMS. **Accepted risk:** plan text is scrapeable.

## 2026-09-22 — The questionnaire draft lives in a signed cookie

**Decision.** Part-finished answers are kept in a signed cookie, not a draft table.

**Why.** `onboarding` is one row per _completed_ run with every column NOT NULL, and a partial
answer set has nowhere to go in it. The cookie also means no half-answered health data is
stored for someone who changed their mind. It's signed because it's the only thing asserting
the member confirmed being over 18. Accepted cost: switching device restarts the wizard.

## 2026-09-22 — A health flag shows an acknowledgement, then proceeds

**Decision.** Einar's call, against withholding macros from anyone with an eating-disorder
history. The eating-disorder branch adds a paragraph saying the plan works without looking at
the calorie numbers. `onboarding.acknowledged_health_at` records when it was accepted.

**Why.** An acknowledgement nobody stored is not evidence. Without the column, the decision is
indistinguishable from ignoring the flags.

## 2026-09-22 — v1 macro formula: conservative defaults

**Decision.** `FORMULA` in `innri/app/lib/macros.ts`: 1,500 kcal floor, 20% deficit, 10%
surplus, 1.8 g/kg protein, 25% fat, and `annad` as the midpoint of the two Mifflin-St Jeor
constants. Protein is capped at 40% of calories: at 250 kg, 1.8 g/kg alone exceeds the floor
and leaves negative carbohydrate.

**Why.** These are health judgment calls reserved for Einar and Aron, not the agent. They're
grouped with their reasoning so replacing them is a five-line edit. **Still open:** Aron's
sign-off. Bump `formula_version` when his numbers land.

## 2026-09-24 — Experience is recorded, not used to pick a plan

**Decision.** Plans are matched by goal and number of days (equipment was dropped on 09-30,
below). Experience is stored but doesn't select a plan. Limitations are optional free text
(500 characters) for Aron to read, and nothing acts on them.

**Why.** Experience as a key multiplies Aron's filming load: 2 goals × 3 frequencies × 3
levels × 3 equipment options would be 54 plans, when the biggest risk is that he won't make 10.
`equipment` and `experience` are nullable, because rows from before the questions existed have
no honest answer to backfill.

## 2026-09-28 — Manual invoicing, not card payments

**Decision.** Aron's call. He invoices each member by a claim (krafa) in their online bank and
marks it paid on `/admin`. Access is `users.access_granted_until`, extended only from there.

- **Questionnaire before payment.** Finishing it is how a member asks to be invoiced. Plan and
  macros are assigned automatically, so granting access is all "setting a member up" means.
- **Who to invoice lives on `users`** (name, kennitala, phone), not on append-only
  `onboarding`. The kennitala is checksum-verified and must be personal, not a company's.
- **`ready_at` is the queue,** set once with `coalesce`, so a second completion can't move a
  member to the back.
- **Greitt extends from whichever is later, now or the current end.** Paying early keeps the
  days left; paying late doesn't backdate. Default 30 days.
- **A double-click extends once.** The form carries the end date the page showed, and the
  update applies only if that's still the stored value.
- **At most one open claim per member,** enforced by a partial unique index.

**Why.** No Repeat shop or acquirer agreement existed yet, and launch shouldn't wait for one.
Nothing a member's browser sends can grant access.

## 2026-09-29 — Unpaid members see the app, with the paid tabs locked

**Decision.** Two nested layouts. `layouts/member.tsx` requires a finished questionnaire;
`layouts/paid.tsx` inside it requires access. Unpaid members land on `/articles` with a banner.
`/waiting` is retired to a redirect. `/admin` sits in the member layout (which lets admins
through without a questionnaire) and adds `requireAdmin`, answering 404 to anyone else.

**Why.** `/waiting` was a dead end: someone who hadn't paid saw nothing of what they were paying
for. The locked tab is cosmetic; the paid layout's loader is the lock.

## 2026-09-29 — Repeat removed; its columns stay, dormant

**Decision.** Einar's call before launch. The Repeat integration came out entirely: checkout,
webhook, reconciliation cron, card widget dependency and env keys. `users.subscription_status`,
`repeat_subscription_id`, `current_period_end`, `checkout_claimed_at`, the `subscription_status`
enum and the `repeat_events` table stay in the schema, marked DORMANT, and nothing reads them.

**Why.** Manual invoicing is the payment model, so the integration came out rather than sit
dormant. Production held no Repeat data (0 subscriptions, 0 events). The columns stay because
dropping them needed a production migration right before launch, for no gain. Drop them in a deliberate
migration, or reuse them.

**If card payments come back:** start from commit `89d685d`. The Repeat design (webhook as a
nudge with a re-fetch, reconciliation cron, headless checkout, double-charge guards, default
failure rules) is in `git show 931162b:docs/solutions/payments-iceland.md` and the "Payments
switched to Repeat" and "Phase 6 built" sections of `git show
931162b:docs/solutions/inner-circle.md`.

## 2026-09-30 — Preview deploys use the dev database

**Decision.** The Neon integration feeds Production only. Preview and Development use the `dev`
branch, paired with Clerk's dev instance.

**Why.** Preview used to share production's database while signing in through Clerk's dev
instance, so test sign-ins wrote production rows for users production's Clerk had never heard
of.

## 2026-09-30 — The number of days decides the split

**Decision.** From Aron's feedback: where a member trains doesn't change their plan. Equipment
is no longer asked. Plans are matched on goal and days.

| Days | Split                                  |
| ---- | -------------------------------------- |
| 1    | Full body                              |
| 2    | Upper / lower                          |
| 3    | Push / pull / legs                     |
| 4    | Upper / lower, twice                   |
| 5    | Chest / back / legs / shoulders / arms |

Members change their days in Stillingar; that appends a new plan assignment and leaves macros
alone. Admins can rerun the questionnaire from `/admin`. `onboarding.equipment` and its enum
stay because old rows hold values.

## 2026-09-30 — The members' AI assistant

**Decision.** A chat bubble in the paid layout, streaming AI SDK `streamText` through the
Vercel AI Gateway (`routes/api/assistant.ts`).

- **Publishing is the approval.** FAQ answers live in Sanity as `faqEntry`, and the app reads
  published content only. `reviewNote` is for Aron and never reaches the model.
- **Every approved answer goes into the instructions; there's no search tool.** At tens of
  entries that's a few thousand tokens, and there's no retrieval step to miss the right one.
  Revisit when the collection is large enough to cost real money.
- **Only the session user's data.** The tools are `myPlan`, `myMacros` and `proteinSwap`, each
  closed over the session user's id. Only text parts of the browser-held history are forwarded,
  because tool parts could be forged. The route guards itself, since a resource route runs no
  layout loader.
- **Off-topic gets one fixed reply, `OFF_TOPIC_REPLY`, word for word.** Left to phrase its own
  refusal, the model hedged and then wrote the Python anyway. Emergencies are exempt.
- **`assistant_usage` stores cost and outcome, never the text.** Failed and aborted calls count
  toward the daily limit (30), so an outage or a closed tab can't hand out unlimited retries.
- **`ASSISTANT_ENABLED` is the kill switch,** off unless set to `true`; off also hides the
  bubble.
- **OpenAI through a bring-your-own key in the Gateway.** Free Gateway credits refuse OpenAI
  models. Gateway budgets don't count BYOK spend, so the spend cap is set on OpenAI itself.
- **Launch gate: Aron's acceptance cases** (`innri/evals/assistant/`), with no critical
  failures. 57/63 pass at launch; the rest vary from run to run.

**Why.** Aron's handoff brief: answers members' everyday questions from approved content
without being able to change anything. Nine of his draft answers were rewritten because they
described features the app doesn't have (a cancel button, automatic renewal).
