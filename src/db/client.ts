import { invoke } from "@tauri-apps/api/core";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

type Method = "run" | "all" | "values" | "get";
type Query = { sql: string; params: unknown[]; method: Method };
type Result = { rows: any };

export const db = drizzle(
  (sql, params, method) => invoke<Result>("db_query", { query: { sql, params, method } }),
  (queries: Query[]) => invoke<Result[]>("db_batch", { queries }),
  { schema },
);

export type Db = typeof db;

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/** Turns a SQLite/Tauri error into a message for the user. */
export function dbErrorMessage(e: unknown): string {
  const msg = typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
  if (msg.includes("FOREIGN KEY constraint failed")) {
    return "Elemento in uso: rimuovilo prima da ricette, menu o planner.";
  }
  if (msg.includes("UNIQUE constraint failed")) return "Esiste già un elemento con questo nome.";
  return msg;
}

export const backupDb = (path: string) => invoke<void>("db_backup", { path });
export const restoreDb = (path: string) => invoke<void>("db_restore", { path });
