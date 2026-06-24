

const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const vc = new VirtualConsole();
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom; const W = window; const doc = window.document;
window.performance = window.performance || { now: () => Date.now() };

const N = Number(process.argv[2] || 20);
const KG = Number(process.argv[3] || 200);
let _seed = (Number(process.argv[4]||98765))>>>0;
const rndU = ()=>{ _seed=(_seed+0x6D2B79F5)|0; let t=Math.imul(_seed^_seed>>>15,1|_seed); t=(t+Math.imul(t^t>>>7,61|t))^t; return ((t^t>>>14)>>>0)/4294967296; };
const rnd=(a,b)=>a+rndU()*(b-a), rndi=(a,b)=>Math.floor(rnd(a,b+1));
const set=(id,v)=>{ const el=doc.getElementById(id); if(el) el.value=String(v); };
const setChk=(id,v)=>{ const el=doc.getElementById(id); if(el) el.checked=!!v; };

const rngFactory = (seed)=>()=>{ let s=seed>>>0; return ()=>{ s=(Math.imul(s,1103515245)+12345)>>>0; return s/4294967296; }; };
function rewardsPerHour(st, inp, blocks, K, makeRng){
  const row = W.aggregateBuildSim(st, inp, blocks, K, makeRng());
  return row.rewardsPerHour;
}

