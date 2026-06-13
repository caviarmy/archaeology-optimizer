// Validates the fast search against the exhaustive search across many randomized
// scenarios at moderate levels (where exhaustive is quick). Reports how often the
// fast search's best build matches the provably-optimal exhaustive one.
//   node test/validate-search.js [numScenarios]
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const vc = new VirtualConsole();
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom; const W = window; const doc = window.document;
window.performance = window.performance || { now: () => Date.now() };

// seeded RNG for reproducibility (override Math.random)
let _seed = (Number(process.argv[3]||12345))>>>0;
Math.random = ()=>{ _seed = (_seed + 0x6D2B79F5)|0; let t = Math.imul(_seed ^ _seed>>>15, 1|_seed); t = (t + Math.imul(t ^ t>>>7, 61|t)) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; }; // mulberry32
const N = Number(process.argv[2] || 40);
const set = (id,v)=>{ const el=doc.getElementById(id); if(el) el.value=String(v); };
const setChecked = (id,v)=>{ const el=doc.getElementById(id); if(el) el.checked=!!v; };
const opts = id => Array.from(doc.getElementById(id).options).map(o=>o.value);
const rnd = (a,b)=>a+Math.random()*(b-a);
const rndi = (a,b)=>Math.floor(rnd(a,b+1));
const pick = arr => arr[rndi(0,arr.length-1)];

const primaryOpts = opts("primaryGoal");
const secondaryOpts = opts("secondaryGoal");
const ascOpts = opts("ascension");

(async () => {
  let pass=0, fail=0; const fails=[];
  for(let i=0;i<N;i++){
    // randomize a scenario
    const lvl = rndi(22,34), mf = rndi(12,22);
    set("selectedLevel", lvl); set("maxFloor", mf);
    set("ascension", pick(ascOpts));
    set("primaryGoal", pick(primaryOpts));
    set("secondaryGoal", pick(secondaryOpts));
    set("targetFloor", rndi(5, mf));
    // protection mode + tolerance
    const useTol = Math.random()<0.4;
    setChecked("primaryProtectionTolerance", useTol); setChecked("primaryProtectionStrict", !useTol);
    set("primaryToleranceValue", rndi(1,15));
    // randomize base stats
    set("baseDamage", rnd(80,2200).toFixed(1));
    set("baseStamina", rnd(120,1000).toFixed(0));
    set("baseCritChance", rnd(0,70).toFixed(2)); set("baseCritDamage", rnd(1.5,5).toFixed(2));
    set("baseSuperChance", rnd(0,60).toFixed(2)); set("baseSuperDamage", rnd(1.5,4).toFixed(2));
    set("baseXpGain", rnd(1,12).toFixed(2)); set("baseFragGain", rnd(1,10).toFixed(2));
    set("baseXpMod", rnd(0,20).toFixed(2)); set("baseXpModGain", rnd(3,8).toFixed(2));
    set("baseLootMod", rnd(0,20).toFixed(2)); set("baseLootModGain", rnd(3,9).toFixed(2));
    set("baseSpeedMod", rnd(0,15).toFixed(2)); set("baseStaminaMod", rnd(0,15).toFixed(2));
    set("staminaModGain", rndi(3,15)); set("baseArmorPenFlat", rndi(0,900));

    const inp = W.getInputs();
    const blocks = W.visibleBlocks(inp);
    const level = inp.selectedLevel;
    const pk = W.primaryFocusKey(inp), sk = W.secondaryFocusKey(inp);
    const topLimit = Math.max(10, inp.mcTopCount);

    const exact = (await W.exhaustiveSearch(inp, blocks, level, topLimit, null)).topBuilds[0];
    const fastBest = W.rankCandidates(W.fastSearch(inp, blocks, level), inp)[0];

    const mv = (c,k)=>W.metricValue(c,k,inp);
    const eps = (a)=>1e-6*Math.max(1,Math.abs(a));
    let ok=true, why="";
    const ep=mv(exact,pk), fp=mv(fastBest,pk);
    if(ep > fp + eps(ep)){ ok=false; why=`primary ${pk}: exact ${ep.toFixed(3)} > fast ${fp.toFixed(3)}`; }
    else if(sk!=="none" && Math.abs(ep-fp)<=eps(ep)){
      const es=mv(exact,sk), fsv=mv(fastBest,sk);
      if(es > fsv + eps(es)){ ok=false; why=`secondary ${sk}: exact ${es.toFixed(3)} > fast ${fsv.toFixed(3)}`; }
    }
    const s=exact.stats, f=fastBest.stats;
    if(ok){ pass++; console.log(`#${i} PASS lvl${level} mf${inp.maxFloor} pk=${pk} sk=${sk}`); }
    else { fail++; const msg=`#${i} FAIL lvl${level} mf${inp.maxFloor} pk=${pk} sk=${sk}: ${why} | exact ${s.S}/${s.A}/${s.P}/${s.I}/${s.L} vs fast ${f.S}/${f.A}/${f.P}/${f.I}/${f.L}`; console.log(msg); fails.push(msg); }
  }
  console.log(`\n=== fast vs exhaustive: ${pass}/${N} matched ===`);
  if(fails.length) console.log("MISMATCHES:\n"+fails.join("\n"));
})();
