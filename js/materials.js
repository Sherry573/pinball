/* =============================================================================
 * materials.js — 程序化材质
 *   台面底板（拉丝金属 / 碳纤编织 / 星云）一次性烘焙到离屏 canvas，
 *   之后每帧只需一次 drawImage；磨砂颗粒直接烘进底板，不产生逐帧开销。
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;
  var C = PB.CONFIG;
  var W = C.width;
  var H = C.height;
  var BLEED = 24;            // 外扩一圈，震屏 / 推镜时边缘不露底

  var noiseTile = null;

  /** 128×128 的噪点瓦片（只生成一次，之后复用为 pattern） */
  function getNoise() {
    if (noiseTile) return noiseTile;
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var g = c.getContext('2d');
    var img = g.createImageData(128, 128);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var on = Math.random() < 0.42;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = on ? Math.floor(Math.random() * 26) : 0;
    }
    g.putImageData(img, 0, 0);
    noiseTile = c;
    return c;
  }

  /* ------------------------------------------------------------ 表面纹理 */

  function brushed(g, theme) {
    // 拉丝：大量极低透明度的横向细线 + 少量亮痕
    for (var i = 0; i < 460; i++) {
      var y = Math.random() * H;
      var x0 = Math.random() * W - 40;
      var len = 60 + Math.random() * 300;
      var a = Math.random() * 0.022;
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a * 1.6 + ')';
      g.lineWidth = Math.random() < 0.12 ? 1.4 : 0.7;
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x0 + len, y);
      g.stroke();
    }
    // 金属冷调高光带
    var lg = g.createLinearGradient(0, 120, W, 560);
    lg.addColorStop(0, 'rgba(255,255,255,0.030)');
    lg.addColorStop(0.42, 'rgba(255,255,255,0.000)');
    lg.addColorStop(0.62, 'rgba(255,255,255,0.026)');
    lg.addColorStop(1, 'rgba(255,255,255,0.000)');
    g.fillStyle = lg;
    g.fillRect(0, 0, W, H);
  }

  function weave(g, theme) {
    // 金箔压花：稀疏的 ±45° 压线 + 大尺度方格，避免细密网格带来的"帆布感"
    g.save();
    g.lineWidth = 1;
    for (var i = -H; i < W + H; i += 11) {
      g.strokeStyle = 'rgba(255,255,255,0.012)';
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + H, H);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.09)';
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i - H, H);
      g.stroke();
    }
    g.restore();

    for (var x = 0; x < W; x += 28) {
      for (var y = 0; y < H; y += 28) {
        if (((x / 28) + (y / 28)) % 2 === 0) {
          g.fillStyle = 'rgba(255,255,255,0.009)';
          g.fillRect(x, y, 28, 28);
        }
      }
    }
    // 暖色环境光，突出"熔金"
    var rg = g.createRadialGradient(W / 2, 260, 30, W / 2, 340, 470);
    rg.addColorStop(0, 'rgba(255,170,90,0.09)');
    rg.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  }

  function nebula(g, theme, accent) {
    // 星云：若干低透明度色团 + 星点
    var colors = [accent, theme.bumper, '#ffffff'];
    for (var i = 0; i < 26; i++) {
      var x = Math.random() * W;
      var y = Math.random() * H * 0.85;
      var r = 40 + Math.random() * 150;
      var col = colors[Math.floor(Math.random() * colors.length)];
      var rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, PB.util.rgba(col, 0.10));
      rg.addColorStop(1, PB.util.rgba(col, 0));
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (var s = 0; s < 90; s++) {
      var sx = Math.random() * W;
      var sy = Math.random() * H;
      var sr = Math.random() * 1.1 + 0.2;
      g.fillStyle = 'rgba(255,255,255,' + (0.05 + Math.random() * 0.22) + ')';
      g.beginPath();
      g.arc(sx, sy, sr, 0, Math.PI * 2);
      g.fill();
    }
  }

  /* ------------------------------------------------------------ 底板烘焙 */

  function buildSurface(table) {
    var th = table.theme;
    var c = document.createElement('canvas');
    c.width = W + BLEED * 2;
    c.height = H + BLEED * 2;
    var g = c.getContext('2d');
    g.translate(BLEED, BLEED);

    /* 1. 底色：中心亮、四周沉的径向渐变 */
    var rg = g.createRadialGradient(W / 2, 240, 40, W / 2, 420, 640);
    rg.addColorStop(0, th.bg.top);
    rg.addColorStop(0.55, th.bg.mid);
    rg.addColorStop(1, th.bg.bottom);
    g.fillStyle = rg;
    g.fillRect(-BLEED, -BLEED, W + BLEED * 2, H + BLEED * 2);

    /* 2. 表面纹理 */
    if (th.surface === 'weave') weave(g, th);
    else if (th.surface === 'nebula') nebula(g, th, table.accent);
    else brushed(g, th);

    /* 3. 图形母题：网格 / 条带 / 晶格 + 台面专属装饰（见 motifs.js）
     *    这是"骨架级差异"的主载体 —— 三张台面在这里就已经是三种图形语法了 */
    var motif = PB.Motifs.of(table);
    motif.surface(g, table);

    /* 4. 顶部环境光 + 底部压暗（让台面像一块有厚度的板） */
    var tg = g.createRadialGradient(240, 130, 10, 240, 130, 300);
    tg.addColorStop(0, th.bg.glow);
    tg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = tg;
    g.fillRect(-BLEED, -BLEED, W + BLEED * 2, 520);

    var bg2 = g.createLinearGradient(0, 620, 0, H);
    bg2.addColorStop(0, 'rgba(0,0,0,0)');
    bg2.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = bg2;
    g.fillRect(-BLEED, 600, W + BLEED * 2, H - 600 + BLEED);

    /* 5. 四周内阴影：暗角，把视线压向台面中心 */
    var vg = g.createRadialGradient(W / 2, 430, 150, W / 2, 430, 600);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.7, 'rgba(0,0,0,0.22)');
    vg.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = vg;
    g.fillRect(-BLEED, -BLEED, W + BLEED * 2, H + BLEED * 2);

    /* 6. 磨砂颗粒（直接烘进去，运行时零成本） */
    var pat = g.createPattern(getNoise(), 'repeat');
    if (pat) {
      g.fillStyle = pat;
      g.fillRect(-BLEED, -BLEED, W + BLEED * 2, H + BLEED * 2);
    }

    /* 7. 台面品牌蚀刻字 */
    g.save();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 14px "Segoe UI", system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.075)';
    g.fillText(table.brand, W / 2, 74);
    g.font = '700 8px "Segoe UI", system-ui, sans-serif';
    g.fillStyle = PB.util.rgba(table.accent, 0.10);
    g.fillText('· ' + table.name + ' ·', W / 2, 92);
    g.restore();

    return c;
  }

  var Materials = {
    current: null,
    cache: {},

    /** 切换台面时调用：命中缓存直接复用，首次访问才烘焙 */
    prepare: function (table) {
      if (!this.cache[table.id]) this.cache[table.id] = buildSurface(table);
      this.current = this.cache[table.id];
    },

    /** 预烘焙全部台面，避免第一次切台时卡一帧 */
    warmup: function () {
      for (var i = 0; i < PB.Tables.list.length; i++) {
        var def = PB.Tables.list[i];
        if (!this.cache[def.id]) this.cache[def.id] = buildSurface(PB.Tables.build(def));
      }
    },

    BLEED: BLEED
  };

  PB.Materials = Materials;
})();
