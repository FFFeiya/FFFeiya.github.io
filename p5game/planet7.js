// ============ 全局变量与状态 ============
let gameState = 'dialog'; // 初始状态为对话界面

// 数据相关
let ships = [];        // 所有舰船数据
let equipments = [];   // 所有装备数据
let levels = [];       // 所有关卡数据
let gachaPool = [];    // 抽卡池数据
let playerData = {     // 玩家数据
  coins: 2000, // 初始金币为2000
  ownedShips: [], // 拥有的舰船
  unlockedShipBlueprints: [], // 解锁的舰船图纸
  ownedEquipments: [], // 拥有的装备
  unlockedEquipBlueprints: [], // 解锁的装备图纸
  clearedLevels: [] // 已通关的关卡
};

// 舰队编成相关
let fleetSlots = []; // 舰队槽位
let playerFleet = []; // 玩家保存的舰队（ship, equipments, totalEquipmentMass）
let currentModal = null; // 当前弹窗

// UI相关
let mainMenuButtons = [];
let fleetFormationSaveButton;

// 抽卡和蓝图解锁按钮
let fleetResearchButtons = []; // 存储抽卡和蓝图解锁按钮

// 星球和轨道参数
let radius = 200; 
let centerX, centerY;
let selectedOrbitIndex = 0;
let rotationAngle = 0;
const G = 6.67430e-11; 
let planetMass = 5.972e24;

// 战斗相关
let satellites = [];
let redPoints = [];
let battleLog = [];
const maxBattleLog = 100;
const maxVisibleLogs = 15;

// 模型相关
let shipModels = {};
let defaultModel;
let modelsLoaded = false;

// 属性克制关系
const strongAgainst = {
  'Water': ['Fire'],
  'Fire': ['Poison'],
  'Poison': ['Water'],
  'Holy Light': ['Shadow'],
  'Shadow': ['Energy'],
  'Energy': ['Holy Light']
};

const weakAgainst = {
  'Holy Light': ['Water', 'Fire', 'Poison'],
  'Shadow': ['Water', 'Fire', 'Poison'],
  'Energy': ['Normal']
};

// 文件路径
const SHIP_DATA_FILE = 'ship.dat';
const EQUIP_DATA_FILE = 'equipment.dat';
const LEVEL_DATA_FILE = 'level.dat';
const GACHA_DATA_FILE = 'gacha.dat';

// HTML文件中需要有一个隐藏的文件输入元素用于加载进度
// <input type="file" id="fileInput" style="display:none" />

// 对话脚本
let dialogManager;

// ============ preload ============
function preload() {
  // 预加载默认模型
  defaultModel = loadModel('models/default.obj', true, 
    () => {},
    () => { console.error('加载默认模型失败。'); }
  );

  // 读取数据文件
  loadShipData();
  loadEquipmentData();
  loadLevelData();
  loadGachaData();
}

// ============ setup ============
function setup() {
  createCanvas(1200, 900); // 设置画布大小
  textAlign(CENTER, CENTER);
  centerX = width / 2;
  centerY = height / 2;

  // 加载玩家数据
  loadPlayerDataFromLocalStorage();

  // 初始化主菜单按钮
  initMainMenuButtons();

  // 初始化舰队研发按钮
  initFleetResearchButtons();

  // 初始化舰队编成保存按钮
  fleetFormationSaveButton = new Button(centerX - 150, centerY + 150, 300, 50, '保存舰队', () => {
    saveFleetFormation();
  });

  // 初始化舰队槽位
  initFleetFormation();

  // 初始化对话管理器
  dialogManager = new DialogManager();

  // 初始对话脚本
  let initialDialog = [
    "欢迎来到舰队战斗游戏！",
    "在这里，你可以编成自己的舰队，研究新装备，挑战各种关卡。",
    "让我们开始吧！"
  ];
  dialogManager.startDialog(initialDialog, () => {
    gameState = 'mainMenu';
  });
}

// ============ draw ============
function draw() {
  background(240); // 淡灰色背景
  noStroke();
  fill(0);

  if (gameState === 'dialog') {
    dialogManager.display();
  } else if (gameState === 'mainMenu') {
    drawMainMenu();
  } else if (gameState === 'levelSelect') {
    drawLevelSelect();
  } else if (gameState === 'fleetFormation') {
    drawFleetFormation();
    if (currentModal) {
      currentModal.update();
      currentModal.display();
    }
    drawSelectedShipPreviewFleet(); 
  } else if (gameState === 'fleetResearch') {
    drawFleetResearch();
    if (currentModal) {
      currentModal.update();
      currentModal.display();
    }
  } else if (gameState === 'battle') {
    drawBattle();
    drawBattleLog();
    drawSelectedShipPreview();
    drawMiniMap();
    if (currentModal) {
      currentModal.update();
      currentModal.display();
    }
  } else if (gameState === 'victory') {
    drawVictoryScreen();
  } else if (gameState === 'defeat') {
    drawDefeatScreen();
  }
}

// ============ 数据加载与解析函数 ============
function loadShipData() {
  // 使用loadStrings异步加载ship.dat
  loadStrings(SHIP_DATA_FILE, parseShipData);
}

function parseShipData(data) {
  ships = [];
  for (let line of data) {
    if (line.trim() === '' || line.startsWith('#')) continue; // 忽略空行和注释
    let parts = line.split(',');
    // 检查数据是否完整
    if (parts.length < 12) {
      console.error('无效的舰船数据:', line);
      continue;
    }
    let s = {
      name: parts[0].trim(),
      type: parts[1].trim(),
      firepower: parseFloat(parts[2]),
      aa: parseFloat(parts[3]),
      endurance: parseFloat(parts[4]),
      armor: parseFloat(parts[5]),
      evasion: parseFloat(parts[6]),
      carryCapacity: parseFloat(parts[7]),
      range: parseFloat(parts[8]),
      minOrbit: parseFloat(parts[9]),
      price: parseFloat(parts[10]),
      attribute: translateAttribute(parts[11].trim())
    };
    if (!s.name) {
      console.error('舰船名称未定义:', line);
      continue;
    }
    ships.push(s);

    // 预加载舰船模型，若加载失败则使用默认模型
    let modelPath = `models/${s.name}.obj`;
    shipModels[s.name] = loadModel(modelPath, true, 
      () => { 
        // 模型加载成功
      },
      () => { 
        console.error(`加载模型失败: ${modelPath}, 使用默认模型。`);
        shipModels[s.name] = defaultModel; // 加载失败时使用默认模型
      }
    );
  }
}

function loadEquipmentData() {
  loadStrings(EQUIP_DATA_FILE, parseEquipmentData);
}

function parseEquipmentData(data) {
  equipments = [];
  for (let line of data) {
    if (line.trim() === '' || line.startsWith('#')) continue; // 忽略空行和注释
    let parts = line.split(',');
    // 检查数据是否完整
    if (parts.length < 9) {
      console.error('无效的装备数据:', line);
      continue;
    }
    let e = {
      name: parts[0].trim(),
      firepower: parseFloat(parts[1]),
      aa: parseFloat(parts[2]),
      armor: parseFloat(parts[3]),
      evasion: parseFloat(parts[4]),
      range: parseFloat(parts[5]),
      mass: parseFloat(parts[6]),
      attribute: translateAttribute(parts[7].trim()),
      price: parseFloat(parts[8])
    };
    if (!e.name) {
      console.error('装备名称未定义:', line);
      continue;
    }
    equipments.push(e);
  }
}

function loadLevelData() {
  loadStrings(LEVEL_DATA_FILE, parseLevelData);
}

function parseLevelData(data) {
  levels = [];
  let idx = 0;
  while (idx < data.length) {
    // 读取关卡基本信息
    let levelLine = data[idx++].trim();
    if (levelLine === '' || levelLine.startsWith('#')) continue; // 忽略空行和注释
    let parts = levelLine.split(',');
    if (parts.length < 4) {
      console.error('无效的关卡基本信息:', levelLine);
      continue;
    }
    let lvl = {
      id: parseInt(parts[0]),
      planetMass: parseFloat(parts[1]),
      planetRotationSpeed: parseFloat(parts[2]),
      planetRadius: parseFloat(parts[3]),
      redPoints: [],
      drops: [],
      rewardCoinsMin: 0,
      rewardCoinsMax: 0
    };

    // 读取红点数量
    if (idx >= data.length) break;
    let redCountLine = data[idx++].trim();
    if (redCountLine === '' || redCountLine.startsWith('#')) continue;
    let redCount = parseInt(redCountLine);

    // 读取红点信息
    for (let i = 0; i < redCount; i++) {
      if (idx >= data.length) break;
      let rpLine = data[idx++].trim();
      if (rpLine === '' || rpLine.startsWith('#')) {
        i--;
        continue;
      }
      let rpParts = rpLine.split(',');
      if (rpParts.length < 11) { // 根据错误信息，检查是否有足够的字段
        console.error('无效的红点数据:', rpLine);
        continue;
      }
      let rpObj = {
        id: i, // 为每个红点分配唯一ID
        name: rpParts[0].trim(),
        firepower: parseFloat(rpParts[1]),
        aa: parseFloat(rpParts[2]),
        endurance: parseFloat(rpParts[3]),
        armor: parseFloat(rpParts[4]),
        evasion: parseFloat(rpParts[5]),
        range: parseFloat(rpParts[6]),
        attribute: translateAttribute(rpParts[7].trim()),
        lat: parseFloat(rpParts[8]),
        lon: parseFloat(rpParts[9]),
        minOrbit: parseFloat(rpParts[10]),
        health: parseFloat(rpParts[3]) // 注意：这里的健康值是否应为 parts[3]（endurance）？
      };
      if (rpObj.minOrbit > 0) {
        // 轨道红点
        rpObj.orbitRadius = lvl.planetRadius + rpObj.minOrbit;
        rpObj.orbitalSpeed = sqrt((G * lvl.planetMass) / (rpObj.orbitRadius * 1000)) * 10;
        rpObj.orbitalSpeed *= 1e-6;
        rpObj.angle = radians(rpObj.lon);
      }
      lvl.redPoints.push(rpObj);
    }

    // 读取奖励金币范围
    if (idx >= data.length) break;
    let rewardCoinsLine = data[idx++].trim();
    if (rewardCoinsLine === '' || rewardCoinsLine.startsWith('#')) continue;
    let rewardParts = rewardCoinsLine.split(',');
    if (rewardParts.length < 2) {
      console.error('无效的奖励金币数据:', rewardCoinsLine);
    } else {
      lvl.rewardCoinsMin = parseInt(rewardParts[0]);
      lvl.rewardCoinsMax = parseInt(rewardParts[1]);
    }

    // 读取掉落数量
    if (idx >= data.length) break;
    let dropCountLine = data[idx++].trim();
    if (dropCountLine === '' || dropCountLine.startsWith('#')) continue;
    let dropCount = parseInt(dropCountLine);

    // 读取掉落物品信息
    for (let i = 0; i < dropCount; i++) {
      if (idx >= data.length) break;
      let dropLine = data[idx++].trim();
      if (dropLine === '' || dropLine.startsWith('#')) {
        i--;
        continue;
      }
      let dropParts = dropLine.split(',');
      if (dropParts.length < 2) {
        console.error('无效的掉落数据:', dropLine);
        continue;
      }
      lvl.drops.push({
        name: dropParts[0].trim(),
        probability: parseFloat(dropParts[1])
      });
    }

    // 归一化抽卡池概率
    let totalProbability = lvl.drops.reduce((sum, item) => sum + item.probability, 0);
    if (totalProbability === 0) {
      console.error('抽卡池总概率为零。');
      lvl.drops = [];
    } else {
      lvl.drops = lvl.drops.map(item => ({
        name: item.name,
        probability: item.probability / totalProbability
      }));
    }

    levels.push(lvl);
  }

  // 按关卡ID排序
  levels.sort((a, b) => a.id - b.id);
}

function loadGachaData() {
  loadStrings(GACHA_DATA_FILE, parseGachaData);
}

function parseGachaData(data) {
  gachaPool = [];
  for (let line of data) {
    if (line.trim() === '' || line.startsWith('#')) continue; // 忽略空行和注释
    let parts = line.split(',');
    if (parts.length < 2) {
      console.error('无效的抽卡数据:', line);
      continue;
    }
    gachaPool.push({name: parts[0].trim(), probability: parseFloat(parts[1])});
  }

  // 归一化gachaPool概率
  let totalProbability = gachaPool.reduce((sum, item) => sum + item.probability, 0);
  if (totalProbability === 0) {
    console.error('抽卡池总概率为零。');
    gachaPool = [];
  } else {
    gachaPool = gachaPool.map(item => ({
      name: item.name,
      probability: item.probability / totalProbability
    }));
  }
}

