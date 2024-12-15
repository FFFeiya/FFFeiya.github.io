// 全局变量和常量
let gameState = 'mainMenu'; // 游戏状态：mainMenu, levelSelect, fleetFormation, fleetResearch, battle
let levels = []; // 关卡列表
let currentLevel = null; // 当前关卡
let mainMenuButtons = []; // 主菜单按钮列表
let fleetFormationSaveButton; // 舰队编成保存按钮
let fleetSlots = []; // 舰队编成槽位
let ships = []; // 舰船数据
let equipments = []; // 装备数据
let playerFleet = []; // 玩家保存的舰队
let currentModal = null; // 当前的模态框（弹窗）
let satellites = []; // 卫星数据
let redPoints = []; // 红点数据

// 星球和轨道参数
let radius = 200; // 星球半径
let centerX;
let centerY;
let selectedOrbitIndex = 0; // 选中的轨道索引
let rotationAngle = 0; // 星球自转角度
let G = 6.67430e-11; // 引力常数
let planetMass = 5.972e24; // 星球质量，单位kg

// 飞船射程
let shootingRange = 100; // 可根据需要调整射程

let myFont;

// 属性克制关系
const strongAgainst = {
  '水': ['火'],
  '火': ['毒'],
  '毒': ['水'],
  '圣光': ['暗影'],
  '暗影': ['幽能'],
  '幽能': ['圣光']
};

const weakAgainst = {
  '圣光': ['水', '火', '毒'],
  '暗影': ['水', '火', '毒'],
  '幽能': ['普通']
};

// 设置函数
function preload() {
  // 预加载字体
}

function setup() {
  createCanvas(1200, 900);
  textAlign(CENTER, CENTER);
  centerX = width / 2 - 100; // 调整星球位置，右侧留出空间
  centerY = height / 2;

  // 初始化主菜单按钮
  initMainMenuButtons();

  // 初始化关卡
  initLevels();

  // 初始化舰船和装备数据
  initShips();
  initEquipments();

  // 初始化舰队编成保存按钮
  fleetFormationSaveButton = new Button(width - 120, height - 70, 100, 50, '保存', () => {
    saveFleetFormation();
  });
}

// 绘制函数
function draw() {
  background(255);
  cursor(ARROW); // 重置光标为默认状态

  if (gameState === 'mainMenu') {
    drawMainMenu();
  } else if (gameState === 'levelSelect') {
    drawLevelSelect();
  } else if (gameState === 'fleetFormation') {
    drawFleetFormation();
  } else if (gameState === 'fleetResearch') {
    drawFleetResearch();
  } else if (gameState === 'battle') {
    drawBattle();
  }

  // 绘制当前的模态框（如果有）
  if (currentModal) {
    currentModal.update();
    currentModal.display();
  }
}

// 初始化主菜单按钮
function initMainMenuButtons() {
  mainMenuButtons.push(new Button(width / 2 - 100, height / 2 - 100, 200, 50, '选择关卡', () => {
    gameState = 'levelSelect';
  }));
  mainMenuButtons.push(new Button(width / 2 - 100, height / 2 - 30, 200, 50, '舰队编成', () => {
    gameState = 'fleetFormation';
    initFleetFormation();
  }));
  mainMenuButtons.push(new Button(width / 2 - 100, height / 2 + 40, 200, 50, '舰队研发', () => {
    gameState = 'fleetResearch';
  }));
  mainMenuButtons.push(new Button(width / 2 - 100, height / 2 + 110, 200, 50, '退出游戏', () => {
    // 退出游戏，在浏览器中可以重载页面
    window.location.reload();
  }));
}

