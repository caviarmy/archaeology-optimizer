// Self-contained unit tests for our core math (no network, no oracle). These pin
// the formulas the oracle validates plus the ones it does not reach: hits-to-kill
// breakpoints and overkill. Run: node test/unit/formulas.mjs
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(HERE, "..", "..", "index.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
const W = dom.window, d = W.document;
W.performance = W.performance || { now: () => Date.now() };

let pass = 0, fail = 0;
const approx = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
function check(name, got, want, tol) {
  const ok = (typeof want === "number" && isFinite(want)) ? approx(got, want, tol ?? 1e-6) : got === want;
  if (ok) { pass++; } else { fail++; console.log(`  FAIL ${name}: got ${got}, want ${want}`); }
}

setTimeout(() => {
  d.body.dataset.landing = "false";
  const set = (id, v) => { const e = d.getElementById(id); if (e) { if (e.type === "checkbox") e.checked = !!v; else e.value = v; e.dispatchEvent(new W.Event("change", { bubbles: true })); } };
  // Zero-upgrade base config so per-point coefficients are the bare game values.
  set("selectedLevel", "100"); set("ascension", "2");
  set("baseDamage", "10"); set("baseStamina", "100");
  set("baseCritChance", "0"); set("baseCritDamage", "1.5");
  set("baseSuperChance", "0"); set("baseSuperDamage", "2");
  set("baseUltraChance", "0"); set("baseArmorPenFlat", "0");
  d.getElementById("baseStatModeZero").checked = true;
  if (typeof W.setAllUpgrades === "function") W.setAllUpgrades(false);
  const inp = W.getInputs();

  // --- Derived stats (oracle-confirmed; pinned here for offline CI) ---
  const dStr = W.getDerived({ S: 30, A: 0, P: 0, I: 0, L: 0, D: 0, C: 0 }, inp);
  check("damage pooling: (10+30)*(1+0.30)", dStr.damage, 52, 1e-6);
  check("crit damage: 1.5*(1+0.03*30)", dStr.critDamage, 1.5 * (1 + 0.03 * 30), 1e-9);
  const dAgi = W.getDerived({ S: 0, A: 40, P: 0, I: 0, L: 0, D: 0, C: 0 }, inp);
  check("stamina: 100 + 5*40", dAgi.stamina, 300, 1e-6);
  check("crit chance: 0.01*40", dAgi.critChance, 0.40, 1e-9);
  const dCorr = W.getDerived({ S: 30, A: 0, P: 0, I: 0, L: 0, D: 0, C: 10 }, inp);
  check("corr damage%: (10+30)*(1+0.30+0.60)", dCorr.damage, 40 * 1.9, 1e-6);
  const dPI = W.getDerived({ S: 0, A: 0, P: 25, I: 25, L: 0, D: 0, C: 0 }, inp);
  check("armor pen: (0+2*25)*(1+0.03*25)", dPI.armorPenFlat * (1 + dPI.armorPenPct), 50 * 1.75, 1e-6);

  // --- hits-to-kill breakpoints + overkill (crit-free => ceil(hp/dmg)) ---
  const blocks = W.visibleBlocks(inp);
  const der = W.getDerived({ S: 0, A: 0, P: 0, I: 0, L: 0, D: 0, C: 0 }, inp); // 0 crit chance
  const hits = (hp, dmg) => { const dd = { ...der, evDamage: dmg, damage: dmg, critChance: 0, superChance: 0, ultraChance: 0 }; return W.expectedHitsFull(hp, dd, inp, 0); };
  check("1-shot at exactly hp", hits(250, 250), 1, 1e-9);
  check("overkill still 1 hit (dmg>hp)", hits(250, 300), 1, 1e-9);
  check("just under 1-shot needs 2", hits(250, 200), 2, 1e-9);
  check("breakpoint: 250/50 = 5 hits", hits(250, 50), 5, 1e-9);
  check("breakpoint: 250/51 = ceil 5", hits(250, 51), 5, 1e-9);
  check("breakpoint: 250/84 = ceil 3", hits(250, 84), 3, 1e-9);
  check("breakpoint: 250/125 = 2 hits", hits(250, 125), 2, 1e-9);
  check("unbreakable when dmg<=armor", W.expectedHitsFull(250, { ...der, evDamage: 40, damage: 40, critChance: 0 }, inp, 50), Infinity);

  console.log(`unit formulas: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 500);