// ============ 玩家数据加载与保存 ============
function loadPlayerDataFromLocalStorage() {
  let savedData = localStorage.getItem('playerData');
  if (savedData) {
    try {
      let loadedData = JSON.parse(savedData);
      // 验证数据结构
      if (
        loadedData.coins !== undefined && 
        Array.isArray(loadedData.ownedShips) &&
        Array.isArray(loadedData.unlockedShipBlueprints) &&
        Array.isArray(loadedData.ownedEquipments) &&
        Array.isArray(loadedData.unlockedEquipBlueprints) &&
        Array.isArray(loadedData.clearedLevels)
      ) {
        playerData = loadedData;
      } else {
        throw new Error('数据结构不正确。');
      }
    } catch (e) {
      console.error('从 localStorage 解析 playerData 失败:', e);
      // 如果解析失败，初始化新游戏数据
      playerData = { 
        coins: 2000, 
        ownedShips: [], 
        unlockedShipBlueprints: [], 
        ownedEquipments: [], 
        unlockedEquipBlueprints: [], 
        clearedLevels: [] 
      };
      savePlayerDataToLocalStorage();
    }
  } else {
    // 新游戏数据
    playerData = { 
      coins: 2000, 
      ownedShips: [], 
      unlockedShipBlueprints: [], 
      ownedEquipments: [], 
      unlockedEquipBlueprints: [], 
      clearedLevels: [] 
    };
    savePlayerDataToLocalStorage();
  }
}

function savePlayerDataToLocalStorage() {
  localStorage.setItem('playerData', JSON.stringify(playerData));
}

function saveProgressToFile() {
  let blob = new Blob([JSON.stringify(playerData, null, 2)], { type: 'application/json' });
  saveAs(blob, 'playerProgress.json');
}

function loadProgressFromFile(file) {
  let reader = new FileReader();
  reader.onload = function(e) {
    try {
      let loadedData = JSON.parse(e.target.result);
      // 验证数据结构
      if (
        loadedData.coins !== undefined && 
        Array.isArray(loadedData.ownedShips) &&
        Array.isArray(loadedData.unlockedShipBlueprints) &&
        Array.isArray(loadedData.ownedEquipments) &&
        Array.isArray(loadedData.unlockedEquipBlueprints) &&
        Array.isArray(loadedData.clearedLevels)
      ) {
        playerData = loadedData;
        currentModal = new InfoModal('进度加载成功！');
        savePlayerDataToLocalStorage();
      } else {
        throw new Error('数据结构不正确。');
      }
    } catch (err) {
      console.error('加载玩家进度失败:', err);
      currentModal = new InfoModal('加载进度失败。请检查文件格式。');
    }
  };
  reader.readAsText(file);
}

function saveFleetFormation() {
  // 检查舰船的搭载是否超载
  for (let slot of fleetSlots) {
    if (slot.ship) {
      if (slot.totalEquipmentMass > slot.ship.carryCapacity) {
        currentModal = new InfoModal(`舰船 ${slot.ship.name} 超载！无法保存。`);
        return;
      }
    }
  }

  // 保存玩家编成数据
  playerFleet = fleetSlots.map(slot => {
    return {
      ship: slot.ship ? slot.ship.name : null,
      equipments: slot.equipments.map(eq => eq ? eq.name : null),
      totalEquipmentMass: slot.totalEquipmentMass
    };
  });

  savePlayerDataToLocalStorage();
  currentModal = new InfoModal('舰队保存成功！');
}

// ============ 数据翻译 ============
function translateAttribute(attr) {
  const translation = {
    '火': 'Fire',
    '水': 'Water',
    '毒': 'Poison',
    '圣光': 'Holy Light',
    '暗影': 'Shadow',
    '幽能': 'Energy',
    '普通': 'Normal',
    '火&毒': 'Fire&Poison',
    'Fire': 'Fire',
    'Water': 'Water',
    'Poison': 'Poison',
    'Holy Light': 'Holy Light',
    'Shadow': 'Shadow',
    'Energy': 'Energy',
    'Normal': 'Normal',
    'Fire&Poison': 'Fire&Poison'
  };
  return translation[attr] || attr;
}

// ============ 类定义 ============
class Button {
  constructor(x, y, w, h, label, onClick) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.label = label;
    this.onClick = onClick;
    this.isHovered = false;
  }

  update() {
    if (
      mouseX >= this.x &&
      mouseX <= this.x + this.w &&
      mouseY >= this.y &&
      mouseY <= this.y + this.h
    ) {
      this.isHovered = true;
      cursor(HAND);
    } else {
      this.isHovered = false;
      cursor(ARROW);
    }
  }

  display() {
    push();
    fill(this.isHovered ? 200 : 255);
    stroke(0);
    rect(this.x, this.y, this.w, this.h);
    fill(0);
    noStroke();
    textSize(16);
    textAlign(CENTER, CENTER);
    text(this.label, this.x + this.w / 2, this.y + this.h / 2);
    pop();
  }

  clicked() {
    if (this.isHovered && this.onClick) {
      this.onClick();
    }
  }
}

class FleetSlot {
  constructor(x, y, w, h, type) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type; // 'Active' 或 'Reserve'
    this.ship = null;
    this.equipments = [null, null, null, null];
    this.totalEquipmentMass = 0;
    this.isHovered = false;
  }

  update() {
    if (
      mouseX >= this.x &&
      mouseX <= this.x + this.w &&
      mouseY >= this.y &&
      mouseY <= this.y + this.h
    ) {
      this.isHovered = true;
    } else {
      this.isHovered = false;
    }
  }

  display() {
    push();
    fill(this.isHovered && !currentModal ? 220 : 255);
    stroke(0);
    rect(this.x, this.y, this.w, this.h);

    fill(0);
    textSize(16);
    textAlign(CENTER, TOP);
    text(this.type, this.x + this.w / 2, this.y + 10);

    if (this.ship) {
      // 显示舰船名称
      textSize(14);
      text(this.ship.name, this.x + this.w / 2, this.y + 40);

      // 显示四个装备格子
      let eqSize = 30;
      for (let i = 0; i < 4; i++) {
        let eqX = this.x + 10 + i * (eqSize + 10);
        let eqY = this.y + 70;
        let equip = this.equipments[i];
        // 检测装备格子的悬停状态
        let isEquipHovered = (mouseX >= eqX && mouseX <= eqX + eqSize &&
                              mouseY >= eqY && mouseY <= eqY + eqSize && !currentModal);
        fill(isEquipHovered ? 200 : (equip ? 180 : 240));
        stroke(0);
        rect(eqX, eqY, eqSize, eqSize);

        if (equip) {
          fill(0);
          noStroke();
          textSize(10);
          textAlign(CENTER, CENTER);
          text(equip.name.slice(0, 4), eqX + eqSize / 2, eqY + eqSize / 2);
        }
      }

      // 显示属性
      textSize(12);
      textAlign(LEFT, TOP);
      let attrs = this.calculateAttributes();
      text(`FP: ${attrs.firepower.toFixed(1)} AA: ${attrs.aa.toFixed(1)}`, this.x + 10, this.y + 120);
      text(`End: ${attrs.endurance} Armor: ${attrs.armor}`, this.x + 10, this.y + 135);
      text(`Evade: ${attrs.evasion} Load: ${this.totalEquipmentMass}/${this.ship.carryCapacity}`, this.x + 10, this.y + 150);
      text(`Range: ${attrs.range} Min Orbit: ${this.ship.minOrbit}`, this.x + 10, this.y + 165);
    } else {
      textSize(14);
      textAlign(CENTER, CENTER);
      text('点击选择舰船', this.x + this.w / 2, this.y + this.h / 2);
    }
    pop();
  }

  clicked() {
    // 检测装备格子的点击
    if (this.ship) {
      let eqSize = 30;
      for (let i = 0; i < 4; i++) {
        let eqX = this.x + 10 + i * (eqSize + 10);
        let eqY = this.y + 70;
        if (
          mouseX >= eqX &&
          mouseX <= eqX + eqSize &&
          mouseY >= eqY &&
          mouseY <= eqY + eqSize &&
          !currentModal
        ) {
          // 显示装备选择弹窗
          currentModal = new EquipmentSelectionModal(this, i);
          return;
        }
      }
    }

    // 检测舰船槽位的点击
    if (this.isHovered && !currentModal) {
      // 显示舰船选择弹窗
      currentModal = new ShipSelectionModal(this);
    }
  }

  calculateAttributes() {
    let attributes = {
      firepower: this.ship.firepower,
      aa: this.ship.aa,
      endurance: this.ship.endurance,
      armor: this.ship.armor,
      evasion: this.ship.evasion,
      range: this.ship.range,
    };

    this.totalEquipmentMass = 0;
    for (let eq of this.equipments) {
      if (eq) {
        attributes.firepower += eq.firepower || 0;
        attributes.aa += eq.aa || 0;
        attributes.armor += eq.armor || 0;
        attributes.evasion += eq.evasion || 0;
        attributes.range += eq.range || 0;
        this.totalEquipmentMass += eq.mass || 0;
      }
    }

    return attributes;
  }
}

class ShipSelectionModal {
  constructor(fleetSlot) {
    this.fleetSlot = fleetSlot;
    this.selectedShip = null;
    this.scrollOffset = 0;
    this.itemHeight = 30;
    this.visibleItems = 10;
    this.width = 600;
    this.height = 400;
    this.x = centerX - this.width / 2;
    this.y = centerY - this.height / 2;
  }

  update() {
    // 不需要更新
  }

  display() {
    push();
    // 绘制模态框背景
    fill(255);
    stroke(0);
    rect(this.x, this.y, this.width, this.height);

    // 绘制舰船列表左侧
    let listX = this.x + 10;
    let listY = this.y + 10;
    let listWidth = 200;
    let listHeight = this.height - 20;

    // 绘制滚动的舰船列表
    textAlign(LEFT, TOP);
    textSize(14);
    fill(0);
    text('选择一艘舰船:', listX, listY - 20);
    let ownedShips = playerData.ownedShips.filter(shipName => playerData.unlockedShipBlueprints.includes(shipName));
    for (let i = 0; i < ownedShips.length; i++) { // 仅显示拥有并解锁图纸的舰船
      let shipName = ownedShips[i];
      let ship = ships.find(s => s.name === shipName);
      if (!ship) continue;
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        let isHovered = (mouseX >= listX && mouseX <= listX + listWidth &&
                        mouseY >= y && mouseY <= y + this.itemHeight);
        
        if (isHovered) {
          fill(200);
        } else {
          fill(255);
        }
        stroke(0);
        rect(listX, y, listWidth, this.itemHeight);

        fill(0);
        noStroke();
        text(ship.name, listX + 5, y + this.itemHeight / 2 - 7);
      }
    }

    // 绘制右侧选中舰船的信息与模型预览
    let detailX = this.x + 220;
    let detailY = this.y + 10;
    let detailWidth = 370;
    let detailHeight = this.height - 20;

    if (this.selectedShip) {
      fill(0);
      textSize(16);
      text(this.selectedShip.name, detailX + detailWidth / 2, detailY + 20);

      // 显示舰船属性
      textSize(14);
      let attrs = [
        `类型: ${this.selectedShip.type}`,
        `火力: ${this.selectedShip.firepower}`,
        `防空: ${this.selectedShip.aa}`,
        `耐久: ${this.selectedShip.endurance}`,
        `装甲: ${this.selectedShip.armor}`,
        `闪避: ${this.selectedShip.evasion}`,
        `载重: ${this.selectedShip.carryCapacity}`,
        `射程: ${this.selectedShip.range}`,
        `最小轨道: ${this.selectedShip.minOrbit}`,
        `属性: ${this.selectedShip.attribute}`
      ];
      textAlign(LEFT, TOP);
      for (let i = 0; i < attrs.length; i++) {
        text(attrs[i], detailX + 20, detailY + 50 + i * 20);
      }

      // 绘制模型预览区域
      fill(255);
      stroke(0);
      rect(detailX + 200, detailY + 50, 150, 150);
      let modelGraphics = createGraphics(140, 140, WEBGL);
      modelGraphics.background(255);
      modelGraphics.stroke(0);
      modelGraphics.noFill();
      modelGraphics.push();
      modelGraphics.rotateY(frameCount * 0.01);
      modelGraphics.scale(1.0); 
      let modelToRender = shipModels[this.selectedShip.name] || defaultModel;
      if (modelToRender) {
        modelGraphics.model(modelToRender);
      } else {
        modelGraphics.fill(0);
        modelGraphics.textSize(16);
        modelGraphics.text('加载中...', 0, 0);
      }
      modelGraphics.pop();
      image(modelGraphics, detailX + 205, detailY + 55, 140, 140);
    } else {
      fill(0);
      textSize(16);
      textAlign(CENTER, CENTER);
      text('未选择舰船', detailX + detailWidth / 2, detailY + detailHeight / 2);
    }

