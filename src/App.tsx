import { useState } from "react";
import HUD from "./components/HUD";
import RoomCanvas from "./components/RoomCanvas";
import Shop from "./components/Shop";
import { fmtMC } from "./game/economy";
import { useGame } from "./game/useGame";

function SoundIcon({ on, music }: { on: boolean; music?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" shapeRendering="crispEdges" aria-hidden>
      <rect x="1" y="6" width="3" height="4" />
      <rect x="4" y="4" width="3" height="8" />
      <rect x="7" y="2" width="2" height="12" />
      {music ? (
        <>
          <rect x="11" y="3" width="2" height="8" />
          <rect x="10" y="10" width="3" height="3" />
        </>
      ) : on ? (
        <>
          <rect x="11" y="5" width="2" height="2" />
          <rect x="13" y="3" width="2" height="2" />
          <rect x="13" y="7" width="2" height="2" />
        </>
      ) : (
        <rect x="10" y="7" width="5" height="2" />
      )}
    </svg>
  );
}

function CoinSVG() {
  return (
    <svg viewBox="0 0 16 16" className="h-7 w-7" shapeRendering="crispEdges" aria-hidden>
      <rect x="4" y="2" width="8" height="12" fill="#ffb300" />
      <rect x="2" y="4" width="12" height="8" fill="#ffb300" />
      <rect x="5" y="3" width="6" height="10" fill="#ffd24a" />
      <rect x="6" y="5" width="2" height="6" fill="#8a5a00" />
      <rect x="8" y="4" width="1" height="2" fill="#8a5a00" />
      <rect x="8" y="10" width="1" height="2" fill="#8a5a00" />
    </svg>
  );
}