// 初始化关卡
function initLevels() {
  levels = [];
  let margin = 50;
  let spacing = 20;
  let buttonWidth = 200;
  let buttonHeight = 50;

  // 定义每个关卡的红点属性，包括 lat 和 lon
  let levelRedPoints = [
    // 第一关
    [
      {
        name: '1-1',
        firepower: 0.8,
        aa: 1.8,
        endurance: 30,
        armor: 5,
        evasion: 45,
        range: 150,
        attribute: '毒',
        lat: 30, // 固定纬度，您可以根据需要调整
        lon: 45, // 固定经度，您可以根据需要调整
      },
      {
        name: '1-2',
        firepower: 0.8,
        aa: 1.8,
        endurance: 25,
        armor: 5,
        evasion: 45,
        range: 180,
        attribute: '圣光',
        lat: -20,
        lon: 120,
      },
      {
        name: '1-3',
        firepower: 0.6,
        aa: 2.2,
        endurance: 30,
        armor: 5,
        evasion: 45,
        range: 150,
        attribute: '暗影',
        lat: 10,
        lon: 270,
      },
    ],
    // 第二关
    [
      {
        name: '2-1',
        firepower: 1.0,
        aa: 2.0,
        endurance: 35,
        armor: 6,
        evasion: 50,
        range: 160,
        attribute: '火',
        lat: 40,
        lon: 60,
      },
      {
        name: '2-2',
        firepower: 1.0,
        aa: 2.0,
        endurance: 30,
        armor: 6,
        evasion: 50,
        range: 190,
        attribute: '幽能',
        lat: -30,
        lon: 180,
      },
      {
        name: '2-3',
        firepower: 0.8,
        aa: 2.5,
        endurance: 35,
        armor: 6,
        evasion: 50,
        range: 160,
        attribute: '圣光',
        lat: 15,
        lon: 300,
      },
    ],
    // 第三关
    [
      {
        name: '3-1',
        firepower: 1.2,
        aa: 2.5,
        endurance: 40,
        armor: 7,
        evasion: 55,
        range: 170,
        attribute: '水',
        lat: 25,
        lon: 90,
      },
      {
        name: '3-2',
        firepower: 1.2,
        aa: 2.5,
        endurance: 35,
        armor: 7,
        evasion: 55,
        range: 200,
        attribute: '暗影',
        lat: -25,
        lon: 210,
      },
      {
        name: '3-3',
        firepower: 1.0,
        aa: 3.0,
        endurance: 40,
        armor: 7,
        evasion: 55,
        range: 170,
        attribute: '毒',
        lat: 0,
        lon: 330,
      },
    ],
    // 第四关
    [
      {
        name: '4-1',
        firepower: 1.5,
        aa: 3.0,
        endurance: 45,
        armor: 8,
        evasion: 60,
        range: 180,
        attribute: '火',
        lat: 35,
        lon: 75,
      },
      {
        name: '4-2',
        firepower: 1.5,
        aa: 3.0,
        endurance: 40,
        armor: 8,
        evasion: 60,
        range: 210,
        attribute: '幽能',
        lat: -35,
        lon: 195,
      },
      {
        name: '4-3',
        firepower: 1.3,
        aa: 3.5,
        endurance: 45,
        armor: 8,
        evasion: 60,
        range: 180,
        attribute: '圣光',
        lat: 5,
        lon: 315,
      },
    ],
    // 第五关
    [
      {
        name: '5-1',
        firepower: 1.8,
        aa: 3.5,
        endurance: 50,
        armor: 9,
        evasion: 65,
        range: 190,
        attribute: '水',
        lat: 45,
        lon: 105,
      },
      {
        name: '5-2',
        firepower: 1.8,
        aa: 3.5,
        endurance: 45,
        armor: 9,
        evasion: 65,
        range: 220,
        attribute: '暗影',
        lat: -45,
        lon: 225,
      },
      {
        name: '5-3',
        firepower: 1.5,
        aa: 4.0,
        endurance: 50,
        armor: 9,
        evasion: 65,
        range: 190,
        attribute: '毒',
        lat: 10,
        lon: 345,
      },
    ]
  ];

  for (let i = 0; i < 5; i++) {
    let x = width / 2 - buttonWidth / 2;
    let y = margin + i * (buttonHeight + spacing);

    // 创建关卡数据
    let levelData = {
      id: i + 1,
      planetMass: 5.972e24 + i * 1e23, // 不同的星球质量
      planetRotationSpeed: 0.01 + i * 0.005, // 不同的自转速度
      planetRadius: 200 + i * 20, // 不同的星球半径
      redPoints: levelRedPoints[i] || [], // 对应关卡的红点数据
    };

    levels.push(new LevelButton(x, y, buttonWidth, buttonHeight, levelData));
  }
}

// 绘制主菜单
function drawMainMenu() {
  fill(0);
  textSize(32);
  text('主菜单', width / 2, height / 2 - 200);

  for (let btn of mainMenuButtons) {
    btn.update();
    btn.display();
  }
}

