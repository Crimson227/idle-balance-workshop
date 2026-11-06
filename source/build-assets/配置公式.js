(function(root,factory){const v=factory();if(typeof module==='object'&&module.exports)module.exports=v;else root.ConfigModel=v;})(globalThis,function(){
  'use strict';
  const fields=[
    ['stage_cap','总关数','关',1,10000],['chapter_size','每章关数','关',1,10000],
    ['hp_base','首关生命','点',.001,1e12],['hp_growth','每关生命倍率','倍',1,2],
    ['attack_base','基础攻击','点',.001,1e12],['defense','固定敌方防御','点',0,1e12],['defense_scale','减伤尺度','点',.001,1e12],
    ['attack_gain','每次攻击升级倍率','倍',1,3],['attack_cost_base','攻击升级原始起价','资源',.001,1e12],['attack_cost_growth','攻击价格递增倍率','倍',1,3],
    ['income_gain','每次收益升级倍率','倍',1,3],['income_cost_base','收益升级原始起价','资源',.001,1e12],['income_cost_growth','收益价格递增倍率','倍',1,3],
    ['cost_scale','升级价格整体倍率','倍',.001,1000],['reward_base','首关基础奖励','资源',.001,1e12],['reward_growth','逐关奖励倍率','倍',1,2],
    ['chapter_power','每章累计成长倍率','倍',1,3],['boss_hp_multiplier','Boss生命倍率','倍',1,10],['boss_first_reward','Boss首次奖励倍率','倍',1,20],
    ['attack_interval_seconds','攻击间隔','秒',.02,30],['timeout_seconds','战斗限时','秒',1,600],['transition_seconds','换场时间','秒',0,60],
    ['crit_chance','暴击概率','比例',0,1],['crit_multiplier','暴击伤害倍率','倍',1,10],['offline_cap_hours','离线收益上限','小时',0,168],['push_success_threshold','自动挑战准入概率','比例',0,1]
  ];
  function validate(c){
    if(c?.format!=='idle-design-template-v1')throw Error('请导入本模板导出的参数JSON。');
    const p=c.rules;
    for(const [key,label,unit,min,max] of fields){const v=p?.[key];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`${label}须在${min}—${max}${unit}之间。`);}
    for(const k of ['stage_cap','chapter_size'])if(!Number.isInteger(p[k]))throw Error('关数须为整数。');
    if(p.chapter_size>p.stage_cap)throw Error('每章关数不能超过总关数。');
    if(!['fixed','chapter'].includes(p.family))throw Error('成长方式须为逐关平滑或章末集中。');
    const g=c.goals;
    for(const k of ['visits_per_day','session_minutes','first_completion_min_days','first_completion_max_days','max_no_progress_hours'])if(typeof g?.[k]!=='number'||!Number.isFinite(g[k])||g[k]<=0||g[k]>10000)throw Error('体验目标须为大于0的有限数字。');
    if(!Number.isInteger(g.visits_per_day)||g.visits_per_day>24)throw Error('每天回访次数须为1—24的整数。');
    if(g.first_completion_min_days>g.first_completion_max_days)throw Error('首通天数下限不能大于上限。');
    if(!Object.values(stage(c,p.stage_cap)).every(Number.isFinite))throw Error('末关数值超出可计算范围，请降低关数或增长率。');
    if(!Number.isFinite(upgrade(c,300).attack_cost)||!Number.isFinite(upgrade(c,300).income_cost))throw Error('升级价格超出可计算范围。');
    return c;
  }
  function power(c,s){const p=c.rules;return p.chapter_power**(p.family==='fixed'?s/p.chapter_size:Math.floor(s/p.chapter_size));}
  function stage(c,n){const p=c.rules,boss=n%p.chapter_size===0,base=p.reward_base*p.reward_growth**(n-1);return {
    stage:n,chapter:Math.ceil(n/p.chapter_size),is_boss:boss?1:0,
    enemy_hp:p.hp_base*p.hp_growth**(n-1)*(boss?p.boss_hp_multiplier:1),
    repeat_reward_g0:base,first_reward:base*(boss?p.boss_first_reward:1),
    clear_power_before:power(c,n-1),clear_power_after:power(c,n)
  };}
  function upgrade(c,l){const p=c.rules;return {level_before_purchase:l,
    attack_cost:p.cost_scale*p.attack_cost_base*p.attack_cost_growth**l,
    income_cost:p.cost_scale*p.income_cost_base*p.income_cost_growth**l,
    attack_multiplier:p.attack_gain**l,reward_multiplier:p.income_gain**l};}
  function damage(c,s,a){const p=c.rules;return p.attack_base*p.attack_gain**a*p.defense_scale/(p.defense_scale+p.defense)*power(c,s);}
  function csv(headers,rows){return '\uFEFF'+headers.join(',')+'\r\n'+rows.map(row=>headers.map(k=>row[k]).join(',')).join('\r\n')+'\r\n';}
  return {fields,validate,power,stage,upgrade,damage,csv};
});
