CREATE TYPE "public"."equipment" AS ENUM('raektarstod', 'heima', 'engin');--> statement-breakpoint
CREATE TYPE "public"."experience" AS ENUM('byrjandi', 'einhver', 'vanur');--> statement-breakpoint
ALTER TABLE "onboarding" ADD COLUMN "equipment" "equipment";--> statement-breakpoint
ALTER TABLE "onboarding" ADD COLUMN "experience" "experience";--> statement-breakpoint
ALTER TABLE "onboarding" ADD COLUMN "limitations" text;