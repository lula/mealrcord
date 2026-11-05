//! SQLite access for the frontend.
//!
//! The app keeps a single connection behind a mutex. The frontend (Drizzle's
//! `sqlite-proxy` driver) sends SQL + params through `db_query` and `db_batch`;
//! `db_batch` runs every statement in one transaction.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::types::{Value as SqlValue, ValueRef};
use rusqlite::{Connection, OpenFlags, params_from_iter};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use tauri::State;

/// Ordered migrations. The index + 1 is the schema version (`PRAGMA user_version`).
const MIGRATIONS: &[&str] = &[
    include_str!("../migrations/001_init.sql"),
    include_str!("../migrations/002_recipe_steps.sql"),
    include_str!("../migrations/003_meal_course_coefficients.sql"),
    include_str!("../migrations/004_planned_coefficients.sql"),
    include_str!("../migrations/005_meal_recipes_unique.sql"),
    include_str!("../migrations/006_planned_recipe_guests.sql"),
    include_str!("../migrations/007_settings.sql"),
    include_str!("../migrations/008_planned_unique_meal_per_day.sql"),
    include_str!("../migrations/009_dishes.sql"),
    include_str!("../migrations/010_dish_coefficient.sql"),
    include_str!("../migrations/011_tag_side_dish.sql"),
    include_str!("../migrations/012_tag_side_coefficient.sql"),
    include_str!("../migrations/013_meal_recipes_side.sql"),
    include_str!("../migrations/014_drop_planned_coefficient.sql"),
    include_str!("../migrations/015_drop_recipe_steps.sql"),
    include_str!("../migrations/016_ingredient_categories.sql"),
];

pub struct Db {
    conn: Mutex<Connection>,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(err)?;
        configure(&conn)?;
        migrate(&conn)?;
        Ok(Self { conn: Mutex::new(conn) })
    }
}

fn configure(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;",
    )
    .map_err(err)
}

fn schema_version(conn: &Connection) -> Result<usize, String> {
    conn.query_row("PRAGMA user_version", [], |r| r.get::<_, i64>(0))
        .map(|v| v as usize)
        .map_err(err)
}

