'use strict';
const E=require('./原成长核心.cjs'),q=E.q,Z=q(0),min=(a,b)=>a.cmp(b)<0?a:b,max=(a,b)=>a.cmp(b)>0?a:b;
const VERSION='progress-gap-1.0.0';
const LABELS={plannedOffline:'计划离线',onlineFunding:'在线攒钱',offlineFunding:'离线自动购买前攒钱',combat:'战斗/挑战',combatBlocked:'战斗失败后无法继续',retryDelay:'失败后重试间隔',transition:'换关间隔',policyBlocked:'购买策略阻塞',unknown:'待定位'};
function explain(r,stage=r.longestGap.stage){
 const row=r.stages?.find(s=>s.stage===stage);if(!row||row.arrival==null)return {version:VERSION,stage,unreached:true};
 const from=q(row.arrival),to=q(row.passedAt??r.time),total=to.sub(from),behavior=r.inputGame?.behavior,known=!!behavior,online=[];
 if(behavior?.mode==='continuous')online.push({start:Z,end:q(r.time)});
 else if(behavior?.mode==='visits')for(let day=0;day<=Number(q(r.time).n/(q(r.time).d*86400n))&&day<=90;day++)for(const hour of behavior.visitHours){const start=q(day*86400).add(q(String(hour)).mul(q(3600))),end=start.add(q(behavior.sessionMinutes).mul(q(60)));if(start.cmp(to)<=0)online.push({start,end});}
 const waits=Array.isArray(r.waits)?r.waits:(r.events||[]).filter(e=>e.kind==='wait'),battles=Array.isArray(r.battles)?r.battles:(r.events||[]).filter(e=>e.kind==='battle');
 const records=[];for(const [collection,rows]of [['waits',waits],['battles',battles]])rows.forEach((x,index)=>{if(x.start==null||x.end==null)return;const start=max(from,q(x.start)),end=min(to,q(x.end));if(end.cmp(start)>0)records.push({collection,index,data:x,start,end});});
 const cuts=[from,to,...records.flatMap(x=>[x.start,x.end]),...online.flatMap(s=>[s.start,s.end]).filter(t=>t.cmp(from)>0&&t.cmp(to)<0)].sort((a,b)=>a.cmp(b)).filter((t,i,a)=>!i||!t.eq(a[i-1]));
 const totals=Object.fromEntries(Object.keys(LABELS).map(k=>[k,Z])),segments=[],failed=[],fundingEvidence=[],timeline=[],pending=[...records].sort((a,b)=>a.start.cmp(b.start));let offlineCombat=Z,recordIndex=0,onlineIndex=0,active=[];
 for(let i=0;i<cuts.length-1;i++){
  const start=cuts[i],end=cuts[i+1],duration=end.sub(start);active=active.filter(x=>x.end.cmp(start)>0);while(recordIndex<pending.length&&pending[recordIndex].start.cmp(start)<=0)active.push(pending[recordIndex++]);while(onlineIndex<online.length&&online[onlineIndex].end.cmp(start)<=0)onlineIndex++;const slot=online[onlineIndex],isOnline=known?!!slot&&slot.start.cmp(start)<=0&&slot.end.cmp(end)>=0:null;
  let category='unknown',ref=active.length===1?active[0]:null;
  if(ref?.collection==='battles'){category='combat';if(isOnline===false)offlineCombat=offlineCombat.add(duration);}
  else if(active.length<=1&&isOnline===false){category=!ref&&r.inputGame.ruleLibrary?.behavior?.offlineBattle?'unknown':ref?.data.reason==='upgrade_funding'&&r.inputGame.ruleLibrary?.behavior?.offlinePurchase?'offlineFunding':ref?.data.reason==='idle_after_structural_block'&&r.inputGame.ruleLibrary?.behavior?.offlineBattle?'combatBlocked':'plannedOffline';}
  else if(ref)category=({upgrade_funding:'onlineFunding',idle_after_funding_block:'onlineFunding',idle_after_structural_block:'combatBlocked',idle_after_policy_block:'policyBlocked',victory_delay:'transition',retry_delay:'retryDelay'})[ref.data.reason]||'unknown';
  totals[category]=totals[category].add(duration);
  segments.push({start:start.toString(),end:end.toString(),seconds:duration.toString(),category,label:LABELS[category],online:isOnline,evidence:active.map(x=>({collection:x.collection,index:x.index,reason:x.data.reason??x.data.outcome,stage:x.data.stage})),scheduleEvidence:known?'inputGame.behavior':null});
 }
 for(const x of records){if(x.collection==='battles'&&['death','draw','timeout'].includes(x.data.outcome))failed.push({collection:x.collection,index:x.index,start:x.data.start,end:x.data.end,outcome:x.data.outcome,playerHp:x.data.playerHp,enemyHp:x.data.enemyHp});if(x.collection==='waits'&&['upgrade_funding','idle_after_funding_block'].includes(x.data.reason))fundingEvidence.push({collection:x.collection,index:x.index,start:x.data.start,end:x.data.end,reason:x.data.reason,selectedUpgrade:x.data.selectedUpgrade??null,nextPrice:x.data.nextPrice??null,resourceGap:x.data.resourceGap??null});}
 const actualLogins=(r.events||[]).map((e,index)=>({e,index})).filter(x=>x.e.kind==='login'&&q(x.e.time).cmp(from)>=0&&q(x.e.time).cmp(to)<=0);
 for(const s of online)if(s.end.cmp(from)>=0&&s.end.cmp(to)<=0&&s.end.cmp(q(r.time))<0)timeline.push({kind:'planned_logout',time:s.end.toString(),source:'inputGame.behavior'});
 for(const x of actualLogins)timeline.push({kind:'login',time:x.e.time,source:'events',index:x.index});
 if(known&&!online.some(s=>s.start.cmp(from)<=0&&s.end.cmp(from)>0)&&!online.some(s=>s.end.eq(from))){const previous=online.filter(s=>s.end.cmp(from)<0).at(-1);timeline.unshift({kind:'already_offline',time:from.toString(),plannedLogout:previous?.end.toString()??null,source:'inputGame.behavior'});}
 timeline.sort((a,b)=>q(a.time).cmp(q(b.time)));
 const returns=actualLogins.filter(x=>q(x.e.time).cmp(from)>0),lastReturn=returns.at(-1)?.e.time??null;
 const loginFunding=records.filter(x=>x.collection==='waits'&&x.data.reason==='waiting_for_login'&&x.data.affordableAt!=null).map(x=>({collection:x.collection,index:x.index,waitStart:x.data.start,waitEnd:x.data.end,affordableAt:x.data.affordableAt,selectedUpgrade:x.data.selectedUpgrade,nextPrice:x.data.nextPrice,resourceGap:x.data.resourceGap,note:'下一笔升级在离线期间攒够；该区间不重复计入在线攒钱'}));
 const accounted=Object.values(totals).reduce((a,b)=>a.add(b),Z),ranked=Object.keys(totals).sort((a,b)=>totals[b].cmp(totals[a])),primary=ranked[0],hasResourceBlock=totals.onlineFunding.add(totals.offlineFunding).cmp(Z)>0,hasBattleBlock=failed.length>0||totals.combatBlocked.cmp(Z)>0;
 let summary=total.eq(Z)?'这关没有产生未推进间隔':primary==='plannedOffline'&&totals.plannedOffline.mul(q(2)).cmp(total)>=0?'主要在等待下次上线':primary==='onlineFunding'?'主要在攒钱，等待下一次升级':primary==='offlineFunding'?'主要在离线攒钱，等待自动购买':primary==='combatBlocked'?'战斗失败后无法继续推进':primary==='combat'?(hasBattleBlock?'主要在进行挑战，其中有失败记录':'主要在进行战斗'):primary==='policyBlocked'?'当前购买策略无法继续推进':primary==='unknown'?'这段原因待定位':'这段由战斗、等待与间隔共同组成';
 if(primary==='plannedOffline'&&(hasResourceBlock||hasBattleBlock))summary+='；另有'+[hasResourceBlock?'攒钱等待':'',hasBattleBlock?'失败挑战':''].filter(Boolean).join('和');
 return {version:VERSION,stage,seed:r.seed,from:from.toString(),to:to.toString(),seconds:total.toString(),censored:row.passedAt==null,primary,summary,definition:'两次新关推进之间的全部时间，含计划离线、在线等待与战斗；第一段从开始计，末段保留观察截止',totals:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v.toString()])),labels:LABELS,accounted:accounted.toString(),exactTimeAccounted:accounted.eq(total),segments,timeline,lastProgress:{stage:Math.max(0,stage-1),time:from.toString(),initial:stage===1},nextProgress:row.passedAt==null?null:{stage,time:to.toString()},lastReturn,afterReturnSeconds:lastReturn&&row.passedAt!=null?to.sub(q(lastReturn)).toString():null,flags:{hasResourceBlock,hasBattleBlock,hasPolicyBlock:totals.policyBlocked.cmp(Z)>0,unknown:totals.unknown.cmp(Z)>0},failedBattles:failed,fundingEvidence,loginFunding,overlap:{plannedOfflineCombatSeconds:offlineCombat.toString(),note:'计划下线期间仍在结算的战斗只计入战斗，不再加到计划离线；离线期间攒够下一笔升级也不重复相加'}};
}
module.exports={VERSION,LABELS,explain};
