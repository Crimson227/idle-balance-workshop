'use strict';
// Battle decisions use reduced rational numbers. Number fields are display projections only.
const VERSION='ddr-3.0.0', NUMERIC_VERSION='exact-rational-1.2.0', FORMAT='critical-dual-channel-v1';
const DUAL_FORMAT='dual-channel-recovery-v1',DUAL_VERSION='ddr-2.0.0',RANDOM_ALGORITHM='counter-mix32-v1',GRID=4294967296;
const LEGACY_FORMAT='damage-defense-recovery-v1',LEGACY_VERSION='ddr-1.0.0';
const OLD_FIELDS=[['maxHp','生命上限','生命',1,1e7],['hitDamage','物理基础单击','生命/次',0,1e6],['attackIntervalSeconds','攻击间隔','秒',.1,10],['armor','护甲','点',0,1e5],['percentArmorPen','比例穿透','比例',0,1],['flatArmorPen','固定穿透','点',0,1e5],['regenPerSecond','整秒回复','生命',0,1e5],['leechFraction','吸血','比例',0,1]];
const DUAL_FIELDS=[...OLD_FIELDS,['elementDamage','抽象元素基础单击','生命/次',0,1e6],['elementResistance','元素抗性','比例',0,1],['elementResistReduction','攻击者减抗','比例',0,1]];
const FIELDS=[...DUAL_FIELDS,['critChance','暴击率','概率',0,1],['critMultiplier','暴击总倍率','倍',1,10]];
const abs=x=>x<0n?-x:x;
function gcd(a,b){a=abs(a);b=abs(b);while(b){[a,b]=[b,a%b];}return a;}
class Q{
 constructor(n,d=1n){if(d===0n)throw Error('分母为0');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);this.n=n/g;this.d=d/g;if(abs(this.n).toString(2).length>4096||this.d.toString(2).length>4096)throw Error('精确分数超过4096位计算边界；未生成战斗结论');}
 add(b){return new Q(this.n*b.d+b.n*this.d,this.d*b.d);} sub(b){return new Q(this.n*b.d-b.n*this.d,this.d*b.d);}
 mul(b){return new Q(this.n*b.n,this.d*b.d);} div(b){return new Q(this.n*b.d,this.d*b.n);}
 cmp(b){const v=this.n*b.d-b.n*this.d;return v<0n?-1:v>0n?1:0;}
 eq(b){return this.n===b.n&&this.d===b.d;} toString(){return this.d===1n?String(this.n):this.n+'/'+this.d;}
 toNumber(){const n=Number(this.n),d=Number(this.d);if(Number.isFinite(n)&&Number.isFinite(d))return n/d;const ns=abs(this.n).toString(),ds=this.d.toString();return (this.n<0n?-1:1)*Number(ns.slice(0,16))/Number(ds.slice(0,16))*10**((ns.length-Math.min(ns.length,16))-(ds.length-Math.min(ds.length,16)));}
}
const Z=new Q(0n),O=new Q(1n),qmin=(a,b)=>a.cmp(b)<0?a:b,qmax=(a,b)=>a.cmp(b)>0?a:b;
function decimal(value,label='数值',check=true){
 if(typeof value==='number'){
  if(!Number.isFinite(value)||Number.isInteger(value)&&!Number.isSafeInteger(value))throw Error(label+'不是可可靠接收的有限安全数值');
  const sig=String(value).split(/[eE]/)[0].replace(/[-.]/g,'').replace(/^0+/,'').replace(/0+$/,'');
  if(check&&sig.length>15)throw Error(label+'的Number输入超过15位有效数字；请用十进制字符串或runJSON原始JSON，不猜测计算前意图');
 }else if(typeof value!=='string')throw Error(label+'须为十进制数值或字符串');
 const s=String(value),m=/^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(s);
 if(!m||s.length>100)throw Error(label+'不是受支持的十进制数');
 const exponent=Number(m[4]||0);if(!Number.isSafeInteger(exponent)||Math.abs(exponent)>(check?24:400))throw Error(label+'指数须在-24到24之间');
 let digits=(m[2]+(m[3]||'')).replace(/^0+/,'')||'0',scale=(m[3]||'').length-exponent;
 while(digits.endsWith('0')&&digits!=='0'){digits=digits.slice(0,-1);scale--;}
 if(check&&(digits.length>24||scale>24))throw Error(label+'最多24位有效数字、展开后最多24位小数');
 let n=BigInt(digits)*(m[1]?-1n:1n),d=1n;if(scale>=0)d=10n**BigInt(scale);else n*=10n**BigInt(-scale);
 return new Q(n,d);
}
function parseJSON(text){
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>1048576)throw Error('JSON原文最多1MiB');
 text=text.replace(/^\uFEFF/,'');JSON.parse(text);
 // Quoted tokens are kept intact; only JSON number tokens become exact decimal strings.
 return JSON.parse(text.replace(/"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g,t=>t[0]==='"'?t:JSON.stringify(t)));
}
function keys(o,w,where){if(!o||typeof o!=='object'||Array.isArray(o))throw Error(where+'须为对象');for(const k of Object.keys(o))if(!w.includes(k))throw Error(where+'包含不支持字段：'+k);for(const k of w)if(!(k in o))throw Error(where+'缺少字段：'+k);}
function sampleWord(seed,side,index){
 if(!Number.isInteger(seed)||seed<0||seed>=GRID||![0,1].includes(side)||!Number.isInteger(index)||index<1||index>10000)throw Error('随机寻址须为uint32种子、角色0/1、攻击序号1—10000');
 let x=(seed^Math.imul(index,0x9e3779b9)^Math.imul(side+1,0x85ebca6b))>>>0;
 x=Math.imul(x^(x>>>16),0x7feb352d)>>>0;x=Math.imul(x^(x>>>15),0x846ca68b)>>>0;return (x^(x>>>16))>>>0;
}
function criticalPolicy(chance,multiplier){
 if(chance.cmp(Z)<0||chance.cmp(O)>0||multiplier.cmp(O)<0||multiplier.cmp(decimal(10))>0)throw Error('暴击率须0—1，总倍率须1—10');
 const threshold=Number(chance.n*BigInt(GRID)/chance.d);if(chance.cmp(Z)>0&&threshold===0)throw Error('正暴击率低于1/2^32分辨率；请填0或不低于一格，未静默当成0');
 const effective=new Q(BigInt(threshold),BigInt(GRID));return {declared:chance,effective,threshold,multiplier,quantizationLoss:chance.sub(effective)};
}
function criticalFromWord(chance,multiplier,word){
 if(!Number.isInteger(word)||word<0||word>=GRID)throw Error('随机样本须为uint32整数');
 const policy=criticalPolicy(chance instanceof Q?chance:decimal(chance),multiplier instanceof Q?multiplier:decimal(multiplier)),critical=word<policy.threshold;
 return {...policy,word,critical,appliedMultiplier:critical?policy.multiplier:O};
}
function normalHit(p,def,rules){const effective=qmax(Z,def.armor.mul(O.sub(p.percentArmorPen)).sub(p.flatArmorPen)),factor=rules.armorK.div(rules.armorK.add(effective)),resistance=qmax(Z,def.elementResistance.sub(p.elementResistReduction)),elementFactor=O.sub(resistance),physical=p.hitDamage.mul(factor),element=p.elementDamage.mul(elementFactor);return {effectiveArmor:effective,armorFactor:factor,effectiveElementResistance:resistance,elementFactor,physical,element,attempted:physical.add(element)};}
function hitForWord(p,normal,word){const roll=criticalFromWord(p.critChance,p.critMultiplier,word),physical=p.hitDamage.mul(roll.appliedMultiplier).mul(normal.armorFactor),element=p.elementDamage.mul(roll.appliedMultiplier).mul(normal.elementFactor);return {...normal,physical,element,attempted:physical.add(element),roll};}
function validate(c){
 keys(c,['format','name','rules','goals','player','enemy',...(c?.format===FORMAT?['random']:[])],'配置');if(![FORMAT,DUAL_FORMAT,LEGACY_FORMAT].includes(c.format))throw Error('配置格式不支持');if(typeof c.name!=='string'||!c.name.trim()||c.name.length>120)throw Error('名称须为1—120字');
 keys(c.rules,['version','armorK','timeoutSeconds'],'rules');const legacy=c.format!==FORMAT;if(c.rules.version!==(c.format===LEGACY_FORMAT?LEGACY_VERSION:c.format===DUAL_FORMAT?DUAL_VERSION:VERSION))throw Error('格式与规则版本不匹配');keys(c.goals,['minKillSeconds','maxKillSeconds'],'goals');
 function ranged(v,min,max,label){const x=decimal(v,label);if(x.cmp(min)<0||x.cmp(max)>0)throw Error(label+'超出范围');return x;}
 const rules={armorK:ranged(c.rules.armorK,O,decimal(10000),'armorK'),timeoutSeconds:ranged(c.rules.timeoutSeconds,O,decimal(120),'timeoutSeconds')};
 const goals={minKillSeconds:ranged(c.goals.minKillSeconds,Z,rules.timeoutSeconds,'minKillSeconds')};goals.maxKillSeconds=ranged(c.goals.maxKillSeconds,goals.minKillSeconds,rules.timeoutSeconds,'maxKillSeconds');
 const supported=c.format===LEGACY_FORMAT?OLD_FIELDS:c.format===DUAL_FORMAT?DUAL_FIELDS:FIELDS;
 const actors=['player','enemy'].map(side=>{keys(c[side],supported.map(f=>f[0]),side);const p={...Object.fromEntries(FIELDS.map(([key])=>[key,Z])),critMultiplier:O,...Object.fromEntries(supported.map(([key,,,min,max])=>[key,ranged(c[side][key],decimal(min),decimal(max),side+'.'+key)]))};criticalPolicy(p.critChance,p.critMultiplier);return p;});
 let random={algorithm:RANDOM_ALGORITHM,seed:1};if(!legacy){keys(c.random,['algorithm','seed'],'random');if(c.random.algorithm!==RANDOM_ALGORITHM)throw Error('随机算法不支持');const seed=ranged(c.random.seed,Z,new Q(BigInt(GRID-1)),'random.seed');if(seed.d!==1n)throw Error('种子须为0—4294967295的整数');random={algorithm:RANDOM_ALGORITHM,seed:Number(seed.n)};}
 return {rules,goals,actors,legacy,random};
}
function exactTree(x){if(x instanceof Q)return x.toString();if(Array.isArray(x))return x.map(exactTree);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,exactTree(v)]));return x;}
function displayTree(x,issues,path='',stats={rounded:0}){
 if(x instanceof Q){const v=x.toNumber();if(!Number.isFinite(v)||(x.n!==0n&&v===0))issues.push({path,kind:'display_range_loss',exact:x.toString()});else if(!decimal(v,'显示值',false).eq(x))stats.rounded++;return Number.isFinite(v)?v:null;}
 if(Array.isArray(x))return x.map((v,i)=>displayTree(v,issues,path+'.'+i,stats));if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,displayTree(v,issues,path+'.'+k,stats)]));return x;
}
function channelTotal(){return {rawDamage:Z,mitigatedDamage:Z,attemptedDamage:Z,actualDamage:Z,overkill:Z};}
function total(){return {attacks:0,criticalAttacks:0,noncriticalAttacks:0,attemptedDamage:Z,actualDamage:Z,overkill:Z,damageTaken:Z,leechRequested:Z,leechApplied:Z,regenApplied:Z,healingWasted:Z,regenCapacitySkippedOnDeath:Z,channels:{physical:channelTotal(),element:channelTotal()}};}
function run(input){
 const v=validate(input),{actors:a,rules,goals,random}=v,max=a.map(x=>x.maxHp),hp=[...max],counts=[0,0],totals=[total(),total()],steps=[],timeline=[{time:Z,playerHp:hp[0],enemyHp:hp[1]}],hits=a.map((p,i)=>normalHit(p,a[1-i],rules)),policies=a.map(p=>criticalPolicy(p.critChance,p.critMultiplier));
 const variable=a.map((p,i)=>policies[i].threshold>0&&policies[i].threshold<GRID&&p.critMultiplier.cmp(O)>0&&hits[i].attempted.cmp(Z)>0),fixedHits=hits.map((h,i)=>h.attempted.mul(policies[i].threshold===GRID?a[i].critMultiplier:O));
 let now=Z,tick=O,outcome='timeout',eventCount=0;
 while(now.cmp(rules.timeoutSeconds)<0){
  if(++eventCount>10000)throw Error('事件超过10000组；未生成部分结论');
  const due=a.map((p,i)=>p.attackIntervalSeconds.mul(new Q(BigInt(counts[i]+1))));
  now=qmin(qmin(due[0],due[1]),qmin(tick,rules.timeoutSeconds));
  if(!due.some(x=>x.eq(now))&&!tick.eq(now))break;
  const before=[...hp],attacks=[],requests=[Z,Z];
  for(let side=0;side<2;side++)if(due[side].eq(now)){
   const target=1-side,index=counts[side]+1,word=sampleWord(random.seed,side,index),hit=hitForWord(a[side],hits[side],word),actual=qmin(before[target],hit.attempted),request=actual.mul(a[side].leechFraction),m=totals[side];counts[side]++;m.attacks++;m[hit.roll.critical?'criticalAttacks':'noncriticalAttacks']++;m.attemptedDamage=m.attemptedDamage.add(hit.attempted);m.actualDamage=m.actualDamage.add(actual);m.overkill=m.overkill.add(hit.attempted.sub(actual));m.leechRequested=m.leechRequested.add(request);totals[target].damageTaken=totals[target].damageTaken.add(actual);requests[side]=request;
   const channels={};
   for(const [channel,field] of [['physical','hitDamage'],['element','elementDamage']]){
    const afterDefense=hit[channel],applied=hit.attempted.eq(Z)?Z:actual.mul(afterDefense).div(hit.attempted),originalBase=a[side][field],base=originalBase.mul(hit.roll.appliedMultiplier),overkill=afterDefense.sub(applied),mitigated=base.sub(afterDefense),t=m.channels[channel];
    channels[channel]={originalBase,base,afterDefense,actualHpLost:applied,overkill,mitigated};
    for(const [key,value] of [['rawDamage',base],['mitigatedDamage',mitigated],['attemptedDamage',afterDefense],['actualDamage',applied],['overkill',overkill]])t[key]=t[key].add(value);
   }
   if(!channels.physical.actualHpLost.add(channels.element.actualHpLost).eq(actual)||!channels.physical.overkill.add(channels.element.overkill).eq(hit.attempted.sub(actual)))throw Error('两通道分摊收支不一致');
   attacks.push({side,target,attackIndex:index,randomWord:word,critThreshold:hit.roll.threshold,probabilityDeclared:hit.roll.declared,probabilityEffective:hit.roll.effective,critical:hit.roll.critical,criticalMultiplier:hit.roll.appliedMultiplier,baseDamage:a[side].hitDamage,effectiveArmor:hit.effectiveArmor,armorFactor:hit.armorFactor,effectiveElementResistance:hit.effectiveElementResistance,elementFactor:hit.elementFactor,afterDefense:hit.attempted,actualHpLost:actual,overkill:hit.attempted.sub(actual),leechRequested:request,channels});
  }
  for(const h of attacks)hp[h.target]=hp[h.target].sub(h.actualHpLost);
  const afterDamage=[...hp],leech=[];
  for(let side=0;side<2;side++){const requested=requests[side],applied=hp[side].cmp(Z)>0?qmin(requested,max[side].sub(hp[side])):Z,wasted=requested.sub(applied);hp[side]=hp[side].add(applied);totals[side].leechApplied=totals[side].leechApplied.add(applied);totals[side].healingWasted=totals[side].healingWasted.add(wasted);leech.push({side,requested,applied,wasted,reason:afterDamage[side].eq(Z)?'伤害阶段已死亡，吸血不能复活':applied.cmp(requested)<0?'生命上限限制':'正常或无吸血请求'});const hit=attacks.find(h=>h.side===side);if(hit)hit.leechApplied=applied;}
  const afterLeech=[...hp],regen=[],isTick=tick.eq(now);
  for(let side=0;side<2;side++){const capacity=isTick?a[side].regenPerSecond:Z,alive=hp[side].cmp(Z)>0,requested=alive?capacity:Z,applied=alive?qmin(requested,max[side].sub(hp[side])):Z,wasted=requested.sub(applied),skipped=alive?Z:capacity;hp[side]=hp[side].add(applied);totals[side].regenApplied=totals[side].regenApplied.add(applied);totals[side].healingWasted=totals[side].healingWasted.add(wasted);totals[side].regenCapacitySkippedOnDeath=totals[side].regenCapacitySkippedOnDeath.add(skipped);regen.push({side,tick:isTick,scheduledCapacity:capacity,requested,applied,wasted,skippedBecauseDead:skipped});}
  if(isTick)tick=tick.add(O);
  for(let side=0;side<2;side++){const t=totals[side],ledger=max[side].sub(t.damageTaken).add(t.leechApplied).add(t.regenApplied);if(!hp[side].eq(ledger)||hp[side].cmp(Z)<0||hp[side].cmp(max[side])>0)throw Error('精确生命收支或上下限核验失败');for(const key of ['attemptedDamage','actualDamage','overkill'])if(!t.channels.physical[key].add(t.channels.element[key]).eq(t[key]))throw Error('累计通道账本不一致');}
  steps.push({time:now,before,attacks,afterDamage,leech,afterLeech,regen,after:[...hp]});timeline.push({time:now,playerHp:hp[0],enemyHp:hp[1]});
  if(hp.some(x=>x.eq(Z))){outcome=hp.every(x=>x.eq(Z))?'draw':hp[1].eq(Z)?'win':'death';break;}
 }
 const targetVerdict=outcome!=='win'?'not_achieved':now.cmp(goals.minKillSeconds)<0?'too_fast':now.cmp(goals.maxKillSeconds)>0?'too_slow':'within_target';
 const specialCycle=!variable.some(Boolean)&&a.every(p=>p.attackIntervalSeconds.eq(O)&&p.leechFraction.eq(Z))&&fixedHits[0].add(fixedHits[1]).cmp(Z)>0&&a.every((p,i)=>fixedHits[i].cmp(max[1-i])<0&&p.regenPerSecond.cmp(fixedHits[1-i])>=0);
 const metrics=a.map((p,i)=>({side:i,...totals[i],basePerHit:p.hitDamage,effectiveArmor:hits[i].effectiveArmor,effectiveElementResistance:hits[i].effectiveElementResistance,afterDefensePerHit:hits[i].attempted,physicalAfterDefensePerHit:hits[i].physical,elementAfterDefensePerHit:hits[i].element,elementBasePerHit:p.elementDamage,expectedAfterDefensePerAttack:hits[i].attempted.mul(O.add(policies[i].effective.mul(p.critMultiplier.sub(O)))),criticalAfterDefensePerAttack:hits[i].attempted.mul(p.critMultiplier),variableCriticalDamage:variable[i],perHitMeaning:'PerHit字段为未暴击单击；期望值不代入攻击，实际逐击见steps',finalHp:hp[i],lifeLedger:max[i].sub(totals[i].damageTaken).add(totals[i].leechApplied).add(totals[i].regenApplied)}));
 const data={battle:{outcome,time:now,playerHp:hp[0],enemyHp:hp[1],timeline,seed:random.seed},metrics,steps};
 const issues=[],stats={rounded:0},projected=displayTree(data,issues,'',stats);
 for(let i=1;i<steps.length;i++)if(!steps[i-1].time.eq(steps[i].time)&&projected.steps[i-1].time===projected.steps[i].time)issues.push({path:`steps.${i-1}→${i}.time`,kind:'display_time_alias',exactBefore:steps[i-1].time.toString(),exactAfter:steps[i].time.toString()});
 for(let i=0;i<steps.length;i++)for(let side=0;side<2;side++)for(const [before,after] of [['before','afterDamage'],['afterDamage','afterLeech'],['afterLeech','after']])if(!steps[i][before][side].eq(steps[i][after][side])&&projected.steps[i][before][side]===projected.steps[i][after][side])issues.push({path:`steps.${i}.${before}→${after}.${side}`,kind:'display_swallowed_change',exactBefore:steps[i][before][side].toString(),exactAfter:steps[i][after][side].toString()});
 const config={format:FORMAT,name:input.name,rules:{version:VERSION,armorK:rules.armorK.toNumber(),timeoutSeconds:rules.timeoutSeconds.toNumber()},random,goals:Object.fromEntries(Object.entries(goals).map(([k,x])=>[k,x.toNumber()])),...Object.fromEntries(a.map((p,i)=>[i?'enemy':'player',Object.fromEntries(Object.entries(p).map(([k,x])=>[k,x.toNumber()]))]))};
 const diagnosis=[{code:'pace',certainty:'精确规则判断',text:'按精确时间与配置目标比较：'+targetVerdict,evidence:{targetVerdict,time:now.toString(),goals:exactTree(goals)}}];
 if(specialCycle)diagnosis.push({code:'full_reset_cycle',certainty:'严格充分条件',text:'仅确认既有1秒满血重置特殊循环',evidence:{periodSeconds:1}});
 else if(outcome==='timeout')diagnosis.push({code:'finite_timeout',certainty:'有限观察',text:'只确认观察窗内未击杀，不称永久循环',evidence:{time:now.toString()}});
 for(let side=0;side<2;side++)if(a[side].hitDamage.eq(Z)&&a[side].elementDamage.eq(Z))diagnosis.push({code:'zero_damage_'+side,text:'本方两通道基础伤害均为0，且本规则没有其他伤害来源',evidence:{physical:0,element:0}});
 if(!variable[0]&&a[1].regenPerSecond.eq(Z)&&a[1].leechFraction.eq(Z)&&fixedHits[0].cmp(Z)>0){const ratio=max[1].div(fixedHits[0]),n=(ratio.n+ratio.d-1n)/ratio.d;diagnosis.push({code:'static_hit_requirement',text:'角色单击无波动、敌无恢复且假定角色一直存活，精确所需击数；不把随机期望代入',evidence:{hits:n<=BigInt(Number.MAX_SAFE_INTEGER)?Number(n):null,exactHits:String(n),timeIfAlwaysAlive:a[0].attackIntervalSeconds.mul(new Q(n)).toString()}});}
 return {format:'critical-dual-channel-result-v1',ruleVersion:VERSION,inputRuleVersion:input.rules.version,numericVersion:NUMERIC_VERSION,identity:'研究者指定的物理+单元素+共同暴击示例规则，非商业游戏真实公式',legacyMigration:v.legacy?'旧配置补暴击率0、总倍率1、种子1；8字段再补元素相关0':'原生13字段与显式随机配置',config,inputConfig:structuredClone(input),exactConfig:exactTree({rules,random:{algorithm:random.algorithm,seed:String(random.seed)},goals,player:a[0],enemy:a[1]}),fixedSeed:random.seed,randomness:'按种子/角色/攻击序号取样；同击两通道共用判定，不使用期望替代逐击',randomPolicy:exactTree({algorithm:RANDOM_ALGORITHM,seed:random.seed,grid:GRID,actors:policies}),...projected,exact:exactTree(data),quality:{arithmetic:'exact_reduced_rational',arithmeticExact:true,probabilityQuantized:policies.map(p=>p.quantizationLoss.cmp(Z)>0),displayPrecisionSensitive:issues.length>0,precisionSensitive:issues.length>0,issues,displayRoundedValues:stats.rounded,policy:'exact为权威主值；Number字段仅供兼容显示，舍入不参与战斗判断；显示丢失非零值或变化时阻止显示轨迹的强判断'},decision:{targetVerdict,specialCycle},diagnosis};
}
function attackForWord(input,side,word){if(![0,1].includes(side))throw Error('角色须0/1');const v=validate(input),p=v.actors[side];return exactTree(hitForWord(p,normalHit(p,v.actors[1-side],v.rules),word));}
module.exports={run,runJSON:text=>run(parseJSON(text)),parseJSON,validate,VERSION,NUMERIC_VERSION,FORMAT,FIELDS,OLD_FIELDS,DUAL_FIELDS,Q,decimal,sampleWord,criticalFromWord,attackForWord,RANDOM_ALGORITHM,GRID};
