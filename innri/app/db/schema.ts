import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  ACTIVITY_VALUES,
  EQUIPMENT_VALUES,
  EXPERIENCE_VALUES,
  GOAL_VALUES,
  SEX_VALUES,
} from "~/lib/onboarding";

/**
 * Schema for the members' area. This file is the only place database columns
 * are described — the app's types come from here, never from hand-written
 * interfaces. See docs/solutions/inner-circle.md.
 *
 * Three tables are append-only on purpose: `onboarding`, `macroTargets` and
 * `planAssignments`. A member who changes their weight or their goal gets a new
 * row rather than an edit, so the inputs that produced a past target are still
 * there. That matters because these are health numbers: "why did the app tell
 * me 1,800 kcal in October" has to be answerable.
 */

/**
 * Repeat's states, not Kling's. Repeat has no `past_due`: a subscription stays
 * active through the retry window until one of Aron's failure rules deactivates
 * it, and a free first period is an ordinary active subscription whose first
 * charge is later. So there is nothing for `trialing` or `past_due` to mean.
 */
export const subscriptionStatus = pgEnum("subscription_status", ["active", "paused", "canceled"]);

export const goal = pgEnum("goal", GOAL_VALUES);

export const activityLevel = pgEnum("activity_level", ACTIVITY_VALUES);

export const equipment = pgEnum("equipment", EQUIPMENT_VALUES);

export const experience = pgEnum("experience", EXPERIENCE_VALUES);

/**
 * Needed because Mifflin-St Jeor has separate male and female constants.
 *
 * `annad` has no constant of its own, so the macro calculation has to decide
 * what to do with it — that decision belongs with the rest of the formula, and
 * it is Einar's to make alongside the calorie floor. Recording it honestly here
 * is better than forcing a binary answer in the questionnaire.
 */
export const sex = pgEnum("sex", SEX_VALUES);

/**
 * One row per Clerk user. Clerk owns identity; this table owns everything about
 * that person the app needs to answer quickly — above all whether they are
 * currently paid up.
 *
 * The subscription columns are a MIRROR of Repeat, written only from Repeat's
 * own API — the webhook and the reconciliation job both re-fetch the
 * subscription rather than trusting a pushed body. `requireActiveAccess` reads
 * them and never calls Repeat: access stays fast, keeps working through a
 * Repeat outage, and the customer list is ours.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email"),

    subscriptionStatus: subscriptionStatus("subscription_status"),
    repeatSubscriptionId: text("repeat_subscription_id"),

    /**
     * The moment access lapses unless the next sync extends it. Null means the
     * member has never subscribed. Access is `currentPeriodEnd > now()` AND
     * status `active` — see `app/lib/access.ts`, and `toMirror` in
     * `app/lib/repeat.ts` for how Repeat's fields become this date.
     */
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),

    /**
     * Set by the admin page when Aron comps someone or repairs a payment Repeat
     * could not retry. Kept separate from `currentPeriodEnd` so a later webhook
     * cannot silently wipe a manual grant.
     */
    accessGrantedUntil: timestamp("access_granted_until", { withTimezone: true }),

    isAdmin: boolean("is_admin").notNull().default(false),

    /**
     * Set the moment a checkout starts charging a card, cleared when it ends.
     * Repeat has no idempotency key, so a double-click would otherwise be two
     * orders and two charges. Claimed with a conditional UPDATE rather than a
     * lock, because the charge is a network call and a transaction must not be
     * held open across one on a one-connection pool.
     */
    checkoutClaimedAt: timestamp("checkout_claimed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_clerk_user_id_idx").on(table.clerkUserId),
    index("users_repeat_subscription_id_idx").on(table.repeatSubscriptionId),
  ],
);

/**
 * One row per completed run through the onboarding wizard. Append-only.
 *
 * Health screen answers live here as columns rather than JSON: the set is small,
 * stable, and Aron may need to know how many members flagged something.
 */
