'use strict';

// Snapshot of the Meridian 3.0 Mac game, isolated per simulation.
module.exports = function install(globalThis, module) {
'use strict';

(function install(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.MeridianWorkbench = factory(root.Meridian);
})(globalThis, function createAdapter(M) {
  const channels = ['physical', 'fire', 'ice', 'lightning', 'poison'];
  const numberText = value => String(value);

  function actor({hp, physical, fire = 0, ice = 0, lightning = 0, poison = 0, armor, frequency,
    critChance = 0, critBonus = 0, flatPen = 0, percentPen = 0, leech = 0, regen = 0, block = 0, resist = {}}) {
    const stats = {hp, physicalMin: physical, physicalMax: physical, fire, ice, lightning, poison, armor,
      frequency, critChance, critBonus, flatPen, percentPen, leech, regen, leechResist: 0,
      blockChance: block ? 1 : 0, blockReduction: block, critAvoid: 0, critBonusReduction: 0};
    for (const type of channels) {
      stats[type + 'Resist'] = resist[type] ?? 0;
      stats[type + 'Reduction'] = 0;
    }
    return Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, numberText(value)]));
  }

  function rewardCurve() {
    const segments = [];
    for (const sector of M.sectors) {
      const from = sector.id - 1;
      if (sector.boss) segments.push({from, id: 'constant', base: numberText(sector.bounty)});
      else if (from % 4 === 0) segments.push({from, id: 'linear', base: numberText(sector.bounty),
        step: numberText(M.sectors[from + 1].bounty - sector.bounty)});
    }
    return {id: 'piecewise', segments};
  }

  function opponent(sector) {
    return actor({hp: sector.hp, physical: sector.attack, armor: sector.armor, frequency: 0.5, resist: sector.resist});
  }

  function configuration(state) {
    const {settings} = state;
    const start = M.create({seed: state.seed, savedAt: 0});
    start.settings = {...settings};
    start.tuning = {...state.tuning};
    const stats = M.player(start);
    const types = Object.fromEntries(channels.map(type => [type, type === 'physical' || Boolean(stats[type] || (type === 'poison' && stats.dot))]));
    const mechanisms = {critical: stats.critChance > 0, armor: true, block: stats.block > 0,
      leech: stats.leech > 0, regen: stats.regen > 0, bonuses: false, resistance: true};
    const first = M.sector(1, settings.difficulty);
    const second = M.sector(2, settings.difficulty);
    const growth = {};
    const upgrades = M.upgrades.map(upgrade => {
      const fields = upgrade.field === 'physical' ? ['physicalMin', 'physicalMax'] : [upgrade.field];
      growth[upgrade.id] = {attribute: {id: 'linear'}, cost: {id: 'linear'}, unlock: {stage: upgrade.stage}};
      return {id: upgrade.id, name: upgrade.name, fields, field: fields[0], enabled: true, increment: numberText(upgrade.add),
        costBase: numberText(upgrade.cost), costStep: numberText(upgrade.step), maxLevel: upgrade.max};
    });
    return {format: 'idle-connected-game-v2', version: 'connected-growth-2.0.0', battleVersion: 'multi-exact-2.0.0',
      name: `子午线 · ${settings.difficulty === 'frontier' ? '边境' : '标准'} · ${M.protocols[settings.protocol].name}`,
      player: actor(stats), types, mechanisms,
      world: {stageCount: M.sectors.length, enemy: opponent(first), steps: {
        hp: numberText(second.hp - first.hp),
        physicalMin: numberText(second.attack - first.attack), physicalMax: numberText(second.attack - first.attack),
        armor: numberText(second.armor - first.armor)}, rewardBase: '0', rewardStep: '0'},
      economy: {initialCoins: numberText(M.START_CREDITS), incomePerSecond: numberText(start.tuning.supplyRate),
        incomeDuringCombat: true, costScale: '1', rewardScale: '1', payout: {mode: 'interval',
          intervalSeconds: numberText(M.INCOME.every), firstAtSeconds: numberText(M.INCOME.every)}},
      upgrades, strategy: {order: upgrades.map(upgrade => upgrade.id), failureMode: 'retry_after_delay'},
      rules: {armorK: '100', battleTimeoutSeconds: numberText(M.TIMEOUT), victoryDelaySeconds: numberText(M.COOLDOWN),
        retryDelaySeconds: numberText(M.COOLDOWN)},
      behavior: {mode: 'continuous', visitHours: [0], sessionMinutes: '10', offlineCapHours: numberText(M.OFFLINE_CAP / 3600)},
      goals: {minCompletionSeconds: null, maxCompletionSeconds: '120', maxGapSeconds: '16', stagesPerVisit: null},
      simulation: {seeds: [state.seed], observationSeconds: '900', maxEvents: 10000, maxBattles: 1000},
      ruleLibrary: {version: 'rule-library-1.0.0', enabled: true, labels: {armor: '装甲'},
        defense: {id: 'flat', unit: 'points', channels: ['physical']},
        damage: {id: 'range', segments: 1, attribute: 'physicalMin', coefficient: '1', expression: 'attack * 1'},
        critical: {mode: 'probability', scope: 'segment', sharedRandom: false, guarantee: 0, threshold: '0.3'},
        dot: {enabled: stats.dot > 0, owner: 'player', channel: 'poison', amount: numberText(stats.dot),
          interval: '2', duration: '7', critical: false, leech: false},
        shield: {player: numberText(stats.shield), enemy: '0'}, recovery: {fraction: '0', interval: '1', leechChannels: channels},
        states: [], reactions: [], triggers: [], modules: [], missing: [],
        growth: {reward: rewardCurve(), upgrades: growth},
        behavior: {autoPurchase: settings.auto, strategy: settings.strategy, offlineIncome: true,
          offlinePurchase: settings.offline, offlineBattle: settings.offline},
        lifecycle: {carryStates: false, carryPity: false, carryShield: false, betweenBattles: 'expire'}}};
  }

  function battleInput(config, fight) {
    const game = {types: config.types, mechanisms: {...config.mechanisms, critical: fight.stats.critChance > 0}, ruleLibrary: config.ruleLibrary};
    return {format: 'multi-exact-battle-v2', game, player: actor(fight.stats), enemy: opponent(M.sector(fight.stage, fight.difficulty)),
      seed: config.simulation.seeds[0], rules: {armorK: '1', timeoutSeconds: numberText(M.TIMEOUT)}};
  }

  function records(state) {
    return {format: 'meridian-expedition-record-v1', version: M.VERSION, seed: state.seed, elapsed: state.elapsed,
      cleared: state.cleared, completed: state.stage > M.sectors.length, settings: state.settings, tuning: state.tuning,
      wallet: {initial: M.START_CREDITS, passive: state.income, rewards: state.rewards, spent: state.spent, balance: state.credits},
      levels: state.levels, failures: state.failures, purchases: state.purchases, battles: state.fights};
  }

  return {configuration, battleInput, records};
});
};
