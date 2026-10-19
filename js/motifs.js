/* =============================================================================
 * motifs.js — 台面图形母题（每张台面的"骨架级"图形语言）
 *
 *   三张台面共用同一套外壳与物理骨架，但图形语法各自独立，不是换色：
 *     draft  制图台 —— 正交 + 同心：对位网格、量规刻线、表盘指针
 *     arcade 拱廊   —— 斜向 + 重复：金箔条带、柱廊拱券、齿饰檐口
 *     core   深渊核 —— 放射 + 六角：辐条、断裂同心环、晶格、裂隙
 *
 *   母题分四层落地，越靠前的层越"骨架"：
 *     1) surface()  烘焙进底板贴图 —— 网格/条带/晶格 + 台面专属装饰
 *     2) floor()    每帧少量动态线 —— 扫掠/走光/约束场
 *     3) walls()    刻在墙板上       —— 刻度尺/铆钉齿饰/装甲接缝
 *     4) 元件形状   目标灯 / 缓冲器压环 / 钉子 / 轨道标记
 *
 *   渲染层只负责"场景编排"，图形语言全部收在这里。
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;
  var U = PB.util;
  var C = PB.CONFIG;
  var W = C.width;
  var H = C.height;
  var TAU = U.TAU;

  /** 顶部弧墙的圆心与半径（所有"同心"语言都以它为原点） */
  var ARC = { x: 240, y: 220, r: 210 };

  /* ============================================================== 图形工具 */

  /** 六边形路径。rot = 0 得到平顶（螺母），rot = PI/6 得到尖顶（晶胞） */
  function hexPath(g, x, y, r, rot) {
    g.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = (rot || 0) + i * Math.PI / 3;
      var px = x + Math.cos(a) * r;
      var py = y + Math.sin(a) * r;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
  }

  /** 菱形路径（纵向略长，宝石比例） */
  function diamondPath(g, x, y, rx, ry) {
    g.beginPath();
    g.moveTo(x, y - ry);
    g.lineTo(x + rx, y);
    g.lineTo(x, y + ry);
    g.lineTo(x - rx, y);
    g.closePath();
  }

  /** 灯体通用的玻璃渐变：上亮下沉，点亮时整体提亮 */
  function glassGrad(g, x, y, r, color, lit) {
    var lg = g.createLinearGradient(x - r * 0.72, y - r * 0.86, x + r * 0.62, y + r * 0.74);
    if (lit) {
      lg.addColorStop(0, 'rgba(255,255,255,0.98)');
      lg.addColorStop(0.36, color);
      lg.addColorStop(1, U.darken(color, 0.38));
    } else {
      lg.addColorStop(0, 'rgba(214,232,250,0.62)');
      lg.addColorStop(0.34, U.rgba(color, 0.26));
      lg.addColorStop(0.82, 'rgba(16,28,44,0.96)');
      lg.addColorStop(1, 'rgba(6,11,20,0.99)');
    }
    return lg;
  }

  /** 金属压边用的对角渐变 */
  function metalGrad(g, x, y, r, color) {
    var mg = g.createLinearGradient(x - r, y - r, x + r, y + r);
    mg.addColorStop(0, 'rgba(255,255,255,0.94)');
    mg.addColorStop(0.48, U.rgba(color, 0.5));
    mg.addColorStop(1, 'rgba(255,255,255,0.42)');
    return mg;
  }

  /** 铆钉：一颗带高光的小金属半球 */
  function rivet(g, x, y, r, color) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    var rg = g.createRadialGradient(x - r * 0.36, y - r * 0.42, r * 0.1, x, y, r);
    rg.addColorStop(0, 'rgba(255,248,226,0.96)');
    rg.addColorStop(0.55, U.rgba(color, 0.86));
    rg.addColorStop(1, 'rgba(42,26,8,0.92)');
    g.fillStyle = rg;
    g.fill();
    g.strokeStyle = 'rgba(18,11,4,0.6)';
    g.lineWidth = 0.7;
    g.stroke();
  }

  /** 把一条线段按离散步长画成"锯齿裂隙" */
  function jagged(g, x, y, angle, len, step) {
    var n = Math.max(2, Math.round(len / step));
    var px = x;
    var py = y;
    var dir = angle;
    g.beginPath();
    g.moveTo(px, py);
    for (var i = 0; i < n; i++) {
      dir += (i % 2 ? 0.24 : -0.2) * (i % 3 === 0 ? 1.35 : 1);
      px += Math.cos(dir) * step;
      py += Math.sin(dir) * step;
      g.lineTo(px, py);
    }
  }

  /* ===========================================================================
   * 母题一 · draft —— 制图台
   *   语法：正交 + 同心。一切都被"对位"过：网格、刻线、准线、表盘指针。
   * ======================================================================== */
  var draft = {
    id: 'draft',
    name: '正交感 · 制图台',

    /* ---- 1. 底板：图纸 ---- */
    surface: function (g, table) {
      var th = table.theme;

      /* 正交网格：30px 细线 / 90px 主线，像一张对位纸 */
      g.save();
      g.lineWidth = 1;
      for (var x = 30; x <= 450; x += 30) {
        var mx = (x - 30) % 90 === 0;
        g.strokeStyle = mx ? U.rgba(th.wall, 0.1) : th.grid;
        g.beginPath();
        g.moveTo(x, -40);
        g.lineTo(x, H + 40);
        g.stroke();
      }
      for (var y = -30; y <= H + 30; y += 30) {
        var my = y % 90 === 0;
        g.strokeStyle = my ? U.rgba(th.wall, 0.085) : th.grid;
        g.beginPath();
        g.moveTo(-40, y);
        g.lineTo(W + 40, y);
        g.stroke();
      }
      g.restore();

      /* 同心刻线：圆心与顶部弧墙同源 —— "轨道即量规" */
      g.save();
      g.setLineDash([3, 6]);
      g.lineWidth = 1.2;
      for (var k = 0; k < 2; k++) {
        g.beginPath();
        g.arc(ARC.x, ARC.y, 118 + k * 34, 0, TAU);
        g.strokeStyle = U.rgba(th.wall, 0.15 - k * 0.05);
        g.stroke();
      }
      g.setLineDash([]);

      /* 中轴准线 + 中心十字：视觉重心的锚 */
      g.strokeStyle = U.rgba(th.wall, 0.08);
      g.beginPath();
      g.moveTo(ARC.x, 250);
      g.lineTo(ARC.x, 700);
      g.stroke();
      g.beginPath();
      g.moveTo(46, 400);
      g.lineTo(434, 400);
      g.stroke();

      g.strokeStyle = 'rgba(234,252,255,0.16)';
      g.beginPath();
      g.arc(ARC.x, 400, 15, 0, TAU);
      g.moveTo(ARC.x - 15, 400);
      g.lineTo(ARC.x + 15, 400);
      g.moveTo(ARC.x, 385);
      g.lineTo(ARC.x, 415);
      g.stroke();

      /* 四角定位角标（图纸的对位标记） */
      g.strokeStyle = U.rgba(th.wall, 0.13);
      g.lineWidth = 1.4;
      var corners = [[44, 246, 1, 1], [436, 246, -1, 1], [44, 588, 1, -1], [436, 588, -1, -1]];
      for (var c = 0; c < corners.length; c++) {
        var q = corners[c];
        g.beginPath();
        g.moveTo(q[0], q[1] + 16 * q[3]);
        g.lineTo(q[0], q[1]);
        g.lineTo(q[0] + 16 * q[2], q[1]);
        g.stroke();
      }

      /* 侧墙内侧刻度尺：短刻度 18px，长刻度 90px */
      for (var s = 0; s < 2; s++) {
        var bx = s === 0 ? 42 : 436;
        var dir = s === 0 ? 1 : -1;
        for (var ty = 244; ty <= 692; ty += 18) {
          var big = (ty - 244) % 90 === 0;
          g.strokeStyle = U.rgba(th.wall, big ? 0.22 : 0.11);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(bx, ty);
          g.lineTo(bx + dir * (big ? 13 : 7), ty);
          g.stroke();
        }
      }

      /* 对准十字：蓝色图纸上的定位标记，把"这是张图"说清楚 */
      var marks = [[95, 360], [385, 360]];
      for (var m = 0; m < marks.length; m++) {
        g.strokeStyle = U.rgba(th.wall, 0.2);
        g.lineWidth = 1;
        g.beginPath();
        g.arc(marks[m][0], marks[m][1], 8, 0, TAU);
        g.moveTo(marks[m][0] - 12, marks[m][1]);
        g.lineTo(marks[m][0] + 12, marks[m][1]);
        g.moveTo(marks[m][0], marks[m][1] - 12);
        g.lineTo(marks[m][0], marks[m][1] + 12);
        g.stroke();
      }
      g.restore();
    },

    /* ---- 2. 动态：雷达扫掠沿量规环走，中心十字缓慢呼吸 ---- */
    floor: function (g, t, now) {
      var th = t.theme;
      var a = (now / 7000) % TAU;
      var b = 0.5 + 0.5 * Math.sin(now / 900);

      g.save();
      g.lineCap = 'round';
      g.beginPath();
      g.arc(ARC.x, ARC.y, 152, a - 0.55, a);
      g.strokeStyle = U.rgba(th.wall, 0.15);
      g.lineWidth = 2;
      g.stroke();

      g.beginPath();
      g.arc(ARC.x, ARC.y, 152, a - 0.18, a);
      g.strokeStyle = 'rgba(234,252,255,0.32)';
      g.lineWidth = 1.2;
      g.stroke();

      g.beginPath();
      g.arc(ARC.x, 400, 15 + b * 2.5, 0, TAU);
      g.strokeStyle = U.rgba(th.wall, 0.05 + b * 0.07);
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    },

    /* ---- 3. 墙体：弧墙内侧的量规刻度（长刻度每 15°） ---- */
    walls: function (g, t) {
      var th = t.theme;
      g.save();
      g.lineCap = 'butt';
      for (var i = 0; i <= 48; i++) {
        var a = Math.PI + i * Math.PI / 48;
        var big = i % 4 === 0;
        var r0 = ARC.r - (big ? 8 : 4.5);
        var r1 = ARC.r - 1.2;
        g.strokeStyle = U.rgba(th.wall, big ? 0.44 : 0.2);
        g.lineWidth = big ? 1.8 : 1.1;
        g.beginPath();
        g.moveTo(ARC.x + Math.cos(a) * r0, ARC.y + Math.sin(a) * r0);
        g.lineTo(ARC.x + Math.cos(a) * r1, ARC.y + Math.sin(a) * r1);
        g.stroke();
      }
      g.restore();
    },

    /* ---- 3b. 底部结构角：剖切轮廓（缩进三角，把斜纹收成一块剖面） ---- */
    cornerDetail: function (g, t, tri) {
      var th = t.theme;
      var cx = (tri[0].x + tri[1].x + tri[2].x) / 3;
      var cy = (tri[0].y + tri[1].y + tri[2].y) / 3;

      g.save();
      g.strokeStyle = U.rgba(th.wall, 0.26);
      g.lineWidth = 1.2;
      g.beginPath();
      for (var i = 0; i < 3; i++) {
        var dx = cx - tri[i].x;
        var dy = cy - tri[i].y;
        var d = Math.hypot(dx, dy) || 1;
        var px = tri[i].x + dx * (15 / d);
        var py = tri[i].y + dy * (15 / d);
        if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();

      g.strokeStyle = U.rgba(th.wall, 0.12);
      g.lineWidth = 1;
      g.beginPath();
      for (var k = 0; k < 3; k++) {
        var ex = cx - tri[k].x;
        var ey = cy - tri[k].y;
        var el = Math.hypot(ex, ey) || 1;
        g.moveTo(tri[k].x + ex * (4 / el), tri[k].y + ey * (4 / el));
        g.lineTo(tri[k].x + ex * (15 / el), tri[k].y + ey * (15 / el));
      }
      g.stroke();
      g.restore();
    },

    /* ---- 4a. 目标灯：表盘 + 指针 ---- */
    target: function (g, o, t, i) {
      var th = t.theme;
      var lit = o.lit;
      var now = performance.now();
      var breathe = 0.5 + 0.5 * Math.sin(now / 620 + i * 1.7);
      var r = o.r;

      /* 表盘外圈 + 16 格刻度（取代通用的虚线圈） */
      g.save();
      g.beginPath();
      g.arc(o.x, o.y, r + 8.5, 0, TAU);
      g.strokeStyle = U.rgba(th.target, lit ? 0.48 : 0.13 + breathe * 0.1);
      g.lineWidth = 1;
      g.stroke();

      for (var k = 0; k < 16; k++) {
        var a = k / 16 * TAU;
        var long = k % 4 === 0;
        g.beginPath();
        g.moveTo(o.x + Math.cos(a) * (r + 3.5), o.y + Math.sin(a) * (r + 3.5));
        g.lineTo(o.x + Math.cos(a) * (r + (long ? 13 : 8.5)), o.y + Math.sin(a) * (r + (long ? 13 : 8.5)));
        g.strokeStyle = U.rgba(th.target, lit ? 0.55 : 0.13 + breathe * 0.14);
        g.lineWidth = long ? 1.4 : 1;
        g.stroke();
      }
      g.restore();

      /* 玻璃灯体 */
      g.save();
      g.shadowColor = th.target;
      g.shadowBlur = lit ? 30 : 5 + breathe * 7;
      g.beginPath();
      g.arc(o.x, o.y, r, 0, TAU);
      g.fillStyle = glassGrad(g, o.x, o.y, r, th.target, lit);
      g.fill();
      g.restore();

      /* 金属压边 + 顶部反光 */
      g.beginPath();
      g.arc(o.x, o.y, r, 0, TAU);
      g.lineWidth = 2.2;
      g.strokeStyle = lit ? 'rgba(245,255,235,0.9)' : metalGrad(g, o.x, o.y, r, th.target);
      g.stroke();

      g.beginPath();
      g.arc(o.x, o.y, r * 0.78, Math.PI * 1.05, Math.PI * 1.62);
      g.strokeStyle = 'rgba(255,255,255,' + (lit ? 0.75 : 0.22) + ')';
      g.lineWidth = 1.5;
      g.stroke();

      /* 表盘内环 + 指针（未点亮时缓慢转动，点亮后指向 12 点） */
      g.beginPath();
      g.arc(o.x, o.y, r * 0.64, 0, TAU);
      g.strokeStyle = 'rgba(255,255,255,' + (0.16 + breathe * 0.1) + ')';
      g.lineWidth = 0.9;
      g.stroke();

      var na = lit ? -Math.PI / 2 : (now / 2600 + i * 1.1);
      g.beginPath();
      g.moveTo(o.x, o.y);
      g.lineTo(o.x + Math.cos(na) * r * 0.82, o.y + Math.sin(na) * r * 0.82);
      g.strokeStyle = lit ? '#fbffe8' : U.rgba(th.target, 0.8);
      g.lineWidth = 1.6;
      g.lineCap = 'round';
      g.stroke();
      g.lineCap = 'butt';

      g.beginPath();
      g.arc(o.x, o.y, r * 0.14, 0, TAU);
      g.fillStyle = lit ? '#fbffe8' : U.rgba(th.target, 0.75);
      g.fill();
    },

    /* ---- 4b. 缓冲器压环：三层靶环 + 八向刻度 ---- */
    bumperBezel: function (g, o, r, t, p) {
      var th = t.theme;
      g.save();
      g.strokeStyle = U.rgba(th.bumper, 0.42 + p * 0.45);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(o.x, o.y, r * 0.93, 0, TAU);
      g.stroke();

      for (var k = 0; k < 8; k++) {
        var a = k / 8 * TAU + Math.PI / 8;
        g.beginPath();
        g.moveTo(o.x + Math.cos(a) * r * 0.96, o.y + Math.sin(a) * r * 0.96);
        g.lineTo(o.x + Math.cos(a) * r * 1.14, o.y + Math.sin(a) * r * 1.14);
        g.strokeStyle = U.rgba(th.bumper, 0.34 + p * 0.4);
        g.lineWidth = k % 2 === 0 ? 1.4 : 1;
        g.stroke();
      }
      g.restore();
    },

    /* ---- 4c. 钉子：镀铬半球 + 点位圈 ---- */
    peg: function (g, p, t) {
      var th = t.theme;
      var r = p.r;

      g.beginPath();
      g.ellipse(p.x + 1.2, p.y + 2.2, r * 0.95, r * 0.8, 0, 0, TAU);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fill();

      g.beginPath();
      g.arc(p.x, p.y, r + 3.2, 0, TAU);
      g.strokeStyle = U.rgba(th.peg, 0.2 + p.flash * 0.45);
      g.lineWidth = 1;
      g.stroke();

      var halo = g.createRadialGradient(p.x, p.y, r * 0.4, p.x, p.y, r * 2.6);
      halo.addColorStop(0, U.rgba(th.peg, 0.26 + p.flash * 0.4));
      halo.addColorStop(1, U.rgba(th.peg, 0));
      g.fillStyle = halo;
      g.beginPath();
      g.arc(p.x, p.y, r * 2.6, 0, TAU);
      g.fill();

      var grad = g.createRadialGradient(p.x - r * 0.35, p.y - r * 0.45, 0.5, p.x, p.y, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.42, th.peg);
      grad.addColorStop(1, 'rgba(40,60,80,0.95)');
      g.beginPath();
      g.arc(p.x, p.y, r, 0, TAU);
      g.fillStyle = grad;
      g.fill();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(10,18,28,0.85)';
      g.stroke();

      g.beginPath();
      g.arc(p.x - r * 0.3, p.y - r * 0.38, r * 0.28, 0, TAU);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.fill();
    },

    /* ---- 4d. 轨道标记：单层细箭头 + 每三处一个十字刻度 ---- */
    orbitMarks: function (g, orbit, t, f, now) {
      var th = t.theme;
      var phase = (now / 2600) % 1;
      g.save();
      g.lineWidth = 1.8;
      for (var i = 0; i < 7; i++) {
        var tt = (i / 7 + phase) % 1;
        if (tt < 0.02 || tt > 0.98) continue;
        var pp = PB.Tables.orbitAt(orbit, tt);
        g.save();
        g.translate(pp.x, pp.y);
        g.rotate(Math.atan2(pp.ty, pp.tx));
        g.strokeStyle = U.rgba(th.orbit, 0.24 + f * 0.35);
        g.beginPath();
        g.moveTo(-3.4, -4.6);
        g.lineTo(2.6, 0);
        g.lineTo(-3.4, 4.6);
        g.stroke();
        if (i % 3 === 0) {
          g.strokeStyle = U.rgba(th.orbit, 0.16 + f * 0.25);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(-7, 0);
          g.lineTo(-8.6, 0);
          g.stroke();
          g.lineWidth = 1.8;
        }
        g.restore();
      }
      g.restore();
    }
  };

  /* ===========================================================================
   * 母题二 · arcade —— 拱廊
   *   语法：斜向 + 重复。45° 金箔条带贯穿全台，两侧三跨柱廊，
   *   弧墙檐口一排齿饰，底部扇形马赛克 —— 全部是"建筑立面"的写法。
   * ======================================================================== */
  var arcade = {
    id: 'arcade',
    name: '拱券 · 柱廊',

    /* ---- 1. 底板：金箔条带 + 柱廊 + 檐口齿饰 + 底部扇形 ---- */
    surface: function (g, table) {
      var th = table.theme;

      /* 45° 斜向条带：宽带柔光 + 一侧压暗 + 一侧提亮 = 拼接的金箔板 */
      g.save();
      g.lineCap = 'butt';
      for (var c = -H; c < W + H; c += 72) {
        g.strokeStyle = U.rgba(th.orbitWarm, 0.038);
        g.lineWidth = 34;
        g.beginPath();
        g.moveTo(c, H + 40);
        g.lineTo(c + H + 80, -40);
        g.stroke();

        g.strokeStyle = 'rgba(0,0,0,0.19)';
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(c - 17, H + 40);
        g.lineTo(c - 17 + H + 80, -40);
        g.stroke();

        g.strokeStyle = U.rgba(th.orbitWarm, 0.09);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(c + 17, H + 40);
        g.lineTo(c + 17 + H + 80, -40);
        g.stroke();
      }
      g.restore();

      /* 柱廊：左右各三跨，双线拱券 + 柱身 + 柱头 */
      g.save();
      for (var side = 0; side < 2; side++) {
        var cx = side === 0 ? 74 : 406;
        for (var i = 0; i < 3; i++) {
          var spring = 330 + i * 132;
          var r = 44;

          g.strokeStyle = U.rgba(th.orbitWarm, 0.19);
          g.lineWidth = 1.6;
          g.beginPath();
          g.arc(cx, spring, r, Math.PI, TAU);
          g.stroke();

          g.strokeStyle = U.rgba(th.orbitWarm, 0.1);
          g.lineWidth = 1.2;
          g.beginPath();
          g.arc(cx, spring, r - 5.5, Math.PI, TAU);
          g.stroke();

          g.strokeStyle = U.rgba(th.orbitWarm, 0.16);
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(cx - r, spring);
          g.lineTo(cx - r, spring + 74);
          g.moveTo(cx + r, spring);
          g.lineTo(cx + r, spring + 74);
          g.stroke();

          /* 柱头压线：把拱脚"坐"实 */
          g.strokeStyle = U.rgba(th.orbitWarm, 0.2);
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(cx - r - 4, spring);
          g.lineTo(cx - r + 4, spring);
          g.moveTo(cx + r - 4, spring);
          g.lineTo(cx + r + 4, spring);
          g.stroke();
          g.lineWidth = 1.2;

          /* 拱顶石 */
          g.beginPath();
          g.moveTo(cx - 4, spring - r + 1);
          g.lineTo(cx + 4, spring - r + 1);
          g.lineTo(cx + 2.4, spring - r - 5.5);
          g.lineTo(cx - 2.4, spring - r - 5.5);
          g.closePath();
          g.fillStyle = U.rgba(th.orbitWarm, 0.09);
          g.fill();
        }
      }
      g.restore();

      /* 一道横向course线：把台面分成"上层回廊 / 下层厅堂" */
      g.save();
      g.strokeStyle = U.rgba(th.orbitWarm, 0.1);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(40, 428);
      g.lineTo(212, 428);
      g.moveTo(268, 428);
      g.lineTo(440, 428);
      g.stroke();
      g.strokeStyle = U.rgba(th.orbitWarm, 0.055);
      g.beginPath();
      g.moveTo(40, 433);
      g.lineTo(212, 433);
      g.moveTo(268, 433);
      g.lineTo(440, 433);
      g.stroke();

      diamondPath(g, 240, 428, 7, 9);
      g.strokeStyle = U.rgba(th.orbitWarm, 0.12);
      g.stroke();
      g.restore();
    },

    /* ---- 2. 动态：柱廊里的光自上而下往复 ---- */
    floor: function (g, t, now) {
      var th = t.theme;
      var k = 0.5 - 0.5 * Math.cos(now / 1600);
      for (var s = 0; s < 2; s++) {
        var x = s === 0 ? 74 : 406;
        var y = 292 + k * 300;
        var rg = g.createRadialGradient(x, y, 0, x, y, 92);
        rg.addColorStop(0, U.rgba(th.orbitWarm, 0.11));
        rg.addColorStop(1, U.rgba(th.orbitWarm, 0));
        g.fillStyle = rg;
        g.beginPath();
        g.arc(x, y, 92, 0, TAU);
        g.fill();
      }
    },

    /* ---- 3. 墙体：弧墙檐口齿饰 + 侧墙铆钉 ---- */
    walls: function (g, t) {
      var th = t.theme;
      g.save();

      /* 檐口齿饰（dentil）：一排等距小方块，上下两道压线 */
      var n = 40;
      for (var i = 0; i < n; i++) {
        var a = Math.PI + (i + 0.5) * Math.PI / n;
        g.save();
        g.translate(ARC.x + Math.cos(a) * ARC.r, ARC.y + Math.sin(a) * ARC.r);
        g.rotate(a + Math.PI / 2);
        g.fillStyle = U.rgba(th.orbitWarm, 0.21);
        g.fillRect(-2.6, -3.4, 5.2, 6.8);
        g.restore();
      }

      g.strokeStyle = U.rgba(th.orbitWarm, 0.19);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(ARC.x, ARC.y, ARC.r - 5.6, Math.PI + 0.02, TAU - 0.02);
      g.stroke();
      g.beginPath();
      g.arc(ARC.x, ARC.y, ARC.r + 5.4, Math.PI + 0.02, TAU - 0.02);
      g.stroke();

      /* 侧墙黄铜铆钉 */
      for (var y = 252; y <= 700; y += 46) {
        rivet(g, 31.6, y, 2.1, th.orbitWarm);
        rivet(g, 448.4, y, 2.1, th.orbitWarm);
      }
      g.restore();
    },

    /* ---- 3b. 底部结构角：三级台阶（建筑基座） ---- */
    cornerDetail: function (g, t, tri) {
      var th = t.theme;
      var x0 = tri[0].x;
      var y0 = tri[0].y;
      var dir = tri[1].x > x0 ? 1 : -1;

      g.save();
      for (var k = 0; k < 3; k++) {
        var y = y0 + 26 + k * 14;
        var xEnd = x0 + dir * ((y - y0) * 0.94 - 8);
        g.fillStyle = U.rgba(th.orbitWarm, 0.09 + k * 0.02);
        g.fillRect(Math.min(x0, xEnd), y, Math.abs(xEnd - x0), 14);
        g.strokeStyle = U.rgba(th.orbitWarm, 0.15);
        g.lineWidth = 1;
        g.strokeRect(Math.min(x0, xEnd), y, Math.abs(xEnd - x0), 14);
      }
      g.restore();
    },

    /* ---- 4a. 目标灯：菱形宝石 + 镶座 ---- */
    target: function (g, o, t, i) {
      var th = t.theme;
      var lit = o.lit;
      var now = performance.now();
      var breathe = 0.5 + 0.5 * Math.sin(now / 620 + i * 1.7);
      var rx = o.r * 0.9;
      var ry = o.r * 1.06;

      /* 镶座：外菱形细线 + 四角铆点 */
      diamondPath(g, o.x, o.y, rx * 1.36, ry * 1.32);
      g.strokeStyle = U.rgba(th.orbitWarm, lit ? 0.62 : 0.2 + breathe * 0.14);
      g.lineWidth = 1;
      g.stroke();
      var pr = [[0, -ry * 1.32], [rx * 1.36, 0], [0, ry * 1.32], [-rx * 1.36, 0]];
      for (var k = 0; k < 4; k++) {
        g.beginPath();
        g.arc(o.x + pr[k][0], o.y + pr[k][1], 1.5, 0, TAU);
        g.fillStyle = U.rgba(th.orbitWarm, 0.4 + breathe * 0.2);
        g.fill();
      }

      /* 宝石体 */
      g.save();
      g.shadowColor = th.target;
      g.shadowBlur = lit ? 28 : 5 + breathe * 7;
      diamondPath(g, o.x, o.y, rx, ry);
      g.fillStyle = glassGrad(g, o.x, o.y, Math.max(rx, ry), th.target, lit);
      g.fill();
      g.restore();

      /* 刻面：左右两片亮面 + 十字棱线 */
      g.beginPath();
      g.moveTo(o.x, o.y - ry);
      g.lineTo(o.x - rx, o.y);
      g.lineTo(o.x, o.y);
      g.closePath();
      g.fillStyle = 'rgba(255,255,255,' + (lit ? 0.34 : 0.1) + ')';
      g.fill();

      g.beginPath();
      g.moveTo(o.x, o.y + ry);
      g.lineTo(o.x + rx, o.y);
      g.lineTo(o.x, o.y);
      g.closePath();
      g.fillStyle = 'rgba(255,255,255,' + (lit ? 0.14 : 0.04) + ')';
      g.fill();

      g.strokeStyle = 'rgba(255,255,255,' + (lit ? 0.5 : 0.16) + ')';
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(o.x, o.y - ry);
      g.lineTo(o.x, o.y + ry);
      g.moveTo(o.x - rx, o.y);
      g.lineTo(o.x + rx, o.y);
      g.stroke();

      /* 金属包边 */
      diamondPath(g, o.x, o.y, rx, ry);
      g.lineWidth = 2;
      g.strokeStyle = lit ? 'rgba(255,250,232,0.92)' : metalGrad(g, o.x, o.y, rx, th.orbitWarm);
      g.stroke();

      /* 中心火彩 */
      g.beginPath();
      g.arc(o.x, o.y - ry * 0.16, o.r * 0.2, 0, TAU);
      g.fillStyle = lit ? '#fffdf0' : U.rgba(th.target, 0.72);
      g.fill();
    },

    /* ---- 4b. 缓冲器压环：六角螺母 + 六颗角螺栓 ---- */
    bumperBezel: function (g, o, r, t, p) {
      var th = t.theme;
      var R = r * 1.15;
      g.save();

      hexPath(g, o.x, o.y, R, 0);
      g.lineWidth = 3;
      g.strokeStyle = metalGrad(g, o.x, o.y, R, th.orbitWarm);
      g.stroke();

      hexPath(g, o.x, o.y, R * 0.92, 0);
      g.lineWidth = 1;
      g.strokeStyle = U.rgba(th.orbitWarm, 0.34 + p * 0.4);
      g.stroke();

      for (var k = 0; k < 6; k++) {
        var a = k * Math.PI / 3;
        rivet(g, o.x + Math.cos(a) * R * 0.94, o.y + Math.sin(a) * R * 0.94, 2.2, th.orbitWarm);
      }
      g.restore();
    },

    /* ---- 4c. 钉子：黄铜铆钉（底座圆盘 + 半球） ---- */
    peg: function (g, p, t) {
      var th = t.theme;
      var r = p.r;

      g.beginPath();
      g.ellipse(p.x + 1.2, p.y + 2.2, r, r * 0.82, 0, 0, TAU);
      g.fillStyle = 'rgba(0,0,0,0.42)';
      g.fill();

      g.beginPath();
      g.arc(p.x, p.y, r + 2.6, 0, TAU);
      var base = g.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
      base.addColorStop(0, 'rgba(255,238,198,0.8)');
      base.addColorStop(0.5, U.rgba(th.orbitWarm, 0.55));
      base.addColorStop(1, 'rgba(58,34,8,0.9)');
      g.fillStyle = base;
      g.fill();
      g.strokeStyle = 'rgba(24,14,4,0.65)';
      g.lineWidth = 0.9;
      g.stroke();

      var grad = g.createRadialGradient(p.x - r * 0.34, p.y - r * 0.44, 0.4, p.x, p.y, r * 0.8);
      grad.addColorStop(0, '#fffaf0');
      grad.addColorStop(0.42, th.peg);
      grad.addColorStop(1, 'rgba(96,58,16,0.95)');
      g.beginPath();
      g.arc(p.x, p.y, r * 0.78, 0, TAU);
      g.fillStyle = grad;
      g.fill();

      g.beginPath();
      g.arc(p.x - r * 0.26, p.y - r * 0.32, r * 0.24, 0, TAU);
      g.fillStyle = 'rgba(255,255,255,' + (0.6 + p.flash * 0.35) + ')';
      g.fill();
    },

    /* ---- 4d. 轨道标记：双层箭头（回纹的笔画逻辑） ---- */
    orbitMarks: function (g, orbit, t, f, now) {
      var th = t.theme;
      var phase = (now / 2800) % 1;
      g.save();
      g.lineCap = 'round';
      for (var i = 0; i < 5; i++) {
        var tt = (i / 5 + phase) % 1;
        if (tt < 0.03 || tt > 0.97) continue;
        var pp = PB.Tables.orbitAt(orbit, tt);
        g.save();
        g.translate(pp.x, pp.y);
        g.rotate(Math.atan2(pp.ty, pp.tx));
        for (var k = 0; k < 2; k++) {
          var s = k === 0 ? 1 : 0.56;
          g.strokeStyle = U.rgba(th.orbitWarm, (0.34 - k * 0.14) + f * 0.3);
          g.lineWidth = 1.6 - k * 0.4;
          g.beginPath();
          g.moveTo(-4.6 * s, -6 * s);
          g.lineTo(2.4 * s, 0);
          g.lineTo(-4.6 * s, 6 * s);
          g.stroke();
        }
        g.restore();
      }
      g.restore();
    },

    /* ---- 5. 导流墙：车线凹槽 + 两端柱帽（黄铜立柱） ---- */
    barDetail: function (g, s, t) {
      var th = t.theme;
      var dx = s.b.x - s.a.x;
      var dy = s.b.y - s.a.y;
      var len = Math.hypot(dx, dy) || 1;
      var nx = -dy / len;
      var ny = dx / len;

      g.save();
      g.lineCap = 'round';
      for (var k = -1; k <= 1; k++) {
        var off = k * s.half * 0.5;
        g.strokeStyle = k === 0 ? 'rgba(255,246,220,0.5)' : 'rgba(38,22,6,0.45)';
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(s.a.x + nx * off, s.a.y + ny * off);
        g.lineTo(s.b.x + nx * off, s.b.y + ny * off);
        g.stroke();
      }

      var caps = [s.a, s.b];
      for (var c = 0; c < 2; c++) {
        g.beginPath();
        g.arc(caps[c].x, caps[c].y, s.half + 2.2, 0, TAU);
        var cg = g.createLinearGradient(caps[c].x - 6, caps[c].y - 6, caps[c].x + 6, caps[c].y + 6);
        cg.addColorStop(0, 'rgba(255,238,196,0.72)');
        cg.addColorStop(0.55, U.rgba(th.orbitWarm, 0.5));
        cg.addColorStop(1, 'rgba(48,28,6,0.9)');
        g.fillStyle = cg;
        g.fill();
        g.strokeStyle = 'rgba(20,12,4,0.6)';
        g.lineWidth = 0.9;
        g.stroke();
      }
      g.restore();
    }
  };

  /* ===========================================================================
   * 母题三 · core —— 深渊核心
   *   语法：放射 + 六角。一条旋转对称轴贯穿全台，晶格底板、辐条、
   *   断裂同心环、锯齿裂隙 —— 全部从"核心"向外失效。
   * ======================================================================== */
  var coreMotif = {
    id: 'core',
    name: '放射核 · 六角晶格',
    cx: 240,
    cy: 270,

    /* ---- 1. 底板：六角晶格 + 辐条 + 断裂环 + 裂隙 + 核心纹章 ---- */
    surface: function (g, table) {
      var th = table.theme;
      var cx = coreMotif.cx;
      var cy = coreMotif.cy;

      /* 六角晶格 */
      g.save();
      g.strokeStyle = U.rgba(th.wall, 0.05);
      g.lineWidth = 1;
      var R = 26;
      var dx = R * 1.5;
      var dy = Math.sqrt(3) * R;
      for (var col = -1; col * dx < W + R; col++) {
        for (var row = -1; row * dy < H + R; row++) {
          var hx = col * dx;
          var hy = row * dy + (Math.abs(col % 2) ? dy / 2 : 0);
          hexPath(g, hx, hy, R, 0);
          g.stroke();
        }
      }
      g.restore();

      /* 放射辐条：每 15° 一条，主线每 90°；向外衰减 */
      g.save();
      for (var i = 0; i < 24; i++) {
        var a = i * TAU / 24;
        var main = i % 6 === 0;
        var grd = g.createLinearGradient(cx, cy, cx + Math.cos(a) * 330, cy + Math.sin(a) * 330);
        grd.addColorStop(0, U.rgba(th.wall, main ? 0.15 : 0.085));
        grd.addColorStop(1, U.rgba(th.wall, 0));
        g.strokeStyle = grd;
        g.lineWidth = main ? 1.4 : 1;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * 76, cy + Math.sin(a) * 76);
        g.lineTo(cx + Math.cos(a) * 330, cy + Math.sin(a) * 330);
        g.stroke();
      }
      g.restore();

      /* 断裂同心环：每环 8 段，缺口错开，暗示"约束场正在崩解" */
      var rings = [98, 136, 174];
      for (var k = 0; k < rings.length; k++) {
        g.strokeStyle = U.rgba(th.wall, 0.05 + k * 0.014);
        g.lineWidth = 1.2;
        for (var s = 0; s < 8; s++) {
          var a0 = s * TAU / 8 + 0.15 + k * 0.09;
          var a1 = (s + 1) * TAU / 8 - 0.17;
          g.beginPath();
          g.arc(cx, cy, rings[k], a0, a1);
          g.stroke();
        }
      }

      /* 裂隙：暗槽 + 冷光边，成对出现才有"裂开"的体积
       * 全部朝下裂，避开顶部轨道区，不然会被误读成划痕 */
      var cracks = [[0.86, 150], [1.62, 176], [2.34, 156]];
      for (var c = 0; c < cracks.length; c++) {
        var ca = cracks[c][0];
        jagged(g, cx + Math.cos(ca) * 74, cy + Math.sin(ca) * 74, ca, cracks[c][1], 30);
        g.strokeStyle = 'rgba(0,0,0,0.42)';
        g.lineWidth = 2.2;
        g.stroke();
        g.strokeStyle = U.rgba(th.wall, 0.07);
        g.lineWidth = 0.9;
        g.stroke();
      }

      /* 核心纹章：两圈六角 + 六片弧瓣，被中央缓冲器压住 */
      g.save();
      g.strokeStyle = U.rgba(th.wall, 0.12);
      g.lineWidth = 1.2;
      hexPath(g, cx, cy, 64, Math.PI / 6);
      g.stroke();
      g.strokeStyle = U.rgba(th.bumper, 0.1);
      hexPath(g, cx, cy, 78, Math.PI / 6);
      g.stroke();
      for (var p = 0; p < 6; p++) {
        var pa = p * TAU / 6 + Math.PI / 6;
        g.beginPath();
        g.arc(cx + Math.cos(pa) * 46, cy + Math.sin(pa) * 46, 26, pa - 0.95, pa + 0.95);
        g.strokeStyle = U.rgba(th.wall, 0.065);
        g.lineWidth = 1.2;
        g.stroke();
      }
      g.restore();
    },

    /* ---- 2. 动态：约束环扫描 + 核心呼吸 ---- */
    floor: function (g, t, now) {
      var th = t.theme;
      var cx = coreMotif.cx;
      var cy = coreMotif.cy;
      var b = 0.5 + 0.5 * Math.sin(now / 520);

      g.save();
      g.beginPath();
      g.arc(cx, cy, 136, 0, TAU);
      g.setLineDash([6, 10]);
      g.lineDashOffset = -now / 26;
      g.strokeStyle = U.rgba(th.wall, 0.2);
      g.lineWidth = 1.6;
      g.stroke();

      g.setLineDash([]);
      g.beginPath();
      g.arc(cx, cy, 64 + b * 3, 0, TAU);
      g.strokeStyle = U.rgba(th.bumper, 0.1 + b * 0.14);
      g.lineWidth = 1.4;
      g.stroke();
      g.restore();
    },

    /* ---- 3. 墙体：装甲板接缝 + 内侧铰点亮边 ---- */
    walls: function (g, t) {
      var th = t.theme;
      g.save();
      g.lineCap = 'butt';

      g.strokeStyle = 'rgba(3,9,12,0.72)';
      g.lineWidth = 2.6;
      for (var i = 0; i <= 24; i++) {
        var a = Math.PI + i * Math.PI / 24;
        g.beginPath();
        g.moveTo(ARC.x + Math.cos(a) * (ARC.r - 8), ARC.y + Math.sin(a) * (ARC.r - 8));
        g.lineTo(ARC.x + Math.cos(a) * (ARC.r + 8), ARC.y + Math.sin(a) * (ARC.r + 8));
        g.stroke();
      }
      for (var y = 236; y <= 700; y += 52) {
        g.beginPath();
        g.moveTo(21, y);
        g.lineTo(39, y);
        g.stroke();
        g.beginPath();
        g.moveTo(441, y);
        g.lineTo(459, y);
        g.stroke();
      }

      g.strokeStyle = U.rgba(th.wall, 0.34);
      g.lineWidth = 1.4;
      for (var j = 0; j <= 24; j++) {
        var b2 = Math.PI + j * Math.PI / 24;
        g.beginPath();
        g.moveTo(ARC.x + Math.cos(b2) * (ARC.r - 8.4), ARC.y + Math.sin(b2) * (ARC.r - 8.4));
        g.lineTo(ARC.x + Math.cos(b2) * (ARC.r - 3), ARC.y + Math.sin(b2) * (ARC.r - 3));
        g.stroke();
      }
      g.restore();
    },

    /* ---- 3b. 底部结构角：铆接装甲板（斜边肋 + 三颗六角螺栓） ---- */
    cornerDetail: function (g, t, tri) {
      var th = t.theme;
      var inner = tri[1];
      var ex = inner.x - tri[0].x;
      var ey = inner.y - tri[0].y;
      var len = Math.hypot(ex, ey) || 1;

      /* 指向三角形内部的法线 */
      var nx = ey / len;
      var ny = -ex / len;
      var mx = (tri[0].x + inner.x) / 2;
      var my = (tri[0].y + inner.y) / 2;
      if (nx * (tri[2].x - mx) + ny * (tri[2].y - my) < 0) { nx = -nx; ny = -ny; }

      g.save();
      /* 一条内移的装甲缝 + 缝上的三颗六角螺栓 + 与斜边之间的短肋 */
      var ox = nx * 22;
      var oy = ny * 22;
      g.strokeStyle = 'rgba(2,8,10,0.6)';
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(tri[0].x + ox, tri[0].y + oy);
      g.lineTo(inner.x + ox, inner.y + oy);
      g.stroke();
      g.strokeStyle = U.rgba(th.wall, 0.22);
      g.lineWidth = 1;
      g.stroke();

      for (var k = 0; k < 3; k++) {
        var tt = 0.2 + k * 0.3;
        var ex2 = tri[0].x + ex * tt;
        var ey2 = tri[0].y + ey * tt;

        g.strokeStyle = 'rgba(2,8,10,0.45)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(ex2, ey2);
        g.lineTo(ex2 + ox, ey2 + oy);
        g.stroke();

        hexPath(g, ex2 + ox, ey2 + oy, 5, 0);
        g.fillStyle = 'rgba(8,22,26,0.92)';
        g.fill();
        g.strokeStyle = U.rgba(th.wall, 0.4);
        g.lineWidth = 1;
        g.stroke();
      }
      g.restore();
    },

    /* ---- 4a. 目标灯：六角晶胞 ---- */
    target: function (g, o, t, i) {
      var th = t.theme;
      var lit = o.lit;
      var now = performance.now();
      var breathe = 0.5 + 0.5 * Math.sin(now / 620 + i * 1.7);
      var r = o.r;

      /* 三片断续外弧（取代完整虚线圈） */
      g.save();
      for (var k = 0; k < 3; k++) {
        var a0 = k * TAU / 3 + (now / 2600) * (k % 2 ? -1 : 1);
        g.beginPath();
        g.arc(o.x, o.y, r + 7.5, a0, a0 + 1.45);
        g.strokeStyle = U.rgba(th.target, lit ? 0.62 : 0.16 + breathe * 0.16);
        g.lineWidth = 1.4;
        g.stroke();
      }
      g.restore();

      /* 晶胞体 */
      g.save();
      g.shadowColor = th.target;
      g.shadowBlur = lit ? 28 : 6 + breathe * 8;
      hexPath(g, o.x, o.y, r, Math.PI / 6);
      g.fillStyle = glassGrad(g, o.x, o.y, r, th.target, lit);
      g.fill();
      g.restore();

      /* 压边 + 内晶格 */
      hexPath(g, o.x, o.y, r, Math.PI / 6);
      g.lineWidth = 2;
      g.strokeStyle = lit ? 'rgba(240,255,250,0.9)' : metalGrad(g, o.x, o.y, r, th.target);
      g.stroke();

      hexPath(g, o.x, o.y, r * 0.56, Math.PI / 6);
      g.strokeStyle = 'rgba(255,255,255,' + (0.18 + breathe * 0.2) + ')';
      g.lineWidth = 0.9;
      g.stroke();

      g.beginPath();
      g.arc(o.x, o.y, r * 0.24, 0, TAU);
      g.fillStyle = lit ? '#f2fff9' : U.rgba(th.target, 0.6);
      g.fill();
    },

    /* ---- 4b. 缓冲器压环：三段反向涡流弧 ---- */
    bumperBezel: function (g, o, r, t, p, now) {
      var th = t.theme;
      var base = now / 1400;
      g.save();
      g.lineCap = 'round';
      for (var k = 0; k < 3; k++) {
        var rr = r * (1.02 + k * 0.16);
        var a0 = base * (k % 2 ? -1 : 1) + k * 2.1;
        g.beginPath();
        g.arc(o.x, o.y, rr, a0, a0 + Math.PI * 0.72);
        g.strokeStyle = U.rgba(k === 1 ? th.bumper : th.wall, 0.36 - k * 0.08 + p * 0.34);
        g.lineWidth = k === 0 ? 2 : 1.3;
        g.stroke();
      }
      g.restore();
    },

    /* ---- 4c. 钉子：六角螺母 ---- */
    peg: function (g, p, t) {
      var th = t.theme;
      var r = p.r;

      g.beginPath();
      g.ellipse(p.x + 1.4, p.y + 2.4, r * 1.3, r * 1.1, 0, 0, TAU);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fill();

      hexPath(g, p.x, p.y, r * 1.34, Math.PI / 6);
      var body = g.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
      body.addColorStop(0, 'rgba(226,255,246,0.92)');
      body.addColorStop(0.44, U.rgba(th.peg, 0.85));
      body.addColorStop(1, 'rgba(12,34,38,0.96)');
      g.fillStyle = body;
      g.fill();
      g.strokeStyle = 'rgba(6,20,24,0.9)';
      g.lineWidth = 1;
      g.stroke();

      hexPath(g, p.x, p.y, r * 0.86, Math.PI / 6);
      g.fillStyle = 'rgba(6,16,20,0.9)';
      g.fill();

      g.beginPath();
      g.arc(p.x, p.y, r * 0.44, 0, TAU);
      g.fillStyle = U.rgba(th.peg, 0.5 + p.flash * 0.5);
      g.fill();
    },

    /* ---- 4d. 轨道标记：径向短栅（能量闸门，长度随相位脉动） ---- */
    orbitMarks: function (g, orbit, t, f, now) {
      var th = t.theme;
      var phase = (now / 2400) % 1;
      g.save();
      g.lineCap = 'round';
      for (var i = 0; i < 9; i++) {
        var tt = (i / 9 + phase) % 1;
        var pp = PB.Tables.orbitAt(orbit, tt);
        var k = 0.5 + 0.5 * Math.sin(now / 320 + i);
        g.save();
        g.translate(pp.x, pp.y);
        g.rotate(Math.atan2(pp.ty, pp.tx) + Math.PI / 2);
        g.strokeStyle = U.rgba(th.orbit, 0.16 + k * 0.28 + f * 0.3);
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(0, -3.5 - k * 3.5);
        g.lineTo(0, 3.5 + k * 3.5);
        g.stroke();
        g.restore();
      }
      g.restore();
    }
  };

  /* ===========================================================================
   * 选台卡缩略图：26×26 的母题缩写（网格 / 拱券 / 晶格）
   * ======================================================================== */
  var THUMB = {
    draft: function (th) {
      return '<svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<rect width="26" height="26" fill="#0a1526"/>' +
        '<g stroke="' + th.wall + '" stroke-opacity=".22" stroke-width=".7">' +
        '<path d="M6.5 0v26M13 0v26M19.5 0v26M0 6.5h26M0 13h26M0 19.5h26"/></g>' +
        '<circle cx="13" cy="13" r="7.4" fill="none" stroke="' + th.wall + '" stroke-opacity=".85" stroke-width="1.2"/>' +
        '<circle cx="13" cy="13" r="4.6" fill="none" stroke="' + th.wall + '" stroke-opacity=".35" stroke-width=".8"/>' +
        '<path d="M13 5.6v3.4M13 17v3.4M5.6 13h3.4M17 13h3.4" stroke="#eafcff" stroke-width="1.2"/>' +
        '<circle cx="13" cy="13" r="1.5" fill="#eafcff"/></svg>';
    },
    arcade: function (th) {
      return '<svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<rect width="26" height="26" fill="#180f0a"/>' +
        '<g stroke="' + th.orbitWarm + '" stroke-opacity=".16" stroke-width="4.5">' +
        '<path d="M-7 27L19 -1M7 33L33 5"/></g>' +
        '<g stroke="' + th.orbitWarm + '" stroke-opacity=".2" stroke-width=".7">' +
        '<path d="M-1 27L25 -1M13 33L39 5"/></g>' +
        '<path d="M5.5 25V14.5a6.5 6.5 0 0 1 13 0V25" fill="none" stroke="' + th.orbitWarm + '" stroke-opacity=".9" stroke-width="1.3"/>' +
        '<path d="M8.5 25V15a3.5 3.5 0 0 1 7 0v10" fill="none" stroke="' + th.orbitWarm + '" stroke-opacity=".35" stroke-width=".8"/>' +
        '<path d="M12 4.5l2 2.6-2 2.6-2-2.6z" fill="' + th.target + '" fill-opacity=".9"/></svg>';
    },
    core: function (th) {
      return '<svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<rect width="26" height="26" fill="#04161c"/>' +
        '<g stroke="' + th.wall + '" stroke-opacity=".28" stroke-width=".7">' +
        '<path d="M22 13l-4.5 7.8h-9L4 13l4.5-7.8h9z"/>' +
        '<path d="M17.5 20.8l4.5-7.8M8.5 5.2L4 13"/></g>' +
        '<g stroke="' + th.wall + '" stroke-opacity=".45" stroke-width=".9">' +
        '<path d="M13 1.5v4.6M13 19.9v4.6M1.5 13h4.6M19.9 13h4.6M5 5l3.2 3.2M21 21l-3.2-3.2M21 5l-3.2 3.2M5 21l3.2-3.2"/></g>' +
        '<circle cx="13" cy="13" r="7.6" fill="none" stroke="' + th.wall + '" stroke-opacity=".3" stroke-width=".9" stroke-dasharray="3 3"/>' +
        '<circle cx="13" cy="13" r="3" fill="' + th.bumper + '" fill-opacity=".85"/>' +
        '<circle cx="13" cy="13" r="1.3" fill="#f2fff9"/></svg>';
    }
  };

  /* ===========================================================================
   * 对外接口
   * ======================================================================== */
  var LIST = { draft: draft, arcade: arcade, core: coreMotif };

  PB.Motifs = {
    list: LIST,

    /** 取某张台面的母题实现（未知 id 回落到制图台，保证渲染不炸） */
    of: function (t) {
      return (t && LIST[t.motif]) || draft;
    },

    /** 选台卡缩略图 */
    thumb: function (def) {
      var f = THUMB[def.motif] || THUMB.draft;
      return f(def.theme);
    }
  };
})();
