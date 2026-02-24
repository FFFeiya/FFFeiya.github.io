// ============ 全局变量与状态 ============
let gameState = 'mainMenu'; // mainMenu, levelSelect, fleetFormation, fleetResearch, battle, victory, defeat

// 数据相关
let ships = [];        // 所有舰船数据
let equipments = [];   // 所有装备数据
let levels = [];       // 所有关卡数据
let gachaPool = [];    // 抽卡池数据
let playerData = {     // 玩家数据
  coins: 1000, // 初始金币
  ownedShips: ['Nagato'], // 初始拥有的舰船
  unlockedShipBlueprints: ['Mutsu'], // 初始解锁的舰船图纸
  ownedEquipments: ['Single 12mm Cannon'], // 初始拥有的装备
  unlockedEquipBlueprints: [], // 初始解锁的装备图纸
  clearedLevels: []
};

// 舰队编成相关
let fleetSlots = []; // 舰队槽位
let playerFleet = []; // 玩家保存的舰队（ship,equipments,totalEquipmentMass）
let currentModal = null;

// UI相关
let mainMenuButtons = [];
let fleetFormationSaveButton;

// 星球和轨道参数
let radius = 200; 
let centerX, centerY;
let selectedOrbitIndex = 0;
let rotationAngle = 0;
let G = 6.67430e-11; 
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

// ============ preload ============
function preload() {
  // 预加载默认模型
  defaultModel = loadModel('models/default.obj', true, 
    () => {},
    () => { console.error('Failed to load default model.'); }
  );

  // 读取数据文件
  loadShipData();
  loadEquipmentData();
  loadLevelData();
  loadGachaData();
}

// ============ setup ============
function setup() {
  createCanvas(1200, 900); // 使用2D模式
  textAlign(CENTER, CENTER);
  centerX = width / 2;
  centerY = height / 2;

  // 初始化主菜单按钮
  initMainMenuButtons();

  // 加载玩家数据
  loadPlayerDataFromLocalStorage();

  // 初始化舰队编成保存按钮
  fleetFormationSaveButton = new Button(centerX - 150, centerY + 150, 300, 50, 'Save Fleet', () => {
    saveFleetFormation();
  });

  // 初始化舰队槽位
  initFleetFormation();
}

