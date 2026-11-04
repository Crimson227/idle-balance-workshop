'use strict';
const E=require('./原成长核心.cjs'),q=E.q,Z=q(0),O=q(1),min=(a,b)=>a.cmp(b)<0?a:b,max=(a,b)=>a.cmp(b)>0?a:b;
const floor=x=>x.n/x.d-(x.n<0n&&x.n%x.d?1n:0n),ceil=x=>-floor(Z.sub(x));
function config(g){return g.economy.payout||{mode:'continuous'};}
function validate(g){const p=config(g),fail=(message,fieldId)=>{const e=Error(message);e.fieldId=fieldId;throw e;};if(!['continuous','interval'].includes(p.mode))fail('收入到账方式请选择连续或按间隔到账','cgPayoutMode');if(p.mode==='interval'){let interval,first;try{interval=q(p.intervalSeconds);}catch{fail('到账间隔请填写有效秒数','cgPayoutInterval');}try{first=q(p.firstAtSeconds);}catch{fail('首笔到账时间请填写有效秒数','cgPayoutFirst');}if(interval.cmp(q('0.1'))<0||interval.cmp(q(86400))>0)fail('到账间隔须为0.1至86400秒','cgPayoutInterval');if(first.cmp(Z)<0||first.cmp(q(7776000))>0)fail('首笔到账时间须为0至90天内的秒数','cgPayoutFirst');}}
function create(g,slots,budget){
 const p=config(g),rate=q(g.economy.incomePerSecond),interval=p.mode==='interval'?q(p.intervalSeconds):null,first=interval?q(p.firstAtSeconds):null;
 const rawWindows=g.behavior.mode==='continuous'?[{start:Z,end:budget}]:slots.map((s,i)=>({start:s.start,end:min(slots[i+1]?.start??budget,g.ruleLibrary?.enabled&&g.ruleLibrary.behavior.offlineIncome===false?s.end:s.earnUntil)}));
 const windows=[];for(const w of rawWindows){const last=windows.at(-1);if(last&&w.start.cmp(last.end)<=0)last.end=max(last.end,w.end);else windows.push({...w});}
 function pieces(start,end){return windows.map(w=>({left:max(start,w.start),right:min(end,w.end),includeLeft:w.start.cmp(start)>0})).filter(w=>w.right.cmp(w.left)>0||w.includeLeft&&w.right.eq(w.left));}
 function ticks(part){const low=max(Z,q((part.includeLeft?ceil(part.left.sub(first).div(interval)):floor(part.left.sub(first).div(interval))+1n).toString())),hi=floor(part.right.sub(first).div(interval));return {low:low.n,count:max(Z,q(hi.toString()).sub(low).add(O))};}
 function between(start,end){if(end.cmp(start)<=0)return Z;return pieces(start,end).reduce((n,w)=>n.add(interval?ticks(w).count.mul(interval).mul(rate):w.right.sub(w.left).mul(rate)),Z);}
 function affordable(start,end,gap){if(gap.cmp(Z)<=0)return start;if(rate.eq(Z))return null;let need=gap;for(const w of pieces(start,end)){const amount=interval?ticks(w).count.mul(interval).mul(rate):w.right.sub(w.left).mul(rate);if(amount.cmp(need)>=0){if(!interval)return w.left.add(need.div(rate));const count=ceil(need.div(interval.mul(rate))),lo=ticks(w).low;return first.add(q((lo+count-1n).toString()).mul(interval));}need=need.sub(amount);}return null;}
 function points(start,end,limit=2000){const out=[];if(!interval||rate.eq(Z))return out;const rows=pieces(start,end).map(ticks),total=rows.reduce((n,r)=>n+r.count.n,0n),stride=total>BigInt(limit)?(total+BigInt(limit)-1n)/BigInt(limit):1n;for(const {low,count}of rows){for(let i=0n;i<count.n;i+=stride)out.push(first.add(q((low+i).toString()).mul(interval)));if(count.n){const last=first.add(q((low+count.n-1n).toString()).mul(interval));if(!out.at(-1)?.eq(last))out.push(last);}}return out;}
 const initial=interval&&first.eq(Z)?interval.mul(rate):Z;
 return {between,affordable,points,initial,interval,amount:interval?interval.mul(rate):null};
}
module.exports={config,validate,create};
