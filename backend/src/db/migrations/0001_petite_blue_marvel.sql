CREATE TABLE "marketplace_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"currency" varchar(8) DEFAULT 'BDT' NOT NULL,
	"category" varchar(64) NOT NULL,
	"condition" varchar(32) DEFAULT 'used' NOT NULL,
	"media_keys" text[] DEFAULT '{}' NOT NULL,
	"location" varchar(128),
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "marketplace_items" ADD CONSTRAINT "marketplace_items_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_marketplace_seller" ON "marketplace_items" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_category" ON "marketplace_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_marketplace_status" ON "marketplace_items" USING btree ("status");