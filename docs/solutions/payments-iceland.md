# Taking card payments from Iceland

**Status:** decided 2026-09-15 · **Decision:** Kling

## Stripe is not an option

Stripe does not support Iceland as a merchant country. Verified against
[stripe.com/global](https://stripe.com/global) on 2026-09-15: the supported list covers
Norway, Denmark, Sweden, Finland, Liechtenstein and Gibraltar — **Iceland is the Nordic gap**,
and it is not in the invite-only preview tier either (that is India and Indonesia).

There is no workaround. There is no merchant account to open.

## What was considered

**Rapyd Europe hf.** (the former Valitor) — the domestic incumbent. Its **Web Payments Page**
is a hosted checkout: MerchantID + VerificationCode, redirect carrying a `DigitalSignature`
hash, card data never touching our server. Docs at `specs.valitor.is` and
`valitorpay.github.io`. Viable, and the fallback if Kling does not work out.

Two traps if we ever use it: the docs offer MD5 or SHA256 — **use SHA256**; and access must be
granted only on the verified `PaymentSuccessfulServerSideURL` callback, **never** the browser
redirect.

It has no subscription engine. `CreateVirtualCardOnly` gives saved cards, but scheduling,
retries, dunning, cancellation and proration would all be ours to build — roughly 30–40h of
the most bug-prone money-touching code in the project. That is what pushed the original design
toward a 30-day pass instead of a real subscription.

**Teya** (the former Borgun) — the other domestic acquirer. Never evaluated in depth; the
natural second quote if Kling and Rapyd both fall through.

**Merchant-of-record platforms** (Paddle, Polar) — would handle VSK, but **seller** eligibility
for Iceland could not be confirmed. Their published country lists are _buyer_ lists, which is a
different thing. Fees also run 4–5% against ~1.5%, and payouts would likely land in EUR rather
than ISK — awkward for an Icelandic consumer product priced in krónur. Do not rely on one
without written confirmation of seller eligibility.

## Decision: Kling

[kling.is](https://kling.is/subscriptions) — Icelandic, and it has an actual billing engine.

- **`/v1/subscriptions`** with a real lifecycle: `trialing → active → past_due → canceled`,
  including automatic retry after failed payments
- **Webhooks signed HMAC-SHA256**, verified via the `X-Kling-Signature` header, backed by an
  append-only event log
- **Bearer token auth**, `sk_test_` / `sk_live_`, with a fully isolated test mode that needs
  no card and no merchant account to start
- **Hosted checkout** at `/v1/checkout/sessions`, plus `@klingis/embed` for an on-site overlay
  with no redirect
- Weekly / monthly / yearly intervals, trial periods

**Pricing:** no setup fee, no monthly fee. 1.5% on subscriptions/API/payment links, 0.8% on
the POS app, 0.8% on heimabanki collections (min 25 kr, max 250 kr). Acquirer fees billed
separately. Custom packages above 100M kr annual revenue.

Kling states they handle the processor application on the merchant's behalf, which removes the
weeks of KYC lead time that going direct to Rapyd or Teya would have cost.

## Consequences

This is why the design uses **real recurring subscriptions rather than a 30-day pass**. The
pass was only ever a workaround for not having a billing engine. Auto-renewal is what makes a
fitness subscription work — people go quiet in week three and come back in week six.

Test mode needing no merchant account also means **Phase 6 is not blocked on Aron's paperwork**.
It can be built and tested before the ehf. exists.

## Architectural mitigation — required regardless

Kling is small and young. No legal entity or kennitala is published on their site, and
`docs.kling.is` serves a `TRAEFIK DEFAULT CERT` — their reverse proxy has no certificate for
that subdomain, so the docs host fails TLS verification outright. Read the docs via
`kling.is/docs`, which works.

None of that is disqualifying, but they will be holding the client's recurring revenue. So:

- Mirror `subscription_status` and `current_period_end` into our Postgres from webhooks.
- `requireActiveAccess` reads **only** the local mirror — never a live Kling call.

That keeps access fast, keeps it working through a Kling outage, and means we own the customer
list and the access truth rather than renting them.

## Spike checklist — before Phase 6

Grab test keys (free, instant) and confirm by building the real flow. Ask `hallo@kling.is`:

1. **Legal entity and kennitala** — cross-check against fyrirtækjaskrá.
2. **Who is merchant of record?** Acquirer fees billed separately suggests the merchant is
   Aron, meaning VSK stays his problem. Confirm explicitly.
3. **Data portability** — if Aron leaves or Kling folds, can subscriptions and payment tokens
   migrate, and in what format?
4. **Can subscriptions bill via heimabanki claims** rather than card? Many Icelanders prefer
   kröfur, and it is 0.8% against 1.5% — potentially better for both conversion and margin.
5. **What does Kling send the customer by email?** Receipts, `past_due` dunning, cancellation.
   This determines what Resend is still needed for, and prevents members receiving two
   different "greiðsla mistókst" emails in two different voices.
