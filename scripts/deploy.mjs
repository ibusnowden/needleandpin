// Deploys the built game into the personal site repo, which GitHub Pages serves at
// https://ibra-niang.com/ (repo ibusnowden/ibraniang1.github.io). The game lives at /needleandpin/.
//
//   npm run deploy               build, copy into the site repo, commit locally (no push)
//   npm run deploy -- --push     …and push, which publishes the site
//
// SITE_REPO points at a local checkout; by default ../ibraniang1.github.io is used or cloned.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = resolve(process.env.SITE_REPO ?? join(ROOT, "..", "ibraniang1.github.io"));
const REMOTE = process.env.SITE_REMOTE ?? "git@github.com:ibusnowden/ibraniang1.github.io.git";
const FOLDER = "needleandpin";
const push = process.argv.includes("--push");
const run = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env } });
const out = (cmd, args, cwd = ROOT) => execFileSync(cmd, args, { cwd, encoding: "utf8" }).trim();

console.log("› checks");
run("npx", ["tsc", "--noEmit", "-p", "."]);
run("npx", ["vitest", "run"]);

console.log(`› build with base /${FOLDER}/`);
execFileSync("npx", ["vite", "build"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, BASE: `/${FOLDER}/` } });

if (!existsSync(join(SITE, ".git"))) {
  console.log(`› cloning ${REMOTE} into ${SITE}`);
  run("git", ["clone", REMOTE, SITE]);
} else {
  console.log(`› updating ${SITE}`);
  run("git", ["pull", "--ff-only"], SITE);
}

const target = join(SITE, FOLDER);
rmSync(target, { recursive: true, force: true });
cpSync(join(ROOT, "dist"), target, { recursive: true });
// GitHub Pages must not run Jekyll over the build (it would hide files starting with "_").
writeFileSync(join(SITE, ".nojekyll"), "");

const sha = out("git", ["rev-parse", "--short", "HEAD"]) || "working-tree";
run("git", ["add", FOLDER, ".nojekyll"], SITE);
const changed = out("git", ["status", "--porcelain", FOLDER, ".nojekyll"], SITE);
if (!changed) { console.log("› nothing changed"); process.exit(0); }
run("git", ["commit", "-m", `Deploy The Needle & The Pin (${sha})\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`], SITE);
if (push) {
  run("git", ["push"], SITE);
  console.log(`› pushed — GitHub Pages will publish https://ibra-niang.com/${FOLDER}/ in a minute or two`);
} else {
  console.log(`› committed in ${SITE}. Review it, then run: npm run deploy -- --push  (or git push there)`);
}