    // 绘制确定按钮
    let btnX = this.x + 250;
    let btnY = this.y + this.height - 60;
    let btnW = 200; // 拉长按钮宽度
    let btnH = 40;
    let isHovered = (mouseX >= btnX && mouseX <= btnX + btnW &&
                    mouseY >= btnY && mouseY <= btnY + btnH);
    if (isHovered) {
      fill(200);
    } else {
      fill(255);
    }
    stroke(0);
    rect(btnX, btnY, btnW, btnH);

    fill(0);
    noStroke();
    textSize(14);
    text('确认选择', btnX + btnW / 2, btnY + btnH / 2 - 7);

    // 绘制关闭按钮
    let closeBtnX = this.x + this.width - 50;
    let closeBtnY = this.y + 10;
    let closeBtnW = 30;
    let closeBtnH = 30;
    let isCloseHovered = (mouseX >= closeBtnX && mouseX <= closeBtnX + closeBtnW &&
                         mouseY >= closeBtnY && mouseY <= closeBtnY + closeBtnH);
    if (isCloseHovered) {
      fill(200);
    } else {
      fill(255);
    }
    stroke(0);
    ellipse(closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2, closeBtnW, closeBtnH);
    fill(0);
    textSize(20);
    text('×', closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2 - 10);
    pop();
  }

  mousePressed() {
    // 获取可选择的舰船列表
    let ownedShips = playerData.ownedShips.filter(shipName => playerData.unlockedShipBlueprints.includes(shipName));
    for (let i = 0; i < ownedShips.length; i++) { // 仅处理拥有并解锁图纸的舰船
      let shipName = ownedShips[i];
      let ship = ships.find(s => s.name === shipName);
      if (!ship) continue;
      let y = this.y + 10 + (i - this.scrollOffset) * this.itemHeight;
      if (y >= this.y + 10 && y <= this.y + this.height - 30) {
        if (mouseX >= this.x + 10 && mouseX <= this.x + 210 &&
            mouseY >= y && mouseY <= y + this.itemHeight) {
          this.selectedShip = ship;
        }
      }
    }

    // 检测确定按钮点击
    let btnX = this.x + 250;
    let btnY = this.y + this.height - 60;
    let btnW = 200; // 拉长按钮宽度
    let btnH = 40;
    if (mouseX >= btnX && mouseX <= btnX + btnW &&
        mouseY >= btnY && mouseY <= btnY + btnH) {
      if (this.selectedShip) {
        this.fleetSlot.ship = this.selectedShip;
        this.fleetSlot.equipments = [null, null, null, null];
        this.fleetSlot.totalEquipmentMass = 0;
        currentModal = null; // 关闭弹窗
        savePlayerDataToLocalStorage();
      }
    }

    // 检测关闭按钮点击
    let closeBtnX = this.x + this.width - 50;
    let closeBtnY = this.y + 10;
    let closeBtnW = 30;
    let closeBtnH = 30;
    if (dist(mouseX, mouseY, closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2) <= closeBtnW / 2) {
      currentModal = null; // 关闭弹窗
    }
  }

  mouseWheel(event) {
    // 处理滚动
    let delta = event.delta;
    this.scrollOffset += delta > 0 ? 1 : -1;
    this.scrollOffset = constrain(this.scrollOffset, 0, max(0, ownedShips.length - this.visibleItems));
    return false; // 阻止默认行为
  }
}

class EquipmentSelectionModal {
  constructor(fleetSlot, equipIndex) {
    this.fleetSlot = fleetSlot;
    this.equipIndex = equipIndex;
    this.selectedEquip = null;
    this.scrollOffset = 0;
    this.itemHeight = 30;
    this.visibleItems = 10;
    this.width = 600;
    this.height = 400;
    this.x = centerX - this.width / 2;
    this.y = centerY - this.height / 2;
  }

  update() {
    // 不需要更新
  }

  display() {
    push();
    // 绘制模态框背景
    fill(255);
    stroke(0);
    rect(this.x, this.y, this.width, this.height);

    // 绘制装备列表左侧
    let listX = this.x + 10;
    let listY = this.y + 10;
    let listWidth = 200;
    let listHeight = this.height - 20;

    // 绘制滚动的装备列表
    textAlign(LEFT, TOP);
    textSize(14);
    fill(0);
    text('选择装备:', listX, listY - 20);
    let ownedEquipments = playerData.ownedEquipments.filter(eqName => playerData.unlockedEquipBlueprints.includes(eqName));
    for (let i = 0; i < ownedEquipments.length; i++) { // 仅显示拥有并解锁图纸的装备
      let equipName = ownedEquipments[i];
      let equip = equipments.find(e => e.name === equipName);
      if (!equip) continue;
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        let isHovered = (mouseX >= listX && mouseX <= listX + listWidth &&
                        mouseY >= y && mouseY <= y + this.itemHeight);
        
        if (isHovered) {
          fill(200);
        } else {
          fill(255);
        }
        stroke(0);
        rect(listX, y, listWidth, this.itemHeight);

        fill(0);
        noStroke();
        text(equip.name, listX + 5, y + this.itemHeight / 2 - 7);
      }
    }

    // 绘制右侧选中装备的信息与模型预览
    let detailX = this.x + 220;
    let detailY = this.y + 10;
    let detailWidth = 370;
    let detailHeight = this.height - 20;

    if (this.selectedEquip) {
      fill(0);
      textSize(16);
      text(this.selectedEquip.name, detailX + detailWidth / 2, detailY + 20);

      // 显示装备属性
      textSize(14);
      let attrs = [
        `火力: ${this.selectedEquip.firepower}`,
        `防空: ${this.selectedEquip.aa}`,
        `装甲: ${this.selectedEquip.armor}`,
        `闪避: ${this.selectedEquip.evasion}`,
        `射程: ${this.selectedEquip.range}`,
        `质量: ${this.selectedEquip.mass}`,
        `属性: ${this.selectedEquip.attribute}`,
        `价格: ${this.selectedEquip.price}`
      ];
      textAlign(LEFT, TOP);
      for (let i = 0; i < attrs.length; i++) {
        text(attrs[i], detailX + 20, detailY + 50 + i * 20);
      }

      // 绘制模型预览区域（假设装备有模型，可根据需要调整）
      fill(255);
      stroke(0);
      rect(detailX + 200, detailY + 50, 150, 150);
      let modelGraphics = createGraphics(140, 140, WEBGL);
      modelGraphics.background(255);
      modelGraphics.stroke(0);
      modelGraphics.noFill();
      modelGraphics.push();
      modelGraphics.rotateY(frameCount * 0.01);
      modelGraphics.scale(1.0); 
      // 假设装备有对应的模型，实际中可能需要根据装备类型加载
      // 这里使用defaultModel作为示例
      let modelToRender = defaultModel;
      if (modelToRender) {
        modelGraphics.model(modelToRender);
      } else {
        modelGraphics.fill(0);
        modelGraphics.textSize(16);
        modelGraphics.text('加载中...', 0, 0);
      }
      modelGraphics.pop();
      image(modelGraphics, detailX + 205, detailY + 55, 140, 140);
    } else {
      fill(0);
      textSize(16);
      textAlign(CENTER, CENTER);
      text('未选择装备', detailX + detailWidth / 2, detailY + detailHeight / 2);
    }

    // 绘制确定装备按钮
    let btnX = this.x + 250;
    let btnY = this.y + this.height - 60;
    let btnW = 200; // 拉长按钮宽度
    let btnH = 40;
    let isHovered = (mouseX >= btnX && mouseX <= btnX + btnW &&
                    mouseY >= btnY && mouseY <= btnY + btnH);
    if (isHovered) {
      fill(200);
    } else {
      fill(255);
    }
    stroke(0);
    rect(btnX, btnY, btnW, btnH);

    fill(0);
    noStroke();
    textSize(14);
    text('确认装备', btnX + btnW / 2, btnY + btnH / 2 - 7);

    // 绘制取消按钮
    let cancelBtnX = this.x + 420;
    let cancelBtnY = this.y + this.height - 60;
    let cancelBtnW = 150;
    let cancelBtnH = 40;
    let isCancelHovered = (mouseX >= cancelBtnX && mouseX <= cancelBtnX + cancelBtnW &&
                          mouseY >= cancelBtnY && mouseY <= cancelBtnY + cancelBtnH);
    if (isCancelHovered) {
      fill(200);
    } else {
      fill(255);
    }
    stroke(0);
    rect(cancelBtnX, cancelBtnY, cancelBtnW, cancelBtnH);

    fill(0);
    noStroke();
    textSize(14);
    text('取消', cancelBtnX + cancelBtnW / 2, cancelBtnY + cancelBtnH / 2 - 7);

    // 绘制关闭按钮
    let closeBtnX = this.x + this.width - 40;
    let closeBtnY = this.y + 10;
    let closeBtnW = 30;
    let closeBtnH = 30;
    let isCloseHovered = (mouseX >= closeBtnX && mouseX <= closeBtnX + closeBtnW &&
                         mouseY >= closeBtnY && mouseY <= closeBtnY + closeBtnH);
    if (isCloseHovered) {
      fill(200);
    } else {
      fill(255);
    }
    stroke(0);
    ellipse(closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2, closeBtnW, closeBtnH);
    fill(0);
    textSize(20);
    text('×', closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2 - 10);
    pop();
  }

  mousePressed() {
    // 获取可选择的装备列表
    let ownedEquipments = playerData.ownedEquipments.filter(eqName => playerData.unlockedEquipBlueprints.includes(eqName));
    for (let i = 0; i < ownedEquipments.length; i++) { // 仅处理拥有并解锁图纸的装备
      let equipName = ownedEquipments[i];
      let equip = equipments.find(e => e.name === equipName);
      if (!equip) continue;
      let y = this.y + 10 + (i - this.scrollOffset) * this.itemHeight;
      if (y >= this.y + 10 && y <= this.y + this.height - 30) {
        // 检测复选框点击
        if (mouseX >= this.x + 220 && mouseX <= this.x + 240 &&
            mouseY >= y + 5 && mouseY <= y + 25) {
          if (this.selectedEquip === equip) {
            this.selectedEquip = null;
          } else {
            this.selectedEquip = equip;
          }
        }

        // 检测装备名称点击
        if (mouseX >= this.x + 10 && mouseX <= this.x + 210 &&
            mouseY >= y && mouseY <= y + this.itemHeight) {
          // 点击装备名称同样可以选择
          if (this.selectedEquip === equip) {
            this.selectedEquip = null;
          } else {
            this.selectedEquip = equip;
          }
        }
      }
    }

    // 检测确认装备按钮点击
    let btnX = this.x + 250;
    let btnY = this.y + this.height - 60;
    let btnW = 200; // 拉长按钮宽度
    let btnH = 40;
    if (mouseX >= btnX && mouseX <= btnX + btnW &&
        mouseY >= btnY && mouseY <= btnY + btnH) {
      if (this.selectedEquip) {
        // 检查是否已经装备此装备
        if (this.fleetSlot.equipments.includes(this.selectedEquip)) {
          currentModal = new InfoModal(`${this.selectedEquip.name} 已装备。`);
          return;
        }

        // 检查是否超载
        let newTotalMass = this.fleetSlot.totalEquipmentMass + this.selectedEquip.mass;
        if (newTotalMass > this.fleetSlot.ship.carryCapacity) {
          currentModal = new InfoModal(`装备 ${this.selectedEquip.name} 将超载舰船的载重能力。`);
          return;
        }

        this.fleetSlot.equipments[this.equipIndex] = this.selectedEquip;
        this.fleetSlot.totalEquipmentMass += this.selectedEquip.mass;
        currentModal = null; // 关闭弹窗
        savePlayerDataToLocalStorage();
      }
    }

    // 检测取消按钮点击
    let cancelBtnX = this.x + 420;
    let cancelBtnY = this.y + this.height - 60;
    let cancelBtnW = 150;
    let cancelBtnH = 40;
    if (mouseX >= cancelBtnX && mouseX <= cancelBtnX + cancelBtnW &&
        mouseY >= cancelBtnY && mouseY <= cancelBtnY + cancelBtnH) {
      this.selectedEquip = null;
      currentModal = null; // 关闭弹窗
    }

    // 检测关闭按钮点击
    let closeBtnX = this.x + this.width - 40;
    let closeBtnY = this.y + 10;
    let closeBtnW = 30;
    let closeBtnH = 30;
    if (dist(mouseX, mouseY, closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2) <= closeBtnW / 2) {
      currentModal = null; // 关闭弹窗
    }
  }

  mouseWheel(event) {
    // 处理滚动
    let delta = event.delta;
    this.scrollOffset += delta > 0 ? 1 : -1;
    this.scrollOffset = constrain(this.scrollOffset, 0, max(0, (this.type === 'ship' ? ships.length : equipments.length) - this.visibleItems));
    return false; // 阻止默认行为
  }
}

