import { LEVELS, fmtMC, fmtUSD } from "../game/economy";

interface Props {
  balance: number;
  incomeMC: number;
  incomeUSD: number;
  level: number;
  days: number;
  speed: number;
  speeds: readonly { v: number; label: string }[];
  totalSpent: number;
  totalEarned: number;
  onSpeed: (v: number) => void;
}

function Chip({
  label,
  children,
  accent,
}: {
  label: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="panel px-3 py-2">
      <div className="font-arcade flex items-center gap-2 text-[7px] uppercase tracking-wider text-slate-500">
        <span className="inline-block h-2 w-2" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function HUD(p: Props) {
  const nextLv = p.level < 10 ? LEVELS[p.level + 1] : null;
  const roiPct = p.totalSpent > 0 ? Math.min(100, (p.totalEarned / p.totalSpent) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Chip label="Kasa (µC)" accent="#3dff7c">
        <div className="font-crt text-[26px] leading-none text-emerald-300 sm:text-[30px]">
          {fmtMC(p.balance)} <span className="text-[18px] text-emerald-500">µC</span>
        </div>
        <div className="font-crt text-[16px] text-slate-500">≈ {fmtUSD(p.balance / 1000)} USDT</div>
      </Chip>

      <Chip label="Günlük Gelir" accent="#ffb300">
        <div className="font-crt text-[26px] leading-none text-amber-300 sm:text-[30px]">
          {fmtMC(p.incomeMC)} <span className="text-[18px] text-amber-500">µC/g</span>
        </div>
        <div className="font-crt text-[16px] text-slate-500">≈ {fmtUSD(p.incomeUSD)}/gün</div>
      </Chip>

      <Chip label={`PC Seviyesi — ${p.level}/10`} accent="#28e0e8">
        <div className="flex items-center gap-2">
          <div className="meter flex-1">
            <div
              className="meter-fill"
              style={{
                width: `${nextLv ? Math.min(100, (p.balance / (nextLv.priceUSD * 1000)) * 100) : 100}%`,
                background: "repeating-linear-gradient(90deg,#28e0e8 0 6px,#1ba8b0 6px 12px)",
                boxShadow: "0 0 10px rgba(40,224,232,0.5)",
              }}
            />
          </div>
          <span className="font-crt text-[18px] leading-none text-cyan-300">
            {p.totalSpent > 0 && roiPct >= 100 ? "KÂRDA!" : `ROI %${Math.floor(roiPct)}`}
          </span>
        </div>
        <div className="font-crt mt-0.5 text-[15px] text-slate-500">
          {p.totalSpent > 0
            ? `Yatırım ${fmtUSD(p.totalSpent / 1000)} • Kazanç ${fmtUSD(p.totalEarned / 1000)}`
            : "İlk yükseltmeni al, ROI sayacı başlasın"}
        </div>
      </Chip>

      <Chip label={`Gün ${Math.floor(p.days)} • Hız`} accent="#ff2d78">
        <div className="flex flex-wrap gap-1">
          {p.speeds.map((sp) => (
            <button
              key={sp.v}
              onClick={() => p.onSpeed(sp.v)}
              className={`font-arcade border px-2 py-1 text-[7px] transition-colors ${
                p.speed === sp.v
                  ? "border-fuchsia-400 bg-fuchsia-400 text-black"
                  : "border-[#2b3a55] bg-[#101828] text-slate-400 hover:border-fuchsia-400/70 hover:text-fuchsia-200"
              }`}
            >
              {sp.label}
            </button>
          ))}
        </div>
        <div className="font-crt mt-1 text-[15px] text-slate-500">1000 µC = 1 USDT • ROI ≈ 200 gün</div>
      </Chip>
    </div>
  );
}
