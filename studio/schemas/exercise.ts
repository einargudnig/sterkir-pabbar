import { defineField, defineType } from "sanity";

import { videoUrlMustBeEmbeddable } from "./validators";

/**
 * Also the folders under "Æfingar" in the Studio sidebar (see sanity.config.ts),
 * so an exercise lives in exactly one folder and a new one made inside a folder
 * starts with that group chosen.
 */
export const MUSCLE_GROUPS = [
  { title: "Fætur", value: "faetur" },
  { title: "Bak", value: "bak" },
  { title: "Bringa", value: "bringa" },
  { title: "Axlir", value: "axlir" },
  { title: "Handleggir", value: "handleggir" },
  { title: "Kviður og kjarni", value: "kjarni" },
  { title: "Allur líkaminn", value: "allur" },
];

/**
 * One exercise, reused across training plans. Aron writes each one once and
 * refers to it from every plan that uses it, so fixing a cue or swapping a
 * video updates everywhere at once.
 */
export const exercise = defineType({
  name: "exercise",
  title: "Æfing",
  type: "document",

  fields: [
    defineField({
      name: "name",
      title: "Heiti æfingar",
      description: "Eins og þú myndir segja það upphátt. T.d. „Hnébeygja“.",
      type: "string",
      validation: (Rule) => Rule.required().max(60),
    }),

    defineField({
      name: "muscleGroup",
      title: "Vöðvahópur",
      description: "Ræður í hvaða möppu æfingin lendir undir „Æfingar“ hér í Studio.",
      type: "string",
      options: { list: MUSCLE_GROUPS },
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "cue",
      title: "Ábending",
      description:
        "Eitt atriði sem skiptir mestu máli svo æfingin sé gerð rétt. Sleppt ef myndbandið segir allt sem segja þarf. Hámark 140 stafir — þetta er lesið standandi á milli setta.",
      type: "text",
      rows: 2,
      validation: (Rule) => Rule.max(140),
    }),

    defineField({
      name: "videoUrl",
      title: "Myndband",
      description:
        "Slóð á óskráð (unlisted) myndband á Vimeo eða YouTube. Æfingin birtist meðlimum þótt myndband vanti — þá stendur „Myndband kemur“.",
      type: "url",
      validation: (Rule) => Rule.custom(videoUrlMustBeEmbeddable),
    }),
  ],

  preview: {
    select: { title: "name", subtitle: "muscleGroup", video: "videoUrl" },
    prepare({ title, subtitle, video }) {
      return {
        title,
        // Surfaces the missing-video backlog at a glance, which is the single
        // thing standing between a finished build and a launchable product.
        subtitle: video ? subtitle : `${subtitle} — myndband vantar`,
      };
    },
  },
});