class InfoModal {
  constructor(text) {
    this.text = text;
    this.width = 300;
    this.height = 200;
    this.x = centerX - this.width / 2;
    this.y = centerY - this.height / 2;
  }

  update() {
    // 不需要更新
  }

  display() {
    push();
    // 绘制模态框背景
    fill(255);
    stroke(0);
    rect(this.x, this.y, this.width, this.height);

    fill(0);
    textSize(14);
    textAlign(CENTER, CENTER);
    text(this.text, this.x + this.width / 2, this.y + this.height / 2 - 30);

    // 绘制关闭按钮
    let btnW = 200; // 拉长按钮宽度
    let btnH = 40;
    let btnX = this.x + (this.width - btnW) / 2;
    let btnY = this.y + this.height - 60;
    let isHovered = (mouseX >= btnX && mouseX <= btnX + btnW &&
                    mouseY >= btnY && mouseY <= btnY + btnH);
    if (isHovered) {
      fill(200);
    } else {
      fill(255);
    }
    stroke(0);
    rect(btnX, btnY, btnW, btnH);

    fill(0);
    noStroke();
    textSize(16);
    textAlign(CENTER, CENTER);
    text('关闭', btnX + btnW / 2, btnY + btnH / 2 - 8);
    pop();
  }

  mousePressed() {
    // 检测关闭按钮点击
    let btnW = 200; // 拉长按钮宽度
    let btnH = 40;
    let btnX = this.x + (this.width - btnW) / 2;
    let btnY = this.y + this.height - 60;
    if (mouseX >= btnX && mouseX <= btnX + btnW &&
        mouseY >= btnY && mouseY <= btnY + btnH) {
      currentModal = null;
    }
  }
}

// 新增：对话管理器类
class DialogManager {
  constructor() {
    this.dialogs = []; // 对话内容
    this.currentIndex = 0; // 当前对话索引
    this.isActive = false; // 对话是否激活
    this.onEndCallback = null; // 对话结束后的回调函数
    this.width = width; // 对话框宽度
    this.height = 150; // 对话框高度
    this.x = 0;
    this.y = height - this.height - 50; // 放在屏幕下半部分
  }

  startDialog(dialogArray, onEndCallback) {
    this.dialogs = dialogArray;
    this.currentIndex = 0;
    this.isActive = true;
    this.onEndCallback = onEndCallback;
    gameState = 'dialog';
  }

  display() {
    if (!this.isActive) return;
    push();
    // 绘制对话框背景
    fill(255);
    stroke(0);
    rect(this.x, this.y, this.width, this.height);

    // 绘制助手立绘
    // 以下是用户提供的助手绘制代码，调整位置
    push();
    translate(this.x + 100, this.y + this.height / 2);
    scale(0.5);
    drawAssistantIllustration();
    pop();

    // 绘制对话文本
    fill(0);
    textSize(16);
    textAlign(LEFT, CENTER);
    text(this.dialogs[this.currentIndex], this.x + 220, this.y + this.height / 2);

    // 绘制跳过按钮
    let skipBtnW = 80;
    let skipBtnH = 30;
    let skipBtnX = this.x + this.width - skipBtnW - 10;
    let skipBtnY = this.y + 10;
    let isHovered = (mouseX >= skipBtnX && mouseX <= skipBtnX + skipBtnW &&
                    mouseY >= skipBtnY && mouseY <= skipBtnY + skipBtnH);
    if (isHovered) {
      fill(200);
    } else {
      fill(255);
    }
    stroke(0);
    rect(skipBtnX, skipBtnY, skipBtnW, skipBtnH);

    fill(0);
    noStroke();
    textSize(14);
    textAlign(CENTER, CENTER);
    text('跳过', skipBtnX + skipBtnW / 2, skipBtnY + skipBtnH / 2 - 2);
    pop();
  }

  nextDialog() {
    this.currentIndex++;
    if (this.currentIndex >= this.dialogs.length) {
      this.isActive = false;
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    }
  }

  mousePressed() {
    if (!this.isActive) return;
    // 检测跳过按钮点击
    let skipBtnW = 80;
    let skipBtnH = 30;
    let skipBtnX = this.x + this.width - skipBtnW - 10;
    let skipBtnY = this.y + 10;
    if (mouseX >= skipBtnX && mouseX <= skipBtnX + skipBtnW &&
        mouseY >= skipBtnY && mouseY <= skipBtnY + skipBtnH) {
      this.nextDialog(); // 跳过当前对话
      return;
    }

    // 点击对话框任意位置，进入下一句话
    this.nextDialog();
  }
}

// 新增：绘制助手立绘函数
function drawAssistantIllustration() {
  // 设置线条样式
  stroke(0); // 黑色线条
  strokeWeight(3);
  noFill();

  // 画女孩的头部
  ellipse(0, -50, 100, 100);  // 头部

  // 画女孩的眼睛
  ellipse(-25, -60, 20, 20);  // 左眼
  ellipse(25, -60, 20, 20);  // 右眼

  // 画女孩的瞳孔
  fill(0);
  ellipse(-25, -60, 10, 10);  // 左瞳孔
  ellipse(25, -60, 10, 10);  // 右瞳孔

  // 画嘴巴
  noFill();
  arc(0, -40, 40, 30, 0, PI);  // 嘴巴

  // 画女孩的头发（简化几何形状）
  beginShape();
  vertex(-50, -70);
  vertex(-60, -110);
  vertex(-40, -90);
  vertex(-20, -100);
  vertex(0, -90);
  vertex(20, -100);
  vertex(40, -90);
  vertex(60, -110);
  vertex(50, -70);
  endShape(CLOSE);

  // 画女孩的身体
  rect(-30, -10, 60, 120);  // 身体

  // 画裙子
  beginShape();
  vertex(-30, 110);
  vertex(30, 110);
  vertex(50, 170);
  vertex(-50, 170);
  endShape(CLOSE);

  // 画舰娘风格的元素：例如舰炮，作为装饰
  line(-20, 50, -20, 20);  // 画舰炮的管道
  line(20, 50, 20, 20);  // 画舰炮的管道

  // 画手臂
  line(-30, -10, -70, 40);  // 左臂
  line(30, -10, 70, 40);  // 右臂

  // 画腿部
  line(-20, 230, -20, 270);  // 左腿
  line(20, 230, 20, 270);  // 右腿

  // 绘制一些几何学元素：例如盾牌形状作为背景装饰
  beginShape();
  vertex(-200, 350);
  vertex(-160, 380);
  vertex(-120, 360);
  vertex(-80, 380);
  vertex(-40, 360);
  vertex(0, 380);
  vertex(40, 360);
  vertex(80, 380);
  vertex(120, 360);
  vertex(160, 380);
  vertex(200, 350);
  vertex(170, 320);
  vertex(130, 320);
  vertex(90, 300);
  vertex(50, 320);
  vertex(10, 320);
  endShape(CLOSE);
}

// ============ 初始化舰队编成槽位 ============
function initFleetFormation() {
  fleetSlots = [];
  let margin = centerX - 300; // Positioned towards left
  let spacing = 20;
  let slotWidth = 200;
  let slotHeight = 200;

  for (let i = 0; i < 6; i++) {
    let x = margin + (i % 3) * (slotWidth + spacing);
    let y = centerY - 300 + Math.floor(i / 3) * (slotHeight + spacing);
    let slot = new FleetSlot(x, y, slotWidth, slotHeight, i < 4 ? 'Active' : 'Reserve');

    // 如果有保存的舰队，加载舰船和装备
    if (playerFleet && playerFleet[i]) {
      let shipName = playerFleet[i].ship;
      let ship = ships.find(s => s.name === shipName);
      if (ship) {
        slot.ship = ship;
        slot.equipments = playerFleet[i].equipments.map(eqName => equipments.find(e => e && e.name === eqName));
        slot.totalEquipmentMass = playerFleet[i].totalEquipmentMass;
      }
    }
    fleetSlots.push(slot);
  }
}

// ============ 按钮与UI相关函数 ============
function initMainMenuButtons() {
  mainMenuButtons = []; // 确保按钮数组为空

  mainMenuButtons.push(new Button(centerX - 150, centerY - 250, 300, 50, '选择关卡', () => {
    // 开始关卡选择前的对话
    let dialog = [
      "选择关卡开始战斗。",
      "每个关卡都有不同的挑战。",
      "请选择一个关卡进行战斗。"
    ];
    dialogManager.startDialog(dialog, () => {
      gameState = 'levelSelect';
    });
  }));
  mainMenuButtons.push(new Button(centerX - 150, centerY - 170, 300, 50, '舰队编成', () => {
    // 开始舰队编成前的对话
    let dialog = [
      "在舰队编成界面中，你可以组建和管理你的舰队。",
      "选择你拥有的舰船和装备，构建最强舰队。"
    ];
    dialogManager.startDialog(dialog, () => {
      gameState = 'fleetFormation';
      initFleetFormation();
    });
  }));
  mainMenuButtons.push(new Button(centerX - 150, centerY - 90, 300, 50, '舰队研发', () => {
    // 开始舰队研发前的对话
    let dialog = [
      "在舰队研发界面中，你可以抽取新的舰船和装备。",
      "解锁图纸以研究和装备更强大的武器。"
    ];
    dialogManager.startDialog(dialog, () => {
      gameState = 'fleetResearch';
      initFleetResearchButtons(); // 重新初始化以更新解锁按钮
    });
  }));
  mainMenuButtons.push(new Button(centerX - 150, centerY - 10, 300, 50, '保存进度', () => {
    saveProgressToFile();
  }));
  mainMenuButtons.push(new Button(centerX - 150, centerY + 70, 300, 50, '加载进度', () => {
    document.getElementById('fileInput').click();
  }));
  mainMenuButtons.push(new Button(centerX - 150, centerY + 150, 300, 50, '退出游戏', () => {
    // 退出游戏，在浏览器中可以重载页面
    window.location.reload();
  }));

  // 监听文件输入变化
  document.getElementById('fileInput').addEventListener('change', function(event) {
    let file = event.target.files[0];
    if (file) {
      loadProgressFromFile(file);
    }
  });
}

function initFleetResearchButtons() {
  fleetResearchButtons = []; // 清空按钮数组

  // 抽卡按钮
  fleetResearchButtons.push(new Button(centerX - 200, 250, 300, 50, '抽卡 x1 (100金币)', () => {
    tryGacha(1);
  }));
  fleetResearchButtons.push(new Button(centerX + 50, 250, 300, 50, '抽卡 x5 (500金币)', () => {
    tryGacha(5);
  }));

  // 解锁舰船图纸按钮
  fleetResearchButtons.push(new Button(centerX - 150, 350, 300, 50, '解锁舰船图纸', () => {
    // 打开解锁舰船图纸的弹窗
    currentModal = new UnlockBlueprintModal('ship');
  }));

  // 解锁装备图纸按钮
  fleetResearchButtons.push(new Button(centerX - 150, 420, 300, 50, '解锁装备图纸', () => {
    // 打开解锁装备图纸的弹窗
    currentModal = new UnlockBlueprintModal('equipment');
  }));
}

// ============ 绘制主菜单 ============
function drawMainMenu() {
  push();
  // 无需全局平移
  fill(0);
  textSize(48);
  textAlign(CENTER, CENTER);
  text('舰队战斗游戏', centerX, 150);

  for (let btn of mainMenuButtons) {
    btn.update();
    btn.display();
  }
  pop();
}

// ============ 绘制关卡选择界面 ============
function drawLevelSelect() {
  push();
  fill(0);
  textSize(32);
  textAlign(CENTER, CENTER);
  text('选择关卡', centerX, 150);

  // 绘制所有关卡
  for (let i = 0; i < levels.length; i++) {
    let lvl = levels[i];
    // 检查关卡是否已解锁
    if (lvl.id === 1 || playerData.clearedLevels.includes(lvl.id - 1)) {
      if (!lvl.button) {
        lvl.button = new Button(centerX - 100, 200 + i * 80, 200, 50, `关卡 ${lvl.id}`, () => {
          // 开始战斗前的对话
          let dialog = [
            `准备进入关卡 ${lvl.id} 战斗。`,
            "祝你好运！"
          ];
          dialogManager.startDialog(dialog, () => {
            // 设置当前关卡
            currentLevel = lvl;

            // 根据关卡数据初始化战斗场景
            initBattle();

            // 进入战斗状态
            gameState = 'battle';
          });
        });
      }
      lvl.button.update();
      lvl.button.display();
    } else {
      // 绘制未解锁的关卡
      fill(150);
      stroke(0);
      rect(centerX - 100, 200 + i * 80, 200, 50);
      fill(0);
      noStroke();
      textSize(16);
      textAlign(CENTER, CENTER);
      text(`关卡 ${lvl.id} (未解锁)`, centerX, 225 + i * 80);
    }
  }
  pop();
}

