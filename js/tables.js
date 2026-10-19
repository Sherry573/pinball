/* =============================================================================
 * tables.js — 台面数据 + 运行时构建
 *   每个台面 = 外壳（弧顶 + 左右墙 + 底部斜坡，三张台共用）
 *            + 内部内容（缓冲器 / 钉子 / 目标灯 / 导流墙 / 轨道）
 *            + 主题（配色、表面材质、镜头与物理微调）
 *   build() 会把"静态数据"展开成"运行时对象"：墙壁法线、轨道采样点、
 *   带冷却与脉冲状态的元件副本、挡板实例等。
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;
  var C = PB.CONFIG;
  var U = PB.util;

  /* ---------- 三张台共用的外壳 ---------- */
  var SHELL = [
    [30, 220, 30, 800],        // 左墙
    [450, 220, 450, 800],      // 右墙
    [30, 600, 130, 700],       // 左下导球斜坡
    [450, 600, 350, 700]       // 右下导球斜坡
  ];

  /** 底部两侧的结构三角（纯装饰，让墙角看起来是实心结构） */
  var CORNERS = [
    [{ x: 30, y: 600 }, { x: 130, y: 700 }, { x: 30, y: 800 }],
    [{ x: 450, y: 600 }, { x: 350, y: 700 }, { x: 450, y: 800 }]
  ];

  /* ===========================================================================
   * 台面定义
   * ======================================================================== */
  var TABLES = [
    /* ---------------------------------------------------------------------- */
    {
      id: 'classic',
      name: '霓虹经典',
      brand: 'NEON CLASSIC',
      tag: '对称四缓冲 · 顶部环形轨道',
      accent: '#45f3ff',
      arc: { cx: 240, cy: 220, r: 210 },

      bumpers: [[145, 250, 26], [335, 250, 26], [240, 160, 26], [240, 345, 22]],
      pegs: [
        [100, 296], [380, 296],
        [140, 440], [240, 440], [340, 440],
        [90, 500], [190, 500], [290, 500], [390, 500],
        [140, 560], [240, 560], [340, 560]
      ],
      targets: [[80, 400, 15], [400, 400, 15]],
      slings: [
        { a: [100, 586], b: [160, 640], c: [100, 640] },
        { a: [380, 586], b: [320, 640], c: [380, 640] }
      ],
      bars: [],

      orbit: { cx: 240, cy: 220, r: 190, a0: 0.75, a1: -(Math.PI - 0.75) },
      ballStart: [392, 200],
      launchAngle: 2.10,
      flippers: { left: [130, 700], right: [350, 700] },

      cfg: {},

      theme: {
        surface: 'brushed',
        bg: { top: '#122644', mid: '#0a1122', bottom: '#04050b', glow: 'rgba(60,160,255,0.16)' },
        grid: 'rgba(80,150,255,0.05)',
        wall: '#45f3ff',
        wallCore: 'rgba(228,255,255,0.92)',
        wallSlab: 'rgba(7,14,26,0.94)',
        bumper: '#ffd166',
        bumperDeep: '#3a2606',
        peg: '#cfefff',
        target: '#a8ff3e',
        sling: '#7dffc4',
        flipperL: '#45f3ff',
        flipperR: '#ff4ce0',
        orbit: '#7ef9ff',
        orbitWarm: '#ffd166',
        ball: '#7ef9ff',
        trail: '#78e6ff',
        drain: '#ff3c5a',
        hint: '#8fd6ff'
      }
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'gallery',
      name: '熔金回廊',
      brand: 'GOLDEN GALLERY',
      tag: '导流斜墙 · 长弧轨道',
      accent: '#ffb454',
      arc: { cx: 240, cy: 220, r: 210 },

      bumpers: [[150, 255, 25], [330, 255, 25], [240, 170, 25]],
      pegs: [
        [175, 440], [305, 440],
        [240, 470], [240, 520],
        [110, 555], [175, 555], [305, 555], [370, 555]
      ],
      targets: [[74, 392, 14], [406, 392, 14], [240, 300, 14]],
      slings: [
        { a: [100, 586], b: [160, 640], c: [100, 640] },
        { a: [380, 586], b: [320, 640], c: [380, 640] }
      ],
      /** 两条导流斜墙：把球从两侧往中央送，制造"回廊"手感 */
      bars: [
        [30, 455, 158, 508, 5],
        [450, 455, 322, 508, 5]
      ],

      orbit: { cx: 240, cy: 220, r: 188, a0: 0.66, a1: -(Math.PI - 0.66) },
      ballStart: [392, 204],
      launchAngle: 2.06,
      flippers: { left: [130, 700], right: [350, 700] },

      cfg: { gravity: 1320, bumperKick: 452, orbitScore: 50, flipperLength: 95 },

      theme: {
        surface: 'weave',
        bg: { top: '#2c1f1c', mid: '#150e14', bottom: '#06040a', glow: 'rgba(255,168,80,0.15)' },
        grid: 'rgba(255,190,120,0.045)',
        wall: '#ffb454',
        wallCore: 'rgba(255,244,222,0.92)',
        wallSlab: 'rgba(22,12,10,0.95)',
        bumper: '#ff7a45',
        bumperDeep: '#3a1206',
        peg: '#ffd9a8',
        target: '#ffe27a',
        sling: '#ffcf6b',
        flipperL: '#ffb454',
        flipperR: '#ff5c8a',
        orbit: '#ffd88a',
        orbitWarm: '#ff9a4d',
        ball: '#ffdca8',
        trail: '#ffc98a',
        drain: '#ff5a44',
        hint: '#ffcf9a'
      }
    },

    /* ---------------------------------------------------------------------- */
    {
      id: 'abyss',
      name: '深渊之核',
      brand: 'ABYSS CORE',
      tag: '五瓣缓冲 · 密集钉阵',
      accent: '#5df2c0',
      arc: { cx: 240, cy: 220, r: 210 },

      bumpers: [
        [240, 270, 30],
        [160, 270, 20], [320, 270, 20],
        [240, 190, 20], [240, 350, 20]
      ],
      pegs: [
        [150, 452], [330, 452],
        [120, 492], [360, 492],
        [85, 530], [175, 530], [305, 530], [395, 530],
        [140, 560], [240, 560], [340, 560]
      ],
      targets: [[62, 430, 13], [240, 430, 13], [418, 430, 13]],
      slings: [
        { a: [100, 586], b: [160, 640], c: [100, 640] },
        { a: [380, 586], b: [320, 640], c: [380, 640] }
      ],
      bars: [],

      orbit: { cx: 240, cy: 220, r: 176, a0: 0.95, a1: -(Math.PI - 0.95) },
      ballStart: [392, 202],
      launchAngle: 2.12,
      flippers: { left: [130, 700], right: [350, 700] },

      cfg: { gravity: 1420, pegKick: 72, bumperKick: 470, orbitBonus: 260, flipperLength: 95 },

      theme: {
        surface: 'nebula',
        bg: { top: '#0e2a34', mid: '#07141c', bottom: '#02060a', glow: 'rgba(90,255,200,0.14)' },
        grid: 'rgba(110,255,215,0.05)',
        wall: '#5df2c0',
        wallCore: 'rgba(232,255,247,0.92)',
        wallSlab: 'rgba(6,18,20,0.95)',
        bumper: '#b06bff',
        bumperDeep: '#1d0a33',
        peg: '#c6fff0',
        target: '#8effb0',
        sling: '#5df2c0',
        flipperL: '#5df2c0',
        flipperR: '#b06bff',
        orbit: '#9affe0',
        orbitWarm: '#b06bff',
        ball: '#9affe0',
        trail: '#8affe0',
        drain: '#ff3c6e',
        hint: '#9affe0'
      }
    }
  ];

  /* ===========================================================================
   * 运行时构建
   * ======================================================================== */

  /** 采样弧形轨道：一串路径点 + 累计长度，供参数化定位使用 */
  function buildOrbit(o) {
    var orbit = {
      cx: o.cx,
      cy: o.cy,
      r: o.r,
      a0: o.a0,
      a1: o.a1,
      pts: [],
      acc: [],
      total: 1,
      flash: 0
    };
    var SEG = 64;
    for (var i = 0; i <= SEG; i++) {
      var a = o.a0 + (o.a1 - o.a0) * (i / SEG);
      orbit.pts.push({
        x: o.cx + Math.cos(a) * o.r,
        y: o.cy + Math.sin(a) * o.r
      });
    }
    orbit.acc.push(0);
    var sum = 0;
    for (var k = 1; k < orbit.pts.length; k++) {
      sum += Math.hypot(orbit.pts[k].x - orbit.pts[k - 1].x, orbit.pts[k].y - orbit.pts[k - 1].y);
      orbit.acc.push(sum);
    }
    orbit.total = sum || 1;
    orbit.entry = orbit.pts[0];
    orbit.exit = orbit.pts[orbit.pts.length - 1];
    return orbit;
  }

  /** 参数 t → 轨道上的位置与切向（沿路径点匀速插值） */
  function orbitAt(orbit, t) {
    var pts = orbit.pts;
    var d = U.clamp(t, 0, 1) * orbit.total;
    var i = 1;
    while (i < orbit.acc.length - 1 && orbit.acc[i] < d) i++;
    var segLen = orbit.acc[i] - orbit.acc[i - 1];
    var k = segLen > 0 ? U.clamp((d - orbit.acc[i - 1]) / segLen, 0, 1) : 0;
    var p0 = pts[i - 1];
    var p1 = pts[i];
    var dx = p1.x - p0.x;
    var dy = p1.y - p0.y;
    var l = Math.hypot(dx, dy) || 1;
    return {
      x: p0.x + dx * k,
      y: p0.y + dy * k,
      tx: dx / l,
      ty: dy / l
    };
  }

  /** 把位置投影到轨道上，返回最近的参数 t（入轨时避免瞬移） */
  function orbitProject(orbit, x, y) {
    var best = 1e9;
    var bt = 0;
    for (var i = 0; i < orbit.pts.length; i++) {
      var dx = x - orbit.pts[i].x;
      var dy = y - orbit.pts[i].y;
      var d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; bt = i / (orbit.pts.length - 1); }
    }
    return bt;
  }

  function build(def) {
    var cfg = {};
    var key;
    for (key in C) if (Object.prototype.hasOwnProperty.call(C, key)) cfg[key] = C[key];
    if (def.cfg) for (key in def.cfg) if (Object.prototype.hasOwnProperty.call(def.cfg, key)) cfg[key] = def.cfg[key];

    var t = {
      id: def.id,
      name: def.name,
      brand: def.brand,
      tag: def.tag,
      accent: def.accent,
      theme: def.theme,
      cfg: cfg,
      arc: { cx: def.arc.cx, cy: def.arc.cy, r: def.arc.r },
      corners: CORNERS,
      center: { x: 240, y: 420 },
      launchAngle: def.launchAngle,
      ballStart: { x: def.ballStart[0], y: def.ballStart[1] },
      walls: [],
      bars: [],
      bumpers: [],
      pegs: [],
      targets: [],
      slings: [],
      orbit: def.orbit ? buildOrbit(def.orbit) : null
    };

    /* 外壳墙（半平面） */
    for (var i = 0; i < SHELL.length; i++) {
      var s = SHELL[i];
      t.walls.push(U.makeWall(s[0], s[1], s[2], s[3], t.center.x, t.center.y));
    }
    /* 内部导流墙（实心胶囊，两面都实心） */
    for (var b = 0; b < (def.bars || []).length; b++) {
      var bar = def.bars[b];
      t.bars.push(U.makeBar(bar[0], bar[1], bar[2], bar[3], bar[4]));
    }

    /* 元件：每张台面独立的状态副本，重开时重置 */
    for (var m = 0; m < def.bumpers.length; m++) {
      t.bumpers.push({ x: def.bumpers[m][0], y: def.bumpers[m][1], r: def.bumpers[m][2], pulse: 0, cool: 0, spin: Math.random() * 6.28 });
    }
    for (var p = 0; p < def.pegs.length; p++) {
      t.pegs.push({ x: def.pegs[p][0], y: def.pegs[p][1], r: 6, cool: 0, flash: 0 });
    }
    for (var g = 0; g < def.targets.length; g++) {
      t.targets.push({ x: def.targets[g][0], y: def.targets[g][1], r: def.targets[g][2], lit: false, cool: 0, flash: 0 });
    }
    for (var sl = 0; sl < def.slings.length; sl++) {
      var sg = def.slings[sl];
      t.slings.push({
        a: { x: sg.a[0], y: sg.a[1] },
        b: { x: sg.b[0], y: sg.b[1] },
        c: { x: sg.c[0], y: sg.c[1] },
        flash: 0
      });
    }

    /* 挡板 */
    t.flippers = {
      left: new PB.Flipper(def.flippers.left[0], def.flippers.left[1], 1, cfg),
      right: new PB.Flipper(def.flippers.right[0], def.flippers.right[1], -1, cfg)
    };

    return t;
  }

  PB.Tables = {
    list: TABLES,
    build: build,
    get: function (id) {
      for (var i = 0; i < TABLES.length; i++) if (TABLES[i].id === id) return TABLES[i];
      return null;
    },
    indexOf: function (id) {
      for (var i = 0; i < TABLES.length; i++) if (TABLES[i].id === id) return i;
      return 0;
    },
    orbitAt: orbitAt,
    orbitProject: orbitProject
  };
})();
