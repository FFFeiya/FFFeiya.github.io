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
const B = Game.Battle.createBattle(mission, fleet);

function assert(c, m) { if (!c) throw new Error(m); }
function near(a, b, eps) { return Math.abs(a - b) < (eps || 1); }

assert(B.ships.length === 3, '3 ships');
assert(B.nodes.length === 5, '5 nodes');
assert(B.shieldCount === 2, '2 shields');

// 大圆周：赤道轨道 theta=0 -> lat0 lon0
const s0 = B.ships[0];
assert(Game.Battle.baseRole(s0.role) === 2, 'gunner base 2');
s0.i = 0; s0.node = 0; s0.theta = 0;
assert(Game.Battle.shipDamage(s0, false) === 4, 'equator damage 4');
s0.i = 45; s0.node = 0; s0.theta = 90;
assert(Game.Battle.shipDamage(s0, false) === 3, 'off-equator damage 3');

// 机动：倾角 +45 消耗 100
const s1 = B.ships[1]; s1.i = 0; s1.node = 0; s1.theta = 0; s1.moved = false;
const cost = Game.Battle.maneuver(s1, 45, 0, 0, 120);
assert(near(cost, 100) && near(s1.i, 45), 'inclination maneuver');

// 攻击：赤道 lon45 打 N 盾
const shield = B.nodes.find((n) => n.type === 'shield' && n.band === 'N');
B.turn = 3;
s0.i = 0; s0.node = 0; s0.theta = 45; s0.acted = false;
assert(Game.Battle.canAttack(s0, shield, B) === true, 'can attack shield');
Game.Battle.attack(B, 0, B.nodes.indexOf(shield), false);
assert(shield.hp === 0 && shield.alive === false, 'shield destroyed by 4 damage');

const tb = B.turn;
Game.Battle.resolve(B);
assert(B.turn === tb + 1, 'turn increments');
assert(B.energy === 3, 'energy increments');

console.log('BATTLE TEST OK');
