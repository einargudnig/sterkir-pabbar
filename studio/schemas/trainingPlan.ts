import { defineArrayMember, defineField, defineType } from "sanity";

import { planCombinationMustBeUnique } from "./validators";

/**
 * A training plan, looked up by the two answers a member gives in onboarding:
 * goal + how often they can train.
 *
 * The app finds a plan by querying for that exact pair, so the pair has to
 * identify exactly one published plan — see `planCombinationMustBeUnique`.
 *
 * Publishing is also how Aron controls launch scope. The onboarding wizard only
 * offers frequencies that have a published plan behind them, so he can go live
 * with 3x/week alone and add 2x and 4x as he films them. Nothing needs deploying
 * when he does.
 */
export const trainingPlan = defineType({
  name: "trainingPlan",
  title: "Æfingaplan",
  type: "document",

  fields: [
    defineField({
      name: "title",
      title: "Heiti plans",
      description: "Sést efst hjá meðlimnum. T.d. „Þrisvar í viku — fitutap“.",
      type: "string",
      validation: (Rule) => Rule.required().max(60),
    }),

    defineField({
      name: "goal",
      title: "Markmið",
      description: "Hvort planið er fyrir þá sem vilja léttast eða þyngjast.",
      type: "string",
      options: {
        list: [
          { title: "Fitutap", value: "fitutap" },
          { title: "Vöðvauppbygging", value: "vodvauppbygging" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required().custom(planCombinationMustBeUnique),
    }),

    defineField({
      name: "sessionsPerWeek",
      title: "Æfingar í viku",
      description:
        "Hversu oft í viku þetta plan gerir ráð fyrir. Meðlimir sjá aðeins þær tíðnir sem eiga birt plan.",
      type: "number",
      options: {
        list: [1, 2, 3, 4, 5],
        layout: "radio",
      },
      validation: (Rule) => Rule.required().integer().min(1).max(5),
    }),

    defineField({
      name: "intro",
      title: "Inngangur",
      description:
        "Ein til tvær setningar til meðlimsins um planið. Ekki setja inn tímaramma eða fjölda vikna — það stangast á við það sem stendur á síðunni.",
      type: "text",
      rows: 3,
      validation: (Rule) => Rule.max(220),
    }),

    defineField({
      name: "sessions",
      title: "Æfingadagar",
      description: "Einn hlutur fyrir hvern æfingadag. Fjöldinn á að stemma við „Æfingar í viku“.",
      type: "array",
      validation: (Rule) => Rule.required().min(1),
      of: [
        defineArrayMember({
          type: "object",
          name: "session",
          title: "Æfingadagur",
          fields: [
            defineField({
              name: "title",
              title: "Heiti dags",
              description: "T.d. „Dagur A — neðri hluti“.",
              type: "string",
              validation: (Rule) => Rule.required().max(60),
            }),

            defineField({
              name: "exercises",
              title: "Æfingar dagsins",
              type: "array",
              validation: (Rule) => Rule.required().min(1),
              of: [
                defineArrayMember({
                  type: "object",
                  name: "planExercise",
                  title: "Æfing í plani",
                  fields: [
                    defineField({
                      name: "exercise",
                      title: "Æfing",
                      type: "reference",
                      to: [{ type: "exercise" }],
                      validation: (Rule) => Rule.required(),
                    }),

                    defineField({
                      name: "sets",
                      title: "Sett",
                      type: "number",
                      validation: (Rule) => Rule.required().integer().min(1).max(10),
                    }),

                    defineField({
                      name: "reps",
                      title: "Endurtekningar",
                      description:
                        "Texti, ekki tala — svo „8–10“, „30 sek“ og „10 á hvorn fót“ séu öll leyfileg.",
                      type: "string",
                      validation: (Rule) => Rule.required().max(24),
                    }),

                    defineField({
                      name: "note",
                      title: "Athugasemd",
                      description:
                        "Valkvætt. Eitthvað sem á við um þessa æfingu í þessu plani sérstaklega.",
                      type: "string",
                      validation: (Rule) => Rule.max(140),
                    }),
                  ],
                  preview: {
                    select: {
                      title: "exercise.name",
                      sets: "sets",
                      reps: "reps",
                    },
                    prepare({ title, sets, reps }) {
                      return {
                        title: title ?? "Æfing ekki valin",
                        subtitle: sets && reps ? `${sets} × ${reps}` : undefined,
                      };
                    },
                  },
                }),
              ],
            }),
          ],
          preview: {
            select: { title: "title", exercises: "exercises" },
            prepare({ title, exercises }) {
              const count = Array.isArray(exercises) ? exercises.length : 0;

              return { title, subtitle: `${count} æfingar` };
            },
          },
        }),
      ],
    }),
  ],

  preview: {
    select: { title: "title", goal: "goal", frequency: "sessionsPerWeek" },
    prepare({ title, goal, frequency }) {
      const goalLabel = goal === "fitutap" ? "Fitutap" : "Vöðvauppbygging";

      return { title, subtitle: `${goalLabel} · ${frequency}× í viku` };
    },
  },
});
