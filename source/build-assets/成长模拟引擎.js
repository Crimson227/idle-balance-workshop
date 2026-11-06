(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./配置公式.js'):root.ConfigModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.GrowthLab=api;})(globalThis,function(M){
'use strict';
const VERSION='growth-event-2.0.0',DAY=86400,HOUR=3600;
const clone=x=>JSON.parse(JSON.stringify(x));
function prepare(input){
 const c=clone(input);if(c.format==='idle-growth-v2')c.format='idle-design-template-v1';M.validate(c);
 c.behavior={visitsPerDay:c.goals.visits_per_day,sessionMinutes:c.goals.session_minutes,visitHours:c.goals.visits_per_day===3?[0,5,12]:Array.from({length:c.goals.visits_per_day},(_,i)=>24*i/c.goals.visits_per_day),strategy:'balanced',failureAction:'safe',offlineMode:'farm',missedVisits:[],...c.behavior};
 c.simulation={days:28,seeds:[20261029,20261030,20261031],eventLimit:2000000,...c.simulation};c.goals.expected_stages_per_visit??=5;
 const b=c.behavior,s=c.simulation;
 if(!Number.isInteger(b.visitsPerDay)||b.visitsPerDay<1||b.visitsPerDay>24||b.sessionMinutes<=0||b.sessionMinutes>120||!Number.isFinite(b.sessionMinutes))throw Error('回访次数须为1—24，在线时长须为0—120分钟。');
 if(!Array.isArray(b.visitHours)||b.visitHours.length!==b.visitsPerDay||b.visitHours.some((v,i)=>!Number.isFinite(v)||v<0||v>=24||(i&&v<=b.visitHours[i-1])))throw Error('回访偏移须递增、在0—24小时内，且数量等于每天回访次数。');
 if(b.visitHours.some((v,i)=>((b.visitHours[(i+1)%b.visitHours.length]+(i===b.visitHours.length-1?24:0))-v)*60<b.sessionMinutes))throw Error('相邻在线时段不能重叠。');
 if(!['balanced','attack_only','income_first','three_attack_one_income'].includes(b.strategy)||!['safe','retry','farm_one_retry'].includes(b.failureAction)||!['farm','farm_buy','auto'].includes(b.offlineMode))throw Error('行为策略不受支持。');
 if(!Array.isArray(b.missedVisits)||b.missedVisits.some(x=>!Number.isInteger(x)||x<0))throw Error('跳过回访序号须为非负整数，从0计数。');
 if(!(s.days>0&&s.days<=90)||!Number.isFinite(s.days)||!Array.isArray(s.seeds)||s.seeds.length<1||s.seeds.length>12||s.seeds.some(x=>!Number.isInteger(x)||x<0||x>4294967295))throw Error('预算须为0—90天，随机种子须为1—12个32位非负整数。');
 if(!Number.isInteger(s.eventLimit)||s.eventLimit<100||s.eventLimit>3000000)throw Error('事件上限须为100—300万。');
 if(c.rules.stage_cap>2000||Math.floor(c.rules.timeout_seconds/c.rules.attack_interval_seconds)>240)throw Error('完整模拟当前支持最多2000关、每场最多240次攻击；请调整关数、间隔或限时。');
 if(!(c.goals.expected_stages_per_visit>0&&c.goals.expected_stages_per_visit<=2000))throw Error('每次回访目标须为1—2000关。');
 c.goals.visits_per_day=b.visitsPerDay;c.goals.session_minutes=b.sessionMinutes;
 c.scope='完整成长事件模拟：单通道伤害、暴击、限时失败、刷取奖励、升级和有上限离线；不包含04多属性规则或留存预测。';
 c.format='idle-growth-v2';return c;
}
function goalKnown(c,key){return !Array.isArray(c.goals.confirmedKeys)||c.goals.confirmedKeys.includes(key);}
function legacy(c){return {...c,format:'idle-design-template-v1'};}
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
function hash(seed,n,k,kind){let x=(seed^Math.imul(n+1,0x9e3779b9)^Math.imul(k+1,0x85ebca6b)^kind)>>>0;x=Math.imul(x^(x>>>16),0x7feb352d);return(x^(x>>>15))>>>0;}
const tails=new Map();
function binomialTail(n,k,p){if(k<=0)return 1;if(k>n)return 0;if(p===0)return 0;if(p===1)return 1;const key=n+':'+p;if(!tails.has(key)){if(tails.size>10000)tails.clear();const a=Array(n+2).fill(0);let comb=0;for(let j=0;j<=n;j++){if(j)comb+=Math.log((n-j+1)/j);a[j]=Math.exp(comb+j*Math.log(p)+(n-j)*Math.log1p(-p));}for(let j=n;j>=0;j--)a[j]=Math.min(1,a[j]+a[j+1]);tails.set(key,a);}return tails.get(key)[k];}
// First-kill CDF: damage never decreases, hence P(T<=k)=P(total damage after k hits>=HP).
function distribution(c,highest,attackLevel,n){
 const p=c.rules,hp=M.stage(c,n).enemy_hp,d=M.damage(c,highest,attackLevel),cap=Math.floor(p.timeout_seconds/p.attack_interval_seconds),out=[];
 let previous=0,mean=0;
 for(let k=1;k<=cap;k++){
  let f;if(p.crit_multiplier===1)f=k*d>=hp*(1-1e-12)?1:0;else {const needed=Math.ceil((hp/d-k)/(p.crit_multiplier-1)-1e-10);f=binomialTail(k,needed,p.crit_chance);}
  f=Math.max(previous,f);const mass=Math.max(0,f-previous);if(mass>1e-13){out.push({seconds:k*p.attack_interval_seconds,success:true,mass});mean+=mass*k*p.attack_interval_seconds;}previous=f;if(f>=1-1e-12)break;
 }
 if(previous<1-1e-12){out.push({seconds:p.timeout_seconds,success:false,mass:1-previous});mean+=(1-previous)*p.timeout_seconds;}
 return {out,probability:previous,mean,damage:d,hp};
}
function draw(dist,u){let acc=0;for(const x of dist.out){acc+=x.mass;if(u<acc)return x;}return dist.out.at(-1);}
function costs(c,a,g){const p=c.rules;return {attack:p.cost_scale*p.attack_cost_base*p.attack_cost_growth**a,income:p.cost_scale*p.income_cost_base*p.income_cost_growth**g};}
function chosen(c,a,g){const p=c.rules,x=costs(c,a,g),s=c.behavior.strategy;if(s==='attack_only')return 'attack';if(s==='three_attack_one_income')return a>=3*(g+1)?'income':'attack';const weight=s==='income_first'?.25:1;return Math.log(p.attack_gain)*weight/x.attack>=Math.log(p.income_gain)/x.income?'attack':'income';}
function quantile(xs,p){if(!xs.length)return null;const a=xs.slice().sort((x,y)=>x-y);return a[Math.max(0,Math.ceil(p*a.length)-1)];}
function summary(run){
 const gaps=[];let prev=0;for(const x of run.clears){gaps.push({from:prev,to:x.time,seconds:x.time-prev,stage:x.stage,censored:false});prev=x.time;}
 if(run.status!=='completed')gaps.push({from:prev,to:run.time,seconds:run.time-prev,stage:run.highest+1,censored:true});
 const waits=gaps.map(x=>x.seconds),worst=gaps.reduce((a,b)=>b.seconds>a.seconds?b:a,{seconds:0,stage:1});
 const phases=[];for(let start=1;start<=run.config.rules.stage_cap;start+=200){const end=Math.min(start+199,run.config.rules.stage_cap),w=run.waves.filter(x=>x.stage>=start&&x.stage<=end),intervals=w.slice(1).map((x,i)=>x.time-w[i].time);phases.push({start,end,waves:w.length,intervalMedian:quantile(intervals,.5),intervalP90:quantile(intervals,.9),pushMedian:quantile(w.map(x=>x.continuousClears),.5)});}
 const c=run.config,visits=run.visits.filter(x=>x.remaining>0),misses=visits.filter(x=>x.newStages<Math.min(c.goals.expected_stages_per_visit,x.remaining));
 return {gaps,longestGap:worst,waitDistribution:[60,600,3600,21600,86400,Infinity].map((upper,i,a)=>({lower:i?a[i-1]:0,upper:Number.isFinite(upper)?upper:null,count:waits.filter(x=>x>(i?a[i-1]:-1)&&x<=upper).length})),phases,completionDays:run.completionTime===null?null:run.completionTime/DAY,incomplete:run.status!=='completed',visitMisses:misses.map(x=>x.index),goal:{completion:!goalKnown(c,'completion')?null:run.completionTime!==null?run.completionTime/DAY>=c.goals.first_completion_min_days&&run.completionTime/DAY<=c.goals.first_completion_max_days:false,wait:!goalKnown(c,'wait')?null:worst.seconds<=c.goals.max_no_progress_hours*HOUR,visits:!goalKnown(c,'visits')?null:misses.length===0},ledgerRelativeError:Math.abs(run.initialCoins+run.earned-run.spent-run.coins)/Math.max(1,run.earned,run.spent)};
}
function* simulateSteps(input,seed){
 const c=prepare(input),p=c.rules,b=c.behavior,budget=c.simulation.days*DAY;seed=seed??c.simulation.seeds[0];
 const r={version:VERSION,seed,config:c,budget,time:0,status:'budget_exhausted',completionTime:null,highest:0,attackLevel:0,incomeLevel:0,initialCoins:0,coins:0,earned:0,spent:0,events:0,failures:0,farmWins:0,clears:[],purchases:[],waves:[],visits:[],offline:[],stages:Array.from({length:p.stage_cap},(_,i)=>({stage:i+1,arrival:i===0?0:null,passedAt:null,attempts:0,failures:0,combatSeconds:0,farmAttempts:0,farmFailures:0,farmSeconds:0,purchaseCount:0,walletArrival:i===0?0:null,walletClear:null,attackArrival:i===0?0:null,incomeArrival:i===0?0:null,firstBlock:null,lastBlock:null}))};
 let pending=null,mode='pause',retryFarm=false,wave=null,burst=false,visit=null;const cache=new Map(),farmRng=rng(seed^0x72fbc319);
 const snap=()=>({time:r.time,highest:r.highest,attackLevel:r.attackLevel,incomeLevel:r.incomeLevel,coins:r.coins,mode,visit:visit?.index??null});
 const block=()=>{const row=r.stages[r.highest];if(row){const s=snap();row.firstBlock??=s;row.lastBlock=s;}};
 const dist=(n)=>{const key=[r.highest,r.attackLevel,n].join(':');if(!cache.has(key)){if(cache.size>50000)cache.clear();cache.set(key,distribution(c,r.highest,r.attackLevel,n));}return cache.get(key);};
 function buy(){if(mode!=='online'&&!['farm_buy','auto'].includes(b.offlineMode))return;let count=0;for(let k=0;k<2000;k++){const kind=chosen(c,r.attackLevel,r.incomeLevel),price=costs(c,r.attackLevel,r.incomeLevel)[kind];if(!Number.isFinite(price)||price>r.coins)break;if(!count){wave={time:r.time,stage:Math.min(r.highest+1,p.stage_cap),continuousClears:0,purchases:0};r.waves.push(wave);burst=true;}r.coins-=price;r.spent+=price;r[kind==='attack'?'attackLevel':'incomeLevel']++;r.purchases.push({time:r.time,stage:Math.min(r.highest+1,p.stage_cap),kind,cost:price,coins:r.coins,attackLevel:r.attackLevel,incomeLevel:r.incomeLevel,mode});wave.purchases++;if(r.stages[r.highest])r.stages[r.highest].purchaseCount++;count++;}if(count===2000)throw Error('同一结算点升级过多，请检查价格与奖励。');}
 function start(){
  if(r.highest>=p.stage_cap)return false;const next=r.highest+1,d=dist(next);let push=mode==='online'||b.offlineMode==='auto';
  if(push&&r.highest>0){if(b.failureAction==='safe'&&d.probability+1e-12<p.push_success_threshold){push=false;block();}if(b.failureAction==='farm_one_retry'&&retryFarm){push=false;retryFarm=false;}}
  if(!push&&r.highest===0)return false;const n=push?next:r.highest,D=push?d:dist(n),row=r.stages[n-1];
  const u=push?rng(hash(seed,n,row.attempts,0x11))():farmRng(),sample=draw(D,u);
  if(!push)burst=false;pending={kind:'battle',stage:n,push,remaining:sample.seconds,success:sample.success,seconds:sample.seconds,reward:(push?M.stage(c,n).first_reward:M.stage(c,n).repeat_reward_g0)*p.income_gain**r.incomeLevel};
  if(push)row.attempts++;else row.farmAttempts++;return true;
 }
 function settle(){
  const e=pending;pending=null;if(e.kind==='transition')return;
  const row=r.stages[e.stage-1];r.events++;if(e.push)row.combatSeconds+=e.seconds;else row.farmSeconds+=e.seconds;
  if(e.success){r.coins+=e.reward;r.earned+=e.reward;if(!Number.isFinite(r.coins)||!Number.isFinite(r.earned))throw Error('经济数值超出浮点范围。');if(e.push){r.highest=e.stage;row.passedAt=r.time;row.walletClear=r.coins;row.attackClear=r.attackLevel;row.incomeClear=r.incomeLevel;r.clears.push({time:r.time,stage:e.stage});if(burst&&wave)wave.continuousClears++;if(r.stages[r.highest])Object.assign(r.stages[r.highest],{arrival:r.time,walletArrival:r.coins,attackArrival:r.attackLevel,incomeArrival:r.incomeLevel});if(r.highest===p.stage_cap){r.status='completed';r.completionTime=r.time;}}else r.farmWins++;}
  else{r.failures++;if(e.push){row.failures++;retryFarm=true;burst=false;block();}else row.farmFailures++;}
  if(r.status!=='completed'){buy();pending={kind:'transition',remaining:p.transition_seconds};}
 }
 function* segment(end,newMode){mode=newMode;if(mode==='pause'){r.time=end;return;}if(mode==='online')buy();while(r.time<end-1e-9&&r.status!=='completed'){
  if(r.events>=c.simulation.eventLimit){r.status='event_limit';return;}if(!pending&&!start()){r.time=end;return;}const dt=Math.min(pending.remaining,end-r.time);r.time+=dt;pending.remaining-=dt;if(pending.remaining<=1e-8)settle();if(r.events&&r.events%2000===0)yield {time:r.time,highest:r.highest,events:r.events};
 }}
 const slots=[];for(let day=0;day<c.simulation.days+1;day++)for(let j=0;j<b.visitHours.length;j++){const start=(day*24+b.visitHours[j])*HOUR,index=day*b.visitsPerDay+j;if(start<budget&&!b.missedVisits.includes(index))slots.push({start,end:Math.min(budget,start+b.sessionMinutes*60),index});}
 let offlineStart=0;
 for(const slot of slots){
  if(r.time<slot.start){const begin=r.time,earned=r.earned,spent=r.spent,high=r.highest,activeEnd=Math.min(slot.start,offlineStart+p.offline_cap_hours*HOUR);if(r.time<activeEnd)yield*segment(activeEnd,'offline');if(r.status!=='completed'&&r.status!=='event_limit'&&r.time<slot.start)yield*segment(slot.start,'pause');r.offline.push({from:begin,to:r.time,activeSeconds:Math.max(0,Math.min(r.time,activeEnd)-begin),cappedSeconds:Math.max(0,r.time-Math.max(begin,activeEnd)),earned:r.earned-earned,spent:r.spent-spent,newStages:r.highest-high});if(r.status==='completed'||r.status==='event_limit')break;}
  visit={index:slot.index,start:slot.start,end:slot.end,remaining:p.stage_cap-r.highest,highestBefore:r.highest,purchasesBefore:r.purchases.length,failuresBefore:r.failures};const wallet=r.coins;yield*segment(slot.end,'online');Object.assign(visit,{end:r.time,newStages:r.highest-visit.highestBefore,purchases:r.purchases.length-visit.purchasesBefore,failures:r.failures-visit.failuresBefore,walletBefore:wallet,walletAfter:r.coins});r.visits.push(visit);visit=null;offlineStart=r.time;yield {time:r.time,highest:r.highest,events:r.events};if(r.status==='completed'||r.status==='event_limit')break;
 }
 if(r.status!=='completed'&&r.status!=='event_limit'&&r.time<budget){const begin=r.time,earned=r.earned,spent=r.spent,high=r.highest,end=Math.min(budget,offlineStart+p.offline_cap_hours*HOUR);if(r.time<end)yield*segment(end,'offline');if(r.status!=='completed'&&r.status!=='event_limit'&&r.time<budget)yield*segment(budget,'pause');r.offline.push({from:begin,to:r.time,activeSeconds:Math.max(0,Math.min(r.time,end)-begin),cappedSeconds:Math.max(0,r.time-end),earned:r.earned-earned,spent:r.spent-spent,newStages:r.highest-high});}
 r.pending=clone(pending);r.checkpoint=snap();if(r.highest<p.stage_cap){r.stages[r.highest].lastBlock=r.checkpoint;r.stages[r.highest].firstBlock??=r.checkpoint;}
 for(const row of r.stages)row.noProgressSeconds=row.arrival===null?null:(row.passedAt??r.time)-row.arrival;
 r.metrics=summary(r);if(r.metrics.ledgerRelativeError>1e-10||r.coins<0)throw Error('资源守恒检查未通过。');return r;
}
function simulate(c,seed){const it=simulateSteps(c,seed);let x;do{x=it.next();}while(!x.done);return x.value;}
function requirement(c,hp){const p=c.rules,k=Math.floor(p.timeout_seconds/p.attack_interval_seconds);if(p.push_success_threshold===0)return 0;if(k===0)return Infinity;let j=0;for(let q=1;q<=k;q++){if(binomialTail(k,q,p.crit_chance)+1e-12>=p.push_success_threshold)j=q;else break;}return hp/(k+(p.crit_multiplier-1)*j);}
function diagnose(run,n){
 const c=run.config,row=run.stages[n-1];if(!row||row.arrival===null)return {stage:n,unreached:true,evidence:['预算内尚未到达，不能提供该关真实历史卡点。']};
 const s=row.firstBlock??{time:row.arrival,highest:n-1,attackLevel:row.attackArrival,incomeLevel:row.incomeArrival,coins:row.walletArrival,mode:'arrival'},p=c.rules,d=distribution(c,s.highest,s.attackLevel,n),req=requirement(c,d.hp),price=costs(c,s.attackLevel,s.incomeLevel),policy=chosen(c,s.attackLevel,s.incomeLevel),after=distribution(c,s.highest,s.attackLevel+1,n);
 const levels=d.damage+1e-10>=req?0:p.attack_gain>1?Math.max(1,Math.ceil(Math.log(req/d.damage)/Math.log(p.attack_gain)-1e-10)):null;
 let total=levels===null?null:0;if(levels!==null){if(levels>2000)total=null;else for(let i=0;i<levels;i++)total+=costs(c,s.attackLevel+i,s.incomeLevel).attack;}
 let rate=0;if(s.highest>0){const f=distribution(c,s.highest,s.attackLevel,s.highest);rate=f.probability*M.stage(c,s.highest).repeat_reward_g0*p.income_gain**s.incomeLevel/(f.mean+p.transition_seconds);}
 let push=0;for(let k=n;k<=Math.min(p.stage_cap,n+199);k++){if(distribution(c,k-1,s.attackLevel+1,k).probability+1e-12<p.push_success_threshold)break;push++;}
 const gap=Math.max(0,price.attack-s.coins),evidence=[];
 if(d.probability+1e-12<p.push_success_threshold)evidence.push(`战斗能力：成功概率${(100*d.probability).toFixed(1)}%，低于准入目标${100*p.push_success_threshold}%；普通单击需提高${Math.max(0,100*(req/d.damage-1)).toFixed(1)}%。`);
 if(gap>0)evidence.push(`资源门槛：下一次攻击升级缺${gap.toPrecision(4)}资源；固定当前刷取能力、持续刷取约${rate? (gap/rate/HOUR).toFixed(2)+'小时':'无法赚取'}。成本和奖励共同决定这个比值，不能仅凭此唯一归因。`);
 if(levels>1)evidence.push(`一次攻击升级仍不足：至少需连续${levels}次攻击升级；这是只买攻击的反事实，不是当前策略承诺。`);
 if(policy==='income')evidence.push('购买顺序：当前策略先攒收益升级，短期不会增加单击伤害。');
 if(c.behavior.failureAction==='retry'&&row.failures)evidence.push(`失败行为：本关已失败${row.failures}次；持续重试可能挤占刷取时间。`);
 if(s.mode!=='online'&&c.behavior.offlineMode==='farm')evidence.push('成长发放时点：该快照处于离线/暂停，默认离线只刷取，上线才能购买与新推关。');
 let earlyPower=null;if(p.family==='chapter'){const alt=clone(c);alt.rules.family='fixed';earlyPower=distribution(alt,s.highest,s.attackLevel,n).probability;if(earlyPower>d.probability+.01)evidence.push(`发放时点反事实：仅将章末成长改为逐关发放，此快照成功率变为${(100*earlyPower).toFixed(1)}%。这不等于全程结果，需重跑对照。`);}
 if(!evidence.length)evidence.push('此快照战斗能力达到准入目标；请结合在线时段、实际随机失败与尚未结算的战斗检查，不能判定唯一经济卡点。');
 return {stage:n,historical:row.passedAt!==null,snapshot:s,damage:d.damage,requiredDamage:req,damageGap:Math.max(0,req-d.damage),probability:d.probability,policy,policyCost:price[policy],attackCost:price.attack,resourceGap:gap,farmRatePerSecond:rate,estimatedActiveWaitSeconds:rate?gap/rate:null,attacksNeeded:levels,totalAttackCost:total,totalAttackGap:total===null?null:Math.max(0,total-s.coins),totalEstimatedActiveWaitSeconds:total!==null&&rate?Math.max(0,total-s.coins)/rate:null,afterOneProbability:after.probability,afterOneCanPass:after.probability+1e-12>=p.push_success_threshold,afterOneContinuousStages:push,forecastCapped:push===200&&n+199<p.stage_cap,earlyPower,evidence};
}
function diffs(a,b){return Object.keys({...a.rules,...b.rules}).filter(k=>a.rules[k]!==b.rules[k]).map(key=>({key,before:a.rules[key],after:b.rules[key]}));}
function compare(runs){return runs.map(({label,results})=>{const done=results.filter(x=>x.completionTime!==null),times=done.map(x=>x.completionTime/DAY);return {label,samples:results.length,completed:done.length,incompleteFraction:1-done.length/results.length,completionMedianAmongCompleted:quantile(times,.5),maxGapHours:Math.max(...results.map(x=>x.metrics.longestGap.seconds/HOUR)),stageMedian:quantile(results.map(x=>x.highest),.5),purchaseMedian:quantile(results.map(x=>x.purchases.length),.5),goalPasses:results.some(x=>Object.values(x.metrics.goal).some(v=>v===null))?null:results.filter(x=>Object.values(x.metrics.goal).every(Boolean)).length,statuses:results.map(x=>x.status)};});}
function stageCSV(run){const cols=['version','seed','strategy','visitsPerDay','stage','arrival','passedAt','attempts','failures','combatSeconds','farmAttempts','farmFailures','farmSeconds','walletArrival','walletClear','attackArrival','attackClear','incomeArrival','incomeClear','purchaseCount','noProgressSeconds'];return '\uFEFF'+cols.join(',')+'\r\n'+run.stages.map(s=>cols.map(k=>({version:VERSION,seed:run.seed,strategy:run.config.behavior.strategy,visitsPerDay:run.config.behavior.visitsPerDay,...s})[k]??'').join(',')).join('\r\n');}
return {VERSION,DAY,HOUR,prepare,goalKnown,legacy,rng,distribution,draw,requirement,costs,chosen,simulateSteps,simulate,diagnose,diffs,compare,stageCSV,quantile};
});
