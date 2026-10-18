/**
 * Chargement groupé des archives pour les écrans qui agrègent tout l'historique
 * (Classement, FicheJoueur). Deux gains par rapport à une boucle séquentielle :
 * les lectures partent en parallèle (un aller-retour réseau au lieu de N), et
 * les archives déjà lues sont gardées en mémoire pour la session de l'onglet.
 *
 * Le cache est invalidé par `invaliderArchive` à chaque écriture/suppression
 * faite depuis cet onglet ; une modification faite depuis un autre appareil
 * n'apparaît qu'après rechargement de la page.
 */
import type { HistoriqueEntree, ArchiveRecord } from "@/domain/types";
import type { PartieAnalysee } from "@/domain/stats/stats";
import { cleArchive } from "./stockage";

const cache = new Map<string, Promise<ArchiveRecord>>();

export function invaliderArchive(id: string): void {
  cache.delete(id);
}

export function viderCacheArchives(): void {
  cache.clear();
}

function lireArchive(id: string): Promise<ArchiveRecord> {
  let p = cache.get(id);
  if (!p) {
    p = window.storage.get(cleArchive(id)).then((r) => JSON.parse(r.value) as ArchiveRecord);
    // Une lecture en échec ne doit pas rester en cache.
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/**
 * Retire les entrées en double d'un index (même identifiant d'archive), en
 * gardant la première — la plus récente, l'index étant rempli par le début.
 * Un doublon apparaît quand une même table est clôturée deux fois, par
 * exemple depuis deux appareils : sans ce filtre, ses donnes compteraient
 * deux fois dans le classement et les statistiques.
 */
export function sansDoublons<T extends { id: string }>(index: T[]): T[] {
  const vus = new Set<string>();
  return index.filter((h) => {
    if (vus.has(h.id)) return false;
    vus.add(h.id);
    return true;
  });
}

export async function chargerParties(index: HistoriqueEntree[]): Promise<PartieAnalysee[]> {
  const lues = await Promise.all(
    sansDoublons(index).map(async (h): Promise<PartieAnalysee | null> => {
      try {
        const record = await lireArchive(h.id);
        return { archiveId: h.id, date: h.date, joueursId: record.joueursId, donnes: record.donnes };
      } catch (e) {
        console.error("Lecture de l'archive impossible", e);
        return null;
      }
    })
  );
  return lues.filter((p): p is PartieAnalysee => p !== null);
}
