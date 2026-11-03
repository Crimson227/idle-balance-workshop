(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BattleLab=api;})(globalThis,function(){
  'use strict';
  const TYPES=['physical','fire','ice','lightning','poison'];
  const TYPE_NAMES={physical:'物理',fire:'火焰',ice:'冰霜',lightning:'闪电',poison:'毒性'};
  const FIELDS=[
    ['hp','生命上限',1,1e7,2764],['physicalMin','最小物理伤害',0,1e6,170],['physicalMax','最大物理伤害',0,1e6,215],
    ['frequency','攻击速度（次/秒）',.1,10,1.25],['critChance','暴击率',0,1,.15],['critBonus','暴击额外伤害',0,5,.5],
    ['fire','每击火焰伤害',0,1e6,0],['ice','每击冰霜伤害',0,1e6,0],['lightning','每击闪电伤害',0,1e6,0],['poison','每击毒性直伤',0,1e6,0],
    ['armor','护甲',0,1e5,30],['flatPen','固定护甲穿透',0,1e5,0],['percentPen','比例护甲穿透',0,1,0],
    ['physicalBonus','物理增强',0,10,0],['fireBonus','火焰增强',0,10,0],['iceBonus','冰霜增强',0,10,0],['lightningBonus','闪电增强',0,10,0],['poisonBonus','毒性增强',0,10,0],
    ['physicalResist','物理抗性',0,.75,0],['fireResist','火焰抗性',0,.75,0],['iceResist','冰霜抗性',0,.75,0],['lightningResist','闪电抗性',0,.75,0],['poisonResist','毒性抗性',0,.75,0],
    ['critAvoid','暴击率减免',0,1,0],['critBonusReduction','暴击额外伤害减免',0,5,0],['blockChance','格挡率',0,1,.03],['blockReduction','格挡减伤比例',0,1,.35],
    ['regen','每秒生命回复',0,1e5,2],['leech','生命偷取比例',0,1,.02],['leechResist','生命偷取减免',0,1,0]
  ];
  const PERCENT_FIELDS=new Set(FIELDS.map(x=>x[0]).filter(k=>/Bonus|Chance|Resist|Pen|Avoid|Reduction|leech/.test(k)&&k!=='flatPen'));
  const clone=x=>JSON.parse(JSON.stringify(x));
  const zero=()=>Object.fromEntries(TYPES.map(k=>[k,0]));
  const sum=o=>TYPES.reduce((a,k)=>a+o[k],0);
  const actor=(patch={})=>Object.assign(Object.fromEntries(FIELDS.map(([k,l,min,max,v])=>[k,v])),patch);
  const PLAYER=actor();
  const ENEMIES={
    normal:{name:'普通敌人',value:actor({hp:3800,physicalMin:45,physicalMax:55,frequency:.8,armor:0,critChance:.05,blockChance:0,regen:0,leech:0})},
    armor:{name:'重甲敌人',value:actor({hp:3800,physicalMin:45,physicalMax:55,frequency:.8,armor:400,physicalResist:.05,fireResist:.1,iceResist:.1,lightningResist:.1,poisonResist:.1,critChance:.05,blockChance:0,regen:0,leech:0})},
    resistant:{name:'元素抗性敌人',value:actor({hp:3800,physicalMin:45,physicalMax:55,frequency:.8,armor:0,fireResist:.75,iceResist:.75,lightningResist:.75,poisonResist:.75,critChance:.05,blockChance:0,regen:0,leech:0})},
    burst:{name:'高爆发敌人',value:actor({hp:3800,physicalMin:250,physicalMax:300,frequency:1.3,armor:60,critChance:.2,critBonus:1,blockChance:0,regen:0,leech:0})}
  };
  function example(){const baseline={version:1,rules:{timeout:45,armorK:100},player:clone(PLAYER),enemy:clone(ENEMIES.armor.value)};
    const candidate=clone(baseline);candidate.player.physicalMin-=80;candidate.player.physicalMax-=80;candidate.player.fire+=80;
    return {baseline,candidate,seed:20261029,trials:300,format:'multi-battle-v1'};}
  function validate(cfg){
    if(!cfg||cfg.version!==1)throw Error('配置版本不支持，请导入本工具导出的JSON。');
    if(!cfg.rules||Object.keys(cfg.rules).some(k=>!['timeout','armorK'].includes(k)))throw Error('战斗规则包含不支持的字段。');
    if(!Number.isFinite(cfg.rules.timeout)||cfg.rules.timeout<1||cfg.rules.timeout>120)throw Error('战斗限时须为1—120秒。');
    if(!Number.isFinite(cfg.rules.armorK)||cfg.rules.armorK<1||cfg.rules.armorK>10000)throw Error('护甲尺度K须为1—10000。');
    for(const side of ['player','enemy']){
      const a=cfg[side],title=side==='player'?'角色':'敌人';
      if(!a||Object.keys(a).some(k=>!FIELDS.some(f=>f[0]===k)))throw Error(title+'属性包含不支持的字段。');
      for(const [key,label,min,max] of FIELDS)if(typeof a[key]!=='number'||!Number.isFinite(a[key])||a[key]<min||a[key]>max)throw Error(`${title}的${label}须在${PERCENT_FIELDS.has(key)?min*100:min}—${PERCENT_FIELDS.has(key)?max*100:max}${PERCENT_FIELDS.has(key)?'%':''}之间。`);
      if(a.physicalMin>a.physicalMax)throw Error(title+'最小物理伤害不能大于最大物理伤害。');
    }
    return cfg;
  }
  function validateOptions(seed,trials){if(!Number.isInteger(seed)||seed<1||seed>0xffffffff)throw Error('随机种子须为1—4294967295的整数。');if(!Number.isInteger(trials)||trials<1||trials>1000)throw Error('重复场数须为1—1000的整数。');}
  function rng(seed){let state=seed>>>0;return ()=>{let x=state;x^=x<<13;x^=x>>>17;x^=x<<5;state=x>>>0;return state/4294967296;};}
  function seedAt(seed,i){if(i===0)return seed>>>0;let x=(seed+Math.imul(i,0x9e3779b9))>>>0;x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>15))>>>0||1;}
  function strike(attacker,defender,rules,rolls){
    const raw=zero();raw.physical=attacker.physicalMin+(attacker.physicalMax-attacker.physicalMin)*rolls[0];
    for(const k of TYPES.slice(1))raw[k]=attacker[k];
    const critChance=Math.max(0,attacker.critChance-defender.critAvoid),critical=rolls[1]<critChance;
    const critMultiplier=critical?1+Math.max(0,attacker.critBonus-defender.critBonusReduction):1;
    const boosted=zero(),mitigated=zero(),final=zero();
    const effectiveArmor=Math.max(0,defender.armor*(1-attacker.percentPen)-attacker.flatPen),armorFactor=rules.armorK/(rules.armorK+effectiveArmor);
    const blocked=rolls[2]<defender.blockChance,blockFactor=blocked?1-defender.blockReduction:1;
    for(const k of TYPES){boosted[k]=raw[k]*(1+attacker[k+'Bonus'])*critMultiplier;mitigated[k]=boosted[k]*(k==='physical'?armorFactor:1)*(1-defender[k+'Resist']);final[k]=mitigated[k]*blockFactor;}
    return {raw,boosted,mitigated,final,critical,critChance,critMultiplier,blocked,effectiveArmor,armorFactor,attempted:sum(final),blockPrevented:sum(mitigated)-sum(final)};
  }
  function totals(){return {attacks:0,criticals:0,blocksTaken:0,boosted:zero(),mitigated:zero(),dealt:zero(),damage:0,received:0,blockPrevented:0,leech:0,regen:0,healingWaste:0};}
  function fight(cfg,seed=1,record=true){
    validate(cfg);validateOptions(seed,1);
    const people=[cfg.player,cfg.enemy],hp=[cfg.player.hp,cfg.enemy.hp],rands=[rng(seedAt(seed,1)),rng(seedAt(seed,2))],counts=[0,0],total=[totals(),totals()],events=[],timeline=[{time:0,playerHp:hp[0],enemyHp:hp[1]}];
    let time=0,regenTick=1,outcome='timeout',steps=0;
    while(time<cfg.rules.timeout-1e-10){
      if(++steps>10000)throw Error('事件数量超出安全范围，请降低攻速或限时。');
      time=Math.min((counts[0]+1)/people[0].frequency,(counts[1]+1)/people[1].frequency,regenTick,cfg.rules.timeout);
      const pending=[],heal=[0,0],appliedHeal=[0,0],at=[];
      for(let side=0;side<2;side++)if(Math.abs((counts[side]+1)/people[side].frequency-time)<1e-9){
        const rolls=[rands[side](),rands[side](),rands[side]()],hit=strike(people[side],people[1-side],cfg.rules,rolls);
        counts[side]++;total[side].attacks++;total[side].criticals+=hit.critical?1:0;total[1-side].blocksTaken+=hit.blocked?1:0;
        const actual=Math.min(hp[1-side],hit.attempted),share=hit.attempted>0?actual/hit.attempted:0;
        for(const k of TYPES){total[side].boosted[k]+=hit.boosted[k];total[side].mitigated[k]+=hit.mitigated[k];total[side].dealt[k]+=hit.final[k]*share;}
        total[side].damage+=actual;total[1-side].received+=actual;total[1-side].blockPrevented+=hit.blockPrevented;
        heal[side]=actual*people[side].leech*(1-people[1-side].leechResist);
        pending.push({side,actual,hit});
      }
      // Simultaneous attacks use pre-group health; neither side gets a first-move advantage.
      for(const p of pending)hp[1-p.side]=Math.max(0,hp[1-p.side]-p.actual);
      for(let side=0;side<2;side++){
        const gained=hp[side]>0?Math.min(people[side].hp-hp[side],heal[side]):0;
        hp[side]+=gained;appliedHeal[side]=gained;total[side].leech+=gained;total[side].healingWaste+=heal[side]-gained;
      }
      for(const p of pending)if(record)at.push({kind:'attack',time,side:p.side,...p.hit,actual:p.actual,leechRequested:heal[p.side],leechApplied:appliedHeal[p.side]});
      if(Math.abs(time-regenTick)<1e-9){
        regenTick++;
        for(let side=0;side<2;side++)if(hp[side]>0&&people[side].regen>0){const amount=Math.min(people[side].hp-hp[side],people[side].regen);hp[side]+=amount;total[side].regen+=amount;total[side].healingWaste+=people[side].regen-amount;if(record&&amount>0)at.push({kind:'regen',time,side,actual:amount});}
      }
      if(record){for(const e of at)events.push({...e,playerHp:hp[0],enemyHp:hp[1],step:timeline.length});timeline.push({time,playerHp:hp[0],enemyHp:hp[1]});}
      if(hp[0]<=0||hp[1]<=0){outcome=hp[0]<=0&&hp[1]<=0?'draw':hp[1]<=0?'win':'death';break;}
    }
    return {outcome,time,playerHp:hp[0],enemyHp:hp[1],total,events,timeline,seed};
  }
  function summary(results){
    const n=results.length,wins=results.filter(r=>r.outcome==='win').map(r=>r.time).sort((a,b)=>a-b),sumKey=k=>results.reduce((a,r)=>a+(r.outcome===k?1:0),0);
    if(!n)throw Error('没有可汇总的战斗。');
    const mean=k=>results.reduce((a,r)=>a+r[k],0)/n,p=wins.length/n,z=1.95996398454,den=1+z*z/n,mid=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
    return {n,wins:wins.length,deaths:sumKey('death'),timeouts:sumKey('timeout'),draws:sumKey('draw'),winRate:p,winLow:Math.max(0,mid-half),winHigh:Math.min(1,mid+half),meanWinTime:wins.length?wins.reduce((a,b)=>a+b,0)/wins.length:null,p90WinTime:wins.length?wins[Math.ceil(wins.length*.9)-1]:null,meanEndTime:mean('time'),meanPlayerHp:mean('playerHp'),meanEnemyHp:mean('enemyHp'),meanDealt:results.reduce((a,r)=>a+r.total[0].damage,0)/n};
  }
  function batch(cfg,trials,seed){validate(cfg);validateOptions(seed,trials);return summary(Array.from({length:trials},(_,i)=>fight(cfg,seedAt(seed,i),false)));}
  function differences(a,b){const rows=[];for(const side of ['player','enemy'])for(const [key,label] of FIELDS)if(a[side][key]!==b[side][key])rows.push({side,label,key,before:a[side][key],after:b[side][key]});for(const key of ['timeout','armorK'])if(a.rules[key]!==b.rules[key])rows.push({side:'rules',label:key==='timeout'?'战斗限时':'护甲尺度K',key,before:a.rules[key],after:b.rules[key]});return rows;}
  function diagnose(result,cfg){const p=result.total[0],notes=[];
    if(result.outcome==='win')notes.push(`角色在${result.time.toFixed(2)}秒击败敌人；这是一场固定种子战斗，仍需查看重复结果。`);
    if(result.outcome==='timeout')notes.push(`到${cfg.rules.timeout}秒双方仍存活，敌人剩余${(result.enemyHp/cfg.enemy.hp*100).toFixed(1)}%生命。本场受限于有效输出；回复或格挡不会直接提高伤害。`);
    if(result.outcome==='death')notes.push(`角色在${result.time.toFixed(2)}秒死亡，敌人剩余${(result.enemyHp/cfg.enemy.hp*100).toFixed(1)}%生命。需比较提高生存与提前击杀两条路线，不能仅凭单场认定最优属性。`);
    if(result.outcome==='draw')notes.push('双方在同一时刻死亡，计为同归于尽，不计胜利。');
    const phys=p.boosted.physical,post=p.mitigated.physical;if(phys>0)notes.push(`物理伤害经护甲与物理抗性后保留${(post/phys*100).toFixed(1)}%（尚未扣格挡与末击溢出）。`);
    for(const k of TYPES.slice(1))if(p.boosted[k]>0&&cfg.enemy[k+'Resist']>=.5)notes.push(`敌人${TYPE_NAMES[k]}抗性为${(cfg.enemy[k+'Resist']*100).toFixed(0)}%，当前${TYPE_NAMES[k]}伤害在格挡前被抵消相应比例。`);
    notes.push(`本场实际回复${(p.regen+p.leech).toFixed(1)}生命；满血溢出或死亡时未生效的治疗共${p.healingWaste.toFixed(1)}。`);
    return notes;
  }
  function csv(headers,rows){const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return '\uFEFF'+headers.map(quote).join(',')+'\r\n'+rows.map(r=>headers.map(k=>quote(r[k])).join(',')).join('\r\n')+'\r\n';}
  return {TYPES,TYPE_NAMES,FIELDS,PERCENT_FIELDS,ENEMIES,PLAYER,actor,clone,example,validate,validateOptions,rng,seedAt,strike,fight,batch,summary,differences,diagnose,csv};
});
