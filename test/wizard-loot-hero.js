// Regression: the guided-wizard result hero must show the actual goal metric
// (e.g. epic loot / hr) for a specific-loot goal, not the blended Rewards Score.
// The hero value is computed from simFocusValue(best, inp); this checks that
// resolves to the loot/hr for the chosen rarity and differs from rewardsPerHour.
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.detail?.stack || e.message || String(e)));
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
window.performance = window.performance || { now: () => Date.now() };
const doc = window.document;
const set = (id, v) => { const el = doc.getElementById(id); if (el) el.value = String(v); };

let pass = 0, fail = 0;
const ok = (name, cond, extra="") => { (cond ? pass++ : fail++); console.log((cond?"PASS":"FAIL")+" — "+name+(extra?" :: "+extra:"")); };

(async () => {
  if (window.HTMLElement) Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value(){}, writable:true });
  window.requestAnimationFrame = window.requestAnimationFrame || (cb => setTimeout(cb, 0));

  Object.entries({
    selectedLevel: 54, ascension: 2,
    baseDamage:1396, baseStamina:932, baseAtkSpeed:2, baseArmorPenFlat:881,
    baseCritChance:66.25, baseCritDamage:4.21, baseSuperChance:60.75, baseSuperDamage:3.11,
    baseUltraChance:22.50, baseUltraDamage:4.84,
    baseInstacharge:11.50, baseAutoTap:55.60, baseGoldCrosshairChance:20, baseGoldCrosshairMulti:3,
    baseXpGain:11.31, baseFragGain:9.17, baseXpMod:11.35, baseXpModGain:6.81,
    baseLootMod:19.85, baseLootModGain:8.73, baseSpeedMod:8.10, baseSpeedModGain:30, baseSpeedModAtkRate:2,
    baseStaminaMod:14.70, staminaModGain:10, baseGleamingChance:3, baseGleamingMulti:3.72,
    mcRunsPerBuild: 300, mcTopCount: 20
  }).forEach(([k,v]) => set(k, v));

  set("primaryGoal", "epic");
  doc.getElementById("primaryGoal").dispatchEvent(new window.Event("change", { bubbles:true }));

  const inp = window.getInputs();
  ok("primaryFocusKey is epic", window.primaryFocusKey(inp) === "epic", window.primaryFocusKey(inp));

  await window.runFullSimulation();
  const results = window.__simResults || [];
  ok("have results", results.length > 0);
  const best = results.find(r => r.simRank === 1) || results[0];

  const heroVal = window.simFocusValue(best, inp);   // what the wizard hero now uses
  const epicLoot = best.lootPerHour && best.lootPerHour.epic;

  ok("hero value equals epic loot/hr", Math.abs(heroVal - epicLoot) < 1e-6,
     `hero=${heroVal} lootPerHour.epic=${epicLoot}`);
  ok("hero value is NOT the Rewards Score", Math.abs(heroVal - best.rewardsPerHour) > 1e-6,
     `hero=${heroVal} rewardsPerHour=${best.rewardsPerHour}`);
  ok("epic loot/hr is a positive number", Number.isFinite(epicLoot) && epicLoot > 0, String(epicLoot));

  if (errors.length) console.log("\nPAGE ERRORS:\n"+errors.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
