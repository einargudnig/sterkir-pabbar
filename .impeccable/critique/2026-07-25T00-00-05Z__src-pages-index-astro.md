---
target: src/pages/index.astro
total_score: 22
max_score: 40
na_heuristics:
p0_count: 3
p1_count: 2
timestamp: 2026-07-25T00-00-05Z
slug: src-pages-index-astro
---

Method: dual-agent (A: unanchored design review, browser-inspected 1440x900 + 390x844 - B: CLI detector + in-page detector + hard browser evidence, isolated). Neither saw the other's output before synthesis.

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                           |
| --------- | ------------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 2         | `.cta-btn` href="#" - the one conversion action changes scrollY by zero, rewrites URL to /#         |
| 2         | Match System / Real World       | 3         | Voice excellent; "Fa nanari upplysingar" promises reading, delivers a booking panel                 |
| 3         | User Control and Freedom        | 2         | `<details name="faq">` exclusive - opening the price question closes the "am I too unfit?" question |
| 4         | Consistency and Standards       | 2         | Four CTA labels, two destinations, one dead; price gets three type treatments                       |
| 5         | Error Prevention                | 2         | tel:+3540000000 renders as a live tappable call link                                                |
| 6         | Recognition Rather Than Recall  | 2         | Price stated y~~1400, restated y~~5400 - 3,300px apart, different words                             |
| 7         | Flexibility and Efficiency      | 2         | .header-cta hidden below 900px - no persistent mobile conversion path                               |
| 8         | Aesthetic and Minimalist Design | 3         | Disciplined; loses a point to five identical section skeletons + ~300px dead void in Offerings      |
| 9         | Error Recovery                  | 1         | The one possible error state (dead CTA) has no recognition, diagnosis, or fallback                  |
| 10        | Help and Documentation          | 3         | FAQ content is the best on the page; collapsed, below price, never says who Aron is                 |
| **Total** |                                 | **22/40** | **Needs work**                                                                                      |

Both heuristics a Persuade surface may excuse as n/a were scored - both have real failures here.

## Design Specificity Verdict

Unanchored review: authored surface, template skeleton - ~25% specific, 75% category-interchangeable. Five body sections built from one identical primitive (kicker -> Fraunces h2 -> hairline-topped rows) repeated over 6,784px with uniform --spacing-section padding. The page has no tempo.

Deterministic scan: CLI detector clean (exit 0, []). The in-page detector found 13 instances across 5 rules. Key one: repeated-section-kickers flagged 5x site-wide.

CONVERGENCE: a subjective reviewer and a mechanical rule independently identified the same defect from opposite directions.

Detector caught what the review missed: undersized-ui-text x9 (every .kicker at 10.88px, .offer-flag at 9.92px, below 11px floor); em-dash-overuse (10 in body copy); hero-eyebrow-chip (kicker above h1 as saturated pattern).

False positives: bounce-easing is Tailwind's shipped --animate-bounce, not ours (verified - our only reference is a comment saying we don't use bounce). Off-canvas nav duplicates at 0x0 are display:none containers, correctly excluded. overused-font (Fraunces 27%) is the pinned brief working as intended.

No user-visible overlay is running - live server started, injected, read, stopped during assessment.

## Overall Impression

Craft is real, strategy is broken. Contrast, motion discipline and token hygiene are good - 9.33:1 on .hero-sub, reveals gated behind both @supports and prefers-reduced-motion, zero horizontal overflow both viewports, clean heading order, one h1, lang=is.

The biggest opportunity is a person, not a pixel. site.coach - Aron's name, role, and the warmest paragraph in the repo - is emitted to JSON-LD and rendered for humans zero times. "Aron" does not appear in document.body.innerText. The page speaks in an unattributed "eg" and asks a nervous stranger to book fifteen minutes alone with him.

PRODUCT.md says the moat is "a neighbouring trainer cannot truthfully claim the same vantage point." Every schedule fact here is copyable. The one uncopyable thing is withheld. That is why the design reads as a template - it has been given no person to be about.

## What's Working

1. .hero-proof is genuinely authored. 3x / 30-45 / 12 vikur answers the audience's real first question (what does this cost me in time?) not the seller's. --text-hero capped at 6.25rem specifically so that rule clears a 900px fold; lands at y~790. Trading headline scale for an evidence line is the right trade and a rare one.

2. The crest at three intensities is real identity work. 0.085 bleeding off the hero as wall texture, 2.05rem as header lockup, 0.11 on the bronze panel where it finally reads as a father holding a child - arriving at the moment of decision. One alpha-masked WebP recoloured via --crest-color, no variants shipped. Correct answer given "no photography exists."

3. Accessibility discipline unusually solid for a page this ambitious. Focus-visible outlines confirmed on nav and primary CTA; zero console errors; no aria-hidden trapping focusable children.

## Priority Issues

