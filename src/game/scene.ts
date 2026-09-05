/* Retro oyun odası — 480×270 piksel sahne, nearest-neighbor büyütülür.
   Çocuk klavyede yazar, kedi takılır, pencerede neon şehir, yağmur, arabalar… */

export type OwnedMap = Record<string, boolean>;

interface Floater {
  x: number;
  y: number;
  txt: string;
  c: string;
  born: number;
}

interface CoinP {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
}

interface Mote {
  x: number;
  y: number;
  s: number;
}

const rnd = (i: number): number => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const TAU = Math.PI * 2;

/* mini sprite matrisleri */
const INVADER = [
  "..X.....X..",
  "...X...X...",
  "..XXXXXXX..",
  ".XX.XXX.XX.",
  "XXXXXXXXXXX",
  "X.XXXXXXX.X",
  "X.X.....X.X",
  "...XX.XX...",
];
const GHOST = [
  "..XXXXXX...",
  ".XXXXXXXX..",
  "XX.OX.XO.XX",
  "XXXXXXXXXXX",
  "XXXXXXXXXXX",
  "XXXXXXXXXXX",
  "X.XX.XX.XX.",
];

function sprite(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number, c: string, s = 3) {
  ctx.fillStyle = c;
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      if (rows[j][i] === "X") ctx.fillRect(x + i * s, y + j * s, s, s);
      if (rows[j][i] === "O") {
        ctx.fillStyle = "#0c1024";
        ctx.fillRect(x + i * s, y + j * s, s, s);
        ctx.fillStyle = c;
      }
    }
  }
}

const BUILDINGS = [
  { x: 4, w: 26, h: 62, s: 3 },
  { x: 32, w: 18, h: 44, s: 11 },
  { x: 52, w: 30, h: 76, s: 7 },
  { x: 84, w: 22, h: 52, s: 19 },
  { x: 108, w: 28, h: 68, s: 23 },
  { x: 138, w: 18, h: 40, s: 29 },
];

export class RoomScene {
  readonly W = 480;
  readonly H = 270;
  private floaters: Floater[] = [];
  private coins: CoinP[] = [];
  private motes: Mote[] = Array.from({ length: 18 }, (_, i) => ({
    x: rnd(i + 50) * 480,
    y: rnd(i + 90) * 240,
    s: 0.2 + rnd(i) * 0.5,
  }));
  private catX = 190;
  private catTarget = 190;
  private catDir = 1;
  private catMoveAt = 4000;

  addFloater(txt: string, x: number, y: number, c = "#3dff7c") {
    this.floaters.push({ x, y, txt, c, born: performance.now() });
  }

  burst() {
    const now = performance.now();
    for (let i = 0; i < 16; i++) {
      this.coins.push({
        x: 288 + rnd(i) * 30,
        y: 118,
        vx: (rnd(i + 40) - 0.5) * 90,
        vy: -40 - rnd(i + 70) * 70,
        born: now,
      });
    }
    this.addFloater("LEVEL UP!", 250, 84, "#ffb300");
  }

