// 08/10/2026 — classement des prompts par une IA (js/domain/promptsClassify.js). Modules PURS : ces tests
// tournent directement sous Node. Vérifiés une première fois hors du dépôt avant la livraison ; à reconfirmer
// au premier passage réel de la CI.

import { test, expect } from "@playwright/test";
import { buildClassifyRequest, parseClassifyResponse, keyFor, MAX_TAGS_PER_PROMPT } from "../../js/domain/promptsClassify.js";

const KEYS = ["P1", "P2", "P3", "P4"];

test.describe("promptsClassify — demande", () => {
  test("liste chaque prompt avec sa clé, tronque la description, mentionne les tags existants", () => {
    const text = buildClassifyRequest(
      [{ title: "Notes Zendesk", description: "Transforme des notes" }, { title: "  Coach   SMART ", description: "x".repeat(400) }, { title: "Sans description" }],
      ["management", "communication"]
    );
    expect(text).toContain("P1 — Notes Zendesk — Transforme des notes");
    expect(text).toContain("P2 — Coach SMART — ");
    expect(text).toContain("…");
    expect(text).toContain("P3 — Sans description\n");
    expect(text).toContain("#management, #communication");
    expect(text).toContain('"cle": "P1"');
    expect(text).toContain("3 prompts");
  });
  test("sans tag existant : pas de ligne « Tags déjà utilisés »", () => {
    expect(buildClassifyRequest([{ title: "A titre" }], [])).not.toContain("Tags déjà utilisés");
    expect(keyFor(0)).toBe("P1");
  });
});

test.describe("promptsClassify — réponse", () => {
  test("bloc JSON avec texte autour : tags nettoyés (#, casse, doublons, plafond)", () => {
    const raw = 'Voilà :\n```json\n{"classement":[{"cle":"P1","tags":["#Communication"," zendesk ","communication","a","b"]},{"cle":"p2","tags":"rh, management"}]}\n```\nBon courage';
    const r = parseClassifyResponse(raw, KEYS);
    expect(r.ok).toBe(true);
    expect(r.assignments[0]).toEqual({ key: "P1", tags: ["communication", "zendesk", "a"] });
    expect(r.assignments[0].tags).toHaveLength(MAX_TAGS_PER_PROMPT);
    expect(r.assignments[1]).toEqual({ key: "P2", tags: ["rh", "management"] });
    expect(r.missingKeys).toEqual(["P3", "P4"]);
    expect(r.unknownKeys).toEqual([]);
  });
  test("clés inconnues ignorées et signalées ; entrées sans tag non comptées", () => {
    const r = parseClassifyResponse('{"classement":[{"cle":"P9","tags":["x"]},{"cle":"P1","tags":[]},{"cle":"P3","tags":["ok"]}]}', KEYS);
    expect(r.ok).toBe(true);
    expect(r.assignments).toEqual([{ key: "P3", tags: ["ok"] }]);
    expect(r.unknownKeys).toEqual(["P9"]);
    expect(r.missingKeys).toEqual(["P1", "P2", "P4"]);
  });
  test("formes tolérées : tableau seul, alias de clés, objet { P1: [...] }, JSON légèrement cassé", () => {
    expect(parseClassifyResponse('[{"id":"P2","tags":["a"]}]', KEYS).assignments).toEqual([{ key: "P2", tags: ["a"] }]);
    expect(parseClassifyResponse('{"classification":[{"key":"P1","tags":["b"]}]}', KEYS).ok).toBe(true);
    expect(parseClassifyResponse('{"P1":["x","y"],"P4":"z"}', KEYS).assignments).toEqual([{ key: "P1", tags: ["x", "y"] }, { key: "P4", tags: ["z"] }]);
    expect(parseClassifyResponse('{"classement":[{"cle":"P1","tags":["a","b",],},]}', KEYS).ok).toBe(true);
  });
  test("erreurs lisibles : pas de JSON, JSON cassé, mauvaise forme, aucun classement", () => {
    for (const bad of ["bla bla", '{"classement": [ {"cle": ', '{"autre": 1}', '{"classement":[{"cle":"P9","tags":["x"]}]}']) {
      const r = parseClassifyResponse(bad, KEYS);
      expect(r.ok, bad).toBe(false);
      expect(r.error.length).toBeGreaterThan(20);
    }
  });
  test("doublon d'une même clé : tags fusionnés", () => {
    const r = parseClassifyResponse('{"classement":[{"cle":"P1","tags":["a"]},{"cle":"P1","tags":["b","a"]}]}', KEYS);
    expect(r.assignments).toEqual([{ key: "P1", tags: ["a", "b"] }]);
  });
});
