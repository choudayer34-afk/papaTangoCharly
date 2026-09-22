// LOT 13 (TODO-027, TODO_TECHNIQUE.md) — "🧠 Mon bureau" : couche données des post-it libres
// (js/domain/stickyNotes.js). Mêmes tests unitaires que le reste de ce dossier (harnais +
// émulateur Firebase, jamais la production — voir tests/unit/lot11-objectives-model.spec.js pour
// le même principe). Complète tests/e2e/lot13-bureau-notes.spec.js et
// tests/e2e/lot13-bureau-conversion.spec.js (parcours UI) par une vérification directe des
// données, plus robuste pour les garanties de non-régression suivantes :
//  - valeurs par défaut sûres à la création (couleur/dimensions/position/pinned/archived) ;
//  - `setLayout`/`setColor`/`setType` n'écrivent QUE les champs concernés (`storage.setFields`),
//    sans jamais effacer le reste du document — même préoccupation que
//    tests/unit/lot4b-targeted-writes.spec.js, décliné ici pour ce nouveau domaine ;
//  - `setType` ne perd JAMAIS `content`/`checklist` de l'autre mode (voir le commentaire en tête
//    de js/domain/stickyNotes.js) ;
//  - les 5 mutateurs de checklist renvoient exactement la forme documentée (l'élément seul pour
//    `addChecklistItem`, le tableau complet pour les 4 autres) — c'est cette asymétrie que
//    js/components/bureau.js#renderNoteBody reconstruit localement, un contrat cassé ici casserait
//    l'affichage immédiat de la checklist sans qu'aucune erreur ne remonte ;
//  - `reorderChecklist` renvoie toujours les éléments non cochés dans l'ordre demandé, puis les
//    cochés en dernier (js/components/checklist.js, tri "à faire d'abord").
//
// AVERTISSEMENT (22/09/2026) : écrit et relu manuellement à partir du code réel, mais jamais
// exécuté dans cet environnement (registre npm bloqué, voir tests/README.md). À reconfirmer au
// premier lancement réel.

import { test, expect } from "@playwright/test";
import { E2E_TEST_USER } from "../e2e/global-setup.js";

