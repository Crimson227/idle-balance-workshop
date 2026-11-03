// Evidence from existing runs, not a unique-cause classifier or an optimizer.
function checkGrowthProblem(runs,kind){
 const visits=runs.flatMap(run=>run.visits.filter(v=>v.remaining>0).map(visit=>({run,visit}))),empty=visits.filter(x=>x.visit.newStages===0),short=visits.filter(x=>x.visit.newStages<Math.min(x.run.config.goals.expected_stages_per_visit,x.visit.remaining));
 const all=runs.flatMap(run=>run.metrics.gaps.map(gap=>({run,gap}))),boss=all.filter(x=>x.gap.stage%x.run.config.rules.chapter_size===0),pool=kind==='easyBoss'?boss:all;
 let witness=pool.reduce((a,b)=>!a||b.gap.seconds>a.gap.seconds?b:a,null);
 if(kind==='easyReturn'&&empty.length){const x=empty[0],stage=x.visit.highestBefore+1;witness={run:x.run,gap:{stage,seconds:0},visit:x.visit};}
 const config=runs[0].config,diag=witness?G.diagnose(witness.run,witness.gap.stage):null,blocked=diag&&!diag.unreached&&diag.probability+1e-12<config.rules.push_success_threshold,money=blocked&&diag.attacksNeeded!==null&&diag.resourceGap>0&&diag.snapshot.highest>0;
 const longest=Math.max(0,...all.map(x=>x.gap.seconds)),overWait=longest>config.goals.max_no_progress_hours*3600,notFinished=runs.filter(r=>r.status!=='completed').length;
 let found,title,summary;
 if(kind==='easyReturn'){
  found=empty.length>0||short.length>0;title=empty.length?'确实出现了回来没过新关':short.length?'回来有进展，但有些回访没达到目标':'这批模拟没有出现回来没进展';
  summary=empty.length?`共检查${visits.length}次有效回访，有${empty.length}次没过新关。`:`共检查${visits.length}次有效回访，每次都过了新关。`;
  if(short.length)summary+=`其中${short.length}次没达到你设定的每次至少${config.goals.expected_stages_per_visit}关；最后剩余关数不足时按剩余关数算。`;
  if(!visits.length){title='没有有效回访记录，暂时判断不了';summary='在这次模拟期限和上线安排里，没有发生可检查的回访，不能把缺少记录当成进展顺畅。';}
 }else if(kind==='easyBoss'){
  found=!!blocked;title=!boss.length?'还没有Boss记录，暂时判断不了':blocked?'Boss处出现了打不过的门槛':'这批Boss记录没有显示伤害门槛';
  summary=boss.length?`已记录${boss.length}段Boss关前的等待，其中最长${time(witness.gap.seconds)}。`:'模拟还没到Boss，不能把未到达当成容易通过。';
 }else{
  found=!!money;title=money?'确实有需要攒升级资源的记录':'最长等待处，没有证据说明必须先攒攻击升级';
  summary=`整条路线最长${time(longest)}没过新关，${overWait?'超过':'没有超过'}你设定的${f(config.goals.max_no_progress_hours)}小时。`;
 }
 const evidence=[],directions=[];
 if(diag&&!diag.unreached){
  evidence.push(`以第${witness.gap.stage}关第一次卡住或刚到达时的记录为例：普通一下打${f(diag.damage)}，挑战要求约${f(diag.requiredDamage)}。${blocked?'伤害还不够。':'伤害已经够，不能把等待直接归因于升级太贵。'}`);
  if(money){evidence.push(`下一次攻击升级花${f(diag.attackCost)}资源，还差${f(diag.resourceGap)}；${diag.afterOneCanPass?'升一次达到当前关挑战要求。':`升一次仍不够${diag.attacksNeeded!==null?'，按只买攻击估计至少还要升'+diag.attacksNeeded+'次':''}。`}`);directions.push(diag.snapshot.attackLevel===0||config.rules.attack_cost_growth===1?'priceBase':'easyPrice','easyReturn');}
  if(blocked&&kind==='easyBoss'&&config.rules.boss_hp_multiplier>1)directions.unshift('easyBoss');
  if(blocked&&config.rules.family==='chapter'&&diag.earlyPower>diag.probability+.01){directions.unshift('timing');evidence.push('同一时刻，只把章末成长改为逐关给，打赢机会会提高。这只是局部试算，仍需重跑整条路线。');}
  if(diag.snapshot.mode!=='online'&&config.behavior.offlineMode==='farm')evidence.push('这条记录发生在不在线时；当前规则只刷资源，回来后才买升级、开始新关。即使钱或伤害够了，也可能在等下一次上线。');
  if(diag.policy==='income')evidence.push('当时购买顺序先存钱升级赚钱能力，短期不会加伤害。');
  if(blocked&&diag.attacksNeeded===null)evidence.push('当前攻击升级没有足够的伤害增长，仅仅降价或增加奖励不能补上伤害要求；先核对成长规则。');
  if(blocked&&diag.snapshot.highest===0)evidence.push('第1关还没有打赢，没有旧关可刷来赚第一笔资源；提高通关奖励或降价不能替代先打赢第一关。请先核对初始伤害、血量和战斗限时。');
  if(!blocked)directions.length=0;
 }else evidence.push('没有已到达的关卡记录可支持伤害和资源判断，暂不指定改法。');
 if(notFinished)evidence.push(`${runs.length}次模拟中有${notFinished}次没打完，以上只覆盖已经观察到的部分。`);
 const safeToLeave=runs.every(r=>Object.values(r.metrics.goal).every(Boolean));
 const next=safeToLeave?'按你现在的目标，先保留原方案。没必要仅因为有等待就降低价格或增加奖励。':directions.length?'下面是有依据的试改方向，不能唯一确定是成本还是奖励造成；选一个重跑，检查副作用。':'先核对上线、离线和购买规则，或延长观察；当前证据不足，不直接让你加奖励或降价。';
 return {kind,found,title,summary,evidence,directions:[...new Set(directions)],next,safeToLeave,empty:empty.length,visits:visits.length,short:short.length,notFinished,witness,diag,longest};
}
function explainGrowthComparison(groups){
 const [a,b]=G.compare(groups),before=groups[0].results,after=groups[1].results,wait=(a.maxGapHours-b.maxGapHours)*3600;
 if(a.completed<a.samples||b.completed<b.samples)return `修改前有${a.samples-a.completed}次没打完，修改后有${b.samples-b.completed}次没打完。先别只看完成者的快慢，当前还不能定稿。`;
 const days=x=>x<1?time(x*86400).replace(/^约/,''):f(Number(x.toFixed(1)))+'天',early=after.filter(r=>r.metrics.completionDays<r.config.goals.first_completion_min_days).length,late=after.filter(r=>r.metrics.completionDays>r.config.goals.first_completion_max_days).length;
 let text=wait>0?(wait<60&&wait/Math.max(1,a.maxGapHours*3600)<.05?`最长等待几乎没变，只少了${time(wait)}。`:`最长等待少了${time(wait)}。`):wait<0?`最长等待反而多了${time(-wait)}。`:'最长等待没变。';
 text+=`打完所需时间从约${days(a.completionMedianAmongCompleted)}变为约${days(b.completionMedianAmongCompleted)}。`;
 if(early)text+=`${early===after.length?'修改后每次都':`其中${early}次`}早于你设定的至少${after[0].config.goals.first_completion_min_days}天；更快在这里是代价。`;
 if(late)text+=`${late}次超过你设定的最晚${after[0].config.goals.first_completion_max_days}天。`;
 if(!early&&!late)text+=before.every(r=>r.metrics.completionDays>=r.config.goals.first_completion_min_days&&r.metrics.completionDays<=r.config.goals.first_completion_max_days)?'两份方案的完成周期都达标。':'修改后每次完成都在周期目标内；修改前有不在范围内的情况。';
 return text;
}
