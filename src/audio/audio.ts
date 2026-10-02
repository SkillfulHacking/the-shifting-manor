import * as THREE from 'three';

/**
 * GameAudio: fully procedural Web Audio sound engine for The Shifting Manor.
 * No audio files. Every sound is synthesized from noise buffers, oscillators,
 * filters, envelopes and a generated convolution reverb.
 */

type SfxName = 'creak' | 'whisper' | 'candleLight' | 'candleSnuff' | 'doorOpen' | 'clockTick';
type NoiseKind = 'white' | 'pink' | 'brown';

interface Live {
  end: number;
  nodes: AudioNode[];
}

const r = (a: number, b: number): number => a + Math.random() * (b - a);
const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const MIN = 0.0001;
const MUSIC_TRIM = 0.17;

// D harmonic minor, semitone offsets from D
const SCALE = [0, 2, 3, 5, 7, 8, 11];
const D5 = 74;

class ConvolutionReverb {
  readonly input: GainNode;
  readonly output: GainNode;
  private conv: ConvolverNode;

  constructor(ctx: AudioContext, seconds: number, darkness: number, predelay = 0.012) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.conv = ctx.createConvolver();
    this.conv.normalize = true;
    this.conv.buffer = ConvolutionReverb.impulse(ctx, seconds, darkness, predelay);
    this.input.connect(this.conv);
    this.conv.connect(this.output);
  }

  static impulse(ctx: AudioContext, seconds: number, darkness: number, predelay: number): AudioBuffer {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, len, sr);
    const pd = Math.floor(predelay * sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      for (let i = pd; i < len; i++) {
        const x = (i - pd) / (len - pd);
        const env = Math.pow(1 - x, 2.2) * Math.exp(-x * 3.2);
        // one-pole lowpass that darkens with time
        const k = 0.9 - 0.85 * Math.pow(x, 0.5) * darkness;
        lp += (Math.random() * 2 - 1 - lp) * Math.max(0.04, k);
        d[i] = lp * env;
      }
    }
    return buf;
  }

  dispose(): void {
    try {
      this.input.disconnect();
      this.conv.disconnect();
      this.output.disconnect();
    } catch {
      /* ignore */
    }
  }
}

interface MusicRig {
  srcs: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  gate: GainNode;
  padFilter: BiquadFilterNode;
  padAmp: GainNode;
  pulseDepth: GainNode;
  pulseLfo: OscillatorNode;
  dissGain: GainNode;
  droneGain: GainNode;
  pluckIn: GainNode;
  colors: OscillatorNode[];
}

interface AmbRig {
  srcs: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  gate: GainNode;
  windGain: GainNode;
  gustGain: GainNode;
  whistle: GainNode;
  windBand: BiquadFilterNode;
}

interface GhostRig {
  srcs: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  gain: GainNode;
}

interface HearthRig {
  srcs: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  gain: GainNode;
  panner: PannerNode | null;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private resuming: Promise<void> | null = null;

  // buses
  private master!: GainNode;
  private comp!: DynamicsCompressorNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private sfxIn!: GainNode;
  private weatherIn!: GainNode;
  private indoorLP!: BiquadFilterNode;
  private weatherOut!: GainNode;
  private hall!: ConvolutionReverb;
  private room!: ConvolutionReverb;
  private hallSend!: GainNode;
  private roomSend!: GainNode;

  // buffers
  private noiseBufs: Partial<Record<NoiseKind, AudioBuffer>> = {};
  private crackleBuf: AudioBuffer | null = null;
  private dropBuf: AudioBuffer | null = null;

  // settings (kept until ctx exists)
  private vMaster = 0.8;
  private vMusic = 0.7;
  private vSfx = 0.9;
  private indoor = 0.5;
  private tensionTarget = 0;
  private tensionCur = 0;
  private phase = 0;
  private wantAmbience = false;
  private wantGhost = false;
  private wantHearth: { on: boolean; pos?: THREE.Vector3 } | null = null;

  // rigs
  private amb: AmbRig | null = null;
  private music: MusicRig | null = null;
  private ghost: GhostRig | null = null;
  private hearth: HearthRig | null = null;
  private live: Live[] = [];

  // scheduling (driven by update)
  private tickToggle = false;
  private nextPhraseAt = 0;
  private scaleIdx = 7;
  private colorT = 0;
  private creakT = 10;
  private thunderT = 30;
  private gustT = 5;
  private whisperT = 6;
  private applyT = 0;

  private camPos = new THREE.Vector3();
  private tmpDir = new THREE.Vector3();
  private tmpUp = new THREE.Vector3();
  private tmpQ = new THREE.Quaternion();

  constructor() {
    /* AudioContext is created lazily in resume() (browser autoplay policy). */
  }

  // ------------------------------------------------------------------ setup

  resume(): Promise<void> {
    if (this.resuming && this.ctx && this.ctx.state === 'running') return this.resuming;
    this.resuming = (async () => {
      try {
        if (!this.ctx) this.build();
        if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
        this.applyPending();
      } catch {
        /* never throw */
      }
    })();
    return this.resuming;
  }

  private build(): void {
    const Ctor: typeof AudioContext | undefined =
      (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 14;
    this.comp.ratio.value = 4;
    this.comp.attack.value = 0.006;
    this.comp.release.value = 0.28;
    this.comp.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = this.vMaster;
    this.master.connect(this.comp);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.vMusic * MUSIC_TRIM;
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.vSfx;
    this.sfxBus.connect(this.master);

    this.hall = new ConvolutionReverb(ctx, 3.8, 1.0, 0.02);
    this.room = new ConvolutionReverb(ctx, 1.1, 0.8, 0.008);
    this.hall.output.gain.value = 0.9;
    this.room.output.gain.value = 0.8;
    this.hall.output.connect(this.master);
    this.room.output.connect(this.sfxBus);
    this.hallSend = ctx.createGain();
    this.hallSend.gain.value = 0.32;
    this.hallSend.connect(this.hall.input);
    this.roomSend = ctx.createGain();
    this.roomSend.gain.value = 0.22;
    this.roomSend.connect(this.room.input);

    // all one-shot sfx enter here: dry + room + a little hall
    this.sfxIn = ctx.createGain();
    this.sfxIn.connect(this.sfxBus);
    this.sfxIn.connect(this.roomSend);
    const sfxHall = ctx.createGain();
    sfxHall.gain.value = 0.35;
    this.sfxIn.connect(sfxHall);
    sfxHall.connect(this.hallSend);

    // weather chain (rain, wind, thunder): indoor muffling
    this.weatherIn = ctx.createGain();
    this.indoorLP = ctx.createBiquadFilter();
    this.indoorLP.type = 'lowpass';
    this.indoorLP.Q.value = 0.5;
    this.weatherOut = ctx.createGain();
    this.weatherIn.connect(this.indoorLP);
    this.indoorLP.connect(this.weatherOut);
    this.weatherOut.connect(this.sfxBus);
    const wHall = ctx.createGain();
    wHall.gain.value = 0.5;
    this.weatherOut.connect(wHall);
    wHall.connect(this.hallSend);
    this.applyIndoor(true);

    this.makeBuffers();
  }

  private makeBuffers(): void {
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const mk = (kind: NoiseKind, secs: number): AudioBuffer => {
      const b = ctx.createBuffer(1, Math.floor(sr * secs), sr);
      const d = b.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      let max = 0.0001;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        let v = w;
        if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          v = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
          b6 = w * 0.115926;
        } else if (kind === 'brown') {
          last = (last + 0.02 * w) / 1.02;
          v = last;
        }
        d[i] = v;
        const a = Math.abs(v);
        if (a > max) max = a;
      }
      const g = 0.95 / max;
      for (let i = 0; i < d.length; i++) d[i] *= g;
      // seamless loop: crossfade tail into head
      const fade = Math.min(2048, d.length >> 2);
      for (let i = 0; i < fade; i++) {
        const k = i / fade;
        d[i] = d[i] * k + d[d.length - fade + i] * (1 - k);
      }
      return b;
    };
    this.noiseBufs.white = mk('white', 4);
    this.noiseBufs.pink = mk('pink', 6);
    this.noiseBufs.brown = mk('brown', 6);

