import { useCallback, useEffect, useRef, useState } from "react";
import { chip } from "../audio/engine";

/* ---------------- sabitler ---------------- */
const COLS = 22;
const ROWS = 20;
const CELL = 22;
const W = COLS * CELL;
const H = ROWS * CELL;

type P = { x: number; y: number };
type Phase = "attract" | "countdown" | "playing" | "paused" | "dying" | "gameover";

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; color: string; size: number;
};

type GameState = {
  snake: P[];
  dir: P;
  queue: P[];
  food: P;
  bonus: { x: number; y: number; expires: number } | null;
  apples: number;
  score: number;
  lives: number;
  level: number;
  phase: Phase;
  acc: number;
  last: number;
  t: number;
  particles: Particle[];
  shake: number;
  flash: number;
};

const DIRS: Record<"up" | "down" | "left" | "right", P> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const pad = (n: number) => String(Math.max(0, n)).padStart(6, "0");
const intervalFor = (level: number) => Math.max(72, 152 - (level - 1) * 11);

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}

/* ---------------- küçük piksel ikonlar ---------------- */

function PixelHeart({ on }: { on: boolean }) {
  return (
    <svg
      viewBox="0 0 16 12"
      className={`h-4 w-5 transition-all duration-300 ${
        on ? "text-[#ff2d78] drop-shadow-[0_0_6px_rgba(255,45,120,0.9)]" : "text-[#2b343c]"
      }`}
      fill="currentColor"
      aria-hidden
    >
      <rect x="2" y="0" width="4" height="2" />
      <rect x="10" y="0" width="4" height="2" />
      <rect x="0" y="2" width="16" height="4" />
      <rect x="2" y="6" width="12" height="2" />
      <rect x="4" y="8" width="8" height="2" />
      <rect x="6" y="10" width="4" height="2" />
    </svg>
  );
}

function PixelSnakeMark({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 34 12"
      className={`h-3 w-9 shrink-0 ${flip ? "-scale-x-100" : ""}`}
      aria-hidden
    >
      {[0, 5, 10].map((x) => (
        <rect key={x} x={x} y="7" width="4" height="4" fill="#1f9e4e" />
      ))}
      <rect x="15" y="7" width="4" height="4" fill="#35d468" />
      <rect x="15" y="2" width="4" height="4" fill="#35d468" />
      <rect x="20" y="2" width="4" height="4" fill="#8cff9e" />
      <rect x="21" y="3" width="1.6" height="1.6" fill="#04150b" />
      <rect x="28" y="2" width="4" height="4" fill="#ff3b57" />
      <rect x="29.5" y="0" width="1.5" height="2" fill="#3ddc74" />
    </svg>
  );
}

function ArrowIcon({ rot }: { rot: number }) {
  return (
    <svg viewBox="0 0 10 10" className="h-3.5 w-3.5" style={{ transform: `rotate(${rot}deg)` }} aria-hidden>
      <path d="M5 1.2 L9 8.4 H1 Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 10 10" className="h-3.5 w-3.5" aria-hidden>
      <rect x="1.5" y="1" width="2.6" height="8" fill="currentColor" />
      <rect x="5.9" y="1" width="2.6" height="8" fill="currentColor" />
    </svg>
  );
}

/* ---------------- ana bileşen ---------------- */