export const onboarding = pgTable(
  "onboarding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    goal: goal("goal").notNull(),
    sessionsPerWeek: smallint("sessions_per_week").notNull(),

    /**
     * Nullable only for rows completed before the wizard asked. Every new run
     * must answer both — `completeOnboarding` refuses a draft without them —
     * and backfilling a guess would be inventing a member's answer.
     */
    equipment: equipment("equipment"),
    experience: experience("experience"),

    weightKg: smallint("weight_kg").notNull(),
    heightCm: smallint("height_cm").notNull(),
    age: smallint("age").notNull(),
    sex: sex("sex").notNull(),
    activityLevel: activityLevel("activity_level").notNull(),

    flaggedChronicCondition: boolean("flagged_chronic_condition").notNull().default(false),
    flaggedMedication: boolean("flagged_medication").notNull().default(false),
    flaggedEatingDisorder: boolean("flagged_eating_disorder").notNull().default(false),
    flaggedInjury: boolean("flagged_injury").notNull().default(false),

    /** The member's own words on what limits them, for Aron to read. Optional. */
    limitations: text("limitations"),

    /** Recorded rather than trusted — the app must not serve under-18s. */
    confirmedAdult: boolean("confirmed_adult").notNull(),

    /**
     * When the member acknowledged the health warning, or null if they were
     * never shown one — no flag was checked, so there was nothing to warn about.
     *
     * A timestamp rather than a boolean, and a column rather than nothing at
     * all: the decision on this flow is that any flag shows a warning and then
     * proceeds, which is only meaningfully different from ignoring the flags if
     * there is a record that the warning was seen and accepted.
     */
    acknowledgedHealthAt: timestamp("acknowledged_health_at", { withTimezone: true }),

    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("onboarding_user_id_idx").on(table.userId)],
);

/**
 * A stored snapshot of the numbers a member was given. Append-only.
 *
 * Never recomputed on read. If the formula changes, existing members keep the
 * targets they were actually shown until something they control changes —
 * their numbers must not shift under them because we shipped a deploy.
 */
export const macroTargets = pgTable(
  "macro_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** The submission these numbers were computed from. */
    onboardingId: uuid("onboarding_id")
      .notNull()
      .references(() => onboarding.id, { onDelete: "cascade" }),

    kcal: integer("kcal").notNull(),
    proteinG: smallint("protein_g").notNull(),
    carbsG: smallint("carbs_g").notNull(),
    fatG: smallint("fat_g").notNull(),

    /**
     * Which version of the calculation produced this row. Bump it whenever the
     * formula, the deficit, or the safety floor changes, so a support question
     * about an old number can be traced to the rules in force at the time.
     */
    formulaVersion: smallint("formula_version").notNull(),

    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("macro_targets_user_id_idx").on(table.userId)],
);

/**
 * Which Sanity plan a member is on. Append-only, so changing goal or frequency
 * leaves a trail rather than overwriting.
 *
 * Only the document id is stored. Plan content stays in Sanity so Aron's edits
 * reach members without a migration.
 */
export const planAssignments = pgTable(
  "plan_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    sanityPlanId: text("sanity_plan_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("plan_assignments_user_id_idx").on(table.userId)],
);

/**
 * Every webhook delivery Repeat has made, once per delivery.
 *
 * Repeat does not sign deliveries and does not retry them, and a replay from its
 * dashboard arrives with a FRESH `X-Repeat-Delivery-Id`. So this table is an
 * audit log, not the idempotency strategy. Idempotency comes from the handler:
 * it never applies the pushed body, it re-fetches the subscription from Repeat
 * and overwrites the mirror, so applying the same news twice changes nothing.
 * The unique delivery id only stops one delivery being logged twice.
 *
 * `payload` keeps the raw body so a dispute can be settled against what Repeat
 * actually sent rather than against how we parsed it.
 */
export const repeatEvents = pgTable(
  "repeat_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repeatDeliveryId: text("repeat_delivery_id").notNull(),
    webhookType: text("webhook_type").notNull(),

    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    repeatSubscriptionId: text("repeat_subscription_id"),

    /**
     * Whole krónur. ISK has no minor unit — there are no aurar in circulation —
     * so there is no ×100 to remember and no rounding to get wrong. Do not copy
     * the "store money in cents" habit from Stripe examples here. Repeat's own
     * legacy `amount` on card payments IS ×100; read `amount_major` instead.
     */
    amountIsk: integer("amount_isk"),

    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("repeat_events_delivery_id_idx").on(table.repeatDeliveryId),
    index("repeat_events_user_id_idx").on(table.userId),
  ],
);