// 绘制关卡选择界面
function drawLevelSelect() {
  fill(0);
  textSize(32);
  text('选择关卡', width / 2, 50);

  for (let lvl of levels) {
    lvl.update();
    lvl.display();
  }
}

// 绘制舰队编成界面
function drawFleetFormation() {
  fill(0);
  textSize(32);
  text('舰队编成', width / 2, 50);

  // 绘制舰队槽位
  for (let slot of fleetSlots) {
    slot.update();
    slot.display();
  }

  fleetFormationSaveButton.update();
  fleetFormationSaveButton.display();
}

// 绘制舰队研发界面
function drawFleetResearch() {
  fill(0);
  textSize(32);
  text('舰队研发界面（暂未实现）', width / 2, height / 2);
}

// 初始化舰队编成界面
function initFleetFormation() {
  fleetSlots = [];
  let margin = 50;
  let spacing = 20;
  let slotWidth = 200;
  let slotHeight = 200;

  for (let i = 0; i < 6; i++) {
    let x = margin + (i % 3) * (slotWidth + spacing);
    let y = 100 + Math.floor(i / 3) * (slotHeight + spacing);
    let slot = new FleetSlot(x, y, slotWidth, slotHeight, i < 4 ? '首发' : '预备');

    // 如果有保存的舰队，加载舰船和装备
    if (playerFleet && playerFleet[i]) {
      slot.ship = playerFleet[i].ship;
      slot.equipments = playerFleet[i].equipments.slice(); // 深拷贝
      slot.totalEquipmentMass = playerFleet[i].totalEquipmentMass;
    }

    fleetSlots.push(slot);
  }
}

// 保存舰队编成
function saveFleetFormation() {
  // 检查舰船的搭载是否超载
  for (let slot of fleetSlots) {
    if (slot.ship) {
      if (slot.totalEquipmentMass > slot.ship.carryCapacity) {
        alert(`舰船 ${slot.ship.name} 的装备超载！无法保存。`);
        return;
      }
    }
  }

  // 保存玩家编成数据
  playerFleet = fleetSlots.map(slot => {
    return {
      ship: slot.ship,
      equipments: slot.equipments.slice(), // 深拷贝装备数组
      totalEquipmentMass: slot.totalEquipmentMass,
    };
  });

  // 返回主菜单
  gameState = 'mainMenu';
}

// 初始化战斗界面
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
        let orbitRadius = radius + shipSlot.ship.minOrbit; // 正确计算轨道半径
        let satellite = {
          orbitRadius: orbitRadius,
          orbitQuat: { x: 0, y: 0, z: 0, w: 1 },
          satelliteAngle: 0,
          ship: shipSlot.ship,
          equipments: shipSlot.equipments,
          orbitalSpeed: 0, // 新增属性
        };
        satellites.push(satellite);
        calculateOrbitalSpeed(satellite); // 修改为传入卫星对象
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
      };
      satellites.push(satellite);
      calculateOrbitalSpeed(satellite); // 修改为传入卫星对象
    }
  }

  // 初始化红点
  redPoints = [];
  for (let i = 0; i < currentLevel.redPoints.length; i++) {
    let point = currentLevel.redPoints[i];
    redPoints.push({
      id: i,
      name: point.name,
      firepower: point.firepower,
      aa: point.aa,
      endurance: point.endurance,
      armor: point.armor,
      evasion: point.evasion,
      range: point.range,
      attribute: point.attribute,
      lat: point.lat, // 添加 lat
      lon: point.lon, // 添加 lon
      health: 100, // 初始血量，可根据需要调整
      absX: 0,
      absY: 0,
      absZ: 0
    });
  }
}

// 绘制战斗界面
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
}

// 鼠标点击事件处理
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
    // 处理舰队编成界面中舰船方块的点击
    for (let slot of fleetSlots) {
      slot.clicked();
    }
  }
}

