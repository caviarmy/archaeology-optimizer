// Regression guard for OUR engine (no network, no oracle). Re-runs the our-side
// computation and diffs it against the committed golden_ours.json, so any
// accidental change to our math (the kind that introduced the old crit-damage
// bug) fails loudly. Update the golden on purpose with:  node regression.mjs --update
// Run: node test/oracle/regression.mjs
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const update = process.argv.includes("--update");

// Recompute ours.json from the live engine (pure-ours, deterministic).
execFileSync("node", [path.join(HERE, "run_ours.mjs")], { stdio: "inherit" });
const fresh = JSON.parse(fs.readFileSync(path.join(HERE, "ours.json"), "utf8"));

const goldenPath = path.join(HERE, "golden_ours.json");
if (update) { fs.writeFileSync(goldenPath, JSON.stringify(fresh, null, 2)); console.log("golden updated."); process.exit(0); }

const golden = JSON.parse(fs.readFileSync(goldenPath, "utf8"));
let drift = 0;
const walk = (g, f, trail) => {
  for (const k of Object.keys(g)) {
    const gp = `${trail}${k}`;
    if (typeof g[k] === "object" && g[k] !== null) { walk(g[k], (f || {})[k] || {}, gp + "."); }
    else {
      const fv = (f || {})[k];
      const ok = typeof g[k] === "number" ? Math.abs(g[k] - fv) <= 1e-6 * Math.max(1, Math.abs(g[k])) : g[k] === fv;
      if (!ok) { drift++; console.log(`  DRIFT ${gp}: golden=${g[k]} now=${fv}`); }
    }
  }
};
walk(golden, fresh, "");
if (drift) { console.log(`\nregression: ${drift} value(s) drifted from golden. If intended, re-run with --update.`); process.exit(1); }
console.log("regression: our engine output matches golden (no drift).");
