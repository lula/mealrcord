# mealrcord

Desktop app (Tauri 2 + React + shadcn/ui) for managing a restaurant's recipes, meals and meal planner. Requirements are in [features.md](features.md).

## Development

```sh
pnpm install
pnpm tauri dev      # run the app
pnpm test           # tests (logic + data layer on in-memory SQLite)
cd src-tauri && cargo test   # Rust backend tests
pnpm tauri build    # installable bundle for the current OS
```

Requires Rust (`rustup`) in addition to Node and pnpm.

## New release

Installers for macOS (Apple Silicon and Intel), Windows and Linux are built by GitHub Actions ([release.yml](.github/workflows/release.yml)), each OS on its own runner.

1. From a clean, up-to-date `main`, run `pnpm release` (see [Usage](#usage) below).
   The script ([scripts/release.mjs](scripts/release.mjs)) checks the repository state, runs the tests, asks for confirmation, then bumps the version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`, commits, creates the `vX.Y.Z` tag and pushes both.
2. The workflow runs the tests, then the builds. When it finishes, a **draft** release with all installers attached appears under GitHub → Releases.
3. Review the draft, edit the notes if needed, and click **Publish release**.

### Usage

```sh
pnpm release patch      # 0.1.0 → 0.1.1
pnpm release minor      # 0.1.0 → 0.2.0
pnpm release major      # 0.1.0 → 1.0.0
pnpm release 1.0.0      # exact version
```

Options:

- `--yes` – skip the confirmation prompt.
- `--skip-tests` – skip the tests.

<details>
<summary>Manual steps (without the script)</summary>

1. Bump the version in the four files above.
2. `git commit -am "Release v0.2.0" && git push origin main`
3. `git tag v0.2.0 && git push origin v0.2.0` (the tag must match the version).

</details>

The workflow can also be started manually from GitHub → Actions → Release → **Run workflow**; the tag is then taken from the version in `tauri.conf.json`.

macOS and Windows builds are unsigned, so users see an "unidentified developer" warning on first launch. To sign on macOS, add the Apple secrets to the repository and uncomment the related lines in `release.yml`.

## Structure

- `src-tauri/src/db.rs` – SQLite connection (rusqlite), migrations, `db_query`/`db_batch` commands (batch runs in a transaction), backup and restore.
- `src-tauri/migrations/` – SQL schema and seed data (units, system tags). To add a migration, create a new file and append it to `MIGRATIONS` in `db.rs`.
- `src/db/schema.ts` – Drizzle schema; keep it in sync with the SQL.
- `src/features/*` – one folder per area (recipes, meals, planner, shopping, settings), each with `api.ts` (queries + hooks) and its pages.
- `src/lib/scaling.ts`, `src/lib/units.ts` – scaling by guests and unit conversion/aggregation.

The database lives in `~/Library/Application Support/it.mealrcord/mealrcord.db` (macOS).

Planner quantities: `recipe quantity × guests / base servings × meal coefficient`.
