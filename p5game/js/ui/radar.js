(function (global) {
  'use strict';
  const Game = global.Game || {};
  const C = Game.Constants;

  // 雷达是一个 N/E/S × 8 列的 2D 小地图（可点击）
  const CELL = 24;
  const ROWS = ['N', 'E', 'S'];

  function origin() {
    return { x: global.width - CELL * C.LON_COUNT - 24, y: 24 };
  }

  function cellCenter(band, lon) {
    const o = origin();
    const row = ROWS.indexOf(band);
    return {
      x: o.x + lon * CELL + CELL / 2,
      y: o.y + row * CELL + CELL / 2
    };
  }

  function hit(mouseX, mouseY) {
    const o = origin();
    const col = Math.floor((mouseX - o.x) / CELL);
    const row = Math.floor((mouseY - o.y) / CELL);
    if (col < 0 || col >= C.LON_COUNT || row < 0 || row >= ROWS.length) return null;
    return { band: ROWS[row], lon: col };
  }

  function render(turn, mission, selectedCell) {
    const o = origin();
    const w = CELL * C.LON_COUNT;
    const h = CELL * ROWS.length;
    const rotation = turn - 1;

    push();
    noStroke();
    fill(12, 14, 20, 200);
    rect(o.x, o.y, w, h, 6);

    // 网格
    stroke(255, 255, 255, 40);
    for (let i = 0; i <= C.LON_COUNT; i++) {
      line(o.x + i * CELL, o.y, o.x + i * CELL, o.y + h);
    }
    for (let j = 0; j <= ROWS.length; j++) {
      line(o.x, o.y + j * CELL, o.x + w, o.y + j * CELL);
    }

    // 行标签
    fill(255);
    noStroke();
    textSize(10);
    textAlign(LEFT, CENTER);
    for (let j = 0; j < ROWS.length; j++) {
      text(ROWS[j], o.x - 14, o.y + j * CELL + CELL / 2);
    }

    // 节点
    for (const node of mission.nodes || []) {
      const lon = ((node.lon - rotation) % C.LON_COUNT + C.LON_COUNT) % C.LON_COUNT;
      const c = cellCenter(node.band, lon);
      const gap = node.type === 'shield' && Game.Board.isGapOpen(node, turn);
      if (gap) {
        fill(90, 255, 160, 200);
        ellipse(c.x, c.y, 12, 12);
      } else {
        fill(node.type === 'core' ? '#ff9d3c' : node.type === 'turret' ? '#ff5a5a' : '#4aa8ff');
        ellipse(c.x, c.y, 8, 8);
      }
    }

    // 选中格高亮
    if (selectedCell) {
      const c = cellCenter(selectedCell.band, selectedCell.lon);
      stroke(255, 220, 60);
      strokeWeight(2);
      noFill();
      rect(o.x + selectedCell.lon * CELL, o.y + ROWS.indexOf(selectedCell.band) * CELL, CELL, CELL);
    }
    pop();
  }

  Game.Radar = {
    CELL,
    ROWS,
    origin,
    cellCenter,
    hit,
    render
  };

  global.Game = Game;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Game;
  }
})(typeof window !== 'undefined' ? window : globalThis);
