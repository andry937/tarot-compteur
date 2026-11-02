/**
 * Annonce de fin de partie (`/fin`) : cérémonie du podium juste après la clôture d'une table,
 * suivie du récap et du leader des saisons (mois et année) en cours.
 * @module
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "@/stores/contexte";
import { fmt } from "@/domain/score/regles";
import { calculerRecap } from "@/domain/stats/recap";
import { classementPeriode, clePeriode, libellePeriode } from "@/domain/stats/periodes";
import type { TypePeriode } from "@/domain/stats/periodes";
import type { ClassementElo } from "@/domain/stats/elo";
import { chargerParties } from "@/lib/storage/archives";
import RecapSoiree from "@/components/stats/RecapSoiree";
import { Page, Header, Section, Cta } from "@/components/ui";

/** Où aller après l'annonce (« Rejouer » passe la composition en état de navigation). */
interface Suite {
  vers: string;
  etat?: unknown;
}

/** Leader d'une saison, ou `null` tant que personne n'a assez de donnes. */
interface LeaderSaison {
  type: TypePeriode;
  libelle: string;
  leader: ClassementElo;
}

/** Hauteur, médaille et délai d'apparition de chaque marche (le vainqueur arrive en dernier). */
const MARCHES = [
  { medaille: "🥇", hauteur: "h-28", delai: "1.6s" },
  { medaille: "🥈", hauteur: "h-20", delai: "1.0s" },
  { medaille: "🥉", hauteur: "h-14", delai: "0.4s" },
];

/** Écran d'annonce de fin de partie ; redirige vers l'accueil s'il n'y a rien à annoncer. */
export default observer(function Fin() {
  const store = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const annonce = store.annonceFin;
  const suite = (location.state as { suite?: Suite } | null)?.suite;
  const [saisons, setSaisons] = useState<LeaderSaison[]>([]);

  useEffect(() => {
    if (!annonce) return;
    let actif = true;
    (async () => {
      try {
        // La partie vient d'être archivée : elle compte déjà dans les saisons.
        const parties = await chargerParties(store.historique.index);
        const roster = store.registre.roster;
        const trouves: LeaderSaison[] = [];
        for (const type of ["mois", "annee"] as const) {
          const cle = clePeriode(annonce.date, type);
          const [leader] = classementPeriode(parties, roster, type, cle);
          if (leader) trouves.push({ type, libelle: libellePeriode(cle, type), leader });
        }
        if (actif) setSaisons(trouves);
      } catch (e) {
        console.error("Saisons indisponibles", e); // l'annonce reste complète sans elles
      }
    })();
    return () => {
      actif = false;
    };
  }, [annonce, store]);

  if (!annonce) return <Navigate to="/" replace />;

  const recap = calculerRecap(annonce.donnes, annonce.joueurs, annonce.nbTotal);
  const podium = recap?.classement.slice(0, 3) ?? [];
  const vainqueur = podium[0];
  const dernier = recap && recap.classement.length > 1 ? recap.classement[recap.classement.length - 1] : null;

  const continuer = () => {
    store.effacerAnnonceFin();
    navigate(suite?.vers ?? "/", suite?.etat !== undefined ? { state: suite.etat } : undefined);
  };

  return (
    <Page>
      <Header eyebrow="Fin de partie" title="C'est terminé !" />

      {vainqueur && (
        <div className="mt-2 text-center" data-testid="annonce-vainqueur">
          <div className="animate-apparition text-6xl" style={{ animationDelay: "1.6s" }} aria-hidden="true">
            🏆
          </div>
          <p className="animate-apparition mt-3 text-lg font-semibold text-slate-100" style={{ animationDelay: "2.0s" }}>
            <span className="text-amber-400">{vainqueur.nom}</span> remporte la soirée
          </p>
          <p className="animate-apparition font-mono text-sm text-slate-400" style={{ animationDelay: "2.2s" }}>
            {fmt(vainqueur.pts)} points en {recap?.nbDonnes} donne{(recap?.nbDonnes ?? 0) > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {podium.length > 1 && (
        <div className="mt-6 flex items-end justify-center gap-2" data-testid="annonce-podium">
          {/* Ordre visuel : 2e, 1er, 3e. */}
          {[1, 0, 2].map((rang) => {
            const l = podium[rang];
            if (!l) return null;
            const m = MARCHES[rang];
            return (
              <div key={l.nom} className="animate-apparition flex w-1/3 max-w-[9rem] flex-col items-center" style={{ animationDelay: m.delai }}>
                <span className="text-2xl" aria-hidden="true">{m.medaille}</span>
                <span className="mt-1 max-w-full truncate text-sm font-semibold text-slate-100">{l.nom}</span>
                <span className={`font-mono text-xs ${l.pts < 0 ? "text-rose-400" : "text-slate-400"}`}>{fmt(l.pts)}</span>
                <div className={`mt-1 w-full rounded-t-lg border border-b-0 border-slate-700 bg-slate-800 ${m.hauteur} ${rang === 0 ? "border-amber-400/60" : ""}`} />
              </div>
            );
          })}
        </div>
      )}

      {dernier && (
        <p className="animate-apparition mt-4 text-center text-sm text-slate-400" style={{ animationDelay: "2.4s" }} data-testid="annonce-dernier">
          💀 {dernier.nom} ferme la marche ({fmt(dernier.pts)})
        </p>
      )}

      {saisons.length > 0 && (
        <Section title="Saisons en cours">
          <div className="flex flex-col gap-1 px-1 text-sm text-slate-300" data-testid="annonce-saisons">
            {saisons.map((s) => (
              <span key={s.type}>
                {s.type === "mois" ? "📅" : "🗓️"} Leader {s.type === "mois" ? "de" : "de l'année"} {s.libelle} :{" "}
                <b className="font-semibold text-amber-400">{s.leader.nom}</b>{" "}
                <span className="font-mono text-xs text-slate-400">{s.leader.note}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      <RecapSoiree
        donnes={annonce.donnes}
        joueurs={annonce.joueurs}
        joueursId={annonce.joueursId}
        nbTotal={annonce.nbTotal}
        badges={annonce.badges}
        date={new Date(annonce.date).toLocaleDateString("fr-FR")}
      />

      <div className="mt-6">
        <Cta onClick={continuer}>Continuer</Cta>
      </div>
    </Page>
  );
});
