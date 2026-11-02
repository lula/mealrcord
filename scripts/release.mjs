#!/usr/bin/env node
// Creates a new release: bumps the version everywhere, runs the tests,
// commits, tags vX.Y.Z and pushes. GitHub Actions then builds the installers.
//
// Usage: pnpm release <version|patch|minor|major> [--yes] [--skip-tests]

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";

const root = path.resolve(import.meta.dirname, "..");
const FILES = {
  pkg: path.join(root, "package.json"),
  tauri: path.join(root, "src-tauri/tauri.conf.json"),
  cargo: path.join(root, "src-tauri/Cargo.toml"),
  lock: path.join(root, "src-tauri/Cargo.lock"),
};

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const target = args.find((a) => !a.startsWith("--"));

function fail(msg) {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
}

const sh = (cmd, opts = {}) => execSync(cmd, { cwd: root, encoding: "utf8", ...opts }).trim();
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: "inherit" });

if (!target || flags.has("--help")) {
  console.log("Usage: pnpm release <version|patch|minor|major> [--yes] [--skip-tests]");
  process.exit(target ? 0 : 1);
}

// --- Work out the new version -------------------------------------------
const current = JSON.parse(readFileSync(FILES.pkg, "utf8")).version;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const m = current.match(SEMVER);
if (!m) fail(`Current version "${current}" is not X.Y.Z`);
const [major, minor, patch] = m.slice(1).map(Number);

const version =
  target === "patch" ? `${major}.${minor}.${patch + 1}`
  : target === "minor" ? `${major}.${minor + 1}.0`
  : target === "major" ? `${major + 1}.0.0`
  : target.replace(/^v/, "");

if (!SEMVER.test(version)) fail(`"${target}" is not a version (X.Y.Z) or patch/minor/major`);
const cmp = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
if (cmp(version, current) <= 0) fail(`New version ${version} must be greater than ${current}`);
const tag = `v${version}`;

// --- Check the repository is ready ---------------------------------------
const branch = sh("git branch --show-current");
if (branch !== "main") fail(`Releases are made from main (you are on "${branch}")`);
if (sh("git status --porcelain")) fail("Working tree has uncommitted changes: commit or stash them first");

sh("git fetch origin main --tags", { stdio: "pipe" });
if (sh("git rev-parse HEAD") !== sh("git rev-parse origin/main")) {
  fail("Local main differs from origin/main: pull or push first");
}
if (sh(`git tag --list ${tag}`)) fail(`Tag ${tag} already exists`);

console.log(`\nRelease ${current} → ${version} (tag ${tag})`);

// --- Tests --------------------------------------------------------------
if (!flags.has("--skip-tests")) {
  console.log("\n▶ Running tests");
  run("pnpm exec tsc --noEmit");
  run("pnpm test");
  run("cargo test --lib", path.join(root, "src-tauri"));
}

// --- Confirm -----------------------------------------------------------
if (!flags.has("--yes")) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nCommit, tag ${tag} and push to origin? [y/N] `);
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) fail("Cancelled, nothing changed");
}

// --- Bump versions ------------------------------------------------------
function bumpJson(file) {
  const text = readFileSync(file, "utf8");
  const next = text.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
  if (next === text) fail(`No "version" field found in ${path.relative(root, file)}`);
  writeFileSync(file, next);
}

function bumpToml(file, pattern) {
  const text = readFileSync(file, "utf8");
  const next = text.replace(pattern, `$1${version}$2`);
  if (next === text) fail(`Version not found in ${path.relative(root, file)}`);
  writeFileSync(file, next);
}

bumpJson(FILES.pkg);
bumpJson(FILES.tauri);
// First `version =` in Cargo.toml is the [package] one.
bumpToml(FILES.cargo, /^(version\s*=\s*")[^"]+(")/m);
bumpToml(FILES.lock, /(name = "mealrcord"\nversion = ")[^"]+(")/);

// --- Commit, tag, push -----------------------------------------------------
const changed = ["package.json", "src-tauri/tauri.conf.json", "src-tauri/Cargo.toml", "src-tauri/Cargo.lock"];
run(`git add ${changed.join(" ")}`);
run(`git commit -m "Release ${tag}"`);
run(`git tag -a ${tag} -m "Release ${tag}"`);
run("git push origin main");
run(`git push origin ${tag}`);

const remote = sh("git remote get-url origin").replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/");
console.log(`\n✔ Released ${tag}`);
console.log(`  Builds:  ${remote}/actions`);
console.log(`  Draft:   ${remote}/releases (review and click "Publish release")`);
