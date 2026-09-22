ALTER TABLE "kling_events" RENAME TO "repeat_events";--> statement-breakpoint
ALTER TABLE "repeat_events" RENAME COLUMN "kling_event_id" TO "repeat_delivery_id";--> statement-breakpoint
ALTER TABLE "repeat_events" RENAME COLUMN "event_type" TO "webhook_type";--> statement-breakpoint
ALTER TABLE "repeat_events" RENAME COLUMN "kling_subscription_id" TO "repeat_subscription_id";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "kling_subscription_id" TO "repeat_subscription_id";--> statement-breakpoint
ALTER TABLE "repeat_events" DROP CONSTRAINT "kling_events_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "kling_events_event_id_idx";--> statement-breakpoint
DROP INDEX "kling_events_user_id_idx";--> statement-breakpoint
DROP INDEX "users_kling_subscription_id_idx";--> statement-breakpoint
ALTER TABLE "repeat_events" ADD CONSTRAINT "repeat_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "repeat_events_delivery_id_idx" ON "repeat_events" USING btree ("repeat_delivery_id");--> statement-breakpoint
CREATE INDEX "repeat_events_user_id_idx" ON "repeat_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_repeat_subscription_id_idx" ON "users" USING btree ("repeat_subscription_id");