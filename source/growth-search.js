// Browser adapter of the existing local finite-grid workflow: fixed ranges,
// separate search/validation seeds, unchanged goals, bounded work, no global optimum claim.
async function findGrowthCandidates(config,problem,settings,run,isStopped,progress){
 const c=G.prepare(config),now=()=>performance.now(),start=now(),limit=settings.seconds*1000;
 const seedList=c.simulation.seeds,searchSeeds=seedList.slice(0,Math.min(2,seedList.length)),validationSeeds=seedList.filter(x=>!searchSeeds.includes(x)).slice(0,2);
 for(let seed=1041;validationSeeds.length<2;seed++)if(!searchSeeds.includes(seed)&&!validationSeeds.includes(seed))validationSeeds.push(seed);
 c.simulation.seeds=[...searchSeeds,...validationSeeds];
 const record={status:'running',reason:null,base:[],baseValidation:[],rows:[],recommendations:[],searched:0,planned:0,seeds:{search:searchSeeds,validation:validationSeeds},config:copy(c),ranges:copy(settings)};
 const earliest=c.rules.stage_cap*c.rules.attack_interval_seconds+Math.max(0,c.rules.stage_cap-1)*c.rules.transition_seconds;
 if(c.goals.first_completion_min_days>c.goals.first_completion_max_days||earliest>c.goals.first_completion_max_days*86400){record.status='conflict';record.reason='即使每关一击就赢，最早也需'+time(earliest)+'，已晚于目标上限。';return record;}
 if(c.goals.first_completion_min_days>c.simulation.days){record.status='insufficient_budget';record.reason='观察期限早于目标周期下限，请先增加模拟天数；没有放宽目标。';return record;}
 const grid=[],push=(key,value)=>{if(value===c.rules[key])return;const x=copy(c);x.rules[key]=value;x.name='候选：'+(typeof labels!=='undefined'?labels[key]:key);try{G.prepare(x);if(!grid.some(y=>y.key===key&&y.value===value))grid.push({id:'g'+grid.length,key,value,config:x,runs:[],validation:[],state:'pending'});}catch{}};
 for(const delta of settings.cost)push('cost_scale',c.rules.cost_scale*(1+delta/100));
 for(const delta of settings.growth)push('attack_cost_growth',c.rules.attack_cost_growth+delta/100);
 for(const delta of settings.reward)push('reward_base',c.rules.reward_base*(1+delta/100));
 if(problem==='easyBoss')for(const delta of [-10,-20])push('boss_hp_multiplier',Math.max(1,c.rules.boss_hp_multiplier*(1+delta/100)));
 if(c.rules.family==='chapter')push('family','fixed');
 record.planned=grid.length;record.rows=grid;if(!grid.length){record.status='invalid_range';record.reason='范围只包含原方案或超出模型边界，请在高级区改一个试算值。';return record;}
 const stop=()=>isStopped()?'cancelled':now()-start>limit?'time_limit':null;
 const qualifies=rs=>rs.length>0&&rs.every(r=>r.status==='completed'&&Object.values(r.metrics.goal).every(Boolean));
 const rank=rs=>[rs.filter(r=>!Object.values(r.metrics.goal).every(Boolean)).length,rs.filter(r=>r.status!=='completed').length,rs.reduce((n,r)=>n+Object.values(r.metrics.goal).filter(v=>!v).length,0),Math.max(...rs.map(r=>r.metrics.longestGap.seconds)),G.quantile(rs.map(r=>r.purchases.length),.5)];
 const compare=(a,b)=>{const x=rank(a),y=rank(b);for(let i=0;i<x.length;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
 async function samples(cfg,seeds,target,label){for(const seed of seeds){const reason=stop();if(reason){record.status=reason;return false;}progress(label,record);try{target.push(await run(cfg,seed,label));}catch(e){if(isStopped()){record.status='cancelled';return false;}record.status=e.reason||'error';record.reason=e.message;return false;}}return true;}
 if(!await samples(c,searchSeeds,record.base,'原方案'))return record;
 for(const row of grid.slice(0,settings.max)){if(!await samples(row.config,searchSeeds,row.runs,'试算'+(record.searched+1)))return record;row.state='searched';record.searched++;}
 const shortlist=grid.filter(x=>x.state==='searched').sort((a,b)=>compare(a.runs,b.runs)).slice(0,3);
 if(!await samples(c,validationSeeds,record.baseValidation,'核对原方案'))return record;record.baseQualifies=qualifies([...record.base,...record.baseValidation]);
 for(const row of shortlist){if(!await samples(row.config,validationSeeds,row.validation,'核对候选'))return record;row.state='validated';row.qualifies=qualifies([...row.runs,...row.validation]);}
 record.recommendations=shortlist.filter(x=>x.state==='validated').sort((a,b)=>Number(b.qualifies)-Number(a.qualifies)||compare([...a.runs,...a.validation],[...b.runs,...b.validation])).slice(0,3);
 record.status=record.searched<grid.length?'range_limit':record.recommendations.some(x=>x.qualifies)?'completed':record.recommendations.some(x=>[...x.runs,...x.validation].some(r=>r.status==='event_limit'))?'engine_limit':record.recommendations.some(x=>[...x.runs,...x.validation].some(r=>r.status!=='completed'))?'incomplete':'no_match';
 record.baseQualifies=qualifies([...record.base,...record.baseValidation]);return record;
}
