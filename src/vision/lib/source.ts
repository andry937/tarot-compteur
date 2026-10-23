/** Source d'images du suivi (la webcam). La boucle ne voit que cette interface. */

export interface Source {
  nom: string;
  /** Image courante, ou `null` tant que la source n'est pas prête. */
  image(): CanvasImageSource | null;
  taille(): { largeur: number; hauteur: number };
  arreter(): void;
}

/** Une vidéo (flux webcam ou fichier) lue dans un élément <video>. */
export function sourceVideo(video: HTMLVideoElement, nom: string, arreter: () => void = () => undefined): Source {
  return {
    nom,
    image: () => (video.readyState >= 2 && video.videoWidth > 0 ? video : null),
    taille: () => ({ largeur: video.videoWidth, hauteur: video.videoHeight }),
    arreter,
  };
}
