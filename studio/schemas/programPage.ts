import { defineArrayMember, defineField, defineType } from "sanity";

import { emphasisMustBeInHeadline } from "./validators";

/**
 * The ad landing page at /programid — one document, fixed id, like `siteContent`.
 *
 * The price is deliberately NOT here. It is read from the featured tier in
 * `siteContent.offerings`, so the ad page and the homepage can never quote two
 * different prices for the same prógram.
 *
 * Testimonials and the guarantee are optional on purpose: an empty list hides
 * the section and an empty guarantee hides the line. Nothing renders until Aron
 * has put something true in it.
 */
export const programPage = defineType({
  name: "programPage",
  title: "Prógramsíðan",
  type: "document",

  groups: [
    { name: "hero", title: "Efst", default: true },
    { name: "story", title: "Aðstæður og lausn" },
    { name: "included", title: "Innifalið" },
    { name: "proof", title: "Umsagnir" },
    { name: "start", title: "Svona byrjarðu" },
    { name: "faq", title: "Spurningar" },
    { name: "close", title: "Lokakall" },
    { name: "seo", title: "Deiling" },
  ],

  fields: [
    // ──────────────────────────────── Efst ─────────────────────────────────
    defineField({
      name: "hero",
      title: "Efst á síðunni",
      type: "object",
      group: "hero",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "headline",
          title: "Fyrirsögn",
          description:
            "Loforðið: hverju pabbinn vill ná. Hámark 60 stafir svo hún brotni ekki í þrjár línur.",
          type: "string",
          validation: (Rule) => Rule.required().max(60),
        }),
        defineField({
          name: "emphasis",
          title: "Áhersluorð",
          description: "Eitt orð úr fyrirsögninni sem birtist skáletrað. Nákvæmlega eins skrifað.",
          type: "string",
          validation: (Rule) => Rule.required().custom(emphasisMustBeInHeadline),
        }),
        defineField({
          name: "sub",
          title: "Undirfyrirsögn",
          description: "Fyrir hvern þetta er og hvernig Sterkir pabbar hjálpa.",
          type: "text",
          rows: 2,
          validation: (Rule) => Rule.required().max(160),
        }),
        defineField({
          name: "ctaLabel",
          title: "Texti á skráningarhnappi",
          type: "string",
          validation: (Rule) => Rule.required().max(30),
        }),
      ],
    }),
    defineField({
      name: "guarantee",
      title: "Loforð við kaupin",
      description:
        "Birtist undir verðinu, t.d. „Engin binding. Þú getur hætt hvenær sem er.“ Skrifaðu bara það sem er satt. Autt = ekkert birtist.",
      type: "string",
      group: "hero",
      validation: (Rule) => Rule.max(80),
    }),

    // ────────────────────────── Aðstæður og lausn ──────────────────────────
    defineField({
      name: "situations",
      title: "Aðstæður sem hann þekkir",
      type: "object",
      group: "story",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Fyrirsögn",
          type: "string",
          validation: (Rule) => Rule.required().max(50),
        }),
        defineField({
          name: "points",
          title: "Punktar",
          type: "array",
          of: [defineArrayMember({ type: "string" })],
          validation: (Rule) => Rule.required().min(2).max(6),
        }),
      ],
    }),
    defineField({
      name: "solution",
      title: "Lausnin",
      type: "object",
      group: "story",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Fyrirsögn",
          type: "string",
          validation: (Rule) => Rule.required().max(60),
        }),
        defineField({
          name: "paragraphs",
          title: "Málsgreinar",
          description:
            "Ekki nefna fastan skammt (æfingar á viku, mínútur, vikufjölda) — prógramið er sniðið að hverjum og einum.",
          type: "array",
          of: [defineArrayMember({ type: "text", rows: 3 })],
          validation: (Rule) => Rule.required().min(1).max(4),
        }),
      ],
    }),

    // ────────────────────────────── Innifalið ──────────────────────────────
    defineField({
      name: "included",
      title: "Hvað er innifalið",
      type: "object",
      group: "included",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Fyrirsögn",
          type: "string",
          validation: (Rule) => Rule.required().max(50),
        }),
        defineField({
          name: "items",
          title: "Atriði",
          type: "array",
          validation: (Rule) => Rule.required().min(2).max(8),
          of: [
            defineArrayMember({
              type: "object",
              name: "includedItem",
              fields: [
                defineField({
                  name: "title",
                  title: "Heiti",
                  type: "string",
                  validation: (Rule) => Rule.required().max(40),
                }),
                defineField({
                  name: "body",
                  title: "Hvernig það hjálpar",
                  type: "text",
                  rows: 2,
                  validation: (Rule) => Rule.required().max(160),
                }),
              ],
              preview: { select: { title: "title", subtitle: "body" } },
            }),
          ],
        }),
      ],
    }),

    // ────────────────────────────── Umsagnir ───────────────────────────────
    defineField({
      name: "testimonials",
      title: "Árangur og reynsla annarra",
      description:
        "Aðeins raunverulegar umsagnir sem viðkomandi hefur leyft þér að birta. Kaflinn birtist ekki fyrr en ein umsögn er komin.",
      type: "object",
      group: "proof",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Fyrirsögn",
          type: "string",
          validation: (Rule) => Rule.required().max(50),
        }),
        defineField({
          name: "quotes",
          title: "Umsagnir",
          type: "array",
          of: [
            defineArrayMember({
              type: "object",
              name: "testimonial",
              fields: [
                defineField({
                  name: "quote",
                  title: "Umsögn",
                  type: "text",
                  rows: 4,
                  validation: (Rule) => Rule.required().max(360),
                }),
                defineField({
                  name: "name",
                  title: "Nafn",
                  type: "string",
                  validation: (Rule) => Rule.required().max(40),
                }),
                defineField({
                  name: "detail",
                  title: "Nánar",
                  description: "Valfrjálst, t.d. „þriggja barna faðir, Akureyri“.",
                  type: "string",
                  validation: (Rule) => Rule.max(60),
                }),
              ],
              preview: { select: { title: "name", subtitle: "quote" } },
            }),
          ],
          validation: (Rule) => Rule.max(6),
        }),
      ],
    }),

    // ─────────────────────────── Svona byrjarðu ────────────────────────────
    defineField({
      name: "steps",
      title: "Svona byrjarðu",
      type: "object",
      group: "start",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Fyrirsögn",
          type: "string",
          validation: (Rule) => Rule.required().max(50),
        }),
        defineField({
          name: "items",
          title: "Skref",
          description: "Númerin bætast við sjálfkrafa, í þeirri röð sem skrefin eru hér.",
          type: "array",
          validation: (Rule) => Rule.required().min(2).max(4),
          of: [
            defineArrayMember({
              type: "object",
              name: "programStep",
              fields: [
                defineField({
                  name: "title",
                  title: "Fyrirsögn skrefs",
                  type: "string",
                  validation: (Rule) => Rule.required().max(44),
                }),
                defineField({
                  name: "body",
                  title: "Texti",
                  type: "text",
                  rows: 3,
                  validation: (Rule) => Rule.required().max(200),
                }),
              ],
              preview: { select: { title: "title" } },
            }),
          ],
        }),
      ],
    }),

    // ───────────────────────────── Spurningar ──────────────────────────────
    defineField({
      name: "faq",
      title: "Algengar spurningar",
      type: "object",
      group: "faq",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Fyrirsögn",
          type: "string",
          validation: (Rule) => Rule.required().max(50),
        }),
        defineField({
          name: "items",
          title: "Spurningar",
          description: "Tími, búnaður, stuðningur, uppsögn. Fyrsta spurningin er opin.",
          type: "array",
          validation: (Rule) => Rule.required().min(1),
          of: [
            defineArrayMember({
              type: "object",
              name: "programFaqItem",
              fields: [
                defineField({
                  name: "q",
                  title: "Spurning",
                  type: "string",
                  validation: (Rule) => Rule.required().max(90),
                }),
                defineField({
                  name: "a",
                  title: "Svar",
                  type: "text",
                  rows: 4,
                  validation: (Rule) => Rule.required().max(500),
                }),
              ],
              preview: { select: { title: "q" } },
            }),
          ],
        }),
      ],
    }),

    // ────────────────────────────── Lokakall ───────────────────────────────
    defineField({
      name: "finalCta",
      title: "Lokahvatning",
      type: "object",
      group: "close",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Fyrirsögn",
          type: "string",
          validation: (Rule) => Rule.required().max(50),
        }),
        defineField({
          name: "body",
          title: "Texti",
          type: "text",
          rows: 2,
          validation: (Rule) => Rule.required().max(160),
        }),
        defineField({
          name: "ctaLabel",
          title: "Texti á hnappi",
          type: "string",
          validation: (Rule) => Rule.required().max(30),
        }),
      ],
    }),

    // ─────────────────────────────── Deiling ───────────────────────────────
    defineField({
      name: "seo",
      title: "Titill og lýsing",
      description:
        "Birtist í flipanum og þegar hlekknum er deilt. Síðan er falin leitarvélum — hún er fyrir auglýsingar.",
      type: "object",
      group: "seo",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Titill",
          type: "string",
          validation: (Rule) => Rule.required().max(70),
        }),
        defineField({
          name: "description",
          title: "Lýsing",
          type: "text",
          rows: 3,
          validation: (Rule) => Rule.required().max(160),
        }),
      ],
    }),
  ],

  preview: {
    prepare: () => ({ title: "Prógramsíðan" }),
  },
});
