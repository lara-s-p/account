CREATE TABLE "ajustes" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reuniones" ADD COLUMN "minuta_completa" text;--> statement-breakpoint
ALTER TABLE "reuniones" ADD COLUMN "resumen_slack" text;--> statement-breakpoint
ALTER TABLE "reuniones" ADD COLUMN "avisos" text[] DEFAULT '{}'::text[] NOT NULL;