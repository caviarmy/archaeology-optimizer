// Loads the user's actual debug config and runs the guided search, comparing the
// pick against the EV pick at high fidelity. This is the scenario where the EV was
// over-crediting STR-heavy builds.
//   node test/user-config.js <path-to-debug.json>
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const jsonPath = process.argv[2];
const dbg = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const vc = new VirtualConsole();
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom; const W = window; const doc = window.document;
window.performance = window.performance || { now: () => Date.now() };

(async () => {
  if (W.populateCardSettings) W.populateCardSettings();
  // Apply every raw form value from the debug snapshot.
  for (const [id, v] of Object.entries(dbg.inputs)) {
    const el = doc.getElementById(id);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!v;
    else el.value = String(v);
  }
  // Force the smart (non-thorough) guided path.
  const th = doc.getElementById("thoroughSearch"); if (th) th.checked = false;

  const inp = W.getInputs();
  const blocks = W.visibleBlocks(inp);
  const level = inp.selectedLevel;
  const spec = W.activeSkillSpec(inp);
  const keys = spec.map(s=>s[0]);
  const lbl = st => keys.map(k=>st[k]||0).join("/");

  function rate(st, runs){
    let seed=2024; const rng=()=>{ seed=(Math.imul(seed,1103515245)+12345)>>>0; return seed/4294967296; };
    let val=0, sec=0;
    for(let r=0;r<runs;r++){ const s=W.simulateOneRun(st,inp,blocks,rng); val+=s.totalValue; sec+=s.timeSec; }
    return val/Math.max(1e-9,sec)*3600;
  }

  const t0=Date.now();
  const res = await W.simGuidedSearch(inp, blocks, level, null);
  const secs=((Date.now()-t0)/1000).toFixed(1);
  const guided = res.topBuilds[0].stats;
  const evBest = W.rankCandidates(W.fastSearch(inp, blocks, level), inp)[0].stats;
  const exh = await W.exhaustiveSearch(inp, blocks, level, Math.max(10,inp.mcTopCount), null);
  const exhEvBest = exh.bailed ? null : exh.topBuilds[0].stats;

  const K=400;
  console.log(`level=${level} goal=${W.primaryFocusKey(inp)} sec=${W.secondaryFocusKey(inp)}`);
  console.log(`guided search : ${secs}s, ${res.count} builds tried, K-adaptive`);
  console.log(`guided best   : ${lbl(guided)}   hi-fi rate ${rate(guided,K).toFixed(1)}`);
  console.log(`EV best (fast): ${lbl(evBest)}   hi-fi rate ${rate(evBest,K).toFixed(1)}`);
  if(exhEvBest) console.log(`EV best (exh) : ${lbl(exhEvBest)}   hi-fi rate ${rate(exhEvBest,K).toFixed(1)}`);
  const gv=rate(guided,K), ev=rate(evBest,K);
  console.log(`guided is ${((gv/ev-1)*100).toFixed(2)}% better than the EV pick (hi-fi)`);
})();