// ============ 绘制舰队编成界面 ============
function drawFleetFormation() {
  push();
  fill(0);
  textSize(32);
  textAlign(CENTER, CENTER);
  text('舰队编成', centerX, 150);

  // 绘制舰队槽位
  for (let slot of fleetSlots) {
    slot.update();
    slot.display();
  }

  fleetFormationSaveButton.update();
  fleetFormationSaveButton.display();

  pop();
}

// ============ 绘制舰队研发界面 ============
function drawFleetResearch() {
  push();
  fill(0);
  textSize(32);
  textAlign(CENTER, CENTER);
  text('舰队研发', centerX, 150);

  // 显示金币
  fill(0);
  textSize(20);
  textAlign(LEFT, CENTER);
  text(`金币: ${playerData.coins}`, centerX - 250, 200);

  // 绘制抽卡和解锁蓝图按钮
  for (let btn of fleetResearchButtons) {
    btn.update();
    btn.display();
  }

  // 图纸研发区域标题
  fill(0);
  textSize(24);
  textAlign(CENTER, CENTER);
  text('图纸解锁', centerX, 350);

  pop();
}

// ============ 尝试抽卡 ============
function tryGacha(times) {
  let costPerDraw = 100; // 每次抽卡成本
  let totalCost = times * costPerDraw;

  if (playerData.coins < totalCost) {
    currentModal = new InfoModal('金币不足！');
    return;
  }

  playerData.coins -= totalCost;
  savePlayerDataToLocalStorage(); // 立即保存扣钱操作

  let results = [];
  let newItemFound = false; // 是否已找到新物品

  for (let i = 0; i < times; i++) {
    let r = random();
    let cum = 0;
    let found = false;
    for (let item of gachaPool) {
      cum += item.probability;
      if (r <= cum) {
        results.push(item.name);
        found = true;
        break;
      }
    }
    if (!found && gachaPool.length > 0) {
      // 如果没有找到，默认抽取最后一个
      results.push(gachaPool[gachaPool.length - 1].name);
    }
  }

  let finalResultMsg = '抽卡结果:\n';
  let refundedAmount = 0;
  let newItemFoundFlag = false;

  for (let res of results) {
    let isShip = ships.some(s => s.name === res);
    let isEquip = equipments.some(e => e.name === res);
    let owned = false;

    if (isShip) {
      owned = playerData.ownedShips.includes(res);
    } else if (isEquip) {
      owned = playerData.ownedEquipments.includes(res);
    }

    if (owned) {
      if (!newItemFoundFlag) {
        // 返还一半cost
        let refund = 50; // 50% of 100
        playerData.coins += refund;
        refundedAmount += refund;
        finalResultMsg += `${res} (重复, 返还 50 金币)\n`;
        newItemFoundFlag = true; // 仅第一次重复返还
      } else {
        // 后续重复不返还
        finalResultMsg += `${res} (重复)\n`;
      }
    } else {
      if (!newItemFoundFlag) {
        newItemFoundFlag = true;
        finalResultMsg += `${res} (新获得)\n`;
        // 根据是舰船还是装备，标记为拥有状态
        if (isShip) {
          playerData.ownedShips.push(res);
        } else if (isEquip) {
          playerData.ownedEquipments.push(res);
        }
      } else {
        // 超过一个新物品，返还一半cost
        let refund = 50;
        playerData.coins += refund;
        refundedAmount += refund;
        finalResultMsg += `${res} (重复, 返还 50 金币)\n`;
      }
    }
  }

  // 显示抽卡结果
  currentModal = new InfoModal(finalResultMsg.trim());

  savePlayerDataToLocalStorage();

  // 重新初始化 fleetResearchButtons 以更新解锁按钮
  initFleetResearchButtons();
}

// ============ 解锁图纸 ============
class UnlockBlueprintModal {
  constructor(type) {
    this.type = type; // 'ship' 或 'equipment'
    this.selectedItems = []; // 选中的图纸
    this.scrollOffset = 0;
    this.itemHeight = 30;
    this.visibleItems = 10;
    this.width = 600;
    this.height = 400;
    this.x = centerX - this.width / 2;
    this.y = centerY - this.height / 2;
    this.costPerUnlock = 100; // 每次解锁成本
  }

  update() {
    // 不需要更新
  }

  display() {
    push();
    // 绘制模态框背景
    fill(255);
    stroke(0);
    rect(this.x, this.y, this.width, this.height);

    // 标题
    fill(0);
    textSize(18);
    textAlign(CENTER, TOP);
    text(this.type === 'ship' ? '解锁舰船图纸' : '解锁装备图纸', this.x + this.width / 2, this.y + 10);

    // 绘制关闭按钮
    let closeBtnX = this.x + this.width - 40;
    let closeBtnY = this.y + 10;
    let closeBtnW = 30;
    let closeBtnH = 30;
    let isCloseHovered = (mouseX >= closeBtnX && mouseX <= closeBtnX + closeBtnW &&
                         mouseY >= closeBtnY && mouseY <= closeBtnY + closeBtnH);
    if (isCloseHovered) {
      fill(200);
    } else {
      fill(255);
    }
    stroke(0);
    ellipse(closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2, closeBtnW, closeBtnH);
    fill(0);
    textSize(20);
    text('×', closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2 - 10);

    // 列表区域
    let listX = this.x + 10;
    let listY = this.y + 50;
    let listWidth = 200;
    let listHeight = this.height - 100;

    // 获取可解锁的图纸列表
    let unlockableList = [];
    if (this.type === 'ship') {
      unlockableList = ships.filter(s => 
        playerData.ownedShips.includes(s.name) && 
        !playerData.unlockedShipBlueprints.includes(s.name)
      );
    } else if (this.type === 'equipment') {
      unlockableList = equipments.filter(e => 
        playerData.ownedEquipments.includes(e.name) && 
        !playerData.unlockedEquipBlueprints.includes(e.name)
      );
    }

    // 绘制滚动的图纸列表
    textAlign(LEFT, TOP);
    textSize(14);
    fill(0);
    text(`选择要解锁的${this.type === 'ship' ? '舰船' : '装备'}图纸:`, listX, listY - 30);
    for (let i = 0; i < unlockableList.length; i++) {
      let item = unlockableList[i];
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        let isHovered = (mouseX >= listX && mouseX <= listX + listWidth &&
                        mouseY >= y && mouseY <= y + this.itemHeight);
        
        if (isHovered) {
          fill(200);
        } else {
          fill(255);
        }
        stroke(0);
        rect(listX, y, listWidth, this.itemHeight);

        fill(0);
        noStroke();
        text(item.name, listX + 5, y + this.itemHeight / 2 - 7);

        // 绘制复选框
        fill(0);
        rect(this.x + 220, y + 5, 20, 20);
        noFill();
        stroke(0);
        if (this.selectedItems.includes(item.name)) {
          line(this.x + 220, y + 5, this.x + 220 + 20, y + 5 + 20);
          line(this.x + 220 + 20, y + 5, this.x + 220 + 10, y + 5 + 10);
        }
      }
    }

    // 绘制右侧选中项的信息
    let detailX = this.x + 250;
    let detailY = this.y + 50;
    let detailWidth = 330;
    let detailHeight = this.height - 100;

    if (this.selectedItems.length > 0) {
      fill(0);
      textSize(16);
      textAlign(CENTER, TOP);
      text(`选中 ${this.selectedItems.length} 项`, detailX + detailWidth / 2, detailY);

      // 显示选中图纸的详细信息
      textSize(14);
      textAlign(LEFT, TOP);
      let startY = detailY + 30;
      for (let i = 0; i < this.selectedItems.length; i++) {
        let name = this.selectedItems[i];
        let item;
        if (this.type === 'ship') {
          item = ships.find(s => s.name === name);
        } else {
          item = equipments.find(e => e.name === name);
        }
        if (item) {
          let attrs = this.type === 'ship' ? [
            `类型: ${item.type}`,
            `火力: ${item.firepower}`,
            `防空: ${item.aa}`,
            `耐久: ${item.endurance}`,
            `装甲: ${item.armor}`,
            `闪避: ${item.evasion}`,
            `载重: ${item.carryCapacity}`,
            `射程: ${item.range}`,
            `最小轨道: ${item.minOrbit}`,
            `属性: ${item.attribute}`
          ] : [
            `火力: ${item.firepower}`,
            `防空: ${item.aa}`,
            `装甲: ${item.armor}`,
            `闪避: ${item.evasion}`,
            `射程: ${item.range}`,
            `质量: ${item.mass}`,
            `属性: ${item.attribute}`,
            `价格: ${item.price}`
          ];

          for (let j = 0; j < attrs.length; j++) {
            text(attrs[j], detailX + 20, startY + j * 20);
          }
          startY += attrs.length * 20 + 10;
        }
      }

      // 显示总解锁成本
      let totalCost = this.selectedItems.length * this.costPerUnlock;
      text(`总成本: ${totalCost} 金币`, detailX + 20, startY);

      // 绘制解锁按钮
      let unlockBtnX = this.x + 250;
      let unlockBtnY = this.y + this.height - 60;
      let unlockBtnW = 150;
      let unlockBtnH = 40;
      let isHovered = (mouseX >= unlockBtnX && mouseX <= unlockBtnX + unlockBtnW &&
                      mouseY >= unlockBtnY && mouseY <= unlockBtnY + unlockBtnH);
      if (isHovered) {
        fill(200);
      } else {
        fill(255);
      }
      stroke(0);
      rect(unlockBtnX, unlockBtnY, unlockBtnW, unlockBtnH);

      fill(0);
      noStroke();
      textSize(14);
      text('确认解锁', unlockBtnX + unlockBtnW / 2, unlockBtnY + unlockBtnH / 2 - 7);

      // 绘制取消按钮
      let cancelBtnX = this.x + 420;
      let cancelBtnY = this.y + this.height - 60;
      let cancelBtnW = 150;
      let cancelBtnH = 40;
      let isCancelHovered = (mouseX >= cancelBtnX && mouseX <= cancelBtnX + cancelBtnW &&
                            mouseY >= cancelBtnY && mouseY <= cancelBtnY + cancelBtnH);
      if (isCancelHovered) {
        fill(200);
      } else {
        fill(255);
      }
      stroke(0);
      rect(cancelBtnX, cancelBtnY, cancelBtnW, cancelBtnH);

      fill(0);
      noStroke();
      textSize(14);
      text('取消', cancelBtnX + cancelBtnW / 2, cancelBtnY + cancelBtnH / 2 - 7);
    }
  }
    mousePressed() {
      // 获取可选择的图纸列表
      let unlockableList = [];
      if (this.type === 'ship') {
        unlockableList = ships.filter(s => 
          playerData.ownedShips.includes(s.name) && 
          !playerData.unlockedShipBlueprints.includes(s.name)
        );
      } else if (this.type === 'equipment') {
        unlockableList = equipments.filter(e => 
          playerData.ownedEquipments.includes(e.name) && 
          !playerData.unlockedEquipBlueprints.includes(e.name)
        );
      }

      // 检测图纸列表点击
      for (let i = 0; i < unlockableList.length; i++) {
        let item = unlockableList[i];
        let y = this.y + 50 + (i - this.scrollOffset) * this.itemHeight;
        if (y >= this.y + 50 && y <= this.y + 50 + 400 - 30) {
          // 检测复选框点击
          if (mouseX >= this.x + 220 && mouseX <= this.x + 240 &&
              mouseY >= y + 5 && mouseY <= y + 25) {
            if (this.selectedItems.includes(item.name)) {
              // 取消选择
              this.selectedItems = this.selectedItems.filter(name => name !== item.name);
            } else {
              // 选择
              this.selectedItems.push(item.name);
            }
          }

          // 检测舰船/装备名称点击
          if (mouseX >= this.x + 10 && mouseX <= this.x + 210 &&
              mouseY >= y && mouseY <= y + this.itemHeight) {
            // 点击舰船/装备名称同样可以选择
            if (this.selectedItems.includes(item.name)) {
              // 取消选择
              this.selectedItems = this.selectedItems.filter(name => name !== item.name);
            } else {
              // 选择
              this.selectedItems.push(item.name);
            }
          }
        }
      }

      // 检测确认解锁按钮点击
      let unlockBtnX = this.x + 250;
      let unlockBtnY = this.y + this.height - 60;
      let unlockBtnW = 150;
      let unlockBtnH = 40;
      if (mouseX >= unlockBtnX && mouseX <= unlockBtnX + unlockBtnW &&
          mouseY >= unlockBtnY && mouseY <= unlockBtnY + unlockBtnH) {
        if (this.selectedItems.length === 0) {
          currentModal = new InfoModal('请选择至少一项图纸进行解锁。');
          return;
        }
        let totalCost = this.selectedItems.length * this.costPerUnlock;
        if (playerData.coins < totalCost) {
          currentModal = new InfoModal('金币不足，无法解锁选中的图纸！');
          return;
        }

        // 解锁图纸
        for (let name of this.selectedItems) {
          if (this.type === 'ship') {
            if (!playerData.unlockedShipBlueprints.includes(name)) {
              playerData.unlockedShipBlueprints.push(name);
            }
          } else if (this.type === 'equipment') {
            if (!playerData.unlockedEquipBlueprints.includes(name)) {
              playerData.unlockedEquipBlueprints.push(name);
            }
          }
        }

        // 扣除金币
        playerData.coins -= totalCost;

        currentModal = new InfoModal('图纸解锁成功！');
        savePlayerDataToLocalStorage();

        // 重新初始化 fleetResearchButtons 以更新解锁按钮
        initFleetResearchButtons();
      }

      // 检测取消按钮点击
      let cancelBtnX = this.x + 420;
      let cancelBtnY = this.y + this.height - 60;
      let cancelBtnW = 150;
      let cancelBtnH = 40;
      if (mouseX >= cancelBtnX && mouseX <= cancelBtnX + cancelBtnW &&
          mouseY >= cancelBtnY && mouseY <= cancelBtnY + cancelBtnH) {
        currentModal = null; // 关闭弹窗
      }

      // 检测关闭按钮点击
      let closeBtnX = this.x + this.width - 40;
      let closeBtnY = this.y + 10;
      let closeBtnW = 30;
      let closeBtnH = 30;
      if (dist(mouseX, mouseY, closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2) <= closeBtnW / 2) {
        currentModal = null; // 关闭弹窗
      }
    }

    mouseWheel(event) {
      // 处理滚动
      let delta = event.delta;
      this.scrollOffset += delta > 0 ? 1 : -1;
      this.scrollOffset = constrain(this.scrollOffset, 0, max(0, (this.type === 'ship' ? ships.length : equipments.length) - this.visibleItems));
      return false; // 阻止默认行为
    }
}

