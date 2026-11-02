/**
 * Récap de la soirée : podium, faits marquants et bouton de partage (texte prêt à coller).
 * @module
 */
import { useState } from "react";
import { fmt } from "@/domain/score/regles";
import type { Donne } from "@/domain/score/regles";
import { calculerRecap, texteRecap } from "@/domain/stats/recap";
import { BADGES } from "@/domain/stats/badges";
import type { BadgeAttribue } from "@/domain/stats/badges";
import { Section, RankRow, GhostButton } from "@/components/ui";

interface RecapSoireeProps {
  donnes: Donne[];
  /** Noms par siège. */
  joueurs: string[];
  /** Identifiants par siège (pour retrouver les badges). */
  joueursId: string[];
  nbTotal: number;
  badges?: BadgeAttribue[];
  /** Date de la soirée déjà formatée, ajoutée au titre du texte partagé. */
  date?: string;
}

/** Récap partageable d'une partie, en cours ou archivée ; rien sans donne. */
export default function RecapSoiree({ donnes, joueurs, joueursId, nbTotal, badges, date }: RecapSoireeProps) {
  const [copie, setCopie] = useState(false);
  const [texteManuel, setTexteManuel] = useState<string | null>(null);
  const recap = calculerRecap(donnes, joueurs, nbTotal);
  if (!recap) return null;

  const badgesRecap = (badges ?? [])
    .filter((b) => b.badge !== "recrue")
    .map((b) => ({ nom: joueurs[joueursId.indexOf(b.joueurId)] ?? "?", titre: `${BADGES[b.badge].emoji} ${BADGES[b.badge].nom}` }));
  const texte = () => texteRecap(recap, { titre: date ? `Récap de la soirée du ${date}` : undefined, badges: badgesRecap });

  /** Partage natif si disponible, sinon presse-papier, sinon zone de texte à sélectionner (mobile). */
  const partager = async () => {
    const t = texte();
    try {
      if (navigator.share) {
        await navigator.share({ text: t });
        return;
      }
      await navigator.clipboard.writeText(t);
      setCopie(true);
      setTexteManuel(null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // partage annulé
      setCopie(false);
      setTexteManuel(t);
    }
  };

  const medailles = ["🥇", "🥈", "🥉"];
  return (
    <Section title="Récap de la soirée">
      {recap.classement.map((l, i) => (
        <RankRow key={l.nom} nom={`${medailles[i] ?? `${i + 1}.`} ${l.nom}`} valeur={fmt(l.pts)} negatif={l.pts < 0} testId="recap-ligne" />
      ))}
      <div className="mt-2 flex flex-col gap-1 px-1 text-xs leading-relaxed text-slate-300" data-testid="recap-faits">
        {recap.plusGrosseDonne && (
          <span>💥 Plus grosse donne : {recap.plusGrosseDonne.nom} {fmt(recap.plusGrosseDonne.pts)} (donne {recap.plusGrosseDonne.numero})</span>
        )}
        {recap.pireChute && (
          <span>🪦 Pire chute : {recap.pireChute.nom}, {recap.pireChute.contrat}, {fmt(recap.pireChute.pts)} (donne {recap.pireChute.numero})</span>
        )}
        {recap.plusBeauContrat && (
          <span>🚀 Plus beau contrat : {recap.plusBeauContrat.nom}, {recap.plusBeauContrat.contrat} (donne {recap.plusBeauContrat.numero})</span>
        )}
        {recap.casseur && <span>🔨 Le plus de chutes : {recap.casseur.nom} ({recap.casseur.chutes})</span>}
        <span>✅ {recap.reussies} réussi{recap.reussies > 1 ? "s" : ""} · ❌ {recap.chutees} chuté{recap.chutees > 1 ? "s" : ""}</span>
      </div>
      <div className="mt-3 px-1">
        <GhostButton onClick={partager}>Partager le récap</GhostButton>
        {copie && <p className="mt-2 text-xs text-slate-400">Copié dans le presse-papier.</p>}
        {texteManuel && (
          <textarea
            readOnly
            value={texteManuel}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-2 h-40 w-full rounded-lg border border-slate-800 bg-slate-900 p-2 font-mono text-[11px] text-slate-300"
            data-testid="recap-texte"
          />
        )}
      </div>
    </Section>
  );
}
