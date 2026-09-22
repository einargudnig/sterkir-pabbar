ALTER TABLE "users" ALTER COLUMN "subscription_status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."subscription_status";--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'canceled');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "subscription_status" SET DATA TYPE "public"."subscription_status" USING "subscription_status"::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "checkout_claimed_at" timestamp with time zone;