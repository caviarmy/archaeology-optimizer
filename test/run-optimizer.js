

const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const path = require("path");

const level = Number(process.argv[2] || 100);

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

  Object.entries({
    selectedLevel: level, ascension: 2,
    baseDamage:1396, baseStamina:932, baseAtkSpeed:2, baseArmorPenFlat:881,
    baseCritChance:66.25, baseCritDamage:4.21, baseSuperChance:60.75, baseSuperDamage:3.11,
    baseUltraChance:22.50, baseUltraDamage:4.84,
    baseInstacharge:11.50, baseAutoTap:55.60, baseGoldCrosshairChance:20, baseGoldCrosshairMulti:3,
    baseXpGain:11.31, baseFragGain:9.17, baseXpMod:11.35, baseXpModGain:6.81,
    baseLootMod:19.85, baseLootModGain:8.73, baseSpeedMod:8.10, baseSpeedModGain:30, baseSpeedModAtkRate:2,
    baseStaminaMod:14.70, staminaModGain:10, baseGleamingChance:3, baseGleamingMulti:3.72
  }).forEach(([k,v]) => set(k, v));

  try {
    const t0 = Date.now();
    if (window.HTMLElement) Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value(){}, writable:true });
    window.requestAnimationFrame = window.requestAnimationFrame || (cb => setTimeout(cb, 0));
    await window.runFullSimulation();
    const secs = ((Date.now()-t0)/1000).toFixed(1);
    console.log(`level=${level}`);

    const hero = Array.from(doc.getElementById("simHero").querySelectorAll(".metric"))
      .map(m => `${m.querySelector(".k").textContent}=${m.querySelector(".v").textContent}`);
    console.log("best build :", hero.join(" | "));
    console.log("time       :", secs + "s");
  } catch (e) {
    console.log("runFullSimulation THREW:", e.stack || e.message || e);
  }
  if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
})();
