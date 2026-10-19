/* =============================================================================
 * renderer.js — 渲染层
 *   所有绘制都围绕"材质"展开：台面底板（缓存贴图）、金属墙体、
 *   玻璃罩缓冲器、镀铬弹珠、拉丝挡板、立体钉子。
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;
  var C = PB.CONFIG;
  var U = PB.util;
  var TAU = U.TAU;
  var W = C.width;
  var H = C.height;

  var R = {};
  var ctx = null;
  var view = R.view = { sx: 1, sy: 1 };

  R.init = function (canvas) {
    ctx = canvas.getContext('2d');
  };

  R.ctx = function () { return ctx; };

  /* ============================================================ 底板与结构 */

  function drawSurface() {
    var img = PB.Materials.current;
    if (img) ctx.drawImage(img, -PB.Materials.BLEED, -PB.Materials.BLEED);
  }

  /** 掉球区：主题色的危险地带 */
  function drawDrainZone(t) {
    var th = t.theme;
    var g = ctx.createLinearGradient(0, 700, 0, 800);
    g.addColorStop(0, U.rgba(th.drain, 0));
    g.addColorStop(1, U.rgba(th.drain, 0.17));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(130, 690);
    ctx.lineTo(350, 690);
    ctx.lineTo(450, 800);
    ctx.lineTo(30, 800);
    ctx.closePath();
    ctx.fill();

    // 会呼吸的警戒虚线
    var pulse = 0.22 + 0.12 * Math.sin(performance.now() / 420);
    ctx.strokeStyle = U.rgba(th.drain, pulse);
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(150, 772);
    ctx.lineTo(330, 772);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** 底部结构三角（无碰撞，仅视觉上封住墙角） */
  function drawCorners(t) {
    var th = t.theme;
    var m = PB.Motifs.of(t);
    for (var i = 0; i < t.corners.length; i++) {
      var p = t.corners[i];
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      ctx.lineTo(p[1].x, p[1].y);
      ctx.lineTo(p[2].x, p[2].y);
      ctx.closePath();

      var g = ctx.createLinearGradient(p[0].x, p[0].y, p[2].x, p[2].y);
      g.addColorStop(0, 'rgba(16,24,36,0.96)');
      g.addColorStop(1, 'rgba(5,8,14,0.98)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = U.rgba(th.wall, 0.18);
      ctx.lineWidth = 1;
      ctx.stroke();

      // 斜向拉丝装饰
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      ctx.lineTo(p[1].x, p[1].y);
      ctx.lineTo(p[2].x, p[2].y);
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      for (var k = -60; k < 120; k += 6) {
        ctx.beginPath();
        ctx.moveTo(p[0].x + k, p[0].y);
        ctx.lineTo(p[0].x + k + 90, p[0].y + 90);
        ctx.stroke();
      }

      // 结构角也归母题管：加劲肋 / 台阶 / 铆接板
      if (m.cornerDetail) m.cornerDetail(ctx, t, p);
      ctx.restore();
    }
  }

  /** 外壳墙 + 顶部弧形墙：深色板材 + 霓虹边 + 高光芯 */
  function drawWalls(t) {
    var th = t.theme;

    // 1) 板材（深色厚边）
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = th.wallSlab;
    ctx.lineWidth = 15;
    ctx.beginPath();
    for (var i = 0; i < t.walls.length; i++) {
      var w = t.walls[i];
      ctx.moveTo(w.a.x, w.a.y);
      ctx.lineTo(w.b.x, w.b.y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(t.arc.cx, t.arc.cy, t.arc.r, Math.PI, TAU);
    ctx.stroke();

    // 2) 霓虹外发光
    ctx.shadowColor = U.rgba(th.wall, 0.95);
    ctx.shadowBlur = 18;
    ctx.strokeStyle = U.rgba(th.wall, 0.82);
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (var k = 0; k < t.walls.length; k++) {
      var wk = t.walls[k];
      ctx.moveTo(wk.a.x, wk.a.y);
      ctx.lineTo(wk.b.x, wk.b.y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(t.arc.cx, t.arc.cy, t.arc.r, Math.PI, TAU);
    ctx.stroke();

    // 3) 高光芯
    ctx.shadowBlur = 0;
    ctx.strokeStyle = th.wallCore;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (var m = 0; m < t.walls.length; m++) {
      var wm = t.walls[m];
      ctx.moveTo(wm.a.x, wm.a.y);
      ctx.lineTo(wm.b.x, wm.b.y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(t.arc.cx, t.arc.cy, t.arc.r, Math.PI, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** 台面内部导流墙：实心金属导轨（胶囊） */
  function drawBars(t) {
    if (!t.bars.length) return;
    var th = t.theme;
    var m = PB.Motifs.of(t);
    ctx.save();
    ctx.lineCap = 'round';

    var i, s;
    // 深色底座
    ctx.strokeStyle = th.wallSlab;
    ctx.lineWidth = 2 * t.bars[0].half + 9;
    ctx.beginPath();
    for (i = 0; i < t.bars.length; i++) {
      s = t.bars[i];
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();

    // 金属导轨体
    ctx.lineWidth = 2 * t.bars[0].half + 3;
    ctx.strokeStyle = 'rgba(126,148,172,0.46)';
    ctx.beginPath();
    for (i = 0; i < t.bars.length; i++) {
      s = t.bars[i];
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();

    // 导轨暗面，做出圆柱感
    ctx.lineWidth = 2 * t.bars[0].half - 3;
    ctx.strokeStyle = 'rgba(8,12,18,0.55)';
    ctx.beginPath();
    for (i = 0; i < t.bars.length; i++) {
      s = t.bars[i];
      ctx.moveTo(s.a.x, s.a.y + 2.2);
      ctx.lineTo(s.b.x, s.b.y + 2.2);
    }
    ctx.stroke();

    // 霓虹描边
    ctx.shadowColor = U.rgba(th.wall, 0.9);
    ctx.shadowBlur = 12;
    ctx.strokeStyle = U.rgba(th.wall, 0.72);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (i = 0; i < t.bars.length; i++) {
      s = t.bars[i];
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
    }
    ctx.stroke();

    // 顶面高光
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (i = 0; i < t.bars.length; i++) {
      s = t.bars[i];
      ctx.moveTo(s.a.x, s.a.y - 1.6);
      ctx.lineTo(s.b.x, s.b.y - 1.6);
    }
    ctx.stroke();
    ctx.restore();

    // 母题细节：车线凹槽 + 柱帽（只给需要它的台面实现）
    if (m.barDetail) {
      for (i = 0; i < t.bars.length; i++) m.barDetail(ctx, t.bars[i], t);
    }
  }

  /* ==================================================== 母题层（图形语言） */

  /** 台面上的"活眼"：雷达扫掠 / 柱廊走光 / 约束场扫描 —— 每帧只几条描边 */
  function drawMotifFloor(t) {
    var m = PB.Motifs.of(t);
    if (m.floor) m.floor(ctx, t, performance.now());
  }

  /** 刻在墙板上的细节：量规刻度 / 檐口齿饰 / 装甲接缝 */
  function drawMotifWalls(t) {
    var m = PB.Motifs.of(t);
    if (m.walls) m.walls(ctx, t, performance.now());
  }

  /* ================================================================ 元件 */

  /** 目标灯：形状语言完全交给台面母题（表盘 / 宝石 / 晶胞） */
  function drawTargets(t) {
    var m = PB.Motifs.of(t);
    for (var i = 0; i < t.targets.length; i++) m.target(ctx, t.targets[i], t, i);
  }

  /** 钉子：同上，半球 / 铆钉 / 六角螺母 */
  function drawPegs(t) {
    var m = PB.Motifs.of(t);
    for (var i = 0; i < t.pegs.length; i++) m.peg(ctx, t.pegs[i], t);
  }

  function drawBumpers(t) {
    var th = t.theme;
    var m = PB.Motifs.of(t);
    var now = performance.now();
    for (var i = 0; i < t.bumpers.length; i++) {
      var o = t.bumpers[i];
      var p = o.pulse;
      var r = o.r * (1 + p * 0.18);

      // 外光晕
      var halo = ctx.createRadialGradient(o.x, o.y, r * 0.2, o.x, o.y, r * 2.4);
      halo.addColorStop(0, U.rgba(th.bumper, 0.28 + p * 0.5));
      halo.addColorStop(1, U.rgba(th.bumper, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(o.x, o.y, r * 2.4, 0, TAU);
      ctx.fill();

      // 落到台面的投影
      ctx.beginPath();
      ctx.ellipse(o.x + 2, o.y + r * 0.55, r * 0.95, r * 0.55, 0, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fill();

      // 玻璃罩本体
      var g = ctx.createRadialGradient(o.x - r * 0.34, o.y - r * 0.42, r * 0.08, o.x, o.y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.96)');
      g.addColorStop(0.34, U.rgba(th.bumper, 0.92));
      g.addColorStop(0.72, U.rgba(th.bumper, 0.35));
      g.addColorStop(1, th.bumperDeep);

      ctx.save();
      ctx.shadowColor = U.rgba(th.bumper, 0.9);
      ctx.shadowBlur = 14 + p * 30;
      ctx.beginPath();
      ctx.arc(o.x, o.y, r, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();

      // 金属压环
      ctx.beginPath();
      ctx.arc(o.x, o.y, r, 0, TAU);
      ctx.lineWidth = 3 + p * 2;
      var ring = ctx.createLinearGradient(o.x - r, o.y - r, o.x + r, o.y + r);
      ring.addColorStop(0, 'rgba(255,255,255,0.95)');
      ring.addColorStop(0.5, U.rgba(th.bumper, 0.55));
      ring.addColorStop(1, 'rgba(255,255,255,0.55)');
      ctx.strokeStyle = ring;
      ctx.stroke();

      // 右下方暗面：让玻璃罩有球体体积感
      ctx.save();
      ctx.beginPath();
      ctx.arc(o.x, o.y, r, 0, TAU);
      ctx.clip();
      var sh = ctx.createRadialGradient(o.x + r * 0.44, o.y + r * 0.5, r * 0.08, o.x + r * 0.44, o.y + r * 0.5, r * 1.2);
      sh.addColorStop(0, 'rgba(0,0,0,0.4)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(o.x - r, o.y - r, r * 2, r * 2);
      ctx.restore();

      // 内环
      ctx.beginPath();
      ctx.arc(o.x, o.y, r * 0.66, 0, TAU);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.22 + p * 0.5) + ')';
      ctx.stroke();

      // 灯芯
      ctx.beginPath();
      ctx.arc(o.x, o.y, r * 0.34, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,' + (0.55 + p * 0.45) + ')';
      ctx.fill();

      // 玻璃高光弧
      ctx.beginPath();
      ctx.arc(o.x, o.y, r * 0.82, Math.PI * 1.03, Math.PI * 1.55);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.45 + p * 0.4) + ')';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // 压环的母题语言：靶环 / 六角螺母 / 涡流
      m.bumperBezel(ctx, o, r, t, p, now);
    }
  }

  function drawSlings(t) {
    var th = t.theme;
    for (var i = 0; i < t.slings.length; i++) {
      var s = t.slings[i];
      var f = s.flash;

      // 三角撞块实体
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.lineTo(s.c.x, s.c.y);
      ctx.closePath();
      var g = ctx.createLinearGradient(s.a.x, s.a.y, s.c.x, s.c.y);
      g.addColorStop(0, f > 0 ? U.rgba(th.sling, 0.6) : 'rgba(30,52,60,0.96)');
      g.addColorStop(1, f > 0 ? U.rgba(th.sling, 0.25) : 'rgba(10,20,28,0.97)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = U.rgba(th.sling, 0.28 + f * 0.5);
      ctx.stroke();

      // 发光斜边（碰撞面）
      ctx.save();
      ctx.lineCap = 'round';
      ctx.shadowColor = th.sling;
      ctx.shadowBlur = 12 + f * 26;
      ctx.strokeStyle = U.rgba(th.sling, 0.78 + f * 0.22);
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.stroke();
      ctx.restore();

      // 面内拉丝
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(s.a.x, s.a.y);
      ctx.lineTo(s.b.x, s.b.y);
      ctx.lineTo(s.c.x, s.c.y);
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (var k = -30; k < 70; k += 5) {
        ctx.beginPath();
        ctx.moveTo(s.a.x + k, s.a.y);
        ctx.lineTo(s.a.x + k + 60, s.a.y + 60);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** 弧形轨道：深色底槽 + 双导轨 + 流动箭头 + 进出口喇叭 */
  function drawOrbit(t) {
    var orbit = t.orbit;
    if (!orbit) return;
    var th = t.theme;
    var f = orbit.flash;
    var now = performance.now();
    var m = PB.Motifs.of(t);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 底槽
    ctx.beginPath();
    for (var i = 0; i < orbit.pts.length; i++) {
      var p = orbit.pts[i];
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(6,14,26,0.86)';
    ctx.lineWidth = 20;
    ctx.stroke();
    ctx.strokeStyle = U.rgba(th.orbit, 0.06);
    ctx.lineWidth = 12;
    ctx.stroke();

    // 内外两条导轨
    for (var k = 0; k < 2; k++) {
      var rr = orbit.r + (k === 0 ? -10 : 10);
      ctx.beginPath();
      ctx.arc(orbit.cx, orbit.cy, rr, orbit.a0, orbit.a1, true);
      ctx.strokeStyle = U.rgba(th.orbit, 0.26 + f * 0.45);
      ctx.shadowColor = U.rgba(th.orbit, 0.95);
      ctx.shadowBlur = 9 + f * 22;
      ctx.lineWidth = k === 0 ? 2.2 : 1.4;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // 行进方向标记：语法交给母题（箭头 / 双层箭头 / 径向栅格）
    m.orbitMarks(ctx, orbit, t, f, now);

    // 进出口喇叭
    var pulse = 0.55 + 0.45 * Math.sin(now / 330);
    for (var e = 0; e < 2; e++) {
      var isEntry = e === 0;
      var ep = isEntry ? orbit.entry : orbit.exit;
      var tg = PB.Tables.orbitAt(orbit, isEntry ? 0 : 1);
      var flip = isEntry ? 1 : -1;

      ctx.save();
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, 21, 0, TAU);
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = now / 90;
      ctx.strokeStyle = U.rgba(th.orbitWarm, 0.18 + pulse * 0.24);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.save();
      ctx.translate(ep.x, ep.y);
      ctx.rotate(Math.atan2(tg.ty, tg.tx));
      ctx.scale(flip, 1);
      ctx.beginPath();
      ctx.moveTo(-9, -18);
      ctx.lineTo(5, -9);
      ctx.lineTo(5, 9);
      ctx.lineTo(-9, 18);
      ctx.closePath();
      ctx.fillStyle = 'rgba(4,8,16,0.92)';
      ctx.fill();
      ctx.strokeStyle = U.rgba(th.orbitWarm, 0.42 + pulse * 0.42);
      ctx.shadowColor = U.rgba(th.orbitWarm, 0.95);
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(ep.x, ep.y, 3.6 + pulse * 1.4, 0, TAU);
      ctx.fillStyle = U.rgba('#fff2cf', 0.4 + pulse * 0.45);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /** 挡板：拉丝金属 + 橡胶边 + 霓虹辉光 */
  function drawFlippers(t) {
    var list = [t.flippers.left, t.flippers.right];
    for (var i = 0; i < list.length; i++) {
      var fl = list[i];
      var tip = fl.tip();
      var color = fl.side === 1 ? t.theme.flipperL : t.theme.flipperR;
      var glow = fl.glow;
      var ang = fl.angle;
      var nx = Math.cos(ang + Math.PI / 2);
      var ny = Math.sin(ang + Math.PI / 2);
      var th2 = fl.thick;

      // 霓虹底光
      ctx.save();
      ctx.lineCap = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = 16 + glow * 26;
      ctx.strokeStyle = U.rgba(color, 0.35 + glow * 0.45);
      ctx.lineWidth = th2 * 2 + 3;
      ctx.beginPath();
      ctx.moveTo(fl.pivot.x, fl.pivot.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.restore();

      // 金属主体：沿法线方向的明暗渐变形成圆柱感
      var g = ctx.createLinearGradient(
        fl.pivot.x - nx * th2, fl.pivot.y - ny * th2,
        fl.pivot.x + nx * th2, fl.pivot.y + ny * th2
      );
      g.addColorStop(0, 'rgba(255,255,255,0.92)');
      g.addColorStop(0.28, color);
      g.addColorStop(0.62, U.darken(color, 0.42));
      g.addColorStop(1, 'rgba(6,10,16,0.98)');

      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = g;
      ctx.lineWidth = th2 * 2 - 0.5;
      ctx.beginPath();
      ctx.moveTo(fl.pivot.x, fl.pivot.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.restore();

      // 顶缘高光条
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.34 + glow * 0.3) + ')';
      ctx.lineWidth = th2 * 0.34;
      ctx.beginPath();
      ctx.moveTo(fl.pivot.x - nx * th2 * 0.42, fl.pivot.y - ny * th2 * 0.42);
      ctx.lineTo(tip.x - nx * th2 * 0.42, tip.y - ny * th2 * 0.42);
      ctx.stroke();
      ctx.restore();

      // 轴心：金属盖子 + 螺丝槽
      var pg = ctx.createRadialGradient(fl.pivot.x - 1.4, fl.pivot.y - 1.6, 0.4, fl.pivot.x, fl.pivot.y, 6.4);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(0.55, 'rgba(190,210,230,0.95)');
      pg.addColorStop(1, 'rgba(40,55,72,0.98)');
      ctx.beginPath();
      ctx.arc(fl.pivot.x, fl.pivot.y, 6.2, 0, TAU);
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(8,14,22,0.9)';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fl.pivot.x - 2.4, fl.pivot.y);
      ctx.lineTo(fl.pivot.x + 2.4, fl.pivot.y);
      ctx.strokeStyle = 'rgba(60,80,100,0.8)';
      ctx.stroke();
    }
  }

  /* ================================================================== 球 */

  function drawOneBall(b, t) {
    var th = t.theme;

    // 拖尾
    for (var i = 0; i < b.trail.length; i++) {
      var p = b.trail[i];
      var k = i / b.trail.length;
      ctx.beginPath();
      ctx.arc(p.x, p.y, b.r * (0.35 + 0.55 * k), 0, TAU);
      ctx.fillStyle = U.rgba(th.trail, 0.045 + 0.22 * k);
      ctx.fill();
    }

    // 轨道上的球多一层暖色光晕，暗示"高架通过"
    if (b.rail) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 7, 0, TAU);
      ctx.fillStyle = U.rgba(th.orbitWarm, 0.16);
      ctx.fill();
    }

    // 接触阴影：让球"贴"在台面上，而不是浮着
    var sg = ctx.createRadialGradient(b.x + 2.4, b.y + 3.6, 0.5, b.x + 2.4, b.y + 3.6, b.r * 1.9);
    sg.addColorStop(0, 'rgba(0,0,0,0.55)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(b.x + 2.4, b.y + 3.6, b.r * 1.9, 0, TAU);
    ctx.fillStyle = sg;
    ctx.fill();

    // 镀铬球体
    ctx.save();
    ctx.shadowColor = b.rail ? th.orbitWarm : th.ball;
    ctx.shadowBlur = b.rail ? 30 : 24;
    var g = ctx.createRadialGradient(b.x - b.r * 0.34, b.y - b.r * 0.42, b.r * 0.08, b.x, b.y, b.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.32, '#f2fdff');
    g.addColorStop(0.62, U.rgba(th.ball, 0.95));
    g.addColorStop(0.88, U.darken(th.ball, 0.5));
    g.addColorStop(1, 'rgba(10,26,36,0.98)');
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    // 边缘反射光
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 0.7, Math.PI * 0.12, Math.PI * 0.72);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // 极细的亮边，把球从深色台面上"拎"出来
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r - 0.5, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // 镜面高光
    ctx.beginPath();
    ctx.ellipse(b.x - b.r * 0.32, b.y - b.r * 0.42, b.r * 0.3, b.r * 0.22, -0.6, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();

    // 高速时的动态高光（沿速度反方向拖一小段）
    var sp = Math.hypot(b.vx, b.vy);
    if (sp > 380) {
      var k2 = Math.min(1, (sp - 380) / 700);
      ctx.beginPath();
      ctx.arc(b.x + b.vx / sp * b.r * 0.28, b.y + b.vy / sp * b.r * 0.28, b.r * 0.5, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,' + 0.10 * k2 + ')';
      ctx.fill();
    }
  }

  function drawBalls(t) {
    var st = PB.state;
    for (var i = 0; i < st.balls.length; i++) drawOneBall(st.balls[i], t);
  }

  /* ============================================================ 特效层 */

  function drawParticles(st) {
    var ps = st.particles;
    if (!ps.length) return;

    ctx.lineCap = 'round';
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      var a = U.clamp(p.life / p.max, 0, 1);

      ctx.strokeStyle = a > 0.72 ? '#ffffff' : p.color;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.globalAlpha = a;

      var sp = Math.hypot(p.vx, p.vy);
      if (sp < 26) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.55, 0, TAU);
        ctx.fill();
        continue;
      }

      var len = Math.min(sp * 0.026, 16);
      var tx = p.x - (p.vx / sp) * len;
      var ty = p.y - (p.vy / sp) * len;
      ctx.lineWidth = p.r * 0.8 * (0.45 + a * 0.55);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  function drawRings(st) {
    var rs = st.rings;
    if (!rs.length) return;
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      var k = 1 - r.life / r.max;
      var e = U.easeOut(k);
      var rad = r.r0 + (r.r1 - r.r0) * e;
      var a = (1 - k) * (1 - k);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - k * 0.7);
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts(st) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < st.texts.length; i++) {
      var tx = st.texts[i];
      var a = U.clamp(tx.life / tx.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = '700 ' + (tx.size || 16) + 'px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = tx.color;
      ctx.shadowColor = tx.color;
      ctx.shadowBlur = 12;
      ctx.fillText(tx.text, tx.x, tx.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /** 一层极淡的玻璃反光，统一整块台面的"表面材质"观感 */
  function drawGlass() {
    var g = ctx.createLinearGradient(0, 0, W * 0.85, H * 0.55);
    g.addColorStop(0, 'rgba(255,255,255,0.045)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.012)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* ============================================================ 辅助 UI */

  /** 发射前的瞄准线 + 力度环 */
  function drawAim(t) {
    var st = PB.state;
    var b = st.balls[0];
    if (!b || !b.ready) return;
    var p = st.power;
    var a = t.launchAngle;
    var len = 70 + p * 170;
    var th = t.theme;

    ctx.save();
    ctx.setLineDash([9, 9]);
    ctx.lineDashOffset = -performance.now() / 40;
    ctx.strokeStyle = U.rgba(th.hint, 0.3 + p * 0.55);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x + Math.cos(a) * (b.r + 4), b.y + Math.sin(a) * (b.r + 4));
    ctx.lineTo(b.x + Math.cos(a) * len, b.y + Math.sin(a) * len);
    ctx.stroke();
    ctx.restore();

    var RR = b.r + 13;
    ctx.beginPath();
    ctx.arc(b.x, b.y, RR, 0, TAU);
    ctx.strokeStyle = 'rgba(120,160,210,0.26)';
    ctx.lineWidth = 4;
    ctx.stroke();

    if (p > 0.001) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, RR, -Math.PI / 2, -Math.PI / 2 + TAU * p);
      ctx.strokeStyle = p > 0.985 ? th.orbitWarm : th.hint;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineCap = 'butt';
    }
  }

  function drawHints(t) {
    var st = PB.state;
    if (st.phase === 'READY') {
      var l1 = '按住 空格 / 发射 键蓄力 · 松开发射';
      var l2 = '点亮全部目标灯 +' + t.cfg.targetScore + ' · 走完环形轨道触发多球';
      var FONT = 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = '600 13px ' + FONT;
      var w1 = ctx.measureText(l1).width;
      ctx.font = '600 11px ' + FONT;
      var w2 = ctx.measureText(l2).width;
      var w = Math.max(w1, w2) + 26;

      U.roundRect(ctx, W / 2 - w / 2, 626, w, 50, 12);
      ctx.fillStyle = 'rgba(4,8,16,0.62)';
      ctx.fill();

      ctx.font = '600 13px ' + FONT;
      ctx.fillStyle = 'rgba(180,215,255,0.95)';
      ctx.fillText(l1, W / 2, 641);
      ctx.font = '600 11px ' + FONT;
      ctx.fillStyle = U.rgba(t.theme.orbitWarm, 0.8);
      ctx.fillText(l2, W / 2, 662);
    } else if (st.phase === 'PLAYING' && !st.balls.length) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 15px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(150,195,245,0.6)';
      ctx.fillText('准备中…', W / 2, 400);
    }
  }

  /* ================================================================ 主渲染 */

  R.render = function () {
    var st = PB.state;
    var t = PB.table;
    if (!ctx || !t) return;

    ctx.setTransform(view.sx, 0, 0, view.sy, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();

    // 镜头推近：焦点固定在弧心。只放大不缩小
    var cam = PB.cam;
    if (cam.zoom > 1.0005) {
      ctx.translate(cam.px, cam.py);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cam.px, -cam.py);
    }

    // 震屏放在缩放之后，用屏幕像素位移，避免被缩放一起放大
    if (st.shake > 0.2) {
      ctx.translate(U.rand(-st.shake, st.shake) * 0.6, U.rand(-st.shake, st.shake) * 0.6);
    }

    drawSurface();
    drawDrainZone(t);
    drawCorners(t);
    drawMotifFloor(t);
    drawWalls(t);
    drawMotifWalls(t);
    drawTargets(t);
    drawPegs(t);
    drawBumpers(t);
    drawOrbit(t);
    drawBars(t);
    drawSlings(t);
    drawFlippers(t);
    if (st.phase === 'READY') drawAim(t);
    drawBalls(t);
    drawParticles(st);
    drawRings(st);
    drawGlass();
    drawTexts(st);
    drawHints(t);

    ctx.restore();
  };

  PB.renderer = R;
})();
