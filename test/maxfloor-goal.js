// Ad-hoc verification for the new "Max floor" goal. Loads index.html in jsdom,
// exercises the goal end to end at a small run count, and asserts the metric behaves.
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
    selectedLevel: 60, ascension: 2,
    baseDamage:1396, baseStamina:932, baseAtkSpeed:2, baseArmorPenFlat:881,
    baseCritChance:66.25, baseCritDamage:4.21, baseSuperChance:60.75, baseSuperDamage:3.11,
    baseUltraChance:22.50, baseUltraDamage:4.84,
    baseInstacharge:11.50, baseAutoTap:55.60, baseGoldCrosshairChance:20, baseGoldCrosshairMulti:3,
    baseXpGain:11.31, baseFragGain:9.17, baseXpMod:11.35, baseXpModGain:6.81,
    baseLootMod:19.85, baseLootModGain:8.73, baseSpeedMod:8.10, baseSpeedModGain:30, baseSpeedModAtkRate:2,
    baseStaminaMod:14.70, staminaModGain:10, baseGleamingChance:3, baseGleamingMulti:3.72,
    mcRunsPerBuild: 300, mcTopCount: 20
  }).forEach(([k,v]) => set(k, v));

  // Select the Max floor goal.
  set("primaryGoal", "maxFloor");
  doc.getElementById("primaryGoal").dispatchEvent(new window.Event("change", { bubbles:true }));

  // 1. The success-rate field becomes visible (body dataset toggled).
  ok("success-rate field shown for Max floor", doc.body.dataset.maxfloor === "true",
     "dataset.maxfloor="+doc.body.dataset.maxfloor);
  ok("success-rate input exists", !!doc.getElementById("maxFloorSuccessMin"));

  // 2. getInputs wires successRateMin and primaryFocusKey resolves to maxFloor.
  const inp = window.getInputs();
  ok("primaryFocusKey is maxFloor", window.primaryFocusKey(inp) === "maxFloor", window.primaryFocusKey(inp));
  ok("goal.successRateMin defaults to 3", inp.goal.successRateMin === 3, String(inp.goal.successRateMin));

  // 3. aggregateBuildSim exposes a maxFloor quantile, and a stricter success rate
  //    (higher %) yields a shallower-or-equal floor than a lenient one.
  const blocks = window.visibleBlocks(inp);
  const stats = window.fullStats({S:20,A:10,I:10,P:10,L:5,D:0,C:5});
  const mk = (sMin) => {
    const inp2 = window.getInputs(); inp2.goal.successRateMin = sMin;
    const rng = window.makeSimRng ? window.makeSimRng(inp2) : null;
    const r = window.aggregateBuildSim(stats, inp2, blocks, 400, (window.mulberry32 ? window.mulberry32(12345) : Math.random));
    return r;
  };
  const lenient = mk(1);    // reachable 1% of the time -> deepest
  const strict  = mk(50);   // reachable 50% of the time -> ~median
  ok("maxFloor is a finite number", Number.isFinite(lenient.maxFloor), String(lenient.maxFloor));
  ok("maxFloorPct reported and >= requested min", Number.isFinite(strict.maxFloorPct) && strict.maxFloorPct >= 50 - 1e-9,
     `requested 50%, actual ${strict.maxFloorPct}%`);
  ok("lenient maxFloorPct >= 1%", lenient.maxFloorPct >= 1 - 1e-9, `${lenient.maxFloorPct}%`);
  ok("stricter success rate <= lenient (deeper tail at low %)", strict.maxFloor <= lenient.maxFloor,
     `strict(50%)=${strict.maxFloor} lenient(1%)=${lenient.maxFloor}`);
  ok("maxFloor(1%) >= median floor p50", lenient.maxFloor >= lenient.p50,
     `maxFloor=${lenient.maxFloor} p50=${lenient.p50}`);

  // 4. metricValue routes maxFloor correctly for an MC row and a deterministic row.
  ok("metricValue uses row.maxFloor", window.metricValue({maxFloor:123, floorReached:50}, "maxFloor", inp) === 123);
  ok("metricValue falls back to floorReached (deterministic)",
     window.metricValue({floorReached:77}, "maxFloor", inp) === 77);

  // 5. Full run end to end: hero card shows the Max floor label.
  try {
    await window.runFullSimulation();
    const heroLabels = Array.from(doc.getElementById("simHero").querySelectorAll(".metric .k")).map(e=>e.textContent);
    ok("hero card shows a Max floor tile", heroLabels.includes("Max floor"), heroLabels.join(" | "));
    ok("hero card shows a Reach chance tile", heroLabels.includes("Reach chance"), heroLabels.join(" | "));
    const results = window.__simResults || [];
    ok("sim results carry maxFloor", results.length>0 && results.every(r=>r.maxFloor!=null),
       results.length? ("first.maxFloor="+results[0].maxFloor) : "no results");
  } catch(e){ ok("runFullSimulation completes", false, e.message); }

  if (errors.length) console.log("\nPAGE ERRORS:\n"+errors.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail? 1 : 0);
})();
