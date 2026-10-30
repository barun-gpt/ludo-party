import type { MusicStyle } from '../themes';

export type Sfx =
  | 'click'
  | 'select'
  | 'roll'
  | 'land'
  | 'step'
  | 'out'
  | 'capture'
  | 'home'
  | 'six'
  | 'safe'
  | 'win'
  | 'lose'
  | 'nomove'
  | 'buzz'
  | 'turn'
  | 'pop'
  | 'whoosh'
  | 'finish'
  | 'error';

const SCALE = [0, 2, 4, 5, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const MELODY: (number | null)[][] = [
  [0, null, 2, 4, 7, null, 4, 2],
  [4, null, 4, 5, 4, 2, 0, null],
  [2, 4, 7, null, 6, 4, 2, 4],
  [0, 2, 4, 2, 0, null, null, null],
  [7, 6, 4, null, 4, 2, 4, null],
  [2, null, 4, 2, 0, null, 2, 4],
  [4, 4, 7, 7, 6, 4, 2, null],
  [0, null, 2, null, 4, null, null, null],
];
const ARP = [0, 2, 4, 2, 7, 4, 2, 4];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const mod = (n: number, m: number) => ((n % m) + m) % m;

interface ToneOpts {
  a?: number;
  r?: number;
  slide?: number;
  pluck?: boolean;
  echo?: boolean;
  lp?: number;
  detune?: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private echoIn: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private style: MusicStyle | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private wantMusic = false;
  private ducked = false;
  musicOn = true;
  sfxOn = true;
  musicVol = 0.55;
  sfxVol = 0.85;

  get ready() {
    return !!this.ctx;
  }

  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      comp.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      // echo send for music
      this.echoIn = ctx.createGain();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.27;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      const wet = ctx.createGain();
      wet.gain.value = 0.38;
      this.echoIn.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(this.musicBus);
      // noise buffer
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.applyVolumes();
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend();
        else this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.wantMusic && this.musicOn) this.startScheduler();
  }

  applyVolumes() {
    if (!this.ctx || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    const mv = this.musicOn ? 0.34 * this.musicVol * (this.ducked ? 0.35 : 1) : 0;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(mv, t, 0.08);
    this.sfxBus.gain.cancelScheduledValues(t);
    this.sfxBus.gain.setTargetAtTime(this.sfxOn ? 0.9 * this.sfxVol : 0, t, 0.02);
  }

  setMusicOn(on: boolean) {
    this.musicOn = on;
    this.applyVolumes();
    if (on && this.wantMusic) this.startScheduler();
    if (!on) this.stopScheduler();
  }

  setSfxOn(on: boolean) {
    this.sfxOn = on;
    this.applyVolumes();
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.applyVolumes();
  }

  duck(on: boolean) {
    this.ducked = on;
    this.applyVolumes();
  }

  setStyle(style: MusicStyle) {
    const changed = this.style !== style;
    this.style = style;
    if (changed && this.timer != null && this.ctx) {
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.06;
    }
  }

  startMusic() {
    this.wantMusic = true;
    if (this.ctx && this.musicOn) this.startScheduler();
  }

  stopMusic() {
    this.wantMusic = false;
    this.stopScheduler();
  }

  private startScheduler() {
    if (this.timer != null || !this.ctx || !this.style) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private stopScheduler() {
    if (this.timer != null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    const ctx = this.ctx;
    const st = this.style;
    if (!ctx || !st || ctx.state !== 'running') return;
    const sd = 60 / st.bpm / 4;
    if (this.nextTime < ctx.currentTime - 0.1) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, st, sd);
      this.nextTime += sd;
      this.step++;
    }
  }

  private deg(st: MusicStyle, d: number, oct = 0) {
    return mtof(st.root + SCALE[mod(d, 7)] + 12 * Math.floor(d / 7) + 12 * oct);
  }

  private playStep(step: number, t: number, st: MusicStyle, sd: number) {
    const bus = this.musicBus!;
    const bar = Math.floor(step / 16) % 8;
    const s = step % 16;
    const prog = st.minor ? [5, 3, 0, 4, 5, 3, 0, 4] : [0, 4, 5, 3, 0, 4, 3, 4];
    const chord = prog[bar];

    if (st.drums > 0) {
      if (s === 0 || s === 8 || (st.drums === 2 && s === 10)) {
        this.tone(150, t, 0.1, 'sine', 0.42, bus, { slide: 42, r: 0.06 });
      }
      if (st.drums === 2 && (s === 4 || s === 12)) {
        this.noiseHit(t, 0.12, 1700, 0.16, 'bandpass', 0.8, bus);
      }
      if (s % 2 === 0) this.noiseHit(t, 0.03, 8000, s % 4 === 2 ? 0.07 : 0.035, 'highpass', 0.6, bus);
    }
    if (s % 4 === 0) {
      const d = chord + (s === 8 ? 4 : 0);
      this.tone(this.deg(st, d, -2), t, sd * 2.6, st.bass, 0.2, bus, { pluck: true, lp: 900 });
    }
    if (s % 2 === 0) {
      const ar = ARP[s / 2];
      this.tone(this.deg(st, chord + ar, 0), t, sd * 1.4, 'triangle', 0.045, bus, { pluck: true });
    }
    if (s % 2 === 0) {
      const m = MELODY[bar][s / 2];
      if (m !== null) {
        this.tone(this.deg(st, chord + m, 1), t, sd * 1.7, st.lead, 0.2 * st.leadVol, bus, {
          echo: st.echo,
          pluck: st.pluck,
          lp: st.lead === 'sawtooth' || st.lead === 'square' ? 2600 : undefined,
          a: 0.01,
        });
      }
    }
  }

  private tone(f: number, t: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, o: ToneOpts = {}) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.detune) osc.detune.value = o.detune;
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const a = o.a ?? 0.004;
    const r = o.r ?? 0.07;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (o.pluck) {
      g.gain.setTargetAtTime(0, t + a, Math.max(0.02, dur / 3));
    } else {
      g.gain.setValueAtTime(vol, t + Math.max(a, dur));
      g.gain.linearRampToValueAtTime(0, t + dur + r);
    }
    let node: AudioNode = osc;
    if (o.lp) {
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = o.lp;
      osc.connect(f2);
      node = f2;
    }
    node.connect(g);
    g.connect(dest);
    if (o.echo && this.echoIn) g.connect(this.echoIn);
    osc.start(t);
    osc.stop(t + dur + r + (o.pluck ? dur * 1.5 : 0) + 0.05);
  }

  private noiseHit(t: number, dur: number, freq: number, vol: number, type: BiquadFilterType, q: number, dest: AudioNode, sweepTo?: number) {
    const ctx = this.ctx!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
  }

  play(name: Sfx, opt: { i?: number; pitch?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxOn || !this.sfxBus || ctx.state !== 'running') return;
    const bus = this.sfxBus;
    const t = ctx.currentTime + 0.005;
    const R = Math.random;
    switch (name) {
      case 'click':
        this.tone(700, t, 0.03, 'square', 0.1, bus, { lp: 3000 });
        this.tone(1050, t + 0.025, 0.03, 'triangle', 0.12, bus);
        break;
      case 'select':
        this.tone(880, t, 0.04, 'triangle', 0.18, bus);
        break;
      case 'error':
        this.tone(200, t, 0.08, 'square', 0.1, bus, { lp: 1200 });
        this.tone(160, t + 0.09, 0.1, 'square', 0.1, bus, { lp: 1200 });
        break;
      case 'roll':
        for (let i = 0; i < 9; i++) {
          const tt = t + i * 0.058 + R() * 0.02;
          this.noiseHit(tt, 0.04, 2200 + R() * 2400, 0.32 - i * 0.02, 'bandpass', 2.5, bus);
          this.tone(260 + R() * 500, tt, 0.015, 'square', 0.035, bus, { lp: 2000 });
        }
        break;
      case 'land':
        this.tone(230, t, 0.12, 'sine', 0.5, bus, { slide: 70 });
        this.noiseHit(t, 0.07, 1100, 0.3, 'lowpass', 0.7, bus);
        break;
      case 'step': {
        const i = Math.max(0, Math.min(PENTA.length - 1, (opt.i ?? 1) - 1));
        const f = mtof(72 + PENTA[i]);
        this.tone(f, t, 0.07, 'triangle', 0.26, bus, { pluck: true });
        this.tone(f * 2, t, 0.03, 'sine', 0.07, bus, { pluck: true });
        break;
      }
      case 'pop': {
        const p = opt.pitch ?? 0;
        this.tone(420 + p * 60 + R() * 80, t, 0.07, 'sine', 0.22, bus, { slide: 1000 + p * 80 });
        break;
      }
      case 'out':
        this.tone(330, t, 0.22, 'sine', 0.32, bus, { slide: 990 });
        [1318, 1568, 2093].forEach((f, k) => this.tone(f, t + 0.12 + k * 0.05, 0.08, 'triangle', 0.12, bus, { pluck: true }));
        break;
      case 'whoosh':
        this.noiseHit(t, 0.32, 500, 0.3, 'bandpass', 1.2, bus, 3500);
        break;
      case 'capture':
        this.tone(900, t, 0.26, 'square', 0.14, bus, { slide: 110, lp: 2500 });
        this.noiseHit(t, 0.4, 700, 0.55, 'lowpass', 0.8, bus);
        this.tone(150, t, 0.42, 'sine', 0.62, bus, { slide: 38 });
        this.noiseHit(t + 0.05, 0.45, 600, 0.25, 'bandpass', 1, bus, 4000);
        break;
      case 'home':
        [72, 76, 79, 84, 88].forEach((m, k) => {
          this.tone(mtof(m), t + k * 0.07, 0.12, 'triangle', 0.24, bus, { pluck: true });
          this.tone(mtof(m + 12), t + k * 0.07, 0.08, 'sine', 0.06, bus, { pluck: true });
        });
        this.noiseHit(t + 0.3, 0.4, 7000, 0.08, 'highpass', 0.7, bus);
        break;
      case 'finish':
        [72, 76, 79, 84, 88, 91, 96].forEach((m, k) => {
          this.tone(mtof(m), t + k * 0.065, 0.14, 'triangle', 0.24, bus, { pluck: true });
          this.tone(mtof(m), t + k * 0.065, 0.1, 'square', 0.05, bus, { pluck: true, lp: 3000 });
        });
        break;
      case 'six':
        this.tone(784, t, 0.07, 'square', 0.1, bus, { lp: 3500 });
        this.tone(1175, t + 0.08, 0.14, 'square', 0.1, bus, { lp: 3500 });
        this.tone(1568, t + 0.08, 0.16, 'triangle', 0.12, bus, { pluck: true });
        break;
      case 'safe':
        this.tone(1320, t, 0.1, 'sine', 0.14, bus, { pluck: true });
        this.tone(1760, t + 0.06, 0.14, 'sine', 0.12, bus, { pluck: true });
        break;
      case 'win': {
        const seq = [72, 76, 79, 84];
        seq.forEach((m, k) => {
          this.tone(mtof(m), t + k * 0.13, 0.11, 'square', 0.09, bus, { lp: 3000 });
          this.tone(mtof(m), t + k * 0.13, 0.11, 'triangle', 0.18, bus);
        });
        [84, 88, 91].forEach((m) => {
          this.tone(mtof(m), t + 0.56, 0.6, 'triangle', 0.14, bus, { r: 0.4 });
          this.tone(mtof(m), t + 0.56, 0.6, 'square', 0.04, bus, { r: 0.4, lp: 2500 });
        });
        break;
      }
      case 'lose':
        [67, 66, 65].forEach((m, k) => this.tone(mtof(m), t + k * 0.28, 0.22, 'triangle', 0.2, bus));
        this.tone(mtof(64), t + 0.84, 0.6, 'triangle', 0.2, bus, { slide: mtof(62) });
        break;
      case 'nomove':
        this.tone(392, t, 0.17, 'sawtooth', 0.13, bus, { slide: 370, lp: 1400 });
        this.tone(330, t + 0.22, 0.3, 'sawtooth', 0.13, bus, { slide: 280, lp: 1100 });
        break;
      case 'buzz':
        this.tone(110, t, 0.35, 'square', 0.16, bus, { lp: 1500 });
        this.tone(117, t, 0.35, 'square', 0.12, bus, { lp: 1500 });
        break;
      case 'turn':
        this.tone(mtof(79), t, 0.08, 'sine', 0.16, bus, { pluck: true });
        this.tone(mtof(86), t + 0.07, 0.1, 'sine', 0.12, bus, { pluck: true });
        break;
    }
  }
}

export const audio = new AudioEngine();
