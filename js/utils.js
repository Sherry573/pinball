/* =============================================================================
 * utils.js — 通用工具函数
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;
  var U = {};

  U.TAU = Math.PI * 2;

  U.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.easeOut = function (t) { return 1 - (1 - t) * (1 - t); };

  /** 限制弹珠速度上限 */
  U.limitSpeed = function (b, max) {
    var s2 = b.vx * b.vx + b.vy * b.vy;
    if (s2 > max * max) {
      var s = Math.sqrt(s2);
      b.vx = (b.vx / s) * max;
      b.vy = (b.vy / s) * max;
    }
  };

  /** #rrggbb → rgba(r,g,b,a)，用于把主题色做出各种透明度 */
  U.rgba = function (hex, a) {
    if (!hex || hex.charAt(0) !== '#') return hex;
    var h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  /** #rrggbb → 更暗的 #rrggbb（k = 0~1，0 表示全黑） */
  U.darken = function (hex, k) {
    var h = hex.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    var r = Math.round(((n >> 16) & 255) * k);
    var g = Math.round(((n >> 8) & 255) * k);
    var b = Math.round((n & 255) * k);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  };

  /**
   * 构造一条"半平面"墙壁线段，并自动计算指向台内的单位法线。
   * 参考点取台面中心，保证法线一定朝场内。
   * 注意：半平面意味着球永远无法跑到这条线的背面 —— 只适合外壳墙。
   */
  U.makeWall = function (ax, ay, bx, by, refX, refY) {
    var dx = bx - ax;
    var dy = by - ay;
    var len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len;
    var ny = dx / len;
    var rx = refX - (ax + bx) / 2;
    var ry = refY - (ay + by) / 2;
    if (nx * rx + ny * ry < 0) { nx = -nx; ny = -ny; }
    return {
      a: { x: ax, y: ay },
      b: { x: bx, y: by },
      n: { x: nx, y: ny },
      len2: len * len
    };
  };

  /**
   * 构造一条"实心胶囊"挡条（两面都实心）。
   * 台面内部的导流墙必须用它：球可以从下方绕过去，不会被"吸"到正面。
   */
  U.makeBar = function (ax, ay, bx, by, half) {
    return {
      a: { x: ax, y: ay },
      b: { x: bx, y: by },
      half: half || 5
    };
  };

  /** 圆角矩形路径（不自动 fill / stroke） */
  U.roundRect = function (ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arc(x + w - rr, y + rr, rr, -Math.PI / 2, 0);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arc(x + w - rr, y + h - rr, rr, 0, Math.PI / 2);
    ctx.lineTo(x + rr, y + h);
    ctx.arc(x + rr, y + h - rr, rr, Math.PI / 2, Math.PI);
    ctx.lineTo(x, y + rr);
    ctx.arc(x + rr, y + rr, rr, Math.PI, Math.PI * 1.5);
    ctx.closePath();
  };

  PB.util = U;
})();
