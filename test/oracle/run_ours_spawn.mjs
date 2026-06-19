// Spawn model (our side): our rate table IS the per-slot marginal probability, so
// we report it analytically (no sampling) plus our expected active-node count.
// Our model: 24 slots, first 6 guaranteed filled, remaining 18 rolled at the
// per-slot rate. Expected active = 6 + 18 * p, where p = rate-sum/100. Writes
// spawn_ours.json. The 6-node minimum is the known divergence from their model.
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(HERE, "scenarios.json"), "utf8"));
const sc = spec.spawnComparison;
const html = fs.readFileSync(path.join(HERE, "..", "..", "index.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
const W = dom.window, d = W.document;
W.performance = W.performance || { now: () => Date.now() };

setTimeout(() => {
  d.body.dataset.landing = "false";
  const set = (id, v) => { const e = d.getElementById(id); if (e) { if (e.type === "checkbox") e.checked = !!v; else e.value = v; e.dispatchEvent(new W.Event("change", { bubbles: true })); } };
  set("ascension", "2");
  const inp = W.getInputs();
  const TYPES = ["dirt", "common", "rare", "epic", "legendary", "mythic", "divine"];
  const out = {};
  for (const fl of sc.floors) {
    const rates = W.ratesForFloor(fl, inp);                 // per-slot marginal %, by rarity
    const total = TYPES.reduce((s, t) => s + (rates[t] || 0), 0);
    const p = Math.min(1, total / 100);
    out[String(fl)] = {
      expectedActive: 6 + 18 * p,                           // 6 guaranteed + 18 rolled
      rarityProb: Object.fromEntries(TYPES.map(t => [t, (rates[t] || 0) / 100])),
    };
  }
  fs.writeFileSync(path.join(HERE, "spawn_ours.json"), JSON.stringify(out, null, 2));
  console.log(`wrote spawn_ours.json (${Object.keys(out).length} floors)`);
  process.exit(0);
}, 500);
