(function (global) {
  'use strict';
  const Game = global.Game || {};

  Game.Constants = {
    // Δv 预算
    DV_MIN: 20,
    DV_MAX: 120,
    ISP_G0: 3000,
    FUEL_PER_TURN: 5,
    // 机动成本
    COST_PER_LON: 20,
    COST_PER_BAND: 100,
    // 战斗
    DAMAGE_DIVISOR: 30,
    DODGE_DIVISOR: 150,
    DODGE_CAP: 0.3,
    ARMOR_DIVISOR: 50,
    TURRET_DAMAGE: 1,
    TURRET_RANGE: 2,          // 炮台扇形射程：±列数
    // 能量与技能
    ENERGY_START: 2,
    ENERGY_PER_TURN: 1,
    SKILL_COST_EMP: 2,
    SKILL_COST_OVERLOAD: 1,
    SKILL_COST_DECOY: 1,
    // 撤退 / 主炮
    RETREAT_COOLDOWN: 2,
    MAIN_CANNON_TURNS: 14,
    // 抽卡
    GACHA_COST: 100,
    GACHA_REFUND: 50,
    // 棋盘
    LON_COUNT: 16,
    BANDS: ['E', 'N', 'S'],
    DEG_PER_COL: 22.5,     // 每列 22.5°（360/16）
    DEG_PER_BAND: 45,      // 每带 45°
    ROTATION_SPEED: 22.5    // 每回合行星自转角度（连续）
  };

  global.Game = Game;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Game;
  }
})(typeof window !== 'undefined' ? window : globalThis);
