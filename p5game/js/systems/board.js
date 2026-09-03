(function (global) {
  'use strict';
  const Game = global.Game || {};
  const C = Game.Constants;
  const M = Game.Math3D;

  function isGapOpen(node, turn) {
    if (node.type === 'turret') return true;
    if (node.type === 'shield') {
      if (node.period > 0) {
        const t = ((turn - node.phase) % node.period + node.period) % node.period;
        return t < node.duration;
      }
      return false;
    }
    return false;
  }

  function computeTelegraph(turn, mission, lookahead) {
    const events = [];
    for (let d = 1; d <= (lookahead || 2); d++) {
      const t = turn + d;
      for (const node of mission.nodes || []) {
        if (node.type === 'shield' && isGapOpen(node, t)) {
          events.push({ turn: t, node });
        }
      }
    }
    return events;
  }

  function nodeLatLon(node) {
    return { lat: node.lat, lon: node.lon };
  }

  const NODE_COLOR = { shield: [74, 168, 255], turret: [255, 90, 90], core: [255, 157, 60] };
  const BAND_COLOR = { E: [90, 180, 120], N: [120, 160, 255], S: [190, 140, 255] };

  function project(lat, lon, R, cam, cx, cy) {
    return M.projectView(lat, lon, R, cam.yaw, cam.tilt, cx, cy, cam.zoom);
  }

  function drawLatitude(lat, R, cam, cx, cy, color) {
    stroke(color[0], color[1], color[2], 90);
    strokeWeight(1);
    noFill();
    beginShape();
    for (let a = 0; a <= 360; a += 6) {
      const p = project(lat, a, R, cam, cx, cy);
      vertex(p.x, p.y);
    }
    endShape();
  }

  function drawMeridian(lon, R, cam, cx, cy) {
    stroke(120, 150, 200, 55);
    strokeWeight(1);
    noFill();
    beginShape();
    for (let lat = -80; lat <= 80; lat += 8) {
      const p = project(lat, lon, R, cam, cx, cy);
      vertex(p.x, p.y);
    }
    endShape();
  }

  function render3D(rotation, mission, cam, cx, cy, R) {
    const turn = Math.round(rotation) + 1;

    noStroke();
    fill(14, 22, 38);
    ellipse(cx, cy, R * 2 * cam.zoom, R * 2 * cam.zoom);

    for (const band of C.BANDS) {
      drawLatitude(M.bandToLat(band), R, cam, cx, cy, BAND_COLOR[band]);
    }
    for (let i = 0; i < C.LON_COUNT; i++) {
      drawMeridian(i * (360 / C.LON_COUNT), R, cam, cx, cy);
    }

    for (const ev of computeTelegraph(turn, mission, 2)) {
      const ll = nodeLatLon(ev.node);
      const p = project(ll.lat, ll.lon, R, cam, cx, cy);
      if (p.depth < 0) continue;
      noStroke();
      fill(90, 255, 160, 55);
      ellipse(p.x, p.y, 12, 12);
    }

    for (const node of mission.nodes || []) {
      const ll = nodeLatLon(node);
      const p = project(ll.lat, ll.lon, R, cam, cx, cy);
      const front = p.depth >= 0;
      const c = NODE_COLOR[node.type] || [255, 255, 255];
      const gap = node.type === 'shield' && isGapOpen(node, turn);
      if (gap && front) {
        noStroke();
        fill(90, 255, 160, 45);
        ellipse(p.x, p.y, 26, 26);
      }
      fill(c[0], c[1], c[2], front ? 255 : 60);
      stroke(0, 0, 0, front ? 140 : 40);
      ellipse(p.x, p.y, 12, 12);
      noStroke();
      fill(255, 255, 255, front ? 255 : 80);
      textSize(10);
      textAlign(CENTER, CENTER);
      const label = node.type === 'shield' ? node.band : (node.type === 'core' ? '核心' : '炮');
      text(label, p.x, p.y - 12);
    }
  }

  Game.Board = {
    isGapOpen,
    computeTelegraph,
    nodeLatLon,
    project,
    render3D
  };

  global.Game = Game;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Game;
  }
})(typeof window !== 'undefined' ? window : globalThis);
