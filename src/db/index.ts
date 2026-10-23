import "server-only";
import { conectar, type DB } from "./conexion";

// Una sola conexión por proceso (en desarrollo Next recarga módulos, por eso se guarda en globalThis).
const global = globalThis as unknown as { __db?: Promise<DB> };

export function getDb(): Promise<DB> {
  global.__db ??= conectar();
  return global.__db;
}
