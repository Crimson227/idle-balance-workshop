'use strict';

// Snapshot of the Meridian 3.0 Mac game, isolated per simulation.
module.exports = function install(globalThis, module) {
'use strict';

(function install(root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.Meridian = engine;
})(globalThis, function createEngine() {
  const VERSION = 1;
  const INCOME = {every: 3, amount: 3};
  const OFFLINE_CAP = 8 * 60 * 60;
  const TIMEOUT = 45;
  const COOLDOWN = 2;
  const START_CREDITS = 16;
  const STRATEGIES = ['order', 'cheapest', 'damage_first', 'survival_first'];
  const protocols = {
    stable: {name: '稳态巡检', detail: '固定伤害，便于复盘每一次结算。', modifiers: {}},
    pulse: {name: '超频脉冲', detail: '25% 概率暴击，暴击伤害提高 50%。', modifiers: {critChance: 0.25}},
    aegis: {name: '屏障阵列', detail: '每场获得 20 点护盾，每秒回复 2 点生命。', modifiers: {shield: 20, regen: 2}},
    toxin: {name: '腐蚀云雾', detail: '开战后第 2、4、6 秒各造成 4 点基础毒伤。', modifiers: {dot: 4}},
    prism: {name: '光谱分流', detail: '五系混合输出，附带穿透、格挡和吸血。', modifiers: {
      fire: 3, ice: 2, lightning: 8, poison: 2, flatPen: 2, percentPen: 0.25, block: 0.25, leech: 0.125}},
  };
  const chapters = ['静默轨道', '回声深井', '子午线核心'];
  const names = ['失联侦察机', '信号拾荒者', '裂隙警戒机', '灰环守卫',
    '深井引导机', '漂移中继器', '失序采矿机', '回声监守者',
    '镜像巡逻队', '暗侧协调器', '核心防卫阵列', '子午线主脑'];
  const sectors = names.map((name, index) => {
    const id = index + 1;
    const boss = id % 4 === 0;
    return {id, name, boss, chapter: Math.floor(index / 4), hp: 42 + 12 * index,
      attack: 7 + 2 * index, armor: 2 + index, resist: {fire: 0.25, ice: 0.5, lightning: 0.25, poison: 0.125},
      bounty: (18 + 7 * index) * (boss ? 2 : 1)};
  });
  const upgrades = [
    {id: 'pulse', name: '脉冲阵列', stat: '物理伤害', field: 'physical', add: 5, cost: 24, step: 14, max: 12, stage: 1, icon: 'pulse'},
    {id: 'hull', name: '复合装甲', stat: '最大生命', field: 'hp', add: 18, cost: 30, step: 16, max: 12, stage: 2, icon: 'hull'},
    {id: 'coil', name: '电弧线圈', stat: '雷电伤害', field: 'lightning', add: 4, cost: 34, step: 18, max: 12, stage: 3, icon: 'coil'},
  ];
  const base = {hp: 82, physical: 12, fire: 0, ice: 0, lightning: 4, poison: 0, armor: 2, frequency: 1,
    critChance: 0, critBonus: 0.5, flatPen: 0, percentPen: 0, block: 0, leech: 0, regen: 0, shield: 0, dot: 0};
  const randomWord = state => {
    let value = state >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return value >>> 0;
  };

  function create({seed = 42, savedAt = Date.now()} = {}) {
    return {version: VERSION, seed: seed >>> 0, random: (seed >>> 0) || 1, savedAt, elapsed: 0,
      credits: START_CREDITS, income: 0, rewards: 0, spent: 0, stage: 1, levels: {pulse: 0, hull: 0, coil: 0},
      pointer: 0, running: false, resumeAt: 0, battle: null, lastBattle: null, cleared: [], fights: [], purchases: [],
      events: [], failures: 0, sequence: 0, tuning: {physical: base.physical, supplyRate: INCOME.amount / INCOME.every},
      settings: {auto: true, strategy: 'order', protocol: 'stable',
        difficulty: 'standard', offline: true, speed: 1}};
  }

  function player(state, rules) {
    const stats = {...base, physical: state.tuning.physical, ...(rules?.modifiers?.[state.settings.protocol] ?? protocols[state.settings.protocol].modifiers)};
    for (const upgrade of rules?.upgrades ?? upgrades) stats[upgrade.field] += state.levels[upgrade.id] * upgrade.add;
    return stats;
  }

  function sector(id, difficulty = 'standard') {
    const target = sectors[id - 1];
    if (!target || difficulty === 'standard') return target;
    return {...target, hp: target.hp + 28 + (id - 1) * 4, attack: target.attack + 4};
  }

  function price(upgrade, level) {
    return upgrade.cost + upgrade.step * level;
  }

  function event(state, kind, data = {}) {
    state.events.push({sequence: ++state.sequence, t: state.elapsed, kind, ...data});
    if (state.events.length > 120) state.events.shift();
  }

  function buy(state, id, automatic = false, allowComplete = false, rules) {
    const upgrade = (rules?.upgrades ?? upgrades).find(item => item.id === id);
    if (!upgrade || (!allowComplete && state.stage > sectors.length) || state.stage < upgrade.stage) return false;
    const level = state.levels[id];
    const cost = (rules?.price ?? price)(upgrade, level);
    if (level >= upgrade.max || state.credits < cost) return false;
    const balanceBefore = state.credits;
    state.credits -= cost;
    state.spent += cost;
    state.levels[id]++;
    const purchase = {time: state.elapsed, stage: state.stage, id, level: level + 1, cost, balanceBefore,
      balance: state.credits, automatic};
    state.purchases.push(purchase);
    event(state, 'purchase', purchase);
    return true;
  }

  function choose(state, rules) {
    const catalog = rules?.upgrades ?? upgrades;
    const options = [];
    for (let i = 0; i < catalog.length; i++) {
      const index = (state.pointer + i) % catalog.length;
      const upgrade = catalog[index];
      const level = state.levels[upgrade.id];
      if (state.stage < upgrade.stage || level >= upgrade.max) continue;
      if (rules?.onlyAffordable && (rules.price ?? price)(upgrade, level) > state.credits) continue;
      options.push({upgrade, index});
    }
    const priority = option => {
      const {upgrade} = option;
      switch (state.settings.strategy) {
        case 'cheapest': return (rules?.price ?? price)(upgrade, state.levels[upgrade.id]);
        case 'damage_first': return Number(upgrade.field === 'hp');
        case 'survival_first': return Number(upgrade.field !== 'hp');
        default: return 0;
      }
    };
    return options.sort((a, b) => priority(a) - priority(b))[0];
  }

  function ready(state, rules) {
    if (state.battle || state.elapsed < state.resumeAt) return;
    const target = rules ? rules.target(state) : sector(state.stage, state.settings.difficulty);
    if (!target) return;
    if (state.settings.auto) {
      for (let selected = choose(state, rules); selected && buy(state, selected.upgrade.id, true, Boolean(rules), rules); selected = choose(state, rules)) {
        state.pointer = (selected.index + 1) % upgrades.length;
      }
    }
    const stats = player(state, rules);
    rules?.equip(stats, state);
    state.battle = {stage: target.id, difficulty: state.settings.difficulty, protocol: state.settings.protocol,
      started: state.elapsed, age: 0, stats, levels: {...state.levels},
      playerHp: stats.hp, playerShield: stats.shield, enemyHp: target.hp, turns: [], income: 0};
    rules?.prepare(state.battle, target, state);
    event(state, 'start', {stage: target.id});
  }

  function originalTurn(state, battle, target) {
    const {stats} = battle;
    let critical = false;
    if (stats.critChance) {
      state.random = randomWord(state.random);
      critical = state.random / 4294967296 < stats.critChance;
    }
    const scale = critical ? 1 + stats.critBonus : 1;
    const armor = Math.max(0, target.armor * (1 - stats.percentPen) - stats.flatPen);
    const physical = Math.max(0, stats.physical * scale - armor);
    const elemental = Object.fromEntries(Object.entries(target.resist).map(([key, resist]) => [key, stats[key] * scale * (1 - resist)]));
    const direct = physical + Object.values(elemental).reduce((sum, value) => sum + value, 0);
    const damage = Math.min(battle.enemyHp, direct);
    battle.enemyHp -= damage;
    const periodic = stats.dot && battle.age <= 6 && battle.age % 2 === 0 ? stats.dot * (1 - target.resist.poison) : 0;
    const dot = Math.min(battle.enemyHp, periodic);
    battle.enemyHp -= dot;
    const returned = battle.age % 2 === 0 ? Math.max(0, target.attack - stats.armor) * (1 - stats.block) : 0;
    const absorbed = Math.min(battle.playerShield, returned);
    battle.playerShield -= absorbed;
    const taken = Math.min(battle.playerHp, returned - absorbed);
    battle.playerHp -= taken;
    const healed = battle.playerHp > 0 ? Math.min(stats.hp - battle.playerHp, damage * stats.leech + stats.regen) : 0;
    battle.playerHp += healed;
    const turn = {time: battle.age, damage, taken, physical, ...elemental, dot, absorbed, healed, critical,
      playerHp: battle.playerHp, enemyHp: battle.enemyHp};
    return turn;
  }

  function resolveTurn(state, rules) {
    const battle = state.battle;
    const target = rules?.combatTarget?.(battle) ?? sector(battle.stage, battle.difficulty);
    battle.age++;
    const turn = rules ? rules.turn(battle, target, () => {
      state.random = randomWord(state.random);
      return state.random / 4294967296;
    }) : originalTurn(state, battle, target);
    battle.turns.push(turn);
    if (turn.critical) event(state, 'critical', {stage: target.id, damage: turn.damage});
    if (battle.playerHp > 0 && battle.enemyHp > 0 && battle.age < TIMEOUT) return;

    const outcome = battle.playerHp <= 0 ? (battle.enemyHp <= 0 ? 'draw' : 'death') : battle.enemyHp <= 0 ? 'win' : 'timeout';
    const reward = outcome === 'win' ? (battle.training ? (target.repeatBounty ?? Math.max(1, Math.floor(target.bounty / 3))) : target.bounty) : 0;
    state.credits += reward;
    state.rewards += reward;
    const result = {...battle, end: state.elapsed, outcome, reward, balance: state.credits};
    state.fights.push(result);
    if (state.fights.length > 100) state.fights.shift();
    state.lastBattle = result;
    state.battle = null;
    state.resumeAt = state.elapsed + COOLDOWN;
    if (outcome === 'win' && !battle.training) {
      state.cleared.push({stage: target.id, time: state.elapsed, reward});
      state.stage++;
      event(state, 'clear', {stage: target.id, reward, age: battle.age});
      if (state.stage > sectors.length) {
        state.running = false;
        event(state, 'complete');
      }
    } else if (outcome !== 'win') {
      state.failures++;
      event(state, 'failure', {stage: target.id, outcome});
    }
    rules?.finished(state, result, target);
  }

  function advance(state, seconds, {away = false, rules} = {}) {
    if (!Number.isFinite(seconds) || seconds < 0 || !state.running) return 0;
    const span = Math.min(Math.floor(seconds), OFFLINE_CAP);
    const allowBattle = !away || state.settings.offline;
    if (allowBattle) ready(state, rules);
    let elapsed = 0;
    for (; elapsed < span && state.running; elapsed++) {
      state.elapsed++;
      if (state.elapsed % INCOME.every === 0) {
        const payout = rules?.payout?.(state) ?? state.tuning.supplyRate * INCOME.every;
        state.credits += payout;
        state.income += payout;
        if (state.battle && allowBattle) state.battle.income += payout;
      }
      if (allowBattle && state.battle) resolveTurn(state, rules);
      if (!allowBattle) {
        if (state.resumeAt >= state.elapsed) state.resumeAt++;
      }
      if (allowBattle) ready(state, rules);
    }
    return elapsed;
  }

  function setRunning(state, value, rules) {
    if (value && !state.battle && !(rules ? rules.target(state) : sector(state.stage, state.settings.difficulty))) return;
    state.running = value;
    if (value) ready(state, rules);
  }

  function forecast(state) {
    if (state.stage > sectors.length) return [];
    return Object.keys(protocols).map(id => {
      const trial = create({seed: state.random, savedAt: 0});
      trial.stage = state.stage;
      trial.levels = {...state.levels};
      trial.tuning = {...state.tuning};
      trial.settings = {...state.settings, auto: false, protocol: id};
      setRunning(trial, true);
      for (let i = 0; i < TIMEOUT && !trial.lastBattle; i++) advance(trial, 1);
      const fight = trial.lastBattle;
      return {id, outcome: fight.outcome, time: fight.age, hp: fight.playerHp, enemyHp: fight.enemyHp};
    }).sort((a, b) => Number(b.outcome === 'win') - Number(a.outcome === 'win') ||
      (a.outcome === 'win' ? a.time - b.time : a.enemyHp - b.enemyHp) || b.hp - a.hp);
  }

  function checkSave(raw, {trainingStage = null} = {}) {
    const inRange = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
    const fail = () => { throw new Error('存档内容不完整或版本不匹配。'); };
    if (!raw || raw.version !== VERSION || !inRange(raw.stage, 1, sectors.length + 1) ||
      !inRange(raw.elapsed, 0, Number.MAX_SAFE_INTEGER - OFFLINE_CAP - COOLDOWN) ||
      !inRange(raw.savedAt, 0, Number.MAX_SAFE_INTEGER) || !inRange(raw.seed, 0, 0xffffffff) ||
      !inRange(raw.random, 1, 0xffffffff) || !inRange(raw.pointer, 0, upgrades.length - 1) ||
      !inRange(raw.resumeAt, 0, raw.elapsed + COOLDOWN) || typeof raw.running !== 'boolean') fail();
    for (const key of ['credits', 'income', 'rewards', 'spent', 'failures', 'sequence']) {
      if (!inRange(raw[key], 0, 10 ** 12)) fail();
    }
    if (raw.credits !== START_CREDITS + raw.income + raw.rewards - raw.spent ||
      (raw.stage > sectors.length && !trainingStage && (raw.running || raw.battle))) fail();
    for (const upgrade of upgrades) if (!inRange(raw.levels?.[upgrade.id], 0, upgrade.max)) fail();
    const {settings} = raw;
    const tuning = raw.tuning ?? {physical: base.physical, supplyRate: INCOME.amount / INCOME.every};
    if (typeof tuning.physical !== 'number' || !inRange(tuning.physical * 4, 0, 320) || !inRange(tuning.supplyRate, 0, 9)) fail();
    if (!settings || !STRATEGIES.includes(settings.strategy) || !Object.hasOwn(protocols, settings.protocol) ||
      !['standard', 'frontier'].includes(settings.difficulty) ||
      ![1, 2, 4].includes(settings.speed) || typeof settings.auto !== 'boolean' || typeof settings.offline !== 'boolean') fail();
    const limits = {cleared: sectors.length, fights: 100, purchases: upgrades.reduce((sum, item) => sum + item.max, 0), events: 120};
    for (const [key, max] of Object.entries(limits)) {
      if (!Array.isArray(raw[key]) || raw[key].length > max || raw[key].some(row => !row || typeof row !== 'object')) fail();
    }
    if (raw.cleared.length !== raw.stage - 1 || raw.cleared.some((row, i) => row.stage !== i + 1 || !inRange(row.time, 0, raw.elapsed))) fail();
    for (const battle of [raw.battle, raw.lastBattle, ...raw.fights]) {
      if (!battle) continue;
      if (!inRange(battle.stage, 1, sectors.length) || !inRange(battle.started, 0, raw.elapsed) ||
        !inRange(battle.age, 0, TIMEOUT) || !Array.isArray(battle.turns) || battle.turns.length !== battle.age ||
        !battle.stats || Object.keys(base).some(key => !Number.isFinite(battle.stats[key])) ||
        !Object.hasOwn(protocols, battle.protocol) || !['standard', 'frontier'].includes(battle.difficulty) ||
        !Number.isFinite(battle.playerShield) || battle.playerShield < 0 ||
        !Number.isFinite(battle.playerHp) || !Number.isFinite(battle.enemyHp) ||
        battle.playerHp < 0 || battle.enemyHp < 0 || battle.turns.some(turn => !turn || typeof turn !== 'object')) fail();
    }
    if (raw.battle && (raw.battle.stage !== (trainingStage ?? raw.stage) || raw.battle.age >= TIMEOUT ||
      raw.battle.playerHp <= 0 || raw.battle.enemyHp <= 0)) fail();
    return structuredClone({...raw, tuning});
  }

  return {VERSION, INCOME, OFFLINE_CAP, TIMEOUT, COOLDOWN, START_CREDITS, STRATEGIES, chapters, sectors, upgrades, base,
    protocols, create, player, sector, price, buy, advance, setRunning, forecast, checkSave};
});
};
