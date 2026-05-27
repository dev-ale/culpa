CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"title" text NOT NULL,
	"currency" text NOT NULL,
	"share_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_share_token_unique" UNIQUE("share_token"),
	CONSTRAINT "groups_currency_len_chk" CHECK (length("groups"."currency") = 3)
);
--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "groups_creator_id_idx" ON "groups" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "participants_group_id_idx" ON "participants" USING btree ("group_id");--> statement-breakpoint
CREATE POLICY "groups_creator_all" ON "groups" AS PERMISSIVE FOR ALL TO "authenticated" USING ((select auth.uid()) = "groups"."creator_id") WITH CHECK ((select auth.uid()) = "groups"."creator_id");--> statement-breakpoint
CREATE POLICY "participants_creator_all" ON "participants" AS PERMISSIVE FOR ALL TO "authenticated" USING (exists (select 1 from "groups" where "groups"."id" = "participants"."group_id" and "groups"."creator_id" = (select auth.uid()))) WITH CHECK (exists (select 1 from "groups" where "groups"."id" = "participants"."group_id" and "groups"."creator_id" = (select auth.uid())));