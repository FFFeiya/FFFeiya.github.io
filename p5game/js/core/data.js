(function (global) {
  'use strict';
  const Game = global.Game || {};
  const C = Game.Constants;

  // 旧版（英文名）→ 新 id 迁移表
  const LEGACY_SHIP_TO_ID = {
    Shimakaze: 'ship-01', Ayanami: 'ship-02', Kagerou: 'ship-03', Yamato: 'ship-04',
    Akashi: 'ship-05', Mutsuki: 'ship-06', Fubuki: 'ship-07', Atago: 'ship-08'
  };
  const LEGACY_EQUIP_TO_ID = {
    'Heavy Cannon': 'equip-01', 'Light AA Gun': 'equip-02', 'Torpedo Launcher': 'equip-03',
    'Advanced Radar': 'equip-04', 'Enhanced Engine': 'equip-05', 'Shield Generator': 'equip-06',
    'Missile Pod': 'equip-07', 'Laser Cannon': 'equip-08', 'Stealth Module': 'equip-09',
    'Anti-Air Missile': 'equip-10', Flamethrower: 'equip-11', 'Sonar System': 'equip-12',
    'Plasma Rifle': 'equip-13', 'Bio Armor': 'equip-14', 'Nano Repair Kit': 'equip-15',
    'Quantum Disruptor': 'equip-16', 'Photon Torpedo': 'equip-17', Railgun: 'equip-18',
    'Cloaking Device': 'equip-19', 'EMP Emitter': 'equip-20', 'Laser Grid': 'equip-21',
    'Plasma Shield': 'equip-22', 'Quantum Torpedo': 'equip-23', 'Nano Repair System': 'equip-24',
    'Stealth Armor': 'equip-25', 'Missile Defense System': 'equip-26', 'Advanced Targeting': 'equip-27',
    'Heavy Ion Cannon': 'equip-28', 'Adaptive Camouflage': 'equip-29', 'Dual-Phase Engine': 'equip-30',
    'Kinetic Barrier': 'equip-31', 'Thermal Radar': 'equip-32'
  };
  const VALID_SHIP_IDS = new Set(Object.values(LEGACY_SHIP_TO_ID).concat([
    'ship-09', 'ship-10', 'ship-11', 'ship-12', 'ship-13', 'ship-14', 'ship-15', 'ship-16',
    'ST-001', 'ST-002', 'ST-003', 'ST-004'
  ]));
  const VALID_EQUIP_IDS = new Set(Object.values(LEGACY_EQUIP_TO_ID));

  function canonicalShipId(v) {
    if (typeof v !== 'string') return null;
    if (LEGACY_SHIP_TO_ID[v]) return LEGACY_SHIP_TO_ID[v];
    if (VALID_SHIP_IDS.has(v)) return v;
    return null;
  }

  function canonicalEquipId(v) {
    if (typeof v !== 'string') return null;
    if (LEGACY_EQUIP_TO_ID[v]) return LEGACY_EQUIP_TO_ID[v];
    if (VALID_EQUIP_IDS.has(v)) return v;
    return null;
  }

  function uniqueArray(arr) {
    return [...new Set((arr || []).filter((v) => v !== null && v !== undefined))];
  }

  // ============ 舰船 ============
  function parseShipData(lines) {
    const out = [];
    for (const line of lines || []) {
      const s = line && line.trim ? line.trim() : '';
      if (s === '' || s.startsWith('#')) continue;
      const f = s.split(',');
      if (f.length < 15) continue;
      out.push({
        id: f[0].trim(),
        name: f[1].trim(),
        type: f[2].trim(),
        role: f[3].trim(),
        firepower: Number(f[4]),
        aa: Number(f[5]),
        endurance: Number(f[6]),
        armor: Number(f[7]),
        evasion: Number(f[8]),
        carryCapacity: Number(f[9]),
        range: Number(f[10]),
        minOrbit: Number(f[11]),
        price: Number(f[12]),
        attribute: f[13].trim(),
        mass: Number(f[14])
      });
    }
    return out;
  }

  // ============ 装备 ============
  function parseEquipmentData(lines) {
    const out = [];
    for (const line of lines || []) {
      const s = line && line.trim ? line.trim() : '';
      if (s === '' || s.startsWith('#')) continue;
      const f = s.split(',');
      if (f.length < 11) continue;
      out.push({
        id: f[0].trim(),
        name: f[1].trim(),
        firepower: Number(f[2]),
        aa: Number(f[3]),
        armor: Number(f[4]),
        evasion: Number(f[5]),
        range: Number(f[6]),
        mass: Number(f[7]),
        attribute: f[8].trim(),
        price: Number(f[9]),
        loadModifier: Number(f[10])
      });
    }
    return out;
  }

  // ============ 抽卡池 ============
  function parseGachaData(lines) {
    const raw = [];
    let total = 0;
    for (const line of lines || []) {
      const s = line && line.trim ? line.trim() : '';
      if (s === '' || s.startsWith('#')) continue;
      const f = s.split(',');
      if (f.length < 2) continue;
      const id = f[0].trim();
      const weight = Number(f[1]);
      if (!id || !(weight > 0)) continue;
      raw.push({ id, weight });
      total += weight;
    }
    return raw.map((it) => ({
      id: it.id,
      weight: it.weight,
      probability: total > 0 ? it.weight / total : 0
    }));
  }

  // ============ 任务 ============
  function parseMission(json) {
    const m = json && typeof json === 'object' ? json : {};
    return {
      id: Number(m.id) || 1,
      planetRadius: Number(m.planetRadius) || 200,
      countdownTurns: Number(m.countdownTurns) || C.MAIN_CANNON_TURNS,
      energyStart: Number(m.energyStart) || C.ENERGY_START,
      rewardCoins: Number(m.rewardCoins) || 0,
      spawnBand: m.spawnBand || 'E',
      nodes: Array.isArray(m.nodes) ? m.nodes : []
    };
  }

  // ============ 玩家数据（v3，单一所有权，无蓝图） ============
  function normalizePlayerData(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const fleetRaw = Array.isArray(data.fleet)
      ? data.fleet
      : (Array.isArray(data.playerFleet) ? data.playerFleet : []);

    let fleet = fleetRaw.map((slot) => {
      const rawShip = slot && slot.shipId ? slot.shipId : (slot && slot.ship ? slot.ship : null);
      const rawEq = Array.isArray(slot && slot.equipIds)
        ? slot.equipIds
        : (Array.isArray(slot && slot.equipments) ? slot.equipments : []);
      return {
        shipId: canonicalShipId(rawShip),
        equipIds: rawEq.map(canonicalEquipId).filter(Boolean)
      };
    });
    fleet = fleet.slice(0, 3);
    while (fleet.length < 3) fleet.push({ shipId: null, equipIds: [] });

    return {
      version: 3,
      coins: Number(data.coins) || 2000,
      ownedShips: uniqueArray(data.ownedShips.map(canonicalShipId).filter(Boolean)),
      ownedEquipments: uniqueArray(data.ownedEquipments.map(canonicalEquipId).filter(Boolean)),
      clearedLevels: uniqueArray(data.clearedLevels).map(Number).filter(Number.isFinite),
      fleet
    };
  }

  // ============ 派生数值 ============
  function shipHP(ship) {
    return Math.min(6, Math.max(2, 2 + Math.floor((ship && ship.endurance ? ship.endurance : 0) / 100)));
  }

  function reach(ship) {
    return Math.floor((ship && ship.range ? ship.range : 0) / 100);
  }

  function deltaVPerTurn(ship, equipments) {
    const m = (ship && ship.mass ? ship.mass : 0) +
      (equipments || []).reduce((sum, e) => sum + (e && e.mass ? e.mass : 0), 0);
    const dv = C.ISP_G0 * Math.log(m / (m - C.FUEL_PER_TURN));
    return Math.min(C.DV_MAX, Math.max(C.DV_MIN, dv));
  }

  function costBetween(bandA, lonA, bandB, lonB) {
    const bandDistance = bandA === bandB
      ? 0
      : ((bandA === 'E' || bandB === 'E') ? 1 : 2);
    const dlon = Math.abs(lonB - lonA);
    const lonDistance = Math.min(dlon, C.LON_COUNT - dlon);
    return C.COST_PER_LON * lonDistance + C.COST_PER_BAND * bandDistance;
  }

  // ============ 抽卡 ============
  function tryGacha(times, pool, playerData, shipIds, equipIds) {
    const result = { ok: false, reason: '', results: [], spent: 0, refund: 0 };
    if (!pool || pool.length === 0) {
      result.reason = 'emptyPool';
      return result;
    }
    const cost = C.GACHA_COST * times;
    if ((playerData.coins || 0) < cost) {
      result.reason = 'notEnoughCoins';
      return result;
    }
    playerData.coins -= cost;
    result.spent = cost;

    for (let i = 0; i < times; i++) {
      const r = Math.random();
      let cum = 0;
      let chosen = null;
      for (const item of pool) {
        cum += item.probability;
        if (r <= cum) { chosen = item.id; break; }
      }
      if (!chosen) chosen = pool[pool.length - 1].id;
      result.results.push(chosen);
    }

    let refund = 0;
    for (const id of result.results) {
      if (shipIds.has(id)) {
        if (playerData.ownedShips.includes(id)) refund += C.GACHA_REFUND;
        else playerData.ownedShips.push(id);
      } else if (equipIds.has(id)) {
        if (playerData.ownedEquipments.includes(id)) refund += C.GACHA_REFUND;
        else playerData.ownedEquipments.push(id);
      }
    }
    playerData.coins += refund;
    playerData.ownedShips = uniqueArray(playerData.ownedShips);
    playerData.ownedEquipments = uniqueArray(playerData.ownedEquipments);
    result.refund = refund;
    result.ok = true;
    return result;
  }

  // ============ p5 加载器 ============
  function loadShipData() { loadStrings('ship.dat', (d) => { Game.Data.ships = parseShipData(d); }); }
  function loadEquipmentData() { loadStrings('equipment.dat', (d) => { Game.Data.equipments = parseEquipmentData(d); }); }
  function loadGachaData() { loadStrings('gacha.dat', (d) => { Game.Data.gachaPool = parseGachaData(d); }); }
  function loadMission() { loadJSON('mission.dat', (d) => { Game.Data.mission = parseMission(d); }); }
  function loadInit() { loadJSON('init.dat', (d) => { Game.Data.playerData = normalizePlayerData(d); }); }

  Game.Data = Game.Data || {};
  Object.assign(Game.Data, {
    ships: [], equipments: [], gachaPool: [], mission: null, playerData: null,
    uniqueArray,
    parseShipData,
    parseEquipmentData,
    parseGachaData,
    parseMission,
    normalizePlayerData,
    shipHP,
    reach,
    deltaVPerTurn,
    costBetween,
    tryGacha,
    loadShipData,
    loadEquipmentData,
    loadGachaData,
    loadMission,
    loadInit
  });

  global.Game = Game;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Game;
  }
})(typeof window !== 'undefined' ? window : globalThis);