// 键盘按下事件处理
function keyPressed() {
  if (gameState === 'battle') {
    if (key === 'q') {
      satellites[selectedOrbitIndex].orbitRadius += 5;
      calculateOrbitalSpeed(satellites[selectedOrbitIndex]); // 修改为传入卫星对象
    } else if (key === 'e') {
      satellites[selectedOrbitIndex].orbitRadius = max(radius + 30, satellites[selectedOrbitIndex].orbitRadius - 5);
      calculateOrbitalSpeed(satellites[selectedOrbitIndex]); // 修改为传入卫星对象
    } else if (key === ' ') {
      selectedOrbitIndex = (selectedOrbitIndex + 1) % satellites.length;
    } else if (keyCode === ESCAPE) {
      // 按下ESC返回关卡选择界面
      gameState = 'levelSelect';
    }
  } else if (gameState === 'levelSelect' && keyCode === ESCAPE) {
    // 返回主菜单
    gameState = 'mainMenu';
  } else if (gameState === 'fleetResearch' && keyCode === ESCAPE) {
    // 返回主菜单
    gameState = 'mainMenu';
  } else if (gameState === 'fleetFormation' && keyCode === ESCAPE) {
    // 返回主菜单
    gameState = 'mainMenu';
  }
}

// 鼠标滚轮事件处理（用于滚动列表）
function mouseWheel(event) {
  if (currentModal && typeof currentModal.mouseWheel === 'function') {
    currentModal.mouseWheel(event);
    return false; // 阻止默认行为
  }
}

// 以下为各个类的定义和相关函数

// 按钮类
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
    stroke(0);
    if (this.isHovered) {
      fill(200);
    } else {
      fill(255);
    }
    rect(this.x, this.y, this.w, this.h);
    fill(0);
    noStroke();
    textSize(16);
    text(
      this.label,
      this.x + this.w / 2,
      this.y + this.h / 2
    );
  }

  clicked() {
    if (this.isHovered && this.onClick) {
      this.onClick();
    }
  }
}

// 关卡按钮类
class LevelButton {
  constructor(x, y, w, h, levelData) {
    this.button = new Button(x, y, w, h, `关卡 ${levelData.id}`, () => {
      // 设置当前关卡
      currentLevel = levelData;

      // 根据关卡数据初始化战斗场景
      initBattle();

      // 进入战斗状态
      gameState = 'battle';
    });
    this.levelData = levelData;
  }

  update() {
    this.button.update();
  }

  display() {
    this.button.display();
  }
}

// 舰队槽位类
class FleetSlot {
  constructor(x, y, w, h, type) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type; // '首发' or '预备'
    this.ship = null;
    this.isHovered = false;
    this.equipments = [null, null, null, null];
    this.totalEquipmentMass = 0;
  }

  update() {
    if (
      mouseX >= this.x &&
      mouseX <= this.x + this.w &&
      mouseY >= this.y &&
      mouseY <= this.y + this.h
    ) {
      this.isHovered = true;
      // 不在这里改变光标，避免冲突
    } else {
      this.isHovered = false;
    }
  }

  display() {
    stroke(0);
    if (this.isHovered && !currentModal) {
      fill(200);
      cursor(HAND); // 只有在没有弹窗时改变光标
    } else {
      fill(255);
    }
    rect(this.x, this.y, this.w, this.h);

    fill(0);
    textSize(16);
    text(this.type, this.x + this.w / 2, this.y - 20);

    if (this.ship) {
      // 显示舰船名称
      textSize(14);
      text(this.ship.name, this.x + this.w / 2, this.y + 20);

      // 显示四个装备格子
      let eqSize = 30;
      for (let i = 0; i < 4; i++) {
        let eqX = this.x + 10 + i * (eqSize + 5);
        let eqY = this.y + 40;
        let isEqHovered = mouseX >= eqX && mouseX <= eqX + eqSize && mouseY >= eqY && mouseY <= eqY + eqSize;

        stroke(0);
        if (isEqHovered && !currentModal) {
          fill(200);
          cursor(HAND);
        } else {
          fill(255);
        }
        rect(eqX, eqY, eqSize, eqSize);

        if (this.equipments[i]) {
          // 显示装备名称的缩写
          textSize(10);
          fill(0);
          text(
            this.equipments[i].name.slice(0, 4),
            eqX + eqSize / 2,
            eqY + eqSize / 2
          );
        }
      }

      // 计算并显示属性
      let attributes = this.calculateAttributes();
      textSize(10);
      let attrText = `火力 ${attributes.firepower.toFixed(1)} 对空 ${attributes.aa.toFixed(1)} 耐久 ${attributes.endurance} 装甲 ${attributes.armor} 回避 ${attributes.evasion} 搭载 ${this.totalEquipmentMass}/${this.ship.carryCapacity} 射程 ${attributes.range} 最低轨道 ${this.ship.minOrbit}`;
      text(attrText, this.x + this.w / 2, this.y + this.h - 20);
    } else {
      textSize(14);
      text('点击选择舰船', this.x + this.w / 2, this.y + this.h / 2);
    }
  }

  clicked() {
    // 优先检测装备格子的点击
    if (this.ship) {
      let eqSize = 30;
      for (let i = 0; i < 4; i++) {
        let eqX = this.x + 10 + i * (eqSize + 5);
        let eqY = this.y + 40;
        if (
          mouseX >= eqX &&
          mouseX <= eqX + eqSize &&
          mouseY >= eqY &&
          mouseY <= eqY + eqSize
        ) {
          // 显示装备选择弹窗
          currentModal = new EquipmentSelectionModal(this, i);
          return; // 防止继续检测舰船框的点击
        }
      }
    }

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

    for (let eq of this.equipments) {
      if (eq) {
        attributes.firepower += eq.firepower || 0;
        attributes.aa += eq.aa || 0;
        attributes.armor += eq.armor || 0;
        attributes.evasion += eq.evasion || 0;
        attributes.range += eq.range || 0;
      }
    }

    return attributes;
  }
}