// ============ draw ============
function draw() {
  background(240); // 淡灰色背景
  noStroke();
  fill(0);

  if (gameState === 'mainMenu') {
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
    if (line.trim() === '') continue;
    let parts = line.split(',');
    // EnglishName,Type,Firepower,AA,Endurance,Armor,Evasion,CarryCapacity,Range,MinOrbit,Price,Attribute
    let s = {
      englishName: parts[0],
      type: parts[1],
      firepower: parseFloat(parts[2]),
      aa: parseFloat(parts[3]),
      endurance: parseFloat(parts[4]),
      armor: parseFloat(parts[5]),
      evasion: parseFloat(parts[6]),
      carryCapacity: parseFloat(parts[7]),
      range: parseFloat(parts[8]),
      minOrbit: parseFloat(parts[9]),
      price: parseFloat(parts[10]),
      attribute: translateAttribute(parts[11])
    };
    ships.push(s);

    // 预加载舰船模型
    let modelPath = `models/${s.englishName}.obj`;
    shipModels[s.englishName] = loadModel(modelPath, true, 
      () => { 
        // 模型加载成功
      },
      () => { 
        console.error(`Failed to load model: ${modelPath}`);
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
    if (line.trim() === '') continue;
    let parts = line.split(',');
    // EnglishName,Firepower,AA,Armor,Evasion,Range,Mass,Attribute,Price
    let e = {
      englishName: parts[0],
      firepower: parseFloat(parts[1]),
      aa: parseFloat(parts[2]),
      armor: parseFloat(parts[3]),
      evasion: parseFloat(parts[4]),
      range: parseFloat(parts[5]),
      mass: parseFloat(parts[6]),
      attribute: translateAttribute(parts[7]),
      price: parseFloat(parts[8])
    };
    equipments.push(e);
  }
}

function loadLevelData() {
  loadStrings(LEVEL_DATA_FILE, parseLevelData);
}

function parseLevelData(data) {
  // 简化为只解析一个关卡示例
  let idx = 0;
  let levelLine = data[idx++].split(',');
  let lvl = {
    id: parseInt(levelLine[0]),
    planetMass: parseFloat(levelLine[1]),
    planetRotationSpeed: parseFloat(levelLine[2]),
    planetRadius: parseFloat(levelLine[3])
  };
  let redCount = parseInt(data[idx++]);
  let rp = [];
  for (let i=0; i<redCount; i++) {
    let rpLine = data[idx++].split(',');
    let rpObj = {
      name: rpLine[0],
      firepower: parseFloat(rpLine[1]),
      aa: parseFloat(rpLine[2]),
      endurance: parseFloat(rpLine[3]),
      armor: parseFloat(rpLine[4]),
      evasion: parseFloat(rpLine[5]),
      range: parseFloat(rpLine[6]),
      attribute: translateAttribute(rpLine[7]),
      lat: parseFloat(rpLine[8]),
      lon: parseFloat(rpLine[9]),
      minOrbit: parseFloat(rpLine[10]),
      health: parseFloat(rpLine[3])
    };
    if (rpObj.minOrbit > 0) {
      // 轨道红点
      rpObj.orbitRadius = lvl.planetRadius + rpObj.minOrbit;
      rpObj.orbitalSpeed = sqrt((G * lvl.planetMass) / (rpObj.orbitRadius * 1000)) * 10;
      rpObj.orbitalSpeed *= 1e-6;
      rpObj.angle = radians(rpObj.lon);
    }
    rp.push(rpObj);
  }
  let rewardCoins = data[idx++].split(',');
  lvl.rewardCoinsMin = parseInt(rewardCoins[0]);
  lvl.rewardCoinsMax = parseInt(rewardCoins[1]);

  let dropCount = parseInt(data[idx++]);
  lvl.drops = [];
  for (let i=0; i<dropCount; i++) {
    let dLine = data[idx++].split(',');
    lvl.drops.push({
      englishName: dLine[0],
      probability: parseFloat(dLine[1])
    });
  }

  lvl.redPoints = rp;
  levels = [lvl]; // 只有一个关卡示例
}

function loadGachaData() {
  loadStrings(GACHA_DATA_FILE, parseGachaData);
}

function parseGachaData(data) {
  gachaPool = [];
  for (let line of data) {
    if (line.trim() === '') continue;
    let parts = line.split(',');
    gachaPool.push({englishName: parts[0], probability: parseFloat(parts[1])});
  }
}

// ============ 玩家数据加载与保存 ============
function loadPlayerDataFromLocalStorage() {
  let savedData = localStorage.getItem('playerData');
  if (savedData) {
    try {
      playerData = JSON.parse(savedData);
    } catch (e) {
      console.error('Failed to parse playerData from localStorage.');
      playerData = { 
        coins: 1000, 
        ownedShips: ['Nagato'], 
        unlockedShipBlueprints: ['Mutsu'], 
        ownedEquipments: ['Single 12mm Cannon'], 
        unlockedEquipBlueprints: [], 
        clearedLevels: [] 
      };
    }
  } else {
    // 初始数据
    playerData = { 
      coins: 1000, 
      ownedShips: ['Nagato'], 
      unlockedShipBlueprints: ['Mutsu'], 
      ownedEquipments: ['Single 12mm Cannon'], 
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
      if (loadedData.coins !== undefined && 
          loadedData.ownedShips !== undefined &&
          loadedData.unlockedShipBlueprints !== undefined &&
          loadedData.ownedEquipments !== undefined &&
          loadedData.unlockedEquipBlueprints !== undefined &&
          loadedData.clearedLevels !== undefined) {
        playerData = loadedData;
        // 重新过滤舰船和装备
        filterOwnedItems();
        // 更新舰队槽位
        initFleetFormation();
        currentModal = new InfoModal('Progress loaded successfully!');
        savePlayerDataToLocalStorage();
      } else {
        throw new Error('Invalid data structure.');
      }
    } catch (err) {
      console.error('Failed to load player progress:', err);
      currentModal = new InfoModal('Failed to load progress. Please check the file format.');
    }
  };
  reader.readAsText(file);
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
      let ship = ships.find(s => s.englishName === shipName);
      if (ship) {
        slot.ship = ship;
        slot.equipments = playerFleet[i].equipments.map(eqName => equipments.find(e => e && e.englishName === eqName));
        slot.totalEquipmentMass = playerFleet[i].totalEquipmentMass;
      }
    }
    fleetSlots.push(slot);
  }
}

