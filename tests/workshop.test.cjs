'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Core = require('../source/connected-core/一体化核心.cjs');
const Meridian = require('../source/connected-core/子午线.cjs');
const {ruins} = require('../source/connected-core/示例.cjs');
const ice = require('../source/connected-core/冰霜手算案例.json');
const q = Core.rules.q;
const halfSeconds = ticks => q(ticks).div(q(2));
const credits = quarters => q(quarters).div(q(4));
const source = name => fs.readFileSync(path.join(__dirname,'../source',name),'utf8');

function incomeReference({slots, budget, cap, minimum, enabled, mode, period, first, round}) {
  const steps = Array.from({length:budget+1}, () => ({base:0, returning:0}));
  let simulated = 0;
  for (const [i, {start, end}] of slots.entries()) {
    const next = slots[i+1]?.start ?? budget;
    const allowed = Math.min(next-end, cap);
    const earnsOffline = enabled && mode !== 'on_return' && (mode !== 'resume_cadence' || next-end >= minimum);
    const stop = end + (earnsOffline ? allowed : 0);
    if (enabled && mode === 'on_return' && i+1 < slots.length && allowed > 0 && allowed >= minimum) {
      const earned = allowed * 5;
      steps[next].returning = round ? earned - earned % 4 : earned;
    }
    for (let tick = start; tick <= stop; tick++) {
      if (mode === 'resume_cadence' && tick === start && tick !== 0) continue;
      if (mode === 'resume_cadence' && tick !== 0) simulated++;
      const phase = mode === 'resume_cadence' ? simulated : tick;
      if (period) {
        if (phase >= first && (phase-first) % period === 0) steps[tick].base = period * 6;
      } else if (tick > start) steps[tick].base = 6;
    }
  }
  return steps;
}

function fundingTime(steps, start, gap, period) {
  for (let tick = start+1; tick < steps.length; tick++) {
    const {base, returning} = steps[tick];
    if (gap <= base) return period ? halfSeconds(tick) : halfSeconds(tick-1).add(q(gap).div(q(12)));
    gap -= base;
    if (gap <= returning) return halfSeconds(tick);
    gap -= returning;
  }
  return null;
}

test('半秒网格逐项核对离线发奖、首笔到账和资金等待', t => {
  let scenarios = 0;
  for (const [firstGap, secondGap] of [[0,0],[0,4],[1,3],[3,1],[4,0],[4,4]])
    for (const cap of [0,1,3,6])
      for (const minimum of [0,1,4])
        for (const enabled of [false,true])
          for (const mode of ['accrual','resume_cadence','on_return'])
            for (const [period,first] of [[0,0],[2,0],[2,1],[3,0],[3,1],[3,3]])
              for (const round of mode==='on_return'?[false,true]:[false]) {
                const secondStart = 3 + firstGap;
                const thirdStart = secondStart + 2 + secondGap;
                const slots = [{start:0,end:3},{start:secondStart,end:secondStart+2},{start:thirdStart,end:thirdStart+2}];
                const budget = thirdStart + 5;
                const settings = {slots,budget,cap,minimum,enabled,mode,period,first,round};
                const expected = incomeReference(settings);
                const context = JSON.stringify(settings);
                const game = {
                  economy:{
                    incomePerSecond:'3',
                    payout:period?{mode:'interval',intervalSeconds:halfSeconds(period).toString(),firstAtSeconds:halfSeconds(first).toString()}:{mode:'continuous'},
                    offlinePayout:{mode,minimumSeconds:halfSeconds(minimum).toString(),ratePerSecond:'2.5',rounding:round?'floor':'none'},
                  },
                  behavior:{mode:'visits'},
                  ruleLibrary:{enabled:true,behavior:{offlineIncome:enabled}},
                };
                const windows = slots.map(({start,end})=>({start:halfSeconds(start),end:halfSeconds(end),earnUntil:halfSeconds(end+cap)}));
                const clock = Core.income.create(game,windows,halfSeconds(budget));
                assert.equal(clock.initial.toString(),credits(expected[0].base).toString(),context);
                for (let tick=1;tick<=budget;tick++) {
                  const from=halfSeconds(tick-1),to=halfSeconds(tick),{base,returning}=expected[tick];
                  assert.equal(clock.between(from,to).toString(),credits(base+returning).toString(),context);
                  assert.equal(clock.between(from,to,false).toString(),credits(returning).toString(),context);
                }
                for (const start of [0,3,secondStart,thirdStart,budget]) {
                  const from=halfSeconds(start),to=halfSeconds(budget);
                  const remaining=expected.slice(start+1);
                  assert.equal(clock.between(from,to).toString(),credits(remaining.reduce((n,x)=>n+x.base+x.returning,0)).toString(),context);
                  const points=remaining.flatMap((x,index)=>period&&x.base?[halfSeconds(start+index+1).toString()]:[]);
                  assert.deepEqual(clock.points(from,to).map(x=>x.toString()),points,context);
                  for (const gap of [1,5,12,37]) {
                    const result=clock.affordable(from,to,credits(gap));
                    assert.equal(result?.toString(),fundingTime(expected,start,gap,period)?.toString(),context);
                  }
                }
                scenarios++;
              }
  t.diagnostic(scenarios+' 组条件，逐段检查收入与最早可购买时间');
});

