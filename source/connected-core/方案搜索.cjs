'use strict';
const C=require('./一体化核心.cjs'),copy=structuredClone,n=C.number;
const VERSION='connected-search-1.2.1',number=x=>Number(Number(x).toPrecision(12)),text=x=>String(number(x));
const sum=(rs,f)=>rs.reduce((s,r)=>s+f(r),0),known=g=>Object.values(g.goals).some(x=>x!==null),met=r=>!Object.values(r.modeledGoals||r.goals).some(x=>x===false);
function stats(rs){const times=rs.filter(r=>r.completionSeconds!==null).map(r=>n(r.completionSeconds));return {samples:rs.length,completed:rs.filter(r=>r.status==='completed').length,lowest:rs.length?Math.min(...rs.map(r=>r.highest)):0,highest:Math.max(0,...rs.map(r=>r.highest)),gap:Math.max(0,...rs.map(r=>n(r.longestGap.seconds))),time:rs.length&&times.length===rs.length?Math.max(...times):null,timeMin:times.length?Math.min(...times):null,misses:rs.filter(r=>!met(r)).length,spent:rs.length?sum(rs,r=>n(r.spent))/rs.length:0,purchases:rs.length?sum(rs,r=>r.purchases.length)/rs.length:0,deaths:sum(rs,r=>r.battles.filter(b=>b.outcome==='death'||b.outcome==='draw').length),timeouts:sum(rs,r=>r.battles.filter(b=>b.outcome==='timeout').length),failures:sum(rs,r=>r.battles.filter(b=>b.outcome!=='win').length),enemyLeft:Math.max(0,...rs.map(r=>n(r.firstBlock?.enemyHp??'0')))};}
function goals(g,rs){
 const counts={early:0,late:0,unfinished:0,wait:0,visits:0},samples=[],cmp=(a,b)=>Math.sign(n(C.offset(a,b)));let deficit=0;
 for(const r of rs){const flags={early:false,late:false,unfinished:false,wait:false,visits:false},t=r.completionSeconds;
  if(g.goals.minCompletionSeconds!==null||g.goals.maxCompletionSeconds!==null){
   if(t===null){flags.unfinished=true;deficit+=1+(g.world.stageCount-r.highest)/g.world.stageCount;}
   else{if(g.goals.minCompletionSeconds!==null&&cmp(t,g.goals.minCompletionSeconds)<0){flags.early=true;deficit+=(n(g.goals.minCompletionSeconds)-n(t))/Math.max(1,n(g.goals.minCompletionSeconds));}if(g.goals.maxCompletionSeconds!==null&&cmp(t,g.goals.maxCompletionSeconds)>0){flags.late=true;deficit+=(n(t)-n(g.goals.maxCompletionSeconds))/Math.max(1,n(g.goals.maxCompletionSeconds));}}
  }
  if(g.goals.maxGapSeconds!==null&&cmp(r.longestGap.seconds,g.goals.maxGapSeconds)>0){flags.wait=true;deficit+=(n(r.longestGap.seconds)-n(g.goals.maxGapSeconds))/Math.max(1,n(g.goals.maxGapSeconds));}
  if(g.goals.stagesPerVisit!==null){const shortfalls=r.visits.filter(v=>!v.offline).map(v=>Math.max(0,Math.min(g.goals.stagesPerVisit,g.world.stageCount-v.highestBefore)-v.newStages));flags.visits=shortfalls.some(x=>x>0);if(flags.visits)deficit+=Math.max(...shortfalls)/g.goals.stagesPerVisit;}
  for(const k of Object.keys(counts))if(flags[k])counts[k]++;samples.push({seed:r.seed,...flags});
 }
 return {counts,total:Object.values(counts).reduce((a,b)=>a+b,0),failedSamples:samples.filter(s=>Object.keys(counts).some(k=>s[k])).length,deficit,samples};
}
function protocol(g){const original=g.simulation.seeds,discovery=original.slice(0,2),validation=original.slice(2),used=new Set(original);for(let i=301;validation.length<3;i++){const s=C.multi.legacy.seedAt(original[0],i);if(!used.has(s)){used.add(s);validation.push(s);}}return {discovery,validation,algorithm:'original first two; unused originals and seedAt(first,301+) for holdout'};}
function timingRatio(game,runs){
 let ratio=1.05;const g=game.goals;
 for(const r of runs){
  if(g.maxCompletionSeconds!==null&&r.completionSeconds!==null&&n(C.offset(r.completionSeconds,g.maxCompletionSeconds))>0){const combat=sum(r.battles,b=>n(b.seconds)),fixed=Math.max(0,n(r.completionSeconds)-combat),target=g.minCompletionSeconds===null?n(g.maxCompletionSeconds):(n(g.minCompletionSeconds)+n(g.maxCompletionSeconds))/2;ratio=Math.max(ratio,combat/Math.max(.1,target-fixed));}
  if(g.maxGapSeconds!==null&&n(C.offset(r.longestGap.seconds,g.maxGapSeconds))>0){const p=C.progressGap(r),combat=n(p.totals.combat),fixed=Math.max(0,n(p.seconds)-combat);ratio=Math.max(ratio,combat/Math.max(.1,n(g.maxGapSeconds)-fixed));}
 }
 return ratio;
}
function plan(game,runs){
 C.compile(game);if(game.format!=='idle-connected-game-v2')throw Error('先把旧配置转换为五通道，再搜索。');
 const r=runs[0],d=C.diagnose(r),v=C.compile(game).v,b=(d.cause==='waiting_for_login'?d.actualBattle:null)||r.firstBlock||d.actualBattle,fb=b?C.battleConfig(v,b.levels,b.stage,b.seed):null,diag=b?C.diagnose(r,b.stage):d;
 const early=game.goals.minCompletionSeconds!==null&&runs.some(x=>x.completionSeconds!==null&&n(x.completionSeconds)<n(game.goals.minCompletionSeconds)),resource=!!diag.progress.flags.hasResourceBlock,misses=goals(game,runs).counts,timedWin=!early&&!resource&&d.cause==='normal'&&b?.outcome==='win'&&(misses.late>0||misses.wait>0),cause=early?'too_fast':resource?'resources':d.cause==='waiting_for_login'?'login':b?.outcome==='death'||b?.outcome==='draw'?'survival':b?.outcome==='timeout'?'damage':timedWin?misses.late?'too_slow':'long_gap':d.cause;
 const knobs=[],add=k=>{if(Number.isFinite(k.target)&&Number.isFinite(k.current)&&k.max>=k.min)knobs.push({...k,target:Math.max(k.min,Math.min(k.max,number(k.target)))});},selected=v.upgrades.filter(u=>v.strategy.order.includes(u.id)&&u.maxLevel>0),damage=b?Object.entries(b.channels||{}).map(([t,c])=>({type:t,value:n(c.mitigatedDamage??c.actualDamage)})).filter(x=>game.types[x.type]&&x.value>0).sort((a,b)=>b.value-a.value):[];
 const seconds=b?n(b.seconds):1,enemyHp=fb?n(fb.enemy.hp):n(game.world.enemy.hp),dealt=b?Math.max(.000001,enemyHp-n(b.enemyHp)):1,killRatio=Math.max(timedWin?timingRatio(game,runs):1.05,enemyHp/dealt),targetDuration=early?(n(game.goals.minCompletionSeconds)+(game.goals.maxCompletionSeconds===null?n(game.goals.minCompletionSeconds):n(game.goals.maxCompletionSeconds)))/2:null;
 if(resource){
  const next=diag.funding||diag.firstPurchaseWait,firstFunds=diag.firstPurchaseWait?n(diag.firstPurchaseWait.balance):b?n(b.balance):next?n(next.balance):n(r.balance),price=next?n(next.cost):selected.length?n(selected[0].costBase.mul(v.economy.costScale)):0,rate=n(game.economy.incomePerSecond),session=n(game.behavior.sessionMinutes)*60;
  const wait=game.goals.maxGapSeconds===null?Math.max(60,Math.min(session,Math.max(1,n(game.simulation.observationSeconds)/(Math.max(1,game.world.stageCount-r.highest))))):Math.max(1,n(game.goals.maxGapSeconds)),usable=game.behavior.mode==='continuous'?wait:Math.min(wait,session+n(game.behavior.offlineCapHours)*3600),funds=Math.max(firstFunds+rate*Math.min(wait,session),.000001);
  if(price>0&&selected.length){const minFactor=Math.max(...selected.map(u=>1e-9/n(u.costBase))),maxFactor=Math.min(...selected.flatMap(u=>[1e12/n(u.costBase),n(u.costStep)>0?1e12/n(u.costStep):Infinity]));add({id:'cost',group:'cost',label:'队列中下一笔升级价格',current:price,min:price*minFactor,max:price*maxFactor,target:funds,direction:-1,ids:selected.map(u=>u.id),family:'cost'});}
  if(price>0){add({id:'income',group:'income',label:'每秒固定金币',current:rate,min:0,max:1e6,target:Math.max(rate*1.1,(price-firstFunds)/Math.max(1,usable)),direction:1,family:'income'});if(r.highest>0&&n(r.rewardsEarned)>0)add({id:'reward',group:'reward',label:'首关奖励',current:n(C.rules.reward(game,0))*n(game.economy.rewardScale),min:0,max:n(C.rules.reward(game,0))*1e6,target:n(C.rules.reward(game,0))*n(game.economy.rewardScale)*Math.max(1.1,(price-n(r.passiveEarned))/n(r.rewardsEarned)),direction:1,family:'reward'});}
 }
 if(!early&&b&&['death','draw'].includes(b.outcome)){
  const hp=n(game.player.hp),heal=n(b.leechApplied)+n(b.regenApplied),need=Math.max(hp*1.1,n(b.damageTaken)*killRatio-heal+1);add({id:'hp',group:'survival',label:'角色生命',current:hp,min:1,max:1e7,target:need,direction:1,family:'survival'});
  if(game.mechanisms.armor&&n(b.damageTaken)>0){const rule=C.rules.defense(game),current=n(game.player.armor),target=rule==='ratio'?1-(1-current)*hp/need:rule==='flat'?current+n(b.damageTaken)/Math.max(1,n(b.seconds))*(1-hp/need):(n(game.rules.armorK)+current)*Math.max(1.1,need/hp)-n(game.rules.armorK);add({id:'armor',group:'defense',label:'角色'+(game.ruleLibrary?.labels.armor||'护甲')+(rule==='ratio'?'（比例）':''),current,min:0,max:rule==='ratio'?1:1e5,target,direction:1,family:'defense'});}
 }
 if(b&&(early||timedWin||['timeout','draw'].includes(b.outcome)||cause==='login'||cause==='survival')){
  const types=damage.length?damage.slice(0,2):C.multi.TYPES.filter(t=>game.types[t]&&(t==='physical'?n(game.player.physicalMax)>0:n(game.player[t])>0)).map(type=>({type,value:1}));
  for(const {type} of types){const fs=type==='physical'?['physicalMin','physicalMax']:[type],current=type==='physical'?(n(game.player.physicalMin)+n(game.player.physicalMax))/2:n(game.player[type]);if(current<=0)continue;const raw=b.channels?.[type],dps=raw?n(raw.mitigatedDamage??raw.actualDamage)/Math.max(.01,seconds):current*n(game.player.frequency),desired=early?enemyHp/Math.max(.1,targetDuration/game.world.stageCount):dps*killRatio;add({id:'damage_'+type,group:'damage',label:'角色'+C.multi.NAMES[type]+'伤害',current,min:0,max:current*1e6/Math.max(...fs.map(k=>n(game.player[k]))),target:current*(early?desired/Math.max(.000001,dps):killRatio),direction:early?-1:1,fields:fs,family:'damage'});
   const resistance=game.mechanisms.resistance?n(game.world.enemy[type+'Resist']):0;if(!early&&game.mechanisms.resistance&&resistance>0)add({id:'resist_'+type,group:'resistance',label:'敌人'+C.multi.NAMES[type]+'抗性',current:resistance,min:0,max:1,target:Math.max(0,1-(1-resistance)*killRatio),direction:-1,field:type+'Resist',family:'resistance'});
  }
  const base=n(game.world.enemy.hp),step=n(game.world.steps?.hp??'0'),maxHp=base+(game.world.stageCount-1)*step;add({id:'enemy_hp',group:'enemy_hp',label:'首关敌人生命',current:base,min:1,max:Math.min(1e7*base/maxHp,step?1e6*base/step:1e7),target:base*(early?Math.max(1.1,targetDuration/Math.max(.1,n(r.completionSeconds))):1/killRatio),direction:early?1:-1,family:'enemy_hp'});
 }
 if(early||timedWin)add({id:'frequency',group:'frequency',label:'角色每秒攻击次数',current:n(game.player.frequency),min:.1,max:10,target:n(game.player.frequency)*(early?Math.max(.000001,n(r.completionSeconds))/targetDuration:killRatio),direction:early?-1:1,family:'frequency'});
 const affected=early?[]:cause==='survival'||b?.outcome==='death'?['hp']:damage.slice(0,1).flatMap(x=>x.type==='physical'?['physicalMin','physicalMax']:[x.type]);
 for(const u of selected.filter(u=>u.fields.some(f=>affected.includes(f))).slice(0,1)){const rule=C.rules.config(game)?.growth.upgrades[u.id]?.attribute;if(rule&&!['linear','geometric'].includes(rule.id))continue;const ratio=rule?.id==='geometric',current=n(ratio?rule.factor:u.increment);add({id:'upgrade_'+u.id,group:'upgrade',label:u.name+(ratio?'每级倍率':'每级增加'),current,min:ratio?1:0,max:ratio?100:1e6,target:current*killRatio,direction:1,upgrade:u.id,growthFactor:ratio,family:'upgrade'});}
 if(game.behavior.mode==='visits'&&(cause==='login'||d.cause==='waiting_for_login'))add({id:'visits',group:'visits',label:'每天回访次数',current:game.behavior.visitHours.length,min:game.behavior.visitHours.length,max:Math.min(24,Math.floor(n(game.behavior.sessionMinutes)*game.behavior.visitHours.length/.1)),target:game.behavior.visitHours.length+1,direction:1,integer:true,defaultLocked:true,family:'visits'});
 return {cause,stage:b?.stage??d.stage,knobs:knobs.map(k=>({...k,secondary:resource&&!['cost','income','reward','visits'].includes(k.id)})),summary:early?'完成时间早于目标':cause==='too_slow'?'已通关，但完成时间晚于目标':cause==='long_gap'?'已获胜，但最长未推进时间超过目标':cause==='survival'?'角色先死亡':cause==='damage'?'伤害未在限时内打完':resource?diag.progress.summary:cause==='login'?d.progress.summary:'按实际卡点比较'};
}
function templateKnobs(g,templates=[]){
 if(!Array.isArray(templates)||templates.length>12)throw Error('最多比较12项明确的规则模板');
 if(templates.length&&g.ruleLibrary&&!g.ruleLibrary.enabled)throw Error('先在规则设置中明确启用并核对规则库，再比较模板');
 return templates.map((template,i)=>{const t=copy(template),u=g.upgrades.find(x=>x.id===t.upgrade);if(!['reward','attribute','cost'].includes(t.target)||t.target!=='reward'&&(!u||!u.enabled))throw Error('模板须指向首通奖励或已启用的升级');if(!['constant','linear','geometric','piecewise'].includes(t.spec?.id))throw Error('自动比较只支持固定、线性、比例或分段模板');if(t.spec.id==='piecewise'&&t.spec.segments?.some(s=>s.id==='expression'))throw Error('模板不生成任意公式');const k={id:'template_'+i,group:'template',label:(t.target==='reward'?'首通奖励':u.name+(t.target==='cost'?'费用':'属性'))+' · '+C.rules.GROWTH[t.spec.id],current:0,min:0,max:1,target:1,direction:1,integer:true,family:'template_'+t.target+(t.upgrade?'_'+t.upgrade:'')+'_'+t.spec.id,template:t};apply(g,[k],[{id:k.id,value:1}]);return k;});
}
function pathDistance(path,knobs){return path.reduce((a,p)=>a+(knobs.find(k=>k.id===p.id).template?1:Math.abs(Math.log((p.value+1e-9)/(knobs.find(k=>k.id===p.id).current+1e-9)))),0);}
function family(row,knobs){return row.path.map(p=>knobs.find(k=>k.id===p.id).family).sort().join('+');}
function apply(source,knobs,path){const g=copy(source);for(const p of path){const k=knobs.find(x=>x.id===p.id);if(!k)throw Error('找不到允许的修改项');const value=text(p.value),factor=k.current?text(p.value/k.current):null;
 if(k.template){const t=k.template;if(p.value!==1)throw Error('模板只支持明确切换');if(!g.ruleLibrary)g.ruleLibrary=C.rules.initial(g);if(!g.ruleLibrary.enabled)throw Error('模板比较需要先启用规则库');for(const u of g.upgrades)g.ruleLibrary.growth.upgrades[u.id]||={attribute:{id:'linear'},cost:{id:'linear'},unlock:{stage:1,upgrade:'',level:0}};if(t.target==='reward'){g.ruleLibrary.growth.reward=copy(t.spec);if(t.base!==undefined)g.world.rewardBase=String(t.base);if(t.step!==undefined)g.world.rewardStep=String(t.step);}else{const u=g.upgrades.find(u=>u.id===t.upgrade);g.ruleLibrary.growth.upgrades[u.id]||={};g.ruleLibrary.growth.upgrades[u.id][t.target]=copy(t.spec);if(t.target==='attribute'&&t.step!==undefined)u.increment=String(t.step);if(t.target==='cost'){if(t.base!==undefined)u.costBase=String(t.base);if(t.step!==undefined)u.costStep=String(t.step);}}continue;}
 if(k.id==='cost'){for(const u of g.upgrades)if(k.ids.includes(u.id)){const curve=C.rules.config(g)?.growth.upgrades[u.id]?.cost;for(const f of ['costBase','costStep'])if((f==='costBase'?curve?.id!=='piecewise':!curve||['linear','expression'].includes(curve.id))&&u[f]!=null)u[f]=C.scaled(u[f],factor);const spec=C.rules.config(g)?.growth.upgrades[u.id]?.cost;if(spec?.id==='piecewise')for(const segment of spec.segments)for(const f of ['base','step'])if(segment[f]!==undefined)segment[f]=C.scaled(segment[f],factor);}}
 else if(k.id==='income')g.economy.incomePerSecond=value;else if(k.id==='reward')g.economy.rewardScale=text(n(g.economy.rewardScale)*p.value/k.current);else if(k.id==='hp')g.player.hp=value;else if(k.id==='armor')g.player.armor=value;else if(k.id==='frequency')g.player.frequency=value;
 else if(k.id==='enemy_hp'){g.world.enemy.hp=value;if(g.world.steps?.hp!==undefined)g.world.steps.hp=C.scaled(g.world.steps.hp,factor);}
 else if(k.fields){for(const f of k.fields)g.player[f]=C.scaled(g.player[f],factor);}
 else if(k.field)g.world.enemy[k.field]=value;else if(k.upgrade){if(k.growthFactor)g.ruleLibrary.growth.upgrades[k.upgrade].attribute.factor=value;else g.upgrades.find(u=>u.id===k.upgrade).increment=value;}
 else if(k.id==='visits'){const total=C.scaled(g.behavior.sessionMinutes,String(g.behavior.visitHours.length));while(g.behavior.visitHours.length<Math.round(p.value)){const hours=g.behavior.visitHours,spans=hours.map((h,i)=>({h,span:(hours[i+1]??24)-h})).sort((a,b)=>b.span-a.span);hours.push(spans[0].h+spans[0].span/2);hours.sort((a,b)=>a-b);}g.behavior.sessionMinutes=C.fraction(total,String(g.behavior.visitHours.length));}}
 C.compile(g);return g;}
