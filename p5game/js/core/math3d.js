(function (global) {
  'use strict';
  const Game = global.Game || {};

  function deg2rad(deg) { return deg * Math.PI / 180; }

  // 纬度带 → 纬度角（北纬为正，南纬为负，赤道 0）
  function bandToLat(band) {
    return { E: 0, N: 45, S: -45 }[band] || 0;
  }

  // 经度列（0-7）→ 经度角
  function lonToDeg(lon, count) {
    const n = count || 8;
    return (lon % n) * (360 / n);
  }

  // 经纬度 → 球面坐标（x 朝观众，y 上，z 右）
  function latLonToSphere(latDeg, lonDeg, radius) {
    const lat = deg2rad(latDeg);
    const lon = deg2rad(lonDeg);
    return {
      x: radius * Math.cos(lat) * Math.cos(lon),
      y: radius * Math.sin(lat),
      z: radius * Math.cos(lat) * Math.sin(lon)
    };
  }

  // 行星每回合自转 1 列：等价于目标经度减一列
  function rotatedLon(lon, steps, count) {
    const n = count || 8;
    return ((lon - steps) % n + n) % n;
  }

  // 球面坐标 → 屏幕（俯视投影）
  function sphereToScreen(x, y, z, centerX, centerY) {
    return { x: centerX + z, y: centerY - y };
  }

  // 轨道相机：先绕 Y 轴 yaw，再绕 X 轴 tilt（俯仰）
  function viewPoint(x, y, z, yaw, tilt) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y1 = y;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const y2 = y1 * ct - z1 * st;
    const z2 = y1 * st + z1 * ct;
    return { x: x1, y: y2, z: z2 };
  }

  function latLonToView(latDeg, lonDeg, radius, yaw, tilt) {
    const p = latLonToSphere(latDeg, lonDeg, radius);
    return viewPoint(p.x, p.y, p.z, yaw, tilt);
  }

  function projectView(latDeg, lonDeg, radius, yaw, tilt, cx, cy, zoom) {
    const v = latLonToView(latDeg, lonDeg, radius, yaw, tilt);
    return { x: cx + v.x * zoom, y: cy - v.y * zoom, depth: v.z };
  }

  function unproject(sx, sy, cx, cy, radius, yaw, tilt, zoom) {
    const x2 = (sx - cx) / zoom;
    const y2 = (cy - sy) / zoom;
    const r2 = x2 * x2 + y2 * y2;
    if (r2 > radius * radius) return null;
    const z2 = Math.sqrt(radius * radius - r2); // 前半球
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const y1 = y2 * ct + z2 * st;
    const z1 = -y2 * st + z2 * ct;
    const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
    const x = x2 * cosYaw - z1 * sinYaw;
    const z = x2 * sinYaw + z1 * cosYaw;
    const lat = Math.asin(Math.max(-1, Math.min(1, y1 / radius)));
    const lon = Math.atan2(z, x);
    return { latDeg: lat * 180 / Math.PI, lonDeg: (lon * 180 / Math.PI + 360) % 360 };
  }

  // 大圆周轨道：倾角 i、升交点经度 node、相位 theta（角度制），返回 xyz 与 lat/lon
  function orbitPos(iDeg, nodeDeg, thetaDeg, radius) {
    const i = deg2rad(iDeg), n = deg2rad(nodeDeg), t = deg2rad(thetaDeg);
    const x = Math.cos(t) * Math.cos(n) - Math.sin(t) * Math.cos(i) * Math.sin(n);
    const y = Math.sin(t) * Math.sin(i);
    const z = Math.cos(t) * Math.sin(n) + Math.sin(t) * Math.cos(i) * Math.cos(n);
    const r = Math.sqrt(x * x + y * y + z * z) || 1;
    const lat = Math.asin(Math.max(-1, Math.min(1, y / r))) * 180 / Math.PI;
    const lon = (Math.atan2(z, x) * 180 / Math.PI + 360) % 360;
    return { x: x * radius, y: y * radius, z: z * radius, lat, lon };
  }

  Game.Math3D = {
    bandToLat,
    lonToDeg,
    latLonToSphere,
    rotatedLon,
    sphereToScreen,
    viewPoint,
    latLonToView,
    projectView,
    unproject,
    orbitPos
  };

  global.Game = Game;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Game;
  }
})(typeof window !== 'undefined' ? window : globalThis);