test('升级顺序按可用项目循环，空顺序使用已启用项目', () => {
  for (const rules of [false,true]) {
    const game = structuredClone(ice);
    const first = {...game.upgrades[0],id:'first',enabled:true,maxLevel:2,costBase:'4',costStep:'0'};
    const second = {...first,id:'second'};
    const off = {...first,id:'off',enabled:false};
    game.upgrades = [off,first,second];
    game.economy.initialCoins = '100';
    if (rules) game.ruleLibrary = Core.rules.initial(game);
    for (const order of [['off','first','second'],['off'],[]]) {
      game.strategy.order=order;
      const run=Core.run(game,42);
      assert.deepEqual(run.purchases.map(row=>row.id),['first','second','first','second']);
      Core.assertResultTrace(run);
    }
  }
});

test('十进制回访时间在日程边界保持精确', () => {
  const game=ruins();
  game.behavior.visitHours=[0,7.1,12.2,18.3];
  assert.deepEqual(Core.schedule(Core.compile(game).behavior,q(86400)).map(slot=>slot.start.toString()),
    ['0','25560','43920','65880']);
  game.behavior.visitHours=[0,7.1,7.2];
  game.behavior.sessionMinutes='6';
  assert.equal(Core.preflight(game).ready,true);
  game.behavior.sessionMinutes='6.001';
  assert.match(Core.preflight(game).issues[0].detail,/不能重叠/);
});

test('事件账本与旧版、新版结果互证，并拒绝篡改后的余额、时点和分项', () => {
  for (const game of [ruins(),structuredClone(ice)]) {
    const result = Core.run(game,42);
    assert.ok(Core.verifyLedger(result));
    Core.assertResultTrace(JSON.parse(JSON.stringify(result)));
    Core.chartData(result);
    assert.ok(result.stages.filter(row=>row.arrival!==null).every(row=>Core.diagnose(result,row.stage).exactTimeAccounted));
    const changed = structuredClone(result);
    changed.events[0].balance = '123456789';
    assert.ok(Core.verifyLedger(changed));
    assert.throws(()=>Core.assertResultTrace(changed),/结算后余额/);
    const wrongTime = structuredClone(result);
    wrongTime.stages[0].passedAt = '123456789';
    assert.throws(()=>Core.assertResultTrace(wrongTime),/第1关的时间汇总/);
    const wrongBattle = structuredClone(result);
    wrongBattle.battles[0].enemyHp = '123456789';
    assert.throws(()=>Core.assertResultTrace(wrongBattle),/分项记录不一致/);
  }
});

test('章末门槛、固定奖章补给与浮点校正对照原版路线', () => {
  const settings={difficulty:'frontier',protocol:'aegis',strategy:'order',auto:true,offline:true,seed:42,physical:12,supplyRate:1};
  const baseline=Meridian.simulate(settings);
  assert.equal(baseline.report.elapsed,454);
  assert.deepEqual(baseline.claimed.map(x=>[x.stage,x.payoutBefore,x.payoutAfter]),[[4,3,8],[8,8,14],[12,14,14]]);
  const paused=Meridian.simulate(settings,{autoMedals:false});
  assert.equal(paused.medalDue,4);
  assert.equal(paused.report.cleared.length,4);
  const fixed=Meridian.simulate(settings,{correctResidual:true});
  assert.equal(fixed.report.elapsed,453);
  const audited=Meridian.inspect({...fixed.report,workshopSimulation:fixed.options});
  assert.equal(audited.evidence.differenceCount,0);
  assert.deepEqual(audited.comparison.different,[]);
  const wrong=structuredClone(baseline.report);
  wrong.battles[0].turns[0].damage++;
  wrong.purchases[0].cost++;
  const damaged=Meridian.audit(wrong);
  assert.ok(damaged.discrepancies.some(row=>row.label.endsWith(' damage')));
  assert.ok(damaged.discrepancies.some(row=>row.label.endsWith('价格')));
});

