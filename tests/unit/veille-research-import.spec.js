// 06/10/2026 — lecture tolérante de la réponse d'une IA sur un concurrent
// (js/domain/veilleResearchImport.js). Module PUR (aucun import) : ces tests tournent directement
// sous Node, sans navigateur ni émulateur Firebase. Vérifiés une première fois hors du dépôt, via
// une copie du module, avant la livraison ; à reconfirmer au premier passage réel de la CI.

import { test, expect } from "@playwright/test";
import { parseCompetitorResearchResponse as parse, RESEARCH_JSON_TEMPLATE } from "../../js/domain/veilleResearchImport.js";

const NOW = new Date("2026-10-06T10:00:00Z");

test.describe("veilleResearchImport — parseCompetitorResearchResponse", () => {
  test("réponse complète, texte autour, marqueurs [n] retirés, notes composées", () => {
    const raw =
      'Voici :\n```json\n' +
      JSON.stringify({
        ca: "~12 M€ (2024)[1]",
        note: "Surveiller la traçabilité[2][3]",
        actualites: "Version 2026",
        resume: "Éditeur SaaS.\nSpécialiste.",
        forces: ["Ancienneté", "Réseau"],
        specialisation: 8.4,
        visibilite_roadmap: "3",
        site: "https://exemple.fr",
        linkedin: "pas une url",
        sources: [{ info: "CA", url: "https://pappers.fr/x" }, "autre source"],
      }) +
      "\n```\nFin.";
    const r = parse(raw, { now: NOW });
    expect(r.ok).toBe(true);
    expect(r.fields.ca).toBe("~12 M€ (2024)");
    expect(r.fields.competitorStrengths).toBe("- Ancienneté\n- Réseau");
    expect(r.fields.specializationScore).toBe(8);
    expect(r.fields.roadmapVisibilityScore).toBe(3);
    expect(r.fields.linkedinUrl).toBeUndefined();
    expect(r.fields.url).toBe("https://exemple.fr");
    expect(r.fields.notes).toBe(
      "Surveiller la traçabilité\n\nActualités récentes : Version 2026\n\nSources (recherche du 06/10/2026) :\n- CA — https://pappers.fr/x\n- autre source"
    );
    expect(r.missing).toContain("Faiblesses");
  });

  test("tolère retour à la ligne brut dans une chaîne, virgule finale, JSON sans bloc de code", () => {
    const r = parse('{\n"ca": "10 M€",\n"resume": "ligne1\nligne2",\n}', { now: NOW });
    expect(r.ok).toBe(true);
    expect(r.fields.profileSummary).toBe("ligne1\nligne2");
  });

  test("clés accentuées / casse / variante \"Force d'Agreo\"", () => {
    const r = parse('{"Opportunités":"a","MENACES":"b","Force d\'Agreo":"c"}', { now: NOW });
    expect(r.ok).toBe(true);
    expect(r.fields.opportunities).toBe("a");
    expect(r.fields.threats).toBe("b");
    expect(r.fields.agreoStrengths).toBe("c");
  });

  test("erreurs claires : pas de JSON, JSON cassé, champs inconnus, tout vide, racine tableau", () => {
    expect(parse("juste du texte").ok).toBe(false);
    expect(parse("{ca: 1").ok).toBe(false);
    expect(parse('{"foo":1}').ok).toBe(false);
    expect(parse('{"ca":"","note":""}').ok).toBe(false);
    expect(parse("[1,2]").ok).toBe(false);
  });

  test("le modèle fourni dans la demande est lui-même un JSON lisible", () => {
    const r = parse("```json\n" + RESEARCH_JSON_TEMPLATE + "\n```", { now: NOW });
    expect(r.ok).toBe(true);
  });
});
