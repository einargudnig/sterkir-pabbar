import { defineField, defineType } from "sanity";

/**
 * One question and answer the members' AI assistant may lean on.
 *
 * Publishing is the approval. The app reads the published perspective only, so
 * a draft — every entry imported from the handoff starts as one — is invisible
 * to the assistant until Aron has read it and clicked Publish. Unpublishing
 * takes an answer back out without anyone deploying anything.
 */
export const FAQ_TOPICS = [
  { title: "Æfingar", value: "training" },
  { title: "Næring", value: "nutrition" },
  { title: "Venjur", value: "habits" },
  { title: "Eftirfylgd", value: "coaching" },
  { title: "Vefurinn", value: "navigation" },
  { title: "Aðgangur", value: "account" },
  { title: "Greiðslur", value: "billing" },
  { title: "Þjónustuleiðir", value: "services" },
  { title: "Aðstoð", value: "support" },
  { title: "Öryggi", value: "safety" },
  { title: "Hlutverk aðstoðarmanns", value: "scope" },
] as const;

export const faqEntry = defineType({
  name: "faqEntry",
  title: "Spurningar fyrir aðstoðarmann",
  type: "document",

  fields: [
    defineField({
      name: "question",
      title: "Spurning",
      description: "Eins og meðlimur myndi orða hana.",
      type: "string",
      validation: (Rule) => Rule.required().max(160),
    }),

    defineField({
      name: "answer",
      title: "Svar",
      description:
        "Það sem aðstoðarmaðurinn byggir svarið á. Stutt og rétt — hann umorðar en bætir ekki við staðreyndum.",
      type: "text",
      rows: 5,
      validation: (Rule) => Rule.required().max(700),
    }),

    defineField({
      name: "topic",
      title: "Flokkur",
      type: "string",
      options: { list: [...FAQ_TOPICS] },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "reviewNote",
      title: "Athugasemd við yfirferð",
      description:
        "Aðeins fyrir þig. Aðstoðarmaðurinn sér þetta aldrei. Hreinsaðu hana þegar svarið er samþykkt.",
      type: "text",
      rows: 3,
    }),
  ],

  preview: {
    select: { title: "question", topic: "topic", note: "reviewNote" },
    prepare({ title, topic, note }) {
      const topicLabel = FAQ_TOPICS.find((t) => t.value === topic)?.title ?? "Enginn flokkur";

      return { title, subtitle: note ? `${topicLabel} — athugasemd` : topicLabel };
    },
  },
});
