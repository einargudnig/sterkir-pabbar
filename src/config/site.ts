/**
 * Single source of truth for content + business facts.
 * Drives both the visible copy AND the JSON-LD structured data,
 * so the two can never drift apart (important for AEO correctness).
 *
 * Fields marked `TODO(client)` need real values from the client before launch.
 */

export const site = {
  name: "Sterkir pabbar",
  legalName: "Sterkir pabbar", // TODO(client): official ehf./kt. name if different
  tagline: "Verðum sterkari saman",
  domain: "https://sterkirpabbar.is", // TODO(client): confirm final domain
  locale: "is_IS",
  lang: "is",

  // Short description reused in <meta description> and schema.
  description:
    "Einkaþjálfun og fjarþjálfun sniðin að pöbbum. Sérsniðið æfinga- og matarprógram, bein skilaboð til þjálfara og vikulegt check-in. Þjálfun sem passar inn í annasamt fjölskyldulíf.",

  contact: {
    email: "aron@sterkirpabbar.is",
    // Stored in full international form so the tel: link works from abroad;
    // Footer strips the spaces to produce tel:+3544567890.
    phone: "+354 456 7890" as string | null,
    // Confirmed by Aron. Not rendered anywhere — the site is online-first and
    // must not read as a capital-area gym — but it is true, so it lives here.
    city: "Mosfellsbær",
    // The business is online-first and nationwide (see PRODUCT.md). Anything
    // narrower than this tells 60% of Icelandic fathers the service isn't theirs.
    areaServed: "Ísland",
  },

  /**
   * The single destination for every call to action on the site.
   *
   * A mailto with a prefilled Icelandic subject, so the free chat is bookable
   * today with no backend. The subject is pre-written because the visitor
   * opening this is the one who has to find the words, and "Ég vil bóka
   * ókeypis spjall" is the sentence he was going to have to compose.
   *
   * TODO(client): swap for a real booking link (Calendly, Noona, a form) when
   * one exists — nothing else needs to change.
   */
  bookingUrl:
    "mailto:aron@sterkirpabbar.is?subject=%C3%89g%20vil%20b%C3%B3ka%20%C3%B3keypis%20spjall" as
      | string
      | null,

  // TODO(client): real handles — remove any that don't exist.
  social: {
    instagram: "https://instagram.com/sterkirpabbar",
    facebook: "https://facebook.com/sterkirpabbar",
  },

  // The coach behind it — feeds the Person schema + About section.
  coach: {
    name: "Aron Ingi",
    role: "Einkaþjálfari & pabbi",
    // Aron's own words, supplied by him. Do not paraphrase — this is the only
    // fully verifiable evidence on the site.
    bio: "Ég er tveggja barna faðir og Mosfellingur í húð og hár. Ég sérhæfi mig í einkaþjálfun og fjarþjálfun fyrir bæði byrjendur og lengra komna. Markmiðið er einfaldlega að koma þér í þitt besta form eða styrkjast svo þú getir verið fyrirmynd fyrir þá sem skipta þér mestu máli.",
    credentials: "ÍAK einkaþjálfari", // TODO(client): confirm real certification
  },

  priceRange: "$$", // schema hint, not shown to users

  // Build credit. Rendered once, in the footer's bottom rule — quiet enough
  // that it never competes with the client's own name above it.
  credit: {
    label: "Búið til af",
    name: "einargudni.com",
    url: "https://einargudni.com",
  },
} as const;

export const nav = [
  { label: "Aðferð", href: "#adferd" },
  { label: "Pakkar", href: "#thjalfun" },
  { label: "Spurningar", href: "#spurningar" },
] as const;

