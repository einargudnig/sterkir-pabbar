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
    "Persónuleg þjálfun og æfingaprógrömm sniðin að pöbbum. Meiri orka, minni verkir og styrkur til að endast. Þjálfun sem passar inn í annasamt fjölskyldulíf.",

  contact: {
    email: "aron@sterkirpabbar.is",
    // Stored in full international form so the tel: link works from abroad;
    // Footer strips the spaces to produce tel:+3544567890.
    phone: "+354 456 7890" as string | null,
    city: "Reykjavík", // TODO(client)
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
    // TODO(client): confirm/expand bio with Aron — first person, warm.
    bio: "Ég heiti Aron Ingi, er pabbi og einkaþjálfari. Ég veit hvað það er að þjálfa í kringum svefnlausar nætur, vinnu og fjölskyldu — því byggi ég prógrömm sem virka í alvöru lífi, ekki bara á blaði. Markmiðið er einfalt: að við verðum sterkari saman.",
    credentials: "ÍAK einkaþjálfari", // TODO(client): confirm real certification
  },

  priceRange: "$$", // schema hint, not shown to users
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
  proof: [
    { value: "3×", label: "æfingar á viku" },
    { value: "30–45", label: "mínútur í senn" },
    { value: "12 vikur", label: "að finna mun" },
  ],
} as const;

/**
 * Order is the price ladder: the featured entry point first, then ascending.
 *
 * `featured` moved from Einkaþjálfun to Æfingaprógram. The 1:1 tier was taking
 * the large panel and the primary button, which put the most expensive,
 * capital-area-flavoured option in front of a father who has not trained in
 * years — and demoted the app-delivered programs that are, per PRODUCT.md, the
 * main business and the only tier available outside Reykjavík.
 *
 * Every tag is now true by construction rather than a claim about popularity.
 */
export const offerings = [
  {
    id: "program",
    name: "Æfingaprógram",
    // States availability where the visitor outside Reykjavík will actually
    // see it. Previously nothing on the page said the service reaches him.
    tag: "Um allt land",
    price: "frá 9.900 kr/mán",
    summary: "Prógram sniðið að þér. Þú færð það í símann og æfir þegar þér hentar.",
    features: [
      "Vikulegt prógram í appi",
      "Myndbönd fyrir hverja æfingu",
      "Aðlagað eftir framvindu",
    ],
    featured: true,
  },
  {
    id: "hopur",
    name: "Pabbahópur",
    // Says plainly that this one is in person, so nobody outside the capital
    // area works out too late that two of three options were never available.
    tag: "Á staðnum",
    price: "frá 14.900 kr/mán",
    summary: "Lítill hópur pabba á föstum tímum. Aðhald, félagsskapur og gott grín.",
    features: [
      "2 tímar í viku í litlum hóp",
      "Fastir tímar, bókað fyrirfram",
      "Sami hópur, raunverulegt aðhald",
    ],
    featured: false,
  },
  {
    id: "einka",
    name: "Einkaþjálfun 1:1",
    // Was "Vinsælast" — an unverifiable claim on the most expensive tier, on a
    // page whose credibility depends on refusing to overclaim. This one is true
    // by construction: it is the tier with the most contact.
    tag: "Mest aðhald",
    price: "frá 24.900 kr/mán",
    summary: "Við æfum saman, í sal eða á netinu. Þú mætir, ég sé um afganginn.",
    features: [
      "Vikulegir tímar með þjálfara",
      "Persónulegt prógram + næring",
      "Bein skilaboð milli tíma",
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
  paragraphs: [
    "Ég er pabbi og einkaþjálfari. Ég veit hvað það er að þjálfa í kringum svefnlausar nætur, vinnu og fjölskyldu.",
    "Þess vegna byggi ég prógrömm sem virka í alvöru lífi, ekki bara á blaði. Markmiðið er einfalt: að við verðum sterkari saman.",
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
      title: "Þú færð plan sem passar lífinu",
      body: "Stutt og markviss: 30–45 mínútur, 2–3 sinnum í viku. Byggt til að halda þegar vikan fer úr skorðum.",
    },
    {
      n: "03",
      title: "Við aðlögum eftir því sem þú styrkist",
      body: "Þú segir mér hvernig gengur og ég stilli af. Framvinda, ekki stöðnun.",
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
    a: "Flest prógrömm eru 30–45 mínútur, tvisvar til þrisvar í viku. Þau eru hönnuð til að passa inn í annasama viku, ekki taka hana yfir.",
  },
  {
    q: "Þarf ég að vera með aðgang að líkamsræktarstöð?",
    a: "Nei. Ég byggi prógrammið í kringum þann búnað sem þú hefur, hvort sem það er full stöð, lítið heimatæki eða bara líkamsþyngd og teygjur.",
  },
  {
    q: "Æfum við saman eða fæ ég plan til að fylgja?",
    a: "Bæði er í boði. Í einkaþjálfun æfum við saman (í sal eða á netinu). Í æfingaprógrammi færðu planið í símann og æfir sjálfur, með aðhaldi frá mér.",
  },
  {
    q: "Hvað kostar þetta?",
    a: "Æfingaprógram byrja í 9.900 kr á mánuði, pabbahópur í 14.900 kr og einkaþjálfun 1:1 í 24.900 kr. Við finnum leiðina sem passar þér í ókeypis spjalli.",
  },
] as const;

export const finalCta = {
  title: "Byrjum á spjalli — það kostar ekkert",
  body: "Fimmtán mínútur, engin skuldbinding. Við förum yfir hvar þú ert og hvert þú vilt fara.",
  cta: { label: "Bókaðu ókeypis spjall" }, // destination: site.bookingUrl
} as const;
