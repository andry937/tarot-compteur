export default function ExplicationElo() {
  return (
    <details className="mt-6 border-t border-slate-800 pt-4">
      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Comment fonctionne le classement
      </summary>
      <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
        Chaque joueur a un <strong className="text-slate-100">niveau estimé</strong> et
        une <strong className="text-slate-100">marge d'incertitude</strong>. On est classé
        sur une note prudente : le niveau moins trois fois la marge. Un nouveau
        joueur, qu'on ne connaît pas encore, part donc de{" "}
        <code className="font-mono text-amber-400">0</code> ; sa marge se resserre à
        chaque donne et sa note monte vers son vrai niveau. Il ne passe devant
        les habitués qu'en gagnant durablement.
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
        Chaque donne compte comme un match : l'attaque (le preneur, et l'appelé
        s'il y en a un) affronte la défense, chaque camp étant jugé sur le niveau
        moyen de ses joueurs. Le résultat n'est pas juste gagné/perdu — plus le
        contrat est réussi (ou chuté) largement, plus il compte. Battre plus fort
        que soi rapporte plus que battre plus faible.
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
        <strong className="text-slate-100">Ce que gagne l'attaque, la défense le perd</strong>,
        partagé entre ses joueurs : jouer souvent ne fait ni monter ni descendre
        en moyenne. Côté attaque, le preneur, qui annonce le contrat, bouge deux
        fois plus que l'appelé — même ratio que les points réels de la donne.
      </p>
    </details>
  );
}
