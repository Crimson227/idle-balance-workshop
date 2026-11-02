(function(){
 'use strict';
 const panel=$('guide'),next=$('guideNext'),locate=$('guideLocate'),exit=$('guideExit');
 let active=false,step=0,snapshot=null,practiceResult=null,note='',downloaded=false;
 const original={run:$('run').onclick,edited:$('runEdited').onclick,copy:$('copy').onclick,worst:$('worst').onclick};
 const returnKey='growth-guide-return-v1';
 function remember(project){try{if(typeof sessionStorage!=='undefined')sessionStorage.setItem(returnKey,JSON.stringify(project));}catch{}}
 function forget(){try{if(typeof sessionStorage!=='undefined')sessionStorage.removeItem(returnKey);}catch{}}
 function expected(){try{const c=read(),p=RECOMMENDED_PROJECT.candidate,ds=G.diffs(p,c);return JSON.stringify(baseline.rules)===JSON.stringify(p.rules)&&JSON.stringify(c.behavior)===JSON.stringify(p.behavior)&&JSON.stringify(c.simulation)===JSON.stringify(p.simulation)&&JSON.stringify(c.goals)===JSON.stringify(p.goals)&&ds.length===1&&ds[0].key==='attack_cost_growth'&&ds[0].after===1.1;}catch{return false;}}
 function lockOtherActions(){for(const id of ['editRecommended','freeze','loadCase','loadSmall','loadRecommended','save','restore','file'])$(id).disabled=active||busy;}
 function draw(){
  panel.dataset.active=String(active);
  lockOtherActions();
  const titles=['第一次用？跟着做一次','第1步 / 共6步：只改一个数','第2步 / 共6步：等待真实计算','第3步 / 共6步：读改善和代价','第4步 / 共6步：看看最久卡在哪关','第5步 / 共6步：撤回这个不合适的改动','第6步 / 共6步：保存，然后结束练习'];
  const text=[
   '用一个练习学会修改、比较、撤回和保存。练习会暂存你的当前设置，退出时恢复，不覆盖本机存档。',
   '已保留推荐设置作对照。把“攻击每升1级，下次涨价多少”从10.5改成10，只填数字。其他先不动；这是一次反例练习，不是推荐改法。',
   '正在用相同上线安排比较修改前后。计算结束后才会进入下一步；停止计算可以重试。',
   `${practiceResult?.decision?.verdict||'先读结果'}。读改善和代价，再决定留不留；更快不自动代表更合适。`,
   '已定位这一轮最久卡住的关卡。读三件事：伤害够不够、当时在攒什么、升一次攻击够不够。这是某次模拟的记录，不代表所有玩家。',
   '已经恢复10.5%，修改前的推荐设置没有被覆盖。旧比较结果已清除，这是正常的；想算恢复后的结果，需要再运行。',
   '可以下载恢复后的推荐设置，也可以下载刚才的练习结果。设置文件用来以后重算，完整结果用来复查过程。完成后会回到你练习前的设置。'
  ];
  $('guideTitle').textContent=titles[step];$('guideInstruction').textContent=text[step];$('guideNote').textContent=note;
  next.textContent=['开始新手练习',expected()?'运行这次比较':'先把10.5改成10','正在计算…','我看懂了，找卡点','撤回这次练习修改','继续学习保存',downloaded?'完成练习，回到我的设置':'下载恢复后的推荐设置'][step];
  next.disabled=busy||step===2||(step===1&&!expected());exit.disabled=busy;exit.textContent=active?'退出练习，恢复我的设置':'跳过引导，直接使用';
  locate.hidden=![1,2,3,4,6].includes(step);locate.textContent=step===1?'定位涨价输入框':step===2?'停止这次计算':step===3?'定位比较结果':step===4?'重新定位卡点':'下载刚才的练习结果';
  locate.disabled=busy&&step!==2;
 }
 function begin(){
  if(busy)return;
  try{const project=configProject();snapshot={project:copy(project),groups,executed,resultSelection};remember(project);}catch(e){note='你当前有未填完整的设置。先修正或撤回，再开始练习，避免丢失改动。';draw();return;}
  active=true;step=1;practiceResult=null;downloaded=false;note='练习模式：退出会恢复你进入练习前的设置和已有结果。';loadRecommended();draw();jumpToSetting('rule-attack_cost_growth');
 }
 async function runPractice(){
  if(!active)return original.run();
  if(!expected()){step=1;note='练习只需要把攻击涨价改为10%，其他保持推荐设置。可退出练习后自由修改。';draw();return;}
  step=2;note='';draw();const running=original.run();draw();await running;
  if(!groups.length){step=1;note='这次计算没有完成，可以重试。';draw();return;}
  practiceResult={format:'idle-growth-results-v2',modelVersion:G.VERSION,exportedAt:new Date().toISOString(),project:copy(executed),groups,decision:assessComparison(groups)};
  step=3;note='结论来自刚刚运行的结果，不是预先填好的数据。';draw();$('results').scrollIntoView({block:'start'});
 }
 function rollback(){original.copy();step=5;note='已撤回练习中的10%，恢复为推荐的10.5%。';draw();panel.scrollIntoView({block:'start'});}
 function finish(){
  if(busy)return;
  if(active&&snapshot){installProject(snapshot.project);groups=snapshot.groups;executed=snapshot.executed;resultSelection=snapshot.resultSelection;window.growthAudit=groups.length?{groups,project:executed,version:G.VERSION}:null;renderResults();$('status').textContent='练习已结束，已恢复你进入练习前的设置和已有结果。';}
  forget();active=false;step=0;snapshot=null;practiceResult=null;note='';draw();panel.hidden=true;
 }
 next.onclick=async()=>{
  if(step===0)return begin();if(step===1)return runPractice();
  if(step===3){step=4;draw();original.worst();return;}
  if(step===4)return rollback();
  if(step===5){step=6;note='下载只是保存文件，不会替换你的本机存档。';draw();$('storage').scrollIntoView({block:'start'});return;}
  if(step===6){if(downloaded)return finish();download('新手练习_恢复后的推荐设置.json',configProject());downloaded=true;note='已发起设置文件下载。浏览器可能询问保存位置；请确认文件已保存，再完成练习。';draw();}
 };
 locate.onclick=()=>{if(step===2){$('cancel').onclick();note='正在停止，这次不会留下半套比较。';draw();}else if(step===1)jumpToSetting('rule-attack_cost_growth');else if(step===3)$('results').scrollIntoView({block:'start'});else if(step===4)original.worst();else if(step===6&&practiceResult){download('新手练习_完整结果.json',practiceResult);note='已发起练习结果下载，其中保留了不建议留下的10%改动及撤回依据。';draw();}};
 exit.onclick=finish;
 $('showGuide').onclick=()=>{panel.hidden=false;draw();panel.scrollIntoView({block:'start'});};
 $('run').onclick=()=>active?runPractice():original.run();$('runEdited').onclick=()=>active?runPractice():original.edited();
 $('copy').onclick=()=>{if(active&&step>=3&&step<=4)rollback();else{original.copy();if(active){step=1;draw();}}};
 $('worst').onclick=()=>{original.worst();if(active&&step===3){step=4;draw();}};
 document.addEventListener('input',e=>{if(!active||busy||(!e.target.closest('#ruleGroups,#commonFields')&&e.target.id!=='name'))return;if(step>=3){step=1;note='设置又改了，需要按练习要求重新比较。';}draw();});
 // A refresh during practice must not replace a previously edited project with the practice project.
 try{if(typeof sessionStorage!=='undefined'){const raw=sessionStorage.getItem(returnKey);if(raw){installProject(JSON.parse(raw));forget();note='上次练习中断，已恢复练习前的设置。';}}}catch{note='上次练习的恢复记录未能读取，请使用你保存的设置文件。';}
 draw();
})();
