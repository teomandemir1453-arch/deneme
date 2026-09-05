import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { chip } from "../audio/engine";

type Phase = "menu" | "playing" | "paused" | "over";

const LANES = [-2.7, 0, 2.7];
const BEST_KEY = "neon-runner-best";

interface Hud {
  phase: Phase;
  score: number;
  coins: number;
  lives: number;
  speed: number;
  best: number;
  newBest: boolean;
}

function HeartSVG({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 14 12" className="h-4 w-4" shapeRendering="crispEdges" aria-hidden>
      <g fill={on ? "#ff2d78" : "#2a3145"}>
        <rect x="1" y="1" width="4" height="2" />
        <rect x="9" y="1" width="4" height="2" />
        <rect x="0" y="3" width="14" height="3" />
        <rect x="1" y="6" width="12" height="2" />
        <rect x="3" y="8" width="8" height="2" />
        <rect x="5" y="10" width="4" height="2" />
      </g>
      {on && <rect x="2" y="2" width="2" height="2" fill="#ff8ab5" />}
    </svg>
  );
}

function CoinMini() {
  return (
    <svg viewBox="0 0 12 12" className="h-4 w-4" shapeRendering="crispEdges" aria-hidden>
      <rect x="3" y="1" width="6" height="10" fill="#ffb300" />
      <rect x="1" y="3" width="10" height="6" fill="#ffb300" />
      <rect x="4" y="2" width="4" height="8" fill="#ffd24a" />
      <rect x="5" y="4" width="1" height="4" fill="#8a5a00" />
    </svg>
  );
}

