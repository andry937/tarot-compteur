export default function ExplicationElo() {
  return (
    <details className="mt-6 border-t border-slate-800 pt-4">
      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-slate-400">
        Comment fonctionne le classement Elo
      </summary>
      <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
        Chaque donne archivée compte comme un match : l'attaque (le preneur,
        et l'appelé s'il y en a un) affronte la défense. Le résultat n'est
        pas juste gagné/perdu — plus le contrat est réussi (ou chuté)
        largement, plus il se rapproche de 1 (ou de 0) ; une victoire
        ric-rac ne rapporte donc qu'un peu plus que 0,5.
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
        <strong className="text-slate-100">Plusieurs contre un</strong> (ex.
        3 défenseurs contre 1 preneur) — le calcul se base sur la moyenne
        des Elo du camp, mais chaque défenseur gagne ou perd le même delta,
        sans le diviser entre eux.
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
        <strong className="text-slate-100">Preneur et appelé</strong> ne
        gagnent en revanche pas la même part de ce delta : le preneur, qui
        annonce le contrat, en porte 2 parts contre 1 pour l'appelé — même
        ratio que la répartition des points réels de la donne.
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-slate-400">
        Tout le monde démarre à <code className="font-mono text-amber-400">1500</code> points,
        avec un K-facteur de <code className="font-mono text-amber-400">24</code> (valeurs
        standard du système Elo). Le classement est recalculé en entier à
        chaque affichage, en rejouant toutes les donnes archivées dans
        l'ordre chronologique — pas d'agrégat stocké, donc pas de risque de
        désynchronisation après une fusion de fiches joueur.
      </p>
    </details>
  );
}
