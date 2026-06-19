// Spawn comparison. Gated: our per-slot rarity probability table matches their
// actual sampled spawn distribution (confirms our rates ARE their sequential
// 1-in-X model's marginals). Informational: average active nodes per floor, which
// differs because our model guarantees the first 6 slots fill and theirs has no
// minimum (so ours carries ~6*(1-p) extra blocks, most at shallow floors).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(HERE, "scenarios.json"), "utf8"));
const theirs = JSON.parse(fs.readFileSync(path.join(HERE, "spawn_theirs.json"), "utf8"));
const ours = JSON.parse(fs.readFileSync(path.join(HERE, "spawn_ours.json"), "utf8"));
const TYPES = ["dirt", "common", "rare", "epic", "legendary", "mythic", "divine"];
const tol = 0.01; // abs per-slot probability (sampling noise at the configured sample count)

let fail = 0, total = 0;
console.log("Spawn distribution (per-slot rarity probability, ours rate table vs their sampled):");
for (const fl of Object.keys(theirs)) {
  const t = theirs[fl], o = ours[fl] || {};
  const bad = [];
  for (const ty of TYPES) {
    total++;
    const tv = t.rarityProb[ty] || 0, ov = (o.rarityProb || {})[ty] || 0;
    if (Math.abs(tv - ov) > tol) { fail++; bad.push(`${ty} theirs=${tv.toFixed(3)} ours=${ov.toFixed(3)}`); }
  }
  console.log(`  floor ${fl.padStart(3)}: ${bad.length ? "FAIL " + bad.join(", ") : "rates match"}  | active nodes theirs=${t.activeAvg.toFixed(1)} ours~${o.expectedActive.toFixed(1)} (informational: ours' 6-node minimum)`);
}
console.log(`\nRate-distribution checks: ${total - fail}/${total} within ${tol} per-slot probability.`);
if (fail) { console.log("Our rate table diverges from their spawn distribution."); process.exit(1); }
console.log("Our spawn rate table matches their sequential 1-in-X model's marginals. The active-node count differs only by our 6-node-per-floor minimum, which their source-faithful model does not impose.");