export default function NeonRunner() {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ start: () => void; pause: () => void }>({ start: () => {}, pause: () => {} });
  const [hud, setHud] = useState<Hud>({
    phase: "menu",
    score: 0,
    coins: 0,
    lives: 3,
    speed: 0,
    best: Number(localStorage.getItem(BEST_KEY) ?? 0),
    newBest: false,
  });
  const [flash, setFlash] = useState("");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    /* ---------------- temel kurulum ---------------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0118);
    scene.fog = new THREE.Fog(0x0a0118, 26, 165);

    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);
    camera.position.set(0, 4.4, 8.5);

    const fit = () => {
      const w = mount.clientWidth || 600;
      const h = mount.clientHeight || 480;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(mount);

    /* ---------------- ışıklar ---------------- */
    scene.add(new THREE.AmbientLight(0x556688, 1.8));
    const dir = new THREE.DirectionalLight(0xff88cc, 1.6);
    dir.position.set(-6, 12, 4);
    scene.add(dir);

    /* ---------------- dokular ---------------- */
    const gridTex = (() => {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const x = c.getContext("2d")!;
      x.fillStyle = "#0a0420";
      x.fillRect(0, 0, 128, 128);
      x.strokeStyle = "rgba(40,224,232,0.14)";
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(64, 0); x.lineTo(64, 128);
      x.moveTo(0, 64); x.lineTo(128, 64);
      x.stroke();
      x.strokeStyle = "rgba(255,45,169,0.3)";
      x.lineWidth = 7;
      x.beginPath();
      x.moveTo(126, 0); x.lineTo(126, 128);
      x.moveTo(0, 126); x.lineTo(128, 126);
      x.stroke();
      x.strokeStyle = "#ff2da9";
      x.lineWidth = 2;
      x.stroke();
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(18, 100);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    })();

    const sunTex = (() => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const x = c.getContext("2d")!;
      const g = x.createLinearGradient(0, 16, 0, 240);
      g.addColorStop(0, "#ffe259");
      g.addColorStop(0.45, "#ff9d3f");
      g.addColorStop(0.75, "#ff2d78");
      g.addColorStop(1, "#a12cff");
      x.fillStyle = g;
      x.beginPath();
      x.arc(128, 128, 118, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#0a0118";
      let y = 142;
      let h = 4;
      while (y < 250) {
        x.fillRect(0, y, 256, h);
        y += h + 13;
        h += 3;
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();

    const glowTex = (() => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 128;
      const x = c.getContext("2d")!;
      const g = x.createRadialGradient(128, 64, 8, 128, 64, 128);
      g.addColorStop(0, "rgba(255,45,120,0.6)");
      g.addColorStop(1, "rgba(255,45,120,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, 256, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();

    /* ---------------- çevre ---------------- */
    const grid = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 500),
      new THREE.MeshBasicMaterial({ map: gridTex }),
    );
    grid.rotation.x = -Math.PI / 2;
    grid.position.set(0, 0, -210);
    scene.add(grid);

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(8.8, 500),
      new THREE.MeshBasicMaterial({ color: 0x12082b }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, -210);
    scene.add(road);

    const railMat = new THREE.MeshBasicMaterial({ color: 0xff2d78 });
    for (const rx of [-4.5, 4.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 500), railMat);
      rail.position.set(rx, 0.1, -210);
      scene.add(rail);
    }

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(34, 48),
      new THREE.MeshBasicMaterial({ map: sunTex, fog: false }),
    );
    sun.position.set(0, 17, -190);
    scene.add(sun);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 110),
      new THREE.MeshBasicMaterial({
        map: glowTex,
        fog: false,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.position.set(0, 8, -194);
    scene.add(glow);

    /* yıldızlar */
    {
      const n = 460;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = (Math.random() - 0.5) * 420;
        arr[i * 3 + 1] = 6 + Math.random() * 130;
        arr[i * 3 + 2] = -240 + Math.random() * 200;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      const stars = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: 0x9fd8ff, size: 1.05, fog: false, transparent: true, opacity: 0.85 }),
      );
      scene.add(stars);
    }

    /* neon binalar (havuz) */
    const unitEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const bMats = [
      new THREE.LineBasicMaterial({ color: 0xff2d78, transparent: true, opacity: 0.7 }),
      new THREE.LineBasicMaterial({ color: 0x28e0e8, transparent: true, opacity: 0.7 }),
      new THREE.LineBasicMaterial({ color: 0x7a5cff, transparent: true, opacity: 0.7 }),
    ];
    const buildings: THREE.LineSegments[] = [];
    const randBuilding = (b: THREE.LineSegments, initial: boolean) => {
      b.scale.set(3 + Math.random() * 5, 4 + Math.random() * 12, 3 + Math.random() * 5);
      b.position.set(
        (Math.random() < 0.5 ? -1 : 1) * (11 + Math.random() * 10),
        b.scale.y / 2,
        initial ? -230 + Math.random() * 245 : -230,
      );
    };
    for (let i = 0; i < 44; i++) {
      const b = new THREE.LineSegments(unitEdges, bMats[i % 3]);
      randBuilding(b, true);
      scene.add(b);
      buildings.push(b);
    }

    /* ---------------- oyuncu gemisi ---------------- */
    const ship = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x101c2c,
      emissive: 0x28e0e8,
      emissiveIntensity: 0.3,
      metalness: 0.6,
      roughness: 0.3,
    });
    ship.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.6), bodyMat));
    const cockpit = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.32, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x200a24, emissive: 0xff2d78, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.4 }),
    );
    cockpit.position.set(0, 0.36, -0.2);
    ship.add(cockpit);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, 0.1, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x0c1622, emissive: 0x28e0e8, emissiveIntensity: 0.55, metalness: 0.5, roughness: 0.4 }),
    );
    wing.position.set(0, -0.02, 0.65);
    ship.add(wing);
    const engine = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.45),
      new THREE.MeshBasicMaterial({
        color: 0xffb300,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    engine.position.set(0, 0, 1.4);
    ship.add(engine);
    const shipLight = new THREE.PointLight(0x28e0e8, 16, 18, 2);
    shipLight.position.set(0, 1.1, 0.4);
    ship.add(shipLight);
    ship.position.set(0, 0.7, 0);
    scene.add(ship);

    /* ---------------- engeller ve coinler ---------------- */
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1a0b2e, emissive: 0xff2d78, emissiveIntensity: 0.75, metalness: 0.4, roughness: 0.4,
    });
    const barMat = new THREE.MeshStandardMaterial({
      color: 0x08202a, emissive: 0x28e0e8, emissiveIntensity: 0.85, metalness: 0.4, roughness: 0.4,
    });
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0x6b4a00, emissive: 0xffb300, emissiveIntensity: 1.15, metalness: 0.9, roughness: 0.25,
    });
    const wallGeo = new THREE.BoxGeometry(2.5, 3, 0.7);
    const barGeo = new THREE.BoxGeometry(2.5, 1.1, 0.7);
    const coinGeo = new THREE.OctahedronGeometry(0.55);

    type ObType = "wall" | "bar" | "coin";
    interface Ob { mesh: THREE.Mesh; lane: number; type: ObType }
    const pools: Record<ObType, THREE.Mesh[]> = { wall: [], bar: [], coin: [] };
    const active: Ob[] = [];

    const takeMesh = (type: ObType): THREE.Mesh => {
      const m = pools[type].pop();
      if (m) return m;
      const geo = type === "wall" ? wallGeo : type === "bar" ? barGeo : coinGeo;
      const mat = type === "wall" ? wallMat : type === "bar" ? barMat : coinMat;
      return new THREE.Mesh(geo, mat);
    };
    const release = (ob: Ob) => {
      scene.remove(ob.mesh);
      pools[ob.type].push(ob.mesh);
    };
    const spawnOb = (type: ObType, lane: number, z: number) => {
      const mesh = takeMesh(type);
      mesh.position.set(LANES[lane], type === "wall" ? 1.5 : type === "bar" ? 0.55 : 1.15, z);
      mesh.visible = true;
      scene.add(mesh);
      active.push({ mesh, lane, type });
    };
    const clearField = () => {
      while (active.length) release(active.pop()!);
    };

    /* ---------------- parçacık patlamaları ---------------- */
    interface Burst { pts: THREE.Points; vel: Float32Array; life: number; max: number }
    const bursts: Burst[] = [];
    const burst = (pos: THREE.Vector3, color: number, n: number, spd: number) => {
      const arr = new Float32Array(n * 3);
      const vel = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = pos.x;
        arr[i * 3 + 1] = pos.y;
        arr[i * 3 + 2] = pos.z;
        const a = Math.random() * Math.PI * 2;
        const b = Math.random() * Math.PI;
        const s = spd * (0.4 + Math.random() * 0.8);
        vel[i * 3] = Math.sin(b) * Math.cos(a) * s;
        vel[i * 3 + 1] = Math.abs(Math.cos(b)) * s * 1.2 + 2;
        vel[i * 3 + 2] = Math.sin(b) * Math.sin(a) * s;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      const pts = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          color,
          size: 0.24,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      scene.add(pts);
      bursts.push({ pts, vel, life: 0.8, max: 0.8 });
    };

    /* ---------------- oyun durumu ---------------- */
    const g = {
      phase: "menu" as Phase,
      lane: 1,
      x: 0,
      h: 0,
      vy: 0,
      jumping: false,
      speed: 12,
      dist: 0,
      coins: 0,
      lives: 3,
      invuln: 0,
      dying: 0,
      shake: 0,
      spawnAcc: 0,
      tier: 0,
      time: 0,
      frame: 0,
      best: Number(localStorage.getItem(BEST_KEY) ?? 0),
      newBest: false,
    };

    const setPhase = (p: Phase) => {
      g.phase = p;
      setHud((h) => ({ ...h, phase: p }));
    };

    const score = () => Math.floor(g.dist) + g.coins * 25;

    const crash = (ob: Ob) => {
      g.lives -= 1;
      g.shake = 1;
      burst(ob.mesh.position.clone(), 0xff2d78, 26, 9);
      release(active.splice(active.indexOf(ob), 1)[0]);
      chip.sfx("crash");
      if (g.lives <= 0) {
        g.dying = 1.0;
        burst(ship.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xffb300, 40, 12);
      } else {
        g.invuln = 2.2;
      }
    };

    const start = () => {
      clearField();
      bursts.forEach((b) => scene.remove(b.pts));
      bursts.length = 0;
      Object.assign(g, {
        lane: 1, x: 0, h: 0, vy: 0, jumping: false,
        speed: 22, dist: 0, coins: 0, lives: 3,
        invuln: 0, dying: 0, shake: 0, spawnAcc: 0, tier: 0, newBest: false,
      });
      ship.visible = true;
      chip.ensure();
      if (!chip.musicPlaying) chip.startMusic();
      chip.sfx("start");
      setPhase("playing");
      setHud((h) => ({ ...h, lives: 3, coins: 0, score: 0, newBest: false }));
    };

    const pauseToggle = () => {
      if (g.phase === "playing") {
        chip.sfx("pause");
        setPhase("paused");
      } else if (g.phase === "paused") {
        chip.sfx("resume");
        setPhase("playing");
      }
    };

    const moveLane = (d: number) => {
      if (g.phase !== "playing" || g.dying > 0) return;
      g.lane = Math.min(2, Math.max(0, g.lane + d));
      chip.sfx("count");
    };
    const jump = () => {
      if (g.phase !== "playing" || g.dying > 0 || g.jumping) return;
      g.jumping = true;
      g.vy = 10.5;
      chip.sfx("count");
    };

    apiRef.current = { start, pause: pauseToggle };

    const spawnPattern = () => {
      const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
      const blockCount = g.speed > 32 && Math.random() < 0.55 ? 2 : 1;
      for (let i = 0; i < blockCount; i++) {
        spawnOb(Math.random() < 0.58 ? "wall" : "bar", lanes[i], -190);
      }
      for (let i = blockCount; i < 3; i++) {
        if (Math.random() < 0.75) {
          for (let k = 0; k < 3; k++) spawnOb("coin", lanes[i], -186 - k * 4);
        }
      }
    };

    /* ---------------- ana döngü ---------------- */
    const update = (dt: number) => {
      g.time += dt;
      g.frame++;

      if (g.phase === "playing") {
        if (g.dying > 0) {
          g.dying -= dt;
          g.speed = Math.max(0, g.speed - 45 * dt);
          if (g.dying <= 0) {
            const sc = score();
            if (sc > g.best) {
              g.best = sc;
              g.newBest = true;
              localStorage.setItem(BEST_KEY, String(sc));
            }
            chip.sfx("gameover");
            setPhase("over");
            setHud((h) => ({ ...h, best: g.best, newBest: g.newBest, score: sc }));
          }
        } else {
          g.speed = Math.min(60, g.speed + 0.4 * dt);
          g.spawnAcc += g.speed * dt;
          const gap = Math.max(17, 34 - g.speed * 0.26);
          if (g.spawnAcc >= gap) {
            g.spawnAcc = 0;
            spawnPattern();
          }
          const t = Math.floor(g.dist / 400);
          if (t > g.tier) {
            g.tier = t;
            chip.sfx("levelup");
            setFlash(`HIZ KADEMESİ ${t + 1}`);
            window.setTimeout(() => setFlash(""), 1300);
          }
        }
      } else if (g.phase === "menu") {
        g.speed += (12 - g.speed) * Math.min(1, dt * 2);
      } else if (g.phase === "over") {
        g.speed = Math.max(0, g.speed - 20 * dt);
      }

      g.dist += g.speed * dt;

      /* dünya akışı */
      gridTex.offset.y += (g.speed * dt) / 5;
      for (const b of buildings) {
        b.position.z += g.speed * dt;
        if (b.position.z > 18) {
          randBuilding(b, false);
        }
      }
      sun.scale.setScalar(1 + Math.sin(g.time * 1.4) * 0.015);

      /* oyuncu */
      const targetX = LANES[g.lane];
      g.x += (targetX - g.x) * Math.min(1, dt * 10);
      if (g.jumping) {
        g.vy -= 30 * dt;
        g.h += g.vy * dt;
        if (g.h <= 0) {
          g.h = 0;
          g.vy = 0;
          g.jumping = false;
        }
      }
      if (g.invuln > 0) g.invuln -= dt;
      ship.position.x = g.x;
      ship.position.y = 0.7 + g.h + Math.sin(g.time * 6) * 0.05;
      ship.rotation.z = THREE.MathUtils.clamp((targetX - g.x) * -0.3, -0.55, 0.55);
      ship.rotation.x = THREE.MathUtils.clamp(g.jumping ? -g.vy * 0.028 : 0, -0.4, 0.4);
      ship.visible = g.dying <= 0 && (g.invuln <= 0 || Math.floor(g.time * 14) % 2 === 0);
      engine.scale.setScalar(0.8 + Math.random() * 0.5);

      /* engeller */
      wallMat.emissiveIntensity = 0.7 + Math.sin(g.time * 6) * 0.25;
      for (let i = active.length - 1; i >= 0; i--) {
        const ob = active[i];
        ob.mesh.position.z += g.speed * dt;
        if (ob.type === "coin") {
          ob.mesh.rotation.y += 3.2 * dt;
          ob.mesh.position.y = 1.15 + Math.sin(g.time * 4 + ob.mesh.position.x) * 0.12;
        }
        const z = ob.mesh.position.z;
        if (z > 12) {
          release(ob);
          active.splice(i, 1);
          continue;
        }
        if (g.phase !== "playing" || g.dying > 0) continue;
        if (ob.lane !== g.lane) continue;
        if (ob.type === "coin") {
          if (Math.abs(z) < 2) {
            g.coins += 1;
            chip.sfx("eat");
            burst(ob.mesh.position.clone(), 0xffb300, 12, 6);
            release(ob);
            active.splice(i, 1);
          }
          continue;
        }
        if (g.invuln > 0) continue;
        if (Math.abs(z) < 1.5) {
          if (ob.type === "bar" && g.h > 0.7) continue;
          crash(ob);
        }
      }

      /* parçacıklar */
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.life -= dt;
        const attr = b.pts.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        for (let k = 0; k < arr.length; k += 3) {
          arr[k] += b.vel[k] * dt;
          arr[k + 1] += b.vel[k + 1] * dt;
          arr[k + 2] += b.vel[k + 2] * dt;
          b.vel[k + 1] -= 16 * dt;
        }
        attr.needsUpdate = true;
        (b.pts.material as THREE.PointsMaterial).opacity = Math.max(0, b.life / b.max);
        if (b.life <= 0) {
          scene.remove(b.pts);
          b.pts.geometry.dispose();
          (b.pts.material as THREE.Material).dispose();
          bursts.splice(i, 1);
        }
      }

      /* kamera */
      g.shake = Math.max(0, g.shake - 2.4 * dt);
      const sh = g.shake * g.shake;
      camera.position.x = g.x * 0.5 + (Math.random() - 0.5) * sh * 0.7;
      camera.position.y = 4.4 + g.h * 0.25 + (Math.random() - 0.5) * sh * 0.5;
      camera.lookAt(g.x * 0.6, 1.3, -14);
      camera.fov = Math.min(84, 68 + g.speed * 0.26);
      camera.updateProjectionMatrix();

      /* HUD senkronu */
      if (g.frame % 6 === 0) {
        setHud((h) =>
          h.score !== score() || h.coins !== g.coins || h.lives !== g.lives
            ? { ...h, score: score(), coins: g.coins, lives: g.lives, speed: g.speed }
            : { ...h, speed: g.speed },
        );
      }
    };

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (g.phase !== "paused") update(dt);
      renderer.render(scene, camera);
    };
    loop();

    /* ---------------- girişler ---------------- */
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      if (k === "arrowleft" || k === "a") moveLane(-1);
      else if (k === "arrowright" || k === "d") moveLane(1);
      else if (k === "arrowup" || k === "w" || k === " ") {
        if (g.phase === "playing") jump();
        else if (g.phase === "menu" || g.phase === "over") start();
      } else if (k === "p" || k === "escape") pauseToggle();
      else if (k === "enter" && (g.phase === "menu" || g.phase === "over")) start();
    };
    window.addEventListener("keydown", onKey);

    let tx = 0;
    let ty = 0;
    let tt = 0;
    const onDown = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      tt = performance.now();
    };
    const onUp = (e: PointerEvent) => {
      const dx = e.clientX - tx;
      const dy = e.clientY - ty;
      const dtms = performance.now() - tt;
      if (g.phase === "menu" || g.phase === "over") return;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
      else if (dy < -42) jump();
      else if (dtms < 220 && Math.abs(dx) < 12 && Math.abs(dy) < 12) jump();
    };
    mount.addEventListener("pointerdown", onDown);
    mount.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      mount.removeEventListener("pointerdown", onDown);
      mount.removeEventListener("pointerup", onUp);
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  const inGame = hud.phase === "playing" || hud.phase === "paused";

  return (
    <div className="panel rise flex flex-col">
      <div className="panel-bar">
        <span className="text-[8px] text-fuchsia-300">NEON3D.EXE</span>
        <span className="font-crt ml-2 text-[15px] text-slate-500">
          synthwave koşucusu • gerçek zamanlı <span className="text-cyan-300">3D</span>
        </span>
        <span className="font-crt ml-auto text-[15px] text-slate-500">
          rekor: <span className="text-amber-300">{hud.best}</span>
        </span>
      </div>

      <div ref={mountRef} className="relative h-[440px] w-full cursor-crosshair touch-none select-none sm:h-[540px]">
        {/* oyun HUD */}
        {inGame && (
          <>
            <div className="pointer-events-none absolute left-3 top-2 z-10">
              <div className="font-arcade text-[8px] text-cyan-300/80">SKOR</div>
              <div className="font-crt text-[38px] leading-none text-emerald-300 [text-shadow:0_0_14px_rgba(61,255,124,0.7),0_2px_0_#000]">
                {hud.score}
              </div>
              <div className="font-crt mt-1 flex items-center gap-1 text-[19px] text-amber-300 [text-shadow:0_2px_0_#000]">
                <CoinMini /> × {hud.coins}
              </div>
            </div>
            <div className="pointer-events-none absolute right-3 top-2 z-10 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <HeartSVG key={i} on={i < hud.lives} />
              ))}
            </div>
            <div className="pointer-events-none absolute bottom-2 left-3 z-10">
              <div className="font-crt text-[19px] text-fuchsia-300 [text-shadow:0_2px_0_#000]">
                {Math.round(hud.speed * 3.6)} km/s
              </div>
              <div className="meter mt-1 w-28">
                <div
                  className="meter-fill"
                  style={{
                    width: `${Math.min(100, (hud.speed / 60) * 100)}%`,
                    background: "repeating-linear-gradient(90deg,#ff2d78 0 6px,#a1154b 6px 12px)",
                    boxShadow: "0 0 10px rgba(255,45,120,0.55)",
                  }}
                />
              </div>
            </div>
            <div className="font-crt pointer-events-none absolute bottom-2 right-3 z-10 text-[16px] text-slate-400 [text-shadow:0_2px_0_#000]">
              P: duraklat
            </div>
          </>
        )}

        {/* hız kademesi flaşı */}
        {flash && (
          <div className="pointer-events-none absolute inset-x-0 top-1/4 z-10 text-center">
            <span className="pop font-arcade chroma text-[16px] text-amber-300">{flash}</span>
          </div>
        )}

        {/* menü */}
        {hud.phase === "menu" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0118]/70 px-4 text-center">
            <div className="pop">
              <div className="font-arcade chroma text-[24px] text-fuchsia-300 sm:text-[34px]">NEON KOŞUCU</div>
              <div className="font-crt mt-1 text-[20px] tracking-wide text-cyan-300">3D SYNTHWAVE RUNNER</div>
            </div>
            <div className="grid max-w-[440px] grid-cols-1 gap-2 text-left sm:grid-cols-2">
              <div className="border-2 border-[#2b3a55] bg-[#0d1322] p-3">
                <div className="font-arcade mb-2 text-[7px] text-emerald-300">KONTROLLER</div>
                <div className="font-crt flex flex-col gap-1.5 text-[17px] text-slate-300">
                  <span><span className="keycap mr-2">A / D</span> şerit değiştir</span>
                  <span><span className="keycap mr-2">BOŞLUK</span> zıpla</span>
                  <span><span className="keycap mr-2">P</span> duraklat</span>
                  <span className="text-slate-500">mobilde: kaydır / dokun</span>
                </div>
              </div>
              <div className="border-2 border-[#2b3a55] bg-[#0d1322] p-3">
                <div className="font-arcade mb-2 text-[7px] text-emerald-300">SAHADA</div>
                <div className="font-crt flex flex-col gap-1.5 text-[17px] text-slate-300">
                  <span className="flex items-center gap-2">
                    <i className="inline-block h-3 w-3 bg-[#ff2d78]" /> mor duvar — şerit değiştir
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="inline-block h-3 w-3 bg-[#28e0e8]" /> alçak engel — zıpla
                  </span>
                  <span className="flex items-center gap-2">
                    <i className="inline-block h-3 w-3 rotate-45 bg-[#ffb300]" /> coin — +25 puan
                  </span>
                </div>
              </div>
            </div>
            <button onClick={() => apiRef.current.start()} className="btn-buy w-56">
              ► BAŞLA <span className="opacity-70">(ENTER)</span>
            </button>
            <div className="font-crt text-[17px] text-slate-500">
              3 can • hız sürekli artar • rekor: <span className="text-amber-300">{hud.best}</span>
            </div>
          </div>
        )}

        {/* duraklatma */}
        {hud.phase === "paused" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0118]/70">
            <div className="font-arcade chroma blink text-[22px] text-cyan-300">DURAKLADI</div>
            <button onClick={() => apiRef.current.pause()} className="btn-buy w-52">
              DEVAM ET (P)
            </button>
          </div>
        )}

        {/* oyun sonu */}
        {hud.phase === "over" && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#0a0118]/75 px-4 text-center">
            <div className="pop font-arcade chroma text-[24px] text-red-400 sm:text-[30px]">OYUN BİTTİ</div>
            {hud.newBest && <div className="blink font-arcade text-[11px] text-amber-300">★ YENİ REKOR ★</div>}
            <div className="border-2 border-[#2b3a55] bg-[#0d1322] px-6 py-3">
              <div className="font-crt text-[22px] text-slate-400">SKOR</div>
              <div className="font-crt text-[52px] leading-none text-emerald-300 [text-shadow:0_0_16px_rgba(61,255,124,0.7)]">
                {hud.score}
              </div>
              <div className="font-crt mt-2 flex items-center justify-center gap-4 text-[19px]">
                <span className="flex items-center gap-1 text-amber-300">
                  <CoinMini /> {hud.coins}
                </span>
                <span className="text-slate-500">rekor {hud.best}</span>
              </div>
            </div>
            <button onClick={() => apiRef.current.start()} className="btn-buy w-56">
              TEKRAR OYNA (ENTER)
            </button>
          </div>
        )}

        {/* CRT camı */}
        <div className="scanlines crt-glass pointer-events-none absolute inset-0 z-30" />
      </div>
    </div>
  );
}
