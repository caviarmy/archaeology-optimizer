// Quality + timing check for the guided search.
//   node test/quality-check.js [level]
// Compares, at HIGH fidelity (K=300, common seeds):
//   - guided search best   (sim-driven)
//   - EV best              (fastSearch)
//   - neighborhood brute force around the guided best (is it a local max?)
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const level = Number(process.argv[2] || 100);
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const vc = new VirtualConsole();
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom; const W = window; const doc = window.document;
window.performance = window.performance || { now: () => Date.now() };

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

const inp = W.getInputs();
const blocks = W.visibleBlocks(inp);
const spec = W.activeSkillSpec(inp);
const keys = spec.map(s=>s[0]);
const caps = Object.fromEntries(spec);
const lbl = st => keys.map(k=>st[k]||0).join("/");

function rate(st, runs){   // high-fidelity rewards/hr, common seeds
  let seed=777; const rng=()=>{ seed=(Math.imul(seed,1103515245)+12345)>>>0; return seed/4294967296; };
  let val=0, sec=0;
  for(let r=0;r<runs;r++){ const s=W.simulateOneRun(st,inp,blocks,rng); val+=s.totalValue; sec+=s.timeSec; }
  return val/Math.max(1e-9,sec)*3600;
}

(async () => {
  const t0=Date.now();
  const _tl = Math.max(10, inp.mcTopCount||10);
  let res = await W.exhaustiveSearch(inp, blocks, level, _tl, null);
  if(res.bailed){ const _all = W.fastSearch(inp, blocks, level); res = { topBuilds: W.rankCandidates(_all, inp).slice(0, _tl), count: _all.length }; }
  const guidedSecs=((Date.now()-t0)/1000).toFixed(1);
  const guided = res.topBuilds[0].stats;
  const evBest = W.rankCandidates(W.fastSearch(inp, blocks, level), inp)[0].stats;

  const K=300;
  const gv = rate(guided, K), ev = rate(evBest, K);

  // neighborhood brute force: all 1- and 2-point shifts around guided best
  let best=guided, bestV=gv, tried=0;
  const around=(st)=>{ const out=[]; for(const f of keys){ if((st[f]||0)<=0) continue; for(const t of keys){ if(f===t||(st[t]||0)>=caps[t]) continue; const ns={...st}; ns[f]--; ns[t]++; out.push(ns); } } return out; };
  const set2=new Set([lbl(guided)]); const frontier=around(guided);
  for(const b of around(guided)) for(const b2 of around(b)){ const k=lbl(b2); if(!set2.has(k)){set2.add(k); frontier.push(b2);} }
  for(const b of frontier){ const v=rate(b,K); tried++; if(v>bestV){bestV=v; best=b;} }

  console.log(`level=${level}`);
  console.log(`estimate      : ${guidedSecs}s, ${res.count} builds scored`);
  console.log(`guided best   : ${lbl(guided)}  high-fidelity rate ${gv.toFixed(0)}`);
  console.log(`EV best       : ${lbl(evBest)}  high-fidelity rate ${ev.toFixed(0)}  (${((gv/ev-1)*100).toFixed(2)}% worse than guided)`);
  console.log(`neighborhood best (${tried} tried): ${lbl(best)}  rate ${bestV.toFixed(0)}`);
  console.log(`guided is ${((bestV/gv-1)*100).toFixed(2)}% below neighborhood best`);
})();
