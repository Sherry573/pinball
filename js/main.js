/* =============================================================================
 * main.js — 启动、DOM / UI 绑定、输入、尺寸自适应、主循环
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;
  var C = PB.CONFIG;
  var S = PB.Sound;
  var G = PB.game;

  var el = {};
  var uiCache = { score: -1, best: -1, lives: -1 };
  var needRedraw = true;

  /* ============================================================== 遮罩层 */

  /** 通用遮罩：标题 / 大数字 / 说明 / 台面选择器 / 主按钮 / 次按钮 */
  function overlayShow(o) {
    el.ovTitle.textContent = o.title || '';

    if (o.big) {
      el.ovBig.style.display = 'block';
      el.ovBig.textContent = o.big;
    } else {
      el.ovBig.style.display = 'none';
    }

    el.ovText.innerHTML = o.text || '';

    el.ovPicker.classList.toggle('show', !!o.picker);
    el.overlay.classList.toggle('preview', !!o.preview);

    if (o.btn) {
      el.ovBtn.style.display = '';
      el.ovBtn.textContent = o.btn;
      el.ovBtn.onclick = function () {
        S.init();
        o.action();
      };
    } else {
      el.ovBtn.style.display = 'none';
    }

    if (o.alt) {
      el.ovAlt.style.display = '';
      el.ovAlt.textContent = o.alt.text;
      el.ovAlt.onclick = function () {
        S.init();
        o.alt.action();
      };
    } else {
      el.ovAlt.style.display = 'none';
    }

    if (PB.table) {
      el.overlay.style.setProperty('--accent', PB.table.accent);
      el.ovBtn.style.background = 'linear-gradient(135deg,' + PB.table.accent + ', #eafcff)';
    }

    el.overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    el.overlay.classList.add('hidden');
  }

  /* ============================================================ 台面选择卡 */

  function buildPicker() {
    el.picker.innerHTML = '';
    PB.Tables.list.forEach(function (def) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.style.setProperty('--pick', def.accent);
      card.dataset.id = def.id;

      var sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.background = 'linear-gradient(135deg,' + def.theme.bumper + ' 0%,' + def.accent + ' 55%,' + def.theme.bg.mid + ' 100%)';

      var cm = document.createElement('span');
      cm.className = 'cm';
      var nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = def.name;
      var tg = document.createElement('span');
      tg.className = 'tg';
      tg.textContent = def.tag;
      cm.appendChild(nm);
      cm.appendChild(tg);

      var bs = document.createElement('span');
      bs.className = 'bs';

      card.appendChild(sw);
      card.appendChild(cm);
      card.appendChild(bs);

      card.addEventListener('click', function () {
        S.init();
        G.chooseTable(def.id);
      });

      el.picker.appendChild(card);
    });
  }

  function refreshPicker() {
    var cards = el.picker.children;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var on = PB.table && card.dataset.id === PB.table.id;
      card.classList.toggle('sel', !!on);
      var best = G.loadBest(card.dataset.id);
      card.querySelector('.bs').textContent = best > 0 ? '最高 ' + best : '未上榜';
    }
  }

  /* ================================================================== UI */

  var ui = PB.ui = {};

  ui.syncHUD = function (force) {
    var st = PB.state;
    if (force || uiCache.score !== st.score) {
      uiCache.score = st.score;
      el.uiScore.textContent = String(st.score);
    }
    if (force || uiCache.best !== st.best) {
      uiCache.best = st.best;
      el.uiBest.textContent = String(st.best);
    }
    if (force || uiCache.lives !== st.lives) {
      uiCache.lives = st.lives;
      el.uiBalls.textContent = String(Math.max(0, st.lives));
    }
  };

  ui.showMenu = function () {
    refreshPicker();
    overlayShow({
      title: '霓虹弹珠台',
      text: '选择台面 · <span class="key">←</span> <span class="key">→</span> 切换，<span class="key">空格</span> 开始',
      picker: true,
      preview: true,
      btn: '开始游戏',
      action: function () { G.startGame(); }
    });
    el.btnPause.style.display = 'none';
  };

  ui.showPause = function () {
    overlayShow({
      title: '已暂停',
      text: '当前台面 <span class="key">' + PB.table.name + '</span><br>按 <span class="key">P</span> 或下方按钮继续',
      btn: '继续',
      action: function () { G.togglePause(); },
      alt: { text: '返回选台', action: function () { G.toMenu(); } }
    });
  };

  ui.showGameOver = function () {
    var st = PB.state;
    overlayShow({
      title: '游戏结束',
      big: String(st.score),
      text: '台面 <span class="key">' + PB.table.name + '</span> · 最高分 <span class="key">' + st.best + '</span><br>' +
            '点亮目标灯 <span class="key">' + st.targetCount + '</span> 次 · 轨道 <span class="key">' + st.orbitCount + '</span> 圈 · 多球 <span class="key">' + st.multiballCount + '</span> 次<br>' +
            '按 <span class="key">空格</span> 或 <span class="key">R</span> 重新开始',
      btn: '重新开始',
      action: function () { G.startGame(); },
      alt: { text: '换个台面', action: function () { G.toMenu(); } }
    });
    el.btnPause.style.display = '';
  };

  ui.hideOverlay = function () {
    hideOverlay();
    el.btnPause.style.display = '';
  };

  ui.needRedraw = function () { needRedraw = true; };

  /* ================================================================== 输入 */

  function bindHold(node, onDown, onUp) {
    node.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      S.init();
      node.classList.add('active');
      onDown();
    });
    var up = function () {
      node.classList.remove('active');
      onUp();
    };
    node.addEventListener('pointerup', function (e) { e.preventDefault(); up(); });
    node.addEventListener('pointercancel', up);
    node.addEventListener('pointerleave', up);
    node.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function flipperDown(side) {
    var st = PB.state;
    if (st.phase === 'PAUSED' || st.phase === 'MENU' || st.phase === 'OVER') return;
    if (side === 1) PB.table.flippers.left.pressed = true;
    else PB.table.flippers.right.pressed = true;
    S.flipper();
  }

  function flipperUp(side) {
    if (!PB.table) return;
    if (side === 1) PB.table.flippers.left.pressed = false;
    else PB.table.flippers.right.pressed = false;
  }

  function bindInput() {
    /* ---------------- 键盘 ---------------- */
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      var st = PB.state;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          S.init();
          G.pressLaunch();
          break;
        case 'Enter':
          if (st.phase === 'MENU' || st.phase === 'OVER') { S.init(); G.startGame(); }
          break;
        case 'ArrowLeft':
        case 'KeyA':
          e.preventDefault();
          if (st.phase === 'MENU') G.cycleTable(-1);
          else flipperDown(1);
          break;
        case 'ArrowRight':
        case 'KeyD':
          e.preventDefault();
          if (st.phase === 'MENU') G.cycleTable(1);
          else flipperDown(-1);
          break;
        case 'KeyP':
        case 'Escape':
          if (st.phase === 'PLAYING' || st.phase === 'READY' || st.phase === 'PAUSED') G.togglePause();
          break;
        case 'KeyR':
          if (st.phase !== 'MENU') G.startGame();
          break;
        default:
          break;
      }
    });

    window.addEventListener('keyup', function (e) {
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          G.releaseLaunch();
          break;
        case 'ArrowLeft':
        case 'KeyA':
          flipperUp(1);
          break;
        case 'ArrowRight':
        case 'KeyD':
          flipperUp(-1);
          break;
        default:
          break;
      }
    });

    /* ---------------- 触摸 / 鼠标按钮 ---------------- */
    bindHold(el.btnLeft, function () { flipperDown(1); }, function () { flipperUp(1); });
    bindHold(el.btnRight, function () { flipperDown(-1); }, function () { flipperUp(-1); });
    bindHold(el.btnLaunch, function () { G.pressLaunch(); }, function () { G.releaseLaunch(); });

    /* 点击画布也能蓄力发射 */
    el.canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      S.init();
      if (PB.state.phase === 'PLAYING') return;
      G.pressLaunch();
    });
    window.addEventListener('pointerup', function () { G.releaseLaunch(); });
    window.addEventListener('pointercancel', function () { G.releaseLaunch(); });

    /* ---------------- 顶部按钮 ---------------- */
    el.btnPause.addEventListener('click', function () { S.init(); G.togglePause(); });
    el.btnRestart.addEventListener('click', function () { S.init(); G.startGame(); });
    el.btnTable.addEventListener('click', function () {
      S.init();
      var ph = PB.state.phase;
      if (ph === 'PLAYING' || ph === 'READY') G.togglePause();      // 先暂停，避免误触丢进度
      else if (ph === 'PAUSED') { /* 已经在菜单里 */ }
      else G.toMenu();
    });

    /* ---------------- 尺寸 / 失焦 ---------------- */
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 260); });

    window.addEventListener('blur', function () {
      if (PB.state.phase === 'PLAYING') G.togglePause();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && PB.state.phase === 'PLAYING') G.togglePause();
    });
  }

  /* ============================================================== 尺寸 */

  function resize() {
    var availW = el.stage.clientWidth;
    var availH = el.stage.clientHeight;
    if (availW <= 0 || availH <= 0) return;

    var scale = Math.min(availW / C.width, availH / C.height);
    var cw = Math.max(160, Math.floor(C.width * scale));
    var ch = Math.max(266, Math.floor(C.height * scale));

    el.canvas.style.width = cw + 'px';
    el.canvas.style.height = ch + 'px';

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.width = Math.round(cw * dpr);
    el.canvas.height = Math.round(ch * dpr);

    PB.renderer.view.sx = el.canvas.width / C.width;
    PB.renderer.view.sy = el.canvas.height / C.height;

    el.overlay.style.width = cw + 'px';
    el.overlay.style.height = ch + 'px';

    // 改尺寸会清空画布，暂停中的静止帧必须重画一次
    needRedraw = true;
  }

  /* ============================================================== 启动 */

  function boot() {
    el.canvas = document.getElementById('game');
    el.stage = document.getElementById('stage');
    el.overlay = document.getElementById('overlay');
    el.ovTitle = document.getElementById('ovTitle');
    el.ovText = document.getElementById('ovText');
    el.ovBig = document.getElementById('ovBig');
    el.ovPicker = document.getElementById('ovPicker');
    el.picker = el.ovPicker;
    el.ovBtn = document.getElementById('ovBtn');
    el.ovAlt = document.getElementById('ovAlt');

    el.uiScore = document.getElementById('uiScore');
    el.uiBest = document.getElementById('uiBest');
    el.uiBalls = document.getElementById('uiBalls');
    el.btnPause = document.getElementById('btnPause');
    el.btnRestart = document.getElementById('btnRestart');
    el.btnTable = document.getElementById('btnTable');
    el.btnLeft = document.getElementById('btnLeft');
    el.btnRight = document.getElementById('btnRight');
    el.btnLaunch = document.getElementById('btnLaunch');

    PB.renderer.init(el.canvas);
    buildPicker();
    bindInput();
    resize();

    /* 记忆上次选择的台面 */
    var saved = null;
    try { saved = window.localStorage.getItem(PB.STORAGE.table); } catch (e) { saved = null; }
    if (!PB.Tables.get(saved)) saved = PB.Tables.list[0].id;

    G.selectTable(saved);

    setTimeout(resize, 60);
    setTimeout(resize, 300);
    // 其余台面的底板贴图在空闲时才烘焙，避免首帧被拖慢
    setTimeout(function () { PB.Materials.warmup(); }, 500);

    var lastTime = performance.now();

    function loop(now) {
      // 夹紧时间步：切后台 / 时间戳异常时不会产生负值或超大步长
      var dt = Math.max(0, Math.min((now - lastTime) / 1000, C.maxDt));
      lastTime = now;

      G.update(dt);

      // 暂停时只补画一帧，之后停掉绘制（overlay 带 backdrop-filter，持续重绘很费）
      if (!(PB.state.phase === 'PAUSED' && !needRedraw)) {
        PB.renderer.render();
        needRedraw = false;
      }

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
