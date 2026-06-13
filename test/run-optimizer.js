// Headless harness: load index.html in jsdom, fill a stat set, run "Find best
// build", and report the result + timing. Lets us test the optimizer without a
// browser.  Usage:  node test/run-optimizer.js [level] [maxFloor]
//   (run from the repo root; needs `npm install jsdom` once)
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");

const level = Number(process.argv[2] || 100);
const maxFloor = Number(process.argv[3] || 50);
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(e.detail?.stack || e.message || String(e)));

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;
window.performance = window.performance || { now: () => Date.now() };

(async () => {
  const doc = window.document;
  const set = (id, v) => { const el = doc.getElementById(id); if (el) el.value = String(v); };
  // A representative level-100 A2 stat set.
  Object.entries({
    selectedLevel: level, maxFloor,
    baseDamage:1396, baseStamina:932, baseCritChance:66.25, baseCritDamage:4.21,
    baseSuperChance:60.75, baseSuperDamage:3.11, baseXpGain:11.31, baseFragGain:9.17,
    baseXpMod:11.35, baseXpModGain:6.81, baseLootMod:19.85, baseLootModGain:8.73,
    baseSpeedMod:8.1, baseStaminaMod:14.7, staminaModGain:12, baseArmorPenFlat:881, baseAtkSpeed:2
  }).forEach(([k,v]) => set(k, v));

  try {
    const t0 = Date.now();
    await window.runExact();
    const secs = ((Date.now()-t0)/1000).toFixed(1);
    console.log(`level=${level} maxFloor=${maxFloor}`);
    console.log("best build :", doc.getElementById("bestBuild").textContent);
    console.log("best score :", doc.getElementById("bestRph").textContent);
    console.log("candidates :", doc.getElementById("candidateCount").textContent);
    console.log("time       :", secs + "s");
  } catch (e) {
    console.log("runExact THREW:", e.stack || e.message || e);
  }
  if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
})();
