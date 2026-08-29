/** Styles partagés par tous les écrans de l'application. */
export const CSS: string = `
@import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,500;6..96,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

.tarot {
  --feutre:#0C2620;
  --feutre-clair:#143A30;
  --feutre-trait:#1F4E42;
  --papier:#EFE6D5;
  --papier-actif:#E5DAC5;
  --papier-trait:#CFC0A4;
  --encre:#17211D;
  --ocre:#D9A02B;
  --brique:#B23A2F;
  --craie:#E4EDE7;
  --craie-terne:#8AA79C;
  --serif:'Bodoni Moda',Didot,Georgia,serif;
  --sans:'IBM Plex Sans',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,monospace;
  min-height:100vh;
  background:radial-gradient(120% 70% at 50% 0%, #16453A 0%, var(--feutre) 62%);
  color:var(--craie);font-family:var(--sans);-webkit-font-smoothing:antialiased;padding-bottom:96px;
}
.tarot *{box-sizing:border-box;}
.tarot button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit;}
.tarot :focus-visible{outline:2px solid var(--ocre);outline-offset:2px;border-radius:4px;}

.t-head{padding:22px 18px 12px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;}
.t-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--craie-terne);}
.t-title{font-family:var(--serif);font-size:30px;font-weight:700;line-height:1;margin:6px 0 0;letter-spacing:-.01em;}
.t-ghost{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--craie-terne);
  border:1px solid var(--feutre-trait);padding:7px 10px;border-radius:999px;white-space:nowrap;}

.t-tour{margin:0 12px 12px;border:1px solid var(--feutre-trait);border-left:2px solid var(--ocre);
  border-radius:2px;padding:11px 13px;background:rgba(0,0,0,.16);}
.t-tour dt{font-family:var(--mono);font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--craie-terne);}
.t-tour dd{margin:4px 0 0;font-size:13.5px;line-height:1.45;}
.t-tour dd.repos{color:var(--craie-terne);font-size:12.5px;margin-top:6px;}

.t-sheet{margin:0 12px;background:var(--papier);color:var(--encre);border-radius:3px;
  box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 14px 30px rgba(0,0,0,.38);overflow:hidden;}
.t-sheet-top{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;
  border-bottom:1px solid var(--papier-trait);}
.t-sheet-label{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#7A6E58;}
.t-toggle{display:flex;border:1px solid var(--papier-trait);border-radius:999px;overflow:hidden;}
.t-toggle button{font-family:var(--mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:5px 9px;color:#7A6E58;}
.t-toggle button[data-on="1"]{background:var(--encre);color:var(--papier);}

.t-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
.t-grid{border-collapse:collapse;table-layout:fixed;width:100%;}
.t-grid th,.t-grid td{border-left:1px solid var(--papier-trait);text-align:center;padding:0;min-width:62px;}
.t-grid th:first-child,.t-grid td:first-child{border-left:none;min-width:34px;width:34px;
  position:sticky;left:0;background:var(--papier);z-index:2;}
.t-row[data-open="1"] td:first-child{background:var(--papier-actif);}
.t-name{font-family:var(--sans);font-weight:600;font-size:12px;padding:9px 4px 3px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.t-total{font-family:var(--serif);font-weight:700;font-size:21px;line-height:1;padding:0 2px 10px;letter-spacing:-.02em;}
.t-total[data-neg="1"]{color:var(--brique);}
.t-headrow{border-bottom:2px solid var(--encre);}
.t-cell{font-family:var(--mono);font-size:13px;padding:10px 2px;position:relative;}
.t-cell[data-neg="1"]{color:var(--brique);}
.t-cell[data-repos="1"]{color:#BCAE93;}
.t-cell[data-preneur="1"]::before{content:"◆";position:absolute;left:4px;top:10px;font-size:7px;color:var(--ocre);}
.t-num{font-family:var(--mono);font-size:11px;color:#9A8C72;}
.t-row{border-top:1px solid var(--papier-trait);}
.t-row[data-open="1"]{background:var(--papier-actif);}

.t-detail{border-top:2px solid var(--encre);background:var(--papier-actif);padding:12px;}
.t-detail-line{font-family:var(--mono);font-size:11px;color:#5F5544;line-height:1.65;}
.t-del{margin-top:9px;font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--brique);border:1px solid rgba(178,58,47,.4);padding:6px 10px;border-radius:999px;}

.t-empty{padding:34px 20px;text-align:center;}
.t-empty p{font-family:var(--serif);font-size:17px;margin:0 0 6px;}
.t-empty span{font-family:var(--mono);font-size:11px;color:#7A6E58;}

.t-classement{margin:16px 12px 0;}
.t-cl-row{display:flex;align-items:baseline;gap:10px;padding:9px 2px;border-bottom:1px solid var(--feutre-trait);}
.t-cl-rang{font-family:var(--mono);font-size:10px;color:var(--craie-terne);width:16px;}
.t-cl-nom{flex:1;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.t-cl-donnes{font-family:var(--mono);font-size:10px;color:var(--craie-terne);}
.t-cl-pts{font-family:var(--serif);font-size:19px;font-weight:700;min-width:56px;text-align:right;}
.t-cl-pts[data-neg="1"]{color:var(--brique);}

.t-petitsec{margin:0 12px 12px;}
.t-petitsec > .t-lien{margin:0;}
.t-petitsec-panel{border:1px solid var(--feutre-trait);border-left:2px solid var(--brique);
  border-radius:2px;padding:13px;background:rgba(178,58,47,.08);}
.t-petitsec-note{font-size:12px;line-height:1.55;color:var(--craie-terne);margin:6px 0 12px;}
.t-journal{margin:16px 12px 0;}
.t-journal-line{font-family:var(--mono);font-size:11px;color:var(--craie-terne);line-height:1.75;}

.t-misere-entree{border:1px solid var(--feutre-trait);border-radius:2px;padding:11px;
  margin-bottom:8px;background:rgba(0,0,0,.14);}
.t-misere-ajouter{border:1px dashed var(--feutre-trait);padding:10px 13px;border-radius:2px;
  font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--craie-terne);width:100%;text-align:center;}
.t-misere-retirer{margin-top:8px;font-family:var(--mono);font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--brique);}

.t-bar{position:fixed;left:0;right:0;bottom:0;padding:12px 12px calc(12px + env(safe-area-inset-bottom));
  background:linear-gradient(to top,var(--feutre) 62%,rgba(12,38,32,0));}
.t-cta{width:100%;padding:15px;border-radius:2px;background:var(--ocre);color:#231803;
  font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;}
.t-cta:disabled{opacity:.35;cursor:not-allowed;}

.t-modal{position:fixed;inset:0;background:rgba(6,20,17,.72);z-index:40;display:flex;align-items:flex-end;justify-content:center;}
.t-panel{width:100%;max-width:520px;max-height:94vh;overflow-y:auto;background:var(--feutre-clair);
  border-top:2px solid var(--ocre);border-radius:14px 14px 0 0;padding:18px 16px calc(180px + env(safe-area-inset-bottom));}
.t-panel-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.t-panel-title{font-family:var(--serif);font-size:22px;font-weight:700;}
.t-close{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--craie-terne);}

.t-field{margin-bottom:18px;}
.t-label{font-family:var(--mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--craie-terne);margin-bottom:8px;display:flex;justify-content:space-between;gap:8px;}
.t-label em{font-style:normal;color:var(--ocre);}
.t-chips{display:flex;flex-wrap:wrap;gap:7px;}
.t-chip{padding:10px 13px;border:1px solid var(--feutre-trait);border-radius:2px;font-size:13px;
  background:rgba(0,0,0,.16);color:var(--craie);transition:.12s;}
.t-chip[data-on="1"]{background:var(--ocre);border-color:var(--ocre);color:#231803;font-weight:600;}
.t-chip[data-repos="1"]{opacity:.42;}
.t-chip small{display:block;font-family:var(--mono);font-size:9px;opacity:.65;letter-spacing:.06em;margin-top:2px;}

.t-points{display:flex;align-items:center;gap:10px;}
.t-step{width:46px;height:46px;border:1px solid var(--feutre-trait);border-radius:2px;font-size:19px;background:rgba(0,0,0,.16);}
.t-points-val{flex:1;text-align:center;}
.t-points-val b{font-family:var(--serif);font-size:34px;font-weight:700;letter-spacing:-.02em;}
.t-points-val span{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.1em;color:var(--craie-terne);}
.t-range{width:100%;margin-top:12px;accent-color:var(--ocre);}
.t-goal{font-family:var(--mono);font-size:11px;margin-top:8px;text-align:center;}
.t-goal[data-ok="1"]{color:var(--ocre);}
.t-goal[data-ok="0"]{color:var(--brique);}

.t-preview{position:fixed;left:0;right:0;bottom:0;max-width:520px;margin:0 auto;background:var(--feutre);
  border-top:1px solid var(--feutre-trait);padding:12px 16px calc(12px + env(safe-area-inset-bottom));}
.t-preview-line{font-family:var(--mono);font-size:11px;color:var(--craie-terne);margin-bottom:9px;
  display:flex;justify-content:space-between;gap:10px;}
.t-preview-line b{color:var(--craie);font-weight:500;}

.t-setup{padding:0 18px;}
.t-input{width:100%;padding:12px 14px;background:rgba(0,0,0,.2);border:1px solid var(--feutre-trait);
  border-radius:2px;color:var(--craie);font-size:15px;font-family:var(--sans);user-select:text;}
.t-input::placeholder{color:#5E7A70;}
.t-players{display:flex;flex-direction:column;gap:8px;}
.t-count{display:flex;align-items:center;gap:14px;}
.t-count b{font-family:var(--serif);font-size:30px;font-weight:700;min-width:34px;text-align:center;}
.t-count span{font-size:12px;color:var(--craie-terne);line-height:1.4;}
.t-rules{margin:26px 12px 0;border-top:1px solid var(--feutre-trait);padding-top:14px;}
.t-rules summary{font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--craie-terne);cursor:pointer;}
.t-rules p{font-size:12.5px;line-height:1.65;color:var(--craie-terne);margin:12px 0 0;}
.t-rules code{font-family:var(--mono);color:var(--ocre);font-size:12px;}

.t-tour dd b{font-weight:600;color:var(--craie);}
.t-tirage{padding:0 18px;}
.t-intro{font-size:13px;line-height:1.6;color:var(--craie-terne);margin:0 0 18px;}
.t-carte{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;
  border:1px solid var(--feutre-trait);border-radius:2px;margin-bottom:7px;background:rgba(0,0,0,.16);}
.t-carte[data-min="1"]{border-color:var(--ocre);background:rgba(217,160,43,.12);}
.t-carte-nom{font-size:14px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.t-carte-val{font-family:var(--serif);font-size:23px;font-weight:700;color:var(--ocre);line-height:1;text-align:right;}
.t-carte-val small{display:block;font-family:var(--mono);font-size:9px;font-weight:400;
  letter-spacing:.1em;text-transform:uppercase;color:var(--craie-terne);margin-top:3px;}
.t-excuse{font-family:var(--mono);font-size:11px;color:var(--ocre);margin:10px 0 0;line-height:1.5;}
.t-resultat{margin-top:20px;border-top:1px solid var(--feutre-trait);padding-top:16px;}
.t-resultat p{margin:0;font-family:var(--serif);font-size:20px;line-height:1.4;}
.t-resultat span{display:block;font-family:var(--mono);font-size:11px;color:var(--craie-terne);margin-top:8px;line-height:1.6;}
.t-lien{margin-top:16px;font-family:var(--mono);font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--craie-terne);text-decoration:underline;text-underline-offset:4px;}

.t-head-actions{display:flex;gap:8px;flex-shrink:0;}
.t-champ-nom{position:relative;cursor:grab;user-select:none;}
.t-champ-nom[data-drag="1"]{opacity:.5;cursor:grabbing;}
.t-erreur{font-family:var(--mono);font-size:10px;color:var(--brique);margin:5px 2px 0;}
.t-suggestions{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}

.t-roster-row{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:13px 2px;border-bottom:1px solid var(--feutre-trait);flex-wrap:wrap;}
.t-roster-nom{display:flex;flex-direction:column;gap:3px;}
.t-roster-nom span{font-size:15px;}
.t-roster-nom small{font-family:var(--mono);font-size:10px;color:var(--craie-terne);}
.t-roster-actions{display:flex;gap:16px;}
.t-roster-renommer{width:100%;}
.t-roster-fusion{width:100%;}
.t-suggestion{padding:6px 10px;border:1px solid var(--feutre-trait);border-radius:999px;
  font-family:var(--mono);font-size:11px;background:rgba(217,160,43,.14);color:var(--ocre);}

.t-archive-row{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;
  text-align:left;padding:12px 2px;border-bottom:1px solid var(--feutre-trait);}
.t-archive-date{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--craie-terne);}
.t-archive-joueurs{display:block;font-size:13.5px;margin-top:3px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;max-width:210px;}
.t-archive-droite{text-align:right;flex-shrink:0;}
.t-archive-donnes{display:block;font-family:var(--mono);font-size:10px;color:var(--craie-terne);}
.t-archive-meneur{display:block;font-family:var(--serif);font-size:15px;font-weight:700;
  margin-top:2px;color:var(--ocre);}

@media (prefers-reduced-motion:reduce){.tarot *{transition:none!important;}}
`;
