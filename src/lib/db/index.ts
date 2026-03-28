import { drizzle as drizzleBetterSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema";

const isTurso = Boolean(process.env.TURSO_DATABASE_URL);

type DbInstance = {
  db: unknown;
  runStatement: (sql: string, args?: any[]) => Promise<void>;
  queryStatement: (sql: string, args?: any[]) => Promise<any[]>;
  ready: Promise<void>;
};

function createDb(): DbInstance {
  if (isTurso) {
    // Production: Turso over HTTP.
    // Migrations are applied during the Vercel build via `vercel-build`,
    // not at runtime — the drizzle meta files aren't available in serverless bundles.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require("@libsql/client");
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    const db = drizzleLibsql(client, { schema });
    const ready = Promise.resolve();
    return {
      db,
      ready,
      runStatement: async (sql: string, args: any[] = []) => {
        await client.execute({ sql, args });
      },
      queryStatement: async (sql: string, args: any[] = []) => {
        const result = await client.execute({ sql, args });
        return result.rows as any[];
      },
    };
  } else {
    // Local dev: better-sqlite3 file
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSQLite3 = require("better-sqlite3");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { migrate } = require("drizzle-orm/better-sqlite3/migrator");
    const DB_PATH = process.env.DB_PATH ?? "./basemark.db";
    const sqlite = new BetterSQLite3(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    const db = drizzleBetterSqlite(sqlite, { schema });
    migrate(db, { migrationsFolder: "./drizzle" });
    const ready = Promise.resolve();
    return {
      db,
      ready,
      runStatement: async (sql: string, args: any[] = []) => {
        await ready;
        sqlite.prepare(sql).run(...args);
      },
      queryStatement: async (sql: string, args: any[] = []) => {
        await ready;
        return sqlite.prepare(sql).all(...args) as any[];
      },
    };
  }
}

// Singleton for dev hot-reload
const globalForDb = globalThis as unknown as {
  _basemark?: DbInstance;
};

if (!globalForDb._basemark) {
  globalForDb._basemark = createDb();
}

const _instance = globalForDb._basemark!;
// Cast to the shared base so callers can use .select({...}) without union-type issues
export const db = _instance.db as BaseSQLiteDatabase<any, any, typeof schema>;
export const { runStatement, queryStatement } = _instance;
export const dbReady = _instance.ready;
