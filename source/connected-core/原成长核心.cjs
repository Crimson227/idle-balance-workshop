'use strict';
const B=require('./战斗引擎.cjs'),{Q}=B,VERSION='growth-exact-1.0.0',FORMAT='exact-growth-loop-v1';
const Z=new Q(0n),O=new Q(1n),q=x=>x instanceof Q?x:typeof x==='string'&&x.includes('/')?new Q(...x.split('/').map(BigInt)):B.decimal(x),min=(a,b)=>a.cmp(b)<0?a:b;
function encode(x){if(x instanceof Q)return x.toString();if(Array.isArray(x))return x.map(encode);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,encode(v)]));return x;}
function decimalText(x){
 if(x.n===0n)return '0';let den=x.d,two=0,five=0;while(den%2n===0n){den/=2n;two++;}while(den%5n===0n){den/=5n;five++;}
 const places=Math.max(two,five);if(den!==1n||places>24)throw Error('成长属性不是受支持的24位有限十进制，未转成Number或舍入');
 let n=x.n*2n**BigInt(places-two)*5n**BigInt(places-five),negative=n<0n;if(negative)n=-n;
 let text=n.toString().padStart(places+1,'0');if(places)text=text.slice(0,-places)+'.'+text.slice(-places);text=(negative?'-':'')+text;
 B.decimal(text,'成长属性');return text;
}
function keys(o,w,where){if(!o||typeof o!=='object'||Array.isArray(o))throw Error(where+'须为对象');for(const k of Object.keys(o))if(!w.includes(k))throw Error(where+'未知字段：'+k);for(const k of w)if(!(k in o))throw Error(where+'缺少字段：'+k);}
function numeric(x,lo,hi,label,positive=false){const v=B.decimal(x,label);if(v.cmp(q(lo))<0||v.cmp(q(hi))>0||(positive&&v.eq(Z)))throw Error(label+'超出声明范围');return v;}
function integer(x,lo,hi,label){const v=numeric(x,lo,hi,label);if(v.d!==1n)throw Error(label+'须为整数');return Number(v.n);}
function battleInput(v,player,enemy,seed,name='成长战斗'){
 return {format:B.FORMAT,name,rules:{version:B.VERSION,armorK:decimalText(v.rules.armorK),timeoutSeconds:decimalText(v.rules.battleTimeoutSeconds)},random:{algorithm:B.RANDOM_ALGORITHM,seed},goals:{minKillSeconds:0,maxKillSeconds:decimalText(v.rules.battleTimeoutSeconds)},player:Object.fromEntries(Object.entries(player).map(([k,x])=>[k,decimalText(x)])),enemy:Object.fromEntries(Object.entries(enemy).map(([k,x])=>[k,decimalText(x)]))};
}
function prepare(c){
 keys(c,['format','version','name','player','stages','upgrades','strategy','economy','rules','simulation','replayStages'],'成长配置');if(c.format!==FORMAT||c.version!==VERSION)throw Error('成长格式/版本不支持');if(typeof c.name!=='string'||!c.name.trim()||c.name.length>120)throw Error('名称须1—120字');
 keys(c.rules,['armorK','battleTimeoutSeconds','victoryDelaySeconds','retryDelaySeconds'],'rules');
 const rules={armorK:numeric(c.rules.armorK,1,10000,'armorK'),battleTimeoutSeconds:numeric(c.rules.battleTimeoutSeconds,1,120,'battleTimeoutSeconds'),victoryDelaySeconds:numeric(c.rules.victoryDelaySeconds,0,86400,'victoryDelaySeconds'),retryDelaySeconds:numeric(c.rules.retryDelaySeconds,'0.1',86400,'retryDelaySeconds')};
 keys(c.economy,['initialCoins','incomePerSecond','incomeDuringCombat','costScale','rewardScale'],'economy');if(typeof c.economy.incomeDuringCombat!=='boolean')throw Error('incomeDuringCombat须布尔值');
 const economy={initialCoins:numeric(c.economy.initialCoins,0,'1e12','initialCoins'),incomePerSecond:numeric(c.economy.incomePerSecond,0,'1e6','incomePerSecond'),incomeDuringCombat:c.economy.incomeDuringCombat,costScale:numeric(c.economy.costScale,0,'1e6','costScale',true),rewardScale:numeric(c.economy.rewardScale,0,'1e6','rewardScale')};
 keys(c.simulation,['runSeed','observationSeconds','maxEvents','maxBattles'],'simulation');
 const simulation={runSeed:integer(c.simulation.runSeed,0,4294967295,'runSeed'),observationSeconds:numeric(c.simulation.observationSeconds,0,7776000,'observationSeconds',true),maxEvents:integer(c.simulation.maxEvents,1,100000,'maxEvents'),maxBattles:integer(c.simulation.maxBattles,1,10000,'maxBattles')};
 if(!Array.isArray(c.stages)||c.stages.length<1||c.stages.length>1000)throw Error('stages须为1—1000关显式表');
 const v={rules,economy,simulation};
 const actor=raw=>{keys(raw,B.FIELDS.map(f=>f[0]),'战斗角色');return Object.fromEntries(Object.entries(raw).map(([k,x])=>[k,B.decimal(x,k)]));};
 v.player=actor(c.player);v.stages=c.stages.map((s,i)=>{keys(s,['enemy','winReward'],'关卡'+(i+1));const enemy=actor(s.enemy);B.validate(battleInput(v,v.player,enemy,1));return {enemy,winReward:numeric(s.winReward,0,'1e12','winReward')};});
 if(!Array.isArray(c.upgrades)||c.upgrades.length<1||c.upgrades.length>3)throw Error('升级项目须1—3项（物理/元素/生命）');
 const ids=new Set(),fields=new Set();v.upgrades=c.upgrades.map(u=>{keys(u,['id','field','increment','maxLevel','costBase','costStep'],'升级');if(typeof u.id!=='string'||!/^[a-z][a-z0-9_]{0,31}$/.test(u.id)||ids.has(u.id))throw Error('升级id须唯一的小写标识');if(!['hitDamage','elementDamage','maxHp'].includes(u.field)||fields.has(u.field))throw Error('只支持不重复的物理/元素/生命加法升级');ids.add(u.id);fields.add(u.field);return {id:u.id,field:u.field,increment:numeric(u.increment,0,'1e6','increment',true),maxLevel:integer(u.maxLevel,0,2000,'maxLevel'),costBase:numeric(u.costBase,0,'1e12','costBase',true),costStep:numeric(u.costStep,0,'1e12','costStep')};});
 const capped={...v.player};for(const u of v.upgrades)capped[u.field]=capped[u.field].add(u.increment.mul(q(u.maxLevel)));B.validate(battleInput(v,capped,v.stages[0].enemy,1));
 keys(c.strategy,['order','failureMode'],'strategy');if(!Array.isArray(c.strategy.order)||!c.strategy.order.length||new Set(c.strategy.order).size!==c.strategy.order.length||c.strategy.order.some(id=>!ids.has(id)))throw Error('order须为非空不重复升级id列表');if(!['wait_upgrade','retry_after_delay'].includes(c.strategy.failureMode))throw Error('失败模式不支持');v.strategy=structuredClone(c.strategy);
 if(!Array.isArray(c.replayStages)||c.replayStages.length>10)throw Error('replayStages最多10个关卡');v.replayStages=c.replayStages.map(x=>integer(x,1,v.stages.length,'重放关卡'));
 return v;
}
function battleSeed(runSeed,stage,attempt){if(!Number.isInteger(runSeed)||runSeed<0||runSeed>4294967295||!Number.isInteger(stage)||stage<1||stage>1000||!Number.isInteger(attempt)||attempt<1||attempt>10000)throw Error('成长战斗随机地址越界');return B.sampleWord((runSeed^Math.imul(stage,0xc2b2ae35))>>>0,0,attempt);}
function playerAt(v,levels){keys(levels,v.upgrades.map(u=>u.id),'等级快照');const p={...v.player};for(const u of v.upgrades)p[u.field]=p[u.field].add(u.increment.mul(q(integer(levels[u.id],0,u.maxLevel,'等级'))));return p;}
function battleView(result,remaining){
 if(q(result.exact.battle.time).cmp(remaining)<=0)return {interrupted:false,data:result.exact};
 const steps=result.exact.steps.filter(g=>q(g.time).cmp(remaining)<=0),hp=steps.at(-1)?.after??[result.exactConfig.player.maxHp,result.exactConfig.enemy.maxHp];
 const metrics=[0,1].map(side=>({side,attacks:0,criticalAttacks:0,noncriticalAttacks:0,actualDamage:Z,damageTaken:Z,attemptedDamage:Z,overkill:Z,leechRequested:Z,leechApplied:Z,regenApplied:Z,healingWasted:Z,regenCapacitySkippedOnDeath:Z,channels:{physical:{actualDamage:Z},element:{actualDamage:Z}}}));
 for(const g of steps){for(const h of g.attacks){const m=metrics[h.side];m.attacks++;m[h.critical?'criticalAttacks':'noncriticalAttacks']++;for(const [key,value] of [['actualDamage',h.actualHpLost],['attemptedDamage',h.afterDefense],['overkill',h.overkill],['leechRequested',h.leechRequested]])m[key]=m[key].add(q(value));metrics[h.target].damageTaken=metrics[h.target].damageTaken.add(q(h.actualHpLost));for(const channel of ['physical','element'])m.channels[channel].actualDamage=m.channels[channel].actualDamage.add(q(h.channels[channel].actualHpLost));}
  for(let side=0;side<2;side++){const m=metrics[side];m.leechApplied=m.leechApplied.add(q(g.leech[side].applied));m.regenApplied=m.regenApplied.add(q(g.regen[side].applied));m.healingWasted=m.healingWasted.add(q(g.leech[side].wasted)).add(q(g.regen[side].wasted));m.regenCapacitySkippedOnDeath=m.regenCapacitySkippedOnDeath.add(q(g.regen[side].skippedBecauseDead));}}
 return {interrupted:true,data:encode({battle:{outcome:'interrupted_budget',time:remaining,playerHp:hp[0],enemyHp:hp[1],seed:result.fixedSeed},metrics,steps})};
}
function run(input,seedOverride){
 const v=prepare(input),seed=seedOverride===undefined?v.simulation.runSeed:integer(seedOverride,0,4294967295,'运行种子'),budget=v.simulation.observationSeconds,projects=new Map(v.upgrades.map(u=>[u.id,u]));
 let t=Z,coins=v.economy.initialCoins,earned=Z,rewards=Z,spent=Z,pointer=0,stage=1,needUpgrade=false,status='budget_exhausted',stopReason=null,firstBlock=null;
 const levels=Object.fromEntries(v.upgrades.map(u=>[u.id,0])),battles=[],purchases=[],waits=[],events=[],replays=[],replayKeys=new Set();
 const stages=v.stages.map((_,i)=>({stage:i+1,arrival:i===0?Z:null,passedAt:null,attempts:0,failures:0,deathCount:0,drawCount:0,timeoutCount:0,interruptedCount:0,combatSeconds:Z,waitingSeconds:Z,walletArrival:i===0?coins:null,walletClear:null,levelsArrival:i===0?{...levels}:null,levelsClear:null,purchaseCount:0}));
 function emit(kind,data){data.sequence=events.length+1;events.push({kind,...data});if(events.length>v.simulation.maxEvents)throw Error(`运行事件超过${v.simulation.maxEvents}上限：第${stage}关，未返回完整结果`);if(coins.cmp(Z)<0||!coins.eq(v.economy.initialCoins.add(earned).add(rewards).sub(spent)))throw Error('成长资源精确收支失败');}
 function choice(){for(let offset=0;offset<v.strategy.order.length;offset++){const pos=(pointer+offset)%v.strategy.order.length,id=v.strategy.order[pos];if(levels[id]<projects.get(id).maxLevel)return {id,pos};}return null;}
 const price=id=>{const u=projects.get(id);return u.costBase.add(u.costStep.mul(q(levels[id]))).mul(v.economy.costScale);};
 function wait(seconds,reason){const delta=min(seconds,budget.sub(t));if(delta.cmp(Z)<=0)return;const start=t,income=v.economy.incomePerSecond.mul(delta);t=t.add(delta);coins=coins.add(income);earned=earned.add(income);stages[stage-1].waitingSeconds=stages[stage-1].waitingSeconds.add(delta);const w={stage,reason,start,end:t,seconds:delta,income,balance:coins};waits.push(w);emit('wait',w);}
 function idle(reason){wait(budget.sub(t),'idle_after_'+reason);}
 function saveReplay(b,inputBattle,view,reason){const key=stage+':'+b.attempt;if(replayKeys.has(key))return;replayKeys.add(key);replays.push({key,reason,stage,attempt:b.attempt,seed:b.seed,levels:{...levels},input:inputBattle,cutoffSeconds:view.interrupted?b.seconds:null,executed:view.data});}
 while(t.cmp(budget)<0&&stage<=v.stages.length){
  let bought=0;
  while(true){const selected=choice();if(!selected)break;const cost=price(selected.id);if(coins.cmp(cost)<0)break;coins=coins.sub(cost);spent=spent.add(cost);levels[selected.id]++;pointer=(selected.pos+1)%v.strategy.order.length;bought++;stages[stage-1].purchaseCount++;const p={time:t,stage,id:selected.id,level:levels[selected.id],cost,balance:coins,levels:{...levels}};purchases.push(p);emit('purchase',p);}
  if(needUpgrade){if(bought)needUpgrade=false;else{const selected=choice();if(!selected){status='policy_blocked';stopReason='selected_projects_capped';idle(status);break;}if(v.economy.incomePerSecond.eq(Z)){status='funding_blocked';stopReason='selected_upgrade_unfunded_no_income';idle(status);break;}const gap=price(selected.id).sub(coins);if(gap.cmp(Z)<=0)throw Error('等待未推进状态：可购买升级未被处理');wait(gap.div(v.economy.incomePerSecond),'upgrade_funding');continue;}}
  if(battles.length>=v.simulation.maxBattles)throw Error(`战斗超过${v.simulation.maxBattles}上限：第${stage}关，未返回完整结果`);
  const row=stages[stage-1],attempt=++row.attempts,actualSeed=battleSeed(seed,stage,attempt),player=playerAt(v,levels),inputBattle=battleInput(v,player,v.stages[stage-1].enemy,actualSeed,`成长第${stage}关第${attempt}次`),engineResult=B.run(inputBattle),view=battleView(engineResult,budget.sub(t)),d=view.data,seconds=q(d.battle.time),outcome=d.battle.outcome;
  if(seconds.cmp(Z)<=0||seconds.cmp(budget.sub(t))>0)throw Error('战斗未推进时间或越过观察预算');
  const start=t;t=t.add(seconds);const income=v.economy.incomeDuringCombat?v.economy.incomePerSecond.mul(seconds):Z,reward=outcome==='win'?v.stages[stage-1].winReward.mul(v.economy.rewardScale):Z;
  earned=earned.add(income);rewards=rewards.add(reward);coins=coins.add(income).add(reward);row.combatSeconds=row.combatSeconds.add(seconds);
  const b={stage,attempt,seed:actualSeed,start,end:t,seconds,outcome,income,reward,balance:coins,levels:{...levels},playerHp:q(d.battle.playerHp),enemyHp:q(d.battle.enemyHp),physicalActual:q(d.metrics[0].channels.physical.actualDamage),elementActual:q(d.metrics[0].channels.element.actualDamage),damageTaken:q(d.metrics[0].damageTaken)};
  battles.push(b);emit('battle',b);
  if(v.replayStages.includes(stage)&&attempt===1)saveReplay(b,inputBattle,view,'configured_stage');
  if(view.interrupted){row.interruptedCount++;saveReplay(b,inputBattle,view,'observation_budget_prefix');break;}
  if(outcome==='win'){row.passedAt=t;row.walletClear=coins;row.levelsClear={...levels};stage++;if(stage>v.stages.length){status='completed';break;}stages[stage-1].arrival=t;stages[stage-1].walletArrival=coins;stages[stage-1].levelsArrival={...levels};wait(v.rules.victoryDelaySeconds,'victory_delay');}
  else{row.failures++;row[{death:'deathCount',draw:'drawCount',timeout:'timeoutCount'}[outcome]]++;if(firstBlock===null){firstBlock={...b};saveReplay(b,inputBattle,view,'first_failed_battle');}
   if(v.upgrades.every(u=>levels[u.id]>=u.maxLevel)&&engineResult.metrics.every(m=>!m.variableCriticalDamage)){status='structural_block';stopReason='all_upgrades_capped_fixed_damage_failure';idle(status);break;}
   needUpgrade=v.strategy.failureMode==='wait_upgrade';wait(v.rules.retryDelaySeconds,'retry_delay');}
 }
 for(const row of stages)row.noProgressSeconds=row.arrival===null?null:(row.passedAt??t).sub(row.arrival);
 const result={format:'exact-growth-result-v1',version:VERSION,battleVersion:B.VERSION,runSeed:seed,inputConfig:structuredClone(input),status,stopReason,time:t,highest:stage-1,balance:coins,levels,initialCoins:v.economy.initialCoins,passiveEarned:earned,rewardsEarned:rewards,spent,purchases,waits,battles,stages,firstBlock,events,replays,ledger:{initial:v.economy.initialCoins,passive:earned,rewards,spent,final:coins,exactConserved:v.economy.initialCoins.add(earned).add(rewards).sub(spent).eq(coins)},scope:'每场调用已验收ddr-3.0.0战斗，不用标量DPS；货币/时间精确分数，无回访/离线cap或留存结论'};
 return encode(result);
}
function replay(result,stage,attempt){if(result.version!==VERSION||result.format!=='exact-growth-result-v1')throw Error('成长结果版本不支持');const v=prepare(result.inputConfig),entry=result.battles.find(b=>b.stage===stage&&b.attempt===attempt);if(!entry)throw Error('无此实际战斗记录');if(entry.seed!==battleSeed(result.runSeed,stage,attempt))throw Error('实际种子与运行/关卡/尝试地址不符');const cutoff=q(entry.seconds);if(cutoff.cmp(Z)<=0||cutoff.cmp(v.rules.battleTimeoutSeconds)>0)throw Error('实际战斗截点越界');const player=playerAt(v,entry.levels),input=battleInput(v,player,v.stages[stage-1].enemy,entry.seed,`成长第${stage}关第${attempt}次`),full=B.run(input),view=battleView(full,cutoff);return {input,cutoffSeconds:view.interrupted?entry.seconds:null,executed:view.data};}
module.exports={VERSION,FORMAT,prepare,run,runJSON:(text,seed)=>run(B.parseJSON(text),seed),replay,battleSeed,decimalText,q,encode,battleView};
