// Per-floor stamina cost vs reward for a fixed build, to show reward-per-stamina
// collapsing past floor 150 (HP scales x8/x16/x64, reward stays flat).
const { JSDOM, VirtualConsole } = require("jsdom");
const fs=require("fs"), path=require("path");
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8"),{runScripts:"dangerously",virtualConsole:new VirtualConsole()});
const W=dom.window, doc=W.document; W.performance=W.performance||{now:()=>Date.now()};
const set=(id,v)=>{const e=doc.getElementById(id); if(e) e.value=String(v);};
set("ascension",2);
set("baseDamage",20000); set("baseCritChance",70); set("baseCritDamage",4);
set("baseSuperChance",50); set("baseSuperDamage",3); set("baseArmorPenFlat",2000);
set("baseXpGain",10); set("baseFragGain",10);
const inp=W.getInputs(); const blocks=W.visibleBlocks(inp);
const der=W.getDerived({S:0,A:0,I:0,P:0,L:0}, inp);
console.log("floor\tstaminaCost\treward(value)\treward/stamina");
let prevEff=null;
for(const f of [100,120,149,150,151,175,199,200,201,249,250,300]){
  const fc=W.floorCostValue(f, der, inp, blocks);
  const eff = fc.staminaCost>0 ? fc.value/fc.staminaCost : 0;
  let drop = prevEff!=null && prevEff>0 ? ((eff/prevEff-1)*100).toFixed(0)+"%" : "";
  console.log(`${f}\t${fc.staminaCost.toExponential(2)}\t${fc.value.toExponential(2)}\t${eff.toExponential(2)}\t${drop}`);
  prevEff=eff;
}
