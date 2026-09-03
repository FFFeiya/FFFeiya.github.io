'use strict';
const fs = require('fs');
const path = require('path');
const root = __dirname;

require(path.join(root, 'js', 'core', 'constants.js'));
const Game = require(path.join(root, 'js', 'core', 'data.js'));

function readLines(name) {
  return fs.readFileSync(path.join(root, name), 'utf8').split(/\r?\n/);
}

const ships = Game.Data.parseShipData(readLines('ship.dat'));
const equips = Game.Data.parseEquipmentData(readLines('equipment.dat'));
const pool = Game.Data.parseGachaData(readLines('gacha.dat'));
const mission = Game.Data.parseMission(
  JSON.parse(fs.readFileSync(path.join(root, 'mission.dat'), 'utf8'))
);
const playerData = Game.Data.normalizePlayerData(
  JSON.parse(fs.readFileSync(path.join(root, 'init.dat'), 'utf8'))
);

if (ships.length !== 20) throw new Error('expected 20 ships, got ' + ships.length);
if (equips.length !== 32) throw new Error('expected 32 equips, got ' + equips.length);
if (pool.length !== 32) throw new Error('expected 32 gacha entries, got ' + pool.length);
if (mission.nodes.length !== 5) throw new Error('expected 5 nodes, got ' + mission.nodes.length);

console.log('ships', ships.length, 'equips', equips.length, 'gacha', pool.length, 'nodes', mission.nodes.length);

const shipIds = new Set(ships.map((s) => s.id));
const equipIds = new Set(equips.map((e) => e.id));
const poolIds = new Set(pool.map((p) => p.id));
for (const id of poolIds) {
  if (!shipIds.has(id) && !equipIds.has(id)) {
    throw new Error('gacha id not found: ' + id);
  }
}

for (const slot of playerData.fleet) {
  const ship = ships.find((s) => s.id === slot.shipId);
  const eqs = slot.equipIds.map((id) => equips.find((e) => e.id === id)).filter(Boolean);
  console.log(
    ship.id,
    ship.name,
    ship.role,
    'HP' + Game.Data.shipHP(ship),
    'reach' + Game.Data.reach(ship),
    'dv' + Game.Data.deltaVPerTurn(ship, eqs).toFixed(0)
  );
}

console.log('SMOKE TEST OK');

// 迁移测试：旧英文名存档应映射到新 id
const legacy = Game.Data.normalizePlayerData({
  version: 2,
  coins: 1000,
  ownedShips: ['Shimakaze', 'Yamato', 'ST-003'],
  ownedEquipments: ['Heavy Cannon', 'Laser Cannon', 'equip-31'],
  playerFleet: [
    { ship: 'Ayanami', equipments: ['Torpedo Launcher'] },
    { ship: 'Akashi', equipments: ['Shield Generator'] },
    { ship: 'Fubuki', equipments: [] }
  ]
});
if (legacy.ownedShips.join(',') !== 'ship-01,ship-04,ST-003') {
  throw new Error('legacy ship migration failed: ' + legacy.ownedShips.join(','));
}
if (legacy.ownedEquipments.join(',') !== 'equip-01,equip-08,equip-31') {
  throw new Error('legacy equip migration failed: ' + legacy.ownedEquipments.join(','));
}
if (legacy.fleet[0].shipId !== 'ship-02' || legacy.fleet[0].equipIds[0] !== 'equip-03') {
  throw new Error('legacy fleet migration failed');
}
console.log('MIGRATION TEST OK');
