'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;

require(path.join(root, 'js', 'core', 'constants.js'));
const Game = require(path.join(root, 'js', 'core', 'data.js'));
require(path.join(root, 'js', 'core', 'math3d.js'));
require(path.join(root, 'js', 'systems', 'board.js'));

const mission = Game.Data.parseMission(JSON.parse(fs.readFileSync(path.join(root, 'mission.dat'), 'utf8')));
const shieldN = mission.nodes.find((n) => n.type === 'shield' && n.band === 'N');
const shieldS = mission.nodes.find((n) => n.type === 'shield' && n.band === 'S');
const turret = mission.nodes.find((n) => n.type === 'turret');
const core = mission.nodes.find((n) => n.type === 'core');

function assert(c, m) { if (!c) throw new Error(m); }
function near(a, b, eps) { return Math.abs(a - b) < (eps || 1); }

assert(Game.Board.isGapOpen(shieldN, 3) === true, 'shield N open at 3');
assert(Game.Board.isGapOpen(shieldN, 7) === true, 'shield N open at 7');
assert(Game.Board.isGapOpen(shieldN, 2) === false, 'shield N closed at 2');
assert(Game.Board.isGapOpen(turret, 1) === true, 'turret attackable');
assert(Game.Board.isGapOpen(core, 5) === false, 'core locked');

const tel = Game.Board.computeTelegraph(2, mission, 2);
assert(tel.some((e) => e.turn === 3 && e.node.band === 'N'), 'telegraph N at 3');

assert(Game.Data.costBetween('E', 0, 'N', 0) === 100, 'E->N 100');
assert(Game.Data.costBetween('N', 0, 'S', 0) === 200, 'N->S 200');
assert(Game.Data.costBetween('E', 0, 'E', 2) === 40, 'same band 2 lon 40');

const yaw = 0.3, tilt = 0.5, R = 200;
const p = Game.Math3D.projectView(0, 90, R, yaw, tilt, 0, 0, 1);
const back = Game.Math3D.unproject(p.x, p.y, 0, 0, R, yaw, tilt, 1);
assert(near(back.latDeg, 0), 'unproject lat ~0');
assert(near(back.lonDeg, 90), 'unproject lon ~90');

const ll = Game.Board.nodeLatLon({ lat: 45, lon: 45 });
assert(ll.lat === 45 && ll.lon === 45, 'nodeLatLon passthrough');

console.log('BOARD TEST OK');