function evaluate(base,rs,g){
 const a=stats(base),b=stats(rs),hasGoals=known(g),beforeGoals=goals(g,base),afterGoals=goals(g,rs),context=r=>JSON.stringify(r.inputGame.goals)===JSON.stringify(g.goals)&&JSON.stringify(r.inputGame.behavior)===JSON.stringify(g.behavior)&&r.inputGame.simulation.observationSeconds===g.simulation.observationSeconds;
 const paired=base.length>0&&rs.length===base.length&&base.every((r,i)=>r.seed===rs[i].seed&&context(r)&&context(rs[i])),noRegression=paired&&rs.every((r,i)=>r.highest>=base[i].highest)&&b.completed>=a.completed,allMet=hasGoals&&paired&&afterGoals.total===0;
 const goalGain=hasGoals&&(afterGoals.total<beforeGoals.total||afterGoals.total===beforeGoals.total&&beforeGoals.deficit-afterGoals.deficit>=Math.max(1e-8,beforeGoals.deficit*.01)),goalRegression=paired&&afterGoals.samples.some((s,i)=>Object.keys(afterGoals.counts).some(k=>s[k]&&!beforeGoals.samples[i][k]));
 const progressGain=paired?sum(rs,(r)=>r.highest)-sum(base,r=>r.highest):0,gapGain=a.gap-b.gap,materialWait=Math.max(1,a.gap*.01),primaryBenefit=noRegression&&(b.completed>a.completed||progressGain>0||goalGain||gapGain>=materialWait),battleBenefit=noRegression&&a.failures-b.failures>=base.length&&rs.every((r,i)=>r.battles.filter(b=>b.outcome!=='win').length<=base[i].battles.filter(b=>b.outcome!=='win').length),effective=primaryBenefit||battleBenefit;
 const paceShift=a.time!==null&&b.time!==null?Math.abs(Math.log(Math.max(.1,b.time)/Math.max(.1,a.time))):0,magnitude=Math.max((b.completed-a.completed)/Math.max(1,a.samples),progressGain/Math.max(1,a.samples*g.world.stageCount),gapGain/Math.max(1,a.gap),goalGain?allMet?1:Math.max(0,(beforeGoals.total-afterGoals.total)/Math.max(1,beforeGoals.total),(beforeGoals.deficit-afterGoals.deficit)/Math.max(1,beforeGoals.deficit)):0,battleBenefit?(a.failures-b.failures)/Math.max(1,a.failures)*.25:0),componentImprovement=paired&&(b.deaths<a.deaths||b.enemyLeft<a.enemyLeft);
 return {...(!C.rules.coverage(g).complete?{assessmentScope:'supported',overallAllMet:null}:{}),before:a,after:b,beforeGoals,afterGoals,allMet,effective,primaryBenefit,battleBenefit,goalGain,goalRegression,componentImprovement,paired,hasGoals,progressGain,gapGain,materialWait,paceShift,magnitude,value:[allMet?1:0,b.completed,-afterGoals.failedSamples,b.lowest,-b.gap]};
}
function utility(row){return row.grade.magnitude/(1+row.distance+row.grade.paceShift);}
function rank(a,b){
 const x=a.grade,y=b.grade;if(x.allMet!==y.allMet)return Number(y.allMet)-Number(x.allMet);
 if(x.hasGoals&&!x.allMet){const target=y.afterGoals.failedSamples-x.afterGoals.failedSamples||y.afterGoals.total-x.afterGoals.total;if(target)return -target;if(Math.abs(x.afterGoals.deficit-y.afterGoals.deficit)>1e-8)return x.afterGoals.deficit-y.afterGoals.deficit;}
 if(!x.hasGoals&&x.after.completed!==y.after.completed)return y.after.completed-x.after.completed;
 if(x.primaryBenefit!==y.primaryBenefit)return Number(y.primaryBenefit)-Number(x.primaryBenefit);
 return utility(b)-utility(a)||a.path.length-b.path.length||a.distance-b.distance;
}
function scheduleConflict(g){if(C.rules.config(g)?.behavior.offlineBattle||g.behavior.mode!=='visits'||g.goals.minCompletionSeconds===null||g.goals.maxGapSeconds===null)return null;const {v,behavior}=C.compile(g),slots=C.schedule(behavior,v.simulation.observationSeconds),minimum=n(g.goals.minCompletionSeconds),allowed=n(g.goals.maxGapSeconds);for(let i=0;i<slots.length-1;i++){const from=n(slots[i].end)+n(g.rules.battleTimeoutSeconds),to=n(slots[i+1].start);if(minimum>from&&minimum<=to&&to-from>allowed)return {from,to,gap:to-from,allowed,minimum};}return null;}
function useful(grade){return grade.effective&&(grade.allMet||!grade.hasGoals||grade.goalGain&&!grade.goalRegression);}
function finish(r,status=r.status){r.status=status;r.evaluationVersion=VERSION;if(C.rules.config(r.game)||!C.rules.coverage(r.game).complete)r.coverage=C.rules.coverage(r.game);if(r.active&&status!=='running'){r.interrupted={...r.active,reason:status};const row=r.rows.find(x=>x.id===r.active.row);if(row)row.state='partial';r.active=null;}const base=[...r.baseDiscovery,...r.baseValidation];for(const row of r.rows){row.distance=pathDistance(row.path,r.knobs);row.verified=row.discovery.length===r.seeds.discovery.length&&row.validation.length===r.seeds.validation.length&&!row.errors.length;if(row.verified)row.grade=evaluate(base,[...row.discovery,...row.validation],r.game);row.decision=!row.verified?'独立核对未完成':!row.grade.paired?'编号或目标不匹配':row.grade.hasGoals&&!row.grade.allMet?'仍有目标未达到':!row.grade.effective?'没有足够的实际收益':'同类方案中收益与改动幅度更合适的优先';}
 let eligible=r.rows.filter(x=>x.verified&&useful(x.grade)).sort(rank);if(known(r.game)&&eligible.some(x=>x.grade.allMet))eligible=eligible.filter(x=>x.grade.allMet);if(!known(r.game)&&base.some(x=>x.status!=='completed')&&eligible.some(x=>x.grade.after.completed===x.grade.after.samples))eligible=eligible.filter(x=>x.grade.after.completed===x.grade.after.samples);const families=new Set();r.recommendations=[];for(const row of eligible){const family=row.path.map(p=>r.knobs.find(k=>k.id===p.id).family).sort().join('+');if(families.has(family))continue;families.add(family);r.recommendations.push(row.id);row.decision=row.grade.allMet?(C.rules.coverage(r.game).complete?'每个编号均达到所填目标':'已建模部分每个编号达到所填目标'):row.grade.hasGoals?'部分改善，仍未达标':'已核对的实际改善';}r.alternatives=Object.fromEntries([...families].map(key=>[key,eligible.filter(row=>family(row,r.knobs)===key).map(row=>row.id)]));return r;}
