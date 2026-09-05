import { useCallback, useEffect, useRef, useState } from "react";
import { chip } from "../audio/engine";
import {
  EXTRAS,
  LEVELS,
  SPEEDS,
  clickValueMC,
  fmtMC,
  incomePerDayUSD,
  toMC,
} from "./economy";

const SAVE_KEY = "retro-oda-v1";

export interface Toast {
  id: number;
  txt: string;
  kind: "ok" | "warn" | "gold";
}

export interface GameState {
  balance: number; // µC
  totalEarned: number;
  totalSpent: number;
  level: number;
  owned: string[];
  days: number; // sanal geçen gün
  clicks: number;
  speed: number;
  music: boolean;
  sfx: boolean;
  lastTs: number;
}

const fresh = (): GameState => ({
  balance: 0,
  totalEarned: 0,
  totalSpent: 0,
  level: 0,
  owned: [],
  days: 0,
  clicks: 0,
  speed: 1440,
  music: true,
  sfx: true,
  lastTs: Date.now(),
});

function load(): { s: GameState; offlineMC: number } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { s: fresh(), offlineMC: 0 };
    const p = JSON.parse(raw) as Partial<GameState>;
    const s: GameState = { ...fresh(), ...p };
    s.level = Math.min(10, Math.max(0, s.level));
    s.owned = (s.owned ?? []).filter((id) => EXTRAS.some((e) => e.id === id));
    const elapsedDays = Math.min(3, Math.max(0, (Date.now() - (s.lastTs ?? Date.now())) / 86_400_000));
    const offlineMC = incomePerDayUSD(s.level, s.owned) * 1000 * elapsedDays;
    s.balance += offlineMC;
    s.totalEarned += offlineMC;
    return { s, offlineMC };
  } catch {
    return { s: fresh(), offlineMC: 0 };
  }
}

let toastId = 1;

export function useGame() {
  const initial = useRef(load());
  const [s, setS] = useState<GameState>(initial.current.s);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [celebrate, setCelebrate] = useState(0);
  const sRef = useRef(s);
  sRef.current = s;
  const musicStarted = useRef(false);

  const incomeUSD = incomePerDayUSD(s.level, s.owned);
  const incomeMC = incomeUSD * 1000;
  const clickMC = clickValueMC(incomeMC);
  const next = s.level < 10 ? LEVELS[s.level + 1] : null;

  const pushToast = useCallback((txt: string, kind: Toast["kind"] = "ok") => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-3), { id, txt, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const ensureMusic = useCallback(() => {
    chip.ensure();
    if (!musicStarted.current) {
      musicStarted.current = true;
      if (sRef.current.music) chip.startMusic();
    }
  }, []);

  /* çevrimdışı kazanç bildirimi */
  useEffect(() => {
    const off = initial.current.offlineMC;
    if (off >= 1) {
      pushToast(`Yokken ${fmtMC(off)} µC kazandın!`, "gold");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ana döngü: 100ms'de bir gelir işler */
  useEffect(() => {
    const iv = window.setInterval(() => {
      setS((prev) => {
        const inc = incomePerDayUSD(prev.level, prev.owned) * 1000;
        const dDays = (0.1 * prev.speed) / 86400;
        const gain = inc * dDays;
        return {
          ...prev,
          balance: prev.balance + gain,
          totalEarned: prev.totalEarned + gain,
          days: prev.days + dDays,
          lastTs: Date.now(),
        };
      });
    }, 100);
    return () => window.clearInterval(iv);
  }, []);

  /* para biriktikçe kasa para parçacığı damlatır */
  useEffect(() => {
    if (incomeMC <= 0) return;
    const iv = window.setInterval(() => {
      window.dispatchEvent(new CustomEvent("retro-oda-coin"));
    }, Math.max(400, 2400 - s.level * 200));
    return () => window.clearInterval(iv);
  }, [incomeMC, s.level]);

  /* kayıt */
  useEffect(() => {
    const iv = window.setInterval(() => {
      localStorage.setItem(SAVE_KEY, JSON.stringify(sRef.current));
    }, 2000);
    const onHide = () => localStorage.setItem(SAVE_KEY, JSON.stringify(sRef.current));
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);

  /* ilk etkileşimde müzik başlar */
  useEffect(() => {
    const kick = () => ensureMusic();
    window.addEventListener("pointerdown", kick, { once: true });
    window.addEventListener("keydown", kick, { once: true });
    return () => {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
    };
  }, [ensureMusic]);

  const boost = useCallback(() => {
    ensureMusic();
    const cv = clickValueMC(incomePerDayUSD(sRef.current.level, sRef.current.owned) * 1000);
    setS((p) => ({ ...p, balance: p.balance + cv, totalEarned: p.totalEarned + cv, clicks: p.clicks + 1 }));
    chip.sfx("eat");
  }, [ensureMusic]);

  const buyLevel = useCallback(() => {
    const cur = sRef.current;
    if (cur.level >= 10) return;
    const cost = toMC(LEVELS[cur.level + 1].priceUSD);
    if (cur.balance < cost) {
      chip.sfx("deny");
      pushToast("Yetersiz µC! Madenciliğe devam.", "warn");
      return;
    }
    ensureMusic();
    setS((p) => ({ ...p, balance: p.balance - cost, totalSpent: p.totalSpent + cost, level: p.level + 1 }));
    chip.sfx("levelup");
    setCelebrate((c) => c + 1);
    pushToast(`PC Lv.${cur.level + 1} oldu! Günlük gelir arttı.`, "gold");
  }, [ensureMusic, pushToast]);

  const buyExtra = useCallback(
    (id: string) => {
      const cur = sRef.current;
      const def = EXTRAS.find((e) => e.id === id);
      if (!def || cur.owned.includes(id)) return;
      const cost = toMC(def.priceUSD);
      if (cur.balance < cost) {
        chip.sfx("deny");
        pushToast("Yetersiz µC! Biraz daha biriktir.", "warn");
        return;
      }
      ensureMusic();
      setS((p) => ({
        ...p,
        balance: p.balance - cost,
        totalSpent: p.totalSpent + cost,
        owned: [...p.owned, id],
      }));
      chip.sfx("bonus");
      setCelebrate((c) => c + 1);
      pushToast(`${def.name} takıldı! +${fmtMC(toMC(def.dailyUSD))} µC/gün`, "ok");
    },
    [ensureMusic, pushToast],
  );

  const setSpeed = useCallback((v: number) => {
    ensureMusic();
    chip.sfx("coin");
    setS((p) => ({ ...p, speed: v }));
  }, [ensureMusic]);

  const toggleMusic = useCallback(() => {
    const on = !sRef.current.music;
    chip.setMusicEnabled(on);
    if (on) chip.startMusic();
    else chip.stopMusic();
    setS((p) => ({ ...p, music: on }));
  }, []);

  const toggleSfx = useCallback(() => {
    const on = !sRef.current.sfx;
    chip.setSfxEnabled(on);
    setS((p) => ({ ...p, sfx: on }));
    if (on) chip.sfx("coin");
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(SAVE_KEY);
    setS(fresh());
    chip.sfx("pause");
    pushToast("Oda sıfırlandı. Yeni başlangıç!", "warn");
  }, [pushToast]);

  return {
    s,
    incomeUSD,
    incomeMC,
    clickMC,
    next,
    toasts,
    celebrate,
    speeds: SPEEDS,
    boost,
    buyLevel,
    buyExtra,
    setSpeed,
    toggleMusic,
    toggleSfx,
    reset,
  };
}
