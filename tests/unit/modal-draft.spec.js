// 14/10/2026 — brouillons automatiques des fenêtres (js/components/modalDraft.js, js/services/draftStore.js).
// Seules les parties PURES sont testées ici (sous Node, sans DOM) : règle "effacer ou garder le brouillon",
// clé de brouillon, purge des brouillons anciens. Le comportement dans une vraie fenêtre (frappe, fermeture,
// réouverture, bandeau) a été vérifié à part dans un navigateur headless avant la livraison ; à reconfirmer
// au premier passage réel de la CI.

import { test, expect } from "@playwright/test";
import { shouldClearDraft, modalDraftKey, MODAL_DRAFT_PREFIX } from "../../js/components/modalDraft.js";
import { pruneDrafts, saveDraft, getDraft } from "../../js/services/draftStore.js";

function installFakeLocalStorage() {
  const data = new Map();
  globalThis.localStorage = {
    get length() { return data.size; },
    key: (i) => Array.from(data.keys())[i] ?? null,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
  return data;
}

test.describe("shouldClearDraft", () => {
  test("une validation efface le brouillon", () => {
    for (const label of ["Enregistrer", "Créer", "Ajouter", "✅ Appliquer", "Valider", "Envoyer", "Mettre à jour"]) {
      expect(shouldClearDraft({ label, variant: "primary" }), label).toBe(true);
    }
    expect(shouldClearDraft({ label: "Enregistrer", variant: "ghost" })).toBe(true); // libellé prioritaire sur la variante
  });

  test("Annuler efface explicitement, Fermer / Retour / Plus tard conservent", () => {
    expect(shouldClearDraft({ label: "Annuler", variant: "ghost" })).toBe(true);
    for (const label of ["Fermer", "← Retour", "Plus tard", "Non"]) {
      expect(shouldClearDraft({ label, variant: "ghost" }), label).toBe(false);
      expect(shouldClearDraft({ label, variant: "primary" }), label).toBe(false); // le libellé "garder" l'emporte
    }
  });

  test("libellé neutre : seule une variante primary/danger valide, le reste conserve", () => {
    expect(shouldClearDraft({ label: "Suivi", variant: "primary" })).toBe(true);
    expect(shouldClearDraft({ label: "Suivi", variant: "secondary" })).toBe(false);
    expect(shouldClearDraft({ label: "Suivi" })).toBe(false);
    expect(shouldClearDraft()).toBe(false);
  });
});

test.describe("modalDraftKey", () => {
  test("écran + titre, sans les paramètres du hash", () => {
    expect(modalDraftKey("Nouvelle tâche", "#/dashboard?open=task:1")).toBe(`${MODAL_DRAFT_PREFIX}#/dashboard|Nouvelle tâche`);
    expect(modalDraftKey("X", "")).toBe(`${MODAL_DRAFT_PREFIX}|X`);
  });
});

test.describe("pruneDrafts", () => {
  test("supprime les brouillons trop anciens de la famille demandée, jamais les autres", () => {
    const data = installFakeLocalStorage();
    const now = 1_000_000_000_000;
    const day = 24 * 60 * 60 * 1000;
    data.set("pilotage-draft:modal:#/a|vieux", JSON.stringify({ fields: {}, savedAt: now - 8 * day }));
    data.set("pilotage-draft:modal:#/a|recent", JSON.stringify({ fields: {}, savedAt: now - 1 * day }));
    data.set("pilotage-draft:modal:#/a|illisible", "pas du json");
    data.set("pilotage-draft:capture", JSON.stringify({ value: "x", savedAt: now - 30 * day }));
    data.set("autre-cle", "garde");
    pruneDrafts("modal:", 7 * day, now);
    expect(data.has("pilotage-draft:modal:#/a|vieux")).toBe(false);
    expect(data.has("pilotage-draft:modal:#/a|illisible")).toBe(false);
    expect(data.has("pilotage-draft:modal:#/a|recent")).toBe(true);
    expect(data.has("pilotage-draft:capture")).toBe(true); // autre famille : intacte
    expect(data.has("autre-cle")).toBe(true);
  });

  test("saveDraft / getDraft restent compatibles (capture rapide)", () => {
    installFakeLocalStorage();
    saveDraft("capture", { value: "abc" });
    expect(getDraft("capture").value).toBe("abc");
  });
});
