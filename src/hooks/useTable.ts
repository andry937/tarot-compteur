import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Donne } from "@/domain/score/regles";
import type { Partie, Annulation, ArchiveRecord } from "@/domain/types";
import { cleTable } from "@/lib/storage/stockage";

/**
 * Table ouverte dans cet onglet : sa composition, ses donnes, ses annulations
 * et le brouillon de la main en cours, avec leur sauvegarde automatique dans
 * `tarot:table:{id}`. Une seule table est active par onglet ; les autres
 * tables ouvertes ne sont chargées que lorsqu'on les visite.
 *
 * `pret` bloque toute écriture tant que le stockage n'a pas été relu avec
 * succès au démarrage (voir App.tsx).
 */
export function useTable(pret: boolean) {
  const navigate = useNavigate();
  const [tableActiveId, setTableActiveId] = useState<string | null>(null);
  const [partie, setPartie] = useState<Partie | null>(null);
  const [donnes, setDonnes] = useState<Donne[]>([]);
  const [annulations, setAnnulations] = useState<Annulation[]>([]);
  const [cartesEnCours, setCartesEnCours] = useState<string[]>([]);
  const [chienEnCours, setChienEnCours] = useState<string[]>([]);

  /** Active une table dans cet onglet (nouvelle table ou table relue). */
  const activer = (id: string, p: Partie, rec: Partial<ArchiveRecord> = {}) => {
    setPartie(p);
    setDonnes(rec.donnes || []);
    setAnnulations(rec.annulations || []);
    setCartesEnCours(rec.cartesEnCours || []);
    setChienEnCours(rec.chienEnCours || []);
    setTableActiveId(id);
  };

  /** Oublie la table active dans cet onglet, sans rien toucher au stockage. */
  const desactiver = () => {
    setPartie(null);
    setDonnes([]);
    setAnnulations([]);
    setCartesEnCours([]);
    setChienEnCours([]);
    setTableActiveId(null);
  };

  /** Charge à la demande la table `id` (route /partie/:id) si elle n'est pas déjà active dans cet onglet. */
  const chargerTable = async (id: string) => {
    if (tableActiveId === id) return;
    try {
      const r = await window.storage.get(cleTable(id));
      const rec: ArchiveRecord = JSON.parse(r.value);
      activer(
        id,
        {
          joueursId: rec.joueursId,
          joueursNomFige: rec.joueursNomFige,
          parDonne: rec.parDonne,
          depart: rec.depart || 0,
        },
        rec
      );
    } catch (e) {
      navigate("/"); // id inconnu (lien mort, table déjà fermée ailleurs)
    }
  };

  useEffect(() => {
    if (!pret || !partie || !tableActiveId) return;
    (async () => {
      try {
        await window.storage.set(
          cleTable(tableActiveId),
          JSON.stringify({ ...partie, donnes, annulations, cartesEnCours, chienEnCours })
        );
      } catch (e) {
        console.error("Sauvegarde impossible", e);
      }
    })();
  }, [partie, donnes, annulations, cartesEnCours, chienEnCours, pret, tableActiveId]);

  return {
    tableActiveId,
    partie,
    donnes,
    annulations,
    cartesEnCours,
    chienEnCours,
    setCartesEnCours,
    setChienEnCours,
    activer,
    desactiver,
    chargerTable,
    ajouterDonne: (d: Donne) => {
      // Les cartes notées pendant la main sont rattachées à la donne inscrite.
      setDonnes((ds) => [
        ...ds,
        {
          ...d,
          ...(cartesEnCours.length ? { cartesJouees: cartesEnCours } : {}),
          ...(chienEnCours.length ? { chien: chienEnCours } : {}),
        },
      ]);
      setCartesEnCours([]);
      setChienEnCours([]);
    },
    modifierDonne: (i: number, d: Donne) => setDonnes((ds) => ds.map((old, k) => (k === i ? d : old))),
    effacerDonne: (i: number) => setDonnes((ds) => ds.filter((_, k) => k !== i)),
    ajouterAnnulation: (a: Annulation) => {
      setAnnulations((arr) => [...arr, a]);
      setCartesEnCours([]);
      setChienEnCours([]); // la donne est rejouée : le brouillon n'a plus de sens
    },
  };
}
