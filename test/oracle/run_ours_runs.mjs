// Phase 2 (our side): run a full dig many times per scenario via simulateOneRun
// and report the average floor reached (and blocks mined), with the same matched
// config (zero upgrades/cards, refunds/crosshairs/abilities off). Writes
// run_ours.json.
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(fs.readFileSync(path.join(HERE, "scenarios.json"), "utf8"));
const rc = spec.runComparison, N = rc.N;
const html = fs.readFileSync(path.join(HERE, "..", "..", "index.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
const W = dom.window, d = W.document;
W.performance = W.performance || { now: () => Date.now() };

setTimeout(() => {
  d.body.dataset.landing = "false";
  const set = (id, v) => { const e = d.getElementById(id); if (e) { if (e.type === "checkbox") e.checked = !!v; else e.value = v; e.dispatchEvent(new W.Event("change", { bubbles: true })); } };
  // Matched base config: same zero-upgrade bases as the stat oracle, and refunds
  // (stamina mod), crosshairs (auto-tap), and speed off so the dig is comparable.
  set("baseDamage", String(spec.baseDamageConst)); set("baseStamina", String(spec.baseStaminaConst));
  set("baseCritChance", "0"); set("baseCritDamage", String(spec.baseCritDamage));
  set("baseSuperChance", "0"); set("baseSuperDamage", String(spec.baseSuperDamage)); set("baseUltraChance", "0");
  set("baseArmorPenFlat", "0"); set("baseStaminaMod", "0"); set("staminaModGain", "0");
  set("baseAutoTap", "0"); set("baseSpeedModGain", "0");
  // XP: base gain 1 to match their zero-upgrade exp_gain_mult base; no xp mods or
  // gleaming so per-block xp is just the block's value scaled by Intellect's gain.
  set("baseXpGain", "1"); set("baseFragGain", "1"); set("baseXpMod", "0"); set("baseLootMod", "0");
  set("baseGleamingChance", "0");
  d.getElementById("baseStatModeZero").checked = true;
  if (typeof W.setAllUpgrades === "function") W.setAllUpgrades(false);

  const mk = (s) => { let x = s >>> 0; return () => { x = (Math.imul(x, 1103515245) + 12345) >>> 0; return x / 4294967296; }; };
  const out = {};
  for (const sc of rc.scenarios) {
    set("selectedLevel", String(sc.level)); set("ascension", String(sc.asc));
    const inp = W.getInputs(), blocks = W.visibleBlocks(inp);
    const b = sc.build, st = { S: b.S, A: b.A, P: b.P, I: b.I, L: b.L, D: sc.asc >= 1 ? b.D : 0, C: sc.asc >= 2 ? b.C : 0 };
    let fl = 0, blk = 0, xp = 0;
    for (let s = 0; s < N; s++) {
      const r = W.simulateOneRun(st, inp, blocks, mk(1000 + s));
      fl += r.floorReached;
      blk += Object.values(r.blockCounts || {}).reduce((a, c) => a + c, 0);
      xp += (r.channels && r.channels.xp) || 0;
    }
    out[sc.name] = { floor: fl / N, blocks: blk / N, xp: xp / N };
  }
  fs.writeFileSync(path.join(HERE, "run_ours.json"), JSON.stringify(out, null, 2));
  console.log(`wrote run_ours.json (${Object.keys(out).length} scenarios x ${N} runs)`);
  process.exit(0);
}, 500);
