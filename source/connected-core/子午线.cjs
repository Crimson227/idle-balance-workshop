'use strict';

const installers = [
  require('./meridian/engine.cjs'), require('./meridian/workbench.cjs'),
  require('./meridian/Balance.cjs'), require('./meridian/Combat.cjs'), require('./meridian/Chapter.cjs'),
];
const FORMAT = 'meridian-expedition-record-v1';
const PROTOCOLS = ['stable', 'pulse', 'aegis', 'toxin', 'prism'];
const DIFFICULTIES = ['standard', 'frontier'];
const STRATEGIES = ['order', 'cheapest', 'damage_first', 'survival_first'];
const UPGRADE_IDS = ['pulse', 'hull', 'coil'];
const STAT_FIELDS = ['hp','physical','fire','ice','lightning','poison','armor','frequency',
  'critChance','critBonus','flatPen','percentPen','block','leech','regen','shield','dot'];
const TURN_FIELDS = ['damage','taken','physical','fire','ice','lightning','poison','dot','absorbed',
  'healed','playerHp','enemyHp','reaction','blocked','intercepted','repair','heat','chill'];
const WALLET_FIELDS = ['initial','passive','rewards','spent','balance'];
const MAX_SECONDS = 86400;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const integer = (x, max, min = 0) => Number.isSafeInteger(x) && x >= min && x <= max;
const residual = (hp, maxHp) => hp > 0 && hp <= 8 * Number.EPSILON * maxHp;
const copy = structuredClone;

function createGame(correctResidual = false) {
  const scope = {structuredClone, zeroResidual: correctResidual ? residual : () => false};
  for (const install of installers) install(scope, undefined);
  return {game: scope.chapter, engine: scope.Meridian, balance: scope.MeridianBalance, combat: scope.MeridianCombat};
}

function validateSettings({difficulty, protocol, strategy, auto, offline, speed = 1, seed, physical, supplyRate}) {
  if (!DIFFICULTIES.includes(difficulty) || !PROTOCOLS.includes(protocol) || !STRATEGIES.includes(strategy) ||
      typeof auto !== 'boolean' || typeof offline !== 'boolean' || ![1,2,4].includes(speed) ||
      !integer(seed, 0xffffffff) || typeof physical !== 'number' || !integer(physical * 4, 320) || !integer(supplyRate, 9))
    throw Error('子午线 3.0 的难度、协议、购买策略、种子或初始数值无效。');
}

function settingsOf(report) {
  const {difficulty,protocol,strategy,auto,offline,speed} = report.settings;
  const {physical,supplyRate} = report.tuning;
  return {difficulty,protocol,strategy,auto,offline,speed,physical,supplyRate,seed:report.seed};
}

function validateReport(data) {
  if (!isObject(data) || data.format !== FORMAT || data.version !== 1 || data.balanceVersion !== 3)
    throw Error('请选择《子午线·三章远征》3.0 导出的原版战报。');
  if (data.workshopSimulation !== undefined && !isObject(data.workshopSimulation))
    throw Error('工坊模拟战报的设置无效。');
  if (!isObject(data.settings) || !isObject(data.tuning)) throw Error('子午线战报缺少开局设置。');
  validateSettings(settingsOf(data));
  if (!integer(data.elapsed, Number.MAX_SAFE_INTEGER) || typeof data.completed !== 'boolean' ||
      typeof data.chapterRewardClaimed !== 'boolean' || !integer(data.failures, data.elapsed) ||
      !integer(data.farmingWins, data.elapsed) || !Array.isArray(data.medals) ||
      !isObject(data.equipment) || !isObject(data.levels) || !isObject(data.wallet) ||
      !WALLET_FIELDS.every(field => integer(data.wallet[field], Number.MAX_SAFE_INTEGER)))
    throw Error('子午线战报的进度或钱包字段无效。');
  if (!Array.isArray(data.cleared) || data.cleared.length > 12 ||
      data.cleared.some((row, i) => !row || row.stage !== i+1 || !integer(row.time, data.elapsed, 1) ||
        !integer(row.reward, 1000)) ||
      !Array.isArray(data.purchases) || data.purchases.length > 36 ||
      data.purchases.some(row => !row || !UPGRADE_IDS.includes(row.id) ||
        !integer(row.stage, 13, 1) || !integer(row.level, 12, 1) || !integer(row.time, data.elapsed) ||
        !['cost','balance','balanceBefore'].every(field => integer(row[field], Number.MAX_SAFE_INTEGER))) ||
      !Array.isArray(data.battles) || data.battles.length > 100)
    throw Error('子午线战报的过关、购买或战斗列表无效。');
  for (const [index, battle] of data.battles.entries()) {
    if (!battle || ![undefined,2,3].includes(battle.balanceVersion) || !integer(battle.stage, 12, 1) ||
        !DIFFICULTIES.includes(battle.difficulty) || !PROTOCOLS.includes(battle.protocol) ||
        !integer(battle.age, 45, 1) || !integer(battle.started, data.elapsed) ||
        !integer(battle.end, data.elapsed) || !isObject(battle.stats) ||
        !STAT_FIELDS.every(field => Number.isFinite(battle.stats[field]) && battle.stats[field] >= 0 && battle.stats[field] <= 1e6) ||
        !Array.isArray(battle.turns) || battle.turns.length !== battle.age ||
        battle.balanceVersion === 3 && battle.turns.some(turn => !turn || !TURN_FIELDS.every(field => Number.isFinite(turn[field])) ||
          !Array.isArray(turn.hits) || turn.hits.length > 2 ||
          turn.hits.some(hit => !hit || typeof hit.critical !== 'boolean' || !Number.isFinite(hit.damage)) ||
          !Array.isArray(turn.notes) || turn.notes.length > 12 || turn.notes.some(note => typeof note !== 'string' || note.length > 100)))
      throw Error('子午线战报第'+(index+1)+'场的战斗数据无效。');
  }
  return data;
}