// 舰船选择弹窗类
class ShipSelectionModal {
  constructor(fleetSlot) {
    this.fleetSlot = fleetSlot;
    this.selectedShip = fleetSlot.ship || null;
    this.scrollOffset = 0;
    this.itemHeight = 30;
    this.visibleItems = 10;
  }

  update() {
    // 不需要更新
  }

  display() {
    // 绘制模态框背景
    fill(255);
    stroke(0);
    rect(width / 2 - 300, height / 2 - 200, 600, 400);

    // 绘制舰船列表左侧
    let listX = width / 2 - 290;
    let listY = height / 2 - 190;
    let listWidth = 200;
    let listHeight = 380;

    // 绘制滚动的舰船列表
    for (let i = 0; i < ships.length; i++) {
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        let ship = ships[i];
        let isHovered = mouseX >= listX && mouseX <= listX + listWidth && mouseY >= y && mouseY <= y + this.itemHeight;

        if (isHovered) {
          fill(200);
          cursor(HAND);
        } else {
          fill(255);
        }
        stroke(0);
        rect(listX, y, listWidth, this.itemHeight);

        fill(0);
        noStroke();
        textSize(14);
        text(ship.name, listX + listWidth / 2, y + this.itemHeight / 2);
      }
    }

    // 绘制右侧选中舰船的信息
    let detailX = width / 2 - 70;
    let detailY = height / 2 - 190;
    let detailWidth = 340;
    let detailHeight = 380;

    if (this.selectedShip) {
      fill(0);
      textSize(16);
      text(this.selectedShip.name, detailX + detailWidth / 2, detailY + 20);

      // 显示舰船属性
      textSize(14);
      let attrs = [
        `类型: ${this.selectedShip.type}`,
        `火力: ${this.selectedShip.firepower}`,
        `对空: ${this.selectedShip.aa}`,
        `耐久: ${this.selectedShip.endurance}`,
        `装甲: ${this.selectedShip.armor}`,
        `回避: ${this.selectedShip.evasion}`,
        `搭载: ${this.selectedShip.carryCapacity}`,
        `射程: ${this.selectedShip.range}`,
        `最低轨道: ${this.selectedShip.minOrbit}`,
        `属性: ${this.selectedShip.attribute}`,
      ];
      for (let i = 0; i < attrs.length; i++) {
        text(attrs[i], detailX + 20, detailY + 50 + i * 20);
      }
    }

    // 绘制确定按钮
    let btnX = detailX + detailWidth - 80;
    let btnY = detailY + detailHeight - 50;
    stroke(0);
    if (this.isConfirmButtonHovered()) {
      fill(200);
      cursor(HAND);
    } else {
      fill(255);
    }
    rect(btnX, btnY, 60, 30);