export default function App() {
  const g = useGame();
  const [armReset, setArmReset] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#07090c] text-slate-200">
      {/* ambiyans */}
      <div className="stars pointer-events-none fixed inset-0" />
      <div className="stars2 pointer-events-none fixed inset-0" />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(900px 500px at 15% 0%, rgba(255,45,120,0.09), transparent 60%), radial-gradient(900px 600px at 90% 100%, rgba(40,224,232,0.08), transparent 60%), radial-gradient(700px 400px at 60% 30%, rgba(61,255,124,0.05), transparent 60%)",
        }}
      />
      <div className="crt-flicker scanlines pointer-events-none fixed inset-0 z-50 opacity-40" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1200px] flex-col gap-3 px-3 py-4 sm:px-5">
        {/* başlık */}
        <header className="rise flex flex-wrap items-center gap-3">
          <CoinSVG />
          <div>
            <h1 className="font-arcade chroma text-[19px] text-emerald-300 sm:text-[24px]">RETRO ODA</h1>
            <p className="font-crt neon-flicker text-[17px] leading-tight text-cyan-300/80">
              micro coin madencisi — 1000 µC = 1 USDT
              <span className="blink text-emerald-300">▌</span>
            </p>
          </div>

          <div className="vu ml-2 mt-3 hidden sm:flex" aria-hidden>
            <i /><i /><i /><i /><i />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={g.toggleMusic}
              title="Müzik aç/kapat"
              className={`border-2 p-2 transition-colors ${
                g.s.music
                  ? "border-fuchsia-400 bg-fuchsia-400/15 text-fuchsia-300 shadow-[0_0_12px_rgba(255,45,120,0.4)]"
                  : "border-[#2b3a55] text-slate-500 hover:border-fuchsia-400/60"
              }`}
            >
              <SoundIcon on={g.s.music} music />
            </button>
            <button
              onClick={g.toggleSfx}
              title="Ses efektleri aç/kapat"
              className={`border-2 p-2 transition-colors ${
                g.s.sfx
                  ? "border-cyan-400 bg-cyan-400/15 text-cyan-300 shadow-[0_0_12px_rgba(40,224,232,0.4)]"
                  : "border-[#2b3a55] text-slate-500 hover:border-cyan-400/60"
              }`}
            >
              <SoundIcon on={g.s.sfx} />
            </button>
            <div className="lights hidden h-[10px] w-24 md:block" aria-hidden />
          </div>
        </header>

        {/* istatistikler */}
        <HUD
          balance={g.s.balance}
          incomeMC={g.incomeMC}
          incomeUSD={g.incomeUSD}
          level={g.s.level}
          days={g.s.days}
          speed={g.s.speed}
          speeds={g.speeds}
          totalSpent={g.s.totalSpent}
          totalEarned={g.s.totalEarned}
          onSpeed={g.setSpeed}
        />

        {/* oda + mağaza */}
        <main className="grid flex-1 grid-cols-1 gap-3 lg:grid-cols-[1.55fr_1fr]">
          <div className="panel rise flex flex-col" style={{ animationDelay: "0.08s" }}>
            <div className="panel-bar">
              <span className="text-[8px] text-emerald-300">ODA.CANLI</span>
              <span className="font-crt ml-2 text-[15px] text-slate-500">
                oyuncu: <span className="text-cyan-300">sen</span> • kedi: <span className="text-amber-300">boncuk</span>
              </span>
              <span className="font-crt ml-auto hidden text-[15px] text-slate-500 sm:block">
                tıklama: <span className="text-emerald-300">+{fmtMC(g.clickMC)} µC</span>
              </span>
            </div>
            <div className="crt-glass relative">
              <RoomCanvas
                level={g.s.level}
                owned={g.s.owned}
                clickMC={g.clickMC}
                celebrate={g.celebrate}
                onBoost={g.boost}
              />
              <div className="font-crt pointer-events-none absolute bottom-2 left-3 text-[16px] text-emerald-300/90 [text-shadow:0_2px_0_#000]">
                ► ekrana tıkla, {fmtMC(g.clickMC)} µC kap
              </div>
              <div className="font-crt pointer-events-none absolute bottom-2 right-3 text-[16px] text-fuchsia-300/90 [text-shadow:0_2px_0_#000]">
                PC seviyesi: Lv.{g.s.level}
              </div>
            </div>
            <div className="panel-bar border-t-2 border-[#2b3a55]">
              <span className="font-crt text-[15px] text-slate-500">
                {g.s.owned.length}/10 parça takılı
              </span>
              <span className="font-crt ml-auto text-[15px] text-slate-500">
                tıklama: <span className="text-emerald-300">{g.s.clicks}</span>
              </span>
            </div>
          </div>

          <div className="rise min-h-[440px] lg:min-h-0" style={{ animationDelay: "0.16s" }}>
            <Shop
              balance={g.s.balance}
              level={g.s.level}
              owned={g.s.owned}
              onBuyLevel={g.buyLevel}
              onBuyExtra={g.buyExtra}
            />
          </div>
        </main>

        {/* alt şerit */}
        <footer className="rise panel flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" style={{ animationDelay: "0.24s" }}>
          <p className="font-crt text-[17px] leading-snug text-slate-400">
            <span className="text-emerald-300">NASIL OYNANIR:</span> odadaki ekrana tıkla → µC biriktir →
            PC seviyeni ve parçaları yükselt → bilgisayarın senin için <span className="text-amber-300">pasif µC</span> kazsın.
            Her yatırım <span className="text-fuchsia-300">≈200 günde</span> geri döner, sonrası ömür boyu kâr.
          </p>
          <button
            onClick={() => {
              if (armReset) {
                g.reset();
                setArmReset(false);
              } else {
                setArmReset(true);
                window.setTimeout(() => setArmReset(false), 2500);
              }
            }}
            className={`font-arcade ml-auto border-2 px-3 py-2 text-[7px] transition-colors ${
              armReset
                ? "border-red-400 bg-red-400/20 text-red-300"
                : "border-[#2b3a55] text-slate-500 hover:border-red-400/60 hover:text-red-300"
            }`}
          >
            {armReset ? "EMİN MİSİN? TEKRAR BAS" : "SIFIRLA"}
          </button>
        </footer>
      </div>

      {/* bildirimler */}
      <div className="pointer-events-none fixed right-3 top-3 z-[60] flex w-[280px] flex-col gap-2">
        {g.toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${
              t.kind === "gold"
                ? "border-amber-300 text-amber-200"
                : t.kind === "warn"
                  ? "border-red-400 text-red-300"
                  : "border-emerald-300 text-emerald-200"
            }`}
          >
            {t.txt}
          </div>
        ))}
      </div>
    </div>
  );
}
