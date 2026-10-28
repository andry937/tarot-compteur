/**
 * Suit les proportions réelles de l'image d'une caméra. Sur un téléphone, la taille du flux n'est pas connue au
 * démarrage et change quand on tourne l'appareil : un cadre resté à 16/9 étirerait ou écraserait l'image
 * (affichée en `object-fill`). Renvoie la fonction qui retire les écouteurs.
 */
export function suivreProportions(video: HTMLVideoElement, onRatio: (ratio: number) => void): () => void {
  const lire = () => {
    if (video.videoWidth > 0 && video.videoHeight > 0) onRatio(video.videoWidth / video.videoHeight);
  };
  video.addEventListener("loadedmetadata", lire);
  video.addEventListener("resize", lire);
  lire();
  return () => {
    video.removeEventListener("loadedmetadata", lire);
    video.removeEventListener("resize", lire);
  };
}
