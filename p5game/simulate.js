'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;

require(path.join(root, 'js', 'core', 'constants.js'));
const Game = require(path.join(root, 'js', 'core', 'data.js'));
require(path.join(root, 'js', 'core', 'math3d.js'));
require(path.join(root, 'js', 'systems', 'board.js'));
require(path.join(root, 'js', 'systems', 'battle.js'));

function readLines(name) { return fs.readFileSync(path.join(root, name), 'utf8').split(/\r?\n/); }

Game.Data.ships = Game.Data.parseShipData(readLines('ship.dat'));
Game.Data.equipments = Game.Data.parseEquipmentData(readLines('equipment.dat'));
const mission = Game.Data.parseMission(JSON.parse(fs.readFileSync(path.join(root, 'mission.dat'), 'utf8')));
const init = Game.Data.normalizePlayerData(JSON.parse(fs.readFileSync(path.join(root, 'init.dat'), 'utf8')));
const fleet = init.fleet.map((slot) => ({ ship: Game.Data.ships.find((s) => s.id === slot.shipId), equipIds: slot.equipIds }));

function shortestDeg(a, b) {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function pickTarget(ship, B) {
  let best = null;
  // 优先护盾（缺口开），其次核心（暴露），再炮台
  for (const n of B.nodes) {
    if (!n.alive) continue;
    if (n.type === 'shield' && Game.Battle.canAttack(ship, n, B)) return n;
  }
  const core = B.nodes.find((n) => n.type === 'core' && n.alive);
  if (B.exposed && core && Game.Battle.canAttack(ship, core, B)) return core;
  for (const n of B.nodes) {
    if (!n.alive || n.type !== 'turret') continue;
    if (Game.Battle.canAttack(ship, n, B)) return n;
  }
  return null;
}

function moveTowardShield(ship, B, budget) {
  // 找最近的存活护盾，把经度对齐过去（赤道轨道下 lon=theta）
  const shields = B.nodes.filter((n) => n.type === 'shield' && n.alive);
  if (!shields.length) return;
  let target = shields[0], bestD = Infinity;
  for (const n of shields) {
    const d = Math.abs(shortestDeg(ship.theta, n.lon));
    if (d < bestD) { bestD = d; target = n; }
  }
  const dTheta = shortestDeg(ship.theta, target.lon);
  Game.Battle.maneuver(ship, 0, 0, dTheta, budget);
}

function oneTrial() {
  const B = Game.Battle.createBattle(mission, fleet);
  let turns = 0;
  while (turns < 40) {
    const st = Game.Battle.status(B);
    if (st !== 'playing') {
      return { victory: st === 'victory', turns, lost: B.ships.filter((s) => s.sunk).length, cannonLeft: B.mainCannonLeft };
    }

    for (let i = 0; i < B.ships.length; i++) {
      const s = B.ships[i];
      if (s.sunk || s.offboard || s.cooldown > 0 || s.acted) continue;
      const target = pickTarget(s, B);
      if (target && Game.Battle.canAttack(s, target, B)) {
        const r = Game.Battle.attack(B, i, B.nodes.indexOf(target), false);
        if (r !== 'playing') {
          return { victory: r === 'victory', turns, lost: B.ships.filter((x) => x.sunk).length, cannonLeft: B.mainCannonLeft };
        }
        continue;
      }
      if (!s.moved) {
        if (s.hp <= 1) {
          s.offboard = true;
          s.cooldown = Game.Constants.RETREAT_COOLDOWN;
          s.acted = true;
        } else {
          const budget = Game.Data.deltaVPerTurn(s, s.equipments);
          moveTowardShield(s, B, budget);
        }
      }
    }

    const r = Game.Battle.resolve(B);
    turns++;
    if (r !== 'playing') {
      return { victory: r === 'victory', turns, lost: B.ships.filter((s) => s.sunk).length, cannonLeft: B.mainCannonLeft };
    }
  }
  return { victory: false, turns, lost: B.ships.filter((s) => s.sunk).length, cannonLeft: B.mainCannonLeft };
}

const N = Number(process.argv[2]) || 1000;
let wins = 0, winTurns = 0, winLost = 0, winCannon = 0;
for (let i = 0; i < N; i++) {
  const r = oneTrial();
  if (r.victory) {
    wins++;
    winTurns += r.turns;
    winLost += r.lost;
    winCannon += r.cannonLeft;
  }
}

console.log('trials:', N);
console.log('win rate:', (wins / N * 100).toFixed(1) + '%');
if (wins > 0) {
  console.log('avg turns (win):', (winTurns / wins).toFixed(1));
  console.log('avg ships lost (win):', (winLost / wins).toFixed(2));
  console.log('avg cannon left (win):', (winCannon / wins).toFixed(1));
}
