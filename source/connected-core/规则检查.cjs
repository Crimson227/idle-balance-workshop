'use strict';
const KNOWN_GAP={name:'Candy Box 2 吃糖成长',detail:'使用exp及分项向上取整，当前成长公式不支持。可先填已知生命快照检查战斗；依赖吃糖的成长路线和推荐不能据此验收。',affects:['growth','recommendation']};
const roots='format version battleVersion name player types mechanisms world upgrades strategy economy rules behavior goals simulation ruleLibrary goalUnits legacyBattle metadata source ruleScope'.split(' ');
function issues(g){
 const out=[],add=(name,detail,affects,path=null)=>out.push({name,detail,affects,...(path?{path}:{})}),keys=(o,allowed,path,affects)=>{if(!o||typeof o!=='object'||Array.isArray(o))return;for(const k of Object.keys(o))if(!allowed.includes(k))add('未知规则 '+path+k,'当前计算不使用此字段。请核对拼写，或明确只检查已支持部分；原字段会随配置保留。',affects,path+k);};
 keys(g,roots,'',['combat','growth','recommendation']);
 keys(g.economy,['initialCoins','incomePerSecond','incomeDuringCombat','costScale','rewardScale','payout'],'economy.',['growth','recommendation']);
 keys(g.economy?.payout,['mode','intervalSeconds','firstAtSeconds'],'economy.payout.',['growth','recommendation']);
 keys(g.world,['stageCount','enemy','steps','rewardBase','rewardStep','hpStep','hitStep','elementStep'],'world.',['growth','recommendation']);
 keys(g.rules,['armorK','battleTimeoutSeconds','victoryDelaySeconds','retryDelaySeconds'],'rules.',['combat','growth','recommendation']);
 keys(g.behavior,['mode','visitHours','sessionMinutes','offlineCapHours'],'behavior.',['growth','recommendation']);
 keys(g.strategy,['order','failureMode'],'strategy.',['growth','recommendation']);
 keys(g.simulation,['seeds','observationSeconds','maxEvents','maxBattles'],'simulation.',['growth','recommendation']);
 keys(g.goals,['minCompletionSeconds','maxCompletionSeconds','maxGapSeconds','stagesPerVisit'],'goals.',['growth','recommendation']);
 keys(g.ruleScope,['mode','unconfirmed'],'ruleScope.',['combat','growth','recommendation']);
 for(const [i,u] of (g.upgrades||[]).entries())keys(u,['id','name','enabled','fields','field','increment','costBase','costStep','maxLevel'],'upgrades.'+i+'.',['growth','recommendation']);
 const r=g.ruleLibrary;if(r?.enabled){
  keys(r,'version enabled labels defense damage dot critical shield recovery states reactions triggers growth behavior lifecycle modules missing nextRuleId eventBudget rounding attackOrder criticalOrder'.split(' '),'ruleLibrary.',['combat','growth','recommendation']);
  for(const [k,allowed,affects] of [
   ['defense','id unit channels profiles',['combat','recommendation']],['damage','id segments attribute coefficient expression',['combat','recommendation']],
   ['critical','mode scope sharedRandom guarantee threshold',['combat','recommendation']],['shield','player enemy',['combat','recommendation']],
   ['recovery','fraction interval leechChannels',['combat','recommendation']],['rounding','mode target at',['combat','recommendation']],
   ['dot','enabled name owner channel amount interval duration critical leech',['combat','recommendation']],
   ['growth','reward upgrades',['growth','recommendation']],['behavior','autoPurchase strategy offlineIncome offlinePurchase offlineBattle awaitFirstPurchase',['growth','recommendation']],
   ['lifecycle','carryStates carryPity carryShield betweenBattles',['combat','growth','recommendation']]])keys(r[k],allowed.split(' '),'ruleLibrary.'+k+'.',affects);
  for(const [kind,allowed] of [['states','id name enabled effect owner target applyAt source duration interval amount channel maxStacks refresh critical leech'],['triggers','id name enabled owner at condition source threshold every effect value duration cooldown once state'],['reactions','id name enabled states consume effect channel amount duration']])for(const [i,row] of (r[kind]||[]).entries())if(row.enabled!==false)keys(row,allowed.split(' '),'ruleLibrary.'+kind+'.'+i+'.',['combat','recommendation']);
  const growth=(x,path)=>{keys(x,['id','factor','expression','segments','from','base','step'],path,['growth','recommendation']);for(const [i,seg] of (x?.segments||[]).entries())keys(seg,['id','from','base','step','factor'],path+'segments.'+i+'.',['growth','recommendation']);};
  growth(r.growth?.reward,'ruleLibrary.growth.reward.');for(const [id,u] of Object.entries(r.growth?.upgrades||{})){keys(u,['attribute','cost','unlock'],'ruleLibrary.growth.upgrades.'+id+'.',['growth','recommendation']);growth(u.attribute,'ruleLibrary.growth.upgrades.'+id+'.attribute.');growth(u.cost,'ruleLibrary.growth.upgrades.'+id+'.cost.');keys(u.unlock,['stage','upgrade','level'],'ruleLibrary.growth.upgrades.'+id+'.unlock.',['growth','recommendation']);}
 }
 if(r?.missing!==undefined&&!Array.isArray(r.missing))add('未接入机制清单格式有误','请将未接入机制改为清单；不能据此判断整体规则齐全。',['combat','growth','recommendation']);else for(const m of r?.missing||[])add(m.name,m.detail,m.affects);
 for(const m of Array.isArray(g.ruleScope?.unconfirmed)?g.ruleScope.unconfirmed:[])add(m.name||'未命名的待确认规则','尚未确认：'+(m.detail||'请核对当前所选规则'),Array.isArray(m.affects)?m.affects:['combat','growth','recommendation']);
 return out;
}
function coverage(g){const missing=issues(g);return {complete:!missing.length,missing:structuredClone(missing),label:missing.length?'仅检查已建模部分':'按已配置规则检查',...(missing.length?{scope:g.ruleScope?.mode||'complete',overallAssessment:false}:{})};}
function message(rows){return rows.map(m=>m.name+'：'+m.detail+' 影响'+m.affects.map(k=>({combat:'战斗',growth:'成长',recommendation:'推荐'})[k]).join('、')).join('\n');}
function validateScope(g){if(g.ruleScope&&(!['complete','supported'].includes(g.ruleScope.mode)||g.ruleScope.unconfirmed!==undefined&&(!Array.isArray(g.ruleScope.unconfirmed)||g.ruleScope.unconfirmed.some(m=>!m||typeof m.name!=='string'||!m.name.trim()||typeof m.detail!=='string'||!Array.isArray(m.affects)||!m.affects.length||m.affects.some(k=>!['combat','growth','recommendation'].includes(k))))))throw Error('检查范围须选完整或已支持部分；待确认规则须填写名称、说明及影响范围');}
function assertScope(g){validateScope(g);const rows=issues(g);if(rows.length&&g.ruleScope?.mode!=='supported'){const e=Error('运行前还缺规则确认：\n'+message(rows)+'\n请补齐规则，或明确选择“只检查已支持部分”。');e.code='rule_scope_required';e.fieldId='cgRuleScope';e.issues=rows;throw e;}}
module.exports={KNOWN_GAP,issues,coverage,message,validateScope,assertScope};
