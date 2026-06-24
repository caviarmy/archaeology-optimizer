

const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const vc = new VirtualConsole();
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom; const W = window; const doc = window.document;
window.performance = window.performance || { now: () => Date.now() };

let _seed = (Number(process.argv[3]||12345))>>>0;
Math.random = ()=>{ _seed = (_seed + 0x6D2B79F5)|0; let t = Math.imul(_seed ^ _seed>>>15, 1|_seed); t = (t + Math.imul(t ^ t>>>7, 61|t)) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; };
const N = Number(process.argv[2] || 40);
const set = (id,v)=>{ const el=doc.getElementById(id); if(el) el.value=String(v); };
const setChecked = (id,v)=>{ const el=doc.getElementById(id); if(el) el.checked=!!v; };
const opts = id => Array.from(doc.getElementById(id).options).map(o=>o.value);
const rnd = (a,b)=>a+Math.random()*(b-a);
const rndi = (a,b)=>Math.floor(rnd(a,b+1));
const pick = arr => arr[rndi(0,arr.length-1)];

const REACHABLE = ["allRewards","xp","allLoot","common","rare"];
const ascOpts = opts("ascension");
const primaryOpts = ["target", ...REACHABLE].filter(g=>opts("primaryGoal").includes(g));
const secondaryOpts = ["none", ...REACHABLE].filter(g=>opts("secondaryGoal").includes(g));

(async () => {
  if(W.populateCardSettings) W.populateCardSettings();
  let pass=0, fail=0; const fails=[];
  for(let i=0;i<N;i++){

    const lvl = rndi(12,20);
    set("selectedLevel", lvl);
    set("ascension", pick(ascOpts));

    set("archInfernalMult", rnd(1, 2.5).toFixed(3));
    doc.querySelectorAll('[id^="card_t"]').forEach(el=>{
      if(el.tagName === "INPUT" && el.type === "hidden") el.value = Math.random() < 0.15 ? "infernal" : "none";
    });
    set("primaryGoal", pick(primaryOpts));
    set("secondaryGoal", pick(secondaryOpts));
    set("targetFloor", rndi(5, 20));

    const useTol = Math.random()<0.4;
    setChecked("primaryProtectionTolerance", useTol); setChecked("primaryProtectionStrict", !useTol);
    set("primaryToleranceValue", rndi(1,15));

    set("baseDamage", rnd(80,2200).toFixed(1));
    set("baseStamina", rnd(120,1000).toFixed(0));
    set("baseCritChance", rnd(0,70).toFixed(2)); set("baseCritDamage", rnd(1.5,5).toFixed(2));
    set("baseSuperChance", rnd(0,60).toFixed(2)); set("baseSuperDamage", rnd(1.5,4).toFixed(2));
    set("baseXpGain", rnd(1,12).toFixed(2)); set("baseFragGain", rnd(1,10).toFixed(2));
    set("baseXpMod", rnd(0,20).toFixed(2)); set("baseXpModGain", rnd(3,8).toFixed(2));
    set("baseLootMod", rnd(0,20).toFixed(2)); set("baseLootModGain", rnd(3,9).toFixed(2));
    set("baseSpeedMod", rnd(0,15).toFixed(2)); set("baseStaminaMod", rnd(0,15).toFixed(2));
    set("staminaModGain", rndi(3,10)); set("baseArmorPenFlat", rndi(0,900));

    set("modStrA0", rndi(0,5)); set("modStrA1", rndi(0,1));
    set("modCorrA2", rndi(0,10)); set("modDivA2", rndi(0,5));
    set("bonusDmgArpenA0", rndi(0,20)); set("bonusDmgExpA1", rndi(0,5));
    set("bonusArpenCdA0", rndi(0,10));

    const inp = W.getInputs();
    const blocks = W.visibleBlocks(inp);
    const level = inp.selectedLevel;
    const pk = W.primaryFocusKey(inp), sk = W.secondaryFocusKey(inp);
    const topLimit = Math.max(10, inp.mcTopCount);

    const ex = await W.exhaustiveSearch(inp, blocks, level, topLimit, null);
    if(ex.bailed){ i--; continue; }
    const exact = ex.topBuilds[0];
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
    if(ok){ pass++; console.log(`#${i} PASS lvl${level} tf${inp.targetFloor} pk=${pk} sk=${sk}`); }
    else { fail++; const msg=`#${i} FAIL lvl${level} tf${inp.targetFloor} pk=${pk} sk=${sk}: ${why} | exact ${s.S}/${s.A}/${s.P}/${s.I}/${s.L}/${s.D||0}/${s.C||0} vs fast ${f.S}/${f.A}/${f.P}/${f.I}/${f.L}/${f.D||0}/${f.C||0}`; console.log(msg); fails.push(msg); }
  }
  console.log(`\n=== fast vs exhaustive: ${pass}/${N} matched ===`);
  if(fails.length) console.log("MISMATCHES:\n"+fails.join("\n"));
})();
