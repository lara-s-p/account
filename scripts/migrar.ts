import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Aplica las migraciones pendientes en Postgres. Sin DATABASE_URL no hace nada
// (en desarrollo la base local se migra sola al conectar).
const url = process.env.DATABASE_URL;
if (!url) {
  console.log("Sin DATABASE_URL: se omiten las migraciones de Postgres.");
} else {
  const sql = postgres(url, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await sql.end();
  console.log("Migraciones aplicadas.");
}