    fill(0);
    noStroke();
    textSize(14);
    text('确定', btnX + 30, btnY + 15);
  }

  isConfirmButtonHovered() {
    let detailX = width / 2 - 70;
    let detailY = height / 2 - 190;
    let detailWidth = 340;
    let detailHeight = 380;
    let btnX = detailX + detailWidth - 80;
    let btnY = detailY + detailHeight - 50;
    return mouseX >= btnX && mouseX <= btnX + 60 && mouseY >= btnY && mouseY <= btnY + 30;
  }

  mousePressed() {
    // 检查是否点击了舰船列表
    let listX = width / 2 - 290;
    let listY = height / 2 - 190;
    let listWidth = 200;
    let listHeight = 380;

    for (let i = 0; i < ships.length; i++) {
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        if (mouseX >= listX && mouseX <= listX + listWidth && mouseY >= y && mouseY <= y + this.itemHeight) {
          // 选中了舰船
          this.selectedShip = ships[i];
        }
      }
    }

    // 检查是否点击了确定按钮
    if (this.isConfirmButtonHovered() && this.selectedShip) {
      // 设置槽位的舰船
      this.fleetSlot.ship = this.selectedShip;
      this.fleetSlot.equipments = [null, null, null, null];
      this.fleetSlot.totalEquipmentMass = 0;
      currentModal = null; // 关闭弹窗
    }
  }

  mouseWheel(event) {
    // 处理滚动
    let delta = event.delta;
    this.scrollOffset += delta / 100;
    this.scrollOffset = constrain(this.scrollOffset, 0, ships.length - this.visibleItems);
    return false; // 阻止默认行为
  }
}

// 装备选择弹窗类
class EquipmentSelectionModal {
  constructor(fleetSlot, equipmentIndex) {
    this.fleetSlot = fleetSlot;
    this.equipmentIndex = equipmentIndex;
    this.selectedEquipment = fleetSlot.equipments[equipmentIndex] || null;
    this.scrollOffset = 0;
    this.itemHeight = 30;
    this.visibleItems = 10;
  }

  update() {
    // 不需要更新
  }

  display() {
    // 绘制模态框背景
    fill(255);
    stroke(0);
    rect(width / 2 - 300, height / 2 - 200, 600, 400);

    // 绘制装备列表左侧
    let listX = width / 2 - 290;
    let listY = height / 2 - 190;
    let listWidth = 200;
    let listHeight = 380;

    // 绘制滚动的装备列表
    for (let i = 0; i < equipments.length; i++) {
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        let eq = equipments[i];
        let isHovered = mouseX >= listX && mouseX <= listX + listWidth && mouseY >= y && mouseY <= y + this.itemHeight;

        if (isHovered) {
          fill(200);
          cursor(HAND);
        } else {
          fill(255);
        }
        stroke(0);
        rect(listX, y, listWidth, this.itemHeight);

        fill(0);
        noStroke();
        textSize(14);
        text(eq.name, listX + listWidth / 2, y + this.itemHeight / 2);
      }
    }

    // 绘制右侧选中装备的信息
    let detailX = width / 2 - 70;
    let detailY = height / 2 - 190;
    let detailWidth = 340;
    let detailHeight = 380;

    if (this.selectedEquipment) {
      fill(0);
      textSize(16);
      text(this.selectedEquipment.name, detailX + detailWidth / 2, detailY + 20);

      // 显示装备属性
      textSize(14);
      let attrs = [];
      if (this.selectedEquipment.firepower) attrs.push(`火力: ${this.selectedEquipment.firepower}`);
      if (this.selectedEquipment.aa) attrs.push(`对空: ${this.selectedEquipment.aa}`);
      if (this.selectedEquipment.armor) attrs.push(`装甲: ${this.selectedEquipment.armor}`);
      if (this.selectedEquipment.evasion) attrs.push(`回避: ${this.selectedEquipment.evasion}`);
      if (this.selectedEquipment.range) attrs.push(`射程: ${this.selectedEquipment.range}`);
      attrs.push(`质量: ${this.selectedEquipment.mass}`);
      attrs.push(`属性: ${this.selectedEquipment.attribute}`);

      for (let i = 0; i < attrs.length; i++) {
        text(attrs[i], detailX + 20, detailY + 50 + i * 20);
      }
    }

    // 绘制确定按钮
    let btnX = detailX + detailWidth - 80;
    let btnY = detailY + detailHeight - 50;
    stroke(0);
    if (this.isConfirmButtonHovered()) {
      fill(200);
      cursor(HAND);
    } else {
      fill(255);
    }
    rect(btnX, btnY, 60, 30);

