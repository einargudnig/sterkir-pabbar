# Innri hringurinn — paid members' area

**Status:** approved 2026-09-15 · **Owner:** Einar · **Client:** Aron

A paid subscription members' area at `app.sterkirpabbar.is`. New members answer a
health-screened questionnaire, receive stored macro targets and a pre-built training plan
matched to their goal and chosen frequency, and get a dashboard with their plan, their
macros, and Aron's tips library.

Commissioned by Aron on 2026-09-14. This is **paid work** — billed through Gigover at
8,000 ISK/hr. That reverses the constraint that drove earlier decisions on this repo.

## Scope

**Building:** everything in Phases below.

**Explicitly not building:**

- The AI assistant (_"Sterkir pabbar gervigreindin"_) — deferred to a separate phase, priced
  separately, and gated on the legal question below.
- Mux — videos go to unlisted Vimeo/YouTube for v1.
- A separate API service — React Router loaders/actions are the backend.
- Monorepo tooling — sibling directories, as `studio/` already is.
- ESLint, Prettier — oxlint and oxfmt replace them.
- A component-level unit test suite or coverage gates on UI code.
- Any change to the Astro landing page beyond the sales section in Phase 7.

## Shape

```
sterkirpabbar.is        Astro, static, marketing + sales section  (unchanged)
app.sterkirpabbar.is    React Router v8 app on Vercel  (innri/)   (new)
studio/                 Sanity Studio, content for both
```

```
                    sterkirpabbar.is  (Astro, static)
                                  │
                                  ▼
               app.sterkirpabbar.is   (React Router v8, Vercel)
                    │           │            │
          ┌─────────┘           │            └──────────┐
          ▼                     ▼                       ▼
       Clerk                Postgres                 Sanity
    (identity)         (subscription mirror,     (plans, exercises,
                        answers, macros)          articles, copy)
                            ▲
                            │ webhook, HMAC-SHA256 (X-Kling-Signature)
                            │
                          Kling  (/v1/subscriptions, /v1/checkout/sessions)
```

## Stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| App        | React Router v8 (framework mode), Vercel, in `innri/`         |
| Hosting    | Two Vercel projects — see `docs/solutions/deployment.md`      |
| Auth       | Clerk (`@clerk/react-router`) — email + password, plus Google |
| Database   | Neon Postgres + Drizzle                                       |
| Content    | Sanity, queried server-side in loaders                        |
| Payments   | Kling (`kling.is`) — real recurring subscriptions             |
| Email      | Resend — **held**, see Open questions                         |
| Components | shadcn/ui on Base UI (the default since July 2026)            |
| Validation | Zod — env vars, form parsing, webhook payloads                |

## Key decisions

1. **The Astro landing page stays.** It is static, SEO-critical, converts cold traffic, and
   Aron already edits it through the Studio. The members' area is stateful and app-shaped.
   Splitting them keeps each on the right runtime and keeps the revenue page out of harm's way.

2. **Subdomain, not a path rewrite.** Preview deploys work normally — which matters most on
   the payment flow — and Clerk behind a proxy with a basename is a known time sink.

3. **No separate API service.** Loaders and actions are server code; resource routes cover
   webhooks and cron. A second service would add CORS, service-to-service auth, a network
   hop and duplicated types, for no benefit at one client and one developer.

4. **Kling for payments, real subscriptions — not a 30-day pass.** Stripe does not support
   Iceland (verified on stripe.com/global). Rapyd's hosted page would have meant building the
   billing state machine by hand (~30–40h). Kling provides `/v1/subscriptions` with a real
   lifecycle, retry logic, HMAC-signed webhooks, and an isolated test mode. See
   `docs/solutions/payments-iceland.md`.

5. **Subscription state is mirrored into Postgres from webhooks.** `requireActiveAccess`
   reads only the local mirror, never a live Kling call. Keeps access fast, keeps it working
   through a Kling outage, and means we own the customer list rather than renting it.

6. **Macros are stored as a snapshot, not recomputed on read.** If the formula changes later,
   existing members' numbers must not silently shift under them — and there needs to be an
   audit trail if someone disputes their targets.

7. **Questionnaire frequency options are driven by which plans exist in Sanity.** Aron controls
   launch scope by publishing. He can launch with 2 plans instead of 10, and the app never
   shows an option that leads nowhere. This is the mitigation for the biggest risk below.

