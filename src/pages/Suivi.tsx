/**
 * Écran `/partie/:id/suivi` : suit la donne en cours avec la webcam. Les cartes jouées et le chien reconnus sont
 * reportés dans le brouillon de la table, que le formulaire « Inscrire la donne » reprend (cartes, chien, points déduits).
 * @module
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { useStore } from "@/stores/contexte";
import { tableDeLaDonne } from "@/domain/score/regles";
import { useConfirmation } from "@/hooks/useConfirmation";
import { Page, Header, GhostButton, Cta, Bar } from "@/components/ui";
import type { Annonce } from "@/vision/domain/annonce";
import type { ConfigSuivi } from "@/vision/domain/machinePli";
import { listerCameras, RESOLUTIONS } from "@/vision/lib/camera";
import type { InfoCamera } from "@/vision/lib/camera";
import { preparerDetecteur, preparerSource } from "@/vision/lib/demarrage";
import { suivreProportions } from "@/vision/lib/proportions";
import { resume } from "@/vision/lib/sauvegardePartie";
import { StoreSuivi } from "@/vision/StoreSuivi";
import { Bouton, Section, Champ, classeSelect } from "@/vision/ui";
import ActionsPli from "@/components/suivi/ActionsPli";
import PanneauAlertes from "@/components/suivi/PanneauAlertes";
import PanneauPiles from "@/components/suivi/PanneauPiles";
import PanneauPli from "@/components/suivi/PanneauPli";
import VideoZones from "@/components/suivi/VideoZones";

/** Suit la table active (`store.table`, déjà chargée par la route). */
export default observer(function Suivi() {
  const store = useStore();
  const navigate = useNavigate();
  const t = store.table;
  const { joueurs, nbTotal, donnes, cartesEnCours, chienEnCours } = t;
  const idTable = t.id!;
  const { parDonne } = t.partie!;
  const depart = t.partie!.depart || 0;
  const prochaine = tableDeLaDonne(donnes.length, nbTotal, parDonne, depart);

  // Une sauvegarde par table et par donne : une manche déjà inscrite ne se propose plus à la reprise.
  const [suivi] = useState(() => new StoreSuivi(`${idTable}:${donnes.length}`));
  const actif = suivi.actif;

  const [cameras, setCameras] = useState<InfoCamera[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [resolution, setResolution] = useState(1);
  const [annonce, setAnnonce] = useState<Annonce>({ preneur: prochaine[0], roiAppele: null });
  const [ratio, setRatio] = useState(16 / 9);
  const [message, setMessage] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => () => suivi.liberer(), [suivi]);
  useEffect(() => suivi.definirMeta({ noms: joueurs, annonce }), [suivi, joueurs, annonce]);
  useEffect(() => (video.current ? suivreProportions(video.current, setRatio) : undefined), []);

  const rafraichirCameras = useCallback(() => {
    listerCameras().then(setCameras).catch(() => setCameras([]));
  }, []);
  useEffect(rafraichirCameras, [rafraichirCameras]);

  async function demarrer() {
    setMessage(null);
    const reprise = suivi.reprisePrete;
    // Une reprise garde la table et l'entame de la manche sauvegardée ; sinon, celles de la donne en cours.
    const config: ConfigSuivi = reprise ? reprise.pipeline.suivi.config : { table: prochaine, entameInitiale: prochaine[1] };
    try {
      const r = RESOLUTIONS[resolution];
      const source = await preparerSource({ deviceId: deviceId || undefined, largeur: r.largeur, hauteur: r.hauteur, fps: 30, video: video.current! });
      const t = source.taille();
      if (t.largeur > 0) setRatio(t.largeur / t.hauteur);
      let detecteur;
      try {
        detecteur = await preparerDetecteur();
      } catch (e) {
        source.arreter();
        throw e;
      }
      suivi.demarrer({ source, detecteur, config, etatDepart: reprise?.pipeline });
      rafraichirCameras();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  const { etat, sortie } = suivi;
  const nbCartes = sortie?.cartesJouees.length ?? 0;
  const brouillonExistant = cartesEnCours.length > 0 || chienEnCours.length > 0;

  function reporter() {
    if (!sortie) return;
    t.modifierCartes(sortie.cartesJouees);
    t.modifierChien(sortie.chien);
    suivi.arreter();
    navigate(`/partie/${idTable}`);
  }
  // Le brouillon déjà noté à la main serait remplacé : on demande une confirmation en deux clics.
  const { enAttente: confirmerRemplacement, declencher: surReporter } = useConfirmation(reporter);

  return (
    <Page>
      <Header
        eyebrow={`Donne ${donnes.length + 1} · ${joueurs[prochaine[0]]} distribue · ${joueurs[prochaine[1]]} entame`}
        title="Suivi caméra"
        actions={
          <GhostButton
            onClick={() => {
              suivi.arreter();
              navigate(`/partie/${idTable}`);
            }}
          >
            Feuille
          </GhostButton>
        }
      />

      <div className="space-y-3">
        {(suivi.reprise || suivi.reprisePrete) && !actif && (
          <div className="rounded-xl border border-sky-500/50 bg-sky-950/30 p-3 text-sm text-sky-100" data-testid="reprise">
            {suivi.reprisePrete ? (
              <p>Manche sauvegardée prête ({resume(suivi.reprisePrete)}). Lancez le suivi : il reprend où il en était, sans recompter les cartes déjà sur la table.</p>
            ) : (
              <>
                <p>Cette donne était suivie le {new Date(suivi.reprise!.sauvegardeA).toLocaleString("fr-FR")} : {resume(suivi.reprise!)}.</p>
                <div className="mt-2 flex gap-2">
                  <Bouton
                    variante="plein"
                    data-testid="reprendre"
                    onClick={() => {
                      setAnnonce(suivi.reprise!.annonce);
                      suivi.choisirReprise();
                    }}
                  >
                    Reprendre
                  </Bouton>
                  <Bouton data-testid="oublier" onClick={suivi.oublierReprise}>L'oublier</Bouton>
                </div>
              </>
            )}
          </div>
        )}
        {suivi.info && <div role="status" className="rounded-xl border border-sky-500/40 bg-sky-950/30 p-3 text-xs text-sky-200" data-testid="info-moteur">{suivi.info}</div>}
        {message && <div role="alert" className="rounded-xl border border-rose-500/60 bg-rose-950/40 p-3 text-sm text-rose-200" data-testid="message-erreur">{message}</div>}
        {suivi.erreur && <div role="alert" className="rounded-xl border border-rose-500/60 bg-rose-950/40 p-3 text-sm text-rose-200" data-testid="erreur-boucle">{suivi.erreur}</div>}

        <Section titre="Caméra">
          <VideoZones ref={video} ratio={ratio} detections={suivi.image?.detections ?? []} />
          {suivi.image && (
            <p className="mt-1 font-mono text-[11px] text-slate-400" data-testid="fps">
              {suivi.image.fps.toFixed(1)} img/s · {suivi.image.dureeMs.toFixed(0)} ms{suivi.moteur ? ` · ${suivi.moteur}` : ""}
            </p>
          )}
          {!actif && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Champ libelle="Caméra">
                <select className={classeSelect} value={deviceId} onChange={(e) => setDeviceId(e.target.value)} data-testid="camera">
                  <option value="">Caméra par défaut</option>
                  {cameras.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
                </select>
              </Champ>
              <Champ libelle="Résolution">
                <select className={classeSelect} value={resolution} onChange={(e) => setResolution(Number(e.target.value))} data-testid="resolution">
                  {RESOLUTIONS.map((r, i) => <option key={r.libelle} value={i}>{r.libelle}</option>)}
                </select>
              </Champ>
            </div>
          )}
          <div className="mt-2 flex gap-2">
            {actif ? (
              <>
                <Bouton onClick={suivi.arreter} data-testid="arreter">Arrêter</Bouton>
                <Bouton onClick={suivi.pause} data-testid="pause">{suivi.statut === "pause" ? "Reprendre" : "Pause"}</Bouton>
                <Bouton onClick={suivi.reinitialiser} data-testid="nouvelle-manche">Repartir de zéro</Bouton>
              </>
            ) : (
              <Bouton variante="plein" onClick={demarrer} data-testid="demarrer">Démarrer le suivi</Bouton>
            )}
          </div>
        </Section>

        {etat ? (
          <>
            {etat.suivi.phase === "termine" && (
              <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/30 p-3 text-sm text-emerald-200" data-testid="fin-manche">
                Donne terminée : reportez les cartes dans la feuille pour inscrire la donne.
              </div>
            )}
            <PanneauPli etat={etat.suivi} noms={joueurs} onCorriger={suivi.corriger} />
            {actif && (
              <ActionsPli etat={etat.suivi} noms={joueurs} onAnnulerPli={suivi.annulerPli} onCorrigerIdentite={suivi.corrigerIdentite} onAjouterCarte={suivi.ajouterCarte} />
            )}
            <PanneauPiles etat={etat.suivi} noms={joueurs} annonce={annonce} onAnnonce={setAnnonce} />
            <PanneauAlertes alertes={etat.suivi.alertes} />
          </>
        ) : (
          <Section titre="Suivi">
            <p className="text-sm text-slate-400">Posez la caméra au-dessus du tapis, puis « Démarrer le suivi ». Les cartes sont reconnues à mesure qu'elles sont jouées.</p>
          </Section>
        )}
      </div>

      <Bar>
        <Cta disabled={!sortie || (nbCartes === 0 && sortie.chien.length === 0)} onClick={brouillonExistant ? surReporter : reporter} data-testid="reporter">
          {confirmerRemplacement
            ? "Confirmer : remplace les cartes déjà notées"
            : `Reporter dans la donne (${nbCartes} carte${nbCartes > 1 ? "s" : ""}${sortie && sortie.chien.length ? `, chien ${sortie.chien.length}` : ""})`}
        </Cta>
      </Bar>
    </Page>
  );
});
