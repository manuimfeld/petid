ALTER TABLE "activation_drafts" ADD COLUMN "province" varchar(80) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "activation_drafts" ADD COLUMN "locality" varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "activation_drafts" ADD COLUMN "street" varchar(180) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "activation_drafts" ADD COLUMN "street_number" varchar(20) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "province" varchar(80) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "locality" varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "street" varchar(180) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pets" ADD COLUMN "street_number" varchar(20) DEFAULT '' NOT NULL;