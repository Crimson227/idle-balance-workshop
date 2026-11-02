// UI judgement against the user's existing targets; not a retention prediction.
function assessComparison(gs){
 const out={version:'comparison-decision-1.0',verdict:'尚未比较',benefits:[],costs:[],basis:[]};
 if(!gs?.[0]?.results?.length||!gs?.[1]?.results?.length)return out;
 const [before,after]=gs.map(g=>g.results),[a,b]=G.compare(gs),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
 const paired=before.length===after.length&&before.every((r,i)=>r.seed===after[i].seed&&same(r.config.behavior,after[i].config.behavior)&&same(r.config.goals,after[i].config.goals)&&r.budget===after[i].budget);
 if(!paired){out.verdict='暂不能判断：两份记录的比较条件不同';out.costs.push('请使用相同的上线安排、模拟天数、目标和重复试算编号重算。');return out;}
 const n=after.length,count=(rs,k)=>rs.filter(r=>r.metrics.goal[k]).length;
 out.basis.push(`同条件配对${n}次；按当前打完周期、最长等待和每次上线进展判断。`);
 const wait=(a.maxGapHours-b.maxGapHours)*3600,buys=b.purchaseMedian-a.purchaseMedian;
 if(wait>1e-5)out.benefits.push(`最久等待缩短${time(wait)}。`);
 else if(wait< -1e-5)out.costs.push(`最久等待增加${time(-wait)}。`);
 if(buys<0)out.benefits.push(`购买次数的中间值少了${-buys}次。`);
 else if(buys>0)out.costs.push(`购买次数的中间值多了${buys}次。`);
 for(const [k,label] of [['completion','打完周期'],['wait','最长等待'],['visits','上线进展']]){
  const x=count(before,k),y=count(after,k);if(y>x)out.benefits.push(`${label}达标：${x}/${n} → ${y}/${n}。`);
  if(y<x)out.costs.push(`${label}达标：${x}/${n} → ${y}/${n}。`);
 }
 const beforeMiss=G.quantile(before.map(r=>r.metrics.visitMisses.length),.5),afterMiss=G.quantile(after.map(r=>r.metrics.visitMisses.length),.5);
 if(afterMiss<beforeMiss)out.benefits.push(`每轮上线进展不足的次数，中间值少了${beforeMiss-afterMiss}次。`);
 else if(afterMiss>beforeMiss)out.costs.push(`每轮上线进展不足的次数，中间值多了${afterMiss-beforeMiss}次。`);
 const early=after.filter(r=>r.completionTime!==null&&r.metrics.completionDays<r.config.goals.first_completion_min_days).length;
 const late=after.filter(r=>r.completionTime!==null&&r.metrics.completionDays>r.config.goals.first_completion_max_days).length;
 if(early)out.costs.push(`${early}/${n}次过早打完；希望至少${after[0].config.goals.first_completion_min_days}天。`);
 if(late)out.costs.push(`${late}/${n}次超过最晚打完时间。`);
 if(a.completionMedianAmongCompleted!==null&&b.completionMedianAmongCompleted!==null)out.basis.push(`打完用时中间值：${f(a.completionMedianAmongCompleted)} → ${f(b.completionMedianAmongCompleted)}天；更快不自动算改善。`);
 const incomplete=[...before,...after].some(r=>r.status!=='completed');
 if(incomplete){out.verdict='暂不能判定保留：有未完成或提前停止的记录';out.costs.push(`修改前${a.samples-a.completed}/${a.samples}次、修改后${b.samples-b.completed}/${b.samples}次未打完，不能只看完成者。`);return out;}
 const unchanged=before.every((r,i)=>same(r.config.rules,after[i].config.rules));
 if(unchanged){out.verdict='没有参数改动，暂不需要取舍';return out;}
 const worsened=['completion','wait','visits'].some(k=>count(after,k)<count(before,k));
 if(worsened)out.verdict='建议撤回这次改动：牺牲了原本达标的目标';
 else if(b.goalPasses<n)out.verdict='仍有目标没达到，暂不建议定稿';
 else if(out.costs.length)out.verdict=out.benefits.length?'有改善也有代价，需要你取舍':'未见明确改善，并有代价，建议继续调整';
 else if(out.benefits.length)out.verdict='建议保留，作为下一轮试玩候选';
 else out.verdict='未见明确收益，暂不建议替换修改前的方案';
 if(!out.benefits.length)out.benefits.push('本次没有观察到等待、操作量或目标通过数的改善。');
 if(!out.costs.length)out.costs.push('上述已检查指标未见退步；首局感受和好玩程度仍需试玩。');
 return out;
}
