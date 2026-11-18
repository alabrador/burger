CREATE TABLE "card_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payload" jsonb NOT NULL,
	"ip" text DEFAULT '' NOT NULL,
	"total_cents" integer NOT NULL,
	"payment_intent_id" text,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
