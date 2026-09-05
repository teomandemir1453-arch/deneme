import { useState } from "react";
import type { ExtraIcon } from "../game/economy";
import { EXTRAS, LEVELS, ROI_DAYS, fmtMC, fmtUSD, toMC } from "../game/economy";

interface Props {
  balance: number;
  level: number;
  owned: string[];
  onBuyLevel: () => void;
  onBuyExtra: (id: string) => void;
}

function PixelIcon({ icon }: { icon: ExtraIcon }) {
  const paths: Record<ExtraIcon, React.ReactNode> = {
    rgb: <><rect x="1" y="7" width="14" height="2" /><rect x="3" y="4" width="2" height="2" /><rect x="7" y="10" width="2" height="2" /><rect x="11" y="4" width="2" height="2" /></>,
    mouse: <><rect x="5" y="2" width="6" height="12" /><rect x="7" y="4" width="2" height="3" /></>,
    psu: <><rect x="1" y="4" width="14" height="8" /><rect x="3" y="6" width="4" height="4" /><rect x="9" y="6" width="4" height="1" /><rect x="9" y="9" width="4" height="1" /></>,
    ssd: <><rect x="2" y="4" width="12" height="8" /><rect x="4" y="6" width="3" height="4" /><rect x="9" y="6" width="3" height="2" /></>,
    cooling: <><rect x="2" y="2" width="12" height="12" /><rect x="7" y="4" width="2" height="8" /><rect x="4" y="7" width="8" height="2" /></>,
    keyboard: <><rect x="1" y="5" width="14" height="6" /><rect x="3" y="7" width="2" height="2" /><rect x="6" y="7" width="4" height="2" /><rect x="11" y="7" width="2" height="2" /></>,
    ram: <><rect x="1" y="5" width="14" height="6" /><rect x="3" y="7" width="2" height="2" /><rect x="6" y="7" width="2" height="2" /><rect x="9" y="7" width="2" height="2" /></>,
    chair: <><rect x="5" y="2" width="6" height="7" /><rect x="5" y="9" width="7" height="2" /><rect x="7" y="11" width="2" height="3" /><rect x="4" y="14" width="8" height="1" /></>,
    gpu: <><rect x="1" y="4" width="14" height="7" /><rect x="4" y="6" width="3" height="3" /><rect x="9" y="6" width="3" height="3" /><rect x="3" y="11" width="2" height="2" /><rect x="11" y="11" width="2" height="2" /></>,
    monitor: <><rect x="2" y="3" width="12" height="8" /><rect x="7" y="11" width="2" height="2" /><rect x="4" y="13" width="8" height="1" /><rect x="4" y="5" width="8" height="4" /></>,
  };
  return (
    <svg viewBox="0 0 16 16" className="h-6 w-6" fill="currentColor" shapeRendering="crispEdges" aria-hidden>
      {paths[icon]}
    </svg>
  );
}

