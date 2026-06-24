

const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const vc = new VirtualConsole();
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom; const W = window; const doc = window.document;
window.performance = window.performance || { now: () => Date.now() };

const REPS = Number(process.argv[2] || 5);
const KREF = Number(process.argv[3] || 600);
let _ms = (Number(process.argv[4]||13579))>>>0;
Math.random = ()=>{ _ms=(_ms+0x6D2B79F5)|0; let t=Math.imul(_ms^_ms>>>15,1|_ms); t=(t+Math.imul(t^t>>>7,61|t))^t; return ((t^t>>>14)>>>0)/4294967296; };

const set=(id,v)=>{ const el=doc.getElementById(id); if(el) el.value=String(v); };

Object.entries({
  selectedLevel:100, ascension:2,
  baseDamage:1396, baseStamina:932, baseAtkSpeed:2, baseArmorPenFlat:881,
  baseCritChance:66.25, baseCritDamage:4.21, baseSuperChance:60.75, baseSuperDamage:3.11,
  baseUltraChance:22.50, baseUltraDamage:4.84,
  baseInstacharge:11.50, baseAutoTap:55.60, baseGoldCrosshairChance:20, baseGoldCrosshairMulti:3,
  baseXpGain:11.31, baseFragGain:9.17, baseXpMod:11.35, baseXpModGain:6.81,
  baseLootMod:19.85, baseLootModGain:8.73, baseSpeedMod:8.10, baseSpeedModGain:30, baseSpeedModAtkRate:2,
  baseStaminaMod:14.70, staminaModGain:10, baseGleamingChance:3, baseGleamingMulti:3.72
}).forEach(([k,v])=>set(k,v));
set("primaryGoal","allRewards"); set("secondaryGoal","none");

(async () => {
  if(W.populateCardSettings) W.populateCardSettings();
  const inp=W.getInputs(), blocks=W.visibleBlocks(inp), level=100;
  const spec=W.activeSkillSpec(inp), keys=spec.map(s=>s[0]), caps=Object.fromEntries(spec);
  const lbl=st=>keys.map(k=>st[k]||0).join("/");
  const rngFactory=(seed)=>()=>{ let s=seed>>>0; return ()=>{ s=(Math.imul(s,1103515245)+12345)>>>0; return s/4294967296; }; };
  const rate=(st,K,mk)=>W.aggregateBuildSim(st, inp, blocks, K, mk()).rewardsPerHour;

  async function workflow(){
    const _tl=Math.max(10, inp.mcTopCount||10);
    let res=await W.exhaustiveSearch(inp, blocks, level, _tl, null);
    if(res.bailed){ const _all=W.fastSearch(inp, blocks, level); res={ topBuilds: W.rankCandidates(_all, inp).slice(0, _tl), count: _all.length }; }
    const finalists=res.topBuilds.slice(0, inp.mcTopCount).map(c=>c.stats);
    const seed=((Math.random()*1e9)>>>0)||1;
    let best=null,bestV=-Infinity;
    for(const st of finalists){ const v=rate(st, inp.mcRunsPerBuild, rngFactory(seed)); if(v>bestV){bestV=v; best=st;} }
    return best;
  }

  const picks=[];
  for(let r=0;r<REPS;r++){ const t0=Date.now(); const p=await workflow(); picks.push(p); console.log(`run ${r+1}/${REPS}: ${lbl(p)}   (${((Date.now()-t0)/1000).toFixed(0)}s)`); }

  const refSeed=20260615, refSeed2=778899;
  const refCache=new Map();
  const refVal=st=>{ const k=lbl(st); if(!refCache.has(k)) refCache.set(k, rate(st, KREF, rngFactory(refSeed))); return refCache.get(k); };

  let cur=picks[0]; for(const p of picks) if(refVal(p)>refVal(cur)) cur=p;
  for(let guard=0; guard<60; guard++){
    let bestN=cur, bestV=refVal(cur);
    for(const f of keys){ if((cur[f]||0)<=0) continue;
      for(const t of keys){ if(f===t || (cur[t]||0)>=caps[t]) continue;
        const ns={...cur}; ns[f]=(ns[f]||0)-1; ns[t]=(ns[t]||0)+1;
        if(refVal(ns)>bestV+1e-9){ bestV=refVal(ns); bestN=ns; } } }
    if(bestN===cur) break; cur=bestN;
  }
  const ref=cur, refV=refVal(cur);

  const gaps=picks.map(p=>(refV-refVal(p))/refV*100);
  const hits=picks.map(p=>lbl(p)===lbl(ref)?1:0);
  const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
  const std=a=>{ const m=mean(a); return Math.sqrt(mean(a.map(x=>(x-m)*(x-m)))); };
  const noise=Math.abs(rate(ref, KREF, rngFactory(refSeed2))-refV)/refV*100;

  console.log(`\n=== Level-100 A2 build: workflow vs best-known reference (K_ref=${KREF}) ===`);
  console.log(`best-known reference build : ${lbl(ref)}  (verified local optimum, reward/hr ${refV.toFixed(0)})`);
  picks.forEach((p,i)=>console.log(`  run ${i+1}: ${lbl(p)}  gap ${gaps[i].toFixed(3)}%${hits[i]?"  EXACT":""}`));
  console.log(`exact-match rate : ${(mean(hits)*100).toFixed(0)}%  (${hits.reduce((a,b)=>a+b,0)}/${REPS})`);
  console.log(`gap%% : mean ${mean(gaps).toFixed(3)}  std ${std(gaps).toFixed(3)}  var ${(std(gaps)**2).toFixed(4)}  max ${Math.max(...gaps).toFixed(3)}`);
  console.log(`noise-floor control : reference re-scored on a fresh seed differs by ${noise.toFixed(3)}%`);
  console.log(`  (gaps at or below this level are simulation noise: statistically tied with the best)`);
})();
