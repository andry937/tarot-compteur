import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { resoudreFiche } from "../utils/identite";
import type { Fiche } from "../utils/identite";
import { calculerStatsJoueur } from "../utils/stats";
import type { PartieAnalysee, Role, StatsJoueur } from "../utils/stats";
import type { HistoriqueEntree, ArchiveRecord } from "../types";
import { cleArchive } from "../lib/stockage";
import { CONTRATS, NOM_BOUT, fmt, NOM_ROI } from "../utils/regles";
import type { Bout } from "../utils/regles";
import { Page, Header, GhostLink, Section, RankRow, ArchiveRow, Empty } from "../components/ui";
import GraphiquePersonnel from "../components/GraphiquePersonnel";

interface FicheJoueurProps {
  roster: Fiche[];
  historiqueIndex: HistoriqueEntree[];
}

const LABEL_ROLE: Record<Role, string> = {
  preneur: "Preneur",
  appele: "Appelé",
  defense: "Défense",
  repos: "Repos",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

const moyenne = (valeurs: number[]) =>
  valeurs.length ? Math.round((valeurs.reduce((a, b) => a + b, 0) / valeurs.length) * 10) / 10 : 0;

const nomContrat = (id: string) => CONTRATS.find((c) => c.id === id)?.nom ?? id;

const nomBoutsPrecis = (bouts: Bout[]) => bouts.map((b) => NOM_BOUT[b]).join(", ");

export default function FicheJoueur({ roster, historiqueIndex }: FicheJoueurProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsJoueur | null>(null);
  const [chargement, setChargement] = useState(true);

  const ficheFinale = id ? resoudreFiche(id, roster) : null;

  // Cluster de tous les identifiants (actifs ou fusionnés) qui résolvent
  // vers la même fiche — une fusion ne réécrit jamais les archives, donc
  // sans ça les donnes jouées sous l'ancienne identité disparaîtraient.
  const cluster = ficheFinale
    ? roster.filter((f) => resoudreFiche(f.id, roster)?.id === ficheFinale.id).map((f) => f.id)
    : [];

  useEffect(() => {
    if (!ficheFinale) {
      setChargement(false);
      return;
    }
    const partiesConcernees = historiqueIndex.filter((h) =>
      (h.joueursId || []).some((pid) => cluster.includes(pid))
    );
    setChargement(true);
    (async () => {
      const parties: PartieAnalysee[] = [];
      for (const h of partiesConcernees) {
        try {
          const r = await window.storage.get(cleArchive(h.id));
          const record: ArchiveRecord = JSON.parse(r.value);
          parties.push({
            archiveId: h.id,
            date: h.date,
            joueursId: record.joueursId,
            donnes: record.donnes,
          });
        } catch (e) {
          console.error("Lecture de l'archive impossible", e);
        }
      }
      const idPresent = cluster.find((pid) => parties.some((p) => p.joueursId.includes(pid)));
      setStats(calculerStatsJoueur(idPresent ?? ficheFinale.id, parties));
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, historiqueIndex.length]);

  if (!id || !ficheFinale) {
    return (
      <Page>
        <Header
          eyebrow="Statistiques"
          title="Joueur introuvable"
          actions={
            <>
              <GhostLink to="/">Accueil</GhostLink>
              <GhostLink to="/joueurs">Retour</GhostLink>
            </>
          }
        />
      </Page>
    );
  }

  return (
    <Page>
      <Header
        eyebrow={
          stats
            ? `${stats.partiesJouees} partie${stats.partiesJouees > 1 ? "s" : ""} · ${stats.donneesJouees} donne${stats.donneesJouees > 1 ? "s" : ""}`
            : "Statistiques"
        }
        title={ficheFinale.nom}
        actions={
          <>
            <GhostLink to="/">Accueil</GhostLink>
            <GhostLink to="/joueurs">Retour</GhostLink>
          </>
        }
      />

      {chargement && <p className="text-sm text-slate-400">Chargement des statistiques…</p>}

      {!chargement && stats && stats.partiesJouees === 0 && (
        <Empty title="Aucune donne jouée pour l'instant." hint="Les stats apparaîtront ici dès que ce joueur aura joué une partie" />
      )}

      {!chargement && stats && stats.partiesJouees > 0 && (
        <>
          <Section title="Points totaux">
            <RankRow nom={`Cumul sur ${stats.donneesJouees} donnes`} valeur={fmt(stats.pointsTotaux)} negatif={stats.pointsTotaux < 0} />
          </Section>

          <GraphiquePersonnel trajectoire={stats.trajectoire} />

          <Section title="Par rôle">
            {(["preneur", "appele", "defense"] as Role[]).map((role) => {
              const r = stats.parRole[role];
              const taux = r.donnes > 0 ? Math.round((r.victoires / r.donnes) * 100) : null;
              return (
                <RankRow
                  key={role}
                  nom={LABEL_ROLE[role]}
                  meta={`${r.donnes} donnes`}
                  valeur={taux !== null ? `${taux}%` : "—"}
                />
              );
            })}
            <RankRow nom="Nombre de fois appelé" valeur={stats.foisAppele} />
          </Section>

          {(stats.appelsReussis.length > 0 || stats.appelsEchoues.length > 0) && (
            <Section title="Appels (en tant que preneur)">
              <RankRow
                nom="Réussis"
                meta={
                  stats.appelsReussis.length > 0
                    ? `${moyenne(stats.appelsReussis.map((a) => a.bouts))} bouts · ${moyenne(stats.appelsReussis.map((a) => a.points))} pts en moyenne`
                    : undefined
                }
                valeur={stats.appelsReussis.length}
              />
              <RankRow
                nom="Échoués"
                meta={
                  stats.appelsEchoues.length > 0
                    ? `${moyenne(stats.appelsEchoues.map((a) => a.bouts))} bouts · ${moyenne(stats.appelsEchoues.map((a) => a.points))} pts en moyenne`
                    : undefined
                }
                valeur={stats.appelsEchoues.length}
              />
            </Section>
          )}

          {stats.appelsReussis.length > 0 && (
            <Section title="Appels réussis (en tant que preneur)">
              {stats.appelsReussis.map((a) => (
                <ArchiveRow
                  key={`${a.archiveId}-${a.indexDonne}`}
                  onClick={() => navigate(`/historique/${a.archiveId}`)}
                  gauche={
                    <div className="min-w-0">
                      <span className="block font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        {fmtDate(a.date)}
                      </span>
                      <span className="mt-0.5 block truncate text-sm">
                        {nomContrat(a.contrat)} · {a.bouts} bout{a.bouts > 1 ? "s" : ""}
                        {a.boutsPrecis.length > 0 && ` (${nomBoutsPrecis(a.boutsPrecis)})`}
                      </span>
                    </div>
                  }
                  droite={<span className="shrink-0 font-serif text-lg font-bold">{a.points} pts</span>}
                />
              ))}
            </Section>
          )}

          {stats.appelsEchoues.length > 0 && (
            <Section title="Appels échoués (en tant que preneur)">
              {stats.appelsEchoues.map((a) => (
                <ArchiveRow
                  key={`${a.archiveId}-${a.indexDonne}`}
                  onClick={() => navigate(`/historique/${a.archiveId}`)}
                  gauche={
                    <div className="min-w-0">
                      <span className="block font-mono text-[10px] uppercase tracking-wide text-slate-400">
                        {fmtDate(a.date)}
                      </span>
                      <span className="mt-0.5 block truncate text-sm">
                        {nomContrat(a.contrat)} · {a.bouts} bout{a.bouts > 1 ? "s" : ""}
                        {a.boutsPrecis.length > 0 && ` (${nomBoutsPrecis(a.boutsPrecis)})`}
                      </span>
                    </div>
                  }
                  droite={
                    <span className="shrink-0 font-serif text-lg font-bold text-rose-400">{a.points} pts</span>
                  }
                />
              ))}
            </Section>
          )}

          {stats.roisAppelesParLui.length > 0 && (
            <Section title="Rois appelés (en tant que preneur)">
              {stats.roisAppelesParLui.map((r) => (
                <RankRow key={r.roi} nom={NOM_ROI[r.roi]} valeur={r.fois} />
              ))}
            </Section>
          )}

          {(stats.meilleureDonne || stats.pireDonne) && (
            <Section title="Meilleure / pire donne">
              {stats.meilleureDonne && (
                <RankRow
                  nom={`Meilleure — ${fmtDate(stats.meilleureDonne.date)}`}
                  valeur={fmt(stats.meilleureDonne.points)}
                  onClick={() => navigate(`/historique/${stats.meilleureDonne!.archiveId}`)}
                />
              )}
              {stats.pireDonne && (
                <RankRow
                  nom={`Pire — ${fmtDate(stats.pireDonne.date)}`}
                  valeur={fmt(stats.pireDonne.points)}
                  negatif={stats.pireDonne.points < 0}
                  onClick={() => navigate(`/historique/${stats.pireDonne!.archiveId}`)}
                />
              )}
            </Section>
          )}

          <Section title="Parties jouées">
            {stats.parties.map((p) => (
              <ArchiveRow
                key={p.archiveId}
                onClick={() => navigate(`/historique/${p.archiveId}`)}
                gauche={
                  <div className="min-w-0">
                    <span className="block font-mono text-[10px] uppercase tracking-wide text-slate-400">
                      {fmtDate(p.date)}
                    </span>
                    <span className="mt-0.5 block truncate text-sm">{p.nbDonnes} donnes jouées</span>
                  </div>
                }
                droite={
                  <span className={`shrink-0 font-serif text-lg font-bold ${p.points < 0 ? "text-rose-400" : ""}`}>
                    {fmt(p.points)}
                  </span>
                }
              />
            ))}
          </Section>
        </>
      )}
    </Page>
  );
}
