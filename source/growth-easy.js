(function(){
 'use strict';
 const tasks={
  easyReturn:{title:'试着多给一点打怪奖励',key:'reward_base',label:'打怪奖励增加多少（%）',trial:10,min:0,max:200,why:'回来有钱，却不一定打得过新关。这次只增加打怪奖励，检查升级和过关是否一起改善。',hint:'先试增加10%。会影响所有关卡的首通和重复奖励，可能让整个游戏结束得更早。',value:(c,v)=>c.rules.reward_base*(1+v/100)},
  easyPrice:{title:'试着让攻击升级涨价慢一点',key:'attack_cost_growth',label:'每升一级，下次涨价多少（%）',min:0,max:200,why:'升级越往后越贵，可能越来越难攒。这次只改涨价速度，第一次升级的价格不变。',hint:'例如原来10.5%，先试10%。这是试算值；更快过关，也可能让原定游玩周期变短。',value:(_,v)=>1+v/100},
  easyBoss:{title:'试着降低Boss的血量',key:'boss_hp_multiplier',label:'Boss血量减少多少（%）',trial:10,min:0,max:99,why:'Boss血量突然升高，可能挡住原本顺畅的推进。这次只降Boss血量，普通怪和奖励不变。',hint:'先试减少10%。Boss可能更容易过，但也可能变得没挑战；这里不会自动判断好不好玩。',value:(c,v)=>c.rules.boss_hp_multiplier*(1-v/100)}
 };
 let task=null,snapshot=null,anchor=null,running=false;
 function message(s,error=false){$('easyError').hidden=!error;$('easyError').textContent=error?s:'';$('easyStatus').textContent=error?'':s;}
 function show(n){$('easyChoose').hidden=n!==0;$('easyEdit').hidden=n!==1;$('easyResult').hidden=n!==2;document.querySelectorAll('.easy-progress li').forEach((e,i)=>{if(i===n)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');});}
 function focus(id){$(id).focus({preventScroll:true});$('easy').scrollIntoView({block:'start'});}
 function source(){const c=read(),name=c.name===RECOMMENDED_PROJECT.candidate.name?'推荐方案':c.name;$('easySource').textContent=`当前使用「${name}」：${c.rules.stage_cap}关，每天上线${c.behavior.visitsPerDay}次、每次${c.behavior.sessionMinutes}分钟。没填自己的游戏时，可以先用这套推荐设置试一次。`;}
 function capture(){return {current:copy(read()),baseline:copy(baseline),groups,executed,feedback:copy(feedback),resultSelection};}
 function restore(){if(!snapshot)return;current=copy(snapshot.current);baseline=copy(snapshot.baseline);feedback=copy(snapshot.feedback);generation++;groups=snapshot.groups;executed=snapshot.executed;resultSelection=snapshot.resultSelection;renderEditor();renderResults();renderFeedback();clearError();snapshot=null;}
 function conditions(){const c=anchor;$('easyBehavior').textContent=`${c.rules.stage_cap}关；每天上线${c.behavior.visitsPerDay}次、每次${c.behavior.sessionMinutes}分钟；${strategyNames[c.behavior.strategy]}。最多模拟${c.simulation.days}天，重复${c.simulation.seeds.length}次。上线安排和购买顺序在完整设置中修改。`;
  for(const [id,key] of [['easyMin','first_completion_min_days'],['easyMax','first_completion_max_days'],['easyWait','max_no_progress_hours'],['easyVisit','expected_stages_per_visit']])$(id).value=c.goals[key];targetSummary();}
 function targetSummary(){ $('easyTargetSummary').textContent=`本次按这些目标判断：${$('easyMin').value}—${$('easyMax').value}天打完，最长${$('easyWait').value}小时没过新关，每次回来至少过${$('easyVisit').value}关。可展开上面一行修改。`; }
 function choose(id){if(busy)return;try{if(snapshot)restore();snapshot=capture();anchor=copy(snapshot.current);task=tasks[id];
  $('easyEditTitle').textContent=task.title;$('easyWhy').textContent=task.why;$('easyFieldLabel').textContent=task.label;$('easyHint').textContent=task.hint;
  const before=task.key==='attack_cost_growth'?f(ruleDisplay(task.key,anchor.rules[task.key]))+'%':f(anchor.rules[task.key])+(task.key==='reward_base'?'资源（第1关基础奖励）':'倍普通怪血量');
  $('easyBefore').textContent='修改前：'+before+'。其他战斗、升级和奖励设置保持不变。';
  $('easyValue').value=task.trial??Math.max(0,Number((ruleDisplay(task.key,anchor.rules[task.key])-.5).toFixed(4)));$('easyValue').min=task.min;$('easyValue').max=task.max;
  conditions();show(1);message('下一步：确认试改值和目标，再点“比较改前和改后”。这时还没有改动你的设置。');focus('easyEditTitle');
 }catch(e){message(e.message,true);}}
 function edited(){const raw=$('easyValue').value,v=Number(raw);if(!raw.trim()||!Number.isFinite(v)||v<task.min||v>task.max)throw Error(`请在“${task.label}”填${task.min}到${task.max}之间的数字。`);
  const a=copy(anchor);for(const [id,key] of [['easyMin','first_completion_min_days'],['easyMax','first_completion_max_days'],['easyWait','max_no_progress_hours'],['easyVisit','expected_stages_per_visit']]){if(!$(id).value.trim())throw Error('比较目标不能留空，请展开目标填写数字。');a.goals[key]=Number($(id).value);}
  if(!(a.goals.first_completion_min_days>0&&a.goals.first_completion_max_days>=a.goals.first_completion_min_days&&a.goals.max_no_progress_hours>0&&a.goals.expected_stages_per_visit>0&&a.goals.expected_stages_per_visit<=2000)){$('easyConditions').open=true;throw Error('请检查比较目标：最早天数要大于0，最晚天数不能更早；可接受等待要大于0，每次回来目标填1到2000关。');}
  const before=G.prepare(a),after=copy(before);after.rules[task.key]=task.value(anchor,v);after.name='试改：'+task.title;
  const prepared=G.prepare(after);if(!G.diffs(before,prepared).length)throw Error('这个值与修改前相同。请改一个值再比较，或返回选另一个问题。');return [before,prepared];
 }
 function lock(v){running=v;$('easyRun').disabled=v;$('easyBack').disabled=v;$('openFull').disabled=v;$('easyCancel').hidden=!v;$('easyValue').disabled=v;for(const id of ['easyMin','easyMax','easyWait','easyVisit'])$(id).disabled=v;$('easyRun').textContent=v?'正在比较，请稍候…':'比较改前和改后';}
 async function run(){if(running)return;let ticker;try{const [a,b]=edited();baseline=a;current=b;invalidate(true);renderEditor();clearError();lock(true);message('正在用同样的上线安排和目标，分别模拟改前与改后。');ticker=setInterval(()=>{$('easyStatus').textContent=$('status').textContent;},200);await execute(false);
  if(!groups.length){message($('error').textContent||'这次没有算完，请重新比较。',true);return;}result();show(2);message('先读结论，再决定保留、撤回，或者继续试。');focus('easyVerdict');
 }catch(e){message(e.message,true);}finally{clearInterval(ticker);lock(false);}}
 function result(){const d=assessComparison(groups),summary=G.compare(groups),[a,b]=groups.map(x=>x.results),n=a.length;
  $('easyVerdict').textContent=d.verdict;$('easyBenefits').textContent='改善了什么：'+(d.benefits.join(' ')||'本次未观察到明确改善。');$('easyCosts').textContent='牺牲了什么：'+(d.costs.join(' ')||'已检查指标未见退步，仍需试玩。');
  const empty=rs=>rs.reduce((total,r)=>total+r.visits.filter(v=>v.remaining>0&&v.newStages===0).length,0),visits=rs=>rs.reduce((total,r)=>total+r.visits.filter(v=>v.remaining>0).length,0);
  $('easyMetrics').innerHTML=[['打完所需时间（已完成者中间值）',...summary.map(s=>s.completionMedianAmongCompleted===null?'还没打完':time(s.completionMedianAmongCompleted*86400))],['最久没过新关',...summary.map(s=>time(s.maxGapHours*3600))],['回来却没过新关的次数',`${empty(a)} / ${visits(a)}次`,`${empty(b)} / ${visits(b)}次`],['全部目标都符合',...summary.map(s=>s.goalPasses+' / '+s.samples+'次')],['在模拟期限内没打完',...summary.map(s=>(s.samples-s.completed)+' / '+s.samples+'次')]].map(row).join('');
  $('easyProblemAnswer').textContent=task===tasks.easyReturn?(empty(a)===0?'原方案这批模拟没有“回来零进展”的回访，不能认定它存在这个问题；请结合每次回访的过关数量和试玩感受再判断。':`原方案共${visits(a)}次有效回访，其中${empty(a)}次没过新关；修改后是${empty(b)}/${visits(b)}次。`):'是否值得保留，按上面确认的目标和实际结果判断；不会因为改动方向看起来合理就自动推荐。';
  const misses=[['completion','打完周期'],['wait','最长等待'],['visits','每次回访进展']].map(([k,label])=>({label,count:b.filter(r=>!r.metrics.goal[k]).length})).filter(x=>x.count);$('easyMisses').textContent=misses.length?'修改后仍没达到的要求：'+misses.map(x=>`${x.label}${x.count}/${b.length}次未达标`).join('；')+'。':'修改后这批模拟全部达到了上面的目标，接下来仍需试玩。';$('easyMisses').dataset.pass=String(!misses.length);
  const worst=a.reduce((x,y)=>x.metrics.longestGap.seconds>=y.metrics.longestGap.seconds?x:y),gap=worst.metrics.longestGap,diag=G.diagnose(worst,gap.stage);
  $('easyEvidence').textContent=`修改前这批模拟中，最久没过新关的一段发生在第${gap.stage}关前，持续${time(gap.seconds)}。`+(diag.unreached?'尚未到达，不能给出该关的真实伤害快照。':`按当时情况，普通一下伤害${f(diag.damage)}，达到挑战要求约需${f(diag.requiredDamage)}；下一次攻击升级价格${f(diag.attackCost)}，还差${f(diag.resourceGap)}资源。升一次${diag.afterOneCanPass?'达到':'仍未达到'}当前关挑战要求。`);
  const evidence=[];if(!diag.unreached){evidence.push(diag.probability+1e-12>=worst.config.rules.push_success_threshold?'当时伤害已经达到挑战要求，不能把这段等待直接归因于伤害不够或升级太贵。':'当时打赢的机会还没达到挑战要求，需要结合升级、奖励和购买顺序检查。');if(diag.resourceGap>0)evidence.push(`如果继续买一次攻击升级，还差${f(diag.resourceGap)}资源；按当时速度不停刷旧关，约需${time(diag.estimatedActiveWaitSeconds)}。这不是实际多久后一定买到的承诺。`);if(diag.snapshot.mode!=='online'&&worst.config.behavior.offlineMode==='farm')evidence.push('这时玩家不在线，游戏只替玩家刷资源；再次上线才会买升级、开始挑战新关。');if(diag.policy==='income')evidence.push('当时的购买顺序先存钱升级赚钱能力，短期不会增加伤害。');}
  $('easyEvidenceLimit').textContent=diag.unreached?'不能据此唯一判断原因。':evidence.join(' ')+' 以上只说明其中一次当时的情况，不能据此认定唯一原因。';
  $('easyComparisonNote').textContent=`只修改了“${labels[task.key]}”；同一时间预算、上线安排、购买顺序、目标和${n}个重复编号。目标达标不等于玩家喜欢。`;
  const recommended=d.verdict.startsWith('建议保留')?'easyKeep':d.verdict.startsWith('建议撤回')?'easyUndo':'easyAgain';for(const id of ['easyKeep','easyUndo','easyAgain'])$(id).setAttribute('class',id===recommended?'primary':'');$('easyUndo').textContent=recommended==='easyUndo'?'按建议撤回这次改动':'撤回这次改动';$('easyKeep').disabled=false;$('easyKeep').textContent='保留并保存设置';
 }
 function full(keep=false,section='start'){if(running)return;if(!keep)restore();else snapshot=null;$('easy').hidden=true;document.querySelector('.easy-secondary').hidden=true;$('fullReturn').hidden=false;$('advancedWorkbench').open=true;document.body.classList.add('full-mode');if(groups.length)drawCurve();$(section).scrollIntoView({block:'start'});if(section==='start')$('editRecommended').focus({preventScroll:true});}
 for(const id of Object.keys(tasks))$(id).onclick=()=>choose(id);
 $('easyRun').onclick=run;$('easyCancel').onclick=()=>{$('cancel').onclick();message('正在停止；算到一半的结果不会用于比较。');};
 $('easyBack').onclick=()=>{restore();task=null;anchor=null;show(0);source();message('已返回，你进入本次试改前的设置和结果仍在。');focus('easyChooseTitle');};
 $('easyAgain').onclick=()=>{show(1);message('改一个值，再用同样条件比较。');focus('easyEditTitle');};
 $('easyUndo').onclick=()=>{current=copy(baseline);invalidate();renderEditor();snapshot=null;show(0);source();message('已撤回本次参数改动。当前保留修改前的设置和这次确认的目标；未覆盖本机存档。');focus('easyChooseTitle');};
 $('easyKeep').onclick=()=>{snapshot=null;$('save').onclick();if(!$('error').hidden){message($('error').textContent,true);return;}$('easyKeep').disabled=true;$('easyKeep').textContent='设置已保存到这台电脑';message('已保留并保存设置。这次完整模拟过程可在“查看曲线和逐关记录”里的保存区另行导出。');};
 $('easyDetails').onclick=()=>full(true,'results');$('openFull').onclick=()=>full(false);$('returnSimple').onclick=()=>{if(busy)return;if($('guide').dataset.active==='true')$('guideExit').onclick();$('advancedWorkbench').open=false;$('easy').hidden=false;document.querySelector('.easy-secondary').hidden=false;$('fullReturn').hidden=true;document.body.classList.remove('full-mode');snapshot=null;task=null;show(0);source();message('从当前设置开始。选一个问题，继续检查。');focus('easyChooseTitle');};
 for(const id of ['easyMin','easyMax','easyWait','easyVisit'])$(id).oninput=targetSummary;
 $('advancedWorkbench').addEventListener('toggle',()=>{if($('advancedWorkbench').open&&!$('easy').hidden)full(false);});
 source();show(0);if(location.hash.startsWith('#config='))full(true,'adjustments');
})();
