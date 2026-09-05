/* Micro coin ekonomisi — 1000 µC = 1 USDT, her yatırım ~200 günde geri döner. */

export const MC_PER_USD = 1000;
export const ROI_DAYS = 200;

export interface LevelDef {
  lv: number;
  name: string;
  priceUSD: number; // bir sonraki seviyeye geçiş ücreti (Lv.0 için 0)
  dailyUSD: number; // bu seviyenin günlük geliri
}

/* Kullanıcının verdiği tablo */
export const LEVELS: LevelDef[] = [
  { lv: 0, name: "Başlangıç", priceUSD: 0, dailyUSD: 0.04 },
  { lv: 1, name: "Lv.1 Paket", priceUSD: 10, dailyUSD: 0.08 },
  { lv: 2, name: "Lv.2 Paket", priceUSD: 20, dailyUSD: 0.16 },
  { lv: 3, name: "Lv.3 Paket", priceUSD: 50, dailyUSD: 0.4 },
  { lv: 4, name: "Lv.4 Paket", priceUSD: 125, dailyUSD: 1.0 },
  { lv: 5, name: "Lv.5 Paket", priceUSD: 315, dailyUSD: 2.52 },
  { lv: 6, name: "Lv.6 Paket", priceUSD: 790, dailyUSD: 6.32 },
  { lv: 7, name: "Lv.7 Paket", priceUSD: 1975, dailyUSD: 15.8 },
  { lv: 8, name: "Lv.8 Paket", priceUSD: 4940, dailyUSD: 39.52 },
  { lv: 9, name: "Lv.9 Paket", priceUSD: 12350, dailyUSD: 98.8 },
  { lv: 10, name: "Lv.10 Paket", priceUSD: 30875, dailyUSD: 247.0 },
];

export type ExtraIcon =
  | "rgb"
  | "mouse"
  | "psu"
  | "ssd"
  | "cooling"
  | "keyboard"
  | "ram"
  | "chair"
  | "gpu"
  | "monitor";

export interface ExtraDef {
  id: string;
  name: string;
  desc: string;
  priceUSD: number;
  dailyUSD: number; // = price / 200  → ROI 200 gün
  icon: ExtraIcon;
}

export const EXTRAS: ExtraDef[] = [
  { id: "rgb", name: "RGB LED Şerit", desc: "Oda neonla parlar", priceUSD: 15, dailyUSD: 0.075, icon: "rgb" },
  { id: "mouse", name: "Gaming Mouse", desc: "16000 DPI sensör", priceUSD: 18, dailyUSD: 0.09, icon: "mouse" },
  { id: "psu", name: "850W Güç Kaynağı", desc: "Gold sertifikalı", priceUSD: 20, dailyUSD: 0.1, icon: "psu" },
  { id: "ssd", name: "NVMe SSD 1TB", desc: "7000MB/s okuma", priceUSD: 25, dailyUSD: 0.125, icon: "ssd" },
  { id: "cooling", name: "Sıvı Soğutma", desc: "240mm radyatör", priceUSD: 30, dailyUSD: 0.15, icon: "cooling" },
  { id: "keyboard", name: "Mekanik Klavye", desc: "Hot-swap switch", priceUSD: 40, dailyUSD: 0.2, icon: "keyboard" },
  { id: "ram", name: "32GB RGB RAM", desc: "6000MHz CL30", priceUSD: 45, dailyUSD: 0.225, icon: "ram" },
  { id: "chair", name: "Oyuncu Koltuğu", desc: "Bel destekli", priceUSD: 55, dailyUSD: 0.275, icon: "chair" },
  { id: "gpu", name: "RTX Ekran Kartı", desc: "24GB VRAM", priceUSD: 60, dailyUSD: 0.3, icon: "gpu" },
  { id: "monitor", name: "240Hz Monitör", desc: "1ms IPS panel", priceUSD: 80, dailyUSD: 0.4, icon: "monitor" },
];

export const toMC = (usd: number): number => Math.round(usd * MC_PER_USD);

export function incomePerDayUSD(level: number, owned: readonly string[]): number {
  const base = LEVELS[level]?.dailyUSD ?? 0;
  const extra = EXTRAS.filter((e) => owned.includes(e.id)).reduce((a, e) => a + e.dailyUSD, 0);
  return base + extra;
}

/* Aktif tıklama geliri: günlük gelirin %5'i, en az 2 µC */
export function clickValueMC(incomeDailyMC: number): number {
  return Math.max(2, Math.round(incomeDailyMC * 0.05));
}

export function fmtMC(n: number): string {
  if (n >= 1e9) return (n / 1e9).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + "B";
  if (n >= 1e6) return (n / 1e6).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + "M";
  if (n >= 1e4) return Math.round(n).toLocaleString("tr-TR");
  if (n >= 100) return Math.round(n).toLocaleString("tr-TR");
  return n.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

export function fmtUSD(n: number): string {
  if (n >= 1e6) return "$" + (n / 1e6).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) + "M";
  return "$" + n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const SPEEDS = [
  { v: 1, label: "1×" },
  { v: 60, label: "60×" },
  { v: 1440, label: "1sn=1gün" },
  { v: 10080, label: "1sn=1hf" },
] as const;
