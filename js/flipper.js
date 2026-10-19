/* =============================================================================
 * flipper.js — 挡板
 *   碰撞用"胶囊（线段 + 半径）"近似，旋转时把接触点线速度传给弹珠
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;

  function Flipper(px, py, side, cfg) {
    this.pivot = { x: px, y: py };
    this.side = side;                          // 1 = 左挡板，-1 = 右挡板
    this.cfg = cfg;
    this.len = cfg.flipperLength;
    this.thick = cfg.flipperThickness;
    this.restAngle = side === 1 ? cfg.leftRest : cfg.rightRest;
    this.upAngle = side === 1 ? cfg.leftUp : cfg.rightUp;
    this.angle = this.restAngle;
    this.omega = 0;                            // 角速度，碰撞时参与反弹
    this.pressed = false;
    this.wasPressed = false;
    this.glow = 0;                             // 按下瞬间的辉光余量 0~1
  }

  /** 计算挡板末端坐标 */
  Flipper.prototype.tip = function () {
    return {
      x: this.pivot.x + Math.cos(this.angle) * this.len,
      y: this.pivot.y + Math.sin(this.angle) * this.len
    };
  };

  Flipper.prototype.update = function (dt) {
    // 上升沿触发辉光：按下挡板的那一下应该"亮"起来
    if (this.pressed && !this.wasPressed) this.glow = 1;
    this.wasPressed = this.pressed;
    if (this.glow > 0) this.glow = Math.max(0, this.glow - dt * 5.5);

    if (dt <= 0) { this.omega = 0; return; }
    var target = this.pressed ? this.upAngle : this.restAngle;
    var speed = this.pressed ? this.cfg.flipperUpSpeed : this.cfg.flipperDownSpeed;
    var prev = this.angle;
    if (this.angle < target) this.angle = Math.min(target, this.angle + speed * dt);
    else this.angle = Math.max(target, this.angle - speed * dt);
    this.omega = (this.angle - prev) / dt;
  };

  /** 重置到静止姿态 */
  Flipper.prototype.reset = function () {
    this.angle = this.restAngle;
    this.omega = 0;
    this.pressed = false;
    this.wasPressed = false;
    this.glow = 0;
  };

  PB.Flipper = Flipper;
})();
