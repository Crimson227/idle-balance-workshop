'use strict';

// Snapshot of the Meridian 3.0 Mac game, isolated per simulation.
module.exports = function install(globalThis, module) {
'use strict';

(() => {
  if (typeof globalThis.structuredClone !== 'function') {
    globalThis.structuredClone = value => JSON.parse(JSON.stringify(value));
  }
  const M = globalThis.Meridian;
  const W = globalThis.MeridianWorkbench;
  const Combat = globalThis.MeridianCombat;
  const Balance = globalThis.MeridianBalance;
  const limit = M.sectors.length;
  const oldFormat = 'meridian-native-chapter-1';
  const priorFormat = 'meridian-native-expedition-2';
  const format = 'meridian-native-expedition-3';
  const bossStages = M.sectors.filter(sector => sector.boss).map(sector => sector.id);
  const relics = [
    {id: 'arc', slot: 'weapon', name: '拾荒脉冲炮', unlock: 2, stats: {physical: 6}, detail: '每级物理伤害 +6'},
    {id: 'weave', slot: 'armor', name: '轨道复合甲', unlock: 4, stats: {hp: 16, armor: 2}, detail: '每级生命 +16、护甲 +2'},
    {id: 'thermo', slot: 'weapon', name: '冷热分流器', unlock: 6, stats: {fire: 4.5, ice: 4}, detail: '每级火伤 +4.5、冰伤 +4'},
    {id: 'coolant', slot: 'core', name: '回声冷凝芯', unlock: 8, stats: {ice: 4, hp: 9}, detail: '每级冰伤 +4、生命 +9'},
    {id: 'coilpack', slot: 'core', name: '极光磁芯', unlock: 10, stats: {lightning: 5, critChance: 0.05}, detail: '每级雷伤 +5、暴击率 +5%'},
    {id: 'bulwark', slot: 'armor', name: '主脑屏障甲', unlock: 12, stats: {shield: 14, regen: 1.5}, detail: '每级护盾 +14、每秒回复 +1.5'},
  ];
  const gearLimit = 5;
  let state;
  let cargo;
  let pending = null;

  function freshCargo() {
    return {parts: 0, crystals: 0, items: {}, equipped: {}, medals: [], farm: null, farmWins: 0};
  }

  function rewardDue(run, inventory) {
    const defeated = run.stage - 1;
    return bossStages.includes(defeated) && !inventory.medals.includes(defeated) ? defeated : null;
  }

  function finish(run, result, target, inventory) {
    if (result.outcome !== 'win') return;
    const repeated = result.training === true;
    if (repeated) inventory.farmWins++;
    const parts = repeated
      ? (target.repeatParts ?? 1 + target.chapter + Number(target.boss))
      : (target.parts ?? 2 + target.chapter);
    const crystals = target.boss ? (repeated ? (target.version === 3 ? 1 + target.chapter : 1) : 2 + target.chapter)
      : Number(repeated && inventory.farmWins % 4 === 0);
    inventory.parts += parts;
    inventory.crystals += crystals;
    const item = repeated ? null : relics.find(relic => relic.unlock === target.id);
    if (item) inventory.items[item.id] = 1;
    result.loot = {parts, crystals, item: item?.name ?? null};
    if (!repeated && target.boss) run.running = false;
  }

  function combatTarget(battle) {
    return battle.balanceVersion === 3 ? Balance.sector(battle.stage, battle.difficulty) : M.sector(battle.stage, battle.difficulty);
  }

  const payout = (run, inventory) => run.tuning.supplyRate *
    [3, 8, 14][inventory.medals.filter(stage => stage < limit).length];

  function rules(inventory, {preview = false} = {}) {
    return {
      ...Balance, combatTarget, onlyAffordable: true,
      payout: run => payout(run, inventory),
      target: run => {
        if (!preview && inventory.farm == null && rewardDue(run, inventory)) return null;
        return Balance.sector(inventory.farm ?? run.stage, run.settings.difficulty);
      },
      equip: (stats, run) => {
        if (run.settings.protocol === 'aegis') {
          stats.shield += 3 * run.levels.hull;
          stats.regen += .2 * run.levels.hull;
        }
        if (run.settings.protocol === 'toxin') stats.dot += run.levels.coil * .85;
        for (const item of relics) {
          if (inventory.equipped[item.slot] !== item.id) continue;
          for (const [field, value] of Object.entries(item.stats)) stats[field] += value * inventory.items[item.id];
        }
      },
      prepare: (battle, target) => {
        battle.training = inventory.farm != null;
        battle.balanceVersion = target.version;
        battle.maxEnemyHp = target.hp;
        battle.combat = Combat.initial();
      },
      turn: Combat.turn,
      finished: (run, battle, target) => {
        if (!preview) finish(run, battle, target, inventory);
      },
    };
  }

  function reset(options = {}) {
    const {automatic = false, protocol = 'stable', difficulty = 'frontier',
      strategy = 'order', speed = 1, offline = true, physical = 12, supplyRate = 1, seed = 42} = options;
    if (!Object.hasOwn(M.protocols, protocol) || !['frontier', 'standard'].includes(difficulty) ||
      !M.STRATEGIES.includes(strategy) || ![1, 2, 4].includes(speed) ||
      !Number.isInteger(physical * 4) || physical < 0 || physical > 80 ||
      !Number.isInteger(supplyRate) || supplyRate < 0 || supplyRate > 9 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return false;
    state = M.create({seed});
    cargo = freshCargo();
    pending = null;
    Object.assign(state.settings, {auto: Boolean(automatic), protocol, difficulty, strategy, speed, offline: Boolean(offline)});
    state.tuning = {physical, supplyRate};
    M.setRunning(state, true, rules(cargo));
    return true;
  }

  function advance(seconds, away = false) {
    return M.advance(state, seconds, {away, rules: rules(cargo)});
  }

  function resume(seconds) {
    if (!state.running || seconds < 5) return;
    const before = {income: state.income, rewards: state.rewards, cleared: state.cleared.length,
      upgrades: state.purchases.length, parts: cargo.parts, crystals: cargo.crystals, farmWins: cargo.farmWins};
    const processed = advance(seconds, true);
    const next = {away: seconds, processed, income: state.income, rewards: state.rewards, cleared: state.cleared.length,
      upgrades: state.purchases.length, parts: cargo.parts, crystals: cargo.crystals, farmWins: cargo.farmWins};
    for (const key of Object.keys(before)) next[key] -= before[key];
    if (pending) for (const key of Object.keys(next)) next[key] += pending[key] ?? 0;
    pending = next;
  }

  function save(now) {
    state.savedAt = now;
    return JSON.stringify({format, state, cargo, pending});
  }

  const integer = (value, low = 0, high = 10 ** 12) => Number.isSafeInteger(value) && value >= low && value <= high;
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const turnFields = ['time', 'damage', 'taken', 'physical', 'fire', 'ice', 'lightning', 'poison', 'dot',
    'absorbed', 'healed', 'playerHp', 'enemyHp'];
  const offlineFields = ['away', 'processed', 'income', 'rewards', 'cleared', 'upgrades', 'parts', 'crystals', 'farmWins'];

  function validCargo(raw, stage) {
    return record(raw) && ['parts', 'crystals', 'farmWins'].every(key => integer(raw[key])) &&
      (raw.farm === null || integer(raw.farm, 1, stage - 1)) &&
      record(raw.items) && Object.entries(raw.items).every(([id, level]) =>
        integer(level, 1, gearLimit) && relics.some(relic => relic.id === id && relic.unlock < stage)) &&
      record(raw.equipped) && Object.entries(raw.equipped).every(([slot, id]) =>
        Object.hasOwn(raw.items, id) && relics.some(relic => relic.slot === slot && relic.id === id)) &&
      Array.isArray(raw.medals) && new Set(raw.medals).size === raw.medals.length &&
      raw.medals.every(value => bossStages.includes(value) && value < stage) &&
      bossStages.filter(value => value < stage - 1).every(value => raw.medals.includes(value));
  }

  function restore(text, now) {
    const data = JSON.parse(text);
    const legacy = data?.format === oldFormat;
    if (!legacy && data?.format !== priorFormat && data?.format !== format) throw Error('存档格式不匹配。');
    const inventory = legacy ? freshCargo() : data.cargo;
    const validated = M.checkSave(data.state, {trainingStage: inventory?.farm ?? null});
    const battles = [validated.battle, validated.lastBattle, ...validated.fights].filter(Boolean);
    if ((legacy && validated.stage > 5) ||
        (!legacy && !validCargo(inventory, validated.stage)) ||
        battles.some(battle => battle.turns.some(turn =>
          turnFields.some(key => !Number.isFinite(turn[key])) || typeof turn.critical !== 'boolean'))) {
      throw Error('远征存档内容无效。');
    }
    if (legacy) {
      for (const row of validated.cleared) {
        const target = M.sector(row.stage, validated.settings.difficulty);
        finish(validated, {outcome: 'win', training: false}, target, inventory);
      }
      if (data.claimed === true && validated.stage === 5) inventory.medals.push(4);
      // The first release stops after stage four, even when the medal has been claimed.
      if (validated.stage === 5) {
        validated.battle = null;
        validated.running = inventory.medals.includes(4);
      }
    }
    if (inventory.farm == null && rewardDue(validated, inventory) && (validated.running || validated.battle)) {
      throw Error('章末奖励状态无效。');
    }
    if (validated.battle) {
      const battle = validated.battle;
      if ((battle.training === true) !== (inventory.farm != null) ||
          (battle.balanceVersion !== undefined && battle.balanceVersion !== 3)) throw Error('出战目标不匹配。');
      battle.maxEnemyHp = combatTarget(battle).hp;
      if (!battle.combat) battle.combat = Combat.initial();
      const combat = battle.combat;
      if (!record(combat) || !integer(combat.phase, 1, 3) ||
        !['heat', 'chill', 'dry'].every(key => integer(combat[key], 0, 3)) ||
        !['barrier', 'drones'].every(key => Number.isFinite(combat[key]) && combat[key] >= 0 && combat[key] <= 100)) {
        throw Error('首领战状态无效。');
      }
    }
    if (data.pending && (!record(data.pending) || offlineFields.some(key =>
      !integer(legacy && ['parts','crystals','farmWins'].includes(key) ? 0 : data.pending[key])))) throw Error('离线记录无效。');
    state = validated;
    cargo = inventory;
    pending = data.pending ? {...{parts: 0, crystals: 0, farmWins: 0}, ...data.pending} : null;
    resume(Math.floor(Math.max(0, now - state.savedAt) / 1000));
  }

  function compact(battle) {
    if (!battle) return null;
    const target = combatTarget(battle);
    return {stage: battle.stage, age: battle.age, stats: battle.stats, maxEnemyHp: battle.maxEnemyHp ?? target.hp,
      playerHp: battle.playerHp, enemyHp: battle.enemyHp, playerShield: battle.playerShield,
      outcome: battle.outcome ?? null, turn: battle.turns.at(-1) ?? null,
      training: battle.training === true, combat: battle.combat ?? Combat.initial(), loot: battle.loot ?? null};
  }

  function recipe(item) {
    const level = cargo.items[item.id] ?? 0;
    return {id: item.id, slot: item.slot, name: item.name, unlock: item.unlock, detail: item.detail,
      level, max: gearLimit, parts: [0, 4, 8, 14, 22, 0][level], crystals: [0, 0, 1, 2, 4, 0][level],
      equipped: cargo.equipped[item.slot] === item.id};
  }

  function view() {
    const due = rewardDue(state, cargo);
    const sectors = M.sectors.map(sector => Balance.sector(sector.id, state.settings.difficulty));
    const target = sectors[(cargo.farm ?? Math.min(due ?? state.stage, limit)) - 1];
    const info = Balance.upgrades.map(upgrade => {
      const level = state.levels[upgrade.id];
      return {...upgrade, level, price: Balance.price(upgrade, level), locked: state.stage < upgrade.stage,
        available: state.stage >= upgrade.stage && level < upgrade.max && state.credits >= Balance.price(upgrade, level)};
    });
    const stats = M.player(state, Balance);
    rules(cargo).equip(stats, state);
    return JSON.stringify({stage: state.stage, elapsed: state.elapsed, credits: state.credits,
      rewards: state.rewards, failures: state.failures, running: state.running, settings: state.settings,
      sequence: state.sequence, pending, target, sectors, upgrades: info, stats,
      battle: compact(state.battle), last: compact(state.lastBattle), clearTimes: state.cleared.map(row => row.time),
      maxStage: limit, medalDue: due, medals: cargo.medals, farm: cargo.farm, farmWins: cargo.farmWins,
      parts: cargo.parts, crystals: cargo.crystals, items: relics.map(recipe), tuning: state.tuning, payout: payout(state, cargo)});
  }

  function setFarm(stage) {
    if (stage != null && !integer(stage, 1, state.stage - 1)) return false;
    if (stage === cargo.farm) return false;
    state.battle = null;
    state.resumeAt = state.elapsed;
    cargo.farm = stage;
    state.running = false;
    M.setRunning(state, true, rules(cargo));
    return true;
  }

  function medal() {
    const stage = rewardDue(state, cargo);
    if (stage == null || cargo.farm != null) return false;
    cargo.medals.push(stage);
    if (stage < limit) M.setRunning(state, true, rules(cargo));
    return true;
  }

  function equip(id) {
    const item = relics.find(relic => relic.id === id);
    if (!item || !cargo.items[id]) return false;
    if (cargo.equipped[item.slot] === id) delete cargo.equipped[item.slot];
    else cargo.equipped[item.slot] = id;
    return true;
  }

  function craft(id) {
    const item = relics.find(relic => relic.id === id);
    if (!item || item.unlock >= state.stage) return false;
    const plan = recipe(item);
    if (plan.level >= plan.max || cargo.parts < plan.parts || cargo.crystals < plan.crystals) return false;
    cargo.parts -= plan.parts;
    cargo.crystals -= plan.crystals;
    cargo.items[id] = plan.level + 1;
    return true;
  }

  function forecast() {
    const target = rules(cargo).target(state);
    if (!target) return [];
    const simulation = rules(cargo, {preview: true});
    return Object.keys(M.protocols).map(id => {
      const trial = M.create({seed: state.random, savedAt: 0});
      trial.stage = state.stage;
      trial.levels = {...state.levels};
      trial.tuning = {...state.tuning};
      trial.settings = {...state.settings, auto: false, protocol: id};
      M.setRunning(trial, true, simulation);
      for (let i = 0; i < M.TIMEOUT && !trial.lastBattle; i++) M.advance(trial, 1, {rules: simulation});
      const fight = trial.lastBattle;
      return {id, outcome: fight.outcome, time: fight.age, hp: fight.playerHp, enemyHp: fight.enemyHp};
    }).sort((a, b) => Number(b.outcome === 'win') - Number(a.outcome === 'win') ||
      (a.outcome === 'win' ? a.time - b.time : a.enemyHp - b.enemyHp) || b.hp - a.hp);
  }

  function configuration() {
    const model = W.configuration(state);
    model.name = '子午线 · 旧版基础规则参考（2.0）';
    return model;
  }

  function report() {
    const records = W.records(state);
    return {...records, name: '子午线 · 三章远征', balanceVersion: 3, chapterRewardClaimed: cargo.medals.includes(limit),
      medals: [...cargo.medals], farmingWins: cargo.farmWins, equipment: {...cargo.equipped}};
  }

  globalThis.chapter = {
    reset, advance, resume, view, save, restore, configuration, report, forecast, medal, equip, craft,
    farm: setFarm,
    returnToRoute: () => setFarm(null),
    buy: id => M.buy(state, id, false, true, Balance),
    protocol: id => { if (Object.hasOwn(M.protocols, id)) state.settings.protocol = id; },
    strategy: id => {
      if (!M.STRATEGIES.includes(id)) return false;
      state.settings.strategy = id;
      return true;
    },
    automatic: () => { state.settings.auto = !state.settings.auto; },
    offline: () => { state.settings.offline = !state.settings.offline; },
    pause: () => M.setRunning(state, !state.running, rules(cargo)),
    speed: () => { state.settings.speed = ({1: 2, 2: 4, 4: 1})[state.settings.speed]; },
    acceptOffline: () => { pending = null; },
  };
  reset();
})();
};
