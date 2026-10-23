import type { CarteVue, Zone, ZoneId } from "./types";

const contient = (z: Zone, x: number, y: number): boolean =>
  x >= z.x && x <= z.x + z.l && y >= z.y && y <= z.y + z.h;

/**
 * Zone dont une carte occupe l'emplacement : celle (chien ou écart) qui contient son centre ; si
 * plusieurs se chevauchent, la plus proche de leur propre centre ; sinon « table ».
 */
export function affecterZone(vue: CarteVue, zones: Zone[]): ZoneId {
  const candidates = zones.filter((z) => contient(z, vue.cx, vue.cy));
  if (candidates.length === 0) return "table";
  const distance = (z: Zone) => Math.hypot(vue.cx - (z.x + z.l / 2), vue.cy - (z.y + z.h / 2));
  return candidates.reduce((a, b) => (distance(b) < distance(a) ? b : a)).id;
}