  coinDrip(n: number) {
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      this.coins.push({
        x: 396 + rnd(i + now % 97) * 10,
        y: 168,
        vx: (rnd(i + 3) - 0.5) * 26,
        vy: -26 - rnd(i + 8) * 22,
        born: now,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, level: number, owned: OwnedMap, t: number) {
    const W = this.W;
    const H = this.H;
    const f = Math.floor(t / 100); // pixel-anim karesi
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    /* ---- duvar & zemin ---- */
    const wg = ctx.createLinearGradient(0, 0, 0, 200);
    wg.addColorStop(0, "#1a2140");
    wg.addColorStop(1, "#121831");
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, 200);
    for (let i = 0; i < 5; i++) px(0, 34 + i * 38, W, 1, "#232c52");
    px(0, 200, W, 70, "#1b2133");
    for (let i = 0; i < 8; i++) px(0, 208 + i * 9, W, 1, "#161b2b");
    for (let i = 0; i < 12; i++) px(i * 42, 200, 1, 70, "#161b2b");

    /* ---- pencere: neon şehir ---- */
    px(22, 28, 154, 126, "#2c3554"); // çerçeve
    px(28, 34, 142, 114, "#070b1c"); // gece
    ctx.save();
    ctx.beginPath();
    ctx.rect(28, 34, 142, 114);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, 34, 0, 148);
    sky.addColorStop(0, "#0a1030");
    sky.addColorStop(1, "#251242");
    ctx.fillStyle = sky;
    ctx.fillRect(28, 34, 142, 114);
    // ay
    ctx.fillStyle = "#f4ecd0";
    ctx.beginPath();
    ctx.arc(150, 52, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#d8cfae";
    ctx.beginPath();
    ctx.arc(147, 50, 2.5, 0, TAU);
    ctx.arc(153, 55, 1.6, 0, TAU);
    ctx.fill();
    // yıldızlar
    for (let i = 0; i < 14; i++) {
      const sx = 30 + rnd(i + 200) * 138;
      const sy = 36 + rnd(i + 300) * 40;
      ctx.fillStyle = f % 20 === i % 20 ? "#0c1024" : "#cfe3ff";
      ctx.fillRect(sx, sy, 1, 1);
    }
    // binalar
    const winTick = Math.floor(t / 1800);
    for (const b of BUILDINGS) {
      const by = 148 - b.h;
      px(28 + b.x, by, b.w, b.h, "#141a36");
      px(28 + b.x, by, b.w, 2, "#1d2547");
      for (let wy = 0; wy < Math.floor((b.h - 8) / 7); wy++) {
        for (let wx = 0; wx < Math.floor((b.w - 6) / 6); wx++) {
          const lit = rnd(b.s + wx * 7 + wy * 13 + winTick * 0.35) > 0.55;
          px(32 + b.x + wx * 6, by + 5 + wy * 7, 3, 3, lit ? "#ffd97a" : "#0d1226");
        }
      }
    }
    // OTEL neon tabelası
    const neonA = rnd(Math.floor(t / 140)) > 0.14 ? 1 : 0.25;
    ctx.globalAlpha = neonA;
    px(58, 66, 34, 12, "#2a0f22");
    ctx.fillStyle = "#ff2d78";
    ctx.font = "bold 8px monospace";
    ctx.fillText("OTEL", 61, 75);
    ctx.globalAlpha = neonA * 0.25;
    px(55, 63, 40, 18, "#ff2d78");
    ctx.globalAlpha = 1;
    // sokak + arabalar
    px(28, 140, 142, 8, "#0b0f22");
    const carP = (t % 7000) / 7000;
    const carX = -12 + carP * 170;
    px(carX, 137, 12, 4, "#232a44");
    px(carX + 10, 138, 2, 2, "#fff7d0");
    px(carX - 2, 138, 2, 2, "#ff5a5a");
    const car2X = 170 - ((t % 9500) / 9500) * 180;
    px(car2X, 141, 12, 4, "#2b2440");
    px(car2X - 2, 142, 2, 2, "#fff7d0");
    // yağmur
    ctx.fillStyle = "rgba(140,190,255,0.35)";
    for (let i = 0; i < 30; i++) {
      const rx = 28 + rnd(i + 500) * 142;
      const ry = 34 + ((t * 0.09 + rnd(i + 600) * 120) % 114);
      ctx.fillRect(rx, ry, 1, 3);
    }
    ctx.restore();
    px(96, 34, 3, 114, "#2c3554"); // pencere kaydı
    px(28, 88, 142, 3, "#2c3554");
    px(18, 152, 162, 5, "#38436b"); // denizlik

    /* ---- duvar fotoğrafı & posterler ---- */
    px(186, 50, 28, 24, "#3a2f28");
    px(189, 53, 22, 18, "#ff9d5c");
    px(189, 62, 22, 9, "#3b2b4a");
    ctx.fillStyle = "#ffd97a";
    ctx.beginPath();
    ctx.arc(200, 59, 3.5, 0, TAU);
    ctx.fill();
    px(186, 82, 28, 24, "#3a2f28");
    px(189, 85, 22, 18, "#26314f");
    sprite(ctx, GHOST.slice(0, 5), 193, 88, "#c9d6ff", 1.6);
    px(402, 40, 58, 44, "#241a33");
    px(406, 44, 50, 36, "#141024");
    sprite(ctx, INVADER, 413, 50, "#3dff7c", 3);
    px(402, 92, 58, 44, "#241a33");
    px(406, 96, 50, 36, "#141024");
    sprite(ctx, GHOST, 414, 101, "#ff2d78", 3);

    /* ---- neon RETRO tabela ---- */
    const sFlick = rnd(Math.floor(t / 210)) > 0.1 ? 1 : 0.35;
    ctx.save();
    ctx.globalAlpha = 0.28 * sFlick;
    px(228, 20, 132, 34, "#ff2d78");
    ctx.restore();
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textBaseline = "top";
    ctx.globalAlpha = sFlick;
    ctx.fillStyle = "#28e0e8";
    ctx.fillText("RETRO", 241, 29);
    ctx.fillStyle = "#ff2d78";
    ctx.fillText("RETRO", 239, 27);
    ctx.globalAlpha = 1;
    ctx.textBaseline = "alphabetic";
    const hue = (t / 30) % 360;
    px(239, 48, 110, 2, `hsl(${hue} 100% 65%)`);

    /* ---- RGB tavan şeridi ---- */
    if (owned.rgb) {
      for (let i = 0; i < 48; i++) {
        px(i * 10, 4, 10, 2, `hsl(${(hue + i * 9) % 360} 100% 62%)`);
      }
      ctx.globalAlpha = 0.05;
      px(0, 6, W, 26, `hsl(${hue} 100% 60%)`);
      ctx.globalAlpha = 1;
    }

    /* ---- halı ---- */
    ctx.fillStyle = "#43204d";
    ctx.beginPath();
    ctx.ellipse(205, 238, 96, 22, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#5c2f66";
    ctx.beginPath();
    ctx.ellipse(205, 238, 76, 16, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#7c3f78";
    ctx.beginPath();
    ctx.ellipse(205, 238, 50, 10, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffb300";
    ctx.beginPath();
    ctx.ellipse(205, 238, 22, 4, 0, 0, TAU);
    ctx.fill();

    /* ---- koltuk ---- */
    const sofaC = "#8a3b52";
    px(398, 150, 78, 46, sofaC);
    px(394, 146, 10, 50, "#a04a63");
    px(466, 146, 10, 50, "#a04a63");
    px(398, 142, 78, 12, "#a04a63");
    px(404, 168, 32, 14, "#c25e77");
    px(438, 168, 32, 14, "#c25e77");
    px(402, 196, 6, 6, "#2b1626");
    px(464, 196, 6, 6, "#2b1626");
    // yastık + kumanda
    px(448, 150, 16, 16, "#28e0e8");
    px(451, 153, 10, 10, "#1ba8b0");
    px(412, 170, 12, 5, "#20242e");
    px(414, 171, 2, 2, "#ff2d78");

    /* ---- masa + PC kurulumu ---- */
    const deskY = 150;
    px(208, deskY, 214, 8, "#5b4436");
    px(208, deskY, 214, 2, "#77593f");
    px(214, deskY + 8, 8, 44, "#4a3629");
    px(408, deskY + 8, 8, 44, "#4a3629");
    px(214, 186, 202, 3, "#3d2c21");

    /* kasa */
    px(382, 160, 28, 38, "#1c2230");
    px(382, 160, 28, 2, "#2c3550");
    px(386, 166, 20, 3, "#10141f");
    px(386, 172, 20, 3, "#10141f");
    if (owned.ram) px(386, 178, 20, 2, `hsl(${(hue + 120) % 360} 100% 60%)`);
    const ledOn = f % 8 < 4;
    px(404, 190, 3, 3, ledOn ? "#3dff7c" : "#173c26");
    if (owned.ssd) px(398, 190, 3, 3, f % 3 === 0 ? "#28e0e8" : "#123c40");
    if (owned.cooling) {
      const cx = 392;
      const cy = 186;
      ctx.strokeStyle = "#3a4666";
      ctx.beginPath();
      ctx.arc(cx, cy, 5.5, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = "#8fd8ff";
      for (let k = 0; k < 3; k++) {
        const a = (t / 60 + (k * TAU) / 3) % TAU;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
        ctx.stroke();
      }
    }
    if (owned.rgb) {
      px(380, 158, 2, 40, `hsl(${(hue + 60) % 360} 100% 60%)`);
      ctx.globalAlpha = 0.16;
      px(374, 156, 40, 44, `hsl(${(hue + 60) % 360} 100% 60%)`);
      ctx.globalAlpha = 1;
    }

    /* monitör(ler) */
    const crt = level < 4;
    if (crt) {
      px(246, 98, 76, 52, "#d8d3c4");
      px(250, 102, 68, 40, "#08130c");
      px(262, 150, 44, 4, "#b9b4a4");
    } else {
      px(244, 94, 82, 54, owned.monitor ? "#0e2b33" : "#20242e");
      px(248, 98, 74, 46, "#070d18");
      px(278, 148, 12, 6, "#20242e");
      if (owned.monitor) {
        ctx.globalAlpha = 0.5;
        px(242, 92, 86, 2, "#28e0e8");
        px(242, 150, 86, 2, "#28e0e8");
        ctx.globalAlpha = 1;
      }
    }
    this.drawScreen(ctx, level, t, crt ? 250 : 248, crt ? 102 : 98, crt ? 68 : 74, crt ? 40 : 46);

    if (owned.gpu) {
      px(336, 106, 52, 40, "#20242e");
      px(340, 110, 44, 30, "#140b1e");
      ctx.fillStyle = "#ffb300";
      ctx.font = "bold 7px monospace";
      const earn = Math.floor(t / 40) % 100000;
      ctx.fillText("µC " + String(earn).padStart(5, "0"), 343, 122);
      ctx.fillStyle = "#3dff7c";
      ctx.fillText("MINING…", 343, 132);
      px(356, 146, 10, 4, "#20242e");
    }

    /* klavye + kupa */
    if (owned.keyboard) {
      for (let i = 0; i < 9; i++) px(264 + i * 5, 145, 4, 3, `hsl(${(hue + i * 30) % 360} 90% 60%)`);
    } else {
      px(262, 144, 48, 5, "#2b3040");
      for (let i = 0; i < 9; i++) px(264 + i * 5, 145, 4, 3, "#414a63");
    }
    px(228, 138, 8, 10, "#ffb300");
    px(236, 140, 3, 5, "#ffb300");
    ctx.globalAlpha = 0.5;
    px(229, 130 + (f % 6 < 3 ? 0 : -2), 2, 4, "#9fb4c8");
    ctx.globalAlpha = 1;

    /* ---- çocuk (arkadan görünüm, yazıyor) ---- */
    const bob = f % 2;
    const hoodie = "#3aa7a3";
    // kollar + eller klavyede
    px(276, 136, 7, 10, hoodie);
    px(315, 136, 7, 10, hoodie);
    px(270 + bob, 143, 6, 4, "#f2c49b");
    px(312 - bob, 143, 6, 4, "#f2c49b");
    // gövde
    px(284, 126, 24, 26, hoodie);
    px(284, 126, 24, 4, "#2f8b87");
    // koltuk sırtı
    if (owned.chair) {
      px(282, 118, 28, 40, "#a32638");
      px(285, 121, 22, 34, "#c23148");
      px(294, 121, 4, 34, "#ffb300");
      px(282, 158, 28, 5, "#1c1116");
    } else {
      px(283, 120, 26, 38, "#232733");
      px(286, 123, 20, 32, "#303648");
      px(283, 158, 26, 4, "#191c26");
    }
    // koltuk alt gövde
    px(293, 162, 6, 20, "#191c26");
    px(283, 182, 26, 4, "#191c26");
    px(281, 186, 5, 4, "#101218");
    px(306, 186, 5, 4, "#101218");
    // kafa + saç + kulaklık
    px(287, 103 - bob, 18, 18, "#f2c49b");
    px(286, 100 - bob, 20, 9, "#2a2030");
    px(286, 109 - bob, 3, 8, "#2a2030");
    px(303, 109 - bob, 3, 8, "#2a2030");
    px(285, 98 - bob, 22, 4, "#181a22");
    px(283, 106 - bob, 4, 9, "#181a22");
    px(305, 106 - bob, 4, 9, "#181a22");
    px(284, 108 - bob, 2, 5, "#28e0e8");
    px(306, 108 - bob, 2, 5, "#28e0e8");
    // monitör ışığı çocuğa vurur
    ctx.globalAlpha = 0.1;
    px(284, 100 - bob, 24, 52, level >= 6 ? "#ff2d78" : "#3dff7c");
    ctx.globalAlpha = 1;

    /* ---- kedi ---- */
    this.updateCat(t);
    const cy = this.catX < 300 ? 224 : 200;
    const cx = this.catX;
    const tailA = Math.sin(t / 220) * 0.7;
    ctx.save();
    ctx.translate(cx - 12, cy);
    ctx.rotate(tailA * 0.15);
    px(-2, -14, 4, 12, "#e8963e");
    px(-4, -18, 4, 5, "#e8963e");
    ctx.restore();
    px(cx - 10, cy - 10, 22, 12, "#e8963e");
    px(cx - 10, cy - 2, 22, 3, "#b96f28");
    px(cx + (this.catDir > 0 ? 10 : -18), cy - 16, 9, 9, "#e8963e");
    const hx = cx + (this.catDir > 0 ? 10 : -18);
    px(hx - 1, cy - 19, 3, 4, "#e8963e");
    px(hx + 7, cy - 19, 3, 4, "#e8963e");
    const blink = f % 34 === 0;
    px(hx + 1, cy - 14, 2, blink ? 1 : 2, "#1c2a1c");
    px(hx + 5, cy - 14, 2, blink ? 1 : 2, "#1c2a1c");
    px(hx + 3, cy - 11, 2, 1, "#ff9db0");
    // uyku Z
    if (Math.abs(this.catTarget - this.catX) < 1 && f % 60 > 30) {
      ctx.fillStyle = "#8fd8ff";
      ctx.font = "bold 7px monospace";
      ctx.fillText("z", hx + 12, cy - 20);
      ctx.fillText("Z", hx + 16, cy - 26);
    }

    /* ---- toz zerreleri ---- */
    ctx.globalAlpha = 0.16;
    for (const m of this.motes) {
      const my = (m.y - t * 0.004 * m.s) % 240;
      const yy = my < 0 ? my + 240 : my;
      ctx.fillStyle = "#cfe3ff";
      ctx.fillRect((m.x + t * 0.002 * m.s) % W, yy, 1, 1);
    }
    ctx.globalAlpha = 1;

    /* ---- paracıklar ---- */
    const now = performance.now();
    this.coins = this.coins.filter((c) => now - c.born < 1100);
    for (const c of this.coins) {
      const dt = (now - c.born) / 1000;
      const x = c.x + c.vx * dt;
      const y = c.y + c.vy * dt + 130 * dt * dt;
      ctx.globalAlpha = Math.max(0, 1 - (now - c.born) / 1100);
      ctx.fillStyle = "#ffb300";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#ffe28a";
      ctx.fillRect(x - 1, y - 2, 1, 3);
      ctx.globalAlpha = 1;
    }

    /* ---- yüzen yazılar ---- */
    this.floaters = this.floaters.filter((fl) => now - fl.born < 950);
    ctx.font = "bold 9px monospace";
    for (const fl of this.floaters) {
      const p = (now - fl.born) / 950;
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = "#070b1c";
      ctx.fillText(fl.txt, fl.x + 1, fl.y - p * 22 + 1);
      ctx.fillStyle = fl.c;
      ctx.fillText(fl.txt, fl.x, fl.y - p * 22);
      ctx.globalAlpha = 1;
    }

    /* ---- vinyet ---- */
    const vg = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 300);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  private drawScreen(
    ctx: CanvasRenderingContext2D,
    level: number,
    t: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = "#070d18";
    ctx.fillRect(x, y, w, h);
    const tier = level <= 2 ? 0 : level <= 5 ? 1 : level <= 8 ? 2 : 3;
    if (tier === 0) {
      for (let r = 0; r < 6; r++) {
        const rw = 8 + rnd(r + 900 + Math.floor(t / 700)) * (w - 20);
        ctx.fillStyle = r === 5 && Math.floor(t / 400) % 2 ? "#3dff7c" : "#1f7a44";
        ctx.fillRect(x + 3, y + 4 + r * 6, rw, 2);
      }
      ctx.fillStyle = "#3dff7c";
      ctx.font = "bold 6px monospace";
      ctx.fillText("> mine µC", x + 3, y + h - 4);
    } else if (tier === 1) {
      ctx.fillStyle = "#28e0e8";
      ctx.font = "bold 6px monospace";
      ctx.fillText("µC MADEN", x + 3, y + 8);
      for (let i = 0; i < 9; i++) {
        const bh = 6 + rnd(i + Math.floor(t / 300)) * (h - 18);
        ctx.fillStyle = i % 2 ? "#28e0e8" : "#3dff7c";
        ctx.fillRect(x + 4 + i * 8, y + h - 4 - bh, 5, bh);
      }
    } else if (tier === 2) {
      for (let i = 0; i < 8; i++) {
        const cx0 = x + 3 + i * 9;
        for (let j = 0; j < 5; j++) {
          const cy0 = y + ((t * 0.05 + i * 13 + j * 11) % (h + 10)) - 5;
          ctx.fillStyle = j === 0 ? "#d8ffe9" : "#3dff7c";
          ctx.globalAlpha = 1 - j * 0.2;
          ctx.fillRect(cx0, cy0, 2, 2);
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ff2d78";
      ctx.font = "bold 6px monospace";
      ctx.fillText("HASH " + (Math.floor(t / 97) % 999), x + 3, y + h - 4);
    } else {
      const hue2 = (t / 12) % 360;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU + t / 900;
        const r = 6 + ((t / 24 + i * 5) % (Math.min(w, h) / 2));
        ctx.fillStyle = `hsl(${(hue2 + i * 22) % 360} 100% 65%)`;
        ctx.fillRect(x + w / 2 + Math.cos(a) * r, y + h / 2 + Math.sin(a) * r, 2, 2);
      }
      ctx.fillStyle = "#ffb300";
      ctx.font = "bold 7px monospace";
      ctx.fillText("MAX POWER", x + 4, y + 10);
    }
    ctx.restore();
  }

  private updateCat(t: number) {
    if (t > this.catMoveAt) {
      if (Math.abs(this.catTarget - this.catX) < 1) {
        this.catTarget = this.catTarget < 300 ? 428 : 190;
        this.catMoveAt = t + 5000 + rnd(Math.floor(t)) * 4000;
      }
    }
    const d = this.catTarget - this.catX;
    if (Math.abs(d) > 0.5) {
      this.catX += Math.sign(d) * 0.28;
      this.catDir = Math.sign(d);
    } else {
      this.catX = this.catTarget;
    }
  }
}