    fill(0);
    noStroke();
    textSize(14);
    text('确定', btnX + 30, btnY + 15);
  }

  isConfirmButtonHovered() {
    let detailX = width / 2 - 70;
    let detailY = height / 2 - 190;
    let detailWidth = 340;
    let detailHeight = 380;
    let btnX = detailX + detailWidth - 80;
    let btnY = detailY + detailHeight - 50;
    return mouseX >= btnX && mouseX <= btnX + 60 && mouseY >= btnY && mouseY <= btnY + 30;
  }

  mousePressed() {
    // 检查是否点击了装备列表
    let listX = width / 2 - 290;
    let listY = height / 2 - 190;
    let listWidth = 200;
    let listHeight = 380;

    for (let i = 0; i < equipments.length; i++) {
      let y = listY + (i - this.scrollOffset) * this.itemHeight;
      if (y >= listY && y <= listY + listHeight - this.itemHeight) {
        if (mouseX >= listX && mouseX <= listX + listWidth && mouseY >= y && mouseY <= y + this.itemHeight) {
          // 选中了装备
          this.selectedEquipment = equipments[i];
        }
      }
    }

    // 检查是否点击了确定按钮
    if (this.isConfirmButtonHovered() && this.selectedEquipment) {
      // 设置槽位的装备
      // 先减去原有装备的质量
      let originalMass = this.fleetSlot.equipments[this.equipmentIndex] ? this.fleetSlot.equipments[this.equipmentIndex].mass : 0;
      this.fleetSlot.totalEquipmentMass -= originalMass;

      // 设置新的装备
      this.fleetSlot.equipments[this.equipmentIndex] = this.selectedEquipment;
      this.fleetSlot.totalEquipmentMass += this.selectedEquipment.mass;
      currentModal = null; // 关闭弹窗
    }
  }

  mouseWheel(event) {
    // 处理滚动
    let delta = event.delta;
    this.scrollOffset += delta / 100;
    this.scrollOffset = constrain(this.scrollOffset, 0, equipments.length - this.visibleItems);
    return false; // 阻止默认行为
  }
}

// 初始化舰船数据
function initShips() {
  ships = [
    // 示例舰船
    {
      name: '长门',
      type: '战舰',
      firepower: 8.2,
      aa: 3.1,
      endurance: 80,
      armor: 75,
      evasion: 24,
      carryCapacity: 12,
      range: 300,
      minOrbit: 200,
      attribute: '火',
    },
    {
      name: '陆奥',
      type: '战舰',
      firepower: 8.2,
      aa: 3.2,
      endurance: 80,
      armor: 70,
      evasion: 24,
      carryCapacity: 12,
      range: 300,
      minOrbit: 200,
      attribute: '水',
    },
    {
      name: '北上',
      type: '轻巡洋舰',
      firepower: 1.4,
      aa: 2.4,
      endurance: 40,
      armor: 10,
      evasion: 36,
      carryCapacity: 9,
      range: 200,
      minOrbit: 150,
      attribute: '毒',
    },
    // 继续添加其他舰船...
    {
      name: '岛风',
      type: '驱逐舰',
      firepower: 1.0,
      aa: 1.6,
      endurance: 36,
      armor: 0,
      evasion: 55,
      carryCapacity: 6,
      range: 150,
      minOrbit: 30,
      attribute: '火',
    },
    {
      name: '菊月',
      type: '驱逐舰',
      firepower: 0.8,
      aa: 1.8,
      endurance: 30,
      armor: 5,
      evasion: 45,
      carryCapacity: 6,
      range: 150,
      minOrbit: 30,
      attribute: '毒',
    },
    {
      name: '三日月',
      type: '驱逐舰',
      firepower: 0.8,
      aa: 1.8,
      endurance: 25,
      armor: 5,
      evasion: 45,
      carryCapacity: 6,
      range: 180,
      minOrbit: 30,
      attribute: '圣光',
    },
    {
      name: '望月',
      type: '驱逐舰',
      firepower: 0.6,
      aa: 2.2,
      endurance: 30,
      armor: 5,
      evasion: 45,
      carryCapacity: 6,
      range: 150,
      minOrbit: 30,
      attribute: '暗影',
    },
  ];
}

