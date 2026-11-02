/**
 * Écran du classement général (`/classement`).
 * @module
 */

import { useState, useEffect, useMemo } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "@/stores/contexte";
import { useNavigate } from "react-router-dom";
import { calculerClassementElo, calculerEvolutionElo } from "@/domain/stats/elo";
import { attribuerBadges, BADGES } from "@/domain/stats/badges";
import type { PartieAnalysee } from "@/domain/stats/stats";
import {
  DONNES_MIN_PERIODE,
  championsParPeriode,
  clePeriode,
  libellePeriode,
  partiesDeLaPeriode,
  periodesDisponibles,
} from "@/domain/stats/periodes";
import type { TypePeriode } from "@/domain/stats/periodes";
import { chargerParties } from "@/lib/storage/archives";
import BadgesJoueurs from "@/components/badges/BadgesJoueurs";
import { Page, Header, GhostLink, GhostButton, Section, RankRow, Empty, Chip } from "@/components/ui";
import { GraphiqueClassement } from "@/components/graphiques/paresseux";
import ExplicationElo from "@/components/stats/ExplicationElo";

/** Nombre de donnes jouées requis pour figurer au classement. */
export const DONNES_MIN = 50;

/** Vue choisie : général (tout l'historique) ou une saison (mois, année). */
type Vue = "general" | TypePeriode;

const ONGLETS: { vue: Vue; libelle: string }[] = [
  { vue: "general", libelle: "Général" },
  { vue: "mois", libelle: "Mensuel" },
  { vue: "annee", libelle: "Annuel" },
];

