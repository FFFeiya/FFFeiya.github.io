(function (global) {
  'use strict';
  const Game = global.Game || {};
  const C = Game.Constants;
  const M = Game.Math3D;

  function deg2rad(d) { return d * Math.PI / 180; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function wrapLon(lon) { return ((lon % 360) + 360) % 360; }

  // 球面角距离（度）
  function angularDist(latA, lonA, latB, lonB) {
    const a = deg2rad(latA), b = deg2rad(latB), d = deg2rad(lonB - lonA);
    const c = Math.acos(clamp(Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.cos(b) * Math.cos(d), -1, 1));
    return c / Math.PI * 180;
  }

  function baseRole(role) { return { gunner: 2, emp: 1, support: 1 }[role] || 1; }

  function shipDamage(ship, overloaded) {
    const equipFire = (ship.equipments || []).reduce((s, e) => s + (e && e.firepower ? e.firepower : 0), 0);
    const base = baseRole(ship.role);
    const shipBonus = Math.floor((ship.firepower || 0) / C.DAMAGE_DIVISOR);
    const equipBonus = Math.floor(equipFire / C.DAMAGE_DIVISOR);
    const raw = (base + shipBonus + equipBonus) * (overloaded ? 2 : 1);
    return raw + (Math.abs(shipLatLon(ship).lat) < 5 ? 1 : 0); // 赤道附近 +1
  }

  function incoming(turretFire, ship) {
    const armor = (ship.armor || 0) + (ship.equipments || []).reduce((s, e) => s + (e && e.armor ? e.armor : 0), 0);
    return Math.max(1, turretFire - Math.floor(armor / C.ARMOR_DIVISOR));
  }

  function dodgeChance(ship) {
    const evasion = (ship.evasion || 0) + (ship.equipments || []).reduce((s, e) => s + (e && e.evasion ? e.evasion : 0), 0);
    return Math.min(C.DODGE_CAP, evasion / C.DODGE_DIVISOR);
  }

  function reachDeg(ship) { return Game.Data.reach(ship) * C.DEG_PER_COL; }

  function shipLatLon(ship) {
    const p = M.orbitPos(ship.i, ship.node, ship.theta, 1);
    return { lat: p.lat, lon: p.lon };
  }

  function isVulnerable(node, battle) {
    if (!node.alive) return false;
    if (node.type === 'turret') return true;
    if (node.type === 'shield') return Game.Board.isGapOpen(node, battle.turn);
    if (node.type === 'core') return battle.exposed === true;
    return false;
  }

  function canAttack(ship, node, battle) {
    if (!ship || ship.hp <= 0 || ship.cooldown > 0) return false;
    if (!isVulnerable(node, battle)) return false;
    const p = shipLatLon(ship);
    return angularDist(p.lat, p.lon, node.lat, node.lon) <= reachDeg(ship);
  }

  function createBattle(mission, fleet) {
    const ships = (fleet || []).map((slot, i) => {
      const ship = slot.ship;
      const equipments = (slot.equipIds || []).map((id) => Game.Data.equipments.find((e) => e.id === id)).filter(Boolean);
      const theta = [0, 3, 5][i % 3] * C.DEG_PER_COL;
      return {
        shipId: ship.id, name: ship.name, role: ship.role,
        firepower: ship.firepower, endurance: ship.endurance, armor: ship.armor,
        evasion: ship.evasion, range: ship.range, mass: ship.mass, equipments,
        maxHp: Game.Data.shipHP(ship), hp: Game.Data.shipHP(ship),
        i: 0, node: 0, theta, spawnI: 0, spawnNode: 0, spawnTheta: theta,
        offboard: false, acted: false, moved: false, cooldown: 0,
        shield: false, decoy: false, overloaded: false, sunk: false
      };
    });

    const nodes = (mission.nodes || []).map((n) => ({
      type: n.type, band: n.band, lonCol: n.lon,
      lat: M.bandToLat(n.band), lon: n.lon * C.DEG_PER_COL,
      hp: n.hp, maxHp: n.hp, period: n.period, duration: n.duration, phase: n.phase,
      firepower: n.firepower || 0, alive: true, disabled: 0
    }));

    return {
      turn: 1, mainCannonLeft: mission.countdownTurns, energy: mission.energyStart,
      ships, nodes,
      shieldCount: nodes.filter((n) => n.type === 'shield').length,
      exposed: false, emp: false, log: [], lastResolve: { events: [] }
    };
  }

  // Δv 机动：di/倾角、dOmega/升交点、dTheta/相位（角度制）
  function maneuverCost(di, dOmega, dTheta) {
    return Math.abs(di) / C.DEG_PER_BAND * C.COST_PER_BAND
      + Math.abs(dOmega) / C.DEG_PER_COL * C.COST_PER_LON
      + Math.abs(dTheta) / C.DEG_PER_COL * C.COST_PER_LON;
  }

  function maneuver(ship, di, dOmega, dTheta, budget) {
    if (!ship || ship.sunk || ship.offboard || ship.moved) return 0;
    const cost = maneuverCost(di, dOmega, dTheta);
    const s = cost > 0 && cost > budget ? budget / cost : 1;
    ship.i = clamp(ship.i + di * s, 0, 90);
    ship.node = wrapLon(ship.node + dOmega * s);
    ship.theta = wrapLon(ship.theta + dTheta * s);
    ship.moved = true;
    return cost > 0 ? Math.min(cost, budget) : 0;
  }

  // 预测落点受到哪些炮台威胁
  function threatsAt(lat, lon, battle) {
    const out = [];
    for (const n of battle.nodes) {
      if (!n.alive || n.type !== 'turret' || n.disabled > 0) continue;
      const range = C.TURRET_RANGE * C.DEG_PER_COL;
      if (angularDist(0, n.lon, lat, lon) <= range) out.push(n);
    }
    return out;
  }

  function turretTargetShipIndex(turret, battle) {
    const range = C.TURRET_RANGE * C.DEG_PER_COL;
    let best = null, bestD = Infinity, bestHp = -1;
    for (let i = 0; i < battle.ships.length; i++) {
      const s = battle.ships[i];
      if (s.sunk || s.cooldown > 0) continue;
      const p = shipLatLon(s);
      const d = angularDist(0, turret.lon, p.lat, p.lon);
      if (d > range) continue;
      if (d < bestD || (d === bestD && s.hp > bestHp)) { bestD = d; bestHp = s.hp; best = i; }
    }
    return best;
  }

  function attack(battle, shipIndex, nodeIndex, overloaded) {
    const ship = battle.ships[shipIndex];
    const node = battle.nodes[nodeIndex];
    const dmg = shipDamage(ship, overloaded);
    node.hp -= dmg;
    battle.log.push(ship.name + ' 攻击 ' + node.type + ' -' + dmg);
    if (ship.role === 'emp' && node.type === 'turret') node.disabled = 1;
    if (node.hp <= 0) {
      node.hp = 0; node.alive = false;
      battle.log.push(node.type + ' 被摧毁');
      if (node.type === 'shield') {
        battle.shieldCount--;
        if (battle.shieldCount <= 0) { battle.exposed = true; battle.log.push('核心已暴露'); }
      }
    }
    ship.acted = true;
    return status(battle);
  }

  function supportHeal(battle, shipIndex) {
    let target = null;
    for (const s of battle.ships) {
      if (s.sunk) continue;
      if (!target || s.hp < target.hp) target = s;
    }
    if (target && target.hp < target.maxHp) {
      target.hp = Math.min(target.maxHp, target.hp + 1);
      battle.log.push('维修 ' + target.name + ' +1');
    }
    battle.ships[shipIndex].acted = true;
  }

  function resolve(battle) {
    battle.lastResolve = { events: [] };
    if (!battle.emp) {
      for (const node of battle.nodes) {
        if (!node.alive || node.type !== 'turret' || node.disabled > 0) continue;
        const i = turretTargetShipIndex(node, battle);
        if (i === null) continue;
        const s = battle.ships[i];
        if (s.decoy) { battle.lastResolve.events.push({ shipIndex: i, kind: 'decoy' }); continue; }
        if (s.shield) { s.shield = false; battle.lastResolve.events.push({ shipIndex: i, kind: 'block' }); continue; }
        if (Math.random() < dodgeChance(s)) {
          battle.log.push(s.name + ' 闪避');
          battle.lastResolve.events.push({ shipIndex: i, kind: 'dodge' });
          continue;
        }
        const dmg = incoming(C.TURRET_DAMAGE, s);
        s.hp -= dmg;
        battle.log.push(s.name + ' 被炮台命中 -' + dmg);
        battle.lastResolve.events.push({ shipIndex: i, kind: 'hit', dmg });
        if (s.hp <= 0) { s.hp = 0; s.sunk = true; battle.log.push(s.name + ' 被击沉'); }
      }
    }

    // 行星自转：节点绝对经度减 ROTATION_SPEED
    for (const node of battle.nodes) {
      node.lon = wrapLon(node.lon - C.ROTATION_SPEED);
      if (node.disabled > 0) node.disabled--;
    }
    for (const s of battle.ships) {
      if (s.cooldown > 0) s.cooldown--;
      if (s.offboard && s.cooldown === 0) { s.offboard = false; s.i = s.spawnI; s.node = s.spawnNode; s.theta = s.spawnTheta; }
      s.shield = false; s.decoy = false; s.overloaded = false; s.acted = false; s.moved = false;
    }
    battle.turn++;
    battle.mainCannonLeft--;
    battle.energy += C.ENERGY_PER_TURN;
    battle.emp = false;
    return status(battle);
  }

  function status(battle) {
    const core = battle.nodes.find((n) => n.type === 'core');
    if (battle.exposed && core && !core.alive) return 'victory';
    if (battle.mainCannonLeft <= 0) return 'defeat';
    if (battle.ships.every((s) => s.sunk)) return 'defeat';
    return 'playing';
  }

  Game.Battle = {
    baseRole, shipDamage, incoming, dodgeChance, angularDist, reachDeg, shipLatLon,
    isVulnerable, canAttack, createBattle, maneuver, maneuverCost, threatsAt,
    turretTargetShipIndex, attack, supportHeal, resolve, status
  };

  global.Game = Game;
  if (typeof module !== 'undefined' && module.exports) { module.exports = Game; }
})(typeof window !== 'undefined' ? window : globalThis);
