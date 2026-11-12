'use strict';

// Snapshot of the Meridian 3.0 Mac game, isolated per simulation.
module.exports = function install(globalThis, module) {
'use strict';

(() => {
  const zeroElements = () => ({fire: 0, ice: 0, lightning: 0, poison: 0});
  const isBoss = stage => stage % 4 === 0;
  const initial = () => ({phase: 1, barrier: 0, drones: 0, heat: 0, chill: 0, dry: 0});
  function changePhase(battle, target, meter, notes) {
    if (!isBoss(battle.stage) || battle.enemyHp <= 0) return;
    const remaining = battle.enemyHp / target.hp;
    if (meter.phase === 1 && remaining <= 0.60) {
      meter.phase = 2;
      if (battle.stage === 8) {
        meter.drones = target.drones ?? 20;
        notes.push('召唤维修蜂');
      } else {
        meter.barrier = target.barrier ?? (battle.stage === 12 ? 30 : 14);
        notes.push(battle.stage === 12 ? '核心屏障' : '灰环护盾');
      }
    }
    if (battle.stage === 12 && meter.phase === 2 && remaining <= 0.28) {
      meter.phase = 3;
      notes.push('核心过载');
    }
  }

  function turn(battle, target, random) {
    const stats = battle.stats;
    const meter = battle.combat;
    const notes = [];
    const segments = battle.protocol === 'prism' ? [0.7, 0.3] : [1];
    const elemental = zeroElements();
    const hits = [];
    const armor = Math.max(0, target.armor * (1 - stats.percentPen) - stats.flatPen);
    let physical = 0;
    let damage = 0;
    let blocked = 0;
    let intercepted = 0;
    let critical = false;
    let guaranteed = false;
    const strike = power => {
      const stopped = Math.min(meter.barrier, power);
      meter.barrier -= stopped;
      blocked += stopped;
      const redirected = Math.min(meter.drones, power - stopped);
      meter.drones -= redirected;
      intercepted += redirected;
      if (redirected > 0 && meter.drones === 0) notes.push('维修蜂击破');
      const dealt = Math.min(battle.enemyHp, power - stopped - redirected);
      battle.enemyHp -= dealt;
      if (globalThis.zeroResidual(battle.enemyHp, target.hp)) battle.enemyHp = 0;
      return dealt;
    };

    for (const fraction of segments) {
      if (battle.enemyHp <= 0) break;
      const pity = stats.critChance > 0 && meter.dry >= 3;
      const crit = stats.critChance > 0 && (random() < stats.critChance || pity);
      if (stats.critChance > 0) meter.dry = crit ? 0 : meter.dry + 1;
      critical ||= crit;
      guaranteed ||= pity;
      const scale = fraction * (crit ? 1 + stats.critBonus : 1);
      const kinetic = Math.max(0, stats.physical * scale - armor);
      physical += kinetic;
      let power = kinetic;
      for (const key of Object.keys(elemental)) {
        const part = stats[key] * scale * (1 - target.resist[key]);
        elemental[key] += part;
        power += part;
      }
      const dealt = strike(power);
      damage += dealt;
      hits.push({damage: dealt, critical: crit});
    }

    // Each landed attack builds at most one stack of each element.
    if (damage > 0 && battle.enemyHp > 0) {
      if (elemental.fire > 0) meter.heat = Math.min(3, meter.heat + 1);
      if (elemental.ice > 0) meter.chill = Math.min(3, meter.chill + 1);
    }
    const periodic = stats.dot && battle.age <= (target.version === 3 ? 14 : 6) && battle.age % 2 === 0
      ? stats.dot * (1 - target.resist.poison) : 0;
    const dot = periodic ? strike(periodic) : 0;
    let reaction = 0;
    if (meter.heat >= 2 && meter.chill >= 2 && battle.enemyHp > 0) {
      meter.heat -= 2;
      meter.chill -= 2;
      reaction = strike(target.version === 3 ? (7 + target.chapter * 4) * (1 - (target.resist.fire + target.resist.ice) / 2) : 8 + target.chapter * 3);
      notes.push('热冲击');
    }

    changePhase(battle, target, meter, notes);
    let counter = battle.age % 2 === 0 ? target.attack : 0;
    let repair = 0;
    if (battle.enemyHp > 0 && meter.phase >= 2) {
      if (battle.stage === 4 && battle.age % 4 === 0) {
        counter += target.heavy ?? 6;
        notes.push('灰环重击');
      }
      if (battle.stage === 8 && meter.drones > 0 && battle.age % 2 === 0) {
        repair = Math.min(target.repair ?? 5, target.hp - battle.enemyHp);
        battle.enemyHp += repair;
        if (repair > 0) notes.push('维修蜂修复');
      }
      if (battle.stage === 12 && meter.phase === 3) {
        counter += target.overdrive ?? (battle.age % 2 === 0 ? 7 : 8);
        notes.push('过载脉冲');
      }
    }
    const returned = counter > 0 ? Math.max(0, counter - stats.armor) * (1 - stats.block) * (1 - meter.chill * 0.04) : 0;
    const absorbed = Math.min(battle.playerShield, returned);
    battle.playerShield -= absorbed;
    const taken = Math.min(battle.playerHp, returned - absorbed);
    battle.playerHp -= taken;
    const healed = battle.playerHp > 0 ? Math.min(stats.hp - battle.playerHp, damage * stats.leech + stats.regen) : 0;
    battle.playerHp += healed;
    return {time: battle.age, damage, taken, physical, ...elemental, dot, absorbed, healed, critical,
      playerHp: battle.playerHp, enemyHp: battle.enemyHp, hits, guaranteed, reaction, blocked, intercepted,
      repair, heat: meter.heat, chill: meter.chill, notes};
  }

  globalThis.MeridianCombat = {initial, turn};
})();
};