// ============ 绘制小地图 ============
function drawMiniMap() {
  // 绘制小地图区域
  push();
  noStroke();
  fill(230);
  rect(width - 300, 50, 280, 280); // 调整小地图位置

  // 绘制星球外轮廓
  fill(255);
  stroke(0);
  ellipse(width - 150, 190, 180, 180); // 星球外轮廓

  // 绘制卫星和红点的位置
  for (let satellite of satellites) {
    if (!satellite.ship || satellite.health <= 0) continue;
    let x = satellite.absX;
    let y = satellite.absY;

    // 缩放位置以适应小地图
    let scaleFactor = 90 / (radius + 300); // 调整比例因子

    let mapX = width - 150 + (x) * scaleFactor;
    let mapY = 190 + (y) * scaleFactor; // 调整y位置以匹配星球外轮廓位置

    fill(0, 0, 255); // 蓝色表示舰船
    noStroke();
    ellipse(mapX, mapY, 6, 6);
    fill(0);
    textSize(10);
    textAlign(LEFT, CENTER);
    text(satellite.ship.name, mapX + 5, mapY - 5);
  }

  for (let point of redPoints) {
    let x = point.absX;
    let y = point.absY;

    // 缩放位置以适应小地图
    let scaleFactor = 90 / (radius + 300); // 调整比例因子

    let mapX = width - 150 + (x) * scaleFactor;
    let mapY = 190 + (y) * scaleFactor; // 调整y位置以匹配星球外轮廓位置

    fill(255, 0, 0); // 红色表示红点
    noStroke();
    ellipse(mapX, mapY, 6, 6);
    fill(0);
    textSize(10);
    textAlign(LEFT, CENTER);
    text(point.name, mapX + 5, mapY - 5);
  }

  pop();
}

// ============ 绘制胜利界面 ============
function drawVictoryScreen() {
  push();
  fill(0, 255, 0);
  textSize(48);
  textAlign(CENTER, CENTER);
  text('胜利！', centerX, centerY);
  pop();
}

// ============ 绘制失败界面 ============
function drawDefeatScreen() {
  push();
  fill(255, 0, 0);
  textSize(48);
  textAlign(CENTER, CENTER);
  text('失败！', centerX, centerY);
  pop();
}

// ============ 战斗相关函数 ============
let currentLevel = null; // 当前关卡

function initBattle() {
  // 初始化星球参数
  radius = currentLevel.planetRadius;
  planetMass = currentLevel.planetMass;
  rotationAngle = 0; // 重置自转角度

  // 初始化轨道和卫星
  satellites = [];
  selectedOrbitIndex = 0;

  // 使用玩家保存的舰队数据
  if (playerFleet && playerFleet.length > 0) {
    for (let i = 0; i < playerFleet.length; i++) {
      let shipSlot = playerFleet[i];
      if (shipSlot && shipSlot.ship) {
        let ship = ships.find(s => s.name === shipSlot.ship);
        if (ship) {
          let orbitRadius = radius + ship.minOrbit; // 正确计算轨道半径
          let satellite = {
            orbitRadius: orbitRadius,
            orbitQuat: { x: 0, y: 0, z: 0, w: 1 },
            satelliteAngle: 0,
            ship: ship,
            equipments: shipSlot.equipments.map(eqName => equipments.find(e => e && e.name === eqName)),
            orbitalSpeed: 0, // 新增属性
            health: ship.endurance, // 初始化舰船健康值
            attackCooldown: 0 // 攻击冷却
          };
          calculateOrbitalSpeed(satellite); // 计算轨道速度
          satellites.push(satellite);
        }
      }
    }
  } else {
    // 如果没有保存的舰队，初始化默认的卫星
    for (let i = 0; i < 4; i++) {
      let orbitRadius = radius + 250 + i * 50; // 正确计算轨道半径
      let satellite = {
        orbitRadius: orbitRadius,
        orbitQuat: { x: 0, y: 0, z: 0, w: 1 },
        satelliteAngle: 0,
        ship: null,
        equipments: [],
        orbitalSpeed: 0, // 新增属性
        health: 0,
        attackCooldown: 0
      };
      calculateOrbitalSpeed(satellite); // 计算轨道速度
      satellites.push(satellite);
    }
  }

  // 初始化红点
  redPoints = [];
  for (let point of currentLevel.redPoints) {
    let rp = { ...point };
    if (rp.minOrbit > 0) {
      rp.orbitRadius = radius + rp.minOrbit;
      rp.orbitalSpeed = sqrt((G * planetMass) / (rp.orbitRadius * 1000)) * 10;
      rp.orbitalSpeed *= 1e-6;
      rp.angle = radians(rp.lon);
    }
    redPoints.push(rp);
  }

  battleLog = []; // 重置战斗日志
}

function drawBattle() {
  rotationAngle = (rotationAngle + currentLevel.planetRotationSpeed) % TWO_PI; // 星球自转速度

  // 处理按键持续按下的旋转
  handleOrbitRotation();

  // 绘制星球
  push();
  translate(centerX, centerY);
  
  noFill(); // 确保星球不被填充
  stroke(0);
  ellipse(0, 0, radius * 2);

  // 绘制纬线和经线
  drawLatitudeLines();
  drawLongitudeLines();
  pop();

  // 更新并绘制红点
  updateAndDrawRedPoints();

  // 绘制轨道和卫星
  let satellitePositions3D = [];
  for (let i = 0; i < satellites.length; i++) {
    let satellite = satellites[i];
    drawOrbitAndSatellite(satellite, satellitePositions3D);
  }

  // 计算并显示卫星与红点之间的3D距离以及处理攻击
  processAttacks(satellitePositions3D, redPoints);

  // 检查战斗结束条件
  if (redPoints.length === 0) {
    gameState = 'victory';
    handleVictory();
  }

  // 检查是否所有卫星健康低于等于0，可能导致失败
  let allSatellitesDefeated = satellites.every(sat => !sat.ship || sat.health <=0);
  if (allSatellitesDefeated && redPoints.length >0) {
    gameState = 'defeat';
    handleDefeat();
  }
}

function handleVictory() {
  // 奖励金币
  let rewardCoins = floor(random(currentLevel.rewardCoinsMin, currentLevel.rewardCoinsMax + 1));
  playerData.coins += rewardCoins;

  // 奖励图纸或其他（根据需要添加）
  let unlockedBlueprints = [];
  for (let drop of currentLevel.drops) {
    // 假设掉落图纸
    let isShip = ships.some(s => s.name === drop.name);
    let isEquip = equipments.some(e => e.name === drop.name);
    if (isShip && !playerData.unlockedShipBlueprints.includes(drop.name)) {
      playerData.unlockedShipBlueprints.push(drop.name);
      unlockedBlueprints.push(`${drop.name} 图纸`);
    } else if (isEquip && !playerData.unlockedEquipBlueprints.includes(drop.name)) {
      playerData.unlockedEquipBlueprints.push(drop.name);
      unlockedBlueprints.push(`${drop.name} 图纸`);
    }
  }

  // 标记当前关卡为已通关
  if (!playerData.clearedLevels.includes(currentLevel.id)) {
    playerData.clearedLevels.push(currentLevel.id);
  }

  // 自动解锁下一个关卡
  let nextLevel = levels.find(lvl => lvl.id === currentLevel.id + 1);
  if (nextLevel) {
    // 确保下一关卡已经存在
    // 如果需要自动解锁，可能不需要额外操作，因为在 drawLevelSelect 中会根据 clearedLevels 来显示
  }

  // 构建胜利对话
  let victoryDialog = [
    `你在关卡 ${currentLevel.id} 中获胜！`,
    `获得了 ${rewardCoins} 金币。`,
  ];
  if (unlockedBlueprints.length > 0) {
    victoryDialog.push(`解锁了以下图纸：${unlockedBlueprints.join('、')}。`);
  }
  victoryDialog.push("恭喜！");
  victoryDialog.push("点击确认返回关卡选择。");

  // 显示胜利信息
  currentModal = null; // 关闭战斗中的任何弹窗
  dialogManager.startDialog(victoryDialog, () => {
    gameState = 'levelSelect';
    savePlayerDataToLocalStorage();
  });
}

function handleDefeat() {
  // 构建失败对话
  let defeatDialog = [
    "你的舰队被击败了。",
    "没有获得任何奖励。",
    "点击确认返回关卡选择。"
  ];

  // 显示失败信息
  currentModal = null; // 关闭战斗中的任何弹窗
  dialogManager.startDialog(defeatDialog, () => {
    gameState = 'levelSelect';
    savePlayerDataToLocalStorage();
  });
}

// ============ 用户提供的战斗系统相关函数 ============
function drawLatitudeLines() {
  for (let lat = -80; lat <= 80; lat += 20) {
    beginShape();
    for (let lon = 0; lon <= 360; lon += 5) {
      let latRadian = radians(lat);
      let lonRadian = radians(lon);
      let x0 = radius * cos(latRadian) * cos(lonRadian);
      let y0 = radius * sin(latRadian);
      let z0 = radius * cos(latRadian) * sin(lonRadian);

      // 使用星球自转的四元数旋转点
      let rotationAxis = { x: 0, y: 1, z: 0 };
      let planetRotationQuat = rotateQuaternion({ x: 0, y: 0, z: 0, w: 1 }, rotationAxis, rotationAngle);
      let rotatedPoint = rotateVectorByQuaternion({ x: x0, y: y0, z: z0 }, planetRotationQuat);

      let x = rotatedPoint.x;
      let y = rotatedPoint.y;
      let z = rotatedPoint.z;

      // 根据 x 值设置透明度
      let alphaValue = map(x, -radius, radius, 255, 50); // 前方更亮，后方更暗
      stroke(200, alphaValue);

      vertex(z, -y); // z 轴映射到屏幕的 x 轴，y 轴映射到屏幕的 y 轴
    }
    endShape();
  }
}

