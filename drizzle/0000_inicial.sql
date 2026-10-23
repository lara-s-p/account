CREATE TABLE "analistas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"email" text,
	"jira_account_id" text,
	"area" text,
	"capacidad_semanal" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analistas_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"alias" text[] DEFAULT '{}'::text[] NOT NULL,
	"estado" text DEFAULT 'Revisar' NOT NULL,
	"account" text,
	"industria" text,
	"pais" text,
	"sitio_web" text,
	"plataforma_ecommerce" text,
	"descripcion_negocio" text,
	"objetivos_negocio" text,
	"competidores" text,
	"servicios" text[] DEFAULT '{}'::text[] NOT NULL,
	"fee_mensual" text,
	"fecha_inicio" date,
	"frecuencia_reunion" text,
	"contactos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"jira_project_key" text,
	"jira_project_id" text,
	"jira_issue_type" text,
	"slack_canal" text,
	"trello_tablero" text,
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clientes_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "estados_semanales" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" text NOT NULL,
	"semana" date NOT NULL,
	"semaforo" text NOT NULL,
	"puntaje" integer,
	"resumen" text,
	"problemas" text,
	"foco" text,
	"oportunidades" text,
	"para_direccion" text,
	"metricas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reuniones" (
	"id" text PRIMARY KEY NOT NULL,
	"cliente_id" text NOT NULL,
	"fecha" date NOT NULL,
	"area" text DEFAULT 'MKT' NOT NULL,
	"tipo" text,
	"link_doc" text,
	"minuta_depurada" text,
	"minuta_trello" text,
	"texto_minuta" text,
	"procesada" boolean DEFAULT false NOT NULL,
	"resumen" text,
	"decisiones" text[] DEFAULT '{}'::text[] NOT NULL,
	"compromisos_cliente" text[] DEFAULT '{}'::text[] NOT NULL,
	"oportunidades" text[] DEFAULT '{}'::text[] NOT NULL,
	"riesgos" text[] DEFAULT '{}'::text[] NOT NULL,
	"tono_cliente" text,
	"origen" text DEFAULT 'plataforma' NOT NULL,
	"creado_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarea_eventos" (
	"id" serial PRIMARY KEY NOT NULL,
	"tarea_id" text NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"usuario" text,
	"tipo" text NOT NULL,
	"campo" text,
	"valor_anterior" text,
	"valor_nuevo" text,
	"comentario" text
);
--> statement-breakpoint
CREATE TABLE "tareas" (
	"id" text PRIMARY KEY NOT NULL,
	"cliente_id" text NOT NULL,
	"reunion_id" text,
	"titulo" text NOT NULL,
	"descripcion" text,
	"responsable" text DEFAULT 'Known' NOT NULL,
	"etiqueta" text,
	"analista_id" integer,
	"analista_sugerido_id" integer,
	"prioridad" text DEFAULT 'Media' NOT NULL,
	"fecha_limite" date,
	"decision" text DEFAULT 'Pendiente' NOT NULL,
	"fecha_decision" timestamp with time zone,
	"estado" text DEFAULT 'Por hacer' NOT NULL,
	"fecha_cierre" timestamp with time zone,
	"objetivo" text,
	"jira_key" text,
	"estado_jira" text,
	"origen" text DEFAULT 'plataforma' NOT NULL,
	"origen_clave" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tareas_origen_clave_unique" UNIQUE("origen_clave")
);
--> statement-breakpoint
ALTER TABLE "estados_semanales" ADD CONSTRAINT "estados_semanales_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reuniones" ADD CONSTRAINT "reuniones_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarea_eventos" ADD CONSTRAINT "tarea_eventos_tarea_id_tareas_id_fk" FOREIGN KEY ("tarea_id") REFERENCES "public"."tareas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_reunion_id_reuniones_id_fk" FOREIGN KEY ("reunion_id") REFERENCES "public"."reuniones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_analista_id_analistas_id_fk" FOREIGN KEY ("analista_id") REFERENCES "public"."analistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_analista_sugerido_id_analistas_id_fk" FOREIGN KEY ("analista_sugerido_id") REFERENCES "public"."analistas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "estados_semanales_cliente_semana" ON "estados_semanales" USING btree ("cliente_id","semana");--> statement-breakpoint
CREATE INDEX "reuniones_cliente_fecha" ON "reuniones" USING btree ("cliente_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "reuniones_link_doc" ON "reuniones" USING btree ("link_doc");--> statement-breakpoint
CREATE INDEX "tarea_eventos_tarea" ON "tarea_eventos" USING btree ("tarea_id","fecha");--> statement-breakpoint
CREATE INDEX "tareas_cliente" ON "tareas" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "tareas_reunion" ON "tareas" USING btree ("reunion_id");--> statement-breakpoint
CREATE INDEX "tareas_analista" ON "tareas" USING btree ("analista_id");