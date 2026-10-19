/* =============================================================================
 * config.js — 全局可调参数
 *   · 所有物理、挡板、发射、轨道、镜头参数集中在这里
 *   · 每个台面可以在 def.cfg 里覆盖其中任意一项（见 tables.js）
 * ========================================================================== */
(function () {
  'use strict';

  window.PB = window.PB || {};

  PB.CONFIG = {
    /* ---------- 逻辑分辨率（竖屏 3:5，所有坐标都基于它） ---------- */
    width: 480,
    height: 800,

    /* ---------- 物理基础 ---------- */
    gravity: 1350,            // 重力加速度 px/s²
    airDrag: 0.9985,          // 空气阻尼（每 1/60 秒的比例）
    maxSpeed: 1500,           // 速度上限，防止数值爆炸
    ballRadius: 9,            // 弹珠半径
    substeps: 3,              // 每个固定步长内的物理子步（防止穿透）

    /* ---------- 碰撞恢复系数与摩擦 ---------- */
    wallRestitution: 0.80,
    wallFriction: 0.04,
    bumperRestitution: 0.75,
    bumperKick: 430,          // 缓冲器额外冲量
    pegRestitution: 0.90,
    pegKick: 60,
    targetRestitution: 0.72,
    flipperRestitution: 0.55,
    flipperFriction: 0.12,

    /* ---------- 挡板 ---------- */
    flipperLength: 95,
    flipperThickness: 8.5,    // 胶囊半径
    flipperUpSpeed: 14,       // 抬升角速度 rad/s
    flipperDownSpeed: 8,      // 回落角速度
    leftRest: 0.34,
    leftUp: -0.52,
    rightRest: Math.PI - 0.34,
    rightUp: Math.PI + 0.52,

    /* ---------- 发射 ---------- */
    launchAngle: 2.10,        // 发射方向（弧度）
    launchMinSpeed: 720,
    launchMaxSpeed: 1450,
    chargeTime: 1.05,         // 蓄满力所需时间（秒）

    /* ---------- 防卡死 ---------- */
    stuckWindow: 1.5,
    stuckMove: 16,
    antiStuckKick: 420,
    stuckLimit: 3,

    /* ---------- 计分规则 ---------- */
    startBalls: 3,
    bumperScore: 100,
    pegScore: 10,
    targetScore: 500,
    comboWindow: 1.5,

    /* ---------- 弧形轨道（Orbit） ---------- */
    orbitScore: 40,
    orbitPoints: 8,
    orbitBonus: 200,
    orbitSpeed: 640,
    orbitMinSpeed: 520,
    orbitMaxSpeed: 820,
    orbitCaptureSpeed: 130,
    orbitGate: 34,            // 入口捕获半径
    orbitGateDot: 0.25,       // 速度方向与切向的最小余弦

    /* ---------- 多球模式 ---------- */
    multiballExtra: 2,
    maxBallsOnField: 3,
    multiballCool: 10,

    /* ---------- 时间步 ---------- */
    maxDt: 1 / 30,
    fixedStep: 1 / 120,

    /* ---------- 镜头与打击感 ---------- */
    camPivotX: 240,
    camPivotY: 200,
    camMaxZoom: 1.04,
    camDecay: 8.5,
    shakeDecay: 26,
    hitstopTarget: 0.07,
    hitstopOrbit: 0.06,
    hitstopMulti: 0.09,
    slowOrbitIn: 0.60,
    slowOrbitInHold: 0.10,
    slowOrbitOut: 0.45,
    slowOrbitOutHold: 0.15,
    slowMulti: 0.35,
    slowMultiHold: 0.42,
    slowReturn: 10
  };

  /* localStorage 键名（按台面分别记录最高分） */
  PB.STORAGE = {
    bestPrefix: 'neon_pinball_best_v2_',
    table: 'neon_pinball_table_v2'
  };
})();
