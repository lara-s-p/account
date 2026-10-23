import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = ReturnType<typeof drizzlePg<typeof schema>>;

const MIGRACIONES = path.join(process.cwd(), "drizzle");

/**
 * Con DATABASE_URL se conecta a Postgres (Neon en producción).
 * Sin DATABASE_URL, y fuera de producción, usa PGlite: un Postgres embebido guardado en .data/.
 * En Postgres las migraciones se aplican en el build (scripts/migrar.ts); en PGlite, al conectar.
 */
export async function conectar(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    return drizzlePg(postgres(url, { max: 5, prepare: false }), { schema });
  }
  if (process.env.NODE_ENV === "production" && !process.env.PERMITIR_BASE_LOCAL) {
    throw new Error("Falta DATABASE_URL. Configurala en las variables de entorno de Vercel.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzleLite } = await import("drizzle-orm/pglite");
  const { migrate: migrateLite } = await import("drizzle-orm/pglite/migrator");
  const carpeta = path.join(process.cwd(), ".data");
  mkdirSync(carpeta, { recursive: true });
  const client = new PGlite(path.join(carpeta, "pglite"));
  const db = drizzleLite(client, { schema });
  await migrateLite(db, { migrationsFolder: MIGRACIONES });
  // Los dos drivers exponen la misma API de consultas de Drizzle.
  return db as unknown as DB;
}