test('5,000 项能复用字段对应，宽 JSON 在展开前检查大小', async () => {
  const intake=vm.runInNewContext(source('connected-intake.js')+'\nConnectedIntake',{ConnectedCore:Core,structuredClone,TextDecoder,Blob});
  const rows=[['对象','属性','数值'],...Array.from({length:5000},(_,i)=>['角色','项目'+i,'7'])];
  const items=intake.entries([{name:'新表',rows}]);
  const saved=Object.fromEntries(items.map((item,i)=>['旧表|'+item.owner+'|'+item.name,{target:i===2?'player.hp':'',unit:'number'}]));
  const targets=intake.targets(ice),mappings=intake.suggestAll(items,targets,saved);
  assert.equal(mappings.filter(x=>x.reused).length,5000);
  assert.equal(intake.apply(ice,targets,mappings,items).game.player.hp,'7');
  assert.throws(()=>intake.entries([{name:'超过上限',rows:[...rows,rows[1]]}]),/5000项/);
  const sparse=Array.from({length:300},(_,i)=>({['列'+i]:i}));
  assert.throws(()=>intake.fromJSON(sparse),/50000个单元格/);
  assert.equal(intake.entries(intake.fromJSON([{对象:'角色',属性:'生命',数值:80}]))[0].value,80);
  let read=false;
  const oversize={name:'大文件.json',size:256*1024*1024+1,text(){read=true;return '{}';}};
  await assert.rejects(()=>intake.readFile(oversize),/超过256MB/);
  assert.equal(read,false);
  const data={text:'x'.repeat(1024*1024+20)};
  const exported=intake.exportJSON(data);
  assert.equal(exported.size,JSON.stringify(data).length);
  const roundTrip=await intake.readFile(Object.assign(exported,{name:'结果.json'}));
  assert.equal(roundTrip.data.text,data.text);

});

test('大图形限制绘制点，查询和记录分页保留精确明细', () => {
  const elements=new Map();
  const by=id=>{
    if(!elements.has(id))elements.set(id,{clientWidth:700,setAttribute(){},querySelector:selector=>by(id+selector)});
    return elements.get(id);
  };
  const charts=vm.runInNewContext(source('connected-charts.js')+'\nConnectedCharts',{ConnectedCore:Core,document:{getElementById:by}});
  const points=Array.from({length:10001},(_,i)=>({time:String(i),value:String(i===5432?99999:i%300),label:'记录'+i,kind:'purchase'}));
  charts.render('chart',[{name:'测试',points}],{title:'钱包',yLabel:'金币'});
  assert.ok((by('chart').innerHTML.match(/<circle /g)||[]).length<=2001);
  assert.match(by('chart').innerHTML,/记录5432/);
  assert.match(by('chart').innerHTML,/max="10000"/);
  charts.select('chart',9999);
  assert.match(by('chart-value').textContent,/记录9999/);
  const app=source('connected-app.js');
  const render=vm.runInNewContext(app.slice(app.indexOf(' function renderRecordPage('),app.indexOf(' function renderRecords('))+'\nrenderRecordPage',{by});
  render(points.slice(0,201),'rows','pager',(row,index)=>'<p>'+index+'</p>');
  assert.match(by('rows').innerHTML,/<p>99<\/p>$/);
  const next={target:{closest:()=>({dataset:{recordPage:'1'}})}};
  by('pager').onclick(next);
  by('pager').onclick(next);
  assert.equal(by('rows').innerHTML,'<p>200</p>');
  assert.equal(by('pager').querySelector('[data-record-page="1"]').disabled,true);
});

test('重复消耗同一状态时在计算前提示规则错误', () => {
  const game=structuredClone(ice),rules=game.ruleLibrary=Core.rules.initial(game);
  const state={effect:'marker',owner:'player',target:'target',applyAt:'start',duration:'2',maxStacks:1,refresh:'refresh'};
  rules.states=[{...state,id:'wet'},{...state,id:'cold'}];
  rules.reactions=[{id:'freeze',effect:'freeze',duration:'1',states:['wet','cold'],consume:['wet','wet']}];
  const invalid=Core.preflight(game);
  assert.equal(invalid.ready,false);
  assert.match(invalid.issues[0].detail,/不重复的消耗状态/);
  rules.reactions[0].consume=['wet'];
  assert.equal(Core.preflight(game).ready,true);
  Core.assertResultTrace(Core.run(game));
});
