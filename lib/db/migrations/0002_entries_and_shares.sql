CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"total_amount" bigint NOT NULL,
	"paid_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_kind_chk" CHECK ("entries"."kind" in ('expense', 'payment')),
	CONSTRAINT "entries_total_amount_pos_chk" CHECK ("entries"."total_amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shares" (
	"entry_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "shares_entry_id_participant_id_pk" PRIMARY KEY("entry_id","participant_id"),
	CONSTRAINT "shares_amount_pos_chk" CHECK ("shares"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_paid_by_participants_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_group_id_idx" ON "entries" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "entries_paid_by_idx" ON "entries" USING btree ("paid_by");--> statement-breakpoint
CREATE INDEX "shares_participant_id_idx" ON "shares" USING btree ("participant_id");--> statement-breakpoint
CREATE POLICY "entries_creator_all" ON "entries" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from "groups" where "groups"."id" = "entries"."group_id" and "groups"."creator_id" = (select auth.uid()))) WITH CHECK (exists (select 1 from "groups" where "groups"."id" = "entries"."group_id" and "groups"."creator_id" = (select auth.uid())));--> statement-breakpoint
CREATE POLICY "shares_creator_all" ON "shares" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from "entries" join "groups" on "groups"."id" = "entries"."group_id" where "entries"."id" = "shares"."entry_id" and "groups"."creator_id" = (select auth.uid()))) WITH CHECK (exists (select 1 from "entries" join "groups" on "groups"."id" = "entries"."group_id" where "entries"."id" = "shares"."entry_id" and "groups"."creator_id" = (select auth.uid())));