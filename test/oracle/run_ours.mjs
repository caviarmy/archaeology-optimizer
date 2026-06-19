// Run each scenario through OUR engine (getDerived in index.html) and emit the
// same derived-stat keys to ours.json, so compare.mjs can diff us vs lobogrande.
// Zero upgrades, zero cards, "Attributes at 0" mode: base fields ARE the base,
// and the scenario's attribute points are added by getDerived.
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(HERE, "scenarios.json"), "utf8"));
const html = fs.readFileSync(path.join(HERE, "..", "..", "index.html"), "utf8");

const vc = new VirtualConsole(); const errs = [];
vc.on("jsdomError", e => errs.push(String(e.detail || e)));
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
const W = dom.window, d = W.document;
W.performance = W.performance || { now: () => Date.now() };

setTimeout(() => {
  d.body.dataset.landing = "false";
  const set = (id, v) => { const e = d.getElementById(id); if (e) { if (e.type === "checkbox") e.checked = !!v; else e.value = v; e.dispatchEvent(new W.Event("change", { bubbles: true })); } };

  // Base constants matched to their hardcoded zero-upgrade bases.
  set("selectedLevel", "100");
  set("baseDamage", String(spec.baseDamageConst));
  set("baseStamina", String(spec.baseStaminaConst));
  set("baseCritChance", "0");
  set("baseCritDamage", String(spec.baseCritDamage));
  set("baseSuperChance", "0");
  set("baseSuperDamage", String(spec.baseSuperDamage));
  set("baseUltraChance", "0");
  set("baseUltraDamage", "3");
  set("baseArmorPenFlat", "0");
  d.getElementById("baseStatModeZero").checked = true;
  if (typeof W.setAllUpgrades === "function") W.setAllUpgrades(false); // clear every upgrade
  d.dispatchEvent(new W.Event("change", { bubbles: true }));

  const out = {};
  for (const sc of spec.scenarios) {
    set("ascension", String(sc.asc));
    const inp = W.getInputs();
    const b = sc.build;
    // Ascension gating is enforced upstream of getDerived (activeSkillSpec never
    // allocates a locked stat), so mirror it here: zero Div below A1, Corr below A2.
    const stats = {
      S: b.S, A: b.A, P: b.P, I: b.I, L: b.L,
      D: sc.asc >= 1 ? b.D : 0,
      C: sc.asc >= 2 ? b.C : 0,
    };
    const der = W.getDerived(stats, inp);
    out[sc.name] = {
      damage:          der.damage,
      maxSta:          der.stamina,
      armorPen:        der.armorPenFlat * (1 + (der.armorPenPct || 0)),
      critChance:      der.critChance,
      critDmgMult:     der.critDamage,
      superCritChance: der.superChance,
      superCritMult:   der.superDamage,
      ultraCritChance: der.ultraChance,
    };
  }
  // --- Block HP/armor across the deep-floor scaling ---
  const blocksOut = {};
  const bc = spec.blockChecks;
  if (bc) {
    set("ascension", "2");
    const inp = W.getInputs();
    const vb = W.visibleBlocks(inp);            // base hp/armor per block (zero cards)
    const TYPE = { dirt: "dirt", com: "common", rare: "rare", epic: "epic", leg: "legendary", myth: "mythic", div: "divine" };
    for (const id of bc.ids) {
      const m = id.match(/^([a-z]+)(\d+)$/);
      const type = TYPE[m[1]], tier = +m[2];
      const base = vb.find(b => b.type === type && b.tier === tier);
      blocksOut[id] = {};
      for (const fl of bc.floors) {
        const ss = W.stageScale(fl);
        blocksOut[id][String(fl)] = { hp: base.hp * ss.hp, armor: (base.armor || 0) * ss.armor };
      }
    }
  }

  fs.writeFileSync(path.join(HERE, "ours.json"), JSON.stringify({ stats: out, blocks: blocksOut }, null, 2));
  console.log(`wrote ours.json (${Object.keys(out).length} stat scenarios, ${Object.keys(blocksOut).length} block ids)` + (errs.length ? `  [jsdom notes: ${errs.length}]` : ""));
  process.exit(0);
}, 500);
