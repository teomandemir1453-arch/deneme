/* Retro çip müziği motoru — Web Audio API ile gerçek zamanlı sentez.
   4 kanallı klasik düzen: kare dalga lead, üçgen bas, kick + noise davul. */

export type SfxName =
  | "eat"
  | "bonus"
  | "deny"
  | "crash"
  | "gameover"
  | "start"
  | "coin"
  | "pause"
  | "resume"
  | "levelup"
  | "count"
  | "go";

const SEMI: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

function freq(note: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(note)!;
  return 440 * Math.pow(2, (SEMI[m[1]] + (parseInt(m[2], 10) - 4) * 12) / 12);
}

const N = (n: string | null) => (n ? freq(n) : 0);

/* 64 adımlık döngü (4 ölçü): Am – Am – F – G */
const LEAD: number[] = [
  "E5", null, "C5", null, "E5", null, "G5", null, "A5", null, "G5", null, "E5", null, "C5", null,
  "B4", null, "D5", null, "G5", null, "D5", null, "B4", null, "A4", null, "B4", null, "C5", null,
  "F5", null, "A5", null, "C6", null, "A5", null, "F5", null, "E5", null, "D5", null, "C5", null,
  "G5", null, "B5", null, "G5", null, "E5", null, "D5", null, "C5", null, "B4", null, "D5", null,
].map(N);

const BASS_BARS: (string | null)[][] = [
  ["A2", "A2", "A3", "A2", "A2", "A3", "E3", "A3"],
  ["A2", "A2", "A3", "A2", "A2", "A3", "B2", "C3"],
  ["F2", "F2", "F3", "F2", "F2", "F3", "C3", "F3"],
  ["G2", "G2", "G3", "G2", "G2", "G3", "D3", "F3"],
];

const BASS: number[] = BASS_BARS.flatMap((bar) => bar.flatMap((n) => [N(n), 0]));

class ChipEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private timer: number | null = null;
  private stepIdx = 0;
  private nextTime = 0;
  private readonly bpm = 140;
  private musicEnabled = true;
  private sfxEnabled = true;

  ensure(): AudioContext {
    if (!this.ctx) {
      const AC: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicEnabled ? 0.42 : 0;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxEnabled ? 0.85 : 0;
      this.sfxBus.connect(this.master);

      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  startMusic(): void {
    const ctx = this.ensure();
    if (this.timer !== null) return;
    this.stepIdx = 0;
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), 30);
  }

  stopMusic(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  get musicPlaying(): boolean {
    return this.timer !== null;
  }

  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on;
    if (this.ctx) {
      this.musicBus.gain.setTargetAtTime(on ? 0.42 : 0, this.ctx.currentTime, 0.02);
    }
  }

  setSfxEnabled(on: boolean): void {
    this.sfxEnabled = on;
    if (this.ctx) {
      this.sfxBus.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.02);
    }
  }

  /* ---------- sıralayıcı ---------- */

  private schedule(): void {
    const ctx = this.ctx!;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.stepIdx, this.nextTime);
      this.nextTime += stepDur;
      this.stepIdx = (this.stepIdx + 1) % 64;
    }
  }

  private playStep(i: number, t: number): void {
    const lead = LEAD[i];
    if (lead) {
      this.tone(lead, lead, 0.24, "square", 0.085, this.musicBus, t, 2600);
      this.tone(lead * 1.005, lead * 1.005, 0.24, "square", 0.065, this.musicBus, t, 2600);
    }
    const bass = BASS[i];
    if (bass) this.tone(bass, bass, 0.21, "triangle", 0.3, this.musicBus, t, 900);
    if (i % 4 === 0) this.kick(t);
    if (i % 8 === 4) this.noiseHit(t, 0.14, 0.22, "bandpass", 1800);
    if (i % 2 === 1) this.noiseHit(t, 0.035, 0.09, "highpass", 7500);
  }

  /* ---------- ses yapı taşları ---------- */

  private tone(
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    bus: GainNode,
    when: number,
    lp?: number,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f0), when);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), when + dur);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    let node: AudioNode = o;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lp;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(bus);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  private kick(t: number): void {
    this.tone(150, 42, 0.13, "sine", 0.5, this.musicBus, t);
  }

  private noiseHit(
    t: number,
    dur: number,
    vol: number,
    type: BiquadFilterType,
    freqHz: number,
    bus?: GainNode,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freqHz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus ?? this.musicBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /* ---------- oyun ses efektleri ---------- */

  sfx(name: SfxName): void {
    if (!this.sfxEnabled) return;
    this.ensure();
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const bus = this.sfxBus;
    const T = (f0: number, f1: number, dur: number, vol: number, at: number, lp?: number) =>
      this.tone(f0, f1, dur, "square", vol, bus, now + at, lp);

    switch (name) {
      case "coin":
        T(987.77, 987.77, 0.08, 0.22, 0);
        T(1318.5, 1318.5, 0.3, 0.22, 0.08);
        break;
      case "deny":
        T(160, 90, 0.16, 0.2, 0, 1200);
        T(120, 70, 0.18, 0.2, 0.09, 1000);
        break;
      case "eat":
        T(540, 1080, 0.08, 0.18, 0, 3000);
        break;
      case "bonus":
        [1318.5, 1567.98, 1975.53].forEach((f, i) => T(f, f, 0.07, 0.2, i * 0.055));
        break;
      case "crash":
        this.tone(300, 52, 0.4, "sawtooth", 0.32, bus, now, 900);
        this.noiseHit(now, 0.3, 0.3, "lowpass", 420, bus);
        break;
      case "gameover":
        [440, 349.23, 293.66, 220].forEach((f, i) =>
          T(f, f, i === 3 ? 0.5 : 0.17, 0.22, i * 0.18, 2200),
        );
        break;
      case "start":
        [440, 523.25, 659.25, 880].forEach((f, i) => T(f, f, 0.09, 0.2, i * 0.07, 2600));
        break;
      case "levelup":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => T(f, f, 0.06, 0.2, i * 0.05, 2800));
        break;
      case "pause":
        T(392, 392, 0.08, 0.18, 0);
        T(261.63, 261.63, 0.12, 0.18, 0.09);
        break;
      case "resume":
        T(261.63, 261.63, 0.08, 0.18, 0);
        T(392, 392, 0.12, 0.18, 0.09);
        break;
      case "count":
        T(660, 660, 0.09, 0.2, 0, 2200);
        break;
      case "go":
        T(880, 880, 0.3, 0.24, 0, 2600);
        break;
    }
  }
}

export const chip = new ChipEngine();
