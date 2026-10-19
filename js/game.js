/* =============================================================================
 * game.js — 游戏状态机与主更新
 *   状态：MENU 选台 | READY 准备发射 | PLAYING 游戏中 | PAUSED 暂停 | OVER 结束
 *
 *   时间分层（关键）：
 *     dt    挡板 / 相机 / 冷却 / 输入：永不冻结，操作永远跟手
 *     simDt 物理 / 粒子 / 闪光：受命中停顿与慢动作影响
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;
  var C = PB.CONFIG;
  var U = PB.util;
  var S = PB.Sound;
  var FX = PB.fx;

  /* ------------------------------------------------------------ 游戏状态 */

  var st = PB.state = {
    phase: 'MENU',
    prevPhase: 'READY',
    score: 0,
    best: 0,
    lives: C.startBalls,       // 剩余备球（场上球全掉光才扣 1）
    balls: [],                 // 场上球，支持多球模式
    power: 0,                  // 蓄力 0~1
    charging: false,
    acc: 0,                    // 物理累积时间
    respawn: 0,                // 掉球后重新装填倒计时
    multiballCool: 0,
    multiballCount: 0,
    orbitCount: 0,
    targetCount: 0,            // 目标灯整组点亮的次数
    targetFlash: 0,
    combo: 0,
    comboTimer: 0,
    shake: 0,
    hitstop: 0,
    rings: [],
    particles: [],
    texts: []
  };

  /* ------------------------------------------------------------ 最高分 */

  function loadBest(id) {
    try {
      var v = parseInt(window.localStorage.getItem(PB.STORAGE.bestPrefix + id) || '0', 10);
      return isNaN(v) ? 0 : v;
    } catch (e) {
      return 0;
    }
  }

  function saveBest() {
    try {
      if (PB.table) window.localStorage.setItem(PB.STORAGE.bestPrefix + PB.table.id, String(st.best));
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  /* ------------------------------------------------------------ 球对象 */

  /** 以"场上的一颗球"形态创建（多球模式共用） */
  function makeBall(x, y, vx, vy) {
    return {
      x: x, y: y,
      vx: vx || 0,
      vy: vy || 0,
      r: C.ballRadius,
      trail: [],
      rail: null,              // 非空表示正在弧形轨道上滑行
      ready: false,            // true = 停在发射口等待蓄力
      stuckRefX: x,
      stuckRefY: y,
      stuckTime: 0,
      stuckCount: 0
    };
  }
  PB.makeBall = makeBall;

  /* ------------------------------------------------------------ 台面切换 */

  /** 重置台面上所有元件的一次性状态 */
  function resetTableState() {
    var T = PB.table;
    var i;
    for (i = 0; i < T.bumpers.length; i++) { T.bumpers[i].pulse = 0; T.bumpers[i].cool = 0; }
    for (i = 0; i < T.pegs.length; i++) { T.pegs[i].cool = 0; T.pegs[i].flash = 0; }
    for (i = 0; i < T.targets.length; i++) { T.targets[i].lit = false; T.targets[i].cool = 0; T.targets[i].flash = 0; }
    for (i = 0; i < T.slings.length; i++) T.slings[i].flash = 0;
    if (T.orbit) T.orbit.flash = 0;
    T.flippers.left.reset();
    T.flippers.right.reset();
  }

  /**
   * 选择台面：构建运行时台面对象、烘焙/复用底板贴图、读取该台最高分
   * 结束时停在 MENU，画面作为选台预览
   */
  function selectTable(id) {
    var def = PB.Tables.get(id) || PB.Tables.list[0];
    PB.table = PB.Tables.build(def);
    PB.Materials.prepare(PB.table);

    st.best = loadBest(def.id);
    st.phase = 'MENU';
    st.prevPhase = 'READY';
    st.score = 0;
    st.lives = C.startBalls;
    st.balls.length = 0;
    st.power = 0;
    st.charging = false;
    st.acc = 0;
    st.respawn = 0;
    st.combo = 0;
    st.comboTimer = 0;
    st.multiballCool = 0;
    st.multiballCount = 0;
    st.orbitCount = 0;
    st.targetCount = 0;
    st.targetFlash = 0;

    FX.reset();
    resetTableState();

    try { window.localStorage.setItem(PB.STORAGE.table, def.id); } catch (e) { /* 忽略 */ }

    if (PB.ui) {
      PB.ui.syncHUD(true);
      PB.ui.showMenu();
    }
  }

  /** 左右切换台面（选台界面 / 键盘） */
  function cycleTable(dir) {
    var n = PB.Tables.list.length;
    var i = (PB.Tables.indexOf(PB.table.id) + dir + n) % n;
    chooseTable(PB.Tables.list[i].id);
  }

  function chooseTable(id) {
    if (PB.table && PB.table.id === id && st.phase === 'MENU') return;
    S.select();
    selectTable(id);
  }

  /** 回到选台界面（放弃当前这局） */
  function toMenu() {
    selectTable(PB.table.id);
  }

  /* ------------------------------------------------------------ 开局 */

  function startGame() {
    if (!PB.table) return;

    st.score = 0;
    st.lives = C.startBalls;
    st.combo = 0;
    st.comboTimer = 0;
    st.multiballCool = 0;
    st.multiballCount = 0;
    st.orbitCount = 0;
    st.targetCount = 0;
    st.targetFlash = 0;
    st.respawn = 0;

    FX.reset();
    resetTableState();
    newBall();
    PB.ui.syncHUD(true);
    S.start();
  }

  /** 装填一颗球到发射口 */
  function newBall() {
    var T = PB.table;
    var b = makeBall(T.ballStart.x, T.ballStart.y, 0, 0);
    b.ready = true;
    st.balls.length = 0;
    st.balls.push(b);
    st.power = 0;
    st.charging = false;
    st.acc = 0;
    st.respawn = 0;
    st.hitstop = 0;
    PB.cam.zoom = 1;
    st.phase = 'READY';
    T.flippers.left.pressed = false;
    T.flippers.right.pressed = false;
    if (PB.ui) {
      PB.ui.hideOverlay();
      PB.ui.syncHUD(true);
    }
  }

  /* ------------------------------------------------------------ 掉球 */

  /** 移除场上的一颗球；掉光后进入扣球流程 */
  function removeBall(b) {
    var i = st.balls.indexOf(b);
    if (i < 0) return;
    st.balls.splice(i, 1);
    FX.burst(b.x, Math.min(b.y, C.height - 12), '#ff4c6e', 18, 300);

    if (st.balls.length === 0) {
      loseBall();
    } else {
      // 多球模式下掉一颗不扣命，只提示
      S.ballLost();
      FX.text(b.x, C.height - 70, '球 ' + st.balls.length, '#ff8fa6', 13, 0.8);
    }
  }

  /** 场上球全部掉光 → 扣 1 颗备球 */
  function loseBall() {
    var T = PB.table;
    S.drain();
    st.combo = 0;
    st.comboTimer = 0;
    st.charging = false;
    st.power = 0;
    st.lives -= 1;
    T.flippers.left.pressed = false;
    T.flippers.right.pressed = false;
    PB.ui.syncHUD(true);

    if (st.lives <= 0) gameOver();
    else st.respawn = 0.65;
  }

  function gameOver() {
    st.phase = 'OVER';
    st.balls.length = 0;
    if (st.score > st.best) {
      st.best = st.score;
      saveBest();
    }
    S.over();
    PB.ui.syncHUD(true);
    PB.ui.showGameOver();
  }

  /* ------------------------------------------------------------ 发射 */

  function fireBall() {
    var T = PB.table;
    var b = st.balls[0];
    if (!b) return;
    var p = U.clamp(st.power, 0, 1);
    var speed = T.cfg.launchMinSpeed + (T.cfg.launchMaxSpeed - T.cfg.launchMinSpeed) * p;
    b.vx = Math.cos(T.launchAngle) * speed;
    b.vy = Math.sin(T.launchAngle) * speed;
    b.ready = false;
    st.power = 0;
    st.charging = false;
    st.phase = 'PLAYING';
    st.acc = 0;
    S.launch(p);
    FX.burst(b.x, b.y, T.theme.hint, 12, 240);
  }

  function pressLaunch() {
    S.init();
    if (st.phase === 'OVER') { startGame(); return; }
    if (st.phase === 'MENU') { startGame(); return; }
    if (st.phase === 'PAUSED') return;
    if (st.phase !== 'READY') return;
    if (!st.balls.length) return;
    if (st.charging) return;
    st.charging = true;
    st.power = 0;
  }

  function releaseLaunch() {
    if (!st.charging) return;
    if (st.phase !== 'READY') { st.charging = false; return; }
    fireBall();
  }

  function togglePause() {
    if (st.phase === 'PAUSED') {
      st.phase = st.prevPhase || 'READY';
      PB.ui.hideOverlay();
      PB.ui.syncHUD(true);
    } else if (st.phase === 'PLAYING' || st.phase === 'READY') {
      st.prevPhase = st.phase;
      st.phase = 'PAUSED';
      st.charging = false;
      st.power = 0;
      PB.ui.showPause();
    }
  }

  /* ------------------------------------------------------------ 主更新 */

  function update(dt) {
    var T = PB.table;
    if (!T || st.phase === 'PAUSED') return;

    /* ---- 时间分层 ---- */
    var simDt;
    if (st.hitstop > 0) {
      st.hitstop = Math.max(0, st.hitstop - dt);
      simDt = 0;
    } else {
      simDt = dt * FX.slow.scale;
    }

    FX.tickTimers(dt);

    // 挡板用真实时间推进：命中停顿期间若冻结挡板，omega 会归零，弹射力凭空消失
    T.flippers.left.update(dt);
    T.flippers.right.update(dt);

    /* ---- 各类计时器 ---- */
    if (st.comboTimer > 0) {
      st.comboTimer -= dt;
      if (st.comboTimer <= 0) st.combo = 0;
    }

    var i, o;
    for (i = 0; i < T.bumpers.length; i++) {
      o = T.bumpers[i];
      if (o.cool > 0) o.cool -= dt;
      if (o.pulse > 0) o.pulse = Math.max(0, o.pulse - simDt * 2.6);
    }
    for (i = 0; i < T.pegs.length; i++) {
      o = T.pegs[i];
      if (o.cool > 0) o.cool -= dt;
      if (o.flash > 0) o.flash = Math.max(0, o.flash - simDt * 4);
    }
    for (i = 0; i < T.targets.length; i++) {
      o = T.targets[i];
      if (o.cool > 0) o.cool -= dt;
      if (o.flash > 0) o.flash = Math.max(0, o.flash - simDt * 3);
    }
    for (i = 0; i < T.slings.length; i++) {
      o = T.slings[i];
      if (o.flash > 0) o.flash = Math.max(0, o.flash - simDt * 3.4);
    }
    if (st.multiballCool > 0) st.multiballCool = Math.max(0, st.multiballCool - dt);
    if (st.targetFlash > 0) st.targetFlash = Math.max(0, st.targetFlash - simDt * 1.6);
    if (T.orbit && T.orbit.flash > 0) T.orbit.flash = Math.max(0, T.orbit.flash - simDt * 2.2);

    /* ---- 蓄力 ---- */
    if (st.phase === 'READY' && st.charging) {
      st.power = Math.min(1, st.power + dt / T.cfg.chargeTime);
    }

    /* ---- 物理 ---- */
    if (st.phase === 'PLAYING' && st.balls.length) {
      st.acc += simDt;
      var guard = 0;
      while (st.acc >= T.cfg.fixedStep && guard < 8) {
        PB.physics.simulate(T.cfg.fixedStep);
        st.acc -= T.cfg.fixedStep;
        guard++;
      }
      if (guard >= 8) st.acc = 0;

      // 拖尾 + 掉球判定（倒序遍历，移除后不影响索引）
      for (var k = st.balls.length - 1; k >= 0; k--) {
        var b = st.balls[k];
        if (simDt > 0) {
          b.trail.push({ x: b.x, y: b.y });
          if (b.trail.length > 12) b.trail.shift();
        }
        if (!b.rail && b.y > C.height - 24) removeBall(b);
      }
    }

    /* ---- 重新装填 ---- */
    if (st.respawn > 0) {
      st.respawn -= dt;
      if (st.respawn <= 0) newBall();
    }

    FX.stepVisuals(simDt);

    if (PB.ui) PB.ui.syncHUD(false);
  }

  PB.game = {
    state: st,
    selectTable: selectTable,
    chooseTable: chooseTable,
    cycleTable: cycleTable,
    toMenu: toMenu,
    startGame: startGame,
    newBall: newBall,
    gameOver: gameOver,
    fireBall: fireBall,
    pressLaunch: pressLaunch,
    releaseLaunch: releaseLaunch,
    togglePause: togglePause,
    update: update,
    saveBest: saveBest,
    loadBest: loadBest
  };
})();
