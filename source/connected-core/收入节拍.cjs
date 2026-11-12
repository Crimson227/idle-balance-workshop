'use strict';
const E=require('./原成长核心.cjs'),q=E.q,Z=q(0),O=q(1),min=(a,b)=>a.cmp(b)<0?a:b,max=(a,b)=>a.cmp(b)>0?a:b;
const floor=x=>x.n/x.d-(x.n<0n&&x.n%x.d?1n:0n),ceil=x=>-floor(Z.sub(x));
function config(g){return g.economy.payout||{mode:'continuous'};}
function validate(g){const p=config(g),fail=(message,fieldId)=>{const e=Error(message);e.fieldId=fieldId;throw e;};if(!['continuous','interval'].includes(p.mode))fail('收入到账方式请选择连续或按间隔到账','cgPayoutMode');if(p.mode==='interval'){let interval,first;try{interval=q(p.intervalSeconds);}catch{fail('到账间隔请填写有效秒数','cgPayoutInterval');}try{first=q(p.firstAtSeconds);}catch{fail('首笔到账时间请填写有效秒数','cgPayoutFirst');}if(interval.cmp(q('0.1'))<0||interval.cmp(q(86400))>0)fail('到账间隔须为0.1至86400秒','cgPayoutInterval');if(first.cmp(Z)<0||first.cmp(q(7776000))>0)fail('首笔到账时间须为0至90天内的秒数','cgPayoutFirst');}}
function offlineConfig(g){return g.economy.offlinePayout;}
function validateOffline(g){
 const p=offlineConfig(g);
 if(p===undefined)return;
 const fail=(fieldId,message)=>{const e=Error(message);e.fieldId=fieldId;throw e;};
 if(!p||typeof p!=='object'||!['accrual','resume_cadence','on_return'].includes(p.mode))fail('cgOfflinePayoutMode','请选择有效的离线结算方式');
 if(p.mode==='accrual')return;
 const fields=[[p.minimumSeconds,'cgOfflinePayoutMin',259200,'最低离线时长']];
 if(p.mode==='on_return')fields.unshift([p.ratePerSecond,'cgOfflinePayoutRate',1000000,'离线每秒金币']);
 for(const [value,id,max,label] of fields){
  let n;
  try{n=q(value);}catch{fail(id,label+'请填写有效数值');}
  if(n.cmp(Z)<0||n.cmp(q(max))>0)fail(id,label+'须为0至'+max);
 }
 if(p.mode==='on_return'&&!['none','floor'].includes(p.rounding))fail('cgOfflinePayoutRounding','请选择有效的离线取整方式');
}
function returnPayouts(g,slots){
 const rule=offlineConfig(g);
 if(g.behavior.mode!=='visits'||g.ruleLibrary?.enabled&&g.ruleLibrary.behavior.offlineIncome===false)return [];
 const minimum=q(rule.minimumSeconds),rate=q(rule.ratePerSecond),rows=[];
 for(let i=1;i<slots.length;i++){
  const previous=slots[i-1],time=slots[i].start;
  const duration=min(time,previous.earnUntil).sub(previous.end);
  if(duration.cmp(Z)<=0||duration.cmp(minimum)<0)continue;
  const raw=duration.mul(rate);
  const amount=rule.rounding==='floor'?q(floor(raw).toString()):raw;
  if(amount.cmp(Z)>0)rows.push({time,amount});
 }
 return rows;
}
function firstAfter(rows,key,time){
 let lo=0,hi=rows.length;
 while(lo<hi){
  const mid=Math.floor((lo+hi)/2);
  if(rows[mid][key].cmp(time)<=0)lo=mid+1;else hi=mid;
 }
 return lo;
}
function create(g,slots,budget){
 const rule=offlineConfig(g),onReturn=rule?.mode==='on_return',resumeCadence=rule?.mode==='resume_cadence',payouts=onReturn?returnPayouts(g,slots):[];
 const minimum=resumeCadence?q(rule.minimumSeconds):Z;
 const offlineIncome=!g.ruleLibrary?.enabled||g.ruleLibrary.behavior.offlineIncome!==false;
 const p=config(g),rate=q(g.economy.incomePerSecond),interval=p.mode==='interval'?q(p.intervalSeconds):null,first=interval?q(p.firstAtSeconds):null;
 const windows=[];
 let paused=Z;
 const incomeSlots=g.behavior.mode==='continuous'?[{start:Z,end:budget,earnUntil:budget}]:slots;
 for(const [i,slot] of incomeSlots.entries()){
  const next=incomeSlots[i+1]?.start??budget;
  const earnsOffline=offlineIncome&&!onReturn&&next.sub(slot.end).cmp(minimum)>=0;
  const end=earnsOffline?min(next,slot.earnUntil):slot.end;
  const last=windows.at(-1);
  if(last&&slot.start.cmp(last.end)<=0)last.end=max(last.end,end);
  else windows.push({start:slot.start,end,first:interval?first.add(paused):null});
  // In this mode only simulated seconds advance the payout clock.
  if(resumeCadence)paused=paused.add(next.sub(end));
 }
 function pieces(start,end){
  const result=[];
  for(let i=firstAfter(windows,'end',start);i<windows.length&&windows[i].start.cmp(end)<=0;i++){
   const w=windows[i],left=max(start,w.start),right=min(end,w.end),includeLeft=!resumeCadence&&w.start.cmp(start)>0;
   if(right.cmp(left)>0||includeLeft&&right.eq(left))result.push({left,right,includeLeft,first:w.first});
  }
  return result;
 }
 function ticks({left,right,includeLeft,first}){const low=max(Z,q((includeLeft?ceil(left.sub(first).div(interval)):floor(left.sub(first).div(interval))+1n).toString())),hi=floor(right.sub(first).div(interval));return {first,low:low.n,count:max(Z,q(hi.toString()).sub(low).add(O))};}
 function baseBetween(start,end){if(rate.eq(Z)||end.cmp(start)<=0)return Z;return pieces(start,end).reduce((n,w)=>n.add(interval?ticks(w).count.mul(interval).mul(rate):w.right.sub(w.left).mul(rate)),Z);}
 function baseAffordable(start,end,gap){if(gap.cmp(Z)<=0)return start;if(rate.eq(Z))return null;let need=gap;for(const w of pieces(start,end)){const amount=interval?ticks(w).count.mul(interval).mul(rate):w.right.sub(w.left).mul(rate);if(amount.cmp(need)>=0){if(!interval)return w.left.add(need.div(rate));const count=ceil(need.div(interval.mul(rate))),lo=ticks(w).low;return w.first.add(q((lo+count-1n).toString()).mul(interval));}need=need.sub(amount);}return null;}
 function points(start,end,limit=2000){const out=[];if(!interval||rate.eq(Z))return out;const rows=pieces(start,end).map(ticks),total=rows.reduce((n,r)=>n+r.count.n,0n),stride=total>BigInt(limit)?(total+BigInt(limit)-1n)/BigInt(limit):1n;for(const {first,low,count}of rows){for(let i=0n;i<count.n;i+=stride)out.push(first.add(q((low+i).toString()).mul(interval)));if(count.n){const last=first.add(q((low+count.n-1n).toString()).mul(interval));if(!out.at(-1)?.eq(last))out.push(last);}}return out;}
 function returningBetween(start,end){
  return payouts.slice(firstAfter(payouts,'time',start),firstAfter(payouts,'time',end));
 }
 function between(start,end,receiveBase=true){
  return returningBetween(start,end).reduce((total,p)=>total.add(p.amount),receiveBase?baseBetween(start,end):Z);
 }
 function affordable(start,end,gap){
  if(gap.cmp(Z)<=0)return start;
  let cursor=start,need=gap;
  for(const payout of returningBetween(start,end)){
   const before=baseAffordable(cursor,payout.time,need);
   if(before!==null)return before;
   need=need.sub(baseBetween(cursor,payout.time)).sub(payout.amount);
   if(need.cmp(Z)<=0)return payout.time;
   cursor=payout.time;
  }
  return baseAffordable(cursor,end,need);
 }
 const initial=interval&&first.eq(Z)?interval.mul(rate):Z;
 return {between,affordable,points,initial,interval,onReturn,returningBetween,windows,hasIncome:rate.cmp(Z)>0||payouts.length>0,amount:interval?interval.mul(rate):null};
}
module.exports={config,offlineConfig,validate,validateOffline,create};
