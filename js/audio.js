/* =============================================================================
 * audio.js — WebAudio 实时合成音效（无任何外部音频文件）
 * ========================================================================== */
(function () {
  'use strict';

  var PB = window.PB;

  var Sound = {
    ctx: null,
    master: null,
    lastWall: 0,
    enabled: true,

    /** 首次用户交互后初始化音频上下文 */
    init: function () {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.30;
        this.master.connect(this.ctx.destination);
      } catch (err) {
        this.ctx = null;
      }
    },

    /** 基础合成音：频率可滑动 */
    tone: function (freq, dur, type, vol, slideTo) {
      if (!this.ctx || !this.enabled) return;
      var t = this.ctx.currentTime;
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, freq), t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    },

    /** 一串音符（用于奖励 / 结束音） */
    seq: function (list, step, type, vol) {
      if (!this.ctx || !this.enabled) return;
      for (var i = 0; i < list.length; i++) {
        var t = this.ctx.currentTime + i * step;
        var osc = this.ctx.createOscillator();
        var gain = this.ctx.createGain();
        osc.type = type || 'triangle';
        osc.frequency.setValueAtTime(list[i], t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.25);
      }
    },

    launch: function (p) { this.tone(200 + p * 260, 0.20, 'square', 0.07, 700 + p * 500); },
    bumper: function () { this.tone(540, 0.11, 'square', 0.075, 960); },
    peg: function () { this.tone(980, 0.05, 'triangle', 0.045, 1400); },
    target: function () { this.tone(680, 0.16, 'triangle', 0.08, 1280); },
    sling: function () { this.tone(430, 0.08, 'square', 0.055, 820); },
    orbitStep: function () { this.tone(760, 0.06, 'sine', 0.05, 1080); },
    orbitIn: function () { this.tone(300, 0.16, 'sine', 0.05, 900); },
    orbitDone: function () { this.seq([784, 988, 1175, 1568], 0.06, 'triangle', 0.075); },
    multiball: function () { this.seq([523, 784, 1046, 784, 1046, 1318], 0.085, 'square', 0.06); },
    ballLost: function () { this.tone(420, 0.22, 'sawtooth', 0.045, 180); },
    bonus: function () { this.seq([523, 659, 784, 1046, 1318], 0.075, 'triangle', 0.075); },
    flipper: function () { this.tone(150, 0.055, 'sawtooth', 0.045, 90); },
    drain: function () { this.tone(320, 0.55, 'sawtooth', 0.06, 64); },
    over: function () { this.seq([440, 349, 262, 175], 0.16, 'square', 0.06); },
    select: function () { this.tone(660, 0.07, 'triangle', 0.05, 990); },
    start: function () { this.seq([392, 523, 659], 0.06, 'triangle', 0.07); },
    wall: function () {
      var now = performance.now();
      if (now - this.lastWall < 70) return;
      this.lastWall = now;
      this.tone(190, 0.045, 'sine', 0.035, 130);
    }
  };

  PB.Sound = Sound;
})();
