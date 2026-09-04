import { calculerStatsPartie } from "../utils/statsPartie";
import { NOM_ROI } from "../utils/regles";
import type { Donne } from "../utils/regles";
import { Section, RankRow } from "./ui";

interface StatsPartieProps {
  donnes: Donne[];
  joueurs: string[];
  nbTotal: number;
}

/** Panneau de statistiques sur les donnes d'une seule partie (en cours ou
 * archivée) — distinct de la fiche joueur cumulée sur tout l'historique. */
export default function StatsPartie({ donnes, joueurs, nbTotal }: StatsPartieProps) {
  if (donnes.length === 0) return null;
  const stats = calculerStatsPartie(donnes, joueurs, nbTotal);

  return (
    <Section title="Statistiques de la partie">
      <RankRow nom="Contrats réussis" meta={`sur ${stats.nbDonnes}`} valeur={stats.reussies} />
      <RankRow nom="Contrats chutés" meta={`sur ${stats.nbDonnes}`} valeur={stats.chutees} />
      {(stats.avecAppele > 0 || stats.preneurSeul > 0) && (
        <>
          <RankRow nom="Mains avec appelé" valeur={stats.avecAppele} />
          <RankRow nom="Mains preneur seul" valeur={stats.preneurSeul} />
        </>
      )}
      {stats.roisAppeles.map((r) => (
        <RankRow key={r.roi} nom={`Roi ${NOM_ROI[r.roi]} appelé`} valeur={r.fois} />
      ))}
      {stats.joueursAppeles.map((j) => (
        <RankRow key={j.joueur} nom={`${j.joueur} appelé(e)`} valeur={j.fois} />
      ))}
    </Section>
  );
}
