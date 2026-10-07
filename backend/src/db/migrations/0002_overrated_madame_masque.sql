CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_url" text NOT NULL,
	"thumbnail_url" text,
	"media_type" varchar(32) DEFAULT 'image' NOT NULL,
	"caption" text,
	"audience" varchar(32) DEFAULT 'public' NOT NULL,
	"viewers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_stories_user_id" ON "stories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_stories_expires_at" ON "stories" USING btree ("expires_at");