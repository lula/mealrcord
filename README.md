# mealrcord

App desktop (Tauri 2 + React + shadcn/ui) per ricette, pasti e planner di un ristorante. Requisiti in [features.md](features.md).

## Sviluppo

```sh
pnpm install
pnpm tauri dev      # avvia l'app
pnpm test           # test (logica + layer dati su SQLite in memoria)
cd src-tauri && cargo test   # test del backend Rust
pnpm tauri build    # pacchetto installabile
```

Serve Rust (`rustup`) oltre a Node e pnpm.

## Struttura

- `src-tauri/src/db.rs` – connessione SQLite (rusqlite), migrazioni, comandi `db_query`/`db_batch` (transazione), backup e ripristino.
- `src-tauri/migrations/` – schema SQL e dati iniziali (unità, tag di sistema). Una nuova migrazione = nuovo file aggiunto a `MIGRATIONS` in `db.rs`.
- `src/db/schema.ts` – schema Drizzle, da tenere allineato all'SQL.
- `src/features/*` – una cartella per area (ricette, pasti, planner, spesa, impostazioni), ciascuna con `api.ts` (query + hook) e le pagine.
- `src/lib/scaling.ts`, `src/lib/units.ts` – scalatura sulle persone e conversione/aggregazione delle unità.

Il database è in `~/Library/Application Support/it.mealrcord/mealrcord.db` (macOS).

Quantità nel planner: `quantità ricetta × coperti / persone base × coefficiente pasto`.