function reduce(r,event){if(event.kind==='start')return copy(event.record);if(!r)return r;if(event.kind==='row'&&event.row.id==='base'){Object.assign(r,event.row);delete r.id;}else if(event.kind==='row'){let x=r.rows.find(x=>x.id===event.row.id);if(x)Object.assign(x,event.row);else r.rows.push({...copy(event.row),discovery:[],validation:[],errors:copy(event.row.errors||[])});}else if(event.kind==='active'){r.active={row:event.row,phase:event.phase,seed:event.seed};r.runs=event.runs;}else if(event.kind==='run'){r.active=null;const row=event.row==='base'?r:r.rows.find(x=>x.id===event.row),key=event.row==='base'?(event.phase==='discovery'?'baseDiscovery':'baseValidation'):event.phase;if(event.result)row[key].push(event.result);else if(event.row==='base')r.errors.push(event.error);else row.errors.push(event.error);}else if(event.kind==='state')Object.assign(r,event.state);return r;}
function configuredKnobs(game,runs,options,planned=plan(game,runs)){
 const locked=options.locked||[],bounds=options.bounds||{};
 if(!Array.isArray(locked)||typeof bounds!=='object'||Array.isArray(bounds))throw Error('允许修改项或边界格式不匹配');
 return [...planned.knobs,...templateKnobs(game,options.templates||[])].map(k=>{const b=bounds[k.id]||{},min=b.min===undefined?k.min:Math.max(k.min,Number(b.min)),max=b.max===undefined?k.max:Math.min(k.max,Number(b.max));if(!Number.isFinite(min)||!Number.isFinite(max)||min>max)throw Error(k.label+'范围下限须小于等于上限');return {...k,min,max,locked:locked.includes(k.id)||locked.includes(k.group)||(k.defaultLocked&&!options.allowVisits)};});
}
function scopeKey(record,options){
 const common={maxJoint:options.maxJoint??2,templates:options.templates||[]};
 if(record.baseDiscovery.length)return JSON.stringify({...common,knobs:configuredKnobs(record.game,record.baseDiscovery,options).map(k=>({id:k.id,min:k.min,max:k.max,locked:!!k.locked})).sort((a,b)=>a.id.localeCompare(b.id))});
 const bounds=Object.fromEntries(Object.entries(options.bounds||{}).filter(([,b])=>Object.keys(b).length).sort(([a],[b])=>a.localeCompare(b)).map(([id,b])=>[id,{...(b.min!==undefined?{min:Number(b.min)}:{}),...(b.max!==undefined?{max:Number(b.max)}:{})}]));
 return JSON.stringify({...common,locked:[...new Set(options.locked||[])].sort(),bounds,allowVisits:!!options.allowVisits});
}
function resumeCompatible(record,source,options){return !!record&&JSON.stringify(record.sourceGame)===JSON.stringify(source)&&scopeKey(record,record.options)===scopeKey(record,options);}
async function search(source,options={},run=(g,s,limit)=>C.run(g,s,{maxEvents:limit}),progress=()=>{},previous=null){
 C.assertReady(source);
 const cancelled=options.cancelled,started=Date.now(),opts={seconds:30,maxRuns:100,maxEvents:50000,maxJoint:2,keepCount:3,templates:[],locked:[],bounds:{},...options};
 delete opts.cancelled;
 for(const[k,min,max,label]of [['seconds',1,300,'运行时限'],['maxRuns',5,300,'试算次数'],['maxEvents',100,500000,'累计事件']])if(!Number.isFinite(opts[k])||opts[k]<min||opts[k]>max||k!=='seconds'&&!Number.isInteger(opts[k]))throw Error(label+'范围为'+min+'至'+max);
 if(![1,2,3].includes(opts.maxJoint)||![3,5,10].includes(opts.keepCount))throw Error('联合项数请选择1/2/3，希望保留请选择3/5/10');
 const seeds=protocol(source),g=copy(source);g.simulation.seeds=[...seeds.discovery,...seeds.validation];C.compile(g);templateKnobs(g,opts.templates);
 let r;
 if(previous){validateRecord(previous);if(!resumeCompatible(previous,source,opts))throw Error('配置、允许修改项、边界、联合项数或模板已变，请重新搜索');r=copy(previous);r.options=copy(opts);r.version=VERSION;r.status='running';r.active=null;r.generationRound=Math.min(12,(r.generationRound||4)+2);}
 else r={format:'idle-connected-search-v1',version:VERSION,status:'running',sourceGame:copy(source),game:g,options:copy(opts),seeds,startedAt:new Date().toISOString(),baseDiscovery:[],baseValidation:[],rows:[],errors:[],knobs:[],recommendations:[],runs:0,events:0,elapsedMs:0,phase:'基准核对',active:null,generationRound:4,sessions:[]};
 const initialRuns=r.runs,initialEvents=r.events,previousElapsed=r.elapsedMs||0;let stopped=null;
 r.sessions||=[];if(r.sessions.length>=20)throw Error('本记录已达20轮预算，请导出后重新搜索');const session={startedAt:new Date().toISOString(),options:copy(opts),initialRuns,initialEvents};r.sessions.push(session);
 const emit=e=>progress(e),state=()=>emit({kind:'state',state:{status:r.status,runs:r.runs,events:r.events,elapsedMs:r.elapsedMs,phase:r.phase,recommendations:r.recommendations,alternatives:r.alternatives,knobs:r.knobs,reason:r.reason,issue:r.issue,sessions:r.sessions,generationRound:r.generationRound,reusedSamples:r.reusedSamples||0,duplicateConfigurations:r.duplicateConfigurations||0}});
 const within=()=>{r.elapsedMs=previousElapsed+Date.now()-started;if(Date.now()-started>=opts.seconds*1000)stopped='time_budget';else if(r.runs-initialRuns>=opts.maxRuns)stopped='run_budget';else if(r.events-initialEvents>=opts.maxEvents)stopped='event_budget';else if(cancelled?.())stopped='cancelled';return !stopped;};
 emit({kind:'start',record:r});
 const resultKey=(config,seed)=>JSON.stringify(config)+'|'+seed,completed=new Map([...r.baseDiscovery,...r.baseValidation,...r.rows.flatMap(row=>[...(row.discovery||[]),...(row.validation||[])])].map(result=>[resultKey(result.inputGame,result.seed),result]));
 const retryable=e=>e.code==='search_event_budget'||e.code==='cancelled';
 async function trial(config,seed,row,phase){
  const target=row==='base'?r:r.rows.find(x=>x.id===row),key=row==='base'?(phase==='discovery'?'baseDiscovery':'baseValidation'):phase;
  if(target[key].some(x=>x.seed===seed))return true;
  if(target.errors.some(e=>e.seed===seed&&(!e.phase||e.phase===phase)&&!retryable(e)))return true;
  if(!within())return false;
  const retry=target.errors.filter(e=>e.seed===seed&&(!e.phase||e.phase===phase)&&retryable(e));if(retry.length){target.pastErrors=(target.pastErrors||[]).concat(retry);target.errors=target.errors.filter(e=>!retry.includes(e));emit({kind:'row',row:{id:row,errors:target.errors,pastErrors:target.pastErrors}});}
  const cached=completed.get(resultKey(config,seed));if(cached){const result=copy(cached);target[key].push(result);target[key].sort((a,b)=>seeds[phase].indexOf(a.seed)-seeds[phase].indexOf(b.seed));r.reusedSamples=(r.reusedSamples||0)+1;emit({kind:'run',row,phase,seed,result,cached:true});state();return true;}
  r.runs++;r.active={row,phase,seed};emit({kind:'active',row,phase,seed,runs:r.runs});
  try{const result=await run(config,seed,opts.maxEvents-(r.events-initialEvents));if(!C.verifyLedger(result))throw Error('资源收支校验失败');if(!C.diagnose(result).exactTimeAccounted)throw Error('时间记录校验失败');r.events+=result.events.length;completed.set(resultKey(config,seed),result);target[key].push(result);target[key].sort((a,b)=>seeds[phase].indexOf(a.seed)-seeds[phase].indexOf(b.seed));emit({kind:'run',row,phase,seed,result});}
  catch(e){r.events+=e.eventsUsed||0;if(e.code==='search_event_budget')stopped='event_budget';const error={seed,phase,message:e.message,code:e.code,eventsUsed:e.eventsUsed};target.errors.push(error);emit({kind:'run',row,phase,seed,error});}
  r.active=null;state();return true;
 }
 const end=status=>{finish(r,status);r.elapsedMs=previousElapsed+Date.now()-started;Object.assign(session,{status:r.status,runs:r.runs-initialRuns,events:r.events-initialEvents,elapsedMs:Date.now()-started});state();return r;};
 for(const phase of ['discovery','validation'])for(const seed of seeds[phase])if(!await trial(g,seed,'base',phase))return end(stopped);
 if(stopped)return end(stopped);if(r.errors.length){r.reason='基准有计算中断';return end('baseline_error');}
 if(known(g)&&[...r.baseDiscovery,...r.baseValidation].every(met)){r.reason='当前方案符合目标，建议保持';return end('already_meets');}
 if(g.goals.minCompletionSeconds!==null&&n(g.goals.minCompletionSeconds)>n(g.simulation.observationSeconds)){r.reason='观察截止早于目标最早完成时间';return end('insufficient_observation');}
 const p=plan(g,r.baseDiscovery);r.issue={cause:p.cause,stage:p.stage,summary:p.summary};
 if(!known(g)&&p.cause==='normal'&&[...r.baseDiscovery,...r.baseValidation].every(x=>x.status==='completed')){r.reason='当前全部通过，未设置其他目标';return end('no_fault');}
 r.knobs=configuredKnobs(g,r.baseDiscovery,opts,p);r.phase='搜索修改量';state();
 const conflict=scheduleConflict(g);if(conflict&&!r.knobs.some(k=>k.id==='visits'&&!k.locked&&k.max>k.current)){r.conflict=conflict;r.reason='回访空档至少'+Math.floor(conflict.gap/60)+'分钟，目标最长'+Math.floor(conflict.allowed/60)+'分钟';return end('conflict');}
 const enabled=r.knobs.filter(k=>!k.locked&&(!k.secondary||opts.maxJoint===3)),queue=[],queued=new Set(),sig=path=>path.map(p=>p.id+':'+p.value).sort().join('|');
 const reserve=Math.min(Math.max(0,Math.floor((opts.maxRuns-(r.runs-initialRuns)-seeds.discovery.length)*.65)),seeds.validation.length*opts.keepCount),searchLimit=Math.max(r.runs,initialRuns+opts.maxRuns-reserve),canSearch=()=>within()&&(r.runs<searchLimit||!r.rows.some(x=>x.grade&&useful(x.grade)));
 r.validationReserve=reserve;
 function enqueue(path){
  path=path.map(p=>{const k=r.knobs.find(k=>k.id===p.id);let value=Math.min(k.max,Math.max(k.min,number(p.value)));if(k.integer)value=Math.round(value);return {id:p.id,value};}).filter(p=>Math.abs(p.value-r.knobs.find(k=>k.id===p.id).current)>Math.max(1e-12,Math.abs(p.value)*1e-10));
  if(!path.length||path.length>opts.maxJoint||new Set(path.map(p=>p.id)).size!==path.length)return;
  const templates=path.map(p=>r.knobs.find(k=>k.id===p.id).template).filter(Boolean);if(new Set(templates.map(t=>t.target+':'+(t.upgrade||''))).size!==templates.length)return;
  const key=sig(path),old=r.rows.find(x=>sig(x.path)===key);if(queued.has(key)||old&&(old.discovery.length===seeds.discovery.length||old.errors.some(e=>!retryable(e))))return;queued.add(key);queue.push(path);
 }
 const midpoint=(a,b)=>a>0&&b>0?Math.sqrt(a*b):(a+b)/2;
 async function candidate(path){
  if(!within())return null;let row=r.rows.find(x=>sig(x.path)===sig(path));
  if(!row){if(r.rows.length>=1000){stopped='candidate_budget';return null;}row={id:'s'+(r.rows.length+1),path:copy(path),distance:pathDistance(path,r.knobs),discovery:[],validation:[],errors:[],state:'searching',verified:false};r.rows.push(row);try{row.game=apply(g,r.knobs,path);const signature=JSON.stringify(row.game),duplicate=r.rows.find(x=>x!==row&&x.game&&JSON.stringify(x.game)===signature);if(duplicate||signature===JSON.stringify(g)){r.rows.pop();r.duplicateConfigurations=(r.duplicateConfigurations||0)+1;return duplicate||null;}}catch(e){row.errors.push({message:e.message});row.state='invalid';emit({kind:'row',row});return row;}emit({kind:'row',row:{...row,discovery:[],validation:[],errors:[]}});}
  for(const seed of seeds.discovery)if(!await trial(row.game,seed,row.id,'discovery')){row.state='partial';return row;}
  if(row.errors.length){row.state='error';emit({kind:'row',row:{id:row.id,state:row.state}});return row;}row.grade=evaluate(r.baseDiscovery,row.discovery,g);row.state='searched';emit({kind:'row',row:{id:row.id,state:row.state,grade:row.grade}});return row;
 }
 async function drain(){while(queue.length&&canSearch())await candidate(queue.shift());queue.length=0;}
 // 已完成的配置/编号保持原结果；只补齐中断候选缺少的编号。
 for(const row of r.rows.filter(x=>x.game&&x.discovery.length<seeds.discovery.length&&!x.errors.some(e=>!retryable(e))))enqueue(row.path);
 for(let i=0;i<2;i++)for(const k of enabled){const target=Math.max(k.min,Math.min(k.max,k.target));enqueue([{id:k.id,value:i||k.template?target:midpoint(k.current,target)}]);}
 await drain();
 async function joint(limit){
  const singles=r.rows.filter(x=>x.path.length===1&&x.grade&&!x.errors.length).sort((a,b)=>Number(b.grade.allMet)-Number(a.grade.allMet)||b.grade.after.completed-a.grade.after.completed||a.grade.after.deaths-b.grade.after.deaths||a.grade.after.enemyLeft-b.grade.after.enemyLeft||rank(a,b)),picks=[];
  for(const row of singles){const id=row.path[0].id;if(!picks.some(x=>x.id===id))picks.push(row.path[0]);}
  for(const k of r.knobs.filter(k=>!k.locked))if(!picks.some(x=>x.id===k.id))picks.push({id:k.id,value:Math.max(k.min,Math.min(k.max,k.target))});
  const top=picks.slice(0,10),add=(size,start,path)=>{if(path.length===size){enqueue(path);return;}for(let i=start;i<top.length;i++)add(size,i+1,[...path,top[i]]);};
  if(limit===3)add(3,0,[]);if(limit>=2)add(2,0,[]);await drain();
 }
 if(opts.maxJoint===3&&canSearch())await joint(3);
 for(let round=0;round<r.generationRound&&canSearch();round++)for(const k of enabled.filter(k=>!k.template)){
  const rows=r.rows.filter(x=>x.path.length===1&&x.path[0].id===k.id&&x.grade&&!x.errors.length),passes=grade=>known(g)?grade.allMet:r.baseDiscovery.some(x=>x.status!=='completed')?grade.after.completed===grade.after.samples:grade.effective,best=rows.filter(x=>passes(x.grade)).sort((a,b)=>a.distance-b.distance)[0],points=[{value:k.current,distance:0,grade:evaluate(r.baseDiscovery,r.baseDiscovery,g)},...rows.map(x=>({value:x.path[0].value,distance:x.distance,grade:x.grade}))];let value;
  if(best){const failed=points.filter(x=>x.distance<best.distance&&!passes(x.grade)).sort((a,b)=>b.distance-a.distance)[0]||points[0];value=midpoint(best.path[0].value,failed.value);}
  else{const pairs=[];if(known(g))for(const a of points.filter(x=>x.grade.afterGoals.counts.early))for(const b of points.filter(x=>!x.grade.afterGoals.counts.early))pairs.push({a,b,width:Math.abs(Math.log((a.value+1e-9)/(b.value+1e-9)))});const bracket=pairs.sort((a,b)=>a.width-b.width)[0];if(bracket)value=midpoint(bracket.a.value,bracket.b.value);else{const target=Math.max(k.min,Math.min(k.max,k.target)),factor=Math.pow(1.5,round+1);value=k.direction>0?Math.max(target*factor,k.current*factor,target+factor-1):Math.min(target/factor,k.current/factor);}}
  enqueue([{id:k.id,value}]);await drain();
 }
 if(opts.maxJoint===2&&!r.rows.some(x=>x.grade&&(known(g)?x.grade.allMet:x.grade.after.completed===x.grade.after.samples))&&canSearch())await joint(2);
 r.phase='独立编号核对';state();
 const promising=r.rows.filter(x=>x.grade&&useful(x.grade)&&!x.errors.some(e=>!retryable(e))).sort(rank),families=new Map();for(const row of promising){const key=family(row,r.knobs);if(!families.has(key))families.set(key,[]);families.get(key).push(row);}
 const attempts=Math.max(0,...[...families.values()].map(x=>x.length));
 for(let attempt=0;attempt<attempts&&within();attempt++)for(const rows of families.values()){
  const row=rows[attempt];if(!row||row.verified)continue;row.state='validating';for(const seed of seeds.validation)if(!await trial(row.game,seed,row.id,'validation'))break;row.state=row.validation.length===seeds.validation.length&&!row.errors.length?'checked':'partial';finish(r,'running');emit({kind:'row',row:{id:row.id,state:row.state,verified:row.verified,grade:row.grade}});state();
 }
 finish(r,stopped||'complete');r.reason=r.recommendations.length?(known(g)?r.recommendations.some(id=>r.rows.find(x=>x.id===id).grade.allMet)?'已找到符合目标的方案':'有改善，仍有目标未达到':'已找到本次卡点的有效改法'):r.rows.some(x=>x.errors.length&&x.validation.length)?'候选核对有计算中断':r.rows.some(x=>x.grade&&useful(x.grade)&&!x.verified)?'发现改善，独立核对未完成':known(g)?'本次范围内没有已核对且符合目标的改法':r.baseDiscovery.every(x=>x.status==='completed')?'本轮没有值得替换的已核对方案，建议保持':'本次范围内未找到有效方案';
 return end(stopped||'complete');
}
function validateRecord(r){
 if(!r)return;if(r.format!=='idle-connected-search-v1'||!['connected-search-1.0.0','connected-search-1.1.0','connected-search-1.2.0',VERSION].includes(r.version)||!Array.isArray(r.rows)||r.rows.length>1000||new Set(r.rows.map(x=>x.id)).size!==r.rows.length||!Array.isArray(r.knobs)||r.knobs.length>62||!Array.isArray(r.errors)||!r.options)throw Error('搜索记录格式或版本不匹配');C.compile(r.sourceGame);C.compile(r.game);
 if(JSON.stringify(r.game.goals)!==JSON.stringify(r.sourceGame.goals)||JSON.stringify(r.game.behavior)!==JSON.stringify(r.sourceGame.behavior)||n(r.game.simulation.observationSeconds)!==n(r.sourceGame.simulation.observationSeconds))throw Error('搜索记录的目标、行为或观察时长不一致');
 const maxJoint=r.options.maxJoint??2;if(![1,2,3].includes(maxJoint))throw Error('搜索记录的联合项数无效');
 for(const phase of ['discovery','validation'])if(!Array.isArray(r.seeds?.[phase])||!r.seeds[phase].length||r.seeds[phase].some(s=>!Number.isInteger(s)||s<0||s>4294967295))throw Error('搜索记录缺少有效编号');const seeds=[...r.seeds.discovery,...r.seeds.validation];if(seeds.length>8||new Set(seeds).size!==seeds.length||JSON.stringify(seeds)!==JSON.stringify(r.game.simulation.seeds))throw Error('搜索与核对编号不匹配');
 function runs(rs,game,phase){if(!Array.isArray(rs)||rs.length>r.seeds[phase].length||new Set(rs.map(x=>x.seed)).size!==rs.length)throw Error('搜索样本数量或编号不匹配');for(const x of rs)if(x.format!=='idle-connected-result-v1'||x.version!==game.version||!r.seeds[phase].includes(x.seed)||JSON.stringify(x.inputGame)!==JSON.stringify(game)||!C.verifyLedger(x)||!Array.isArray(x.stages)||!Array.isArray(x.events)||!Array.isArray(x.battles)||!C.diagnose(x).exactTimeAccounted)throw Error('搜索样本配置、编号或收支不匹配');rs.sort((a,b)=>r.seeds[phase].indexOf(a.seed)-r.seeds[phase].indexOf(b.seed));}
 runs(r.baseDiscovery,r.game,'discovery');runs(r.baseValidation,r.game,'validation');const available=r.baseDiscovery.length?configuredKnobs(r.game,r.baseDiscovery,r.options):[];
 for(const k of r.knobs){const actual=available.find(x=>x.id===k.id),locked=actual&&((r.options.locked||[]).includes(k.id)||(r.options.locked||[]).includes(actual.group)||(actual.defaultLocked&&!r.options.allowVisits));if(!actual||!Number.isFinite(k.min)||!Number.isFinite(k.max)||k.min<actual.min||k.max>actual.max||k.min>k.max||!!k.locked!==!!locked)throw Error('搜索参数与基准不匹配');const {min,max}=k;Object.assign(k,actual,{min,max,locked:!!locked});}
 for(const row of r.rows){if(!Array.isArray(row.path)||!row.path.length||row.path.length>maxJoint||new Set(row.path.map(p=>p.id)).size!==row.path.length||!Array.isArray(row.errors))throw Error('候选修改记录不完整');for(const p of row.path){const k=r.knobs.find(k=>k.id===p.id);if(!k||k.locked||!Number.isFinite(p.value)||p.value<k.min||p.value>k.max||k.integer&&!Number.isInteger(p.value))throw Error('候选修改超出允许范围');}let expected;try{expected=apply(r.game,r.knobs,row.path);}catch(e){if(row.game||!row.errors.length)throw e;}if(row.game){if(JSON.stringify(expected)!==JSON.stringify(row.game))throw Error('候选配置与记录的改动不一致');runs(row.discovery,row.game,'discovery');runs(row.validation,row.game,'validation');}else if(row.discovery?.length||row.validation?.length)throw Error('无配置的候选包含战斗结果');}
 finish(r,r.status);return r;
}
module.exports={VERSION,plan,apply,stats,goals,evaluate,rank,finish,reduce,search,protocol,scheduleConflict,validateRecord,templateKnobs,resumeCompatible};
