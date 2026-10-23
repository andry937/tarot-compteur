import { forwardRef } from "react";
import { libelleCourt } from "@/domain/cartes/cartes";
import type { Detection } from "@/vision/domain/types";

interface Props {
  /** Rapport largeur/hauteur de l'image, pour que les coordonnées normalisées tombent juste. */
  ratio: number;
  detections: Detection[];
}

const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

/** Image de la caméra avec les détections superposées. Aucune zone : le joueur d'une carte se déduit de l'ordre d'arrivée. */
const VideoZones = forwardRef<HTMLVideoElement, Props>(function VideoZones({ ratio, detections }, videoRef) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: String(ratio) }} data-testid="zone-video">
      <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-fill" />

      {detections.map((d, i) => (
        <div
          key={`${d.carte}-${i}`}
          data-testid="detection"
          className="pointer-events-none absolute border border-emerald-400"
          style={{ left: pct(d.x), top: pct(d.y), width: pct(d.l), height: pct(d.h) }}
        >
          <span className="absolute -top-4 left-0 whitespace-nowrap rounded bg-emerald-500 px-1 font-mono text-[10px] font-semibold text-slate-950">
            {libelleCourt(d.carte)} {Math.round(d.confiance * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
});

export default VideoZones;
