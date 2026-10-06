// 06/10/2026 — "Voir ce qui a changé" de la Veille (js/domain/veilleDiff.js). Module PUR (aucun import) :
// ces tests tournent directement sous Node. Vérifiés une première fois hors du dépôt avant la livraison ; à
// reconfirmer au premier passage réel de la CI.

import { test, expect } from "@playwright/test";
import {
  cleanLines, packSnapshot, unpackSnapshot, diffLines, mergeAdded,
  SNAPSHOT_MAX_CHARS, ADDED_MAX_LINES, LINE_MAX_CHARS,
} from "../../js/domain/veilleDiff.js";

test.describe("veilleDiff", () => {
  test("cleanLines : espaces normalisés, lignes trop courtes retirées, lignes trop longues coupées", () => {
    const out = cleanLines(["  Titre   un ", "›", "ok", "", "x".repeat(LINE_MAX_CHARS + 50)]);
    expect(out[0]).toBe("Titre un");
    expect(out).toHaveLength(2);
    expect(out[1]).toHaveLength(LINE_MAX_CHARS);
    expect(out[1].endsWith("…")).toBe(true);
  });

  test("diffLines : ne renvoie que les lignes apparues, compte celles disparues", () => {
    const before = ["Article A", "Article B", "Article C"];
    const after = ["Article NEUF", "Article A", "Article C", "Autre nouveauté"];
    expect(diffLines(before, after)).toEqual({ added: ["Article NEUF", "Autre nouveauté"], removedCount: 1, truncatedAdded: 0 });
  });

  test("diffLines : pages identiques → rien ; doublons gérés ; ordre de la page conservé", () => {
    const same = ["Ligne un", "Ligne deux"];
    expect(diffLines(same, same)).toEqual({ added: [], removedCount: 0, truncatedAdded: 0 });
    expect(diffLines(["Pareil", "Pareil"], ["Pareil", "Pareil", "Pareil"]).added).toEqual(["Pareil"]);
    expect(diffLines([], ["Premier", "Deuxième", "Premier"]).added).toEqual(["Premier", "Deuxième"]);
  });

  test("diffLines : plafonné à ADDED_MAX_LINES, avec le nombre de lignes non listées", () => {
    const after = Array.from({ length: ADDED_MAX_LINES + 15 }, (_, i) => `Ligne numéro ${i}`);
    const d = diffLines([], after);
    expect(d.added).toHaveLength(ADDED_MAX_LINES);
    expect(d.truncatedAdded).toBe(15);
  });

  test("packSnapshot : coupe à une ligne entière sous la limite, et diffLines compare la version rognée", () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `Ligne longue numéro ${String(i).padStart(4, "0")} avec du texte`);
    const packed = packSnapshot(lines);
    expect(packed.length).toBeLessThanOrEqual(SNAPSHOT_MAX_CHARS);
    expect(packed.endsWith("\n")).toBe(false);
    const stored = unpackSnapshot(packed);
    expect(stored.length).toBeLessThan(lines.length);
    // Même page relue : rien ne doit "apparaître" juste parce que la fin n'avait pas été conservée.
    expect(diffLines(stored, lines).added).toEqual([]);
  });

  test("mergeAdded : cumule sans doublon, plafonné", () => {
    expect(mergeAdded(["A ligne", "B ligne"], ["B ligne", "C ligne"])).toEqual(["A ligne", "B ligne", "C ligne"]);
    expect(mergeAdded(null, ["Seule ligne"])).toEqual(["Seule ligne"]);
    expect(mergeAdded(Array.from({ length: 50 }, (_, i) => `a${i}xx`), Array.from({ length: 50 }, (_, i) => `b${i}xx`))).toHaveLength(ADDED_MAX_LINES);
  });

  test("unpackSnapshot : vide ou absent → []", () => {
    expect(unpackSnapshot("")).toEqual([]);
    expect(unpackSnapshot(undefined)).toEqual([]);
    expect(unpackSnapshot("a\n\nb")).toEqual(["a", "b"]);
  });
});
