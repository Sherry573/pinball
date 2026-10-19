/* =============================================================================
 * physics.js — 碰撞求解与物理主循环
 *   圆-线段（半平面 / 胶囊）· 圆-圆弧 · 圆-圆 · 圆-挡板胶囊 · 圆-三角撞块
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;
  var U = PB.util;
  var S = PB.Sound;
  var FX = PB.fx;
  var TAU = U.TAU;

  var P = {};

  /* ---------------------------------------------------------------- 碰撞 */

  /** 圆 vs 外壳墙（半平面，球永远不会跑到背面） */
  function collideWalls(b, T) {
    var walls = T.walls;
    var cfg = T.cfg;
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var n = w.n;
      var d = (b.x - w.a.x) * n.x + (b.y - w.a.y) * n.y;
      if (d >= b.r) continue;

      var t = ((b.x - w.a.x) * (w.b.x - w.a.x) + (b.y - w.a.y) * (w.b.y - w.a.y)) / w.len2;
      if (t < -0.02 || t > 1.02) continue;

      b.x += n.x * (b.r - d);
      b.y += n.y * (b.r - d);

      var vn = b.vx * n.x + b.vy * n.y;
      if (vn < 0) {
        var impact = -vn;
        var e = impact < 60 ? 0.15 : cfg.wallRestitution;
        var tx = -n.y;
        var ty = n.x;
        var vt = b.vx * tx + b.vy * ty;
        b.vx -= (1 + e) * vn * n.x;
        b.vy -= (1 + e) * vn * n.y;
        // 摩擦按冲击强度缩放，避免球沿斜坡"匍匐"
        var fr = cfg.wallFriction * Math.min(1, impact / 110);
        b.vx -= vt * tx * fr;
        b.vy -= vt * ty * fr;
        if (impact > 320) S.wall();
      }
    }
  }

  /** 圆 vs 台面内部导流墙（实心胶囊，两面都实心，可以绕过去） */
  function collideBars(b, T) {
    var bars = T.bars;
    if (!bars.length) return;
    var cfg = T.cfg;
    for (var i = 0; i < bars.length; i++) {
      var s = bars[i];
      var abx = s.b.x - s.a.x;
      var aby = s.b.y - s.a.y;
      var len2 = abx * abx + aby * aby || 1;
      var t = U.clamp(((b.x - s.a.x) * abx + (b.y - s.a.y) * aby) / len2, 0, 1);
      var cx = s.a.x + abx * t;
      var cy = s.a.y + aby * t;

      var dx = b.x - cx;
      var dy = b.y - cy;
      var d = Math.hypot(dx, dy);
      var minD = b.r + s.half;
      if (d >= minD) continue;
      if (d < 0.0001) { dx = 0; dy = -1; d = 1; }

      var nx = dx / d;
      var ny = dy / d;
      b.x = cx + nx * minD;
      b.y = cy + ny * minD;

      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        var impact = -vn;
        var e = impact < 60 ? 0.18 : cfg.wallRestitution;
        b.vx -= (1 + e) * vn * nx;
        b.vy -= (1 + e) * vn * ny;
        if (impact > 300) S.wall();
      }
    }
  }

  /** 圆 vs 顶部弧形墙（球被约束在圆内） */
  function collideArc(b, T) {
    var arc = T.arc;
    if (b.y > arc.cy) return;
    var dx = b.x - arc.cx;
    var dy = b.y - arc.cy;
    var d = Math.hypot(dx, dy);
    if (d === 0) return;
    var maxD = arc.r - b.r;
    if (d <= maxD) return;

    var nx = -dx / d;
    var ny = -dy / d;
    b.x = arc.cx + (dx / d) * maxD;
    b.y = arc.cy + (dy / d) * maxD;

    var vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      var impact = -vn;
      var e = impact < 60 ? 0.15 : T.cfg.wallRestitution;
      b.vx -= (1 + e) * vn * nx;
      b.vy -= (1 + e) * vn * ny;
      if (impact > 320) S.wall();
    }
  }

  /** 圆 vs 缓冲器（加分 + 额外冲量 + 脉冲特效） */
  function collideBumpers(b, T) {
    var list = T.bumpers;
    var cfg = T.cfg;
    var th = T.theme;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var dx = b.x - o.x;
      var dy = b.y - o.y;
      var minD = b.r + o.r;
      var d2 = dx * dx + dy * dy;
      if (d2 > minD * minD || d2 === 0) continue;

      var d = Math.sqrt(d2);
      var nx = dx / d;
      var ny = dy / d;
      b.x = o.x + nx * minD;
      b.y = o.y + ny * minD;

      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= (1 + cfg.bumperRestitution) * vn * nx;
        b.vy -= (1 + cfg.bumperRestitution) * vn * ny;
      }
      b.vx += nx * cfg.bumperKick;
      b.vy += ny * cfg.bumperKick;
      U.limitSpeed(b, cfg.maxSpeed);

      if (o.cool <= 0) {
        o.cool = 0.09;
        o.pulse = 1;
        FX.addScore(cfg.bumperScore, o.x, o.y - o.r - 12, th.bumper);
        FX.burst(b.x, b.y, th.bumper, 14, 340);
        S.bumper();
        FX.shake(5);
        FX.punchZoom(1.018);
        FX.ring(o.x, o.y, th.bumper, o.r * 0.55, o.r * 2.5, 0.30, 2.5);
        FX.registerCombo(b.x, b.y);
      }
    }
  }

  /** 圆 vs 小钉子 */
  function collidePegs(b, T) {
    var list = T.pegs;
    var cfg = T.cfg;
    var th = T.theme;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var dx = b.x - o.x;
      var dy = b.y - o.y;
      var minD = b.r + o.r;
      var d2 = dx * dx + dy * dy;
      if (d2 > minD * minD || d2 === 0) continue;

      var d = Math.sqrt(d2);
      var nx = dx / d;
      var ny = dy / d;
      b.x = o.x + nx * minD;
      b.y = o.y + ny * minD;

      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        var impact = -vn;
        var e = impact < 45 ? 0.05 : cfg.pegRestitution;
        b.vx -= (1 + e) * vn * nx;
        b.vy -= (1 + e) * vn * ny;
        b.vx += nx * cfg.pegKick;
        b.vy += ny * cfg.pegKick;
        U.limitSpeed(b, cfg.maxSpeed);
      }

      if (o.cool <= 0) {
        o.cool = 0.07;
        o.flash = 1;
        FX.addScore(cfg.pegScore, o.x, o.y - 16, th.hint);
        FX.burst(b.x, b.y, th.hint, 5, 160);
        S.peg();
        FX.registerCombo(b.x, b.y);
      }
    }
  }

  /** 圆 vs 目标灯（全部点亮 +500 并重置） */
  function collideTargets(b, T) {
    var list = T.targets;
    var cfg = T.cfg;
    var th = T.theme;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var dx = b.x - o.x;
      var dy = b.y - o.y;
      var minD = b.r + o.r;
      var d2 = dx * dx + dy * dy;
      if (d2 > minD * minD || d2 === 0) continue;

      var d = Math.sqrt(d2);
      var nx = dx / d;
      var ny = dy / d;
      b.x = o.x + nx * minD;
      b.y = o.y + ny * minD;

      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        var e = -vn < 50 ? 0.05 : cfg.targetRestitution;
        b.vx -= (1 + e) * vn * nx;
        b.vy -= (1 + e) * vn * ny;
      }

      if (!o.lit && o.cool <= 0) {
        o.lit = true;
        o.cool = 0.6;
        o.flash = 1;
        S.target();
        FX.burst(o.x, o.y, th.target, 16, 260);
        FX.shake(4);
        FX.punchZoom(1.022);
        FX.ring(o.x, o.y, th.target, o.r * 0.6, o.r * 2.8, 0.32, 2);
        FX.text(o.x, o.y - 28, '点亮', th.target, 15);

        var all = true;
        for (var k = 0; k < list.length; k++) if (!list[k].lit) all = false;
        if (all) {
          for (var m = 0; m < list.length; m++) {
            list[m].lit = false;
            list[m].cool = 0.9;
          }
          var st = PB.state;
          st.targetFlash = 1;
          st.targetCount += 1;
          FX.addScore(cfg.targetScore, 240, 300, th.bumper);
          FX.text(240, 256, '全部点亮 +' + cfg.targetScore, th.bumper, 22, 1.7);
          FX.burst(240, 300, th.bumper, 44, 430);
          S.bonus();
          FX.shake(11);
          FX.hitstop(cfg.hitstopTarget);
          FX.punchZoom(1.04);
          FX.slowmo(0.5, 0.18);
          FX.ring(240, 300, th.bumper, 26, 215, 0.52, 4);
          FX.ring(240, 300, '#fff6d0', 14, 132, 0.36, 1.8);
        }
      }
    }
  }

  /** 圆 vs 弹弓斜边（静态胶囊 + 强力弹开） */
  function collideSlings(b, T) {
    var list = T.slings;
    var cfg = T.cfg;
    var th = T.theme;
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var abx = s.b.x - s.a.x;
      var aby = s.b.y - s.a.y;
      var len2 = abx * abx + aby * aby;
      var t = U.clamp(((b.x - s.a.x) * abx + (b.y - s.a.y) * aby) / len2, 0, 1);
      var cx = s.a.x + abx * t;
      var cy = s.a.y + aby * t;

      var dx = b.x - cx;
      var dy = b.y - cy;
      var d = Math.hypot(dx, dy);
      var minD = b.r + 7;
      if (d >= minD) continue;
      if (d < 0.0001) { dx = 0; dy = -1; d = 1; }

      var nx = dx / d;
      var ny = dy / d;
      b.x = cx + nx * minD;
      b.y = cy + ny * minD;

      var vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= (1 + 0.55) * vn * nx;
        b.vy -= (1 + 0.55) * vn * ny;
      }
      b.vx += nx * 430;
      b.vy += ny * 430;
      U.limitSpeed(b, cfg.maxSpeed);

      if (s.flash <= 0) {
        s.flash = 1;
        S.sling();
        FX.burst(cx, cy, th.sling, 9, 240);
        FX.shake(3);
        FX.punchZoom(1.012);
        FX.ring(cx, cy, th.sling, 8, 48, 0.24, 2);
      }
    }
  }

  /**
   * 圆 vs 挡板胶囊
   * 关键：接触点相对轴心的线速度 v = ω × r 参与反弹，形成"弹射"
   */
  function collideFlipper(b, fl, T) {
    var ax = fl.pivot.x;
    var ay = fl.pivot.y;
    var tip = fl.tip();
    var abx = tip.x - ax;
    var aby = tip.y - ay;

    var t = U.clamp(((b.x - ax) * abx + (b.y - ay) * aby) / (fl.len * fl.len), 0, 1);
    var cx = ax + abx * t;
    var cy = ay + aby * t;

    var dx = b.x - cx;
    var dy = b.y - cy;
    var d = Math.hypot(dx, dy);
    var minD = b.r + fl.thick;
    if (d >= minD) return;
    if (d < 0.0001) { dx = 0; dy = -1; d = 1; }

    var nx = dx / d;
    var ny = dy / d;
    b.x = cx + nx * minD;
    b.y = cy + ny * minD;

    // 接触点线速度（刚体绕轴旋转）
    var rx = cx - ax;
    var ry = cy - ay;
    var svx = -fl.omega * ry;
    var svy = fl.omega * rx;

    var rvx = b.vx - svx;
    var rvy = b.vy - svy;
    var vn = rvx * nx + rvy * ny;

    if (vn < 0) {
      var impact = -vn;
      var cfg = T.cfg;
      var e = impact < 45 ? 0.02 : cfg.flipperRestitution;
      var tx = -ny;
      var ty = nx;
      var vt = rvx * tx + rvy * ty;
      var fr = cfg.flipperFriction * Math.min(1, impact / 110);

      var nvx = rvx - (1 + e) * vn * nx;
      var nvy = rvy - (1 + e) * vn * ny;

      b.vx = nvx - vt * tx * fr + svx;
      b.vy = nvy - vt * ty * fr + svy;
      U.limitSpeed(b, cfg.maxSpeed);

      var col = fl.side === 1 ? T.theme.flipperL : T.theme.flipperR;
      if (impact > 200) FX.burst(b.x, b.y, col, 6, 180);
      if (impact > 330 && fl.glow > 0.55) {
        FX.punchZoom(1.012);
        FX.ring(b.x, b.y, col, 7, 42, 0.22, 2);
      }
    }
  }

  /**
   * 防卡死（基于"位移"而不是"速度"判断）
   * 球被楔在挡板 / 墙角时速度可能有几十 px/s 的抖动，用速度阈值会漏掉。
   */
  function antiStuck(b, T, h) {
    b.stuckTime += h;
    if (b.stuckTime < T.cfg.stuckWindow) return;

    var moved = Math.hypot(b.x - b.stuckRefX, b.y - b.stuckRefY);
    b.stuckTime = 0;
    b.stuckRefX = b.x;
    b.stuckRefY = b.y;

    if (moved >= T.cfg.stuckMove) {
      b.stuckCount = 0;
      return;
    }

    b.stuckCount += 1;

    if (b.stuckCount >= T.cfg.stuckLimit) {
      b.stuckCount = 0;
      b.x = T.center.x + U.rand(-40, 40);
      b.y = 610;
      b.vx = U.rand(-90, 90);
      b.vy = 80;
      FX.burst(b.x, b.y, T.theme.hint, 14, 220);
      return;
    }

    var dx = T.center.x - b.x;
    var dy = T.center.y - b.y;
    var d = Math.hypot(dx, dy) || 1;
    var ang = Math.atan2(dy / d, dx / d) + U.rand(-0.45, 0.45);
    b.vx = Math.cos(ang) * T.cfg.antiStuckKick;
    b.vy = Math.sin(ang) * T.cfg.antiStuckKick;
    FX.burst(b.x, b.y, T.theme.hint, 10, 200);
  }

  /* ---------------------------------------------------------------- 轨道 */

  /** 尝试让球"飞进"轨道入口：在喇叭口内 + 速度够 + 方向顺着轨道 */
  function tryEnterOrbit(b, T) {
    var orbit = T.orbit;
    if (!orbit || b.rail || b.ready) return false;
    var cfg = T.cfg;
    var e = orbit.entry;
    var dx = b.x - e.x;
    var dy = b.y - e.y;
    if (dx * dx + dy * dy > cfg.orbitGate * cfg.orbitGate) return false;

    var sp = Math.hypot(b.vx, b.vy);
    if (sp < cfg.orbitCaptureSpeed) return false;

    var tg = PB.Tables.orbitAt(orbit, 0);
    if ((b.vx * tg.tx + b.vy * tg.ty) / sp < cfg.orbitGateDot) return false;

    var t0 = Math.min(PB.Tables.orbitProject(orbit, b.x, b.y), 0.08);
    var p = PB.Tables.orbitAt(orbit, t0);

    b.rail = {
      t: t0,
      speed: U.clamp(sp * 0.85, cfg.orbitMinSpeed, cfg.orbitMaxSpeed),
      node: Math.floor(t0 * cfg.orbitPoints)
    };
    b.x = p.x;
    b.y = p.y;
    b.vx = p.tx * b.rail.speed;
    b.vy = p.ty * b.rail.speed;
    b.stuckRefX = b.x;
    b.stuckRefY = b.y;
    b.stuckTime = 0;

    orbit.flash = 1;
    S.orbitIn();
    FX.burst(p.x, p.y, T.theme.orbitWarm, 10, 210);
    FX.slowmo(cfg.slowOrbitIn, cfg.slowOrbitInHold);
    FX.punchZoom(1.02);
    FX.ring(p.x, p.y, T.theme.orbitWarm, 10, 62, 0.28, 2);
    FX.text(p.x - 30, p.y + 10, '进入轨道', T.theme.orbitWarm, 13);
    return true;
  }

  /** 轨道上的球：位置完全由参数 t 决定，每跨过一个计分点加一次分 */
  function stepOrbit(b, dt, T) {
    var orbit = T.orbit;
    var cfg = T.cfg;
    var r = b.rail;
    r.t += (r.speed * dt) / orbit.total;

    var node = Math.min(cfg.orbitPoints, Math.floor(r.t * cfg.orbitPoints));
    while (r.node < node) {
      r.node += 1;
      var np = PB.Tables.orbitAt(orbit, r.node / cfg.orbitPoints);
      FX.addScore(cfg.orbitScore, np.x, np.y, T.theme.orbitWarm);
      S.orbitStep();
      FX.burst(np.x, np.y, T.theme.orbitWarm, 3, 90);
    }

    if (r.t >= 1) { releaseOrbit(b, T); return; }

    var p = PB.Tables.orbitAt(orbit, r.t);
    b.x = p.x;
    b.y = p.y;
    b.vx = p.tx * r.speed;
    b.vy = p.ty * r.speed;
  }

  /** 出轨道：沿末端切向甩出，并结算奖励 */
  function releaseOrbit(b, T) {
    var orbit = T.orbit;
    var cfg = T.cfg;
    var th = T.theme;
    var p = PB.Tables.orbitAt(orbit, 1);
    b.rail = null;
    b.x = p.x;
    b.y = p.y;

    var sp = cfg.orbitSpeed * 0.62;
    b.vx = p.tx * sp;
    b.vy = p.ty * sp;
    b.stuckRefX = b.x;
    b.stuckRefY = b.y;
    b.stuckTime = 0;
    b.stuckCount = 0;

    FX.addScore(cfg.orbitBonus, p.x + 18, p.y - 14, th.orbit);
    PB.state.orbitCount += 1;
    orbit.flash = 1;
    FX.burst(p.x, p.y, th.orbit, 24, 330);
    FX.text(p.x + 44, p.y + 14, '完整轨道', th.orbit, 15, 1.2);
    S.orbitDone();
    FX.shake(5);
    FX.hitstop(cfg.hitstopOrbit);
    FX.punchZoom(1.035);
    FX.slowmo(cfg.slowOrbitOut, cfg.slowOrbitOutHold);
    FX.ring(p.x, p.y, th.orbit, 14, 118, 0.42, 3);

    startMultiball(p, T);
  }

  /** 多球模式：只在单球状态下触发，从出口位置放出额外弹珠 */
  function startMultiball(from, T) {
    var st = PB.state;
    var cfg = T.cfg;
    if (st.multiballCool > 0) return;
    if (st.balls.length !== 1) return;
    var n = Math.min(cfg.multiballExtra, cfg.maxBallsOnField - st.balls.length);
    if (n <= 0) return;

    var base = Math.atan2(from.ty, from.tx);
    var px = -from.ty;
    var py = from.tx;

    for (var i = 0; i < n; i++) {
      var off = (i - (n - 1) / 2) * 34;
      var ang = base + (i - (n - 1) / 2) * 0.24;
      var sp = U.rand(430, 560);
      st.balls.push(PB.makeBall(
        from.x + px * off - from.tx * 10,
        from.y + py * off - from.ty * 10,
        Math.cos(ang) * sp,
        Math.sin(ang) * sp
      ));
    }

    st.multiballCool = cfg.multiballCool;
    st.multiballCount += 1;
    FX.text(240, 214, '多球模式 ×' + st.balls.length, '#ff7bee', 24, 2.0);
    FX.burst(240, 232, '#ff7bee', 30, 380);
    S.multiball();
    FX.shake(13);
    FX.hitstop(cfg.hitstopMulti);
    FX.punchZoom(1.04);
    FX.slowmo(cfg.slowMulti, cfg.slowMultiHold);
    FX.ring(240, 232, '#ff7bee', 18, 268, 0.66, 4);
    FX.ring(240, 232, '#ffd8f6', 10, 150, 0.44, 2);
  }

  /* ------------------------------------------------------------ 主循环 */

  /** 固定步长物理推进；子步长再细分，高速小球也不会穿透 */
  P.simulate = function (step) {
    var T = PB.table;
    var st = PB.state;
    if (!T) return;
    var n = T.cfg.substeps;
    var h = step / n;
    var list = st.balls;

    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      // 轨道上的球不再受重力和碰撞影响，整段步长一次推进
      if (b.rail) { stepOrbit(b, step, T); continue; }

      for (var k = 0; k < n; k++) {
        b.vy += T.cfg.gravity * h;
        var damp = Math.pow(T.cfg.airDrag, h * 60);
        b.vx *= damp;
        b.vy *= damp;
        U.limitSpeed(b, T.cfg.maxSpeed);

        b.x += b.vx * h;
        b.y += b.vy * h;

        collideWalls(b, T);
        collideArc(b, T);
        collideBars(b, T);
        collideBumpers(b, T);
        collidePegs(b, T);
        collideTargets(b, T);
        collideSlings(b, T);
        collideFlipper(b, T.flippers.left, T);
        collideFlipper(b, T.flippers.right, T);

        // 入轨检测放在碰撞之后，避免刚被弹开就被"吸"进轨道
        if (tryEnterOrbit(b, T)) break;
        antiStuck(b, T, h);
      }
    }
  };

  /** 供 UI 预览使用：判断某点是否在轨道附近（渲染轨道高亮用） */
  P.orbitAt = function (t) {
    return PB.table.orbit ? PB.Tables.orbitAt(PB.table.orbit, t) : null;
  };

  PB.physics = P;
})();