export const hero = {
  // TODO(client): this positioning line is the single most important sentence —
  // review it with the client. It should promise the outcome, not the activity.
  // Deliberately drops "Sterkari pabbi" — the brand name already says it, and
  // repeating it costs a line of the largest type on the page.
  headline: "Meiri orka. Fleiri góð ár með börnunum.",
  emphasis: "orka", // word rendered in italic serif for editorial emphasis
  sub: "Þjálfun sem passar inn í annasamt fjölskyldulíf, byggð til að þú endist.",
  // href intentionally absent: every CTA destination comes from lib/booking.ts
  primaryCta: { label: "Bókaðu ókeypis spjall" },
  secondaryCta: { label: "Sjá þjálfunarleiðir", href: "#thjalfun" },
  /**
   * The stat rail ("3× æfingar á viku · 30–45 mínútur · 12 vikur") was removed
   * at Aron's request, along with every other fixed prescription on the page.
   * Every prógram is built around the individual, so a standard weekly dose
   * stated as a headline fact contradicted the product. It also cannot be
   * replaced with a different set of numbers — there is no verified data yet.
   */
} as const;

/**
 * Two tiers, in ascending price order, both delivered online and nationwide.
 *
 * Pabbahópur and Einkaþjálfun 1:1 were removed at Aron's request. What is sold
 * on this page is a prógram: training alone, or training plus nutrition. Aron
 * still does 1:1 and fjarþjálfun (see `coachIntro`), but neither is a packaged
 * tier with a public price, so neither is listed as one.
 *
 * `featured` stays on Æfingaprógram: it is the lower-friction entry point for a
 * father who has not trained in years.
 *
 * Direct messaging and the weekly check-in are in BOTH tiers, deliberately.
 * They are not an upsell — they are what makes either prógram work.
 */
export const offerings = [
  {
    id: "program",
    name: "Æfingaprógram",
    // States availability where the visitor outside Reykjavík will actually
    // see it. Previously nothing on the page said the service reaches him.
    tag: "Um allt land",
    price: "15.900 kr/mán",
    summary:
      "Sérsniðið æfingaprógram eftir þínum markmiðum. Þú færð það í símann og æfir þegar þér hentar.",
    features: [
      "Sérsniðið æfingaprógram í appi",
      "Myndbönd fyrir hverja æfingu",
      "Bein skilaboð til mín",
      "Vikulegt check-in",
    ],
    featured: true,
  },
  {
    id: "aefinga-og-matarprogram",
    name: "Æfinga- og matarprógram",
    tag: "Allt utanumhaldið",
    price: "24.900 kr/mán",
    summary: "Þú færð sérsniðið matar- og æfingaprógram eftir þínum markmiðum.",
    features: [
      "Sérsniðið æfingaprógram í appi",
      "Sérsniðið matarprógram",
      "Bein skilaboð til mín",
      "Vikulegt check-in",
    ],
    featured: false,
  },
] as const;

/**
 * The coach section. This is the only genuinely verifiable evidence on the
 * site: Aron's own words, in the first person, with his name attached.
 *
 * Every other proof point is either provisional (pricing, credential) or absent
 * (testimonials, photography). The paragraphs below are `site.coach.bio` split
 * for long-form setting — no claim has been added to it.
 */
export const coachIntro = {
  title: "Ég heiti Aron Ingi",
  // Aron's own wording, split for long-form setting. Nothing added, nothing
  // rephrased — the first paragraph gets the brightest treatment in Coach.astro.
  paragraphs: [
    "Ég er tveggja barna faðir og Mosfellingur í húð og hár.",
    "Ég sérhæfi mig í einkaþjálfun og fjarþjálfun fyrir bæði byrjendur og lengra komna.",
    "Markmiðið er einfaldlega að koma þér í þitt besta form eða styrkjast svo þú getir verið fyrirmynd fyrir þá sem skipta þér mestu máli.",
  ],
  // Deliberately no credential line. "ÍAK einkaþjálfari" is unconfirmed, and the
  // bio is stronger evidence to this audience than a certificate would be.
} as const;