    // sparse crackle (fire / candle)
    const cl = 4;
    const cb = ctx.createBuffer(1, Math.floor(sr * cl), sr);
    const cd = cb.getChannelData(0);
    let n = 0;
    while (n < cd.length) {
      n += Math.floor(r(0.004, 0.09) * sr * (Math.random() < 0.25 ? 0.15 : 1));
      const amp = Math.pow(Math.random(), 2.2) * 0.9 + 0.05;
      const life = Math.floor(r(0.0008, 0.006) * sr);
      for (let i = 0; i < life && n + i < cd.length; i++) {
        cd[n + i] += (Math.random() * 2 - 1) * amp * Math.exp((-5 * i) / life);
      }
    }
    this.crackleBuf = cb;

    // rain droplets
    const db = ctx.createBuffer(1, Math.floor(sr * 5), sr);
    const dd = db.getChannelData(0);
    for (let i = 0; i < dd.length; ) {
      i += Math.floor(r(0.0006, 0.012) * sr);
      const amp = Math.pow(Math.random(), 1.8) * 0.8;
      const life = Math.floor(r(0.0005, 0.0025) * sr);
      for (let k = 0; k < life && i + k < dd.length; k++) {
        dd[i + k] += (Math.random() * 2 - 1) * amp * Math.exp((-4 * k) / life);
      }
    }
    this.dropBuf = db;
  }

  private applyPending(): void {
    if (!this.ctx) return;
    if (this.wantAmbience && !this.amb) this.buildAmbience();
    if (this.wantGhost && !this.ghost) this.buildGhost();
    if (this.wantHearth && this.wantHearth.on && !this.hearth) {
      this.buildHearth(this.wantHearth.pos);
    }
    this.applyMusicParams(true);
  }

  // ---------------------------------------------------------------- volumes

  setMaster(v: number): void {
    this.vMaster = clamp01(v);
    this.ramp(this.master?.gain, this.vMaster, 0.05);
  }
  setMusic(v: number): void {
    this.vMusic = clamp01(v);
    this.ramp(this.musicBus?.gain, this.vMusic * MUSIC_TRIM, 0.05);
  }
  setSfx(v: number): void {
    this.vSfx = clamp01(v);
    this.ramp(this.sfxBus?.gain, this.vSfx, 0.05);
  }

  private ramp(p: AudioParam | undefined, v: number, tc: number): void {
    if (!p || !this.ctx) return;
    try {
      p.setTargetAtTime(v, this.ctx.currentTime, tc);
    } catch {
      /* ignore */
    }
  }

  // ------------------------------------------------------------- primitives

  private get ok(): boolean {
    return !!this.ctx && this.ctx.state !== 'closed' && this.live.length < 500;
  }

  private now(): number {
    return this.ctx!.currentTime;
  }

  private track(end: number, nodes: AudioNode[]): void {
    this.live.push({ end: end + 0.15, nodes });
  }

  private prune(): void {
    if (!this.ctx || this.live.length === 0) return;
    const t = this.ctx.currentTime;
    let w = 0;
    for (let i = 0; i < this.live.length; i++) {
      const l = this.live[i];
      if (l.end < t) {
        for (const n of l.nodes) {
          try {
            n.disconnect();
          } catch {
            /* ignore */
          }
        }
      } else this.live[w++] = l;
    }
    this.live.length = w;
  }

  private safe(fn: () => void): void {
    try {
      fn();
    } catch (e) {
      // swallow; audio must never break the game
      void e;
    }
  }

  private noiseSrc(kind: NoiseKind, t: number, dur: number, loop = true): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    const buf = this.noiseBufs[kind]!;
    s.buffer = buf;
    s.loop = loop;
    s.start(t, Math.random() * (buf.duration - 0.1));
    if (dur > 0) s.stop(t + dur);
    return s;
  }

  private env(p: AudioParam, t: number, a: number, peak: number, dur: number): void {
    p.setValueAtTime(MIN, t);
    p.linearRampToValueAtTime(Math.max(peak, MIN), t + a);
    p.exponentialRampToValueAtTime(MIN, t + dur);
  }

  /** Filtered noise burst with exponential-swept filter and exponential decay. */
  private burst(
    dest: AudioNode, t: number, dur: number, kind: NoiseKind, type: BiquadFilterType,
    f0: number, f1: number, q: number, peak: number, a = 0.004,
  ): void {
    const ctx = this.ctx!;
    const s = this.noiseSrc(kind, t, dur + 0.08);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g.gain, t, a, peak, dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    this.track(t + dur + 0.1, [s, f, g]);
  }

  private tone(
    dest: AudioNode, t: number, dur: number, type: OscillatorType,
    f0: number, f1: number, peak: number, a = 0.004, detune = 0,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    this.env(g.gain, t, a, peak, dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    this.track(t + dur + 0.05, [o, g]);
  }

  private panner(pos: THREE.Vector3, ref = 1.5): PannerNode {
    const p = this.ctx!.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.maxDistance = 60;
    p.rolloffFactor = 1.3;
    this.setPannerPos(p, pos);
    p.connect(this.sfxIn);
    return p;
  }

  private setPannerPos(p: PannerNode, v: THREE.Vector3): void {
    const t = this.now();
    if (p.positionX) {
      p.positionX.setValueAtTime(v.x, t);
      p.positionY.setValueAtTime(v.y, t);
      p.positionZ.setValueAtTime(v.z, t);
    } else {
      p.setPosition(v.x, v.y, v.z);
    }
  }

  // ------------------------------------------------------------------ frame

  update(dt: number, camera: THREE.Camera): void {
    this.safe(() => {
      if (!this.ctx || !Number.isFinite(dt)) return;
      dt = Math.min(Math.max(dt, 0), 0.25);
      this.updateListener(camera);
      this.prune();
      if (this.ctx.state !== 'running') return;

      // smooth tension
      const dT = this.tensionTarget - this.tensionCur;
      this.tensionCur += Math.sign(dT) * Math.min(Math.abs(dT), dt * 0.35);
      this.applyT -= dt;
      if (this.applyT <= 0) {
        this.applyT = 0.1;
        this.applyMusicParams(false);
      }

      if (this.amb) this.randomEvents(dt);
      if (this.music) this.musicTick(dt);
      if (this.ghost) {
        this.whisperT -= dt;
        if (this.whisperT <= 0) {
          this.whisperT = r(4, 9);
          this.playAt('whisper', this.randomAround(1.5, 4));
        }
      }
    });
  }

  private updateListener(camera: THREE.Camera): void {
    const l = this.ctx!.listener;
    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(this.camPos);
    camera.getWorldQuaternion(this.tmpQ);
    this.tmpDir.set(0, 0, -1).applyQuaternion(this.tmpQ);
    this.tmpUp.set(0, 1, 0).applyQuaternion(this.tmpQ);
    const p = this.camPos, f = this.tmpDir, u = this.tmpUp;
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = f.x; l.forwardY.value = f.y; l.forwardZ.value = f.z;
      l.upX.value = u.x; l.upY.value = u.y; l.upZ.value = u.z;
    } else {
      l.setPosition(p.x, p.y, p.z);
      l.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  private randomAround(min: number, max: number): THREE.Vector3 {
    const a = Math.random() * Math.PI * 2;
    const d = r(min, max);
    return new THREE.Vector3(this.camPos.x + Math.cos(a) * d, this.camPos.y + r(-0.5, 1.5), this.camPos.z + Math.sin(a) * d);
  }

  private randomEvents(dt: number): void {
    const ph = this.phase;
    this.creakT -= dt;
    if (this.creakT <= 0) {
      this.creakT = r(12, 32) / (1 + ph * 0.3);
      this.playAt('creak', this.randomAround(3, 10));
    }
    this.thunderT -= dt;
    if (this.thunderT <= 0) {
      this.thunderT = r(28, 75) / (1 + ph * 0.2);
      this.thunder(Math.random() < 0.2 ? r(0.25, 0.5) : r(0.55, 1));
    }
    this.gustT -= dt;
    if (this.gustT <= 0 && this.amb) {
      this.gustT = r(6, 14) / (1 + ph * 0.15);
      const t = this.now();
      const strength = r(0.3, 1) * (1 + ph * 0.15);
      this.amb.gustGain.gain.cancelScheduledValues(t);
      this.amb.gustGain.gain.setTargetAtTime(1 + strength, t, 1.2);
      this.amb.gustGain.gain.setTargetAtTime(1, t + r(2.5, 4), 1.8);
      this.amb.windBand.frequency.setTargetAtTime(300 + strength * 350, t, 1.0);
      this.amb.windBand.frequency.setTargetAtTime(330, t + 3, 2.0);
    }
  }

  // ------------------------------------------------------------- ambience

  startAmbience(): void {
    this.wantAmbience = true;
    this.safe(() => {
      if (!this.ok || this.amb) return;
      this.buildAmbience();
    });
  }

  stopAmbience(): void {
    this.wantAmbience = false;
    this.safe(() => {
      if (!this.ctx) return;
      const t = this.now();
      if (this.amb) {
        this.stopRig(this.amb, this.amb.gate, t, 2.0);
        this.amb = null;
      }
      if (this.music) {
        this.stopRig(this.music, this.music.gate, t, 3.0);
        this.music = null;
      }
    });
  }

  private stopRig(rig: { srcs: AudioScheduledSourceNode[]; nodes: AudioNode[] }, gate: GainNode, t: number, fade: number): void {
    gate.gain.cancelScheduledValues(t);
    gate.gain.setValueAtTime(gate.gain.value, t);
    gate.gain.linearRampToValueAtTime(0, t + fade);
    for (const s of rig.srcs) {
      try {
        s.stop(t + fade + 0.05);
      } catch {
        /* already stopped */
      }
    }
    this.track(t + fade + 0.1, [...rig.srcs, ...rig.nodes, gate]);
  }

  private buildAmbience(): void {
    const ctx = this.ctx!;
    const t = this.now();
    const srcs: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(0, t);
    gate.gain.linearRampToValueAtTime(1, t + 3);
    gate.connect(this.weatherIn);

    const loopSrc = (buf: AudioBuffer, rate = 1): AudioBufferSourceNode => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.playbackRate.value = rate;
      s.start(t, Math.random() * (buf.duration - 0.2));
      srcs.push(s);
      return s;
    };
    const lfo = (freq: number, depth: number, target: AudioParam): void => {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = depth;
      o.connect(g);
      g.connect(target);
      o.start(t);
      srcs.push(o);
      nodes.push(g);
    };

    // rain bed: two noise layers + droplet crackle
    const rainBody = ctx.createGain();
    rainBody.gain.value = 0.085;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 500;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 7000;
    loopSrc(this.noiseBufs.white!, 0.97).connect(hp);
    hp.connect(lp); lp.connect(rainBody); rainBody.connect(gate);
    lfo(0.07, 0.02, rainBody.gain);

    const rainLow = ctx.createGain();
    rainLow.gain.value = 0.11;
    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'bandpass'; lp2.frequency.value = 1200; lp2.Q.value = 0.6;
    loopSrc(this.noiseBufs.pink!, 1.03).connect(lp2);
    lp2.connect(rainLow); rainLow.connect(gate);
    lfo(0.05, 0.03, rainLow.gain);
    lfo(0.03, 250, lp2.frequency);

    const drops = ctx.createGain();
    drops.gain.value = 0.16;
    const dbp = ctx.createBiquadFilter();
    dbp.type = 'bandpass'; dbp.frequency.value = 3600; dbp.Q.value = 0.7;
    loopSrc(this.dropBuf!, 1).connect(dbp);
    dbp.connect(drops); drops.connect(gate);
    lfo(0.09, 0.05, drops.gain);

    // wind
    const windBand = ctx.createBiquadFilter();
    windBand.type = 'bandpass'; windBand.frequency.value = 330; windBand.Q.value = 1.6;
    lfo(0.061, 140, windBand.frequency);
    const windGain = ctx.createGain();
    windGain.gain.value = 0.34;
    lfo(0.083, 0.14, windGain.gain);
    lfo(0.19, 0.05, windGain.gain);
    const gustGain = ctx.createGain();
    gustGain.gain.value = 1;
    loopSrc(this.noiseBufs.pink!, 0.8).connect(windBand);
    windBand.connect(windGain); windGain.connect(gustGain); gustGain.connect(gate);

    // faint whistle through the eaves
    const whistleF = ctx.createBiquadFilter();
    whistleF.type = 'bandpass'; whistleF.frequency.value = 820; whistleF.Q.value = 14;
    lfo(0.045, 160, whistleF.frequency);
    const whistle = ctx.createGain();
    whistle.gain.value = 0.02;
    lfo(0.07, 0.015, whistle.gain);
    loopSrc(this.noiseBufs.pink!, 1.1).connect(whistleF);
    whistleF.connect(whistle); whistle.connect(gustGain);

    nodes.push(rainBody, hp, lp, rainLow, lp2, drops, dbp, windBand, windGain, gustGain, whistleF, whistle);
    this.amb = { srcs, nodes, gate, windGain, gustGain, whistle, windBand };

    this.buildMusic();
    this.applyMusicParams(true);
    const now = this.now();
    this.nextPhraseAt = now + r(4, 8);
    this.colorT = r(8, 14);
  }

  setIndoor(amount: number): void {
    this.indoor = clamp01(amount);
    this.safe(() => this.applyIndoor(false));
  }

  private applyIndoor(immediate: boolean): void {
    if (!this.ctx) return;
    const a = this.indoor;
    const f = 380 * Math.pow(9000 / 380, 1 - a);
    const g = 1 - 0.6 * a;
    const t = this.now();
    if (immediate) {
      this.indoorLP.frequency.setValueAtTime(f, t);
      this.weatherOut.gain.setValueAtTime(g, t);
    } else {
      this.indoorLP.frequency.setTargetAtTime(f, t, 0.5);
      this.weatherOut.gain.setTargetAtTime(g, t, 0.5);
    }
  }

  setClockPhase(phase: number): void {
    this.phase = Math.min(4, Math.max(0, Number.isFinite(phase) ? phase : 0));
    this.safe(() => this.applyMusicParams(false));
  }

  setTension(level: number): void {
    this.tensionTarget = clamp01(level);
  }

  // ---------------------------------------------------------------- music

  private buildMusic(): void {
    const ctx = this.ctx!;
    const t = this.now();
    const srcs: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    const gate = ctx.createGain();
    gate.gain.setValueAtTime(0, t);
    gate.gain.linearRampToValueAtTime(1, t + 5);
    gate.connect(this.musicBus);
    const rev = ctx.createGain();
    rev.gain.value = 0.7;
    gate.connect(rev);
    rev.connect(this.hallSend);

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass'; padFilter.frequency.value = 500; padFilter.Q.value = 0.8;
    const padAmp = ctx.createGain();
    padAmp.gain.value = 0.16;
    padFilter.connect(padAmp);
    padAmp.connect(gate);

    const osc = (type: OscillatorType, f: number, det: number, dest: AudioNode, level: number): OscillatorNode => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = level;
      o.connect(g); g.connect(dest); o.start(t);
      srcs.push(o); nodes.push(g);
      return o;
    };
    const lfo = (freq: number, depth: number, target: AudioParam): OscillatorNode => {
      const o = ctx.createOscillator();
      o.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = depth;
      o.connect(g); g.connect(target); o.start(t);
      srcs.push(o); nodes.push(g);
      return o;
    };

    // Dm pad: detuned triangles
    for (const f of [146.83, 174.61, 220.0, 261.63]) {
      osc('triangle', f, -7, padFilter, 0.5);
      osc('triangle', f, +8, padFilter, 0.5);
    }
    osc('sine', 293.66, 0, padFilter, 0.25);
    lfo(0.045, 250, padFilter.frequency);
    lfo(0.023, 0.03, padAmp.gain);

    // low drone
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.22;
    droneGain.connect(gate);
    osc('sine', 73.42, 0, droneGain, 0.8);
    osc('triangle', 73.42, 5, droneGain, 0.3);
    osc('sine', 110.0, 3, droneGain, 0.25);

    // roaming colour voices (generative chord drift)
    const colors = [
      osc('sine', 349.23, 0, padFilter, 0.3),
      osc('sine', 440.0, 0, padFilter, 0.3),
    ];

    // dissonant layer: minor 2nd + tritone against the drone, beating
    const dissGain = ctx.createGain();
    dissGain.gain.value = 0;
    dissGain.connect(padFilter);
    osc('sine', 155.56, 0, dissGain, 0.5);
    osc('sine', 156.4, 0, dissGain, 0.4);
    osc('triangle', 207.65, 0, dissGain, 0.4);
    osc('sine', 311.13, 4, dissGain, 0.25);

    // pulse
    const pulseLfo = lfo(0.25, 0, padAmp.gain);
    const pulseDepth = nodes[nodes.length - 1] as GainNode;

    // pluck bus with ping-pong-ish feedback delay
    const pluckIn = ctx.createGain();
    pluckIn.gain.value = 0.8;
    pluckIn.connect(gate);
    const dly = ctx.createDelay(1.5);
    dly.delayTime.value = 0.43;
    const fb = ctx.createGain(); fb.gain.value = 0.36;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    pluckIn.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(gate);
    nodes.push(rev, padFilter, padAmp, droneGain, dissGain, pluckIn, dly, fb, dlp);

    this.music = { srcs, nodes, gate, padFilter, padAmp, pulseDepth, pulseLfo, dissGain, droneGain, pluckIn, colors };
  }

  private applyMusicParams(immediate: boolean): void {
    if (!this.ctx) return;
    const t = this.now();
    const tc = immediate ? 0.01 : 0.35;
    const tn = this.tensionCur;
    const ph = this.phase / 4;
    const m = this.music;
    if (m) {
      m.padFilter.frequency.setTargetAtTime(380 + 500 * tn + 380 * ph, t, tc);
      m.padAmp.gain.setTargetAtTime(0.13 + 0.06 * tn + 0.04 * ph, t, tc);
      m.dissGain.gain.setTargetAtTime(0.28 * Math.pow(tn, 1.4), t, tc);
      m.droneGain.gain.setTargetAtTime(0.18 + 0.08 * tn, t, tc);
      m.pulseLfo.frequency.setTargetAtTime(0.18 + 0.32 * tn, t, tc);
      m.pulseDepth.gain.setTargetAtTime(0.09 * tn * tn + 0.02 * tn, t, tc);
    }
    const a = this.amb;
    if (a) {
      a.windGain.gain.setTargetAtTime(0.3 * (1 + 0.28 * this.phase), t, 1.0);
      a.whistle.gain.setTargetAtTime(0.02 + 0.03 * this.phase, t, 1.0);
    }
  }

  private musicTick(dt: number): void {
    const m = this.music;
    if (!m || !this.ctx) return;
    const now = this.now();
    const tn = this.tensionCur;

    // drifting colour tones
    this.colorT -= dt;
    if (this.colorT <= 0) {
      this.colorT = r(12, 24);
      const o = pick(m.colors);
      const semis = pick([0, 2, 3, 5, 7, 8, 10, 12, 15]);
      const f = mtof(50 + semis + (Math.random() < 0.5 ? 12 : 24));
      o.frequency.setTargetAtTime(f, now, 3.0);
    }

    // sparse music-box phrases
    if (now >= this.nextPhraseAt) {
      const count = Math.random() < 0.45 ? 1 : 2 + Math.floor(Math.random() * 3);
      const gap = r(0.32, 0.62) * (1 - 0.25 * tn);
      let t = now + 0.15;
      for (let i = 0; i < count; i++) {
        this.scaleIdx += pick([-2, -1, -1, 1, 1, 2, 3, -3]);
        this.scaleIdx = Math.max(0, Math.min(13, this.scaleIdx));
        const oct = Math.floor(this.scaleIdx / 7);
        let semi = SCALE[this.scaleIdx % 7] + oct * 12;
        if (Math.random() < tn * 0.3) semi += pick([1, -1, 6]);
        this.pluck(t, mtof(D5 + semi), r(0.7, 1) * (0.7 + 0.3 * (1 - i / count)));
        t += gap * r(0.85, 1.4) * (Math.random() < 0.2 ? 2 : 1);
      }
      const silence = r(6, 14) * (1 - 0.6 * tn);
      this.nextPhraseAt = t + silence;
    }
  }

  private pluck(t: number, f: number, vel: number): void {
    const m = this.music;
    if (!m || !this.ctx) return;
    const ctx = this.ctx;
    const parts: Array<[number, number, number]> = [[1, 1, 2.6], [2.01, 0.35, 1.3], [4.16, 0.14, 0.5], [5.4, 0.06, 0.25]];
    const out: AudioNode[] = [];
    const mix = ctx.createGain();
    mix.gain.value = 0.16 * vel;
    mix.connect(m.pluckIn);
    out.push(mix);
    for (const [ratio, amp, dec] of parts) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * ratio;
      const g = ctx.createGain();
      this.env(g.gain, t, 0.003, amp, dec);
      o.connect(g); g.connect(mix);
      o.start(t); o.stop(t + dec + 0.05);
      out.push(o, g);
    }
    this.track(t + 2.7, out);
  }

  // ---------------------------------------------------------------- weather

  thunder(distance01: number): void {
    this.safe(() => {
      if (!this.ok) return;
      const d = clamp01(distance01);
      const out = this.weatherIn;
      const t = this.now() + 0.03;
      const onset = d * 0.9;
      const close = Math.max(0, 1 - d / 0.6);
      const dur = 2.6 + d * 6.4;
      const peak = 0.95 * (1 - d * 0.55);

      if (close > 0) {
        this.burst(out, t, 0.4, 'white', 'bandpass', 6000, 320, 0.7, 0.65 * close, 0.002);
        this.burst(out, t, 0.09, 'white', 'highpass', 3500, 3500, 0.7, 0.4 * close, 0.001);
        this.tone(out, t, 0.6, 'sine', 70, 30, 0.7 * close, 0.004);
      }
      this.rumble(out, t + onset, dur, peak, 600 - 350 * d, 0.05 + d * 0.9);
      // delayed reflections
      for (let i = 0; i < 3; i++) {
        this.rumble(out, t + onset + r(0.35, 1.8) + i * 0.4, dur * r(0.6, 1.0), peak * r(0.25, 0.5), 300 - 120 * d, 0.3);
      }
    });
  }

  private rumble(out: AudioNode, t: number, dur: number, peak: number, lpStart: number, attack: number): void {
    const ctx = this.ctx!;
    const s = this.noiseSrc('brown', t, dur + 0.1);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.9;
    lp.frequency.setValueAtTime(Math.max(90, lpStart), t);
    lp.frequency.exponentialRampToValueAtTime(60, t + dur);
    const g = ctx.createGain();
    const n = 20;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / (n - 1);
      const rise = Math.min(1, x / Math.max(0.02, attack / dur));
      curve[i] = peak * rise * Math.pow(1 - x, 1.6) * (0.35 + 0.65 * Math.random());
    }
    curve[0] = 0; curve[n - 1] = 0;
    g.gain.setValueAtTime(0, t);
    g.gain.setValueCurveAtTime(curve, t, dur);
    s.connect(lp); lp.connect(g); g.connect(out);
    this.track(t + dur + 0.1, [s, lp, g]);
  }

  // ------------------------------------------------------------------ sfx

  footstep(surface: 'wood' | 'stone' | 'carpet'): void {
    this.safe(() => {
      if (!this.ok) return;
      this.sFootstep(this.sfxIn, this.now() + 0.005, surface);
    });
  }

  private sFootstep(d: AudioNode, t: number, surface: string): void {
    const v = r(0.8, 1.0);
    const p = r(0.86, 1.16);
    if (surface === 'stone') {
      this.tone(d, t, 0.12, 'sine', 120 * p, 55 * p, 0.32 * v);
      this.burst(d, t, 0.09, 'brown', 'lowpass', 500 * p, 200, 0.7, 0.5 * v);
      this.burst(d, t, 0.03, 'white', 'bandpass', 2800 * p, 1800, 3, 0.22 * v, 0.001);
      this.burst(d, t + 0.01, 0.16, 'white', 'bandpass', 1100 * p, 900, 9, 0.05 * v, 0.002);
    } else if (surface === 'carpet') {
      this.burst(d, t, 0.13, 'brown', 'lowpass', 260 * p, 120, 0.5, 0.42 * v, 0.012);
      this.burst(d, t + 0.02, 0.09, 'pink', 'bandpass', 1800 * p, 900, 0.8, 0.03 * v, 0.02);
    } else {
      this.tone(d, t, 0.14, 'sine', 95 * p, 50 * p, 0.34 * v);
      this.burst(d, t, 0.11, 'brown', 'lowpass', 420 * p, 180, 0.8, 0.45 * v);
      this.burst(d, t, 0.2, 'white', 'bandpass', 240 * p, 200 * p, 7, 0.14 * v, 0.003);
      this.burst(d, t, 0.02, 'white', 'bandpass', 1900 * p, 1200, 2.5, 0.16 * v, 0.001);
      if (Math.random() < 0.5) this.burst(d, t + r(0.02, 0.05), 0.05, 'pink', 'highpass', 2500, 2500, 0.7, 0.03 * v, 0.01);
    }
  }

  creak(): void {
    this.safe(() => {
      if (this.ok) this.sCreak(this.sfxIn, this.now() + 0.01, r(0.5, 1.3));
    });
  }

  private sCreak(d: AudioNode, t: number, dur: number): number {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = r(85, 210);
    const n = 14;
    const curve = new Float32Array(n);
    let w = 1;
    for (let i = 0; i < n; i++) {
      w = Math.min(1.5, Math.max(0.7, w + r(-0.14, 0.14)));
      curve[i] = base * w;
    }
    o.frequency.setValueCurveAtTime(curve, t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = r(4, 9);
    bp.frequency.setValueAtTime(r(450, 800), t);
    bp.frequency.linearRampToValueAtTime(r(800, 1500), t + dur);
    const am = ctx.createGain();
    am.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = r(16, 42);
    const lg = ctx.createGain();
    lg.gain.value = 0.5;
    lfo.connect(lg); lg.connect(am.gain);
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, t);
    e.gain.linearRampToValueAtTime(0.16, t + dur * 0.3);
    e.gain.linearRampToValueAtTime(0.1, t + dur * 0.75);
    e.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(bp); bp.connect(am); am.connect(e); e.connect(d);
    o.start(t); o.stop(t + dur + 0.05);
    lfo.start(t); lfo.stop(t + dur + 0.05);
    this.track(t + dur + 0.05, [o, bp, am, lfo, lg, e]);
    this.burst(d, t, dur, 'pink', 'bandpass', 700, 1100, 3, 0.035, dur * 0.3);
    return dur;
  }

  doorOpen(shifting: boolean): void {
    this.safe(() => {
      if (this.ok) this.sDoor(this.sfxIn, this.now() + 0.01, shifting);
    });
  }

  private sDoor(d: AudioNode, t: number, shifting: boolean): number {
    // latch: metallic click + wooden clack
    this.burst(d, t, 0.03, 'white', 'bandpass', 3200, 2200, 4, 0.3, 0.001);
    this.tone(d, t, 0.05, 'square', 1400, 900, 0.03, 0.001);
    this.burst(d, t + 0.07, 0.08, 'brown', 'lowpass', 600, 250, 0.8, 0.4, 0.002);
    this.tone(d, t + 0.07, 0.1, 'sine', 140, 70, 0.25, 0.002);
    const dur = r(1.1, 1.6);
    this.sCreak(d, t + 0.15, dur);
    // settle thud
    this.burst(d, t + 0.15 + dur, 0.14, 'brown', 'lowpass', 300, 120, 0.8, 0.25, 0.004);
    let total = 0.15 + dur + 0.3;
    if (shifting) {
      const ctx = this.ctx!;
      const sh = ctx.createGain();
      sh.gain.setValueAtTime(0, t);
      sh.gain.linearRampToValueAtTime(0.09, t + 1.2);
      sh.gain.linearRampToValueAtTime(0, t + 3.0);
      sh.connect(d);
      sh.connect(this.hallSend);
      const nodes: AudioNode[] = [sh];
      for (const [f, det] of [[440, -14], [443, 9], [659.3, 0], [880, 17], [1108.7, -20]] as const) {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = f * 0.5; o.detune.value = det;
        const l = ctx.createOscillator(); l.frequency.value = r(3, 6);
        const lg = ctx.createGain(); lg.gain.value = 9;
        l.connect(lg); lg.connect(o.detune);
        const g = ctx.createGain(); g.gain.value = f > 800 ? 0.35 : 0.6;
        o.connect(g); g.connect(sh);
        o.start(t); o.stop(t + 3.1); l.start(t); l.stop(t + 3.1);
        nodes.push(o, l, lg, g);
      }
      this.track(t + 3.1, nodes);
      this.sWhisper(d, t + 0.4, 0.5);
      total = 3.2;
    }
    return total;
  }

  candleLight(): void {
    this.safe(() => {
      if (this.ok) this.sCandleLight(this.sfxIn, this.now() + 0.01);
    });
  }

  private sCandleLight(d: AudioNode, t: number): number {
    const ctx = this.ctx!;
    // match strike scratch
    this.burst(d, t, 0.16, 'white', 'bandpass', 2500, 6500, 1.2, 0.2, 0.01);
    // ignition whoosh
    this.burst(d, t + 0.16, 0.5, 'pink', 'bandpass', 500, 1600, 0.9, 0.3, 0.1);
    this.burst(d, t + 0.16, 0.25, 'white', 'highpass', 3000, 3000, 0.7, 0.06, 0.05);
    // crackle tail
    const s = ctx.createBufferSource();
    s.buffer = this.crackleBuf!;
    s.loop = true;
    s.start(t + 0.3, Math.random() * 3);
    s.stop(t + 1.9);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + 0.3);
    g.gain.linearRampToValueAtTime(0.16, t + 0.45);
    g.gain.exponentialRampToValueAtTime(0.002, t + 1.8);
    s.connect(hp); hp.connect(g); g.connect(d);
    this.track(t + 1.9, [s, hp, g]);
    return 1.9;
  }

  candleSnuff(): void {
    this.safe(() => {
      if (this.ok) this.sSnuff(this.sfxIn, this.now() + 0.01);
    });
  }

  private sSnuff(d: AudioNode, t: number): number {
    this.burst(d, t, 0.22, 'pink', 'bandpass', 1400, 450, 1.0, 0.28, 0.02);
    this.burst(d, t + 0.05, 0.6, 'white', 'highpass', 4500, 5500, 0.7, 0.05, 0.03);
    this.burst(d, t + 0.1, 0.25, 'white', 'bandpass', 2600, 2000, 2, 0.05, 0.01);
    return 0.8;
  }

  clockTick(): void {
    this.safe(() => {
      if (!this.ok) return;
      this.tickToggle = !this.tickToggle;
      this.sTick(this.sfxIn, this.now() + 0.005, this.tickToggle);
    });
  }

  private sTick(d: AudioNode, t: number, tock: boolean): number {
    const f = tock ? 1500 : 2200;
    this.burst(d, t, 0.03, 'white', 'bandpass', f, f * 0.7, 4, 0.22, 0.001);
    this.tone(d, t, 0.05, 'sine', f * 0.5, f * 0.35, 0.16, 0.001);
    this.tone(d, t, 0.08, 'triangle', tock ? 420 : 560, tock ? 380 : 500, 0.06, 0.002);
    return 0.25;
  }

  clockChime(strikes: number): void {
    this.safe(() => {
      if (!this.ok) return;
      const n = Math.max(1, Math.min(12, Math.round(Number.isFinite(strikes) ? strikes : 1)));
      const t0 = this.now() + 0.05;
      for (let i = 0; i < n; i++) this.bell(t0 + i * 1.6);
    });
  }

  private bell(t: number): void {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    out.gain.value = 0.32;
    out.connect(this.sfxIn);
    const send = ctx.createGain();
    send.gain.value = 0.6;
    out.connect(send); send.connect(this.hallSend);
    const nodes: AudioNode[] = [out, send];
    const f0 = 131 * r(0.995, 1.005);
    const partials: Array<[number, number, number]> = [
      [0.5, 0.45, 7.0], [1.0, 1.0, 6.0], [1.19, 0.55, 5.0], [1.5, 0.35, 4.2],
      [2.0, 0.5, 3.6], [2.56, 0.28, 2.6], [3.01, 0.22, 2.0], [4.2, 0.12, 1.2],
    ];
    for (const [ratio, amp, dec] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * ratio;
      o.detune.value = r(-4, 4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * 0.5, t + 0.004);
      g.gain.setTargetAtTime(0, t + 0.004, dec / 4.5);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + dec * 1.4 + 0.1);
      nodes.push(o, g);
    }
    // strike transient
    const s = this.noiseSrc('white', t, 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 1.2;
    const g = ctx.createGain();
    this.env(g.gain, t, 0.001, 0.25, 0.08);
    s.connect(bp); bp.connect(g); g.connect(out);
    nodes.push(s, bp, g);
    this.track(t + 10, nodes);
  }

  whisper(): void {
    this.safe(() => {
      if (this.ok) this.sWhisper(this.sfxIn, this.now() + 0.01, 1);
    });
  }

  private sWhisper(d: AudioNode, t: number, level: number): number {
    const ctx = this.ctx!;
    const vowels = [[730, 1090, 2440], [270, 2290, 3010], [300, 870, 2240], [530, 1840, 2480], [660, 1720, 2410]];
    const total = r(1.2, 2.0);
    const s = this.noiseSrc('pink', t, total + 0.2);
    const mix = ctx.createGain();
    mix.gain.value = 0;
    const nodes: AudioNode[] = [s, mix];
    const filters: BiquadFilterNode[] = [];
    const gains = [1, 0.6, 0.3];
    for (let i = 0; i < 3; i++) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 9 + i * 3;
      const g = ctx.createGain(); g.gain.value = gains[i] * 1.6;
      s.connect(f); f.connect(g); g.connect(mix);
      filters.push(f); nodes.push(f, g);
    }
    const sylls = 3 + Math.floor(Math.random() * 4);
    let ct = t;
    for (let i = 0; i < sylls; i++) {
      const v = pick(vowels);
      const sd = r(0.12, 0.26);
      const amp = 0.1 * level * r(0.5, 1);
      for (let k = 0; k < 3; k++) filters[k].frequency.setTargetAtTime(v[k] * r(0.95, 1.05), ct, 0.03);
      mix.gain.setTargetAtTime(amp, ct, 0.03);
      mix.gain.setTargetAtTime(0.002, ct + sd * 0.7, 0.04);
      ct += sd + r(0.03, 0.14);
      if (ct > t + total) break;
    }
    // sibilant breath at end
    this.burst(mix, ct, 0.25, 'white', 'highpass', 5000, 6000, 0.7, 0.05 * level, 0.08);
    mix.connect(d);
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    mix.connect(wet); wet.connect(this.hallSend);
    nodes.push(wet);
    this.track(t + total + 0.4, nodes);
    return total + 0.5;
  }

  ghostAmbience(on: boolean): void {
    this.wantGhost = !!on;
    this.safe(() => {
      if (!this.ok) return;
      if (on) {
        if (!this.ghost) this.buildGhost();
      } else if (this.ghost) {
        const g = this.ghost;
        this.ghost = null;
        this.stopRig(g, g.gain, this.now(), 2.5);
      }
    });
  }

  private buildGhost(): void {
    const ctx = this.ctx!;
    const t = this.now();
    const srcs: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.11, t + 3.5);
    gain.connect(this.sfxBus);
    const send = ctx.createGain();
    send.gain.value = 1.2;
    gain.connect(send); send.connect(this.hallSend);
    const voiceMix = ctx.createGain();
    voiceMix.gain.value = 0.12;
    const vowel = [800, 1150, 2900];
    const vLevels = [1, 0.5, 0.2];
    vowel.forEach((f, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 6;
      const g = ctx.createGain(); g.gain.value = vLevels[i];
      voiceMix.connect(bp); bp.connect(g); g.connect(gain);
      // slow formant wander
      const l = ctx.createOscillator(); l.frequency.value = r(0.05, 0.13);
      const lg = ctx.createGain(); lg.gain.value = f * 0.12;
      l.connect(lg); lg.connect(bp.frequency); l.start(t);
      srcs.push(l); nodes.push(bp, g, l, lg);
    });
    for (const f of [146.83, 220.0, 293.66, 349.23, 440.0]) {
      for (const det of [-9, 10]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        const vib = ctx.createOscillator(); vib.frequency.value = r(4.5, 5.8);
        const vg = ctx.createGain(); vg.gain.value = r(8, 16);
        vib.connect(vg); vg.connect(o.detune);
        o.connect(voiceMix);
        o.start(t); vib.start(t);
        srcs.push(o, vib); nodes.push(vg);
      }
    }
    // tremulous swell
    const sw = ctx.createOscillator(); sw.frequency.value = 0.11;
    const swg = ctx.createGain(); swg.gain.value = 0.04;
    sw.connect(swg); swg.connect(voiceMix.gain); sw.start(t);
    srcs.push(sw); nodes.push(swg, voiceMix, send);
    this.ghost = { srcs, nodes, gain };
    this.whisperT = r(2, 5);
  }

  // -------------------------------------------------------------- puzzle sfx

  pickup(): void {
    this.safe(() => {
      if (!this.ok) return;
      const t = this.now() + 0.01, d = this.sfxIn;
      this.tone(d, t, 0.9, 'sine', 880, 880, 0.14, 0.004);
      this.tone(d, t + 0.09, 1.1, 'sine', 1318.5, 1318.5, 0.11, 0.004);
      this.tone(d, t + 0.09, 0.8, 'sine', 2637, 2637, 0.03, 0.004);
      this.burst(d, t, 0.15, 'white', 'highpass', 6000, 6000, 0.7, 0.03, 0.01);
    });
  }

  plate(on: boolean): void {
    this.safe(() => {
      if (!this.ok) return;
      const t = this.now() + 0.01, d = this.sfxIn;
      if (on) {
        this.tone(d, t, 0.25, 'sine', 90, 45, 0.4, 0.003);
        this.burst(d, t, 0.12, 'brown', 'lowpass', 500, 180, 0.8, 0.4, 0.002);
        this.burst(d, t + 0.05, 0.4, 'pink', 'bandpass', 380, 260, 2.5, 0.16, 0.05);
        this.burst(d, t + 0.35, 0.05, 'white', 'bandpass', 2200, 1600, 3, 0.1, 0.001);
      } else {
        this.burst(d, t, 0.3, 'pink', 'bandpass', 260, 420, 2.5, 0.1, 0.05);
        this.tone(d, t + 0.28, 0.12, 'sine', 110, 65, 0.25, 0.003);
        this.burst(d, t + 0.28, 0.06, 'brown', 'lowpass', 500, 200, 0.8, 0.25, 0.002);
      }
    });
  }

  mirrorRaise(lower = false): void {
    this.safe(() => {
      if (!this.ok) return;
      const t = this.now() + 0.01, d = this.sfxIn;
      const dur = 1.3;
      this.burst(d, t, dur, 'brown', 'lowpass', lower ? 260 : 150, lower ? 120 : 260, 0.8, 0.35, 0.15);
      this.burst(d, t, dur, 'pink', 'bandpass', lower ? 420 : 250, lower ? 240 : 430, 3, 0.12, 0.2);
      const a = lower ? 2400 : 1200, b = lower ? 1200 : 2400;
      for (const det of [-12, 0, 14]) this.tone(d, t + 0.1, dur, 'sine', a, b, 0.04, 0.3, det);
      this.tone(d, t + 0.25, dur, 'sine', a * 1.5, b * 1.5, 0.02, 0.35);
      this.burst(d, t + dur, 0.08, 'brown', 'lowpass', 400, 150, 0.8, 0.3, 0.002);
    });
  }

  echoStart(): void {
    this.safe(() => {
      if (!this.ok) return;
      const t = this.now() + 0.01, d = this.sfxIn;
      // reversed-swell feel, then repeating pings
      this.burst(d, t, 0.8, 'pink', 'bandpass', 500, 3000, 2, 0.001 + 0.16, 0.7);
      this.tone(d, t, 0.9, 'sine', 300, 640, 0.09, 0.7, 6);
      for (let i = 0; i < 4; i++) {
        this.tone(d, t + 0.85 + i * 0.22, 0.6, 'sine', 990, 990, 0.1 * Math.pow(0.55, i), 0.004);
      }
      this.sWhisper(d, t + 0.3, 0.4);
    });
  }

  echoEnd(): void {
    this.safe(() => {
      if (!this.ok) return;
      const t = this.now() + 0.01, d = this.sfxIn;
      this.burst(d, t, 0.9, 'pink', 'bandpass', 3000, 300, 2, 0.15, 0.03);
      this.tone(d, t, 1.0, 'sine', 640, 200, 0.09, 0.02);
      this.tone(d, t + 0.05, 0.6, 'sine', 990, 990, 0.06, 0.004);
      this.tone(d, t + 0.3, 0.7, 'sine', 495, 495, 0.04, 0.004);
    });
  }

  uiClick(): void {
    this.safe(() => {
      if (!this.ok) return;
      const t = this.now() + 0.005, d = this.sfxIn;
      this.tone(d, t, 0.08, 'sine', 620, 380, 0.14, 0.002);
      this.burst(d, t, 0.03, 'white', 'bandpass', 2400, 1800, 3, 0.1, 0.001);
      this.burst(d, t, 0.06, 'brown', 'lowpass', 400, 200, 0.7, 0.14, 0.002);
    });
  }

  uiHover(): void {
    this.safe(() => {
      if (!this.ok) return;
      const t = this.now() + 0.005;
      this.tone(this.sfxIn, t, 0.07, 'sine', 1100, 1300, 0.035, 0.008);
    });
  }

  stingerReveal(): void {
    this.safe(() => {
      if (!this.ok) return;
      const ctx = this.ctx!;
      const t = this.now() + 0.02;
      const out = ctx.createGain();
      out.gain.value = 1;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(600, t);
      lp.frequency.exponentialRampToValueAtTime(5000, t + 2.4);
      lp.connect(out);
      out.connect(this.sfxIn);
      const send = ctx.createGain(); send.gain.value = 1.0;
      out.connect(send); send.connect(this.hallSend);
      const nodes: AudioNode[] = [out, lp, send];
      for (const f of [293.66, 440, 587.33, 698.46, 880, 1174.7]) {
        for (const det of [-8, 9]) {
          const o = ctx.createOscillator();
          o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.045, t + 2.0);
          g.gain.exponentialRampToValueAtTime(MIN, t + 4.5);
          o.connect(g); g.connect(lp);
          o.start(t); o.stop(t + 4.6);
          nodes.push(o, g);
        }
      }
      this.track(t + 4.7, nodes);
      const bt = t + 1.9;
      this.tone(this.sfxIn, bt, 2.4, 'sine', 62, 32, 0.55, 0.01);
      this.burst(this.sfxIn, bt, 0.5, 'brown', 'lowpass', 300, 80, 0.8, 0.5, 0.004);
      this.burst(this.sfxIn, bt, 1.4, 'white', 'bandpass', 5000, 1500, 0.8, 0.08, 0.005);
    });
  }

  shiftRumble(): void {
    this.safe(() => {
      if (!this.ok) return;
      const ctx = this.ctx!;
      const t = this.now() + 0.01, d = this.sfxIn;
      const dur = 2.1;
      // sub rumble
      const s = this.noiseSrc('brown', t, dur + 0.1);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(110, t);
      lp.frequency.linearRampToValueAtTime(230, t + 0.9);
      lp.frequency.linearRampToValueAtTime(90, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.85, t + 0.5);
      g.gain.linearRampToValueAtTime(0.6, t + 1.3);
      g.gain.linearRampToValueAtTime(0, t + dur);
      const trem = ctx.createOscillator(); trem.frequency.value = 7;
      const tg = ctx.createGain(); tg.gain.value = 0.18;
      trem.connect(tg); tg.connect(g.gain);
      trem.start(t); trem.stop(t + dur + 0.1);
      s.connect(lp); lp.connect(g); g.connect(d);
      this.track(t + dur + 0.1, [s, lp, g, trem, tg]);
      // stone grinding
      const gs = this.noiseSrc('pink', t, dur + 0.1);
      const gb = ctx.createBiquadFilter();
      gb.type = 'bandpass'; gb.Q.value = 3;
      gb.frequency.setValueAtTime(220, t);
      gb.frequency.linearRampToValueAtTime(480, t + dur * 0.6);
      gb.frequency.linearRampToValueAtTime(260, t + dur);
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(0, t);
      gg.gain.linearRampToValueAtTime(0.5, t + 0.4);
      gg.gain.linearRampToValueAtTime(0.35, t + 1.4);
      gg.gain.linearRampToValueAtTime(0, t + dur);
      const jl = ctx.createOscillator(); jl.type = 'sawtooth'; jl.frequency.value = 23;
      const jg = ctx.createGain(); jg.gain.value = 0.2;
      jl.connect(jg); jg.connect(gg.gain); jl.start(t); jl.stop(t + dur + 0.1);
      gs.connect(gb); gb.connect(gg); gg.connect(d);
      this.track(t + dur + 0.1, [gs, gb, gg, jl, jg]);
      // wood groan
      this.sCreak(d, t + 0.3, 1.5);
      this.tone(d, t, 1.6, 'sine', 55, 40, 0.3, 0.4);
    });
  }

  // ---------------------------------------------------------- positional

  playAt(name: SfxName, position: THREE.Vector3): void {
    this.safe(() => {
      if (!this.ok || !position) return;
      const p = this.panner(position);
      const t = this.now() + 0.01;
      let dur = 1;
      switch (name) {
        case 'creak': dur = this.sCreak(p, t, r(0.6, 1.4)); break;
        case 'whisper': dur = this.sWhisper(p, t, 1); break;
        case 'candleLight': dur = this.sCandleLight(p, t); break;
        case 'candleSnuff': dur = this.sSnuff(p, t); break;
        case 'doorOpen': dur = this.sDoor(p, t, false); break;
        case 'clockTick':
          this.tickToggle = !this.tickToggle;
          dur = this.sTick(p, t, this.tickToggle);
          break;
        default: break;
      }
      this.track(t + dur + 0.5, [p]);
    });
  }

  hearthLoop(on: boolean, position?: THREE.Vector3): void {
    this.wantHearth = { on: !!on, pos: position ? position.clone() : undefined };
    this.safe(() => {
      if (!this.ok) return;
      if (on) {
        if (this.hearth) {
          if (position && this.hearth.panner) this.setPannerPos(this.hearth.panner, position);
        } else this.buildHearth(position);
      } else if (this.hearth) {
        const h = this.hearth;
        this.hearth = null;
        this.stopRig(h, h.gain, this.now(), 1.2);
      }
    });
  }

  private buildHearth(position?: THREE.Vector3): void {
    const ctx = this.ctx!;
    const t = this.now();
    const srcs: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 1.2);
    let panner: PannerNode | null = null;
    if (position) {
      panner = this.panner(position, 2.5);
      gain.connect(panner);
      nodes.push(panner);
    } else gain.connect(this.sfxIn);

    const cr = ctx.createBufferSource();
    cr.buffer = this.crackleBuf!; cr.loop = true;
    cr.start(t, Math.random() * 3);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
    const cg = ctx.createGain(); cg.gain.value = 0.32;
    cr.connect(hp); hp.connect(lp); lp.connect(cg); cg.connect(gain);

    const body = this.noiseSrc('brown', t, 0);
    const bl = ctx.createBiquadFilter(); bl.type = 'lowpass'; bl.frequency.value = 260;
    const bg = ctx.createGain(); bg.gain.value = 0.16;
    const fl = ctx.createOscillator(); fl.frequency.value = 0.4;
    const fg = ctx.createGain(); fg.gain.value = 0.06;
    fl.connect(fg); fg.connect(bg.gain); fl.start(t);
    body.connect(bl); bl.connect(bg); bg.connect(gain);

    const hiss = this.noiseSrc('white', t, 0);
    const hb = ctx.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 3200; hb.Q.value = 0.6;
    const hg = ctx.createGain(); hg.gain.value = 0.012;
    hiss.connect(hb); hb.connect(hg); hg.connect(gain);

    srcs.push(cr, body, fl, hiss);
    nodes.push(hp, lp, cg, bl, bg, fg, hb, hg);
    this.hearth = { srcs, nodes, gain, panner };
  }
}