export default function SnakeCabinet({ onMusicChange }: { onMusicChange?: (on: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase] = useState<Phase>("attract");
  const [score, setScore] = useState(0);
  const [high, setHigh] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [credits, setCredits] = useState(1);
  const [count, setCount] = useState(3);
  const [newRecord, setNewRecord] = useState(false);
  const [musicOn, setMusicOn] = useState(() => {
    try { return localStorage.getItem("ry-music") !== "0"; } catch { return true; }
  });
  const [sfxOn, setSfxOn] = useState(() => {
    try { return localStorage.getItem("ry-sfx") !== "0"; } catch { return true; }
  });

  const highRef = useRef(0);
  const creditsRef = useRef(1);
  const musicRef = useRef(musicOn);
  const sfxRef = useRef(sfxOn);
  const countTimer = useRef<number | null>(null);
  const deathTimer = useRef<number | null>(null);
  const onMusicChangeRef = useRef(onMusicChange);
  onMusicChangeRef.current = onMusicChange;
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const g = useRef<GameState>({
    snake: [],
    dir: DIRS.right,
    queue: [],
    food: { x: 15, y: 10 },
    bonus: null,
    apples: 0,
    score: 0,
    lives: 3,
    level: 1,
    phase: "attract",
    acc: 0,
    last: 0,
    t: 0,
    particles: [],
    shake: 0,
    flash: 0,
  });

  const api = useRef({
    start: () => {},
    pause: () => {},
    coin: () => {},
    music: () => {},
    sfx: () => {},
  });

  const pushDir = useCallback((d: P) => {
    const s = g.current;
    if (s.phase !== "playing" && s.phase !== "countdown") return;
    const lastD = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    if (d.x === -lastD.x && d.y === -lastD.y) return;
    if (d.x === lastD.x && d.y === lastD.y) return;
    if (s.queue.length < 3) s.queue.push(d);
  }, []);

  /* ---------------- oyun motoru (tek effect) ---------------- */
  useEffect(() => {
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;

    try {
      const stored = Number(localStorage.getItem("ry-high") || 0);
      if (Number.isFinite(stored)) highRef.current = stored;
      setHigh(highRef.current);
    } catch { /* boş */ }

    chip.setMusicEnabled(musicRef.current);
    chip.setSfxEnabled(sfxRef.current);
    onMusicChangeRef.current?.(musicRef.current);

    const setPhaseBoth = (p: Phase) => {
      g.current.phase = p;
      setPhase(p);
    };

    const resetSnake = () => {
      const s = g.current;
      s.snake = [
        { x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }, { x: 2, y: 10 },
      ];
      s.dir = DIRS.right;
      s.queue = [];
    };

    const randEmpty = (): P => {
      const s = g.current;
      for (let tries = 0; tries < 400; tries++) {
        const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
        const onSnake = s.snake.some((q) => q.x === p.x && q.y === p.y);
        const onFood = s.food.x === p.x && s.food.y === p.y;
        if (!onSnake && !onFood) return p;
      }
      return { x: 0, y: 0 };
    };

    const spawnFood = () => { g.current.food = randEmpty(); };

    const spawnBonus = () => {
      const p = randEmpty();
      g.current.bonus = { x: p.x, y: p.y, expires: performance.now() + 6500 };
    };

    const burst = (x: number, y: number, colors: string[], n: number) => {
      const s = g.current;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 0.6 + Math.random() * 2.2;
        s.particles.push({
          x, y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 1,
          life: 420 + Math.random() * 380,
          max: 800,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 2 + Math.random() * 3,
        });
      }
    };

    const clearTimers = () => {
      if (countTimer.current !== null) { window.clearInterval(countTimer.current); countTimer.current = null; }
      if (deathTimer.current !== null) { window.clearTimeout(deathTimer.current); deathTimer.current = null; }
    };

    const beginCountdown = () => {
      setPhaseBoth("countdown");
      setCount(3);
      chip.sfx("count");
      let n = 3;
      countTimer.current = window.setInterval(() => {
        n -= 1;
        if (n > 0) {
          setCount(n);
          chip.sfx("count");
        } else {
          if (countTimer.current !== null) { window.clearInterval(countTimer.current); countTimer.current = null; }
          chip.sfx("go");
          setPhaseBoth("playing");
          if (musicRef.current) chip.startMusic();
        }
      }, 480);
    };

    const gameOver = () => {
      const s = g.current;
      setPhaseBoth("gameover");
      chip.stopMusic();
      chip.sfx("gameover");
      if (s.score > highRef.current) {
        highRef.current = s.score;
        setHigh(s.score);
        setNewRecord(true);
        try { localStorage.setItem("ry-high", String(s.score)); } catch { /* boş */ }
      }
    };

    const die = () => {
      const s = g.current;
      chip.sfx("crash");
      s.shake = 16;
      s.flash = 1;
      const h = s.snake[0];
      burst(h.x * CELL + CELL / 2, h.y * CELL + CELL / 2, ["#3dff7c", "#ff2d78", "#ffb300", "#eaffe9"], 26);
      s.lives -= 1;
      setLives(s.lives);
      setPhaseBoth("dying");
      deathTimer.current = window.setTimeout(() => {
        if (g.current.lives > 0) {
          resetSnake();
          spawnFood();
          g.current.bonus = null;
          beginCountdown();
        } else {
          gameOver();
        }
      }, 950);
    };

    const start = () => {
      const s = g.current;
      if (s.phase === "countdown" || s.phase === "dying") return;
      chip.ensure();
      clearTimers();
      if (creditsRef.current > 0) {
        creditsRef.current -= 1;
        setCredits(creditsRef.current);
      }
      s.score = 0; setScore(0);
      s.lives = 3; setLives(3);
      s.level = 1; setLevel(1);
      s.apples = 0;
      s.bonus = null;
      s.particles = [];
      s.shake = 0;
      s.flash = 0;
      setNewRecord(false);
      resetSnake();
      spawnFood();
      chip.sfx("start");
      beginCountdown();
    };

    const pauseToggle = () => {
      const s = g.current;
      if (s.phase === "playing") {
        setPhaseBoth("paused");
        chip.sfx("pause");
      } else if (s.phase === "paused") {
        setPhaseBoth("playing");
        chip.sfx("resume");
      }
    };

    const coin = () => {
      creditsRef.current += 1;
      setCredits(creditsRef.current);
      chip.sfx("coin");
    };

    const toggleMusic = () => {
      const nv = !musicRef.current;
      musicRef.current = nv;
      setMusicOn(nv);
      chip.setMusicEnabled(nv);
      const ph = g.current.phase;
      if (!nv) chip.stopMusic();
      else if (ph === "playing" || ph === "paused" || ph === "countdown") chip.startMusic();
      try { localStorage.setItem("ry-music", nv ? "1" : "0"); } catch { /* boş */ }
      onMusicChangeRef.current?.(nv);
    };

    const toggleSfx = () => {
      const nv = !sfxRef.current;
      sfxRef.current = nv;
      setSfxOn(nv);
      chip.setSfxEnabled(nv);
      try { localStorage.setItem("ry-sfx", nv ? "1" : "0"); } catch { /* boş */ }
      if (nv) chip.sfx("eat");
    };

    api.current = { start, pause: pauseToggle, coin, music: toggleMusic, sfx: toggleSfx };

    /* ---- çekim modu yapay zekâsı ---- */
    const aiDir = (): P => {
      const s = g.current;
      const opts = [DIRS.up, DIRS.down, DIRS.left, DIRS.right].filter(
        (d) => !(d.x === -s.dir.x && d.y === -s.dir.y),
      );
      let best: P = s.dir;
      let bestScore = Infinity;
      for (const d of opts) {
        const nh = { x: s.snake[0].x + d.x, y: s.snake[0].y + d.y };
        if (nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS) continue;
        if (s.snake.some((p, i) => i < s.snake.length - 1 && p.x === nh.x && p.y === nh.y)) continue;
        const target = s.bonus ?? s.food;
        let sc = Math.abs(nh.x - target.x) + Math.abs(nh.y - target.y);
        if (d.x === s.dir.x && d.y === s.dir.y) sc -= 0.4;
        if (nh.x === 0 || nh.y === 0 || nh.x === COLS - 1 || nh.y === ROWS - 1) sc += 0.6;
        sc += Math.random() * 0.3;
        if (sc < bestScore) { bestScore = sc; best = d; }
      }
      return best;
    };

    /* ---- bir adım ---- */
    const tick = () => {
      const s = g.current;
      if (s.phase === "attract") {
        s.dir = aiDir();
      } else {
        while (s.queue.length) {
          const d = s.queue.shift()!;
          const rev = d.x === -s.dir.x && d.y === -s.dir.y;
          const same = d.x === s.dir.x && d.y === s.dir.y;
          if (!rev && !same) { s.dir = d; break; }
        }
      }

      const head = s.snake[0];
      const nh = { x: head.x + s.dir.x, y: head.y + s.dir.y };
      const hitWall = nh.x < 0 || nh.y < 0 || nh.x >= COLS || nh.y >= ROWS;
      const hitSelf = s.snake.some((p, i) => i < s.snake.length - 1 && p.x === nh.x && p.y === nh.y);

      if (hitWall || hitSelf) {
        if (s.phase === "attract") {
          resetSnake();
          s.bonus = null;
          spawnFood();
        } else {
          die();
        }
        return;
      }

      s.snake.unshift(nh);
      let ate = false;
      const scoring = s.phase === "playing";

      if (nh.x === s.food.x && nh.y === s.food.y) {
        ate = true;
        if (scoring) {
          s.score += 10;
          setScore(s.score);
          const nl = Math.min(9, 1 + Math.floor(s.score / 60));
          if (nl > s.level) {
            s.level = nl;
            setLevel(nl);
            chip.sfx("levelup");
          } else {
            chip.sfx("eat");
          }
          s.apples += 1;
          if (s.apples % 5 === 0 && !s.bonus) spawnBonus();
        }
        burst(nh.x * CELL + CELL / 2, nh.y * CELL + CELL / 2, ["#ff5b6a", "#ffd166", "#8cff9e"], 10);
        spawnFood();
      } else if (s.bonus && nh.x === s.bonus.x && nh.y === s.bonus.y) {
        ate = true;
        if (scoring) {
          s.score += 50;
          setScore(s.score);
          chip.sfx("bonus");
        }
        s.bonus = null;
        burst(nh.x * CELL + CELL / 2, nh.y * CELL + CELL / 2, ["#ffd166", "#fff3b0", "#ffb300"], 16);
      }

      if (!ate) s.snake.pop();
    };

    /* ---- çizim yardımcıları ---- */
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const star = (cx: number, cy: number, outer: number, inner: number) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const draw = () => {
      const s = g.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (s.shake > 0.5) {
        ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake);
      }
      ctx.clearRect(-24, -24, W + 48, H + 48);

      /* fosfor zemin + dama deseni */
      ctx.fillStyle = "#05130b";
      ctx.fillRect(-24, -24, W + 48, H + 48);
      ctx.fillStyle = "rgba(80,255,140,0.028)";
      for (let y = 0; y < ROWS; y++) {
        for (let x = (y % 2); x < COLS; x += 2) {
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
      ctx.strokeStyle = "rgba(80,255,140,0.055)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < COLS; x++) { ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, H); }
      for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(W, y * CELL + 0.5); }
      ctx.stroke();

      /* elma */
      {
        const pulse = 1 + Math.sin(s.t / 160) * 0.09;
        const fx = s.food.x * CELL + CELL / 2;
        const fy = s.food.y * CELL + CELL / 2;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(pulse, pulse);
        ctx.shadowColor = "rgba(255,59,87,0.9)";
        ctx.shadowBlur = 11;
        ctx.fillStyle = "#ff3b57";
        rr(-8, -7, 16, 15, 4.5);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#c81f3d";
        rr(-8, 1, 16, 7, 4);
        ctx.fill();
        ctx.fillStyle = "#8a5a2b";
        ctx.fillRect(-1, -12, 2.4, 6);
        ctx.fillStyle = "#3ddc74";
        ctx.fillRect(2, -12, 5, 4);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillRect(-5, -4, 3, 3);
        ctx.restore();
      }

      /* bonus yıldız */
      if (s.bonus) {
        const remain = s.bonus.expires - s.t;
        const fast = remain < 1800;
        const blink = Math.floor(s.t / (fast ? 110 : 300)) % 2 === 0;
        const bx = s.bonus.x * CELL + CELL / 2;
        const by = s.bonus.y * CELL + CELL / 2;
        if (blink) {
          ctx.save();
          ctx.shadowColor = "rgba(255,209,102,0.95)";
          ctx.shadowBlur = 13;
          ctx.fillStyle = "#ffd166";
          star(bx, by - 1, 9.5, 4.2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#fff3b0";
          star(bx, by - 1, 4.5, 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = "rgba(255,209,102,0.9)";
        const bw = (CELL - 6) * Math.max(0, Math.min(1, remain / 6500));
        ctx.fillRect(s.bonus.x * CELL + 3, s.bonus.y * CELL + CELL - 3, bw, 2);
      }

      /* yılan */
      const dyingBlink = s.phase === "dying" && Math.floor(s.t / 110) % 2 === 0;
      if (!dyingBlink) {
        const n = s.snake.length;
        for (let i = n - 1; i >= 0; i--) {
          const p = s.snake[i];
          const t = n === 1 ? 0 : i / (n - 1);
          const isHead = i === 0;
          ctx.fillStyle = isHead ? "#a4ffb8" : mix("#7ef29a", "#147a42", t);
          if (isHead) {
            ctx.shadowColor = "rgba(90,255,150,0.85)";
            ctx.shadowBlur = 13;
          }
          rr(p.x * CELL + 1.5, p.y * CELL + 1.5, CELL - 3, CELL - 3, isHead ? 7 : 5);
          ctx.fill();
          ctx.shadowBlur = 0;
          if (isHead) {
            const cx = p.x * CELL + CELL / 2;
            const cy = p.y * CELL + CELL / 2;
            const ox = s.dir.y !== 0 ? 4.5 : 0;
            const oy = s.dir.x !== 0 ? 4.5 : 0;
            const fx2 = s.dir.x * 3.5;
            const fy2 = s.dir.y * 3.5;
            ctx.fillStyle = "#05220f";
            ctx.fillRect(cx + fx2 + ox - 1.6, cy + fy2 + oy - 1.6, 3.2, 3.2);
            ctx.fillRect(cx + fx2 - ox - 1.6, cy + fy2 - oy - 1.6, 3.2, 3.2);
          }
        }
      }

      /* parçacıklar */
      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      /* vinyet + flaş */
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.34)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      if (s.flash > 0.02) {
        ctx.fillStyle = `rgba(255,70,95,${(s.flash * 0.32).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    /* ---- döngü ---- */
    let raf = 0;
    const loop = (now: number) => {
      const s = g.current;
      const dt = s.last ? Math.min(64, now - s.last) : 16;
      s.last = now;
      s.t = now;

      for (const p of s.particles) {
        p.x += (p.vx * dt) / 16;
        p.y += (p.vy * dt) / 16;
        p.vy += 0.0045 * dt;
        p.life -= dt;
      }
      s.particles = s.particles.filter((p) => p.life > 0);
      if (s.shake > 0.5) s.shake *= 0.86;
      else s.shake = 0;
      if (s.flash > 0.02) s.flash *= 0.9;
      else s.flash = 0;

      const ph = s.phase;
      if (ph === "playing" || ph === "attract") {
        s.acc += dt;
        const iv = ph === "attract" ? 115 : intervalFor(s.level);
        let guard = 0;
        while (
          s.acc >= iv &&
          guard++ < 4 &&
          (g.current.phase === "playing" || g.current.phase === "attract")
        ) {
          s.acc -= iv;
          tick();
        }
      } else {
        s.acc = 0;
      }

      if (s.bonus && now > s.bonus.expires) s.bonus = null;

      draw();
      raf = requestAnimationFrame(loop);
    };

    /* başlangıç: çekim modu demosu */
    resetSnake();
    spawnFood();
    raf = requestAnimationFrame(loop);

    /* ---- klavye ---- */
    const dirMap: Record<string, P> = {
      ArrowUp: DIRS.up, ArrowDown: DIRS.down, ArrowLeft: DIRS.left, ArrowRight: DIRS.right,
      w: DIRS.up, s: DIRS.down, a: DIRS.left, d: DIRS.right,
      W: DIRS.up, S: DIRS.down, A: DIRS.left, D: DIRS.right,
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (dirMap[k]) {
        e.preventDefault();
        pushDir(dirMap[k]);
        return;
      }
      if (k === "Enter" || k === " ") {
        e.preventDefault();
        const ph = g.current.phase;
        if (ph === "attract" || ph === "gameover") start();
        else if (ph === "playing" || ph === "paused") pauseToggle();
        return;
      }
      if (k === "p" || k === "P" || k === "Escape") pauseToggle();
      if (k === "m" || k === "M") toggleMusic();
    };
    window.addEventListener("keydown", onKey);

    const onVis = () => {
      if (document.hidden && g.current.phase === "playing") pauseToggle();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVis);
      clearTimers();
      chip.stopMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- dokunmatik ---------------- */
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const st = touchRef.current;
    touchRef.current = null;
    if (!st) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    if (Math.abs(dx) > Math.abs(dy)) pushDir(dx > 0 ? DIRS.right : DIRS.left);
    else pushDir(dy > 0 ? DIRS.down : DIRS.up);
  };

  /* ---------------- küçük arayüz parçaları ---------------- */
  const Hud = ({ label, value, color }: { label: string; value: string; color: string }) => (
    <div className="flex flex-col gap-1">
      <span className="font-arcade text-[7px] tracking-[0.2em] text-[#5c7263]">{label}</span>
      <span className={`font-crt text-2xl leading-none sm:text-3xl ${color}`}>{value}</span>
    </div>
  );

  const PadBtn = ({ d, rot, label }: { d: P; rot: number; label: string }) => (
    <button
      aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); pushDir(d); }}
      className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#39424a] border-b-[3px] bg-gradient-to-b from-[#242b32] to-[#14191e] text-[#9fd8b0] shadow-[0_3px_6px_rgba(0,0,0,0.5)] transition active:translate-y-[2px] active:border-b active:text-[#3dff7c]"
    >
      <ArrowIcon rot={rot} />
    </button>
  );

  const Toggle = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-[6px] border border-[#2b343c] bg-[#0b0e11] px-2.5 py-1.5 transition hover:border-[#39424a]"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full transition-all ${
          on ? "bg-[#3dff7c] shadow-[0_0_8px_#3dff7c]" : "bg-[#3a4750]"
        }`}
      />
      <span className="font-arcade text-[7px] text-[#9fb8a8]">{label}</span>
    </button>
  );

  /* ---------------- render ---------------- */
  return (
    <section className="rise relative w-full max-w-2xl" style={{ animationDelay: "0.15s" }}>
      <div className="relative rounded-t-[26px] rounded-b-[18px] border-2 border-[#2b343c] bg-gradient-to-b from-[#1c2228] to-[#10151a] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.65)] sm:p-5">
        {/* yan şeritler */}
        <div className="pointer-events-none absolute inset-y-10 left-1.5 w-1.5 rounded-full bg-gradient-to-b from-[#ff2d78] via-[#ffb300] to-[#28e0e8] opacity-70" />
        <div className="pointer-events-none absolute inset-y-10 right-1.5 w-1.5 rounded-full bg-gradient-to-b from-[#28e0e8] via-[#ffb300] to-[#ff2d78] opacity-70" />

        {/* marquee */}
        <div className="relative overflow-hidden rounded-[12px] border border-[#3a2c17] bg-[#120d06] px-4 pb-4 pt-3 shadow-[inset_0_0_26px_rgba(255,179,0,0.14)]">
          <div className="lights absolute inset-x-0 top-1 h-3 opacity-90" />
          <div className="flex items-center justify-center gap-3 py-1.5">
            <PixelSnakeMark />
            <h2 className="chroma font-arcade text-lg text-[#eaffe9] sm:text-2xl">RETRO YILAN</h2>
            <PixelSnakeMark flip />
          </div>
          <p className="font-crt text-center text-xl leading-none text-[#ffb300]/90">
            1984 MODEL • FOSFOR EKRAN • ÇİP MÜZİĞİ
          </p>
          <div className="lights absolute inset-x-0 bottom-1 h-3 opacity-90" />
        </div>

        {/* ekran çerçevesi */}
        <div className="mt-4 rounded-[18px] border border-[#2b343c] bg-[#0b0e11] p-3 shadow-[inset_0_2px_12px_rgba(0,0,0,0.9)] sm:p-4">
          {/* HUD */}
          <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1">
            <Hud label="SKOR" value={pad(score)} color="text-[#3dff7c]" />
            <Hud label="REKOR" value={pad(high)} color="text-[#ffb300]" />
            <Hud label="SEVİYE" value={String(level).padStart(2, "0")} color="text-[#28e0e8]" />
            <div className="flex flex-col gap-1">
              <span className="font-arcade text-[7px] tracking-[0.2em] text-[#5c7263]">CAN</span>
              <div className="flex gap-1 pt-1">
                {[0, 1, 2].map((i) => (
                  <PixelHeart key={i} on={i < lives} />
                ))}
              </div>
            </div>
          </div>

          {/* CRT ekran */}
          <div className="scanlines crt-glass crt-flicker relative overflow-hidden rounded-[10px] border border-[#1d3a28] bg-[#05130b] shadow-[inset_0_0_40px_rgba(0,0,0,0.85),0_0_26px_rgba(61,255,124,0.08)]">
            <canvas
              ref={canvasRef}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              className="block h-auto w-full touch-none select-none"
              style={{ aspectRatio: "484 / 440" }}
            />

            {/* ÇEKİM MODU */}
            {phase === "attract" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#03100a]/80 px-4 text-center sm:gap-4">
                <p className="font-arcade text-[8px] tracking-[0.3em] text-[#28e0e8]">PİKSELSOFT SUNAR</p>
                <h3 className="chroma font-arcade text-4xl text-[#eaffe9] sm:text-5xl">YILAN</h3>
                <p className="font-crt text-xl leading-tight text-[#9fd8b0] sm:text-2xl">
                  Elmaları topla, büyü, hızlan —<br />duvarlara ve kuyruğuna dikkat!
                </p>
                <p className="font-crt text-2xl text-[#ffb300]">REKOR&nbsp;&nbsp;{pad(high)}</p>
                <button
                  onClick={() => api.current.start()}
                  className="blink mt-1 cursor-pointer border-2 border-[#3dff7c] bg-[#0a2415] px-6 py-3 font-arcade text-[10px] text-[#3dff7c] shadow-[0_0_18px_rgba(61,255,124,0.35)] transition hover:bg-[#124023] active:translate-y-0.5"
                >
                  ▶ BAŞLAT (ENTER)
                </button>
                <p className="font-crt text-lg text-[#5c7263]">İlk jeton bizden — yön tuşları veya kaydırma ile oyna</p>
              </div>
            )}

            {/* GERİ SAYIM */}
            {phase === "countdown" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#03100a]/55">
                <p className="font-arcade text-[10px] tracking-[0.3em] text-[#28e0e8]">HAZIR OL</p>
                <div
                  key={count}
                  className="pop font-arcade text-6xl text-[#3dff7c]"
                  style={{ textShadow: "0 0 26px rgba(61,255,124,0.85)" }}
                >
                  {count}
                </div>
              </div>
            )}

            {/* DURAKLADI */}
            {phase === "paused" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#03100a]/70 text-center">
                <h3 className="chroma font-arcade text-2xl text-[#eaffe9]">DURAKLADI</h3>
                <p className="font-crt text-xl text-[#9fd8b0]">Devam için P veya BOŞLUK</p>
                <button
                  onClick={() => api.current.pause()}
                  className="cursor-pointer border-2 border-[#28e0e8] bg-[#062024] px-5 py-2.5 font-arcade text-[9px] text-[#28e0e8] transition hover:bg-[#0b3138] active:translate-y-0.5"
                >
                  ▶ DEVAM ET
                </button>
              </div>
            )}

            {/* OYUN BİTTİ */}
            {phase === "gameover" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 bg-[#140409]/85 px-4 text-center">
                <h3
                  className="font-arcade text-2xl text-[#ff2d78] sm:text-3xl"
                  style={{ textShadow: "0 0 22px rgba(255,45,120,0.75)" }}
                >
                  OYUN BİTTİ
                </h3>
                {newRecord && (
                  <p className="blink font-arcade text-[10px] text-[#ffb300]">★ YENİ REKOR ★</p>
                )}
                <p className="font-crt text-3xl text-[#cfe8d8]">
                  SKOR&nbsp;&nbsp;<span className="text-[#3dff7c]">{pad(score)}</span>
                </p>
                <p className="font-crt text-xl text-[#9fd8b0]">REKOR&nbsp;&nbsp;{pad(high)}</p>
                <button
                  onClick={() => api.current.start()}
                  className="blink mt-2 cursor-pointer border-2 border-[#3dff7c] bg-[#0a2415] px-6 py-3 font-arcade text-[10px] text-[#3dff7c] shadow-[0_0_18px_rgba(61,255,124,0.35)] transition hover:bg-[#124023] active:translate-y-0.5"
                >
                  ▶ TEKRAR OYNA (ENTER)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* kontrol paneli */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-[14px] border border-[#2b343c] bg-gradient-to-b from-[#151a1f] to-[#0d1116] p-4">
          {/* yön tuşları */}
          <div className="grid grid-cols-3 gap-1.5">
            <span />
            <PadBtn d={DIRS.up} rot={0} label="Yukarı" />
            <span />
            <PadBtn d={DIRS.left} rot={-90} label="Sol" />
            <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-[#232a31] bg-[#0b0e11]">
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
                <rect x="1" y="5" width="3" height="3" fill="#3dff7c" />
                <rect x="4.5" y="5" width="3" height="3" fill="#1f9e4e" />
                <rect x="8" y="5" width="3" height="3" fill="#1f9e4e" />
                <rect x="8" y="1.5" width="3" height="3" fill="#8cff9e" />
              </svg>
            </div>
            <PadBtn d={DIRS.right} rot={90} label="Sağ" />
            <span />
            <PadBtn d={DIRS.down} rot={180} label="Aşağı" />
            <span />
          </div>

          {/* jeton */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => api.current.coin()}
              className="cursor-pointer rounded-[8px] border border-[#8a6a1f] bg-gradient-to-b from-[#2a230f] to-[#171208] px-4 py-2.5 shadow-[inset_0_0_14px_rgba(255,179,0,0.16)] transition hover:shadow-[inset_0_0_18px_rgba(255,179,0,0.3)] active:translate-y-0.5"
            >
              <span className="font-arcade text-[8px] text-[#ffb300]">◉ JETON AT</span>
            </button>
            <p className="font-crt text-xl leading-none text-[#ffb300]/90">
              KREDİ&nbsp;<span className="text-[#ffe08a]">{credits}</span>
            </p>
          </div>

          {/* aksiyon tuşları */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => api.current.start()}
                aria-label="Başlat"
                className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-full border-b-[5px] border-[#7a1230] bg-gradient-to-b from-[#ff5b7a] to-[#d61f4d] font-arcade text-[8px] text-white shadow-[0_0_22px_rgba(255,45,120,0.35)] transition hover:brightness-110 active:translate-y-[3px] active:border-b-2"
              >
                BAŞLA
              </button>
              <button
                onClick={() => api.current.pause()}
                aria-label="Duraklat"
                className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-b-4 border-[#8a6a1f] bg-gradient-to-b from-[#ffd166] to-[#e09b12] text-[#3a2802] shadow-[0_0_16px_rgba(255,179,0,0.3)] transition hover:brightness-110 active:translate-y-[2px] active:border-b-2 ${
                  phase === "playing" || phase === "paused" ? "" : "opacity-50"
                }`}
              >
                <PauseIcon />
              </button>
            </div>
            <div className="flex gap-2">
              <Toggle on={musicOn} label="MÜZİK" onClick={() => api.current.music()} />
              <Toggle on={sfxOn} label="SES" onClick={() => api.current.sfx()} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
