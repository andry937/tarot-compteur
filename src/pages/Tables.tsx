import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { Fiche } from "@/domain/joueurs/identite";
import type { HistoriqueEntree } from "@/domain/types";
import { Page, Header, GhostLink, GhostButton, Cta, Empty, ArchiveRow } from "@/components/ui";

interface TablesProps {
  tablesIndex: HistoriqueEntree[];
  roster: Fiche[];
  historiqueIndex: HistoriqueEntree[];
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export default function Tables({ tablesIndex, roster, historiqueIndex }: TablesProps) {
  const navigate = useNavigate();
  const actifs = roster.filter((r) => r.actif).length;

  return (
    <Page>
      <Header
        eyebrow="Tarot à la française"
        title="Feuille de marque"
        actions={
          <>
            <GhostLink to="/joueurs">Joueurs{actifs > 0 ? ` (${actifs})` : ""}</GhostLink>
            <GhostLink to="/historique">
              Historique{historiqueIndex.length > 0 ? ` (${historiqueIndex.length})` : ""}
            </GhostLink>
            <GhostLink to="/classement">Classement</GhostLink>
            {/* La session Firebase persiste indéfiniment sur l'appareil : sans ce
                bouton, un téléphone prêté garderait l'accès. AuthGate repasse
                sur Verrou via onAuthStateChanged. */}
            {auth && <GhostButton onClick={() => auth && signOut(auth).catch(() => {})}>Verrouiller</GhostButton>}
          </>
        }
      />

      {tablesIndex.length === 0 ? (
        <Empty
          title="Aucune table ouverte pour l'instant."
          hint="Créez-en une pour commencer à noter les donnes"
        />
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-3">
          {tablesIndex.map((t) => (
            <ArchiveRow
              key={t.id}
              testId="table-row"
              onClick={() => navigate(`/partie/${t.id}`)}
              gauche={
                <div className="min-w-0">
                  <span className="block font-mono text-[10px] uppercase tracking-wide text-slate-400">
                    Depuis le {fmtDate(t.date)}
                  </span>
                  <span className="mt-0.5 block truncate text-[13.5px]">{(t.joueurs || []).join(", ")}</span>
                </div>
              }
              droite={
                <span className="shrink-0 font-mono text-[10px] text-slate-400">{t.nbDonnes} donnes</span>
              }
            />
          ))}
        </div>
      )}

      <div className="mt-4">
        <Cta onClick={() => navigate("/composition")}>Nouvelle table</Cta>
      </div>
    </Page>
  );
}