8. **Types are generated from their sources, never written.** Drizzle for DB, `sanity typegen`
   for content, Zod for anything crossing a trust boundary. Agent-authored code cannot drift
   from the schema if the schema is the only place the types come from.

## Routes

Paths and filenames are English; every word a member reads on the page is Icelandic.

```
/                     redirect: signed out → /sign-in
                                no subscription → /subscribe
                                onboarding incomplete → /onboarding
                                else → /dashboard
/sign-in              Clerk sign-in
/sign-up              Clerk sign-up
/subscribe            subscription state + Kling checkout
/onboarding           wizard; step in the URL (?step=health|measurements|goal|frequency)
/dashboard            redirects to the first tab
/dashboard/workouts   Mínar æfingar
/dashboard/macros     Mín macros
/articles             Fróðleikur index
/articles/:slug       article
/settings             account, cancel subscription
/admin                Aron — manual grant, comps, fix failed payments

/api/kling/webhook    HMAC-SHA256 verified, updates the local mirror
/api/clerk/webhook    user created/deleted → sync users table
```

Three gate levels, defined in `innri/app/lib/auth.server.ts`:

| Level            | Routes                                | Enforced by                    |
| ---------------- | ------------------------------------- | ------------------------------ |
| public           | `/sign-in`, `/sign-up`                | —                              |
| signed in        | `/subscribe`, `/onboarding`, `/admin` | `requireUserId` in each loader |
| signed in + paid | everything under `layouts/member.tsx` | the layout loader              |

The middle level exists because those routes must stay reachable to someone who has not paid
yet — that is the point of a paywall — so they sit outside the member layout and guard
themselves. `/dashboard` repeats the check despite being inside the layout: layout and child
loaders run in parallel, so without it the index redirect wins the race and a signed-out
visitor takes two hops to `/sign-in` instead of one.

## Data model

Implemented in `innri/app/db/schema.ts`; migration `drizzle/0000_*.sql` generated offline.

- `users` — `clerk_user_id` unique, plus the Kling mirror: `subscription_status`
  (`trialing|active|past_due|canceled`), `current_period_end`, `kling_subscription_id`,
  and `is_admin`. Also `access_granted_until`, kept **separate** from `current_period_end` so a
  later webhook cannot silently wipe a manual grant Aron made.
- `onboarding` — goal, sessions_per_week, weight_kg, height_cm, age, sex, activity_level, and
  the four health flags as explicit boolean columns plus `confirmed_adult`.
- `macro_targets` — kcal, protein_g, carbs_g, fat_g, `formula_version`, and the
  `onboarding_id` the numbers were computed from.
- `plan_assignments` — sanity_plan_id, assigned_at.
- `kling_events` — `kling_event_id` unique (the whole idempotency strategy), event_type,
  amount_isk, raw `payload` jsonb.

Three refinements made while implementing:

1. **`onboarding`, `macro_targets` and `plan_assignments` are append-only.** Changing weight or
   goal writes a new row; the latest is current. Without this, the inputs that produced a past
   target are lost, and "why did the app tell me 1,800 kcal in October" is unanswerable. These
   are health numbers, so it has to be answerable.
2. **`formula_version` on every macro row.** Bumped whenever the formula, deficit or safety
   floor changes, so an old number traces to the rules in force when it was given.
3. **`payments` became `kling_events`.** It logs the whole subscription lifecycle, not just
   payments — `subscription.canceled` matters as much as a capture.

`amount_isk` is whole krónur. ISK has no minor unit, so there is no ×100 and no rounding to get
wrong — do not copy the store-money-in-cents habit from Stripe examples.

Activity multipliers: kyrrseta 1.2 · létt virkni 1.375 · miðlungs virkni 1.55 · mikil virkni 1.725.
Each gets a plain-language example — "moderate activity" means nothing to someone who has not
trained in years.

**Open, for Einar, alongside the calorie floor:** `sex` has a third value `annad`, which
Mifflin-St Jeor has no constant for. What the formula does with it is a decision, not a default.

## Sanity — new document types

Implemented in `studio/schemas/`, registered, and extracted — `bun run types:sanity` now emits
16 types into `innri/app/lib/sanity.types.ts`.

