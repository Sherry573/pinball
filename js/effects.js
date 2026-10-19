/* =============================================================================
 * effects.js — 打击感与特效：粒子 / 飘字 / 冲击波 / 镜头 / 慢动作 / 命中停顿
 *   镜头只放大不缩小；命中停顿只冻结物理，不冻结挡板与输入
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;
  var C = PB.CONFIG;
  var U = PB.util;
  var TAU = U.TAU;

  var FX = {};

  /** 镜头状态：只放大不缩小，缩放低于 1 会在画布边缘露出空白 */
  var cam = PB.cam = { zoom: 1, px: C.camPivotX, py: C.camPivotY, shake: 0 };

  /** 慢动作状态：scale 为当前倍率（1 = 正常），want 为目标倍率 */
  var slow = FX.slow = { scale: 1, want: 1, hold: 0 };

  /* ------------------------------------------------------------------ 粒子 */

  FX.burst = function (x, y, color, count, speed) {
    var st = PB.state;
    if (!st || st.particles.length > 420) return;
    for (var i = 0; i < count; i++) {
      var a = Math.random() * TAU;
      var s = U.rand(speed * 0.25, speed);
      var life = U.rand(0.25, 0.62);
      st.particles.push({
        x: x, y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life, max: life,
        color: color,
        r: U.rand(1.4, 3.4)
      });
    }
  };

  /** 冲击波环：r0 → r1 缓出扩散 */
  FX.ring = function (x, y, color, r0, r1, life, width) {
    var st = PB.state;
    if (!st || st.rings.length >= 14) return;
    st.rings.push({
      x: x, y: y,
      r0: r0, r1: r1,
      life: life, max: life,
      color: color,
      width: width || 2
    });
  };

  /** 飘字 */
  FX.text = function (x, y, str, color, size, life) {
    var st = PB.state;
    if (!st) return;
    var l = life || 0.9;
    st.texts.push({ x: x, y: y, life: l, max: l, text: str, color: color || '#ffffff', size: size || 16 });
  };

  /* ------------------------------------------------------------------ 计分 */

  FX.addScore = function (n, x, y, color) {
    var st = PB.state;
    if (!st) return;
    st.score += n;
    if (st.score > st.best) {
      st.best = st.score;
      if (PB.game && PB.game.saveBest) PB.game.saveBest();
    }
    FX.text(x, y, '+' + n, color || '#ffffff', 17);
  };

  /** 连击：窗口内连续命中累加，>=3 时飘字提示 */
  FX.registerCombo = function (x, y) {
    var st = PB.state;
    if (!st) return;
    if (st.comboTimer > 0) st.combo += 1;
    else st.combo = 1;
    st.comboTimer = C.comboWindow;
    if (st.combo >= 3) FX.text(x, y - 34, 'COMBO x' + st.combo, '#ff7bee', 18);
  };

  /* ------------------------------------------------------ 镜头 / 停顿 / 慢放 */

  /** 镜头推近：取最大值而不是叠加，连续撞击不会把画面越推越远 */
  FX.punchZoom = function (z) {
    var v = Math.min(z, C.camMaxZoom);
    if (v > cam.zoom) cam.zoom = v;
  };

  /** 震屏（屏幕像素，独立于缩放） */
  FX.shake = function (v) {
    var st = PB.state;
    if (st) st.shake = Math.max(st.shake, v);
  };

  /** 命中停顿：只对"机械 / 结算"级事件使用 */
  FX.hitstop = function (t) {
    var st = PB.state;
    if (st && t > st.hitstop) st.hitstop = t;
  };

  /** 慢动作：立即进入最慢值，保持 hold 秒后自动回到 1 */
  FX.slowmo = function (scale, hold) {
    if (scale >= 1 || hold <= 0) return;
    if (scale < slow.scale) slow.scale = scale;
    slow.want = scale;
    if (hold > slow.hold) slow.hold = hold;
  };

  /** 整套"重击"反馈：停顿 + 慢放 + 推镜 + 冲击波 */
  FX.impact = function (opt) {
    if (opt.hitstop) FX.hitstop(opt.hitstop);
    if (opt.zoom) FX.punchZoom(opt.zoom);
    if (opt.slow) FX.slowmo(opt.slow, opt.slowHold || 0.2);
    if (opt.shake) FX.shake(opt.shake);
  };

  /* ---------------------------------------------------------------- 时间线 */

  /** 真实时间：慢动作回落、镜头回弹、震屏衰减（永不冻结） */
  FX.tickTimers = function (dt) {
    var st = PB.state;

    if (slow.hold > 0) {
      slow.hold -= dt;
      if (slow.hold <= 0) slow.want = 1;
    }
    slow.scale += (slow.want - slow.scale) * (1 - Math.exp(-dt * C.slowReturn));

    if (cam.zoom > 1) {
      cam.zoom += (1 - cam.zoom) * (1 - Math.exp(-dt * C.camDecay));
      if (cam.zoom < 1.0005) cam.zoom = 1;
    }
    if (st && st.shake > 0) st.shake = Math.max(0, st.shake - dt * C.shakeDecay);
  };

  /** 模拟时间：粒子 / 冲击波 / 飘字（命中停顿时整体静止） */
  FX.stepVisuals = function (simDt) {
    var st = PB.state;
    if (!st) return;

    var ps = st.particles;
    for (var i = ps.length - 1; i >= 0; i--) {
      var p = ps[i];
      p.life -= simDt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vy += 620 * simDt;
      p.vx *= Math.pow(0.985, simDt * 60);
      p.vy *= Math.pow(0.985, simDt * 60);
      p.x += p.vx * simDt;
      p.y += p.vy * simDt;
    }

    var rs = st.rings;
    for (var k = rs.length - 1; k >= 0; k--) {
      rs[k].life -= simDt;
      if (rs[k].life <= 0) rs.splice(k, 1);
    }

    var ts = st.texts;
    for (var m = ts.length - 1; m >= 0; m--) {
      var t = ts[m];
      t.life -= simDt;
      t.y -= 42 * simDt;
      if (t.life <= 0) ts.splice(m, 1);
    }
  };

  /** 清空所有瞬时特效并复位镜头 */
  FX.reset = function () {
    var st = PB.state;
    if (st) {
      st.particles.length = 0;
      st.rings.length = 0;
      st.texts.length = 0;
      st.shake = 0;
      st.hitstop = 0;
    }
    cam.zoom = 1;
    slow.scale = 1;
    slow.want = 1;
    slow.hold = 0;
  };

  PB.fx = FX;
})();
