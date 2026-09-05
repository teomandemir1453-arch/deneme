import { useState } from "react";
import SnakeCabinet from "./components/SnakeCabinet";

function Vu({ playing, flip = false }: { playing: boolean; flip?: boolean }) {
  return (
    <div className={`vu ${playing ? "" : "vu-paused"} ${flip ? "-scale-x-100" : ""}`} aria-hidden>
      <i /><i /><i /><i /><i />
    </div>
  );
}

function ArcadeSign({ musicOn }: { musicOn: boolean }) {
  return (
    <div className="rise relative mb-8 flex items-center gap-4 sm:mb-10 sm:gap-7" style={{ animationDelay: "0.05s" }}>
      <Vu playing={musicOn} />
      <div className="relative border-2 border-[#2b343c] bg-[#0c1014] px-5 py-3 shadow-[0_0_34px_rgba(40,224,232,0.12),inset_0_0_20px_rgba(0,0,0,0.85)] sm:px-8">
        <div className="absolute inset-x-3 top-1.5 h-px bg-[#28e0e8]/25" />
        <h1
          className="neon-flicker font-arcade text-center text-xs leading-relaxed text-[#28e0e8] sm:text-base"
          style={{ textShadow: "0 0 8px rgba(40,224,232,0.9), 0 0 26px rgba(40,224,232,0.4)" }}
        >
          ARCADE{" "}
          <span
            className="text-[#ff2d78]"
            style={{ textShadow: "0 0 8px rgba(255,45,120,0.9), 0 0 26px rgba(255,45,120,0.4)" }}
          >
            SALONU
          </span>
        </h1>
        <p className="font-crt mt-1 text-center text-lg leading-none text-[#ffb300]/90">— 24 SAAT AÇIK —</p>
        <div className="absolute inset-x-3 bottom-1.5 h-px bg-[#ff2d78]/25" />
      </div>
      <Vu playing={musicOn} flip />
    </div>
  );
}

export default function App() {
  const [musicOn, setMusicOn] = useState(true);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07090c] text-[#cfe8d8]">
      {/* ortam katmanları */}
      <div className="stars pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="stars2 pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-80"
        style={{ background: "radial-gradient(60% 100% at 50% 100%, rgba(40,224,232,0.09), transparent 70%)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{ background: "radial-gradient(50% 100% at 50% 0%, rgba(255,45,120,0.07), transparent 70%)" }}
        aria-hidden
      />

      <main className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 pb-16 pt-8 sm:pt-12">
        <ArcadeSign musicOn={musicOn} />

        <SnakeCabinet onMusicChange={setMusicOn} />

        <footer className="rise mt-9 w-full max-w-xl" style={{ animationDelay: "0.3s" }}>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <span className="flex items-center gap-2">
              <kbd className="keycap">← ↑ ↓ →</kbd>
              <span className="font-crt text-lg text-[#7fa58e]">Hareket</span>
            </span>
            <span className="flex items-center gap-2">
              <kbd className="keycap">ENTER</kbd>
              <span className="font-crt text-lg text-[#7fa58e]">Başlat</span>
            </span>
            <span className="flex items-center gap-2">
              <kbd className="keycap">P</kbd>
              <span className="font-crt text-lg text-[#7fa58e]">Duraklat</span>
            </span>
            <span className="flex items-center gap-2">
              <kbd className="keycap">M</kbd>
              <span className="font-crt text-lg text-[#7fa58e]">Müzik</span>
            </span>
          </div>
          <p className="font-crt mt-6 text-center text-lg leading-snug text-[#5c7263]">
            © 1984 PİKSELSOFT — Bu makine jetonla çalışır. Yüksek skorunuz hafıza çipinde saklanır.
            <br />
            <span className="text-[#7fa58e]">Bonus yıldız 50 puan • Her 60 puanda hız artar • 3 can</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
