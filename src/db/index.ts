import "server-only";
import path from "node:path";
import * as schema from "./schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

// Produção: DATABASE_URL (Postgres — Supabase, Neon etc.)
// Desenvolvimento: sem DATABASE_URL usa PGlite (Postgres embutido) em ./.data
async function create() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL; // Neon na Vercel cria um dos dois
  if (url) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const postgres = (await import("postgres")).default;
    const client = postgres(url, { prepare: false, max: 3 });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    return db;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production" && !process.env.PGLITE_DIR) {
    throw new Error("Banco de dados não configurado: defina DATABASE_URL (Neon/Supabase).");
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
  if (!g.__db) {
    g.__db = create() as Promise<DB>;
    g.__db.catch(() => (g.__db = undefined));
  }
  return g.__db;
}

export { schema };
