/** Accès à la webcam, avec des erreurs que l'interface sait expliquer en français. */

export type CodeErreurCamera = "indisponible" | "refusee" | "introuvable" | "occupee" | "contrainte" | "inconnue";

export class ErreurCamera extends Error {
  constructor(public code: CodeErreurCamera, message: string) {
    super(message);
    this.name = "ErreurCamera";
  }
}

const MESSAGES: Record<CodeErreurCamera, string> = {
  indisponible: "Ce navigateur ne donne pas accès à la caméra (la page doit être servie en HTTPS ou sur localhost).",
  refusee: "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du site (icône de cadenas de la barre d'adresse), puis réessayez.",
  introuvable: "Aucune caméra détectée. Branchez une webcam.",
  occupee: "La caméra est utilisée par une autre application ou un autre onglet. Fermez-les, puis réessayez.",
  contrainte: "La caméra ne propose pas cette résolution. Choisissez une résolution plus basse.",
  inconnue: "Impossible d'ouvrir la caméra.",
};

/** Traduit l'erreur levée par `getUserMedia` / `enumerateDevices`. */
export function traduireErreurCamera(e: unknown): ErreurCamera {
  if (e instanceof ErreurCamera) return e;
  const nom = typeof e === "object" && e !== null && "name" in e ? String((e as { name: unknown }).name) : "";
  const code: CodeErreurCamera =
    nom === "NotAllowedError" || nom === "SecurityError" || nom === "PermissionDeniedError" ? "refusee"
    : nom === "NotFoundError" || nom === "DevicesNotFoundError" ? "introuvable"
    : nom === "NotReadableError" || nom === "TrackStartError" || nom === "AbortError" ? "occupee"
    : nom === "OverconstrainedError" || nom === "ConstraintNotSatisfiedError" ? "contrainte"
    : "inconnue";
  return new ErreurCamera(code, MESSAGES[code]);
}

export interface InfoCamera {
  id: string;
  libelle: string;
}

export const RESOLUTIONS = [
  { libelle: "1080p (1920×1080)", largeur: 1920, hauteur: 1080 },
  { libelle: "720p (1280×720)", largeur: 1280, hauteur: 720 },
  { libelle: "480p (640×480)", largeur: 640, hauteur: 480 },
] as const;

function mediaDevices(): MediaDevices {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) throw new ErreurCamera("indisponible", MESSAGES.indisponible);
  return navigator.mediaDevices;
}

/** Les libellés des caméras ne sont renseignés qu'après une autorisation : à rappeler une fois la caméra ouverte. */
export async function listerCameras(): Promise<InfoCamera[]> {
  try {
    const appareils = await mediaDevices().enumerateDevices();
    return appareils
      .filter((a) => a.kind === "videoinput")
      .map((a, i) => ({ id: a.deviceId, libelle: a.label || `Caméra ${i + 1}` }));
  } catch (e) {
    throw traduireErreurCamera(e);
  }
}

export interface OptionsCamera {
  deviceId?: string;
  largeur: number;
  hauteur: number;
  fps: number;
}

export async function ouvrirCamera(options: OptionsCamera): Promise<MediaStream> {
  try {
    return await mediaDevices().getUserMedia({
      audio: false,
      video: {
        deviceId: options.deviceId ? { exact: options.deviceId } : undefined,
        // Sans choix explicite, préférer la caméra arrière d'un téléphone (ignoré par une webcam de PC).
        facingMode: options.deviceId ? undefined : { ideal: "environment" },
        width: { ideal: options.largeur },
        height: { ideal: options.hauteur },
        frameRate: { ideal: options.fps },
      },
    });
  } catch (e) {
    throw traduireErreurCamera(e);
  }
}

export function arreterFlux(flux: MediaStream | null | undefined): void {
  flux?.getTracks().forEach((t) => t.stop());
}
