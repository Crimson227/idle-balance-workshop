'use strict';
const L=require('./旧多属性规则.cjs'),E=require('./原成长核心.cjs'),R=require('./规则库.cjs'),{Q}=require('./战斗引擎.cjs'),q=E.q,Z=q(0),O=q(1),min=(a,b)=>a.cmp(b)<0?a:b,max=(a,b)=>a.cmp(b)>0?a:b;
const VERSION='multi-exact-2.0.0',TYPES=L.TYPES,NAMES=L.TYPE_NAMES,FIELDS=L.FIELDS.map(f=>{const row=[...f];if(['critBonus','critBonusReduction'].includes(row[0]))row[3]=9;if(TYPES.some(t=>row[0]===t+'Resist'))row[3]=1;return row;});
const MECHANISMS={critical:['critChance','critBonus','critAvoid','critBonusReduction'],armor:['armor','flatPen','percentPen'],block:['blockChance','blockReduction'],leech:['leech','leechResist'],regen:['regen'],bonuses:TYPES.map(k=>k+'Bonus'),resistance:TYPES.map(k=>k+'Resist')};
function enabledFields(g){const keys=['hp','frequency'];for(const t of TYPES)if(g.types[t])keys.push(...(t==='physical'?['physicalMin','physicalMax']:[t]));for(const[k,fs]of Object.entries(MECHANISMS))if(g.mechanisms[k])keys.push(...fs.filter(f=>!TYPES.some(t=>f.startsWith(t))||TYPES.some(t=>g.types[t]&&f.startsWith(t))));return FIELDS.filter(f=>keys.includes(f[0]));}
function numeric(x,lo,hi,label){if(x===null||x===undefined||x==='')throw Error(label+'还没有填写');const n=q(x);if(n.cmp(q(lo))<0||n.cmp(q(hi))>0)throw Error(label+'须在'+lo+'至'+hi+'之间');return n;}
function actor(raw,g,label){const active=new Set(enabledFields(g).map(f=>f[0])),a={};for(const[k,title,lo,hi]of FIELDS)a[k]=active.has(k)?numeric(raw?.[k],lo,hi,label+title):Z;if(a.physicalMin.cmp(a.physicalMax)>0)throw Error(label+'最小物理伤害不能超过最大物理伤害');for(const t of TYPES)a[t+'Reduction']=g.types[t]&&g.mechanisms.resistance?numeric(raw?.[t+'Reduction'],0,1,label+NAMES[t]+'减抗'):Z;R.validateActor(a,g,label);return a;}
function validateGame(g){if(g.format!=='idle-connected-game-v2'||g.version!=='connected-growth-2.0.0')throw Error('多属性成长配置版本不支持');for(const group of [['types',TYPES],['mechanisms',Object.keys(MECHANISMS)]]){for(const k of Object.keys(g[group[0]]||{}))if(!group[1].includes(k))throw Error('不支持的属性类型或机制：'+k);for(const k of group[1])if(typeof g[group[0]]?.[k]!=='boolean')throw Error('请明确'+k+'是否启用');}const allowed=new Set([...FIELDS.map(f=>f[0]),...TYPES.map(t=>t+'Reduction')]);for(const raw of [g.player,g.world.enemy])for(const k of Object.keys(raw||{}))if(!allowed.has(k))throw Error('不支持的战斗字段：'+k);const p=actor(g.player,g,'角色'),e=actor(g.world.enemy,g,'敌人');return {p,e};}
function hit(a,d,r,words){
 const unit=i=>q(words[i]).div(q(4294967296));
 const critical=unit(1).cmp(max(Z,a.critChance.sub(d.critAvoid)))<0;
 const mult=critical?O.add(max(Z,a.critBonus.sub(d.critBonusReduction))):O;
 const blocked=unit(2).cmp(d.blockChance)<0;
 const factor=r.armorK.div(r.armorK.add(max(Z,d.armor.mul(O.sub(a.percentPen)).sub(a.flatPen))));
 const defenseFirst=r.criticalOrder==='defense_first',channels={};
 let attempted=Z,armorFactor=factor,afterArmorBeforeCritical;
 for(const type of TYPES){
  const physical=type==='physical';
  const raw=physical?a.physicalMin.add(a.physicalMax.sub(a.physicalMin).mul(unit(0))):a[type];
  const enhanced=raw.mul(O.add(a[type+'Bonus']));
  const boosted=enhanced.mul(mult);
  let defended=boosted;
  if(physical){
   const armorInput=defenseFirst?enhanced:boosted;
   const armorOutput=r.defenseId?R.mitigate(armorInput,a,d,r):armorInput.mul(factor);
   if(!armorInput.eq(Z))armorFactor=armorOutput.div(armorInput);
   if(defenseFirst)afterArmorBeforeCritical=armorOutput;
   defended=defenseFirst?armorOutput.mul(mult):armorOutput;
  }
  const resist=max(Z,d[type+'Resist'].sub(a[type+'Reduction']));
  const mitigated=defended.mul(O.sub(resist));
  const final=mitigated.mul(blocked?O.sub(d.blockReduction):O);
  channels[type]={raw,boosted,mitigated,final};
  attempted=attempted.add(final);
 }
 return R.roundPacket({critical,blocked,criticalMultiplier:mult,armorFactor,attempted,channels,words,
  ...(defenseFirst?{afterArmorBeforeCritical}:{})},r.rounding,r.defender);
}
function wordStream(seed,side){let state=L.seedAt(seed,side+1);return()=>{let x=state;x^=x<<13;x^=x>>>17;x^=x<<5;state=x>>>0;return state;};}
function run(input,cutoff=null){const g=input.game;if(R.dynamic(g))return require('./规则战斗.cjs').run(input,cutoff,module.exports);const a=[actor(input.player,g,'角色'),actor(input.enemy,g,'敌人')],rules={armorK:q(input.rules.armorK),...(R.config(g)?{defenseId:R.defense(g),rounding:R.config(g).rounding,criticalOrder:R.config(g).criticalOrder}:{})},limit=q(input.rules.timeoutSeconds),end=cutoff===null?limit:min(limit,q(cutoff)),hp=a.map(x=>x.hp),counts=[0,0],random=[wordStream(input.seed,0),wordStream(input.seed,1)],metrics=a.map((_,side)=>({side,attacks:0,criticalAttacks:0,actualDamage:Z,damageTaken:Z,leechRequested:Z,leechApplied:Z,regenApplied:Z,healingWasted:Z,variableCriticalDamage:false,channels:Object.fromEntries(TYPES.map(t=>[t,{actualDamage:Z}]))}));let t=Z,tick=1,outcome='timeout';const steps=[];
while(t.cmp(end)<0){const next=[q(counts[0]+1).div(a[0].frequency),q(counts[1]+1).div(a[1].frequency),q(tick),end].reduce(min);t=next;const before=[...hp],attacks=[],heals=[Z,Z];for(let side=0;side<2;side++)if(q(counts[side]+1).div(a[side].frequency).eq(t)){const d=1-side,h=hit(a[side],a[d],{...rules,defender:d},[random[side](),random[side](),random[side]()]),actual=min(before[d],h.attempted),share=h.attempted.eq(Z)?Z:actual.div(h.attempted),request=actual.mul(a[side].leech).mul(O.sub(a[d].leechResist));counts[side]++;heals[side]=request;metrics[side].attacks++;if(h.critical)metrics[side].criticalAttacks++;metrics[side].actualDamage=metrics[side].actualDamage.add(actual);metrics[d].damageTaken=metrics[d].damageTaken.add(actual);metrics[side].leechRequested=metrics[side].leechRequested.add(request);const channels={};for(const type of TYPES){const c=h.channels[type],lost=c.final.mul(share);channels[type]={...c,actualHpLost:lost};metrics[side].channels[type].actualDamage=metrics[side].channels[type].actualDamage.add(lost);}attacks.push({...h,side,target:d,actualHpLost:actual,leechRequested:request,channels});}
for(const h of attacks)hp[h.target]=max(Z,hp[h.target].sub(h.actualHpLost));const afterDamage=[...hp],leech=[],regen=[];for(let side=0;side<2;side++){const applied=hp[side].cmp(Z)>0?min(a[side].hp.sub(hp[side]),heals[side]):Z;hp[side]=hp[side].add(applied);metrics[side].leechApplied=metrics[side].leechApplied.add(applied);leech.push({requested:heals[side],applied,wasted:heals[side].sub(applied)});}const afterLeech=[...hp];for(let side=0;side<2;side++){const request=t.eq(q(tick))?a[side].regen:Z,applied=hp[side].cmp(Z)>0?min(a[side].hp.sub(hp[side]),request):Z;hp[side]=hp[side].add(applied);metrics[side].regenApplied=metrics[side].regenApplied.add(applied);regen.push({applied,requested:request});}if(t.eq(q(tick)))tick++;steps.push({time:t,before,afterDamage,afterLeech,after:[...hp],attacks,leech,regen});for(let side=0;side<2;side++){const m=metrics[side];if(!a[side].hp.sub(m.damageTaken).add(m.leechApplied).add(m.regenApplied).eq(hp[side]))throw Error('生命账目未守恒');}if(hp.some(x=>x.eq(Z))){outcome=hp[0].eq(Z)&&hp[1].eq(Z)?'draw':hp[1].eq(Z)?'win':'death';break;}}
if(t.eq(end)&&end.cmp(limit)<0&&!hp.some(x=>x.eq(Z)))outcome='interrupted_budget';for(let side=0;side<2;side++){const d=a[1-side];metrics[side].variableCriticalDamage=!a[side].physicalMin.eq(a[side].physicalMax)||(a[side].critChance.cmp(d.critAvoid)>0&&a[side].critChance.sub(d.critAvoid).cmp(O)<0&&a[side].critBonus.cmp(d.critBonusReduction)>0)||(d.blockChance.cmp(Z)>0&&d.blockChance.cmp(O)<0&&d.blockReduction.cmp(Z)>0);}
for(let side=0;side<2;side++){const m=metrics[side];m.noncriticalAttacks=m.attacks-m.criticalAttacks;m.blocksTaken=steps.reduce((v,s)=>v+s.attacks.filter(h=>h.target===side&&h.blocked).length,0);m.attemptedDamage=steps.reduce((v,s)=>s.attacks.filter(h=>h.side===side).reduce((n,h)=>n.add(h.attempted),v),Z);m.overkill=m.attemptedDamage.sub(m.actualDamage);m.healingWasted=steps.reduce((v,s)=>v.add(s.leech[side].wasted).add(s.afterLeech[side].cmp(Z)>0?s.regen[side].requested.sub(s.regen[side].applied):Z),Z);for(const type of TYPES){const sums={rawDamage:Z,boostedDamage:Z,mitigatedDamage:Z,finalDamage:Z};for(const s of steps)for(const h of s.attacks)if(h.side===side)for(const[k,src]of [['rawDamage','raw'],['boostedDamage','boosted'],['mitigatedDamage','mitigated'],['finalDamage','final']])sums[k]=sums[k].add(h.channels[type][src]);Object.assign(m.channels[type],sums);}}
return {version:VERSION,exact:E.encode({battle:{time:t,outcome,playerHp:hp[0],enemyHp:hp[1]},metrics,steps}),metrics,exactConfig:E.encode({player:a[0],enemy:a[1]}),fixedSeed:input.seed};}
module.exports={VERSION,TYPES,NAMES,FIELDS,MECHANISMS,enabledFields,validateGame,actor,hit,run,legacy:L};