fn migrate(conn: &Connection) -> Result<(), String> {
    let current = schema_version(conn)?;
    if current > MIGRATIONS.len() {
        return Err(format!(
            "Il database è di una versione più recente dell'app (schema {current})"
        ));
    }
    for (i, sql) in MIGRATIONS.iter().enumerate().skip(current) {
        let version = i + 1;
        conn.execute_batch(&format!(
            "BEGIN;\n{sql}\nPRAGMA user_version = {version};\nCOMMIT;"
        ))
        .map_err(|e| {
            let _ = conn.execute_batch("ROLLBACK;");
            format!("Migrazione {version} fallita: {e}")
        })?;
    }
    Ok(())
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[derive(Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Method {
    Run,
    All,
    Values,
    Get,
}

#[derive(Deserialize)]
pub struct Query {
    sql: String,
    params: Vec<JsonValue>,
    method: Method,
}

/// Matches Drizzle's `{ rows }` result: `get` returns one row (or null),
/// `all`/`values` return a list of rows, `run` returns an empty list.
#[derive(Serialize, Debug)]
pub struct QueryResult {
    rows: JsonValue,
}

fn to_sql(v: &JsonValue) -> Result<SqlValue, String> {
    Ok(match v {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(b) => SqlValue::Integer(*b as i64),
        JsonValue::Number(n) => match n.as_i64() {
            Some(i) => SqlValue::Integer(i),
            None => SqlValue::Real(n.as_f64().ok_or("numero non valido")?),
        },
        JsonValue::String(s) => SqlValue::Text(s.clone()),
        other => SqlValue::Text(other.to_string()),
    })
}

fn to_json(v: ValueRef<'_>) -> JsonValue {
    match v {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(i) => JsonValue::from(i),
        ValueRef::Real(f) => JsonValue::from(f),
        ValueRef::Text(t) => JsonValue::from(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(b) => JsonValue::from(b.to_vec()),
    }
}

fn run_query(conn: &Connection, q: &Query) -> Result<QueryResult, String> {
    let params = q.params.iter().map(to_sql).collect::<Result<Vec<_>, _>>()?;
    let mut stmt = conn.prepare_cached(&q.sql).map_err(err)?;

    if q.method == Method::Run {
        stmt.execute(params_from_iter(params)).map_err(err)?;
        return Ok(QueryResult { rows: JsonValue::Array(vec![]) });
    }

    let cols = stmt.column_count();
    let mut rows = stmt.query(params_from_iter(params)).map_err(err)?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(err)? {
        let values = (0..cols)
            .map(|i| row.get_ref(i).map(to_json))
            .collect::<Result<Vec<_>, _>>()
            .map_err(err)?;
        out.push(JsonValue::Array(values));
        if q.method == Method::Get {
            break;
        }
    }

    let rows = if q.method == Method::Get {
        out.into_iter().next().unwrap_or(JsonValue::Null)
    } else {
        JsonValue::Array(out)
    };
    Ok(QueryResult { rows })
}

#[tauri::command]
pub fn db_query(db: State<'_, Db>, query: Query) -> Result<QueryResult, String> {
    let conn = db.conn.lock().map_err(err)?;
    run_query(&conn, &query)
}

#[tauri::command]
pub fn db_batch(db: State<'_, Db>, queries: Vec<Query>) -> Result<Vec<QueryResult>, String> {
    let mut conn = db.conn.lock().map_err(err)?;
    let tx = conn.transaction().map_err(err)?;
    let results = queries
        .iter()
        .map(|q| run_query(&tx, q))
        .collect::<Result<Vec<_>, _>>()?;
    tx.commit().map_err(err)?;
    Ok(results)
}

/// Writes a consistent copy of the database to `path`.
#[tauri::command]
pub fn db_backup(db: State<'_, Db>, path: PathBuf) -> Result<(), String> {
    if path.exists() {
        std::fs::remove_file(&path).map_err(err)?;
    }
    let conn = db.conn.lock().map_err(err)?;
    conn.execute("VACUUM INTO ?1", [path.to_string_lossy()]).map_err(err)?;
    Ok(())
}

/// Replaces the current data with the backup at `path`, then brings the
/// schema up to date. The file is checked before anything is overwritten.
#[tauri::command]
pub fn db_restore(db: State<'_, Db>, path: PathBuf) -> Result<(), String> {
    let src = Connection::open_with_flags(&path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| "Il file selezionato non è un database valido".to_string())?;
    let is_backup: bool = src
        .query_row(
            "SELECT count(*) = 3 FROM sqlite_master
             WHERE type = 'table' AND name IN ('recipes', 'meals', 'planned_meals')",
            [],
            |r| r.get(0),
        )
        .map_err(|_| "Il file selezionato non è un database valido".to_string())?;
    if !is_backup {
        return Err("Il file selezionato non è un backup di mealrcord".into());
    }
    if schema_version(&src)? > MIGRATIONS.len() {
        return Err("Il backup proviene da una versione più recente dell'app".into());
    }

    let mut conn = db.conn.lock().map_err(err)?;
    {
        let backup = rusqlite::backup::Backup::new(&src, &mut conn).map_err(err)?;
        backup
            .run_to_completion(256, std::time::Duration::from_millis(0), None)
            .map_err(err)?;
    }
    configure(&conn)?;
    migrate(&conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mem() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        configure(&conn).unwrap();
        migrate(&conn).unwrap();
        conn
    }

    fn q(sql: &str, params: Vec<JsonValue>, method: Method) -> Query {
        Query { sql: sql.into(), params, method }
    }

    #[test]
    fn migrates_and_seeds() {
        let conn = mem();
        assert_eq!(schema_version(&conn).unwrap(), MIGRATIONS.len());
        let r = run_query(&conn, &q("SELECT count(*) FROM tags WHERE is_system = 1", vec![], Method::Get)).unwrap();
        // Antipasto, Primo, Secondo, Dolce (001) + Contorno (011).
        assert_eq!(r.rows, serde_json::json!([5]));
    }

    #[test]
    fn system_tags_cannot_be_deleted() {
        let conn = mem();
        let e = run_query(&conn, &q("DELETE FROM tags WHERE id = ?", vec!["tag-main".into()], Method::Run));
        assert!(e.unwrap_err().contains("tag di sistema"));
    }

    #[test]
    fn ingredient_in_use_cannot_be_deleted() {
        let conn = mem();
        conn.execute_batch(
            "INSERT INTO recipes (id, name) VALUES ('r1', 'Pasta');
             INSERT INTO ingredients (id, name) VALUES ('i1', 'Farina');
             INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_id) VALUES ('r1', 'i1', 100, 'unit-g');",
        )
        .unwrap();
        assert!(conn.execute("DELETE FROM ingredients WHERE id = 'i1'", []).is_err());
    }

    #[test]
    fn deleting_a_category_clears_it_from_ingredients() {
        let conn = mem();
        conn.execute_batch(
            "INSERT INTO ingredient_categories (id, name) VALUES ('c1', 'Verdura');
             INSERT INTO ingredients (id, name, category_id) VALUES ('i1', 'Zucchine', 'c1');
             DELETE FROM ingredient_categories WHERE id = 'c1';",
        )
        .unwrap();
        let r = run_query(&conn, &q("SELECT category_id FROM ingredients WHERE id = 'i1'", vec![], Method::Get)).unwrap();
        assert_eq!(r.rows, serde_json::json!([null]));
    }

    #[test]
    fn get_returns_null_when_empty() {
        let conn = mem();
        let r = run_query(&conn, &q("SELECT id FROM recipes", vec![], Method::Get)).unwrap();
        assert_eq!(r.rows, JsonValue::Null);
    }
}
