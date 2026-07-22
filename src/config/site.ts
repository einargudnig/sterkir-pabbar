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
    "Persónuleg þjálfun og æfingaprógrömm sniðin að pöbbum. Meiri orka, minni verkir og styrkur til að endast — þjálfun sem passar inn í annasamt fjölskyldulíf.",

  contact: {
    email: "hae@sterkirpabbar.is", // TODO(client)
    phone: "+354 000 0000", // TODO(client)
    city: "Reykjavík", // TODO(client): where training happens / area served
    areaServed: "Höfuðborgarsvæðið",
  },

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
  kicker: "Þjálfun fyrir pabba",
  // TODO(client): this positioning line is the single most important sentence —
  // review it with the client. It should promise the outcome, not the activity.
  headline: "Sterkari pabbi. Meiri orka. Fleiri góð ár með börnunum.",
  emphasis: "orka", // word rendered in italic serif for editorial emphasis
  sub: "Persónuleg þjálfun og prógrömm sem passa inn í annasamt fjölskyldulíf — hönnuð til að þú endist, ekki bara í sumar heldur næstu tuttugu árin.",
  primaryCta: { label: "Bókaðu ókeypis spjall", href: "#hafa-samband" },
  secondaryCta: { label: "Sjá þjálfunarleiðir", href: "#thjalfun" },
  proof: [
    { value: "3×", label: "æfingar á viku, 30–45 mín" },
    { value: "12 vikur", label: "að finna raunverulegan mun" },
    { value: "0", label: "flækjustig — ég sé um planið" },
  ],
} as const;

export const offerings = [
  {
    id: "program",
    name: "Æfingaprógram",
    tag: "Sjálfstætt",
    price: "frá 9.900 kr/mán",
    summary:
      "Prógram sniðið að þínum markmiðum, búnaði og tíma. Þú færð það í símann og æfir þegar þér hentar.",
    features: [
      "Vikulegt prógram í appi",
      "Myndbönd fyrir hverja æfingu",
      "Aðlagað eftir framvindu",
    ],
    featured: false,
  },
  {
    id: "einka",
    name: "Einkaþjálfun 1:1",
    tag: "Vinsælast",
    price: "frá 24.900 kr/mán",
    summary:
      "Við æfum saman — í sal eða á netinu. Þú mætir, ég sé um afganginn: plan, tækni og að halda þér við efnið.",
    features: [
      "Vikulegir tímar með þjálfara",
      "Persónulegt prógram + næring",
      "Bein skilaboð milli tíma",
    ],
    featured: true,
  },
  {
    id: "hopur",
    name: "Pabbahópur",
    tag: "Saman",
    price: "frá 14.900 kr/mán",
    summary:
      "Lítill hópur pabba sem æfa saman á föstum tímum. Aðhald, félagsskapur og gott grín með puðinu.",
    features: [
      "2 tímar í viku í litlum hóp",
      "Fastir tímar — bókað fyrirfram",
      "Sami hópur, raunverulegt aðhald",
    ],
    featured: false,
  },
] as const;

export const method = {
  kicker: "Aðferðin",
  title: "Enginn galdur. Bara plan sem heldur.",
  intro:
    "Flest prógrömm gera ráð fyrir að þú hafir klukkutíma á dag og enga krakka. Þetta gerir það ekki.",
  steps: [
    {
      n: "01",
      title: "Við byrjum á stöðunni þinni",
      body: "Ókeypis spjall þar sem við förum yfir markmið, sögu, meiðsli og hvað þú hefur raunverulega tíma í. Ekkert plan án þess.",
    },
    {
      n: "02",
      title: "Þú færð plan sem passar lífinu",
      body: "Stutt, markviss prógram — oftast 30–45 mínútur, 2–3 sinnum í viku. Byggð þannig að þú getir haldið þeim gangandi þegar vikan fer úr skorðum.",
    },
    {
      n: "03",
      title: "Við aðlögum eftir því sem þú styrkist",
      body: "Þú sendir mér hvernig gengur og ég stilli af. Enginn er skilinn eftir með sama planið í hálft ár. Framvinda, ekki stöðnun.",
    },
  ],
} as const;

export const forDads = {
  kicker: "Af hverju pabbar",
  title: "Því þú ert fyrirmyndin — hvort sem þú ætlar það eða ekki",
  points: [
    "Orka til að vera til staðar eftir langan dag, ekki búinn á því klukkan sex.",
    "Bakið og hnén þola að lyfta, bera og elta án þess að gefa sig.",
    "Þú kennir börnunum að hreyfing sé sjálfsögð með því að lifa henni.",
    "Þú fjárfestir í árunum — að vera hraustur pabbi og seinna hraustur afi.",
  ],
} as const;

export const testimonials = [
  {
    quote:
      "Ég hélt ég hefði ekki tíma. Sannleikurinn var að ég hafði ekki plan. Núna æfi ég þrisvar í viku og hef meiri orku fyrir strákana en í mörg ár.",
    name: "Gunnar", // TODO(client): real testimonials with permission
    detail: "Tveggja barna pabbi, 41 árs",
  },
  {
    quote:
      "Bakverkirnir sem ég hélt væru bara „aldurinn“ eru horfnir. Þetta snerist aldrei um að verða massaður — bara um að endast.",
    name: "Kristján",
    detail: "Þriggja barna pabbi, 47 ára",
  },
] as const;

export const faq = [
  {
    q: "Ég hef varla æft í mörg ár — er þetta fyrir mig?",
    a: "Já, einmitt þá. Flestir sem byrja hjá mér hafa ekki æft reglulega í langan tíma. Við byrjum þar sem þú ert og byggjum upp hægt og örugglega — engin þörf á að vera í formi fyrir fram.",
  },
  {
    q: "Hvað þarf ég að hafa mikinn tíma?",
    a: "Flest prógrömm eru 30–45 mínútur, tvisvar til þrisvar í viku. Þau eru hönnuð til að passa inn í annasama viku, ekki taka hana yfir.",
  },
  {
    q: "Þarf ég að vera með aðgang að líkamsræktarstöð?",
    a: "Nei. Ég byggi prógrammið í kringum þann búnað sem þú hefur — hvort sem það er full stöð, lítið heimatæki eða bara líkamsþyngd og teygjur.",
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
  kicker: "Fyrsta skrefið",
  title: "Byrjum á spjalli — það kostar ekkert",
  body: "Fimmtán mínútur, engin skuldbinding. Við förum yfir hvar þú ert, hvert þú vilt fara og hvort þetta sé rétta leiðin fyrir þig.",
  cta: { label: "Bókaðu ókeypis spjall", href: "#" }, // TODO(client): booking link / form
} as const;