function drawLongitudeLines() {
  for (let lon = 0; lon < 360; lon += 20) {
    beginShape();
    for (let lat = -90; lat <= 90; lat += 1) {
      let latRadian = radians(lat);
      let lonRadian = radians(lon);
      let x0 = radius * cos(latRadian) * cos(lonRadian);
      let y0 = radius * sin(latRadian);
      let z0 = radius * cos(latRadian) * sin(lonRadian);

      // 使用星球自转的四元数旋转点
      let rotationAxis = { x: 0, y: 1, z: 0 };
      let planetRotationQuat = rotateQuaternion({ x: 0, y: 0, z: 0, w: 1 }, rotationAxis, rotationAngle);
      let rotatedPoint = rotateVectorByQuaternion({ x: x0, y: y0, z: z0 }, planetRotationQuat);

      let x = rotatedPoint.x;
      let y = rotatedPoint.y;
      let z = rotatedPoint.z;

      // 根据 x 值设置透明度
      let alphaValue = map(x, -radius, radius, 255, 50);
      stroke(200, alphaValue);

      vertex(z, -y); // z 轴映射到屏幕的 x 轴，y 轴映射到屏幕的 y 轴
    }
    endShape();
  }
}

// 更新并绘制红点
function updateAndDrawRedPoints() {
  for (let i = redPoints.length - 1; i >= 0; i--) {
    let point = redPoints[i];
    let latRadian = radians(point.lat);
    let lonRadian = radians(point.lon);

    // 计算红点在星球坐标系中的位置
    let x0 = (radius + point.range) * cos(latRadian) * cos(lonRadian);
    let y0 = (radius + point.range) * sin(latRadian);
    let z0 = (radius + point.range) * cos(latRadian) * sin(lonRadian);

    // 使用星球自转的四元数旋转点
    let rotationAxis = { x: 0, y: 1, z: 0 };
    let planetRotationQuat = rotateQuaternion({ x: 0, y: 0, z: 0, w: 1 }, rotationAxis, rotationAngle);
    let rotatedPoint = rotateVectorByQuaternion({ x: x0, y: y0, z: z0 }, planetRotationQuat);

    // 更新红点的绝对坐标
    point.absX = rotatedPoint.x;
    point.absY = rotatedPoint.y;
    point.absZ = rotatedPoint.z;

    // 投影到屏幕坐标
    let screenX = centerX + rotatedPoint.z;
    let screenY = centerY - rotatedPoint.y;

    // 根据 x 值设置透明度
    let alphaValue = map(rotatedPoint.x, -radius, radius, 255, 50);
    fill(255, 0, 0, alphaValue);

    ellipse(screenX, screenY, 10, 10); // 绘制红点
    noFill();
  }
}

// 绘制轨道和卫星
function drawOrbitAndSatellite(satellite, satellitePositions3D) {
  let orbitRadius = satellite.orbitRadius;
  let orbitQuat = satellite.orbitQuat;
  let satelliteAngle = satellite.satelliteAngle;

  // 绘制轨道
  let angleIncrement = 1; // 角度增量
  let prevVisible = false;
  let currentShapeStarted = false;

  beginShape();
  for (let angle = 0; angle <= 360; angle += angleIncrement) {
    let angleRadian = radians(angle);
    let localPoint = { x: orbitRadius * cos(angleRadian), y: 0, z: orbitRadius * sin(angleRadian) };
    let rotatedPoint = rotateVectorByQuaternion(localPoint, orbitQuat);
    let x = rotatedPoint.x;
    let y = rotatedPoint.y;
    let z = rotatedPoint.z;

    // 判断轨道点是否被星球遮挡
    let y2z2 = y * y + z * z;
    let visible = false;
    if (y2z2 <= radius * radius) {
      let x_p = sqrt(radius * radius - y2z2);
      if (x >= x_p) {
        // 点在星球后面
        visible = false;
      } else {
        // 点在星球前面
        visible = true;
      }
    } else {
      // 点不在星球投影范围内，显示
      visible = true;
    }

    if (visible) {
      if (!prevVisible) {
        // 开始新的形状
        beginShape();
        currentShapeStarted = true;
      }
      let screenX = centerX + z;
      let screenY = centerY - y;

      let alphaValue = map(x, -orbitRadius, orbitRadius, 255, 50);
      stroke(150, alphaValue);

      vertex(screenX, screenY);
    } else {
      if (prevVisible && currentShapeStarted) {
        // 结束当前形状
        endShape();
        currentShapeStarted = false;
      }
    }

    prevVisible = visible;
  }
  if (currentShapeStarted) {
    endShape();
  }

  // 更新卫星位置
  satellite.satelliteAngle += satellite.orbitalSpeed / orbitRadius;
  let satellitePoint = { x: orbitRadius * cos(satellite.satelliteAngle), y: 0, z: orbitRadius * sin(satellite.satelliteAngle) };
  let rotatedSatellitePoint = rotateVectorByQuaternion(satellitePoint, orbitQuat);

  // 保存卫星的绝对坐标
  let satelliteX = rotatedSatellitePoint.x;
  let satelliteY = rotatedSatellitePoint.y;
  let satelliteZ = rotatedSatellitePoint.z;

  satellitePositions3D.push({ x: satelliteX, y: satelliteY, z: satelliteZ });

  // 投影到屏幕坐标
  let screenSatelliteX = centerX + satelliteZ;
  let screenSatelliteY = centerY - satelliteY;

  // 根据 x 值设置透明度
  let alphaValue = map(satelliteX, -orbitRadius, orbitRadius, 255, 50);

  // 判断卫星是否被星球遮挡
  let satY2Z2 = satelliteY * satelliteY + satelliteZ * satelliteZ;
  let satelliteVisible = false;
  if (satY2Z2 <= radius * radius) {
    let x_p = sqrt(radius * radius - satY2Z2);
    if (satelliteX >= x_p) {
      // 卫星在星球后面
      satelliteVisible = false;
    } else {
      // 卫星在星球前面
      satelliteVisible = true;
    }
  } else {
    // 卫星不在星球投影范围内，显示
    satelliteVisible = true;
  }

  if (satelliteVisible) {
    // 绘制卫星
    fill(0, 0, 255, alphaValue);
    ellipse(screenSatelliteX, screenSatelliteY, 10, 10);
    noFill();

    // 绘制卫星编号或舰船名称
    fill(0);
    textSize(12);
    let label = satellite.ship ? satellite.ship.name : `卫星 ${satellites.indexOf(satellite) + 1}`;
    text(label, screenSatelliteX + 10, screenSatelliteY - 5);
    noFill();
  } else {
    // 绘制被遮挡的卫星（虚线描边，白色填充）
    stroke(0);
    strokeWeight(1);
    drawingContext.setLineDash([5, 5]); // 虚线
    fill(255, 255, 255, 0); // 透明填充
    ellipse(screenSatelliteX, screenSatelliteY, 10, 10);
    drawingContext.setLineDash([]);
    noFill();

    // 绘制卫星编号或舰船名称
    fill(0);
    textSize(12);
    let label = satellite.ship ? satellite.ship.name : `卫星 ${satellites.indexOf(satellite) + 1}`;
    text(label, screenSatelliteX + 10, screenSatelliteY - 5);
    noFill();
  }

  // 绘制射程区域
  drawSatelliteRangeArea(satellite, satellitePositions3D[satellites.indexOf(satellite)], satellites.indexOf(satellite));
}

// 绘制卫星射程区域
function drawSatelliteRangeArea(satellite, satellitePos, satelliteIndex) {
  let R1 = radius; // 星球半径
  let R2 = satellite.ship ? satellite.ship.range : 0; // 射程
  let P1 = { x: 0, y: 0, z: 0 }; // 星球中心

  // 获取星球自转四元数和其逆
  let rotationAxis = { x: 0, y: 1, z: 0 };
  let planetRotationQuat = rotateQuaternion({ x: 0, y: 0, z: 0, w: 1 }, rotationAxis, rotationAngle);
  let planetRotationQuatInverse = { x: -planetRotationQuat.x, y: -planetRotationQuat.y, z: -planetRotationQuat.z, w: planetRotationQuat.w };

  // 将卫星位置旋转到星球坐标系
  let satellitePosInPlanetFrame = rotateVectorByQuaternion(satellitePos, planetRotationQuatInverse);

  let P2 = satellitePosInPlanetFrame; // 卫星在星球坐标系中的位置

  // 计算卫星与星球中心的距离
  let d = dist3D(P1, P2);

  // 检查是否有交集
  if (d > R1 + R2 || d < abs(R1 - R2)) {
    // 没有交集，不绘制
    return;
  }

  // 计算 a 和 h
  let a = (R1 * R1 - R2 * R2 + d * d) / (2 * d);
  let h = sqrt(R1 * R1 - a * a);

  // 计算交圈的中心点
  let P_c = {
    x: P1.x + a * (P2.x - P1.x) / d,
    y: P1.y + a * (P2.y - P1.y) / d,
    z: P1.z + a * (P2.z - P1.z) / d
  };

  // 计算法向量 n
  let n = {
    x: (P2.x - P1.x) / d,
    y: (P2.y - P1.y) / d,
    z: (P2.z - P1.z) / d
  };

  // 计算正交基 (u, v)
  let arbitraryVector = { x: 1, y: 0, z: 0 };
  if (abs(n.x) > 0.99) {
    arbitraryVector = { x: 0, y: 1, z: 0 };
  }
  let u = crossProduct(n, arbitraryVector);
  let u_mag = sqrt(u.x * u.x + u.y * u.y + u.z * u.z);
  u = { x: u.x / u_mag, y: u.y / u_mag, z: u.z / u_mag };

  let v = crossProduct(n, u);

  // 采样点
  let numPoints = 100;
  let angleStep = TWO_PI / numPoints;

  let frontVertices = [];
  let backVertices = [];

  for (let i = 0; i <= numPoints; i++) {
    let angle = i * angleStep;
    let point = {
      x: P_c.x + h * (cos(angle) * u.x + sin(angle) * v.x),
      y: P_c.y + h * (cos(angle) * u.y + sin(angle) * v.y),
      z: P_c.z + h * (cos(angle) * u.z + sin(angle) * v.z)
    };

    // 应用星球自转，将点旋转回世界坐标系
    let rotatedPoint = rotateVectorByQuaternion(point, planetRotationQuat);

    // 投影到屏幕坐标
    let x = rotatedPoint.x;
    let y = rotatedPoint.y;
    let z = rotatedPoint.z;

    let screenX = centerX + z;
    let screenY = centerY - y;

    // 判断点是否在前面
    let normal = { x: rotatedPoint.x, y: rotatedPoint.y, z: rotatedPoint.z };
    let normalMag = sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    normal = { x: normal.x / normalMag, y: normal.y / normalMag, z: normal.z / normalMag };

    let viewDir = { x: -1, y: 0, z: 0 }; // 视线方向

    let dotProduct = normal.x * viewDir.x + normal.y * viewDir.y + normal.z * viewDir.z;

    if (dotProduct > 0) {
      frontVertices.push({ x: screenX, y: screenY });
    } else {
      backVertices.push({ x: screenX, y: screenY });
    }
  }

  // 绘制前面的区域
  if (frontVertices.length > 2) {
    fill(150, 150, 150, 100); // 灰色填充
    stroke(0); // 黑色细线
    strokeWeight(1);
    beginShape();
    for (let v of frontVertices) {
      vertex(v.x, v.y);
    }
    endShape(CLOSE);
    noFill();
  }

  // 绘制后面的区域
  if (backVertices.length > 2) {
    fill(255, 255, 255, 0); // 透明填充
    stroke(0);
    strokeWeight(1);
    drawingContext.setLineDash([5, 5]); // 虚线
    beginShape();
    for (let v of backVertices) {
      vertex(v.x, v.y);
    }
    endShape(CLOSE);
    drawingContext.setLineDash([]);
    noFill();
  }
}

// 计算卫星与红点之间的距离并处理攻击
function processAttacks(satellitePositions3D, redPoints) {
  fill(0);
  textSize(12);
  let yOffset = 20;
  let textX = 810;

  // 显示每个红点的血量
  for (let i = 0; i < redPoints.length; i++) {
    let point = redPoints[i];
    text(`红点 ${point.id + 1} (${point.attribute}) 血量: ${point.health}`, textX, yOffset);
    yOffset += 15;
  }

  // 计算卫星与红点之间的距离并处理攻击
  for (let i = 0; i < satellites.length; i++) {
    let satellite = satellites[i];
    for (let j = redPoints.length - 1; j >= 0; j--) {
      let point = redPoints[j];

      // 计算距离
      let distance = dist3D(
        satellitePositions3D[i],
        { x: point.absX, y: point.absY, z: point.absZ }
      );

      // 检查距离是否有效
      if (isNaN(distance)) {
        text(`卫星 ${i + 1} 到红点 ${point.id + 1}: 无效距离`, textX, yOffset);
        yOffset += 15;
        continue;
      }

      text(`卫星 ${i + 1} 到红点 ${point.id + 1}: ${distance.toFixed(2)} 单位`, textX, yOffset);
      yOffset += 15;

      // 如果在射程内，绘制虚线并减少红点血量
      if (distance <= (satellite.ship ? satellite.ship.range : 0)) {
        // 判断攻击是否被闪避
        let evadeChance = point.evasion / 200;
        if (random(1) < evadeChance) {
          // 被闪避
          text(`红点 ${point.id + 1} 闪避了攻击！`, textX, yOffset);
          yOffset += 15;
          continue;
        }

        // 计算伤害
        let damage = calculateDamage(satellite, point);

        // 应用伤害
        point.health -= damage;

        // 绘制虚线连接
        stroke(0);
        strokeWeight(1);
        drawingContext.setLineDash([5, 5]);

        // 投影到屏幕坐标
        let screenSatelliteX = centerX + satellitePositions3D[i].z;
        let screenSatelliteY = centerY - satellitePositions3D[i].y;

        let screenRedPointX = centerX + point.absZ;
        let screenRedPointY = centerY - point.absY;

        line(screenSatelliteX, screenSatelliteY, screenRedPointX, screenRedPointY);

        drawingContext.setLineDash([]);
        noFill();

        // 记录攻击事件
        addBattleLog(`${satellite.ship.name} 攻击红点 ${point.id + 1} 造成 ${damage.toFixed(2)} 点伤害。`);

        // 如果血量小于等于0，移除红点
        if (point.health <= 0) {
          addBattleLog(`红点 ${point.id + 1} 已被摧毁！`);
          redPoints.splice(j, 1);
        }
      }
    }
  }
}