function equal(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b,k) && equal(a[k],b[k]));
}

function audit(input) {
  const report = validateReport(input);
  const {engine,balance,combat} = createGame(report.workshopSimulation?.correctResidual === true);
  const discrepancies = [], floating = [], mechanics = {};
  let differenceCount = 0, turns = 0;
  const check = (label, actual, expected) => {
    if (equal(actual,expected)) return;
    differenceCount++;
    if (discrepancies.length < 50) discrepancies.push({label, actual, expected});
  };
  const wallet = report.wallet;
  check('初始金币', wallet.initial, engine.START_CREDITS);
  check('金币余额', wallet.balance, wallet.initial + wallet.passive + wallet.rewards - wallet.spent);
  check('购买总花费', wallet.spent, report.purchases.reduce((sum,row) => sum + row.cost,0));
  const legacyFights = report.battles.filter(fight => fight.balanceVersion !== 3).length;
  const levels = Object.fromEntries(UPGRADE_IDS.map(id => [id,0]));
  for (const [index,row] of report.purchases.entries()) {
    const upgrade = balance.upgrades.find(item => item.id === row.id), prefix = '第'+(index+1)+'笔强化 ';
    const level = ++levels[row.id];
    check(prefix+'等级', row.level, level);
    if (!legacyFights) check(prefix+'价格', row.cost, balance.price(upgrade, level-1));
    check(prefix+'已解锁', row.stage >= upgrade.stage && level <= upgrade.max, true);
    check(prefix+'余额', row.balance, row.balanceBefore - row.cost);
  }
  check('最终强化等级', report.levels, levels);
  check('全关通关状态', report.completed, report.cleared.length === 12);
  const medals = report.medals;
  check('已领奖章', medals, [4,8,12].filter(stage => medals.includes(stage) && stage <= report.cleared.length));
  check('最终奖章状态', report.chapterRewardClaimed, medals.includes(12));
  if (!legacyFights) {
    for (const clear of report.cleared) check('第'+clear.stage+'关首通奖励',clear.reward,balance.sector(clear.stage,report.settings.difficulty).bounty);
  }
  const completeHistory = report.battles.length === report.failures + report.cleared.length + report.farmingWins;
  if (completeHistory) {
    check('战斗奖励总额', wallet.rewards, report.battles.reduce((sum,fight) => sum + (fight.reward ?? 0),0));
  }
  for (const [index, fight] of report.battles.entries()) {
    if (fight.balanceVersion !== 3) continue;
    const target = balance.sector(fight.stage,fight.difficulty);
    const replay = {...fight, combat:combat.initial(), playerHp:fight.stats.hp, playerShield:fight.stats.shield, enemyHp:target.hp};
    const prefix = '第'+fight.stage+'关 / 战斗'+(index+1);
    check(prefix+' 敌人最大生命',fight.maxEnemyHp,target.hp);
    let shouldStop = false;
    for (const [step,turn] of fight.turns.entries()) {
      if (shouldStop) {check(prefix+' 结束后继续结算', step+1, null); break;}
      const age = step+1;
      replay.age = age;
      let hit = 0;
      const modeled = combat.turn(replay,target,() => turn.hits[hit++]?.critical ? 0 : 1);
      turns++;
      for (const field of Object.keys(modeled)) check(prefix+' 第'+age+'秒 '+field,turn[field],modeled[field]);
      for (const note of modeled.notes) mechanics[note] = (mechanics[note] ?? 0) + 1;
      if (residual(replay.enemyHp,target.hp) && !floating.some(row => row.battle === index+1)) {
        floating.push({stage:fight.stage,battle:index+1,turn:age,enemyHp:replay.enemyHp,
          recordedEnd:fight.age,extraCounterDamage:fight.turns.slice(age).reduce((sum,next) => sum + next.taken,0)});
      }
      shouldStop = replay.playerHp <= 0 || replay.enemyHp <= 0 || age === engine.TIMEOUT;
    }
    const outcome = replay.playerHp <= 0 ? (replay.enemyHp <= 0 ? 'draw' : 'death') : replay.enemyHp <= 0 ? 'win' : 'timeout';
    check(prefix+' 已结束',shouldStop,true);
    check(prefix+' 胜负',fight.outcome,outcome);
    check(prefix+' 残余敌方生命',fight.enemyHp,replay.enemyHp);
    check(prefix+' 残余角色生命',fight.playerHp,replay.playerHp);
    check(prefix+' 角色剩余护盾',fight.playerShield,replay.playerShield);
    check(prefix+' 战斗状态',fight.combat,replay.combat);
    check(prefix+' 金币奖励',fight.reward,outcome === 'win' ? (fight.training ? target.repeatBounty : target.bounty) : 0);
  }
  return {battles:report.battles.length-legacyFights,legacyFights,turns,purchases:report.purchases.length,completeHistory,
    differenceCount,discrepancies,floating,mechanics};
}