/** Classement général, mensuel ou annuel des joueurs ayant assez de donnes, recalculé depuis les archives. */
export default observer(function Classement() {
  const store = useStore();
  const { roster } = store.registre;
  const historiqueIndex = store.historique.index;
  const navigate = useNavigate();
  const [parties, setParties] = useState<PartieAnalysee[]>([]);
  const [chargement, setChargement] = useState(true);
  const [vue, setVue] = useState<Vue>("general");
  /** Période choisie pour chaque saison (la plus récente par défaut). */
  const [choix, setChoix] = useState<Record<TypePeriode, string | null>>({ mois: null, annee: null });
  const [export_, setExport] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  /** Export en lecture seule (joueurs + parties archivées) pour analyser le
   * classement hors de l'app : copié dans le presse-papier, sinon affiché
   * dans une zone de texte à sélectionner (mobile). */
  const exporter = async () => {
    const parties = await chargerParties(historiqueIndex);
    const json = JSON.stringify({ roster, parties });
    setExport(json);
    try {
      await navigator.clipboard.writeText(json);
      setCopie(true);
    } catch {
      setCopie(false);
    }
  };

  useEffect(() => {
    setChargement(true);
    (async () => {
      setParties(await chargerParties(historiqueIndex));
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historiqueIndex.length]);

  const type = vue === "general" ? null : vue;
  const periodes = useMemo(() => (type ? periodesDisponibles(parties, type) : []), [parties, type]);
  const cle = type ? (choix[type] && periodes.includes(choix[type]!) ? choix[type]! : periodes[0]) : null;
  const seuil = type ? DONNES_MIN_PERIODE[type] : DONNES_MIN;

  const { classement, badges, evolution } = useMemo(() => {
    // Seule la période choisie est rejouée (notes repartant de zéro) ; le général rejoue tout.
    const retenues = type && cle ? partiesDeLaPeriode(parties, type, cle) : parties;
    // Seuls ceux qui ont joué au moins `seuil` donnes figurent au classement, mais tous pèsent dans le calcul
    // des notes. Les joueurs sans nom (« ∅ », anciens joueurs importés) pèsent dans le calcul des autres mais
    // n'ont pas leur place dans l'affichage.
    const affiches = calculerClassementElo(retenues, roster).filter(
      (c) => c.nom.trim() !== "" && c.nom.trim() !== "∅" && c.matchs >= seuil
    );
    return {
      classement: affiches,
      // Badges décernés entre tous les joueurs du classement affiché (et non entre ceux d'une table).
      badges: attribuerBadges(affiches.map((c) => c.id), retenues, roster),
      evolution: calculerEvolutionElo(retenues, roster),
    };
  }, [parties, roster, type, cle, seuil]);

  /** Champions des saisons, de la plus récente à la plus ancienne (pour le palmarès). */
  const champions = useMemo(() => (type ? championsParPeriode(parties, roster, type) : []), [parties, roster, type]);

  return (
    <Page>
      <Header
        eyebrow={vue === "general" ? "Classement général" : vue === "mois" ? "Classement mensuel" : "Classement annuel"}
        title="Note"
        actions={<GhostLink to="/">Accueil</GhostLink>}
      />

      <div role="group" aria-label="Période du classement" className="mb-3 flex gap-2">
        {ONGLETS.map((o) => (
          <Chip key={o.vue} on={vue === o.vue} onClick={() => setVue(o.vue)}>
            {o.libelle}
          </Chip>
        ))}
      </div>

      {type && cle && (
        <div className="mb-3 flex items-center justify-between gap-2" data-testid="selecteur-periode">
          <GhostButton
            aria-label="Période précédente"
            disabled={periodes.indexOf(cle) >= periodes.length - 1}
            onClick={() => setChoix({ ...choix, [type]: periodes[periodes.indexOf(cle) + 1] })}
          >
            ←
          </GhostButton>
          <span className="font-semibold capitalize text-slate-100" data-testid="periode-courante">
            {libellePeriode(cle, type)}
            {cle === clePeriode(new Date().toISOString(), type) && (
              <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-amber-400">en cours</span>
            )}
          </span>
          <GhostButton
            aria-label="Période suivante"
            disabled={periodes.indexOf(cle) === 0}
            onClick={() => setChoix({ ...choix, [type]: periodes[periodes.indexOf(cle) - 1] })}
          >
            →
          </GhostButton>
        </div>
      )}

      {chargement && <p className="text-sm text-slate-400">Calcul du classement…</p>}

      {!chargement && classement.length === 0 && (
        <Empty
          title="Personne n'a encore atteint le seuil."
          hint={`Seuls les joueurs ayant joué au moins ${seuil} donnes ${type ? (type === "mois" ? "ce mois-ci" : "cette année") : ""} figurent au classement`}
        />
      )}

      {!chargement && classement.length > 0 && (
        <Section>
          {classement.map((c, r) => (
            <RankRow
              key={c.id}
              rang={r + 1}
              nom={
                <>
                  {c.nom}
                  <span className="ml-1.5" aria-hidden="true">
                    {badges.filter((b) => b.joueurId === c.id).map((b) => BADGES[b.badge].emoji).join("")}
                  </span>
                </>
              }
              meta={`${c.matchs} donne${c.matchs > 1 ? "s" : ""}`}
              valeur={c.note}
              onClick={() => navigate(`/joueurs/${c.id}`)}
              testId="classement-row"
            />
          ))}
        </Section>
      )}

      {!chargement && champions.length > 0 && type && (
        <Section title={type === "mois" ? "Champions des mois" : "Champions des années"}>
          {champions.map((c) => (
            <RankRow
              key={c.cle}
              nom={
                <>
                  🏆 {c.champion.nom}
                </>
              }
              meta={<span className="capitalize">{libellePeriode(c.cle, type)}</span>}
              valeur={c.champion.note}
              onClick={() => navigate(`/joueurs/${c.champion.id}`)}
              testId="champion-row"
            />
          ))}
        </Section>
      )}

      {!chargement && classement.length > 0 && badges.length > 0 && (
        <Section title={type ? "Badges de la période" : "Badges (entre tous les joueurs)"}>
          <BadgesJoueurs noms={classement.map((c) => c.nom)} ids={classement.map((c) => c.id)} badges={badges} />
        </Section>
      )}

      {!chargement && classement.length > 0 && (
        <GraphiqueClassement
          joueurs={classement.map((c) => ({ id: c.id, nom: c.nom }))}
          evolution={evolution}
        />
      )}

      <ExplicationElo />

      <details className="mt-6 border-t border-slate-800 pt-4">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-slate-400">
          Exporter les données
        </summary>
        <div className="mt-3">
          <GhostButton onClick={exporter}>Copier les données</GhostButton>
          {export_ && copie && <p className="mt-2 text-xs text-slate-400">Copié dans le presse-papier.</p>}
          {export_ && !copie && (
            <textarea
              readOnly
              value={export_}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-2 h-32 w-full rounded-lg border border-slate-800 bg-slate-900 p-2 font-mono text-[10px] text-slate-300"
            />
          )}
        </div>
      </details>
    </Page>
  );
});