(async () => {
  if(W.populateCardSettings) W.populateCardSettings();
  const gaps=[], hits=[], within05=[], within1=[], noiseCtrl=[];
  const sGaps=[], sHits=[], sWithin05=[], sWithin1=[];
  const rows=[];
  for(let i=0;i<N;i++){
    const lvl = rndi(10,13);
    set("selectedLevel", lvl);
    set("ascension", 0);

    set("baseDamage", rnd(60,400).toFixed(1));
    set("baseStamina", rnd(80,160).toFixed(0));
    set("baseCritChance", rnd(0,40).toFixed(2)); set("baseCritDamage", rnd(1.5,3).toFixed(2));
    set("baseSuperChance", rnd(0,30).toFixed(2)); set("baseSuperDamage", rnd(1.5,2.5).toFixed(2));
    set("baseXpGain", rnd(1,6).toFixed(2)); set("baseFragGain", rnd(1,5).toFixed(2));
    set("baseXpMod", rnd(0,10).toFixed(2)); set("baseXpModGain", rnd(3,6).toFixed(2));
    set("baseLootMod", rnd(0,10).toFixed(2)); set("baseLootModGain", rnd(3,6).toFixed(2));
    set("baseStaminaMod", 0); set("staminaModGain", 4);
    set("baseArmorPenFlat", rndi(0,200)); set("baseAtkSpeed", 1);
    set("modStrA0", rndi(0,5)); set("modStrA1", rndi(0,1));
    set("bonusDmgArpenA0", rndi(0,15)); set("bonusArpenCdA0", rndi(0,8));

    set("primaryGoal","allRewards"); set("secondaryGoal","none");
    setChk("primaryProtectionStrict", true); setChk("primaryProtectionTolerance", false);
    const th=doc.getElementById("thoroughSearch"); if(th) th.checked=false;

    const inp=W.getInputs(), blocks=W.visibleBlocks(inp);
    const spec=W.activeSkillSpec(inp); const keys=spec.map(s=>s[0]); const caps=spec.map(s=>s[1]);
    const target=Math.min(lvl, caps.reduce((a,b)=>a+b,0));
    const lbl=st=>keys.map(k=>st[k]||0).join("/");

    const builds=[]; const cur={};
    (function rec(pos, rem){
      if(pos===keys.length-1){ if(rem<=caps[pos]){ cur[keys[pos]]=rem; builds.push({...cur}); } return; }
      const hi=Math.min(caps[pos],rem);
      for(let v=0; v<=hi; v++){ cur[keys[pos]]=v; rec(pos+1, rem-v); }
    })(0, target);

    const seedB=20260615, seedHi=4242424, seedHi2=909091, seedSim=135791;
    const Kscreen=Math.max(50, Math.round(KG/40));
    const scored=builds.map(st=>({st, v:rewardsPerHour(st, inp, blocks, Kscreen, rngFactory(seedB))}));
    scored.sort((a,b)=>b.v-a.v);

    const _tl=Math.max(10, inp.mcTopCount||10);
    let res=await W.exhaustiveSearch(inp, blocks, lvl, _tl, null);
    if(res.bailed){ const _all=W.fastSearch(inp, blocks, lvl); res={ topBuilds: W.rankCandidates(_all, inp).slice(0, _tl), count: _all.length }; }
    const estPick=res.topBuilds[0].stats;
    const finalists=res.topBuilds.map(c=>c.stats);

    const RR=inp.mcRunsPerBuild||1000;
    let simPick=null, simPickEst=-Infinity;
    for(const st of finalists){ const v=rewardsPerHour(st, inp, blocks, RR, rngFactory(seedSim)); if(v>simPickEst){simPickEst=v; simPick=st;} }

    const hiV=new Map();
    const scoreHi=st=>{ const k=lbl(st); if(!hiV.has(k)) hiV.set(k, rewardsPerHour(st, inp, blocks, KG, rngFactory(seedHi))); return hiV.get(k); };
    scored.slice(0, 50).forEach(x=>scoreHi(x.st));
    scoreHi(estPick); scoreHi(simPick);
    let best=null, bestV=-Infinity;
    for(const [k,v] of hiV){ if(v>bestV){bestV=v; best=k;} }

    const gap=(bestV-scoreHi(estPick))/bestV*100;
    const sGap=(bestV-scoreHi(simPick))/bestV*100;
    const hit=lbl(estPick)===best?1:0, sHit=lbl(simPick)===best?1:0;
    gaps.push(gap); hits.push(hit); within05.push(gap<=0.5?1:0); within1.push(gap<=1.0?1:0);
    sGaps.push(sGap); sHits.push(sHit); sWithin05.push(sGap<=0.5?1:0); sWithin1.push(sGap<=1.0?1:0);

    const bestSt={}; best.split("/").forEach((v,j)=>bestSt[keys[j]]=+v);
    const bestVc=rewardsPerHour(bestSt, inp, blocks, KG, rngFactory(seedHi2));
    noiseCtrl.push(Math.abs(bestVc-bestV)/bestV*100);

    rows.push(`#${i} lvl${lvl} n=${builds.length} true=${best} est=${lbl(estPick)} (${gap.toFixed(2)}%) sim=${lbl(simPick)} (${sGap.toFixed(2)}%)`);
    console.log(rows[rows.length-1]);
  }

  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const std=a=>{ const m=mean(a); return Math.sqrt(mean(a.map(x=>(x-m)*(x-m)))); };
  const pct=(a,p)=>{ const s=a.slice().sort((x,y)=>x-y); return s[Math.min(s.length-1,Math.floor(p*(s.length-1)))]; };
  const report=(name, g, h, w05, w1)=>{
    console.log(`\n--- ${name} ---`);
    console.log(`exact-best hit rate : ${(mean(h)*100).toFixed(1)}%`);
    console.log(`within 0.5% of best : ${(mean(w05)*100).toFixed(1)}%`);
    console.log(`within 1.0% of best : ${(mean(w1)*100).toFixed(1)}%`);
    console.log(`gap%% : mean ${mean(g).toFixed(3)}  std ${std(g).toFixed(3)}  var ${(std(g)**2).toFixed(3)}  max ${Math.max(...g).toFixed(3)}  p50 ${pct(g,0.5).toFixed(3)}  p90 ${pct(g,0.9).toFixed(3)}`);
    const m=g.filter(x=>x>1e-9);
    if(m.length) console.log(`gap%% (misses only, n=${m.length}) : mean ${mean(m).toFixed(3)}  std ${std(m).toFixed(3)}  max ${Math.max(...m).toFixed(3)}`);
  };
  console.log(`\n=== Workflow accuracy vs provable simulation optimum (${N} scenarios, K_ground=${KG}) ===`);
  report("Stage 1: Estimate (guided search #1)", gaps, hits, within05, within1);
  report("Full workflow: Estimate then Simulate", sGaps, sHits, sWithin05, sWithin1);
  console.log(`\nnoise-floor control : the optimum re-scored on a fresh seed differs by mean ${mean(noiseCtrl).toFixed(3)}%  max ${Math.max(...noiseCtrl).toFixed(3)}%`);
  console.log(`  (gaps at or below this level are simulation noise: the pick is statistically tied with the best)`);
})();