// 计算伤害函数
function calculateDamage(satellite, redPoint) {
  let totalDamage = 0;

  // 获取卫星的所有攻击属性（舰船和装备）
  let attackerAttributes = [];
  if (satellite.ship && satellite.ship.attribute) {
    attackerAttributes = attackerAttributes.concat(satellite.ship.attribute.split('&'));
  }
  for (let eq of satellite.equipments) {
    if (eq && eq.attribute) {
      attackerAttributes = attackerAttributes.concat(eq.attribute.split('&'));
    }
  }

  // 获取红点的属性
  let targetAttributes = redPoint.attribute.split('&');

  // 计算火力伤害
  if (satellite.ship && satellite.ship.firepower) {
    let multiplier = getAttributeMultiplier(attackerAttributes, targetAttributes);
    totalDamage += satellite.ship.firepower * multiplier;
  }

  // 计算装备的火力伤害
  for (let eq of satellite.equipments) {
    if (eq && eq.firepower) {
      let multiplier = getAttributeMultiplier(attackerAttributes, targetAttributes);
      totalDamage += eq.firepower * multiplier;
    }
  }

  // 减去红点的装甲
  totalDamage -= redPoint.armor * 0.01;

  // 确保伤害不为负
  totalDamage = max(0, totalDamage);

  return totalDamage;
}

// 获取属性克制倍数
function getAttributeMultiplier(attackerAttrs, targetAttrs) {
  let multiplier = 1;

  for (let aAttr of attackerAttrs) {
    for (let tAttr of targetAttrs) {
      if (strongAgainst[aAttr] && strongAgainst[aAttr].includes(tAttr)) {
        multiplier *= 2;
      } else if (weakAgainst[aAttr] && weakAgainst[aAttr].includes(tAttr)) {
        multiplier *= 1.5;
      }

      // 被克制
      if (strongAgainst[tAttr] && strongAgainst[tAttr].includes(aAttr)) {
        multiplier *= 0.5;
      }
    }
  }

  return multiplier;
}

// 计算3D向量的叉积
function crossProduct(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

// 处理轨道旋转的按键持续检测
function handleOrbitRotation() {
  let rotationSpeed = 0.02; // 调整旋转速度
  let axis;

  if (keyIsDown(87)) { // 'W' 键
    // 绕 Z 轴旋转（水平轴翻转）
    axis = { x: 0, y: 0, z: 1 };
    if (satellites[selectedOrbitIndex]) {
      satellites[selectedOrbitIndex].orbitQuat = rotateQuaternion(satellites[selectedOrbitIndex].orbitQuat, axis, -rotationSpeed);
    }
  }
  if (keyIsDown(83)) { // 'S' 键
    // 绕 Z 轴旋转（水平轴翻转）
    axis = { x: 0, y: 0, z: 1 };
    if (satellites[selectedOrbitIndex]) {
      satellites[selectedOrbitIndex].orbitQuat = rotateQuaternion(satellites[selectedOrbitIndex].orbitQuat, axis, rotationSpeed);
    }
  }
  if (keyIsDown(65)) { // 'A' 键
    // 绕 X 轴旋转（里-外轴翻转）
    axis = { x: 1, y: 0, z: 0 };
    if (satellites[selectedOrbitIndex]) {
      satellites[selectedOrbitIndex].orbitQuat = rotateQuaternion(satellites[selectedOrbitIndex].orbitQuat, axis, -rotationSpeed);
    }
  }
  if (keyIsDown(68)) { // 'D' 键
    // 绕 X 轴旋转（里-外轴翻转）
    axis = { x: 1, y: 0, z: 0 };
    if (satellites[selectedOrbitIndex]) {
      satellites[selectedOrbitIndex].orbitQuat = rotateQuaternion(satellites[selectedOrbitIndex].orbitQuat, axis, rotationSpeed);
    }
  }
}

// 计算3D空间中两点之间的距离
function dist3D(p1, p2) {
  return sqrt(pow(p2.x - p1.x, 2) + pow(p2.y - p1.y, 2) + pow(p2.z - p1.z, 2));
}

// 计算轨道速度
function calculateOrbitalSpeed(satellite) {
  // 使用万有引力公式计算轨道速度 v = sqrt(G * M / r)
  satellite.orbitalSpeed = sqrt((G * planetMass) / (satellite.orbitRadius * 1000)) * 10; // 将轨道半径从像素转换为米
  satellite.orbitalSpeed *= 1e-6; // 缩放速度
}

// 四元数旋转相关函数
function rotateQuaternion(q, axis, angle) {
  let halfAngle = angle / 2;
  let s = sin(halfAngle);
  let rotationQuat = {
    x: axis.x * s,
    y: axis.y * s,
    z: axis.z * s,
    w: cos(halfAngle)
  };
  return multiplyQuaternions(q, rotationQuat);
}

function multiplyQuaternions(q1, q2) {
  return {
    w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z,
    x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
    y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
    z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w
  };
}

function rotateVectorByQuaternion(v, q) {
  let qConjugate = { x: -q.x, y: -q.y, z: -q.z, w: q.w };
  let qv = { x: v.x, y: v.y, z: v.z, w: 0 };
  let resultQuat = multiplyQuaternions(multiplyQuaternions(q, qv), qConjugate);
  return { x: resultQuat.x, y: resultQuat.y, z: resultQuat.z };
}

function addBattleLog(message) {
  battleLog.push(message);
  // 自动移除最老的日志以限制数量
  if (battleLog.length > maxBattleLog) { // 保留最近 maxBattleLog 条
    battleLog.shift();
  }
  savePlayerDataToLocalStorage();
}

// ============ 战斗日志及其他 UI 绘制 ============
function drawBattleLog() {
  // 绘制日志区域（2D）
  push();
  noStroke();
  fill(230);
  rect(width - 300, 50, 280, 800);

  // 显示最近15条日志
  let displayLogs = battleLog.slice(-maxVisibleLogs);
  fill(0);
  textSize(12);
  textAlign(LEFT, TOP);
  for (let i = 0; i < displayLogs.length; i++) {
    text(displayLogs[i], width - 290, 60 + i * 15);
  }
  pop();
}

function drawSelectedShipPreviewFleet() {
  // 在舰队编成界面右边空白处显示模型预览
  if (gameState === 'fleetFormation' && currentModal instanceof ShipSelectionModal) {
    let selectedShip = currentModal.selectedShip;

    if (selectedShip) {
      // 绘制模型预览区域
      push();
      resetMatrix();
      translate(centerX + 220, centerY - 200);
      fill(255);
      stroke(0);
      rect(-75, -75, 150, 150);

      // 创建一个p5.Graphics对象用于渲染3D模型
      let modelGraphics = createGraphics(140, 140, WEBGL);
      modelGraphics.background(255);
      modelGraphics.stroke(0);
      modelGraphics.noFill();
      modelGraphics.push();
      modelGraphics.rotateY(frameCount * 0.01);
      modelGraphics.scale(1.0); 
      let modelToRender = shipModels[selectedShip.name] || defaultModel;
      if (modelToRender) {
        modelGraphics.model(modelToRender);
      } else {
        modelGraphics.fill(0);
        modelGraphics.textSize(16);
        modelGraphics.text('加载中...', 0, 0);
      }
      modelGraphics.pop();
      image(modelGraphics, -70, -70, 140, 140);
      pop();
    }
  }
}

function drawSelectedShipPreview() {
  // 在战斗界面右边空白处显示模型预览
  if (gameState === 'battle' && currentModal === null) {
    let selectedShip = satellites[selectedOrbitIndex] ? satellites[selectedOrbitIndex].ship : null;

    if (selectedShip && selectedShip.health > 0) {
      // 绘制模型预览区域
      push();
      resetMatrix();
      translate(width - 280, 50);
      fill(255);
      stroke(0);
      rect(0, 0, 260, 260); // 右侧正方形区域

      // 创建一个p5.Graphics对象用于渲染3D模型
      let modelGraphics = createGraphics(260, 260, WEBGL);
      modelGraphics.background(255); // 白色背景
      modelGraphics.stroke(0); // 黑色线条
      modelGraphics.noFill();

      // 旋转模型
      modelGraphics.push();
      modelGraphics.rotateY(frameCount * 0.01);
      modelGraphics.scale(1.5); // 调整模型大小

      // 获取模型，若不存在则使用默认模型
      let modelToRender = shipModels[selectedShip.name] || defaultModel;

      if (modelToRender) {
        modelGraphics.model(modelToRender);
      } else {
        // 显示加载中
        modelGraphics.fill(0);
        modelGraphics.textSize(24);
        modelGraphics.text('加载中...', 0, 0);
      }

      modelGraphics.pop();

      // 绘制模型到屏幕
      image(modelGraphics, 0, 0, 260, 260); // 调整模型显示位置
      pop();
    }
  }
}

// ============ 全局鼠标事件处理 ============
function mousePressed() {
  if (gameState === 'dialog') {
    // 如果是对话界面
    dialogManager.mousePressed();
  } else if (currentModal) {
    // 如果有弹窗，传递事件给弹窗
    currentModal.mousePressed();
  } else {
    // 否则，根据游戏状态处理点击事件
    if (gameState === 'mainMenu') {
      for (let btn of mainMenuButtons) {
        btn.clicked();
      }
    } else if (gameState === 'levelSelect') {
      for (let lvl of levels) {
        if (lvl.button && (lvl.id === 1 || playerData.clearedLevels.includes(lvl.id - 1))) {
          lvl.button.clicked();
        }
      }
    } else if (gameState === 'fleetFormation') {
      for (let slot of fleetSlots) {
        slot.clicked();
      }
      fleetFormationSaveButton.clicked();
    } else if (gameState === 'fleetResearch') {
      for (let btn of fleetResearchButtons) {
        btn.clicked();
      }
    } else if (gameState === 'battle') {
      // 如果需要在战斗中处理点击事件，可以在这里添加
    }
  }
}

function keyPressed() {
  if (gameState === 'battle') {
    if (key === 'q') {
      // 示例功能：增加轨道半径
      if (satellites[selectedOrbitIndex]) {
        satellites[selectedOrbitIndex].orbitRadius += 5;
        calculateOrbitalSpeed(satellites[selectedOrbitIndex]);
      }
    } else if (key === 'e') {
      // 示例功能：减少轨道半径
      if (satellites[selectedOrbitIndex]) {
        satellites[selectedOrbitIndex].orbitRadius = max(radius + 30, satellites[selectedOrbitIndex].orbitRadius - 5);
        calculateOrbitalSpeed(satellites[selectedOrbitIndex]);
      }
    } else if (key === ' ') {
      // 示例功能：切换选中的轨道
      if (satellites.length > 0) {
        selectedOrbitIndex = (selectedOrbitIndex + 1) % satellites.length;
      }
    } else if (keyCode === ESCAPE) {
      // 如果有弹窗，关闭弹窗
      if (currentModal) {
        currentModal = null;
      } else {
        gameState = 'levelSelect';
      }
    }
  } else if (gameState === 'levelSelect' && keyCode === ESCAPE) {
    gameState = 'mainMenu';
  } else if (gameState === 'fleetResearch' && keyCode === ESCAPE) {
    gameState = 'mainMenu';
  } else if (gameState === 'fleetFormation' && keyCode === ESCAPE) {
    gameState = 'mainMenu';
  }

  // 如果有弹窗，按 ESC 也可以关闭
  if (currentModal && keyCode === ESCAPE) {
    currentModal = null;
  }
}