export default function Shop({ balance, level, owned, onBuyLevel, onBuyExtra }: Props) {
  const [tab, setTab] = useState<"level" | "extra">("level");
  const [shakeId, setShakeId] = useState<string | null>(null);
  const next = level < 10 ? LEVELS[level + 1] : null;
  const nextCost = next ? toMC(next.priceUSD) : 0;
  const curIncome = LEVELS[level].dailyUSD;
  const progress = next ? Math.min(100, (balance / nextCost) * 100) : 100;

  const fail = (id: string) => {
    setShakeId(id);
    window.setTimeout(() => setShakeId(null), 450);
  };

  return (
    <div className="panel flex h-full flex-col">
      <div className="panel-bar flex items-center gap-2">
        <span className="text-[8px] text-amber-300">MAĞAZA.EXE</span>
        <div className="ml-auto flex gap-1">
          {(["level", "extra"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`font-arcade border px-2 py-1.5 text-[7px] transition-all ${
                tab === t
                  ? "border-emerald-300 bg-emerald-300 text-black"
                  : "border-[#2b3a55] bg-[#101828] text-slate-400 hover:border-emerald-300/60 hover:text-emerald-200"
              }`}
            >
              {t === "level" ? "PC SEVİYESİ" : "EKSTRA PARÇA"}
            </button>
          ))}
        </div>
      </div>

      {tab === "level" ? (
        <div className="scroll-thin flex-1 overflow-y-auto p-3">
          {next ? (
            <div className={`border-2 border-[#2b3a55] bg-[#101828] p-3 ${shakeId === "lvl" ? "shake" : ""}`}>
              <div className="flex items-baseline justify-between">
                <span className="font-arcade text-[10px] text-cyan-300">SONRAKİ: {next.name}</span>
                <span className="font-crt text-lg text-slate-400">Lv.{level} → Lv.{level + 1}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 font-crt text-lg leading-tight">
                <div>
                  <div className="text-[13px] uppercase tracking-wide text-slate-500">Gelir</div>
                  <div className="text-emerald-300">${curIncome}/g</div>
                  <div className="text-emerald-200">→ ${next.dailyUSD}/g</div>
                </div>
                <div>
                  <div className="text-[13px] uppercase tracking-wide text-slate-500">Fiyat</div>
                  <div className="text-amber-300">{fmtUSD(next.priceUSD)}</div>
                  <div className="text-amber-200/80">{fmtMC(nextCost)} µC</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between font-crt text-[15px] text-slate-400">
                  <span>Birikme</span>
                  <span>%{Math.floor(progress)}</span>
                </div>
                <div className="meter">
                  <div className="meter-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <button
                onClick={() => {
                  if (balance < nextCost) fail("lvl");
                  onBuyLevel();
                }}
                className={`btn-buy mt-3 ${balance >= nextCost ? "" : "btn-buy-off"}`}
              >
                {balance >= nextCost ? "YÜKSELT" : "YETERSİZ µC"} · {fmtMC(nextCost)} µC
              </button>
            </div>
          ) : (
            <div className="pop border-2 border-amber-300 bg-amber-300/10 p-4 text-center">
              <div className="font-arcade text-[11px] text-amber-300">MAKS SEVİYE!</div>
              <p className="font-crt mt-2 text-lg text-amber-100/80">
                Kurulum efsane durumda. Lv.10 — günlük ${LEVELS[10].dailyUSD} madencilik.
              </p>
            </div>
          )}
          <div className="mt-3 border-2 border-[#2b3a55] bg-[#0d1322]">
            <div className="panel-bar">
              <span className="text-[8px] text-cyan-300">YOL HARİTASI</span>
              <span className="ml-auto font-crt text-[14px] text-slate-500">ROI ≈ {ROI_DAYS} gün</span>
            </div>
            <table className="w-full font-crt text-[16px] leading-snug">
              <thead>
                <tr className="text-left text-[13px] uppercase text-slate-500">
                  <th className="px-2 py-1 font-normal">Paket</th>
                  <th className="px-1 py-1 font-normal">Fiyat</th>
                  <th className="px-1 py-1 font-normal">Gelir/g</th>
                  <th className="px-2 py-1 text-right font-normal">ROI</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((l, i) => {
                  const isCur = i === level;
                  const done = i < level;
                  const roi = i === 0 ? "—" : `${Math.round(l.priceUSD / (l.dailyUSD - LEVELS[i - 1].dailyUSD))}g`;
                  return (
                    <tr
                      key={l.lv}
                      className={
                        isCur
                          ? "bg-emerald-300/15 text-emerald-200"
                          : done
                            ? "text-slate-600"
                            : "text-slate-300"
                      }
                    >
                      <td className="px-2 py-0.5">
                        {done ? "✓ " : isCur ? "► " : ""}
                        {l.name}
                      </td>
                      <td className="px-1 py-0.5 text-amber-200/90">{l.priceUSD === 0 ? "—" : fmtUSD(l.priceUSD)}</td>
                      <td className="px-1 py-0.5 text-emerald-300/90">${l.dailyUSD}</td>
                      <td className="px-2 py-0.5 text-right text-fuchsia-300/90">{roi}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="scroll-thin grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3">
          {EXTRAS.map((e) => {
            const has = owned.includes(e.id);
            const cost = toMC(e.priceUSD);
            const can = balance >= cost;
            return (
              <button
                key={e.id}
                onClick={() => {
                  if (!has && !can) fail(e.id);
                  onBuyExtra(e.id);
                }}
                disabled={has}
                className={`group border-2 p-2.5 text-left transition-all ${
                  has
                    ? "border-emerald-400/70 bg-emerald-400/10"
                    : can
                      ? "border-amber-300/80 bg-[#131a2c] hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[3px_3px_0_#000]"
                      : "border-[#2b3a55] bg-[#101625] opacity-80"
                } ${shakeId === e.id ? "shake" : ""}`}
              >
                <div className={`flex items-center gap-2 ${has ? "text-emerald-300" : can ? "text-amber-300" : "text-slate-500"}`}>
                  <PixelIcon icon={e.icon} />
                  {has && <span className="font-arcade ml-auto text-[7px] text-emerald-300">TAKILI</span>}
                </div>
                <div className="font-arcade mt-1.5 text-[8px] leading-relaxed text-slate-200">{e.name}</div>
                <div className="font-crt text-[15px] leading-tight text-slate-500">{e.desc}</div>
                <div className="mt-1.5 flex items-end justify-between font-crt">
                  <span className={has ? "text-emerald-300" : "text-amber-300"}>
                    {has ? "✓ aktif" : `${fmtMC(cost)} µC`}
                  </span>
                  <span className="text-[14px] text-emerald-300/80">+{fmtMC(toMC(e.dailyUSD))} µC/g</span>
                </div>
                {!has && (
                  <div className="mt-1 border border-fuchsia-400/40 bg-fuchsia-400/10 px-1 py-0.5 text-center font-crt text-[13px] text-fuchsia-300">
                    ROI {ROI_DAYS} GÜN
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="panel-bar border-t-2 border-[#2b3a55]">
        <span className="font-crt text-[15px] text-slate-500">
          Kasa: <span className="text-emerald-300">{fmtMC(balance)} µC</span>
        </span>
        <span className="ml-auto font-crt text-[15px] text-slate-500">1000 µC = 1 USDT</span>
      </div>
    </div>
  );
}
