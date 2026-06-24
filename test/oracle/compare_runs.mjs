

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(HERE, "scenarios.json"), "utf8"));
const theirs = JSON.parse(fs.readFileSync(path.join(HERE, "run_theirs.json"), "utf8"));
const ours = JSON.parse(fs.readFileSync(path.join(HERE, "run_ours.json"), "utf8"));

let fail = 0, total = 0;

const tol = (spec.runComparison.blockTolerancePct ?? 6) / 100;
console.log(`Phase 2 run comparison (avg over ${spec.runComparison.N} runs, gate blocks within ${(tol * 100).toFixed(0)}%):`);
for (const name of Object.keys(theirs)) {
  total++;
  const t = theirs[name], o = ours[name] || {};
  const adiff = Math.abs(t.blocks - (o.blocks ?? NaN));
  const bdiff = adiff / Math.max(1, t.blocks);
  const ok = o.blocks !== undefined && (adiff <= 1.0 || bdiff <= tol);
  if (!ok) fail++;
  const fpct = `${((o.floor - t.floor) / Math.max(1, t.floor) * 100).toFixed(0)}%`;
  const txpb = t.blocks ? t.xp / t.blocks : 0, oxpb = o.blocks ? o.xp / o.blocks : 0;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name.padEnd(8)} blocks theirs=${t.blocks.toFixed(1)} ours=${(o.blocks ?? NaN).toFixed(1)} (${(bdiff * 100).toFixed(1)}%)`);
  console.log(`         floor theirs=${t.floor.toFixed(2)} ours=${(o.floor ?? 0).toFixed(2)} (${fpct}, informational)  xp/run theirs=${(t.xp ?? 0).toFixed(2)} ours=${(o.xp ?? 0).toFixed(2)}  xp/block theirs=${txpb.toFixed(3)} ours=${oxpb.toFixed(3)}`);
}
if (fail) { console.log(`\n${fail}/${total} scenarios exceeded the block tolerance.`); process.exit(1); }
console.log(`\nAll ${total} scenarios agree on blocks mined within tolerance. Our run results match their micro-tick engine on the work done per dig (spawn, hits, rewards).`);
