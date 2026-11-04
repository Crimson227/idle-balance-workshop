const ConnectedRules=(()=>{
 const C=ConnectedCore,R=C.rules,q=R.q,by=id=>document.getElementById(id),copy=structuredClone,esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const fmt=x=>{try{return new Intl.NumberFormat('zh-CN',{maximumFractionDigits:4}).format(C.number(String(x)));}catch{return '待填写';}},pct=x=>{try{return fmt(C.scaled(x,'100'));}catch{return '待填写';}},pathId=p=>'cgRule-'+p.replaceAll('.','-'),kinds={states:'状态',reactions:'反应',triggers:'条件效果'};
 let pending=null,focusAfter=null;
 const options=(items,value)=>Object.entries(items).map(([v,l])=>'<option value="'+esc(v)+'"'+(String(value)===v?' selected':'')+'>'+esc(l)+'</option>').join('');
 const get=(root,p)=>p.split('.').reduce((v,k)=>v?.[k],root);
 function set(root,p,value){const ks=p.split('.');let v=root;for(const k of ks.slice(0,-1))v=v[k]??={};v[ks.at(-1)]=value;}
 function view(g){const r=copy(g.ruleLibrary||R.initial(g));r.rounding={mode:'none',target:'both',at:'hit',...r.rounding};for(const u of g.upgrades)r.growth.upgrades[u.id]??={attribute:{id:'linear'},cost:{id:'linear'},unlock:{stage:1,upgrade:'',level:0}};return r;}
 function ensure(g){if(!g.ruleLibrary)g.ruleLibrary=R.initial(g);g.ruleLibrary.enabled=true;for(const u of g.upgrades)g.ruleLibrary.growth.upgrades[u.id]??={attribute:{id:'linear'},cost:{id:'linear'},unlock:{stage:1,upgrade:'',level:0}};return g.ruleLibrary;}
 function begin(g,target){if(g.ruleLibrary?.enabled===false)return;if(target?.dataset.rule?.startsWith('rounding.'))ensure(g).rounding??={mode:'none',target:'both',at:'hit'};if(target?.dataset.rule||target?.dataset.ruleList||['cgRuleDefense','cgRuleK','cgRuleArmorName'].includes(target?.id))ensure(g);}
 function field(r,p,label,items=null,type='number'){
  const id=pathId(p),raw=get(r,p);let value=raw??'';
  if(type==='percent'&&value!=='')try{value=C.scaled(String(value),'100');}catch{}
  if(type==='growthPercent'&&value!=='')try{value=C.scaled(C.offset(String(value),'1'),'100');}catch{}
  let control;if(items)control='<select id="'+id+'" data-rule="'+p+'">'+options(items,raw===undefined&&p.endsWith('.owner')?'both':raw)+'</select>';
  else if(type==='check'){const yes=p.endsWith('.enabled')?raw!==false:!!raw;control='<input type="checkbox" id="'+id+'" data-rule="'+p+'" data-previous="'+yes+'"'+(yes?' checked':'')+'>';}
  else if(type==='json')control='<textarea id="'+id+'" data-rule="'+p+'" data-json="true" rows="4">'+esc(value===''?'':JSON.stringify(value,null,2))+'</textarea>';
  else control='<input id="'+id+'" data-rule="'+p+'"'+(type==='text'?' maxlength="24"':type==='formula'?'':' inputmode="decimal"')+(type==='percent'?' data-percent="true"':type==='growthPercent'?' data-growth-percent="true"':'')+' value="'+esc(value)+'">';
  return '<label'+(type==='check'?' class="cg-switch"':'')+'>'+esc(label)+control+'<small id="cg-error-'+id+'" class="cg-field-error" role="alert" hidden></small></label>';
 }
 const select=(r,p,n,items)=>field(r,p,n,items),check=(r,p,n)=>field(r,p,n,null,'check'),group=body=>'<div class="fields">'+body+'</div>';
 const details=(title,body,key='',open=false)=>'<details'+(key?' data-panel="'+esc(key)+'" id="'+esc(key)+'"':'')+(open?' open':'')+'><summary>'+title+'</summary>'+body+'</details>';
 const empty=s=>s===null||s===undefined||s==='',positive=s=>{try{return q(s).cmp(q(0))>0;}catch{return false;}};
 function name(g,k,fallback){return R.config(g)?.labels?.[k]||fallback;}
 function percent(g,k){return k==='armor'&&R.config(g)&&R.defense(g)==='ratio';}
 const label=(g,kind,id)=>R.label(g,kind,id);
 function textField(id,title,value){return '<label>'+esc(title)+'<input id="'+id+'" inputmode="decimal" value="'+esc(value??'')+'"><small id="cg-error-'+id+'" class="cg-field-error" role="alert" hidden></small></label>';}
 function attack(g){const r=view(g);return '<div class="cg-inline-rule">'+group(select(r,'damage.id','普通攻击的物理伤害',{range:'在最小和最大值之间取数',fixed:'固定使用最小物理伤害',scaled:'用某项属性乘倍率',expression:'使用高级伤害公式'})+field(r,'damage.segments','双方每次攻击打几段')+(r.damage.id==='scaled'?select(r,'damage.attribute','使用哪项属性',Object.fromEntries(C.multi.FIELDS.filter(([k])=>['hp','physicalMin','physicalMax','fire','ice','lightning','poison'].includes(k)).map(([k,n])=>[k,n])))+field(r,'damage.coefficient','乘几倍'):''))+(r.damage.id==='expression'?'<button type="button" data-rule-open="cgRuleDamageFormula">编辑伤害公式</button>':'')+'<p class="cg-rule-note">双方使用同一种算法，各取自己的属性；每段完整计算。</p>'+rounding(g)+'</div>';}
 function rounding(g){const r=view(g),s=r.rounding;return details('减伤后的伤害要取整吗',group(select(r,'rounding.mode','伤害取整方式',{none:'保留精确小数（原默认）',ceil:'向上取整',floor:'向下取整',nearest:'四舍五入'})+(s.mode!=='none'?select(r,'rounding.target','谁受伤时取整',{player:'角色',enemy:'敌人',both:'双方'})+select(r,'rounding.at','在哪一层取整',{hit:'每段的伤害合计，减伤后、护盾前',channel:'每段的各类伤害，减伤后分别取整'}) :''))+(s.mode!=='none'?'<p class="cg-rule-note">暴击、防御、抗性、格挡后取整，再扣护盾和生命；吸血只按实际扣血。合计取整时，通道账目按原伤害比例分摊。例：2.55向上取整为3。</p>':''),'cgRounding',s.mode!=='none');}
 function defense(g){const r=view(g);return '<div class="cg-inline-rule">'+group('<label>双方的防御怎么算<select id="cgRuleDefense" data-previous="'+r.defense.id+'">'+options(R.DEFENSE,r.defense.id)+'</select></label>')+'<output id="cgRulePreview" aria-live="polite"></output></div>';}
 function critical(g){const r=view(g);return '<div class="cg-inline-rule">'+group(select(r,'critical.mode','双方什么时候暴击',{probability:'按暴击率判断',low_hp:'按暴击率判断，低生命时必定暴击'})+(r.critical.mode==='low_hp'?field(r,'critical.threshold','生命不高于多少%时必暴击',null,'percent'):'')+field(r,'critical.guarantee','双方连续几次没暴击后，下次必暴（0关闭）'))+'</div>';}
 function recovery(g){const r=view(g);return details('护盾与额外回复',group(field(r,'shield.player','角色开场护盾（点，0为无）')+field(r,'shield.enemy','敌人开场护盾（点，0为无）')+field(r,'recovery.fraction','双方每次回复最大生命的%（0关闭）',null,'percent')+(positive(r.recovery.fraction)?field(r,'recovery.interval','每隔几秒回复一次'):'')),'cgRuleRecovery',positive(r.shield.player)||positive(r.shield.enemy)||positive(r.recovery.fraction));}
 function leech(g){const r=view(g);return details('哪些伤害可以吸血','<div class="cg-rule-checks">'+Object.entries(C.multi.NAMES).map(([id,n])=>'<label><input type="checkbox" data-rule-list="recovery.leechChannels" value="'+id+'"'+(r.recovery.leechChannels?.includes(id)?' checked':'')+'>'+esc(n)+'</label>').join('')+'</div>','cgRuleLeech');}
 function growth(g,p,title){const r=view(g),s=get(r,p);return select(r,p+'.id',title,R.GROWTH)+(s.id==='geometric'?field(r,p+'.factor','每次增加多少%（0为不变）',null,'growthPercent'):['piecewise','expression'].includes(s.id)?'<button type="button" data-rule-open="'+pathId(p)+'-advanced">编辑'+(s.id==='piecewise'?'分段':'公式')+'</button>':'');}
 function upgrade(g,u,values={}){const r=view(g),p='growth.upgrades.'+u.id,s=r.growth.upgrades[u.id];return '<div class="cg-upgrade-rules"><div class="cg-upgrade-columns"><div class="cg-upgrade-group"><h4>属性提升</h4>'+group(growth(g,p+'.attribute','每级属性怎么变')+(values.attribute||''))+'</div><div class="cg-upgrade-group"><h4>升级费用</h4>'+group(growth(g,p+'.cost','每级价格怎么变')+(values.cost||''))+'</div></div><output data-upgrade-preview="'+esc(u.id)+'" aria-live="polite"></output>'+details('解锁条件',group(field(r,p+'.unlock.stage','从第几关开始可以买')+select(r,p+'.unlock.upgrade','需要先买哪项升级',{'':'没有前置要求',...Object.fromEntries(g.upgrades.filter(x=>x.id!==u.id).map(x=>[x.id,x.name||x.id]))})+(s.unlock.upgrade?field(r,p+'.unlock.level','前置升级至少几级'):'')),'cgRuleUnlock-'+u.id)+'</div>';}

 function payout(g){const p=g.economy.payout||{mode:'continuous',intervalSeconds:'1',firstAtSeconds:'1'};return '<div class="cg-inline-rule">'+group('<label>固定收入什么时候到账<select id="cgPayoutMode">'+options({continuous:'连续增加（原默认）',interval:'每隔一段时间发一批'},p.mode)+'</select></label>'+(p.mode==='interval'?textField('cgPayoutInterval','每隔几秒到账',p.intervalSeconds)+textField('cgPayoutFirst','首笔在开始后第几秒到账',p.firstAtSeconds):''))+(p.mode==='interval'?'<p class="cg-rule-note">每批＝每秒收入×间隔。所有战斗和回访共用开始时的节拍；同刻先到账，再购买。离线封顶后不补发错过的批次。</p>':'')+'</div>';}
 function economy(g){return details('金币从哪里来',group(growth(g,'growth.reward','关卡奖励怎么增长')+textField('cg-rewardBase','第一关首通奖励',g.world.rewardBase)+textField('cg-rewardStep','后面每关多给多少金币',g.world.rewardStep)+textField('cg-initialCoins','初始金币',g.economy.initialCoins)+textField('cg-income','固定每秒金币收入',g.economy.incomePerSecond)+'<label>打怪期间也收固定收入吗<select id="cg-combatIncome">'+options({true:'是',false:'否'},String(g.economy.incomeDuringCombat))+'</select></label>')+payout(g)+'<output id="cgRuleGrowthPreview" aria-live="polite"></output>','cgEconomy');}
 function behavior(g){const r=view(g);return details('自动购买与离线动作',group(check(r,'behavior.autoPurchase','自动购买升级')+check(r,'behavior.awaitFirstPurchase','首次挑战前，先攒够并购买一次升级')+select(r,'behavior.strategy','先买什么',{order:'按填写顺序循环买',cheapest:'先买当前最便宜的',damage_first:'伤害升级优先',survival_first:'生命升级优先'})+check(r,'behavior.offlineIncome','离线收固定金币（受时长上限限制）')+check(r,'behavior.offlinePurchase','离线时也自动买升级')+check(r,'behavior.offlineBattle','离线时也挑战新关')),'cgRuleBehavior');}
 const owner={player:'角色',enemy:'敌人',both:'双方'},target={target:'对手',self:'自己'},source={direct:'普通攻击',dot:'持续伤害',any:'所有伤害'};
 function stateSummary(g,s){const who=owner[s.owner||'both'],to=s.target==='self'?'自己':s.owner==='player'?'敌人':s.owner==='enemy'?'角色':'各自的对手',when=s.applyAt==='start'?'开战时':'造成'+source[s.source||'direct']+'扣血后';return who+when+'给'+to+'施加'+label(g,'states',s.id)+'，持续'+fmt(s.duration)+'秒'+(s.effect==='dot'?'，每'+fmt(s.interval)+'秒造成'+fmt(s.amount)+'点'+(C.multi.NAMES[s.channel]||'')+'伤害':s.effect==='freeze'?'，期间不能行动':'，只附着标记')+'。';}
 function reactionSummary(g,x){return ((x.states||[]).filter(Boolean).length===2?x.states.map(id=>label(g,'states',id)).join('＋'):'选好两个状态')+'相遇时，'+({damage:'对附着方造成'+fmt(x.amount)+'点'+(C.multi.NAMES[x.channel]||'')+'伤害',shield:'给附着方'+fmt(x.amount)+'点护盾',freeze:'让附着方'+fmt(x.duration)+'秒不能行动'}[x.effect]||'')+'；'+(x.consume?.length?'所选状态各消耗1层':'请选择至少一个要消耗的状态')+'。';}
 function triggerSummary(g,t){return (owner[t.owner||'both']||'')+({battle_start:'开战时',before_attack:'攻击前',after_hit:'造成'+source[t.source||'direct']+'扣血后'}[t.at]||'')+(t.condition==='hp_below'?'，生命不高于'+pct(t.threshold)+'%时':t.condition==='every_n'?'，每第'+fmt(t.every)+'次攻击时':'')+'，'+({attack_multiplier:'伤害乘'+fmt(t.value)+'倍，持续'+fmt(t.duration)+'秒',shield:'增加'+fmt(t.value)+'点自身护盾',heal:'回复'+fmt(t.value)+'点生命',damage:'追加'+fmt(t.value)+'点物理伤害',state:'给自己施加'+label(g,'states',t.state)}[t.effect]||'')+'。';}
 const summary=(g,kind,x)=>kind==='states'?stateSummary(g,x):kind==='reactions'?reactionSummary(g,x):triggerSummary(g,x);
 function stateOptions(g){return Object.fromEntries((g.ruleLibrary?.states||[]).map(s=>[s.id,label(g,'states',s.id)+(s.enabled===false?'（已关闭）':'')]));}
 function deps(g,id){const r=g.ruleLibrary;return [...r.reactions.filter(x=>x.states?.includes(id)).map(x=>({kind:'reactions',id:x.id})),...r.triggers.filter(x=>x.effect==='state'&&x.state===id).map(x=>({kind:'triggers',id:x.id}))];}
 function deletion(g,kind,x){if(!pending||pending.kind!==kind||pending.id!==x.id)return '';const refs=deps(g,x.id).map(y=>label(g,y.kind,y.id)).join('、');return '<div class="cg-rule-dependency" role="status"><p>'+esc('“'+label(g,kind,x.id)+'”被'+refs+'使用。'+(pending.mode==='disable'?'关闭它会同时关闭这些效果。':'删除它会同时删除这些效果。'))+'</p><button type="button" data-rule-confirm="'+kind+':'+x.id+'">'+(pending.mode==='disable'?'同时关闭这些效果':'同时删除这些效果')+'</button><button type="button" data-rule-cancel="true">取消</button></div>';}
 function row(g,kind,x,i){
  const r=g.ruleLibrary,p=kind+'.'+i,key='cgRuleItem-'+kind+'-'+x.id,on=x.enabled!==false,n=x.name??R.label(g,kind,x.id,i),shown={...r,[kind]:r[kind].map((y,j)=>({...y,name:y.name??R.label(g,kind,y.id,j)}))},head='<span data-rule-title="'+kind+':'+esc(x.id)+'">'+esc(n)+'</span>'+(on?'':' <span class="cg-rule-off">已关闭</span>');
  let body=group(field(shown,p+'.name','效果名称',null,'text')+check(r,p+'.enabled','启用这个效果'));
  if(on){
   if(kind==='states')body+=group(select(r,p+'.effect','做什么',{marker:'附着一个标记',dot:'持续造成伤害',freeze:'让目标暂时不能行动'})+select(r,p+'.owner','谁施加',owner)+select(r,p+'.target','施加给谁',target)+select(r,p+'.applyAt','什么时候施加',{hit:'造成实际扣血后',start:'开战时'})+field(r,p+'.duration','持续几秒')+(x.effect==='dot'?select(r,p+'.channel','哪一类伤害',C.multi.NAMES)+field(r,p+'.amount','每层每次伤害（点）')+field(r,p+'.interval','每隔几秒造成一次'):''))+details('叠加与触发细节',group(field(r,p+'.maxStacks','最多几层')+select(r,p+'.refresh','再次施加时',{refresh:'增加一层，重新计算到期时间',replace:'回到一层，重新计算到期时间',extend:'增加一层，延长原来的持续时间'})+(x.applyAt==='hit'?select(r,p+'.source','哪些伤害扣血后会触发',source):'')+(x.effect==='dot'?check(r,p+'.critical','允许暴击')+check(r,p+'.leech','允许吸血'):'')),key+'-more');
   if(kind==='reactions'){
    const states=stateOptions(g),a=x.states?.[0]||'',b=x.states?.[1]||'';
    body+=group('<label>状态A<select id="'+pathId(p)+'-stateA" data-rule-state-pair="'+i+':0">'+options({'':'请选择一个状态',...states},a)+'</select></label><label>加上状态B<select id="'+pathId(p)+'-stateB" data-rule-state-pair="'+i+':1">'+options({'':'请选择另一个状态',...states},b)+'</select></label>'+select(r,p+'.effect','相遇后发生什么',{damage:'对附着方造成额外伤害',freeze:'让附着方暂时不能行动',shield:'给附着方增加护盾'})+(x.effect==='freeze'?field(r,p+'.duration','不能行动几秒'):field(r,p+'.amount',x.effect==='shield'?'增加多少护盾（点）':'额外伤害（点）')+(x.effect==='damage'?select(r,p+'.channel','哪一类伤害',C.multi.NAMES):'')));
    body+='<fieldset class="cg-rule-consume"><legend>每次反应后消耗哪些状态？</legend>'+[...new Set([a,b].filter(Boolean))].map(id=>'<label><input type="checkbox" data-rule-consume="'+i+'" value="'+esc(id)+'"'+(x.consume?.includes(id)?' checked':'')+'><span data-state-name="'+esc(id)+'">'+esc(label(g,'states',id))+'</span>：消耗1层</label>').join('')+'<small>至少选一个；没有勾选的状态保留。</small></fieldset>';
   }
   if(kind==='triggers')body+=group(select(r,p+'.owner','作用于谁',owner)+select(r,p+'.at','什么时候检查',{battle_start:'开战时',before_attack:'攻击前',after_hit:'造成实际扣血后'})+select(r,p+'.condition','满足什么条件',{always:'每到这个时机',hp_below:'自己的生命不高于某个比例',every_n:'每第N次攻击'})+(x.condition==='hp_below'?field(r,p+'.threshold','生命不高于多少%',null,'percent'):x.condition==='every_n'?field(r,p+'.every','每几次攻击触发一次'):'')+select(r,p+'.effect','做什么',{attack_multiplier:'一段时间内提高伤害倍率',shield:'增加自己的护盾',heal:'回复自己的生命',damage:'追加一笔物理伤害',state:'给自己施加一个状态'})+(x.effect==='state'?select(r,p+'.state','施加哪个状态',{'':'请选择状态',...stateOptions(g)}):field(r,p+'.value',x.effect==='attack_multiplier'?'伤害乘几倍':x.effect==='shield'?'增加多少护盾（点）':x.effect==='heal'?'回复多少生命（点）':'额外物理伤害（点）'))+(x.effect==='attack_multiplier'?field(r,p+'.duration','倍率持续几秒'):''))+details('次数与触发细节',group(field(r,p+'.cooldown','触发后至少隔几秒才能再触发')+check(r,p+'.once','每场只触发一次')+(x.at==='after_hit'?select(r,p+'.source','哪类伤害扣血后会触发',source):'')),key+'-more');
  }
  body+='<p class="cg-rule-sentence" data-rule-summary="'+kind+':'+esc(x.id)+'">'+esc(summary(g,kind,x))+'</p>'+deletion(g,kind,x)+'<div class="actions"><button type="button" data-rule-remove="'+kind+':'+esc(x.id)+'">删除这个效果</button></div><details class="cg-rule-internal"><summary>内部标识</summary><code>'+esc(x.id)+'</code></details>';
  return details(head,body,key,focusAfter===pathId(p+'.name')||pending?.id===x.id).replace('<details','<details name="cg-effect-editor"');
 }
 const templates={burn:'持续灼烧',freeze:'冻结',marker:'附着标记',reaction:'两种状态触发额外伤害',lowhp:'低血量增伤',pity:'暴击保底',shield:'开场护盾',periodic:'开场周期伤害',state:'自定义状态',trigger:'自定义条件效果'};
 function html(g){
  const r=g.ruleLibrary,has=r&&([...r.states,...r.reactions,...r.triggers].length||r.dot.enabled||r.dot.name);
  let body='<div class="cg-effect-add"><label>添加什么效果<select id="cgRuleTemplate">'+options(templates,'burn')+'</select></label><button type="button" id="cgRuleAddTemplate">添加效果</button></div><p id="cgRuleActionMessage" role="status"></p>';
  if(r?.enabled===false)body+='<p class="cg-rule-note">自定义设置已暂停，当前按基础规则计算。</p><button type="button" id="cgRuleResume">重新启用自定义设置</button>';
  body+='<p class="cg-rule-note">模板数值可改，用作填写起点。</p>';
  if(r){
   if(r.dot.enabled||r.dot.name)body+=details(esc(r.dot.name||'开场周期伤害')+(r.dot.enabled?'':' · 已关闭'),group(field({...r,dot:{...r.dot,name:r.dot.name||'开场周期伤害'}},'dot.name','效果名称',null,'text')+check(r,'dot.enabled','启用这个效果')+(r.dot.enabled?select(r,'dot.owner','谁施放',owner)+select(r,'dot.channel','哪一类伤害',C.multi.NAMES)+field(r,'dot.amount','每次伤害（点）')+field(r,'dot.interval','每隔几秒造成一次')+field(r,'dot.duration','从开战起持续几秒')+check(r,'dot.critical','允许暴击')+check(r,'dot.leech','允许吸血'):''))+'<button type="button" id="cgRuleRemovePeriodic">删除这个效果</button>','cgRulePeriodic',focusAfter===pathId('dot.name'));
   for(const kind of Object.keys(kinds))body+=r[kind].map((x,i)=>row(g,kind,x,i)).join('');
  }
  return details('状态与特殊效果'+(has?' · '+([...r.states,...r.reactions,...r.triggers].filter(x=>x.enabled!==false).length+(r.dot.enabled?1:0))+'项启用':''),body,'cgRuleEffects',!!has);
 }
 function advancedGrowth(r,p,title){const s=get(r,p);if(!['piecewise','expression'].includes(s?.id))return '';return details(esc(title),s.id==='expression'?field(r,p+'.expression','公式（base、step、n）',null,'formula'):field(r,p+'.segments','分段参数（高级JSON）',null,'json'),pathId(p)+'-advanced',true);}
 function advanced(g){
  const r=view(g);let body='<label class="cg-switch"><input type="checkbox" id="cgRuleEnabled"'+(R.config(g)?' checked':'')+'>使用当前自定义设置（关闭后保留草稿）</label>';
  body+=details('攻击与暴击的判定方式',group(select(r,'critical.scope','多段攻击怎样判定暴击',{segment:'每段单独判断和计数',attack:'同一次攻击共用暴击结果'})+check(r,'critical.sharedRandom','同次攻击各段共用随机数')+textField('cgRuleK','护甲换算参数（K，点）',g.rules.armorK)),'cgRuleJudgement');
  if(r.damage.id==='expression')body+=details('自定义伤害公式',field(r,'damage.expression','伤害公式',null,'formula')+'<p>可用attack、maxHp、hp、enemyHp、n；结果使用生命点。</p>','cgRuleDamageFormula',true);
  body+=advancedGrowth(r,'growth.reward','奖励的'+R.GROWTH[r.growth.reward.id]);
  for(const u of g.upgrades)for(const key of ['attribute','cost'])body+=advancedGrowth(r,'growth.upgrades.'+u.id+'.'+key,(u.name||u.id)+(key==='attribute'?'属性':'价格')+'的高级计算');
  body+=details('跨战斗保留',group(check(r,'lifecycle.carryStates','保留未到期状态')+check(r,'lifecycle.carryPity','保留未暴击计数')+check(r,'lifecycle.carryShield','保留剩余护盾')+select(r,'lifecycle.betweenBattles','战斗外的状态时间',{expire:'时间照走，到期移除',pause:'暂停，下一场继续'})),'cgRuleCarry');
  body+=details('属性在我的游戏里叫什么',group('<label>实际属性<select id="cgRuleLabelField">'+options(Object.fromEntries(C.multi.FIELDS.map(([k,n])=>[k,n])),'hp')+'</select></label><label>显示名称<input id="cgRuleLabelName" maxlength="24"></label>')+'<button type="button" id="cgRuleRename">修改显示名</button><label>防御显示名<input id="cgRuleArmorName" maxlength="24" value="'+esc(r.labels.armor)+'"></label>','cgRuleAliases');
  body+=details('扩展模块与未接入机制','<button type="button" id="cgRuleRegisterCandyGap">登记缺项：Candy Box 2 吃糖成长</button><p class="cg-rule-note">吃糖成长含exp与分项取整，尚未接入。只检查固定生命快照时，可明确限定检查范围。</p>'+field(r,'modules','已接入模块（高级JSON）',null,'json')+field(r,'missing','未接入机制及影响（高级JSON）',null,'json')+'<details><summary>模块与缺口的填写格式</summary><p>开场护盾模块示例：</p><pre>[{&quot;id&quot;:&quot;opening_shield&quot;,&quot;version&quot;:&quot;1.0.0&quot;,&quot;enabled&quot;:true,&quot;params&quot;:{&quot;amount&quot;:&quot;5&quot;}}]</pre><p>缺口示例：</p><pre>[{&quot;name&quot;:&quot;首领召唤&quot;,&quot;detail&quot;:&quot;尚未接入&quot;,&quot;affects&quot;:[&quot;combat&quot;,&quot;recommendation&quot;]}]</pre></details>','cgRuleModules');
  body+=details('公式、结算顺序与小算例','<p>高级成长公式的n从0开始：0级属性、第一次购买、第1关奖励。分段以本段起点重新计数。</p><p>基础伤害 → 条件倍率 → 通道增强 → 暴击 → 物理防御 → 对应抗性 → 格挡 → 护盾 → 生命。同刻双方攻击先生成，再扣血；存活者吸血和回复，最后处理状态与反应。反应至少消耗一个参与状态，不递归触发。</p><p>公式只接受+、-、*、/、^、min、max、clamp、pow、floor、ceil。最多512字、160记号、32层、1000步，精确分数超过预算会中断。</p>'+R.CATALOG.map(x=>'<p><strong>'+esc(x.name)+'</strong>：'+esc(x.example)+'。</p>').join(''),'cgRuleReference');
  return details('高级自定义',body,'cgRuleAdvanced');
 }

 function snapshot(g,strict=false){
  if(!g.ruleLibrary||!g.ruleLibrary.enabled)return;const r=ensure(g);
  if(by('cgRuleArmorName'))r.labels.armor=by('cgRuleArmorName').value;
  if(by('cgRuleK')){g.rules.armorK=by('cgRuleK').value;if(by('cg-armorK'))by('cg-armorK').value=g.rules.armorK;}
  for(const e of document.querySelectorAll('#cgV2Editor [data-rule]')){
   if(e.dataset.rule.startsWith('rounding.')&&!r.rounding&&by('cgRule-rounding-mode')?.value==='none')continue;
   if(e.dataset.rule==='behavior.awaitFirstPurchase'&&!e.checked&&r.behavior.awaitFirstPurchase===undefined)continue;
   let v=e.type==='checkbox'?e.checked:e.value;
   try{if(e.dataset.json)v=JSON.parse(v||'[]');else if(v!==''&&(e.dataset.percent||e.dataset.growthPercent)){v=q(v).div(q(100));if(e.dataset.growthPercent)v=v.add(q(1));v=v.toString();}else if(/(?:\.segments|\.guarantee|\.maxStacks|\.every|\.stage|\.level)$/.test(e.dataset.rule))v=v===''?'':Number(v);set(r,e.dataset.rule,v);}
   catch(error){if(strict){error.fieldId=e.id;error.message=(e.closest('label')?.childNodes[0]?.textContent||'这一项')+'填写有误，请检查格式';throw error;}if(!e.dataset.json)set(r,e.dataset.rule,v);}
  }
  for(const e of document.querySelectorAll('#cgV2Editor [data-rule-list]')){const p=e.dataset.ruleList;set(r,p,Array.from(document.querySelectorAll('[data-rule-list="'+p+'"]:checked')).map(x=>x.value));}
  for(const e of document.querySelectorAll('[data-rule-state-pair]')){const [i,n]=e.dataset.ruleStatePair.split(':').map(Number);r.reactions[i].states??=['',''];r.reactions[i].states[n]=e.value;}
  for(const e of document.querySelectorAll('[data-rule-consume]')){const i=Number(e.dataset.ruleConsume);r.reactions[i].consume=Array.from(document.querySelectorAll('[data-rule-consume="'+i+'"]:checked')).map(x=>x.value);}
 }
 function change(g,target){
  const id=target.id;
  if(id==='cgRuleEnabled'){
   if(!g.ruleLibrary&&target.checked)ensure(g);
   else if(g.ruleLibrary){const r=g.ruleLibrary;if(!target.checked)r.defense.profiles[r.defense.id]={player:g.player.armor,enemy:g.world.enemy.armor,k:g.rules.armorK,unit:r.defense.unit};const p=r.defense.profiles[target.checked?r.defense.id:'armor_k'];g.player.armor=p?.player??null;g.world.enemy.armor=p?.enemy??null;if(p?.k)g.rules.armorK=p.k;r.enabled=target.checked;}
   return true;
  }
  if(!R.config(g))return false;const r=g.ruleLibrary;
  if(id==='cgRuleDefense'){const old=target.dataset.previous;r.defense.profiles[old]={player:g.player.armor,enemy:g.world.enemy.armor,k:g.rules.armorK,unit:r.defense.unit};const next=target.value,profile=r.defense.profiles[next];r.defense.id=next;r.defense.unit=next==='ratio'?'fraction':'points';g.player.armor=profile?.player??null;g.world.enemy.armor=profile?.enemy??null;if(profile?.k)g.rules.armorK=profile.k;return true;}
  const p=target.dataset.rule;
  if(p?.match(/^states\.\d+\.enabled$/)&&!target.checked){const s=r.states[Number(p.split('.')[1])],references=deps(g,s.id).filter(x=>r[x.kind].find(y=>y.id===x.id).enabled!==false);if(references.length){s.enabled=true;pending={kind:'states',id:s.id,mode:'disable'};focusAfter=pathId(p);return true;}}
  if(p?.endsWith('.id')){const spec=get(r,p.replace(/\.id$/,''));if(spec.id==='geometric'&&empty(spec.factor))spec.factor='1';if(spec.id==='expression'&&empty(spec.expression))spec.expression='base + step * n';if(spec.id==='piecewise'&&!Array.isArray(spec.segments))spec.segments=[];}
  if(target.dataset.ruleStatePair){const i=Number(target.dataset.ruleStatePair.split(':')[0]),x=r.reactions[i];x.consume=(x.consume||[]).filter(s=>x.states.includes(s));return true;}
  return !!p&&(target.tagName==='SELECT'||target.type==='checkbox'||p==='recovery.fraction');
 }
 function next(g,kind){const r=ensure(g);let i=r.nextRuleId||1,id;do{id=kind.slice(0,-1)+'_'+i++;}while([...r.states,...r.reactions,...r.triggers].some(x=>x.id===id));r.nextRuleId=i;return id;}
 function enableType(g,type){g.types[type]=true;for(const a of [g.player,g.world.enemy])if(empty(a[type]))a[type]='0';}
 function addState(g,effect,name,extra={}){const r=ensure(g);if(r.states.length>=12)throw Error('最多12个状态，请先删除不用的状态');const s={id:next(g,'states'),name,enabled:true,effect,owner:'player',target:'target',applyAt:'hit',source:'direct',duration:'3',interval:'1',amount:'0',channel:'physical',maxStacks:1,refresh:'refresh',critical:false,leech:false,...extra};r.states.push(s);return s;}
 function addTemplate(g,id){
  const r=ensure(g);let kind='states',item;
  if(id==='burn'){enableType(g,'fire');item=addState(g,'dot','灼烧',{channel:'fire',amount:'2',duration:'6'});}
  else if(id==='freeze')item=addState(g,'freeze','冻结',{applyAt:'start',duration:'2'});
  else if(id==='marker'||id==='state')item=addState(g,'marker','新标记');
  else if(id==='reaction'){
   if(r.reactions.length>=12)throw Error('最多12个反应，请先删除不用的反应');let states=r.states.filter(s=>s.enabled!==false).slice(0,2);
   if(states.length<1)states.push(addState(g,'marker','潮湿'));if(states.length<2)states.push(addState(g,'marker','灼热'));
   item={id:next(g,'reactions'),name:'状态连携',enabled:true,states:states.map(s=>s.id),consume:states.map(s=>s.id),effect:'damage',channel:g.types.fire?'fire':'physical',amount:'3',duration:'1'};r.reactions.push(item);kind='reactions';
  }else if(id==='lowhp'||id==='trigger'){
   if(r.triggers.length>=12)throw Error('最多12个条件效果，请先删除不用的效果');item={id:next(g,'triggers'),name:id==='lowhp'?'低血量增伤':'新的条件效果',enabled:true,owner:'player',at:'before_attack',condition:'hp_below',threshold:'0.3',every:1,effect:'attack_multiplier',value:'1.5',state:'',duration:'2',cooldown:'2',once:false};r.triggers.push(item);kind='triggers';
  }else if(id==='pity'){g.mechanisms.critical=true;for(const a of [g.player,g.world.enemy]){if(empty(a.critChance))a.critChance='0';if(empty(a.critBonus))a.critBonus='1';if(empty(a.critAvoid))a.critAvoid='0';if(empty(a.critBonusReduction))a.critBonusReduction='0';}r.critical.guarantee=2;focusAfter=pathId('critical.guarantee');return;}
  else if(id==='shield'){r.shield.player='10';focusAfter=pathId('shield.player');return;}
  else if(id==='periodic'){enableType(g,'fire');r.dot={...r.dot,name:'开场持续伤害',enabled:true,owner:'player',channel:'fire',amount:'2',interval:'1',duration:'6',critical:false,leech:false};focusAfter=pathId('dot.name');return;}
  if(item)focusAfter=pathId(kind+'.'+(r[kind].length-1)+'.name');
 }
 function action(g,target){if(target.id==='cgRuleRegisterCandyGap'){const r=ensure(g),m=C.scope.KNOWN_GAP;if(!r.missing.some(x=>x.name===m.name))r.missing.push(copy(m));return {dirty:true};}
  if(target.dataset.ruleOpen){focusAfter=target.dataset.ruleOpen;return {render:true,dirty:false};}
  if(target.id==='cgRuleResume'){const r=g.ruleLibrary,profile=r.defense.profiles[r.defense.id];r.enabled=true;if(profile){g.player.armor=profile.player;g.world.enemy.armor=profile.enemy;if(profile.k)g.rules.armorK=profile.k;}focusAfter='cgRuleTemplate';return true;}
  if(target.id==='cgRuleAddTemplate'){addTemplate(g,by('cgRuleTemplate').value);return true;}
  if(!R.config(g))return false;const r=g.ruleLibrary;
  if(target.id==='cgRuleRename'){const n=by('cgRuleLabelName').value.trim();if(n)r.labels[by('cgRuleLabelField').value]=n;return true;}
  if(target.id==='cgRuleRemovePeriodic'){r.dot.enabled=false;delete r.dot.name;return true;}
  if(target.dataset.ruleCancel){pending=null;return {render:true,dirty:false};}
  if(target.dataset.ruleConfirm){const{kind,id,mode}=pending||{};if(!kind)return false;for(const ref of deps(g,id)){if(mode==='disable')r[ref.kind].find(x=>x.id===ref.id).enabled=false;else r[ref.kind]=r[ref.kind].filter(x=>x.id!==ref.id);}if(mode==='disable')r[kind].find(x=>x.id===id).enabled=false;else r[kind]=r[kind].filter(x=>x.id!==id);pending=null;focusAfter='cgRuleTemplate';return true;}
  if(target.dataset.ruleRemove){const[kind,id]=target.dataset.ruleRemove.split(':');if(kind==='states'&&deps(g,id).length){pending={kind,id,mode:'delete'};focusAfter=pathId(kind+'.'+r[kind].findIndex(x=>x.id===id)+'.enabled');return {render:true,dirty:false};}r[kind]=r[kind].filter(x=>x.id!==id);focusAfter='cgRuleTemplate';return true;}
  return false;
 }
 function preview(g){
  const r=R.config(g)||R.initial(g);
  for(const kind of Object.keys(kinds))for(const x of r[kind]){const el=document.querySelector('[data-rule-summary="'+kind+':'+x.id+'"]');if(el)el.textContent=summary(g,kind,x);const title=document.querySelector('[data-rule-title="'+kind+':'+x.id+'"]');if(title)title.textContent=label(g,kind,x.id);}
  for(const e of document.querySelectorAll('[data-state-name]'))e.textContent=label(g,'states',e.dataset.stateName);
  for(const e of document.querySelectorAll('[data-rule-state-pair] option,[data-rule$=".state"] option'))if(e.value)e.textContent=label(g,'states',e.value)+(r.states.find(s=>s.id===e.value)?.enabled===false?'（已关闭）':'');
  if(by('cgRulePreview'))try{const a=g.player.physicalMin,d=g.world.enemy.armor;if(empty(a)||empty(d))throw Error('填写双方伤害和防御后可核对');const n=R.mitigate(q(a),{percentPen:q(g.player.percentPen||'0'),flatPen:q(g.player.flatPen||'0')},{armor:q(d)},{armorK:q(R.defense(g)==='armor_k'?g.rules.armorK:'1'),defenseId:R.defense(g)});by('cgRulePreview').textContent='物理'+fmt(a)+'点，经敌人防御后为'+fmt(n.toString())+'点（未计取整、抗性等其他机制）。';}catch(e){by('cgRulePreview').textContent=e.message;}
  if(by('cgRuleGrowthPreview'))try{by('cgRuleGrowthPreview').textContent='前3关基础奖励：'+[0,1,2].map(n=>fmt(R.reward(g,n).toString())).join('、')+'金币。';}catch{by('cgRuleGrowthPreview').textContent='填好奖励后，这里核对前3关。';}
  for(const out of document.querySelectorAll('[data-upgrade-preview]'))try{const u=g.upgrades.find(x=>x.id===out.dataset.upgradePreview);out.textContent=String(u.maxLevel)==='0'?'等级上限为0，这一项不会购买。':'按当前公式：0级/1级属性 '+[0,1].map(n=>fmt(R.upgraded(g,u,g.player[u.fields[0]],n,u.fields[0]).toString())).join(' → ')+'；前3次价格 '+[0,1,2].map(n=>fmt(R.cost(g,u,n).toString())).join('、')+'金币。';}catch{out.textContent='填好属性和升级价格后，这里核对一次实际变化。';}
 }
 function afterRefresh(){if(!focusAfter)return;const id=focusAfter;focusAfter=null;const el=by(id);if(!el)return;for(let p=el;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;const focus=el.matches('input,select,textarea,button')?el:el.querySelector('input,select,textarea,button,summary');focus?.focus();focus?.scrollIntoView({block:'center',behavior:'instant'});}
 function prepare(g){
  const r=R.config(g),toggle=(id,off)=>{const e=by(id);if(e){e.disabled=!!off;e.closest('label').hidden=!!off;}};
  for(const[i,u]of g.upgrades.entries()){const s=r?.growth.upgrades[u.id];toggle('cg-up-'+i+'-increment',s&&!['linear','expression'].includes(s.attribute.id));toggle('cg-up-'+i+'-costBase',s?.cost.id==='piecewise');toggle('cg-up-'+i+'-costStep',s&&!['linear','expression'].includes(s.cost.id));}
  toggle('cg-armorK',!!by('cgRuleK'));toggle('cgRuleK',!g.mechanisms.armor||R.defense(g)!=='armor_k');toggle('cg-rewardBase',r?.growth.reward.id==='piecewise');toggle('cg-rewardStep',r&&!['linear','expression'].includes(r.growth.reward.id));
  if(g.ruleLibrary?.enabled===false)for(const e of document.querySelectorAll('#cgV2Editor [data-rule],#cgV2Editor [data-rule-list],#cgV2Editor [data-rule-state-pair],#cgV2Editor [data-rule-consume],#cgV2Editor [data-rule-remove],#cgRuleTemplate,#cgRuleAddTemplate,#cgRuleDefense,#cgRuleK,#cgRuleArmorName,#cgRuleLabelField,#cgRuleLabelName,#cgRuleRename,#cgRuleRemovePeriodic'))e.disabled=true;
 }
 function read(g){
  snapshot(g,true);if(!R.config(g))return g;
  for(const e of document.querySelectorAll('#cgV2Editor input[data-rule][inputmode=decimal]')){if(e.disabled)continue;const p=e.dataset.rule,v=get(g.ruleLibrary,p),title=e.closest('label').childNodes[0].textContent;
   try{if(empty(v))throw Error('请填写'+title);try{q(v);}catch{throw Error(title+'请填写有效数值');}let lo=0,hi=1e9,isInt=false;
    if(p==='damage.segments'){lo=1;hi=20;isInt=true;}else if(p.endsWith('.guarantee')){hi=100;isInt=true;}else if(p.endsWith('.maxStacks')){lo=1;hi=20;isInt=true;}else if(p.endsWith('.every')){lo=1;hi=100;isInt=true;}else if(p.endsWith('.stage')){lo=1;hi=1000;isInt=true;}else if(p.endsWith('.level')){hi=2000;isInt=true;}else if(p.endsWith('.duration')||p.endsWith('.interval')){lo=.1;hi=120;}else if(p.endsWith('.cooldown'))hi=120;else if(e.dataset.percent)hi=1;else if(p.endsWith('.factor')||p==='damage.coefficient')hi=100;
    if(isInt)R.integer(v,lo,hi,title);else R.bounded(v,lo,hi,title);
   }catch(error){error.fieldId=e.id;throw error;}
  }return g;
 }
 function locate(g,kind,id){const item=g.ruleLibrary?.[kind]?.find(x=>x.id===id),i=g.ruleLibrary?.[kind]?.indexOf(item);if(!item)return false;focusAfter=pathId(kind+'.'+i+'.name');afterRefresh();return true;}
 function eventInfo(g,e){
  let ref=null,words=[];
  const pick=(kind,id)=>{ref={kind,id};return label(g,kind,id);};
  if(['state_applied','state_expired'].includes(e.kind))words.push(pick('states',e.id));
  else if(e.kind==='reaction')words.push(pick('reactions',e.id));
  else if(e.kind==='trigger')words.push(pick('triggers',e.id));
  else if(e.kind==='module'){words.push(e.id==='opening_shield'?'开场护盾补给':'扩展模块');ref={kind:'modules',id:e.id};}
  if(e.source?.startsWith('state:'))words.push(pick('states',e.source.slice(6)));
  else if(e.source?.startsWith('reaction:'))words.push(pick('reactions',e.source.slice(9)));
  else if(e.source?.startsWith('direct:'))words.push('第'+(Number(e.source.split(':')[1])+1)+'段普通攻击');
  else if(e.source==='periodic_dot'){words.push(g.ruleLibrary?.dot.name||'开场周期伤害');ref={kind:'periodic',id:''};}
  else if(e.source==='trigger')words.push('条件效果追加伤害');
  if(e.damage!==undefined)words.push('实际扣血'+fmt(e.damage)+'点');
  if(e.shieldAbsorbed!==undefined)words.push('护盾吸收'+fmt(e.shieldAbsorbed)+'点');
  if(e.amount!==undefined)words.push('增加'+fmt(e.amount)+'点');
  if(e.stacks)words.push(e.stacks+'层');
  if(e.consumed?.length)words.push('消耗'+e.consumed.map(id=>label(g,'states',id)).join('、')+'各1层');
  if(e.effect)words.push(({attack_multiplier:'启用伤害倍率',shield:'增加护盾',heal:'回复生命',damage:'追加伤害',state:'施加状态',freeze:'禁止行动'})[e.effect]||'');
  return {text:words.filter(Boolean).join('；'),ref};
 }
 function reset(){pending=null;focusAfter=null;}
 function normalizeEconomy(g){const r=R.config(g);if(!r)return;for(const u of g.upgrades){const spec=r.growth.upgrades[u.id]?.cost;for(const segment of spec?.id==='piecewise'&&Array.isArray(spec.segments)?spec.segments:[])for(const k of ['base','step'])if(segment[k]!=null)segment[k]=C.scaled(segment[k],g.economy.costScale);}for(const segment of r.growth.reward.id==='piecewise'&&Array.isArray(r.growth.reward.segments)?r.growth.reward.segments:[])for(const k of ['base','step'])if(segment[k]!=null)segment[k]=C.scaled(segment[k],g.economy.rewardScale);}
 function example(base){const g=copy(base);g.name='规则组合 · 遗迹守卫';g.world.stageCount=12;g.player.hp='30';g.player.physicalMin=g.player.physicalMax='5';g.world.rewardBase='8';g.world.rewardStep='1';g.economy.costScale='1';g.economy.incomePerSecond='0.2';g.ruleLibrary=R.initial(g);const r=g.ruleLibrary;r.damage.segments=2;r.shield.player='10';r.critical.guarantee=2;r.dot={enabled:true,owner:'player',channel:'fire',amount:'2',interval:'1',duration:'6',critical:false,leech:false};r.states=[{id:'wet',effect:'marker',owner:'player',target:'target',applyAt:'hit',duration:'3',interval:'1',amount:'0',channel:'fire',maxStacks:1,refresh:'refresh'},{id:'heat',effect:'marker',owner:'player',target:'target',applyAt:'hit',duration:'3',interval:'1',amount:'0',channel:'fire',maxStacks:1,refresh:'refresh'}];r.reactions=[{id:'steam',states:['wet','heat'],consume:['wet','heat'],effect:'damage',channel:'fire',amount:'3',duration:'1'}];r.triggers=[{id:'last_stand',owner:'player',at:'before_attack',condition:'hp_below',threshold:'0.3',every:1,effect:'attack_multiplier',value:'1.5',duration:'2',cooldown:'2',once:false}];r.growth.upgrades.physical={attribute:{id:'geometric',factor:'1.05'},cost:{id:'geometric',factor:'1.15'},unlock:{stage:1,upgrade:'',level:0}};for(const u of g.upgrades)u.maxLevel=10;g.goals={minCompletionSeconds:null,maxCompletionSeconds:'7200',maxGapSeconds:'40',stagesPerVisit:null};return g;}

 return {html,attack,defense,critical,recovery,leech,upgrade,economy,behavior,advanced,snapshot,begin,change,action,preview,afterRefresh,read,name,percent,label,example,prepare,normalizeEconomy,locate,reset,addTemplate,stateSummary,reactionSummary,triggerSummary,eventInfo};
})();
