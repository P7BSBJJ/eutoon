import "server-only";
import path from "node:path";
import * as schema from "./schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// Produção: DATABASE_URL (Postgres — Supabase, Neon etc.)
// Desenvolvimento: sem DATABASE_URL usa PGlite (Postgres embutido) em ./.data
async function create() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const postgres = (await import("postgres")).default;
    const client = postgres(process.env.DATABASE_URL, { prepare: false });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    return db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data"));
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return db as unknown as DB;
}

// tipo único para os dois drivers (a API do Drizzle é a mesma)
export type DB = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __db?: Promise<DB> };
export function getDb(): Promise<DB> {
  if (!g.__db) g.__db = create() as Promise<DB>;
  return g.__db;
}

export { schema };
