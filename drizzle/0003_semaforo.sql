ALTER TABLE "clientes" ADD COLUMN "contexto_historico" text;--> statement-breakpoint
ALTER TABLE "estados_semanales" ADD COLUMN "nivel" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "estados_semanales" ADD COLUMN "nivel_sugerido" integer;--> statement-breakpoint
ALTER TABLE "estados_semanales" ADD COLUMN "motivo" text;--> statement-breakpoint
ALTER TABLE "estados_semanales" ADD COLUMN "origen" text DEFAULT 'ia' NOT NULL;--> statement-breakpoint
ALTER TABLE "estados_semanales" ADD COLUMN "ajustado_por" text;--> statement-breakpoint
ALTER TABLE "estados_semanales" ADD COLUMN "listas" jsonb DEFAULT '{"problemas":[],"foco":[],"oportunidades":[]}'::jsonb NOT NULL;