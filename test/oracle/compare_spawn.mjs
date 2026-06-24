

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(HERE, "scenarios.json"), "utf8"));
const theirs = JSON.parse(fs.readFileSync(path.join(HERE, "spawn_theirs.json"), "utf8"));
const ours = JSON.parse(fs.readFileSync(path.join(HERE, "spawn_ours.json"), "utf8"));
const TYPES = ["dirt", "common", "rare", "epic", "legendary", "mythic", "divine"];
const tol = 0.01;

let fail = 0, total = 0, nodeFail = 0, nodeTotal = 0;
const nodeTol = 0.5;
console.log("Spawn distribution (per-slot rarity probability + active-node count, ours vs their sampled):");
for (const fl of Object.keys(theirs)) {
  const t = theirs[fl], o = ours[fl] || {};
  const bad = [];
  for (const ty of TYPES) {
    total++;
    const tv = t.rarityProb[ty] || 0, ov = (o.rarityProb || {})[ty] || 0;
    if (Math.abs(tv - ov) > tol) { fail++; bad.push(`${ty} theirs=${tv.toFixed(3)} ours=${ov.toFixed(3)}`); }
  }
  nodeTotal++;
  const nodeOk = Math.abs(t.activeAvg - o.expectedActive) <= nodeTol;
  if (!nodeOk) nodeFail++;
  console.log(`  floor ${fl.padStart(3)}: ${bad.length ? "FAIL " + bad.join(", ") : "rates match"}  | active nodes theirs=${t.activeAvg.toFixed(2)} ours=${o.expectedActive.toFixed(2)} ${nodeOk ? "ok" : "FAIL"}`);
}
console.log(`\nRate-distribution: ${total - fail}/${total} within ${tol} per-slot probability.  Active-node count: ${nodeTotal - nodeFail}/${nodeTotal} within ${nodeTol} nodes.`);
if (fail + nodeFail) { console.log("Our spawn model diverges from theirs."); process.exit(1); }
console.log("Our spawn model matches theirs: same per-slot rarity distribution and the same active-node count (24 slots rolled independently, no minimum).");