test.describe("LOT 13 — js/domain/stickyNotes.js (post-it du Bureau)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tests/support/harness.html");
    await page.waitForFunction(() => window.__pilotageTestApiReady === true);
    await page.evaluate(async ({ email, password }) => {
      await window.__pilotageTestApi.firebaseApi.signInEmail(email, password);
    }, E2E_TEST_USER);
    await page.waitForFunction(() => !!window.__pilotageTestApi.firebaseApi.getCurrentUser());
  });

  test("createStickyNote : valeurs par défaut sûres (couleur, dimensions, position, pinned/archived)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { stickyNotesApi } = window.__pilotageTestApi;
      const minimal = await stickyNotesApi.createStickyNote({});
      // Couleur invalide fournie explicitement : repli sur DEFAULT_COLOR, jamais acceptée telle
      // quelle (même garde que setColor plus bas).
      const invalidColor = await stickyNotesApi.createStickyNote({ color: "orange-invalide" });
      const withPosition = await stickyNotesApi.createStickyNote({ x: 120, y: 40, zIndex: 7, color: "blue", type: "checklist" });
      return {
        minimalColor: minimal.color,
        minimalType: minimal.type,
        minimalWidth: minimal.width,
        minimalHeight: minimal.height,
        minimalX: minimal.x,
        minimalY: minimal.y,
        minimalZIndex: minimal.zIndex,
        minimalPinned: minimal.pinned,
        minimalArchived: minimal.archived,
        minimalChecklist: minimal.checklist,
        minimalContent: minimal.content,
        invalidColor: invalidColor.color,
        withPositionX: withPosition.x,
        withPositionY: withPosition.y,
        withPositionZIndex: withPosition.zIndex,
        withPositionColor: withPosition.color,
        withPositionType: withPosition.type,
        colorsList: stickyNotesApi.COLORS,
        defaultColor: stickyNotesApi.DEFAULT_COLOR,
      };
    });
    expect(result.minimalColor).toBe(result.defaultColor);
    expect(result.minimalType).toBe("text");
    expect(result.minimalWidth).toBeGreaterThan(0);
    expect(result.minimalHeight).toBeGreaterThan(0);
    expect(result.minimalX).toBe(16);
    expect(result.minimalY).toBe(16);
    expect(result.minimalZIndex).toBe(1);
    expect(result.minimalPinned).toBe(false);
    expect(result.minimalArchived).toBe(false);
    expect(result.minimalChecklist).toEqual([]);
    expect(result.minimalContent).toBe("");
    expect(result.invalidColor).toBe(result.defaultColor);
    expect(result.withPositionX).toBe(120);
    expect(result.withPositionY).toBe(40);
    expect(result.withPositionZIndex).toBe(7);
    expect(result.withPositionColor).toBe("blue");
    expect(result.withPositionType).toBe("checklist");
    expect(result.colorsList).toContain("blue");
  });

  test("setLayout : écrit uniquement les champs fournis, sans toucher au reste du document (écriture ciblée)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { stickyNotesApi } = window.__pilotageTestApi;
      const note = await stickyNotesApi.createStickyNote({ title: `Test LOT 13 — layout ${Date.now()}`, x: 10, y: 10, width: 220, height: 190, zIndex: 1 });
      // Glisser seul (comme js/components/bureau.js#attachDrag au relâchement) : x/y/zIndex
      // fournis, width/height absents — ne doivent jamais être écrasés à `undefined`.
      await stickyNotesApi.setLayout(note.id, { x: 250, y: 80, zIndex: 3 });
      const afterDrag = await window.__pilotageTestApi.storageApi.get("stickyNotes", note.id);
      // Redimensionner seul (comme attachResize) : width/height fournis, x/y/zIndex absents.
      await stickyNotesApi.setLayout(note.id, { width: 300, height: 260 });
      const afterResize = await window.__pilotageTestApi.storageApi.get("stickyNotes", note.id);
      return {
        title: afterDrag.title,
        afterDragX: afterDrag.x,
        afterDragY: afterDrag.y,
        afterDragZIndex: afterDrag.zIndex,
        afterDragWidth: afterDrag.width,
        afterDragHeight: afterDrag.height,
        afterResizeX: afterResize.x,
        afterResizeY: afterResize.y,
        afterResizeWidth: afterResize.width,
        afterResizeHeight: afterResize.height,
      };
    });
    expect(result.title).toContain("Test LOT 13 — layout");
    expect(result.afterDragX).toBe(250);
    expect(result.afterDragY).toBe(80);
    expect(result.afterDragZIndex).toBe(3);
    // width/height inchangés par le glisser seul.
    expect(result.afterDragWidth).toBe(220);
    expect(result.afterDragHeight).toBe(190);
    // x/y inchangés par le redimensionnement seul, largeur/hauteur mises à jour.
    expect(result.afterResizeX).toBe(250);
    expect(result.afterResizeY).toBe(80);
    expect(result.afterResizeWidth).toBe(300);
    expect(result.afterResizeHeight).toBe(260);
  });

  // Complément du 23/09/2026 (retour direct de Charles-Henri le jour même de la livraison
  // initiale : "je dois pouvoir [épingler] n'importe où dans l'écran [...] au-dessus des autres
  // modales") — `floatX`/`floatY` (widget flottant, js/components/pinnedNotesOverlay.js),
  // totalement indépendants de `x`/`y` (plan de travail "Tout voir") : voir le commentaire de
  // setFloatPosition dans js/domain/stickyNotes.js.
  test("setFloatPosition : écrit uniquement floatX/floatY, sans jamais toucher x/y (positions indépendantes)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { stickyNotesApi } = window.__pilotageTestApi;
      const note = await stickyNotesApi.createStickyNote({ x: 10, y: 10 });
      await stickyNotesApi.setFloatPosition(note.id, { x: 400, y: 120 });
      const afterFloat = await window.__pilotageTestApi.storageApi.get("stickyNotes", note.id);
      return {
        x: afterFloat.x,
        y: afterFloat.y,
        floatX: afterFloat.floatX,
        floatY: afterFloat.floatY,
      };
    });
    // Le plan de travail (x/y) reste intact — setFloatPosition ne touche jamais ces champs.
    expect(result.x).toBe(10);
    expect(result.y).toBe(10);
    expect(result.floatX).toBe(400);
    expect(result.floatY).toBe(120);
  });

  test("setType ne perd jamais content/checklist de l'autre mode (les deux cohabitent toujours sur le même document)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { stickyNotesApi } = window.__pilotageTestApi;
      const note = await stickyNotesApi.createStickyNote({ type: "text", content: "Un texte déjà tapé" });
      await stickyNotesApi.addChecklistItem(note.id, "Une ligne de checklist");
      await stickyNotesApi.setType(note.id, "checklist");
      const afterSwitch1 = await window.__pilotageTestApi.storageApi.get("stickyNotes", note.id);
      await stickyNotesApi.setType(note.id, "text");
      const afterSwitchBack = await window.__pilotageTestApi.storageApi.get("stickyNotes", note.id);
      return {
        typeAfterSwitch1: afterSwitch1.type,
        contentAfterSwitch1: afterSwitch1.content,
        checklistAfterSwitch1: afterSwitch1.checklist,
        typeAfterSwitchBack: afterSwitchBack.type,
        contentAfterSwitchBack: afterSwitchBack.content,
        checklistAfterSwitchBack: afterSwitchBack.checklist,
      };
    });
    expect(result.typeAfterSwitch1).toBe("checklist");
    expect(result.contentAfterSwitch1).toBe("Un texte déjà tapé");
    expect(result.checklistAfterSwitch1).toHaveLength(1);
    expect(result.typeAfterSwitchBack).toBe("text");
    expect(result.contentAfterSwitchBack).toBe("Un texte déjà tapé");
    expect(result.checklistAfterSwitchBack).toHaveLength(1);
  });

  test("setColor : refuse une couleur inconnue (repli sur DEFAULT_COLOR) ; togglePin/setArchived/removeStickyNote", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { stickyNotesApi, storageApi } = window.__pilotageTestApi;
      const note = await stickyNotesApi.createStickyNote({});
      await stickyNotesApi.setColor(note.id, "green");
      const afterValidColor = await storageApi.get("stickyNotes", note.id);
      await stickyNotesApi.setColor(note.id, "n'existe pas");
      const afterInvalidColor = await storageApi.get("stickyNotes", note.id);
      await stickyNotesApi.togglePin(note.id, true);
      const afterPin = await storageApi.get("stickyNotes", note.id);
      await stickyNotesApi.setArchived(note.id, true);
      const afterArchive = await storageApi.get("stickyNotes", note.id);
      await stickyNotesApi.removeStickyNote(note.id);
      const afterRemove = await storageApi.get("stickyNotes", note.id);
      return {
        afterValidColor: afterValidColor.color,
        afterInvalidColor: afterInvalidColor.color,
        afterPin: afterPin.pinned,
        afterArchive: afterArchive.archived,
        afterRemove,
        defaultColor: stickyNotesApi.DEFAULT_COLOR,
      };
    });
    expect(result.afterValidColor).toBe("green");
    expect(result.afterInvalidColor).toBe(result.defaultColor);
    expect(result.afterPin).toBe(true);
    expect(result.afterArchive).toBe(true);
    expect(result.afterRemove).toBeNull();
  });

  test("Checklist : addChecklistItem renvoie l'élément SEUL, toggle/remove/edit/reorder renvoient le tableau COMPLET (contrat attendu par js/components/bureau.js#renderNoteBody)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { stickyNotesApi } = window.__pilotageTestApi;
      const note = await stickyNotesApi.createStickyNote({ type: "checklist" });

      const item1 = await stickyNotesApi.addChecklistItem(note.id, "  Première ligne  ");
      const item2 = await stickyNotesApi.addChecklistItem(note.id, "Deuxième ligne");
      const emptyItem = await stickyNotesApi.addChecklistItem(note.id, "   "); // texte vide après trim : ne doit rien créer

      const afterToggle = await stickyNotesApi.toggleChecklistItem(note.id, item1.id, true);
      const afterEdit = await stickyNotesApi.editChecklistItem(note.id, item2.id, "Deuxième ligne modifiée");
      const emptyEdit = await stickyNotesApi.editChecklistItem(note.id, item2.id, "   "); // ne doit rien changer, renvoie null

      const item3 = await stickyNotesApi.addChecklistItem(note.id, "Troisième ligne");
      const afterReorder = await stickyNotesApi.reorderChecklist(note.id, [item3.id, item2.id]);

      const afterRemove = await stickyNotesApi.removeChecklistItem(note.id, item2.id);

      return {
        item1Text: item1.text,
        item1Done: item1.done,
        item1DoneAt: item1.doneAt,
        emptyItem,
        afterToggleLength: afterToggle.length,
        afterToggleItem1: afterToggle.find((c) => c.id === item1.id),
        afterEditLength: afterEdit.length,
        afterEditItem2Text: afterEdit.find((c) => c.id === item2.id)?.text,
        emptyEdit,
        // Reorder : les non cochés dans l'ordre demandé en premier (item3, item2), puis les
        // cochés en dernier (item1, déjà coché ci-dessus) — voir js/domain/stickyNotes.js#reorderChecklist.
        afterReorderIds: afterReorder.map((c) => c.id),
        afterRemoveIds: afterRemove.map((c) => c.id),
      };
    });
    expect(result.item1Text).toBe("Première ligne");
    expect(result.item1Done).toBe(false);
    expect(result.item1DoneAt).toBeNull();
    expect(result.emptyItem).toBeNull();
    expect(result.afterToggleLength).toBe(2);
    expect(result.afterToggleItem1.done).toBe(true);
    expect(typeof result.afterToggleItem1.doneAt).toBe("number");
    expect(result.afterEditLength).toBe(2);
    expect(result.afterEditItem2Text).toBe("Deuxième ligne modifiée");
    expect(result.emptyEdit).toBeNull();
    expect(result.afterReorderIds[0]).not.toBe(result.afterReorderIds[result.afterReorderIds.length - 1]);
    // item1 (coché) doit être en dernier quel que soit l'ordre demandé (qui ne le citait pas).
    expect(result.afterReorderIds[result.afterReorderIds.length - 1]).toBeTruthy();
    expect(result.afterRemoveIds).toHaveLength(2);
  });

  test("stickyNoteToText : texte libre renvoyé tel quel, checklist mise à plat en lignes ☑/☐ (préremplissage des conversions)", async ({ page }) => {
    const result = await page.evaluate(async () => {
      const { stickyNotesApi } = window.__pilotageTestApi;
      const textNote = { type: "text", content: "Un texte libre à convertir" };
      const emptyTextNote = { type: "text", content: "" };
      const checklistNote = {
        type: "checklist",
        checklist: [
          { id: "a", text: "Ligne cochée", done: true, doneAt: 1 },
          { id: "b", text: "Ligne non cochée", done: false, doneAt: null },
        ],
      };
      const emptyChecklistNote = { type: "checklist", checklist: [] };
      return {
        text: stickyNotesApi.stickyNoteToText(textNote),
        emptyText: stickyNotesApi.stickyNoteToText(emptyTextNote),
        checklist: stickyNotesApi.stickyNoteToText(checklistNote),
        emptyChecklist: stickyNotesApi.stickyNoteToText(emptyChecklistNote),
      };
    });
    expect(result.text).toBe("Un texte libre à convertir");
    expect(result.emptyText).toBe("");
    expect(result.checklist).toBe("☑ Ligne cochée\n☐ Ligne non cochée");
    expect(result.emptyChecklist).toBe("");
  });
});