[P0] Every path to conversion terminates in a no-op. finalCta.cta.href = "#". Verified: clicking leaves scrollY at 5884 and smooth-scrolls back to the hero. The other five CTAs point at #hafa-samband - the section containing that dead button.
Why: PRODUCT.md Principle 2 is "lower the cost of the first step." That cost is infinite. Silence at the moment of commitment reads as "this guy isn't taking clients," not "the site is unfinished."
Fix: resolve to a working mailto: with prefilled Icelandic subject until a booking destination exists; add a visible secondary path inside .cta-panel.
Command: $impeccable harden

[P0] Placeholder facts render as live, verifiable-looking truth. tel:+3540000000 is a tappable call link. Two invented testimonials carry names and ages. "Reykjavik, Island" is the final fact while jsonLd.ts emits LocalBusiness + PostalAddress + areaServed: Hofudborgarsvaedid for a nationwide business.
Why: this audience is braced for a pitch. "First name, no photo, no link, perfect quote" is a pattern people recognise instantly - once sensed, every honest sentence gets re-read as marketing.
Fix: delete testimonials until real permissioned quotes exist. Remove the tel: link. areaServed -> Iceland, drop PostalAddress.
Command: $impeccable harden

[P0] Aron never appears. Render site.coach.bio as a named first-person section placed before Offerings. Needs no photograph - as the page's one long-form passage it breaks the five-skeleton rhythm, fills the composition hole that reads as a missing photo, and supplies the only thing a competitor cannot copy. Withhold "IAK" until confirmed.
Command: $impeccable shape

[P1] The page leads with its highest price. Offerings is section 2. On mobile the stack puts 24.900 kr/man as the first price anchor - before the visitor learns he doesn't need a gym, doesn't need to be fit, needs 30 minutes twice a week. The 9.900 nationwide core product renders in --color-text-muted at 0.875rem: the cheapest entry point is the least legible thing in the section.
Fix: move Offerings below Method and ForDads so reassurance precedes price; normalise price typography across all three tiers. Which tier is featured is the owner's business call; the typographic suppression of 9.900 is a design fix either way.
Command: $impeccable layout

[P1] No persistent conversion path on mobile. .header-cta is display:none below 900px. This audience browses at night, on a phone, in fragments - the collapsed week the product is built around. The moment of yes is unpredictable; the design catches it in two places out of 7,052px.
Command: $impeccable adapt

[P2] The FAQ buries the page's best reassurance. "Ja, einmitt tha." is the sentence this page is trying to say. It is 4,900px down, below the price, behind a click, inside an accordion that closes when you open anything else. Drop name="faq", ship the first item open.
Command: $impeccable clarify

## Persona Red Flags

Jon, 39, phone, in bed, 22:40, one hand - the most likely visitor this page will get. .hero-proof lands; 30-45 minutur is what makes him keep reading. Then .offer-layout stacks featured-first and his second screen reads "VINSAELAST - 24.900 kr/man." He does the arithmetic (~~300k/year) and concludes it isn't for people like him. The answer written directly to him is at y~~4,900, collapsed. He left at 1,200.

Bjarni, 45, burned by a PT who took his money and vanished. He hunts for the person and finds nobody - every confident first-person sentence deepens it: someone is speaking and refusing to sign their name. .quote-grid confirms his suspicion; he has seen that exact pattern before. +354 000 0000 finishes him - one of the last two things he reads.

Haukur, 42, Akureyri - the persona the business model depends on. The page never tells him it's for him. "Nationwide" appears nowhere as a claim. The featured tier says "i sal." Two of three visible options are geographically impossible for him and nothing says so. He concludes at y~1,500 that this is a Reykjavik gym - and the LocalBusiness JSON-LD told search engines the same before he clicked.

## Minor Observations

- Testimonials.astro has no h2 - the one body section missing from the document outline.
- Footer .footer-heading elements are h2, level-equal to real section headings.
- Full-page renders show a blank page - .reveal sits at opacity 0 when the viewport expands to document height. Affects print and PDF export. Needs @media print override.
- Sticky heads barely stick (165px travel) and smear under the blur(14px) header at scroll 2600.
- .desktop-nav links are 45x24px; .link-arrow.offer-row-cta is 179x41px - just under 44.
- Mobile panel has no scroll lock, no outside-click dismissal, no focus trap.
- rel="me noopener" lacks noreferrer.
- Nav labels don't match section headings - nothing confirms arrival.

## Questions to Consider

1. What if the page had no prices at all? The goal is a free chat. Pricing exists purely to trigger self-disqualification before the conversation - and the FAQ already answers it honestly for anyone who asks.
2. What if Aron wrote the whole page as a letter? The bio is the best-written text in the repo and the only text nobody can read.
3. Where is the collapsed week on this page? Every surface is immaculate. What would a design that looked like it survived a bad week be?
4. If the testimonials must go, what honest evidence replaces them? Aron's own training week - including the days it didn't happen - is more persuasive to this audience than any client quote, and it's true and available today.
5. What is "Vinsaelast" for? An unverifiable claim on the most expensive tier, on a page whose credibility depends on refusing to overclaim, promoting the product PRODUCT.md says is not the core business.
