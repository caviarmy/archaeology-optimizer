// Diff our derived stats against lobogrande's engine and report per field.
// Tolerances absorb their rounding (damage/stamina/pen rounded to int; crit
// multipliers to 2 decimals); anything larger is a real divergence to chase.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const theirsAll = JSON.parse(fs.readFileSync(path.join(HERE, "theirs.json"), "utf8"));
const oursAll = JSON.parse(fs.readFileSync(path.join(HERE, "ours.json"), "utf8"));
const theirs = theirsAll.stats || theirsAll;
const ours = oursAll.stats || oursAll;

// field -> tolerance check(theirVal, ourVal) => ok
const TOL = {
  damage:          (t, o) => Math.abs(t - o) <= Math.max(1.0, 0.002 * Math.abs(t)),
  maxSta:          (t, o) => Math.abs(t - o) <= Math.max(1.0, 0.002 * Math.abs(t)),
  armorPen:        (t, o) => Math.abs(t - o) <= Math.max(1.0, 0.002 * Math.abs(t)),
  critChance:      (t, o) => Math.abs(t - o) <= 1e-4,
  critDmgMult:     (t, o) => Math.abs(t - o) <= 0.02,
  superCritChance: (t, o) => Math.abs(t - o) <= 1e-4,
  superCritMult:   (t, o) => Math.abs(t - o) <= 0.02,
  ultraCritChance: (t, o) => Math.abs(t - o) <= 1e-4,
};
const FIELDS = Object.keys(TOL);

let fail = 0, total = 0;
const rows = [];
for (const name of Object.keys(theirs)) {
  const t = theirs[name], o = ours[name] || {};
  for (const f of FIELDS) {
    // The super-crit multiplier is irrelevant when super-crit chance is 0 (the
    // term is gated by the chance in combat). Their engine reports 0 there, ours
    // reports the latent base; both give identical damage, so skip that check.
    if (f === "superCritMult" && (t.superCritChance || 0) <= 0) continue;
    total++;
    const tv = t[f], ov = o[f];
    const ok = ov !== undefined && TOL[f](tv, ov);
    if (!ok) { fail++; rows.push(`  FAIL  ${name.padEnd(12)} ${f.padEnd(16)} theirs=${fmt(tv)}  ours=${fmt(ov)}  diff=${fmt(Math.abs((tv ?? 0) - (ov ?? 0)))}`); }
  }
}
function fmt(x) { return x === undefined ? "—" : (Math.abs(x) >= 100 ? x.toFixed(1) : x.toFixed(4)); }

console.log(`Oracle stat comparison: ${total - fail}/${total} field checks within tolerance across ${Object.keys(theirs).length} scenarios.`);

// --- Card HP/reward multipliers by rarity ---
const tc = theirsAll.cards || {}, oc = oursAll.cards || {};
let cfail = 0, ctotal = 0;
for (const name of Object.keys(tc)) {
  for (const f of ["hpMult", "rewardMult"]) {
    ctotal++;
    const tv = tc[name][f], ov = (oc[name] || {})[f];
    if (!(ov !== undefined && Math.abs(tv - ov) <= 1e-9)) { cfail++; rows.push(`  FAIL  card ${name.padEnd(14)} ${f.padEnd(11)} theirs=${fmt(tv)} ours=${fmt(ov)}`); }
  }
}
if (ctotal) console.log(`Oracle card comparison: ${ctotal - cfail}/${ctotal} multiplier checks across ${Object.keys(tc).length} rarities.`);

// --- Block HP/armor (deep-floor scaling incl. the floor-150/300 bugs) ---
const tb = theirsAll.blocks || {}, ob = oursAll.blocks || {};
let bfail = 0, btotal = 0;
const hpTol = (t, o) => Math.abs(t - o) <= Math.max(1.0, 0.002 * Math.abs(t));
// Their project_config rounds base armor to an integer (e.g. com4 = 22 vs our
// precise 22.46); that sub-1 base difference is amplified by the deep-floor armor
// scaling. 3% absorbs integer base-armor rounding while still catching any
// structural scaling error (a missed 150-skip or 300-double would be a large factor).
const arTol = (t, o) => Math.abs(t - o) <= Math.max(1.0, 0.03 * Math.abs(t));
for (const id of Object.keys(tb)) {
  for (const fl of Object.keys(tb[id])) {
    const t = tb[id][fl], o = (ob[id] || {})[fl] || {};
    btotal += 2;
    if (!(o.hp !== undefined && hpTol(t.hp, o.hp))) { bfail++; rows.push(`  FAIL  block ${id}@${fl} hp     theirs=${fmt(t.hp)} ours=${fmt(o.hp)}`); }
    if (!(o.armor !== undefined && arTol(t.armor, o.armor))) { bfail++; rows.push(`  FAIL  block ${id}@${fl} armor  theirs=${fmt(t.armor)} ours=${fmt(o.armor)}`); }
  }
}
if (btotal) console.log(`Oracle block comparison: ${btotal - bfail}/${btotal} hp/armor checks within tolerance across ${Object.keys(tb).length} block ids x ${Object.keys(tb[Object.keys(tb)[0]]||{}).length} floors.`);

const allFail = fail + cfail + bfail;
if (allFail) { console.log("Divergences:"); rows.forEach(r => console.log(r)); console.log(`\n${allFail} divergence(s).`); process.exit(1); }
else { console.log("All within tolerance. Our stat math (incl. skill-buff upgrades), card multipliers, and block model (incl. the floor-150/300 scaling bugs) match lobogrande's source-faithful engine."); }