// 初始化装备数据
function initEquipments() {
  equipments = [
    // 示例装备
    {
      name: '12号单装炮',
      firepower: 0.1,
      mass: 1,
      attribute: '普通',
    },
    {
      name: '12.7号连装炮',
      firepower: 0.2,
      mass: 2,
      attribute: '普通',
    },
    {
      name: '10号连装高角炮',
      firepower: 0.1,
      aa: 0.2,
      mass: 2,
      attribute: '普通',
    },
    // 继续添加其他装备...
    {
      name: '三連装高爆雷',
      firepower: 0.2,
      mass: 2,
      attribute: '火',
    },
    {
      name: '四連装(酸素)高爆雷',
      firepower: 0.3,
      mass: 3,
      attribute: '火&毒',
    },
    {
      name: '九七式暗夜艦攻',
      firepower: 0.1,
      aa: 0.2,
      mass: 2,
      attribute: '暗影',
    },
    {
      name: '流星',
      firepower: 0.1,
      aa: 0.2,
      mass: 2,
      attribute: '圣光',
    },
    {
      name: '幽能艦战21型',
      firepower: 0.1,
      aa: 0.2,
      mass: 2,
      attribute: '幽能',
    },
    {
      name: '三式水雷投射機',
      firepower: 0.3,
      mass: 3,
      attribute: '水',
    },
    {
      name: '荆棘立场盾',
      armor: 6,
      mass: 2,
      attribute: '毒',
    },
    {
      name: '三式水型探信儀',
      range: 20,
      mass: 2,
      attribute: '水',
    },
    {
      name: '零式暗影卫队観測機',
      evasion: 5,
      mass: 1,
      attribute: '暗影',
    },
  ];
}

// 以下为战斗系统的相关函数

// 绘制纬线函数
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

// 绘制经线函数
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
    fill(0, alphaValue);
    ellipse(screenSatelliteX, screenSatelliteY, 10, 10);
    noFill();

    // 绘制卫星编号或舰船名称
    fill(0);
    textSize(12);
    let label = satellite.ship ? satellite.ship.name : `卫星 ${satellites.indexOf(satellite) + 1}`;
    text(label, screenSatelliteX + 10, screenSatelliteY);
    noFill();
  } else {
    // 绘制被遮挡的卫星（虚线描边，白色填充）
    stroke(0);
    strokeWeight(1);
    drawingContext.setLineDash([5, 5]);
    fill(255);
    ellipse(screenSatelliteX, screenSatelliteY, 10, 10);
    drawingContext.setLineDash([]);
    noFill();

    // 绘制卫星编号或舰船名称
    fill(0);
    textSize(12);
    let label = satellite.ship ? satellite.ship.name : `卫星 ${satellites.indexOf(satellite) + 1}`;
    text(label, screenSatelliteX + 10, screenSatelliteY);
    noFill();
  }

  // 绘制射程区域
  drawSatelliteRangeArea(satellitePositions3D[satellites.indexOf(satellite)], satellites.indexOf(satellite));
}

// 绘制卫星射程区域
function drawSatelliteRangeArea(satellitePos, satelliteIndex) {
  let R1 = radius; // 星球半径
  let R2 = shootingRange; // 射程
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

// 计算并显示卫星与红点之间的3D距离以及处理攻击
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
      if (distance <= shootingRange) {
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

        // 如果血量小于等于0，移除红点
        if (point.health <= 0) {
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
    satellites[selectedOrbitIndex].orbitQuat = rotateQuaternion(satellites[selectedOrbitIndex].orbitQuat, axis, -rotationSpeed);
  }
  if (keyIsDown(83)) { // 'S' 键
    // 绕 Z 轴旋转（水平轴翻转）
    axis = { x: 0, y: 0, z: 1 };
    satellites[selectedOrbitIndex].orbitQuat = rotateQuaternion(satellites[selectedOrbitIndex].orbitQuat, axis, rotationSpeed);
  }
  if (keyIsDown(65)) { // 'A' 键
    // 绕 X 轴旋转（里-外轴翻转）
    axis = { x: 1, y: 0, z: 0 };
    satellites[selectedOrbitIndex].orbitQuat = rotateQuaternion(satellites[selectedOrbitIndex].orbitQuat, axis, -rotationSpeed);
  }
  if (keyIsDown(68)) { // 'D' 键
    // 绕 X 轴旋转（里-外轴翻转）
    axis = { x: 1, y: 0, z: 0 };
    satellites[selectedOrbitIndex].orbitQuat = rotateQuaternion(satellites[selectedOrbitIndex].orbitQuat, axis, rotationSpeed);
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
