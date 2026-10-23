import { describe, it, expect } from "vitest";
import { ErreurCamera, traduireErreurCamera } from "@/vision/lib/camera";

const erreur = (name: string) => Object.assign(new Error("x"), { name });

describe("traduireErreurCamera", () => {
  it.each([
    ["NotAllowedError", "refusee"],
    ["SecurityError", "refusee"],
    ["NotFoundError", "introuvable"],
    ["DevicesNotFoundError", "introuvable"],
    ["NotReadableError", "occupee"],
    ["OverconstrainedError", "contrainte"],
    ["Truc", "inconnue"],
  ])("%s → %s", (nom, code) => {
    const e = traduireErreurCamera(erreur(nom));
    expect(e).toBeInstanceOf(ErreurCamera);
    expect(e.code).toBe(code);
    expect(e.message.length).toBeGreaterThan(20);
  });

  it("garde une ErreurCamera telle quelle et accepte une valeur quelconque", () => {
    const e = new ErreurCamera("indisponible", "HTTPS");
    expect(traduireErreurCamera(e)).toBe(e);
    expect(traduireErreurCamera("bizarre").code).toBe("inconnue");
  });

  it("explique le refus d'autorisation en français", () => {
    expect(traduireErreurCamera(erreur("NotAllowedError")).message).toMatch(/refusé/);
  });
});
