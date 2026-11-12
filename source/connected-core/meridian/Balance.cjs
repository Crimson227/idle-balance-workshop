'use strict';

// Snapshot of the Meridian 3.0 Mac game, isolated per simulation.
module.exports = function install(globalThis, module) {
'use strict';

(() => {
  const M = globalThis.Meridian;
  const upgrades = M.upgrades.map(upgrade => ({
    ...upgrade,
    ...{
      pulse: {add: 4, cost: 28, ratio: 1.22},
      hull: {add: 16, cost: 36, ratio: 1.21},
      coil: {add: 4, cost: 43, ratio: 1.24},
    }[upgrade.id],
  }));
  const price = (upgrade, level) => Math.round(upgrade.cost * upgrade.ratio ** level);
  const modifiers = {
    stable: {},
    pulse: {critChance: 0.20, critBonus: 0.48},
    aegis: {shield: 20, regen: 1.5},
    toxin: {dot: 5},
    prism: {fire: 3, ice: 2, lightning: 6, poison: 1, flatPen: 1, percentPen: 0.20},
  };
  // Each row sets a fight-length target at an explicit, attainable loadout.
  const plans = [
    {rounds: 5, levels: [0,0,0], gear: [0,0], armor: 2, pressure: .22, resist: [.15,.25,.25,.10], bounty: 18, parts: 1},
    {rounds: 7, levels: [1,0,0], gear: [0,0], armor: 3, pressure: .38, resist: [.32,.10,.10,.20], bounty: 24, parts: 2},
    {rounds: 9, levels: [1,1,0], gear: [1,0], armor: 4, pressure: .43, resist: [.12,.30,.36,.12], bounty: 32, parts: 3},
    {rounds: 14, levels: [2,1,0], gear: [1,0], armor: 7, pressure: .88, resist: [.12,.36,.50,.10], bounty: 56, parts: 4, special: {barrier: 24, heavy: 7}},
    {rounds: 8, levels: [2,2,1], gear: [2,1], armor: 5, pressure: .43, resist: [.28,.15,.15,.32], bounty: 38, parts: 2},
    {rounds: 10, levels: [3,2,1], gear: [2,1], armor: 7, pressure: .52, resist: [.45,.12,.15,.36], bounty: 46, parts: 3},
    {rounds: 11, levels: [3,2,2], gear: [2,2], armor: 8, pressure: .53, resist: [.10,.35,.40,.14], bounty: 54, parts: 3},
    {rounds: 17, levels: [4,3,2], gear: [2,2], armor: 10, pressure: .84, resist: [.46,.14,.46,.43], bounty: 85, parts: 5, special: {drones: 48, repair: 8}},
    {rounds: 10, levels: [4,3,2], gear: [3,2], armor: 9, pressure: .52, resist: [.25,.40,.10,.28], bounty: 55, parts: 3},
    {rounds: 11, levels: [5,4,3], gear: [3,2], armor: 11, pressure: .58, resist: [.12,.16,.46,.28], bounty: 66, parts: 4},
    {rounds: 13, levels: [5,4,3], gear: [3,2], armor: 14, pressure: .61, resist: [.24,.28,.34,.08], bounty: 78, parts: 4},
    {rounds: 22, levels: [5,5,4], gear: [3,3], armor: 15, pressure: .89, resist: [.36,.11,.32,.42], bounty: 123, parts: 7, special: {barrier: 72, overdrive: 10}},
  ];

  function makeTarget(original, plan, frontier) {
    const [pulse, hull, coil] = plan.levels;
    const [weapon, armorGear] = plan.gear;
    const [fire, ice, lightning, poison] = plan.resist;
    const special = plan.special ?? {};
    const attack = M.base.physical + pulse * upgrades[0].add + weapon * 6;
    const referenceDps = Math.max(0, attack - plan.armor) +
      (M.base.lightning + coil * upgrades[2].add) * (1 - lightning);
    const referenceHp = M.base.hp + hull * upgrades[1].add + armorGear * 16;
    const phaseHealth = (special.barrier ?? 0) + (special.drones ?? 0) + (special.repair ?? 0) * 2;
    const phaseDamage = (special.heavy ?? 0) * Math.floor(plan.rounds * .5 / 4) +
      (special.overdrive ?? 0) * Math.floor(plan.rounds * .28);
    const hitsReceived = Math.floor(plan.rounds / 2);
    const counter = Math.max(5, (referenceHp * plan.pressure - phaseDamage) / hitsReceived) + M.base.armor + armorGear * 2;
    const elements = ['火焰','冰霜','闪电','毒性'];
    const minResist = Math.min(...plan.resist);
    const hint = '较弱抗性 · ' + elements.filter((_, index) => plan.resist[index] === minResist).join('、');
    const repeatParts = [1, 2, 2, 4, 3, 4, 5, 7, 5, 6, 7, 11][original.id - 1];
    return {
      ...original, version: 3, hint, referenceDps, targetRounds: plan.rounds,
      hp: Math.round(Math.max(25, referenceDps * plan.rounds - phaseHealth) * (frontier ? 1.14 : 1)),
      attack: Math.round(counter * (frontier ? 1.11 : 1)),
      armor: plan.armor,
      resist: {fire, ice, lightning, poison},
      bounty: plan.bounty, parts: plan.parts, repeatParts,
      repeatBounty: Math.ceil(plan.rounds * (.40 + original.chapter * .18)) + Number(original.boss) * 3,
      ...special,
    };
  }

  const sectors = Object.fromEntries(['standard', 'frontier'].map(difficulty => [difficulty,
    M.sectors.map((sector, index) => makeTarget(sector, plans[index], difficulty === 'frontier'))]));
  const sector = (stage, difficulty) => sectors[difficulty]?.[stage - 1];

  globalThis.MeridianBalance = {upgrades, price, modifiers, sector};
})();
};