- `exercise` — name, muscleGroup, cue (140 chars), videoUrl
- `trainingPlan` — goal, sessionsPerWeek, intro, sessions[] → exercise refs + sets/reps/note
- `article` — title, slug, category, excerpt, portable-text body
- `siteContent` — still to extend with inner-circle sales copy (phase 7)

Two validators guard silent breaks, in the spirit of the existing `validators.ts`:

- **`planCombinationMustBeUnique`** — the app finds a plan by querying one exact
  goal + sessionsPerWeek pair. Two published plans sharing a pair means the query returns both
  and a member could get a plan Aron did not mean, with nothing visibly wrong. Checked against
  published documents only, so two drafts may coexist while he writes.
- **`videoUrlMustBeEmbeddable`** — a Google Drive or Dropbox share URL looks fine in the Studio
  and renders as a broken player for every member. Vimeo and YouTube only.

Queried at request time in loaders. **Do not** extend `scripts/fetch-content.mjs` to these —
that build-time bake stays for the marketing site only, so Aron never triggers a rebuild to
fix a typo.

## Phases

| #   | Phase                                                                              | Hours        |
| --- | ---------------------------------------------------------------------------------- | ------------ |
| 0   | ✅ Agent-friendly foundation — `docs/solutions/agent-tooling.md`                   | 10–16        |
| 1   | ✅ App skeleton — Clerk, Neon, schema, deployed (DNS still pending)                | 10–14        |
| 2   | 🔶 Sanity schemas + Studio deployed + guide updated; app still on placeholder data | 8–12         |
| 3   | Onboarding — health screen, metrics, macro calc, plan assignment                   | 12–18        |
| 4   | Inner circle — Mínar æfingar / Mín macros / Fróðleikur, video embeds               | 20–28        |
| 5   | Admin page — manual grant, comps, ops tooling                                      | 3–4          |
| 6   | Kling — checkout, HMAC webhook, subscription mirror **(spike-gated)**              | 12–18        |
| 7   | Landing page sales section + Sanity fields                                         | 6–10         |
| 8   | QA, mobile, handover                                                               | 10–14        |
|     | **Total**                                                                          | **91–135 h** |

At 8,000 ISK/hr: **728,000 – 1,080,000 ISK**. Resend held, AI assistant excluded.

Phases 0–5 are unblocked and fully specified. Phase 6 waits on the Kling spike.

## Tests that matter

Not coverage — these five carry almost all the risk:

1. **Macro calculation** — property tests on the floors: no input combination may produce a
   target below the safety floor.
2. **Kling webhook HMAC verification** — including a forged-signature rejection.
3. **Webhook idempotency** — the same event delivered twice must apply once.
4. **`requireActiveAccess`** — across `trialing`/`active`/`past_due`/`canceled` and the exact
   period boundary.
5. **Plan assignment** — including when no published plan exists for the chosen frequency.

Plus **one** Playwright smoke test: signup → subscribe → onboarding → dashboard.

## Risks

**Biggest: Aron does not produce the content.** 10 plans and 40–60 exercise videos, from a
working PT with two children. The product is an empty shell without them, and this is the
likeliest assumption to fail. Mitigated by decision 7 — he can launch with 3×/week only, which
cuts filming load by ~80%.

**Sanity outage breaks the core product** for paying members. Accepted, mitigated by the Sanity
CDN. Escalation if it ever bites: snapshot the assigned plan into Postgres at assignment time,
at the cost of plan updates no longer propagating.

**Kling is small and young.** No legal entity or kennitala published on their site, and
`docs.kling.is` serves a Traefik default certificate. Not disqualifying, but they will hold the
client's recurring revenue. Mitigated architecturally by decision 5.

**Scale is not a risk.** At 10x this is still a few thousand rows and cached CDN reads. The
binding constraint is Aron's filming schedule, not infrastructure.

**Rollback is cheap.** The Astro site is untouched, the app is a separate Vercel project, and
`current_period_end` is one column. The only irreversible part is money actually taken.

## Open questions

| Open                                                                           | Owner             | Blocks                      |
| ------------------------------------------------------------------------------ | ----------------- | --------------------------- |
| Kling spike — legal entity, VSK/MoR, data portability, heimabanki billing      | Einar, 2–3h       | Phase 6                     |
| Trial period yes/no                                                            | Aron              | Phase 6                     |
| Monthly price + VSK treatment                                                  | Aron + accountant | Go-live                     |
| Legal position on prescribing macros in Iceland                                | Aron              | Go-live, disclaimer wording |
| Resend — deliberately held until Kling's coverage of receipts/dunning is known | Einar             | Nothing                     |
| ehf./kennitala — still `TODO(client)` in `src/config/site.ts`                  | Aron              | Go-live                     |
| 40–60 exercise videos                                                          | Aron              | Phase 4 content             |

