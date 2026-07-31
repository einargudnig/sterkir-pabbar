# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Icelandic fathers who have not trained regularly in years. They are time-poor,
often carrying accumulated aches rather than an injury, and are motivated by
being able and present for their kids — not by aesthetics or competition.

They are **not gym people**. They arrive already braced for something that will
make them feel out of place, and they decide quickly whether this is "for
someone like me."

The primary job: find a way to get stronger that survives a week that falls
apart — sleepless nights, work, kids — without needing an hour a day or a gym
membership.

## Product Purpose

Personal training and training programs built for fathers. Success is a client
who is still training months later, with more energy after a long day and a
back and knees that hold up.

The single conversion goal of the site is booking the **free intro chat**
(`ókeypis spjall`). Nothing else on the page is asked of the visitor.

## Positioning

**Aron is a dad training dads.** He lives the constraint he programs around, so
the programming comes from inside the problem rather than from a textbook.
Training is designed _around_ a chaotic family week, not in spite of it, and
built to keep going when the week collapses.

A neighbouring trainer can copy the schedule but cannot truthfully claim the
same vantage point.

**No fixed dose appears anywhere on the site.** Aron removed every standard
prescription — "3× á viku", "30–45 mínútur", "12 vikur" — because every prógram
is built around the individual, and a headline number contradicts that. The
hero stat rail was deleted rather than repopulated; there is no verified data to
put in its place. Do not reintroduce a session count, session length, or
time-to-result anywhere, including copy that merely implies one.

Aron's own words, supplied by him and used verbatim in `coachIntro` and
`site.coach.bio`: two-child father, Mosfellingur, specialising in
**einkaþjálfun and fjarþjálfun** for beginners and advanced alike. The goal is
stated as being **a role model for the people who matter most to you**.

## Operating Context

**Online-first and nationwide.** Confirmed at init; the local-business framing
the code originally carried has been removed. Aron is based in Mosfellsbær, but
that is not a service boundary and is not rendered on the site.

**Two tiers, both delivered online, both nationwide** (set by Aron):

| Tier                         | Price         | Contains                                          |
| ---------------------------- | ------------- | ------------------------------------------------- |
| **Æfingaprógram** (featured) | 15.900 kr/mán | Tailored training prógram in the app              |
| **Æfinga- og matarprógram**  | 24.900 kr/mán | Tailored nutrition prógram on top of the training |

**Both** tiers include **direct messaging to Aron** and a **weekly check-in**.
These are not upsell levers — they are what makes either prógram work, so they
appear in both feature lists and in the pricing FAQ.

Removed by Aron, do not reinstate without him asking:

- **Pabbahópur** (the in-person peer group) — gone entirely.
- **Einkaþjálfun 1:1** as a _packaged tier with a public price_ — gone. Note the
  distinction: Aron still does 1:1 and says so in his own bio, so the FAQ has a
  "Býðurðu upp á einkaþjálfun?" entry pointing to the free chat. What was
  removed is the priced tier, not the service.

Consequences future work must respect:

- The service area is **Iceland**, not `Höfuðborgarsvæðið`. The site emits
  `ProfessionalService` with `areaServed: Ísland` and no `PostalAddress`; do not
  reintroduce a `LocalBusiness` type or a street address.
- **Æfingaprógram is the featured tier**, taking the large panel and the primary
  button — the lower-friction entry point for a father who has not trained in
  years. Æfinga- og matarprógram follows as a lighter row.
- `makesOffer` in `lib/jsonLd.ts` is **generated from `offerings`**, so prices in
  the structured data cannot drift from the prices on the page. Keep that
  property; do not hand-write offer nodes.

## Capabilities and Constraints

- Astro 7 static site, Tailwind v4 `@theme` tokens, effectively zero client JS
  (a nav toggle only). No backend, no forms, no booking system yet.
- Icelandic only (`lang="is"`). Fonts are self-hosted and must cover latin-ext
  for full Icelandic glyph coverage (þ, ð, æ, ö, á…).
- Copy and JSON-LD are both generated from `src/config/site.ts`, so visible
  text and structured data cannot drift apart. Preserve that property.
- SEO/AEO matters — this is how dads find it.

**Confirmed contact facts:**

- Email **aron@sterkirpabbar.is**, phone **+354 456 7890**.
- The free chat is booked by email. `site.bookingUrl` is a `mailto:` with the
  subject "Ég vil bóka ókeypis spjall" prefilled; the offering CTAs use
  `enquiryHref()` to prefill the tier name instead. All CTA destinations resolve
  through `src/lib/booking.ts` — there is exactly one place to change when a
  real booking system arrives.

**Still undecided. Do not treat as true and do not invent values:**

- Final domain (`sterkirpabbar.is` is unconfirmed)
- Whether any city should appear at all, given online-first. Aron is in
  Mosfellsbær (`site.contact.city`), but nothing renders it today.
- Legal entity name / kennitala.
- Whether a booking tool (Calendly, Noona, a form) replaces the mailto.

## Brand Commitments

- Name **Sterkir pabbar**; tagline **"Verðum sterkari saman"**.
- The **crest** — a single continuous-line drawing of a father flexing with a
  child on his shoulders (`public/logo/crest-*.webp`, alpha-masked so it can be
  recoloured at any scale). This is the strongest identity asset the brand has.
- **Orbitron** carries the wordmark, inherited from the current identity.
  Note: it draws a slashed zero, so it cannot set numerals.
- Voice: Icelandic plain speech. Short sentences, no English loanwords, no
  exclamation marks, no hype. The register of a friend who happens to be a
  trainer.

## Evidence on Hand

**The site currently has almost no real evidence. All of the following are
placeholder and must not be presented, cited, or reasoned about as fact:**

- **Testimonials** — "Gunnar" and "Kristján" were invented. They have been
  **removed** from the site along with the section that rendered them. Do not
  reinstate them; only real, permissioned quotes go back in.
- **Credential** — "ÍAK einkaþjálfari" is unconfirmed and is not rendered.

**Now confirmed by Aron, treat as fact:**

- **Pricing** — 15.900 kr and 24.900 kr per month. No longer provisional and no
  longer written as "frá X"; these are the prices.
- **Aron's bio** — supplied by him verbatim. This remains the only fully
  verifiable evidence on the site. Do not paraphrase it.

**Absences future work must not paper over:**

- No photography of Aron or any client exists. The design must hold on
  typography, the crest, and texture alone, and must not leave holes shaped
  like a missing photo.
- No case studies, results data, client count, or press.

## Product Principles

1. **Credibility over persuasion.** This audience is braced for a sales pitch.
   Overclaiming loses them faster than underclaiming.
2. **Lower the cost of the first step.** Every decision is measured against
   whether it makes the free chat easier to say yes to.
3. **Design around the collapsed week.** The product's promise is that it
   survives real life; anything implying ideal conditions contradicts it.
4. **Never fabricate evidence.** Given how little real proof exists, invented
   proof is the fastest way to destroy the trust this positioning depends on.
5. **Reachable from anywhere in Iceland.** Online-first is the business;
   local-only framing shrinks the market.

## Accessibility & Inclusion

WCAG AA contrast minimum. All motion must degrade under
`prefers-reduced-motion`. Full Icelandic glyph coverage is a hard requirement.
