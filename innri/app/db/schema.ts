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

export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
]);

export const goal = pgEnum("goal", ["fitutap", "vodvauppbygging"]);

export const activityLevel = pgEnum("activity_level", ["kyrrseta", "lett", "midlungs", "mikil"]);

/**
 * Needed because Mifflin-St Jeor has separate male and female constants.
 *
 * `annad` has no constant of its own, so the macro calculation has to decide
 * what to do with it — that decision belongs with the rest of the formula, and
 * it is Einar's to make alongside the calorie floor. Recording it honestly here
 * is better than forcing a binary answer in the questionnaire.
 */
export const sex = pgEnum("sex", ["karl", "kona", "annad"]);

/**
 * One row per Clerk user. Clerk owns identity; this table owns everything about
 * that person the app needs to answer quickly — above all whether they are
 * currently paid up.
 *
 * The subscription columns are a MIRROR of Kling, written only by the webhook
 * handler. `requireActiveAccess` reads them and never calls Kling: access stays
 * fast, keeps working through a Kling outage, and the customer list is ours.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email"),

    subscriptionStatus: subscriptionStatus("subscription_status"),
    klingSubscriptionId: text("kling_subscription_id"),

    /**
     * The moment access lapses. Null means the member has never subscribed.
     * Access is `currentPeriodEnd > now()` AND status is not `canceled`, so a
     * member who cancels keeps what they paid for until the period runs out.
     */
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),

    /**
     * Set by the admin page when Aron comps someone or repairs a payment Kling
     * could not retry. Kept separate from `currentPeriodEnd` so a later webhook
     * cannot silently wipe a manual grant.
     */
    accessGrantedUntil: timestamp("access_granted_until", { withTimezone: true }),

    isAdmin: boolean("is_admin").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_clerk_user_id_idx").on(table.clerkUserId),
    index("users_kling_subscription_id_idx").on(table.klingSubscriptionId),
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

    weightKg: smallint("weight_kg").notNull(),
    heightCm: smallint("height_cm").notNull(),
    age: smallint("age").notNull(),
    sex: sex("sex").notNull(),
    activityLevel: activityLevel("activity_level").notNull(),

    flaggedChronicCondition: boolean("flagged_chronic_condition").notNull().default(false),
    flaggedMedication: boolean("flagged_medication").notNull().default(false),
    flaggedEatingDisorder: boolean("flagged_eating_disorder").notNull().default(false),
    flaggedInjury: boolean("flagged_injury").notNull().default(false),

    /** Recorded rather than trusted — the app must not serve under-18s. */
    confirmedAdult: boolean("confirmed_adult").notNull(),

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
 * Every webhook Kling has delivered, exactly once.
 *
 * `klingEventId` is unique, and that is the whole idempotency strategy: Kling
 * guarantees at-least-once delivery, so the same `payment captured` event can
 * arrive twice. Inserting first and letting the unique constraint reject the
 * duplicate is what stops a member getting two months for one payment.
 *
 * `payload` keeps the raw body so a dispute can be settled against what Kling
 * actually sent rather than against how we parsed it.
 */
export const klingEvents = pgTable(
  "kling_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    klingEventId: text("kling_event_id").notNull(),
    eventType: text("event_type").notNull(),

    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    klingSubscriptionId: text("kling_subscription_id"),

    /**
     * Whole krónur. ISK has no minor unit — there are no aurar in circulation —
     * so there is no ×100 to remember and no rounding to get wrong. Do not copy
     * the "store money in cents" habit from Stripe examples here.
     */
    amountIsk: integer("amount_isk"),

    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("kling_events_event_id_idx").on(table.klingEventId),
    index("kling_events_user_id_idx").on(table.userId),
  ],
);
