import { defineArrayMember, defineField, defineType } from "sanity";

import { emphasisMustBeInHeadline, priceMustBeMachineReadable } from "./validators";

/**
 * Every `title`/`description` below is Icelandic on purpose. The Studio chrome
 * (Publish, Search, the menus) is English and cannot be translated, but every
 * word Aron actually reads while editing is his own language.
 *
 * The character limits are the fence. This page went through a design critique
 * pass; a 90-character headline set in the largest type on the site wraps to
 * three lines and undoes it. Limits are set just above the current copy, so
 * there is room to rewrite but not room to wreck the layout.
 */
export const siteContent = defineType({
  name: "siteContent",
  title: "Efni síðunnar",
  type: "document",

  groups: [
    { name: "hero", title: "Forsíðutexti", default: true },
    { name: "packages", title: "Pakkar" },
    { name: "method", title: "Aðferðin" },
    { name: "forDads", title: "Fyrir pabba" },
    { name: "coach", title: "Um mig" },
    { name: "faq", title: "Spurningar" },
    { name: "finalCta", title: "Lokakall" },
    { name: "contact", title: "Almennt og tengiliðir" },
  ],

  fields: [
    // ───────────────────────────── Forsíðutexti ─────────────────────────────
    defineField({
      name: "hero",
      title: "Forsíðutexti",
      type: "object",
      group: "hero",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "headline",
          title: "Aðalfyrirsögn",
          description:
            "Stærsti textinn á síðunni. Lofaðu útkomunni, ekki æfingunum. Hámark 60 stafir svo fyrirsögnin brotni ekki í þrjár línur.",
          type: "string",
          validation: (Rule) => Rule.required().max(60),
        }),
        defineField({
          name: "emphasis",
          title: "Áhersluorð",
          description:
            "Eitt orð úr fyrirsögninni hér að ofan sem birtist skáletrað. Verður að vera nákvæmlega eins skrifað og í fyrirsögninni.",
          type: "string",
          validation: (Rule) => Rule.required().custom(emphasisMustBeInHeadline),
        }),
        defineField({
          name: "sub",
          title: "Undirtexti",
          description: "Ein setning undir fyrirsögninni.",
          type: "text",
          rows: 2,
          validation: (Rule) => Rule.required().max(110),
        }),
        defineField({
          name: "primaryCtaLabel",
          title: "Texti á aðalhnappi",
          type: "string",
          validation: (Rule) => Rule.required().max(30),
        }),
        defineField({
          name: "secondaryCtaLabel",
          title: "Texti á aukatengli",
          description: "Tengillinn sem rennir niður á pakkana.",
          type: "string",
          validation: (Rule) => Rule.required().max(30),
        }),
      ],
    }),

    // ─────────────────────────────── Pakkar ────────────────────────────────
    defineField({
      name: "offeringsTitle",
      title: "Fyrirsögn pakkakaflans",
      type: "string",
      group: "packages",
      validation: (Rule) => Rule.required().max(50),
    }),
    defineField({
      name: "offeringsLead",
      title: "Inngangur pakkakaflans",
      type: "text",
      rows: 2,
      group: "packages",
      validation: (Rule) => Rule.required().max(160),
    }),
    defineField({
      name: "offerings",
      title: "Pakkar",
      description:
        "Verðin hér birtast líka í leitarniðurstöðum Google, svo formið á verðinu skiptir máli. Nákvæmlega einn pakki á að vera merktur „Mælt með“.",
      type: "array",
      group: "packages",
      validation: (Rule) =>
        Rule.required()
          .min(1)
          .custom((offerings?: { featured?: boolean }[]) => {
            const featured = (offerings ?? []).filter((o) => o?.featured);
            if (featured.length !== 1) {
              return `Nákvæmlega einn pakki á að vera merktur „Mælt með“ — núna eru þeir ${featured.length}.`;
            }
            return true;
          }),
      of: [
        defineArrayMember({
          type: "object",
          name: "offering",
          fields: [
            defineField({
              name: "name",
              title: "Heiti pakkans",
              type: "string",
              validation: (Rule) => Rule.required().max(40),
            }),
            defineField({
              name: "tag",
              title: "Merki",
              description: "Stutt merki fyrir ofan heitið, t.d. „Um allt land“.",
              type: "string",
              validation: (Rule) => Rule.required().max(24),
            }),
            defineField({
              name: "price",
              title: "Verð",
              description: "Nákvæmlega á forminu „15.900 kr/mán“.",
              type: "string",
              validation: (Rule) => Rule.required().custom(priceMustBeMachineReadable),
            }),
            defineField({
              name: "summary",
              title: "Lýsing",
              type: "text",
              rows: 3,
              validation: (Rule) => Rule.required().max(140),
            }),
            defineField({
              name: "features",
              title: "Það sem er innifalið",
              type: "array",
              of: [defineArrayMember({ type: "string" })],
              validation: (Rule) => Rule.required().min(1).max(6),
            }),
            defineField({
              name: "featured",
              title: "Mælt með þessum pakka",
              description: "Pakkinn sem fær stóra rammann. Aðeins einn í einu.",
              type: "boolean",
              initialValue: false,
            }),
          ],
          preview: {
            select: { title: "name", subtitle: "price" },
          },
        }),
      ],
    }),

    // ────────────────────────────── Aðferðin ───────────────────────────────
    defineField({
      name: "method",
      title: "Aðferðin",
      type: "object",
      group: "method",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Fyrirsögn",
          type: "string",
          validation: (Rule) => Rule.required().max(50),
        }),
        defineField({
          name: "intro",
          title: "Inngangur",
          type: "text",
          rows: 2,
          validation: (Rule) => Rule.required().max(160),
        }),
        defineField({
          name: "steps",
          title: "Skref",
          description: "Númerin birtast eins og þú skrifar þau, t.d. „01“.",
          type: "array",
          validation: (Rule) => Rule.required().min(2).max(4),
          of: [
            defineArrayMember({
              type: "object",
              name: "step",
              fields: [
                defineField({
                  name: "n",
                  title: "Númer",
                  type: "string",
                  validation: (Rule) => Rule.required().max(2),
                }),
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
                  validation: (Rule) => Rule.required().max(220),
                }),
              ],
              preview: { select: { title: "title", subtitle: "n" } },
            }),
          ],
        }),
      ],
    }),

    // ───────────────────────────── Fyrir pabba ─────────────────────────────
    defineField({
      name: "forDads",
      title: "Fyrir pabba",
      type: "object",
      group: "forDads",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Fyrirsögn",
          type: "string",
          validation: (Rule) => Rule.required().max(80),
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

    // ─────────────────────────────── Um mig ────────────────────────────────
    defineField({
      name: "coachIntro",
      title: "Um mig",
      description:
        "Þetta er eini kaflinn á síðunni sem er sannanlegur — þín eigin orð, í fyrstu persónu. Fyrsta málsgreinin fær stærsta letrið.",
      type: "object",
      group: "coach",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "title",
          title: "Fyrirsögn",
          type: "string",
          validation: (Rule) => Rule.required().max(50),
        }),
        defineField({
          name: "paragraphs",
          title: "Málsgreinar",
          type: "array",
          of: [defineArrayMember({ type: "text", rows: 3 })],
          validation: (Rule) => Rule.required().min(1).max(5),
        }),
      ],
    }),

    // ───────────────────────────── Spurningar ──────────────────────────────
    defineField({
      name: "faqTitle",
      title: "Fyrirsögn spurningakaflans",
      type: "string",
      group: "faq",
      validation: (Rule) => Rule.required().max(50),
    }),
    defineField({
      name: "faq",
      title: "Algengar spurningar",
      description:
        "Þessar spurningar birtast líka sem FAQ í leitarniðurstöðum Google. Fyrsta spurningin er opin þegar síðan hleðst.",
      type: "array",
      group: "faq",
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: "object",
          name: "faqItem",
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

    // ────────────────────────────── Lokakall ───────────────────────────────
    defineField({
      name: "finalCta",
      title: "Lokakall",
      type: "object",
      group: "finalCta",
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

    // ──────────────────────── Almennt og tengiliðir ────────────────────────
    defineField({
      name: "general",
      title: "Almennt",
      type: "object",
      group: "contact",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "tagline",
          title: "Slagorð",
          type: "string",
          validation: (Rule) => Rule.required().max(40),
        }),
        defineField({
          name: "description",
          title: "Lýsing fyrir Google",
          description:
            "Textinn sem birtist undir titlinum í leitarniðurstöðum. 140–160 stafir er kjörlengd.",
          type: "text",
          rows: 3,
          validation: (Rule) => Rule.required().min(70).max(160),
        }),
      ],
    }),
    defineField({
      name: "contact",
      title: "Tengiliðaupplýsingar",
      type: "object",
      group: "contact",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "email",
          title: "Netfang",
          type: "string",
          validation: (Rule) => Rule.required().email(),
        }),
        defineField({
          name: "phone",
          title: "Símanúmer",
          description:
            "Á alþjóðlegu formi, t.d. „+354 456 7890“. Skildu eftir autt ef þú vilt ekki birta símanúmer — þá hverfur það af síðunni.",
          type: "string",
        }),
        defineField({
          name: "city",
          title: "Bær",
          description:
            "Birtist hvergi á síðunni, en er geymt hér svo það sé rétt ef við þurfum það síðar.",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "coach",
      title: "Þjálfarinn",
      type: "object",
      group: "contact",
      options: { collapsible: false },
      fields: [
        defineField({
          name: "name",
          title: "Nafn",
          type: "string",
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: "role",
          title: "Titill",
          type: "string",
          validation: (Rule) => Rule.required().max(40),
        }),
        defineField({
          name: "bio",
          title: "Stutt lýsing",
          description:
            "Notuð í leitarniðurstöðum og af gervigreindarleitarvélum. Ekki sýnileg á síðunni sjálfri — kaflinn „Um mig“ sér um það.",
          type: "text",
          rows: 4,
          validation: (Rule) => Rule.required().max(400),
        }),
        defineField({
          name: "credentials",
          title: "Menntun eða réttindi",
          type: "string",
        }),
      ],
    }),
    defineField({
      name: "social",
      title: "Samfélagsmiðlar",
      description: "Skildu eftir autt ef reikningurinn er ekki til.",
      type: "object",
      group: "contact",
      options: { collapsible: false },
      fields: [
        defineField({ name: "instagram", title: "Instagram", type: "url" }),
        defineField({ name: "facebook", title: "Facebook", type: "url" }),
      ],
    }),
  ],

  preview: {
    prepare: () => ({ title: "Efni síðunnar" }),
  },
});
