import { useEffect, useRef } from "react";
import { RoomScene } from "../game/scene";
import { fmtMC } from "../game/economy";

interface Props {
  level: number;
  owned: string[];
  clickMC: number;
  celebrate: number;
  onBoost: () => void;
}

export default function RoomCanvas({ level, owned, clickMC, celebrate, onBoost }: Props) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ level, owned, clickMC });
  propsRef.current = { level, owned, clickMC };
  const sceneRef = useRef<RoomScene | null>(null);
  if (!sceneRef.current) sceneRef.current = new RoomScene();

  useEffect(() => {
    const cv = cvRef.current!;
    const ctx = cv.getContext("2d")!;
    const scene = sceneRef.current!;
    let raf = 0;
    if (typeof document !== "undefined" && "fonts" in document) {
      void document.fonts.load('16px "Press Start 2P"');
    }
    const loop = (t: number) => {
      ctx.imageSmoothingEnabled = false;
      const ownedMap: Record<string, boolean> = {};
      for (const id of propsRef.current.owned) ownedMap[id] = true;
      scene.draw(ctx, propsRef.current.level, ownedMap, t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const drip = () => scene.coinDrip(2);
    window.addEventListener("retro-oda-coin", drip);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("retro-oda-coin", drip);
    };
  }, []);

  useEffect(() => {
    if (celebrate > 0) sceneRef.current?.burst();
  }, [celebrate]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = cvRef.current!;
    const rect = cv.getBoundingClientRect();
    const scene = sceneRef.current!;
    const x = ((e.clientX - rect.left) / rect.width) * scene.W;
    const y = ((e.clientY - rect.top) / rect.height) * scene.H;
    scene.addFloater(`+${fmtMC(propsRef.current.clickMC)} µC`, x - 20, y - 6, "#3dff7c");
    onBoost();
  };

  return (
    <canvas
      ref={cvRef}
      width={480}
      height={270}
      onClick={handleClick}
      className="block w-full cursor-crosshair select-none"
      style={{ imageRendering: "pixelated", aspectRatio: "480/270" }}
      aria-label="Retro oyun odası — tıkla, micro coin kazan"
    />
  );
}
