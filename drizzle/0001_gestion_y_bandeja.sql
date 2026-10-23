ALTER TABLE "clientes" ADD COLUMN "account_apoyo" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "prioridad" integer;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "analista_seo_id" integer;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "analista_email_id" integer;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "analista_paid_id" integer;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "disenadora" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "redactora" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "plataforma_email" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "looker_studio" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "blueprint" text;--> statement-breakpoint
ALTER TABLE "tareas" ADD COLUMN "accion_jira" text DEFAULT 'crear' NOT NULL;--> statement-breakpoint
ALTER TABLE "tareas" ADD COLUMN "jira_relacionada" text;--> statement-breakpoint
ALTER TABLE "tareas" ADD COLUMN "motivo_relacion" text;--> statement-breakpoint
ALTER TABLE "tareas" ADD COLUMN "enviada_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tareas" ADD COLUMN "error_envio" text;