CREATE TYPE "public"."activity_level" AS ENUM('kyrrseta', 'lett', 'midlungs', 'mikil');--> statement-breakpoint
CREATE TYPE "public"."goal" AS ENUM('fitutap', 'vodvauppbygging');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('karl', 'kona', 'annad');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "kling_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kling_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"user_id" uuid,
	"kling_subscription_id" text,
	"amount_isk" integer,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "macro_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"onboarding_id" uuid NOT NULL,
	"kcal" integer NOT NULL,
	"protein_g" smallint NOT NULL,
	"carbs_g" smallint NOT NULL,
	"fat_g" smallint NOT NULL,
	"formula_version" smallint NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal" "goal" NOT NULL,
	"sessions_per_week" smallint NOT NULL,
	"weight_kg" smallint NOT NULL,
	"height_cm" smallint NOT NULL,
	"age" smallint NOT NULL,
	"sex" "sex" NOT NULL,
	"activity_level" "activity_level" NOT NULL,
	"flagged_chronic_condition" boolean DEFAULT false NOT NULL,
	"flagged_medication" boolean DEFAULT false NOT NULL,
	"flagged_eating_disorder" boolean DEFAULT false NOT NULL,
	"flagged_injury" boolean DEFAULT false NOT NULL,
	"confirmed_adult" boolean NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sanity_plan_id" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text,
	"subscription_status" "subscription_status",
	"kling_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"access_granted_until" timestamp with time zone,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kling_events" ADD CONSTRAINT "kling_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "macro_targets" ADD CONSTRAINT "macro_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "macro_targets" ADD CONSTRAINT "macro_targets_onboarding_id_onboarding_id_fk" FOREIGN KEY ("onboarding_id") REFERENCES "public"."onboarding"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding" ADD CONSTRAINT "onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_assignments" ADD CONSTRAINT "plan_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kling_events_event_id_idx" ON "kling_events" USING btree ("kling_event_id");--> statement-breakpoint
CREATE INDEX "kling_events_user_id_idx" ON "kling_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "macro_targets_user_id_idx" ON "macro_targets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "onboarding_user_id_idx" ON "onboarding" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "plan_assignments_user_id_idx" ON "plan_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "users_kling_subscription_id_idx" ON "users" USING btree ("kling_subscription_id");