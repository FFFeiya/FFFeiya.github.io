(function (global) {
  'use strict';
  const Game = global.Game || {};
  const C = Game.Constants;
  const M = Game.Math3D;

  Game.state = {
    screen: 'menu', battle: null, deploy: { index: 0, positions: [] },
    selectedShip: -1, message: '', anim: null, fx: [],
    aim: null, pendingMove: null, pendingAttack: null,
    dv: { dir: 'E', mag: 0 }
  };
  Game.tutorial = { on: false, step: 0 };
  const TUT = [
    { text: '① 点击左侧「红隼号」选中它（或按 1）' },
    { text: '② 点右侧「倾角+」→「满」→「确认机动」' },
    { text: '③ 点击绿色护盾 → 点「确认攻击」' },
    { text: '④ 点「结束回合」' },
    { text: '⑤ 护盾已破！点击绿色核心 → 点「确认攻击」' }
  ];
  Game.camera = { yaw: 0, tilt: 0.5, zoom: 1 };
  Game.prevMouse = { x: 0, y: 0 };
  Game.sound = {
    ctx: null,
    beep(f, d) { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(this.ctx.destination); g.gain.value = 0.04; o.start(); o.stop(this.ctx.currentTime + (d || 0.08)); } catch (e) {} }
  };

  const ORBIT = 1.25;

  function hitRect(mx, my, x, y, w, h) { return mx >= x && mx <= x + w && my >= y && my <= y + h; }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function wrapLon(l) { return ((l % 360) + 360) % 360; }

  const DIRS = { N: [1, 0, 0], S: [-1, 0, 0], E: [0, 1, 0], W: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1] };
  function computeDV(dv, budget) {
    const u = DIRS[dv.dir] || [1, 0];
    const unitCost = Math.abs(u[0]) / C.DEG_PER_BAND * C.COST_PER_BAND + Math.abs(u[1]) / C.DEG_PER_COL * C.COST_PER_LON + Math.abs(u[2]) / C.DEG_PER_COL * C.COST_PER_LON;
    const k = unitCost > 0 ? (dv.mag || 0) / unitCost : 0;
    return { di: u[0] * k, dOmega: u[1] * k, dTheta: u[2] * k, cost: dv.mag || 0 };
  }

  function drawButton(label, x, y, w, h, enabled, col) {
    fill(enabled === false ? 60 : col || 70); stroke(255, 255, 255, enabled === false ? 40 : 120); strokeWeight(1); rect(x, y, w, h, 6);
    noStroke(); fill(enabled === false ? 120 : 255); textSize(13); textAlign(CENTER, CENTER); text(label, x + w / 2, y + h / 2);
  }

  function fleetSlots() {
    const D = Game.Data;
    if (!D.playerData) return [];
    return D.playerData.fleet.map((slot) => ({ ship: D.ships.find((s) => s.id === slot.shipId), equipIds: slot.equipIds || [] }));
  }

  function save() { if (Game.Data.playerData) localStorage.setItem('playerData', JSON.stringify(Game.Data.normalizePlayerData(Game.Data.playerData))); }
  function pushFx(x, y, text) { Game.state.fx.push({ x, y, text, until: millis() + 900 }); }

  function drawArc(latA, lonA, radA, latB, lonB, radB, cx, cy, R, r, g, b, a, w) {
    let dLon = lonB - lonA; while (dLon > 180) dLon -= 360; while (dLon < -180) dLon += 360;
    noFill(); stroke(r, g, b, a); strokeWeight(w || 2); beginShape();
    for (let i = 0; i <= 24; i++) { const t = i / 24; const p = M.projectView(latA + (latB - latA) * t, lonA + dLon * t, radA + (radB - radA) * t, Game.camera.yaw, Game.camera.tilt, cx, cy, Game.camera.zoom); vertex(p.x, p.y); }
    endShape();
  }

  function drawOrbit(i, node, orbitR, cx, cy, col, alpha, dashed) {
    stroke(col[0], col[1], col[2], alpha);
    strokeWeight(1);
    if (dashed) drawingContext.setLineDash([4, 6]);
    let prev = null;
    for (let t = 0; t <= 360; t += 6) {
      const p = M.orbitPos(i, node, t, 1);
      const proj = M.projectView(p.lat, p.lon, orbitR, Game.camera.yaw, Game.camera.tilt, cx, cy, Game.camera.zoom);
      if (prev) line(prev.x, prev.y, proj.x, proj.y);
      prev = proj;
    }
    if (dashed) drawingContext.setLineDash([]);
  }

  function shipScreen(s) { const p = Game.Battle.shipLatLon(s); return M.projectView(p.lat, p.lon, ORBIT * boardR(), Game.camera.yaw, Game.camera.tilt, boardCx(), boardCy(), Game.camera.zoom); }
  function nodeScreen(n) { return Game.Board.project(n.lat, n.lon, boardR(), Game.camera, boardCx(), boardCy()); }
  function boardCx() { return width * 0.46; }
  function boardCy() { return height * 0.52; }
  function boardR() { return Math.min(width, height) * 0.32; }

  Game.init = function () { if (typeof window !== 'undefined') window.addEventListener('beforeunload', save); };
  Game.preload = function () { Game.Data.loadShipData(); Game.Data.loadEquipmentData(); Game.Data.loadGachaData(); Game.Data.loadMission(); loadJSON('tutorial.dat', (d) => { Game.Data.tutorial = d; }); Game.Data.loadInit(); };
  Game.setup = function () { createCanvas(1200, 800); try { textFont('Microsoft YaHei'); } catch (e) {} Game.init(); };

  Game.draw = function () {
    background(16, 18, 26);
    const D = Game.Data;
    if (!D.mission || !D.ships || D.ships.length === 0) { fill(255); textSize(18); textAlign(CENTER, CENTER); const f = typeof location !== 'undefined' && location.protocol === 'file:'; text(f ? '请通过 http://localhost:4000/p5game/ 访问' : '加载中…', width / 2, height / 2); return; }
    const s = Game.state;
    if (s.screen === 'menu') drawMenu();
    else if (s.screen === 'deploy') drawDeploy();
    else if (s.screen === 'battle') drawBattle();
    else if (s.screen === 'formation') drawFormation();
    else if (s.screen === 'victory') drawResult(true);
    else if (s.screen === 'defeat') drawResult(false);
    else if (s.screen === 'research') drawResearch();
  };

  function drawMenu() {
    fill(255); textSize(28); textAlign(CENTER, CENTER); text('歼星者 · 反塔防轨道棋', width / 2, 180);
    textSize(14); fill(200); text('连续 Δv 轨道棋：拖拽给速度向量，进入射程后选择目标', width / 2, 230);
    Game.state.buttons = [
      { id: 'start', x: width / 2 - 110, y: 300, w: 220, h: 50, label: '开始战斗' },
      { id: 'formation', x: width / 2 - 110, y: 370, w: 220, h: 50, label: '舰队编成' },
      { id: 'research', x: width / 2 - 110, y: 440, w: 220, h: 50, label: '研发（抽卡）' },
      { id: 'tutorial', x: width / 2 - 110, y: 510, w: 220, h: 50, label: '教程关' },
      { id: 'reset', x: width / 2 - 110, y: 580, w: 220, h: 50, label: '重置存档' }
    ];
    for (const b of Game.state.buttons) drawButton(b.label, b.x, b.y, b.w, b.h, true);
  }

  function drawDeploy() {
    const cx = boardCx(), cy = boardCy(), R = boardR();
    Game.Board.render3D(0, Game.Data.mission, Game.camera, cx, cy, R);
    fill(255); textSize(17); textAlign(CENTER, TOP); text('战前布阵：点击赤道放置第 ' + (Game.state.deploy.positions.length + 1) + ' 艘船', cx, 24);
    for (let i = 0; i < Game.state.deploy.positions.length; i++) {
      const p = Game.state.deploy.positions[i];
      const pos = M.projectView(0, p.lon, ORBIT * R, Game.camera.yaw, Game.camera.tilt, cx, cy, Game.camera.zoom);
      noStroke(); fill(255); triangle(pos.x, pos.y - 9, pos.x - 7, pos.y + 7, pos.x + 7, pos.y + 7);
    }
    Game.state.buttons = [];
    if (Game.state.deploy.positions.length === 3) Game.state.buttons.push({ id: 'begin', x: width - 170, y: height - 70, w: 140, h: 44, label: '开始战斗' });
    for (const b of Game.state.buttons) drawButton(b.label, b.x, b.y, b.w, b.h, true);
  }

  function drawBattle() {
    const B = Game.state.battle; if (!B) return;
    const cx = boardCx(), cy = boardCy(), R = boardR();
    const viewMission = { ...Game.Data.mission, nodes: B.nodes.filter((n) => n.alive) };
    const anim = Game.state.anim;
    let rotation = B.turn - 1;
    if (anim) { const p = Math.min(1, (millis() - anim.start) / anim.dur); rotation = anim.from + (anim.to - anim.from) * ease(p); }
    Game.Board.render3D(rotation, viewMission, Game.camera, cx, cy, R);

    // 舰船
    for (let i = 0; i < B.ships.length; i++) {
      const s = B.ships[i]; if (s.offboard || s.sunk) continue;
      const p = shipScreen(s);
      noStroke();
      if (i === Game.state.selectedShip) { fill(255, 220, 60); ellipse(p.x, p.y, 22, 22); }
      fill(s.acted ? 120 : 255); triangle(p.x, p.y - 9, p.x - 7, p.y + 7, p.x + 7, p.y + 7);
      fill(255); textSize(10); textAlign(CENTER, CENTER); text(s.name, p.x, p.y - 16);
    }

    // 炮台威胁 + 主炮危险圈
    if (!anim) {
      for (const n of B.nodes) {
        if (!n.alive || n.type !== 'turret' || n.disabled > 0) continue;
        const ti = Game.Battle.turretTargetShipIndex(n, B);
        if (ti === null) continue;
        const tp = shipScreen(B.ships[ti]);
        noFill(); stroke(255, 80, 80); strokeWeight(2); ellipse(tp.x, tp.y, 20, 20);
        noStroke(); fill(255, 120, 120); textSize(11); textAlign(CENTER, CENTER); text('锁定', tp.x, tp.y - 18);
      }
      const core = B.nodes.find((n) => n.type === 'core' && n.alive);
      if (core) {
        const p = nodeScreen(core); const prog = 1 - B.mainCannonLeft / Game.Data.mission.countdownTurns;
        noFill(); stroke(255, 120, 60, 120 + 120 * prog); strokeWeight(2); ellipse(p.x, p.y, 30 + 70 * prog, 30 + 70 * prog);
        noStroke(); fill(255, 140, 80); textSize(11); textAlign(CENTER, CENTER); text('主炮 ' + B.mainCannonLeft, p.x, p.y - 28);
      }
    }

    // Δv 面板 + 预测落点 / 可攻击目标
    const sel = B.ships[Game.state.selectedShip];
    if (sel && !sel.sunk && !sel.offboard && !anim) {
      const budget = Game.Data.deltaVPerTurn(sel, sel.equipments);
      if (!sel.moved) {
        const v = computeDV(Game.state.dv, budget);
        const pred = { i: clamp(sel.i + v.di, 0, 90), node: wrapLon(sel.node + v.dOmega), theta: wrapLon(sel.theta + v.dTheta) };
        drawOrbit(sel.i, sel.node, ORBIT * R, cx, cy, [130, 175, 255], 60, false);
        drawOrbit(pred.i, pred.node, ORBIT * R, cx, cy, [130, 175, 255], 95, true);
        const p0 = Game.Battle.shipLatLon(sel);
        const p1 = Game.Battle.shipLatLon(pred);
        const tp = M.projectView(p1.lat, p1.lon, ORBIT * R, Game.camera.yaw, Game.camera.tilt, cx, cy, Game.camera.zoom);
        const cp0 = M.projectView(p0.lat, p0.lon, ORBIT * R, Game.camera.yaw, Game.camera.tilt, cx, cy, Game.camera.zoom);
        noStroke(); fill(255, 255, 255, 180); ellipse(cp0.x, cp0.y, 8, 8);
        noStroke(); fill(90, 160, 255, 60); ellipse(tp.x, tp.y, 16, 16);
        const threats = Game.Battle.threatsAt(p1.lat, p1.lon, B);
        for (const t of threats) { const tn = nodeScreen(t); stroke(255, 80, 80, 150); strokeWeight(1.5); line(tn.x, tn.y, tp.x, tp.y); }
        if (threats.length) { fill(255, 120, 120); textSize(12); textAlign(LEFT, TOP); text('该点会被 ' + threats.length + ' 门炮台攻击（-2）', cx + R * 1.35, cy - 20); }
        for (const n of B.nodes) { if (!n.alive) continue; if (Game.Battle.canAttack({ ...sel, i: pred.i, node: pred.node, theta: pred.theta }, n, B)) { const np = nodeScreen(n); noFill(); stroke(120, 255, 160); strokeWeight(2); ellipse(np.x, np.y, 20, 20); } }
        drawDVPanel(B, budget);
      } else if (!sel.acted) {
        for (const n of B.nodes) { if (!n.alive) continue; if (Game.Battle.canAttack(sel, n, B)) { const np = nodeScreen(n); noFill(); stroke(120, 255, 160); strokeWeight(2); ellipse(np.x, np.y, 20, 20); } }
      }
    }

    if (Game.state.pendingAttack) {
      const pa = Game.state.pendingAttack; const sh = B.ships[pa.shipIndex]; const node = B.nodes[pa.nodeIndex];
      if (sh && node) { const np = nodeScreen(node); const sp = Game.Battle.shipLatLon(sh); drawArc(sp.lat, sp.lon, ORBIT * R, node.lat, node.lon, R, cx, cy, R, 255, 90, 90, 220, 2); noStroke(); fill(255, 120, 120); textSize(13); textAlign(CENTER, CENTER); text('-' + pa.dmg, np.x, np.y - 18); }
    }

    drawShipList(B);
    drawBattleHUD(B);
    drawFx();
    drawTutorial();

    if (anim) {
      const p = Math.min(1, (millis() - anim.start) / anim.dur);
      if (!anim.resolved && p >= 0.5) { anim.resolved = true; anim.finalStatus = Game.Battle.resolve(B); anim.resultLog = B.log.slice(anim.logStart); }
      if (anim.resolved) { fill(255, 240, 200); textSize(13); textAlign(LEFT, TOP); let ly = height - 150; for (const l of anim.resultLog.slice(-5)) { text(l, 24, ly); ly += 18; } }
      if (p >= 1) finalize(anim.finalStatus);
    }
  }

  function drawTutorial() {
    const x = width * 0.28, y = 10, w = width * 0.44, h = 46;
    fill(18, 22, 34, 215); noStroke(); rect(x, y, w, h, 8);
    fill(255); textSize(12); textAlign(LEFT, TOP);
    const txt = Game.tutorial.on ? TUT[Game.tutorial.step].text : '教程：1) 左侧点船/按1-2-3  2) 右侧调轨道(倾角/节点/相位)  3) 确认机动  4) 点绿色目标→确认攻击  5) 结束回合';
    text(txt, x + 12, y + 8);
  }

  function drawShipList(B) {
    let y = 24; fill(255); textSize(14); textAlign(LEFT, TOP); text('舰队（点击/1-2-3 选船）', 24, y); y += 24;
    for (let i = 0; i < B.ships.length; i++) {
      const s = B.ships[i];
      fill(i === Game.state.selectedShip ? 90 : 40); stroke(255, 255, 255, 120); rect(24, y, 180, 30, 6);
      noStroke(); fill(255); textSize(12); textAlign(LEFT, CENTER);
      text(s.sunk ? s.name + ' 沉没' : s.name + ' HP' + s.hp + '/' + s.maxHp + (s.offboard ? ' 冷却' + s.cooldown : ''), 32, y + 15);
      Game.state.shipRows = Game.state.shipRows || []; Game.state.shipRows[i] = { x: 24, y, w: 180, h: 30 };
      y += 34;
    }
  }

  function drawDVPanel(B, budget) {
    const x = width - 250, y = 100, w = 230, h = 220;
    fill(20, 24, 36, 235); noStroke(); rect(x, y, w, h, 8);
    fill(255); textSize(14); textAlign(LEFT, TOP); text('Δv 机动（预算 ' + budget.toFixed(0) + '）', x + 12, y + 10);
    fill(170); textSize(11); text('倾角=轨道面倾斜 · 节点=升交点经度 · 相位=沿轨道位置', x + 12, y + 28);
    Game.state.dvButtons = [];
    const dirs = ['N', 'S', 'E', 'W', 'F', 'B'];
    const tips = { N: '倾角+：轨道面更偏极地，覆盖更高纬度', S: '倾角-：轨道面更贴赤道', E: '节点+：升交点东移，整条轨道绕极轴旋转', W: '节点-：升交点西移', F: '相位+：沿当前大圆前进', B: '相位-：沿当前大圆后退' };
    for (let i = 0; i < dirs.length; i++) {
      const bx = x + 12 + (i % 3) * 72, by = y + 34 + Math.floor(i / 3) * 34;
      const label = dirs[i] === 'N' ? '倾角+' : dirs[i] === 'S' ? '倾角-' : dirs[i] === 'E' ? '节点+' : dirs[i] === 'W' ? '节点-' : dirs[i] === 'F' ? '相位+' : '相位-';
      drawButton(label, bx, by, 66, 28, true, Game.state.dv.dir === dirs[i] ? 90 : 55);
      Game.state.dvButtons.push({ id: 'dir:' + dirs[i], x: bx, y: by, w: 66, h: 28, tip: tips[dirs[i]] });
    }
    const mags = [[budget / 3, '1/3'], [budget * 2 / 3, '2/3'], [budget, '满']];
    for (let i = 0; i < 3; i++) {
      const mx = x + 12 + i * 76, my = y + 106;
      drawButton(mags[i][1], mx, my, 70, 30, true, Math.abs(Game.state.dv.mag - mags[i][0]) < 0.5 ? 90 : 55);
      Game.state.dvButtons.push({ id: 'mag:' + mags[i][0], x: mx, y: my, w: 70, h: 30 });
    }
    const v = computeDV(Game.state.dv, budget);
    fill(200); textSize(12); textAlign(LEFT, TOP); text('倾角 ' + v.di.toFixed(0) + '°  转轨 ' + v.dOmega.toFixed(0) + '°  前进 ' + v.dTheta.toFixed(0) + '°  Δv ' + v.cost.toFixed(0), x + 12, y + 146);
    drawButton('确认机动', x + 12, y + 180, 100, 32, true, 80); Game.state.dvButtons.push({ id: 'confirmDV', x: x + 12, y: y + 180, w: 100, h: 32 });
    drawButton('取消', x + 120, y + 180, 98, 32, true, 60); Game.state.dvButtons.push({ id: 'cancelDV', x: x + 120, y: y + 180, w: 98, h: 32 });

    for (const b of Game.state.dvButtons) {
      if (b.tip && hitRect(mouseX, mouseY, b.x, b.y, b.w, b.h)) {
        fill(30, 34, 46, 235); noStroke(); rect(b.x, b.y - 26, 220, 24, 6);
        fill(255); textSize(11); textAlign(LEFT, CENTER); text(b.tip, b.x + 8, b.y - 14);
      }
    }
  }

  function drawBattleHUD(B) {
    textAlign(LEFT, TOP); fill(255); textSize(15);
    text('回合 ' + B.turn + '  主炮 ' + B.mainCannonLeft + '  能量 ' + B.energy, 24, height - 100);
    textSize(11); fill(170); text('1/2/3 或左侧列表选船 → 右侧方向+大小给 Δv → 确认机动 → 点绿色圈目标 → 确认攻击', 24, height - 80);

    const selected = B.ships[Game.state.selectedShip];
    let btns;
    if (Game.state.anim) btns = [{ id: 'skip', x: 24, y: height - 62, w: 110, h: 40, label: '跳过动画' }];
    else if (Game.state.pendingMove) btns = [{ id: 'confirmMove', x: 24, y: height - 62, w: 110, h: 40, label: '确认移动' }, { id: 'cancelMove', x: 150, y: height - 62, w: 80, h: 40, label: '取消' }];
    else if (Game.state.pendingAttack) btns = [{ id: 'confirmAttack', x: 24, y: height - 62, w: 110, h: 40, label: '确认攻击' }, { id: 'cancelAttack', x: 150, y: height - 62, w: 80, h: 40, label: '取消' }];
    else btns = [
      { id: 'end', x: 24, y: height - 62, w: 110, h: 40, label: '结束回合' },
      { id: 'emp', x: 150, y: height - 62, w: 80, h: 40, label: 'EMP(' + C.SKILL_COST_EMP + ')', enabled: B.energy >= C.SKILL_COST_EMP },
      { id: 'overload', x: 240, y: height - 62, w: 90, h: 40, label: '过载(' + C.SKILL_COST_OVERLOAD + ')', enabled: B.energy >= C.SKILL_COST_OVERLOAD && !!selected },
      { id: 'decoy', x: 340, y: height - 62, w: 90, h: 40, label: '诱饵(' + C.SKILL_COST_DECOY + ')', enabled: B.energy >= C.SKILL_COST_DECOY && !!selected },
      { id: 'retreat', x: 440, y: height - 62, w: 80, h: 40, label: '撤退', enabled: !!selected && !selected.offboard },
      { id: 'heal', x: 530, y: height - 62, w: 80, h: 40, label: '维修', enabled: !!selected && selected.role === 'support' && !selected.acted }
    ];
    Game.state.buttons = btns;
    for (const b of btns) drawButton(b.label, b.x, b.y, b.w, b.h, b.enabled);
    if (Game.state.message) { fill(255, 220, 120); textSize(12); text(Game.state.message, 24, height - 130); }
  }

  function drawFx() {
    for (let i = Game.state.fx.length - 1; i >= 0; i--) { const f = Game.state.fx[i]; if (millis() > f.until) { Game.state.fx.splice(i, 1); continue; } fill(255, 90, 90); textSize(15); textAlign(CENTER, CENTER); text(f.text, f.x, f.y); }
  }

  function drawFormation() {
    const D = Game.Data; const ownedShips = D.ships.filter((s) => D.playerData.ownedShips.includes(s.id)); const ownedEquips = D.equipments.filter((e) => D.playerData.ownedEquipments.includes(e.id));
    fill(255); textSize(22); textAlign(CENTER, TOP); text('舰队编成（点击船位/装备位循环选择）', width / 2, 40);
    Game.state.clickables = [];
    for (let i = 0; i < 3; i++) {
      const slot = D.playerData.fleet[i] || { shipId: null, equipIds: [] }; const y = 120 + i * 120; const ship = D.ships.find((s) => s.id === slot.shipId);
      drawButton(ship ? ship.name : '选择舰船', 260, y, 240, 44, true, 60); Game.state.clickables.push({ x: 260, y, w: 240, h: 44, action: 'ship', slot: i });
      const e0 = D.equipments.find((e) => e.id === slot.equipIds[0]); const e1 = D.equipments.find((e) => e.id === slot.equipIds[1]);
      drawButton(e0 ? e0.name : '装备1', 520, y, 220, 44, true, 45); drawButton(e1 ? e1.name : '装备2', 760, y, 220, 44, true, 45);
      Game.state.clickables.push({ x: 520, y, w: 220, h: 44, action: 'equip', slot: i, idx: 0 }); Game.state.clickables.push({ x: 760, y, w: 220, h: 44, action: 'equip', slot: i, idx: 1 });
      if (ship) { const eqs = [e0, e1].filter(Boolean); fill(200); textSize(13); textAlign(LEFT, CENTER); text('HP' + Game.Data.shipHP(ship) + ' 射程' + Game.Data.reach(ship) + ' Δv' + Game.Data.deltaVPerTurn(ship, eqs).toFixed(0) + ' [' + ship.role + ']', 260, y + 64); }
    }
    Game.state.buttons = [{ id: 'back', x: width / 2 - 110, y: height - 80, w: 220, h: 50, label: '返回菜单' }];
    for (const b of Game.state.buttons) drawButton(b.label, b.x, b.y, b.w, b.h, true);
  }

  function drawResult(victory) {
    fill(255); textSize(28); textAlign(CENTER, CENTER); text(victory ? '胜利' : '失败', width / 2, 260);
    textSize(14); fill(200); text(victory ? '奖励金币 ' + Game.Data.mission.rewardCoins : Game.state.message || '舰队耗尽或主炮充满', width / 2, 320);
    Game.state.buttons = [{ id: 'back', x: width / 2 - 110, y: 380, w: 220, h: 50, label: '返回菜单' }];
    for (const b of Game.state.buttons) drawButton(b.label, b.x, b.y, b.w, b.h, true);
  }

  function drawResearch() {
    fill(255); textSize(22); textAlign(CENTER, TOP); text('研发 / 抽卡（金币 ' + Game.Data.playerData.coins + '）', width / 2, 80);
    Game.state.buttons = [{ id: 'gacha1', x: width / 2 - 130, y: 180, w: 120, h: 50, label: '单抽(100)' }, { id: 'gacha5', x: width / 2 + 10, y: 180, w: 120, h: 50, label: '五连(500)' }, { id: 'back', x: width / 2 - 110, y: 280, w: 220, h: 50, label: '返回菜单' }];
    for (const b of Game.state.buttons) drawButton(b.label, b.x, b.y, b.w, b.h, true);
    if (Game.state.message) { fill(255, 220, 120); textSize(14); textAlign(CENTER, TOP); text(Game.state.message, width / 2, 360); }
  }

  Game.mousePressed = function () {
    Game.prevMouse = { x: mouseX, y: mouseY };
    const s = Game.state;
    if (s.screen === 'battle' && s.dvButtons && !s.anim) {
      for (const b of s.dvButtons) if (hitRect(mouseX, mouseY, b.x, b.y, b.w, b.h)) { onDVButton(b.id); return; }
    }
    for (const b of (s.buttons || [])) if (hitRect(mouseX, mouseY, b.x, b.y, b.w, b.h) && b.enabled !== false) { onButton(b.id); return; }
    if (s.screen === 'deploy') onDeployClick();
    else if (s.screen === 'battle') { if (!s.anim) onBattleClick(); }
    else if (s.screen === 'formation') onFormationClick();
  };

  Game.mouseDragged = function () {
    const s = Game.state;
    if (s.screen === 'battle' || s.screen === 'deploy') {
      const dx = mouseX - Game.prevMouse.x; const dy = mouseY - Game.prevMouse.y;
      Game.camera.yaw += dx * 0.01; Game.camera.tilt = clamp(Game.camera.tilt + dy * 0.01, -1.4, 1.4); Game.prevMouse = { x: mouseX, y: mouseY };
    }
  };

  Game.mouseReleased = function () {
    const s = Game.state;
    if (s.screen === 'battle' && s.aim && !s.anim) {
      const sh = s.battle.ships[s.aim.shipIndex];
      const budget = Game.Data.deltaVPerTurn(sh, sh.equipments);
      s.pendingMove = { shipIndex: s.aim.shipIndex, dLon: s.aim.dLon, dLat: s.aim.dLat, cost: Game.Battle.moveCost(s.aim.dLon, s.aim.dLat), budget };
      s.aim = null;
      s.message = '落点已选，确认移动或取消';
    }
  };

  Game.mouseWheel = function (e) { Game.camera.zoom = clamp(Game.camera.zoom + e.delta * 0.001, 0.6, 1.6); return false; };

  Game.keyPressed = function () {
    const s = Game.state;
    if (s.screen === 'battle') {
      if (s.anim && key === ' ') { onButton('skip'); return; }
      if (s.pendingMove && keyCode === ESCAPE) { s.pendingMove = null; s.message = '已取消移动'; return; }
      if (s.pendingAttack && keyCode === ESCAPE) { s.pendingAttack = null; s.message = '已取消攻击'; return; }
      if (key >= '1' && key <= '3') selectShip(Number(key) - 1);
      else if (key === ' ') onButton('end');
    } else if (keyCode === ESCAPE) { if (s.screen === 'research') { s.screen = 'menu'; s.message = ''; } }
  };

  function selectShip(i) {
    if (Game.tutorial.on && Game.tutorial.step === 0 && i !== 0) { Game.state.message = '教程：请点第 1 艘船'; return; }
    const B = Game.state.battle;
    if (B.ships[i] && !B.ships[i].sunk) { Game.state.selectedShip = i; const p = Game.Battle.shipLatLon(B.ships[i]); Game.camera.yaw = -p.lon * Math.PI / 180; }
    if (Game.tutorial.on && Game.tutorial.step === 0) Game.tutorial.step = 1;
  }

  function onDVButton(id) {
    const s = Game.state;
    if (Game.tutorial.on && Game.tutorial.step !== 1) { Game.state.message = '教程：请按当前提示操作'; return; }
    if (id.startsWith('dir:')) s.dv.dir = id.slice(4);
    else if (id.startsWith('mag:')) s.dv.mag = Number(id.slice(4));
    else if (id === 'confirmDV') {
      const sh = s.battle.ships[s.selectedShip];
      if (!sh) return;
      const budget = Game.Data.deltaVPerTurn(sh, sh.equipments);
      const v = computeDV(s.dv, budget);
      if (v.cost > 0) { Game.Battle.maneuver(sh, v.di, v.dOmega, v.dTheta, budget); s.message = sh.name + ' 已机动 Δv ' + v.cost.toFixed(0); }
      s.dv.mag = 0;
      if (Game.tutorial.on) Game.tutorial.step = 2;
    } else if (id === 'cancelDV') { s.dv.mag = 0; s.dv.dir = 'E'; }
  }

  function onButton(id) {
    const s = Game.state;
    if (id === 'start') { s.screen = 'deploy'; s.deploy = { index: 0, positions: [] }; }
    else if (id === 'tutorial') startTutorial();
    else if (id === 'formation') { s.screen = 'formation'; s.message = ''; }
    else if (id === 'research') { s.screen = 'research'; s.message = ''; }
    else if (id === 'reset') { Game.Data.playerData = Game.Data.normalizePlayerData({ version: 3, coins: 2000, ownedShips: ['ST-001', 'ST-002', 'ST-003'], ownedEquipments: ['equip-01', 'equip-02', 'equip-06'], clearedLevels: [], fleet: [{ shipId: 'ST-001', equipIds: ['equip-01'] }, { shipId: 'ST-002', equipIds: ['equip-02'] }, { shipId: 'ST-003', equipIds: ['equip-06'] }] }); save(); }
    else if (id === 'begin') startBattle();
    else if (id === 'back') { s.screen = 'menu'; s.message = ''; s.battle = null; }
    else if (id === 'gacha1' || id === 'gacha5') doGacha(id === 'gacha1' ? 1 : 5);
    else if (id === 'end') { if (Game.tutorial.on && Game.tutorial.step !== 3) { Game.state.message = '教程：请先完成当前步骤'; return; } endTurn(); if (Game.tutorial.on) Game.tutorial.step = 4; }
    else if (id === 'skip') { const a = s.anim; if (a) { if (!a.resolved) { a.resolved = true; a.finalStatus = Game.Battle.resolve(s.battle); a.resultLog = s.battle.log.slice(a.logStart); } finalize(a.finalStatus); } }
    else if (id === 'confirmMove') { const pm = s.pendingMove; if (pm) { const sh = s.battle.ships[pm.shipIndex]; Game.Battle.moveByDelta(sh, pm.dLon, pm.dLat, pm.budget); s.pendingMove = null; } }
    else if (id === 'cancelMove') { s.pendingMove = null; s.message = '已取消移动'; }
    else if (id === 'confirmAttack') { const pa = s.pendingAttack; if (pa) { doAttack(pa.shipIndex, s.battle.nodes[pa.nodeIndex]); s.pendingAttack = null; if (Game.tutorial.on && Game.tutorial.step === 2) Game.tutorial.step = 3; } }
    else if (id === 'cancelAttack') { s.pendingAttack = null; s.message = '已取消攻击'; }
    else if (id === 'emp' || id === 'overload' || id === 'decoy' || id === 'retreat' || id === 'heal') doSkill(id);
  }

  function startBattle() {
    const slots = fleetSlots(); const B = Game.Battle.createBattle(Game.Data.mission, slots);
    for (let i = 0; i < 3; i++) { const p = Game.state.deploy.positions[i] || { lon: [0, 3, 5][i] * C.DEG_PER_COL }; B.ships[i].i = 0; B.ships[i].node = 0; B.ships[i].theta = p.lon; B.ships[i].spawnI = 0; B.ships[i].spawnNode = 0; B.ships[i].spawnTheta = p.lon; }
    Game.state.battle = B; Game.state.selectedShip = -1; Game.state.pendingMove = null; Game.state.pendingAttack = null; Game.state.message = ''; Game.state.screen = 'battle';
  }

  function startTutorial() {
    const mission = Game.Data.parseMission(Game.Data.tutorial);
    const slots = fleetSlots();
    const B = Game.Battle.createBattle(mission, slots);
    for (let i = 0; i < 3; i++) { const p = { lon: [0, 3, 5][i] * C.DEG_PER_COL }; B.ships[i].i = 0; B.ships[i].node = 0; B.ships[i].theta = p.lon; B.ships[i].spawnI = 0; B.ships[i].spawnNode = 0; B.ships[i].spawnTheta = p.lon; }
    Game.state.battle = B; Game.state.selectedShip = -1; Game.state.pendingMove = null; Game.state.pendingAttack = null; Game.state.message = ''; Game.state.screen = 'battle';
    Game.tutorial = { on: true, step: 0 };
  }

  function onDeployClick() {
    const cx = boardCx(), cy = boardCy(), R = boardR();
    const p = M.unproject(mouseX, mouseY, cx, cy, R, Game.camera.yaw, Game.camera.tilt, Game.camera.zoom);
    if (p && Math.abs(p.latDeg) < 20 && Game.state.deploy.positions.length < 3) Game.state.deploy.positions.push({ lon: wrapLon(p.lonDeg) });
  }

  function onBattleClick() {
    const B = Game.state.battle;
    // 舰船列表
    for (let i = 0; i < 3; i++) { const r = Game.state.shipRows && Game.state.shipRows[i]; if (r && hitRect(mouseX, mouseY, r.x, r.y, r.w, r.h)) { selectShip(i); return; } }
    if (Game.state.pendingAttack) return;
    // 攻击目标选择（当前船位置）
    if (Game.state.selectedShip >= 0) {
      const sh = B.ships[Game.state.selectedShip];
      if (sh && !sh.acted && !sh.sunk && !sh.offboard) {
        for (const n of B.nodes) { if (!n.alive) continue; const p = nodeScreen(n); if (p.depth >= 0 && dist(mouseX, mouseY, p.x, p.y) < 14) { if (Game.Battle.canAttack(sh, n, B)) setPendingAttack(Game.state.selectedShip, n); return; } }
      }
    }
    // 点船也可选中
    for (let i = 0; i < B.ships.length; i++) { const s = B.ships[i]; if (s.sunk || s.offboard) continue; const p = shipScreen(s); if (dist(mouseX, mouseY, p.x, p.y) < 14) { selectShip(i); return; } }
  }

  function setPendingAttack(shipIndex, node) {
    if (Game.tutorial.on) {
      const ok = (Game.tutorial.step === 2 && node.type === 'shield') || (Game.tutorial.step === 4 && node.type === 'core');
      if (!ok) { Game.state.message = '教程：请按当前提示操作'; return; }
    }
    const sh = Game.state.battle.ships[shipIndex]; const dmg = Game.Battle.shipDamage(sh, sh.overloaded); Game.state.pendingAttack = { shipIndex, nodeIndex: Game.state.battle.nodes.indexOf(node), dmg }; Game.state.message = '预计伤害 -' + dmg + '，确认攻击或取消';
  }

  function doAttack(shipIndex, node) {
    const B = Game.state.battle; const ship = B.ships[shipIndex]; if (!ship || ship.acted) return;
    const dmg = Game.Battle.shipDamage(ship, ship.overloaded);
    const st = Game.Battle.attack(B, shipIndex, B.nodes.indexOf(node), ship.overloaded);
    Game.sound.beep(node && node.hp <= 0 ? 180 : 320, 0.06); pushFx(nodeScreen(node).x, nodeScreen(node).y, '-' + dmg);
    if (st === 'victory') finish(true);
  }

  function doSkill(id) {
    const B = Game.state.battle; const ship = B.ships[Game.state.selectedShip];
    if (id === 'emp') { if (B.energy < C.SKILL_COST_EMP) { Game.state.message = '能量不足'; return; } B.energy -= C.SKILL_COST_EMP; B.emp = true; Game.state.message = 'EMP：本回合炮台停火'; }
    else if (id === 'overload' || id === 'decoy') { if (!ship) { Game.state.message = '请先选中一艘船'; return; } if (B.energy < (id === 'overload' ? C.SKILL_COST_OVERLOAD : C.SKILL_COST_DECOY)) { Game.state.message = '能量不足'; return; } B.energy -= (id === 'overload' ? C.SKILL_COST_OVERLOAD : C.SKILL_COST_DECOY); if (id === 'overload') { ship.overloaded = true; Game.state.message = ship.name + ' 过载'; } else { ship.decoy = true; Game.state.message = ship.name + ' 诱饵'; } }
    else if (id === 'retreat' && ship) { if (ship.offboard) return; ship.offboard = true; ship.cooldown = C.RETREAT_COOLDOWN; ship.acted = true; Game.state.message = ship.name + ' 撤退'; }
    else if (id === 'heal' && ship && ship.role === 'support') { Game.Battle.supportHeal(B, Game.state.selectedShip); Game.state.message = B.log[B.log.length - 1] || ''; }
    else if (id === 'retreat' || id === 'heal') { if (!ship) Game.state.message = '请先选中一艘船'; }
  }

  function endTurn() { const B = Game.state.battle; if (!B || Game.state.anim) return; Game.state.anim = { start: millis(), dur: 1600, from: B.turn - 1, to: B.turn, resolved: false, logStart: B.log.length, resultLog: [], finalStatus: null }; }

  function finalize(status) { const B = Game.state.battle; Game.state.message = B.log.slice(-1)[0] || ''; Game.state.anim = null; if (status === 'victory') finish(true); else if (status === 'defeat') finish(false); else Game.state.selectedShip = -1; }

  function finish(victory) {
    const D = Game.Data;
    if (victory) { Game.sound.beep(600, 0.15); const id = D.mission.id; if (!D.playerData.clearedLevels.includes(id)) { D.playerData.coins += (D.mission.rewardCoins || 0); D.playerData.clearedLevels.push(id); } else D.playerData.coins += 50; }
    else { Game.sound.beep(150, 0.2); const B = Game.state.battle; const shields = B ? B.nodes.filter((n) => n.type === 'shield' && n.alive).length : 0; const sunk = B ? B.ships.filter((s) => s.sunk).length : 0; Game.state.message = '失败复盘：剩余护盾 ' + shields + '，沉船 ' + sunk + '，主炮剩余 ' + (B ? B.mainCannonLeft : 0); }
    save(); Game.state.screen = victory ? 'victory' : 'defeat';
  }

  function doGacha(times) { const D = Game.Data; const res = Game.Data.tryGacha(times, D.gachaPool, D.playerData, new Set(D.ships.map((s) => s.id)), new Set(D.equipments.map((e) => e.id))); if (res.reason === 'notEnoughCoins') Game.state.message = '金币不足'; else if (res.reason === 'emptyPool') Game.state.message = '抽卡池为空'; else { const names = res.results.map((id) => { const s = D.ships.find((x) => x.id === id); return s ? s.name : (D.equipments.find((x) => x.id === id) || {}).name || id; }); Game.state.message = '获得：' + names.join('、') + (res.refund > 0 ? '，返还 ' + res.refund : ''); Game.sound.beep(500, 0.08); save(); } }

  function onFormationClick() {
    const D = Game.Data; const ownedShips = D.ships.filter((s) => D.playerData.ownedShips.includes(s.id)); const ownedEquips = D.equipments.filter((e) => D.playerData.ownedEquipments.includes(e.id));
    for (const c of (Game.state.clickables || [])) { if (!hitRect(mouseX, mouseY, c.x, c.y, c.w, c.h)) continue; const slot = D.playerData.fleet[c.slot] || { shipId: null, equipIds: [] }; while (slot.equipIds.length < 2) slot.equipIds.push(null); if (c.action === 'ship') { if (!ownedShips.length) return; const cur = ownedShips.findIndex((s) => s.id === slot.shipId); slot.shipId = ownedShips[(cur + 1) % ownedShips.length].id; } else { if (!ownedEquips.length) return; const cur = ownedEquips.findIndex((e) => e.id === slot.equipIds[c.idx]); slot.equipIds[c.idx] = ownedEquips[(cur + 1) % ownedEquips.length].id; } D.playerData.fleet[c.slot] = slot; save(); return; }
  }

  global.Game = Game;
  if (typeof module !== 'undefined' && module.exports) { module.exports = Game; }
})(typeof window !== 'undefined' ? window : globalThis);