// ============ 按钮与UI相关函数 ============
function initMainMenuButtons() {
  mainMenuButtons.push(new Button(centerX - 150, centerY - 250, 300, 50, 'Select Level', () => {
    gameState = 'levelSelect';
  }));
  mainMenuButtons.push(new Button(centerX - 150, centerY - 170, 300, 50, 'Fleet Formation', () => {
    gameState = 'fleetFormation';
    initFleetFormation();
  }));
  mainMenuButtons.push(new Button(centerX - 150, centerY - 90, 300, 50, 'Fleet Research', () => {
    gameState = 'fleetResearch';
  }));
  mainMenuButtons.push(new Button(centerX - 150, centerY - 10, 300, 50, 'Save Progress', () => {
    saveProgressToFile();
  }));
  mainMenuButtons.push(new Button(centerX - 150, centerY + 70, 300, 50, 'Load Progress', () => {
    document.getElementById('fileInput').click();
  }));
  mainMenuButtons.push(new Button(centerX - 150, centerY + 150, 300, 50, 'Exit Game', () => {
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

// ============ 绘制主菜单 ============
function drawMainMenu() {
  push();
  // No global translate needed
  fill(0);
  textSize(48);
  textAlign(CENTER, CENTER);
  text('Fleet Battle Game', centerX, 150);

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
  text('Select Level', centerX, 150);

  // 绘制所有关卡
  for (let i = 0; i < levels.length; i++) {
    let lvl = levels[i];
    if (!lvl.button) {
      lvl.button = new Button(centerX - 100, 200 + i * 80, 200, 50, `Level ${lvl.id}`, () => {
        // 设置当前关卡
        currentLevel = lvl;

        // 根据关卡数据初始化战斗场景
        initBattle();

        // 进入战斗状态
        gameState = 'battle';
      });
    }
    lvl.button.update();
    lvl.button.display();
  }
  pop();
}

// ============ 绘制舰队编成界面 ============
function drawFleetFormation() {
  push();
  fill(0);
  textSize(32);
  textAlign(CENTER, CENTER);
  text('Fleet Formation', centerX, 150);

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
  text('Fleet Research', centerX, 150);

  // 显示金币
  fill(0);
  textSize(20);
  textAlign(LEFT, CENTER);
  text(`Coins: ${playerData.coins}`, centerX - 250, 200);

  // 抽卡按钮
  let singleDrawBtn = new Button(centerX - 200, 250, 200, 50, 'Draw x1 (100)', () => {
    tryGacha(1);
  });
  singleDrawBtn.update();
  singleDrawBtn.display();

  let multiDrawBtn = new Button(centerX, 250, 200, 50, 'Draw x5 (500)', () => {
    tryGacha(5);
  });
  multiDrawBtn.update();
  multiDrawBtn.display();

  // 图纸研发区域
  fill(0);
  textSize(24);
  textAlign(CENTER, CENTER);
  text('Blueprint Unlock', centerX, 350);

  // 显示可解锁的舰船图纸
  let unlockY = 400;
  // 左侧为舰船图纸
  for (let ship of ships) {
    if (playerData.ownedShips.includes(ship.englishName) && 
        playerData.unlockedShipBlueprints.includes(ship.englishName) === false) {
      fill(255);
      stroke(0);
      rect(centerX - 200, unlockY, 150, 40);
      fill(0);
      noStroke();
      textSize(14);
      text(`Unlock ${ship.englishName} BP`, centerX - 125, unlockY + 20);
      // Unlock按钮
      let unlockBtn = new Button(centerX - 50, unlockY, 100, 40, 'Unlock', () => {
        unlockBlueprint(ship.englishName, 'ship');
      });
      unlockBtn.update();
      unlockBtn.display();
      unlockY += 60;
    }
  }

  // 右侧为装备图纸
  for (let equip of equipments) {
    if (playerData.ownedEquipments.includes(equip.englishName) && 
        playerData.unlockedEquipBlueprints.includes(equip.englishName) === false) {
      fill(255);
      stroke(0);
      rect(centerX + 50, unlockY, 150, 40);
      fill(0);
      noStroke();
      textSize(14);
      text(`Unlock ${equip.englishName} BP`, centerX + 125, unlockY + 20);
      // Unlock按钮
      let unlockBtn = new Button(centerX + 200, unlockY, 100, 40, 'Unlock', () => {
        unlockBlueprint(equip.englishName, 'equipment');
      });
      unlockBtn.update();
      unlockBtn.display();
      unlockY += 60;
    }
  }

  pop();
}

// ============ 尝试抽卡 ============
function tryGacha(times) {
  let cost = times * 100;
  if (playerData.coins < cost) {
    currentModal = new InfoModal('Not enough coins!');
    return;
  }

  playerData.coins -= cost;
  let results = [];
  for (let i = 0; i < times; i++) {
    let r = random();
    let cum = 0;
    for (let item of gachaPool) {
      cum += item.probability;
      if (r <= cum) {
        results.push(item.englishName);
        break;
      }
    }
  }

  let finalResultMsg = 'Results:\n';
  for (let res of results) {
    let isShip = ships.some(s => s.englishName === res);
    let isEquip = equipments.some(e => e.englishName === res);
    let owned = false;
    let alreadyUnlocked = false;

    if (isShip) {
      owned = playerData.ownedShips.includes(res);
      alreadyUnlocked = playerData.unlockedShipBlueprints.includes(res);
    } else if (isEquip) {
      owned = playerData.ownedEquipments.includes(res);
      alreadyUnlocked = playerData.unlockedEquipBlueprints.includes(res);
    }

    if (owned) {
      playerData.coins += 50; // 返还金币
      finalResultMsg += `${res} (Duplicate, refunded 50 coins)\n`;
    } else {
      finalResultMsg += `${res} (New)\n`;
      if (isShip) {
        playerData.ownedShips.push(res);
      } else if (isEquip) {
        playerData.ownedEquipments.push(res);
      }
    }
  }

  currentModal = new InfoModal(finalResultMsg.trim());
  savePlayerDataToLocalStorage();
}

// ============ 解锁图纸 ============
function unlockBlueprint(name, type) {
  let cost = 100;
  if (playerData.coins < cost) {
    currentModal = new InfoModal('Not enough coins to unlock!');
    return;
  }

  playerData.coins -= cost;
  if (type === 'ship') {
    playerData.unlockedShipBlueprints.push(name);
  } else if (type === 'equipment') {
    playerData.unlockedEquipBlueprints.push(name);
  }
  currentModal = new InfoModal(`${name} blueprint unlocked!`);
  savePlayerDataToLocalStorage();
}

// ============ 战斗相关函数 ============
let currentLevel = null;

function initBattle() {
  radius = currentLevel.planetRadius;
  planetMass = currentLevel.planetMass;
  rotationAngle = 0;

  satellites = [];
  selectedOrbitIndex = 0;

  // 使用玩家编成
  if (playerFleet && playerFleet.length > 0) {
    for (let i = 0; i < playerFleet.length; i++) {
      let shipName = playerFleet[i].ship;
      let ship = ships.find(s => s.englishName === shipName);
      if (ship) {
        let satellite = {
          orbitRadius: radius + ship.minOrbit,
          satelliteAngle: random(TWO_PI),
          ship: ship,
          equipments: playerFleet[i].equipments.map(eqName => equipments.find(e => e && e.englishName === eqName)),
          orbitalSpeed: sqrt((G * planetMass) / (radius + ship.minOrbit) / 1000) * 10 * 1e-6,
          health: ship.endurance,
          attackCooldown: 0
        };
        satellites.push(satellite);
      }
    }
  }

  // 初始化红点
  redPoints = [];
  for (let point of currentLevel.redPoints) {
    let rp = {...point};
    if (rp.minOrbit > 0) {
      rp.orbitalSpeed = sqrt((G * planetMass) / (rp.orbitRadius * 1000)) * 10 * 1e-6;
      rp.angle = radians(rp.lon);
    }
    redPoints.push(rp);
  }
}

function drawBattle() {
  // 绘制星球
  fill(100, 100, 255);
  ellipse(centerX, centerY, radius * 2, radius * 2);

  // 更新并绘制红点
  updateAndDrawRedPoints();

  // 更新并绘制卫星
  updateAndDrawSatellites();

  // 处理战斗逻辑
  processAttacks();

  // 检查游戏状态
  if (redPoints.length === 0) {
    gameState = 'victory';
    addBattleLog('All Red Points have been destroyed!');
    // 奖励金币
    let reward = floor(random(currentLevel.rewardCoinsMin, currentLevel.rewardCoinsMax));
    playerData.coins += reward;
    addBattleLog(`You earned ${reward} coins.`);
    savePlayerDataToLocalStorage();
  }

  // 检查是否所有舰船被摧毁
  let activeShips = satellites.filter(sat => sat.ship && sat.health > 0);
  if (activeShips.length === 0) {
    gameState = 'defeat';
    addBattleLog('All your ships have been destroyed!');
    savePlayerDataToLocalStorage();
  }
}

function updateAndDrawSatellites() {
  for (let satellite of satellites) {
    if (satellite.ship && satellite.health > 0) {
      // 更新位置
      satellite.satelliteAngle += satellite.orbitalSpeed;
      let x = centerX + satellite.orbitRadius * cos(satellite.satelliteAngle);
      let y = centerY + satellite.orbitRadius * sin(satellite.satelliteAngle);

      satellite.absX = x;
      satellite.absY = y;

      // 绘制卫星（舰船）
      fill(0, 0, 255);
      noStroke();
      ellipse(x, y, 20, 20);
    }
  }
}

function updateAndDrawRedPoints() {
  for (let point of redPoints) {
    if (point.minOrbit === 0) {
      // 地表红点，随星球自转（假设星球不旋转，简化处理）
      let latRadian = radians(point.lat);
      let lonRadian = radians(point.lon);
      let x0 = centerX + radius * cos(latRadian) * cos(lonRadian);
      let y0 = centerY + radius * sin(latRadian);

      point.absX = x0;
      point.absY = y0;
    } else {
      // 轨道红点
      point.angle += point.orbitalSpeed;
      let x0 = centerX + point.orbitRadius * cos(point.angle);
      let y0 = centerY + point.orbitRadius * sin(point.angle);

      point.absX = x0;
      point.absY = y0;
    }

    // 绘制红点
    fill(255, 0, 0);
    noStroke();
    ellipse(point.absX, point.absY, 16, 16);
  }
}

function addBattleLog(message) {
  battleLog.push(message);
  // 自动移除最老的日志以限制数量
  if (battleLog.length > maxBattleLog) { // 保留最近 maxBattleLog 条
    battleLog.shift();
  }
  savePlayerDataToLocalStorage();
}

function processAttacks() {
  // 红点攻击舰船
  for (let point of redPoints) {
    if (point.attackCooldown > 0) {
      point.attackCooldown--;
      continue;
    }

    // 寻找进入攻击范围的舰船
    let targetsInRange = [];
    for (let satellite of satellites) {
      if (!satellite.ship || satellite.health <= 0) continue;
      let distance = dist(point.absX, point.absY, satellite.absX, satellite.absY);
      if (distance <= point.range) {
        targetsInRange.push({satellite: satellite, distance: distance});
      }
    }

    if (targetsInRange.length > 0) {
      // 优先攻击距离最近的舰船
      targetsInRange.sort((a, b) => a.distance - b.distance);
      let target = targetsInRange[0].satellite;

      // 计算属性克制
      let multiplier = getAttributeMultiplier(point.attribute, target.ship.attribute);

      // 计算伤害
      let damage = point.firepower * multiplier / 60; // 假设60帧每秒

      // 应用伤害
      target.health -= damage;
      addBattleLog(`Red Point ${point.name} attacked ${target.ship.englishName} for ${damage.toFixed(2)} damage.`);

      // 检查是否舰船被摧毁
      if (target.health <= 0) {
        addBattleLog(`${target.ship.englishName} has been destroyed.`);
        // 替换为预备舰
        let activeIndex = fleetSlots.findIndex(slot => slot.ship && slot.ship.englishName === target.ship.englishName && slot.type === 'Active');
        if (activeIndex !== -1 && fleetSlots[activeIndex + 4] && fleetSlots[activeIndex + 4].ship) {
          fleetSlots[activeIndex].ship = fleetSlots[activeIndex + 4].ship;
          fleetSlots[activeIndex].equipments = fleetSlots[activeIndex + 4].equipments.slice();
          fleetSlots[activeIndex].totalEquipmentMass = fleetSlots[activeIndex + 4].totalEquipmentMass;
          fleetSlots[activeIndex + 4].ship = null;
          fleetSlots[activeIndex + 4].equipments = [null, null, null, null];
          fleetSlots[activeIndex + 4].totalEquipmentMass = 0;
          addBattleLog(`Reserve ship has replaced the destroyed ship.`);
        } else {
          // 没有预备舰，移除舰船
          target.ship = null;
        }
      }

      // 设置攻击冷却
      point.attackCooldown = 60; // 攻击间隔1秒
    }
  }

  // 舰船攻击红点
  for (let satellite of satellites) {
    if (!satellite.ship || satellite.health <= 0) continue;

    if (satellite.attackCooldown > 0) {
      satellite.attackCooldown--;
      continue;
    }

    // 寻找进入攻击范围的红点
    let targetsInRange = [];
    for (let point of redPoints) {
      let distance = dist(satellite.absX, satellite.absY, point.absX, point.absY);
      if (distance <= satellite.range) {
        targetsInRange.push({point: point, distance: distance});
      }
    }

    if (targetsInRange.length > 0) {
      // 优先攻击距离最近的红点
      targetsInRange.sort((a, b) => a.distance - b.distance);
      let target = targetsInRange[0].point;

      // 计算属性克制
      let multiplier = getAttributeMultiplier(satellite.ship.attribute, target.attribute);

      // 计算伤害
      let damage = satellite.firepower * multiplier / 60; // 假设60帧每秒

      // 应用伤害
      target.health -= damage;
      addBattleLog(`${satellite.ship.englishName} attacked Red Point ${target.name} for ${damage.toFixed(2)} damage.`);

      // 检查是否红点被摧毁
      if (target.health <= 0) {
        addBattleLog(`Red Point ${target.name} has been destroyed.`);
        redPoints = redPoints.filter(p => p !== target);
      }

      // 设置攻击冷却
      satellite.attackCooldown = 60; // 攻击间隔1秒
    }
  }

  savePlayerDataToLocalStorage();
}

// 计算属性克制倍数
function getAttributeMultiplier(attackerAttr, defenderAttr) {
  let multiplier = 1;

  // 强克制
  if (strongAgainst[attackerAttr] && strongAgainst[attackerAttr].includes(defenderAttr)) {
    multiplier *= 2;
    addBattleLog(`Firepower boosted by attribute advantage (${attackerAttr} vs ${defenderAttr}).`);
  }

  // 被强克制
  if (strongAgainst[defenderAttr] && strongAgainst[defenderAttr].includes(attackerAttr)) {
    multiplier *= 0.5;
    addBattleLog(`Firepower reduced by defender's attribute advantage (${attackerAttr} vs ${defenderAttr}).`);
  }

  // 弱克制
  if (weakAgainst[attackerAttr] && weakAgainst[attackerAttr].includes(defenderAttr)) {
    multiplier *= 1.5;
    addBattleLog(`Firepower boosted by weak attribute advantage (${attackerAttr} vs ${defenderAttr}).`);
  }

  return multiplier;
}

// ============ 绘制胜利界面 ============
function drawVictoryScreen() {
  push();
  fill(0, 255, 0);
  textSize(48);
  textAlign(CENTER, CENTER);
  text('Victory!', centerX, centerY);
  pop();
}

// ============ 绘制失败界面 ============
function drawDefeatScreen() {
  push();
  fill(255, 0, 0);
  textSize(48);
  textAlign(CENTER, CENTER);
  text('Defeat!', centerX, centerY);
  pop();
}

// ============ 存档与加载舰队编成 ============
function saveFleetFormation() {
  // 检查舰船的搭载是否超载
  for (let slot of fleetSlots) {
    if (slot.ship) {
      if (slot.totalEquipmentMass > slot.ship.carryCapacity) {
        currentModal = new InfoModal(`Ship ${slot.ship.englishName} is overloaded! Cannot save.`);
        return;
      }
    }
  }

  // 保存玩家编成数据
  playerFleet = fleetSlots.map(slot => {
    return {
      ship: slot.ship ? slot.ship.englishName : null,
      equipments: slot.equipments.map(eq => eq ? eq.englishName : null),
      totalEquipmentMass: slot.totalEquipmentMass
    };
  });

  savePlayerDataToLocalStorage();
  currentModal = new InfoModal('Fleet saved successfully!');
}

// ============ 过滤已拥有的舰船与装备 ============
function filterOwnedItems() {
  // 仅保留已拥有的舰船和装备
  ships = ships.filter(s => playerData.ownedShips.includes(s.englishName));
  equipments = equipments.filter(e => playerData.ownedEquipments.includes(e.englishName));
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
    this.type = type; // 'Active' or 'Reserve'
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
      text(this.ship.englishName, this.x + this.w / 2, this.y + 40);

      // 显示四个装备格子
      let eqSize = 30;
      for (let i = 0; i < 4; i++) {
        let eqX = this.x + 10 + i * (eqSize + 10);
        let eqY = this.y + 70;
        let equip = this.equipments[i];
        // Hover detection for equipment slots
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
          text(equip.englishName.slice(0, 4), eqX + eqSize / 2, eqY + eqSize / 2);
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
      text('Click to Select Ship', this.x + this.w / 2, this.y + this.h / 2);
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
    text('Select a Ship:', listX, listY - 20);
    for (let i = 0; i < ships.length; i++) {
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        let ship = ships[i];
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
        text(ship.englishName, listX + 5, y + this.itemHeight / 2 - 7);
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
      text(this.selectedShip.englishName, detailX + detailWidth / 2, detailY + 20);

      // 显示舰船属性
      textSize(14);
      let attrs = [
        `Type: ${this.selectedShip.type}`,
        `Firepower: ${this.selectedShip.firepower}`,
        `AA: ${this.selectedShip.aa}`,
        `Endurance: ${this.selectedShip.endurance}`,
        `Armor: ${this.selectedShip.armor}`,
        `Evasion: ${this.selectedShip.evasion}`,
        `Carry Capacity: ${this.selectedShip.carryCapacity}`,
        `Range: ${this.selectedShip.range}`,
        `Min Orbit: ${this.selectedShip.minOrbit}`,
        `Attribute: ${this.selectedShip.attribute}`
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
      let modelToRender = shipModels[this.selectedShip.englishName] || defaultModel;
      if (modelToRender) {
        modelGraphics.model(modelToRender);
      } else {
        modelGraphics.fill(0);
        modelGraphics.textSize(16);
        modelGraphics.text('Loading...', 0, 0);
      }
      modelGraphics.pop();
      image(modelGraphics, detailX + 205, detailY + 55, 140, 140);
    } else {
      fill(0);
      textSize(16);
      textAlign(CENTER, CENTER);
      text('No Ship Selected', detailX + detailWidth / 2, detailY + detailHeight / 2);
    }

    // 绘制确定按钮
    let btnX = this.x + 250;
    let btnY = this.y + this.height - 60;
    let btnW = 100;
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
    text('Confirm', btnX + btnW / 2, btnY + btnH / 2 - 7);

    pop();
  }

  mousePressed() {
    // 检测舰船列表点击
    let listX = this.x + 10;
    let listY = this.y + 10;
    let listWidth = 200;
    let listHeight = this.height - 20;

    for (let i = 0; i < ships.length; i++) {
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        if (mouseX >= listX && mouseX <= listX + listWidth &&
            mouseY >= y && mouseY <= y + this.itemHeight) {
          this.selectedShip = ships[i];
        }
      }
    }

    // 检测确定按钮点击
    let btnX = this.x + 250;
    let btnY = this.y + this.height - 60;
    let btnW = 100;
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
  }

  mouseWheel(event) {
    // 处理滚动
    let delta = event.delta;
    this.scrollOffset += delta > 0 ? 1 : -1;
    this.scrollOffset = constrain(this.scrollOffset, 0, ships.length - this.visibleItems);
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
    text('Select Equipment:', listX, listY - 20);
    for (let i = 0; i < equipments.length; i++) {
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        let equip = equipments[i];
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
        text(equip.englishName, listX + 5, y + this.itemHeight / 2 - 7);
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
      text(this.selectedEquip.englishName, detailX + detailWidth / 2, detailY + 20);

      // 显示装备属性
      textSize(14);
      let attrs = [
        `Firepower: ${this.selectedEquip.firepower}`,
        `AA: ${this.selectedEquip.aa}`,
        `Armor: ${this.selectedEquip.armor}`,
        `Evasion: ${this.selectedEquip.evasion}`,
        `Range: ${this.selectedEquip.range}`,
        `Mass: ${this.selectedEquip.mass}`,
        `Attribute: ${this.selectedEquip.attribute}`,
        `Price: ${this.selectedEquip.price}`
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
        modelGraphics.text('Loading...', 0, 0);
      }
      modelGraphics.pop();
      image(modelGraphics, detailX + 205, detailY + 55, 140, 140);
    } else {
      fill(0);
      textSize(16);
      textAlign(CENTER, CENTER);
      text('No Equipment Selected', detailX + detailWidth / 2, detailY + detailHeight / 2);
    }

    // 绘制确定按钮
    let btnX = this.x + 250;
    let btnY = this.y + this.height - 60;
    let btnW = 100;
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
    text('Confirm', btnX + btnW / 2, btnY + btnH / 2 - 7);

    pop();
  }

  mousePressed() {
    // 检测装备列表点击
    let listX = this.x + 10;
    let listY = this.y + 10;
    let listWidth = 200;
    let listHeight = this.height - 20;

    for (let i = 0; i < equipments.length; i++) {
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        if (mouseX >= listX && mouseX <= listX + listWidth &&
            mouseY >= y && mouseY <= y + this.itemHeight) {
          this.selectedEquip = equipments[i];
        }
      }
    }

    // 检测确定按钮点击
    let btnX = this.x + 250;
    let btnY = this.y + this.height - 60;
    let btnW = 100;
    let btnH = 40;
    if (mouseX >= btnX && mouseX <= btnX + btnW &&
        mouseY >= btnY && mouseY <= btnY + btnH) {
      if (this.selectedEquip) {
        this.fleetSlot.equipments[this.equipIndex] = this.selectedEquip;
        this.fleetSlot.totalEquipmentMass += this.selectedEquip.mass;
        currentModal = null; // 关闭弹窗
        savePlayerDataToLocalStorage();
      }
    }
  }

  mouseWheel(event) {
    // 处理滚动
    let delta = event.delta;
    this.scrollOffset += delta > 0 ? 1 : -1;
    this.scrollOffset = constrain(this.scrollOffset, 0, equipments.length - this.visibleItems);
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
    let btnW = 100;
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
    text('Close', btnX + btnW / 2, btnY + btnH / 2 - 8);
    pop();
  }

  mousePressed() {
    // 检测关闭按钮点击
    let btnW = 100;
    let btnH = 40;
    let btnX = this.x + (this.width - btnW) / 2;
    let btnY = this.y + this.height - 60;
    if (mouseX >= btnX && mouseX <= btnX + btnW &&
        mouseY >= btnY && mouseY <= btnY + btnH) {
      currentModal = null;
    }
  }
}

// ============ 绘制战斗日志 ============
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

// ============ 绘制胜利界面 ============
function drawVictoryScreen() {
  push();
  fill(0, 255, 0);
  textSize(48);
  textAlign(CENTER, CENTER);
  text('Victory!', centerX, centerY);
  pop();
}

// ============ 绘制失败界面 ============
function drawDefeatScreen() {
  push();
  fill(255, 0, 0);
  textSize(48);
  textAlign(CENTER, CENTER);
  text('Defeat!', centerX, centerY);
  pop();
}

// ============ 绘制小地图 ============
function drawMiniMap() {
  // 绘制小地图区域
  push();
  noStroke();
  fill(230);
  rect(width - 300, 50, 280, 280);

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

    let mapX = width - 150 + (x - centerX) * scaleFactor;
    let mapY = 190 + (y - centerY) * scaleFactor;

    fill(0, 0, 255); // 蓝色表示舰船
    noStroke();
    ellipse(mapX, mapY, 6, 6);
    fill(0);
    textSize(10);
    textAlign(LEFT, CENTER);
    text(satellite.ship.englishName, mapX + 5, mapY - 5);
  }

  for (let point of redPoints) {
    let x = point.absX;
    let y = point.absY;

    // 缩放位置以适应小地图
    let scaleFactor = 90 / (radius + 300); // 调整比例因子

    let mapX = width - 150 + (x - centerX) * scaleFactor;
    let mapY = 190 + (y - centerY) * scaleFactor;

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

// ============ 事件处理 ============
function mousePressed() {
  if (currentModal) {
    currentModal.mousePressed();
  } else if (gameState === 'mainMenu') {
    for (let btn of mainMenuButtons) {
      btn.clicked();
    }
  } else if (gameState === 'levelSelect') {
    for (let lvl of levels) {
      lvl.button.clicked();
    }
  } else if (gameState === 'fleetFormation') {
    fleetFormationSaveButton.clicked();
    for (let slot of fleetSlots) {
      slot.clicked();
    }
  }
}

function mouseWheel(event) {
  if (currentModal && typeof currentModal.mouseWheel === 'function') {
    currentModal.mouseWheel(event);
    return false; // 阻止默认行为
  }
}

function keyPressed() {
  if (gameState === 'battle') {
    if (key === 'q') {
      // 示例功能：增加轨道半径
      if (satellites[selectedOrbitIndex]) {
        satellites[selectedOrbitIndex].orbitRadius += 5;
        satellites[selectedOrbitIndex].orbitalSpeed = sqrt((G * planetMass) / (satellites[selectedOrbitIndex].orbitRadius * 1000)) * 10 * 1e-6;
      }
    } else if (key === 'e') {
      // 示例功能：减少轨道半径
      if (satellites[selectedOrbitIndex]) {
        satellites[selectedOrbitIndex].orbitRadius = max(radius + 30, satellites[selectedOrbitIndex].orbitRadius - 5);
        satellites[selectedOrbitIndex].orbitalSpeed = sqrt((G * planetMass) / (satellites[selectedOrbitIndex].orbitRadius * 1000)) * 10 * 1e-6;
      }
    } else if (key === ' ') {
      // 示例功能：切换选中的轨道
      if (satellites.length > 0) {
        selectedOrbitIndex = (selectedOrbitIndex + 1) % satellites.length;
      }
    } else if (keyCode === ESCAPE) {
      gameState = 'levelSelect';
    }
  } else if (gameState === 'levelSelect' && keyCode === ESCAPE) {
    gameState = 'mainMenu';
  } else if (gameState === 'fleetResearch' && keyCode === ESCAPE) {
    gameState = 'mainMenu';
  } else if (gameState === 'fleetFormation' && keyCode === ESCAPE) {
    gameState = 'mainMenu';
  }
}

// ============ 模型预览函数 ============
function drawSelectedShipPreviewFleet() {
  // 在舰队编成界面右边空白处显示模型预览
  if (gameState === 'fleetFormation' && currentModal instanceof ShipSelectionModal) {
    let selectedShip = currentModal.selectedShip;

    if (selectedShip) {
      // 绘制模型预览区域
      fill(255);
      stroke(0);
      rect(centerX + 220, centerY - 200, 150, 150);

      // 创建一个p5.Graphics对象用于渲染3D模型
      let modelGraphics = createGraphics(140, 140, WEBGL);
      modelGraphics.background(255);
      modelGraphics.stroke(0);
      modelGraphics.noFill();
      modelGraphics.push();
      modelGraphics.rotateY(frameCount * 0.01);
      modelGraphics.scale(1.0); 
      let modelToRender = shipModels[selectedShip.englishName] || defaultModel;
      if (modelToRender) {
        modelGraphics.model(modelToRender);
      } else {
        modelGraphics.fill(0);
        modelGraphics.textSize(16);
        modelGraphics.text('Loading...', 0, 0);
      }
      modelGraphics.pop();
      image(modelGraphics, centerX + 225, centerY - 195, 140, 140);
    }
  }
}

function drawSelectedShipPreview() {
  // 在战斗界面右边空白处显示模型预览
  if (gameState === 'battle' && currentModal === null) {
    let selectedShip = satellites[selectedOrbitIndex] ? satellites[selectedOrbitIndex].ship : null;

    if (selectedShip && selectedShip.health > 0) {
      // 绘制模型预览区域
      fill(255);
      stroke(0);
      rect(width - 280, 50, 260, 260); // 右侧正方形区域

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
      let modelToRender = shipModels[selectedShip.englishName] || defaultModel;

      if (modelToRender) {
        modelGraphics.model(modelToRender);
      } else {
        // 显示加载中
        modelGraphics.fill(0);
        modelGraphics.textSize(24);
        modelGraphics.text('Loading...', 0, 0);
      }

      modelGraphics.pop();

      // 绘制模型到屏幕
      image(modelGraphics, width - 275, 55, 260, 260); // 调整模型显示位置
    }
  }
}
