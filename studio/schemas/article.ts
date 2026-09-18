import { defineArrayMember, defineField, defineType } from "sanity";

/**
 * A piece in the members' Fróðleikur section. Plain prose — this is the part of
 * the product Aron can keep adding to without anyone deploying anything.
 */
export const article = defineType({
  name: "article",
  title: "Fróðleikur",
  type: "document",

  fields: [
    defineField({
      name: "title",
      title: "Fyrirsögn",
      type: "string",
      validation: (Rule) => Rule.required().max(70),
    }),

    defineField({
      name: "slug",
      title: "Slóð",
      description:
        "Býr til sjálfkrafa út frá fyrirsögninni. Breyttu henni ekki eftir að greinin er birt — þá hætta gamlir hlekkir að virka.",
      type: "slug",
      options: { source: "title", maxLength: 70 },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "category",
      title: "Flokkur",
      type: "string",
      options: {
        list: [
          { title: "Að byrja", value: "ad-byrja" },
          { title: "Mataræði", value: "matarraedi" },
          { title: "Að halda áfram", value: "ad-halda-afram" },
          { title: "Tækni og æfingar", value: "taekni" },
          { title: "Svefn og endurheimt", value: "endurheimt" },
        ],
      },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "excerpt",
      title: "Stutt lýsing",
      description: "Ein setning sem birtist í listanum. Segðu hvað lesandinn fær út úr greininni.",
      type: "text",
      rows: 2,
      validation: (Rule) => Rule.required().max(180),
    }),

    defineField({
      name: "body",
      title: "Texti",
      type: "array",
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: "block",
          // Deliberately narrow. The members' area styles h2, paragraphs, lists
          // and links; anything else would render as unstyled text.
          styles: [
            { title: "Málsgrein", value: "normal" },
            { title: "Millifyrirsögn", value: "h2" },
            { title: "Tilvitnun", value: "blockquote" },
          ],
          lists: [
            { title: "Punktar", value: "bullet" },
            { title: "Númeraður listi", value: "number" },
          ],
          marks: {
            decorators: [
              { title: "Feitletrað", value: "strong" },
              { title: "Skáletrað", value: "em" },
            ],
          },
        }),
      ],
    }),
  ],

  orderings: [
    {
      name: "titleAsc",
      title: "Fyrirsögn A–Ö",
      by: [{ field: "title", direction: "asc" }],
    },
  ],

  preview: {
    select: { title: "title", subtitle: "category" },
  },
});
