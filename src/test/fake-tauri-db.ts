// Test helper: implements the Rust db_query/db_batch contract on top of
// node:sqlite, using the real migration, so the Drizzle layer can be tested.
import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type Query = { sql: string; params: unknown[]; method: "run" | "all" | "values" | "get" };

export function createFakeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(path.resolve(import.meta.dirname, "../../src-tauri/migrations/001_init.sql"), "utf8"));

  const run = (q: Query) => {
    const stmt = db.prepare(q.sql);
    const params = q.params.map((p) => (typeof p === "boolean" ? Number(p) : p)) as never[];
    if (q.method === "run") {
      stmt.run(...params);
      return { rows: [] };
    }
    stmt.setReturnArrays(true);
    const rows = stmt.all(...params) as unknown[][];
    return { rows: q.method === "get" ? (rows[0] ?? null) : rows };
  };

  const invoke = async (cmd: string, args: any) => {
    if (cmd === "db_query") return run(args.query);
    if (cmd === "db_batch") {
      db.exec("BEGIN");
      try {
        const out = (args.queries as Query[]).map(run);
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    }
    throw new Error(`unexpected command ${cmd}`);
  };

  return { db, invoke };
}
