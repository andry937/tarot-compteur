import type { Donne } from "@/domain/score/regles";
import { deduireMains, entameDeLaDonne } from "@/domain/cartes/cartes";
import { Page, Header, GhostButton } from "@/components/ui";
import MainsJoueurs from "./MainsJoueurs";

interface EcranMainsProps {
  joueurs: string[];
  donne: Donne;
  numero: number;
  onFermer: () => void;
}

/** Plein écran, lecture seule : la main de chaque joueur reconstituée d'après les cartes notées d'une donne. */
export default function EcranMains({ joueurs, donne, numero, onFermer }: EcranMainsProps) {
  const mains = deduireMains({
    table: donne.table,
    entame: entameDeLaDonne(donne),
    cartes: donne.cartesJouees ?? [],
    preneur: donne.preneur,
    chien: donne.chien,
    contrat: donne.contrat,
  });
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950" role="dialog" aria-label={`Mains de la donne ${numero}`}>
      <Page>
        <Header
          eyebrow={`Donne ${numero}`}
          title="Mains des joueurs"
          actions={<GhostButton onClick={onFermer}>Retour</GhostButton>}
        />
        {mains ? (
          <MainsJoueurs joueurs={joueurs} preneur={donne.preneur} chien={donne.chien} mains={mains} />
        ) : (
          <p className="text-sm text-slate-400">Aucune carte notée pour cette donne.</p>
        )}
      </Page>
    </div>
  );
}