export const method = {
  title: "Enginn galdur. Bara plan sem heldur.",
  intro:
    "Flest prógrömm gera ráð fyrir að þú hafir klukkutíma á dag og enga krakka. Þetta gerir það ekki.",
  steps: [
    {
      n: "01",
      title: "Við byrjum á stöðunni þinni",
      body: "Ókeypis spjall um markmið, meiðsli og hvað þú hefur raunverulega tíma í.",
    },
    {
      n: "02",
      title: "Þú færð prógram sem passar lífinu",
      // No fixed dose here any more. The promise is that the prógram is built
      // around his week, so naming a standard week undercut it.
      body: "Sérsniðið eftir markmiðum þínum, búnaðinum sem þú hefur og þeim tíma sem þú átt í raun. Byggt til að halda þegar vikan fer úr skorðum.",
    },
    {
      n: "03",
      title: "Við aðlögum eftir því sem þú styrkist",
      body: "Vikulegt check-in og bein skilaboð til mín þess á milli. Þú segir mér hvernig gengur og ég stilli af. Framvinda, ekki stöðnun.",
    },
  ],
} as const;

export const forDads = {
  title: "Því þú ert fyrirmyndin — hvort sem þú ætlar það eða ekki",
  points: [
    "Orka til að vera til staðar eftir langan dag.",
    "Bak og hné sem þola að lyfta, bera og elta.",
    "Börnin læra af þér að hreyfing sé sjálfsögð.",
    "Hraustur pabbi núna, hraustur afi seinna.",
  ],
} as const;

/**
 * Testimonials were removed deliberately, not lost.
 *
 * The two that lived here ("Gunnar", "Kristján") were invented placeholders
 * rendered as genuine client quotes. To an audience that arrives braced for a
 * sales pitch, an unverifiable testimonial does not read as neutral — it reads
 * as manufactured, and it retroactively contaminates the FAQ and the method,
 * which are honest.
 *
 * TODO(client): reinstate only with real, permissioned quotes. Until then the
 * coach's own first-person section carries the credibility load, because it is
 * the one piece of evidence on this site that is actually true.
 */

export const faq = [
  {
    q: "Ég hef varla æft í mörg ár — er þetta fyrir mig?",
    a: "Já, einmitt þá. Flestir sem byrja hjá mér hafa ekki æft reglulega í langan tíma. Við byrjum þar sem þú ert og byggjum upp hægt og örugglega. Engin þörf á að vera í formi fyrir fram.",
  },
  {
    q: "Hvað þarf ég að hafa mikinn tíma?",
    a: "Prógrammið er byggt í kringum þann tíma sem þú átt í raun og veru. Við förum yfir vikuna þína í ókeypis spjalli og sníðum æfingarnar að henni — ekki öfugt.",
  },
  {
    q: "Þarf ég að vera með aðgang að líkamsræktarstöð?",
    a: "Nei. Ég byggi prógrammið í kringum þann búnað sem þú hefur, hvort sem það er full stöð, lítið heimatæki eða bara líkamsþyngd og teygjur.",
  },
  {
    q: "Hver er munurinn á prógrömmunum tveimur?",
    a: "Í æfingaprógrammi færðu sérsniðið æfingaprógram í símann. Í æfinga- og matarprógrammi bætist sérsniðið matarprógram við. Í báðum ertu í beinu sambandi við mig og við tökum vikulegt check-in.",
  },
  {
    // Aron's bio says he specialises in einkaþjálfun as well as fjarþjálfun,
    // but 1:1 is no longer a packaged tier with a public price. This answers
    // the question that gap creates without inventing a number.
    q: "Býðurðu upp á einkaþjálfun?",
    a: "Já. Ég sérhæfi mig í bæði einkaþjálfun og fjarþjálfun, fyrir byrjendur og lengra komna. Hafðu samband og við finnum út hvað hentar þér best.",
  },
  {
    q: "Hvað kostar þetta?",
    a: "Æfingaprógram kostar 15.900 kr á mánuði og æfinga- og matarprógram 24.900 kr á mánuði. Í báðum eru bein skilaboð til mín og vikulegt check-in innifalin. Við finnum leiðina sem passar þér í ókeypis spjalli.",
  },
] as const;

export const finalCta = {
  title: "Byrjum á spjalli — það kostar ekkert",
  body: "Fimmtán mínútur, engin skuldbinding. Við förum yfir hvar þú ert og hvert þú vilt fara.",
  cta: { label: "Bókaðu ókeypis spjall" }, // destination: site.bookingUrl
} as const;
