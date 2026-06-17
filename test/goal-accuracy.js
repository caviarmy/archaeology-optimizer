// Confidence check for a goal (primary, optionally + secondary within tolerance).
//
// The question this answers: is the build the app offers actually one of the very
// best builds for the chosen goal, or did the search miss it?  Exhaustively
// simulating every build is impossible at the levels where rare metrics appear
// (hundreds of thousands of point spreads, deep floors), so we split the question:
//
//   Part A (search quality) - enumerate EVERY point spread and score it on the
//     analytic expected-value model (deterministic, no sampling, ~40s for 200k
//     builds). Find the globally EV-optimal in-band build and check the app's pick
//     against it. This proves the search did not miss a build, modulo EV bias.
//
//   Part B (EV vs simulation truth) - take the EV-best in-band builds plus the
//     app's pick and re-simulate them all at high fidelity (KREF, far above the
//     search's run count) on common random numbers. This proves the EV ranking the
//     app trusts agrees with the unbiased simulation, i.e. EV bias did not flip the
//     winner.
//
// Usage: node test/goal-accuracy.js [level] [KREF] [primary] [secondary]
const { JSDOM, VirtualConsole } = require("jsdom");
const fs=require("fs"), path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const LEVEL=Number(process.argv[2]||47), KREF=Number(process.argv[3]||4000);
const PRI=process.argv[4]||"allRewards", SEC=process.argv[5]||"epic";
const vc=new VirtualConsole(); const errs=[]; vc.on("jsdomError",e=>errs.push(e.detail?.stack||e.message||String(e)));
const dom=new JSDOM(html,{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc});
const W=dom.window,d=W.document; W.performance=W.performance||{now:()=>Date.now()};
setTimeout(async ()=>{
  d.body.dataset.landing='false';
  const set=(id,v)=>{const e=d.getElementById(id);if(e){if(e.type==='checkbox')e.checked=!!v;else e.value=v;e.dispatchEvent(new W.Event('change',{bubbles:true}));}};
  const inp0={selectedLevel:String(LEVEL),ascension:"0",baseDamage:"111",baseStamina:"159",baseAtkSpeed:"1",baseCritChance:"6",baseCritDamage:"1.86",baseSuperDamage:"2",baseArmorPenFlat:"25",baseXpGain:"1.78",baseFragGain:"1.12",baseXpMod:"3",baseLootMod:"0",baseLootModGain:"5",baseSpeedMod:"0",baseSpeedModGain:"10",baseSpeedModAtkRate:"2",baseStaminaMod:"1",staminaModGain:"7",modStrA0:"5",modAgi:"5",primaryGoal:PRI,secondaryGoal:SEC,primaryToleranceValue:"3",mcTopCount:"25",mcRunsPerBuild:"1000"};
  for(const k in inp0) set(k,inp0[k]); set('worthlessCommon',true); if(process.argv[6]==="deep") set('deepSecondaryScan',true); d.getElementById('primaryProtectionTolerance').click();
  const inp=W.getInputs(), blocks=W.visibleBlocks(inp);
  const spec=W.activeSkillSpec(inp), keys=spec.map(s=>s[0]), caps=Object.fromEntries(spec);
  const total=Math.min(LEVEL, keys.reduce((x,k)=>x+caps[k],0));
  const lbl=st=>keys.map(k=>st[k]||0).join("/");
  const hasSec = SEC && SEC!=="none" && SEC!==PRI;
  const TOL=0.03;

  // ---- Part A: exhaustive analytic enumeration of every point spread ----
  const tA=Date.now();
  const st={S:0,A:0,P:0,I:0,L:0,D:0,C:0};
  const evRows=[]; // {st, p, s}
  (function rec(i,rem){
    if(i===keys.length){ if(rem!==0) return;
      const sc=W.scoreBuild(st,inp,blocks);
      evRows.push({lab:lbl(st), p:W.metricValue(sc,PRI,inp), s:hasSec?W.metricValue(sc,SEC,inp):0});
      return; }
    const k=keys[i], cap=Math.min(caps[k],rem);
    for(let v=0;v<=cap;v++){ st[k]=v; rec(i+1,rem-v); } st[k]=0;
  })(0,total);
  let bestPev=-Infinity; for(const r of evRows) if(r.p>bestPev) bestPev=r.p;
  const thrEv=bestPev - Math.abs(bestPev)*TOL;
  // goal ordering: in-band first, then by secondary (or by primary if no secondary)
  const goalSort=(a,b)=>{ const ai=a.p>=thrEv-1e-9, bi=b.p>=thrEv-1e-9; if(ai!==bi)return ai?-1:1; if(ai&&hasSec&&Math.abs(b.s-a.s)>1e-9)return b.s-a.s; return b.p-a.p; };
  const evOrder=evRows.slice().sort(goalSort);
  const evRank=new Map(evOrder.map((r,i)=>[r.lab,i+1]));
  const inBandCount=evRows.filter(r=>r.p>=thrEv-1e-9).length;
  const evBest=evOrder[0];

  // ---- run the actual app workflow ----
  await W.runExact(); await W.runMonteRerank();
  const wf=W.__simResults.find(r=>r.simRank===1).stats;
  const wfLab=lbl(wf);
  const wfRankA=evRank.get(wfLab);

  console.log(`=== goal-accuracy  level ${LEVEL}  primary=${PRI}${hasSec?`  secondary=${SEC} (3% band)`:""} ===`);
  console.log(`Part A (analytic EV, exhaustive): ${evRows.length} spreads in ${((Date.now()-tA)/1000).toFixed(0)}s, ${inBandCount} in-band`);
  console.log(`  EV-optimal build : ${evBest.lab}  primary ${evBest.p.toFixed(1)}${hasSec?`  ${SEC} ${evBest.s.toFixed(2)}`:""}`);
  console.log(`  APP pick         : ${wfLab}  primary ${(evRows.find(r=>r.lab===wfLab)||{p:NaN}).p.toFixed(1)}${hasSec?`  ${SEC} ${(evRows.find(r=>r.lab===wfLab)||{s:NaN}).s.toFixed(2)}`:""}`);
  console.log(`  APP pick EV goal-rank: #${wfRankA} of ${evRows.length}  (top ${(wfRankA/evRows.length*100).toFixed(2)}%${hasSec?`; top ${(wfRankA/inBandCount*100).toFixed(2)}% of in-band`:""})`);

  // ---- Part B: confirm EV truth == simulation truth on the top in-band set ----
  const tB=Date.now();
  const mk=(seed)=>{let s=seed>>>0;return ()=>{s=(Math.imul(s,1103515245)+12345)>>>0;return s/4294967296;};};
  const toSt=lab=>{const o={S:0,A:0,P:0,I:0,L:0,D:0,C:0};lab.split("/").forEach((v,i)=>o[keys[i]]=+v);return o;};
  const labels=new Set([wfLab, ...evOrder.slice(0,25).map(r=>r.lab)]);
  W.__simResults.forEach(r=>labels.add(lbl(r.stats)));
  const simMetric=(r,key)=>{ if(key==="allRewards")return r.rewardsPerHour; if(key==="xp")return r.xpPerHour; if(key==="allLoot")return r.allLootPerHour; return (r.lootPerHour&&r.lootPerHour[key])||0; };
  const sim=new Map();
  for(const lab of labels){ const r=W.aggregateBuildSim(toSt(lab),inp,blocks,KREF,mk(20260617)); sim.set(lab,{p:simMetric(r,PRI), s:hasSec?simMetric(r,SEC):0}); }
  const simArr=[...sim.entries()].map(([lab,v])=>({lab,...v}));
  const bestPs=Math.max(...simArr.map(r=>r.p)); const thrS=bestPs-Math.abs(bestPs)*TOL;
  const simSort=(a,b)=>{ const ai=a.p>=thrS-1e-9, bi=b.p>=thrS-1e-9; if(ai!==bi)return ai?-1:1; if(ai&&hasSec&&Math.abs(b.s-a.s)>1e-9)return b.s-a.s; return b.p-a.p; };
  const simOrder=simArr.slice().sort(simSort);
  const simBest=simOrder[0]; const wfSim=sim.get(wfLab);
  const wfRankB=simOrder.findIndex(r=>r.lab===wfLab)+1;
  console.log(`Part B (simulation @ ${KREF} runs, CRN): ${labels.size} top builds in ${((Date.now()-tB)/1000).toFixed(0)}s`);
  console.log(`  SIM-optimal build: ${simBest.lab}  primary ${simBest.p.toFixed(1)}${hasSec?`  ${SEC} ${simBest.s.toFixed(2)}`:""}`);
  console.log(`  APP pick         : ${wfLab}  primary ${wfSim.p.toFixed(1)}${hasSec?`  ${SEC} ${wfSim.s.toFixed(2)}`:""}  sim goal-rank #${wfRankB} of ${labels.size}`);
  const gap = hasSec ? (simBest.s-wfSim.s)/(Math.abs(simBest.s)||1)*100 : (simBest.p-wfSim.p)/(Math.abs(simBest.p)||1)*100;
  console.log(`  APP pick gap vs sim-optimal (${hasSec?SEC:PRI}): ${gap.toFixed(2)}%`);
  console.log("ERRORS:", errs.length?errs.join("\n"):"none");
  process.exit(0);
},500);