const ACTIONS = {medal:'medal', equip:'equip', craft:'craft', farm:'farm', route:'returnToRoute', buy:'buy', away:'resume'};
function simulate(settings, {limitSeconds = 1800, autoMedals = true, correctResidual = false, actions = []} = {}) {
  validateSettings(settings);
  if (!integer(limitSeconds,MAX_SECONDS,1) || typeof autoMedals !== 'boolean' || typeof correctResidual !== 'boolean' ||
      !Array.isArray(actions) || actions.length > 500) throw Error('观察时长须为 1 至 86400 秒，操作最多 500 项。');
  const {game} = createGame(correctResidual);
  if (!game.reset({...settings, automatic:settings.auto})) throw Error('无法按这组子午线设置开局。');
  const claimed = [];
  let wallSeconds = 0, completionWallSeconds = null;
  function recordCompletion() {
    if (completionWallSeconds === null && game.report().completed) completionWallSeconds = wallSeconds;
  }
  function claim() {
    const before = JSON.parse(game.view());
    if (!game.medal()) return false;
    const after = JSON.parse(game.view());
    claimed.push({stage:before.medalDue,elapsed:before.elapsed,wallSeconds,payoutBefore:before.payout,payoutAfter:after.payout});
    return true;
  }
  function online(until) {
    while (wallSeconds < until) {
      if (autoMedals) claim();
      const elapsed = game.advance(until-wallSeconds);
      wallSeconds += elapsed;
      recordCompletion();
      if (elapsed > 0) continue;
      if (game.report().completed) return;
      wallSeconds = until;
    }
    if (autoMedals) claim();
  }
  for (const [i,step] of actions.entries()) {
    if (!isObject(step) || !integer(step.at,limitSeconds,wallSeconds) || !Object.hasOwn(ACTIONS,step.action) ||
        (step.action === 'farm' && !integer(step.value,12,1)) ||
        (step.action === 'away' && !integer(step.value,limitSeconds-step.at,1)))
      throw Error('第'+(i+1)+'项操作的时点、类型、关卡或离线时长无效。');
    online(step.at);
    wallSeconds = step.at;
    const applied = step.action === 'medal' ? claim() : game[ACTIONS[step.action]](step.value);
    if (applied === false) throw Error('第'+(i+1)+'项操作在当前进度不可执行。');
    if (step.action === 'away') wallSeconds += step.value;
    recordCompletion();
  }
  online(limitSeconds);
  const view = JSON.parse(game.view());
  const report = copy(game.report());
  const options = {limitSeconds,autoMedals,correctResidual,actions:copy(actions)};
  return {report,options,wallSeconds,completionWallSeconds,claimed,medalDue:view.medalDue,
    parts:view.parts,crystals:view.crystals,equipment:view.items.filter(item => item.equipped)};
}

function compare(actual, simulated) {
  const fields = ['elapsed','completed','cleared','medals','chapterRewardClaimed','wallet','levels','failures','purchases','battles','equipment','farmingWins'];
  return {different:fields.filter(field => !equal(actual[field],simulated[field])),
    stages:Array.from({length:12},(_,i) => ({stage:i+1,actual:actual.cleared[i]?.time??null,simulated:simulated.cleared[i]?.time??null}))};
}

function inspect(report) {
  const evidence = audit(report), settings = settingsOf(report);
  const simulation = report.workshopSimulation !== undefined
    ? simulate(settings,report.workshopSimulation)
    : report.elapsed <= MAX_SECONDS && !evidence.legacyFights
    ? simulate(settings,{limitSeconds:Math.max(1,report.elapsed)}) : null;
  return {settings,evidence,simulation,comparison:simulation?compare(report,simulation.report):null};
}

module.exports = {FORMAT,MAX_SECONDS,settingsOf,validateReport,audit,simulate,compare,inspect};