## Written by Einar, not the agent

The macro calculation in Phase 3. Mifflin-St Jeor and the activity multiplier are mechanical;
the deficit percentage, the surplus, protein per kg, and above all **the hard calorie floor
below which the app refuses to go** are judgment calls with health consequences. They should
reflect what Aron actually believes as a coach.

## Corrections found during phase 0

- **React Router v8, not v7.** `create-react-router` scaffolds v8.4.0. `@clerk/react-router`
  3.6.24 declares `react-router: ^7.9.0 || ^8.3.0`, so the auth plan is unaffected.
- **The package directory is `innri/`, not `app/`.** React Router uses `app/` for its own
  routes, so a package named `app/` would give `app/app/routes/`.
- **Phase 0 came in at the low end.** Tooling, scaffold, brand bridge and the verification loop
  are done; the 10–16h estimate holds with room to spare.

## Progress — 2026-09-16

**Done:** phase 0 in full. Phase 1: Clerk wired with all three gate levels verified against a
running server, Neon provisioned and migrated (5 tables, 4 enums live), app deployed and
reachable at https://sterkir-pabbar-innri.vercel.app. Phase 2: the three Sanity document types
are written, deployed to the Studio, and documented for Aron in `docs/leidbeiningar.md`.

**Not done in phase 2:** the app still reads `innri/app/lib/placeholder.server.ts`. Swapping
the screens onto real GROQ queries is the next task, and it deletes that file.

**Launch target is 1 October**, confirmed by Einar after the scope was questioned. The full
plan below stands; the binding constraint remains Aron's filming, and the guide now tells him
to start with one plan — 3× per week, fat loss, roughly 18 exercises — rather than all ten.

**Sanity stays on the free plan and the dataset stays public** — private datasets need Growth
($15/user/month). The reasoning is in `docs/solutions/deployment.md`: a private dataset would
not have protected the videos, which any member can copy out of the page regardless. The money
belongs at the video host (Vimeo domain privacy or Mux signed URLs) before public launch, not
at the CMS. Accepted risk until then: plan text is scrapeable.

## Phase 2 complete — 2026-09-16

The app reads Sanity. `placeholder.server.ts` is deleted.

- `innri/app/lib/sanity.server.ts` holds the client and four `defineQuery` GROQ queries, all
  typed by `sanity typegen` — `AvailableFrequenciesQueryResult` comes back as
  `Array<1 | 2 | 3 | 4 | 5>`, derived from the schema rather than written by hand.
- `perspective: "published"` is set explicitly. With a token Sanity can return drafts, so
  without it a member would see Aron's half-written plan as he typed it.
- The onboarding wizard renders only frequencies that have a published plan. Verified live: it
  returns `[3]`, because the seed publishes one plan.
- Empty states are real, not defensive: before Aron publishes anything, "Planið þitt er í
  smíðum" is what a paying member should see instead of a blank page.

**Seed data** lives at `studio/seed/inner-circle.ndjson` — 9 exercises, 1 plan, 3 articles,
imported with `sanity dataset import`. The exercises are generic and genuinely useful to keep;
the plan is titled "(sýnidæmi)" and its intro tells Aron to delete it. Macros are still
hardcoded in `dashboard/macros.tsx`, marked for phase 3, because they come from Postgres
rather than Sanity.

## Phase 1 verified end to end — 2026-09-18

Clerk production live on `app.sterkirpabbar.is` serving `pk_live`; dev banner gone. The full
identity chain was confirmed against production rather than inferred:

1. User created in the production Clerk instance via the Backend API
2. `user.created` webhook delivered to `/api/clerk/webhook`
3. Signature verified — unsigned and forged-signature requests both rejected 401
4. Row upserted into Neon with the email attached

Test account: `einar+prufa@maul.is`, user id `user_3JVNS6y9mxztej7oAvyfoY33CKQ`. Delete it
before launch rather than leaving a known-credential account in production.

`requireUser` also creates the row on first authenticated request, so a missed or delayed
webhook cannot leave a paying member without one.
